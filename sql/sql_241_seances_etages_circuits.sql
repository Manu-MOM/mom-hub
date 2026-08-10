-- =====================================================================
-- sql_241_seances_etages_circuits.sql
-- ---------------------------------------------------------------------
-- Objet    : Materialiser la "fiche de marche" du CIRCUIT D'ATELIERS.
--            Une fiche qualifie un etage (seance_id, ordre) de
--            seances_blocs comme circuit rotatif et porte la duree
--            unique de station. Creee A LA DEMANDE, uniquement pour les
--            etages en mode circuit.
--
-- Contexte  : Retour terrain Manu (seance seniors M, Lohann) — besoin
--             d'organiser N ateliers tournants avec N groupes, timing de
--             rotation parametrable + constitution des groupes libre.
--
-- Strategie : ADDITIF PUR cote donnees. Aucune table existante touchee,
--             aucune migration des etages ordinaires (qui restent deduits
--             de l'ordre partage dans seances_blocs, mecanique sql_108).
--
-- FAIT FOI (gele avant code) :
--   D1 circuit = etage parallele existant qualifie rotatif (pas de type de bloc neuf)
--   D2 fiche de marche materialisee a la demande (choix Manu)
--   D3 groupes : groupes_jsonb inchange ; editeur libere (suggestions, front)
--   D4 etiquette profil = etiquette_axe2 existante (annotation indicative)
--   D5 rotation complete implicite, DUREE UNIQUE de station (matrice non stockee)
--   D6 RLS = replique reelle de seances_blocs (sondee en base) :
--      SELECT authentifie ; INSERT/UPDATE/DELETE =
--      admin OR bureau OR puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id))
--
-- Cle       : unicite (seance_id, ordre) — un etage = au plus un circuit.
--             seance_id porte en direct => RLS via _b5_categorie_de_seance,
--             aucun helper nouveau (patron confirme par sonde).
--
-- Preuves   : sqlfluff parse --dialect postgres OK ; dry-run fail-loud en
--             base (bloc DO + RAISE volontaire => rollback integral, table
--             absente apres) ; post-COMMIT verifie : table_ok, rls_active,
--             nb_policies=4, unique_ok, trigger_ok = tous true.
--
-- NOTE      : DEJA APPLIQUE EN BASE PAR L'AGENT via apply_migration
--             (migration 'seances_etages_circuits_circuit_ateliers',
--             feu vert COMMIT explicite Manu). Ce fichier = trace depot.
-- =====================================================================

create table if not exists public.seances_etages_circuits (
  id                 uuid         primary key default gen_random_uuid(),
  seance_id          uuid         not null references public.seances(id) on delete cascade,
  ordre              int          not null,
  est_circuit        boolean      not null default true,
  duree_station_min  int          not null check (duree_station_min > 0 and duree_station_min <= 240),
  notes_circuit      text         null,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),
  constraint seances_etages_circuits_seance_ordre_uniq unique (seance_id, ordre)
);

comment on table public.seances_etages_circuits is
  'Fiche de marche : qualifie un etage (seance_id, ordre) de seances_blocs comme circuit rotatif. Cree a la demande, uniquement pour les etages en mode circuit. Additif pur, aucune migration des etages ordinaires.';
comment on column public.seances_etages_circuits.ordre is
  'ordre de l''etage cible dans seances_blocs (= la valeur ordre partagee par les voies de cet etage).';
comment on column public.seances_etages_circuits.duree_station_min is
  'Duree unique d''une station (minutes). Rotation complete implicite : la matrice n''est pas stockee (deductible N stations / N groupes). Timing par station differe (pas de cas reel).';

create index if not exists idx_sec_seance_id on public.seances_etages_circuits(seance_id);

drop trigger if exists trg_sec_set_updated_at on public.seances_etages_circuits;
create trigger trg_sec_set_updated_at
  before update on public.seances_etages_circuits
  for each row
  execute function public.trigger_set_updated_at();

alter table public.seances_etages_circuits enable row level security;

drop policy if exists sec_select_authenticated on public.seances_etages_circuits;
create policy sec_select_authenticated
  on public.seances_etages_circuits
  for select
  to authenticated
  using (true);

drop policy if exists sec_insert_admin_bureau_referent on public.seances_etages_circuits;
create policy sec_insert_admin_bureau_referent
  on public.seances_etages_circuits
  for insert
  to authenticated
  with check (has_role('admin') or has_role('bureau') or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id)));

drop policy if exists sec_update_admin_bureau_referent on public.seances_etages_circuits;
create policy sec_update_admin_bureau_referent
  on public.seances_etages_circuits
  for update
  to authenticated
  using      (has_role('admin') or has_role('bureau') or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id)))
  with check (has_role('admin') or has_role('bureau') or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id)));

drop policy if exists sec_delete_admin_bureau_referent on public.seances_etages_circuits;
create policy sec_delete_admin_bureau_referent
  on public.seances_etages_circuits
  for delete
  to authenticated
  using (has_role('admin') or has_role('bureau') or puis_je_ecrire_categorie(_b5_categorie_de_seance(seance_id)));
