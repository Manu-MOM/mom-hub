-- =============================================================================
-- sql_131_prospection_contacts.sql
-- Module B « Prospection / Developpement scolaire » — SEUL DDL du module.
-- Table-fille du temps de prospection (1 ecole -> N contacts dates) + 2 RPC :
--   - inserer_prospection_contact() : journalisation d'un contact (bureau) ;
--   - list_prospection_contacts(p_entite_id) : historique par ecole.
--
-- Decisions de modele FIGEES (conv pt 129 conception + arbitrages production) :
--   - choix beta (historique multi-contacts date) vs alpha (date unique) — FAIT FOI 3.1 ;
--   - saisie portee par le BUREAU (surface pilote), jamais Lohann — FAIT FOI 3.1 P1 ;
--   - canal sous CHECK : mail|telephone|visite|autre (arbitrage production) ;
--   - FK entite_id ON DELETE CASCADE : l'historique n'a pas de sens sans son ecole,
--     vraie table-fille (≠ missions, objet metier autonome en NO ACTION) — arbitrage prod ;
--   - date_relance PAR CONTACT (colonne) : alimente le moteur de geste — FAIT FOI 3.4.
--
-- Invariants module A reconduits a l'identique (patron sql_130 pt 128) :
--   SECURITY DEFINER + set search_path 'public' + garde _gs_peut_ecrire()
--   + REVOKE public + REVOKE anon + GRANT authenticated + do $verif$ fail-loud.
--   Pas de begin/commit explicite (rollback implicite — lecon purge pt 128).
--   cree_par = auth.uid() (appelant, pas proprietaire — sain en SECURITY DEFINER).
-- =============================================================================

-- 1) Table-fille ------------------------------------------------------------
create table if not exists public.prospection_contacts (
  id            uuid         primary key default gen_random_uuid(),
  entite_id     uuid         not null
                  references public.entites(id) on delete cascade,
  date_contact  date         not null default current_date,
  canal         text         null
                  check (canal is null or canal in ('mail', 'telephone', 'visite', 'autre')),
  resume        text         null,
  suite         text         null,
  date_relance  date         null,
  cree_par      uuid         null,
  created_at    timestamptz  not null default now()
);

-- Index de lecture : l'historique est toujours filtre par ecole, trie par date.
create index if not exists idx_prospection_contacts_entite
  on public.prospection_contacts (entite_id, date_contact desc);

-- Index moteur de geste : relances dues (date_relance <= today).
create index if not exists idx_prospection_contacts_relance
  on public.prospection_contacts (date_relance)
  where date_relance is not null;

-- RLS : la table n'est jamais lue/ecrite directement par le front ; seules les
-- RPC SECURITY DEFINER y touchent. On verrouille tout acces direct (patron sql_130).
alter table public.prospection_contacts enable row level security;
revoke all on public.prospection_contacts from anon;
revoke all on public.prospection_contacts from authenticated;
-- (aucune policy => aucun acces direct ; les RPC contournent via SECURITY DEFINER.)

-- 2) RPC d'insertion (journalisation d'un contact) --------------------------
create or replace function public.inserer_prospection_contact(
  p_entite_id    uuid,
  p_date_contact date    default current_date,
  p_canal        text    default null,
  p_resume       text    default null,
  p_suite        text    default null,
  p_date_relance date    default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id        uuid;
  v_existe    boolean;
begin
  -- Garde : admin|bureau, via la fonction canonique de la base (sonde Q pt 128).
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  -- Entite obligatoire et existante (rattachement ecole non negociable).
  if p_entite_id is null then
    raise exception 'entite_id obligatoire : un contact se rattache a une ecole.';
  end if;
  v_existe := (select exists (select 1 from public.entites e where e.id = p_entite_id));
  if not v_existe then
    raise exception 'Ecole introuvable (entite_id=%).', p_entite_id;
  end if;

  -- Canal sous CHECK : garde applicative claire avant la contrainte table.
  if p_canal is not null and p_canal not in ('mail', 'telephone', 'visite', 'autre') then
    raise exception 'Canal invalide : % (attendu mail|telephone|visite|autre).', p_canal;
  end if;

  insert into public.prospection_contacts
    (entite_id, date_contact, canal, resume, suite, date_relance, cree_par)
  values
    (p_entite_id, coalesce(p_date_contact, current_date), p_canal,
     p_resume, p_suite, p_date_relance, auth.uid())
  returning id into v_id;

  return v_id;
end;
$function$;

-- 3) RPC de lecture (historique par ecole) ----------------------------------
-- Lecture seule : meme garde admin|bureau (surface pilote = bureau ; FAIT FOI 4).
create or replace function public.list_prospection_contacts(
  p_entite_id uuid
)
returns setof public.prospection_contacts
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  if p_entite_id is null then
    raise exception 'entite_id obligatoire pour lister l''historique.';
  end if;

  return query
    select pc.*
      from public.prospection_contacts pc
     where pc.entite_id = p_entite_id
     order by pc.date_contact desc, pc.created_at desc;
end;
$function$;

-- 4) Permissions ------------------------------------------------------------
revoke all on function public.inserer_prospection_contact(uuid, date, text, text, text, date) from public;
revoke all on function public.inserer_prospection_contact(uuid, date, text, text, text, date) from anon;
grant execute on function public.inserer_prospection_contact(uuid, date, text, text, text, date) to authenticated;

revoke all on function public.list_prospection_contacts(uuid) from public;
revoke all on function public.list_prospection_contacts(uuid) from anon;
grant execute on function public.list_prospection_contacts(uuid) to authenticated;

-- 5) Verification fail-loud -------------------------------------------------
-- Motif v := (select ...) impose : l'editeur SQL Supabase casse sur
-- « select ... into v » dans un do $tag$ (relation "v" does not exist).
do $verif$
declare
  v_exists boolean;
begin
  v_exists := (select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'prospection_contacts'
  ));
  if not v_exists then
    raise exception 'VERIF: table prospection_contacts absente apres creation.';
  end if;

  v_exists := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'inserer_prospection_contact'
  ));
  if not v_exists then
    raise exception 'VERIF: inserer_prospection_contact absente apres creation.';
  end if;

  v_exists := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_prospection_contacts'
  ));
  if not v_exists then
    raise exception 'VERIF: list_prospection_contacts absente apres creation.';
  end if;

  -- FK ON DELETE CASCADE effectivement posee (confdeltype = 'c').
  v_exists := (select exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'prospection_contacts'
       and c.contype = 'f'
       and c.confdeltype = 'c'
  ));
  if not v_exists then
    raise exception 'VERIF: FK entite_id ON DELETE CASCADE absente ou mal configuree.';
  end if;

  raise notice 'VERIF OK : prospection_contacts + 2 RPC (insert/list) en place.';
end;
$verif$;
