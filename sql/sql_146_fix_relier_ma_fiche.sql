-- ============================================================================
-- sql_146 — ENROLEMENT-REPARATION (1/2) : fix relier_ma_fiche (erreur 42702)
-- FAIT FOI ENROLEMENT-REPARATION, gelé 03/07/2026.
--
-- BUG PROUVÉ (sonde _test_ambiguite, 03/07/2026) : la fonction retourne
-- TABLE(user_id, personne_id) → « personne_id » est aussi une variable de
-- sortie visible dans tout le corps plpgsql. La purge ajoutée par sql/72 :
--     delete from public.roles_en_attente where personne_id = p_personne_id;
-- laisse « personne_id » NON qualifié → ERROR 42702 « column reference
-- "personne_id" is ambiguous » à CHAQUE appel. La liaison échouait donc
-- systématiquement depuis sql/72 (les enrôlements de juin sont antérieurs).
--
-- CORRECTIF : alias « rea » qualifiant la colonne dans le DELETE.
-- Corps par ailleurs STRICTEMENT identique au déployé (prosrc relu 03/07).
--
-- ATTRIBUTS RE-DÉCLARÉS À L'IDENTIQUE (sondes 03/07 : prosecdef=true,
-- provolatile=v, proconfig=search_path=public) : SECURITY DEFINER, VOLATILE,
-- SET search_path = public. Signature INCHANGÉE → CREATE OR REPLACE licite,
-- ACL préservées (EXECUTE authenticated conservé, aucun GRANT à rejouer).
-- ============================================================================

create or replace function public.relier_ma_fiche(p_personne_id uuid)
returns table(user_id uuid, personne_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Aucun compte authentifié (auth.uid() est NULL).';
  end if;
  if not exists (select 1 from public.personnes p where p.id = p_personne_id) then
    raise exception 'Fiche personne introuvable : %', p_personne_id;
  end if;
  insert into public.auth_personne (user_id, personne_id)
  values (v_uid, p_personne_id)
  on conflict (user_id) do update set personne_id = excluded.personne_id;
  -- [sql/72] Matérialisation des rôles pré-attribués à cette personne.
  -- Idempotent (ON CONFLICT) : si le rôle existe déjà, no-op. created_by repris de l'attente.
  insert into public.auth_roles (user_id, role, created_by)
  select v_uid, rea.role, rea.created_by
  from public.roles_en_attente rea
  where rea.personne_id = p_personne_id
  on conflict (user_id, role) do nothing;
  -- [sql/72] Purge de l'attente pour cette personne (matérialisée ou déjà présente).
  -- [sql_146] Alias « rea » ajouté : « personne_id » nu était ambigu (42702)
  -- avec la variable de sortie homonyme — cause de l'échec systématique de
  -- la liaison depuis sql/72 (preuve : sonde _test_ambiguite du 03/07/2026).
  delete from public.roles_en_attente rea
  where rea.personne_id = p_personne_id;
  return query
    select ap.user_id, ap.personne_id
    from public.auth_personne ap
    where ap.user_id = v_uid;
end;
$$;

-- ============================================================================
-- Vérification fail-loud : le correctif est bien en place.
-- ============================================================================
do $verif$
declare
  v_src text;
  v_secdef boolean;
begin
  v_src := (select prosrc from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'relier_ma_fiche');
  if v_src is null then
    raise exception 'sql_146 VERIF: relier_ma_fiche introuvable.';
  end if;
  if position('delete from public.roles_en_attente rea' in v_src) = 0 then
    raise exception 'sql_146 VERIF: le DELETE qualifié (alias rea) est absent.';
  end if;
  if position('where rea.personne_id = p_personne_id' in v_src) = 0 then
    raise exception 'sql_146 VERIF: la clause WHERE qualifiée est absente.';
  end if;
  v_secdef := (select prosecdef from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'relier_ma_fiche');
  if not v_secdef then
    raise exception 'sql_146 VERIF: SECURITY DEFINER perdu.';
  end if;
  raise notice 'sql_146 OK : relier_ma_fiche corrigée (42702), SECURITY DEFINER conservé.';
end
$verif$;
