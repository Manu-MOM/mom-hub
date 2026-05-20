-- ============================================================
-- MOM Hub · sql/51 — Nettoyage bases test « essai 2 » + « essai 3 »
-- ============================================================
-- Date          : 20 mai 2026 (pt 17)
-- Conv          : Production · Hygiène — console.log boots + nettoyage
--                 données test
-- Auteur        : Manu (Emmanuel Jung)
--
-- BUT
--   Basculer est_active=FALSE sur les 2 compositions de base brouillon
--   créées pendant la recette terrain pt 16 (étape c U-N3) et conservées
--   en base par décision Manu (pt 16, STATE ligne 188 :
--   « 4fe2bb63 essai 2 + e1298710 essai 3 — pas de pollution réelle,
--   à supprimer plus tard si souhaité (bascule est_active=FALSE sans
--   DELETE — passé immuable scénario 5 modèle v1.1) »).
--
--   - 4fe2bb63-632d-45a4-9ad7-a0cc905c3635
--       evt 1f34954a-c056-4afc-a8cd-c676345c1c53 « essai 2 »
--       evenement_equipe_id 11cbb325-8498-42d9-850b-09701d3238df
--       type_compo='base', 2 placements composition_joueurs
--   - e1298710-5975-467a-85a8-d2bfd6df3a5f
--       evt d9e015d3-384b-4093-82e7-39343316dd97 « essai 3 »
--       evenement_equipe_id e649e6cd-a075-47e6-9c43-77b01b7e2e07
--       type_compo='base', 0 placement composition_joueurs
--
-- DISCIPLINE (pt 14/15/16 reprise pt 17)
--   - JAMAIS DELETE — passé immuable (scénario 5 modèle Collectif v1.1,
--     P4 anti-mutation destructive).
--   - composition_joueurs NON TOUCHÉ (S3 option a STRICT actée pt 17) —
--     traçabilité du passé préservée.
--   - Idempotent — WHERE est_active=TRUE rend le SQL re-rejouable sans
--     casse (tour 2 : 0 ligne basculée, fail-loud passe quand même car
--     teste l'état-cible, pas le delta).
--   - Transaction atomique BEGIN…COMMIT — si fail-loud déclenche, la
--     transaction passe en aborted state, le COMMIT final = ROLLBACK
--     implicite (patron sql/50 vérifié pt 16).
--   - Cadrage pré-UPDATE + post-UPDATE recollés en sortie (pattern
--     sql/50, preuve à la source, jamais sur doc).
--   - Fail-loud post-UPDATE testé sur l'invariant d'état-cible (0
--     active restante parmi les 2 cibles) + invariant de cardinalité
--     (les 2 IDs cibles doivent exister, sinon source corrompue).
--
-- CADRAGE SOURCE PRÉ-EXÉCUTION (recollé Manu, conv pt 17 — Q5b répliqué)
--   SELECT id, evenement_id, evenement_equipe_id, type_compo, est_active
--   FROM compositions
--   WHERE id IN ('4fe2bb63-…', 'e1298710-…');
--   → 2 lignes ; type_compo='base' × 2 ; est_active=TRUE × 2 ;
--     evenement_equipe_id distincts (11cbb325-… ≠ e649e6cd-…) ;
--     evenement_id distincts (1f34954a-… ≠ d9e015d3-…).
--   Confirmé prêt à bascule.
--
-- POST-EXÉCUTION ATTENDUE
--   - 2 lignes compositions(id IN cibles) avec est_active=FALSE
--   - 0 ligne compositions(id IN cibles) avec est_active=TRUE
--   - composition_joueurs intacts (2 lignes rattachées à 4fe2bb63)
--   - re-rejouable sans casse (idempotent prouvé)
--
-- EFFET DE BORD POSITIF DE L'EXTINCTION
--   Les index unique partiels sql/50 (idx_compositions_active_base_per_
--   event_equipe_cote / idx_compositions_active_match_per_base_cote)
--   filtrent WHERE est_active=TRUE — donc ces 2 lignes basculées sortent
--   de leur portée. Aucun conflit possible si une nouvelle base est créée
--   plus tard sur ces 2 évènements (cohérent Façon 1).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) CADRAGE PRÉ-UPDATE (preuve à la source)
-- ------------------------------------------------------------
SELECT
  'PRE-UPDATE' AS phase,
  id,
  type_compo,
  est_active,
  evenement_equipe_id
FROM compositions
WHERE id IN (
  '4fe2bb63-632d-45a4-9ad7-a0cc905c3635',
  'e1298710-5975-467a-85a8-d2bfd6df3a5f'
)
ORDER BY id;

-- ------------------------------------------------------------
-- 2) BASCULE IDEMPOTENTE — ne touche que les lignes actives
-- ------------------------------------------------------------
UPDATE compositions
SET est_active = FALSE
WHERE id IN (
  '4fe2bb63-632d-45a4-9ad7-a0cc905c3635',
  'e1298710-5975-467a-85a8-d2bfd6df3a5f'
)
  AND est_active = TRUE;

-- ------------------------------------------------------------
-- 3) FAIL-LOUD POST-UPDATE — invariants d'état-cible
--    (testé sur l'état, pas le delta : compatible idempotence)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_total_cibles        INTEGER;
  v_restantes_actives   INTEGER;
BEGIN
  -- Invariant 1 : cardinalité — les 2 IDs doivent exister
  SELECT COUNT(*) INTO v_total_cibles
  FROM compositions
  WHERE id IN (
    '4fe2bb63-632d-45a4-9ad7-a0cc905c3635',
    'e1298710-5975-467a-85a8-d2bfd6df3a5f'
  );

  IF v_total_cibles <> 2 THEN
    RAISE EXCEPTION
      'FAIL-LOUD sql/51 : invariant cardinalité violé — % lignes trouvées sur 2 IDs cibles (cadrage source pt 17 disait 2). ROLLBACK.',
      v_total_cibles;
  END IF;

  -- Invariant 2 : état-cible — 0 ligne active restante parmi les cibles
  SELECT COUNT(*) INTO v_restantes_actives
  FROM compositions
  WHERE id IN (
    '4fe2bb63-632d-45a4-9ad7-a0cc905c3635',
    'e1298710-5975-467a-85a8-d2bfd6df3a5f'
  )
    AND est_active = TRUE;

  IF v_restantes_actives <> 0 THEN
    RAISE EXCEPTION
      'FAIL-LOUD sql/51 : invariant état-cible violé — % ligne(s) restent est_active=TRUE parmi les 2 IDs cibles (attendu 0). ROLLBACK.',
      v_restantes_actives;
  END IF;
END$$;

-- ------------------------------------------------------------
-- 4) CADRAGE POST-UPDATE (preuve à la source)
-- ------------------------------------------------------------
SELECT
  'POST-UPDATE' AS phase,
  id,
  type_compo,
  est_active,
  evenement_equipe_id
FROM compositions
WHERE id IN (
  '4fe2bb63-632d-45a4-9ad7-a0cc905c3635',
  'e1298710-5975-467a-85a8-d2bfd6df3a5f'
)
ORDER BY id;

COMMIT;

-- ============================================================
-- FIN sql/51 — Si COMMIT renvoyé sans EXCEPTION, les 2 invariants
-- d'état-cible sont vérifiés. Recoller la sortie PRE/POST-UPDATE
-- en preuve à la source (pt 17 = patron pt 16 sql/50).
-- ============================================================
