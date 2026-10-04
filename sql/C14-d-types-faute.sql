-- =====================================================================
-- MOM Hub · C14-d · Pioche des types de faute par catégorie
-- =====================================================================
-- Chantier : SUIVI-VEO, avenant « Faute » (04/10/2026). Décisions de Manu
--   (« je suis tes recos », 15:49) : F1-A faute = fait DATÉ de la palette
--   (section Discipline), compté au rapport ; F2-A équipe fautive + type +
--   joueur facultatif (nous) + minute, sans sanction ; F3 pioche proposée
--   (12 types) ; F4-A pioche modifiable dans le Hub par catégorie.
--
-- MODÈLE (calque exact de C14-a observables_froid, table distincte pour ne
--   pas toucher aux RPC déjà en recette) :
--   • table types_faute (id, categorie_id, libelle, ordre, actif) ;
--     retirer = actif=false, jamais DELETE.
--   • une faute saisie = 1 ligne chronologie_suivi avec
--     observable_id = 'obs-A-faute-' || types_faute.id (TEXT libre, aucune
--     contrainte, sonde S3 du 04/10) → renommer un type ne casse rien.
--
-- SÉCURITÉ : RLS active sans policy ; lister = authentifié ; enregistrer =
--   admin | bureau | puis_je_ecrire_categorie(cat).
--
-- AMORÇAGE : chaque catégorie de la correspondance C14-a encore vide reçoit
--   les 12 types. Idempotent.
-- DOCTRINE : ajout pur. Idempotent, fail-loud, en transaction.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.types_faute (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    categorie_id UUID        NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
    libelle      TEXT        NOT NULL,
    ordre        INTEGER     NOT NULL DEFAULT 0,
    actif        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT types_faute_libelle_check
        CHECK (char_length(btrim(libelle)) BETWEEN 1 AND 120)
);

COMMENT ON TABLE public.types_faute IS
    'Pioche des types de faute par catégorie (SUIVI-VEO avenant Faute, C14-d). Faute saisie = chronologie_suivi.observable_id ''obs-A-faute-<id>''. Retirer = actif=false.';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_types_faute_actif_libelle
    ON public.types_faute (categorie_id, lower(btrim(libelle)))
    WHERE actif;

CREATE INDEX IF NOT EXISTS idx_types_faute_categorie
    ON public.types_faute (categorie_id, ordre);

ALTER TABLE public.types_faute ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.types_faute FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.lister_types_faute(
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
        FROM public.types_faute AS t
        WHERE t.categorie_id = p_categorie_id
          AND (p_inclure_inactifs OR t.actif)
        ORDER BY t.actif DESC, t.ordre, t.libelle;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_types_faute(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lister_types_faute(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.enregistrer_type_faute(
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
        FROM public.types_faute AS t
        WHERE t.categorie_id = p_categorie_id;
        INSERT INTO public.types_faute (categorie_id, libelle, ordre, actif)
        VALUES (p_categorie_id, v_libelle, coalesce(p_ordre, v_ordre), coalesce(p_actif, TRUE))
        RETURNING types_faute.id INTO v_id;
    ELSE
        UPDATE public.types_faute AS t
           SET libelle    = v_libelle,
               ordre      = coalesce(p_ordre, t.ordre),
               actif      = coalesce(p_actif, t.actif),
               updated_at = now()
         WHERE t.id = p_id
           AND t.categorie_id = p_categorie_id
        RETURNING t.id INTO v_id;
        IF v_id IS NULL THEN
            RAISE EXCEPTION 'Type de faute introuvable dans cette catégorie.';
        END IF;
    END IF;

    RETURN QUERY
        SELECT t.id, t.categorie_id, t.libelle, t.ordre, t.actif
        FROM public.types_faute AS t
        WHERE t.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_type_faute(UUID, TEXT, UUID, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enregistrer_type_faute(UUID, TEXT, UUID, INTEGER, BOOLEAN) TO authenticated;

WITH source (rang, libelle) AS (
    VALUES
        (1, 'Hors-jeu'),
        (2, 'Plaqueur ne relâche pas le plaqué'),
        (3, 'Plaqué ne libère pas le ballon'),
        (4, 'Mains au sol dans le ruck'),
        (5, 'Entrée sur le côté'),
        (6, 'Plaquage haut / dangereux'),
        (7, 'Obstruction / plaquage sans ballon'),
        (8, 'Écroulement (mêlée ou maul)'),
        (9, 'En-avant'),
        (10, 'Passe en avant'),
        (11, 'Retard au jeu / anti-jeu'),
        (12, 'Contestation / indiscipline')
),

cibles (code) AS (
    VALUES ('M6'), ('M8'), ('M10'), ('M12'), ('M14'), ('F15'),
           ('M16'), ('M19'), ('F18'), ('SR-M'), ('SR-F')
)

INSERT INTO public.types_faute (categorie_id, libelle, ordre, actif)
SELECT c.id, s.libelle, s.rang * 10, TRUE
FROM public.categories AS c
INNER JOIN cibles AS k ON c.code = k.code
CROSS JOIN source AS s
WHERE NOT EXISTS (
    SELECT 1 FROM public.types_faute AS t
    WHERE t.categorie_id = c.id
);

DO $verif$
DECLARE
    v_nb_m16 INTEGER;
    v_rls    BOOLEAN;
    v_fn     INTEGER;
BEGIN
    SELECT count(*) INTO v_nb_m16
    FROM public.types_faute AS t
    INNER JOIN public.categories AS c ON t.categorie_id = c.id
    WHERE c.code = 'M16' AND t.actif;
    SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid = 'public.types_faute'::REGCLASS;
    SELECT count(*) INTO v_fn FROM pg_proc
    WHERE proname IN ('lister_types_faute', 'enregistrer_type_faute');
    IF v_nb_m16 < 1 THEN RAISE EXCEPTION 'C14-d : aucun type de faute M16.'; END IF;
    IF NOT v_rls THEN RAISE EXCEPTION 'C14-d : RLS non activée.'; END IF;
    IF v_fn <> 2 THEN RAISE EXCEPTION 'C14-d : % fonction(s) au lieu de 2.', v_fn; END IF;
    RAISE NOTICE 'C14-d OK : % types M16 actifs, RLS active, 2 RPC.', v_nb_m16;
END
$verif$;

COMMIT;
