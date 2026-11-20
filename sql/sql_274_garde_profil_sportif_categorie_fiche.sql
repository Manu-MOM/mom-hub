-- =====================================================================
-- sql_274 — Correctif garde update_joueur_metier (profil sportif)
-- Retour terrain Lohann HUMBERT (20/11/2026) : « Échec : Droit insuffisant »
-- en modifiant le profil sportif d'un senior (ex. Ciprian ANDREI, SR-M).
--
-- Cause : la garde ne déduisait la catégorie du joueur QUE via la chaîne
-- héritée equipe_joueurs -> equipes -> ententes. Cette table n'est alimentée
-- que pour une partie des M14 : 0 rattachement pour SR-M (71), SR-F (51),
-- M16 (71), M19 (18). Hors admin/bureau, personne ne pouvait donc écrire
-- ces fiches (profil sportif ET modale État, même RPC).
--
-- Correctif : la garde lit d'abord personnes.categorie_id (source de vérité,
-- même patron que sql_253), puis conserve la chaîne héritée en repli
-- (additif strict, aucune régression). Matrice capabilities_fonction et
-- puis_je_faire inchangées. Même signature -> CREATE OR REPLACE sans
-- surcharge (pas de PGRST203).
--
-- Dry-run 20/11/2026 (session Lohann simulée, ROLLBACK) :
--   SR-M / SR-F / M10 : garde actuelle false -> corrigée true
--   M14               : true -> true (pas de régression)
--   M16 (hors pôles de Lohann) : false -> false (pas de fuite)
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_joueur_metier(p_personne_id uuid, p_patch jsonb)
 RETURNS SETOF personnes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_postes    TEXT[];
  v_aptitudes TEXT[];
  v_has_role  BOOLEAN := FALSE;
  v_cat_id    UUID;
BEGIN
  BEGIN
    v_has_role := public.has_role('admin') OR public.has_role('bureau');
    -- sql_274 : catégorie de la fiche (personnes.categorie_id), source de
    -- vérité, comme les RPC récentes (sql_253). Avant : seule la chaîne
    -- héritée equipe_joueurs, vide pour SR-M/SR-F/M16/M19 -> 42501.
    IF NOT v_has_role THEN
      SELECT p.categorie_id INTO v_cat_id
      FROM public.personnes p WHERE p.id = p_personne_id;
      v_has_role := v_cat_id IS NOT NULL
                    AND public.puis_je_faire('ecrire_joueur', v_cat_id);
    END IF;
    -- Chaîne héritée conservée (additif, aucune régression M14 / partenaires).
    IF NOT v_has_role THEN
      v_has_role := EXISTS (
        SELECT 1
        FROM public.equipe_joueurs ej
        JOIN public.equipes e   ON e.id = ej.equipe_id
        JOIN public.ententes en ON en.id = e.entente_id
        WHERE ej.personne_id = p_personne_id
          AND public.puis_je_faire('ecrire_joueur', en.categorie_id)
      );
    END IF;
  EXCEPTION WHEN undefined_function THEN
    v_has_role := (auth.uid() IS NOT NULL);
  END;
  IF NOT v_has_role THEN
    v_has_role := session_user IN ('postgres', 'supabase_admin');
  END IF;
  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;

  IF p_personne_id IS NULL THEN RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023'; END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'p_patch doit être un objet JSON' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM personnes WHERE id = p_personne_id) THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;

  IF p_patch ? 'postes_uuids' THEN
    IF jsonb_typeof(p_patch->'postes_uuids') <> 'array' THEN
      RAISE EXCEPTION 'postes_uuids doit être un tableau' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value #>> '{}'), '{}'::TEXT[])
      INTO v_postes
    FROM jsonb_array_elements(p_patch->'postes_uuids');
  END IF;

  IF p_patch ? 'aptitudes_uuids' THEN
    IF jsonb_typeof(p_patch->'aptitudes_uuids') <> 'array' THEN
      RAISE EXCEPTION 'aptitudes_uuids doit être un tableau' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value #>> '{}'), '{}'::TEXT[])
      INTO v_aptitudes
    FROM jsonb_array_elements(p_patch->'aptitudes_uuids');
  END IF;

  UPDATE personnes SET
    postes_uuids = CASE WHEN p_patch ? 'postes_uuids' THEN v_postes ELSE postes_uuids END,
    aptitudes_uuids = CASE WHEN p_patch ? 'aptitudes_uuids' THEN v_aptitudes ELSE aptitudes_uuids END,
    taille_cm = CASE WHEN p_patch ? 'taille_cm' THEN
      CASE WHEN p_patch->>'taille_cm' IS NULL OR p_patch->>'taille_cm' = '' THEN NULL ELSE (p_patch->>'taille_cm')::SMALLINT END
      ELSE taille_cm END,
    poids_g = CASE WHEN p_patch ? 'poids_g' THEN
      CASE WHEN p_patch->>'poids_g' IS NULL OR p_patch->>'poids_g' = '' THEN NULL ELSE (p_patch->>'poids_g')::INTEGER END
      ELSE poids_g END,
    potentiel_jeu = CASE WHEN p_patch ? 'potentiel_jeu' THEN NULLIF(trim(p_patch->>'potentiel_jeu'), '') ELSE potentiel_jeu END,
    notes_coach = CASE WHEN p_patch ? 'notes_coach' THEN NULLIF(trim(p_patch->>'notes_coach'), '') ELSE notes_coach END,
    indisponibilite = CASE WHEN p_patch ? 'indisponibilite' THEN NULLIF(trim(p_patch->>'indisponibilite'), '') ELSE indisponibilite END,
    blessure_resume = CASE WHEN p_patch ? 'blessure_resume' THEN NULLIF(trim(p_patch->>'blessure_resume'), '') ELSE blessure_resume END,
    suspension_jusqu_au = CASE WHEN p_patch ? 'suspension_jusqu_au' THEN
      CASE WHEN p_patch->>'suspension_jusqu_au' IS NULL OR p_patch->>'suspension_jusqu_au' = '' THEN NULL ELSE (p_patch->>'suspension_jusqu_au')::DATE END
      ELSE suspension_jusqu_au END,
    suspension_notes = CASE WHEN p_patch ? 'suspension_notes' THEN NULLIF(trim(p_patch->>'suspension_notes'), '') ELSE suspension_notes END,
    modifie_par = 'module-joueurs',
    updated_at = NOW()
  WHERE id = p_personne_id;

  RETURN QUERY SELECT * FROM personnes WHERE id = p_personne_id;
END;
$function$;

DO $verif$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'update_joueur_metier') <> 1 THEN
    RAISE EXCEPTION 'FAIL: surcharge update_joueur_metier';
  END IF;
  IF position('sql_274' IN pg_get_functiondef('public.update_joueur_metier(uuid,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'FAIL: correctif absent';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.update_joueur_metier(uuid,jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'FAIL: SECURITY DEFINER perdu';
  END IF;
  RAISE NOTICE 'sql_274 OK';
END
$verif$;

COMMIT;
