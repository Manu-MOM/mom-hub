-- =====================================================================
-- sql_181 — EVT-SERIE-ECRAN (SQL-2) : RPC dédiée de modification de
--           récurrence (prolongation / raccourcissement).
--
-- Chantier : EVT-SERIE-ECRAN.
-- Décision : architecture B2 — RPC dédiée, modifier_evenement_complet
--            NON touchée (son §4 rase les enfants ; inadapté aux occurrences
--            d'entraînement).
-- Comportement :
--   - UPDATE evenements.recurrence de la mère (source de vérité).
--   - Prolongation (D2) : generer_occurrences_evenement idempotent
--     (from = date mère, to = null ; borné par _core).
--   - Raccourcissement (D1=b, D3) : suppression des occurrences FUTURES
--     strictement au-delà de la nouvelle borne, jamais une séance passée
--     (date_debut::date > current_date).
-- Garde : B5 (voir sql_182) — admin | bureau | gerer_evenements sur la cat.
-- Nouvelle fonction : pas de DROP, pas de risque PGRST203.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.modifier_recurrence_evenement(p_evenement_id uuid, p_recurrence jsonb)
 RETURNS TABLE(out_nb_creees integer, out_nb_supprimees integer, out_borne_fin date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mere        public.evenements%rowtype;
  v_saison_fin  date;
  v_fin_rec     date;
  v_borne_fin   date;
  v_nb_creees   int := 0;
  v_nb_suppr    int := 0;
begin
  -- (0) GARDE RÔLE B5 : admin | bureau | capacité gerer_evenements sur la catégorie
  if not (has_role('admin') or has_role('bureau')
          or puis_je_faire('gerer_evenements', public._b5_categorie_de_evenement(p_evenement_id))) then
    raise exception 'access denied: admin, bureau or gerer_evenements capability required (modifier_recurrence_evenement)';
  end if;

  select * into v_mere from public.evenements where id = p_evenement_id;
  if not found then
    raise exception 'modifier_recurrence: évènement % introuvable', p_evenement_id using errcode='no_data_found';
  end if;
  if v_mere.evenement_parent_id is not null then
    raise exception 'modifier_recurrence: % est une occurrence enfant, pas une mère', p_evenement_id using errcode='invalid_parameter_value';
  end if;
  if v_mere.type_evenement not in ('entrainement','stage') then
    raise exception 'modifier_recurrence: type % non récurrençable', v_mere.type_evenement using errcode='feature_not_supported';
  end if;

  update public.evenements
     set recurrence = p_recurrence,
         updated_at = now()
   where id = p_evenement_id;

  select * into v_mere from public.evenements where id = p_evenement_id;

  if v_mere.recurrence is null
     or (v_mere.recurrence ->> 'frequence') is distinct from 'hebdomadaire' then
    out_nb_creees := 0; out_nb_supprimees := 0; out_borne_fin := null;
    return next; return;
  end if;

  select date_fin into v_saison_fin from public.saisons where id = v_mere.saison_id;
  v_fin_rec := nullif(v_mere.recurrence ->> 'fin', '')::date;
  v_borne_fin := least(
                   coalesce(v_fin_rec, v_saison_fin, v_mere.date_debut::date),
                   coalesce(v_saison_fin, v_fin_rec, v_mere.date_debut::date));
  out_borne_fin := v_borne_fin;

  delete from public.evenements
   where evenement_parent_id = p_evenement_id
     and date_debut::date > v_borne_fin
     and date_debut::date > current_date;
  get diagnostics v_nb_suppr = row_count;

  select out_nb_creees into v_nb_creees
  from public._generer_occurrences_evenement_core(
         p_evenement_id, v_mere.date_debut::date, null);

  out_nb_creees := coalesce(v_nb_creees, 0);
  out_nb_supprimees := v_nb_suppr;
  return next;
end
$function$;
