-- =====================================================================
-- sql_233_bibliotheque_favoris_reference.sql
-- ---------------------------------------------------------------------
-- Chantier : BIBLIOTHEQUE-FAVORIS-ET-REFERENCE (pt 233).
-- Objet    : deux mecaniques de tag sur les ateliers de la Bibliotheque,
--            partageant le meme patron (table + RLS + RPC SECURITY
--            DEFINER + lecture pour le moteur de recherche), mais
--            fonctionnellement DISTINCTES :
--
--   FAVORIS   — portee UTILISATEUR. Chaque membre marque ses propres
--               ateliers, visibles de lui seul. RLS : chaque user ne
--               lit/ecrit QUE ses lignes.
--   REFERENCE — portee ROLE. Tag pose/retire uniquement par admin OU
--               responsable du pole EDR (principal ou co). Visible de
--               TOUS. RLS : lecture ouverte, ecriture gardee par RPC.
--
-- Modele (Option A, feu vert Manu) : DEUX tables separees. Regimes de
--   securite opposes (mes-lignes vs garde-par-role) -> tables + RLS
--   distinctes, pas de policy conditionnelle sur un discriminant (P1).
--
-- CLE D'IDENTITE (FAIT FOI, sonde a la source pt 233) :
--   atelier_id TEXT = a.id cote front = ID de dossier Drive.
--   - Present 225/225 ateliers (data/ateliers.json / ateliers_flat).
--   - Cle primaire de fait : jointure FICHES[a.id] (fiches-all.json)
--     ET URL dossier Drive (drive.google.com/drive/folders/{a.id}).
--   - 16 "collisions" = cross-listings (meme atelier dans 2 rubriques,
--     champ `cross` renseigne) -> le tag s'applique VOLONTAIREMENT a
--     l'atelier partout ou il apparait (comportement voulu).
--   - Aucun slug interne plus stable n'existe (verifie : une fiche
--     n'a pas de cle propre, la cle du JSON EST l'ID Drive).
--   - Perennite conditionnee a la stabilite des dossiers Drive cote
--     Converter. Si un dossier est recree, le tag orphelin devient
--     inerte (aucun atelier ne le matche) -> degradation propre,
--     jamais de casse. Meilleur compromis P1 disponible.
--
-- Faits source (DS-1, tarball frais + fichiers SQL deployes) :
--   - qui_suis_je() returns table(personne_id uuid), 0 ligne si non
--     relie (sql_60_auth_personne.sql).
--   - has_role(p_role text) returns boolean (04-auth-roles.sql).
--   - poles(code text, responsable_principal_id uuid, co_responsable_id
--     uuid) ; les deux -> personnes(id) ON DELETE SET NULL
--     (sql_103, sql_107). Lohann = responsable_principal du pole EDR.
--   - personnes(id) = cible FK des fiches (sql_60, sql_103).
--
-- Garde ecriture reference (FAIT FOI, feu vert Manu) :
--   has_role('admin') OR est_responsable_edr()
--   ou est_responsable_edr() = "je suis principal OU co du pole EDR".
--
-- Doctrine : ecritures via RPC SECURITY DEFINER ; REVOKE public+anon /
--   GRANT authenticated ; fail-loud do $verif$ ; additif (aucune table
--   ni fonction existante modifiee, uniquement des CREATE nouveaux).
-- =====================================================================


-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- --- 1.1 FAVORIS (portee utilisateur) --------------------------------
create table if not exists public.ateliers_favoris (
  personne_id  uuid        not null
                 references public.personnes(id) on delete cascade,
  atelier_id   text        not null,
  created_at   timestamptz not null default now(),
  constraint ateliers_favoris_pk primary key (personne_id, atelier_id)
);

comment on table public.ateliers_favoris is
  'Favoris d''ateliers Bibliotheque, portee utilisateur. atelier_id = ID dossier Drive (a.id). RLS : chaque user ne voit/ecrit que ses lignes. Ecriture via RPC favori_ajouter / favori_retirer.';

create index if not exists ateliers_favoris_personne_idx
  on public.ateliers_favoris (personne_id);


