-- =====================================================================
-- sql_280 — Fiche HOMO Suzon (seniors F) + photo
-- Demande de Manu (20/11/2026) : « tu peux créer la fiche de Suzon ».
-- Contexte : photo « HOMO Suzon » reçue dans le lot seniors F (sql_279),
--   mise de côté faute de fiche (aucune personne Suzon / HOMO F en base,
--   vérifié le 20/11/2026).
-- Choix techniques (même schéma que CLAR Jerome, sql_276) :
--   - joueuse, sexe F, licencie_competition, catégorie SR-F ;
--     uuid fixé à l'avance (= nom du fichier bucket) ;
--     n° licence / qualité FFR inconnus -> NULL (à compléter par OVAL-E) ;
--     le déclencheur collectif_auto l'inscrit au collectif SR-F.
--   - droit image photos individuelles = true (accord confirmé par Manu
--     pour le lot seniors F, sql_279).
--   - personnes_photos : rang 1, est_courante, dérivé du bucket réel.
-- PRÉREQUIS : photos/c7b8747b-180c-4596-a57c-de14cbec24ce.jpg chargé
--   dans le bucket photos-joueurs.
-- =====================================================================

BEGIN;

-- 1. Fiche HOMO Suzon
INSERT INTO public.personnes (id, categorie_personne, nom, prenom, sexe, type_personne,
                              categorie_id, droit_image_photos_individuelles,
                              source_creation, modifie_par)
SELECT 'c7b8747b-180c-4596-a57c-de14cbec24ce'::uuid, 'joueur', 'HOMO', 'Suzon', 'F', 'licencie_competition',
       c.id, true, 'saisie_manuelle_srf_2026-2027_photos_v1', 'sql_280'
FROM public.categories c
WHERE c.code = 'SR-F'
ON CONFLICT (id) DO NOTHING;

-- 2. Photo courante
INSERT INTO public.personnes_photos (personne_id, path, rang, est_courante, created_by)
SELECT 'c7b8747b-180c-4596-a57c-de14cbec24ce'::uuid, o.name, 1, true, 'sql_280-fiche-homo-suzon'
FROM storage.objects o
WHERE o.bucket_id = 'photos-joueurs'
  AND o.name = 'photos/c7b8747b-180c-4596-a57c-de14cbec24ce.jpg'
  AND NOT EXISTS (SELECT 1 FROM public.personnes_photos ph
                  WHERE ph.personne_id = 'c7b8747b-180c-4596-a57c-de14cbec24ce'::uuid AND ph.est_courante);

-- 3. Vérification
DO $verif$
DECLARE v_fiche int; v_ph int; v_coll int;
BEGIN
  SELECT count(*) INTO v_fiche FROM public.personnes p JOIN public.categories c ON c.id = p.categorie_id
    WHERE p.id = 'c7b8747b-180c-4596-a57c-de14cbec24ce' AND c.code = 'SR-F'
      AND p.nom = 'HOMO' AND p.prenom = 'Suzon' AND p.droit_image_photos_individuelles;
  SELECT count(*) INTO v_ph FROM public.personnes_photos
    WHERE personne_id = 'c7b8747b-180c-4596-a57c-de14cbec24ce' AND est_courante;
  SELECT count(*) INTO v_coll FROM public.collectif_membre cm JOIN public.ententes e ON e.id = cm.entente_id
    WHERE cm.personne_id = 'c7b8747b-180c-4596-a57c-de14cbec24ce' AND e.code = 'ENTENTE-SR-F-2026-2027';
  IF v_fiche <> 1 THEN RAISE EXCEPTION 'FAIL: fiche HOMO Suzon absente ou incomplète'; END IF;
  IF v_ph <> 1 THEN RAISE EXCEPTION 'FAIL: % photo courante (attendu 1)', v_ph; END IF;
  IF v_coll < 1 THEN RAISE EXCEPTION 'FAIL: non inscrite au collectif SR-F 2026/2027'; END IF;
  RAISE NOTICE 'sql_280 OK : fiche HOMO Suzon SR-F, photo liée, collectif SR-F';
END
$verif$;

COMMIT;
