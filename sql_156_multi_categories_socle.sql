-- ============================================================================
-- sql_156 — LOGISTIQUE-MULTI-CATEGORIES — SOCLE
-- FAIT FOI gelé par Manu le 05/07/2026 (arbitrages M1/M2/M3/M6/M8/M9 + T1).
-- Base sondée : sql_155 consommé ; policies S1, garde S2, colonnes S3,
-- lecteurs S4, données S5 vérifiés le 05/07/2026.
--
-- Contenu :
--   §1  Colonnes additives categorie_ids + responsables_personne_ids (×3 tables)
--   §2  Trigger T1 : intégrité des tableaux + synchronisation scalaire ↔ tableau
--   §3  Garde B5 souple : puis_je_ecrire_categories(uuid[]) (M2/M3)
--   §4  Policies INSERT recréées ×3 (DROP+CREATE, mêmes noms)
--   §5  Backfill M8-b (4 règles Minibus → {M16,M18}) + M8-c (fusion Stade lundi)
--   §6  do $verif$ fail-loud
--
-- AUCUN retrait : colonnes/fonctions/policies existantes conservées ;
-- puis_je_ecrire_categorie (scalaire) et mes_categories_autorisees INTACTES.
-- ============================================================================

begin;

-- ============================================================================
-- §1 — COLONNES ADDITIVES (M1 + M6 version complète)
-- Tableaux NOT NULL DEFAULT '{}' ; les scalaires categorie_id et
-- responsable_personne_id sont CONSERVÉS (scalaire = premier du tableau, T1).
-- ============================================================================

alter table public.reservations_logistiques
    add column if not exists categorie_ids uuid [] not null default '{}',
    add column if not exists responsables_personne_ids uuid [] not null default '{}';

alter table public.reservations_recurrentes
    add column if not exists categorie_ids uuid [] not null default '{}',
    add column if not exists responsables_personne_ids uuid [] not null default '{}';

alter table public.demandes_bus
    add column if not exists categorie_ids uuid [] not null default '{}',
    add column if not exists responsables_personne_ids uuid [] not null default '{}';

-- ============================================================================
-- §2 — TRIGGER T1 : intégrité + synchronisation (fonction générique, 3 tables)
-- Un uuid[] ne peut pas porter de FK (S3) → intégrité vérifiée ici.
-- Synchronisation directionnelle :
--   INSERT : tableau non vide → scalaire := tableau[1] ;
--            sinon scalaire renseigné → tableau := {scalaire} ;
--            sinon les deux vides/NULL (= « Bureau / Autre », M3).
--   UPDATE : le côté MODIFIÉ fait foi (évite qu'une édition v1.76 du seul
--            scalaire soit écrasée par un tableau backfillé, et inversement).
-- Les policies WITH CHECK sont évaluées APRÈS les triggers BEFORE : les
-- payloads v1.76 (scalaire seul) restent valides pendant la fenêtre
-- SQL-avant-front (T1, rétro-compat prouvée par la recette).
-- ============================================================================

