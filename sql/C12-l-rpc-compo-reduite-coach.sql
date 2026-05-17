-- =====================================================================
-- MOM Hub · C12-l · Chemin coach-authentifié de COMPO RÉDUITE
-- =====================================================================
-- Dette Production SUIVI-COACH-5 (chemin coach-authentifié de la
-- compo réduite — jumelle COMPO de la lignée C12-d -> C12-k).
-- Couloir backend Suivi. Pré-requis Objet B (Mode Vidéo, livré v0.1
-- avec picker joueur honnêtement dégradé : cette dette le lève).
--
-- POURQUOI CE FICHIER (réconciliation doctrinale) :
-- Le cycle SUIVI-COACH-1 a tracé l'écriture coach (C12-c jeton-seul
-- -> SUIVI-COACH-3 -> C12-j) puis la lecture chronologie coach
-- (C12-d jeton-seul -> SUIVI-COACH-4 -> C12-k). Il n'a PAS tracé le
-- 3e angle mort, symétrique : la COMPO RÉDUITE. Vérification À LA
-- SOURCE de sql/C12-f §5 : get_compo_reduite_rencontre(p_token) est
-- JETON-SEUL (valider_lien_suivi(p_token, NULL)). Une session coach
-- Supabase tourne en rôle 'authenticated' SANS jeton bénévole -> elle
-- ne peut PAS relire la compo réduite. Conséquence dans Objet B
-- (mode-video.js v0.1) : réattribution/attribution à un joueur NOMMÉ,
-- ajout ADVERSE et saisie TIMECODE bornés (UI honnêtement dégradée,
-- boutons désactivés+étiquetés, jamais de trou silencieux). C12-l
-- comble ce trou, jumelle COMPO exacte de SUIVI-COACH-3/4.
--
-- v1.0 (17/05/2026) — pattern STRICTEMENT C12-k (lui-même calqué sur
-- C12-j). Autorisation Option A par RÔLE coach/admin + équipe-staff :
-- on RÉUTILISE TELS QUELS les helpers canoniques déjà livrés par
-- C12-j v1.1 (_coach_auth_uid + valider_coach_rencontre). Aucun
-- nouveau modèle d'autorisation, aucune duplication (P1 simplicité).
-- Le mapping auth.uid()->personnes n'existe toujours pas (constat
-- C12-j v1.1, inchangé) : la compo réduite ne porte aucune identité
-- nominative au-delà du nom_court RGPD-safe -> Option A conforme,
-- aucune invention.
--
-- Sources de vérité (lues À LA SOURCE, rien inventé) :
--   • sql/C12-f-lien-ephemere.sql §5 : CONTRAT DE PAYLOAD CANONIQUE
--     get_compo_reduite_rencontre — 6 colonnes (joueur_uuid,
--     numero_maillot, poste_uuid, role, etat_joueur, nom_court),
--     noms/types/ordre exacts ; helper chronologie_nom_court_personne ;
--     filtre cote='mom' AND etat='validee' AND est_active=TRUE ;
--     ORDER BY numero_maillot NULLS LAST. C12-f NON MODIFIÉ (ajout
--     pur, exactement comme C12-k n'a pas touché C12-d / C12-j n'a
--     pas touché C12-c).
--   • sql/C12-j-chemin-coach-ecriture.sql v1.1 : helpers
--     d'autorisation _coach_auth_uid() + valider_coach_rencontre(
--     p_evenement_uuid) (Option A : rôle coach/admin via has_role
--     canonique sql/04-auth-roles + équipe-staff via equipes §4.5.b).
--     RÉUTILISÉS, pas réécrits. PATTERN DE RÉFÉRENCE de ce fichier.
--   • sql/C12-k-rpc-lecture-coach.sql : le patron EXACT reproduit
--     ici (jumelle lecture coach, ajout pur, payload contrat-
--     identique, helpers C12-j réutilisés, authenticated seul).
--   • Conception-SUIVI-COACH-1-ObjetB.md : la compo réduite alimente
--     le picker joueur ; le contrat attendu par mode-video.js est
--     EXACTEMENT celui de get_compo_reduite_rencontre (règle unique
--     libelleJoueurSuivi). Pas deux vérités, une seule (PI-5).
--
-- EXIGENCES, toutes tenues :
--   • C12-f NON MODIFIÉ (ajout pur, pattern C12-k/C12-j/C12-i).
--   • Payload RIGOUREUSEMENT identique à get_compo_reduite_rencontre :
--     6 colonnes, mêmes noms, mêmes types, même ordre, même nom_court
--     via le même helper, même filtre compo validee active, même tri
--     numero_maillot NULLS LAST. AUCUNE divergence de contrat (le
--     client consomme indifféremment le chemin jeton ou le chemin
--     coach -> P6 tenu : on clone le contrat réduit, on n'enrichit
--     rien).
--   • PAS de garde « rencontre ouverte » : la LECTURE compo n'est
--     jamais gatée par l'état (get_compo_reduite_rencontre ne l'est
--     pas non plus ; cohérent C12-d/C12-k ; seules les écritures
--     C12-j le sont). Le coach doit pouvoir relire la compo quel que
--     soit l'état de la rencontre.
--   • GRANT authenticated SEUL, jamais anon (posture C12-k/C12-j :
--     un chemin coach est authentifié par nature ; le chemin
--     anon+jeton reste get_compo_reduite_rencontre / C12-f, 100 %
--     intact).
--   • Idempotent (CREATE OR REPLACE).
--
-- EFFET DE BORD : NÉANT. C12-f, C12-j, C12-k, le module bénévole,
-- Objet A ne sont pas touchés (ajout pur). chronologie_nom_court_
-- personne reste la dette C12-nom inchangée (nom_court PEUT être
-- NULL -> libelleJoueurSuivi() côté client dégrade déjà proprement,
-- numéro = ancre).
-- =====================================================================

