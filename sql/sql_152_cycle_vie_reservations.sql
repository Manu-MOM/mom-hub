-- ============================================================
-- sql_152_cycle_vie_reservations.sql — MOM Hub
-- Chantier LOGISTIQUE-CYCLE-VIE-RESERVATIONS — volet 2 (B1-B7)
-- FAIT FOI gelé le 04/07/2026, md5 b59b44d979e1192463873a55d5755c3e
-- PRÉREQUIS : sql_151 exécuté (colonne date_debut, consommée par
--             modifier_recurrence).
-- ============================================================
-- Objet :
--   1. Statut 'cancelled' ajouté au CHECK des 3 tables de demandes
--      (DROP + ADD, mêmes noms de contraintes — B5).
--   2. 6 RPC SECURITY DEFINER, patron valider_* répliqué (S2) :
--      modifier_reservation / modifier_recurrence / modifier_bus
--      annuler_reservation / annuler_recurrence / annuler_bus
-- Gardes (B1/B6) :
--   - bureau|admin : plein droit (patron valider_*, hors B5) ;
--   - sinon demandeur propriétaire (responsable_personne_id =
--     qui_suis_je(), fonction TABLE(personne_id uuid) — sonde 04/07),
--     soumis B5 sur la catégorie CIBLE pour les modifier_*
--     (puis_je_ecrire_categorie, l'édition ne contourne pas l'INSERT).
-- Effets (B2/B5) :
--   - modifier_* : UPDATE DUR de TOUS les champs métier (B7, pas de
--     COALESCE — le front ré-émet tout) + statut='pending',
--     motif_refus/valide_par/valide_le purgés, modifie_par/updated_at
--     écrits. Une ligne 'cancelled' n'est PAS modifiable (re-création).
--   - annuler_* : statut='cancelled' quel que soit le statut courant
--     (sauf déjà 'cancelled' → refus net), modifie_par/updated_at
--     écrits, champs de validation CONSERVÉS (trace de qui avait
--     validé — décision tracée FAIT FOI §3.5).
-- Décisions techniques tracées :
--   - responsable_personne_id IMMUABLE dans les 3 modifier_* (transfert
--     de propriété hors périmètre v1 ; aligne le bus sur les signatures
--     gelées ponctuelle/règle).
--   - active (récurrentes) non touché par modifier_recurrence : la
--     suspension reste l'affaire de set_recurrence_active.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Statut 'cancelled' (B5) — 3 contraintes CHECK recréées
-- ------------------------------------------------------------

alter table public.reservations_logistiques
drop constraint reservations_logistiques_statut_check;

