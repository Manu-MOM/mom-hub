-- =====================================================================
-- sql_259_clore_cycle
-- ---------------------------------------------------------------------
-- Chantier : CLORE-CYCLE (conçu le 29/06/2026, MEMO-cadrage-clore-cycle-
-- bilan-questionnaire ; décisions complétées par Manu le 16/10/2026,
-- « je te suis dans tes recommandations ») :
--   C1 geste proposé sur une mission « intervention_scolaire » dont TOUTES
--      les séances sont validées ou annulées (>= 1 validée).
--   C2 « Clore le cycle » = bilan interne (missions.bilan_text, obligatoire)
--      + mission passée à l'état « terminee » (CHECK réel prevue|terminee|
--      annulee). Le bilan reste modifiable ensuite par le même geste.
--      Fait par le SALARIÉ de la mission (Lohann) OU admin|bureau : voie 3,
--      modèle declarer_occurrence (upsert_mission reste admin|bureau).
--   C3 questionnaire de satisfaction = bouton SÉPARÉ, après clôture : le Hub
--      prépare un mail-type (data/mail-types.json, clé « satisfaction »),
--      l'utilisateur l'envoie ; aucune collecte de réponses dans le Hub.
--      marquer_questionnaire_envoye passe questionnaire_fait à true sur une
--      LISTE de missions (un seul mail par école couvre ses classes closes —
--      décision déléguée tracée).
--   C4 emplacement : en-tête de mission de suivi-salarie.html.
--
-- Garde d'accès commune : admin|bureau (_gs_peut_ecrire) OU personne
-- connectée (qui_suis_je) = missions.salarie_id. Refus d'accès :
-- insufficient_privilege ; refus métier : check_violation.
-- Grants : authenticated seul (ni PUBLIC ni anon).
--
-- Vérification : tests dans un sous-bloc annulé par sentinelle -> aucune
-- donnée de test conservée, y compris en version COMMIT.
--
-- MODE : COMMIT — identique au DRY-RUN, ROLLBACK final remplacé par COMMIT.
-- La vérification ne laisse aucune donnée de test (sous-bloc annulé).
-- À exécuter uniquement sur feu vert explicite de Manu, après DRY-RUN vert.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. clore_cycle
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.clore_cycle(uuid, text);

CREATE FUNCTION public.clore_cycle(p_mission_id uuid, p_bilan text)
RETURNS public.missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_m     public.missions;
  v_me    uuid;
  v_bilan text := btrim(coalesce(p_bilan, ''));
BEGIN
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'check_violation';
  END IF;

  v_me := (SELECT q.personne_id FROM public.qui_suis_je() q);
  IF NOT (public._gs_peut_ecrire() OR (v_me IS NOT NULL AND v_me = v_m.salarie_id)) THEN
    RAISE EXCEPTION 'Clôture réservée à l''administration ou au salarié de la mission.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_m.type_mission IS DISTINCT FROM 'intervention_scolaire' THEN
    RAISE EXCEPTION 'Seul un cycle d''intervention scolaire se clôt.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_m.etat = 'annulee' THEN
    RAISE EXCEPTION 'Mission annulée : rien à clôturer.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mission_seances s
             WHERE s.mission_id = p_mission_id AND s.etat IN ('prevue', 'realisee')) THEN
    RAISE EXCEPTION 'Cycle non terminé : des séances sont encore à valider ou à venir.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mission_seances s
                 WHERE s.mission_id = p_mission_id AND s.etat = 'validee') THEN
    RAISE EXCEPTION 'Aucune séance validée sur ce cycle.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_bilan) = 0 THEN
    RAISE EXCEPTION 'Le bilan du cycle est obligatoire.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.missions
     SET etat = 'terminee', bilan_text = v_bilan
   WHERE id = p_mission_id;

  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id;
  RETURN v_m;
END $$;

-- ---------------------------------------------------------------------
-- 2. marquer_questionnaire_envoye
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.marquer_questionnaire_envoye(uuid[]);

