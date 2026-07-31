-- =====================================================================
-- Import M16 partenaires SAR (SportEasy) — saison 2026/2027
-- TRACE DEPOT de la session. Deja APPLIQUE en base via connecteur
-- (derogation ponctuelle autorisee par Manu). Idempotent : rejouable
-- sans effet de bord (gardes NOT EXISTS / IS NULL). Rien a re-executer.
--
-- Source : SportEasy_m-16.xlsx (feuille M-16, 50 lignes : 44 joueurs + 6 coachs).
-- Cross-check licence + nom/prenom normalise contre la base :
--   34 deja en base (ignorees), 16 absentes -> 13 fiches joueurs retenues.
--
-- Referentiels (UUID en base) :
--   club SAR        = 50e8602c-1511-4294-b51e-b5e0b2e0799a
--   categorie M16   = fa2bb289-cef0-4884-82e9-c50699a52a8f  (nes 2011+2012 en 2026/2027)
--   personne GONTHIER Milan (staff SAR, cree en mai) = ebd551d7-8e1b-4bdc-af72-df81343d77b4
--
-- Arbitrages Manu (geles) :
--   * AMANI Ali = AMANI Ali Yannick (deja en base)      -> non insere
--   * PERRIN Joseph -> date_naissance NULL (DN source aberrante 2025-05-29)
--   * EDOUARD Theo + RITTER Romain (coachs)             -> non importes
--
-- Doctrine partenaire SAR (reconduite du lot minimes de mai + club ajoute) :
--   type_personne='licencie_externe_partenaire', categorie_personne='joueur',
--   club_principal_id=SAR, categorie_id=M16, tag_verifier=true,
--   source_creation='sporteasy_sar_m16_2025-2026_v1', sexe NULL (absent du fichier).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- ETAPE 1 — Insertion des 13 fiches joueurs (club SAR + categorie M16 d'emblee)
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
SELECT
  nom, prenom, licence, dn,
  'licencie_externe_partenaire', 'joueur',
  '50e8602c-1511-4294-b51e-b5e0b2e0799a',   -- club SAR
  'fa2bb289-cef0-4884-82e9-c50699a52a8f',   -- categorie M16
  true, 'sporteasy_sar_m16_2025-2026_v1'
FROM a_inserer;

-- ---------------------------------------------------------------------
-- ETAPE 2 — Retro-rattachement M16 des partenaires de mai nes 2011/2012 (garcons)
--   9 fiches. Ecarte : SCHNEIDER Feriel (sexe=F) et tous les nes 2013 (M14).
--   Tahina BERNARDSON + Tausiale Lami = garcons (confirme Manu, sexe non renseigne).
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
-- ETAPE 3 — GONTHIER Milan (SAR) : Referent de categorie M16
--   Fiche preexistante (creee en mai). Fonction posee via fonction_staff.
-- ---------------------------------------------------------------------
INSERT INTO public.fonction_staff (personne_id, categorie_id, fonction, date_debut)
SELECT 'ebd551d7-8e1b-4bdc-af72-df81343d77b4',
       'fa2bb289-cef0-4884-82e9-c50699a52a8f',
       'Référent de catégorie',
       DATE '2026-07-01'
WHERE NOT EXISTS (
  SELECT 1 FROM public.fonction_staff
  WHERE personne_id = 'ebd551d7-8e1b-4bdc-af72-df81343d77b4'
    AND categorie_id = 'fa2bb289-cef0-4884-82e9-c50699a52a8f'
    AND fonction = 'Référent de catégorie'
    AND date_fin IS NULL
);

-- ---------------------------------------------------------------------
-- VERIFICATION fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  n_import   integer;
  n_m16_part integer;
  n_gonthier integer;
BEGIN
  SELECT count(*) INTO n_import
    FROM public.personnes WHERE source_creation='sporteasy_sar_m16_2025-2026_v1';
  SELECT count(*) INTO n_m16_part
    FROM public.personnes
    WHERE categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f'
      AND type_personne='licencie_externe_partenaire' AND categorie_personne='joueur';
  SELECT count(*) INTO n_gonthier
    FROM public.fonction_staff
    WHERE personne_id='ebd551d7-8e1b-4bdc-af72-df81343d77b4'
      AND categorie_id='fa2bb289-cef0-4884-82e9-c50699a52a8f'
      AND fonction='Référent de catégorie' AND date_fin IS NULL;

  RAISE NOTICE 'Fiches import M16 : % (attendu 13)', n_import;
  RAISE NOTICE 'Partenaires rattaches M16 : % (attendu 22)', n_m16_part;
  RAISE NOTICE 'GONTHIER referent M16 : % (attendu 1)', n_gonthier;

  IF n_import <> 13 THEN
    RAISE EXCEPTION 'Import : % fiches, attendu 13.', n_import;
  END IF;
  IF n_m16_part <> 22 THEN
    RAISE EXCEPTION 'Rattachement M16 : % partenaires, attendu 22.', n_m16_part;
  END IF;
  IF n_gonthier <> 1 THEN
    RAISE EXCEPTION 'GONTHIER referent : % lignes, attendu 1.', n_gonthier;
  END IF;
END
$verif$;

-- Base deja a jour (applique via connecteur durant la session).
-- Ce fichier est une TRACE idempotente : COMMIT sans risque (0 changement
-- si rejoue), ou ROLLBACK si execute uniquement pour controle.
COMMIT;
