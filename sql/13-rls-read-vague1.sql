-- =====================================================================
-- MOM HUB · PHASE 4.x · POLICIES RLS SELECT POUR VAGUE 1 (DETTE k)
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-13
-- Version : 1.0
--
-- Ferme la dette (k) ouverte le 13 mai 2026 : les tables `ententes`,
-- `equipes`, `equipe_joueurs` ont RLS activée mais aucune policy SELECT
-- définie. Conséquence : le client JS authenticated reçoit HTTP 406
-- sur tout `.from('equipes').select(...)` direct, et doit passer
-- exclusivement par des RPC SECURITY DEFINER (count_equipes_actives,
-- get_evenements_a_venir...) qui bypassent RLS.
--
-- =====================================================================
-- CHOIX DOCTRINAUX
-- =====================================================================
--   - Pattern identique aux 9 policies existantes des tables Vague 1
--     (`sites`, `evenements`, `evenement_encadrants` etc.) :
--     `SELECT TO authenticated USING (true)`.
--   - Lecture publique (anon) NON ouverte : ces tables peuvent contenir
--     des infos sensibles (effectifs M14, attaches club, etc.).
--     Cohérent avec doctrine OVAL-E §13.
--   - `personnes` volontairement NON ciblée par ce fichier : doctrine
--     RGPD = pas de SELECT direct sur la table, accès uniquement via
--     RPC dédiées (count_personnes_*, get_dashboard_stats).
--
-- =====================================================================
-- HORS PÉRIMÈTRE (à venir dans une session RLS WRITE dédiée — dette (i))
-- =====================================================================
--   - Policies INSERT/UPDATE/DELETE par rôle admin/coach/viewer sur
--     `evenements`, `evenement_encadrants`, `equipes`, `equipe_joueurs`.
--   - Durcissement de `distances_sites` qui autorise actuellement
--     INSERT/UPDATE à tout authenticated (à restreindre à admin).
--
-- =====================================================================
-- Idempotent : oui (DROP POLICY IF EXISTS + CREATE POLICY).
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;


-- ============================================
-- 1. ENTENTES — policy SELECT authenticated
-- ============================================

DROP POLICY IF EXISTS "ententes_select_authenticated" ON ententes;

CREATE POLICY "ententes_select_authenticated"
  ON ententes FOR SELECT
  TO authenticated
  USING (true);


-- ============================================
-- 2. EQUIPES — policy SELECT authenticated
-- ============================================

DROP POLICY IF EXISTS "equipes_select_authenticated" ON equipes;

CREATE POLICY "equipes_select_authenticated"
  ON equipes FOR SELECT
  TO authenticated
  USING (true);


-- ============================================
-- 3. EQUIPE_JOUEURS — policy SELECT authenticated
-- ============================================

DROP POLICY IF EXISTS "equipe_joueurs_select_authenticated" ON equipe_joueurs;

CREATE POLICY "equipe_joueurs_select_authenticated"
  ON equipe_joueurs FOR SELECT
  TO authenticated
  USING (true);


-- =====================================================================
-- Vérifications post-création
-- =====================================================================

-- A) Compter les 3 nouvelles policies SELECT
SELECT
  COUNT(*) AS nb_policies_select_vague1_ajoutees
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ententes', 'equipes', 'equipe_joueurs')
  AND cmd = 'SELECT'
  AND 'authenticated' = ANY(roles);
-- Attendu : 3

-- B) Lister les policies des 3 tables ciblées (pour confirmation visuelle)
SELECT 
  tablename,
  policyname,
  cmd        AS commande,
  roles      AS roles_concernes
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ententes', 'equipes', 'equipe_joueurs')
ORDER BY tablename, cmd;
-- Attendu : 3 lignes (1 par table)

COMMIT;