create or replace function public._logistique_multi_sync()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- ---- Synchronisation catégories -----------------------------------------
  if tg_op = 'INSERT' then
    if cardinality(coalesce(new.categorie_ids, '{}')) > 0 then
      new.categorie_id := new.categorie_ids[1];
    elsif new.categorie_id is not null then
      new.categorie_ids := array[new.categorie_id];
    else
      new.categorie_ids := '{}';
    end if;
  else -- UPDATE : le côté modifié fait foi
    if new.categorie_ids is distinct from old.categorie_ids then
      new.categorie_id := case
        when cardinality(coalesce(new.categorie_ids, '{}')) > 0
          then new.categorie_ids[1]
        else null
      end;
    elsif new.categorie_id is distinct from old.categorie_id then
      new.categorie_ids := case
        when new.categorie_id is null then '{}'::uuid []
        else array[new.categorie_id]
      end;
    end if;
  end if;

  -- ---- Synchronisation responsables (même patron) --------------------------
  if tg_op = 'INSERT' then
    if cardinality(coalesce(new.responsables_personne_ids, '{}')) > 0 then
      new.responsable_personne_id := new.responsables_personne_ids[1];
    elsif new.responsable_personne_id is not null then
      new.responsables_personne_ids := array[new.responsable_personne_id];
    end if;
  else
    if new.responsables_personne_ids is distinct from old.responsables_personne_ids then
      if cardinality(coalesce(new.responsables_personne_ids, '{}')) > 0 then
        new.responsable_personne_id := new.responsables_personne_ids[1];
      end if;
      -- tableau vidé : le scalaire NOT NULL reste tel quel (plancher).
    elsif new.responsable_personne_id is distinct from old.responsable_personne_id then
      new.responsables_personne_ids := array[new.responsable_personne_id];
    end if;
  end if;

  -- ---- Intégrité référentielle des tableaux (pas de FK possible, S3) -------
  if exists (
    select 1 from unnest(new.categorie_ids) as u (id)
    where not exists (select 1 from public.categories c where c.id = u.id)
  ) then
    raise exception 'categorie_ids contient un uuid inconnu de categories';
  end if;

  if exists (
    select 1 from unnest(new.responsables_personne_ids) as u (id)
    where not exists (select 1 from public.personnes p where p.id = u.id)
  ) then
    raise exception 'responsables_personne_ids contient un uuid inconnu de personnes';
  end if;

  return new;
end;
$function$;

drop trigger if exists reservations_logistiques_multi_sync on public.reservations_logistiques;
create trigger reservations_logistiques_multi_sync
before insert or update on public.reservations_logistiques
for each row execute function public._logistique_multi_sync();

drop trigger if exists reservations_recurrentes_multi_sync on public.reservations_recurrentes;
create trigger reservations_recurrentes_multi_sync
before insert or update on public.reservations_recurrentes
for each row execute function public._logistique_multi_sync();

drop trigger if exists demandes_bus_multi_sync on public.demandes_bus;
create trigger demandes_bus_multi_sync
before insert or update on public.demandes_bus
for each row execute function public._logistique_multi_sync();

-- ============================================================================
-- §3 — GARDE B5 SOUPLE (M2/M3) — NOUVELLE fonction, l'existante reste intacte
-- Patron EXACT de puis_je_ecrire_categorie (S2) : SQL STABLE SECURITY DEFINER,
-- search_path public, appuyée sur mes_categories_autorisees().
--   Tableau vide/NULL = « Bureau / Autre » → transverses uniquement (M3,
--   reproduit le comportement NULL actuel prouvé S2).
--   Tableau non vide  = AU MOINS UNE catégorie autorisée (M2 souple).
-- ============================================================================

create or replace function public.puis_je_ecrire_categories(p_categorie_ids uuid [])
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select case
    when p_categorie_ids is null or cardinality(p_categorie_ids) = 0 then
      exists (
        select 1 from public.mes_categories_autorisees() m
        where m.est_transverse
      )
    else
      exists (
        select 1 from public.mes_categories_autorisees() m
        where m.est_transverse
           or m.categorie_id = any (p_categorie_ids)
      )
  end;
$function$;

-- ACL : REVOKE PUBLIC **et** anon (anon hérite de PUBLIC), GRANT authenticated.
revoke execute on function public.puis_je_ecrire_categories(uuid []) from public;
revoke execute on function public.puis_je_ecrire_categories(uuid []) from anon;
grant execute on function public.puis_je_ecrire_categories(uuid []) to authenticated;

-- ============================================================================
-- §4 — POLICIES INSERT RECRÉÉES ×3 (DROP+CREATE, MÊMES NOMS — spec M2 gelée)
-- with_check passe du scalaire au tableau. Les policies SELECT (qual=true)
-- ne sont PAS touchées. Toujours aucune policy UPDATE/DELETE (SECURITY
-- DEFINER exclusif, sql_152).
-- ============================================================================

