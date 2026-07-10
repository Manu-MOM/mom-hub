-- =====================================================================
-- sql_193_resserrage_rpc_anon.sql
-- Chantier ACCES-ANONYME-EQUIPE (volet A) — pt 193
-- =====================================================================
-- OBJET : refermer l'accas anonyme (role `anon`) a une famille de RPC
--         SECURITY DEFINER laissees executables par `anon` (grant explicite
--         et/ou herite de PUBLIC), dont plusieurs fuient des donnees reelles
--         a un visiteur non connecte :
--           get_vivier_compo (28 joueurs), list_missions (45), list_salaries,
--           list_contrats_salaries, get_evenements_passes (30),
--           get_seances_a_venir (7), list_entites (70), count_personnes_*, ...
--
-- GESTE : REVOKE EXECUTE FROM public, anon  +  GRANT EXECUTE TO authenticated
--         (barriare au grant, JAMAIS de garde de corps — corps inchanges).
--         REVOKE FROM public est INDISPENSABLE : certaines RPC heritent
--         EXECUTE via le pseudo-role PUBLIC (ex. get_evenements_passes,
--         get_seances_a_venir : proacl `=X/postgres`) -> un simple
--         REVOKE FROM anon ne suffit pas.
--
-- PERIMETRE : toutes les RPC executables par anon SAUF
--   (a) whitelist SUIVI EPHEMERE / token (doivent rester anon : suivi de
--       rencontre par lien sans compte) — 19 fonctions ;
--   (b) fonctions trigger (jamais appelees en RPC) — 9 fonctions, laissees
--       telles quelles (REVOKE sans objet).
--
-- METHODE : REVOKE dynamique pilote par l'inventaire du catalogue -> le
--   script est auto-coherent (signatures exactes depuis pg_proc), idempotent
--   (re-executable sans effet de bord), et ne peut pas revoquer une RPC de
--   la whitelist.
--
-- PROUVE en transaction annulee (BEGIN; ... ROLLBACK;) AVANT exec reelle :
--   anon -> vivier/evt/seances/missions/salaries = DENIED (42501) ;
--   authenticated -> conserve l'acces ; suivi-token -> intact.
--
-- INVARIANTS : ZERO modification de corps de fonction ; ZERO INTERDIT touche ;
--   sens du RESSERRAGE uniquement ; RGPD-lock personnes preserve.
-- =====================================================================

do $resserrage$
declare
  r record;
  v_n int := 0;
begin
  for r in
    with anon_execs as (
      select p.oid, p.proname,
             pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ),
    whitelist as (
      -- SUIVI EPHEMERE : reste accessible a anon (lien token, spectateur, coach)
      select proname from anon_execs
      where proname ~ 'token|_coach$|chrono|observable|rencontre|ephemere|lien'
         or proname in ('valider_lien_suivi','get_entete_rencontre','consolider_score_rencontre')
    ),
    triggers as (
      -- fonctions trigger : jamais appelees en RPC, laissees telles quelles
      select proname from anon_execs
      where proname ~ '(_touch$|_touch_updated_at$|^_trg_|^trigger_set_updated_at$|_multi_sync$|touch_updated_at$)'
    )
    select oid::regprocedure as sig
    from anon_execs
    where proname not in (select proname from whitelist)
      and proname not in (select proname from triggers)
  loop
    execute format('revoke execute on function %s from public',        r.sig);
    execute format('revoke execute on function %s from anon',          r.sig);
    execute format('grant  execute on function %s to authenticated',   r.sig);
    v_n := v_n + 1;
  end loop;

  raise notice 'sql_193 : resserrage applique sur % fonction(s)', v_n;
end
$resserrage$;

-- =====================================================================
-- VERIF FAIL-LOUD : plus aucune RPC hors whitelist/triggers n'est
-- executable par anon. Retour propre = verif passee.
-- =====================================================================
do $verif$
declare
  v_reste int;
  v_suivi_ok boolean;
begin
  select count(*) into v_reste
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname !~ 'token|_coach$|chrono|observable|rencontre|ephemere|lien'
    and p.proname not in ('valider_lien_suivi','get_entete_rencontre','consolider_score_rencontre')
    and p.proname !~ '(_touch$|_touch_updated_at$|^_trg_|^trigger_set_updated_at$|_multi_sync$|touch_updated_at$)';

  if v_reste <> 0 then
    raise exception 'sql_193 VERIF FAIL : % RPC hors whitelist encore executables par anon', v_reste;
  end if;

  -- le suivi ephemere doit rester joignable par anon (grant preserve)
  select has_function_privilege('anon','public.get_chrono_rencontre(text)','EXECUTE')
    into v_suivi_ok;
  if not v_suivi_ok then
    raise exception 'sql_193 VERIF FAIL : suivi-token get_chrono_rencontre revoque par erreur';
  end if;

  raise notice 'sql_193 VERIF OK : 0 fuite anon residuelle, suivi-token preserve';
end
$verif$;
