-- =====================================================================
-- MOM Hub · C14-e · En-avant et passe en avant sortis des fautes
-- =====================================================================
-- Chantier : SUIVI-VEO, avenant « En-avant » (FAIT FOI
--   Conception-SUIVI-VEO-v1 §5 quater ; décisions de Manu le 04/10 à
--   18:53 : E1-B, E2-A, E3-A, E4-A).
--
-- BESOIN (retour terrain) : l'en-avant et la passe en avant ne sont pas des
--   fautes (sanction : mêlée, pas pénalité). Ils deviennent des observables
--   du référentiel (data/observables-match.json v1.2.2, famille
--   faute_technique) : 'obs-A-en-avant' et 'obs-A-passe-avant', comptés à
--   part au rapport.
--
-- CE SCRIPT (données seulement, aucun DDL) :
--   (1) reprend les lignes déjà saisies avec la pioche :
--         'obs-A-faute-<id « En-avant »>'       → 'obs-A-en-avant'
--         'obs-A-faute-<id « Passe en avant »>' → 'obs-A-passe-avant'
--       (lignes annulées comprises : l'historique reste cohérent ; minute,
--       équipe, joueur, saisi_par, horodatage, annule : INCHANGÉS ; points
--       déjà à 0 → score inchangé).
--   (2) désactive ces 2 types dans la pioche des 11 catégories (actif =
--       false, jamais de DELETE).
--
-- ÉTAT ATTENDU (sonde du 04/10, 18:5x) : 22 types visés (11 × 2) ; 22
--   lignes à reprendre, toutes « En-avant » M16 sur le match du 03/10
--   (d5936cf6…), dont 17 actives ; 0 « Passe en avant ».
--
-- RETOUR ARRIÈRE (si besoin, M16 seule concernée à ce jour) :
--   UPDATE chronologie_suivi SET observable_id =
--     'obs-A-faute-75500985-93db-4cfc-9bd8-d38061634abe'
--   WHERE observable_id = 'obs-A-en-avant'
--     AND evenement_uuid = 'd5936cf6-9b5f-404a-b1df-944aa6e5294a';
--   UPDATE types_faute SET actif = true
--   WHERE libelle IN ('En-avant', 'Passe en avant');
--
-- DOCTRINE : fail-loud, en transaction. Dry-run : COMMIT → ROLLBACK.
-- =====================================================================

BEGIN;

DO $reprise$
DECLARE
    v_types   INTEGER;
    v_lignes  INTEGER;
    v_maj     INTEGER;
BEGIN
    SELECT count(*) INTO v_types
    FROM public.types_faute
    WHERE libelle IN ('En-avant', 'Passe en avant');
    IF v_types <> 22 THEN
        RAISE EXCEPTION 'C14-e : % types visés (22 attendus) — arrêt.', v_types;
    END IF;

    SELECT count(*) INTO v_lignes
    FROM public.chronologie_suivi AS cs
    JOIN public.types_faute AS t
      ON cs.observable_id = 'obs-A-faute-' || t.id::TEXT
    WHERE t.libelle IN ('En-avant', 'Passe en avant');

    UPDATE public.chronologie_suivi AS cs
       SET observable_id = CASE t.libelle
                             WHEN 'En-avant' THEN 'obs-A-en-avant'
                             ELSE 'obs-A-passe-avant'
                           END
      FROM public.types_faute AS t
     WHERE cs.observable_id = 'obs-A-faute-' || t.id::TEXT
       AND t.libelle IN ('En-avant', 'Passe en avant');
    GET DIAGNOSTICS v_maj = ROW_COUNT;
    IF v_maj <> v_lignes THEN
        RAISE EXCEPTION 'C14-e : % lignes reprises sur % visées — arrêt.', v_maj, v_lignes;
    END IF;

    UPDATE public.types_faute
       SET actif = false, updated_at = now()
     WHERE libelle IN ('En-avant', 'Passe en avant');

    RAISE NOTICE 'C14-e : % lignes reprises, % types désactivés.', v_maj, v_types;
END
$reprise$;

DO $verif$
DECLARE
    v_reste   INTEGER;
    v_actifs  INTEGER;
    v_ea      INTEGER;
    v_ea_act  INTEGER;
BEGIN
    SELECT count(*) INTO v_reste
    FROM public.chronologie_suivi AS cs
    JOIN public.types_faute AS t
      ON cs.observable_id = 'obs-A-faute-' || t.id::TEXT
    WHERE t.libelle IN ('En-avant', 'Passe en avant');
    IF v_reste <> 0 THEN
        RAISE EXCEPTION 'C14-e : % lignes encore rangées en faute.', v_reste;
    END IF;

    SELECT count(*) INTO v_actifs
    FROM public.types_faute
    WHERE libelle IN ('En-avant', 'Passe en avant') AND actif;
    IF v_actifs <> 0 THEN
        RAISE EXCEPTION 'C14-e : % types encore actifs dans la pioche.', v_actifs;
    END IF;

    SELECT count(*), count(*) FILTER (WHERE NOT annule) INTO v_ea, v_ea_act
    FROM public.chronologie_suivi
    WHERE observable_id IN ('obs-A-en-avant', 'obs-A-passe-avant');
    RAISE NOTICE 'C14-e OK : % lignes en-avant / passe en avant (% actives) ; pioche nettoyée.', v_ea, v_ea_act;
END
$verif$;

COMMIT;
