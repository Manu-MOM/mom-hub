-- =====================================================================
-- sql/27-alter-compositions-etat-c8d.sql
-- =====================================================================
-- Dette C8-d (post-Audit-Module-Compositions-v3, 14 mai 2026 soir).
-- Option A retenue : renommage `jouee` → `utilisee` + ajout `archivee`.
--
-- Avant : etat IN ('brouillon', 'validee', 'jouee')
-- Après : etat IN ('brouillon', 'validee', 'utilisee', 'archivee')
--
-- Justifications :
--   - 'utilisee' est plus juste métier que 'jouee' : une compo
--     d'entraînement ou de stage n'est pas "jouée" mais "utilisée".
--     Le terme couvre matchs ET entraînements/stages/EDR.
--   - 'archivee' permet de sortir une compo du flux actif tout en
--     conservant la traçabilité (cf. doctrine versioning Phase 4.3).
--   - Table compositions vide au 13 mai après-midi (vérifié), donc
--     l'UPDATE est un no-op (0 ligne à migrer). Risque nul.
--
-- Référence : `message-prod-C8.md` C8-d Option A (conv Audits).
--
-- Préalables :
--   - sql/18-compositions.sql (CHECK initial)
--   - sql/22-alter-compositions-c8.sql (autres CHECK C8-a/b ajoutés)
--
-- Auteur : conv Production · 13 mai 2026 après-midi
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Pre-check : confirme que la table est vide (sinon migration à
--     surveiller). Affiche un NOTICE avec les comptes par etat.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_total      INTEGER;
  v_brouillon  INTEGER;
  v_validee    INTEGER;
  v_jouee      INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE etat = 'brouillon'),
    COUNT(*) FILTER (WHERE etat = 'validee'),
    COUNT(*) FILTER (WHERE etat = 'jouee')
  INTO
    v_total, v_brouillon, v_validee, v_jouee
  FROM compositions;

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'État compositions avant migration :';
  RAISE NOTICE '  total ....... : %', v_total;
  RAISE NOTICE '  brouillon ... : %', v_brouillon;
  RAISE NOTICE '  validee ..... : %', v_validee;
  RAISE NOTICE '  jouee ....... : % (sera renommée en utilisee)', v_jouee;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

-- ---------------------------------------------------------------------
-- 2 · DROP du CHECK existant
-- ---------------------------------------------------------------------

ALTER TABLE compositions
  DROP CONSTRAINT IF EXISTS compositions_etat_check;

-- ---------------------------------------------------------------------
-- 3 · Migration des données existantes (no-op si table vide)
-- ---------------------------------------------------------------------

UPDATE compositions
SET etat = 'utilisee'
WHERE etat = 'jouee';

-- ---------------------------------------------------------------------
-- 4 · Recréation du CHECK avec les 4 valeurs cibles
-- ---------------------------------------------------------------------

ALTER TABLE compositions
  ADD CONSTRAINT compositions_etat_check
  CHECK (etat IN ('brouillon', 'validee', 'utilisee', 'archivee'));

-- ---------------------------------------------------------------------
-- 5 · Post-check : confirme la nouvelle définition + le contenu
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_definition  TEXT;
  v_nb_lignes   INTEGER;
  v_residu_jouee INTEGER;
BEGIN
  -- Récupérer la définition de la contrainte recréée
  SELECT pg_get_constraintdef(c.oid) INTO v_definition
  FROM pg_constraint c
  JOIN pg_class      t ON c.conrelid = t.oid
  JOIN pg_namespace  n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'compositions'
    AND c.conname = 'compositions_etat_check';

  SELECT COUNT(*) INTO v_nb_lignes   FROM compositions;
  SELECT COUNT(*) INTO v_residu_jouee FROM compositions WHERE etat = 'jouee';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Contrainte recréée :';
  RAISE NOTICE '   %', v_definition;
  RAISE NOTICE '✅ Lignes en base ........... : %', v_nb_lignes;
  RAISE NOTICE '✅ Résidu etat=jouee ........ : % (attendu 0)', v_residu_jouee;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   ALTER TABLE compositions DROP CONSTRAINT IF EXISTS compositions_etat_check;
--   UPDATE compositions SET etat = 'jouee' WHERE etat = 'utilisee';
--   ALTER TABLE compositions
--     ADD CONSTRAINT compositions_etat_check
--     CHECK (etat IN ('brouillon', 'validee', 'jouee'));
--
-- ⚠️  Le rollback ne supprime pas la valeur 'archivee' des lignes
-- éventuellement créées entre temps avec ce nouvel état. À vérifier
-- avant rollback :
--   SELECT COUNT(*) FROM compositions WHERE etat = 'archivee';
-- =====================================================================
