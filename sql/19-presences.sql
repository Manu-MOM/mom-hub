-- =====================================================================
-- sql/19-presences.sql
-- =====================================================================
-- Phase 4.3 — Création de la table presences :
-- Trace post-événement des présences réelles de joueurs ET encadrants
-- (cf. Modelisation-Evenements-v1.1.md §4.4, Drive fileId
-- 1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u).
--
-- Doctrine cadrage :
--   - Pas de table convocations (SportEasy externe, dette P4-4)
--   - Couvre joueurs ET encadrants via role_a_l_evenement
--   - 3 statuts pour démarrer (present / absent / present_partiel)
--   - Lien optionnel composition_joueur_id pour requêter "convoqué vs venu"
--   - 1 ligne unique par (evenement, personne)
--
-- Adaptations vs doc modélisation (cohérence Production / Vague 1) :
--   - Naming `_id` partout (au lieu de `_uuid`)
--   - uuid_generate_v4()
--   - created_at + updated_at (au lieu de date_saisie seule)
--   - Trigger set_updated_at_presences (pattern Phase 4.2)
--
-- RLS : SELECT TO authenticated. Pas de policy WRITE (dette (i)).
--
-- Préalables :
--   - sql/10-noyau-evenements.sql (evenements)
--   - sql/18-compositions.sql     (composition_joueurs pour FK optionnelle)
--   - sql/01-creation-tables-vague1.sql (personnes + trigger_set_updated_at)
--
-- Auteur : conv Production · 14 mai 2026
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Table presences
-- ---------------------------------------------------------------------

CREATE TABLE presences (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Rattachement événement (CASCADE : si on supprime l'événement, les
  -- présences associées disparaissent — cohérent doc §4.4)
  evenement_id           UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,

  -- Personne concernée (FK personnes — couvre MOM + partenaires d'entente +
  -- encadrants, tous unifiés dans personnes depuis C7 soldée le 14 mai)
  personne_id            UUID NOT NULL REFERENCES personnes(id),

  -- Rôle de la personne sur cet événement précis (un joueur peut être
  -- encadrant sur un autre événement, d'où le rattachement par ligne et
  -- pas une déduction depuis personnes.type_personne)
  role_a_l_evenement     TEXT NOT NULL,

  -- Statut de présence (3 valeurs minimales pour passe 1 ; à enrichir
  -- selon usage : absent_excuse, absent_blesse, absent_indispo…)
  statut                 TEXT NOT NULL DEFAULT 'present',

  -- Complément texte libre (raison de l'absence, durée partielle, etc.)
  motif_libre            TEXT,

  -- Lien optionnel avec la compo : permet de requêter "qui était convoqué
  -- dans la compo et qui n'est pas venu". Nullable car le coach peut
  -- saisir les présences indépendamment de la compo.
  composition_joueur_id  UUID REFERENCES composition_joueurs(id) ON DELETE SET NULL,

  -- Métadonnées
  saisie_par             UUID REFERENCES personnes(id),  -- qui a saisi (admin/coach)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT presences_role_check
    CHECK (role_a_l_evenement IN ('joueur', 'encadrant', 'autre')),

  CONSTRAINT presences_statut_check
    CHECK (statut IN ('present', 'absent', 'present_partiel')),

  -- Une personne ne peut avoir qu'une ligne par événement
  CONSTRAINT presences_unique_per_event_personne
    UNIQUE (evenement_id, personne_id)
);

CREATE INDEX idx_presences_evenement ON presences (evenement_id);
CREATE INDEX idx_presences_personne  ON presences (personne_id);
CREATE INDEX idx_presences_statut    ON presences (statut);
CREATE INDEX idx_presences_role      ON presences (role_a_l_evenement);

-- RLS : SELECT pour authenticated, write réservé service_role (dette (i))
ALTER TABLE presences ENABLE ROW LEVEL SECURITY;

CREATE POLICY presences_select_authenticated
  ON presences
  FOR SELECT
  TO authenticated
  USING (true);

-- Trigger updated_at (pattern Phase 4.2)
CREATE TRIGGER set_updated_at_presences
  BEFORE UPDATE ON presences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();


-- ---------------------------------------------------------------------
-- 2 · Vérification structurelle post-création
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_nb_tables    INTEGER;
  v_nb_indexes   INTEGER;
  v_nb_policies  INTEGER;
  v_nb_triggers  INTEGER;
  v_nb_checks    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nb_tables
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'presences';

  SELECT COUNT(*) INTO v_nb_indexes
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'presences';

  SELECT COUNT(*) INTO v_nb_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'presences';

  SELECT COUNT(*) INTO v_nb_triggers
  FROM information_schema.triggers
  WHERE event_object_schema = 'public' AND event_object_table = 'presences';

  -- Compte uniquement les CHECK explicites (pg_constraint.contype='c'),
  -- exclut les NOT NULL implicites
  SELECT COUNT(*) INTO v_nb_checks
  FROM pg_constraint c
  JOIN pg_class      t ON c.conrelid = t.oid
  JOIN pg_namespace  n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'presences'
    AND c.contype = 'c';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Table presences ........ : % (attendu 1)', v_nb_tables;
  RAISE NOTICE '✅ Index presences ........ : % (attendu 6 : PK + UNIQUE per event/personne + 4 idx)', v_nb_indexes;
  RAISE NOTICE '✅ Policies RLS ........... : % (attendu 1 : SELECT authenticated)', v_nb_policies;
  RAISE NOTICE '✅ Triggers ............... : % (attendu 1 : set_updated_at_presences)', v_nb_triggers;
  RAISE NOTICE '✅ CHECK explicites ....... : % (attendu 2 : role + statut)', v_nb_checks;
  RAISE NOTICE '────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- Test fonctionnel suggéré (après sql/21 et test bout-en-bout) :
--   INSERT INTO presences (evenement_id, personne_id, role_a_l_evenement, statut)
--   SELECT
--     (SELECT id FROM evenements WHERE code = 'EVT-2026-05-23-LES-GEMMEURS-M14'),
--     (SELECT joueur_id FROM composition_joueurs LIMIT 1),
--     'joueur',
--     'present';
-- =====================================================================

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--   DROP TABLE IF EXISTS presences CASCADE;
-- =====================================================================
