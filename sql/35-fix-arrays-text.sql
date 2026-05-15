-- =============================================================================
-- sql/35-fix-arrays-text.sql
-- =============================================================================
-- MOM Hub · Phase 5.14 · S2.4 fix · Module Joueurs
-- Version       : v1.0 (15 mai 2026)
-- Auteur conv   : Production · Module Joueurs (Phase 5.14)
-- =============================================================================
--
-- OBJET
--   Les référentiels postes.json et aptitudes.json utilisent des IDs courts
--   ("pst-011", "apt-A-001") qui ne sont PAS des UUID standard PostgreSQL.
--   sql/32 v2.0 avait créé postes_uuids UUID[] et aptitudes_uuids UUID[],
--   ce qui provoque l'erreur :
--     "invalid input syntax for type uuid: pst-011"
--
-- CORRECTIONS
--   1. ALTER personnes : postes_uuids UUID[] → TEXT[]
--   2. ALTER personnes : aptitudes_uuids UUID[] → TEXT[]
--   3. Recréation des 3 RPC avec TEXT[] dans les signatures
--      (DROP + CREATE obligatoire car RETURNS TABLE signature change)
--
-- IMPACT JS
--   Aucun. Le wrapper v1.12 envoie des strings. Le front lit des strings.
--   Seul le type SQL change.
--
-- IDEMPOTENCE
--   ALTER TYPE est idempotent si le type est déjà TEXT[].
--   DROP + CREATE pour les RPC.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ALTER colonnes UUID[] → TEXT[]
-- =============================================================================

ALTER TABLE personnes
  ALTER COLUMN postes_uuids TYPE TEXT[]
  USING postes_uuids::TEXT[];

ALTER TABLE personnes
  ALTER COLUMN aptitudes_uuids TYPE TEXT[]
  USING aptitudes_uuids::TEXT[];

-- Mettre à jour les commentaires
COMMENT ON COLUMN personnes.postes_uuids IS
  'Module Joueurs : array d''IDs de postes joués (réf. postes.json v1.1, '
  'IDs courts ex "pst-001"). Type TEXT[] car les IDs JSON ne sont pas des '
  'UUID standard. Fix sql/35.';

COMMENT ON COLUMN personnes.aptitudes_uuids IS
  'Module Joueurs : array d''IDs d''aptitudes (réf. aptitudes.json v1.0, '
  'IDs courts ex "apt-A-001"). Type TEXT[] car les IDs JSON ne sont pas des '
  'UUID standard. Fix sql/35.';

-- =============================================================================
-- 2. Recréation get_joueurs_equipe (TEXT[] au lieu de UUID[])
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_joueurs_equipe(UUID);

