-- =====================================================================
-- MOM Hub · C13-a · Rapports de match — stockage du SAISI (2e temps)
-- =====================================================================
-- Chantier : Production · Rapport de match — stockage du saisi (2e temps).
--   Fait suite au socle pt 53 (rapport en lecture seule du DÉDUIT, livré
--   dans compositions-editor.js v3.50). Implémente le PRÉREQUIS (a) du
--   modèle pt 52 (Conception « Clôture & rapports »), explicitement reporté
--   en 1re session : où et comment stocke-t-on le VERDICT de l'éducateur.
--
-- DÉCISION STRUCTURELLE (tranchée avec Manu, Option 2) : table dédiée
--   `rapports` plutôt qu'une colonne JSONB sur `evenements`. Motifs établis
--   PAR SONDE à la source (anti-hypothèse DS-1) :
--     • Aucune table rapports/bilan/verdict n'existe (sonde 2 : 0 ligne).
--     • evenements porte déjà 2 JSONB TYPÉS (logistique_deplacement,
--       recurrence) — aucune colonne fourre-tout réutilisable.
--     • notes_internes est DÉJÀ câblé au bouton « 📝 Notes » de la fiche
--       (dette MODELE-EVT-NOTES levée pt 37) → interdit de le détourner.
--     • score_mom/score_adverse/classement_final/notes_resultat existent
--       mais sont VIDES et orphelins de toute écriture côté Hub (sonde 4,
--       match VS NORD ALSACE = tout NULL) ; le déduit pt 53 est 100% front.
--     • Le statut Finaliser/Rouvrir n'a AUCUNE colonne porteuse → du DDL
--       est incontournable quelle que soit l'option → autant une table
--       propre, isolée, extensible au niveau phase/tournoi (modèle pt 52 :
--       le saisi des niveaux supérieurs se rattache à une racine, donc à
--       un evenement_uuid, donc à cette même table).
--
-- MODÈLE (pt 52, rappel) :
--   • bilan  = texte libre « à froid » de l'éducateur (le SAISI).
--   • statut = provisoire / finalisé, piloté MANUELLEMENT (Finaliser /
--     Rouvrir). Le statut est une MENTION (sur la vue + l'export), PAS un
--     cadenas : le rapport reste TOUJOURS éditable ET exportable quel que
--     soit le statut. Rouvrir = enrichir.
--   • NIVEAU MATCH d'abord (cette migration). Phase / tournoi = vues
--     dérivées plus tard, MÊME table (1 ligne par racine).
--
-- DOCTRINE — AJOUT PUR. Table neuve + RPC neuves. Rien d'existant n'est
--   modifié (evenements, chronologie_suivi, suivi_chrono non touchés).
--   Idempotent (CREATE IF NOT EXISTS, CREATE OR REPLACE, DO réexécutable),
--   fail-loud, en transaction.
--
-- AUTORISATION — calquée sur la voie coach RÉELLEMENT déployée (sonde 5 :
--   action_chrono_coach / inserer_observable_coach gardent `auth.uid() IS
--   NOT NULL`, PAS _coach_auth_uid() qui n'existe pas en base). Dette
--   SUIVI-COACH-AUTH : resserrer via has_role quand les rôles seront
--   peuplés (lié IDENT-SYS). Tables fermées RLS, tout passe par RPC
--   SECURITY DEFINER (patron C12-b / C12-n / C12-o).
--
-- Pré-requis : evenements (l'evenement_uuid = LE match aujourd'hui, une
--   racine de tournoi demain). Aucune dépendance aux fonctions coach
--   fantômes. Aucun GRANT public en écriture.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table rapports — 1 ligne par évènement (UNIQUE evenement_uuid).
--    evenement_uuid = LE match (niveau match) ; demain la racine d'un
--    tournoi (niveau tournoi) → même table, aucune structure neuve.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rapports (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    evenement_uuid  UUID        NOT NULL
                    REFERENCES evenements(id) ON DELETE CASCADE,
    -- Le SAISI (verdict « à froid » de l'éducateur).
    bilan           TEXT,
    -- Statut = MENTION pilotée manuellement, JAMAIS un cadenas (pt 52).
    statut          TEXT        NOT NULL DEFAULT 'provisoire'
                    CHECK (statut IN ('provisoire', 'finalise')),
    -- Audit léger de la finalisation.
    finalise_le     TIMESTAMPTZ,
    finalise_par    UUID,          -- trace du compte (auth.uid), PAS une FK
                                   -- personnes (espaces d'ID disjoints,
                                   -- leçon pt 30/31).
    -- Audit général.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapports_evenement_unique UNIQUE (evenement_uuid)
);

COMMENT ON TABLE rapports IS
    'Saisi (verdict éducateur) d''un rapport. 1 ligne / evenement_uuid (match aujourd''hui, racine tournoi demain). bilan = texte libre ; statut = mention provisoire/finalise (JAMAIS un cadenas, pt 52). Le déduit (score/familles/fil) reste calculé 100% front depuis chronologie_suivi. Ajout C13-a.';

COMMENT ON COLUMN rapports.statut IS
    'Mention (provisoire|finalise) pilotée manuellement. N''empêche JAMAIS l''édition ni l''export (pt 52).';
COMMENT ON COLUMN rapports.finalise_par IS
    'auth.uid() du compte ayant finalisé. Trace d''audit, pas une FK (espaces d''ID auth/personnes disjoints).';

-- ---------------------------------------------------------------------
-- 2. RLS « table fermée » : aucun accès direct client, tout par RPC
--    SECURITY DEFINER (patron C12-b / C12-n).
-- ---------------------------------------------------------------------
ALTER TABLE rapports ENABLE ROW LEVEL SECURITY;
-- (Aucune policy permissive : la table n'est lisible/écrivable que par les
--  RPC SECURITY DEFINER ci-dessous, jamais en direct.)

-- ---------------------------------------------------------------------
-- 3. Trigger updated_at (réutilise un éventuel helper projet sinon en pose
--    un local idempotent). On crée un trigger dédié à cette table.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _rapports_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rapports_updated_at ON rapports;
CREATE TRIGGER trg_rapports_updated_at
    BEFORE UPDATE ON rapports
    FOR EACH ROW
    EXECUTE FUNCTION _rapports_touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. RPC d'écriture du bilan — upsert. Crée la ligne à la volée si
--    absente. Marche QUEL QUE SOIT le statut (le statut n'est pas un
--    cadenas, pt 52). Renvoie la ligne à jour.
--    Garde : auth.uid() (patron coach réel, sonde 5).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_rapport_match(
    p_evenement_uuid UUID,
    p_bilan          TEXT
) RETURNS TABLE(
    id             UUID,
    evenement_uuid UUID,
    bilan          TEXT,
    statut         TEXT,
    finalise_le    TIMESTAMPTZ,
    finalise_par   UUID,
    updated_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.

    IF p_evenement_uuid IS NULL THEN
        RAISE EXCEPTION 'evenement_uuid requis.';
    END IF;

    -- Fail-loud : l'évènement cible doit exister (cohérence référentielle
    -- explicite avant écriture).
    IF NOT EXISTS (SELECT 1 FROM evenements e WHERE e.id = p_evenement_uuid) THEN
        RAISE EXCEPTION 'Évènement introuvable : %', p_evenement_uuid;
    END IF;

    INSERT INTO rapports (evenement_uuid, bilan)
        VALUES (p_evenement_uuid, p_bilan)
    ON CONFLICT (evenement_uuid) DO UPDATE
        SET bilan = EXCLUDED.bilan;
    -- updated_at posé par le trigger sur l'UPDATE ; sur l'INSERT il vaut
    -- déjà now() par défaut.

    RETURN QUERY
        SELECT r.id, r.evenement_uuid, r.bilan, r.statut,
               r.finalise_le, r.finalise_par, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC finaliser — pose statut='finalise' + audit. N'EMPÊCHE PAS
--    l'édition ultérieure (Rouvrir possible, et upsert marche en
--    finalise). Crée la ligne à la volée si on finalise sans bilan saisi
--    (cas limite : rapport finalisé sans texte, autorisé).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finaliser_rapport(
    p_evenement_uuid UUID
) RETURNS TABLE(
    id             UUID,
    evenement_uuid UUID,
    bilan          TEXT,
    statut         TEXT,
    finalise_le    TIMESTAMPTZ,
    finalise_par   UUID,
    updated_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        SELECT r.id, r.evenement_uuid, r.bilan, r.statut,
               r.finalise_le, r.finalise_par, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC rouvrir — repasse en 'provisoire', efface l'audit de
--    finalisation. Le bilan est CONSERVÉ (Rouvrir = enrichir, pt 52).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rouvrir_rapport(
    p_evenement_uuid UUID
) RETURNS TABLE(
    id             UUID,
    evenement_uuid UUID,
    bilan          TEXT,
    statut         TEXT,
    finalise_le    TIMESTAMPTZ,
    finalise_par   UUID,
    updated_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.

    IF p_evenement_uuid IS NULL THEN
        RAISE EXCEPTION 'evenement_uuid requis.';
    END IF;

    -- Pas de création à la volée ici : rouvrir un rapport inexistant n'a
    -- pas de sens. Fail-loud si absent.
    IF NOT EXISTS (SELECT 1 FROM rapports r WHERE r.evenement_uuid = p_evenement_uuid) THEN
        RAISE EXCEPTION 'Aucun rapport à rouvrir pour : %', p_evenement_uuid;
    END IF;

    UPDATE rapports r
        SET statut       = 'provisoire',
            finalise_le  = NULL,
            finalise_par = NULL
        WHERE r.evenement_uuid = p_evenement_uuid;

    RETURN QUERY
        SELECT r.id, r.evenement_uuid, r.bilan, r.statut,
               r.finalise_le, r.finalise_par, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$$;

-- ---------------------------------------------------------------------
-- 7. RPC lecture — renvoie la ligne (0 ou 1). Aucune création.
--    Le front gère l'absence (rapport vierge, statut implicite
--    'provisoire' tant que rien n'est saisi).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_rapport_match(
    p_evenement_uuid UUID
) RETURNS TABLE(
    id             UUID,
    evenement_uuid UUID,
    bilan          TEXT,
    statut         TEXT,
    finalise_le    TIMESTAMPTZ,
    finalise_par   UUID,
    created_at     TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;
    -- DETTE SUIVI-COACH-AUTH : resserrer via has_role quand rôles peuplés.

    RETURN QUERY
        SELECT r.id, r.evenement_uuid, r.bilan, r.statut,
               r.finalise_le, r.finalise_par, r.created_at, r.updated_at
        FROM rapports r
        WHERE r.evenement_uuid = p_evenement_uuid;
END;
$$;

-- ---------------------------------------------------------------------
-- 8. GRANTs — tables fermées, RPC réservées aux comptes authentifiés.
--    Aucune voie jeton/anon (le rapport saisi est une surface COACH,
--    cohérent avec la persona « éducateur seul » du socle pt 53).
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION upsert_rapport_match(UUID, TEXT)   FROM PUBLIC;
REVOKE ALL ON FUNCTION finaliser_rapport(UUID)            FROM PUBLIC;
REVOKE ALL ON FUNCTION rouvrir_rapport(UUID)              FROM PUBLIC;
REVOKE ALL ON FUNCTION get_rapport_match(UUID)            FROM PUBLIC;

GRANT EXECUTE ON FUNCTION upsert_rapport_match(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION finaliser_rapport(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION rouvrir_rapport(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION get_rapport_match(UUID)          TO authenticated;

-- _rapports_touch_updated_at : fonction de trigger, jamais appelée par le
-- client → pas de GRANT public.
REVOKE ALL ON FUNCTION _rapports_touch_updated_at() FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 9. Invariants explicites (fail-loud) — vérifie l'état attendu avant
--    COMMIT. Si un invariant casse, RAISE → rollback de toute la
--    transaction (idempotence préservée).
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_ok BOOLEAN;
BEGIN
    -- (a) la table existe avec la contrainte d'unicité attendue.
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rapports_evenement_unique'
    ) INTO v_ok;
    IF NOT v_ok THEN
        RAISE EXCEPTION 'Invariant cassé : contrainte rapports_evenement_unique absente.';
    END IF;

    -- (b) RLS bien active sur rapports.
    SELECT relrowsecurity FROM pg_class WHERE relname = 'rapports' INTO v_ok;
    IF NOT v_ok THEN
        RAISE EXCEPTION 'Invariant cassé : RLS non active sur rapports.';
    END IF;

    -- (c) les 4 RPC publiques existent.
    IF (SELECT count(*) FROM pg_proc
        WHERE proname IN ('upsert_rapport_match','finaliser_rapport',
                          'rouvrir_rapport','get_rapport_match')) <> 4 THEN
        RAISE EXCEPTION 'Invariant cassé : les 4 RPC rapports ne sont pas toutes présentes.';
    END IF;

    RAISE NOTICE 'C13-a OK : table rapports + RLS + 4 RPC en place.';
END;
$verif$;

COMMIT;

-- =====================================================================
-- FIN C13-a. Le saisi du rapport de match est stockable :
--   upsert_rapport_match (bilan) · finaliser_rapport · rouvrir_rapport ·
--   get_rapport_match. Tables fermées, RPC SECURITY DEFINER garde
--   auth.uid(). Niveau MATCH ; phase/tournoi = vues dérivées futures
--   (même table). Prochaine étape : wrappers client supabase-client.js
--   (additifs) puis UI onglet Rapport (compositions-editor.js).
-- =====================================================================
