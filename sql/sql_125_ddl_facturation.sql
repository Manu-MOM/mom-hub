-- =============================================================================
-- sql_125_ddl_facturation.sql
-- Chantier A — DDL facturation (socle du chantier SALARIE-REFONTE-MODALE-MISSION)
--
-- Objet : poser le socle de données de la facturation hybride.
--   - Durable (vit sur le bénéficiaire = entites) : raison sociale, email de
--     facturation, SIRET. L'adresse de facturation existe déjà (sql_121).
--   - Prestation (vit sur la mission = missions) : référence/commande, montant.
--
-- Modèle hybride (PASSATION-salarie-refonte-modale-mission.md §2.3) :
--   les coordonnées durables vivent sur entites (source unique, pas de
--   duplication par mission) ; les infos propres à une prestation vivent sur
--   missions. Ce fichier ne fait QUE le DDL + l'élargissement des deux RPC
--   d'upsert. Aucun statut, aucun mode de génération, aucun front (chantiers
--   B / C / D).
--
-- DS-1 : corps de upsert_entite (13 params) et upsert_mission (18 params) relus
--   à la source (pg_get_functiondef) AVANT écriture. Recopiés à l'identique ;
--   seuls ajouts = les nouveaux paramètres + colonnes dans INSERT et UPDATE.
--   upsert_mission fait un UPDATE DUR sans COALESCE (inversion DS-1 pt 118) :
--   chaque nouvelle colonne est donc câblée dans l'INSERT ET l'UPDATE.
--   La logique v_refac (pré-remplissage refacturable depuis entites, « Q4 »)
--   est PRÉSERVÉE à l'identique.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS ; DROP FUNCTION IF EXISTS (signature
--   exacte) avant CREATE OR REPLACE pour éviter la surcharge ambiguë.
-- Nouveaux paramètres ajoutés EN FIN de signature avec DEFAULT NULL : les
--   appels par nom existants du front résolvent sans ambiguïté, le nouveau
--   param prend NULL → aucune régression.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Colonnes DURABLES sur entites (facturation, vivent sur le bénéficiaire)
-- -----------------------------------------------------------------------------
alter table public.entites
  add column if not exists raison_sociale    text;
alter table public.entites
  add column if not exists email_facturation text;
alter table public.entites
  add column if not exists siret             text;

-- -----------------------------------------------------------------------------
-- 2. Colonnes PRESTATION sur missions (propres à la mission, ne remontent pas)
-- -----------------------------------------------------------------------------
alter table public.missions
  add column if not exists reference_commande text;
alter table public.missions
  add column if not exists montant            numeric(12, 2);

-- -----------------------------------------------------------------------------
-- 3. upsert_entite : 13 -> 16 params (+ raison_sociale, email_facturation, siret)
--    DROP de la signature 13-params exacte (anti-surcharge), puis CREATE 16-params.
-- -----------------------------------------------------------------------------
drop function if exists public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text, text
);

create or replace function public.upsert_entite(
  p_id uuid,
  p_code text,
  p_libelle text,
  p_type_entite text,
  p_libelle_court text default null::text,
  p_site_id uuid default null::uuid,
  p_refacturable_defaut boolean default false,
  p_contact_nom text default null::text,
  p_contact_email text default null::text,
  p_statut_prospection text default null::text,
  p_actif boolean default true,
  p_notes text default null::text,
  p_adresse_facturation text default null::text,
  p_raison_sociale text default null::text,
  p_email_facturation text default null::text,
  p_siret text default null::text
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
      adresse_facturation, raison_sociale, email_facturation, siret, cree_par)
    values(
      p_code, p_libelle, p_libelle_court, p_type_entite, p_site_id, p_refacturable_defaut,
      p_contact_nom, p_contact_email, p_statut_prospection, p_actif, p_notes,
      p_adresse_facturation, p_raison_sociale, p_email_facturation, p_siret, v_me)
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
      siret = p_siret
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Entité introuvable : %', p_id;
    end if;
  end if;
  return v_row;
end;
$function$;

-- REVOKE depuis PUBLIC ET anon : sur Supabase les default privileges du schéma
-- public accordent EXECUTE à PUBLIC (dont anon hérite) ; REVOKE FROM anon seul
-- ne suffit pas (leçon DS-1 pt 109).
revoke all on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text,
  text, text, text, text
) from public;
revoke all on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text,
  text, text, text, text
) from anon;
grant execute on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text,
  text, text, text, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. upsert_mission : 18 -> 20 params (+ reference_commande, montant)
--    DROP de la signature 18-params exacte (anti-surcharge), puis CREATE 20-params.
--    Corps recopié à l'identique (sonde A3). v_refac PRÉSERVÉ.
-- -----------------------------------------------------------------------------
drop function if exists public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text
);

