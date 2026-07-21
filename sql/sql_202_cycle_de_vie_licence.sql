-- pt 211 (chantier CYCLE-DE-VIE-LICENCE) : distinguer et visualiser dans l'Effectif trois
-- situations aujourd'hui confondues : joueur ACTIF (renouvele cette saison), joueur A RENOUVELER
-- (pas encore reimporte pour la saison active), joueur ARCHIVE (parti, marque a la main, reversible).
--
-- PREREQUIS SONDES :
--   - synchronisation_statut a un CHECK technique (a_jour/en_attente/erreur) -> INUTILISABLE pour
--     le metier -> champs dedies.
--   - saisons.est_active fiable (active = 2026/2027).
--   - get_joueurs_categorie.etat_calcule + renderEtatBadge + classe is-<etat> + filtres + KPI
--     (js/joueurs-browser.js) = infra d'affichage reutilisee (front livre a part).
--
-- DECISIONS (Manu, gelees pt 211) :
--   D1 marqueur = colonne derniere_saison_importee uuid (FK saisons).
--   D2 pose par import_qualites_ffr (deviation assumee : seule RPC qui "voit" les licences) ET
--      par creer_personne_depuis_import (une fiche creee depuis l'import de la saison N est
--      confirmee pour N).
--   D3 grisage "a renouveler" AUTOMATIQUE (derniere_saison_importee != saison active).
--   D4 archivage = statut fiche est_archive (Voie B), REVERSIBLE, geste admin manuel.
--   Vivier : archives EXCLUS de get_vivier_compo* ; "a renouveler" GARDES selectionnables.
--   Priorite etat_calcule : archive > suspendu > blesse > indisponible > a_renouveler > inactif > actif.
begin;

-- ============================================================================
-- VOLET 1 & 2 — DDL : marqueur temporel + statut archivage
-- ============================================================================
alter table public.personnes
  add column if not exists derniere_saison_importee uuid references public.saisons(id);
alter table public.personnes
  add column if not exists est_archive boolean not null default false;
alter table public.personnes
  add column if not exists date_archivage timestamptz;

comment on column public.personnes.derniere_saison_importee is
  'pt 211 : id de la derniere saison ou la fiche a ete confirmee par un import OVAL-E. '
  'NULL ou != saison active => "a renouveler".';
comment on column public.personnes.est_archive is
  'pt 211 : fiche archivee (personne partie du club, marquage admin reversible).';

