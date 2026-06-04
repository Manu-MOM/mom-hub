-- =====================================================================
-- MOM Hub · C12-v · Archive des PÉRIODES jouées (préalable temps de jeu)
-- =====================================================================
-- Chantier : SUIVI-COACH-7 — temps de jeu fiable. Préalable backend du
--   chantier Stats de saison. Décision Manu : fiabiliser le temps de jeu
--   AVANT de concevoir la fiche stats joueur.
--
-- PROBLÈME RÉSOLU (établi par sondes à la source, anti-fabrication pt 14) :
--   suivi_chrono est un ÉTAT COURANT (1 ligne/match) qui ÉCRASE l'historique :
--     • 'periode_suivante' remet debut_periode_at=NULL et pause_cumul=0 ;
--     • 'demarrer_periode' réécrit debut_periode_at à chaque période.
--   Conséquence prouvée : une fois le match en période N>1 (ou terminé), on
--   ne peut PLUS reconstituer le coup d'envoi réel des périodes passées ni
--   leurs pauses depuis suivi_chrono. Le calcul a posteriori du temps de
--   jeu (somme des fenêtres de présence converties en minutes de JEU) est
--   donc IMPOSSIBLE sans archivage. minute_match est par ailleurs prouvé
--   non fiable (pt 53) ; seul horodatage (NOT NULL) est exploitable.
--
-- SOLUTION (décision structurelle Manu — FRONTIÈRE pt 47 RESPECTÉE) :
--   On N'écrit PAS d'observable de chrono dans chronologie_suivi (le
--   journal de jeu reste pur, frontière réaffirmée jusqu'en C12-q/r). On
--   ajoute une TABLE-FILLE dédiée `suivi_chrono_periodes` qui ARCHIVE, en
--   append, une FENÊTRE par période effectivement jouée :
--     debut_at  = horodatage réel du 'demarrer_periode' de cette période
--     fin_at    = horodatage réel du 'periode_suivante' ou 'fin' qui la clôt
--     pause_cumul_secondes = pauses de la période, figées à la clôture
--   La conversion horodatage→minute de jeu (RPC de calcul, fichier suivant)
--   lira CETTE table + les substitutions de chronologie_suivi.
--
-- MODÈLE D'ÉTATS (rappel C12-p, base du greffon) :
--   debut_periode_at = drapeau « période lancée » :
--     • NULL → période ARMÉE (connue, pas démarrée)
--     • posé → période EN COURS
--   Cycle réel : demarrer_periode (ouvre) → [jeu/pauses] → periode_suivante
--     (clôt + arme la suivante) → demarrer_periode (ouvre) → … → fin (clôt).
--   Le temps mort entre periode_suivante et le demarrer_periode suivant
--   (période armée, chrono à zéro arrêté) n'ouvre AUCUNE fenêtre → ignoré,
--   ce qui est correct (aucun jeu pendant l'armement).
--
-- GREFFON (ajout PUR dans le cœur _appliquer_action_chrono, mono-sourcé →
--   les 2 voies jeton+coach en héritent) :
--   • 'demarrer_periode' appliqué → OUVRE une fenêtre (INSERT debut_at=now()).
--   • 'periode_suivante' appliqué → CLÔT la fenêtre ouverte (fin_at=now(),
--       fige pause_cumul_secondes lu sur suivi_chrono AVANT remise à 0).
--   • 'fin' appliqué → CLÔT la fenêtre ouverte (idem).
--   • 'reset' appliqué → PURGE toutes les fenêtres de l'évènement (cohérence :
--       reset = retour à l'état vierge, table-fille comprise).
--   Chaque écriture est CONDITIONNÉE au succès de l'UPDATE d'état (ROW_COUNT),
--   pour ne JAMAIS archiver une fenêtre fantôme quand un garde a bloqué
--   l'action (ex. demarrer_periode sur période déjà en cours).
--
-- DÉCISION D-G (Manu, option simple) : temps de jeu = présence terrain
--   bornée (entrée→sortie), arrêts internes NON déduits au prorata par
--   joueur. pause_cumul_secondes est archivé par période pour usage futur,
--   mais le calcul v1 borne sur les substitutions, pas sur les pauses.
--
-- DOCTRINE — AJOUT PUR. Table neuve. _appliquer_action_chrono redéclarée
--   À L'IDENTIQUE de C12-r (toutes branches : config/set_mode/reset/
--   demarrer_periode/pause/reprise/periode_suivante/fin) + le seul ajout des
--   INSERT/UPDATE/DELETE table-fille. chronologie_suivi, suivi_chrono, RPC
--   d'action et de lecture : NON modifiées. Idempotent (CREATE IF NOT
--   EXISTS, CREATE OR REPLACE), fail-loud (bloc DO d'invariants), en
--   transaction.
--
-- Pré-requis : suivi_chrono (C12-n), _appliquer_action_chrono (C12-r =
--   dernière version en base : généalogie C12-n→p→q→r). Idempotent.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table suivi_chrono_periodes — 1 ligne par PÉRIODE effectivement
--    JOUÉE (lancée par demarrer_periode), append-only via le cœur chrono.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suivi_chrono_periodes (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    evenement_uuid       UUID        NOT NULL,
    periode              INTEGER     NOT NULL CHECK (periode >= 1),
    debut_at             TIMESTAMPTZ NOT NULL,        -- horodatage réel du demarrer_periode
    fin_at               TIMESTAMPTZ,                 -- NULL = période en cours (non clôturée)
    pause_cumul_secondes INTEGER     NOT NULL DEFAULT 0,  -- pauses de la période, figées à la clôture
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Au plus UNE fenêtre OUVERTE (fin_at NULL) par match : garantit que la
-- clôture (periode_suivante/fin) cible une fenêtre unique sans ambiguïté.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chrono_periode_ouverte
    ON suivi_chrono_periodes (evenement_uuid)
    WHERE fin_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chrono_periodes_evt
    ON suivi_chrono_periodes (evenement_uuid);

COMMENT ON TABLE suivi_chrono_periodes IS
    'Archive append-only d''une fenêtre par période JOUÉE (1 demarrer_periode = 1 ligne). debut_at/fin_at = horodatages réels ; pause_cumul figé à la clôture. Alimentée par le cœur _appliquer_action_chrono (C12-v). Frontière pt 47 respectée : AUCUN observable de chrono dans chronologie_suivi. Base du calcul de temps de jeu (SUIVI-COACH-7).';

-- ---------------------------------------------------------------------
-- 2. RLS « table fermée » : aucun accès direct client, tout par les RPC
--    SECURITY DEFINER (le cœur chrono écrit ; la RPC de calcul lira).
--    Patron C12-b / C12-n / C13-a.
-- ---------------------------------------------------------------------
ALTER TABLE suivi_chrono_periodes ENABLE ROW LEVEL SECURITY;
-- (Aucune policy permissive : lisible/écrivable uniquement par les
--  fonctions SECURITY DEFINER, jamais en direct.)

-- ---------------------------------------------------------------------
-- 3. Cœur métier _appliquer_action_chrono — REDÉCLARATION À L'IDENTIQUE
--    de C12-r (dernière version en base) + GREFFON d'archivage des
--    périodes. Même signature, SECURITY DEFINER, non exposée au client.
--    AJOUT PUR : seules les écritures table-fille sont nouvelles ; toute
--    la logique d'état suivi_chrono est inchangée.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _appliquer_action_chrono(
    p_evt            UUID,
    p_action         TEXT,  -- config|set_mode|reset|demarrer_periode|pause|reprise|periode_suivante|fin
    p_durees         INTEGER[] DEFAULT NULL,
    p_mode_affichage TEXT      DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r            suivi_chrono%ROWTYPE;
    v_n          INTEGER;       -- ROW_COUNT de l'UPDATE d'état (greffon)
    v_pause_fige INTEGER;       -- pause_cumul figé à la clôture d'une fenêtre
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

        -- GREFFON C12-v : reset = état vierge, table-fille comprise.
        -- Purge toutes les fenêtres archivées de cet évènement.
        DELETE FROM suivi_chrono_periodes WHERE evenement_uuid = p_evt;

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
        GET DIAGNOSTICS v_n = ROW_COUNT;

        -- GREFFON C12-v : OUVRE une fenêtre seulement si l'action a pris
        -- effet (sinon un garde l'a bloquée → pas de fenêtre fantôme).
        IF v_n = 1 THEN
            INSERT INTO suivi_chrono_periodes (evenement_uuid, periode, debut_at)
            SELECT p_evt, sc.periode_courante, sc.debut_periode_at
            FROM   suivi_chrono sc
            WHERE  sc.evenement_uuid = p_evt;
        END IF;

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
        -- GREFFON C12-v : fige le pause_cumul de la période AVANT sa remise
        -- à 0, pour l'archiver dans la fenêtre qu'on s'apprête à clôturer.
        v_pause_fige := r.pause_cumul_secondes;

        -- Arme la période suivante SANS la lancer (debut_periode_at = NULL).
        UPDATE suivi_chrono
           SET periode_courante = periode_courante + 1,
               debut_periode_at = NULL,
               en_pause = FALSE, pause_depuis_at = NULL, pause_cumul_secondes = 0,
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND coup_envoi_at IS NOT NULL AND termine_at IS NULL;
        GET DIAGNOSTICS v_n = ROW_COUNT;

        -- GREFFON C12-v : CLÔT la fenêtre ouverte (s'il y en a une) seulement
        -- si l'action a pris effet. fige pause_cumul de la période close.
        IF v_n = 1 THEN
            UPDATE suivi_chrono_periodes
               SET fin_at = now(),
                   pause_cumul_secondes = v_pause_fige
             WHERE evenement_uuid = p_evt
               AND fin_at IS NULL;
        END IF;

    ELSIF p_action = 'fin' THEN
        -- GREFFON C12-v : fige le pause_cumul courant avant clôture.
        v_pause_fige := r.pause_cumul_secondes;

        UPDATE suivi_chrono
           SET termine_at = now(),
               en_pause = FALSE, pause_depuis_at = NULL,
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND coup_envoi_at IS NOT NULL AND termine_at IS NULL;
        GET DIAGNOSTICS v_n = ROW_COUNT;

        -- GREFFON C12-v : CLÔT la fenêtre ouverte (la dernière période jouée).
        IF v_n = 1 THEN
            UPDATE suivi_chrono_periodes
               SET fin_at = now(),
                   pause_cumul_secondes = v_pause_fige
             WHERE evenement_uuid = p_evt
               AND fin_at IS NULL;
        END IF;

    ELSE
        RAISE EXCEPTION 'Action chrono invalide : %', p_action;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION _appliquer_action_chrono(UUID, TEXT, INTEGER[], TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 4. Invariants fail-loud — vérifie l'état attendu avant COMMIT. Si un
--    invariant casse, RAISE → rollback de toute la transaction.
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_ok    BOOLEAN;
    v_idx   INTEGER;
BEGIN
    -- table-fille présente
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'suivi_chrono_periodes'
    ) THEN
        RAISE EXCEPTION 'Invariant C12-v : table suivi_chrono_periodes absente.';
    END IF;

    -- RLS active sur la table-fille
    SELECT relrowsecurity INTO v_ok FROM pg_class WHERE relname = 'suivi_chrono_periodes';
    IF NOT v_ok THEN
        RAISE EXCEPTION 'Invariant C12-v : RLS non active sur suivi_chrono_periodes.';
    END IF;

    -- index unique partiel « une fenêtre ouverte max » présent
    SELECT count(*) INTO v_idx FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uniq_chrono_periode_ouverte';
    IF v_idx <> 1 THEN
        RAISE EXCEPTION 'Invariant C12-v : index uniq_chrono_periode_ouverte absent.';
    END IF;

    -- le cœur chrono existe toujours (signature inchangée)
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = '_appliquer_action_chrono'
          AND pg_get_function_arguments(p.oid) =
              'p_evt uuid, p_action text, p_durees integer[] DEFAULT NULL::integer[], p_mode_affichage text DEFAULT NULL::text'
    ) THEN
        RAISE EXCEPTION 'Invariant C12-v : _appliquer_action_chrono absente ou signature modifiée.';
    END IF;

    RAISE NOTICE 'C12-v OK : table suivi_chrono_periodes + RLS + index + cœur chrono greffé.';
END;
$verif$;

COMMIT;

-- =====================================================================
-- FIN C12-v. Archive des périodes jouées (suivi_chrono_periodes) alimentée
-- par le cœur _appliquer_action_chrono (greffon append-only, conditionné au
-- ROW_COUNT). FRONTIÈRE pt 47 RESPECTÉE : aucun observable chrono dans
-- chronologie_suivi. demarrer_periode ouvre une fenêtre ; periode_suivante
-- et fin la clôturent (fige pause_cumul) ; reset purge. Base du calcul de
-- temps de jeu (RPC get_temps_de_jeu_rencontre, fichier suivant C12-w).
-- AJOUT PUR : suivi_chrono, chronologie_suivi, RPC action/lecture NON
-- touchées. La fonction est redéclarée À L'IDENTIQUE de C12-r + greffon.
-- RECETTE : non recettable sur match test (aucun match avec chrono lancé
-- ET actions ; b39d82bc = actions sans chrono, 42a2ab74 = chrono sans
-- actions). Recette terrain au prochain vrai match suivi de bout en bout.
-- =====================================================================