create or replace function public.upsert_mission(
  p_id uuid,
  p_code text,
  p_libelle text,
  p_type_mission text,
  p_salarie_id uuid,
  p_entite_id uuid,
  p_saison_id uuid,
  p_date_debut date,
  p_lieu_id uuid default null::uuid,
  p_lieu_libre text default null::text,
  p_date_fin date default null::date,
  p_recurrence jsonb default null::jsonb,
  p_est_cadre boolean default false,
  p_refacturable boolean default null::boolean,
  p_etat text default 'prevue'::text,
  p_bilan_text text default null::text,
  p_questionnaire_fait boolean default false,
  p_notes text default null::text,
  p_reference_commande text default null::text,
  p_montant numeric default null::numeric
)
returns public.missions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row    public.missions;
  v_me     uuid;
  v_refac  boolean;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_libelle), '') = '' then
    raise exception 'Le code et le libellé sont obligatoires.';
  end if;

  -- refacturable : si non fourni, pré-rempli depuis le bénéficiaire (Q4)
  if p_refacturable is null then
    select refacturable_defaut into v_refac from public.entites where id = p_entite_id;
    v_refac := coalesce(v_refac, false);
  else
    v_refac := p_refacturable;
  end if;

  select personne_id into v_me from public.qui_suis_je();

  if p_id is null then
    insert into public.missions(
      code, libelle, type_mission, salarie_id, entite_id, saison_id,
      lieu_id, lieu_libre, date_debut, date_fin, recurrence, est_cadre,
      refacturable, etat, bilan_text, questionnaire_fait, notes,
      reference_commande, montant, cree_par)
    values(
      p_code, p_libelle, p_type_mission, p_salarie_id, p_entite_id, p_saison_id,
      p_lieu_id, p_lieu_libre, p_date_debut, p_date_fin, p_recurrence, p_est_cadre,
      v_refac, p_etat, p_bilan_text, p_questionnaire_fait, p_notes,
      p_reference_commande, p_montant, v_me)
    returning * into v_row;
  else
    update public.missions set
      code = p_code, libelle = p_libelle, type_mission = p_type_mission,
      salarie_id = p_salarie_id, entite_id = p_entite_id, saison_id = p_saison_id,
      lieu_id = p_lieu_id, lieu_libre = p_lieu_libre, date_debut = p_date_debut,
      date_fin = p_date_fin, recurrence = p_recurrence, est_cadre = p_est_cadre,
      refacturable = v_refac, etat = p_etat, bilan_text = p_bilan_text,
      questionnaire_fait = p_questionnaire_fait, notes = p_notes,
      reference_commande = p_reference_commande, montant = p_montant
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Mission introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$function$;

revoke all on function public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric
) from public;
revoke all on function public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric
) from anon;
grant execute on function public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric
) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Vérification fail-loud (refuse de committer si l'état n'est pas conforme)
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_nb int;
begin
  -- 5 colonnes neuves présentes
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'entites'
                   and column_name = 'raison_sociale') then
    raise exception 'VERIF: entites.raison_sociale absente';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'entites'
                   and column_name = 'email_facturation') then
    raise exception 'VERIF: entites.email_facturation absente';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'entites'
                   and column_name = 'siret') then
    raise exception 'VERIF: entites.siret absente';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'missions'
                   and column_name = 'reference_commande') then
    raise exception 'VERIF: missions.reference_commande absente';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'missions'
                   and column_name = 'montant') then
    raise exception 'VERIF: missions.montant absente';
  end if;

  -- upsert_entite présente en signature 16-params (et seule, pas de surcharge)
  select count(*) into v_nb
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'upsert_entite';
  if v_nb <> 1 then
    raise exception 'VERIF: upsert_entite doit exister en 1 exemplaire, trouvé %', v_nb;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_entite'
      and pg_get_function_identity_arguments(p.oid) like '%p_siret text%'
  ) then
    raise exception 'VERIF: upsert_entite ne porte pas p_siret (16-params attendue)';
  end if;

  -- upsert_mission présente en signature 20-params (et seule, pas de surcharge)
  select count(*) into v_nb
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'upsert_mission';
  if v_nb <> 1 then
    raise exception 'VERIF: upsert_mission doit exister en 1 exemplaire, trouvé %', v_nb;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_mission'
      and pg_get_function_identity_arguments(p.oid) like '%p_montant numeric%'
  ) then
    raise exception 'VERIF: upsert_mission ne porte pas p_montant (20-params attendue)';
  end if;

  -- anon fermé sur les deux RPC
  if has_function_privilege('anon', 'public.upsert_entite(uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text, text, text, text, text)', 'execute') then
    raise exception 'VERIF: anon ne doit pas pouvoir exécuter upsert_entite';
  end if;
  if has_function_privilege('anon', 'public.upsert_mission(uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb, boolean, boolean, text, text, boolean, text, text, numeric)', 'execute') then
    raise exception 'VERIF: anon ne doit pas pouvoir exécuter upsert_mission';
  end if;

  -- authenticated ouvert sur les deux RPC
  if not has_function_privilege('authenticated', 'public.upsert_entite(uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text, text, text, text, text)', 'execute') then
    raise exception 'VERIF: authenticated doit pouvoir exécuter upsert_entite';
  end if;
  if not has_function_privilege('authenticated', 'public.upsert_mission(uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb, boolean, boolean, text, text, boolean, text, text, numeric)', 'execute') then
    raise exception 'VERIF: authenticated doit pouvoir exécuter upsert_mission';
  end if;

  raise notice 'VERIF sql_125 OK : 5 colonnes + 2 RPC élargies (anon fermé, authenticated ouvert)';
end;
$verif$;

commit;
