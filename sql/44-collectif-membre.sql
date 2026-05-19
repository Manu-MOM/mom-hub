-- =====================================================================
-- MOM HUB · N1 · collectif_membre (appartenance-métier personne↔catégorie/saison)
-- =====================================================================
-- Auteur  : conv Production · Implémentation Collectif & compo 3 niveaux
--           (assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- SOURCE FAIT FOI : Modelisation-Collectif-Compo-3-Niveaux-v1.md v1.1 §2
-- (modèle non rouvert). DDL conceptuel §2.1 figé ici, confronté au
-- schéma RÉELLEMENT déployé (le code déployé fait foi, jamais le doc) :
--   • personnes.id / ententes.id + UNIQUE(saison_id,categorie_id)
--     -> sql/01-creation-tables-vague1.sql (lus à la source).
--   • Patron daté = equipe_joueurs (sql/01) que le modèle invoque
--     (N1-4/N1-5) : date_debut/date_fin, statut, CHECK dates, trigger.
--   • Patron métadonnées (cree_par/date_creation/updated_at) délégué
--     par le modèle §2.1 « détail Production » = patron M3 déployé
--     (evenement_equipes_engagees, sql/42).
--   • Patron RLS write = sql/43-rls-write-m3-m5-evenements-filles.sql
--     (référence VIVANTE déployée, vérifiée à la source) — JAMAIS
--     sql/41 (constaté jamais appliqué, prouvé, non re-jouable).
--   • uuid_generate_v4() = convention déployée (sql/01/18/42 ;
--     extension uuid-ossp présente, prouvée par sql/01 déployé).
--
-- ARBITRAGE T1 (tranché par Manu, option A) : personne_id / entente_id
--   = ON DELETE CASCADE (aligné patron equipe_joueurs déployé que le
--   modèle cite ; DI-CHR-1 = procédure RGPD dédiée distincte, pas un
--   invariant de FK).
--
-- ADAPTATION INDEX assumée (doctrine simplicité P1, pas de redondance) :
--   La contrainte UNIQUE(personne_id,entente_id,role,date_debut) crée
--   un btree menant par personne_id -> un index autonome personne_id
--   serait REDONDANT (≠ equipe_joueurs où l'UNIQUE mène par equipe_id).
--   On ne pose donc QUE les index non couverts : entente_id (requête
--   vivier U-N2, non préfixe de l'UNIQUE) + partiel actifs (miroir
--   exact idx_equipe_joueurs_actifs, WHERE date_fin IS NULL).
--
-- CE FICHIER NE FAIT QUE : créer la table N1 + ses index + son trigger
--   + sa RLS (patron sql/43 répliqué). Ne touche AUCUNE autre table.
--   N'absorbe NI IDENT-SYS NI ADMIN-(ii) (autorisation par rôle seule,
--   aucun mapping auth->personnes — cohérent C12-j/sql/43).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- PRÉALABLE : sql/01 (personnes, ententes, trigger_set_updated_at).
-- IDEMPOTENT : OUI (CREATE TABLE/INDEX IF NOT EXISTS ; DROP TRIGGER/
--   POLICY IF EXISTS + CREATE ; ALTER ENABLE RLS = no-op si déjà actif).
-- Transaction ; bloc DO fail-loud AVANT COMMIT (auto-ROLLBACK si le
-- compte exact n'est pas atteint — discipline sql/40/42/43).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Table collectif_membre (modèle §2.1, non rouvert)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collectif_membre (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Appartenance : personne ↔ entente (ententes porte catégorie+saison
  -- nativement via UNIQUE(saison_id,categorie_id) — sql/01, N1-1)
  personne_id   UUID NOT NULL REFERENCES personnes(id) ON DELETE CASCADE,  -- T1 = A
  entente_id    UUID NOT NULL REFERENCES ententes(id)  ON DELETE CASCADE,  -- T1 = A

  -- Rôle porté nativement par N1 (N1-3 : débloque le Staff ; N2 le lit,
  -- zéro champ neuf en N2 — N2-6)
  role          TEXT NOT NULL,

  -- Qualifie la pioche (P3), nullable & droppable (N1-5) — distinct du
  -- statut d'affectation equipe_joueurs (deux questions)
  statut        TEXT,

  -- Période datée ; passé immuable, jamais réécrit (N1-4, patron
  -- equipe_joueurs déployé)
  date_debut    DATE NOT NULL,
  date_fin      DATE,                                  -- NULL = appartenance courante

  -- Métadonnées : patron M3 déployé (sql/42), délégué par le modèle §2.1
  cree_par      UUID REFERENCES personnes(id) ON DELETE SET NULL,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT collectif_membre_role_check
    CHECK (role IN ('joueur', 'staff')),
  CONSTRAINT collectif_membre_statut_check
    CHECK (statut IS NULL OR statut IN ('regulier', 'renfort_temporaire', 'en_transition')),
  CONSTRAINT collectif_membre_dates_check
    CHECK (date_fin IS NULL OR date_fin >= date_debut),       -- miroir equipe_joueurs

  -- Unicité = modèle §2.1 verbatim
  CONSTRAINT collectif_membre_unique
    UNIQUE (personne_id, entente_id, role, date_debut)
);

