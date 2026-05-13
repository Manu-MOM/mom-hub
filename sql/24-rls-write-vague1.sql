-- =====================================================================
-- sql/24-rls-write-vague1.sql
-- =====================================================================
-- Phase 4.X — Session RLS write par rôle (1/3) : Vague 1 + référentiels
-- structurels (ententes, equipes, equipe_joueurs, distances_sites).
--
-- Résout les dettes :
--   - (i) policies RLS write par rôle (partie Vague 1)
--   - (l) durcissement INSERT distances_sites (admin only)
--   - C7-d (write licencie_externe_partenaire : cas géré via la policy
--          write commune sur equipe_joueurs, pas de jointure spéciale
--          car la doctrine v1.4 autorise un coach à attacher tout joueur
--          quel que soit son type_personne)
--
-- Matrice de droits appliquée :
--
--   Table            | INSERT          | UPDATE          | DELETE
--   -----------------+-----------------+-----------------+--------
--   ententes         | admin           | admin           | admin
--   equipes          | admin + coach   | admin + coach   | admin
--   equipe_joueurs   | admin + coach   | admin + coach   | admin
--   distances_sites  | admin           | admin           | admin
--
-- Décisions doctrinales :
--   - DELETE = admin only sur ces tables (par prudence, ce sont des
--     données structurantes : supprimer un joueur d'une équipe doit
--     passer par UPDATE date_sortie, pas DELETE).
--   - ententes = admin only (acte structurel de dirigeant, pas d'un coach).
--   - distances_sites = admin only (référentiel pur, jamais édité par
--     un coach via le portail).
--   - Coach = write libre sur equipes + equipe_joueurs (Option B,
--     P1 simplicité, 1 seul coach prod aujourd'hui ; à durcir en
--     Option A quand multi-coach réel).
--   - service_role conserve tous les droits (bypass RLS natif).
--
-- Helpers utilisés (existants en base) :
--   - has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER
--
-- Préalables :
--   - sql/01 (tables Vague 1 + auth_roles)
--   - sql/07 (distances_sites)
--   - sql/13 (RLS SELECT Vague 1)
--
-- Auteur : conv Production · 13 mai 2026
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · ententes (admin only sur write)
-- ---------------------------------------------------------------------

CREATE POLICY ententes_insert_admin
  ON ententes FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));

CREATE POLICY ententes_update_admin
  ON ententes FOR UPDATE TO authenticated
  USING      (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY ententes_delete_admin
  ON ententes FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ---------------------------------------------------------------------
-- 2 · equipes (admin + coach sur INSERT/UPDATE, admin sur DELETE)
-- ---------------------------------------------------------------------

CREATE POLICY equipes_insert_admin_or_coach
  ON equipes FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY equipes_update_admin_or_coach
  ON equipes FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY equipes_delete_admin
  ON equipes FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ---------------------------------------------------------------------
-- 3 · equipe_joueurs (admin + coach sur INSERT/UPDATE, admin sur DELETE)
-- ---------------------------------------------------------------------

CREATE POLICY equipe_joueurs_insert_admin_or_coach
  ON equipe_joueurs FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY equipe_joueurs_update_admin_or_coach
  ON equipe_joueurs FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY equipe_joueurs_delete_admin
  ON equipe_joueurs FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ---------------------------------------------------------------------
-- 4 · distances_sites (admin only, durcit dette (l))
-- ---------------------------------------------------------------------

-- ⚠️  Si une policy write existante autorisait déjà tout authenticated,
-- elle est à supprimer ICI pour ne pas être en concurrence avec les
-- nouvelles policies admin-only (sinon l'union des policies autoriserait
-- toujours tout authenticated). On utilise DROP POLICY IF EXISTS pour
-- être idempotent et tolérant à différents nommages.

DROP POLICY IF EXISTS distances_sites_insert_authenticated ON distances_sites;
DROP POLICY IF EXISTS distances_sites_update_authenticated ON distances_sites;
DROP POLICY IF EXISTS distances_sites_delete_authenticated ON distances_sites;
DROP POLICY IF EXISTS distances_sites_insert ON distances_sites;
DROP POLICY IF EXISTS distances_sites_update ON distances_sites;
DROP POLICY IF EXISTS distances_sites_delete ON distances_sites;
DROP POLICY IF EXISTS distances_sites_write ON distances_sites;
DROP POLICY IF EXISTS distances_sites_all_authenticated ON distances_sites;

CREATE POLICY distances_sites_insert_admin
  ON distances_sites FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));

CREATE POLICY distances_sites_update_admin
  ON distances_sites FOR UPDATE TO authenticated
  USING      (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY distances_sites_delete_admin
  ON distances_sites FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ---------------------------------------------------------------------
-- 5 · Vérification structurelle
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Total des policies write nouvellement créées sur ces 4 tables
  -- Attendu : 3 (ententes) + 3 (equipes) + 3 (equipe_joueurs) + 3 (distances_sites) = 12
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('ententes', 'equipes', 'equipe_joueurs', 'distances_sites')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Policies write créées sur 4 tables : % (attendu 12)', v_count;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   DROP POLICY IF EXISTS ententes_insert_admin                    ON ententes;
--   DROP POLICY IF EXISTS ententes_update_admin                    ON ententes;
--   DROP POLICY IF EXISTS ententes_delete_admin                    ON ententes;
--   DROP POLICY IF EXISTS equipes_insert_admin_or_coach            ON equipes;
--   DROP POLICY IF EXISTS equipes_update_admin_or_coach            ON equipes;
--   DROP POLICY IF EXISTS equipes_delete_admin                     ON equipes;
--   DROP POLICY IF EXISTS equipe_joueurs_insert_admin_or_coach     ON equipe_joueurs;
--   DROP POLICY IF EXISTS equipe_joueurs_update_admin_or_coach     ON equipe_joueurs;
--   DROP POLICY IF EXISTS equipe_joueurs_delete_admin              ON equipe_joueurs;
--   DROP POLICY IF EXISTS distances_sites_insert_admin             ON distances_sites;
--   DROP POLICY IF EXISTS distances_sites_update_admin             ON distances_sites;
--   DROP POLICY IF EXISTS distances_sites_delete_admin             ON distances_sites;
--
-- ⚠️  Après rollback, distances_sites n'aurait plus AUCUNE policy
-- write → toutes les écritures authenticated seraient bloquées. À
-- savoir avant de jouer le ROLLBACK.
-- =====================================================================
