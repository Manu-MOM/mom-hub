-- =====================================================================
-- sql_139_rouvrir_attaches_feminines_2011.sql
-- =====================================================================
-- OBJET
--   Corriger sql_138 : rouvrir les attaches equipe_joueurs des 4
--   féminines nées 2011 (BES, FAUVEL, MARTIN, TRENDEL) en remettant
--   date_sortie à NULL.
--
-- POURQUOI
--   sql_138 avait clôturé leurs attaches equipe_joueurs M14 (date_sortie
--   = 2026-07-31). C'était un sur-traitement : la bascule de saison ne
--   touche QUE personnes.categorie_id (appliquer_bascule), jamais les
--   attaches d'équipe. Les 77 garçons surclassés ce matin ont gardé
--   leurs attaches intactes. Pour cohérence, les 4 filles doivent être
--   traitées pareil : changement de catégorie seul, équipes inchangées
--   (recomposées à la rentrée 2026/2027 lors de la création des équipes).
--   Décision Manu : rouvrir les attaches.
--
-- CE QUI RESTE ACQUIS (sql_138, NON annulé)
--   - categorie_id = F18 (07be594d) sur les 4 : correct, conservé.
--   - f15_integree = false sur les 4 : correct, conservé.
--   Seule la clôture d'équipe est défaite.
--
-- FAIT ÉTABLI
--   - Les 4 attaches equipe_joueurs (equipe SAR/MOM-M14-1 bfb83b83…)
--     portent date_sortie = 2026-07-31 depuis sql_138.
--
-- IDEMPOTENT : quasi (ne rouvre que les attaches fermées au 2026-07-31).
--   Fail-loud + rollback si compte inattendu.
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;

-- Contrôle AVANT
DO $verif$
DECLARE
  v_fermees int;
BEGIN
  v_fermees := (SELECT count(*) FROM equipe_joueurs
                WHERE personne_id IN (
                  '895238dc-ded6-4315-bcd0-3361a80f3ff3',
                  '800fd121-26c7-408a-b10c-98a4c4079e02',
                  '2371c6a3-8a13-4ca0-9097-aad56105b362',
                  '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
                  AND date_sortie = DATE '2026-07-31');
  RAISE NOTICE 'sql_139 AVANT : % attache(s) fermée(s) au 2026-07-31 (attendu 4).', v_fermees;
  IF v_fermees <> 4 THEN
    RAISE EXCEPTION 'sql_139 ABORT : % attaches fermées au 2026-07-31 au lieu de 4.', v_fermees;
  END IF;
END
$verif$;

-- Rouvrir les attaches (annuler la date_sortie posée par sql_138)
UPDATE equipe_joueurs
SET date_sortie = NULL,
    updated_at  = now()
WHERE personne_id IN (
  '895238dc-ded6-4315-bcd0-3361a80f3ff3',
  '800fd121-26c7-408a-b10c-98a4c4079e02',
  '2371c6a3-8a13-4ca0-9097-aad56105b362',
  '87ddde1f-4f7c-4b0c-8129-fcd90a43e097'
)
AND date_sortie = DATE '2026-07-31';

-- =====================================================================
-- Vérifications fail-loud
-- =====================================================================
DO $verif$
DECLARE
  v_ouvertes  int;
  v_f18       int;
  v_flag_on   int;
BEGIN
  -- (1) les 4 attaches sont rouvertes
  v_ouvertes := (SELECT count(*) FROM equipe_joueurs
                 WHERE personne_id IN (
                   '895238dc-ded6-4315-bcd0-3361a80f3ff3',
                   '800fd121-26c7-408a-b10c-98a4c4079e02',
                   '2371c6a3-8a13-4ca0-9097-aad56105b362',
                   '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
                   AND date_sortie IS NULL);
  IF v_ouvertes <> 4 THEN
    RAISE EXCEPTION 'sql_139 ÉCHEC : % attaches ouvertes (attendu 4).', v_ouvertes;
  END IF;

  -- (2) categorie F18 toujours en place (sql_138 non altéré)
  v_f18 := (SELECT count(*) FROM personnes
            WHERE id IN (
              '895238dc-ded6-4315-bcd0-3361a80f3ff3',
              '800fd121-26c7-408a-b10c-98a4c4079e02',
              '2371c6a3-8a13-4ca0-9097-aad56105b362',
              '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
              AND categorie_id = '07be594d-bb70-4858-8490-ad009d22dc6d');
  IF v_f18 <> 4 THEN
    RAISE EXCEPTION 'sql_139 ÉCHEC : % en F18 (attendu 4 — sql_138 ne doit pas être altéré).', v_f18;
  END IF;

  -- (3) flag F15 toujours retiré
  v_flag_on := (SELECT count(*) FROM personnes
                WHERE id IN (
                  '895238dc-ded6-4315-bcd0-3361a80f3ff3',
                  '800fd121-26c7-408a-b10c-98a4c4079e02',
                  '2371c6a3-8a13-4ca0-9097-aad56105b362',
                  '87ddde1f-4f7c-4b0c-8129-fcd90a43e097')
                  AND f15_integree = true);
  IF v_flag_on <> 0 THEN
    RAISE EXCEPTION 'sql_139 ÉCHEC : % gardent f15_integree=true (attendu 0).', v_flag_on;
  END IF;

  RAISE NOTICE 'sql_139 OK : 4 attaches M14 rouvertes, F18 + flag retiré conservés (aligné sur les garçons).';
END
$verif$;

COMMIT;
