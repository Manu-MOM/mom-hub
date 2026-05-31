-- ============================================================
-- MOM Hub · Fix index compo de match — différenciation par MATCH
-- ============================================================
--
-- CONTEXTE (chantier 6c-6, recette terrain Manu 31/05/2026)
-- ------------------------------------------------------------
-- L'index unique existant impose UNE seule compo de match active par
-- (compo_base_origine_id, cote) :
--
--   CREATE UNIQUE INDEX idx_compositions_active_match_per_base_cote
--   ON public.compositions (compo_base_origine_id, cote)
--   WHERE est_active = true AND type_compo = 'match';
--
-- Or le besoin réel est : PLUSIEURS compos de match dérivées d'une même
-- base, une par adversaire (vs Nord Alsace, vs Saint-André…). Symptôme :
--   duplicate key value violates unique constraint
--   "idx_compositions_active_match_per_base_cote"
-- dès la création de la 2ᵉ compo de match (« pas possible d'activer les
-- autres matchs »).
--
-- DÉCISION (option α actée) : une compo de match porte evenement_id = LE
-- MATCH (pas la racine). On ajoute donc evenement_id à la clé unique :
--   - autorise 1 compo de match active PAR (base, match, côté) → plusieurs
--     matchs sous une même base ;
--   - conserve la protection anti-doublon sur un MÊME match (impossible
--     d'avoir 2 compos de match actives pour le même match + base + côté).
--
-- LIMITE CONNUE (tracée, non bloquante) : le « + » brouillon libre crée une
-- compo de match avec evenement_id = racine. Deux brouillons libres
-- simultanés sous la même base partageraient (base, racine, cote) et se
-- bloqueraient l'un l'autre. Cas rare ; à traiter séparément si besoin
-- (p. ex. evenement_id NULL pour les brouillons + index tolérant NULL).
--
-- SÛRETÉ : DROP puis CREATE dans une transaction. Si une donnée viole déjà
-- la nouvelle contrainte (2 compos de match actives même (base, match,
-- cote)), le CREATE échouera et le ROLLBACK laissera l'ancien index en
-- place — état cohérent, rien de cassé. (À ce stade : 1 seule compo de
-- match existe — « vs Nord Alsace » — donc aucun conflit attendu.)
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS idx_compositions_active_match_per_base_cote;

CREATE UNIQUE INDEX idx_compositions_active_match_per_base_cote
  ON public.compositions (compo_base_origine_id, evenement_id, cote)
  WHERE (est_active = true AND type_compo = 'match'::text);

COMMIT;

-- Vérification post-migration (à lancer après le COMMIT) :
-- SELECT indexdef FROM pg_indexes
-- WHERE indexname = 'idx_compositions_active_match_per_base_cote';
-- Attendu : USING btree (compo_base_origine_id, evenement_id, cote)
--           WHERE ((est_active = true) AND (type_compo = 'match'::text))
