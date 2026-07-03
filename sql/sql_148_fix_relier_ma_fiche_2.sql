-- ============================================================================
-- sql_148 — ENROLEMENT-REPARATION (acte 2) : fix relier_ma_fiche (42702, bis)
-- Chantier PORTAIL-MULTI-PERIMETRE (préalable P0), 03/07/2026.
--
-- BUG PROUVÉ (recette réelle console admin du 03/07/2026 + reproduction
-- locale PostgreSQL 16.14, corps déployé à l'identique — sonde S4) :
-- l'ambiguïté 42702 ne se limitait PAS au DELETE corrigé par sql_146.
-- Les variables de sortie du RETURNS TABLE(user_id, personne_id) entrent
-- AUSSI en collision dans les DEUX clauses ON CONFLICT :
--   - « on conflict (user_id) do update ... »    (INSERT auth_personne)
--   - « on conflict (user_id, role) do nothing » (INSERT auth_roles)
-- plpgsql prépare ses ordres PARESSEUSEMENT, dans l'ordre d'exécution :
-- la fonction meurt dès l'ordre 1 (« column reference "user_id" is
-- ambiguous ») et n'atteint jamais le DELETE réparé par sql_146 — d'où
-- l'échec persistant. Le do $verif$ de sql_146, statique, ne pouvait pas
-- le détecter : auth.uid() est NULL dans le SQL Editor, la fonction n'y
-- est pas exécutable de bout en bout.
--
-- CORRECTIF : pragma « #variable_conflict use_column » en tête de corps —
-- en cas de collision nom de variable / nom de colonne, la COLONNE gagne.
-- Sans danger ici, preuve locale (PG 16.14) sur le parcours complet :
-- liaison, idempotence (2e appel = chemin DO UPDATE), matérialisation
-- d'un rôle en attente + purge. Toutes les autres références du corps
-- sont qualifiées (ap., rea., p.) ou portent des noms sans homonyme de
-- colonne (v_uid, p_personne_id).
--
-- ÉCARTÉS : renommer les colonnes de sortie (changement de signature →
-- DROP + CREATE + rupture du wrapper front relierMaFiche(), qui lit
-- row.personne_id dans la réponse) ; « on conflict on constraint »
-- (dépend des noms réels de contraintes, plus fragile).
--
-- ATTRIBUTS RE-DÉCLARÉS À L'IDENTIQUE (sonde S4 du 03/07 : prosecdef=true,
-- provolatile=v, proconfig=search_path=public). Signature INCHANGÉE →
-- CREATE OR REPLACE licite, ACL préservées (EXECUTE authenticated
-- conservé, aucun GRANT à rejouer). Corps par ailleurs STRICTEMENT
-- identique au déployé (prosrc S4), alias « rea » de sql_146 conservé.
--
-- RECETTE POST-EXÉCUTION (seule preuve d'exécution de bout en bout) :
-- console navigateur, session authentifiée :
--   await SupabaseHub.relierMaFiche('<personne_id>')   → {ok: true, …}
-- ============================================================================

create or replace function public.relier_ma_fiche(p_personne_id uuid)
returns table(user_id uuid, personne_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Aucun compte authentifié (auth.uid() est NULL).';
  end if;
  if not exists (select 1 from public.personnes p where p.id = p_personne_id) then
    raise exception 'Fiche personne introuvable : %', p_personne_id;
  end if;
  insert into public.auth_personne (user_id, personne_id)
  values (v_uid, p_personne_id)
  on conflict (user_id) do update set personne_id = excluded.personne_id;
  -- [sql/72] Matérialisation des rôles pré-attribués à cette personne.
  -- Idempotent (ON CONFLICT) : si le rôle existe déjà, no-op. created_by repris de l'attente.
  insert into public.auth_roles (user_id, role, created_by)
  select v_uid, rea.role, rea.created_by
  from public.roles_en_attente rea
  where rea.personne_id = p_personne_id
  on conflict (user_id, role) do nothing;
  -- [sql/72] Purge de l'attente pour cette personne (matérialisée ou déjà présente).
  -- [sql_146] Alias « rea » ajouté : « personne_id » nu était ambigu (42702)
  -- avec la variable de sortie homonyme — cause de l'échec systématique de
  -- la liaison depuis sql/72 (preuve : sonde _test_ambiguite du 03/07/2026).
  delete from public.roles_en_attente rea
  where rea.personne_id = p_personne_id;
  return query
    select ap.user_id, ap.personne_id
    from public.auth_personne ap
    where ap.user_id = v_uid;
end;
$$;

-- ============================================================================
-- Vérification fail-loud : le correctif est bien en place.
-- (Statique par nature — la preuve d'exécution reste le geste console.)
-- ============================================================================
do $verif$
declare
  v_src text;
  v_secdef boolean;
  v_nb integer;
begin
  v_nb := (select count(*) from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'relier_ma_fiche');
  if v_nb <> 1 then
    raise exception 'sql_148 VERIF: % surcharge(s) de relier_ma_fiche (attendu : 1).', v_nb;
  end if;
  v_src := (select prosrc from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'relier_ma_fiche');
  if position('#variable_conflict use_column' in v_src) = 0 then
    raise exception 'sql_148 VERIF: le pragma variable_conflict est absent.';
  end if;
  if position('delete from public.roles_en_attente rea' in v_src) = 0 then
    raise exception 'sql_148 VERIF: le correctif sql_146 (alias rea) a été perdu.';
  end if;
  v_secdef := (select prosecdef from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'relier_ma_fiche');
  if not v_secdef then
    raise exception 'sql_148 VERIF: SECURITY DEFINER perdu.';
  end if;
  raise notice 'sql_148 OK : pragma use_column en place, correctif sql_146 conservé, SECURITY DEFINER conservé, 1 seule surcharge.';
end
$verif$;
