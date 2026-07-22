-- pt 216 (chantier REVOKE-ANON-LECTURES-EFFECTIF) : verrouiller les 6 RPC de lecture
-- d'effectif/collectif, exposees a tort a anon/public (droit historique preexistant).
--
-- CONTEXTE : les RPC d'ecriture du Hub sont verrouillees (REVOKE public/anon + GRANT
--   authenticated), mais ces 6 lectures avaient garde le droit large par defaut. Micro-dette
--   ⚪ reconduite depuis le pt 209 (get_joueurs_categorie recreee en DROP+CREATE, defaut public).
--
-- PERIMETRE STRICT (sondes, pt 216) — on ne touche QUE ces 6 :
--   get_joueurs_categorie, get_joueurs_equipe, get_joueurs_f15, get_joueurs_section,
--   list_fonctions_staff, list_vivier_collectif.
--   Elles ne sont appelees que depuis des ecrans AUTHENTIFIES (joueurs-browser, staff,
--   evenements-browser, stats-saison, groupe-base) — verifie : aucune page de suivi anonyme
--   ne lit d'effectif.
--
-- HORS PERIMETRE (NON touche, volontairement) :
--   - Famille chronologie/suivi (action_chrono, get_chrono_rencontre, valider_lien_suivi,
--     generer_lien_ephemere, inserer_observable, get_compo_reduite_rencontre, ...) : accès
--     anon VOLONTAIRE pour les liens de suivi de match partageables (SUIVI-LIEN-COACH,
--     roles saisie/spectateur). Les couper casserait le partage de suivi.
--   - Fonctions trigger (*_touch_updated_at, trigger_set_updated_at, _trg_*, ...) : droit
--     public normal (non appelables en RPC directe).
--
-- Idempotent (REVOKE sur droit absent = sans effet). authenticated/service_role conserves.
-- Verifie en base : les 6 = {authenticated, postgres, service_role}, plus aucun anon/public.

revoke all on function public.get_joueurs_categorie(uuid) from anon, public;
revoke all on function public.get_joueurs_equipe(uuid) from anon, public;
revoke all on function public.get_joueurs_f15() from anon, public;
revoke all on function public.get_joueurs_section() from anon, public;
revoke all on function public.list_fonctions_staff(uuid, boolean) from anon, public;
revoke all on function public.list_vivier_collectif(uuid) from anon, public;

-- Verification fail-loud : aucune des 6 ne doit plus etre executable par anon/public.
do $verif$
declare
  v_fuite int;
begin
  select count(*) into v_fuite
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  join information_schema.routine_privileges r
    on r.routine_schema = 'public' and r.specific_name = p.proname || '_' || p.oid
  where n.nspname = 'public'
    and p.proname in ('get_joueurs_categorie','get_joueurs_equipe','get_joueurs_f15',
                      'get_joueurs_section','list_fonctions_staff','list_vivier_collectif')
    and r.grantee in ('anon','PUBLIC');
  if v_fuite > 0 then
    raise exception 'KO : % droit(s) anon/public subsistant(s) sur les lectures effectif.', v_fuite;
  end if;
  raise notice 'REVOKE-ANON-LECTURES-EFFECTIF OK : 6 RPC verrouillees (authenticated seul).';
end;
$verif$;
