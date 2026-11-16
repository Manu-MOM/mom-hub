-- =====================================================================
-- sql_265_eval_joueur_auto_eval
-- FAIT FOI « EVAL-JOUEUR » v1, §9 Avenant A — AUTO-ÉVALUATION MATCH, gelé
--   par Manu le 16/11/2026 (« B1 d'emblée » ; « pour le reste, je te suis »).
--   Lot A1 : socle SQL.
--   D16 auto-évaluation par match, 5 critères D6 en V/O/R (bilans inchangés)
--   D17 éval match du coach : + 5 critères V/O/R FACULTATIFS (publication
--       toujours possible avec feu + point fort)
--   D18 ouverture dès que le match est passé, pour les joueurs de la feuille
--       (règle D9 : compo de match active côté mom, ou éval existante)
--   D19 verrou : côté joueur, l'éval du coach n'est renvoyée qu'après
--       l'auto-évaluation du match (masquage dans _ej_json_match)
--   D20 auto-évaluation figée dès l'envoi (aucune modification)
--   D21 un mot facultatif (280 caractères)
--   D22 non rétroactif : eval_match.auto_eval_requise = false pour toutes
--       les évals existantes à l'application ; true par défaut ensuite
--   D23 comparaison : critères du coach + auto-évaluation renvoyés côté
--       joueur (après déverrouillage) et côté staff
--
-- Contenu :
--   TABLE auto_eval_match (RLS sans policy, REVOKE ALL)
--   ALTER eval_match : + 5 critères coach, + auto_eval_requise
--   _ej_json_auto, _ej_match_auto_evaluable (helpers fermés)
--   _ej_json_match            REMPLACÉ (même signature ; sql → plpgsql)
--   enregistrer_eval_match    DROP + CREATE (signature + 5 critères,
--                             cf. règle PGRST203 : jamais d'overload)
--   lister_evals_match, lister_evals_joueur, get_espace_joueur
--                             REMPLACÉS (même signature) : + auto-évaluations
--   envoyer_auto_eval         NOUVELLE RPC anon (jeton)
-- Mode : COMMIT (corps identique au dry-run vert du 16/11/2026, 14/14,
--   sans les tests). Appliqué via apply_migration (corps sans BEGIN/COMMIT).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Schéma
-- ---------------------------------------------------------------------
CREATE TABLE public.auto_eval_match (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id       uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  evenement_id      uuid NOT NULL REFERENCES public.evenements(id) ON DELETE CASCADE,
  feu_tech_indiv    text NOT NULL,
  feu_physique      text NOT NULL,
  feu_tech_poste    text NOT NULL,
  feu_comprehension text NOT NULL,
  feu_etat_esprit   text NOT NULL,
  commentaire       varchar(280),
  envoye_le         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auto_eval_match_feux_check CHECK (feu_tech_indiv IN ('V', 'O', 'R') AND feu_physique IN ('V', 'O', 'R') AND feu_tech_poste IN ('V', 'O', 'R') AND feu_comprehension IN ('V', 'O', 'R') AND feu_etat_esprit IN ('V', 'O', 'R')),
  CONSTRAINT auto_eval_match_unique UNIQUE (personne_id, evenement_id)
);
CREATE INDEX auto_eval_match_evt_idx ON public.auto_eval_match (evenement_id);
ALTER TABLE public.auto_eval_match ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_eval_match FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.auto_eval_match IS
  'EVAL-JOUEUR Avenant A : auto-évaluation du joueur par match (5 critères V/O/R + un mot), figée dès l''envoi. Accès via RPC uniquement (sql_265).';

ALTER TABLE public.eval_match
  ADD COLUMN feu_tech_indiv text,
  ADD COLUMN feu_physique text,
  ADD COLUMN feu_tech_poste text,
  ADD COLUMN feu_comprehension text,
  ADD COLUMN feu_etat_esprit text,
  ADD COLUMN auto_eval_requise boolean NOT NULL DEFAULT true;
ALTER TABLE public.eval_match
  ADD CONSTRAINT eval_match_criteres_check CHECK (coalesce(feu_tech_indiv, 'V') IN ('V', 'O', 'R') AND coalesce(feu_physique, 'V') IN ('V', 'O', 'R') AND coalesce(feu_tech_poste, 'V') IN ('V', 'O', 'R') AND coalesce(feu_comprehension, 'V') IN ('V', 'O', 'R') AND coalesce(feu_etat_esprit, 'V') IN ('V', 'O', 'R'));
-- D22 : non rétroactif.
UPDATE public.eval_match SET auto_eval_requise = false;

-- ---------------------------------------------------------------------
-- 2. Helpers (fermés)
-- ---------------------------------------------------------------------
CREATE FUNCTION public._ej_json_auto(a public.auto_eval_match)
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
      'comprehension', a.feu_comprehension, 'etat_esprit', a.feu_etat_esprit),
    'commentaire', a.commentaire, 'envoye_le', a.envoye_le,
    'match', (SELECT jsonb_build_object(
                'date', (coalesce(e.date_debut, ep.date_debut) AT TIME ZONE 'Europe/Paris')::date,
                'libelle', e.libelle, 'adversaire', e.adversaire_nom,
                'niveau', public._ej_niveau(e.id))
              FROM public.evenements e
              LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
              WHERE e.id = a.evenement_id));
