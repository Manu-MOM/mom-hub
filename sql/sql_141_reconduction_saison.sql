-- ============================================================================
-- sql_141_reconduction_saison.sql
-- ----------------------------------------------------------------------------
-- OBJET
--   Reconduction de saison en UN GESTE (FAIT FOI :
--   Conception-Reconduction-Saison-v1.md, md5 2f50aabf, périmètre B tranché
--   par Manu le 01/07/2026) : comble le trou fonctionnel de sql/53 dont la
--   bascule surclasse les joueurs mais ne reconduit ni les ententes, ni le
--   rattachement des équipes, ni le collectif.
--
--   3 volets, UNE transaction (appliquer_reconduction) :
--     1) ENTENTES  : création N+1 à l'identique, code/slug/libelle_long
--        remillésimés (tokens dérivés de saisons.code, rien en dur).
--     2) ÉQUIPES   : re-rattachement entente_id -> entente cible de même
--        catégorie + remillésimage du code (prouvé affichage seul, D1).
--     3) COLLECTIF : joueurs dérivés de personnes (post-bascule, patron
--        sql/55) + staff copié à l'identique (non dérivable). Les lignes de
--        la saison source ne sont PAS touchées (historique préservé).
--
-- PATRON : sql/53 (bascule). _derive_* privée (REVOKE), apercu_* LECTURE
--   SEULE, appliquer_* recalcule serveur + fail-loud + journal dédié
--   reconduction_log (bascule_log non détournée, D3).
--
-- SONDES D'ENTRÉE (01/07/2026, la base fait foi — leçon divergence RLS F4)
--   E1 : collectif_membre = 10 colonnes (date_creation, PAS created_at ;
--        statut NULLABLE). equipes = 32 colonnes, code + entente_id NOT NULL.
--   E2 : ON CONFLICT -> contrainte collectif_membre_unique
--        (personne_id, entente_id, role, date_debut) ;
--        CHECK role IN ('joueur','staff') ;
--        CHECK statut NULL OU IN ('regulier','renfort_temporaire','en_transition').
--   E3 : saisons live -> source 2025/2026 = 73645edf-d367-421a-b3e1-9f0712d4a48b
--        (inactive) ; cible 2026/2027 = 0fe81033-fd60-471d-ba5d-644458f4cdd3
--        (active, date_debut 2026-08-01 -> date_debut du collectif, D4).
--   E4 : _b5_categorie_de_equipe = jointure simple sans filtre saison ->
--        aucune des 6 fonctions lectrices d'ententes n'est à toucher.
--   Colonnes personnes (prenom, nom, categorie_personne, categorie_id) et
--   construction nom_court : reprises de _derive_bascule déployée (sql/53).
--
-- DÉCISIONS TRACÉES (FAIT FOI §7) : D1 code équipe remillésimé ; D2 notes +
--   competitions_engagees copiées ; D3 reconduction_log dédiée ; D4
--   date_debut = saisons.date_debut cible ; D5 joueurs statut='regulier' ;
--   D6 ajustements d'effectif = gestes normaux post-OVAL-E, pas de re-run.
--   Décision d'écriture (mineure, tracée) : staff dédoublonné par
--   DISTINCT ON (personne, entente cible), ligne source la plus récente
--   (date_debut DESC) gagne si une personne a 2 lignes staff actives.
--
-- IDEMPOTENT : re-run -> aperçu tout en 'deja_*', appliquer répond ok sans
--   écrire ni journaliser. FAIL-LOUD : nb écrit = nb attendu à chaque étape
--   + invariants POST, sinon RAISE EXCEPTION -> ROLLBACK total.
-- À EXÉCUTER dans le SQL Editor Supabase, RECOLLER la sortie de vérification.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) TABLE NEUVE reconduction_log (patron bascule_log, D3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconduction_log (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  saison_source_id  uuid NOT NULL REFERENCES public.saisons (id),
  saison_cible_id   uuid NOT NULL REFERENCES public.saisons (id),
  date_application  timestamptz NOT NULL DEFAULT now(),
  applique_par      text,                 -- auth.uid()::text (patron sql/53)
  nb_ententes       integer NOT NULL,
  nb_equipes        integer NOT NULL,
  nb_membres        integer NOT NULL,
  detail            jsonb   NOT NULL
);

COMMENT ON TABLE public.reconduction_log IS
  'Journal des reconductions de saison (ententes + équipes + collectif). '
  'Rollback v1 = SQL manuel depuis detail. 1 ligne = 1 application.';

ALTER TABLE public.reconduction_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture admin du journal de reconduction"
  ON public.reconduction_log;
CREATE POLICY "Lecture admin du journal de reconduction"
  ON public.reconduction_log FOR SELECT TO authenticated
  USING (public.has_role('admin'));
-- Aucune policy write : écriture UNIQUEMENT via appliquer_reconduction (DEFINER).

-- ----------------------------------------------------------------------------
-- 2) _derive_reconduction — PRIVÉE (REVOQUÉE plus bas), plan complet du geste.
--    Une ligne par objet. volet : entente | equipe | collectif.
--    groupes : a_creer/deja_existante · a_rebrancher/deja_rebranchee ·
--              a_amorcer/deja_amorce/sans_entente_cible.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._derive_reconduction(
  p_saison_source uuid,
  p_saison_cible  uuid
)
RETURNS TABLE (
  volet    text,
  groupe   text,
  objet_id uuid,
  libelle  text,
  detail   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_dash_src  text;
  v_dash_cib  text;
  v_slash_src text;
  v_slash_cib text;
BEGIN
  -- Défense en profondeur (en plus du REVOKE) : interne réservé admin.
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  SELECT s.code INTO v_slash_src FROM public.saisons s WHERE s.id = p_saison_source;
  IF v_slash_src IS NULL THEN
    RAISE EXCEPTION 'Saison source introuvable : %', p_saison_source;
  END IF;
  SELECT s.code INTO v_slash_cib FROM public.saisons s WHERE s.id = p_saison_cible;
  IF v_slash_cib IS NULL THEN
    RAISE EXCEPTION 'Saison cible introuvable : %', p_saison_cible;
  END IF;
  IF p_saison_source = p_saison_cible THEN
    RAISE EXCEPTION 'Saisons source et cible identiques.';
  END IF;
  v_dash_src := replace(v_slash_src, '/', '-');
  v_dash_cib := replace(v_slash_cib, '/', '-');

  RETURN QUERY

  -- Volet ENTENTES : une ligne par entente de la saison source.
  SELECT
    'entente'::text,
    CASE WHEN x.id IS NULL THEN 'a_creer' ELSE 'deja_existante' END,
    e.id,
    e.code,
    replace(replace(e.code, v_dash_src, v_dash_cib), v_slash_src, v_slash_cib)
  FROM public.ententes e
  LEFT JOIN public.ententes x
    ON x.saison_id = p_saison_cible AND x.categorie_id = e.categorie_id
  WHERE e.saison_id = p_saison_source

  UNION ALL

  -- Volet ÉQUIPES : équipes actives accrochées à la source (à rebrancher)
  -- ou déjà accrochées à la cible (déjà rebranchées).
  SELECT
    'equipe'::text,
    CASE WHEN e.saison_id = p_saison_cible
         THEN 'deja_rebranchee' ELSE 'a_rebrancher' END,
    eq.id,
    eq.code,
    c.code || ' -> '
      || replace(replace(eq.code, v_dash_src, v_dash_cib), v_slash_src, v_slash_cib)
  FROM public.equipes eq
  JOIN public.ententes e ON e.id = eq.entente_id
  JOIN public.categories c ON c.id = e.categorie_id
  WHERE eq.statut = 'active'
    AND e.saison_id IN (p_saison_source, p_saison_cible)

  UNION ALL

  -- Volet COLLECTIF · joueurs : dérivés de personnes (source de vérité
  -- post-bascule, patron sql/55). L'entente cible peut ne pas exister
  -- encore (aperçu avant application) : elle sera créée si la catégorie a
  -- une entente source.
  SELECT
    'collectif'::text,
    CASE
      WHEN e_cib.id IS NULL AND e_src.id IS NULL THEN 'sans_entente_cible'
      WHEN e_cib.id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.collectif_membre cm
        WHERE cm.personne_id = p.id AND cm.entente_id = e_cib.id
          AND cm.role = 'joueur' AND cm.date_fin IS NULL
      ) THEN 'deja_amorce'
      ELSE 'a_amorcer'
    END,
    p.id,
    btrim(coalesce(p.prenom, '') || ' ' || upper(coalesce(p.nom, ''))),
    'joueur · ' || coalesce(c.code, '?')
  FROM public.personnes p
  JOIN public.categories c ON c.id = p.categorie_id
  LEFT JOIN public.ententes e_cib
    ON e_cib.categorie_id = p.categorie_id AND e_cib.saison_id = p_saison_cible
  LEFT JOIN public.ententes e_src
    ON e_src.categorie_id = p.categorie_id AND e_src.saison_id = p_saison_source
  WHERE p.categorie_personne ILIKE '%joueur%'
    AND p.categorie_id IS NOT NULL

  UNION ALL

  -- Volet COLLECTIF · staff : copie des lignes actives de la source vers la
  -- cible de même catégorie (jamais sans_entente_cible : la cible naît de la
  -- source par construction). Dédoublonnage DISTINCT ON (décision tracée).
  SELECT DISTINCT ON (cm.personne_id, e_src.categorie_id)
    'collectif'::text,
    CASE
      WHEN e_cib.id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.collectif_membre x
        WHERE x.personne_id = cm.personne_id AND x.entente_id = e_cib.id
          AND x.role = 'staff' AND x.date_fin IS NULL
      ) THEN 'deja_amorce'
      ELSE 'a_amorcer'
    END,
    cm.personne_id,
    btrim(coalesce(p.prenom, '') || ' ' || upper(coalesce(p.nom, ''))),
    'staff · ' || c.code
  FROM public.collectif_membre cm
  JOIN public.ententes e_src
    ON e_src.id = cm.entente_id AND e_src.saison_id = p_saison_source
  JOIN public.categories c ON c.id = e_src.categorie_id
  JOIN public.personnes p ON p.id = cm.personne_id
  LEFT JOIN public.ententes e_cib
    ON e_cib.saison_id = p_saison_cible AND e_cib.categorie_id = e_src.categorie_id
  WHERE cm.role = 'staff' AND cm.date_fin IS NULL
  ORDER BY cm.personne_id, e_src.categorie_id, cm.date_debut DESC;
