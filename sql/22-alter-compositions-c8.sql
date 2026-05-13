-- =====================================================================
-- sql/22-alter-compositions-c8.sql
-- =====================================================================
-- Dette C8 (post-Audit-Module-Compositions-v3, 14 mai 2026 soir) :
-- 2 ALTER additifs sur la table `compositions` pour aligner avec le
-- workflow réel de Manu et la doctrine v3.
--
--   C8-a · type_compo TEXT NOT NULL DEFAULT 'match'
--          CHECK IN ('base', 'match')
--          → distingue compo de base (plan A J-7) vs compo de match (J-0)
--
--   C8-b · compo_base_origine_id UUID NULL
--          REFERENCES compositions(id) (auto-référence)
--          → trace la dérivation compo de match ← compo de base
--          → permet Vue Comparaison + pré-remplissage UI Phase 4.4
--
-- Référence : `Audit-Module-Compositions-v3.md` §8 (Drive fileId
-- 1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ).
--
-- Préalables :
--   - sql/18-compositions.sql (tables compositions + composition_joueurs)
--
-- Impact existant : 0 (table compositions encore vide au 14 mai soir).
-- Pattern : identique à sql/15 (ALTER CHECK personnes_type_personne_check).
--
-- Auteur : conv Production · 14 mai 2026 soir
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- C8-a · ADD COLUMN type_compo
-- ---------------------------------------------------------------------

ALTER TABLE compositions
  ADD COLUMN type_compo TEXT NOT NULL DEFAULT 'match';

ALTER TABLE compositions
  ADD CONSTRAINT compositions_type_compo_check
  CHECK (type_compo IN ('base', 'match'));

-- ---------------------------------------------------------------------
-- C8-b · ADD COLUMN compo_base_origine_id (auto-référence)
-- ---------------------------------------------------------------------

ALTER TABLE compositions
  ADD COLUMN compo_base_origine_id UUID NULL
  REFERENCES compositions(id);

-- Cohérence métier : si compo_base_origine_id renseigné, type_compo
-- doit être 'match' (seules les compos de match peuvent dériver d'une
-- compo de base). Une compo de base ne peut pas avoir une origine.
ALTER TABLE compositions
  ADD CONSTRAINT compositions_origine_only_for_match_check
  CHECK (
    compo_base_origine_id IS NULL
    OR type_compo = 'match'
  );

-- Index pour requêter "toutes les compos de match dérivées de la base X"
CREATE INDEX idx_compositions_origine
  ON compositions (compo_base_origine_id)
  WHERE compo_base_origine_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Vérification structurelle
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_nb_columns       INTEGER;
  v_nb_checks_explicit INTEGER;
  v_nb_indexes       INTEGER;
  v_default_type     TEXT;
BEGIN
  -- Colonnes attendues sur compositions : 11 (initial) + 2 (C8) = 13
  SELECT COUNT(*) INTO v_nb_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'compositions';

  -- CHECK explicites attendus : 3 (cote/etat/version) + 2 (type_compo/origine) = 5
  SELECT COUNT(*) INTO v_nb_checks_explicit
  FROM pg_constraint c
  JOIN pg_class      t ON c.conrelid = t.oid
  JOIN pg_namespace  n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'compositions'
    AND c.contype = 'c';

  -- Indexes attendus : 4 (initial) + 1 (idx_compositions_origine) = 5
  SELECT COUNT(*) INTO v_nb_indexes
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'compositions';

  -- Vérifier la valeur DEFAULT de type_compo
  SELECT column_default INTO v_default_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'compositions'
    AND column_name  = 'type_compo';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Colonnes compositions ..... : % (attendu 13)', v_nb_columns;
  RAISE NOTICE '✅ CHECK explicites .......... : % (attendu 5)',  v_nb_checks_explicit;
  RAISE NOTICE '✅ Indexes ................... : % (attendu 5)',  v_nb_indexes;
  RAISE NOTICE '✅ DEFAULT type_compo ........ : % (attendu ''match''::text)', v_default_type;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   ALTER TABLE compositions DROP CONSTRAINT IF EXISTS
--     compositions_origine_only_for_match_check;
--   DROP INDEX IF EXISTS idx_compositions_origine;
--   ALTER TABLE compositions DROP COLUMN IF EXISTS compo_base_origine_id;
--   ALTER TABLE compositions DROP CONSTRAINT IF EXISTS
--     compositions_type_compo_check;
--   ALTER TABLE compositions DROP COLUMN IF EXISTS type_compo;
-- =====================================================================
