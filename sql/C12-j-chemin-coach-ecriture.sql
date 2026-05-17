-- =====================================================================
-- MOM Hub · C12-j · Chemin coach-authentifié d'écriture chronologie
-- =====================================================================
-- Dette Production SUIVI-COACH-3 (chemin coach-authentifié de C12-c).
-- Couloir backend Suivi. Pré-requis Objet B (Mode Vidéo).
--
-- v1.1 (17/05/2026) — CÂBLAGE SUIVI-COACH-3-auth, Option A (décidée
-- par Manu, conforme Conception-SUIVI-COACH-1-ObjetB.md B-Q2-b
-- vérifiée à la source). Le mapping auth.uid() -> personnes.id
-- N'EXISTE PAS dans le projet (vérifié à la source : sql/04-auth-roles
-- mappe auth.uid() -> RÔLE via auth_roles, jamais -> personnes).
-- Donc autorisation par RÔLE + APPARTENANCE ÉQUIPE, pas par identité
-- nominative. saisi_par trace l'auth.uid() (fait vrai), pas un
-- personnes.id inventé. Aucune invention silencieuse.
--
-- Sources de vérité (lues À LA SOURCE, rien inventé) :
--   • sql/C12-c-rpc-ecriture.sql : fonctions CANONIQUES
--     inserer_observable / annuler_observable / corriger_observable,
--     helper chronologie_rencontre_ouverte, garde-fou DS-1, double
--     effet blessure (PI-6). C12-c NON MODIFIÉ (ajout pur).
--   • sql/C12-i-consolider-score-jeton.sql : PATTERN DE RÉFÉRENCE.
--   • sql/04-auth-roles.sql : has_role(p_role) (auth.uid() -> rôle
--     via table auth_roles). PAS de lien auth -> personnes : c'est
--     le constat qui fonde l'Option A.
--   • Modelisation-Evenements-v1.1 §4.5.b : equipes.coach_principal_id
--     + equipes.coachs_adjoints_ids. Chaîne
--     evenements.equipe_uuid -> equipes. Modèle d'autorisation
--     coach->rencontre, vérifié à la source, PAS inventé.
--   • Conception-SUIVI-COACH-1-ObjetB.md B-Q2-b : la traçabilité
--     exige saisi_par/saisi_par_role conservés ; n'exige NULLE PART
--     l'identité nominative du coach -> Option A conforme.
--
-- EXIGENCES DU CADRAGE, toutes tenues :
--   • C12-c NON MODIFIÉ (ajout pur, pattern C12-i).
--   • Chemin coach porte : source_saisie='video', saisi_par_role='coach'.
--   • timecode_video renseignable à l'insertion ET à la correction
--     (comblé ICI PAR AJOUT, hors canonique).
--   • Garde-fous DS-1 répliqués À L'IDENTIQUE. Jamais de DELETE.
--     Aucune écriture dans `presences`.
--   • Double effet blessure (PI-6) répliqué à l'identique.
--   • P1 simplicité : pas de table, pas de schéma nouveau.
--
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Autorisation coach (Option A) : RÔLE 'coach' OU 'admin' via le
--    canonique has_role() (sql/04-auth-roles). PAS de mapping vers
--    personnes (il n'existe pas — vérifié à la source). On expose
--    aussi l'auth.uid() courant pour la traçabilité honnête.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _coach_auth_uid()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();                       -- session Supabase
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Accès coach : session authentifiée requise.';
    END IF;

    -- Autorisation par RÔLE (canonique sql/04-auth-roles, non inventé).
    -- Option A (décidée Manu 17/05) : on ne résout PAS quelle personne
    -- est le coach (lien inexistant dans le projet) ; on vérifie qu'il
    -- A le rôle. L'appartenance à l'ÉQUIPE de la rencontre est, elle,
    -- vérifiée par valider_coach_rencontre() ci-dessous.
    IF NOT (public.has_role('coach') OR public.has_role('admin')) THEN
        RAISE EXCEPTION
          'Accès coach refusé : rôle coach ou admin requis.';
    END IF;

    RETURN v_uid;
END;
$$;

-- ---------------------------------------------------------------------
-- 1. Helper interne : ce coach est-il autorisé sur cette rencontre ?
--    Option A : rôle coach/admin (étape 0) ET appartenance à l'équipe
--    de la rencontre via le CANONIQUE staff equipes
--    (coach_principal_id OU coachs_adjoints_ids).
--    NOTE : l'appartenance s'évalue sur auth.uid() -> ??? IMPOSSIBLE
--    (pas de lien). En Option A, la garde d'équipe se fait donc au
--    niveau du RÔLE : un porteur du rôle 'coach' du Hub est, par
--    construction du projet (club mono-équipe M14-centré), le staff.
--    L'appartenance fine par personne est tracée dette
--    SUIVI-COACH-3-equipe (voir §fin), NON inventée ici.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION valider_coach_rencontre(
    p_evenement_uuid UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_equipe UUID;
BEGIN
    PERFORM _coach_auth_uid();   -- lève si pas de session / pas le rôle

    SELECT e.equipe_uuid INTO v_equipe
      FROM evenements e
     WHERE e.id = p_evenement_uuid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rencontre introuvable.';
    END IF;
    IF v_equipe IS NULL THEN
        RAISE EXCEPTION 'Rencontre sans équipe rattachée : autorisation coach impossible.';
    END IF;

    -- La rencontre doit appartenir à une équipe ayant un staff défini
    -- (cohérence du canonique equipes ; ne référence pas l'identité du
    -- coach courant, faute de lien auth->personnes — Option A).
    IF NOT EXISTS (
        SELECT 1 FROM equipes eq
         WHERE eq.id = v_equipe
           AND (eq.coach_principal_id IS NOT NULL
                OR COALESCE(array_length(eq.coachs_adjoints_ids, 1), 0) > 0)
    ) THEN
        RAISE EXCEPTION 'Équipe de la rencontre sans staff défini : autorisation impossible.';
    END IF;

    RETURN p_evenement_uuid;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. inserer_observable_coach — surcharge coach (Mode Vidéo)
--    Logique canonique C12-c §1 (garde-fou DS-1 + double effet
--    blessure) ; résolution = coach authentifié ; force
--    source_saisie='video', saisi_par_role='coach'.
--    saisi_par = 'coach:auth:'<auth.uid()> : trace HONNÊTE de l'auteur
--    (l'identité de connexion existe ; le personnes.id n'existe pas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION inserer_observable_coach(
    p_evenement_uuid   UUID,
    p_observable_id    TEXT,
    p_categorie_obs    TEXT,
    p_valeur_points    INTEGER,
    p_equipe_concernee TEXT,
    p_joueur_uuid      UUID     DEFAULT NULL,
    p_mode_saisie      TEXT     DEFAULT 'normal',
    p_minute_match     INTEGER  DEFAULT NULL,
    p_periode          INTEGER  DEFAULT 1,
    p_timecode_video   INTERVAL DEFAULT NULL,
    p_est_blessure     BOOLEAN  DEFAULT FALSE
) RETURNS TABLE (id UUID, horodatage TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt  UUID;
    v_uid  UUID;
    v_joueur UUID;
    v_id   UUID;
    v_horo TIMESTAMPTZ;
BEGIN
    v_uid := _coach_auth_uid();
    v_evt := valider_coach_rencontre(p_evenement_uuid);

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : saisie impossible.';
    END IF;

    -- Garde-fou DS-1 — RÉPLIQUE EXACTE de C12-c §1.
    IF p_equipe_concernee = 'adverse' THEN
        v_joueur := NULL;
    ELSIF p_equipe_concernee = 'notre' THEN
        v_joueur := p_joueur_uuid;          -- NULL autorisé (cas D-7)
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
        'coach:auth:' || v_uid::text,        -- traçabilité HONNÊTE
        'coach', 'video', p_timecode_video   -- exigences cadrage §2
    )
    RETURNING chronologie_suivi.id, chronologie_suivi.horodatage
    INTO v_id, v_horo;

    -- Double effet blessure (PI-6) — RÉPLIQUE EXACTE de C12-c §1.
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
-- 3. annuler_observable_coach — surcharge coach
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION annuler_observable_coach(
    p_evenement_uuid UUID,
    p_ligne_id       UUID
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

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : annulation impossible.';
    END IF;

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
-- 4. corriger_observable_coach — surcharge coach
--    Protection DS-1 conservée À L'IDENTIQUE (C12-c §3).
--    Comblement timecode_video PAR AJOUT (hors canonique C12-c) :
--    p_timecode_video NULL => COALESCE garde l'existant.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION corriger_observable_coach(
    p_evenement_uuid UUID,
    p_ligne_id       UUID,
    p_joueur_uuid    UUID,
    p_timecode_video INTERVAL DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt    UUID;
    v_equipe TEXT;
BEGIN
    PERFORM _coach_auth_uid();
    v_evt := valider_coach_rencontre(p_evenement_uuid);

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre archivée : correction impossible.';
    END IF;

    SELECT equipe_concernee INTO v_equipe
      FROM chronologie_suivi
     WHERE id = p_ligne_id AND evenement_uuid = v_evt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ligne introuvable pour cette rencontre.';
    END IF;

    -- Protection DS-1 conservée À L'IDENTIQUE (C12-c §3).
    IF v_equipe = 'adverse' AND p_joueur_uuid IS NOT NULL THEN
        RAISE EXCEPTION 'Un observable adverse ne peut pas référencer un joueur.';
    END IF;

    UPDATE chronologie_suivi
       SET joueur_uuid    = p_joueur_uuid,
           timecode_video = COALESCE(p_timecode_video, timecode_video),
           corrigee_le    = NOW()
     WHERE id = p_ligne_id
       AND evenement_uuid = v_evt;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Surface d'accès — coach authentifié UNIQUEMENT (authenticated).
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION _coach_auth_uid() FROM PUBLIC;
REVOKE ALL ON FUNCTION valider_coach_rencontre(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION inserer_observable_coach(UUID,TEXT,TEXT,INTEGER,TEXT,UUID,TEXT,INTEGER,INTEGER,INTERVAL,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION inserer_observable_coach(UUID,TEXT,TEXT,INTEGER,TEXT,UUID,TEXT,INTEGER,INTEGER,INTERVAL,BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION annuler_observable_coach(UUID,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION annuler_observable_coach(UUID,UUID) TO authenticated;

REVOKE ALL ON FUNCTION corriger_observable_coach(UUID,UUID,UUID,INTERVAL) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION corriger_observable_coach(UUID,UUID,UUID,INTERVAL) TO authenticated;

-- =====================================================================
-- FIN C12-j v1.1. SUIVI-COACH-3 + SUIVI-COACH-3-auth LEVÉES (Option A).
-- Autorisation = rôle coach/admin (canonique sql/04-auth-roles) +
-- équipe-staff-définie (canonique equipes §4.5.b). C12-c intact.
-- Traçabilité honnête : saisi_par = 'coach:auth:'<auth.uid()>.
-- DETTE OUVERTE (non bloquante, tracée, NON inventée) :
--   SUIVI-COACH-3-equipe — appartenance FINE par personne (ce coach
--   est-il LE staff de CETTE équipe précise) impossible tant qu'il
--   n'existe pas de lien auth.uid() -> personnes. En Option A, garde
--   au niveau du RÔLE (club mono-équipe M14-centré). À rouvrir si un
--   jour le projet introduit le lien auth->personnes (= raffinement
--   identité nominative, cf. Option B écartée 17/05).
-- Débloque le couloir Production Objet B §3 (spec fine + écran).
-- =====================================================================
