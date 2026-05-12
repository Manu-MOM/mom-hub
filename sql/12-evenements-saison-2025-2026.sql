-- =====================================================================
-- MOM HUB · PEUPLEMENT INITIAL · ÉVÉNEMENTS M14 · SAISON 2025-2026
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-13
-- Version : 1.0
--
-- Insère les 4 événements M14 de la saison 2025-2026 connus à ce jour,
-- importés depuis l'export JSON de l'app sarmom-compos
-- (https://manu-mom.github.io/sarmom-compos/) le 12 mai 2026.
--
-- Données réelles (pas du test) — fichier consigné dans le repo pour
-- traçabilité. Si re-import OVAL-E ou re-export sarmom-compos plus tard
-- met à jour ces données, ce fichier sert de référence.
--
-- =====================================================================
-- HORS PÉRIMÈTRE
-- =====================================================================
--   - Pas de création des matchs enfants (P1 simplicité). Les détails
--     des matchs joués sont consignés dans `notes_resultat`. Si besoin
--     d'analyses fines (essais par joueur, temps de jeu, etc.), on
--     créera plus tard une table dédiée (cf. modèle v1.1 §4.5).
--   - Pas d'insertion dans `evenement_encadrants` (Manu seul est
--     organisateur principal, suffisant à ce stade).
--   - Pas d'attache de joueurs aux événements (Phase 4.3 = compositions).
--
-- =====================================================================
-- 4 ÉVÉNEMENTS INSÉRÉS (référence)
-- =====================================================================
--   1. EVT-2026-05-02-FRANKFURT-M14 ............ tournoi PASSÉ (2-3 mai)
--      SCF 1880 Gonder Jugendfestival 2026 · Format À 13 · 5ème/10 (4V-2D)
--
--   2. EVT-2026-05-23-LES-GEMMEURS-M14 ......... tournoi À VENIR (23 mai)
--      Les Gemmeurs · Rion-des-Landes · Format À 15
--
--   3. EVT-2026-05-09-J5-ECLR-M14 .............. journee_championnat PASSÉ (9 mai)
--      Journée 5 (rattrapage 11/04) vs ECLR · Domicile Brencklé · 41-7
--
--   4. EVT-2026-06-07-CHALLENGE-VIE-M14 ........ tournoi À VENIR (7 juin)
--      Challenge Vié · Nancy · Format À 15 · Finale régionale
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : NON (pas de ON CONFLICT). Pour rejouer : DELETE préalable
-- sur les 4 codes ci-dessus.
-- =====================================================================

BEGIN;


-- =====================================================================
-- 1. EVT-2026-05-02-FRANKFURT-M14 (PASSÉ, archive)
-- =====================================================================

INSERT INTO evenements (
  code, libelle,
  type_evenement, type_competition,
  equipe_id, saison_id, format_de_jeu,
  date_debut, date_fin, site_id,
  organisateur_principal_id, etat,
  domicile_exterieur, classement_final, notes_resultat
) VALUES (
  'EVT-2026-05-02-FRANKFURT-M14',
  'SCF 1880 Gonder Jugendfestival 2026 (Frankfurt)',
  'tournoi', 'tournoi',
  (SELECT id FROM equipes  WHERE code='ENTENTE-M14-2025-2026'),
  (SELECT id FROM saisons  WHERE code='2025-2026'),
  '13',
  '2026-05-02 10:00:00+02',
  '2026-05-03 18:00:00+02',
  NULL,
  (SELECT id FROM personnes WHERE uuid_legacy='personne-parent-6b7a9b'),
  'archive',
  'exterieur',
  '5ème sur 10 équipes',
  '6 matchs joués sur 2 jours. Bilan : 4V-2D, 105 pts pour / 35 pts contre, 21 essais pour / 8 contre. Détail :
- V 15-5 vs Rugby Academy Roumanie (poule)
- D 5-20 vs Caerphilly RFC Pays de Galles (poule)
- D 5-10 vs London Welsh Red Angleterre (poule)
- V 30-0 vs SC Frankfurt 1880 Red (poule)
- V 25-0 vs Boitsfort RC Belgique (phase finale)
- V 25-0 vs CRIG France (phase finale)
Format À 13. 2 blessures sur le tournoi.'
);


-- =====================================================================
-- 2. EVT-2026-05-23-LES-GEMMEURS-M14 (À VENIR, creation)
-- =====================================================================

