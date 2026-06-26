-- ============================================================================
-- MOM Hub · Chantier « SEANCE-PONCTUELLE-SUIVI-SALARIE »
-- Fichier : sql/123 — RPC creer_seance_ponctuelle() (voie 3)
-- ----------------------------------------------------------------------------
-- Objet : permettre la création d'UNE séance ponctuelle (occurrence isolée, hors
--   génération récurrente) depuis suivi-salarie.html, par :
--     - l'administration (admin|bureau) : sur n'importe quelle mission, état libre ;
--     - le SALARIÉ relié : UNIQUEMENT sur une mission dont il est le salarie_id,
--       et l'état est FORCÉ à 'realisee' (jamais 'validee' : la validation reste
--       un geste admin — séparation des pouvoirs du modèle pt 114).
--
-- POURQUOI une RPC dédiée (et pas upsert_mission_seance) :
--   sonde à la source (pg_get_functiondef) : upsert_mission_seance a la garde
--   interne « if not _gs_peut_ecrire() then raise » = admin|bureau STRICT. Elle
--   sert la création/édition admin et NE DOIT PAS être élargie (elle est aussi
--   le chemin d'annulation réversible pt 115). On crée donc une voie 3 séparée,
--   calquée sur declarer_occurrence (pt 120) : garde « admin|bureau OU salarié
--   de la mission », via qui_suis_je() + missions.salarie_id.
--
-- INVARIANTS (actés Manu, ce chantier) :
--   - Une séance pend TOUJOURS à une mission (p_mission_id obligatoire) : c'est
--     elle qui porte type/bénéficiaire/refacturation, et qui range la séance au
--     compteur. Pas de séance « dans le vide ».
--   - Borne salarié : un salarié ne crée QUE sur ses propres missions
--     (missions.salarie_id = qui_suis_je()). Garde non bornée = faille -> exclu.
--   - État : salarié -> FORCÉ 'realisee' (1 geste ; l'admin valide ensuite pour
--     que les heures montent au compteur). Admin|bureau -> état au choix parmi
--     les états légaux de création ('prevue'|'realisee').
--   - La création NE déclenche AUCUNE montée au compteur (INSERT brut, comme
--     upsert_mission_seance ; le compteur ne bouge que sur valider_occurrence).
--
-- Réf. sondes (lecture seule, exécutées par Manu) :
--   - pg_get_functiondef('upsert_mission_seance') -> garde _gs_peut_ecrire (admin|bureau).
--   - declarer_occurrence (pt 120) = patron voie 3 : _gs_peut_ecrire() OR (v_me = v_salarie).
--   - qui_suis_je() RETURNS TABLE(personne_id uuid) (sql/60).
--
-- Patron calqué : sql/120 (voie 3, SECURITY DEFINER, REVOKE public+anon /
--   GRANT authenticated, bloc DO fail-loud). Idempotent, transaction.
-- ============================================================================

begin;

-- ============================================================================
-- 1. RPC creer_seance_ponctuelle() — voie 3
-- ============================================================================
create or replace function public.creer_seance_ponctuelle(
  p_mission_id     uuid,
  p_date_seance    date,
  p_heure_debut    time    default null,
  p_duree_min      integer default null,
  p_lieu_id        uuid    default null,
  p_lieu_libre     text    default null,
  p_refacturable   boolean default null,
  p_heures_reelles numeric default null,
  p_notes          text    default null,
  p_etat           text    default 'realisee'
)
returns public.mission_seances
language plpgsql
security definer
set search_path to 'public'
as $creer_seance_ponctuelle$
declare
  v_row     public.mission_seances;
  v_me      uuid;
  v_salarie uuid;
  v_admin   boolean;
  v_etat    text;
begin
  -- 1) La mission doit exister ; on lit son salarié.
  select m.salarie_id into v_salarie
  from public.missions m
  where m.id = p_mission_id;

  if not found then
    raise exception 'Mission introuvable : %', p_mission_id;
  end if;

  -- 2) Identité + droits.
  v_me    := (select personne_id from public.qui_suis_je());
  v_admin := public._gs_peut_ecrire();   -- admin|bureau

  -- 3) Garde voie 3 : admin|bureau, OU le salarié DE CETTE mission.
  if not (v_admin or (v_me is not null and v_me = v_salarie)) then
    raise exception 'Création réservée à l''administration ou au salarié de cette mission.';
  end if;

  -- 4) État : un NON-admin (salarié) ne peut créer qu'en 'realisee' (jamais
  --    'validee' : la validation reste admin). Un admin choisit parmi les états
  --    de création légaux ('prevue'|'realisee'). Aucune création directe en
  --    'validee'/'annulee' (transitions dédiées : valider_occurrence / annulation).
  if v_admin then
    v_etat := coalesce(p_etat, 'realisee');
    if v_etat not in ('prevue', 'realisee') then
      raise exception 'État de création invalide : "%". Attendu prevue|realisee.', v_etat;
    end if;
  else
    v_etat := 'realisee';   -- salarié : forcé, on ignore p_etat
  end if;

  -- 5) INSERT brut (aucune sync compteur : le compteur ne bouge que sur validation).
  insert into public.mission_seances(
    mission_id, date_seance, heure_debut, duree_min, lieu_id, lieu_libre,
    refacturable, etat, heures_reelles, notes)
  values(
    p_mission_id, p_date_seance, p_heure_debut, p_duree_min, p_lieu_id, p_lieu_libre,
    p_refacturable, v_etat, p_heures_reelles, p_notes)
  returning * into v_row;

  return v_row;
