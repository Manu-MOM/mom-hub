-- =====================================================================
-- sql_101_visibilite_responsable_pole.sql
-- ---------------------------------------------------------------------
-- Chantier : Rôles responsable de pôle (pt 94 conception, production).
-- Objet    : branche VISIBILITÉ — un responsable de pôle voit toutes
--            les catégories de son/ses pôle(s).
--
-- Contenu (1 unité déployable cohérente — validé Manu) :
--   1. mes_categories_de_pole_responsable()  [fonction sœur, NOUVELLE]
--      = déplie responsable -> pôle(s) -> catégories.
--   2. mes_categories_autorisees()           [CREATE OR REPLACE]
--      = ajout d'une branche ADDITIVE consommant la fonction sœur,
--        sans altérer aucune branche existante.
--
-- Décisions consommées (FAITFOI 2daea567 + sondes pt 94/prod) :
--   DP-1 A2  : dépliage au calcul, lecture directe de poles. Pas de
--              matérialisation de fonction_staff.
--   DP-2 D-A : PAS de rôle. Le pôle reste une donnée (rattachement
--              responsable dans poles).
--   DP-3     : visibilité + écriture (écriture = sql_102).
--   DP-4     : porte INDÉPENDANTE de 'encadrant'. Le rattachement
--              poles.responsable_principal_id / co_responsable_id EST
--              la porte. La branche n'exige PAS has_role('encadrant').
--   DP-7     : pont = categories.pole_id (uuid), PAS
--              poles.categories_rattachees (texte). M5 ∈ EDR.
--              (sonde 5b : categories.pole_id intégralement peuplé ;
--               divergence M5 entre les deux sources -> pole_id fait foi.)
--
-- Faits source (DS-1, sondes prod) :
--   - poles.responsable_principal_id / co_responsable_id -> personnes(id)
--     ON DELETE SET NULL  (sonde 1) -> chemin via qui_suis_je().
--   - categories.pole_id existe et est peuplé (sonde 4/5b) -> pont uuid.
--   - corps réel de mes_categories_autorisees recopié à l'identique,
--     garde 'encadrant' post-sql_97 (sonde 3).
--
-- Additivité : la branche pôle est insérée APRÈS la garde transverse
--   admin/bureau et AVANT la branche encadrant, en `return query` SANS
--   `return;` -> elle ACCUMULE puis l'exécution continue vers les
--   branches existantes, recopiées octet pour octet. Un compte
--   responsable-ET-encadrant obtient l'UNION des deux périmètres ;
--   un responsable pur obtient le sien puis tombe au plancher D7
--   (zéro ligne ajoutée par les branches suivantes). Aucune branche
--   existante réécrite (preuve Python en commit body).
--
-- Coordination : conv « Renommer la porte voie 2 ». Scénario (B) assumé.
--   Ce fichier NE touche PAS puis_je_faire (sql_102). Ne touche PAS
--   sql_100 (réservé resserrage renommage).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fonction sœur : dérivation responsable -> pôle(s) -> catégories.
--    Symétrique de mes_poles_autorises() mais sur l'axe RESPONSABLE
--    (rattachement dans poles), pas sur l'axe FONCTION (fonction_staff).
--    Pas de est_transverse : un responsable de pôle a un périmètre fini
--    (DP-3), jamais transverse.
-- ---------------------------------------------------------------------
create or replace function public.mes_categories_de_pole_responsable()
returns table(categorie_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_personne_id uuid;
begin
  -- Personne reliée (même chemin que mes_categories_autorisees / puis_je_faire).
  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  -- Pas de fiche reliée -> aucun pôle responsable -> aucune catégorie.
  if v_personne_id is null then
    return;
  end if;

  -- Dépliage : catégories dont le pole_id pointe vers un pôle
  -- dont la personne est responsable principal OU co-responsable.
  -- Pont uuid direct (DP-7 : categories.pole_id fait foi).
  return query
    select distinct c.id
    from public.poles p
    join public.categories c on c.pole_id = p.id
    where p.responsable_principal_id = v_personne_id
       or p.co_responsable_id = v_personne_id;
end;
$function$;

revoke all on function public.mes_categories_de_pole_responsable() from public;
grant execute on function public.mes_categories_de_pole_responsable() to authenticated;

-- ---------------------------------------------------------------------
-- 2. mes_categories_autorisees() : ajout de la branche VISIBILITÉ pôle.
--    Toutes les branches existantes sont recopiées à l'identique depuis
--    le corps réel (sonde 3, post-sql_97). Seul ajout : le bloc balisé
--    « BRANCHE POLE (sql_101) », additif, sans return; intermédiaire.
-- ---------------------------------------------------------------------
create or replace function public.mes_categories_autorisees()
returns table(categorie_id uuid, est_transverse boolean)
language plpgsql
stable
security definer
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

  -- === BRANCHE POLE (sql_101) — ADDITIVE ============================
  -- DP-4 : indépendante de la porte 'encadrant'. Le rattachement
  -- responsable EST la porte. Accumulation SANS return; -> l'exécution
  -- continue vers les branches existantes (union des périmètres pour un
  -- compte responsable-ET-encadrant). est_transverse = false (DP-3).
  return query
    select cpr.categorie_id, false
    from public.mes_categories_de_pole_responsable() cpr;
  -- ==================================================================

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

-- ---------------------------------------------------------------------
-- 3. Vérification fail-loud (do $verif$).
--    On ne peut pas tester le résultat fonctionnel ici (dépend du
--    connecté), mais on vérifie la PRÉSENCE et la SIGNATURE des objets,
--    et que le pont DP-7 est cohérent (categories.pole_id existe).
-- ---------------------------------------------------------------------
do $verif$
begin
  -- 3.1 / 3.2 : présence + signature des deux fonctions.
  --   Le cast ::regprocedure lève tout seul si la fonction est absente
  --   ou si la signature ne correspond pas (fail-loud, sans variable).
  perform 'public.mes_categories_de_pole_responsable()'::regprocedure;
  perform 'public.mes_categories_autorisees()'::regprocedure;

  -- 3.3 pont DP-7 : la colonne categories.pole_id doit exister.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'categories'
      and column_name  = 'pole_id'
  ) then
    raise exception
      'sql_101 FAIL : categories.pole_id introuvable (pont DP-7 cassé)';
  end if;

  raise notice 'sql_101 OK : fonctions deployees, pont categories.pole_id present.';
end;
$verif$;
