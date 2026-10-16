-- =====================================================================
-- sql_258_factures_double_numerotation
-- ---------------------------------------------------------------------
-- Chantier : FACTURE-DOUBLE-NUMEROTATION
-- FAIT FOI gelé par Manu le 16/10/2026 (« je gèle »), demande de la
-- trésorière (Cindy HORNECKER) : les factures écoles entrent dans le flot
-- général des factures du club, dont les numéros doivent se suivre.
--   N1 deux temps : le Hub prépare la facture (numéro Hub = référence
--      interne, factures.numero, inchangé) ; elle reste « en attente de
--      numéro » tant que la trésorière n'a pas saisi le NUMÉRO OFFICIEL
--      (factures.numero_officiel), seul numéro « Nos Réf. » du PDF définitif.
--   N2 date de la facture = date d'attribution du numéro officiel
--      (factures.date_officielle) ; date_emission = date de préparation.
--   N3 numéro officiel en texte libre ; seul contrôle : unicité.
--   N4 correction possible (admin|bureau) tant que la facture n'est pas
--      marquée envoyée (factures.envoyee_le) ; chaque saisie est tracée
--      (factures.historique_numero : numéro, personne, horodatage).
--      Avoirs / annulation : hors v1.
--
-- Accès : inchangé (RLS sans policy, RPC SECURITY DEFINER gardées
-- _gs_peut_ecrire, authenticated seul). list_factures (RETURN QUERY
-- SELECT *) renvoie les nouvelles colonnes sans modification.
-- Refus métier : check_violation ; numéro déjà pris : unique_violation.
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
-- 1. Colonnes
-- ---------------------------------------------------------------------
ALTER TABLE public.factures
  ADD COLUMN numero_officiel   text,
  ADD COLUMN date_officielle   date,
  ADD COLUMN envoyee_le        timestamptz,
  ADD COLUMN envoyee_par       uuid,
  ADD COLUMN historique_numero jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT factures_numero_officiel_key UNIQUE (numero_officiel),
  ADD CONSTRAINT factures_numero_officiel_check
    CHECK (numero_officiel IS NULL OR length(btrim(numero_officiel)) > 0),
  ADD CONSTRAINT factures_envoi_check
    CHECK (envoyee_le IS NULL OR numero_officiel IS NOT NULL);

-- ---------------------------------------------------------------------
-- 2. attribuer_numero_facture : saisie ou correction du numéro officiel
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.attribuer_numero_facture(uuid, text);

CREATE FUNCTION public.attribuer_numero_facture(p_facture_id uuid, p_numero text)
RETURNS public.factures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row    public.factures;
  v_num    text := btrim(coalesce(p_numero, ''));
  v_me     uuid;
  v_jour   date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF NOT public._gs_peut_ecrire() THEN
    RAISE EXCEPTION 'Numérotation réservée à l''administration (admin ou bureau).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM public.factures WHERE id = p_facture_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_row.envoyee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Facture déjà envoyée : son numéro ne peut plus être modifié.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_num) = 0 THEN
    RAISE EXCEPTION 'Numéro de facture obligatoire.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.factures WHERE numero_officiel = v_num AND id <> p_facture_id) THEN
    RAISE EXCEPTION 'Le numéro % est déjà attribué à une autre facture.', v_num
      USING ERRCODE = 'unique_violation';
  END IF;

  v_me := (SELECT q.personne_id FROM public.qui_suis_je() q);

  UPDATE public.factures
     SET numero_officiel   = v_num,
         date_officielle   = v_jour,
         historique_numero = historique_numero || jsonb_build_array(jsonb_build_object(
                               'numero', v_num, 'par', v_me, 'le', now()))
   WHERE id = p_facture_id;

  SELECT * INTO v_row FROM public.factures WHERE id = p_facture_id;
  RETURN v_row;
END $$;