end;
$creer_seance_ponctuelle$;

comment on function public.creer_seance_ponctuelle(uuid, date, time, integer, uuid, text, boolean, numeric, text, text) is
  'Voie 3 : crée UNE séance ponctuelle sur une mission. Garde = admin|bureau OU salarié de la mission (missions.salarie_id = qui_suis_je()). Le salarié crée FORCÉMENT en realisee (jamais validee) ; l''admin choisit prevue|realisee. Aucune montée au compteur à la création (INSERT brut). Calquée sur declarer_occurrence (pt 120).';

-- ============================================================================
-- 2. Privilèges — fermer public + anon, ouvrir authenticated
--    (leçon DS-1 pt 109/110 : REVOKE FROM PUBLIC seul insuffisant).
-- ============================================================================
revoke execute on function public.creer_seance_ponctuelle(uuid, date, time, integer, uuid, text, boolean, numeric, text, text) from public, anon;
grant  execute on function public.creer_seance_ponctuelle(uuid, date, time, integer, uuid, text, boolean, numeric, text, text) to authenticated;

-- ============================================================================
-- 3. Vérification fail-loud (la fonction existe).
-- ============================================================================
do $verif$
declare
  v_exists boolean;
begin
  v_exists := (
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'creer_seance_ponctuelle'
        and p.prokind = 'f'
    )
  );
  if not v_exists then
    raise exception 'ECHEC sql_123 : creer_seance_ponctuelle() absente après création.';
  end if;
  raise notice 'OK sql_123 : creer_seance_ponctuelle() créée (voie 3, séance ponctuelle).';
end;
$verif$;

commit;

-- ============================================================================
-- DRY-RUN optionnel (exécuter SÉPARÉMENT, et ROLLBACK pour ne rien laisser) :
--   begin;
--   select public.creer_seance_ponctuelle(
--     '<uuid_mission_de_lohann>'::uuid, current_date, null, 90, null, null, null, 1.5, 'test ponctuelle');
--   rollback;
--     -> depuis le compte de Lohann : OK si mission lui appartient, etat='realisee'.
--     -> depuis le compte de Lohann sur une mission d'autrui : raise (garde voie 3).
-- ============================================================================
