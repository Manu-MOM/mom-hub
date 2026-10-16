-- =====================================================================
-- sql_257_factures_ecoles
-- ---------------------------------------------------------------------
-- Chantier : FACTURE-ECOLES
-- FAIT FOI gelé par Manu le 16/10/2026 (« je gèle »), modèle = facture
-- Excel MOM-FAC-2026-005 (École des Fontaines, Bischoffsheim) :
--   F1 numérotation : facture d'UNE classe -> la référence déjà générée de
--      la classe (missions.reference_commande) ; facture de PLUSIEURS
--      classes -> numéro suivant du compteur du Hub
--      (generer_reference_commande, ex. 2026-2027-017). Suite partagée
--      avec les références de classes -> trous possibles (à valider avec
--      la trésorière ; compteur dédié possible plus tard sans impact écran).
--   F2 contenu : quantité = nb de classes, P.U. = montant par classe (une
--      ligne par P.U. distinct), désignation saisie à l'émission,
--      échéance / Vos Réf. / mode de règlement saisis à l'émission.
--   F3 mémoire : table factures, FIGÉE à l'émission (destinataire, émetteur
--      public, lignes, total) ; missions.facture_id rattache chaque classe.
--      Une classe facturée ne peut plus l'être une 2e fois. Avoirs hors v1.
--   F4 coordonnées bancaires hors du dépôt public : table emetteur_prive
--      (ligne unique), lisible admin|bureau via get_emetteur_bancaire().
--      Les VALEURS ne sont PAS dans ce fichier (dépôt public) : voir le
--      fragment sql_257b à exécuter à part, jamais committé.
--   F7 émission refusée si une classe : n'est pas « facturable », n'a pas
--      de montant, est déjà facturée, a encore des séances prevue|realisee,
--      n'a aucune séance validée ; ou si les classes sont de plusieurs écoles.
--
-- Accès : RLS active, 0 policy, aucun droit direct client sur les deux
-- tables ; tout passe par des RPC SECURITY DEFINER gardées _gs_peut_ecrire()
-- (admin|bureau). Grants des RPC : authenticated seul (ni PUBLIC ni anon).
-- Refus métier : ERRCODE check_violation (lisible côté front).
--
-- Vérification : les tests d'émission tournent dans un sous-bloc annulé
-- par une exception sentinelle -> AUCUNE donnée de test ne survit, y compris
-- en version COMMIT (leçon sql_256). Contrôle final : 0 facture, compteur
-- inchangé, aucune classe rattachée.
--
-- MODE : COMMIT — identique au DRY-RUN, ROLLBACK final remplacé par COMMIT.
-- La vérification ne laisse aucune donnée de test (sous-bloc annulé).
-- À exécuter uniquement sur feu vert explicite de Manu, après DRY-RUN vert.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
CREATE TABLE public.factures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         text NOT NULL UNIQUE,
  date_emission  date NOT NULL,
  entite_id      uuid NOT NULL REFERENCES public.entites(id),
  saison_id      uuid REFERENCES public.saisons(id),
  destinataire   jsonb NOT NULL,
  emetteur       jsonb NOT NULL,
  lignes         jsonb NOT NULL,
  total          numeric(10,2) NOT NULL,
  vos_ref        text,
  echeance       text,
  mode_reglement text,
  cree_par       uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT factures_numero_check CHECK (length(btrim(numero)) > 0),
  CONSTRAINT factures_total_check CHECK (total > 0)
);

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.factures FROM anon, authenticated;

ALTER TABLE public.missions
  ADD COLUMN facture_id uuid REFERENCES public.factures(id) ON DELETE RESTRICT;
CREATE INDEX missions_facture_id_idx ON public.missions(facture_id);

CREATE TABLE public.emetteur_prive (
  id         smallint PRIMARY KEY DEFAULT 1,
  iban       text,
  bic        text,
  rib        text,
  banque     text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emetteur_prive_singleton CHECK (id = 1)
);

ALTER TABLE public.emetteur_prive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.emetteur_prive FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. emettre_facture
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.emettre_facture(uuid[], text, text, text, text, jsonb, jsonb);

