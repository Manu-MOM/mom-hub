-- ============================================================================
-- MOM Hub · Chantier B5 « Autorisation granulaire par catégorie »
-- Fichier : sql/64 — Helper de dérivation « mes catégories autorisées » (§4.1)
-- ----------------------------------------------------------------------------
-- Doc FAIT FOI : Conception-Autorisation-Referent-Categorie-v1.md (md5 2c99a098)
--   §4.1   : helper SECURITY DEFINER (patron has_role) calculant les catégories
--            d'écriture catégorielle du compte courant. Sentinelle « transverse »
--            DISTINCTE de la liste vide. Normalisation fonction robuste casse/accents.
--   §6 (2) : « Helper mes_categories_autorisees() (+ sentinelle transverse),
--            normalisation fonction robuste. »
--   D5     : fonctions qualifiantes = {Référent de catégorie, Entraîneur principal, Manager}.
--   D6     : Entraîneur adjoint = descriptif, n'ouvre PAS l'écriture.
--   D7     : plancher = aucun accès (referent sans fonction qualifiante -> 0 ligne).
--
-- Sondes à la source (méthode pt 14, repo Manu-MOM/mom-hub@main fait foi) — closes :
--   - sql_60_auth_personne.sql : qui_suis_je() RETURNS TABLE (personne_id uuid),
--     SECURITY DEFINER, filtre auth.uid(). -> consommé en « select personne_id
--     from public.qui_suis_je() » (table, PAS scalaire).
--   - sql_61_fonction_staff.sql : fonction_staff(personne_id uuid, categorie_id uuid,
--     fonction text LIBRE, date_fin date NULL=actif, …). Aucune unicité bloquante.
--   - sql/04-auth-roles.sql : has_role(p_role text) SECURITY DEFINER.
--   - sql_63 (point 1) : auth_roles.role ∈ {admin,bureau,referent} (CHECK élargi).
--   - unaccent ABSENT en base (leçon pt 30) -> normalisation par translate().
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D-a : SIGNATURE = returns table (categorie_id uuid, est_transverse boolean).
--         * admin OU bureau   -> 1 ligne (NULL, true)  = « toutes catégories »
--         * referent qualifié  -> N lignes (cat_id, false)
--         * sinon (plancher D7) -> 0 ligne
--         Ce contrat lève l'ambiguïté §4.1 « toutes » vs « aucune » : le point 3
--         teste `exists(… where est_transverse)` pour le laissez-passer transverse,
--         sinon `categorie_id = cible`. NULL en categorie_id n'est jamais une vraie
--         catégorie -> pas de collision possible.
--   D-b : normalisation _b5_norm() = translate(accents) + lower + btrim, IMMUTABLE,
--         calquée sur _ident_norm de sql/57 (cohérence projet). Couvre é/è/ê/ë,
--         à/â/ä, î/ï, ô/ö, ù/û/ü, ç et majuscules accentuées.
--   D-c : matching D5 ASYMÉTRIQUE et tracé :
--         * « Référent de catégorie » -> match si la fonction normalisée COMMENCE
--           par 'referent' (tolère « Référent », « referent M14 », variantes) ;
--         * « Manager » -> match si normalisée COMMENCE par 'manager' ;
--         * « Entraîneur principal » -> exige le mot 'principal' présent ET 'entraineur'
--           présent (NE matche PAS « Entraîneur adjoint » -> D6 respecté). On ne
--           matche pas sur 'entraineur' seul, sinon l'adjoint passerait.
--   D-d : admin/bureau renvoient transverse SANS lire fonction_staff (un admin n'a
--         pas besoin d'une fiche personne ni d'une fonction — S5 : compte admin sans
--         fiche personnes). Cohérent niveaux 1/2 du doc (§2).
--   D-e : helper en lecture seule, GRANT authenticated (pas anon : pas de sens hors login).
-- ============================================================================

