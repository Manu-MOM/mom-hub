-- =====================================================================
-- sql_212_referent_de_categorie.sql
-- Chantier : PLANIF-FRISE-COSMETIQUE-EXPORT
-- ---------------------------------------------------------------------
-- OBJET : exposer, pour une categorie donnee, le(s) referent(s) de
--   categorie ACTIF(S), resolus en prenom/nom. Sert au cartouche
--   d'export PDF de la planification (page planification.html).
--
-- POURQUOI UN RPC : le "referent de categorie" n'est PAS une FK sur
--   la table categories. C'est une FONCTION METIER portee dans
--   public.fonction_staff (fonction TEXT libre), normalisee via le
--   helper existant public._b5_norm() vers la forme 'referent ...'.
--   La table fonction_staff est en RLS FERMEE (tout passe par RPC) :
--   un authentifie lambda ne peut pas la lire en direct. D'ou un RPC
--   SECURITY DEFINER qui franchit la RLS en lecture seule et ne
--   renvoie que prenom/nom (aucune donnee sensible).
--
-- MULTI-REFERENT : une categorie PEUT avoir plusieurs referents
--   actifs (constate en base : M16 = 2 referents). Le RPC renvoie
--   donc un TABLE (0..N lignes), jamais un scalaire. Le front concatene.
--
-- REUTILISATION (aucune logique reinventee) :
--   - public._b5_norm(text)          : normalisation fonction (sql_64)
--   - public.get_noms_personnes(uuid[]) : resolution prenom/nom (garde
--                                          auth interne, TABLE(personne_id,nom,prenom))
--
-- SECURITE : SECURITY DEFINER, search_path fige, garde auth.uid(),
--   REVOKE public/anon + GRANT authenticated. Lecture seule.
--
-- DS-1 : signatures et donnees sondees a la source (base fvfqffxaiaoygqhjtxwr)
--   avant redaction. Teste en BEGIN;...ROLLBACK; sous JWT authentifie
--   simule : M16 -> JUNG Emmanuel + LACOMBE Jean-Emmanuel (2 lignes) ;
--   categorie null / inexistante -> 0 ligne, aucun plancher.
-- =====================================================================

create or replace function public.referent_de_categorie(p_categorie_id uuid)
returns table(personne_id uuid, prenom text, nom text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
begin
  -- Garde : authentification requise (calque get_noms_personnes / doctrine RLS).
  if v_uid is null then
    raise exception 'referent_de_categorie : acces refuse (authentification requise).'
      using errcode = '42501';
  end if;

  -- Entree vide : lecture vide, degradation honnete (pas d'erreur).
  if p_categorie_id is null then
    return;
  end if;

  -- 1) personne_id des referents ACTIFS (date_fin is null) de la categorie.
  --    Fonction metier normalisee via _b5_norm (accents/casse), match
  --    prefixe 'referent%' (calque sql_64 ligne 102). SECURITY DEFINER
  --    franchit la RLS fermee de fonction_staff.
  select array_agg(distinct fs.personne_id)
    into v_ids
  from public.fonction_staff fs
  where fs.categorie_id = p_categorie_id
    and fs.date_fin is null
    and public._b5_norm(fs.fonction) like 'referent%';

  -- Aucun referent : lecture vide (le cartouche s'affichera sans nom).
  if v_ids is null or array_length(v_ids, 1) is null then
    return;
  end if;

  -- 2) resolution prenom/nom via le RPC existant, trie par nom puis prenom.
  return query
    select n.personne_id, n.prenom, n.nom
    from public.get_noms_personnes(v_ids) n
    order by n.nom, n.prenom;
end;
$fn$;

comment on function public.referent_de_categorie(uuid) is
  'PLANIF-FRISE-COSMETIQUE-EXPORT (sql_212) : referent(s) de categorie actif(s), resolus en prenom/nom, pour le cartouche d''export de la planification. Referent = fonction metier fonction_staff normalisee via _b5_norm (PAS une FK). SECURITY DEFINER (franchit la RLS fermee de fonction_staff), lecture seule, multi-referent (0..N lignes). Reutilise get_noms_personnes pour la resolution nominale.';

-- Grants : authenticated uniquement (jamais public/anon).
revoke all on function public.referent_de_categorie(uuid) from public;
revoke all on function public.referent_de_categorie(uuid) from anon;
grant execute on function public.referent_de_categorie(uuid) to authenticated;

-- =====================================================================
-- VERIFICATION FAIL-LOUD (echoue bruyamment si un invariant est faux).
-- =====================================================================
do $verif$
declare
  v_secdef  boolean;
  v_provol  char;
  v_has_anon boolean;
  v_has_auth boolean;
begin
  -- (a) la fonction existe, est SECURITY DEFINER et STABLE.
  select p.prosecdef, p.provolatile
    into v_secdef, v_provol
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'referent_de_categorie'
    and pg_get_function_arguments(p.oid) = 'p_categorie_id uuid';

  if v_secdef is null then
    raise exception 'sql_212 FAIL : fonction referent_de_categorie(uuid) absente.';
  end if;
  if v_secdef is not true then
    raise exception 'sql_212 FAIL : referent_de_categorie n''est pas SECURITY DEFINER.';
  end if;
  if v_provol <> 's' then
    raise exception 'sql_212 FAIL : referent_de_categorie n''est pas STABLE (provolatile=%).', v_provol;
  end if;

  -- (b) anon NE DOIT PAS avoir execute ; authenticated DOIT l'avoir.
  select has_function_privilege('anon',
    'public.referent_de_categorie(uuid)', 'execute') into v_has_anon;
  select has_function_privilege('authenticated',
    'public.referent_de_categorie(uuid)', 'execute') into v_has_auth;

  if v_has_anon is true then
    raise exception 'sql_212 FAIL : anon a EXECUTE sur referent_de_categorie (fuite).';
  end if;
  if v_has_auth is not true then
    raise exception 'sql_212 FAIL : authenticated N''A PAS execute sur referent_de_categorie.';
  end if;

  -- (c) dependances presentes (echoue tot si le socle a bouge).
  if not exists (select 1 from pg_proc where proname = '_b5_norm') then
    raise exception 'sql_212 FAIL : helper _b5_norm absent.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'get_noms_personnes') then
    raise exception 'sql_212 FAIL : RPC get_noms_personnes absent.';
  end if;

  raise notice 'sql_212 OK : referent_de_categorie(uuid) creee, SECURITY DEFINER, authenticated-only, dependances presentes.';
end;
$verif$;
