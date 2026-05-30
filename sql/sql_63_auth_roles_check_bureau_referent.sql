-- ============================================================================
-- MOM Hub · Chantier B5 « Autorisation granulaire par catégorie »
-- Fichier : sql/63 — Élargir le CHECK auth_roles -> {admin, bureau, referent} (D8)
-- ----------------------------------------------------------------------------
-- Doc FAIT FOI : Conception-Autorisation-Referent-Categorie-v1.md (md5 2c99a098)
--   §3 D8  : rôles auth_roles = {admin, bureau, referent} ; coach/viewer
--            (jamais peuplés) RETIRÉS du CHECK.
--   §6 (1) : « élargir le CHECK, idempotent, aucune ligne existante affectée
--            (seul admin peuplé) ».
--
-- Sondes à la source (méthode pt 14, base/repo font foi) — closes avant écriture :
--   S1 : sql/04-auth-roles.sql LU à la source (raw.githubusercontent.com,
--        Manu-MOM/mom-hub@main) -> CHECK inline « role in ('admin','coach','viewer') »
--        (contrainte nommée par Postgres, nom auto, NON 'auth_roles_role_check'
--        garanti) ; PK (user_id, role) ; has_role(p_role text) + get_my_roles()
--        SECURITY DEFINER ; AUCUNE policy write (attribution = SQL Editor /
--        service_role / future RPC admin). 1 ligne réelle = admin 7ac40334….
--        coach/viewer jamais peuplés.
--
-- Principe P1 : le plus simple qui tient. Une seule chose change ici — le domaine
--   autorisé de la colonne role. Aucune table, aucune RPC, aucune policy touchée.
--   Le helper de dérivation par catégorie = sql/64 (point 2), séparé.
--
-- Idempotence & sûreté :
--   - On résout le nom RÉEL de la contrainte CHECK portant sur « role » via
--     pg_constraint (on ne devine pas 'auth_roles_role_check').
--   - GARDE ANTI-PERTE : si une ligne porte un role hors {admin,bureau,referent},
--     on REFUSE de migrer (exception explicite) plutôt que de créer un CHECK que
--     les données violent, ou de risquer une perte. (S1 dit 0 ligne coach/viewer ;
--     on le PROUVE à l'exécution, on ne le présume pas.)
--   - Rejouable : drop-if-exists du nom canonique cible + recréation.
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D-a : nom de contrainte cible canonique stable = 'auth_roles_role_check'
--         (recréée explicitement, plus de nom auto Postgres).
--   D-b : domaine = {admin, bureau, referent} EXACTEMENT (coach/viewer retirés, D8).
--   D-c : comment de la colonne role mis à jour (3 rôles + sémantique B5).
-- ============================================================================

do $$
declare
  v_constraint_name text;
  v_hors_domaine    int;
begin
  -- 1. Garde anti-perte : aucune ligne ne doit porter un role hors du futur domaine.
  select count(*) into v_hors_domaine
  from public.auth_roles
  where role not in ('admin', 'bureau', 'referent');

  if v_hors_domaine > 0 then
    raise exception
      'Migration refusée : % ligne(s) auth_roles portent un role hors {admin,bureau,referent}. '
      'Régulariser ces lignes AVANT de rejouer (le doc D8 prévoit 0 ligne coach/viewer).',
      v_hors_domaine;
  end if;

  -- 2. Résoudre le nom RÉEL du CHECK portant sur « role » (ne pas deviner).
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'auth_roles'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%role%'
  limit 1;

  -- 3. Dropper le CHECK existant (quel que soit son nom auto), s'il existe.
  if v_constraint_name is not null then
    execute format('alter table public.auth_roles drop constraint %I', v_constraint_name);
  end if;

  -- 4. Dropper aussi le nom canonique cible (idempotence si on rejoue ce script).
  if exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'auth_roles'
      and con.conname = 'auth_roles_role_check'
  ) then
    alter table public.auth_roles drop constraint auth_roles_role_check;
  end if;

  -- 5. Recréer le CHECK élargi sous un nom canonique stable.
  alter table public.auth_roles
    add constraint auth_roles_role_check
    check (role in ('admin', 'bureau', 'referent'));

  raise notice 'auth_roles : CHECK role -> {admin,bureau,referent} appliqué (0 ligne hors domaine, ancien CHECK = %).',
    coalesce(v_constraint_name, '(aucun)');
end;
$$;

-- 6. Mettre à jour le commentaire de la colonne (sémantique B5)
comment on column public.auth_roles.role is
  'Rôle d''autorisation applicatif. admin = tout (sportif + config technique) ; '
  'bureau = écriture transverse sur tout le sportif + évènements club-wide, SANS config technique ; '
  'referent = lecture+écriture bornées aux catégories dérivées de fonction_staff. '
  'Conception-Autorisation-Referent-Categorie-v1 D8. NB : le périmètre catégoriel '
  'du referent vient de fonction_staff, PAS de ce champ (distinction §2.3 : rôle ≠ fonction).';

-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement après le script)
-- ============================================================================
--  A. Le CHECK reflète le nouveau domaine :
--     select pg_get_constraintdef(con.oid)
--       from pg_constraint con
--       join pg_class rel on rel.oid = con.conrelid
--      where rel.relname = 'auth_roles' and con.conname = 'auth_roles_role_check';
--     -- attendu : CHECK (role = ANY (ARRAY['admin','bureau','referent']))
--
--  B. Aucune ligne affectée (la seule ligne réelle = admin reste valide) :
--     select role, count(*) from public.auth_roles group by role;
--     -- attendu : admin | 1   (aucune ligne coach/viewer)
--
--  C. Un INSERT 'coach' est désormais refusé, 'bureau'/'referent' acceptés :
--     -- (test en transaction rollback, NE PAS committer)
--     -- begin;
--     --   insert into public.auth_roles(user_id, role)
--     --   values ('00000000-0000-0000-0000-000000000000','bureau');   -- OK
--     --   insert into public.auth_roles(user_id, role)
--     --   values ('00000000-0000-0000-0000-000000000000','coach');    -- ERREUR CHECK attendue
--     -- rollback;
-- ============================================================================
