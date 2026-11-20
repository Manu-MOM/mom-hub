-- =====================================================================
-- sql_278 — FORME-AU-MOM L2 : lecture « formé au MOM » pour l'export
-- FAIT FOI Conception-FORME-AU-MOM-v1 (gelé 20/11/2026), D6 = (a) :
-- astérisque « NOM* » dans l'export réseaux « MOM photos ».
-- Nouvelle RPC ADDITIVE, calquée sur get_photos_courantes (même patron,
-- mêmes droits) : renvoie, parmi les ids fournis, ceux cochés « Formé au
-- MOM ». personnes reste sans SELECT client direct (invariant RLS).
-- Aucune fonction existante modifiée.
-- =====================================================================

BEGIN;

CREATE FUNCTION public.get_formes_au_club(p_ids uuid[])
 RETURNS TABLE(personne_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id
  FROM personnes p
  WHERE p.id = ANY(p_ids)
    AND p.forme_au_club = true;
$function$;

REVOKE ALL ON FUNCTION public.get_formes_au_club(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_formes_au_club(uuid[]) TO authenticated, service_role;

DO $verif$
DECLARE v_acl text;
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'get_formes_au_club') <> 1 THEN
    RAISE EXCEPTION 'FAIL: get_formes_au_club absente ou surchargée';
  END IF;
  SELECT array_to_string(proacl, ',') INTO v_acl FROM pg_proc WHERE proname = 'get_formes_au_club';
  IF v_acl NOT LIKE '%authenticated=X%' OR v_acl LIKE '%anon=X%' OR v_acl ~ '(^|,)=X' THEN
    RAISE EXCEPTION 'FAIL: droits inattendus : %', v_acl;
  END IF;
  RAISE NOTICE 'sql_278 OK';
END
$verif$;

COMMIT;
