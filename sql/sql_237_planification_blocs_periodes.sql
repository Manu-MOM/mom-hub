-- ============================================================
-- sql_237_planification_blocs_periodes.sql
-- ------------------------------------------------------------
-- Chantier : PLANIF-BLOCS-INTERCALES-MULTIPERIODES
--
-- Objet : un bloc « intercalé » (colonne intercale = true, deja
--   presente en base) peut desormais etre constitue de PLUSIEURS
--   periodes disjointes qui ne s'enchainent pas forcement. Ces
--   periodes sont portees par une colonne jsonb additive.
--
-- Contenu :
--   1. Colonne  periodes jsonb NOT NULL DEFAULT '[]'
--        Forme : [{"debut":"YYYY-MM-DD","fin":"YYYY-MM-DD"}, ...]
--   2. CHECK    periodes est un tableau json (garde-fou de forme)
--   3. Trigger  BEFORE INSERT OR UPDATE, SECURITY DEFINER :
--        quand intercale = true ET periodes non vide, recalcule
--        date_debut := min(debut) et date_fin := max(fin) pour
--        garder la coherence tri + retrocompat des lectures qui
--        s'appuient encore sur date_debut / date_fin.
--        Sinon : no-op (blocs simples inchanges, zero regression).
--
-- Retrocompat : blocs existants (periodes = '[]') => le trigger ne
--   touche a rien, date_debut / date_fin font foi comme aujourd'hui.
--
-- Chevauchement : AUTORISE par conception (aucune garde anti-collision).
--
-- Doctrine : additif. Aucun changement du modele d'attachement
--   (categorie_id / pole_id inchanges) => RLS planification_blocs
--   non impactee, pas d'audit RLS requis.
-- ============================================================


-- ---- 1. Colonne periodes -----------------------------------
alter table public.planification_blocs
  add column if not exists periodes jsonb not null default '[]'::jsonb;


-- ---- 2. Garde-fou de forme : periodes doit etre un tableau -
alter table public.planification_blocs
  drop constraint if exists planification_blocs_periodes_array_chk;

alter table public.planification_blocs
  add constraint planification_blocs_periodes_array_chk
  check (jsonb_typeof(periodes) = 'array');


-- ---- 3. Fonction trigger : coherence des dates -------------
-- SECURITY DEFINER : le trigger opere en cross-context d'ecriture
-- (upsert PostgREST soumis RLS) ; on securise l'execution du recalcul.
create or replace function public._planif_bloc_sync_dates()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_min date;
  v_max date;
begin
  -- Bloc intercale avec au moins une periode : les periodes font foi.
  if new.intercale is true
     and new.periodes is not null
     and jsonb_typeof(new.periodes) = 'array'
     and jsonb_array_length(new.periodes) > 0
  then
    select
      min((p ->> 'debut')::date),
      max((p ->> 'fin')::date)
    into v_min, v_max
    from jsonb_array_elements(new.periodes) as p
    where (p ->> 'debut') is not null
      and (p ->> 'fin') is not null;

    -- Ne force les dates que si le calcul a produit des bornes.
    if v_min is not null then
      new.date_debut := v_min;
    end if;
    if v_max is not null then
      new.date_fin := v_max;
    end if;
  end if;

  -- Bloc simple, ou intercale sans periode saisie : no-op.
  return new;
end;
$fn$;


drop trigger if exists trg_planif_bloc_sync_dates on public.planification_blocs;

create trigger trg_planif_bloc_sync_dates
  before insert or update on public.planification_blocs
  for each row
  execute function public._planif_bloc_sync_dates();


-- ---- 4. Verification fail-loud -----------------------------
do $verif$
declare
  v_col_ok    boolean;
  v_chk_ok    boolean;
  v_trg_ok    boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'planification_blocs'
      and column_name = 'periodes'
      and data_type = 'jsonb'
  ) into v_col_ok;

  select exists (
    select 1 from pg_constraint
    where conname = 'planification_blocs_periodes_array_chk'
  ) into v_chk_ok;

  select exists (
    select 1 from pg_trigger
    where tgname = 'trg_planif_bloc_sync_dates'
      and tgrelid = 'public.planification_blocs'::regclass
  ) into v_trg_ok;

  if not v_col_ok then
    raise exception 'sql_237 FAIL : colonne periodes absente ou mauvais type';
  end if;
  if not v_chk_ok then
    raise exception 'sql_237 FAIL : contrainte periodes_array_chk absente';
  end if;
  if not v_trg_ok then
    raise exception 'sql_237 FAIL : trigger trg_planif_bloc_sync_dates absent';
  end if;

  raise notice 'sql_237 OK : colonne + check + trigger en place';
end;
$verif$;
