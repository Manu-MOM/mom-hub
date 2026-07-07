-- =====================================================================
-- sql_168 — EVT-RATTACHEMENT-CATEGORIE — Étape 2/7 : remplissage categorie_id
-- =====================================================================
-- Renseigne categorie_id des événements existants depuis l'équipe actuelle
-- (chemin equipe -> entente -> categorie_id). Puis complète les compétitions
-- sans equipe_id racine via les équipes engagées (M3), quand elles relèvent
-- d'une seule catégorie. Idempotent (WHERE categorie_id IS NULL).
--
-- Exécuté et vérifié : 31/31 événements rattachés, 0 orphelin.
-- =====================================================================

-- (a) depuis l'équipe racine
update public.evenements ev
set categorie_id = ent.categorie_id
from public.equipes e
join public.ententes ent on ent.id = e.entente_id
where ev.equipe_id = e.id
  and ev.categorie_id is null
  and ev.equipe_id is not null;

-- (b) compétitions sans equipe_id racine : déduites des équipes engagées
--     (uniquement si UNE seule catégorie parmi les engagées)
update public.evenements ev
set categorie_id = sub.cat
from (
  select x.evenement_id,
         (array_agg(distinct ent.categorie_id))[1] as cat,
         count(distinct ent.categorie_id) as nb_cat
  from public.evenement_equipes_engagees x
  join public.equipes e on e.id = x.equipe_id
  join public.ententes ent on ent.id = e.entente_id
  group by x.evenement_id
  having count(distinct ent.categorie_id) = 1
) sub
where ev.id = sub.evenement_id
  and ev.categorie_id is null;

-- Vérif fail-loud : aucun entrainement/stage sans catégorie
do $check$
declare v_manquants int;
begin
  select count(*) into v_manquants
  from public.evenements
  where type_evenement in ('entrainement','stage') and categorie_id is null;
  if v_manquants > 0 then
    raise exception 'ABORT sql_168 : % entrainement(s)/stage(s) sans categorie_id', v_manquants;
  end if;
  raise notice 'sql_168 OK : remplissage terminé, 0 entrainement/stage sans catégorie.';
end
$check$;
