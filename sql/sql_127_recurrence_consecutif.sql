-- =============================================================================
-- sql_127_recurrence_consecutif.sql
-- Chantier C — mode « jours consécutifs » (SALARIE-REFONTE-MODALE-MISSION)
--
-- Objet : élargir generer_occurrences_recurrentes pour générer UNE séance par
--   JOUR de la plage [Du, Au] quand le rythme est en mode « consécutif »
--   (cas d'usage : stages à cheval — ex. stage lun→ven = 5 séances, une/jour,
--   sans cocher chaque jour ISO). Le mode hebdomadaire/intervalle (pt 119)
--   reste STRICTEMENT inchangé.
--
-- Décision §4 (PASSATION chantier C), tranchée par Manu APRÈS sonde S-C1
--   (corps réel relu à la source) :
--   OPTION 1 — frequence distincte 'consecutif'. Le motif consécutif =
--   { frequence:'consecutif', heure_debut?, duree_min? } (PAS de 'jours', PAS
--   d'intervalle_semaines). Structure : if v_freq = 'consecutif' then <branche
--   consécutif> else <bloc hebdomadaire pt 119 RECOPIÉ À L'IDENTIQUE>.
--   Sous-décision (Manu) : en consécutif, TOUS les jours de [Du, Au] sont
--   générés (week-end inclus) — un stage qui saute un jour borne sa date_fin.
--
-- DS-1 : corps réel de generer_occurrences_recurrentes (signature (uuid,date,
--   date), RETURNS TABLE 4 colonnes out_*, garde _gs_peut_ecrire, lecture jsonb
--   recurrence, bloc hebdo/intervalle pt 119) relu à la source (S-C1, sonde
--   pg_get_functiondef via OID, Manu) AVANT écriture. Le verrou du bloc 3
--   (`if v_freq is distinct from 'hebdomadaire' then raise feature_not_supported`)
--   est dégroupé pour accepter 'consecutif' EN PLUS, jamais contourné.
--
-- Périmètre (PASSATION §5, §6, §7) :
--   - Signature ET RETURNS INCHANGÉS (modification interne uniquement).
--   - Bloc hebdomadaire/intervalle pt 119 préservé mot pour mot (rétro-compat
--     absolue : frequence absent OU 'hebdomadaire' ⇒ comportement identique).
--   - Idempotence EXISTS (mission_id, date_seance) réutilisée dans les 2 branches.
--   - Garde _gs_peut_ecrire + SECURITY DEFINER + REVOKE anon préservés.
--   - Compteur, missions.statut (pt 122), 5 colonnes facturation (pt 121),
--     10 type_mission (sql_114) NON touchés.
--
-- Idempotent : DROP FUNCTION IF EXISTS (signature (uuid,date,date) exacte) avant
--   CREATE OR REPLACE (anti-surcharge). Signature inchangée → pas de nouvel appel
--   front à adapter (le câblage UI du mode consécutif est au chantier D).
-- =============================================================================

begin;

-- DROP de la signature exacte (anti-surcharge ambiguë), puis recréation.
drop function if exists public.generer_occurrences_recurrentes(uuid, date, date);

create or replace function public.generer_occurrences_recurrentes(
  p_mission_id uuid,
  p_from date,
  p_to date
)
returns table(
  out_nb_creees integer,
  out_nb_existantes integer,
  out_borne_debut date,
  out_borne_fin date
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
  v_intervalle  int;   -- nb de semaines entre deux occurrences (>= 1).
  v_debut_lundi date;  -- lundi ISO de la semaine de date_debut (référence).
  v_sem         int;   -- n° de semaine de la date courante relatif à la référence.
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
  -- 3) Lire le rythme. v1 : 'hebdomadaire' (pt 119) OU 'consecutif' (chantier C).
  v_freq := v_mission.recurrence ->> 'frequence';
  if v_freq not in ('hebdomadaire', 'consecutif') then
    raise exception 'generer_occurrences_recurrentes: frequence "%" non supportee (hebdomadaire|consecutif)', v_freq
      using errcode = 'feature_not_supported';
  end if;

  -- defauts optionnels (repris sur chaque occurrence, communs aux 2 modes)
  v_heure := nullif(v_mission.recurrence ->> 'heure_debut', '')::time;
  v_duree := nullif(v_mission.recurrence ->> 'duree_min', '')::int;

  -- 4) Bornes effectives : intersection [fenetre] x [date_debut, date_fin mission].
  --    (commun aux 2 modes)
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

  if v_freq = 'consecutif' then
    -- ----- MODE CONSECUTIF (chantier C) : une seance PAR JOUR de [Du, Au] -----
    -- Aucun champ 'jours', aucun intervalle : chaque jour de la fenetre est
    -- candidat (week-end inclus, decision Manu). Idempotence EXISTS reutilisee.
    v_d := v_borne_deb;
    while v_d <= v_borne_fin loop
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
      v_d := v_d + 1;
    end loop;
  else
    -- ----- MODE HEBDOMADAIRE / INTERVALLE (pt 119, RECOPIE A L'IDENTIQUE) -----
    -- jours ISO (1=lundi..7=dimanche) ; obligatoire et non vide.
    select array_agg((j)::int) into v_jours
    from jsonb_array_elements_text(coalesce(v_mission.recurrence -> 'jours', '[]'::jsonb)) as j;
    if v_jours is null or array_length(v_jours, 1) is null then
      raise exception 'generer_occurrences_recurrentes: aucun jour dans le rythme (champ "jours" vide)'
        using errcode = 'invalid_parameter_value';
    end if;
    -- intervalle de semaines. Absent ou vide -> 1 (hebdo simple = retro-compat).
    v_intervalle := coalesce(nullif(v_mission.recurrence ->> 'intervalle_semaines', '')::int, 1);
    if v_intervalle < 1 then
      raise exception 'generer_occurrences_recurrentes: intervalle_semaines % invalide (>= 1 requis)', v_intervalle
        using errcode = 'invalid_parameter_value';
    end if;
    -- Lundi ISO de la semaine de date_debut : reference du comptage des semaines.
    v_debut_lundi := date_trunc('week', v_mission.date_debut)::date;

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
  end if;

  out_nb_creees     := v_nb_creees;
  out_nb_existantes := v_nb_exist;
  return next;
  return;
end
$function$;

-- REVOKE depuis PUBLIC ET anon : sur Supabase les default privileges du schéma
-- public accordent EXECUTE à PUBLIC (dont anon hérite) ; REVOKE FROM anon seul
-- ne suffit pas (leçon DS-1 pt 109/121).
revoke all on function public.generer_occurrences_recurrentes(uuid, date, date) from public;
revoke all on function public.generer_occurrences_recurrentes(uuid, date, date) from anon;
grant execute on function public.generer_occurrences_recurrentes(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Vérification fail-loud (refuse de committer si l'état n'est pas conforme)
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_nb  int;
  v_def text;
begin
  -- fonction présente en 1 exemplaire (signature (uuid,date,date))
  select count(*) into v_nb
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'generer_occurrences_recurrentes';
  if v_nb <> 1 then
    raise exception 'VERIF: generer_occurrences_recurrentes doit exister en 1 exemplaire, trouve %', v_nb;
  end if;

  -- corps : support 'consecutif' présent ET bloc hebdo/intervalle préservé
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'generer_occurrences_recurrentes';
  if v_def not like '%consecutif%' then
    raise exception 'VERIF: support mode consecutif absent du corps';
  end if;
  if v_def not like '%intervalle_semaines%' then
    raise exception 'VERIF: bloc hebdo/intervalle (pt 119) absent du corps';
  end if;
  if v_def not like '%isodow%' then
    raise exception 'VERIF: filtre jour ISO (hebdo) absent du corps';
  end if;
  if v_def not like '%_gs_peut_ecrire%' then
    raise exception 'VERIF: garde _gs_peut_ecrire absente du corps';
  end if;
  if v_def not like '%SECURITY DEFINER%' then
    raise exception 'VERIF: SECURITY DEFINER perdu';
  end if;

  -- anon fermé, authenticated ouvert
  if has_function_privilege('anon', 'public.generer_occurrences_recurrentes(uuid, date, date)', 'execute') then
    raise exception 'VERIF: anon ne doit pas pouvoir executer generer_occurrences_recurrentes';
  end if;
  if not has_function_privilege('authenticated', 'public.generer_occurrences_recurrentes(uuid, date, date)', 'execute') then
    raise exception 'VERIF: authenticated doit pouvoir executer generer_occurrences_recurrentes';
  end if;

  raise notice 'VERIF sql_127 OK : mode consecutif + bloc hebdo preserve (anon ferme, authenticated ouvert)';
end;
$verif$;

commit;
