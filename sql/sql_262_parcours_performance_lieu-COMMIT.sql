-- =====================================================================
-- sql_262_parcours_performance_lieu
-- FAIT FOI « PARCOURS-PERFORMANCE » v1.1 — amendement D7bis gelé par Manu
--   le 03/11/2026 (« ajoute terrain neutre et pour le reste, je gèle »).
--   D7bis : chaque participation porte le lieu du match :
--     domicile | exterieur | neutre ; NULL = non renseigné.
--   Le score reste stocké « pour / contre » (point de vue de notre équipe) ;
--   le lieu ne règle que l'ordre d'affichage (équipe qui reçoit d'abord).
--   Aucune donnée existante convertie (lieu NULL pour les lignes en place).
-- Changements :
--   1. parcours_performance_match.lieu (text, CHECK, NULL autorisé)
--   2. list_parcours_matchs : + colonne lieu (type de retour modifié
--      => DROP puis CREATE, signature d'appel inchangée)
--   3. upsert_parcours_match : + p_lieu text DEFAULT NULL en DERNIER
--      paramètre (DROP de l'ancienne signature à 18 paramètres, pas de
--      surcharge laissée). Appels nommés existants toujours valides.
--   Droits rejoués à l'identique (REVOKE public/anon, GRANT authenticated).
-- Corps des fonctions repris de sql_261 (déployé, sondé le 03/11) ; seules
-- les lignes « lieu » sont ajoutées.
-- Mode : COMMIT (identique au DRY-RUN hors tests, à exécuter uniquement
-- sur feu vert explicite de Manu).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Colonne lieu (D7bis)
-- ---------------------------------------------------------------------
ALTER TABLE public.parcours_performance_match
  ADD COLUMN lieu text,
  ADD CONSTRAINT pp_match_lieu_check CHECK (lieu IS NULL OR lieu IN ('domicile', 'exterieur', 'neutre'));
COMMENT ON COLUMN public.parcours_performance_match.lieu IS
  'Lieu du match pour notre équipe : domicile | exterieur | neutre ; NULL = non renseigné (D7bis).';

-- ---------------------------------------------------------------------
-- 2. list_parcours_matchs (+ lieu)
-- ---------------------------------------------------------------------
DROP FUNCTION public.list_parcours_matchs(uuid, uuid, uuid);

CREATE FUNCTION public.list_parcours_matchs(
  p_categorie_id uuid,
  p_saison_id uuid DEFAULT NULL,
  p_personne_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, personne_id uuid, nom text, prenom text,
  saison_id uuid, date_match date, competition text, phase text,
  equipe_accueil text, adversaire text, lieu text, score_pour smallint, score_contre smallint,
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
         m.competition, m.phase, m.equipe_accueil, m.adversaire, m.lieu,
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

-- ---------------------------------------------------------------------
-- 3. upsert_parcours_match (+ p_lieu)
-- ---------------------------------------------------------------------
DROP FUNCTION public.upsert_parcours_match(
  uuid, uuid, date, text, text, text, text, smallint, smallint, text,
  smallint, boolean, smallint, smallint, smallint, smallint, text, text
);

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
  p_notes text DEFAULT NULL,
  p_lieu text DEFAULT NULL
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
  IF p_lieu IS NOT NULL AND p_lieu NOT IN ('domicile', 'exterieur', 'neutre') THEN
    RAISE EXCEPTION 'Lieu invalide (domicile | exterieur | neutre)' USING ERRCODE = '22023';
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
        lieu = p_lieu,
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
       equipe_accueil, adversaire, lieu, score_pour, score_contre, statut_joueur, numero,
       capitaine, essais, transformations, penalites, drops, source, cle_match, notes, cree_par)
    VALUES
      (v_personne, v_saison, v_cat, p_date_match, NULLIF(btrim(p_competition), ''),
       NULLIF(btrim(p_phase), ''), NULLIF(btrim(p_equipe_accueil), ''),
       NULLIF(btrim(p_adversaire), ''), p_lieu, p_score_pour, p_score_contre, v_statut, p_numero,
       coalesce(p_capitaine, false), v_ess, v_tra, v_pen, v_dro,
       coalesce(p_source, 'manuel'), v_cle, NULLIF(btrim(p_notes), ''), v_moi)
    ON CONFLICT (personne_id, cle_match) DO UPDATE
      SET saison_id = EXCLUDED.saison_id, categorie_id = EXCLUDED.categorie_id,
          competition = EXCLUDED.competition, phase = EXCLUDED.phase,
          equipe_accueil = EXCLUDED.equipe_accueil, adversaire = EXCLUDED.adversaire,
          lieu = EXCLUDED.lieu,
          score_pour = EXCLUDED.score_pour, score_contre = EXCLUDED.score_contre,
          statut_joueur = EXCLUDED.statut_joueur, numero = EXCLUDED.numero,
          capitaine = EXCLUDED.capitaine, essais = EXCLUDED.essais,
          transformations = EXCLUDED.transformations, penalites = EXCLUDED.penalites,
          drops = EXCLUDED.drops, source = EXCLUDED.source, notes = EXCLUDED.notes
    RETURNING m.*;
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. Droits d'exécution (identiques à sql_261)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.list_parcours_matchs(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_parcours_match(
  uuid, uuid, date, text, text, text, text, smallint, smallint, text,
  smallint, boolean, smallint, smallint, smallint, smallint, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_parcours_matchs(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_parcours_match(
  uuid, uuid, date, text, text, text, text, smallint, smallint, text,
  smallint, boolean, smallint, smallint, smallint, smallint, text, text, text
) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'parcours_performance_match' AND column_name = 'lieu';
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: colonne lieu absente'; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'upsert_parcours_match';
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: % surcharges de upsert_parcours_match (1 attendue)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND p.proname IN ('list_parcours_matchs', 'upsert_parcours_match')
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: droits des 2 RPC incorrects (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'list_parcours_matchs'
    AND pg_get_function_result(p.oid) LIKE '%lieu text%';
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: list_parcours_matchs ne renvoie pas lieu'; END IF;

  RAISE NOTICE 'VERIF OK : colonne lieu, 2 RPC recréées, droits rejoués';
END;
$verif$;

COMMIT;
