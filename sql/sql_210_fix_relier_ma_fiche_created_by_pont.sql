-- =====================================================================
-- sql_210 — FIX-ENROLEMENT-CREATED-BY-PONT — correctif du pont created_by
--            à la matérialisation des rôles dans relier_ma_fiche.
-- ---------------------------------------------------------------------
-- Appliqué en base par l'agent (connecteur) + do $verif$ VERT. Ce fichier
-- est la trace repo de la migration déjà appliquée.
--
-- INCIDENT (production, 25/07/2026) : tout membre pré-attribué (Hugues,
-- Thierry, +24 en attente) échouait à relier sa fiche. Message front
-- générique « La liaison a échoué » masquant l'erreur réelle Postgres :
--
--   23503 auth_roles_created_by_fkey :
--   Key (created_by)=(afbcb4b3-…) is not present in table "users".
--
-- CAUSE (sondes à la source, base + dépôt) : DEUX sémantiques distinctes
-- pour une colonne homonyme, pontées SANS conversion.
--   • roles_en_attente.created_by = un personne_id — PAR CONCEPTION
--     (RPC de pré-attribution sql_100 : `select personne_id into v_cree_par
--     from qui_suis_je()`, motif definir_fonction_staff, S9).
--   • auth_roles.created_by       = une FK vers auth.users(id)
--     (auth_roles_created_by_fkey, ON DELETE SET NULL → colonne nullable).
--   relier_ma_fiche (sql_195) recopiait rea.created_by TEL QUEL dans
--   auth_roles → un personne_id ne satisfait jamais la FK → 23503 →
--   TOUTE la liaison annulée (rollback implicite de la fonction).
--
-- DÉCISION (Manu, gelée — Option A) : réparer LE PONT, sans changer la
-- sémantique des deux tables. À la matérialisation, CONVERTIR le
-- personne_id du créateur en user_id via auth_personne ; repli NULL si le
-- créateur n'a pas de compte résolvable (colonne nullable). La liaison
-- d'un membre ne dépend ainsi JAMAIS de la résolvabilité du compte de son
-- pré-attributeur. Volet data associé (hors ce fichier, appliqué par
-- l'agent) : réversion des created_by fautifs vers le personne_id d'origine
-- (restaure la sémantique de roles_en_attente attendue par la conversion).
--
-- SEUL CHANGEMENT vs sql_195 : le bloc INSERT INTO auth_roles remplace la
-- colonne `rea.created_by` par la sous-requête de conversion. Tout le reste
-- (garde anti-usurpation D2/D3, rattachement auth_personne, purge, forme de
-- retour, grants authenticated-only) est CONSERVÉ À L'IDENTIQUE.
--
-- Signature INCHANGÉE (p_personne_id uuid) → CREATE OR REPLACE, pas de
-- risque PGRST203.
--
-- DETTE DE FOND (non traitée ici, tracée) : la divergence de sémantique
-- created_by entre les deux tables demeure ; le pont la neutralise mais ne
-- l'unifie pas. Une refonte du modèle (colonne renommée / type de motif
-- explicite) reste possible si un besoin l'exige.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.relier_ma_fiche(p_personne_id uuid)
  RETURNS TABLE(user_id uuid, personne_id uuid)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_est_admin boolean;
  v_autorisee boolean;
  v_deja_prise_par uuid;
