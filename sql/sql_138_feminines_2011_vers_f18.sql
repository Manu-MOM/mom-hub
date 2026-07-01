-- =====================================================================
-- sql_138_feminines_2011_vers_f18.sql
-- =====================================================================
-- OBJET
--   Basculer 4 féminines nées 2011 (BES, FAUVEL, MARTIN, TRENDEL) de
--   « M14 mixte + f15_integree » vers « F18 pur ». Elles sortent de
--   l'équipe M14 : changement de catégorie + retrait du flag F15 +
--   clôture de l'attache equipe_joueurs M14.
--
-- FAIT ÉTABLI (sondes DS-1) :
--   - Les 4 sont actuellement categorie_id = M14 (312ebb88…),
--     f15_integree = true.
--   - Modèle Hub confirmé (code pt 109) : F15 n'est PAS une catégorie
--     physique ; la double appartenance « F15 ET M14 » = categorie_id
--     M14 + f15_integree=true. Il n'existe AUCUN équivalent f18_integree.
--     Donc « F18 pur » = categorie_id F18 + f15_integree=false + sortie
--     de l'équipe M14.
--   - Les 4 ont une attache equipe_joueurs ACTIVE (equipe SAR/MOM-M14-1
--     bfb83b83…, date_affectation 2025-09-01, date_sortie NULL,
--     statut regulier).
--   - F18 = 07be594d-bb70-4858-8490-ad009d22dc6d (genre F, age_max 18).
--   - Décision Manu : F18 pur (sortent de M14). Les 4 autres féminines
--     (2012/2013) restent M14 + f15_integree (déjà bon modèle F15∩M14).
--
-- CHOIX TRACÉ (décision technique mineure) :
--   date_sortie = 2026-07-31 (fin de la saison 2025/2026 où l'attache
--   était valide). Préserve l'historique : M14 jusqu'à fin 2025/2026,
--   F18 à partir de 2026/2027.
--
-- IDEMPOTENT : NON. Fail-loud + rollback si compte inattendu.
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;

-- Contrôle AVANT
DO $verif$
DECLARE
  v_m14 int;
  v_att int;
BEGIN
  v_m14 := (SELECT count(*) FROM personnes
            WHERE id IN (
              '895238dc-ded6-4315-bcd0-3361a80f3ff3',
              '800fd121-26c7-408a-b10c-98a4c4079e02',
              '2371c6a3-8a13-4ca0-9097-aad56105b362',
              '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
              AND categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
              AND f15_integree = true);
  v_att := (SELECT count(*) FROM equipe_joueurs
            WHERE personne_id IN (
              '895238dc-ded6-4315-bcd0-3361a80f3ff3',
              '800fd121-26c7-408a-b10c-98a4c4079e02',
              '2371c6a3-8a13-4ca0-9097-aad56105b362',
              '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
              AND date_sortie IS NULL);
  RAISE NOTICE 'sql_138 AVANT : % fiches M14+f15 (attendu 4), % attaches actives (attendu 4).',
    v_m14, v_att;
  IF v_m14 <> 4 THEN
    RAISE EXCEPTION 'sql_138 ABORT : % fiches en M14+f15 au lieu de 4.', v_m14;
  END IF;
END
$verif$;

-- 1) Catégorie -> F18 + retrait du flag F15
UPDATE personnes
SET categorie_id = '07be594d-bb70-4858-8490-ad009d22dc6d',
    f15_integree = false,
    modifie_par  = 'sql_138_feminines_2011_f18'
WHERE id IN (
  '895238dc-ded6-4315-bcd0-3361a80f3ff3',
  '800fd121-26c7-408a-b10c-98a4c4079e02',
  '2371c6a3-8a13-4ca0-9097-aad56105b362',
  '87ddde1f-4f7c-4b0c-8129-fcd90a43e097'
);

-- 2) Clôture des attaches equipe_joueurs M14 (fin de saison 2025/2026)
UPDATE equipe_joueurs
SET date_sortie = DATE '2026-07-31',
    updated_at  = now()
WHERE personne_id IN (
  '895238dc-ded6-4315-bcd0-3361a80f3ff3',
  '800fd121-26c7-408a-b10c-98a4c4079e02',
  '2371c6a3-8a13-4ca0-9097-aad56105b362',
  '87ddde1f-4f7c-4b0c-8129-fcd90a43e097'
)
AND date_sortie IS NULL;

-- =====================================================================
-- Vérifications fail-loud
-- =====================================================================
DO $verif$
DECLARE
  v_f18       int;
  v_flag_on   int;
  v_att_open  int;
  v_m14_reste int;
BEGIN
  -- (1) les 4 sont en F18
  v_f18 := (SELECT count(*) FROM personnes
            WHERE id IN (
              '895238dc-ded6-4315-bcd0-3361a80f3ff3',
              '800fd121-26c7-408a-b10c-98a4c4079e02',
              '2371c6a3-8a13-4ca0-9097-aad56105b362',
              '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
              AND categorie_id = '07be594d-bb70-4858-8490-ad009d22dc6d');
  IF v_f18 <> 4 THEN
    RAISE EXCEPTION 'sql_138 ÉCHEC : % en F18 (attendu 4).', v_f18;
  END IF;

  -- (2) flag F15 retiré sur les 4
  v_flag_on := (SELECT count(*) FROM personnes
                WHERE id IN (
                  '895238dc-ded6-4315-bcd0-3361a80f3ff3',
                  '800fd121-26c7-408a-b10c-98a4c4079e02',
                  '2371c6a3-8a13-4ca0-9097-aad56105b362',
                  '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
                  AND f15_integree = true);
  IF v_flag_on <> 0 THEN
    RAISE EXCEPTION 'sql_138 ÉCHEC : % gardent f15_integree=true (attendu 0).', v_flag_on;
  END IF;

  -- (3) plus d'attache equipe_joueurs ouverte pour ces 4
  v_att_open := (SELECT count(*) FROM equipe_joueurs
                 WHERE personne_id IN (
                   '895238dc-ded6-4315-bcd0-3361a80f3ff3',
                   '800fd121-26c7-408a-b10c-98a4c4079e02',
                   '2371c6a3-8a13-4ca0-9097-aad56105b362',
                   '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
                   AND date_sortie IS NULL);
  IF v_att_open <> 0 THEN
    RAISE EXCEPTION 'sql_138 ÉCHEC : % attache(s) M14 encore ouverte(s) (attendu 0).', v_att_open;
  END IF;

  RAISE NOTICE 'sql_138 OK : 4 féminines 2011 en F18 pur, flag F15 retiré, attaches M14 clôturées au 2026-07-31.';
END
$verif$;

COMMIT;
