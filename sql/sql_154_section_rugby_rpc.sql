-- ============================================================================
-- sql_154 — CATEGORIE-SECTION-RUGBY · RPC (lecture + écriture + fiche)
-- FAIT FOI gelé 05/07/2026 md5 b67f451d497321d0ebb01cff25dfdf52 + ADDENDUM 1
-- (extension get_joueur_detail validée par Manu le 05/07 : « c'est ok »).
--
-- 3 gestes :
--   1. get_joueurs_section() — jumelle de get_joueurs_f15 (sql_111), corps
--      byte-fidèle au déployé sondé le 05/07, seul le WHERE change
--      (p.section_rugby = TRUE). 32 colonnes identiques → l'écran Joueurs
--      la consomme sans adaptation de cartes (aiguillage seul, patron pt 109).
--   2. set_section_rugby(p_personne_id, p_actif) — SEUL écrivain du flag.
--      Garde = puis_je_ecrire_categorie(SECTION) : admin, bureau,
--      responsables du pôle Section (Lohann), et tout encadrant habilité
--      plus tard par fonction_staff sur SECTION (D4-b option 3, FAIT FOI §1).
--      Décision déléguée tracée : RETURNS boolean (le nouvel état) — la
--      fiche se rafraîchit par getJoueurDetail (patron reopenFicheCurrent).
--   3. get_joueur_detail — ADDENDUM 1 : + section_rugby boolean en DERNIÈRE
--      colonne. Ajout au RETURNS TABLE = changement de type de retour →
--      DROP + recréation obligatoire (piège pt 137, 42P13 sinon). Corps
--      sinon IDENTIQUE au prosrc déployé sondé le 05/07 ; attributs
--      re-déclarés à l'identique (LANGUAGE sql STABLE SECURITY DEFINER,
--      search_path public) ; ACL re-posées = celles sondées
--      ({authenticated, postgres, service_role}, anon ABSENT).
--
-- Leçon pt 109 appliquée aux 3 : REVOKE FROM PUBLIC **ET** FROM anon
-- explicites (les default privileges Supabase accordent EXECUTE à anon).
-- ============================================================================

begin;

