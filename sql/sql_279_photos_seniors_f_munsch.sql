-- =====================================================================
-- sql_279 — Photos seniors F (36) + fiche HAYET → MUNSCH Aline
-- Demande de Manu (20/11/2026) : « même traitement » que les seniors H.
-- Photos : recadrage visage 900×1150 homogène (v2), fond blanc ; chargées
-- par Claude dans photos-joueurs/photos/<uuid>.jpg (36/36 vérifiés).
-- Décisions de Manu (20/11/2026) :
--   - LEOFFLER Typhanie / ITTEL Lidie / NUSS Alexia = fichiers mal nommés ;
--     la fiche Hub fait foi (LOEFFLER, ITTEL Lydie, NUSS WINTERMANTEL).
--   - « MUNSCH Aline » = fiche HAYET Aline (01d37f64, SR-F) : nom marital de
--     la licence ; divorcée, elle souhaite retrouver MUNSCH → nom de la fiche
--     renommé MUNSCH. Sans effet sur l'import OVAL-E (rapprochement par
--     numéro de licence, nom jamais réécrit — vérifié sql_255).
--   - Rugby MOM-22, Rugby MOM-34 (sans nom) et HOMO Suzon (aucune fiche) :
--     laissés de côté pour l'instant.
--   - Droit à l'image « photos individuelles » : accord confirmé par Manu
--     pour les 36 personnes photographiées (joueuses SR-F, 3 RLO, 2 éducateurs).
-- Choix techniques (délégation, tracés) : GATINOIS Valerie → fiche joueuse
-- SR-F 26fbeb6c (doublon « non licenciée » 1477608e non touché) ;
-- personnes_photos rang 1, courante, dérivée du bucket réel.
-- =====================================================================

BEGIN;

-- 1. HAYET Aline → MUNSCH Aline (nom de naissance retrouvé)
UPDATE public.personnes
SET nom = 'MUNSCH', modifie_par = 'sql_279'
WHERE id = '01d37f64-4df0-47ff-901d-00b5a6aed9fa' AND nom = 'HAYET';

-- 2. Table figée des 36 photos
CREATE TEMP TABLE _photos_279 (personne_id uuid PRIMARY KEY, source text) ON COMMIT DROP;
INSERT INTO _photos_279 VALUES
    ('7fb84d4d-8607-458f-9e25-61d55d8fef7a'::uuid, 'ALVIANI Magali'),
    ('3431ca7e-9122-4cd7-8b9a-5d93c9caee24'::uuid, 'ARBOGAST Leanne'),
    ('5efd74f3-703e-4f82-a39c-21768e11b443'::uuid, 'BARDOT Emilie'),
    ('4e927246-2b4b-4df5-b4c2-ec236d126108'::uuid, 'BECKER Roxane'),
    ('9ef4123e-9ef4-415a-b38d-d3389965cad0'::uuid, 'BRUN Mathilde'),
    ('624d7a5a-8007-444c-94ab-c3069cc92d1d'::uuid, 'CALMES Sarah'),
    ('0c638a5f-c20c-433f-bae2-274660533a88'::uuid, 'DE BRUYNE Elisa'),
    ('6ac9a86e-8f67-4e34-984b-d795fca30c51'::uuid, 'DECOURCELLE Jeanne'),
    ('05a4940b-5c73-461b-b147-5798f0b53408'::uuid, 'DUCHESNE Sophie'),
    ('045cc219-dc48-4e8b-8ca6-0ecfc145ddcb'::uuid, 'GANGLOFF Claire'),
    ('26fbeb6c-ab37-4934-b6a5-d6dea6f5367d'::uuid, 'GATINOIS Valerie'),
    ('4c03e0fc-7261-4122-8394-073c118aeb7e'::uuid, 'GRENADIN Axelle'),
    ('0c17a76d-82ab-41af-bc91-219a270920b1'::uuid, 'HARTMANN Maya'),
    ('77483eed-180e-4138-88b5-7df1f0a7b06f'::uuid, 'HOMO Hugues'),
    ('b3d74d46-951c-40fb-8f2e-8d0ef47c231a'::uuid, 'HORENT Laura'),
    ('0fb7972b-3327-4a6a-89ca-514802ddacb2'::uuid, 'HUGEL Adeline'),
    ('c81eb580-d210-411b-b2a5-c5ba11a40081'::uuid, 'ITTEL Lidie'),
    ('a1a3ae3d-ed31-453e-8759-c946ac8d2d78'::uuid, 'JAN Camille'),
    ('2777a8c2-4a1f-4a76-bcb9-0cf95f39aa0d'::uuid, 'KEDZIERSKI STEGER Geraldine'),
    ('90e370a4-cf26-4e05-ab29-27d72aef7db9'::uuid, 'LACOMBE Jean-Emmanuel'),
    ('0f074576-2ede-423e-9f5c-0dcc9fc6edac'::uuid, 'LAMPIN Julianne'),
    ('b3b39859-a4be-4244-b1b7-4604721183cc'::uuid, 'LE GUERNEVÉ Adeline'),
    ('9fbcfdc5-db5b-4c0b-997e-6a8c675a90ae'::uuid, 'LEOFFLER Typhanie'),
    ('b97f7d05-938b-463b-a3af-494d46893132'::uuid, 'LUCENA Clemence'),
    ('811c8469-1be5-46d2-b557-a14391aa5a9f'::uuid, 'MARTIN Valentine'),
    ('7f54fba7-d529-45f7-b7af-29c33cc440b7'::uuid, 'MOREL Lisa'),
    ('01d37f64-4df0-47ff-901d-00b5a6aed9fa'::uuid, 'MUNSCH Aline'),
    ('17784b43-f6fa-438d-9174-95ad9a73ded4'::uuid, 'MUNSCH Marie'),
    ('84f8738b-0ace-4d2b-863f-d4f01c6fc993'::uuid, 'NARES Allison'),
    ('80817a4e-8aa0-43e4-9c60-63899ba8290d'::uuid, 'NUSS Alexia'),
    ('82bd7a52-6f7c-409a-a962-e3aba56b032c'::uuid, 'ROEDER Constance'),
    ('d464affe-2f47-4a03-9a5e-03e08b53d4a2'::uuid, 'SACKSTEDER Lea'),
    ('06f13c24-37bc-41b5-b8e5-cbddafb9b6e8'::uuid, 'SAUVADET Anna'),
    ('5f92d224-9a6a-4753-b807-fcc2c15caa9e'::uuid, 'STEGER Melanie'),
    ('88853450-ff9e-43d4-95f8-186bdad599e2'::uuid, 'VAUTIER Sabrina'),
    ('e7e979ae-b424-475a-9d2e-33e9d2a12b61'::uuid, 'VOEGELI Lorene');

