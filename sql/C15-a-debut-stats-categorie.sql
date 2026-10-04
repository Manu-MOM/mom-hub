-- =====================================================================
-- MOM Hub · C15-a · Date de départ des statistiques par catégorie
-- =====================================================================
-- Chantier : STATS-SAISON (avenant « Stats de saison », FAIT FOI
--   Conception-SUIVI-VEO-v1 §5 septies ; décisions de Manu le 04/10 à
--   20:26 : S1-A à S5-A).
--
-- BESOIN : les statistiques de saison ne comptent que les matchs de la
--   saison active joués À PARTIR d'une date de départ propre à chaque
--   catégorie (M16 2026/2027 : 03/10/2026, présaison exclue). Sans date
--   réglée : début de la saison (saisons.date_debut).
--
-- MODÈLE :
--   • table stats_debut_categorie (saison_id, categorie_id, date_debut).
--   • lister_debut_stats(p_saison_id)          : authentifié.
--   • enregistrer_debut_stats(cat, date, saison) : admin | bureau |
--     puis_je_ecrire_categorie(cat) ; date NULL = retour au début de saison.
--   • meta_evenements_stats(p_ids)             : authentifié ; pour chaque
--     évènement : date (locale Europe/Paris) et catégorie EFFECTIVES (repli
--     parent puis grand-parent), libellé, adversaire, date de départ
--     applicable et dans_stats (saison active ET date ≥ départ ET ≤ fin).
--     Règle centralisée ici : le front ne recalcule rien.
--
-- SÉCURITÉ : RLS activée sans policy (aucun accès direct client) ; RPC
--   SECURITY DEFINER, garde auth.uid(). Métadonnées non sensibles.
--
-- AMORÇAGE : M16, saison active → 2026-10-03 (demande de Manu).
--
-- DOCTRINE : AJOUT PUR (table + 3 RPC neuves). Idempotent, fail-loud, en
--   transaction. Dry-run : remplacer le COMMIT final par ROLLBACK.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stats_debut_categorie (
    saison_id    UUID        NOT NULL REFERENCES public.saisons (id) ON DELETE CASCADE,
    categorie_id UUID        NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
    date_debut   DATE        NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID,
    PRIMARY KEY (saison_id, categorie_id)
);

COMMENT ON TABLE public.stats_debut_categorie IS
    'Date de départ des statistiques de saison par catégorie (C15-a). Absente = saisons.date_debut.';

