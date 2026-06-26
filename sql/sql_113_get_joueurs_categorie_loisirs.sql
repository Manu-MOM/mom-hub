-- ============================================================
-- sql_113_get_joueurs_categorie_loisirs.sql
-- ------------------------------------------------------------
-- Chantier : JOUEURS-CATEGORIES-LOISIRS (pt 111)
--   Enrichit get_joueurs_categorie (sql_112) pour gérer les
--   catégories LOISIRS (Touch RLSP, Vétérans RLO).
--
-- PROBLÈME (recette terrain pt 110, captures Touch + Vétérans) :
--   get_joueurs_categorie filtrait par personnes.categorie_id seul.
--   Or les catégories Loisirs ne se distinguent PAS par l'âge / la
--   catégorie d'âge mais par le TYPE DE LICENCE FFR. Un joueur Touch
--   a categorie_id = sa catégorie d'âge réelle (M16/SR-F/SR-M) et
--   porte le code licence 'RLSP' dans son array qualites_ffr. Donc
--   get_joueurs_categorie('RLSP') renvoyait 0 → Touch/Vétérans
--   affichés vides alors qu'il y a 22 Touch + 2 Vétérans.
--
-- DONNÉES SONDÉES (DS-1, Manu) :
--   - categories Loisirs : RLO (Vétérans) et RLSP (Touch),
--     type_categorie = 'Loisirs', type_licence_ffr = code (RLO/RLSP).
--   - Le marqueur fiable est l'ARRAY personnes.qualites_ffr (PAS le
--     scalaire qualite_ffr, qui rate les multi-licences ex. KOLB
--     ['DC4','RLSP','SOI'] ; PAS type_pratique='Loisir', qui capte à
--     tort Oscar HOLZRITTER ['A']).
--     Critère Loisirs = categories.type_licence_ffr = ANY(qualites_ffr).
--   - Effectifs validés : RLSP=22 (cats d'âge M16/SR-F/SR-M),
--     RLO=2 (SR-F). Les 24 sont « Loisirs PURS » (aucun A/B compét).
--
-- DÉCISIONS STRUCTURELLES (Manu) :
--   (1) Critère Loisirs = type_licence_ffr = ANY(p.qualites_ffr).
--   (2) Catégories d'âge = categorie_id = X ET EXCLUSION des Loisirs
--       purs : NOT (qualites_ffr && ARRAY['RLSP','RLO']). Un joueur
--       Touch/Vétéran apparaît UNIQUEMENT dans sa catégorie Loisirs,
--       PAS dans M16/SR-F/SR-M. Nouveaux totaux : M16 18→16, SR-F
--       32→29, SR-M 63→44 (24 retirés au total).
--   (3) ASYMÉTRIE ASSUMÉE ET TRACÉE avec F15 : une F15 reste visible
--       dans M14 (surclassement, double présence voulue, pt 109),
--       tandis qu'un Loisirs est exclu de sa catégorie d'âge (pratique
--       loisir autonome). Deux catégories transversales, deux logiques
--       inverses — choix métier conscient, NE PAS « corriger ».
--
-- ARCHITECTURE : RPC UNIQUE enrichie (pas de RPC séparée). La fonction
--   lit type_categorie/type_licence_ffr de la catégorie cible et
--   applique le bon filtre. F15 reste servie par get_joueurs_f15
--   (flag) — non touchée ici. Front (joueurs-browser v1.6) INCHANGÉ :
--   il appelle déjà getJoueursCategorie(catActive) pour toute
--   catégorie non-F15, RLSP/RLO inclus.
--
-- Met à niveau le sql_112 déjà exécuté (CREATE OR REPLACE, même
--   signature 32 colonnes, mêmes JOINs/CASE). Idempotent. Aucune
--   donnée modifiée.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_joueurs_categorie(p_categorie_id uuid)
 RETURNS TABLE(
   id uuid, nom text, prenom text, sexe text, date_naissance date,
   type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text,
   club_principal_id uuid, club_principal_code text, club_principal_nom_court text,
   categorie_id uuid, categorie_libelle_court text,
   pole_attache_id uuid, pole_libelle_court text,
   postes_uuids text[], aptitudes_uuids text[],
   taille_cm smallint, poids_g integer,
   indisponibilite text, blessure_resume text, suspension_jusqu_au date,
   ej_statut text, ej_niveau_profil text,
   ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text,
   ej_date_affectation date, ej_date_sortie date,
   profil text, etat_calcule text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cat AS (
    -- Attributs de la catégorie cible : sa famille (Loisirs ou non)
    -- et son code de licence (RLSP/RLO) le cas échéant.
    SELECT
      c.id,
      c.type_categorie,
      c.type_licence_ffr,
      (c.type_categorie = 'Loisirs') AS est_loisirs
    FROM categories c
    WHERE c.id = p_categorie_id
  )
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
  FROM cat
  JOIN personnes p
    ON (
         -- FAMILLE LOISIRS : appartenance par type de licence FFR
         -- (le code RLSP/RLO de la catégorie est présent dans l'array
         -- qualites_ffr du joueur). categorie_id ignoré ici.
         (cat.est_loisirs
            AND cat.type_licence_ffr = ANY(COALESCE(p.qualites_ffr, ARRAY[]::text[])))
       OR
         -- FAMILLE D'ÂGE : appartenance par categorie_id, MAIS on
         -- EXCLUT les licenciés Loisirs purs (Touch/Vétérans), qui ne
         -- doivent apparaître que dans leur catégorie Loisirs.
         (NOT cat.est_loisirs
            AND p.categorie_id = p_categorie_id
            AND NOT (COALESCE(p.qualites_ffr, ARRAY[]::text[]) && ARRAY['RLSP','RLO']))
       )
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
  ORDER BY p.nom, p.prenom;
$function$;

-- Privilèges : identiques à sql_112 (réaffirmés car CREATE OR REPLACE
-- ne réinitialise pas les grants, mais on garde le bloc par sûreté et
-- traçabilité). REVOKE anon EXPLICITE (leçon pt 109).
REVOKE ALL ON FUNCTION public.get_joueurs_categorie(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_joueurs_categorie(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_joueurs_categorie(uuid) TO authenticated;

-- ------------------------------------------------------------
-- VÉRIFICATION fail-loud — droits + recette des effectifs attendus.
-- Compare les comptages renvoyés par la RPC aux totaux sondés.
-- ------------------------------------------------------------
DO $verif$
DECLARE
  v_exec_auth boolean;
  v_exec_anon boolean;
  v_rlsp uuid;
  v_rlo  uuid;
  v_srm  uuid;
  v_nb   integer;
BEGIN
  -- Droits
  SELECT has_function_privilege('authenticated', oid, 'EXECUTE'),
         has_function_privilege('anon', oid, 'EXECUTE')
    INTO v_exec_auth, v_exec_anon
    FROM pg_proc
   WHERE proname = 'get_joueurs_categorie'
     AND pronamespace = 'public'::regnamespace AND prokind = 'f';
  IF v_exec_auth IS NOT TRUE THEN
    RAISE EXCEPTION 'get_joueurs_categorie : authenticated ne peut pas EXECUTE';
  END IF;
  IF v_exec_anon IS NOT FALSE THEN
    RAISE EXCEPTION 'get_joueurs_categorie : anon peut EXECUTE (attendu FALSE)';
  END IF;

  -- Récupère quelques ids de catégories pour la recette
  SELECT id INTO v_rlsp FROM categories WHERE code = 'RLSP';
  SELECT id INTO v_rlo  FROM categories WHERE code = 'RLO';
  SELECT id INTO v_srm  FROM categories WHERE code = 'SR-M';

  -- Touch (RLSP) = 22 attendus
  IF v_rlsp IS NOT NULL THEN
    SELECT count(*) INTO v_nb FROM get_joueurs_categorie(v_rlsp);
    IF v_nb <> 22 THEN
      RAISE EXCEPTION 'RLSP (Touch) : % joueurs renvoyés, attendu 22', v_nb;
    END IF;
  END IF;

  -- Vétérans (RLO) = 2 attendus
  IF v_rlo IS NOT NULL THEN
    SELECT count(*) INTO v_nb FROM get_joueurs_categorie(v_rlo);
    IF v_nb <> 2 THEN
      RAISE EXCEPTION 'RLO (Vétérans) : % joueurs renvoyés, attendu 2', v_nb;
    END IF;
  END IF;

  -- SR-M après exclusion des Loisirs = 44 attendus
  IF v_srm IS NOT NULL THEN
    SELECT count(*) INTO v_nb FROM get_joueurs_categorie(v_srm);
    IF v_nb <> 44 THEN
      RAISE EXCEPTION 'SR-M (après exclusion Loisirs) : % joueurs, attendu 44', v_nb;
    END IF;
  END IF;

  RAISE NOTICE 'sql_113 OK : get_joueurs_categorie enrichie. RLSP=22, RLO=2, SR-M=44. Droits OK.';
END
$verif$;
