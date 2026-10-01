-- =====================================================================
-- sql_253_historique_blessures
-- FAIT FOI « HISTORIQUE-BLESSURES » gelé par Manu le 01/10/2026 (D1–D9)
--   D1 table blessures (date_debut obligatoire, date_fin facultative,
--      libelle obligatoire, notes facultatives, fin >= début)
--   D2 blessé = blessure avec date_debut <= aujourd'hui
--      ET (date_fin vide OU date_fin >= aujourd'hui)
--   D3 chevauchements autorisés
--   D4 personnes.blessure_resume conservée mais n'est plus lue :
--      les 5 RPC d'état renvoient le libellé de la blessure active
--      (signatures inchangées -> CREATE OR REPLACE, ACL conservées)
--   D5 reprise FESSARD Léopold : « entorse genou » du 23/09 au 04/10/2026
--   D6 RLS active, 0 policy, aucun droit direct client (donnée de santé)
--   D7 lecture  : admin | bureau | puis_je_lire_categorie(cat du joueur)
--      écriture : admin | bureau | puis_je_ecrire_categorie(cat du joueur)
-- Mode : DRY-RUN (dernière ligne ROLLBACK). Version COMMIT = même fichier,
-- ROLLBACK final remplacé par COMMIT, sur feu vert explicite.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Instantané AVANT des états calculés (contrôle de non-régression)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _snap_avant ON COMMIT DROP AS
SELECT 'categorie:' || c.id::text AS src, j.id, j.etat_calcule, j.blessure_resume
FROM public.categories c, LATERAL public.get_joueurs_categorie(c.id) j
UNION ALL
SELECT 'equipe:' || e.id::text, j.id, j.etat_calcule, j.blessure_resume
FROM public.equipes e, LATERAL public.get_joueurs_equipe(e.id) j
UNION ALL
SELECT 'f15', j.id, j.etat_calcule, j.blessure_resume FROM public.get_joueurs_f15() j
UNION ALL
SELECT 'section', j.id, j.etat_calcule, j.blessure_resume FROM public.get_joueurs_section() j
UNION ALL
SELECT 'detail', d.id, d.etat_calcule, d.blessure_resume
FROM public.personnes p, LATERAL public.get_joueur_detail(p.id) d;

-- ---------------------------------------------------------------------
-- 1. Table blessures (D1, D3, D6)
-- ---------------------------------------------------------------------
CREATE TABLE public.blessures (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  personne_id uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  date_debut  date NOT NULL,
  date_fin    date,
  libelle     text NOT NULL,
  notes       text,
  cree_par    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blessures_dates_check CHECK (date_fin IS NULL OR date_fin >= date_debut),
  CONSTRAINT blessures_libelle_check CHECK (length(btrim(libelle)) > 0)
);

CREATE INDEX blessures_personne_idx ON public.blessures (personne_id, date_debut DESC);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.blessures
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.blessures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blessures FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.blessures IS
  'Historique des blessures (donnée de santé). Accès uniquement via RPC SECURITY DEFINER (pt 274, sql_253).';

-- ---------------------------------------------------------------------
-- 2. Helper interne : libellé de la blessure active (D2) — non exposé
-- ---------------------------------------------------------------------
CREATE FUNCTION public._blessure_active_libelle(p_personne_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT b.libelle
  FROM public.blessures b
  WHERE b.personne_id = p_personne_id
    AND b.date_debut <= CURRENT_DATE
    AND (b.date_fin IS NULL OR b.date_fin >= CURRENT_DATE)
  ORDER BY b.date_debut DESC, b.created_at DESC
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public._blessure_active_libelle(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC lecture / écriture (D7)
-- ---------------------------------------------------------------------
CREATE FUNCTION public.list_blessures_joueur(p_personne_id uuid)
RETURNS TABLE (
  id uuid, personne_id uuid, date_debut date, date_fin date,
  libelle text, notes text, est_active boolean,
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
  SELECT b.id, b.personne_id, b.date_debut, b.date_fin, b.libelle, b.notes,
         (b.date_debut <= CURRENT_DATE AND (b.date_fin IS NULL OR b.date_fin >= CURRENT_DATE)),
         b.created_at, b.updated_at
  FROM public.blessures b
  WHERE b.personne_id = p_personne_id
  ORDER BY b.date_debut DESC, b.created_at DESC;
END;
$fn$;

CREATE FUNCTION public.upsert_blessure(
  p_id uuid,
  p_personne_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_libelle text,
  p_notes text
)
RETURNS SETOF public.blessures
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
    SELECT b.personne_id INTO v_personne FROM public.blessures b WHERE b.id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Blessure % introuvable', p_id USING ERRCODE = '02000';
    END IF;
    IF p_personne_id IS NOT NULL AND p_personne_id <> v_personne THEN
      RAISE EXCEPTION 'Blessure % rattachée à une autre personne', p_id USING ERRCODE = '22023';
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
  IF p_libelle IS NULL OR length(btrim(p_libelle)) = 0 THEN
    RAISE EXCEPTION 'Libellé obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_date_fin IS NOT NULL AND p_date_fin < p_date_debut THEN
    RAISE EXCEPTION 'La date de fin doit être postérieure ou égale à la date de début' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    RETURN QUERY
    INSERT INTO public.blessures (personne_id, date_debut, date_fin, libelle, notes, cree_par)
    VALUES (v_personne, p_date_debut, p_date_fin, btrim(p_libelle),
            NULLIF(btrim(p_notes), ''), auth.uid())
    RETURNING *;
  ELSE
    RETURN QUERY
    UPDATE public.blessures b
    SET date_debut = p_date_debut,
        date_fin   = p_date_fin,
        libelle    = btrim(p_libelle),
        notes      = NULLIF(btrim(p_notes), '')
    WHERE b.id = p_id
    RETURNING *;
  END IF;
END;
$fn$;

CREATE FUNCTION public.delete_blessure(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
BEGIN
  SELECT p.categorie_id INTO v_cat
  FROM public.blessures b JOIN public.personnes p ON p.id = b.personne_id
  WHERE b.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blessure % introuvable', p_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.blessures WHERE id = p_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_blessures_joueur(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_blessure(uuid, uuid, date, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_blessure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_blessures_joueur(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_blessure(uuid, uuid, date, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_blessure(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Les 5 RPC d'état : remplacement textuel contrôlé de la définition
--    déployée (aucune retranscription ; signatures et ACL inchangées)
-- ---------------------------------------------------------------------
DO $rpc$
DECLARE
  r record;
  v_def text;
  v_new text;
  c_sel CONSTANT text := 'p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,';
  n_sel CONSTANT text := 'p.indisponibilite, public._blessure_active_libelle(p.id), p.suspension_jusqu_au,';
  c_cas CONSTANT text := 'WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN ''blesse''';
  n_cas CONSTANT text := 'WHEN public._blessure_active_libelle(p.id) IS NOT NULL THEN ''blesse''';
  n_occ_sel int;
  n_occ_cas int;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           CASE p.proname WHEN 'get_joueur_detail' THEN 1 ELSE 2 END AS attendu_sel
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_joueur_detail', 'get_joueurs_categorie', 'get_joueurs_equipe',
                        'get_joueurs_f15', 'get_joueurs_section')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    n_occ_sel := (length(v_def) - length(replace(v_def, c_sel, ''))) / length(c_sel);
    n_occ_cas := (length(v_def) - length(replace(v_def, c_cas, ''))) / length(c_cas);
    IF n_occ_sel <> r.attendu_sel OR n_occ_cas <> 1 THEN
      RAISE EXCEPTION 'RPC % : motifs inattendus (sélection %/% , état %/1)',
        r.proname, n_occ_sel, r.attendu_sel, n_occ_cas;
    END IF;
    v_new := replace(replace(v_def, c_sel, n_sel), c_cas, n_cas);
    IF position('p.blessure_resume' IN v_new) > 0 THEN
      RAISE EXCEPTION 'RPC % : référence résiduelle à p.blessure_resume', r.proname;
    END IF;
    EXECUTE v_new;
  END LOOP;
END;
$rpc$;

-- ---------------------------------------------------------------------
-- 5. Reprise FESSARD Léopold (D5) — dates fournies par Manu
-- ---------------------------------------------------------------------
INSERT INTO public.blessures (personne_id, date_debut, date_fin, libelle)
SELECT p.id, DATE '2026-09-23', DATE '2026-10-04', p.blessure_resume
FROM public.personnes p
WHERE p.id = '95333056-381b-4899-af63-56d03b1c4404'
  AND p.blessure_resume = 'entorse genou';

-- ---------------------------------------------------------------------
-- 6. Vérifications fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  n int;
  v_etat text;
  v_lib text;
  v_id uuid;
  v_ok boolean;
  c_fessard CONSTANT uuid := '95333056-381b-4899-af63-56d03b1c4404';
  c_manu CONSTANT text := '7ac40334-0d2a-4b1f-822b-133d564abe6c';
BEGIN
  -- F1. Table verrouillée : RLS active, 0 policy, aucun droit client
  SELECT count(*) INTO n FROM pg_class WHERE oid = 'public.blessures'::regclass AND relrowsecurity;
  IF n <> 1 THEN RAISE EXCEPTION 'F1 KO : RLS inactive'; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blessures';
  IF n <> 0 THEN RAISE EXCEPTION 'F1 KO : % policies', n; END IF;
  IF has_table_privilege('anon', 'public.blessures', 'SELECT')
     OR has_table_privilege('authenticated', 'public.blessures', 'SELECT')
     OR has_table_privilege('authenticated', 'public.blessures', 'INSERT') THEN
    RAISE EXCEPTION 'F1 KO : droits directs client sur blessures';
  END IF;

  -- F2. Droits d'exécution des fonctions
  IF has_function_privilege('authenticated', 'public._blessure_active_libelle(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._blessure_active_libelle(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'F2 KO : helper exposé';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.list_blessures_joueur(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.upsert_blessure(uuid,uuid,date,date,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.delete_blessure(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'F2 KO : RPC non exécutables par authenticated';
  END IF;
  IF has_function_privilege('anon', 'public.list_blessures_joueur(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.upsert_blessure(uuid,uuid,date,date,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.delete_blessure(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'F2 KO : RPC exécutables par anon';
  END IF;

  -- F3. Reprise FESSARD
  SELECT count(*) INTO n FROM public.blessures
  WHERE personne_id = c_fessard AND date_debut = '2026-09-23' AND date_fin = '2026-10-04'
    AND libelle = 'entorse genou';
  IF n <> 1 THEN RAISE EXCEPTION 'F3 KO : reprise FESSARD (% ligne)', n; END IF;

  -- F4. Non-régression : états et libellés identiques avant / après
  CREATE TEMP TABLE _snap_apres ON COMMIT DROP AS
  SELECT 'categorie:' || c.id::text AS src, j.id, j.etat_calcule, j.blessure_resume
  FROM public.categories c, LATERAL public.get_joueurs_categorie(c.id) j
  UNION ALL
  SELECT 'equipe:' || e.id::text, j.id, j.etat_calcule, j.blessure_resume
  FROM public.equipes e, LATERAL public.get_joueurs_equipe(e.id) j
  UNION ALL
  SELECT 'f15', j.id, j.etat_calcule, j.blessure_resume FROM public.get_joueurs_f15() j
  UNION ALL
  SELECT 'section', j.id, j.etat_calcule, j.blessure_resume FROM public.get_joueurs_section() j
  UNION ALL
  SELECT 'detail', d.id, d.etat_calcule, d.blessure_resume
  FROM public.personnes p, LATERAL public.get_joueur_detail(p.id) d;

  SELECT count(*) INTO n FROM (
    (SELECT * FROM _snap_avant EXCEPT ALL SELECT * FROM _snap_apres)
    UNION ALL
    (SELECT * FROM _snap_apres EXCEPT ALL SELECT * FROM _snap_avant)
  ) d;
  IF n <> 0 THEN RAISE EXCEPTION 'F4 KO : % écarts d''état avant/après', n; END IF;
  SELECT count(*) INTO n FROM _snap_apres;
  IF n = 0 THEN RAISE EXCEPTION 'F4 KO : instantané vide'; END IF;

  SELECT etat_calcule, blessure_resume INTO v_etat, v_lib FROM public.get_joueur_detail(c_fessard);
  IF v_etat <> 'blesse' OR v_lib <> 'entorse genou' THEN
    RAISE EXCEPTION 'F4 KO : FESSARD % / %', v_etat, v_lib;
  END IF;

  -- F5. Garde : sans session, lecture refusée
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  v_ok := false;
  BEGIN
    PERFORM * FROM public.list_blessures_joueur(c_fessard);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'F5 KO : lecture sans session acceptée'; END IF;

  -- F6. Cycle complet avec la session admin de Manu
  PERFORM set_config('request.jwt.claim.sub', c_manu, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_manu)::text, true);

  SELECT count(*) INTO n FROM public.list_blessures_joueur(c_fessard) WHERE est_active;
  IF n <> 1 THEN RAISE EXCEPTION 'F6 KO : lecture FESSARD (% active)', n; END IF;

  -- blessure future : enregistrée mais pas encore active
  SELECT id INTO v_id FROM public.upsert_blessure(NULL, c_fessard, CURRENT_DATE + 10, NULL,
                                                  '  test blessure future ', '');
  SELECT count(*) INTO n FROM public.blessures
  WHERE id = v_id AND libelle = 'test blessure future' AND notes IS NULL AND cree_par = c_manu::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'F6 KO : insertion'; END IF;
  SELECT blessure_resume INTO v_lib FROM public.get_joueur_detail(c_fessard);
  IF v_lib <> 'entorse genou' THEN RAISE EXCEPTION 'F6 KO : blessure future active (%)', v_lib; END IF;

  -- modification : devient active aujourd'hui
  PERFORM public.upsert_blessure(v_id, NULL, CURRENT_DATE, CURRENT_DATE + 3, 'test blessure active', 'note');
  SELECT blessure_resume INTO v_lib FROM public.get_joueur_detail(c_fessard);
  IF v_lib <> 'test blessure active' THEN RAISE EXCEPTION 'F6 KO : modification (%)', v_lib; END IF;

  -- fin < début refusée
  v_ok := false;
  BEGIN
    PERFORM public.upsert_blessure(v_id, NULL, CURRENT_DATE, CURRENT_DATE - 1, 'x', NULL);
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'F6 KO : fin < début acceptée'; END IF;

  -- suppression
  PERFORM public.delete_blessure(v_id);
  SELECT count(*) INTO n FROM public.blessures WHERE id = v_id;
  IF n <> 0 THEN RAISE EXCEPTION 'F6 KO : suppression'; END IF;
  SELECT blessure_resume INTO v_lib FROM public.get_joueur_detail(c_fessard);
  IF v_lib <> 'entorse genou' THEN RAISE EXCEPTION 'F6 KO : après suppression (%)', v_lib; END IF;

  -- remise à zéro de la session simulée
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT count(*) INTO n FROM public.blessures;
  IF n <> 1 THEN RAISE EXCEPTION 'F6 KO : % lignes résiduelles (attendu 1)', n; END IF;

  RAISE NOTICE 'VERIF OK : F1..F6 verts';
END;
$verif$;

ROLLBACK;
