-- =====================================================================
-- MOM Hub · Module Logistique · Table 3/4 : reservations_logistiques
-- ---------------------------------------------------------------------
-- Le cœur : reservation simple (creneau unique) d'une ressource.
--
-- RLS  : SELECT tout authentifie ; INSERT garde B5-saisie
--        (puis_je_ecrire_categorie) ; pas d'UPDATE/DELETE client.
-- RPC  : valider_reservation(...) gardee bureau|admin = seule voie
--        de passage du statut + traçabilite valide_par/valide_le.
--
-- Ecart gouvernance assume (Manu, 5 juin 2026) : la SAISIE s'adosse a
-- B5 (un referent ne reserve que pour sa categorie). La VALIDATION
-- reste hors-B5, gardee bureau|admin (D1 intact).
--
-- Conception FAIT FOI §4.2 / §4.5.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations_logistiques (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ressource_id             uuid        NOT NULL REFERENCES public.ressources_logistiques(id),
  categorie_id             uuid        REFERENCES public.categories(id),
  responsable_personne_id  uuid        NOT NULL REFERENCES public.personnes(id),
  date                     date        NOT NULL,
  heure_debut              time        NOT NULL,
  heure_fin                time        NOT NULL,
  motif                    text,
  motif_refus              text,       -- renseigne si statut='rejected' (v1)
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
    WHERE conname = 'reservations_logistiques_statut_check'
      AND conrelid = 'public.reservations_logistiques'::regclass
  ) THEN
    ALTER TABLE public.reservations_logistiques
      ADD CONSTRAINT reservations_logistiques_statut_check
      CHECK (statut IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- CHECK coherence horaire (fin > debut)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_logistiques_horaire_check'
      AND conrelid = 'public.reservations_logistiques'::regclass
  ) THEN
    ALTER TABLE public.reservations_logistiques
      ADD CONSTRAINT reservations_logistiques_horaire_check
      CHECK (heure_fin > heure_debut);
  END IF;
END $$;

-- Index agenda : par ressource + date, sur le non-rejete
CREATE INDEX IF NOT EXISTS idx_reservations_logistiques_agenda
  ON public.reservations_logistiques (ressource_id, date)
  WHERE statut <> 'rejected';

-- Index file de validation
CREATE INDEX IF NOT EXISTS idx_reservations_logistiques_pending
  ON public.reservations_logistiques (statut)
  WHERE statut = 'pending';

-- ---------------------------------------------------------------------
-- 2. Trigger updated_at / modifie_par
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservations_logistiques_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at  := now();
  NEW.modifie_par := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reservations_logistiques_touch
  ON public.reservations_logistiques;
CREATE TRIGGER trg_reservations_logistiques_touch
  BEFORE UPDATE ON public.reservations_logistiques
  FOR EACH ROW EXECUTE FUNCTION public.reservations_logistiques_touch();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.reservations_logistiques ENABLE ROW LEVEL SECURITY;

-- Lecture : tout authentifie
DROP POLICY IF EXISTS reservations_logistiques_select
  ON public.reservations_logistiques;
CREATE POLICY reservations_logistiques_select
  ON public.reservations_logistiques
  FOR SELECT
  TO authenticated
  USING (true);

-- Insertion : B5-saisie. puis_je_ecrire_categorie gere le cas transverse
-- (admin/bureau) ET le referent sur sa categorie. categorie_id NULL =>
-- seul transverse passe (un referent ne fait pas de resa « sans categorie »).
DROP POLICY IF EXISTS reservations_logistiques_insert
  ON public.reservations_logistiques;
CREATE POLICY reservations_logistiques_insert
  ON public.reservations_logistiques
  FOR INSERT
  TO authenticated
  WITH CHECK ( public.puis_je_ecrire_categorie(categorie_id) );

-- Pas de policy UPDATE ni DELETE cote client :
-- tout changement de statut passe par la RPC valider_reservation (gardee).

-- ---------------------------------------------------------------------
-- 4. RPC de validation — seule voie de passage du statut
--    Gardee bureau|admin (D1). SECURITY DEFINER pour contourner
--    l'absence de policy UPDATE, mais re-verifie le role en interne.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valider_reservation(
  p_reservation_id uuid,
  p_decision       text,             -- 'approved' | 'rejected'
  p_motif_refus    text DEFAULT NULL -- v1 : facultatif, conserve si rejected
)
RETURNS public.reservations_logistiques
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.reservations_logistiques;
BEGIN
  -- Garde role (D1) : refus net hors bureau|admin.
  IF NOT (public.has_role('bureau') OR public.has_role('admin')) THEN
    RAISE EXCEPTION 'Validation refusee : role bureau|admin requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Decision bornee.
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision invalide : % (attendu approved|rejected)', p_decision;
  END IF;

  UPDATE public.reservations_logistiques
     SET statut      = p_decision,
         motif_refus = CASE WHEN p_decision = 'rejected'
                            THEN p_motif_refus ELSE NULL END,
         valide_par  = auth.uid(),
         valide_le   = now()
   WHERE id = p_reservation_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation introuvable : %', p_reservation_id;
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
    WHERE relname = 'reservations_logistiques'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'reservations_logistiques absente ou RLS non active — rollback';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'valider_reservation'
  ) THEN
    RAISE EXCEPTION 'RPC valider_reservation absente — rollback';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Fin. Cœur reservation pret. Etape suivante : reservations_recurrentes
-- (04a/4) puis demandes_bus (04b/4).
-- =====================================================================
