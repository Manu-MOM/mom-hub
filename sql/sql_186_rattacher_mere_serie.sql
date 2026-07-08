-- =====================================================================
-- sql_186 — EVT-SERIE-SUPPRESSION-MERE (Option B « mere detachee »)
-- RPC rattacher_mere_serie(p_mere_id uuid)
-- ---------------------------------------------------------------------
-- Miroir de detacher_mere_serie (sql_185) : reintegre la seance portee
-- par la MERE dans la serie. etat='creation' + retrait de sa propre date
-- de dates_exclues. Les AUTRES dates exclues (vacances, occurrences
-- supprimees individuellement) sont PRESERVEES.
--
-- Garde B5 identique a detacher_mere_serie.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rattacher_mere_serie(p_mere_id uuid)
 RETURNS TABLE(out_mere_id uuid, out_date_reintegree date, out_nb_exclues integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mere public.evenements%rowtype;
  v_date date;
begin
  -- Garde B5 (miroir de detacher_mere_serie)
  if not (has_role('admin') or has_role('bureau')
          or puis_je_faire('gerer_evenements', public._b5_categorie_de_evenement(p_mere_id))) then
    raise exception 'access denied: admin, bureau or gerer_evenements capability required (rattacher_mere_serie)'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_mere from public.evenements where id = p_mere_id;
  if not found then
    raise exception 'rattacher_mere_serie: evenement % introuvable', p_mere_id
      using errcode = 'no_data_found';
  end if;
  if v_mere.evenement_parent_id is not null then
    raise exception 'rattacher_mere_serie: % est une occurrence enfant, pas une mere.', p_mere_id
      using errcode = 'invalid_parameter_value';
  end if;
  if v_mere.recurrence is null then
    raise exception 'rattacher_mere_serie: % ne porte pas de recurrence.', p_mere_id
      using errcode = 'invalid_parameter_value';
  end if;

  v_date := v_mere.date_debut::date;

  -- Reintegration : etat=creation + retrait de sa propre date de dates_exclues
  -- (les AUTRES dates exclues -- vacances, occurrences supprimees -- sont PRESERVEES)
  update public.evenements
     set etat = 'creation',
         dates_exclues = coalesce((
           select array_agg(d order by d)
           from unnest(dates_exclues) d
           where d <> v_date
         ), '{}'::date[]),
         updated_at = now()
   where id = p_mere_id
   returning array_length(dates_exclues, 1) into out_nb_exclues;

  out_mere_id := p_mere_id;
  out_date_reintegree := v_date;
  out_nb_exclues := coalesce(out_nb_exclues, 0);
  raise notice 'rattacher_mere_serie OK : mere % reactivee + date % reintegree ; % dates encore exclues',
    p_mere_id, v_date, out_nb_exclues;
  return next;
end
$function$;

REVOKE ALL ON FUNCTION public.rattacher_mere_serie(uuid) FROM public;
REVOKE ALL ON FUNCTION public.rattacher_mere_serie(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rattacher_mere_serie(uuid) TO authenticated;
