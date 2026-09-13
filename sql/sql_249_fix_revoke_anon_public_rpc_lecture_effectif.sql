-- =====================================================================
-- sql_249_fix_revoke_anon_public_rpc_lecture_effectif.sql
-- ---------------------------------------------------------------------
-- Chantier : ENTENTE-M16-2026-2027 — correctif securite
--
-- Contexte : la migration sql_248 (DROP+CREATE des 4 RPC d'effectif) a
--   remis, via le comportement par defaut de CREATE FUNCTION, le droit
--   EXECUTE a PUBLIC/anon sur get_joueurs_categorie/equipe/f15/section.
--   Cela a REGRESSE l'etat de securite pose au chantier
--   REVOKE-ANON-LECTURES-EFFECTIF (sql_206, pt 216), qui exige que ces
--   lectures d'effectif ne soient accessibles qu'aux appelants
--   AUTHENTIFIES.
--
--   NB : la regression preexistait partiellement (get_joueurs_* etaient
--   deja repassees a public avant ce chantier, cf. defaut reconduit
--   depuis pt 209). sql_248 l'a confirmee ; ce fichier la solde
--   definitivement pour les 4 RPC concernees.
--
-- Etat-cible (identique aux 2 autres RPC du perimetre 216 restees saines,
--   list_fonctions_staff / list_vivier_collectif) :
--   { authenticated, postgres(owner), service_role }.
--
-- Idempotent (REVOKE sur droit absent = sans effet).
-- Etat deploye faisant foi : applique le 13/09/2026
--   (migration fix_revoke_anon_public_4_rpc_lecture_effectif_regression_pt216).
-- =====================================================================

REVOKE ALL ON FUNCTION public.get_joueurs_categorie(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_joueurs_equipe(uuid)    FROM anon, public;
REVOKE ALL ON FUNCTION public.get_joueurs_f15()           FROM anon, public;
REVOKE ALL ON FUNCTION public.get_joueurs_section()       FROM anon, public;

-- Verification fail-loud : plus aucun droit anon/public sur les 4.
DO $verif$
DECLARE v_fuite int;
BEGIN
  SELECT count(*) INTO v_fuite
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN information_schema.routine_privileges r
    ON r.routine_schema = 'public' AND r.specific_name = p.proname || '_' || p.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('get_joueurs_categorie','get_joueurs_equipe','get_joueurs_f15','get_joueurs_section')
    AND r.grantee IN ('anon','PUBLIC');
  IF v_fuite > 0 THEN
    RAISE EXCEPTION 'KO : % droit(s) anon/public subsistant(s) sur les lectures effectif.', v_fuite;
  END IF;
  RAISE NOTICE 'FIX-REVOKE-ANON (entente M16) OK : 4 RPC reverrouillees (authenticated seul).';
END $verif$;
