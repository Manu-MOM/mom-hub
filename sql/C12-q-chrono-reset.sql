-- =====================================================================
-- MOM Hub · C12-q · Action RESET du chrono (retour en arrière)
-- =====================================================================
-- Chantier : Refonte UX Suivi — suivi live, L2 (retour terrain Manu :
--   « je ne peux pas revenir en arrière »).
-- Objet : ajouter une action 'reset' au chrono pour annuler un
--   démarrage / une config erronée et revenir à l'écran de config,
--   SANS toucher aux observables de jeu.
--
-- DÉCISION (tracée) — périmètre du reset :
--   • Remet l'ÉTAT du chrono à l'initial : coup_envoi_at, debut_periode_at,
--     termine_at → NULL ; periode_courante → 1 ; pauses → 0.
--   • CONSERVE la config : durees_periodes, mode_affichage (corriger une
--     fausse manip ne doit pas obliger à tout re-saisir).
--   • NE TOUCHE PAS chronologie_suivi (observables de jeu) : tables
--     séparées, sûreté par construction. L'annulation d'une action de
--     jeu précise relèvera d'un mécanisme dédié (L4), pas du reset.
--
-- DOCTRINE : correctif/ajout PUR. CREATE OR REPLACE de
--   _appliquer_action_chrono (même signature) ; on REPREND la version
--   C12-p à l'identique et on AJOUTE la seule branche 'reset'. Aucune
--   autre branche modifiée. Idempotent.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _appliquer_action_chrono(
    p_evt            UUID,
    p_action         TEXT,                 -- demarrer_periode|pause|reprise|periode_suivante|fin|config|reset
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

    ELSIF p_action = 'reset' THEN
        -- Retour à l'état initial. Config (durées + mode) CONSERVÉE.
        -- Observables de jeu (chronologie_suivi) NON touchés.
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
-- FIN C12-q. Action 'reset' ajoutée : remet le chrono à l'état initial
-- (config durées/mode CONSERVÉE), sans toucher chronologie_suivi. Les
-- autres branches sont identiques à C12-p. action_chrono(_coach)
-- inchangées (délèguent à ce cœur). Front : bouton ↺ Réinitialiser.
-- =====================================================================
