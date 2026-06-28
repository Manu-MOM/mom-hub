-- =============================================================================
-- sql_132_list_prospection_pour_salarie.sql
-- Module B « Prospection » — Brique 4 : RPC de LECTURE pour la surface EXÉCUTANT.
--
-- Lohann n'est ni admin ni bureau : les RPC CRM (list_entites, upsert_entite,
-- list_prospection_contacts) sont gardées _gs_peut_ecrire() -> il ne peut pas les
-- appeler. Cette RPC dédiée lui ouvre la LECTURE de l'état de démarchage des écoles,
-- avec une garde « bureau OU salarié » (patron declarer_occurrence, sonde S-GD).
--
-- DÉCISION DE MODÈLE (conv production, Option B retenue avec Manu) : le MOTEUR DE
-- PRIORITÉ vit côté FRONT (JS), pas ici. Cette RPC ne hiérarchise rien : elle
-- LIT et expose les colonnes strictement utiles au moteur (libellé, contact,
-- statut, + date de relance dérivée du dernier contact daté). Le front choisit
-- LA carte. Justification : ordre de priorité « pressenti, non figé » (FAIT FOI
-- §3.4) -> on garde l'ajustabilité sans nouveau SQL ; cohérent avec la doctrine
-- maison « agrégation/logique front » (gestion-salarie, Brique 3).
--
-- PÉRIMÈTRE DE LECTURE (anti sur-exposition) : seulement les écoles démarchables
-- (types scolaires) et seulement les colonnes du geste. AUCUNE donnée de
-- facturation (siret, raison_sociale, montants) n'est renvoyée. RGPD-lock intact
-- (entités-écoles, pas personnes).
--
-- Invariants reconduits : SECURITY DEFINER + set search_path 'public' +
-- REVOKE public/anon + GRANT authenticated + do $verif$ fail-loud + motif
-- v := (select ...) (éditeur Supabase casse sur select ... into dans do $tag$).
-- =============================================================================

create or replace function public.list_prospection_pour_salarie()
returns table (
  entite_id           uuid,
  libelle             text,
  type_entite         text,
  contact_nom         text,
  contact_email       text,
  statut_prospection  text,
  derniere_relance    date,   -- max(date_relance) des contacts (alimente le moteur JS)
  dernier_contact     date,   -- max(date_contact) : date du dernier échange
  nb_contacts         integer -- volume d'échanges journalisés (interesse « sans suite »)
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Garde « bureau OU salarié » (patron declarer_occurrence, sonde S-GD).
  -- Pas de comparaison d'identité ici : la carte-geste concerne TOUT le démarchage,
  -- pas une mission ciblée -> suis_je_salarie() suffit (≠ declarer_occurrence qui
  -- comparait v_me = v_salarie pour une occurrence précise).
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
      coalesce(agg.nb_contacts, 0)::integer
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

-- Permissions ---------------------------------------------------------------
revoke all on function public.list_prospection_pour_salarie() from public;
revoke all on function public.list_prospection_pour_salarie() from anon;
grant execute on function public.list_prospection_pour_salarie() to authenticated;

-- Vérification fail-loud ----------------------------------------------------
-- Motif v := (select ...) impose : l'editeur SQL Supabase casse sur
-- « select ... into v » dans un do $tag$ (relation "v" does not exist).
do $verif$
declare
  v_exists boolean;
begin
  v_exists := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_prospection_pour_salarie'
  ));
  if not v_exists then
    raise exception 'VERIF: list_prospection_pour_salarie absente apres creation.';
  end if;

  -- Les deux fonctions de garde existent (dependance dure).
  v_exists := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suis_je_salarie'
  ));
  if not v_exists then
    raise exception 'VERIF: dependance suis_je_salarie introuvable.';
  end if;

  v_exists := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '_gs_peut_ecrire'
  ));
  if not v_exists then
    raise exception 'VERIF: dependance _gs_peut_ecrire introuvable.';
  end if;

  raise notice 'VERIF OK : list_prospection_pour_salarie en place (garde bureau OU salarie).';
end;
$verif$;