drop policy if exists reservations_logistiques_insert on public.reservations_logistiques;
create policy reservations_logistiques_insert
on public.reservations_logistiques
for insert to authenticated
with check (public.puis_je_ecrire_categories(categorie_ids));

drop policy if exists reservations_recurrentes_insert on public.reservations_recurrentes;
create policy reservations_recurrentes_insert
on public.reservations_recurrentes
for insert to authenticated
with check (public.puis_je_ecrire_categories(categorie_ids));

drop policy if exists demandes_bus_insert on public.demandes_bus;
create policy demandes_bus_insert
on public.demandes_bus
for insert to authenticated
with check (public.puis_je_ecrire_categories(categorie_ids));

-- ============================================================================
-- §5 — BACKFILL (geste de donnée TRACÉ — UUID vérifiés en sonde S5 du 05/07)
-- Catégories : M16 = fa2bb289-cef0-4884-82e9-c50699a52a8f
--              M18 = 46767512-def0-4ebf-a05c-853be7ab76b9
--
-- M8-b — Les 4 règles Minibus restent 4 (chaque véhicule garde me+ve) mais
-- chacune passe en M16+M18 (terrain confirmé Manu : chaque minibus transporte
-- un mélange des deux catégories). Scalaire conservé en tête de tableau.
--   Minibus 1 (Opel)   : 65590269-66df-48be-875c-4763053d7d0b (me)
--                        6dec61ae-4ea6-4d49-a389-914d4a8d23b8 (ve)
--   Minibus 2 (Renault): 48f73a1d-5ce6-4846-a067-32075c9b8eed (me)
--                        adf9b051-65e4-43df-849b-a3d03829cedc (ve)
-- ============================================================================

update public.reservations_recurrentes
set categorie_ids = array[
        'fa2bb289-cef0-4884-82e9-c50699a52a8f',  -- M16 (scalaire actuel, en tête)
        '46767512-def0-4ebf-a05c-853be7ab76b9'   -- M18
    ]::uuid [],
    updated_at = now()
where id in (
    '65590269-66df-48be-875c-4763053d7d0b',
    '6dec61ae-4ea6-4d49-a389-914d4a8d23b8'
);

update public.reservations_recurrentes
set categorie_ids = array[
        '46767512-def0-4ebf-a05c-853be7ab76b9',  -- M18 (scalaire actuel, en tête)
        'fa2bb289-cef0-4884-82e9-c50699a52a8f'   -- M16
    ]::uuid [],
    updated_at = now()
where id in (
    '48f73a1d-5ce6-4846-a067-32075c9b8eed',
    'adf9b051-65e4-43df-849b-a3d03829cedc'
);

-- ============================================================================
-- M8-c — Fusion Stade René Brencklé lundi 18:00-19:30 :
--   la règle M16 eea6752f-b645-43ce-a32c-0b293fe13461 devient M16+M18 ;
--   la jumelle M18 2510d27c-33d0-4ef0-83c1-af059d0c1105 est ANNULÉE
--   (statut='cancelled', geste EXACT d'annuler_recurrence relu en sonde le
--   05/07 : statut + updated_at, `active` intact, JAMAIS de suppression).
--   modifie_par laissé tel quel (geste de donnée hors session utilisateur).
-- ============================================================================

update public.reservations_recurrentes
set categorie_ids = array[
        'fa2bb289-cef0-4884-82e9-c50699a52a8f',  -- M16 (scalaire actuel, en tête)
        '46767512-def0-4ebf-a05c-853be7ab76b9'   -- M18
    ]::uuid [],
    updated_at = now()
where id = 'eea6752f-b645-43ce-a32c-0b293fe13461';

update public.reservations_recurrentes
set statut = 'cancelled',
    updated_at = now()
where id = '2510d27c-33d0-4ef0-83c1-af059d0c1105'
  and statut <> 'cancelled';

