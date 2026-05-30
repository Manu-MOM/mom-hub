-- ============================================================================
-- MOM Hub · Chantier B5 « Autorisation granulaire par catégorie »
-- Fichier : sql/68 — Attribution des rôles (RPC gardées admin) — point 5/6 (§4.3)
-- ----------------------------------------------------------------------------
-- Doc FAIT FOI : Conception-Autorisation-Referent-Categorie-v1.md (md5 2c99a098)
--   §4.3   : « auth_roles n'a aucune policy write. L'attribution de bureau/referent
--            se fera PAR L'ADMIN (SQL Editor, OU une future RPC attribuer_role gardée
--            has_role('admin') — À DÉCIDER en Production). Cohérent D3 (le bureau ne
--            distribue pas les rôles). »
--   §6 (5) : « Attribution des rôles : geste admin (SQL Editor ou RPC attribuer_role
--            gardée admin). »
--   D3     : le bureau n'a PAS la config technique (dont l'attribution des rôles).
--
-- DÉCISION (Manu « je te suis » sur ma recommandation) : RPC attribuer_role +
--   retirer_role gardées admin, plutôt que SQL Editor brut. Motif : la vague
--   d'attributions de la rentrée 2026/2027 (fait déclencheur B5) est un geste
--   récurrent -> outil réutilisable (patron projet : fonctions-staff, ADMIN-(ii)),
--   plus sûr qu'un INSERT brut (validation + trace + anti-lockout). Backend prêt
--   pour un futur écran admin (NON construit ici — option « mini-écran » non retenue).
--
-- Sondes à la source (méthode pt 14, base/repo font foi) — closes :
--   - sql/04 : auth_roles(user_id uuid -> auth.users, role text, created_at,
--     created_by uuid -> auth.users), PK (user_id, role) -> CUMUL natif. AUCUNE
--     policy write (attribution = SQL Editor/service_role aujourd'hui). AUCUNE RPC
--     d'attribution préexistante.
--   - sql/63 (en base, vérifié) : CHECK role ∈ {admin,bureau,referent} (coach/viewer retirés).
--   - has_role(p_role text) SECURITY DEFINER -> garde admin.
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D-a : attribuer_role idempotent (ON CONFLICT (user_id,role) DO NOTHING) — le
--         cumul est porté par la PK composite, ré-attribuer ne casse rien.
--   D-b : created_by = auth.uid() (l'admin qui attribue ; trace d'audit, cohérent
--         comment colonne sql/04).
--   D-c : validation explicite p_role ∈ {admin,bureau,referent} AVANT INSERT
--         (message métier clair ; le CHECK base est le dernier rempart).
--   D-d : GARDE ANTI-LOCKOUT sur retirer_role : refuse de retirer le DERNIER admin
--         (sinon plus aucun compte ne peut administrer -> perte irréversible de la
--         capacité d'attribution). Compte les admins restants avant suppression.
--   D-e : attribuer_role ne CRÉE PAS le compte Auth ni la fiche personnes. Elle
--         attribue un rôle à un user_id auth.users DÉJÀ existant. Séparation des
--         gestes : création compte = Supabase Auth ; liaison = relier_ma_fiche
--         (sql/60) ; périmètre catégoriel = fonction_staff (sql/61) ; rôle = ici.
--   D-f : pas de FK SQL validée vers auth.users dans la RPC (calque auth_roles/sql/04
--         qui ne pose pas de garde d'existence applicative) ; un user_id inconnu
--         lèvera la FK base (auth_roles.user_id -> auth.users) — fail-loud naturel.
-- ============================================================================

-- 1. Attribuer un rôle (ADMIN uniquement)
create or replace function public.attribuer_role(p_user_id uuid, p_role text)
returns public.auth_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.auth_roles;
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur (attribuer_role).'
      using errcode = 'insufficient_privilege';
  end if;

  if p_role not in ('admin', 'bureau', 'referent') then
    raise exception 'Rôle invalide : % (attendu admin|bureau|referent).', p_role;
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
$$;

comment on function public.attribuer_role(uuid, text) is
  'ADMIN. Attribue un rôle (admin|bureau|referent) à un compte auth.users existant. Idempotent (cumul natif). created_by = admin courant. B5 §4.3 / §6(5).';

-- 2. Retirer un rôle (ADMIN uniquement) — avec garde anti-lockout dernier admin
create or replace function public.retirer_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nb_admins int;
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur (retirer_role).'
      using errcode = 'insufficient_privilege';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id requis.';
  end if;

  -- Anti-lockout : on ne retire pas le DERNIER admin (D-d).
  if p_role = 'admin' then
    select count(*) into v_nb_admins from public.auth_roles where role = 'admin';
    if v_nb_admins <= 1 then
      raise exception 'Retrait refusé : ce compte est le dernier administrateur. '
        'Attribuer d''abord le rôle admin à un autre compte avant de retirer celui-ci.';
    end if;
  end if;

  delete from public.auth_roles
  where user_id = p_user_id and role = p_role;
end;
$$;

comment on function public.retirer_role(uuid, text) is
  'ADMIN. Retire un rôle d''un compte. Garde anti-lockout : refuse de retirer le dernier admin. B5 §4.3.';

-- 3. Lecture : rôles d'un compte donné (ADMIN ; confort futur écran de gestion)
--    (get_my_roles() existant = MES rôles ; ici = ceux d'un AUTRE compte, admin-only)
create or replace function public.list_roles_de(p_user_id uuid)
returns table (role text, created_at timestamptz, created_by uuid)
language sql
security definer
set search_path = public
stable
as $$
  select ar.role, ar.created_at, ar.created_by
  from public.auth_roles ar
  where has_role('admin')          -- garde : non-admin -> 0 ligne (pas d'exception, lecture)
    and ar.user_id = p_user_id
  order by ar.role;
$$;

comment on function public.list_roles_de(uuid) is
  'ADMIN (sinon 0 ligne). Rôles attribués à un compte donné. Confort pour un futur écran de gestion des rôles. B5 §4.3.';

grant execute on function public.attribuer_role(uuid, text) to authenticated;
grant execute on function public.retirer_role(uuid, text)   to authenticated;
grant execute on function public.list_roles_de(uuid)        to authenticated;

-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement)
-- ============================================================================
--  A. Présence + garde (en SQL Editor, sans contexte admin -> doit échouer) :
--     select public.attribuer_role('00000000-0000-0000-0000-000000000000','bureau');
--     -- attendu hors contexte admin : exception « Réservé à l'administrateur ».
--
--  B. En contexte admin simulé (request.jwt.claims sub = 7ac40334…, transaction
--     ROLLBACK pour ne rien committer) :
--     begin;
--       -- attribuer bureau à un user_id auth EXISTANT (récupérer un id réel) :
--       -- select public.attribuer_role('<user_id auth réel>','bureau');
--       -- select public.list_roles_de('<user_id>');   -- attendu : ligne bureau
--       -- retirer :
--       -- select public.retirer_role('<user_id>','bureau');
--     rollback;
--
--  C. Anti-lockout : tenter retirer_role(<admin unique>,'admin') -> exception attendue.
--     (NE PAS committer ; en transaction rollback.)
--
--  D. Rôle invalide :
--     -- select public.attribuer_role('<id>','coach');  -- exception « Rôle invalide »
-- ============================================================================
