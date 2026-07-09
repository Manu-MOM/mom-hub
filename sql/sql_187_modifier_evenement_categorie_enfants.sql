-- ============================================================================
-- sql_187 — EVT-PHASES-FANTOMES (D3) : modifier_evenement_complet propage
--           categorie_id aux enfants recréés (phases + matchs).
--
-- CONTEXTE (pt 188) : la RPC détruit puis recrée TOUS les enfants d'une
-- racine de compétition (étapes 4 et 6 de son corps). Or ses INSERT enfants
-- ne posaient PAS `categorie_id` — contrairement à creer_evenement_complet
-- (aligné pt 169). Conséquence prouvée en base : toute édition d'un tournoi
-- décatégorisait silencieusement ses phases/matchs (les « 32 non
-- catégorisés » du Tournoi International de Strasbourg, recréés le
-- 09/07/2026 par un enregistrement de la modale d'édition).
--
-- CORRECTIF (additif, signature INCHANGÉE → CREATE OR REPLACE) :
--   (a) DECLARE v_categorie_id ;
--   (b) étape (1) : lecture de categorie_id de la racine ;
--   (c) étape (6) : colonne categorie_id ajoutée aux 2 INSERT enfants
--       (phase-boîte + match), héritée de la racine.
-- Tout le reste du corps est repris À L'IDENTIQUE du corps déployé
-- (pg_get_functiondef, sonde S3b du 09/07/2026 — DS-1).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.modifier_evenement_complet(
  p_evenement_id uuid,
  p_libelle text,
  p_date_debut timestamp with time zone,
  p_type_competition text DEFAULT NULL::text,
  p_format_de_jeu text DEFAULT NULL::text,
  p_date_fin timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_site_id uuid DEFAULT NULL::uuid,
  p_domicile_exterieur text DEFAULT NULL::text,
  p_equipe_id uuid DEFAULT NULL::uuid,
  p_notes_internes text DEFAULT NULL::text,
  p_equipes_engagees jsonb DEFAULT NULL::jsonb,
  p_phases_par_equipe jsonb DEFAULT NULL::jsonb,
  p_encadrants uuid[] DEFAULT NULL::uuid[],
  p_affectations_n2 jsonb DEFAULT NULL::jsonb,
  p_debut_match time without time zone DEFAULT NULL::time without time zone,
  p_fin_prevue time without time zone DEFAULT NULL::time without time zone,
  p_rdv_heure time without time zone DEFAULT NULL::time without time zone,
  p_rdv_lieu text DEFAULT NULL::text
)
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
  v_categorie_id          UUID;  -- sql_187 : catégorie de la racine, héritée par les enfants
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
  --     sql_187 : + categorie_id (héritage racine → enfants recréés).
  SELECT type_evenement, saison_id, organisateur_principal_id, code, categorie_id
    INTO v_type_evenement, v_saison_id, v_organisateur_id, v_code, v_categorie_id
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
  --     sql_187 : les 2 INSERT posent désormais categorie_id (hérité racine).
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
          equipe_id, categorie_id, saison_id, date_debut,
          organisateur_principal_id,
          evenement_parent_id, phase_libelle, ordre_dans_phase
        ) VALUES (
          v_phase_code, v_phase->>'libelle', 'competition', p_type_competition,
          v_equipe_id_for_phase, v_categorie_id, v_saison_id,
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
              equipe_id, categorie_id, saison_id, format_de_jeu, date_debut,
              organisateur_principal_id,
              evenement_parent_id, phase_libelle, ordre_dans_phase, adversaire_nom
            ) VALUES (
              v_match_code, v_match->>'libelle', 'competition', p_type_competition,
              v_equipe_id_for_phase, v_categorie_id, v_saison_id,
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

-- ============================================================================
-- Vérification fail-loud
-- ============================================================================
DO $verif$
DECLARE
  v_def   TEXT;
  v_nb    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nb
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'modifier_evenement_complet';
  IF v_nb <> 1 THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : % signature(s) de modifier_evenement_complet (attendu 1 — risque PGRST203)', v_nb;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'modifier_evenement_complet';

  IF v_def NOT ILIKE '%SECURITY DEFINER%' THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : SECURITY DEFINER perdu';
  END IF;
  IF (SELECT COUNT(*) FROM regexp_matches(v_def, 'v_categorie_id', 'g')) < 4 THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : v_categorie_id absent des points attendus (declare + select + 2 INSERT)';
  END IF;
  IF (SELECT COUNT(*) FROM regexp_matches(v_def, 'equipe_id, categorie_id, saison_id', 'g')) <> 2 THEN
    RAISE EXCEPTION 'VERIF ÉCHEC : les 2 INSERT enfants ne portent pas categorie_id';
  END IF;

  RAISE NOTICE 'VERIF OK : modifier_evenement_complet propage categorie_id aux enfants (signature inchangée, secdef).';
END;
$verif$;
