-- =====================================================================
-- sql_268_eval_joueur_code_perso
-- FAIT FOI « EVAL-JOUEUR » v1, §10 Avenant B (B3–B7), gelé par Manu le
--   16/11/2026 (« je gèle : code à 4 chiffres / durée de session de 2 h /
--   code oublié : réinitialiser seulement le code »).
--
-- Contenu :
--   lien_espace_joueur : + code_hash, code_defini_le, essais_echoues,
--                        bloque_jusqua
--   session_espace_joueur : nouvelle table (jeton 64 hex, + 2 h)
--   _ej_personne_du_jeton   REMPLACÉ (même signature) : résout désormais
--                           un jeton de SESSION valide (lien non révoqué)
--   _ej_lien_du_jeton       nouveau helper fermé (jeton du LIEN)
--   _ej_ouvrir_session      nouveau helper fermé
--   etat_acces_espace, definir_code_espace, ouvrir_session_espace
--                           nouvelles RPC anon (jeton du LIEN)
--   get_espace_joueur       REMPLACÉ (même signature) : consultation
--                           notée via la session
--   reinitialiser_code_espace  nouvelle RPC staff
--   get_lien_espace_joueur, lister_evals_joueur  REMPLACÉS : + code_defini,
--                           code_bloque_jusqua
-- COUPURE ASSUMÉE (FAIT FOI §10.2) : l'espace joueur actuel ne s'ouvre plus
--   tant que le front B n'est pas déployé.
-- Mode : COMMIT (corps identique au dry-run vert, sans les tests).
--   Appliqué via apply_migration (corps sans BEGIN/COMMIT).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Schéma
-- ---------------------------------------------------------------------
ALTER TABLE public.lien_espace_joueur
  ADD COLUMN code_hash text,
  ADD COLUMN code_defini_le timestamptz,
  ADD COLUMN essais_echoues int NOT NULL DEFAULT 0,
  ADD COLUMN bloque_jusqua timestamptz;

CREATE TABLE public.session_espace_joueur (
  jeton     text PRIMARY KEY CHECK (jeton ~ '^[0-9a-f]{64}$'),
  lien_id   uuid NOT NULL REFERENCES public.lien_espace_joueur(id) ON DELETE CASCADE,
  cree_le   timestamptz NOT NULL DEFAULT now(),
  expire_le timestamptz NOT NULL
);
CREATE INDEX session_ej_lien_idx ON public.session_espace_joueur (lien_id);
ALTER TABLE public.session_espace_joueur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_espace_joueur FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.session_espace_joueur IS
  'EVAL-JOUEUR Avenant B (B4) : session de 2 h ouverte par le code perso. Accès via RPC uniquement (sql_268).';