CREATE FUNCTION public.emettre_facture(
  p_mission_ids    uuid[],
  p_designation    text,
  p_vos_ref        text,
  p_echeance       text,
  p_mode_reglement text,
  p_destinataire   jsonb,
  p_emetteur       jsonb
)
RETURNS public.factures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n        integer;
  v_found    integer;
  v_nb_ent   integer;
  v_entite   uuid;
  v_saison   uuid;
  v_bad      text;
  v_numero   text;
  v_lignes   jsonb;
  v_total    numeric;
  v_me       uuid;
  v_row      public.factures;
  v_jour     date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF NOT public._gs_peut_ecrire() THEN
    RAISE EXCEPTION 'Émission réservée à l''administration (admin ou bureau).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_mission_ids IS NULL OR cardinality(p_mission_ids) = 0 THEN
    RAISE EXCEPTION 'Aucune classe sélectionnée.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(DISTINCT x) INTO v_n FROM unnest(p_mission_ids) AS x;
  IF v_n <> cardinality(p_mission_ids) THEN
    RAISE EXCEPTION 'Classe sélectionnée en double.' USING ERRCODE = 'check_violation';
  END IF;

  -- Verrou des classes du lot (aucune émission concurrente sur les mêmes).
  PERFORM 1 FROM public.missions WHERE id = ANY (p_mission_ids) FOR UPDATE;

  SELECT count(*), count(DISTINCT entite_id), (array_agg(entite_id))[1], (array_agg(saison_id))[1]
    INTO v_found, v_nb_ent, v_entite, v_saison
  FROM public.missions WHERE id = ANY (p_mission_ids);

  IF v_found <> v_n THEN
    RAISE EXCEPTION 'Classe introuvable (% sur %).', v_found, v_n USING ERRCODE = 'check_violation';
  END IF;
  IF v_nb_ent <> 1 OR EXISTS (SELECT 1 FROM public.missions WHERE id = ANY (p_mission_ids) AND entite_id IS NULL) THEN
    RAISE EXCEPTION 'Une facture ne concerne qu''une seule école.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(libelle, ', ') INTO v_bad FROM public.missions
  WHERE id = ANY (p_mission_ids) AND statut IS DISTINCT FROM 'facturable';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Classe(s) non facturable(s) : %', v_bad USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(libelle, ', ') INTO v_bad FROM public.missions
  WHERE id = ANY (p_mission_ids) AND (montant IS NULL OR montant <= 0);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Classe(s) sans montant : %', v_bad USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(libelle, ', ') INTO v_bad FROM public.missions
  WHERE id = ANY (p_mission_ids) AND facture_id IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Classe(s) déjà facturée(s) : %', v_bad USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(m.libelle, ', ') INTO v_bad FROM public.missions m
  WHERE m.id = ANY (p_mission_ids)
    AND EXISTS (SELECT 1 FROM public.mission_seances s
                WHERE s.mission_id = m.id AND s.etat IN ('prevue', 'realisee'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cycle non terminé (séances à valider ou à venir) : %', v_bad USING ERRCODE = 'check_violation';
  END IF;

  SELECT string_agg(m.libelle, ', ') INTO v_bad FROM public.missions m
  WHERE m.id = ANY (p_mission_ids)
    AND NOT EXISTS (SELECT 1 FROM public.mission_seances s
                    WHERE s.mission_id = m.id AND s.etat = 'validee');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Aucune séance validée : %', v_bad USING ERRCODE = 'check_violation';
  END IF;

  IF p_designation IS NULL OR length(btrim(p_designation)) = 0 THEN
    RAISE EXCEPTION 'Désignation obligatoire.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_destinataire IS NULL OR length(btrim(coalesce(p_destinataire ->> 'nom', ''))) = 0 THEN
    RAISE EXCEPTION 'Destinataire sans nom.' USING ERRCODE = 'check_violation';
  END IF;

  -- F1 : numéro.
  IF v_n = 1 THEN
    SELECT nullif(btrim(reference_commande), '') INTO v_numero
    FROM public.missions WHERE id = p_mission_ids[1];
    IF v_numero IS NULL THEN
      v_numero := public.generer_reference_commande();
      UPDATE public.missions SET reference_commande = v_numero WHERE id = p_mission_ids[1];
    END IF;
  ELSE
    v_numero := public.generer_reference_commande();
  END IF;

  IF EXISTS (SELECT 1 FROM public.factures WHERE numero = v_numero) THEN
    RAISE EXCEPTION 'Numéro de facture % déjà utilisé.', v_numero USING ERRCODE = 'unique_violation';
  END IF;

  -- F2 : lignes figées, une par prix unitaire.
  SELECT jsonb_agg(jsonb_build_object(
           'designation',   btrim(p_designation),
           'references',    g.refs,
           'quantite',      g.q,
           'prix_unitaire', g.pu,
           'montant',       g.q * g.pu) ORDER BY g.pu DESC),
         sum(g.q * g.pu)
    INTO v_lignes, v_total
  FROM (
    SELECT m.montant AS pu,
           count(*) AS q,
           coalesce(jsonb_agg(m.reference_commande ORDER BY m.reference_commande)
                      FILTER (WHERE m.reference_commande IS NOT NULL), '[]'::jsonb) AS refs
    FROM public.missions m
    WHERE m.id = ANY (p_mission_ids)
    GROUP BY m.montant
  ) g;

  v_me := (SELECT q.personne_id FROM public.qui_suis_je() q);

  INSERT INTO public.factures
    (numero, date_emission, entite_id, saison_id, destinataire, emetteur, lignes, total,
     vos_ref, echeance, mode_reglement, cree_par)
  VALUES
    (v_numero, v_jour, v_entite, v_saison, p_destinataire, coalesce(p_emetteur, '{}'::jsonb),
     v_lignes, v_total,
     nullif(btrim(p_vos_ref), ''), nullif(btrim(p_echeance), ''), nullif(btrim(p_mode_reglement), ''),
     v_me)
  RETURNING * INTO v_row;

  UPDATE public.missions SET facture_id = v_row.id WHERE id = ANY (p_mission_ids);

  RETURN v_row;
END $$;

-- ---------------------------------------------------------------------
-- 3. Lectures
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_factures(uuid);

CREATE FUNCTION public.list_factures(p_saison_id uuid DEFAULT NULL)
RETURNS SETOF public.factures
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public._gs_peut_ecrire() THEN
    RAISE EXCEPTION 'Lecture réservée à l''administration (admin ou bureau).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT * FROM public.factures f
    WHERE p_saison_id IS NULL OR f.saison_id = p_saison_id
    ORDER BY f.date_emission DESC, f.numero DESC;
END $$;

DROP FUNCTION IF EXISTS public.get_emetteur_bancaire();

CREATE FUNCTION public.get_emetteur_bancaire()
RETURNS TABLE (out_iban text, out_bic text, out_rib text, out_banque text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public._gs_peut_ecrire() THEN
    RAISE EXCEPTION 'Lecture réservée à l''administration (admin ou bureau).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT e.iban, e.bic, e.rib, e.banque FROM public.emetteur_prive e WHERE e.id = 1;
END $$;

REVOKE EXECUTE ON FUNCTION public.emettre_facture(uuid[], text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_factures(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_emetteur_bancaire() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.emettre_facture(uuid[], text, text, text, text, jsonb, jsonb) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.list_factures(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_emetteur_bancaire() TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Vérification fail-loud (sans donnée résiduelle)
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  c_manu     CONSTANT text := '7ac40334-0d2a-4b1f-822b-133d564abe6c';
  c_tilleuls CONSTANT text := 'École élémentaire Les Tilleuls — Molsheim';
  v_cpt0     integer;
  v_cpt      integer;
  v_saison   text;
  v_t        uuid[];
  v_urmatt   uuid;
  v_bergb    uuid;
  v_griesh   uuid;
  v_ref3     text;
  v_f        public.factures;
  v_ok       boolean;
  n          integer;
  c_dest     CONSTANT jsonb := '{"nom":"Test école","lignes":["1 rue Test","67000 TEST"]}';
BEGIN
  -- V1. Tables verrouillées : RLS active, 0 policy, aucun droit client
  SELECT count(*) INTO n FROM pg_class
  WHERE oid IN ('public.factures'::regclass, 'public.emetteur_prive'::regclass) AND relrowsecurity;
  IF n <> 2 THEN RAISE EXCEPTION 'V1 KO : RLS inactive (% sur 2)', n; END IF;
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('factures', 'emetteur_prive');
  IF n <> 0 THEN RAISE EXCEPTION 'V1 KO : % policies', n; END IF;
  IF has_table_privilege('anon', 'public.factures', 'SELECT')
     OR has_table_privilege('authenticated', 'public.factures', 'SELECT')
     OR has_table_privilege('anon', 'public.emetteur_prive', 'SELECT')
     OR has_table_privilege('authenticated', 'public.emetteur_prive', 'SELECT') THEN
    RAISE EXCEPTION 'V1 KO : lecture directe client possible';
  END IF;

  -- V2. RPC : SECURITY DEFINER, pas d'anon
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prosecdef
    AND p.proname IN ('emettre_facture', 'list_factures', 'get_emetteur_bancaire');
  IF n <> 3 THEN RAISE EXCEPTION 'V2 KO : % RPC SECURITY DEFINER sur 3', n; END IF;
  IF has_function_privilege('anon', 'public.emettre_facture(uuid[], text, text, text, text, jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.list_factures(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_emetteur_bancaire()', 'EXECUTE') THEN
    RAISE EXCEPTION 'V2 KO : anon peut exécuter';
  END IF;

  -- Jeu de test (lecture seule)
  SELECT dernier_num INTO v_cpt0 FROM public.compteur_reference WHERE cle = 'global';
  SELECT replace(code, '/', '-') INTO v_saison FROM public.saisons WHERE est_active LIMIT 1;

  SELECT array_agg(m.id ORDER BY m.reference_commande) INTO v_t
  FROM public.missions m JOIN public.entites e ON e.id = m.entite_id
  WHERE e.libelle = c_tilleuls AND m.statut = 'facturable' AND m.montant > 0
    AND m.facture_id IS NULL AND m.reference_commande IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.mission_seances s WHERE s.mission_id = m.id AND s.etat IN ('prevue', 'realisee'));
  IF coalesce(cardinality(v_t), 0) < 3 THEN RAISE EXCEPTION 'Jeu de test : < 3 classes Tilleuls facturables'; END IF;
  SELECT reference_commande INTO v_ref3 FROM public.missions WHERE id = v_t[3];

  SELECT m.id INTO v_urmatt FROM public.missions m JOIN public.entites e ON e.id = m.entite_id
  WHERE e.libelle = 'Ecole URMATT' AND m.montant > 0 LIMIT 1;
  SELECT m.id INTO v_bergb FROM public.missions m JOIN public.entites e ON e.id = m.entite_id
  WHERE e.libelle LIKE 'École (RPI du Kehlbach)%' LIMIT 1;
  SELECT id INTO v_griesh FROM public.missions WHERE libelle = 'Ecole GRIESHEIM - classe A';
  IF v_urmatt IS NULL OR v_bergb IS NULL OR v_griesh IS NULL THEN
    RAISE EXCEPTION 'Jeu de test incomplet (Urmatt / Bergbieten / Griesheim A)';
  END IF;

  -- Tests d'émission : sous-bloc ANNULÉ par la sentinelle __TESTS_OK__
  BEGIN
    -- T1. Sans session : refus
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    v_ok := false;
    BEGIN
      PERFORM public.emettre_facture(v_t[1:2], 'x', NULL, NULL, NULL, c_dest, '{}');
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T1 KO : émission sans session'; END IF;

    PERFORM set_config('request.jwt.claim.sub', c_manu, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_manu)::text, true);

    -- T2. Deux écoles : refus
    v_ok := false;
    BEGIN
      PERFORM public.emettre_facture(ARRAY[v_t[1], v_urmatt], 'x', NULL, NULL, NULL, c_dest, '{}');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T2 KO : deux écoles acceptées'; END IF;

    -- T3. Classe sans montant : refus
    v_ok := false;
    BEGIN
      PERFORM public.emettre_facture(ARRAY[v_bergb], 'x', NULL, NULL, NULL, c_dest, '{}');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T3 KO : classe sans montant acceptée'; END IF;

    -- T4. Cycle non terminé : refus
    v_ok := false;
    BEGIN
      PERFORM public.emettre_facture(ARRAY[v_griesh], 'x', NULL, NULL, NULL, c_dest, '{}');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T4 KO : cycle non terminé accepté'; END IF;

    -- T5. Nominal, 2 classes : numéro du compteur, 2 x 120
    v_f := public.emettre_facture(v_t[1:2], 'Interventions rugby test', 'BC-1', 'À réception',
                                  'Chèque ou Virement', c_dest, '{"nom":"MOM"}');
    IF v_f.numero <> v_saison || '-' || to_char(v_cpt0 + 1, 'FM000') THEN
      RAISE EXCEPTION 'T5 KO : numéro % (attendu %)', v_f.numero, v_saison || '-' || to_char(v_cpt0 + 1, 'FM000');
    END IF;
    IF v_f.total <> (SELECT sum(montant) FROM public.missions WHERE id = ANY (v_t[1:2])) THEN
      RAISE EXCEPTION 'T5 KO : total %', v_f.total;
    END IF;
    IF (v_f.lignes -> 0 ->> 'quantite')::int <> 2 OR jsonb_array_length(v_f.lignes -> 0 -> 'references') <> 2 THEN
      RAISE EXCEPTION 'T5 KO : lignes %', v_f.lignes;
    END IF;
    IF v_f.date_emission <> (now() AT TIME ZONE 'Europe/Paris')::date OR v_f.vos_ref <> 'BC-1' THEN
      RAISE EXCEPTION 'T5 KO : date ou Vos Réf.';
    END IF;
    SELECT count(*) INTO n FROM public.missions WHERE facture_id = v_f.id;
    IF n <> 2 THEN RAISE EXCEPTION 'T5 KO : % classe(s) rattachée(s)', n; END IF;

    -- T6. Re-facturer une classe déjà facturée : refus
    v_ok := false;
    BEGIN
      PERFORM public.emettre_facture(ARRAY[v_t[1]], 'x', NULL, NULL, NULL, c_dest, '{}');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'T6 KO : double facturation acceptée'; END IF;

    -- T7. Une seule classe : numéro = sa référence, compteur intact
    v_f := public.emettre_facture(ARRAY[v_t[3]], 'Interventions rugby test', NULL, NULL, NULL, c_dest, '{}');
    IF v_f.numero <> v_ref3 THEN RAISE EXCEPTION 'T7 KO : numéro % (attendu %)', v_f.numero, v_ref3; END IF;
    SELECT dernier_num INTO v_cpt FROM public.compteur_reference WHERE cle = 'global';
    IF v_cpt <> v_cpt0 + 1 THEN RAISE EXCEPTION 'T7 KO : compteur % (attendu %)', v_cpt, v_cpt0 + 1; END IF;

    -- T8. Lectures
    SELECT count(*) INTO n FROM public.list_factures(NULL);
    IF n <> 2 THEN RAISE EXCEPTION 'T8 KO : list_factures = %', n; END IF;
    PERFORM * FROM public.get_emetteur_bancaire();

    RAISE EXCEPTION '__TESTS_OK__';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '__TESTS_OK__' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- V3. Aucune trace des tests
  SELECT count(*) INTO n FROM public.factures;
  IF n <> 0 THEN RAISE EXCEPTION 'V3 KO : % facture(s) résiduelle(s)', n; END IF;
  SELECT count(*) INTO n FROM public.missions WHERE facture_id IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'V3 KO : % classe(s) rattachée(s)', n; END IF;
  SELECT dernier_num INTO v_cpt FROM public.compteur_reference WHERE cle = 'global';
  IF v_cpt <> v_cpt0 THEN RAISE EXCEPTION 'V3 KO : compteur % (attendu %)', v_cpt, v_cpt0; END IF;

  RAISE NOTICE 'VERIF OK : V1..V3 + T1..T8 verts, aucune donnée de test conservée (compteur = %)', v_cpt0;
END;
$verif$;

COMMIT;
