-- ============================================================================
-- MOM Hub · Chantier « Gestion du salarié » — SOCLE DE DONNÉES (3 tables)
-- Fichier : sql/78 — entites / missions / mission_seances
-- ----------------------------------------------------------------------------
-- Réf. conception : Kit de passation « Gestion du salarié » v3 (§1 socle figé).
--
-- Sondes à la source (DS-1, base fait foi pt 14) — re-confirmées pt 78 :
--   - cree_par uuid REFERENCES personnes(id) ON DELETE SET NULL  (patron sql_61_fonction_staff)
--   - PK uuid DEFAULT gen_random_uuid()                          (patron récent)
--   - saisons(id uuid PK, est_active boolean)                    (sql/01)
--   - sites(id uuid PK)                                          (logistique sql 01-ressources)
--   - categories(id uuid PK)                                     (sql/01)
--   - personnes(id uuid PK)                                      (sql/01)
--   - has_role(p_role text) SECURITY DEFINER + RLS fermée + RPC  (patron fonction_staff)
--   - trigger global public.trigger_set_updated_at()             (sql/01, réutilisé)
--
-- Décisions actées :
--   - Q1..Q6 + Option A (stage = mission interne) + récurrence simple + livrables option simple
--     (kit v3 §0). Le compteur d'heures (§4) NE fait PAS partie de ce socle.
--   - Audit = cree_par SEUL (FK personnes, ON DELETE SET NULL). PAS de modifie_par
--     (décision Claude, mandat pt 17 : calque fonction_staff ; updated_at couvre le « quand »).
--   - Écriture = RLS fermée, tout par RPC SECURITY DEFINER gardées has_role('admin')
--     OR has_role('bureau') (module RH = admin + bureau ; B5 catégoriel NE s'applique pas).
--   - Invariant compteur (kit v3 §1) : s'il existe des mission_seances, on lit les séances ;
--     sinon on lit la mission. Jamais les deux. (Porté côté lecture/agrégation, pas en DDL.)
--
-- Idempotent (CREATE IF NOT EXISTS / DROP FUNCTION IF EXISTS) ; fail-loud (bloc DO final).
-- À EXÉCUTER par Manu dans le SQL Editor Supabase (domaine hors allowlist Claude).
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE entites — bénéficiaires pérennes (écoles, clubs, MJC, internes)
-- ============================================================================
create table if not exists public.entites (
  id                   uuid        primary key default gen_random_uuid(),
  code                 text        not null unique,
  libelle              text        not null,
  libelle_court        text,
  type_entite          text        not null
                         check (type_entite in
                           ('ecole_elementaire','college','lycee','mjc','club','interne','autre')),
  site_id              uuid        references public.sites(id) on delete set null,
  refacturable_defaut  boolean     not null default false,
  contact_nom          text,
  contact_email        text,
  statut_prospection   text
                         check (statut_prospection is null or statut_prospection in
                           ('a_contacter','contacte','interesse','client','inactif')),
  actif                boolean     not null default true,
  notes                text,
  cree_par             uuid        references public.personnes(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.entites is
  'Bénéficiaires pérennes des missions du salarié (écoles, clubs, MJC, internes MOM/SAR). Référentiel SANS saison.';
comment on column public.entites.statut_prospection is
  'NULL pour les internes ; sinon a_contacter|contacte|interesse|client|inactif (Module B prospection).';

drop trigger if exists set_updated_at on public.entites;
create trigger set_updated_at
  before update on public.entites
  for each row execute function public.trigger_set_updated_at();

-- ============================================================================
-- 2. TABLE missions — le tronc (1 mission = 1 bénéficiaire = 1 saison)
-- ============================================================================
create table if not exists public.missions (
  id                  uuid        primary key default gen_random_uuid(),
  code                text        not null unique,
  libelle             text        not null,
  type_mission        text        not null
                        check (type_mission in
                          ('intervention_ecole','stage','reunion',
                           'entrainement_interne','prepa','autre')),
  salarie_id          uuid        not null references public.personnes(id),
  entite_id           uuid        not null references public.entites(id),
  saison_id           uuid        not null references public.saisons(id),
  lieu_id             uuid        references public.sites(id) on delete set null,
  lieu_libre          text,
  date_debut          date        not null,
  date_fin            date,
  recurrence          jsonb,
  est_cadre           boolean     not null default false,
  refacturable        boolean     not null default false,
  etat                text        not null default 'prevue'
                        check (etat in ('prevue','terminee','annulee')),
  bilan_text          text,
  questionnaire_fait  boolean     not null default false,
  notes               text,
  cree_par            uuid        references public.personnes(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint missions_dates_chk check (date_fin is null or date_fin >= date_debut)
);

comment on table public.missions is
  'Tronc du suivi salarié : une mission = 1 salarié, 1 bénéficiaire (entite), 1 saison. Refacturation au forfait (drapeau refacturable). Le forfait n''est PAS la somme des séances.';
comment on column public.missions.recurrence is
  'Règle descriptive légère {frequence,jour,creneau} — PAS un moteur de récurrence.';
comment on column public.missions.est_cadre is
  'Caractère « mission cadre » (livrables) = choix explicite, PAS déduit du nombre de séances.';

create index if not exists idx_missions_salarie on public.missions(salarie_id);
create index if not exists idx_missions_entite  on public.missions(entite_id);
create index if not exists idx_missions_saison  on public.missions(saison_id);

drop trigger if exists set_updated_at on public.missions;
create trigger set_updated_at
  before update on public.missions
  for each row execute function public.trigger_set_updated_at();

-- ============================================================================
-- 3. TABLE mission_seances — occurrences optionnelles (jamais orphelines)
-- ============================================================================
create table if not exists public.mission_seances (
  id              uuid        primary key default gen_random_uuid(),
  mission_id      uuid        not null references public.missions(id) on delete cascade,
  date_seance     date        not null,
  heure_debut     time,
  duree_min       integer,
  lieu_id         uuid        references public.sites(id) on delete set null,
  lieu_libre      text,
  refacturable    boolean,     -- NULL = couverte par forfait | true = bonus en sus | false = exclue
  etat            text        not null default 'prevue'
                    check (etat in ('prevue','realisee','annulee')),
  heures_reelles  numeric,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.mission_seances is
  'Occurrences optionnelles d''une mission (jamais orphelines, ON DELETE CASCADE). Héritage lieu/horaire : valeur séance prime, sinon mission. Invariant compteur : si des séances existent, on lit les séances ; sinon la mission ; jamais les deux.';
comment on column public.mission_seances.refacturable is
  'NULL = couverte par le forfait | true = bonus facturé en sus | false = exclue.';

create index if not exists idx_mission_seances_mission on public.mission_seances(mission_id);
create index if not exists idx_mission_seances_date    on public.mission_seances(date_seance);

drop trigger if exists set_updated_at on public.mission_seances;
create trigger set_updated_at
  before update on public.mission_seances
  for each row execute function public.trigger_set_updated_at();

-- ============================================================================
-- 4. RLS — fermée sur les 3 tables (tout passe par les RPC SECURITY DEFINER)
-- ============================================================================
alter table public.entites         enable row level security;
alter table public.missions        enable row level security;
alter table public.mission_seances enable row level security;
-- Aucune policy permissive : lecture ET écriture passent par les RPC ci-dessous.

-- ============================================================================
-- 5. Garde commune — admin OU bureau (module RH)
-- ============================================================================
create or replace function public._gs_peut_ecrire()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role('admin') or has_role('bureau');
$$;
comment on function public._gs_peut_ecrire() is
  'Garde du module Gestion du salarié : admin OU bureau. B5 catégoriel ne s''applique pas (missions non catégorielles).';

-- ============================================================================
-- 6. RPC de LECTURE (SECURITY DEFINER, authentifié)
-- ============================================================================
create or replace function public.list_entites(p_inclure_inactives boolean default false)
returns setof public.entites
language sql
stable
security definer
set search_path = public
as $$
  select * from public.entites
  where (p_inclure_inactives or actif = true)
  order by libelle;
$$;

create or replace function public.list_missions(
  p_saison_id uuid    default null,
  p_salarie_id uuid   default null,
  p_entite_id uuid    default null
)
returns setof public.missions
language sql
stable
security definer
set search_path = public
as $$
  select * from public.missions
  where (p_saison_id  is null or saison_id  = p_saison_id)
    and (p_salarie_id is null or salarie_id = p_salarie_id)
    and (p_entite_id  is null or entite_id  = p_entite_id)
  order by date_debut desc;
$$;

create or replace function public.list_mission_seances(p_mission_id uuid)
returns setof public.mission_seances
language sql
stable
security definer
set search_path = public
as $$
  select * from public.mission_seances
  where mission_id = p_mission_id
  order by date_seance, heure_debut nulls last;
$$;

-- ============================================================================
-- 7. RPC d'ÉCRITURE — entites
-- ============================================================================
create or replace function public.upsert_entite(
  p_id                  uuid,
  p_code                text,
  p_libelle             text,
  p_type_entite         text,
  p_libelle_court       text    default null,
  p_site_id             uuid    default null,
  p_refacturable_defaut boolean default false,
  p_contact_nom         text    default null,
  p_contact_email       text    default null,
  p_statut_prospection  text    default null,
  p_actif               boolean default true,
  p_notes               text    default null
)
returns public.entites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.entites;
  v_me  uuid;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_libelle), '') = '' then
    raise exception 'Le code et le libellé sont obligatoires.';
  end if;

  select personne_id into v_me from public.qui_suis_je();

  if p_id is null then
    insert into public.entites(
      code, libelle, libelle_court, type_entite, site_id, refacturable_defaut,
      contact_nom, contact_email, statut_prospection, actif, notes, cree_par)
    values(
      p_code, p_libelle, p_libelle_court, p_type_entite, p_site_id, p_refacturable_defaut,
      p_contact_nom, p_contact_email, p_statut_prospection, p_actif, p_notes, v_me)
    returning * into v_row;
  else
    update public.entites set
      code = p_code, libelle = p_libelle, libelle_court = p_libelle_court,
      type_entite = p_type_entite, site_id = p_site_id,
      refacturable_defaut = p_refacturable_defaut,
      contact_nom = p_contact_nom, contact_email = p_contact_email,
      statut_prospection = p_statut_prospection, actif = p_actif, notes = p_notes
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Entité introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$$;

-- ============================================================================
-- 8. RPC d'ÉCRITURE — missions
-- ============================================================================
create or replace function public.upsert_mission(
  p_id                 uuid,
  p_code               text,
  p_libelle            text,
  p_type_mission       text,
  p_salarie_id         uuid,
  p_entite_id          uuid,
  p_saison_id          uuid,
  p_date_debut         date,
  p_lieu_id            uuid    default null,
  p_lieu_libre         text    default null,
  p_date_fin           date    default null,
  p_recurrence         jsonb   default null,
  p_est_cadre          boolean default false,
  p_refacturable       boolean default null,   -- null => repris de entites.refacturable_defaut
  p_etat               text    default 'prevue',
  p_bilan_text         text    default null,
  p_questionnaire_fait boolean default false,
  p_notes              text    default null
)
returns public.missions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    public.missions;
  v_me     uuid;
  v_refac  boolean;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_libelle), '') = '' then
    raise exception 'Le code et le libellé sont obligatoires.';
  end if;

  -- refacturable : si non fourni, pré-rempli depuis le bénéficiaire (Q4)
  if p_refacturable is null then
    select refacturable_defaut into v_refac from public.entites where id = p_entite_id;
    v_refac := coalesce(v_refac, false);
  else
    v_refac := p_refacturable;
  end if;

  select personne_id into v_me from public.qui_suis_je();

  if p_id is null then
    insert into public.missions(
      code, libelle, type_mission, salarie_id, entite_id, saison_id,
      lieu_id, lieu_libre, date_debut, date_fin, recurrence, est_cadre,
      refacturable, etat, bilan_text, questionnaire_fait, notes, cree_par)
    values(
      p_code, p_libelle, p_type_mission, p_salarie_id, p_entite_id, p_saison_id,
      p_lieu_id, p_lieu_libre, p_date_debut, p_date_fin, p_recurrence, p_est_cadre,
      v_refac, p_etat, p_bilan_text, p_questionnaire_fait, p_notes, v_me)
    returning * into v_row;
  else
    update public.missions set
      code = p_code, libelle = p_libelle, type_mission = p_type_mission,
      salarie_id = p_salarie_id, entite_id = p_entite_id, saison_id = p_saison_id,
      lieu_id = p_lieu_id, lieu_libre = p_lieu_libre, date_debut = p_date_debut,
      date_fin = p_date_fin, recurrence = p_recurrence, est_cadre = p_est_cadre,
      refacturable = v_refac, etat = p_etat, bilan_text = p_bilan_text,
      questionnaire_fait = p_questionnaire_fait, notes = p_notes
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Mission introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.supprimer_mission(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  delete from public.missions where id = p_id;  -- CASCADE sur mission_seances
  if not found then
    raise exception 'Mission introuvable : %', p_id;
  end if;
end;
$$;

-- ============================================================================
-- 9. RPC d'ÉCRITURE — mission_seances
-- ============================================================================
create or replace function public.upsert_mission_seance(
  p_id             uuid,
  p_mission_id     uuid,
  p_date_seance    date,
  p_heure_debut    time    default null,
  p_duree_min      integer default null,
  p_lieu_id        uuid    default null,
  p_lieu_libre     text    default null,
  p_refacturable   boolean default null,
  p_etat           text    default 'prevue',
  p_heures_reelles numeric default null,
  p_notes          text    default null
)
returns public.mission_seances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mission_seances;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  if p_id is null then
    insert into public.mission_seances(
      mission_id, date_seance, heure_debut, duree_min, lieu_id, lieu_libre,
      refacturable, etat, heures_reelles, notes)
    values(
      p_mission_id, p_date_seance, p_heure_debut, p_duree_min, p_lieu_id, p_lieu_libre,
      p_refacturable, p_etat, p_heures_reelles, p_notes)
    returning * into v_row;
  else
    update public.mission_seances set
      date_seance = p_date_seance, heure_debut = p_heure_debut, duree_min = p_duree_min,
      lieu_id = p_lieu_id, lieu_libre = p_lieu_libre, refacturable = p_refacturable,
      etat = p_etat, heures_reelles = p_heures_reelles, notes = p_notes
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Séance introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.supprimer_mission_seance(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  delete from public.mission_seances where id = p_id;
  if not found then
    raise exception 'Séance introuvable : %', p_id;
  end if;
end;
$$;

-- ============================================================================
-- 10. Permissions — REVOKE PUBLIC / GRANT authenticated (patron projet)
-- ============================================================================
revoke all on function
  public._gs_peut_ecrire(),
  public.list_entites(boolean),
  public.list_missions(uuid, uuid, uuid),
  public.list_mission_seances(uuid),
  public.upsert_entite(uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text),
  public.upsert_mission(uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb, boolean, boolean, text, text, boolean, text),
  public.supprimer_mission(uuid),
  public.upsert_mission_seance(uuid, uuid, date, time, integer, uuid, text, boolean, text, numeric, text),
  public.supprimer_mission_seance(uuid)
  from public;

grant execute on function
  public.list_entites(boolean),
  public.list_missions(uuid, uuid, uuid),
  public.list_mission_seances(uuid),
  public.upsert_entite(uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text),
  public.upsert_mission(uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb, boolean, boolean, text, text, boolean, text),
  public.supprimer_mission(uuid),
  public.upsert_mission_seance(uuid, uuid, date, time, integer, uuid, text, boolean, text, numeric, text),
  public.supprimer_mission_seance(uuid)
  to authenticated;

-- ============================================================================
-- 11. VÉRIFICATION fail-loud — invariants du socle
-- ============================================================================
do $verif$
declare
  n_tables  int;
  n_rpc     int;
  n_rls     int;
begin
  select count(*) into n_tables
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('entites','missions','mission_seances');
  if n_tables <> 3 then
    raise exception 'SOCLE KO : % table(s) sur 3 attendues.', n_tables;
  end if;

  select count(*) into n_rpc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        '_gs_peut_ecrire','list_entites','list_missions','list_mission_seances',
        'upsert_entite','upsert_mission','supprimer_mission',
        'upsert_mission_seance','supprimer_mission_seance');
  if n_rpc < 9 then
    raise exception 'SOCLE KO : % RPC sur 9 attendues.', n_rpc;
  end if;

  select count(*) into n_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('entites','missions','mission_seances')
      and c.relrowsecurity = true;
  if n_rls <> 3 then
    raise exception 'SOCLE KO : RLS active sur % table(s) sur 3.', n_rls;
  end if;

  raise notice 'SOCLE OK : 3 tables, % RPC, RLS active sur 3 tables.', n_rpc;
end;
$verif$;

commit;
