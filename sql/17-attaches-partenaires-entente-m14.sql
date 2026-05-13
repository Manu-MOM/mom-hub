-- =====================================================================
-- sql/17-attaches-partenaires-entente-m14.sql
-- =====================================================================
-- Préalable bloquant Phase 4.3 : crée les attaches `equipe_joueurs` pour
-- les 39 joueurs partenaires d'entente M14 (SAR + ASCS provisoirement
-- regroupés sous SAR, cf. dette (m) du STATE.md).
--
-- Référence : STATE.md ligne 467 « reste juste sql/17-attaches-
-- partenaires-entente-m14.sql (39 attaches equipe_joueurs pour les
-- joueurs partenaires, statut 'regulier', club_provenance_id = SAR)
-- avant de pouvoir attaquer les compositions complètes d'entente ».
--
-- Préalables exécutés :
--   - sql/01-creation-tables-vague1.sql   (Vague 1 — tables ententes,
--                                          equipes, equipe_joueurs)
--   - sql/06-peuplement-vague1-equipes.sql (11 ententes + 11 équipes +
--                                           23 attaches M14 MOM)
--   - sql/15-alter-type-personne-c7c.sql   (ajout licencie_externe_
--                                           partenaire à CHECK)
--   - sql/16-peuplement-partenaires-entente-m14-v1.sql (50 fiches
--                                                       partenaires SAR)
--
-- Idempotence : la clause WHERE NOT EXISTS empêche les doublons si le
-- script est rejoué le même jour (UNIQUE (equipe_id, personne_id,
-- date_affectation) ferait planter sinon).
--
-- Effet attendu :
--   - Insert de 39 nouvelles lignes equipe_joueurs
--   - Total attaches actives équipe M14 EQ1 : 23 (MOM) + 39 = 62
--
-- Auteur : conv Production · 14 mai 2026
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- ÉTAPE 1 — Vérifications préalables (échoue tôt avec message clair)
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_equipe_id              UUID;
  v_club_sar_id            UUID;
  v_nb_joueurs_partenaires INTEGER;
  v_nb_attaches_existantes INTEGER;
