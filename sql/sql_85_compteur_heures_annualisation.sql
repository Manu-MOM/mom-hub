-- ============================================================================
-- MOM Hub · Gestion du salarié — COMPTEUR D'HEURES / ANNUALISATION (Lohann)
-- Fichier : sql/sql_85_compteur_heures_annualisation.sql
-- ----------------------------------------------------------------------------
-- OBJET : matérialiser le compteur d'heures annualisé rendu OBLIGATOIRE par
--   l'avenant d'annualisation de Lohann HUMBERT (art. 10 : « l'employeur tient
--   un décompte consultable par le salarié »). Décompte les heures réellement
--   effectuées sur la période de référence et les confronte au volume cible.
--
-- GATE : exécuté APRÈS avenant SIGNÉ + relu (paramètres arrêtés). Cf. kit de
--   passation v2 « PASSATION-compteur-heures-annualisation-v2.md ».
--
-- PARAMÈTRES ARRÊTÉS PAR L'AVENANT (stockés par PÉRIODE, jamais codés en dur
--   dans une contrainte — absorbe un futur 1 547 h, un prorata art. 9, ou un
--   passage du taux à 50 % sans toucher le SQL) :
--     · régime annualisation art. 12.8.1.5 CCNS / L. 3121-41
--     · période de référence  : 1er août -> 31 juillet
--     · 1re période           : 2026-08-01 -> 2027-07-31
--     · volume annuel cible   : 1 582 h (journée de solidarité incluse)
--     · plafond semaine haute : 44 h courant / 48 h exceptionnel
--     · plancher semaine basse: 0 h
--     · heures > cible         : repos compensateur, taux de majoration 25 %
--
-- DÉCISIONS DE CONCEPTION (session d'ouverture compteur) :
--   · CAPTATION = relevé dédié EXCLUSIF (releve_heures_salarie), découplé des
--     missions : source UNIQUE du compteur (pas de double comptage, missions
--     non polluées, art. 10 = un décompte dédié). mission_id reste un
--     rattachement OPTIONNEL et informatif, jamais la source des heures.
--   · GRANULARITÉ LIBRE par ligne : date_jour + heures obligatoires ;
--     heure_debut optionnel (créneau précis) OU absent (total agrégé du jour).
--     Le compteur somme `heures`, indifférent au grain de saisie.
--   · REPOS COMPENSATEUR : la vue expose les heures sup ET les DEUX calculs
--     (×1,25 remplacement intégral / ×0,25 majoration seule en sus) ; le choix
--     entre les deux relève de l'articulation art. 6/art. 7 (salaire lissé) et
--     se fait à l'affichage, sans regraver le SQL. Le TAUX (0,25) est stocké.
--
-- PATRON : calqué sql/83 contrats_salaries (RLS fermée + RPC SECURITY DEFINER
--   gardées _gs_peut_ecrire + REVOKE PUBLIC / GRANT authenticated + trigger
--   updated_at global trigger_set_updated_at() + bloc DO fail-loud).
--   Idempotent (create if not exists / create or replace), transaction.
--
-- INVARIANTS (kit v2 §5) :
--   · contrats_salaries reste l'ossature STABLE — non modifiée ici.
--   · periodes_annualisation.contrat_id -> contrats_salaries(id) ON DELETE CASCADE.
--   · releve_heures_salarie = source RÉELLE (art. 8), jamais l'horaire lissé.
--   · amorçage 1re période résolu par SOUS-REQUÊTE sur le contrat actif de
--     Lohann (un seul contrat actif sondé : 3d534990-…, CDI 35h, 2024-08-01).
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE periodes_annualisation — bornes + volume cible + seuils, par période
-- ============================================================================
create table if not exists public.periodes_annualisation (
  id                          uuid        primary key default gen_random_uuid(),
  contrat_id                  uuid        not null
                                references public.contrats_salaries(id) on delete cascade,
  date_debut                  date        not null,
  date_fin                    date        not null,
  volume_annuel_cible_heures  numeric     not null,
  seuil_haut_hebdo_heures     numeric,
  seuil_haut_except_hebdo_heures numeric,
  seuil_bas_hebdo_heures      numeric,
  taux_majoration_repos       numeric     not null default 0.25,
  notes                       text,
  cree_par                    uuid        references public.personnes(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (date_fin >= date_debut),
  check (taux_majoration_repos >= 0)
);

create index if not exists idx_periodes_annualisation_contrat
  on public.periodes_annualisation (contrat_id, date_debut);

drop trigger if exists set_updated_at on public.periodes_annualisation;
create trigger set_updated_at
  before update on public.periodes_annualisation
  for each row execute function public.trigger_set_updated_at();

-- ============================================================================
-- 2. TABLE releve_heures_salarie — flux d'heures RÉELLES (source unique compteur)
-- ============================================================================
create table if not exists public.releve_heures_salarie (
  id            uuid        primary key default gen_random_uuid(),
  contrat_id    uuid        not null
                  references public.contrats_salaries(id) on delete cascade,
  date_jour     date        not null,
  heures        numeric     not null check (heures >= 0),
  heure_debut   time,                         -- optionnel : NULL = total agrégé du jour
  categorie     text        not null default 'autre'
                  check (categorie in
                    ('seance','reunion','deplacement','formation','administratif','autre')),
  mission_id    uuid        references public.missions(id) on delete set null, -- rattachement informatif
  notes         text,
  cree_par      uuid        references public.personnes(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_releve_heures_contrat_date
  on public.releve_heures_salarie (contrat_id, date_jour);

drop trigger if exists set_updated_at on public.releve_heures_salarie;
create trigger set_updated_at
  before update on public.releve_heures_salarie
  for each row execute function public.trigger_set_updated_at();

-- ============================================================================
-- 3. RLS — fermée (tout passe par les RPC SECURITY DEFINER)
-- ============================================================================
alter table public.periodes_annualisation enable row level security;
alter table public.releve_heures_salarie  enable row level security;
-- Aucune policy permissive : lecture ET écriture passent par les RPC ci-dessous.

-- ============================================================================
-- 4. VUE v_compteur_annualisation — synthèse cible / réalisé / solde / repos
-- ----------------------------------------------------------------------------
--   realise_heures = somme du relevé sur la fenêtre [date_debut, date_fin].
--   solde_heures   = cible - réalisé (positif = sous la cible ; négatif = au-delà).
--   heures_sup     = max(réalisé - cible, 0).
--   repos_si_remplacement     = heures_sup * (1 + taux)  -> ×1,25 (heure+majo).
--   repos_si_majoration_seule = heures_sup * taux         -> ×0,25 (majo seule).
--   Le choix entre les deux relève de l'art. 6/art. 7 — tranché à l'affichage.
-- ============================================================================
create or replace view public.v_compteur_annualisation as
select
  pa.id                                   as periode_id,
  pa.contrat_id,
  pa.date_debut,
  pa.date_fin,
  pa.volume_annuel_cible_heures           as cible_heures,
  coalesce(sum(rh.heures), 0)             as realise_heures,
  pa.volume_annuel_cible_heures - coalesce(sum(rh.heures), 0) as solde_heures,
  greatest(coalesce(sum(rh.heures), 0) - pa.volume_annuel_cible_heures, 0) as heures_sup,
  pa.taux_majoration_repos,
  greatest(coalesce(sum(rh.heures), 0) - pa.volume_annuel_cible_heures, 0)
    * (1 + pa.taux_majoration_repos)      as repos_si_remplacement,
  greatest(coalesce(sum(rh.heures), 0) - pa.volume_annuel_cible_heures, 0)
    * pa.taux_majoration_repos            as repos_si_majoration_seule
from public.periodes_annualisation pa
left join public.releve_heures_salarie rh
  on rh.contrat_id = pa.contrat_id
 and rh.date_jour >= pa.date_debut
 and rh.date_jour <= pa.date_fin
group by pa.id, pa.contrat_id, pa.date_debut, pa.date_fin,
         pa.volume_annuel_cible_heures, pa.taux_majoration_repos;

-- ============================================================================
-- 5. RPC de LECTURE
-- ============================================================================

-- 5.1 Synthèse compteur d'un contrat (toutes ses périodes).
create or replace function public.list_compteur_annualisation(p_contrat_id uuid)
returns table (
  periode_id                 uuid,
  contrat_id                 uuid,
  date_debut                 date,
  date_fin                   date,
  cible_heures               numeric,
  realise_heures             numeric,
  solde_heures               numeric,
  heures_sup                 numeric,
  taux_majoration_repos      numeric,
  repos_si_remplacement      numeric,
  repos_si_majoration_seule  numeric
)
language sql
security definer
set search_path = public
as $$
  select v.periode_id, v.contrat_id, v.date_debut, v.date_fin,
         v.cible_heures, v.realise_heures, v.solde_heures, v.heures_sup,
         v.taux_majoration_repos, v.repos_si_remplacement, v.repos_si_majoration_seule
  from public.v_compteur_annualisation v
  where v.contrat_id = p_contrat_id
  order by v.date_debut;
$$;

-- 5.2 Détail des lignes de relevé d'une période (fenêtre du contrat).
create or replace function public.list_releve_heures(
  p_contrat_id uuid,
  p_date_debut date default null,
  p_date_fin   date default null
)
returns table (
  id          uuid,
  contrat_id  uuid,
  date_jour   date,
  heures      numeric,
  heure_debut time,
  categorie   text,
  mission_id  uuid,
  notes       text
)
language sql
security definer
set search_path = public
as $$
  select rh.id, rh.contrat_id, rh.date_jour, rh.heures, rh.heure_debut,
         rh.categorie, rh.mission_id, rh.notes
  from public.releve_heures_salarie rh
  where rh.contrat_id = p_contrat_id
    and (p_date_debut is null or rh.date_jour >= p_date_debut)
    and (p_date_fin   is null or rh.date_jour <= p_date_fin)
  order by rh.date_jour, rh.heure_debut nulls last;
$$;

-- 5.3 Liste des périodes d'un contrat (gestion).
create or replace function public.list_periodes_annualisation(p_contrat_id uuid)
returns setof public.periodes_annualisation
language sql
security definer
set search_path = public
as $$
  select * from public.periodes_annualisation
  where contrat_id = p_contrat_id
  order by date_debut;
$$;

-- ============================================================================
-- 6. RPC d'ÉCRITURE — gardées _gs_peut_ecrire() (admin OU bureau)
-- ============================================================================

-- 6.1 Upsert d'une ligne de relevé d'heures.
create or replace function public.upsert_releve_heures(
  p_id          uuid    default null,
  p_contrat_id  uuid    default null,
  p_date_jour   date    default null,
  p_heures      numeric default null,
  p_heure_debut time    default null,
  p_categorie   text    default 'autre',
  p_mission_id  uuid    default null,
  p_notes       text    default null
)
returns public.releve_heures_salarie
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.releve_heures_salarie;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  if p_id is null then
    insert into public.releve_heures_salarie (
      contrat_id, date_jour, heures, heure_debut, categorie, mission_id, notes
    ) values (
      p_contrat_id, p_date_jour, p_heures, p_heure_debut, p_categorie, p_mission_id, p_notes
    )
    returning * into v_row;
  else
    update public.releve_heures_salarie set
      contrat_id  = coalesce(p_contrat_id, contrat_id),
      date_jour   = coalesce(p_date_jour, date_jour),
      heures      = coalesce(p_heures, heures),
      heure_debut = p_heure_debut,
      categorie   = coalesce(p_categorie, categorie),
      mission_id  = p_mission_id,
      notes       = p_notes
    where id = p_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Ligne de relevé introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$$;

-- 6.2 Suppression d'une ligne de relevé.
create or replace function public.supprimer_releve_heures(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  delete from public.releve_heures_salarie where id = p_id;
end;
$$;

-- 6.3 Upsert d'une période d'annualisation.
create or replace function public.upsert_periode_annualisation(
  p_id                          uuid    default null,
  p_contrat_id                  uuid    default null,
  p_date_debut                  date    default null,
  p_date_fin                    date    default null,
  p_volume_annuel_cible_heures  numeric default null,
  p_seuil_haut_hebdo_heures     numeric default null,
  p_seuil_haut_except_hebdo_heures numeric default null,
  p_seuil_bas_hebdo_heures      numeric default null,
  p_taux_majoration_repos       numeric default 0.25,
  p_notes                       text    default null
)
returns public.periodes_annualisation
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.periodes_annualisation;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  if p_id is null then
    insert into public.periodes_annualisation (
      contrat_id, date_debut, date_fin, volume_annuel_cible_heures,
      seuil_haut_hebdo_heures, seuil_haut_except_hebdo_heures,
      seuil_bas_hebdo_heures, taux_majoration_repos, notes
    ) values (
      p_contrat_id, p_date_debut, p_date_fin, p_volume_annuel_cible_heures,
      p_seuil_haut_hebdo_heures, p_seuil_haut_except_hebdo_heures,
      p_seuil_bas_hebdo_heures, coalesce(p_taux_majoration_repos, 0.25), p_notes
    )
    returning * into v_row;
  else
    update public.periodes_annualisation set
      contrat_id                    = coalesce(p_contrat_id, contrat_id),
      date_debut                    = coalesce(p_date_debut, date_debut),
      date_fin                      = coalesce(p_date_fin, date_fin),
      volume_annuel_cible_heures    = coalesce(p_volume_annuel_cible_heures, volume_annuel_cible_heures),
      seuil_haut_hebdo_heures       = p_seuil_haut_hebdo_heures,
      seuil_haut_except_hebdo_heures = p_seuil_haut_except_hebdo_heures,
      seuil_bas_hebdo_heures        = p_seuil_bas_hebdo_heures,
      taux_majoration_repos         = coalesce(p_taux_majoration_repos, taux_majoration_repos),
      notes                         = p_notes
    where id = p_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Période d''annualisation introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$$;

-- 6.4 Suppression d'une période d'annualisation.
create or replace function public.supprimer_periode_annualisation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  delete from public.periodes_annualisation where id = p_id;
end;
$$;

-- ============================================================================
-- 7. Permissions — REVOKE PUBLIC / GRANT authenticated (patron projet)
-- ============================================================================
revoke all on function
  public.list_compteur_annualisation(uuid),
  public.list_releve_heures(uuid, date, date),
  public.list_periodes_annualisation(uuid),
  public.upsert_releve_heures(uuid, uuid, date, numeric, time, text, uuid, text),
  public.supprimer_releve_heures(uuid),
  public.upsert_periode_annualisation(uuid, uuid, date, date, numeric, numeric, numeric, numeric, numeric, text),
  public.supprimer_periode_annualisation(uuid)
  from public;

grant execute on function
  public.list_compteur_annualisation(uuid),
  public.list_releve_heures(uuid, date, date),
  public.list_periodes_annualisation(uuid),
  public.upsert_releve_heures(uuid, uuid, date, numeric, time, text, uuid, text),
  public.supprimer_releve_heures(uuid),
  public.upsert_periode_annualisation(uuid, uuid, date, date, numeric, numeric, numeric, numeric, numeric, text),
  public.supprimer_periode_annualisation(uuid)
  to authenticated;

-- ============================================================================
-- 8. AMORÇAGE — 1re période d'annualisation de Lohann (idempotent)
-- ----------------------------------------------------------------------------
--   contrat_id résolu par SOUS-REQUÊTE sur le contrat actif de Lohann
--   (un seul contrat actif sondé). Pas d'UUID en dur. Rejouable sans doublon
--   (where not exists sur la fenêtre exacte de la période).
-- ============================================================================
insert into public.periodes_annualisation (
  contrat_id, date_debut, date_fin, volume_annuel_cible_heures,
  seuil_haut_hebdo_heures, seuil_haut_except_hebdo_heures,
  seuil_bas_hebdo_heures, taux_majoration_repos, notes
)
select c.id, date '2026-08-01', date '2027-07-31', 1582,
       44, 48, 0, 0.25,
       'Amorçage 1re période d''annualisation (avenant Lohann, art. 2/3/4/6).'
from public.contrats_salaries c
where c.personne_id = '589e7977-748c-42db-b29c-0505ec0d2e41'::uuid
  and c.actif = true
  and not exists (
    select 1 from public.periodes_annualisation pa
    where pa.contrat_id = c.id
      and pa.date_debut = date '2026-08-01'
      and pa.date_fin   = date '2027-07-31'
  );

-- ============================================================================
-- 9. VÉRIFICATION fail-loud — invariants
-- ============================================================================
do $verif$
declare
  n_tables  int;
  n_view    int;
  n_rpc     int;
  n_rls     int;
  n_periode int;
begin
  select count(*) into n_tables
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('periodes_annualisation','releve_heures_salarie');
  if n_tables <> 2 then
    raise exception 'COMPTEUR KO : % tables sur 2 attendues.', n_tables;
  end if;

  select count(*) into n_view
    from information_schema.views
    where table_schema = 'public' and table_name = 'v_compteur_annualisation';
  if n_view <> 1 then
    raise exception 'COMPTEUR KO : vue v_compteur_annualisation absente.';
  end if;

  select count(*) into n_rpc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'list_compteur_annualisation','list_releve_heures','list_periodes_annualisation',
        'upsert_releve_heures','supprimer_releve_heures',
        'upsert_periode_annualisation','supprimer_periode_annualisation');
  if n_rpc < 7 then
    raise exception 'COMPTEUR KO : % RPC sur 7 attendues.', n_rpc;
  end if;

  select count(*) into n_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('periodes_annualisation','releve_heures_salarie')
      and c.relrowsecurity = true;
  if n_rls <> 2 then
    raise exception 'COMPTEUR KO : RLS non active sur les 2 tables (% actives).', n_rls;
  end if;

  select count(*) into n_periode
    from public.periodes_annualisation pa
    join public.contrats_salaries c on c.id = pa.contrat_id
    where c.personne_id = '589e7977-748c-42db-b29c-0505ec0d2e41'::uuid
      and pa.date_debut = date '2026-08-01';
  if n_periode < 1 then
    raise exception 'COMPTEUR KO : amorçage 1re période Lohann absent.';
  end if;

  raise notice 'COMPTEUR OK : 2 tables + vue + % RPC + RLS active + 1re période Lohann amorcée.', n_rpc;
end;
$verif$;

commit;
