-- =====================================================================
-- sql_246_detecter_conflits_ressource.sql
-- Chantier RESA-ANTI-CHEVAUCHEMENT (FAIT FOI gelé pt 259+).
--
-- Détection de collision de RESSOURCE MATÉRIEL EXCLUSIVE (ARB.A) au
-- moment de la validation. NON BLOQUANT (ARB.0 = c1) : cette RPC ne
-- fait que RENVOYER les conflits (RETURNS TABLE, patron `absence_conflits`)
-- ; c'est le FRONT qui décide d'afficher un avertissement. Rien n'est
-- interdit côté base : aucune garde dure, aucune contrainte EXCLUDE.
--
-- ARB.1 : conflit détecté contre les résas `approved` UNIQUEMENT.
-- ARB.2 : même ressource + ≥1 date commune + chevauchement horaire
--         bornes OUVERTES (a.debut < b.fin AND b.debut < a.fin).
-- ARB.3 : détection SQL centralisée. La projection des règles
--         récurrentes en occurrences-dates est un portage FIDÈLE de la
--         fonction JS déployée `occurrencesFenetre` (agenda-general.html
--         l.494+, identique en logique à logistique-agenda /
--         logistique-validation). Convention jours[] = 0=Lundi..6=Dimanche
--         (≠ isodow) → conversion `extract(isodow) - 1`.
-- ARB.A : ne détecte QUE si la ressource testée est type='materiel'.
--         Les type='site' sont partageables → 0 conflit renvoyé.
--
-- Deux objets :
--   1. _projeter_occurrences_recurrente(p_recurrence_id, p_from, p_to)
--      -> table(occ_date) : porte occurrencesFenetre en SQL, bornée à
--      la fenêtre [p_from, p_to] pour la performance (ARB perf tracé).
--   2. detecter_conflits_ressource(...) : croise le créneau testé
--      (ponctuel OU projection d'une règle) contre les résas approved
--      ponctuelles ET récurrentes de la MÊME ressource matériel.
--
-- Grants : REVOKE public/anon + GRANT authenticated (patron SECURITY
-- DEFINER du projet). DROP FUNCTION IF EXISTS d'abord (évite PGRST203
-- si une signature préexistait — ici création neuve, garde de sûreté).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) HELPER : projection d'UNE règle récurrente en occurrences-dates.
--    Portage fidèle de occurrencesFenetre(rule, debutISO, finISO).
-- ---------------------------------------------------------------------
drop function if exists public._projeter_occurrences_recurrente(uuid, date, date);

create function public._projeter_occurrences_recurrente(
  p_recurrence_id uuid,
  p_from          date,
  p_to            date
)
returns table (occ_date date)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rule    public.reservations_recurrentes%rowtype;
  v_lo      date;
  v_hi      date;
  v_d       date;
  v_dow0    int;   -- jour de semaine recalé 0=Lundi..6=Dimanche.
  v_wk      int;   -- n° de semaine (biweekly).
  v_mois    date;  -- 1er du mois courant (marqueur monthly).
  v_monthly_done_mois date := null;
