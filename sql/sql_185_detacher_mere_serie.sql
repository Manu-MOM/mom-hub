-- =====================================================================
-- sql_185 — EVT-SERIE-SUPPRESSION-MERE (Option B « mere detachee »)
-- RPC detacher_mere_serie(p_mere_id uuid)
-- ---------------------------------------------------------------------
-- Neutralise la seance portee par la MERE d'une serie recurrente SANS
-- detruire la serie : etat='annule' + auto-exclusion de sa propre date
-- (ajout de date_debut::date a dates_exclues, idempotent). La mere reste
-- l'ancrage invisible de la recurrence (recurrence, dates_exclues, cible
-- CASCADE des enfants). Aucun DELETE, aucun re-parentage.
--
-- Reversible via rattacher_mere_serie (sql_186).
-- Distinct de « supprimer la serie entiere » (= DELETE mere + CASCADE).
--
-- Garde B5 repliquee de supprimer_occurrence_evenement (sql_176).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.detacher_mere_serie(p_mere_id uuid)
 RETURNS TABLE(out_mere_id uuid, out_date_exclue date, out_nb_exclues integer, out_nb_seances_restantes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mere public.evenements%rowtype;
  v_date date;
begin
  -- Garde B5 (repliquee de supprimer_occurrence_evenement)
  if not (has_role('admin') or has_role('bureau')
          or puis_je_faire('gerer_evenements', public._b5_categorie_de_evenement(p_mere_id))) then
    raise exception 'access denied: admin, bureau or gerer_evenements capability required (detacher_mere_serie)'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_mere from public.evenements where id = p_mere_id;
  if not found then
    raise exception 'detacher_mere_serie: evenement % introuvable', p_mere_id
      using errcode = 'no_data_found';
  end if;
  -- Doit etre une MERE (pas une occurrence enfant)
  if v_mere.evenement_parent_id is not null then
    raise exception 'detacher_mere_serie: % est une occurrence enfant, pas une mere. Utiliser supprimer_occurrence_evenement.', p_mere_id
      using errcode = 'invalid_parameter_value';
  end if;
  -- Doit porter une recurrence (sinon rien a detacher : c'est un evenement simple)
  if v_mere.recurrence is null then
    raise exception 'detacher_mere_serie: % ne porte pas de recurrence (evenement simple). Pour le supprimer, utiliser supprimer_evenement.', p_mere_id
      using errcode = 'invalid_parameter_value';
  end if;

  v_date := v_mere.date_debut::date;

  -- Neutralisation : etat=annule + auto-exclusion de sa propre date (idempotent)
  update public.evenements
     set etat = 'annule',
         dates_exclues = (
           select array_agg(distinct d order by d)
           from unnest(array_append(dates_exclues, v_date)) d
         ),
         updated_at = now()
   where id = p_mere_id
   returning array_length(dates_exclues, 1) into out_nb_exclues;

  -- Compteur informatif : seances "vivantes" restantes de la serie
  -- = occurrences enfants non annulees (la mere est desormais annulee)
  select count(*)::int into out_nb_seances_restantes
  from public.evenements c
  where c.evenement_parent_id = p_mere_id
    and c.etat <> 'annule';

  out_mere_id := p_mere_id;
  out_date_exclue := v_date;
  raise notice 'detacher_mere_serie OK : mere % annulee + date % exclue ; % seances restantes',
    p_mere_id, v_date, out_nb_seances_restantes;
  return next;
end
$function$;

REVOKE ALL ON FUNCTION public.detacher_mere_serie(uuid) FROM public;
REVOKE ALL ON FUNCTION public.detacher_mere_serie(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.detacher_mere_serie(uuid) TO authenticated;
