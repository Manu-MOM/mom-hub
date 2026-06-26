-- =====================================================================
-- sql_118_missions_entite_id_nullable.sql
-- Chantier : MISSION-TO-COUNTER (D5 — frontiere interne/externe)
-- Objet    : rendre missions.entite_id NULLABLE pour permettre les
--            missions INTERNES sans entite (entrainements, reunion,
--            travail personnel, stage, divers). Les missions EXTERNES
--            (intervention scolaire, suivi competition) gardent une entite,
--            exigee cote front (defaut ajustable D5), pas par le schema.
-- Methode  : ALTER ... DROP NOT NULL — non destructif (on relache une
--            contrainte). La FK entite_id -> entites(id) reste INTACTE :
--            une entite fournie doit toujours etre valide, mais peut etre NULL.
-- Sonde    : S8a (entite_id NOT NULL) / S8b (FK entite_id -> entites(id)).
-- =====================================================================

begin;

-- 1) Relacher la contrainte NOT NULL (idempotent : DROP NOT NULL est sans
--    effet si la colonne est deja nullable).
alter table public.missions
  alter column entite_id drop not null;

-- 2) Garde-fou fail-loud : la colonne est bien nullable ET la FK subsiste.
do $verif$
declare
  v_nullable boolean;
  v_fk       boolean;
begin
  select (c.is_nullable = 'YES') into v_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name   = 'missions'
    and c.column_name  = 'entite_id';

  if v_nullable is not true then
    raise exception 'sql_118 ECHEC : missions.entite_id toujours NOT NULL';
  end if;

  v_fk := exists (
    select 1 from pg_constraint
    where conrelid = 'public.missions'::regclass
      and conname  = 'missions_entite_id_fkey'
  );
  if not v_fk then
    raise exception 'sql_118 ECHEC : FK missions_entite_id_fkey disparue (ne devait pas etre touchee)';
  end if;

  raise notice 'OK sql_118 : missions.entite_id nullable, FK entites intacte.';
end
$verif$;

commit;
