-- =====================================================================
-- sql_282 — PARCOURS-PERFORMANCE v1.3, lot L7 : « Mon Parcours » dans
-- l'espace joueur et famille
-- ---------------------------------------------------------------------
-- FAIT FOI : FAIT-FOI-PARCOURS-PERFORMANCE-v1.3.md (gelé par Manu le
-- 21/11/2026), D20.
--
-- Contenu :
--   1. _ej_json_parcours(personne, saison) → jsonb :
--        { equipe:       statut de saison en équipe Performance ou null,
--          convocations: convocations du joueur aux statuts convoqué,
--                        retenu et réserviste SEULEMENT (D20),
--          matchs:       matchs en équipe Performance + matchs de
--                        sélection des convocations visibles }
--      Aucune note du staff (ni convocation, ni joueur, ni match).
--      Fonction interne : exécutable par aucun rôle client (appelée par
--      get_espace_joueur, SECURITY DEFINER).
--   2. get_espace_joueur : ajout de la seule clé 'parcours'. La nouvelle
--      définition est CONSTRUITE À PARTIR de la définition en place
--      (pg_get_functiondef, empreinte vérifiée) : le reste de la
--      fonction est repris à l'octet près. Signature, retour, droits et
--      propriétaire inchangés (même signature : pas de surcharge).
--   3. Vérification fail-loud : en retirant le fragment ajouté, la
--      définition redonne exactement l'empreinte d'avant.
--
-- Sondes DS-1 (21/11/2026, lecture seule) : get_espace_joueur(p_token
-- text) RETURNS jsonb, SECURITY DEFINER, propriétaire postgres, md5 de
-- la définition 1138c650ee53f976bc42bd782d69161e (3 394 caractères),
-- exécutable par anon, authenticated et service_role. Tables sql_281 :
-- 0 convocation, 26 participations.
--
-- Mode : COMMIT (identique au DRY-RUN hors tests, à appliquer uniquement
-- sur feu vert explicite de Manu). Dry-run vert le 21/11/2026 : VERIF OK
-- + tests T1 à T8 conformes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Contenu de la section « Mon Parcours » (D20)
-- ---------------------------------------------------------------------
CREATE FUNCTION public._ej_json_parcours(p_pid uuid, p_saison uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'equipe', (SELECT jsonb_build_object('statut', s.statut, 'structure', s.structure,
                                         'equipe_accueil', s.equipe_accueil)
               FROM public.parcours_performance_saison s
               WHERE s.personne_id = p_pid AND s.saison_id = p_saison),
    'convocations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id, 'type', c.type, 'intitule', c.intitule,
               'date_debut', c.date_debut, 'date_fin', c.date_fin,
               'lieu', c.lieu, 'equipe', c.equipe, 'organisateur', c.organisateur,
               'statut', j.statut)
             ORDER BY c.date_debut DESC, c.intitule)
      FROM public.parcours_convocation_joueur j
      JOIN public.parcours_convocation c ON c.id = j.convocation_id
      WHERE j.personne_id = p_pid AND c.saison_id = p_saison
        AND j.statut IN ('convoque', 'retenu', 'reserviste')), '[]'::jsonb),
    'matchs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'convocation_id', m.convocation_id, 'date_match', m.date_match,
               'competition', m.competition, 'phase', m.phase,
               'equipe_accueil', m.equipe_accueil, 'adversaire', m.adversaire,
               'lieu', m.lieu, 'score_pour', m.score_pour, 'score_contre', m.score_contre,
               'statut_joueur', m.statut_joueur, 'numero', m.numero, 'capitaine', m.capitaine,
               'essais', m.essais, 'transformations', m.transformations,
               'penalites', m.penalites, 'drops', m.drops,
               'points', m.essais * 5 + m.transformations * 2 + m.penalites * 3 + m.drops * 3)
             ORDER BY m.date_match DESC, m.phase)
      FROM public.parcours_performance_match m
      WHERE m.personne_id = p_pid AND m.saison_id = p_saison
        AND (m.convocation_id IS NULL
             OR EXISTS (SELECT 1 FROM public.parcours_convocation_joueur j
                        WHERE j.convocation_id = m.convocation_id AND j.personne_id = p_pid
                          AND j.statut IN ('convoque', 'retenu', 'reserviste')))), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public._ej_json_parcours(uuid, uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public._ej_json_parcours(uuid, uuid) IS
'Espace joueur : section Mon Parcours (FAIT FOI PARCOURS-PERFORMANCE v1.3 D20, sql_282). Interne, appelée par get_espace_joueur.';

-- ---------------------------------------------------------------------
-- 2. get_espace_joueur : + clé 'parcours', reste repris à l'octet près
-- ---------------------------------------------------------------------
DO $maj$
DECLARE
  v_def text := pg_get_functiondef('public.get_espace_joueur(text)'::regprocedure);
  v_ancre text := E'WHERE a.personne_id = v_pid AND e.saison_id = v_saison), \'[]\'::jsonb))\n  INTO v_out';
  v_ajout text := E',\n    -- sql_282 (PARCOURS-PERFORMANCE v1.3, D20) : section Mon Parcours.\n    \'parcours\', public._ej_json_parcours(v_pid, v_saison)';
  v_neuf text;
BEGIN
  IF md5(v_def) <> '1138c650ee53f976bc42bd782d69161e' THEN
    RAISE EXCEPTION 'MAJ: get_espace_joueur a changé depuis la sonde (md5 %)', md5(v_def);
  END IF;
  IF (length(v_def) - length(replace(v_def, v_ancre, ''))) / length(v_ancre) <> 1 THEN
    RAISE EXCEPTION 'MAJ: ancre absente ou non unique dans get_espace_joueur';
  END IF;
  v_neuf := replace(v_def, v_ancre,
    E'WHERE a.personne_id = v_pid AND e.saison_id = v_saison), \'[]\'::jsonb)' || v_ajout || E')\n  INTO v_out');
  EXECUTE v_neuf;
END;
$maj$;

-- ---------------------------------------------------------------------
-- 3. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_def text := pg_get_functiondef('public.get_espace_joueur(text)'::regprocedure);
  v_ajout text := E',\n    -- sql_282 (PARCOURS-PERFORMANCE v1.3, D20) : section Mon Parcours.\n    \'parcours\', public._ej_json_parcours(v_pid, v_saison)';
  v_n int;
BEGIN
  IF md5(replace(v_def, v_ajout, '')) <> '1138c650ee53f976bc42bd782d69161e' THEN
    RAISE EXCEPTION 'VERIF: get_espace_joueur modifiée au-delà de la clé parcours';
  END IF;
  IF position('_ej_json_parcours' IN v_def) = 0 THEN
    RAISE EXCEPTION 'VERIF: clé parcours absente';
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_espace_joueur';
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: surcharge de get_espace_joueur (%)', v_n; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_espace_joueur(text)'::regprocedure) THEN
    RAISE EXCEPTION 'VERIF: get_espace_joueur n''est plus SECURITY DEFINER';
  END IF;
  IF NOT has_function_privilege('anon', 'public.get_espace_joueur(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF: get_espace_joueur n''est plus exécutable par anon';
  END IF;
  IF has_function_privilege('anon', 'public._ej_json_parcours(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._ej_json_parcours(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF: _ej_json_parcours exécutable par un rôle client';
  END IF;
  RAISE NOTICE 'VERIF OK : clé parcours seule ajoutée, fonction SECURITY DEFINER, droits inchangés, fonction interne protégée';
END;
$verif$;

COMMIT;
