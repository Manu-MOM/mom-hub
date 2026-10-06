-- =====================================================================
-- MOM Hub · C16-b · Effacement du suivi du match du 03/10/2026 (M16 Nat J2)
-- =====================================================================
-- Demande (Manu, 06/10/2026 18:42) : « effacer tout le suivi du match »
--   pour que Théo JUNG (analyse vidéo, C16-a) teste l'outil du début à la
--   fin. Choix de Manu (18:44) :
--     • actions : SUPPRESSION PHYSIQUE (pas d'annulation) ;
--     • rapport : tout effacé, avis compris ;
--     • chrono  : CONSERVÉ (durées 2×35, coup d'envoi, fin) ;
--     • code v3.84 livré avant (plus de bouton qui marque des points dans
--       « À qualifier »).
--
-- DÉROGATION TRACÉE : l'invariant « jamais de DELETE sur chronologie_suivi »
--   (annulation = annule TRUE) est levé pour CE match seulement, à la
--   demande explicite de Manu. Aucune clé étrangère ne référence
--   chronologie_suivi ni rapports (sondé le 06/10).
--
-- PÉRIMÈTRE : evenement_uuid = d5936cf6-9b5f-404a-b1df-944aa6e5294a
--   (« Nationale - Qualifications - Poule 2 - J2 - Aller », 03/10/2026).
--   État sondé le 06/10 18:4x :
--     chronologie_suivi : 151 lignes (128 live dont 104 actives,
--                         23 FFR dont 20 actives) ;
--     rapports          : 1 ligne (statut finalisé, avis vide, donnees.veo :
--                         lien, coups d'envoi, 66 repères).
--   INCHANGÉS : suivi_chrono, suivi_chrono_periodes, lien_suivi, la
--   composition, l'évènement.
--
-- EFFETS : score 0–0, rapport vierge (provisoire à la recréation), fiches
--   et stats de saison sans ce match tant qu'il n'est pas ressaisi.
--
-- RETOUR ARRIÈRE : AUCUN (suppression définitive). Faire au besoin une
--   copie avant (SELECT … FROM chronologie_suivi / rapports WHERE …).
--
-- DOCTRINE : fail-loud, en transaction ; gardes sur les volumes attendus.
--   Dry-run : remplacer le COMMIT final par ROLLBACK.
-- =====================================================================

BEGIN;

DO $c16b$
DECLARE
    v_evt  UUID := 'd5936cf6-9b5f-404a-b1df-944aa6e5294a';
    v_lib  TEXT;
    v_nl   INTEGER;
    v_nr   INTEGER;
BEGIN
    SELECT libelle INTO v_lib FROM public.evenements WHERE id = v_evt;
    IF v_lib IS NULL OR v_lib NOT ILIKE '%J2%' THEN
        RAISE EXCEPTION 'C16-b : évènement inattendu (%) — arrêt.', v_lib;
    END IF;

    DELETE FROM public.chronologie_suivi WHERE evenement_uuid = v_evt;
    GET DIAGNOSTICS v_nl = ROW_COUNT;
    IF v_nl < 140 OR v_nl > 170 THEN
        RAISE EXCEPTION 'C16-b : % lignes supprimées (≈ 151 attendues) — arrêt.', v_nl;
    END IF;

    DELETE FROM public.rapports WHERE evenement_uuid = v_evt;
    GET DIAGNOSTICS v_nr = ROW_COUNT;
    IF v_nr > 1 THEN
        RAISE EXCEPTION 'C16-b : % rapports supprimés (1 attendu) — arrêt.', v_nr;
    END IF;

    RAISE NOTICE 'C16-b : % actions et % rapport supprimés (%).', v_nl, v_nr, v_lib;
END
$c16b$;

DO $verif$
DECLARE
    v_evt  UUID := 'd5936cf6-9b5f-404a-b1df-944aa6e5294a';
BEGIN
    IF EXISTS (SELECT 1 FROM public.chronologie_suivi WHERE evenement_uuid = v_evt) THEN
        RAISE EXCEPTION 'C16-b : des actions subsistent.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.rapports WHERE evenement_uuid = v_evt) THEN
        RAISE EXCEPTION 'C16-b : le rapport subsiste.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.suivi_chrono WHERE evenement_uuid = v_evt) THEN
        RAISE EXCEPTION 'C16-b : le chrono a disparu.';
    END IF;
    RAISE NOTICE 'C16-b OK : suivi et rapport vides, chrono conservé.';
END
$verif$;

COMMIT;
