-- ============================================================
-- sql_239_planification_fils_rouges.sql
-- ------------------------------------------------------------
-- Chantier : PLANIF-FIL-ROUGE
--
-- Objet : introduire la notion de « fil rouge » dans la planification
--   annuelle. Un fil rouge est une compétence suivie tout au long de
--   la saison, décrite par une suite d'ÉTAPES datées (variante B :
--   bandeau d'étapes sous la frise). Plusieurs fils rouges possibles
--   par planification.
--
-- Modèle — deux tables :
--   1. planification_fils_rouges   (le fil : nom, couleur, ordre, portée)
--   2. planification_fil_rouge_etapes (les étapes datées : titre, texte)
--
-- Portée & RLS :
--   - planification_fils_rouges porte la portée (categorie_id XOR pole_id)
--     + saison_id, comme planification_blocs, et reçoit les MÊMES 4
--     policies (copie fidèle : has_role/mes_poles_*/puis_je_ecrire_categorie).
--   - planification_fil_rouge_etapes n'a PAS de portée propre : elle
--     hérite de celle de son fil parent via EXISTS (patron table-fille).
--
-- Écriture : upsert PostgREST direct (cohérent avec planification_blocs).
-- Suppression : on delete cascade (fil -> étapes ; portée -> fils).
--
-- Doctrine : création de tables => RLS écrites dès le départ, pas
--   d'audit rétroactif. FKs cascade calquées sur planification_blocs.
-- ============================================================


-- ============================================================
-- 1. TABLE planification_fils_rouges
-- ============================================================
create table if not exists public.planification_fils_rouges (
  id           uuid primary key default gen_random_uuid(),
  saison_id    uuid not null references public.saisons(id)    on delete cascade,
  categorie_id uuid          references public.categories(id) on delete cascade,
  pole_id      uuid          references public.poles(id)      on delete cascade,
  nom          text not null,
  couleur      text,                        -- clé de palette (ex. 'fr-rouge')
  ordre        integer not null default 0,  -- empilement des bandeaux
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now(),
  -- portée : catégorie XOR pôle (identique à planification_blocs)
  constraint planification_fils_rouges_portee_chk check (
    ((categorie_id is not null) and (pole_id is null))
    or ((categorie_id is null) and (pole_id is not null))
  )
);

create index if not exists idx_pfr_saison    on public.planification_fils_rouges(saison_id);
create index if not exists idx_pfr_categorie on public.planification_fils_rouges(categorie_id);
create index if not exists idx_pfr_pole      on public.planification_fils_rouges(pole_id);


-- ============================================================
-- 2. TABLE planification_fil_rouge_etapes
-- ============================================================
create table if not exists public.planification_fil_rouge_etapes (
  id            uuid primary key default gen_random_uuid(),
  fil_rouge_id  uuid not null
    references public.planification_fils_rouges(id) on delete cascade,
  date_debut    date,
  date_fin      date,
  titre         text not null,
  texte         text,
  ordre         integer not null default 0,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now()
);

create index if not exists idx_pfre_fil on public.planification_fil_rouge_etapes(fil_rouge_id);


-- ============================================================
-- 3. RLS — planification_fils_rouges (copie fidèle de planification_blocs)
-- ============================================================
alter table public.planification_fils_rouges enable row level security;

