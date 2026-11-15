-- =====================================================================
-- sql_263_eval_joueur_socle
-- FAIT FOI « EVAL-JOUEUR » v1 gelé par Manu le 15/11/2026 (« je gèle »,
--   D1-D15). Lot L1 : socle SQL (3 tables + RPC staff + RPC espace joueur).
--   D1  lien personnel : jeton opaque 64 hex (patron C12-f), table dédiée
--       lien_espace_joueur, un seul lien actif par joueur, régénérable
--   D2  brouillon -> publié ; seul le publié sort vers l'espace joueur
--   D3  une réponse courte du joueur (280 car.) par évaluation publiée
--   D5  périodes : pre_saison | p1 | p2 | p3
--   D6  5 critères fixes, feu V | O | R + observation
--   D7  publication d'une éval match refusée sans feu ni point fort
--   D9  feuille de l'éval match = compo 'match' active côté mom, QUEL QUE
--       SOIT son etat (sondé : aucune compo de match n'est 'validee') +
--       joueurs ayant déjà une éval sur ce match ; sans compo : joueurs
--       de la catégorie du match
--   D10 joueurs partenaires inclus (catégorie = personnes.categorie_id)
--   D11 rédaction ET publication : admin | bureau | encadrant de la
--       catégorie ; trace redige_par / publie_par (personne_id du compte)
--   D13 dépublier possible ; suppression des brouillons seulement
--   D14 réponse modifiable / effaçable par le joueur
--   D15 payload espace joueur réduit (aucune donnée sensible)
--
-- Droits staff (patron sql_261) :
--   lecture  : admin | bureau | puis_je_lire_categorie(cat)
--   écriture : admin | bureau | puis_je_ecrire_categorie(cat)
--   Éval match : cat du joueur OU cat du match (joueur en dépannage hors
--   catégorie : l'encadrant du match peut l'évaluer) — choix technique
--   tracé, conforme à D10/D11.
-- Espace joueur : RPC accordées à anon + authenticated, garde = jeton
--   valide non révoqué ; aucune autre surface d'écriture que la réponse.
-- Tables : RLS active, 0 policy, REVOKE ALL ; accès par RPC SECURITY
--   DEFINER uniquement.
-- Réutilise sans le modifier : public._pp_saison_active() (sql_261).
-- Duplique (coût assumé, cf. spectateur.js) la résolution du niveau de
--   niveau_evenements_stats (C15-b), dont la garde auth.uid() interdit
--   l'appel depuis le chemin anon.
-- AJOUT PUR : aucune table ni fonction existante modifiée.
-- Mode : COMMIT (identique au DRY-RUN hors tests, à exécuter uniquement
--   sur feu vert explicite de Manu). Dry-run du 15/11/2026 : 24/24 verts.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
CREATE TABLE public.lien_espace_joueur (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id           uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  token                 text NOT NULL UNIQUE,
  revoque               boolean NOT NULL DEFAULT false,
  cree_par              uuid,
  date_creation         timestamptz NOT NULL DEFAULT now(),
  derniere_consultation timestamptz,
  CONSTRAINT lien_ej_token_check CHECK (token ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX lien_ej_un_actif_idx
ON public.lien_espace_joueur (personne_id) WHERE NOT revoque;
ALTER TABLE public.lien_espace_joueur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lien_espace_joueur FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.lien_espace_joueur IS
  'EVAL-JOUEUR D1 : lien personnel (jeton) de l''espace joueur & famille. Un seul actif par joueur. Accès via RPC uniquement (sql_263).';

CREATE TABLE public.eval_bilan (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id       uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  saison_id         uuid NOT NULL REFERENCES public.saisons(id),
  periode           text NOT NULL,
  objectif_1        text,
  objectif_2        text,
  feu_tech_indiv    text,
  feu_physique      text,
  feu_tech_poste    text,
  feu_comprehension text,
  feu_etat_esprit   text,
  obs_tech_indiv    text,
  obs_physique      text,
  obs_tech_poste    text,
  obs_comprehension text,
  obs_etat_esprit   text,
  statut            text NOT NULL DEFAULT 'brouillon',
  redige_par        uuid,
  publie_par        uuid,
  publie_le         timestamptz,
  reponse_joueur    varchar(280),
  reponse_le        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eval_bilan_periode_check CHECK (periode IN ('pre_saison', 'p1', 'p2', 'p3')),
  CONSTRAINT eval_bilan_statut_check CHECK (statut IN ('brouillon', 'publie')),
  CONSTRAINT eval_bilan_feux_check CHECK (
    coalesce(feu_tech_indiv, 'V') IN ('V', 'O', 'R')
    AND coalesce(feu_physique, 'V') IN ('V', 'O', 'R')
    AND coalesce(feu_tech_poste, 'V') IN ('V', 'O', 'R')
    AND coalesce(feu_comprehension, 'V') IN ('V', 'O', 'R')
    AND coalesce(feu_etat_esprit, 'V') IN ('V', 'O', 'R')),
  CONSTRAINT eval_bilan_unique UNIQUE (personne_id, saison_id, periode)
);
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.eval_bilan
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
ALTER TABLE public.eval_bilan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eval_bilan FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.eval_bilan IS
  'EVAL-JOUEUR : bilan de période (joueur x saison x période), 5 critères V/O/R. Accès via RPC uniquement (sql_263).';

CREATE TABLE public.eval_match (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id    uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  evenement_id   uuid NOT NULL REFERENCES public.evenements(id) ON DELETE CASCADE,
  feu            text,
  point_fort     text,
  axe_travail    text,
  mot_coach      text,
  veo_url        text,
  veo_minute     text,
  statut         text NOT NULL DEFAULT 'brouillon',
  redige_par     uuid,
  publie_par     uuid,
  publie_le      timestamptz,
  reponse_joueur varchar(280),
  reponse_le     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eval_match_feu_check CHECK (feu IS NULL OR feu IN ('V', 'O', 'R')),
  CONSTRAINT eval_match_statut_check CHECK (statut IN ('brouillon', 'publie')),
  CONSTRAINT eval_match_publie_check CHECK (
    statut = 'brouillon' OR (feu IS NOT NULL AND nullif(btrim(point_fort), '') IS NOT NULL)),
  CONSTRAINT eval_match_veo_check CHECK (veo_url IS NULL OR veo_url ~* '^https://'),
  CONSTRAINT eval_match_unique UNIQUE (personne_id, evenement_id)
);
CREATE INDEX eval_match_evt_idx ON public.eval_match (evenement_id);
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.eval_match
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
ALTER TABLE public.eval_match ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eval_match FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.eval_match IS
  'EVAL-JOUEUR : éval match (joueur x match) — feu, point fort, axe, mot du coach, action VEO. Accès via RPC uniquement (sql_263).';

-- ---------------------------------------------------------------------
-- 2. Helpers internes (non exposés)
-- ---------------------------------------------------------------------
-- Catégorie effective d'un évènement (repli parent puis grand-parent,
-- même règle que meta_evenements_stats, C15-a).
CREATE FUNCTION public._ej_cat_evenement(p_evenement_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT coalesce(e.categorie_id, p.categorie_id, gp.categorie_id)
  FROM public.evenements e
  LEFT JOIN public.evenements p ON p.id = e.evenement_parent_id
  LEFT JOIN public.evenements gp ON gp.id = p.evenement_parent_id
  WHERE e.id = p_evenement_id;
$fn$;

-- Niveau (équipe engagée côté mom) d'un match : copie de la résolution de
-- niveau_evenements_stats (C15-b).
CREATE FUNCTION public._ej_niveau(p_evenement_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT coalesce(eq.libelle_court, eq.libelle_moyen, eq.nom_officiel)::text
  FROM (
    SELECT coalesce(cm.evenement_equipe_id, cb.evenement_equipe_id,
                    (SELECT cb2.evenement_equipe_id
                     FROM public.compositions cb2
                     WHERE cb2.evenement_id = cm.evenement_id
                       AND cb2.type_compo = 'base' AND cb2.cote = 'mom'
                       AND cb2.est_active AND cb2.evenement_equipe_id IS NOT NULL
                     LIMIT 1)) AS eee
    FROM public.compositions cm
    LEFT JOIN public.compositions cb ON cb.id = cm.compo_base_origine_id
    WHERE cm.evenement_id = p_evenement_id
      AND cm.type_compo = 'match' AND cm.cote = 'mom' AND cm.est_active
    ORDER BY cm.updated_at DESC NULLS LAST
    LIMIT 1
  ) m
  LEFT JOIN public.evenement_equipes_engagees ee ON ee.id = m.eee
  LEFT JOIN public.equipes eq ON eq.id = ee.equipe_id;
$fn$;

CREATE FUNCTION public._ej_peut_lire_joueur(p_personne_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role('admin') OR public.has_role('bureau') THEN RETURN true; END IF;
  SELECT p.categorie_id INTO v_cat FROM public.personnes p WHERE p.id = p_personne_id;
  RETURN v_cat IS NOT NULL AND public.puis_je_lire_categorie(v_cat);
END;
$fn$;

CREATE FUNCTION public._ej_peut_ecrire_joueur(p_personne_id uuid, p_evenement_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
  v_cat_evt uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role('admin') OR public.has_role('bureau') THEN RETURN true; END IF;
  SELECT p.categorie_id INTO v_cat FROM public.personnes p WHERE p.id = p_personne_id;
  IF v_cat IS NOT NULL AND public.puis_je_ecrire_categorie(v_cat) THEN RETURN true; END IF;
  IF p_evenement_id IS NOT NULL THEN
    v_cat_evt := public._ej_cat_evenement(p_evenement_id);
    RETURN v_cat_evt IS NOT NULL AND public.puis_je_ecrire_categorie(v_cat_evt);
  END IF;
  RETURN false;
END;
$fn$;

CREATE FUNCTION public._ej_moi()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT q.personne_id FROM public.qui_suis_je() q LIMIT 1;
$fn$;

-- Jeton -> personne (NULL si invalide ou révoqué).
CREATE FUNCTION public._ej_personne_du_jeton(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT l.personne_id FROM public.lien_espace_joueur l
  WHERE l.token = p_token AND NOT l.revoque
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public._ej_cat_evenement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_niveau(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_peut_lire_joueur(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_peut_ecrire_joueur(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_moi() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_personne_du_jeton(text) FROM PUBLIC, anon, authenticated;

-- Représentations JSON (une seule définition, réutilisée partout).
CREATE FUNCTION public._ej_json_bilan(b public.eval_bilan, p_staff boolean)
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
      'etat_esprit', b.feu_etat_esprit),
    'obs', jsonb_build_object(
      'tech_indiv', b.obs_tech_indiv, 'physique', b.obs_physique,
      'tech_poste', b.obs_tech_poste, 'comprehension', b.obs_comprehension,
      'etat_esprit', b.obs_etat_esprit),
    'publie_le', b.publie_le,
    'publie_par_prenom', (SELECT p.prenom FROM public.personnes p WHERE p.id = b.publie_par),
    'reponse_joueur', b.reponse_joueur, 'reponse_le', b.reponse_le)
  || CASE WHEN p_staff THEN jsonb_build_object(
       'redige_par', b.redige_par,
       'redige_par_nom', (SELECT p.prenom || ' ' || p.nom FROM public.personnes p WHERE p.id = b.redige_par),
       'updated_at', b.updated_at)
     ELSE '{}'::jsonb END;
$fn$;

CREATE FUNCTION public._ej_json_match(m public.eval_match, p_staff boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', m.id, 'evenement_id', m.evenement_id, 'statut', m.statut,
    'feu', m.feu, 'point_fort', m.point_fort, 'axe_travail', m.axe_travail,
    'mot_coach', m.mot_coach, 'veo_url', m.veo_url, 'veo_minute', m.veo_minute,
    'publie_le', m.publie_le,
    'publie_par_prenom', (SELECT p.prenom FROM public.personnes p WHERE p.id = m.publie_par),
    'reponse_joueur', m.reponse_joueur, 'reponse_le', m.reponse_le,
    'match', (SELECT jsonb_build_object(
                'date', (coalesce(e.date_debut, ep.date_debut) AT TIME ZONE 'Europe/Paris')::date,
                'libelle', e.libelle, 'adversaire', e.adversaire_nom,
                'domicile_exterieur', e.domicile_exterieur,
                'score_mom', e.score_mom, 'score_adverse', e.score_adverse,
                'niveau', public._ej_niveau(e.id))
              FROM public.evenements e
              LEFT JOIN public.evenements ep ON ep.id = e.evenement_parent_id
              WHERE e.id = m.evenement_id))
  || CASE WHEN p_staff THEN jsonb_build_object(
       'redige_par', m.redige_par,
       'redige_par_nom', (SELECT p.prenom || ' ' || p.nom FROM public.personnes p WHERE p.id = m.redige_par),
       'updated_at', m.updated_at)
     ELSE '{}'::jsonb END;
$fn$;

REVOKE ALL ON FUNCTION public._ej_json_bilan(public.eval_bilan, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_json_match(public.eval_match, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC staff — lecture
-- ---------------------------------------------------------------------
-- Dossier d'évaluation d'un joueur pour une saison (tous statuts).
CREATE FUNCTION public.lister_evals_joueur(p_personne_id uuid, p_saison_id uuid DEFAULT NULL)
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
                        WHERE m.personne_id = p.id AND e.saison_id = v_saison), '[]'::jsonb))
  INTO v_out
  FROM public.personnes p
  WHERE p.id = p_personne_id;
  IF v_out IS NULL THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;
  RETURN v_out;
END;
$fn$;

-- Matchs d'une catégorie (saison) avec l'avancement des évals.
CREATE FUNCTION public.lister_matchs_eval(p_categorie_id uuid, p_saison_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
BEGIN
  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'evenement_id', e.id,
             'date', (e.date_debut AT TIME ZONE 'Europe/Paris')::date,
             'libelle', e.libelle, 'adversaire', e.adversaire_nom,
             'niveau', public._ej_niveau(e.id),
             'nb_publiees', (SELECT count(*) FROM public.eval_match m WHERE m.evenement_id = e.id AND m.statut = 'publie'),
             'nb_brouillons', (SELECT count(*) FROM public.eval_match m WHERE m.evenement_id = e.id AND m.statut = 'brouillon'))
           ORDER BY e.date_debut DESC NULLS LAST)
    FROM public.evenements e
    WHERE e.type_evenement = 'competition'
      AND e.saison_id = v_saison
      AND public._ej_cat_evenement(e.id) = p_categorie_id), '[]'::jsonb);
END;
$fn$;

-- Feuille d'un match (D9) avec l'éval de chaque joueur.
CREATE FUNCTION public.lister_evals_match(p_evenement_id uuid)
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
                        WHERE m.evenement_id = p_evenement_id AND m.personne_id = p.id))
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

-- ---------------------------------------------------------------------
-- 4. RPC staff — bilans de période
-- ---------------------------------------------------------------------
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
  p_saison_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
  v_row public.eval_bilan;
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

  INSERT INTO public.eval_bilan AS b (
    personne_id, saison_id, periode, objectif_1, objectif_2,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit,
    obs_tech_indiv, obs_physique, obs_tech_poste, obs_comprehension, obs_etat_esprit,
    redige_par)
  VALUES (
    p_personne_id, v_saison, p_periode,
    nullif(btrim(p_objectif_1), ''), nullif(btrim(p_objectif_2), ''),
    nullif(upper(btrim(p_feu_tech_indiv)), ''), nullif(upper(btrim(p_feu_physique)), ''),
    nullif(upper(btrim(p_feu_tech_poste)), ''), nullif(upper(btrim(p_feu_comprehension)), ''),
    nullif(upper(btrim(p_feu_etat_esprit)), ''),
    nullif(btrim(p_obs_tech_indiv), ''), nullif(btrim(p_obs_physique), ''),
    nullif(btrim(p_obs_tech_poste), ''), nullif(btrim(p_obs_comprehension), ''),
    nullif(btrim(p_obs_etat_esprit), ''),
    public._ej_moi())
  ON CONFLICT ON CONSTRAINT eval_bilan_unique DO UPDATE
    SET objectif_1 = EXCLUDED.objectif_1, objectif_2 = EXCLUDED.objectif_2,
        feu_tech_indiv = EXCLUDED.feu_tech_indiv, feu_physique = EXCLUDED.feu_physique,
        feu_tech_poste = EXCLUDED.feu_tech_poste, feu_comprehension = EXCLUDED.feu_comprehension,
        feu_etat_esprit = EXCLUDED.feu_etat_esprit,
        obs_tech_indiv = EXCLUDED.obs_tech_indiv, obs_physique = EXCLUDED.obs_physique,
        obs_tech_poste = EXCLUDED.obs_tech_poste, obs_comprehension = EXCLUDED.obs_comprehension,
        obs_etat_esprit = EXCLUDED.obs_etat_esprit,
        redige_par = EXCLUDED.redige_par
  RETURNING b.* INTO v_row;
  RETURN public._ej_json_bilan(v_row, true);
END;
$fn$;

-- Changement de statut d'un bilan : p_action = publier | depublier | supprimer.
CREATE FUNCTION public.statut_eval_bilan(p_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.eval_bilan;
BEGIN
  SELECT * INTO v_row FROM public.eval_bilan b WHERE b.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bilan % introuvable', p_id USING ERRCODE = '02000';
  END IF;
  IF NOT public._ej_peut_ecrire_joueur(v_row.personne_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'publier' THEN
    IF num_nonnulls(v_row.feu_tech_indiv, v_row.feu_physique, v_row.feu_tech_poste,
                    v_row.feu_comprehension, v_row.feu_etat_esprit) = 0 THEN
      RAISE EXCEPTION 'Au moins un critère doit être évalué avant publication' USING ERRCODE = '22023';
    END IF;
    UPDATE public.eval_bilan b
      SET statut = 'publie', publie_par = public._ej_moi(), publie_le = now()
      WHERE b.id = p_id RETURNING b.* INTO v_row;
  ELSIF p_action = 'depublier' THEN
    UPDATE public.eval_bilan b
      SET statut = 'brouillon'
      WHERE b.id = p_id RETURNING b.* INTO v_row;
  ELSIF p_action = 'supprimer' THEN
    IF v_row.statut <> 'brouillon' THEN
      RAISE EXCEPTION 'Un bilan publié ne se supprime pas : dépubliez-le d''abord' USING ERRCODE = '22023';
    END IF;
    DELETE FROM public.eval_bilan b WHERE b.id = p_id;
    RETURN jsonb_build_object('id', p_id, 'supprime', true);
  ELSE
    RAISE EXCEPTION 'Action invalide (publier | depublier | supprimer)' USING ERRCODE = '22023';
  END IF;
  RETURN public._ej_json_bilan(v_row, true);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 5. RPC staff — évals match
-- ---------------------------------------------------------------------
CREATE FUNCTION public.enregistrer_eval_match(
  p_personne_id uuid,
  p_evenement_id uuid,
  p_feu text DEFAULT NULL,
  p_point_fort text DEFAULT NULL,
  p_axe_travail text DEFAULT NULL,
  p_mot_coach text DEFAULT NULL,
  p_veo_url text DEFAULT NULL,
  p_veo_minute text DEFAULT NULL
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
    veo_url, veo_minute, redige_par)
  VALUES (
    p_personne_id, p_evenement_id, nullif(upper(btrim(p_feu)), ''),
    nullif(btrim(p_point_fort), ''), nullif(btrim(p_axe_travail), ''),
    nullif(btrim(p_mot_coach), ''), v_veo, nullif(btrim(p_veo_minute), ''),
    public._ej_moi())
  ON CONFLICT ON CONSTRAINT eval_match_unique DO UPDATE
    SET feu = EXCLUDED.feu, point_fort = EXCLUDED.point_fort,
        axe_travail = EXCLUDED.axe_travail, mot_coach = EXCLUDED.mot_coach,
        veo_url = EXCLUDED.veo_url, veo_minute = EXCLUDED.veo_minute,
        redige_par = EXCLUDED.redige_par
  RETURNING m.* INTO v_row;
  RETURN public._ej_json_match(v_row, true);
END;
$fn$;

-- Changement de statut d'une éval match : publier | depublier | supprimer.
CREATE FUNCTION public.statut_eval_match(p_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.eval_match;
BEGIN
  SELECT * INTO v_row FROM public.eval_match m WHERE m.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Éval match % introuvable', p_id USING ERRCODE = '02000';
  END IF;
  IF NOT public._ej_peut_ecrire_joueur(v_row.personne_id, v_row.evenement_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'publier' THEN
    IF v_row.feu IS NULL OR nullif(btrim(v_row.point_fort), '') IS NULL THEN
      RAISE EXCEPTION 'Le feu et le point fort sont obligatoires pour publier' USING ERRCODE = '22023';
    END IF;
    UPDATE public.eval_match m
      SET statut = 'publie', publie_par = public._ej_moi(), publie_le = now()
      WHERE m.id = p_id RETURNING m.* INTO v_row;
  ELSIF p_action = 'depublier' THEN
    UPDATE public.eval_match m
      SET statut = 'brouillon'
      WHERE m.id = p_id RETURNING m.* INTO v_row;
  ELSIF p_action = 'supprimer' THEN
    IF v_row.statut <> 'brouillon' THEN
      RAISE EXCEPTION 'Une éval publiée ne se supprime pas : dépubliez-la d''abord' USING ERRCODE = '22023';
    END IF;
    DELETE FROM public.eval_match m WHERE m.id = p_id;
    RETURN jsonb_build_object('id', p_id, 'supprime', true);
  ELSE
    RAISE EXCEPTION 'Action invalide (publier | depublier | supprimer)' USING ERRCODE = '22023';
  END IF;
  RETURN public._ej_json_match(v_row, true);
END;
$fn$;

-- « Publier tous les brouillons » d'un match : publie ceux qui sont complets
-- (feu + point fort) et que l'appelant peut écrire ; ignore les autres.
CREATE FUNCTION public.publier_brouillons_match(p_evenement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_moi uuid := public._ej_moi();
  v_publiees int;
  v_ignorees int;
BEGIN
  IF p_evenement_id IS NULL THEN
    RAISE EXCEPTION 'p_evenement_id requis' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  WITH cibles AS (
    SELECT m.id FROM public.eval_match m
    WHERE m.evenement_id = p_evenement_id AND m.statut = 'brouillon'
      AND m.feu IS NOT NULL AND nullif(btrim(m.point_fort), '') IS NOT NULL
      AND public._ej_peut_ecrire_joueur(m.personne_id, m.evenement_id)
  ), maj AS (
    UPDATE public.eval_match m
      SET statut = 'publie', publie_par = v_moi, publie_le = now()
      FROM cibles c WHERE m.id = c.id
      RETURNING m.id
  )
  SELECT count(*) INTO v_publiees FROM maj;
  SELECT count(*) INTO v_ignorees FROM public.eval_match m
  WHERE m.evenement_id = p_evenement_id AND m.statut = 'brouillon';
  RETURN jsonb_build_object('publiees', v_publiees, 'brouillons_restants', v_ignorees);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 6. RPC staff — lien personnel (D1)
-- ---------------------------------------------------------------------
CREATE FUNCTION public.get_lien_espace_joueur(p_personne_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public._ej_peut_ecrire_joueur(p_personne_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT jsonb_build_object('token', l.token, 'date_creation', l.date_creation,
                                    'derniere_consultation', l.derniere_consultation)
          FROM public.lien_espace_joueur l
          WHERE l.personne_id = p_personne_id AND NOT l.revoque);
END;
$fn$;

-- Crée le lien, ou le régénère (l'ancien est révoqué).
CREATE FUNCTION public.generer_lien_espace_joueur(p_personne_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_token text;
  v_row public.lien_espace_joueur;
BEGIN
  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.personnes p WHERE p.id = p_personne_id) THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;
  IF NOT public._ej_peut_ecrire_joueur(p_personne_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  UPDATE public.lien_espace_joueur l
    SET revoque = true
    WHERE l.personne_id = p_personne_id AND NOT l.revoque;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.lien_espace_joueur (personne_id, token, cree_par)
  VALUES (p_personne_id, v_token, public._ej_moi())
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('token', v_row.token, 'date_creation', v_row.date_creation,
                            'derniere_consultation', NULL);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 7. RPC espace joueur (jeton) — anon + authenticated
-- ---------------------------------------------------------------------
-- Payload réduit (D15). Saison active seulement. Met à jour la dernière
-- consultation et renvoie la précédente (repère « Nouveau », D7-e).
CREATE FUNCTION public.get_espace_joueur(p_token text)
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
                          AND m.statut = 'publie'), '[]'::jsonb))
  INTO v_out
  FROM public.personnes p WHERE p.id = v_pid;
  RETURN v_out;
END;
$fn$;

-- Réponse du joueur (D3, D14) : texte vide = effacement.
CREATE FUNCTION public.repondre_eval(p_token text, p_type text, p_eval_id uuid, p_texte text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pid uuid := public._ej_personne_du_jeton(p_token);
  v_txt text := nullif(btrim(p_texte), '');
  v_n int;
BEGIN
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  IF v_txt IS NOT NULL AND char_length(v_txt) > 280 THEN
    RAISE EXCEPTION 'Réponse trop longue (280 caractères maximum)' USING ERRCODE = '22023';
  END IF;
  IF p_type = 'bilan' THEN
    UPDATE public.eval_bilan b
      SET reponse_joueur = v_txt, reponse_le = CASE WHEN v_txt IS NULL THEN NULL ELSE now() END
      WHERE b.id = p_eval_id AND b.personne_id = v_pid AND b.statut = 'publie';
  ELSIF p_type = 'match' THEN
    UPDATE public.eval_match m
      SET reponse_joueur = v_txt, reponse_le = CASE WHEN v_txt IS NULL THEN NULL ELSE now() END
      WHERE m.id = p_eval_id AND m.personne_id = v_pid AND m.statut = 'publie';
  ELSE
    RAISE EXCEPTION 'Type invalide (bilan | match)' USING ERRCODE = '22023';
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Évaluation introuvable' USING ERRCODE = '02000';
  END IF;
  RETURN jsonb_build_object('id', p_eval_id, 'reponse_joueur', v_txt);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 8. Droits d'exécution
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.lister_evals_joueur(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lister_matchs_eval(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lister_evals_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enregistrer_eval_bilan(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.statut_eval_bilan(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.statut_eval_match(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publier_brouillons_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_lien_espace_joueur(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generer_lien_espace_joueur(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_espace_joueur(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repondre_eval(text, text, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lister_evals_joueur(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lister_matchs_eval(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lister_evals_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_eval_bilan(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.statut_eval_bilan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_eval_match(uuid, uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.statut_eval_match(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publier_brouillons_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lien_espace_joueur(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generer_lien_espace_joueur(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_espace_joueur(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repondre_eval(text, text, uuid, text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relrowsecurity
    AND c.relname IN ('lien_espace_joueur', 'eval_bilan', 'eval_match');
  IF v_n <> 3 THEN RAISE EXCEPTION 'VERIF: RLS non active sur les 3 tables (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('lien_espace_joueur', 'eval_bilan', 'eval_match');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: policies inattendues (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND p.proname IN ('lister_evals_joueur', 'lister_matchs_eval', 'lister_evals_match',
                      'enregistrer_eval_bilan', 'statut_eval_bilan', 'enregistrer_eval_match',
                      'statut_eval_match', 'publier_brouillons_match', 'get_lien_espace_joueur',
                      'generer_lien_espace_joueur', 'get_espace_joueur', 'repondre_eval');
  IF v_n <> 12 THEN RAISE EXCEPTION 'VERIF: 12 RPC SECURITY DEFINER attendues (%)', v_n; END IF;

  -- anon : uniquement les 2 RPC de l'espace joueur
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname LIKE '\_ej\_%' OR p.proname IN (
         'lister_evals_joueur', 'lister_matchs_eval', 'lister_evals_match',
         'enregistrer_eval_bilan', 'statut_eval_bilan', 'enregistrer_eval_match',
         'statut_eval_match', 'publier_brouillons_match', 'get_lien_espace_joueur',
         'generer_lien_espace_joueur'))
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % fonction(s) staff/helper exécutable(s) par anon', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) exécutable(s) par authenticated', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('get_espace_joueur', 'repondre_eval')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: les 2 RPC espace joueur doivent être ouvertes à anon (%)', v_n; END IF;

  IF public._pp_saison_active() IS NULL THEN
    RAISE EXCEPTION 'VERIF: aucune saison active';
  END IF;

  RAISE NOTICE 'VERIF OK : 3 tables RLS sans policy, 12 RPC secdef, anon limité à l''espace joueur, helpers fermés';
END;
$verif$;

COMMIT;
