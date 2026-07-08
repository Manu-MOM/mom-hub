-- =====================================================================
-- sql_174 — EVT-RECURRENCE-OCCURRENCES — Étape 1/4 : colonne dates_exclues
-- =====================================================================
-- Tableau des dates d'occurrences supprimées d'une série (porté par la mère).
-- La régénération saute ces dates. Défaut {} (aucune exclusion).
--
-- Réversibilité : ALTER TABLE public.evenements DROP COLUMN IF EXISTS dates_exclues;
-- Exécuté et vérifié.
-- =====================================================================
do $verif$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='evenements' and column_name='dates_exclues') then
    raise exception 'ABORT sql_174 : dates_exclues existe déjà';
  end if;
end $verif$;

alter table public.evenements
  add column dates_exclues date[] not null default '{}';

comment on column public.evenements.dates_exclues is
  'EVT-RECURRENCE-OCCURRENCES : dates d''occurrences supprimées d''une série récurrente (portées par l''événement mère). La régénération saute ces dates.';

do $check$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='evenements'
                   and column_name='dates_exclues' and data_type='ARRAY') then
    raise exception 'ABORT sql_174 : colonne dates_exclues absente après ALTER';
  end if;
  raise notice 'sql_174 OK : evenements.dates_exclues créée (date[] default {}).';
end $check$;
