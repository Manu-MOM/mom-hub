-- ============================================================================
-- sql_134_gcal_uid.sql  (v2 corrigee)
-- Colonne-pont Agenda Google -> seances (B-light, sens unique entrant).
-- Conforme au FAIT FOI "Agenda Google -> seances" (29/06/2026), gate amont pt 133.
-- Plateforme licences FFR : OVAL-E (avec A).
--
-- Corrections vs v1 :
--   - DROP explicite de l'ancienne signature 10 args AVANT le CREATE :
--     l'ajout de p_gcal_uid change l'arite, donc CREATE OR REPLACE ne remplace
--     PAS (il surcharge). Sans DROP, deux fonctions cohabiteraient (dette).
--   - do $verif$ robuste a N lignes : count(*) agrege (jamais de sous-requete
--     scalaire qui plante des qu'il y a >1 ligne).
--
-- Contenu (additif, retrocompatible cote appelants) :
--   1) mission_seances.gcal_uid text nullable  (colonne-pont, stocke l'UID iCal)
--   2) index unique partiel WHERE gcal_uid IS NOT NULL  (anti-doublon dur)
--   3) DROP 10 args + CREATE 11 args (p_gcal_uid text DEFAULT NULL en dernier).
--
-- Invariants preserves : garde voie 3, forcage 'realisee' non-admin,
-- INSERT pur (aucune sync compteur), SECURITY DEFINER + REVOKE anon/public.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Colonne-pont : additive, nullable. Les seances natives du Hub restent NULL.
-- ----------------------------------------------------------------------------
alter table public.mission_seances
  add column if not exists gcal_uid text;

comment on column public.mission_seances.gcal_uid is
  'UID iCal de l''evenement Google Agenda source (import B-light entrant). '
  'NULL pour les seances saisies nativement dans le Hub. '
  'Cle d''appariement anti-doublon (cf. index ux_mission_seances_gcal_uid).';

-- ----------------------------------------------------------------------------
-- 2) Index unique PARTIEL : l'unicite ne porte que sur les lignes importees.
--    Le WHERE est OBLIGATOIRE : sans lui, les multiples lignes gcal_uid=NULL
--    (toutes les seances natives) entreraient en collision d'unicite.
-- ----------------------------------------------------------------------------
create unique index if not exists ux_mission_seances_gcal_uid
  on public.mission_seances (gcal_uid)
  where gcal_uid is not null;

-- ----------------------------------------------------------------------------
-- 3a) DROP de l'ancienne signature 10 args (sans p_gcal_uid).
--     Signature listee explicitement -> ne touche QUE cette surcharge.
-- ----------------------------------------------------------------------------
drop function if exists public.creer_seance_ponctuelle(
  uuid, date, time without time zone, integer, uuid, text, boolean, numeric, text, text
);

-- ----------------------------------------------------------------------------
-- 3b) CREATE de la version 11 args (p_gcal_uid en derniere position, DEFAULT NULL).
--     Toute la logique de garde/forcage/etat est preservee a l'identique vs pt 133.
-- ----------------------------------------------------------------------------
create or replace function public.creer_seance_ponctuelle(
  p_mission_id     uuid,
  p_date_seance    date,
  p_heure_debut    time without time zone default null::time without time zone,
  p_duree_min      integer default null::integer,
  p_lieu_id        uuid default null::uuid,
  p_lieu_libre     text default null::text,
  p_refacturable   boolean default null::boolean,
  p_heures_reelles numeric default null::numeric,
  p_notes          text default null::text,
  p_etat           text default 'realisee'::text,
  p_gcal_uid       text default null::text
)
 returns mission_seances
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
    refacturable, etat, heures_reelles, notes, gcal_uid)
  values(
    p_mission_id, p_date_seance, p_heure_debut, p_duree_min, p_lieu_id, p_lieu_libre,
    p_refacturable, v_etat, p_heures_reelles, p_notes, p_gcal_uid)
  returning * into v_row;
  return v_row;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Permissions : SECURITY DEFINER -> on retire anon et public, on rouvre authenticated.
-- ----------------------------------------------------------------------------
revoke all on function public.creer_seance_ponctuelle(
  uuid, date, time without time zone, integer, uuid, text, boolean, numeric, text, text, text
) from anon, public;
grant execute on function public.creer_seance_ponctuelle(
  uuid, date, time without time zone, integer, uuid, text, boolean, numeric, text, text, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Verif fail-loud AVANT commit, ROBUSTE A N LIGNES (count(*) agrege uniquement).
--   - colonne gcal_uid presente (1)
--   - index partiel present (1)
--   - EXACTEMENT une seule creer_seance_ponctuelle, et elle a 11 args
--     (prouve que le DROP de la 10 args + CREATE 11 args a bien laisse 1 seule fonction)
-- Toute anomalie -> exception -> rollback.
-- ----------------------------------------------------------------------------
do $verif$
declare
  v_col       integer;
  v_idx       integer;
  v_nfuncs    integer;
  v_n11       integer;
begin
  v_col := (select count(*) from information_schema.columns
            where table_schema = 'public' and table_name = 'mission_seances'
              and column_name = 'gcal_uid');
  if v_col <> 1 then
    raise exception 'VERIF KO : colonne gcal_uid count=% (attendu 1).', v_col;
  end if;

  v_idx := (select count(*) from pg_indexes
            where schemaname = 'public' and tablename = 'mission_seances'
              and indexname = 'ux_mission_seances_gcal_uid');
  if v_idx <> 1 then
    raise exception 'VERIF KO : index ux_mission_seances_gcal_uid count=% (attendu 1).', v_idx;
  end if;

  -- Nombre TOTAL de fonctions de ce nom (doit etre exactement 1 : la 10 args a ete droppee).
  v_nfuncs := (select count(*) from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'creer_seance_ponctuelle');
  if v_nfuncs <> 1 then
    raise exception 'VERIF KO : % fonctions creer_seance_ponctuelle (attendu 1, pas de surcharge residuelle).', v_nfuncs;
  end if;

  -- Et cette unique fonction a bien 11 args.
  v_n11 := (select count(*) from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'creer_seance_ponctuelle'
              and p.pronargs = 11);
  if v_n11 <> 1 then
    raise exception 'VERIF KO : la fonction restante n''a pas 11 args (count 11-args=%).', v_n11;
  end if;

  raise notice 'VERIF OK : gcal_uid + index + 1 seule RPC a 11 args. Commit autorise.';
end;
$verif$;

commit;
