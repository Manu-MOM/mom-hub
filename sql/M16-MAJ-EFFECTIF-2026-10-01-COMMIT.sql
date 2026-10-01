-- =====================================================================
-- M16-MAJ-EFFECTIF-2026-10-01
-- Mise à jour effectif entente M16 2026/2027 + normalisation NOM/Prénom
-- Décisions Manu du 01/10/2026 :
--   1. MAUDOUX Corentin -> Colmar (CRC)
--   2. ERDOGAN Semih   -> non ajouté (aucune action)
--   3. GOBLED Tristan, HELM Noam -> archivés
--   4. Corrections : SCHREIBER-CORDON, COUÉ-MARINI, DE VITRY D'AVAUCOURT,
--      Conus -> CRC, 9 dates de naissance (Perrin exclu : date Excel aberrante)
--   5. Option B : correction ponctuelle + trigger permanent
--   6. ANGSTHELM-KECHIDA Léon
-- Mode : COMMIT (feu vert Manu 01/10/2026 12:59)
-- dernière ligne ROLLBACK remplacée par COMMIT, sur feu vert explicite.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- A. Trigger permanent de normalisation NOM (MAJUSCULES) / Prénom (Initiales)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personnes_normaliser_nom_prenom()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.nom IS NOT NULL THEN
    NEW.nom := upper(btrim(NEW.nom));
  END IF;
  IF NEW.prenom IS NOT NULL THEN
    NEW.prenom := initcap(lower(btrim(NEW.prenom)));
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS normaliser_nom_prenom ON public.personnes;
CREATE TRIGGER normaliser_nom_prenom
BEFORE INSERT OR UPDATE OF nom, prenom ON public.personnes
FOR EACH ROW EXECUTE FUNCTION public.personnes_normaliser_nom_prenom();

-- ---------------------------------------------------------------------
-- B. Correction ponctuelle de l'existant (fiches non conformes)
-- ---------------------------------------------------------------------
UPDATE public.personnes
SET nom = upper(btrim(nom)),
    prenom = initcap(lower(btrim(prenom))),
    modifie_par = 'normalisation-nom-prenom-2026-10-01'
WHERE nom IS DISTINCT FROM upper(btrim(nom))
   OR prenom IS DISTINCT FROM initcap(lower(btrim(prenom)));

-- ---------------------------------------------------------------------
-- C. Corrections ciblées (par id)
-- ---------------------------------------------------------------------
UPDATE public.personnes SET nom = 'SCHREIBER-CORDON',
  modifie_par = 'claude-maj-m16-2026-10-01'
WHERE id = '4ff37f14-6d07-46e3-8bf3-ca33d89ff790';

UPDATE public.personnes SET nom = 'COUÉ-MARINI',
  modifie_par = 'claude-maj-m16-2026-10-01'
WHERE id = '17f02cb0-3b35-4183-9e83-294a1abfec00';

UPDATE public.personnes SET nom = 'DE VITRY D''AVAUCOURT',
  modifie_par = 'claude-maj-m16-2026-10-01'
WHERE id = 'a7ce7d92-c761-4983-a606-ac53862b09b5';

-- Conus : CRIG -> Colmar (CRC)
UPDATE public.personnes SET club_principal_id = '414cbddf-d242-4535-b516-f9d75ebbe26d',
  modifie_par = 'claude-maj-m16-2026-10-01'
WHERE id = 'fbd45dfd-4d2c-4bba-aa1f-49ceded42630';

-- Dates de naissance (uniquement si vides)
UPDATE public.personnes p
SET date_naissance = v.dn,
    modifie_par = 'claude-maj-m16-2026-10-01'