-- ---------------------------------------------------------------------
-- 2. Helpers fermés
-- ---------------------------------------------------------------------
-- B4 : à partir de sql_268, p_token des RPC de données = jeton de SESSION.
CREATE OR REPLACE FUNCTION public._ej_personne_du_jeton(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT l.personne_id
  FROM public.session_espace_joueur s
  JOIN public.lien_espace_joueur l ON l.id = s.lien_id
  WHERE s.jeton = p_token AND s.expire_le > now() AND NOT l.revoque
  LIMIT 1;
$fn$;

CREATE FUNCTION public._ej_lien_du_jeton(p_token text)
RETURNS public.lien_espace_joueur
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT l.* FROM public.lien_espace_joueur l
  WHERE l.token = p_token AND NOT l.revoque
  LIMIT 1;
$fn$;

CREATE FUNCTION public._ej_ouvrir_session(p_lien_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_jeton text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_exp timestamptz := now() + interval '2 hours';
BEGIN
  DELETE FROM public.session_espace_joueur s WHERE s.expire_le <= now();
  INSERT INTO public.session_espace_joueur (jeton, lien_id, expire_le) VALUES (v_jeton, p_lien_id, v_exp);
  RETURN jsonb_build_object('ok', true, 'session', v_jeton, 'expire_le', v_exp);
END;
$fn$;

REVOKE ALL ON FUNCTION public._ej_personne_du_jeton(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_lien_du_jeton(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ej_ouvrir_session(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC anon d'accès (jeton du LIEN)
-- ---------------------------------------------------------------------
CREATE FUNCTION public.etat_acces_espace(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_l public.lien_espace_joueur := public._ej_lien_du_jeton(p_token);
BEGIN
  IF v_l.id IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('code_defini', v_l.code_hash IS NOT NULL,
    'bloque_jusqua', CASE WHEN v_l.bloque_jusqua > now() THEN v_l.bloque_jusqua END);
END;
$fn$;

CREATE FUNCTION public.definir_code_espace(p_token text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_l public.lien_espace_joueur := public._ej_lien_du_jeton(p_token);
BEGIN
  IF v_l.id IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  IF v_l.code_hash IS NOT NULL THEN
    RAISE EXCEPTION 'Un code existe déjà pour ce lien' USING ERRCODE = '23505';
  END IF;
  IF p_code IS NULL OR p_code !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Le code doit faire 4 chiffres' USING ERRCODE = '22023';
  END IF;
  UPDATE public.lien_espace_joueur l
    SET code_hash = extensions.crypt(p_code, extensions.gen_salt('bf', 8)),
        code_defini_le = now(), essais_echoues = 0, bloque_jusqua = NULL
    WHERE l.id = v_l.id;
  RETURN public._ej_ouvrir_session(v_l.id);
END;
$fn$;

-- B5 : un code faux NE lève PAS d'exception (sinon le compteur serait annulé).
CREATE FUNCTION public.ouvrir_session_espace(p_token text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_l public.lien_espace_joueur := public._ej_lien_du_jeton(p_token);
  v_essais int;
  v_bloc timestamptz;
BEGIN
  IF v_l.id IS NULL THEN
    RAISE EXCEPTION 'Lien invalide ou expiré' USING ERRCODE = '42501';
  END IF;
  IF v_l.code_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'pas_de_code');
  END IF;
  IF v_l.bloque_jusqua > now() THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'bloque', 'bloque_jusqua', v_l.bloque_jusqua);
  END IF;
  IF p_code IS NOT NULL AND p_code ~ '^[0-9]{4}$'
     AND extensions.crypt(p_code, v_l.code_hash) = v_l.code_hash THEN
    UPDATE public.lien_espace_joueur l SET essais_echoues = 0, bloque_jusqua = NULL WHERE l.id = v_l.id;
    RETURN public._ej_ouvrir_session(v_l.id);
  END IF;
  v_essais := v_l.essais_echoues + 1;
  IF v_essais >= 5 THEN
    UPDATE public.lien_espace_joueur l
      SET essais_echoues = 0, bloque_jusqua = now() + interval '15 minutes'
      WHERE l.id = v_l.id
      RETURNING l.bloque_jusqua INTO v_bloc;
    RETURN jsonb_build_object('ok', false, 'raison', 'bloque', 'bloque_jusqua', v_bloc);
  END IF;
  UPDATE public.lien_espace_joueur l SET essais_echoues = v_essais WHERE l.id = v_l.id;
  RETURN jsonb_build_object('ok', false, 'raison', 'code', 'essais_restants', 5 - v_essais);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. get_espace_joueur (même signature) : consultation via la session
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
-- 5. RPC staff
-- ---------------------------------------------------------------------
CREATE FUNCTION public.reinitialiser_code_espace(p_personne_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public._ej_peut_ecrire_joueur(p_personne_id) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  UPDATE public.lien_espace_joueur l
    SET code_hash = NULL, code_defini_le = NULL, essais_echoues = 0, bloque_jusqua = NULL
    WHERE l.personne_id = p_personne_id AND NOT l.revoque
    RETURNING l.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Aucun lien actif pour ce joueur' USING ERRCODE = '02000';
  END IF;
  DELETE FROM public.session_espace_joueur s WHERE s.lien_id = v_id;
  RETURN jsonb_build_object('code_defini', false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_lien_espace_joueur(p_personne_id uuid)
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
                                    'derniere_consultation', l.derniere_consultation,
                                    'code_defini', l.code_hash IS NOT NULL,
                                    'code_bloque_jusqua', CASE WHEN l.bloque_jusqua > now() THEN l.bloque_jusqua END)
          FROM public.lien_espace_joueur l
          WHERE l.personne_id = p_personne_id AND NOT l.revoque);
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
                                       'derniere_consultation', l.derniere_consultation,
                                       'code_defini', l.code_hash IS NOT NULL,
                                       'code_bloque_jusqua', CASE WHEN l.bloque_jusqua > now() THEN l.bloque_jusqua END)
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

REVOKE ALL ON FUNCTION public.etat_acces_espace(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.definir_code_espace(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ouvrir_session_espace(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.etat_acces_espace(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.definir_code_espace(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ouvrir_session_espace(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.reinitialiser_code_espace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reinitialiser_code_espace(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) _ej_ ouvert(s)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('get_espace_joueur', 'repondre_eval', 'envoyer_auto_eval',
                      'etat_acces_espace', 'definir_code_espace', 'ouvrir_session_espace');
  IF v_n <> 6 THEN RAISE EXCEPTION 'VERIF: 6 RPC espace joueur attendues (%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('reinitialiser_code_espace', 'get_lien_espace_joueur', 'lister_evals_joueur', 'generer_lien_espace_joueur');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: RPC staff ouverte(s) à anon (%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('_ej_personne_du_jeton', 'get_espace_joueur', 'get_lien_espace_joueur', 'lister_evals_joueur');
  IF v_n <> 4 THEN RAISE EXCEPTION 'VERIF: surcharge inattendue (%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'session_espace_joueur' AND c.relrowsecurity;
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: RLS inactive sur session_espace_joueur'; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
