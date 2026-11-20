-- =====================================================================
-- sql_276 — Photos seniors (54) + fiche CLAR Jerome + MALOSSANE au staff SR-M
-- Retour terrain Lohann HUMBERT (20/11/2026) : ajouter les photos de ses joueurs.
-- Décisions de Manu (20/11/2026) :
--   - ANDREI Cyprian / BERHA Tom / NOLSIER Leonard = fichiers mal nommés ;
--     la fiche Hub fait foi (ANDREI Ciprian, BEHRA Tom, NOSLIER Leonard).
--   - CLAR Jerome : créer sa fiche (double licence descendante, autre club).
--   - MALOSSANE Adrien : intégré au staff SR-M « pour l'instant ».
--   - Droit à l'image « photos individuelles » : accord confirmé par Manu
--     pour les 54 joueurs photographiés.
-- Choix techniques (délégation, tracés) :
--   - CLAR : licencie_competition SR-M, uuid fixé à l'avance (nom du fichier
--     bucket), club principal / qualité FFR / n° licence inconnus -> NULL
--     (à compléter par l'import OVAL-E) ; le déclencheur collectif_auto
--     l'inscrit au collectif SR-M.
--   - MALOSSANE : fiche « dirigeant » ff3aea6a (codes OVAL-E AN2/DC4) ;
--     le doublon « externe partenaire » d157ecd1 n'est pas touché (à purger
--     dans un chantier dédié) ; inscription collectif SR-M role='staff'.
--   - personnes_photos : rang 1 (photo unique), est_courante, créé seulement
--     si l'objet existe dans le bucket (dérivé du bucket réel, comme sql M16).
-- PRÉREQUIS : les 54 fichiers photos/<uuid>.jpg chargés dans photos-joueurs.
-- =====================================================================

BEGIN;

-- 1. Fiche CLAR Jerome
INSERT INTO public.personnes (id, categorie_personne, nom, prenom, sexe, type_personne,
                              categorie_id, source_creation, modifie_par)
SELECT '1ace368e-6007-4c6c-afd2-1fbc154a5aef'::uuid, 'joueur', 'CLAR', 'Jerome', 'M', 'licencie_competition',
       c.id, 'saisie_manuelle_srm_2026-2027_double_licence_v1', 'sql_276'
FROM public.categories c
WHERE c.code = 'SR-M'
ON CONFLICT (id) DO NOTHING;

-- 2. MALOSSANE Adrien au staff du collectif SR-M 2026/2027
INSERT INTO public.collectif_membre (personne_id, entente_id, role, statut, date_debut)
SELECT 'ff3aea6a-4e8f-4ba7-b03b-1effbe58fab4'::uuid, en.id, 'staff', 'regulier', DATE '2026-11-20'
FROM public.ententes en
WHERE en.code = 'ENTENTE-SR-M-2026-2027'
ON CONFLICT (personne_id, entente_id, role, date_debut) DO NOTHING;

