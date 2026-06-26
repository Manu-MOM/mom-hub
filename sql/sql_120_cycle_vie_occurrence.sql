-- sql_120 — cycle de vie de l'occurrence : declarer / valider / devalider
-- Chantier MISSION-TO-COUNTER-FRONT-VIGNETTES (conception pt 113 → production).
-- 3 RPC de transition d'état sur mission_seances, voie 3 RGPD pour la déclaration.
-- Réutilise : _gs_peut_ecrire() (admin|bureau, sondé PD1b), qui_suis_je() (personne_id).
-- ⚠️ sync_releve_depuis_occurrence (sql_116c) n'est PAS appelée ici : à confirmer
--    par sonde SYNC si un trigger sur mission_seances la déclenche. Si AUCUN trigger,
--    ajouter l'appel sync_releve_depuis_occurrence(p_id) dans valider/devalider AVANT
--    exécution (sinon l'état change mais le compteur ne bouge pas).

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. declarer_occurrence : prevue|realisee → realisee + heures_reelles
--    Garde ÉLARGIE (voie 3 RGPD) : admin|bureau OU salarié de la mission.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.declarer_occurrence(
  p_id uuid,
  p_heures_reelles numeric default null
)
returns public.mission_seances
language plpgsql
security definer
set search_path to 'public'
as $declarer_occurrence$
declare
  v_row     public.mission_seances;
  v_me      uuid;
  v_salarie uuid;
  v_etat    text;
begin
  select ms.etat, m.salarie_id
    into v_etat, v_salarie
  from public.mission_seances ms
  join public.missions m on m.id = ms.mission_id
  where ms.id = p_id;

  if not found then
    raise exception 'Occurrence introuvable : %', p_id;
  end if;

  v_me := (select personne_id from public.qui_suis_je());

  if not (public._gs_peut_ecrire() or (v_me is not null and v_me = v_salarie)) then
    raise exception 'Déclaration réservée à l''administration ou au salarié concerné.';
  end if;

  if v_etat not in ('prevue', 'realisee') then
    raise exception 'Déclaration impossible : occurrence à l''état "%", non modifiable (dévalider d''abord).', v_etat;
  end if;

  update public.mission_seances set
    etat = 'realisee',
    heures_reelles = p_heures_reelles
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$declarer_occurrence$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. valider_occurrence : realisee → validee  (admin|bureau SEUL)
--    L'état validee alimente le compteur via sync_releve_depuis_occurrence.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.valider_occurrence(p_id uuid)
returns public.mission_seances
language plpgsql
security definer
set search_path to 'public'
as $valider_occurrence$
declare
  v_row  public.mission_seances;
  v_etat text;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Validation réservée à l''administration (admin ou bureau).';
  end if;

  select etat into v_etat from public.mission_seances where id = p_id;
  if not found then
    raise exception 'Occurrence introuvable : %', p_id;
  end if;

  if v_etat <> 'realisee' then
    raise exception 'Validation impossible : occurrence à l''état "%", attendu "realisee".', v_etat;
  end if;

  update public.mission_seances set etat = 'validee'
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$valider_occurrence$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. devalider_occurrence : validee → realisee  (admin|bureau SEUL)
--    Retire l'occurrence du compteur (sync DELETE sur tout état ≠ validee).
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.devalider_occurrence(p_id uuid)
returns public.mission_seances
language plpgsql
security definer
set search_path to 'public'
as $devalider_occurrence$
declare
  v_row  public.mission_seances;
  v_etat text;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Dévalidation réservée à l''administration (admin ou bureau).';
  end if;

  select etat into v_etat from public.mission_seances where id = p_id;
  if not found then
    raise exception 'Occurrence introuvable : %', p_id;
  end if;

  if v_etat <> 'validee' then
    raise exception 'Dévalidation impossible : occurrence à l''état "%", attendu "validee".', v_etat;
  end if;

  update public.mission_seances set etat = 'realisee'
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$devalider_occurrence$;

-- ───────────────────────────────────────────────────────────────────────────
-- Privilèges : fermer anon, ouvrir authenticated (leçon DS-1 pt 109/110).
-- REVOKE FROM PUBLIC seul est insuffisant → REVOKE FROM anon explicite.
-- ───────────────────────────────────────────────────────────────────────────
revoke execute on function public.declarer_occurrence(uuid, numeric) from public, anon;
revoke execute on function public.valider_occurrence(uuid)            from public, anon;
revoke execute on function public.devalider_occurrence(uuid)          from public, anon;
grant execute on function public.declarer_occurrence(uuid, numeric) to authenticated;
grant execute on function public.valider_occurrence(uuid)            to authenticated;
grant execute on function public.devalider_occurrence(uuid)          to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Fail-loud : refuse de committer si une RPC manque, si une dépendance saute,
-- ou si anon conserve EXECUTE.
-- ───────────────────────────────────────────────────────────────────────────
do $verif$
begin
  if to_regprocedure('public.declarer_occurrence(uuid, numeric)') is null then
    raise exception 'VERIF: declarer_occurrence(uuid, numeric) absente';
  end if;
  if to_regprocedure('public.valider_occurrence(uuid)') is null then
    raise exception 'VERIF: valider_occurrence(uuid) absente';
  end if;
  if to_regprocedure('public.devalider_occurrence(uuid)') is null then
    raise exception 'VERIF: devalider_occurrence(uuid) absente';
  end if;
  if to_regprocedure('public._gs_peut_ecrire()') is null then
    raise exception 'VERIF: dépendance _gs_peut_ecrire() absente';
  end if;
  if to_regprocedure('public.qui_suis_je()') is null then
    raise exception 'VERIF: dépendance qui_suis_je() absente';
  end if;
  if has_function_privilege('anon', 'public.declarer_occurrence(uuid, numeric)', 'execute') then
    raise exception 'VERIF: anon peut EXECUTE declarer_occurrence (REVOKE manquant)';
  end if;
  if has_function_privilege('anon', 'public.valider_occurrence(uuid)', 'execute') then
    raise exception 'VERIF: anon peut EXECUTE valider_occurrence (REVOKE manquant)';
  end if;
  if has_function_privilege('anon', 'public.devalider_occurrence(uuid)', 'execute') then
    raise exception 'VERIF: anon peut EXECUTE devalider_occurrence (REVOKE manquant)';
  end if;
end;
$verif$;

commit;
