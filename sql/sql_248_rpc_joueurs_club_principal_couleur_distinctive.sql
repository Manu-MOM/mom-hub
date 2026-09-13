-- =====================================================================
-- sql_248_rpc_joueurs_club_principal_couleur_distinctive.sql
-- ---------------------------------------------------------------------
-- Chantier : ENTENTE-M16-2026-2027 — couleur bordure vignette par club
--
-- Besoin : colorer la bordure des vignettes joueurs partenaires d'apres
--          la couleur d'affiliation de leur club de RATTACHEMENT
--          (disponible des le vivier, sans affectation d'equipe).
--          Les 4 RPC de lecture d'effectif ne remontaient pas cette
--          couleur : on ajoute club_principal_couleur_distinctive
--          (= clubs.couleur_affiliation_distinctive, alias cp) en
--          sortie, en position 13 (apres club_principal_nom_court).
--
-- Harmonisation : les 4 RPC partagent le meme shape -> on les traite
--   toutes pour coherence inter-ecrans (categorie, equipe, f15, section).
--
-- Technique : changement de signature => DROP + CREATE (evite PGRST203).
--   /!\ LECON PT (regression corrigee sql_249) : un DROP+CREATE remet le
--   GRANT EXECUTE par defaut a PUBLIC. NE PAS re-GRANT public/anon ici.
--   Les GRANT ci-dessous posent directement l'etat voulu (pt 216) :
--   authenticated + service_role uniquement. postgres = owner implicite.
--
-- Etat deploye faisant foi : applique le 13/09/2026
--   (migration rpc_joueurs_ajout_club_principal_couleur_distinctive
--    + correctif fix_revoke_anon_public_4_rpc_lecture_effectif_regression_pt216).
--   Ce fichier est le MIROIR consolide de l'etat final.
-- =====================================================================

-- ---------- 1) get_joueurs_categorie ----------
DROP FUNCTION IF EXISTS public.get_joueurs_categorie(uuid);
CREATE FUNCTION public.get_joueurs_categorie(p_categorie_id uuid)
 RETURNS TABLE(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, club_principal_couleur_distinctive text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text, potentiel_jeu text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH cat AS (
    SELECT c.id, c.type_categorie, c.type_licence_ffr, (c.type_categorie = 'Loisirs') AS est_loisirs
    FROM categories c WHERE c.id = p_categorie_id
  ), sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 )
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    p.categorie_id, c.libelle_court, p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids, p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur' THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant' AND COALESCE(p.qualite_ffr,'') LIKE 'DC%' THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur' THEN 'staff'
      WHEN p.type_personne = 'licencie_competition' AND p.f15_integree = TRUE THEN 'f15'
      WHEN p.type_personne = 'licencie_competition' THEN 'mom' ELSE 'autre' END,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      WHEN p.type_personne <> 'licencie_externe_partenaire'
           AND p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      ELSE 'actif' END,
    NULL::text,
    p.potentiel_jeu
  FROM cat JOIN personnes p ON (
    (cat.est_loisirs AND cat.type_licence_ffr = ANY(COALESCE(p.qualites_ffr, ARRAY[]::text[])))
    OR (NOT cat.est_loisirs AND p.categorie_id = p_categorie_id
        AND NOT (COALESCE(p.qualites_ffr, ARRAY[]::text[]) && ARRAY['RLSP','RLO'])))
  LEFT JOIN LATERAL (SELECT ej2.* FROM equipe_joueurs ej2 WHERE ej2.personne_id = p.id
      AND (ej2.date_sortie IS NULL OR ej2.date_sortie >= CURRENT_DATE)
      ORDER BY ej2.date_affectation DESC NULLS LAST LIMIT 1) ej ON TRUE
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  UNION ALL
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction,
    NULL::text
  FROM fonction_staff fs JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = p_categorie_id AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;
GRANT EXECUTE ON FUNCTION public.get_joueurs_categorie(uuid) TO authenticated, service_role;

