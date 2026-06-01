-- =====================================================================
-- MOM Hub · C12-p · CORRECTIF chrono : démarrage MANUEL de chaque période
-- =====================================================================
-- Chantier : Refonte UX Suivi — suivi live, L2/3a (retour terrain Manu).
-- Demande : « passer à la mi-temps suivante » ne doit PAS relancer le
--   chrono tout seul. Chaque période se lance par un appui explicite
--   « ▶ Démarrer » (même geste partout). Entre deux périodes : chrono
--   à zéro, ARRÊTÉ, en attente de reprise manuelle.
--
-- MODÈLE D'ÉTATS (décision tracée) :
--   debut_periode_at devient le DRAPEAU « période lancée ou non » :
--     • NULL  → période ARMÉE (connue mais pas démarrée) → bouton Démarrer
--     • posé  → période EN COURS → chrono tourne
--   coup_envoi_at = horodatage du TOUT PREMIER départ du match (posé une
--     seule fois, au 1er demarrer_periode), conservé pour « le match a
--     commencé » / cohérence ; ce n'est plus lui qui pilote le tic-tac.
--
-- CHANGEMENTS vs C12-n (ajout/correctif PUR, CREATE OR REPLACE, même
--   signature) :
--   • action 'coup_envoi'      → REMPLACÉE par 'demarrer_periode'
--       (générique : lance la période courante ARMÉE ; pose coup_envoi_at
--        au 1er départ seulement). Ne touche pas periode_courante.
--   • action 'periode_suivante' → incrémente la période MAIS laisse
--       debut_periode_at = NULL (armée, PAS lancée) ; reset pause/cumul.
--   • 'config'  → garde alignée sur debut_periode_at IS NULL.
--   • 'pause'/'reprise' → n'ont de sens que période EN COURS
--       (debut_periode_at IS NOT NULL).
--   • 'fin'     → inchangée (clôture le match).
--
-- NOTE COMPAT : l'action 'coup_envoi' n'est plus reconnue (tombe dans le
--   ELSE → exception). Le front L2/3a est mis à jour en parallèle pour
--   émettre 'demarrer_periode'. Aucune donnée existante n'est invalidée.
-- Idempotent.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _appliquer_action_chrono(
    p_evt            UUID,
    p_action         TEXT,                 -- demarrer_periode|pause|reprise|periode_suivante|fin|config
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

    ELSIF p_action = 'demarrer_periode' THEN
        -- Lance la période ARMÉE (debut_periode_at NULL). Pose coup_envoi_at
        -- au tout premier départ seulement. Reset des pauses de la période.
        UPDATE suivi_chrono
           SET debut_periode_at = now(),
               coup_envoi_at    = COALESCE(coup_envoi_at, now()),
               en_pause = FALSE, pause_depuis_at = NULL, pause_cumul_secondes = 0,
               termine_at = NULL,
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND debut_periode_at IS NULL     -- période pas déjà en cours
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
        -- Arme la période suivante SANS la lancer (debut_periode_at = NULL).
        -- Le chrono ne repartira qu'au prochain 'demarrer_periode'.
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
-- FIN C12-p. Démarrage manuel par période (demarrer_periode). Passage de
-- période = armement sans lancement (debut_periode_at NULL). coup_envoi_at
-- = 1er départ. Action 'coup_envoi' retirée (front émet demarrer_periode).
-- action_chrono / action_chrono_coord inchangées (délèguent à ce cœur).
-- =====================================================================
