-- =====================================================================
-- MOM HUB · sql/47 — RÉSOLUTION DETTE C12-nom + RPC noms Collectif
-- =====================================================================
-- Auteur  : conv Production · Implémentation Collectif & compo 3
--           niveaux (assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- CONTEXTE (constat À LA SOURCE, le fait fait foi) :
--   `personnes` : RLS ACTIVE, ZÉRO policy (pg_policies → 0 ligne,
--   vérifié 19/05) ⇒ SELECT refusé par défaut pour `authenticated`.
--   Verrouillage DÉLIBÉRÉ (RGPD : n° sécu, adresses, scolarité de
--   mineurs — sql/01 BLOC 1/2). L'embed PostgREST `personnes(...)`
--   revient donc NULL → tout sortait « (sans nom) » (prouvé terrain
--   pioche U-admin / vivier U-N2).
--
--   `chronologie_nom_court_personne(UUID) RETURNS TEXT` (C12-f
--   §3, déployé) est un STUB : corps = `RETURN NULL` + TODO
--   PRODUCTION. C'EST la dette C12-nom, NON résolue. Appelée par
--   get_compo_reduite_rencontre (C12-f l.309, chemin JETON) et
--   get_compo_reduite_rencontre_coach (C12-l l.126, chemin COACH).
--
-- DÉCISION MANU (option 2, tracée clôture — écart de gouvernance
--   ASSUMÉ : cette conv « implémentation Collectif » absorbe la
--   résolution d'une dette transverse Suivi) :
--   1. CÂBLER chronologie_nom_court_personne (résout C12-nom
--      globalement : Suivi/chronologie affiche enfin les noms).
--   2. AJOUTER une RPC en lot get_noms_personnes pour le Collectif
--      (pioche U-admin / vivier N1 / groupe N2 : besoin = nom+prenom
--      SÉPARÉS, en lot, sous garde de rôle).
--
-- DÉCISION RGPD MANU (tracée clôture, ASSUMÉE explicitement —
--   données de MINEURS) :
--   • chronologie_nom_court_personne renvoie « Prénom NOM » (nom
--     COMPLET). Manu informé que ce libellé transite par le chemin
--     JETON potentiellement public ; arbitrage assumé.
--   • get_noms_personnes : nom/prenom complets séparés, MAIS gardée
--     has_role('admin') OR has_role('coach') (jamais exposée au
--     jeton public). Surface d'exposition strictement admin/coach.
--   • AUCUNE des 2 fonctions n'expose JAMAIS une colonne sensible
--     (n° sécu, adresse, scolarité…) : projection limitée à
--     id/nom/prenom. RLS `personnes` NON modifiée (verrou délibéré
--     préservé ; on passe par SECURITY DEFINER ciblé, patron projet
--     déjà établi par chronologie_nom_court_personne — répliqué,
--     non réinventé).
--
-- CONTRAT PRÉSERVÉ (anti-divergence, exigence absolue) :
--   chronologie_nom_court_personne : signature (p_personne_uuid
--   UUID) RETURNS TEXT, SECURITY DEFINER, SET search_path = public
--   — INCHANGÉE (C12-f/C12-l déployés en dépendent ; on REMPLACE
--   le corps via CREATE OR REPLACE, on ne touche NI la signature NI
--   le REVOKE déjà posé par C12-f l.336). AUCUNE 2ᵉ fonction
--   concurrente (ce serait laisser C12-nom non résolue + créer une
--   divergence — faute interdite).
--
-- has_role(text) : NON présent dans les sources fournies (sql/04
--   non communiqué) mais usage EXACT prouvé déployé (sql/43, C12-j).
--   Répliqué à l'identique, NON réinventé. Si has_role absent en
--   base, le fail-loud ci-dessous lèvera (pas de faux positif
--   silencieux — la fonction Collectif ne serait pas créée).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- IDEMPOTENT : OUI (CREATE OR REPLACE FUNCTION ×2 ; REVOKE/GRANT
-- rejouables). Transaction ; bloc DO fail-loud AVANT COMMIT
-- (auto-ROLLBACK si une fonction manque — discipline sql/43/46).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · CÂBLAGE chronologie_nom_court_personne (résout C12-nom)
--     Signature/sécurité INCHANGÉES vs C12-f §3 (contrat figé).
--     Corps : stub `RETURN NULL` → lecture RGPD-ciblée « Prénom NOM ».
--     NULL-safe : p_personne_uuid NULL → NULL (comportement C12-f
--     préservé, libelleJoueurSuivi() côté client dégrade déjà).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chronologie_nom_court_personne(
    p_personne_uuid UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lib TEXT;
BEGIN
    IF p_personne_uuid IS NULL THEN
        RETURN NULL;
    END IF;
    -- « Prénom NOM » (décision Manu 19/05, tracée clôture). Projection
    -- STRICTE id/nom/prenom — jamais une colonne sensible. trim() pour
    -- robustesse si une des 2 colonnes était vide (sql/01 = NOT NULL,
    -- défensif).
    SELECT NULLIF(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), '')
      INTO v_lib
      FROM personnes p
     WHERE p.id = p_personne_uuid;
    RETURN v_lib;   -- NULL si personne introuvable (dégradation honnête)
END;
$$;

-- REVOKE déjà posé par C12-f (l.336) — on NE le redéfinit pas (le
-- contrat de surface d'accès reste celui de C12-f, inchangé).

-- ---------------------------------------------------------------------
-- 2 · RPC Collectif : noms en lot, gardée par rôle (pioche U-admin /
--     vivier N1 / groupe N2). nom+prenom SÉPARÉS. SECURITY DEFINER
--     (contourne la RLS personnes verrouillée — patron exact
--     chronologie_nom_court_personne, répliqué non réinventé) MAIS
--     garde EXPLICITE has_role(admin|coach) en tête (sinon porte
--     dérobée sur personnes — inacceptable).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_noms_personnes(
    p_personne_uuids UUID[]
) RETURNS TABLE (
    personne_id UUID,
    nom         TEXT,
    prenom      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Garde de rôle OBLIGATOIRE (la fonction bypasse la RLS). Patron
    -- has_role déployé (sql/43/C12-j), répliqué à l'identique.
    IF NOT (has_role('admin') OR has_role('coach')) THEN
        RAISE EXCEPTION 'get_noms_personnes : accès refusé (rôle admin|coach requis).'
            USING ERRCODE = '42501';   -- insufficient_privilege
    END IF;

    IF p_personne_uuids IS NULL OR array_length(p_personne_uuids, 1) IS NULL THEN
        RETURN;   -- aucun uuid → 0 ligne (dégradation honnête)
    END IF;

    RETURN QUERY
    SELECT p.id, p.nom, p.prenom
      FROM personnes p
     WHERE p.id = ANY (p_personne_uuids);
    -- Projection STRICTE id/nom/prenom — jamais une colonne sensible.
END;
$$;

REVOKE ALL  ON FUNCTION get_noms_personnes(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_noms_personnes(UUID[]) TO authenticated;
-- authenticated SEUL (jamais anon) + garde has_role interne : double
-- barrière. Posture identique aux RPC coach C12-j/k/l.

-- ---------------------------------------------------------------------
-- 3 · Vérification fail-loud AVANT COMMIT (auto-ROLLBACK si incohérent)
--     Attendu : les 2 fonctions existent avec la bonne signature.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_chrono INTEGER;
  v_lot    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_chrono
  FROM pg_proc
  WHERE proname = 'chronologie_nom_court_personne'
    AND pg_get_function_arguments(oid) = 'p_personne_uuid uuid';

  SELECT COUNT(*) INTO v_lot
  FROM pg_proc
  WHERE proname = 'get_noms_personnes'
    AND pg_get_function_arguments(oid) = 'p_personne_uuids uuid[]';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'chronologie_nom_court_personne (câblée) : % (att.1)', v_chrono;
  RAISE NOTICE 'get_noms_personnes (RPC lot Collectif)  : % (att.1)', v_lot;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_chrono <> 1 OR v_lot <> 1 THEN
    RAISE EXCEPTION
      'sql/47 incohérent (chrono=%, lot=%) — ROLLBACK.', v_chrono, v_lot;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — APRÈS le Run)
-- =====================================================================
-- a) C12-nom résolue : doit renvoyer « Prénom NOM » (≠ NULL) pour un
--    joueur connu. Ex. (remplacer l'UUID par un id réel de personnes) :
--      SELECT chronologie_nom_court_personne(
--               '660be3b2-a67e-498a-8c99-6ff26851775e');
--    Attendu : « Hugo BARTHEL » (ou le prénom/nom réel).
--
-- b) RPC Collectif (à exécuter en session authentifiée admin|coach
--    via l'app — en SQL Editor le rôle peut différer) :
--      SELECT * FROM get_noms_personnes(ARRAY[
--        '660be3b2-a67e-498a-8c99-6ff26851775e'::uuid ]);
--    Attendu : 1 ligne (personne_id, nom, prenom). Sans rôle
--    admin|coach : EXCEPTION 42501 (garde OK, pas de fuite).
-- =====================================================================
