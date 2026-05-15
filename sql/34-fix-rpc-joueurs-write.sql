-- =============================================================================
-- sql/34-fix-rpc-joueurs-write.sql
-- =============================================================================
-- MOM Hub · Phase 5.14 · S1.b · Module Joueurs (FIX RPC ÉCRITURE)
-- Version       : v1.1 (15 mai 2026, fix v1.0)
-- Auteur conv   : Production · Module Joueurs (Phase 5.14)
-- Référence     : sql/34-rpc-joueurs-write.sql v1.0 (autorisation trop stricte)
-- =============================================================================
--
-- OBJET DU FIX
--   La version v1.0 de sql/34 rejette l'exécution depuis Supabase SQL Editor
--   parce que :
--     - current_user / session_user = 'postgres' (superuser DB)
--     - auth.uid() = NULL (pas de JWT, exécution directe)
--     - public.has_role('admin'/'coach') = false sans auth.uid()
--
--   Résultat : impossible de smoke-tester la RPC depuis Studio, alors que
--   c'est précisément le canal de test SQL pur.
--
-- CHANGEMENT v1.0 → v1.1
--   Ajout d'une 3e clause d'autorisation pour le superuser DB :
--
--     Autorisation = has_role('admin') OR has_role('coach')          [prod via JWT]
--                 OR session_user IN ('postgres', 'supabase_admin')  [dev Studio]
--
-- JUSTIFICATION DOCTRINALE
--   Un superuser DB peut déjà tout faire sur la base (DROP TABLE, ALTER
--   POLICY, etc.). Lui autoriser cette RPC ne change rien à sa surface
--   d'attaque, c'est uniquement un confort dev/test pour le SQL Editor.
--
--   La production (PostgREST + JWT user authenticated) n'est PAS affectée :
--     - PostgREST se connecte en rôle 'authenticator' puis SET ROLE selon JWT
--     - session_user vaut alors 'authenticator', PAS 'postgres'
--     - Le check has_role/auth.uid s'applique normalement
--
-- IDEMPOTENCE
--   CREATE OR REPLACE : signature inchangée par rapport à v1.0, pas besoin de
--   DROP préalable.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_joueur_metier(
  p_personne_id UUID,
  p_patch       JSONB
)
RETURNS SETOF public.personnes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_postes      UUID[];
  v_aptitudes   UUID[];
  v_has_role    BOOLEAN := FALSE;
