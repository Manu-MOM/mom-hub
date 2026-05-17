-- =====================================================================
-- MOM Hub · C12-h · Relecture du lien 'saisie' actif d'une rencontre
-- =====================================================================
-- Dette Production SUIVI-COACH-2 (enregistrée au STATE 17/05 sur
-- décision Manu, rattachée à ce couloir backend).
--
-- Sources de vérité (lues à la source, rien inventé) :
--   • sql/C12-f-lien-ephemere.sql : table lien_suivi (token,
--     evenement_uuid, role, revoque, expire_le, date_creation),
--     RPC generer_lien_ephemere (posture GRANT authenticated seul,
--     invariant relais : un nouveau lien 'saisie' révoque les
--     'saisie' actifs précédents de la rencontre)
--   • STATE.md : entrée SUIVI-COACH-2 (forme minimale, non bloquant)
--   • Cadrage-SUIVI-COACH-1-Dettes-Backend.md §2/§3
-- Pré-requis : C12-f (lien_suivi déployé).
--
-- POURQUOI EVENT-BORNÉE AUTHENTIFIÉE *SEULEMENT* (je m'écarte de la
-- piste « jeton-OU-event-bornée » du STATE, et je le motive — les
-- pistes du cadrage sont explicitement « à trancher en conv backend,
-- non décrétées ») :
--
--   1. SÉCURITÉ. Un demi-volet jeton-bornée permettrait à un porteur
--      de jeton 'spectateur' d'interroger « quel est le lien 'saisie'
--      actif de cette rencontre » → il pourrait pêcher le JETON DE
--      SAISIE et écrire. C'est l'escalade spectateur→rédacteur que la
--      posture « lien spectateur sûr par construction » de C12-f
--      (S-5.1.a) protège précisément. Inacceptable.
--
--   2. REDONDANCE. Le bénévole détient DÉJÀ son jeton 'saisie' dans
--      son URL ; son état se reconstruit via I5 / get_chronologie,
--      jamais en relisant le lien. Le volet jeton n'a aucun
--      consommateur réel.
--
--   3. LE VRAI BESOIN. Le seul consommateur de SUIVI-COACH-2 est
--      Objet A (coach authentifié, fiche événement evenements.html,
--      qui possède l'evenement_uuid via l'accès Hub) : rendre l'état
--      3 « lien déjà généré » persistant entre visites. C'est
--      exactement event-bornée + authentifié.
--
-- Posture de grant : identique à generer_lien_ephemere (authenticated
-- seul, jamais anon — qui peut générer un lien peut le relire).
--
-- INVARIANT RELAIS (vérifié dans C12-f) : generer_lien_ephemere pose
-- revoque=TRUE sur tous les 'saisie' actifs de la rencontre avant
-- d'insérer le nouveau. Il y a donc AU PLUS UN lien 'saisie' non
-- révoqué non expiré par rencontre, par construction. Le
-- ORDER BY date_creation DESC LIMIT 1 est défensif (robustesse), pas
-- une résolution d'ambiguïté : il n'y a pas d'ambiguïté.
--
-- Objet A est déjà conçu pour réafficher un lien si on lui en fournit
-- un (état 3) → AUCUNE retouche logique d'Objet A : il suffira
-- d'alimenter l'état 3 depuis cette RPC.
--
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RPC : dernier lien 'saisie' actif d'une rencontre (coach Hub)
--   Renvoie 0 ou 1 ligne (0 = aucun lien saisie actif → Objet A
--   reste/retombe à l'état 2 « générer », ce qui est correct).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_lien_saisie_actif(
    p_evenement_uuid UUID
) RETURNS TABLE (
    token         TEXT,
    expire_le     TIMESTAMPTZ,
    date_creation TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT ls.token, ls.expire_le, ls.date_creation
    FROM   lien_suivi ls
    WHERE  ls.evenement_uuid = p_evenement_uuid
      AND  ls.role     = 'saisie'
      AND  ls.revoque  = FALSE
      AND  ls.expire_le > NOW()
    ORDER  BY ls.date_creation DESC
    LIMIT  1;
END;
$$;

-- ---------------------------------------------------------------------
-- Surface d'accès — même posture que generer_lien_ephemere :
-- authenticated SEUL (jamais anon ; le porteur d'un lien anonyme ne
-- doit pas pouvoir relire/pêcher le jeton de saisie). Table fermée.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION get_lien_saisie_actif(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_lien_saisie_actif(UUID) TO authenticated;

-- =====================================================================
-- FIN C12-h. SUIVI-COACH-2 livrée (event-bornée authentifiée ; volet
-- jeton rejeté pour sécurité, motivé ci-dessus). Reste de ce couloir :
-- SUIVI-UI-5 — EN ATTENTE de sql/C12-e-*.sql à la source (signature +
-- corps réels de consolider_score_rencontre, à ne pas inventer).
-- =====================================================================
