-- =====================================================================
-- sql_99_porte_encadrant_diag_mes_capabilities.sql
-- ---------------------------------------------------------------------
-- RENOMMAGE DE LA PORTE  referent -> encadrant  (voie 2)  /  ÉTAPE 3d/7
--
-- OBJET : basculer la GARDE PORTE  has_role('referent') -> has_role('encadrant')
--   dans diag_mes_capabilities() (RPC diag LECTURE SEULE de la matrice
--   effective de la personne connectée). Doit suivre, sinon le diag
--   « ment » (renvoie 0 ligne) pour un encadrant réel.
--
-- INTÉGRITÉ : corps recopié À L'IDENTIQUE depuis la source. SEULE
--   différence : « if not has_role('referent') then » ->
--   « if not has_role('encadrant') then ». Le reste (actions, jointure
--   capabilities via puis_je_faire, plancher D7) INTACT.
--
-- create or replace — idempotent. Fail-loud final.
-- =====================================================================

begin;

create or replace function public.diag_mes_capabilities()
 returns table(categorie_id uuid, categorie_code text, categorie_libelle text, action text, autorise boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_personne_id uuid;
  v_actions text[] := array[
    'ecrire_seance', 'ecrire_compo', 'valider_compo',
    'gerer_presences', 'gerer_evenements', 'composer_effectif'
  ];
begin
  -- Cas transverse : admin / bureau. puis_je_faire rend true partout,
  -- sans catégorie bornée -> on renvoie une ligne synthétique par action.
  if has_role('admin') or has_role('bureau') then
    return query
      select null::uuid,
             '(transverse)'::text,
             '(admin/bureau — accès non borné catégorie)'::text,
             a.action,
             public.puis_je_faire(a.action, null::uuid)
      from unnest(v_actions) as a(action);
    return;
  end if;

  -- Hors porte encadrant : aucune ligne (le diag reflète le plancher D7).
  if not has_role('encadrant') then
    return;
  end if;

  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  if v_personne_id is null then
    return;  -- encadrant non relié à une fiche
  end if;

  -- Catégories réelles de la personne (toutes fonctions actives,
  -- adjoint inclus) × 6 actions, verdict = puis_je_faire.
  return query
    with mes_cats as (
      select distinct fs.categorie_id
      from public.fonction_staff fs
      where fs.personne_id = v_personne_id
        and fs.date_fin is null
        and fs.categorie_id is not null
    )
    select c.id,
           c.code,
           c.libelle_court,
           a.action,
           public.puis_je_faire(a.action, c.id)
    from mes_cats mc
    join public.categories c on c.id = mc.categorie_id
    cross join unnest(v_actions) as a(action)
    order by c.code, a.action;
end;
$function$;

do $verif$
declare
  v_def text;
begin
  v_def := (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'diag_mes_capabilities'
  );
  if v_def ilike '%has_role(''referent'')%' then
    raise exception 'FAIL-LOUD: diag_mes_capabilities porte encore has_role(''referent'').';
  end if;
  if v_def not ilike '%has_role(''encadrant'')%' then
    raise exception 'FAIL-LOUD: diag_mes_capabilities ne porte pas has_role(''encadrant'').';
  end if;
  raise notice 'OK étape 3d : diag_mes_capabilities porte encadrant.';
end;
$verif$;

commit;
