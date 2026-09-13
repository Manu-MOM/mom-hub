-- =====================================================================
-- sql_251_entente_m16_staff_paolin_klein_crig.sql
-- ---------------------------------------------------------------------
-- Chantier : ENTENTE-M16-2026-2027 — integration staff partenaire
--
-- Besoin : integrer 2 membres du staff CRIG rejoignant l'entente M16 :
--   Nolan PAOLIN (Referent de categorie) et Jeremy KLEIN (Entraineur adjoint).
--
-- Gabarit (verifie base, calque sur M. GONTHIER / staff partenaire SAR) :
--   personnes : categorie_personne='staff',
--     type_personne='licencie_externe_partenaire',
--     est_staff_manuel=true  -> indispensable : est_staff() =
--       (est_staff_ffr(qualites_ffr) AND NOT staff_exclu) OR est_staff_manuel.
--       Sans qualite FFR educateur, seul le flag manuel les qualifie staff.
--     club_principal_id = CRIG.
--   fonction_staff : categorie M16, fonction differenciee, date_debut 2026-09-01.
--
-- Points d'apparition (tous alimentes par la ligne fonction_staff, AUCUNE
--   ligne collectif_membre requise pour le staff) :
--     1. Ecran Staff dedie      -> list_fonctions_staff
--     2. Collectif              -> list_vivier_collectif (UNION sur fonction_staff)
--     3. Effectif M16           -> get_joueurs_categorie (UNION sur fonction_staff,
--                                  profil calcule 'coach')
--
-- Tracable via source_creation='saisie_manuelle_entente_m16_2026-2027_staff_v1'.
-- NON idempotent (INSERT secs). Etat deploye faisant foi : applique le 13/09/2026
--   (migration entente_m16_2026_2027_staff_paolin_klein_crig).
-- =====================================================================

-- 1) Fiches personnes (staff partenaire CRIG)
WITH crig AS (SELECT id FROM clubs WHERE code='CRIG'),
s(prenom, nom) AS (VALUES ('Nolan','PAOLIN'), ('Jérémy','KLEIN'))
INSERT INTO personnes
  (categorie_personne, type_personne, nom, prenom, club_principal_id,
   est_staff_manuel, section_rugby, visible_annuaire, synchronisation_statut, source_creation)
SELECT 'staff', 'licencie_externe_partenaire', s.nom, s.prenom, crig.id,
       true, false, false, 'a_jour', 'saisie_manuelle_entente_m16_2026-2027_staff_v1'
FROM s CROSS JOIN crig;

-- 2) Lignes fonction_staff (fonctions differenciees)
INSERT INTO fonction_staff (personne_id, categorie_id, fonction, date_debut)
SELECT p.id, 'fa2bb289-cef0-4884-82e9-c50699a52a8f'::uuid,
       CASE WHEN p.nom='PAOLIN' THEN 'Référent de catégorie'
            WHEN p.nom='KLEIN'  THEN 'Entraîneur adjoint' END,
       DATE '2026-09-01'
FROM personnes p
WHERE p.source_creation='saisie_manuelle_entente_m16_2026-2027_staff_v1';