$fn$;

-- D18 : match passé, joueur sur la feuille (règle D9), pas encore auto-évalué.
CREATE FUNCTION public._ej_match_auto_evaluable(p_personne_id uuid, p_evenement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.evenements e
    LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
    WHERE e.id = p_evenement_id
      AND e.type_evenement = 'competition'
      AND coalesce(e.date_debut, ep.date_debut) <= now())
  AND (EXISTS (
         SELECT 1 FROM public.compositions co
         JOIN public.composition_joueurs cj ON cj.composition_id = co.id
         WHERE co.evenement_id = p_evenement_id AND co.type_compo = 'match'
           AND co.cote = 'mom' AND co.est_active AND cj.joueur_id = p_personne_id)
       OR EXISTS (
         SELECT 1 FROM public.eval_match m
         WHERE m.evenement_id = p_evenement_id AND m.personne_id = p_personne_id))
  AND NOT EXISTS (
    SELECT 1 FROM public.auto_eval_match a
    WHERE a.evenement_id = p_evenement_id AND a.personne_id = p_personne_id);
$fn$;

REVOKE ALL ON FUNCTION public._ej_json_auto(public.auto_eval_match) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_match_auto_evaluable(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. _ej_json_match (même signature) : critères coach, auto-évaluation,
--    verrou côté joueur (D19). Reprend sql_264 à l'identique pour le reste.
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
    'mot_coach', m.mot_coach, 'veo_url', m.veo_url, 'veo_minute', m.veo_minute,
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

-- ---------------------------------------------------------------------
-- 4. enregistrer_eval_match : DROP + CREATE (nouvelle signature, D17)
-- ---------------------------------------------------------------------
DROP FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text);
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
  p_feu_etat_esprit text DEFAULT NULL
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

  INSERT INTO public.eval_match AS m (
    personne_id, evenement_id, feu, point_fort, axe_travail, mot_coach,
    veo_url, veo_minute, redige_par,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit)
  VALUES (
    p_personne_id, p_evenement_id, nullif(upper(btrim(p_feu)), ''),
    nullif(btrim(p_point_fort), ''), nullif(btrim(p_axe_travail), ''),
    nullif(btrim(p_mot_coach), ''), v_veo, nullif(btrim(p_veo_minute), ''),
    public._ej_moi(),
    nullif(upper(btrim(p_feu_tech_indiv)), ''), nullif(upper(btrim(p_feu_physique)), ''),
    nullif(upper(btrim(p_feu_tech_poste)), ''), nullif(upper(btrim(p_feu_comprehension)), ''),
    nullif(upper(btrim(p_feu_etat_esprit)), ''))
  ON CONFLICT ON CONSTRAINT eval_match_unique DO UPDATE
    SET feu = EXCLUDED.feu, point_fort = EXCLUDED.point_fort,
        axe_travail = EXCLUDED.axe_travail, mot_coach = EXCLUDED.mot_coach,
        veo_url = EXCLUDED.veo_url, veo_minute = EXCLUDED.veo_minute,
        redige_par = EXCLUDED.redige_par,
        feu_tech_indiv = EXCLUDED.feu_tech_indiv, feu_physique = EXCLUDED.feu_physique,
        feu_tech_poste = EXCLUDED.feu_tech_poste, feu_comprehension = EXCLUDED.feu_comprehension,
        feu_etat_esprit = EXCLUDED.feu_etat_esprit
  RETURNING m.* INTO v_row;
  RETURN public._ej_json_match(v_row, true);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 5. Lectures étendues (mêmes signatures) : auto-évaluations
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
               'eval', (SELECT public._ej_json_match(m, true) FROM public.eval_match m
                        WHERE m.evenement_id = p_evenement_id AND m.personne_id = p.id),
               -- Avenant A (D23) : auto-évaluation du joueur sur ce match.
               'auto_eval', (SELECT public._ej_json_auto(a) FROM public.auto_eval_match a
                             WHERE a.evenement_id = p_evenement_id AND a.personne_id = p.id))
             ORDER BY f.num NULLS LAST, p.nom, p.prenom)
      FROM feuille f JOIN public.personnes p ON p.id = f.pid), '[]'::jsonb),
    -- Sans compo : vivier = joueurs de la catégorie du match (D9).
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

