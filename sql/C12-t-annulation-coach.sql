-- =====================================================================
-- MOM Hub · C12-t · Voie COACH d'annulation d'observable
-- =====================================================================
-- Chantier : Refonte UX Suivi — suivi live, L4 (historique annulable),
--   remonté avant L3c/d sur retour terrain Manu (« pouvoir annuler une
--   action déjà saisie »).
--
-- CONSTAT (sonde pg_proc) : annuler_observable(p_token, p_ligne_id,
--   p_evenement_uuid) existe (voie jeton, garde saine) mais la voie
--   COACH annuler_observable_coach N'EXISTE PAS (pan coach jamais
--   déployé, comme inserer_observable_coach avant C12-s).
--
-- DOCTRINE : ajout PUR. Réplique EXACTE du mécanisme de annuler_observable
--   (marquage annule = TRUE, JAMAIS de DELETE — invariant projet ;
--   cloisonnement : la ligne doit appartenir à la rencontre ; garde
--   rencontre ouverte). Seule différence : autorisation auth.uid()
--   (pattern C12-o) au lieu du jeton, événement passé en direct.
--   Dette SUIVI-COACH-AUTH héritée. Idempotent.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION annuler_observable_coach(
    p_evenement_uuid UUID,
    p_ligne_id       UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    -- Autorisation coach RÉELLE (cf. C12-o) : utilisateur authentifié.
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.
    v_evt := p_evenement_uuid;

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : annulation impossible.';
    END IF;

    -- Cloisonnement : la ligne doit appartenir à la rencontre.
    -- Marquage annule = TRUE (JAMAIS de DELETE, invariant projet).
    UPDATE chronologie_suivi
       SET annule = TRUE
     WHERE id = p_ligne_id
       AND evenement_uuid = v_evt;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ligne introuvable pour cette rencontre.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION annuler_observable_coach(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION annuler_observable_coach(UUID, UUID) TO authenticated;

COMMIT;

-- =====================================================================
-- FIN C12-t. annuler_observable_coach créée : marque annule = TRUE
-- (jamais DELETE), cloisonnée par rencontre, garde auth.uid(). Le score
-- (calculé) ignore les lignes annulées → recalcul automatique. Voie
-- jeton annuler_observable inchangée. Front L4 : wrapper
-- annulerObservableCoach + historique annulable. SUIVI-COACH-AUTH héritée.
-- =====================================================================
