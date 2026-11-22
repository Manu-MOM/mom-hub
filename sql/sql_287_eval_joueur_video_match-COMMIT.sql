-- =====================================================================
-- sql_287_eval_joueur_video_match
-- FAIT FOI « EVAL-JOUEUR » v1, §12 Avenant D — VIDÉO VEO DU MATCH, gelé
--   par Manu le 22/11/2026 (« je gèle »). Lot D1 : socle SQL.
--   D46 un lien VEO par match (table video_match, RPC seulement ; droits :
--       admin, bureau, encadrants de la catégorie du match ; https://)
--   D47 le lien du match alimente toutes les évals (repli : ancien lien de
--       l'éval) ; moments acceptés si le match a un lien
--   D48 vidéos visibles de toute la feuille (clé 'videos' de
--       get_espace_joueur, + veo_url sur a_auto_evaluer)
--   D49 vidéo visible même si l'éval du coach est verrouillée
--   D50 modifier / effacer le lien vaut pour tout le monde
--
-- Contenu :
--   CREATE TABLE video_match (RLS, aucun accès direct)
--   Helper fermé _ej_veo_match ; RPC definir_video_match (authenticated)
--   _ej_json_match, enregistrer_eval_match, lister_evals_match,
--   get_espace_joueur : REMPLACÉES à signature identique (base sql_286)
-- Choix technique tracé : enregistrer_eval_match sans lien transmis garde
--   l'ancien lien de l'éval (coalesce) : ce repli ne s'efface plus depuis
--   l'écran (le champ individuel disparaît, D47).
-- Mode : COMMIT (corps identique au dry-run vert, sans les tests).
--   À appliquer via apply_migration (corps sans BEGIN/COMMIT), uniquement
--   sur « feu vert COMMIT » de Manu.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE public.video_match (
  evenement_id uuid PRIMARY KEY REFERENCES public.evenements (id) ON DELETE CASCADE,
  veo_url text NOT NULL CONSTRAINT video_match_url_check CHECK (veo_url ~* '^https://' AND char_length(veo_url) <= 500),
  maj_par uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.video_match IS
  'EVAL-JOUEUR Avenant D (D46) : lien VEO du match, une ligne par match. Lecture / écriture par RPC uniquement (sql_287).';
ALTER TABLE public.video_match ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.video_match FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Helper fermé et RPC staff
-- ---------------------------------------------------------------------
CREATE FUNCTION public._ej_veo_match(p_evenement_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT v.veo_url FROM public.video_match v WHERE v.evenement_id = p_evenement_id;
$fn$;
REVOKE ALL ON FUNCTION public._ej_veo_match(uuid) FROM PUBLIC, anon, authenticated;

-- D46/D50 : lien vide = suppression (pour tout le monde).
CREATE FUNCTION public.definir_video_match(p_evenement_id uuid, p_veo_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_type text;
  v_cat uuid;
  v_url text := nullif(btrim(p_veo_url), '');
BEGIN
  IF p_evenement_id IS NULL THEN
    RAISE EXCEPTION 'p_evenement_id requis' USING ERRCODE = '22023';
  END IF;
  SELECT e.type_evenement INTO v_type FROM public.evenements e WHERE e.id = p_evenement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % introuvable', p_evenement_id USING ERRCODE = '02000';
  END IF;
  IF v_type <> 'competition' THEN
    RAISE EXCEPTION 'L''évènement n''est pas un match' USING ERRCODE = '22023';
  END IF;
  v_cat := public._ej_cat_evenement(p_evenement_id);
  IF auth.uid() IS NULL OR NOT (public.has_role('admin') OR public.has_role('bureau')
          OR (v_cat IS NOT NULL AND public.puis_je_ecrire_categorie(v_cat))) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF v_url IS NULL THEN
    DELETE FROM public.video_match v WHERE v.evenement_id = p_evenement_id;
    RETURN jsonb_build_object('evenement_id', p_evenement_id, 'veo_url', NULL);
  END IF;
  IF v_url !~* '^https://' THEN
    RAISE EXCEPTION 'Le lien VEO doit commencer par https://' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_url) > 500 THEN
    RAISE EXCEPTION 'Lien VEO trop long (500 caractères maximum)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.video_match AS v (evenement_id, veo_url, maj_par, updated_at)
  VALUES (p_evenement_id, v_url, public._ej_moi(), now())
  ON CONFLICT (evenement_id) DO UPDATE
    SET veo_url = EXCLUDED.veo_url, maj_par = EXCLUDED.maj_par, updated_at = now();
  RETURN jsonb_build_object('evenement_id', p_evenement_id, 'veo_url', v_url);
END;
$fn$;
REVOKE ALL ON FUNCTION public.definir_video_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_video_match(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Fonctions remplacées (mêmes signatures ; droits conservés)
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
    -- sql_287 (D49) : la vidéo du match n'est pas un contenu du coach.
    RETURN jsonb_build_object('id', m.id, 'evenement_id', m.evenement_id, 'statut', m.statut,
                              'verrouille', true, 'publie_le', m.publie_le, 'match', v_match,
                              'veo_url', public._ej_veo_match(m.evenement_id));
  END IF;

  RETURN jsonb_build_object(
    'id', m.id, 'evenement_id', m.evenement_id, 'statut', m.statut,
    'feu', m.feu, 'point_fort', m.point_fort, 'axe_travail', m.axe_travail,
    -- sql_287 (D47) : lien du match, sinon l'ancien lien de l'éval (repli).
    'mot_coach', m.mot_coach, 'veo_url', coalesce(public._ej_veo_match(m.evenement_id), m.veo_url), 'veo_moments', m.veo_moments,
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


CREATE OR REPLACE FUNCTION public.enregistrer_eval_match(
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
  -- sql_287 (D47) : le lien peut venir du match (video_match) ou de l'éval.
  IF jsonb_array_length(v_moments) > 0 AND v_veo IS NULL AND public._ej_veo_match(p_evenement_id) IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.eval_match x WHERE x.personne_id = p_personne_id
                     AND x.evenement_id = p_evenement_id AND x.veo_url IS NOT NULL) THEN
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
        -- sql_287 (D47) : sans lien transmis, l'ancien lien de l'éval est gardé (repli).
        veo_url = coalesce(EXCLUDED.veo_url, m.veo_url), veo_moments = EXCLUDED.veo_moments,
        redige_par = EXCLUDED.redige_par,
        feu_tech_indiv = EXCLUDED.feu_tech_indiv, feu_physique = EXCLUDED.feu_physique,
        feu_tech_poste = EXCLUDED.feu_tech_poste, feu_comprehension = EXCLUDED.feu_comprehension,
        feu_etat_esprit = EXCLUDED.feu_etat_esprit, feu_mental = EXCLUDED.feu_mental,
        sous_criteres = EXCLUDED.sous_criteres
  RETURNING m.* INTO v_row;
  RETURN public._ej_json_match(v_row, true);
END;
$fn$;


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
                'categorie_id', v_cat,
                'veo_url', public._ej_veo_match(e.id))
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
                          'veo_url', public._ej_veo_match(e.id),
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
    'parcours', public._ej_json_parcours(v_pid, v_saison),
    -- sql_287 (D48) : vidéos des matchs passés de la saison, pour tout joueur
    -- de la feuille (compo de match active) ou évalué sur ce match.
    'videos', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'evenement_id', e.id,
                  'date', (coalesce(e.date_debut, ep.date_debut) AT TIME ZONE 'Europe/Paris')::date,
                  'libelle', e.libelle, 'adversaire', e.adversaire_nom,
                  'niveau', public._ej_niveau(e.id),
                  'veo_url', v.veo_url)
                ORDER BY coalesce(e.date_debut, ep.date_debut) DESC NULLS LAST)
              FROM public.video_match v
              JOIN public.evenements e ON e.id = v.evenement_id
              LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
              WHERE e.saison_id = v_saison
                AND coalesce(e.date_debut, ep.date_debut) <= now()
                AND (EXISTS (SELECT 1 FROM public.compositions co
                             JOIN public.composition_joueurs cj ON cj.composition_id = co.id
                             WHERE co.evenement_id = e.id AND co.type_compo = 'match' AND co.cote = 'mom'
                               AND co.est_active AND cj.joueur_id = v_pid)
                     OR EXISTS (SELECT 1 FROM public.eval_match m WHERE m.evenement_id = e.id AND m.personne_id = v_pid))), '[]'::jsonb))
  INTO v_out
  FROM public.personnes p WHERE p.id = v_pid;
  RETURN v_out;
