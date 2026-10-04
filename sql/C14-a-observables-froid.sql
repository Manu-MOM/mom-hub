-- =====================================================================
-- MOM Hub · C14-a · Observables « à froid » par catégorie
-- =====================================================================
-- Chantier : SUIVI-VEO, lot L3 (FAIT FOI Conception-SUIVI-VEO-v1, gelé
--   le 04/10/2026, décision D1-A).
--
-- BESOIN (Manu, 04/10) : chaque observable « à froid » ouvre une note
--   libre ; la LISTE des observables est modifiable DANS LE HUB,
--   catégorie par catégorie (aujourd'hui figée dans
--   data/observables-match.json, tranche devinée sur le nom d'équipe).
--
-- MODÈLE :
--   • table observables_froid (id, categorie_id, libelle, ordre, actif).
--   • jamais de DELETE : retirer = actif=false (les notes déjà écrites
--     gardent leur libellé, la clé reste valable).
--   • les NOTES ne vivent PAS ici : rapports.donnees du match
--     (D2-A, zéro DDL) → { "notes_froid": { "<id>": "texte" } }.
--
-- SÉCURITÉ (patron voie coach / B5) :
--   • RLS activée, AUCUNE policy → aucun accès direct client.
--   • lister  : authentifié (libellés non sensibles).
--   • enregistrer : admin | bureau | puis_je_ecrire_categorie(cat)
--     (helpers déployés, corps sondés le 04/10).
--
-- AMORÇAGE : chaque catégorie SANS ligne reçoit la liste actuelle du
--   référentiel JSON (categorie_B_pre_suggestions v1.2.1) selon la
--   correspondance : M6/M8/M10/M12 → EDR ; M14/F15 → M-14_F-15 ;
--   M16/M19 → M-16_M-19 ; F18 → F-18 ; SR-M/SR-F → M+18_F+18.
--   Idempotent : une catégorie déjà amorcée n'est jamais retouchée.
--
-- DOCTRINE : AJOUT PUR (table + 2 RPC neuves), rien d'existant modifié.
--   Idempotent, fail-loud, en transaction. Dry-run : remplacer le COMMIT
--   final par ROLLBACK.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.observables_froid (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    categorie_id UUID        NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
    libelle      TEXT        NOT NULL,
    ordre        INTEGER     NOT NULL DEFAULT 0,
    actif        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT observables_froid_libelle_check
        CHECK (char_length(btrim(libelle)) BETWEEN 1 AND 120)
);

COMMENT ON TABLE public.observables_froid IS
    'Observables « à froid » par catégorie (SUIVI-VEO L3, C14-a). Retirer = actif=false, jamais DELETE. Les notes vivent dans rapports.donnees.notes_froid du match.';

-- Pas deux observables ACTIFS de même libellé dans une catégorie.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_observables_froid_actif_libelle
    ON public.observables_froid (categorie_id, lower(btrim(libelle)))
    WHERE actif;

CREATE INDEX IF NOT EXISTS idx_observables_froid_categorie
    ON public.observables_froid (categorie_id, ordre);

ALTER TABLE public.observables_froid ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.observables_froid FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Lecture
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lister_observables_froid(
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
        SELECT o.id, o.categorie_id, o.libelle, o.ordre, o.actif
        FROM public.observables_froid AS o
        WHERE o.categorie_id = p_categorie_id
          AND (p_inclure_inactifs OR o.actif)
        ORDER BY o.actif DESC, o.ordre, o.libelle;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_observables_froid(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lister_observables_froid(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Écriture (création / renommage / ordre / retrait-réactivation)
--    p_id NULL → création ; sinon mise à jour de la ligne (même catégorie).
--    p_ordre NULL → en création : fin de liste ; en mise à jour : inchangé.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_observable_froid(
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
        SELECT coalesce(max(o.ordre), 0) + 10 INTO v_ordre
        FROM public.observables_froid AS o
        WHERE o.categorie_id = p_categorie_id;
        INSERT INTO public.observables_froid (categorie_id, libelle, ordre, actif)
        VALUES (p_categorie_id, v_libelle, coalesce(p_ordre, v_ordre), coalesce(p_actif, TRUE))
        RETURNING observables_froid.id INTO v_id;
    ELSE
        UPDATE public.observables_froid AS o
           SET libelle    = v_libelle,
               ordre      = coalesce(p_ordre, o.ordre),
               actif      = coalesce(p_actif, o.actif),
               updated_at = now()
         WHERE o.id = p_id
           AND o.categorie_id = p_categorie_id
        RETURNING o.id INTO v_id;
        IF v_id IS NULL THEN
            RAISE EXCEPTION 'Observable introuvable dans cette catégorie.';
        END IF;
    END IF;

    RETURN QUERY
        SELECT o.id, o.categorie_id, o.libelle, o.ordre, o.actif
        FROM public.observables_froid AS o
        WHERE o.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_observable_froid(UUID, TEXT, UUID, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enregistrer_observable_froid(UUID, TEXT, UUID, INTEGER, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Amorçage depuis le référentiel JSON (catégories encore vides)
-- ---------------------------------------------------------------------
WITH source (tranche, rang, libelle) AS (
    VALUES
        ('EDR', 1, 'A attaqué l''espace libre'),
        ('EDR', 2, 'A passé à 2 mains'),
        ('EDR', 3, 'S''est porté en soutien'),
        ('EDR', 4, 'A su déclencher au bon moment'),
        ('EDR', 5, 'Plaquage à 2 mains'),
        ('EDR', 6, 'A respecté l''arbitre'),
        ('M14', 1, 'Choix d''orientation pertinent'),
        ('M14', 2, 'Lecture de l''intervalle'),
        ('M14', 3, 'Continuité offensive'),
        ('M14', 4, 'Densité défensive'),
        ('M14', 5, 'Plaquage offensif'),
        ('M14', 6, 'Soutien intérieur'),
        ('M14', 7, 'Récupération au sol'),
        ('M16', 1, 'Choix d''orientation pertinent'),
        ('M16', 2, 'Lecture de l''intervalle'),
        ('M16', 3, 'Continuité offensive'),
        ('M16', 4, 'Densité défensive'),
        ('M16', 5, 'Plaquage offensif'),
        ('M16', 6, 'Soutien intérieur'),
        ('M16', 7, 'Récupération au sol'),
        ('M16', 8, 'Maîtrise au sol (rucks)'),
        ('M16', 9, 'Adaptation aux décisions arbitrales'),
        ('F18', 1, 'Choix d''orientation pertinent'),
        ('F18', 2, 'Lecture de l''intervalle'),
        ('F18', 3, 'Continuité offensive'),
        ('F18', 4, 'Densité défensive'),
        ('F18', 5, 'Plaquage offensif'),
        ('F18', 6, 'Soutien intérieur'),
        ('F18', 7, 'Récupération au sol'),
        ('F18', 8, 'Maîtrise au sol (rucks)'),
        ('SEN', 1, 'Pertinence stratégique'),
        ('SEN', 2, 'Maîtrise des fondamentaux sous pression'),
        ('SEN', 3, 'Communication défensive'),
        ('SEN', 4, 'Gestion de la fin de match'),
        ('SEN', 5, 'Choix de jeu en début d''action'),
        ('SEN', 6, 'Discipline défensive'),
        ('SEN', 7, 'Efficacité du gain de terrain'),
        ('SEN', 8, 'Leadership')
),

correspondance (code, tranche) AS (
    VALUES
        ('M6', 'EDR'), ('M8', 'EDR'), ('M10', 'EDR'), ('M12', 'EDR'),
        ('M14', 'M14'), ('F15', 'M14'),
        ('M16', 'M16'), ('M19', 'M16'),
        ('F18', 'F18'),
        ('SR-M', 'SEN'), ('SR-F', 'SEN')
)

INSERT INTO public.observables_froid (categorie_id, libelle, ordre, actif)
SELECT c.id, s.libelle, s.rang * 10, TRUE
FROM public.categories AS c
INNER JOIN correspondance AS k ON c.code = k.code
INNER JOIN source AS s ON k.tranche = s.tranche
WHERE NOT EXISTS (
    SELECT 1 FROM public.observables_froid AS o
    WHERE o.categorie_id = c.id
);

-- ---------------------------------------------------------------------
-- 5. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_nb_m16  INTEGER;
    v_nb_tot  INTEGER;
    v_rls     BOOLEAN;
    v_fn      INTEGER;
BEGIN
    SELECT count(*) INTO v_nb_m16
    FROM public.observables_froid AS o
    INNER JOIN public.categories AS c ON o.categorie_id = c.id
    WHERE c.code = 'M16' AND o.actif;
    SELECT count(*) INTO v_nb_tot FROM public.observables_froid;
    SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid = 'public.observables_froid'::regclass;
    SELECT count(*) INTO v_fn FROM pg_proc
    WHERE proname IN ('lister_observables_froid', 'enregistrer_observable_froid');

    IF v_nb_m16 < 1 THEN RAISE EXCEPTION 'C14-a : aucun observable M16 après amorçage.'; END IF;
    IF NOT v_rls THEN RAISE EXCEPTION 'C14-a : RLS non activée.'; END IF;
    IF v_fn <> 2 THEN RAISE EXCEPTION 'C14-a : % fonction(s) au lieu de 2.', v_fn; END IF;
    RAISE NOTICE 'C14-a OK : % observables (dont % M16 actifs), RLS active, 2 RPC.', v_nb_tot, v_nb_m16;
END
$verif$;

COMMIT;
