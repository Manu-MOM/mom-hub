-- ============================================================================
-- sql/28-seances.sql — Module Préparation de séance V1
-- Phase 5.1 de la conv « Production Module Préparation de séance »
--
-- Auteur : conv Production Module Préparation de séance
-- Date   : 14 mai 2026
-- Brief  : Brief-Conception-Module-Preparation-Seance-v1.md
--          (Drive 00 - Documentation/, fileId 132DT2Ps0usznZ4LXH2ohz_ubFUygpm-T)
-- ============================================================================
--
-- CONTENU
--   §1. Table seances                 — méta de séance + flag modèle
--   §2. Table seances_blocs           — blocs chronologiques d'une séance
--   §3. Table seances_blocs_ateliers  — rattachement N-N vers fiches Bibliothèque
--   §4. RLS                           — lecture authentifié + écriture admin OR coach
--   §5. RPC                           — get_seances_a_venir + get_seance_complete
--   §6. Smoke tests                   — INSERT séance + bloc + atelier + SELECT + DELETE
--
-- ============================================================================
-- HYPOTHÈSES DE NOMMAGE — à vérifier 30 secondes avant d'exécuter le script.
-- ----------------------------------------------------------------------------
--   H1 — Helper RLS `public.has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER`
--        existe (mentionné dans le brief §3 RLS et dans le kickoff §5).
--   H2 — Fonction trigger `public.trigger_set_updated_at() RETURNS TRIGGER`
--        existe (mentionné dans le brief §3 et dans le kickoff §5).
--   H3 — Les tables référencées ont une PK uuid nommée `id` :
--          public.equipes(id), public.evenements(id), public.sites(id).
--   H4 — `gen_random_uuid()` est utilisé pour les PK uuid (extension pgcrypto,
--        activée par défaut sur Supabase). Si les autres tables utilisent
--        `uuid_generate_v4()`, faire un SED global avant exécution.
--
-- Si une hypothèse est fausse, un SED global suffit avant exécution.
-- ============================================================================

BEGIN;


-- ============================================================================
-- §1. TABLE seances
-- ============================================================================
-- Une séance d'entraînement préparée par un coach pour son équipe.
-- Une séance peut être :
--   * une vraie séance datée (est_modele = FALSE, date_seance NOT NULL)
--   * un modèle réutilisable (est_modele = TRUE, date_seance NULL) — V2
-- Le rattachement à un événement est optionnel (cf. arbitrage Q3 du brief).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seances (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id              uuid         NOT NULL REFERENCES public.equipes(id),
  evenement_id           uuid         NULL REFERENCES public.evenements(id),
  date_seance            date         NULL,
  heure_debut            time         NULL,
  duree_totale_min       int          NOT NULL DEFAULT 75,
  effectif_prevu         int          NULL,
  lieu_id                uuid         NULL REFERENCES public.sites(id),
  meteo_text             text         NULL,
  encadrants_text        text         NULL,
  axe_travail_general    text         NULL,
  theme_principal        text         NULL,
  objectifs_text         text         NULL,
  bloc_cycle             text         NULL,
  materiel_global_text   text         NULL,
  etat                   text         NOT NULL DEFAULT 'brouillon'
                                       CHECK (etat IN ('brouillon','validee','utilisee','archivee')),
  est_modele             boolean      NOT NULL DEFAULT FALSE,
  modele_origine_id      uuid         NULL REFERENCES public.seances(id),
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  created_by             uuid         NULL REFERENCES auth.users(id),
  -- Garde-fou cohérence modèle vs séance datée
  CONSTRAINT seances_modele_vs_date_chk CHECK (
    (est_modele = TRUE  AND date_seance IS NULL)
    OR
    (est_modele = FALSE)
  )
);

COMMENT ON TABLE  public.seances IS
  'Séances d''entraînement préparées par un coach. Une séance peut être une vraie séance datée ou un modèle réutilisable (est_modele = TRUE).';

COMMENT ON COLUMN public.seances.evenement_id IS
  'Rattachement optionnel à un entraînement existant (arbitrage Q3 brief). NULL si séance exploratoire indépendante.';

COMMENT ON COLUMN public.seances.est_modele IS
  'TRUE = modèle réutilisable (date_seance NULL). FALSE = vraie séance datée. UI modèles différée V2 mais schéma prêt en V1 (arbitrage Q6 brief).';

