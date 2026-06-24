-- =====================================================================
-- sql_109_list_staff_disponibles_garde_encadrant.sql
-- ---------------------------------------------------------------------
-- ÉLARGISSEMENT DE GARDE  list_staff_disponibles  (recette terrain)
--
-- OBJET : la RPC list_staff_disponibles est gardée has_role('admin').
--   Le module Préparation de séance (coach par bloc, encadrant_id) doit
--   pouvoir peupler sa pioche de coachs pour les ENCADRANTS sportifs
--   (voie 2), pas seulement les admins. On élargit donc la garde à
--   admin | bureau | encadrant, en RECOPIANT le corps À L'IDENTIQUE
--   depuis la source (pg_get_functiondef) — SEULE la condition de garde
--   du WHERE change. Même esprit que sql_93 (ouverture get_noms_personnes).
--
-- PORTÉE :
--   - WHERE : has_role('admin')
--             -> (has_role('admin') OR has_role('bureau') OR has_role('encadrant'))
--   - Tout le reste du corps (est_staff, filtre catégorie via fonction_staff,
--     tri) est INCHANGÉ.
--
-- APPELANTS CONNUS (cartographiés à la source) :
--   - js/evenements-browser.js (gestion staff événement) — élargir la
--     garde ne lui retire RIEN ; lui donne accès aux encadrants en plus.
--   - js/seance-editor.js (coach par bloc, v1.10) — bénéficiaire visé.
--   Aucun appelant ne perd l'accès (élargissement strict).
--
-- RGPD : la sortie reste (personne_id, nom, prenom) du STAFF uniquement
--   (est_staff). On ouvre aux encadrants sportifs, déjà habilités à voir
--   le staff dans le cadre de leur fonction. Pas d'ouverture au public.
--
-- IDEMPOTENT (CREATE OR REPLACE) — fail-loud (bloc DO $verif$ finale).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. RPC list_staff_disponibles — corps RECOPIÉ À L'IDENTIQUE depuis la
--    source, SEULE la garde du WHERE est élargie.
-- ---------------------------------------------------------------------
create or replace function public.list_staff_disponibles(p_categorie_id uuid default null::uuid)
 returns table(personne_id uuid, nom text, prenom text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select distinct p.id as personne_id, p.nom, p.prenom
  from public.personnes p
  where (public.has_role('admin') or public.has_role('bureau') or public.has_role('encadrant'))
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

-- ---------------------------------------------------------------------
-- 2. FAIL-LOUD — la garde élargie est-elle bien en place ?
--    Lève si la définition ne contient pas les 3 rôles attendus.
-- ---------------------------------------------------------------------
do $verif$
declare
  v_def text;
begin
  v_def := (
    select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_staff_disponibles'
  );

  if v_def is null then
    raise exception 'FAIL-LOUD: list_staff_disponibles introuvable après remplacement.';
  end if;
  if v_def not ilike '%has_role(''bureau'')%' then
    raise exception 'FAIL-LOUD: garde bureau absente de list_staff_disponibles.';
  end if;
  if v_def not ilike '%has_role(''encadrant'')%' then
    raise exception 'FAIL-LOUD: garde encadrant absente de list_staff_disponibles.';
  end if;
  if v_def not ilike '%est_staff%' then
    raise exception 'FAIL-LOUD: filtre est_staff perdu — le corps a été altéré au-delà de la garde.';
  end if;

  raise notice 'OK sql_109 : list_staff_disponibles ouverte à admin|bureau|encadrant (est_staff préservé).';
end;
$verif$;

commit;
