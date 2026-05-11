-- =====================================================================
-- MOM HUB · ÉTAPE 7 · ENRICHISSEMENT + MIGRATION DES RÉFÉRENTIELS PUBLICS
-- =====================================================================
-- Auteur : Manu (avec assistance Claude)
-- Date   : 2026-05-11
-- Version: 1.0
--
-- Ce script est en 3 PARTIES :
--   PARTIE A — ENRICHISSEMENT du modèle (ALTER TABLE)
--   PARTIE B — INSERT des 5 référentiels publics
--   PARTIE C — VÉRIFICATIONS (SELECT COUNT)
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================


-- =====================================================================
-- ============ PARTIE A — ENRICHISSEMENT DU MODÈLE  ===================
-- =====================================================================
-- On ajoute aux 4 tables existantes les colonnes manquantes pour
-- accueillir toute la richesse des JSON Drive.


-- ---------- TABLE poles : enrichissements ----------

ALTER TABLE poles
  ADD COLUMN IF NOT EXISTS uuid_legacy TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS responsable_principal_nom TEXT;

COMMENT ON COLUMN poles.uuid_legacy IS 'UUID lisible historique (ex: pole-edr) pour compatibilité avec les JSON Drive';
COMMENT ON COLUMN poles.responsable_principal_nom IS 'Nom du responsable en attendant l''UUID de la personne';


-- ---------- TABLE categories : enrichissements ----------
-- Modification importante : on renomme "libelle" en "libelle_court"
-- et on ajoute "libelle_long" pour distinguer les deux usages.

ALTER TABLE categories RENAME COLUMN libelle TO libelle_court;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS uuid_legacy TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS libelle_long TEXT,
  ADD COLUMN IF NOT EXISTS type_categorie TEXT,                  -- Jeunes / Seniors / Loisirs
  ADD COLUMN IF NOT EXISTS type_licence_ffr TEXT,                -- Compétition / RLO / RLSP
  ADD COLUMN IF NOT EXISTS age_minimum_h INTEGER,                -- ex: 18 pour RLO, 14 pour RLSP
  ADD COLUMN IF NOT EXISTS age_minimum_f INTEGER,                -- ex: 15 pour RLSP
  ADD COLUMN IF NOT EXISTS formats_autorises TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS passeports_requis TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mixite_autorisee BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN categories.libelle_court IS 'Libellé pour affichage UI compact (ex: M14, M18, Vétérans, Touch)';
COMMENT ON COLUMN categories.libelle_long IS 'Libellé détaillé (ex: Moins de 14 ans, Rugby Loisir avec plaquage)';
COMMENT ON COLUMN categories.type_categorie IS 'Famille de catégorie : Jeunes / Seniors / Loisirs';
COMMENT ON COLUMN categories.type_licence_ffr IS 'Type de licence FFR : Compétition / RLO / RLSP';
COMMENT ON COLUMN categories.formats_autorises IS 'Formats de jeu autorisés pour cette catégorie';
COMMENT ON COLUMN categories.passeports_requis IS 'Passeports rugby FFR exigés (ex: ASR, JDD)';


-- ---------- TABLE clubs : enrichissements ----------

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS uuid_legacy TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS couleurs_officielles TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS couleur_affiliation_distinctive TEXT,
  ADD COLUMN IF NOT EXISTS comite_departemental TEXT,
  ADD COLUMN IF NOT EXISTS ligue_regionale TEXT,
  ADD COLUMN IF NOT EXISTS annee_creation INTEGER,
  ADD COLUMN IF NOT EXISTS annee_creation_association_mere INTEGER,  -- ex: ASCS section rugby 2004, association 1927
  ADD COLUMN IF NOT EXISTS niveau_competition TEXT,
  ADD COLUMN IF NOT EXISTS club_central BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS type_partenariat TEXT,
  ADD COLUMN IF NOT EXISTS licencies_dernier_recense INTEGER,
  ADD COLUMN IF NOT EXISTS sites_principaux_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN clubs.couleur_affiliation_distinctive IS 'Couleur utilisée pour distinguer ce club dans les compositions d''entente';
