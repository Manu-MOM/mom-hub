-- =====================================================================
-- MOM HUB · PEUPLEMENT · ENTRAÎNEMENTS M14 · FIN DE SAISON 2025-2026
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-13 (créé le 12 mai soir tard pour data du lendemain et suite)
-- Version : 1.0
--
-- Insère les 15 entraînements M14 hebdomadaires entre le 13 mai 2026 et
-- le 1er juillet 2026 inclus (fin de saison régulière).
--
-- Calendrier hebdomadaire validé Manu (13 mai 2026) :
--   - LUNDI    18h00-19h15 à Brencklé
--   - MERCREDI 14h00-16h00 à Brencklé
--
-- Total : 7 lundis + 8 mercredis = 15 occurrences.
--   - 14 en état `creation` (à venir)
--   - 1 en état `annule` (lundi 25 mai 2026 = Pentecôte, férié national)
--
-- =====================================================================
-- HORS PÉRIMÈTRE
-- =====================================================================
--   - Pas de vacances scolaires zone B (Strasbourg) à éviter : période
--     13 mai → 1er juillet entièrement en période scolaire (vacances
--     d'été zone B = à partir du 4 juillet 2026).
--   - Pas d'attache des joueurs à ces entraînements (Phase 4.3).
--   - Pas d'encadrants multiples (Manu seul = organisateur principal).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : NON (pas de ON CONFLICT). Pour rejouer : DELETE préalable.
-- =====================================================================

BEGIN;

WITH refs AS (
  SELECT
    (SELECT id FROM equipes   WHERE code = 'ENTENTE-M14-2025-2026')              AS m14_id,
    (SELECT id FROM saisons   WHERE code = '2025-2026')                          AS saison_id,
    (SELECT id FROM sites     WHERE code = 'site-mom-brenckle')                  AS brenckle_id,
    (SELECT id FROM personnes WHERE uuid_legacy = 'personne-parent-6b7a9b')      AS manu_id
)
INSERT INTO evenements (
  code, libelle,
  type_evenement,
  equipe_id, saison_id,
  date_debut, date_fin, site_id,
  organisateur_principal_id, etat,
  notes_internes
)
SELECT
  v.code,
  v.libelle,
  'entrainement',
  r.m14_id,
  r.saison_id,
  v.date_debut::TIMESTAMPTZ,
  v.date_fin::TIMESTAMPTZ,
  r.brenckle_id,
  r.manu_id,
  v.etat,
  v.notes_internes
FROM refs r, (VALUES
  -- ============ MAI 2026 ============
  ('EVT-2026-05-13-ENTR-M14', 'Entraînement M14 du mercredi (13/05)', '2026-05-13 14:00:00+02', '2026-05-13 16:00:00+02', 'creation', NULL),
  ('EVT-2026-05-18-ENTR-M14', 'Entraînement M14 du lundi (18/05)',    '2026-05-18 18:00:00+02', '2026-05-18 19:15:00+02', 'creation', NULL),
  ('EVT-2026-05-20-ENTR-M14', 'Entraînement M14 du mercredi (20/05)', '2026-05-20 14:00:00+02', '2026-05-20 16:00:00+02', 'creation', NULL),
  ('EVT-2026-05-25-ENTR-M14', 'Entraînement M14 du lundi (25/05) [annulé]', '2026-05-25 18:00:00+02', '2026-05-25 19:15:00+02', 'annule',   'Lundi de Pentecôte (férié national) — entraînement annulé.'),
  ('EVT-2026-05-27-ENTR-M14', 'Entraînement M14 du mercredi (27/05)', '2026-05-27 14:00:00+02', '2026-05-27 16:00:00+02', 'creation', NULL),

  -- ============ JUIN 2026 ============
  ('EVT-2026-06-01-ENTR-M14', 'Entraînement M14 du lundi (01/06)',    '2026-06-01 18:00:00+02', '2026-06-01 19:15:00+02', 'creation', NULL),
  ('EVT-2026-06-03-ENTR-M14', 'Entraînement M14 du mercredi (03/06)', '2026-06-03 14:00:00+02', '2026-06-03 16:00:00+02', 'creation', NULL),
  ('EVT-2026-06-08-ENTR-M14', 'Entraînement M14 du lundi (08/06)',    '2026-06-08 18:00:00+02', '2026-06-08 19:15:00+02', 'creation', NULL),
  ('EVT-2026-06-10-ENTR-M14', 'Entraînement M14 du mercredi (10/06)', '2026-06-10 14:00:00+02', '2026-06-10 16:00:00+02', 'creation', NULL),
  ('EVT-2026-06-15-ENTR-M14', 'Entraînement M14 du lundi (15/06)',    '2026-06-15 18:00:00+02', '2026-06-15 19:15:00+02', 'creation', NULL),
  ('EVT-2026-06-17-ENTR-M14', 'Entraînement M14 du mercredi (17/06)', '2026-06-17 14:00:00+02', '2026-06-17 16:00:00+02', 'creation', NULL),
  ('EVT-2026-06-22-ENTR-M14', 'Entraînement M14 du lundi (22/06)',    '2026-06-22 18:00:00+02', '2026-06-22 19:15:00+02', 'creation', NULL),
  ('EVT-2026-06-24-ENTR-M14', 'Entraînement M14 du mercredi (24/06)', '2026-06-24 14:00:00+02', '2026-06-24 16:00:00+02', 'creation', NULL),
  ('EVT-2026-06-29-ENTR-M14', 'Entraînement M14 du lundi (29/06)',    '2026-06-29 18:00:00+02', '2026-06-29 19:15:00+02', 'creation', NULL),

  -- ============ JUILLET 2026 ============
  ('EVT-2026-07-01-ENTR-M14', 'Entraînement M14 du mercredi (01/07) — dernier de la saison', '2026-07-01 14:00:00+02', '2026-07-01 16:00:00+02', 'creation', 'Dernier entraînement de la saison régulière 2025-2026.')
) AS v(code, libelle, date_debut, date_fin, etat, notes_internes);


-- =====================================================================
-- Vérifications immédiates
-- =====================================================================

-- A) Compte : doit être 15
SELECT
  COUNT(*) FILTER (WHERE type_evenement = 'entrainement') AS nb_entrainements_total,
  COUNT(*) FILTER (WHERE type_evenement = 'entrainement' AND etat = 'creation') AS nb_creation,
  COUNT(*) FILTER (WHERE type_evenement = 'entrainement' AND etat = 'annule') AS nb_annule
FROM evenements
WHERE saison_id = (SELECT id FROM saisons WHERE code = '2025-2026');

-- B) Liste compacte : les 5 prochains entraînements (à venir, hors annulés)
SELECT
  date_debut::DATE AS date,
  TO_CHAR(date_debut, 'HH24:MI') AS heure,
  etat,
  libelle
FROM evenements
WHERE type_evenement = 'entrainement'
  AND date_debut >= NOW()
  AND etat = 'creation'
ORDER BY date_debut ASC
LIMIT 5;

COMMIT;
