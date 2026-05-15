-- =============================================================================
-- sql/33-fix-rpc-joueurs-lecture.sql
-- =============================================================================
-- MOM Hub · Phase 5.14 · S1.b · Module Joueurs (FIX RPC LECTURE)
-- Version       : v1.1 (15 mai 2026, fix v1.0)
-- Auteur conv   : Production · Module Joueurs (Phase 5.14)
-- Référence     : sql/33-rpc-joueurs-lecture.sql v1.0 (échec ERR 42703)
-- =============================================================================
--
-- OBJET DU FIX
--   La version v1.0 de sql/33 supposait des noms de colonnes erronés sur les
--   tables référentielles. Le diagnostic schema a révélé :
--
--     clubs       → pas de `nom`, mais : `code`, `nom_court`, `nom_long`
--     categories  → `libelle_court` ✅ (bon, conservé)
--     poles       → pas de `nom`, mais : `libelle_court`, `libelle_long`, `code`
--
-- CHANGEMENTS v1.0 → v1.1
--
--   get_joueurs_equipe (vue liste) :
--     - cp.nom    AS club_principal_nom       →  cp.code AS club_principal_code
--                                              + cp.nom_court AS club_principal_nom_court
--     - cprov.nom AS ej_club_provenance_nom   →  cprov.code AS ej_club_provenance_code
--                                              + cprov.nom_court AS ej_club_provenance_nom_court
--     - po.nom    AS pole_nom                 →  po.libelle_court AS pole_libelle_court
--     - c.libelle_court ✅ conservé
--
--   get_joueur_detail (fiche) :
--     - Idem que get_joueurs_equipe pour les jointures
--     - + cp.nom_long AS club_principal_nom_long      (affichage long fiche)
--     - + c.libelle_long AS categorie_libelle_long    (affichage long fiche)
--     - + po.libelle_long AS pole_libelle_long        (affichage long fiche)
--
-- RATIONALE UI
--   `clubs.code` ("MOM"/"SAR"/"ASCS") → badge compact carte joueur
--   `clubs.nom_court` ("Mutzig Ovalie Molsheim") → lisible en fiche
--   `clubs.nom_long` ("Club Mutzig Ovalie Molsheim Rugby") → fiche détaillée
--
-- IDEMPOTENCE
--   CREATE OR REPLACE ne peut pas changer la signature TABLE de retour.
--   On utilise DROP FUNCTION IF EXISTS + CREATE pour garantir la mise à jour.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- DROP des versions précédentes (échec sql/33 v1.0 → fonctions absentes,
-- mais DROP IF EXISTS est sûr de toute façon)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_joueurs_equipe(UUID);
DROP FUNCTION IF EXISTS public.get_joueur_detail(UUID);

-- =============================================================================
-- 1. get_joueurs_equipe(p_equipe_id UUID) — vue liste (v1.1)
-- =============================================================================