-- 3. Table figée des 54 photos (personne_id, fichier source)
CREATE TEMP TABLE _photos_276 (personne_id uuid PRIMARY KEY, source text) ON COMMIT DROP;
INSERT INTO _photos_276 VALUES
    ('3cceabe2-910a-4781-b579-e2b28e247056'::uuid, 'ALTUN Murat'),
    ('19550d0b-c6a0-456f-922e-9ea12c9b4a57'::uuid, 'ANDREI Cyprian'),
    ('5861f664-96f0-4a0d-a919-48041294ed39'::uuid, 'BERGMANN Charles-Aaron'),
    ('04ea4bc5-ecd7-478b-bbfd-5497e1ac98ee'::uuid, 'BERHA Tom'),
    ('250bfead-e4ee-49a1-9c3b-a97e09268813'::uuid, 'BOLLI Florian'),
    ('7c0fb802-1bcd-4308-beab-d167278b4cb9'::uuid, 'BONNAFOUS Julien'),
    ('8a6c19b8-a3eb-457d-a029-2328a1efa341'::uuid, 'BONNEVILLE Gauthier'),
    ('90d67189-59b4-4471-9f69-e47d23e275b5'::uuid, 'BOURGUIGNON Martin'),
    ('4a56f1ce-544a-4d71-909b-b42739fbb2f2'::uuid, 'BRALIA Maxime'),
    ('1ace368e-6007-4c6c-afd2-1fbc154a5aef'::uuid, 'CLAR Jerome'),
    ('18567876-107f-45b5-9683-dfdd93235bfe'::uuid, 'DI NINO Leo'),
    ('c36b0ff6-3c76-4a20-981f-247aa13f8b30'::uuid, 'DI NINO Malo'),
    ('016c922b-6b36-4129-a882-d1ef6526cead'::uuid, 'DILLENSEGER Mickael'),
    ('99a8285a-52ce-4425-9d80-f3d93b4313c0'::uuid, 'DUPIN Leo'),
    ('6a3c176e-2500-4c69-bf52-80c2a87ea34b'::uuid, 'FLORENTIN Maxime'),
    ('c60119f6-e9a7-4ed0-9498-d0f4f89f1144'::uuid, 'FRAICHE Jorys'),
    ('62660001-70b4-4062-a4dc-d97c10340bca'::uuid, 'GRUNENWALD Julien'),
    ('ef26f9a8-dc26-4ff4-8245-050e234a26a8'::uuid, 'GUTHMULLER Geoffroy'),
    ('ce6bd849-07f7-4414-8da9-af92aa6d70e7'::uuid, 'GUTTON Sebastien'),
    ('62c801db-85c3-4c2f-a5c7-34e0f4cf1f1d'::uuid, 'HELM Loic'),
    ('fefed24c-3245-42b0-8a90-4ff26b1c9ab7'::uuid, 'HERMSDORFF Theo'),
    ('cdd65307-0787-477c-a3b1-f6008b1cb8f6'::uuid, 'HOEHN Enzo'),
    ('7d9f17c1-0a46-4c9a-b2d3-3f1f02d7ae44'::uuid, 'HOMO Simon'),
    ('589e7977-748c-42db-b29c-0505ec0d2e41'::uuid, 'HUMBERT Lohann'),
    ('d9bbcd99-a082-4a93-bb0e-4eeab2355599'::uuid, 'KELLER Didier'),
    ('f04f9d2b-4b81-4b50-ae88-cff7e4733aff'::uuid, 'KELLER Victor'),
    ('554b55de-7a3c-4774-99da-a1bd58a96fa1'::uuid, 'KOERIN Leon'),
    ('151a8255-9413-4943-b41e-64c0872c0b7d'::uuid, 'KUNTZ Julien'),
    ('8d4e1b3f-5638-48c2-98da-22ac913ce676'::uuid, 'LACOMBE Baptiste'),
    ('b3470258-1108-4a96-b471-a8ad16fa993c'::uuid, 'LAFFONT Cedric'),
    ('04a4f3c5-f6fb-4a34-9f8a-77b2eef3a5a5'::uuid, 'LITT Lilian'),
    ('75a81e9b-2cde-4e48-b1e7-5224f88b7b51'::uuid, 'LUCHESI Guillaume'),
    ('5b485c3e-2e16-4c54-b454-1b9a47bad16e'::uuid, 'MALET Victor'),
    ('ff3aea6a-4e8f-4ba7-b03b-1effbe58fab4'::uuid, 'MALOSSANE Adrien'),
    ('d849cc6d-62a0-4e6e-baaf-98cec17a125c'::uuid, 'MARTIN Vincent'),
    ('2617af15-310a-4d56-9de0-a597eecf57d0'::uuid, 'MASSON Leo'),
    ('24162171-e7f5-4b08-83f5-1322369c32fa'::uuid, 'MERTZ Theo'),
    ('88680cc6-20fd-43c4-9a76-521aa2f80ce1'::uuid, 'MOEFANA Vito'),
    ('083f82df-98ca-4f15-acc9-b868d575286b'::uuid, 'MORREALE Quentin'),
    ('2bbe2c92-ad6d-4778-ac90-3d7c484f0f9b'::uuid, 'NARES Nicolas'),
    ('52515901-51c1-4e6b-8c7a-1055bb3554e9'::uuid, 'NOLSIER Leonard'),
    ('90056fb3-88d9-4011-8fdb-d3a8a713d76b'::uuid, 'OBERT Jonathan'),
    ('2ebb6654-98cb-40e4-955c-d752085e6ab8'::uuid, 'PAILLOUX Michel'),
    ('988e7f3e-36c2-4fbc-990b-ead9ea1513ed'::uuid, 'PIRES Hugo'),
    ('81deed31-bc4a-4144-b154-dc7ff0c0643a'::uuid, 'ROZIER Fabien'),
    ('30d6daea-bc6b-47c2-90e4-7aa5da2380f9'::uuid, 'SCHALL Paul-Alexandre'),
    ('096ddae2-b6cf-41f0-b761-5ff4ba62036e'::uuid, 'SCHNELL Florian'),
    ('ab624410-311e-41d7-b13c-c046c4773eef'::uuid, 'SUTRELL Joe'),
    ('ae4d8bbd-dd74-4fb0-9d48-588d6b09dc70'::uuid, 'TOTH Jerome'),
    ('eb3a7542-4166-445b-b59c-c9bb8f412310'::uuid, 'TRENDEL Christophe'),
    ('6799cc67-13d4-4e79-803e-229472c28346'::uuid, 'VIAL Louis'),
    ('5cf92048-6802-4ede-8bdd-a4ce9f09d501'::uuid, 'VIARD Corentin'),
    ('7045d2c1-2b09-4cbe-9fe7-43b50e20d844'::uuid, 'WALTER Jerome'),
    ('30378116-c207-4dca-ad46-1037ce164935'::uuid, 'WEISS Lucas');

