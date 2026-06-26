-- sql_121 — entites : adresse de facturation
-- Chantier MISSION-TO-COUNTER-FRONT-VIGNETTES (conception pt 113 → production).
-- Colonne additive adresse_facturation (renseignée dans l'onglet Entités, PAS à la
-- création à la volée depuis le formulaire mission) + extension de upsert_entite avec
-- un 13e paramètre p_adresse_facturation (DEFAULT NULL).
--
-- DROP de l'ancienne signature 12-params AVANT le CREATE 13-params : évite la
-- surcharge ambiguë (« function is not unique ») sur les appels par nom du front.
-- Le front (helper rpc('upsert_entite', {...}) à 12 clés) résout sans ambiguïté vers
-- l'unique fonction ; le 13e param prend son défaut NULL. Aucune régression (appel
-- par nom). DROP ne touche que la définition de fonction, pas les données entites.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Colonne additive (non destructive, idempotente).
-- ───────────────────────────────────────────────────────────────────────────
alter table public.entites
  add column if not exists adresse_facturation text;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. DROP de l'ancienne upsert_entite (12 paramètres) — signature exacte sondée (E1).
-- ───────────────────────────────────────────────────────────────────────────
drop function if exists public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text
);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. upsert_entite étendu (13 params) : corps recopié à l'identique de E1, seuls
--    ajouts = le paramètre p_adresse_facturation + la colonne dans INSERT et UPDATE.
--    AUCUNE logique existante modifiée.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_entite(
  p_id uuid,
  p_code text,
  p_libelle text,
  p_type_entite text,
  p_libelle_court text default null,
  p_site_id uuid default null,
  p_refacturable_defaut boolean default false,
  p_contact_nom text default null,
  p_contact_email text default null,
  p_statut_prospection text default null,
  p_actif boolean default true,
  p_notes text default null,
  p_adresse_facturation text default null
)
returns public.entites
language plpgsql
security definer
set search_path to 'public'
as $upsert_entite$
declare
  v_row public.entites;
  v_me  uuid;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;
  if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_libelle), '') = '' then
    raise exception 'Le code et le libellé sont obligatoires.';
  end if;
  select personne_id into v_me from public.qui_suis_je();
  if p_id is null then
    insert into public.entites(
      code, libelle, libelle_court, type_entite, site_id, refacturable_defaut,
      contact_nom, contact_email, statut_prospection, actif, notes,
      adresse_facturation, cree_par)
    values(
      p_code, p_libelle, p_libelle_court, p_type_entite, p_site_id, p_refacturable_defaut,
      p_contact_nom, p_contact_email, p_statut_prospection, p_actif, p_notes,
      p_adresse_facturation, v_me)
    returning * into v_row;
  else
    update public.entites set
      code = p_code, libelle = p_libelle, libelle_court = p_libelle_court,
      type_entite = p_type_entite, site_id = p_site_id,
      refacturable_defaut = p_refacturable_defaut,
      contact_nom = p_contact_nom, contact_email = p_contact_email,
      statut_prospection = p_statut_prospection, actif = p_actif, notes = p_notes,
      adresse_facturation = p_adresse_facturation
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Entité introuvable : %', p_id;
    end if;
  end if;
  return v_row;
end;
$upsert_entite$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Privilèges : la nouvelle signature (13 params) est un objet distinct côté
--    Postgres → REVOKE anon explicite / GRANT authenticated (leçon pt 109).
-- ───────────────────────────────────────────────────────────────────────────
revoke execute on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text, text
) from public, anon;
grant execute on function public.upsert_entite(
  uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text, text
) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Fail-loud : colonne présente, RPC 13-params présente, ancienne 12-params
--    bien supprimée, anon fermé.
-- ───────────────────────────────────────────────────────────────────────────
do $verif$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entites'
      and column_name = 'adresse_facturation'
  ) then
    raise exception 'VERIF: colonne entites.adresse_facturation absente';
  end if;

  if to_regprocedure('public.upsert_entite(uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text, text)') is null then
    raise exception 'VERIF: upsert_entite (13 params) absente';
  end if;

  if to_regprocedure('public.upsert_entite(uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text)') is not null then
    raise exception 'VERIF: ancienne upsert_entite (12 params) toujours présente (DROP échoué)';
  end if;

  if has_function_privilege('anon',
       'public.upsert_entite(uuid, text, text, text, text, uuid, boolean, text, text, text, boolean, text, text)',
       'execute') then
    raise exception 'VERIF: anon peut EXECUTE upsert_entite (REVOKE manquant)';
  end if;
end;
$verif$;

commit;
