-- =====================================================================
-- sql_97_porte_encadrant_puis_je_faire.sql
-- ---------------------------------------------------------------------
-- RENOMMAGE DE LA PORTE  referent -> encadrant  (voie 2)  /  ÉTAPE 3b/7
--
-- OBJET : basculer la GARDE PORTE  has_role('referent') -> has_role('encadrant')
--   dans puis_je_faire(p_action, p_categorie_id), helper d'indirection
--   unique du modèle S1 (capabilities par fonction).
--
-- COORDINATION (pt 94) : la future branche « responsable de pôle » doit
--   s'insérer EN AMONT de cette garde. En basculant ici, cette branche
--   s'écrira plus tard au-dessus d'une garde déjà nommée 'encadrant' —
--   pas de double écriture. Aucune branche pôle n'est présente
--   aujourd'hui (re-sondé : 1 seule occurrence has_role('referent')).
--
-- INTÉGRITÉ : corps recopié À L'IDENTIQUE depuis la source. SEULE
--   différence : « if not has_role('referent') then » ->
--   « if not has_role('encadrant') then ». L'Union par EXISTS sur
--   capabilities_fonction × fonction_staff (via _b5_norm) reste INTACTE.
--
-- create or replace — idempotent. Fail-loud final.
-- =====================================================================

begin;

create or replace function public.puis_je_faire(p_action text, p_categorie_id uuid)
 returns boolean
 language plpgsql
 stable security definer
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

do $verif$
declare
  v_def text;
begin
  v_def := (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'puis_je_faire'
  );
  if v_def ilike '%has_role(''referent'')%' then
    raise exception 'FAIL-LOUD: puis_je_faire porte encore has_role(''referent'').';
  end if;
  if v_def not ilike '%has_role(''encadrant'')%' then
    raise exception 'FAIL-LOUD: puis_je_faire ne porte pas has_role(''encadrant'').';
  end if;
  raise notice 'OK étape 3b : puis_je_faire porte encadrant.';
end;
$verif$;

commit;