COMMENT ON COLUMN public.seances.modele_origine_id IS
  'Si la séance a été créée à partir d''un modèle, pointe vers ce modèle pour traçabilité.';

COMMENT ON COLUMN public.seances.etat IS
  'Cycle de vie : brouillon -> validee -> utilisee -> archivee. Pattern identique aux compositions Phase 4.4.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seances_equipe_id      ON public.seances(equipe_id);
CREATE INDEX IF NOT EXISTS idx_seances_evenement_id   ON public.seances(evenement_id) WHERE evenement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seances_date_seance    ON public.seances(date_seance)  WHERE date_seance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seances_est_modele     ON public.seances(est_modele);
CREATE INDEX IF NOT EXISTS idx_seances_etat           ON public.seances(etat);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_seances_set_updated_at ON public.seances;
CREATE TRIGGER trg_seances_set_updated_at
  BEFORE UPDATE ON public.seances
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();


-- ============================================================================
-- §2. TABLE seances_blocs
-- ============================================================================
-- Un bloc chronologique appartient à une séance. Une séance a 0..N blocs,
-- triés par `ordre` croissant. Cf. arbitrage Q4 du brief : 11 types de blocs.
-- L'intensité (4 niveaux, arbitrage Q5) est nullable car certains blocs
-- (Accueil, Pause, Bilan, Retour au calme, Bloc libre) n'en ont pas besoin.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seances_blocs (
  id                              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  seance_id                       uuid         NOT NULL REFERENCES public.seances(id) ON DELETE CASCADE,
  ordre                           int          NOT NULL,
  type_bloc                       text         NOT NULL
                                                CHECK (type_bloc IN (
                                                  'accueil',
                                                  'mise_en_train',
                                                  'echauffement',
                                                  'echauffement_specifique',
                                                  'corps_seance',
                                                  'jeu_application',
                                                  'match_application',
                                                  'retour_au_calme',
                                                  'bilan',
                                                  'pause_boisson',
                                                  'bloc_libre'
                                                )),
  titre_precision                 text         NULL,
  duree_min                       int          NOT NULL CHECK (duree_min > 0 AND duree_min <= 240),
  intensite                       text         NULL
                                                CHECK (intensite IN (
                                                  'sans_contact',
                                                  'toucher_ceinture',
                                                  'contact_controle',
                                                  'live_combat_reel'
                                                )),
  etiquette_axe2                  text         NULL,
  etiquette_axe3                  text         NULL,
  comportements_attendus          text         NULL,
  organisation_spatio_temporelle  text         NULL,
  groupes_jsonb                   jsonb        NOT NULL DEFAULT '[]'::jsonb,
  materiel_jsonb                  jsonb        NOT NULL DEFAULT '[]'::jsonb,
  contenu_pedagogique_axe4        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  notes_bloc                      text         NULL,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_at                      timestamptz  NOT NULL DEFAULT now(),
  -- Un ordre est unique au sein d'une séance (évite les collisions)
  CONSTRAINT seances_blocs_seance_ordre_uniq UNIQUE (seance_id, ordre)
);

COMMENT ON TABLE  public.seances_blocs IS
  'Blocs chronologiques d''une séance. Triés par `ordre` croissant. 11 types possibles (Axe 1 Vocabulaire MOM Hub, arbitrage Q4 brief).';

COMMENT ON COLUMN public.seances_blocs.type_bloc IS
  '11 types alignés sur les 9 phases macro FFR + 2 utilitaires (pause_boisson, bloc_libre).';

COMMENT ON COLUMN public.seances_blocs.intensite IS
  '4 niveaux gradation contact, alignés FFR + World Rugby Contact Load Guidelines 2021 (arbitrage Q5 brief). NULL = bloc non sportif (accueil, bilan, etc.).';

COMMENT ON COLUMN public.seances_blocs.etiquette_axe2 IS
  'Étiquette libre Axe 2 du Vocabulaire (Types d''unités : atelier, jeu_reduit, opposition, situation_globale, ...). Texte libre côté DB, contrôle des valeurs côté JS.';

COMMENT ON COLUMN public.seances_blocs.etiquette_axe3 IS
  'Étiquette libre Axe 3 du Vocabulaire (Composants échauffement : mobilisation, gammes_athletiques, ...). Texte libre côté DB.';

