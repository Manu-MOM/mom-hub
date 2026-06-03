-- ============================================================
-- C13-b · Rapports : données structurées (classement + aiguillage)
-- ============================================================
-- Étend le socle C13-a (table `rapports`, pt 54) pour porter le SAISI
-- STRUCTURÉ des niveaux PHASE et TOURNOI (modèle pt 52) :
--   • classement ordonné (poule) OU verdict victoire/défaite (match sec)
--   • aiguillage descriptif (destination notée en texte par rang/équipe)
--
-- DÉCISION STRUCTURELLE (pt 55, tranchée par les sondes a/b/c/d) :
--   Phase ET tournoi SONT des lignes `evenements` à UUID propre
--   (sonde a : hiérarchie réelle racine → phases[UUID] → matchs).
--   `rapports.evenement_uuid` est une FK simple vers evenements(id)
--   sans contrainte de type (sonde b) → un rapport de phase ou de
--   tournoi se rattache À L'IDENTIQUE, sur l'UUID de la phase / racine.
--   => AUCUNE table neuve, AUCun relâchement du UNIQUE.
--
--   Le SAISI structuré n'a aucune colonne porteuse dans `rapports`
--   (1 seul champ `bilan` texte). Le choix « v1 complète » (bilan +
--   classement + aiguillage) rend le DDL incontournable — même logique
--   que le motif décisif du pt 54 (un besoin sans colonne porteuse ⇒
--   DDL inévitable, autant le faire propre, pas un fourre-tout texte).
--   => 1 colonne `donnees jsonb` GÉNÉRIQUE (la forme est imposée par le
--   front + la RPC, pas par le DDL) → plus jamais de migration pour ce
--   module quand une dimension s'ajoute. `bilan` reste le texte libre.
--
-- FORME front du JSON (documentaire, NON contrainte en base) :
--   {
--     "classement": [ { "rang": 1, "equipe": "…", "note": "…" }, … ],
--     "aiguillage": [ { "origine": "1er poule A", "destination": "…" }, … ]
--   }
--   donnees = NULL pour un rapport de match (rétrocompatible).
--
-- RÉTROCOMPAT : la colonne est NULLABLE défaut NULL ; la ligne existante
--   (b39d82bc, rapport de match) reste valide et intacte. Le 3e param
--   p_donnees est DEFAULT NULL → les appels 2-args du match inchangés.
--
-- IDEMPOTENT : ADD COLUMN IF NOT EXISTS + DROP FUNCTION IF EXISTS avant
--   recréation (les RETURNS TABLE changent de signature de sortie =
--   CREATE OR REPLACE refusé, leçon ERROR 42702 / changement de retour
--   pt 54) + REVOKE/GRANT rejoués.
-- FAIL-LOUD : gardes auth.uid() + existence évènement conservées ;
--   bloc DO de vérification d'invariants en fin de script.
-- SÉCURITÉ : SECURITY DEFINER, garde auth.uid() (dette SUIVI-COACH-AUTH),
--   REVOKE PUBLIC / GRANT authenticated (patron voie coach).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- (1) Colonne donnees jsonb (additive, nullable)
-- ------------------------------------------------------------
ALTER TABLE public.rapports
    ADD COLUMN IF NOT EXISTS donnees jsonb;

COMMENT ON COLUMN public.rapports.donnees IS
    'Saisi structuré des niveaux phase/tournoi (classement + aiguillage). '
    'NULL pour un rapport de match. Forme imposée par le front, pas par le DDL (pt 55, C13-b).';

-- ------------------------------------------------------------
-- (2) get_rapport_match : expose out_donnees
--     (signature de SORTIE modifiée → DROP puis CREATE)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_rapport_match(uuid);

