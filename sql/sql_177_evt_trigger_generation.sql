-- =====================================================================
-- sql_177 — EVT-RECURRENCE-OCCURRENCES — Étape 4/4 : trigger génération auto
-- =====================================================================
-- À l'INSERT d'une mère récurrente (parent null, recurrence hebdomadaire,
-- type entrainement/stage), génère automatiquement les occurrences via le
-- _core (SECURITY DEFINER). Couvre tous les chemins de création (RPC,
-- duplication) sans toucher creer_evenement_complet.
--
-- Exécuté et vérifié : création mère -> occurrences générées automatiquement.
-- =====================================================================

create or replace function public._trg_generer_occurrences_apres_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.evenement_parent_id is null
     and new.recurrence is not null
     and (new.recurrence ->> 'frequence') = 'hebdomadaire'
     and new.type_evenement in ('entrainement','stage') then
    perform public._generer_occurrences_evenement_core(new.id, null, null);
  end if;
  return new;
end
$function$;

drop trigger if exists trg_generer_occurrences_apres_insert on public.evenements;
create trigger trg_generer_occurrences_apres_insert
  after insert on public.evenements
  for each row
  execute function public._trg_generer_occurrences_apres_insert();