-- 3. Droit à l'image « photos individuelles » (accord confirmé par Manu)
UPDATE public.personnes p
SET droit_image_photos_individuelles = true, modifie_par = 'sql_279'
FROM _photos_279 t
WHERE p.id = t.personne_id
  AND p.droit_image_photos_individuelles IS DISTINCT FROM true;

-- 4. Photos courantes, dérivées du bucket réel
INSERT INTO public.personnes_photos (personne_id, path, rang, est_courante, created_by)
SELECT t.personne_id, o.name, 1, true, 'sql_279-photos-seniors-f'
FROM _photos_279 t
JOIN storage.objects o
  ON o.bucket_id = 'photos-joueurs' AND o.name = 'photos/' || t.personne_id || '.jpg'
WHERE NOT EXISTS (SELECT 1 FROM public.personnes_photos ph
                  WHERE ph.personne_id = t.personne_id AND ph.est_courante);

DO $verif$
DECLARE v_obj int; v_ph int; v_droit int; v_nom text;
BEGIN
  SELECT count(*) INTO v_obj FROM _photos_279 t JOIN storage.objects o
    ON o.bucket_id = 'photos-joueurs' AND o.name = 'photos/' || t.personne_id || '.jpg';
  SELECT count(*) INTO v_ph FROM public.personnes_photos ph JOIN _photos_279 t USING (personne_id)
    WHERE ph.est_courante AND ph.path = 'photos/' || t.personne_id || '.jpg';
  SELECT count(*) INTO v_droit FROM public.personnes p JOIN _photos_279 t ON t.personne_id = p.id
    WHERE p.droit_image_photos_individuelles;
  SELECT nom INTO v_nom FROM public.personnes WHERE id = '01d37f64-4df0-47ff-901d-00b5a6aed9fa';
  IF v_obj <> 36 THEN RAISE EXCEPTION 'FAIL: % fichiers sur 36 dans le bucket', v_obj; END IF;
  IF v_ph <> 36 THEN RAISE EXCEPTION 'FAIL: % photos courantes sur 36', v_ph; END IF;
  IF v_droit <> 36 THEN RAISE EXCEPTION 'FAIL: % droits image sur 36', v_droit; END IF;
  IF v_nom <> 'MUNSCH' THEN RAISE EXCEPTION 'FAIL: nom MUNSCH non appliqué (%)', v_nom; END IF;
  RAISE NOTICE 'sql_279 OK : 36 photos, 36 droits, MUNSCH Aline';
END
$verif$;

COMMIT;
