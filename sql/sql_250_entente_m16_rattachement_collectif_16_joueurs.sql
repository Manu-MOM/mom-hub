-- =====================================================================
-- sql_250_entente_m16_rattachement_collectif_16_joueurs.sql
-- ---------------------------------------------------------------------
-- Chantier : ENTENTE-M16-2026-2027 — correctif appartenance collectif
--
-- Symptome (recette) : les 16 joueurs partenaires integres au vivier M16
--   (sql_247) apparaissaient dans l'ecran Joueurs et le vivier compo brut
--   (get_vivier_compo_categorie, filtre sur personnes.categorie_id) MAIS
--   PAS dans le Collectif ni dans la constitution des groupes de base /
--   compos pour la saison 2026/2027.
--
-- Cause (verifiee base, DS-1) : le Collectif est peuple par la RPC
--   list_vivier_collectif(p_entente_id), qui lit la table `collectif_membre`
--   filtree par entente_id — et NON personnes.categorie_id. Un joueur
--   n'appartient au collectif d'une saison que s'il a une ligne
--   collectif_membre rattachee a l'entente active. Les 16 fiches n'en
--   avaient aucune (0 verifie).
--
-- Correctif : creer 16 lignes collectif_membre rattachant chaque joueur
--   a l'entente M16 2026/2027 (f780f772-e08f-40c3-ad15-d1c67a3b990e).
--   role='joueur', statut='regulier', date_debut=2026-09-01 (saison active).
--   Colonnes reelles uniquement (pas de colonne `origine` : celle-ci est
--   un litteral genere par la RPC, non stocke).
--
-- Contraintes respectees : role IN (joueur,staff) ; statut IN
--   (regulier,renfort_temporaire,en_transition)|NULL ; date_fin>=date_debut.
-- Idempotent : ON CONFLICT (personne_id, entente_id, role, date_debut).
--
-- Etat deploye faisant foi : applique le 13/09/2026
--   (migration entente_m16_2026_2027_rattachement_collectif_16_joueurs).
-- =====================================================================

INSERT INTO collectif_membre (personne_id, entente_id, role, statut, date_debut)
SELECT p.id,
       'f780f772-e08f-40c3-ad15-d1c67a3b990e'::uuid,
       'joueur', 'regulier', DATE '2026-09-01'
FROM personnes p
WHERE p.source_creation = 'saisie_manuelle_entente_m16_2026-2027_v1'
ON CONFLICT (personne_id, entente_id, role, date_debut) DO NOTHING;
