-- ============================================================
-- RPC modifier_evenement_complet — édition complète d'un évènement
-- ============================================================
-- Objectif produit : « Modifier » rouvre le modal de création pré-rempli ;
-- au submit, on persiste TOUTES les modifications (méta + horaires +
-- équipes engagées + adversaires + phases + matchs + encadrants).
--
-- STRATÉGIE (décision technique, simplicité > diff fin) : « replace children »
--   POUR LES PHASES/MATCHS, mais RÉCONCILIATION PAR equipe_id POUR LES
--   ÉQUIPES ENGAGÉES (M3) — sinon les compos de base cassent (cf. ci-dessous).
--   • Racine (méta + horaires) → UPDATE.
--   • Phases/matchs + encadrants → SUPPRIMÉS puis RECRÉÉS (pas de compo de
--     match à ce stade ; CASCADE gère leurs descendants).
--   • Équipes engagées (M3) → RÉCONCILIÉES par equipe_id : UPDATE si déjà
--     présente (PRÉSERVE l'id), INSERT si nouvelle, DELETE si retirée. Les
--     adversaires (M5) de chaque équipe sont vidés/recréés (sans compo).
--
-- POURQUOI NE PAS SUPPRIMER/RECRÉER LES M3 (bug corrigé) :
--   compositions.evenement_equipe_id → FK SET NULL. La compo de BASE est
--   rattachée à une équipe engagée via ce champ. Supprimer l'équipe engagée
--   passe la compo de base à NULL ; or l'index
--   idx_compositions_active_base_per_event_equipe_cote est UNIQUE sur
--   (evenement_id, evenement_equipe_id, cote) avec NULLS NOT DISTINCT et
--   WHERE est_active AND type_compo='base'. Deux compos de base → deux NULL
--   → COLLISION → « duplicate key ». En préservant l'id de l'équipe engagée
--   (UPDATE), la compo de base reste rattachée et l'unicité est respectée.
--
-- GARDE DE SÉCURITÉ (FK RESTRICT/NO ACTION) : avant de supprimer les
--   phases/matchs (lignes evenements enfants), on REFUSE proprement si l'un
--   d'eux porte un suivi (chronologie_suivi / lien_suivi, RESTRICT) ou une
--   séance (seances, NO ACTION) — sinon le DELETE planterait. Message métier
--   explicite ; aucune donnée touchée (EXCEPTION → ROLLBACK).
--
-- Signature alignée sur creer_evenement_complet v7 + p_evenement_id en tête.
-- Atomique (transaction PL/pgSQL). SECURITY DEFINER, garde admin|coach.
-- ============================================================

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
  p_debut_match time DEFAULT NULL::time,
  p_fin_prevue time DEFAULT NULL::time,
  p_rdv_heure time DEFAULT NULL::time,
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
  -- (0) GARDE RÔLE
  IF NOT (has_role('admin') OR has_role('coach')) THEN
    RAISE EXCEPTION 'access denied: admin or coach role required (modifier_evenement_complet)';
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

  -- (3) UPDATE racine (méta + horaires). type/saison/organisateur/code
  --     préservés (non éditables). equipe_id : pour entrainement/stage on
  --     garde la valeur passée ; pour competition c'est NULL (équipes en M3).
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
  --     Phases/matchs + encadrants supprimés et recréés (pas de compo de match
  --     chez Manu à ce stade). Les ÉQUIPES ENGAGÉES (M3) ne sont PAS
  --     supprimées ici : leur FK depuis compositions.evenement_equipe_id est
  --     SET NULL → les supprimer ferait passer les compos de base à NULL, et
  --     l'index unique idx_compositions_active_base_per_event_equipe_cote
  --     (evenement_id, evenement_equipe_id, cote) NULLS NOT DISTINCT
  --     entrerait en collision (2 compos base → (racine, NULL, mom)).
  --     → On RÉCONCILIE les M3 par equipe_id en (5) (UPDATE/INSERT/DELETE),
  --       ce qui PRÉSERVE l'id des équipes inchangées → compos de base intactes.
  DELETE FROM public.evenement_encadrants WHERE evenement_id = p_evenement_id;
  -- enfants phases+matchs (2 niveaux) : supprimer d'abord petits-enfants
  DELETE FROM public.evenements
   WHERE evenement_parent_id IN (
     SELECT id FROM public.evenements WHERE evenement_parent_id = p_evenement_id);
  DELETE FROM public.evenements WHERE evenement_parent_id = p_evenement_id;

  -- (5) RÉCONCILIATION des équipes engagées (M3) PAR equipe_id, pour préserver
  --     les ids (donc les compos de base). Adversaires (M5) : pas de compo
  --     dessus → on les vide et recrée par équipe (simple).
  IF p_equipes_engagees IS NOT NULL THEN
    -- (5a) DELETE des équipes engagées ABSENTES du payload (retirées par le
    --      coach). CASCADE supprime leurs M5/N2 ; SET NULL passe une éventuelle
    --      compo de base à NULL (cas rare : on l'accepte ici, le coach a retiré
    --      l'équipe en connaissance de cause — l'avertissement viendra avec le
    --      diff fin ultérieur).
    DELETE FROM public.evenement_equipes_engagees 
     WHERE evenement_id = p_evenement_id
       AND equipe_id NOT IN (
         SELECT (e->>'equipe_id')::uuid
         FROM jsonb_array_elements(p_equipes_engagees) e
       );

    FOR v_engagement IN SELECT * FROM jsonb_array_elements(p_equipes_engagees) LOOP
      v_equipe_id_for_phase := (v_engagement->>'equipe_id')::uuid;

      -- (5b) UPDATE si l'équipe est déjà engagée (préserve l'id → compo base) ;
      --      sinon INSERT. On récupère l'id dans v_evenement_equipe_id.
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

      -- (5c) Adversaires (M5) : vider puis recréer pour CETTE équipe engagée
      --      (aucune compo rattachée aux M5 → sans risque).
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

  -- (6) RECRÉATION phases + matchs (identique à creer_evenement_complet v7)
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

NOTIFY pgrst, 'reload schema';
