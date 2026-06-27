-- =============================================================================
-- sql_126_statut_mission.sql
-- Chantier B — statut énuméré de mission (SALARIE-REFONTE-MODALE-MISSION)
--
-- Objet : poser sur missions le statut énuméré 'interne' | 'facturable' | 'autre',
--   qui devient le concept PILOTE de l'affichage conditionnel (chantier D) :
--     - interne    -> bénéficiaire masqué, pas de facturation ;
--     - facturable -> bénéficiaire visible + bloc facturation ;
--     - autre      -> bénéficiaire visible, pas de facturation.
--   B = SQL pur (DDL + RPC). Le câblage UI du statut est au chantier D.
--
-- Décision §4 (PASSATION chantier B), tranchée par Manu APRÈS sondes S-B1/2/3 :
--   REMPLACER (et non coexister). Sonde S-B1 : missions.refacturable n'a AUCUN
--   lecteur métier — écrit en saisie seule par 4 RPC (upsert_mission,
--   upsert_mission_seance, creer_seance_ponctuelle, upsert_entite via
--   refacturable_defaut), AUCUNE vue ne le lit (S-B1 b : 0 ligne), front en
--   checkbox de saisie. Sonde S-B3 : table missions VIDE (0 ligne) -> AUCUNE
--   migration de données à écrire. Le statut peut donc piloter refacturable
--   sans régression ni amorce.
--
-- Décision B (dérivation) : statut SEUL pilote. v_refac := (p_statut = 'facturable').
--   p_refacturable est CONSERVÉ en signature (rétrocompat des appels front
--   actuels qui l'envoient) mais IGNORÉ. L'ancienne dérivation Q4 depuis
--   entites.refacturable_defaut disparaît : en chantier D la modale choisira le
--   statut explicitement. refacturable devient un miroir dérivé du statut.
--
-- Décision C (colonne) : statut NOT NULL DEFAULT 'interne' (table vide -> pas
--   d'enjeu d'amorce ; défaut sûr = pas de facturation, jamais de NULL).
--
-- Périmètre (PASSATION §5, §6, §7) :
--   - refacturable NON droppé (colonne conservée, comme est_cadre) ; DROP =
--     mini-chantier futur après preuve de non-lecture.
--   - est_cadre NON touché (retrait UI au chantier D, colonne conservée).
--   - 5 colonnes facturation pt 121 NON touchées.
--   - 10 type_mission verrouillés (sql_114) — inchangés.
--   - Compteur (releve_heures_salarie / v_compteur_annualisation) intouché.
--   - Aucune garde d'autorisation modifiée (_gs_peut_ecrire).
--
-- DS-1 : corps de upsert_mission (20 params, pt 121) relu à la source
--   (pg_get_functiondef) AVANT écriture. Recopié à l'identique ; seuls écarts =
--   +1 param p_statut, garde de valeur, et v_refac dérivé du statut.
--   upsert_mission fait un UPDATE DUR sans COALESCE (inversion DS-1 pt 118) :
--   statut est donc câblé dans l'INSERT ET l'UPDATE.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS ; DROP CONSTRAINT IF EXISTS avant ADD ;
--   DROP FUNCTION IF EXISTS (signature 20-params exacte) avant CREATE 21-params
--   (anti-surcharge). Nouveau param ajouté EN FIN de signature avec DEFAULT
--   'interne' : les appels par nom existants du front résolvent sans ambiguïté.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Colonne statut sur missions (NOT NULL DEFAULT 'interne')
-- -----------------------------------------------------------------------------
alter table public.missions
  add column if not exists statut text not null default 'interne';

-- -----------------------------------------------------------------------------
-- 2. CHECK d'énumération (idempotent : DROP IF EXISTS puis ADD)
-- -----------------------------------------------------------------------------
alter table public.missions
  drop constraint if exists missions_statut_check;
alter table public.missions
  add constraint missions_statut_check
  check (statut in ('interne', 'facturable', 'autre'));

-- -----------------------------------------------------------------------------
-- 3. upsert_mission : 20 -> 21 params (+ p_statut)
--    DROP de la signature 20-params exacte (anti-surcharge), puis CREATE 21-params.
--    Corps recopié à l'identique du pt 121 ; v_refac DÉRIVÉ DU STATUT.
-- -----------------------------------------------------------------------------
drop function if exists public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric
);