COMMENT ON COLUMN clubs.club_central IS 'TRUE pour MOM (club hub) ; FALSE pour les clubs partenaires';
COMMENT ON COLUMN clubs.sites_principaux_codes IS 'Codes des sites principaux (ex: BRENCKLE, HOLTZPLATZ) ; remplis quand la table sites existera';


-- ---------- TABLE postes : enrichissements ----------

ALTER TABLE postes
  ADD COLUMN IF NOT EXISTS uuid_legacy TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS formats_applicables TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS postes_inclus_codes TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN postes.formats_applicables IS 'Formats de jeu où ce poste s''applique (XV, 13, X, 7)';
COMMENT ON COLUMN postes.postes_inclus_codes IS 'Pour les regroupements : liste des codes de postes précis inclus (ex: PIL = [PG, PD])';


-- =====================================================================
-- ============ PARTIE B — INSERT DES 5 RÉFÉRENTIELS  ==================
-- =====================================================================


-- ---------- INSERT : poles (5 lignes) ----------

INSERT INTO poles (
  uuid_legacy, code, libelle_long, libelle_court,
  categories_rattachees, responsable_principal_nom
) VALUES
  ('pole-edr',         'EDR',      'Pôle École de Rugby',     'EDR',
   ARRAY['M6','M8','M10','M12','M14'],
   'Lohann (à confirmer UUID)'),
  ('pole-jeunes',      'JEUNES',   'Pôle Jeunes',             'Jeunes',
   ARRAY['M16','M19'],
   NULL),
  ('pole-jeunes-fem',  'JEUNES_F', 'Pôle Jeunes Féminines',   'Jeunes F',
   ARRAY['F15','F18'],
   NULL),
  ('pole-seniors',     'SENIORS',  'Pôle Seniors',            'Seniors',
   ARRAY['SR-M','SR-F'],
   NULL),
  ('pole-loisirs',     'LOISIRS',  'Pôle Loisirs',            'Loisirs',
   ARRAY['RLO','RLSP'],
   NULL);


-- ---------- INSERT : categories (14 lignes) ----------
-- On résout pole_id via subquery sur uuid_legacy

