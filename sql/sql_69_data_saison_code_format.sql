-- ============================================================================
-- MOM Hub · Dette DATA-SAISON-CODE-FORMAT 🟢 — correction format code saison
-- Fichier : sql/69 — Aligner le code saison 2025-2026 sur le format FFR (slash)
-- ----------------------------------------------------------------------------
-- Origine : dette tracée STATE pt 27 (révélée par la sonde contenu de la
--   réconciliation SCHEMA-SAISON-DRIFT). La règle 4 FFR impose le séparateur
--   SLASH pour les millésimes de saison (« 2025/2026 »), or la saison 2025-2026
--   porte un code/libelle à TIRETS, incohérent avec 2026/2027 (déjà au slash).
--
-- Sondes à la source (méthode pt 14, base fait foi) — closes avant écriture :
--   S1 : SELECT saisons -> 2 lignes. 2025-2026 (code='2025-2026', libelle=
--        'Saison 2025-2026', date_debut 2025-07-01) = TIRETS ; 2026/2027
--        (code='2026/2027') = déjà SLASH. Une seule ligne à corriger.
--   S2 : sql/53 _derive_bascule (L195) dérive l'année de date_debut via
--        extract(year FROM date_debut), JAMAIS du code -> changer le code
--        saison n'a AUCUN impact sur la bascule (vérifié à la source).
--        Les c.code/cat.code de sql/53 sont des codes de CATÉGORIES, pas de saisons.
--   S3 : saisons porte UNIQUE(code) (sql/53 L20). 2025-2026 -> 2025/2026 ne
--        collisionne pas avec 2026/2027. Aucune autre table ne joint sur
--        saisons.code (les FK pointent saisons.id uuid, pas le code).
--
-- Décision (à confirmer Manu) : on aligne CODE *et* LIBELLE sur le slash, pour
--   cohérence visuelle avec 2026/2027. Si seul le code doit changer, retirer la
--   ligne libelle de l'UPDATE.
--
-- Idempotent / fail-loud :
--   - UPDATE ciblé sur le SEUL code à tirets attendu (WHERE code='2025-2026') ;
--     rejouer après correction ne touche plus rien (0 ligne).
--   - Garde anti-collision UNIQUE(code) implicite (la base lèverait sinon).
--   - Cadrage PRE/POST recollé (fail-loud par construction du bloc DO).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_avant int;
  v_apres int;
  v_restant int;
BEGIN
  -- PRE : combien de lignes au format tiret « AAAA-AAAA » (millésime) ?
  SELECT count(*) INTO v_avant
  FROM public.saisons
  WHERE code = '2025-2026';
  RAISE NOTICE 'PRE : % ligne(s) code=2025-2026 (tiret) à corriger', v_avant;

  -- UPDATE ciblé : code + libelle tiret -> slash
  UPDATE public.saisons
     SET code    = '2025/2026',
         libelle = 'Saison 2025/2026'
   WHERE code = '2025-2026';

  GET DIAGNOSTICS v_apres = ROW_COUNT;
  RAISE NOTICE 'UPDATE : % ligne(s) corrigée(s)', v_apres;

  -- POST : plus aucune saison au format millésime à tiret ?
  -- (motif strict AAAA-AAAA ; ne capture pas un éventuel autre usage de tiret)
  SELECT count(*) INTO v_restant
  FROM public.saisons
  WHERE code ~ '^\d{4}-\d{4}$';
  IF v_restant > 0 THEN
    RAISE EXCEPTION 'POST échec : % saison(s) encore au format millésime tiret', v_restant;
  END IF;
  RAISE NOTICE 'POST OK : 0 saison au format millésime tiret restante';
END $$;

-- Contrôle final (hors DO) : visualiser le résultat
SELECT id, code, libelle, date_debut, est_active
FROM public.saisons
ORDER BY date_debut;
-- attendu : 2025/2026 (Saison 2025/2026) + 2026/2027 (Saison 2026/2027), tous slash

COMMIT;

-- ============================================================================
-- Vérification post-exécution :
--   SELECT code, libelle FROM public.saisons ORDER BY date_debut;
--   -- attendu : '2025/2026' | 'Saison 2025/2026'  ET  '2026/2027' | 'Saison 2026/2027'
--   SELECT count(*) FROM public.saisons WHERE code ~ '^\d{4}-\d{4}$';  -- attendu : 0
-- Aucun impact bascule (S2 : _derive_bascule dérive de date_debut, pas du code).
-- ============================================================================
