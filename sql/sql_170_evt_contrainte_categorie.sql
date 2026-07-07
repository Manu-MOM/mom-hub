-- =====================================================================
-- sql_170 — EVT-RATTACHEMENT-CATEGORIE — Étape 4/7 : contrainte
-- =====================================================================
-- Remplace « equipe obligatoire si pas parent » par « catégorie obligatoire
-- pour entrainement/stage ». equipe_id devient FACULTATIF (utile compét).
--
-- Réversibilité :
--   ALTER TABLE public.evenements
--     DROP CONSTRAINT IF EXISTS evenements_categorie_obligatoire_si_pas_parent;
--   ALTER TABLE public.evenements
--     ADD CONSTRAINT evenements_equipe_obligatoire_si_pas_parent
--     CHECK ( (type_evenement = ANY (ARRAY['entrainement','stage'])
--              AND equipe_id IS NOT NULL) OR type_evenement = 'competition' );
--
-- Exécuté et vérifié : nouvelle contrainte posée, ancienne retirée.
-- =====================================================================

do $verif$
declare v int;
begin
  select count(*) into v from public.evenements
  where type_evenement in ('entrainement','stage') and categorie_id is null;
  if v > 0 then
    raise exception 'ABORT sql_170 : % entrainement/stage sans categorie_id', v;
  end if;
end
$verif$;

alter table public.evenements
  drop constraint if exists evenements_equipe_obligatoire_si_pas_parent;

alter table public.evenements
  add constraint evenements_categorie_obligatoire_si_pas_parent
  check (
    (type_evenement = any (array['entrainement','stage']) and categorie_id is not null)
    or type_evenement = 'competition'
  );

do $check$
begin
  if not exists (select 1 from pg_constraint
                 where conname='evenements_categorie_obligatoire_si_pas_parent') then
    raise exception 'ABORT sql_170 : nouvelle contrainte absente';
  end if;
  if exists (select 1 from pg_constraint
             where conname='evenements_equipe_obligatoire_si_pas_parent') then
    raise exception 'ABORT sql_170 : ancienne contrainte toujours présente';
  end if;
  raise notice 'sql_170 OK : contrainte catégorie posée, équipe retirée.';
end
$check$;
