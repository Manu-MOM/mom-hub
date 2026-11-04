-- =====================================================================
-- C17-b — Bascule du compte Hub de Cindy HORNECKER (trésorière)
--         de cindy.hornecker@gmail.com vers tresorier.mom@gmail.com
-- =====================================================================
-- CONTEXTE (01/11/2026, retour terrain) :
--   Cindy souhaite se connecter avec l'adresse dédiée à la trésorerie.
--   Le compte tresorier.mom@gmail.com existe déjà (créé le 30/10/2026),
--   orphelin : aucun pont auth_personne, aucun rôle.
--   Contrainte : auth_personne UNIQUE (personne_id) → une fiche = un compte.
--
-- DÉCISION DE MANU (01/11/2026) : option A (bascule) + suppression du
--   compte perso.
--
-- SONDES PRÉALABLES (01/11/2026) :
--   - compte perso 776e51f8… : pont auth_personne → fiche 09fccb97…,
--     rôle 'bureau' ; aucune autre référence en base (scan de toutes les
--     colonnes uuid du schéma public : seances.created_by = 0, etc.).
--   - compte trésorerie de72973c… : aucune référence en base.
--   - FK vers auth.users : auth_roles.user_id CASCADE,
--     auth_roles.created_by SET NULL, seances.created_by NO ACTION.
--     auth_personne.user_id n'a PAS de FK → mise à jour explicite.
--   - aucun trigger sur auth_roles, auth_personne, auth.users.
--   - le front résout la fiche UNIQUEMENT via auth_personne sur
--     auth.uid() (RPC qui_suis_je) → aucun impact front.
--
-- CE SCRIPT :
--   1. auth_personne : user_id perso → user_id trésorerie (même fiche).
--   2. auth_roles    : rôle 'bureau' déplacé sur le compte trésorerie.
--   3. auth.users    : suppression du compte perso (DESTRUCTIF).
--
-- RETOUR ARRIÈRE : le compte perso supprimé n'est pas restaurable.
--   Si besoin : Cindy recrée un compte avec son adresse perso, puis
--   on rebascule auth_personne / auth_roles sur ce nouveau user_id.
--
-- DOCTRINE : fail-loud, en transaction. Dry-run : COMMIT → ROLLBACK.
-- =====================================================================

BEGIN;

DO $c17b$
DECLARE
    v_fiche UUID := '09fccb97-3357-4029-b879-ae32207eded7';
    v_perso UUID := '776e51f8-6348-4454-8c57-1136e37dc1aa';
    v_treso UUID := 'de72973c-6869-4965-84d9-8d961c5e76b3';
BEGIN
    -- Gardes : état attendu exact, sinon arrêt.
    IF NOT EXISTS (SELECT 1 FROM auth.users
                   WHERE id = v_perso AND lower(email) = 'cindy.hornecker@gmail.com') THEN
        RAISE EXCEPTION 'C17-b : compte perso introuvable ou adresse différente — arrêt.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users
                   WHERE id = v_treso AND lower(email) = 'tresorier.mom@gmail.com') THEN
        RAISE EXCEPTION 'C17-b : compte trésorerie introuvable ou adresse différente — arrêt.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.auth_personne
                   WHERE user_id = v_perso AND personne_id = v_fiche) THEN
        RAISE EXCEPTION 'C17-b : compte perso non relié à la fiche HORNECKER Cindy — arrêt.';
    END IF;
    IF (SELECT count(*) FROM public.auth_roles WHERE user_id = v_perso) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.auth_roles
                      WHERE user_id = v_perso AND role = 'bureau') THEN
        RAISE EXCEPTION 'C17-b : rôles du compte perso différents de {bureau} — arrêt.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.auth_personne WHERE user_id = v_treso)
       OR EXISTS (SELECT 1 FROM public.auth_roles WHERE user_id = v_treso) THEN
        RAISE EXCEPTION 'C17-b : compte trésorerie déjà relié ou déjà doté d''un rôle — arrêt.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.seances WHERE created_by = v_perso) THEN
        RAISE EXCEPTION 'C17-b : séances créées par le compte perso — suppression bloquée — arrêt.';
    END IF;

    -- 1. Pont fiche → compte trésorerie.
    UPDATE public.auth_personne SET user_id = v_treso
    WHERE user_id = v_perso AND personne_id = v_fiche;

    -- 2. Rôle bureau → compte trésorerie.
    UPDATE public.auth_roles SET user_id = v_treso
    WHERE user_id = v_perso AND role = 'bureau';

    -- 3. Suppression du compte perso.
    DELETE FROM auth.users WHERE id = v_perso;
END
$c17b$;

DO $verif$
DECLARE
    v_fiche UUID := '09fccb97-3357-4029-b879-ae32207eded7';
    v_perso UUID := '776e51f8-6348-4454-8c57-1136e37dc1aa';
    v_treso UUID := 'de72973c-6869-4965-84d9-8d961c5e76b3';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.auth_personne
                   WHERE user_id = v_treso AND personne_id = v_fiche) THEN
        RAISE EXCEPTION 'C17-b : pont trésorerie → fiche absent.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.auth_roles
                   WHERE user_id = v_treso AND role = 'bureau') THEN
        RAISE EXCEPTION 'C17-b : rôle bureau absent sur le compte trésorerie.';
    END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_perso)
       OR EXISTS (SELECT 1 FROM public.auth_personne WHERE user_id = v_perso)
       OR EXISTS (SELECT 1 FROM public.auth_roles WHERE user_id = v_perso) THEN
        RAISE EXCEPTION 'C17-b : trace résiduelle du compte perso.';
    END IF;
    RAISE NOTICE 'C17-b OK : fiche HORNECKER Cindy reliée à tresorier.mom@gmail.com (bureau), compte perso supprimé.';
END
$verif$;

COMMIT;
