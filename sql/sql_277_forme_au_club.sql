-- =====================================================================
-- sql_277 — FORME-AU-MOM L1 : case « Formé au MOM » (profil sportif)
-- FAIT FOI Conception-FORME-AU-MOM-v1 gelé par Manu le 20/11/2026
-- (« je te suis » : D5 = fiche seule, D6 = astérisque export en lot L2).
--   1. personnes.forme_au_club boolean NOT NULL DEFAULT false
--   2. update_joueur_metier : clé de patch 'forme_au_club' (même signature,
--      CREATE OR REPLACE → pas de surcharge ; garde sql_274 conservée)
--   3. get_joueur_detail : + colonne forme_au_club en fin de résultat
--      (type de retour modifié → DROP + CREATE ; droits rétablis à
--      l'identique : authenticated + service_role, PUBLIC/anon révoqués)
-- Méthode : chaque fonction est réécrite À PARTIR DE SON TEXTE DÉPLOYÉ
-- (pg_get_functiondef) par remplacement d'un motif exact ; le script
-- échoue si un motif n'est pas trouvé exactement une fois (zéro recopie).
-- =====================================================================

BEGIN;

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS forme_au_club boolean NOT NULL DEFAULT false;

DO $maj$
DECLARE
  v_def  text;
  v_old  text;
  v_new  text;
BEGIN
  -- 2. update_joueur_metier : une ligne CASE après suspension_notes
  v_def := pg_get_functiondef('public.update_joueur_metier(uuid,jsonb)'::regprocedure);
  v_old := $m$    suspension_notes = CASE WHEN p_patch ? 'suspension_notes' THEN NULLIF(trim(p_patch->>'suspension_notes'), '') ELSE suspension_notes END,
$m$;
  v_new := v_old || $m$    -- sql_277 : formé au MOM (case du profil sportif)
    forme_au_club = CASE WHEN p_patch ? 'forme_au_club' THEN COALESCE((p_patch->>'forme_au_club')::boolean, false) ELSE forme_au_club END,
$m$;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'FAIL: motif update_joueur_metier introuvable ou multiple';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);

  -- 3. get_joueur_detail : colonne en fin de RETURNS TABLE et de SELECT
  v_def := pg_get_functiondef('public.get_joueur_detail(uuid)'::regprocedure);
  v_old := 'potentiel_jeu text, suspension_notes text)';
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'FAIL: motif RETURNS get_joueur_detail';
  END IF;
  v_def := replace(v_def, v_old, 'potentiel_jeu text, suspension_notes text, forme_au_club boolean)');
  v_old := E'    p.suspension_notes\n  FROM personnes p';
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'FAIL: motif SELECT get_joueur_detail';
  END IF;
  v_def := replace(v_def, v_old, E'    p.suspension_notes,\n    p.forme_au_club\n  FROM personnes p');
  DROP FUNCTION public.get_joueur_detail(uuid);
  EXECUTE v_def;
END
$maj$;

REVOKE ALL ON FUNCTION public.get_joueur_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_joueur_detail(uuid) TO authenticated, service_role;

DO $verif$
DECLARE v_acl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'personnes'
                   AND column_name = 'forme_au_club') THEN
    RAISE EXCEPTION 'FAIL: colonne forme_au_club absente';
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'update_joueur_metier') <> 1
     OR (SELECT count(*) FROM pg_proc WHERE proname = 'get_joueur_detail') <> 1 THEN
    RAISE EXCEPTION 'FAIL: surcharge de fonction';
  END IF;
  IF position('forme_au_club' IN pg_get_functiondef('public.update_joueur_metier(uuid,jsonb)'::regprocedure)) = 0
     OR position('sql_274' IN pg_get_functiondef('public.update_joueur_metier(uuid,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'FAIL: update_joueur_metier incomplet';
  END IF;
  IF position('forme_au_club boolean' IN pg_get_function_result('public.get_joueur_detail(uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'FAIL: get_joueur_detail sans forme_au_club';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE proname = 'get_joueur_detail') THEN
    RAISE EXCEPTION 'FAIL: SECURITY DEFINER perdu';
  END IF;
  SELECT array_to_string(proacl, ',') INTO v_acl FROM pg_proc WHERE proname = 'get_joueur_detail';
  IF v_acl NOT LIKE '%authenticated=X%' OR v_acl LIKE '%anon=X%' OR v_acl ~ '(^|,)=X' THEN
    RAISE EXCEPTION 'FAIL: droits get_joueur_detail inattendus : %', v_acl;
  END IF;
  RAISE NOTICE 'sql_277 OK';
END
$verif$;

COMMIT;
