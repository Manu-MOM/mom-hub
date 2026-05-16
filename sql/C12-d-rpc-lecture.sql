-- =====================================================================
-- MOM Hub · C12-d · RPC lecture chronologie (payload réduit RGPD)
-- =====================================================================
-- Dette Production C12-d.
-- Sources de vérité :
--   • Modelisation-Chronologie-Suivi-v1.md v1.1, §6.3 (get_chronologie
--     _rencontre, payload réduit, seule RPC de lecture v1 — décision Q4)
--   • Conception-Portail-UI-Suivi.md : S-2.1 (historique live),
--     S-5.1.b (lien spectateur, refresh ~10 s), S-5.2 (reconstruction
--     de l'écran « En cours » au relais/reconnexion depuis le Core)
-- Pré-requis : C12-a, C12-b, C12-f (valider_lien_suivi +
--              chronologie_nom_court_personne).
--
-- SECULE RPC de lecture livrée en v1 (décision Q4 : Rapport/Stats
-- différés à leurs audits). Lecture autorisée pour les DEUX rôles de
-- jeton ('saisie' ET 'spectateur' — le spectateur lit, n'écrit pas).
-- Payload RGPD réduit : aucune donnée Personne sensible ; le joueur
-- est exposé via joueur_uuid + nom court (helper C12-f, seul point
-- à câbler). Tri par horodatage (ordre de jeu). Lignes non annulées
-- par défaut ; option « vue audit » pour inclure les annulées.
--
-- Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION get_chronologie_rencontre(
    p_token             TEXT,
    p_inclure_annulees  BOOLEAN DEFAULT FALSE,
    -- bypass smoke-test : p_evenement_uuid + p_token NULL
    p_evenement_uuid    UUID    DEFAULT NULL
) RETURNS TABLE (
    id              UUID,
    horodatage      TIMESTAMPTZ,
    minute_match    INTEGER,
    periode         INTEGER,
    observable_id   TEXT,
    categorie_obs   TEXT,
    valeur_points   INTEGER,
    mode_saisie     TEXT,
    equipe_concernee TEXT,
    joueur_uuid     UUID,
    nom_court       TEXT,        -- via helper C12-f (NULL tant que non câblé)
    saisi_par_role  TEXT,
    source_saisie   TEXT,
    timecode_video  INTERVAL,
    annule          BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    IF p_token IS NOT NULL THEN
        -- NULL = lecture : un jeton 'saisie' OU 'spectateur' convient
        v_evt := valider_lien_suivi(p_token, NULL);
    ELSIF session_user IN ('postgres', 'supabase_admin')
          AND p_evenement_uuid IS NOT NULL THEN
        v_evt := p_evenement_uuid;                       -- smoke-test
    ELSE
        RAISE EXCEPTION 'Jeton requis.';
    END IF;

    RETURN QUERY
    SELECT  cs.id,
            cs.horodatage,
            cs.minute_match,
            cs.periode,
            cs.observable_id,
            cs.categorie_obs,
            cs.valeur_points,
            cs.mode_saisie,
            cs.equipe_concernee,
            cs.joueur_uuid,
            chronologie_nom_court_personne(cs.joueur_uuid),
            cs.saisi_par_role,
            cs.source_saisie,
            cs.timecode_video,
            cs.annule
    FROM    chronologie_suivi cs
    WHERE   cs.evenement_uuid = v_evt
      AND   (p_inclure_annulees OR cs.annule = FALSE)
    ORDER BY cs.horodatage ASC;     -- ordre de jeu (§6.3)
END;
$$;

-- Surface d'accès : porteur d'un lien (saisie OU spectateur, via clé
-- anon + jeton) + coach authentifié.
REVOKE ALL ON FUNCTION get_chronologie_rencontre(TEXT, BOOLEAN, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_chronologie_rencontre(TEXT, BOOLEAN, UUID) TO anon, authenticated;

-- =====================================================================
-- FIN C12-d. Prochaine dette (ordre §10.1) : C12-e (score consolidé).
-- =====================================================================
