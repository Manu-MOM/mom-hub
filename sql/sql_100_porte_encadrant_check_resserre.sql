-- =====================================================================
-- sql_100_porte_encadrant_check_resserre.sql
-- ---------------------------------------------------------------------
-- RENOMMAGE DE LA PORTE  referent -> encadrant  (voie 2)  /  ÉTAPE 6/7
-- ⛔ POINT DE NON-RETOUR. Ferme la double-acceptation transitoire.
--
-- ⚠️⚠️ NE PAS EXÉCUTER avant la RECETTE TERRAIN FONCTIONNELLE (étape 5) :
--   un encadrant existant (Vivien, idéalement Mathieu) doit avoir validé
--   EN SESSION RÉELLE qu'il accède ET écrit/valide une compo de sa
--   catégorie sous le nom 'encadrant'. L'affichage du badge NE SUFFIT PAS.
--   Tant que ce ✅ n'est pas obtenu, garder ce fichier en attente.
--
-- OBJET : retirer 'referent' des 4 verrous de valeur du rôle -> resserrer
--   à admin|bureau|encadrant. Après ce fichier, 'referent' est rejeté
--   partout (attribution, pré-attribution, contrainte table).
--
-- PRÉ-REQUIS : étapes 1->4 faites ; données migrées (0 referent,
--   confirmé en base : auth_roles encadrant=2, 0 referent ;
--   roles_en_attente 0 referent). puis_je_faire confirmé sain
--   post-sql_102 (garde 'encadrant', branche pôle additive ; la chaîne
--   'referent de categorie' qui y figure est la FONCTION MÉTIER, pas la
--   porte — NON concernée).
--
-- NE TOUCHE PAS : puis_je_faire, mes_categories_autorisees,
--   mes_poles_autorises, diag_mes_capabilities (gardes déjà 'encadrant',
--   étape 3), ni aucune branche _b5_norm / 'referent de categorie'.
--
-- Corps des 2 RPC recopiés À L'IDENTIQUE depuis la source (post-sql_94),
--   SEULE la liste du IF est resserrée (+ message).
--
-- IDEMPOTENT (drop if exists + create or replace). Fail-loud DOUBLE
--   CEINTURE en TÊTE (avant tout resserrage) puis vérif finale.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. FAIL-LOUD PRÉALABLE (AVANT tout resserrage) — double ceinture.
--    (a) aucune ligne 'referent' ne doit subsister (sinon le resserrage
--        des CHECK table échouerait OU laisserait des lignes orphelines).
--    (b) aucune FONCTION ne doit encore porter la PORTE has_role('referent')
--        (un chantier tiers a pu en réintroduire une depuis l'étape 3 ;
--        on refuse de resserrer tant que la porte vit encore quelque part).
-- ---------------------------------------------------------------------
do $preflight$
declare
  v_auth_referent  int;
  v_att_referent   int;
  v_fn_porteuses   text;
begin
  -- (a) données
  v_auth_referent := (select count(*) from public.auth_roles       where role = 'referent');
  v_att_referent  := (select count(*) from public.roles_en_attente where role = 'referent');

  if v_auth_referent <> 0 then
    raise exception 'PREFLIGHT ABORT: % ligne(s) referent dans auth_roles — migrer (sql_95) avant de resserrer.', v_auth_referent;
  end if;
  if v_att_referent <> 0 then
    raise exception 'PREFLIGHT ABORT: % ligne(s) referent dans roles_en_attente — migrer avant de resserrer.', v_att_referent;
  end if;

  -- (b) porte résiduelle dans une fonction (has_role('referent'))
  --     On EXCLUT la chaîne métier 'referent de categorie' (jamais une porte).
  select string_agg(p.proname, ', ') into v_fn_porteuses
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and pg_get_functiondef(p.oid) ilike '%has_role(''referent'')%';

  if v_fn_porteuses is not null then
    raise exception 'PREFLIGHT ABORT: la porte has_role(''referent'') vit encore dans : % — basculer ces fonctions en encadrant avant de resserrer.', v_fn_porteuses;
  end if;

  raise notice 'PREFLIGHT OK : 0 ligne referent, 0 fonction portant has_role(''referent'') — resserrage autorisé.';
end;
$preflight$;

-- ---------------------------------------------------------------------
-- 1. CHECK de table  auth_roles_role_check  -> admin|bureau|encadrant
-- ---------------------------------------------------------------------
alter table public.auth_roles
  drop constraint if exists auth_roles_role_check;

alter table public.auth_roles
  add constraint auth_roles_role_check
  check (role = any (array['admin'::text, 'bureau'::text, 'encadrant'::text]));

-- ---------------------------------------------------------------------
-- 2. CHECK de table  roles_en_attente_role_check  -> admin|bureau|encadrant
-- ---------------------------------------------------------------------
alter table public.roles_en_attente
  drop constraint if exists roles_en_attente_role_check;

