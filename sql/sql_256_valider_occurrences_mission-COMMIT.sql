-- =====================================================================
-- sql_256_valider_occurrences_mission
-- ---------------------------------------------------------------------
-- Chantier : VALIDATION-SEANCES-PAR-MISSION
-- FAIT FOI gelé par Manu le 16/10/2026 (« je suis tes recommandations ») :
--   D1 le lot inclut les séances PASSÉES encore « prevue » (jamais
--      déclarées) en plus des « realisee » : déclarer + valider en un geste.
--   D2 séance jamais déclarée -> heures_reelles reste vide ; le compteur
--      compte la durée prévue (repli duree_min/60 déjà porté par
--      sync_releve_depuis_occurrence, inchangé).
--   D3 geste disponible sur TOUTES les missions (pas seulement le scolaire).
--
-- Constat terrain (15/10/2026) : 13 classes x 5 séances validées une par
-- une, deux gestes par séance (Déclarer puis Valider) ~ 130 clics.
--
-- Patron : réplique valider_occurrence (sql_120) pour la garde et le
-- branchement compteur, et valider_reservations_lot (sql_245) pour
-- l'atomicité tout-ou-rien. Nom NOUVEAU (pas d'overload).
--
-- Périmètre du lot : séances de la mission avec
--   etat IN ('prevue','realisee') ET date_seance <= aujourd'hui (Europe/Paris,
--   même règle que la garde de date de declarer_occurrence, sql_243).
-- Jamais touchées : futures, annulées, déjà validées.
--
-- Décisions déléguées (tracées) :
--   - p_nb_attendu : nombre de séances affiché à l'écran au moment du clic.
--     S'il ne correspond plus au périmètre réel (écran périmé, autre
--     utilisateur), le lot est refusé : on ne valide jamais autre chose que
--     ce que l'admin a vu.
--   - lot vide -> exception (fail-loud), le front masque déjà le bouton.
--   - retour : nombre de séances validées + dont jamais déclarées.
--
-- Atomicité : une seule transaction. Si le compteur échoue sur UNE séance
-- (ex. contrat actif absent/ambigu), tout le lot est annulé.
-- Grants : alignés sur valider_occurrence (authenticated ; ni PUBLIC ni anon).
--
-- MODE : COMMIT — identique au DRY-RUN, ROLLBACK final remplacé par COMMIT.
-- À exécuter uniquement sur feu vert explicite de Manu, après DRY-RUN vert.
-- =====================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.valider_occurrences_mission(uuid, integer);

