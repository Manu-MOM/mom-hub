-- ============================================================================
-- sql_147 — ENROLEMENT-REPARATION (2/2) : list_fiches_enrolables()
-- FAIT FOI ENROLEMENT-REPARATION, gelé 03/07/2026 (option B arbitrée).
--
-- POURQUOI : la modale d'enrôlement s'alimentait sur list_staff_disponibles,
-- dont la garde par rôle (retrofit u-admin, ajout p_categorie_id) exige
-- has_role(admin|bureau|encadrant) — or la modale sert des comptes SANS rôle
-- (le rôle n'est matérialisé QUE par la liaison). Œuf-et-poule confirmé 2×
-- en recette terrain le 03/07/2026 (« Aucune fiche disponible »).
--
-- OPTION B (vs élargir la garde existante) : voie DÉDIÉE à l'enrôlement.
-- Ne renvoie QUE les personnes attendues : rôle en attente dans
-- roles_en_attente ET pas encore reliées dans auth_personne.
-- RGPD : shouldCreateUser=true permet à tout inconnu de créer un compte ;
-- avec cette voie il voit une liste VIDE (vs les ~46 fiches staff que
-- l'option A lui aurait exposées). list_staff_disponibles INCHANGÉE
-- (pioche u-admin) : les deux usages ne se recasseront plus mutuellement.
--
-- Patron : calque de list_staff_disponibles (LANGUAGE SQL, SECURITY DEFINER,
-- search_path épinglé) ; STABLE (lecture seule). REVOKE PUBLIC **et** anon
-- (anon hérite de PUBLIC — invariant Supabase acté).
-- ============================================================================

create or replace function public.list_fiches_enrolables()
returns table(personne_id uuid, nom text, prenom text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id as personne_id, p.nom, p.prenom
  from public.personnes p
  join public.roles_en_attente rea on rea.personne_id = p.id
  where auth.uid() is not null
    and not exists (
      select 1
      from public.auth_personne ap
      where ap.personne_id = p.id
    )
  order by p.nom asc, p.prenom asc;
$$;

revoke all on function public.list_fiches_enrolables() from public;
revoke all on function public.list_fiches_enrolables() from anon;
grant execute on function public.list_fiches_enrolables() to authenticated;
grant execute on function public.list_fiches_enrolables() to service_role;

-- ============================================================================
-- Vérification fail-loud : existence, SECURITY DEFINER, ACL sans anon.
-- ============================================================================
do $verif$
declare
  v_oid oid;
  v_secdef boolean;
  v_acl text;
begin
  v_oid := (select p.oid from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = 'list_fiches_enrolables');
  if v_oid is null then
    raise exception 'sql_147 VERIF: list_fiches_enrolables introuvable.';
  end if;
  v_secdef := (select prosecdef from pg_proc where oid = v_oid);
  if not v_secdef then
    raise exception 'sql_147 VERIF: SECURITY DEFINER absent.';
  end if;
  v_acl := (select proacl::text from pg_proc where oid = v_oid);
  if v_acl is null then
    raise exception 'sql_147 VERIF: proacl NULL (droits par défaut = PUBLIC exécutable).';
  end if;
  if position('anon=' in v_acl) > 0 then
    raise exception 'sql_147 VERIF: anon a encore EXECUTE (%).', v_acl;
  end if;
  if position('authenticated=X' in v_acl) = 0 then
    raise exception 'sql_147 VERIF: authenticated n''a pas EXECUTE (%).', v_acl;
  end if;
  raise notice 'sql_147 OK : list_fiches_enrolables en place, ACL correctes (%).', v_acl;
end
$verif$;
