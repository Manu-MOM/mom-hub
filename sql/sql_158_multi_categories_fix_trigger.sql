-- ============================================================================
-- sql_158 — LOGISTIQUE-MULTI-CATEGORIES — CORRECTIF trigger T1
-- Défaut sql_156 constaté en recette le 05/07/2026 (guichet, envoi d'une
-- récurrence multi) : « responsables_personne_ids contient un uuid inconnu
-- de personnes ».
--
-- CAUSE (sondée) : _logistique_multi_sync() n'était PAS SECURITY DEFINER.
-- Un trigger non-DEFINER s'exécute avec les droits du compte APPELANT :
-- `personnes` a la RLS ACTIVE avec ZÉRO policy (lecture uniquement via RPC
-- SECURITY DEFINER, ex. list_staff_disponibles) → le contrôle d'intégrité
-- `exists(select 1 from personnes …)` ne voyait AUCUNE ligne depuis une
-- session navigateur, et tout id valide paraissait inconnu. `categories`
-- passait (policy de lecture publique) — d'où l'asymétrie observée.
--
-- CORRECTIF : CREATE OR REPLACE de la MÊME fonction avec SECURITY DEFINER
-- (patron maison), corps STRICTEMENT IDENTIQUE à sql_156 par ailleurs.
-- Les 3 triggers référencent la fonction par nom : rien d'autre à toucher.
-- Sans risque : la fonction ne lit personnes/categories que pour VALIDER,
-- ne renvoie aucune donnée.
-- ============================================================================

begin;

create or replace function public._logistique_multi_sync()
returns trigger
language plpgsql
security definer
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
  -- SECURITY DEFINER (sql_158) : lit les tables réelles, plus la RLS de la
  -- session appelante.
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

-- ============================================================================
-- VÉRIFICATION FAIL-LOUD
-- ============================================================================

do $verif$
declare
  v_n integer;
begin
  -- La fonction est désormais SECURITY DEFINER
  select count(*) into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = '_logistique_multi_sync'
    and p.prosecdef;
  if v_n <> 1 then
    raise exception 'VERIF sql_158 : _logistique_multi_sync attendu SECURITY DEFINER, conformité %', v_n;
  end if;

  -- Les 3 triggers pointent toujours dessus
  select count(*) into v_n
  from pg_trigger t
  where not t.tgisinternal
    and t.tgfoid = 'public._logistique_multi_sync'::regproc
    and t.tgname in (
      'reservations_logistiques_multi_sync',
      'reservations_recurrentes_multi_sync',
      'demandes_bus_multi_sync'
    );
  if v_n <> 3 then
    raise exception 'VERIF sql_158 : triggers attendus 3 sur la fonction, trouvés %', v_n;
  end if;

  raise notice 'VERIF sql_158 : OK (trigger T1 SECURITY DEFINER, 3 triggers en place)';
end;
$verif$;

commit;
