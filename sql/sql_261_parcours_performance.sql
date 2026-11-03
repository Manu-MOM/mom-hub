-- =====================================================================
-- sql_261_parcours_performance
-- FAIT FOI « PARCOURS-PERFORMANCE » v1 gelé par Manu le 03/11/2026
--   (« je gèle », D1-D9). Lot L1 : socle SQL (2 tables + RPC).
--   D1 statut de saison (joueur x saison) + suivi match par match
--   D3 aucune agrégation aux stats du collectif M16 (tables isolées,
--      aucune RPC existante modifiée)
--   D5 périmètre = collectif de l'entente M16 (tous clubs)
--   D6 statut fermé : integre | renfort | double_licence ;
--      structure et équipe d'accueil en libellé libre
--   D7 participation : pas de minutes ni de cartons en v1
--   D8 réimport sans doublon : clé (personne, cle_match)
--      cle_match = date AAAA-MM-JJ | adversaire normalisé (minuscules, trim)
-- Droits (patron sql_253 blessures) :
--   lecture  : admin | bureau | puis_je_lire_categorie(cat du joueur)
--   écriture : admin | bureau | puis_je_ecrire_categorie(cat du joueur)
--   RLS active, 0 policy, aucun droit direct client ; RPC SECURITY DEFINER,
--   REVOKE public/anon, GRANT authenticated.
-- Catégorie de rattachement = personnes.categorie_id du joueur (sondé :
-- les 71 joueurs du collectif M16 sont tous en M16).
-- Saison par défaut = saisons.est_active.
-- Mode : DRY-RUN (ROLLBACK final). Version COMMIT = même fichier avec
-- COMMIT à la place du ROLLBACK, sur feu vert explicite de Manu.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table parcours_performance_saison (D1, D6)
-- ---------------------------------------------------------------------
CREATE TABLE public.parcours_performance_saison (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id    uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  saison_id      uuid NOT NULL REFERENCES public.saisons(id),
  categorie_id   uuid NOT NULL REFERENCES public.categories(id),
  statut         text NOT NULL,
  structure      text,
  equipe_accueil text,
  notes          text,
  cree_par       uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_saison_statut_check
    CHECK (statut IN ('integre', 'renfort', 'double_licence')),
  CONSTRAINT pp_saison_unique UNIQUE (personne_id, saison_id)
);

CREATE INDEX pp_saison_cat_idx
ON public.parcours_performance_saison (categorie_id, saison_id);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.parcours_performance_saison
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.parcours_performance_saison ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parcours_performance_saison FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.parcours_performance_saison IS
  'Parcours Performance : statut de saison d''un joueur (FAIT FOI PARCOURS-PERFORMANCE v1, sql_261). Accès via RPC uniquement.';

-- ---------------------------------------------------------------------
-- 2. Table parcours_performance_match (D1, D7, D8)
-- ---------------------------------------------------------------------
CREATE TABLE public.parcours_performance_match (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id     uuid NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  saison_id       uuid NOT NULL REFERENCES public.saisons(id),
  categorie_id    uuid NOT NULL REFERENCES public.categories(id),
  date_match      date NOT NULL,
  competition     text,
  phase           text,
  equipe_accueil  text,
  adversaire      text,
  score_pour      smallint,
  score_contre    smallint,
  statut_joueur   text NOT NULL DEFAULT 'titulaire',
  numero          smallint,
  capitaine       boolean NOT NULL DEFAULT false,
  essais          smallint NOT NULL DEFAULT 0,
  transformations smallint NOT NULL DEFAULT 0,
  penalites       smallint NOT NULL DEFAULT 0,
  drops           smallint NOT NULL DEFAULT 0,
  source          text NOT NULL DEFAULT 'manuel',
  cle_match       text NOT NULL,
  notes           text,
  cree_par        uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_match_statut_check
    CHECK (statut_joueur IN ('titulaire', 'entre', 'non_entre')),
  CONSTRAINT pp_match_source_check CHECK (source IN ('ffr', 'manuel')),
  CONSTRAINT pp_match_compteurs_check
    CHECK (essais >= 0 AND transformations >= 0 AND penalites >= 0 AND drops >= 0),
  CONSTRAINT pp_match_scores_check
    CHECK ((score_pour IS NULL OR score_pour >= 0) AND (score_contre IS NULL OR score_contre >= 0)),
  CONSTRAINT pp_match_numero_check CHECK (numero IS NULL OR numero BETWEEN 1 AND 99),
  CONSTRAINT pp_match_unique UNIQUE (personne_id, cle_match)
);

