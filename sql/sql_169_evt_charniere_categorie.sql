-- =====================================================================
-- sql_169 — EVT-RATTACHEMENT-CATEGORIE — Étape 3/7 : charnière RLS
-- =====================================================================
-- _b5_categorie_de_evenement lit désormais categorie_id EN DIRECT.
-- Filet COALESCE vers l'ancien chemin (via equipe_id) pour tout événement
-- dont categorie_id serait null en transition. Cette fonction gouverne les
-- policies RLS (puis_je_ecrire_categorie(_b5_categorie_de_evenement(id))) :
-- ne basculer qu'APRÈS remplissage complet (étape 2). Fait.
--
-- Exécuté et vérifié : 0 incohérence colonne vs ancien chemin sur 31 événts.
-- =====================================================================

create or replace function public._b5_categorie_de_evenement(p_evenement_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
           ev.categorie_id,
           public._b5_categorie_de_equipe(ev.equipe_id)
         )
  from public.evenements ev
  where ev.id = p_evenement_id;
$function$;

do $check$
declare v_incoherents int;
begin
  select count(*) into v_incoherents
  from public.evenements ev
  where ev.equipe_id is not null
    and ev.categorie_id is not null
    and ev.categorie_id <> public._b5_categorie_de_equipe(ev.equipe_id);
  if v_incoherents > 0 then
    raise exception 'ABORT sql_169 : % événement(s) avec categorie_id != catégorie de equipe_id', v_incoherents;
  end if;
  raise notice 'sql_169 OK : charnière sur categorie_id, 0 incohérence.';
end
$check$;
