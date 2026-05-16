-- =====================================================================
-- MOM Hub · C12-a · CREATE TABLE chronologie_suivi
-- =====================================================================
-- Dette Production C12-a.
-- Source de vérité : Modelisation-Chronologie-Suivi-v1.md  v1.1 (patch DS-1)
--                    §4.1 (DDL) + §4.2 (index).
--
-- Rôle : mémoire factuelle d'une rencontre. 1 ligne = 1 observable
--        (essai, pénalité, carton, remplacement, blessure...).
--        Entité Core partagée (PI-5) : écrite par le Suivi,
--        relue par Rapport / Stats / Bilans. Source de vérité du
--        score (toujours recalculable, jamais stocké ici).
--
-- Périmètre de CE script (volontairement étroit — pas-à-pas C12) :
--   table + contraintes + index UNIQUEMENT.
--     • RLS / policies            -> C12-b  (NON inclus ici)
--     • RPC insert/annule/corrige -> C12-c
--     • RPC lecture               -> C12-d
--     • RPC score                 -> C12-e
--     • RPC lien éphémère + compo -> C12-f
--   La table n'est donc PAS sécurisée tant que C12-b n'est pas passé.
--
-- Pré-requis en base (vérifiés modélisation §10.1, déjà livrés) :
--   • evenements          (Phase 4.2)  -> FK evenement_uuid
--   • personnes           (socle)      -> FK joueur_uuid
--   • composition_joueurs.etat_joueur  (Phase 4.3) -> utilisé par C12-c
--
-- Patterns projet appliqués (Phase 4.2 / 4.3) :
--   • PK UUID DEFAULT gen_random_uuid()        (décision M-5)
--   • suffixe _uuid sur les FK                  (décision M-1)
--   • observable_id en TEXT, pas UUID           (décision M-2)
--   • CHECK nommés chronologie_suivi_<champ>_check (décision M-6)
--   • ON DELETE RESTRICT sur les 2 FK           (décisions Q1 / Q2)
--
-- Idempotent : ré-exécutable sans erreur (IF NOT EXISTS).
--   ⚠️ Vérifier au préalable que la table n'existe pas déjà avec un
--      schéma différent (STATE 16/05 : "modélisée v1.1, NON créée" —
--      donc première création attendue).
-- =====================================================================

CREATE TABLE IF NOT EXISTS chronologie_suivi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Rattachement à la rencontre. Pour un tournoi : TOUJOURS l'uuid
    -- du match enfant, JAMAIS du parent 'tournoi' (modélisation §8.2).
    -- ON DELETE RESTRICT (Q1) : un événement suivi ne se supprime pas ;
    -- l'annulation passe par evenements.etat='annule'.
    evenement_uuid UUID NOT NULL
        REFERENCES evenements(id) ON DELETE RESTRICT,

    -- Position temporelle dans la rencontre
    horodatage     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    minute_match   INTEGER,
    periode        INTEGER NOT NULL DEFAULT 1,

    -- Observable saisi (référentiel JSON Drive observables-match.json)
    observable_id  TEXT    NOT NULL,
    categorie_obs  TEXT    NOT NULL,
    valeur_points  INTEGER NOT NULL DEFAULT 0,

    -- Contexte de saisie
    mode_saisie       TEXT NOT NULL DEFAULT 'normal',
    equipe_concernee  TEXT NOT NULL DEFAULT 'notre',
    -- ON DELETE RESTRICT (Q2) : un joueur avec historique est protégé.
    -- NULL = pas de joueur identifié (voir COMMENT + contrainte DS-1).
    joueur_uuid       UUID
        REFERENCES personnes(id) ON DELETE RESTRICT,

    -- Traçabilité de l'auteur de la saisie
    saisi_par       TEXT,        -- id du lien éphémère (pas une FK personnes)
    saisi_par_role  TEXT NOT NULL DEFAULT 'benevole',
    source_saisie   TEXT NOT NULL DEFAULT 'live',
    timecode_video  INTERVAL,    -- NULL si pas issu du Mode Vidéo

    -- Annulation / correction (jamais de DELETE d'une saisie)
    annule       BOOLEAN     NOT NULL DEFAULT FALSE,
    corrigee_le  TIMESTAMPTZ,

    -- Métadonnée (pattern projet)
    date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ---- Contraintes de validité (CHECK nommés, pattern projet) ----
    CONSTRAINT chronologie_suivi_categorie_obs_check
        CHECK (categorie_obs IN ('A', 'B')),
    CONSTRAINT chronologie_suivi_mode_saisie_check
        CHECK (mode_saisie IN ('normal', 'expert')),
    CONSTRAINT chronologie_suivi_equipe_concernee_check
        CHECK (equipe_concernee IN ('notre', 'adverse')),
    CONSTRAINT chronologie_suivi_saisi_par_role_check
        CHECK (saisi_par_role IN ('benevole', 'coach')),
    CONSTRAINT chronologie_suivi_source_saisie_check
        CHECK (source_saisie IN ('live', 'video', 'correction')),
    CONSTRAINT chronologie_suivi_periode_check
        CHECK (periode >= 1),

    -- DS-1 (v1.1) : la SEULE combinaison réellement invalide est
    -- 'adverse' + joueur_uuid renseigné (un observable adverse ne
    -- référence jamais un joueur MOM = bug + fuite). Toutes les autres
    -- sont valides, dont 'notre' + NULL (cas D-7, bouton UX
    -- « Équipe / je ne sais pas »). Nom de contrainte CONSERVÉ depuis
    -- la v1 pour la traçabilité inter-documents (référencé par la
    -- conception UX et la modélisation).
    CONSTRAINT chronologie_suivi_adverse_sans_joueur CHECK (
        NOT (equipe_concernee = 'adverse' AND joueur_uuid IS NOT NULL)
    )
);

