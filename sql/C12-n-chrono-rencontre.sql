-- =====================================================================
-- MOM Hub · C12-n · Chrono de rencontre persistant (suivi live)
-- =====================================================================
-- Chantier : Refonte UX Suivi — suivi live éducateur seul, paquet L2
--   (Conception-Suivi-Live-Educateur-Seul-v1.md, D4/D5).
-- Objet : persister l'état du chrono d'un match pour qu'il SURVIVE au
--   rechargement / à la mise en veille (I5 : pas de localStorage, l'état
--   vit en base et l'écran le RECALCULE). Vrai chrono : coup d'envoi,
--   pause/reprise, périodes à durées configurables, compte à rebours
--   ou temps écoulé, fin de match. Alimente la minute_match fiable
--   (cohérent C12-m / temps de jeu D9).
--
-- DOCTRINE — AJOUT PUR. Table neuve + RPC neuves. Rien d'existant n'est
--   modifié. chronologie_suivi (jeu) N'EST PAS polluée par le chrono
--   (frontière du projet : aucun observable de chrono au référentiel).
--
-- PRINCIPE DE CALCUL (jamais figer les minutes) :
--   On stocke des HORODATAGES + des DURÉES, pas un compteur. Le temps
--   écoulé d'une période = (now - debut_periode_at) - cumul_pause, borné
--   par la durée de la période. L'écran recalcule à l'affichage → robuste
--   au rechargement, économe en écritures (1 écriture par GESTE, pas par
--   seconde). Même esprit que le score calculé (I1).
--
-- DEUX VOIES D'ACCÈS (décision Manu : coach ET bénévole) :
--   • voie JETON  : *_chrono(p_token, ...)        garde valider_lien_suivi
--   • voie COACH  : *_chrono_coach(p_evt, ...)     garde valider_coach_rencontre
--   Jumelles (pattern C12-d ≡ C12-k). Le cœur métier est mono-sourcé
--   dans _appliquer_action_chrono(v_evt, ...) : les 2 voies n'apportent
--   QUE l'autorisation, jamais la logique.
--
-- Pré-requis : C12-a (chronologie_suivi pour FK de cohérence non requise),
--   C12-f (valider_lien_suivi), C12-j (_coach_auth_uid, valider_coach_
--   rencontre), evenements (rencontre). Idempotent.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table suivi_chrono — 1 ligne par match (evenement_uuid = LE match)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suivi_chrono (
    evenement_uuid       UUID PRIMARY KEY,
    -- Config (modifiable tant que le match n'est pas commencé / via action 'config')
    durees_periodes      INTEGER[] NOT NULL DEFAULT ARRAY[30, 30],  -- minutes par période
    mode_affichage       TEXT    NOT NULL DEFAULT 'ecoule'
                          CHECK (mode_affichage IN ('ecoule', 'rebours')),
    -- État courant
    periode_courante     INTEGER NOT NULL DEFAULT 1,
    coup_envoi_at        TIMESTAMPTZ,           -- NULL = pas commencé
    debut_periode_at     TIMESTAMPTZ,           -- début de la période courante
    en_pause             BOOLEAN NOT NULL DEFAULT FALSE,
    pause_depuis_at      TIMESTAMPTZ,           -- horodatage du début de la pause active
    pause_cumul_secondes INTEGER NOT NULL DEFAULT 0,  -- pauses cumulées de la période courante
    termine_at           TIMESTAMPTZ,           -- NULL = pas terminé
    -- Audit léger
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE suivi_chrono IS
    'Chrono persistant d''un match (1 ligne / evenement_uuid). État = horodatages + durées ; minutes recalculées à l''affichage (jamais figées). Ajout C12-n (L2, D4/D5).';

-- ---------------------------------------------------------------------
-- 2. RLS « table fermée » : aucun accès direct client, tout par RPC
--    SECURITY DEFINER (patron C12-b).
-- ---------------------------------------------------------------------
ALTER TABLE suivi_chrono ENABLE ROW LEVEL SECURITY;
-- (Aucune policy permissive : la table n'est lisible/écrivable que par
--  les RPC SECURITY DEFINER ci-dessous, jamais en direct.)

-- ---------------------------------------------------------------------
-- 3. Cœur métier mono-sourcé — applique une action au chrono d'une
--    rencontre déjà AUTORISÉE (v_evt résolu par l'appelant).
--    SECURITY DEFINER, NON exposée au client (pas de GRANT public).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _appliquer_action_chrono(
    p_evt            UUID,
    p_action         TEXT,                 -- coup_envoi|pause|reprise|periode_suivante|fin|config
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
    -- Ligne créée à la volée si absente (config par défaut).
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
           AND coup_envoi_at IS NULL;     -- config seulement avant le coup d'envoi
        RETURN;

    ELSIF p_action = 'coup_envoi' THEN
        UPDATE suivi_chrono
           SET coup_envoi_at    = now(),
               debut_periode_at = now(),
               periode_courante = 1,
               en_pause = FALSE, pause_depuis_at = NULL, pause_cumul_secondes = 0,
               termine_at = NULL,
               updated_at = now()
         WHERE evenement_uuid = p_evt
           AND coup_envoi_at IS NULL;     -- une seule fois

    ELSIF p_action = 'pause' THEN
        UPDATE suivi_chrono
           SET en_pause = TRUE, pause_depuis_at = now(), updated_at = now()
         WHERE evenement_uuid = p_evt
           AND coup_envoi_at IS NOT NULL AND termine_at IS NULL
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
               debut_periode_at = now(),
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

-- ---------------------------------------------------------------------
-- 4. RPC d'ACTION — voie JETON (bénévole) et voie COACH (authentifié).
--    Jumelles : seule l'autorisation diffère, le cœur est mono-sourcé.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION action_chrono(
    p_token          TEXT,
    p_action         TEXT,
    p_durees         INTEGER[] DEFAULT NULL,
    p_mode_affichage TEXT      DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    v_evt := valider_lien_suivi(p_token, 'saisie');   -- jeton de SAISIE requis
    PERFORM _appliquer_action_chrono(v_evt, p_action, p_durees, p_mode_affichage);
END;
$$;

CREATE OR REPLACE FUNCTION action_chrono_coach(
    p_evenement_uuid UUID,
    p_action         TEXT,
    p_durees         INTEGER[] DEFAULT NULL,
    p_mode_affichage TEXT      DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    PERFORM _coach_auth_uid();
    v_evt := valider_coach_rencontre(p_evenement_uuid);
    PERFORM _appliquer_action_chrono(v_evt, p_action, p_durees, p_mode_affichage);
END;
$$;

REVOKE ALL ON FUNCTION action_chrono(TEXT, TEXT, INTEGER[], TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION action_chrono(TEXT, TEXT, INTEGER[], TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION action_chrono_coach(UUID, TEXT, INTEGER[], TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION action_chrono_coach(UUID, TEXT, INTEGER[], TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC de LECTURE — état brut (horodatages + durées). L'écran calcule
--    les minutes. Jumelles jeton (saisie OU spectateur) / coach.
--    Payload identique entre les deux voies (PI-5).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_chrono_rencontre(
    p_token TEXT
) RETURNS TABLE (
    durees_periodes      INTEGER[],
    mode_affichage       TEXT,
    periode_courante     INTEGER,
    coup_envoi_at        TIMESTAMPTZ,
    debut_periode_at     TIMESTAMPTZ,
    en_pause             BOOLEAN,
    pause_depuis_at      TIMESTAMPTZ,
    pause_cumul_secondes INTEGER,
    termine_at           TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    v_evt := valider_lien_suivi(p_token, NULL);   -- saisie OU spectateur (lecture)
    RETURN QUERY
    SELECT sc.durees_periodes, sc.mode_affichage, sc.periode_courante,
           sc.coup_envoi_at, sc.debut_periode_at, sc.en_pause,
           sc.pause_depuis_at, sc.pause_cumul_secondes, sc.termine_at
    FROM   suivi_chrono sc
    WHERE  sc.evenement_uuid = v_evt;
END;
$$;

CREATE OR REPLACE FUNCTION get_chrono_rencontre_coach(
    p_evenement_uuid UUID
) RETURNS TABLE (
    durees_periodes      INTEGER[],
    mode_affichage       TEXT,
    periode_courante     INTEGER,
    coup_envoi_at        TIMESTAMPTZ,
    debut_periode_at     TIMESTAMPTZ,
    en_pause             BOOLEAN,
    pause_depuis_at      TIMESTAMPTZ,
    pause_cumul_secondes INTEGER,
    termine_at           TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    PERFORM _coach_auth_uid();
    v_evt := valider_coach_rencontre(p_evenement_uuid);
    RETURN QUERY
    SELECT sc.durees_periodes, sc.mode_affichage, sc.periode_courante,
           sc.coup_envoi_at, sc.debut_periode_at, sc.en_pause,
           sc.pause_depuis_at, sc.pause_cumul_secondes, sc.termine_at
    FROM   suivi_chrono sc
    WHERE  sc.evenement_uuid = v_evt;
END;
$$;

REVOKE ALL ON FUNCTION get_chrono_rencontre(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_chrono_rencontre(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION get_chrono_rencontre_coach(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_chrono_rencontre_coach(UUID) TO authenticated;

COMMIT;

-- =====================================================================
-- FIN C12-n. Chrono persistant (table suivi_chrono + 5 RPC : action ×2
-- voies, lecture ×2 voies, cœur mono-sourcé _appliquer_action_chrono).
-- AJOUT PUR : chronologie_suivi & RPC C12 existantes NON touchées.
-- État = horodatages + durées ; minutes recalculées côté écran (I5,
-- survit au rechargement). Voies jeton (bénévole) + coach (éducateur).
-- RESTE À FAIRE (couche données + front) : wrappers supabase-client +
-- UI chrono dans renderEditorSuivi (L2 front).
-- =====================================================================
