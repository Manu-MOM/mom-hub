-- =====================================================================
-- MOM Hub · C12-k · Chemin coach-authentifié de LECTURE chronologie
-- =====================================================================
-- Dette Production SUIVI-COACH-4 (chemin coach-authentifié de C12-d).
-- Couloir backend Suivi. Pré-requis Objet B (Mode Vidéo).
--
-- POURQUOI CE FICHIER (réconciliation doctrinale, §4 bis r.9) :
-- Le cycle SUIVI-COACH-1 avait tracé la réserve d'ÉCRITURE coach
-- (C12-c jeton-seul -> SUIVI-COACH-3 -> sql/C12-j). Il n'a JAMAIS
-- tracé l'équivalent en LECTURE : Cadrage et STATE présumaient
-- « backend B entièrement tombé ». Vérification À LA SOURCE de
-- sql/C12-d (get_chronologie_rencontre) : FAUX pour la lecture.
-- C12-d n'autorise que (a) un jeton 'saisie'|'spectateur' via
-- valider_lien_suivi, ou (b) un bypass smoke-test verrouillé à
-- session_user IN ('postgres','supabase_admin'). Une session coach
-- Supabase tourne en rôle 'authenticated' (PostgREST), JAMAIS
-- 'postgres' -> elle tombe dans le ELSE -> RAISE 'Jeton requis.'.
-- Le GRANT ... TO authenticated et le commentaire « + coach
-- authentifié » de C12-d décrivent la SURFACE, pas le CORPS : aucune
-- branche auth.uid()/has_role n'y est implémentée (contrairement à
-- C12-j côté écriture). Mode Vidéo = coach SANS jeton -> il ne peut
-- pas lire la chronologie. SUIVI-COACH-4 comble ce trou, jumelle
-- LECTURE exacte de SUIVI-COACH-3.
--
-- v1.0 (17/05/2026) — pattern strictement C12-j (décidé par Manu,
-- « go SUIVI-COACH-4 »). Autorisation Option A par RÔLE coach/admin
-- + équipe-staff-définie : on RÉUTILISE TELS QUELS les helpers
-- canoniques déjà livrés par C12-j (_coach_auth_uid +
-- valider_coach_rencontre). Aucun nouveau modèle d'autorisation,
-- aucune duplication (P1 simplicité). Le mapping auth.uid()->
-- personnes n'existe toujours pas (constat C12-j, inchangé) : la
-- lecture ne porte aucune identité nominative -> Option A conforme,
-- aucune invention.
--
-- Sources de vérité (lues À LA SOURCE, rien inventé) :
--   • sql/C12-d-rpc-lecture.sql : CONTRAT DE PAYLOAD CANONIQUE
--     (15 colonnes, noms/types/ordre exacts), helper
--     chronologie_nom_court_personne, filtre p_inclure_annulees,
--     ORDER BY horodatage ASC. C12-d NON MODIFIÉ (ajout pur,
--     exactement comme C12-j n'a pas touché C12-c).
--   • sql/C12-j-chemin-coach-ecriture.sql : helpers d'autorisation
--     _coach_auth_uid() + valider_coach_rencontre(p_evenement_uuid)
--     (Option A : rôle coach/admin via has_role canonique
--     sql/04-auth-roles + équipe-staff via equipes §4.5.b).
--     RÉUTILISÉS, pas réécrits. PATTERN DE RÉFÉRENCE de ce fichier.
--   • sql/C12-a-chronologie_suivi.sql : schéma réel de la table
--     (colonnes source_saisie / timecode_video / mode_saisie / annule
--     présentes -> B-Q2 provenance & B-Q4 timecode satisfaisables
--     SANS ajout de colonne ; seule l'autorisation manquait).
--   • Conception-SUIVI-COACH-1-ObjetB.md B-Q2(a)/B-Q4 : une seule
--     chronologie, provenance source_saisie visible, timecode_video
--     factuel. La lecture coach renvoie EXACTEMENT le même payload
--     que le bénévole : pas deux vérités, une seule (PI-5).
--
-- EXIGENCES, toutes tenues :
--   • C12-d NON MODIFIÉ (ajout pur, pattern C12-j/C12-i).
--   • Payload RIGOUREUSEMENT identique à C12-d : 15 colonnes, mêmes
--     noms, mêmes types, même ordre, même nom_court via le même
--     helper, même tri horodatage ASC, même sémantique
--     p_inclure_annulees. AUCUNE divergence de contrat (le client
--     consomme indifféremment C12-d ou C12-k).
--   • PAS de garde « rencontre ouverte » : la LECTURE n'est jamais
--     gatée par l'état (C12-d ne l'est pas non plus ; seules les
--     écritures C12-j le sont). Le coach doit pouvoir RELIRE une
--     rencontre quel que soit son état.
--   • GRANT authenticated SEUL, jamais anon (posture C12-j : un
--     chemin coach est authentifié par nature ; le chemin anon+jeton
--     reste C12-d, 100 % intact).
--   • Idempotent (CREATE OR REPLACE).
--
-- EFFET DE BORD : NÉANT. C12-d, C12-j, le module bénévole, Objet A
-- ne sont pas touchés (ajout pur). chronologie_nom_court_personne
-- reste la dette C12-nom inchangée (nom_court PEUT être NULL ->
-- libelleJoueur() côté client dégrade déjà proprement).
-- =====================================================================

-- ---------------------------------------------------------------------
-- get_chronologie_rencontre_coach — surcharge coach (Mode Vidéo)
--   Lecture seule. Résolution = coach authentifié (helpers C12-j) au
--   lieu du jeton. Payload = clone exact du contrat C12-d (§6.3 de la
--   modélisation). Aucune logique métier ré-implémentée : seule la
--   brique d'AUTORISATION diffère (jeton -> rôle+équipe Option A).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_chronologie_rencontre_coach(
    p_evenement_uuid    UUID,
    p_inclure_annulees  BOOLEAN DEFAULT FALSE
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
    -- Autorisation Option A — helpers canoniques C12-j RÉUTILISÉS.
    -- valider_coach_rencontre() lève si pas de session / pas le rôle
    -- coach|admin / rencontre introuvable / équipe sans staff défini.
    -- (PERFORM _coach_auth_uid() explicite = forme exacte de
    --  annuler_observable_coach dans C12-j, l'op coach sans uid.)
    PERFORM _coach_auth_uid();
    v_evt := valider_coach_rencontre(p_evenement_uuid);

    -- Projection RIGOUREUSEMENT identique à C12-d (§6.3). Aucune
    -- divergence de contrat : le client consomme C12-d ou C12-k
    -- indifféremment (même payload, une seule vérité — PI-5).
    -- PAS de garde « rencontre ouverte » : la lecture n'est jamais
    -- gatée par l'état (cohérent C12-d).
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
    ORDER BY cs.horodatage ASC;     -- ordre de jeu (§6.3, identique C12-d)
END;
$$;

-- ---------------------------------------------------------------------
-- Surface d'accès — coach authentifié UNIQUEMENT (authenticated).
-- Jamais anon : le chemin anon+jeton reste C12-d, 100 % intact.
-- Posture grant = C12-j (chemin coach authentifié par nature).
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION get_chronologie_rencontre_coach(UUID, BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_chronologie_rencontre_coach(UUID, BOOLEAN) TO authenticated;

-- =====================================================================
-- FIN C12-k v1.0. SUIVI-COACH-4 LEVÉE (lecture coach, jumelle de
-- SUIVI-COACH-3/C12-j). C12-d intact. Payload contrat-identique à
-- C12-d. Autorisation = helpers canoniques C12-j réutilisés (Option A,
-- rôle coach/admin + équipe-staff). GRANT authenticated seul.
-- Hérite la dette C12-nom (chronologie_nom_court_personne) — inchangée,
-- non bloquante (libelleJoueur() dégrade déjà côté client).
-- Débloque le couloir Production Objet B : le cerveau mode-video.js
-- peut désormais CHARGER la chronologie (C12-k), la CORRIGER/COMPLÉTER
-- (C12-j) et RE-CONSOLIDER le score (C12-e 2-arg, p_token NULL).
-- =====================================================================
