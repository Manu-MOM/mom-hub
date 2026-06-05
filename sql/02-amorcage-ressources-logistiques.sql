-- =====================================================================
-- MOM Hub · Module Logistique · Amorçage 02/4 : ressources de base
-- ---------------------------------------------------------------------
-- Cree les 6 ressources reservables de depart :
--   3 lieux  (type='site')     -> rattaches aux lignes `sites` existantes
--   2 minibus(type='materiel') -> sous_type='minibus', conducteur_requis
--   1 Veo    (type='materiel') -> sous_type='veo'
--
-- Idempotent : ON CONFLICT (code) DO NOTHING (re-executable sans doublon).
-- Fail-loud  : RAISE EXCEPTION si un des 3 sites cibles est absent.
-- Les sites sont retrouves par leur `code` stable (pas d'uuid en dur).
--
-- Conception FAIT FOI §4.1 ; sites confirmes en base (sonde ouverture).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Garde fail-loud : les 3 sites cibles doivent exister AVANT insertion
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_manquants text;
BEGIN
  SELECT string_agg(c.code, ', ')
    INTO v_manquants
  FROM (VALUES
    ('site-mom-brenckle'),
    ('site-mom-holtzplatz'),
    ('site-mom-clubhouse')
  ) AS c(code)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sites s WHERE s.code = c.code
  );

  IF v_manquants IS NOT NULL THEN
    RAISE EXCEPTION
      'Amorçage impossible — site(s) absent(s) dans public.sites : % (rollback)',
      v_manquants;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Lieux (type='site') — site_id resolu par jointure sur sites.code
-- ---------------------------------------------------------------------
INSERT INTO public.ressources_logistiques
  (code, type, site_id, libelle, sous_type, conducteur_requis, actif)
SELECT
  s.code,                      -- code miroir du site
  'site',
  s.id,                        -- FK resolue, pas d'uuid en dur
  s.libelle,                   -- libelle du site (ex. « Stade René Brencklé »)
  NULL,
  false,
  true
FROM public.sites s
WHERE s.code IN (
  'site-mom-brenckle',
  'site-mom-holtzplatz',
  'site-mom-clubhouse'
)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Materiel (type='materiel') — site_id NULL (coherence CHECK 01)
-- ---------------------------------------------------------------------
INSERT INTO public.ressources_logistiques
  (code, type, site_id, libelle, sous_type, conducteur_requis, actif)
VALUES
  ('minibus-1', 'materiel', NULL, 'Minibus 1 (Opel)',   'minibus', true,  true),
  ('minibus-2', 'materiel', NULL, 'Minibus 2 (Renault)','minibus', true,  true),
  ('veo',       'materiel', NULL, 'Caméra Veo',          'veo',     false, true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Garde fail-loud : les 6 ressources doivent etre presentes en sortie
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_nb integer;
BEGIN
  SELECT count(*) INTO v_nb
  FROM public.ressources_logistiques
  WHERE code IN (
    'site-mom-brenckle','site-mom-holtzplatz','site-mom-clubhouse',
    'minibus-1','minibus-2','veo'
  );

  IF v_nb <> 6 THEN
    RAISE EXCEPTION
      'Amorçage incomplet — % / 6 ressources presentes (rollback)', v_nb;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Fin. 6 ressources de base pretes. Etape suivante : table
-- reservations_logistiques (03/4) + RLS B5-saisie.
-- =====================================================================
