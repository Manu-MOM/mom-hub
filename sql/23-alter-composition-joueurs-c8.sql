-- =====================================================================
-- sql/23-alter-composition-joueurs-c8.sql
-- =====================================================================
-- Dette C8-c (post-Audit-Module-Compositions-v3, 14 mai 2026 soir) :
-- ALTER additif sur la table `composition_joueurs` pour matérialiser
-- les 4 états/couleurs de l'éditeur SAR×MOM Compos historique.
--
--   etat_joueur TEXT NOT NULL DEFAULT 'base'
--   CHECK IN ('base', 'modifie', 'independant', 'blesse')
--
--   - 'base'        (bleu)   joueur à sa position de la compo de base
--   - 'modifie'     (orange) joueur dont la position diffère de la base
--   - 'independant' (vert)   joueur ajouté hors de la base
--   - 'blesse'      (rouge)  joueur signalé blessé
--
-- C8-c est aussi le support de l'écriture exceptionnelle Suivi Match :
-- quand le bénévole signale une blessure depuis la table de marque,
-- c'est etat_joueur = 'blesse' qui est écrit.
--
-- Référence : `Audit-Module-Compositions-v3.md` §8 (Drive fileId
-- 1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ).
--
-- Préalables :
--   - sql/18-compositions.sql (table composition_joueurs)
--
-- Impact existant : 0 (table composition_joueurs encore vide au 14 mai
-- soir).
--
-- Auteur : conv Production · 14 mai 2026 soir
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- C8-c · ADD COLUMN etat_joueur
-- ---------------------------------------------------------------------

ALTER TABLE composition_joueurs
  ADD COLUMN etat_joueur TEXT NOT NULL DEFAULT 'base';

ALTER TABLE composition_joueurs
  ADD CONSTRAINT composition_joueurs_etat_joueur_check
  CHECK (etat_joueur IN ('base', 'modifie', 'independant', 'blesse'));

-- Index sur etat_joueur : utile pour filtrer rapidement les blessés
-- (cas le plus fréquent dans les requêtes UI), index partiel pour
-- limiter la taille.
CREATE INDEX idx_composition_joueurs_blesses
  ON composition_joueurs (composition_id)
  WHERE etat_joueur = 'blesse';

-- ---------------------------------------------------------------------
-- Vérification structurelle
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_nb_columns         INTEGER;
  v_nb_checks_explicit INTEGER;
  v_nb_indexes         INTEGER;
  v_default_etat       TEXT;
BEGIN
  -- Colonnes attendues : 11 (initial) + 1 (C8-c) = 12
  SELECT COUNT(*) INTO v_nb_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'composition_joueurs';

  -- CHECK explicites : 1 (role) + 1 (etat_joueur) = 2
  -- (la contrainte composition_joueurs_unique_per_compo est UNIQUE,
  -- elle n'est PAS comptée comme CHECK)
  SELECT COUNT(*) INTO v_nb_checks_explicit
  FROM pg_constraint c
  JOIN pg_class      t ON c.conrelid = t.oid
  JOIN pg_namespace  n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'composition_joueurs'
    AND c.contype = 'c';

  -- Indexes : 5 (initial) + 1 (idx_composition_joueurs_blesses) = 6
  SELECT COUNT(*) INTO v_nb_indexes
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'composition_joueurs';

  -- Vérifier la valeur DEFAULT
  SELECT column_default INTO v_default_etat
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'composition_joueurs'
    AND column_name  = 'etat_joueur';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Colonnes composition_joueurs : % (attendu 12)', v_nb_columns;
  RAISE NOTICE '✅ CHECK explicites ........... : % (attendu 2)',  v_nb_checks_explicit;
  RAISE NOTICE '✅ Indexes .................... : % (attendu 6)',  v_nb_indexes;
  RAISE NOTICE '✅ DEFAULT etat_joueur ........ : % (attendu ''base''::text)', v_default_etat;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   DROP INDEX IF EXISTS idx_composition_joueurs_blesses;
--   ALTER TABLE composition_joueurs DROP CONSTRAINT IF EXISTS
--     composition_joueurs_etat_joueur_check;
--   ALTER TABLE composition_joueurs DROP COLUMN IF EXISTS etat_joueur;
-- =====================================================================
