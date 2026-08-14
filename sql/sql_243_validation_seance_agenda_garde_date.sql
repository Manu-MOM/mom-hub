-- =====================================================================
-- sql_243_validation_seance_agenda_garde_date.sql
-- Chantier : VALIDATION-SEANCE-DEPUIS-AGENDA (F6)
-- ---------------------------------------------------------------------
-- Objet : ajoute une GARDE DE DATE à declarer_occurrence. Une séance de
--         mission ne peut être déclarée « réalisée » qu'à partir de son
--         jour d'exécution (jour J INCLUS), en heure locale FR.
--
-- Contexte : la déclaration est désormais déclenchable depuis l'agenda
--            salarié (missions-agenda.html, hook detail.action de HubAgenda,
--            F3+F5). Le front masque déjà le bouton sur une séance future ;
--            cette garde serveur est la DÉFENSE EN PROFONDEUR (rempart).
--
-- Additivité : par rapport au corps déployé (sql_120), ce fichier ajoute
--   UNIQUEMENT :
--     1. la variable locale v_date + la colonne ms.date_seance au SELECT into
--     2. le bloc de garde de date, placé APRÈS le contrôle d'autorisation
--        et AVANT le contrôle d'état.
--   Aucune modification de signature (uuid, numeric) -> pas d'overload.
--   Autorisation INCHANGÉE : _gs_peut_ecrire() (admin|bureau) OU salarié concerné.
--
-- Hypothèse assumée : fuseau 'Europe/Paris' en dur (club France métropolitaine,
--   pas de multi-fuseau au Hub).
--
-- Déploiement : appliqué en production le 14/08/2026 via migration
--   validation_seance_agenda_garde_date_f6 (corps identique à ci-dessous),
--   ordre autorisation -> date -> état confirmé par sonde post-migration.
-- =====================================================================

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
  v_date    date;
begin
  select ms.etat, m.salarie_id, ms.date_seance
    into v_etat, v_salarie, v_date
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

  -- VALIDATION-SEANCE-DEPUIS-AGENDA (F6) : garde de date. Jour J inclus, heure
  -- locale FR. Rempart serveur (le front masque déjà le bouton sur une future).
  if v_date > (now() at time zone 'Europe/Paris')::date then
    raise exception 'Déclaration impossible : la séance du % n''a pas encore eu lieu (déclaration possible à partir du jour même).', to_char(v_date, 'DD/MM/YYYY');
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

-- ---- Habilitations (réaffirmées ; un CREATE OR REPLACE les préserve, on les
--      réécrit pour que le fichier versionné soit auto-suffisant) ------------
revoke execute on function public.declarer_occurrence(uuid, numeric) from public, anon;
grant  execute on function public.declarer_occurrence(uuid, numeric) to authenticated;

-- ---- Vérifications fail-loud ------------------------------------------------
do $verif$
declare
  v_src  text;
  p_autz int;
  p_date int;
  p_etat int;
begin
  -- fonction présente
  if to_regprocedure('public.declarer_occurrence(uuid, numeric)') is null then
    raise exception 'VERIF: declarer_occurrence(uuid, numeric) absente';
  end if;

  -- signature unique (pas d'overload)
  if (select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'declarer_occurrence') <> 1 then
    raise exception 'VERIF: overload détecté sur declarer_occurrence';
  end if;

  -- garde F6 présente et bien ordonnée : autorisation -> date -> état
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'declarer_occurrence';

  p_autz := position('_gs_peut_ecrire' in v_src);
  p_date := position('Europe/Paris'    in v_src);
  p_etat := position('non modifiable'  in v_src);

  if p_date = 0 then raise exception 'VERIF: garde de date (F6) absente'; end if;
  if not (p_autz > 0 and p_autz < p_date and p_date < p_etat) then
    raise exception 'VERIF: ordre incorrect (autz=% date=% etat=%)', p_autz, p_date, p_etat;
  end if;

  -- habilitations
  if has_function_privilege('anon', 'public.declarer_occurrence(uuid, numeric)', 'execute') then
    raise exception 'VERIF: anon ne doit PAS avoir execute';
  end if;
  if not has_function_privilege('authenticated', 'public.declarer_occurrence(uuid, numeric)', 'execute') then
    raise exception 'VERIF: authenticated doit avoir execute';
  end if;

  raise notice 'VERIF OK : declarer_occurrence + garde F6 (autz->date->etat), signature unique, habilitations conformes.';
end
$verif$;