CREATE INDEX pp_match_cat_idx
ON public.parcours_performance_match (categorie_id, saison_id, date_match DESC);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.parcours_performance_match
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.parcours_performance_match ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parcours_performance_match FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.parcours_performance_match IS
  'Parcours Performance : participations aux matchs de l''équipe d''accueil (ABCD XV, Oyonnax...). Jamais agrégées aux stats du collectif (D3). Accès via RPC uniquement.';

-- ---------------------------------------------------------------------
-- 3. Helpers internes (non exposés)
-- ---------------------------------------------------------------------
CREATE FUNCTION public._pp_saison_active()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT s.id FROM public.saisons s WHERE s.est_active ORDER BY s.date_debut DESC NULLS LAST LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public._pp_saison_active() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public._pp_cle_match(p_date date, p_adversaire text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT to_char(p_date, 'YYYY-MM-DD') || '|'
         || lower(regexp_replace(btrim(coalesce(p_adversaire, '')), '\s+', ' ', 'g'));
$fn$;
REVOKE ALL ON FUNCTION public._pp_cle_match(date, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC — statut de saison
-- ---------------------------------------------------------------------
CREATE FUNCTION public.list_parcours_saison(
  p_categorie_id uuid,
  p_saison_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, personne_id uuid, nom text, prenom text, club text,
  saison_id uuid, categorie_id uuid, statut text, structure text,
  equipe_accueil text, notes text, nb_matchs bigint, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
BEGIN
  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.id, s.personne_id, p.nom, p.prenom,
         (SELECT cl.nom_court FROM public.clubs cl WHERE cl.id = p.club_principal_id),
         s.saison_id, s.categorie_id, s.statut, s.structure, s.equipe_accueil, s.notes,
         (SELECT count(*) FROM public.parcours_performance_match m
            WHERE m.personne_id = s.personne_id AND m.saison_id = s.saison_id),
         s.updated_at
  FROM public.parcours_performance_saison s
  JOIN public.personnes p ON p.id = s.personne_id
  WHERE s.categorie_id = p_categorie_id
    AND s.saison_id = v_saison
  ORDER BY p.nom, p.prenom;
END;
$fn$;

CREATE FUNCTION public.upsert_parcours_saison(
  p_personne_id uuid,
  p_statut text,
  p_structure text DEFAULT NULL,
  p_equipe_accueil text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_saison_id uuid DEFAULT NULL
)
RETURNS SETOF public.parcours_performance_saison
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
  v_moi uuid;
BEGIN
  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  IF v_saison IS NULL THEN
    RAISE EXCEPTION 'Aucune saison active' USING ERRCODE = '22023';
  END IF;
  SELECT p.categorie_id INTO v_cat FROM public.personnes p WHERE p.id = p_personne_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'Le joueur n''a pas de catégorie' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF p_statut IS NULL OR p_statut NOT IN ('integre', 'renfort', 'double_licence') THEN
    RAISE EXCEPTION 'Statut invalide (integre | renfort | double_licence)' USING ERRCODE = '22023';
  END IF;
  SELECT q.personne_id INTO v_moi FROM public.qui_suis_je() q LIMIT 1;

  RETURN QUERY
  INSERT INTO public.parcours_performance_saison AS s
    (personne_id, saison_id, categorie_id, statut, structure, equipe_accueil, notes, cree_par)
  VALUES
    (p_personne_id, v_saison, v_cat, p_statut,
     NULLIF(btrim(p_structure), ''), NULLIF(btrim(p_equipe_accueil), ''),
     NULLIF(btrim(p_notes), ''), v_moi)
  ON CONFLICT (personne_id, saison_id) DO UPDATE
    SET statut = EXCLUDED.statut,
        structure = EXCLUDED.structure,
        equipe_accueil = EXCLUDED.equipe_accueil,
        notes = EXCLUDED.notes,
        categorie_id = EXCLUDED.categorie_id
  RETURNING s.*;
END;
$fn$;

CREATE FUNCTION public.delete_parcours_saison(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
BEGIN
  SELECT s.categorie_id INTO v_cat FROM public.parcours_performance_saison s WHERE s.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statut % introuvable', p_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.parcours_performance_saison WHERE id = p_id;
  RETURN true;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 5. RPC — participations aux matchs
-- ---------------------------------------------------------------------
CREATE FUNCTION public.list_parcours_matchs(
  p_categorie_id uuid,
  p_saison_id uuid DEFAULT NULL,
  p_personne_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, personne_id uuid, nom text, prenom text,
  saison_id uuid, date_match date, competition text, phase text,
  equipe_accueil text, adversaire text, score_pour smallint, score_contre smallint,
  statut_joueur text, numero smallint, capitaine boolean,
  essais smallint, transformations smallint, penalites smallint, drops smallint,
  points integer, source text, notes text, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
BEGIN
  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.id, m.personne_id, p.nom, p.prenom, m.saison_id, m.date_match,
         m.competition, m.phase, m.equipe_accueil, m.adversaire,
         m.score_pour, m.score_contre, m.statut_joueur, m.numero, m.capitaine,
         m.essais, m.transformations, m.penalites, m.drops,
         (m.essais * 5 + m.transformations * 2 + m.penalites * 3 + m.drops * 3)::integer,
         m.source, m.notes, m.updated_at
  FROM public.parcours_performance_match m
  JOIN public.personnes p ON p.id = m.personne_id
  WHERE m.categorie_id = p_categorie_id
    AND m.saison_id = v_saison
    AND (p_personne_id IS NULL OR m.personne_id = p_personne_id)
  ORDER BY m.date_match DESC, p.nom, p.prenom;
END;
$fn$;

CREATE FUNCTION public.upsert_parcours_match(
  p_id uuid,
  p_personne_id uuid,
  p_date_match date,
  p_competition text,
  p_phase text,
  p_equipe_accueil text,
  p_adversaire text,
  p_score_pour smallint,
  p_score_contre smallint,
  p_statut_joueur text,
  p_numero smallint,
  p_capitaine boolean,
  p_essais smallint,
  p_transformations smallint,
  p_penalites smallint,
  p_drops smallint,
  p_source text DEFAULT 'manuel',
  p_notes text DEFAULT NULL
)
RETURNS SETOF public.parcours_performance_match
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_personne uuid;
  v_cat uuid;
  v_saison uuid;
  v_moi uuid;
  v_cle text;
  v_statut text := coalesce(p_statut_joueur, 'titulaire');
  v_ess smallint := coalesce(p_essais, 0);
  v_tra smallint := coalesce(p_transformations, 0);
  v_pen smallint := coalesce(p_penalites, 0);
  v_dro smallint := coalesce(p_drops, 0);
BEGIN
  IF p_id IS NULL THEN
    v_personne := p_personne_id;
  ELSE
    SELECT m.personne_id INTO v_personne FROM public.parcours_performance_match m WHERE m.id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Participation % introuvable', p_id USING ERRCODE = '02000';
    END IF;
    IF p_personne_id IS NOT NULL AND p_personne_id <> v_personne THEN
      RAISE EXCEPTION 'Participation % rattachée à une autre personne', p_id USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_personne IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  SELECT p.categorie_id INTO v_cat FROM public.personnes p WHERE p.id = v_personne;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personne % introuvable', v_personne USING ERRCODE = '02000';
  END IF;
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'Le joueur n''a pas de catégorie' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF p_date_match IS NULL THEN
    RAISE EXCEPTION 'Date du match obligatoire' USING ERRCODE = '22023';
  END IF;
  IF v_statut NOT IN ('titulaire', 'entre', 'non_entre') THEN
    RAISE EXCEPTION 'Statut joueur invalide (titulaire | entre | non_entre)' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_source, 'manuel') NOT IN ('ffr', 'manuel') THEN
    RAISE EXCEPTION 'Source invalide (ffr | manuel)' USING ERRCODE = '22023';
  END IF;
  -- D7 : un joueur qui marque est compté entré, même sans changement enregistré
  IF v_statut = 'non_entre' AND (v_ess + v_tra + v_pen + v_dro) > 0 THEN
    v_statut := 'entre';
  END IF;

  -- Saison = saison dont la plage contient la date ; sinon saison active
  SELECT s.id INTO v_saison FROM public.saisons s
  WHERE p_date_match BETWEEN s.date_debut AND coalesce(s.date_fin, 'infinity'::date)
  ORDER BY s.date_debut DESC LIMIT 1;
  v_saison := coalesce(v_saison, public._pp_saison_active());
  IF v_saison IS NULL THEN
    RAISE EXCEPTION 'Aucune saison pour la date %', p_date_match USING ERRCODE = '22023';
  END IF;

  v_cle := public._pp_cle_match(p_date_match, p_adversaire);
  SELECT q.personne_id INTO v_moi FROM public.qui_suis_je() q LIMIT 1;

  IF p_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE public.parcours_performance_match m
    SET saison_id = v_saison, categorie_id = v_cat, date_match = p_date_match,
        competition = NULLIF(btrim(p_competition), ''), phase = NULLIF(btrim(p_phase), ''),
        equipe_accueil = NULLIF(btrim(p_equipe_accueil), ''), adversaire = NULLIF(btrim(p_adversaire), ''),
        score_pour = p_score_pour, score_contre = p_score_contre,
        statut_joueur = v_statut, numero = p_numero, capitaine = coalesce(p_capitaine, false),
        essais = v_ess, transformations = v_tra, penalites = v_pen, drops = v_dro,
        source = coalesce(p_source, 'manuel'), cle_match = v_cle, notes = NULLIF(btrim(p_notes), '')
    WHERE m.id = p_id
    RETURNING m.*;
  ELSE
    -- D8 : réimport sans doublon (même joueur, même date, même adversaire)
    RETURN QUERY
    INSERT INTO public.parcours_performance_match AS m
      (personne_id, saison_id, categorie_id, date_match, competition, phase,
       equipe_accueil, adversaire, score_pour, score_contre, statut_joueur, numero,
       capitaine, essais, transformations, penalites, drops, source, cle_match, notes, cree_par)
    VALUES
      (v_personne, v_saison, v_cat, p_date_match, NULLIF(btrim(p_competition), ''),
       NULLIF(btrim(p_phase), ''), NULLIF(btrim(p_equipe_accueil), ''),
       NULLIF(btrim(p_adversaire), ''), p_score_pour, p_score_contre, v_statut, p_numero,
       coalesce(p_capitaine, false), v_ess, v_tra, v_pen, v_dro,
       coalesce(p_source, 'manuel'), v_cle, NULLIF(btrim(p_notes), ''), v_moi)
    ON CONFLICT (personne_id, cle_match) DO UPDATE
      SET saison_id = EXCLUDED.saison_id, categorie_id = EXCLUDED.categorie_id,
          competition = EXCLUDED.competition, phase = EXCLUDED.phase,
          equipe_accueil = EXCLUDED.equipe_accueil, adversaire = EXCLUDED.adversaire,
          score_pour = EXCLUDED.score_pour, score_contre = EXCLUDED.score_contre,
          statut_joueur = EXCLUDED.statut_joueur, numero = EXCLUDED.numero,
          capitaine = EXCLUDED.capitaine, essais = EXCLUDED.essais,
          transformations = EXCLUDED.transformations, penalites = EXCLUDED.penalites,
          drops = EXCLUDED.drops, source = EXCLUDED.source, notes = EXCLUDED.notes
    RETURNING m.*;
  END IF;
END;
$fn$;

CREATE FUNCTION public.delete_parcours_match(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cat uuid;
BEGIN
  SELECT m.categorie_id INTO v_cat FROM public.parcours_performance_match m WHERE m.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participation % introuvable', p_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.parcours_performance_match WHERE id = p_id;
  RETURN true;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 6. Droits d'exécution
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.list_parcours_saison(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_parcours_saison(uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_parcours_saison(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_parcours_matchs(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_parcours_match(
  uuid, uuid, date, text, text, text, text, smallint, smallint, text,
  smallint, boolean, smallint, smallint, smallint, smallint, text, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_parcours_match(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_parcours_saison(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_parcours_saison(uuid, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_parcours_saison(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_parcours_matchs(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_parcours_match(
  uuid, uuid, date, text, text, text, text, smallint, smallint, text,
  smallint, boolean, smallint, smallint, smallint, smallint, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_parcours_match(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relrowsecurity
    AND c.relname IN ('parcours_performance_saison', 'parcours_performance_match');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: RLS non active sur les 2 tables (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('parcours_performance_saison', 'parcours_performance_match');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: policies inattendues (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND p.proname IN ('list_parcours_saison', 'upsert_parcours_saison', 'delete_parcours_saison',
                      'list_parcours_matchs', 'upsert_parcours_match', 'delete_parcours_match');
  IF v_n <> 6 THEN RAISE EXCEPTION 'VERIF: 6 RPC SECURITY DEFINER attendues (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('list_parcours_saison', 'upsert_parcours_saison', 'delete_parcours_saison',
                      'list_parcours_matchs', 'upsert_parcours_match', 'delete_parcours_match')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % RPC exécutable(s) par anon', v_n; END IF;

  IF public._pp_cle_match('2026-10-31'::date, '  Rouen   Normandie Rugby ')
     <> '2026-10-31|rouen normandie rugby' THEN
    RAISE EXCEPTION 'VERIF: _pp_cle_match incorrecte';
  END IF;

  IF public._pp_saison_active() IS NULL THEN
    RAISE EXCEPTION 'VERIF: aucune saison active';
  END IF;

  RAISE NOTICE 'VERIF OK : 2 tables RLS sans policy, 6 RPC secdef, anon révoqué, clé de match OK';
END;
$verif$;

ROLLBACK;
