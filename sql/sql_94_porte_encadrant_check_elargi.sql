-- =====================================================================
-- sql_94_porte_encadrant_check_elargi.sql
-- ---------------------------------------------------------------------
-- RENOMMAGE DE LA PORTE  referent -> encadrant  (voie 2)  /  ÉTAPE 1/7
-- Stratégie (b) « double-acceptation transitoire ».
--
-- OBJET : élargir les contraintes de valeur du rôle pour qu'elles
--   acceptent 'encadrant' EN PLUS de 'referent'. PURE EXTENSION :
--   aucune ligne migrée, aucune garde has_role() touchée, aucune
--   fonction de capability modifiée. Après ce fichier, le système
--   accepte indifféremment les deux jetons — fenêtre sans coupure.
--
-- PORTÉE (cartographiée à la source, conv dédiée) :
--   - CHECK table  auth_roles_role_check
--   - CHECK table  roles_en_attente_role_check
--   - CHECK interne RPC attribuer_role(p_user_id, p_role)
--   - CHECK interne RPC preattribuer_role(p_personne_id, p_role)
--   Les corps des 2 RPC sont recopiés À L'IDENTIQUE depuis la source
--   (pg_get_functiondef) ; SEULE la liste de valeurs du IF change.
--
-- HORS PORTÉE (faux positifs tracés, NON touchés ici ni ailleurs) :
--   _capabilities_referent_non_vide (cible la FONCTION métier
--   'referent de categorie'), ma_fonction_staff, valider_composition,
--   get_noms_personnes, club_referent_id, branches _b5_norm.
--
-- RÉVERSIBILITÉ : étape 1 réversible (resserrage = étape 6, sql ultérieur).
--   NE PAS resserrer avant la recette terrain (étape 5) — point de
--   non-retour explicite du plan.
--
-- IDEMPOTENT — fail-loud (bloc DO $verif$ finale).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. CHECK de table  auth_roles_role_check  (admin|bureau|referent
--    -> admin|bureau|referent|encadrant)
-- ---------------------------------------------------------------------
alter table public.auth_roles
  drop constraint if exists auth_roles_role_check;

alter table public.auth_roles
  add constraint auth_roles_role_check
  check (role = any (array['admin'::text, 'bureau'::text, 'referent'::text, 'encadrant'::text]));

-- ---------------------------------------------------------------------
-- 2. CHECK de table  roles_en_attente_role_check
-- ---------------------------------------------------------------------
alter table public.roles_en_attente
  drop constraint if exists roles_en_attente_role_check;

alter table public.roles_en_attente
  add constraint roles_en_attente_role_check
  check (role = any (array['admin'::text, 'bureau'::text, 'referent'::text, 'encadrant'::text]));

-- ---------------------------------------------------------------------
-- 3. RPC attribuer_role — corps RECOPIÉ À L'IDENTIQUE depuis la source,
--    SEULE la liste du IF p_role not in (...) est élargie.
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

  if p_role not in ('admin', 'bureau', 'referent', 'encadrant') then
    raise exception 'Rôle invalide : % (attendu admin|bureau|referent|encadrant).', p_role;
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
-- 4. RPC preattribuer_role — corps RECOPIÉ À L'IDENTIQUE depuis la
--    source, SEULE la liste du IF p_role not in (...) est élargie
--    (message d'erreur ajusté en cohérence).
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
  if p_role not in ('admin', 'bureau', 'referent', 'encadrant') then
    raise exception 'Rôle invalide : % (attendu admin|bureau|referent|encadrant).', p_role;
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
-- 5. FAIL-LOUD — l'extension est-elle effective sur les 4 points ?
--    Lève si l'un des 4 verrous n'accepte pas 'encadrant', OU si
--    'referent' a disparu (ce fichier ne doit JAMAIS resserrer).
-- ---------------------------------------------------------------------
do $verif$
declare
  v_def_auth         text;
  v_def_attente      text;
  v_def_attribuer    text;
  v_def_preattribuer text;
begin
  -- CHECK tables (sous-requête scalaire affectée à la variable :
  -- forme non ambiguë pour le parseur, évite le piège SELECT..INTO multi-lignes).
  v_def_auth := (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    where c.relname = 'auth_roles' and con.conname = 'auth_roles_role_check'
  );

  v_def_attente := (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    where c.relname = 'roles_en_attente' and con.conname = 'roles_en_attente_role_check'
  );

  if v_def_auth is null or v_def_auth not ilike '%encadrant%' then
    raise exception 'FAIL-LOUD: auth_roles_role_check n''accepte pas encadrant (def=%).', v_def_auth;
  end if;
  if v_def_auth not ilike '%referent%' then
    raise exception 'FAIL-LOUD: auth_roles_role_check ne contient plus referent — étape 1 ne doit pas resserrer.';
  end if;
  if v_def_attente is null or v_def_attente not ilike '%encadrant%' then
    raise exception 'FAIL-LOUD: roles_en_attente_role_check n''accepte pas encadrant (def=%).', v_def_attente;
  end if;
  if v_def_attente not ilike '%referent%' then
    raise exception 'FAIL-LOUD: roles_en_attente_role_check ne contient plus referent — étape 1 ne doit pas resserrer.';
  end if;

  -- CHECK internes des RPC
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

  if v_def_attribuer not ilike '%''encadrant''%' then
    raise exception 'FAIL-LOUD: attribuer_role n''accepte pas encadrant dans son CHECK interne.';
  end if;
  if v_def_attribuer not ilike '%''referent''%' then
    raise exception 'FAIL-LOUD: attribuer_role a perdu referent — étape 1 ne doit pas resserrer.';
  end if;
  if v_def_preattribuer not ilike '%''encadrant''%' then
    raise exception 'FAIL-LOUD: preattribuer_role n''accepte pas encadrant dans son CHECK interne.';
  end if;
  if v_def_preattribuer not ilike '%''referent''%' then
    raise exception 'FAIL-LOUD: preattribuer_role a perdu referent — étape 1 ne doit pas resserrer.';
  end if;

  raise notice 'OK étape 1 : les 4 verrous acceptent referent ET encadrant (double-acceptation transitoire en place).';
end;
$verif$;

commit;