-- ---------------------------------------------------------------------
-- 3. marquer_facture_envoyee : fige le numéro officiel
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.marquer_facture_envoyee(uuid);

CREATE FUNCTION public.marquer_facture_envoyee(p_facture_id uuid)
RETURNS public.factures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.factures;
BEGIN
  IF NOT public._gs_peut_ecrire() THEN
    RAISE EXCEPTION 'Action réservée à l''administration (admin ou bureau).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM public.factures WHERE id = p_facture_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_row.numero_officiel IS NULL THEN
    RAISE EXCEPTION 'Attribuez d''abord le numéro de facture.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_row.envoyee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Facture déjà marquée envoyée.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.factures
     SET envoyee_le  = now(),
         envoyee_par = (SELECT q.personne_id FROM public.qui_suis_je() q)
   WHERE id = p_facture_id;

  SELECT * INTO v_row FROM public.factures WHERE id = p_facture_id;
  RETURN v_row;
END $$;

REVOKE EXECUTE ON FUNCTION public.attribuer_numero_facture(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.marquer_facture_envoyee(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.attribuer_numero_facture(uuid, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.marquer_facture_envoyee(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Vérification fail-loud (sans donnée résiduelle)
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  c_manu   CONSTANT text := '7ac40334-0d2a-4b1f-822b-133d564abe6c';
  c_dest   CONSTANT jsonb := '{"nom":"Test école","lignes":[]}';
  v_nb0    integer;
  v_cpt0   integer;
  v_id1    uuid;
  v_id2    uuid;
  v_m      uuid;
  v_f      public.factures;
  v_ok     boolean;
  n        integer;
BEGIN
  -- V1. Fonctions : SECURITY DEFINER, pas d'anon ; list_factures expose les colonnes
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prosecdef
    AND p.proname IN ('attribuer_numero_facture', 'marquer_facture_envoyee');
  IF n <> 2 THEN RAISE EXCEPTION 'V1 KO : % RPC SECURITY DEFINER sur 2', n; END IF;
  IF has_function_privilege('anon', 'public.attribuer_numero_facture(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.marquer_facture_envoyee(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'V1 KO : anon peut exécuter';
  END IF;

  SELECT count(*) INTO v_nb0 FROM public.factures;
  SELECT dernier_num INTO v_cpt0 FROM public.compteur_reference WHERE cle = 'global';

  -- Une classe facturable non facturée, au cycle terminé (pour une facture de test)
  SELECT m.id INTO v_m FROM public.missions m
  WHERE m.statut = 'facturable' AND m.montant > 0 AND m.facture_id IS NULL AND m.entite_id IS NOT NULL
    AND m.reference_commande IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat = 'validee')
    AND NOT EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat IN ('prevue', 'realisee'))
  ORDER BY m.reference_commande LIMIT 1;
  IF v_m IS NULL THEN RAISE EXCEPTION 'Jeu de test : aucune classe facturable disponible'; END IF;

  BEGIN
    -- T1. Sans session : refus
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT id INTO v_id1 FROM public.factures ORDER BY created_at LIMIT 1;
    v_ok := false;
    BEGIN
      PERFORM public.attribuer_numero_facture(coalesce(v_id1, gen_random_uuid()), 'TEST-001');
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T1 KO : numérotation sans session'; END IF;

    PERFORM set_config('request.jwt.claim.sub', c_manu, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_manu)::text, true);

    -- Deux factures de test : la plus ancienne existante (ou une neuve) + une neuve
    v_f := public.emettre_facture(ARRAY[v_m], 'Test', NULL, NULL, NULL, c_dest, '{}');
    v_id2 := v_f.id;
    IF v_id1 IS NULL THEN v_id1 := v_id2; v_id2 := NULL; END IF;
    IF v_f.numero_officiel IS NOT NULL OR v_f.envoyee_le IS NOT NULL OR v_f.historique_numero <> '[]'::jsonb THEN
      RAISE EXCEPTION 'T1b KO : facture neuve non « en attente »';
    END IF;

    -- T2. Numéro vide : refus
    v_ok := false;
    BEGIN
      PERFORM public.attribuer_numero_facture(v_id1, '   ');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T2 KO : numéro vide accepté'; END IF;

    -- T3. Attribution nominale
    v_f := public.attribuer_numero_facture(v_id1, '  TEST-001 ');
    IF v_f.numero_officiel <> 'TEST-001' OR v_f.date_officielle <> (now() AT TIME ZONE 'Europe/Paris')::date
       OR jsonb_array_length(v_f.historique_numero) <> 1 THEN
      RAISE EXCEPTION 'T3 KO : %', row_to_json(v_f);
    END IF;

    -- T4. Même numéro sur une autre facture : refus
    IF v_id2 IS NOT NULL THEN
      v_ok := false;
      BEGIN
        PERFORM public.attribuer_numero_facture(v_id2, 'TEST-001');
      EXCEPTION WHEN unique_violation THEN v_ok := true;
      END;
      IF NOT v_ok THEN RAISE EXCEPTION 'T4 KO : doublon accepté'; END IF;

      -- T5. Envoi sans numéro : refus
      v_ok := false;
      BEGIN
        PERFORM public.marquer_facture_envoyee(v_id2);
      EXCEPTION WHEN check_violation THEN v_ok := true;
      END;
      IF NOT v_ok THEN RAISE EXCEPTION 'T5 KO : envoi sans numéro accepté'; END IF;
    END IF;

    -- T6. Correction avant envoi : acceptée et tracée
    v_f := public.attribuer_numero_facture(v_id1, 'TEST-002');
    IF v_f.numero_officiel <> 'TEST-002' OR jsonb_array_length(v_f.historique_numero) <> 2 THEN
      RAISE EXCEPTION 'T6 KO : %', row_to_json(v_f);
    END IF;

    -- T7. Envoi puis correction : refus
    v_f := public.marquer_facture_envoyee(v_id1);
    IF v_f.envoyee_le IS NULL THEN RAISE EXCEPTION 'T7 KO : envoi non tracé'; END IF;
    v_ok := false;
    BEGIN
      PERFORM public.attribuer_numero_facture(v_id1, 'TEST-003');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T7 KO : correction après envoi acceptée'; END IF;

    -- T8. list_factures expose les nouvelles colonnes
    SELECT count(*) INTO n FROM public.list_factures(NULL) WHERE numero_officiel = 'TEST-002' AND envoyee_le IS NOT NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'T8 KO : list_factures (%)', n; END IF;

    RAISE EXCEPTION '__TESTS_OK__';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '__TESTS_OK__' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- V2. Aucune trace des tests
  SELECT count(*) INTO n FROM public.factures;
  IF n <> v_nb0 THEN RAISE EXCEPTION 'V2 KO : % facture(s) au lieu de %', n, v_nb0; END IF;
  SELECT count(*) INTO n FROM public.factures
  WHERE numero_officiel IS NOT NULL OR envoyee_le IS NOT NULL OR historique_numero <> '[]'::jsonb;
  IF n <> 0 THEN RAISE EXCEPTION 'V2 KO : % facture(s) modifiée(s)', n; END IF;
  SELECT count(*) INTO n FROM public.missions WHERE id = v_m AND facture_id IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'V2 KO : classe de test restée facturée'; END IF;
  SELECT dernier_num INTO n FROM public.compteur_reference WHERE cle = 'global';
  IF n <> v_cpt0 THEN RAISE EXCEPTION 'V2 KO : compteur % (attendu %)', n, v_cpt0; END IF;

  RAISE NOTICE 'VERIF OK : V1..V2 + T1..T8 verts, aucune donnée de test conservée (% facture(s) existante(s), toutes en attente de numéro)', v_nb0;
END;
$verif$;

COMMIT;
