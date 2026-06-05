-- =====================================================================
-- MOM Hub · sql/72 — Pré-attribution de rôle avant 1ʳᵉ connexion
-- =====================================================================
-- Implémente Conception-Roles-Pre-Attribution-v1.md (dette ROLES-PRE-ATTRIBUTION 🟢).
--
-- Permet de pré-attribuer un rôle (admin|bureau|referent) à une personne
-- AVANT sa 1ʳᵉ connexion (donc avant qu'elle ait un user_id auth).
-- La pré-attribution se range par personne_id (la fiche existe déjà).
-- À la 1ʳᵉ connexion (relier_ma_fiche), le rôle en attente est matérialisé
-- en auth_roles puis l'attente est purgée.
--
-- FAITS DE SONDE (lecture seule, exécutées par Manu — anti-fabrication pt 14) :
--   S1  relier_ma_fiche = SEUL écrivain de auth_personne, INSERT ON CONFLICT(user_id)
--   S2  AUCUN trigger sur auth_personne  -> greffe DANS relier_ma_fiche (pas de trigger)
--   S5  relier_ma_fiche est le seul point d'écriture (recherche prokind='f')
--   S6  auth_roles(user_id uuid NN, role text NN, created_at tstz NN now(), created_by uuid NULL), PK (user_id, role)
--   S7  CHECK auth_roles.role ∈ {admin, bureau, referent}
--   S9  qui_suis_je() RETURNS TABLE(personne_id uuid) ; motif created_by (= definir_fonction_staff)
--   S8b 47 personnes pré-attribuables (staff/dirigeant sans pont)
--
-- Idempotent, fail-loud. À exécuter en SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table d'attente
-- ---------------------------------------------------------------------
create table if not exists public.roles_en_attente (
  personne_id uuid    not null references public.personnes(id) on delete cascade,
  role        text    not null,
  created_by  uuid,                                   -- personne_id de l'admin pré-attributeur (qui_suis_je)
  created_at  timestamptz not null default now(),
  constraint roles_en_attente_pkey primary key (personne_id, role),
  constraint roles_en_attente_role_check
    check (role = any (array['admin'::text, 'bureau'::text, 'referent'::text]))   -- miroir S7
);

comment on table public.roles_en_attente is
  'Rôles pré-attribués à une personne avant sa 1re connexion. Matérialisés en auth_roles par relier_ma_fiche, puis purgés. Voir sql/72.';

-- RLS fermée (aucune policy permissive) : tout passe par les RPC SECURITY DEFINER.
alter table public.roles_en_attente enable row level security;

-- ---------------------------------------------------------------------
-- 2. RPC d'administration de l'attente (gardées admin)
-- ---------------------------------------------------------------------

-- 2a. Pré-attribuer un rôle (idempotent).
create or replace function public.preattribuer_role(
  p_personne_id uuid,
  p_role        text
)
returns public.roles_en_attente
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.roles_en_attente;
  v_cree_par uuid;
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  if not exists (select 1 from public.personnes p where p.id = p_personne_id) then
    raise exception 'Fiche personne introuvable : %', p_personne_id;
  end if;
  if p_role not in ('admin','bureau','referent') then
    raise exception 'Rôle invalide : % (attendu admin|bureau|referent).', p_role;
  end if;

  -- created_by = personne reliée au compte courant si elle existe (motif definir_fonction_staff, S9)
  select personne_id into v_cree_par from public.qui_suis_je();

  insert into public.roles_en_attente (personne_id, role, created_by)
  values (p_personne_id, p_role, v_cree_par)
  on conflict (personne_id, role) do nothing;

  select * into v_row
  from public.roles_en_attente
  where personne_id = p_personne_id and role = p_role;

  return v_row;
end;
$function$;

-- 2b. Retirer une pré-attribution non encore matérialisée.
create or replace function public.retirer_preattribution(
  p_personne_id uuid,
  p_role        text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  delete from public.roles_en_attente
  where personne_id = p_personne_id and role = p_role;
end;
$function$;

-- 2c. Lister les rôles en attente (pour l'écran).
create or replace function public.list_roles_en_attente()
returns table(personne_id uuid, nom text, prenom text, roles text[])
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  return query
    select rea.personne_id,
           p.nom,
           p.prenom,
           array_agg(rea.role order by rea.role) as roles
    from public.roles_en_attente rea
    join public.personnes p on p.id = rea.personne_id
    group by rea.personne_id, p.nom, p.prenom
    order by p.nom, p.prenom;
end;
$function$;

-- 2d. Lister les personnes pré-attribuables (staff/dirigeant SANS pont auth_personne).
--     Filtre calé sur le réel categorie_personne (S3) ; 47 lignes attendues (S8b).
create or replace function public.list_personnes_preattribuables()
returns table(personne_id uuid, nom text, prenom text, categorie_personne text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  return query
    select p.id, p.nom, p.prenom, p.categorie_personne
    from public.personnes p
    where (p.categorie_personne ilike '%staff%' or p.categorie_personne = 'dirigeant')
      and not exists (
        select 1 from public.auth_personne ap where ap.personne_id = p.id
      )
    order by p.nom, p.prenom;
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. Greffe de matérialisation dans relier_ma_fiche
-- ---------------------------------------------------------------------
-- Redéclaration COMPLÈTE de relier_ma_fiche (sql/60), corps d'origine PRÉSERVÉ
-- byte-identique ; seul ajout = le bloc de matérialisation + purge, inséré
-- APRÈS l'INSERT du pont et AVANT le return query.
-- S2 + S5 : un seul écrivain, aucun trigger -> greffe ici (pas de trigger).
create or replace function public.relier_ma_fiche(p_personne_id uuid)
returns table(user_id uuid, personne_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  delete from public.roles_en_attente
  where personne_id = p_personne_id;

  return query
    select ap.user_id, ap.personne_id
    from public.auth_personne ap
    where ap.user_id = v_uid;
end;
$function$;

-- ---------------------------------------------------------------------
-- 4. Permissions
-- ---------------------------------------------------------------------
revoke all on function public.preattribuer_role(uuid, text)        from public;
revoke all on function public.retirer_preattribution(uuid, text)   from public;
revoke all on function public.list_roles_en_attente()              from public;
revoke all on function public.list_personnes_preattribuables()     from public;
grant execute on function public.preattribuer_role(uuid, text)        to authenticated;
grant execute on function public.retirer_preattribution(uuid, text)   to authenticated;
grant execute on function public.list_roles_en_attente()              to authenticated;
grant execute on function public.list_personnes_preattribuables()     to authenticated;
-- relier_ma_fiche : grants inchangés (déjà accordés par sql/60).

-- ---------------------------------------------------------------------
-- 5. Contrôle (fail-loud)
-- ---------------------------------------------------------------------
do $verif$
begin
  if not exists (select 1 from pg_class where relname = 'roles_en_attente') then
    raise exception 'roles_en_attente absente après création.';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='preattribuer_role'
  ) then
    raise exception 'preattribuer_role absente.';
  end if;
  -- la greffe doit être présente dans relier_ma_fiche
  if (select pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='relier_ma_fiche')
     not ilike '%roles_en_attente%' then
    raise exception 'Greffe de matérialisation absente de relier_ma_fiche.';
  end if;
end;
$verif$;