begin
  if v_uid is null then
    raise exception 'Aucun compte authentifié (auth.uid() est NULL).';
  end if;

  if not exists (select 1 from public.personnes p where p.id = p_personne_id) then
    raise exception 'Fiche personne introuvable : %', p_personne_id;
  end if;

  -- Garde anti-usurpation (D2/D3). Admin exempté (option 1).
  v_est_admin := has_role('admin');

  if not v_est_admin then
    -- La fiche demandée doit figurer dans la résolution email du compte
    -- (fiche de MON email, non déjà reliée). Niveau strict.
    select exists (
      select 1 from public.list_mes_fiches_par_email() f
      where f.personne_id = p_personne_id
    ) into v_autorisee;

    if not v_autorisee then
      -- Message distinct si la fiche est déjà prise par un autre compte,
      -- pour ne pas laisser croire à un bug (cas famille, option A).
      select ap.user_id into v_deja_prise_par
      from public.auth_personne ap
      where ap.personne_id = p_personne_id;

      if v_deja_prise_par is not null and v_deja_prise_par <> v_uid then
        raise exception 'Cette fiche est déjà reliée à un autre compte.'
          using errcode = '42501';
      end if;

      raise exception 'Rattachement non autorisé : cette fiche ne correspond pas à votre adresse e-mail.'
        using errcode = '42501';
    end if;
  end if;

  -- Neutralisation explicite du conflit personne_id (fiche déjà prise par
  -- un AUTRE compte), y compris pour l'admin.
  if exists (
    select 1 from public.auth_personne ap
    where ap.personne_id = p_personne_id and ap.user_id <> v_uid
  ) then
    raise exception 'Cette fiche est déjà reliée à un autre compte.'
      using errcode = '42501';
  end if;

  insert into public.auth_personne (user_id, personne_id)
  values (v_uid, p_personne_id)
  on conflict (user_id) do update set personne_id = excluded.personne_id;

  -- [sql/72 + sql_210] Matérialisation des rôles pré-attribués.
  -- roles_en_attente.created_by est un personne_id (motif definir_fonction_
  -- staff, S9) ; auth_roles.created_by est une FK vers auth.users. On
  -- CONVERTIT personne_id -> user_id via auth_personne ; NULL si le créateur
  -- n'a pas de compte résolvable (colonne nullable, FK ON DELETE SET NULL).
  -- La liaison du membre ne dépend donc jamais de la résolvabilité du compte
  -- du pré-attributeur.
  insert into public.auth_roles (user_id, role, created_by)
  select v_uid, rea.role,
         (select ap.user_id from public.auth_personne ap
          where ap.personne_id = rea.created_by)
  from public.roles_en_attente rea
  where rea.personne_id = p_personne_id
  on conflict (user_id, role) do nothing;

  -- [sql/72 + sql_146] Purge de l'attente — INCHANGÉE (alias rea anti-42702).
  delete from public.roles_en_attente rea
  where rea.personne_id = p_personne_id;

  return query
    select ap.user_id, ap.personne_id
    from public.auth_personne ap
    where ap.user_id = v_uid;
end;
$function$;

-- Grants inchangés (authenticated-only). Réaffirmés (idempotent, cohérent sql_195).
REVOKE EXECUTE ON FUNCTION public.relier_ma_fiche(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.relier_ma_fiche(uuid) TO authenticated;

-- --------------------------------------------------------------------
-- Vérif fail-loud : fonction présente, signature préservée, grants sains,
-- conversion created_by présente dans le corps déployé.
-- --------------------------------------------------------------------
DO $verif$
DECLARE
  v_oid  oid;
  v_args text;
  v_def  text;
BEGIN
  SELECT p.oid, pg_get_function_identity_arguments(p.oid), pg_get_functiondef(p.oid)
    INTO v_oid, v_args, v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'relier_ma_fiche';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'VERIF ECHEC : relier_ma_fiche absente apres deploiement.';
  END IF;
  IF v_args <> 'p_personne_id uuid' THEN
    RAISE EXCEPTION 'VERIF ECHEC : signature relier_ma_fiche modifiee (= %).', v_args;
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('public', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF ECHEC : relier_ma_fiche executable par anon/public.';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF ECHEC : authenticated ne peut pas executer relier_ma_fiche.';
  END IF;
  IF position('where ap.personne_id = rea.created_by' IN v_def) = 0 THEN
    RAISE EXCEPTION 'VERIF ECHEC : conversion personne_id->user_id absente du corps.';
  END IF;

  RAISE NOTICE 'VERIF OK : relier_ma_fiche corrigee (pont created_by), signature preservee, authenticated-only.';
END
$verif$;
