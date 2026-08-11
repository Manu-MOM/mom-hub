-- ============================================================================
-- Chantier : Rencontres tournantes entre equipes
-- Objet    : 3 colonnes additives sur seances_etages_circuits (mode / roles / rotation)
-- Additif pur : backfill par DEFAULT, aucune donnee existante reecrite.
-- ============================================================================

alter table public.seances_etages_circuits
    add column if not exists mode text not null default 'circuit';

alter table public.seances_etages_circuits
    add column if not exists roles_voies_jsonb jsonb not null default '{}'::jsonb;

alter table public.seances_etages_circuits
    add column if not exists rotation_kind text not null default 'cyclique';

alter table public.seances_etages_circuits
    add constraint seances_etages_circuits_mode_check
    check (mode in ('circuit', 'rencontres'));

alter table public.seances_etages_circuits
    add constraint seances_etages_circuits_rotation_kind_check
    check (rotation_kind in ('cyclique', 'vainqueur_reste'));
