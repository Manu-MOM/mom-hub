-- ============================================================================
-- sql_150_agenda_seances_salarie.sql
-- Chantier SUIVI-AGENDA-TOUS-TYPES (Option C, FAIT FOI v1 §3 + ADDENDUM 1).
--
-- Autorité documentaire :
--   FAIT-FOI-SUIVI-AGENDA-TOUS-TYPES-v1.md  md5 5878313cb943135504391bf6c1070c52
--   ADDENDUM-1-FAIT-FOI-SUIVI-AGENDA-TOUS-TYPES.md  md5 57cfa661902e5bfc0b0ba501e4475477
--   (en cas de contradiction : l'ADDENDUM gagne sur le §3 de la garde d'accès.)
--
-- Sondes DS-1 d'ouverture (base = seule vérité ; sql_100-143 absents du dépôt) :
--   S1  pg_get_functiondef('list_mission_seances') -> SECURITY DEFINER NU, AUCUNE garde
--       d'identité. La consigne « copier le patron de garde de list_mission_seances »
--       (FAIT FOI §3) est CADUQUE (ADDENDUM 1 §0/§1). Garde COMPOSÉE ci-dessous.
--   S1b flux_seances_salarie(p_salarie_id) : analogue voie 3, également SANS garde
--       d'identité (GRANT anon, surface .ics publique). Patron d'héritage lieu + jointures
--       RECOPIÉ de cette fonction (coalesce séance.lieu_libre -> site séance ->
--       mission.lieu_libre -> site mission = sql_78/sql_144).
--   S2  primitives confirmées pour la garde (et elles seules, ADDENDUM 1 §1) :
--         public._gs_peut_ecrire()  = has_role('admin') or has_role('bureau')
--         public.suis_je_salarie()  = contrat salarié actif de l'appelant
--         public.qui_suis_je()      RETURNS TABLE(personne_id) = personne_id de auth.uid()
--   S3  count(*) proname='agenda_seances_salarie' = 0 (numéro/nom libre).
--   S4  colonnes réelles (jamais supposées) : mission_seances(id, mission_id, date_seance,
--       heure_debut time, duree_min int, lieu_id, lieu_libre, etat text NOT NULL,
--       updated_at timestamptz NOT NULL, libelle text) ; missions(id, libelle NOT NULL,
--       type_mission NOT NULL, salarie_id NOT NULL, lieu_id, lieu_libre) ; sites(id, libelle).
--
-- Décisions techniques mineures (tracées, frontière kit §1) :
--   - LANGUAGE plpgsql (et non sql) : la garde de bornes fail-loud exige RAISE. Le FAIT FOI
--     §3 l'autorise explicitement (« language sql si la garde le permet, sinon plpgsql, tracé »).
--   - Garde d'accès en clause WHERE (pas de RAISE) : hors périmètre -> ZÉRO ligne, indistinct
--     d'une fenêtre sans séance (ADDENDUM 1 §3, confirmé).
--   - Discipline sql_144 : pas de BEGIN/COMMIT ; do $verif$ fail-loud avec « v := (select …) ».
--
-- Limite de preuve ASSUMÉE (R1, dégradation honnête) : dans le SQL Editor auth.uid() est NULL
--   -> le do $verif$ ne prouve QUE unicité, grants, garde de bornes et CHEMIN NÉGATIF
--   (appelant NULL -> zéro ligne). Le chemin heureux authentifié (admin|bureau ET voie 3)
--   n'est prouvable qu'en recette navigateur.
-- ============================================================================