FROM (VALUES
  ('75cea9bd-dd6b-4c39-aefd-e87f38b09809'::uuid, '2011-09-18'::date), -- BILLOTTE Constantin
  ('4ff37f14-6d07-46e3-8bf3-ca33d89ff790'::uuid, '2012-06-02'::date), -- SCHREIBER-CORDON Léon
  ('fbd45dfd-4d2c-4bba-aa1f-49ceded42630'::uuid, '2011-04-19'::date), -- CONUS Louis
  ('567cea6f-8691-4b97-96a7-f0c3b8a245b8'::uuid, '2012-05-21'::date), -- LITIÈRE Louis
  ('a637cbf5-3101-48a5-9bd7-6e0d94051e99'::uuid, '2011-01-27'::date), -- STEIB Martin
  ('6291a75c-7654-44a9-a9a7-432c127706c8'::uuid, '2011-11-09'::date), -- DALLOZ Pierre
  ('a64ff01f-f2c5-4bb2-b24c-6469cfc4dde8'::uuid, '2012-04-30'::date), -- MARNAY Rodrigue
  ('a7ce7d92-c761-4983-a606-ac53862b09b5'::uuid, '2012-05-09'::date), -- DE VITRY D'AVAUCOURT Thomas
  ('1d7620e1-d8fa-4506-b4fb-88859dc99cc1'::uuid, '2011-03-25'::date)  -- KLEIN Télio
) AS v(id, dn)
WHERE p.id = v.id AND p.date_naissance IS NULL;

-- ---------------------------------------------------------------------
-- D. Archivage GOBLED Tristan, HELM Noam
-- ---------------------------------------------------------------------
UPDATE public.personnes
SET est_archive = true,
    date_archivage = now(),
    modifie_par = 'claude-maj-m16-2026-10-01'
WHERE id IN ('0123070f-4963-4ea6-8364-e5d7acf909a9',  -- GOBLED Tristan
             'bd550045-9127-490e-b63f-56dfc7836b47')  -- HELM Noam
  AND est_archive = false;

-- ---------------------------------------------------------------------
-- E. Intégration des 3 nouveaux joueurs (patron fiches partenaires M16)
-- ---------------------------------------------------------------------
WITH nouveaux AS (
  INSERT INTO public.personnes
    (categorie_personne, nom, prenom, date_naissance, type_personne,
     categorie_id, club_principal_id, source_creation, modifie_par)
  VALUES
    ('joueur', 'MAUDOUX', 'Corentin', '2011-02-17', 'licencie_externe_partenaire',
     'fa2bb289-cef0-4884-82e9-c50699a52a8f', '414cbddf-d242-4535-b516-f9d75ebbe26d',
     'sporteasy_m16_2026-2027_maj_2026-10-01', 'claude-maj-m16-2026-10-01'),
    ('joueur', 'ANGSTHELM-KECHIDA', 'Léon', NULL, 'licencie_externe_partenaire',
     'fa2bb289-cef0-4884-82e9-c50699a52a8f', '0152d537-8db4-40ad-9e2a-697c6b4c71f9',
     'sporteasy_m16_2026-2027_maj_2026-10-01', 'claude-maj-m16-2026-10-01'),
    ('joueur', 'REIMINGER', 'Mathéo', '2012-08-09', 'licencie_externe_partenaire',
     'fa2bb289-cef0-4884-82e9-c50699a52a8f', '0152d537-8db4-40ad-9e2a-697c6b4c71f9',
     'sporteasy_m16_2026-2027_maj_2026-10-01', 'claude-maj-m16-2026-10-01')
  RETURNING id
)
INSERT INTO public.collectif_membre (personne_id, entente_id, role, statut, date_debut)
SELECT id, 'f780f772-e08f-40c3-ad15-d1c67a3b990e', 'joueur', 'regulier', DATE '2026-10-01'
FROM nouveaux;

-- ---------------------------------------------------------------------
-- F. Vérifications fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  n int;
  t_nom text;
  t_prenom text;
