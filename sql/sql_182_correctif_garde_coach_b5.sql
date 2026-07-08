-- =====================================================================
-- sql_182 — CORRECTIF-GARDE-COACH : alignement des gardes d'autorisation
--           sur le vocabulaire de rôles actuel (modèle B5 / D-A).
--
-- CONTEXTE
--   La garde `has_role('admin') OR has_role('coach')` testait un rôle
--   'coach' DÉPRÉCIÉ. auth_roles ne connaît que admin | bureau | encadrant.
--   Conséquence terrain : bureau ET encadrants ne pouvaient ni créer ni
--   gérer d'évènements (blocage constaté : « access denied ...
--   (creer_evenement_complet) »).
--
-- CORRECTIF (7 fonctions ; CREATE OR REPLACE, signatures inchangées) :
--   5 fonctions évènement -> admin | bureau | puis_je_faire('gerer_evenements', <cat>)
--       - creer_evenement_complet        (cat = p_categorie_id, résolue AVANT la garde ;
--                                          pour compétition, déduite des équipes engagées)
--       - modifier_evenement_complet     (cat via _b5_categorie_de_evenement(id))
--       - generer_occurrences_evenement  (cat via la mère)
--       - supprimer_occurrence_evenement (cat via l'occurrence)
--       - modifier_recurrence_evenement  (cat via la mère)
--   pilotage_categorie_lignes -> admin | bureau | puis_je_ecrire_categorie(<cat>)
--   update_joueur_metier      -> admin | bureau | puis_je_faire('ecrire_joueur', <cat du joueur>)
--       (chaîne equipe_joueurs -> equipes -> ententes ; referent de categorie seul)
--
-- MATRICE (prérequis) : nouvelle action 'ecrire_joueur' dans
--   capabilities_fonction, autorisée UNIQUEMENT pour 'referent de categorie'
--   (élargissement additif du CHECK action).
--
-- RÉFÉRENCE DÉCISION : B5 (pt 32) — capacité 'gerer_evenements' pour
--   referent de categorie / entraineur principal / manager ; 'ecrire_joueur'
--   pour referent de categorie seul.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (A) Matrice capabilities_fonction : nouvelle action 'ecrire_joueur'
-- ---------------------------------------------------------------------
ALTER TABLE public.capabilities_fonction
  DROP CONSTRAINT capabilities_fonction_action_check;
ALTER TABLE public.capabilities_fonction
  ADD CONSTRAINT capabilities_fonction_action_check
  CHECK (action = ANY (ARRAY[
    'ecrire_seance','ecrire_compo','valider_compo',
    'gerer_presences','gerer_evenements','composer_effectif',
    'ecrire_joueur'
  ]));

INSERT INTO public.capabilities_fonction (fonction_normalisee, action, autorise) VALUES
  ('referent de categorie', 'ecrire_joueur', true),
  ('entraineur principal',  'ecrire_joueur', false),
  ('entraineur adjoint',    'ecrire_joueur', false),
  ('manager',               'ecrire_joueur', false)
ON CONFLICT (fonction_normalisee, action) DO UPDATE SET autorise = EXCLUDED.autorise;

-- ---------------------------------------------------------------------
-- (B) creer_evenement_complet
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creer_evenement_complet(p_type_evenement text, p_libelle text, p_code text, p_date_debut timestamp with time zone, p_saison_id uuid, p_organisateur_principal_id uuid, p_type_competition text DEFAULT NULL::text, p_format_de_jeu text DEFAULT NULL::text, p_date_fin timestamp with time zone DEFAULT NULL::timestamp with time zone, p_site_id uuid DEFAULT NULL::uuid, p_domicile_exterieur text DEFAULT NULL::text, p_equipe_id uuid DEFAULT NULL::uuid, p_recurrence jsonb DEFAULT NULL::jsonb, p_notes_internes text DEFAULT NULL::text, p_equipes_engagees jsonb DEFAULT NULL::jsonb, p_phases_par_equipe jsonb DEFAULT NULL::jsonb, p_encadrants uuid[] DEFAULT NULL::uuid[], p_affectations_n2 jsonb DEFAULT NULL::jsonb, p_debut_match time without time zone DEFAULT NULL::time without time zone, p_fin_prevue time without time zone DEFAULT NULL::time without time zone, p_rdv_heure time without time zone DEFAULT NULL::time without time zone, p_rdv_lieu text DEFAULT NULL::text, p_categorie_id uuid DEFAULT NULL::uuid)
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
  IF p_type_evenement NOT IN ('entrainement', 'competition', 'stage') THEN
    RAISE EXCEPTION 'invalid type_evenement: % (expected entrainement|competition|stage)', p_type_evenement;
  END IF;

  -- (0-bis) Résolution catégorie AVANT la garde (ne dépend que des paramètres) :
  --   param prioritaire ; sinon (compétition) déduite des équipes engagées si
  --   elles relèvent d'une seule catégorie. Nécessaire pour évaluer la garde B5
  --   sur la vraie catégorie même en création de compétition.
  v_categorie_id := p_categorie_id;
  IF v_categorie_id IS NULL AND p_type_evenement = 'competition'
     AND p_equipes_engagees IS NOT NULL AND jsonb_array_length(p_equipes_engagees) > 0 THEN
    SELECT (array_agg(DISTINCT ent.categorie_id))[1]
    INTO v_categorie_id
    FROM jsonb_array_elements(p_equipes_engagees) je
    JOIN public.equipes e   ON e.id = (je->>'equipe_id')::uuid
    JOIN public.ententes ent ON ent.id = e.entente_id
    HAVING count(DISTINCT ent.categorie_id) = 1;
  END IF;

  -- (0) GARDE RÔLE B5 : admin | bureau | capacité gerer_evenements sur la catégorie
  IF NOT (has_role('admin') OR has_role('bureau')
          OR puis_je_faire('gerer_evenements', v_categorie_id)) THEN
    RAISE EXCEPTION 'access denied: admin, bureau or gerer_evenements capability required (creer_evenement_complet)';
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

-- ---------------------------------------------------------------------
-- (B) modifier_evenement_complet
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modifier_evenement_complet(p_evenement_id uuid, p_libelle text, p_date_debut timestamp with time zone, p_type_competition text DEFAULT NULL::text, p_format_de_jeu text DEFAULT NULL::text, p_date_fin timestamp with time zone DEFAULT NULL::timestamp with time zone, p_site_id uuid DEFAULT NULL::uuid, p_domicile_exterieur text DEFAULT NULL::text, p_equipe_id uuid DEFAULT NULL::uuid, p_notes_internes text DEFAULT NULL::text, p_equipes_engagees jsonb DEFAULT NULL::jsonb, p_phases_par_equipe jsonb DEFAULT NULL::jsonb, p_encadrants uuid[] DEFAULT NULL::uuid[], p_affectations_n2 jsonb DEFAULT NULL::jsonb, p_debut_match time without time zone DEFAULT NULL::time without time zone, p_fin_prevue time without time zone DEFAULT NULL::time without time zone, p_rdv_heure time without time zone DEFAULT NULL::time without time zone, p_rdv_lieu text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type_evenement        TEXT;
  v_saison_id             UUID;
  v_organisateur_id       UUID;
  v_code                  TEXT;
  v_evenement_equipe_id   UUID;
  v_phase_id              UUID;
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
  v_collectif_membre_id   UUID;
  v_n_suivi               INTEGER;
  v_n_seances             INTEGER;
BEGIN
  -- (0) GARDE RÔLE B5 : admin | bureau | capacité gerer_evenements sur la catégorie
  IF NOT (has_role('admin') OR has_role('bureau')
          OR puis_je_faire('gerer_evenements', public._b5_categorie_de_evenement(p_evenement_id))) THEN
    RAISE EXCEPTION 'access denied: admin, bureau or gerer_evenements capability required (modifier_evenement_complet)';
  END IF;

  -- (1) Charger l'existant (racine) ; conserver les invariants non éditables
  --     (type_evenement, saison, organisateur, code).
  SELECT type_evenement, saison_id, organisateur_principal_id, code
    INTO v_type_evenement, v_saison_id, v_organisateur_id, v_code
  FROM public.evenements
  WHERE id = p_evenement_id AND evenement_parent_id IS NULL;

  IF v_type_evenement IS NULL THEN
    RAISE EXCEPTION 'évènement racine introuvable : % (ou ce n''est pas une racine)', p_evenement_id;
  END IF;

  -- (2) GARDE SÉCURITÉ : refuser si un enfant (phase/match) porte un suivi
  --     (chronologie_suivi / lien_suivi, FK RESTRICT) ou une séance (NO
  --     ACTION) — leur suppression échouerait. On compte sur tout l'arbre.
  SELECT
    (SELECT COUNT(*) FROM public.chronologie_suivi cs
       WHERE cs.evenement_uuid IN (
         SELECT id FROM public.evenements
         WHERE id = p_evenement_id OR evenement_parent_id = p_evenement_id
            OR evenement_parent_id IN (SELECT id FROM public.evenements WHERE evenement_parent_id = p_evenement_id)))
    +
    (SELECT COUNT(*) FROM public.lien_suivi ls
       WHERE ls.evenement_uuid IN (
         SELECT id FROM public.evenements
         WHERE id = p_evenement_id OR evenement_parent_id = p_evenement_id
            OR evenement_parent_id IN (SELECT id FROM public.evenements WHERE evenement_parent_id = p_evenement_id)))
    INTO v_n_suivi;

  SELECT COUNT(*) FROM public.seances se
    WHERE se.evenement_id IN (
      SELECT id FROM public.evenements
      WHERE id = p_evenement_id OR evenement_parent_id = p_evenement_id
         OR evenement_parent_id IN (SELECT id FROM public.evenements WHERE evenement_parent_id = p_evenement_id))
    INTO v_n_seances;

  IF v_n_suivi > 0 OR v_n_seances > 0 THEN
    RAISE EXCEPTION 'Modification impossible : cet évènement (ou ses matchs) a déjà du suivi (%) ou des séances (%) rattachés. Détachez-les avant de modifier la structure, ou modifiez uniquement depuis la fiche.', v_n_suivi, v_n_seances;
  END IF;

  -- (3) UPDATE racine (méta + horaires).
  UPDATE public.evenements SET
    libelle            = p_libelle,
    type_competition   = p_type_competition,
    format_de_jeu      = p_format_de_jeu,
    date_debut         = p_date_debut,
    date_fin           = p_date_fin,
    site_id            = p_site_id,
    domicile_exterieur = p_domicile_exterieur,
    equipe_id          = CASE WHEN v_type_evenement = 'competition' THEN NULL ELSE p_equipe_id END,
    notes_internes     = p_notes_internes,
    debut_match        = p_debut_match,
    fin_prevue         = p_fin_prevue,
    rdv_heure          = p_rdv_heure,
    rdv_lieu           = p_rdv_lieu,
    updated_at         = NOW()
  WHERE id = p_evenement_id;

  -- (4) SUPPRESSION des enfants SAUF les équipes engagées (M3).
  DELETE FROM public.evenement_encadrants WHERE evenement_id = p_evenement_id;
  DELETE FROM public.evenements
   WHERE evenement_parent_id IN (
     SELECT id FROM public.evenements WHERE evenement_parent_id = p_evenement_id);
  DELETE FROM public.evenements WHERE evenement_parent_id = p_evenement_id;

  -- (5) RÉCONCILIATION des équipes engagées (M3) PAR equipe_id.
  IF p_equipes_engagees IS NOT NULL THEN
    DELETE FROM public.evenement_equipes_engagees 
     WHERE evenement_id = p_evenement_id
       AND equipe_id NOT IN (
         SELECT (e->>'equipe_id')::uuid
         FROM jsonb_array_elements(p_equipes_engagees) e
       );

    FOR v_engagement IN SELECT * FROM jsonb_array_elements(p_equipes_engagees) LOOP
      v_equipe_id_for_phase := (v_engagement->>'equipe_id')::uuid;

      SELECT id INTO v_evenement_equipe_id
      FROM public.evenement_equipes_engagees
      WHERE evenement_id = p_evenement_id AND equipe_id = v_equipe_id_for_phase
      LIMIT 1;

      IF v_evenement_equipe_id IS NULL THEN
        INSERT INTO public.evenement_equipes_engagees (
          evenement_id, equipe_id, format_de_jeu, ordre, notes
        ) VALUES (
          p_evenement_id, v_equipe_id_for_phase,
          v_engagement->>'format_de_jeu',
          NULLIF(v_engagement->>'ordre', '')::integer,
          v_engagement->>'notes'
        ) RETURNING id INTO v_evenement_equipe_id;
      ELSE
        UPDATE public.evenement_equipes_engagees SET
          format_de_jeu = v_engagement->>'format_de_jeu',
          ordre         = NULLIF(v_engagement->>'ordre', '')::integer,
          notes         = v_engagement->>'notes',
          updated_at    = NOW()
        WHERE id = v_evenement_equipe_id;
      END IF;

      v_local_id := v_engagement->>'evenement_equipe_id_local';
      IF v_local_id IS NOT NULL AND v_local_id <> '' THEN
        v_local_to_uuid := v_local_to_uuid || jsonb_build_object(
          v_local_id,
          jsonb_build_object(
            'm3_id',     v_evenement_equipe_id::text,
            'equipe_id', (v_engagement->>'equipe_id')
          )
        );
      END IF;

      DELETE FROM public.evenement_adversaires WHERE evenement_equipe_id = v_evenement_equipe_id;
      IF v_engagement ? 'adversaires' AND jsonb_typeof(v_engagement->'adversaires') = 'array' THEN
        FOR v_adversaire IN SELECT * FROM jsonb_array_elements(v_engagement->'adversaires') LOOP
          INSERT INTO public.evenement_adversaires (
            evenement_equipe_id, adversaire_nom, ordre, notes
          ) VALUES (
            v_evenement_equipe_id,
            v_adversaire->>'adversaire_nom',
            NULLIF(v_adversaire->>'ordre', '')::integer,
            v_adversaire->>'notes'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- (6) RECRÉATION phases + matchs
  IF p_phases_par_equipe IS NOT NULL THEN
    FOR v_phase_block IN SELECT * FROM jsonb_array_elements(p_phases_par_equipe) LOOP
      v_local_id := v_phase_block->>'evenement_equipe_id_local';
      IF v_local_id IS NULL OR (v_local_to_uuid->v_local_id) IS NULL THEN
        RAISE EXCEPTION 'p_phases_par_equipe : evenement_equipe_id_local=% introuvable', v_local_id;
      END IF;
      v_m3_entry            := v_local_to_uuid->v_local_id;
      v_equipe_id_for_phase := (v_m3_entry->>'equipe_id')::uuid;

      v_phase_ordre := 0;
      FOR v_phase IN SELECT * FROM jsonb_array_elements(v_phase_block->'phases') LOOP
        v_phase_ordre := v_phase_ordre + 1;
        v_phase_code := v_code || '-' || v_local_id || '-PH' || v_phase_ordre::text;

        INSERT INTO public.evenements (
          code, libelle, type_evenement, type_competition,
          equipe_id, saison_id, date_debut,
          organisateur_principal_id,
          evenement_parent_id, phase_libelle, ordre_dans_phase
        ) VALUES (
          v_phase_code, v_phase->>'libelle', 'competition', p_type_competition,
          v_equipe_id_for_phase, v_saison_id,
          COALESCE((v_phase->>'date_debut')::timestamptz, p_date_debut),
          v_organisateur_id, p_evenement_id, v_phase->>'libelle',
          NULLIF(v_phase->>'ordre', '')::integer
        ) RETURNING id INTO v_phase_id;

        IF v_phase ? 'matchs' AND jsonb_typeof(v_phase->'matchs') = 'array' THEN
          v_match_ordre := 0;
          FOR v_match IN SELECT * FROM jsonb_array_elements(v_phase->'matchs') LOOP
            v_match_ordre := v_match_ordre + 1;
            v_match_code := v_phase_code || '-M' || v_match_ordre::text;
            INSERT INTO public.evenements (
              code, libelle, type_evenement, type_competition,
              equipe_id, saison_id, format_de_jeu, date_debut,
              organisateur_principal_id,
              evenement_parent_id, phase_libelle, ordre_dans_phase, adversaire_nom
            ) VALUES (
              v_match_code, v_match->>'libelle', 'competition', p_type_competition,
              v_equipe_id_for_phase, v_saison_id,
              COALESCE(v_match->>'format_de_jeu', p_format_de_jeu),
              COALESCE((v_match->>'date_debut')::timestamptz, p_date_debut),
              v_organisateur_id, v_phase_id, v_phase->>'libelle',
              NULLIF(v_match->>'ordre', '')::integer, v_match->>'adversaire_nom'
            );
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- (7) RECRÉATION M8 encadrants
  IF p_encadrants IS NOT NULL THEN
    FOREACH v_personne_id IN ARRAY p_encadrants LOOP
      INSERT INTO public.evenement_encadrants (
        evenement_id, personne_id, roles_encadrement
      ) VALUES (
        p_evenement_id, v_personne_id, ARRAY['coach']::text[]
      );
    END LOOP;
  END IF;

  -- (8) RECRÉATION N2 (affectations staff par équipe) si fournies
  IF p_affectations_n2 IS NOT NULL THEN
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
        LIMIT 1
      );
      IF v_collectif_membre_id IS NULL THEN
        RAISE EXCEPTION 'p_affectations_n2 : personne_id=% non trouvée staff actif', v_personne_id;
      END IF;
      INSERT INTO public.equipe_engagee_membre (evenement_equipe_id, collectif_membre_id)
      VALUES (v_evenement_equipe_id, v_collectif_membre_id);
    END LOOP;
  END IF;

  RETURN p_evenement_id;
END;
$function$;

-- -----------------------------------------------------------------------
-- (B) generer_occurrences_evenement
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generer_occurrences_evenement(p_evenement_mere_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(out_nb_creees integer, out_nb_existantes integer, out_borne_debut date, out_borne_fin date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (has_role('admin') or has_role('bureau')
          or puis_je_faire('gerer_evenements', public._b5_categorie_de_evenement(p_evenement_mere_id))) then
    raise exception 'access denied: admin, bureau or gerer_evenements capability required (generer_occurrences_evenement)'
      using errcode = 'insufficient_privilege';
  end if;
  return query select * from public._generer_occurrences_evenement_core(p_evenement_mere_id, p_from, p_to);
end
$function$
;


-- -----------------------------------------------------------------------
-- (B) supprimer_occurrence_evenement
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supprimer_occurrence_evenement(p_occurrence_id uuid)
 RETURNS TABLE(out_mere_id uuid, out_date_exclue date, out_nb_exclues integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_occ   public.evenements%rowtype;
  v_date  date;
  v_mere  uuid;
begin
  if not (has_role('admin') or has_role('bureau')
          or puis_je_faire('gerer_evenements', public._b5_categorie_de_evenement(p_occurrence_id))) then
    raise exception 'access denied: admin, bureau or gerer_evenements capability required (supprimer_occurrence_evenement)'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_occ from public.evenements where id = p_occurrence_id;
  if not found then
    raise exception 'supprimer_occurrence_evenement: occurrence % introuvable', p_occurrence_id
      using errcode = 'no_data_found';
  end if;
  if v_occ.evenement_parent_id is null then
    raise exception 'supprimer_occurrence_evenement: % n''est pas une occurrence (pas de parent). Pour supprimer une série, supprimer la mère.', p_occurrence_id
      using errcode = 'invalid_parameter_value';
  end if;

  v_mere := v_occ.evenement_parent_id;
  v_date := v_occ.date_debut::date;

  delete from public.evenement_encadrants where evenement_id = p_occurrence_id;
  delete from public.evenements where id = p_occurrence_id;

  update public.evenements
     set dates_exclues = (
           select array_agg(distinct d order by d)
           from unnest(array_append(dates_exclues, v_date)) d
         ),
         updated_at = now()
   where id = v_mere
   returning array_length(dates_exclues,1) into out_nb_exclues;

  out_mere_id := v_mere;
  out_date_exclue := v_date;
  raise notice 'supprimer_occurrence_evenement OK : occ % supprimée, date % exclue de la mère %',
    p_occurrence_id, v_date, v_mere;
  return next;
end
$function$
;


-- ----------------------------------------------------------------------
-- (B) modifier_recurrence_evenement
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modifier_recurrence_evenement(p_evenement_id uuid, p_recurrence jsonb)
 RETURNS TABLE(out_nb_creees integer, out_nb_supprimees integer, out_borne_fin date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mere        public.evenements%rowtype;
  v_saison_fin  date;
  v_fin_rec     date;
  v_borne_fin   date;
  v_nb_creees   int := 0;
  v_nb_suppr    int := 0;
begin
  -- (0) GARDE RÔLE B5 : admin | bureau | capacité gerer_evenements sur la catégorie
  if not (has_role('admin') or has_role('bureau')
          or puis_je_faire('gerer_evenements', public._b5_categorie_de_evenement(p_evenement_id))) then
    raise exception 'access denied: admin, bureau or gerer_evenements capability required (modifier_recurrence_evenement)';
  end if;

  select * into v_mere from public.evenements where id = p_evenement_id;
  if not found then
    raise exception 'modifier_recurrence: évènement % introuvable', p_evenement_id using errcode='no_data_found';
  end if;
  if v_mere.evenement_parent_id is not null then
    raise exception 'modifier_recurrence: % est une occurrence enfant, pas une mère', p_evenement_id using errcode='invalid_parameter_value';
  end if;
  if v_mere.type_evenement not in ('entrainement','stage') then
    raise exception 'modifier_recurrence: type % non récurrençable', v_mere.type_evenement using errcode='feature_not_supported';
  end if;

  update public.evenements
     set recurrence = p_recurrence,
         updated_at = now()
   where id = p_evenement_id;

  select * into v_mere from public.evenements where id = p_evenement_id;

  if v_mere.recurrence is null
     or (v_mere.recurrence ->> 'frequence') is distinct from 'hebdomadaire' then
    out_nb_creees := 0; out_nb_supprimees := 0; out_borne_fin := null;
    return next; return;
  end if;

  select date_fin into v_saison_fin from public.saisons where id = v_mere.saison_id;
  v_fin_rec := nullif(v_mere.recurrence ->> 'fin', '')::date;
  v_borne_fin := least(
                   coalesce(v_fin_rec, v_saison_fin, v_mere.date_debut::date),
                   coalesce(v_saison_fin, v_fin_rec, v_mere.date_debut::date));
  out_borne_fin := v_borne_fin;

  delete from public.evenements
   where evenement_parent_id = p_evenement_id
     and date_debut::date > v_borne_fin
     and date_debut::date > current_date;
  get diagnostics v_nb_suppr = row_count;

  select out_nb_creees into v_nb_creees
  from public._generer_occurrences_evenement_core(
         p_evenement_id, v_mere.date_debut::date, null);

  out_nb_creees := coalesce(v_nb_creees, 0);
  out_nb_supprimees := v_nb_suppr;
  return next;
end
$function$
;


-- -----------------------------------------------------------------------
-- (B) pilotage_categorie_lignes
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pilotage_categorie_lignes(p_categorie_id uuid)
 RETURNS TABLE(joueur_id uuid, equipe_nom text, equipe_id uuid, role text, poste_id uuid, numero_xv integer, poste_court text, depannage boolean, evenement_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Contrôle d'accès B5 : admin | bureau | droit d'écriture sur la catégorie
  -- (lecture du pilotage ouverte à qui peut écrire dans la catégorie).
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'pilotage_categorie_lignes : accès refusé (admin|bureau|droit catégorie requis).'
      USING ERRCODE = '42501';
  END IF;

  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'pilotage_categorie_lignes : p_categorie_id requis.'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT cj.joueur_id,
         e.nom_officiel                       AS equipe_nom,
         e.id                                 AS equipe_id,
         cj.role,
         p.id                                 AS poste_id,
         p.numero_xv,
         p.libelle_court                      AS poste_court,
         cj.est_depannage_hors_categorie      AS depannage,
         cm_match.evenement_id
  FROM composition_joueurs cj
  JOIN compositions cm_match
         ON cm_match.id = cj.composition_id
        AND cm_match.cote = 'mom'
        AND cm_match.type_compo = 'match'
        AND cm_match.est_active = true
  JOIN compositions cm_base
         ON cm_base.id = cm_match.compo_base_origine_id
  JOIN evenement_equipes_engagees eee
         ON eee.id = cm_base.evenement_equipe_id
  JOIN equipes e
         ON e.id = eee.equipe_id
  JOIN ententes ent
         ON ent.id = e.entente_id
        AND ent.categorie_id = p_categorie_id
  LEFT JOIN postes p
         ON p.id = cj.poste_id::uuid
  WHERE cj.role IN ('titulaire', 'remplacant');
END;
$function$
;


-- ----------------------------------------------------------------------
-- (B) update_joueur_metier
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_joueur_metier(p_personne_id uuid, p_patch jsonb)
 RETURNS SETOF personnes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_postes    TEXT[];
  v_aptitudes TEXT[];
  v_has_role  BOOLEAN := FALSE;
  v_cat_id    UUID;
BEGIN
  -- Catégorie du joueur (chaîne equipe_joueurs -> equipes -> ententes).
  -- Aujourd'hui 1 catégorie par joueur ; si plusieurs, on autorise dès qu'AU
  -- MOINS une catégorie du joueur ouvre le droit (traité via EXISTS plus bas).
  -- Autorisation B5 : admin | bureau | capacité ecrire_joueur (referent de
  -- catégorie) sur une catégorie du joueur.
  BEGIN
    v_has_role := public.has_role('admin') OR public.has_role('bureau');
    IF NOT v_has_role THEN
      v_has_role := EXISTS (
        SELECT 1
        FROM public.equipe_joueurs ej
        JOIN public.equipes e   ON e.id = ej.equipe_id
        JOIN public.ententes en ON en.id = e.entente_id
        WHERE ej.personne_id = p_personne_id
          AND public.puis_je_faire('ecrire_joueur', en.categorie_id)
      );
    END IF;
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

  -- Extraction arrays TEXT[]
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
$function$
;

