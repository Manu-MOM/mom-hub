-- ============================================================================
-- MOM Hub · Phase 2.5.1 · Table auth_roles + helpers
-- ============================================================================
-- Objectif : mapper auth.users.id <-> rôle applicatif.
-- 3 rôles : admin / coach / viewer. Cumul autorisé (1 ligne par couple).
--
-- À exécuter dans le SQL editor Supabase (projet mom-hub).
-- Idempotent : peut être rejoué sans dégât.
-- Aucune donnée perso : ce fichier peut être commit dans le repo public.
-- ============================================================================


-- 1. Table -------------------------------------------------------------------

create table if not exists public.auth_roles (
    user_id     uuid        not null references auth.users(id) on delete cascade,
    role        text        not null check (role in ('admin', 'coach', 'viewer')),
    created_at  timestamptz not null default now(),
    created_by  uuid        null references auth.users(id) on delete set null,
    primary key (user_id, role)
);

comment on table  public.auth_roles is
    'Mapping auth.users <-> rôle applicatif (admin/coach/viewer). Cumul autorisé : 1 ligne par couple (user_id, role).';
comment on column public.auth_roles.user_id    is 'Utilisateur Supabase auth.';
comment on column public.auth_roles.role       is 'Rôle applicatif. admin = tout, coach = écriture métier, viewer = lecture seule.';
comment on column public.auth_roles.created_at is 'Date d''attribution du rôle.';
comment on column public.auth_roles.created_by is 'Admin qui a attribué le rôle. Null si attribution manuelle initiale (premier admin).';

-- Index secondaire : lookup par rôle (futur : "liste des coachs", "liste des admins", etc.)
create index if not exists auth_roles_role_idx on public.auth_roles (role);


-- 2. Fonctions utilitaires (définies AVANT les policies qui les appellent) --

-- has_role(p_role text) : helper booléen, utilisable dans toutes les futures policies.
-- SECURITY DEFINER : contourne la RLS de auth_roles -> pas de récursion possible
-- quand on l'appelle depuis une policy sur auth_roles elle-même.
create or replace function public.has_role(p_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.auth_roles
        where user_id = auth.uid() and role = p_role
    );
$$;

comment on function public.has_role(text) is
    'True si l''utilisateur authentifié possède le rôle demandé. SECURITY DEFINER : utilisable dans les policies RLS.';

grant execute on function public.has_role(text) to anon, authenticated;


-- get_my_roles() : liste des rôles de l'utilisateur courant.
-- Cohérent avec le pattern get_dashboard_stats() (cf. STATE.md "Pattern technique acquis").
create or replace function public.get_my_roles()
returns text[]
language sql
security definer
set search_path = public
stable
as $$
    select coalesce(array_agg(role order by role), array[]::text[])
    from public.auth_roles
    where user_id = auth.uid();
$$;

comment on function public.get_my_roles() is
    'Retourne les rôles de l''utilisateur authentifié. Tableau vide si non connecté ou sans rôle.';

grant execute on function public.get_my_roles() to anon, authenticated;


-- 3. RLS + policies ---------------------------------------------------------

alter table public.auth_roles enable row level security;

-- Drop idempotent
drop policy if exists "auth_roles_select_own"   on public.auth_roles;
drop policy if exists "auth_roles_select_admin" on public.auth_roles;

-- Un utilisateur peut lire ses propres rôles.
create policy "auth_roles_select_own"
    on public.auth_roles
    for select
    to authenticated
    using (user_id = auth.uid());

-- Un admin peut tout lire (utile plus tard pour une UI de gestion des rôles).
create policy "auth_roles_select_admin"
    on public.auth_roles
    for select
    to authenticated
    using (public.has_role('admin'));

-- IMPORTANT : aucune policy INSERT/UPDATE/DELETE pour anon ni authenticated.
-- L'attribution des rôles se fait :
--   * soit via le SQL editor Supabase (manuellement par Manu, début de vie)
--   * soit via service_role (script back-office futur)
--   * soit via une future RPC SECURITY DEFINER réservée aux admins (Phase 2.x)


-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement après le script)
-- ============================================================================
--
-- A. Structure de la table :
--    select column_name, data_type, is_nullable
--      from information_schema.columns
--     where table_schema = 'public' and table_name = 'auth_roles'
--     order by ordinal_position;
--
-- B. RLS activée + policies présentes :
--    select policyname, cmd, roles
--      from pg_policies
--     where schemaname = 'public' and tablename = 'auth_roles';
--    -- attendu : auth_roles_select_own, auth_roles_select_admin
--
-- C. Les helpers répondent (sans user connecté : tableau vide / false) :
--    select public.get_my_roles();         -- attendu : {}
--    select public.has_role('admin');      -- attendu : f
--
-- D. APRÈS l'étape 2.5.3 (login Magic Link fonctionnel), Manu s'attribue admin :
--    -- 1) récupérer son user_id :
--    --    select id, email from auth.users where email = '<ton-email-de-login>';
--    -- 2) insérer le rôle (remplacer <UUID> ci-dessous) :
--    --    insert into public.auth_roles (user_id, role) values ('<UUID>', 'admin');
--    -- 3) une fois connecté côté front :
--    --    select public.get_my_roles();   -- attendu : {admin}
-- ============================================================================
