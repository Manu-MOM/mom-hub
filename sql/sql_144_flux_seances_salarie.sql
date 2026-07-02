-- ============================================================================
-- sql_144_flux_seances_salarie.sql
-- SYNC-AGENDA-SORTANTE — RPC de lecture du flux .ics publié (T1).
-- Conforme au FAIT FOI « Conception-Sync-Agenda-Sortante-v1.md » (figé le
-- 02/07/2026, gate amont pt 137). Plateforme licences FFR : OVAL-E (avec A).
--
-- RÔLE : unique voie de lecture du générateur GitHub Actions (workflow dédié).
-- Projection MINIMALE (FAIT FOI §5) : le fichier publié est public par nature
-- (repo public, §2/§6 du FAIT FOI) — cette RPC ne retourne donc RIEN au-delà
-- de ce que le fichier expose. Champs volontairement ABSENTS : notes de
-- séance, heures_reelles, refacturable, montants, entité bénéficiaire, tout
-- nom de tiers.
--
-- DÉCISIONS APPLIQUÉES :
--   D5  : toutes les séances SAUF annulées ('prevue','realisee','validee').
--   D6  : séances importées de Google (gcal_uid non NULL) INCLUSES —
--         le flux est la projection complète de la vérité Hub.
--   D7  : fenêtre glissante current_date - 30 .. current_date + 365.
--   D10 : garde périmètre — p_salarie_id doit être un salarié SOUS CONTRAT
--         (contrats_salaries), sinon zéro ligne. Limite la surface anon aux
--         seuls salariés réels du club.
--   T1 (tranché ici, délégué par le FAIT FOI) : GRANT à anon ET authenticated.
--         Justification tracée : la surface exposée à anon = exactement la
--         surface du fichier public généré ; aucune donnée nouvelle n'est
--         atteignable par ce GRANT.
--
-- HÉRITAGE LIEU (invariant socle sql_78 : « valeur séance prime, sinon
-- mission ») : lieu résolu = séance.lieu_libre, sinon site de la séance,
-- sinon mission.lieu_libre, sinon site de la mission.
--
-- SONDES DS-1 (base, 02/07/2026, exécutées par Manu) : sites.libelle confirmé
-- (S1) ; mission_seances = 14 colonnes dont gcal_uid (S2) ; CHECK etat à
-- 4 valeurs (S3) ; contrats_salaries = Lohann seul (S4) ; nom de fonction
-- libre (S5) ; missions.libelle/salarie_id/lieu_id/lieu_libre confirmés (S6).
--
-- Discipline : pas de BEGIN/COMMIT (SQL Editor) ; do $verif$ fail-loud avec
-- EXÉCUTION réelle de la fonction (la validation par CREATE seul ne prouve
-- pas le plan) ; motif v := (select …).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) RPC de lecture — STABLE, SECURITY DEFINER (RLS fermée sur les tables).
--    Nom neuf (sonde S5 : zéro collision), donc CREATE simple, aucune
--    surcharge résiduelle possible.
-- ----------------------------------------------------------------------------
create or replace function public.flux_seances_salarie(p_salarie_id uuid)
returns table (
  out_seance_id       uuid,
  out_date_seance     date,
  out_heure_debut     time without time zone,
  out_duree_min       integer,
  out_etat            text,
  out_mission_libelle text,
  out_lieu            text,
  out_updated_at      timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    s.id                                       as out_seance_id,
    s.date_seance                              as out_date_seance,
    s.heure_debut                              as out_heure_debut,
    s.duree_min                                as out_duree_min,
    s.etat                                     as out_etat,
    m.libelle                                  as out_mission_libelle,
    coalesce(
      nullif(btrim(s.lieu_libre), ''),
      site_s.libelle,
      nullif(btrim(m.lieu_libre), ''),
      site_m.libelle
    )                                          as out_lieu,
    s.updated_at                               as out_updated_at
  from public.mission_seances s
  join public.missions m
    on m.id = s.mission_id
  left join public.sites site_s
    on site_s.id = s.lieu_id
  left join public.sites site_m
    on site_m.id = m.lieu_id
  where m.salarie_id = p_salarie_id
    -- D10 : périmètre limité aux salariés sous contrat.
    and exists (
      select 1 from public.contrats_salaries cs
      where cs.personne_id = p_salarie_id
    )
    -- D5 : tout sauf annulées.
    and s.etat in ('prevue', 'realisee', 'validee')
    -- D7 : fenêtre glissante.
    and s.date_seance between (current_date - 30) and (current_date + 365)
  order by s.date_seance, s.heure_debut nulls last, s.id
$$;

comment on function public.flux_seances_salarie(uuid) is
  'SYNC-AGENDA-SORTANTE (FAIT FOI 02/07/2026) : projection minimale des '
  'séances d''un salarié sous contrat pour le flux .ics publié (GitHub '
  'Actions). Fenêtre J-30/J+365, états prevue|realisee|validee, lieu résolu '
  'par héritage séance→mission. GRANT anon assumé : surface = fichier public.';

-- ----------------------------------------------------------------------------
-- 2) Permissions — SECURITY DEFINER : on ferme tout, puis on rouvre
--    explicitement anon (générateur Actions, clé anon du keep-alive) et
--    authenticated (usage Hub éventuel).
-- ----------------------------------------------------------------------------
revoke all on function public.flux_seances_salarie(uuid) from public;
grant execute on function public.flux_seances_salarie(uuid) to anon;
grant execute on function public.flux_seances_salarie(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Vérification fail-loud (exécution réelle incluse).
--    NB sans transaction (SQL Editor) : en cas d'échec, la fonction créée en
--    (1) reste en place — l'exception signale et le correctif suit.
-- ----------------------------------------------------------------------------
do $verif$
declare
  v_nfn    integer;
  v_anon   boolean;
  v_auth   boolean;
  v_rows   integer;
  v_futur  integer;
begin
  -- 3a) Exactement une fonction de ce nom, à 1 argument.
  v_nfn := (select count(*)
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = 'flux_seances_salarie'
              and p.pronargs = 1);
  if v_nfn <> 1 then
    raise exception 'VERIF KO : % fonction(s) flux_seances_salarie à 1 arg (attendu 1).', v_nfn;
  end if;

  -- 3b) Droits effectifs : anon OUI, authenticated OUI.
  v_anon := (select has_function_privilege('anon',
              'public.flux_seances_salarie(uuid)', 'execute'));
  v_auth := (select has_function_privilege('authenticated',
              'public.flux_seances_salarie(uuid)', 'execute'));
  if not v_anon or not v_auth then
    raise exception 'VERIF KO : privilèges execute anon=% authenticated=% (attendu true/true).', v_anon, v_auth;
  end if;

  -- 3c) EXÉCUTION réelle sur Lohann (S4) : prouve le plan (jointures, alias),
  --     pas seulement le CREATE. Le nombre de lignes dépend des données :
  --     on ne l'asserte pas, on le TRACE.
  v_rows := (select count(*)
             from public.flux_seances_salarie(
               '589e7977-748c-42db-b29c-0505ec0d2e41'::uuid));

  -- 3d) EXÉCUTION sur un UUID hors contrat : la garde D10 doit rendre 0 ligne.
  v_futur := (select count(*)
              from public.flux_seances_salarie(
                '00000000-0000-0000-0000-000000000000'::uuid));
  if v_futur <> 0 then
    raise exception 'VERIF KO : garde D10 inopérante (% ligne(s) pour un UUID hors contrat).', v_futur;
  end if;

  raise notice 'VERIF OK : RPC unique, grants anon+authenticated, garde D10 étanche. Séances Lohann dans la fenêtre : %.', v_rows;
end;
$verif$;
