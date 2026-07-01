-- =====================================================================
-- sql_137_fusion_m5_dans_m6.sql
-- =====================================================================
-- OBJET
--   Fusionner la catégorie M5 (redondante) dans M6. Au club, il n'existe
--   pas de catégorie M5 en tant que telle : les « M5 » réels sont des M6.
--   Ce fichier bascule les 10 licenciés rangés en M5 vers M6, supprime la
--   ligne M5 de `categories`, et enrichit le libellé de M6.
--
-- FAIT ÉTABLI (sondes DS-1) :
--   - M5 = 87368eb7-b9c3-4d1a-8409-359007d6e6f9 (« Moins de 6 ans
--     (Premiers pas EDR) »), 10 personnes rattachées (licencies MOM
--     nés 2021/2022, source import-OVAL-E-automatique).
--   - M6 = 769ec967-016b-4e0a-a1a3-dade6deb61e0 (« Moins de 6 ans »),
--     3 personnes.
--   - M5 n'est référencée par AUCUNE table à categorie_id (ententes,
--     fonction_staff, planification_axes/blocs, demandes_bus,
--     reservations_logistiques/recurrentes = tous 0).
--   - M5 n'est PAS dans poles.categories_rattachees (pôle EDR =
--     M6,M8,M10,M12,M14). Rien à nettoyer côté pôle.
--   - _derive_bascule ne code aucune catégorie en dur (dérivation par
--     age_max + genre + rattachement pôle) : après suppression de M5,
--     les 2021/2022 seront dérivés vers M6 automatiquement. Aucune
--     correction de fonction nécessaire.
--   - Arbitrages Manu : A = supprimer la ligne M5 ; B = enrichir le
--     libellé M6 en « Moins de 6 ans (Premiers pas EDR) ».
--
-- ORDRE
--   1. UPDATE personnes : 10 fiches M5 -> M6
--   2. DELETE categories : ligne M5 (désormais orpheline)
--   3. UPDATE categories : libellé M6 enrichi
--
-- IDEMPOTENT : NON (suppression). Fail-loud + rollback si compte inattendu.
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;

-- Contrôle AVANT
DO $verif$
DECLARE
  v_m5 int;
  v_m6 int;
BEGIN
  v_m5 := (SELECT count(*) FROM personnes WHERE categorie_id = '87368eb7-b9c3-4d1a-8409-359007d6e6f9');
  v_m6 := (SELECT count(*) FROM personnes WHERE categorie_id = '769ec967-016b-4e0a-a1a3-dade6deb61e0');
  RAISE NOTICE 'sql_137 AVANT : M5=% personnes, M6=% personnes.', v_m5, v_m6;
  IF v_m5 <> 10 THEN
    RAISE EXCEPTION 'sql_137 ABORT : M5 = % personnes (attendu 10).', v_m5;
  END IF;
END
$verif$;

-- 1) Bascule des 10 personnes de M5 vers M6
UPDATE personnes
SET categorie_id = '769ec967-016b-4e0a-a1a3-dade6deb61e0',
    modifie_par  = 'sql_137_fusion_m5_m6'
WHERE categorie_id = '87368eb7-b9c3-4d1a-8409-359007d6e6f9';

-- 2) Suppression de la ligne M5 (orpheline : 0 personne, 0 référence)
DELETE FROM categories
WHERE id = '87368eb7-b9c3-4d1a-8409-359007d6e6f9';

-- 3) Enrichissement du libellé M6
UPDATE categories
SET libelle_long = 'Moins de 6 ans (Premiers pas EDR)'
WHERE id = '769ec967-016b-4e0a-a1a3-dade6deb61e0';

-- =====================================================================
-- Vérifications fail-loud
-- =====================================================================
DO $verif$
DECLARE
  v_m5_reste     int;
  v_m5_pers      int;
  v_m6_pers      int;
  v_m6_libelle   text;
BEGIN
  -- (1) la ligne M5 n'existe plus
  v_m5_reste := (SELECT count(*) FROM categories WHERE id = '87368eb7-b9c3-4d1a-8409-359007d6e6f9');
  IF v_m5_reste <> 0 THEN
    RAISE EXCEPTION 'sql_137 ÉCHEC : ligne M5 encore présente (attendu 0).';
  END IF;

  -- (2) plus aucune personne en M5
  v_m5_pers := (SELECT count(*) FROM personnes WHERE categorie_id = '87368eb7-b9c3-4d1a-8409-359007d6e6f9');
  IF v_m5_pers <> 0 THEN
    RAISE EXCEPTION 'sql_137 ÉCHEC : % personne(s) encore en M5 (attendu 0).', v_m5_pers;
  END IF;

  -- (3) M6 compte désormais 13 personnes (3 + 10)
  v_m6_pers := (SELECT count(*) FROM personnes WHERE categorie_id = '769ec967-016b-4e0a-a1a3-dade6deb61e0');
  IF v_m6_pers <> 13 THEN
    RAISE EXCEPTION 'sql_137 ÉCHEC : M6 = % personnes (attendu 13).', v_m6_pers;
  END IF;

  -- (4) libellé M6 enrichi
  v_m6_libelle := (SELECT libelle_long FROM categories WHERE id = '769ec967-016b-4e0a-a1a3-dade6deb61e0');
  IF v_m6_libelle <> 'Moins de 6 ans (Premiers pas EDR)' THEN
    RAISE EXCEPTION 'sql_137 ÉCHEC : libellé M6 = "%" (attendu "Moins de 6 ans (Premiers pas EDR)").', v_m6_libelle;
  END IF;

  RAISE NOTICE 'sql_137 OK : M5 supprimée, 10 basculés, M6 = 13 personnes, libellé enrichi.';
END
$verif$;

COMMIT;
