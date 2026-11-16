-- =====================================================================
-- sql_267_eval_joueur_veo_moments
-- FAIT FOI « EVAL-JOUEUR » v1, décision D28 (retour terrain du
--   16/11/2026, choix de Manu) : « Revoir tes actions » = UN lien VEO du
--   match + jusqu'à 5 moments (minute + libellé facultatif 60 car.).
--   Remplace D7-b (une seule minute).
--
-- Contenu :
--   ALTER eval_match : + veo_moments jsonb NOT NULL DEFAULT '[]'
--                      (liste, 5 max), reprise de veo_minute, DROP veo_minute
--   _ej_json_match          REMPLACÉ (même signature) : + veo_moments ;
--                           'veo_minute' = 1er moment (compat ancien front)
--   enregistrer_eval_match  DROP (13 param.) + CREATE (14 : + p_veo_moments
--                           jsonb DEFAULT NULL). p_veo_minute CONSERVÉ :
--                           l'ancien front (supabase-client v1.97) continue
--                           de fonctionner jusqu'au déploiement de la v1.98.
-- Données au 16/11/2026 : 2 évals, 0 veo_minute renseignée.
-- Mode : COMMIT (corps identique au dry-run vert, sans les tests).
--   Appliqué via apply_migration (corps sans BEGIN/COMMIT).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Schéma
-- ---------------------------------------------------------------------
ALTER TABLE public.eval_match
  ADD COLUMN veo_moments jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.eval_match
  SET veo_moments = jsonb_build_array(jsonb_build_object('minute', btrim(veo_minute), 'libelle', NULL))
  WHERE nullif(btrim(veo_minute), '') IS NOT NULL;
ALTER TABLE public.eval_match
  ADD CONSTRAINT eval_match_veo_moments_check CHECK (
    jsonb_typeof(veo_moments) = 'array' AND jsonb_array_length(veo_moments) <= 5);
ALTER TABLE public.eval_match DROP COLUMN veo_minute;

-- ---------------------------------------------------------------------
-- 2. _ej_json_match (même signature)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ej_json_match(m public.eval_match, p_staff boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_auto public.auto_eval_match;
  v_match jsonb;
BEGIN
  SELECT * INTO v_auto FROM public.auto_eval_match a
  WHERE a.personne_id = m.personne_id AND a.evenement_id = m.evenement_id;

  SELECT jsonb_build_object(
           'date', (coalesce(e.date_debut, ep.date_debut) AT TIME ZONE 'Europe/Paris')::date,
           'libelle', e.libelle, 'adversaire', e.adversaire_nom,
           'domicile_exterieur', e.domicile_exterieur,
           'score_mom', e.score_mom, 'score_adverse', e.score_adverse,
           'niveau', public._ej_niveau(e.id))
  INTO v_match
  FROM public.evenements e
  LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
  WHERE e.id = m.evenement_id;

  -- Avenant A (D19) : côté joueur, éval verrouillée tant que l'auto-évaluation
  -- de ce match n'est pas envoyée (sauf évals antérieures à l'avenant, D22).
  -- Rien du contenu du coach ne sort alors vers le navigateur.
  IF NOT p_staff AND m.auto_eval_requise AND v_auto.id IS NULL THEN
    RETURN jsonb_build_object('id', m.id, 'evenement_id', m.evenement_id, 'statut', m.statut,
                              'verrouille', true, 'publie_le', m.publie_le, 'match', v_match);
  END IF;

  RETURN jsonb_build_object(
    'id', m.id, 'evenement_id', m.evenement_id, 'statut', m.statut,
    'feu', m.feu, 'point_fort', m.point_fort, 'axe_travail', m.axe_travail,
    'mot_coach', m.mot_coach, 'veo_url', m.veo_url, 'veo_moments', m.veo_moments,
    -- Compat (D28) : 1er moment, tant que l'ancien front est en circulation.
    'veo_minute', m.veo_moments -> 0 ->> 'minute',
    'publie_le', m.publie_le,
    'publie_par_prenom', (SELECT p.prenom FROM public.personnes p WHERE p.id = m.publie_par),
    'reponse_joueur', m.reponse_joueur, 'reponse_le', m.reponse_le,
    'verrouille', false,
    'criteres', jsonb_build_object(
      'tech_indiv', m.feu_tech_indiv, 'physique', m.feu_physique, 'tech_poste', m.feu_tech_poste,
      'comprehension', m.feu_comprehension, 'etat_esprit', m.feu_etat_esprit),
    'auto_eval', CASE WHEN v_auto.id IS NULL THEN NULL ELSE public._ej_json_auto(v_auto) END,
    'match', v_match)
  || CASE WHEN p_staff THEN jsonb_build_object(
       'redige_par', m.redige_par,
       'redige_par_nom', (SELECT p.prenom || ' ' || p.nom FROM public.personnes p WHERE p.id = m.redige_par),
       'updated_at', m.updated_at,
       'auto_eval_requise', m.auto_eval_requise)
     ELSE jsonb_build_object('reperes', public._ej_reperes(m.personne_id, m.evenement_id, false)) END;
