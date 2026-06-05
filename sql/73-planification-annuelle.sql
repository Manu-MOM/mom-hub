-- ============================================================================
-- sql/73-planification-annuelle.sql
-- Module « Planification annuelle » (Section 01 — Pédagogie EDR)
-- ----------------------------------------------------------------------------
-- Périmètre (conv MOM Hub · PLANIFICATION-ANNUELLE) :
--   - planification_blocs : la donnée live (blocs de la frise), portée
--     CATÉGORIE (categorie_id) OU PÔLE (pole_id), jamais les deux.
--   - planification_axes  : référentiel des pioches collectif/physique/poste
--     (Option C — table amorcée, lue par le module, éditable par admin/SQL ;
--      écran admin = chantier séparé REFERENTIELS-EN-BASE).
--   - mes_poles_autorises() : RPC neuve, jumelle de mes_categories_autorisees()
--     (transverse admin/bureau ⇒ (NULL,true) ; référent ⇒ pôles dérivés des
--      catégories de fonction_staff actives ; sinon ⇒ aucune ligne).
--
-- Autorisation (calée sur l'existant, aucune signature inventée) :
--   bloc pôle      : VOIR = est_transverse OR pole_id ∈ mes_poles_autorises()
--                    ÉDITER = has_role('admin') OR has_role('bureau')
--   bloc catégorie : VOIR = ÉDITER = puis_je_ecrire_categorie(categorie_id)
--   axes           : VOIR = tout authentifié ; ÉDITER = has_role('admin')
--
-- Faits sondés (Manu, read-only) ayant cadré ce fichier :
--   - categories(id uuid PK, code, libelle_court, pole_id uuid, ...)
--   - saisons(id uuid PK, code, libelle, date_debut, date_fin, est_active)
--   - poles(id uuid PK, code 'EDR' rattache M6..M14, ...) — 5 pôles
--   - fonction_staff(personne_id, categorie_id NOT NULL, fonction, date_fin)
--   - has_role(text)->bool, qui_suis_je()->uuid(personne_id),
--     puis_je_ecrire_categorie(uuid)->bool, mes_categories_autorisees()->(categorie_id,est_transverse),
--     _b5_norm(text) [normalisation fonction]
--
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE) ; fail-loud en fin de fichier.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) TABLE planification_axes (référentiel des pioches)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.planification_axes (
  id            uuid primary key default gen_random_uuid(),
  type_axe      text    not null,
  libelle       text    not null,
  ordre         integer not null default 0,
  categorie_id  uuid    null references public.categories(id) on delete cascade,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint planification_axes_type_chk
    check (type_axe in ('collectif','physique','poste'))
);

-- Unicité d'un libellé par (type, portée catégorie) — évite les doublons
-- (NULLS NOT DISTINCT : deux libellés communs identiques sont bien en conflit).
create unique index if not exists planification_axes_uq
  on public.planification_axes (type_axe, categorie_id, libelle);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) TABLE planification_blocs (donnée live)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.planification_blocs (
  id             uuid primary key default gen_random_uuid(),
  saison_id      uuid not null references public.saisons(id)    on delete cascade,
  categorie_id   uuid     null references public.categories(id) on delete cascade,
  pole_id        uuid     null references public.poles(id)      on delete cascade,
  ordre          integer  not null default 0,
  titre          text,
  date_debut     date,
  date_fin       date,
  intercale      boolean  not null default false,
  axe_indiv      text[]   not null default '{}'::text[],
  axe_collectif  text,
  axe_physique   text,
  axe_poste      text,
  commentaires   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Portée exclusive : un bloc est SOIT catégorie SOIT pôle, jamais les deux,
  -- jamais aucun.
  constraint planification_blocs_portee_chk
    check ( (categorie_id is not null and pole_id is null)
         or (categorie_id is null     and pole_id is not null) )
);

create index if not exists planification_blocs_saison_cat_idx
  on public.planification_blocs (saison_id, categorie_id);
