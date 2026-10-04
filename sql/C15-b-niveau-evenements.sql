-- =====================================================================
-- MOM Hub · C15-b · Niveau (équipe engagée) des matchs pour les stats
-- =====================================================================
-- Chantier : STATS-SAISON, avenant « Retour + niveaux » (FAIT FOI
--   Conception-SUIVI-VEO-v1 §5 octies ; décisions de Manu le 04/10 à
--   20:52 : R1-A, N1-A, N2-A, N3-A, N4-A).
--
-- BESOIN : distinguer dans les statistiques les matchs de Nationale et de
--   Régionale (un joueur peut jouer aux deux niveaux ; les performances ne
--   s'additionnent pas). Le niveau = l'ÉQUIPE ENGAGÉE de la feuille de
--   match (aucune saisie nouvelle).
--
-- CE SCRIPT :
--   (1) RPC neuve niveau_evenements_stats(p_ids) : pour chaque match, équipe
--       engagée côté MOM résolue par la feuille de match (active, cote mom) :
--       evenement_equipe_id de la compo de match, sinon celui de sa feuille
--       de base d'origine, sinon celui d'une feuille de base du même
--       évènement. Authentifié, SECURITY DEFINER, métadonnées non sensibles.
--   (2) Correction de données (N2-A) de l'équipe ENTENTE-M16-2026-2027-E2 :
--       libelle_court « M16 - Nat » → « M16 - Reg » ; championnat_nom
--       « Régional 3 U16 » → « Régional 2 U16 » (matchs « Régionale 2 »).
--       Garde : seulement si les anciennes valeurs sont encore en place.
--
-- RETOUR ARRIÈRE (2) :
--   UPDATE equipes SET libelle_court = 'M16 - Nat', championnat_nom = 'Régional 3 U16'
--   WHERE code = 'ENTENTE-M16-2026-2027-E2';
--
-- DOCTRINE : ajout pur (1 RPC) + correction ciblée. Fail-loud, en
--   transaction. Dry-run : COMMIT → ROLLBACK.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.niveau_evenements_stats(
    p_ids UUID []
) RETURNS TABLE (
    evenement_id    UUID,
    equipe_id       UUID,
    equipe_code     TEXT,
    equipe_libelle  TEXT,
    championnat_nom TEXT,
    numero_equipe   INTEGER
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
        WITH m AS (
            SELECT DISTINCT ON (cm.evenement_id)
                   cm.evenement_id AS evt,
                   coalesce(cm.evenement_equipe_id, cb.evenement_equipe_id,
                            (SELECT cb2.evenement_equipe_id
                             FROM public.compositions AS cb2
                             WHERE cb2.evenement_id = cm.evenement_id
                               AND cb2.type_compo = 'base'
                               AND cb2.cote = 'mom'
                               AND cb2.est_active
                               AND cb2.evenement_equipe_id IS NOT NULL
                             LIMIT 1)) AS eee
            FROM public.compositions AS cm
            LEFT JOIN public.compositions AS cb ON cb.id = cm.compo_base_origine_id
            WHERE cm.evenement_id = ANY (p_ids)
              AND cm.type_compo = 'match'
              AND cm.cote = 'mom'
              AND cm.est_active
            ORDER BY cm.evenement_id, cm.updated_at DESC NULLS LAST
        )
        SELECT m.evt, eq.id, eq.code::TEXT,
               coalesce(eq.libelle_court, eq.libelle_moyen, eq.nom_officiel)::TEXT,
               eq.championnat_nom::TEXT, eq.numero_equipe
        FROM m
        LEFT JOIN public.evenement_equipes_engagees AS ee ON ee.id = m.eee
        LEFT JOIN public.equipes AS eq ON eq.id = ee.equipe_id;
END;
$$;

REVOKE ALL ON FUNCTION public.niveau_evenements_stats(UUID []) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.niveau_evenements_stats(UUID []) TO authenticated;

DO $correction$
DECLARE
    v_nb INTEGER;
BEGIN
    UPDATE public.equipes
       SET libelle_court = 'M16 - Reg',
           championnat_nom = 'Régional 2 U16',
           updated_at = now()
     WHERE code = 'ENTENTE-M16-2026-2027-E2'
       AND libelle_court = 'M16 - Nat'
       AND championnat_nom = 'Régional 3 U16';
    GET DIAGNOSTICS v_nb = ROW_COUNT;
    IF v_nb > 1 THEN
        RAISE EXCEPTION 'C15-b : % équipes corrigées (1 attendue) — arrêt.', v_nb;
    END IF;
    RAISE NOTICE 'C15-b : % équipe corrigée (0 = déjà corrigée).', v_nb;
END
$correction$;

DO $verif$
DECLARE
    v_lib TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'niveau_evenements_stats') THEN
        RAISE EXCEPTION 'C15-b : RPC absente.';
    END IF;
    SELECT libelle_court INTO v_lib FROM public.equipes WHERE code = 'ENTENTE-M16-2026-2027-E2';
    IF v_lib IS DISTINCT FROM 'M16 - Reg' THEN
        RAISE EXCEPTION 'C15-b : libellé E2 = % (« M16 - Reg » attendu).', v_lib;
    END IF;
    RAISE NOTICE 'C15-b OK : RPC en place, E2 = %.', v_lib;
END
$verif$;

COMMIT;