-- 4. Droit à l'image « photos individuelles » (accord confirmé par Manu)
UPDATE public.personnes p
SET droit_image_photos_individuelles = true, modifie_par = 'sql_276'
FROM _photos_276 t
WHERE p.id = t.personne_id
  AND p.droit_image_photos_individuelles IS DISTINCT FROM true;

-- 5. Photos courantes, dérivées du bucket réel
INSERT INTO public.personnes_photos (personne_id, path, rang, est_courante, created_by)
SELECT t.personne_id, o.name, 1, true, 'sql_276-photos-seniors'
FROM _photos_276 t
JOIN storage.objects o
  ON o.bucket_id = 'photos-joueurs' AND o.name = 'photos/' || t.personne_id || '.jpg'
WHERE NOT EXISTS (SELECT 1 FROM public.personnes_photos ph
                  WHERE ph.personne_id = t.personne_id AND ph.est_courante);

DO $verif$
DECLARE v_obj int; v_ph int; v_droit int; v_clar int; v_mal int;
BEGIN
  SELECT count(*) INTO v_obj FROM _photos_276 t JOIN storage.objects o
    ON o.bucket_id = 'photos-joueurs' AND o.name = 'photos/' || t.personne_id || '.jpg';
  SELECT count(*) INTO v_ph FROM public.personnes_photos ph JOIN _photos_276 t USING (personne_id)
    WHERE ph.est_courante AND ph.path = 'photos/' || t.personne_id || '.jpg';
  SELECT count(*) INTO v_droit FROM public.personnes p JOIN _photos_276 t ON t.personne_id = p.id
    WHERE p.droit_image_photos_individuelles;
  SELECT count(*) INTO v_clar FROM public.collectif_membre cm JOIN public.ententes en ON en.id = cm.entente_id
    WHERE cm.personne_id = '1ace368e-6007-4c6c-afd2-1fbc154a5aef' AND en.code = 'ENTENTE-SR-M-2026-2027' AND cm.role = 'joueur';
  SELECT count(*) INTO v_mal FROM public.collectif_membre cm JOIN public.ententes en ON en.id = cm.entente_id
    WHERE cm.personne_id = 'ff3aea6a-4e8f-4ba7-b03b-1effbe58fab4'
      AND en.code = 'ENTENTE-SR-M-2026-2027' AND cm.role = 'staff' AND cm.date_fin IS NULL;
  IF v_obj <> 54 THEN RAISE EXCEPTION 'FAIL: % fichiers sur 54 dans le bucket', v_obj; END IF;
  IF v_ph <> 54 THEN RAISE EXCEPTION 'FAIL: % photos courantes sur 54', v_ph; END IF;
  IF v_droit <> 54 THEN RAISE EXCEPTION 'FAIL: % droits image sur 54', v_droit; END IF;
  IF v_clar <> 1 THEN RAISE EXCEPTION 'FAIL: CLAR absent du collectif SR-M'; END IF;
  IF v_mal <> 1 THEN RAISE EXCEPTION 'FAIL: MALOSSANE absent du staff SR-M'; END IF;
  RAISE NOTICE 'sql_276 OK : 54 photos, 54 droits, CLAR au collectif, MALOSSANE au staff';
END
$verif$;

COMMIT;
