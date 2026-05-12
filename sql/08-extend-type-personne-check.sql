-- ============================================================================
-- MOM Hub · Dette #8 STATE.md · Extension CHECK constraint type_personne
-- ============================================================================
-- Objectif : étendre les valeurs autorisées du champ `personnes.type_personne`
-- pour aligner Supabase avec la nomenclature FFR officielle, suite à la
-- publication de la `Doctrine-Import-OVAL-E-v1.3.md §14`.
--
-- État avant exécution (depuis sql/01-creation-tables-vague1.sql) :
--   type_personne IN (
--     'licencie_competition', 'licencie_dirigeant', 'licencie_educateur',
--     'non_licencie', 'non_licencie_au_mom'
--   )
--
-- État après exécution (aligné §14 doctrine v1.3) :
--   type_personne IN (
--     'licencie_competition',    -- joueur (classe d'âge présente)
--     'licencie_dirigeant',      -- DC4
--     'licencie_educateur',      -- EDU
--     'licencie_soigneur',       -- SOI       (NOUVEAU)
--     'licencie_arbitre',        -- ACF       (NOUVEAU)
--     'non_licencie',            -- parent, etc.
--     'non_licencie_au_mom'      -- contact externe
--   )
--
-- Effort estimé : ~10 min (ALTER CONSTRAINT + 1 UPDATE migration).
-- Idempotent : peut être rejoué sans dégât (DROP IF EXISTS sur la contrainte).
-- Aucune donnée perso : ce fichier peut être commit dans le repo public.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ÉTAPE 0 — Vérification de l'état actuel (LECTURE SEULE)
-- ----------------------------------------------------------------------------
-- À exécuter AVANT le ALTER pour confirmer qu'on est bien dans l'état décrit.
-- Aucune modification, c'est juste un check.
--
-- Commenter ces SELECT pour exécuter le reste du script en production.

-- A) Voir la définition actuelle de la CHECK constraint :
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.personnes'::regclass
--   AND conname LIKE '%type_personne%';
-- -> doit retourner 1 ligne avec les 5 valeurs actuelles.

-- B) Voir la répartition actuelle des type_personne :
-- SELECT type_personne, COUNT(*) AS n
-- FROM public.personnes
-- GROUP BY type_personne
-- ORDER BY n DESC;
-- -> donne l'inventaire avant migration.

-- C) Identifier les soigneurs (SOI) actuellement mal classés `licencie_dirigeant` :
-- SELECT id, nom, prenom, type_personne, qualite_ffr
-- FROM public.personnes
-- WHERE type_personne = 'licencie_dirigeant'
--   AND qualite_ffr = 'SOI';
-- -> liste les fiches à corriger. Vérifié le 12 mai 2026 : 1 fiche
--    (MICHEL Stéphane, UUID f7c3ba6f-a124-41fd-9229-0433cdb0fdc6).


-- ----------------------------------------------------------------------------
-- 2. ÉTAPE 1 — Étendre la CHECK constraint
-- ----------------------------------------------------------------------------
-- On supprime la contrainte existante et on la recrée avec 2 valeurs en plus.
-- Pattern idempotent : si la nouvelle contrainte existe déjà (rejouage), on
-- ne fait rien à l'étape suivante.

-- Drop de l'ancienne contrainte (le nom exact peut varier selon le moteur
-- Postgres — on cible le pattern standard généré par PG quand on déclare
-- une CHECK inline lors du CREATE TABLE).
ALTER TABLE public.personnes
    DROP CONSTRAINT IF EXISTS personnes_type_personne_check;

-- Création de la nouvelle contrainte avec 7 valeurs autorisées
ALTER TABLE public.personnes
    ADD CONSTRAINT personnes_type_personne_check
    CHECK (
        type_personne IS NULL
        OR type_personne IN (
            'licencie_competition',
            'licencie_dirigeant',
            'licencie_educateur',
            'licencie_soigneur',
            'licencie_arbitre',
            'non_licencie',
            'non_licencie_au_mom'
        )
    );