CREATE FUNCTION public.valider_occurrences_mission(
  p_mission_id uuid,
  p_nb_attendu integer
)
RETURNS TABLE (out_nb_validees integer, out_nb_non_declarees integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids      uuid[];
  v_nb_prev  integer;
  v_nb       integer;
  v_count    integer;
  v_jour     date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_id       uuid;
BEGIN
  -- Garde rôle : identique à valider_occurrence.
  IF NOT public._gs_peut_ecrire() THEN
    RAISE EXCEPTION 'Validation réservée à l''administration (admin ou bureau).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.missions WHERE id = p_mission_id) THEN
    RAISE EXCEPTION 'Mission introuvable : %', p_mission_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Périmètre du lot, verrouillé (pas de modification concurrente).
  SELECT array_agg(s.id ORDER BY s.date_seance),
         count(*) FILTER (WHERE s.etat = 'prevue')
    INTO v_ids, v_nb_prev
  FROM (
    SELECT ms.id, ms.date_seance, ms.etat
    FROM public.mission_seances ms
    WHERE ms.mission_id = p_mission_id
      AND ms.etat IN ('prevue', 'realisee')
      AND ms.date_seance <= v_jour
    FOR UPDATE
  ) s;

  v_nb := coalesce(array_length(v_ids, 1), 0);

  IF v_nb = 0 THEN
    RAISE EXCEPTION 'Aucune séance passée à valider sur cette mission.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF p_nb_attendu IS DISTINCT FROM v_nb THEN
    RAISE EXCEPTION 'Lot incohérent : % séance(s) à valider, % attendue(s) à l''écran. Rechargez la page.',
      v_nb, p_nb_attendu
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.mission_seances
     SET etat = 'validee'
   WHERE id = ANY (v_ids)
     AND etat IN ('prevue', 'realisee');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> v_nb THEN
    RAISE EXCEPTION 'Lot incohérent : % lignes touchées sur % (rollback total)', v_count, v_nb;
  END IF;

  -- Alimente le compteur, séance par séance (même fonction que l'unitaire).
  FOREACH v_id IN ARRAY v_ids LOOP
    PERFORM public.sync_releve_depuis_occurrence(v_id);
  END LOOP;

  out_nb_validees      := v_nb;
  out_nb_non_declarees := v_nb_prev;
  RETURN NEXT;
END $$;

REVOKE EXECUTE ON FUNCTION public.valider_occurrences_mission(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.valider_occurrences_mission(uuid, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.valider_occurrences_mission(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- Vérification fail-loud
-- Cas test : mission « Entraînement section 6èmes et 5èmes » (Lohann),
-- qui porte à la fois des séances passées prevue + realisee, des futures
-- et des annulées. Tout est annulé par le ROLLBACK final.
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  c_manu    CONSTANT text := '7ac40334-0d2a-4b1f-822b-133d564abe6c';
  v_jour    date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_mission uuid;
  v_ids     uuid[];
  v_nb      int;
  v_nb_prev int;
  v_fut     int;
  v_ann     int;
  n         int;
  r         record;
  v_ok      boolean;
BEGIN
  -- V1. Fonction présente, SECURITY DEFINER, sans droit anon
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'valider_occurrences_mission' AND p.prosecdef;
  IF n <> 1 THEN RAISE EXCEPTION 'V1 KO : % fonction(s) SECURITY DEFINER', n; END IF;
  IF has_function_privilege('anon', 'public.valider_occurrences_mission(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'V1 KO : anon peut exécuter';
  END IF;

  -- Mission de test
  SELECT count(*) INTO n FROM public.missions WHERE libelle = 'Entraînement section 6èmes et 5èmes';
  IF n <> 1 THEN RAISE EXCEPTION 'Mission test : % trouvée(s), attendu 1', n; END IF;
  SELECT id INTO v_mission FROM public.missions WHERE libelle = 'Entraînement section 6èmes et 5èmes';

  SELECT array_agg(id), count(*) FILTER (WHERE etat = 'prevue')
    INTO v_ids, v_nb_prev
  FROM public.mission_seances
  WHERE mission_id = v_mission AND etat IN ('prevue', 'realisee') AND date_seance <= v_jour;
  v_nb := coalesce(array_length(v_ids, 1), 0);
  IF v_nb = 0 THEN RAISE EXCEPTION 'Mission test sans séance passée à valider'; END IF;

  SELECT count(*) INTO v_fut FROM public.mission_seances
  WHERE mission_id = v_mission AND etat = 'prevue' AND date_seance > v_jour;
  SELECT count(*) INTO v_ann FROM public.mission_seances
  WHERE mission_id = v_mission AND etat = 'annulee';

  -- V2. Sans session : refus
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  v_ok := false;
  BEGIN
    PERFORM * FROM public.valider_occurrences_mission(v_mission, v_nb);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'V2 KO : lot accepté sans session'; END IF;

  -- Session admin de Manu
  PERFORM set_config('request.jwt.claim.sub', c_manu, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_manu)::text, true);

  -- V3. Nombre attendu faux : refus, rien ne bouge
  v_ok := false;
  BEGIN
    PERFORM * FROM public.valider_occurrences_mission(v_mission, v_nb + 1);
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'V3 KO : nombre attendu faux accepté'; END IF;
  SELECT count(*) INTO n FROM public.mission_seances WHERE id = ANY (v_ids) AND etat = 'validee';
  IF n <> 0 THEN RAISE EXCEPTION 'V3 KO : % séance(s) validée(s) malgré le refus', n; END IF;

  -- V4. Lot nominal
  SELECT * INTO r FROM public.valider_occurrences_mission(v_mission, v_nb);
  IF r.out_nb_validees <> v_nb OR r.out_nb_non_declarees <> v_nb_prev THEN
    RAISE EXCEPTION 'V4 KO : retour %/% attendu %/%', r.out_nb_validees, r.out_nb_non_declarees, v_nb, v_nb_prev;
  END IF;
  SELECT count(*) INTO n FROM public.mission_seances WHERE id = ANY (v_ids) AND etat = 'validee';
  IF n <> v_nb THEN RAISE EXCEPTION 'V4 KO : % validée(s) sur %', n, v_nb; END IF;
  SELECT count(*) INTO n FROM public.releve_heures_salarie WHERE mission_seance_id = ANY (v_ids);
  IF n <> v_nb THEN RAISE EXCEPTION 'V4 KO : % ligne(s) compteur sur %', n, v_nb; END IF;
  SELECT count(*) INTO n FROM public.releve_heures_salarie WHERE mission_seance_id = ANY (v_ids) AND heures IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'V4 KO : % ligne(s) compteur sans heures', n; END IF;

  -- V5. Futures et annulées intactes
  SELECT count(*) INTO n FROM public.mission_seances
  WHERE mission_id = v_mission AND etat = 'prevue' AND date_seance > v_jour;
  IF n <> v_fut THEN RAISE EXCEPTION 'V5 KO : futures % -> %', v_fut, n; END IF;
  SELECT count(*) INTO n FROM public.mission_seances WHERE mission_id = v_mission AND etat = 'annulee';
  IF n <> v_ann THEN RAISE EXCEPTION 'V5 KO : annulées % -> %', v_ann, n; END IF;

  -- V6. Second appel : plus rien à valider -> refus
  v_ok := false;
  BEGIN
    PERFORM * FROM public.valider_occurrences_mission(v_mission, 0);
  EXCEPTION WHEN no_data_found THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'V6 KO : lot vide accepté'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  RAISE NOTICE 'VERIF OK : V1..V6 verts (% séance(s) dont % jamais déclarée(s), % future(s) et % annulée(s) intactes)',
    v_nb, v_nb_prev, v_fut, v_ann;
END;
$verif$;

COMMIT;