begin
  select * into v_rule
  from public.reservations_recurrentes
  where id = p_recurrence_id;

  -- Règle absente, sans jours, ou sans date_fin -> aucune occurrence
  -- (miroir des gardes JS : `if (!jours.length || !rule.date_fin) return []`).
  if not found
     or v_rule.jours is null
     or array_length(v_rule.jours, 1) is null
     or v_rule.date_fin is null then
    return;
  end if;

  -- Bornes effectives : intersection [fenêtre] x [.., date_fin].
  -- (miroir : lo = debutISO ; hi = min(date_fin, finISO)).
  v_lo := p_from;
  v_hi := least(v_rule.date_fin, p_to);
  if v_lo > v_hi then
    return;
  end if;

  v_d := v_lo;
  while v_d <= v_hi loop
    -- Nouveau mois -> ré-armer le marqueur monthly.
    v_mois := date_trunc('month', v_d)::date;

    -- 1) date_fin dure (miroir `if (iso > date_fin) continue`).
    if v_d > v_rule.date_fin then
      v_d := v_d + 1;
      continue;
    end if;

    -- 2) jour de semaine coché ? isodow 1..7 (Lun..Dim) -> 0..6.
    v_dow0 := extract(isodow from v_d)::int - 1;
    if not (v_dow0 = any (v_rule.jours)) then
      v_d := v_d + 1;
      continue;
    end if;

    -- 3) borne basse date_debut (miroir `if (depuis && iso < date_debut) continue`).
    if v_rule.date_debut is not null and v_d < v_rule.date_debut then
      v_d := v_d + 1;
      continue;
    end if;

    -- 4) biweekly : semaine paire.
    if v_rule.freq = 'biweekly' then
      if v_rule.date_debut is not null then
        -- round((mondayOf(d) - mondayOf(date_debut)) / 7).
        v_wk := round(
          (date_trunc('week', v_d)::date
           - date_trunc('week', v_rule.date_debut)::date) / 7.0
        )::int;
      else
        -- repli sans borne : floor((d - 1er_janvier(année d)) / 7).
        v_wk := floor(
          (v_d - make_date(extract(year from v_d)::int, 1, 1)) / 7.0
        )::int;
      end if;
      if (v_wk % 2) <> 0 then
        v_d := v_d + 1;
        continue;
      end if;
    end if;

    -- 5) monthly : 1re occurrence retenue du mois seulement.
    if v_rule.freq = 'monthly' then
      if v_monthly_done_mois is not distinct from v_mois then
        v_d := v_d + 1;
        continue;
      end if;
      v_monthly_done_mois := v_mois;
    end if;

    -- 6) date exclue (miroir E6 : saut APRÈS le marqueur monthly).
    if v_rule.dates_exclues is not null
       and v_d = any (v_rule.dates_exclues) then
      v_d := v_d + 1;
      continue;
    end if;

    -- Occurrence retenue.
    occ_date := v_d;
    return next;

    v_d := v_d + 1;
  end loop;

  return;
end
$function$;

revoke all on function
  public._projeter_occurrences_recurrente(uuid, date, date) from public;
revoke all on function
  public._projeter_occurrences_recurrente(uuid, date, date) from anon;
grant execute on function
  public._projeter_occurrences_recurrente(uuid, date, date) to authenticated;


-- ---------------------------------------------------------------------
-- 2) RPC PRINCIPALE : détection de conflits pour un créneau testé.
--    Le créneau testé peut être un PONCTUEL (p_date..p_date_fin) OU la
--    projection d'une règle récurrente candidate (le front passe alors
--    date=date_debut, date_fin=date_fin de la règle, et p_exclure_recurrence_id).
--    Renvoie 1 ligne par (date × réservation adverse) en conflit.
-- ---------------------------------------------------------------------
drop function if exists public.detecter_conflits_ressource(
  uuid, date, date, time, time, uuid, uuid);

