-- =============================================================
-- sql/sql_86_migration_b5_legacy.sql
--
-- BUT : finir la migration des policies d'écriture du régime LEGACY
--       (admin OR coach) vers le régime B5
--       (admin OR bureau OR puis_je_ecrire_categorie(...)).
--
-- CONTEXTE (pt 86, diagnostic Rôles & accès) :
--   - Le rôle 'coach' n'est PAS attribuable (CHECK auth_roles +
--     gardes RPC = admin|bureau|referent) → AUCUN compte n'a 'coach'
--     → les policies legacy (admin OR coach) étaient de fait
--     admin-seul, bloquant les référents (Vivien/Mathieu = referent,
--     J.E. = bureau) sur séances / équipes / évènements / présences.
--   - Décision Manu : MIGRER le legacy vers B5 (cohérent avec
--     collectif_membre / compositions / planification_blocs déjà en
--     B5), plutôt que de perpétuer 'coach'. Après migration, plus
--     aucune policy ne teste 'coach'.
--
-- CHEMINS DE DÉRIVATION (établis par sondes W2→W6, helpers RÉELS) :
--   _b5_categorie_de_equipe(uuid)            equipe → entente → categorie
--   _b5_categorie_de_evenement(uuid)         (existant)
--   _b5_categorie_de_evenement_equipe(uuid)  (existant)
--   seances : equipe_id OU evenement_id (nullable) → COALESCE
--   seances_blocs : seance_id → (helper _b5_categorie_de_seance créé ici)
--   seances_blocs_ateliers : bloc_id → seances_blocs → seance
--                            → (helper _b5_categorie_de_seance_bloc créé ici)
--
-- ATTENTION (changement de surface d'autorisation ASSUMÉ) :
--   la migration ÉLARGIT l'écriture aux référents sur LEUR catégorie
--   là où elle était de fait admin-seul. C'est l'effet voulu.
--
-- Idempotent (DROP POLICY IF EXISTS + CREATE), transaction, fail-loud.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 0. Helpers de dérivation gigognes pour les séances (créés ici)
--    Fondés sur les FK réelles (W3/W5/W6). STABLE SECURITY DEFINER,
--    search_path verrouillé — patron identique aux _b5_* existants.
-- -------------------------------------------------------------

create or replace function public._b5_categorie_de_seance(p_seance_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $fn$
  -- Une séance se rattache à une équipe OU à un évènement (nullable).
  select coalesce(
           public._b5_categorie_de_equipe(s.equipe_id),
           public._b5_categorie_de_evenement(s.evenement_id)
         )
  from public.seances s
  where s.id = p_seance_id;
$fn$;

create or replace function public._b5_categorie_de_seance_bloc(p_bloc_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $fn$
  select public._b5_categorie_de_seance(sb.seance_id)
  from public.seances_blocs sb
  where sb.id = p_bloc_id;
$fn$;

-- -------------------------------------------------------------
-- 1. equipes  (insert/update coach → B5 ; delete admin → B5)
--    Dérivation : _b5_categorie_de_equipe(id)
-- -------------------------------------------------------------
drop policy if exists equipes_insert_admin_or_coach on public.equipes;
drop policy if exists equipes_update_admin_or_coach on public.equipes;
drop policy if exists equipes_delete_admin          on public.equipes;

create policy equipes_insert_admin_bureau_referent on public.equipes
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(id))
  );
create policy equipes_update_admin_bureau_referent on public.equipes
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(id))
  );
create policy equipes_delete_admin_bureau_referent on public.equipes
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(id))
  );

-- -------------------------------------------------------------
-- 2. equipe_joueurs  (insert/update coach + delete admin → B5)
--    Dérivation : _b5_categorie_de_equipe(equipe_id)
-- -------------------------------------------------------------
drop policy if exists equipe_joueurs_insert_admin_or_coach on public.equipe_joueurs;
drop policy if exists equipe_joueurs_update_admin_or_coach on public.equipe_joueurs;
drop policy if exists equipe_joueurs_delete_admin          on public.equipe_joueurs;

