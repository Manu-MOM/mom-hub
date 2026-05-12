-- =====================================================================
-- MOM HUB · PHASE 4.2.A · NOYAU ÉVÉNEMENTS
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-13
-- Version : 1.0
--
-- Crée les 2 tables du noyau événements modélisées dans
-- Modelisation-Evenements-v1.1.md §4.2 et §4.7 :
--   1. evenements           (~28 colonnes, table centrale)
--   2. evenement_encadrants (encadrement multi-rôles optionnel)
--
-- =====================================================================
-- CHOIX DOCTRINAUX (validés Manu 13 mai 2026)
-- =====================================================================
--   - Naming `_id` partout (cohérence Vague 1, au lieu de `_uuid` du doc).
--   - Code de l'événement = manuel à l'INSERT (P1 simplicité, pas de
--     génération automatique via trigger pour démarrer).
--   - RLS : SELECT pour authenticated. Aucune policy write définie : seul
--     le service_role peut INSERT/UPDATE/DELETE pour l'instant (= via le
--     SQL Editor Supabase). Les policies write seront ajoutées dans une
--     session dédiée selon les rôles admin/coach/viewer (cf. dette ouverte).
--
-- =====================================================================
-- HORS PÉRIMÈTRE (Phase 4.3+ ultérieures)
-- =====================================================================
--   - Tables `compositions`, `composition_joueurs`, `presences` → Phase 4.3
--   - RPC `get_evenements_a_venir`, `get_prochain_evenement_par_equipe`
--     → Phase 4.2.B (fichier `sql/11-rpc-evenements.sql` à venir)
--   - JS wrappers `js/supabase-client.js` v1.5 → Phase 4.2.C
--   - UI portail greeting J-N + widget prochain match → Phase 4.4
--   - Table `joueurs_externes` ABANDONNÉE en v1.1 (joueurs partenaires
--     d'entente vivent dans `personnes` avec `bloc_5.club_principal_id`)
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : NON. Pour rejouer, DROP TABLE préalable des 2 tables.
-- =====================================================================

BEGIN;


-- =====================================================================
-- TABLE 1 : evenements
-- =====================================================================
-- Container central. Supporte les 5 types via type_evenement, le cycle
-- de vie via etat (6 valeurs), et la hiérarchie via evenement_parent_id
-- (self-référence). Référence equipes/saisons/sites/personnes.
-- =====================================================================

CREATE TABLE evenements (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  code                        TEXT NOT NULL UNIQUE,
  libelle                     TEXT NOT NULL,

  -- Typage
  type_evenement              TEXT NOT NULL,
  type_competition            TEXT,

  -- Rattachement
  equipe_id                   UUID REFERENCES equipes(id) ON DELETE RESTRICT,
  saison_id                   UUID NOT NULL REFERENCES saisons(id) ON DELETE RESTRICT,

  -- Format de jeu (porté par l'événement, pas par l'équipe — cf. doctrine)
  format_de_jeu               TEXT,

  -- Temps et lieu
  date_debut                  TIMESTAMPTZ NOT NULL,
  date_fin                    TIMESTAMPTZ,
  site_id                     UUID REFERENCES sites(id) ON DELETE SET NULL,

  -- Organisateur principal (obligatoire)
  organisateur_principal_id   UUID NOT NULL REFERENCES personnes(id) ON DELETE RESTRICT,

  -- Hiérarchie parent/enfants (self-référence)
  evenement_parent_id         UUID REFERENCES evenements(id) ON DELETE CASCADE,

  -- Phase (cas tournois multi-phases type Challenge Vié)
  phase_libelle               TEXT,
  ordre_dans_phase            INTEGER,

  -- Cycle de vie (6 états)
  etat                        TEXT NOT NULL DEFAULT 'creation',

  -- Adversaire (cas match)
  adversaire_nom              TEXT,
  domicile_exterieur          TEXT,

  -- Score (cas match joué)
  score_mom                   INTEGER,
  score_adverse               INTEGER,

  -- Résultat de tournoi (cas parent tournoi/stage)
  classement_final            TEXT,
  notes_resultat              TEXT,

  -- Logistique optionnelle (mode déplacement, point RDV, etc.)
  logistique_deplacement      JSONB,

  -- Notes internes (visibilité restreinte coach/admin via UI plus tard)
  notes_internes              TEXT,

  -- Métadonnées
  cree_par                    UUID REFERENCES personnes(id) ON DELETE SET NULL,
  date_creation               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modifie_par                 UUID REFERENCES personnes(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- =================================================================
  -- Contraintes CHECK
  -- =================================================================
  CONSTRAINT evenements_type_check CHECK (
    type_evenement IN ('match', 'entrainement', 'stage', 'tournoi', 'journee_championnat')
  ),
  CONSTRAINT evenements_competition_check CHECK (
    type_competition IS NULL OR type_competition IN ('championnat', 'amical', 'coupe', 'tournoi')
  ),
  CONSTRAINT evenements_format_check CHECK (
    format_de_jeu IS NULL OR format_de_jeu IN ('XV', '13', 'X', '7', '5')
  ),
  CONSTRAINT evenements_etat_check CHECK (
    etat IN ('creation', 'compo', 'joue', 'resultat', 'archive', 'annule')
  ),
  CONSTRAINT evenements_domicile_check CHECK (
    domicile_exterieur IS NULL OR domicile_exterieur IN ('domicile', 'exterieur', 'neutre')
  ),

  -- Cohérence : equipe_id obligatoire pour match/entrainement,
  -- ou si pas parent stage/tournoi/journee_championnat
  CONSTRAINT evenements_equipe_obligatoire_si_pas_parent CHECK (
    (type_evenement IN ('match', 'entrainement') AND equipe_id IS NOT NULL)
    OR (type_evenement IN ('stage', 'tournoi', 'journee_championnat') AND evenement_parent_id IS NULL)
    OR (equipe_id IS NOT NULL)
  ),

  -- Cohérence : format obligatoire pour matchs et journées championnat
  CONSTRAINT evenements_format_obligatoire CHECK (
    (type_evenement IN ('match', 'journee_championnat') AND format_de_jeu IS NOT NULL)
    OR (type_evenement NOT IN ('match', 'journee_championnat'))
  ),

  -- Cohérence temporelle : date_fin >= date_debut si renseignée
  CONSTRAINT evenements_dates_coherentes CHECK (
    date_fin IS NULL OR date_fin >= date_debut
  )
);

-- Indexes : performance des requêtes fréquentes (cf. modélisation §4.2)
CREATE INDEX idx_evenements_equipe ON evenements(equipe_id);
CREATE INDEX idx_evenements_saison ON evenements(saison_id);
CREATE INDEX idx_evenements_date   ON evenements(date_debut);
CREATE INDEX idx_evenements_etat   ON evenements(etat);
CREATE INDEX idx_evenements_parent ON evenements(evenement_parent_id);
CREATE INDEX idx_evenements_type   ON evenements(type_evenement);
CREATE INDEX idx_evenements_site   ON evenements(site_id);

-- Trigger updated_at (réutilise la fonction de Vague 1)
CREATE TRIGGER set_updated_at_evenements
  BEFORE UPDATE ON evenements
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE evenements IS
'Container central des événements (match, entrainement, stage, tournoi, journee_championnat). Cycle de vie 6 états. Hiérarchie parent/enfants. Modélisation v1.1 §4.2.';


-- =====================================================================
-- TABLE 2 : evenement_encadrants
-- =====================================================================
-- Encadrement multi-rôles d'un événement (cas stages EDR avec pilote
-- + bénévoles, déplacements avec chauffeurs identifiés). Vide pour la
-- plupart des événements où organisateur_principal_id suffit.
-- =====================================================================

CREATE TABLE evenement_encadrants (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  evenement_id        UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  personne_id         UUID NOT NULL REFERENCES personnes(id) ON DELETE RESTRICT,

  -- Rôles libres en texte (cf. décision cadrage #11 : enum laissée à
  -- une itération future si patterns stables — dette C6 du doc v1.1)
  roles_encadrement   TEXT[] NOT NULL,

  ordre               INTEGER,
  notes               TEXT,

  -- Métadonnées
  cree_par            UUID REFERENCES personnes(id) ON DELETE SET NULL,
  date_creation       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT evenement_encadrants_unique_per_event_personne
    UNIQUE (evenement_id, personne_id),
  CONSTRAINT evenement_encadrants_roles_nonempty
    CHECK (array_length(roles_encadrement, 1) >= 1)
);

CREATE INDEX idx_evenement_encadrants_evenement ON evenement_encadrants(evenement_id);
CREATE INDEX idx_evenement_encadrants_personne  ON evenement_encadrants(personne_id);

CREATE TRIGGER set_updated_at_evenement_encadrants
  BEFORE UPDATE ON evenement_encadrants
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE evenement_encadrants IS
'Encadrement multi-rôles optionnel d''un événement. Cas typique : stages EDR (Lohann + bénévoles). Modélisation v1.1 §4.7.';


-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
-- - SELECT pour authenticated (cohérent avec personnes/equipes Vague 1).
-- - Aucune policy write : seul le service_role peut INSERT/UPDATE/DELETE
--   à ce stade (= via le SQL Editor Supabase). Les policies write par rôle
--   (admin/coach/viewer) seront définies dans une session dédiée selon les
--   patterns d'usage réels (dette ouverte).
-- =====================================================================

ALTER TABLE evenements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenement_encadrants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evenements_select_authenticated"
  ON evenements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "evenement_encadrants_select_authenticated"
  ON evenement_encadrants FOR SELECT
  TO authenticated
  USING (true);


-- =====================================================================
-- Vérifications immédiates
-- =====================================================================

SELECT
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN ('evenements','evenement_encadrants'))
    AS nb_tables_creees,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='evenements')
    AS nb_colonnes_evenements,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='evenement_encadrants')
    AS nb_colonnes_encadrants,
  (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname='public' AND tablename IN ('evenements','evenement_encadrants'))
    AS nb_indexes_total;

COMMIT;
