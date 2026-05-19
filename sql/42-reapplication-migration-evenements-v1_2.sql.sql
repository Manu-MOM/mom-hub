-- =====================================================================
-- MOM HUB · RÉ-APPLICATION MIGRATION ÉVÉNEMENTS v1.2 (M1→M8) — IDEMPOTENTE
-- =====================================================================
-- Auteur  : conv Production · Évènements (réouverture ciblée
--           « retouche post-migration evenements », assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- MOTIF (EVT-CREATE-CHECK, tranché par le fait — diagnostic) :
--   Création d'évènement KO : « new row for relation "evenements"
--   violates check constraint "evenements_type_check" ».
--   Constat à la source : la base est INTÉGRALEMENT en état
--   PRÉ-sql/40 (8 CHECK anciens dont evenements_format_obligatoire ;
--   31 lignes valeurs anciennes ; colonne recurrence absente ;
--   tables M3/M5 absentes). Le client déployé (evenements.html 3
--   familles + evenements-browser.js v1.18, familleReelle l.620)
--   émet, à raison, type_evenement='competition' (modèle v1.2
--   tranché) — que le CHECK ancien encore en base refuse. La
--   régression est EN BASE : sql/40 n'a pas persisté (jamais
--   exécuté OU exécuté puis ROLLBACK atomique — base identique
--   dans les deux cas). Le geste correctif est SQL/base ;
--   evenements.html / evenements-browser.js NE SONT PAS touchés
--   (prouvés conformes au modèle v1.2).
--
-- RAPPORT À sql/40-migration-evenements-v1_2.sql :
--   sql/40 reste l'enregistrement historique de la migration v1.2
--   (NON réécrit). Ce fichier vise EXACTEMENT le même état-cible
--   v1.2 (M1→M8). DIFF vs sql/40 = AJOUT de gardes d'idempotence
--   UNIQUEMENT (DROP…IF EXISTS · ADD COLUMN IF NOT EXISTS ·
--   CREATE TABLE/INDEX IF NOT EXISTS · DROP POLICY/TRIGGER IF
--   EXISTS avant CREATE). Aucun corps de CHECK, aucune définition
--   de table, aucun prédicat d'UPDATE, aucun seuil du bloc DO
--   n'est modifié (prouvé par diff).
--
-- VÉRIFICATIONS §5.0 — RÉSULTATS RÉELS EN BASE (re-confirmés 19/05) :
--   V1 type_competition='coupe' = 0 · V2 format_de_jeu='5' = 0
--   V3 (31 lignes) : entrainement 17 inchangé · championnat 1 →
--      match_championnat · amical 2 → match_amical · match/tournoi
--      tournoi 11 → competition / tournoi · tournoi/tournoi 5 →
--      competition / tournoi. Cible : 14 competition · 17
--      entrainement · 0 stage. Aucune donnée 'coupe'/'5' écrasée.
--
-- IDEMPOTENT : OUI. Rejouable depuis l'état pristine pré-sql/40,
--   depuis un état partiel (coupure SQL Editor), ou depuis l'état
--   v1.2 déjà atteint — converge sur le même état-cible v1.2.
--   Transaction unique (BEGIN…COMMIT) : tout ou rien ; le bloc DO
--   ROLLBACK reste le filet de sécurité de sql/40, conservé tel
--   quel.
--
-- HORS PÉRIMÈTRE (tracé, NON traité ici — une conv = un sujet) :
--   les tables M3/M5 sont (re)créées en SELECT-only, conformes à
--   sql/40 (aucune policy write). Le câblage write M3/M5 (passe
--   « Session RLS write », déjà reflétée dans evenements-browser.js
--   v1.18 / supabase-client.js v1.18, AVANT ce STATE de référence)
--   est un AUTRE chantier (REFONTE-EVT-write-M3/M5) : une fois ces
--   tables créées par ce correctif, la passe Session RLS write
--   pourra devoir être (re)jouée pour poser les policies write —
--   NON fait ici, simplement signalé comme dépendance.
--
-- À exécuter : Supabase > SQL Editor > New query > coller > Run.
--   En cas de coupure : RE-lancer le fichier ENTIER (idempotent).
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- M1 · type_evenement : 5 valeurs techniques → 3 familles
-- ─────────────────────────────────────────────────────────────────────
-- Retrait des 3 CHECK interdépendants (les noms sont réutilisés pour la
-- version v1.2, sauf evenements_format_obligatoire SUPPRIMÉE
-- définitivement). DROP … IF EXISTS : couvre l'état pristine (ancien
-- CHECK présent) ET l'état déjà-migré (CHECK v1.2 présent, même nom).
ALTER TABLE evenements DROP CONSTRAINT IF EXISTS evenements_type_check;
ALTER TABLE evenements DROP CONSTRAINT IF EXISTS evenements_equipe_obligatoire_si_pas_parent;
ALTER TABLE evenements DROP CONSTRAINT IF EXISTS evenements_format_obligatoire;

