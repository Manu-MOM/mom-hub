-- =====================================================================
-- sql_178 — EVT-RECURRENCE-OCCURRENCES — correctif horaires occurrences
-- =====================================================================
-- Le générateur _core copie désormais les horaires de la mère sur chaque
-- occurrence (debut_match, fin_prevue, rdv_heure, rdv_lieu) et positionne
-- date_debut de l'occurrence à l'heure de séance (debut_match sinon
-- rdv_heure sinon heure de la mère), au lieu de minuit.
--
-- Bug corrigé : les occurrences étaient créées avec horaires null et
-- date_debut à minuit UTC (affichage « 2h » parasite côté front).
--
-- NB : pour réparer une série DÉJÀ générée avant ce correctif, recopier les
-- horaires de la mère sur ses occurrences et recaler date_debut :
--   update evenements o set debut_match=m.debut_match, fin_prevue=m.fin_prevue,
--     rdv_heure=m.rdv_heure, rdv_lieu=coalesce(o.rdv_lieu,m.rdv_lieu),
--     date_debut=(o.date_debut::date
--                 + coalesce(m.debut_match,m.rdv_heure,'00:00'::time))
--                 at time zone 'Europe/Paris'
--   from evenements m
--   where o.evenement_parent_id=m.id and m.recurrence is not null;
--
-- Exécuté et vérifié : série mardi Senior F réparée (47 occ à 19h15).
-- =====================================================================

create or replace function public._generer_occurrences_evenement_core(p_evenement_mere_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(out_nb_creees integer, out_nb_existantes integer, out_borne_debut date, out_borne_fin date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mere public.evenements%rowtype;
  v_freq text; v_dow int; v_heure_evt time; v_fin_rec date; v_saison_fin date;
  v_borne_deb date; v_borne_fin date; v_d date; v_child_code text;
  v_nb_creees int := 0; v_nb_exist int := 0;
begin
  select * into v_mere from public.evenements where id = p_evenement_mere_id;
  if not found then
    raise exception '_core: mère % introuvable', p_evenement_mere_id using errcode='no_data_found';
  end if;
  if v_mere.recurrence is null then
    raise exception '_core: mère % sans recurrence', p_evenement_mere_id using errcode='no_data_found';
  end if;
  if v_mere.evenement_parent_id is not null then
    raise exception '_core: % est une occurrence enfant', p_evenement_mere_id using errcode='invalid_parameter_value';
  end if;
  if v_mere.type_evenement not in ('entrainement','stage') then
    raise exception '_core: type % non récurrençable', v_mere.type_evenement using errcode='feature_not_supported';
  end if;
  v_freq := v_mere.recurrence ->> 'frequence';
  if v_freq is distinct from 'hebdomadaire' then
    raise exception '_core: frequence "%" non supportée (v1: hebdomadaire)', v_freq using errcode='feature_not_supported';
  end if;

  v_dow := extract(isodow from v_mere.date_debut)::int;
  v_heure_evt := coalesce(v_mere.debut_match, v_mere.rdv_heure,
                          (v_mere.date_debut at time zone 'Europe/Paris')::time);
  v_fin_rec := nullif(v_mere.recurrence ->> 'fin', '')::date;
  select date_fin into v_saison_fin from public.saisons where id = v_mere.saison_id;
  v_borne_deb := coalesce(p_from, v_mere.date_debut::date);
  v_borne_fin := least(
                   coalesce(p_to, v_saison_fin, v_mere.date_debut::date),
                   coalesce(v_fin_rec, v_saison_fin, v_mere.date_debut::date));
  out_borne_debut := v_borne_deb; out_borne_fin := v_borne_fin;
  if v_borne_deb > v_borne_fin then
    out_nb_creees:=0; out_nb_existantes:=0; return next; return;
  end if;

  v_d := v_borne_deb;
  while v_d <= v_borne_fin loop
    if extract(isodow from v_d)::int = v_dow
       and v_d <> v_mere.date_debut::date
       and not (v_d = any (v_mere.dates_exclues)) then
      if exists (select 1 from public.evenements c
                 where c.evenement_parent_id = p_evenement_mere_id
                   and c.date_debut::date = v_d) then
        v_nb_exist := v_nb_exist + 1;
      else
        v_child_code := v_mere.code || '-OCC' || to_char(v_d, 'YYYYMMDD');
        insert into public.evenements (
          code, libelle, type_evenement, categorie_id, equipe_id,
          saison_id, organisateur_principal_id, date_debut, evenement_parent_id, etat,
          debut_match, fin_prevue, rdv_heure, rdv_lieu
        ) values (
          v_child_code, v_mere.libelle, v_mere.type_evenement, v_mere.categorie_id, v_mere.equipe_id,
          v_mere.saison_id, v_mere.organisateur_principal_id,
          (v_d + v_heure_evt) at time zone 'Europe/Paris',
          p_evenement_mere_id, 'creation',
          v_mere.debut_match, v_mere.fin_prevue, v_mere.rdv_heure, v_mere.rdv_lieu
        );
        v_nb_creees := v_nb_creees + 1;
      end if;
    end if;
    v_d := v_d + 1;
  end loop;
  out_nb_creees := v_nb_creees; out_nb_existantes := v_nb_exist;
  return next;
end
$function$;
