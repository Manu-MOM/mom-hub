-- =====================================================================
-- MOM HUB · sql/29-rpc-evenements-c9.sql
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-15
-- Version : 1.0
--
-- Clôture les dettes C9-a / C9-b / C9-d issues de l'audit Évènements
-- (Audit-Module-Evenements-v1.md §8) et de la conception UI Évènements
-- (Conception-Portail-UI-Evenements.md §5.2 Q5 — pastilles statut compo).
--
-- ─────────────────────────────────────────────────────────────────────
-- Livrables de ce fichier
-- ─────────────────────────────────────────────────────────────────────
--   1. MODIFIE  get_evenements_a_venir
--                 → ajout colonne compo_status_summary JSONB
--                 → DROP + CREATE obligatoire (changement RETURNS TABLE)
--   2. MODIFIE  get_prochain_evenement_par_equipe
--                 → hérite la nouvelle signature à 17 colonnes
--   3. CRÉE    get_evenements_passes         (dette C9-a)
--                 → symétrique de a_venir, ORDER BY date_debut DESC
--                 → inclut 'annule' (cohérent UX doc Conception §3.5)
--                 → exclut 'archive' seulement
--   4. CRÉE    get_evenement_with_encadrants (dette C9-b)
--                 → 1 ligne événement + array JSONB des encadrants
--                 → joint personnes pour nom/prénom
--                 → tri encadrants : ordre NULLS LAST, puis date_creation
--
-- ─────────────────────────────────────────────────────────────────────
-- Doctrine appliquée (dette C9-d — arbitrage)
-- ─────────────────────────────────────────────────────────────────────
-- • compo_status_summary : V1 SIMPLE SANS RÉCURSION SERVEUR.
--   JSONB { total, brouillon, validee, utilisee }
--   Filtres : c.cote='mom' AND c.est_active=TRUE
--   Pas d'agrégation parent → enfants côté serveur. Pour un tournoi
--   parent, la valeur sera {0,0,0,0}. L'agrégat parent↔enfants est
--   fait par le client UI à l'affichage (P1 simplicité, trivial en JS).
--
-- • Filtres etat divergents (à harmoniser ultérieurement si besoin) :
--   - get_evenements_a_venir   : exclut 'annule' ET 'archive'
--                                 (comportement Phase 4.2.B CONSERVÉ)
--   - get_evenements_passes    : exclut 'archive' SEULEMENT
--                                 (les 'annule' restent visibles barrés
--                                  dans la liste, cohérent doc Conception §3.5)
--   - get_evenement_with_encadrants : aucun filtre etat (fiche détail
--                                 doit fonctionner même sur un événement
--                                 annulé ou archivé)
--
-- ─────────────────────────────────────────────────────────────────────
-- Sécurité (identique aux RPC existantes Phase 4.2.B)
-- ─────────────────────────────────────────────────────────────────────
-- LANGUAGE sql · SECURITY DEFINER · search_path = public · STABLE
-- REVOKE EXECUTE FROM PUBLIC, anon · GRANT EXECUTE TO authenticated
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotence
-- ─────────────────────────────────────────────────────────────────────
-- DROP IF EXISTS au début de la transaction → ce fichier est ré-exécutable
-- proprement. Si exécution ne couvre que ce fichier, les wrappers JS
-- v1.8.4 actuels (qui n'attendent QUE les 16 colonnes existantes)
-- continueront à fonctionner — PostgREST tolère les colonnes en plus
-- dans la réponse JSON. Le wrapper v1.9 (sql/29 + js/supabase-client.js
-- bumpé) exposera la nouvelle colonne compo_status_summary.
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 0 · DROP des RPC à recréer (ordre dépendance respecté)
-- =====================================================================
-- get_prochain_evenement_par_equipe appelle get_evenements_a_venir
-- dans son corps SQL, donc on drop d'abord le wrapper, puis la fonction
-- de base. CASCADE évité pour rester explicite.

DROP FUNCTION IF EXISTS public.get_prochain_evenement_par_equipe(UUID);
DROP FUNCTION IF EXISTS public.get_evenements_a_venir(UUID, INTEGER);


-- =====================================================================
-- 1 · get_evenements_a_venir (MODIFIÉE — ajout compo_status_summary)
-- =====================================================================
-- Mêmes paramètres que la version Phase 4.2.B.
-- Retour : 17 colonnes (16 existantes + 1 nouvelle compo_status_summary).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_evenements_a_venir(
  p_equipe_id     UUID    DEFAULT NULL,
  p_jours_a_venir INTEGER DEFAULT 30
)
RETURNS TABLE (
  id                       UUID,
  code                     TEXT,
  libelle                  TEXT,
  type_evenement           TEXT,
  type_competition         TEXT,
  date_debut               TIMESTAMPTZ,
  date_fin                 TIMESTAMPTZ,
  equipe_id                UUID,
  equipe_libelle_court     TEXT,
  site_id                  UUID,
  site_libelle_court       TEXT,
  format_de_jeu            TEXT,
  etat                     TEXT,
  adversaire_nom           TEXT,
  domicile_exterieur       TEXT,
  jours_jusqu_a_evenement  INTEGER,
  compo_status_summary     JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.id,
    e.code,
    e.libelle,
    e.type_evenement,
    e.type_competition,
    e.date_debut,
    e.date_fin,
    e.equipe_id,
    eq.libelle_court AS equipe_libelle_court,
    e.site_id,
    si.libelle_court AS site_libelle_court,
    e.format_de_jeu,
    e.etat,
    e.adversaire_nom,
    e.domicile_exterieur,
    EXTRACT(DAY FROM (e.date_debut - NOW()))::INTEGER AS jours_jusqu_a_evenement,
    (
      SELECT jsonb_build_object(
        'total',     COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat = 'brouillon'),
        'validee',   COUNT(*) FILTER (WHERE c.etat = 'validee'),
        'utilisee',  COUNT(*) FILTER (WHERE c.etat = 'utilisee')
      )
      FROM compositions c
      WHERE c.evenement_id = e.id
        AND c.cote        = 'mom'
        AND c.est_active  = TRUE
    ) AS compo_status_summary
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.date_debut >= NOW()
    AND e.date_debut <= NOW() + make_interval(days => p_jours_a_venir)
    AND e.etat NOT IN ('annule', 'archive')
    AND (p_equipe_id IS NULL OR e.equipe_id = p_equipe_id)
  ORDER BY e.date_debut ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_evenements_a_venir(UUID, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_evenements_a_venir(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_evenements_a_venir(UUID, INTEGER) IS
'Phase 4.2.B + C9-d — Liste événements à venir, filtrable par équipe. Ajout colonne compo_status_summary JSONB pour pastilles statut compo UI. Exclut annule/archive (comportement Phase 4.2.B conservé).';


-- =====================================================================
-- 2 · get_prochain_evenement_par_equipe (RECRÉÉE — nouvelle signature)
-- =====================================================================
-- Wrapper de get_evenements_a_venir, LIMIT 1. Hérite des 17 colonnes.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_prochain_evenement_par_equipe(
  p_equipe_id UUID
)
RETURNS TABLE (
  id                       UUID,
  code                     TEXT,
  libelle                  TEXT,
  type_evenement           TEXT,
  type_competition         TEXT,
  date_debut               TIMESTAMPTZ,
  date_fin                 TIMESTAMPTZ,
  equipe_id                UUID,
  equipe_libelle_court     TEXT,
  site_id                  UUID,
  site_libelle_court       TEXT,
  format_de_jeu            TEXT,
  etat                     TEXT,
  adversaire_nom           TEXT,
  domicile_exterieur       TEXT,
  jours_jusqu_a_evenement  INTEGER,
  compo_status_summary     JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.get_evenements_a_venir(p_equipe_id, 365) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_prochain_evenement_par_equipe(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_prochain_evenement_par_equipe(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_prochain_evenement_par_equipe(UUID) IS
'Phase 4.2.B + C9-d — Prochain événement d''une équipe (0 ou 1 ligne). Hérite des 17 colonnes de get_evenements_a_venir incluant compo_status_summary.';


-- =====================================================================
-- 3 · get_evenements_passes (NOUVELLE — dette C9-a)
-- =====================================================================
-- Symétrique de get_evenements_a_venir pour la vue Liste E1 (audit §8).
-- ORDER BY date_debut DESC : les plus récents en haut.
-- Inclut 'annule' (cohérent doc Conception §3.5 — événements annulés
-- restent visibles dans la liste, affichés barrés).
-- Exclut 'archive' (état explicite de sortie de circulation).
--
-- Paramètres :
--   p_equipe_id     UUID    (default NULL) — filtre équipe, NULL = toutes
--   p_jours_passes  INTEGER (default 30)   — fenêtre temporelle passée
--   p_limit         INTEGER (default 50)   — plafond résultats (perf)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_evenements_passes(
  p_equipe_id    UUID    DEFAULT NULL,
  p_jours_passes INTEGER DEFAULT 30,
  p_limit        INTEGER DEFAULT 50
)
RETURNS TABLE (
  id                       UUID,
  code                     TEXT,
  libelle                  TEXT,
  type_evenement           TEXT,
  type_competition         TEXT,
  date_debut               TIMESTAMPTZ,
  date_fin                 TIMESTAMPTZ,
  equipe_id                UUID,
  equipe_libelle_court     TEXT,
  site_id                  UUID,
  site_libelle_court       TEXT,
  format_de_jeu            TEXT,
  etat                     TEXT,
  adversaire_nom           TEXT,
  domicile_exterieur       TEXT,
  jours_depuis_evenement   INTEGER,
  compo_status_summary     JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.id,
    e.code,
    e.libelle,
    e.type_evenement,
    e.type_competition,
    e.date_debut,
    e.date_fin,
    e.equipe_id,
    eq.libelle_court AS equipe_libelle_court,
    e.site_id,
    si.libelle_court AS site_libelle_court,
    e.format_de_jeu,
    e.etat,
    e.adversaire_nom,
    e.domicile_exterieur,
    EXTRACT(DAY FROM (NOW() - e.date_debut))::INTEGER AS jours_depuis_evenement,
    (
      SELECT jsonb_build_object(
        'total',     COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat = 'brouillon'),
        'validee',   COUNT(*) FILTER (WHERE c.etat = 'validee'),
        'utilisee',  COUNT(*) FILTER (WHERE c.etat = 'utilisee')
      )
      FROM compositions c
      WHERE c.evenement_id = e.id
        AND c.cote        = 'mom'
        AND c.est_active  = TRUE
    ) AS compo_status_summary
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.date_debut <  NOW()
    AND e.date_debut >= NOW() - make_interval(days => p_jours_passes)
    AND e.etat NOT IN ('archive')
    AND (p_equipe_id IS NULL OR e.equipe_id = p_equipe_id)
  ORDER BY e.date_debut DESC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.get_evenements_passes(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_evenements_passes(UUID, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_evenements_passes(UUID, INTEGER, INTEGER) IS
'C9-a — Liste événements passés, filtrable par équipe. Symétrique de get_evenements_a_venir. Inclut annule (visible barré dans liste UI), exclut archive. ORDER BY date_debut DESC, plafond p_limit.';


-- =====================================================================
-- 4 · get_evenement_with_encadrants (NOUVELLE — dette C9-b)
-- =====================================================================
-- Retourne un événement (toutes colonnes utiles à la fiche E2) + son
-- array d'encadrants enrichi (nom, prénom, rôles, ordre, notes).
--
-- Aucun filtre etat : la fiche détaillée doit pouvoir s'ouvrir même
-- pour un événement annulé ou archivé (cas réactivation, audit).
--
-- Paramètre :
--   p_evenement_id  UUID (obligatoire)
--
-- Retour : 0 ou 1 ligne. 18 colonnes (17 standard + encadrants JSONB).
--
-- Format de la colonne encadrants :
--   [
--     {
--       "personne_id": "uuid",
--       "nom": "JUNG",
--       "prenom": "Emmanuel",
--       "roles_encadrement": ["coach_principal"],
--       "ordre": 1,
--       "notes": null
--     },
--     ...
--   ]
--
-- Tri encadrants : ordre NULLS LAST, puis date_creation ASC pour ex-aequo.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_evenement_with_encadrants(
  p_evenement_id UUID
)
RETURNS TABLE (
  id                       UUID,
  code                     TEXT,
  libelle                  TEXT,
  type_evenement           TEXT,
  type_competition         TEXT,
  date_debut               TIMESTAMPTZ,
  date_fin                 TIMESTAMPTZ,
  equipe_id                UUID,
  equipe_libelle_court     TEXT,
  site_id                  UUID,
  site_libelle_court       TEXT,
  format_de_jeu            TEXT,
  etat                     TEXT,
  adversaire_nom           TEXT,
  domicile_exterieur       TEXT,
  evenement_parent_id      UUID,
  phase_libelle            TEXT,
  ordre_dans_phase         INTEGER,
  score_mom                INTEGER,
  score_adverse            INTEGER,
  logistique_deplacement   JSONB,
  notes_internes           TEXT,
  compo_status_summary     JSONB,
  encadrants               JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.id,
    e.code,
    e.libelle,
    e.type_evenement,
    e.type_competition,
    e.date_debut,
    e.date_fin,
    e.equipe_id,
    eq.libelle_court AS equipe_libelle_court,
    e.site_id,
    si.libelle_court AS site_libelle_court,
    e.format_de_jeu,
    e.etat,
    e.adversaire_nom,
    e.domicile_exterieur,
    e.evenement_parent_id,
    e.phase_libelle,
    e.ordre_dans_phase,
    e.score_mom,
    e.score_adverse,
    e.logistique_deplacement,
    e.notes_internes,
    (
      SELECT jsonb_build_object(
        'total',     COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat = 'brouillon'),
        'validee',   COUNT(*) FILTER (WHERE c.etat = 'validee'),
        'utilisee',  COUNT(*) FILTER (WHERE c.etat = 'utilisee')
      )
      FROM compositions c
      WHERE c.evenement_id = e.id
        AND c.cote        = 'mom'
        AND c.est_active  = TRUE
    ) AS compo_status_summary,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'personne_id',       ee.personne_id,
            'nom',               p.nom,
            'prenom',            p.prenom,
            'roles_encadrement', ee.roles_encadrement,
            'ordre',             ee.ordre,
            'notes',             ee.notes
          )
          ORDER BY ee.ordre NULLS LAST, ee.date_creation ASC
        )
        FROM evenement_encadrants ee
        JOIN personnes p ON p.id = ee.personne_id
        WHERE ee.evenement_id = e.id
      ),
      '[]'::jsonb
    ) AS encadrants
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.id = p_evenement_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_evenement_with_encadrants(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_evenement_with_encadrants(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_evenement_with_encadrants(UUID) IS
'C9-b — Fiche événement détaillée avec liste enrichie des encadrants (nom, prénom, rôles, ordre, notes) en JSONB. Aucun filtre etat (utilisable sur événement annulé ou archivé). Tri encadrants : ordre NULLS LAST.';


-- =====================================================================
-- Vérification structurelle post-création
-- =====================================================================

DO $$
DECLARE
  v_nb_rpc          INTEGER;
  v_avenir_cols     INTEGER;
  v_passes_cols     INTEGER;
  v_encadrants_cols INTEGER;
BEGIN
  -- 4 RPC attendues
  SELECT COUNT(*) INTO v_nb_rpc
  FROM pg_proc
  WHERE proname IN (
    'get_evenements_a_venir',
    'get_prochain_evenement_par_equipe',
    'get_evenements_passes',
    'get_evenement_with_encadrants'
  );

  -- Compteurs colonnes des RETURNS TABLE (via pg_get_function_result)
  -- Approximation : on compte les virgules dans la signature retour.
  -- Suffit pour un check de non-régression structurelle.

  SELECT (LENGTH(pg_get_function_result(oid)) -
          LENGTH(REPLACE(pg_get_function_result(oid), ',', '')) + 1)
    INTO v_avenir_cols
  FROM pg_proc WHERE proname = 'get_evenements_a_venir' LIMIT 1;

  SELECT (LENGTH(pg_get_function_result(oid)) -
          LENGTH(REPLACE(pg_get_function_result(oid), ',', '')) + 1)
    INTO v_passes_cols
  FROM pg_proc WHERE proname = 'get_evenements_passes' LIMIT 1;

  SELECT (LENGTH(pg_get_function_result(oid)) -
          LENGTH(REPLACE(pg_get_function_result(oid), ',', '')) + 1)
    INTO v_encadrants_cols
  FROM pg_proc WHERE proname = 'get_evenement_with_encadrants' LIMIT 1;

  RAISE NOTICE '────────────────────────────────────────────────────────';
  RAISE NOTICE '✅ C9-a/b/d — RPC événements';
  RAISE NOTICE '   Nombre de RPC créées        : % (attendu 4)', v_nb_rpc;
  RAISE NOTICE '   get_evenements_a_venir cols : % (attendu 17)', v_avenir_cols;
  RAISE NOTICE '   get_evenements_passes  cols : % (attendu 17)', v_passes_cols;
  RAISE NOTICE '   get_event_w_encadrants cols : % (attendu 24)', v_encadrants_cols;
  RAISE NOTICE '────────────────────────────────────────────────────────';
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel (si problème détecté après COMMIT) :
--
--   DROP FUNCTION IF EXISTS public.get_evenement_with_encadrants(UUID);
--   DROP FUNCTION IF EXISTS public.get_evenements_passes(UUID, INTEGER, INTEGER);
--   DROP FUNCTION IF EXISTS public.get_prochain_evenement_par_equipe(UUID);
--   DROP FUNCTION IF EXISTS public.get_evenements_a_venir(UUID, INTEGER);
--
--   -- Puis ré-exécuter sql/11-rpc-evenements.sql pour restaurer la
--   -- version Phase 4.2.B (16 colonnes, sans compo_status_summary).
-- =====================================================================