INSERT INTO categories (
  uuid_legacy, code, code_ffr, libelle_court, libelle_long,
  pole_id,
  type_categorie, type_licence_ffr, genre,
  age_min, age_max, age_minimum_h, age_minimum_f,
  formats_autorises, passeports_requis, mixite_autorisee,
  ordre_tri, notes
) VALUES
  -- M5 : Premiers pas EDR (catégorie de découverte)
  ('cat-m5',   'M5',  'M5',  'M5',     'Moins de 6 ans (Premiers pas EDR)',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-edr'),
   'Jeunes', 'Compétition', 'mixte',
   NULL, 5, NULL, NULL,
   ARRAY['Premiers pas EDR (Jeu à 5)'], ARRAY[]::TEXT[], TRUE,
   10, 'Catégorie de découverte/initiation, pas de compétition au sens strict. OVAL-E distingue M-5 et F-5 par sexe administratif ; au Core MOM, F-5 = Personne F + cat-m5 + flag _F_en_edr=true.'),

  -- M6
  ('cat-m6',   'M6',  'M6',  'M6',     'Moins de 6 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-edr'),
   'Jeunes', 'Compétition', 'mixte',
   5, 6, NULL, NULL,
   ARRAY['Premiers pas EDR (Jeu à 5)'], ARRAY[]::TEXT[], TRUE,
   20, 'Filles F-6 → cat-m6 + flag _F_en_edr=true sur fiche Personne'),

  -- M8
  ('cat-m8',   'M8',  'M8',  'M8',     'Moins de 8 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-edr'),
   'Jeunes', 'Compétition', 'mixte',
   6, 8, NULL, NULL,
   ARRAY['Toucher + 2 sec (Jeu à 5)','Jouer au contact (Jeu à 5)'], ARRAY[]::TEXT[], TRUE,
   30, 'Filles F-8 → cat-m8 + flag _F_en_edr=true sur fiche Personne'),

  -- M10
  ('cat-m10',  'M10', 'M10', 'M10',    'Moins de 10 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-edr'),
   'Jeunes', 'Compétition', 'mixte',
   8, 10, NULL, NULL,
   ARRAY['Toucher + 2 sec (Jeu à 5)','Jouer au contact (Jeu à 5)','Jeu à 7'], ARRAY[]::TEXT[], TRUE,
   40, 'Filles F-10 → cat-m10 + flag _F_en_edr=true sur fiche Personne'),

  -- M12
  ('cat-m12',  'M12', 'M12', 'M12',    'Moins de 12 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-edr'),
   'Jeunes', 'Compétition', 'mixte',
   10, 12, NULL, NULL,
   ARRAY['Toucher + 2 sec (Jeu à 5)','Jouer au contact (Jeu à 5)','Jeu à X'], ARRAY['ASR'], TRUE,
   50, 'Filles F-12 → cat-m12 + flag _F_en_edr=true sur fiche Personne'),

  -- M14 : la catégorie phare du MOM
  ('cat-m14',  'M14', 'M14', 'M14',    'Moins de 14 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-edr'),
   'Jeunes', 'Compétition', 'mixte',
   12, 14, NULL, NULL,
   ARRAY['Toucher + 2 sec (Jeu à 7)','Jouer au contact (Jeu à 7)','Jeu à 7','Jeu à X','Jeu à XV','Format 13 (M14 pédago FFR)'],
   ARRAY['JDD','ASR'], TRUE,
   60, 'M14 + filles F15 intégrées (pas d''équipe F15 séparée).'),

  -- F15 : féminines avec mixité M14 sur le terrain
  ('cat-f15',  'F15', 'F15', 'F15',    'Filles moins de 15 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-jeunes-fem'),
   'Jeunes', 'Compétition', 'F',
   13, 15, NULL, NULL,
   ARRAY['Toucher + 2 sec','Jeu à 7','Jeu à X','Jeu à XV'], ARRAY['JDD','ASR'], FALSE,
   70, 'Sur le terrain, les F15 jouent avec les M14 en équipe mixte. Au niveau Core MOM, leur fiche utilise cat-m14 + flag _F15_integree=true (le pôle administratif reste pole-jeunes-fem).'),

  -- M16
  ('cat-m16',  'M16', 'M16', 'M16',    'Moins de 16 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-jeunes'),
   'Jeunes', 'Compétition', 'M',
   14, 16, NULL, NULL,
   ARRAY['Jeu à XV','Jeu à X','Jeu à 7'], ARRAY[]::TEXT[], FALSE,
   80, NULL),

  -- M19 (libellé club M18 par convention FFR)
  ('cat-m19',  'M19', 'M19', 'M18',    'Moins de 19 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-jeunes'),
   'Jeunes', 'Compétition', 'M',
   16, 19, NULL, NULL,
   ARRAY['Jeu à XV','Jeu à X','Jeu à 7'], ARRAY[]::TEXT[], FALSE,
   90, 'Code FFR M19, libellé club M18. Joueurs < 19 ans.'),

  -- F18
  ('cat-f18',  'F18', 'F18', 'F18',    'Filles moins de 18 ans',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-jeunes-fem'),
   'Jeunes', 'Compétition', 'F',
   15, 18, NULL, NULL,
   ARRAY['Jeu à XV','Jeu à X','Jeu à 7'], ARRAY[]::TEXT[], FALSE,
   100, 'La F18 du MOM joue dans des regroupements externes gérés par le comité départemental.'),

  -- Seniors Masculins
  ('cat-srm',  'SR-M','SR-M','Seniors M', 'Seniors Masculins',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-seniors'),
   'Seniors', 'Compétition', 'M',
   18, NULL, NULL, NULL,
   ARRAY['Jeu à XV','Jeu à X','Jeu à 7'], ARRAY[]::TEXT[], FALSE,
   110, NULL),

  -- Seniors Féminines
  ('cat-srf',  'SR-F','SR-F','Seniors F', 'Seniors Féminines',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-seniors'),
   'Seniors', 'Compétition', 'F',
   18, NULL, NULL, NULL,
   ARRAY['Jeu à XV','Jeu à X','Jeu à 7'], ARRAY[]::TEXT[], FALSE,
   120, NULL),

  -- Vétérans (Rugby Loisir avec plaquage)
  ('cat-rlo',  'RLO', 'RLO', 'Vétérans', 'Rugby Loisir avec plaquage',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-loisirs'),
   'Loisirs', 'RLO', 'mixte',
   NULL, NULL, 18, NULL,
   ARRAY['Rugby à XV','Rugby à X','Rugby à 5'], ARRAY[]::TEXT[], TRUE,
   130, 'Âge minimum 18 ans.'),

  -- Touch (Rugby Loisir Sans Plaquage = Rugby à 5 officiel FFR)
  ('cat-rlsp', 'RLSP','RLSP','Touch',    'Rugby Loisir Sans Plaquage (Rugby à 5 officiel FFR)',
   (SELECT id FROM poles WHERE uuid_legacy = 'pole-loisirs'),
   'Loisirs', 'RLSP', 'mixte',
   NULL, NULL, 14, 15,
   ARRAY['Rugby à 5 (mixte)'], ARRAY[]::TEXT[], TRUE,
   140, 'Âge minimum H=14, F=15.');


