-- =====================================================================
-- MOM Hub · C18-a · Actions marquantes : ajouts par catégorie
-- =====================================================================
-- Chantier : SUIVI-THEO (FAIT FOI Conception-SUIVI-THEO-v1, gelée par Manu
--   le 12/10/2026 à 10:55), lot L2, décision D3-A+B :
--   • socle FIXE de 12 actions dans data/observables-match.json (famille
--     actions_marquantes, identifiants obs-A-marq-<code>) ;
--   • AJOUTS par catégorie, modifiables dans le Hub : CE SCRIPT.
--
-- MODÈLE (calque exact de C14-d types_faute) :
--   • table types_action_marquante (id, categorie_id, libelle, ordre, actif) ;
--     retirer = actif=false, jamais DELETE ;
--   • une action ajoutée saisie = 1 ligne chronologie_suivi avec
--     observable_id = 'obs-A-marq-' || types_action_marquante.id.
--
-- SÉCURITÉ : RLS active sans policy ; lister = authentifié ; enregistrer =
--   admin | bureau | puis_je_ecrire_categorie(cat). EXECUTE retiré à anon
--   (dette DROITS-ANON-RPC non reproduite).
--
-- AMORÇAGE : aucun (les ajouts sont faits par les catégories).
-- DOCTRINE : ajout pur (1 table + 2 RPC neuves). Idempotent, fail-loud, en
--   transaction. Dry-run : COMMIT → ROLLBACK.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.types_action_marquante (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    categorie_id UUID        NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
    libelle      TEXT        NOT NULL,
    ordre        INTEGER     NOT NULL DEFAULT 0,
    actif        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT types_action_marquante_libelle_check
        CHECK (char_length(btrim(libelle)) BETWEEN 1 AND 120)
);

COMMENT ON TABLE public.types_action_marquante IS
    'Actions marquantes AJOUTÉES par catégorie (SUIVI-THEO D3-B, C18-a), en complément du socle fixe du référentiel. Action saisie = chronologie_suivi.observable_id ''obs-A-marq-<id>''. Retirer = actif=false.';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_types_action_marquante_actif_libelle
    ON public.types_action_marquante (categorie_id, lower(btrim(libelle)))
    WHERE actif;

CREATE INDEX IF NOT EXISTS idx_types_action_marquante_categorie
    ON public.types_action_marquante (categorie_id, ordre);

ALTER TABLE public.types_action_marquante ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.types_action_marquante FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.lister_types_action_marquante(
    p_categorie_id      UUID,
    p_inclure_inactifs  BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    id           UUID,
    categorie_id UUID,
    libelle      TEXT,
    ordre        INTEGER,
    actif        BOOLEAN
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
        SELECT t.id, t.categorie_id, t.libelle, t.ordre, t.actif
        FROM public.types_action_marquante AS t
        WHERE t.categorie_id = p_categorie_id
          AND (p_inclure_inactifs OR t.actif)
        ORDER BY t.actif DESC, t.ordre, t.libelle;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_types_action_marquante(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_types_action_marquante(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.enregistrer_type_action_marquante(
    p_categorie_id UUID,
    p_libelle      TEXT,
    p_id           UUID    DEFAULT NULL,
    p_ordre        INTEGER DEFAULT NULL,
    p_actif        BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
    id           UUID,
    categorie_id UUID,
    libelle      TEXT,
    ordre        INTEGER,
    actif        BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_libelle TEXT := btrim(coalesce(p_libelle, ''));
    v_id      UUID;
    v_ordre   INTEGER;
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
    IF char_length(v_libelle) NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'Libellé requis (120 caractères maximum).';
    END IF;

    IF p_id IS NULL THEN
        SELECT coalesce(max(t.ordre), 0) + 10 INTO v_ordre
        FROM public.types_action_marquante AS t
        WHERE t.categorie_id = p_categorie_id;
        INSERT INTO public.types_action_marquante (categorie_id, libelle, ordre, actif)
        VALUES (p_categorie_id, v_libelle, coalesce(p_ordre, v_ordre), coalesce(p_actif, TRUE))
        RETURNING types_action_marquante.id INTO v_id;
    ELSE
        UPDATE public.types_action_marquante AS t
           SET libelle    = v_libelle,
               ordre      = coalesce(p_ordre, t.ordre),
               actif      = coalesce(p_actif, t.actif),
               updated_at = now()
         WHERE t.id = p_id
           AND t.categorie_id = p_categorie_id
        RETURNING t.id INTO v_id;
        IF v_id IS NULL THEN
            RAISE EXCEPTION 'Action marquante introuvable dans cette catégorie.';
        END IF;
    END IF;

    RETURN QUERY
        SELECT t.id, t.categorie_id, t.libelle, t.ordre, t.actif
        FROM public.types_action_marquante AS t
        WHERE t.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_type_action_marquante(UUID, TEXT, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_type_action_marquante(UUID, TEXT, UUID, INTEGER, BOOLEAN) TO authenticated;

DO $verif$
DECLARE
    v_nb INTEGER;
BEGIN
    IF to_regclass('public.types_action_marquante') IS NULL THEN
        RAISE EXCEPTION 'C18-a : table absente.';
    END IF;
    SELECT count(*) INTO v_nb FROM pg_proc
    WHERE proname IN ('lister_types_action_marquante', 'enregistrer_type_action_marquante');
    IF v_nb <> 2 THEN
        RAISE EXCEPTION 'C18-a : % RPC sur 2.', v_nb;
    END IF;
    RAISE NOTICE 'C18-a OK : table types_action_marquante + 2 RPC.';
END
$verif$;

COMMIT;
