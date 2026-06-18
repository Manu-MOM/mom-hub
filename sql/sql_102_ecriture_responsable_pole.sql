-- =====================================================================
-- sql_102_ecriture_responsable_pole.sql
-- ---------------------------------------------------------------------
-- Chantier : Rôles responsable de pôle (pt 94 conception, production).
-- Objet    : branche ÉCRITURE — un responsable de pôle peut agir sur
--            toutes les catégories de son/ses pôle(s), avec les 6
--            actions d'un référent, SANS dépendre du rôle 'encadrant'.
--
-- Cible : puis_je_faire(p_action text, p_categorie_id uuid) RETURNS boolean
--         [CREATE OR REPLACE]
--
-- Décisions consommées (FAITFOI 2daea567 + sondes prod) :
--   DP-3     : visibilité (sql_101) + écriture (CE fichier).
--   DP-4     : porte INDÉPENDANTE de 'encadrant'. La branche pôle est
--              insérée AU-DESSUS de la garde `if not has_role('encadrant')`
--              (court-circuit assumé). Le rattachement responsable EST
--              la porte.
--   DP-5     : 6 actions comme un référent. Réutilise la MATRICE
--              capabilities_fonction du référent (zéro action inventée),
--              n'élargit que le périmètre.
--   DP-7     : pont = categories.pole_id (uuid). Périmètre déplié par la
--              fonction sœur mes_categories_de_pole_responsable() (sql_101).
--   DP-8 [NOUVELLE, ce fichier] : variante (a) — la capability est
--              ÉVALUÉE contre la matrice avec la clé référent réelle,
--              PAS court-circuitée en `return true` direct. Ainsi, si la
--              future console §5.8 modifie les actions du référent, la
--              branche pôle suit automatiquement (source unique de vérité
--              = capabilities_fonction). Pas de divergence figée.
--
-- Faits source (DS-1, sondes prod) :
--   - corps réel de puis_je_faire recopié à l'identique, garde
--     'encadrant' post-sql_97 (sonde 2).
--   - clé référent réelle dans capabilities_fonction =
--     'referent de categorie' (sonde capabilities), PAS 'referent'.
--     Cette valeur est le résultat de _b5_norm sur la fonction métier
--     « Référent de catégorie ». Les 6 actions y sont autorise=true.
--   - fonction sœur mes_categories_de_pole_responsable() déployée (sql_101).
--
-- Additivité : la branche pôle est insérée APRÈS la transverse
--   admin/bureau et AVANT la garde `if not has_role('encadrant')`.
--   Elle ne fait `return true` QUE si la condition pôle est remplie ;
--   sinon l'exécution CONTINUE vers la garde encadrant intacte (un
--   compte responsable-ET-encadrant conserve ses deux voies, un
--   responsable pur sans capability tombe ensuite sur la garde
--   encadrant qui le refuse via le chemin normal). Toutes les branches
--   existantes sont recopiées octet pour octet (preuve Python en
--   commit body).
--
-- Filet d'équivalence : pour tout appel où la personne n'est responsable
--   d'AUCUN pôle couvrant p_categorie_id, la branche pôle est inerte
--   (n'émet pas de return) -> comportement STRICTEMENT identique à avant.
--
-- Coordination : conv « Renommer la porte voie 2 ». Scénario (B) assumé.
--   ⚠️ CE FICHIER RÉÉCRIT puis_je_faire (touché par sql_97 du renommage).
--   À SIGNALER à la conv renommage pour que son resserrage sql_100 ne
--   soit pas écrit en supposant un puis_je_faire d'avant cette branche.
--   Ne touche PAS sql_100 (réservé resserrage renommage).
-- =====================================================================

create or replace function public.puis_je_faire(p_action text, p_categorie_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_personne_id uuid;
begin
  -- Niveaux 1 & 2 (admin / bureau) : laissez-passer transverse.
  -- Identique à la branche transverse de puis_je_ecrire_categorie :
  -- l'action n'est pas modulée pour les rôles transverses.
  if has_role('admin') or has_role('bureau') then
    return true;
  end if;

  -- === BRANCHE POLE (sql_102) — ADDITIVE, AU-DESSUS DE LA PORTE =======
  -- DP-4 : court-circuit assumé de la garde 'encadrant'.
  -- DP-5/DP-8 : si p_categorie_id appartient à un pôle dont le connecté
  -- est responsable, ET que la matrice capabilities_fonction autorise
  -- p_action pour la clé référent réelle 'referent de categorie',
  -- alors -> true. Sinon, on N'émet PAS de return : l'exécution continue
  -- vers la garde encadrant intacte (filet d'équivalence).
  if exists (
        select 1
        from public.mes_categories_de_pole_responsable() cpr
        where cpr.categorie_id = p_categorie_id
      )
     and exists (
        select 1
        from public.capabilities_fonction c
        where c.fonction_normalisee = 'referent de categorie'
          and c.action = p_action
          and c.autorise is true
      )
  then
    return true;
  end if;
  -- ===================================================================

  -- Niveau 3 (encadrant) : la porte est requise (jeton de voie, D-B).
  -- Un compte sans le rôle 'encadrant' n'écrit pas, même s'il portait
  -- par accident une fonction_staff.
  if not has_role('encadrant') then
    return false;
  end if;
  -- Personne reliée (même chemin que mes_categories_autorisees).
  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;
  -- encadrant non relié à une fiche -> aucun droit (plancher D7).
  if v_personne_id is null then
    return false;
  end if;
  -- Union (D-C) : autorisé si AU MOINS une fonction_staff active de
  -- la personne, COUVRANT p_categorie_id, porte la capability
  -- p_action (autorise=true) dans capabilities_fonction.
  return exists (
    select 1
    from public.fonction_staff fs
    join public.capabilities_fonction c
      on c.fonction_normalisee = public._b5_norm(fs.fonction)
    where fs.personne_id = v_personne_id
      and fs.date_fin is null
      and fs.categorie_id = p_categorie_id
      and c.action = p_action
      and c.autorise is true
  );
end;
$function$;

revoke all on function public.puis_je_faire(text, uuid) from public;
grant execute on function public.puis_je_faire(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Vérification fail-loud (do $verif$).
--   On ne peut pas tester le résultat fonctionnel ici (dépend du
--   connecté + des rattachements pôle pas encore posés). On vérifie :
--   - la présence/signature de puis_je_faire,
--   - la présence de la fonction sœur consommée,
--   - que la clé référent 'referent de categorie' existe bien dans la
--     matrice (sinon la branche pôle serait silencieusement morte).
-- ---------------------------------------------------------------------
do $verif$
begin
  perform 'public.puis_je_faire(text, uuid)'::regprocedure;
  perform 'public.mes_categories_de_pole_responsable()'::regprocedure;

  if not exists (
    select 1
    from public.capabilities_fonction
    where fonction_normalisee = 'referent de categorie'
  ) then
    raise exception
      'sql_102 FAIL : cle referent ''referent de categorie'' absente de capabilities_fonction (branche pole morte)';
  end if;

  raise notice 'sql_102 OK : puis_je_faire reecrite, branche pole au-dessus de la porte encadrant, cle referent presente.';
end;
$verif$;
