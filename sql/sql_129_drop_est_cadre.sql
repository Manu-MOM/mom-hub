-- =============================================================================
-- sql_129_drop_est_cadre.sql
-- Mini-chantier : DROP de la colonne missions.est_cadre (jamais branchée).
--
-- Contexte (sondes pt 126) :
--   - missions.est_cadre : NOT NULL DEFAULT false. 0 ligne à true en base
--     (sonde pt 124/125). Transport pur dans upsert_mission (aucun IF/CASE/WHERE).
--   - Aucune vue (A3), policy RLS (A4), contrainte CHECK (A5), index (A6) ni
--     trigger décisionnel (A7) ne lit est_cadre. Seule upsert_mission la cite,
--     en simple stockage.
--   - Fronts purgés en amont (suivi-salarie.html, gestion-salarie.html) :
--     plus aucun envoi de p_est_cadre.
--
-- Périmètre STRICT : est_cadre uniquement. Les colonnes refacturable
--   (missions.refacturable = miroir du statut ; mission_seances.refacturable)
--   sont CONSERVÉES — leur DROP est différé (décision modèle en attente).
--
-- Effets :
--   1) Recrée upsert_mission SANS le paramètre p_est_cadre et sans la colonne
--      est_cadre (INSERT + UPDATE). Corps par ailleurs byte-identique à l'existant.
--   2) DROP de la colonne missions.est_cadre.
--   3) Bloc de vérification fail-loud.
--
-- Idempotence : DROP FUNCTION IF EXISTS sur l'ANCIENNE signature (avec
--   p_est_cadre) avant recréation, pour éviter toute ambiguïté d'overload.
--   DROP COLUMN IF EXISTS pour rejouabilité.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Retrait de l'ANCIENNE signature de upsert_mission (celle AVEC p_est_cadre).
--    On cible la signature complète pour ne pas dépendre des DEFAULT.
-- -----------------------------------------------------------------------------
drop function if exists public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, boolean, text, text, boolean, text, text, numeric, text
);

-- -----------------------------------------------------------------------------
-- 2) Recréation de upsert_mission SANS p_est_cadre / sans colonne est_cadre.
--    Corps identique à l'existant (sonde B pt 126) hormis ce retrait.
-- -----------------------------------------------------------------------------
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
  p_refacturable boolean default null::boolean,
  p_etat text default 'prevue'::text,
  p_bilan_text text default null::text,
  p_questionnaire_fait boolean default false,
  p_notes text default null::text,
  p_reference_commande text default null::text,
  p_montant numeric default null::numeric,
  p_statut text default 'interne'::text
)
returns missions
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
      lieu_id, lieu_libre, date_debut, date_fin, recurrence,
      refacturable, etat, bilan_text, questionnaire_fait, notes,
      reference_commande, montant, statut, cree_par)
    values(
      p_code, p_libelle, p_type_mission, p_salarie_id, p_entite_id, p_saison_id,
      p_lieu_id, p_lieu_libre, p_date_debut, p_date_fin, p_recurrence,
      v_refac, p_etat, p_bilan_text, p_questionnaire_fait, p_notes,
      p_reference_commande, p_montant, v_statut, v_me)
    returning * into v_row;
  else
    update public.missions set
      code = p_code, libelle = p_libelle, type_mission = p_type_mission,
      salarie_id = p_salarie_id, entite_id = p_entite_id, saison_id = p_saison_id,
      lieu_id = p_lieu_id, lieu_libre = p_lieu_libre, date_debut = p_date_debut,
      date_fin = p_date_fin, recurrence = p_recurrence,
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

-- Permissions : SECURITY DEFINER + REVOKE anon (patron module salarié).
revoke all on function public.upsert_mission(
  uuid, text, text, text, uuid, uuid, uuid, date, uuid, text, date, jsonb,
  boolean, text, text, boolean, text, text, numeric, text
) from anon;

-- -----------------------------------------------------------------------------
-- 3) DROP de la colonne missions.est_cadre.
--    Plus aucune référence après recréation de la fonction en (2).
-- -----------------------------------------------------------------------------
alter table public.missions drop column if exists est_cadre;

-- -----------------------------------------------------------------------------
-- 4) VÉRIFICATION fail-loud.
--    (a) la colonne est_cadre n'existe plus sur missions ;
--    (b) la fonction upsert_mission existe et n'a PLUS de paramètre p_est_cadre.
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_col_reste     int;
  v_fn_existe     int;
  v_a_est_cadre   int;
begin
  -- (a)
  v_col_reste := (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'missions'
      and column_name  = 'est_cadre'
  );
  if v_col_reste <> 0 then
    raise exception 'ÉCHEC : missions.est_cadre existe toujours (count=%).', v_col_reste;
  end if;

  -- (b1) la fonction existe
  v_fn_existe := (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_mission'
  );
  if v_fn_existe <> 1 then
    raise exception 'ÉCHEC : upsert_mission introuvable ou en doublon (count=%).', v_fn_existe;
  end if;

  -- (b2) aucun paramètre nommé p_est_cadre
  v_a_est_cadre := (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_mission'
      and 'p_est_cadre' = any(coalesce(p.proargnames, array[]::text[]))
  );
  if v_a_est_cadre <> 0 then
    raise exception 'ÉCHEC : upsert_mission porte encore le paramètre p_est_cadre.';
  end if;

  raise notice 'OK sql_129 : colonne est_cadre droppée, upsert_mission recréée sans p_est_cadre.';
end;
$verif$;

commit;
