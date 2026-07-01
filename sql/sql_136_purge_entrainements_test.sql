-- =====================================================================
-- sql_136_purge_entrainements_test.sql
-- =====================================================================
-- OBJET
--   Supprimer les 15 événements de type 'entrainement' (données de test),
--   ainsi que les données rattachées : 1 composition (evenement
--   78fb55c6, portant 15 composition_joueurs) et 1 seance (evenement
--   a6389f0d). Les 30 événements 'competition' (Challenge Vié + Tournoi
--   International de Strasbourg et leur arborescence) NE SONT PAS touchés.
--
-- FAIT ÉTABLI (sondes DS-1) :
--   - 15 evenements type_evenement='entrainement' (saison 2025/2026).
--   - Dépendances réelles : compositions=1 (evt 78fb55c6),
--     seances=1 (evt a6389f0d) ; toutes les autres tables filles = 0
--     (presences, encadrants, equipes_engagees, chronologie_suivi,
--     lien_suivi, rapports, evenements_enfants).
--   - La compo 78fb55c6 porte 15 composition_joueurs (à purger d'abord).
--   - La seance a6389f0d n'a aucune table fille (chrono/liens/rapports=0).
--   - Périmètre confirmé par Manu : les 15 sans exception.
--
-- ORDRE DE SUPPRESSION (référençant -> référencé)
--   1. composition_joueurs (de la compo 78fb55c6)   -> 15 lignes
--   2. compositions (evt 78fb55c6)                  -> 1 ligne
--   3. seances (evt a6389f0d)                       -> 1 ligne
--   4. evenements type 'entrainement'               -> 15 lignes
--
-- IDEMPOTENT : NON (suppression). Fail-loud + rollback si compte inattendu.
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;

-- Compte de contrôle AVANT (competition à préserver)
DO $verif$
DECLARE
  v_comp_avant integer;
  v_entr_avant integer;
BEGIN
  v_comp_avant := (SELECT count(*) FROM evenements WHERE type_evenement = 'competition');
  v_entr_avant := (SELECT count(*) FROM evenements WHERE type_evenement = 'entrainement');
  RAISE NOTICE 'sql_136 AVANT : % competition (à préserver), % entrainement (à purger).',
    v_comp_avant, v_entr_avant;
  IF v_entr_avant <> 15 THEN
    RAISE EXCEPTION 'sql_136 ABORT : % entrainement au lieu de 15 attendus.', v_entr_avant;
  END IF;
END
$verif$;

-- 1) composition_joueurs de la compo de l'entraînement 78fb55c6
DELETE FROM composition_joueurs cj
USING compositions c
WHERE cj.composition_id = c.id
  AND c.evenement_id = '78fb55c6-1a12-4969-ae0c-bbbc2f339a4d';

-- 2) la composition elle-même
DELETE FROM compositions
WHERE evenement_id = '78fb55c6-1a12-4969-ae0c-bbbc2f339a4d';

-- 3) la séance de l'entraînement a6389f0d
DELETE FROM seances
WHERE evenement_id = 'a6389f0d-af4b-4cd2-9bf3-3628266eb55e';

-- 4) les 15 événements 'entrainement'
DELETE FROM evenements
WHERE type_evenement = 'entrainement';

-- =====================================================================
-- Vérifications fail-loud
-- =====================================================================
DO $verif$
DECLARE
  v_entr_reste integer;
  v_comp_reste integer;
  v_compo_orph integer;
  v_seance_orph integer;
BEGIN
  -- (1) plus aucun entrainement
  v_entr_reste := (SELECT count(*) FROM evenements WHERE type_evenement = 'entrainement');
  IF v_entr_reste <> 0 THEN
    RAISE EXCEPTION 'sql_136 ÉCHEC : % entrainement restants (attendu 0).', v_entr_reste;
  END IF;

  -- (2) les 30 competition sont INTACTES
  v_comp_reste := (SELECT count(*) FROM evenements WHERE type_evenement = 'competition');
  IF v_comp_reste <> 30 THEN
    RAISE EXCEPTION 'sql_136 ÉCHEC : % competition (attendu 30 — préservation).', v_comp_reste;
  END IF;

  -- (3) plus de compo ni de séance rattachée aux 2 evt purgés
  v_compo_orph := (SELECT count(*) FROM compositions
                   WHERE evenement_id = '78fb55c6-1a12-4969-ae0c-bbbc2f339a4d');
  v_seance_orph := (SELECT count(*) FROM seances
                    WHERE evenement_id = 'a6389f0d-af4b-4cd2-9bf3-3628266eb55e');
  IF v_compo_orph <> 0 OR v_seance_orph <> 0 THEN
    RAISE EXCEPTION 'sql_136 ÉCHEC : compo=% seance=% (attendu 0/0).',
      v_compo_orph, v_seance_orph;
  END IF;

  RAISE NOTICE 'sql_136 OK : 15 entrainement purgés, 30 competition intactes, compo+seance nettoyées.';
END
$verif$;

COMMIT;
