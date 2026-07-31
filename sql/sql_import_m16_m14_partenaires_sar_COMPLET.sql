-- =====================================================================
-- Import + rattachement partenaires SAR (SportEasy) — saison 2026/2027
-- TRACE DEPOT COMPLETE de la session. DEJA APPLIQUE en base via connecteur
-- (derogation ponctuelle autorisee par Manu). Idempotent : rejouable sans
-- effet de bord (gardes NOT EXISTS / IS NULL / id). Rien a re-executer.
-- Ce fichier REMPLACE la trace partielle precedente (qui s'arretait a Gonthier).
--
-- Source initiale : SportEasy_m-16.xlsx (feuille M-16, 50 lignes).
-- Cross-check licence + nom/prenom -> 34 deja en base, 13 fiches creees.
--
-- Referentiels (UUID en base) :
--   club SAR       = 50e8602c-1511-4294-b51e-b5e0b2e0799a
--   categorie M16  = fa2bb289-cef0-4884-82e9-c50699a52a8f  (nes 2011+2012)
--   categorie M14  = 312ebb88-25e8-40c5-8a37-9dd2e3927e2e  (nes 2013+2014)
--   GONTHIER Milan (staff SAR, cree en mai) = ebd551d7-8e1b-4bdc-af72-df81343d77b4
--
-- Doctrine partenaire SAR : type_personne='licencie_externe_partenaire',
--   categorie_personne='joueur', club_principal_id=SAR, tag_verifier=true.
--
-- Grille d'age 2026/2027 : M16 = 2011+2012 ; M14 = 2013+2014.
-- Dates derivees de la licence FFR (8 premiers chiffres = AAAAMMJJ) : source fiable.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- ETAPE 1 — 13 fiches joueurs M16 creees (club SAR + categorie M16 d'emblee)
-- ---------------------------------------------------------------------
WITH src(nom, prenom, licence, dn) AS (VALUES
  ('BEAUVAIS', 'Timothe', NULL, DATE '2011-08-01'),
  ('DELORME', 'Lucas', NULL, DATE '2011-12-29'),
  ('GIRONDE', 'Morgan', NULL, DATE '2012-04-19'),
  ('KHARABADZE', 'Joseb', NULL, DATE '2011-07-02'),
  ('LECLERC', 'Romain', NULL, NULL),
  ('LOPES', 'Augustin', NULL, DATE '2011-09-04'),
  ('MELIKISHVILI', 'Giorgi', '2011011100750', DATE '2011-01-04'),
  ('METZGER', 'Léon', NULL, DATE '2012-03-08'),
  ('PERRIN', 'Joseph', NULL, NULL),          -- DN volontairement NULL (aberrante a la source)
  ('ROOS', 'Paul', NULL, DATE '2011-06-19'),
  ('ROY', 'Corentin', NULL, DATE '2011-10-17'),
  ('RUEBRECHT', 'Paul', '2011051438339', DATE '2011-05-25'),
  ('SALIJAJ', 'Luan', NULL, NULL)
),
norm_src AS (
  SELECT *,
    regexp_replace(regexp_replace(translate(lower(nom||'|'||prenom),
      'àâäáãçéèêëíìîïñóòôöõúùûüýÿ ÀÂÄÁÃÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
      'aaaaaceeeeiiiinooooouuuuyy aaaaaceeeeiiiinooooouuuuy'),
      '\s*-\s*mom\b','','g'),'\s+',' ','g') AS nkey
  FROM src
),
a_inserer AS (
  SELECT s.* FROM norm_src s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.personnes p
    WHERE (s.licence IS NOT NULL AND p.numero_licence_ffr = s.licence)
       OR (btrim(regexp_replace(regexp_replace(translate(lower(p.nom||'|'||p.prenom),
          'àâäáãçéèêëíìîïñóòôöõúùûüýÿ ÀÂÄÁÃÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
          'aaaaaceeeeiiiinooooouuuuyy aaaaaceeeeiiiinooooouuuuy'),
          '\s*-\s*mom\b','','g'),'\s+',' ','g')) = btrim(s.nkey))
  )
)
INSERT INTO public.personnes
  (nom, prenom, numero_licence_ffr, date_naissance,
   type_personne, categorie_personne, club_principal_id, categorie_id,
   tag_verifier, source_creation)
SELECT nom, prenom, licence, dn,
  'licencie_externe_partenaire', 'joueur',
  '50e8602c-1511-4294-b51e-b5e0b2e0799a', 'fa2bb289-cef0-4884-82e9-c50699a52a8f',
  true, 'sporteasy_sar_m16_2025-2026_v1'
FROM a_inserer;

-- ---------------------------------------------------------------------
-- ETAPE 2 — Retro-rattachement M16 des partenaires de mai nes 2011/2012 (garcons a DN)
--   9 fiches. Ecarte : SCHNEIDER Feriel (F). Tahina BERNARDSON + Tausiale Lami = garcons.
-- ---------------------------------------------------------------------
UPDATE public.personnes p
SET categorie_id = 'fa2bb289-cef0-4884-82e9-c50699a52a8f', updated_at = now()
WHERE p.source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
  AND p.categorie_personne = 'joueur'
  AND p.categorie_id IS NULL
  AND p.date_naissance IS NOT NULL
  AND extract(year FROM p.date_naissance) IN (2011,2012)
  AND COALESCE(p.sexe,'') <> 'F';

-- ---------------------------------------------------------------------
-- ETAPE 3 — Retro-rattachement M14 des partenaires de mai nes 2013 (garcons a DN)
--   11 fiches (0 fille).
-- ---------------------------------------------------------------------
UPDATE public.personnes p
SET categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e', updated_at = now()
WHERE p.source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
  AND p.categorie_personne = 'joueur'
  AND p.categorie_id IS NULL
  AND p.date_naissance IS NOT NULL
  AND extract(year FROM p.date_naissance) = 2013
  AND COALESCE(p.sexe,'') <> 'F';

-- ---------------------------------------------------------------------
-- ETAPE 4 — Fiches sans DN mais AVEC licence : DN derivee + sexe M + categorie
--   (confirmations sexe Manu). DUBOIS Dan exclu (arret rugby).
--   SOW Baila    lic 2012081542975 -> 2012-08-15 -> M16
--   TERLIER Emil lic 2012061201773 -> 2012-06-12 -> M16
--   ALSHSHIAT Anas lic 2013021520829 -> 2013-02-15 -> M14
-- ---------------------------------------------------------------------
UPDATE public.personnes SET date_naissance=DATE '2012-08-15', sexe='M',
  categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f', updated_at=now()
WHERE nom='SOW' AND prenom='Baila' AND source_creation='sporteasy_sar_minimes_2025-2026_v1'
  AND categorie_id IS NULL;

UPDATE public.personnes SET date_naissance=DATE '2012-06-12', sexe='M',
  categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f', updated_at=now()
WHERE nom='TERLIER' AND prenom='Emil' AND source_creation='sporteasy_sar_minimes_2025-2026_v1'
  AND categorie_id IS NULL;

UPDATE public.personnes SET date_naissance=DATE '2013-02-15', sexe='M',
  categorie_id='312ebb88-25e8-40c5-8a37-9dd2e3927e2e', updated_at=now()
WHERE nom='ALSHSHIAT' AND prenom='Anas' AND source_creation='sporteasy_sar_minimes_2025-2026_v1'
  AND categorie_id IS NULL;

-- ---------------------------------------------------------------------
-- ETAPE 5 — Fiches sans DN ni licence : annee fournie par Manu -> categorie + sexe M.
--   DN laissee NULL (aucune date fiable), tag_verifier deja true.
--   M16 (2012) : CHAKOR, MURAIL, VERRIER, ZEAMARI
--   M14 (2013) : GASTYC, KOENIG, OBIDI, SCHMITT Lucas
-- ---------------------------------------------------------------------
UPDATE public.personnes SET sexe='M',
  categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f', updated_at=now()
WHERE source_creation='sporteasy_sar_minimes_2025-2026_v1' AND categorie_id IS NULL
  AND (nom,prenom) IN (('CHAKOR','Sidi Mohamed'),('MURAIL','Marvin'),('VERRIER','Soan'),('ZEAMARI','Mohamed'));

UPDATE public.personnes SET sexe='M',
  categorie_id='312ebb88-25e8-40c5-8a37-9dd2e3927e2e', updated_at=now()
WHERE source_creation='sporteasy_sar_minimes_2025-2026_v1' AND categorie_id IS NULL
  AND (nom,prenom) IN (('GASTYC','Léon'),('KOENIG','Martin'),('OBIDI','Jarvin'),('SCHMITT','Lucas'));

-- Non rattaches volontairement (arret rugby probable / a confirmer) :
--   DJENIDI Adam, DUBOIS Dan, EL-OUARIACHI TOUTOUHI Maher, GAID Yasmine,
--   LABARRAQUE DUPOUY Lucien, MOHAMMAD-ALI Bhatti, SCHNEIDER Feriel (F), TOMASI Marius.

-- ---------------------------------------------------------------------
-- ETAPE 6 — GONTHIER Milan (SAR) : Referent de categorie M16 (fiche preexistante)
-- ---------------------------------------------------------------------
INSERT INTO public.fonction_staff (personne_id, categorie_id, fonction, date_debut)
SELECT 'ebd551d7-8e1b-4bdc-af72-df81343d77b4',
       'fa2bb289-cef0-4884-82e9-c50699a52a8f',
       'Référent de catégorie', DATE '2026-07-01'
WHERE NOT EXISTS (
  SELECT 1 FROM public.fonction_staff
  WHERE personne_id='ebd551d7-8e1b-4bdc-af72-df81343d77b4'
    AND categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f'
    AND fonction='Référent de catégorie' AND date_fin IS NULL
);

-- ---------------------------------------------------------------------
-- VERIFICATION fail-loud (etat final attendu)
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  n_import integer; n_m16 integer; n_m14 integer;
  n_reste integer; n_gonthier integer;
BEGIN
  SELECT count(*) INTO n_import FROM public.personnes
    WHERE source_creation='sporteasy_sar_m16_2025-2026_v1';
  SELECT count(*) INTO n_m16 FROM public.personnes
    WHERE categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f'
      AND type_personne='licencie_externe_partenaire' AND categorie_personne='joueur';
  SELECT count(*) INTO n_m14 FROM public.personnes
    WHERE categorie_id='312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
      AND type_personne='licencie_externe_partenaire' AND categorie_personne='joueur';
  SELECT count(*) INTO n_reste FROM public.personnes
    WHERE source_creation='sporteasy_sar_minimes_2025-2026_v1'
      AND categorie_personne='joueur' AND categorie_id IS NULL;
  SELECT count(*) INTO n_gonthier FROM public.fonction_staff
    WHERE personne_id='ebd551d7-8e1b-4bdc-af72-df81343d77b4'
      AND categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f'
      AND fonction='Référent de catégorie' AND date_fin IS NULL;

  RAISE NOTICE 'Import M16 (fiches creees) : % (attendu 13)', n_import;
  RAISE NOTICE 'Partenaires M16 : % (attendu 28)', n_m16;
  RAISE NOTICE 'Partenaires M14 : % (attendu 16)', n_m14;
  RAISE NOTICE 'Partenaires mai sans categorie : % (attendu 8)', n_reste;
  RAISE NOTICE 'GONTHIER referent M16 : % (attendu 1)', n_gonthier;

  IF n_import <> 13 THEN RAISE EXCEPTION 'Import : % (attendu 13)', n_import; END IF;
  IF n_m16 <> 28 THEN RAISE EXCEPTION 'M16 : % (attendu 28)', n_m16; END IF;
  IF n_m14 <> 16 THEN RAISE EXCEPTION 'M14 : % (attendu 16)', n_m14; END IF;
  IF n_reste <> 8 THEN RAISE EXCEPTION 'Reste : % (attendu 8)', n_reste; END IF;
  IF n_gonthier <> 1 THEN RAISE EXCEPTION 'Gonthier : % (attendu 1)', n_gonthier; END IF;
END
$verif$;

-- Base deja a jour. Trace idempotente : COMMIT sans risque (0 changement si rejoue).
COMMIT;