END;
$func$;

-- ----------------------------------------------------------------------------
-- 3) apercu_reconduction — LECTURE SEULE, payload RGPD minimal (nom court,
--    jamais personnes brute — patron sql/53 §5).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apercu_reconduction(
  p_saison_source uuid,
  p_saison_cible  uuid
)
RETURNS TABLE (
  volet   text,
  groupe  text,
  libelle text,
  detail  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT d.volet, d.groupe, d.libelle, d.detail
  FROM public._derive_reconduction(p_saison_source, p_saison_cible) d
  ORDER BY d.volet, d.groupe, d.libelle;
END;
$func$;

-- ----------------------------------------------------------------------------
-- 4) appliquer_reconduction — RECALCULE serveur (ne fait pas confiance à
--    l'aperçu client), transaction unique ententes -> équipes -> collectif,
--    fail-loud, journal. RETURNS jsonb {ok, nb_ententes, nb_equipes,
--    nb_membres, log_id}.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.appliquer_reconduction(
  p_saison_source uuid,
  p_saison_cible  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_dash_src   text;
  v_dash_cib   text;
  v_slash_src  text;
  v_slash_cib  text;
  v_date_debut date;
  v_att_ent    int;
  v_fait_ent   int;
  v_att_eq     int;
  v_fait_eq    int;
  v_att_j      int;
  v_fait_j     int;
  v_att_s      int;
  v_fait_s     int;
  v_reste      int;
  v_doublons   int;
  v_det_ent    jsonb;
  v_det_eq     jsonb;
  v_det_j      jsonb;
  v_det_s      jsonb;
  v_log_id     uuid;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF p_saison_source = p_saison_cible THEN
    RAISE EXCEPTION 'Saisons source et cible identiques.';
  END IF;

  SELECT s.code INTO v_slash_src FROM public.saisons s WHERE s.id = p_saison_source;
  IF v_slash_src IS NULL THEN
    RAISE EXCEPTION 'Saison source introuvable : %', p_saison_source;
  END IF;
  SELECT s.code, s.date_debut INTO v_slash_cib, v_date_debut
  FROM public.saisons s WHERE s.id = p_saison_cible;
  IF v_slash_cib IS NULL THEN
    RAISE EXCEPTION 'Saison cible introuvable : %', p_saison_cible;
  END IF;
  v_dash_src := replace(v_slash_src, '/', '-');
  v_dash_cib := replace(v_slash_cib, '/', '-');

  -- ---------------------------------------------------------------- ÉTAPE 1
  -- ENTENTES : création N+1 (copie + remillésimage code/slug/libelle_long).
  SELECT count(*)::int INTO v_att_ent
  FROM public.ententes e
  WHERE e.saison_id = p_saison_source
    AND NOT EXISTS (
      SELECT 1 FROM public.ententes x
      WHERE x.saison_id = p_saison_cible AND x.categorie_id = e.categorie_id
    );

  WITH ins AS (
    INSERT INTO public.ententes (
      code, slug, libelle_court, libelle_moyen, libelle_long,
      saison_id, categorie_id, club_principal_id, clubs_partenaires_ids,
      regime_actuel, date_mise_en_place, convention_ffr_url,
      date_signature_convention, date_fin_validite_convention,
      identifiant_sporteasy, competitions_engagees, notes
    )
    SELECT
      replace(replace(e.code, v_dash_src, v_dash_cib), v_slash_src, v_slash_cib),
      replace(replace(e.slug, v_dash_src, v_dash_cib), v_slash_src, v_slash_cib),
      e.libelle_court,
      e.libelle_moyen,
      replace(replace(e.libelle_long, v_dash_src, v_dash_cib), v_slash_src, v_slash_cib),
      p_saison_cible, e.categorie_id, e.club_principal_id, e.clubs_partenaires_ids,
      e.regime_actuel, e.date_mise_en_place, e.convention_ffr_url,
      e.date_signature_convention, e.date_fin_validite_convention,
      e.identifiant_sporteasy, e.competitions_engagees, e.notes
    FROM public.ententes e
    WHERE e.saison_id = p_saison_source
      AND NOT EXISTS (
        SELECT 1 FROM public.ententes x
        WHERE x.saison_id = p_saison_cible AND x.categorie_id = e.categorie_id
      )
    RETURNING id, code, categorie_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', ins.id, 'code', ins.code, 'categorie_id', ins.categorie_id)),
         '[]'::jsonb)
    INTO v_det_ent
  FROM ins;

  v_fait_ent := jsonb_array_length(v_det_ent);
  IF v_fait_ent <> v_att_ent THEN
    RAISE EXCEPTION 'Incohérence ententes : % créées vs % attendues.',
      v_fait_ent, v_att_ent;
  END IF;

  -- ---------------------------------------------------------------- ÉTAPE 2
  -- ÉQUIPES : re-rattachement + remillésimage du code (D1).
  SELECT count(*)::int INTO v_att_eq
  FROM public.equipes eq
  JOIN public.ententes e_src ON e_src.id = eq.entente_id
  WHERE e_src.saison_id = p_saison_source AND eq.statut = 'active';

  WITH upd AS (
    UPDATE public.equipes eq
       SET entente_id = e_cib.id,
           code = replace(replace(eq.code, v_dash_src, v_dash_cib),
                          v_slash_src, v_slash_cib),
           updated_at = now()
      FROM public.ententes e_src
      JOIN public.ententes e_cib
        ON e_cib.saison_id = p_saison_cible
       AND e_cib.categorie_id = e_src.categorie_id
     WHERE eq.entente_id = e_src.id
       AND e_src.saison_id = p_saison_source
       AND eq.statut = 'active'
    RETURNING eq.id, eq.code, e_cib.id AS entente_cible_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', upd.id, 'code', upd.code,
           'entente_cible_id', upd.entente_cible_id)),
         '[]'::jsonb)
    INTO v_det_eq
  FROM upd;

  v_fait_eq := jsonb_array_length(v_det_eq);
  IF v_fait_eq <> v_att_eq THEN
    RAISE EXCEPTION 'Incohérence équipes : % rebranchées vs % attendues.',
      v_fait_eq, v_att_eq;
  END IF;

  -- ---------------------------------------------------------------- ÉTAPE 3a
  -- COLLECTIF · joueurs dérivés de personnes (patron sql/55 + saison cible).
  SELECT count(*)::int INTO v_att_j
  FROM public.personnes p
  JOIN public.ententes e_cib
    ON e_cib.categorie_id = p.categorie_id AND e_cib.saison_id = p_saison_cible
  WHERE p.categorie_personne ILIKE '%joueur%'
    AND p.categorie_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.collectif_membre cm
      WHERE cm.personne_id = p.id AND cm.entente_id = e_cib.id
        AND cm.role = 'joueur' AND cm.date_fin IS NULL
    );

  WITH ins AS (
    INSERT INTO public.collectif_membre
      (personne_id, entente_id, role, statut, date_debut)
    SELECT p.id, e_cib.id, 'joueur', 'regulier', v_date_debut
    FROM public.personnes p
    JOIN public.ententes e_cib
      ON e_cib.categorie_id = p.categorie_id AND e_cib.saison_id = p_saison_cible
    WHERE p.categorie_personne ILIKE '%joueur%'
      AND p.categorie_id IS NOT NULL
      AND NOT EXISTS (                       -- GARDE 1 (patron sql/55)
        SELECT 1 FROM public.collectif_membre cm
        WHERE cm.personne_id = p.id AND cm.entente_id = e_cib.id
          AND cm.role = 'joueur' AND cm.date_fin IS NULL
      )
    ON CONFLICT ON CONSTRAINT collectif_membre_unique DO NOTHING  -- GARDE 2
    RETURNING entente_id
  ),
  g AS (
    SELECT ins.entente_id, count(*)::int AS n FROM ins GROUP BY ins.entente_id
  )
  SELECT coalesce(jsonb_object_agg(g.entente_id::text, g.n), '{}'::jsonb),
         coalesce(sum(g.n), 0)::int
    INTO v_det_j, v_fait_j
  FROM g;

  IF v_fait_j <> v_att_j THEN
    RAISE EXCEPTION 'Incohérence collectif joueurs : % insérés vs % attendus.',
      v_fait_j, v_att_j;
  END IF;

  -- ---------------------------------------------------------------- ÉTAPE 3b
  -- COLLECTIF · staff copié à l'identique (statut préservé, dédoublonné).
  SELECT count(*)::int INTO v_att_s
  FROM (
    SELECT DISTINCT cm.personne_id, e_cib.id
    FROM public.collectif_membre cm
    JOIN public.ententes e_src
      ON e_src.id = cm.entente_id AND e_src.saison_id = p_saison_source
    JOIN public.ententes e_cib
      ON e_cib.saison_id = p_saison_cible
     AND e_cib.categorie_id = e_src.categorie_id
    WHERE cm.role = 'staff' AND cm.date_fin IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.collectif_membre x
        WHERE x.personne_id = cm.personne_id AND x.entente_id = e_cib.id
          AND x.role = 'staff' AND x.date_fin IS NULL
      )
  ) t;

  WITH ins AS (
    INSERT INTO public.collectif_membre
      (personne_id, entente_id, role, statut, date_debut)
    SELECT DISTINCT ON (cm.personne_id, e_cib.id)
      cm.personne_id, e_cib.id, 'staff', cm.statut, v_date_debut
    FROM public.collectif_membre cm
    JOIN public.ententes e_src
      ON e_src.id = cm.entente_id AND e_src.saison_id = p_saison_source
    JOIN public.ententes e_cib
      ON e_cib.saison_id = p_saison_cible
     AND e_cib.categorie_id = e_src.categorie_id
    WHERE cm.role = 'staff' AND cm.date_fin IS NULL
      AND NOT EXISTS (                       -- GARDE 1
        SELECT 1 FROM public.collectif_membre x
        WHERE x.personne_id = cm.personne_id AND x.entente_id = e_cib.id
          AND x.role = 'staff' AND x.date_fin IS NULL
      )
    ORDER BY cm.personne_id, e_cib.id, cm.date_debut DESC
    ON CONFLICT ON CONSTRAINT collectif_membre_unique DO NOTHING  -- GARDE 2
    RETURNING entente_id
  ),
  g AS (
    SELECT ins.entente_id, count(*)::int AS n FROM ins GROUP BY ins.entente_id
  )
  SELECT coalesce(jsonb_object_agg(g.entente_id::text, g.n), '{}'::jsonb),
         coalesce(sum(g.n), 0)::int
    INTO v_det_s, v_fait_s
  FROM g;

  IF v_fait_s <> v_att_s THEN
    RAISE EXCEPTION 'Incohérence collectif staff : % insérés vs % attendus.',
      v_fait_s, v_att_s;
  END IF;

  -- ------------------------------------------------------------ IDEMPOTENCE
  IF (v_fait_ent + v_fait_eq + v_fait_j + v_fait_s) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'nb_ententes', 0, 'nb_equipes', 0,
      'nb_membres', 0, 'log_id', NULL,
      'message', 'Rien à reconduire pour ce couple de saisons.');
  END IF;

  -- -------------------------------------------------------- INVARIANTS POST
  -- Plus aucune équipe active accrochée à une entente de la saison source.
  SELECT count(*)::int INTO v_reste
  FROM public.equipes eq
  JOIN public.ententes e ON e.id = eq.entente_id
  WHERE e.saison_id = p_saison_source AND eq.statut = 'active';
  IF v_reste <> 0 THEN
    RAISE EXCEPTION 'Invariant POST violé : % équipe(s) active(s) encore sur la saison source.',
      v_reste;
  END IF;

  -- Zéro doublon actif (personne × entente cible × rôle).
  SELECT count(*)::int INTO v_doublons
  FROM (
    SELECT cm.personne_id
    FROM public.collectif_membre cm
    JOIN public.ententes e ON e.id = cm.entente_id
    WHERE e.saison_id = p_saison_cible AND cm.date_fin IS NULL
    GROUP BY cm.personne_id, cm.entente_id, cm.role
    HAVING count(*) > 1
  ) d;
  IF v_doublons <> 0 THEN
    RAISE EXCEPTION 'Invariant POST violé : % doublon(s) actif(s) sur la saison cible.',
      v_doublons;
  END IF;

  -- ----------------------------------------------------------------- JOURNAL
  INSERT INTO public.reconduction_log
    (saison_source_id, saison_cible_id, applique_par,
     nb_ententes, nb_equipes, nb_membres, detail)
  VALUES
    (p_saison_source, p_saison_cible, auth.uid()::text,
     v_fait_ent, v_fait_eq, v_fait_j + v_fait_s,
     jsonb_build_object(
       'ententes_creees',       v_det_ent,
       'equipes_rebranchees',   v_det_eq,
       'membres_par_entente',   jsonb_build_object('joueurs', v_det_j,
                                                   'staff',   v_det_s),
       'date_debut_collectif',  v_date_debut))
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('ok', true,
    'nb_ententes', v_fait_ent,
    'nb_equipes',  v_fait_eq,
    'nb_membres',  v_fait_j + v_fait_s,
    'log_id',      v_log_id);
