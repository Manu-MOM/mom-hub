-- =====================================================================
-- sql/26-rls-write-compositions-presences.sql
-- =====================================================================
-- Session RLS write par rôle (3/3) : compositions + composition_joueurs
-- + presences. Résout :
--   - Part "compositions/présences" de la dette (i)
--   - C8-e (RLS write par rôle sur compositions/composition_joueurs)
--
-- Matrice de droits appliquée :
--
--   Table                | INSERT          | UPDATE          | DELETE
--   ---------------------+-----------------+-----------------+----------------
--   compositions         | admin + coach   | admin + coach   | admin + coach
--   composition_joueurs  | admin + coach   | admin + coach   | admin + coach
--   presences            | admin + coach   | admin + coach   | admin
--
-- Décisions doctrinales :
--   - DELETE = admin + coach sur compositions et composition_joueurs
--     (cas légitime : un coach archive/supprime une compo brouillon
--     qu'il a créée à tort, ou retire un joueur d'une compo qu'il
--     n'a pas encore validée). Versionning via est_active+version
--     dans compositions garde la traçabilité même en cas de DELETE.
--   - DELETE = admin only sur presences : la saisie de présence est
--     un acte de traçabilité. Une présence erronée se corrige par
--     UPDATE du statut, pas par suppression. Admin garde la
--     possibilité DELETE pour cas exceptionnels (dédoublon, etc.).
--   - Coach = write libre (Option B, P1 simplicité). À durcir en
--     Option A quand multi-coach réel (vérifier que la compo
--     appartient bien à un événement d'une des équipes du coach
--     via table de jonction coach_equipes).
--
-- Préalable check effectué le 13 mai : aucune policy write existante
-- sur ces 3 tables (Phase 4.3 n'avait créé que les policies SELECT).
--
-- Helpers utilisés (existants en base) :
--   - has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER
--
-- Auteur : conv Production · 13 mai 2026
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · compositions (admin + coach sur tout, y compris DELETE)
-- ---------------------------------------------------------------------

CREATE POLICY compositions_insert_admin_or_coach
  ON compositions FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY compositions_update_admin_or_coach
  ON compositions FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY compositions_delete_admin_or_coach
  ON compositions FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('coach'));

-- ---------------------------------------------------------------------
-- 2 · composition_joueurs (admin + coach sur tout, y compris DELETE)
-- ---------------------------------------------------------------------

CREATE POLICY composition_joueurs_insert_admin_or_coach
  ON composition_joueurs FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY composition_joueurs_update_admin_or_coach
  ON composition_joueurs FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY composition_joueurs_delete_admin_or_coach
  ON composition_joueurs FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('coach'));

-- ---------------------------------------------------------------------
-- 3 · presences (admin + coach sur INSERT/UPDATE, admin sur DELETE)
-- ---------------------------------------------------------------------

CREATE POLICY presences_insert_admin_or_coach
  ON presences FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY presences_update_admin_or_coach
  ON presences FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY presences_delete_admin
  ON presences FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ---------------------------------------------------------------------
-- 4 · Vérification structurelle
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Attendu : 3 (compositions) + 3 (composition_joueurs) + 3 (presences) = 9
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('compositions', 'composition_joueurs', 'presences')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Policies write créées sur 3 tables : % (attendu 9)', v_count;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   DROP POLICY IF EXISTS compositions_insert_admin_or_coach        ON compositions;
--   DROP POLICY IF EXISTS compositions_update_admin_or_coach        ON compositions;
--   DROP POLICY IF EXISTS compositions_delete_admin_or_coach        ON compositions;
--   DROP POLICY IF EXISTS composition_joueurs_insert_admin_or_coach ON composition_joueurs;
--   DROP POLICY IF EXISTS composition_joueurs_update_admin_or_coach ON composition_joueurs;
--   DROP POLICY IF EXISTS composition_joueurs_delete_admin_or_coach ON composition_joueurs;
--   DROP POLICY IF EXISTS presences_insert_admin_or_coach           ON presences;
--   DROP POLICY IF EXISTS presences_update_admin_or_coach           ON presences;
--   DROP POLICY IF EXISTS presences_delete_admin                    ON presences;
-- =====================================================================
