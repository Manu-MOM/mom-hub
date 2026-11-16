-- =====================================================================
-- sql_266_eval_joueur_signalement
-- FAIT FOI « EVAL-JOUEUR » v1, §9 Avenant A, complément D24–D27
--   (signalement blessure / gêne / fatigue), gelé par Manu le 16/11/2026
--   (« je gèle »).
--   D24 question obligatoire Oui / Non ; si Oui, détail requis (500 car.)
--   D25 visible du joueur (le sien) et des encadrants de la catégorie
--       seulement (accès RPC ; hors frise / comparaison : côté écran)
--   D26 aucune ligne « blessures » créée automatiquement (rien ici)
--   D27 figé avec l'auto-évaluation (D20 inchangé)
--
-- Contenu :
--   ALTER auto_eval_match : + gene_signalee (NOT NULL), + gene_detail,
--                           contrainte « détail ssi Oui »
--   _ej_json_auto           REMPLACÉ (même signature) : + gene
--   envoyer_auto_eval       DROP + CREATE (+ p_gene_signalee,
--                           + p_gene_detail ; jamais d'overload)
-- Prérequis : sql_265 appliqué ; auto_eval_match vide (aucun front
--   n'appelle encore envoyer_auto_eval) ; sinon l'ALTER échoue (voulu).
-- Mode : COMMIT (corps identique au dry-run vert du 16/11/2026, 8/8,
--   sans les tests). Appliqué via apply_migration (corps sans BEGIN/COMMIT).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Schéma
-- ---------------------------------------------------------------------
ALTER TABLE public.auto_eval_match
  ADD COLUMN gene_signalee boolean NOT NULL,
  ADD COLUMN gene_detail varchar(500);
ALTER TABLE public.auto_eval_match
  ADD CONSTRAINT auto_eval_match_gene_check CHECK (
    (gene_signalee AND gene_detail IS NOT NULL AND btrim(gene_detail) <> '')
    OR (NOT gene_signalee AND gene_detail IS NULL));
COMMENT ON COLUMN public.auto_eval_match.gene_signalee IS
  'D24 : le joueur signale une blessure, une gêne ou une fatigue importante. Donnée de santé : joueur + encadrants de la catégorie uniquement (D25).';

-- ---------------------------------------------------------------------
-- 2. _ej_json_auto (même signature) : + gene
-- ---------------------------------------------------------------------
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
      'comprehension', a.feu_comprehension, 'etat_esprit', a.feu_etat_esprit),
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
REVOKE ALL ON FUNCTION public._ej_json_auto(public.auto_eval_match) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. envoyer_auto_eval : DROP + CREATE (D24)
-- ---------------------------------------------------------------------
DROP FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, text);
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
  v_gene text := nullif(btrim(p_gene_detail), '');
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
  IF EXISTS (SELECT 1 FROM public.auto_eval_match a
             WHERE a.personne_id = v_pid AND a.evenement_id = p_evenement_id) THEN
    RAISE EXCEPTION 'Auto-évaluation déjà envoyée pour ce match' USING ERRCODE = '23505';
  END IF;
  IF NOT public._ej_match_auto_evaluable(v_pid, p_evenement_id) THEN
    RAISE EXCEPTION 'Ce match ne peut pas être auto-évalué' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.auto_eval_match (personne_id, evenement_id,
    feu_tech_indiv, feu_physique, feu_tech_poste, feu_comprehension, feu_etat_esprit,
    commentaire, gene_signalee, gene_detail)
  VALUES (v_pid, p_evenement_id, v_feux[1], v_feux[2], v_feux[3], v_feux[4], v_feux[5],
          v_txt, p_gene_signalee, v_gene)
  RETURNING * INTO v_row;
  RETURN public._ej_json_auto(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.envoyer_auto_eval(text, uuid, text, text, text, text, text, boolean, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('envoyer_auto_eval', '_ej_json_auto');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: surcharge inattendue (envoyer_auto_eval / _ej_json_auto : %)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE '\_ej\_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % helper(s) _ej_ ouvert(s)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname IN ('get_espace_joueur', 'repondre_eval', 'envoyer_auto_eval');
  IF v_n <> 3 THEN RAISE EXCEPTION 'VERIF: les 3 RPC espace joueur doivent être ouvertes à anon (%)', v_n; END IF;

  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
