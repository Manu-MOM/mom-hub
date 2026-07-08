-- ============================================================================
-- sql/sql_184_dupliquer_seance.sql — RPC dupliquer_seance
-- Chantier SEANCE-DUPLICATION v1 (pt 180)
--
-- Duplique une séance de préparation d'entraînement : méta + blocs + ateliers.
-- La copie repart en 'brouillon', SANS date, filiation tracée via
-- modele_origine_id. Même equipe_id => même catégorie par construction.
--
-- Garde : admin | bureau | puis_je_ecrire_categorie(catégorie de l'équipe
-- source), alignée sur les policies d'écriture B5 réelles des 3 tables
-- (sondées en base le 08/07/2026 ; l'ancienne garde admin|coach de
-- sql/28-seances.sql n'est plus en vigueur).
--
-- Colonnes recopiées vérifiées en base (information_schema), y compris les
-- 3 colonnes de seances_blocs absentes de sql/28-seances.sql : voie,
-- encadrant_id, encadrants_ids (encadrants multi de la trame).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dupliquer_seance(p_source_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source     public.seances%ROWTYPE;
  v_new_id     uuid;
  v_cat        uuid;
  b            RECORD;
  v_new_bloc   uuid;
BEGIN
  -- 1) Charger la séance source
  SELECT * INTO v_source FROM public.seances WHERE id = p_source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Séance source introuvable : %', p_source_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 2) Garde d'autorisation (SECURITY DEFINER court-circuite la RLS)
  v_cat := public._b5_categorie_de_equipe(v_source.equipe_id);
  IF NOT (
        public.has_role('admin')
     OR public.has_role('bureau')
     OR public.puis_je_ecrire_categorie(v_cat)
  ) THEN
    RAISE EXCEPTION 'access denied: droit d''écriture requis sur la catégorie de la séance'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3) INSERT séance copie
  --    Recopie de toute la méta SAUF : id (neuf), etat forcé brouillon,
  --    date_seance NULL, est_modele FALSE, modele_origine_id = source,
  --    created_by = auth.uid(), timestamps par défaut.
  INSERT INTO public.seances (
    equipe_id, evenement_id, date_seance, heure_debut, duree_totale_min,
    effectif_prevu, lieu_id, meteo_text, encadrants_text, axe_travail_general,
    theme_principal, objectifs_text, bloc_cycle, materiel_global_text,
    etat, est_modele, modele_origine_id, created_by
  ) VALUES (
    v_source.equipe_id,
    v_source.evenement_id,
    NULL,                       -- date à ressaisir
    v_source.heure_debut,
    v_source.duree_totale_min,
    v_source.effectif_prevu,
    v_source.lieu_id,
    v_source.meteo_text,
    v_source.encadrants_text,
    v_source.axe_travail_general,
    v_source.theme_principal,
    v_source.objectifs_text,
    v_source.bloc_cycle,
    v_source.materiel_global_text,
    'brouillon',                -- copie toujours en brouillon
    FALSE,                      -- une copie n'est pas un modèle
    p_source_id,                -- filiation
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  -- 4) INSERT des blocs (ordre préservé) + ateliers de chaque bloc
  FOR b IN
    SELECT * FROM public.seances_blocs
    WHERE seance_id = p_source_id
    ORDER BY ordre
  LOOP
    INSERT INTO public.seances_blocs (
      seance_id, ordre, type_bloc, titre_precision, duree_min, intensite,
      etiquette_axe2, etiquette_axe3, comportements_attendus,
      organisation_spatio_temporelle, groupes_jsonb, materiel_jsonb,
      contenu_pedagogique_axe4, notes_bloc, voie, encadrant_id, encadrants_ids
    ) VALUES (
      v_new_id, b.ordre, b.type_bloc, b.titre_precision, b.duree_min, b.intensite,
      b.etiquette_axe2, b.etiquette_axe3, b.comportements_attendus,
      b.organisation_spatio_temporelle, b.groupes_jsonb, b.materiel_jsonb,
      b.contenu_pedagogique_axe4, b.notes_bloc, b.voie, b.encadrant_id, b.encadrants_ids
    )
    RETURNING id INTO v_new_bloc;

    -- Ateliers rattachés à ce bloc → rattachés au nouveau bloc
    INSERT INTO public.seances_blocs_ateliers (
      bloc_id, atelier_fileid_drive, ordre, notes_atelier
    )
    SELECT v_new_bloc, sba.atelier_fileid_drive, sba.ordre, sba.notes_atelier
    FROM public.seances_blocs_ateliers sba
    WHERE sba.bloc_id = b.id;
  END LOOP;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.dupliquer_seance(uuid) IS
  'Duplique une séance (méta + blocs + ateliers) en une nouvelle séance brouillon sans date, filiation via modele_origine_id. Garde B5 admin|bureau|référent de la catégorie. SEANCE-DUPLICATION v1 (pt 180).';

REVOKE ALL ON FUNCTION public.dupliquer_seance(uuid) FROM public;
REVOKE ALL ON FUNCTION public.dupliquer_seance(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dupliquer_seance(uuid) TO authenticated;