alter table public.roles_en_attente
  add constraint roles_en_attente_role_check
  check (role = any (array['admin'::text, 'bureau'::text, 'encadrant'::text]));

-- ---------------------------------------------------------------------
-- 3. RPC attribuer_role — corps RECOPIÉ À L'IDENTIQUE (post-sql_94),
--    SEULE la liste du IF resserrée (referent retiré) + message.
-- ---------------------------------------------------------------------
create or replace function public.attribuer_role(p_user_id uuid, p_role text)
 returns auth_roles
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row public.auth_roles;
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur (attribuer_role).'
      using errcode = 'insufficient_privilege';
  end if;

  if p_role not in ('admin', 'bureau', 'encadrant') then
    raise exception 'Rôle invalide : % (attendu admin|bureau|encadrant).', p_role;
  end if;

  if p_user_id is null then
    raise exception 'p_user_id requis.';
  end if;

  insert into public.auth_roles (user_id, role, created_by)
  values (p_user_id, p_role, auth.uid())
  on conflict (user_id, role) do nothing;

  -- Renvoie la ligne (qu'elle vienne d'être créée ou déjà présente)
  select * into v_row
  from public.auth_roles
  where user_id = p_user_id and role = p_role;

  return v_row;
end;
$function$;

-- ---------------------------------------------------------------------
-- 4. RPC preattribuer_role — corps RECOPIÉ À L'IDENTIQUE (post-sql_94),
--    SEULE la liste du IF resserrée + message.
-- ---------------------------------------------------------------------
create or replace function public.preattribuer_role(p_personne_id uuid, p_role text)
 returns roles_en_attente
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row public.roles_en_attente;
  v_cree_par uuid;
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  if not exists (select 1 from public.personnes p where p.id = p_personne_id) then
    raise exception 'Fiche personne introuvable : %', p_personne_id;
  end if;
  if p_role not in ('admin', 'bureau', 'encadrant') then
    raise exception 'Rôle invalide : % (attendu admin|bureau|encadrant).', p_role;
  end if;

  -- created_by = personne reliée au compte courant si elle existe (motif definir_fonction_staff, S9)
  select personne_id into v_cree_par from public.qui_suis_je();

  insert into public.roles_en_attente (personne_id, role, created_by)
  values (p_personne_id, p_role, v_cree_par)
  on conflict (personne_id, role) do nothing;

  select * into v_row
  from public.roles_en_attente
  where personne_id = p_personne_id and role = p_role;

  return v_row;
end;
$function$;

-- ---------------------------------------------------------------------
-- 5. FAIL-LOUD FINAL — les 4 verrous rejettent-ils bien 'referent'
--    et acceptent-ils 'encadrant' ?
-- ---------------------------------------------------------------------
do $verif$
declare
  v_def_auth         text;
  v_def_attente      text;
  v_def_attribuer    text;
  v_def_preattribuer text;
begin
  v_def_auth := (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con join pg_class c on c.oid = con.conrelid
    where c.relname = 'auth_roles' and con.conname = 'auth_roles_role_check'
  );
  v_def_attente := (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con join pg_class c on c.oid = con.conrelid
    where c.relname = 'roles_en_attente' and con.conname = 'roles_en_attente_role_check'
  );
  v_def_attribuer := (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'attribuer_role'
  );
  v_def_preattribuer := (
    select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'preattribuer_role'
  );

  if v_def_auth ilike '%referent%' then
    raise exception 'FAIL-LOUD: auth_roles_role_check contient encore referent (def=%).', v_def_auth;
  end if;
  if v_def_auth not ilike '%encadrant%' then
    raise exception 'FAIL-LOUD: auth_roles_role_check n''accepte pas encadrant (def=%).', v_def_auth;
  end if;
  if v_def_attente ilike '%referent%' then
    raise exception 'FAIL-LOUD: roles_en_attente_role_check contient encore referent (def=%).', v_def_attente;
  end if;
  if v_def_attente not ilike '%encadrant%' then
    raise exception 'FAIL-LOUD: roles_en_attente_role_check n''accepte pas encadrant (def=%).', v_def_attente;
  end if;
  if v_def_attribuer ilike '%''referent''%' then
    raise exception 'FAIL-LOUD: attribuer_role accepte encore referent dans son CHECK interne.';
  end if;
  if v_def_attribuer not ilike '%''encadrant''%' then
    raise exception 'FAIL-LOUD: attribuer_role n''accepte pas encadrant.';
  end if;
  if v_def_preattribuer ilike '%''referent''%' then
    raise exception 'FAIL-LOUD: preattribuer_role accepte encore referent dans son CHECK interne.';
  end if;
  if v_def_preattribuer not ilike '%''encadrant''%' then
    raise exception 'FAIL-LOUD: preattribuer_role n''accepte pas encadrant.';
  end if;

  raise notice 'OK étape 6 : les 4 verrous rejettent referent et acceptent encadrant. Double-acceptation fermée — point de non-retour franchi.';
end;
$verif$;

commit;
