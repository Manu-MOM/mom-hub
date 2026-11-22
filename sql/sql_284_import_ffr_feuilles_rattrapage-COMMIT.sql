-- =====================================================================
-- sql_284 — IMPORT-FFR-RATTRAPAGE v1, lot L2 : compositions et faits de
--           match FFR des matchs joués sans suivi
-- ---------------------------------------------------------------------
-- FAIT FOI : Conception-IMPORT-FFR-RATTRAPAGE-v1.md (gelé par Manu le
-- 21/11/2026), décisions D2-A, D3-A, D5-A (SUIVI-VEO), D6-A, D7-A.
-- Écart D1 : à la demande expresse de Manu (« fais-le par toi-même »),
-- les feuilles ont été lues par Claude dans le navigateur de Manu
-- (Mon Club House, 21/11/2026), et non collées (D1-A). À tracer.
--
-- Matchs (10) : R3 J2 à J7 ; réserve J1, 31/10 contre Mulhouse (enfant
-- du plateau), J7 ; Seniors F J4. Sans feuille FFR (rien à importer) :
-- R3 J1 Drusus, réserve 31/10 Naborien, M16 R2 J2 Meuse.
-- Contrôle préalable : pour chaque feuille, la somme des actions = score
-- officiel FFR (10/10).
--
-- Contenu :
--   1. Rapprochement FFR → personnes (nom + prénom/initiale, unicité dans
--      la catégorie puis dans le Hub ; sinon non rapproché, jamais deviné).
--   2. Une compo de match 'validee' par match ; poste = place sur la
--      feuille (XV) ou numéro (match à XII) ; remplaçant = poste du joueur
--      remplacé à sa 1re entrée.
--   3. Faits FFR dans chronologie_suivi : essais, transformations,
--      pénalités (essai de pénalité = essai + transformation sans joueur,
--      convention L6), cartons blanc/jaune/rouge, remplacements
--      (sortant / entrant), points adverses. source 'ffr', saisi_par
--      'import:ffr-rattrapage-l2' (traçabilité honnête de l'auteur).
--      Non importé : carton bleu (pas d'observable ; la sortie est portée
--      par le remplacement).
--   4. Durées 2 × 35 du match réserve contre Mulhouse (lues sur la feuille).
--   5. Vosges (M16 R2 J1) : score administratif 86-12, suivi conservé.
--   6. Re-consolidation du score depuis le suivi pour les 10 matchs.
--   7. Vérification fail-loud (scores = FFR, compos, lignes, Vosges).
--
-- Limites connues (feuilles FFR) : R3 J4 Illkirch, l'entrée d'E. HOEHN
-- n'est pas enregistrée par la FFR (il n'apparaît qu'en sortie) → temps
-- de jeu nul pour lui. Remplacements « tournants » des seniors repris
-- tels que publiés.
--
-- Mode : COMMIT (identique au DRY-RUN hors aperçu, à appliquer uniquement
-- sur feu vert explicite de Manu). Dry-run vert le 21/11/2026 : VERIF OK ;
-- 10 scores recalculés = scores officiels FFR ; seul joueur non rapproché :
-- A. HAYET (Seniors F J4) = Aline MUNSCH selon Manu (arbitrage D3-A).
-- =====================================================================

BEGIN;

CREATE TEMP TABLE _m (ffr TEXT, evt UUID, fmt TEXT, cat TEXT, exp_mom INT, exp_adv INT, lib TEXT) ON COMMIT DROP;
INSERT INTO _m VALUES

  ('1576280', '6c6f512b-c494-4c1b-a109-a4884c73c4ff'::uuid, 'XV', 'SR-M', 125, 6, 'R3 J2 27/09 Sarreguemines 6 - 125 MOM'),
  ('1576283', '86101734-8a64-4fce-9063-1f422897c24c'::uuid, 'XV', 'SR-M', 73, 39, 'R3 J3 11/10 MOM 73 - 39 Lauterbourg AS'),
  ('1576286', '386515ee-6185-4825-a71d-468e1fbfb597'::uuid, 'XV', 'SR-M', 23, 17, 'R3 J4 18/10 Illkirch 17 - 23 MOM'),
  ('1576289', '5c872d8f-6468-4c3b-9f99-0686bb3d9d44'::uuid, 'XV', 'SR-M', 36, 22, 'R3 J5 31/10 MOM 36 - 22 Saverne'),
  ('1576294', '60074a0f-74cc-44a5-9d0c-012a0d7f5946'::uuid, 'XV', 'SR-M', 127, 3, 'R3 J6 08/11 Selestat 3 - 127 MOM'),
  ('1576298', '3696c3ca-cfd6-4b95-9985-8febd0a39019'::uuid, 'XV', 'SR-M', 40, 18, 'R3 J7 15/11 MOM 40 - 18 Saint Die'),
  ('1615856', '0476d7af-fe14-4915-a136-3e6ca38c5ab0'::uuid, 'XV', 'SR-M', 48, 10, 'RES J1 04/10 Thionville 10 - 48 MOM'),
  ('1615868', 'fbbc89cb-178e-43be-b526-ba0c8a899cc2'::uuid, 'XII', 'SR-M', 38, 33, 'RES 31/10 MOM 38 - 33 Mulhouse'),
  ('1615875', '131377bf-bcd4-4967-beca-c4c048afdc9f'::uuid, 'XV', 'SR-M', 98, 5, 'RES J7 15/11 MOM 98 - 5 Saint Die'),
  ('1620280', 'e7ffadaa-73a6-4940-bcf7-44f27cf95875'::uuid, 'XV', 'SR-F', 0, 30, 'F J4 15/11 Storkas 30 - 0 MOM');

CREATE TEMP TABLE _r (ffr TEXT, num INT, slot INT, prenom TEXT, nom TEXT, ini TEXT, tit BOOLEAN, cap BOOLEAN,
                      poste_code TEXT, ordre INT) ON COMMIT DROP;
INSERT INTO _r VALUES

  ('1576280', 1, 1, 'NICOLAS', 'NARES', '', true, false, 'PG', NULL),
  ('1576280', 2, 2, 'GEOFFROY', 'GUTHMULLER', '', true, false, 'TAL', NULL),
  ('1576280', 3, 3, 'LUCAS', 'WEISS', '', true, false, 'PD', NULL),
  ('1576280', 4, 4, 'LEONARD', 'NOSLIER', '', true, false, '2LG', NULL),
  ('1576280', 5, 5, 'BAPTISTE', 'LACOMBE', '', true, false, '2LD', NULL),
  ('1576280', 6, 6, 'LILIAN', 'LITT', '', true, false, '3LG', NULL),
  ('1576280', 8, 7, 'THEO', 'HERMSDORFF', '', true, false, '3LD', NULL),
  ('1576280', 7, 8, 'JULIEN', 'KUNTZ', '', true, false, 'N8', NULL),
  ('1576280', 9, 9, 'MAXIME', 'FLORENTIN', '', true, false, 'DM', NULL),
  ('1576280', 10, 10, 'LEO', 'MASSON', '', true, false, 'DO', NULL),
  ('1576280', 11, 11, 'MAXIME', 'ARANEDER', '', true, false, 'AG', NULL),
  ('1576280', 12, 12, 'SIMON', 'HOMO', '', true, true, 'CG', NULL),
  ('1576280', 13, 13, 'CHARLES AARON', 'BERGMANN', '', true, false, 'CD', NULL),
  ('1576280', 14, 14, 'MICHEL', 'PAILLOUX', '', true, false, 'AD', NULL),
  ('1576280', 15, 15, 'MAXIME', 'BRALIA', '', true, false, 'AR', NULL),
  ('1576280', 16, NULL, 'MALO', 'DI NINO', '', false, false, 'PG', 1),
  ('1576280', 17, NULL, 'VICTOR', 'KELLER', '', false, false, 'TAL', 2),
  ('1576280', 18, NULL, 'QUENTIN', 'MORREALE', '', false, false, 'PD', 3),
  ('1576280', 19, NULL, 'PAUL ALEXANDRE', 'SCHALL', '', false, false, 'N8', 4),
  ('1576280', 20, NULL, 'TOM', 'BEHRA', '', false, false, 'DM', 5),
  ('1576280', 21, NULL, 'LEON', 'KOERIN', '', false, false, 'DO', 6),
  ('1576280', 22, NULL, 'VICTOR', 'MALET', '', false, false, 'AR', 7),
  ('1576283', 1, 1, 'QUENTIN', 'MORREALE', '', true, false, 'PG', NULL),
  ('1576283', 2, 2, 'GEOFFROY', 'GUTHMULLER', '', true, false, 'TAL', NULL),
  ('1576283', 3, 3, 'VINCENT', 'MARTIN', '', true, false, 'PD', NULL),
  ('1576283', 4, 4, 'CORENTIN', 'VIARD', '', true, false, '2LG', NULL),
  ('1576283', 5, 5, 'BAPTISTE', 'LACOMBE', '', true, false, '2LD', NULL),
  ('1576283', 6, 6, '', 'MERTZ', 'T', true, false, '3LG', NULL),
  ('1576283', 7, 8, '', 'KUNTZ', 'J', true, false, 'N8', NULL),
  ('1576283', 8, 7, 'JEROME', 'CLAR', '', true, false, '3LD', NULL),
  ('1576283', 9, 9, 'MAXIME', 'FLORENTIN', '', true, false, 'DM', NULL),
  ('1576283', 10, 10, 'LEO', 'MASSON', '', true, false, 'DO', NULL),
  ('1576283', 11, 11, 'HUGO', 'PIRES', '', true, false, 'AG', NULL),
  ('1576283', 12, 12, 'THEO', 'HERMSDORFF', '', true, false, 'CG', NULL),
  ('1576283', 13, 13, '', 'BERGMANN', 'C', true, false, 'CD', NULL),
  ('1576283', 14, 14, 'LEON', 'KOERIN', '', true, false, 'AD', NULL),
  ('1576283', 15, 15, 'SIMON', 'HOMO', '', true, true, 'AR', NULL),
  ('1576283', 16, NULL, 'JEROME', 'TOTH', '', false, false, 'PG', 7),
  ('1576283', 17, NULL, 'VICTOR', 'KELLER', '', false, false, 'TAL', 1),
  ('1576283', 18, NULL, 'MALO', 'DI NINO', '', false, false, 'PD', 6),
  ('1576283', 19, NULL, 'NICOLAS', 'NARES', '', false, false, '2LD', 5),
  ('1576283', 20, NULL, 'TOM', 'BEHRA', '', false, false, 'DM', 3),
  ('1576283', 21, NULL, 'MAXIME', 'BRALIA', '', false, false, 'DO', 2),
  ('1576283', 22, NULL, 'LEONARD', 'NOSLIER', '', false, false, '2LG', 4),
  ('1576286', 1, 1, 'QUENTIN', 'MORREALE', '', true, false, 'PG', NULL),
  ('1576286', 2, 2, 'VICTOR', 'KELLER', '', true, false, 'TAL', NULL),
  ('1576286', 3, 3, 'LUCAS', 'WEISS', '', true, false, 'PD', NULL),
  ('1576286', 4, 4, 'CORENTIN', 'VIARD', '', true, false, '2LG', NULL),
  ('1576286', 5, 5, 'NICOLAS', 'NARES', '', true, false, '2LD', NULL),
  ('1576286', 6, 6, 'THEO', 'MERTZ', '', true, false, '3LG', NULL),
  ('1576286', 7, 8, 'JULIEN', 'KUNTZ', '', true, false, 'N8', NULL),
  ('1576286', 8, 7, '', 'LITT', 'L', true, false, '3LD', NULL),
  ('1576286', 9, 9, 'MAXIME', 'FLORENTIN', '', true, false, 'DM', NULL),
  ('1576286', 10, 10, '', 'MASSON', 'L', true, false, 'DO', NULL),
  ('1576286', 11, 11, 'FLORIAN', 'SCHNELL', '', true, false, 'AG', NULL),
  ('1576286', 12, 12, 'THEO', 'HERMSDORFF', '', true, false, 'CG', NULL),
  ('1576286', 13, 13, 'CHARLES AARON', 'BERGMANN', '', true, false, 'CD', NULL),
  ('1576286', 14, 14, '', 'BRALIA', 'M', true, false, 'AD', NULL),
  ('1576286', 15, 15, '', 'HOMO', 'S', true, true, 'AR', NULL),
  ('1576286', 16, NULL, 'ENZO', 'HOEHN', '', false, false, 'TAL', NULL),
  ('1576286', 17, NULL, 'VINCENT', 'MARTIN', '', false, false, 'PG', 1),
  ('1576286', 18, NULL, 'MALO', 'DI NINO', '', false, false, 'PD', 2),
  ('1576286', 19, NULL, 'BAPTISTE', 'LACOMBE', '', false, false, '3LG', 3),
  ('1576286', 20, NULL, 'VICTOR', 'MALET', '', false, false, 'DM', 5),
  ('1576286', 21, NULL, 'TOM', 'BEHRA', '', false, false, 'CG', 4),
  ('1576286', 22, NULL, 'LEO', 'DI NINO', '', false, false, '2LD', 6),
  ('1576289', 1, 1, 'QUENTIN', 'MORREALE', '', true, false, 'PG', NULL),
  ('1576289', 2, 2, 'VICTOR', 'KELLER', '', true, false, 'TAL', NULL),
  ('1576289', 3, 3, 'VINCENT', 'MARTIN', '', true, false, 'PD', NULL),
  ('1576289', 4, 4, '', 'VIARD', 'C', true, false, '2LG', NULL),
  ('1576289', 5, 5, 'BAPTISTE', 'LACOMBE', '', true, false, '2LD', NULL),
  ('1576289', 6, 6, '', 'MERTZ', 'T', true, false, '3LG', NULL),
  ('1576289', 7, 8, '', 'GUTTON', 'S', true, false, 'N8', NULL),
  ('1576289', 8, 7, 'LILIAN', 'LITT', '', true, false, '3LD', NULL),
  ('1576289', 9, 9, 'MAXIME', 'FLORENTIN', '', true, false, 'DM', NULL),
  ('1576289', 10, 10, '', 'LAFFONT', 'C', true, false, 'DO', NULL),
  ('1576289', 11, 11, 'LEO', 'MASSON', '', true, false, 'AG', NULL),
  ('1576289', 12, 12, 'SIMON', 'HOMO', '', true, true, 'CG', NULL),
  ('1576289', 13, 13, '', 'BEHRA', 'T', true, false, 'CD', NULL),
  ('1576289', 14, 14, 'LEON', 'KOERIN', '', true, false, 'AD', NULL),
  ('1576289', 15, 15, 'MAXIME', 'BRALIA', '', true, false, 'AR', NULL),
  ('1576289', 16, NULL, 'LEO', 'DI NINO', '', false, false, 'PG', 2),
  ('1576289', 18, NULL, 'MALO', 'DI NINO', '', false, false, 'TAL', 3),
  ('1576289', 19, NULL, 'LEO', 'DUPIN', '', false, false, '2LD', 7),
  ('1576289', 20, NULL, 'VICTOR', 'MALET', '', false, false, 'DM', 6),
  ('1576289', 21, NULL, 'THEO', 'HERMSDORFF', '', false, false, 'AD', 5),
  ('1576289', 22, NULL, 'JULIEN', 'KUNTZ', '', false, false, '3LD', 1),
  ('1576289', 23, NULL, 'LUCAS', 'WEISS', '', false, false, 'PD', 4),
  ('1576294', 1, 1, 'MALO', 'DI NINO', '', true, false, 'PG', NULL),
  ('1576294', 2, 2, 'LEO', 'DI NINO', '', true, false, 'TAL', NULL),
  ('1576294', 23, 3, 'LUCAS', 'WEISS', '', true, false, 'PD', NULL),
  ('1576294', 4, 4, 'DIDIER', 'KELLER', '', true, false, '2LG', NULL),
  ('1576294', 5, 5, 'CORENTIN', 'VIARD', '', true, false, '2LD', NULL),
  ('1576294', 6, 6, 'MURAT', 'ALTUN', '', true, false, '3LG', NULL),
  ('1576294', 7, 8, 'JULIEN', 'KUNTZ', '', true, false, 'N8', NULL),
  ('1576294', 8, 7, 'SEBASTIEN', 'GUTTON', '', true, false, '3LD', NULL),
  ('1576294', 9, 9, 'VICTOR', 'MALET', '', true, false, 'DM', NULL),
  ('1576294', 10, 10, 'CIPRIAN', 'ANDREI', '', true, false, 'DO', NULL),
  ('1576294', 11, 11, 'LEO', 'MASSON', '', true, false, 'AG', NULL),
  ('1576294', 12, 12, 'THEO', 'HERMSDORFF', '', true, false, 'CG', NULL),
  ('1576294', 13, 13, 'CHARLES AARON', 'BERGMANN', '', true, true, 'CD', NULL),
  ('1576294', 14, 14, 'FLORIAN', 'SCHNELL', '', true, false, 'AD', NULL),
  ('1576294', 15, 15, 'MAXIME', 'BRALIA', '', true, false, 'AR', NULL),
  ('1576294', 16, NULL, 'GEOFFROY', 'GUTHMULLER', '', false, false, 'PG', 2),
  ('1576294', 17, NULL, 'VINCENT', 'MARTIN', '', false, false, 'TAL', 3),
  ('1576294', 18, NULL, 'MARTIN', 'BOURGUIGNON', '', false, false, 'PD', 4),
  ('1576294', 19, NULL, 'NICOLAS', 'NARES', '', false, false, 'N8', 6),
  ('1576294', 20, NULL, 'MAXIME', 'FLORENTIN', '', false, false, 'DM', 1),
  ('1576294', 21, NULL, 'SIMON', 'HOMO', '', false, false, 'CG', 5),
  ('1576294', 22, NULL, 'LEONARD', 'NOSLIER', '', false, false, '2LD', 7),
  ('1576298', 1, 1, 'MARTIN', 'BOURGUIGNON', '', true, false, 'PG', NULL),
  ('1576298', 2, 2, 'GEOFFROY', 'GUTHMULLER', '', true, false, 'TAL', NULL),
  ('1576298', 23, 3, 'LUCAS', 'WEISS', '', true, false, 'PD', NULL),
  ('1576298', 4, 4, 'NICOLAS', 'NARES', '', true, false, '2LG', NULL),
  ('1576298', 5, 5, 'BAPTISTE', 'LACOMBE', '', true, false, '2LD', NULL),
  ('1576298', 6, 6, '', 'GUTTON', 'S', true, false, '3LG', NULL),
  ('1576298', 8, 7, '', 'LITT', 'L', true, false, '3LD', NULL),
  ('1576298', 7, 8, '', 'KUNTZ', 'J', true, false, 'N8', NULL),
  ('1576298', 9, 9, 'MAXIME', 'FLORENTIN', '', true, false, 'DM', NULL),
  ('1576298', 10, 10, 'CEDRIC', 'LAFFONT', '', true, false, 'DO', NULL),
  ('1576298', 11, 11, 'MAXIME', 'BRALIA', '', true, false, 'AG', NULL),
  ('1576298', 12, 12, 'THEO', 'HERMSDORFF', '', true, false, 'CG', NULL),
  ('1576298', 13, 13, 'CHARLES AARON', 'BERGMANN', '', true, false, 'CD', NULL),
  ('1576298', 14, 14, 'FLORIAN', 'SCHNELL', '', true, false, 'AD', NULL),
  ('1576298', 15, 15, 'SIMON', 'HOMO', '', true, true, 'AR', NULL),
  ('1576298', 16, NULL, 'LEO', 'DI NINO', '', false, false, 'TAL', 3),
  ('1576298', 17, NULL, 'MALO', 'DI NINO', '', false, false, 'PG', 2),
  ('1576298', 18, NULL, 'QUENTIN', 'MORREALE', '', false, false, 'PD', 4),
  ('1576298', 19, NULL, 'LEO', 'DUPIN', '', false, false, '2LG', 1),
  ('1576298', 20, NULL, 'TOM', 'BEHRA', '', false, false, 'CD', 5),
  ('1576298', 21, NULL, 'LOUIS', 'VIAL', '', false, false, 'DM', 7),
  ('1576298', 22, NULL, 'MURAT', 'ALTUN', '', false, false, '2LD', 6),
  ('1615856', 1, 1, 'VINCENT', 'MARTIN', '', true, false, 'PG', NULL),
  ('1615856', 2, 2, 'ENZO', 'HOEHN', '', true, false, 'TAL', NULL),
  ('1615856', 23, 3, 'GAUTHIER', 'BONNEVILLE', '', true, false, 'PD', NULL),
  ('1615856', 4, 4, 'LEONARD', 'NOSLIER', '', true, false, '2LG', NULL),
  ('1615856', 5, 5, 'JONATHAN', 'OBERT', '', true, false, '2LD', NULL),
  ('1615856', 6, 6, 'MURAT', 'ALTUN', '', true, false, '3LG', NULL),
  ('1615856', 8, 7, 'CORENTIN', 'VIARD', '', true, false, '3LD', NULL),
  ('1615856', 7, 8, 'THEO', 'MERTZ', '', true, true, 'N8', NULL),
  ('1615856', 9, 9, 'MICHEL', 'PAILLOUX', '', true, false, 'DM', NULL),
  ('1615856', 10, 10, 'LEO', 'MASSON', '', true, false, 'DO', NULL),
  ('1615856', 11, 11, 'LOUIS', 'VIAL', '', true, false, 'AG', NULL),
  ('1615856', 12, 12, 'THEO', 'HERMSDORFF', '', true, false, 'CG', NULL),
  ('1615856', 13, 13, 'HUGO', 'PIRES', '', true, false, 'CD', NULL),
  ('1615856', 14, 14, 'JOE', 'SUTRELL', '', true, false, 'AD', NULL),
  ('1615856', 15, 15, 'JORYS', 'FRAICHE', '', true, false, 'AR', NULL),
  ('1615856', 3, NULL, 'LUCAS', 'WEISS', '', false, false, 'PD', 1),
  ('1615856', 16, NULL, 'JEROME', 'TOTH', '', false, false, 'TAL', 6),
  ('1615856', 17, NULL, 'VICTOR', 'KELLER', '', false, false, 'PG', 4),
  ('1615856', 18, NULL, 'FLORIAN', 'BOLLI', '', false, false, 'PG', 7),
  ('1615856', 19, NULL, 'LILIAN', 'LITT', '', false, false, '3LG', 3),
  ('1615856', 20, NULL, 'MAXIME', 'FLORENTIN', '', false, false, 'DM', 2),
  ('1615856', 21, NULL, 'LEON', 'KOERIN', '', false, false, 'AD', 5),
  ('1615868', 1, 1, 'JEROME', 'TOTH', '', true, false, 'PG', NULL),
  ('1615868', 2, 2, 'GEOFFROY', 'GUTHMULLER', '', true, false, 'TAL', NULL),
  ('1615868', 3, 3, 'FLORIAN', 'BOLLI', '', true, false, 'PD', NULL),
  ('1615868', 5, 5, 'LEONARD', 'NOSLIER', '', true, false, '2LD', NULL),
  ('1615868', 7, 4, 'PAUL ALEXANDRE', 'SCHALL', '', true, false, '3LD', NULL),
  ('1615868', 8, 6, '', 'GRUNENWALD', 'J', true, true, 'N8', NULL),
  ('1615868', 9, 7, 'GUILLAUME', 'LUCHESI', '', true, false, 'DM', NULL),
  ('1615868', 10, 8, 'CIPRIAN', 'ANDREI', '', true, false, 'DO', NULL),
  ('1615868', 11, 9, 'JOE', 'SUTRELL', '', true, false, 'AG', NULL),
  ('1615868', 12, 10, 'FLORIAN', 'SCHNELL', '', true, false, 'CG', NULL),
  ('1615868', 13, 11, '', 'ABDALLAH', 'Y', true, false, 'CD', NULL),
  ('1615868', 15, 12, 'LOUIS', 'VIAL', '', true, false, 'AR', NULL),
  ('1615868', 4, NULL, 'MARTIN', 'BOURGUIGNON', '', false, false, 'PD', 3),
  ('1615868', 6, NULL, 'MURAT', 'ALTUN', '', false, false, '3LD', 1),
  ('1615868', 14, NULL, 'VITO', 'MOEFANA', '', false, false, 'AG', 4),
  ('1615868', 23, NULL, 'GAUTHIER', 'BONNEVILLE', '', false, false, 'PG', 2),
  ('1615875', 1, 1, 'JEROME', 'TOTH', '', true, false, 'PG', NULL),
  ('1615875', 2, 2, 'VICTOR', 'KELLER', '', true, false, 'TAL', NULL),
  ('1615875', 3, 3, '', 'BONNEVILLE', 'G', true, false, 'PD', NULL),
  ('1615875', 4, 4, 'LEONARD', 'NOSLIER', '', true, false, '2LG', NULL),
  ('1615875', 5, 5, '', 'FRIEDRICH', 'G', true, false, '2LD', NULL),
  ('1615875', 6, 6, 'DIDIER', 'KELLER', '', true, false, '3LG', NULL),
  ('1615875', 7, 8, 'PAUL ALEXANDRE', 'SCHALL', '', true, false, 'N8', NULL),
  ('1615875', 8, 7, '', 'GRUNENWALD', 'J', true, true, '3LD', NULL),
  ('1615875', 9, 9, '', 'LUCHESI', 'G', true, false, 'DM', NULL),
  ('1615875', 10, 10, 'CIPRIAN', 'ANDREI', '', true, false, 'DO', NULL),
  ('1615875', 11, 11, 'JOE', 'SUTRELL', '', true, false, 'AG', NULL),
  ('1615875', 12, 12, 'VITO', 'MOEFANA', '', true, false, 'CG', NULL),
  ('1615875', 13, 13, 'HUGO', 'PIRES', '', true, false, 'CD', NULL),
  ('1615875', 14, 14, 'JORYS', 'FRAICHE', '', true, false, 'AD', NULL),
  ('1615875', 15, 15, 'MICHEL', 'PAILLOUX', '', true, false, 'AR', NULL),
  ('1615875', 20, NULL, 'CHRISTOPHE', 'TRENDEL', '', false, false, 'AG', 2),
  ('1615875', 21, NULL, 'BAPTISTE', 'RENCK ZWINGER', '', false, false, '3LG', 1),
  ('1620280', 1, 3, '', 'VOEGELI', 'L', true, false, 'PD', NULL),
  ('1620280', 2, 2, 'TYPHANIE', 'LOEFFLER', '', true, false, 'TAL', NULL),
  ('1620280', 3, 1, 'MAYA', 'HARTMANN', '', true, false, 'PG', NULL),
  ('1620280', 4, 4, '', 'ITTEL', 'L', true, false, '2LG', NULL),
  ('1620280', 5, 8, '', 'VAUTIER', 'S', true, false, 'N8', NULL),
  ('1620280', 6, 6, '', 'NUSS WINTERMANTEL', 'A', true, false, '3LG', NULL),
  ('1620280', 7, 5, '', 'GRENADIN', 'A', true, false, '2LD', NULL),
  ('1620280', 8, 7, 'ALLISON', 'NARES', '', true, false, '3LD', NULL),
  ('1620280', 9, 9, 'ANNA', 'SAUVADET', '', true, false, 'DM', NULL),
  ('1620280', 10, 10, 'ALINE', 'HAYET', '', true, true, 'DO', NULL),
  ('1620280', 11, 11, 'CLEMENCE', 'LUCENA', '', true, false, 'AG', NULL),
  ('1620280', 12, 12, '', 'ARBOGAST', 'L', true, false, 'CG', NULL),
  ('1620280', 13, 13, '', 'CALMES', 'S', true, false, 'CD', NULL),
  ('1620280', 14, 14, '', 'MARTIN', 'V', true, false, 'AD', NULL),
  ('1620280', 15, 15, 'MELANIE', 'STEGER', '', true, false, 'AR', NULL),
  ('1620280', 16, NULL, 'JULIANNE', 'LAMPIN', '', false, false, 'DO', 1),
  ('1620280', 17, NULL, 'ELISA', 'DE BRUYNE', '', false, false, 'PG', 2),
  ('1620280', 18, NULL, 'ANAIS', 'MAUBOURGUET', '', false, false, 'AR', 4),
  ('1620280', 19, NULL, 'LISA', 'MOREL', '', false, false, 'AG', 6),
  ('1620280', 20, NULL, 'LEA', 'SACKSTEDER', '', false, false, 'DO', 5),
  ('1620280', 21, NULL, 'CONSTANCE', 'ROEDER', '', false, false, 'AR', 7),
  ('1620280', 22, NULL, 'ADELINE', 'HUGEL', '', false, false, '3LD', 3);

CREATE TEMP TABLE _e (ffr TEXT, seq INT, per INT, mn INT, obs TEXT, pts INT, side TEXT, n1 INT, n2 INT) ON COMMIT DROP;
INSERT INTO _e VALUES

  ('1576280', 1, 1, 0, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1576280', 2, 1, 2, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576280', 3, 1, 2, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576280', 4, 1, 4, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1576280', 5, 1, 9, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576280', 6, 1, 9, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576280', 7, 1, 13, 'obs-A-penalite', 3, 'adverse', NULL, NULL),
  ('1576280', 8, 1, 21, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1576280', 9, 1, 22, 'obs-A-substitution', 0, 'notre', 1, 16),
  ('1576280', 10, 1, 22, 'obs-A-substitution', 0, 'notre', 2, 17),
  ('1576280', 11, 1, 22, 'obs-A-substitution', 0, 'notre', 3, 18),
  ('1576280', 12, 1, 22, 'obs-A-substitution', 0, 'notre', 5, 6),
  ('1576280', 13, 1, 22, 'obs-A-substitution', 0, 'notre', 7, 19),
  ('1576280', 14, 1, 22, 'obs-A-substitution', 0, 'notre', 9, 20),
  ('1576280', 15, 1, 22, 'obs-A-substitution', 0, 'notre', 10, 21),
  ('1576280', 16, 1, 22, 'obs-A-substitution', 0, 'notre', 12, 11),
  ('1576280', 17, 1, 22, 'obs-A-substitution', 0, 'notre', 13, 8),
  ('1576280', 18, 1, 22, 'obs-A-substitution', 0, 'notre', 15, 22),
  ('1576280', 19, 1, 25, 'obs-A-essai', 5, 'notre', 20, NULL),
  ('1576280', 20, 1, 26, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1576280', 21, 1, 26, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1576280', 22, 1, 28, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1576280', 23, 1, 28, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1576280', 24, 1, 30, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1576280', 25, 1, 30, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1576280', 26, 1, 33, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1576280', 27, 1, 33, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1576280', 28, 1, 35, 'obs-A-essai', 5, 'notre', 16, NULL),
  ('1576280', 29, 1, 35, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1576280', 30, 2, 35, 'obs-A-substitution', 0, 'notre', 16, 1),
  ('1576280', 31, 2, 35, 'obs-A-substitution', 0, 'notre', 17, 2),
  ('1576280', 32, 2, 35, 'obs-A-substitution', 0, 'notre', 18, 4),
  ('1576280', 33, 2, 35, 'obs-A-substitution', 0, 'notre', 6, 5),
  ('1576280', 34, 2, 35, 'obs-A-substitution', 0, 'notre', 19, 7),
  ('1576280', 35, 2, 35, 'obs-A-substitution', 0, 'notre', 20, 9),
  ('1576280', 36, 2, 35, 'obs-A-substitution', 0, 'notre', 21, 10),
  ('1576280', 37, 2, 35, 'obs-A-substitution', 0, 'notre', 11, 12),
  ('1576280', 38, 2, 35, 'obs-A-substitution', 0, 'notre', 18, 13),
  ('1576280', 39, 2, 35, 'obs-A-substitution', 0, 'notre', 22, 14),
  ('1576280', 40, 2, 36, 'obs-A-essai', 5, 'notre', 4, NULL),
  ('1576280', 41, 2, 36, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576280', 42, 2, 39, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1576280', 43, 2, 39, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576280', 44, 2, 40, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576280', 45, 2, 40, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576280', 46, 2, 41, 'obs-A-substitution', 0, 'notre', 10, 15),
  ('1576280', 47, 2, 43, 'obs-A-essai', 5, 'notre', 5, NULL),
  ('1576280', 48, 2, 43, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576280', 49, 2, 43, 'obs-A-substitution', 0, 'notre', 5, 3),
  ('1576280', 50, 2, 46, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576280', 51, 2, 46, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576280', 52, 2, 47, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1576280', 53, 2, 47, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576280', 54, 2, 51, 'obs-A-penalite', 3, 'adverse', NULL, NULL),
  ('1576280', 55, 2, 51, 'obs-A-substitution', 0, 'notre', 1, 17),
  ('1576280', 56, 2, 51, 'obs-A-substitution', 0, 'notre', 2, 16),
  ('1576280', 57, 2, 51, 'obs-A-substitution', 0, 'notre', 3, 18),
  ('1576280', 58, 2, 51, 'obs-A-substitution', 0, 'notre', 7, 6),
  ('1576280', 59, 2, 51, 'obs-A-substitution', 0, 'notre', 9, 20),
  ('1576280', 60, 2, 51, 'obs-A-substitution', 0, 'notre', 15, 22),
  ('1576280', 61, 2, 51, 'obs-A-substitution', 0, 'notre', 12, 8),
  ('1576280', 62, 2, 51, 'obs-A-substitution', 0, 'notre', 13, 11),
  ('1576280', 63, 2, 54, 'obs-A-essai', 5, 'notre', 16, NULL),
  ('1576280', 64, 2, 54, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1576280', 65, 2, 55, 'obs-A-substitution', 0, 'notre', 7, 19),
  ('1576280', 66, 2, 55, 'obs-A-substitution', 0, 'notre', 4, 21),
  ('1576280', 67, 2, 56, 'obs-A-essai', 5, 'notre', 20, NULL),
  ('1576280', 68, 2, 56, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1576280', 69, 2, 59, 'obs-A-jaune', 0, 'notre', 22, NULL),
  ('1576283', 1, 1, 2, 'obs-A-essai', 5, 'notre', 14, NULL),
  ('1576283', 2, 1, 2, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576283', 3, 1, 4, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576283', 4, 1, 4, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1576283', 5, 1, 8, 'obs-A-essai', 5, 'notre', 1, NULL),
  ('1576283', 6, 1, 8, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576283', 7, 1, 14, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576283', 8, 1, 17, 'obs-A-essai', 5, 'notre', 15, NULL),
  ('1576283', 9, 1, 17, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576283', 10, 1, 26, 'obs-A-penalite', 3, 'adverse', NULL, NULL),
  ('1576283', 11, 1, 26, 'obs-A-substitution', 0, 'notre', 2, 17),
  ('1576283', 12, 1, 32, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576283', 13, 1, 36, 'obs-A-essai', 5, 'notre', 14, NULL),
  ('1576283', 14, 1, 36, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576283', 15, 2, 40, 'obs-A-substitution', 0, 'notre', 10, 21),
  ('1576283', 16, 2, 41, 'obs-A-essai', 5, 'notre', 8, NULL),
  ('1576283', 17, 2, 45, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576283', 18, 2, 45, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1576283', 19, 2, 47, 'obs-A-essai', 5, 'notre', 9, NULL),
  ('1576283', 20, 2, 47, 'obs-A-transfo', 2, 'notre', 9, NULL),
  ('1576283', 21, 2, 49, 'obs-A-substitution', 0, 'notre', 9, 20),
  ('1576283', 22, 2, 49, 'obs-A-substitution', 0, 'notre', 4, 22),
  ('1576283', 23, 2, 49, 'obs-A-substitution', 0, 'notre', 5, 19),
  ('1576283', 24, 2, 49, 'obs-A-substitution', 0, 'notre', 3, 18),
  ('1576283', 25, 2, 53, 'obs-A-essai', 5, 'notre', 15, NULL),
  ('1576283', 26, 2, 53, 'obs-A-transfo', 2, 'notre', 21, NULL),
  ('1576283', 27, 2, 53, 'obs-A-substitution', 0, 'notre', 1, 16),
  ('1576283', 28, 2, 57, 'obs-A-substitution', 0, 'notre', 17, 2),
  ('1576283', 29, 2, 58, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576283', 30, 2, 58, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1576283', 31, 2, 61, 'obs-A-essai', 5, 'notre', 18, NULL),
  ('1576283', 32, 2, 61, 'obs-A-transfo', 2, 'notre', 21, NULL),
  ('1576283', 33, 2, 69, 'obs-A-blanc', 0, 'notre', 15, NULL),
  ('1576283', 34, 2, 72, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576283', 35, 2, 73, 'obs-A-substitution', 0, 'notre', 11, 10),
  ('1576283', 36, 2, 75, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1576283', 37, 2, 77, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1576283', 38, 2, 77, 'obs-A-transfo', 2, 'notre', 21, NULL),
  ('1576283', 39, 2, 79, 'obs-A-essai', 5, 'notre', 14, NULL),
  ('1576283', 40, 2, 79, 'obs-A-transfo', 2, 'notre', 21, NULL),
  ('1576286', 1, 1, 4, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576286', 2, 1, 4, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1576286', 3, 1, 11, 'obs-A-penalite', 3, 'notre', 11, NULL),
  ('1576286', 4, 1, 14, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576286', 5, 1, 14, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1576286', 6, 1, 21, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576286', 7, 1, 21, 'obs-A-transfo', 2, 'notre', 11, NULL),
  ('1576286', 8, 1, 29, 'obs-A-substitution', 0, 'notre', 1, 17),
  ('1576286', 9, 1, 29, 'obs-A-substitution', 0, 'notre', 3, 18),
  ('1576286', 10, 1, 30, 'obs-A-substitution', 0, 'notre', 6, 19),
  ('1576286', 11, 1, 35, 'obs-A-penalite', 3, 'notre', 11, NULL),
  ('1576286', 12, 1, 36, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576286', 13, 1, 36, 'obs-A-transfo', 2, 'notre', 11, NULL),
  ('1576286', 14, 2, 40, 'obs-A-substitution', 0, 'notre', 4, 6),
  ('1576286', 15, 2, 42, 'obs-A-substitution', 0, 'notre', 12, 21),
  ('1576286', 16, 2, 42, 'obs-A-substitution', 0, 'notre', 9, 20),
  ('1576286', 17, 2, 42, 'obs-A-substitution', 0, 'notre', 2, 17),
  ('1576286', 18, 2, 43, 'obs-A-substitution', 0, 'notre', 5, 22),
  ('1576286', 19, 2, 47, 'obs-A-penalite', 3, 'adverse', NULL, NULL),
  ('1576286', 20, 2, 48, 'obs-A-jaune', 0, 'notre', 7, NULL),
  ('1576286', 21, 2, 53, 'obs-A-penalite', 3, 'notre', 11, NULL),
  ('1576286', 22, 2, 53, 'obs-A-substitution', 0, 'notre', 18, 1),
  ('1576286', 23, 2, 67, 'obs-A-substitution', 0, 'notre', 16, 2),
  ('1576286', 24, 2, 74, 'obs-A-substitution', 0, 'notre', 19, 5),
  ('1576286', 25, 2, 74, 'obs-A-substitution', 0, 'notre', 17, 3),
  ('1576289', 1, 1, 2, 'obs-A-penalite', 3, 'notre', 15, NULL),
  ('1576289', 2, 1, 7, 'obs-A-essai', 5, 'notre', 9, NULL),
  ('1576289', 3, 1, 7, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576289', 4, 1, 19, 'obs-A-jaune', 0, 'notre', 5, NULL),
  ('1576289', 5, 1, 25, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576289', 6, 1, 25, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1576289', 7, 1, 38, 'obs-A-substitution', 0, 'notre', 8, 22),
  ('1576289', 8, 1, 40, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576289', 9, 1, 40, 'obs-A-substitution', 0, 'notre', 1, 16),
  ('1576289', 10, 1, 40, 'obs-A-substitution', 0, 'notre', 2, 18),
  ('1576289', 11, 1, 40, 'obs-A-substitution', 0, 'notre', 3, 23),
  ('1576289', 12, 1, 40, 'obs-A-substitution', 0, 'notre', 14, 21),
  ('1576289', 13, 2, 41, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1576289', 14, 2, 44, 'obs-A-substitution', 0, 'notre', 9, 20),
  ('1576289', 15, 2, 44, 'obs-A-essai', 5, 'notre', 20, NULL),
  ('1576289', 16, 2, 44, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576289', 17, 2, 48, 'obs-A-substitution', 0, 'notre', 5, 19),
  ('1576289', 18, 2, 59, 'obs-A-essai', 5, 'notre', 23, NULL),
  ('1576289', 19, 2, 59, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576289', 20, 2, 65, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1576289', 21, 2, 65, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576289', 22, 2, 68, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576289', 23, 2, 74, 'obs-A-jaune', 0, 'notre', 12, NULL),
  ('1576289', 24, 2, 76, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576294', 1, 1, 5, 'obs-A-penalite', 3, 'adverse', NULL, NULL),
  ('1576294', 2, 1, 6, 'obs-A-essai', 5, 'notre', 5, NULL),
  ('1576294', 3, 1, 6, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 4, 1, 10, 'obs-A-essai', 5, 'notre', NULL, NULL),
  ('1576294', 5, 1, 10, 'obs-A-transfo', 2, 'notre', NULL, NULL),
  ('1576294', 6, 1, 11, 'obs-A-essai', 5, 'notre', 7, NULL),
  ('1576294', 7, 1, 11, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 8, 1, 16, 'obs-A-essai', 5, 'notre', 15, NULL),
  ('1576294', 9, 1, 16, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 10, 1, 20, 'obs-A-essai', 5, 'notre', 2, NULL),
  ('1576294', 11, 1, 20, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 12, 1, 22, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576294', 13, 1, 22, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 14, 1, 24, 'obs-A-essai', 5, 'notre', 9, NULL),
  ('1576294', 15, 1, 24, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 16, 1, 31, 'obs-A-blanc', 0, 'notre', 6, NULL),
  ('1576294', 17, 1, 33, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1576294', 18, 1, 33, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 19, 1, 36, 'obs-A-substitution', 0, 'notre', 9, 20),
  ('1576294', 20, 1, 37, 'obs-A-essai', 5, 'notre', 5, NULL),
  ('1576294', 21, 1, 37, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 22, 2, 40, 'obs-A-substitution', 0, 'notre', 1, 16),
  ('1576294', 23, 2, 40, 'obs-A-substitution', 0, 'notre', 2, 17),
  ('1576294', 24, 2, 40, 'obs-A-substitution', 0, 'notre', 23, 18),
  ('1576294', 25, 2, 40, 'obs-A-substitution', 0, 'notre', 12, 21),
  ('1576294', 26, 2, 44, 'obs-A-substitution', 0, 'notre', 17, 1),
  ('1576294', 27, 2, 44, 'obs-A-substitution', 0, 'notre', 7, 19),
  ('1576294', 28, 2, 48, 'obs-A-substitution', 0, 'notre', 1, 17),
  ('1576294', 29, 2, 51, 'obs-A-substitution', 0, 'notre', 12, 11),
  ('1576294', 30, 2, 51, 'obs-A-substitution', 0, 'notre', 5, 22),
  ('1576294', 31, 2, 51, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576294', 32, 2, 53, 'obs-A-essai', 5, 'notre', 6, NULL),
  ('1576294', 33, 2, 53, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 34, 2, 57, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576294', 35, 2, 57, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 36, 2, 58, 'obs-A-substitution', 0, 'notre', 4, 2),
  ('1576294', 37, 2, 61, 'obs-A-essai', 5, 'notre', 21, NULL),
  ('1576294', 38, 2, 61, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 39, 2, 61, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1576294', 40, 2, 61, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 41, 2, 64, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576294', 42, 2, 64, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 43, 2, 67, 'obs-A-substitution', 0, 'notre', 13, 1),
  ('1576294', 44, 2, 67, 'obs-A-essai', 5, 'notre', 8, NULL),
  ('1576294', 45, 2, 67, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 46, 2, 69, 'obs-A-essai', 5, 'notre', 1, NULL),
  ('1576294', 47, 2, 69, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1576294', 48, 2, 71, 'obs-A-substitution', 0, 'notre', 17, 23),
  ('1576294', 49, 2, 72, 'obs-A-essai', 5, 'notre', 14, NULL),
  ('1576294', 50, 2, 74, 'obs-A-essai', 5, 'notre', 6, NULL),
  ('1576298', 1, 1, 8, 'obs-A-penalite', 3, 'adverse', NULL, NULL),
  ('1576298', 2, 1, 11, 'obs-A-blanc', 0, 'notre', 4, NULL),
  ('1576298', 3, 1, 13, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576298', 4, 1, 13, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1576298', 5, 1, 15, 'obs-A-penalite', 3, 'notre', 11, NULL),
  ('1576298', 6, 1, 19, 'obs-A-essai', 5, 'notre', 15, NULL),
  ('1576298', 7, 1, 26, 'obs-A-essai', 5, 'notre', 23, NULL),
  ('1576298', 8, 1, 26, 'obs-A-transfo', 2, 'notre', 11, NULL),
  ('1576298', 9, 1, 32, 'obs-A-penalite', 3, 'adverse', NULL, NULL),
  ('1576298', 10, 2, 40, 'obs-A-substitution', 0, 'notre', 4, 19),
  ('1576298', 11, 2, 40, 'obs-A-substitution', 0, 'notre', 1, 17),
  ('1576298', 12, 2, 40, 'obs-A-substitution', 0, 'notre', 2, 16),
  ('1576298', 13, 2, 40, 'obs-A-substitution', 0, 'notre', 23, 18),
  ('1576298', 14, 2, 40, 'obs-A-substitution', 0, 'notre', 13, 20),
  ('1576298', 15, 2, 40, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1576298', 16, 2, 40, 'obs-A-transfo', 2, 'notre', 11, NULL),
  ('1576298', 17, 2, 45, 'obs-A-penalite', 3, 'notre', 11, NULL),
  ('1576298', 18, 2, 45, 'obs-A-substitution', 0, 'notre', 10, 13),
  ('1576298', 19, 2, 49, 'obs-A-substitution', 0, 'notre', 11, 10),
  ('1576298', 20, 2, 49, 'obs-A-substitution', 0, 'notre', 5, 22),
  ('1576298', 21, 2, 52, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576298', 22, 2, 61, 'obs-A-essai', 5, 'notre', 14, NULL),
  ('1576298', 23, 2, 63, 'obs-A-jaune', 0, 'notre', 12, NULL),
  ('1576298', 24, 2, 66, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1576298', 25, 2, 69, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1576298', 26, 2, 73, 'obs-A-substitution', 0, 'notre', 9, 21),
  ('1615856', 1, 1, 10, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615856', 2, 1, 11, 'obs-A-substitution', 0, 'notre', 23, 3),
  ('1615856', 3, 1, 14, 'obs-A-substitution', 0, 'notre', 9, 20),
  ('1615856', 4, 1, 16, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1615856', 5, 1, 19, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615856', 6, 1, 20, 'obs-A-substitution', 0, 'notre', 6, 19),
  ('1615856', 7, 1, 22, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1615856', 8, 1, 26, 'obs-A-substitution', 0, 'notre', 1, 17),
  ('1615856', 9, 1, 27, 'obs-A-substitution', 0, 'notre', 14, 21),
  ('1615856', 10, 1, 28, 'obs-A-essai', 5, 'notre', 17, NULL),
  ('1615856', 11, 1, 38, 'obs-A-essai', 5, 'notre', 8, NULL),
  ('1615856', 12, 2, 40, 'obs-A-substitution', 0, 'notre', 2, 16),
  ('1615856', 13, 2, 40, 'obs-A-substitution', 0, 'notre', 5, 1),
  ('1615856', 14, 2, 40, 'obs-A-substitution', 0, 'notre', 8, 6),
  ('1615856', 15, 2, 40, 'obs-A-substitution', 0, 'notre', 15, 9),
  ('1615856', 16, 2, 45, 'obs-A-substitution', 0, 'notre', 17, 18),
  ('1615856', 17, 2, 50, 'obs-A-essai', 5, 'notre', 7, NULL),
  ('1615856', 18, 2, 50, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1615856', 19, 2, 52, 'obs-A-substitution', 0, 'notre', 6, 8),
  ('1615856', 20, 2, 55, 'obs-A-substitution', 0, 'notre', 1, 17),
  ('1615856', 21, 2, 56, 'obs-A-blanc', 0, 'notre', 16, NULL),
  ('1615856', 22, 2, 56, 'obs-A-substitution', 0, 'notre', 3, 5),
  ('1615856', 23, 2, 56, 'obs-A-jaune', 0, 'notre', 12, NULL),
  ('1615856', 24, 2, 63, 'obs-A-substitution', 0, 'notre', 16, 2),
  ('1615856', 25, 2, 64, 'obs-A-substitution', 0, 'notre', 13, 14),
  ('1615856', 26, 2, 69, 'obs-A-substitution', 0, 'notre', 4, 3),
  ('1615856', 27, 2, 69, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1615856', 28, 2, 69, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1615856', 29, 2, 71, 'obs-A-essai', 5, 'notre', 20, NULL),
  ('1615856', 30, 2, 71, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1615856', 31, 2, 72, 'obs-A-substitution', 0, 'notre', 19, 23),
  ('1615856', 32, 2, 76, 'obs-A-essai', 5, 'notre', 7, NULL),
  ('1615856', 33, 2, 76, 'obs-A-transfo', 2, 'notre', 20, NULL),
  ('1615868', 1, 1, 2, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615868', 2, 1, 10, 'obs-A-substitution', 0, 'notre', 7, 6),
  ('1615868', 3, 1, 14, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615868', 4, 1, 14, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1615868', 5, 1, 18, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1615868', 6, 1, 18, 'obs-A-transfo', 2, 'notre', 12, NULL),
  ('1615868', 7, 1, 19, 'obs-A-substitution', 0, 'notre', 1, 23),
  ('1615868', 8, 1, 19, 'obs-A-substitution', 0, 'notre', 3, 4),
  ('1615868', 9, 1, 20, 'obs-A-essai', 5, 'notre', 15, NULL),
  ('1615868', 10, 1, 20, 'obs-A-transfo', 2, 'notre', 12, NULL),
  ('1615868', 11, 1, 23, 'obs-A-essai', 5, 'notre', 9, NULL),
  ('1615868', 12, 1, 23, 'obs-A-transfo', 2, 'notre', 12, NULL),
  ('1615868', 13, 1, 28, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615868', 14, 1, 28, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1615868', 15, 1, 31, 'obs-A-essai', 5, 'notre', 6, NULL),
  ('1615868', 16, 2, 35, 'obs-A-substitution', 0, 'notre', 5, 7),
  ('1615868', 17, 2, 35, 'obs-A-substitution', 0, 'notre', 11, 14),
  ('1615868', 18, 2, 36, 'obs-A-substitution', 0, 'notre', 7, 5),
  ('1615868', 19, 2, 39, 'obs-A-essai', 5, 'notre', 2, NULL),
  ('1615868', 20, 2, 42, 'obs-A-substitution', 0, 'notre', 23, 1),
  ('1615868', 21, 2, 46, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1615868', 22, 2, 46, 'obs-A-transfo', 2, 'notre', 12, NULL),
  ('1615868', 23, 2, 51, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615868', 24, 2, 51, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1615868', 25, 2, 57, 'obs-A-substitution', 0, 'notre', 4, 3),
  ('1615868', 26, 2, 64, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615868', 27, 2, 64, 'obs-A-transfo', 2, 'adverse', NULL, NULL),
  ('1615875', 1, 1, 6, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1615875', 2, 1, 8, 'obs-A-essai', 5, 'notre', 14, NULL),
  ('1615875', 3, 1, 14, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1615875', 4, 1, 21, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1615875', 5, 1, 21, 'obs-A-transfo', 2, 'notre', 14, NULL),
  ('1615875', 6, 1, 23, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1615875', 7, 1, 23, 'obs-A-transfo', 2, 'notre', 14, NULL),
  ('1615875', 8, 1, 30, 'obs-A-essai', 5, 'notre', 14, NULL),
  ('1615875', 9, 1, 33, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1615875', 10, 1, 35, 'obs-A-essai', 5, 'notre', 10, NULL),
  ('1615875', 11, 1, 35, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1615875', 12, 1, 39, 'obs-A-essai', 5, 'notre', 2, NULL),
  ('1615875', 13, 1, 39, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1615875', 14, 1, 40, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1615875', 15, 2, 40, 'obs-A-substitution', 0, 'notre', 6, 21),
  ('1615875', 16, 2, 40, 'obs-A-substitution', 0, 'notre', 11, 20),
  ('1615875', 17, 2, 43, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1615875', 18, 2, 43, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1615875', 19, 2, 45, 'obs-A-essai', 5, 'notre', 13, NULL),
  ('1615875', 20, 2, 48, 'obs-A-essai', 5, 'notre', 4, NULL),
  ('1615875', 21, 2, 48, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1615875', 22, 2, 61, 'obs-A-essai', 5, 'notre', 7, NULL),
  ('1615875', 23, 2, 63, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1615875', 24, 2, 63, 'obs-A-transfo', 2, 'notre', 15, NULL),
  ('1615875', 25, 2, 63, 'obs-A-substitution', 0, 'notre', 13, 11),
  ('1615875', 26, 2, 71, 'obs-A-blanc', 0, 'notre', 1, NULL),
  ('1615875', 27, 2, 77, 'obs-A-essai', 5, 'notre', 11, NULL),
  ('1615875', 28, 2, 77, 'obs-A-transfo', 2, 'notre', 14, NULL),
  ('1615875', 29, 2, 79, 'obs-A-essai', 5, 'notre', 12, NULL),
  ('1615875', 30, 2, 79, 'obs-A-transfo', 2, 'notre', 14, NULL),
  ('1620280', 1, 1, 0, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1620280', 2, 1, 22, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1620280', 3, 1, 28, 'obs-A-substitution', 0, 'notre', 10, 16),
  ('1620280', 4, 1, 34, 'obs-A-substitution', 0, 'notre', 3, 17),
  ('1620280', 5, 1, 35, 'obs-A-substitution', 0, 'notre', 16, 10),
  ('1620280', 6, 1, 40, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1620280', 7, 1, 40, 'obs-A-substitution', 0, 'notre', 8, 22),
  ('1620280', 8, 2, 41, 'obs-A-substitution', 0, 'notre', 15, 18),
  ('1620280', 9, 2, 53, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1620280', 10, 2, 54, 'obs-A-substitution', 0, 'notre', 9, 16),
  ('1620280', 11, 2, 54, 'obs-A-substitution', 0, 'notre', 10, 20),
  ('1620280', 12, 2, 61, 'obs-A-substitution', 0, 'notre', 11, 19),
  ('1620280', 13, 2, 63, 'obs-A-substitution', 0, 'notre', 22, 3),
  ('1620280', 14, 2, 66, 'obs-A-substitution', 0, 'notre', 18, 21),
  ('1620280', 15, 2, 67, 'obs-A-substitution', 0, 'notre', 17, 8),
  ('1620280', 16, 2, 69, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1620280', 17, 2, 76, 'obs-A-essai', 5, 'adverse', NULL, NULL),
  ('1620280', 18, 2, 77, 'obs-A-substitution', 0, 'notre', 2, 17);

-- ---------------------------------------------------------------------
-- Arbitrages manuels de rapprochement (FFR → personnes), D3-A.
-- Ligne (ffr, num, joueur_id) ; vide = aucun arbitrage.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _ovr (ffr TEXT, num INT, joueur_id UUID) ON COMMIT DROP;
-- Arbitrage de Manu (21/11/2026) : « A. HAYET » de la feuille FFR = Aline MUNSCH (Seniors F).
INSERT INTO _ovr VALUES ('1620280', 10, '01d37f64-4df0-47ff-901d-00b5a6aed9fa');

-- ---------------------------------------------------------------------
-- 1. Rapprochement des joueurs (D3-A) : nom exact (sans accents) +
--    prénom (ou initiale) ; unique dans la catégorie, sinon unique
--    dans tout le Hub ; sinon NON rapproché (jamais deviné).
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _j ON COMMIT DROP AS
WITH n AS (
    SELECT p.id, c.code AS cat,
           translate(upper(p.nom), 'ÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ-', 'EEEEAAAIIOOUUUC ') AS nn,
           translate(upper(p.prenom), 'ÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ-', 'EEEEAAAIIOOUUUC ') AS pn
      FROM public.personnes AS p
      LEFT JOIN public.categories AS c ON c.id = p.categorie_id
     WHERE NOT p.est_archive
), cand AS (
    SELECT r.ffr, r.num, n.id, (n.cat = m.cat) AS meme_cat
      FROM _r AS r
      JOIN _m AS m ON m.ffr = r.ffr
      JOIN n ON n.nn = r.nom
       AND ((r.prenom <> '' AND (n.pn = r.prenom OR n.pn LIKE r.prenom || ' %' OR r.prenom LIKE n.pn || ' %'))
         OR (r.prenom = '' AND left(n.pn, 1) = r.ini))
)
SELECT r.ffr, r.num,
       coalesce(
         (SELECT o.joueur_id FROM _ovr AS o WHERE o.ffr = r.ffr AND o.num = r.num),
         CASE WHEN (SELECT count(*) FROM cand WHERE cand.ffr = r.ffr AND cand.num = r.num AND cand.meme_cat) = 1
              THEN (SELECT cand.id FROM cand WHERE cand.ffr = r.ffr AND cand.num = r.num AND cand.meme_cat)
              WHEN (SELECT count(*) FROM cand WHERE cand.ffr = r.ffr AND cand.num = r.num) = 1
              THEN (SELECT cand.id FROM cand WHERE cand.ffr = r.ffr AND cand.num = r.num)
         END) AS joueur_id
  FROM _r AS r;

-- ---------------------------------------------------------------------
-- 2. Compositions de match reconstituées (D2-A, D7-A)
-- ---------------------------------------------------------------------
INSERT INTO public.compositions (evenement_id, cote, etat, version, est_active, type_compo, notes_compo)
SELECT m.evt, 'mom', 'validee', 1, TRUE, 'match',
       'Reconstituée depuis la feuille de match FFR (Mon Club House) — IMPORT-FFR-RATTRAPAGE L2, sql_284, 21/11/2026'
  FROM _m AS m;

INSERT INTO public.composition_joueurs
       (composition_id, joueur_id, poste_id, numero_maillot, role, ordre_remplacement, est_capitaine)
SELECT co.id, j.joueur_id, po.id::TEXT, r.num,
       CASE WHEN r.tit THEN 'titulaire' ELSE 'remplacant' END,
       r.ordre, r.cap
  FROM _r AS r
  JOIN _m AS m ON m.ffr = r.ffr
  JOIN _j AS j ON j.ffr = r.ffr AND j.num = r.num
  JOIN public.compositions AS co ON co.evenement_id = m.evt AND co.notes_compo LIKE '%sql_284%'
  JOIN public.postes AS po ON po.code = r.poste_code
 WHERE j.joueur_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Faits de match FFR → chronologie_suivi (source 'ffr', D5-A SUIVI-VEO)
--    Remplacement : joueur_uuid = sortant, joueur_uuid_entrant = entrant.
-- ---------------------------------------------------------------------
INSERT INTO public.chronologie_suivi
       (evenement_uuid, horodatage, minute_match, periode, observable_id, categorie_obs, valeur_points,
        mode_saisie, equipe_concernee, joueur_uuid, saisi_par, saisi_par_role, source_saisie, joueur_uuid_entrant)
SELECT m.evt, now() + e.seq * INTERVAL '1 millisecond', e.mn, e.per, e.obs, 'A', e.pts,
       'normal', e.side,
       CASE WHEN e.side = 'notre' THEN j1.joueur_id END,
       'import:ffr-rattrapage-l2', 'coach', 'ffr',
       CASE WHEN e.side = 'notre' THEN j2.joueur_id END
  FROM _e AS e
  JOIN _m AS m ON m.ffr = e.ffr
  LEFT JOIN _j AS j1 ON j1.ffr = e.ffr AND j1.num = e.n1
  LEFT JOIN _j AS j2 ON j2.ffr = e.ffr AND j2.num = e.n2;

-- ---------------------------------------------------------------------
-- 4. Durées du match réserve contre Mulhouse (31/10) : 2 × 35 min,
--    lues sur la feuille FFR (2e période commencée à la 35e minute).
-- ---------------------------------------------------------------------
INSERT INTO public.suivi_chrono (evenement_uuid, durees_periodes)
VALUES ('fbbc89cb-178e-43be-b526-ba0c8a899cc2', ARRAY[35, 35])
ON CONFLICT (evenement_uuid) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. D6-A (Manu, 21/11/2026 : le suivi est toujours gardé quand un match
--    MEI s'est joué) : M16 R2 J1 Vosges, score officiel 86-12.
-- ---------------------------------------------------------------------
UPDATE public.evenements
   SET score_mom = 86, score_adverse = 12,
       notes_resultat = '[SCORE ADMINISTRATIF] Score officiel FFR 86-12 (actions de la feuille FFR : 86-14)'
 WHERE id = '66fee627-8f11-4f3d-abf4-f3a0940c104c';

-- ---------------------------------------------------------------------
-- 6. Re-consolidation du score depuis le suivi (règle I1 rétablie)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _cons ON COMMIT DROP AS
SELECT m.ffr, m.lib, m.exp_mom, m.exp_adv, s.score_mom, s.score_adverse
  FROM _m AS m
  CROSS JOIN LATERAL public.consolider_score_rencontre(m.evt) AS s;

-- ---------------------------------------------------------------------
-- 7. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_n INTEGER;
    v_t TEXT;
BEGIN
    SELECT string_agg(lib || ' : ' || score_mom || '-' || score_adverse || ' au lieu de ' || exp_mom || '-' || exp_adv, ' ; ')
      INTO v_t FROM _cons WHERE score_mom <> exp_mom OR score_adverse <> exp_adv;
    IF v_t IS NOT NULL THEN RAISE EXCEPTION 'VERIF score : %', v_t; END IF;

    SELECT count(*) INTO v_n FROM public.compositions WHERE notes_compo LIKE '%sql_284%';
    IF v_n <> (SELECT count(*) FROM _m) THEN RAISE EXCEPTION 'VERIF : % compo(s) au lieu de %', v_n, (SELECT count(*) FROM _m); END IF;

    SELECT count(*) INTO v_n FROM public.composition_joueurs AS cj
      JOIN public.compositions AS co ON co.id = cj.composition_id WHERE co.notes_compo LIKE '%sql_284%';
    IF v_n <> (SELECT count(*) FROM _j WHERE joueur_id IS NOT NULL) THEN
        RAISE EXCEPTION 'VERIF : % joueurs en compo au lieu de %', v_n, (SELECT count(*) FROM _j WHERE joueur_id IS NOT NULL);
    END IF;

    SELECT count(*) INTO v_n FROM public.chronologie_suivi WHERE saisi_par = 'import:ffr-rattrapage-l2';
    IF v_n <> (SELECT count(*) FROM _e) THEN RAISE EXCEPTION 'VERIF : % lignes de suivi au lieu de %', v_n, (SELECT count(*) FROM _e); END IF;

    SELECT count(*) INTO v_n FROM public.evenements
     WHERE id = '66fee627-8f11-4f3d-abf4-f3a0940c104c' AND score_mom = 86 AND score_adverse = 12
       AND notes_resultat LIKE '[SCORE ADMINISTRATIF]%';
    IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF : score administratif Vosges absent'; END IF;
END $verif$;

COMMIT;