END;
$func$;

-- ----------------------------------------------------------------------------
-- 5) GRANTS — apercu/appliquer exposées (garde has_role à l'intérieur) ;
--    _derive_reconduction REVOQUÉE du client (patron sql/53 §7).
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._derive_reconduction(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._derive_reconduction(uuid, uuid)
  FROM authenticated, anon;

REVOKE ALL ON FUNCTION public.apercu_reconduction(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apercu_reconduction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apercu_reconduction(uuid, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.appliquer_reconduction(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appliquer_reconduction(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.appliquer_reconduction(uuid, uuid)
  TO authenticated;

-- ----------------------------------------------------------------------------
-- 6) VÉRIFICATION FAIL-LOUD (état-cible). RAISE si une pièce manque.
--    (Affectations v := (select …) — contrainte SQL Editor, leçon projet.)
-- ----------------------------------------------------------------------------
DO $verif$
DECLARE
  v_table  int;
  v_policy int;
  v_secdef int;
  v_derive int;
BEGIN
  v_table := (SELECT count(*) FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_name = 'reconduction_log');
  IF v_table <> 1 THEN
    RAISE EXCEPTION 'Vérif KO : table reconduction_log absente.';
  END IF;

  v_policy := (SELECT count(*) FROM pg_policies
               WHERE schemaname = 'public'
                 AND tablename = 'reconduction_log' AND cmd = 'SELECT');
  IF v_policy <> 1 THEN
    RAISE EXCEPTION 'Vérif KO : policy SELECT reconduction_log absente.';
  END IF;

  v_secdef := (SELECT count(*) FROM pg_proc
               WHERE proname IN ('_derive_reconduction',
                                 'apercu_reconduction',
                                 'appliquer_reconduction')
                 AND pronamespace = 'public'::regnamespace
                 AND prosecdef = true);
  IF v_secdef <> 3 THEN
    RAISE EXCEPTION 'Vérif KO : % fonction(s) SECURITY DEFINER sur 3 attendues.',
      v_secdef;
  END IF;

  v_derive := (SELECT count(*) FROM pg_proc
               WHERE proname = '_derive_reconduction'
                 AND pronamespace = 'public'::regnamespace);
  IF v_derive <> 1 THEN
    RAISE EXCEPTION 'Vérif KO : _derive_reconduction absente.';
  END IF;
  IF has_function_privilege('authenticated',
       'public._derive_reconduction(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Vérif KO : _derive_reconduction encore exécutable par authenticated.';
  END IF;

  RAISE NOTICE 'sql_141 OK : reconduction_log + 1 policy + 3 fonctions SECURITY DEFINER + _derive REVOQUÉE.';
END;
$verif$;

COMMIT;

-- ============================================================================
-- EXPLOITATION (recoller les sorties) — à exécuter APRÈS le COMMIT.
-- UUID live sondés le 01/07/2026 (E3) :
--   source 2025/2026 = 73645edf-d367-421a-b3e1-9f0712d4a48b
--   cible  2026/2027 = 0fe81033-fd60-471d-ba5d-644458f4cdd3
-- ============================================================================
-- 1) APERÇU (lecture seule, rien n'est écrit) — attendu : 11 a_creer,
--    13 a_rebrancher, ~290 a_amorcer (l'aperçu fait foi), sans_entente_cible
--    = catégories sans entente (attendu, ex-F18) :
-- SELECT volet, groupe, count(*) AS n
-- FROM public.apercu_reconduction(
--   '73645edf-d367-421a-b3e1-9f0712d4a48b',
--   '0fe81033-fd60-471d-ba5d-644458f4cdd3')
-- GROUP BY volet, groupe ORDER BY volet, groupe;
--
-- 2) APPLICATION (le geste, une transaction) :
-- SELECT public.appliquer_reconduction(
--   '73645edf-d367-421a-b3e1-9f0712d4a48b',
--   '0fe81033-fd60-471d-ba5d-644458f4cdd3');
--
-- 3) RECETTE — re-run de l'aperçu : tout doit être en deja_* (idempotence) ;
--    puis contrôle applicatif : listEquipes non vide, vivier compo non vide.
-- ============================================================================
