-- =====================================================================
-- sql_264_eval_joueur_reperes
-- FAIT FOI « EVAL-JOUEUR » v1 (gelé 15/11/2026), lot L5 — D8 :
--   repères de stats d'un joueur sur un match, calculés côté base
--   (option A retenue par Manu le 15/11/2026, « je te suis »).
--   - Source : chronologie_suivi (lignes non annulées), même règle de
--     comptage que js/stats-saison.js v1.8 (_faitsJoueur) :
--       lignes de NOTRE équipe (equipe_concernee <> 'adverse') attribuées
--       au joueur (joueur_uuid) ; fautes aussi comptées pour les joueurs
--       associés (joueurs_associes, D2-A de SUIVI-THEO) ;
--       pied : obs-A-pied-<contexte>-<reussi|moyen|rate>[-…] ;
--       actions marquantes : obs-A-marq-<code socle | uuid ajout>.
--     ⚠️ INVARIANT : toute évolution du référentiel des observables doit
--     être reportée ICI ET dans stats-saison.js (deux lectures alignées).
--   - Match non suivi (aucune ligne non annulée) → NULL (bloc masqué).
--   - Côté joueur (p_complet = false) : repères POSITIFS seulement (points,
--     essais, transformations / pénalités / drops réussis, coups de pied
--     réussis SANS total, actions marquantes nommées) ; NULL si tout est
--     à zéro. Aucun raté, faute, en-avant ni carton ne sort vers l'espace
--     joueur.
--   - Côté staff (p_complet = true) : détail complet (ratés, tentés,
--     fautes, en-avant, passes en avant, cartons).
--
-- Contenu :
--   _ej_libelle_marq(oid)            helper : libellé d'une action marquante
--   _ej_reperes(personne, evt, bool) helper : calcul des repères
--   _ej_json_match(...)              REMPLACÉ (même signature) : ajoute la clé
--                                    'reperes' côté joueur (p_staff = false)
--   reperes_match_joueur(evt, pers)  RPC staff (authenticated), garde lecture
--                                    admin | bureau | puis_je_lire_categorie
-- Libellés du socle recopiés de stats-saison.js v1.8 (LIB_MARQ) ; ajouts
--   lus dans types_action_marquante (observable_id = 'obs-A-marq-' || id,
--   C18-a) ; repli « Action ajoutée ».
-- Mode : COMMIT (identique au DRY-RUN hors tests, à exécuter uniquement
--   sur feu vert explicite de Manu). Dry-run du 15/11/2026 : 7/7 verts.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Libellé d'une action marquante
-- ---------------------------------------------------------------------
CREATE FUNCTION public._ej_libelle_marq(p_oid text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(
    CASE substr(p_oid, length('obs-A-marq-') + 1)
      WHEN 'grattage' THEN 'Grattage'
      WHEN 'plaquage-offensif' THEN 'Plaquage offensif'
      WHEN 'plaquage-decisif' THEN 'Plaquage décisif'
      WHEN 'ras' THEN 'Départ au ras efficace'
      WHEN 'penalite-vite' THEN 'Pénalité vite jouée'
      WHEN 'franchissement' THEN 'Franchissement'
      WHEN 'offload' THEN 'Passe après contact'
      WHEN 'interception' THEN 'Interception'
      WHEN 'contre-ruck' THEN 'Contre-ruck gagné'
      WHEN 'ballon-haut' THEN 'Ballon haut récupéré'
      WHEN 'contre-pied' THEN 'Coup de pied contré'
      WHEN 'arrache' THEN 'Ballon arraché'
    END,
    (SELECT t.libelle FROM public.types_action_marquante t
     WHERE 'obs-A-marq-' || t.id::text = p_oid LIMIT 1),
    'Action ajoutée');
$fn$;

-- ---------------------------------------------------------------------
-- 2. Repères d'un joueur sur un match
-- ---------------------------------------------------------------------
CREATE FUNCTION public._ej_reperes(p_personne_id uuid, p_evenement_id uuid, p_complet boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_out jsonb;
  v_actions jsonb;
BEGIN
  -- Match non suivi : aucun repère.
  IF NOT EXISTS (SELECT 1 FROM public.chronologie_suivi c
                 WHERE c.evenement_uuid = p_evenement_id AND NOT coalesce(c.annule, false)) THEN
    RETURN NULL;
  END IF;

  WITH l AS (
    SELECT c.observable_id AS oid, coalesce(c.valeur_points, 0) AS pts
    FROM public.chronologie_suivi c
    WHERE c.evenement_uuid = p_evenement_id
      AND NOT coalesce(c.annule, false)
      AND c.equipe_concernee IS DISTINCT FROM 'adverse'
      AND c.joueur_uuid = p_personne_id
  )
  SELECT jsonb_build_object(
    'points', coalesce(sum(l.pts), 0),
    'essais', count(*) FILTER (WHERE l.oid = 'obs-A-essai'),
    'transformations', count(*) FILTER (WHERE l.oid = 'obs-A-transfo'),
    'penalites', count(*) FILTER (WHERE l.oid = 'obs-A-penalite'),
    'drops', count(*) FILTER (WHERE l.oid = 'obs-A-drop'),
    'pied_reussis', count(*) FILTER (WHERE l.oid ~ '^obs-A-pied-[a-z0-9]+-reussi(-|$)'))
  || CASE WHEN p_complet THEN jsonb_build_object(
    'transformations_ratees', count(*) FILTER (WHERE l.oid = 'obs-A-transfo-ratee'),
    'penalites_ratees', count(*) FILTER (WHERE l.oid = 'obs-A-penalite-ratee'),
    'pied_tentes', count(*) FILTER (WHERE l.oid ~ '^obs-A-pied-[a-z0-9]+-(reussi|moyen|rate)(-|$)'),
    'en_avant', count(*) FILTER (WHERE l.oid = 'obs-A-en-avant'),
    'passe_avant', count(*) FILTER (WHERE l.oid = 'obs-A-passe-avant'),
    'cartons', jsonb_build_object(
      'blanc', count(*) FILTER (WHERE l.oid = 'obs-A-blanc'),
      'jaune', count(*) FILTER (WHERE l.oid = 'obs-A-jaune'),
      'rouge', count(*) FILTER (WHERE l.oid = 'obs-A-rouge')))
    ELSE '{}'::jsonb END
  INTO v_out
  FROM l;

  -- Fautes (staff) : joueur principal OU joueur associé.
  IF p_complet THEN
    v_out := v_out || jsonb_build_object('fautes', (
      SELECT count(*) FROM public.chronologie_suivi c
      WHERE c.evenement_uuid = p_evenement_id
        AND NOT coalesce(c.annule, false)
        AND c.equipe_concernee IS DISTINCT FROM 'adverse'
        AND c.observable_id LIKE 'obs-A-faute-%'
        AND (c.joueur_uuid = p_personne_id OR p_personne_id = ANY (coalesce(c.joueurs_associes, '{}'::uuid[])))));
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('libelle', a.lib, 'nombre', a.n) ORDER BY a.n DESC, a.lib), '[]'::jsonb)
  INTO v_actions
  FROM (
    SELECT public._ej_libelle_marq(c.observable_id) AS lib, count(*) AS n
    FROM public.chronologie_suivi c
    WHERE c.evenement_uuid = p_evenement_id
      AND NOT coalesce(c.annule, false)
      AND c.equipe_concernee IS DISTINCT FROM 'adverse'
      AND c.joueur_uuid = p_personne_id
      AND c.observable_id LIKE 'obs-A-marq-%'
    GROUP BY 1
  ) a;
  v_out := v_out || jsonb_build_object('actions', v_actions);

  -- Côté joueur : rien de positif → pas de bloc (jamais de « 0 » affiché).
  IF NOT p_complet
     AND (v_out ->> 'points')::int = 0 AND (v_out ->> 'essais')::int = 0
     AND (v_out ->> 'transformations')::int = 0 AND (v_out ->> 'penalites')::int = 0
     AND (v_out ->> 'drops')::int = 0 AND (v_out ->> 'pied_reussis')::int = 0
     AND jsonb_array_length(v_actions) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN v_out;
