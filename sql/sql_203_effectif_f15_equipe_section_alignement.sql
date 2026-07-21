-- pt 212 (chantier EFFECTIF-F15-ALIGNEMENT) : aligner les 3 RPC d'effectif jumelles de
-- get_joueurs_categorie, laissees en arriere par les chantiers pt 209 (branche encadrants)
-- et pt 211 (etats archive/a_renouveler). Elles alimentent le MEME ecran Effectif
-- (joueurs.html / joueurs-browser.js) selon la categorie affichee :
--   - get_joueurs_equipe(uuid)  : effectif par equipe/championnat (ex. M14)
--   - get_joueurs_f15()         : F15 (cas special, categorie_id=M14)
--   - get_joueurs_section()     : Section rugby scolaire (flag section_rugby)
--
-- SYMPTOME DECLENCHEUR : VOEGELI Lorene (joueuse NON-F15 mais REFERENTE de categorie F15,
--   joueur-encadrant composite) absente de l'Effectif F15 — get_joueurs_f15 n'avait pas la
--   branche encadrants. Sonde : get_joueurs_categorie('F15') la renvoyait deja correctement,
--   mais l'ecran F15 route vers get_joueurs_f15.
--
-- DECISIONS (Manu, gelees) :
--   D1 aligner les 3 RPC sur get_joueurs_categorie (coherence de l'ecran Effectif partout).
--   D2 chaque RPC : + colonne fonction_staff, + branche ENCADRANTS (UNION ALL sur fonction_staff
--      de la categorie concernee), + etats archive/a_renouveler (Vision A pt 211 : les encadrants
--      suivent le renouvellement de leur licence FFR). Changement de signature => DROP + CREATE
--      + GRANT authenticated/service_role reposes.
--   D3 (front, volet 2) : staff.js resout desormais les noms hors pioche staff (fonctions-staff).
--   Rattachement categorie de la branche encadrants :
--     - f15     : categories.code = 'F15'
--     - equipe  : categorie de l'equipe via equipes -> ententes.categorie_id
--     - section : categories.code = 'SECTION' (DORMANTE : aucune categorie SECTION n'existe
--                 aujourd'hui => 0 encadrant remonte ; tuyauterie posee pour une future
--                 "voie d'entree encadrant de section", sans effet de bord actuel).
--
-- get_joueurs_categorie NON touchee (deja correcte pt 209+211).
-- Verifie en base : Voegeli apparait en Effectif F15 (Referent, actif) ; M14 remonte ses
-- 7 encadrants ; section tourne sans erreur (0 coach, branche dormante).
-- Signatures : ajout colonne fonction_staff en fin de RETURNS TABLE (les 3) => DROP+CREATE.

begin;

-- ============================================================================
-- get_joueurs_f15() — branche joueuses (f15_integree) + branche encadrants (categorie F15)
-- ============================================================================
drop function if exists public.get_joueurs_f15();
create function public.get_joueurs_f15()
 returns table(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text)
 language sql stable security definer set search_path to 'public'
as $function$
  WITH sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 ),
       f15cat AS ( SELECT id FROM categories WHERE code = 'F15' LIMIT 1 )
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
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
    NULL::text
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
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = (SELECT id FROM f15cat) AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;
grant execute on function public.get_joueurs_f15() to authenticated;
grant execute on function public.get_joueurs_f15() to service_role;

-- ============================================================================
-- get_joueurs_equipe(uuid) — branche joueurs de l'equipe + encadrants (categorie de l'equipe)
-- ============================================================================
drop function if exists public.get_joueurs_equipe(uuid);
create function public.get_joueurs_equipe(p_equipe_id uuid)
 returns table(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text)
 language sql stable security definer set search_path to 'public'
