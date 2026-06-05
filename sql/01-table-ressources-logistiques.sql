-- =====================================================================
-- MOM Hub · Module Logistique · Table 1/4 : ressources_logistiques
-- ---------------------------------------------------------------------
-- Unifie les ressources reservables (lieux + materiel).
-- Les 3 lieux pointent les lignes `sites` existantes (FK nullable).
-- Les minibus / Veo / materiel libre = type='materiel'.
--
-- Doctrine : idempotent, transactionnel, fail-loud (RAISE EXCEPTION
-- avant COMMIT si un invariant n'est pas tenu).
-- RLS : lecture authentifiee ; write reserve has_role('admin')
--       (amorçage / gestion du parc = acte d'administration).
--
-- Conception FAIT FOI : Conception-Module-Logistique-v1.md §4.1
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ressources_logistiques (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type               text        NOT NULL,
  site_id            uuid        REFERENCES public.sites(id),
  libelle            text        NOT NULL,
  sous_type          text,
  conducteur_requis  boolean     NOT NULL DEFAULT false,
  actif              boolean     NOT NULL DEFAULT true,
  cree_par           uuid        DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  modifie_par        uuid,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- CHECK type : site | materiel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ressources_logistiques_type_check'
      AND conrelid = 'public.ressources_logistiques'::regclass
  ) THEN
    ALTER TABLE public.ressources_logistiques
      ADD CONSTRAINT ressources_logistiques_type_check
      CHECK (type IN ('site', 'materiel'));
  END IF;
END $$;

-- CHECK sous_type : minibus | veo | autre (ou NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ressources_logistiques_sous_type_check'
      AND conrelid = 'public.ressources_logistiques'::regclass
  ) THEN
    ALTER TABLE public.ressources_logistiques
      ADD CONSTRAINT ressources_logistiques_sous_type_check
      CHECK (sous_type IS NULL OR sous_type IN ('minibus', 'veo', 'autre'));
  END IF;
END $$;

-- Coherence type='site' <-> site_id renseigne ; type='materiel' <-> site_id NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ressources_logistiques_site_coherence_check'
      AND conrelid = 'public.ressources_logistiques'::regclass
  ) THEN
    ALTER TABLE public.ressources_logistiques
      ADD CONSTRAINT ressources_logistiques_site_coherence_check
      CHECK (
        (type = 'site'     AND site_id IS NOT NULL)
        OR
        (type = 'materiel' AND site_id IS NULL)
      );
  END IF;
END $$;

-- Index de filtrage des tuiles (type + sous_type) sur le parc actif
CREATE INDEX IF NOT EXISTS idx_ressources_logistiques_type
  ON public.ressources_logistiques (type, sous_type)
  WHERE actif = true;

-- ---------------------------------------------------------------------
-- 2. Trigger updated_at / modifie_par
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ressources_logistiques_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at  := now();
  NEW.modifie_par := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ressources_logistiques_touch
  ON public.ressources_logistiques;
CREATE TRIGGER trg_ressources_logistiques_touch
  BEFORE UPDATE ON public.ressources_logistiques
  FOR EACH ROW EXECUTE FUNCTION public.ressources_logistiques_touch();

-- ---------------------------------------------------------------------
-- 3. RLS
--    Lecture : tout authentifie.
--    Write   : has_role('admin') (gestion du parc = administration).
-- ---------------------------------------------------------------------
ALTER TABLE public.ressources_logistiques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ressources_logistiques_select
  ON public.ressources_logistiques;
CREATE POLICY ressources_logistiques_select
  ON public.ressources_logistiques
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ressources_logistiques_insert
  ON public.ressources_logistiques;
CREATE POLICY ressources_logistiques_insert
  ON public.ressources_logistiques
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS ressources_logistiques_update
  ON public.ressources_logistiques;
CREATE POLICY ressources_logistiques_update
  ON public.ressources_logistiques
  FOR UPDATE
  TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

-- Pas de policy DELETE : on desactive via actif=false (soft delete), pas de purge.

-- ---------------------------------------------------------------------
-- 4. Garde fail-loud : la table doit exister avec RLS active
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'ressources_logistiques'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION
      'ressources_logistiques absente ou RLS non active — rollback';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Fin. Table socle prete. Amorçage (3 sites + 2 minibus + Veo) =
-- fichier 02 (etape suivante du decoupage §8).
-- =====================================================================
