-- =====================================================================
-- MOM Hub · Module Logistique · Table 4b/4 : demandes_bus
-- ---------------------------------------------------------------------
-- Module riche : demande de bus. En-tete en colonnes + structures
-- variables (arrets, delegations) en JSONB — coherent avec le pattern
-- `donnees jsonb` des rapports (pt 54-55).
--
-- RLS  : SELECT tout authentifie ; INSERT garde B5-saisie ; pas
--        d'UPDATE/DELETE client.
-- RPC  : valider_bus(...) gardee bureau|admin.
--
-- Conception FAIT FOI §4.4.
--
-- Formes JSONB attendues (validees cote front, stockees telles quelles) :
--   arrets_aller  : [{ "lieu": text, "heure": "HH:MM", "nb_mom": int }]
--   arrets_retour : [{ "lieu": text, "heure": "HH:MM" }]
--   delegations   : [{ "club": text, "nb_pax": int }]
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demandes_bus (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id             uuid        REFERENCES public.categories(id),
  responsable_personne_id  uuid        NOT NULL REFERENCES public.personnes(id),
  date                     date        NOT NULL,
  type_competition         text,
  destination              text        NOT NULL,
  heure_arrivee_souhaitee  time,
  retour_depart            time,
  retour_arrivee           time,
  arrets_aller             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  arrets_retour            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  delegations              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  pax_joueurs              int         NOT NULL DEFAULT 0,
  pax_staff                int         NOT NULL DEFAULT 0,
  total_mom                int         NOT NULL DEFAULT 0,
  total_deleg              int         NOT NULL DEFAULT 0,
  total_bus                int         NOT NULL DEFAULT 0,
  notes                    text,
  motif_refus              text,
  statut                   text        NOT NULL DEFAULT 'pending',
  valide_par               uuid,
  valide_le                timestamptz,
  cree_par                 uuid        DEFAULT auth.uid(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  modifie_par              uuid,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- CHECK statut
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'demandes_bus_statut_check'
      AND conrelid = 'public.demandes_bus'::regclass
  ) THEN
    ALTER TABLE public.demandes_bus
      ADD CONSTRAINT demandes_bus_statut_check
      CHECK (statut IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- CHECK : les colonnes JSONB doivent etre des tableaux (pas des objets)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'demandes_bus_jsonb_arrays_check'
      AND conrelid = 'public.demandes_bus'::regclass
  ) THEN
    ALTER TABLE public.demandes_bus
      ADD CONSTRAINT demandes_bus_jsonb_arrays_check
      CHECK (
        jsonb_typeof(arrets_aller)  = 'array'
        AND jsonb_typeof(arrets_retour) = 'array'
        AND jsonb_typeof(delegations)   = 'array'
      );
  END IF;
END $$;

-- CHECK : totaux et pax non negatifs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'demandes_bus_compteurs_check'
      AND conrelid = 'public.demandes_bus'::regclass
  ) THEN
    ALTER TABLE public.demandes_bus
      ADD CONSTRAINT demandes_bus_compteurs_check
      CHECK (
        pax_joueurs >= 0 AND pax_staff >= 0
        AND total_mom >= 0 AND total_deleg >= 0 AND total_bus >= 0
      );
  END IF;
END $$;

-- Index file de validation + agenda par date
CREATE INDEX IF NOT EXISTS idx_demandes_bus_pending
  ON public.demandes_bus (statut)
  WHERE statut = 'pending';

CREATE INDEX IF NOT EXISTS idx_demandes_bus_date
  ON public.demandes_bus (date)
  WHERE statut <> 'rejected';

-- ---------------------------------------------------------------------
-- 2. Trigger updated_at / modifie_par
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demandes_bus_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at  := now();
  NEW.modifie_par := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_demandes_bus_touch
  ON public.demandes_bus;
CREATE TRIGGER trg_demandes_bus_touch
  BEFORE UPDATE ON public.demandes_bus
  FOR EACH ROW EXECUTE FUNCTION public.demandes_bus_touch();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.demandes_bus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demandes_bus_select
  ON public.demandes_bus;
CREATE POLICY demandes_bus_select
  ON public.demandes_bus
  FOR SELECT
  TO authenticated
  USING (true);

-- Insertion : B5-saisie (calque tables 3 et 4a)
DROP POLICY IF EXISTS demandes_bus_insert
  ON public.demandes_bus;
CREATE POLICY demandes_bus_insert
  ON public.demandes_bus
  FOR INSERT
  TO authenticated
  WITH CHECK ( public.puis_je_ecrire_categorie(categorie_id) );

-- Pas d'UPDATE/DELETE client : statut pilote par RPC.

-- ---------------------------------------------------------------------
-- 4. RPC validation — gardee bureau|admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valider_bus(
  p_demande_id  uuid,
  p_decision    text,
  p_motif_refus text DEFAULT NULL
)
RETURNS public.demandes_bus
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.demandes_bus;
BEGIN
  IF NOT (public.has_role('bureau') OR public.has_role('admin')) THEN
    RAISE EXCEPTION 'Validation refusee : role bureau|admin requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision invalide : % (attendu approved|rejected)', p_decision;
  END IF;

  UPDATE public.demandes_bus
     SET statut      = p_decision,
         motif_refus = CASE WHEN p_decision = 'rejected'
                            THEN p_motif_refus ELSE NULL END,
         valide_par  = auth.uid(),
         valide_le   = now()
   WHERE id = p_demande_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande de bus introuvable : %', p_demande_id;
  END IF;

  RETURN v_row;
END $$;

-- ---------------------------------------------------------------------
-- 5. Garde fail-loud finale
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'demandes_bus'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'demandes_bus absente ou RLS non active — rollback';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'valider_bus'
  ) THEN
    RAISE EXCEPTION 'RPC valider_bus absente — rollback';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Fin. 4 tables + amorçage + RLS B5 + 4 RPC validation en place.
-- Etape suivante : wrappers supabase-client.js (additifs).
-- =====================================================================