COMMENT ON COLUMN public.seances_blocs.groupes_jsonb IS
  'Tableau de groupes : [{"nom": "G1", "joueurs": ["uuid", ...]}, ...]. Choix JSONB (et pas table normalisée) pour V1 : simplicité doctrine.';

COMMENT ON COLUMN public.seances_blocs.materiel_jsonb IS
  'Tableau de tags matériel : ["Cônes", "Plots", "Ballons", ...]. Pondération différée V2 (D-SEANCE D-J).';

COMMENT ON COLUMN public.seances_blocs.contenu_pedagogique_axe4 IS
  'Objet structuré Axe 4 du Vocabulaire (10 champs FFR : objectif, but, consigne, cr, ...). Ex : {"objectif": "...", "consigne": "...", "cr": "..."}.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seances_blocs_seance_id     ON public.seances_blocs(seance_id);
CREATE INDEX IF NOT EXISTS idx_seances_blocs_seance_ordre  ON public.seances_blocs(seance_id, ordre);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_seances_blocs_set_updated_at ON public.seances_blocs;
CREATE TRIGGER trg_seances_blocs_set_updated_at
  BEFORE UPDATE ON public.seances_blocs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();


-- ============================================================================
-- §3. TABLE seances_blocs_ateliers
-- ============================================================================
-- Rattachement N-N entre un bloc de séance et 1 ou plusieurs fiches de la
-- Bibliothèque d'ateliers (62 fiches Drive en V1). La clé étrangère logique
-- est `atelier_fileid_drive` (33 caractères, fileId Drive du dossier de fiche).
--
-- NOTE — Pas de FK PostgreSQL stricte : le module Bibliothèque actuel stocke
-- ses fiches dans Drive + miroir JSON (`data/fiches-all.json`). À l'arrivée
-- de la future table Supabase `ateliers` (dette D-BIBLIO-V2-MIGRATION, bascule
-- Scénario 2 -> Scénario 3 de la conv Bibliothèque), une FK pourra être
-- ajoutée. En attendant, on vérifie au moins le format (33 caractères).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seances_blocs_ateliers (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  bloc_id                uuid         NOT NULL REFERENCES public.seances_blocs(id) ON DELETE CASCADE,
  atelier_fileid_drive   text         NOT NULL CHECK (length(atelier_fileid_drive) = 33),
  ordre                  int          NOT NULL DEFAULT 1,
  notes_atelier          text         NULL,
  created_at             timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.seances_blocs_ateliers IS
  'Rattachement N-N bloc <-> fiche Bibliothèque. FK logique vers fileId Drive (33 caractères). FK stricte en attente de la table Supabase ateliers (dette D-BIBLIO-V2-MIGRATION).';

COMMENT ON COLUMN public.seances_blocs_ateliers.atelier_fileid_drive IS
  'fileId Drive du dossier de la fiche (33 caractères), correspond à `fileId_dossier` du schéma atelier-json v2.0.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sba_bloc_id   ON public.seances_blocs_ateliers(bloc_id);
CREATE INDEX IF NOT EXISTS idx_sba_atelier   ON public.seances_blocs_ateliers(atelier_fileid_drive);


-- ============================================================================
-- §4. RLS — Lecture authentifié + Écriture admin OR coach
-- ============================================================================
-- Pattern identique à Compositions Phase 4.4 (sql/26-rls-write-compositions-presences.sql).
-- Lecture : tout utilisateur authentifié (admin / coach / viewer).
-- Écriture : admin OR coach uniquement (via helper public.has_role).
-- ----------------------------------------------------------------------------

ALTER TABLE public.seances                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seances_blocs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seances_blocs_ateliers  ENABLE ROW LEVEL SECURITY;

-- --- Lecture authentifié --------------------------------------------------
DROP POLICY IF EXISTS seances_select_authenticated                ON public.seances;
DROP POLICY IF EXISTS seances_blocs_select_authenticated          ON public.seances_blocs;
DROP POLICY IF EXISTS seances_blocs_ateliers_select_authenticated ON public.seances_blocs_ateliers;

CREATE POLICY seances_select_authenticated
  ON public.seances
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY seances_blocs_select_authenticated
  ON public.seances_blocs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY seances_blocs_ateliers_select_authenticated
  ON public.seances_blocs_ateliers
  FOR SELECT
  TO authenticated
  USING (true);

-- --- Écriture admin OR coach ----------------------------------------------
-- 4 verbes par table (INSERT / UPDATE / DELETE) regroupés dans une policy ALL.
DROP POLICY IF EXISTS seances_write_admin_coach                ON public.seances;
DROP POLICY IF EXISTS seances_blocs_write_admin_coach          ON public.seances_blocs;
DROP POLICY IF EXISTS seances_blocs_ateliers_write_admin_coach ON public.seances_blocs_ateliers;

CREATE POLICY seances_write_admin_coach
  ON public.seances
  FOR ALL
  TO authenticated
  USING      (public.has_role('admin') OR public.has_role('coach'))
  WITH CHECK (public.has_role('admin') OR public.has_role('coach'));

CREATE POLICY seances_blocs_write_admin_coach
  ON public.seances_blocs
  FOR ALL
  TO authenticated
  USING      (public.has_role('admin') OR public.has_role('coach'))
  WITH CHECK (public.has_role('admin') OR public.has_role('coach'));

CREATE POLICY seances_blocs_ateliers_write_admin_coach
  ON public.seances_blocs_ateliers
  FOR ALL
  TO authenticated
  USING      (public.has_role('admin') OR public.has_role('coach'))
  WITH CHECK (public.has_role('admin') OR public.has_role('coach'));


-- ============================================================================
-- §5. RPC — get_seances_a_venir + get_seance_complete
-- ============================================================================

-- --- 5.1 get_seances_a_venir ----------------------------------------------
-- Liste les séances futures (vraies séances, pas modèles) d'une équipe sur
-- une fenêtre de J+0 à J+p_jours_a_venir, hors séances archivées.
-- Utilisée par la sidebar « Mes séances récentes » + widget portail.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_seances_a_venir(
  p_equipe_id        uuid,
  p_jours_a_venir    int DEFAULT 14
)
RETURNS TABLE (
  id                    uuid,
  date_seance           date,
  heure_debut           time,
  duree_totale_min      int,
  axe_travail_general   text,
  etat                  text,
  nb_blocs              int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.date_seance,
    s.heure_debut,
    s.duree_totale_min,
    s.axe_travail_general,
    s.etat,
    (
      SELECT COUNT(*)::int
      FROM public.seances_blocs sb
      WHERE sb.seance_id = s.id
    ) AS nb_blocs
  FROM public.seances s
  WHERE s.equipe_id    = p_equipe_id
    AND s.est_modele   = FALSE
    AND s.date_seance IS NOT NULL
    AND s.date_seance >= CURRENT_DATE
    AND s.date_seance <= CURRENT_DATE + p_jours_a_venir
    AND s.etat       <> 'archivee'
  ORDER BY s.date_seance ASC, s.heure_debut ASC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_seances_a_venir(uuid, int) IS
  'Séances futures (J+0 à J+N, défaut 14j) d''une équipe, hors modèles et hors archivées. Utilisée par la sidebar Préparation de séance.';

GRANT EXECUTE ON FUNCTION public.get_seances_a_venir(uuid, int) TO authenticated;


-- --- 5.2 get_seance_complete -----------------------------------------------
-- Récupère une séance, ses blocs (ordonnés) et les ateliers rattachés à
-- chaque bloc, dans un seul objet JSONB. Utilisée à l'ouverture d'une séance
-- dans l'éditeur (1 appel = tout le contexte).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_seance_complete(
  p_seance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'seance', to_jsonb(s.*),
    'blocs',  COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(sb.*) || jsonb_build_object(
            'ateliers', COALESCE(
              (
                SELECT jsonb_agg(to_jsonb(sba.*) ORDER BY sba.ordre)
                FROM public.seances_blocs_ateliers sba
                WHERE sba.bloc_id = sb.id
              ),
              '[]'::jsonb
            )
          )
          ORDER BY sb.ordre
        )
        FROM public.seances_blocs sb
        WHERE sb.seance_id = s.id
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.seances s
  WHERE s.id = p_seance_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_seance_complete(uuid) IS
  'Charge une séance + ses blocs (ordonnés) + les ateliers rattachés à chaque bloc dans un seul JSONB. 1 appel = tout le contexte de l''éditeur.';

GRANT EXECUTE ON FUNCTION public.get_seance_complete(uuid) TO authenticated;


COMMIT;


-- ============================================================================
-- §6. SMOKE TESTS — à exécuter MANUELLEMENT après le COMMIT ci-dessus
-- ============================================================================
-- Ces tests sont commentés. Pour les exécuter :
--   1) Décommenter le bloc DO + le bloc SELECT
--   2) Remplacer la valeur de `v_equipe_id` par l'UUID réel M14 EQ1 (à récupérer
--      via SELECT id FROM public.equipes WHERE nom_court = 'M14 EQ1' ou équivalent)
--   3) Exécuter
--   4) Vérifier que les SELECT de fin retournent les bons compteurs
--   5) Décommenter le bloc DELETE pour nettoyer
-- ----------------------------------------------------------------------------

