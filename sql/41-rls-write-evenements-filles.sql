-- =====================================================================
-- MOM HUB · RLS WRITE — TABLES FILLES ÉVÉNEMENTS (M3 / M5 / encadrants)
-- =====================================================================
-- Auteur  : conv Production · Session RLS write par rôle (assistance Claude)
-- Date    : 2026-05-18
-- Version : 1.0
--
-- Réplique le patron RLS write DÉJÀ DÉPLOYÉ sur `evenements` (sql/25,
-- vérifié à la source via pg_policies le 18/05/2026 — le code déployé
-- fait foi, jamais le doc) sur les 3 tables filles restées SELECT-only :
--   - evenement_equipes_engagees  (M3, sql/40 — dette REFONTE-EVT-write-M3/M5)
--   - evenement_adversaires       (M5, sql/40 — dette REFONTE-EVT-write-M3/M5)
--   - evenement_encadrants        (M8, sql/10 — dette P2-E.4)
--
-- Patron `evenements` déployé (pg_policies, fait foi) :
--   SELECT : authenticated, USING true                  (DÉJÀ en place ici)
--   INSERT : authenticated, WITH CHECK has_role(admin|coach)
--   UPDATE : authenticated, USING + WITH CHECK has_role(admin|coach)
--   DELETE : `evenements` = has_role(admin) SEUL
--
-- ÉCART ASSUMÉ vs `evenements`, tranché par Manu (Arbitrage 1 = Option A) :
--   DELETE des 3 tables filles = has_role(admin) OR has_role(coach).
--   Motif : sur les filles, supprimer une ligne = décocher une équipe /
--   retirer un adversaire saisi par erreur / enlever un encadrant =
--   édition COURANTE du coach pendant la mise en place (UX §2.4/4a en
--   cases à cocher). `evenements` garde son DELETE admin-seul (l'événement
--   entier reste l'acte destructeur protégé). CE FICHIER NE TOUCHE PAS
--   `evenements` (ni aucune autre table).
--
-- Modèle de rôles : public.has_role(text) (sql/04-auth-roles, lu à la
-- source — admin/coach/viewer, SECURITY DEFINER ; AUCUN mapping
-- auth→personnes, AUCUNE liaison équipe → autorisation par RÔLE seul,
-- cohérent C12-j ; SUIVI-COACH-3-equipe reste non bloquant par
-- construction). `has_role(...)` non qualifié = miroir exact du rendu
-- des policies `evenements` déployées.
--
-- Nommage : chaque table conserve le préfixe de sa policy SELECT déjà
-- déployée (evt_equipes_* / evt_adv_* / evenement_encadrants_*) ;
-- suffixe sémantique calqué sur `evenements` — le nom dit ce que la
-- policy fait (ici DELETE = admin_or_coach, pas admin seul).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- IDEMPOTENT : OUI (drop policy if exists + create, comme
-- sql/04-auth-roles). Transaction pour atomicité ; bloc DO fail-loud
-- AVANT COMMIT (auto-ROLLBACK si une policy manque — discipline sql/40).
-- RLS déjà activée à la source (sql/10 encadrants ; sql/40 M3/M5) :
-- les ALTER ... ENABLE ci-dessous sont des no-op idempotents défensifs.
-- =====================================================================

BEGIN;

ALTER TABLE evenement_equipes_engagees ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenement_adversaires      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenement_encadrants       ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- M3 · evenement_equipes_engagees
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS evt_equipes_insert_admin_or_coach ON evenement_equipes_engagees;
DROP POLICY IF EXISTS evt_equipes_update_admin_or_coach ON evenement_equipes_engagees;
DROP POLICY IF EXISTS evt_equipes_delete_admin_or_coach ON evenement_equipes_engagees;

CREATE POLICY evt_equipes_insert_admin_or_coach
  ON evenement_equipes_engagees FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evt_equipes_update_admin_or_coach
  ON evenement_equipes_engagees FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evt_equipes_delete_admin_or_coach
  ON evenement_equipes_engagees FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('coach'));

-- ─────────────────────────────────────────────────────────────────────
-- M5 · evenement_adversaires
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS evt_adv_insert_admin_or_coach ON evenement_adversaires;
DROP POLICY IF EXISTS evt_adv_update_admin_or_coach ON evenement_adversaires;
DROP POLICY IF EXISTS evt_adv_delete_admin_or_coach ON evenement_adversaires;

CREATE POLICY evt_adv_insert_admin_or_coach
  ON evenement_adversaires FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evt_adv_update_admin_or_coach
  ON evenement_adversaires FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evt_adv_delete_admin_or_coach
  ON evenement_adversaires FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('coach'));

-- ─────────────────────────────────────────────────────────────────────
-- M8 · evenement_encadrants  (lève P2-E.4 côté write)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS evenement_encadrants_insert_admin_or_coach ON evenement_encadrants;
DROP POLICY IF EXISTS evenement_encadrants_update_admin_or_coach ON evenement_encadrants;
DROP POLICY IF EXISTS evenement_encadrants_delete_admin_or_coach ON evenement_encadrants;

CREATE POLICY evenement_encadrants_insert_admin_or_coach
  ON evenement_encadrants FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evenement_encadrants_update_admin_or_coach
  ON evenement_encadrants FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY evenement_encadrants_delete_admin_or_coach
  ON evenement_encadrants FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('coach'));

-- ─────────────────────────────────────────────────────────────────────
-- Vérification fail-loud AVANT COMMIT (auto-ROLLBACK si incohérent)
-- Attendu : 9 policies write (3 tables × INSERT/UPDATE/DELETE)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_nb_write INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nb_write
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('evenement_equipes_engagees',
                      'evenement_adversaires',
                      'evenement_encadrants')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'Policies write tables filles : % (attendu 9)', v_nb_write;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_nb_write <> 9 THEN
    RAISE EXCEPTION
      'RLS write filles : % policies write au lieu de 9 — ROLLBACK.',
      v_nb_write;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — à lancer après le Run)
-- =====================================================================
-- Attendu par table : SELECT (déjà en place, USING true) +
-- INSERT/UPDATE/DELETE (admin_or_coach). `evenements` NON listé ici =
-- non modifié (son DELETE y reste admin-seul, intact).
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('evenement_equipes_engagees',
                    'evenement_adversaires',
                    'evenement_encadrants')
ORDER BY tablename, cmd, policyname;
