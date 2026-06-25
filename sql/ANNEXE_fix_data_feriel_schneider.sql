-- ============================================================
-- ANNEXE_fix_data_feriel_schneider.sql
-- ------------------------------------------------------------
-- Chantier : JOUEURS-PERIMETRE-F15 (pt 109) — ANNEXE DATA
--
-- ⚠️ EXCEPTION TRACÉE à « 1 conv = 1 sujet » : ce correctif de
--    DONNÉE est indissociable de la recette F15 (sans lui, Fériel
--    SCHNEIDER manque à l'effectif F15 affiché). Il est livré à
--    part, en one-shot, pour rester distinct du code.
--
-- CONTEXTE (sondé) :
--   Fériel SCHNEIDER (personnes.id = 5d919675-81e9-460b-903b-8314afbc6b90)
--   est une joueuse F15 (club partenaire), mais en base :
--     - f15_integree = false  → exclue du périmètre F15 (flag seul)
--     - sexe = null            → fiche affichée « Joueur » au lieu de « Joueuse »
--   type_personne = 'licencie_externe_partenaire' (CONSERVÉ tel quel :
--   décision Manu — elle garde le profil/badge « partenaire », cohérent
--   avec son statut de club partenaire intégrée en F15).
--
-- CORRECTIF (décision Manu) :
--   f15_integree → TRUE   (la fait entrer dans le périmètre F15)
--   sexe         → 'F'    (fiche correcte « Joueuse »)
--
-- Idempotent : rejouer ne change rien (valeurs cibles déjà posées).
-- Ciblage par id (pas par nom) — pas d'ambiguïté homonyme.
-- ============================================================

UPDATE personnes
   SET f15_integree = TRUE,
       sexe         = 'F'
 WHERE id = '5d919675-81e9-460b-903b-8314afbc6b90'
   AND (f15_integree IS DISTINCT FROM TRUE OR sexe IS DISTINCT FROM 'F');

-- ------------------------------------------------------------
-- VÉRIFICATION fail-loud : la ligne cible est-elle conforme ?
-- ------------------------------------------------------------
DO $verif$
DECLARE
  v_flag boolean;
  v_sexe text;
BEGIN
  SELECT f15_integree, sexe
    INTO v_flag, v_sexe
    FROM personnes
   WHERE id = '5d919675-81e9-460b-903b-8314afbc6b90';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fériel SCHNEIDER (5d919675…) introuvable — id erroné ?';
  END IF;
  IF v_flag IS NOT TRUE THEN
    RAISE EXCEPTION 'Fériel : f15_integree non posé à TRUE (=%).', v_flag;
  END IF;
  IF v_sexe IS DISTINCT FROM 'F' THEN
    RAISE EXCEPTION 'Fériel : sexe non posé à F (=%).', v_sexe;
  END IF;

  RAISE NOTICE 'ANNEXE OK : Fériel SCHNEIDER → f15_integree=TRUE, sexe=F.';
END
$verif$;

-- ------------------------------------------------------------
-- CONTRÔLE post-correctif (lecture) : périmètre F15 attendu = 9.
-- À exécuter après sql_111 ET cette annexe pour valider la recette.
-- ------------------------------------------------------------
-- SELECT prenom, nom, sexe, f15_integree, profil
--   FROM get_joueurs_f15()
--  ORDER BY nom;
-- Attendu : 9 lignes (8 déjà flaggées + Fériel).
-- Auriane DECOURCELLE doit être présente (0 rattachement équipe).
-- Lya MOSSER / Shaina NADJIDE IDI / Soa NOLL / Chloé ROUSSOS : ABSENTES.
