-- =====================================================================
-- MOM HUB · sql/30-rpc-evenements-c9-fix.sql
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-15 (après-midi, conv Joueurs/Évènements S2.2)
-- Version : 1.0
--
-- ─────────────────────────────────────────────────────────────────────
-- Contexte
-- ─────────────────────────────────────────────────────────────────────
-- Bug identifié visuellement en S2.2 : les 6 matchs enfants du tournoi
-- Challenge Vié (créés via SQL de test) remontent dans la liste comme
-- des cartes racines, gonflant le compteur "À venir" à 21 au lieu de 15
-- attendus. Cause : les RPC get_evenements_a_venir et get_evenements_passes
-- (sql/29) ne retournent PAS la colonne evenement_parent_id, rendant
-- impossible la distinction racines / enfants côté client.
--
-- Le filtre JS `!evt.evenement_parent_id` retourne true partout (undefined
-- est falsy) → tous les events sont considérés comme racines.
--
-- ─────────────────────────────────────────────────────────────────────
-- Correctif
-- ─────────────────────────────────────────────────────────────────────
-- Ajout de la colonne evenement_parent_id UUID au RETURNS TABLE des 2 RPC
-- - get_evenements_a_venir       : 17 → 18 colonnes
-- - get_evenements_passes        : 17 → 18 colonnes
-- - get_prochain_evenement_par_equipe : hérite via SELECT *, recréée
--
-- get_evenement_with_encadrants  : NON modifiée, retourne déjà
-- evenement_parent_id (colonne 16 du RETURNS TABLE, cf. sql/29).
--
-- ─────────────────────────────────────────────────────────────────────
-- Ordre DROP / CREATE
-- ─────────────────────────────────────────────────────────────────────
-- get_prochain_evenement_par_equipe appelle get_evenements_a_venir
-- dans son corps → DROP wrapper d'abord, puis fonction de base.
-- Ordre identique à sql/29.
--
-- ─────────────────────────────────────────────────────────────────────
-- Sécurité
-- ─────────────────────────────────────────────────────────────────────
-- Identique aux RPC sql/29 : LANGUAGE sql, SECURITY DEFINER,
-- search_path=public, STABLE, REVOKE PUBLIC/anon, GRANT authenticated.
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : oui (DROP IF EXISTS au début).
-- =====================================================================

BEGIN;

-- =====================================================================
-- 0 · DROP des RPC à recréer (ordre dépendance respecté)
-- =====================================================================

