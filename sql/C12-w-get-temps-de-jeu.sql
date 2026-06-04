-- =====================================================================
-- MOM Hub · C12-w · RPC get_temps_de_jeu_rencontre — temps de jeu fiable
-- =====================================================================
-- Chantier : SUIVI-COACH-7 — temps de jeu fiable. 2e et dernier fichier
--   backend (le 1er, C12-v, a livré l'archive des périodes jouées).
--   Sortie : le temps de jeu par joueur d'un match devient calculable
--   honnêtement, consommable par la future fiche stats joueur.
--
-- PRINCIPE DE CALCUL (décision tracée — approche INTERSECTION D'INTERVALLES) :
--   minute_match est PROUVÉ non fiable (pt 53) → on ne l'utilise JAMAIS.
--   Seuls les horodatage (NOT NULL, fiables) servent de base de temps.
--   Le temps de jeu d'un joueur = somme des durées où simultanément :
--     • le joueur est PRÉSENT sur le terrain (entre son entrée et sa sortie),
--     • une PÉRIODE est en cours (fenêtre [debut_at, fin_at] de
--       suivi_chrono_periodes, livrée par C12-v).
--   = Σ sur les fenêtres de période : |intersection([présence], [fenêtre])|.
--   Ce mécanisme UNIQUE couvre sans cas particulier : titulaires (présents
--   dès l'ouverture P1), remplaçants (présents dès la sub où ils entrent),
--   sorties (sub sortante / carton rouge / fin), mi-temps (temps mort hors
--   fenêtre → non compté, correct), multi-périodes. Aucune dépendance à
--   minute_match ni à un coup d'envoi reconstitué.
--
-- PRÉSENCE D'UN JOUEUR (« notre » équipe uniquement) :
--   • entrée = ouverture de la 1re période            si role='titulaire'
--            = horodatage de la sub où il est joueur_uuid_entrant sinon
--   • sortie = horodatage de la sub où il est joueur_uuid (sortant)
--            OU horodatage d'un carton ROUGE le concernant (D-C : le rouge
--               clôt la présence ; le JAUNE est ignoré, dette TEMPS-JEU-JAUNE)
--            OU fin du match (dernière fin_at) si jamais sorti.
--   Subs/cartons retenus : annule=false, equipe_concernee='notre'.
--   Blessure (C12-u) = simple observable, ne sort PAS le joueur.
--
-- DÉCISION D-G (Manu, option simple) : présence terrain bornée
--   (entrée→sortie), arrêts internes (pauses) NON déduits au prorata par
--   joueur. Les pauses ne réduisent le temps de jeu que via le bornage des
--   fenêtres (une pause à l'INTÉRIEUR d'une période reste comptée comme
--   présence — choix assumé : en M14 on veut le temps PASSÉ sur le terrain).
--
-- SÉLECTION DE L'EFFECTIF (établie par sondes, anti-fabrication pt 14) :
--   compo où evenement_id=p_evt AND est_active=true AND type_compo='match'.
--   etat n'est PAS un critère (la compo active du match test est 'brouillon',
--   pas 'validee' → filtrer sur etat casserait le calcul). role ∈
--   ('titulaire','remplacant'). etat_joueur='base' partout → non discriminant.
--   Multi-équipes : si >1 compo active et p_evenement_equipe_id fourni →
--   filtre dessus ; si >1 et non fourni → EXCEPTION (jamais deviner).
--
-- DÉGRADATION FAIL-LOUD (honnêteté du chiffre) :
--   Si AUCUNE fenêtre de période n'est archivée (chrono jamais lancé sur ce
--   match) → out_chrono_complet=false et out_minutes_jeu=NULL pour tous.
--   On ne fabrique JAMAIS une minute. (Cohérent avec les rapports qui
--   excluent déjà le temps de jeu en l'absence de chrono, pt 53.)
--   Idem si une fenêtre reste ouverte (fin_at NULL = match non clôturé) :
--   out_chrono_complet=false (calcul partiel possible mais signalé non fiable).
--
-- DOCTRINE — AJOUT PUR. RPC neuve en LECTURE seule. Aucune table, aucune
--   fonction existante modifiée. Patron voie coach RÉEL (sonde : auth.uid()
--   IS NULL → EXCEPTION, pas _coach_auth_uid() fantôme ; cf C13-a/b).
--   Table fermée → lecture via SECURITY DEFINER. Colonnes de sortie out_*
--   (anti-ambiguïté 42702). Idempotent (DROP IF EXISTS + CREATE),
--   fail-loud, transactionnel.
--
-- Pré-requis : suivi_chrono_periodes (C12-v), chronologie_suivi (subs +
--   cartons), compositions + composition_joueurs (effectif). evenements.
-- =====================================================================

BEGIN;

-- DROP préalable : RETURNS TABLE → CREATE OR REPLACE refusé si la signature
-- de sortie change (leçon 42702, C13-a/b). Idempotent.
DROP FUNCTION IF EXISTS get_temps_de_jeu_rencontre(UUID);
DROP FUNCTION IF EXISTS get_temps_de_jeu_rencontre(UUID, UUID);

CREATE FUNCTION get_temps_de_jeu_rencontre(
    p_evenement_uuid       UUID,
    p_evenement_equipe_id  UUID DEFAULT NULL   -- désambiguïse le multi-équipes
) RETURNS TABLE(
    out_joueur_id        UUID,
    out_role             TEXT,
    out_numero_maillot   INTEGER,
    out_minutes_jeu      NUMERIC,    -- minutes de jeu (NULL si chrono incomplet)
    out_secondes_jeu     INTEGER,    -- détail en secondes (NULL si incomplet)
    out_est_entre        BOOLEAN,    -- a effectivement foulé le terrain
    out_chrono_complet   BOOLEAN     -- false = chrono absent/non clôturé → minutes NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_compo_id      UUID;
    v_nb_compos     INTEGER;
    v_nb_fenetres   INTEGER;
    v_nb_ouvertes   INTEGER;
    v_chrono_ok     BOOLEAN;
BEGIN
    -- --- Autorisation (patron voie coach réel) ---
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.

    IF p_evenement_uuid IS NULL THEN
        RAISE EXCEPTION 'evenement_uuid requis.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM evenements e WHERE e.id = p_evenement_uuid) THEN
        RAISE EXCEPTION 'Évènement introuvable : %', p_evenement_uuid;
    END IF;

    -- --- Sélection de LA compo de référence (fail-loud sur l'ambiguïté) ---
    SELECT count(*) INTO v_nb_compos
    FROM compositions c
    WHERE c.evenement_id = p_evenement_uuid
      AND c.est_active = true
      AND c.type_compo = 'match'
      AND (p_evenement_equipe_id IS NULL OR c.evenement_equipe_id = p_evenement_equipe_id);

    IF v_nb_compos = 0 THEN
        RAISE EXCEPTION 'Aucune compo active de match pour cet évènement%.',
            CASE WHEN p_evenement_equipe_id IS NOT NULL
                 THEN ' / équipe engagée ' || p_evenement_equipe_id::text ELSE '' END;
    ELSIF v_nb_compos > 1 THEN
        RAISE EXCEPTION 'Effectif ambigu : % compos actives de match. Préciser p_evenement_equipe_id.', v_nb_compos;
    END IF;

    SELECT c.id INTO v_compo_id
    FROM compositions c
    WHERE c.evenement_id = p_evenement_uuid
      AND c.est_active = true
      AND c.type_compo = 'match'
      AND (p_evenement_equipe_id IS NULL OR c.evenement_equipe_id = p_evenement_equipe_id);

    -- --- État du chrono : complet ou non (dégradation honnête) ---
    SELECT count(*) FILTER (WHERE TRUE),
           count(*) FILTER (WHERE scp.fin_at IS NULL)
      INTO v_nb_fenetres, v_nb_ouvertes
    FROM suivi_chrono_periodes scp
    WHERE scp.evenement_uuid = p_evenement_uuid;

    -- chrono complet = au moins une fenêtre ET aucune restée ouverte.
    v_chrono_ok := (v_nb_fenetres > 0 AND v_nb_ouvertes = 0);

    RETURN QUERY
    WITH
    -- 1) Effectif : les joueurs « notre » de la compo de référence.
    effectif AS (
        SELECT cj.joueur_id, cj.role, cj.numero_maillot
        FROM composition_joueurs cj
        WHERE cj.composition_id = v_compo_id
    ),
    -- 2) Bornes de match (pour titulaires sans sub, et défaut de sortie).
    bornes AS (
        SELECT min(scp.debut_at) AS match_debut,
               max(COALESCE(scp.fin_at, scp.debut_at)) AS match_fin
        FROM suivi_chrono_periodes scp
        WHERE scp.evenement_uuid = p_evenement_uuid
    ),
    -- 3) Entrée de chaque joueur :
    --    titulaire → ouverture P1 (match_debut) ; remplaçant → 1re sub où il entre.
    entrees AS (
        SELECT e.joueur_id,
               CASE
                   WHEN e.role = 'titulaire' THEN (SELECT match_debut FROM bornes)
                   ELSE (
                       SELECT min(cs.horodatage)
                       FROM chronologie_suivi cs
                       WHERE cs.evenement_uuid = p_evenement_uuid
                         AND cs.annule = false
                         AND cs.equipe_concernee = 'notre'
                         AND cs.observable_id = 'obs-A-substitution'
                         AND cs.joueur_uuid_entrant = e.joueur_id
                   )
               END AS entree_at
        FROM effectif e
    ),
    -- 4) Sortie de chaque joueur : 1er évènement parmi { sub sortant, rouge },
    --    sinon fin de match. (Blessure = observable, ne sort pas. Jaune ignoré.)
    sorties AS (
        SELECT e.joueur_id,
               LEAST(
                   COALESCE(
                       (SELECT min(cs.horodatage) FROM chronologie_suivi cs
                        WHERE cs.evenement_uuid = p_evenement_uuid
                          AND cs.annule = false AND cs.equipe_concernee = 'notre'
                          AND cs.observable_id = 'obs-A-substitution'
                          AND cs.joueur_uuid = e.joueur_id),
                       'infinity'::timestamptz),
                   COALESCE(
                       (SELECT min(cs.horodatage) FROM chronologie_suivi cs
                        WHERE cs.evenement_uuid = p_evenement_uuid
                          AND cs.annule = false AND cs.equipe_concernee = 'notre'
                          AND cs.observable_id = 'obs-A-rouge'
                          AND cs.joueur_uuid = e.joueur_id),
                       'infinity'::timestamptz)
               ) AS sortie_brute
        FROM effectif e
    ),
    presence AS (
        SELECT e.joueur_id, e.role, e.numero_maillot,
               en.entree_at,
               CASE WHEN s.sortie_brute = 'infinity'::timestamptz
                    THEN (SELECT match_fin FROM bornes)
                    ELSE s.sortie_brute END AS sortie_at
        FROM effectif e
        JOIN entrees en ON en.joueur_id = e.joueur_id
        JOIN sorties s  ON s.joueur_id  = e.joueur_id
    ),
    -- 5) Intersection présence × fenêtres de période, sommée par joueur.
    --    Secondes = Σ max(0, min(fin_fenetre, sortie) − max(debut_fenetre, entree)).
    calcul AS (
        SELECT p.joueur_id, p.role, p.numero_maillot,
               p.entree_at,
               COALESCE(SUM(
                   GREATEST(0,
                       EXTRACT(EPOCH FROM (
                           LEAST(scp.fin_at, p.sortie_at)
                           - GREATEST(scp.debut_at, p.entree_at)
                       ))
                   )
               ), 0)::INTEGER AS secondes
        FROM presence p
        LEFT JOIN suivi_chrono_periodes scp
               ON scp.evenement_uuid = p_evenement_uuid
              AND scp.fin_at IS NOT NULL          -- fenêtres clôturées seulement
              AND p.entree_at IS NOT NULL          -- joueur effectivement entré
        GROUP BY p.joueur_id, p.role, p.numero_maillot, p.entree_at
    )
    SELECT
        c.joueur_id,
        c.role,
        c.numero_maillot,
        CASE WHEN v_chrono_ok THEN ROUND(c.secondes / 60.0, 1) ELSE NULL END,
        CASE WHEN v_chrono_ok THEN c.secondes ELSE NULL END,
        (c.entree_at IS NOT NULL),
        v_chrono_ok
    FROM calcul c
    ORDER BY c.role, c.numero_maillot NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION get_temps_de_jeu_rencontre(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_temps_de_jeu_rencontre(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- Invariants fail-loud avant COMMIT.
-- ---------------------------------------------------------------------
DO $verif$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_temps_de_jeu_rencontre'
          AND p.pronargs = 2
    ) THEN
        RAISE EXCEPTION 'Invariant C12-w : get_temps_de_jeu_rencontre(UUID,UUID) absente.';
    END IF;
    RAISE NOTICE 'C12-w OK : RPC get_temps_de_jeu_rencontre en place (lecture, fail-loud).';
END;
$verif$;

COMMIT;

-- =====================================================================
-- FIN C12-w. Temps de jeu par joueur calculable honnêtement :
--   get_temps_de_jeu_rencontre(evenement_uuid [, evenement_equipe_id]).
-- Calcul = intersection [présence joueur] × [fenêtres de période C12-v],
-- jamais minute_match (non fiable pt 53). Titulaires dès P1, remplaçants
-- dès leur sub entrante, sortie = sub sortante | rouge | fin (blessure non,
-- jaune ignoré = dette TEMPS-JEU-JAUNE). Dégradation fail-loud :
-- out_chrono_complet=false + minutes NULL si chrono absent ou non clôturé.
-- Effectif = compo est_active+type_compo='match' (PAS etat). Ambiguïté
-- multi-équipes → EXCEPTION (préciser evenement_equipe_id). Lecture seule,
-- AJOUT PUR, SECURITY DEFINER garde auth.uid(). RECETTE : au prochain vrai
-- match suivi de bout en bout (chrono lancé + actions). SUIVI-COACH-7 levée.
-- =====================================================================