-- ---------------------------------------------------------------- geste 1
create or replace function public.get_joueurs_section()
returns table(
    id uuid, nom text, prenom text, sexe text, date_naissance date,
    type_personne text, f15_integree boolean, numero_licence_ffr text,
    qualite_ffr text, club_principal_id uuid, club_principal_code text,
    club_principal_nom_court text, categorie_id uuid,
    categorie_libelle_court text, pole_attache_id uuid,
    pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[],
    taille_cm smallint, poids_g integer, indisponibilite text,
    blessure_resume text, suspension_jusqu_au date, ej_statut text,
    ej_niveau_profil text, ej_club_provenance_id uuid,
    ej_club_provenance_code text, ej_club_provenance_nom_court text,
    ej_date_affectation date, ej_date_sortie date, profil text,
    etat_calcule text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT
    p.id, p.nom, p.prenom, p.sexe, p.date_naissance,
    p.type_personne, p.f15_integree, p.numero_licence_ffr, p.qualite_ffr,
    p.club_principal_id, cp.code, cp.nom_court,
    p.categorie_id, c.libelle_court,
    p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids,
    p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE
      WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur'          THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant'
           AND COALESCE(p.qualite_ffr, '') LIKE 'DC%'      THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur'           THEN 'staff'
      WHEN p.type_personne = 'licencie_competition'
           AND p.f15_integree = TRUE                       THEN 'f15'
      WHEN p.type_personne = 'licencie_competition'        THEN 'mom'
      ELSE 'autre'
    END AS profil,
    CASE
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      ELSE 'actif'
    END AS etat_calcule
  FROM personnes p
  -- LEFT JOIN : un membre de section sans rattachement d'équipe DOIT
  -- apparaître (patron F15, cas Auriane DECOURCELLE pt 109). Au plus un
  -- rattachement actif (le plus récent) pour des colonnes ej_* déterministes.
  LEFT JOIN LATERAL (
    SELECT ej2.*
    FROM equipe_joueurs ej2
    WHERE ej2.personne_id = p.id
      AND (ej2.date_sortie IS NULL OR ej2.date_sortie >= CURRENT_DATE)
    ORDER BY ej2.date_affectation DESC NULLS LAST
    LIMIT 1
  ) ej ON TRUE
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE p.section_rugby = TRUE
  ORDER BY p.nom, p.prenom;
$function$;

comment on function public.get_joueurs_section() is
    'Effectif de la Section rugby scolaire (flag personnes.section_rugby, patron F15/sql_111). sql_154, FAIT FOI b67f451d 05/07/2026.';

revoke all on function public.get_joueurs_section() from public;
revoke all on function public.get_joueurs_section() from anon;
grant execute on function public.get_joueurs_section() to authenticated;

-- ---------------------------------------------------------------- geste 2
create or replace function public.set_section_rugby(
    p_personne_id uuid,
    p_actif boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
begin
  -- Garde D4-b (FAIT FOI §1) : quiconque peut écrire sur la catégorie
  -- SECTION peut gérer son appartenance — aujourd'hui admin, bureau,
  -- responsables du pôle Section (branche DP-4/DP-7).
  if not public.puis_je_ecrire_categorie('b7e4d2a1-5c08-4f96-9a3d-1e8f6c07b254'::uuid) then
    raise exception 'Droit insuffisant sur la catégorie Section.' using errcode = '42501';
  end if;

  if p_personne_id is null or p_actif is null then
    raise exception 'p_personne_id et p_actif sont requis.' using errcode = '22023';
  end if;

  update public.personnes
     set section_rugby = p_actif,
         modifie_par   = 'module-joueurs',
         updated_at    = now()
   where id = p_personne_id;

  if not found then
    raise exception 'Personne % introuvable.', p_personne_id using errcode = '02000';
  end if;

  return p_actif;
end;
$function$;

comment on function public.set_section_rugby(uuid, boolean) is
    'SEUL écrivain du flag personnes.section_rugby. Garde = puis_je_ecrire_categorie(SECTION). sql_154, FAIT FOI b67f451d 05/07/2026.';

revoke all on function public.set_section_rugby(uuid, boolean) from public;
revoke all on function public.set_section_rugby(uuid, boolean) from anon;
grant execute on function public.set_section_rugby(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- geste 3
-- ADDENDUM 1 : + section_rugby en dernière colonne. Changement de type de
-- retour → DROP + recréation (CREATE OR REPLACE échouerait en 42P13).
drop function if exists public.get_joueur_detail(uuid);

create function public.get_joueur_detail(p_personne_id uuid)
returns table(
    id uuid, nom text, prenom text, surnom text, sexe text,
    date_naissance date, nationalite_principale text, type_personne text,
    f15_integree boolean, categorie_personne text, numero_licence_ffr text,
    qualite_ffr text, type_pratique text, club_principal_id uuid,
    club_principal_code text, club_principal_nom_court text,
    club_principal_nom_long text, categorie_id uuid,
    categorie_libelle_court text, categorie_libelle_long text,
    pole_attache_id uuid, pole_libelle_court text, pole_libelle_long text,
    postes_uuids text[], aptitudes_uuids text[], taille_cm smallint,
    poids_g integer, notes_coach text, indisponibilite text,
    blessure_resume text, suspension_jusqu_au date, email_principal text,
    email_secondaire text, telephone_principal text,
    telephone_secondaire text, adresse_postale text, code_postal text,
    ville text, pays text, lieu_naissance jsonb,
    etablissement_scolaire text, classe_scolaire text,
    personne_a_prevenir_urgence jsonb, date_fin_affiliation date,
    annee_arrivee_club integer, validation_ffr boolean,
    consentement_rgpd_date timestamptz, canal_communication_prefere text,
    droit_image_photos_individuelles boolean,
    droit_image_photos_groupe boolean, droit_image_site_web boolean,
    droit_image_reseaux_sociaux boolean, droit_image_presse_locale boolean,
    autorisation_intervention_medicale_urgence boolean,
    source_creation text, modifie_par text, synchronisation_statut text,
    visible_annuaire boolean, tag_verifier boolean, created_at timestamptz,
    updated_at timestamptz, profil text, etat_calcule text,
    section_rugby boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT
    p.id, p.nom, p.prenom, p.surnom, p.sexe,
    p.date_naissance, p.nationalite_principale,
    p.type_personne, p.f15_integree, p.categorie_personne,
    p.numero_licence_ffr, p.qualite_ffr, p.type_pratique,
    p.club_principal_id, cp.code, cp.nom_court, cp.nom_long,
    p.categorie_id, c.libelle_court, c.libelle_long,
    p.pole_attache_id, po.libelle_court, po.libelle_long,
    p.postes_uuids, p.aptitudes_uuids,
    p.taille_cm, p.poids_g, p.notes_coach,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    p.email_principal, p.email_secondaire,
    p.telephone_principal, p.telephone_secondaire,
    p.adresse_postale, p.code_postal, p.ville, p.pays,
    p.lieu_naissance, p.etablissement_scolaire, p.classe_scolaire,
    p.personne_a_prevenir_urgence,
    p.date_fin_affiliation, p.annee_arrivee_club, p.validation_ffr,
    p.consentement_rgpd_date, p.canal_communication_prefere,
    p.droit_image_photos_individuelles, p.droit_image_photos_groupe,
    p.droit_image_site_web, p.droit_image_reseaux_sociaux,
    p.droit_image_presse_locale,
    p.autorisation_intervention_medicale_urgence,
    p.source_creation, p.modifie_par, p.synchronisation_statut,
    p.visible_annuaire, p.tag_verifier,
    p.created_at, p.updated_at,
    CASE
      WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur' THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant' AND COALESCE(p.qualite_ffr,'') LIKE 'DC%' THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur' THEN 'staff'
      WHEN p.type_personne = 'licencie_competition' AND p.f15_integree = TRUE THEN 'f15'
      WHEN p.type_personne = 'licencie_competition' THEN 'mom'
      ELSE 'autre'
    END AS profil,
    CASE
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      ELSE 'actif'
    END AS etat_calcule,
    p.section_rugby
  FROM personnes p
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE p.id = p_personne_id;
$function$;

comment on function public.get_joueur_detail(uuid) is
    'Fiche détaillée joueur. sql_154 (ADDENDUM 1 FAIT FOI b67f451d) : + section_rugby en dernière colonne ; corps sinon identique au déployé antérieur.';

revoke all on function public.get_joueur_detail(uuid) from public;
revoke all on function public.get_joueur_detail(uuid) from anon;
grant execute on function public.get_joueur_detail(uuid) to authenticated;

-- ---------------------------------------------------------------- vérif
do $verif$
declare
    v_n int;
    v_last text;
begin
    -- unicité des 3 fonctions
    select count(*)::int into v_n from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_joueurs_section';
    if v_n <> 1 then
        raise exception 'sql_154 verif : get_joueurs_section attendu 1, trouvé %.', v_n;
    end if;

    select count(*)::int into v_n from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_section_rugby';
    if v_n <> 1 then
        raise exception 'sql_154 verif : set_section_rugby attendu 1, trouvé %.', v_n;
    end if;

    select count(*)::int into v_n from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_joueur_detail';
    if v_n <> 1 then
        raise exception 'sql_154 verif : get_joueur_detail attendu 1, trouvé %.', v_n;
    end if;

    -- SECURITY DEFINER sur les 3
    select count(*)::int into v_n from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_joueurs_section', 'set_section_rugby', 'get_joueur_detail')
      and p.prosecdef;
    if v_n <> 3 then
        raise exception 'sql_154 verif : % fonction(s) SECURITY DEFINER, attendu 3.', v_n;
    end if;

    -- ACL : anon refusé / authenticated accordé, sur les 3
    if has_function_privilege('anon', 'public.get_joueurs_section()', 'execute')
       or has_function_privilege('anon', 'public.set_section_rugby(uuid, boolean)', 'execute')
       or has_function_privilege('anon', 'public.get_joueur_detail(uuid)', 'execute') then
        raise exception 'sql_154 verif : anon peut EXECUTE sur au moins une des 3 RPC.';
    end if;
    if not (has_function_privilege('authenticated', 'public.get_joueurs_section()', 'execute')
        and has_function_privilege('authenticated', 'public.set_section_rugby(uuid, boolean)', 'execute')
        and has_function_privilege('authenticated', 'public.get_joueur_detail(uuid)', 'execute')) then
        raise exception 'sql_154 verif : authenticated ne peut pas EXECUTE sur au moins une des 3 RPC.';
    end if;

    -- parité 32 colonnes OUT avec la jumelle F15
    select count(*)::int into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
         unnest(p.proargmodes) m
    where n.nspname = 'public' and p.proname = 'get_joueurs_section'
      and m in ('t', 'o');
    if v_n <> 32 then
        raise exception 'sql_154 verif : get_joueurs_section projette % colonnes, attendu 32 (parité F15).', v_n;
    end if;

    -- get_joueur_detail : section_rugby présente en DERNIÈRE colonne
    select (p.proargnames)[array_length(p.proargnames, 1)] into v_last
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_joueur_detail';
    if v_last is distinct from 'section_rugby' then
        raise exception 'sql_154 verif : dernière colonne de get_joueur_detail = %, attendu section_rugby.', v_last;
    end if;

    raise notice 'sql_154 OK : get_joueurs_section + set_section_rugby + get_joueur_detail (ADDENDUM 1) en place, ACL conformes.';
end
$verif$;

commit;
