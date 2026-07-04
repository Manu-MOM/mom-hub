-- ============================================================
-- sql_151_recurrence_date_debut.sql — MOM Hub
-- Chantier LOGISTIQUE-CYCLE-VIE-RESERVATIONS — volet 1 (A1)
-- FAIT FOI gelé le 04/07/2026, md5 b59b44d979e1192463873a55d5755c3e
-- ============================================================
-- Objet :
--   1. Colonne additive reservations_recurrentes.date_debut (date, NULL)
--      — NULL = pas de borne basse (rétro-compatibilité parfaite).
--   2. Backfill tracé des lignes existantes : date_debut = created_at::date
--      (au 04/07/2026 : les 2 règles Minibus créées le 04/07 → 2026-07-04 ;
--      éteint la projection passée constatée en recette pt 149).
-- Hors périmètre (tracé FAIT FOI §3) :
--   - Aucune RPC touchée : la création est un INSERT PostgREST direct
--     (createRecurrence transmet le payload tel quel, FAIT FOI §1.4).
--   - Aucune contrainte date_debut <= date_fin (les NULL historiques et la
--     borne haute seule restent légaux ; le formulaire guichet contrôle).
-- Sémantique consommée par le front (A2/A3, pour mémoire) :
--   biweekly : semaine 0 = semaine de date_debut, puis une semaine sur
--   deux ; repli parité vs 1er janvier si date_debut IS NULL. Aucune
--   occurrence avant date_debut, toutes fréquences (monthly : 1re
--   occurrence du mois >= date_debut).
-- ============================================================

alter table public.reservations_recurrentes
add column if not exists date_debut date;

comment on column public.reservations_recurrentes.date_debut is
'Borne basse de projection des occurrences (NULL = pas de borne). '
'Biweekly : semaine 0 = semaine de date_debut (repli parité vs 1er '
'janvier si NULL). Ajoutée par sql_151 (cycle de vie, 07/2026).';

-- Backfill tracé (A1) : les règles existantes démarrent à leur date de
-- création. Idempotent (WHERE date_debut IS NULL).
update public.reservations_recurrentes
set date_debut = created_at::date
where date_debut is null;

-- ============================================================
-- Vérification fail-loud
-- ============================================================
do $verif$
declare
    v_col integer;
    v_null integer;
    v_minibus integer;
begin
    v_col := (
        select count(*)
        from information_schema.columns
        where table_schema = 'public'
            and table_name = 'reservations_recurrentes'
            and column_name = 'date_debut'
            and data_type = 'date'
    );
    if v_col <> 1 then
        raise exception
            'sql_151 ECHEC : colonne date_debut absente ou de mauvais type (compte=%).',
            v_col;
    end if;

    v_null := (
        select count(*)
        from public.reservations_recurrentes
        where date_debut is null
    );
    if v_null <> 0 then
        raise exception
            'sql_151 ECHEC : % ligne(s) encore a date_debut NULL apres backfill.',
            v_null;
    end if;

    v_minibus := (
        select count(*)
        from public.reservations_recurrentes
        where id in (
            '65590269-66df-48be-875c-4763053d7d0b',
            '48f73a1d-5ce6-4846-a067-32075c9b8eed'
        )
        and date_debut = date '2026-07-04'
    );
    if v_minibus <> 2 then
        raise exception
            'sql_151 ECHEC : 2 regles Minibus attendues a 2026-07-04, trouvees %.',
            v_minibus;
    end if;

    raise notice
        'sql_151 OK : colonne date_debut en place, backfill complet (0 NULL), 2 regles Minibus a 2026-07-04.';
end
$verif$;