drop policy if exists planification_fils_rouges_select on public.planification_fils_rouges;
create policy planification_fils_rouges_select
  on public.planification_fils_rouges for select
  using (
    case
      when (pole_id is not null) then (exists (
        select 1 from mes_poles_autorises() mp(pole_id, est_transverse)
        where (mp.est_transverse or (mp.pole_id = planification_fils_rouges.pole_id))))
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

drop policy if exists planification_fils_rouges_insert on public.planification_fils_rouges;
create policy planification_fils_rouges_insert
  on public.planification_fils_rouges for insert
  with check (
    case
      when (pole_id is not null) then (has_role('admin'::text) or has_role('bureau'::text) or (exists (
        select 1 from mes_poles_responsable() mp(pole_id)
        where (mp.pole_id = planification_fils_rouges.pole_id))))
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

drop policy if exists planification_fils_rouges_update on public.planification_fils_rouges;
create policy planification_fils_rouges_update
  on public.planification_fils_rouges for update
  using (
    case
      when (pole_id is not null) then (has_role('admin'::text) or has_role('bureau'::text) or (exists (
        select 1 from mes_poles_responsable() mp(pole_id)
        where (mp.pole_id = planification_fils_rouges.pole_id))))
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  )
  with check (
    case
      when (pole_id is not null) then (has_role('admin'::text) or has_role('bureau'::text) or (exists (
        select 1 from mes_poles_responsable() mp(pole_id)
        where (mp.pole_id = planification_fils_rouges.pole_id))))
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

drop policy if exists planification_fils_rouges_delete on public.planification_fils_rouges;
create policy planification_fils_rouges_delete
  on public.planification_fils_rouges for delete
  using (
    case
      when (pole_id is not null) then (has_role('admin'::text) or has_role('bureau'::text) or (exists (
        select 1 from mes_poles_responsable() mp(pole_id)
        where (mp.pole_id = planification_fils_rouges.pole_id))))
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );


-- ============================================================
-- 4. RLS — planification_fil_rouge_etapes (héritée du fil parent)
--    Une étape est accessible (lecture/écriture) ssi son fil rouge
--    l'est. On délègue la décision à la RLS de la table mère via EXISTS.
-- ============================================================
alter table public.planification_fil_rouge_etapes enable row level security;

drop policy if exists planification_fil_rouge_etapes_select on public.planification_fil_rouge_etapes;
create policy planification_fil_rouge_etapes_select
  on public.planification_fil_rouge_etapes for select
  using (exists (
    select 1 from public.planification_fils_rouges fr
    where fr.id = planification_fil_rouge_etapes.fil_rouge_id
  ));

drop policy if exists planification_fil_rouge_etapes_insert on public.planification_fil_rouge_etapes;
create policy planification_fil_rouge_etapes_insert
  on public.planification_fil_rouge_etapes for insert
  with check (exists (
    select 1 from public.planification_fils_rouges fr
    where fr.id = planification_fil_rouge_etapes.fil_rouge_id
  ));

drop policy if exists planification_fil_rouge_etapes_update on public.planification_fil_rouge_etapes;
create policy planification_fil_rouge_etapes_update
  on public.planification_fil_rouge_etapes for update
  using (exists (
    select 1 from public.planification_fils_rouges fr
    where fr.id = planification_fil_rouge_etapes.fil_rouge_id
  ))
  with check (exists (
    select 1 from public.planification_fils_rouges fr
    where fr.id = planification_fil_rouge_etapes.fil_rouge_id
  ));

drop policy if exists planification_fil_rouge_etapes_delete on public.planification_fil_rouge_etapes;
create policy planification_fil_rouge_etapes_delete
  on public.planification_fil_rouge_etapes for delete
  using (exists (
    select 1 from public.planification_fils_rouges fr
    where fr.id = planification_fil_rouge_etapes.fil_rouge_id
  ));


-- ============================================================
-- 5. Vérification fail-loud
-- ============================================================
do $verif$
declare
  v_t1 boolean;
  v_t2 boolean;
  v_rls1 boolean;
  v_rls2 boolean;
  v_pol integer;
begin
  select exists (select 1 from information_schema.tables
    where table_schema='public' and table_name='planification_fils_rouges') into v_t1;
  select exists (select 1 from information_schema.tables
    where table_schema='public' and table_name='planification_fil_rouge_etapes') into v_t2;

  select relrowsecurity from pg_class where oid='public.planification_fils_rouges'::regclass into v_rls1;
  select relrowsecurity from pg_class where oid='public.planification_fil_rouge_etapes'::regclass into v_rls2;

  select count(*) from pg_policies
    where schemaname='public'
      and tablename in ('planification_fils_rouges','planification_fil_rouge_etapes')
    into v_pol;

  if not v_t1 then raise exception 'sql_239 FAIL : table planification_fils_rouges absente'; end if;
  if not v_t2 then raise exception 'sql_239 FAIL : table planification_fil_rouge_etapes absente'; end if;
  if not v_rls1 then raise exception 'sql_239 FAIL : RLS non activée sur fils_rouges'; end if;
  if not v_rls2 then raise exception 'sql_239 FAIL : RLS non activée sur etapes'; end if;
  if v_pol <> 8 then raise exception 'sql_239 FAIL : attendu 8 policies, trouvé %', v_pol; end if;

  raise notice 'sql_239 OK : 2 tables + RLS (8 policies) en place';
end;
$verif$;
