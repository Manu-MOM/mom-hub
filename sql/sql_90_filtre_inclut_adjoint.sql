-- =============================================================================
-- sql_90_filtre_inclut_adjoint.sql
-- =============================================================================
-- Voie 2 — modèle rôles encadrants S1 — LOT 3.
--
-- Objet : étendre le filtre de `mes_categories_autorisees()` pour que la
--         fonction « Entraîneur adjoint » obtienne enfin un PÉRIMÈTRE catégorie
--         (aujourd'hui exclue par la branche « -- exclut adjoint -> D6 »).
--
-- Nature : ADDITIF et SÛR.
--   - Une seule branche OR de plus dans le WHERE du niveau 3 (referent).
--   - Aucune policy touchée. Aucune autre fonction modifiée.
--   - admin / bureau (niveaux 1 & 2) strictement inchangés.
--   - referent / manager / entraineur principal : résultat INCHANGÉ (les 3
--     branches existantes sont recopiées à l'identique).
--   - L'adjoint est le SEUL delta voulu (FAITFOI 9aa943e6, §4.3 + §1).
--
-- Périmètre : ce filtre sert les usages de LECTURE/affichage du périmètre.
--   Le helper `puis_je_faire` (sql_88) NE dépend PAS de ce filtre — il refait
--   sa propre dérivation. Le lot 3 ne change donc aucun droit d'écriture.
--
-- Source de vérité : corps réel de la fonction lu via pg_get_functiondef
--   (sonde lot 3, pt 91). Clé _b5_norm « entraineur adjoint » confirmée
--   FAITFOI 9aa943e6 §1 (tableau) et §4.3 (table de capabilities).
--
-- DS-1 : aucune structure inventée. Toutes les branches, types de retour et
--   gardes ci-dessous sont recopiés du corps réel en base.
-- =============================================================================

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
  -- Niveau 3 (referent) : périmètre = catégories dérivées de fonction_staff.
  if has_role('referent') then
    select qs.personne_id into v_personne_id
    from public.qui_suis_je() qs
    limit 1;
    -- referent non relié à une fiche -> aucune catégorie (plancher D7).
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

-- -----------------------------------------------------------------------------
-- Vérification fail-loud : prouve que la branche adjoint est bien présente
-- dans le corps installé. Lève une exception si l'extension n'a pas pris
-- (déploiement raté / corps écrasé par une version antérieure).
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mes_categories_autorisees'
    and p.prokind = 'f';

  if v_def is null then
    raise exception 'sql_90 KO : mes_categories_autorisees introuvable apres deploiement.';
  end if;

  -- Branche adjoint attendue.
  if position('%adjoint%' in v_def) = 0 then
    raise exception 'sql_90 KO : la branche entraineur adjoint est absente du corps installe.';
  end if;

  -- Garde anti-regression : les 3 branches historiques doivent toujours etre la.
  if position('%principal%' in v_def) = 0
     or position('manager%' in v_def) = 0
     or position('referent%' in v_def) = 0 then
    raise exception 'sql_90 KO : une branche historique (referent/manager/principal) a disparu.';
  end if;

  raise notice 'sql_90 OK : filtre etendu, branche adjoint presente, 3 branches historiques intactes.';
end;
$verif$;
