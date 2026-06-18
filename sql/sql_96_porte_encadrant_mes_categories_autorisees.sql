-- =====================================================================
-- sql_96_porte_encadrant_mes_categories_autorisees.sql
-- ---------------------------------------------------------------------
-- RENOMMAGE DE LA PORTE  referent -> encadrant  (voie 2)  /  ÉTAPE 3a/7
--
-- OBJET : basculer la GARDE PORTE  has_role('referent') -> has_role('encadrant')
--   dans mes_categories_autorisees(). C'est la fonction PIVOT : le régime
--   d'écriture B5 (puis_je_ecrire_categorie -> mes_categories_autorisees)
--   en dépend, donc cette bascule propage le renommage aux 18 policies B5
--   SANS toucher une seule policy.
--
-- INTÉGRITÉ : corps recopié À L'IDENTIQUE depuis la source (pg_get_functiondef,
--   sonde de ce jour). SEULE différence vs source : la ligne
--   « if has_role('referent') then » -> « if has_role('encadrant') then ».
--   Les 4 branches _b5_norm (dont like 'referent%' = FONCTION MÉTIER
--   « Référent de catégorie ») restent STRICTEMENT INTACTES — on ne
--   renomme QUE le jeton de rôle, jamais la fonction métier.
--
-- create or replace — idempotent. Fail-loud final.
-- =====================================================================

begin;

create or replace function public.mes_categories_autorisees()
 returns table(categorie_id uuid, est_transverse boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_personne_id uuid;
begin
  -- Niveaux 1 & 2 (admin / bureau) : laissez-passer transverse, sans fiche ni fonction.
  if has_role('admin') or has_role('bureau') then
    return query select null::uuid, true;
    return;
  end if;
  -- Niveau 3 (encadrant) : périmètre = catégories dérivées de fonction_staff.
  if has_role('encadrant') then
    select qs.personne_id into v_personne_id
    from public.qui_suis_je() qs
    limit 1;
    -- encadrant non relié à une fiche -> aucune catégorie (plancher D7).
    if v_personne_id is null then
      return;
    end if;
    return query
      select distinct fs.categorie_id, false
      from public.fonction_staff fs
      where fs.personne_id = v_personne_id
        and fs.date_fin is null
        and (
              -- D5 « Référent de catégorie »
              public._b5_norm(fs.fonction) like 'referent%'
              -- D5 « Manager »
           or public._b5_norm(fs.fonction) like 'manager%'
              -- D5 « Entraîneur principal »
           or ( public._b5_norm(fs.fonction) like '%entraineur%'
                and public._b5_norm(fs.fonction) like '%principal%' )
              -- D6 « Entraîneur adjoint » (LOT 3 — extension additive,
              --     symétrique de la branche principal ci-dessus).
           or ( public._b5_norm(fs.fonction) like '%entraineur%'
                and public._b5_norm(fs.fonction) like '%adjoint%' )
        );
    return;
  end if;
  -- Niveau 4 (compte sans rôle qualifiant) : aucune ligne (plancher fermé, D7).
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
    where n.nspname = 'public' and p.proname = 'mes_categories_autorisees'
  );
  if v_def ilike '%has_role(''referent'')%' then
    raise exception 'FAIL-LOUD: mes_categories_autorisees porte encore has_role(''referent'').';
  end if;
  if v_def not ilike '%has_role(''encadrant'')%' then
    raise exception 'FAIL-LOUD: mes_categories_autorisees ne porte pas has_role(''encadrant'').';
  end if;
  -- La branche métier _b5_norm 'referent%' DOIT subsister (fonction métier intacte).
  if v_def not ilike '%like ''referent%''%' then
    raise exception 'FAIL-LOUD: la branche métier _b5_norm referent%% a disparu — fonction métier altérée par erreur.';
  end if;
  raise notice 'OK étape 3a : porte encadrant, branche métier referent%% préservée.';
end;
$verif$;

commit;
