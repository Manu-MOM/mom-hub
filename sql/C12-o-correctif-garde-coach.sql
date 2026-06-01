-- =====================================================================
-- MOM Hub · C12-o · CORRECTIF garde coach (auth.uid réel)
-- =====================================================================
-- PROBLÈME (constaté à la source, sondes information_schema/pg_proc) :
--   Les RPC coach s'appuyaient sur _coach_auth_uid() et
--   valider_coach_rencontre() — fonctions qui N'EXISTENT PAS en base
--   (le pan « autorisation coach + équipe-staff » a été codé au repo
--   mais jamais déployé). Résultat : toute RPC coach plante au 1er appel
--   (« function _coach_auth_uid() does not exist »). Cela concerne :
--     • get_chronologie_rencontre_coach  (issu de C12-k, enrichi C12-m)
--     • action_chrono_coach              (C12-n)
--     • get_chrono_rencontre_coach       (C12-n)
--
-- DÉCISION (tracée) — garde RÉELLE disponible :
--   Le système de rôles existe (has_role(text), get_my_roles()) mais
--   est VIDE : aucun compte n'a de rôle (get_my_roles() = []), pas même
--   le coach principal. Utiliser has_role('coach') refuserait donc TOUT
--   le monde. La brique d'auth réellement exploitable est auth.uid()
--   (Supabase standard, présent).
--   => Garde retenue : UTILISATEUR AUTHENTIFIÉ (auth.uid() IS NOT NULL).
--      Proportionné (Hub interne, comptes = encadrants, chrono réversible),
--      non bloquant, et RESSERRABLE plus tard en ajout pur.
--
-- DETTE explicite SUIVI-COACH-AUTH :
--   Quand le système de rôles sera peuplé (cf. IDENT-SYS auth↔personne),
--   resserrer la garde en ajoutant, après le contrôle auth.uid() :
--     IF NOT has_role('coach') AND NOT has_role('admin')
--        THEN RAISE EXCEPTION 'Rôle coach/admin requis.'; END IF;
--   (ajout pur d'une ligne ; aucune autre modification requise).
--   Idéalement, vérifier aussi le lien coach↔équipe de la rencontre,
--   le jour où ce lien est déployé.
--
-- DOCTRINE : correctif PUR. Aucune signature ni type de retour ne change
--   (CREATE OR REPLACE simple, pas de DROP). Seules les 2 lignes de garde
--   fantôme sont remplacées par la garde auth.uid(). Tout le reste des
--   corps est REPRODUIT À L'IDENTIQUE (lu à la source / état base).
--   Idempotent.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. get_chronologie_rencontre_coach (C12-k + enrichissement C12-m)
--    Corps identique à l'état base ; garde fantôme -> auth.uid().
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
    nom_court       TEXT,
    joueur_uuid_entrant UUID,
    nom_court_entrant   TEXT,
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
    -- Garde coach RÉELLE (C12-o) : utilisateur authentifié.
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.
    v_evt := p_evenement_uuid;

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

-- ---------------------------------------------------------------------
-- 2. action_chrono_coach (C12-n) — garde fantôme -> auth.uid().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION action_chrono_coach(
    p_evenement_uuid UUID,
    p_action         TEXT,
    p_durees         INTEGER[] DEFAULT NULL,
    p_mode_affichage TEXT      DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.
    v_evt := p_evenement_uuid;
    PERFORM _appliquer_action_chrono(v_evt, p_action, p_durees, p_mode_affichage);
END;
$$;

REVOKE ALL ON FUNCTION action_chrono_coach(UUID, TEXT, INTEGER[], TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION action_chrono_coach(UUID, TEXT, INTEGER[], TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. get_chrono_rencontre_coach (C12-n) — garde fantôme -> auth.uid().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_chrono_rencontre_coach(
    p_evenement_uuid UUID
) RETURNS TABLE (
    durees_periodes      INTEGER[],
    mode_affichage       TEXT,
    periode_courante     INTEGER,
    coup_envoi_at        TIMESTAMPTZ,
    debut_periode_at     TIMESTAMPTZ,
    en_pause             BOOLEAN,
    pause_depuis_at      TIMESTAMPTZ,
    pause_cumul_secondes INTEGER,
    termine_at           TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.
    v_evt := p_evenement_uuid;

    RETURN QUERY
    SELECT sc.durees_periodes, sc.mode_affichage, sc.periode_courante,
           sc.coup_envoi_at, sc.debut_periode_at, sc.en_pause,
           sc.pause_depuis_at, sc.pause_cumul_secondes, sc.termine_at
    FROM   suivi_chrono sc
    WHERE  sc.evenement_uuid = v_evt;
END;
$$;

REVOKE ALL ON FUNCTION get_chrono_rencontre_coach(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_chrono_rencontre_coach(UUID) TO authenticated;

COMMIT;

-- =====================================================================
-- FIN C12-o. Les 3 RPC coach sont réparées (garde auth.uid() réelle au
-- lieu des fonctions fantômes _coach_auth_uid()/valider_coach_rencontre()
-- jamais déployées). Voie JETON inchangée (valider_lien_suivi existe et
-- marche). Dette SUIVI-COACH-AUTH ouverte (resserrer via has_role quand
-- le système de rôles sera peuplé — lié IDENT-SYS auth↔personne).
-- =====================================================================
