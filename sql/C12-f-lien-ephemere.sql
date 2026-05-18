-- =====================================================================
-- MOM Hub · C12-f · Lien éphémère + payload compo réduit
-- =====================================================================
-- Dette Production C12-f (= anciennes dettes C11-d + C11-e du Suivi).
-- Sources de vérité :
--   • Modelisation-Chronologie-Suivi-v1.md v1.1, §5 (RLS), §6 (RPC),
--     §9.1 (dette C12-f)
--   • Conception-Portail-UI-Suivi.md : S-1.2/S-1.4 (sas), S-4.1
--     (aperçu compo replié, payload réduit RGPD), S-5.1 (lien
--     spectateur DISTINCT, sûr par construction), S-5.2 (relais =
--     nouveau lien même rencontre)
--   • Modelisation-Evenements-v1.1.md §4.3 (schéma RÉEL compositions /
--     composition_joueurs — non inventé)
-- Pré-requis : C12-a (chronologie_suivi), C12-b (RLS).
--
-- CHOIX TECHNIQUE (le mécanisme du lien relève de Production, cf.
-- modélisation §5.2 « relève de Production »). Retenu : un jeton
-- opaque stocké en base (table lien_suivi), validé côté serveur par
-- les RPC. PAS de JWT signé maison : plus simple, robuste, budget 0 €,
-- éditable/inspectable, conforme P1. Le jeton est dans l'URL ; le
-- front le repasse à chaque appel RPC ; la RPC le valide.
--
-- DEUX TYPES DE LIEN (S-5.1.a) :
--   • 'saisie'     : droit d'écriture borné à UNE rencontre
--   • 'spectateur' : lecture seule, AUCUN droit d'écriture
--     (sûr par construction : ce n'est pas un mode d'UI, c'est un
--      jeton sans la capacité d'écrire)
--
-- RELAIS (S-5.2.a) : régénérer un lien 'saisie' pour une rencontre
-- révoque les liens 'saisie' actifs précédents de cette rencontre.
-- La traçabilité est préservée (chronologie_suivi.saisi_par = jeton).
--
-- PI-7 (garde-fou doctrinal, passation) : une compo de match
-- 'validee' active est une PRÉ-CONDITION DURE pour émettre un lien
-- 'saisie'. Sans elle, le suivi ne peut pas démarrer.
--
-- DA-2 (dépendance amont tracée, conception S-2.3) : la génération
-- du lien expose un point de config chrono pour l'EDR. Stocké TEL
-- QUEL dans lien_suivi.config_chrono (JSONB), NON interprété ici
-- (anti-anticipation : on nomme le point, on ne code pas le moteur
-- chrono).
--
-- Idempotent.
--
-- =====================================================================
-- CORRECTIF 18/05/2026 (conv `Production · Suivi de rencontre (backend
-- C12)`, rouverte au seul titre « retouche SQL C12 »).
-- BUG TERRAIN : « générer le lien de suivi » échouait sur
--   `column "evenement_uuid" does not exist`.
-- CAUSE (vérifiée à la source, DDL réellement déployé
--   `sql/18-compositions.sql`) : la table `compositions` a été
--   implémentée avec un naming `_id` (`evenement_id`,
--   `composition_id`, `joueur_id`, `poste_id`) — l'en-tête de
--   `sql/18` le dit explicitement (« Naming `_id` partout au lieu de
--   `_uuid` du doc »). Le doc `Modelisation-Evenements-v1.1.md §4.3`
--   (cité comme « schéma réel » par ce fichier) était resté en
--   `_uuid` et NE reflétait PAS le déployé. Ce C12-f avait suivi le
--   doc, pas le DDL → 2 requêtes fausses.
-- CORRIGÉ (alignement strict sur le DDL déployé, AUCUN autre
--   changement — signature, logique PI-7, payload, grants, helpers
--   intacts ; alias de sortie RPC `joueur_uuid`/`poste_uuid`
--   CONSERVÉS pour ne pas casser le contrat client) :
--   • PI-7 de `generer_lien_ephemere` : `compositions.evenement_uuid`
--     → `evenement_id`  (= LE bug terrain).
--   • `get_compo_reduite_rencontre` : `cj.joueur_uuid`→`joueur_id`,
--     `cj.poste_uuid`→`poste_id`, `cj.composition_uuid`→
--     `composition_id`, `c.evenement_uuid`→`c.evenement_id`
--     (bug latent du même type — plantait dès l'aperçu compo).
-- NON corrigé, SIGNALÉ (ne rien inventer) : `cj.etat_joueur` est
--   absent de `sql/18-compositions.sql`. Le commentaire d'origine
--   dit « colonne livrée Phase 4.3 » → vraisemblablement ajoutée par
--   un ALTER ultérieur non fourni ici. Laissé TEL QUEL : le corriger
--   à l'aveugle (suppression/rename) serait une invention. ⚠️ À
--   VÉRIFIER À LA SOURCE : si `etat_joueur` n'existe pas non plus en
--   base déployée, `get_compo_reduite_rencontre` plantera encore →
--   fournir le SQL de l'ALTER `composition_joueurs` (ou confirmer la
--   colonne) pour trancher. Hors périmètre de ce correctif (qui ne
--   traite que l'écart de nommage prouvé par le DDL en main).
--   ✅ RÉSOLU 18/05 : vérifié à la source (information_schema.columns
--   sur la base déployée) — `composition_joueurs.etat_joueur` EXISTE
--   bien (type text). `get_compo_reduite_rencontre` testée en base :
--   renvoie 20 lignes correctement. Aucune correction nécessaire ;
--   l'inquiétude initiale était infondée (d'où l'importance de ne
--   PAS l'avoir « corrigée » à l'aveugle).
--
-- CORRECTIF 2 — 18/05/2026 (même conv) : APRÈS déploiement du fix
--   ci-dessus, `generer_lien_ephemere` plantait sur
--   `column reference "role" is ambiguous` (bug masqué jusque-là par
--   l'erreur evenement_uuid : l'UPDATE n'était jamais atteint).
--   CAUSE : `RETURNS TABLE(token, role, expire_le)` crée une variable
--   PL/pgSQL `role` qui entre en collision avec la colonne
--   `lien_suivi.role` dans l'UPDATE du relais (référence non
--   qualifiée). CORRIGÉ : les 3 colonnes de l'UPDATE sont qualifiées
--   `lien_suivi.evenement_uuid` / `.role` / `.revoque` (qualifier
--   tout l'UPDATE, pas seulement `role`, prévient le même piège lors
--   d'un futur changement de signature). Zéro autre changement.
--   Appliqué + vérifié en base Supabase (lien généré OK en terrain) ;
--   ce fichier intègre maintenant les DEUX correctifs (dépôt
--   resynchronisé sur la base).
-- NON touché : `lien_suivi.evenement_uuid` (colonne réelle de CETTE
--   table, DDL ci-dessous — cohérente ; le relais l.~195 est correct).
-- DÉPLOIEMENT : ce fichier est `CREATE OR REPLACE` → ré-exécuter en
--   base Supabase (sinon le dépôt est juste mais le terrain plante
--   toujours). 1 fichier = 1 commit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table lien_suivi (magasin de jetons éphémères) — table fermée
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lien_suivi (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token           TEXT UNIQUE NOT NULL,            -- opaque, va dans l'URL
    evenement_uuid  UUID NOT NULL
        REFERENCES evenements(id) ON DELETE RESTRICT, -- cohérent Q1
    role            TEXT NOT NULL DEFAULT 'saisie',  -- 'saisie' | 'spectateur'
    cree_par        TEXT,                             -- trace libre (coach)
    config_chrono   JSONB,                            -- DA-2 : pré-réglage
                                                      -- chrono EDR, stocké
                                                      -- tel quel, NON
                                                      -- interprété ici
    revoque         BOOLEAN NOT NULL DEFAULT FALSE,   -- relais : ancien
                                                      -- lien saisie révoqué
    expire_le       TIMESTAMPTZ NOT NULL,             -- J+1 par défaut
    date_creation   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT lien_suivi_role_check CHECK (role IN ('saisie', 'spectateur'))
);

CREATE INDEX IF NOT EXISTS idx_lien_suivi_token
    ON lien_suivi (token);
CREATE INDEX IF NOT EXISTS idx_lien_suivi_evenement
    ON lien_suivi (evenement_uuid);

-- Table fermée (même posture que chronologie_suivi, cf. C12-b) :
-- accès uniquement via les RPC SECURITY DEFINER ci-dessous.
ALTER TABLE lien_suivi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lien_suivi FROM PUBLIC;
REVOKE ALL ON TABLE lien_suivi FROM anon;
REVOKE ALL ON TABLE lien_suivi FROM authenticated;

-- ---------------------------------------------------------------------
-- 2. Helper interne : valider un jeton, renvoyer la rencontre
--    p_role_requis = 'saisie' pour les écritures ; NULL = lecture
--    (un jeton 'saisie' OU 'spectateur' peut lire).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION valider_lien_suivi(
    p_token       TEXT,
    p_role_requis TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lien lien_suivi%ROWTYPE;
BEGIN
    SELECT * INTO v_lien FROM lien_suivi WHERE token = p_token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lien invalide.';
    END IF;
    IF v_lien.revoque THEN
        RAISE EXCEPTION 'Lien révoqué (un relais a été généré pour cette rencontre).';
    END IF;
    IF v_lien.expire_le < NOW() THEN
        RAISE EXCEPTION 'Lien expiré.';
    END IF;
    -- Une écriture exige un jeton 'saisie'. Un jeton 'spectateur'
    -- ne peut JAMAIS écrire (sûr par construction, S-5.1.a).
    IF p_role_requis IS NOT NULL AND v_lien.role <> p_role_requis THEN
        RAISE EXCEPTION 'Ce lien ne permet pas cette action (lecture seule).';
    END IF;

    RETURN v_lien.evenement_uuid;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Helper interne : nom court RGPD-safe d'une personne
--
-- ⚠️ POINT D'ADAPTATION PRODUCTION — SEUL POINT NON CÂBLÉ DE TOUT C12.
-- La modélisation §2.1 indique qu'une « RPC RGPD-safe en place »
-- existe déjà sur `personnes` (323 fiches, structure en blocs JSONB).
-- Je ne connais PAS le chemin exact du nom dans `personnes` et je
-- REFUSE de l'inventer (discipline anti-invention). Cette fonction
-- est le SEUL endroit à brancher : remplacer le corps par un appel à
-- la source nom RGPD-safe existante (numéro + nom court UNIQUEMENT,
-- jamais prénom complet / coordonnées / médical — P6).
-- Tant que non câblée : renvoie NULL (le front affiche le numéro de
-- maillot, qui lui est connu via composition_joueurs — voir §4).
-- Câbler cette seule fonction active les noms partout (C12-d, C12-f).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chronologie_nom_court_personne(
    p_personne_uuid UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_personne_uuid IS NULL THEN
        RETURN NULL;
    END IF;
    -- TODO PRODUCTION : remplacer par l'appel à la source nom
    -- RGPD-safe existante de `personnes`. Ex. (à confirmer) :
    --   RETURN (SELECT nom_court FROM <source_rgpd_safe>
    --           WHERE personne_uuid = p_personne_uuid);
    RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC : génération d'un lien éphémère (coach, depuis le Hub)
--    p_role = 'saisie' (défaut) | 'spectateur'
--    p_config_chrono = pré-réglage chrono EDR optionnel (DA-2)
--    p_duree = durée de validité (défaut 36 h ≈ J+1)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generer_lien_ephemere(
    p_evenement_uuid UUID,
    p_role           TEXT     DEFAULT 'saisie',
    p_config_chrono  JSONB    DEFAULT NULL,
    p_duree          INTERVAL DEFAULT INTERVAL '36 hours',
    p_cree_par       TEXT     DEFAULT NULL
) RETURNS TABLE (token TEXT, role TEXT, expire_le TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token   TEXT;
    v_expire  TIMESTAMPTZ;
BEGIN
    IF p_role NOT IN ('saisie', 'spectateur') THEN
        RAISE EXCEPTION 'Rôle de lien invalide : %', p_role;
    END IF;

    -- PI-7 : compo 'validee' active = pré-condition DURE pour un
    -- lien de saisie (passation, garde-fou). Schéma compositions
    -- réel : Modelisation-Evenements-v1.1 §4.3 (etat/est_active/cote).
    IF p_role = 'saisie' THEN
        IF NOT EXISTS (
            SELECT 1 FROM compositions
            WHERE evenement_id = p_evenement_uuid   -- FIX terrain : colonne réelle = evenement_id (sql/18-compositions.sql ligne 30) ; le doc modél. §4.3 dit evenement_uuid mais le déployé fait foi
              AND cote = 'mom'
              AND etat = 'validee'
              AND est_active = TRUE
        ) THEN
            RAISE EXCEPTION
              'PI-7 : aucune composition validee active pour cette rencontre — le suivi ne peut pas démarrer.';
        END IF;

        -- Relais (S-5.2.a) : révoquer les liens 'saisie' actifs
        -- précédents de cette rencontre. La traçabilité est
        -- conservée (chronologie_suivi.saisi_par garde l'ancien jeton).
        UPDATE lien_suivi
           SET revoque = TRUE
         WHERE lien_suivi.evenement_uuid = p_evenement_uuid   -- FIX 2 : colonnes qualifiées (lever l'ambiguïté "role" : RETURNS TABLE(... role ...) crée une variable homonyme de lien_suivi.role)
           AND lien_suivi.role = 'saisie'
           AND lien_suivi.revoque = FALSE;
    END IF;

    -- Jeton opaque (2 UUID concaténés sans tirets = 64 hex).
    -- gen_random_uuid() est déjà le pattern projet (M-5) : aucune
    -- extension requise.
    v_token := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');
    v_expire := NOW() + p_duree;

    INSERT INTO lien_suivi (token, evenement_uuid, role,
                            cree_par, config_chrono, expire_le)
    VALUES (v_token, p_evenement_uuid, p_role,
            p_cree_par, p_config_chrono, v_expire);

    RETURN QUERY SELECT v_token, p_role, v_expire;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC : payload compo réduit RGPD (aperçu compo S-4.1)
--    Lecture de la compo 'validee' active de la rencontre, en
--    champs MINIMAUX. Schéma composition_joueurs réel :
--    Modelisation-Evenements-v1.1 §4.3 (non inventé).
--    etat_joueur : colonne livrée Phase 4.3 (chronologie modél. §7).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_compo_reduite_rencontre(
    p_token TEXT
) RETURNS TABLE (
    joueur_uuid    UUID,
    numero_maillot INTEGER,
    poste_uuid     TEXT,
    role           TEXT,
    etat_joueur    TEXT,
    nom_court      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt UUID;
BEGIN
    v_evt := valider_lien_suivi(p_token, NULL);  -- lecture : 2 rôles OK

    RETURN QUERY
    SELECT cj.joueur_id        AS joueur_uuid,     -- FIX : colonne réelle joueur_id (sql/18) ; alias de sortie joueur_uuid conservé = contrat client inchangé
           cj.numero_maillot,
           cj.poste_id         AS poste_uuid,      -- FIX : colonne réelle poste_id ; alias de sortie poste_uuid conservé
           cj.role,
           cj.etat_joueur,                          -- ⚠️ NON corrigé : absente de sql/18-compositions.sql ; voir NOTE en tête (ALTER Phase 4.3+ à confirmer, non inventé)
           chronologie_nom_court_personne(cj.joueur_id)
    FROM   composition_joueurs cj
    JOIN   compositions c ON c.id = cj.composition_id   -- FIX : FK réelle composition_id (sql/18), pas composition_uuid
    WHERE  c.evenement_id = v_evt                       -- FIX : colonne réelle evenement_id (sql/18), pas evenement_uuid
      AND  c.cote = 'mom'
      AND  c.etat = 'validee'
      AND  c.est_active = TRUE
    ORDER BY cj.numero_maillot NULLS LAST;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Surface d'accès (table fermée → on ouvre UNIQUEMENT les RPC)
--    • generer_lien_ephemere : coach authentifié (jamais anon : un
--      visiteur ne doit pas pouvoir fabriquer des liens) + service_role
--    • get_compo_reduite_rencontre : porteur d'un lien (clé anon +
--      jeton) ET coach authentifié
--    • valider_lien_suivi / chronologie_nom_court_personne : helpers
--      internes, pas d'EXECUTE public
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION generer_lien_ephemere(UUID, TEXT, JSONB, INTERVAL, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION generer_lien_ephemere(UUID, TEXT, JSONB, INTERVAL, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION get_compo_reduite_rencontre(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_compo_reduite_rencontre(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION valider_lien_suivi(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION chronologie_nom_court_personne(UUID) FROM PUBLIC;

-- =====================================================================
-- FIN C12-f. Prochaine dette (ordre §10.1) : C12-c (RPC écriture).
-- Rappel : 1 seul point à câbler côté Production = la fonction
-- chronologie_nom_court_personne (§3). Tout le reste est opérationnel.
-- =====================================================================