-- ============================================================================
-- VOLET 1 — import_qualites_ffr : pose derniere_saison_importee (additif)
-- Reproduction fidele de la definition deployee, SEULE modification = la resolution
-- de la saison active + l'UPDATE qui pose derniere_saison_importee en plus de qualites_ffr.
-- ============================================================================
create or replace function public.import_qualites_ffr(p_payload jsonb)
 returns table(out_matchees integer, out_cas2 jsonb, out_cas3 jsonb, out_codes_inconnus jsonb, out_total_payload integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_connu text[] := public.vocabulaire_ffr_connu();
  v_saison_active uuid;
begin
  if not public.has_role('admin') then
    raise exception 'Réservé à l''administration (admin).';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then
    raise exception 'Payload invalide : tableau JSON attendu.';
  end if;

  -- Saison active (pour le marqueur de renouvellement). NULL toleré (aucune active) :
  -- l'UPDATE posera alors NULL, sans erreur.
  select id into v_saison_active from public.saisons where est_active = true limit 1;

  create temporary table _imp_src on commit drop as
  select
    btrim(elem->>'lic')                                   as lic,
    (select array_agg(distinct btrim(c::text) order by btrim(c::text))
       from jsonb_array_elements_text(elem->'codes') c
      where btrim(c::text) <> '')                          as codes
  from jsonb_array_elements(p_payload) elem
  where coalesce(btrim(elem->>'lic'), '') <> '';

  -- UPDATE non-destructif : qualites_ffr + marqueur de saison (jointure numero_licence_ffr).
  update public.personnes p
  set qualites_ffr = s.codes,
      derniere_saison_importee = v_saison_active
  from _imp_src s
  where p.numero_licence_ffr = s.lic;

  get diagnostics out_matchees = row_count;

  select coalesce(jsonb_agg(jsonb_build_object('lic', s.lic) order by s.lic), '[]'::jsonb)
    into out_cas2
  from _imp_src s
  where not exists (select 1 from public.personnes p where p.numero_licence_ffr = s.lic);

  select coalesce(jsonb_agg(
            jsonb_build_object('lic', p.numero_licence_ffr, 'nom', p.nom, 'prenom', p.prenom)
            order by p.nom, p.prenom), '[]'::jsonb)
    into out_cas3
  from public.personnes p
  where p.numero_licence_ffr is not null
    and btrim(p.numero_licence_ffr) <> ''
    and not exists (select 1 from _imp_src s where s.lic = p.numero_licence_ffr);

  select coalesce(jsonb_agg(
            jsonb_build_object('code', x.code, 'lic', x.lic) order by x.code, x.lic), '[]'::jsonb)
    into out_codes_inconnus
  from (
    select distinct s.lic, code
    from _imp_src s, unnest(s.codes) as code
    where not (code = any(v_connu))
  ) x;

  select count(*)::int into out_total_payload from _imp_src;
  return next;
end;
$function$;

-- ============================================================================
-- VOLET 1 — creer_personne_depuis_import : pose derniere_saison_importee a la creation
-- ============================================================================
create or replace function public.creer_personne_depuis_import(p_payload jsonb)
returns table(statut text, personne_id uuid, nom text, prenom text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lic      text := btrim(coalesce(p_payload->>'lic',''));
  v_nom      text := btrim(coalesce(p_payload->>'nom',''));
  v_prenom   text := btrim(coalesce(p_payload->>'prenom',''));
  v_codes    text[];
  v_cat      text;
  v_type     text;
  v_a_joueur boolean;
  v_a_staff  boolean;
  v_id       uuid;
  v_saison_active uuid;
begin
  if not public.has_role('admin') then
    raise exception 'Réservé à l''administration (admin).';
  end if;
  if v_lic = '' then
    raise exception 'Numéro de licence requis.';
  end if;
  if v_nom = '' or v_prenom = '' then
    raise exception 'Nom et prénom requis.';
  end if;
  select id into v_id from public.personnes where numero_licence_ffr = v_lic limit 1;
  if v_id is not null then
    return query select 'existe_deja'::text, p.id, p.nom, p.prenom
                 from public.personnes p where p.id = v_id;
    return;
  end if;
  select array_agg(distinct btrim(c) order by btrim(c)) into v_codes
  from jsonb_array_elements_text(coalesce(p_payload->'codes','[]'::jsonb)) c
  where btrim(c) <> '';
  v_codes := coalesce(v_codes, array[]::text[]);
  v_a_joueur := v_codes && array['A','AM','RLSP','RLO']::text[];
  v_a_staff  := v_codes && array['DC4','EDU','ECF','SOI','ACF']::text[];
  v_cat := case when v_a_joueur and v_a_staff then 'joueur_et_staff'
                when v_a_joueur then 'joueur' when v_a_staff then 'staff' else 'joueur' end;
  v_type := case when v_a_joueur then 'licencie_competition'
                 when v_codes && array['EDU','ECF']::text[] then 'licencie_educateur'
                 when v_codes && array['SOI']::text[] then 'licencie_soigneur'
                 when v_a_staff then 'licencie_dirigeant' else 'licencie_competition' end;
  select id into v_saison_active from public.saisons where est_active = true limit 1;
  insert into public.personnes (
    nom, prenom, categorie_personne, type_personne, qualites_ffr,
    numero_licence_ffr, email_principal, telephone_principal,
    adresse_postale, code_postal, ville, date_naissance,
    nationalite_principale, date_fin_affiliation, source_creation,
    derniere_saison_importee
  ) values (
    v_nom, v_prenom, v_cat, v_type, v_codes, v_lic,
    nullif(btrim(coalesce(p_payload->>'email','')),''),
    nullif(btrim(coalesce(p_payload->>'tel','')),''),
    nullif(btrim(coalesce(p_payload->>'adresse','')),''),
    nullif(btrim(coalesce(p_payload->>'cp','')),''),
    nullif(btrim(coalesce(p_payload->>'ville','')),''),
    (nullif(btrim(coalesce(p_payload->>'date_naissance','')),''))::date,
    coalesce(nullif(btrim(coalesce(p_payload->>'nationalite','')),''),'France'),
    (nullif(btrim(coalesce(p_payload->>'date_fin_affiliation','')),''))::date,
    'import-oval-e',
    v_saison_active
  ) returning id into v_id;
  return query select 'cree'::text, v_id, v_nom, v_prenom;
end;
$$;

-- ============================================================================
-- VOLET 2 — RPC archiver_personne (reversible, garde admin)
-- ============================================================================
create or replace function public.archiver_personne(p_id uuid, p_archive boolean)
returns table(personne_id uuid, est_archive boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if not public.has_role('admin') then
    raise exception 'Réservé à l''administration (admin).';
  end if;
  if p_id is null then
    raise exception 'Identifiant personne requis.';
  end if;
  select exists(select 1 from public.personnes where id = p_id) into v_exists;
  if not v_exists then
    raise exception 'Personne introuvable.';
  end if;
  update public.personnes
  set est_archive    = coalesce(p_archive, false),
      date_archivage = case when coalesce(p_archive,false) then now() else null end
  where id = p_id;
  return query select p.id, p.est_archive from public.personnes p where p.id = p_id;
end;
$$;

revoke all on function public.archiver_personne(uuid, boolean) from public;
revoke all on function public.archiver_personne(uuid, boolean) from anon;
grant execute on function public.archiver_personne(uuid, boolean) to authenticated;

-- ============================================================================
-- VOLET 3 — get_joueurs_categorie : etat_calcule enrichi (archive + a_renouveler)
-- Signature INCHANGEE (etat_calcule existe deja) => CREATE OR REPLACE, pas de DROP.
-- Priorite : archive > suspendu > blesse > indisponible > a_renouveler > inactif > actif.
-- "a_renouveler" borne aux LICENCIES MOM (pas partenaires externes, pas sans-licence).
-- Branche encadrants : archive si est_archive, sinon actif (pas de renouvellement pour un coach).
-- ============================================================================
create or replace function public.get_joueurs_categorie(p_categorie_id uuid)
 returns table(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  WITH cat AS (
    SELECT c.id, c.type_categorie, c.type_licence_ffr, (c.type_categorie = 'Loisirs') AS est_loisirs
    FROM categories c WHERE c.id = p_categorie_id
  ), sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 )
  -- Branche JOUEURS
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
    p.categorie_id, c.libelle_court, p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids, p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur' THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant' AND COALESCE(p.qualite_ffr,'') LIKE 'DC%' THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur' THEN 'staff'
      WHEN p.type_personne = 'licencie_competition' AND p.f15_integree = TRUE THEN 'f15'
      WHEN p.type_personne = 'licencie_competition' THEN 'mom' ELSE 'autre' END,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      WHEN p.type_personne <> 'licencie_externe_partenaire'
           AND p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      ELSE 'actif' END,
    NULL::text
  FROM cat JOIN personnes p ON (
    (cat.est_loisirs AND cat.type_licence_ffr = ANY(COALESCE(p.qualites_ffr, ARRAY[]::text[])))
    OR (NOT cat.est_loisirs AND p.categorie_id = p_categorie_id
        AND NOT (COALESCE(p.qualites_ffr, ARRAY[]::text[]) && ARRAY['RLSP','RLO'])))
  LEFT JOIN LATERAL (SELECT ej2.* FROM equipe_joueurs ej2 WHERE ej2.personne_id = p.id
      AND (ej2.date_sortie IS NULL OR ej2.date_sortie >= CURRENT_DATE)
      ORDER BY ej2.date_affectation DESC NULLS LAST LIMIT 1) ej ON TRUE
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  UNION ALL
  -- Branche ENCADRANTS (pt 209) — MEME cycle de renouvellement que les joueurs (Vision A,
  -- pt 211 affinage) : un coach a une licence FFR (DC4/EDU...) qui se renouvelle chaque saison.
  -- archive > a_renouveler (licence non reimportee saison active) > actif.
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = p_categorie_id AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;

grant execute on function public.get_joueurs_categorie(uuid) to authenticated;
grant execute on function public.get_joueurs_categorie(uuid) to service_role;

-- ============================================================================
-- VOLET 3 — Exclusion des archives du vivier de compo (2 fonctions, additif : 1 clause chacune)
-- Reproduction fidele des definitions deployees (post-pt208), SEULE modification =
-- ajout de "AND NOT COALESCE(p.est_archive, false)" au WHERE.
-- ============================================================================
create or replace function public.get_vivier_compo(p_equipe_id uuid)
 returns table(joueur_id uuid, nom text, prenom text, sexe text, date_naissance date, categorie_id uuid, categorie_libelle_court text, club_principal_id uuid, club_principal_nom_court text, type_personne text, f15_integree boolean, est_partenaire_entente boolean, statut_attache text, niveau_profil text, date_affectation date)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_categorie_id              UUID;
  v_categorie_code            TEXT;
  v_club_principal_entente_id UUID;
BEGIN
  SELECT en.categorie_id, c.code, en.club_principal_id
    INTO v_categorie_id, v_categorie_code, v_club_principal_entente_id
  FROM equipes      e
  JOIN ententes     en ON e.entente_id   = en.id
  JOIN categories   c  ON en.categorie_id = c.id
  WHERE e.id = p_equipe_id;
  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Équipe % introuvable ou sans entente parent.', p_equipe_id;
  END IF;
  RETURN QUERY
  SELECT
    p.id AS joueur_id, p.nom, p.prenom, p.sexe, p.date_naissance, p.categorie_id,
    cat.libelle_court AS categorie_libelle_court, p.club_principal_id,
    clb.nom_court AS club_principal_nom_court, p.type_personne, p.f15_integree,
    (p.club_principal_id IS DISTINCT FROM v_club_principal_entente_id) AS est_partenaire_entente,
    ej.statut AS statut_attache, ej.niveau_profil, ej.date_affectation
  FROM personnes p
  LEFT JOIN categories cat ON p.categorie_id      = cat.id
  LEFT JOIN clubs      clb ON p.club_principal_id = clb.id
  LEFT JOIN equipe_joueurs ej
         ON ej.equipe_id    = p_equipe_id
        AND ej.personne_id  = p.id
        AND ej.date_sortie IS NULL
  WHERE p.categorie_personne LIKE '%joueur%'
    AND NOT COALESCE(p.est_archive, FALSE)
    AND (
          p.categorie_id = v_categorie_id
       OR (p.f15_integree = TRUE AND v_categorie_code = 'M14')
        )
  ORDER BY
    CASE ej.statut
      WHEN 'regulier'           THEN 1
      WHEN 'renfort_temporaire' THEN 2
      WHEN 'en_transition'      THEN 3
      ELSE                           4
    END,
    p.nom, p.prenom;
END;
$function$;

create or replace function public.get_vivier_compo_categorie(p_categorie_id uuid)
 returns table(joueur_id uuid, nom text, prenom text, sexe text, date_naissance date, categorie_id uuid, categorie_libelle_court text, club_principal_id uuid, club_principal_nom_court text, type_personne text, f15_integree boolean, est_partenaire_entente boolean, statut_attache text, niveau_profil text, date_affectation date)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_categorie_id              UUID;
  v_categorie_code            TEXT;
  v_club_principal_entente_id UUID;
BEGIN
  SELECT c.id, c.code
    INTO v_categorie_id, v_categorie_code
  FROM categories c
  WHERE c.id = p_categorie_id;
  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie % introuvable.', p_categorie_id;
  END IF;
  SELECT en.club_principal_id
    INTO v_club_principal_entente_id
  FROM ententes en
  JOIN saisons  s ON s.id = en.saison_id
  WHERE en.categorie_id = p_categorie_id
    AND s.est_active = TRUE
  LIMIT 1;
  RETURN QUERY
  SELECT
    p.id AS joueur_id, p.nom, p.prenom, p.sexe, p.date_naissance, p.categorie_id,
    cat.libelle_court AS categorie_libelle_court, p.club_principal_id,
    clb.nom_court AS club_principal_nom_court, p.type_personne, p.f15_integree,
    (p.club_principal_id IS DISTINCT FROM v_club_principal_entente_id) AS est_partenaire_entente,
    NULL::text AS statut_attache, NULL::text AS niveau_profil, NULL::date AS date_affectation
  FROM personnes p
  LEFT JOIN categories cat ON p.categorie_id      = cat.id
  LEFT JOIN clubs      clb ON p.club_principal_id = clb.id
  WHERE p.categorie_personne LIKE '%joueur%'
    AND NOT COALESCE(p.est_archive, FALSE)
    AND (
          p.categorie_id = v_categorie_id
       OR (p.f15_integree = TRUE AND v_categorie_code = 'M14')
        )
  ORDER BY
    p.nom, p.prenom;
END;
$function$;

-- ============================================================================
-- VERIFICATION fail-loud
-- ============================================================================
do $verif$
declare
  v_cols int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_schema='public' and table_name='personnes'
     and column_name in ('derniere_saison_importee','est_archive','date_archivage');
  if v_cols < 3 then
    raise exception 'KO : colonnes cycle de vie absentes (attendu 3, trouve %).', v_cols;
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='archiver_personne') then
    raise exception 'KO : archiver_personne absente.';
  end if;
  raise notice 'CYCLE-DE-VIE-LICENCE OK : colonnes + archiver_personne + etat_calcule enrichi + viviers filtres.';
end;
$verif$;

commit;