create or replace function public.upsert_mission(
  p_id uuid,
  p_code text,
  p_libelle text,
  p_type_mission text,
  p_salarie_id uuid,
  p_entite_id uuid,
  p_saison_id uuid,
  p_date_debut date,
  p_lieu_id uuid default null::uuid,
  p_lieu_libre text default null::text,
  p_date_fin date default null::date,
  p_recurrence jsonb default null::jsonb,
  p_est_cadre boolean default false,
  p_refacturable boolean default null::boolean,
  p_etat text default 'prevue'::text,
  p_bilan_text text default null::text,
  p_questionnaire_fait boolean default false,
  p_notes text default null::text,
  p_reference_commande text default null::text,
  p_montant numeric default null::numeric,
  p_statut text default 'interne'::text
)
returns public.missions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row    public.missions;
  v_me     uuid;
  v_refac  boolean;
  v_statut text;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_libelle), '') = '' then
    raise exception 'Le code et le libellé sont obligatoires.';
  end if;

  -- statut : pilote (chantier B). NULL -> défaut sûr 'interne'. Garde de valeur
  -- fail-loud lisible côté RPC (le CHECK colonne protège aussi en dernier ressort).
  v_statut := coalesce(p_statut, 'interne');
  if v_statut not in ('interne', 'facturable', 'autre') then
    raise exception 'Statut invalide : %. Attendu interne|facturable|autre.', v_statut;
  end if;

  -- refacturable : MIROIR dérivé du statut (décision B, chantier B).
  -- p_refacturable est ignoré (conservé en signature pour rétrocompat front).
  v_refac := (v_statut = 'facturable');

  select personne_id into v_me from public.qui_suis_je();

  if p_id is null then
    insert into public.missions(
      code, libelle, type_mission, salarie_id, entite_id, saison_id,
      lieu_id, lieu_libre, date_debut, date_fin, recurrence, est_cadre,
      refacturable, etat, bilan_text, questionnaire_fait, notes,
      reference_commande, montant, statut, cree_par)
    values(
      p_code, p_libelle, p_type_mission, p_salarie_id, p_entite_id, p_saison_id,
      p_lieu_id, p_lieu_libre, p_date_debut, p_date_fin, p_recurrence, p_est_cadre,
      v_refac, p_etat, p_bilan_text, p_questionnaire_fait, p_notes,
      p_reference_commande, p_montant, v_statut, v_me)
    returning * into v_row;
  else
    update public.missions set
      code = p_code, libelle = p_libelle, type_mission = p_type_mission,
      salarie_id = p_salarie_id, entite_id = p_entite_id, saison_id = p_saison_id,
      lieu_id = p_lieu_id, lieu_libre = p_lieu_libre, date_debut = p_date_debut,
      date_fin = p_date_fin, recurrence = p_recurrence, est_cadre = p_est_cadre,
      refacturable = v_refac, etat = p_etat, bilan_text = p_bilan_text,
      questionnaire_fait = p_questionnaire_fait, notes = p_notes,
      reference_commande = p_reference_commande, montant = p_montant,
      statut = v_statut
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Mission introuvable : %', p_id;
    end if;
  end if;

  return v_row;
end;
$function$;

-- REVOKE depuis PUBLIC ET anon : sur Supabase les default privileges du schéma
-- public accordent EXECUTE à PUBLIC (dont anon hérite) ; REVOKE FROM anon seul
-- ne suffit pas (leçon DS-1 pt 109).
revoke all on function public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric, text
) from public;
revoke all on function public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric, text
) from anon;
grant execute on function public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Vérification fail-loud (refuse de committer si l'état n'est pas conforme)
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_nb int;
begin
  -- colonne statut présente, NOT NULL, défaut 'interne'
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'missions'
                   and column_name = 'statut') then
    raise exception 'VERIF: missions.statut absente';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'missions'
               and column_name = 'statut' and is_nullable = 'YES') then
    raise exception 'VERIF: missions.statut doit être NOT NULL';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'missions'
                   and column_name = 'statut'
                   and column_default like '%interne%') then
    raise exception 'VERIF: missions.statut doit avoir DEFAULT ''interne''';
  end if;

  -- CHECK d'énumération présent
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.missions'::regclass
                   and conname = 'missions_statut_check') then
    raise exception 'VERIF: contrainte missions_statut_check absente';
  end if;

  -- upsert_mission présente en 1 exemplaire (pas de surcharge) et 21-params
  select count(*) into v_nb
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'upsert_mission';
  if v_nb <> 1 then
    raise exception 'VERIF: upsert_mission doit exister en 1 exemplaire, trouvé %', v_nb;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_mission'
      and pg_get_function_identity_arguments(p.oid) like '%p_statut text%'
  ) then
    raise exception 'VERIF: upsert_mission ne porte pas p_statut (21-params attendue)';
  end if;

  -- anon fermé, authenticated ouvert sur la RPC élargie
  if has_function_privilege('anon', 'public.upsert_mission(uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb, boolean, boolean, text, text, boolean, text, text, numeric, text)', 'execute') then
    raise exception 'VERIF: anon ne doit pas pouvoir exécuter upsert_mission';
  end if;
  if not has_function_privilege('authenticated', 'public.upsert_mission(uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb, boolean, boolean, text, text, boolean, text, text, numeric, text)', 'execute') then
    raise exception 'VERIF: authenticated doit pouvoir exécuter upsert_mission';
  end if;

  raise notice 'VERIF sql_126 OK : statut (NOT NULL DEFAULT interne) + CHECK + upsert_mission 21-params (anon fermé, authenticated ouvert)';
end;
$verif$;

commit;
