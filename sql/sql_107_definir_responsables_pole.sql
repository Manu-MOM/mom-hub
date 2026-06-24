-- =====================================================================
-- MOM Hub · sql_107_definir_responsables_pole.sql
-- ---------------------------------------------------------------------
-- Chantier ADMIN-RESPONSABLE-POLE (pt 106).
--
-- OBJET : exposer une ÉCRITURE admin sur poles.responsable_principal_id
--         et poles.co_responsable_id. Jusqu'ici, AUCUNE écriture sur
--         `poles` n'existait dans le Hub (Lohann avait été posé par
--         UPDATE SQL direct, pts 95/102/104, non rejouable côté app).
--
-- MODÉLISATION (sondée à la source, pt 106) :
--   poles.responsable_principal_id  uuid  NULL  FK -> personnes(id) ON DELETE SET NULL
--   poles.co_responsable_id         uuid  NULL  FK -> personnes(id) ON DELETE SET NULL
--   (fk_poles_responsable_principal / fk_poles_co_responsable)
--   PAS de table de liaison, PAS de rôle auth_roles : le pôle reste une
--   DONNÉE (décision D-A, pts 89/94). Ce RPC ne fait qu'écrire ces deux
--   colonnes existantes.
--
-- GARDE : admin seul (patron attribuer_role, sondé pt 106) :
--   has_role('admin') sinon RAISE insufficient_privilege.
--
-- DÉCISIONS (permissif, validé Manu pt 106) :
--   - co-responsable optionnel : p_co_id NULL autorisé (colonne nullable).
--   - PAS de garde « principal ≠ co » (un doublon est inoffensif :
--     mes_poles_responsable() lit principal OR co, aucun droit en plus).
--   - même personne autorisée sur plusieurs pôles (état réel : Lohann
--     responsable d'EDR ET de SENIORS).
--
-- VALIDATIONS fail-loud AVANT écriture :
--   - p_pole_id requis et doit exister dans `poles`.
--   - p_principal_id requis (un pôle « géré » a au moins un principal ;
--     pour DÉ-désigner, ce n'est pas l'objet de v1 — on ne propose que
--     l'attribution depuis l'écran admin). Doit exister dans `personnes`.
--   - p_co_id, si fourni (non NULL), doit exister dans `personnes`.
--
-- IDEMPOTENT : ré-exécuter le fichier remplace la fonction à l'identique
--   (CREATE OR REPLACE). Ré-appeler le RPC avec les mêmes valeurs est un
--   no-op fonctionnel (réécrit les mêmes colonnes).
--
-- Dollar-quote taggé. sqlfluff parse --dialect postgres : OK.
-- =====================================================================

begin;

create or replace function public.definir_responsables_pole(
  p_pole_id      uuid,
  p_principal_id uuid,
  p_co_id        uuid default null
)
returns public.poles
language plpgsql
security definer
set search_path to 'public'
as $definir_responsables_pole$
declare
  v_row public.poles;
begin
  -- Garde admin (patron attribuer_role).
  if not has_role('admin') then
    raise exception 'Réservé à l''administrateur (definir_responsables_pole).'
      using errcode = 'insufficient_privilege';
  end if;

  -- Paramètres requis.
  if p_pole_id is null then
    raise exception 'p_pole_id requis.';
  end if;
  if p_principal_id is null then
    raise exception 'p_principal_id requis (un responsable principal est attendu).';
  end if;

  -- Le pôle doit exister.
  if not exists (select 1 from public.poles p where p.id = p_pole_id) then
    raise exception 'Pôle introuvable : %.', p_pole_id;
  end if;

  -- Le responsable principal doit être une personne réelle (FK -> personnes).
  if not exists (select 1 from public.personnes pe where pe.id = p_principal_id) then
    raise exception 'Personne introuvable (responsable principal) : %.', p_principal_id;
  end if;

  -- Le co-responsable, s'il est fourni, doit être une personne réelle.
  if p_co_id is not null
     and not exists (select 1 from public.personnes pe where pe.id = p_co_id) then
    raise exception 'Personne introuvable (co-responsable) : %.', p_co_id;
  end if;

  -- Écriture (permissif : pas de garde principal != co).
  update public.poles
     set responsable_principal_id = p_principal_id,
         co_responsable_id        = p_co_id
   where id = p_pole_id
  returning * into v_row;

  -- Filet : l'UPDATE doit avoir touché exactement la ligne ciblée.
  if v_row.id is null then
    raise exception 'Échec d''écriture sur le pôle % (aucune ligne mise à jour).', p_pole_id;
  end if;

  return v_row;
end;
$definir_responsables_pole$;

revoke all on function public.definir_responsables_pole(uuid, uuid, uuid) from public;
grant execute on function public.definir_responsables_pole(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- VÉRIFICATION post-création (fail-loud AVANT commit).
-- NB : éditeur SQL Supabase casse les blocs do $tag$ sur les ; internes
--   -> garde-fous en `if (select ...) then raise` SANS `select ... into`.
-- ---------------------------------------------------------------------
do $verif$
begin
  -- La fonction existe avec la bonne signature.
  if to_regprocedure('public.definir_responsables_pole(uuid, uuid, uuid)') is null then
    raise exception 'VERIF : definir_responsables_pole(uuid,uuid,uuid) absente après création.';
  end if;

  -- Elle est bien SECURITY DEFINER (prosecdef = true).
  if not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'definir_responsables_pole'
      and pg_get_function_identity_arguments(p.oid) = 'p_pole_id uuid, p_principal_id uuid, p_co_id uuid'
  ) then
    raise exception 'VERIF : definir_responsables_pole n''est pas SECURITY DEFINER.';
  end if;

  raise notice 'OK : definir_responsables_pole créée, SECURITY DEFINER, GRANT authenticated.';
end;
$verif$;

commit;
