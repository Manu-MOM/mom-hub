-- =====================================================================
-- sql_135_sortie_perimetre_partenaires_sar_m14.sql
-- =====================================================================
-- OBJET
--   Sortir de l'effectif M14 AFFICHÉ les fiches partenaires SAR/ASCS de
--   la saison 2025/2026, avant la recette éducateurs de l'été, SANS rien
--   détruire.
--
-- FAIT ÉTABLI (sondes DS-1, session pt 134) :
--   - 46 fiches `personnes` avec source_creation =
--     'sporteasy_sar_minimes_2025-2026_v1'.
--   - 39 d'entre elles portent categorie_id = M14 (312ebb88…) → elles
--     alimentent l'effectif M14 via la RPC get_joueurs_categorie
--     (sql_112), dont le filtre est `WHERE p.categorie_id = p_categorie_id`.
--   - 7 fiches ont déjà categorie_id NULL → hors périmètre, non touchées.
--   - Historique intouchable : 150 lignes composition_joueurs référencent
--     ces partenaires (feuilles de match de la saison). AUCUNE suppression
--     de fiche → l'historique est intégralement préservé.
--
-- GESTE
--   UPDATE personnes SET categorie_id = NULL sur les 39 fiches M14.
--   La RPC filtrant par égalité stricte, une fiche NULL ne matche plus
--   aucune catégorie → disparaît de l'effectif affiché.
--
-- RÉVERSIBILITÉ / RENTRÉE
--   Réversible (aucune fiche ni attache supprimée). À la rentrée, le
--   réimport Sporteasy 2026/2027 en table rase réaffectera la catégorie.
--   On n'ouvre PAS le chantier « cycle de vie partenaire » (Sujet 2).
--
-- HORS PÉRIMÈTRE (volontairement NON touché)
--   - equipe_joueurs (39 attaches) : n'intervient pas dans le filtre de
--     périmètre de get_joueurs_categorie (seulement sous-EXISTS d'enrichi-
--     ssement). Laissées en place.
--   - collectif_membre (42 attaches) : idem, non lues par l'effectif.
--   - composition_joueurs (150 lignes) : HISTORIQUE, jamais touché.
--   - Les 7 fiches déjà à categorie_id NULL.
--
-- IDEMPOTENT : OUI (rejouable — le WHERE ne cible que les fiches encore
--   sur M14 ; un second passage trouve 0 ligne et le verif tolère 0).
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;

-- Capture du compte avant (pour trace)
DO $verif$
DECLARE
  v_cible_m14   integer;
BEGIN
  v_cible_m14 := (
    SELECT count(*)
    FROM personnes
    WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
      AND categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
  );
  RAISE NOTICE 'sql_135 : % fiche(s) partenaire SAR encore sur M14 avant UPDATE.', v_cible_m14;
END
$verif$;

-- Geste : sortie de périmètre
UPDATE personnes
SET categorie_id = NULL,
    updated_at   = now()
WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
  AND categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e';

-- =====================================================================
-- Vérifications fail-loud
-- =====================================================================
DO $verif$
DECLARE
  v_reste_m14   integer;
  v_fiches_tot  integer;
  v_compos      integer;
BEGIN
  -- (1) Plus aucune fiche partenaire SAR sur M14
  v_reste_m14 := (
    SELECT count(*)
    FROM personnes
    WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
      AND categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
  );
  IF v_reste_m14 <> 0 THEN
    RAISE EXCEPTION 'sql_135 ÉCHEC : % fiche(s) partenaire SAR encore sur M14 (attendu 0).', v_reste_m14;
  END IF;

  -- (2) Les 46 fiches partenaires existent TOUJOURS (aucune suppression)
  v_fiches_tot := (
    SELECT count(*)
    FROM personnes
    WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
  );
  IF v_fiches_tot <> 46 THEN
    RAISE EXCEPTION 'sql_135 ÉCHEC : % fiche(s) partenaire (attendu 46 — aucune ne doit disparaître).', v_fiches_tot;
  END IF;

  -- (3) L'historique compos est intact (150 lignes préservées)
  v_compos := (
    SELECT count(*)
    FROM composition_joueurs cj
    JOIN personnes p ON p.id = cj.joueur_id
    WHERE p.source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
  );
  IF v_compos <> 150 THEN
    RAISE EXCEPTION 'sql_135 ÉCHEC : historique compos = % (attendu 150 — préservation).', v_compos;
  END IF;

  RAISE NOTICE 'sql_135 OK : 0 partenaire SAR sur M14, 46 fiches préservées, 150 compos intactes.';
END
$verif$;

COMMIT;

-- =====================================================================
-- CONTRÔLE POST-COMMIT (lecture seule — coller après le Run si souhaité)
-- =====================================================================
-- Répartition categorie_id après geste : attendu 46 lignes toutes NULL
-- SELECT p.categorie_id, count(*) AS nb
-- FROM personnes p
-- WHERE p.source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
-- GROUP BY p.categorie_id;
-- =====================================================================
