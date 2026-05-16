-- =====================================================================
-- MOM Hub · C12-e · RPC consolider_score_rencontre (score = calcul)
-- =====================================================================
-- Dette Production C12-e.
-- Sources de vérité :
--   • Modelisation-Chronologie-Suivi-v1.md v1.1, §6.4 + décision Q3
--     + §3.3 (contrat avec evenements)
--   • Conception-Portail-UI-Suivi.md : S-4.2.a (clôture « Fin du
--     match » → consolidation), S-5.3.b (re-consolidation après
--     correction Mode Vidéo)
-- Pré-requis : C12-a, C12-f (valider_lien_suivi).
--
-- DÉCISION Q3 : le score n'est JAMAIS saisi. Il est la somme des
-- valeur_points des lignes NON annulées, PAR equipe_concernee. Cette
-- RPC recopie cette somme comme PHOTO dans evenements.score_mom /
-- score_adverse (colonnes réelles : Modelisation-Evenements-v1.1
-- §4.2). Couplage faible : appelée à la clôture, ré-appelable après
-- toute correction. La vérité reste chronologie_suivi (recalculable).
--
-- DS-1 (v1.1) : le calcul somme PAR equipe_concernee, SANS regarder
-- joueur_uuid. Un essai « notre » sans marqueur identifié (notre +
-- joueur_uuid NULL, cas D-7) compte donc normalement dans score_mom :
-- le score reste juste même quand on ne sait pas qui a marqué.
-- (Modélisation §6.4 v1.1 : « Aucune modification de cette RPC. »)
--
-- Idempotent (UPDATE recalculable autant de fois que voulu).
-- =====================================================================

CREATE OR REPLACE FUNCTION consolider_score_rencontre(
    p_evenement_uuid UUID,
    -- jeton 'saisie' pour la clôture côté bénévole ; NULL = coach
    -- authentifié / smoke-test (re-consolidation Mode Vidéo)
    p_token TEXT DEFAULT NULL
) RETURNS TABLE (score_mom INTEGER, score_adverse INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt          UUID;
    v_score_notre  INTEGER;
    v_score_adv    INTEGER;
BEGIN
    -- Contrôle d'accès :
    --  • jeton 'saisie' valide pointant cette rencontre (clôture
    --    déclenchée par le bénévole), OU
    --  • coach authentifié / smoke-test (re-consolidation Mode Vidéo)
    IF p_token IS NOT NULL THEN
        v_evt := valider_lien_suivi(p_token, 'saisie');
        IF v_evt <> p_evenement_uuid THEN
            RAISE EXCEPTION 'Le jeton ne correspond pas à cette rencontre.';
        END IF;
    ELSE
        v_evt := p_evenement_uuid;
        -- (RLS fermée + GRANT ci-dessous limitent déjà l'appel au
        --  coach authentifié / service_role / smoke-test.)
    END IF;

    SELECT
        COALESCE(SUM(valeur_points) FILTER (
            WHERE equipe_concernee = 'notre'   AND annule = FALSE), 0),
        COALESCE(SUM(valeur_points) FILTER (
            WHERE equipe_concernee = 'adverse' AND annule = FALSE), 0)
      INTO v_score_notre, v_score_adv
      FROM chronologie_suivi
     WHERE evenement_uuid = v_evt;

    -- Photo de consolidation dans evenements (couplage faible §3.3).
    UPDATE evenements
       SET score_mom     = v_score_notre,
           score_adverse = v_score_adv
     WHERE id = v_evt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rencontre introuvable : %', v_evt;
    END IF;

    RETURN QUERY SELECT v_score_notre, v_score_adv;
END;
$$;

-- Surface d'accès : bénévole (clôture, clé anon + jeton 'saisie')
-- + coach authentifié (re-consolidation Mode Vidéo).
REVOKE ALL ON FUNCTION consolider_score_rencontre(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION consolider_score_rencontre(UUID, TEXT) TO anon, authenticated;

-- =====================================================================
-- FIN C12-e. Chaîne C12 complète : a → b → f → c → d → e.
-- Reste 1 seul câblage Production : chronologie_nom_court_personne
-- (C12-f §3) à brancher sur la source nom RGPD-safe de `personnes`.
-- =====================================================================
