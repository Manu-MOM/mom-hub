-- =====================================================================
-- sql_273_loisir_reclassement — FAIT FOI COLLECTIF-AUTO v1, lot L2 (D4)
-- Gelé par Manu le 19/11/2026. Prérequis : sql_272 appliqué (déclencheur
--   collectif_auto_inscrire en place).
--
-- Les 32 fiches « loisir seul » (codes RLO/RLSP, aucun A/AM/B, non
-- archivées) passent en catégorie RLSP (si code RLSP) sinon RLO :
--   SR-M -> RLSP (20), SR-F -> RLO (3), M19 -> RLSP (1, LUNATI Icare,
--   inclus à la demande de Manu), sans catégorie -> RLSP (6) / RLO (2).
-- 1. Clôture (date_fin = HIER) de l'adhésion JOUEUR active à l'entente
--    de l'ancienne catégorie, saison active (24 attendues). Hier et non
--    aujourd'hui : list_vivier_collectif garde date_fin >= CURRENT_DATE,
--    une fin au jour même laisserait le joueur dans la pioche SR jusqu'à
--    demain. Garde : aucune de ces adhésions ne commence aujourd'hui.
--    Adhésions staff jamais touchées (BELKIS M14, HALBEISEN M10).
-- 2. UPDATE categorie_id (+ pole_attache_id = pôle LOISIRS de la nouvelle
--    catégorie, choix mineur tracé : le pôle suit la catégorie, comme
--    SR -> SENIORS aujourd'hui).
-- 3. L'inscription au collectif RLSP/RLO est faite par le déclencheur.
-- Garde-fous : effectifs attendus vérifiés avant écriture ; après : 32
--   fiches en RLSP/RLO inscrites joueur actif, 0 adhésion joueur active
--   restante dans les anciennes ententes, staff inchangé (fail-loud).
-- Mode : DRY-RUN (contrôle puis ROLLBACK). Version COMMIT = même fichier
--   sans le contrôle final, COMMIT final, sur feu vert de Manu.
-- =====================================================================

BEGIN;

CREATE TEMP TABLE _cibles ON COMMIT DROP AS
SELECT p.id AS personne_id,
       p.categorie_id AS ancienne_categorie_id,
       coalesce(ca.code, '(aucune)') AS ancienne,
       CASE WHEN p.qualites_ffr && array['RLSP']::text[] THEN 'RLSP' ELSE 'RLO' END AS cible
FROM public.personnes p
LEFT JOIN public.categories ca ON ca.id = p.categorie_id
WHERE NOT coalesce(p.est_archive, false)
  AND p.qualites_ffr && array['RLO', 'RLSP']::text[]
  AND NOT (p.qualites_ffr && array['A', 'AM', 'B']::text[]);

CREATE TEMP TABLE _staff_avant ON COMMIT DROP AS
SELECT cm.id FROM public.collectif_membre cm JOIN _cibles c ON c.personne_id = cm.personne_id
WHERE cm.role = 'staff' AND (cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE);

DO $garde$
DECLARE
  v_repartition text;
  v_n int;
BEGIN
  SELECT string_agg(ancienne || '>' || cible || '=' || n, ', ' ORDER BY ancienne, cible) INTO v_repartition
  FROM (SELECT ancienne, cible, count(*) n FROM _cibles GROUP BY 1, 2) t;
  IF v_repartition <> '(aucune)>RLO=2, (aucune)>RLSP=6, M19>RLSP=1, SR-F>RLO=3, SR-M>RLSP=20' THEN
    RAISE EXCEPTION 'GARDE: répartition inattendue (%), rien n''est modifié', v_repartition;
  END IF;
  SELECT count(*) INTO v_n FROM public.categories c
  JOIN public.ententes e ON e.categorie_id = c.id AND e.saison_id = public._pp_saison_active()
  WHERE c.code IN ('RLO', 'RLSP');
  IF v_n <> 2 THEN RAISE EXCEPTION 'GARDE: % entente(s) RLO/RLSP sur la saison au lieu de 2', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_trigger
  WHERE tgrelid = 'public.personnes'::regclass AND tgname = 'collectif_auto_inscrire' AND NOT tgisinternal;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GARDE: déclencheur sql_272 absent'; END IF;
  SELECT count(*) INTO v_n FROM public.collectif_membre cm JOIN _cibles c ON c.personne_id = cm.personne_id
  WHERE cm.role = 'joueur' AND cm.date_debut >= CURRENT_DATE;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GARDE: % adhésion(s) joueur commençant aujourd''hui, clôture à hier impossible', v_n; END IF;
END;
$garde$;

-- 1. Clôture des adhésions joueur dans l'ancienne entente.
CREATE TEMP TABLE _cloturees (id uuid) ON COMMIT DROP;
WITH clos AS (
  UPDATE public.collectif_membre cm
  SET date_fin = CURRENT_DATE - 1
  FROM _cibles c
  JOIN public.ententes e ON e.categorie_id = c.ancienne_categorie_id AND e.saison_id = public._pp_saison_active()
  WHERE cm.personne_id = c.personne_id
    AND cm.entente_id = e.id
    AND cm.role = 'joueur'
    AND (cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE)
  RETURNING cm.id)
INSERT INTO _cloturees SELECT id FROM clos;

DO $garde_clos$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM _cloturees;
  IF v_n <> 24 THEN RAISE EXCEPTION 'GARDE: % adhésion(s) clôturée(s) au lieu de 24', v_n; END IF;
END;
$garde_clos$;

-- 2. Reclassement (le déclencheur inscrit au collectif RLSP/RLO).
UPDATE public.personnes p
SET categorie_id = cat.id,
    pole_attache_id = cat.pole_id
FROM _cibles c
JOIN public.categories cat ON cat.code = c.cible
WHERE p.id = c.personne_id;

DO $verif$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM _cibles c
  JOIN public.personnes p ON p.id = c.personne_id
  JOIN public.categories cat ON cat.id = p.categorie_id AND cat.code = c.cible
  JOIN public.ententes e ON e.categorie_id = cat.id AND e.saison_id = public._pp_saison_active()
  JOIN public.collectif_membre cm ON cm.personne_id = p.id AND cm.entente_id = e.id
   AND cm.role = 'joueur' AND cm.date_fin IS NULL;
  IF v_n <> 32 THEN RAISE EXCEPTION 'VERIF: % fiche(s) en RLSP/RLO inscrites au lieu de 32', v_n; END IF;

  SELECT count(*) INTO v_n
  FROM _cibles c
  JOIN public.ententes e ON e.categorie_id = c.ancienne_categorie_id AND e.saison_id = public._pp_saison_active()
  JOIN public.collectif_membre cm ON cm.personne_id = c.personne_id AND cm.entente_id = e.id
   AND cm.role = 'joueur' AND (cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE);
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % adhésion(s) joueur encore active(s) dans l''ancienne entente', v_n; END IF;

  SELECT count(*) INTO v_n FROM _staff_avant s JOIN public.collectif_membre cm ON cm.id = s.id
  WHERE cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE;
  IF v_n <> (SELECT count(*) FROM _staff_avant) THEN RAISE EXCEPTION 'VERIF: adhésion staff modifiée'; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

-- ===== CONTRÔLE (dry-run uniquement) =====
DO $fin$ BEGIN RAISE EXCEPTION 'RESULTATS_DRYRUN: clôturées = % || staff préservées = % || pioche RLSP = % || pioche RLO = %',
  (SELECT count(*) FROM _cloturees),
  (SELECT count(*) FROM _staff_avant),
  (SELECT count(*) FROM public.collectif_membre cm JOIN public.ententes e ON e.id = cm.entente_id
     JOIN public.categories c ON c.id = e.categorie_id
   WHERE c.code = 'RLSP' AND e.saison_id = public._pp_saison_active() AND cm.role = 'joueur' AND cm.date_fin IS NULL),
  (SELECT count(*) FROM public.collectif_membre cm JOIN public.ententes e ON e.id = cm.entente_id
     JOIN public.categories c ON c.id = e.categorie_id
   WHERE c.code = 'RLO' AND e.saison_id = public._pp_saison_active() AND cm.role = 'joueur' AND cm.date_fin IS NULL);
END $fin$;

ROLLBACK;
