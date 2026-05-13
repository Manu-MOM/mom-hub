-- =====================================================================
-- MOM HUB · DETTE C7-f · PEUPLEMENT INITIAL PARTENAIRES ENTENTE M14
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-14
-- Version : 1.1 (v1.0 retirée : virgule de séparation des VALUES placée
--           APRÈS le commentaire `-- xxx` → mangée par le commentaire de
--           ligne `--` qui va jusqu'à la fin → VALUES non séparées →
--           erreur de syntaxe. V1.1 met les commentaires AVANT les
--           VALUES pour préserver la syntaxe correcte.)
--
-- Importe en base Supabase les fiches identitaires des joueurs et coaches
-- partenaires d'entente M14 SAR/MOM/ASCS, à partir de l'extraction
-- SportEasy SAR "Minimes" (76 lignes brutes).
--
-- =====================================================================
-- WORKFLOW DE DÉRIVATION
-- =====================================================================
--   Source unique : `SportEasy_minimes.xlsx` (export SAR du 14 mai 2026,
--   76 lignes : 62 joueurs + 14 coaches, contient les 3 clubs d'entente
--   mais sans marqueur de club d'appartenance fiable).
--
--   Cross-check fait le 14 mai (cross_check.py) contre la base MOM (38
--   personnes : 23 joueurs M14 + 15 coaches MOM toutes catégories) avec
--   matching tolérant (lowercase, sans accents, sans suffixe " - MOM",
--   tolérance prénom composé, fuzzy Levenshtein sur les cas ambigus).
--
--   Résultats :
--     - 25 lignes SportEasy MATCHENT une fiche MOM existante → IGNORÉES
--       (déjà en base via OVAL-E avec leur type officiel)
--     - 50 lignes ne matchent pas → INSÉRÉES par CE FICHIER comme
--       `licencie_externe_partenaire` avec `club_principal_id = SAR`
--     - 1 zone grise (VAUTIER MOM - Nathan, typo position " - MOM") →
--       reconnue comme MOM, IGNORÉE
--
-- =====================================================================
-- DOCTRINE RETENUE (Doctrine OVAL-E v1.4 §11.7 + Audit C7-a + arbitrage Manu)
-- =====================================================================
--   - type_personne = 'licencie_externe_partenaire' POUR TOUS (joueurs ET
--     coaches partenaires). Distinction métier portée par
--     `categorie_personne` ('joueur' vs 'staff').
--   - club_principal_id = SAR par défaut (toutes les 50 fiches), à
--     corriger en ASCS plus tard via UPDATE quand la liste ASCS sera
--     disponible (dette ouverte).
--   - Blocs sensibles VIDES côté MOM (RGPD) : pas d'email, pas de
--     téléphone, pas de coords parents, pas de documents. Maintien RGPD
--     côté club d'origine.
--   - sexe = NULL (colonne vide dans SportEasy, à compléter plus tard).
--   - date_naissance présente pour seulement 27/50 partenaires (le reste NULL).
--   - tag_verifier = TRUE sur les 50 fiches pour permettre identification
--     facile lors des corrections futures (notamment dette ASCS).
--   - source_creation et modifie_par renseignés pour traçabilité.
--
-- =====================================================================
-- HORS PÉRIMÈTRE
-- =====================================================================
--   - Pas d'INSERT dans equipe_joueurs (39 attaches à faire dans
--     sql/17-attaches-partenaires-entente-m14.sql après validation
--     visuelle des 50 fiches `personnes` créées par ce fichier).
--   - Pas de remplissage des emails / téléphones / parents (doctrine RGPD).
--   - Pas de correction des fiches SAR mal taggées vers ASCS (dette).
--
-- =====================================================================
-- DETTES OUVERTES PAR CE FICHIER
-- =====================================================================
--   (m) Correction post-import ASCS : N joueurs (à déterminer, Manu
--       fournira la liste plus tard) actuellement en `club_principal_id
--       = SAR` doivent être basculés en ASCS via UPDATE ciblé.
--   (n) Complétion sexe + date_naissance manquants : ~23 fiches sans
--       date_naissance + 50/50 fiches sans sexe. À compléter via canal
--       Excel manuel auprès des coachs SAR/ASCS (gabarit déjà livré
--       gabarit-effectif-partenaire-entente-mom-v1.xlsx).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : NON. Pour rejouer, faire d'abord :
--   DELETE FROM personnes WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1';
-- =====================================================================

