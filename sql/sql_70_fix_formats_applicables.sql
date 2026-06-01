-- =============================================================================
-- sql/70 — Correction de postes.formats_applicables (formats X et VII)
-- =============================================================================
--
-- CONTEXTE
--   La colonne postes.formats_applicables décrivait des compositions FAUSSES
--   pour deux formats du rugby éducatif :
--     • '7'  (rugby à VII) : 7 postes ARRIÈRE (9→15), soit 0 avant — faux.
--              Réel = 3 avants (2 piliers + talonneur) + 4 arrières.
--     • 'X'  (jeu à 10 FFR EDR) : 13 postes — faux. Réel = 10 postes
--              (pack à 5 : 1-2-3 + 4-5 ; arrière : 9-10-12-14-15).
--
--   Compositions CIBLES dictées par Manu (coach M14), font foi :
--     • X   (10 postes) : PG, TAL, PD, 2LG, 2LD, DM, DO, CG, AD, AR
--     • VII ( 7 postes) : PG, TAL, PD, DM, DO, CG, AG
--
--   On ne touche QUE les jetons 'X' et '7'. Les jetons 'XV' et '13'
--   (corrects) restent inchangés sur toutes les lignes.
--
-- TYPE DE LA COLONNE
--   formats_applicables est de type text[] (tableau Postgres natif), PAS jsonb.
--   La représentation ["XV","13","X"] vue en sonde est l'affichage texte d'un
--   text[]. On écrit donc des littéraux ARRAY[...]::text[].
--
-- PORTÉE
--   N'affecte PAS les compositions déjà saisies (composition_joueurs) : une
--   compo X/VII existante peut référencer un poste désormais non applicable à
--   son format ; rien ne casse (la vue Terrain n'affiche que les postes du
--   format, les autres joueurs restent dans la compo / au banc), à savoir.
--
-- SÛRETÉ
--   • Idempotent : pose la valeur cible complète par code (relançable).
--   • Fail-loud : vérifie le résultat poste par poste, RAISE EXCEPTION sinon.
--   • Transaction explicite : tout ou rien.
--   • Ne touche que est_regroupement = false (les 15 postes de terrain).
-- =============================================================================

BEGIN;

-- 1) Correction : on POSE la valeur cible complète (text[]).
UPDATE postes SET formats_applicables = ARRAY['XV','13','X','7']::text[]
  WHERE code IN ('PG','TAL','PD') AND est_regroupement = false;

UPDATE postes SET formats_applicables = ARRAY['XV','13','X']::text[]
  WHERE code IN ('2LG','2LD') AND est_regroupement = false;

UPDATE postes SET formats_applicables = ARRAY['XV']::text[]
  WHERE code IN ('3LG','3LD') AND est_regroupement = false;

UPDATE postes SET formats_applicables = ARRAY['XV','13']::text[]
  WHERE code IN ('N8','CD') AND est_regroupement = false;

UPDATE postes SET formats_applicables = ARRAY['XV','13','X','7']::text[]
  WHERE code IN ('DM','DO','CG') AND est_regroupement = false;

UPDATE postes SET formats_applicables = ARRAY['XV','13','7']::text[]
  WHERE code = 'AG' AND est_regroupement = false;

UPDATE postes SET formats_applicables = ARRAY['XV','13','X']::text[]
  WHERE code IN ('AD','AR') AND est_regroupement = false;

-- 2) Vérification fail-loud : chaque poste doit avoir EXACTEMENT la cible.
--    Comparaison ensembliste (jetons triés) tolérant un ordre différent.
DO $verif$
DECLARE
  r record;
  attendu text[];
BEGIN
  FOR r IN
    SELECT code, formats_applicables
    FROM postes
    WHERE est_regroupement = false
  LOOP
    attendu := CASE r.code
      WHEN 'PG'  THEN ARRAY['XV','13','X','7']
      WHEN 'TAL' THEN ARRAY['XV','13','X','7']
      WHEN 'PD'  THEN ARRAY['XV','13','X','7']
      WHEN '2LG' THEN ARRAY['XV','13','X']
      WHEN '2LD' THEN ARRAY['XV','13','X']
      WHEN '3LG' THEN ARRAY['XV']
      WHEN '3LD' THEN ARRAY['XV']
      WHEN 'N8'  THEN ARRAY['XV','13']
      WHEN 'DM'  THEN ARRAY['XV','13','X','7']
      WHEN 'DO'  THEN ARRAY['XV','13','X','7']
      WHEN 'AG'  THEN ARRAY['XV','13','7']
      WHEN 'CG'  THEN ARRAY['XV','13','X','7']
      WHEN 'CD'  THEN ARRAY['XV','13']
      WHEN 'AD'  THEN ARRAY['XV','13','X']
      WHEN 'AR'  THEN ARRAY['XV','13','X']
      ELSE NULL
    END;

    IF attendu IS NULL THEN
      RAISE EXCEPTION 'sql/70: code poste inattendu hors cible: %', r.code;
    END IF;

    -- tri des deux tableaux puis comparaison stricte
    IF (
      SELECT array_agg(v ORDER BY v) FROM unnest(r.formats_applicables) v
    ) IS DISTINCT FROM (
      SELECT array_agg(v ORDER BY v) FROM unnest(attendu) v
    ) THEN
      RAISE EXCEPTION 'sql/70: % a formats_applicables=% attendu=%',
        r.code, r.formats_applicables, attendu;
    END IF;
  END LOOP;

  RAISE NOTICE 'sql/70 OK: 15 postes vérifiés, formats_applicables conformes aux cibles X/VII.';
END
$verif$;

COMMIT;

-- =============================================================================
-- CONTRÔLE (à lancer après COMMIT, lecture seule) :
--   SELECT code, libelle_court, formats_applicables
--   FROM postes WHERE est_regroupement = false ORDER BY numero_xv;
-- =============================================================================
