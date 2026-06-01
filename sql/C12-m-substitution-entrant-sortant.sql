-- =====================================================================
-- MOM Hub · C12-m · Substitution entrant + sortant (temps de jeu fiable)
-- =====================================================================
-- Chantier : Refonte UX Suivi — suivi live éducateur seul, décision D9
--   (Conception-Suivi-Live-Educateur-Seul-v1.md).
-- Objet : fiabiliser le calcul du temps de jeu par joueur en stockant,
--   pour une substitution, LE JOUEUR ENTRANT en plus du joueur sortant
--   et de la minute (déjà portés par joueur_uuid + minute_match).
--   Lève la dette SUIVI-COACH-7 (substitution mono-ligne).
--
-- DOCTRINE — AJOUT PUR. Rien d'existant n'est supprimé ni réinterprété :
--   • chronologie_suivi : 1 colonne nullable AJOUTÉE (joueur_uuid_entrant).
--     Toutes les lignes existantes restent valides (colonne = NULL).
--   • inserer_observable (C12-c) : 1 paramètre optionnel AJOUTÉ en fin de
--     signature (p_joueur_uuid_entrant). La signature historique reste
--     appelable telle quelle (DEFAULT NULL). Corps inchangé hors l'ajout
--     du nouveau champ à l'INSERT. Garde DS-1, double-effet blessure,
--     bypass smoke-test : INCHANGÉS.
--   • get_chronologie_rencontre (C12-d) & _coach (C12-k) : 2 colonnes
--     AJOUTÉES au payload (joueur_uuid_entrant + nom_court_entrant), au
--     MÊME endroit dans les DEUX (contrat-jumeau C12-d ≡ C12-k préservé,
--     PI-5). Reste du contrat et de la projection : byte-identique.
--
-- Convention de stockage d'une SUBSTITUTION (option 2, ligne enrichie) :
--   joueur_uuid          = joueur SORTANT
--   joueur_uuid_entrant  = joueur ENTRANT
--   minute_match         = minute de la substitution
--   Une substitution = UNE ligne atomique (annulation/correction = 1 ligne).
--   Pour tout autre observable, joueur_uuid_entrant reste NULL.
--
-- Le nouveau nom court réutilise chronologie_nom_court_personne : il
--   hérite donc de la dette C12-nom (nom_court PEUT être NULL tant que
--   le helper n'est pas câblé sur `personnes`) — cohérent avec joueur_uuid.
--
-- Pré-requis : C12-a (table), C12-c, C12-d, C12-k, C12-f (helper nom court).
-- Idempotent : ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Colonne joueur entrant (ajout pur, nullable, sans défaut)
-- ---------------------------------------------------------------------
ALTER TABLE chronologie_suivi
    ADD COLUMN IF NOT EXISTS joueur_uuid_entrant UUID;

COMMENT ON COLUMN chronologie_suivi.joueur_uuid_entrant IS
    'Joueur ENTRANT d''une substitution (joueur_uuid = sortant). NULL pour tout autre observable. Ajout C12-m (temps de jeu fiable, D9, lève SUIVI-COACH-7).';

-- ---------------------------------------------------------------------
-- 2. inserer_observable — +1 paramètre optionnel p_joueur_uuid_entrant
--    Corps reproduit à l'identique de C12-c ; seuls changements :
--    le paramètre, sa résolution (garde DS-1 symétrique), la colonne
--    à l'INSERT. Tout le reste byte-identique.
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
    p_evenement_uuid  UUID    DEFAULT NULL,
    -- C12-m : joueur ENTRANT d'une substitution (optionnel, fin de signature)
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
        v_joueur      := NULL;
        v_joueur_entr := NULL;                -- C12-m : pas de joueur côté adverse
    ELSIF p_equipe_concernee = 'notre' THEN
        v_joueur      := p_joueur_uuid;       -- peut être NULL : OK (DS-1)
        v_joueur_entr := p_joueur_uuid_entrant; -- C12-m : NULL hors substitution
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
        p_token, p_saisi_par_role, p_source_saisie, p_timecode_video
    )
    RETURNING chronologie_suivi.id, chronologie_suivi.horodatage
    INTO v_id, v_horo;

    -- Double effet « blessure » (PI-6, modélisation §7) :
    -- la SEULE écriture remontante. Constat, jamais recomposition.
    -- INCHANGÉ vs C12-c. (Le blessé est joueur_uuid ; un entrant
    -- éventuel n'est pas le sujet de la blessure.)
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

-- Surface d'accès : INCHANGÉE (anon + authenticated, comme C12-c).
-- La nouvelle signature 15-arg coexiste ; les anciens appels 14-arg
-- restent valides (p_joueur_uuid_entrant DEFAULT NULL).
REVOKE ALL ON FUNCTION inserer_observable(
    TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, INTEGER, INTEGER,
    TEXT, TEXT, INTERVAL, BOOLEAN, UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION inserer_observable(
    TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, INTEGER, INTEGER,
    TEXT, TEXT, INTERVAL, BOOLEAN, UUID, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. get_chronologie_rencontre (C12-d) — +2 colonnes au payload
--    Projection reproduite à l'identique ; seul ajout :
--    joueur_uuid_entrant + nom_court_entrant, après nom_court.
--    DROP requis : le RETURNS TABLE change (PG refuse CREATE OR REPLACE
--    sur changement de type de retour). Même signature d'ARGUMENTS, donc
--    aucun appelant ne casse ; les GRANT plus bas reposent les droits.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_chronologie_rencontre(TEXT, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION get_chronologie_rencontre(
    p_token             TEXT,
    p_inclure_annulees  BOOLEAN DEFAULT FALSE,
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
    nom_court       TEXT,
    joueur_uuid_entrant UUID,          -- C12-m
    nom_court_entrant   TEXT,          -- C12-m (même helper, même dette C12-nom)
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
        v_evt := valider_lien_suivi(p_token, NULL);
    ELSIF session_user IN ('postgres', 'supabase_admin')
          AND p_evenement_uuid IS NOT NULL THEN
        v_evt := p_evenement_uuid;
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
            cs.joueur_uuid_entrant,
            chronologie_nom_court_personne(cs.joueur_uuid_entrant),
            cs.saisi_par_role,
            cs.source_saisie,
            cs.timecode_video,
            cs.annule
    FROM    chronologie_suivi cs
    WHERE   cs.evenement_uuid = v_evt
      AND   (p_inclure_annulees OR cs.annule = FALSE)
    ORDER BY cs.horodatage ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_chronologie_rencontre(TEXT, BOOLEAN, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_chronologie_rencontre(TEXT, BOOLEAN, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. get_chronologie_rencontre_coach (C12-k) — +2 colonnes IDENTIQUES
--    Contrat-jumeau C12-d ≡ C12-k strictement préservé (PI-5).
--    DROP requis (même raison qu'au §3 : RETURNS TABLE change).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_chronologie_rencontre_coach(UUID, BOOLEAN);

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
    nom_court       TEXT,
    joueur_uuid_entrant UUID,          -- C12-m
    nom_court_entrant   TEXT,          -- C12-m
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
    PERFORM _coach_auth_uid();
    v_evt := valider_coach_rencontre(p_evenement_uuid);

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
            cs.joueur_uuid_entrant,
            chronologie_nom_court_personne(cs.joueur_uuid_entrant),
            cs.saisi_par_role,
            cs.source_saisie,
            cs.timecode_video,
            cs.annule
    FROM    chronologie_suivi cs
    WHERE   cs.evenement_uuid = v_evt
      AND   (p_inclure_annulees OR cs.annule = FALSE)
    ORDER BY cs.horodatage ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_chronologie_rencontre_coach(UUID, BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_chronologie_rencontre_coach(UUID, BOOLEAN) TO authenticated;

COMMIT;

-- =====================================================================
-- FIN C12-m. SUIVI-COACH-7 levée côté STOCKAGE (substitution = entrant +
-- sortant + minute, atomique). C12-c/d/k enrichis par AJOUT PUR ; aucune
-- signature historique cassée (paramètre/colonnes ajoutés). Contrat-jumeau
-- C12-d ≡ C12-k préservé. Hérite la dette C12-nom (nom courts via le même
-- helper). RESTE À FAIRE (front + couche données) : transmettre
-- p_joueur_uuid_entrant à la saisie de substitution et consommer
-- joueur_uuid_entrant / nom_court_entrant dans temps-de-jeu.js.
-- =====================================================================
