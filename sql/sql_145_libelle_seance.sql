-- ============================================================================
-- sql_145_libelle_seance.sql
-- Chantier : Production · Séances — édition unitaire, libellé, forfaits
-- FAIT FOI : FAIT-FOI-seance-edition-libelle-forfaits-v1.md (figé 02/07/2026)
-- Objet :
--   1) Colonne additive mission_seances.libelle (text NULL) — arbitrage A1 (b).
--   2) Extension de creer_seance_ponctuelle : 11 → 12 params (+ p_libelle).
--   3) Extension de upsert_mission_seance   : 11 → 12 params (+ p_libelle).
--   Corps des RPC recréés À L'IDENTIQUE de la sonde S1 du 02/07/2026,
--   seule l'écriture de libelle est ajoutée (INSERT / UPDATE).
-- Invariants : SECURITY DEFINER + search_path public ; gardes inchangées
--   (voie 3 + forçage 'realisee' salarié ; _gs_peut_ecrire() sur l'upsert) ;
--   gcal_uid jamais touché par l'upsert ; REVOKE public/anon + GRANT authenticated.
-- Idempotent : rejouable sans effet de bord (IF NOT EXISTS / IF EXISTS).
-- Éditeur SQL Supabase : pas de BEGIN/COMMIT explicites.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Colonne additive
-- ----------------------------------------------------------------------------
alter table public.mission_seances
    add column if not exists libelle text null;

comment on column public.mission_seances.libelle is
    'Intitulé optionnel de la séance (ex. "Suivi Chpt Seniors J1 - Ext"). '
    'Prime sur l''affichage générique côté front ; alimentera à terme le '
    'SUMMARY du flux .ics (chantier distinct). sql_145, pt 141.';

-- ----------------------------------------------------------------------------
-- 2) DROP des signatures 11 params (signatures exactes — sonde S1 02/07/2026)
--    + DROP défensif des signatures 12 params (idempotence du rejeu)
-- ----------------------------------------------------------------------------
drop function if exists public.creer_seance_ponctuelle(
    uuid, date, time without time zone, integer, uuid, text,
    boolean, numeric, text, text, text);

drop function if exists public.creer_seance_ponctuelle(
    uuid, date, time without time zone, integer, uuid, text,
    boolean, numeric, text, text, text, text);

drop function if exists public.upsert_mission_seance(
    uuid, uuid, date, time without time zone, integer, uuid,
    text, boolean, text, numeric, text);

drop function if exists public.upsert_mission_seance(
    uuid, uuid, date, time without time zone, integer, uuid,
    text, boolean, text, numeric, text, text);

-- ----------------------------------------------------------------------------
-- 3) creer_seance_ponctuelle — 12 params (+ p_libelle en dernière position)
-- ----------------------------------------------------------------------------
create function public.creer_seance_ponctuelle(
    p_mission_id uuid,
    p_date_seance date,
    p_heure_debut time without time zone default null,
    p_duree_min integer default null,
    p_lieu_id uuid default null,
    p_lieu_libre text default null,
    p_refacturable boolean default null,
    p_heures_reelles numeric default null,
    p_notes text default null,
    p_etat text default 'realisee',
    p_gcal_uid text default null,
    p_libelle text default null
)
returns public.mission_seances
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row     public.mission_seances;
  v_me      uuid;
  v_salarie uuid;
  v_admin   boolean;
  v_etat    text;
begin
  -- 1) La mission doit exister ; on lit son salarie.
  select m.salarie_id into v_salarie
  from public.missions m
  where m.id = p_mission_id;
  if not found then
    raise exception 'Mission introuvable : %', p_mission_id;
  end if;
  -- 2) Identite + droits.
  v_me    := (select personne_id from public.qui_suis_je());
  v_admin := public._gs_peut_ecrire();   -- admin|bureau
  -- 3) Garde voie 3 : admin|bureau, OU le salarie DE CETTE mission.
  if not (v_admin or (v_me is not null and v_me = v_salarie)) then
    raise exception 'Creation reservee a l''administration ou au salarie de cette mission.';
  end if;
  -- 4) Etat : un NON-admin (salarie) ne peut creer qu'en 'realisee' (jamais
  --    'validee' : la validation reste admin). Un admin choisit parmi les etats
  --    de creation legaux ('prevue'|'realisee'). Aucune creation directe en
  --    'validee'/'annulee' (transitions dediees : valider_occurrence / annulation).
  if v_admin then
    v_etat := coalesce(p_etat, 'realisee');
    if v_etat not in ('prevue', 'realisee') then
      raise exception 'Etat de creation invalide : "%". Attendu prevue|realisee.', v_etat;
    end if;
  else
    v_etat := 'realisee';   -- salarie : force, on ignore p_etat
  end if;
  -- 5) INSERT brut (aucune sync compteur : le compteur ne bouge que sur validation).
  insert into public.mission_seances(
    mission_id, date_seance, heure_debut, duree_min, lieu_id, lieu_libre,
    refacturable, etat, heures_reelles, notes, gcal_uid, libelle)
  values(
    p_mission_id, p_date_seance, p_heure_debut, p_duree_min, p_lieu_id, p_lieu_libre,
    p_refacturable, v_etat, p_heures_reelles, p_notes, p_gcal_uid, p_libelle)
  returning * into v_row;
  return v_row;
