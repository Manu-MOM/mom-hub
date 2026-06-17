-- =============================================================
-- sql/sql_89_diag_mes_capabilities.sql
--
-- BUT : RPC de DIAGNOSTIC LECTURE SEULE. Pour la personne
--       connectée, retourne sa matrice effective
--       (categorie, action, autorise) telle que la calcule
--       puis_je_faire. Sert de FILET DE RECETTE TERRAIN du moteur
--       voie 2 (lots 87-88) AVANT toute migration de policy (lot 4,
--       irréversible). Aussi : brouillon de la vue lecture de la
--       future console (orientation pt 90).
--
-- CONTEXTE (pt 92, production voie 2, FAIT FOI md5 9aa943e6) :
--   - puis_je_faire n'a jamais tourné avec un auth.uid() réel
--     (SQL Editor : auth.uid() null -> toujours false sur la
--     branche referent). Impossible de prouver son comportement
--     depuis Supabase seul.
--   - Ce RPC, appelé par un testeur CONNECTÉ (admin / referent /
--     adjoint), rend visible le verdict du moteur SANS qu'aucune
--     policy ne soit basculée. Recette pure, zéro irréversible.
--
-- AUCUNE ÉCRITURE. Ne touche aucune policy. SELECT only.
--
-- PÉRIMÈTRE DES CATÉGORIES LISTÉES :
--   - référent : ses catégories dérivées des fonction_staff ACTIVES
--     (toutes fonctions, ADJOINT INCLUS — le diag doit montrer le
--     périmètre réel du moteur, pas le filtre mes_categories_
--     autorisees qui exclut l'adjoint).
--   - admin / bureau : une ligne synthétique « transverse » par
--     action (categorie_id null), car puis_je_faire rend true
--     partout sans catégorie bornée.
--
-- Idempotent (create or replace), fail-loud de signature.
-- =============================================================

begin;

create or replace function public.diag_mes_capabilities()
returns table (
  categorie_id     uuid,
  categorie_code   text,
  categorie_libelle text,
  action           text,
  autorise         boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_personne_id uuid;
  v_actions text[] := array[
    'ecrire_seance', 'ecrire_compo', 'valider_compo',
    'gerer_presences', 'gerer_evenements', 'composer_effectif'
  ];
begin
  -- Cas transverse : admin / bureau. puis_je_faire rend true partout,
  -- sans catégorie bornée -> on renvoie une ligne synthétique par action.
  if has_role('admin') or has_role('bureau') then
    return query
      select null::uuid,
             '(transverse)'::text,
             '(admin/bureau — accès non borné catégorie)'::text,
             a.action,
             public.puis_je_faire(a.action, null::uuid)
      from unnest(v_actions) as a(action);
    return;
  end if;

  -- Hors porte referent : aucune ligne (le diag reflète le plancher D7).
  if not has_role('referent') then
    return;
  end if;

  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  if v_personne_id is null then
    return;  -- referent non relié à une fiche
  end if;

  -- Catégories réelles de la personne (toutes fonctions actives,
  -- adjoint inclus) × 6 actions, verdict = puis_je_faire.
  return query
    with mes_cats as (
      select distinct fs.categorie_id
      from public.fonction_staff fs
      where fs.personne_id = v_personne_id
        and fs.date_fin is null
        and fs.categorie_id is not null
    )
    select c.id,
           c.code,
           c.libelle_court,
           a.action,
           public.puis_je_faire(a.action, c.id)
    from mes_cats mc
    join public.categories c on c.id = mc.categorie_id
    cross join unnest(v_actions) as a(action)
    order by c.code, a.action;
end;
$fn$;

comment on function public.diag_mes_capabilities() is
  'Diagnostic LECTURE SEULE voie 2 : matrice effective '
  '(categorie, action, autorise) de la personne connectée, telle que '
  'la calcule puis_je_faire. Filet de recette du moteur avant '
  'migration des policies. Aucune écriture.';

revoke all on function public.diag_mes_capabilities() from public;
grant execute on function public.diag_mes_capabilities() to authenticated;

-- -------------------------------------------------------------
-- FAIL-LOUD : signature exacte (0 arg) -> SETOF des 5 colonnes.
-- -------------------------------------------------------------
do $verif$
declare
  v_sig int;
begin
  select count(*) into v_sig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'diag_mes_capabilities'
    and p.prokind = 'f'
    and pg_get_function_identity_arguments(p.oid) = '';
  if v_sig <> 1 then
    raise exception 'FAIL-LOUD : diag_mes_capabilities() absent ou signature inattendue (% trouvée).', v_sig;
  end if;
  raise notice 'OK : diag_mes_capabilities() créé (lecture seule, 0 arg).';
end;
$verif$;

commit;