END;
$fn$;

REVOKE ALL ON FUNCTION public._ej_libelle_marq(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_reperes(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. _ej_json_match : + clé 'reperes' côté joueur (même signature, même
--    contenu par ailleurs que sql_263)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ej_json_match(m public.eval_match, p_staff boolean)
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
     ELSE jsonb_build_object('reperes', public._ej_reperes(m.personne_id, m.evenement_id, false)) END;
$fn$;
REVOKE ALL ON FUNCTION public._ej_json_match(public.eval_match, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC staff : repères complets d'un joueur sur un match
-- ---------------------------------------------------------------------
CREATE FUNCTION public.reperes_match_joueur(p_evenement_id uuid, p_personne_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
BEGIN
  IF p_evenement_id IS NULL OR p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_evenement_id et p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  v_cat := public._ej_cat_evenement(p_evenement_id);
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'Match % introuvable ou sans catégorie', p_evenement_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN public._ej_reperes(p_personne_id, p_evenement_id, true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.reperes_match_joueur(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reperes_match_joueur(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) _ej_ exécutable(s) par anon/authenticated', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'reperes_match_joueur' AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: reperes_match_joueur mal protégée (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_ej_json_match';
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: _ej_json_match en % exemplaires (surcharge ?)', v_n; END IF;

  RAISE NOTICE 'VERIF OK : helpers fermés, RPC staff protégée, _ej_json_match unique';
END;
$verif$;

COMMIT;