DROP FUNCTION IF EXISTS public.get_prochain_evenement_par_equipe(UUID);
DROP FUNCTION IF EXISTS public.get_evenements_a_venir(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_evenements_passes(UUID, INTEGER, INTEGER);


-- =====================================================================
-- 1 · get_evenements_a_venir (MODIFIÉE — ajout evenement_parent_id)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_evenements_a_venir(
  p_equipe_id     UUID    DEFAULT NULL,
  p_jours_a_venir INTEGER DEFAULT 30
)
RETURNS TABLE (
  id                       UUID,
  code                     TEXT,
  libelle                  TEXT,
  type_evenement           TEXT,
  type_competition         TEXT,
  date_debut               TIMESTAMPTZ,
  date_fin                 TIMESTAMPTZ,
  equipe_id                UUID,
  equipe_libelle_court     TEXT,
  site_id                  UUID,
  site_libelle_court       TEXT,
  format_de_jeu            TEXT,
  etat                     TEXT,
  adversaire_nom           TEXT,
  domicile_exterieur       TEXT,
  evenement_parent_id      UUID,
  jours_jusqu_a_evenement  INTEGER,
  compo_status_summary     JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.id,
    e.code,
    e.libelle,
    e.type_evenement,
    e.type_competition,
    e.date_debut,
    e.date_fin,
    e.equipe_id,
    eq.libelle_court AS equipe_libelle_court,
    e.site_id,
    si.libelle_court AS site_libelle_court,
    e.format_de_jeu,
    e.etat,
    e.adversaire_nom,
    e.domicile_exterieur,
    e.evenement_parent_id,
    EXTRACT(DAY FROM (e.date_debut - NOW()))::INTEGER AS jours_jusqu_a_evenement,
    (
      SELECT jsonb_build_object(
        'total',     COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat = 'brouillon'),
        'validee',   COUNT(*) FILTER (WHERE c.etat = 'validee'),
        'utilisee',  COUNT(*) FILTER (WHERE c.etat = 'utilisee')
      )
      FROM compositions c
      WHERE c.evenement_id = e.id
        AND c.cote        = 'mom'
        AND c.est_active  = TRUE
    ) AS compo_status_summary
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.date_debut >= NOW()
    AND e.date_debut <= NOW() + make_interval(days => p_jours_a_venir)
    AND e.etat NOT IN ('annule', 'archive')
    AND (p_equipe_id IS NULL OR e.equipe_id = p_equipe_id)
  ORDER BY e.date_debut ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_evenements_a_venir(UUID, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_evenements_a_venir(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_evenements_a_venir(UUID, INTEGER) IS
'Phase 4.2.B + C9-d + S2.2-fix — Liste événements à venir, filtrable par équipe. 18 colonnes (ajout evenement_parent_id pour distinction racines/enfants côté client). Exclut annule/archive.';


-- =====================================================================
-- 2 · get_prochain_evenement_par_equipe (RECRÉÉE — nouvelle signature)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_prochain_evenement_par_equipe(
  p_equipe_id UUID
)
RETURNS TABLE (
  id                       UUID,
  code                     TEXT,
  libelle                  TEXT,
  type_evenement           TEXT,
  type_competition         TEXT,
  date_debut               TIMESTAMPTZ,
  date_fin                 TIMESTAMPTZ,
  equipe_id                UUID,
  equipe_libelle_court     TEXT,
  site_id                  UUID,
  site_libelle_court       TEXT,
  format_de_jeu            TEXT,
  etat                     TEXT,
  adversaire_nom           TEXT,
  domicile_exterieur       TEXT,
  evenement_parent_id      UUID,
  jours_jusqu_a_evenement  INTEGER,
  compo_status_summary     JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.get_evenements_a_venir(p_equipe_id, 365) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_prochain_evenement_par_equipe(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_prochain_evenement_par_equipe(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_prochain_evenement_par_equipe(UUID) IS
'Phase 4.2.B + C9-d + S2.2-fix — Prochain événement (0 ou 1 ligne). 18 colonnes héritées via SELECT *.';


-- =====================================================================
-- 3 · get_evenements_passes (MODIFIÉE — ajout evenement_parent_id)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_evenements_passes(
  p_equipe_id    UUID    DEFAULT NULL,
  p_jours_passes INTEGER DEFAULT 30,
  p_limit        INTEGER DEFAULT 50
)
RETURNS TABLE (
  id                       UUID,
  code                     TEXT,
  libelle                  TEXT,
  type_evenement           TEXT,
  type_competition         TEXT,
  date_debut               TIMESTAMPTZ,
  date_fin                 TIMESTAMPTZ,
  equipe_id                UUID,
  equipe_libelle_court     TEXT,
  site_id                  UUID,
  site_libelle_court       TEXT,
  format_de_jeu            TEXT,
  etat                     TEXT,
  adversaire_nom           TEXT,
  domicile_exterieur       TEXT,
  evenement_parent_id      UUID,
  jours_depuis_evenement   INTEGER,
  compo_status_summary     JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.id,
    e.code,
    e.libelle,
    e.type_evenement,
    e.type_competition,
    e.date_debut,
    e.date_fin,
    e.equipe_id,
    eq.libelle_court AS equipe_libelle_court,
    e.site_id,
    si.libelle_court AS site_libelle_court,
    e.format_de_jeu,
    e.etat,
    e.adversaire_nom,
    e.domicile_exterieur,
    e.evenement_parent_id,
    EXTRACT(DAY FROM (NOW() - e.date_debut))::INTEGER AS jours_depuis_evenement,
    (
      SELECT jsonb_build_object(
        'total',     COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat = 'brouillon'),
        'validee',   COUNT(*) FILTER (WHERE c.etat = 'validee'),
        'utilisee',  COUNT(*) FILTER (WHERE c.etat = 'utilisee')
      )
      FROM compositions c
      WHERE c.evenement_id = e.id
        AND c.cote        = 'mom'
        AND c.est_active  = TRUE
    ) AS compo_status_summary
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.date_debut <  NOW()
    AND e.date_debut >= NOW() - make_interval(days => p_jours_passes)
    AND e.etat NOT IN ('archive')
    AND (p_equipe_id IS NULL OR e.equipe_id = p_equipe_id)
  ORDER BY e.date_debut DESC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.get_evenements_passes(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_evenements_passes(UUID, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_evenements_passes(UUID, INTEGER, INTEGER) IS
'C9-a + S2.2-fix — Liste événements passés. 18 colonnes (ajout evenement_parent_id). Inclut annule, exclut archive. ORDER BY date_debut DESC.';


-- =====================================================================
-- Vérification structurelle
-- =====================================================================

DO $$
DECLARE
  v_avenir_cols     INTEGER;
  v_passes_cols     INTEGER;
  v_prochain_cols   INTEGER;
BEGIN
  SELECT (LENGTH(pg_get_function_result(oid)) -
          LENGTH(REPLACE(pg_get_function_result(oid), ',', '')) + 1)
    INTO v_avenir_cols
  FROM pg_proc WHERE proname = 'get_evenements_a_venir' LIMIT 1;

  SELECT (LENGTH(pg_get_function_result(oid)) -
          LENGTH(REPLACE(pg_get_function_result(oid), ',', '')) + 1)
    INTO v_passes_cols
  FROM pg_proc WHERE proname = 'get_evenements_passes' LIMIT 1;

  SELECT (LENGTH(pg_get_function_result(oid)) -
          LENGTH(REPLACE(pg_get_function_result(oid), ',', '')) + 1)
    INTO v_prochain_cols
  FROM pg_proc WHERE proname = 'get_prochain_evenement_par_equipe' LIMIT 1;

  RAISE NOTICE '────────────────────────────────────────────────────────';
  RAISE NOTICE '✅ S2.2-fix — sql/30';
  RAISE NOTICE '   get_evenements_a_venir cols : % (attendu 18)', v_avenir_cols;
  RAISE NOTICE '   get_evenements_passes  cols : % (attendu 18)', v_passes_cols;
  RAISE NOTICE '   get_prochain_event_par_eq   : % (attendu 18)', v_prochain_cols;
  RAISE NOTICE '────────────────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- Smoke test rapide post-déploiement
-- =====================================================================
--
-- Pour vérifier que la nouvelle colonne remonte bien :
--
--   SELECT code, libelle, evenement_parent_id
--   FROM get_evenements_a_venir('bfb83b83-83ef-4dde-b526-48ff87313044'::UUID, 90)
--   WHERE evenement_parent_id IS NOT NULL
--   ORDER BY date_debut;
--
-- Attendu : 6 lignes (les 6 matchs enfants du Challenge Vié, tous avec
-- evenement_parent_id = 'd9b2056d-6d56-413a-93bf-e1d1cf5d6b3a').
-- =====================================================================
