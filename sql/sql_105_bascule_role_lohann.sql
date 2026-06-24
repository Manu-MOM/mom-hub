-- =====================================================================
-- sql_105_bascule_role_lohann.sql
-- ---------------------------------------------------------------------
-- Contexte : session de CONFIGURATION de Lohann, en marge de la conv
--   « Production · Rôles responsable de pôle » (écart de sujet assumé).
--   À exécuter APRÈS sql_104 (casquettes posées).
-- Objet    : basculer Lohann de 'admin' (rôle de commodité donné par
--            Manu pendant la construction) vers 'encadrant' (son rôle
--            réel). Permet enfin de recetter la mécanique pôle/encadrant
--            depuis son compte (un admin court-circuiterait tout).
--
-- Faits source (DS-1, sondes 24/06) :
--   - auth_roles contient DEUX admins :
--       * 7ac40334-... = manu.jung.67@gmail.com (admin racine, sans
--         fiche personnes) -> MANU. Subsiste après ce geste.
--       * 0267fc54-... = lohannhumbert@icloud.com -> LOHANN. Retiré ici.
--   - auth_personne : user_id Lohann = 0267fc54-add9-42f4-b97d-d7bbcbfb9169
--     <-> personne_id 589e7977-... (HUMBERT Lohann).
--   - Valeurs de rôle valides (auth_roles.role) : admin | bureau | encadrant.
--
-- ANTI-LOCKOUT (D-anti-void) : le DELETE de l'admin de Lohann ne
--   s'exécute QUE s'il reste AU MOINS un autre admin après coup.
--   Vérifié dynamiquement, pas en dur.
-- Idempotent : si Lohann est déjà encadrant (pas admin), no-op.
-- =====================================================================

do $bascule$
declare
  v_lohann_uid uuid := '0267fc54-add9-42f4-b97d-d7bbcbfb9169';  -- auth.users.id de Lohann
  v_autres_admins int;
  v_a_le_role_admin boolean;
begin
  -- 0. Etat actuel de Lohann.
  select exists (
    select 1 from public.auth_roles
    where user_id = v_lohann_uid and role = 'admin'
  ) into v_a_le_role_admin;

  -- =================================================================
  -- 1. Poser 'encadrant' pour Lohann (idempotent).
  --    On le fait AVANT le retrait admin : à aucun instant Lohann ne
  --    se retrouve sans rôle.
  -- =================================================================
  if not exists (
    select 1 from public.auth_roles
    where user_id = v_lohann_uid and role = 'encadrant'
  ) then
    insert into public.auth_roles (user_id, role, created_by)
    values (v_lohann_uid, 'encadrant', '7ac40334-0d2a-4b1f-822b-133d564abe6c');
    raise notice 'sql_105 : role encadrant pose pour Lohann.';
  else
    raise notice 'sql_105 : Lohann a deja le role encadrant (no-op INSERT).';
  end if;

  -- =================================================================
  -- 2. Retirer 'admin' de Lohann — SOUS GARDE ANTI-LOCKOUT.
  -- =================================================================
  if not v_a_le_role_admin then
    raise notice 'sql_105 : Lohann n a pas le role admin (no-op DELETE).';
  else
    -- Compter les AUTRES admins (hors Lohann).
    select count(*) into v_autres_admins
    from public.auth_roles
    where role = 'admin' and user_id <> v_lohann_uid;

    if v_autres_admins < 1 then
      raise exception
        'sql_105 FAIL ANTI-LOCKOUT : retirer l admin de Lohann laisserait 0 autre admin. Geste refuse.';
    end if;

    delete from public.auth_roles
    where user_id = v_lohann_uid and role = 'admin';
    raise notice 'sql_105 : role admin retire de Lohann (% autre(s) admin subsistant).', v_autres_admins;
  end if;

  -- =================================================================
  -- 3. Vérifs post-écriture fail-loud.
  -- =================================================================
  if not exists (
    select 1 from public.auth_roles
    where user_id = v_lohann_uid and role = 'encadrant'
  ) then
    raise exception 'sql_105 FAIL : Lohann n a pas le role encadrant apres bascule';
  end if;

  if exists (
    select 1 from public.auth_roles
    where user_id = v_lohann_uid and role = 'admin'
  ) then
    raise exception 'sql_105 FAIL : Lohann a encore le role admin apres bascule';
  end if;

  if (select count(*) from public.auth_roles where role = 'admin') < 1 then
    raise exception 'sql_105 FAIL : plus aucun admin dans le systeme (lockout)';
  end if;

  raise notice 'sql_105 OK : Lohann bascule admin -> encadrant. Au moins un admin subsiste (Manu). Lohann recettable.';
end;
$bascule$;
