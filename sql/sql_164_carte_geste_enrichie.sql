-- =============================================================================
-- sql_164_carte_geste_enrichie.sql
-- Module B « Prospection » — Brique 4 : la carte-geste de Lohann recoit les
-- donnees injectees par sql_159/160/162 (FAIT FOI conv 05/07/2026, points 1+2 ;
-- le point 3 — journalisation par le salarie — reste explicitement FERME,
-- FAIT FOI conception §3.1 inchange).
--
-- 1) list_prospection_pour_salarie : +4 colonnes de geste (telephone, commune,
--    zone, lieu_pratique). RETURNS TABLE change => DROP + recreation obligatoire
--    (piege CREATE OR REPLACE / RETURNS TABLE trace sql_143). Garde, perimetre
--    anti-surexposition (aucune donnee de facturation) et ORDER BY inchanges.
-- 2) list_prospection_contacts_internes : garde elargie a « bureau OU salarie »
--    (patron sql_132) — LECTURE seule ; insertion et suppression restent
--    gardees _gs_peut_ecrire() (bureau/admin), non touchees ici.
--
-- Invariants reconduits : SECURITY DEFINER + set search_path 'public' +
-- REVOKE public/anon + GRANT authenticated + do $verif$ fail-loud + motif
-- v := (select ...).
-- =============================================================================

-- 1) RPC de lecture salarie : DROP + recreation (RETURNS TABLE etendu) --------
drop function if exists public.list_prospection_pour_salarie();

create or replace function public.list_prospection_pour_salarie()
returns table (
  entite_id           uuid,
  libelle             text,
  type_entite         text,
  contact_nom         text,
  contact_email       text,
  statut_prospection  text,
  derniere_relance    date,
  dernier_contact     date,
  nb_contacts         integer,
  telephone           text,   -- sql_159 : le geste « appeler » depuis la carte
  commune             text,   -- sql_159 : situer l'ecole d'un coup d'oeil
  zone                text,   -- sql_159 : tri secondaire de proximite (front)
  lieu_pratique       text    -- sql_159 : lieu de pratique envisage (OODA)
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public._gs_peut_ecrire() or public.suis_je_salarie()) then
    raise exception 'Réservé à l''administration ou au salarié.';
  end if;

  return query
    select
      e.id,
      e.libelle,
      e.type_entite,
      e.contact_nom,
      e.contact_email,
      e.statut_prospection,
      agg.derniere_relance,
      agg.dernier_contact,
      coalesce(agg.nb_contacts, 0)::integer,
      e.telephone,
      e.commune,
      e.zone,
      e.lieu_pratique
    from public.entites e
    left join lateral (
      select
        max(pc.date_relance) as derniere_relance,
        max(pc.date_contact) as dernier_contact,
        count(*)             as nb_contacts
      from public.prospection_contacts pc
      where pc.entite_id = e.id
    ) agg on true
    where e.type_entite in ('ecole_elementaire', 'college', 'lycee')
      and e.actif is not false
    order by e.libelle;
end;
$function$;

revoke all on function public.list_prospection_pour_salarie() from public;
revoke all on function public.list_prospection_pour_salarie() from anon;
grant execute on function public.list_prospection_pour_salarie() to authenticated;

-- 2) Lecture des contacts internes ouverte au salarie ---------------------------
-- Signature inchangee => CREATE OR REPLACE suffit. Seule la garde change :
-- _gs_peut_ecrire() devient (_gs_peut_ecrire() OR suis_je_salarie()).
create or replace function public.list_prospection_contacts_internes(
  p_entite_id uuid
)
returns setof public.prospection_contacts_internes
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public._gs_peut_ecrire() or public.suis_je_salarie()) then
    raise exception 'Réservé à l''administration ou au salarié.';
  end if;

  if p_entite_id is null then
    raise exception 'entite_id obligatoire pour lister les contacts internes.';
  end if;

  return query
    select ci.*
      from public.prospection_contacts_internes ci
     where ci.entite_id = p_entite_id
     order by ci.classe nulls last, ci.nom;
end;
$function$;

revoke all on function public.list_prospection_contacts_internes(uuid) from public;
revoke all on function public.list_prospection_contacts_internes(uuid) from anon;
grant execute on function public.list_prospection_contacts_internes(uuid) to authenticated;

-- 3) Verification fail-loud -------------------------------------------------------
do $verif$
declare
  v_ok  boolean;
  v_def text;
begin
  v_def := (select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_prospection_pour_salarie');
  if v_def is null then
    raise exception 'VERIF: list_prospection_pour_salarie absente apres recreation.';
  end if;
  if position('lieu_pratique' in v_def) = 0 then
    raise exception 'VERIF: list_prospection_pour_salarie sans les nouvelles colonnes.';
  end if;

  v_def := (select pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_prospection_contacts_internes');
  if v_def is null then
    raise exception 'VERIF: list_prospection_contacts_internes absente.';
  end if;
  if position('suis_je_salarie' in v_def) = 0 then
    raise exception 'VERIF: garde salarie non elargie sur les contacts internes.';
  end if;

  -- Les gardes d'insertion/suppression restent bureau-only (non touchees).
  v_ok := (select position('suis_je_salarie' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'inserer_prospection_contact_interne');
  if not v_ok then
    raise exception 'VERIF: la garde d''insertion des contacts internes a ete alteree.';
  end if;

  raise notice 'VERIF OK : carte-geste enrichie (RPC +4 colonnes, lecture internes ouverte au salarie).';
end;
$verif$;
