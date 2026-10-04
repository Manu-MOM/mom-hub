-- =====================================================================
-- MOM Hub · C14-c · Traçabilité des lignes importées de la FFR
-- =====================================================================
-- Chantier : SUIVI-VEO, lot L6 (FAIT FOI Conception-SUIVI-VEO-v1, gelé
--   le 04/10/2026, décision D5-A).
--
-- BESOIN : les faits de match importés par copier-coller depuis Mon Club
--   House (FFR) doivent rester reconnaissables (source_saisie = 'ffr').
--
-- CHOIX TECHNIQUE (signature d'écriture INCHANGÉE) : plutôt que d'ajouter
--   un paramètre à inserer_observable_coach (nouvelle signature = DROP +
--   CREATE, risque de surcharge PGRST203), l'import insère par la RPC
--   existante puis MARQUE ses propres lignes via une RPC dédiée :
--     marquer_source_observables_coach(p_evenement_uuid, p_ids, p_source)
--   Garde : authentifié ; rencontre ouverte ; seules les lignes de CE match
--   saisies par CE compte (saisi_par = 'coach:' || auth.uid()) sont
--   modifiées ; source limitée à 'ffr'.
--
-- DDL : la contrainte chronologie_suivi_source_saisie_check accepte 'ffr'
--   (valeurs existantes conservées : live, video, correction).
--
-- DOCTRINE : ajout pur (contrainte élargie, 1 RPC neuve). Idempotent,
--   fail-loud, en transaction. Dry-run : remplacer le COMMIT par ROLLBACK.
-- =====================================================================

BEGIN;

ALTER TABLE public.chronologie_suivi
    DROP CONSTRAINT IF EXISTS chronologie_suivi_source_saisie_check;
ALTER TABLE public.chronologie_suivi
    ADD CONSTRAINT chronologie_suivi_source_saisie_check
    CHECK (source_saisie IN ('live', 'video', 'correction', 'ffr'));

CREATE OR REPLACE FUNCTION public.marquer_source_observables_coach(
    p_evenement_uuid UUID,
    p_ids            UUID [],
    p_source         TEXT DEFAULT 'ffr'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nb INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    IF p_source IS DISTINCT FROM 'ffr' THEN
        RAISE EXCEPTION 'Source non autorisée : %', p_source;
    END IF;
    IF NOT chronologie_rencontre_ouverte(p_evenement_uuid) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : modification impossible.';
    END IF;
    UPDATE public.chronologie_suivi AS cs
       SET source_saisie = p_source
     WHERE cs.evenement_uuid = p_evenement_uuid
       AND cs.id = ANY (p_ids)
       AND cs.saisi_par = 'coach:' || auth.uid()::TEXT;
    GET DIAGNOSTICS v_nb = ROW_COUNT;
    RETURN v_nb;
END;
$$;

REVOKE ALL ON FUNCTION public.marquer_source_observables_coach(UUID, UUID [], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marquer_source_observables_coach(UUID, UUID [], TEXT) TO authenticated;

DO $verif$
DECLARE
    v_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.chronologie_suivi'::REGCLASS
      AND conname = 'chronologie_suivi_source_saisie_check';
    IF v_def IS NULL OR v_def NOT LIKE '%ffr%' THEN
        RAISE EXCEPTION 'C14-c : contrainte source_saisie non élargie (%).', v_def;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'marquer_source_observables_coach') THEN
        RAISE EXCEPTION 'C14-c : RPC absente.';
    END IF;
    RAISE NOTICE 'C14-c OK : source ffr acceptée, RPC de marquage en place.';
END
$verif$;

COMMIT;
