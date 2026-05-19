-- =====================================================================
-- MOM HUB · sql/48 — AMORÇAGE MASSE collectif_membre (N1) ENTENTE M14
-- =====================================================================
-- Auteur  : conv Production · Implémentation Collectif & compo 3
--           niveaux (assistance Claude)
-- Date    : 2026-05-19
-- Version : 1.0
--
-- OBJET : peupler N1 (collectif_membre) en une passe pour l'entente
--   M14 2025-2026, à partir des joueurs DÉJÀ affectés à une équipe
--   de cette entente (equipe_joueurs actifs). Évite 62 enrôlements
--   unitaires via U-admin (l'écran reste l'outil courant ; ceci est
--   l'AMORÇAGE INITIAL d'une saison déjà en cours).
--
-- DÉCISION MANU (option A, tracée clôture — écart ASSUMÉ) : amorçage
--   en masse equipe_joueurs → collectif_membre. Le modèle dit « N1
--   autonome, PAS adossé à equipe_joueurs » : ici equipe_joueurs est
--   UNIQUEMENT la SOURCE de l'amorçage initial (acte ponctuel), le
--   stockage N1 reste autonome ensuite (U-admin n'écrit jamais
--   equipe_joueurs). Bascule initiale légitime, NON un adossement
--   structurel. Tracé.
--
-- ARBITRAGE date_debut (Claude tranche, fondé sur le modèle FAIT
--   FOI — Manu a délégué « le plus juste vs N1-4 ») :
--   date_debut = MIN(date_affectation) ACTIVE par personne.
--   Raison : N1-4 « passé immuable, jamais réécrit » → la date
--   d'entrée dans le collectif = la vraie date d'entrée dans la
--   catégorie, PAS la date d'amorçage. date_affectation est
--   NOT NULL DEFAULT CURRENT_DATE (sql/01, vérifié source) : donnée
--   propre, jamais NULL, rien d'inventé (DS-1). MIN() gère le cas
--   multi-lignes (ré-affectation dans la même entente) sans
--   fabriquer de date : on prend l'entrée la plus ancienne = la
--   plus fidèle à N1-4.
--
-- PÉRIMÈTRE STRICT :
--   • role = 'joueur' UNIQUEMENT (le staff fera l'objet d'une
--     sélection dédiée — décision Manu antérieure ; AUCUN staff
--     amorcé ici, anti-DS-1 : pas de source staff définie).
--   • statut = 'regulier' (défaut du wrapper unitaire
--     addCollectifMembre — cohérence ; statut affine la pioche,
--     non contraignant, modifiable ensuite via U-admin).
--   • Entente M14 2025-2026 ciblée par son code
--     'ENTENTE-M14-2025-2026' (vérifié à la source côté app :
--     getEvenementEquipeContext / listEntentes ont renvoyé cet id
--     2d3cf4e6-…, code = ENTENTE-M14-2025-2026, terrain 19/05).
--     On filtre par CODE (stable, lisible) et non par UUID en dur.
--
-- IDEMPOTENT : OUI. ON CONFLICT sur la contrainte UNIQUE de sql/44
--   collectif_membre_unique (personne_id, entente_id, role,
--   date_debut) → DO NOTHING. Rejouable sans doublon ni erreur.
--   NB : si une 2ᵉ exécution avait un MIN(date_affectation)
--   différent (nouvelle affectation plus ancienne ajoutée entre 2
--   runs — improbable), elle créerait une 2ᵉ ligne (date_debut
--   différente = clé différente) ; comportement attendu et sûr
--   (historique additif, jamais d'écrasement — cohérent N1-4).
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- PRÉALABLE : sql/44 (collectif_membre) exécuté+vérifié (fait 19/05).
-- Transaction ; bloc DO fail-loud AVANT COMMIT (auto-ROLLBACK si
-- l'entente cible est introuvable — pas d'insertion dans le vide).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0 · Garde : l'entente cible DOIT exister (sinon ROLLBACK, pas
--     d'amorçage silencieux dans le vide).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_ent INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_ent
  FROM ententes
  WHERE code = 'ENTENTE-M14-2025-2026';

  IF v_ent <> 1 THEN
    RAISE EXCEPTION
      'sql/48 : entente code=ENTENTE-M14-2025-2026 introuvable (trouvé %) — ROLLBACK. Vérifier le code exact (SELECT id,code FROM ententes).',
      v_ent;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1 · Amorçage : 1 collectif_membre par personne (la plus ancienne
--     affectation active dans une équipe de l'entente M14).
-- ---------------------------------------------------------------------
WITH ent AS (
  SELECT id AS entente_id
  FROM ententes
  WHERE code = 'ENTENTE-M14-2025-2026'
),
src AS (
  SELECT ej.personne_id,
         MIN(ej.date_affectation) AS date_debut   -- N1-4 : entrée réelle
  FROM equipe_joueurs ej
  JOIN equipes e ON e.id = ej.equipe_id
  JOIN ent      ON ent.entente_id = e.entente_id
  WHERE ej.date_sortie IS NULL                     -- actifs uniquement
  GROUP BY ej.personne_id
)
INSERT INTO collectif_membre
  (personne_id, entente_id, role, statut, date_debut)
SELECT src.personne_id,
       ent.entente_id,
       'joueur',
       'regulier',
       src.date_debut
FROM src
CROSS JOIN ent
ON CONFLICT ON CONSTRAINT collectif_membre_unique DO NOTHING;

-- ---------------------------------------------------------------------
-- 2 · Vérification fail-loud AVANT COMMIT.
--     Attendu : nb collectif_membre joueurs de l'entente M14 >= nb
--     personnes distinctes affectées actives (idempotent : un 2ᵉ run
--     n'ajoute rien, l'égalité tient toujours).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_src INTEGER;   -- personnes distinctes affectées actives M14
  v_n1  INTEGER;   -- collectif_membre joueurs M14 (toutes lignes)
BEGIN
  SELECT COUNT(DISTINCT ej.personne_id) INTO v_src
  FROM equipe_joueurs ej
  JOIN equipes e   ON e.id = ej.equipe_id
  JOIN ententes en ON en.id = e.entente_id
  WHERE en.code = 'ENTENTE-M14-2025-2026'
    AND ej.date_sortie IS NULL;

  SELECT COUNT(*) INTO v_n1
  FROM collectif_membre cm
  JOIN ententes en ON en.id = cm.entente_id
  WHERE en.code = 'ENTENTE-M14-2025-2026'
    AND cm.role = 'joueur';

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'Personnes affectées actives M14 (source) : %', v_src;
  RAISE NOTICE 'collectif_membre joueurs M14 (après)     : %', v_n1;
  RAISE NOTICE '────────────────────────────────────────────';

  IF v_n1 < v_src THEN
    RAISE EXCEPTION
      'sql/48 : amorçage incomplet (N1=% < source=%) — ROLLBACK.',
      v_n1, v_src;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Vérification post-exécution (lecture seule — APRÈS le Run)
-- =====================================================================
-- Doit lister les joueurs amorcés avec leur vraie date d'entrée :
--   SELECT cm.personne_id, cm.role, cm.statut, cm.date_debut
--   FROM collectif_membre cm
--   JOIN ententes en ON en.id = cm.entente_id
--   WHERE en.code = 'ENTENTE-M14-2025-2026' AND cm.role = 'joueur'
--   ORDER BY cm.date_debut, cm.personne_id;
--
-- Puis recette terrain : u-admin.html M14 → bloc Joueurs peuplé,
-- noms via sql/47 ; groupe-base.html → vivier non vide.
-- =====================================================================