-- 1. Normalisation robuste (accents + casse + espaces), IMMUTABLE — patron sql/57
create or replace function public._b5_norm(p_txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(lower(translate(
    coalesce(p_txt, ''),
    'àâäáãÀÂÄÁÃéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
  )));
$$;

comment on function public._b5_norm(text) is
  'B5 §4.1 : normalise une fonction staff (accents via translate car unaccent absent, casse, espaces) pour comparaison robuste. IMMUTABLE. Calqué sur _ident_norm (sql/57).';

-- 2. Helper principal : les catégories d'écriture catégorielle du compte courant
create or replace function public.mes_categories_autorisees()
returns table (categorie_id uuid, est_transverse boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_personne_id uuid;
begin
  -- Niveaux 1 & 2 (admin / bureau) : laissez-passer transverse, sans fiche ni fonction.
  if has_role('admin') or has_role('bureau') then
    return query select null::uuid, true;
    return;
  end if;

  -- Niveau 3 (referent) : périmètre = catégories dérivées de fonction_staff.
  if has_role('referent') then
    select qs.personne_id into v_personne_id
    from public.qui_suis_je() qs
    limit 1;

    -- referent non relié à une fiche -> aucune catégorie (plancher D7).
    if v_personne_id is null then
      return;
    end if;

    return query
      select distinct fs.categorie_id, false
      from public.fonction_staff fs
      where fs.personne_id = v_personne_id
        and fs.date_fin is null
        and (
              -- D5 « Référent de catégorie »
              public._b5_norm(fs.fonction) like 'referent%'
              -- D5 « Manager »
           or public._b5_norm(fs.fonction) like 'manager%'
              -- D5 « Entraîneur principal » (exclut « adjoint » -> D6)
           or ( public._b5_norm(fs.fonction) like '%entraineur%'
                and public._b5_norm(fs.fonction) like '%principal%' )
        );
    return;
  end if;

  -- Niveau 4 (compte sans rôle qualifiant) : aucune ligne (plancher fermé, D7).
  return;
end;
$$;

comment on function public.mes_categories_autorisees() is
  'B5 §4.1. Catégories d''écriture catégorielle du compte courant. admin/bureau -> 1 ligne (NULL,true)=transverse ; referent -> N lignes (cat_id,false) dérivées de fonction_staff (fonctions qualifiantes D5 : Référent/Entraîneur principal/Manager, normalisées) ; sinon 0 ligne (plancher D7). Sentinelle est_transverse distincte de la liste vide.';

grant execute on function public.mes_categories_autorisees() to authenticated;

-- 3. (optionnel, confort point 3) prédicat « ai-je le droit sur CETTE catégorie ? »
--    Transverse OU catégorie explicitement dans mon périmètre. Utilisable tel quel
--    dans les gardes RPC du point 3 (en complément de has_role).
create or replace function public.puis_je_ecrire_categorie(p_categorie_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mes_categories_autorisees() m
    where m.est_transverse
       or m.categorie_id = p_categorie_id
  );
$$;

comment on function public.puis_je_ecrire_categorie(uuid) is
  'B5 §4.2. True si le compte courant peut écrire sur la catégorie cible (transverse admin/bureau, ou catégorie dans son périmètre referent). À utiliser dans les gardes RPC du point 3, en complément de has_role.';

grant execute on function public.puis_je_ecrire_categorie(uuid) to authenticated;

-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement)
-- ============================================================================
--  A. Normalisation robuste :
--     select public._b5_norm('  Référent de Catégorie ');  -- attendu : 'referent de categorie'
--     select public._b5_norm('Entraîneur Adjoint');        -- attendu : 'entraineur adjoint'
--
--  B. Sentinelle transverse (en contexte admin simulé SQL Editor, request.jwt.claims sub=7ac40334…) :
--     select * from public.mes_categories_autorisees();
--     -- attendu admin : 1 ligne (categorie_id = NULL, est_transverse = true)
--
--  C. Cas referent qualifié (compte test relié, fonction « Référent de catégorie » M14) :
--     -- attendu : 1 ligne (categorie_id = <M14>, est_transverse = false)
--  D. Cas referent NON qualifié (fonction « Entraîneur adjoint » seule) :
--     -- attendu : 0 ligne (D6 + D7)
--
--  E. Prédicat :
--     select public.puis_je_ecrire_categorie('<M14>');  -- referent M14 -> true ; autre cat -> false
-- ============================================================================
