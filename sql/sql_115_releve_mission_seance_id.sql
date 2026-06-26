-- =====================================================================
-- sql_115_releve_mission_seance_id.sql
-- Chantier : MISSION-TO-COUNTER (D7 — cle d'idempotence occurrence->releve)
-- Objet    : rattacher une ligne de releve_heures_salarie a l'occurrence
--            (mission_seances) qui l'a generee, de facon idempotente.
-- Invariant: le compteur (v_compteur_annualisation / list_compteur_annualisation)
--            n'est PAS modifie (pt 85 intact). Migration additive seule.
-- Sondes    : S1 (schema releve) / S2 (mission_seances.id) / S4 (0 rattachement).
-- =====================================================================

begin;

-- 1) Colonne additive (idempotent)
alter table public.releve_heures_salarie
  add column if not exists mission_seance_id uuid;

-- 2) FK -> mission_seances(id) ON DELETE SET NULL (symetrie avec mission_id)
do $fk$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.releve_heures_salarie'::regclass
      and conname  = 'releve_heures_salarie_mission_seance_id_fkey'
  ) then
    alter table public.releve_heures_salarie
      add constraint releve_heures_salarie_mission_seance_id_fkey
      foreign key (mission_seance_id)
      references public.mission_seances (id)
      on delete set null;
  end if;
end
$fk$;

-- 3) Index UNIQUE PARTIEL : une occurrence = au plus une ligne de releve
create unique index if not exists ux_releve_mission_seance_id
  on public.releve_heures_salarie (mission_seance_id)
  where mission_seance_id is not null;

-- 4) Garde-fou fail-loud : refuse de committer si l'un des 3 objets manque
do $verif$
declare
  v_col boolean;
  v_fk  boolean;
  v_idx boolean;
begin
  v_col := exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'releve_heures_salarie'
      and column_name  = 'mission_seance_id'
  );
  v_fk := exists (
    select 1 from pg_constraint
    where conrelid = 'public.releve_heures_salarie'::regclass
      and conname  = 'releve_heures_salarie_mission_seance_id_fkey'
  );
  v_idx := exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname  = 'ux_releve_mission_seance_id'
  );

  if not v_col then
    raise exception 'sql_115 ECHEC : colonne mission_seance_id absente';
  end if;
  if not v_fk then
    raise exception 'sql_115 ECHEC : FK releve_heures_salarie_mission_seance_id_fkey absente';
  end if;
  if not v_idx then
    raise exception 'sql_115 ECHEC : index unique ux_releve_mission_seance_id absent';
  end if;

  raise notice 'OK sql_115 : mission_seance_id + FK + index unique partiel en place.';
end
$verif$;

commit;
