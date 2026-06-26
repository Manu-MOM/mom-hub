-- =====================================================================
-- sql_116b_sync_releve_mapping_10types.sql
-- Chantier : MISSION-TO-COUNTER (D7 — fusion occurrence -> compteur)
-- Objet    : CREATE OR REPLACE de sync_releve_depuis_occurrence : aligne le
--            mapping type_mission -> categorie sur les 10 jetons definitifs
--            (sql_114). Corrige le CASE de sql_116 (anciens jetons herites).
--            Le reste du corps est IDENTIQUE a sql_116.
--              - occurrence 'realisee'        -> UPSERT de la ligne de releve
--              - occurrence 'prevue'|'annulee' -> DELETE de la ligne de releve
--            Le compteur (v_compteur_annualisation / list_compteur_annualisation)
--            n'est PAS touche : il continue d'agreger releve_heures_salarie seul
--            (pt 85 intact). Toute l'intelligence est ici, en amont du compteur.
-- Garde    : _gs_peut_ecrire() (admin | bureau, pt 78) — fail-loud.
-- Cle      : releve_heures_salarie.mission_seance_id (sql_115, index unique partiel).
-- Sondes   : S1/S2/S3/S5/S7/S8(b,c,d)/S10.
-- =====================================================================

begin;

create or replace function public.sync_releve_depuis_occurrence(
  p_mission_seance_id uuid
)
returns table (
  out_action          text,           -- 'upsert' | 'delete' | 'noop'
  out_releve_id       uuid,
  out_mission_seance_id uuid,
  out_etat_occurrence text,
  out_heures          numeric,
  out_categorie       text
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_occ        public.mission_seances%rowtype;
  v_type       text;
  v_salarie    uuid;
  v_contrat    uuid;
  v_nb_contrat int;
  v_heures     numeric;
  v_categorie  text;
  v_cree_par   uuid;
  v_releve_id  uuid;
begin
  -- 0) Garde d'ecriture (admin | bureau). Fail-loud.
  if not public._gs_peut_ecrire() then
    raise exception 'sync_releve_depuis_occurrence: ecriture refusee (admin|bureau requis)'
      using errcode = 'insufficient_privilege';
  end if;

  -- 1) Charger l'occurrence (fail-loud si introuvable).
  select * into v_occ
  from public.mission_seances
  where id = p_mission_seance_id;

  if not found then
    raise exception 'sync_releve_depuis_occurrence: occurrence % introuvable', p_mission_seance_id
      using errcode = 'no_data_found';
  end if;

  -- 2) Cas DELETE : occurrence non realisee -> retirer la ligne de releve si presente.
  if v_occ.etat is distinct from 'realisee' then
    delete from public.releve_heures_salarie
    where mission_seance_id = p_mission_seance_id
    returning id into v_releve_id;

    if v_releve_id is not null then
      out_action            := 'delete';
      out_releve_id         := v_releve_id;
      out_mission_seance_id := p_mission_seance_id;
      out_etat_occurrence   := v_occ.etat;
      out_heures            := null;
      out_categorie         := null;
      return next;
    else
      out_action            := 'noop';
      out_releve_id         := null;
      out_mission_seance_id := p_mission_seance_id;
      out_etat_occurrence   := v_occ.etat;
      out_heures            := null;
      out_categorie         := null;
      return next;
    end if;
    return;
  end if;

  -- 3) Cas UPSERT : occurrence 'realisee'.
  -- 3a) Type de mission (pour le mapping categorie).
  v_type := (select m.type_mission from public.missions m where m.id = v_occ.mission_id);

  -- 3b) Salarie de la mission, puis SON contrat actif (fail-loud si 0 ou >1).
  v_salarie := (select m.salarie_id from public.missions m where m.id = v_occ.mission_id);

  select count(*) into v_nb_contrat
  from public.contrats_salaries c
  where c.personne_id = v_salarie and c.actif = true;

  if v_nb_contrat = 0 then
    raise exception 'sync_releve_depuis_occurrence: aucun contrat actif pour le salarie %', v_salarie
      using errcode = 'no_data_found';
  elsif v_nb_contrat > 1 then
    raise exception 'sync_releve_depuis_occurrence: % contrats actifs pour le salarie % (ambigu)', v_nb_contrat, v_salarie
      using errcode = 'cardinality_violation';
  end if;

  v_contrat := (
    select c.id from public.contrats_salaries c
    where c.personne_id = v_salarie and c.actif = true
  );

  -- 3c) Duree : reel (heures_reelles) puis repli duree_min/60. Fail-loud si les deux NULL.
  v_heures := coalesce(v_occ.heures_reelles, (v_occ.duree_min::numeric / 60.0));
  if v_heures is null then
    raise exception 'sync_releve_depuis_occurrence: occurrence % realisee sans duree (heures_reelles et duree_min NULL)', p_mission_seance_id
      using errcode = 'not_null_violation';
  end if;

  -- 3d) Mapping type_mission (10 types D5, valeurs actuelles + futures) -> categorie releve (6).
  v_categorie := case v_type
    when 'intervention_scolaire'  then 'seance'
    when 'entrainement_section'   then 'seance'
    when 'entrainement_sr_m'      then 'seance'
    when 'autre_entrainement_mom' then 'seance'
    when 'accompagnement_terrain' then 'seance'
    when 'stage'                  then 'seance'
    when 'reunion'                then 'reunion'
    when 'travail_personnel'      then 'formation'
    when 'suivi_competition'      then 'deplacement'
    when 'divers'                 then 'autre'
    else 'autre'
  end;

  -- 3e) Tracabilite douce : personne_id du connecte (repli NULL, colonne nullable).
  v_cree_par := (select q.personne_id from public.qui_suis_je() q);

  -- 3f) UPSERT idempotent sur la cle mission_seance_id (index unique partiel sql_115).
  insert into public.releve_heures_salarie
    (contrat_id, date_jour, heures, heure_debut, categorie, mission_id, mission_seance_id, cree_par)
  values
    (v_contrat, v_occ.date_seance, v_heures, v_occ.heure_debut, v_categorie,
     v_occ.mission_id, p_mission_seance_id, v_cree_par)
  on conflict (mission_seance_id) where (mission_seance_id is not null)
  do update set
    contrat_id  = excluded.contrat_id,
    date_jour   = excluded.date_jour,
    heures      = excluded.heures,
    heure_debut = excluded.heure_debut,
    categorie   = excluded.categorie,
    mission_id  = excluded.mission_id,
    updated_at  = now()
  returning id into v_releve_id;

  out_action            := 'upsert';
  out_releve_id         := v_releve_id;
  out_mission_seance_id := p_mission_seance_id;
  out_etat_occurrence   := v_occ.etat;
  out_heures            := v_heures;
  out_categorie         := v_categorie;
  return next;
  return;
