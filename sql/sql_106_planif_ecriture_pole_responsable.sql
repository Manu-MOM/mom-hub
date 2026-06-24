-- =====================================================================
-- sql_106_planif_ecriture_pole_responsable.sql
-- =====================================================================
-- Chantier  : PLANIF-ECRITURE-POLE (pt 106)
-- Objet     : ouvrir l'ECRITURE des trames de planification de POLE au
--             RESPONSABLE DESIGNE du pole (critere (a) Manu : seul le
--             responsable principal OU co-responsable, PAS tout encadrant
--             d'une categorie du pole).
--
-- Decision Manu (acquise) : Lohann (et tout responsable de pole) ecrit
--   sur SES poles (responsable designe) et lit le reste.
--
-- Constat sondes (pt 104/106, DS-1) :
--   - mes_poles_responsable() EXISTE DEJA (corps : qui_suis_je ->
--     personne_id confronte a poles.responsable_principal_id /
--     co_responsable_id, renvoie TABLE(pole_id uuid)). RIEN A CREER.
--   - RLS planification_blocs : SELECT pole deja ouvert via
--     mes_poles_autorises() (lecture du reste OK, non touche).
--     INSERT/UPDATE/DELETE branche pole = has_role('admin') OR
--     has_role('bureau') UNIQUEMENT -> a elargir au responsable designe.
--   - Branche categorie (puis_je_ecrire_categorie) et ELSE false :
--     reproduites a l'identique, NON modifiees.
--
-- Portee : 3 politiques d'ecriture, branche pole_id IS NOT NULL seule.
--   - planification_blocs_delete  : USING
--   - planification_blocs_insert  : WITH CHECK
--   - planification_blocs_update  : USING + WITH CHECK
--   SELECT NON touche.
--
-- Discipline : idempotent (DROP POLICY IF EXISTS + CREATE), garde-fou
--   fail-loud do $verif$ AVANT COMMIT, ZERO CREATE FUNCTION.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Garde-fou amont : la fonction de responsabilite de pole DOIT exister.
-- (anti-mensonge : on ne branche pas une RLS sur une fonction absente)
-- ---------------------------------------------------------------------
do $garde_amont$
begin
  if to_regprocedure('public.mes_poles_responsable()') is null then
    raise exception
      'ABORT: fonction public.mes_poles_responsable() introuvable - prerequis du branchement RLS.';
  end if;
end;
$garde_amont$;

-- ---------------------------------------------------------------------
-- DELETE : branche pole elargie au responsable designe (USING).
-- ---------------------------------------------------------------------
drop policy if exists planification_blocs_delete on public.planification_blocs;

create policy planification_blocs_delete
  on public.planification_blocs
  for delete
  using (
    case
      when (pole_id is not null) then (
        has_role('admin'::text)
        or has_role('bureau'::text)
        or exists (
          select 1
          from mes_poles_responsable() mp
          where mp.pole_id = planification_blocs.pole_id
        )
      )
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

-- ---------------------------------------------------------------------
-- INSERT : branche pole elargie au responsable designe (WITH CHECK).
-- ---------------------------------------------------------------------
drop policy if exists planification_blocs_insert on public.planification_blocs;

create policy planification_blocs_insert
  on public.planification_blocs
  for insert
  with check (
    case
      when (pole_id is not null) then (
        has_role('admin'::text)
        or has_role('bureau'::text)
        or exists (
          select 1
          from mes_poles_responsable() mp
          where mp.pole_id = planification_blocs.pole_id
        )
      )
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

-- ---------------------------------------------------------------------
-- UPDATE : branche pole elargie au responsable designe (USING + WITH CHECK).
-- ---------------------------------------------------------------------
drop policy if exists planification_blocs_update on public.planification_blocs;

create policy planification_blocs_update
  on public.planification_blocs
  for update
  using (
    case
      when (pole_id is not null) then (
        has_role('admin'::text)
        or has_role('bureau'::text)
        or exists (
          select 1
          from mes_poles_responsable() mp
          where mp.pole_id = planification_blocs.pole_id
        )
      )
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  )
  with check (
    case
      when (pole_id is not null) then (
        has_role('admin'::text)
        or has_role('bureau'::text)
        or exists (
          select 1
          from mes_poles_responsable() mp
          where mp.pole_id = planification_blocs.pole_id
        )
      )
      when (categorie_id is not null) then puis_je_ecrire_categorie(categorie_id)
      else false
    end
  );

-- ---------------------------------------------------------------------
-- Garde-fou aval fail-loud : les 3 politiques d'ecriture doivent exister
-- ET leur expression doit contenir mes_poles_responsable (branchement
-- effectif). SELECT volontairement exclu (non touche).
-- ---------------------------------------------------------------------
do $verif$
begin
  -- (1) les 3 politiques d'ecriture existent
  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'planification_blocs'
      and policyname in (
        'planification_blocs_delete',
        'planification_blocs_insert',
        'planification_blocs_update'
      )
  ) <> 3 then
    raise exception
      'ABORT: politique(s) d''ecriture manquante(s) sur planification_blocs.';
  end if;

  -- (2) chacune mentionne mes_poles_responsable dans qual OU with_check
  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'planification_blocs'
      and policyname in (
        'planification_blocs_delete',
        'planification_blocs_insert',
        'planification_blocs_update'
      )
      and coalesce(qual, '') !~ 'mes_poles_responsable'
      and coalesce(with_check, '') !~ 'mes_poles_responsable'
  ) <> 0 then
    raise exception
      'ABORT: politique(s) d''ecriture sans branchement mes_poles_responsable.';
  end if;

  raise notice 'OK: 3 politiques d''ecriture branchees sur mes_poles_responsable (SELECT non touche).';
end;
$verif$;

commit;
