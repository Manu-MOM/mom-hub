-- ============================================================
-- MIGRATION — Horaires détaillés persistants (lève MODELE-EVT-HORAIRES-RDV)
-- ============================================================
-- Ajoute 4 colonnes à la table evenements pour persister les horaires
-- détaillés saisis dans le formulaire (jusqu'ici "pour mémoire", non
-- stockés — dette D-Q3 / MODELE-EVT-HORAIRES-RDV).
--
-- Décision modèle (Manu, 31/05) : heures seules (TIME), pas de timestamp.
-- La DATE de l'évènement vit dans date_debut (jour) ; ces colonnes portent
-- l'heure dans la journée. Lieu RDV = texte libre.
--
-- Additive et NON destructive : ADD COLUMN IF NOT EXISTS, défaut NULL.
-- Les évènements existants ne sont pas affectés. Réversible (DROP COLUMN).
--
-- Champs (alignés sur les name= du formulaire evenements.html) :
--   debut_match  TIME  ← input #evt-create-debut-match  (name=debut_match)
--   fin_prevue   TIME  ← input #evt-create-fin-prevue   (name=fin_prevue)
--   rdv_heure    TIME  ← input #evt-create-rdv-heure     (name=rdv_heure)
--   rdv_lieu     TEXT  ← input #evt-create-rdv-lieu      (name=rdv_lieu)
-- ============================================================

ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS debut_match TIME,
  ADD COLUMN IF NOT EXISTS fin_prevue  TIME,
  ADD COLUMN IF NOT EXISTS rdv_heure   TIME,
  ADD COLUMN IF NOT EXISTS rdv_lieu    TEXT;

-- Vérification (lecture seule) — décommenter pour contrôler après exécution :
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'evenements'
--   AND column_name IN ('debut_match','fin_prevue','rdv_heure','rdv_lieu')
-- ORDER BY column_name;