-- Index : entente_id (requête vivier U-N2, NON préfixe de l'UNIQUE) +
-- partiel actifs (miroir exact idx_equipe_joueurs_actifs).
CREATE INDEX IF NOT EXISTS idx_collectif_membre_entente
  ON collectif_membre (entente_id);

CREATE INDEX IF NOT EXISTS idx_collectif_membre_actifs
  ON collectif_membre (entente_id, personne_id)
  WHERE date_fin IS NULL;

-- Trigger updated_at (réutilise trigger_set_updated_at() — sql/01)
DROP TRIGGER IF EXISTS set_updated_at_collectif_membre ON collectif_membre;
CREATE TRIGGER set_updated_at_collectif_membre
  BEFORE UPDATE ON collectif_membre
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------
-- 2 · RLS — patron sql/43 répliqué (jamais sql/41), idempotent
--     SELECT authenticated USING true  (patron sql/18/sql/42, table neuve)
--     INSERT/UPDATE/DELETE has_role('admin') OR has_role('coach')
--       (patron sql/43, Arbitrage Option A — miroir, non réinventé)
-- ---------------------------------------------------------------------
ALTER TABLE collectif_membre ENABLE ROW LEVEL SECURITY;  -- no-op si déjà actif

DROP POLICY IF EXISTS collectif_membre_select_authenticated  ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_insert_admin_or_coach ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_update_admin_or_coach ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_delete_admin_or_coach ON collectif_membre;

CREATE POLICY collectif_membre_select_authenticated
  ON collectif_membre FOR SELECT TO authenticated
  USING (true);

CREATE POLICY collectif_membre_insert_admin_or_coach
  ON collectif_membre FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY collectif_membre_update_admin_or_coach
  ON collectif_membre FOR UPDATE TO authenticated
  USING      (has_role('admin') OR has_role('coach'))
  WITH CHECK (has_role('admin') OR has_role('coach'));

CREATE POLICY collectif_membre_delete_admin_or_coach
  ON collectif_membre FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('coach'));

-- ---------------------------------------------------------------------
-- 3 · Vérification fail-loud AVANT COMMIT (auto-ROLLBACK si incohérent)
--     Attendu : table=1 · policies=4 (1 SELECT + 3 write) · trigger=1
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_table   INTEGER;
  v_pol     INTEGER;
  v_trig    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'collectif_membre';

  SELECT COUNT(*) INTO v_pol
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'collectif_membre';

  SELECT COUNT(*) INTO v_trig
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table = 'collectif_membre'
    AND trigger_name = 'set_updated_at_collectif_membre';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'collectif_membre : table=% (att.1) · policies=% (att.4) · trigger=% (att.1)',
               v_table, v_pol, v_trig;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_table <> 1 OR v_pol <> 4 OR v_trig <> 1 THEN
    RAISE EXCEPTION
      'N1 collectif_membre incohérent (table=%, policies=%, trigger=%) — ROLLBACK.',
      v_table, v_pol, v_trig;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — à lancer APRÈS le Run)
-- Attendu : 1 SELECT (authenticated, USING true) + INSERT/UPDATE/DELETE
-- (admin_or_coach) = 4 lignes. has_role(...) non qualifié = miroir
-- exact du rendu sql/43 / policies evenements déployées.
-- =====================================================================
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'collectif_membre'
ORDER BY cmd, policyname;
