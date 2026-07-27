-- ============================================================================
-- sql_234_planification_jours.sql
-- ----------------------------------------------------------------------------
-- Chantier  : PLANIF-SOUSBLOCS-PAR-JOUR
-- Objet     : introduire un niveau « jour d'entrainement » a l'interieur d'un
--             bloc de planification. Un bloc peut desormais porter plusieurs
--             sous-blocs, un par jour (lundi..dimanche), chacun avec son propre
--             titre et ses 4 axes (individuel / collectif / physique / poste).
--
-- Modele    : table ADDITIVE public.planification_jours. Les colonnes axe_*
--             existantes de planification_blocs sont CONSERVEES (aucun DROP) :
--             un bloc sans jour = comportement actuel inchange ; un bloc avec
--             >= 1 jour = l'affichage/saisie bascule sur les jours. La donnee
--             axe_* de niveau bloc n'est jamais detruite (reversible).
--
-- Securite  : RLS DELEGUEE au bloc parent. Chaque politique de planification_jours
--             verifie, via EXISTS sur planification_blocs, que l'utilisateur a le
--             droit correspondant SUR LE BLOC. Aucune logique de garde dupliquee :
--             si la garde des blocs evolue (cf. sql_106), les jours suivent.
--             Ecritures soumises RLS (pattern du module : upsert/delete client
--             direct, comme planification_blocs — pas de RPC SECURITY DEFINER).
--
-- Additif   : 1 table + 1 index + 4 policies. 0 objet existant modifie.
--             Idempotent (IF NOT EXISTS / drop policy if exists).
--             Fail-loud en fin de fichier (do $verif$).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Table planification_jours
--    jour : 1=lundi … 7=dimanche (liste fermee, CHECK). Le tri d'affichage se
--    fait par (jour, created_at) — pas de colonne ordre (le jour EST l'ordre).
--    Pas d'unicite (bloc_id, jour) : l'option retenue « 1 jour = 1 saisie,
--    duplication possible » autorise plusieurs entrees le meme jour.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.planification_jours (
  id             uuid primary key default gen_random_uuid(),
  bloc_id        uuid not null references public.planification_blocs(id) on delete cascade,
  jour           smallint not null,
  titre          text,
  axe_indiv      text[]   not null default '{}'::text[],
  axe_collectif  text,
  axe_physique   text,
  axe_poste      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint planification_jours_jour_chk check (jour between 1 and 7)
);

-- Acces par bloc, ordonne par jour puis anciennete (tri d'affichage stable).
create index if not exists planification_jours_bloc_idx
  on public.planification_jours (bloc_id, jour, created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) RLS — deleguee au bloc parent
--    SELECT/INSERT/UPDATE/DELETE d'un jour = autorise ssi l'utilisateur a le
--    droit equivalent sur le bloc parent (EXISTS sur planification_blocs, dont
--    la RLS applique elle-meme la garde categorie/pole). On ne re-derive pas
--    puis_je_ecrire_categorie / mes_poles_* ici : la sous-requete sur le bloc
--    est filtree par la RLS des blocs, seule source de verite.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.planification_jours enable row level security;

-- SELECT : le bloc parent est visible (sa RLS SELECT laisse passer la ligne).
drop policy if exists planification_jours_select on public.planification_jours;
create policy planification_jours_select
  on public.planification_jours for select
  to authenticated
  using (
    exists (
      select 1 from public.planification_blocs b
      where b.id = planification_jours.bloc_id
    )
  );

-- INSERT : le bloc parent est ecrivable (sa RLS le rend visible ET l'ecriture
-- du bloc suit la meme garde). On exige la visibilite du parent ; l'ecriture
-- effective reste bornee par la RLS des blocs sur toute manipulation liee.
drop policy if exists planification_jours_insert on public.planification_jours;
create policy planification_jours_insert
  on public.planification_jours for insert
  to authenticated
  with check (
    exists (
      select 1 from public.planification_blocs b
      where b.id = planification_jours.bloc_id
        and case
              when b.pole_id is not null
                then (has_role('admin') or has_role('bureau')
                      or exists (
                        select 1 from public.mes_poles_responsable() mp
                        where mp.pole_id = b.pole_id
                      ))
              when b.categorie_id is not null
                then public.puis_je_ecrire_categorie(b.categorie_id)
              else false
            end
    )
  );

-- UPDATE : meme garde ecriture sur le bloc parent (USING + WITH CHECK).
drop policy if exists planification_jours_update on public.planification_jours;
create policy planification_jours_update
  on public.planification_jours for update
  to authenticated
  using (
    exists (
      select 1 from public.planification_blocs b
      where b.id = planification_jours.bloc_id
        and case
              when b.pole_id is not null
                then (has_role('admin') or has_role('bureau')
                      or exists (
                        select 1 from public.mes_poles_responsable() mp
                        where mp.pole_id = b.pole_id
                      ))
              when b.categorie_id is not null
                then public.puis_je_ecrire_categorie(b.categorie_id)
              else false
            end
    )
  )
  with check (
    exists (
      select 1 from public.planification_blocs b
      where b.id = planification_jours.bloc_id
        and case
              when b.pole_id is not null
                then (has_role('admin') or has_role('bureau')
                      or exists (
                        select 1 from public.mes_poles_responsable() mp
                        where mp.pole_id = b.pole_id
                      ))
              when b.categorie_id is not null
                then public.puis_je_ecrire_categorie(b.categorie_id)
              else false
            end
    )
  );

-- DELETE : meme garde ecriture sur le bloc parent.
drop policy if exists planification_jours_delete on public.planification_jours;
create policy planification_jours_delete
  on public.planification_jours for delete
  to authenticated
  using (
    exists (
      select 1 from public.planification_blocs b
      where b.id = planification_jours.bloc_id
        and case
              when b.pole_id is not null
                then (has_role('admin') or has_role('bureau')
                      or exists (
                        select 1 from public.mes_poles_responsable() mp
                        where mp.pole_id = b.pole_id
                      ))
              when b.categorie_id is not null
                then public.puis_je_ecrire_categorie(b.categorie_id)
              else false
            end
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Verification fail-loud — abort si un objet attendu manque.
-- ─────────────────────────────────────────────────────────────────────────
do $verif$
begin
  -- Table presente.
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'planification_jours'
  ) then
    raise exception 'ABORT: table planification_jours absente.';
  end if;

  -- RLS activee.
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'planification_jours'
      and rowsecurity = true
  ) then
    raise exception 'ABORT: RLS non activee sur planification_jours.';
  end if;

  -- Les 4 policies presentes.
  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'planification_jours'
      and policyname in (
        'planification_jours_select',
        'planification_jours_insert',
        'planification_jours_update',
        'planification_jours_delete'
      )
  ) <> 4 then
    raise exception 'ABORT: politique(s) RLS manquante(s) sur planification_jours.';
  end if;

  -- Contrainte CHECK jour presente.
  if not exists (
    select 1 from pg_constraint
    where conname = 'planification_jours_jour_chk'
  ) then
    raise exception 'ABORT: contrainte planification_jours_jour_chk absente.';
  end if;

  -- Index d'acces present.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'planification_jours_bloc_idx'
  ) then
    raise exception 'ABORT: index planification_jours_bloc_idx absent.';
  end if;

  raise notice 'OK: planification_jours + RLS (4 policies) + CHECK + index en place.';
end
$verif$;