create index if not exists planification_blocs_saison_pole_idx
  on public.planification_blocs (saison_id, pole_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RPC mes_poles_autorises() — jumelle de mes_categories_autorisees()
--    Même structure de retour, mêmes gardes, même filtre _b5_norm.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.mes_poles_autorises()
returns table(pole_id uuid, est_transverse boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_personne_id uuid;
begin
  -- Niveaux 1 & 2 (admin / bureau) : laissez-passer transverse.
  if has_role('admin') or has_role('bureau') then
    return query select null::uuid, true;
    return;
  end if;
  -- Niveau 3 (referent) : pôles dérivés des catégories de fonction_staff actives.
  if has_role('referent') then
    select qs.personne_id into v_personne_id
    from public.qui_suis_je() qs
    limit 1;
    if v_personne_id is null then
      return;
    end if;
    return query
      select distinct c.pole_id, false
      from public.fonction_staff fs
      join public.categories c on c.id = fs.categorie_id
      where fs.personne_id = v_personne_id
        and fs.date_fin is null
        and c.pole_id is not null
        and (
              public._b5_norm(fs.fonction) like 'referent%'
           or public._b5_norm(fs.fonction) like 'manager%'
           or ( public._b5_norm(fs.fonction) like '%entraineur%'
                and public._b5_norm(fs.fonction) like '%principal%' )
        );
    return;
  end if;
  -- Niveau 4 (compte sans rôle qualifiant) : aucune ligne.
  return;
end;
$function$;

revoke all on function public.mes_poles_autorises() from public;
grant execute on function public.mes_poles_autorises() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) RLS
-- ─────────────────────────────────────────────────────────────────────────
alter table public.planification_axes  enable row level security;
alter table public.planification_blocs enable row level security;

-- ----- planification_axes : lecture tout authentifié, write admin -----
drop policy if exists planification_axes_select on public.planification_axes;
create policy planification_axes_select
  on public.planification_axes for select
  to authenticated
  using (true);

drop policy if exists planification_axes_write on public.planification_axes;
create policy planification_axes_write
  on public.planification_axes for all
  to authenticated
  using (has_role('admin'))
  with check (has_role('admin'));

-- ----- planification_blocs : deux régimes selon la portée -----
-- LECTURE
drop policy if exists planification_blocs_select on public.planification_blocs;
create policy planification_blocs_select
  on public.planification_blocs for select
  to authenticated
  using (
    case
      when pole_id is not null then
        exists (
          select 1 from public.mes_poles_autorises() mp
          where mp.est_transverse or mp.pole_id = planification_blocs.pole_id
        )
      when categorie_id is not null then
        public.puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

-- INSERT
drop policy if exists planification_blocs_insert on public.planification_blocs;
create policy planification_blocs_insert
  on public.planification_blocs for insert
  to authenticated
  with check (
    case
      when pole_id is not null then (has_role('admin') or has_role('bureau'))
      when categorie_id is not null then public.puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

-- UPDATE
drop policy if exists planification_blocs_update on public.planification_blocs;
create policy planification_blocs_update
  on public.planification_blocs for update
  to authenticated
  using (
    case
      when pole_id is not null then (has_role('admin') or has_role('bureau'))
      when categorie_id is not null then public.puis_je_ecrire_categorie(categorie_id)
      else false
    end
  )
  with check (
    case
      when pole_id is not null then (has_role('admin') or has_role('bureau'))
      when categorie_id is not null then public.puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

-- DELETE
drop policy if exists planification_blocs_delete on public.planification_blocs;
create policy planification_blocs_delete
  on public.planification_blocs for delete
  to authenticated
  using (
    case
      when pole_id is not null then (has_role('admin') or has_role('bureau'))
      when categorie_id is not null then public.puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5) AMORÇAGE des axes (défauts repris de l'éditeur MOM Ateliers)
--    Communs (categorie_id NULL). Idempotent via ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.planification_axes (type_axe, libelle, ordre, categorie_id)
values
  -- COLLECTIF
  ('collectif','Duel offensif et continuité debout',1,null),
  ('collectif','Alternance jeu pénétrant / jeu déployé / jeu au pied',2,null),
  ('collectif','Libération au sol et dynamisme autour de l''accident de jeu',3,null),
  ('collectif','Notion de ballon rapide et ballon lent',4,null),
  ('collectif','Travail autour de la cellule d''action',5,null),
  ('collectif','Exploiter les espaces libres',6,null),
  ('collectif','Créer et exploiter les déséquilibres',7,null),
  ('collectif','Contre-attaquer',8,null),
  ('collectif','Adaptation au rapport de force / Zones du terrain',9,null),
  ('collectif','Projet Bleu / Lecture du jeu',10,null),
  -- PHYSIQUE
  ('physique','Coordination et motricité',1,null),
  ('physique','Échauffements spécifiques',2,null),
  ('physique','Endurance / Cardio',3,null),
  ('physique','Vitesse et accélération',4,null),
  ('physique','Puissance et impact',5,null),
  ('physique','Souplesse et mobilité',6,null),
  ('physique','Récupération active',7,null),
  -- JEU AU POSTE
  ('poste','Mêlée (Passeport JDD)',1,null),
  ('poste','Touche (Lancer, Sauter, Lifter)',2,null),
  ('poste','Passe du 9',3,null),
  ('poste','Combinaisons avants',4,null)
on conflict (type_axe, categorie_id, libelle) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) FAIL-LOUD : vérifie tables, colonnes clés, RPC, RLS et amorçage.
-- ─────────────────────────────────────────────────────────────────────────
do $verif$
declare
  v_npol  integer;
  v_nax   integer;
begin
  -- tables
  if to_regclass('public.planification_blocs') is null then
    raise exception 'planification_blocs absente';
  end if;
  if to_regclass('public.planification_axes') is null then
    raise exception 'planification_axes absente';
  end if;
  -- RPC
  if not exists (
    select 1 from pg_proc
    where proname = 'mes_poles_autorises'
      and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'RPC mes_poles_autorises absente';
  end if;
  -- contrainte de portée exclusive
  if not exists (
    select 1 from pg_constraint
    where conname = 'planification_blocs_portee_chk'
  ) then
    raise exception 'CHECK portee exclusive absente';
  end if;
  -- RLS active
  if not (select relrowsecurity from pg_class where oid = 'public.planification_blocs'::regclass) then
    raise exception 'RLS non active sur planification_blocs';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.planification_axes'::regclass) then
    raise exception 'RLS non active sur planification_axes';
  end if;
  -- 5 policies sur blocs (select/insert/update/delete) + 2 sur axes (select/write)
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='planification_blocs') <> 4 then
    raise exception 'planification_blocs : attendu 4 policies';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='planification_axes') <> 2 then
    raise exception 'planification_axes : attendu 2 policies';
  end if;
  -- amorçage : au moins les 21 libellés communs
  select count(*) into v_nax from public.planification_axes where categorie_id is null;
  if v_nax < 21 then
    raise exception 'amorçage axes incomplet : % lignes communes (attendu >= 21)', v_nax;
  end if;
  raise notice 'sql/73 OK — axes communs: %, RPC + RLS + CHECK en place', v_nax;
end;
$verif$;
