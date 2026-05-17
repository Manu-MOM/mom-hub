-- =====================================================================
-- MOM Hub · C12-j · Chemin coach-authentifié d'écriture chronologie
-- =====================================================================
-- Dette Production SUIVI-COACH-3 (chemin coach-authentifié de C12-c).
-- Couloir backend Suivi. Pré-requis Objet B (Mode Vidéo).
--
-- Sources de vérité (lues À LA SOURCE, rien inventé) :
--   • sql/C12-c-rpc-ecriture.sql : fonctions CANONIQUES
--     inserer_observable / annuler_observable / corriger_observable,
--     helper chronologie_rencontre_ouverte, garde-fou DS-1, double
--     effet blessure (PI-6). Constat §1 du cadrage VÉRIFIÉ exact :
--     les 3 fn ne résolvent la rencontre que par jeton 'saisie' ou
--     bypass superuser ; AUCUNE branche auth.uid() ; corriger_observable
--     ne touche PAS timecode_video.
--   • sql/C12-i-consolider-score-jeton.sql : PATTERN DE RÉFÉRENCE
--     (chemin ajouté par surcharge déléguant au canonique non modifié).
--   • Modelisation-Evenements-v1.1 §4.5.b : `equipes.coach_principal_id`
--     (FK personnes) + `equipes.coachs_adjoints_ids UUID[]` =
--     « LE CANONIQUE COURANT du staff d'une équipe ». Chaîne
--     evenements.equipe_uuid -> equipes.id. C'est le modèle
--     d'autorisation coach->rencontre, vérifié à la source (§3 du
--     cadrage), PAS inventé.
--   • Cadrage-SUIVI-COACH-3-Backend.md §2/§3/§4.
--
-- EXIGENCES DU CADRAGE, toutes tenues :
--   • C12-c NON MODIFIÉ (ajout pur, pattern C12-i).
--   • Chemin coach porte : source_saisie='video', saisi_par_role='coach'.
--   • timecode_video renseignable à l'insertion ET à la correction
--     (corriger_observable canonique ne le gère pas → comblé ICI
--      PAR AJOUT, sans réécrire le canonique : voir corriger_*_coach).
--   • Garde-fous DS-1 répliqués À L'IDENTIQUE (adverse -> joueur NULL ;
--     notre+NULL autorisé ; jamais joueur sur ligne adverse). Jamais
--     de DELETE. Aucune écriture dans `presences`.
--   • Double effet blessure (PI-6) répliqué à l'identique.
--   • P1 simplicité : pas de table, pas de schéma. Surcharges
--     SECURITY DEFINER réutilisant les briques existantes.
--
-- ⚠️ SEUL POINT NON VÉRIFIABLE À LA SOURCE — ISOLÉ, NON INVENTÉ.
-- Le lien entre la session Supabase Auth (auth.uid()) et la ligne
-- `personnes` du coach n'apparaît dans AUCUNE des sources lues
-- (C12-c, Modelisation-Evenements). Le STATE mentionne « Auth Magic
-- Link Phase 2.5 » et « RPC RGPD-safe personnes » sans exposer le
-- mapping (colonne personnes.auth_user_id ? table auth_roles ?
-- autre ?). DISCIPLINE : on ne devine pas. Ce mapping est isolé dans
-- l'UNIQUE helper `_coach_personne_uuid()` ci-dessous, à câbler en
-- Production sur le pattern d'auth réel — exactement comme C12-f a
-- isolé `chronologie_nom_court_personne` (1 seul point TODO explicite).
-- Tant que non câblé : le helper lève une exception claire (le chemin
-- coach échoue proprement ; le chemin jeton bénévole de C12-c reste
-- 100 % fonctionnel et intact).
--
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helper À CÂBLER (unique point Production) : uuid `personnes` du
--    coach authentifié courant. NE PAS inventer le mapping ici.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _coach_personne_uuid()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();           -- session Supabase courante
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Accès coach : session authentifiée requise.';
    END IF;

    -- TODO PRODUCTION (SEUL point à câbler — vérifier à la source le
    -- pattern d'auth Phase 2.5, NE PAS inventer) : retourner le
    -- personnes.id correspondant à v_uid. Ex. (à confirmer à la
    -- source, structure réelle inconnue ici) :
    --   RETURN (SELECT id FROM personnes WHERE auth_user_id = v_uid);
    -- Tant que non câblé, on échoue explicitement plutôt que de
    -- deviner (le chemin jeton bénévole de C12-c n'est pas affecté).
    RAISE EXCEPTION
      'SUIVI-COACH-3 : mapping auth.uid()->personnes non câblé (cf. C12-j §0, à vérifier à la source).';
END;
$$;

-- ---------------------------------------------------------------------
-- 1. Helper interne : ce coach est-il autorisé sur cette rencontre ?
--    Autorisation via le CANONIQUE staff (Modelisation-Evenements
--    §4.5.b) : evenements.equipe_uuid -> equipes ; le coach est
--    coach_principal_id OU dans coachs_adjoints_ids. RIEN d'inventé.
--    Renvoie l'evenement_uuid (comme valider_lien_suivi renvoie la
--    rencontre) ou lève.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION valider_coach_rencontre(
    p_evenement_uuid UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_personne UUID;
    v_equipe   UUID;
    v_ok       BOOLEAN;
BEGIN
    v_personne := _coach_personne_uuid();   -- lève si non câblé / no auth

    SELECT e.equipe_uuid INTO v_equipe
      FROM evenements e
     WHERE e.id = p_evenement_uuid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rencontre introuvable.';
    END IF;
    IF v_equipe IS NULL THEN
        -- événement parent multi-équipes : pas de coach d'équipe
        -- résoluble ; le Mode Vidéo travaille sur des matchs (enfants
        -- mono-équipe), donc ce cas ne doit pas se produire ici.
        RAISE EXCEPTION 'Rencontre sans équipe rattachée : autorisation coach impossible.';
    END IF;

    SELECT (eq.coach_principal_id = v_personne
            OR v_personne = ANY(eq.coachs_adjoints_ids))
      INTO v_ok
      FROM equipes eq
     WHERE eq.id = v_equipe;

    IF NOT COALESCE(v_ok, FALSE) THEN
        RAISE EXCEPTION 'Ce coach n''est pas rattaché à l''équipe de cette rencontre.';
    END IF;

    RETURN p_evenement_uuid;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. inserer_observable_coach — surcharge coach (Mode Vidéo)
--    Reproduit la logique canonique C12-c §1 (garde-fou DS-1 +
--    double effet blessure) mais résolution rencontre = coach
--    authentifié, et force source_saisie='video',
--    saisi_par_role='coach'. timecode_video renseignable.
--    saisi_par : 'coach:'<personne_uuid> (traçabilité, le canonique
--    y mettait le jeton ; ici pas de jeton, on trace le coach).
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
    v_evt      UUID;
    v_personne UUID;
    v_joueur   UUID;
    v_id       UUID;
    v_horo     TIMESTAMPTZ;
BEGIN
    v_personne := _coach_personne_uuid();
    v_evt      := valider_coach_rencontre(p_evenement_uuid);

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : saisie impossible.';
    END IF;

    -- Garde-fou DS-1 — RÉPLIQUE EXACTE de C12-c §1 (pas réinventé).
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
        'coach:' || v_personne::text,        -- traçabilité coach
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
--    Logique canonique C12-c §2 (annule=TRUE, jamais DELETE,
--    cloisonnement à la rencontre), résolution coach.
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
    PERFORM _coach_personne_uuid();
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
--    Logique canonique C12-c §3 (protection DS-1 : pas de joueur sur
--    ligne adverse ; corrigee_le horodaté), PLUS le comblement du
--    manque identifié au constat §1 : le canonique ne met pas à jour
--    timecode_video ; le chemin coach le fait PAR AJOUT (B-Q2/B-Q4
--    prévoit un timecode factuel sur les lignes corrigées). C12-c
--    N'EST PAS modifié — ce comportement n'existe QUE sur ce chemin.
--    p_timecode_video NULL = ne pas toucher au timecode existant
--    (correction d'attribution seule, sans re-timecoder).
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
    PERFORM _coach_personne_uuid();
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

    -- Comblement timecode_video PAR AJOUT (hors canonique C12-c).
    -- p_timecode_video NULL => COALESCE garde la valeur existante
    -- (correction d'attribution pure sans re-timecoder).
    UPDATE chronologie_suivi
       SET joueur_uuid    = p_joueur_uuid,
           timecode_video = COALESCE(p_timecode_video, timecode_video),
           corrigee_le    = NOW()
     WHERE id = p_ligne_id
       AND evenement_uuid = v_evt;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Surface d'accès — coach authentifié UNIQUEMENT.
--    authenticated seul (jamais anon : pas de chemin coach anonyme).
--    Helpers internes : pas d'EXECUTE public.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION _coach_personne_uuid() FROM PUBLIC;
REVOKE ALL ON FUNCTION valider_coach_rencontre(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION inserer_observable_coach(UUID,TEXT,TEXT,INTEGER,TEXT,UUID,TEXT,INTEGER,INTEGER,INTERVAL,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION inserer_observable_coach(UUID,TEXT,TEXT,INTEGER,TEXT,UUID,TEXT,INTEGER,INTEGER,INTERVAL,BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION annuler_observable_coach(UUID,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION annuler_observable_coach(UUID,UUID) TO authenticated;

REVOKE ALL ON FUNCTION corriger_observable_coach(UUID,UUID,UUID,INTERVAL) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION corriger_observable_coach(UUID,UUID,UUID,INTERVAL) TO authenticated;

-- =====================================================================
-- FIN C12-j. SUIVI-COACH-3 livrée (chemin coach par ajout pur, C12-c
-- intact, pattern C12-i). Autorisation via le canonique staff
-- `equipes` (vérifié à la source, non inventé). UNIQUE point à câbler
-- en Production : _coach_personne_uuid() (§0, mapping auth->personnes,
-- isolé comme chronologie_nom_court_personne de C12-f). Tant que non
-- câblé : chemin coach échoue proprement, chemin jeton bénévole intact.
-- Débloque le couloir Production Objet B §3 (spec fine + écran Mode
-- Vidéo) une fois ce câblage fait.
-- =====================================================================