-- ============================================================================
-- §6 — VÉRIFICATION FAIL-LOUD (re-déclare tout ce que le script promet)
-- ============================================================================

do $verif$
declare
  v_n integer;
  v_txt text;
begin
  -- 6 colonnes additives présentes, type ARRAY, NOT NULL, défaut '{}'
  select count(*) into v_n
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('reservations_logistiques', 'reservations_recurrentes', 'demandes_bus')
    and column_name in ('categorie_ids', 'responsables_personne_ids')
    and data_type = 'ARRAY'
    and is_nullable = 'NO';
  if v_n <> 6 then
    raise exception 'VERIF sql_156 : colonnes tableaux attendues 6, trouvées %', v_n;
  end if;

  -- 3 triggers de synchronisation
  select count(*) into v_n
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal
    and t.tgname in (
      'reservations_logistiques_multi_sync',
      'reservations_recurrentes_multi_sync',
      'demandes_bus_multi_sync'
    );
  if v_n <> 3 then
    raise exception 'VERIF sql_156 : triggers multi_sync attendus 3, trouvés %', v_n;
  end if;

  -- Garde : ACL (anon NON exécutable, authenticated exécutable)
  if has_function_privilege('anon', 'public.puis_je_ecrire_categories(uuid[])', 'execute') then
    raise exception 'VERIF sql_156 : puis_je_ecrire_categories exécutable par anon';
  end if;
  if not has_function_privilege('authenticated', 'public.puis_je_ecrire_categories(uuid[])', 'execute') then
    raise exception 'VERIF sql_156 : puis_je_ecrire_categories NON exécutable par authenticated';
  end if;

  -- 3 policies INSERT recréées, with_check sur le TABLEAU
  select count(*) into v_n
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'reservations_logistiques_insert',
      'reservations_recurrentes_insert',
      'demandes_bus_insert'
    )
    and cmd = 'INSERT'
    and with_check like '%puis_je_ecrire_categories(categorie_ids)%';
  if v_n <> 3 then
    raise exception 'VERIF sql_156 : policies INSERT multi attendues 3, trouvées %', v_n;
  end if;

  -- Les policies SELECT n'ont pas bougé (qual = true, 3 tables)
  select count(*) into v_n
  from pg_policies
  where schemaname = 'public'
    and tablename in ('reservations_logistiques', 'reservations_recurrentes', 'demandes_bus')
    and cmd = 'SELECT'
    and qual = 'true';
  if v_n <> 3 then
    raise exception 'VERIF sql_156 : policies SELECT attendues 3 intactes, trouvées %', v_n;
  end if;

  -- Backfill : 5 règles à 2 catégories, scalaire = première du tableau
  select count(*) into v_n
  from public.reservations_recurrentes
  where id in (
      '65590269-66df-48be-875c-4763053d7d0b',
      '6dec61ae-4ea6-4d49-a389-914d4a8d23b8',
      '48f73a1d-5ce6-4846-a067-32075c9b8eed',
      'adf9b051-65e4-43df-849b-a3d03829cedc',
      'eea6752f-b645-43ce-a32c-0b293fe13461'
    )
    and cardinality(categorie_ids) = 2
    and categorie_id = categorie_ids[1];
  if v_n <> 5 then
    raise exception 'VERIF sql_156 : backfill M8 attendu 5 règles bi-catégories synchronisées, trouvées %', v_n;
  end if;

  -- M8-c : la jumelle M18 du lundi est annulée
  select statut into v_txt
  from public.reservations_recurrentes
  where id = '2510d27c-33d0-4ef0-83c1-af059d0c1105';
  if v_txt is distinct from 'cancelled' then
    raise exception 'VERIF sql_156 : règle jumelle M18 attendue cancelled, trouvée %', v_txt;
  end if;

  raise notice 'VERIF sql_156 : OK (colonnes ×6, triggers ×3, garde+ACL, policies ×3, backfill 5+1)';
end;
$verif$;

commit;
