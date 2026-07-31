-- =====================================================================
-- Import M16 partenaires SAR (SportEasy) — saison 2025-2026
-- Source : SportEasy_m-16.xlsx (feuille M-16, 50 lignes)
-- Cross-check licence + nom/prenom normalise contre la base :
--   34 deja en base (ignorees) ; 16 absentes ;
--   apres arbitrages Manu -> 13 fiches joueurs a creer.
-- Arbitrages geles :
--   * AMANI Ali = AMANI Ali Yannick (deja en base) -> non insere
--   * PERRIN Joseph -> date_naissance NULL (DN SportEasy 2025-05-29 aberrante)
--   * EDOUARD Theo + RITTER Romain (coachs) -> non importes cette session
-- Doctrine (reconduite du lot minimes de mai) :
--   type_personne='licencie_externe_partenaire', categorie_personne='joueur',
--   tag_verifier=true, source_creation='sporteasy_sar_m16_2025-2026_v1',
--   sexe non fourni (NULL, absent du fichier).
-- Idempotent : garde NOT EXISTS (licence OU nom+prenom normalises).
-- Execution : Manu, SQL Editor. Additif pur (INSERT uniquement).
-- =====================================================================

BEGIN;

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
-- normalisation nom|prenom pour la garde anti-doublon (memes regles que le cross-check)
norm_src AS (
  SELECT *,
    regexp_replace(
      regexp_replace(
        translate(lower(nom||'|'||prenom),
          'àâäáãçéèêëíìîïñóòôöõúùûüýÿ ÀÂÄÁÃÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
          'aaaaaceeeeiiiinooooouuuuyy aaaaaceeeeiiiinooooouuuuy'),
        '\s*-\s*mom\b','','g'),
      '\s+',' ','g') AS nkey
  FROM src
),
a_inserer AS (
  SELECT s.* FROM norm_src s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.personnes p
    WHERE
      (s.licence IS NOT NULL AND p.numero_licence_ffr = s.licence)
      OR (
        btrim(regexp_replace(
          regexp_replace(
            translate(lower(p.nom||'|'||p.prenom),
              'àâäáãçéèêëíìîïñóòôöõúùûüýÿ ÀÂÄÁÃÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
              'aaaaaceeeeiiiinooooouuuuyy aaaaaceeeeiiiinooooouuuuy'),
            '\s*-\s*mom\b','','g'),
          '\s+',' ','g')) = btrim(s.nkey)
      )
  )
)
INSERT INTO public.personnes
  (nom, prenom, numero_licence_ffr, date_naissance,
   type_personne, categorie_personne, tag_verifier, source_creation)
SELECT
  nom, prenom, licence, dn,
  'licencie_externe_partenaire', 'joueur', true, 'sporteasy_sar_m16_2025-2026_v1'
FROM a_inserer;

-- Verification fail-loud : on attend exactement 13 insertions sur base vierge d'import.
DO $verif$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.personnes
  WHERE source_creation = 'sporteasy_sar_m16_2025-2026_v1';
  RAISE NOTICE 'Fiches source sporteasy_sar_m16_2025-2026_v1 en base : %', n;
  IF n = 0 THEN
    RAISE EXCEPTION 'Aucune fiche inseree — verifier la garde NOT EXISTS ou un import prealable.';
  END IF;
  IF n > 13 THEN
    RAISE EXCEPTION 'Trop de fiches (%). Attendu au plus 13 — anomalie a investiguer.', n;
  END IF;
END
$verif$;

-- Controle visuel avant validation
SELECT nom, prenom, numero_licence_ffr, date_naissance, tag_verifier
FROM public.personnes
WHERE source_creation = 'sporteasy_sar_m16_2025-2026_v1'
ORDER BY nom;

-- >>> Verifier le NOTICE (=13 sur premier passage) et le SELECT ci-dessus,
-- >>> puis remplacer ROLLBACK par COMMIT pour valider.
ROLLBACK;
