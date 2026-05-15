-- =============================================================================
-- sql/32-alter-personnes-metier-joueurs.sql
-- =============================================================================
-- MOM Hub · Phase 5.14 · S1.a · Module Joueurs
-- Version       : v2.0 (15 mai 2026 fin d'après-midi)
-- Auteur conv   : Production · Module Joueurs (Phase 5.14)
-- Dettes audit  : C10-J-h (états métier) + arbitrage Option 1 (profil sportif)
-- =============================================================================
--
-- OBJET (v2.0)
--   Ajoute 8 colonnes plates sur `personnes` pour matérialiser le profil
--   sportif d'un joueur + ses états transitoires métier :
--
--   ÉTATS MÉTIER (3 colonnes, audit §1.9, dette C10-J-h)
--     - indisponibilite        : texte libre court (motif + période)
--     - blessure_resume        : texte libre court (description)
--     - suspension_jusqu_au    : date de fin de sanction FFR
--
--   PROFIL SPORTIF (5 colonnes, arbitrage Option 1 du 15 mai)
--     - postes_uuids           : array UUID référençant `postes.json` v1.1
--     - aptitudes_uuids        : array UUID référençant `aptitudes.json` v1.0
--     - taille_cm              : entier court (50-250 cm)
--     - poids_g                : entier (en grammes, 42800 = 42.8 kg)
--     - notes_coach            : texte libre privé coach
--
-- CHOIX DOCTRINAUX (Option 1)
--   - Colonnes plates alignées avec le pattern existant (52 colonnes personnes)
--   - PG arrays cohérents avec `nationalites_complementaires UUID[]`
--     déjà présent dans la même table
--   - Pas de FK déclaratives sur UUID[] (PG natif ne supporte pas) :
--     intégrité référentielle assurée par la whitelist côté wrapper JS et
--     la tolérance UI à l'orphelin (P4 "Hub avertit, ne bloque pas")
--   - poids en grammes entier au lieu de NUMERIC(4,1) pour éviter les floats
--   - Migration future Option 2 possible sans casse : INSERT INTO
--     personne_postes SELECT id, unnest(postes_uuids) FROM personnes, puis
--     DROP COLUMN. Réversible.
--
-- DOCTRINE
--   - P1 Simplicité : structure plate, 0 nouvelle table
--   - P6 Confidentialité : ces colonnes sont lues uniquement via RPC
--     SECURITY DEFINER (sql/33), pas en SELECT direct
--   - P3 Itération : migration vers Option 2 possible plus tard sans casse
--
-- IDEMPOTENCE
--   `ADD COLUMN IF NOT EXISTS` : peut être ré-exécutée sans erreur.
--   Pour passer de v1.0 (3 colonnes) à v2.0 (8 colonnes) : ré-exécuter
--   ce fichier ajoute simplement les 5 nouvelles colonnes manquantes.
--
-- ROLLBACK
--   Voir bloc en commentaire en pied de fichier.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ALTER TABLE personnes : 8 colonnes (3 états métier + 5 profil sportif)
-- -----------------------------------------------------------------------------

-- États métier (3 colonnes — audit §1.9, dette C10-J-h)

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS indisponibilite TEXT;

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS blessure_resume TEXT;

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS suspension_jusqu_au DATE;

-- Profil sportif (5 colonnes — Option 1 arbitrage 15 mai)

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS postes_uuids UUID[] NOT NULL DEFAULT '{}'::UUID[];

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS aptitudes_uuids UUID[] NOT NULL DEFAULT '{}'::UUID[];

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS taille_cm SMALLINT;

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS poids_g INTEGER;

ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS notes_coach TEXT;

-- -----------------------------------------------------------------------------
-- 2. Contraintes CHECK (cohérence métier, ajoutées idempotemment)
-- -----------------------------------------------------------------------------

-- taille_cm : valeur plausible si renseignée (50 cm bébé → 250 cm adulte XXL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personnes_taille_cm_check'
  ) THEN
    ALTER TABLE personnes
      ADD CONSTRAINT personnes_taille_cm_check
      CHECK (taille_cm IS NULL OR (taille_cm BETWEEN 50 AND 250));
  END IF;
END $$;

-- poids_g : valeur plausible si renseignée (5 kg → 250 kg)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personnes_poids_g_check'
  ) THEN
    ALTER TABLE personnes
      ADD CONSTRAINT personnes_poids_g_check
      CHECK (poids_g IS NULL OR (poids_g BETWEEN 5000 AND 250000));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. COMMENT ON COLUMN : documentation inline (lue par psql \d+)
