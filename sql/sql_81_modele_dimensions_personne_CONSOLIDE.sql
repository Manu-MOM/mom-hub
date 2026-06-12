-- =====================================================================
-- pt 81 (chantier import pérenne) — Modèle des dimensions personne
-- Refonte structurelle : faits bruts + dérivation calculée + faits posés
-- =====================================================================
-- CONTEXTE : remplace le classement manuel fragile de `categorie_personne`
-- (cause racine du bug pt 80) par une dérivation calculée depuis les
-- qualités FFR brutes, encadrée de flags d'exception posés à la main.
--
-- ⚠️ FICHIER DE RÉFÉRENCE CONSOLIDÉ — récapitule ce qui a été appliqué en base
-- au fil de la session (exécuté par blocs, recetté à chaque étape).
-- Les blocs sont idempotents (if not exists / create or replace / gardes WHERE).
-- Le peuplement de qualites_ffr (Brique 2) est dans un fichier séparé :
--   sql_81_peuplement_qualites_ffr.sql (302 licences en VALUES).
--
-- ORDRE D'EXÉCUTION IMPÉRATIF (l'incident de session venait d'un désordre) :
--   1. Brique 1 (colonne qualites_ffr)          [ce fichier, bloc 1]
--   2. Peuplement                                [fichier séparé]
--   3. Brique 3 socle + est_staff_ffr/est_joueur [ce fichier, bloc 2]
--   4. Socle élargi ACF + staff_exclu + AMANI    [ce fichier, bloc 3]
--   5. est_staff_manuel + est_staff() COMPLÈTE   [ce fichier, bloc 4]  ← AVANT la bascule RPC
--   6. Bascule des pioches sur est_staff()       [ce fichier, bloc 5]
--   7. Volet B (parent, salarié, list_salaries)  [ce fichier, bloc 6]
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOC 1 — Brique 1 : colonne brute des qualités FFR (additive)
-- ---------------------------------------------------------------------
alter table public.personnes
  add column if not exists qualites_ffr text[];

comment on column public.personnes.qualites_ffr is
  'Codes qualité FFR bruts issus de l''export OVAL-E multi-qualités (Liste_Affilies). Source de vérité pour la dérivation d''éligibilité (est_staff, est_joueur). NULL = fiche sans licence (SportEasy).';


-- ---------------------------------------------------------------------
-- BLOC 2 — Brique 3 (initiale) : dérivation FFR
-- (socle initial SANS ACF — élargi au bloc 3)
-- ---------------------------------------------------------------------
create or replace function public.est_joueur_ffr(p_qualites text[])
returns boolean language sql immutable as $$
  select coalesce(p_qualites && array['A']::text[], false);
$$;


-- ---------------------------------------------------------------------
-- BLOC 3 — Socle staff élargi (ACF inclus — décision Manu, RÉVISE le pt 79)
--          + exclusion manuelle des scories OVAL-E (cas AMANI)
-- ---------------------------------------------------------------------
-- Socle staff validé : DC4, EDU, ECF, SOI, B, ACF
-- (ACF = arbitre en formation ; était EXCLU au pt 79, devient staff au pt 81)
create or replace function public.est_staff_ffr(p_qualites text[])
returns boolean language sql immutable as $$
  select coalesce(p_qualites && array['DC4','EDU','ECF','SOI','B','ACF']::text[], false);
$$;

alter table public.personnes
  add column if not exists staff_exclu boolean not null default false;

comment on column public.personnes.staff_exclu is
  'Exclusion manuelle de la dérivation staff (scorie de saisie OVAL-E, ex. AMANI qualité B née 2011). Posée à la main, jamais par import.';

update public.personnes
set staff_exclu = true
where nom = 'AMANI' and prenom = 'Ali Yannick'
  and qualites_ffr = array['B']::text[];


-- ---------------------------------------------------------------------
-- BLOC 4 — Staff posé hors-FFR (fiches SportEasy sans licence) + est_staff() COMPLÈTE
--          ⚠️ DOIT être exécuté AVANT la bascule des RPC (bloc 5)
-- ---------------------------------------------------------------------
alter table public.personnes
  add column if not exists est_staff_manuel boolean not null default false;

