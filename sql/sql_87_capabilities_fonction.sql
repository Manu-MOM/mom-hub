-- =============================================================
-- sql/sql_87_capabilities_fonction.sql
--
-- BUT : créer et peupler la table de CAPABILITIES PAR FONCTION
--       (modèle S1, voie 2 « Gestion du sportif »). Une ligne de
--       donnée = un couple (fonction encadrante, action métier)
--       autorisé. Ajouter un droit = INSERT, jamais de DDL de rôle.
--
-- CONTEXTE (pt 89 → production voie 2, FAIT FOI md5 9aa943e6) :
--   - Décision D-A : les droits fins NE sont PAS portés par N rôles
--     auth_roles. Le rôle 'referent' reste le jeton de voie grossier
--     (porte, D-B) ; la FINESSE vient de la fonction_staff croisée à
--     CETTE table. Évite le rôle fantôme (leçon ROLE-COACH pt 87).
--   - Décision D-C : cumul = UNION (le plus permissif gagne). Cette
--     table ne fait que DÉCLARER les droits ; l'Union est appliquée
--     par le helper puis_je_FAIRE (lot 2, fichier séparé).
--
-- CLÉS RÉELLES (sondées à la source, _b5_norm des fonction_staff
--   actives — pas inventées) :
--     referent de categorie / manager /
--     entraineur principal / entraineur adjoint
--
-- CONTENU = traduction DIRECTE de la matrice métier (FAIT FOI §4.1),
--   validée par Manu. 6 actions :
--     ecrire_seance, ecrire_compo, valider_compo,
--     gerer_presences, gerer_evenements, composer_effectif
--
-- PORTÉE DE CE FICHIER : donnée plate UNIQUEMENT. Aucune policy
--   touchée, aucun helper d'autorisation créé ici. Lecture SELECT
--   ouverte à authenticated (table de référence non sensible),
--   écriture réservée à admin (hand-edit assumé via Studio/admin).
--
-- Idempotent (IF NOT EXISTS + upsert), transaction, fail-loud.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. Table de référence (donnée plate, modèle « long »)
--    PK composite (fonction, action) : ajouter une action future
--    = INSERT de lignes, pas d'ALTER TABLE. P1-conforme.
-- -------------------------------------------------------------

create table if not exists public.capabilities_fonction (
  fonction_normalisee text    not null,
  action              text    not null,
  autorise            boolean not null default false,
  primary key (fonction_normalisee, action)
);

comment on table public.capabilities_fonction is
  'Voie 2 (modèle S1) : droits fins par fonction encadrante. '
  '1 ligne = (fonction _b5_norm, action métier) autorisé ou non. '
  'Consommée par puis_je_FAIRE (Union, D-C). Hand-editable (P1).';

-- Borne les actions connues : empêche une faute de frappe d'action
-- de créer une capability silencieusement morte. Additif : étendre
-- l'ARRAY pour une action future (P4 : on borne, on n'invente pas).
alter table public.capabilities_fonction
  drop constraint if exists capabilities_fonction_action_check;
alter table public.capabilities_fonction
  add constraint capabilities_fonction_action_check
  check (action = any (array[
    'ecrire_seance',
    'ecrire_compo',
    'valider_compo',
    'gerer_presences',
    'gerer_evenements',
    'composer_effectif'
  ]));

-- -------------------------------------------------------------
-- 2. Peuplement = matrice §4.1 (upsert idempotent)
--    referent  : tout (✓ partout)
--    manager    : présences, événements, effectif
--    principal  : séance, compo, présences, événements
--    adjoint    : séance, présences
-- -------------------------------------------------------------

insert into public.capabilities_fonction (fonction_normalisee, action, autorise) values
  -- Référent de catégorie : profil complet
  ('referent de categorie', 'ecrire_seance',     true),
  ('referent de categorie', 'ecrire_compo',      true),
  ('referent de categorie', 'valider_compo',     true),
  ('referent de categorie', 'gerer_presences',   true),
  ('referent de categorie', 'gerer_evenements',  true),
  ('referent de categorie', 'composer_effectif', true),
  -- Manager : axe administratif / organisationnel
  ('manager', 'ecrire_seance',     false),
  ('manager', 'ecrire_compo',      false),
  ('manager', 'valider_compo',     false),
  ('manager', 'gerer_presences',   true),
  ('manager', 'gerer_evenements',  true),
  ('manager', 'composer_effectif', true),
  -- Entraîneur principal (Coach) : axe terrain / sportif
  ('entraineur principal', 'ecrire_seance',     true),
  ('entraineur principal', 'ecrire_compo',      true),
  ('entraineur principal', 'valider_compo',     false),
  ('entraineur principal', 'gerer_presences',   true),
  ('entraineur principal', 'gerer_evenements',  true),
  ('entraineur principal', 'composer_effectif', false),
  -- Entraîneur adjoint : sous-ensemble terrain (⊂ principal moins compo)
  ('entraineur adjoint', 'ecrire_seance',     true),
  ('entraineur adjoint', 'ecrire_compo',      false),
  ('entraineur adjoint', 'valider_compo',     false),
  ('entraineur adjoint', 'gerer_presences',   true),
  ('entraineur adjoint', 'gerer_evenements',  false),
  ('entraineur adjoint', 'composer_effectif', false)
