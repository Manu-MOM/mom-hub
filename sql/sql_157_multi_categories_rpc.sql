-- ============================================================================
-- sql_157 — LOGISTIQUE-MULTI-CATEGORIES — RPC modifier_*
-- FAIT FOI gelé 05/07/2026 (M4). Base : sql_156 exécuté et contre-sondé.
--
-- Les 3 modifier_* reçoivent un paramètre FINAL additif
--   p_categorie_ids uuid[] DEFAULT NULL
--   NULL → dérivé du scalaire p_categorie_id (rétro-compat TOTALE des appels
--   v1.76, qui continuent de fonctionner sans changement).
-- La garde du propriétaire non-bureau passe de puis_je_ecrire_categorie
-- (scalaire, INTACTE en base) à puis_je_ecrire_categories (tableau, M2 souple).
-- L'UPDATE écrit les DEUX colonnes (tableau + scalaire synchronisé = premier
-- élément) — cohérent avec le trigger T1 de sql_156.
--
-- ⚠️ ÉCART M4 TRACÉ (validé par Manu avant exécution) :
-- ajouter un paramètre par CREATE OR REPLACE créerait une SURCHARGE (l'ancienne
-- signature resterait en base) → PostgREST ne saurait plus router les appels
-- nommés (ambiguïté PGRST203). L'intention du M4 gelé (zéro rupture d'appel)
-- est obtenue par DROP + CREATE des anciennes signatures DANS LA MÊME
-- TRANSACTION : fenêtre de rupture nulle, et les appels v1.76 (sans le nouveau
-- paramètre) matchent la nouvelle signature grâce au DEFAULT.
-- ACL re-déclarées à l'identique (sondées 05/07 : anon exclu, authenticated).
-- ============================================================================

begin;

-- ============================================================================
-- §1 — DROP des anciennes signatures (recréées immédiatement ci-dessous,
--       même transaction — fenêtre de rupture nulle)
-- ============================================================================

drop function if exists public.modifier_reservation(
    uuid, uuid, uuid, date,
    time without time zone, time without time zone, text
);

drop function if exists public.modifier_recurrence(
    uuid, uuid, uuid, text, integer [],
    time without time zone, time without time zone, date, date, text
);

drop function if exists public.modifier_bus(
    uuid, uuid, date, text, text,
    time without time zone, time without time zone, time without time zone,
    jsonb, jsonb, jsonb,
    integer, integer, integer, integer, integer, text
);

