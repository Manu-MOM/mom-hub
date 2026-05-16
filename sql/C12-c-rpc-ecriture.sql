-- =====================================================================
-- MOM Hub · C12-c · RPC écriture chronologie + double effet blessure
-- =====================================================================
-- Dette Production C12-c.
-- Sources de vérité :
--   • Modelisation-Chronologie-Suivi-v1.md v1.1, §6.1 (inserer),
--     §6.2 (annuler/corriger), §7 (double effet blessure, PI-6),
--     §4.1 (contrainte DS-1)
--   • Conception-Portail-UI-Suivi.md : S-2.2 (palette), S-3.1.c
--     (« Équipe / je ne sais pas »), S-3.2 (correction mauvais
--     numéro), S-3.4.b (2 annulations), S-3.4.c (blessure = constat)
-- Pré-requis : C12-a, C12-b, C12-f (valider_lien_suivi).
--
-- Toutes SECURITY DEFINER + bypass smoke-test Phase 5.14
-- (session_user IN ('postgres','supabase_admin')) pour tests SQL Studio.
-- Écriture réservée au jeton 'saisie' (validé via C12-f).
-- JAMAIS de DELETE. JAMAIS d'écriture dans `presences` (frontière §7).
--
-- ⚠️ NOTE HONNÊTE À CONFIRMER (Audits/Production) — état de blocage :
-- la modélisation §6.1 parle de bloquer si rencontre « termine/archive ».
-- Or le schéma RÉEL evenements (Modelisation-Evenements-v1.1 §4.2 +
-- §7.1) n'a PAS d'état 'termine' : les états sont
-- creation|compo|joue|resultat|archive|annule. Je n'invente pas
-- 'termine'. Choix retenu, conservateur et explicite : on bloque la
-- saisie live si etat IN ('archive','annule'). Les corrections
-- Mode Vidéo restent possibles tant que pas 'archive' (modél. §8.4).
-- À CONFIRMER : faut-il aussi bloquer la saisie live à 'resultat' ?
-- (clôture = 'resultat'). Marqué, non tranché unilatéralement.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper interne : la rencontre accepte-t-elle encore une écriture ?
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chronologie_rencontre_ouverte(
    p_evenement_uuid UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_etat TEXT;
BEGIN
    SELECT etat INTO v_etat FROM evenements WHERE id = p_evenement_uuid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rencontre introuvable.';
    END IF;
    -- Voir NOTE en tête : on bloque archive/annule (pas de 'termine'
    -- dans le schéma réel). À confirmer pour 'resultat'.
    RETURN v_etat NOT IN ('archive', 'annule');
END;
$$;

-- ---------------------------------------------------------------------
-- 1. inserer_observable — 1 tap = 1 ligne (modélisation §6.1)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION inserer_observable(
    p_token           TEXT,
    p_observable_id   TEXT,
    p_categorie_obs   TEXT,
    p_valeur_points   INTEGER,
    p_equipe_concernee TEXT,
    p_joueur_uuid     UUID    DEFAULT NULL,
    p_mode_saisie     TEXT    DEFAULT 'normal',
    p_minute_match    INTEGER DEFAULT NULL,
    p_periode         INTEGER DEFAULT 1,
    p_saisi_par_role  TEXT    DEFAULT 'benevole',
    p_source_saisie   TEXT    DEFAULT 'live',
    p_timecode_video  INTERVAL DEFAULT NULL,
    p_est_blessure    BOOLEAN DEFAULT FALSE,
    -- bypass smoke-test : passer p_evenement_uuid + p_token NULL
    p_evenement_uuid  UUID    DEFAULT NULL
) RETURNS TABLE (id UUID, horodatage TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt     UUID;
    v_joueur  UUID;
    v_id      UUID;
    v_horo    TIMESTAMPTZ;
BEGIN
    -- Résolution rencontre : jeton 'saisie', sauf bypass smoke-test
    IF p_token IS NOT NULL THEN
        v_evt := valider_lien_suivi(p_token, 'saisie');
    ELSIF session_user IN ('postgres', 'supabase_admin')
          AND p_evenement_uuid IS NOT NULL THEN
        v_evt := p_evenement_uuid;                       -- smoke-test
    ELSE
        RAISE EXCEPTION 'Jeton de saisie requis.';
    END IF;

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : saisie impossible.';
    END IF;

    -- Garde-fou DS-1 (modélisation §6.1) :
    --   adverse -> joueur FORCÉ à NULL (jamais de joueur MOM côté adverse)
    --   notre   -> joueur accepté À NULL (cas D-7 « je ne sais pas »)
    IF p_equipe_concernee = 'adverse' THEN
        v_joueur := NULL;
    ELSIF p_equipe_concernee = 'notre' THEN
        v_joueur := p_joueur_uuid;          -- peut être NULL : OK (DS-1)
    ELSE
        RAISE EXCEPTION 'equipe_concernee invalide : %', p_equipe_concernee;
    END IF;

    INSERT INTO chronologie_suivi (
        evenement_uuid, minute_match, periode,
        observable_id, categorie_obs, valeur_points,
        mode_saisie, equipe_concernee, joueur_uuid,
        saisi_par, saisi_par_role, source_saisie, timecode_video
    ) VALUES (
        v_evt, p_minute_match, p_periode,
        p_observable_id, p_categorie_obs, p_valeur_points,
        p_mode_saisie, p_equipe_concernee, v_joueur,
        p_token, p_saisi_par_role, p_source_saisie, p_timecode_video
    )
    RETURNING chronologie_suivi.id, chronologie_suivi.horodatage
    INTO v_id, v_horo;

    -- Double effet « blessure » (PI-6, modélisation §7) :
    -- la SEULE écriture remontante. Constat, jamais recomposition.
    -- composition_joueurs.etat_joueur : colonne livrée Phase 4.3
    -- (chronologie modél. §7 — NE PAS recréer). On la RÉUTILISE.
    -- Aucune écriture dans `presences` (frontière §7).
    IF p_est_blessure AND v_joueur IS NOT NULL
       AND p_equipe_concernee = 'notre' THEN
        UPDATE composition_joueurs cj
           SET etat_joueur = 'blesse'
          FROM compositions c
         WHERE cj.composition_uuid = c.id
           AND c.evenement_uuid    = v_evt
           AND c.cote = 'mom'
           AND c.est_active = TRUE
           AND cj.joueur_uuid = v_joueur;
    END IF;

    RETURN QUERY SELECT v_id, v_horo;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. annuler_observable — annule=TRUE, jamais de DELETE (§6.2)
--    Sert : annulation universelle ET « −1 » adverse (S-3.4.b).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION annuler_observable(
    p_token    TEXT,
    p_ligne_id UUID,
    p_evenement_uuid UUID DEFAULT NULL          -- bypass smoke-test
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    IF p_token IS NOT NULL THEN
        v_evt := valider_lien_suivi(p_token, 'saisie');
    ELSIF session_user IN ('postgres', 'supabase_admin')
          AND p_evenement_uuid IS NOT NULL THEN
        v_evt := p_evenement_uuid;
    ELSE
        RAISE EXCEPTION 'Jeton de saisie requis.';
    END IF;

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : annulation impossible.';
    END IF;

    -- La ligne doit appartenir à la rencontre du jeton (cloisonnement).
    UPDATE chronologie_suivi
       SET annule = TRUE
     WHERE id = p_ligne_id
       AND evenement_uuid = v_evt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ligne introuvable pour cette rencontre.';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. corriger_observable — corrige l'attribution joueur (§6.2)
--    Cas « mauvais numéro » (S-3.2) et ré-attribution Mode Vidéo
--    d'un essai D-7 (S-3.1.c / S-5.3.a). corrigee_le horodaté.
--    Ne casse pas la contrainte DS-1 (pas de joueur sur adverse).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION corriger_observable(
    p_token       TEXT,
    p_ligne_id    UUID,
    p_joueur_uuid UUID,                          -- nouveau joueur (ou NULL)
    p_evenement_uuid UUID DEFAULT NULL           -- bypass smoke-test
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt    UUID;
    v_equipe TEXT;
BEGIN
    IF p_token IS NOT NULL THEN
        v_evt := valider_lien_suivi(p_token, 'saisie');
    ELSIF session_user IN ('postgres', 'supabase_admin')
          AND p_evenement_uuid IS NOT NULL THEN
        v_evt := p_evenement_uuid;
    ELSE
        RAISE EXCEPTION 'Jeton de saisie requis.';
    END IF;

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre archivée : correction impossible.';
    END IF;

    SELECT equipe_concernee INTO v_equipe
      FROM chronologie_suivi
     WHERE id = p_ligne_id AND evenement_uuid = v_evt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ligne introuvable pour cette rencontre.';
    END IF;

    -- Protection DS-1 conservée : on ne met jamais un joueur sur une
    -- ligne 'adverse' (contrainte chronologie_suivi_adverse_sans_joueur).
    IF v_equipe = 'adverse' AND p_joueur_uuid IS NOT NULL THEN
        RAISE EXCEPTION 'Un observable adverse ne peut pas référencer un joueur.';
    END IF;

    UPDATE chronologie_suivi
       SET joueur_uuid = p_joueur_uuid,
           corrigee_le = NOW()
     WHERE id = p_ligne_id
       AND evenement_uuid = v_evt;
END;
$$;

-- ---------------------------------------------------------------------
-- Surface d'accès : porteur d'un lien (clé anon + jeton) + coach
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION chronologie_rencontre_ouverte(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION inserer_observable(TEXT,TEXT,TEXT,INTEGER,TEXT,UUID,TEXT,INTEGER,INTEGER,TEXT,TEXT,INTERVAL,BOOLEAN,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION inserer_observable(TEXT,TEXT,TEXT,INTEGER,TEXT,UUID,TEXT,INTEGER,INTEGER,TEXT,TEXT,INTERVAL,BOOLEAN,UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION annuler_observable(TEXT,UUID,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION annuler_observable(TEXT,UUID,UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION corriger_observable(TEXT,UUID,UUID,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION corriger_observable(TEXT,UUID,UUID,UUID) TO anon, authenticated;

-- =====================================================================
-- FIN C12-c. Prochaine dette (ordre §10.1) : C12-d (RPC lecture).
-- =====================================================================
