-- ============================================================================
-- MOM Hub · Phase 4.1.A bis · RPC compteur ÉQUIPES (K2 du portail)
-- ============================================================================
-- Objectif : exposer aux pages du Hub le nombre d'équipes actives, pour
-- débrancher le "11" en dur du KPI K2 (dette #5 du STATE.md, partie ÉQUIPES).
--
-- Cohérent avec le pattern des 5 RPC de 05-rpc-portail.sql (SECURITY DEFINER,
-- authenticated-only, retour scalaire agrégé RGPD-safe).
--
-- À exécuter dans le SQL editor Supabase (projet mom-hub).
-- Idempotent : CREATE OR REPLACE.
-- Aucune donnée perso : ce fichier peut être commit dans le repo public.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- count_equipes_actives() — K2 ÉQUIPES du portail
-- ----------------------------------------------------------------------------
-- Retourne le nombre d'équipes au statut 'active' dans la table equipes.
-- Au démarrage Phase 4.1.A (13 mai 2026) : 11 équipes (3 ententes
-- SAR/MOM/ASCS M14/M16/M19 + 8 mono_club MOM).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.count_equipes_actives()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM equipes WHERE statut = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.count_equipes_actives() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.count_equipes_actives() TO authenticated;

COMMENT ON FUNCTION public.count_equipes_actives() IS
'K2 ÉQUIPES du portail (dette #5 STATE.md). Retourne le nombre d''équipes au statut "active". RGPD-safe : agrégat seul.';


-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement après le script)
-- ============================================================================

-- A) Vérifier la création :
--    SELECT proname, pg_get_function_result(oid)
--    FROM pg_proc
--    WHERE proname = 'count_equipes_actives';
--    -> doit retourner 1 ligne.

-- B) Tester en tant qu'utilisateur authenticated :
--    SELECT public.count_equipes_actives();
--    -> doit retourner 11 (au 13 mai 2026, après Phase 4.1.A).

-- C) Vérifier que anon NE PEUT PAS l'exécuter :
--    SET ROLE anon;
--    SELECT public.count_equipes_actives();
--    -> doit lever "permission denied for function count_equipes_actives".
--    RESET ROLE;
-- ============================================================================
