-- ============================================================================
-- MOM Hub · Chantier B « Identité & rôles staff » (Conception-IDENT-SYS-v1.md §2.5)
-- Fichier : sql/61 — Fonctions staff (catégorielles, multi-cat, libres, datées)
-- ----------------------------------------------------------------------------
-- Sondes à la source (closes en sql/60, base fait foi pt 14) :
--   S4 : has_role(p_role text) + get_my_roles(), SECURITY DEFINER -> gardes admin.
--   S5 : categories.id = personnes.id = uuid -> FK directes, aucun cast.
--
-- Décisions Manu intégrées (§2.5) :
--   - Multi-catégories : plusieurs lignes/personne, PAS de UNIQUE bloquant sur personne_id.
--   - fonction = text SANS CHECK fermé (liste suggérée en UI, référentiel JSON documentaire).
--   - Historisation date_debut / date_fin (NULL = en cours), pas d'écrasement.
--   - Ajout manuel d'un membre = simple INSERT (réutilise la pioche staff u-admin pt 28).
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D1 : écritures via RPC HAUT NIVEAU à clôture auto plutôt que CRUD brut.
--        definir_fonction_staff clôt (date_fin=current_date) la fonction active
--        précédente de même (personne, catégorie, fonction) AVANT d'ouvrir la
--        nouvelle -> invariant « au plus 1 active par (personne,cat,fonction) »
--        garanti SANS contrainte base (préserve multi-cat + champ libre).
--   D2 : pas de contrainte d'unicité base sur (personne_id,categorie_id,fonction)
--        active : l'historique empile des lignes datées ; l'unicité de l'ACTIVE
--        est tenue par la RPC, pas par un index partiel (resterait contournable
--        par INSERT direct, mais RLS fermée -> seule la RPC écrit).
--   D3 : FK ON DELETE CASCADE sur personne_id et categorie_id (la fonction n'a
--        pas de sens sans sa personne ni sa catégorie). cree_par ON DELETE SET NULL
--        (audit, ne doit pas bloquer la suppression d'une fiche).
--   D4 : cloturer_fonction_staff(id) pose date_fin = current_date (fin propre,
--        sans suppression -> garde la trace). supprimer = seulement pour corriger
--        une saisie erronée (RPC dédiée, admin).
--   D5 : trigger updated_at sur UPDATE.
-- ============================================================================

-- 1. Table
create table if not exists public.fonction_staff (
  id           uuid        primary key default gen_random_uuid(),
  personne_id  uuid        not null references public.personnes(id)  on delete cascade,
  categorie_id uuid        not null references public.categories(id) on delete cascade,
  fonction     text        not null,             -- liste suggérée UI, PAS de CHECK fermé
  date_debut   date        not null default current_date,
  date_fin     date,                             -- NULL = en cours
  cree_par     uuid        references public.personnes(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint fonction_staff_dates_chk check (date_fin is null or date_fin >= date_debut)
);

comment on table public.fonction_staff is
  'Fonction occupée par une personne dans le staff d''une catégorie (entraîneur principal/adjoint, logisticien, référent…). Catégorielle, multi-cat, fonction libre, datée. Conception-IDENT-SYS-v1 §2.5.';

create index if not exists fonction_staff_categorie_idx on public.fonction_staff (categorie_id);
create index if not exists fonction_staff_personne_idx  on public.fonction_staff (personne_id);
create index if not exists fonction_staff_active_idx     on public.fonction_staff (categorie_id) where date_fin is null;

-- 2. RLS fermée -> tout passe par les RPC SECURITY DEFINER ci-dessous
alter table public.fonction_staff enable row level security;

-- 3. Trigger updated_at
create or replace function public.fonction_staff_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists fonction_staff_set_updated_at on public.fonction_staff;
create trigger fonction_staff_set_updated_at
  before update on public.fonction_staff
  for each row execute function public.fonction_staff_touch_updated_at();

-- 4. Lecture : staff d'une catégorie (actifs par défaut, ou historique complet)
create or replace function public.list_fonctions_staff(
  p_categorie_id uuid,
  p_inclure_historique boolean default false
)
returns table (
  id uuid, personne_id uuid, categorie_id uuid, fonction text,
  date_debut date, date_fin date, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select fs.id, fs.personne_id, fs.categorie_id, fs.fonction,
         fs.date_debut, fs.date_fin, fs.created_at
  from public.fonction_staff fs
  where fs.categorie_id = p_categorie_id
    and (p_inclure_historique or fs.date_fin is null)
  order by (fs.date_fin is not null), fs.fonction, fs.date_debut desc;
$$;

comment on function public.list_fonctions_staff(uuid, boolean) is
  'Liste les fonctions staff d''une catégorie. Par défaut actives (date_fin IS NULL) ; historique complet si p_inclure_historique.';

-- 5. Écriture : définir une fonction (clôt l'active précédente de même clé) — ADMIN
create or replace function public.definir_fonction_staff(
  p_personne_id  uuid,
  p_categorie_id uuid,
  p_fonction     text,
  p_date_debut   date default current_date
)
returns public.fonction_staff
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fonction_staff;
  v_cree_par uuid;
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  if coalesce(btrim(p_fonction), '') = '' then
    raise exception 'La fonction ne peut pas être vide.';
  end if;

  -- cree_par = la personne reliée au compte courant si elle existe (pont sql/60)
  select personne_id into v_cree_par from public.qui_suis_je();

  -- Clôture auto de l'active précédente de même (personne, catégorie, fonction)
  update public.fonction_staff
     set date_fin = least(p_date_debut, current_date)
   where personne_id = p_personne_id
     and categorie_id = p_categorie_id
     and lower(btrim(fonction)) = lower(btrim(p_fonction))
     and date_fin is null;

  insert into public.fonction_staff
    (personne_id, categorie_id, fonction, date_debut, cree_par)
  values
    (p_personne_id, p_categorie_id, btrim(p_fonction), p_date_debut, v_cree_par)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.definir_fonction_staff(uuid, uuid, text, date) is
  'ADMIN. Ouvre une fonction staff datée et clôt automatiquement l''active précédente de même (personne, catégorie, fonction). Conception-IDENT-SYS-v1 §2.5.';

-- 6. Écriture : clôturer une fonction (fin propre, garde la trace) — ADMIN
create or replace function public.cloturer_fonction_staff(
  p_id uuid,
  p_date_fin date default current_date
)
returns public.fonction_staff
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.fonction_staff;
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  update public.fonction_staff
     set date_fin = p_date_fin
   where id = p_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Fonction staff introuvable : %', p_id;
  end if;
  return v_row;
end;
$$;

comment on function public.cloturer_fonction_staff(uuid, date) is
  'ADMIN. Pose date_fin sur une fonction staff (fin propre, sans suppression).';

-- 7. Écriture : supprimer une saisie erronée (ne pas confondre avec clôturer) — ADMIN
create or replace function public.supprimer_fonction_staff(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  delete from public.fonction_staff where id = p_id;
end;
$$;

comment on function public.supprimer_fonction_staff(uuid) is
  'ADMIN. Supprime une fonction staff (correction de saisie uniquement ; pour une fin normale, utiliser cloturer_fonction_staff).';

-- 8. Recette terrain (dry-run lecture seule -> puis écriture sur 1 cas) :
--    select * from public.list_fonctions_staff('<categorie M14 id>');          -- attendu : 0 ligne
--    -- écriture (compte admin) :
--    -- select * from public.definir_fonction_staff('<personne_id>','<cat_id>','logisticien');
--    -- select * from public.list_fonctions_staff('<cat_id>');                 -- attendu : 1 active
--    -- re-définir même clé -> l'ancienne se clôt, une nouvelle active apparaît :
--    -- select * from public.list_fonctions_staff('<cat_id>', true);           -- historique : 2 lignes
-- ============================================================================
