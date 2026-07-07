-- =====================================================================
-- sql_171 — EVT-RATTACHEMENT-CATEGORIE — Étape 5/7 : création
-- =====================================================================
-- creer_evenement_complet reçoit p_categorie_id (23e paramètre, DEFAULT NULL).
--   - entrainement/stage : p_categorie_id REQUIS ; equipe_id facultatif.
--   - competition : catégorie déduite des équipes engagées si non fournie.
--   - phases/matchs héritent categorie_id de la racine.
-- DROP + CREATE dans la même transaction (anti-overload PGRST203).
-- Grants préservés (EXECUTE authenticated/anon/service_role) — garde interne
-- has_role('admin'|'coach') inchangée.
--
-- Exécuté et vérifié : signature unique, test création entraînement Senior F
-- sans équipe accepté, charnière RLS = Senior F.
-- =====================================================================

drop function if exists public.creer_evenement_complet(text,text,text,timestamptz,uuid,uuid,text,text,timestamptz,uuid,text,uuid,jsonb,text,jsonb,jsonb,uuid[],jsonb,time,time,time,text);

CREATE FUNCTION public.creer_evenement_complet(
  p_type_evenement text, p_libelle text, p_code text, p_date_debut timestamptz,
  p_saison_id uuid, p_organisateur_principal_id uuid,
  p_type_competition text DEFAULT NULL, p_format_de_jeu text DEFAULT NULL,
  p_date_fin timestamptz DEFAULT NULL, p_site_id uuid DEFAULT NULL,
  p_domicile_exterieur text DEFAULT NULL, p_equipe_id uuid DEFAULT NULL,
  p_recurrence jsonb DEFAULT NULL, p_notes_internes text DEFAULT NULL,
  p_equipes_engagees jsonb DEFAULT NULL, p_phases_par_equipe jsonb DEFAULT NULL,
  p_encadrants uuid[] DEFAULT NULL, p_affectations_n2 jsonb DEFAULT NULL,
  p_debut_match time DEFAULT NULL, p_fin_prevue time DEFAULT NULL,
  p_rdv_heure time DEFAULT NULL, p_rdv_lieu text DEFAULT NULL,
  p_categorie_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_evenement_id          UUID;
  v_evenement_equipe_id   UUID;
  v_phase_id              UUID;
  v_collectif_membre_id   UUID;
  v_engagement            JSONB;
  v_adversaire            JSONB;
  v_phase_block           JSONB;
  v_phase                 JSONB;
  v_match                 JSONB;
  v_local_id              TEXT;
  v_local_to_uuid         JSONB := '{}'::jsonb;
  v_personne_id           UUID;
  v_equipe_id_for_phase   UUID;
  v_m3_entry              JSONB;
  v_phase_ordre           INTEGER;
  v_match_ordre           INTEGER;
  v_phase_code            TEXT;
  v_match_code            TEXT;
  v_categorie_id          UUID;      -- catégorie résolue (param ou déduite)
  v_n_m3_attendu          INTEGER := 0;
  v_n_m3_insere           INTEGER := 0;
  v_n_m8_attendu          INTEGER := 0;
  v_n_m8_insere           INTEGER := 0;
  v_n_n2_attendu          INTEGER := 0;
  v_n_n2_insere           INTEGER := 0;
BEGIN
  IF NOT (has_role('admin') OR has_role('coach')) THEN
    RAISE EXCEPTION 'access denied: admin or coach role required (creer_evenement_complet)';
  END IF;

  IF p_type_evenement NOT IN ('entrainement', 'competition', 'stage') THEN
    RAISE EXCEPTION 'invalid type_evenement: % (expected entrainement|competition|stage)', p_type_evenement;
  END IF;

  -- (1) Rattachement CATÉGORIE (nouveau modèle EVT-RATTACHEMENT-CATEGORIE).
  --     entrainement/stage : categorie_id requis (equipe_id devient facultatif).
  IF p_type_evenement IN ('entrainement', 'stage') AND p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'categorie_id requis pour type_evenement=% (CHECK categorie_obligatoire_si_pas_parent)', p_type_evenement;
  END IF;

  IF p_type_evenement = 'competition' THEN
    IF p_equipes_engagees IS NULL OR jsonb_array_length(p_equipes_engagees) = 0 THEN
      RAISE EXCEPTION 'au moins une équipe engagée requise pour une compétition (R2 §3.1.6 doc UX)';
    END IF;
  END IF;

  -- Résolution catégorie : param prioritaire ; sinon (compétition) déduite
  -- des équipes engagées si elles relèvent d'une seule catégorie.
  v_categorie_id := p_categorie_id;
  IF v_categorie_id IS NULL AND p_type_evenement = 'competition' THEN
    SELECT (array_agg(DISTINCT ent.categorie_id))[1]
    INTO v_categorie_id
    FROM jsonb_array_elements(p_equipes_engagees) je
    JOIN public.equipes e   ON e.id = (je->>'equipe_id')::uuid
    JOIN public.ententes ent ON ent.id = e.entente_id
    HAVING count(DISTINCT ent.categorie_id) = 1;
  END IF;

  -- (2) INSERT racine — + categorie_id
  INSERT INTO public.evenements (
    code, libelle, type_evenement, type_competition,
    equipe_id, categorie_id, saison_id, format_de_jeu,
    date_debut, date_fin, site_id,
    organisateur_principal_id,
    domicile_exterieur, recurrence, notes_internes,
    debut_match, fin_prevue, rdv_heure, rdv_lieu
  ) VALUES (
    p_code, p_libelle, p_type_evenement, p_type_competition,
    p_equipe_id, v_categorie_id, p_saison_id, p_format_de_jeu,
    p_date_debut, p_date_fin, p_site_id,
    p_organisateur_principal_id,
    p_domicile_exterieur, p_recurrence, p_notes_internes,
    p_debut_match, p_fin_prevue, p_rdv_heure, p_rdv_lieu
  ) RETURNING id INTO v_evenement_id;

  IF v_evenement_id IS NULL THEN
    RAISE EXCEPTION 'INSERT evenements racine échoué — id NULL retour';
  END IF;

  -- (3) M3 + M5
  IF p_equipes_engagees IS NOT NULL THEN
    v_n_m3_attendu := jsonb_array_length(p_equipes_engagees);
    FOR v_engagement IN SELECT * FROM jsonb_array_elements(p_equipes_engagees) LOOP
      INSERT INTO public.evenement_equipes_engagees (
        evenement_id, equipe_id, format_de_jeu, ordre, notes
      ) VALUES (
        v_evenement_id, (v_engagement->>'equipe_id')::uuid,
        v_engagement->>'format_de_jeu',
        NULLIF(v_engagement->>'ordre', '')::integer,
        v_engagement->>'notes'
      ) RETURNING id INTO v_evenement_equipe_id;
      v_n_m3_insere := v_n_m3_insere + 1;
      v_local_id := v_engagement->>'evenement_equipe_id_local';
      IF v_local_id IS NOT NULL AND v_local_id <> '' THEN
        v_local_to_uuid := v_local_to_uuid || jsonb_build_object(
          v_local_id, jsonb_build_object(
            'm3_id', v_evenement_equipe_id::text,
            'equipe_id', (v_engagement->>'equipe_id')));
      END IF;
      IF v_engagement ? 'adversaires' AND jsonb_typeof(v_engagement->'adversaires') = 'array' THEN
        FOR v_adversaire IN SELECT * FROM jsonb_array_elements(v_engagement->'adversaires') LOOP
          INSERT INTO public.evenement_adversaires (
            evenement_equipe_id, adversaire_nom, ordre, notes
          ) VALUES (
            v_evenement_equipe_id, v_adversaire->>'adversaire_nom',
            NULLIF(v_adversaire->>'ordre', '')::integer, v_adversaire->>'notes');
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- (4) M6 phases + matchs (héritent categorie_id de la racine)
  IF p_phases_par_equipe IS NOT NULL THEN
    FOR v_phase_block IN SELECT * FROM jsonb_array_elements(p_phases_par_equipe) LOOP
      v_local_id := v_phase_block->>'evenement_equipe_id_local';
      IF v_local_id IS NULL OR (v_local_to_uuid->v_local_id) IS NULL THEN
        RAISE EXCEPTION 'p_phases_par_equipe : evenement_equipe_id_local=% introuvable dans p_equipes_engagees', v_local_id;
      END IF;
      v_m3_entry := v_local_to_uuid->v_local_id;
      v_evenement_equipe_id := (v_m3_entry->>'m3_id')::uuid;
      v_equipe_id_for_phase := (v_m3_entry->>'equipe_id')::uuid;
      v_phase_ordre := 0;
      FOR v_phase IN SELECT * FROM jsonb_array_elements(v_phase_block->'phases') LOOP
        v_phase_ordre := v_phase_ordre + 1;
        v_phase_code := p_code || '-' || v_local_id || '-PH' || v_phase_ordre::text;
        INSERT INTO public.evenements (
          code, libelle, type_evenement, type_competition,
          equipe_id, categorie_id, saison_id,
          date_debut, organisateur_principal_id,
          evenement_parent_id, phase_libelle, ordre_dans_phase
        ) VALUES (
          v_phase_code, v_phase->>'libelle', 'competition', p_type_competition,
          v_equipe_id_for_phase, v_categorie_id, p_saison_id,
          COALESCE((v_phase->>'date_debut')::timestamptz, p_date_debut),
          p_organisateur_principal_id, v_evenement_id,
          v_phase->>'libelle', NULLIF(v_phase->>'ordre', '')::integer
        ) RETURNING id INTO v_phase_id;
        IF v_phase ? 'matchs' AND jsonb_typeof(v_phase->'matchs') = 'array' THEN
          v_match_ordre := 0;
          FOR v_match IN SELECT * FROM jsonb_array_elements(v_phase->'matchs') LOOP
            v_match_ordre := v_match_ordre + 1;
            v_match_code := v_phase_code || '-M' || v_match_ordre::text;
            INSERT INTO public.evenements (
              code, libelle, type_evenement, type_competition,
              equipe_id, categorie_id, saison_id, format_de_jeu,
              date_debut, organisateur_principal_id,
              evenement_parent_id, phase_libelle, ordre_dans_phase, adversaire_nom
            ) VALUES (
              v_match_code, v_match->>'libelle', 'competition', p_type_competition,
              v_equipe_id_for_phase, v_categorie_id, p_saison_id,
              COALESCE(v_match->>'format_de_jeu', p_format_de_jeu),
              COALESCE((v_match->>'date_debut')::timestamptz, p_date_debut),
              p_organisateur_principal_id, v_phase_id,
              v_phase->>'libelle', NULLIF(v_match->>'ordre', '')::integer,
              v_match->>'adversaire_nom');
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- (5) M8 encadrants
  IF p_encadrants IS NOT NULL THEN
    v_n_m8_attendu := array_length(p_encadrants, 1);
    IF v_n_m8_attendu IS NULL THEN v_n_m8_attendu := 0; END IF;
    FOREACH v_personne_id IN ARRAY p_encadrants LOOP
      INSERT INTO public.evenement_encadrants (
        evenement_id, personne_id, roles_encadrement
      ) VALUES (v_evenement_id, v_personne_id, ARRAY['coach']::text[]);
      v_n_m8_insere := v_n_m8_insere + 1;
    END LOOP;
  END IF;

  -- (6) N2 staff
  IF p_affectations_n2 IS NOT NULL THEN
    v_n_n2_attendu := jsonb_array_length(p_affectations_n2);
    FOR v_engagement IN SELECT * FROM jsonb_array_elements(p_affectations_n2) LOOP
      v_local_id := v_engagement->>'evenement_equipe_id_local';
      v_personne_id := (v_engagement->>'personne_id')::uuid;
      IF v_local_id IS NULL OR (v_local_to_uuid->v_local_id) IS NULL THEN
        RAISE EXCEPTION 'p_affectations_n2 : evenement_equipe_id_local=% introuvable', v_local_id;
      END IF;
      v_evenement_equipe_id := ((v_local_to_uuid->v_local_id)->>'m3_id')::uuid;
      v_collectif_membre_id := (
        SELECT cm.id FROM public.collectif_membre cm
        JOIN public.ententes en ON en.id = cm.entente_id
        JOIN public.saisons s ON s.id = en.saison_id
        WHERE cm.personne_id = v_personne_id AND cm.role = 'staff'
          AND cm.date_fin IS NULL AND s.est_active = TRUE
        LIMIT 1);
      IF v_collectif_membre_id IS NULL THEN
        RAISE EXCEPTION 'p_affectations_n2 : personne_id=% non trouvée dans collectif_membre role=staff actif saison courante (DS-1 anti-muette)', v_personne_id;
      END IF;
      INSERT INTO public.equipe_engagee_membre (
        evenement_equipe_id, collectif_membre_id
      ) VALUES (v_evenement_equipe_id, v_collectif_membre_id);
      v_n_n2_insere := v_n_n2_insere + 1;
    END LOOP;
  END IF;

  -- (7) FAIL-LOUD
  IF v_n_m3_insere <> v_n_m3_attendu THEN
    RAISE EXCEPTION 'fail-loud M3 : % insérés, % attendus', v_n_m3_insere, v_n_m3_attendu;
  END IF;
  IF v_n_m8_insere <> v_n_m8_attendu THEN
    RAISE EXCEPTION 'fail-loud M8 : % insérés, % attendus', v_n_m8_insere, v_n_m8_attendu;
  END IF;
  IF v_n_n2_insere <> v_n_n2_attendu THEN
    RAISE EXCEPTION 'fail-loud N2 : % insérés, % attendus', v_n_n2_insere, v_n_n2_attendu;
  END IF;

  RAISE NOTICE 'creer_evenement_complet OK : evenement=% cat=% M3=% M8=% N2=%',
    v_evenement_id, v_categorie_id, v_n_m3_insere, v_n_m8_insere, v_n_n2_insere;

  RETURN v_evenement_id;
END;
$function$;
