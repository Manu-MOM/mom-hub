-- =====================================================================
-- sql/17b-fix-categorie-partenaires.sql
-- =====================================================================
-- Correctif post-sql/16 : les 39 joueurs partenaires importés via
-- sql/16-peuplement-partenaires-entente-m14-v1.sql ont été créés avec
-- categorie_id = NULL (l'export SportEasy ne contenait pas la catégorie
-- d'âge). Conséquence : invisibles dans la RPC get_vivier_compo qui
-- filtre par categorie_id.
--
-- Découvert le 14 mai 2026 lors du smoke test de sql/21-rpc-vivier-compo.
-- Inscrit comme dette implicite de sql/16, résolue ici.
--
-- Fix : UPDATE categorie_id = M14 sur les 39 joueurs (les 11 coaches/staff
-- restent à categorie_id = NULL, c'est cohérent métier : un encadrant
-- n'a pas de catégorie d'âge propre).
--
-- Idempotent : la clause `categorie_id IS NULL` empêche les UPDATE
-- inutiles si le script est rejoué.
--
-- Auteur : conv Production · 14 mai 2026
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_categorie_m14_id UUID;
  v_nb_avant         INTEGER;
  v_nb_total_m14     INTEGER;
BEGIN
  -- Catégorie cible
  SELECT id INTO v_categorie_m14_id
  FROM categories
  WHERE code = 'M14'
  LIMIT 1;

  IF v_categorie_m14_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie M14 introuvable (categories.code).';
  END IF;

  -- Joueurs partenaires à patcher
  SELECT COUNT(*) INTO v_nb_avant
  FROM personnes
  WHERE source_creation    = 'sporteasy_sar_minimes_2025-2026_v1'
    AND categorie_personne = 'joueur'
    AND categorie_id IS NULL;

  RAISE NOTICE 'Catégorie M14 .............. : %', v_categorie_m14_id;
  RAISE NOTICE 'Joueurs partenaires à fixer  : % (attendu 39)', v_nb_avant;
END $$;

-- ---------------------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------------------

UPDATE personnes
SET categorie_id = (SELECT id FROM categories WHERE code = 'M14' LIMIT 1)
WHERE source_creation    = 'sporteasy_sar_minimes_2025-2026_v1'
  AND categorie_personne = 'joueur'
  AND categorie_id IS NULL;

-- ---------------------------------------------------------------------
-- Vérification post-UPDATE
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_nb_partenaires_m14 INTEGER;
  v_nb_total_m14       INTEGER;
  v_nb_residuel_null   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nb_partenaires_m14
  FROM personnes p
  JOIN categories c ON p.categorie_id = c.id
  WHERE p.source_creation    = 'sporteasy_sar_minimes_2025-2026_v1'
    AND p.categorie_personne = 'joueur'
    AND c.code               = 'M14';

  SELECT COUNT(*) INTO v_nb_total_m14
  FROM personnes p
  JOIN categories c ON p.categorie_id = c.id
  WHERE p.categorie_personne = 'joueur'
    AND c.code               = 'M14';

  SELECT COUNT(*) INTO v_nb_residuel_null
  FROM personnes
  WHERE source_creation    = 'sporteasy_sar_minimes_2025-2026_v1'
    AND categorie_personne = 'joueur'
    AND categorie_id IS NULL;

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Partenaires M14 ......... : % (attendu 39)', v_nb_partenaires_m14;
  RAISE NOTICE '✅ Total joueurs M14 ....... : % (attendu ≥ 24 MOM + 39 = 63)', v_nb_total_m14;
  RAISE NOTICE '✅ Résiduel categorie_id NULL : % (attendu 0)', v_nb_residuel_null;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   UPDATE personnes
--   SET categorie_id = NULL
--   WHERE source_creation    = 'sporteasy_sar_minimes_2025-2026_v1'
--     AND categorie_personne = 'joueur';
-- =====================================================================

-- Post-fix : relancer le smoke test de sql/21 doit donner :
--   total       ≥ 63   (24 MOM + 39 partenaires)
--   reguliers   = 62   (23 MOM + 39 partenaires attachés)
--   partenaires = 39
--   f15         ≥ 6
--   non_attaches = 1+  (les MOM dans personnes pas dans equipe_joueurs)
