-- =====================================================================
-- sql_244_evt_pont_saisie_evenement_id.sql
-- Chantier : EVT-PONT-SAISIE (brique A) — fondation persistante.
-- Objet    : poser le lien reservations_logistiques -> evenements.
--            Colonne evenement_id uuid NULL + FK + index partiel.
-- Maille   : l'OCCURRENCE (enfant), pas la mère de série.
-- Nullable : une résa peut exister sans événement (historique + saisie
--            manuelle préservés). Aucune donnée existante impactée.
--
-- Impact RLS = NUL (sondé 14/08) :
--   - INSERT reservations_logistiques_insert : with_check =
--     puis_je_ecrire_categories(categorie_ids) — ne lit pas evenement_id.
--   - SELECT reservations_logistiques_select : qual = true.
--   - pas de policy UPDATE/DELETE (mutations via RPC SECURITY DEFINER).
--   - modifier_reservation NE touche PAS evenement_id -> le lien persiste
--     après édition. Aucune RPC à re-signer.
--
-- Additif pur : ADD COLUMN + ADD CONSTRAINT + CREATE INDEX. Rien de
-- supprimé, rien de réécrit. ON DELETE : par défaut (NO ACTION) — la
-- suppression d'un événement encore référencé est bloquée ; l'effacement
-- du lien relève d'un sous-chantier ultérieur (usage n°2), hors périmètre.
--
-- Ordre de déploiement : SQL d'abord (ce fichier), puis front.
-- Le bloc DO $verif$ ci-dessous est un DRY-RUN fail-loud à exécuter en
-- BEGIN/ROLLBACK AVANT le apply_migration réel (feu vert COMMIT de Manu).
-- =====================================================================

ALTER TABLE public.reservations_logistiques
  ADD COLUMN evenement_id uuid NULL;

ALTER TABLE public.reservations_logistiques
  ADD CONSTRAINT reservations_logistiques_evenement_id_fkey
  FOREIGN KEY (evenement_id) REFERENCES public.evenements (id);

CREATE INDEX idx_reservations_logistiques_evenement_id
  ON public.reservations_logistiques (evenement_id)
  WHERE evenement_id IS NOT NULL;