create policy equipe_joueurs_insert_admin_bureau_referent on public.equipe_joueurs
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(equipe_id))
  );
create policy equipe_joueurs_update_admin_bureau_referent on public.equipe_joueurs
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(equipe_id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(equipe_id))
  );
create policy equipe_joueurs_delete_admin_bureau_referent on public.equipe_joueurs
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_equipe(equipe_id))
  );

-- -------------------------------------------------------------
-- 3. equipe_engagee_membre  (insert/update/delete coach → B5)
--    Dérivation : _b5_categorie_de_evenement_equipe(evenement_equipe_id)
-- -------------------------------------------------------------
drop policy if exists equipe_engagee_membre_insert_admin_or_coach on public.equipe_engagee_membre;
drop policy if exists equipe_engagee_membre_update_admin_or_coach on public.equipe_engagee_membre;
drop policy if exists equipe_engagee_membre_delete_admin_or_coach on public.equipe_engagee_membre;

create policy equipe_engagee_membre_insert_admin_bureau_referent on public.equipe_engagee_membre
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement_equipe(evenement_equipe_id))
  );
create policy equipe_engagee_membre_update_admin_bureau_referent on public.equipe_engagee_membre
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement_equipe(evenement_equipe_id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement_equipe(evenement_equipe_id))
  );
create policy equipe_engagee_membre_delete_admin_bureau_referent on public.equipe_engagee_membre
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement_equipe(evenement_equipe_id))
  );

-- -------------------------------------------------------------
-- 4. evenements  (insert/update coach + delete admin → B5)
--    Dérivation : _b5_categorie_de_evenement(id)
-- -------------------------------------------------------------
drop policy if exists evenements_insert_admin_or_coach on public.evenements;
drop policy if exists evenements_update_admin_or_coach on public.evenements;
drop policy if exists evenements_delete_admin          on public.evenements;

create policy evenements_insert_admin_bureau_referent on public.evenements
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(id))
  );
create policy evenements_update_admin_bureau_referent on public.evenements
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(id))
  );
create policy evenements_delete_admin_bureau_referent on public.evenements
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(id))
  );

-- -------------------------------------------------------------
-- 5. evenement_encadrants  (insert/update coach + delete admin → B5)
--    Dérivation : _b5_categorie_de_evenement(evenement_id)
-- -------------------------------------------------------------
drop policy if exists evenement_encadrants_insert_admin_or_coach on public.evenement_encadrants;
drop policy if exists evenement_encadrants_update_admin_or_coach on public.evenement_encadrants;
drop policy if exists evenement_encadrants_delete_admin          on public.evenement_encadrants;

create policy evenement_encadrants_insert_admin_bureau_referent on public.evenement_encadrants
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  );
create policy evenement_encadrants_update_admin_bureau_referent on public.evenement_encadrants
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  );
create policy evenement_encadrants_delete_admin_bureau_referent on public.evenement_encadrants
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  );

-- -------------------------------------------------------------
-- 6. presences  (insert/update coach + delete admin → B5)
--    Dérivation : _b5_categorie_de_evenement(evenement_id)
-- -------------------------------------------------------------
drop policy if exists presences_insert_admin_or_coach on public.presences;
drop policy if exists presences_update_admin_or_coach on public.presences;
drop policy if exists presences_delete_admin          on public.presences;

create policy presences_insert_admin_bureau_referent on public.presences
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  );
create policy presences_update_admin_bureau_referent on public.presences
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  );
create policy presences_delete_admin_bureau_referent on public.presences
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_evenement(evenement_id))
  );

-- -------------------------------------------------------------
-- 7. seances  (ALL coach → B5, split en commandes explicites)
--    Dérivation : COALESCE(equipe_id, evenement_id) via helper
-- -------------------------------------------------------------
drop policy if exists seances_write_admin_coach on public.seances;

create policy seances_insert_admin_bureau_referent on public.seances
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(coalesce(_b5_categorie_de_equipe(equipe_id), _b5_categorie_de_evenement(evenement_id)))
  );