-- ============================================================================
-- §2 — modifier_reservation (corps sql_152 relu en sonde S2, DEUX ajouts :
--       paramètre final + garde/écriture tableau. Rien d'autre ne bouge.)
-- ============================================================================

create function public.modifier_reservation(
    p_reservation_id uuid,
    p_ressource_id uuid,
    p_categorie_id uuid,
    p_date date,
    p_heure_debut time without time zone,
    p_heure_fin time without time zone,
    p_motif text default null,
    p_categorie_ids uuid [] default null
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
  v_categorie_ids uuid [];
begin
  -- Dérivation rétro-compatible : appel v1.76 (sans tableau) → tableau
  -- reconstruit depuis le scalaire ; scalaire NULL → '{}' (Bureau/Autre, M3).
  v_categorie_ids := coalesce(
    p_categorie_ids,
    case when p_categorie_id is null
      then '{}'::uuid []
      else array[p_categorie_id]
    end
  );

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
    if not public.puis_je_ecrire_categories(v_categorie_ids) then
      raise exception 'Modification refusee : categorie cible non autorisee (B5)'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.reservations_logistiques
     set ressource_id  = p_ressource_id,
         categorie_ids = v_categorie_ids,
         categorie_id  = case
           when cardinality(v_categorie_ids) > 0 then v_categorie_ids[1]
           else null
         end,
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

-- ============================================================================
-- §3 — modifier_recurrence (mêmes deux ajouts)
-- ============================================================================

create function public.modifier_recurrence(
    p_recurrence_id uuid,
    p_ressource_id uuid,
    p_categorie_id uuid,
    p_freq text,
    p_jours integer [],
    p_heure_debut time without time zone,
    p_heure_fin time without time zone,
    p_date_debut date,
    p_date_fin date,
    p_motif text default null,
    p_categorie_ids uuid [] default null
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
  v_categorie_ids uuid [];
begin
  v_categorie_ids := coalesce(
    p_categorie_ids,
    case when p_categorie_id is null
      then '{}'::uuid []
      else array[p_categorie_id]
    end
  );

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
    if not public.puis_je_ecrire_categories(v_categorie_ids) then
      raise exception 'Modification refusee : categorie cible non autorisee (B5)'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.reservations_recurrentes
     set ressource_id  = p_ressource_id,
         categorie_ids = v_categorie_ids,
         categorie_id  = case
           when cardinality(v_categorie_ids) > 0 then v_categorie_ids[1]
           else null
         end,
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

-- ============================================================================
-- §4 — modifier_bus (mêmes deux ajouts)
-- ============================================================================

create function public.modifier_bus(
    p_demande_id uuid,
    p_categorie_id uuid,
    p_date date,
    p_type_competition text,
    p_destination text,
    p_heure_arrivee_souhaitee time without time zone,
    p_retour_depart time without time zone,
    p_retour_arrivee time without time zone,
    p_arrets_aller jsonb,
    p_arrets_retour jsonb,
    p_delegations jsonb,
    p_pax_joueurs integer,
    p_pax_staff integer,
    p_total_mom integer,
    p_total_deleg integer,
    p_total_bus integer,
    p_notes text default null,
    p_categorie_ids uuid [] default null
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
  v_categorie_ids uuid [];
begin
  v_categorie_ids := coalesce(
    p_categorie_ids,
    case when p_categorie_id is null
      then '{}'::uuid []
      else array[p_categorie_id]
    end
  );

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
    if not public.puis_je_ecrire_categories(v_categorie_ids) then
      raise exception 'Modification refusee : categorie cible non autorisee (B5)'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.demandes_bus
     set categorie_ids           = v_categorie_ids,
         categorie_id            = case
           when cardinality(v_categorie_ids) > 0 then v_categorie_ids[1]
           else null
         end,
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

-- ============================================================================
-- §5 — ACL re-déclarées À L'IDENTIQUE (sondées 05/07 : anon exclu,
--       authenticated exécutant ; REVOKE PUBLIC **et** anon)
-- ============================================================================

revoke execute on function public.modifier_reservation(
    uuid, uuid, uuid, date,
    time without time zone, time without time zone, text, uuid []
) from public;
revoke execute on function public.modifier_reservation(
    uuid, uuid, uuid, date,
    time without time zone, time without time zone, text, uuid []
) from anon;
grant execute on function public.modifier_reservation(
    uuid, uuid, uuid, date,
    time without time zone, time without time zone, text, uuid []
) to authenticated;

revoke execute on function public.modifier_recurrence(
    uuid, uuid, uuid, text, integer [],
    time without time zone, time without time zone, date, date, text, uuid []
) from public;
revoke execute on function public.modifier_recurrence(
    uuid, uuid, uuid, text, integer [],
    time without time zone, time without time zone, date, date, text, uuid []
) from anon;
grant execute on function public.modifier_recurrence(
    uuid, uuid, uuid, text, integer [],
    time without time zone, time without time zone, date, date, text, uuid []
) to authenticated;

revoke execute on function public.modifier_bus(
    uuid, uuid, date, text, text,
    time without time zone, time without time zone, time without time zone,
    jsonb, jsonb, jsonb,
    integer, integer, integer, integer, integer, text, uuid []
) from public;
revoke execute on function public.modifier_bus(
    uuid, uuid, date, text, text,
    time without time zone, time without time zone, time without time zone,
    jsonb, jsonb, jsonb,
    integer, integer, integer, integer, integer, text, uuid []
) from anon;
grant execute on function public.modifier_bus(
    uuid, uuid, date, text, text,
    time without time zone, time without time zone, time without time zone,
    jsonb, jsonb, jsonb,
    integer, integer, integer, integer, integer, text, uuid []
) to authenticated;

-- ============================================================================
-- §6 — VÉRIFICATION FAIL-LOUD
-- ============================================================================

do $verif$
declare
  v_n integer;
begin
  -- Exactement UNE fonction par nom (aucune surcharge résiduelle),
  -- avec le bon nombre de paramètres (8 / 11 / 18).
  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'modifier_reservation';
  if v_n <> 1 then
    raise exception 'VERIF sql_157 : modifier_reservation attendu unique, trouvé % occurrence(s)', v_n;
  end if;
  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'modifier_recurrence';
  if v_n <> 1 then
    raise exception 'VERIF sql_157 : modifier_recurrence attendu unique, trouvé % occurrence(s)', v_n;
  end if;
  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'modifier_bus';
  if v_n <> 1 then
    raise exception 'VERIF sql_157 : modifier_bus attendu unique, trouvé % occurrence(s)', v_n;
  end if;

  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and ((p.proname = 'modifier_reservation' and p.pronargs = 8)
      or (p.proname = 'modifier_recurrence' and p.pronargs = 11)
      or (p.proname = 'modifier_bus' and p.pronargs = 18));
  if v_n <> 3 then
    raise exception 'VERIF sql_157 : signatures 8/11/18 attendues, conformes %', v_n;
  end if;

  -- Les 3 corps appellent la garde TABLEAU et restent SECURITY DEFINER.
  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('modifier_reservation', 'modifier_recurrence', 'modifier_bus')
    and p.prosecdef
    and p.prosrc like '%puis_je_ecrire_categories%';
  if v_n <> 3 then
    raise exception 'VERIF sql_157 : garde tableau + SECURITY DEFINER attendus ×3, trouvés %', v_n;
  end if;

  -- ACL : anon exclu, authenticated exécutant, ×3.
  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('modifier_reservation', 'modifier_recurrence', 'modifier_bus')
    and not has_function_privilege('anon', p.oid, 'execute')
    and has_function_privilege('authenticated', p.oid, 'execute');
  if v_n <> 3 then
    raise exception 'VERIF sql_157 : ACL attendues anon=non/authenticated=oui ×3, conformes %', v_n;
  end if;

  raise notice 'VERIF sql_157 : OK (3 fonctions uniques 8/11/18, garde tableau, ACL)';
end;
$verif$;

commit;
