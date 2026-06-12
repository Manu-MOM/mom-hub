-- ============================================================================
-- MOM Hub · Chantier « Gestion du salarié » — IDENTIFICATION SALARIÉ
-- Fichier : sql/83 — contrats_salaries (table + RLS + RPC + amorçage Lohann)
-- ----------------------------------------------------------------------------
-- Objet : doter le Hub d'une identification salarié DISTINCTE de la dimension
--   staff. Le picker « Missions » de gestion-salarie.html liste aujourd'hui les
--   ~63 encadrants via list_staff_disponibles() ; il doit ne lister QUE les
--   salariés. On crée une relation contractuelle dédiée (table contrats_salaries)
--   + une RPC list_salaries() de même signature que list_staff_disponibles(),
--   pour substitution chirurgicale côté UI.
--
-- DOCTRINE (acté Manu, post-pt 82) :
--   - Identification salarié = TABLE dédiée (option 2), PAS un flag est_salarie
--     (contredit la doctrine « pas de booléen de dimension »), PAS un
--     détournement de type_personne / categorie_personne (écraserait le statut
--     FFR de Lohann). Le statut salarié est une dimension ORTHOGONALE : un
--     éducateur licencié peut être salarié OU bénévole.
--   - Nom : contrats_salaries (multi-contrats : une personne peut avoir des
--     contrats successifs). list_salaries() agrège par personne (DISTINCT
--     personne_id), donc une personne à 2 contrats successifs n'apparaît
--     qu'une fois dans le picker.
--   - missions.salarie_id reste FK -> personnes(id) (socle pt 78 inchangé,
--     zéro migration). contrats_salaries ne sert qu'à FILTRER le picker.
--   - OSSATURE STABLE uniquement : id/personne/type/quotité/dates/actif. Le
--     compteur d'heures et l'annualisation (dépendants de l'avenant CCNS non
--     signé) NE rentrent PAS ici -> DDL hypothèse séparé, non exécuté.
--     La période de référence août->juillet, utile au seul compteur, est tenue
--     HORS de cette table (constante club ; voir le DDL hypothèse).
--
-- Réf. sondes (lecture seule, exécutées par Manu) :
--   S7  list_staff_disponibles -> TABLE(personne_id uuid, nom text, prenom text)
--   S8  personnes(id uuid NN, nom text NN, prenom text NN, numero_licence_ffr text)
--   S9  _gs_peut_ecrire() = has_role('admin') or has_role('bureau')  (inchangée)
--   S10 sites(id uuid, code text, libelle text)  (lieu NON retenu dans l'ossature)
--
-- Patron calqué : sql/78 socle (RLS fermée + RPC SECURITY DEFINER gardées
--   _gs_peut_ecrire + REVOKE PUBLIC / GRANT authenticated + bloc DO fail-loud +
--   trigger updated_at global trigger_set_updated_at()).
-- Idempotent (create if not exists / create or replace), fail-loud, transaction.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE contrats_salaries — relation contractuelle (ossature STABLE)
-- ============================================================================
create table if not exists public.contrats_salaries (
  id                    uuid        primary key default gen_random_uuid(),
  personne_id           uuid        not null references public.personnes(id),
  type_contrat          text        not null
                          check (type_contrat in ('cdi','cdd','autre')),
  quotite_heures_hebdo  numeric,
  date_debut            date        not null,
  date_fin              date,
  actif                 boolean     not null default true,
  notes                 text,
  cree_par              uuid        references public.personnes(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);

comment on table public.contrats_salaries is
  'Identification salarié du Hub (relation contractuelle, dimension orthogonale au statut FFR). Ossature STABLE : ne porte AUCUN terme dépendant de l''avenant CCNS (le compteur d''heures / l''annualisation vivent dans un DDL hypothèse non exécuté). Multi-contrats : une personne peut avoir plusieurs contrats successifs.';
comment on column public.contrats_salaries.quotite_heures_hebdo is
  'Heures hebdomadaires contractuelles (ex. 35). Le DÉCOMPTE annuel / l''annualisation ne sont PAS ici (pré-avenant).';
comment on column public.contrats_salaries.date_fin is
  'NULL = contrat en cours (CDI ou CDD non échu).';
comment on column public.contrats_salaries.actif is
  'Drapeau de gestion. Un contrat est « courant » pour le picker s''il est actif ET que sa fenêtre [date_debut, date_fin] couvre la date du jour.';

create index if not exists idx_contrats_salaries_personne on public.contrats_salaries(personne_id);
create index if not exists idx_contrats_salaries_actif    on public.contrats_salaries(actif);

drop trigger if exists set_updated_at on public.contrats_salaries;
create trigger set_updated_at
  before update on public.contrats_salaries
  for each row execute function public.trigger_set_updated_at();

-- ============================================================================
-- 2. RLS — fermée (tout passe par les RPC SECURITY DEFINER)
-- ============================================================================
alter table public.contrats_salaries enable row level security;
-- Aucune policy permissive : lecture ET écriture passent par les RPC ci-dessous.

-- ============================================================================
-- 3. RPC de LECTURE
-- ============================================================================

-- list_salaries() : picker salarié. Signature IDENTIQUE à list_staff_disponibles
--   (personne_id, nom, prenom) -> substitution directe côté UI (loadSalaries).
--   Renvoie UNE ligne par personne ayant au moins un contrat COURANT
--   (actif ET fenêtre couvrant aujourd'hui). DISTINCT pour ne pas dédoubler une
--   personne multi-contrats.
create or replace function public.list_salaries()
returns table(personne_id uuid, nom text, prenom text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id as personne_id, p.nom, p.prenom
  from public.contrats_salaries cs
  join public.personnes p on p.id = cs.personne_id
  where cs.actif = true
    and cs.date_debut <= current_date
    and (cs.date_fin is null or cs.date_fin >= current_date)
  order by p.nom, p.prenom;
$$;
comment on function public.list_salaries() is
  'Picker salarié de l''onglet Missions. Renvoie (personne_id, nom, prenom) — même signature que list_staff_disponibles — pour les personnes ayant un contrat courant (actif + fenêtre couvrant aujourd''hui). DISTINCT : une personne multi-contrats n''apparaît qu''une fois.';

-- list_contrats_salaries() : liste de gestion (administration des contrats),
--   inclut les contrats inactifs/échus si demandé. Non consommée par le picker
--   Missions (réservée à un futur écran d'administration des contrats).
create or replace function public.list_contrats_salaries(p_inclure_inactifs boolean default false)
returns setof public.contrats_salaries
language sql
stable
security definer
set search_path = public
as $$
  select * from public.contrats_salaries
  where (p_inclure_inactifs or actif = true)
  order by date_debut desc;
$$;
comment on function public.list_contrats_salaries(boolean) is
  'Liste de gestion des contrats salariés (administration). p_inclure_inactifs=true pour voir aussi les contrats inactifs/échus.';

-- ============================================================================
-- 4. RPC d'ÉCRITURE — gardées _gs_peut_ecrire() (admin OU bureau)
-- ============================================================================

create or replace function public.upsert_contrat_salarie(
  p_id                   uuid,
  p_personne_id          uuid,
  p_type_contrat         text,
  p_quotite_heures_hebdo numeric default null,
  p_date_debut           date    default current_date,
  p_date_fin             date    default null,
  p_actif                boolean default true,
  p_notes                text    default null
)
returns public.contrats_salaries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.contrats_salaries;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  if p_id is null then
    insert into public.contrats_salaries (
      personne_id, type_contrat, quotite_heures_hebdo,
      date_debut, date_fin, actif, notes
    ) values (
      p_personne_id, p_type_contrat, p_quotite_heures_hebdo,
      coalesce(p_date_debut, current_date), p_date_fin, coalesce(p_actif, true), p_notes
    )
    returning * into v_row;
  else
    update public.contrats_salaries set
      personne_id          = p_personne_id,
      type_contrat         = p_type_contrat,
      quotite_heures_hebdo = p_quotite_heures_hebdo,
      date_debut           = coalesce(p_date_debut, date_debut),
      date_fin             = p_date_fin,
      actif                = coalesce(p_actif, actif),
      notes                = p_notes
    where id = p_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Contrat salarié introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$$;
comment on function public.upsert_contrat_salarie(uuid, uuid, text, numeric, date, date, boolean, text) is
  'Crée (p_id NULL) ou met à jour un contrat salarié. Garde admin OU bureau.';

create or replace function public.supprimer_contrat_salarie(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  delete from public.contrats_salaries where id = p_id;
end;
$$;
comment on function public.supprimer_contrat_salarie(uuid) is
  'Supprime un contrat salarié. Garde admin OU bureau. (Préférer p_actif=false pour conserver l''historique.)';

-- ============================================================================
-- 5. AMORÇAGE — Lohann HUMBERT (seul salarié à ce jour)
--   personne_id confirmé pt 79/82 (UUID stable, pas de fusion). Idempotent :
--   n'insère que si aucun contrat n'existe déjà pour cette personne.
-- ============================================================================
insert into public.contrats_salaries (personne_id, type_contrat, quotite_heures_hebdo, date_debut, actif, notes)
select '589e7977-748c-42db-b29c-0505ec0d2e41'::uuid, 'cdi', 35, date '2024-08-01', true,
       'Lohann HUMBERT — coach EDR temps plein. Amorçage sql/83. Annualisation = avenant CCNS (hors table).'
where not exists (
  select 1 from public.contrats_salaries
  where personne_id = '589e7977-748c-42db-b29c-0505ec0d2e41'::uuid
);

-- ============================================================================
-- 6. Permissions — REVOKE PUBLIC / GRANT authenticated (patron projet)
-- ============================================================================
revoke all on function
  public.list_salaries(),
  public.list_contrats_salaries(boolean),
  public.upsert_contrat_salarie(uuid, uuid, text, numeric, date, date, boolean, text),
  public.supprimer_contrat_salarie(uuid)
  from public;

grant execute on function
  public.list_salaries(),
  public.list_contrats_salaries(boolean),
  public.upsert_contrat_salarie(uuid, uuid, text, numeric, date, date, boolean, text),
  public.supprimer_contrat_salarie(uuid)
  to authenticated;

-- ============================================================================
-- 7. VÉRIFICATION fail-loud — invariants
-- ============================================================================
do $verif$
declare
  n_table   int;
  n_rpc     int;
  n_rls     int;
  n_lohann  int;
begin
  select count(*) into n_table
    from information_schema.tables
    where table_schema = 'public' and table_name = 'contrats_salaries';
  if n_table <> 1 then
    raise exception 'CONTRATS KO : table contrats_salaries absente.';
  end if;

  select count(*) into n_rpc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'list_salaries','list_contrats_salaries',
        'upsert_contrat_salarie','supprimer_contrat_salarie');
  if n_rpc < 4 then
    raise exception 'CONTRATS KO : % RPC sur 4 attendues.', n_rpc;
  end if;

  select count(*) into n_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'contrats_salaries'
      and c.relrowsecurity = true;
  if n_rls <> 1 then
    raise exception 'CONTRATS KO : RLS non active sur contrats_salaries.';
  end if;

  select count(*) into n_lohann
    from public.contrats_salaries
    where personne_id = '589e7977-748c-42db-b29c-0505ec0d2e41'::uuid;
  if n_lohann < 1 then
    raise exception 'CONTRATS KO : amorçage Lohann absent.';
  end if;

  raise notice 'CONTRATS OK : table + % RPC + RLS active + Lohann amorcé (% contrat).', n_rpc, n_lohann;
end;
$verif$;

commit;