-- =====================================================================
-- Index (modélisation §4.2)
-- =====================================================================

-- Lecture principale : la chronologie d'UNE rencontre (Suivi live)
CREATE INDEX IF NOT EXISTS idx_chronologie_suivi_evenement
    ON chronologie_suivi (evenement_uuid);

-- Lecture avale : Rapport / Stats agrègent par joueur
CREATE INDEX IF NOT EXISTS idx_chronologie_suivi_joueur
    ON chronologie_suivi (joueur_uuid);

-- Filtrage Stats : ne comparer que le comparable (mode/catégorie)
CREATE INDEX IF NOT EXISTS idx_chronologie_suivi_categorie_obs
    ON chronologie_suivi (categorie_obs);

-- Perf live (H10-v2) : affichage de l'historique + recalcul du score
-- sans scanner les lignes annulées. Index PARTIEL.
CREATE INDEX IF NOT EXISTS idx_chronologie_suivi_live
    ON chronologie_suivi (evenement_uuid, horodatage)
    WHERE annule = FALSE;

-- =====================================================================
-- Documentation en base (COMMENT) — colonnes à sémantique non triviale
-- Pattern projet : cf. composition_joueurs.poste_uuid (modélisation §3.2)
-- =====================================================================

COMMENT ON TABLE chronologie_suivi IS
    'Memoire factuelle d''une rencontre (1 ligne = 1 observable). '
    'Entite Core partagee PI-5 : ecrite par Suivi, relue par '
    'Rapport/Stats/Bilans. Source de verite du score (recalculable, '
    'jamais stocke ici). Modelisation v1.1 (patch DS-1).';

COMMENT ON COLUMN chronologie_suivi.observable_id IS
    'Ref. referentiel JSON Drive observables-match.json (format '
    'obs-xxx). TEXT et non UUID car referentiel non migre Supabase '
    '(meme pattern que composition_joueurs.poste_uuid). Pas de FK SQL.';

COMMENT ON COLUMN chronologie_suivi.valeur_points IS
    'Points de cet observable (essai=5, transfo=2, pena=3...), 0 si '
    'non scorant. Le SCORE = SUM(valeur_points) des lignes non '
    'annulees, par equipe_concernee (jamais stocke : voir C12-e '
    'consolider_score_rencontre).';

COMMENT ON COLUMN chronologie_suivi.joueur_uuid IS
    'NULL = pas de joueur identifie. Desambiguise par '
    'equipe_concernee (DS-1 v1.1) : adverse+NULL = action adverse ; '
    'notre+NULL = notre marqueur non identifie (cas D-7). '
    'adverse+renseigne = INTERDIT (contrainte '
    'chronologie_suivi_adverse_sans_joueur).';

COMMENT ON COLUMN chronologie_suivi.mode_saisie IS
    'Capacite du moment (normal|expert), PAS un statut de personne. '
    'Par ligne : peut changer en cours de rencontre (modélisation §8.6).';

COMMENT ON COLUMN chronologie_suivi.annule IS
    'TRUE = ligne annulee mais CONSERVEE (jamais de DELETE d''une '
    'saisie : on trace l''erreur). Exclue des calculs de score.';

-- =====================================================================
-- FIN C12-a. Prochaine dette : C12-b (RLS + policies, modélisation §5).
-- La table n'est PAS encore securisee : ne pas l'exposer avant C12-b.
-- =====================================================================