create policy seances_update_admin_bureau_referent on public.seances
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(coalesce(_b5_categorie_de_equipe(equipe_id), _b5_categorie_de_evenement(evenement_id)))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(coalesce(_b5_categorie_de_equipe(equipe_id), _b5_categorie_de_evenement(evenement_id)))
  );
create policy seances_delete_admin_bureau_referent on public.seances
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(coalesce(_b5_categorie_de_equipe(equipe_id), _b5_categorie_de_evenement(evenement_id)))
  );

-- -------------------------------------------------------------
-- 8. seances_blocs  (ALL coach → B5)
--    Dérivation : _b5_categorie_de_seance(seance_id)
-- -------------------------------------------------------------
drop policy if exists seances_blocs_write_admin_coach on public.seances_blocs;

create policy seances_blocs_insert_admin_bureau_referent on public.seances_blocs
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id))
  );
create policy seances_blocs_update_admin_bureau_referent on public.seances_blocs
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id))
  );
create policy seances_blocs_delete_admin_bureau_referent on public.seances_blocs
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id))
  );

-- -------------------------------------------------------------
-- 9. seances_blocs_ateliers  (ALL coach → B5)
--    Dérivation : _b5_categorie_de_seance_bloc(bloc_id)
-- -------------------------------------------------------------
drop policy if exists seances_blocs_ateliers_write_admin_coach on public.seances_blocs_ateliers;

create policy seances_blocs_ateliers_insert_admin_bureau_referent on public.seances_blocs_ateliers
  for insert with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance_bloc(bloc_id))
  );
create policy seances_blocs_ateliers_update_admin_bureau_referent on public.seances_blocs_ateliers
  for update using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance_bloc(bloc_id))
  ) with check (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance_bloc(bloc_id))
  );
create policy seances_blocs_ateliers_delete_admin_bureau_referent on public.seances_blocs_ateliers
  for delete using (
    has_role('admin') or has_role('bureau')
    or puis_je_ecrire_categorie(_b5_categorie_de_seance_bloc(bloc_id))
  );

-- -------------------------------------------------------------
-- 10. PURGE des pré-attributions résiduelles (constat 2, pt 86)
--     Les 4 testeurs ont été reliés par INSERT manuel (pt 84), ce qui
--     a court-circuité relier_ma_fiche → leurs roles_en_attente n'ont
--     jamais été consommés et ne le seront jamais (déjà reliés). Leurs
--     rôles effectifs ont été posés à la main via attribuer_role.
--     On purge UNIQUEMENT les attentes de personnes DÉJÀ reliées
--     (auth_personne) ET ayant DÉJÀ le rôle correspondant en auth_roles
--     → purge sûre, ne touche aucune attente encore légitime.
-- -------------------------------------------------------------
delete from public.roles_en_attente rea
where exists (
        select 1 from public.auth_personne ap
        where ap.personne_id = rea.personne_id
      )
  and exists (
        select 1
        from public.auth_personne ap
        join public.auth_roles ar
          on ar.user_id = ap.user_id and ar.role = rea.role
        where ap.personne_id = rea.personne_id
      );

-- -------------------------------------------------------------
-- 11. FAIL-LOUD : aucune policy ne doit plus tester 'coach'
-- -------------------------------------------------------------
do $verif$
declare
  v_coach_restant int;
  v_helper_seance int;
begin
  -- (a) plus aucune policy mentionnant 'coach'
  select count(*) into v_coach_restant
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual,'') ilike '%coach%' or coalesce(with_check,'') ilike '%coach%');

  if v_coach_restant <> 0 then
    raise exception 'FAIL-LOUD : % policies testent encore coach (migration incomplète).', v_coach_restant;
  end if;

  -- (b) les 2 helpers séance ont bien été créés
  select count(*) into v_helper_seance
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public'
    and p.proname in ('_b5_categorie_de_seance','_b5_categorie_de_seance_bloc');

  if v_helper_seance <> 2 then
    raise exception 'FAIL-LOUD : helpers séance manquants (% / 2).', v_helper_seance;
  end if;

  raise notice 'OK : migration B5 complète, 0 policy coach, 2 helpers séance créés.';
end;
$verif$;

commit;
