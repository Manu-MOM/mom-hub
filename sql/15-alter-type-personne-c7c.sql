-- =====================================================================
-- MOM HUB · DETTE C7-c · AJOUT 'licencie_externe_partenaire' À type_personne
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-14
-- Version : 1.1 (v1.0 retirée : tests DO blocks utilisaient INSERT factice
--          incomplet → conflit avec NOT NULL `categorie_personne`. V1.1
--          conserve juste l'ALTER + vérification SELECT.)
--
-- Ferme la sous-dette C7-c, préalable bloquant à Phase 4.3 :
-- ajoute la 8e valeur autorisée 'licencie_externe_partenaire' à la
-- contrainte CHECK sur `personnes.type_personne`.
--
-- =====================================================================
-- CONTEXTE
-- =====================================================================
--   - Doctrine Import OVAL-E v1.4 §14 (14 mai 2026, Drive) :
--     8e valeur officielle, dédiée aux joueurs SAR/ASCS d'entente
--     M14/M16/M19 partenaires de MOM, dont la licence FFR est rattachée
--     à leur club d'origine (pas à MOM).
--   - Audit C7 (Drive, fileId 12_akokLYOUpyk-_CKIkW5H8WzvleEqiO) :
--     analyse complète + 8 actions cascade, dont celle-ci.
--   - Pattern identique à la dette #8 résolue le 12 mai 2026 par
--     `sql/08-extend-type-personne-check.sql` (qui avait ajouté
--     'licencie_soigneur' et 'licencie_arbitre').
--
-- =====================================================================
-- DÉFINITION ACTUELLE DU CHECK (vérifiée par DRY-RUN avant exécution)
-- =====================================================================
--   CHECK (((type_personne IS NULL) OR (type_personne = ANY (ARRAY[
--     'licencie_competition'::text,
--     'licencie_dirigeant'::text,
--     'licencie_educateur'::text,
--     'licencie_soigneur'::text,
--     'licencie_arbitre'::text,
--     'non_licencie'::text,
--     'non_licencie_au_mom'::text
--   ]))))
--   → 7 valeurs autorisées + NULL.
--
-- DÉFINITION CIBLE
--   → 8 valeurs autorisées + NULL : ajout 'licencie_externe_partenaire'.
--   Syntaxe IN(...) plutôt que ANY(ARRAY[...]) — sémantique équivalente,
--   Postgres normalise au stockage de toute façon.
--
-- =====================================================================
-- HORS PÉRIMÈTRE
-- =====================================================================
--   - Pas de migration de fiches existantes (aucune fiche n'utilise
--     encore cette valeur ; le peuplement initial M14 SAR/ASCS viendra
--     en Phase 4.3 après C7-f canal d'import choisi).
--   - Pas de modification du bloc_5 (M-1 réduit en v1.1 modélisation =
--     ajout `categorie_surclassement_uuid` reporté à `sql/17-alter-personnes-m1.sql`
--     côté Phase 4.3).
--   - Pas de test fonctionnel d'INSERT factice (retiré en v1.1 — la
--     table `personnes` a plusieurs colonnes NOT NULL, le SELECT de
--     vérification post-ALTER suffit à confirmer la modification).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : oui (DROP CONSTRAINT + ADD CONSTRAINT recrée toujours
-- la contrainte à l'identique de la cible).
-- =====================================================================

BEGIN;

ALTER TABLE personnes
  DROP CONSTRAINT personnes_type_personne_check;

ALTER TABLE personnes
  ADD CONSTRAINT personnes_type_personne_check
  CHECK (
    type_personne IS NULL
    OR type_personne IN (
      'licencie_competition',
      'licencie_dirigeant',
      'licencie_educateur',
      'licencie_soigneur',
      'licencie_arbitre',
      'licencie_externe_partenaire',  -- ✨ ajout C7-c (Doctrine OVAL-E v1.4)
      'non_licencie',
      'non_licencie_au_mom'
    )
  );

COMMIT;


-- =====================================================================
-- Vérification post-modification (en dehors de la transaction)
-- =====================================================================

-- La nouvelle définition doit contenir 'licencie_externe_partenaire'
SELECT
  conname AS contrainte_name,
  pg_get_constraintdef(c.oid) AS definition_nouvelle
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'personnes'
  AND c.contype = 'c'
  AND conname = 'personnes_type_personne_check';
