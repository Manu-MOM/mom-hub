-- =====================================================================
-- sql_128_rapport_heures_salarie.sql
-- ---------------------------------------------------------------------
-- RPC : rapport_heures_salarie(p_contrat_id uuid)
--
-- Objet  : extracteur LECTURE SEULE des heures relevees d'un salarie,
--          destine a alimenter l'export .xlsx « Bilan d'heures » du Hub.
--          Renvoie les lignes detaillees brutes (date, heures, debut,
--          categorie, type de mission, code mission, notes). L'agregation
--          mensuelle / par categorie / par type est faite cote front
--          (SheetJS), source de calcul unique. RPC = simple extracteur.
--
-- Securite : SECURITY DEFINER. La table releve_heures_salarie a la RLS
--            ACTIVE mais AUCUNE policy (sonde pt 124 : relrowsecurity=true,
--            0 ligne dans pg_policies) — toute lecture directe est donc
--            bloquee, seul un acces SECURITY DEFINER passe. Le controle
--            d'acces DOIT vivre dans la fonction (ecole B) : se reposer
--            sur la RLS ne protege rien ici.
--            Guard : suis_je_salarie() OU has_role('admin') OU
--            has_role('bureau'). encadrant et anon exclus, coherent avec
--            le lifecycle du module salarie. REVOKE EXECUTE FROM anon.
--
-- DS-1    : mission_id est NULLABLE (sonde A) -> LEFT JOIN missions, sinon
--           les saisies sans mission (ponctuelles / libres) seraient
--           perdues. type_mission et code remontent NULL pour ces lignes,
--           le front les rangera en « (hors mission) ».
--
-- Lecture seule : aucune ecriture, aucun effet de bord. STABLE.
-- =====================================================================

drop function if exists public.rapport_heures_salarie(uuid);

create or replace function public.rapport_heures_salarie(p_contrat_id uuid)
returns table (
  out_date_jour          date,
  out_heures             numeric,
  out_heure_debut        time without time zone,
  out_categorie          text,
  out_type_mission       text,
  out_mission_code       text,
  out_notes              text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  -- Guard ecole B : lecture reservee au salarie lui-meme OU a l'administration.
  if not (
       public.suis_je_salarie()
    or public.has_role('admin')
    or public.has_role('bureau')
  ) then
    raise exception
      'Acces refuse : lecture du bilan d''heures reservee au salarie ou a l''administration (admin/bureau).';
  end if;

  return query
    select
      rh.date_jour      as out_date_jour,
      rh.heures         as out_heures,
      rh.heure_debut    as out_heure_debut,
      rh.categorie      as out_categorie,
      m.type_mission    as out_type_mission,
      m.code            as out_mission_code,
      rh.notes          as out_notes
    from public.releve_heures_salarie rh
    left join public.missions m on m.id = rh.mission_id
    where rh.contrat_id = p_contrat_id
    order by rh.date_jour, rh.heure_debut nulls last;
end;
$function$;

-- ACL : couper anon, ouvrir aux roles authentifies (le guard interne filtre).
revoke all     on function public.rapport_heures_salarie(uuid) from public;
revoke execute on function public.rapport_heures_salarie(uuid) from anon;
grant  execute on function public.rapport_heures_salarie(uuid) to authenticated;

-- =====================================================================
-- VERIFICATION fail-loud : la fonction existe, est SECURITY DEFINER,
-- et anon n'a PAS le droit d'execution.
-- =====================================================================
do $verif$
declare
  v_oid       oid;
  v_secdef    boolean;
  v_anon_can  boolean;
begin
  select p.oid, p.prosecdef
    into v_oid, v_secdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'rapport_heures_salarie'
    and pg_get_function_identity_arguments(p.oid) = 'p_contrat_id uuid';

  if v_oid is null then
    raise exception 'VERIF KO : fonction rapport_heures_salarie(uuid) introuvable.';
  end if;

  if not v_secdef then
    raise exception 'VERIF KO : rapport_heures_salarie n''est pas SECURITY DEFINER.';
  end if;

  v_anon_can := has_function_privilege('anon', v_oid, 'EXECUTE');
  if v_anon_can then
    raise exception 'VERIF KO : anon a encore EXECUTE sur rapport_heures_salarie.';
  end if;

  raise notice 'VERIF OK : rapport_heures_salarie(uuid) creee, SECURITY DEFINER, anon revoque.';
end;
$verif$;
