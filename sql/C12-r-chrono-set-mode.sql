-- =====================================================================
-- MOM Hub · C12-r · Action SET_MODE du chrono (écoulé / rebours)
-- =====================================================================
-- Chantier : Refonte UX Suivi — suivi live, L2/3b.
-- Objet : permettre de basculer le mode d'affichage du chrono
--   (temps écoulé ↔ compte à rebours) À TOUT MOMENT, et le PERSISTER
--   (cohérent avec le reste de l'état chrono qui vit en base et survit
--   au rechargement — mode_affichage existe déjà depuis C12-n).
--
-- POURQUOI une action dédiée : l'action 'config' est gardée par
--   debut_periode_at IS NULL (config avant démarrage seulement). Le mode
--   d'affichage, lui, doit pouvoir changer EN COURS de match. D'où une
--   branche 'set_mode' sans cette garde.
--
-- DOCTRINE : ajout PUR. CREATE OR REPLACE de _appliquer_action_chrono
--   (même signature) ; on REPREND la version C12-q à l'identique et on
--   AJOUTE la seule branche 'set_mode'. Aucune autre branche modifiée.
--   p_mode_affichage validé ('ecoule'|'rebours'). Idempotent.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _appliquer_action_chrono(
    p_evt            UUID,
    p_action         TEXT,                 -- demarrer_periode|pause|reprise|periode_suivante|fin|config|reset|set_mode
    p_durees         INTEGER[] DEFAULT NULL,
    p_mode_affichage TEXT      DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r suivi_chrono%ROWTYPE;
BEGIN
    INSERT INTO suivi_chrono (evenement_uuid)
        VALUES (p_evt)
        ON CONFLICT (evenement_uuid) DO NOTHING;
    SELECT * INTO r FROM suivi_chrono WHERE evenement_uuid = p_evt FOR UPDATE;

    IF p_action = 'config' THEN
        UPDATE suivi_chrono
           SET durees_periodes = COALESCE(p_durees, durees_periodes),
               mode_affichage  = COALESCE(p_mode_affichage, mode_affichage),
               updated_at      = now()
         WHERE evenement_uuid = p_evt
           AND debut_periode_at IS NULL;   -- config tant que rien n'est lancé
        RETURN;

    ELSIF p_action = 'set_mode' THEN
        -- Bascule le mode d'affichage À TOUT MOMENT (persisté).
        IF p_mode_affichage IS NULL OR p_mode_affichage NOT IN ('ecoule', 'rebours') THEN
            RAISE EXCEPTION 'mode_affichage invalide : %', p_mode_affichage;
        END IF;
        UPDATE suivi_chrono
           SET mode_affichage = p_mode_affichage,
               updated_at     = now()
         WHERE evenement_uuid = p_evt;

    ELSIF p_action = 'reset' THEN
        UPDATE suivi_chrono
           SET coup_envoi_at        = NULL,
               debut_periode_at     = NULL,
               periode_courante     = 1,
               en_pause             = FALSE,
               pause_depuis_at      = NULL,
               pause_cumul_secondes = 0,
               termine_at           = NULL,
               updated_at           = now()
         WHERE evenement_uuid = p_evt;

    ELSIF p_action = 'demarrer_periode' THEN
        UPDATE suivi_chrono
           SET debut_periode_at = now(),
               coup_envoi_at    = COALESCE(coup_envoi_at, now()),
               en_pause = FALSE, pause_depuis_at = NULL, pause_cumul_secondes = 0,
               termine_at = NULL,
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND debut_periode_at IS NULL
           AND termine_at IS NULL;

    ELSIF p_action = 'pause' THEN
        UPDATE suivi_chrono
           SET en_pause = TRUE, pause_depuis_at = now(), updated_at = now()
         WHERE evenement_uuid = p_evt
           AND debut_periode_at IS NOT NULL AND termine_at IS NULL
           AND en_pause = FALSE;

    ELSIF p_action = 'reprise' THEN
        UPDATE suivi_chrono
           SET en_pause = FALSE,
               pause_depuis_at = NULL,
               pause_cumul_secondes = pause_cumul_secondes
                   + COALESCE(EXTRACT(EPOCH FROM (now() - pause_depuis_at))::INTEGER, 0),
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND en_pause = TRUE;

    ELSIF p_action = 'periode_suivante' THEN
        UPDATE suivi_chrono
           SET periode_courante = periode_courante + 1,
               debut_periode_at = NULL,
               en_pause = FALSE, pause_depuis_at = NULL, pause_cumul_secondes = 0,
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND coup_envoi_at IS NOT NULL AND termine_at IS NULL;

    ELSIF p_action = 'fin' THEN
        UPDATE suivi_chrono
           SET termine_at = now(),
               en_pause = FALSE, pause_depuis_at = NULL,
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND coup_envoi_at IS NOT NULL AND termine_at IS NULL;

    ELSE
        RAISE EXCEPTION 'Action chrono invalide : %', p_action;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION _appliquer_action_chrono(UUID, TEXT, INTEGER[], TEXT) FROM PUBLIC;

COMMIT;

-- =====================================================================
-- FIN C12-r. Action 'set_mode' ajoutée : bascule mode_affichage
-- ('ecoule'|'rebours') à tout moment, persistée. Autres branches
-- identiques à C12-q. action_chrono(_coach) inchangées.
-- =====================================================================
