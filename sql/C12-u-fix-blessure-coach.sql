-- =====================================================================
-- MOM Hub · C12-u · FIX blessure : retrait du double-effet dans
--                   inserer_observable_coach
-- =====================================================================
-- BUG constaté terrain : saisir une « blessure » côté coach plante avec
--   « column cj.composition_uuid does not exist ». Cause : le double-effet
--   blessure (hérité de inserer_observable jeton, recopié dans C12-s)
--   fait UPDATE composition_joueurs avec des NOMS DE COLONNES FAUX —
--   sonde information_schema : la table a composition_id (pas
--   composition_uuid) et joueur_id (pas joueur_uuid).
--
-- DÉCISION (tracée) — on RETIRE le double-effet de la voie coach plutôt
--   que de le réparer :
--   • Le suivi live OBSERVE, il ne doit pas MUTER la compo en plein match
--     (marquer un joueur 'blesse' dans composition_joueurs = édition de
--     compo, responsabilité distincte du suivi).
--   • La blessure reste pleinement enregistrée comme OBSERVABLE (historique
--     + temps de jeu). Rien d'essentiel perdu.
--   • Évite un couplage fragile (jointure vers la compo active).
--   Si un jour la blessure doit se répercuter sur la compo, à CADRER
--   explicitement (quelle compo, réversibilité, qui décide) — pas un
--   effet de bord caché.
--
-- DETTE signalée (NON corrigée ici, hors périmètre) : SUIVI-BENEVOLE-
--   BLESSURE — la voie JETON inserer_observable a le même double-effet
--   avec les mêmes noms erronés ; une blessure saisie côté bénévole
--   planterait pareil. À traiter dans le périmètre bénévole.
--
-- DOCTRINE : correctif PUR. inserer_observable_coach reprise À L'IDENTIQUE
--   de C12-s, SANS le bloc UPDATE composition_joueurs. Signature, gardes
--   (auth.uid), DS-1, INSERT : inchangés. Idempotent.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION inserer_observable_coach(
    p_evenement_uuid  UUID,
    p_observable_id   TEXT,
    p_categorie_obs   TEXT,
    p_valeur_points   INTEGER,
    p_equipe_concernee TEXT,
    p_joueur_uuid     UUID    DEFAULT NULL,
    p_mode_saisie     TEXT    DEFAULT 'normal',
    p_minute_match    INTEGER DEFAULT NULL,
    p_periode         INTEGER DEFAULT 1,
    p_timecode_video  INTERVAL DEFAULT NULL,
    p_est_blessure    BOOLEAN DEFAULT FALSE,
    p_joueur_uuid_entrant UUID DEFAULT NULL
) RETURNS TABLE (id UUID, horodatage TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt          UUID;
    v_joueur       UUID;
    v_joueur_entr  UUID;
    v_id           UUID;
    v_horo         TIMESTAMPTZ;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.
    v_evt := p_evenement_uuid;

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : saisie impossible.';
    END IF;

    -- Garde-fou DS-1 (inchangé) :
    IF p_equipe_concernee = 'adverse' THEN
        v_joueur      := NULL;
        v_joueur_entr := NULL;
    ELSIF p_equipe_concernee = 'notre' THEN
        v_joueur      := p_joueur_uuid;
        v_joueur_entr := p_joueur_uuid_entrant;
    ELSE
        RAISE EXCEPTION 'equipe_concernee invalide : %', p_equipe_concernee;
    END IF;

    INSERT INTO chronologie_suivi (
        evenement_uuid, minute_match, periode,
        observable_id, categorie_obs, valeur_points,
        mode_saisie, equipe_concernee, joueur_uuid,
        joueur_uuid_entrant,
        saisi_par, saisi_par_role, source_saisie, timecode_video
    ) VALUES (
        v_evt, p_minute_match, p_periode,
        p_observable_id, p_categorie_obs, p_valeur_points,
        p_mode_saisie, p_equipe_concernee, v_joueur,
        v_joueur_entr,
        'coach:' || COALESCE(auth.uid()::text, '?'), 'coach', 'live', p_timecode_video
    )
    RETURNING chronologie_suivi.id, chronologie_suivi.horodatage
    INTO v_id, v_horo;

    -- NOTE C12-u : double-effet blessure RETIRÉ (le suivi observe, ne mute
    -- pas la compo ; et les colonnes étaient erronées). p_est_blessure est
    -- conservé dans la signature pour compatibilité du wrapper, mais n'a
    -- plus d'effet ici. La blessure vit comme observable.

    RETURN QUERY SELECT v_id, v_horo;
END;
$$;

REVOKE ALL ON FUNCTION inserer_observable_coach(
    UUID, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, INTEGER, INTEGER,
    INTERVAL, BOOLEAN, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION inserer_observable_coach(
    UUID, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, INTEGER, INTEGER,
    INTERVAL, BOOLEAN, UUID) TO authenticated;

COMMIT;

-- =====================================================================
-- FIN C12-u. Double-effet blessure retiré de inserer_observable_coach
-- (plantait sur composition_uuid/joueur_uuid inexistants ; et le suivi
-- ne doit pas muter la compo). La blessure reste un observable normal.
-- Dette SUIVI-BENEVOLE-BLESSURE signalée (voie jeton, même bug, hors
-- périmètre). p_est_blessure conservé en signature (sans effet).
-- =====================================================================