-- --- 1.2 REFERENCE (portee role) -------------------------------------
create table if not exists public.ateliers_reference (
  atelier_id   text        not null,
  pose_par     uuid        references public.personnes(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint ateliers_reference_pk primary key (atelier_id)
);

comment on table public.ateliers_reference is
  'Ateliers marques "de reference", portee club (visibles de tous). atelier_id = ID dossier Drive (a.id). RLS : lecture ouverte a tout authentifie ; ecriture via RPC reference_ajouter / reference_retirer (garde admin OU responsable EDR). pose_par = tracabilite (SET NULL si la fiche disparait).';


-- =====================================================================
-- 2. RLS
-- =====================================================================

-- --- 2.1 FAVORIS : mes-lignes ----------------------------------------
alter table public.ateliers_favoris enable row level security;

-- Lecture : uniquement mes propres favoris (personne_id resolu depuis
-- qui_suis_je(), donc depuis auth.uid()).
drop policy if exists ateliers_favoris_select_own on public.ateliers_favoris;
create policy ateliers_favoris_select_own
  on public.ateliers_favoris
  for select
  to authenticated
  using (
    personne_id in (select qs.personne_id from public.qui_suis_je() qs)
  );

-- Aucune policy INSERT/UPDATE/DELETE directe : toute ecriture passe par
-- les RPC SECURITY DEFINER (favori_ajouter / favori_retirer). La table
-- reste donc non ecrivable en direct par le client (RLS deny par defaut).


-- --- 2.2 REFERENCE : lecture ouverte, ecriture par RPC ---------------
alter table public.ateliers_reference enable row level security;

-- Lecture : ouverte a tout authentifie (les ateliers de reference sont
-- visibles de tous). Pas d'anon (la Bibliotheque est derriere auth).
drop policy if exists ateliers_reference_select_all on public.ateliers_reference;
create policy ateliers_reference_select_all
  on public.ateliers_reference
  for select
  to authenticated
  using (true);

-- Aucune policy d'ecriture directe : reference_ajouter / reference_retirer
-- (SECURITY DEFINER + garde de role) sont l'unique porte d'ecriture.


-- =====================================================================
-- 3. HELPER DE GARDE — est_responsable_edr()
-- =====================================================================
-- Source unique de verite pour la garde EDR. SECURITY DEFINER : lit
-- `poles` en franchissant la RLS. Renvoie true si le connecte est
-- responsable principal OU co-responsable du pole EDR.
-- ---------------------------------------------------------------------
create or replace function public.est_responsable_edr()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $est_responsable_edr$
declare
  v_personne_id uuid;
begin
  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  if v_personne_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.poles p
    where p.code = 'EDR'
      and (p.responsable_principal_id = v_personne_id
           or p.co_responsable_id = v_personne_id)
  );
end;
$est_responsable_edr$;

comment on function public.est_responsable_edr() is
  'true si le compte connecte est responsable principal ou co-responsable du pole EDR. Garde d''ecriture des ateliers de reference (avec has_role(''admin'')).';

revoke all on function public.est_responsable_edr() from public;
revoke all on function public.est_responsable_edr() from anon;
grant execute on function public.est_responsable_edr() to authenticated;


-- =====================================================================
-- 4. RPC FAVORIS (portee user)
-- =====================================================================