BEGIN
  -- Équipe cible : M14 entente, numero_equipe = 1
  SELECT e.id INTO v_equipe_id
  FROM equipes e
  JOIN ententes  en ON e.entente_id   = en.id
  JOIN categories c ON en.categorie_id = c.id
  WHERE c.code = 'M14'
    AND e.numero_equipe = 1
  LIMIT 1;

  IF v_equipe_id IS NULL THEN
    RAISE EXCEPTION
      'Équipe M14 EQ1 introuvable. Vérifier categories.code (M14 ?) '
      'et equipes.numero_equipe (1 ?).';
  END IF;

  -- Club provenance : SAR (tag par défaut, cf. dette (m))
  SELECT id INTO v_club_sar_id
  FROM clubs
  WHERE nom_court = 'SAR'
  LIMIT 1;

  IF v_club_sar_id IS NULL THEN
    RAISE EXCEPTION
      'Club SAR introuvable. Vérifier clubs.nom_court (SAR ?).';
  END IF;

  -- Effectif partenaire importé via sql/16 (filtre par tag d'origine)
  SELECT COUNT(*) INTO v_nb_joueurs_partenaires
  FROM personnes
  WHERE source_creation    = 'sporteasy_sar_minimes_2025-2026_v1'
    AND categorie_personne = 'joueur';

  IF v_nb_joueurs_partenaires <> 39 THEN
    RAISE NOTICE
      '⚠️  Attendu 39 joueurs partenaires, trouvé %. '
      'Vérifier sql/16. Le script va quand même attacher tous les '
      'joueurs trouvés (le compte final sera vérifié en Étape 3).',
      v_nb_joueurs_partenaires;
  END IF;

  -- Attaches déjà existantes (idempotence si script rejoué)
  SELECT COUNT(*) INTO v_nb_attaches_existantes
  FROM equipe_joueurs ej
  JOIN personnes      p  ON ej.personne_id = p.id
  WHERE ej.equipe_id        = v_equipe_id
    AND p.source_creation   = 'sporteasy_sar_minimes_2025-2026_v1'
    AND ej.date_affectation = CURRENT_DATE;

  RAISE NOTICE 'Équipe M14 EQ1 ............... : %', v_equipe_id;
  RAISE NOTICE 'Club SAR ..................... : %', v_club_sar_id;
  RAISE NOTICE 'Joueurs partenaires trouvés .. : % (attendu 39)',
               v_nb_joueurs_partenaires;
  RAISE NOTICE 'Attaches déjà créées ce jour . : %',
               v_nb_attaches_existantes;
END $$;

-- ---------------------------------------------------------------------
-- ÉTAPE 2 — INSERT des 39 attaches
-- ---------------------------------------------------------------------

WITH
  equipe_cible AS (
    SELECT e.id AS equipe_id
    FROM equipes e
    JOIN ententes  en ON e.entente_id   = en.id
    JOIN categories c ON en.categorie_id = c.id
    WHERE c.code = 'M14'
      AND e.numero_equipe = 1
    LIMIT 1
  ),
  club_sar AS (
    SELECT id AS club_id
    FROM clubs
    WHERE nom_court = 'SAR'
    LIMIT 1
  ),
  joueurs_partenaires AS (
    SELECT id AS personne_id
    FROM personnes
    WHERE source_creation    = 'sporteasy_sar_minimes_2025-2026_v1'
      AND categorie_personne = 'joueur'
  )
INSERT INTO equipe_joueurs (
  equipe_id,
  personne_id,
  club_provenance_id,
  statut,
  date_affectation,
  notes
)
SELECT
  e.equipe_id,
  j.personne_id,
  c.club_id,
  'regulier',
  CURRENT_DATE,
  'Import partenaire entente M14 via sql/17 (14 mai 2026). '
  'club_provenance_id = SAR par défaut ; distinction ASCS '
  'reportée à dette (m) STATE.md.'
FROM equipe_cible        e
CROSS JOIN club_sar      c
CROSS JOIN joueurs_partenaires j
WHERE NOT EXISTS (
  SELECT 1
  FROM equipe_joueurs ej
  WHERE ej.equipe_id        = e.equipe_id
    AND ej.personne_id      = j.personne_id
    AND ej.date_affectation = CURRENT_DATE
);

-- ---------------------------------------------------------------------
-- ÉTAPE 3 — Vérification post-INSERT
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_equipe_id                  UUID;
  v_attaches_partenaires_actif INTEGER;
  v_attaches_mom_actif         INTEGER;
  v_attaches_total_actif       INTEGER;
BEGIN
  SELECT e.id INTO v_equipe_id
  FROM equipes e
  JOIN ententes  en ON e.entente_id   = en.id
  JOIN categories c ON en.categorie_id = c.id
  WHERE c.code = 'M14'
    AND e.numero_equipe = 1
  LIMIT 1;

  -- Attaches actives MOM (source OVAL-E, pas SportEasy)
  SELECT COUNT(*) INTO v_attaches_mom_actif
  FROM equipe_joueurs ej
  JOIN personnes      p ON ej.personne_id = p.id
  WHERE ej.equipe_id = v_equipe_id
    AND ej.date_sortie IS NULL
    AND (p.source_creation IS NULL
         OR p.source_creation <> 'sporteasy_sar_minimes_2025-2026_v1');

  -- Attaches actives partenaires SAR/ASCS
  SELECT COUNT(*) INTO v_attaches_partenaires_actif
  FROM equipe_joueurs ej
  JOIN personnes      p ON ej.personne_id = p.id
  WHERE ej.equipe_id      = v_equipe_id
    AND ej.date_sortie    IS NULL
    AND p.source_creation = 'sporteasy_sar_minimes_2025-2026_v1';

  -- Total
  SELECT COUNT(*) INTO v_attaches_total_actif
  FROM equipe_joueurs ej
  WHERE ej.equipe_id   = v_equipe_id
    AND ej.date_sortie IS NULL;

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✅ Attaches MOM actives ........... : % (attendu 23)',
               v_attaches_mom_actif;
  RAISE NOTICE '✅ Attaches partenaires actives ... : % (attendu 39)',
               v_attaches_partenaires_actif;
  RAISE NOTICE '✅ Total attaches M14 EQ1 actives . : % (attendu 62)',
               v_attaches_total_actif;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_attaches_partenaires_actif <> 39 THEN
    RAISE WARNING 'Attaches partenaires ≠ 39 — relire les NOTICE de '
                  'l''Étape 1 et le contenu de sql/16.';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK manuel si problème détecté en Étape 3 :
--
--   DELETE FROM equipe_joueurs
--   WHERE equipe_id = (
--     SELECT e.id FROM equipes e
--     JOIN ententes  en ON e.entente_id   = en.id
--     JOIN categories c ON en.categorie_id = c.id
--     WHERE c.code = 'M14' AND e.numero_equipe = 1
--   )
--   AND personne_id IN (
--     SELECT id FROM personnes
--     WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
--   )
--   AND date_affectation = CURRENT_DATE;
-- =====================================================================
