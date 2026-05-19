-- =====================================================================
-- MOM HUB · RLS WRITE — TABLES FILLES M3 / M5 SEULES (ré-application)
-- =====================================================================
-- Auteur  : conv Production · Session RLS write — tables filles
--           Évènements (assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- POURQUOI CE FICHIER (constat à la source, le fait fait foi —
-- jamais le doc ni un commentaire de code) :
--
--   pg_policies réel au 19/05/2026 (post-sql/42) :
--     - evenement_equipes_engagees (M3) : SELECT authenticated USING
--       true UNIQUEMENT — AUCUNE policy write.
--     - evenement_adversaires      (M5) : SELECT authenticated USING
--       true UNIQUEMENT — AUCUNE policy write.
--     - evenement_encadrants       (M8) : SELECT + INSERT/UPDATE
--       admin|coach + DELETE `evenement_encadrants_delete_admin`
--       (ADMIN SEUL) — jeu PRÉEXISTANT (ère sql/10), PAS issu de
--       sql/41 (sql/41 créerait `..._delete_admin_or_coach`).
--
--   => sql/41-rls-write-evenements-filles.sql N'A JAMAIS été appliqué
--   avec succès : committé ~9h le 18/05 quand M3/M5 n'existaient pas
--   (sql/40 non persisté) → sa transaction atomique a ROLLBACK.
--   Les wrappers write déployés (supabase-client v1.19
--   add/removeEquipeEngagee / add/removeAdversaire) + le câblage
--   Bloc 4a/4c (evenements-browser v1.18) écrivent donc dans le vide :
--   RLS ON (relrowsecurity=true) + zéro policy write = INSERT/UPDATE/
--   DELETE M3/M5 REFUSÉS pour authenticated → faux involontaire.
--
-- POURQUOI PAS RE-JOUER sql/41 TEL QUEL (prouvé, non présumé) :
--   sql/41 est ATOMIQUE sur 3 tables (M3+M5+M8) avec un fail-loud
--   exigeant EXACTEMENT 9 policies write. Sur M8 il fait
--   `DROP POLICY IF EXISTS evenement_encadrants_delete_admin_or_coach`
--   — nom INEXISTANT en base (le nom réel est
--   `evenement_encadrants_delete_admin`) — puis CREATE du même nom.
--   Résultat : M8 aurait 2 policies DELETE → fail-loud compterait
--   M3(3)+M5(3)+M8(4)=10 ≠ 9 → RAISE EXCEPTION → ROLLBACK : M3/M5
--   resteraient non posées, ET autorisation M8 silencieusement
--   élargie. Donc sql/41 verbatim = échec garanti + effet de bord M8.
--   sql/41 n'est NI réécrit (enregistrement historique) NI re-joué.
--
-- CE QUE FAIT CE FICHIER (patron sql/42 : ré-application idempotente
-- corrigée, périmètre réduit au manque réel) :
--   Pose UNIQUEMENT les 6 policies write M3 + M5 (INSERT/UPDATE/
--   DELETE × 2 tables), prédicats role-purs `has_role('admin') OR
--   has_role('coach')` — patron EXACT des policies write `evenements`
--   déployées et du jeu M8 INSERT/UPDATE en base (miroir, non
--   réinventé). has_role(text) vérifié présent en base (a6).
--   Noms = ceux que sql/41 visait pour M3/M5 (préfixes alignés sur
--   les policies SELECT déjà déployées evt_equipes_* / evt_adv_*) —
--   continuité, pas d'invention.
--
-- CE QUE CE FICHIER NE FAIT PAS (décision Manu, point 1 = option a) :
--   - NE TOUCHE PAS evenement_encadrants (M8) : son write préexiste
--     et fonctionne ; sa divergence DELETE (admin seul en base vs
--     « Arbitrage 1 Option A admin|coach » consigné dans l'en-tête
--     sql/41) est RÉELLE mais TRACÉE NON TRAITÉE ici (une intention
--     = un livrable ; réalignement M8 = sujet distinct si décidé).
--     M8 n'apparaît dans aucune commande ni aucun comptage ci-dessous.
--   - NE TOUCHE PAS evenements ni aucune autre table.
--   - N'ajoute AUCUN wrapper update* (aucun appelant UX — anti-DS-1) ;
--     la policy UPDATE est posée par cohérence patron (miroir M8 /
--     evenements / intention sql/41) mais resterait sans appelant
--     tant qu'aucune UX ne modifie une ligne de liaison existante.
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- IDEMPOTENT : OUI (DROP POLICY IF EXISTS + CREATE). Transaction pour
-- atomicité ; bloc DO fail-loud AVANT COMMIT (auto-ROLLBACK si le
-- compte exact n'est pas atteint — discipline sql/40/sql/42).
-- RLS déjà activée à la source sur M3/M5 (relrowsecurity=true, a2) :
-- les ALTER ... ENABLE ci-dessous sont des no-op idempotents défensifs.
-- =====================================================================

BEGIN;

ALTER TABLE evenement_equipes_engagees ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenement_adversaires      ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- M3 · evenement_equipes_engagees  (lève REFONTE-EVT-write-M3/M5)
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
-- M5 · evenement_adversaires  (lève REFONTE-EVT-write-M3/M5)
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
-- Vérification fail-loud AVANT COMMIT (auto-ROLLBACK si incohérent)
-- Attendu : 6 policies write = 2 tables (M3,M5) × INSERT/UPDATE/DELETE.
-- evenement_encadrants (M8) VOLONTAIREMENT HORS PÉRIMÈTRE et HORS
-- COMPTAGE (non touché — décision Manu point 1 = option a).
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_nb_write INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nb_write
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('evenement_equipes_engagees',
                      'evenement_adversaires')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'Policies write M3/M5 : % (attendu 6)', v_nb_write;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_nb_write <> 6 THEN
    RAISE EXCEPTION
      'RLS write M3/M5 : % policies write au lieu de 6 — ROLLBACK.',
      v_nb_write;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — à lancer APRÈS le Run)
-- Attendu :
--   M3 : SELECT (préexistant, USING true) + INSERT/UPDATE/DELETE
--        (admin_or_coach)  → 4 lignes
--   M5 : idem                                                  → 4 lignes
--   M8 : NON listé ici = NON modifié (son DELETE y reste
--        admin-seul, intact — divergence tracée, non traitée).
-- =====================================================================
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('evenement_equipes_engagees',
                    'evenement_adversaires')
ORDER BY tablename, cmd, policyname;