create function public.detecter_conflits_ressource(
  p_ressource_id           uuid,
  p_date                   date,
  p_date_fin               date default null,
  p_heure_debut            time default null,
  p_heure_fin              time default null,
  p_exclure_id             uuid default null,   -- résa ponctuelle à ignorer (soi-même)
  p_exclure_recurrence_id  uuid default null    -- règle récurrente à ignorer (soi-même)
)
returns table (
  out_source          text,   -- 'ponctuel' | 'recurrent'
  out_conflit_id      uuid,    -- id de la résa/règle adverse
  out_date_conflit    date,    -- la date qui se chevauche
  out_heure_debut     time,
  out_heure_fin       time,
  out_ressource_id    uuid,
  out_libelle_ressource text,
  out_motif           text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type      text;
  v_libelle   text;
  v_from      date;
  v_to        date;
  v_hd        time;
  v_hf        time;
begin
  -- Garde d'accès : réservée aux utilisateurs authentifiés (grant plus bas).
  -- Lecture seule, aucune écriture, aucun effet de bord.

  -- ARB.A : ne détecter QUE sur ressource type='materiel'. Sinon 0 ligne.
  select type, libelle into v_type, v_libelle
  from public.ressources_logistiques
  where id = p_ressource_id;

  if not found or v_type is distinct from 'materiel' then
    return;  -- site partageable ou ressource inconnue -> aucun conflit.
  end if;

  -- Normalisation du créneau testé.
  v_from := p_date;
  v_to   := coalesce(p_date_fin, p_date);   -- mono-jour si date_fin NULL.
  v_hd   := coalesce(p_heure_debut, time '00:00');
  v_hf   := coalesce(p_heure_fin,   time '24:00');
  if v_from is null then
    return;  -- créneau testé invalide.
  end if;

  -- Jours candidats du créneau testé (dépliage ponctuel simple).
  -- (miroir joursPonctuelle : chaque jour de [v_from, v_to]).

  -- =================================================================
  -- SOURCE A : réservations PONCTUELLES approved de la même ressource.
  -- =================================================================
  return query
  with jours_testes as (
    select gs::date as d
    from generate_series(v_from, v_to, interval '1 day') as gs
  ),
  ponct_adverses as (
    select rl.id, rl.date, rl.date_fin, rl.heure_debut, rl.heure_fin, rl.motif
    from public.reservations_logistiques rl
    where rl.ressource_id = p_ressource_id
      and rl.statut = 'approved'
      and (p_exclure_id is null or rl.id <> p_exclure_id)
  ),
  ponct_jours as (
    -- déplie chaque résa adverse ponctuelle en jours.
    select pa.id, pa.heure_debut, pa.heure_fin, pa.motif,
           gs::date as d
    from ponct_adverses pa
    cross join lateral
      generate_series(pa.date, coalesce(pa.date_fin, pa.date), interval '1 day') as gs
  )
  select
    'ponctuel'::text,
    pj.id,
    pj.d,
    pj.heure_debut,
    pj.heure_fin,
    p_ressource_id,
    v_libelle,
    pj.motif
  from jours_testes jt
  join ponct_jours pj on pj.d = jt.d
  -- overlap horaire bornes ouvertes : testé.debut < adverse.fin AND adverse.debut < testé.fin.
  where v_hd < pj.heure_fin
    and pj.heure_debut < v_hf;

  -- =================================================================
  -- SOURCE B : règles RÉCURRENTES approved de la même ressource,
  --            projetées en occurrences sur la fenêtre du créneau testé.
  -- =================================================================
  return query
  with jours_testes as (
    select gs::date as d
    from generate_series(v_from, v_to, interval '1 day') as gs
  ),
  recur_adverses as (
    select rr.id, rr.heure_debut, rr.heure_fin, rr.motif
    from public.reservations_recurrentes rr
    where rr.ressource_id = p_ressource_id
      and rr.statut = 'approved'
      and rr.active = true
      and (p_exclure_recurrence_id is null or rr.id <> p_exclure_recurrence_id)
  ),
  recur_occ as (
    -- projette chaque règle adverse sur [v_from, v_to] via le helper.
    select ra.id, ra.heure_debut, ra.heure_fin, ra.motif, o.occ_date as d
    from recur_adverses ra
    cross join lateral
      public._projeter_occurrences_recurrente(ra.id, v_from, v_to) as o(occ_date)
  )
  select
    'recurrent'::text,
    ro.id,
    ro.d,
    ro.heure_debut,
    ro.heure_fin,
    p_ressource_id,
    v_libelle,
    ro.motif
  from jours_testes jt
  join recur_occ ro on ro.d = jt.d
  where v_hd < ro.heure_fin
    and ro.heure_debut < v_hf;

  return;
end
$function$;

revoke all on function public.detecter_conflits_ressource(
  uuid, date, date, time, time, uuid, uuid) from public;
revoke all on function public.detecter_conflits_ressource(
  uuid, date, date, time, time, uuid, uuid) from anon;
grant execute on function public.detecter_conflits_ressource(
  uuid, date, date, time, time, uuid, uuid) to authenticated;
