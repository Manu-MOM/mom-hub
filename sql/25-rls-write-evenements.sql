-- =====================================================================
-- sql/25-rls-write-evenements.sql
-- =====================================================================
-- Session RLS write par rôle (2/3) : noyau événements (evenements +
-- evenement_encadrants). Résout la part "événements" de la dette (i).
--
-- Matrice de droits appliquée :
--
--   Table                | INSERT          | UPDATE          | DELETE
--   ---------------------+-----------------+-----------------+--------
--   evenements           | admin + coach   | admin + coach   | admin
--   evenement_encadrants | admin + coach   | admin + coach   | admin
--
-- Décisions doctrinales :
--   - DELETE = admin only : un événement passé ne se supprime pas, il
--     s'archive (etat = 'annule' ou 'archive'). Le DELETE serait
--     destructeur pour les compos/présences associées via FK CASCADE.
--   - Coach = write libre sur les 2 tables (Option B, P1 simplicité).
--   - À durcir en Option A quand multi-coach réel (vérifier via table
--     de jonction coach_equipes que le coach a accès à l'équipe).
--
-- Préalable check effectué le 13 mai : aucune policy write existante
-- sur ces 2 tables (Phase 4.2.A n'avait créé que la policy SELECT).
--
-- Helpers utilisés (existants en base) :
--   - has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER
--
-- Auteur : conv Production · 13 mai 2026
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · evenements
-- ---------------------------------------------------------------------

CREATE POLICY evenements_insert_admin_or_coach
  ON evenements FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evenements_update_admin_or_coach
  ON evenements FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evenements_delete_admin
  ON evenements FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ---------------------------------------------------------------------
-- 2 · evenement_encadrants
-- ---------------------------------------------------------------------

CREATE POLICY evenement_encadrants_insert_admin_or_coach
  ON evenement_encadrants FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evenement_encadrants_update_admin_or_coach
  ON evenement_encadrants FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evenement_encadrants_delete_admin
  ON evenement_encadrants FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ---------------------------------------------------------------------
-- 3 · Vérification structurelle
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Attendu : 3 (evenements) + 3 (evenement_encadrants) = 6
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('evenements', 'evenement_encadrants')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Policies write créées sur 2 tables : % (attendu 6)', v_count;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   DROP POLICY IF EXISTS evenements_insert_admin_or_coach           ON evenements;
--   DROP POLICY IF EXISTS evenements_update_admin_or_coach           ON evenements;
--   DROP POLICY IF EXISTS evenements_delete_admin                    ON evenements;
--   DROP POLICY IF EXISTS evenement_encadrants_insert_admin_or_coach ON evenement_encadrants;
--   DROP POLICY IF EXISTS evenement_encadrants_update_admin_or_coach ON evenement_encadrants;
--   DROP POLICY IF EXISTS evenement_encadrants_delete_admin          ON evenement_encadrants;
-- =====================================================================
