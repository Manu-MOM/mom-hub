-- ============================================================
-- sql_155_exceptions_recurrence.sql — MOM Hub
-- Chantier LOGISTIQUE-EXCEPTIONS-RECURRENCE
-- FAIT FOI gelé le 05/07/2026 (arbitrages E1-E7, paquet reco intégral).
-- PRÉREQUIS : sql_151 (date_debut) et sql_152 (cycle de vie) exécutés.
-- ============================================================
-- Objet :
--   1. Colonne additive dates_exclues date[] NOT NULL DEFAULT '{}'
--      sur reservations_recurrentes (E1a — 21e colonne). Aucun
--      backfill : le défaut vide couvre les 9 règles existantes.
--   2. 2 RPC SECURITY DEFINER, patron annuler_recurrence (sonde S2) :
--      exclure_occurrence / reinclure_occurrence — elles écrivent
--      dates_exclues SEULE (E4 : geste distinct de modifier_*).
-- Gardes (E2 = B1) :
--   - bureau|admin : plein droit ;
--   - sinon demandeur propriétaire (responsable_personne_id =
--     qui_suis_je(), fonction TABLE(personne_id uuid)).
-- Effets (E3 — DÉROGATION EXPLICITE À B2, tracée au FAIT FOI) :
--   - le statut de la règle N'EST PAS modifié : exclure une occurrence
--     n'est pas renégocier les termes validés. B2 reste plein et
--     entier pour modifier_recurrence (UPDATE dur → pending).
--   - modifie_par / updated_at écrits (trace du geste).
-- Fail-loud :
--   - règle introuvable / annulée (cancelled) → refus net ;
--   - exclure : date > date_fin, ou date < date_debut (si non NULL),
--     ou date déjà exclue → refus net ;
--   - réinclure : date non exclue → refus net.
-- Décisions techniques tracées (mineures, frontière de décision) :
--   - AUCUN contrôle « la date tombe un jour de la règle » : ce
--     contrôle dupliquerait la projection (freq/jours) côté SQL ;
--     exclure une date jamais projetée est inoffensif (jamais vue).
--   - Exclusion admise quel que soit le statut non-cancelled
--     (pending inclus — E6 : l'exception suit la règle) ; sur une
--     règle rejected c'est inoffensif (rien n'est projeté).
--   - Le tableau n'est pas trié en base (array_append simple, P1) ;
--     le front trie à l'affichage.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonne dates_exclues (E1a)
-- ------------------------------------------------------------

alter table public.reservations_recurrentes
add column if not exists dates_exclues date [] not null default '{}';

-- ------------------------------------------------------------
-- 2. RPC exclure_occurrence (E2, E3, fail-loud)
-- ------------------------------------------------------------

create or replace function public.exclure_occurrence(
    p_recurrence_id uuid,
    p_date date
)
returns public.reservations_recurrentes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.reservations_recurrentes;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.reservations_recurrentes
   where id = p_recurrence_id;
  if not found then
    raise exception 'Regle recurrente introuvable : %', p_recurrence_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Exclusion refusee : regle annulee (%).', p_recurrence_id;
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Exclusion refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if p_date > v_row.date_fin then
    raise exception 'Exclusion refusee : % au-dela de la fin de regle (%).',
      p_date, v_row.date_fin;
  end if;
  if v_row.date_debut is not null and p_date < v_row.date_debut then
    raise exception 'Exclusion refusee : % avant le debut de regle (%).',
      p_date, v_row.date_debut;
  end if;
  if p_date = any (v_row.dates_exclues) then
    raise exception 'Exclusion refusee : % deja exclue.', p_date;
  end if;

  update public.reservations_recurrentes
     set dates_exclues = array_append(dates_exclues, p_date),
         modifie_par   = auth.uid(),
         updated_at    = now()
   where id = p_recurrence_id
   returning * into v_row;

  return v_row;
end $function$;

-- ------------------------------------------------------------
-- 3. RPC reinclure_occurrence (E5, fail-loud)
-- ------------------------------------------------------------

create or replace function public.reinclure_occurrence(
    p_recurrence_id uuid,
    p_date date
)
returns public.reservations_recurrentes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.reservations_recurrentes;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.reservations_recurrentes
   where id = p_recurrence_id;
  if not found then
    raise exception 'Regle recurrente introuvable : %', p_recurrence_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Reinclusion refusee : regle annulee (%).', p_recurrence_id;
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Reinclusion refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if not (p_date = any (v_row.dates_exclues)) then
    raise exception 'Reinclusion refusee : % non exclue.', p_date;
  end if;

  update public.reservations_recurrentes
     set dates_exclues = array_remove(dates_exclues, p_date),
         modifie_par   = auth.uid(),
         updated_at    = now()
   where id = p_recurrence_id
   returning * into v_row;

  return v_row;
end $function$;

-- ------------------------------------------------------------
-- 4. Droits (patron sql_152 : revoke public+anon, grant authenticated)
-- ------------------------------------------------------------

revoke all on function public.exclure_occurrence(uuid, date) from public, anon;
grant execute on function public.exclure_occurrence(uuid, date) to authenticated;

revoke all on function public.reinclure_occurrence(uuid, date) from public, anon;
grant execute on function public.reinclure_occurrence(uuid, date) to authenticated;

-- ============================================================
-- Vérification fail-loud
-- ============================================================
do $verif$
declare
    v_colonne integer;
    v_fonctions integer;
begin
    v_colonne := (
        select count(*)
        from information_schema.columns
        where table_schema = 'public'
            and table_name = 'reservations_recurrentes'
            and column_name = 'dates_exclues'
            and data_type = 'ARRAY'
            and is_nullable = 'NO'
    );
    if v_colonne <> 1 then
        raise exception
            'sql_155 ECHEC : colonne dates_exclues absente ou mal typee.';
    end if;

    v_fonctions := (
        select count(*)
        from pg_proc as p
        inner join pg_namespace as n on p.pronamespace = n.oid
        where n.nspname = 'public'
            and p.proname in ('exclure_occurrence', 'reinclure_occurrence')
            and p.prosecdef
    );
    if v_fonctions <> 2 then
        raise exception
            'sql_155 ECHEC : 2 fonctions SECURITY DEFINER attendues, trouvees %.',
            v_fonctions;
    end if;

    raise notice
        'sql_155 OK : dates_exclues en place, 2 RPC exclure/reinclure_occurrence deployees.';
end
$verif$;
