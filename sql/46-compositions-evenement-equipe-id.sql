-- =====================================================================
-- MOM HUB · N3 · compositions.evenement_equipe_id (extension ADDITIVE)
-- =====================================================================
-- Auteur  : conv Production · Implémentation Collectif & compo 3 niveaux
--           (assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- SOURCE FAIT FOI : Modelisation-Collectif-Compo-3-Niveaux-v1.md v1.1 §4
-- (modèle non rouvert). Extension conceptuelle N3-1 figée ici.
--
-- INVARIANTS DURS TENUS (§4.1, vérifiés à la source — sql/18 +
-- C12-f déployé) :
--   • compositions.evenement_id INTACT : jamais renommé/supprimé,
--     reste UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE
--     (sql/18 fait foi ; STATE pt 9). Ce fichier NE LE TOUCHE PAS —
--     fail-loud le re-vérifie avant COMMIT.
--   • PI-7 non fragilisé : la garde de generer_lien_ephemere
--     (SELECT 1 FROM compositions WHERE evenement_id=… AND cote='mom'
--     AND etat='validee' AND est_active=TRUE) ne référence PAS la
--     colonne neuve -> inchangée.
--   • AUCUNE fonction C12 réécrite (extension additive seule, Façon 1).
--
-- VIGIL-C12 — CLOS AU FAIT (pas à l'hypothèse). C12-f déployé lu à la
--   source : compositions n'est touchée que par (1) garde PI-7 de
--   generer_lien_ephemere et (2) get_compo_reduite_rencontre (JOIN
--   compositions c ON c.id=cj.composition_id WHERE c.evenement_id=…
--   AND cote/etat/est_active ; RETURNS = 6 colonnes toutes issues de
--   composition_joueurs) ; (3) get_compo_reduite_rencontre_coach
--   (C12-l) = clone contrat-identique par construction. AUCUN de ces
--   points ne référence evenement_equipe_id (ni projection, ni WHERE,
--   ni JOIN). Une colonne nullable additive qu'aucune RPC existante ne
--   SELECT/filtre est invisible à ces RPC — garantie sémantique
--   PostgreSQL, pas un pari. Mono-équipe : evenement_equipe_id NULL ->
--   Suivi/C12 STRICTEMENT inchangé (lecture par evenement_id). M6
--   tranche déjà : 1 match = 1 ligne evenements (modèle §4.3).
--
-- ON DELETE = SET NULL (DÉRIVÉ des invariants du modèle, NON un libre
--   arbitrage — hors T1 qui ne couvrait que N1/N2). CASCADE détruirait
--   une compo validée (anti-invariant PI-7/§4.1) ; RESTRICT bloquerait
--   le « décocher une équipe engagée » (anti N3-4 « pont = contrainte
--   UX, PAS FK rigide » / P4 « le Hub avertit, ne bloque pas »).
--   SET NULL = seule option cohérente avec TOUS les invariants : si la
--   ligne M3 disparaît, la feuille redevient « mono-équipe » (NULL),
--   la compo et son evenement_id sont préservés (passé immuable).
--   -> Si tu lis cet arbitrage autrement, un mot et je réémets.
--
-- CE FICHIER NE FAIT QUE : ajouter 1 colonne nullable + sa FK nommée
--   + 1 index partiel. Ne touche AUCUNE autre colonne, AUCUNE RPC,
--   AUCUNE policy (RLS compositions = SELECT-only sql/18 inchangée :
--   le write compositions reste sa dette propre, NON absorbée ici).
--   N'absorbe NI IDENT-SYS NI ADMIN-(ii) NI réalignement DELETE M8.
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- PRÉALABLE : sql/42 (M3 evenement_equipes_engagees) ; sql/18
--   (compositions). ORDRE STRICT : 44 -> 45 -> 46 (ce fichier).
-- IDEMPOTENT : OUI (ADD COLUMN IF NOT EXISTS ; DROP CONSTRAINT
--   IF EXISTS + ADD — patron sql/42 ; CREATE INDEX IF NOT EXISTS).
-- Transaction ; bloc DO fail-loud AVANT COMMIT (auto-ROLLBACK).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 · Colonne additive (N3-1). NULL = mono-équipe inchangé (rétro-compat
--     stricte). PAS de NOT NULL, PAS de DEFAULT réécrivant les lignes.
-- ---------------------------------------------------------------------
ALTER TABLE compositions
  ADD COLUMN IF NOT EXISTS evenement_equipe_id UUID;

-- ---------------------------------------------------------------------
-- 2 · FK nommée, idempotente (patron sql/42 : DROP IF EXISTS + ADD).
--     ON DELETE SET NULL (cf. en-tête — dérivé des invariants).
-- ---------------------------------------------------------------------
ALTER TABLE compositions
  DROP CONSTRAINT IF EXISTS fk_compositions_evenement_equipe;

ALTER TABLE compositions
  ADD CONSTRAINT fk_compositions_evenement_equipe
  FOREIGN KEY (evenement_equipe_id)
  REFERENCES evenement_equipes_engagees(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 3 · Index partiel (miroir discipline idx partiel sql/18) : seulement
--     les feuilles d'équipe engagée (renseignées). Mono-équipe (NULL)
--     hors index = zéro coût sur l'existant.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_compositions_evenement_equipe
  ON compositions (evenement_equipe_id)
  WHERE evenement_equipe_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4 · Vérification fail-loud AVANT COMMIT (auto-ROLLBACK si incohérent)
--     Attendu : colonne neuve nullable=1 · FK=1 · index=1
--     + INVARIANT : compositions.evenement_id TOUJOURS présent ET
--       NOT NULL (intact — non touché).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_col_new   INTEGER;   -- evenement_equipe_id présent ET nullable
  v_fk        INTEGER;   -- fk_compositions_evenement_equipe présent
  v_idx       INTEGER;   -- idx_compositions_evenement_equipe présent
  v_evt_id_ok INTEGER;   -- evenement_id présent ET NOT NULL (intact)
BEGIN
  SELECT COUNT(*) INTO v_col_new
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'compositions'
    AND column_name = 'evenement_equipe_id'
    AND is_nullable = 'YES';

  SELECT COUNT(*) INTO v_fk
  FROM pg_constraint
  WHERE conname = 'fk_compositions_evenement_equipe'
    AND conrelid = 'public.compositions'::regclass
    AND contype = 'f';

  SELECT COUNT(*) INTO v_idx
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'compositions'
    AND indexname = 'idx_compositions_evenement_equipe';

  SELECT COUNT(*) INTO v_evt_id_ok
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'compositions'
    AND column_name = 'evenement_id'
    AND is_nullable = 'NO';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'N3 : colonne neuve nullable=% (att.1) · FK=% (att.1) · index=% (att.1)',
               v_col_new, v_fk, v_idx;
  RAISE NOTICE 'INVARIANT compositions.evenement_id NOT NULL intact=% (att.1)',
               v_evt_id_ok;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_col_new <> 1 OR v_fk <> 1 OR v_idx <> 1 OR v_evt_id_ok <> 1 THEN
    RAISE EXCEPTION
      'N3 incohérent (col_new=%, fk=%, idx=%, evenement_id_intact=%) — ROLLBACK.',
      v_col_new, v_fk, v_idx, v_evt_id_ok;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — à lancer APRÈS le Run)
-- Attendu : evenement_equipe_id UUID YES (nullable) ; evenement_id
-- UUID NO (NOT NULL, intact) ; FK fk_compositions_evenement_equipe
-- vers evenement_equipes_engagees, confdeltype='n' (SET NULL).
-- =====================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'compositions'
  AND column_name IN ('evenement_id', 'evenement_equipe_id')
ORDER BY column_name;

SELECT conname, confdeltype  -- 'n' = ON DELETE SET NULL
FROM pg_constraint
WHERE conname = 'fk_compositions_evenement_equipe'
  AND conrelid = 'public.compositions'::regclass;
