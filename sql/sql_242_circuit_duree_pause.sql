-- =====================================================================
-- sql_242_circuit_duree_pause.sql
-- ---------------------------------------------------------------------
-- Objet    : Ajouter le temps de pause entre stations a la fiche de
--            marche du circuit d'ateliers (retour terrain Manu, recette
--            du mecanisme circuit).
--
-- Contexte : Deux retours de recette du circuit (seance-editor v1.20) :
--            (1) la duree d'un etage-circuit doit compter les stations en
--                SUCCESSION, pas en simultane (corrige cote JS) ;
--            (2) besoin d'un temps de pause/transition entre 2 stations
--                (cette colonne).
--            Formule : duree etage-circuit =
--              (duree_station_min * nb_stations)
--            + (duree_pause_min   * (nb_stations - 1)).
--            La pause n'existe qu'ENTRE les stations => (nb - 1) intervalles.
--
-- Strategie : ADDITIF PUR. Colonne NOT NULL DEFAULT 0, CHECK 0..60. Les
--            circuits anterieurs passent a 0 (pause nulle) => calcul de
--            duree inchange pour eux, aucune casse.
--
-- Preuves  : dry-run fail-loud en base (bloc DO + RAISE volontaire =>
--            rollback integral, colonne absente apres) ; post-COMMIT
--            verifie : type=integer, nullable=NO, default=0, circuit
--            existant backfille a 0 (nb_a_zero = nb_total = 1).
--
-- NOTE     : DEJA APPLIQUE EN BASE PAR L'AGENT via apply_migration
--            (migration 'seances_etages_circuits_duree_pause', feu vert
--            COMMIT explicite Manu). Ce fichier = trace depot.
-- =====================================================================

alter table public.seances_etages_circuits
  add column if not exists duree_pause_min int not null default 0
  check (duree_pause_min >= 0 and duree_pause_min <= 60);

comment on column public.seances_etages_circuits.duree_pause_min is
  'Temps de pause/transition entre deux stations (minutes, 0..60). Duree etage-circuit = (duree_station_min * nb_stations) + (duree_pause_min * (nb_stations - 1)). DEFAULT 0 = pas de pause (circuits anterieurs non impactes).';