-- --- 4.1 favori_ajouter ----------------------------------------------
create or replace function public.favori_ajouter(p_atelier_id text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $favori_ajouter$
declare
  v_personne_id uuid;
begin
  if p_atelier_id is null or length(trim(p_atelier_id)) = 0 then
    raise exception 'favori_ajouter : p_atelier_id requis.';
  end if;

  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  -- Plancher D7 : un compte non relie a une fiche n'a pas de favoris.
  if v_personne_id is null then
    raise exception 'favori_ajouter : compte non relie a une fiche personne.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.ateliers_favoris (personne_id, atelier_id)
  values (v_personne_id, p_atelier_id)
  on conflict (personne_id, atelier_id) do nothing;
end;
$favori_ajouter$;

revoke all on function public.favori_ajouter(text) from public;
revoke all on function public.favori_ajouter(text) from anon;
grant execute on function public.favori_ajouter(text) to authenticated;


-- --- 4.2 favori_retirer ----------------------------------------------
create or replace function public.favori_retirer(p_atelier_id text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $favori_retirer$
declare
  v_personne_id uuid;
begin
  if p_atelier_id is null or length(trim(p_atelier_id)) = 0 then
    raise exception 'favori_retirer : p_atelier_id requis.';
  end if;

  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  if v_personne_id is null then
    raise exception 'favori_retirer : compte non relie a une fiche personne.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent : aucune erreur si la ligne n'existe pas.
  delete from public.ateliers_favoris
  where personne_id = v_personne_id
    and atelier_id = p_atelier_id;
end;
$favori_retirer$;

revoke all on function public.favori_retirer(text) from public;
revoke all on function public.favori_retirer(text) from anon;
grant execute on function public.favori_retirer(text) to authenticated;


-- --- 4.3 mes_favoris (lecture) ---------------------------------------
-- Hydrate le filtre "mes favoris" du moteur de recherche. Lecture via
-- RPC pour un contrat stable cote front (setof text = liste d'atelier_id).
create or replace function public.mes_favoris()
returns setof text
language plpgsql
stable
security definer
set search_path to 'public'
as $mes_favoris$
declare
  v_personne_id uuid;
begin
  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  -- Non relie -> aucun favori (pas d'erreur, degradation honnete).
  if v_personne_id is null then
    return;
  end if;

  return query
    select f.atelier_id
    from public.ateliers_favoris f
    where f.personne_id = v_personne_id;
end;
$mes_favoris$;

revoke all on function public.mes_favoris() from public;
revoke all on function public.mes_favoris() from anon;
grant execute on function public.mes_favoris() to authenticated;


-- =====================================================================
-- 5. RPC REFERENCE (portee role)
-- =====================================================================

-- --- 5.1 reference_ajouter -------------------------------------------
create or replace function public.reference_ajouter(p_atelier_id text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $reference_ajouter$
declare
  v_personne_id uuid;
begin
  if p_atelier_id is null or length(trim(p_atelier_id)) = 0 then
    raise exception 'reference_ajouter : p_atelier_id requis.';
  end if;

  -- Garde : admin OU responsable EDR (principal ou co).
  if not (has_role('admin') or public.est_responsable_edr()) then
    raise exception 'reference_ajouter : reserve a l''admin ou au responsable du pole EDR.'
      using errcode = 'insufficient_privilege';
  end if;

  -- pose_par = la personne qui pose le tag (tracabilite), si reliee.
  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  insert into public.ateliers_reference (atelier_id, pose_par)
  values (p_atelier_id, v_personne_id)
  on conflict (atelier_id) do nothing;
end;
$reference_ajouter$;

revoke all on function public.reference_ajouter(text) from public;
revoke all on function public.reference_ajouter(text) from anon;
grant execute on function public.reference_ajouter(text) to authenticated;


-- --- 5.2 reference_retirer -------------------------------------------
create or replace function public.reference_retirer(p_atelier_id text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $reference_retirer$
begin
  if p_atelier_id is null or length(trim(p_atelier_id)) = 0 then
    raise exception 'reference_retirer : p_atelier_id requis.';
  end if;

  if not (has_role('admin') or public.est_responsable_edr()) then
    raise exception 'reference_retirer : reserve a l''admin ou au responsable du pole EDR.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent : aucune erreur si le tag n'existe pas.
  delete from public.ateliers_reference
  where atelier_id = p_atelier_id;
end;
$reference_retirer$;

revoke all on function public.reference_retirer(text) from public;
revoke all on function public.reference_retirer(text) from anon;
grant execute on function public.reference_retirer(text) to authenticated;


-- --- 5.3 ateliers_reference_ids (lecture) ----------------------------
-- Hydrate le filtre "ateliers de reference" du moteur de recherche.
-- Lecture ouverte a tout authentifie (les tags sont visibles de tous).
-- La table est deja lisible en RLS ; ce RPC offre un contrat symetrique
-- a mes_favoris() cote front (setof text).
create or replace function public.ateliers_reference_ids()
returns setof text
language sql
stable
security definer
set search_path to 'public'
as $ateliers_reference_ids$
  select r.atelier_id from public.ateliers_reference r;
$ateliers_reference_ids$;

revoke all on function public.ateliers_reference_ids() from public;
revoke all on function public.ateliers_reference_ids() from anon;
grant execute on function public.ateliers_reference_ids() to authenticated;


-- --- 5.4 puis_je_tagger_reference (lecture de droit) -----------------
-- Le front conditionne l'affichage du bouton "Atelier de reference" a
-- ce droit. Expose la garde en lecture (sans divulguer la logique).
create or replace function public.puis_je_tagger_reference()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $puis_je_tagger_reference$
  select public.has_role('admin') or public.est_responsable_edr();
$puis_je_tagger_reference$;

revoke all on function public.puis_je_tagger_reference() from public;
revoke all on function public.puis_je_tagger_reference() from anon;
grant execute on function public.puis_je_tagger_reference() to authenticated;


-- =====================================================================
-- 6. VERIFICATION FAIL-LOUD (do $verif$)
-- =====================================================================
-- On ne peut pas tester le resultat fonctionnel (depend du connecte).
-- On verifie la structure : tables + RLS activee + policies + signatures
-- des 7 fonctions + REVOKE anon effectif.
-- ---------------------------------------------------------------------
do $verif$
declare
  v_missing text := '';
begin
  -- 6.1 Tables presentes.
  if to_regclass('public.ateliers_favoris') is null then
    v_missing := v_missing || ' ateliers_favoris(table)';
  end if;
  if to_regclass('public.ateliers_reference') is null then
    v_missing := v_missing || ' ateliers_reference(table)';
  end if;

  -- 6.2 RLS activee sur les deux tables.
  if not exists (
    select 1 from pg_class
    where oid = 'public.ateliers_favoris'::regclass and relrowsecurity is true
  ) then
    v_missing := v_missing || ' ateliers_favoris(RLS-off)';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.ateliers_reference'::regclass and relrowsecurity is true
  ) then
    v_missing := v_missing || ' ateliers_reference(RLS-off)';
  end if;

  -- 6.3 Policies de lecture presentes.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ateliers_favoris'
      and policyname = 'ateliers_favoris_select_own'
  ) then
    v_missing := v_missing || ' policy(favoris_select_own)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ateliers_reference'
      and policyname = 'ateliers_reference_select_all'
  ) then
    v_missing := v_missing || ' policy(reference_select_all)';
  end if;

  -- 6.4 Signatures des 7 fonctions.
  if to_regprocedure('public.est_responsable_edr()') is null then
    v_missing := v_missing || ' est_responsable_edr()';
  end if;
  if to_regprocedure('public.favori_ajouter(text)') is null then
    v_missing := v_missing || ' favori_ajouter(text)';
  end if;
  if to_regprocedure('public.favori_retirer(text)') is null then
    v_missing := v_missing || ' favori_retirer(text)';
  end if;
  if to_regprocedure('public.mes_favoris()') is null then
    v_missing := v_missing || ' mes_favoris()';
  end if;
  if to_regprocedure('public.reference_ajouter(text)') is null then
    v_missing := v_missing || ' reference_ajouter(text)';
  end if;
  if to_regprocedure('public.reference_retirer(text)') is null then
    v_missing := v_missing || ' reference_retirer(text)';
  end if;
  if to_regprocedure('public.ateliers_reference_ids()') is null then
    v_missing := v_missing || ' ateliers_reference_ids()';
  end if;
  if to_regprocedure('public.puis_je_tagger_reference()') is null then
    v_missing := v_missing || ' puis_je_tagger_reference()';
  end if;

  -- 6.5 anon ne doit PAS pouvoir executer les RPC sensibles (echantillon).
  if has_function_privilege('anon', 'public.favori_ajouter(text)', 'execute') then
    v_missing := v_missing || ' anon-peut-favori_ajouter';
  end if;
  if has_function_privilege('anon', 'public.reference_ajouter(text)', 'execute') then
    v_missing := v_missing || ' anon-peut-reference_ajouter';
  end if;

  if length(v_missing) > 0 then
    raise exception 'sql_233 FAIL — manquant/incorrect :%', v_missing;
  end if;

  raise notice 'sql_233 OK : 2 tables + RLS + 2 policies lecture + 7 RPC (garde EDR, favoris user, reference role), anon revoque.';
end;
$verif$;
