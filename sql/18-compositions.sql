-- =====================================================================
-- sql/18-compositions.sql
-- =====================================================================
-- Phase 4.3 — Création des 2 tables compositions :
--   - compositions          (entité globale, versioning par événement)
--   - composition_joueurs   (détail : un joueur sur un poste dans la compo)
--
-- Référence : Modelisation-Evenements-v1.1.md §4.3 (Drive fileId
-- 1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u).
--
-- Adaptations vs doc modélisation (cohérence Production / Vague 1) :
--   - Naming `_id` partout (au lieu de `_uuid` du doc)
--   - uuid_generate_v4() (au lieu de gen_random_uuid())
--   - created_at / updated_at (au lieu de date_creation / date_derniere_modification)
--   - poste_id TEXT (au lieu de poste_uuid TEXT — référentiel postes.json Drive)
--
-- États compositions : 'brouillon' / 'validee' / 'jouee' (fidèle doc §4.3,
-- pas le triplet creation/validee/archive évoqué un temps en cadrage).
--
-- RLS : SELECT TO authenticated. Pas de policy WRITE (reste service_role,
-- dette (i) à grouper avec la session RLS write par rôle).
--
-- Préalables exécutés :
--   - sql/10-noyau-evenements.sql (table evenements existe)
--   - sql/01-creation-tables-vague1.sql (table personnes + fonction
--                                        trigger_set_updated_at() existent)
--
-- Auteur : conv Production · 14 mai 2026
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Table compositions (entité globale, versionning par événement)
-- ---------------------------------------------------------------------

CREATE TABLE compositions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Rattachement
  evenement_id    UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,

  -- Typage côté (strict 'mom' tant que la compo adverse n'est pas modélisée,
  -- cf. dette C1 du doc modélisation §9.2)
  cote            TEXT NOT NULL DEFAULT 'mom',

  -- État métier
  etat            TEXT NOT NULL DEFAULT 'brouillon',

  -- Versioning : plusieurs compos possibles par (événement, côté), une seule
  -- active à la fois (cf. index unique partiel ci-dessous)
  version         INTEGER NOT NULL DEFAULT 1,
  est_active      BOOLEAN NOT NULL DEFAULT TRUE,

  -- Notes libres du coach
  notes_compo     TEXT,

  -- Métadonnées (pattern Vague 1)
  cree_par        UUID REFERENCES personnes(id),
  modifie_par     UUID REFERENCES personnes(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT compositions_cote_check    CHECK (cote = 'mom'),
  CONSTRAINT compositions_etat_check    CHECK (etat IN ('brouillon', 'validee', 'jouee')),
  CONSTRAINT compositions_version_check CHECK (version >= 1)
);

-- Index unique partiel : 1 seule compo active par (événement, côté)
CREATE UNIQUE INDEX idx_compositions_active_per_event_cote
  ON compositions (evenement_id, cote)
  WHERE est_active = TRUE;

CREATE INDEX idx_compositions_evenement ON compositions (evenement_id);
CREATE INDEX idx_compositions_etat      ON compositions (etat);

-- RLS : SELECT pour authenticated, write réservé service_role (dette (i))
ALTER TABLE compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY compositions_select_authenticated
  ON compositions
  FOR SELECT
  TO authenticated
  USING (true);

-- Trigger updated_at (réutilise la fonction Vague 1 trigger_set_updated_at)
CREATE TRIGGER set_updated_at_compositions
  BEFORE UPDATE ON compositions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();


-- ---------------------------------------------------------------------
-- 2 · Table composition_joueurs (détail : un joueur sur un poste)
-- ---------------------------------------------------------------------

