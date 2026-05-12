-- =====================================================================
-- MOM HUB · PHASE 4.2.B · RPC ÉVÉNEMENTS
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-13
-- Version : 1.0
--
-- Crée 2 RPC SECURITY DEFINER sur les tables Phase 4.2.A :
--   1. get_evenements_a_venir(p_equipe_id, p_jours_a_venir)
--      → liste des événements à venir, filtrable par équipe.
--      Débloque P4-2 (greeting "J-N AVANT MATCH").
--
--   2. get_prochain_evenement_par_equipe(p_equipe_id)
--      → 1 seul événement (le prochain), simple wrapper de la 1re sur 365j LIMIT 1.
--      Débloque P4-3 (widget sidebar "prochain match").
--
-- Sécurité : SECURITY DEFINER, search_path = public, STABLE.
--           Exécution restreinte à `authenticated` (pas `anon`), cohérent
--           avec le pattern des 5 RPC de sql/05-rpc-portail.sql et de la
--           RPC count_equipes_actives de sql/09-rpc-equipes.sql.
--
-- Conventions :
--   - Paramètres préfixés `p_` (évite ambiguïté avec colonnes equipe_id).
--   - p_equipe_id NULL = toutes équipes (cas portail global).
--   - Filtre par défaut : 30 jours à venir.
--   - Exclut les états 'annule' et 'archive'.
--   - Filtre `date_debut >= NOW()` (passé exclu).
--
-- Idempotent : oui (CREATE OR REPLACE).
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================


-- =====================================================================
-- RPC 1 : get_evenements_a_venir
-- =====================================================================
-- Liste des événements à venir dans une fenêtre temporelle.
--
-- Paramètres :
--   p_equipe_id      UUID   (default NULL) — filtre sur une équipe, NULL = toutes
--   p_jours_a_venir  INT    (default 30)   — fenêtre temporelle en jours
--
-- Retour : 16 colonnes (event + libellés joints équipe/site + delta jours).
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
  jours_jusqu_a_evenement  INTEGER
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
    eq.libelle_court  AS equipe_libelle_court,
    e.site_id,
    si.libelle_court  AS site_libelle_court,
    e.format_de_jeu,
    e.etat,
    e.adversaire_nom,
    e.domicile_exterieur,
    EXTRACT(DAY FROM (e.date_debut - NOW()))::INTEGER AS jours_jusqu_a_evenement
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
'Phase 4.2.B — Liste des événements à venir, filtrable par équipe. Exclut annule/archive. Débloque P4-2 (greeting J-N).';


-- =====================================================================
-- RPC 2 : get_prochain_evenement_par_equipe
-- =====================================================================
-- Le prochain événement d'une équipe donnée (0 ou 1 ligne).
-- Simple wrapper de get_evenements_a_venir avec fenêtre 365 jours LIMIT 1.
--
-- Paramètres :
--   p_equipe_id  UUID  (obligatoire) — l'équipe cible
--
-- Retour : 0 ou 1 ligne (mêmes colonnes que get_evenements_a_venir).
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
  jours_jusqu_a_evenement  INTEGER
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
'Phase 4.2.B — Prochain événement d''une équipe (0 ou 1 ligne). Wrapper de get_evenements_a_venir(p_equipe_id, 365) LIMIT 1. Débloque P4-3 (widget sidebar).';


-- =====================================================================
-- Vérifications post-création
-- =====================================================================

SELECT
  (SELECT COUNT(*) FROM pg_proc
     WHERE proname IN ('get_evenements_a_venir', 'get_prochain_evenement_par_equipe'))
    AS nb_rpc_creees,
  (SELECT pg_get_function_result(oid) FROM pg_proc
     WHERE proname = 'get_evenements_a_venir' LIMIT 1)
    AS signature_rpc1,
  (SELECT pg_get_function_result(oid) FROM pg_proc
     WHERE proname = 'get_prochain_evenement_par_equipe' LIMIT 1)
    AS signature_rpc2;