create or replace function public.agenda_seances_salarie(
  p_salarie_id uuid,
  p_date_debut date,
  p_date_fin   date
)
returns table (
  out_seance_id      uuid,
  out_mission_id     uuid,
  out_type_mission   text,
  out_date_seance    date,
  out_heure_debut    time,
  out_duree_min      integer,
  out_etat           text,
  out_libelle        text,
  out_mission_libelle text,
  out_lieu           text,
  out_updated_at     timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  -- Garde de bornes fail-loud (anti-scan non borné ; 400 j couvre l'année d'annualisation).
  if p_date_fin < p_date_debut then
    raise exception 'agenda_seances_salarie: intervalle invalide (date_fin % < date_debut %).',
      p_date_fin, p_date_debut;
  end if;
  if (p_date_fin - p_date_debut) > 400 then
    raise exception 'agenda_seances_salarie: intervalle trop large (% jours, max 400).',
      (p_date_fin - p_date_debut);
  end if;

  return query
    select
      s.id                                        as out_seance_id,
      m.id                                        as out_mission_id,
      m.type_mission                              as out_type_mission,
      s.date_seance                               as out_date_seance,
      s.heure_debut                               as out_heure_debut,
      s.duree_min                                 as out_duree_min,
      s.etat                                      as out_etat,
      s.libelle                                   as out_libelle,
      m.libelle                                   as out_mission_libelle,
      coalesce(
        nullif(btrim(s.lieu_libre), ''),
        site_s.libelle,
        nullif(btrim(m.lieu_libre), ''),
        site_m.libelle
      )                                           as out_lieu,
      s.updated_at                                as out_updated_at
    from public.mission_seances s
    join public.missions m
      on m.id = s.mission_id
    left join public.sites site_s
      on site_s.id = s.lieu_id
    left join public.sites site_m
      on site_m.id = m.lieu_id
    where m.salarie_id = p_salarie_id
      and s.date_seance between p_date_debut and p_date_fin
      -- AUCUN filtre d'état : les 4 états passent (Q5 filtre les annulées au front).
      -- Garde d'accès COMPOSÉE (ADDENDUM 1 §1) — le cœur. Hors périmètre -> zéro ligne.
      and (
        public._gs_peut_ecrire()
        or (
          public.suis_je_salarie()
          and p_salarie_id = (select q.personne_id from public.qui_suis_je() q)
        )
      )
    order by s.date_seance, s.heure_debut nulls last, s.id;
end;
$function$;

comment on function public.agenda_seances_salarie(uuid, date, date) is
  'Agenda TOUS TYPES CONFONDUS d''un salarie sur [p_date_debut, p_date_fin] (bornes incluses, '
  'max 400 j). 11 colonnes out_*, AUCUN filtre d''etat (les 4 passent, filtrage annulees au front). '
  'Garde d''acces (ADDENDUM 1 au FAIT FOI SUIVI-AGENDA-TOUS-TYPES) : admin|bureau (_gs_peut_ecrire) '
  'OU salarie relie dont qui_suis_je() = p_salarie_id ; hors perimetre = zero ligne. Heritage lieu : '
  'seance.lieu_libre -> site seance -> mission.lieu_libre -> site mission (patron sql_78/sql_144). '
  'sql_150, chantier SUIVI-AGENDA-TOUS-TYPES, 04/07/2026.';

-- GRANT authenticated SEULEMENT ; REVOKE public ET anon (piege d'heritage Supabase).
revoke all on function public.agenda_seances_salarie(uuid, date, date) from public;
revoke all on function public.agenda_seances_salarie(uuid, date, date) from anon;
grant execute on function public.agenda_seances_salarie(uuid, date, date) to authenticated;

-- ============================================================================
-- do $verif$ — fail-loud (discipline sql_144). Prouve ce qui est prouvable en SQL
-- Editor (auth.uid() NULL) : unicite, grants, garde de bornes, chemin negatif. Les
-- comptes sont TRACES (raise notice), pas assertes au-dela de « pas d'exception ».
-- ============================================================================
do $verif$
declare
  v_n_fn       integer;
  v_auth       boolean;
  v_anon       boolean;
  v_bornes_inv boolean := false;
  v_bornes_400 boolean := false;
  v_neg_count  integer;
  -- Lohann HUMBERT (salarie v1) ; fenetre de reference du kit §5.
  v_lohann     uuid := '589e7977-748c-42db-b29c-0505ec0d2e41';
begin
  -- 1) Unicite : exactement 1 fonction a 3 arguments.
  v_n_fn := (
    select count(*)
    from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public'
      and p.proname = 'agenda_seances_salarie'
      and p.pronargs = 3
  );
  if v_n_fn <> 1 then
    raise exception 'VERIF unicite: attendu 1 fonction (3 args), trouve %.', v_n_fn;
  end if;

  -- 2) Privileges : authenticated = execute ; anon = pas d'execute (couvre l'heritage PUBLIC,
  --    anon heriterait d'un GRANT PUBLIC residuel).
  v_auth := (select has_function_privilege('authenticated',
    'public.agenda_seances_salarie(uuid,date,date)', 'execute'));
  v_anon := (select has_function_privilege('anon',
    'public.agenda_seances_salarie(uuid,date,date)', 'execute'));
  if not v_auth then
    raise exception 'VERIF grant: authenticated devrait pouvoir executer.';
  end if;
  if v_anon then
    raise exception 'VERIF grant: anon ne devrait PAS pouvoir executer (revoke public+anon).';
  end if;

  -- 3) Garde de bornes : intervalle inverse -> exception attendue.
  begin
    perform *
    from public.agenda_seances_salarie(v_lohann, date '2026-07-31', date '2026-07-01');
    v_bornes_inv := false;
  exception when others then
    v_bornes_inv := true;
  end;
  if not v_bornes_inv then
    raise exception 'VERIF bornes: un intervalle inverse aurait du lever.';
  end if;

  -- 3b) Garde de bornes : intervalle > 400 j -> exception attendue.
  begin
    perform *
    from public.agenda_seances_salarie(v_lohann, date '2026-01-01', date '2027-06-01');
    v_bornes_400 := false;
  exception when others then
    v_bornes_400 := true;
  end;
  if not v_bornes_400 then
    raise exception 'VERIF bornes: un intervalle > 400 j aurait du lever.';
  end if;

  -- 4) Chemin negatif : SQL Editor -> auth.uid() NULL -> ni admin|bureau ni voie 3
  --    -> zero ligne (garde en filtre, pas d'exception). On TRACE le compte.
  v_neg_count := (
    select count(*)
    from public.agenda_seances_salarie(v_lohann, date '2026-07-01', date '2026-07-31')
  );

  raise notice 'VERIF sql_150 OK — unicite=% auth=% anon=% bornes_inv=% bornes_400=% chemin_negatif_lignes=% (attendu 0 en SQL Editor, auth.uid() NULL ; R1: chemin heureux non prouvable ici).',
    v_n_fn, v_auth, v_anon, v_bornes_inv, v_bornes_400, v_neg_count;
end;
$verif$;
