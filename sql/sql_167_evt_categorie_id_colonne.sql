-- =====================================================================
-- sql_167 — EVT-RATTACHEMENT-CATEGORIE — Étape 1/7 : colonne categorie_id
-- =====================================================================
-- Ajoute evenements.categorie_id (nullable, FK -> categories.id).
-- AUCUNE contrainte existante modifiée. AUCUN remplissage ici (étape 2).
-- Nullable au départ => zéro casse sur les 31 événements existants.
--
-- Réversibilité :
--   DROP INDEX IF EXISTS idx_evenements_categorie_id;
--   ALTER TABLE public.evenements DROP COLUMN IF EXISTS categorie_id;
--
-- DS-1 (sondé le 07/07/2026) :
--   - public.categories existe, PK id uuid.
--   - evenements.categorie_id absente (0 collision).
--   - ON DELETE RESTRICT : cohérent avec equipe_id/saison_id/organisateur
--     (une catégorie référencée ne doit pas disparaître sous un événement).
-- =====================================================================

do $verif$
begin
  -- Garde-fou : la colonne ne doit pas déjà exister.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'evenements'
      and column_name  = 'categorie_id'
  ) then
    raise exception 'ABORT sql_167 : evenements.categorie_id existe déjà';
  end if;

  -- Garde-fou : la table cible de la FK doit exister.
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'categories'
  ) then
    raise exception 'ABORT sql_167 : table public.categories introuvable';
  end if;
end
$verif$;

alter table public.evenements
  add column categorie_id uuid
  references public.categories(id) on delete restrict;

comment on column public.evenements.categorie_id is
  'Catégorie de rattachement (chantier EVT-RATTACHEMENT-CATEGORIE, sql_167). '
  'Nullable en étape 1 ; deviendra obligatoire pour entrainement/stage en '
  'étape 4. equipe_id conservé facultatif (compétitions).';

create index if not exists idx_evenements_categorie_id
  on public.evenements (categorie_id);

-- Vérification finale fail-loud : colonne bien créée, toujours nullable.
do $check$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='evenements'
      and column_name='categorie_id' and is_nullable='YES'
  ) then
    raise exception 'ABORT sql_167 : colonne categorie_id absente ou non-nullable après ALTER';
  end if;
  raise notice 'sql_167 OK : evenements.categorie_id créée (nullable, FK categories, index).';
end
$check$;