CREATE OR REPLACE FUNCTION public.lister_evals_joueur(p_personne_id uuid, p_saison_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
  v_out jsonb;
BEGIN
  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public._ej_peut_lire_joueur(p_personne_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'joueur', jsonb_build_object(
      'id', p.id, 'nom', p.nom, 'prenom', p.prenom,
      'categorie_id', p.categorie_id,
      'categorie_code', (SELECT c.code FROM public.categories c WHERE c.id = p.categorie_id),
      'annee_naissance', extract(year FROM p.date_naissance)::int,
      'club', (SELECT cl.nom_court FROM public.clubs cl WHERE cl.id = p.club_principal_id)),
    'saison', (SELECT jsonb_build_object('id', s.id, 'code', s.code)
               FROM public.saisons s WHERE s.id = v_saison),
    'peut_ecrire', public._ej_peut_ecrire_joueur(p.id),
    'lien', (SELECT jsonb_build_object('actif', true, 'date_creation', l.date_creation,
                                       'derniere_consultation', l.derniere_consultation)
             FROM public.lien_espace_joueur l
             WHERE l.personne_id = p.id AND NOT l.revoque),
    'bilans', coalesce((SELECT jsonb_agg(public._ej_json_bilan(b, true)
                                         ORDER BY array_position(ARRAY['pre_saison','p1','p2','p3'], b.periode))
                        FROM public.eval_bilan b
                        WHERE b.personne_id = p.id AND b.saison_id = v_saison), '[]'::jsonb),
    'matchs', coalesce((SELECT jsonb_agg(public._ej_json_match(m, true)
                                         ORDER BY e.date_debut DESC NULLS LAST)
                        FROM public.eval_match m
                        JOIN public.evenements e ON e.id = m.evenement_id
                        WHERE m.personne_id = p.id AND e.saison_id = v_saison), '[]'::jsonb),
    -- Avenant A (D23) : auto-évaluations du joueur sur la saison (tendance).
    'auto_evals', coalesce((SELECT jsonb_agg(public._ej_json_auto(a) ORDER BY e.date_debut DESC NULLS LAST)
                            FROM public.auto_eval_match a
                            JOIN public.evenements e ON e.id = a.evenement_id
                            WHERE a.personne_id = p.id AND e.saison_id = v_saison), '[]'::jsonb))
  INTO v_out
  FROM public.personnes p
  WHERE p.id = p_personne_id;
  IF v_out IS NULL THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;
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
  v_out jsonb;
BEGIN
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  SELECT l.derniere_consultation INTO v_precedente
  FROM public.lien_espace_joueur l
  WHERE l.token = p_token AND NOT l.revoque;
  UPDATE public.lien_espace_joueur l
    SET derniere_consultation = now()
    WHERE l.token = p_token AND NOT l.revoque;
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
    'a_auto_evaluer', coalesce((SELECT jsonb_agg(jsonb_build_object(
                          'evenement_id', e.id,
                          'date', (coalesce(e.date_debut, ep.date_debut) AT TIME ZONE 'Europe/Paris')::date,
                          'libelle', e.libelle, 'adversaire', e.adversaire_nom,
                          'niveau', public._ej_niveau(e.id))
                        ORDER BY coalesce(e.date_debut, ep.date_debut) DESC NULLS LAST)
                        FROM public.evenements e
                        LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
                        WHERE e.type_evenement = 'competition' AND e.saison_id = v_saison
                          AND public._ej_match_auto_evaluable(v_pid, e.id)), '[]'::jsonb),
    -- Avenant A (D23) : auto-évaluations envoyées (frise « Comment je me vois »).
    'auto_evals', coalesce((SELECT jsonb_agg(public._ej_json_auto(a) ORDER BY e.date_debut DESC NULLS LAST)
                            FROM public.auto_eval_match a
                            JOIN public.evenements e ON e.id = a.evenement_id
                            WHERE a.personne_id = v_pid AND e.saison_id = v_saison), '[]'::jsonb))
  INTO v_out
  FROM public.personnes p WHERE p.id = v_pid;
  RETURN v_out;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 6. RPC espace joueur : envoyer l'auto-évaluation (D18, D20, D21)