-- Remap V3 : match / tournoi / journee_championnat → competition (14 l.).
-- 'entrainement' (17) et 'stage' (0) inchangés. Naturellement idempotent
-- (second passage : aucune ligne ne matche, no-op). DOIT précéder le
-- ré-ajout du CHECK type (ordre de sql/40 strictement conservé).
UPDATE evenements SET type_evenement = 'competition'
  WHERE type_evenement IN ('match', 'tournoi', 'journee_championnat');

ALTER TABLE evenements ADD CONSTRAINT evenements_type_check CHECK (
  type_evenement IN ('competition', 'entrainement', 'stage')
);

-- CHECK équipe relâché au minimum garanti par ligne (P4) — corps
-- IDENTIQUE à sql/40 :
--   entrainement / stage  → equipe_id obligatoire
--   competition           → equipe_id libre (équipes via M3, ou
--                            conteneur / phase-boîte ; « ≥ 1 équipe
--                            engagée » porté par l'UI/RPC).
ALTER TABLE evenements ADD CONSTRAINT evenements_equipe_obligatoire_si_pas_parent CHECK (
  (type_evenement IN ('entrainement', 'stage') AND equipe_id IS NOT NULL)
  OR (type_evenement = 'competition')
);

-- ─────────────────────────────────────────────────────────────────────
-- M1 + M7 · type_competition : 4 → 10 valeurs (référentiel)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE evenements DROP CONSTRAINT IF EXISTS evenements_competition_check;

-- Remap V3 (valeurs ; indépendant de type_evenement). Idempotent.
UPDATE evenements SET type_competition = 'match_championnat' WHERE type_competition = 'championnat';  --  1 ligne
UPDATE evenements SET type_competition = 'match_amical'      WHERE type_competition = 'amical';        --  2 lignes
-- 'tournoi' : inchangé (11 lignes ; code conservé dans la nouvelle liste).
-- 'coupe'   : V1 = 0 → aucun UPDATE (suppression nette du domaine seul).

ALTER TABLE evenements ADD CONSTRAINT evenements_competition_check CHECK (
  type_competition IS NULL OR type_competition IN (
    'match_amical', 'match_championnat', 'plateau', 'tournoi',
    'championnat_phase_1', 'championnat_phase_2', 'championnat_phases_finales',
    'challenge_vie', 'challenge_inter_ligues', 'seven'
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- M4 · format_de_jeu : 5 → 7 valeurs (codes déployés XV / X conservés)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE evenements DROP CONSTRAINT IF EXISTS evenements_format_check;
-- '5' : V2 = 0 → aucun UPDATE (suppression nette du domaine seul).
ALTER TABLE evenements ADD CONSTRAINT evenements_format_check CHECK (
  format_de_jeu IS NULL OR format_de_jeu IN ('XV', '13', '12', 'X', '9', '8', '7')
);

-- ─────────────────────────────────────────────────────────────────────
-- M2 · récurrence : colonne additive nullable (non bloquant)
-- ─────────────────────────────────────────────────────────────────────
-- Structure libre assumée (P1/P3), non interprétée par un CHECK.
ALTER TABLE evenements ADD COLUMN IF NOT EXISTS recurrence JSONB;

-- ─────────────────────────────────────────────────────────────────────
-- M3 · table de liaison équipes engagées (+ override format M4)
-- ─────────────────────────────────────────────────────────────────────
-- Définition STRICTEMENT identique à sql/40 (patron déployé :
-- uuid_generate_v4(), _id, RLS SELECT authenticated, AUCUNE policy
-- write, trigger_set_updated_at).
CREATE TABLE IF NOT EXISTS evenement_equipes_engagees (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evenement_id   UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  equipe_id      UUID NOT NULL REFERENCES equipes(id)    ON DELETE RESTRICT,
  format_de_jeu  TEXT,
  ordre          INTEGER,
  notes          TEXT,
  cree_par       UUID REFERENCES personnes(id) ON DELETE SET NULL,
  date_creation  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT evt_equipes_unique UNIQUE (evenement_id, equipe_id),
  CONSTRAINT evt_equipes_format_check CHECK (
    format_de_jeu IS NULL OR format_de_jeu IN ('XV', '13', '12', 'X', '9', '8', '7')
  )
);
CREATE INDEX IF NOT EXISTS idx_evt_equipes_evenement ON evenement_equipes_engagees(evenement_id);
CREATE INDEX IF NOT EXISTS idx_evt_equipes_equipe    ON evenement_equipes_engagees(equipe_id);
ALTER TABLE evenement_equipes_engagees ENABLE ROW LEVEL SECURITY;  -- no-op si déjà actif
DROP POLICY IF EXISTS evt_equipes_select_authenticated ON evenement_equipes_engagees;
CREATE POLICY evt_equipes_select_authenticated
  ON evenement_equipes_engagees FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS set_updated_at_evt_equipes ON evenement_equipes_engagees;
CREATE TRIGGER set_updated_at_evt_equipes
  BEFORE UPDATE ON evenement_equipes_engagees
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- M5 · adversaires par équipe engagée (compétitions SANS phases)
-- ─────────────────────────────────────────────────────────────────────
-- Compétitions À phases : l'adversaire reste porté par le match via
-- evenements.adversaire_nom (colonne déjà existante — zéro duplication).
CREATE TABLE IF NOT EXISTS evenement_adversaires (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evenement_equipe_id  UUID NOT NULL REFERENCES evenement_equipes_engagees(id) ON DELETE CASCADE,
  adversaire_nom       TEXT NOT NULL,
  ordre                INTEGER,
  notes                TEXT,
  date_creation        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evt_adv_equipe ON evenement_adversaires(evenement_equipe_id);
ALTER TABLE evenement_adversaires ENABLE ROW LEVEL SECURITY;  -- no-op si déjà actif
DROP POLICY IF EXISTS evt_adv_select_authenticated ON evenement_adversaires;
CREATE POLICY evt_adv_select_authenticated
  ON evenement_adversaires FOR SELECT TO authenticated USING (true);

-- M6 · aucune DDL (réutilise evenement_parent_id + phase_libelle + ordre_dans_phase)
-- M7 · rebranchement classes CSS ↔ valeurs : côté Production/Conception (hors SQL, §5.2)
-- M8 · aucune DDL (evenement_encadrants déjà déployée ; P2-E.4 = policies write + UI)

-- ─────────────────────────────────────────────────────────────────────
-- Vérification structurelle + données post-migration (avant COMMIT)
-- Bloc CONSERVÉ IDENTIQUE à sql/40 (filet de sécurité ; seuils inchangés).
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_nb_check_evt     INTEGER;
  v_has_format_oblig INTEGER;
  v_has_recurrence   INTEGER;
  v_nb_tables_new    INTEGER;
  v_nb_competition   INTEGER;
  v_nb_entrainement  INTEGER;
  v_nb_stage         INTEGER;
  v_viol_type        INTEGER;
  v_viol_compet      INTEGER;
  v_viol_format      INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nb_check_evt
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name = 'evenements'
    AND constraint_type = 'CHECK';

  SELECT COUNT(*) INTO v_has_format_oblig
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name = 'evenements'
    AND constraint_name = 'evenements_format_obligatoire';

  SELECT COUNT(*) INTO v_has_recurrence
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'evenements'
    AND column_name = 'recurrence';

  SELECT COUNT(*) INTO v_nb_tables_new
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('evenement_equipes_engagees', 'evenement_adversaires');

  SELECT COUNT(*) INTO v_nb_competition  FROM evenements WHERE type_evenement = 'competition';
  SELECT COUNT(*) INTO v_nb_entrainement FROM evenements WHERE type_evenement = 'entrainement';
  SELECT COUNT(*) INTO v_nb_stage        FROM evenements WHERE type_evenement = 'stage';

  SELECT COUNT(*) INTO v_viol_type
  FROM evenements WHERE type_evenement NOT IN ('competition', 'entrainement', 'stage');

  SELECT COUNT(*) INTO v_viol_compet
  FROM evenements WHERE type_competition IS NOT NULL
    AND type_competition NOT IN (
      'match_amical', 'match_championnat', 'plateau', 'tournoi',
      'championnat_phase_1', 'championnat_phase_2', 'championnat_phases_finales',
      'challenge_vie', 'challenge_inter_ligues', 'seven');

  SELECT COUNT(*) INTO v_viol_format
  FROM evenements WHERE format_de_jeu IS NOT NULL
    AND format_de_jeu NOT IN ('XV', '13', '12', 'X', '9', '8', '7');

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ CHECK sur evenements ........ : % (attendu 7)', v_nb_check_evt;
  RAISE NOTICE '✅ format_obligatoire supprimée  : % (attendu 0)', v_has_format_oblig;
  RAISE NOTICE '✅ colonne recurrence ......... : % (attendu 1)', v_has_recurrence;
  RAISE NOTICE '✅ tables M3/M5 créées ........ : % (attendu 2)', v_nb_tables_new;
  RAISE NOTICE '── Distribution type_evenement ──';
  RAISE NOTICE '   competition .. : % (attendu 14)', v_nb_competition;
  RAISE NOTICE '   entrainement . : % (attendu 17)', v_nb_entrainement;
  RAISE NOTICE '   stage ........ : % (attendu 0)',  v_nb_stage;
  RAISE NOTICE '── Violations de domaine (toutes attendues = 0) ──';
  RAISE NOTICE '   type ......... : %', v_viol_type;
  RAISE NOTICE '   competition .. : %', v_viol_compet;
  RAISE NOTICE '   format ....... : %', v_viol_format;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_viol_type + v_viol_compet + v_viol_format > 0
     OR v_has_format_oblig <> 0
     OR v_has_recurrence <> 1
     OR v_nb_tables_new <> 2 THEN
    RAISE EXCEPTION 'Ré-application v1.2 : état post-migration incohérent — ROLLBACK.';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Note : idempotent. Si le bloc DO lève (RAISE EXCEPTION), toute la
-- transaction est annulée (aucune mutation persistée) ; corriger la
-- cause signalée par les NOTICE puis re-lancer le fichier ENTIER.
-- Retour arrière post-COMMIT (si besoin) = migration inverse, cf. le
-- bloc commenté en fin de sql/40 (non dupliqué ici).
-- =====================================================================
