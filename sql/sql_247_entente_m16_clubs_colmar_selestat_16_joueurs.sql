-- =====================================================================
-- sql_247_entente_m16_clubs_colmar_selestat_16_joueurs.sql
-- ---------------------------------------------------------------------
-- Chantier : ENTENTE-M16-2026-2027 — integration vivier joueurs
--            (deviation assumee : chantier ouvert dans la conversation
--             identite visuelle du logo d'entente).
--
-- Besoin : l'entente M16 2026/2027 accueille 16 joueurs partenaires
--          issus de 3 clubs. Deux de ces clubs (Colmar, Selestat)
--          n'existaient pas encore dans la table `clubs`. Les creer,
--          puis inserer les 16 fiches joueurs au vivier M16.
--
-- Faits (verifies base, DS-1) :
--   - Gabarit joueur partenaire M16 : categorie_personne='joueur',
--     type_personne='licencie_externe_partenaire', section_rugby=false,
--     categorie_id = M16 (fa2bb289-cef0-4884-82e9-c50699a52a8f).
--   - CRIG existait deja (couleur_affiliation_distinctive='Noir').
--   - Couleur stockee en texte lisible ('Noir','Rouge',...), lue par
--     les RPC get_joueurs_* (cf. sql_248) puis traduite en hex cote front.
--
-- Rattachement club = personnes.club_principal_id -> clubs.
-- Tracable via source_creation='saisie_manuelle_entente_m16_2026-2027_v1'.
--
-- Idempotence : NON rejouable tel quel (INSERT secs). A n'appliquer
--   qu'une fois ; l'etat deploye fait deja foi (applique le 13/09/2026).
--   Fichier fourni comme MIROIR de l'etat base, pas pour re-execution.
-- =====================================================================

-- 1) Creation des 2 clubs manquants (Colmar, Selestat)
INSERT INTO clubs (code, nom_court, nom_long, ville, couleur_affiliation_distinctive, couleurs_officielles, club_central)
VALUES
  ('CRC',  'Colmar',   'Colmar Rugby Club',           'Colmar',   'Rouge', ARRAY['Rouge','Vert'], false),
  ('RCSG', 'Sélestat', 'Rugby Club Sélestat Giessen', 'Sélestat', 'Rouge', ARRAY['Rouge','Noir'], false);

-- 2) Insertion des 16 joueurs (7 CRIG, 7 Colmar, 2 Selestat)
WITH cible AS (
  SELECT
    'fa2bb289-cef0-4884-82e9-c50699a52a8f'::uuid AS m16_id,
    (SELECT id FROM clubs WHERE code='CRIG') AS crig_id,
    (SELECT id FROM clubs WHERE code='CRC')  AS crc_id,
    (SELECT id FROM clubs WHERE code='RCSG') AS rcsg_id
),
j(prenom, nom, club_code) AS (VALUES
  ('Télio','Klein','CRIG'),
  ('Julien','Weil','CRIG'),
  ('Nathan','Rondy','CRIG'),
  ('Thomas','De Vitry','CRIG'),
  ('Louis','Conus','CRIG'),
  ('Rodrigue','Marnay','CRIG'),
  ('Roméo','Rohe','CRIG'),
  ('Constantin','Billotte','CRC'),
  ('Martin','Steib','CRC'),
  ('Léon','Schreiber','CRC'),
  ('Thibault','Coué','CRC'),
  ('Evan','Cicekci','CRC'),
  ('Pierre','Dalloz','CRC'),
  ('Louis','Litière','CRC'),
  ('Edgar','Cambecedes','RCSG'),
  ('Baptiste','Von Breitenstein','RCSG')
)
INSERT INTO personnes
  (categorie_personne, type_personne, nom, prenom, categorie_id, club_principal_id,
   section_rugby, visible_annuaire, synchronisation_statut, source_creation)
SELECT
  'joueur', 'licencie_externe_partenaire', j.nom, j.prenom, cible.m16_id,
  CASE j.club_code WHEN 'CRIG' THEN cible.crig_id WHEN 'CRC' THEN cible.crc_id WHEN 'RCSG' THEN cible.rcsg_id END,
  false, false, 'a_jour', 'saisie_manuelle_entente_m16_2026-2027_v1'
FROM j CROSS JOIN cible;
