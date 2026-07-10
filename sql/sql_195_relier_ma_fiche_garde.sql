-- =====================================================================
-- sql_195 — REFONTE-ENROLEMENT — Objet 2/2 : garde anti-usurpation sur
--           relier_ma_fiche
-- ---------------------------------------------------------------------
-- Déployé par connecteur (apply_migration) le 10/07/2026, do $verif$ VERT.
-- Test négatif (transaction annulée) : rattachement hors famille-email
-- REFUSÉ (42501) ; rattachement famille-email ACCEPTÉ. Ce fichier est la
-- trace repo de la migration déjà appliquée en base.
--
-- AJOUTE la garde anti-usurpation (D2/D3, Niveau strict) :
--   - un membre ordinaire ne peut relier QUE une fiche issue de
--     list_mes_fiches_par_email() (sa propre famille-email, non reliée).
--   - EXCEPTION admin (option 1) : has_role('admin') -> peut relier toute
--     fiche libre (dépannage ; geste concret recommandé = renseigner
--     l'email dans la fiche, pas ce chemin).
-- GÈRE proprement le conflit personne_id (fiche déjà prise par un AUTRE
--   compte) -> 42501 « déjà reliée à un autre compte » au lieu d'erreur
--   brute (unicité personne_id d'auth_personne).
-- CONSERVE À L'IDENTIQUE : matérialisation roles_en_attente -> auth_roles
--   puis purge (canal de pré-attribution du jeton de rôle, D3).
--
-- Signature INCHANGÉE (p_personne_id uuid) -> CREATE OR REPLACE, pas de
-- risque PGRST203.
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

  -- [sql/72] Matérialisation des rôles pré-attribués — INCHANGÉE.
  insert into public.auth_roles (user_id, role, created_by)
  select v_uid, rea.role, rea.created_by
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

-- Grants inchangés (authenticated-only). Réaffirmés (idempotent, cohérent sql_193).
REVOKE EXECUTE ON FUNCTION public.relier_ma_fiche(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.relier_ma_fiche(uuid) TO authenticated;

-- --------------------------------------------------------------------
-- Vérif fail-loud : fonction présente, signature préservée, grants sains.
-- --------------------------------------------------------------------
DO $verif$
DECLARE
  v_oid oid;
  v_args text;
BEGIN
  SELECT p.oid, pg_get_function_identity_arguments(p.oid)
    INTO v_oid, v_args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='relier_ma_fiche';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'VERIF ECHEC : relier_ma_fiche absente apres deploiement.';
  END IF;
  IF v_args <> 'p_personne_id uuid' THEN
    RAISE EXCEPTION 'VERIF ECHEC : signature relier_ma_fiche modifiee (= %).', v_args;
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('public', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF ECHEC : relier_ma_fiche executable par anon/public (regression sql_193).';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIF ECHEC : authenticated ne peut pas executer relier_ma_fiche.';
  END IF;

  RAISE NOTICE 'VERIF OK : relier_ma_fiche renforcee, signature preservee, authenticated-only.';
END
$verif$;
