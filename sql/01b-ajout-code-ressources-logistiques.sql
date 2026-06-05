-- =====================================================================
-- MOM Hub · Module Logistique · Correctif 01b
-- ---------------------------------------------------------------------
-- Ajoute une cle metier stable `code` (text UNIQUE) a
-- ressources_logistiques, alignee sur la convention `sites.code`.
-- But : idempotence propre de l'amorçage (ON CONFLICT (code)) et
-- identification stable d'une ressource independamment de son libelle.
--
-- ADDITIF — ne touche aucune donnee existante. Idempotent (re-executable).
-- =====================================================================

BEGIN;

-- 1. Colonne code (nullable a l'ajout : aucune ligne existante a ce stade,
--    mais on reste tolerant si la table contenait deja des lignes).
ALTER TABLE public.ressources_logistiques
  ADD COLUMN IF NOT EXISTS code text;

-- 2. Contrainte d'unicite (idempotente via garde sur pg_constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ressources_logistiques_code_key'
      AND conrelid = 'public.ressources_logistiques'::regclass
  ) THEN
    ALTER TABLE public.ressources_logistiques
      ADD CONSTRAINT ressources_logistiques_code_key UNIQUE (code);
  END IF;
END $$;

-- 3. Garde fail-loud : colonne + contrainte presentes apres execution.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ressources_logistiques'
      AND column_name = 'code'
  ) THEN
    RAISE EXCEPTION 'colonne code absente apres ALTER — rollback';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ressources_logistiques_code_key'
      AND conrelid = 'public.ressources_logistiques'::regclass
  ) THEN
    RAISE EXCEPTION 'contrainte UNIQUE sur code absente — rollback';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Fin. La cle `code` est prete. L'amorçage (fichier 02) renseignera :
--   site-mom-brenckle / site-mom-holtzplatz / site-mom-clubhouse
--   (miroir des codes `sites`, type='site')
--   minibus-1 / minibus-2 / veo (type='materiel')
-- NB : code reste nullable en schema (P1, champ optionnel) — l'unicite
--      ne s'applique qu'aux valeurs non NULL (comportement UNIQUE Postgres).
-- =====================================================================
