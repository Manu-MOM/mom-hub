-- ============================================================================
-- sql_153 — CATEGORIE-SECTION-RUGBY · SOCLE (pôle + catégorie + colonne flag)
-- FAIT FOI gelé 05/07/2026 md5 b67f451d497321d0ebb01cff25dfdf52 (D1=a, D3=option 3).
--
-- 3 gestes, transactionnels, idempotents :
--   1. INSERT poles : pôle dédié « Section », Lohann HUMBERT responsable
--      principal (589e7977-748c-42db-b29c-0505ec0d2e41), UUID FIGÉ (le front
--      référencera la catégorie par constante, patron F15_CAT_UUID pt 109).
--   2. INSERT categories : ligne SECTION rattachée au pôle.
--      age_min/age_max = NULL → INVISIBLE pour _derive_bascule (prouvé par
--      lecture du corps, sonde S1 du 05/07 : seules les catégories à
--      age_max IS NOT NULL sont des cibles de dérivation). SECTION n'entre
--      PAS dans poles.categories_rattachees (array réservé à l'éligibilité
--      bascule). type_categorie = 'Section' (valeur nouvelle : n'hérite ni
--      de la logique Loisirs de get_joueurs_categorie ni d'aucune autre).
--   3. ALTER personnes : colonne section_rugby, réplique EXACTE du patron
--      f15_integree sondé (boolean NOT NULL DEFAULT false).
--
-- INTERDIT (double preuve S1) : ne JAMAIS assigner cette catégorie à
-- personnes.categorie_id — la personne sortirait du périmètre de la bascule.
-- L'appartenance = flag personnes.section_rugby, exclusivement.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- geste 1
insert into public.poles (
    id, code, libelle_court, libelle_long,
    categories_rattachees, responsable_principal_id
)
values (
    '2f6a1c0e-9b3d-4e7a-8c51-0d4b2a9e6f13',
    'SECTION',
    'Section',
    'Pôle Section rugby scolaire',
    '{}'::text[],
    '589e7977-748c-42db-b29c-0505ec0d2e41'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- geste 2
insert into public.categories (
    id, code, libelle_court, libelle_long,
    type_categorie, genre, age_min, age_max,
    ordre_tri, pole_id, mixite_autorisee, notes
)
values (
    'b7e4d2a1-5c08-4f96-9a3d-1e8f6c07b254',
    'SECTION',
    'Section',
    'Section rugby scolaire',
    'Section',
    'mixte',
    null,
    null,
    150,
    '2f6a1c0e-9b3d-4e7a-8c51-0d4b2a9e6f13',
    true,
    'Catégorie transversale (patron F15). Appartenance = personnes.section_rugby ; ne JAMAIS assigner à personnes.categorie_id (invisibilité bascule garantie par age_max NULL, sonde S1 pt FAIT FOI 05/07/2026).'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- geste 3
alter table public.personnes
    add column if not exists section_rugby boolean not null default false;

comment on column public.personnes.section_rugby is
    'Membre de la Section rugby scolaire (flag transversal, patron f15_integree). Écrit exclusivement par la RPC set_section_rugby (sql_154). Survit à la bascule de saison (non référencé par _derive_bascule, prouvé S1 05/07/2026).';

-- ---------------------------------------------------------------- vérif
do $verif$
declare
    v_n int;
    v_age_max int;
    v_pole uuid;
    v_resp uuid;
begin
    -- pôle présent à l'UUID exact, Lohann responsable principal
    select count(*)::int into v_n
    from public.poles
    where id = '2f6a1c0e-9b3d-4e7a-8c51-0d4b2a9e6f13' and code = 'SECTION';
    if v_n <> 1 then
        raise exception 'sql_153 verif : pôle Section absent ou dupliqué (%).', v_n;
    end if;

    select responsable_principal_id into v_resp
    from public.poles
    where id = '2f6a1c0e-9b3d-4e7a-8c51-0d4b2a9e6f13';
    if v_resp is distinct from '589e7977-748c-42db-b29c-0505ec0d2e41' then
        raise exception 'sql_153 verif : responsable principal du pôle Section inattendu (%).', v_resp;
    end if;

    -- catégorie présente à l'UUID exact, age_max NULL, rattachée au pôle
    select count(*)::int into v_n
    from public.categories
    where id = 'b7e4d2a1-5c08-4f96-9a3d-1e8f6c07b254' and code = 'SECTION';
    if v_n <> 1 then
        raise exception 'sql_153 verif : catégorie SECTION absente ou dupliquée (%).', v_n;
    end if;

    select age_max, pole_id into v_age_max, v_pole
    from public.categories
    where id = 'b7e4d2a1-5c08-4f96-9a3d-1e8f6c07b254';
    if v_age_max is not null then
        raise exception 'sql_153 verif : age_max doit être NULL (invisibilité bascule), trouvé %.', v_age_max;
    end if;
    if v_pole is distinct from '2f6a1c0e-9b3d-4e7a-8c51-0d4b2a9e6f13' then
        raise exception 'sql_153 verif : pole_id de SECTION inattendu (%).', v_pole;
    end if;

    -- SECTION absent de tout categories_rattachees (garde bascule)
    select count(*)::int into v_n
    from public.poles
    where 'SECTION' = any (categories_rattachees);
    if v_n <> 0 then
        raise exception 'sql_153 verif : SECTION ne doit figurer dans aucun poles.categories_rattachees (%).', v_n;
    end if;

    -- colonne présente, patron f15_integree
    select count(*)::int into v_n
    from information_schema.columns
    where table_schema = 'public' and table_name = 'personnes'
      and column_name = 'section_rugby'
      and data_type = 'boolean' and is_nullable = 'NO';
    if v_n <> 1 then
        raise exception 'sql_153 verif : colonne personnes.section_rugby absente ou non conforme.';
    end if;

    -- population initiale = 0 flaggé
    select count(*)::int into v_n from public.personnes where section_rugby;
    if v_n <> 0 then
        raise exception 'sql_153 verif : % personne(s) déjà flaggée(s), attendu 0.', v_n;
    end if;

    raise notice 'sql_153 OK : pôle Section + catégorie SECTION + personnes.section_rugby en place.';
end
$verif$;

commit;
