-- =====================================================================
-- sql_176 — EVT-RECURRENCE-OCCURRENCES — Étape 3/4 : supprimer une occurrence
-- =====================================================================
-- Supprime UNE occurrence (enfant) ET exclut sa date sur la mère
-- (dates_exclues) pour que la régénération ne la recrée pas. Garde admin|
-- coach. Pour supprimer la série entière : supprimer la mère (FK enfant
-- ON DELETE CASCADE emporte les occurrences).
--
-- Exécuté et vérifié : occurrence supprimée, date exclue non recréée.
-- =====================================================================

create or replace function public.supprimer_occurrence_evenement(p_occurrence_id uuid)
 RETURNS TABLE(out_mere_id uuid, out_date_exclue date, out_nb_exclues integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_occ   public.evenements%rowtype;
  v_date  date;
  v_mere  uuid;
begin
  if not (has_role('admin') or has_role('coach')) then
    raise exception 'access denied: admin or coach role required (supprimer_occurrence_evenement)'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_occ from public.evenements where id = p_occurrence_id;
  if not found then
    raise exception 'supprimer_occurrence_evenement: occurrence % introuvable', p_occurrence_id
      using errcode = 'no_data_found';
  end if;
  if v_occ.evenement_parent_id is null then
    raise exception 'supprimer_occurrence_evenement: % n''est pas une occurrence (pas de parent). Pour supprimer une série, supprimer la mère.', p_occurrence_id
      using errcode = 'invalid_parameter_value';
  end if;

  v_mere := v_occ.evenement_parent_id;
  v_date := v_occ.date_debut::date;

  delete from public.evenement_encadrants where evenement_id = p_occurrence_id;
  delete from public.evenements where id = p_occurrence_id;

  update public.evenements
     set dates_exclues = (
           select array_agg(distinct d order by d)
           from unnest(array_append(dates_exclues, v_date)) d
         ),
         updated_at = now()
   where id = v_mere
   returning array_length(dates_exclues,1) into out_nb_exclues;

  out_mere_id := v_mere;
  out_date_exclue := v_date;
  raise notice 'supprimer_occurrence_evenement OK : occ % supprimée, date % exclue de la mère %',
    p_occurrence_id, v_date, v_mere;
  return next;
end
$function$;
