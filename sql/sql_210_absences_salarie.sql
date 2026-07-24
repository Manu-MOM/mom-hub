-- =====================================================================
-- sql_210_absences_salarie.sql
-- Chantier : ABSENCES-SALARIE-REPOS-CONGES
-- Objet    : tracer les temps NON TRAVAILLES de Lohann (repos, conges)
--            dans une table DEDIEE, strictement decouplee des missions,
--            + garde anti-chevauchement + controle des 35 h hebdomadaires.
--
-- ORIGINE : demande Manu (vue avec Vanessa). Besoin initial = « voir les
--   temps off au planning ». L'analyse a fait apparaitre un besoin plus
--   fort : DETECTER les semaines ou le repos hebdomadaire legal n'est pas
--   atteint. Cas reel rencontre en seance : vendredi fin 21:00 -> dimanche
--   debut 08:00 = 35 h PILE, aucune marge ; a 21:15 le vendredi on tombe a
--   34 h 45, non conforme, SANS QUE RIEN NE LE SIGNALE aujourd'hui.
--
-- CADRE JURIDIQUE (recherche de seance, non juridique — a faire valider
--   par l'expert-comptable / conseiller CCNS) :
--   · Repos hebdomadaire = 24 h consecutives (C. trav. L3132-2) + 11 h de
--     repos quotidien (L3131-1) = 35 h CONSECUTIVES minimum par semaine.
--     Duree INCOMPRESSIBLE ET INDIVISIBLE : ne se fractionne pas.
--   · Max 6 jours travailles par semaine (L3132-1).
--   · CCNS (IDCC 2511) : derogation au repos dominical pour l'encadrement
--     sportif ; repos quotidien 11 h reductible a 9 h apres deplacement.
--   · Lohann travaille 14 dimanches/an (J1-J14 championnat seniors) : le
--     travail dominical n'est PAS « habituel » au sens CCNS (37-42 dimanches
--     libres), l'obligation « 2 jours consecutifs OU 11 dimanches non
--     travailles » n'est donc pas le risque ici. LE RISQUE EST LES 35 H.
--
-- MODELE ANNUALISATION — POURQUOI CES CRENEAUX NE COMPTENT AUCUNE HEURE :
--   La cible de 1 582 h est NETTE de conges et de repos (365 j - 104 repos
--   - 25 CP - 8 feries - 1 solidarite = 229 j travailles). Un jour de conge
--   vaut donc 0 h au compteur : les heures ne sont NI decomptees NI
--   recuperables. C'est le « modele A ». Le Hub l'applique deja sans le
--   savoir : releve_heures_salarie ne contient que des heures SAISIES, et
--   sync_releve_depuis_occurrence n'alimente le compteur que sur l'etat
--   'validee'. Une absence qui ne cree aucune ligne de releve EST le
--   comportement correct. >>> AUCUNE JOINTURE VERS LE COMPTEUR ICI. <<<
--
-- DECISIONS STRUCTURANTES (Manu, gelees avant code) :
--   D1. TABLE DEDIEE, pas un 12e type_mission. Exigence Manu :
--       « pas d'amalgame possible » entre missions et creneaux de repos.
--       Un repos rangé dans missions.type_mission serait apparu dans les
--       listes, filtres et exports de missions. Garantie STRUCTURELLE
--       plutot que disciplinaire.
--   D2. DEUX natures seulement : 'repos' | 'conges_payes'.
--       'jour_ferie' ABANDONNE en seance : sonde DS-1 -> les feries
--       existent DEJA (data/vacances-feries-2026-2027.json, 13 feries
--       Alsace-Moselle) et sont deja rendus dans l'agenda (type 'ferie',
--       via reperesFenetre). Un ferie est une propriete du CALENDRIER,
--       pas une absence du salarie. Deux objets 'ferie' = confusion.
--   D3. BORNES HORAIRES REELLES (date+heure debut / date+heure fin), pas
--       un « jour off ». Un repos hebdomadaire traverse TROIS jours
--       calendaires (ven 21:00 -> dim 08:00) ; le reduire au samedi
--       perdrait exactement les minutes qui font la conformite.
--   D4. Le caractere « hebdomadaire » n'est JAMAIS SAISI, il est CALCULE.
--       Motif : la meme saisie change de nature selon le contexte (un
--       samedi off est le repos hebdo s'il n'y en a pas d'autre, du
--       compensateur sinon). Faire declarer la qualification a l'operateur
--       reviendrait a lui faire trancher une question dont il n'a pas les
--       elements — et une semaine non conforme pourrait etre marquee
--       conforme. Un objet ne porte pas une qualification deductible.
--   D5. ANTI-CHEVAUCHEMENT BLOQUANT, EN BASE, DANS LES DEUX SENS.
--       Un repos qui chevauche une mission n'est pas un repos. Si on
--       tolerait le chevauchement, le controle des 35 h lirait un bloc
--       continu la ou il y a deux fragments -> il afficherait « conforme »
--       sur une semaine qui ne l'est pas. Un controle qui peut mentir est
--       pire que pas de controle. Garde en BASE (et non en JS) car sinon
--       on contourne la regle en inversant l'ordre de saisie.
--   D6. Conges = UNE LIGNE PAR PERIODE (pas une par jour), eclatee a
--       l'affichage. Reutilise le patron eprouve de reperesFenetre /
--       chaqueJourISO deja en place pour les vacances scolaires.
--   D7. Solde de conges HORS PERIMETRE (visibilite seule).
--
-- PRE-REQUIS APPLIQUE EN SEANCE (hors ce fichier) : les 14 seances sans
--   heure_debut (J1-J14 championnat seniors, tous dimanches) ont ete
--   renseignees a 11:00 avec trace « Horaire provisoire (11:00) — a
--   confirmer » dans notes. Consequence : PLUS AUCUNE seance sans heure
--   -> l'anti-chevauchement travaille sur des intervalles reels et la
--   regle « seance sans heure occupe sa journee » devient SANS OBJET.
--
-- PATRON : calque sql_85 (compteur) — RLS fermee + RPC SECURITY DEFINER
--   gardees _gs_peut_ecrire() + REVOKE PUBLIC / GRANT authenticated +
--   trigger_set_updated_at() + blocs DO fail-loud. Idempotent.
-- INTERDITS : js/hub-agenda.js NON TOUCHE. Sonde DS-1 : HubAgenda recoit
--   ses donnees par callback fetchWindow(), il ne les cherche pas. Les
--   absences seront une 3e source concatenee cote page, exactement comme
--   reperesFenetre() l'est deja. Aucune modification du fichier INTERDIT.
-- =====================================================================

