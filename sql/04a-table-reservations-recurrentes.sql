-- =====================================================================
-- MOM Hub · Module Logistique · Table 4a/4 : reservations_recurrentes
-- ---------------------------------------------------------------------
-- Regles de reservation recurrente. Memes colonnes metier que
-- reservations_logistiques, SANS `date` : remplacee par freq + jours[]
-- + date_fin. Les occurrences sont projetees COTE FRONT (replique de
-- getOccurrences de la maquette) — aucune materialisation en base.
--
-- RLS  : SELECT tout authentifie ; INSERT garde B5-saisie ; pas
--        d'UPDATE/DELETE client (statut/activation via RPC dediee).
-- RPC  : valider_recurrence(...) gardee bureau|admin.
--        set_recurrence_active(...) gardee bureau|admin (suspendre/reactiver).
--
-- Convention jours : 0=Lundi, 1=Mardi, ... 6=Dimanche (app source).
-- Conception FAIT FOI §4.3.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations_recurrentes (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ressource_id             uuid        NOT NULL REFERENCES public.ressources_logistiques(id),
  categorie_id             uuid        REFERENCES public.categories(id),
  responsable_personne_id  uuid        NOT NULL REFERENCES public.personnes(id),
  freq                     text        NOT NULL,
  jours                    int[]       NOT NULL DEFAULT '{}',  -- 0=Lun .. 6=Dim
  heure_debut              time        NOT NULL,
  heure_fin                time        NOT NULL,
  date_fin                 date        NOT NULL,
  motif                    text,
  motif_refus              text,
  active                   boolean     NOT NULL DEFAULT true,
  statut                   text        NOT NULL DEFAULT 'pending',
  valide_par               uuid,
  valide_le                timestamptz,
  cree_par                 uuid        DEFAULT auth.uid(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  modifie_par              uuid,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- CHECK freq
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_recurrentes_freq_check'
      AND conrelid = 'public.reservations_recurrentes'::regclass
  ) THEN
    ALTER TABLE public.reservations_recurrentes
      ADD CONSTRAINT reservations_recurrentes_freq_check
      CHECK (freq IN ('weekly', 'biweekly', 'monthly'));
  END IF;
END $$;

-- CHECK statut
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_recurrentes_statut_check'
      AND conrelid = 'public.reservations_recurrentes'::regclass
  ) THEN
    ALTER TABLE public.reservations_recurrentes
      ADD CONSTRAINT reservations_recurrentes_statut_check
      CHECK (statut IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- CHECK coherence horaire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_recurrentes_horaire_check'
      AND conrelid = 'public.reservations_recurrentes'::regclass
  ) THEN
    ALTER TABLE public.reservations_recurrentes
      ADD CONSTRAINT reservations_recurrentes_horaire_check
      CHECK (heure_fin > heure_debut);
  END IF;
END $$;

-- CHECK jours dans [0..6] (bornes de la convention source)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_recurrentes_jours_check'
      AND conrelid = 'public.reservations_recurrentes'::regclass
  ) THEN
    ALTER TABLE public.reservations_recurrentes
      ADD CONSTRAINT reservations_recurrentes_jours_check
      CHECK (
        jours <@ ARRAY[0,1,2,3,4,5,6]
      );
  END IF;
END $$;

-- Index file de validation + regles actives
CREATE INDEX IF NOT EXISTS idx_reservations_recurrentes_pending
  ON public.reservations_recurrentes (statut)
  WHERE statut = 'pending';

CREATE INDEX IF NOT EXISTS idx_reservations_recurrentes_actives
  ON public.reservations_recurrentes (ressource_id)
  WHERE active = true AND statut = 'approved';

-- ---------------------------------------------------------------------
-- 2. Trigger updated_at / modifie_par
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservations_recurrentes_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at  := now();
  NEW.modifie_par := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reservations_recurrentes_touch
  ON public.reservations_recurrentes;
CREATE TRIGGER trg_reservations_recurrentes_touch
  BEFORE UPDATE ON public.reservations_recurrentes
  FOR EACH ROW EXECUTE FUNCTION public.reservations_recurrentes_touch();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.reservations_recurrentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservations_recurrentes_select
  ON public.reservations_recurrentes;
CREATE POLICY reservations_recurrentes_select
  ON public.reservations_recurrentes
  FOR SELECT
  TO authenticated
  USING (true);

-- Insertion : B5-saisie (calque table 3)
DROP POLICY IF EXISTS reservations_recurrentes_insert
  ON public.reservations_recurrentes;
CREATE POLICY reservations_recurrentes_insert
  ON public.reservations_recurrentes
  FOR INSERT
  TO authenticated
  WITH CHECK ( public.puis_je_ecrire_categorie(categorie_id) );

-- Pas d'UPDATE/DELETE client : statut + activation via RPC gardees.

-- ---------------------------------------------------------------------
-- 4. RPC validation (statut) — gardee bureau|admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valider_recurrence(
  p_recurrence_id uuid,
  p_decision      text,
  p_motif_refus   text DEFAULT NULL
)
RETURNS public.reservations_recurrentes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.reservations_recurrentes;
BEGIN
  IF NOT (public.has_role('bureau') OR public.has_role('admin')) THEN
    RAISE EXCEPTION 'Validation refusee : role bureau|admin requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision invalide : % (attendu approved|rejected)', p_decision;
  END IF;

  UPDATE public.reservations_recurrentes
     SET statut      = p_decision,
         motif_refus = CASE WHEN p_decision = 'rejected'
                            THEN p_motif_refus ELSE NULL END,
         valide_par  = auth.uid(),
         valide_le   = now()
   WHERE id = p_recurrence_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regle recurrente introuvable : %', p_recurrence_id;
  END IF;

  RETURN v_row;
END $$;

-- ---------------------------------------------------------------------
-- 5. RPC activation (suspendre / reactiver) — gardee bureau|admin
--    (Recurrents : activer/suspendre/supprimer de la maquette ;
--     suppression = soft via active=false, pas de DELETE.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_recurrence_active(
  p_recurrence_id uuid,
  p_active        boolean
)
RETURNS public.reservations_recurrentes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.reservations_recurrentes;
BEGIN
  IF NOT (public.has_role('bureau') OR public.has_role('admin')) THEN
    RAISE EXCEPTION 'Action refusee : role bureau|admin requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.reservations_recurrentes
     SET active = p_active
   WHERE id = p_recurrence_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regle recurrente introuvable : %', p_recurrence_id;
  END IF;

  RETURN v_row;
END $$;

-- ---------------------------------------------------------------------
-- 6. Garde fail-loud finale
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'reservations_recurrentes'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'reservations_recurrentes absente ou RLS non active — rollback';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'valider_recurrence'
  ) THEN
    RAISE EXCEPTION 'RPC valider_recurrence absente — rollback';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_recurrence_active'
  ) THEN
    RAISE EXCEPTION 'RPC set_recurrence_active absente — rollback';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Fin. Recurrences pretes. Derniere table : demandes_bus (4b/4).
-- =====================================================================
