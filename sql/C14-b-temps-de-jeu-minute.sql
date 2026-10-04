-- =====================================================================
-- MOM Hub · C14-b · Temps de jeu calculé sur la MINUTE DE MATCH
-- =====================================================================
-- Chantier : SUIVI-VEO, lot L4 (FAIT FOI Conception-SUIVI-VEO-v1, gelé
--   le 04/10/2026, décision D3-A).
--
-- POURQUOI : C12-w calculait le temps de jeu sur l'HORODATAGE de saisie
--   (heure réelle) croisé avec les fenêtres de chrono archivées. Le suivi
--   se fait désormais surtout EN DIFFÉRÉ sur la VEO (ajouts et corrections
--   après coup, import FFR à venir) : l'horodatage devient l'heure du
--   visionnage. La minute de match (minute_match, cumulée depuis
--   compositions-editor v3.72) devient la seule horloge fiable. La
--   doctrine pt 53 (« minute_match jamais utilisée ») est LEVÉE ici, par
--   décision explicite de Manu (D3-A).
--
-- MÊME SIGNATURE, MÊME SORTIE que C12-w (aucun appelant à modifier) :
--   get_temps_de_jeu_rencontre(p_evenement_uuid, p_evenement_equipe_id)
--   → out_joueur_id, out_role, out_numero_maillot, out_minutes_jeu,
--     out_secondes_jeu, out_est_entre, out_chrono_complet.
--   out_chrono_complet = « durées des périodes connues » (suivi_chrono.
--   durees_periodes) ; false → minutes NULL (dégradation honnête,
--   jamais un faux 0).
--
-- RÈGLES (par joueur de la compo active de match) :
--   • instant t d'une ligne = minute_match (cumulée), bornée [0, durée
--     totale]. Ancienne convention (minute par période, matchs saisis
--     avant v3.72) : si minute < décalage de sa période → t = décalage +
--     minute. Lignes sans minute (bénévole) ignorées.
--   • titulaire présent à t=0 ; remplaçant présent à sa 1re entrée.
--   • remplacement : sortant sort à t, entrant entre à t (rentrées gérées).
--   • rouge : sortie définitive à t.
--   • blanc / jaune : exclusion temporaire DÉDUITE de t jusqu'à la ligne
--     « retour d'exclusion » du joueur (obs-A-retour-exclusion). Sans
--     ligne de retour : non déduite (durée inconnue, rien d'inventé).
--     2e jaune = rouge (saisi comme tel par l'éditeur).
--   • blessure : n'est pas une sortie (le remplacement la porte).
--   • fin : durée totale réglementaire (temps additionnel non compté).
--
-- DOCTRINE : CREATE OR REPLACE à signature IDENTIQUE (pas de surcharge,
--   PGRST203 impossible). Idempotent, fail-loud, en transaction. Dry-run :
--   remplacer le COMMIT final par ROLLBACK.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_temps_de_jeu_rencontre(
    p_evenement_uuid      UUID,
    p_evenement_equipe_id UUID DEFAULT NULL
) RETURNS TABLE (
    out_joueur_id      UUID,
    out_role           TEXT,
    out_numero_maillot INTEGER,
    out_minutes_jeu    NUMERIC,
    out_secondes_jeu   INTEGER,
    out_est_entre      BOOLEAN,
    out_chrono_complet BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_compo_id   UUID;
    v_nb_compos  INTEGER;
    v_durees     INTEGER[];
    v_ok         BOOLEAN;
    v_total      NUMERIC := 0;
    r            RECORD;
    ev           RECORD;
    v_on         BOOLEAN;
    v_entre      BOOLEAN;
    v_definitif  BOOLEAN;
    v_depuis     NUMERIC;
    v_cumul      NUMERIC;
    v_exclu      NUMERIC;   -- début d'exclusion temporaire en attente de retour
BEGIN
    -- --- Autorisation (patron voie coach, inchangé C12-w) ---
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    IF p_evenement_uuid IS NULL THEN
        RAISE EXCEPTION 'evenement_uuid requis.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM evenements AS e WHERE e.id = p_evenement_uuid) THEN
        RAISE EXCEPTION 'Évènement introuvable : %', p_evenement_uuid;
    END IF;

    -- --- Compo de référence (fail-loud sur l'ambiguïté, inchangé C12-w) ---
    SELECT count(*) INTO v_nb_compos
    FROM compositions AS c
    WHERE c.evenement_id = p_evenement_uuid
      AND c.est_active = TRUE
      AND c.type_compo = 'match'
      AND (p_evenement_equipe_id IS NULL OR c.evenement_equipe_id = p_evenement_equipe_id);
    IF v_nb_compos = 0 THEN
        RAISE EXCEPTION 'Aucune compo active de match pour cet évènement%.',
            CASE WHEN p_evenement_equipe_id IS NOT NULL
                 THEN ' / équipe engagée ' || p_evenement_equipe_id::TEXT ELSE '' END;
    ELSIF v_nb_compos > 1 THEN
        RAISE EXCEPTION 'Effectif ambigu : % compos actives de match. Préciser p_evenement_equipe_id.', v_nb_compos;
    END IF;
    SELECT c.id INTO v_compo_id
    FROM compositions AS c
    WHERE c.evenement_id = p_evenement_uuid
      AND c.est_active = TRUE
      AND c.type_compo = 'match'
      AND (p_evenement_equipe_id IS NULL OR c.evenement_equipe_id = p_evenement_equipe_id);

    -- --- Durées des périodes (config du chrono) ---
    SELECT sc.durees_periodes INTO v_durees
    FROM suivi_chrono AS sc
    WHERE sc.evenement_uuid = p_evenement_uuid;
    v_ok := v_durees IS NOT NULL
        AND coalesce(array_length(v_durees, 1), 0) >= 1
        AND NOT EXISTS (SELECT 1 FROM unnest(v_durees) AS d (m) WHERE d.m IS NULL OR d.m <= 0);
    IF v_ok THEN
        SELECT sum(d.m) INTO v_total FROM unnest(v_durees) AS d (m);
    END IF;

    FOR r IN
        SELECT cj.joueur_id, cj.role, cj.numero_maillot
        FROM composition_joueurs AS cj
        WHERE cj.composition_id = v_compo_id
        ORDER BY cj.role, cj.numero_maillot NULLS LAST
    LOOP
        v_on        := (r.role = 'titulaire');
        v_entre     := v_on;
        v_definitif := FALSE;
        v_depuis    := 0;
        v_cumul     := 0;
        v_exclu     := NULL;

        IF v_ok THEN
            FOR ev IN
                SELECT x.t, x.genre
                FROM (
                    SELECT
                        least(greatest(
                            CASE
                                WHEN cs.minute_match < off.decalage THEN off.decalage + cs.minute_match
                                ELSE cs.minute_match
                            END, 0), v_total)::NUMERIC AS t,
                        CASE
                            WHEN cs.observable_id = 'obs-A-substitution' AND cs.joueur_uuid = r.joueur_id THEN 'sortie'
                            WHEN cs.observable_id = 'obs-A-substitution' THEN 'entree'
                            WHEN cs.observable_id = 'obs-A-rouge' THEN 'rouge'
                            WHEN cs.observable_id = 'obs-A-retour-exclusion' THEN 'retour'
                            ELSE 'exclusion'
                        END AS genre,
                        cs.horodatage
                    FROM chronologie_suivi AS cs
                    CROSS JOIN LATERAL (
                        SELECT coalesce(sum(d.m), 0) AS decalage
                        FROM unnest(v_durees[1:greatest(cs.periode - 1, 0)]) AS d (m)
                    ) AS off
                    WHERE cs.evenement_uuid = p_evenement_uuid
                      AND cs.annule = FALSE
                      AND cs.equipe_concernee = 'notre'
                      AND cs.minute_match IS NOT NULL
                      AND (
                          (cs.observable_id = 'obs-A-substitution'
                           AND (cs.joueur_uuid = r.joueur_id OR cs.joueur_uuid_entrant = r.joueur_id))
                          OR (cs.observable_id IN ('obs-A-rouge', 'obs-A-jaune', 'obs-A-blanc', 'obs-A-retour-exclusion')
                              AND cs.joueur_uuid = r.joueur_id)
                      )
                ) AS x
                ORDER BY x.t, x.horodatage
            LOOP
                IF ev.genre = 'entree' THEN
                    IF NOT v_on AND NOT v_definitif THEN
                        v_on := TRUE; v_depuis := ev.t; v_entre := TRUE;
                    END IF;
                ELSIF ev.genre IN ('sortie', 'rouge') THEN
                    IF v_on THEN
                        v_cumul := v_cumul + (ev.t - v_depuis);
                        v_on := FALSE;
                    END IF;
                    IF v_exclu IS NOT NULL THEN
                        -- sorti pendant une exclusion : on déduit jusqu'à la sortie.
                        v_cumul := v_cumul - greatest(ev.t - v_exclu, 0);
                        v_exclu := NULL;
                    END IF;
                    IF ev.genre = 'rouge' THEN v_definitif := TRUE; END IF;
                ELSIF ev.genre = 'exclusion' THEN
                    IF v_on AND v_exclu IS NULL THEN v_exclu := ev.t; END IF;
                ELSIF ev.genre = 'retour' THEN
                    IF v_exclu IS NOT NULL THEN
                        v_cumul := v_cumul - greatest(ev.t - v_exclu, 0);
                        v_exclu := NULL;
                    END IF;
                END IF;
            END LOOP;
            IF v_on THEN
                v_cumul := v_cumul + (v_total - v_depuis);
            END IF;
            -- v_exclu encore ouvert = retour non saisi : non déduit (honnête).
        ELSE
            -- Durées inconnues : seule l'entrée en jeu est établie.
            v_entre := v_entre OR EXISTS (
                SELECT 1 FROM chronologie_suivi AS cs
                WHERE cs.evenement_uuid = p_evenement_uuid
                  AND cs.annule = FALSE
                  AND cs.equipe_concernee = 'notre'
                  AND cs.observable_id = 'obs-A-substitution'
                  AND cs.joueur_uuid_entrant = r.joueur_id
            );
        END IF;

        out_joueur_id      := r.joueur_id;
        out_role           := r.role;
        out_numero_maillot := r.numero_maillot;
        out_minutes_jeu    := CASE WHEN v_ok THEN round(greatest(v_cumul, 0), 1) END;
        out_secondes_jeu   := CASE WHEN v_ok THEN round(greatest(v_cumul, 0) * 60)::INTEGER END;
        out_est_entre      := v_entre;
        out_chrono_complet := v_ok;
        RETURN NEXT;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_temps_de_jeu_rencontre(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_temps_de_jeu_rencontre(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- Vérification fail-loud : une seule signature, sortie inchangée.
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_nb  INTEGER;
    v_res TEXT;
BEGIN
    SELECT count(*), max(pg_get_function_result(p.oid)) INTO v_nb, v_res
    FROM pg_proc AS p
    INNER JOIN pg_namespace AS n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_temps_de_jeu_rencontre';
    IF v_nb <> 1 THEN
        RAISE EXCEPTION 'C14-b : % surcharge(s) de get_temps_de_jeu_rencontre.', v_nb;
    END IF;
    IF v_res NOT LIKE '%out_chrono_complet boolean%' THEN
        RAISE EXCEPTION 'C14-b : sortie inattendue : %', v_res;
    END IF;
    RAISE NOTICE 'C14-b OK : 1 signature, sortie conforme.';
END
$verif$;

COMMIT;
