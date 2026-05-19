-- =====================================================================
-- MOM HUB · sql/49 — NETTOYAGE doublons amorçage collectif_membre N1
-- =====================================================================
-- Auteur  : conv Production · Implémentation Collectif & compo 3
--           niveaux (assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- CONTEXTE (constat À LA SOURCE, prouvé terrain — le fait fait foi) :
--   Après sql/48 + enrôlements manuels de test U-admin :
--   collectif_membre M14 = 93 lignes / 62 personnes distinctes.
--   31 personnes ont 2 lignes : leur VRAIE date d'entrée
--   (date_affectation : 2025-09-01 ou 2026-05-13, posée par sql/48)
--   + une ligne 2026-05-19 (= date du jour, artefact du wrapper
--   unitaire addCollectifMembre lors des tests U-admin). L'ON
--   CONFLICT de sql/48 n'a pas dédoublonné car date_debut diffère
--   (clé UNIQUE = personne+entente+role+date_debut).
--   Vérifié 19/05 : parasites_a_supprimer = 31 ; solo_19mai = 0
--   (aucune personne dont 2026-05-19 serait l'unique/vraie date).
--
-- DÉCISION (Claude tranche, Manu a délégué « le plus juste vs N1-4 »):
--   On CONSERVE la ligne la plus ANCIENNE par personne (= vraie date
--   d'entrée) et on SUPPRIME la ligne 2026-05-19 PARASITE. Fondement
--   = N1-4 du modèle FAIT FOI « passé immuable, jamais réécrit » :
--   2026-05-19 est un artefact de test postérieur, pas un fait
--   d'appartenance ; le garder falsifierait l'historique N1.
--
-- GARDE DE SÛRETÉ (anti-perte de donnée réelle — exigence absolue) :
--   On ne supprime une ligne 2026-05-19 QUE SI une AUTRE ligne
--   (date <> 2026-05-19) existe pour la même (personne, entente,
--   role). Une personne dont 2026-05-19 serait la SEULE ligne
--   (enrôlement manuel légitime jamais affecté en equipe_joueurs)
--   n'est JAMAIS touchée (EXISTS faux pour elle). solo_19mai=0
--   aujourd'hui, mais la garde tient quelle que soit la valeur :
--   le script est correct même si le contexte change.
--
-- IDEMPOTENT : OUI. 2ᵉ exécution → plus aucune ligne 2026-05-19
--   ayant un jumeau plus ancien → 0 suppression, fail-loud passe
--   (total déjà = distinct). Rejouable sans effet ni erreur.
--
-- FAIL-LOUD AUTO-MESURÉ : le script mesure LUI-MÊME l'état avant /
--   après (ne fait confiance à AUCUN chiffre en dur). Après
--   suppression : exige (a) plus AUCUN doublon (count =
--   count(distinct personne_id)) ET (b) total_final = nb personnes
--   distinctes AVANT nettoyage (on n'a pas perdu de personne, juste
--   dédoublonné). Sinon RAISE EXCEPTION → ROLLBACK atomique.
--
-- PÉRIMÈTRE : entente ENTENTE-M14-2025-2026, role='joueur' (le
--   périmètre exact de sql/48). Ne touche aucune autre entente,
--   aucun staff, aucune autre table.
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- PRÉALABLE : sql/44 + sql/48 exécutés. Transaction ; fail-loud
-- AVANT COMMIT (auto-ROLLBACK si l'état final n'est pas exactement
-- celui attendu — discipline sql/43/46/47/48).
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_personnes_avant INTEGER;   -- personnes distinctes AVANT (cible)
  v_lignes_avant    INTEGER;
  v_supprimees      INTEGER;
  v_lignes_apres    INTEGER;
  v_personnes_apres INTEGER;
BEGIN
  -- État AVANT (mesuré, pas supposé)
  SELECT count(*), count(DISTINCT cm.personne_id)
    INTO v_lignes_avant, v_personnes_avant
  FROM collectif_membre cm
  JOIN ententes en ON en.id = cm.entente_id
  WHERE en.code = 'ENTENTE-M14-2025-2026' AND cm.role = 'joueur';

  -- Suppression chirurgicale GARDÉE : seulement les 2026-05-19
  -- ayant un jumeau plus ancien (même personne/entente/role).
  WITH cible AS (
    SELECT cm.id
    FROM collectif_membre cm
    JOIN ententes en ON en.id = cm.entente_id
    WHERE en.code = 'ENTENTE-M14-2025-2026'
      AND cm.role = 'joueur'
      AND cm.date_debut = DATE '2026-05-19'
      AND EXISTS (
        SELECT 1 FROM collectif_membre x
        WHERE x.personne_id = cm.personne_id
          AND x.entente_id  = cm.entente_id
          AND x.role        = cm.role
          AND x.date_debut <> DATE '2026-05-19'
      )
  )
  DELETE FROM collectif_membre c
  USING cible
  WHERE c.id = cible.id;

  GET DIAGNOSTICS v_supprimees = ROW_COUNT;

  -- État APRÈS
  SELECT count(*), count(DISTINCT cm.personne_id)
    INTO v_lignes_apres, v_personnes_apres
  FROM collectif_membre cm
  JOIN ententes en ON en.id = cm.entente_id
  WHERE en.code = 'ENTENTE-M14-2025-2026' AND cm.role = 'joueur';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'AVANT  : % lignes / % personnes', v_lignes_avant, v_personnes_avant;
  RAISE NOTICE 'Supprimées (parasites 2026-05-19) : %', v_supprimees;
  RAISE NOTICE 'APRÈS  : % lignes / % personnes', v_lignes_apres, v_personnes_apres;
  RAISE NOTICE '────────────────────────────────────────────';

  -- (a) plus AUCUN doublon
  IF v_lignes_apres <> v_personnes_apres THEN
    RAISE EXCEPTION
      'sql/49 : doublons subsistants (% lignes / % personnes) — ROLLBACK.',
      v_lignes_apres, v_personnes_apres;
  END IF;

  -- (b) on n'a PERDU aucune personne : le nb de personnes distinctes
  --     est identique avant/après (on a seulement dédoublonné)
  IF v_personnes_apres <> v_personnes_avant THEN
    RAISE EXCEPTION
      'sql/49 : nb personnes modifié (% -> %) — perte de donnée, ROLLBACK.',
      v_personnes_avant, v_personnes_apres;
  END IF;

  -- (c) total final = nb personnes (1 ligne / personne désormais)
  IF v_lignes_apres <> v_personnes_avant THEN
    RAISE EXCEPTION
      'sql/49 : total final % <> personnes attendues % — ROLLBACK.',
      v_lignes_apres, v_personnes_avant;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — APRÈS le Run)
-- Attendu : 62 lignes / 62 personnes, plus aucun doublon, chaque
-- personne sur sa VRAIE date d'entrée (2025-09-01 / 2026-05-13 …),
-- plus aucune 2026-05-19 parasite.
-- =====================================================================
SELECT count(*)                       AS lignes,
       count(DISTINCT personne_id)    AS personnes,
       count(*) FILTER (WHERE date_debut = DATE '2026-05-19') AS reste_19mai
FROM collectif_membre cm
JOIN ententes en ON en.id = cm.entente_id
WHERE en.code = 'ENTENTE-M14-2025-2026' AND cm.role = 'joueur';