CREATE TABLE composition_joueurs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Rattachement à la compo
  composition_id  UUID NOT NULL REFERENCES compositions(id) ON DELETE CASCADE,

  -- Joueur : FK personnes (couvre MOM ET partenaires d'entente
  -- type_personne = licencie_externe_partenaire, cf. C7 soldée 14 mai)
  joueur_id       UUID NOT NULL REFERENCES personnes(id),

  -- Poste : référence textuelle au référentiel postes.json (Drive),
  -- format 'pst-NNN' ou 'pst-grp-NNN'. Type TEXT car référentiel non
  -- migré Supabase. Migration future possible si onglet paramètres.
  poste_id        TEXT NOT NULL,

  -- Maillot et rôle
  numero_maillot      INTEGER,                                  -- nullable (entraînements)
  role                TEXT    NOT NULL DEFAULT 'titulaire',
  ordre_remplacement  INTEGER,                                  -- nullable

  -- Cas exceptionnel : dépannage hors-catégorie (P4 avertissement UI)
  est_depannage_hors_categorie BOOLEAN NOT NULL DEFAULT FALSE,

  -- Notes
  notes_joueur    TEXT,

  -- Métadonnées (pas d'updated_at — table de détail, P1 simplicité)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT composition_joueurs_role_check
    CHECK (role IN ('titulaire', 'remplacant', 'reserve')),

  -- Un joueur ne peut figurer qu'une fois dans une compo donnée
  CONSTRAINT composition_joueurs_unique_per_compo
    UNIQUE (composition_id, joueur_id)
);

-- Un poste ne peut être occupé que par un seul titulaire par compo
-- (les remplaçants/réservistes peuvent partager un poste de référence)
CREATE UNIQUE INDEX idx_composition_joueurs_one_titulaire_per_poste
  ON composition_joueurs (composition_id, poste_id)
  WHERE role = 'titulaire';

CREATE INDEX idx_composition_joueurs_compo  ON composition_joueurs (composition_id);
CREATE INDEX idx_composition_joueurs_joueur ON composition_joueurs (joueur_id);

-- RLS : SELECT pour authenticated, write réservé service_role (dette (i))
ALTER TABLE composition_joueurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY composition_joueurs_select_authenticated
  ON composition_joueurs
  FOR SELECT
  TO authenticated
  USING (true);


-- ---------------------------------------------------------------------
-- 3 · Vérification structurelle post-création
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_nb_tables    INTEGER;
  v_nb_idx_cp    INTEGER;
  v_nb_idx_cpj   INTEGER;
  v_nb_policies  INTEGER;
  v_nb_triggers  INTEGER;
  v_nb_checks    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nb_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('compositions', 'composition_joueurs');

  SELECT COUNT(*) INTO v_nb_idx_cp
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'compositions';

  SELECT COUNT(*) INTO v_nb_idx_cpj
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'composition_joueurs';

  SELECT COUNT(*) INTO v_nb_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('compositions', 'composition_joueurs');

  SELECT COUNT(*) INTO v_nb_triggers
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table IN ('compositions', 'composition_joueurs');

  SELECT COUNT(*) INTO v_nb_checks
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name IN ('compositions', 'composition_joueurs')
    AND constraint_type = 'CHECK';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Tables créées ........... : % (attendu 2)',  v_nb_tables;
  RAISE NOTICE '✅ Index compositions ..... : % (attendu 4 : PK + 3 idx, dont 1 partiel unique)', v_nb_idx_cp;
  RAISE NOTICE '✅ Index composition_joueurs : % (attendu 5 : PK + UNIQUE per compo + 3 idx dont 1 partiel)', v_nb_idx_cpj;
  RAISE NOTICE '✅ Policies RLS ............ : % (attendu 2 : 1 SELECT par table)', v_nb_policies;
  RAISE NOTICE '✅ Triggers ................ : % (attendu 1 : set_updated_at_compositions)', v_nb_triggers;
  RAISE NOTICE '✅ CHECK constraints ....... : % (attendu 4 : cote, etat, version, role)', v_nb_checks;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- Test fonctionnel suggéré (à exécuter dans un second temps, sans
-- COMMIT — laisser ROLLBACK pour ne pas polluer la base) :
--
--   BEGIN;
--
--   -- Récupérer un événement test (Les Gemmeurs M14, J+9)
--   WITH e AS (
--     SELECT id FROM evenements
--     WHERE code = 'EVT-2026-05-23-LES-GEMMEURS-M14' LIMIT 1
--   )
--   INSERT INTO compositions (evenement_id, cote, etat, version)
--   SELECT e.id, 'mom', 'brouillon', 1 FROM e
--   RETURNING id;
--
--   -- Tenter une 2e compo active sur le même événement : doit échouer
--   -- (violation idx_compositions_active_per_event_cote)
--
--   ROLLBACK;
--
-- =====================================================================

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--
--   DROP TABLE IF EXISTS composition_joueurs CASCADE;
--   DROP TABLE IF EXISTS compositions        CASCADE;
-- =====================================================================
