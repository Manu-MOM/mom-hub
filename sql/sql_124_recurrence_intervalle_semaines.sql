-- =====================================================================
-- sql_124 — generer_occurrences_recurrentes : support de intervalle_semaines
-- =====================================================================
-- Chantier SALARIE-RECURRENCE-GENERATION (#1), pt 118+.
--
-- OBJET : élargir le moteur de génération hebdomadaire pour supporter un
-- intervalle de semaines (1 = hebdo, 2 = bi-hebdo, 3 = tri-hebdo…), référence
-- = missions.date_debut. Signature ET RETURNS INCHANGÉS (additif sur le
-- COMPORTEMENT, pas sur l'API). Tout le reste du corps est recopié à
-- l'identique du corps réel déployé (sondé via pg_get_functiondef).
--
-- RÉTRO-COMPAT EXIGÉE (prouvée §verif) : recurrence sans 'intervalle_semaines'
-- OU avec la valeur 1 ⇒ v_intervalle = 1 ⇒ condition (v_sem % 1) = 0 toujours
-- vraie ⇒ comportement STRICTEMENT identique à l'actuel.
--
-- MODÈLE (acté Manu 27/06) : une date d est retenue si
--   (1) son jour ISO ∈ recurrence.jours,  ET
--   (2) le n° de semaine de d relatif à date_debut est multiple de
--       l'intervalle, soit (floor((lundi(d) - lundi(date_debut)) / 7) % N) = 0.
-- date_trunc('week', …) ancre le lundi ISO sur cette instance (sonde C : OK).
--
-- INVARIANTS PRÉSERVÉS : garde _gs_peut_ecrire (admin|bureau), intersection
-- [fenêtre] × [date_debut, date_fin], idempotence logique par EXISTS
-- (mission_id, date_seance) — aucun index unique en base (sonde B), fail-loud,
-- INSERT en 'prevue'. SECURITY DEFINER + search_path public + REVOKE anon.
-- =====================================================================

-- Anti-overload : on retire l'ancienne version (signature exacte) avant recréation.
drop function if exists public.generer_occurrences_recurrentes(uuid, date, date);

create or replace function public.generer_occurrences_recurrentes(
  p_mission_id uuid,
  p_from       date,
  p_to         date
)
returns table(
  out_nb_creees     integer,
  out_nb_existantes integer,
  out_borne_debut   date,
  out_borne_fin     date
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_mission     public.missions%rowtype;
  v_freq        text;
  v_jours       int[];
  v_heure       time;
  v_duree       int;
  v_intervalle  int;   -- NOUVEAU : nb de semaines entre deux occurrences (>= 1).
  v_debut_lundi date;  -- NOUVEAU : lundi ISO de la semaine de date_debut (référence).
  v_sem         int;   -- NOUVEAU : n° de semaine de la date courante relatif à la référence.
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
  -- intervalle de semaines (NOUVEAU). Absent ou vide -> 1 (hebdo simple = retro-compat).
  v_intervalle := coalesce(nullif(v_mission.recurrence ->> 'intervalle_semaines', '')::int, 1);
  if v_intervalle < 1 then
    raise exception 'generer_occurrences_recurrentes: intervalle_semaines % invalide (>= 1 requis)', v_intervalle
      using errcode = 'invalid_parameter_value';
  end if;
  -- Lundi ISO de la semaine de date_debut : reference du comptage des semaines.
  v_debut_lundi := date_trunc('week', v_mission.date_debut)::date;
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
  --    ET si la semaine relative est multiple de l'intervalle
  --    ET si aucune occurrence ne porte deja (mission_id, date_seance).
  v_d := v_borne_deb;
  while v_d <= v_borne_fin loop
    if extract(isodow from v_d)::int = any (v_jours) then
      -- n° de semaine de v_d relatif a la semaine de date_debut (semaine 0).
      v_sem := floor((date_trunc('week', v_d)::date - v_debut_lundi) / 7)::int;
      if (v_sem % v_intervalle) = 0 then
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
    end if;
    v_d := v_d + 1;
  end loop;
  out_nb_creees     := v_nb_creees;
  out_nb_existantes := v_nb_exist;
  return next;
  return;
end
$function$;

-- Droits : fermer anon explicitement, ouvrir aux authentifies (la garde
-- _gs_peut_ecrire mord ensuite sur admin|bureau).
revoke all on function public.generer_occurrences_recurrentes(uuid, date, date) from public;
revoke all on function public.generer_occurrences_recurrentes(uuid, date, date) from anon;
grant execute on function public.generer_occurrences_recurrentes(uuid, date, date) to authenticated;

-- =====================================================================
-- VERIF fail-loud : refuse de "passer" si l'etat post-execution devie.
-- =====================================================================
do $verif$
declare
  v_def text;
begin
  -- La fonction doit exister avec la signature attendue.
  if to_regprocedure('public.generer_occurrences_recurrentes(uuid, date, date)') is null then
    raise exception 'VERIF: generer_occurrences_recurrentes(uuid,date,date) absente apres recreation';
  end if;

  v_def := pg_get_functiondef('public.generer_occurrences_recurrentes(uuid, date, date)'::regprocedure);

  -- Le support de l'intervalle doit etre present.
  if position('intervalle_semaines' in v_def) = 0 then
    raise exception 'VERIF: support intervalle_semaines absent du corps';
  end if;
  if position('v_intervalle' in v_def) = 0 then
    raise exception 'VERIF: variable v_intervalle absente du corps';
  end if;
  -- Test stable : la variable de comptage de semaine doit etre presente
  -- (pg_get_functiondef peut normaliser les espaces autour de l'operateur modulo).
  if position('v_sem' in v_def) = 0 then
    raise exception 'VERIF: variable v_sem (comptage de semaine) absente du corps';
  end if;
  if position('v_debut_lundi' in v_def) = 0 then
    raise exception 'VERIF: reference v_debut_lundi absente du corps';
  end if;

  -- Les invariants critiques doivent etre preserves.
  if position('_gs_peut_ecrire' in v_def) = 0 then
    raise exception 'VERIF: garde _gs_peut_ecrire perdue';
  end if;
  if position('security definer' in lower(v_def)) = 0 then
    raise exception 'VERIF: SECURITY DEFINER perdu';
  end if;
  if position('hebdomadaire' in v_def) = 0 then
    raise exception 'VERIF: garde de frequence hebdomadaire perdue';
  end if;
  if position('isodow' in v_def) = 0 then
    raise exception 'VERIF: filtre jour ISO (isodow) perdu';
  end if;

  -- anon ne doit PAS pouvoir executer.
  if has_function_privilege('anon',
       'public.generer_occurrences_recurrentes(uuid, date, date)', 'execute') then
    raise exception 'VERIF: anon peut EXECUTE (revoke manque)';
  end if;
  -- authenticated DOIT pouvoir executer.
  if not has_function_privilege('authenticated',
       'public.generer_occurrences_recurrentes(uuid, date, date)', 'execute') then
    raise exception 'VERIF: authenticated ne peut pas EXECUTE (grant manque)';
  end if;

  raise notice 'OK sql_124 : generer_occurrences_recurrentes elargie (intervalle_semaines), invariants preserves, anon ferme.';
end
$verif$;
