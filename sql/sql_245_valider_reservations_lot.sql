-- =====================================================================
-- sql_245_valider_reservations_lot.sql
-- ---------------------------------------------------------------------
-- Chantier : VALIDATION-LOT-SERIE (pt 250)
--
-- Besoin : une serie de N occurrences cree N demandes `pending`
--          independantes. Les valider une par une (36+) est
--          inacceptable cote bureau/valideur. On livre la validation
--          groupee : approuver (ou refuser) une LISTE de demandes en
--          une seule transaction serveur atomique.
--
-- Patron : replique valider_reservation (unitaire, sql_03) —
--          meme garde bureau|admin, meme decision bornee, meme
--          tracabilite valide_par/valide_le. Nom NOUVEAU (pas
--          d'overload). Resolution de la « serie » faite cote front
--          (via evenement_parent_id) : la RPC recoit un simple uuid[]
--          et reste generique (sert aussi la selection multiple).
--
-- Atomicite : tout-ou-rien. Si le nombre de lignes touchees differe du
--             nombre d'ids fournis (id absent/introuvable), on leve →
--             rollback total. Aucun etat partiel.
--
-- Refus : la RPC accepte 'approved'|'rejected' (aligne unitaire), mais
--         le front n'expose le lot QUE pour 'approved' — le refus reste
--         unitaire (motif au cas par cas via valider_reservation).
--
-- Dry-run VERT (BEGIN/ROLLBACK, jumelle sans garde) : T1 lot valide
-- (2 approved) · T2 atomicite (1 valide + 1 bidon → rollback, reste
-- pending) · T3 liste vide leve · T4 decision invalide leve · T5 refus
-- lot + motif (2 rejected). Garde has_role prouvee active (refus net
-- sans JWT). Base intacte post-rollback.
--
-- Grants : aligne sur le REEL de valider_reservation sonde en base
--          (EXECUTE = authenticated, postgres, service_role ; pas de
--          public/anon) → GRANT EXECUTE TO authenticated. Pas de
--          revoke public/anon (il n'y en a jamais eu).
-- =====================================================================

BEGIN;

-- Securite : nom nouveau, mais on garantit l'absence d'overload.
DROP FUNCTION IF EXISTS public.valider_reservations_lot(uuid[], text, text);

CREATE FUNCTION public.valider_reservations_lot(
  p_ids         uuid[],
  p_decision    text,              -- 'approved' | 'rejected'
  p_motif_refus text DEFAULT NULL  -- conserve uniquement si rejected
)
RETURNS SETOF public.reservations_logistiques
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count   int;
  v_attendu int;
BEGIN
  -- Garde role (D1) : refus net hors bureau|admin. Identique a l'unitaire.
  IF NOT (public.has_role('bureau') OR public.has_role('admin')) THEN
    RAISE EXCEPTION 'Validation refusee : role bureau|admin requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Garde entree : liste non vide.
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Aucune reservation fournie';
  END IF;

  -- Decision bornee.
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision invalide : % (attendu approved|rejected)', p_decision;
  END IF;

  v_attendu := array_length(p_ids, 1);

  UPDATE public.reservations_logistiques
     SET statut      = p_decision,
         motif_refus = CASE WHEN p_decision = 'rejected'
                            THEN p_motif_refus ELSE NULL END,
         valide_par  = auth.uid(),
         valide_le   = now()
   WHERE id = ANY(p_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Atomicite tout-ou-rien : un id absent = echec du lot entier.
  IF v_count <> v_attendu THEN
    RAISE EXCEPTION
      'Lot incoherent : % lignes touchees sur % demandees (rollback total)',
      v_count, v_attendu;
  END IF;

  RETURN QUERY
    SELECT * FROM public.reservations_logistiques WHERE id = ANY(p_ids);
END $$;

-- Grants : PostgreSQL accorde EXECUTE a PUBLIC par defaut sur toute
-- nouvelle fonction. On revoque PUBLIC + anon pour s'aligner EXACTEMENT
-- sur le regime reel de valider_reservation (authenticated, postgres,
-- service_role) — moindre privilege sur une RPC SECURITY DEFINER mutante.
REVOKE EXECUTE ON FUNCTION public.valider_reservations_lot(uuid[], text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.valider_reservations_lot(uuid[], text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.valider_reservations_lot(uuid[], text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- Garde fail-loud finale : la RPC doit exister et etre SECURITY DEFINER.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'valider_reservations_lot'
      AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'RPC valider_reservations_lot absente ou non SECURITY DEFINER — rollback';
  END IF;
END $$;

COMMIT;
