-- ============================================================================
-- sql_235_planification_jours_commentaire_et_migration.sql
-- ----------------------------------------------------------------------------
-- Chantier  : PLANIF-SOUSBLOCS-PAR-JOUR (suite recette terrain)
-- Objet     : deux evolutions liees au retour recette :
--             (1) COMMENTAIRE par jour : colonne additive commentaire text sur
--                 planification_jours (un commentaire libre par jour, comme le
--                 bloc en a un).
--             (2) MIGRATION : les axes ne se saisissent plus au niveau du bloc
--                 (doublon avec les jours). On bascule donc les axes des blocs
--                 EXISTANTS vers un premier jour (jour=1 lundi, titre vide),
--                 pour ne perdre aucune donnee avant que le front retire la
--                 saisie des axes du bloc.
--
-- Portee    : au moment de l'ecriture, 14 blocs portent des axes, 0 n'a de jour
--             (sonde du 27/07/2026). La migration cree donc 1 jour par bloc
--             concerne. Idempotente : ne recree pas de jour pour un bloc qui en
--             a deja un (garde NOT EXISTS).
--
-- Note      : les colonnes axe_* de planification_blocs sont CONSERVEES (aucun
--             DROP) — la migration COPIE, elle ne detruit pas. Le retrait de la
--             saisie des axes du bloc est purement FRONT. Les axes du bloc
--             restent en base (rollback possible), simplement plus edites ni
--             affiches une fois les jours en place.
--
-- Additif   : 1 colonne + N inserts de donnees. 0 objet existant modifie.
--             Idempotent. Fail-loud en fin de fichier.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Colonne commentaire (additive, nullable) — commentaire libre par jour.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.planification_jours
  add column if not exists commentaire text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Migration des axes bloc -> premier jour (jour=1 lundi, titre vide).
--    Un jour est cree UNIQUEMENT pour les blocs qui portent au moins un axe
--    ET qui n'ont encore aucun jour (garde NOT EXISTS => idempotent + ne
--    touche pas les blocs deja declines par jour a la main).
-- ─────────────────────────────────────────────────────────────────────────
insert into public.planification_jours
  (bloc_id, jour, titre, axe_indiv, axe_collectif, axe_physique, axe_poste)
select
  b.id,
  1,                                   -- lundi (choix de migration neutre)
  '',                                  -- titre vide (rectifiable par l'educateur)
  coalesce(b.axe_indiv, '{}'::text[]),
  b.axe_collectif,
  b.axe_physique,
  b.axe_poste
from public.planification_blocs b
where (
        (b.axe_indiv is not null and array_length(b.axe_indiv, 1) > 0)
        or coalesce(b.axe_collectif, '') <> ''
        or coalesce(b.axe_physique, '')  <> ''
        or coalesce(b.axe_poste, '')     <> ''
      )
  and not exists (
        select 1 from public.planification_jours j where j.bloc_id = b.id
      );

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Verification fail-loud.
-- ─────────────────────────────────────────────────────────────────────────
do $verif$
declare
  v_blocs_axes    int;
  v_blocs_sans_jr int;
begin
  -- Colonne commentaire presente.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planification_jours'
      and column_name = 'commentaire'
  ) then
    raise exception 'ABORT: colonne commentaire absente de planification_jours.';
  end if;

  -- Plus aucun bloc « avec axes » ne doit rester sans jour (migration complete).
  select count(*) into v_blocs_sans_jr
  from public.planification_blocs b
  where (
          (b.axe_indiv is not null and array_length(b.axe_indiv, 1) > 0)
          or coalesce(b.axe_collectif, '') <> ''
          or coalesce(b.axe_physique, '')  <> ''
          or coalesce(b.axe_poste, '')     <> ''
        )
    and not exists (
          select 1 from public.planification_jours j where j.bloc_id = b.id
        );

  if v_blocs_sans_jr <> 0 then
    raise exception 'ABORT: % bloc(s) avec axes encore sans jour apres migration.', v_blocs_sans_jr;
  end if;

  select count(*) into v_blocs_axes
  from public.planification_blocs b
  where (b.axe_indiv is not null and array_length(b.axe_indiv, 1) > 0)
     or coalesce(b.axe_collectif, '') <> ''
     or coalesce(b.axe_physique, '')  <> ''
     or coalesce(b.axe_poste, '')     <> '';

  raise notice 'OK: colonne commentaire en place ; % bloc(s) avec axes, tous rattaches a >= 1 jour.', v_blocs_axes;
end
$verif$;
