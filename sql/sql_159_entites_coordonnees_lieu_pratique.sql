-- =============================================================================
-- sql_159_entites_coordonnees_lieu_pratique.sql
-- Module B « Prospection / Developpement scolaire » — enrichissement fiche ecole.
-- Retour terrain (OODA Lohann) : les informations ecoles sont insuffisantes pour
-- realiser les interventions bout en bout, notamment le LIEU DE PRATIQUE envisage.
--
-- 7 colonnes ADDITIVES NULLABLE sur public.entites :
--   adresse, code_postal, commune, telephone  -- coordonnees postales/tel ecole
--   uai                                       -- code UAI/RNE Education nationale
--   zone                                      -- circonscription / zone de secteur
--   lieu_pratique                             -- lieu de pratique envisage (OODA)
--
-- upsert_entite : 16 -> 23 params. CREATE OR REPLACE ne peut pas changer une
-- signature => DROP de l'ancienne 16-params puis recreation (piege surcharge
-- PostgREST : deux overloads = « could not choose best candidate », precedent
-- DROP+recreation trace sql_143). Les 7 nouveaux params sont en FIN de
-- signature avec DEFAULT NULL : les appels existants a 16 params nommes
-- (suivi-salarie.html, creation seule) restent valides sans modification.
--
-- Invariants reconduits a l'identique (corps deploye relu a la source — DS-1) :
--   SECURITY DEFINER + set search_path 'public' + garde _gs_peut_ecrire()
--   + UPDATE DUR (no COALESCE, patron fige) + REVOKE public/anon + GRANT
--   authenticated + do $verif$ fail-loud. Pas de begin/commit explicite.
--
-- RISQUE TRACE (fenetre SQL->front) : un UPDATE emis par l'ancien front
-- (developpement-scolaire.html 16 params) entre le deploiement de ce script et
-- celui du front 23 params remettrait les 7 nouvelles colonnes a NULL (UPDATE
-- DUR assume). Mitigation : deployer developpement-scolaire.html immediatement
-- apres ; ne pas editer de fiche ecole dans l'intervalle.
-- =============================================================================

-- 1) Colonnes additives -------------------------------------------------------
alter table public.entites add column if not exists adresse       text;
alter table public.entites add column if not exists code_postal   text;
alter table public.entites add column if not exists commune       text;
alter table public.entites add column if not exists telephone     text;
alter table public.entites add column if not exists uai           text;
alter table public.entites add column if not exists zone          text;
alter table public.entites add column if not exists lieu_pratique text;

-- NB : list_entites (RETURNS SETOF entites, select *) remonte les nouvelles
-- colonnes automatiquement — aucune modification necessaire.

-- 2) upsert_entite : DROP ancienne signature puis recreation 23 params --------
drop function if exists public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text,
  boolean, text, text, text, text, text
);

create or replace function public.upsert_entite(
  p_id                  uuid,
  p_code                text,
  p_libelle             text,
  p_type_entite         text,
  p_libelle_court       text    default null,
  p_site_id             uuid    default null,
  p_refacturable_defaut boolean default false,
  p_contact_nom         text    default null,
  p_contact_email       text    default null,
  p_statut_prospection  text    default null,
  p_actif               boolean default true,
  p_notes               text    default null,
  p_adresse_facturation text    default null,
  p_raison_sociale      text    default null,
  p_email_facturation   text    default null,
  p_siret               text    default null,
  p_adresse             text    default null,
  p_code_postal         text    default null,
  p_commune             text    default null,
  p_telephone           text    default null,
  p_uai                 text    default null,
  p_zone                text    default null,
  p_lieu_pratique       text    default null
)
returns public.entites
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.entites;
  v_me  uuid;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_libelle), '') = '' then
    raise exception 'Le code et le libellé sont obligatoires.';
  end if;
  select personne_id into v_me from public.qui_suis_je();
  if p_id is null then
    insert into public.entites(
      code, libelle, libelle_court, type_entite, site_id, refacturable_defaut,
      contact_nom, contact_email, statut_prospection, actif, notes,
      adresse_facturation, raison_sociale, email_facturation, siret,
      adresse, code_postal, commune, telephone, uai, zone, lieu_pratique,
      cree_par)
    values(
      p_code, p_libelle, p_libelle_court, p_type_entite, p_site_id, p_refacturable_defaut,
      p_contact_nom, p_contact_email, p_statut_prospection, p_actif, p_notes,
      p_adresse_facturation, p_raison_sociale, p_email_facturation, p_siret,
      p_adresse, p_code_postal, p_commune, p_telephone, p_uai, p_zone, p_lieu_pratique,
      v_me)
    returning * into v_row;
  else
    update public.entites set
      code = p_code, libelle = p_libelle, libelle_court = p_libelle_court,
      type_entite = p_type_entite, site_id = p_site_id,
      refacturable_defaut = p_refacturable_defaut,
      contact_nom = p_contact_nom, contact_email = p_contact_email,
      statut_prospection = p_statut_prospection, actif = p_actif, notes = p_notes,
      adresse_facturation = p_adresse_facturation,
      raison_sociale = p_raison_sociale, email_facturation = p_email_facturation,
      siret = p_siret,
      adresse = p_adresse, code_postal = p_code_postal, commune = p_commune,
      telephone = p_telephone, uai = p_uai, zone = p_zone,
      lieu_pratique = p_lieu_pratique
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Entité introuvable : %', p_id;
    end if;
  end if;
  return v_row;
end;
$function$;

-- 3) Permissions (a re-emettre apres DROP+recreation) --------------------------
revoke all on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text,
  boolean, text, text, text, text, text,
  text, text, text, text, text, text, text
) from public;
revoke all on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text,
  boolean, text, text, text, text, text,
  text, text, text, text, text, text, text
) from anon;
grant execute on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text,
  boolean, text, text, text, text, text,
  text, text, text, text, text, text, text
) to authenticated;

-- 4) Verification fail-loud ----------------------------------------------------
do $verif$
declare
  v_ok    boolean;
  v_count integer;
begin
  v_count := (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'entites'
      and column_name in ('adresse', 'code_postal', 'commune', 'telephone',
                          'uai', 'zone', 'lieu_pratique'));
  if v_count <> 7 then
    raise exception 'VERIF: % colonne(s) sur 7 attendues sur entites.', v_count;
  end if;

  -- Une seule surcharge upsert_entite, a 23 params (piege PostgREST evite).
  v_count := (select count(*)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_entite');
  if v_count <> 1 then
    raise exception 'VERIF: % surcharge(s) upsert_entite (1 attendue).', v_count;
  end if;

  v_ok := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_entite'
      and p.pronargs = 23
  ));
  if not v_ok then
    raise exception 'VERIF: upsert_entite n''a pas 23 parametres.';
  end if;

  raise notice 'VERIF OK : 7 colonnes entites + upsert_entite 23 params (surcharge unique).';
end;
$verif$;