BEGIN;

INSERT INTO personnes (
  categorie_personne,
  nom,
  prenom,
  date_naissance,
  type_personne,
  numero_licence_ffr,
  club_principal_id,
  source_creation,
  modifie_par,
  tag_verifier
) VALUES
  -- 🏉 Joueur ALIAS Jacques
  ('joueur', 'ALIAS', 'Jacques', '2013-07-24', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur ALSHSHIAT Anas
  ('joueur', 'ALSHSHIAT', 'Anas', NULL, 'licencie_externe_partenaire', '2013021520829', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur BAUDOUIN Mathis
  ('joueur', 'BAUDOUIN', 'Mathis', '2013-06-01', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur BERNARDSON Tahina
  ('joueur', 'BERNARDSON', 'Tahina', '2012-06-17', 'licencie_externe_partenaire', '2012061458688', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur BERTHAUX MENNA Noé
  ('joueur', 'BERTHAUX MENNA', 'Noé', '2012-10-12', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur BIRIKORANG Benjamin
  ('joueur', 'BIRIKORANG', 'Benjamin', '2013-03-22', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur CELLIER Ismaël
  ('joueur', 'CELLIER', 'Ismaël', '2013-11-01', 'licencie_externe_partenaire', '2013111222710', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur CHABBERT Léonard
  ('joueur', 'CHABBERT', 'Léonard', '2012-07-14', 'licencie_externe_partenaire', '2012071317467', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur CHAKOR Sidi Mohamed
  ('joueur', 'CHAKOR', 'Sidi Mohamed', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur DIZENGA Brandon
  ('joueur', 'DIZENGA', 'Brandon', '2013-03-01', 'licencie_externe_partenaire', '2013031092416', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur DJENIDI Adam
  ('joueur', 'DJENIDI', 'Adam', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur DUBOIS Dan
  ('joueur', 'DUBOIS', 'Dan', NULL, 'licencie_externe_partenaire', '2012101188115', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur DUCHATELLE Arthur
  ('joueur', 'DUCHATELLE', 'Arthur', '2012-09-23', 'licencie_externe_partenaire', '2012091354313', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur EL-OUARIACHI TOUTOUHI Maher
  ('joueur', 'EL-OUARIACHI TOUTOUHI', 'Maher', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur FLORENTIN Alphonse
  ('joueur', 'FLORENTIN', 'Alphonse', '2012-04-19', 'licencie_externe_partenaire', '2012041303569', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur GAID Yasmine
  ('joueur', 'GAID', 'Yasmine', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur GASTYC Léon
  ('joueur', 'GASTYC', 'Léon', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur GHILES Gabriel
  ('joueur', 'GHILES', 'Gabriel', '2012-08-21', 'licencie_externe_partenaire', '2012081185366', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur GRANDVUILLEMIN Yann
  ('joueur', 'GRANDVUILLEMIN', 'Yann', '2013-09-12', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur KARLI Pierre
  ('joueur', 'KARLI', 'Pierre', '2012-09-12', 'licencie_externe_partenaire', '2012091486070', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur KEMLER NAILI Gaspard
  ('joueur', 'KEMLER NAILI', 'Gaspard', '2012-02-15', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur KOENIG Martin
  ('joueur', 'KOENIG', 'Martin', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur KRAUS Benjamin
  ('joueur', 'KRAUS', 'Benjamin', '2013-05-28', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur LABARRAQUE DUPOUY Lucien
  ('joueur', 'LABARRAQUE DUPOUY', 'Lucien', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur LAMI Tausiale
  ('joueur', 'LAMI', 'Tausiale', '2012-10-01', 'licencie_externe_partenaire', '2012101068209', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur MAKHARASHVILI Alexandre
  ('joueur', 'MAKHARASHVILI', 'Alexandre', '2013-01-17', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur MISCHEL Côme
  ('joueur', 'MISCHEL', 'Côme', '2013-01-26', 'licencie_externe_partenaire', '2013011365538', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur MOHAMMAD-ALI Bhatti
  ('joueur', 'MOHAMMAD-ALI', 'Bhatti', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur MURAIL Marvin
  ('joueur', 'MURAIL', 'Marvin', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur OBIDI Jarvin
  ('joueur', 'OBIDI', 'Jarvin', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur PROU Mériadec
  ('joueur', 'PROU', 'Mériadec', '2013-03-18', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur ROLL Samuel
  ('joueur', 'ROLL', 'Samuel', '2013-10-03', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur SCHMITT Lucas
  ('joueur', 'SCHMITT', 'Lucas', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur SCHNEIDER Fériel
  ('joueur', 'SCHNEIDER', 'Fériel', '2011-05-22', 'licencie_externe_partenaire', '2011052144563', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur SOW Baila
  ('joueur', 'SOW', 'Baila', NULL, 'licencie_externe_partenaire', '2012081542975', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur TERLIER Emil
  ('joueur', 'TERLIER', 'Emil', NULL, 'licencie_externe_partenaire', '2012061201773', (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur TOMASI Marius
  ('joueur', 'TOMASI', 'Marius', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur VERRIER Soan
  ('joueur', 'VERRIER', 'Soan', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🏉 Joueur ZEAMARI Mohamed
  ('joueur', 'ZEAMARI', 'Mohamed', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  BELKIS Anne
  ('staff', 'BELKIS', 'Anne', '1978-01-20', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  BOUCHEZ Rachel
  ('staff', 'BOUCHEZ', 'Rachel', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  DUCHATELLE Julien
  ('staff', 'DUCHATELLE', 'Julien', '1983-06-07', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  GONTHIER Milan
  ('staff', 'GONTHIER', 'Milan', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  HELM Loic
  ('staff', 'HELM', 'Loic', '1984-04-12', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  KADIEBWE Olivier
  ('staff', 'KADIEBWE', 'Olivier', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  KURTZ Jean-Philippe
  ('staff', 'KURTZ', 'Jean-Philippe', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  LACOMBE Baptiste
  ('staff', 'LACOMBE', 'Baptiste', '2007-09-07', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  MALOSSANE Adrien
  ('staff', 'MALOSSANE', 'Adrien', NULL, 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  PAILLOUX Michel
  ('staff', 'PAILLOUX', 'Michel', '1999-12-23', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true),
  -- 🎓 Coach  VOEGELI Lorène
  ('staff', 'VOEGELI', 'Lorène', '2006-05-27', 'licencie_externe_partenaire', NULL, (SELECT id FROM clubs WHERE code='SAR'), 'sporteasy_sar_minimes_2025-2026_v1', 'C7-f-import-script-v1', true);


-- =====================================================================
-- Vérifications post-INSERT
-- =====================================================================

-- A) Compte global : doit être 50 (39 joueurs + 11 coaches)
SELECT
  COUNT(*) FILTER (WHERE categorie_personne = 'joueur') AS nb_joueurs,
  COUNT(*) FILTER (WHERE categorie_personne = 'staff')  AS nb_coaches,
  COUNT(*) AS total
FROM personnes
WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1';
-- Attendu : 39 | 11 | 50

-- B) Aperçu trié par catégorie puis nom
SELECT
  categorie_personne,
  nom,
  prenom,
  date_naissance,
  numero_licence_ffr,
  (SELECT code FROM clubs WHERE id = personnes.club_principal_id) AS club_code
FROM personnes
WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
ORDER BY categorie_personne, nom, prenom;

-- C) Vérification doctrine : aucune fiche partenaire en MOM (sécurité)
SELECT COUNT(*) AS nb_partenaires_mal_taggees_mom
FROM personnes
WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
  AND club_principal_id = (SELECT id FROM clubs WHERE code = 'MOM');
-- Attendu : 0

COMMIT;