/*
-- ---- Création d'une séance test + 2 blocs + 1 atelier ---------------------
DO $$
DECLARE
  v_equipe_id  uuid := '00000000-0000-0000-0000-000000000000'; -- ⚠️ À remplacer
  v_seance_id  uuid;
  v_bloc1_id   uuid;
  v_bloc2_id   uuid;
BEGIN
  -- 1) Créer une séance datée
  INSERT INTO public.seances (
    equipe_id, date_seance, heure_debut, duree_totale_min,
    axe_travail_general, etat
  ) VALUES (
    v_equipe_id, CURRENT_DATE + 3, '18:30', 90,
    'SMOKE TEST — Défense au sol', 'brouillon'
  )
  RETURNING id INTO v_seance_id;

  -- 2) Ajouter 2 blocs
  INSERT INTO public.seances_blocs (
    seance_id, ordre, type_bloc, titre_precision, duree_min, intensite
  ) VALUES (
    v_seance_id, 1, 'echauffement', 'SMOKE TEST — Mobilisation', 15, 'sans_contact'
  )
  RETURNING id INTO v_bloc1_id;

  INSERT INTO public.seances_blocs (
    seance_id, ordre, type_bloc, titre_precision, duree_min, intensite
  ) VALUES (
    v_seance_id, 2, 'corps_seance', 'SMOKE TEST — Plaquage technique', 30, 'contact_controle'
  )
  RETURNING id INTO v_bloc2_id;

  -- 3) Rattacher un atelier fictif (33 caractères) au bloc 2
  INSERT INTO public.seances_blocs_ateliers (
    bloc_id, atelier_fileid_drive, ordre
  ) VALUES (
    v_bloc2_id, '1AbcDefGhiJklMnoPqrStuVwxYz0123456', 1
  );

  RAISE NOTICE 'SMOKE TEST OK — séance % avec blocs (%, %)', v_seance_id, v_bloc1_id, v_bloc2_id;
END
$$;

-- ---- Vérifications ---------------------------------------------------------
-- 3 lignes attendues (1 séance, 2 blocs, 1 atelier)
SELECT 'seances'                AS table_name, COUNT(*) FROM public.seances                WHERE axe_travail_general LIKE 'SMOKE TEST%'
UNION ALL
SELECT 'seances_blocs',           COUNT(*) FROM public.seances_blocs           WHERE titre_precision LIKE 'SMOKE TEST%'
UNION ALL
SELECT 'seances_blocs_ateliers',  COUNT(*) FROM public.seances_blocs_ateliers  WHERE atelier_fileid_drive = '1AbcDefGhiJklMnoPqrStuVwxYz0123456';

-- Test RPC get_seances_a_venir (remplacer v_equipe_id) :
-- SELECT * FROM public.get_seances_a_venir('00000000-0000-0000-0000-000000000000'::uuid, 14);

-- Test RPC get_seance_complete (récupérer l'UUID de la séance smoke test ci-dessus) :
-- SELECT public.get_seance_complete((SELECT id FROM public.seances WHERE axe_travail_general LIKE 'SMOKE TEST%' LIMIT 1));

-- ---- Nettoyage --------------------------------------------------------------
-- DELETE FROM public.seances WHERE axe_travail_general LIKE 'SMOKE TEST%';
-- (CASCADE supprime automatiquement les blocs et rattachements liés)
*/

-- ============================================================================
-- FIN sql/28-seances.sql
-- ============================================================================