-- ---------------------------------------------------------------------
CREATE FUNCTION public.envoyer_auto_eval(
  p_token text,
  p_evenement_id uuid,
  p_feu_tech_indiv text,
  p_feu_physique text,
  p_feu_tech_poste text,
  p_feu_comprehension text,
  p_feu_etat_esprit text,
  p_commentaire text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pid uuid := public._ej_personne_du_jeton(p_token);
  v_txt text := nullif(btrim(p_commentaire), '');
  v_row public.auto_eval_match;
  v_feux text[] := ARRAY[upper(btrim(p_feu_tech_indiv)), upper(btrim(p_feu_physique)),
                         upper(btrim(p_feu_tech_poste)), upper(btrim(p_feu_comprehension)),
                         upper(btrim(p_feu_etat_esprit))];
BEGIN
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_feux) f WHERE f IS NULL OR f NOT IN ('V', 'O', 'R')) THEN
    RAISE EXCEPTION 'Les 5 critères doivent être notés (V, O ou R)' USING ERRCODE = '22023';
  END IF;
  IF v_txt IS NOT NULL AND char_length(v_txt) > 280 THEN
    RAISE EXCEPTION 'Commentaire trop long (280 caractères maximum)' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auto_eval_match a
             WHERE a.personne_id = v_pid AND a.evenement_id = p_evenement_id) THEN
    RAISE EXCEPTION 'Auto-évaluation déjà envoyée pour ce match' USING ERRCODE = '23505';
  END IF;
  IF NOT public._ej_match_auto_evaluable(v_pid, p_evenement_id) THEN
    RAISE EXCEPTION 'Ce match ne peut pas être auto-évalué' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.auto_eval_match (personne_id, evenement_id,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit, commentaire)
  VALUES (v_pid, p_evenement_id, v_feux[1], v_feux[2], v_feux[3], v_feux[4], v_feux[5], v_txt)
  RETURNING * INTO v_row;
  RETURN public._ej_json_auto(v_row);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 7. Droits d'exécution
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._ej_json_match(public.eval_match, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, text) TO anon, authenticated;
-- (lister_evals_match, lister_evals_joueur, get_espace_joueur : CREATE OR
--  REPLACE conserve les droits existants de sql_263.)

-- ---------------------------------------------------------------------
-- 8. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('enregistrer_eval_match', '_ej_json_match');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: surcharge inattendue (enregistrer_eval_match / _ej_json_match : %)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) _ej_ ouvert(s)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('get_espace_joueur', 'repondre_eval', 'envoyer_auto_eval');
  IF v_n <> 3 THEN RAISE EXCEPTION 'VERIF: les 3 RPC espace joueur doivent être ouvertes à anon (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('enregistrer_eval_match', 'lister_evals_match', 'lister_evals_joueur', 'reperes_match_joueur');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: RPC staff ouverte(s) à anon (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'auto_eval_match' AND c.relrowsecurity;
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: RLS inactive sur auto_eval_match'; END IF;

  SELECT count(*) INTO v_n FROM public.eval_match WHERE auto_eval_requise;
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % éval(s) existante(s) verrouillée(s) (D22)', v_n; END IF;

  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