begin;

-- ============================================================================
-- 1. TABLE absences_salarie
-- ----------------------------------------------------------------------------
--   Bornes : date_debut + heure_debut -> date_fin + heure_fin.
--   journee_entiere = true  -> heures ignorees, bornes 00:00 -> 23:59:59.
--   Un conge d'une semaine = UNE ligne (D6).
-- ============================================================================
create table if not exists public.absences_salarie (
  id               uuid        primary key default gen_random_uuid(),
  contrat_id       uuid        not null
                     references public.contrats_salaries(id) on delete cascade,
  nature           text        not null
                     check (nature in ('repos','conges_payes')),
  date_debut       date        not null,
  heure_debut      time,
  date_fin         date        not null,
  heure_fin        time,
  journee_entiere  boolean     not null default false,
  motif            text,
  notes            text,
  cree_par         uuid        references public.personnes(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint absences_salarie_ordre_dates check (date_fin >= date_debut),
  constraint absences_salarie_bornes_coherentes check (
    journee_entiere = true
    or (heure_debut is not null and heure_fin is not null)
  )
);

create index if not exists idx_absences_salarie_contrat_dates
  on public.absences_salarie (contrat_id, date_debut, date_fin);

drop trigger if exists set_updated_at on public.absences_salarie;
create trigger set_updated_at
  before update on public.absences_salarie
  for each row execute function public.trigger_set_updated_at();

alter table public.absences_salarie enable row level security;
-- Aucune policy permissive : tout passe par les RPC SECURITY DEFINER.

-- ============================================================================
-- 2. HELPER — bornes timestamp d'une absence (journee entiere absorbee)
-- ============================================================================
create or replace function public._abs_bornes(
  p_date_debut date, p_heure_debut time,
  p_date_fin date,   p_heure_fin time,
  p_journee_entiere boolean
)
returns table (ts_debut timestamp, ts_fin timestamp)
language sql
immutable
as $$
  select
    (p_date_debut + coalesce(case when p_journee_entiere then time '00:00' else p_heure_debut end, time '00:00'))::timestamp,
    (p_date_fin   + coalesce(case when p_journee_entiere then time '23:59:59' else p_heure_fin end, time '23:59:59'))::timestamp;
$$;

-- ============================================================================
-- 3. DETECTION DE CHEVAUCHEMENT (D5) — absence <-> seances de mission
-- ----------------------------------------------------------------------------
--   Retourne les seances ACTIVES (etat <> 'annulee') du salarie qui
--   chevauchent l'intervalle de l'absence. Intervalle seance reconstruit
--   depuis date_seance + heure_debut + duree_min.
--   Chevauchement strict : debut_a < fin_b AND debut_b < fin_a.
-- ============================================================================
create or replace function public.absence_conflits(
  p_contrat_id      uuid,
  p_date_debut      date,
  p_heure_debut     time,
  p_date_fin        date,
  p_heure_fin       time,
  p_journee_entiere boolean default false,
  p_exclure_id      uuid default null
)
returns table (
  out_seance_id   uuid,
  out_date_seance date,
  out_heure_debut time,
  out_duree_min   int,
  out_libelle     text,
  out_type_mission text
)
language sql
security definer
set search_path = public
as $$
  with bornes as (
    select * from public._abs_bornes(
      p_date_debut, p_heure_debut, p_date_fin, p_heure_fin, p_journee_entiere)
  ),
  salarie as (
    select c.personne_id from public.contrats_salaries c where c.id = p_contrat_id
  )
  select ms.id, ms.date_seance, ms.heure_debut, ms.duree_min,
         coalesce(ms.libelle, m.libelle, '(sans libellé)'), m.type_mission
  from public.mission_seances ms
  join public.missions m on m.id = ms.mission_id
  join salarie s on s.personne_id = m.salarie_id
  cross join bornes b
  where ms.etat is distinct from 'annulee'
    and (p_exclure_id is null or ms.id <> p_exclure_id)
    and (ms.date_seance + coalesce(ms.heure_debut, time '00:00'))::timestamp
        < b.ts_fin
    and (ms.date_seance + coalesce(ms.heure_debut, time '00:00'))::timestamp
        + make_interval(mins => coalesce(ms.duree_min, 0))
        > b.ts_debut
  order by ms.date_seance, ms.heure_debut;
$$;

-- ============================================================================
-- 4. RPC ECRITURE — upsert d'une absence, garde + anti-chevauchement FAIL-LOUD
-- ============================================================================
create or replace function public.upsert_absence_salarie(
  p_id              uuid    default null,
  p_contrat_id      uuid    default null,
  p_nature          text    default null,
  p_date_debut      date    default null,
  p_heure_debut     time    default null,
  p_date_fin        date    default null,
  p_heure_fin       time    default null,
  p_journee_entiere boolean default false,
  p_motif           text    default null,
  p_notes           text    default null
)
returns public.absences_salarie
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row      public.absences_salarie;
  v_conflits int;
  v_detail   text;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).'
      using errcode = 'insufficient_privilege';
  end if;

  -- D5 : refus BLOQUANT si l'absence recouvre une seance active.
  select count(*), string_agg(
           to_char(c.out_date_seance,'DD/MM') || ' ' ||
           coalesce(to_char(c.out_heure_debut,'HH24:MI'),'--:--') || ' ' ||
           c.out_libelle, ' · ')
    into v_conflits, v_detail
  from public.absence_conflits(
    p_contrat_id, p_date_debut, p_heure_debut,
    p_date_fin, p_heure_fin, p_journee_entiere) c;

  if v_conflits > 0 then
    raise exception 'Conflit : % mission(s) sur ce créneau — %', v_conflits, v_detail
      using errcode = 'check_violation';
  end if;

  if p_id is null then
    insert into public.absences_salarie (
      contrat_id, nature, date_debut, heure_debut, date_fin, heure_fin,
      journee_entiere, motif, notes
    ) values (
      p_contrat_id, p_nature, p_date_debut, p_heure_debut, p_date_fin, p_heure_fin,
      coalesce(p_journee_entiere,false), p_motif, p_notes
    )
    returning * into v_row;
  else
    update public.absences_salarie set
      contrat_id      = coalesce(p_contrat_id, contrat_id),
      nature          = coalesce(p_nature, nature),
      date_debut      = coalesce(p_date_debut, date_debut),
      heure_debut     = p_heure_debut,
      date_fin        = coalesce(p_date_fin, date_fin),
      heure_fin       = p_heure_fin,
      journee_entiere = coalesce(p_journee_entiere, journee_entiere),
      motif           = p_motif,
      notes           = p_notes
    where id = p_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Absence introuvable : %', p_id using errcode = 'no_data_found';
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.supprimer_absence_salarie(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).'
      using errcode = 'insufficient_privilege';
  end if;
  delete from public.absences_salarie where id = p_id;
