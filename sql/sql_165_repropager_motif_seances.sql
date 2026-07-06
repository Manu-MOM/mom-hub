-- ============================================================================
-- sql_165_repropager_motif_seances.sql
-- Chantier REPROPAGATION-HORAIRE-SEANCES (FAIT FOI gelé le 06/07/2026, option A')
--
-- CONTEXTE (recette terrain Vanessa, 06/07) : l'édition d'une mission récurrente
-- (upsert_mission) met à jour le motif jsonb `recurrence` (dont heure_debut /
-- duree_min), mais les occurrences déjà matérialisées dans mission_seances
-- portent leur PROPRE heure/durée, figées à la génération. La régénération
-- (generer_occurrences_recurrentes) est ADDITIVE SEULEMENT (arbitrage pt 140,
-- garde EXISTS(mission_id, date_seance)) : elle ne met JAMAIS à jour une
-- occurrence existante. Résultat : un changement d'heure de série ne se
-- propage jamais.
--
-- DÉCISION A' (Manu, 06/07) : à l'édition d'une série, l'heure et la durée se
-- repropagent sur les occurrences FUTURES encore `prevue` ET encore ALIGNÉES
-- sur l'ANCIEN motif (heure identique, comparaison NULL-sûre). Une occurrence
-- ajustée à la main (heure différente de l'ancien motif) est ÉPARGNÉE. Les
-- occurrences realisee/validee/annulee et les dates passées ne sont JAMAIS
-- touchées. L'arbitrage pt 140 « génération additive » reste ENTIER pour les
-- DATES (changer les jours ne supprime pas les anciennes dates).
--
-- CETTE RPC : un seul UPDATE atomique, appelée par le front (suivi-salarie.html)
-- APRÈS upsert_mission quand l'heure ou la durée du motif a changé en édition.
-- generer_occurrences_recurrentes n'est PAS modifiée (contrat partagé intact).
--
-- updated_at : renseigné par le trigger générique set_updated_at de
-- mission_seances (sonde pt 128 A7) — aucun set manuel ici.
-- ============================================================================

-- Anti-surcharge : la signature exacte est droppée si elle existe (idempotence
-- du script ; fonction NOUVELLE, aucun appelant antérieur).
drop function if exists public.repropager_motif_seances(uuid, time, time, integer, integer);

create function public.repropager_motif_seances(
  p_mission_id     uuid,
  p_ancienne_heure time,
  p_nouvelle_heure time,
  p_ancienne_duree integer,
  p_nouvelle_duree integer
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nb int;
begin
  -- Garde d'écriture (admin | bureau), patron upsert_mission. Fail-loud.
  if not public._gs_peut_ecrire() then
    raise exception 'repropager_motif_seances: écriture refusée (admin|bureau requis)'
      using errcode = 'insufficient_privilege';
  end if;

  -- Mission introuvable = erreur explicite (jamais un UPDATE silencieux à vide
  -- sur un uuid fantôme).
  if not exists (select 1 from public.missions m where m.id = p_mission_id) then
    raise exception 'repropager_motif_seances: mission % introuvable', p_mission_id
      using errcode = 'no_data_found';
  end if;

  -- A' : occurrences FUTURES (la séance du jour incluse, décision déléguée
  -- tracée), encore `prevue`, encore alignées sur l'ANCIEN motif (heure
  -- identique, IS NOT DISTINCT FROM = NULL-sûr : un motif sans heure se
  -- repropage aussi). Les ajustements manuels (heure différente) sont épargnés.
  update public.mission_seances ms
     set heure_debut = p_nouvelle_heure,
         duree_min   = p_nouvelle_duree
   where ms.mission_id  = p_mission_id
     and ms.etat        = 'prevue'
     and ms.date_seance >= current_date
     and ms.heure_debut is not distinct from p_ancienne_heure;

  get diagnostics v_nb = row_count;
  return v_nb;
end;
$function$;

comment on function public.repropager_motif_seances(uuid, time, time, integer, integer) is
  'REPROPAGATION-HORAIRE-SEANCES (A'', 06/07/2026) : réaligne heure_debut/duree_min '
  'des occurrences futures encore prevue ET encore à l''ancienne heure du motif, '
  'après édition de la série (upsert_mission). Les éditions manuelles (heure '
  'différente), les realisee/validee/annulee et les dates passées sont épargnées. '
  'Retourne le nombre d''occurrences mises à jour. Garde _gs_peut_ecrire().';

-- ACL : patron maison (leçon pt 109) — REVOKE explicite public ET anon,
-- GRANT authenticated seul.
revoke all on function public.repropager_motif_seances(uuid, time, time, integer, integer) from public;
revoke all on function public.repropager_motif_seances(uuid, time, time, integer, integer) from anon;
grant execute on function public.repropager_motif_seances(uuid, time, time, integer, integer) to authenticated;

-- ============================================================================
-- VERIF fail-loud (motif v := (select ...) — l'éditeur SQL Supabase casse sur
-- select ... into dans un bloc do, leçon pt 130).
-- ============================================================================
do $verif$
declare
  v_nb_fn   int;
  v_secdef  boolean;
  v_anon    boolean;
  v_auth    boolean;
begin
  v_nb_fn := (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'repropager_motif_seances'
  );
  if v_nb_fn <> 1 then
    raise exception 'VERIF ÉCHEC : repropager_motif_seances attendue unique, trouvée % fois', v_nb_fn;
  end if;

  v_secdef := (
    select p.prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'repropager_motif_seances'
  );
  if not v_secdef then
    raise exception 'VERIF ÉCHEC : repropager_motif_seances doit être SECURITY DEFINER';
  end if;

  v_anon := (
    select has_function_privilege(
      'anon',
      'public.repropager_motif_seances(uuid, time, time, integer, integer)',
      'execute')
  );
  if v_anon then
    raise exception 'VERIF ÉCHEC : anon ne doit PAS pouvoir exécuter repropager_motif_seances';
  end if;

  v_auth := (
    select has_function_privilege(
      'authenticated',
      'public.repropager_motif_seances(uuid, time, time, integer, integer)',
      'execute')
  );
  if not v_auth then
    raise exception 'VERIF ÉCHEC : authenticated doit pouvoir exécuter repropager_motif_seances';
  end if;

  raise notice 'VERIF OK : repropager_motif_seances unique, SECDEF, anon refusé, authenticated accordé.';
end;
$verif$;