-- ---------- INSERT : clubs (4 lignes) ----------

INSERT INTO clubs (
  uuid_legacy, code, nom_court, nom_long,
  ville, adresse,
  couleurs_officielles, couleur_affiliation_distinctive,
  comite_departemental, ligue_regionale,
  annee_creation, annee_creation_association_mere,
  niveau_competition,
  club_central, type_partenariat,
  licencies_dernier_recense,
  sites_principaux_codes,
  notes
) VALUES
  -- MOM : club central du Hub
  ('club-mom',  'MOM',  'MOM',  'Mutzig Ovalie Molsheim',
   'Molsheim', NULL,
   ARRAY['Jaune','Vert'], 'Vert',
   'Comité Alsace', 'LRGER (Ligue Régionale Grand Est de Rugby)',
   2006, NULL,
   NULL,
   TRUE, NULL,
   310,
   ARRAY['BRENCKLE','HOLTZPLATZ'],
   'Club central du Hub. Stades René Brencklé (Mutzig) et Holtzplatz (Molsheim). Succède à MRXV.'),

  -- SAR : partenaire entente permanente
  ('club-sar',  'SAR',  'SAR',  'Strasbourg Alsace Rugby',
   'Strasbourg', 'rue Baden Powell, Strasbourg',
   ARRAY['Bleu'], 'Bleu',
   'Comité Alsace', 'LRGER',
   2019, NULL,
   'Fédérale 3',
   FALSE, 'Entente permanente M14/M19/F15 avec MOM et ASCS',
   NULL,
   ARRAY['BADEN'],
   'Partenaire d''entente permanente.'),

  -- ASCS : partenaire entente permanente, association mère depuis 1927
  ('club-ascs', 'ASCS', 'ASCS', 'Association Sportive des Cheminots de Strasbourg',
   'Strasbourg', NULL,
   ARRAY['Jaune','Bleu'], 'Jaune',
   'Comité Alsace', 'LRGER',
   2004, 1927,
   NULL,
   FALSE, 'Entente permanente M14/M19/F15 avec MOM et SAR',
   NULL,
   ARRAY[]::TEXT[],
   'Section rugby créée en 2004, association mère depuis 1927.'),

  -- CRIG : partenaire entente Seniors F
  ('club-crig', 'CRIG', 'CRIG', 'CR Illkirch-Graffenstaden',
   'Illkirch-Graffenstaden', 'Illkirch-Graffenstaden',
   ARRAY['Noir'], 'Noir',
   'Comité Alsace', 'LRGER',
   NULL, NULL,
   NULL,
   FALSE, 'Entente Seniors F (M+18 à X)',
   NULL,
   ARRAY[]::TEXT[],
   'Club d''Illkirch-Graffenstaden.');


-- ---------- INSERT : saisons (1 ligne : saison 2025-2026 active) ----------

