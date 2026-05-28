-- ============================================================================
-- MOM Hub · sql/54-rollback-bascule.sql
-- ADMIN-(ii) · (2b) — ROLLBACK MANUEL d'une bascule de catégories par millésime
-- ============================================================================
--
-- ⚠️ CECI EST UN MODÈLE À GARDER AU DÉPÔT — PAS UN SCRIPT À EXÉCUTER EN L'ÉTAT.
--    Rien à annuler tant qu'aucune bascule n'a été appliquée (bascule_log vide).
--    Conforme D4=a (rollback SQL manuel, pas de bouton UI en v1, cf. sql/53).
--
-- Principe : appliquer_bascule (sql/53) écrit dans bascule_log une ligne par
-- application, avec le détail complet [{personne_id, categorie_avant,
-- categorie_apres}, …]. Le rollback ré-écrit `categorie_avant` verbatim depuis
-- ce journal → retour exact à l'état d'avant la bascule.
--
-- À exécuter dans le SQL Editor Supabase (superuser → pas de JWT requis).
-- Procédure en 3 temps : (1) lister, (2) DRY-RUN (prévisualiser), (3) appliquer.
--
-- ⚠️ Limites honnêtes :
--   - Retour BRUT : écrase categorie_id avec la valeur stockée. Si des
--     catégories ont été modifiées à la main APRÈS la bascule, ce retour les
--     écrase aussi. Idéal = annulation rapide juste après coup.
--   - La ligne bascule_log n'est PAS supprimée (trace conservée). DELETE
--     facultatif en fin si vous le souhaitez vraiment.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) LISTER les bascules enregistrées (la plus récente en haut).
--     Copier l'`id` de la ligne à annuler pour les étapes (2) et (3).
-- ----------------------------------------------------------------------------
SELECT id, saison_cible_id, date_application, nb_basculees
FROM public.bascule_log
ORDER BY date_application DESC;


-- ----------------------------------------------------------------------------
-- (2) DRY-RUN — prévisualiser CE QUI SERAIT restauré, SANS rien écrire.
--     Remplacer <LOG_ID> par l'id réel copié en (1). Vérifier le nombre de
--     lignes et que `categorie_avant` correspond bien à l'état attendu.
-- ----------------------------------------------------------------------------
WITH d AS (
  SELECT (e->>'personne_id')::uuid     AS pid,
         (e->>'categorie_avant')::uuid AS cat_avant,
         (e->>'categorie_apres')::uuid AS cat_apres
  FROM public.bascule_log,
       LATERAL jsonb_array_elements(detail) AS e
  WHERE id = '<LOG_ID>'
)
SELECT p.id,
       trim(coalesce(p.prenom,'') || ' ' || upper(coalesce(p.nom,''))) AS joueur,
       c_now.code   AS categorie_actuelle,
       c_back.code  AS categorie_restauree
FROM d
JOIN public.personnes p   ON p.id = d.pid
LEFT JOIN public.categories c_now  ON c_now.id  = p.categorie_id
LEFT JOIN public.categories c_back ON c_back.id = d.cat_avant
ORDER BY joueur;


-- ----------------------------------------------------------------------------
-- (3) APPLIQUER le rollback — ré-écrit categorie_avant. DÉCOMMENTER pour exécuter,
--     après avoir vérifié le DRY-RUN (2). Remplacer <LOG_ID> par le même id.
-- ----------------------------------------------------------------------------
-- BEGIN;
-- WITH d AS (
--   SELECT (e->>'personne_id')::uuid     AS pid,
--          (e->>'categorie_avant')::uuid AS cat_avant
--   FROM public.bascule_log,
--        LATERAL jsonb_array_elements(detail) AS e
--   WHERE id = '<LOG_ID>'
-- )
-- UPDATE public.personnes p
-- SET categorie_id = d.cat_avant,
--     updated_at   = now()
-- FROM d
-- WHERE p.id = d.pid;
-- -- Vérifier le nombre de lignes mises à jour = nb_basculees de la ligne (1).
-- COMMIT;

-- (Facultatif) supprimer la trace du journal après rollback — NON recommandé
-- par défaut (la trace documente que la bascule a eu lieu puis été annulée) :
-- DELETE FROM public.bascule_log WHERE id = '<LOG_ID>';
-- ============================================================================
