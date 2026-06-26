-- =====================================================================
-- sql_117_generer_occurrences_recurrentes.sql
-- Chantier : MISSION-TO-COUNTER (D4 — recurrence = generation bornee a la demande)
-- Objet    : RPC qui materialise les occurrences 'prevue' d'une mission
--            recurrente, sur une FENETRE COURTE [p_from, p_to] passee en
--            parametre (le bouton « generer la semaine / le mois »).
--            PAS de moteur : lecture du rythme jsonb + projection sur la fenetre,
--            jamais deroule sur toute la saison, aucun process en fond.
-- Idempotence : anti-duplication LOGIQUE par (mission_id, date_seance)
--            (WHERE NOT EXISTS). Pas d'index unique sur ce couple : on veut
--            autoriser plusieurs creneaux le meme jour (matin + apres-midi).
-- Format recurrence (rythme pur ; bornes = missions.date_debut/date_fin) :
--   { "frequence":"hebdomadaire", "jours":[2,4], "heure_debut":"18:00", "duree_min":90 }
--   - frequence : v1 = 'hebdomadaire' seule.
--   - jours     : ISO 1=lundi..7=dimanche (EXTRACT ISODOW).
--   - heure_debut / duree_min : defauts optionnels repris sur chaque occurrence.
-- Garde    : _gs_peut_ecrire() (admin | bureau, pt 78) — fail-loud.
-- Sondes   : S7 (_gs_peut_ecrire) / S8a (missions.recurrence jsonb, date_debut/fin).
-- =====================================================================

begin;

create or replace function public.generer_occurrences_recurrentes(
  p_mission_id uuid,
  p_from       date,
  p_to         date
)
returns table (
  out_nb_creees    int,
  out_nb_existantes int,
  out_borne_debut  date,
  out_borne_fin    date
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_mission     public.missions%rowtype;
  v_freq        text;
  v_jours       int[];
  v_heure       time;
  v_duree       int;
  v_borne_deb   date;
  v_borne_fin   date;
  v_d           date;
  v_nb_creees   int := 0;
  v_nb_exist    int := 0;
begin
  -- 0) Garde d'ecriture (admin | bureau). Fail-loud.
  if not public._gs_peut_ecrire() then
    raise exception 'generer_occurrences_recurrentes: ecriture refusee (admin|bureau requis)'
      using errcode = 'insufficient_privilege';
  end if;

  -- 1) Charger la mission (fail-loud si introuvable).
  select * into v_mission from public.missions where id = p_mission_id;
  if not found then
    raise exception 'generer_occurrences_recurrentes: mission % introuvable', p_mission_id
      using errcode = 'no_data_found';
  end if;

  -- 2) La mission doit decrire un rythme (recurrence non NULL).
  if v_mission.recurrence is null then
    raise exception 'generer_occurrences_recurrentes: mission % sans recurrence (rien a generer)', p_mission_id
      using errcode = 'no_data_found';
  end if;

  -- 3) Lire le rythme. v1 : frequence 'hebdomadaire' seule supportee.
  v_freq := v_mission.recurrence ->> 'frequence';
  if v_freq is distinct from 'hebdomadaire' then
    raise exception 'generer_occurrences_recurrentes: frequence "%" non supportee en v1 (hebdomadaire seule)', v_freq
      using errcode = 'feature_not_supported';
  end if;

  -- jours ISO (1=lundi..7=dimanche) ; obligatoire et non vide.
  select array_agg((j)::int) into v_jours
  from jsonb_array_elements_text(coalesce(v_mission.recurrence -> 'jours', '[]'::jsonb)) as j;

  if v_jours is null or array_length(v_jours, 1) is null then
    raise exception 'generer_occurrences_recurrentes: aucun jour dans le rythme (champ "jours" vide)'
      using errcode = 'invalid_parameter_value';
  end if;

  -- defauts optionnels (repris sur chaque occurrence)
  v_heure := nullif(v_mission.recurrence ->> 'heure_debut', '')::time;
  v_duree := nullif(v_mission.recurrence ->> 'duree_min', '')::int;

  -- 4) Bornes effectives : intersection [fenetre] x [date_debut, date_fin mission].
  v_borne_deb := greatest(p_from, v_mission.date_debut);
  v_borne_fin := least(p_to, coalesce(v_mission.date_fin, p_to));

  out_borne_debut := v_borne_deb;
  out_borne_fin   := v_borne_fin;

  -- Fenetre vide (apres intersection) -> rien a faire, retour propre.
  if v_borne_deb > v_borne_fin then
    out_nb_creees     := 0;
    out_nb_existantes := 0;
    return next;
    return;
  end if;

  -- 5) Parcourir chaque date de la fenetre ; materialiser si jour ISO retenu
  --    ET si aucune occurrence ne porte deja (mission_id, date_seance).
  v_d := v_borne_deb;
  while v_d <= v_borne_fin loop
    if extract(isodow from v_d)::int = any (v_jours) then
      if exists (
        select 1 from public.mission_seances ms
        where ms.mission_id = p_mission_id and ms.date_seance = v_d
      ) then
        v_nb_exist := v_nb_exist + 1;
      else
        insert into public.mission_seances
          (mission_id, date_seance, heure_debut, duree_min, etat)
        values
          (p_mission_id, v_d, v_heure, v_duree, 'prevue');
        v_nb_creees := v_nb_creees + 1;
      end if;
    end if;
    v_d := v_d + 1;
  end loop;

  out_nb_creees     := v_nb_creees;
  out_nb_existantes := v_nb_exist;
  return next;
  return;
end
$fn$;

-- Droits : ferme a PUBLIC et anon (leçon pt 109), ouvre a authenticated.
revoke all on function public.generer_occurrences_recurrentes(uuid, date, date) from public;
revoke all on function public.generer_occurrences_recurrentes(uuid, date, date) from anon;
grant execute on function public.generer_occurrences_recurrentes(uuid, date, date) to authenticated;

-- Garde-fou fail-loud : fonction presente, SECURITY DEFINER, anon ferme.
do $verif$
declare
  v_exists boolean;
  v_secdef boolean;
  v_anon   boolean;
begin
  select (p.oid is not null), p.prosecdef
    into v_exists, v_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'generer_occurrences_recurrentes';

  if v_exists is not true then
    raise exception 'sql_117 ECHEC : fonction generer_occurrences_recurrentes absente';
  end if;
  if v_secdef is not true then
    raise exception 'sql_117 ECHEC : fonction non SECURITY DEFINER';
  end if;

  v_anon := exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'generer_occurrences_recurrentes'
      and has_function_privilege('anon', p.oid, 'execute')
  );
  if v_anon then
    raise exception 'sql_117 ECHEC : anon peut EXECUTE (REVOKE incomplet)';
  end if;

  raise notice 'OK sql_117 : generer_occurrences_recurrentes en place (SECURITY DEFINER, anon ferme).';
end
$verif$;

commit;
