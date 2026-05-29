-- ============================================================================
-- MOM Hub · Chantier B « Identité & rôles staff » (Conception-IDENT-SYS-v1.md §2.4)
-- Fichier : sql/60 — Pont auth.uid() <-> personne
-- ----------------------------------------------------------------------------
-- Sondes à la source (méthode pt 14, base fait foi) — closes avant écriture :
--   S1 : auth_personne / fonction_staff INEXISTANTES en base -> création à neuf.
--   S2a: auth_roles(user_id uuid NN, role text NN, created_at tstz NN now(),
--        created_by uuid NULL) -> patron « table latérale indexée sur auth.uid() ».
--   S2b: auth_roles = 1 ligne (7ac40334… = admin), aucun coach authentifié.
--   S3 : intersection auth_roles.user_id ∩ personnes.id = 0 -> pont nécessaire.
--   S4 : has_role(p_role text) + get_my_roles(), les deux SECURITY DEFINER.
--   S5 : categories.id = personnes.id = uuid -> FK directes, aucun cast.
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D1 : pas de PK de surrogate. La double contrainte UNIQUE(user_id) +
--        UNIQUE(personne_id) (doc §2.4) suffit ; user_id sert de clé naturelle.
--   D2 : FK personne_id ON DELETE CASCADE -> si la fiche personne disparaît,
--        le lien de compte n'a plus de sens (le compte auth survit côté auth.users).
--   D3 : pas de FK SQL vers auth.users (schéma auth Supabase, calque auth_roles
--        qui ne la pose pas non plus). user_id = auth.uid() par convention.
--   D4 : relier_ma_fiche = INSERT du compte courant uniquement (auth.uid()),
--        JAMAIS d'un user_id arbitraire -> un utilisateur ne peut relier que
--        SON compte. La cible personne_id est libre (geste d'auto-déclaration).
--        ON CONFLICT (user_id) DO UPDATE -> permet de corriger un mauvais lien.
--   D5 : qui_suis_je() = SECURITY DEFINER en lecture, filtre auth.uid().
-- ============================================================================

-- 1. Table de liaison (calque auth_roles : table latérale, pas de colonne dans personnes)
create table if not exists public.auth_personne (
  user_id     uuid        not null,
  personne_id uuid        not null references public.personnes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint auth_personne_user_id_key     unique (user_id),
  constraint auth_personne_personne_id_key unique (personne_id)
);

comment on table public.auth_personne is
  'Pont 1<->1 entre un compte auth (auth.uid()) et une fiche personnes. Conception-IDENT-SYS-v1 §2.4. UNIQUE(personne_id) révisable si multi-comptes un jour.';

create index if not exists auth_personne_personne_id_idx
  on public.auth_personne (personne_id);

-- 2. RLS : table fermée, tout passe par les RPC SECURITY DEFINER ci-dessous
alter table public.auth_personne enable row level security;
-- (aucune policy permissive -> lecture/écriture directe interdite hors RPC definer)

-- 3. RPC « qui suis-je » — le compte courant lit SA fiche reliée (ou rien)
create or replace function public.qui_suis_je()
returns table (personne_id uuid)
language sql
security definer
set search_path = public
as $$
  select ap.personne_id
  from public.auth_personne ap
  where ap.user_id = auth.uid();
$$;

comment on function public.qui_suis_je() is
  'Renvoie la personne_id reliée au compte courant (auth.uid()), ou aucune ligne si non relié.';

-- 4. RPC « relier mon compte à ma fiche » — auto-déclaration du compte courant
--    Ne peut relier QUE auth.uid() (jamais un autre compte). Corrige un lien existant.
create or replace function public.relier_ma_fiche(p_personne_id uuid)
returns table (user_id uuid, personne_id uuid)
language plpgsql
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

  return query
    select ap.user_id, ap.personne_id
    from public.auth_personne ap
    where ap.user_id = v_uid;
end;
$$;

comment on function public.relier_ma_fiche(uuid) is
  'Relie le compte courant (auth.uid()) à une fiche personnes. Ré-exécutable pour corriger le lien. Conception-IDENT-SYS-v1 §2.4.';

-- 5. Recette terrain (dry-run lecture seule — à jouer AVANT tout usage réel) :
--    select * from public.qui_suis_je();                       -- attendu : 0 ligne (rien relié)
--    -- puis, connecté au compte cible, relier puis revérifier :
--    -- select * from public.relier_ma_fiche('<personne_id>');
--    -- select * from public.qui_suis_je();                     -- attendu : la personne_id reliée
-- ============================================================================