INSERT INTO evenements (
  code, libelle,
  type_evenement, type_competition,
  equipe_id, saison_id, format_de_jeu,
  date_debut, site_id,
  organisateur_principal_id, etat,
  domicile_exterieur, notes_internes
) VALUES (
  'EVT-2026-05-23-LES-GEMMEURS-M14',
  'Les Gemmeurs (Rion-des-Landes)',
  'tournoi', 'tournoi',
  (SELECT id FROM equipes  WHERE code='ENTENTE-M14-2025-2026'),
  (SELECT id FROM saisons  WHERE code='2025-2026'),
  'XV',
  '2026-05-23 10:00:00+02',
  NULL,
  (SELECT id FROM personnes WHERE uuid_legacy='personne-parent-6b7a9b'),
  'creation',
  'exterieur',
  '2 phases prévues : Poule de brassage + Poule de classement. Format À 15.'
);


-- =====================================================================
-- 3. EVT-2026-05-09-J5-ECLR-M14 (PASSÉ, archive)
-- =====================================================================

INSERT INTO evenements (
  code, libelle,
  type_evenement, type_competition,
  equipe_id, saison_id, format_de_jeu,
  date_debut, site_id,
  organisateur_principal_id, etat,
  adversaire_nom, domicile_exterieur,
  score_mom, score_adverse, notes_resultat
) VALUES (
  'EVT-2026-05-09-J5-ECLR-M14',
  'Journée 5 — MOM vs ECLR (rattrapage du 11/04)',
  'journee_championnat', 'championnat',
  (SELECT id FROM equipes  WHERE code='ENTENTE-M14-2025-2026'),
  (SELECT id FROM saisons  WHERE code='2025-2026'),
  'XV',
  '2026-05-09 14:00:00+02',
  (SELECT id FROM sites    WHERE code='site-mom-brenckle'),
  (SELECT id FROM personnes WHERE uuid_legacy='personne-parent-6b7a9b'),
  'archive',
  'ECLR', 'domicile',
  41, 7,
  'Victoire 41-7. Mi-temps 1 : 22-0 (essais : SCHIMPF Alphonse, BIRIKORANG Benjamin, SCHIMPF Alphonse, ROLL Samuel ; transformation : DUCHATELLE Arthur). Mi-temps 2 : 19-7 (essais : SCHIMPF Alphonse, SOW Baila, FLORENTIN Alphonse ; transformations : DUCHATELLE Arthur x2 ; essai + transfo adverses). Format À 15.'
);


-- =====================================================================
-- 4. EVT-2026-06-07-CHALLENGE-VIE-M14 (À VENIR, creation)
-- =====================================================================

INSERT INTO evenements (
  code, libelle,
  type_evenement, type_competition,
  equipe_id, saison_id, format_de_jeu,
  date_debut, site_id,
  organisateur_principal_id, etat,
  domicile_exterieur, notes_internes
) VALUES (
  'EVT-2026-06-07-CHALLENGE-VIE-M14',
  'Challenge Vié (Nancy)',
  'tournoi', 'tournoi',
  (SELECT id FROM equipes  WHERE code='ENTENTE-M14-2025-2026'),
  (SELECT id FROM saisons  WHERE code='2025-2026'),
  'XV',
  '2026-06-07 10:00:00+02',
  NULL,
  (SELECT id FROM personnes WHERE uuid_legacy='personne-parent-6b7a9b'),
  'creation',
  'exterieur',
  '2 phases prévues : Poules de brassage + Poules de classement. 2 équipes engagées (t1 + t2). Format À 15. Finale régionale du championnat (Challenge Vié).'
);


-- =====================================================================
-- Vérifications immédiates
-- =====================================================================

-- A) Compte : doit être 4
SELECT COUNT(*) AS nb_evenements_inseres FROM evenements
WHERE code IN (
  'EVT-2026-05-02-FRANKFURT-M14',
  'EVT-2026-05-23-LES-GEMMEURS-M14',
  'EVT-2026-05-09-J5-ECLR-M14',
  'EVT-2026-06-07-CHALLENGE-VIE-M14'
);

-- B) Liste résumée (ordre chronologique)
SELECT
  date_debut::DATE AS date,
  etat,
  type_evenement,
  format_de_jeu,
  COALESCE(adversaire_nom, '—') AS adversaire,
  domicile_exterieur,
  CASE 
    WHEN score_mom IS NOT NULL THEN score_mom || '-' || score_adverse
    ELSE '—'
  END AS score,
  libelle
FROM evenements
WHERE saison_id = (SELECT id FROM saisons WHERE code='2025-2026')
ORDER BY date_debut;

COMMIT;
