-- =====================================================================
-- MOM HUB · VAGUE 1 · CRÉATION DES TABLES
-- =====================================================================
-- Auteur : Manu (avec assistance Claude)
-- Date   : 2026-05-10
-- Version: 1.0
--
-- Crée les 9 tables fondamentales du MOM Hub dans Supabase :
--   1. poles           (5 lignes)
--   2. categories      (14 lignes)
--   3. clubs           (4 lignes)
--   4. saisons         (1-2 lignes)
--   5. postes          (~20 lignes)
--   6. ententes        (5-10 lignes)
--   7. equipes         (~11 lignes)
--   8. equipe_joueurs  (~250 lignes)
--   9. personnes       (~297 lignes)
--
-- Sécurité : RLS activé sur toutes les tables (policies définies à
--            l'étape 6).
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================


-- =====================================================================
-- ÉTAPE 0 — Extensions PostgreSQL nécessaires
-- =====================================================================
-- On a besoin de uuid-ossp pour générer des UUIDs automatiquement
-- (normalement déjà activé par défaut dans Supabase)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =====================================================================
-- ÉTAPE 1 — Fonction utilitaire : trigger updated_at automatique
-- =====================================================================
-- Cette fonction sera réutilisée par toutes les tables pour mettre
-- à jour automatiquement le champ updated_at à chaque modification.

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- TABLE 1 : poles
-- =====================================================================
-- Les 5 pôles organisationnels du MOM (EDR, Jeunes, Jeunes F, Seniors, Loisirs)

CREATE TABLE poles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                        TEXT NOT NULL UNIQUE,
  libelle_long                TEXT NOT NULL,
  libelle_court               TEXT NOT NULL,
  categories_rattachees       TEXT[] NOT NULL DEFAULT '{}',
  responsable_principal_id    UUID,  -- FK vers personnes (ajoutée plus tard)
  co_responsable_id           UUID,  -- FK vers personnes (ajoutée plus tard)
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON poles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE poles IS 'Pôles organisationnels du MOM (EDR, Jeunes, Jeunes F, Seniors, Loisirs)';
COMMENT ON COLUMN poles.code IS 'Code lisible humain, ex: POLE-EDR';
COMMENT ON COLUMN poles.categories_rattachees IS 'Liste de codes catégories rattachées, ex: {M6, M8, M10, M12, M14}';


-- =====================================================================
-- TABLE 2 : categories
-- =====================================================================
-- Les 14 catégories d'âge (M5 à RLSP)

CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  code_ffr        TEXT,
  libelle         TEXT NOT NULL,
  age_min         INTEGER,
  age_max         INTEGER,
  genre           TEXT CHECK (genre IN ('M', 'F', 'mixte')),
  pole_id         UUID REFERENCES poles(id) ON DELETE SET NULL,
  ordre_tri       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_categories_pole_id ON categories(pole_id);
CREATE INDEX idx_categories_ordre_tri ON categories(ordre_tri);

COMMENT ON TABLE categories IS 'Catégories d''âge (M5, M6, M8, ..., SR-M, SR-F, RLO, RLSP)';
COMMENT ON COLUMN categories.code IS 'Code interne, ex: M14';
COMMENT ON COLUMN categories.code_ffr IS 'Code FFR officiel (peut différer de code)';


-- =====================================================================
-- TABLE 3 : clubs
-- =====================================================================
-- Les clubs (MOM, SAR, ASCS, et autres partenaires futurs)

CREATE TABLE clubs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  nom_court       TEXT NOT NULL,
  nom_long        TEXT NOT NULL,
  numero_ffr      TEXT,
  ville           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE clubs IS 'Clubs (MOM = club principal, autres = partenaires d''entente)';


-- =====================================================================
-- TABLE 4 : saisons
-- =====================================================================
-- Les saisons sportives (1 par an, généralement de juillet à juin)

CREATE TABLE saisons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  libelle         TEXT NOT NULL,
  date_debut      DATE NOT NULL,
  date_fin        DATE NOT NULL,
  est_active      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (date_fin > date_debut)
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON saisons
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Contrainte : une seule saison active à la fois
CREATE UNIQUE INDEX idx_saisons_une_seule_active
  ON saisons(est_active)
  WHERE est_active = TRUE;

COMMENT ON TABLE saisons IS 'Saisons sportives (1 par an, contrainte 1 seule active)';
COMMENT ON COLUMN saisons.code IS 'Format AAAA-AAAA, ex: 2025-2026';


-- =====================================================================
-- TABLE 5 : postes
-- =====================================================================
-- Les postes rugby (15 postes XV + 5 regroupements)

CREATE TABLE postes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT NOT NULL UNIQUE,
  libelle_long        TEXT NOT NULL,
  libelle_court       TEXT NOT NULL,
  numero_xv           INTEGER,
  ligne               TEXT,
  est_regroupement    BOOLEAN NOT NULL DEFAULT FALSE,
  codes_xv            TEXT[],
  codes_13            TEXT[],
  codes_x             TEXT[],
  codes_7             TEXT[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON postes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_postes_numero_xv ON postes(numero_xv);

COMMENT ON TABLE postes IS 'Postes rugby (15 XV + 5 regroupements)';
COMMENT ON COLUMN postes.code IS 'Code court, ex: PG, TG, OUV';
COMMENT ON COLUMN postes.numero_xv IS 'Numéro 1-15 pour postes XV, NULL pour regroupements';


-- =====================================================================
-- TABLE 6 : ententes
-- =====================================================================
-- Le cadre administratif et sportif d'une catégorie sur une saison

CREATE TABLE ententes (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                            TEXT NOT NULL UNIQUE,
  slug                            TEXT,
  libelle_court                   TEXT,
  libelle_moyen                   TEXT,
  libelle_long                    TEXT,
  saison_id                       UUID NOT NULL REFERENCES saisons(id) ON DELETE RESTRICT,
  categorie_id                    UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  club_principal_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  clubs_partenaires_ids           UUID[] NOT NULL DEFAULT '{}',
  regime_actuel                   TEXT NOT NULL CHECK (regime_actuel IN ('Solo', 'Permanente', 'Occasionnelle')),
  date_mise_en_place              DATE,
  convention_ffr_url              TEXT,
  date_signature_convention       DATE,
  date_fin_validite_convention    DATE,
  identifiant_sporteasy           TEXT,
  competitions_engagees           JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                           TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 1 seule entente par catégorie x saison
  UNIQUE (saison_id, categorie_id)
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ententes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_ententes_saison_id ON ententes(saison_id);
CREATE INDEX idx_ententes_categorie_id ON ententes(categorie_id);

COMMENT ON TABLE ententes IS 'Cadre administratif d''une catégorie sur une saison (Solo, Permanente, ou Occasionnelle)';
COMMENT ON COLUMN ententes.clubs_partenaires_ids IS 'IDs des clubs partenaires de cette entente';
COMMENT ON COLUMN ententes.competitions_engagees IS 'Liste JSON des compétitions engagées (structure libre)';


-- =====================================================================
-- TABLE 7 : equipes
-- =====================================================================
-- L'instance concrète qui joue les matchs

CREATE TABLE equipes (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                            TEXT NOT NULL UNIQUE,
  nom_officiel                    TEXT NOT NULL,
  alias                           TEXT[] NOT NULL DEFAULT '{}',
  entente_id                      UUID NOT NULL REFERENCES ententes(id) ON DELETE CASCADE,
  numero_equipe                   INTEGER NOT NULL DEFAULT 1,
  libelle_court                   TEXT,
  libelle_moyen                   TEXT,
  libelle_long                    TEXT,
  type_equipe                     TEXT CHECK (type_equipe IN ('entente', 'mono_club')),
  club_referent_id                UUID REFERENCES clubs(id) ON DELETE SET NULL,
  mixte                           BOOLEAN NOT NULL DEFAULT FALSE,
  mixte_detail                    TEXT,
  format_jeu_code                 TEXT,
  format_jeu_libelle              TEXT,
  championnat_nom                 TEXT,
  championnat_ligue               TEXT,
  championnat_code_ffr            TEXT,
  championnat_code_scorenco       TEXT,
  sites_utilises                  UUID[] NOT NULL DEFAULT '{}',
  site_principal_id               UUID,
  sites_note                      TEXT,
  statut                          TEXT NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'inactive')),
  coach_principal_id              UUID,  -- FK vers personnes (ajoutée plus tard)
  coachs_adjoints_ids             UUID[] NOT NULL DEFAULT '{}',
  manager_id                      UUID,  -- FK vers personnes (ajoutée plus tard)
  jeux_maillots                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  effectif_theorique              INTEGER,
  effectif_minimum_operationnel   INTEGER,
  notes                           TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON equipes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_equipes_entente_id ON equipes(entente_id);
CREATE INDEX idx_equipes_statut ON equipes(statut);

COMMENT ON TABLE equipes IS 'Instance concrète qui joue les matchs (enfant d''une entente)';
COMMENT ON COLUMN equipes.format_jeu_code IS 'XV, 13, X, 7, 5 — modifiable au cours de la saison';


-- =====================================================================
-- TABLE 9 : personnes  (créée AVANT equipe_joueurs car celle-ci la référence)
-- =====================================================================
-- La table centrale : tous les individus en relation avec le club
-- 297 lignes au démarrage

CREATE TABLE personnes (
  id                                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uuid_legacy                                   TEXT UNIQUE,
  categorie_personne                            TEXT NOT NULL CHECK (categorie_personne IN (
    'joueur', 'parent', 'parent_et_staff', 'staff', 'contact-externe', 'dirigeant'
  )),

  -- BLOC 1 · IDENTITÉ
  nom                                           TEXT NOT NULL,
  prenom                                        TEXT NOT NULL,
  surnom                                        TEXT,
  sexe                                          TEXT CHECK (sexe IN ('M', 'F')),
  date_naissance                                DATE,
  nationalite_principale                        TEXT DEFAULT 'France',
  nationalites_complementaires                  TEXT[] NOT NULL DEFAULT '{}',
  lieu_naissance                                JSONB,
  numero_securite_sociale                       TEXT,
  etablissement_scolaire                        TEXT,
  classe_scolaire                               TEXT,

  -- BLOC 2 · COORDONNÉES
  email_principal                               TEXT,
  email_secondaire                              TEXT,
  telephone_principal                           TEXT,
  telephone_secondaire                          TEXT,
  adresse_postale                               TEXT,
  code_postal                                   TEXT,
  ville                                         TEXT,
  pays                                          TEXT DEFAULT 'France',
  personne_a_prevenir_urgence                   JSONB,

  -- BLOC 5 · AFFILIATION FFR (résumé)
  type_personne                                 TEXT CHECK (type_personne IN (
    'licencie_competition', 'licencie_dirigeant', 'licencie_educateur',
    'non_licencie', 'non_licencie_au_mom'
  )),
  numero_licence_ffr                            TEXT,
  categorie_id                                  UUID REFERENCES categories(id) ON DELETE SET NULL,
  pole_attache_id                               UUID REFERENCES poles(id) ON DELETE SET NULL,
  qualite_ffr                                   TEXT,
  type_pratique                                 TEXT CHECK (type_pratique IN (
    'Compétition', 'Loisir', 'Dirigeant'
  )),
  club_principal_id                             UUID REFERENCES clubs(id) ON DELETE SET NULL,
  date_fin_affiliation                          DATE,
  annee_arrivee_club                            INTEGER,
  f15_integree                                  BOOLEAN NOT NULL DEFAULT FALSE,

  -- BLOC 7 · PRÉFÉRENCES & RGPD (OBLIGATOIRE pour stockage légal)
  consentement_rgpd_date                        TIMESTAMPTZ,
  consentement_rgpd_version                     TEXT,
  canal_communication_prefere                   TEXT CHECK (canal_communication_prefere IN (
    'email', 'sms', 'les_deux', 'aucun'
  )),
  droit_image_photos_individuelles              BOOLEAN,
  droit_image_photos_groupe                     BOOLEAN,
  droit_image_site_web                          BOOLEAN,
  droit_image_reseaux_sociaux                   BOOLEAN,
  droit_image_presse_locale                     BOOLEAN,
  autorisation_transport                        JSONB,
  autorisation_intervention_medicale_urgence    BOOLEAN,
  visible_annuaire                              BOOLEAN NOT NULL DEFAULT FALSE,

  -- BLOC 9 · MÉTADONNÉES TECHNIQUES
  source_creation                               TEXT,
  modifie_par                                   TEXT,
  id_sporteasy                                  TEXT,
  synchronisation_statut                        TEXT NOT NULL DEFAULT 'a_jour' CHECK (synchronisation_statut IN (
    'a_jour', 'en_attente', 'erreur'
  )),
  validation_ffr                                BOOLEAN NOT NULL DEFAULT FALSE,
  tag_verifier                                  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at                                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON personnes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Index pour performance
CREATE INDEX idx_personnes_nom ON personnes(nom);
CREATE INDEX idx_personnes_prenom ON personnes(prenom);
CREATE INDEX idx_personnes_categorie_personne ON personnes(categorie_personne);
CREATE INDEX idx_personnes_categorie_id ON personnes(categorie_id);
CREATE INDEX idx_personnes_numero_licence_ffr ON personnes(numero_licence_ffr) WHERE numero_licence_ffr IS NOT NULL;
CREATE INDEX idx_personnes_date_naissance ON personnes(date_naissance);
CREATE INDEX idx_personnes_uuid_legacy ON personnes(uuid_legacy) WHERE uuid_legacy IS NOT NULL;
CREATE INDEX idx_personnes_tag_verifier ON personnes(tag_verifier) WHERE tag_verifier = TRUE;

COMMENT ON TABLE personnes IS 'Entité centrale : tous les individus en relation avec le club';
COMMENT ON COLUMN personnes.uuid_legacy IS 'UUID lisible historique (ex: personne-A3F2B1) pour compatibilité avec les JSON Drive';
COMMENT ON COLUMN personnes.f15_integree IS 'TRUE si fille F15 jouant en mixité M14';


-- =====================================================================
-- TABLE 8 : equipe_joueurs
-- =====================================================================
-- Table de liaison : joueurs d'attache d'une équipe sur une saison

CREATE TABLE equipe_joueurs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipe_id           UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  personne_id         UUID NOT NULL REFERENCES personnes(id) ON DELETE CASCADE,
  club_provenance_id  UUID REFERENCES clubs(id) ON DELETE SET NULL,
  date_affectation    DATE NOT NULL DEFAULT CURRENT_DATE,
  date_sortie         DATE,
  niveau_profil       TEXT,
  statut              TEXT NOT NULL DEFAULT 'regulier' CHECK (statut IN (
    'regulier', 'renfort_temporaire', 'en_transition'
  )),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (equipe_id, personne_id, date_affectation),
  CHECK (date_sortie IS NULL OR date_sortie >= date_affectation)
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON equipe_joueurs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_equipe_joueurs_equipe_id ON equipe_joueurs(equipe_id);
CREATE INDEX idx_equipe_joueurs_personne_id ON equipe_joueurs(personne_id);
CREATE INDEX idx_equipe_joueurs_actifs ON equipe_joueurs(equipe_id, personne_id) WHERE date_sortie IS NULL;

COMMENT ON TABLE equipe_joueurs IS 'Association joueurs ↔ équipes d''attache (historique de mouvements)';
COMMENT ON COLUMN equipe_joueurs.niveau_profil IS 'Performance / Développement / Initiation pour M14';


-- =====================================================================
-- AJOUT DES FOREIGN KEYS DIFFÉRÉES (vers personnes)
-- =====================================================================
-- On les ajoute maintenant que personnes existe

ALTER TABLE poles
  ADD CONSTRAINT fk_poles_responsable_principal
    FOREIGN KEY (responsable_principal_id) REFERENCES personnes(id) ON DELETE SET NULL;

ALTER TABLE poles
  ADD CONSTRAINT fk_poles_co_responsable
    FOREIGN KEY (co_responsable_id) REFERENCES personnes(id) ON DELETE SET NULL;

ALTER TABLE equipes
  ADD CONSTRAINT fk_equipes_coach_principal
    FOREIGN KEY (coach_principal_id) REFERENCES personnes(id) ON DELETE SET NULL;

ALTER TABLE equipes
  ADD CONSTRAINT fk_equipes_manager
    FOREIGN KEY (manager_id) REFERENCES personnes(id) ON DELETE SET NULL;


-- =====================================================================
-- ACTIVATION DE ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES
-- =====================================================================
-- On active RLS dès maintenant pour que les tables soient sécurisées
-- par défaut. Les policies détaillées seront définies à l'étape 6.
-- En attendant, AUCUN accès anonyme ne sera possible (sauf via la clé
-- service_role pour les migrations).

ALTER TABLE poles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE saisons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE postes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ententes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_joueurs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnes        ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- POLICIES TEMPORAIRES — LECTURE PUBLIQUE DES RÉFÉRENTIELS
-- =====================================================================
-- Pour permettre au Hub (front-end) de lire les référentiels publics
-- via la clé anon. Les fiches Personne restent inaccessibles sans
-- authentification (policies définies à l'étape 6).

CREATE POLICY "Lecture publique des poles"
  ON poles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Lecture publique des categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Lecture publique des clubs"
  ON clubs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Lecture publique des saisons"
  ON saisons FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Lecture publique des postes"
  ON postes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Pour les tables sensibles (ententes, equipes, equipe_joueurs, personnes),
-- AUCUNE policy n'est définie ici. Conséquence : seule la clé
-- service_role peut y accéder (utilisée pour les migrations).
-- Les policies user-facing seront définies à l'étape 6.


-- =====================================================================
-- FIN DU SCRIPT
-- =====================================================================
-- À ce stade, tu as :
--   ✅ 9 tables créées
--   ✅ Toutes les contraintes (PK, FK, CHECK, UNIQUE) en place
--   ✅ Index pour performance
--   ✅ Triggers updated_at automatiques
--   ✅ RLS activé sur toutes les tables
--   ✅ Lecture publique autorisée sur les 5 référentiels publics
--   ✅ Tables sensibles isolées (ententes, equipes, personnes)
--
-- Prochaines étapes :
--   ÉTAPE 6 : policies RLS détaillées (qui voit quoi)
--   ÉTAPE 7 : migration des 5 référentiels publics
--   ÉTAPE 8 : migration des 297 fiches Personne
-- =====================================================================