-- ---------------------------------------------------------------------
-- get_compo_reduite_rencontre_coach — surcharge coach (Mode Vidéo)
--   Lecture seule. Résolution = coach authentifié (helpers C12-j v1.1)
--   au lieu du jeton. Payload = clone EXACT du contrat C12-f §5.
--   Aucune logique métier ré-implémentée : seule la brique
--   d'AUTORISATION diffère (jeton -> rôle+équipe Option A).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_compo_reduite_rencontre_coach(
    p_evenement_uuid UUID
) RETURNS TABLE (
    joueur_uuid    UUID,
    numero_maillot INTEGER,
    poste_uuid     TEXT,
    role           TEXT,
    etat_joueur    TEXT,
    nom_court      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    -- Autorisation Option A — helpers canoniques C12-j v1.1 RÉUTILISÉS.
    -- valider_coach_rencontre() lève si pas de session / pas le rôle
    -- coach|admin / rencontre introuvable / équipe sans staff défini.
    -- (PERFORM _coach_auth_uid() explicite = forme exacte de
    --  get_chronologie_rencontre_coach dans C12-k, l'op coach sans uid.)
    PERFORM _coach_auth_uid();
    v_evt := valider_coach_rencontre(p_evenement_uuid);

    -- Projection RIGOUREUSEMENT identique à get_compo_reduite_rencontre
    -- (C12-f §5). Aucune divergence de contrat : le client consomme le
    -- chemin jeton ou le chemin coach indifféremment (même payload
    -- réduit, une seule vérité — PI-5 ; P6 : on ne ré-ajoute rien).
    -- PAS de garde « rencontre ouverte » : la lecture compo n'est
    -- jamais gatée par l'état (cohérent C12-f/C12-d/C12-k).
    RETURN QUERY
    SELECT cj.joueur_uuid,
           cj.numero_maillot,
           cj.poste_uuid,
           cj.role,
           cj.etat_joueur,
           chronologie_nom_court_personne(cj.joueur_uuid)
    FROM   composition_joueurs cj
    JOIN   compositions c ON c.id = cj.composition_uuid
    WHERE  c.evenement_uuid = v_evt
      AND  c.cote = 'mom'
      AND  c.etat = 'validee'
      AND  c.est_active = TRUE
    ORDER BY cj.numero_maillot NULLS LAST;   -- identique C12-f §5
END;
$$;

-- ---------------------------------------------------------------------
-- Surface d'accès — coach authentifié UNIQUEMENT (authenticated).
-- Jamais anon : le chemin anon+jeton reste get_compo_reduite_rencontre
-- (C12-f), 100 % intact. Posture grant = C12-k/C12-j (chemin coach
-- authentifié par nature).
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION get_compo_reduite_rencontre_coach(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_compo_reduite_rencontre_coach(UUID) TO authenticated;

-- =====================================================================
-- FIN C12-l v1.0. SUIVI-COACH-5 LEVÉE (compo réduite coach, jumelle
-- COMPO de SUIVI-COACH-3/C12-j et SUIVI-COACH-4/C12-k). C12-f intact.
-- Payload contrat-identique à get_compo_reduite_rencontre (6 colonnes).
-- Autorisation = helpers canoniques C12-j v1.1 réutilisés (Option A,
-- rôle coach/admin + équipe-staff). GRANT authenticated seul.
-- Hérite la dette C12-nom (chronologie_nom_court_personne) — inchangée,
-- non bloquante (libelleJoueurSuivi() dégrade déjà côté client).
-- ---------------------------------------------------------------------
-- AVAL (HORS couloir backend — passation de sortie, NON codé ici) :
--   1. js/supabase-client.js v1.15 -> v1.16 : UN wrapper
--      getCompoReduiteRencontreCoach, sur le patron EXACT des wrappers
--      coach v1.15 (C12-j/k/e), ajout pur.
--   2. js/mode-video.js : activer le picker joueur (lève la
--      dégradation Objet B — réattribution nommée + ajout ADVERSE +
--      timecode), précédent A-Q4.
--   Ces 2 étapes = couloir Production écran, PAS ce couloir backend.
-- =====================================================================