on conflict (fonction_normalisee, action)
  do update set autorise = excluded.autorise;

-- -------------------------------------------------------------
-- 3. Droits d'accès : lecture authenticated, écriture admin
-- -------------------------------------------------------------

alter table public.capabilities_fonction enable row level security;

drop policy if exists capabilities_fonction_select on public.capabilities_fonction;
create policy capabilities_fonction_select
  on public.capabilities_fonction
  for select
  to authenticated
  using (true);

drop policy if exists capabilities_fonction_write_admin on public.capabilities_fonction;
create policy capabilities_fonction_write_admin
  on public.capabilities_fonction
  for all
  to authenticated
  using (has_role('admin'))
  with check (has_role('admin'));

-- -------------------------------------------------------------
-- 4. GARDE ANTI-VIDAGE DU RÉFÉRENT (pendant de l'anti-lockout
--    admin sur attribuer_role).
--    Invariant : après toute écriture, 'referent de categorie'
--    conserve AU MOINS une capability autorise=true. On interdit
--    le VIDAGE INTÉGRAL (sinon plus personne n'écrit sur sa
--    catégorie), pas l'ajustement à la marge. Trigger BEFORE :
--    explicite, fail-loud, indépendant du chemin d'écriture
--    (console future, UPSERT, ou SQL direct).
-- -------------------------------------------------------------

create or replace function public._capabilities_referent_non_vide()
returns trigger
language plpgsql
as $fn$
declare
  v_referent_actives int;
begin
  -- État de la table APRÈS l'opération en cours (la ligne modifiée
  -- est déjà visible dans la table pour un trigger AFTER ; en BEFORE
  -- on recompte hors ligne courante puis on réintègre NEW/OLD).
  select count(*) into v_referent_actives
  from public.capabilities_fonction
  where fonction_normalisee = 'referent de categorie'
    and autorise is true
    and not (
      tg_op in ('UPDATE','DELETE')
      and fonction_normalisee = old.fonction_normalisee
      and action = old.action
    );

  -- Réintègre l'effet de NEW pour INSERT/UPDATE.
  if tg_op in ('INSERT','UPDATE')
     and new.fonction_normalisee = 'referent de categorie'
     and new.autorise is true then
    v_referent_actives := v_referent_actives + 1;
  end if;

  if v_referent_actives < 1 then
    raise exception
      'ANTI-VIDAGE : refus — le référent doit conserver au moins une capability active.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_capabilities_referent_non_vide on public.capabilities_fonction;
create trigger trg_capabilities_referent_non_vide
  before insert or update or delete on public.capabilities_fonction
  for each row
  execute function public._capabilities_referent_non_vide();

-- -------------------------------------------------------------
-- 5. FAIL-LOUD : la table doit refléter EXACTEMENT la matrice
--    24 lignes (4 fonctions × 6 actions), 15 autorisées.
-- -------------------------------------------------------------
do $verif$
declare
  v_total       int;
  v_autorisees  int;
  v_fonctions   int;
begin
  select count(*) into v_total
  from public.capabilities_fonction;
  if v_total <> 24 then
    raise exception 'FAIL-LOUD : % lignes capabilities (attendu 24 = 4×6).', v_total;
  end if;

  select count(*) into v_autorisees
  from public.capabilities_fonction
  where autorise is true;
  if v_autorisees <> 15 then
    raise exception 'FAIL-LOUD : % capabilities autorisées (attendu 15).', v_autorisees;
  end if;

  select count(distinct fonction_normalisee) into v_fonctions
  from public.capabilities_fonction;
  if v_fonctions <> 4 then
    raise exception 'FAIL-LOUD : % fonctions distinctes (attendu 4).', v_fonctions;
  end if;

  -- Garde-fou métier : valider_compo réservé au seul référent.
  if exists (
    select 1 from public.capabilities_fonction
    where action = 'valider_compo' and autorise is true
      and fonction_normalisee <> 'referent de categorie'
  ) then
    raise exception 'FAIL-LOUD : valider_compo autorisé hors référent.';
  end if;

  raise notice 'OK : capabilities_fonction = 24 lignes, 15 autorisées, 4 fonctions, valider_compo=référent seul.';
end;
$verif$;

commit;
