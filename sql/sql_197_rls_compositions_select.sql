-- =====================================================================
-- sql_197 — RLS-COMPOSITIONS-SELECT
-- Durcit la LECTURE (SELECT) du domaine compositions au périmètre autorisé,
-- symétriquement aux policies d'écriture déjà correctes.
-- Tables : compositions, composition_joueurs, presences.
-- Garde de lecture dédiée : puis_je_lire_categorie (nouvelle).
-- =====================================================================

-- 1) Garde de lecture (même périmètre que mes_categories_autorisees()).
create or replace function public.puis_je_lire_categorie(p_categorie_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.mes_categories_autorisees() m
    where m.est_transverse
       or m.categorie_id = p_categorie_id
  );
$function$;

revoke all on function public.puis_je_lire_categorie(uuid) from public, anon;
grant execute on function public.puis_je_lire_categorie(uuid) to authenticated;

-- 2) Durcissement des 3 policies SELECT (DROP+CREATE : le USING change).
drop policy compositions_select_authenticated on public.compositions;
create policy compositions_select_authenticated on public.compositions
  for select to authenticated
  using (
    has_role('admin') or has_role('bureau')
    or puis_je_lire_categorie(_b5_categorie_de_composition(id))
  );

drop policy composition_joueurs_select_authenticated on public.composition_joueurs;
create policy composition_joueurs_select_authenticated on public.composition_joueurs
  for select to authenticated
  using (
    has_role('admin') or has_role('bureau')
    or puis_je_lire_categorie(_b5_categorie_de_composition(composition_id))
  );

drop policy presences_select_authenticated on public.presences;
create policy presences_select_authenticated on public.presences
  for select to authenticated
  using (
    has_role('admin') or has_role('bureau')
    or puis_je_lire_categorie(_b5_categorie_de_evenement(evenement_id))
  );

-- 3) Vérification fail-loud (clean return = tout est OK).
do $verif$
declare
  v_using text;
  v_fn_ok boolean;
begin
  -- garde existe, SECURITY DEFINER, anon révoqué
  select p.prosecdef into v_fn_ok
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='puis_je_lire_categorie';
  if v_fn_ok is null then
    raise exception 'VERIF KO : puis_je_lire_categorie absente';
  end if;
  if v_fn_ok is false then
    raise exception 'VERIF KO : puis_je_lire_categorie non SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', 'public.puis_je_lire_categorie(uuid)', 'execute') then
    raise exception 'VERIF KO : anon peut exécuter puis_je_lire_categorie';
  end if;

  -- aucune des 3 policies SELECT ne doit rester USING(true)
  for v_using in
    select qual from pg_policies
    where schemaname='public'
      and tablename in ('compositions','composition_joueurs','presences')
      and cmd='SELECT'
  loop
    if v_using is null or btrim(v_using) = 'true' then
      raise exception 'VERIF KO : une policy SELECT reste ouverte (USING true) : %', v_using;
    end if;
    if position('puis_je_lire_categorie' in v_using) = 0 then
      raise exception 'VERIF KO : policy SELECT sans garde de lecture : %', v_using;
    end if;
  end loop;

  -- les 3 policies SELECT doivent exister
  if (select count(*) from pg_policies
      where schemaname='public'
        and tablename in ('compositions','composition_joueurs','presences')
        and cmd='SELECT') <> 3 then
    raise exception 'VERIF KO : il ne reste pas exactement 3 policies SELECT durcies';
  end if;
end;
$verif$;
