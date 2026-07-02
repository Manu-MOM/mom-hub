-- ============================================================================
-- sql_143_list_seances_previsionnel_v2.sql
-- ----------------------------------------------------------------------------
-- OBJET
--   Chantier COMPTEURS-VENTILATION-TYPE (mini-FAIT FOI figé le 02/07/2026,
--   passation post-pt 136 §3.3) : ventilation par type_mission dans le
--   compteur prévisionnel. V2 de list_seances_previsionnel (sql_142) :
--   ajout de la colonne out_type_mission au RETURNS TABLE, corps sinon
--   IDENTIQUE (mêmes jointures, mêmes filtres, même tri).
--
--   L'agrégation par type se fait côté front (gestion-salarie.html,
--   gcPrevCalcule) — doctrine inchangée : la RPC ne fait QUE remonter les
--   séances comptables, aucune logique métier en double.
--
-- ⚠️ PIÈGE TRACÉ (passation §3.3) : ajouter une colonne au RETURNS TABLE
--   est un CHANGEMENT DE TYPE DE RETOUR → un simple CREATE OR REPLACE
--   échoue (ERROR 42P13 cannot change return type). Il faut DROP FUNCTION
--   puis recréer. Le DROP IF EXISTS rend le fichier idempotent.
--
-- COMPATIBILITÉ FRONT : le front (gcPrevCalcule) lit les colonnes par NOM
--   (out_date_seance / out_duree_min / out_etat) → la colonne additionnelle
--   ne casse pas le front pt 136 déployé. Ordre de déploiement : ce SQL
--   d'abord, puis la greffe front qui consomme out_type_mission.
--
-- SONDES / FAITS D'ENTRÉE (02/07/2026, la base fait foi — acquis pt 136,
--   non re-sondés conformément à la passation §2)
--   - missions.type_mission text NOT NULL, CHECK = 10 valeurs canoniques
--     (sql_114, sondé P1bis le 02/07).
--   - Chemin de jointure inchangé : contrats_salaries.personne_id
--     -> missions.salarie_id -> mission_seances.mission_id.
--   - Exclusion DOUBLE inchangée : séance annulée OU mission annulée.
--
-- PATRON : sql_142 reconduit à l'identique (LANGUAGE sql, SECURITY DEFINER,
--   search_path public, lecture seule, accès par GRANT authenticated seul,
--   REVOKE public + anon).
--
-- IDEMPOTENT : DROP IF EXISTS + CREATE + REVOKE/GRANT rejouables.
-- ============================================================================

drop function if exists public.list_seances_previsionnel(uuid, date, date);

create function public.list_seances_previsionnel(
    p_contrat_id uuid,
    p_from date,
    p_to date
)
returns table (
    out_date_seance date,
    out_duree_min integer,
    out_etat text,
    out_type_mission text
)
language sql
security definer
set search_path to 'public'
as $function$
    select
        ms.date_seance,
        ms.duree_min,
        ms.etat,
        m.type_mission
    from public.mission_seances as ms
    inner join public.missions as m
        on m.id = ms.mission_id
    inner join public.contrats_salaries as c
        on c.personne_id = m.salarie_id
    where
        c.id = p_contrat_id
        and ms.date_seance >= p_from
        and ms.date_seance <= p_to
        and ms.etat <> 'annulee'
        and m.etat <> 'annulee'
    order by ms.date_seance;
$function$;

revoke all on function public.list_seances_previsionnel(uuid, date, date)
    from public;
revoke all on function public.list_seances_previsionnel(uuid, date, date)
    from anon;
grant execute on function public.list_seances_previsionnel(uuid, date, date)
    to authenticated;

-- ============================================================================
-- VÉRIFICATION FAIL-LOUD (patron maison : do $verif$, v := (select ...),
-- pas de BEGIN/COMMIT explicite — contrainte SQL Editor Supabase)
-- ============================================================================

do $verif$
declare
    v_args text;
    v_nb integer;
    v_has_type boolean;
    v_anon boolean;
    v_auth boolean;
begin
    -- 0) La fonction existe en UN SEUL exemplaire (pas de surcharge résiduelle)
    v_nb := (
        select count(*)
        from pg_proc as p
        inner join pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'list_seances_previsionnel'
    );
    if v_nb <> 1 then
        raise exception
            'VERIF KO : % exemplaire(s) de list_seances_previsionnel (attendu : 1)',
            v_nb;
    end if;

    -- 1) Signature d'entrée exacte inchangée (compat front pt 136)
    v_args := (
        select pg_get_function_identity_arguments(p.oid)
        from pg_proc as p
        inner join pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'list_seances_previsionnel'
    );
    if v_args <> 'p_contrat_id uuid, p_from date, p_to date' then
        raise exception
            'VERIF KO : signature inattendue -> %', v_args;
    end if;

    -- 2) La colonne de retour out_type_mission est présente (objet de la v2)
    v_has_type := (
        select 'out_type_mission' = any(p.proargnames)
        from pg_proc as p
        inner join pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'list_seances_previsionnel'
    );
    if not v_has_type then
        raise exception
            'VERIF KO : out_type_mission absente du RETURNS TABLE';
    end if;

    -- 3) anon NE PEUT PAS exécuter
    v_anon := (
        select has_function_privilege(
            'anon',
            'public.list_seances_previsionnel(uuid, date, date)',
            'execute'
        )
    );
    if v_anon then
        raise exception 'VERIF KO : anon a le droit EXECUTE (attendu : non)';
    end if;

    -- 4) authenticated PEUT exécuter
    v_auth := (
        select has_function_privilege(
            'authenticated',
            'public.list_seances_previsionnel(uuid, date, date)',
            'execute'
        )
    );
    if not v_auth then
        raise exception
            'VERIF KO : authenticated sans droit EXECUTE (attendu : oui)';
    end if;

    raise notice 'VERIF OK : list_seances_previsionnel v2 (out_type_mission), signature inchangée, REVOKE public+anon, GRANT authenticated';
end
$verif$;