as $function$
  WITH sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 ),
       eqcat AS ( SELECT en.categorie_id FROM equipes e JOIN ententes en ON e.entente_id = en.id WHERE e.id = p_equipe_id LIMIT 1 )
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
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
    NULL::text
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
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = (SELECT categorie_id FROM eqcat) AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;
grant execute on function public.get_joueurs_equipe(uuid) to authenticated;
grant execute on function public.get_joueurs_equipe(uuid) to service_role;

-- ============================================================================
-- get_joueurs_section() — branche section_rugby + encadrants (categorie 'SECTION', DORMANTE)
-- ============================================================================
drop function if exists public.get_joueurs_section();
create function public.get_joueurs_section()
 returns table(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text)
 language sql stable security definer set search_path to 'public'
as $function$
  WITH sa AS ( SELECT id FROM saisons WHERE est_active = TRUE LIMIT 1 ),
       seccat AS ( SELECT id FROM categories WHERE code = 'SECTION' LIMIT 1 )
  SELECT p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
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
    NULL::text
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
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
    cible.id, cible.libelle_court, p.pole_attache_id, po.libelle_court,
    NULL::text[], NULL::text[], NULL::smallint, NULL::integer,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::date, NULL::date,
    'coach'::text,
    CASE WHEN p.est_archive THEN 'archive'
      WHEN p.numero_licence_ffr IS NOT NULL AND btrim(p.numero_licence_ffr) <> ''
           AND p.derniere_saison_importee IS DISTINCT FROM (SELECT id FROM sa) THEN 'a_renouveler'
      ELSE 'actif' END,
    fs.fonction
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = (SELECT id FROM seccat) AND fs.date_fin IS NULL
  ORDER BY nom, prenom;
$function$;
grant execute on function public.get_joueurs_section() to authenticated;
grant execute on function public.get_joueurs_section() to service_role;

-- ============================================================================
-- VOLET 2 — list_fonctions_staff : renvoie nom + prenom (resolution directe du nom
-- dans l'ecran fonctions-staff, y compris pour les joueurs-encadrants absents de la
-- pioche staff — ex. VOEGELI referente F15 affichee en UUID avant ce correctif).
-- Ajout de colonnes => DROP + CREATE. Consommateur unique : js/staff.js (lecture par nom
-- de champ, +5/-1). GRANT reposes.
-- ============================================================================
drop function if exists public.list_fonctions_staff(uuid, boolean);
create function public.list_fonctions_staff(p_categorie_id uuid, p_inclure_historique boolean default false)
 returns table(id uuid, personne_id uuid, nom text, prenom text, categorie_id uuid, fonction text, date_debut date, date_fin date, created_at timestamp with time zone)
 language sql security definer set search_path to 'public'
as $function$
  select fs.id, fs.personne_id, p.nom, p.prenom, fs.categorie_id, fs.fonction,
         fs.date_debut, fs.date_fin, fs.created_at
  from public.fonction_staff fs
  left join public.personnes p on p.id = fs.personne_id
  where fs.categorie_id = p_categorie_id
    and (p_inclure_historique or fs.date_fin is null)
  order by (fs.date_fin is not null), fs.fonction, fs.date_debut desc;
$function$;
grant execute on function public.list_fonctions_staff(uuid, boolean) to authenticated;
grant execute on function public.list_fonctions_staff(uuid, boolean) to service_role;

-- ============================================================================
-- VERIFICATION fail-loud : les 3 fonctions exposent la colonne fonction_staff
-- ============================================================================
do $verif$
declare v_n int;
begin
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('get_joueurs_f15','get_joueurs_equipe','get_joueurs_section')
     and pg_get_function_result(p.oid) ilike '%fonction_staff%';
  if v_n < 3 then
    raise exception 'KO : alignement incomplet (fonction_staff attendu sur 3 RPC, trouve %).', v_n;
  end if;
  raise notice 'EFFECTIF-F15-ALIGNEMENT OK : get_joueurs_f15/equipe/section alignees (fonction_staff + encadrants + etats).';
end;
$verif$;

commit;