end
$fn$;

-- Droits : ferme a PUBLIC et anon (leçon pt 109), ouvre a authenticated.
revoke all on function public.sync_releve_depuis_occurrence(uuid) from public;
revoke all on function public.sync_releve_depuis_occurrence(uuid) from anon;
grant execute on function public.sync_releve_depuis_occurrence(uuid) to authenticated;

-- Garde-fou fail-loud : la fonction existe, est SECURITY DEFINER, fermee a anon.
do $verif$
declare
  v_exists   boolean;
  v_secdef   boolean;
  v_anon     boolean;
begin
  select (p.oid is not null), p.prosecdef
    into v_exists, v_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'sync_releve_depuis_occurrence';

  if v_exists is not true then
    raise exception 'sql_116 ECHEC : fonction sync_releve_depuis_occurrence absente';
  end if;
  if v_secdef is not true then
    raise exception 'sql_116 ECHEC : fonction non SECURITY DEFINER';
  end if;

  v_anon := exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'sync_releve_depuis_occurrence'
      and has_function_privilege('anon', p.oid, 'execute')
  );
  if v_anon then
    raise exception 'sql_116 ECHEC : anon peut EXECUTE (REVOKE incomplet)';
  end if;

  raise notice 'OK sql_116 : sync_releve_depuis_occurrence en place (SECURITY DEFINER, anon ferme).';
end
$verif$;

commit;