CREATE FUNCTION public.marquer_questionnaire_envoye(p_mission_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me    uuid;
  v_n     integer;
  v_found integer;
  v_bad   text;
BEGIN
  IF p_mission_ids IS NULL OR cardinality(p_mission_ids) = 0 THEN
    RAISE EXCEPTION 'Aucune mission fournie.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(DISTINCT x) INTO v_n FROM unnest(p_mission_ids) AS x;

  PERFORM 1 FROM public.missions WHERE id = ANY (p_mission_ids) FOR UPDATE;
  SELECT count(*) INTO v_found FROM public.missions WHERE id = ANY (p_mission_ids);
  IF v_found <> v_n THEN
    RAISE EXCEPTION 'Mission introuvable (% sur %).', v_found, v_n USING ERRCODE = 'check_violation';
  END IF;

  v_me := (SELECT q.personne_id FROM public.qui_suis_je() q);
  IF NOT public._gs_peut_ecrire() AND EXISTS (
       SELECT 1 FROM public.missions
       WHERE id = ANY (p_mission_ids) AND (v_me IS NULL OR salarie_id IS DISTINCT FROM v_me)) THEN
    RAISE EXCEPTION 'Action réservée à l''administration ou au salarié des missions.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT string_agg(libelle, ', ') INTO v_bad FROM public.missions
  WHERE id = ANY (p_mission_ids) AND etat IS DISTINCT FROM 'terminee';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cycle non clôturé : %', v_bad USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.missions SET questionnaire_fait = true
   WHERE id = ANY (p_mission_ids) AND questionnaire_fait IS DISTINCT FROM true;
  GET DIAGNOSTICS v_found = ROW_COUNT;
  RETURN v_found;
END $$;

REVOKE EXECUTE ON FUNCTION public.clore_cycle(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.marquer_questionnaire_envoye(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.clore_cycle(uuid, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.marquer_questionnaire_envoye(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Vérification fail-loud (sans donnée résiduelle)
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  c_manu     CONSTANT text := '7ac40334-0d2a-4b1f-822b-133d564abe6c';
  c_inconnu  CONSTANT text := '00000000-0000-0000-0000-00000000dead';
  v_fini     uuid;
  v_fini2    uuid;
  v_ouvert   uuid;
  v_interne  uuid;
  v_sal_uid  text;
  v_snap     jsonb;
  v_m        public.missions;
  v_ok       boolean;
  n          integer;
BEGIN
  -- V1. Fonctions : SECURITY DEFINER, pas d'anon
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prosecdef AND p.proname IN ('clore_cycle', 'marquer_questionnaire_envoye');
  IF n <> 2 THEN RAISE EXCEPTION 'V1 KO : % RPC SECURITY DEFINER sur 2', n; END IF;
  IF has_function_privilege('anon', 'public.clore_cycle(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.marquer_questionnaire_envoye(uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'V1 KO : anon peut exécuter';
  END IF;

  -- Jeu de test (lecture seule) : 2 cycles scolaires terminés non clos, 1 ouvert, 1 interne
  SELECT m.id INTO v_fini FROM public.missions m
  WHERE m.type_mission = 'intervention_scolaire' AND m.etat = 'prevue'
    AND EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat = 'validee')
    AND NOT EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat IN ('prevue', 'realisee'))
  ORDER BY m.libelle LIMIT 1;
  SELECT m.id INTO v_fini2 FROM public.missions m
  WHERE m.type_mission = 'intervention_scolaire' AND m.etat = 'prevue' AND m.id <> v_fini
    AND EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat = 'validee')
    AND NOT EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat IN ('prevue', 'realisee'))
  ORDER BY m.libelle LIMIT 1;
  SELECT m.id INTO v_ouvert FROM public.missions m
  WHERE m.type_mission = 'intervention_scolaire' AND m.etat = 'prevue'
    AND EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat IN ('prevue', 'realisee'))
  ORDER BY m.libelle LIMIT 1;
  SELECT m.id INTO v_interne FROM public.missions m
  WHERE m.type_mission <> 'intervention_scolaire' ORDER BY m.libelle LIMIT 1;
  IF v_fini IS NULL OR v_fini2 IS NULL OR v_ouvert IS NULL OR v_interne IS NULL THEN
    RAISE EXCEPTION 'Jeu de test incomplet (2 cycles terminés, 1 ouvert, 1 interne requis)';
  END IF;
  SELECT ap.user_id::text INTO v_sal_uid FROM public.auth_personne ap
  JOIN public.missions m ON m.salarie_id = ap.personne_id WHERE m.id = v_fini LIMIT 1;

  -- Instantané des missions (contrôle final : rien n'a bougé)
  SELECT jsonb_agg(jsonb_build_array(id, etat, bilan_text, questionnaire_fait) ORDER BY id) INTO v_snap
  FROM public.missions;

  BEGIN
    -- T1. Sans session, puis compte sans rôle ni mission : refus
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    v_ok := false;
    BEGIN PERFORM public.clore_cycle(v_fini, 'x');
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T1 KO : clôture sans session'; END IF;
    PERFORM set_config('request.jwt.claim.sub', c_inconnu, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_inconnu)::text, true);
    v_ok := false;
    BEGIN PERFORM public.clore_cycle(v_fini, 'x');
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T1 KO : clôture par un tiers'; END IF;

    -- T2. Salarié de la mission (voie 3), si son compte existe
    IF v_sal_uid IS NOT NULL THEN
      PERFORM set_config('request.jwt.claim.sub', v_sal_uid, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sal_uid)::text, true);
      v_m := public.clore_cycle(v_fini, '  Bilan test salarié  ');
      IF v_m.etat <> 'terminee' OR v_m.bilan_text <> 'Bilan test salarié' THEN
        RAISE EXCEPTION 'T2 KO : %', row_to_json(v_m);
      END IF;
      n := public.marquer_questionnaire_envoye(ARRAY[v_fini]);
      IF n <> 1 THEN RAISE EXCEPTION 'T2 KO : questionnaire (%)', n; END IF;
    END IF;

    -- Session admin de Manu
    PERFORM set_config('request.jwt.claim.sub', c_manu, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_manu)::text, true);

    -- T3. Refus métier : bilan vide, cycle ouvert, mission non scolaire
    v_ok := false;
    BEGIN PERFORM public.clore_cycle(v_fini2, '   ');
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T3 KO : bilan vide accepté'; END IF;
    v_ok := false;
    BEGIN PERFORM public.clore_cycle(v_ouvert, 'x');
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T3 KO : cycle ouvert clos'; END IF;
    v_ok := false;
    BEGIN PERFORM public.clore_cycle(v_interne, 'x');
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T3 KO : mission interne close'; END IF;

    -- T4. Questionnaire avant clôture : refus
    v_ok := false;
    BEGIN PERFORM public.marquer_questionnaire_envoye(ARRAY[v_fini2]);
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T4 KO : questionnaire avant clôture accepté'; END IF;

    -- T5. Clôture admin, puis modification du bilan
    v_m := public.clore_cycle(v_fini2, 'Bilan 1');
    IF v_m.etat <> 'terminee' OR v_m.bilan_text <> 'Bilan 1' THEN RAISE EXCEPTION 'T5 KO : %', row_to_json(v_m); END IF;
    v_m := public.clore_cycle(v_fini2, 'Bilan 2');
    IF v_m.bilan_text <> 'Bilan 2' THEN RAISE EXCEPTION 'T5 KO : modification du bilan'; END IF;

    -- T6. Questionnaire sur une liste (idempotent)
    IF v_sal_uid IS NOT NULL THEN
      -- v_fini déjà clos et questionnaire déjà marqué en T2 : seule v_fini2 change
      n := public.marquer_questionnaire_envoye(ARRAY[v_fini, v_fini2]);
      IF n <> 1 THEN RAISE EXCEPTION 'T6 KO : % ligne(s) (attendu 1)', n; END IF;
    ELSE
      n := public.marquer_questionnaire_envoye(ARRAY[v_fini2]);
      IF n <> 1 THEN RAISE EXCEPTION 'T6 KO : % ligne(s) (attendu 1)', n; END IF;
    END IF;
    SELECT count(*) INTO n FROM public.missions WHERE id = v_fini2 AND questionnaire_fait;
    IF n <> 1 THEN RAISE EXCEPTION 'T6 KO : questionnaire non marqué'; END IF;

    RAISE EXCEPTION '__TESTS_OK__';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '__TESTS_OK__' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- V2. Aucune trace des tests
  IF v_snap IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(id, etat, bilan_text, questionnaire_fait) ORDER BY id)
                              FROM public.missions) THEN
    RAISE EXCEPTION 'V2 KO : missions modifiées par les tests';
  END IF;

  RAISE NOTICE 'VERIF OK : V1..V2 + T1..T6 verts (voie salarié %), aucune donnée de test conservée',
    CASE WHEN v_sal_uid IS NULL THEN 'NON testée : compte du salarié introuvable' ELSE 'testée' END;
END;
$verif$;

COMMIT;
