-- =====================================================================
-- MOM HUB · N2 · equipe_engagee_membre (compo de base par équipe engagée)
-- =====================================================================
-- Auteur  : conv Production · Implémentation Collectif & compo 3 niveaux
--           (assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- SOURCE FAIT FOI : Modelisation-Collectif-Compo-3-Niveaux-v1.md v1.1 §3
-- (modèle non rouvert). DDL conceptuel §3.1 figé ici, confronté au
-- schéma RÉELLEMENT déployé (le code déployé fait foi) :
--   • evenement_equipes_engagees.id (M3, sql/42) — cible FK ;
--     M5->M3 ON DELETE CASCADE déjà déployée (cohérence cascade).
--   • collectif_membre(id) — N1 (sql/44, exécuté AVANT ce fichier).
--   • Patron RLS write = sql/43 (référence VIVANTE) — JAMAIS sql/41.
--
-- N2-4 : LISTE VIVANTE, NON VERSIONNÉE -> ZÉRO champ neuf (pas de
--   created_at/updated_at, pas de trigger ; miroir composition_joueurs
--   « table de détail, P1 simplicité »). Le versioning vit en N3
--   (compositions, PI-7) — le dupliquer = 2ᵉ source de vérité (anti).
-- N2-6/N2-2 : rôle joueur|staff lu via collectif_membre.role (N1) —
--   AUCUN champ rôle en N2. Comptage séparé joueurs/staff = porté UX.
-- N2-7 : frontière N2↔M8 (staff par équipe engagée vs staff de
--   l'événement, M8 evenement_encadrants) — NON fusionnée (modèle).
--
-- ARBITRAGE T1 (tranché par Manu, option A) : collectif_membre_id
--   ON DELETE CASCADE ; evenement_equipe_id ON DELETE CASCADE (N2-3 :
--   décocher une équipe engagée nettoie son groupe — cohérent cascade
--   M3->M5 déployée).
--
-- ADAPTATION INDEX assumée (doctrine simplicité P1, pas de redondance) :
--   UNIQUE(evenement_equipe_id,collectif_membre_id) crée un btree
--   menant par evenement_equipe_id -> les requêtes « membres convoqués
--   de cette équipe engagée » (U-N2 droite / U-N3 pioche) sont déjà
--   servies. On ne pose QUE l'index non couvert : collectif_membre_id
--   (cumul inter-équipes UN2-3 : « où ce membre est-il convoqué »).
--
-- CE FICHIER NE FAIT QUE : créer la table N2 + son index + sa RLS
--   (patron sql/43). Ne touche AUCUNE autre table. N'absorbe NI
--   IDENT-SYS NI ADMIN-(ii) (autorisation par rôle seule).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- PRÉALABLE : sql/44 (collectif_membre) ; sql/42 (M3). ORDRE STRICT :
--   44 (N1) -> 45 (N2, ce fichier) -> 46 (N3).
-- IDEMPOTENT : OUI (CREATE TABLE/INDEX IF NOT EXISTS ; DROP POLICY
--   IF EXISTS + CREATE ; ALTER ENABLE RLS = no-op si déjà actif).
-- Transaction ; bloc DO fail-loud AVANT COMMIT (auto-ROLLBACK).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Table equipe_engagee_membre (modèle §3.1, non rouvert)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipe_engagee_membre (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Rend la compo de base propre à l'événement ET par équipe A/B (Q1).
  -- Décocher l'équipe engagée nettoie son groupe (N2-3, cohérent M3->M5)
  evenement_equipe_id UUID NOT NULL
    REFERENCES evenement_equipes_engagees(id) ON DELETE CASCADE,

  -- Pioche DANS le collectif N1 (N2-2, chaînage strict N1->N2->N3).
  -- joueur OU staff : rôle lu via collectif_membre.role (N2-6, zéro
  -- champ neuf)
  collectif_membre_id UUID NOT NULL
    REFERENCES collectif_membre(id) ON DELETE CASCADE,                 -- T1 = A

  -- Vrai doublon (même membre 2× dans la même équipe engagée) empêché ;
  -- cumul inter-équipes A ET B autorisé (N3-5, unicité fine)
  CONSTRAINT equipe_engagee_membre_unique
    UNIQUE (evenement_equipe_id, collectif_membre_id)
);

-- Index : collectif_membre_id (cumul inter-équipes UN2-3, NON préfixe
-- de l'UNIQUE). L'accès par evenement_equipe_id est servi par l'UNIQUE.
CREATE INDEX IF NOT EXISTS idx_equipe_engagee_membre_collectif
  ON equipe_engagee_membre (collectif_membre_id);

-- ---------------------------------------------------------------------
-- 2 · RLS — patron sql/43 répliqué (jamais sql/41), idempotent
-- ---------------------------------------------------------------------
ALTER TABLE equipe_engagee_membre ENABLE ROW LEVEL SECURITY;  -- no-op si déjà actif

DROP POLICY IF EXISTS equipe_engagee_membre_select_authenticated  ON equipe_engagee_membre;
DROP POLICY IF EXISTS equipe_engagee_membre_insert_admin_or_coach ON equipe_engagee_membre;
DROP POLICY IF EXISTS equipe_engagee_membre_update_admin_or_coach ON equipe_engagee_membre;
DROP POLICY IF EXISTS equipe_engagee_membre_delete_admin_or_coach ON equipe_engagee_membre;

CREATE POLICY equipe_engagee_membre_select_authenticated
  ON equipe_engagee_membre FOR SELECT TO authenticated
  USING (true);

CREATE POLICY equipe_engagee_membre_insert_admin_or_coach
  ON equipe_engagee_membre FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY equipe_engagee_membre_update_admin_or_coach
  ON equipe_engagee_membre FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY equipe_engagee_membre_delete_admin_or_coach
  ON equipe_engagee_membre FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('coach'));

-- ---------------------------------------------------------------------
-- 3 · Vérification fail-loud AVANT COMMIT (auto-ROLLBACK si incohérent)
--     Attendu : table=1 · policies=4 (1 SELECT + 3 write)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_table INTEGER;
  v_pol   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'equipe_engagee_membre';

  SELECT COUNT(*) INTO v_pol
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'equipe_engagee_membre';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'equipe_engagee_membre : table=% (att.1) · policies=% (att.4)',
               v_table, v_pol;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_table <> 1 OR v_pol <> 4 THEN
    RAISE EXCEPTION
      'N2 equipe_engagee_membre incohérent (table=%, policies=%) — ROLLBACK.',
      v_table, v_pol;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — à lancer APRÈS le Run)
-- Attendu : 1 SELECT (authenticated, USING true) + INSERT/UPDATE/DELETE
-- (admin_or_coach) = 4 lignes.
-- =====================================================================
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'equipe_engagee_membre'
ORDER BY cmd, policyname;