CREATE FUNCTION public.get_joueurs_equipe(p_equipe_id UUID)
RETURNS TABLE (
  -- Identité
  id                            UUID,
  nom                           TEXT,
  prenom                        TEXT,
  sexe                          TEXT,
  date_naissance                DATE,
  -- Type / qualités
  type_personne                 TEXT,
  f15_integree                  BOOLEAN,
  numero_licence_ffr            TEXT,
  qualite_ffr                   TEXT,
  -- Références résolues (CORRIGÉES v1.1)
  club_principal_id             UUID,
  club_principal_code           TEXT,   -- ex "MOM", "SAR", "ASCS" (badge)
  club_principal_nom_court      TEXT,   -- ex "Mutzig Ovalie Molsheim"
  categorie_id                  UUID,
  categorie_libelle_court       TEXT,   -- ex "M14"
  pole_attache_id               UUID,
  pole_libelle_court            TEXT,   -- ex "Pôle Jeunes"
  -- Profil sportif joueur (sql/32 v2.0)
  postes_uuids                  UUID[],
  aptitudes_uuids               UUID[],
  taille_cm                     SMALLINT,
  poids_g                       INTEGER,
  -- État métier (sql/32 v2.0)
  indisponibilite               TEXT,
  blessure_resume               TEXT,
  suspension_jusqu_au           DATE,
  -- Équipe-joueurs (rattachement)
  ej_statut                     TEXT,
  ej_niveau_profil              TEXT,
  ej_club_provenance_id         UUID,
  ej_club_provenance_code       TEXT,   -- badge partenaire ("SAR"/"ASCS")
  ej_club_provenance_nom_court  TEXT,
  ej_date_affectation           DATE,
  ej_date_sortie                DATE,
  -- Calculés
  profil                        TEXT,
  etat_calcule                  TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.nom,
    p.prenom,
    p.sexe,
    p.date_naissance,
    p.type_personne,
    p.f15_integree,
    p.numero_licence_ffr,
    p.qualite_ffr,
    p.club_principal_id,
    cp.code             AS club_principal_code,
    cp.nom_court        AS club_principal_nom_court,
    p.categorie_id,
    c.libelle_court     AS categorie_libelle_court,
    p.pole_attache_id,
    po.libelle_court    AS pole_libelle_court,
    p.postes_uuids,
    p.aptitudes_uuids,
    p.taille_cm,
    p.poids_g,
    p.indisponibilite,
    p.blessure_resume,
    p.suspension_jusqu_au,
    ej.statut           AS ej_statut,
    ej.niveau_profil    AS ej_niveau_profil,
    ej.club_provenance_id AS ej_club_provenance_id,
    cprov.code          AS ej_club_provenance_code,
    cprov.nom_court     AS ej_club_provenance_nom_court,
    ej.date_affectation AS ej_date_affectation,
    ej.date_sortie      AS ej_date_sortie,
    -- Calcul profil : mapping type_personne → profil UI
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
    END                 AS profil,
    -- Calcul état métier : priorité descendante
    --   inactif > suspendu > blesse > indisponible > actif
    CASE
      WHEN ej.date_sortie IS NOT NULL
           AND ej.date_sortie < CURRENT_DATE                                      THEN 'inactif'
      WHEN p.suspension_jusqu_au IS NOT NULL
           AND p.suspension_jusqu_au >= CURRENT_DATE                              THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL
           AND length(trim(p.blessure_resume)) > 0                                THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL
           AND length(trim(p.indisponibilite)) > 0                                THEN 'indisponible'
      ELSE 'actif'
    END                 AS etat_calcule
  FROM equipe_joueurs ej
  JOIN personnes p           ON p.id = ej.personne_id
  LEFT JOIN clubs cp         ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov      ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c     ON c.id = p.categorie_id
  LEFT JOIN poles po         ON po.id = p.pole_attache_id
  WHERE ej.equipe_id = p_equipe_id
    AND (ej.date_sortie IS NULL OR ej.date_sortie >= CURRENT_DATE)
  ORDER BY p.nom, p.prenom;
$$;

REVOKE EXECUTE ON FUNCTION public.get_joueurs_equipe(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_joueurs_equipe(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_joueurs_equipe(UUID) IS
'C10-J-f v1.1 : Vue liste joueurs d''une équipe (audit §2.2). 1 ligne par joueur '
'actif. Colonnes joints corrigées (clubs.code+nom_court, categories.libelle_court, '
'poles.libelle_court). SECURITY DEFINER. V1 sans filtrage RGPD inter-rôle.';


-- =============================================================================
-- 2. get_joueur_detail(p_personne_id UUID) — fiche détaillée (v1.1)
-- =============================================================================

CREATE FUNCTION public.get_joueur_detail(p_personne_id UUID)
RETURNS TABLE (
  -- Identité
  id                            UUID,
  nom                           TEXT,
  prenom                        TEXT,
  surnom                        TEXT,
  sexe                          TEXT,
  date_naissance                DATE,
  nationalite_principale        TEXT,
  type_personne                 TEXT,
  f15_integree                  BOOLEAN,
  categorie_personne            TEXT,
  numero_licence_ffr            TEXT,
  qualite_ffr                   TEXT,
  type_pratique                 TEXT,
  -- Références résolues (CORRIGÉES v1.1 + variantes longues)
  club_principal_id             UUID,
  club_principal_code           TEXT,
  club_principal_nom_court      TEXT,
  club_principal_nom_long       TEXT,
  categorie_id                  UUID,
  categorie_libelle_court       TEXT,
  categorie_libelle_long        TEXT,
  pole_attache_id               UUID,
  pole_libelle_court            TEXT,
  pole_libelle_long             TEXT,
  -- Profil sportif (sql/32 v2.0)
  postes_uuids                  UUID[],
  aptitudes_uuids               UUID[],
  taille_cm                     SMALLINT,
  poids_g                       INTEGER,
  notes_coach                   TEXT,
  -- État métier (sql/32 v2.0)
  indisponibilite               TEXT,
  blessure_resume               TEXT,
  suspension_jusqu_au           DATE,
  -- Coordonnées
  email_principal               TEXT,
  email_secondaire              TEXT,
  telephone_principal           TEXT,
  telephone_secondaire          TEXT,
  adresse_postale               TEXT,
  code_postal                   TEXT,
  ville                         TEXT,
  pays                          TEXT,
  -- Identité étendue
  lieu_naissance                JSONB,
  etablissement_scolaire        TEXT,
  classe_scolaire               TEXT,
  personne_a_prevenir_urgence   JSONB,
  -- FFR
  date_fin_affiliation          DATE,
  annee_arrivee_club            INTEGER,
  validation_ffr                BOOLEAN,
  -- RGPD / droits image
  consentement_rgpd_date        TIMESTAMPTZ,
  canal_communication_prefere   TEXT,
  droit_image_photos_individuelles BOOLEAN,
  droit_image_photos_groupe     BOOLEAN,
  droit_image_site_web          BOOLEAN,
  droit_image_reseaux_sociaux   BOOLEAN,
  droit_image_presse_locale     BOOLEAN,
  autorisation_intervention_medicale_urgence BOOLEAN,
  -- Métadonnées
  source_creation               TEXT,
  modifie_par                   TEXT,
  synchronisation_statut        TEXT,
  visible_annuaire              BOOLEAN,
  tag_verifier                  BOOLEAN,
  created_at                    TIMESTAMPTZ,
  updated_at                    TIMESTAMPTZ,
  -- Calculés
  profil                        TEXT,
  etat_calcule                  TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.nom,
    p.prenom,
    p.surnom,
    p.sexe,
    p.date_naissance,
    p.nationalite_principale,
    p.type_personne,
    p.f15_integree,
    p.categorie_personne,
    p.numero_licence_ffr,
    p.qualite_ffr,
    p.type_pratique,
    p.club_principal_id,
    cp.code             AS club_principal_code,
    cp.nom_court        AS club_principal_nom_court,
    cp.nom_long         AS club_principal_nom_long,
    p.categorie_id,
    c.libelle_court     AS categorie_libelle_court,
    c.libelle_long      AS categorie_libelle_long,
    p.pole_attache_id,
    po.libelle_court    AS pole_libelle_court,
    po.libelle_long     AS pole_libelle_long,
    p.postes_uuids,
    p.aptitudes_uuids,
    p.taille_cm,
    p.poids_g,
    p.notes_coach,
    p.indisponibilite,
    p.blessure_resume,
    p.suspension_jusqu_au,
    p.email_principal,
    p.email_secondaire,
    p.telephone_principal,
    p.telephone_secondaire,
    p.adresse_postale,
    p.code_postal,
    p.ville,
    p.pays,
    p.lieu_naissance,
    p.etablissement_scolaire,
    p.classe_scolaire,
    p.personne_a_prevenir_urgence,
    p.date_fin_affiliation,
    p.annee_arrivee_club,
    p.validation_ffr,
    p.consentement_rgpd_date,
    p.canal_communication_prefere,
    p.droit_image_photos_individuelles,
    p.droit_image_photos_groupe,
    p.droit_image_site_web,
    p.droit_image_reseaux_sociaux,
    p.droit_image_presse_locale,
    p.autorisation_intervention_medicale_urgence,
    p.source_creation,
    p.modifie_par,
    p.synchronisation_statut,
    p.visible_annuaire,
    p.tag_verifier,
    p.created_at,
    p.updated_at,
    -- Calcul profil (identique get_joueurs_equipe)
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
    END                 AS profil,
    -- Calcul état (fiche détail : pas d'info date_sortie sans contexte équipe)
    CASE
      WHEN p.suspension_jusqu_au IS NOT NULL
           AND p.suspension_jusqu_au >= CURRENT_DATE                              THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL
           AND length(trim(p.blessure_resume)) > 0                                THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL
           AND length(trim(p.indisponibilite)) > 0                                THEN 'indisponible'
      ELSE 'actif'
    END                 AS etat_calcule
  FROM personnes p
  LEFT JOIN clubs cp     ON cp.id = p.club_principal_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po     ON po.id = p.pole_attache_id
  WHERE p.id = p_personne_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_joueur_detail(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_joueur_detail(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_joueur_detail(UUID) IS
'C10-J-g v1.1 : Fiche détaillée d''une personne (audit §2.2). Colonnes joints '
'corrigées + variantes nom_long/libelle_long. SECURITY DEFINER. V1 sans '
'filtrage RGPD inter-rôle.';

COMMIT;

-- =============================================================================
-- Vérifications post-exécution
-- =============================================================================

-- A) Vérifier création :
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('get_joueurs_equipe', 'get_joueur_detail');
--    -> doit retourner 2 lignes.

-- B) Test liste M14 :
--    SELECT id, nom, prenom, profil, etat_calcule, club_principal_code, categorie_libelle_court
--    FROM public.get_joueurs_equipe('bfb83b83-83ef-4dde-b526-48ff87313044'::UUID)
--    LIMIT 10;
--    -> ~75 lignes, profils variés (mom/f15/partenaire/coach/staff)

-- C) Test fiche Murat ALTUN :
--    SELECT id, nom, prenom, club_principal_code, club_principal_nom_court, profil
--    FROM public.get_joueur_detail('3cceabe2-910a-4781-b579-e2b28e247056'::UUID);
-- =============================================================================
