-- =====================================================================
-- sql_286_eval_joueur_avenant_c
-- FAIT FOI « EVAL-JOUEUR » v1, §11 Avenant C — RESSOURCES FFR,
--   SOUS-CRITÈRES ET OBJECTIFS, gelé par Manu le 22/11/2026
--   (« je te suis et je gèle »). Lot C1 : socle SQL.
--   D29/D31 6 critères partout (bilans, éval match, auto-évaluation) :
--           + feu_mental (5 colonnes existantes conservées, D32 : seule la
--           signification affichée change)
--   D33/D39 sous-critères « à travailler » (jsonb), seulement sous un
--           critère noté O ou R ; coach (match + bilan) et joueur
--   D36     poste : famille déclarée par le joueur (auto-évaluation) ;
--           poste de compo renvoyé pour les TITULAIRES seulement
--           (remplaçants rangés sur un poste par défaut, cf. sonde 11.1)
--   D40/D41 objectifs du prochain match (3 max, 120 car.) et bilan des
--           objectifs précédents (atteint | en_partie | pas_atteint)
--   D38     codes des sous-critères et familles NON contrôlés en base
--           (référentiel data/criteres-eval.json) : forme seulement
--
-- Contenu :
--   ALTER eval_bilan      + feu_mental, obs_mental, sous_criteres
--   ALTER eval_match      + feu_mental, sous_criteres
--   ALTER auto_eval_match + feu_mental (nullable : lignes antérieures),
--                           sous_criteres, poste_famille, objectifs,
--                           bilan_objectifs
--   Helpers fermés : _ej_norm_sous_criteres, _ej_norm_objectifs,
--                    _ej_norm_bilan_objectifs, _ej_poste_titulaire
--   _ej_json_bilan, _ej_json_match, _ej_json_auto   REMPLACÉS (même signature)
--   enregistrer_eval_bilan, enregistrer_eval_match, envoyer_auto_eval
--                           DROP + CREATE (paramètres ajoutés EN FIN, avec
--                           DEFAULT NULL : le front actuel continue de
--                           fonctionner jusqu'au déploiement de C3/C4 ;
--                           jamais d'overload, règle PGRST203)
--   lister_evals_match      REMPLACÉE : + poste_compo par joueur
--   get_espace_joueur       REMPLACÉE (base sql_282) : a_auto_evaluer
--                           + poste_compo, + objectifs_precedents
-- Transition assumée (tracée) : un enregistrement fait avec l'ANCIEN front
--   entre le COMMIT et le déploiement de C3 remet à vide le critère Mental
--   et les sous-critères de la ligne (l'ancien front ne les connaît pas).
-- Mode : COMMIT (corps identique au dry-run vert, sans les tests).
--   À appliquer via apply_migration (corps sans BEGIN/COMMIT), uniquement
--   sur « feu vert COMMIT » de Manu.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Schéma
-- ---------------------------------------------------------------------
ALTER TABLE public.eval_bilan
  ADD COLUMN feu_mental text,
  ADD COLUMN obs_mental text,
  ADD COLUMN sous_criteres jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.eval_bilan
  ADD CONSTRAINT eval_bilan_mental_check CHECK (feu_mental IS NULL OR feu_mental IN ('V', 'O', 'R')),
  ADD CONSTRAINT eval_bilan_sous_criteres_check CHECK (jsonb_typeof(sous_criteres) = 'object');

ALTER TABLE public.eval_match
  ADD COLUMN feu_mental text,
  ADD COLUMN sous_criteres jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.eval_match
  ADD CONSTRAINT eval_match_mental_check CHECK (feu_mental IS NULL OR feu_mental IN ('V', 'O', 'R')),
  ADD CONSTRAINT eval_match_sous_criteres_check CHECK (jsonb_typeof(sous_criteres) = 'object');

ALTER TABLE public.auto_eval_match
  ADD COLUMN feu_mental text,
  ADD COLUMN sous_criteres jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN poste_famille text,
  ADD COLUMN objectifs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN bilan_objectifs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auto_eval_match
  ADD CONSTRAINT auto_eval_match_mental_check CHECK (feu_mental IS NULL OR feu_mental IN ('V', 'O', 'R')),
  ADD CONSTRAINT auto_eval_match_sous_criteres_check CHECK (jsonb_typeof(sous_criteres) = 'object'),
  ADD CONSTRAINT auto_eval_match_poste_check CHECK (poste_famille IS NULL OR poste_famille ~ '^[a-z0-9_]{1,30}$'),
  ADD CONSTRAINT auto_eval_match_objectifs_check CHECK (jsonb_typeof(objectifs) = 'array' AND jsonb_array_length(objectifs) <= 3),
  ADD CONSTRAINT auto_eval_match_bilan_obj_check CHECK (jsonb_typeof(bilan_objectifs) = 'array' AND jsonb_array_length(bilan_objectifs) <= 3);

COMMENT ON COLUMN public.eval_bilan.sous_criteres IS
  'EVAL-JOUEUR Avenant C (D33/D39) : {"<critère>": ["<code>", …]}, seulement sous un critère O ou R. Codes : data/criteres-eval.json (sql_286).';
COMMENT ON COLUMN public.eval_match.sous_criteres IS
  'EVAL-JOUEUR Avenant C (D33) : sous-critères cochés par le coach, seulement sous un critère O ou R (sql_286).';
COMMENT ON COLUMN public.auto_eval_match.sous_criteres IS
  'EVAL-JOUEUR Avenant C (D33) : sous-critères cochés par le joueur, seulement sous un critère O ou R (sql_286).';
COMMENT ON COLUMN public.auto_eval_match.poste_famille IS
  'EVAL-JOUEUR Avenant C (D36) : famille de postes déclarée par le joueur (code du référentiel data/criteres-eval.json).';
COMMENT ON COLUMN public.auto_eval_match.objectifs IS
  'EVAL-JOUEUR Avenant C (D40) : objectifs pour le prochain match, 3 au plus, 120 car. chacun.';
COMMENT ON COLUMN public.auto_eval_match.bilan_objectifs IS
  'EVAL-JOUEUR Avenant C (D41) : [{objectif, resultat: atteint|en_partie|pas_atteint}] sur les objectifs de l''auto-évaluation précédente.';

-- ---------------------------------------------------------------------
-- 2. Helpers (fermés)
-- ---------------------------------------------------------------------
-- D33 : normalise et contrôle les sous-critères. p_feux = {"<critère>": "V|O|R|null"}.
CREATE FUNCTION public._ej_norm_sous_criteres(p jsonb, p_feux jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_out jsonb := '{}'::jsonb;
  v_cle text;
  v_val jsonb;
  v_el jsonb;
  v_code text;
  v_liste jsonb;
BEGIN
  IF p IS NULL OR p = 'null'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;
  IF jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Sous-critères : objet attendu' USING ERRCODE = '22023';
  END IF;
  FOR v_cle, v_val IN SELECT k, v FROM jsonb_each(p) AS t (k, v) LOOP
    IF v_cle NOT IN ('tech_indiv', 'physique', 'tech_poste', 'comprehension', 'etat_esprit', 'mental') THEN
      RAISE EXCEPTION 'Sous-critères : critère inconnu (%)', v_cle USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_val) <> 'array' THEN
      RAISE EXCEPTION 'Sous-critères : liste attendue pour %', v_cle USING ERRCODE = '22023';
    END IF;
    v_liste := '[]'::jsonb;
    FOR v_el IN SELECT x FROM jsonb_array_elements(v_val) x LOOP
      IF jsonb_typeof(v_el) <> 'string' THEN
        RAISE EXCEPTION 'Sous-critères : code texte attendu' USING ERRCODE = '22023';
      END IF;
      v_code := btrim(v_el #>> '{}');
      CONTINUE WHEN v_code = '';
      IF v_code !~ '^[a-z0-9_-]{1,40}$' THEN
        RAISE EXCEPTION 'Sous-critères : code invalide (%)', v_code USING ERRCODE = '22023';
      END IF;
      IF NOT v_liste ? v_code THEN
        v_liste := v_liste || to_jsonb(v_code);
      END IF;
    END LOOP;
    CONTINUE WHEN jsonb_array_length(v_liste) = 0;
    IF jsonb_array_length(v_liste) > 20 THEN
      RAISE EXCEPTION 'Sous-critères : 20 au plus par critère' USING ERRCODE = '22023';
    END IF;
    IF coalesce(p_feux ->> v_cle, '') NOT IN ('O', 'R') THEN
      RAISE EXCEPTION 'Sous-critères possibles seulement sous un critère noté O ou R (%)', v_cle USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object(v_cle, v_liste);
  END LOOP;
  RETURN v_out;
END;
$fn$;

-- D40 : objectifs du prochain match (3 au plus, 120 car., lignes vides ignorées).
CREATE FUNCTION public._ej_norm_objectifs(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_el jsonb;
  v_txt text;
BEGIN
  IF p IS NULL OR p = 'null'::jsonb THEN
    RETURN '[]'::jsonb;
  END IF;
  IF jsonb_typeof(p) <> 'array' THEN
    RAISE EXCEPTION 'Objectifs : liste attendue' USING ERRCODE = '22023';
  END IF;
  FOR v_el IN SELECT x FROM jsonb_array_elements(p) x LOOP
    IF jsonb_typeof(v_el) <> 'string' THEN
      RAISE EXCEPTION 'Objectifs : texte attendu' USING ERRCODE = '22023';
    END IF;
    v_txt := btrim(v_el #>> '{}');
    CONTINUE WHEN v_txt = '';
    IF char_length(v_txt) > 120 THEN
      RAISE EXCEPTION 'Objectif trop long (120 caractères maximum)' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || to_jsonb(v_txt);
  END LOOP;
  IF jsonb_array_length(v_out) > 3 THEN
    RAISE EXCEPTION '3 objectifs maximum' USING ERRCODE = '22023';
  END IF;
  RETURN v_out;
END;
$fn$;

-- D41 : bilan des objectifs précédents ; une entrée sans résultat est ignorée (facultatif).
CREATE FUNCTION public._ej_norm_bilan_objectifs(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_el jsonb;
  v_obj text;
  v_res text;
BEGIN
  IF p IS NULL OR p = 'null'::jsonb THEN
    RETURN '[]'::jsonb;
  END IF;
  IF jsonb_typeof(p) <> 'array' THEN
    RAISE EXCEPTION 'Bilan des objectifs : liste attendue' USING ERRCODE = '22023';
  END IF;
  FOR v_el IN SELECT x FROM jsonb_array_elements(p) x LOOP
    IF jsonb_typeof(v_el) <> 'object' THEN
      RAISE EXCEPTION 'Bilan des objectifs : format invalide' USING ERRCODE = '22023';
    END IF;
    v_obj := nullif(btrim(v_el ->> 'objectif'), '');
    v_res := nullif(btrim(v_el ->> 'resultat'), '');
    CONTINUE WHEN v_res IS NULL;
    IF v_obj IS NULL OR char_length(v_obj) > 120 THEN
      RAISE EXCEPTION 'Bilan des objectifs : objectif manquant ou trop long' USING ERRCODE = '22023';
    END IF;
    IF v_res NOT IN ('atteint', 'en_partie', 'pas_atteint') THEN
      RAISE EXCEPTION 'Bilan des objectifs : résultat invalide (%)', v_res USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('objectif', v_obj, 'resultat', v_res));
  END LOOP;
  IF jsonb_array_length(v_out) > 3 THEN
    RAISE EXCEPTION 'Bilan des objectifs : 3 au plus' USING ERRCODE = '22023';
  END IF;
  RETURN v_out;
END;
$fn$;

-- D36 : code du poste de compo, pour un TITULAIRE seulement (même compo que
-- lister_evals_match : compo 'match' active côté mom la plus récente).
CREATE FUNCTION public._ej_poste_titulaire(p_personne_id uuid, p_evenement_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT po.code
  FROM public.composition_joueurs cj
  JOIN public.postes po ON po.id::text = cj.poste_id
  WHERE cj.joueur_id = p_personne_id
    AND cj.role = 'titulaire'
    AND cj.composition_id = (SELECT co.id FROM public.compositions co
                             WHERE co.evenement_id = p_evenement_id
                               AND co.type_compo = 'match' AND co.cote = 'mom' AND co.est_active
                             ORDER BY co.updated_at DESC NULLS LAST
                             LIMIT 1)
  ORDER BY cj.numero_maillot NULLS LAST
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public._ej_norm_sous_criteres(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_norm_objectifs(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_norm_bilan_objectifs(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_poste_titulaire(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Sérialisation JSON (mêmes signatures ; droits conservés)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ej_json_bilan(b public.eval_bilan, p_staff boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', b.id, 'periode', b.periode, 'statut', b.statut,
    'objectif_1', b.objectif_1, 'objectif_2', b.objectif_2,
    'feux', jsonb_build_object(
      'tech_indiv', b.feu_tech_indiv, 'physique', b.feu_physique,
      'tech_poste', b.feu_tech_poste, 'comprehension', b.feu_comprehension,
      'etat_esprit', b.feu_etat_esprit, 'mental', b.feu_mental),
    'obs', jsonb_build_object(
      'tech_indiv', b.obs_tech_indiv, 'physique', b.obs_physique,
      'tech_poste', b.obs_tech_poste, 'comprehension', b.obs_comprehension,
      'etat_esprit', b.obs_etat_esprit, 'mental', b.obs_mental),
    'sous_criteres', b.sous_criteres,
    'publie_le', b.publie_le,
    'publie_par_prenom', (SELECT p.prenom FROM public.personnes p WHERE p.id = b.publie_par),
    'reponse_joueur', b.reponse_joueur, 'reponse_le', b.reponse_le)
  || CASE WHEN p_staff THEN jsonb_build_object(
       'redige_par', b.redige_par,
       'redige_par_nom', (SELECT p.prenom || ' ' || p.nom FROM public.personnes p WHERE p.id = b.redige_par),
       'updated_at', b.updated_at)
     ELSE '{}'::jsonb END;
$fn$;

CREATE OR REPLACE FUNCTION public._ej_json_auto(a public.auto_eval_match)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', a.id, 'evenement_id', a.evenement_id,
    'feux', jsonb_build_object(
      'tech_indiv', a.feu_tech_indiv, 'physique', a.feu_physique, 'tech_poste', a.feu_tech_poste,
      'comprehension', a.feu_comprehension, 'etat_esprit', a.feu_etat_esprit, 'mental', a.feu_mental),
    'sous_criteres', a.sous_criteres,
    'poste_famille', a.poste_famille,
    'objectifs', a.objectifs,
    'bilan_objectifs', a.bilan_objectifs,
    'commentaire', a.commentaire, 'envoye_le', a.envoye_le,
    'gene', jsonb_build_object('signalee', a.gene_signalee, 'detail', a.gene_detail),
    'match', (SELECT jsonb_build_object(
                'date', (coalesce(e.date_debut, ep.date_debut) AT TIME ZONE 'Europe/Paris')::date,
                'libelle', e.libelle, 'adversaire', e.adversaire_nom,
                'niveau', public._ej_niveau(e.id))
              FROM public.evenements e
              LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
              WHERE e.id = a.evenement_id));
$fn$;

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
      'comprehension', m.feu_comprehension, 'etat_esprit', m.feu_etat_esprit, 'mental', m.feu_mental),
    'sous_criteres', m.sous_criteres,
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

-- ---------------------------------------------------------------------
-- 4. enregistrer_eval_bilan : DROP + CREATE (+ mental, + sous-critères)
-- ---------------------------------------------------------------------
DROP FUNCTION public.enregistrer_eval_bilan(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid);
CREATE FUNCTION public.enregistrer_eval_bilan(
  p_personne_id uuid,
  p_periode text,
  p_objectif_1 text DEFAULT NULL,
  p_objectif_2 text DEFAULT NULL,
  p_feu_tech_indiv text DEFAULT NULL,
  p_feu_physique text DEFAULT NULL,
  p_feu_tech_poste text DEFAULT NULL,
  p_feu_comprehension text DEFAULT NULL,
  p_feu_etat_esprit text DEFAULT NULL,
  p_obs_tech_indiv text DEFAULT NULL,
  p_obs_physique text DEFAULT NULL,
  p_obs_tech_poste text DEFAULT NULL,
  p_obs_comprehension text DEFAULT NULL,
  p_obs_etat_esprit text DEFAULT NULL,
  p_saison_id uuid DEFAULT NULL,
  p_feu_mental text DEFAULT NULL,
  p_obs_mental text DEFAULT NULL,
  p_sous_criteres jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
  v_row public.eval_bilan;
  v_feux jsonb := jsonb_build_object(
    'tech_indiv', nullif(upper(btrim(p_feu_tech_indiv)), ''),
    'physique', nullif(upper(btrim(p_feu_physique)), ''),
    'tech_poste', nullif(upper(btrim(p_feu_tech_poste)), ''),
    'comprehension', nullif(upper(btrim(p_feu_comprehension)), ''),
    'etat_esprit', nullif(upper(btrim(p_feu_etat_esprit)), ''),
    'mental', nullif(upper(btrim(p_feu_mental)), ''));
  v_sc jsonb;
BEGIN
  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  IF v_saison IS NULL THEN
    RAISE EXCEPTION 'Aucune saison active' USING ERRCODE = '22023';
  END IF;
  IF p_periode IS NULL OR p_periode NOT IN ('pre_saison', 'p1', 'p2', 'p3') THEN
    RAISE EXCEPTION 'Période invalide (pre_saison | p1 | p2 | p3)' USING ERRCODE = '22023';
  END IF;
  IF NOT public._ej_peut_ecrire_joueur(p_personne_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  v_sc := public._ej_norm_sous_criteres(p_sous_criteres, v_feux);
  INSERT INTO public.eval_bilan AS b (
    personne_id, saison_id, periode, objectif_1, objectif_2,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit, feu_mental,
    obs_tech_indiv, obs_physique, obs_tech_poste, obs_comprehension, obs_etat_esprit, obs_mental,
    sous_criteres, redige_par)
  VALUES (
    p_personne_id, v_saison, p_periode,
    nullif(btrim(p_objectif_1), ''), nullif(btrim(p_objectif_2), ''),
    v_feux ->> 'tech_indiv', v_feux ->> 'physique', v_feux ->> 'tech_poste',
    v_feux ->> 'comprehension', v_feux ->> 'etat_esprit', v_feux ->> 'mental',
    nullif(btrim(p_obs_tech_indiv), ''), nullif(btrim(p_obs_physique), ''),
    nullif(btrim(p_obs_tech_poste), ''), nullif(btrim(p_obs_comprehension), ''),
    nullif(btrim(p_obs_etat_esprit), ''), nullif(btrim(p_obs_mental), ''),
    v_sc, public._ej_moi())
  ON CONFLICT ON CONSTRAINT eval_bilan_unique DO UPDATE
    SET objectif_1 = EXCLUDED.objectif_1, objectif_2 = EXCLUDED.objectif_2,
        feu_tech_indiv = EXCLUDED.feu_tech_indiv, feu_physique = EXCLUDED.feu_physique,
        feu_tech_poste = EXCLUDED.feu_tech_poste, feu_comprehension = EXCLUDED.feu_comprehension,
        feu_etat_esprit = EXCLUDED.feu_etat_esprit, feu_mental = EXCLUDED.feu_mental,
        obs_tech_indiv = EXCLUDED.obs_tech_indiv, obs_physique = EXCLUDED.obs_physique,
        obs_tech_poste = EXCLUDED.obs_tech_poste, obs_comprehension = EXCLUDED.obs_comprehension,
        obs_etat_esprit = EXCLUDED.obs_etat_esprit, obs_mental = EXCLUDED.obs_mental,
        sous_criteres = EXCLUDED.sous_criteres,
        redige_par = EXCLUDED.redige_par
  RETURNING b.* INTO v_row;
  RETURN public._ej_json_bilan(v_row, true);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 5. enregistrer_eval_match : DROP + CREATE (+ mental, + sous-critères)
-- ---------------------------------------------------------------------
DROP FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb);
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
  p_veo_moments jsonb DEFAULT NULL,
  p_feu_mental text DEFAULT NULL,
  p_sous_criteres jsonb DEFAULT NULL
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
  v_feux jsonb := jsonb_build_object(
    'tech_indiv', nullif(upper(btrim(p_feu_tech_indiv)), ''),
    'physique', nullif(upper(btrim(p_feu_physique)), ''),
    'tech_poste', nullif(upper(btrim(p_feu_tech_poste)), ''),
    'comprehension', nullif(upper(btrim(p_feu_comprehension)), ''),
    'etat_esprit', nullif(upper(btrim(p_feu_etat_esprit)), ''),
    'mental', nullif(upper(btrim(p_feu_mental)), ''));
  v_sc jsonb;
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
  v_sc := public._ej_norm_sous_criteres(p_sous_criteres, v_feux);

  INSERT INTO public.eval_match AS m (
    personne_id, evenement_id, feu, point_fort, axe_travail, mot_coach,
    veo_url, veo_moments, redige_par,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit, feu_mental,
    sous_criteres)
  VALUES (
    p_personne_id, p_evenement_id, nullif(upper(btrim(p_feu)), ''),
    nullif(btrim(p_point_fort), ''), nullif(btrim(p_axe_travail), ''),
    nullif(btrim(p_mot_coach), ''), v_veo, v_moments,
    public._ej_moi(),
    v_feux ->> 'tech_indiv', v_feux ->> 'physique', v_feux ->> 'tech_poste',
    v_feux ->> 'comprehension', v_feux ->> 'etat_esprit', v_feux ->> 'mental',
    v_sc)
  ON CONFLICT ON CONSTRAINT eval_match_unique DO UPDATE
    SET feu = EXCLUDED.feu, point_fort = EXCLUDED.point_fort,
        axe_travail = EXCLUDED.axe_travail, mot_coach = EXCLUDED.mot_coach,
        veo_url = EXCLUDED.veo_url, veo_moments = EXCLUDED.veo_moments,
        redige_par = EXCLUDED.redige_par,
        feu_tech_indiv = EXCLUDED.feu_tech_indiv, feu_physique = EXCLUDED.feu_physique,
        feu_tech_poste = EXCLUDED.feu_tech_poste, feu_comprehension = EXCLUDED.feu_comprehension,
        feu_etat_esprit = EXCLUDED.feu_etat_esprit, feu_mental = EXCLUDED.feu_mental,
        sous_criteres = EXCLUDED.sous_criteres
  RETURNING m.* INTO v_row;
  RETURN public._ej_json_match(v_row, true);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 6. envoyer_auto_eval : DROP + CREATE (+ mental, sous-critères, poste,
--    objectifs, bilan des objectifs). Mental facultatif en base (compat
--    ancien front) ; l'écran C4 l'exige.
-- ---------------------------------------------------------------------
DROP FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, boolean, text, text);
CREATE FUNCTION public.envoyer_auto_eval(
  p_token text,
  p_evenement_id uuid,
  p_feu_tech_indiv text,
  p_feu_physique text,
  p_feu_tech_poste text,
  p_feu_comprehension text,
  p_feu_etat_esprit text,
  p_gene_signalee boolean,
  p_gene_detail text DEFAULT NULL,
  p_commentaire text DEFAULT NULL,
  p_feu_mental text DEFAULT NULL,
  p_sous_criteres jsonb DEFAULT NULL,
  p_poste_famille text DEFAULT NULL,
  p_objectifs jsonb DEFAULT NULL,
  p_bilan_objectifs jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pid uuid := public._ej_personne_du_jeton(p_token);
  v_txt text := nullif(btrim(p_commentaire), '');
  v_gene text := nullif(btrim(p_gene_detail), '');
  v_row public.auto_eval_match;
  v_feux text[] := ARRAY[upper(btrim(p_feu_tech_indiv)), upper(btrim(p_feu_physique)),
                         upper(btrim(p_feu_tech_poste)), upper(btrim(p_feu_comprehension)),
                         upper(btrim(p_feu_etat_esprit))];
  v_mental text := nullif(upper(btrim(p_feu_mental)), '');
  v_poste text := nullif(lower(btrim(p_poste_famille)), '');
  v_sc jsonb;
  v_obj jsonb;
  v_bilan jsonb;
BEGIN
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_feux) f WHERE f IS NULL OR f NOT IN ('V', 'O', 'R')) THEN
    RAISE EXCEPTION 'Les critères doivent être notés (V, O ou R)' USING ERRCODE = '22023';
  END IF;
  IF v_mental IS NOT NULL AND v_mental NOT IN ('V', 'O', 'R') THEN
    RAISE EXCEPTION 'Critère Mental invalide (V, O ou R)' USING ERRCODE = '22023';
  END IF;
  IF v_poste IS NOT NULL AND v_poste !~ '^[a-z0-9_]{1,30}$' THEN
    RAISE EXCEPTION 'Famille de postes invalide' USING ERRCODE = '22023';
  END IF;
  IF p_gene_signalee IS NULL THEN
    RAISE EXCEPTION 'Réponds à la question sur une blessure, une gêne ou une fatigue' USING ERRCODE = '22023';
  END IF;
  -- D24 : si Non, un éventuel détail est ignoré ; si Oui, il est requis.
  IF NOT p_gene_signalee THEN
    v_gene := NULL;
  ELSIF v_gene IS NULL THEN
    RAISE EXCEPTION 'Explique-nous ta blessure, ta gêne ou ta fatigue' USING ERRCODE = '22023';
  ELSIF char_length(v_gene) > 500 THEN
    RAISE EXCEPTION 'Explication trop longue (500 caractères maximum)' USING ERRCODE = '22023';
  END IF;
  IF v_txt IS NOT NULL AND char_length(v_txt) > 280 THEN
    RAISE EXCEPTION 'Commentaire trop long (280 caractères maximum)' USING ERRCODE = '22023';
  END IF;
  v_sc := public._ej_norm_sous_criteres(p_sous_criteres, jsonb_build_object(
    'tech_indiv', v_feux[1], 'physique', v_feux[2], 'tech_poste', v_feux[3],
    'comprehension', v_feux[4], 'etat_esprit', v_feux[5], 'mental', v_mental));
  v_obj := public._ej_norm_objectifs(p_objectifs);
  v_bilan := public._ej_norm_bilan_objectifs(p_bilan_objectifs);
  IF EXISTS (SELECT 1 FROM public.auto_eval_match a
             WHERE a.personne_id = v_pid AND a.evenement_id = p_evenement_id) THEN
    RAISE EXCEPTION 'Auto-évaluation déjà envoyée pour ce match' USING ERRCODE = '23505';
  END IF;
  IF NOT public._ej_match_auto_evaluable(v_pid, p_evenement_id) THEN
    RAISE EXCEPTION 'Ce match ne peut pas être auto-évalué' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.auto_eval_match (personne_id, evenement_id,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit, feu_mental,
    commentaire, gene_signalee, gene_detail,
    sous_criteres, poste_famille, objectifs, bilan_objectifs)
  VALUES (v_pid, p_evenement_id, v_feux[1], v_feux[2], v_feux[3], v_feux[4], v_feux[5], v_mental,
          v_txt, p_gene_signalee, v_gene,
          v_sc, v_poste, v_obj, v_bilan)
  RETURNING * INTO v_row;
  RETURN public._ej_json_auto(v_row);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 7. lister_evals_match (même signature) : + poste_compo (titulaires, D36)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lister_evals_match(p_evenement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
  v_compo uuid;
  v_out jsonb;
BEGIN
  IF p_evenement_id IS NULL THEN
    RAISE EXCEPTION 'p_evenement_id requis' USING ERRCODE = '22023';
  END IF;
  v_cat := public._ej_cat_evenement(p_evenement_id);
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'Match % introuvable ou sans catégorie', p_evenement_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;

  SELECT co.id INTO v_compo
  FROM public.compositions co
  WHERE co.evenement_id = p_evenement_id
    AND co.type_compo = 'match' AND co.cote = 'mom' AND co.est_active
  ORDER BY co.updated_at DESC NULLS LAST
  LIMIT 1;

  WITH feuille AS (
    SELECT cj.joueur_id AS pid, min(cj.numero_maillot) AS num
    FROM public.composition_joueurs cj
    WHERE v_compo IS NOT NULL AND cj.composition_id = v_compo
    GROUP BY cj.joueur_id
    UNION
    SELECT m.personne_id, NULL::int
    FROM public.eval_match m
    WHERE m.evenement_id = p_evenement_id
      AND NOT EXISTS (SELECT 1 FROM public.composition_joueurs cj2
                      WHERE v_compo IS NOT NULL AND cj2.composition_id = v_compo
                        AND cj2.joueur_id = m.personne_id)
  )
  SELECT jsonb_build_object(
    'match', (SELECT jsonb_build_object(
                'evenement_id', e.id,
                'date', (e.date_debut AT TIME ZONE 'Europe/Paris')::date,
                'libelle', e.libelle, 'adversaire', e.adversaire_nom,
                'domicile_exterieur', e.domicile_exterieur,
                'score_mom', e.score_mom, 'score_adverse', e.score_adverse,
                'niveau', public._ej_niveau(e.id),
                'categorie_id', v_cat)
              FROM public.evenements e WHERE e.id = p_evenement_id),
    'avec_compo', v_compo IS NOT NULL,
    'joueurs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'personne_id', p.id, 'nom', p.nom, 'prenom', p.prenom, 'numero', f.num,
               'club', (SELECT cl.nom_court FROM public.clubs cl WHERE cl.id = p.club_principal_id),
               'poste_compo', public._ej_poste_titulaire(p.id, p_evenement_id),
               'eval', (SELECT public._ej_json_match(m, true) FROM public.eval_match m
                        WHERE m.evenement_id = p_evenement_id AND m.personne_id = p.id),
               'auto_eval', (SELECT public._ej_json_auto(a) FROM public.auto_eval_match a
                             WHERE a.evenement_id = p_evenement_id AND a.personne_id = p.id))
             ORDER BY f.num NULLS LAST, p.nom, p.prenom)
      FROM feuille f JOIN public.personnes p ON p.id = f.pid), '[]'::jsonb),
    'joueurs_categorie', CASE WHEN v_compo IS NULL THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object('personne_id', p.id, 'nom', p.nom, 'prenom', p.prenom,
               'club', (SELECT cl.nom_court FROM public.clubs cl WHERE cl.id = p.club_principal_id))
             ORDER BY p.nom, p.prenom)
      FROM public.personnes p
      WHERE p.categorie_id = v_cat AND NOT coalesce(p.est_archive, false)
        AND p.type_personne IN ('licencie_competition', 'licencie_externe_partenaire')), '[]'::jsonb)
      ELSE '[]'::jsonb END)
  INTO v_out;
  RETURN v_out;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 8. get_espace_joueur (même signature ; base sql_282) :
--    a_auto_evaluer + poste_compo (D36) + objectifs_precedents (D41)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_espace_joueur(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pid uuid := public._ej_personne_du_jeton(p_token);
  v_saison uuid := public._pp_saison_active();
  v_precedente timestamptz;
  v_lien uuid;
  v_out jsonb;
BEGIN
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  -- sql_268 (B4) : p_token = jeton de SESSION ; la consultation est notée sur le lien.
  SELECT l.id, l.derniere_consultation INTO v_lien, v_precedente
  FROM public.session_espace_joueur s
  JOIN public.lien_espace_joueur l ON l.id = s.lien_id
  WHERE s.jeton = p_token AND s.expire_le > now() AND NOT l.revoque;
  UPDATE public.lien_espace_joueur l
    SET derniere_consultation = now()
    WHERE l.id = v_lien;
  SELECT jsonb_build_object(
    'joueur', jsonb_build_object(
      'prenom', p.prenom, 'nom', p.nom,
      'categorie_code', (SELECT c.code FROM public.categories c WHERE c.id = p.categorie_id)),
    'saison', (SELECT s.code FROM public.saisons s WHERE s.id = v_saison),
    'visite_precedente', v_precedente,
    'bilans', coalesce((SELECT jsonb_agg(public._ej_json_bilan(b, false)
                                         ORDER BY array_position(ARRAY['pre_saison','p1','p2','p3'], b.periode))
                        FROM public.eval_bilan b
                        WHERE b.personne_id = v_pid AND b.saison_id = v_saison
                          AND b.statut = 'publie'), '[]'::jsonb),
    'matchs', coalesce((SELECT jsonb_agg(public._ej_json_match(m, false)
                                         ORDER BY e.date_debut DESC NULLS LAST)
                        FROM public.eval_match m
                        JOIN public.evenements e ON e.id = m.evenement_id
                        WHERE m.personne_id = v_pid AND e.saison_id = v_saison
                          AND m.statut = 'publie'), '[]'::jsonb),
    -- Avenant A (D18) : matchs passés de la saison où le joueur est sur la
    -- feuille et n'a pas encore envoyé son auto-évaluation.
    -- Avenant C : + poste_compo (titulaire seulement, D36) ; + objectifs de
    -- l'auto-évaluation précédente, à rappeler (D41).
    'a_auto_evaluer', coalesce((SELECT jsonb_agg(jsonb_build_object(
                          'evenement_id', e.id,
                          'date', (coalesce(e.date_debut, ep.date_debut) AT TIME ZONE 'Europe/Paris')::date,
                          'libelle', e.libelle, 'adversaire', e.adversaire_nom,
                          'niveau', public._ej_niveau(e.id),
                          'poste_compo', public._ej_poste_titulaire(v_pid, e.id),
                          'objectifs_precedents', (
                            SELECT CASE WHEN jsonb_array_length(a2.objectifs) = 0 THEN NULL
                                   ELSE jsonb_build_object(
                                     'evenement_id', a2.evenement_id,
                                     'date', (coalesce(e2.date_debut, ep2.date_debut) AT TIME ZONE 'Europe/Paris')::date,
                                     'adversaire', e2.adversaire_nom,
                                     'objectifs', a2.objectifs) END
                            FROM public.auto_eval_match a2
                            JOIN public.evenements e2 ON e2.id = a2.evenement_id
                            LEFT JOIN public.evenements ep2 ON ep2.id = e2.evenement_parent_id
                            WHERE a2.personne_id = v_pid
                              AND coalesce(e2.date_debut, ep2.date_debut) < coalesce(e.date_debut, ep.date_debut)
                            ORDER BY coalesce(e2.date_debut, ep2.date_debut) DESC
                            LIMIT 1))
                        ORDER BY coalesce(e.date_debut, ep.date_debut) DESC NULLS LAST)
                        FROM public.evenements e
                        LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
                        WHERE e.type_evenement = 'competition' AND e.saison_id = v_saison
                          AND public._ej_match_auto_evaluable(v_pid, e.id)), '[]'::jsonb),
    -- Avenant A (D23) : auto-évaluations envoyées (frise « Comment je me vois »).
    'auto_evals', coalesce((SELECT jsonb_agg(public._ej_json_auto(a) ORDER BY e.date_debut DESC NULLS LAST)
                            FROM public.auto_eval_match a
                            JOIN public.evenements e ON e.id = a.evenement_id
                            WHERE a.personne_id = v_pid AND e.saison_id = v_saison), '[]'::jsonb),
    -- sql_282 (PARCOURS-PERFORMANCE v1.3, D20) : section Mon Parcours.
    'parcours', public._ej_json_parcours(v_pid, v_saison))
  INTO v_out
  FROM public.personnes p WHERE p.id = v_pid;
  RETURN v_out;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 9. Droits d'exécution (fonctions recréées ; les CREATE OR REPLACE
--    conservent les droits existants)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.enregistrer_eval_bilan(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_eval_bilan(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, boolean, text, text, text, jsonb, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, boolean, text, text, text, jsonb, text, jsonb, jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('enregistrer_eval_bilan', 'enregistrer_eval_match', 'envoyer_auto_eval',
                      '_ej_json_bilan', '_ej_json_match', '_ej_json_auto', 'lister_evals_match', 'get_espace_joueur');
  IF v_n <> 8 THEN RAISE EXCEPTION 'VERIF: surcharge ou fonction manquante (% au lieu de 8)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) _ej_ ouvert(s)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('get_espace_joueur', 'repondre_eval', 'envoyer_auto_eval',
                      'etat_acces_espace', 'definir_code_espace', 'ouvrir_session_espace');
  IF v_n <> 6 THEN RAISE EXCEPTION 'VERIF: les 6 RPC espace joueur doivent être ouvertes à anon (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('enregistrer_eval_bilan', 'enregistrer_eval_match', 'lister_evals_match', 'lister_evals_joueur');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: RPC staff ouverte(s) à anon (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND p.proname IN ('enregistrer_eval_bilan', 'enregistrer_eval_match', 'envoyer_auto_eval', 'lister_evals_match');
  IF v_n <> 4 THEN RAISE EXCEPTION 'VERIF: RPC non accordée(s) à authenticated (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM information_schema.columns
  WHERE table_schema = 'public'
    AND ((table_name = 'eval_bilan' AND column_name IN ('feu_mental', 'obs_mental', 'sous_criteres'))
      OR (table_name = 'eval_match' AND column_name IN ('feu_mental', 'sous_criteres'))
      OR (table_name = 'auto_eval_match' AND column_name IN ('feu_mental', 'sous_criteres', 'poste_famille', 'objectifs', 'bilan_objectifs')));
  IF v_n <> 10 THEN RAISE EXCEPTION 'VERIF: colonnes Avenant C (% au lieu de 10)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('eval_bilan', 'eval_match', 'auto_eval_match') AND c.relrowsecurity;
  IF v_n <> 3 THEN RAISE EXCEPTION 'VERIF: RLS inactive sur une table EVAL-JOUEUR'; END IF;

  SELECT count(*) INTO v_n FROM public.eval_bilan WHERE feu_mental IS NOT NULL OR sous_criteres <> '{}'::jsonb;
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: données existantes modifiées (eval_bilan : %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.eval_match WHERE feu_mental IS NOT NULL OR sous_criteres <> '{}'::jsonb;
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: données existantes modifiées (eval_match : %)', v_n; END IF;

  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
