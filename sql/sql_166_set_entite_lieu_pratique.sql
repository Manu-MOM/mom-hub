-- ============================================================================
-- sql_166_set_entite_lieu_pratique.sql
-- Chantier LIEU-MISSION (FAIT FOI gelé le 06/07/2026 — L5, réversibilité R1)
--
-- CONTEXTE : la fiche école porte « Lieu de pratique envisagé »
-- (entites.lieu_pratique, sql_159) « à collecter au premier contact ». La
-- saisie d'une mission pour une école EST souvent ce premier contact : quand
-- un lieu LIBRE est saisi dans la modale mission (suivi-salarie.html), il doit
-- remonter sur la fiche de l'école — SANS JAMAIS écraser un lieu déjà
-- renseigné (R1 : un lieu ponctuel de mission n'écrase pas le lieu de
-- référence).
--
-- CETTE RPC : écrit LA SEULE colonne lieu_pratique, et UNIQUEMENT si elle est
-- actuellement vide (le non-écrasement est garanti côté SQL, y compris en
-- concurrence). Retourne true si écrit, false sinon (déjà renseignée, entité
-- introuvable ou p_lieu vide — appel de confort fail-soft, décision tracée :
-- pas d'exception « introuvable », le front est fail-soft isolé et la mission
-- est déjà enregistrée quand la RPC est appelée).
--
-- ÉCARTÉ TRACÉ : ré-émettre upsert_entite (UPDATE dur à 23 paramètres) depuis
-- la modale mission — un seul champ mal mappé écraserait la fiche école.
-- Garde : _gs_peut_ecrire() (admin|bureau), même porte qu'upsert_entite.
-- ============================================================================

drop function if exists public.set_entite_lieu_pratique(uuid, text);

create function public.set_entite_lieu_pratique(
  p_entite_id uuid,
  p_lieu      text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nb int;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'set_entite_lieu_pratique: écriture refusée (admin|bureau requis)'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(p_lieu), '') = '' then
    return false;
  end if;

  update public.entites e
     set lieu_pratique = btrim(p_lieu)
   where e.id = p_entite_id
     and coalesce(btrim(e.lieu_pratique), '') = '';

  get diagnostics v_nb = row_count;
  return v_nb > 0;
end;
$function$;

comment on function public.set_entite_lieu_pratique(uuid, text) is
  'LIEU-MISSION L5/R1 (06/07/2026) : renseigne entites.lieu_pratique depuis la '
  'modale mission UNIQUEMENT si le champ est vide (collecte au premier contact, '
  'jamais d''écrasement — garanti dans le WHERE). Retourne true si écrit. '
  'Garde _gs_peut_ecrire().';

revoke all on function public.set_entite_lieu_pratique(uuid, text) from public;
revoke all on function public.set_entite_lieu_pratique(uuid, text) from anon;
grant execute on function public.set_entite_lieu_pratique(uuid, text) to authenticated;

-- ============================================================================
-- VERIF fail-loud (motif v := (select ...), leçon pt 130)
-- ============================================================================
do $verif$
declare
  v_nb_fn  int;
  v_secdef boolean;
  v_anon   boolean;
  v_auth   boolean;
begin
  v_nb_fn := (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_entite_lieu_pratique'
  );
  if v_nb_fn <> 1 then
    raise exception 'VERIF ÉCHEC : set_entite_lieu_pratique attendue unique, trouvée % fois', v_nb_fn;
  end if;

  v_secdef := (
    select p.prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_entite_lieu_pratique'
  );
  if not v_secdef then
    raise exception 'VERIF ÉCHEC : set_entite_lieu_pratique doit être SECURITY DEFINER';
  end if;

  v_anon := (
    select has_function_privilege('anon',
      'public.set_entite_lieu_pratique(uuid, text)', 'execute')
  );
  if v_anon then
    raise exception 'VERIF ÉCHEC : anon ne doit PAS pouvoir exécuter set_entite_lieu_pratique';
  end if;

  v_auth := (
    select has_function_privilege('authenticated',
      'public.set_entite_lieu_pratique(uuid, text)', 'execute')
  );
  if not v_auth then
    raise exception 'VERIF ÉCHEC : authenticated doit pouvoir exécuter set_entite_lieu_pratique';
  end if;

  raise notice 'VERIF OK : set_entite_lieu_pratique unique, SECDEF, anon refusé, authenticated accordé.';
end;
$verif$;
