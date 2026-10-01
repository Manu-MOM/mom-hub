-- =====================================================================
-- sql_254_historique_indisponibilites
-- FAIT FOI « HISTORIQUE-INDISPONIBILITES » gelé par Manu le 01/10/2026
--   I1 table indisponibilites (calque blessures : motif obligatoire,
--      date_debut obligatoire, date_fin facultative, notes, fin >= début)
--   I2 indisponible = date_debut <= aujourd'hui
--      ET (date_fin vide OU date_fin >= aujourd'hui) ; ordre des états
--      inchangé (suspendu > blessé > indisponible)
--   I3 personnes.indisponibilite conservée mais n'est plus lue : les 5 RPC
--      d'état renvoient le motif de l'indisponibilité active
--   I4 RLS active, 0 policy ; lecture admin | bureau | puis_je_lire_categorie,
--      écriture admin | bureau | puis_je_ecrire_categorie
--   + SUSPENSION-NOTES : colonne personnes.suspension_notes (conditions FFR,
--      texte libre, aucun comptage de matchs), écrite par
--      update_joueur_metier (clé 'suspension_notes'), lue par
--      get_joueur_detail (DROP + CREATE : colonne de sortie ajoutée)
--   + Option A (Manu) : get_joueur_detail n'est plus exécutable par
--      PUBLIC / anon (authenticated + service_role uniquement)
--   Reprise VON BREITENSTEIN Baptiste : indisponible depuis le 10/09/2026,
--      fin non connue (dates fournies par Manu)
-- Mode : COMMIT (identique au DRY-RUN, ROLLBACK final remplacé par COMMIT ;
-- à exécuter uniquement sur feu vert explicite de Manu).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Instantané AVANT (non-régression) — dans un bloc DO : l'éditeur SQL
--    Supabase ajoute sinon un « ALTER TABLE … ENABLE RLS » qui échoue.
-- ---------------------------------------------------------------------
DO $snap$
BEGIN
  CREATE TEMP TABLE _snap_avant ON COMMIT DROP AS
  SELECT 'categorie:' || c.id::text AS src, j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite
  FROM public.categories c, LATERAL public.get_joueurs_categorie(c.id) j
  UNION ALL
  SELECT 'equipe:' || e.id::text, j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite
  FROM public.equipes e, LATERAL public.get_joueurs_equipe(e.id) j
  UNION ALL
  SELECT 'f15', j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite FROM public.get_joueurs_f15() j
  UNION ALL
  SELECT 'section', j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite FROM public.get_joueurs_section() j
  UNION ALL
  SELECT 'detail', d.id, d.etat_calcule, d.blessure_resume, d.indisponibilite
  FROM public.personnes p, LATERAL public.get_joueur_detail(p.id) d;
END;
$snap$;

-- ---------------------------------------------------------------------
-- 1. Colonne suspension_notes
-- ---------------------------------------------------------------------
ALTER TABLE public.personnes ADD COLUMN suspension_notes text;

COMMENT ON COLUMN public.personnes.suspension_notes IS
  'Conditions de la suspension FFR (texte libre, ex. nombre de matchs). Aucun comptage côté Hub (pt 274, sql_254).';

-- ---------------------------------------------------------------------
-- 2. Table indisponibilites (I1, I4)
-- ---------------------------------------------------------------------
CREATE TABLE public.indisponibilites (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  personne_id uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  date_debut  date NOT NULL,
  date_fin    date,
  motif       text NOT NULL,
  notes       text,
  cree_par    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT indisponibilites_dates_check CHECK (date_fin IS NULL OR date_fin >= date_debut),
  CONSTRAINT indisponibilites_motif_check CHECK (length(btrim(motif)) > 0)
);

CREATE INDEX indisponibilites_personne_idx ON public.indisponibilites (personne_id, date_debut DESC);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.indisponibilites
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.indisponibilites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.indisponibilites FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.indisponibilites IS
  'Historique des indisponibilités (hors blessure). Accès uniquement via RPC SECURITY DEFINER (pt 274, sql_254).';

-- ---------------------------------------------------------------------
-- 3. Helper interne : motif de l'indisponibilité active (I2) — non exposé
-- ---------------------------------------------------------------------
CREATE FUNCTION public._indispo_active_motif(p_personne_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT i.motif
  FROM public.indisponibilites i
  WHERE i.personne_id = p_personne_id
    AND i.date_debut <= CURRENT_DATE
    AND (i.date_fin IS NULL OR i.date_fin >= CURRENT_DATE)
  ORDER BY i.date_debut DESC, i.created_at DESC
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public._indispo_active_motif(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC lecture / écriture (I4) — calque exact des RPC blessures
-- ---------------------------------------------------------------------
CREATE FUNCTION public.list_indisponibilites_joueur(p_personne_id uuid)
RETURNS TABLE (
  id uuid, personne_id uuid, date_debut date, date_fin date,
  motif text, notes text, est_active boolean,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
BEGIN
  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  SELECT p.categorie_id INTO v_cat FROM public.personnes p WHERE p.id = p_personne_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT i.id, i.personne_id, i.date_debut, i.date_fin, i.motif, i.notes,
         (i.date_debut <= CURRENT_DATE AND (i.date_fin IS NULL OR i.date_fin >= CURRENT_DATE)),
         i.created_at, i.updated_at
  FROM public.indisponibilites i
  WHERE i.personne_id = p_personne_id
  ORDER BY i.date_debut DESC, i.created_at DESC;
END;
$fn$;

CREATE FUNCTION public.upsert_indisponibilite(
  p_id uuid,
  p_personne_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_motif text,
  p_notes text
)
RETURNS SETOF public.indisponibilites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_personne uuid;
  v_cat uuid;
BEGIN
  IF p_id IS NULL THEN
    v_personne := p_personne_id;
  ELSE
    SELECT i.personne_id INTO v_personne FROM public.indisponibilites i WHERE i.id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Indisponibilité % introuvable', p_id USING ERRCODE = '02000';
    END IF;
    IF p_personne_id IS NOT NULL AND p_personne_id <> v_personne THEN
      RAISE EXCEPTION 'Indisponibilité % rattachée à une autre personne', p_id USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_personne IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  SELECT p.categorie_id INTO v_cat FROM public.personnes p WHERE p.id = v_personne;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personne % introuvable', v_personne USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;

  IF p_date_debut IS NULL THEN
    RAISE EXCEPTION 'Date de début obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_motif IS NULL OR length(btrim(p_motif)) = 0 THEN
    RAISE EXCEPTION 'Motif obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_date_fin IS NOT NULL AND p_date_fin < p_date_debut THEN
    RAISE EXCEPTION 'La date de fin doit être postérieure ou égale à la date de début' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    RETURN QUERY
    INSERT INTO public.indisponibilites (personne_id, date_debut, date_fin, motif, notes, cree_par)
    VALUES (v_personne, p_date_debut, p_date_fin, btrim(p_motif),
            NULLIF(btrim(p_notes), ''), auth.uid())
    RETURNING *;
  ELSE
    RETURN QUERY
    UPDATE public.indisponibilites i
    SET date_debut = p_date_debut,
        date_fin   = p_date_fin,
        motif      = btrim(p_motif),
        notes      = NULLIF(btrim(p_notes), '')
    WHERE i.id = p_id
    RETURNING *;
  END IF;
END;
$fn$;

CREATE FUNCTION public.delete_indisponibilite(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
BEGIN
  SELECT p.categorie_id INTO v_cat
  FROM public.indisponibilites i JOIN public.personnes p ON p.id = i.personne_id
  WHERE i.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indisponibilité % introuvable', p_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.indisponibilites WHERE id = p_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_indisponibilites_joueur(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_indisponibilite(uuid, uuid, date, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_indisponibilite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_indisponibilites_joueur(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_indisponibilite(uuid, uuid, date, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_indisponibilite(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Remplacements textuels contrôlés des définitions déployées
--    (aucune retranscription ; chaque motif compté, fail-loud)
-- ---------------------------------------------------------------------
DO $rpc$
DECLARE
  r record;
  v_def text;
  v_new text;
  -- indisponibilité (5 RPC d'état)
  c_sel CONSTANT text := 'p.indisponibilite, public._blessure_active_libelle(p.id), p.suspension_jusqu_au,';
  n_sel CONSTANT text := 'public._indispo_active_motif(p.id), public._blessure_active_libelle(p.id), p.suspension_jusqu_au,';
  c_cas CONSTANT text := 'WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN ''indisponible''';
  n_cas CONSTANT text := 'WHEN public._indispo_active_motif(p.id) IS NOT NULL THEN ''indisponible''';
  -- get_joueur_detail : colonne de sortie suspension_notes
  c_ret CONSTANT text := 'section_rugby boolean, potentiel_jeu text)';
  n_ret CONSTANT text := 'section_rugby boolean, potentiel_jeu text, suspension_notes text)';
  c_fin CONSTANT text := E'p.potentiel_jeu\n  FROM personnes p';
  n_fin CONSTANT text := E'p.potentiel_jeu,\n    p.suspension_notes\n  FROM personnes p';
  -- update_joueur_metier : clé suspension_notes
  c_ujm CONSTANT text := E'    modifie_par = ''module-joueurs'',';
  n_ujm CONSTANT text := E'    suspension_notes = CASE WHEN p_patch ? ''suspension_notes'' THEN NULLIF(trim(p_patch->>''suspension_notes''), '''') ELSE suspension_notes END,\n    modifie_par = ''module-joueurs'',';
  n int;
BEGIN
  -- 5a. RPC d'état
  FOR r IN
    SELECT p.oid, p.proname,
           CASE p.proname WHEN 'get_joueur_detail' THEN 1 ELSE 2 END AS attendu_sel
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.proname IN ('get_joueur_detail', 'get_joueurs_categorie', 'get_joueurs_equipe',
                        'get_joueurs_f15', 'get_joueurs_section')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    n := (length(v_def) - length(replace(v_def, c_sel, ''))) / length(c_sel);
    IF n <> r.attendu_sel THEN
      RAISE EXCEPTION 'RPC % : motif sélection %/%', r.proname, n, r.attendu_sel;
    END IF;
    n := (length(v_def) - length(replace(v_def, c_cas, ''))) / length(c_cas);
    IF n <> 1 THEN
      RAISE EXCEPTION 'RPC % : motif état %/1', r.proname, n;
    END IF;
    v_new := replace(replace(v_def, c_sel, n_sel), c_cas, n_cas);
    IF position('p.indisponibilite' IN v_new) > 0 THEN
      RAISE EXCEPTION 'RPC % : référence résiduelle à p.indisponibilite', r.proname;
    END IF;

    IF r.proname = 'get_joueur_detail' THEN
      n := (length(v_new) - length(replace(v_new, c_ret, ''))) / length(c_ret);
      IF n <> 1 THEN RAISE EXCEPTION 'get_joueur_detail : motif RETURNS %/1', n; END IF;
      n := (length(v_new) - length(replace(v_new, c_fin, ''))) / length(c_fin);
      IF n <> 1 THEN RAISE EXCEPTION 'get_joueur_detail : motif sélection finale %/1', n; END IF;
      v_new := replace(replace(v_new, c_ret, n_ret), c_fin, n_fin);
      -- type de retour modifié : DROP + CREATE, puis droits (option A)
      DROP FUNCTION public.get_joueur_detail(uuid);
      EXECUTE v_new;
      REVOKE ALL ON FUNCTION public.get_joueur_detail(uuid) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.get_joueur_detail(uuid) TO authenticated, service_role;
    ELSE
      EXECUTE v_new;
    END IF;
  END LOOP;

  -- 5b. update_joueur_metier (signature et droits inchangés)
  v_def := pg_get_functiondef('public.update_joueur_metier(uuid,jsonb)'::regprocedure);
  n := (length(v_def) - length(replace(v_def, c_ujm, ''))) / length(c_ujm);
  IF n <> 1 THEN RAISE EXCEPTION 'update_joueur_metier : motif %/1', n; END IF;
  EXECUTE replace(v_def, c_ujm, n_ujm);
END;
$rpc$;

-- ---------------------------------------------------------------------
-- 6. Reprise VON BREITENSTEIN Baptiste — dates fournies par Manu
-- ---------------------------------------------------------------------
INSERT INTO public.indisponibilites (personne_id, date_debut, date_fin, motif)
SELECT p.id, DATE '2026-09-10', NULL, p.indisponibilite
FROM public.personnes p
WHERE p.id = 'c6a59744-21da-47e4-ae86-7adb59a8038d'
  AND p.indisponibilite = 'Raisons personnelles (préfère jouer en Reg joue avec Colmar)';

-- ---------------------------------------------------------------------
-- 7. Vérifications fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  n int;
  v_etat text;
  v_txt text;
  v_id uuid;
  v_ok boolean;
  c_vb CONSTANT uuid := 'c6a59744-21da-47e4-ae86-7adb59a8038d';
  c_fessard CONSTANT uuid := '95333056-381b-4899-af63-56d03b1c4404';
  c_manu CONSTANT text := '7ac40334-0d2a-4b1f-822b-133d564abe6c';
BEGIN
  -- F1. Table verrouillée
  SELECT count(*) INTO n FROM pg_class WHERE oid = 'public.indisponibilites'::regclass AND relrowsecurity;
  IF n <> 1 THEN RAISE EXCEPTION 'F1 KO : RLS inactive'; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'indisponibilites';
  IF n <> 0 THEN RAISE EXCEPTION 'F1 KO : % policies', n; END IF;
  IF has_table_privilege('anon', 'public.indisponibilites', 'SELECT')
     OR has_table_privilege('authenticated', 'public.indisponibilites', 'SELECT')
     OR has_table_privilege('authenticated', 'public.indisponibilites', 'INSERT') THEN
    RAISE EXCEPTION 'F1 KO : droits directs client';
  END IF;

  -- F2. Droits d'exécution (dont option A sur get_joueur_detail)
  IF has_function_privilege('authenticated', 'public._indispo_active_motif(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._indispo_active_motif(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'F2 KO : helper exposé';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.list_indisponibilites_joueur(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.upsert_indisponibilite(uuid,uuid,date,date,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.delete_indisponibilite(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_joueur_detail(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'F2 KO : RPC non exécutables par authenticated';
  END IF;
  IF has_function_privilege('anon', 'public.list_indisponibilites_joueur(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.upsert_indisponibilite(uuid,uuid,date,date,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.delete_indisponibilite(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_joueur_detail(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'F2 KO : RPC exécutables par anon';
  END IF;
  SELECT count(*) INTO n FROM pg_proc
  WHERE oid = 'public.get_joueur_detail(uuid)'::regprocedure AND prosecdef AND provolatile = 's';
  IF n <> 1 THEN RAISE EXCEPTION 'F2 KO : get_joueur_detail n''est plus STABLE SECURITY DEFINER'; END IF;

  -- F3. Reprise VON BREITENSTEIN
  SELECT count(*) INTO n FROM public.indisponibilites
  WHERE personne_id = c_vb AND date_debut = '2026-09-10' AND date_fin IS NULL
    AND motif = 'Raisons personnelles (préfère jouer en Reg joue avec Colmar)';
  IF n <> 1 THEN RAISE EXCEPTION 'F3 KO : reprise VON BREITENSTEIN (% ligne)', n; END IF;

  -- F4. Non-régression : états, libellés blessure et motifs identiques
  CREATE TEMP TABLE _snap_apres ON COMMIT DROP AS
  SELECT 'categorie:' || c.id::text AS src, j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite
  FROM public.categories c, LATERAL public.get_joueurs_categorie(c.id) j
  UNION ALL
  SELECT 'equipe:' || e.id::text, j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite
  FROM public.equipes e, LATERAL public.get_joueurs_equipe(e.id) j
  UNION ALL
  SELECT 'f15', j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite FROM public.get_joueurs_f15() j
  UNION ALL
  SELECT 'section', j.id, j.etat_calcule, j.blessure_resume, j.indisponibilite FROM public.get_joueurs_section() j
  UNION ALL
  SELECT 'detail', d.id, d.etat_calcule, d.blessure_resume, d.indisponibilite
  FROM public.personnes p, LATERAL public.get_joueur_detail(p.id) d;

  SELECT count(*) INTO n FROM (
    (SELECT * FROM _snap_avant EXCEPT ALL SELECT * FROM _snap_apres)
    UNION ALL
    (SELECT * FROM _snap_apres EXCEPT ALL SELECT * FROM _snap_avant)
  ) d;
  IF n <> 0 THEN RAISE EXCEPTION 'F4 KO : % écarts avant/après', n; END IF;
  SELECT count(*) INTO n FROM _snap_apres;
  IF n = 0 THEN RAISE EXCEPTION 'F4 KO : instantané vide'; END IF;

  SELECT etat_calcule, indisponibilite INTO v_etat, v_txt FROM public.get_joueur_detail(c_vb);
  IF v_etat <> 'indisponible' OR v_txt IS DISTINCT FROM 'Raisons personnelles (préfère jouer en Reg joue avec Colmar)' THEN
    RAISE EXCEPTION 'F4 KO : VON BREITENSTEIN % / %', v_etat, v_txt;
  END IF;

  -- F5. Garde : sans session, lecture refusée
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  v_ok := false;
  BEGIN
    PERFORM * FROM public.list_indisponibilites_joueur(c_vb);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'F5 KO : lecture sans session acceptée'; END IF;

  -- F6 + F7 dans une sous-transaction annulée en fin de bloc (aucune trace,
  -- y compris modifie_par / updated_at de la fiche de test)
  PERFORM set_config('request.jwt.claim.sub', c_manu, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_manu)::text, true);
  BEGIN
    -- F6. Cycle indisponibilité
    SELECT count(*) INTO n FROM public.list_indisponibilites_joueur(c_vb) WHERE est_active;
    IF n <> 1 THEN RAISE EXCEPTION 'F6 KO : lecture (% active)', n; END IF;

    SELECT id INTO v_id FROM public.upsert_indisponibilite(NULL, c_fessard, CURRENT_DATE + 10, CURRENT_DATE + 15,
                                                           '  test vacances ', '');
    SELECT count(*) INTO n FROM public.indisponibilites
    WHERE id = v_id AND motif = 'test vacances' AND notes IS NULL AND cree_par = c_manu::uuid;
    IF n <> 1 THEN RAISE EXCEPTION 'F6 KO : insertion'; END IF;
    SELECT indisponibilite INTO v_txt FROM public.get_joueur_detail(c_fessard);
    IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'F6 KO : indispo future active (%)', v_txt; END IF;

    PERFORM public.upsert_indisponibilite(v_id, NULL, CURRENT_DATE, CURRENT_DATE + 2, 'test active', 'n');
    SELECT indisponibilite INTO v_txt FROM public.get_joueur_detail(c_fessard);
    IF v_txt IS DISTINCT FROM 'test active' THEN RAISE EXCEPTION 'F6 KO : modification (%)', v_txt; END IF;

    v_ok := false;
    BEGIN
      PERFORM public.upsert_indisponibilite(v_id, NULL, CURRENT_DATE, CURRENT_DATE - 1, 'x', NULL);
    EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'F6 KO : fin < début acceptée'; END IF;

    PERFORM public.delete_indisponibilite(v_id);
    SELECT count(*) INTO n FROM public.indisponibilites WHERE id = v_id;
    IF n <> 0 THEN RAISE EXCEPTION 'F6 KO : suppression'; END IF;

    -- F7. Notes de suspension : écriture via update_joueur_metier, lecture via get_joueur_detail
    PERFORM public.update_joueur_metier(c_fessard, jsonb_build_object('suspension_notes', '  2 matchs fermes '));
    SELECT suspension_notes INTO v_txt FROM public.get_joueur_detail(c_fessard);
    IF v_txt IS DISTINCT FROM '2 matchs fermes' THEN RAISE EXCEPTION 'F7 KO : écriture (%)', v_txt; END IF;
    PERFORM public.update_joueur_metier(c_fessard, jsonb_build_object('indisponibilite', 'x'));
    SELECT suspension_notes INTO v_txt FROM public.get_joueur_detail(c_fessard);
    IF v_txt IS DISTINCT FROM '2 matchs fermes' THEN RAISE EXCEPTION 'F7 KO : clé absente a écrasé (%)', v_txt; END IF;
    PERFORM public.update_joueur_metier(c_fessard, jsonb_build_object('suspension_notes', ''));
    SELECT suspension_notes INTO v_txt FROM public.get_joueur_detail(c_fessard);
    IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'F7 KO : remise à vide (%)', v_txt; END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'annulation volontaire des tests F6/F7';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN
    NULL; -- sous-transaction annulée : aucune trace des tests
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- F8. Aucune trace des tests
  SELECT count(*) INTO n FROM public.indisponibilites;
  IF n <> 1 THEN RAISE EXCEPTION 'F8 KO : % lignes (attendu 1)', n; END IF;
  SELECT count(*) INTO n FROM public.personnes
  WHERE id = c_fessard AND (suspension_notes IS NOT NULL OR indisponibilite IS NOT NULL);
  IF n <> 0 THEN RAISE EXCEPTION 'F8 KO : fiche de test modifiée'; END IF;

  RAISE NOTICE 'VERIF OK : F1..F8 verts';
END;
$verif$;

COMMIT;
