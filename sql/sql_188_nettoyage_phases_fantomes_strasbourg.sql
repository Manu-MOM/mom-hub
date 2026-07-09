-- ============================================================================
-- sql_188 — EVT-PHASES-FANTOMES (D1 + D2) : nettoyage des 4 boîtes de phase
--           aux libellés par défaut du Tournoi International de Strasbourg
--           + backfill categorie_id des survivants.
--
-- ⚠️ GESTE DE DONNÉE PONCTUEL — DÉJÀ EXÉCUTÉ PAR CONNECTEUR LE 09/07/2026.
--    Fichier de trace (gouvernance). Ré-exécutable sans danger : le DELETE
--    et l'UPDATE retombent sur 0 ligne, le bloc de vérification reste vert.
--
-- CONTEXTE (pt 188) : cause élucidée — le 09/07/2026, un enregistrement de
-- la modale d'édition a appelé `modifier_evenement_complet` sur la racine
-- `1d66adce` ; la RPC détruit puis recrée TOUS les enfants depuis le DOM de
-- la modale. Deux boîtes de phase au libellé VIDE (défaut front « Phase N »)
-- portant chacune 3 lignes de match laissées à leur valeur par défaut
-- (« adv N » → libellé « vs adv N ») ont été persistées par équipe engagée
-- → 4 boîtes + 12 matchs parasites. Les enfants recréés sortaient de plus
-- `categorie_id NULL` (bug corrigé par sql_187).
--
-- D1 (Manu) : DELETE des 4 boîtes — leurs 12 matchs suivent par la FK
--             `evenement_parent_id` ON DELETE CASCADE (prouvée pt 178).
--             Contrôles préalables (sondes + test BEGIN/ROLLBACK) : 0 compo,
--             0 encadrant, 0 suivi sur le périmètre supprimé.
-- D2 (Manu) : backfill `categorie_id` des 16 survivants (2×2 poules + 12
--             matchs) via la catégorie de la racine (M14) — sql_187 ne
--             répare que l'avenir.
-- ============================================================================

BEGIN;

-- D1 — suppression des 4 boîtes suspectes (matchs enfants par CASCADE)
DELETE FROM public.evenements
WHERE id IN ('5a43abad-66ff-41bc-8dbe-797de8d4517a',
             '7d1ea1c5-920b-4c55-8e76-836508e3d7f8',
             '3ca4e730-4661-4eef-8fe1-c265f0028d7b',
             '5d490f1a-4d2f-4482-8816-89dc2e11e11a');

-- D2 — backfill categorie_id des survivants de l'arbre, hérité de la racine
UPDATE public.evenements e
SET categorie_id = r.categorie_id
FROM public.evenements r
WHERE r.id = '1d66adce-4863-463d-bc37-2df8615273a5'
  AND e.categorie_id IS NULL
  AND (e.evenement_parent_id = r.id
       OR e.evenement_parent_id IN (
            SELECT id FROM public.evenements
            WHERE evenement_parent_id = r.id));

COMMIT;

-- ============================================================================
-- Vérification fail-loud
-- ============================================================================
DO $verif$
DECLARE
  v_boites INT;
  v_matchs INT;
  v_null   INT;
  v_defaut INT;
BEGIN
  SELECT COUNT(*) INTO v_boites
  FROM public.evenements
  WHERE evenement_parent_id = '1d66adce-4863-463d-bc37-2df8615273a5';

  SELECT COUNT(*) INTO v_matchs
  FROM public.evenements e
  WHERE e.evenement_parent_id IN (
    SELECT id FROM public.evenements
    WHERE evenement_parent_id = '1d66adce-4863-463d-bc37-2df8615273a5');

  SELECT COUNT(*) INTO v_null
  FROM public.evenements e
  WHERE (e.evenement_parent_id = '1d66adce-4863-463d-bc37-2df8615273a5'
         OR e.evenement_parent_id IN (
              SELECT id FROM public.evenements
              WHERE evenement_parent_id = '1d66adce-4863-463d-bc37-2df8615273a5'))
    AND e.categorie_id IS NULL;

  SELECT COUNT(*) INTO v_defaut
  FROM public.evenements
  WHERE phase_libelle ~ '^Phase [0-9]+$';

  IF v_boites <> 4 THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : % boîtes de phase (attendu 4)', v_boites;
  END IF;
  IF v_matchs <> 12 THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : % matchs (attendu 12)', v_matchs;
  END IF;
  IF v_null <> 0 THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : % survivants non catégorisés (attendu 0)', v_null;
  END IF;
  IF v_defaut <> 0 THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : % boîtes « Phase N » résiduelles en base (attendu 0)', v_defaut;
  END IF;

  RAISE NOTICE 'VERIF OK : arbre = 4 poules + 12 matchs, 100%% catégorisés, plus aucune boîte par défaut en base.';
END;
$verif$;