end;
$$;

-- ============================================================================
-- 5. RPC LECTURE — fenetre agenda (patron agenda_seances_salarie)
-- ============================================================================
create or replace function public.list_absences_salarie(
  p_contrat_id uuid,
  p_date_debut date default null,
  p_date_fin   date default null
)
returns table (
  out_id              uuid,
  out_nature          text,
  out_date_debut      date,
  out_heure_debut     time,
  out_date_fin        date,
  out_heure_fin       time,
  out_journee_entiere boolean,
  out_motif           text,
  out_notes           text
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.nature, a.date_debut, a.heure_debut, a.date_fin, a.heure_fin,
         a.journee_entiere, a.motif, a.notes
  from public.absences_salarie a
  where a.contrat_id = p_contrat_id
    and (p_date_fin   is null or a.date_debut <= p_date_fin)
    and (p_date_debut is null or a.date_fin   >= p_date_debut)
  order by a.date_debut, a.heure_debut nulls first;
$$;

-- ============================================================================
-- 6. CONTROLE DES 35 H (D4) — le repos hebdomadaire est CALCULE, jamais saisi
-- ----------------------------------------------------------------------------
--   Pour une semaine ISO donnee : on assemble tous les creneaux OCCUPES
--   (seances actives du salarie), on mesure les INTERVALLES LIBRES entre
--   eux, et on retient le plus long. S'il atteint 35 h -> conforme.
--   Les absences ne sont PAS additionnees : elles ne « produisent » pas du
--   repos, elles constatent qu'aucune mission n'occupe la plage. Le repos
--   est l'ABSENCE de travail, pas un objet qu'on empile.
--   Fenetre elargie de 48 h de part et d'autre : un repos hebdomadaire peut
--   commencer le vendredi soir de la semaine precedente.
-- ============================================================================
create or replace function public.controle_repos_hebdo(
  p_contrat_id uuid,
  p_lundi      date
)
returns table (
  out_lundi            date,
  out_repos_max_min    int,
  out_conforme         boolean,
  out_debut_repos_max  timestamp,
  out_fin_repos_max    timestamp,
  out_nb_jours_travailles int
)
language sql
security definer
set search_path = public
as $$
  with salarie as (
    select c.personne_id from public.contrats_salaries c where c.id = p_contrat_id
  ),
  occupe as (
    select (ms.date_seance + coalesce(ms.heure_debut, time '00:00'))::timestamp as deb,
           (ms.date_seance + coalesce(ms.heure_debut, time '00:00'))::timestamp
             + make_interval(mins => coalesce(ms.duree_min, 0)) as fin,
           ms.date_seance
    from public.mission_seances ms
    join public.missions m on m.id = ms.mission_id
    join salarie s on s.personne_id = m.salarie_id
    where ms.etat is distinct from 'annulee'
      and ms.date_seance >= (p_lundi - 2)
      and ms.date_seance <= (p_lundi + 9)
  ),
  -- Seances chevauchantes ou imbriquees : le trou reel se mesure depuis le
  -- MAXIMUM COURANT des fins deja rencontrees, pas depuis la fin de la ligne
  -- precedente (sinon une seance incluse dans une autre cree un faux trou).
  trous as (
    select max(o.fin) over (
             order by o.deb
             rows between unbounded preceding and current row
           ) as trou_debut,
           lead(o.deb) over (order by o.deb) as trou_fin
    from occupe o
  ),
  mesures as (
    select trou_debut, trou_fin,
           extract(epoch from (trou_fin - trou_debut))/60 as duree_min
    from trous
    where trou_fin is not null and trou_fin > trou_debut
  ),
  best as (
    select trou_debut, trou_fin, duree_min
    from mesures
    order by duree_min desc
    limit 1
  )
  select p_lundi,
         coalesce((select round(duree_min)::int from best), 0),
         coalesce((select duree_min from best), 0) >= 2100,
         (select trou_debut from best),
         (select trou_fin from best),
         (select count(distinct date_seance)::int from occupe
           where date_seance >= p_lundi and date_seance <= p_lundi + 6);
$$;

-- ============================================================================
-- 7. Permissions — REVOKE PUBLIC / GRANT authenticated
-- ============================================================================
revoke all on function
  public._abs_bornes(date, time, date, time, boolean),
  public.absence_conflits(uuid, date, time, date, time, boolean, uuid),
  public.upsert_absence_salarie(uuid, uuid, text, date, time, date, time, boolean, text, text),
  public.supprimer_absence_salarie(uuid),
  public.list_absences_salarie(uuid, date, date),
  public.controle_repos_hebdo(uuid, date)
  from public;

revoke all on function
  public.absence_conflits(uuid, date, time, date, time, boolean, uuid),
  public.upsert_absence_salarie(uuid, uuid, text, date, time, date, time, boolean, text, text),
  public.supprimer_absence_salarie(uuid),
  public.list_absences_salarie(uuid, date, date),
  public.controle_repos_hebdo(uuid, date)
  from anon;

grant execute on function
  public.absence_conflits(uuid, date, time, date, time, boolean, uuid),
  public.upsert_absence_salarie(uuid, uuid, text, date, time, date, time, boolean, text, text),
  public.supprimer_absence_salarie(uuid),
  public.list_absences_salarie(uuid, date, date),
  public.controle_repos_hebdo(uuid, date)
  to authenticated;

-- ============================================================================
-- 8. VERIFICATION fail-loud
-- ============================================================================
do $verif$
declare
  n_table int;
  n_rpc   int;
  n_rls   int;
begin
  select count(*) into n_table
    from information_schema.tables
    where table_schema='public' and table_name='absences_salarie';
  if n_table <> 1 then
    raise exception 'ABSENCES KO : table absences_salarie absente.';
  end if;

  select count(*) into n_rpc
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('absence_conflits','upsert_absence_salarie',
                        'supprimer_absence_salarie','list_absences_salarie',
                        'controle_repos_hebdo','_abs_bornes');
  if n_rpc < 6 then
    raise exception 'ABSENCES KO : % RPC sur 6 attendues.', n_rpc;
  end if;

  select count(*) into n_rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='absences_salarie'
      and c.relrowsecurity = true;
  if n_rls <> 1 then
    raise exception 'ABSENCES KO : RLS non active sur absences_salarie.';
  end if;

  raise notice 'ABSENCES OK : table + % RPC + RLS active.', n_rpc;
end;
$verif$;

commit;
