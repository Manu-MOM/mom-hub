-- ============================================================================
-- sql_236_planification_jours_toute_semaine.sql
-- ----------------------------------------------------------------------------
-- Chantier  : PLANIF-SOUSBLOCS-PAR-JOUR (suite recette terrain)
-- Objet     : permettre un jour « Toute la semaine » (objectif non differencie
--             par jour). Encode par la valeur sentinelle jour=0, en plus de
--             1=lundi … 7=dimanche. Le CHECK passe de (1..7) a (0..7).
--
-- Usage     : un bloc « non differencie » se saisit avec un seul jour a 0.
--             Melange autorise (souple) : un bloc peut porter a la fois un jour
--             0 (theme global) et des jours specifiques — aucune garde.
--             Le tri (jour, created_at) place naturellement 0 en tete.
--
-- Additif   : remplace UNE contrainte CHECK (drop + add), 0 donnee touchee,
--             0 autre objet modifie. Les valeurs 1..7 existantes restent
--             valides (0..7 est un sur-ensemble). Fail-loud en fin de fichier.
-- ============================================================================

alter table public.planification_jours
  drop constraint if exists planification_jours_jour_chk;

alter table public.planification_jours
  add constraint planification_jours_jour_chk check (jour between 0 and 7);

-- ─────────────────────────────────────────────────────────────────────────
-- Verification fail-loud.
-- ─────────────────────────────────────────────────────────────────────────
do $verif$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint where conname = 'planification_jours_jour_chk';

  if v_def is null then
    raise exception 'ABORT: contrainte planification_jours_jour_chk absente.';
  end if;

  -- La definition doit borner a 0..7 (accepte 0, rejette hors bornes).
  if position('0' in v_def) = 0 or position('7' in v_def) = 0 then
    raise exception 'ABORT: CHECK jour inattendu (%).', v_def;
  end if;

  raise notice 'OK: CHECK jour = % (0 = toute la semaine).', v_def;
end
$verif$;