-- -----------------------------------------------------------------------------

COMMENT ON COLUMN personnes.indisponibilite IS
  'Module Joueurs : motif et période d''indisponibilité ponctuelle (vacances, '
  'examens, raison perso). Texte libre court. NULL = pas d''indispo déclarée. '
  'Édition réservée coach principal / assistant / entente. Indépendant de '
  'blessure_resume et de composition_joueurs.etat_joueur. Dette audit C10-J-h.';

COMMENT ON COLUMN personnes.blessure_resume IS
  'Module Joueurs : résumé libre court de la blessure en cours (zone, gravité, '
  'date estimation retour). NULL = pas de blessure. Édition réservée coach. '
  'Source de vérité coach pour l''état BLESSE en complément de '
  'composition_joueurs.etat_joueur saisi table de marque. Dette C10-J-h.';

COMMENT ON COLUMN personnes.suspension_jusqu_au IS
  'Module Joueurs : date jusqu''à laquelle le joueur est suspendu FFR '
  '(carton rouge, commission discipline). NULL = pas de suspension. '
  'Un joueur avec suspension_jusqu_au >= CURRENT_DATE est en état SUSPENDU '
  '(cf. audit §1.9). Dette audit C10-J-h.';

COMMENT ON COLUMN personnes.postes_uuids IS
  'Module Joueurs : array d''UUIDs de postes joués (réf. postes.json v1.1). '
  'Multi-postes possible (ex : pilier G + D). Pas de FK native PG sur les '
  'arrays : intégrité référentielle assurée par whitelist côté wrapper et '
  'tolérance UI à l''orphelin (P4 avertir, pas bloquer). Option 1 plate.';

COMMENT ON COLUMN personnes.aptitudes_uuids IS
  'Module Joueurs : array d''UUIDs d''aptitudes (réf. aptitudes.json v1.0, '
  'catégorie A universelle + catégorie B selon âge). Multi-aptitudes : un '
  'joueur peut être Tank + Botteur + 3/4. Whitelist wrapper. Option 1 plate.';

COMMENT ON COLUMN personnes.taille_cm IS
  'Module Joueurs : taille du joueur en centimètres (SMALLINT). NULL si non '
  'renseignée. CHECK 50-250 cm. Affichage UI : (taille_cm / 100).toFixed(2) + '' m''.';

COMMENT ON COLUMN personnes.poids_g IS
  'Module Joueurs : poids du joueur en grammes (INTEGER, évite les floats). '
  '42800 = 42.8 kg. NULL si non renseigné. CHECK 5000-250000 g. Affichage UI : '
  '(poids_g / 1000).toFixed(1) + '' kg''.';

COMMENT ON COLUMN personnes.notes_coach IS
  'Module Joueurs : notes libres privées coach (observations, points '
  'progression, anecdotes). NON visibles par joueur ni parents. Édition '
  'réservée coach principal / assistant / entente.';

-- -----------------------------------------------------------------------------
-- 4. Vérification rapide (visible dans la console psql)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT count(*) INTO cnt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'personnes'
    AND column_name IN (
      'indisponibilite', 'blessure_resume', 'suspension_jusqu_au',
      'postes_uuids', 'aptitudes_uuids', 'taille_cm', 'poids_g', 'notes_coach'
    );

  IF cnt = 8 THEN
    RAISE NOTICE '✅ sql/32 v2.0 OK : 8 colonnes module Joueurs présentes sur personnes';
  ELSE
    RAISE EXCEPTION '❌ sql/32 v2.0 KO : attendu 8 colonnes, trouvé %', cnt;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin)
-- =============================================================================
-- BEGIN;
--   ALTER TABLE personnes DROP CONSTRAINT IF EXISTS personnes_poids_g_check;
--   ALTER TABLE personnes DROP CONSTRAINT IF EXISTS personnes_taille_cm_check;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS notes_coach;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS poids_g;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS taille_cm;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS aptitudes_uuids;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS postes_uuids;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS suspension_jusqu_au;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS blessure_resume;
--   ALTER TABLE personnes DROP COLUMN IF EXISTS indisponibilite;
-- COMMIT;
-- =============================================================================