comment on column public.personnes.est_staff_manuel is
  'Staff posé hors OVAL-E (ex. encadrants SportEasy sans licence FFR). Fait posé à la main, JAMAIS dérivé ni touché par l''import OVAL-E. Pendant inverse de staff_exclu.';

-- Les fiches staff SportEasy sans qualités FFR (7 au moment du chantier)
update public.personnes
set est_staff_manuel = true
where categorie_personne ilike '%staff%'
  and qualites_ffr is null
  and not est_staff_manuel;

-- Dérivation effective : (socle FFR ET non exclu) OU staff posé à la main
create or replace function public.est_staff(p_personne_id uuid)
returns boolean language sql stable as $$
  select (est_staff_ffr(p.qualites_ffr) and not p.staff_exclu) or p.est_staff_manuel
  from public.personnes p
  where p.id = p_personne_id;
$$;


-- ---------------------------------------------------------------------
-- BLOC 5 — Bascule des pioches staff sur la dérivation est_staff()
--          (remplace le filtre categorie_personne ILIKE '%staff%')
-- ---------------------------------------------------------------------
-- 5.1 list_staff_disponibles
create or replace function public.list_staff_disponibles(p_categorie_id uuid default null::uuid)
returns table(personne_id uuid, nom text, prenom text)
language sql stable security definer
set search_path to 'public'
as $function$
  select distinct p.id as personne_id, p.nom, p.prenom
  from public.personnes p
  where public.has_role('admin')
    and public.est_staff(p.id)
    and (
      p_categorie_id is null
      or exists (
        select 1 from public.fonction_staff fs
        where fs.personne_id = p.id
          and fs.categorie_id = p_categorie_id
          and fs.date_fin is null
      )
    )
  order by p.nom asc, p.prenom asc;
$function$;

-- 5.2 list_personnes_preattribuables
--     (ancien filtre incluait OR ='dirigeant' ; est_staff() couvre déjà
--      les dirigeants licenciés via B/DC4 dans le socle — contrôle 63=63 prouvé)
create or replace function public.list_personnes_preattribuables()
returns table(personne_id uuid, nom text, prenom text, categorie_personne text)
language plpgsql security definer
set search_path to 'public'
as $function$
begin
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur.';
  end if;
  return query
    select p.id, p.nom, p.prenom, p.categorie_personne
    from public.personnes p
    where public.est_staff(p.id)
      and not exists (
        select 1 from public.auth_personne ap where ap.personne_id = p.id
      )
    order by p.nom, p.prenom;
end;
$function$;


-- ---------------------------------------------------------------------
-- BLOC 6 — Volet B : dimensions non-FFR (parent, salarié) en flags posés
-- ---------------------------------------------------------------------
-- 6.1 Flag parent — peuplé depuis le classement SportEasy existant (50 fiches)
alter table public.personnes
  add column if not exists est_parent boolean not null default false;

comment on column public.personnes.est_parent is
  'Dimension parent (origine SportEasy). Fait posé, non dérivable des qualités OVAL-E. Jamais touché par l''import OVAL-E.';

update public.personnes
set est_parent = true
where categorie_personne ilike '%parent%'
  and not est_parent;

-- 6.2 Flag salarié — Lohann seul aujourd'hui
alter table public.personnes
  add column if not exists est_salarie boolean not null default false;

comment on column public.personnes.est_salarie is
  'Dimension salarié (statut RH, hors FFR/SportEasy). Fait posé à la main, jamais dérivé. Source du picker salarié (onglet Missions).';

update public.personnes
set est_salarie = true
where id = '589e7977-748c-42db-b29c-0505ec0d2e41'  -- Humbert Lohann
  and not est_salarie;

-- 6.3 RPC pioche salarié — dégèle l'onglet Missions (conv salarié)
create or replace function public.list_salaries()
returns table(personne_id uuid, nom text, prenom text)
language sql stable security definer
set search_path to 'public'
as $function$
  select p.id as personne_id, p.nom, p.prenom
  from public.personnes p
  where public.has_role('admin')
    and p.est_salarie
  order by p.nom asc, p.prenom asc;
$function$;

revoke all on function public.list_salaries() from public;
grant execute on function public.list_salaries() to authenticated;

-- =====================================================================
-- FIN — état recetté : convergence dérivation ↔ classement = 63/63 (staff),
-- 50 parents, 1 salarié. Pioches branchées sur est_staff() sans perte.
-- =====================================================================
