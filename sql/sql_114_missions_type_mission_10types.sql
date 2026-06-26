-- =====================================================================
-- sql_114_missions_type_mission_10types.sql
-- Chantier : MISSION-TO-COUNTER (D5 — typologie verrouillee a 10 types)
-- Objet    : aligner le CHECK missions.type_mission sur les 10 types
--            metier du memo Manu (26/06), jetons snake_case definitifs.
-- Methode  : bac a sable (1 ligne de test) -> UPDATE de la ligne de test
--            (intervention_ecole -> intervention_scolaire) PUIS resserrage
--            du CHECK aux 10 nouveaux jetons. Non destructif (1 ligne migree).
-- Sonde    : S5 (CHECK actuel = 6 valeurs heritees, a remplacer).
-- =====================================================================

begin;

-- 1) Migrer la seule ligne de test vers le nouveau jeton (bac a sable).
--    intervention_ecole -> intervention_scolaire. Idempotent (IS DISTINCT FROM).
update public.missions
set type_mission = 'intervention_scolaire'
where type_mission = 'intervention_ecole';

-- 2) Filet anti-resserrage : refuser de continuer s'il reste une valeur
--    hors des 10 nouveaux jetons (sinon le CHECK echouerait a la creation).
do $guard$
declare
  v_orphelins int;
begin
  select count(*) into v_orphelins
  from public.missions
  where type_mission not in (
    'intervention_scolaire', 'entrainement_section', 'entrainement_sr_m',
    'autre_entrainement_mom', 'reunion', 'suivi_competition',
    'accompagnement_terrain', 'travail_personnel', 'stage', 'divers'
  );
  if v_orphelins > 0 then
    raise exception 'sql_114 ABORT : % ligne(s) missions hors des 10 jetons cibles (migration incomplete)', v_orphelins;
  end if;
end
$guard$;

-- 3) Remplacer le CHECK (DROP ancien + ADD nouveau aux 10 jetons).
alter table public.missions
  drop constraint if exists missions_type_mission_check;

alter table public.missions
  add constraint missions_type_mission_check
  check (type_mission = any (array[
    'intervention_scolaire'::text,
    'entrainement_section'::text,
    'entrainement_sr_m'::text,
    'autre_entrainement_mom'::text,
    'reunion'::text,
    'suivi_competition'::text,
    'accompagnement_terrain'::text,
    'travail_personnel'::text,
    'stage'::text,
    'divers'::text
  ]));

-- 4) Garde-fou fail-loud : le CHECK existe et porte bien les 10 jetons.
do $verif$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.missions'::regclass
    and conname  = 'missions_type_mission_check';

  if v_def is null then
    raise exception 'sql_114 ECHEC : CHECK missions_type_mission_check absent';
  end if;
  if v_def not ilike '%intervention_scolaire%'
     or v_def not ilike '%entrainement_sr_m%'
     or v_def not ilike '%autre_entrainement_mom%'
     or v_def not ilike '%divers%' then
    raise exception 'sql_114 ECHEC : CHECK ne porte pas les jetons attendus (def=%)', v_def;
  end if;

  raise notice 'OK sql_114 : missions.type_mission resserre aux 10 jetons metier.';
end
$verif$;

commit;