-- ---------- 2) get_joueurs_equipe ----------
DROP FUNCTION IF EXISTS public.get_joueurs_equipe(uuid);
CREATE FUNCTION public.get_joueurs_equipe(p_equipe_id uuid)
 RETURNS TABLE(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, club_principal_couleur_distinctive text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text, potentiel_jeu text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 ),
       eqcat AS ( SELECT en.categorie_id FROM equipes e JOIN ententes en ON e.entente_id = en.id WHERE e.id = p_equipe_id LIMIT 1 )
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    p.categorie_id, c.libelle_court, p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids, p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur' THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant' AND COALESCE(p.qualite_ffr,'') LIKE 'DC%' THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur' THEN 'staff'
      WHEN p.type_personne = 'licencie_competition' AND p.f15_integree = TRUE THEN 'f15'
      WHEN p.type_personne = 'licencie_competition' THEN 'mom' ELSE 'autre' END,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      WHEN p.type_personne <> 'licencie_externe_partenaire'
           AND p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      ELSE 'actif' END,
    NULL::text,
    p.potentiel_jeu
  FROM equipe_joueurs ej
  JOIN personnes p ON p.id = ej.personne_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE ej.equipe_id = p_equipe_id
    AND (ej.date_sortie IS NULL OR ej.date_sortie >= CURRENT_DATE)
  UNION ALL
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction,
    NULL::text
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = (SELECT categorie_id FROM eqcat) AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;
GRANT EXECUTE ON FUNCTION public.get_joueurs_equipe(uuid) TO authenticated, service_role;

-- ---------- 3) get_joueurs_f15 ----------
DROP FUNCTION IF EXISTS public.get_joueurs_f15();
CREATE FUNCTION public.get_joueurs_f15()
 RETURNS TABLE(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, club_principal_couleur_distinctive text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text, potentiel_jeu text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 ),
       f15cat AS ( SELECT id FROM categories WHERE code = 'F15' LIMIT 1 )
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    p.categorie_id, c.libelle_court, p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids, p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur' THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant' AND COALESCE(p.qualite_ffr,'') LIKE 'DC%' THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur' THEN 'staff'
      WHEN p.type_personne = 'licencie_competition' AND p.f15_integree = TRUE THEN 'f15'
      WHEN p.type_personne = 'licencie_competition' THEN 'mom' ELSE 'autre' END,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      WHEN p.type_personne <> 'licencie_externe_partenaire'
           AND p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      ELSE 'actif' END,
    NULL::text,
    p.potentiel_jeu
  FROM personnes p
  LEFT JOIN LATERAL (SELECT ej2.* FROM equipe_joueurs ej2 WHERE ej2.personne_id = p.id
      AND (ej2.date_sortie IS NULL OR ej2.date_sortie >= CURRENT_DATE)
      ORDER BY ej2.date_affectation DESC NULLS LAST LIMIT 1) ej ON TRUE
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE p.f15_integree = TRUE
  UNION ALL
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction,
    NULL::text
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = (SELECT id FROM f15cat) AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;
GRANT EXECUTE ON FUNCTION public.get_joueurs_f15() TO authenticated, service_role;

-- ---------- 4) get_joueurs_section ----------
DROP FUNCTION IF EXISTS public.get_joueurs_section();
CREATE FUNCTION public.get_joueurs_section()
 RETURNS TABLE(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, club_principal_couleur_distinctive text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text, potentiel_jeu text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 ),
       seccat AS ( SELECT id FROM categories WHERE code = 'SECTION' LIMIT 1 )
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    p.categorie_id, c.libelle_court, p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids, p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur' THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant' AND COALESCE(p.qualite_ffr,'') LIKE 'DC%' THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur' THEN 'staff'
      WHEN p.type_personne = 'licencie_competition' AND p.f15_integree = TRUE THEN 'f15'
      WHEN p.type_personne = 'licencie_competition' THEN 'mom' ELSE 'autre' END,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      WHEN p.type_personne <> 'licencie_externe_partenaire'
           AND p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      ELSE 'actif' END,
    NULL::text,
    p.potentiel_jeu
  FROM personnes p
  LEFT JOIN LATERAL (SELECT ej2.* FROM equipe_joueurs ej2 WHERE ej2.personne_id = p.id
      AND (ej2.date_sortie IS NULL OR ej2.date_sortie >= CURRENT_DATE)
      ORDER BY ej2.date_affectation DESC NULLS LAST LIMIT 1) ej ON TRUE
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE p.section_rugby = TRUE
  UNION ALL
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court, cp.couleur_affiliation_distinctive,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction,
    NULL::text
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = (SELECT id FROM seccat) AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;
GRANT EXECUTE ON FUNCTION public.get_joueurs_section() TO authenticated, service_role;
