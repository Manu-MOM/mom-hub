-- =====================================================================
-- sql_260 — CIRCUIT-SUIT-ETAGE (volet 3) : nettoyage des données
-- =====================================================================
-- FAIT FOI gelé par Manu le 16/10/2026 (retour terrain Corentin M14 :
-- pause boisson réglée à 2 min, affichée 8 min dans la trame).
--
-- Cause : seances_etages_circuits est clée (seance_id, ordre). Avant
-- seance-editor.js v1.30, déplacer un étage ou supprimer une voie laissait
-- la fiche circuit sur l'ancien ordre ; un _swapEtages interrompu laissait
-- des blocs sur un ordre « parking » (>= 1000).
--
-- (1) Supprime les fiches circuit posées sur un étage de moins de 2 voies
--     (inutilisables, et neutralisées par le garde-fou front v1.30).
-- (2) Renumérote les blocs parqués (ordre >= 1000) juste après le dernier
--     étage normal de leur séance, dans le même ordre relatif : l'ordre
--     d'affichage de la trame est STRICTEMENT inchangé (ils étaient déjà
--     affichés en fin de trame).
--
-- Volumes constatés au dry-run du 16/10/2026 : 5 circuits, 14 blocs.
-- Urgence préalable déjà appliquée (feu vert Manu 16/10/2026) : 5 circuits
-- orphelins de la séance fb819277 (ordres 4 à 8) supprimés.
--
-- Mode : COMMIT. APPLIQUÉ EN BASE PAR L'AGENT le 16/10/2026 (feu vert
-- COMMIT explicite Manu). Vérif post-COMMIT par SELECT séparé :
-- blocs_parques = 0, circuits_orphelins = 0, circuits_total = 43.
-- Ce fichier = trace dépôt (version dry-run : sql_260_..._parques.sql).
-- =====================================================================

DO $verif$
DECLARE
  n_circ  int;
  n_bloc  int;
  n_reste int;
BEGIN
  -- (1) Circuits orphelins
  DELETE FROM public.seances_etages_circuits AS c
  WHERE (
    SELECT count(*) FROM public.seances_blocs AS b
    WHERE b.seance_id = c.seance_id AND b.ordre = c.ordre
  ) < 2;
  GET DIAGNOSTICS n_circ = ROW_COUNT;

  -- (2) Blocs parqués : renumérotation après le dernier ordre normal
  WITH cible AS (
    SELECT
      b.id,
      (
        SELECT max(x.ordre) FROM public.seances_blocs AS x
        WHERE x.seance_id = b.seance_id AND x.ordre < 1000
      ) + dense_rank() OVER (PARTITION BY b.seance_id ORDER BY b.ordre) AS nouvel_ordre
    FROM public.seances_blocs AS b
    WHERE b.ordre >= 1000
  )
  UPDATE public.seances_blocs AS b
  SET ordre = cible.nouvel_ordre
  FROM cible
  WHERE b.id = cible.id;
  GET DIAGNOSTICS n_bloc = ROW_COUNT;

  -- Vérifications fail-loud
  IF n_circ <> 5 THEN
    RAISE EXCEPTION 'VERIF KO circuits : % (attendu 5)', n_circ;
  END IF;
  IF n_bloc <> 14 THEN
    RAISE EXCEPTION 'VERIF KO blocs : % (attendu 14)', n_bloc;
  END IF;

  SELECT count(*) INTO n_reste FROM public.seances_blocs WHERE ordre >= 1000;
  IF n_reste <> 0 THEN
    RAISE EXCEPTION 'VERIF KO : % blocs encore parqués', n_reste;
  END IF;

  SELECT count(*) INTO n_reste
  FROM public.seances_etages_circuits AS c
  WHERE (
    SELECT count(*) FROM public.seances_blocs AS b
    WHERE b.seance_id = c.seance_id AND b.ordre = c.ordre
  ) < 2;
  IF n_reste <> 0 THEN
    RAISE EXCEPTION 'VERIF KO : % circuits orphelins restants', n_reste;
  END IF;

  RAISE NOTICE 'COMMIT OK : % circuits, % blocs', n_circ, n_bloc;
END
$verif$;
