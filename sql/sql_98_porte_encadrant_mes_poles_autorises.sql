-- =====================================================================
-- sql_98_porte_encadrant_mes_poles_autorises.sql
-- ---------------------------------------------------------------------
-- RENOMMAGE DE LA PORTE  referent -> encadrant  (voie 2)  /  ÉTAPE 3c/7
--
-- OBJET : basculer la GARDE PORTE  has_role('referent') -> has_role('encadrant')
--   dans mes_poles_autorises() (dérivation des pôles depuis fonction_staff).
--
-- INTÉGRITÉ : corps recopié À L'IDENTIQUE depuis la source. SEULE
--   différence : « if has_role('referent') then » ->
--   « if has_role('encadrant') then ». Les branches _b5_norm
--   ('referent%' / 'manager%' / entraineur principal) restent INTACTES.
--
-- create or replace — idempotent. Fail-loud final.
-- =====================================================================

begin;

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
  -- Niveau 3 (encadrant) : pôles dérivés des catégories de fonction_staff actives.
  if has_role('encadrant') then
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

do $verif$
declare
  v_def text;
begin
  v_def := (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mes_poles_autorises'
  );
  if v_def ilike '%has_role(''referent'')%' then
    raise exception 'FAIL-LOUD: mes_poles_autorises porte encore has_role(''referent'').';
  end if;
  if v_def not ilike '%has_role(''encadrant'')%' then
    raise exception 'FAIL-LOUD: mes_poles_autorises ne porte pas has_role(''encadrant'').';
  end if;
  if v_def not ilike '%like ''referent%''%' then
    raise exception 'FAIL-LOUD: la branche métier _b5_norm referent%% a disparu.';
  end if;
  raise notice 'OK étape 3c : mes_poles_autorises porte encadrant, branche métier préservée.';
end;
$verif$;

commit;