INSERT INTO saisons (
  code, libelle, date_debut, date_fin, est_active
) VALUES
  ('2025-2026', 'Saison 2025-2026', '2025-07-01', '2026-06-30', TRUE);


-- ---------- INSERT : postes (15 précis + 5 regroupements) ----------

-- Postes précis (15 lignes)
INSERT INTO postes (
  uuid_legacy, code, libelle_court, libelle_long,
  numero_xv, ligne, est_regroupement,
  formats_applicables, description, postes_inclus_codes
) VALUES
  ('pst-001', 'PG',  'Pilier G',         'Pilier gauche',
   1, 'Première ligne', FALSE,
   ARRAY['XV','13','X'],
   'Joueur de devant, côté gauche de la mêlée',
   ARRAY[]::TEXT[]),

  ('pst-002', 'TAL', 'Talonneur',        'Talonneur',
   2, 'Première ligne', FALSE,
   ARRAY['XV','13','X'],
   'Joueur de devant central, talonne en mêlée et lance en touche',
   ARRAY[]::TEXT[]),

  ('pst-003', 'PD',  'Pilier D',         'Pilier droit',
   3, 'Première ligne', FALSE,
   ARRAY['XV','13','X'],
   'Joueur de devant, côté droit de la mêlée',
   ARRAY[]::TEXT[]),

  ('pst-004', '2LG', '2L G',             'Deuxième ligne gauche',
   4, 'Deuxième ligne', FALSE,
   ARRAY['XV','13'],
   'Sauteur en touche, pousseur en mêlée',
   ARRAY[]::TEXT[]),

  ('pst-005', '2LD', '2L D',             'Deuxième ligne droite',
   5, 'Deuxième ligne', FALSE,
   ARRAY['XV','13'],
   'Sauteur en touche, pousseur en mêlée',
   ARRAY[]::TEXT[]),

  ('pst-006', '3LG', 'Flanker G',        'Troisième ligne aile gauche',
   6, 'Troisième ligne', FALSE,
   ARRAY['XV','X'],
   'Joueur polyvalent, plaqueur, gratteur. Non applicable au format 13.',
   ARRAY[]::TEXT[]),

  ('pst-007', '3LD', 'Flanker D',        'Troisième ligne aile droite',
   7, 'Troisième ligne', FALSE,
   ARRAY['XV','X'],
   'Joueur polyvalent, plaqueur, gratteur. Non applicable au format 13.',
   ARRAY[]::TEXT[]),

  ('pst-008', 'N8',  'N°8',              'Numéro 8',
   8, 'Troisième ligne', FALSE,
   ARRAY['XV','13','X'],
   'Pivot de l''équipe, lien avec les arrières. En format 13, seul joueur de 3ème ligne (poste centre).',
   ARRAY[]::TEXT[]),

  ('pst-009', 'DM',  'Demi de mêlée',    'Demi de mêlée',
   9, 'Demis', FALSE,
   ARRAY['XV','13','X','7'],
   'Distributeur près des phases statiques',
   ARRAY[]::TEXT[]),

  ('pst-010', 'DO',  'Demi d''ouverture','Demi d''ouverture',
   10, 'Demis', FALSE,
   ARRAY['XV','13','X','7'],
   'Stratège, jeu au pied, lance les attaques',
   ARRAY[]::TEXT[]),

  ('pst-011', 'AG',  'Ailier G',         'Ailier gauche',
   11, 'Ailiers', FALSE,
   ARRAY['XV','13','X','7'],
   'Finisseur, vitesse pure, plaqueur dans le couloir',
   ARRAY[]::TEXT[]),

  ('pst-012', 'CG',  'Centre G',         'Centre gauche (premier centre)',
   12, 'Centres', FALSE,
   ARRAY['XV','13','X','7'],
   'Premier centre, percutant, distributeur',
   ARRAY[]::TEXT[]),

  ('pst-013', 'CD',  'Centre D',         'Centre droit (deuxième centre)',
   13, 'Centres', FALSE,
   ARRAY['XV','13','X','7'],
   'Deuxième centre, vitesse, jeu au large',
   ARRAY[]::TEXT[]),

  ('pst-014', 'AD',  'Ailier D',         'Ailier droit',
   14, 'Ailiers', FALSE,
   ARRAY['XV','13','X','7'],
   'Finisseur, vitesse pure, plaqueur dans le couloir',
   ARRAY[]::TEXT[]),

  ('pst-015', 'AR',  'Arrière',          'Arrière',
   15, 'Arrière', FALSE,
   ARRAY['XV','13','X','7'],
   'Dernière défense, jeu au pied, contre-attaque',
   ARRAY[]::TEXT[]);

