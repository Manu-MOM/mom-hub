-- ============================================================================
-- sql/55-amorcage-joueurs-collectif-membre.sql
-- ----------------------------------------------------------------------------
-- OBJET
--   Amorcer (rattacher au collectif, couche N1 `collectif_membre`) tous les
--   joueurs déjà présents dans `personnes` mais non encore amorcés — c.-à-d.
--   toutes les catégories SAUF la M14, déjà amorcée au pt 15 par `sql/48`.
--
-- PÉRIMÈTRE (décision Manu)
--   - Joueurs de TOUT le club. La M14 (62 lignes déjà en base) n'est PAS
--     retouchée (double garde ci-dessous) ; 1 nouvelle M14 légitime
--     (DECOURCELLE Auriane) sera amorcée -> M14 passe à 63.
--   - Catégorie des joueurs = celle DÉJÀ en base (`personnes.categorie_id`),
--     AUCUN recalcul par millésime.
--   - Le staff est traité dans un SECOND temps (liste Manu), PAS ici.
--
-- ENCODAGE (répliqué à l'identique des M14 existants — sondes 1->4 à la source)
--   role        = 'joueur'        (CHECK role IN ('joueur','staff'))
--   statut      = 'regulier'      (CHECK statut IN regulier/renfort_temporaire/en_transition)
--   date_debut  = DATE '2025-09-01'  (FIXE, déterministe, idempotent ; option A
--                                      Manu, aligné sur les 23 M14 historiques)
--   date_fin    = NULL             (membre actif ; CHECK date_fin>=date_debut OK)
--   cree_par    = NULL             (alignement pattern projet, FK nullable)
--   entente_id  = entente UNIQUE de la catégorie du joueur, saison 2025-2026
--                 (sonde 4 : mapping catégorie -> entente BIJECTIF, 11/11 = 1)
--
-- CIBLE DU CONFLIT (sonde 2 / 2bis : unique index réel)
--   collectif_membre_unique = (personne_id, entente_id, role, date_debut)
--
-- DOUBLE GARDE ANTI-DOUBLON (leçon pt 15 : 31 doublons créés faute de vérif)
--   1) NOT EXISTS : on n'insère un joueur QUE s'il n'a AUCUNE ligne
--      role='joueur' ACTIVE (date_fin IS NULL) sur SON entente — protège les
--      62 M14 quelle que soit leur date_debut (09-01 OU 05-13), plus robuste
--      que le seul ON CONFLICT (date_debut fait partie de la clé unique).
--   2) ON CONFLICT (...) DO NOTHING : filet sur la clé exacte.
--
-- NON AMORCÉS PAR CONSTRUCTION (catégories SANS entente MOM — correct métier)
--   - M5  (87368eb7-…) : éveil/découverte, "pas de compétition au sens strict"
--     -> aucune entente -> 9 joueurs NON amorcés (attendu).
--   - F18 (07be594d-…) : "regroupements externes gérés par le comité dép."
--     -> aucune entente MOM -> 5 joueuses NON amorcées (attendu).
--   Total 14 non amorcés = volontaire, mesuré nommément au cadrage PRE/POST.
--
-- DETTE TRACÉE (hors périmètre de cet amorçage)
--   Doublons d'IDENTITÉ joueur/staff : certains individus ont DEUX fiches
--   `personnes` distinctes (une 'joueur' avec catégorie, une 'staff' sans),
--   p.ex. BELKIS Anne / HELM Loic / VOEGELI Lorene. Chaque fiche est amorcée
--   pour ce qu'elle est (joueur ici, staff étape 3) -> l'individu apparaîtra
--   2x dans le collectif tant que les fiches ne sont pas fusionnées. À traiter
--   en passe de fusion d'identité dédiée (cf. IDENT-SYS). NON résolu ici.
--
-- IDEMPOTENT : ré-exécutable sans effet (les deux gardes le garantissent).
-- FAIL-LOUD : cadrage PRE (mesures) + POST (invariants d'état-cible). Si une
--   invariante casse, RAISE EXCEPTION -> ROLLBACK de toute la transaction.
--   Patron : sql/48 / sql/49 / sql/50 / sql/51.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- CADRAGE PRE (mesures à la source, AVANT insertion) — recoller la sortie
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_joueurs_total    integer;  -- joueurs dans personnes (attendu 302)
  v_joueurs_sans_cat integer;  -- joueurs sans categorie_id (anomalie, attendu 0)
  v_m5               integer;  -- joueurs M5 (sans entente, attendu 9, NON amorcés)
  v_f18              integer;  -- joueuses F18 (sans entente, attendu 5, NON amorcées)
  v_cat_sans_ent_tot integer;  -- total joueurs categorie sans entente (attendu 14)
  v_cm_joueurs_avant integer;  -- lignes joueur en N1 avant
  v_m14_avant        integer;  -- lignes joueur ENTENTE-M14 avant (attendu 62)
  v_amorcables       integer;  -- joueurs qui SERONT amorcés (attendu 226)
BEGIN
  SELECT COUNT(*) INTO v_joueurs_total
  FROM public.personnes p WHERE p.categorie_personne ILIKE '%joueur%';

  SELECT COUNT(*) INTO v_joueurs_sans_cat
  FROM public.personnes p
  WHERE p.categorie_personne ILIKE '%joueur%' AND p.categorie_id IS NULL;

  SELECT COUNT(*) INTO v_m5
  FROM public.personnes p
  WHERE p.categorie_personne ILIKE '%joueur%'
    AND p.categorie_id = '87368eb7-b9c3-4d1a-8409-359007d6e6f9';

  SELECT COUNT(*) INTO v_f18
  FROM public.personnes p
  WHERE p.categorie_personne ILIKE '%joueur%'
    AND p.categorie_id = '07be594d-bb70-4858-8490-ad009d22dc6d';

  SELECT COUNT(*) INTO v_cat_sans_ent_tot
  FROM public.personnes p
  WHERE p.categorie_personne ILIKE '%joueur%'
    AND p.categorie_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.ententes e WHERE e.categorie_id = p.categorie_id);

  SELECT COUNT(*) INTO v_cm_joueurs_avant
  FROM public.collectif_membre WHERE role = 'joueur';

  SELECT COUNT(*) INTO v_m14_avant
  FROM public.collectif_membre cm
  JOIN public.ententes e ON e.id = cm.entente_id
  WHERE cm.role = 'joueur' AND e.code = 'ENTENTE-M14-2025-2026';

  SELECT COUNT(*) INTO v_amorcables
  FROM public.personnes p
  JOIN public.ententes e ON e.categorie_id = p.categorie_id
  WHERE p.categorie_personne ILIKE '%joueur%'
    AND p.categorie_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.collectif_membre cm
      WHERE cm.personne_id = p.id AND cm.entente_id = e.id
        AND cm.role = 'joueur' AND cm.date_fin IS NULL);

  RAISE NOTICE '=== CADRAGE PRE (sql/55) ===';
  RAISE NOTICE 'joueurs (personnes)                 : %  (attendu 302)', v_joueurs_total;
  RAISE NOTICE '  dont SANS categorie_id (anomalie) : %  (attendu 0)',   v_joueurs_sans_cat;
  RAISE NOTICE '  dont M5  (sans entente, NON amorcé): % (attendu 9)',   v_m5;
  RAISE NOTICE '  dont F18 (sans entente, NON amorcé): % (attendu 5)',   v_f18;
  RAISE NOTICE '  dont categorie sans entente (tot) : %  (attendu 14)',  v_cat_sans_ent_tot;
  RAISE NOTICE 'collectif_membre role=joueur (avant): %', v_cm_joueurs_avant;
  RAISE NOTICE '  dont ENTENTE-M14 (avant)          : %  (attendu 62)',  v_m14_avant;
  RAISE NOTICE 'joueurs A AMORCER (this run)        : %  (attendu 226)', v_amorcables;

  -- Garde douce : M5+F18 doivent expliquer tous les non-mappés (sinon catégorie
  -- sans entente inattendue -> on veut le savoir AVANT d'écrire).
  IF v_cat_sans_ent_tot <> (v_m5 + v_f18) THEN
    RAISE EXCEPTION 'PRE KO : % joueur(s) sans entente hors M5/F18 — catégorie inattendue à instruire avant amorçage', v_cat_sans_ent_tot - (v_m5 + v_f18);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- INSERTION — amorçage des joueurs non encore rattachés
-- ----------------------------------------------------------------------------
INSERT INTO public.collectif_membre
  (personne_id, entente_id, role, statut, date_debut, date_fin, cree_par)
SELECT
  p.id, e.id, 'joueur', 'regulier', DATE '2025-09-01', NULL, NULL
FROM public.personnes p
JOIN public.ententes e
  ON e.categorie_id = p.categorie_id          -- mapping bijectif (sonde 4)
WHERE p.categorie_personne ILIKE '%joueur%'
  AND p.categorie_id IS NOT NULL
  AND NOT EXISTS (                             -- GARDE 1 : aucun joueur actif sur cette entente
    SELECT 1 FROM public.collectif_membre cm
    WHERE cm.personne_id = p.id AND cm.entente_id = e.id
      AND cm.role = 'joueur' AND cm.date_fin IS NULL)
ON CONFLICT (personne_id, entente_id, role, date_debut) DO NOTHING;  -- GARDE 2

-- ----------------------------------------------------------------------------
-- CADRAGE POST (invariants d'état-cible, APRÈS insertion) — fail-loud
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_m14_apres        integer;
  v_doublons_actifs  integer;
  v_statut_hors      integer;
  v_cm_joueurs_apres integer;
  v_m5_amorces       integer;
  v_f18_amorces      integer;
BEGIN
  -- Invariant 1 : les 62 M14 préexistants intacts + DECOURCELLE Auriane (=63),
  -- jamais moins de 62 (protégés par NOT EXISTS), pas de M14 supprimé.
  SELECT COUNT(*) INTO v_m14_apres
  FROM public.collectif_membre cm
  JOIN public.ententes e ON e.id = cm.entente_id
  WHERE cm.role = 'joueur' AND e.code = 'ENTENTE-M14-2025-2026';

  IF v_m14_apres < 62 THEN
    RAISE EXCEPTION 'POST KO : ENTENTE-M14 = % (< 62, M14 préexistant retouché !)', v_m14_apres;
  END IF;

  -- Invariant 2 : AUCUN joueur >1 ligne ACTIVE sur une même entente.
  SELECT COUNT(*) INTO v_doublons_actifs
  FROM (
    SELECT personne_id, entente_id
    FROM public.collectif_membre
    WHERE role = 'joueur' AND date_fin IS NULL
    GROUP BY personne_id, entente_id HAVING COUNT(*) > 1
  ) d;
  IF v_doublons_actifs <> 0 THEN
    RAISE EXCEPTION 'POST KO : % doublon(s) joueur actif sur une même entente', v_doublons_actifs;
  END IF;

  -- Invariant 3 : lignes 2025-09-01 toutes statut='regulier'.
  SELECT COUNT(*) INTO v_statut_hors
  FROM public.collectif_membre
  WHERE role = 'joueur' AND date_debut = DATE '2025-09-01'
    AND (statut IS DISTINCT FROM 'regulier');
  IF v_statut_hors <> 0 THEN
    RAISE EXCEPTION 'POST KO : % ligne(s) 2025-09-01 statut != regulier', v_statut_hors;
  END IF;

  -- Invariant 4 : M5 et F18 NON amorcés (0 ligne joueur active sur ces catégories).
  SELECT COUNT(*) INTO v_m5_amorces
  FROM public.collectif_membre cm
  JOIN public.personnes p ON p.id = cm.personne_id
  WHERE cm.role = 'joueur' AND cm.date_fin IS NULL
    AND p.categorie_id = '87368eb7-b9c3-4d1a-8409-359007d6e6f9';
  SELECT COUNT(*) INTO v_f18_amorces
  FROM public.collectif_membre cm
  JOIN public.personnes p ON p.id = cm.personne_id
  WHERE cm.role = 'joueur' AND cm.date_fin IS NULL
    AND p.categorie_id = '07be594d-bb70-4858-8490-ad009d22dc6d';
  IF (v_m5_amorces + v_f18_amorces) <> 0 THEN
    RAISE EXCEPTION 'POST KO : % joueur(s) M5/F18 amorcé(s) alors que sans entente (M5=%, F18=%)',
      v_m5_amorces + v_f18_amorces, v_m5_amorces, v_f18_amorces;
  END IF;

  SELECT COUNT(*) INTO v_cm_joueurs_apres
  FROM public.collectif_membre WHERE role = 'joueur';

  RAISE NOTICE '=== CADRAGE POST (sql/55) — OK ===';
  RAISE NOTICE 'ENTENTE-M14 joueur (>=62, attendu 63): %', v_m14_apres;
  RAISE NOTICE 'doublons joueur actifs (=0)          : %', v_doublons_actifs;
  RAISE NOTICE 'M5/F18 amorcés (=0, attendu)         : % / %', v_m5_amorces, v_f18_amorces;
  RAISE NOTICE 'collectif_membre role=joueur (après) : %', v_cm_joueurs_apres;
END $$;

COMMIT;

-- ============================================================================
-- VÉRIFICATION POST-COMMIT (exécuter SÉPARÉMENT, recoller pour la recette)
-- ----------------------------------------------------------------------------
-- A) Répartition des joueurs amorcés par entente :
-- SELECT e.code, COUNT(*) AS n
-- FROM public.collectif_membre cm
-- JOIN public.ententes e ON e.id = cm.entente_id
-- WHERE cm.role = 'joueur'
-- GROUP BY e.code ORDER BY e.code;
--
-- B) Joueurs NON amorcés (doit = M5 + F18 = 14) :
-- SELECT p.nom, p.prenom, c.code AS categorie
-- FROM public.personnes p
-- JOIN public.categories c ON c.id = p.categorie_id
-- WHERE p.categorie_personne ILIKE '%joueur%'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.collectif_membre cm
--     WHERE cm.personne_id = p.id AND cm.role = 'joueur' AND cm.date_fin IS NULL)
-- ORDER BY c.code, p.nom, p.prenom;
-- ============================================================================