CREATE FUNCTION public.get_rapport_match(p_evenement_uuid uuid)
 RETURNS TABLE(
    out_id             uuid,
    out_evenement_uuid uuid,
    out_bilan          text,
    out_donnees        jsonb,
    out_statut         text,
    out_finalise_le    timestamp with time zone,
    out_finalise_par   uuid,
    out_created_at     timestamp with time zone,
    out_updated_at     timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.

    RETURN QUERY
        SELECT r.id, r.evenement_uuid, r.bilan, r.donnees, r.statut,
               r.finalise_le, r.finalise_par, r.created_at, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$function$;

-- ------------------------------------------------------------
-- (3) upsert_rapport_match : gagne p_donnees (DEFAULT NULL) + out_donnees
--     Sémantique COALESCE : un upsert qui ne passe PAS donnees ne
--     l'écrase pas (préserve le structuré déjà saisi quand on ne
--     met à jour que le bilan, et inversement). Pour effacer le
--     structuré, le front passe explicitement 'null'::jsonb… or NULL
--     et "non fourni" sont indistinguables en SQL → convention :
--     le front renvoie TOUJOURS l'objet complet courant (bilan + donnees)
--     à chaque upsert ; côté SQL on écrit ce qui est fourni, en
--     préservant l'autre champ si l'argument est NULL (COALESCE).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_rapport_match(uuid, text);
DROP FUNCTION IF EXISTS public.upsert_rapport_match(uuid, text, jsonb);

