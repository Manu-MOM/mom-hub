-- ============================================================
-- sql/50 · COMPOSITIONS-UNIQUE-PARTIEL · index multi-équipes
-- ============================================================
-- Conv : `Production · Implémentation Collectif & compo 3 niveaux
--        — étape (c) U-N3` (20 mai 2026).
-- Dette levée : `COMPOSITIONS-UNIQUE-PARTIEL` (régression latente
--               détectée matin 20/05, ouverture pt 15 STATE).
--
-- ────────────────────────────────────────────────────────────
-- INTENTION
-- ────────────────────────────────────────────────────────────
-- L'index UNIQUE partiel posé en sql/18,
-- `idx_compositions_active_per_event_cote`, est défini comme :
--   UNIQUE (evenement_id, cote) WHERE est_active = TRUE
-- Sur évènement compétition MULTI-ÉQUIPES (où plusieurs équipes
-- engagées coexistent, modèle Collectif v1.1 §3 N3-1), il refuse
-- l'INSERT d'une 2ᵉ compo active : équipe A et équipe B ne
-- peuvent plus avoir chacune leur compo active sur le même
-- évènement. C'est la régression à lever.
--
-- ────────────────────────────────────────────────────────────
-- DÉCISIONS ACTÉES (conv 20/05 étape c, Manu)
-- ────────────────────────────────────────────────────────────
-- Q1 (1a) — Option A pure. La base porte `evenement_equipe_id`
--           (sql/46 additif). Le match dérivé ne porte RIEN ;
--           son équipe se déduit en remontant à sa base via
--           `compo_base_origine_id` (CHECK déployé garantit que
--           tous les matchs ont `compo_base_origine_id NOT NULL`).
--           `duplicateCompoFromBase` NON modifié.
--
-- Q2 (2a) — Sur évènement multi-équipes, plusieurs feuilles
--           match actives simultanées (1 par équipe) sont le
--           cas normal. C'est précisément ce que cet index doit
--           autoriser.
--
-- Q3 (3b) — Deux index partiels distincts :
--           • bases : UNIQUE par (evenement, equipe engagée,
--             côté) — 1 base active par équipe engagée par côté.
--           • matchs : UNIQUE par (base d'origine, côté) — 1
--             feuille match active par base. Préserve la garde
--             anti-doublon anti-saisie (équivalent multi-équipes
--             de l'index legacy), reformulée par base (ancrage
--             stable, CHECK déployé).
--
-- Q4 (4a) — Création de la compo de base = geste explicite via
--           CTA (compositions-editor v3.8 + supabase-client v1.27,
--           livrés dans des fichiers séparés). Pas d'impact SQL ici.
--
-- ────────────────────────────────────────────────────────────
-- PRÉSERVATION DU COMPORTEMENT LEGACY (mono-équipe)
-- ────────────────────────────────────────────────────────────
-- En mono-équipe legacy, `evenement_equipe_id IS NULL`. Sans
-- précaution, PG traite NULL comme distinct dans un UNIQUE →
-- deux bases legacy actives sur le même (evenement, cote)
-- pourraient coexister sans déclencher l'index. Pour préserver
-- strictement la garde legacy (« 1 base active par évènement
-- mono-équipe »), l'index bases utilise `NULLS NOT DISTINCT`
-- (disponible PG ≥ 15 — confirmé PG 17.6 sur cette base).
--
-- Côté matchs : `compo_base_origine_id NOT NULL` est garanti
-- pour tout `type_compo='match'` par le CHECK déployé
-- `compositions_origine_only_for_match_check`. Pas de NULL
-- parasite possible dans le périmètre filtré → `NULLS NOT
-- DISTINCT` inutile sur l'index matchs.
--
-- ────────────────────────────────────────────────────────────
-- NOTE FORWARD-COMPAT cote='mom'
-- ────────────────────────────────────────────────────────────
-- Le CHECK `compositions_cote_check : cote='mom'` figé mono-
-- valeur signifie que la composante `cote` dans les deux
-- nouveaux index est aujourd'hui factice (1 valeur possible).
-- On la conserve par cohérence avec le patron legacy (qui
-- incluait `cote`) et pour forward-compat si le CHECK est
-- relâché. Pas une régression : strict miroir du legacy.
--
-- ────────────────────────────────────────────────────────────
-- DISCIPLINE
-- ────────────────────────────────────────────────────────────
-- Idempotent (DROP INDEX IF EXISTS + CREATE UNIQUE INDEX IF
-- NOT EXISTS). Transaction. Cadrage PRÉ-CREATE : détecte les
-- violations latentes (lignes existantes qui empêcheraient la
-- création de l'index) AVANT d'attaquer le CREATE, RAISE
-- EXCEPTION explicite si trouvées (pt 15 : pas de SQL qui
-- réussit en cachant un état parasite). Fail-loud post-CREATE :
-- vérifie que les 2 nouveaux index existent + que l'ancien a
-- disparu, AVANT COMMIT.
--
-- Aucune mutation de :
--   - `compositions.evenement_id` (intact, sql/18 fait foi) ;
--   - autres index `compositions` (5 conservés byte-identiques :
--     compositions_pkey, idx_compositions_etat, idx_compositions_
--     evenement, idx_compositions_evenement_equipe, idx_
--     compositions_origine) ;
--   - aucune contrainte CHECK/FK touchée ;
--   - aucune ligne de données.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- (0) CADRAGE PRÉ-CREATE : détection violations latentes
-- ────────────────────────────────────────────────────────────
-- Pré-vol : on vérifie que les 2 index unique partiels qu'on
-- va créer peuvent l'être proprement, AVANT d'exécuter les
-- CREATE. Si des lignes existantes violent déjà l'unicité
-- cible, on échoue tôt avec un diagnostic explicite (ids
-- fautifs énumérés via RAISE NOTICE) plutôt que de laisser
-- PG remonter un message générique en plein milieu.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_violations_base  INTEGER;
  v_violations_match INTEGER;
  v_rec RECORD;
BEGIN
  -- Périmètre bases : (evenement_id, evenement_equipe_id, cote)
  -- avec NULLS NOT DISTINCT (NULL et NULL = doublon)
  SELECT COUNT(*) INTO v_violations_base
  FROM (
    SELECT evenement_id, evenement_equipe_id, cote
    FROM public.compositions
    WHERE est_active = TRUE AND type_compo = 'base'
    GROUP BY evenement_id, evenement_equipe_id, cote
    HAVING COUNT(*) > 1
  ) AS dups_base;

  IF v_violations_base > 0 THEN
    RAISE NOTICE 'CADRAGE sql/50 : % groupe(s) base en doublon actif détecté(s) :', v_violations_base;
    FOR v_rec IN
      SELECT evenement_id, evenement_equipe_id, cote, COUNT(*) AS n,
             array_agg(id ORDER BY created_at) AS ids
      FROM public.compositions
      WHERE est_active = TRUE AND type_compo = 'base'
      GROUP BY evenement_id, evenement_equipe_id, cote
      HAVING COUNT(*) > 1
    LOOP
      RAISE NOTICE '  evenement=% / evenement_equipe=% / cote=% → % lignes : %',
        v_rec.evenement_id, v_rec.evenement_equipe_id, v_rec.cote, v_rec.n, v_rec.ids;
    END LOOP;
  END IF;

  -- Périmètre matchs : (compo_base_origine_id, cote)
  -- (compo_base_origine_id garanti NOT NULL sur les matchs par
  -- CHECK déployé)
  SELECT COUNT(*) INTO v_violations_match
  FROM (
    SELECT compo_base_origine_id, cote
    FROM public.compositions
    WHERE est_active = TRUE AND type_compo = 'match'
    GROUP BY compo_base_origine_id, cote
    HAVING COUNT(*) > 1
  ) AS dups_match;

  IF v_violations_match > 0 THEN
    RAISE NOTICE 'CADRAGE sql/50 : % groupe(s) match en doublon actif détecté(s) :', v_violations_match;
    FOR v_rec IN
      SELECT compo_base_origine_id, cote, COUNT(*) AS n,
             array_agg(id ORDER BY created_at) AS ids
      FROM public.compositions
      WHERE est_active = TRUE AND type_compo = 'match'
      GROUP BY compo_base_origine_id, cote
      HAVING COUNT(*) > 1
    LOOP
      RAISE NOTICE '  compo_base_origine=% / cote=% → % lignes : %',
        v_rec.compo_base_origine_id, v_rec.cote, v_rec.n, v_rec.ids;
    END LOOP;
  END IF;

  IF v_violations_base > 0 OR v_violations_match > 0 THEN
    RAISE EXCEPTION
      'sql/50 ABORTED : % doublon(s) base + % doublon(s) match actif(s) existant(s). '
      'Nettoyage manuel requis (voir NOTICE ci-dessus pour les ids). '
      'Stratégie attendue : basculer les doublons surnuméraires à est_active=FALSE '
      '(jamais DELETE — passé immuable). Re-jouer sql/50 ensuite.',
      v_violations_base, v_violations_match;
  END IF;

  RAISE NOTICE 'CADRAGE sql/50 OK : 0 doublon base, 0 doublon match — création index sûre.';
END $$;

-- ────────────────────────────────────────────────────────────
-- (1) DROP de l'index legacy (refusait multi-équipes)
-- ────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_compositions_active_per_event_cote;

-- ────────────────────────────────────────────────────────────
-- (2) CREATE index bases : 1 base active par (évènement,
--     équipe engagée, côté). NULLS NOT DISTINCT préserve la
--     garde legacy mono-équipe (evenement_equipe_id IS NULL).
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_compositions_active_base_per_event_equipe_cote
  ON public.compositions (evenement_id, evenement_equipe_id, cote)
  NULLS NOT DISTINCT
  WHERE est_active = TRUE AND type_compo = 'base';

-- ────────────────────────────────────────────────────────────
-- (3) CREATE index matchs : 1 feuille match active par base.
--     compo_base_origine_id garanti NOT NULL sur les matchs
--     (CHECK compositions_origine_only_for_match_check).
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_compositions_active_match_per_base_cote
  ON public.compositions (compo_base_origine_id, cote)
  WHERE est_active = TRUE AND type_compo = 'match';

-- ────────────────────────────────────────────────────────────
-- (4) FAIL-LOUD AVANT COMMIT : l'état-cible doit être vérifié,
--     pas supposé. Si un seul des 3 invariants ne tient pas,
--     RAISE EXCEPTION → ROLLBACK automatique de la transaction
--     entière (DROP inclus).
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_old_drop_count   INTEGER;
  v_new_base_count   INTEGER;
  v_new_match_count  INTEGER;
BEGIN
  -- Invariant 1 : l'ancien index a disparu
  SELECT COUNT(*) INTO v_old_drop_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename  = 'compositions'
    AND indexname  = 'idx_compositions_active_per_event_cote';

  -- Invariant 2 : le nouvel index bases existe
  SELECT COUNT(*) INTO v_new_base_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename  = 'compositions'
    AND indexname  = 'idx_compositions_active_base_per_event_equipe_cote';

  -- Invariant 3 : le nouvel index matchs existe
  SELECT COUNT(*) INTO v_new_match_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename  = 'compositions'
    AND indexname  = 'idx_compositions_active_match_per_base_cote';

  IF v_old_drop_count <> 0 THEN
    RAISE EXCEPTION
      'sql/50 FAIL-LOUD : l''ancien index idx_compositions_active_per_event_cote '
      'existe encore (count=%) — DROP raté. ROLLBACK.',
      v_old_drop_count;
  END IF;

  IF v_new_base_count <> 1 THEN
    RAISE EXCEPTION
      'sql/50 FAIL-LOUD : index bases idx_compositions_active_base_per_event_equipe_cote '
      'absent (count=%, attendu 1). ROLLBACK.',
      v_new_base_count;
  END IF;

  IF v_new_match_count <> 1 THEN
    RAISE EXCEPTION
      'sql/50 FAIL-LOUD : index matchs idx_compositions_active_match_per_base_cote '
      'absent (count=%, attendu 1). ROLLBACK.',
      v_new_match_count;
  END IF;

  RAISE NOTICE 'sql/50 OK : DROP legacy + 2 index unique partiels créés. '
               'COMPOSITIONS-UNIQUE-PARTIEL levée côté base.';
END $$;

COMMIT;

-- ============================================================
-- VÉRIFICATION POST-COMMIT (à exécuter séparément après run)
-- ============================================================
-- Preuve par exécution réelle, pas par doc. Doit retourner
-- exactement 6 index sur compositions, dont :
--   • compositions_pkey                                       (PK, inchangé)
--   • idx_compositions_etat                                   (inchangé)
--   • idx_compositions_evenement                              (inchangé)
--   • idx_compositions_evenement_equipe                       (inchangé)
--   • idx_compositions_origine                                (inchangé)
--   • idx_compositions_active_base_per_event_equipe_cote      (NEW)
--   • idx_compositions_active_match_per_base_cote             (NEW)
-- Et NE DOIT PLUS contenir :
--   • idx_compositions_active_per_event_cote                  (DROPPED)
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'compositions'
-- ORDER BY indexname;
-- ============================================================