ALTER TABLE public.stats_debut_categorie ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stats_debut_categorie FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Lecture des réglages (toutes catégories) pour une saison
--    p_saison_id NULL → saison active.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lister_debut_stats(
    p_saison_id UUID DEFAULT NULL
) RETURNS TABLE (
    saison_id        UUID,
    saison_code      TEXT,
    saison_debut     DATE,
    saison_fin       DATE,
    categorie_id     UUID,
    categorie_code   TEXT,
    date_reglee      DATE,
    date_effective   DATE
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
        SELECT s.id, s.code::TEXT, s.date_debut, s.date_fin,
               c.id, c.code::TEXT, d.date_debut,
               coalesce(d.date_debut, s.date_debut)
        FROM public.saisons AS s
        CROSS JOIN public.categories AS c
        LEFT JOIN public.stats_debut_categorie AS d
               ON d.saison_id = s.id AND d.categorie_id = c.id
        WHERE s.id = coalesce(p_saison_id,
                              (SELECT s2.id FROM public.saisons AS s2 WHERE s2.est_active LIMIT 1))
        ORDER BY c.ordre_tri NULLS LAST, c.code;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_debut_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lister_debut_stats(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Écriture : date de départ d'une catégorie (NULL = début de saison)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_debut_stats(
    p_categorie_id UUID,
    p_date         DATE,
    p_saison_id    UUID DEFAULT NULL
) RETURNS TABLE (
    categorie_id   UUID,
    date_reglee    DATE,
    date_effective DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_saison public.saisons%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    IF p_categorie_id IS NULL THEN
        RAISE EXCEPTION 'Catégorie requise.';
    END IF;
    IF NOT (has_role('admin') OR has_role('bureau') OR puis_je_ecrire_categorie(p_categorie_id)) THEN
        RAISE EXCEPTION 'Droits insuffisants sur cette catégorie.';
    END IF;
    SELECT * INTO v_saison FROM public.saisons AS s
    WHERE s.id = coalesce(p_saison_id,
                          (SELECT s2.id FROM public.saisons AS s2 WHERE s2.est_active LIMIT 1));
    IF v_saison.id IS NULL THEN
        RAISE EXCEPTION 'Saison introuvable.';
    END IF;

    IF p_date IS NULL THEN
        DELETE FROM public.stats_debut_categorie AS d
        WHERE d.saison_id = v_saison.id AND d.categorie_id = p_categorie_id;
    ELSE
        IF p_date < v_saison.date_debut OR p_date > v_saison.date_fin THEN
            RAISE EXCEPTION 'La date doit être comprise dans la saison (% → %).',
                v_saison.date_debut, v_saison.date_fin;
        END IF;
        INSERT INTO public.stats_debut_categorie (saison_id, categorie_id, date_debut, updated_by)
        VALUES (v_saison.id, p_categorie_id, p_date, auth.uid())
        ON CONFLICT ON CONSTRAINT stats_debut_categorie_pkey
        DO UPDATE SET date_debut = excluded.date_debut,
                      updated_at = now(),
                      updated_by = excluded.updated_by;
    END IF;

    RETURN QUERY
        SELECT p_categorie_id, d.date_debut, coalesce(d.date_debut, v_saison.date_debut)
        FROM (SELECT 1) AS un
        LEFT JOIN public.stats_debut_categorie AS d
               ON d.saison_id = v_saison.id AND d.categorie_id = p_categorie_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_debut_stats(UUID, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enregistrer_debut_stats(UUID, DATE, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Métadonnées « stats » d'une liste d'évènements (règle centralisée)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.meta_evenements_stats(
    p_ids UUID []
) RETURNS TABLE (
    evenement_id   UUID,
    date_match     DATE,
    categorie_id   UUID,
    categorie_code TEXT,
    libelle        TEXT,
    adversaire_nom TEXT,
    date_depart    DATE,
    dans_stats     BOOLEAN
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
        WITH saison AS (
            SELECT s.id, s.date_debut, s.date_fin
            FROM public.saisons AS s
            WHERE s.est_active
            LIMIT 1
        ),
        ev AS (
            SELECT e.id,
                   (coalesce(e.date_debut, p.date_debut, gp.date_debut)
                        AT TIME ZONE 'Europe/Paris')::DATE AS d,
                   coalesce(e.categorie_id, p.categorie_id, gp.categorie_id) AS cat,
                   e.libelle::TEXT AS lib,
                   e.adversaire_nom::TEXT AS adv
            FROM public.evenements AS e
            LEFT JOIN public.evenements AS p ON p.id = e.evenement_parent_id
            LEFT JOIN public.evenements AS gp ON gp.id = p.evenement_parent_id
            WHERE e.id = ANY (p_ids)
        )
        SELECT ev.id, ev.d, ev.cat, c.code::TEXT, ev.lib, ev.adv,
               coalesce(dsc.date_debut, saison.date_debut),
               coalesce(ev.d >= coalesce(dsc.date_debut, saison.date_debut)
                        AND ev.d <= saison.date_fin, FALSE)
        FROM ev
        CROSS JOIN saison
        LEFT JOIN public.categories AS c ON c.id = ev.cat
        LEFT JOIN public.stats_debut_categorie AS dsc
               ON dsc.saison_id = saison.id AND dsc.categorie_id = ev.cat;
END;
$$;

REVOKE ALL ON FUNCTION public.meta_evenements_stats(UUID []) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_evenements_stats(UUID []) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Amorçage : M16, saison active → 03/10/2026 (idempotent)
-- ---------------------------------------------------------------------
INSERT INTO public.stats_debut_categorie (saison_id, categorie_id, date_debut)
SELECT s.id, c.id, DATE '2026-10-03'
FROM public.saisons AS s
CROSS JOIN public.categories AS c
WHERE s.est_active
  AND c.code = 'M16'
ON CONFLICT ON CONSTRAINT stats_debut_categorie_pkey DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Vérification (fail-loud)
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_nb    INTEGER;
    v_m16   DATE;
BEGIN
    SELECT count(*) INTO v_nb FROM pg_proc
    WHERE proname IN ('lister_debut_stats', 'enregistrer_debut_stats', 'meta_evenements_stats');
    IF v_nb <> 3 THEN
        RAISE EXCEPTION 'C15-a : % RPC sur 3.', v_nb;
    END IF;
    SELECT d.date_debut INTO v_m16
    FROM public.stats_debut_categorie AS d
    JOIN public.saisons AS s ON s.id = d.saison_id AND s.est_active
    JOIN public.categories AS c ON c.id = d.categorie_id AND c.code = 'M16';
    IF v_m16 IS DISTINCT FROM DATE '2026-10-03' THEN
        RAISE EXCEPTION 'C15-a : départ M16 = % (2026-10-03 attendu).', v_m16;
    END IF;
    RAISE NOTICE 'C15-a OK : table, 3 RPC, départ M16 au %.', v_m16;
END
$verif$;

COMMIT;