end;
$function$;

revoke all on function public.creer_seance_ponctuelle(
    uuid, date, time without time zone, integer, uuid, text,
    boolean, numeric, text, text, text, text) from public, anon;

grant execute on function public.creer_seance_ponctuelle(
    uuid, date, time without time zone, integer, uuid, text,
    boolean, numeric, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) upsert_mission_seance — 12 params (+ p_libelle en dernière position)
-- ----------------------------------------------------------------------------
create function public.upsert_mission_seance(
    p_id uuid,
    p_mission_id uuid,
    p_date_seance date,
    p_heure_debut time without time zone default null,
    p_duree_min integer default null,
    p_lieu_id uuid default null,
    p_lieu_libre text default null,
    p_refacturable boolean default null,
    p_etat text default 'prevue',
    p_heures_reelles numeric default null,
    p_notes text default null,
    p_libelle text default null
)
returns public.mission_seances
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.mission_seances;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  if p_id is null then
    insert into public.mission_seances(
      mission_id, date_seance, heure_debut, duree_min, lieu_id, lieu_libre,
      refacturable, etat, heures_reelles, notes, libelle)
    values(
      p_mission_id, p_date_seance, p_heure_debut, p_duree_min, p_lieu_id, p_lieu_libre,
      p_refacturable, p_etat, p_heures_reelles, p_notes, p_libelle)
    returning * into v_row;
  else
    update public.mission_seances set
      date_seance = p_date_seance, heure_debut = p_heure_debut, duree_min = p_duree_min,
      lieu_id = p_lieu_id, lieu_libre = p_lieu_libre, refacturable = p_refacturable,
      etat = p_etat, heures_reelles = p_heures_reelles, notes = p_notes,
      libelle = p_libelle
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Séance introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$function$;

revoke all on function public.upsert_mission_seance(
    uuid, uuid, date, time without time zone, integer, uuid,
    text, boolean, text, numeric, text, text) from public, anon;

grant execute on function public.upsert_mission_seance(
    uuid, uuid, date, time without time zone, integer, uuid,
    text, boolean, text, numeric, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Vérification fail-loud
-- ----------------------------------------------------------------------------
do $verif$
declare
  v_col      integer;
  v_creer    integer;
  v_creer12  integer;
  v_upsert   integer;
  v_upsert12 integer;
begin
  -- 5.1 Colonne libelle présente.
  v_col := (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mission_seances'
      and column_name = 'libelle'
  );
  if v_col <> 1 then
    raise exception 'VERIF KO : colonne mission_seances.libelle absente.';
  end if;

  -- 5.2 creer_seance_ponctuelle : exactement 1 surcharge, à 12 arguments.
  v_creer := (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'creer_seance_ponctuelle'
  );
  v_creer12 := (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'creer_seance_ponctuelle'
      and p.pronargs = 12
  );
  if v_creer <> 1 or v_creer12 <> 1 then
    raise exception
      'VERIF KO : creer_seance_ponctuelle — % surcharge(s), % à 12 args (attendu 1/1).',
      v_creer, v_creer12;
  end if;

  -- 5.3 upsert_mission_seance : exactement 1 surcharge, à 12 arguments.
  v_upsert := (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_mission_seance'
  );
  v_upsert12 := (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_mission_seance'
      and p.pronargs = 12
  );
  if v_upsert <> 1 or v_upsert12 <> 1 then
    raise exception
      'VERIF KO : upsert_mission_seance — % surcharge(s), % à 12 args (attendu 1/1).',
      v_upsert, v_upsert12;
  end if;

  -- 5.4 Droits : anon ne doit PAS pouvoir exécuter, authenticated DOIT pouvoir.
  if has_function_privilege(
       'anon',
       'public.creer_seance_ponctuelle(uuid, date, time without time zone, integer, uuid, text, boolean, numeric, text, text, text, text)',
       'execute')
  then
    raise exception 'VERIF KO : anon peut exécuter creer_seance_ponctuelle.';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.creer_seance_ponctuelle(uuid, date, time without time zone, integer, uuid, text, boolean, numeric, text, text, text, text)',
       'execute')
  then
    raise exception 'VERIF KO : authenticated ne peut pas exécuter creer_seance_ponctuelle.';
  end if;
  if has_function_privilege(
       'anon',
       'public.upsert_mission_seance(uuid, uuid, date, time without time zone, integer, uuid, text, boolean, text, numeric, text, text)',
       'execute')
  then
    raise exception 'VERIF KO : anon peut exécuter upsert_mission_seance.';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.upsert_mission_seance(uuid, uuid, date, time without time zone, integer, uuid, text, boolean, text, numeric, text, text)',
       'execute')
  then
    raise exception 'VERIF KO : authenticated ne peut pas exécuter upsert_mission_seance.';
  end if;

  raise notice 'VERIF OK : colonne libelle + 2 RPC 12 params (surcharges propres) + droits conformes.';
end;
$verif$;
