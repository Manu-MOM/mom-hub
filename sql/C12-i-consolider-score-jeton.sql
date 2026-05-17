-- =====================================================================
-- MOM Hub · C12-i · Surcharge jeton-seul consolider_score_rencontre
-- =====================================================================
-- Dette Production SUIVI-UI-5 (consolidation du score côté bénévole
-- sans login). Couloir backend Suivi.
--
-- Sources de vérité (lues à la source, rien inventé) :
--   • sql/C12-e-consolider-score.sql : fonction CANONIQUE
--     consolider_score_rencontre(p_evenement_uuid UUID,
--     p_token TEXT DEFAULT NULL) — résout DÉJÀ l'événement depuis le
--     jeton en interne (valider_lien_suivi(p_token,'saisie')), calcule
--     le score (SUM valeur_points par equipe_concernee, lignes non
--     annulées, DS-1-safe), écrit la photo dans evenements, idempotent
--   • sql/C12-f-lien-ephemere.sql : helper valider_lien_suivi, posture
--     de grant (anon + authenticated pour le porteur d'un lien)
--   • Cadrage-SUIVI-COACH-1-Dettes-Backend.md §2 : option (b),
--     « surcharge (même nom, signature jeton-seule), pas une nouvelle
--     entité »
-- Pré-requis : C12-e, C12-f déployés.
--
-- LE PROBLÈME RÉEL (constaté à la lecture de C12-e) : la fonction
-- 2-arg résout déjà l'événement depuis le jeton, mais sa SIGNATURE
-- exige p_evenement_uuid en 1er argument — que le bénévole sans login
-- n'a pas. UI-5 = fournir un point d'entrée jeton-seul. RIEN d'autre :
-- la logique de consolidation n'est PAS modifiée (elle est correcte).
--
-- CHOIX : surcharge (même nom, arité 1 TEXT) qui DÉLÈGUE à la fonction
-- canonique 2-arg. La logique SUM/UPDATE reste mono-sourcée dans
-- C12-e (zéro duplication = zéro dérive future). Coût assumé : le
-- jeton est validé deux fois (ici, puis dans la fonction 2-arg) —
-- inoffensif et idempotent. C12-e N'EST PAS modifié par ce fichier.
--
-- RÉSOLUTION DE SURCHARGE (sûre) : appels via Supabase RPC = par
-- paramètre nommé (rpc('consolider_score_rencontre', {p_token:'…'}))
-- → résout sans ambiguïté vers la signature (p_token TEXT). En SQL
-- direct, un unique argument TEXT correspond exactement à (TEXT) ;
-- (UUID, TEXT DEFAULT NULL) exigerait un cast text→uuid non implicite
-- en résolution. Pas d'ambiguïté.
--
-- SÉCURITÉ : valider_lien_suivi(p_token,'saisie') lève sur jeton
-- invalide / révoqué / expiré ET sur jeton 'spectateur' (lecture
-- seule) — un spectateur ne peut JAMAIS consolider. Aucune escalade.
--
-- Idempotent (la fonction canonique l'est ; ce wrapper aussi).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Surcharge : consolidation déclenchée par le bénévole à la clôture
--   (« Fin du match », S-4.2.a) avec le seul jeton 'saisie' de l'URL.
--   Délègue intégralement à la fonction canonique 2-arg (C12-e).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consolider_score_rencontre(
    p_token TEXT
) RETURNS TABLE (score_mom INTEGER, score_adverse INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    -- Résout (et autorise) l'événement depuis le jeton 'saisie'.
    -- Lève si invalide / révoqué / expiré / rôle 'spectateur'.
    v_evt := valider_lien_suivi(p_token, 'saisie');

    -- Délégation : toute la logique de consolidation (SUM par camp,
    -- DS-1, photo evenements, idempotence) reste dans C12-e. On passe
    -- le jeton : la fonction canonique le re-valide (double contrôle
    -- assumé, inoffensif) et vérifie v_evt = p_evenement_uuid.
    RETURN QUERY
    SELECT cs.score_mom, cs.score_adverse
    FROM   consolider_score_rencontre(v_evt, p_token) AS cs;
END;
$$;

-- ---------------------------------------------------------------------
-- Surface d'accès — même posture que la fonction canonique C12-e :
-- bénévole (clé anon + jeton 'saisie', clôture) + coach authentifié.
-- Table fermée → on n'ouvre QUE la RPC.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION consolider_score_rencontre(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION consolider_score_rencontre(TEXT) TO anon, authenticated;

-- =====================================================================
-- FIN C12-i. SUIVI-UI-5 livrée (surcharge jeton-seul, délègue à
-- C12-e, zéro modification du corps existant). Les 4 dettes du
-- couloir backend Suivi (SUIVI-UI-1/5/6 + SUIVI-COACH-2) sont
-- soldées : C12-g, C12-h, C12-i.
-- Hors couloir, inchangé : C12-nom (chronologie_nom_court_personne,
-- C12-f §3) reste le seul câblage Production en attente.
-- =====================================================================
