-- =====================================================================
-- sql_194 — REFONTE-ENROLEMENT — Objet 1/2 : résolution email -> fiche
-- ---------------------------------------------------------------------
-- Déployé par connecteur (apply_migration) le 10/07/2026, do $verif$ VERT.
-- Ce fichier est la trace repo de la migration déjà appliquée en base.
--
-- Renvoie, pour le compte connecté, les fiches dont l'email principal
-- correspond EXACTEMENT (normalisé lower+trim) à l'email du compte
-- (auth.email()), en EXCLUANT les fiches déjà reliées à un compte
-- (unicité personne_id d'auth_personne).
--
-- Décisions FAIT FOI :
--   D1     — porte d'entrée conditionnée à la correspondance email.
--   D2-c1  — email unique -> une seule fiche proposée (auto côté front).
--   D2-c2  — email partagé -> choix restreint à la famille-email.
--   Opt. A — une fiche = un compte -> exclusion des fiches déjà reliées
--            (« disparaît du choix des suivants »).
--
-- NB sondes 10/07 : email_secondaire est VIDE en base (0 ligne) -> on ne
-- résout que sur email_principal. À réévaluer si email_secondaire est un
-- jour peuplé (évolution tracée, hors périmètre).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.list_mes_fiches_par_email()
  RETURNS TABLE(personne_id uuid, nom text, prenom text)
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  select p.id as personne_id, p.nom, p.prenom
  from public.personnes p
  where auth.uid() is not null
    and auth.email() is not null
    and nullif(lower(trim(p.email_principal)), '') = lower(trim(auth.email()))
    and not exists (
      select 1 from public.auth_personne ap
      where ap.personne_id = p.id
    )
  order by p.nom asc, p.prenom asc;
$function$;

-- Durcissement cohérent sql_193 : jamais anon/public.
REVOKE EXECUTE ON FUNCTION public.list_mes_fiches_par_email() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.list_mes_fiches_par_email() TO authenticated;

-- --------------------------------------------------------------------
-- Vérif fail-loud : la fonction existe, est authenticated-only.
-- --------------------------------------------------------------------
DO $verif$
DECLARE
  v_oid oid;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='list_mes_fiches_par_email';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'VERIF ECHEC : list_mes_fiches_par_email absente apres deploiement.';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF ECHEC : anon peut executer list_mes_fiches_par_email (regression sql_193).';
  END IF;
  IF has_function_privilege('public', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF ECHEC : public peut executer list_mes_fiches_par_email (regression sql_193).';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF ECHEC : authenticated NE PEUT PAS executer list_mes_fiches_par_email.';
  END IF;

  RAISE NOTICE 'VERIF OK : list_mes_fiches_par_email deployee, authenticated-only.';
END
$verif$;