END;
$fn$;
REVOKE ALL ON FUNCTION public._ej_json_match(public.eval_match, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. enregistrer_eval_match : DROP + CREATE (D28)
-- ---------------------------------------------------------------------
DROP FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text);
CREATE FUNCTION public.enregistrer_eval_match(
  p_personne_id uuid,
  p_evenement_id uuid,
  p_feu text DEFAULT NULL,
  p_point_fort text DEFAULT NULL,
  p_axe_travail text DEFAULT NULL,
  p_mot_coach text DEFAULT NULL,
  p_veo_url text DEFAULT NULL,
  p_veo_minute text DEFAULT NULL,
  p_feu_tech_indiv text DEFAULT NULL,
  p_feu_physique text DEFAULT NULL,
  p_feu_tech_poste text DEFAULT NULL,
  p_feu_comprehension text DEFAULT NULL,
  p_feu_etat_esprit text DEFAULT NULL,
  p_veo_moments jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.eval_match;
  v_type text;
  v_veo text := nullif(btrim(p_veo_url), '');
  v_moments jsonb := '[]'::jsonb;
  v_el jsonb;
  v_min text;
  v_lib text;
BEGIN
  IF p_personne_id IS NULL OR p_evenement_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id et p_evenement_id requis' USING ERRCODE = '22023';
  END IF;
  SELECT e.type_evenement INTO v_type FROM public.evenements e WHERE e.id = p_evenement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % introuvable', p_evenement_id USING ERRCODE = '02000';
  END IF;
  IF v_type <> 'competition' THEN
    RAISE EXCEPTION 'L''évènement n''est pas un match' USING ERRCODE = '22023';
  END IF;
  IF NOT public._ej_peut_ecrire_joueur(p_personne_id, p_evenement_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF v_veo IS NOT NULL AND v_veo !~* '^https://' THEN
    RAISE EXCEPTION 'Le lien VEO doit commencer par https://' USING ERRCODE = '22023';
  END IF;
  -- D28 : jusqu'à 5 moments (minute requise 10 car., libelle facultatif 60 car.).
  -- Compat : sans p_veo_moments, l'ancien p_veo_minute devient un moment unique.
  IF p_veo_moments IS NULL THEN
    IF nullif(btrim(p_veo_minute), '') IS NOT NULL THEN
      v_moments := jsonb_build_array(jsonb_build_object('minute', btrim(p_veo_minute), 'libelle', NULL));
    END IF;
  ELSE
    IF jsonb_typeof(p_veo_moments) <> 'array' THEN
      RAISE EXCEPTION 'Moments VEO : liste attendue' USING ERRCODE = '22023';
    END IF;
    FOR v_el IN SELECT x FROM jsonb_array_elements(p_veo_moments) x LOOP
      IF jsonb_typeof(v_el) <> 'object' THEN
        RAISE EXCEPTION 'Moments VEO : format invalide' USING ERRCODE = '22023';
      END IF;
      v_min := nullif(btrim(v_el ->> 'minute'), '');
      v_lib := nullif(btrim(v_el ->> 'libelle'), '');
      CONTINUE WHEN v_min IS NULL AND v_lib IS NULL;   -- ligne vide ignorée
      IF v_min IS NULL THEN
        RAISE EXCEPTION 'Chaque moment VEO doit avoir sa minute' USING ERRCODE = '22023';
      END IF;
      IF char_length(v_min) > 10 THEN
        RAISE EXCEPTION 'Minute VEO trop longue (10 caractères maximum)' USING ERRCODE = '22023';
      END IF;
      IF v_lib IS NOT NULL AND char_length(v_lib) > 60 THEN
        RAISE EXCEPTION 'Libellé de moment VEO trop long (60 caractères maximum)' USING ERRCODE = '22023';
      END IF;
      v_moments := v_moments || jsonb_build_array(jsonb_build_object('minute', v_min, 'libelle', v_lib));
    END LOOP;
  END IF;
  IF jsonb_array_length(v_moments) > 5 THEN
    RAISE EXCEPTION '5 moments VEO maximum' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(v_moments) > 0 AND v_veo IS NULL THEN
    RAISE EXCEPTION 'Ajoute le lien VEO du match pour noter des moments' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.eval_match AS m (
    personne_id, evenement_id, feu, point_fort, axe_travail, mot_coach,
    veo_url, veo_moments, redige_par,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit)
  VALUES (
    p_personne_id, p_evenement_id, nullif(upper(btrim(p_feu)), ''),
    nullif(btrim(p_point_fort), ''), nullif(btrim(p_axe_travail), ''),
    nullif(btrim(p_mot_coach), ''), v_veo, v_moments,
    public._ej_moi(),
    nullif(upper(btrim(p_feu_tech_indiv)), ''), nullif(upper(btrim(p_feu_physique)), ''),
    nullif(upper(btrim(p_feu_tech_poste)), ''), nullif(upper(btrim(p_feu_comprehension)), ''),
    nullif(upper(btrim(p_feu_etat_esprit)), ''))
  ON CONFLICT ON CONSTRAINT eval_match_unique DO UPDATE
    SET feu = EXCLUDED.feu, point_fort = EXCLUDED.point_fort,
        axe_travail = EXCLUDED.axe_travail, mot_coach = EXCLUDED.mot_coach,
        veo_url = EXCLUDED.veo_url, veo_moments = EXCLUDED.veo_moments,
        redige_par = EXCLUDED.redige_par,
        feu_tech_indiv = EXCLUDED.feu_tech_indiv, feu_physique = EXCLUDED.feu_physique,
        feu_tech_poste = EXCLUDED.feu_tech_poste, feu_comprehension = EXCLUDED.feu_comprehension,
        feu_etat_esprit = EXCLUDED.feu_etat_esprit
  RETURNING m.* INTO v_row;
  RETURN public._ej_json_match(v_row, true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('enregistrer_eval_match', '_ej_json_match');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: surcharge inattendue (%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) _ej_ ouvert(s)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'enregistrer_eval_match' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: enregistrer_eval_match ouverte à anon'; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('get_espace_joueur', 'repondre_eval', 'envoyer_auto_eval');
  IF v_n <> 3 THEN RAISE EXCEPTION 'VERIF: 3 RPC espace joueur attendues (%)', v_n; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