BEGIN
  -- -------------------------------------------------------------------------
  -- 0. Vérification d'autorisation (3 clauses)
  -- -------------------------------------------------------------------------

  -- Clause 1+2 : rôle Hub (admin/coach) via has_role() — chemin nominal prod
  BEGIN
    SELECT public.has_role('admin') OR public.has_role('coach')
      INTO v_has_role;
  EXCEPTION WHEN undefined_function THEN
    -- Fallback : utilisateur authentifié uniquement
    v_has_role := (auth.uid() IS NOT NULL);
  END;

  -- Clause 3 (v1.1) : bypass superuser DB pour tests Studio SQL Editor
  IF NOT v_has_role THEN
    v_has_role := session_user IN ('postgres', 'supabase_admin');
  END IF;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Droit insuffisant : seuls admin, coach et superuser DB peuvent modifier les champs métier joueur'
      USING ERRCODE = '42501';
  END IF;

  -- -------------------------------------------------------------------------
  -- 1. Validation entrée
  -- -------------------------------------------------------------------------

  IF p_personne_id IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'p_patch doit être un objet JSON' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM personnes WHERE id = p_personne_id) THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. Extraction des arrays UUIDs si présents dans le patch
  -- -------------------------------------------------------------------------

  IF p_patch ? 'postes_uuids' THEN
    IF jsonb_typeof(p_patch->'postes_uuids') <> 'array' THEN
      RAISE EXCEPTION 'postes_uuids doit être un tableau' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value::UUID), '{}'::UUID[])
      INTO v_postes
    FROM jsonb_array_elements_text(p_patch->'postes_uuids');
  END IF;

  IF p_patch ? 'aptitudes_uuids' THEN
    IF jsonb_typeof(p_patch->'aptitudes_uuids') <> 'array' THEN
      RAISE EXCEPTION 'aptitudes_uuids doit être un tableau' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value::UUID), '{}'::UUID[])
      INTO v_aptitudes
    FROM jsonb_array_elements_text(p_patch->'aptitudes_uuids');
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. UPDATE avec CASE WHEN pour partial-update (identique v1.0)
  -- -------------------------------------------------------------------------

  UPDATE personnes SET
    postes_uuids = CASE
      WHEN p_patch ? 'postes_uuids' THEN v_postes
      ELSE postes_uuids
    END,

    aptitudes_uuids = CASE
      WHEN p_patch ? 'aptitudes_uuids' THEN v_aptitudes
      ELSE aptitudes_uuids
    END,

    taille_cm = CASE
      WHEN p_patch ? 'taille_cm' THEN
        CASE
          WHEN p_patch->>'taille_cm' IS NULL OR p_patch->>'taille_cm' = '' THEN NULL
          ELSE (p_patch->>'taille_cm')::SMALLINT
        END
      ELSE taille_cm
    END,

    poids_g = CASE
      WHEN p_patch ? 'poids_g' THEN
        CASE
          WHEN p_patch->>'poids_g' IS NULL OR p_patch->>'poids_g' = '' THEN NULL
          ELSE (p_patch->>'poids_g')::INTEGER
        END
      ELSE poids_g
    END,

    notes_coach = CASE
      WHEN p_patch ? 'notes_coach' THEN NULLIF(trim(p_patch->>'notes_coach'), '')
      ELSE notes_coach
    END,

    indisponibilite = CASE
      WHEN p_patch ? 'indisponibilite' THEN NULLIF(trim(p_patch->>'indisponibilite'), '')
      ELSE indisponibilite
    END,

    blessure_resume = CASE
      WHEN p_patch ? 'blessure_resume' THEN NULLIF(trim(p_patch->>'blessure_resume'), '')
      ELSE blessure_resume
    END,

    suspension_jusqu_au = CASE
      WHEN p_patch ? 'suspension_jusqu_au' THEN
        CASE
          WHEN p_patch->>'suspension_jusqu_au' IS NULL OR p_patch->>'suspension_jusqu_au' = '' THEN NULL
          ELSE (p_patch->>'suspension_jusqu_au')::DATE
        END
      ELSE suspension_jusqu_au
    END,

    modifie_par = 'module-joueurs',
    updated_at  = NOW()

  WHERE id = p_personne_id;

  -- -------------------------------------------------------------------------
  -- 4. Retour de la fiche mise à jour
  -- -------------------------------------------------------------------------

  RETURN QUERY
    SELECT * FROM personnes WHERE id = p_personne_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_joueur_metier(UUID, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_joueur_metier(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.update_joueur_metier(UUID, JSONB) IS
'C10-J-j v1.1 : Patch metier d''une fiche joueur (audit §C10-J). Whitelist 8 champs. '
'Autorisation : has_role(admin) OR has_role(coach) OR session_user superuser DB '
'(pour tests Studio). Production sécurisée via PostgREST + JWT (session_user = '
'authenticator, jamais postgres). Normalisation TEXT (trim+nullif). '
'Retourne shape personnes brut.';

COMMIT;

-- =============================================================================
-- Vérifications post-fix (identiques v1.0 mais devraient maintenant passer)
-- =============================================================================

-- A) Vérifier la mise à jour de la fonction :
--    SELECT proname, pg_get_functiondef(oid)
--    FROM pg_proc WHERE proname = 'update_joueur_metier';
--    -> doit montrer la nouvelle clause "session_user IN ('postgres'...)"

-- B) Test patch partiel sur Léandre BERNHART :
--    SELECT nom, prenom, indisponibilite, taille_cm, poids_g, updated_at
--    FROM public.update_joueur_metier(
--      (SELECT id FROM personnes WHERE nom='BERNHART' AND prenom='Leandre' LIMIT 1),
--      '{"indisponibilite":"Test sql/34","taille_cm":157,"poids_g":42800}'::JSONB
--    );
--    -> doit retourner 1 ligne avec indisponibilite='Test sql/34', taille=157, poids=42800
-- =============================================================================
