-- sql_196 — EDITION-EMAIL-FICHE
-- Nouvelle RPC maj_identite_fiche(uuid, jsonb) : canal identité réservé
-- admin|bureau. 1er jet = email_principal + email_secondaire.
-- Doctrine : l'identité (dont email) n'est PAS ouverte au référent de
-- catégorie (contrairement au métier joueur via update_joueur_metier).
-- L'email est la clé de rattachement de compte (list_mes_fiches_par_email) :
-- effet identité assumé (D4). Pas d'unicité imposée (D5, packs familiaux).

CREATE OR REPLACE FUNCTION public.maj_identite_fiche(p_personne_id uuid, p_patch jsonb)
 RETURNS SETOF personnes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_role BOOLEAN := FALSE;
  v_email    TEXT;
BEGIN
  -- Autorisation D1 : admin | bureau UNIQUEMENT (identité).
  BEGIN
    v_has_role := public.has_role('admin') OR public.has_role('bureau');
  EXCEPTION WHEN undefined_function THEN
    v_has_role := FALSE;
  END;
  IF NOT v_has_role THEN
    v_has_role := session_user IN ('postgres', 'supabase_admin');
  END IF;
  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Droit insuffisant : édition identité réservée au bureau/admin'
      USING ERRCODE = '42501';
  END IF;

  -- Validation entrées.
  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'p_patch doit être un objet JSON' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM personnes WHERE id = p_personne_id) THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;

  -- Validation de forme email minimale (présence d'un '@'), sur les champs
  -- présents et non vides. Vide/absent -> NULL (efface), pas d'erreur.
  IF p_patch ? 'email_principal' THEN
    v_email := NULLIF(trim(lower(p_patch->>'email_principal')), '');
    IF v_email IS NOT NULL AND position('@' in v_email) = 0 THEN
      RAISE EXCEPTION 'email_principal invalide : %', v_email USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_patch ? 'email_secondaire' THEN
    v_email := NULLIF(trim(lower(p_patch->>'email_secondaire')), '');
    IF v_email IS NOT NULL AND position('@' in v_email) = 0 THEN
      RAISE EXCEPTION 'email_secondaire invalide : %', v_email USING ERRCODE = '22023';
    END IF;
  END IF;

  -- UPDATE partial-patch (identité email seule dans ce 1er jet).
  UPDATE personnes SET
    email_principal = CASE WHEN p_patch ? 'email_principal'
      THEN NULLIF(trim(lower(p_patch->>'email_principal')), '')
      ELSE email_principal END,
    email_secondaire = CASE WHEN p_patch ? 'email_secondaire'
      THEN NULLIF(trim(lower(p_patch->>'email_secondaire')), '')
      ELSE email_secondaire END,
    modifie_par = 'module-identite',
    updated_at = NOW()
  WHERE id = p_personne_id;

  RETURN QUERY SELECT * FROM personnes WHERE id = p_personne_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.maj_identite_fiche(uuid, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.maj_identite_fiche(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.maj_identite_fiche(uuid, jsonb) TO authenticated;

-- Gate programmatique fail-loud : la fonction doit exister, être SECURITY
-- DEFINER, et ne pas être exécutable par anon.
DO $verif$
DECLARE
  v_secdef  boolean;
  v_anon_ok boolean;
BEGIN
  SELECT p.prosecdef INTO v_secdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'maj_identite_fiche';

  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : maj_identite_fiche absente';
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : maj_identite_fiche pas SECURITY DEFINER';
  END IF;

  SELECT has_function_privilege('anon',
    'public.maj_identite_fiche(uuid, jsonb)', 'EXECUTE') INTO v_anon_ok;
  IF v_anon_ok THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : anon peut exécuter maj_identite_fiche';
  END IF;

  RAISE NOTICE 'VERIF OK : maj_identite_fiche déployée, SECURITY DEFINER, anon révoqué.';
END
$verif$;