BEGIN
  -- F1. Plus aucune fiche non conforme
  SELECT count(*) INTO n FROM public.personnes
  WHERE nom IS DISTINCT FROM upper(nom) OR prenom IS DISTINCT FROM initcap(lower(prenom));
  IF n <> 0 THEN RAISE EXCEPTION 'F1 KO : % fiches non conformes', n; END IF;

  -- F2. Les 3 nouveaux sont membres joueurs de l'entente M16
  SELECT count(*) INTO n FROM public.personnes p
  JOIN public.collectif_membre cm ON cm.personne_id = p.id
   AND cm.entente_id = 'f780f772-e08f-40c3-ad15-d1c67a3b990e' AND cm.role = 'joueur'
  WHERE p.nom IN ('MAUDOUX', 'ANGSTHELM-KECHIDA', 'REIMINGER') AND NOT p.est_archive;
  IF n <> 3 THEN RAISE EXCEPTION 'F2 KO : % nouveaux trouvés (attendu 3)', n; END IF;

  -- F3. Corrections de noms
  SELECT count(*) INTO n FROM public.personnes
  WHERE (id = '4ff37f14-6d07-46e3-8bf3-ca33d89ff790' AND nom = 'SCHREIBER-CORDON' AND date_naissance = '2012-06-02')
     OR (id = '17f02cb0-3b35-4183-9e83-294a1abfec00' AND nom = 'COUÉ-MARINI')
     OR (id = 'a7ce7d92-c761-4983-a606-ac53862b09b5' AND nom = 'DE VITRY D''AVAUCOURT')
     OR (id = 'fbd45dfd-4d2c-4bba-aa1f-49ceded42630' AND club_principal_id = '414cbddf-d242-4535-b516-f9d75ebbe26d');
  IF n <> 4 THEN RAISE EXCEPTION 'F3 KO : % corrections OK sur 4', n; END IF;

  -- F4. Archivages
  SELECT count(*) INTO n FROM public.personnes
  WHERE id IN ('0123070f-4963-4ea6-8364-e5d7acf909a9', 'bd550045-9127-490e-b63f-56dfc7836b47') AND est_archive;
  IF n <> 2 THEN RAISE EXCEPTION 'F4 KO : % archivés sur 2', n; END IF;

  -- F5. Effectif actif M16 = 56 - 2 + 3 = 57
  SELECT count(*) INTO n FROM public.collectif_membre cm
  JOIN public.personnes p ON p.id = cm.personne_id
  WHERE cm.entente_id = 'f780f772-e08f-40c3-ad15-d1c67a3b990e' AND cm.role = 'joueur' AND NOT p.est_archive;
  IF n <> 57 THEN RAISE EXCEPTION 'F5 KO : effectif actif M16 = % (attendu 57)', n; END IF;

  -- F6. Le trigger normalise bien une saisie future (test isolé puis annulé)
  INSERT INTO public.personnes (categorie_personne, nom, prenom)
  VALUES ('contact-externe', '  test-normalisation ', 'JEAN-ÉRIC marie')
  RETURNING nom, prenom INTO t_nom, t_prenom;
  IF t_nom <> 'TEST-NORMALISATION' OR t_prenom <> 'Jean-Éric Marie' THEN
    RAISE EXCEPTION 'F6 KO : trigger -> % / %', t_nom, t_prenom;
  END IF;
  DELETE FROM public.personnes WHERE nom = 'TEST-NORMALISATION' AND prenom = 'Jean-Éric Marie';

  RAISE NOTICE 'VERIF OK : F1..F6 verts';
END;
$verif$;

-- Récapitulatif lisible
SELECT p.nom, p.prenom, p.date_naissance, cl.code AS club, p.est_archive
FROM public.personnes p
LEFT JOIN public.clubs cl ON cl.id = p.club_principal_id
WHERE p.id IN (
  '4ff37f14-6d07-46e3-8bf3-ca33d89ff790', '17f02cb0-3b35-4183-9e83-294a1abfec00',
  'a7ce7d92-c761-4983-a606-ac53862b09b5', 'fbd45dfd-4d2c-4bba-aa1f-49ceded42630',
  '0123070f-4963-4ea6-8364-e5d7acf909a9', 'bd550045-9127-490e-b63f-56dfc7836b47'
) OR p.nom IN ('MAUDOUX', 'ANGSTHELM-KECHIDA', 'REIMINGER')
ORDER BY p.nom;

COMMIT;