CREATE FUNCTION public.upsert_rapport_match(
    p_evenement_uuid uuid,
    p_bilan          text,
    p_donnees        jsonb DEFAULT NULL)
 RETURNS TABLE(
    out_id             uuid,
    out_evenement_uuid uuid,
    out_bilan          text,
    out_donnees        jsonb,
    out_statut         text,
    out_finalise_le    timestamp with time zone,
    out_finalise_par   uuid,
    out_updated_at     timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.

    IF p_evenement_uuid IS NULL THEN
        RAISE EXCEPTION 'evenement_uuid requis.';
    END IF;

    -- Fail-loud : l'évènement cible doit exister.
    IF NOT EXISTS (SELECT 1 FROM evenements e WHERE e.id = p_evenement_uuid) THEN
        RAISE EXCEPTION 'Évènement introuvable : %', p_evenement_uuid;
    END IF;

    INSERT INTO rapports (evenement_uuid, bilan, donnees)
        VALUES (p_evenement_uuid, p_bilan, p_donnees)
    ON CONFLICT (evenement_uuid) DO UPDATE
        SET bilan   = EXCLUDED.bilan,
            -- préserve le champ non fourni (NULL = "non transmis ce coup-ci")
            donnees = COALESCE(EXCLUDED.donnees, rapports.donnees);
    -- updated_at posé par le trigger sur l'UPDATE ; sur l'INSERT = now() par défaut.

    RETURN QUERY
        SELECT r.id, r.evenement_uuid, r.bilan, r.donnees, r.statut,
               r.finalise_le, r.finalise_par, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$function$;

-- ------------------------------------------------------------
-- (4) finaliser_rapport : expose out_donnees (statut/audit inchangés)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.finaliser_rapport(uuid);

CREATE FUNCTION public.finaliser_rapport(p_evenement_uuid uuid)
 RETURNS TABLE(
    out_id             uuid,
    out_evenement_uuid uuid,
    out_bilan          text,
    out_donnees        jsonb,
    out_statut         text,
    out_finalise_le    timestamp with time zone,
    out_finalise_par   uuid,
    out_updated_at     timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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

    INSERT INTO rapports (evenement_uuid, statut, finalise_le, finalise_par)
        VALUES (p_evenement_uuid, 'finalise', now(), auth.uid())
    ON CONFLICT (evenement_uuid) DO UPDATE
        SET statut       = 'finalise',
            finalise_le  = now(),
            finalise_par = auth.uid();

    RETURN QUERY
        SELECT r.id, r.evenement_uuid, r.bilan, r.donnees, r.statut,
               r.finalise_le, r.finalise_par, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$function$;

-- ------------------------------------------------------------
-- (5) rouvrir_rapport : expose out_donnees (bilan ET donnees conservés)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rouvrir_rapport(uuid);

CREATE FUNCTION public.rouvrir_rapport(p_evenement_uuid uuid)
 RETURNS TABLE(
    out_id             uuid,
    out_evenement_uuid uuid,
    out_bilan          text,
    out_donnees        jsonb,
    out_statut         text,
    out_finalise_le    timestamp with time zone,
    out_finalise_par   uuid,
    out_updated_at     timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.

    IF p_evenement_uuid IS NULL THEN
        RAISE EXCEPTION 'evenement_uuid requis.';
    END IF;

    -- Fail-loud si absent : rouvrir un rapport inexistant n'a pas de sens.
    IF NOT EXISTS (SELECT 1 FROM rapports r WHERE r.evenement_uuid = p_evenement_uuid) THEN
        RAISE EXCEPTION 'Aucun rapport à rouvrir pour : %', p_evenement_uuid;
    END IF;

    UPDATE rapports r
        SET statut       = 'provisoire',
            finalise_le  = NULL,
            finalise_par = NULL
        WHERE r.evenement_uuid = p_evenement_uuid;
    -- bilan ET donnees inchangés : Rouvrir = enrichir (pt 52).

    RETURN QUERY
        SELECT r.id, r.evenement_uuid, r.bilan, r.donnees, r.statut,
               r.finalise_le, r.finalise_par, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$function$;

-- ------------------------------------------------------------
-- (6) Permissions (rejouées — patron voie coach C13-a)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_rapport_match(uuid)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_rapport_match(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finaliser_rapport(uuid)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rouvrir_rapport(uuid)              FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_rapport_match(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_rapport_match(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finaliser_rapport(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.rouvrir_rapport(uuid)              TO authenticated;

-- ------------------------------------------------------------
-- (7) Invariants fail-loud
-- ------------------------------------------------------------
DO $verif$
DECLARE
    v_col   int;
    v_funcs int;
BEGIN
    -- la colonne donnees existe et est jsonb
    SELECT count(*) INTO v_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rapports'
      AND column_name = 'donnees' AND data_type = 'jsonb';
    IF v_col <> 1 THEN
        RAISE EXCEPTION 'Invariant C13-b : colonne rapports.donnees jsonb absente.';
    END IF;

    -- les 4 fonctions existent (la signature upsert est bien à 3 params)
    SELECT count(*) INTO v_funcs
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND ( (p.proname = 'get_rapport_match'   AND p.pronargs = 1)
         OR (p.proname = 'upsert_rapport_match' AND p.pronargs = 3)
         OR (p.proname = 'finaliser_rapport'   AND p.pronargs = 1)
         OR (p.proname = 'rouvrir_rapport'     AND p.pronargs = 1) );
    IF v_funcs <> 4 THEN
        RAISE EXCEPTION 'Invariant C13-b : 4 RPC attendues, % trouvées.', v_funcs;
    END IF;

    RAISE NOTICE 'C13-b OK : colonne donnees + 4 RPC adaptées (out_donnees, p_donnees DEFAULT NULL).';
END;
$verif$;

COMMIT;

-- ============================================================
-- RECETTE SUGGÉRÉE (transaction rollback, contexte admin) :
--   1. get sur b39d82bc → out_donnees doit être NULL (rapport de match
--      existant intact).
--   2. upsert(phaseId='1828f871…', bilan='Brassage M14-1',
--      donnees='{"classement":[{"rang":1,"equipe":"M14-1"}]}'::jsonb)
--      → ligne créée, donnees stocké.
--   3. upsert(phaseId='1828f871…', bilan='Brassage M14-1 (corrigé)')
--      (SANS donnees) → bilan màj, donnees PRÉSERVÉ (COALESCE).
--   4. finaliser(phaseId) → statut finalise, donnees conservé.
--   5. rouvrir(phaseId)   → provisoire, bilan ET donnees conservés.
--   ROLLBACK pour ne rien graver.
-- ============================================================
