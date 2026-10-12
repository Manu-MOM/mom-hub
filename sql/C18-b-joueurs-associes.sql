-- =====================================================================
-- MOM Hub · C18-b · Plusieurs joueurs sur une action (fautes)
-- =====================================================================
-- Chantier : SUIVI-THEO (FAIT FOI Conception-SUIVI-THEO-v1, gelée par Manu
--   le 12/10/2026 à 10:55), lot L3, décision D2-A : une faute reste UNE
--   action pour l'équipe, avec 1 à n joueurs rattachés ; chaque joueur se
--   voit compter la faute dans sa fiche.
--
-- MODÈLE (zéro réécriture des RPC existantes — choix technique tracé) :
--   • colonne chronologie_suivi.joueurs_associes UUID[] (défaut '{}') =
--     joueurs EN PLUS du joueur principal (joueur_uuid) ;
--   • definir_joueurs_associes(evt, ligne, joueurs[]) : pose la liste
--     (doublons, NULL et joueur principal retirés) ; garde auth.uid() +
--     rencontre ouverte + ligne de la rencontre (calque annuler_observable_
--     coach) ;
--   • lister_joueurs_associes(evt) : (ligne_id, joueurs[]) des lignes qui
--     en ont, annulées comprises (le front filtre).
--   get_chronologie_rencontre_coach / inserer_observable_coach INCHANGÉES
--   (pas de DROP + CREATE d'un type de retour utilisé partout).
--
-- SÉCURITÉ : EXECUTE pour authenticated seulement (PUBLIC et anon retirés).
-- RETOUR ARRIÈRE : DROP FUNCTION des 2 RPC ; ALTER TABLE … DROP COLUMN
--   joueurs_associes (données perdues).
-- DOCTRINE : ajout pur. Idempotent, fail-loud, en transaction. Dry-run :
--   COMMIT → ROLLBACK.
-- =====================================================================

BEGIN;

ALTER TABLE public.chronologie_suivi
    ADD COLUMN IF NOT EXISTS joueurs_associes UUID [] NOT NULL DEFAULT '{}'::UUID [];

COMMENT ON COLUMN public.chronologie_suivi.joueurs_associes IS
    'Joueurs rattachés EN PLUS de joueur_uuid (ex. hors-jeu collectif). SUIVI-THEO D2-A, C18-b.';

CREATE OR REPLACE FUNCTION public.definir_joueurs_associes(
    p_evenement_uuid UUID,
    p_ligne_id       UUID,
    p_joueurs        UUID []
) RETURNS UUID []
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_principal UUID;
    v_liste     UUID [];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    IF NOT chronologie_rencontre_ouverte(p_evenement_uuid) THEN
        RAISE EXCEPTION 'Rencontre clôturée/archivée : modification impossible.';
    END IF;
    SELECT cs.joueur_uuid INTO v_principal
    FROM chronologie_suivi AS cs
    WHERE cs.id = p_ligne_id AND cs.evenement_uuid = p_evenement_uuid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ligne introuvable pour cette rencontre.';
    END IF;
    SELECT coalesce(array_agg(DISTINCT j), '{}'::UUID [])
      INTO v_liste
    FROM unnest(coalesce(p_joueurs, '{}'::UUID [])) AS u (j)
    WHERE j IS NOT NULL AND j IS DISTINCT FROM v_principal;
    UPDATE chronologie_suivi
       SET joueurs_associes = v_liste
     WHERE id = p_ligne_id AND evenement_uuid = p_evenement_uuid;
    RETURN v_liste;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_joueurs_associes(UUID, UUID, UUID []) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_joueurs_associes(UUID, UUID, UUID []) TO authenticated;

CREATE OR REPLACE FUNCTION public.lister_joueurs_associes(
    p_evenement_uuid UUID
) RETURNS TABLE (
    ligne_id UUID,
    joueurs  UUID []
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    RETURN QUERY
        SELECT cs.id, cs.joueurs_associes
        FROM chronologie_suivi AS cs
        WHERE cs.evenement_uuid = p_evenement_uuid
          AND cardinality(cs.joueurs_associes) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_joueurs_associes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_joueurs_associes(UUID) TO authenticated;

DO $verif$
DECLARE
    v_nb INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'chronologie_suivi'
                     AND column_name = 'joueurs_associes') THEN
        RAISE EXCEPTION 'C18-b : colonne absente.';
    END IF;
    SELECT count(*) INTO v_nb FROM pg_proc
    WHERE proname IN ('definir_joueurs_associes', 'lister_joueurs_associes');
    IF v_nb <> 2 THEN
        RAISE EXCEPTION 'C18-b : % RPC sur 2.', v_nb;
    END IF;
    RAISE NOTICE 'C18-b OK : colonne joueurs_associes + 2 RPC.';
END
$verif$;

COMMIT;