CREATE FUNCTION public.get_joueurs_equipe(p_equipe_id UUID)
RETURNS TABLE (
  id                            UUID,
  nom                           TEXT,
  prenom                        TEXT,
  sexe                          TEXT,
  date_naissance                DATE,
  type_personne                 TEXT,
  f15_integree                  BOOLEAN,
  numero_licence_ffr            TEXT,
  qualite_ffr                   TEXT,
  club_principal_id             UUID,
  club_principal_code           TEXT,
  club_principal_nom_court      TEXT,
  categorie_id                  UUID,
  categorie_libelle_court       TEXT,
  pole_attache_id               UUID,
  pole_libelle_court            TEXT,
  postes_uuids                  TEXT[],       -- fix sql/35
  aptitudes_uuids               TEXT[],       -- fix sql/35
  taille_cm                     SMALLINT,
  poids_g                       INTEGER,
  indisponibilite               TEXT,
  blessure_resume               TEXT,
  suspension_jusqu_au           DATE,
  ej_statut                     TEXT,
  ej_niveau_profil              TEXT,
  ej_club_provenance_id         UUID,
  ej_club_provenance_code       TEXT,
  ej_club_provenance_nom_court  TEXT,
  ej_date_affectation           DATE,
  ej_date_sortie                DATE,
  profil                        TEXT,
  etat_calcule                  TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
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
  FROM equipe_joueurs ej
  JOIN personnes p ON p.id = ej.personne_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE ej.equipe_id = p_equipe_id
    AND (ej.date_sortie IS NULL OR ej.date_sortie >= CURRENT_DATE)
  ORDER BY p.nom, p.prenom;
$$;

REVOKE EXECUTE ON FUNCTION public.get_joueurs_equipe(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_joueurs_equipe(UUID) TO authenticated;

-- =============================================================================
-- 3. Recréation get_joueur_detail (TEXT[] au lieu de UUID[])
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_joueur_detail(UUID);

CREATE FUNCTION public.get_joueur_detail(p_personne_id UUID)
RETURNS TABLE (
  id UUID, nom TEXT, prenom TEXT, surnom TEXT, sexe TEXT,
  date_naissance DATE, nationalite_principale TEXT,
  type_personne TEXT, f15_integree BOOLEAN, categorie_personne TEXT,
  numero_licence_ffr TEXT, qualite_ffr TEXT, type_pratique TEXT,
  club_principal_id UUID, club_principal_code TEXT,
  club_principal_nom_court TEXT, club_principal_nom_long TEXT,
  categorie_id UUID, categorie_libelle_court TEXT, categorie_libelle_long TEXT,
  pole_attache_id UUID, pole_libelle_court TEXT, pole_libelle_long TEXT,
  postes_uuids TEXT[], aptitudes_uuids TEXT[],                  -- fix sql/35
  taille_cm SMALLINT, poids_g INTEGER, notes_coach TEXT,
  indisponibilite TEXT, blessure_resume TEXT, suspension_jusqu_au DATE,
  email_principal TEXT, email_secondaire TEXT,
  telephone_principal TEXT, telephone_secondaire TEXT,
  adresse_postale TEXT, code_postal TEXT, ville TEXT, pays TEXT,
  lieu_naissance JSONB, etablissement_scolaire TEXT, classe_scolaire TEXT,
  personne_a_prevenir_urgence JSONB,
  date_fin_affiliation DATE, annee_arrivee_club INTEGER, validation_ffr BOOLEAN,
  consentement_rgpd_date TIMESTAMPTZ, canal_communication_prefere TEXT,
  droit_image_photos_individuelles BOOLEAN, droit_image_photos_groupe BOOLEAN,
  droit_image_site_web BOOLEAN, droit_image_reseaux_sociaux BOOLEAN,
  droit_image_presse_locale BOOLEAN,
  autorisation_intervention_medicale_urgence BOOLEAN,
  source_creation TEXT, modifie_par TEXT, synchronisation_statut TEXT,
  visible_annuaire BOOLEAN, tag_verifier BOOLEAN,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  profil TEXT, etat_calcule TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
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
    END AS etat_calcule
  FROM personnes p
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE p.id = p_personne_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_joueur_detail(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_joueur_detail(UUID) TO authenticated;

-- =============================================================================
-- 4. Recréation update_joueur_metier (TEXT[] au lieu de UUID[])
-- =============================================================================

DROP FUNCTION IF EXISTS public.update_joueur_metier(UUID, JSONB);

CREATE FUNCTION public.update_joueur_metier(
  p_personne_id UUID, p_patch JSONB
)
RETURNS SETOF public.personnes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_postes    TEXT[];
  v_aptitudes TEXT[];
  v_has_role  BOOLEAN := FALSE;
BEGIN
  -- Autorisation (3 clauses)
  BEGIN
    SELECT public.has_role('admin') OR public.has_role('coach') INTO v_has_role;
  EXCEPTION WHEN undefined_function THEN
    v_has_role := (auth.uid() IS NOT NULL);
  END;
  IF NOT v_has_role THEN
    v_has_role := session_user IN ('postgres', 'supabase_admin');
  END IF;
  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;

  -- Validation
  IF p_personne_id IS NULL THEN RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023'; END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'p_patch doit être un objet JSON' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM personnes WHERE id = p_personne_id) THEN
    RAISE EXCEPTION 'Personne % introuvable', p_personne_id USING ERRCODE = '02000';
  END IF;

  -- Extraction arrays TEXT[] (plus UUID[])
  IF p_patch ? 'postes_uuids' THEN
    IF jsonb_typeof(p_patch->'postes_uuids') <> 'array' THEN
      RAISE EXCEPTION 'postes_uuids doit être un tableau' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value #>> '{}'), '{}'::TEXT[])
      INTO v_postes
    FROM jsonb_array_elements(p_patch->'postes_uuids');
  END IF;

  IF p_patch ? 'aptitudes_uuids' THEN
    IF jsonb_typeof(p_patch->'aptitudes_uuids') <> 'array' THEN
      RAISE EXCEPTION 'aptitudes_uuids doit être un tableau' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value #>> '{}'), '{}'::TEXT[])
      INTO v_aptitudes
    FROM jsonb_array_elements(p_patch->'aptitudes_uuids');
  END IF;

  -- UPDATE partial-patch
  UPDATE personnes SET
    postes_uuids = CASE WHEN p_patch ? 'postes_uuids' THEN v_postes ELSE postes_uuids END,
    aptitudes_uuids = CASE WHEN p_patch ? 'aptitudes_uuids' THEN v_aptitudes ELSE aptitudes_uuids END,
    taille_cm = CASE WHEN p_patch ? 'taille_cm' THEN
      CASE WHEN p_patch->>'taille_cm' IS NULL OR p_patch->>'taille_cm' = '' THEN NULL ELSE (p_patch->>'taille_cm')::SMALLINT END
      ELSE taille_cm END,
    poids_g = CASE WHEN p_patch ? 'poids_g' THEN
      CASE WHEN p_patch->>'poids_g' IS NULL OR p_patch->>'poids_g' = '' THEN NULL ELSE (p_patch->>'poids_g')::INTEGER END
      ELSE poids_g END,
    notes_coach = CASE WHEN p_patch ? 'notes_coach' THEN NULLIF(trim(p_patch->>'notes_coach'), '') ELSE notes_coach END,
    indisponibilite = CASE WHEN p_patch ? 'indisponibilite' THEN NULLIF(trim(p_patch->>'indisponibilite'), '') ELSE indisponibilite END,
    blessure_resume = CASE WHEN p_patch ? 'blessure_resume' THEN NULLIF(trim(p_patch->>'blessure_resume'), '') ELSE blessure_resume END,
    suspension_jusqu_au = CASE WHEN p_patch ? 'suspension_jusqu_au' THEN
      CASE WHEN p_patch->>'suspension_jusqu_au' IS NULL OR p_patch->>'suspension_jusqu_au' = '' THEN NULL ELSE (p_patch->>'suspension_jusqu_au')::DATE END
      ELSE suspension_jusqu_au END,
    modifie_par = 'module-joueurs',
    updated_at = NOW()
  WHERE id = p_personne_id;

  RETURN QUERY SELECT * FROM personnes WHERE id = p_personne_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_joueur_metier(UUID, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_joueur_metier(UUID, JSONB) TO authenticated;

COMMIT;

-- =============================================================================
-- Vérification
-- =============================================================================

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'personnes' AND column_name IN ('postes_uuids','aptitudes_uuids');
-- -> data_type doit être ARRAY (sous-type text)

-- Test : sauver postes courts
-- SELECT id, postes_uuids FROM public.update_joueur_metier(
--   (SELECT id FROM personnes WHERE nom='BERNHART' AND prenom='Leandre' LIMIT 1),
--   '{"postes_uuids":["pst-011","pst-014","pst-015"]}'::JSONB
-- );
-- -> postes_uuids = {pst-011,pst-014,pst-015}
-- =============================================================================
