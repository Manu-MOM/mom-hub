-- =====================================================================
-- MOM HUB · MIGRATION ÉVÉNEMENTS v1.1 → v1.2 (refonte M1→M8)
-- =====================================================================
-- Auteur  : conv Production · Évènements (assistance Claude)
-- Date    : 2026-05-18
-- Version : 1.0
--
-- Exécute le plan de migration de Modelisation-Evenements-v1.2.md §5.1
-- (ordre imposé). Noms de contraintes = noms RÉELS déployés
-- (sql/10-noyau-evenements.sql v1.0). Le code déployé fait foi.
--
-- Décisions M1→M8 appliquées :
--   M1  type_evenement  : 5 valeurs techniques → 3 familles
--                         (competition | entrainement | stage)
--   M1+M7 type_competition : 4 → 10 sous-types (sous-types-competition.json)
--   M4  format_de_jeu   : 5 → 7 valeurs (codes déployés conservés + 12/9/8)
--   M2  recurrence       : nouvelle colonne JSONB nullable (additive)
--   M3  evenement_equipes_engagees : NOUVELLE table de liaison
--   M5  evenement_adversaires      : NOUVELLE table
--   M6  : aucune DDL (réutilise evenement_parent_id + phase_libelle
--         + ordre_dans_phase déjà déployés)
--   M8  : aucune DDL (evenement_encadrants déjà déployée ; P2-E.4 = write+UI)
--   P4  : CHECK de cohérence inter-champs relâchés au minimum par ligne ;
--         cohérence fine (≥1 équipe engagée, format d'un match joué) = UI/RPC
--
-- =====================================================================
-- VÉRIFICATIONS §5.0 — RÉSULTATS RÉELS EN BASE (18/05/2026)
-- =====================================================================
--   V1 · SELECT count(*) ... type_competition = 'coupe'  → 0
--        D-M7 tranché : suppression nette. AUCUN UPDATE 'coupe'.
--        'coupe' disparaît seulement du domaine du CHECK.
--   V2 · SELECT count(*) ... format_de_jeu = '5'          → 0
--        D-M4 tranché : suppression nette. AUCUN UPDATE '5'.
--        '5' disparaît seulement du domaine du CHECK.
--   V3 · répartition type_evenement / type_competition (31 lignes) :
--          entrainement       / null         : 17  → inchangé
--          journee_championnat / championnat  :  1  → competition / match_championnat
--          match               / amical       :  2  → competition / match_amical
--          match               / tournoi      :  6  → competition / tournoi
--          tournoi             / tournoi       :  5  → competition / tournoi
--        Cible : 14 competition · 17 entrainement · 0 stage.
--        Toutes les lignes resteront valides contre les nouveaux CHECK
--        (les 17 'entrainement' satisfont déjà equipe_id NOT NULL,
--         imposé par l'ancien CHECK ; vérifié).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : NON. C'est une suite d'ALTER/CREATE en UNE transaction
-- (sql/10 n'est pas idempotent). Pour rejouer : voir bloc ROLLBACK
-- en fin de fichier.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- M1 · type_evenement : 5 valeurs techniques → 3 familles
-- ─────────────────────────────────────────────────────────────────────
-- Les 3 CHECK suivants sont interdépendants (les 2 derniers référencent
-- les anciennes valeurs de type) → on les retire ensemble, on remappe,
-- on recrée la version relâchée (P4). evenements_format_obligatoire est
-- SUPPRIMÉE définitivement (sa prémisse type='match' disparaît).

ALTER TABLE evenements DROP CONSTRAINT evenements_type_check;
ALTER TABLE evenements DROP CONSTRAINT evenements_equipe_obligatoire_si_pas_parent;
ALTER TABLE evenements DROP CONSTRAINT evenements_format_obligatoire;

-- Remap V3 : match / tournoi / journee_championnat → competition (14 lignes).
-- 'entrainement' (17) et 'stage' (0) : inchangés (déjà conformes).
UPDATE evenements SET type_evenement = 'competition'
  WHERE type_evenement IN ('match', 'tournoi', 'journee_championnat');

ALTER TABLE evenements ADD CONSTRAINT evenements_type_check CHECK (
  type_evenement IN ('competition', 'entrainement', 'stage')
);

-- CHECK équipe relâché au minimum garanti par ligne (P4) :
--   entrainement / stage  → equipe_id obligatoire
--   competition           → equipe_id libre (équipes via liaison M3, ou
--                            ligne conteneur / phase-boîte) ; la règle
--                            « ≥ 1 équipe engagée » est portée par l'UI/RPC.
ALTER TABLE evenements ADD CONSTRAINT evenements_equipe_obligatoire_si_pas_parent CHECK (
  (type_evenement IN ('entrainement', 'stage') AND equipe_id IS NOT NULL)
  OR (type_evenement = 'competition')
);

-- ─────────────────────────────────────────────────────────────────────
-- M1 + M7 · type_competition : 4 → 10 valeurs (référentiel)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE evenements DROP CONSTRAINT evenements_competition_check;

-- Remap V3 (valeurs, indépendant de type_evenement) :
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
ALTER TABLE evenements DROP CONSTRAINT evenements_format_check;
-- '5' : V2 = 0 → aucun UPDATE (suppression nette du domaine seul).
ALTER TABLE evenements ADD CONSTRAINT evenements_format_check CHECK (
  format_de_jeu IS NULL OR format_de_jeu IN ('XV', '13', '12', 'X', '9', '8', '7')
);

-- ─────────────────────────────────────────────────────────────────────
-- M2 · récurrence : colonne additive nullable (non bloquant)
-- ─────────────────────────────────────────────────────────────────────
-- Structure libre assumée (P1/P3), non interprétée par un CHECK. Ex. :
-- {"jours":["mardi","jeudi"],"debut":"18:00","fin":"19:30",
--  "du":"2025-09-01","au":"2026-06-30"}
ALTER TABLE evenements ADD COLUMN recurrence JSONB;

-- ─────────────────────────────────────────────────────────────────────
-- M3 · table de liaison équipes engagées (+ override format M4)
-- ─────────────────────────────────────────────────────────────────────
-- Patron strictement calqué sur le déployé (uuid_generate_v4(), _id,
-- RLS SELECT authenticated, aucune policy write, trigger_set_updated_at).
CREATE TABLE evenement_equipes_engagees (
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
CREATE INDEX idx_evt_equipes_evenement ON evenement_equipes_engagees(evenement_id);
CREATE INDEX idx_evt_equipes_equipe    ON evenement_equipes_engagees(equipe_id);
ALTER TABLE evenement_equipes_engagees ENABLE ROW LEVEL SECURITY;
CREATE POLICY evt_equipes_select_authenticated
  ON evenement_equipes_engagees FOR SELECT TO authenticated USING (true);
CREATE TRIGGER set_updated_at_evt_equipes
  BEFORE UPDATE ON evenement_equipes_engagees
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- M5 · adversaires par équipe engagée (compétitions SANS phases)
-- ─────────────────────────────────────────────────────────────────────
-- Compétitions À phases : l'adversaire reste porté par le match via
-- evenements.adversaire_nom (colonne déjà existante — zéro duplication).
CREATE TABLE evenement_adversaires (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evenement_equipe_id  UUID NOT NULL REFERENCES evenement_equipes_engagees(id) ON DELETE CASCADE,
  adversaire_nom       TEXT NOT NULL,
  ordre                INTEGER,
  notes                TEXT,
  date_creation        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evt_adv_equipe ON evenement_adversaires(evenement_equipe_id);
ALTER TABLE evenement_adversaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY evt_adv_select_authenticated
  ON evenement_adversaires FOR SELECT TO authenticated USING (true);

-- M6 · aucune DDL (réutilise evenement_parent_id + phase_libelle + ordre_dans_phase)
-- M7 · rebranchement classes CSS ↔ valeurs : côté Production/Conception (hors SQL, §5.2)
-- M8 · aucune DDL (evenement_encadrants déjà déployée ; P2-E.4 = policies write + UI)

-- ─────────────────────────────────────────────────────────────────────
-- Vérification structurelle + données post-migration (avant COMMIT)
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
  -- Contraintes CHECK restantes sur evenements (attendu 7 :
  -- type, competition, format, etat, domicile, equipe_obligatoire, dates ;
  -- format_obligatoire SUPPRIMÉE définitivement)
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

  -- Distribution attendue : competition 14 · entrainement 17 · stage 0
  SELECT COUNT(*) INTO v_nb_competition  FROM evenements WHERE type_evenement = 'competition';
  SELECT COUNT(*) INTO v_nb_entrainement FROM evenements WHERE type_evenement = 'entrainement';
  SELECT COUNT(*) INTO v_nb_stage        FROM evenements WHERE type_evenement = 'stage';

  -- Aucune ligne ne doit violer les nouveaux domaines
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
    RAISE EXCEPTION 'Migration v1.2 : état post-migration incohérent — ROLLBACK.';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel (si problème détecté APRÈS COMMIT)
-- =====================================================================
-- La transaction se ROLLBACK seule en cas d'échec d'un ALTER ou de
-- l'EXCEPTION du bloc de vérification. Le retour arrière post-COMMIT
-- est une migration inverse (non fournie ici : aucune donnée 'coupe'/'5'
-- n'a été écrasée, V1=V2=0 ; le seul remap réversible est de valeur) :
--
--   BEGIN;
--   DROP TABLE IF EXISTS evenement_adversaires       CASCADE;
--   DROP TABLE IF EXISTS evenement_equipes_engagees  CASCADE;
--   ALTER TABLE evenements DROP COLUMN IF EXISTS recurrence;
--   -- puis restaurer les 8 CHECK d'origine de sql/10-noyau-evenements.sql
--   -- et remapper competition/entrainement (inverse V3) si nécessaire.
--   ROLLBACK;  -- (passer en COMMIT seulement après revue)
-- =====================================================================