-- Postes regroupés (5 lignes)
INSERT INTO postes (
  uuid_legacy, code, libelle_court, libelle_long,
  numero_xv, ligne, est_regroupement,
  formats_applicables, description, postes_inclus_codes
) VALUES
  ('pst-grp-001', 'PIL', 'Piliers',       'Piliers (gauche ou droit)',
   NULL, 'Première ligne', TRUE,
   ARRAY[]::TEXT[],
   'Piliers gauche ou droit (substituables tactiquement)',
   ARRAY['PG','PD']),

  ('pst-grp-002', '2L',  '2èmes lignes',  '2èmes lignes (gauche ou droite)',
   NULL, 'Deuxième ligne', TRUE,
   ARRAY[]::TEXT[],
   'Deuxièmes lignes gauche ou droite',
   ARRAY['2LG','2LD']),

  ('pst-grp-003', '3L',  '3èmes lignes',  '3èmes lignes (Flanker G, D, N°8)',
   NULL, 'Troisième ligne', TRUE,
   ARRAY[]::TEXT[],
   'Troisièmes lignes (Flanker G, Flanker D, N°8). En format 13, seul le N°8 est présent.',
   ARRAY['3LG','3LD','N8']),

  ('pst-grp-004', 'CTR', 'Centres',       'Centres (gauche ou droit)',
   NULL, 'Centres', TRUE,
   ARRAY[]::TEXT[],
   'Centre gauche ou droit',
   ARRAY['CG','CD']),

  ('pst-grp-005', 'AIL', 'Ailiers',       'Ailiers (gauche ou droit)',
   NULL, 'Ailiers', TRUE,
   ARRAY[]::TEXT[],
   'Ailier gauche ou droit',
   ARRAY['AG','AD']);


-- =====================================================================
-- ============ PARTIE C — VÉRIFICATIONS  ==============================
-- =====================================================================

-- Compte les lignes insérées dans chaque table.
-- Tu devrais voir : poles=5, categories=14, clubs=4, saisons=1, postes=20

SELECT
  'poles'      AS table_name, COUNT(*) AS nb_lignes FROM poles
UNION ALL SELECT 'categories',   COUNT(*) FROM categories
UNION ALL SELECT 'clubs',        COUNT(*) FROM clubs
UNION ALL SELECT 'saisons',      COUNT(*) FROM saisons
UNION ALL SELECT 'postes',       COUNT(*) FROM postes
ORDER BY table_name;


-- Vérification croisée : chaque catégorie a-t-elle bien un pôle ?
-- Tu devrais voir 14 lignes, toutes avec un pole_libelle non NULL.

SELECT
  c.code AS categorie,
  c.libelle_court,
  p.libelle_court AS pole
FROM categories c
LEFT JOIN poles p ON p.id = c.pole_id
ORDER BY c.ordre_tri;


-- =====================================================================
-- FIN DU SCRIPT
-- =====================================================================
-- À ce stade, tu as :
--   ✅ Modèle enrichi (poles, categories, clubs, postes)
--   ✅ 5 pôles insérés
--   ✅ 14 catégories insérées (avec pole_id résolu automatiquement)
--   ✅ 4 clubs insérés
--   ✅ 1 saison active (2025-2026)
--   ✅ 20 postes insérés (15 précis + 5 regroupements)
--   = 44 lignes au total dans 5 tables
--
-- Prochaine étape (ÉTAPE 8) : migration des 297 fiches Personne
-- =====================================================================