alter table public.reservations_logistiques
add constraint reservations_logistiques_statut_check
check (
    statut = any (
        array['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]
    )
);

alter table public.reservations_recurrentes
drop constraint reservations_recurrentes_statut_check;

alter table public.reservations_recurrentes
add constraint reservations_recurrentes_statut_check
check (
    statut = any (
        array['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]
    )
);

alter table public.demandes_bus
drop constraint demandes_bus_statut_check;

alter table public.demandes_bus
add constraint demandes_bus_statut_check
check (
    statut = any (
        array['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]
    )
);

-- ------------------------------------------------------------
-- 2. modifier_reservation
-- ------------------------------------------------------------

create or replace function public.modifier_reservation(
    p_reservation_id uuid,
    p_ressource_id uuid,
    p_categorie_id uuid,
    p_date date,
    p_heure_debut time,
    p_heure_fin time,
    p_motif text default null
)
returns public.reservations_logistiques
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.reservations_logistiques;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.reservations_logistiques
   where id = p_reservation_id;
  if not found then
    raise exception 'Reservation introuvable : %', p_reservation_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Modification refusee : demande annulee (re-creer une demande).';
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Modification refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
    if not public.puis_je_ecrire_categorie(p_categorie_id) then
      raise exception 'Modification refusee : categorie cible non autorisee (B5)'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.reservations_logistiques
     set ressource_id = p_ressource_id,
         categorie_id = p_categorie_id,
         date         = p_date,
         heure_debut  = p_heure_debut,
         heure_fin    = p_heure_fin,
         motif        = p_motif,
         statut       = 'pending',
         motif_refus  = null,
         valide_par   = null,
         valide_le    = null,
         modifie_par  = auth.uid(),
         updated_at   = now()
   where id = p_reservation_id
   returning * into v_row;

  return v_row;
end $function$;

-- ------------------------------------------------------------
-- 3. modifier_recurrence
-- ------------------------------------------------------------

create or replace function public.modifier_recurrence(
    p_recurrence_id uuid,
    p_ressource_id uuid,
    p_categorie_id uuid,
    p_freq text,
    p_jours integer [],
    p_heure_debut time,
    p_heure_fin time,
    p_date_debut date,
    p_date_fin date,
    p_motif text default null
)
returns public.reservations_recurrentes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.reservations_recurrentes;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.reservations_recurrentes
   where id = p_recurrence_id;
  if not found then
    raise exception 'Regle recurrente introuvable : %', p_recurrence_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Modification refusee : regle annulee (re-creer une regle).';
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Modification refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
    if not public.puis_je_ecrire_categorie(p_categorie_id) then
      raise exception 'Modification refusee : categorie cible non autorisee (B5)'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.reservations_recurrentes
     set ressource_id = p_ressource_id,
         categorie_id = p_categorie_id,
         freq         = p_freq,
         jours        = p_jours,
         heure_debut  = p_heure_debut,
         heure_fin    = p_heure_fin,
         date_debut   = p_date_debut,
         date_fin     = p_date_fin,
         motif        = p_motif,
         statut       = 'pending',
         motif_refus  = null,
         valide_par   = null,
         valide_le    = null,
         modifie_par  = auth.uid(),
         updated_at   = now()
   where id = p_recurrence_id
   returning * into v_row;

  return v_row;
end $function$;

-- ------------------------------------------------------------
-- 4. modifier_bus (16 champs métier — responsable_personne_id immuable)
-- ------------------------------------------------------------

create or replace function public.modifier_bus(
    p_demande_id uuid,
    p_categorie_id uuid,
    p_date date,
    p_type_competition text,
    p_destination text,
    p_heure_arrivee_souhaitee time,
    p_retour_depart time,
    p_retour_arrivee time,
    p_arrets_aller jsonb,
    p_arrets_retour jsonb,
    p_delegations jsonb,
    p_pax_joueurs integer,
    p_pax_staff integer,
    p_total_mom integer,
    p_total_deleg integer,
    p_total_bus integer,
    p_notes text default null
)
returns public.demandes_bus
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.demandes_bus;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.demandes_bus
   where id = p_demande_id;
  if not found then
    raise exception 'Demande de bus introuvable : %', p_demande_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Modification refusee : demande annulee (re-creer une demande).';
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Modification refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
    if not public.puis_je_ecrire_categorie(p_categorie_id) then
      raise exception 'Modification refusee : categorie cible non autorisee (B5)'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.demandes_bus
     set categorie_id            = p_categorie_id,
         date                    = p_date,
         type_competition        = p_type_competition,
         destination             = p_destination,
         heure_arrivee_souhaitee = p_heure_arrivee_souhaitee,
         retour_depart           = p_retour_depart,
         retour_arrivee          = p_retour_arrivee,
         arrets_aller            = p_arrets_aller,
         arrets_retour           = p_arrets_retour,
         delegations             = p_delegations,
         pax_joueurs             = p_pax_joueurs,
         pax_staff               = p_pax_staff,
         total_mom               = p_total_mom,
         total_deleg             = p_total_deleg,
         total_bus               = p_total_bus,
         notes                   = p_notes,
         statut                  = 'pending',
         motif_refus             = null,
         valide_par              = null,
         valide_le               = null,
         modifie_par             = auth.uid(),
         updated_at              = now()
   where id = p_demande_id
   returning * into v_row;

  return v_row;
end $function$;

-- ------------------------------------------------------------
-- 5. annuler_reservation / annuler_recurrence / annuler_bus
-- ------------------------------------------------------------

create or replace function public.annuler_reservation(
    p_reservation_id uuid
)
returns public.reservations_logistiques
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.reservations_logistiques;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.reservations_logistiques
   where id = p_reservation_id;
  if not found then
    raise exception 'Reservation introuvable : %', p_reservation_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Demande deja annulee : %', p_reservation_id;
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Annulation refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.reservations_logistiques
     set statut      = 'cancelled',
         modifie_par = auth.uid(),
         updated_at  = now()
   where id = p_reservation_id
   returning * into v_row;

  return v_row;
end $function$;

create or replace function public.annuler_recurrence(
    p_recurrence_id uuid
)
returns public.reservations_recurrentes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.reservations_recurrentes;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.reservations_recurrentes
   where id = p_recurrence_id;
  if not found then
    raise exception 'Regle recurrente introuvable : %', p_recurrence_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Regle deja annulee : %', p_recurrence_id;
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Annulation refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.reservations_recurrentes
     set statut      = 'cancelled',
         modifie_par = auth.uid(),
         updated_at  = now()
   where id = p_recurrence_id
   returning * into v_row;

  return v_row;
end $function$;

create or replace function public.annuler_bus(
    p_demande_id uuid
)
returns public.demandes_bus
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.demandes_bus;
  v_est_bureau boolean;
  v_moi uuid;
begin
  select * into v_row
    from public.demandes_bus
   where id = p_demande_id;
  if not found then
    raise exception 'Demande de bus introuvable : %', p_demande_id;
  end if;

  if v_row.statut = 'cancelled' then
    raise exception 'Demande deja annulee : %', p_demande_id;
  end if;

  v_est_bureau := (public.has_role('bureau') or public.has_role('admin'));
  if not v_est_bureau then
    v_moi := (select personne_id from public.qui_suis_je());
    if v_moi is null or v_row.responsable_personne_id is distinct from v_moi then
      raise exception 'Annulation refusee : role bureau|admin ou demandeur proprietaire requis'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.demandes_bus
     set statut      = 'cancelled',
         modifie_par = auth.uid(),
         updated_at  = now()
   where id = p_demande_id
   returning * into v_row;

  return v_row;
end $function$;

-- ------------------------------------------------------------
-- 6. Droits d'exécution (patron du domaine : authenticated seul)
-- ------------------------------------------------------------

revoke all on function public.modifier_reservation(
    uuid, uuid, uuid, date, time, time, text
) from public, anon;
grant execute on function public.modifier_reservation(
    uuid, uuid, uuid, date, time, time, text
) to authenticated;

revoke all on function public.modifier_recurrence(
    uuid, uuid, uuid, text, integer [], time, time, date, date, text
) from public, anon;
grant execute on function public.modifier_recurrence(
    uuid, uuid, uuid, text, integer [], time, time, date, date, text
) to authenticated;

revoke all on function public.modifier_bus(
    uuid, uuid, date, text, text, time, time, time, jsonb, jsonb, jsonb,
    integer, integer, integer, integer, integer, text
) from public, anon;
grant execute on function public.modifier_bus(
    uuid, uuid, date, text, text, time, time, time, jsonb, jsonb, jsonb,
    integer, integer, integer, integer, integer, text
) to authenticated;

revoke all on function public.annuler_reservation(uuid) from public, anon;
grant execute on function public.annuler_reservation(uuid) to authenticated;

revoke all on function public.annuler_recurrence(uuid) from public, anon;
grant execute on function public.annuler_recurrence(uuid) to authenticated;

revoke all on function public.annuler_bus(uuid) from public, anon;
grant execute on function public.annuler_bus(uuid) to authenticated;

-- ============================================================
-- Vérification fail-loud
-- ============================================================
do $verif$
declare
    v_fonctions integer;
    v_checks integer;
begin
    v_fonctions := (
        select count(*)
        from pg_proc as p
        inner join pg_namespace as n on p.pronamespace = n.oid
        where n.nspname = 'public'
            and p.proname in (
                'modifier_reservation', 'modifier_recurrence', 'modifier_bus',
                'annuler_reservation', 'annuler_recurrence', 'annuler_bus'
            )
            and p.prosecdef
    );
    if v_fonctions <> 6 then
        raise exception
            'sql_152 ECHEC : 6 fonctions SECURITY DEFINER attendues, trouvees %.',
            v_fonctions;
    end if;

    v_checks := (
        select count(*)
        from pg_constraint
        where contype = 'c'
            and conname in (
                'reservations_logistiques_statut_check',
                'reservations_recurrentes_statut_check',
                'demandes_bus_statut_check'
            )
            and pg_get_constraintdef(oid) like '%cancelled%'
    );
    if v_checks <> 3 then
        raise exception
            'sql_152 ECHEC : 3 contraintes statut avec cancelled attendues, trouvees %.',
            v_checks;
    end if;

    raise notice
        'sql_152 OK : 6 RPC SECURITY DEFINER en place, statut cancelled admis sur les 3 tables.';
end
$verif$;
