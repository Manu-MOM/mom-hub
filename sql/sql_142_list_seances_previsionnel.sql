-- ============================================================================
-- sql_142_list_seances_previsionnel.sql
-- ----------------------------------------------------------------------------
-- OBJET
--   Compteur d'heures prévisionnel du module salarié (FAIT FOI :
--   FAIT-FOI-compteur-previsionnel-2026-07-02.md, md5 4f6c2662, figé par
--   Manu le 02/07/2026). Fournit au front (gestion-salarie.html) la matière
--   première du prévisionnel : les séances de mission (date, durée prévue,
--   état) du salarié d'un contrat donné sur une période donnée.
--
--   L'agrégation hebdo / mensuelle / annuelle se fait côté front (FAIT FOI
--   §6 : pas de logique métier en double). La RPC ne fait QUE remonter les
--   séances comptables : séances non annulées de missions non annulées.
--
-- PATRON : list_compteur_annualisation (LANGUAGE sql, SECURITY DEFINER,
--   search_path public, lecture seule, pas de garde interne — accès par
--   GRANT authenticated seul, REVOKE public + anon).
--
-- SONDES D'ENTRÉE (02/07/2026, la base fait foi)
--   S1    : mission_seances = 14 colonnes ; date_seance date NOT NULL,
--           duree_min integer NULLABLE, etat text NOT NULL,
--           heures_reelles numeric NULLABLE.
--   S2bis : CHECK mission_seances.etat IN
--           ('prevue','realisee','validee','annulee').
--   P1    : missions.salarie_id uuid NOT NULL ; missions.etat text NOT NULL.
--   P1bis : CHECK missions.etat IN ('prevue','terminee','annulee').
--   P2    : contrats_salaries(id, personne_id, ...) — chemin de jointure :
--           contrats_salaries.personne_id -> missions.salarie_id
--           -> mission_seances.mission_id.
--   S5    : periodes_annualisation porte période/cible/seuils (2026-08-01 ->
--           2027-07-31, 1582 h, 44/48/0) — lus par le front, pas ici.
--
-- DÉCISIONS TRACÉES (FAIT FOI §3.1 + addendum production 02/07/2026)
--   - Exclusion DOUBLE : séance annulée OU mission annulée -> hors compteur.
--     Les missions 'terminee' gardent leurs séances comptées.
--   - duree_min NULLABLE : remonté tel quel (NULL), le front compte 0 et
--     affiche l'avertissement fail-loud « N séance(s) sans durée prévue ».
--   - Signature p_contrat_id (cohérence list_compteur_annualisation) +
--     p_from / p_to : la période active est résolue par le front depuis
--     periodes_annualisation (une seule vérité, déjà chargée pour la cible).
--
-- IDEMPOTENT : CREATE OR REPLACE + REVOKE/GRANT rejouables à l'identique.
-- ============================================================================

create or replace function public.list_seances_previsionnel(
    p_contrat_id uuid,
    p_from date,
    p_to date
)
returns table (
    out_date_seance date,
    out_duree_min integer,
    out_etat text
)
language sql
security definer
set search_path to 'public'
as $function$
    select
        ms.date_seance,
        ms.duree_min,
        ms.etat
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
    v_anon boolean;
    v_auth boolean;
begin
    -- 1) La fonction existe avec la signature exacte attendue
    v_args := (
        select pg_get_function_identity_arguments(p.oid)
        from pg_proc as p
        inner join pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'list_seances_previsionnel'
    );
    if v_args is null then
        raise exception 'VERIF KO : list_seances_previsionnel absente';
    end if;
    if v_args <> 'p_contrat_id uuid, p_from date, p_to date' then
        raise exception
            'VERIF KO : signature inattendue -> %', v_args;
    end if;

    -- 2) anon NE PEUT PAS exécuter
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

    -- 3) authenticated PEUT exécuter
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

    raise notice 'VERIF OK : list_seances_previsionnel(uuid, date, date), REVOKE public+anon, GRANT authenticated';
end
$verif$;
