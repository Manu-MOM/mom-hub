-- =====================================================================
-- MOM Hub · C12-s · Assainissement écriture + voie COACH d'inserer_observable
-- =====================================================================
-- Chantier : Refonte UX Suivi — suivi live, préalable à L3 (saisie).
--
-- DEUX PROBLÈMES constatés à la source (sondes pg_proc) :
--   (P1) SURCHARGE : il existe DEUX inserer_observable — une 14-params
--        (héritée C12-c) et une 15-params (C12-m, avec p_joueur_uuid_
--        entrant). CREATE OR REPLACE sur signature différente a créé une
--        surcharge au lieu de remplacer → ambiguïté latente. On SUPPRIME
--        la 14-params ; la 15-params (entrant optionnel DEFAULT NULL)
--        couvre tous les cas, anciens appels 14-args compris.
--   (P2) VOIE COACH ABSENTE : inserer_observable_coach n'existe PAS en
--        base (le wrapper supabase-client.js insererObservableCoach
--        l'appelle → planterait). Le pan « écriture coach » a été câblé
--        côté client mais jamais déployé côté SQL. On la CRÉE, garde
--        réelle auth.uid() (pattern C12-o ; pas de _coach_auth_uid/
--        valider_coach_rencontre qui n'existent pas).
--
-- DOCTRINE : ajout/assainissement PUR. La 15-params (voie jeton) n'est
--   PAS modifiée. inserer_observable_coach REPRODUIT sa logique métier
--   (gardes DS-1 adverse→NULL / notre→accepté NULL, double-effet
--   blessure, INSERT identique) ; seules diffèrent l'AUTORISATION
--   (auth.uid au lieu du jeton) et la résolution de l'événement
--   (p_evenement_uuid direct). Dette SUIVI-COACH-AUTH héritée (resserrer
--   via has_role quand rôles peuplés — IDENT-SYS). Idempotent.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- P1 — Supprimer la surcharge 14-params (sans p_joueur_uuid_entrant).
--   Signature exacte ciblée (l'autre, 15-params, est conservée).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS inserer_observable(
    TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, INTEGER, INTEGER,
    TEXT, TEXT, INTERVAL, BOOLEAN, UUID);

-- ---------------------------------------------------------------------
-- P2 — Voie COACH : inserer_observable_coach. Logique métier identique
--   à inserer_observable (15-params), autorisation = auth.uid().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION inserer_observable_coach(
    p_evenement_uuid  UUID,
    p_observable_id   TEXT,
    p_categorie_obs   TEXT,
    p_valeur_points   INTEGER,
    p_equipe_concernee TEXT,
    p_joueur_uuid     UUID    DEFAULT NULL,
    p_mode_saisie     TEXT    DEFAULT 'normal',
    p_minute_match    INTEGER DEFAULT NULL,
    p_periode         INTEGER DEFAULT 1,
    p_timecode_video  INTERVAL DEFAULT NULL,
    p_est_blessure    BOOLEAN DEFAULT FALSE,
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
    -- Autorisation coach RÉELLE (cf. C12-o) : utilisateur authentifié.
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.
    v_evt := p_evenement_uuid;

    IF NOT chronologie_rencontre_ouverte(v_evt) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : saisie impossible.';
    END IF;

    -- Garde-fou DS-1 (identique voie jeton) :
    IF p_equipe_concernee = 'adverse' THEN
        v_joueur      := NULL;
        v_joueur_entr := NULL;
    ELSIF p_equipe_concernee = 'notre' THEN
        v_joueur      := p_joueur_uuid;
        v_joueur_entr := p_joueur_uuid_entrant;
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
        'coach:' || COALESCE(auth.uid()::text, '?'), 'coach', 'live', p_timecode_video
    )
    RETURNING chronologie_suivi.id, chronologie_suivi.horodatage
    INTO v_id, v_horo;

    -- Double effet « blessure » (identique voie jeton).
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

REVOKE ALL ON FUNCTION inserer_observable_coach(
    UUID, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, INTEGER, INTEGER,
    INTERVAL, BOOLEAN, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION inserer_observable_coach(
    UUID, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, INTEGER, INTEGER,
    INTERVAL, BOOLEAN, UUID) TO authenticated;

COMMIT;

-- =====================================================================
-- FIN C12-s. (P1) surcharge 14-params supprimée — seule la 15-params
-- subsiste (entrant optionnel). (P2) inserer_observable_coach créée
-- (garde auth.uid, logique métier identique à la voie jeton, saisi_par
-- = 'coach:'||uid, saisi_par_role='coach', source_saisie='live').
-- ⚠️ Le wrapper supabase-client.js insererObservableCoach envoie
-- p_joueur_uuid_entrant ? NON en v1.42 — à ajouter au wrapper pour la
-- substitution (L3c). Pour L3a/b (score, attribution simple) le wrapper
-- actuel suffit. SUIVI-COACH-AUTH héritée.
-- =====================================================================