COMMENT ON CONSTRAINT personnes_type_personne_check ON public.personnes IS
    '7 valeurs autorisées, alignées Doctrine-Import-OVAL-E v1.3 §14 (mapping qualités FFR -> type_personne).';


-- ----------------------------------------------------------------------------
-- 3. ÉTAPE 2 — Migration des fiches mal classées
-- ----------------------------------------------------------------------------
-- Reclassement des soigneurs (SOI) actuellement classés `licencie_dirigeant`
-- vers `licencie_soigneur`.
--
-- Doctrine §14 règle de priorité 2 : c'est `qualite_ffr_principale` qui
-- détermine `type_personne`. Si `qualite_ffr_principale = 'SOI'` ou si SOI
-- est présent dans `qualites_ffr` et que la fiche est mal classée comme
-- dirigeant, on corrige.
--
-- Volume attendu : 1 à quelques fiches (minimum MICHEL STEPHANE selon
-- la doctrine). À vérifier avec le SELECT C) ci-dessus avant exécution.

-- IMPORTANT : la colonne en prod est `qualite_ffr` (TEXT singulier), pas
-- `qualites_ffr` (ARRAY) comme l'anticipe la Doctrine §8bis. La doctrine v1.3
-- §8bis décrit un état CIBLE (migration future vers ARRAY), pas l'état actuel.
-- D'où la requête en égalité simple ci-dessous.
--
-- À ce jour (vérifié le 12 mai 2026), 1 seule fiche est concernée :
-- MICHEL Stéphane (UUID f7c3ba6f-a124-41fd-9229-0433cdb0fdc6),
-- actuellement `licencie_dirigeant` avec qualite_ffr = 'SOI'.

UPDATE public.personnes
SET
    type_personne = 'licencie_soigneur',
    modifie_par = 'manu-correction-doctrine-v1.3',
    updated_at = NOW()
WHERE
    type_personne = 'licencie_dirigeant'
    AND qualite_ffr = 'SOI';

-- Note sur les arbitres (`licencie_arbitre`) : aucune migration automatique
-- prévue à ce stade. Si des fiches existent en `licencie_dirigeant` avec
-- qualité ACF, le script d'import OVAL-E de l'été 2026 (qui appliquera
-- proprement le §14 dès l'origine) reclassera ces fiches. À défaut, on
-- corrige manuellement au cas par cas.


-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement après le script)
-- ============================================================================
--
-- A) Vérifier la nouvelle CHECK constraint :
--    SELECT pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'public.personnes'::regclass
--      AND conname = 'personnes_type_personne_check';
--    -> doit lister les 7 valeurs autorisées.
--
-- B) Vérifier la nouvelle répartition des type_personne :
--    SELECT type_personne, COUNT(*) AS n
--    FROM public.personnes
--    GROUP BY type_personne
--    ORDER BY n DESC;
--    -> 'licencie_soigneur' doit apparaître si au moins une fiche a été
--       reclassée.
--
-- C) Vérifier qu'aucun soigneur ne reste mal classé :
--    SELECT id, nom, prenom, type_personne, qualite_ffr
--    FROM public.personnes
--    WHERE qualite_ffr = 'SOI'
--      AND type_personne != 'licencie_soigneur'
--      AND type_personne != 'licencie_competition';
--    -> idéalement 0 ligne. Sinon, c'est une fiche multi-qualité où SOI
--       est secondaire ; à arbitrer manuellement.
--
-- D) Tester que la contrainte rejette bien les valeurs invalides :
--    UPDATE public.personnes SET type_personne = 'licencie_pizzaiolo'
--    WHERE id = (SELECT id FROM public.personnes LIMIT 1);
--    -> doit lever "new row for relation \"personnes\" violates check
--       constraint \"personnes_type_personne_check\""
--    Pas de ROLLBACK nécessaire car l'UPDATE a échoué.
-- ============================================================================