END;
$fn$;


-- ---------------------------------------------------------------------
-- 4. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('definir_video_match', '_ej_veo_match', '_ej_json_match', 'enregistrer_eval_match',
                      'lister_evals_match', 'get_espace_joueur');
  IF v_n <> 6 THEN RAISE EXCEPTION 'VERIF: surcharge ou fonction manquante (% au lieu de 6)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) _ej_ ouvert(s)', v_n; END IF;
  IF has_function_privilege('anon', 'public.definir_video_match(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF: definir_video_match ouverte à anon';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.definir_video_match(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF: definir_video_match non accordée à authenticated';
  END IF;
  IF has_table_privilege('anon', 'public.video_match', 'SELECT') OR has_table_privilege('authenticated', 'public.video_match', 'SELECT') THEN
    RAISE EXCEPTION 'VERIF: video_match lisible directement';
  END IF;
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'video_match' AND c.relrowsecurity;
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: RLS inactive sur video_match'; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('get_espace_joueur', 'repondre_eval', 'envoyer_auto_eval',
                      'etat_acces_espace', 'definir_code_espace', 'ouvrir_session_espace');
  IF v_n <> 6 THEN RAISE EXCEPTION 'VERIF: les 6 RPC espace joueur doivent rester ouvertes à anon (%)', v_n; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
