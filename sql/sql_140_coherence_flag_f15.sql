-- =====================================================================
-- sql_140_coherence_flag_f15.sql
-- =====================================================================
-- OBJET
--   Corriger deux incohérences du flag personnes.f15_integree,
--   apparues après la bascule de saison et sql_135 :
--
--   (1) Fériel SCHNEIDER (partenaire SAR) garde f15_integree=true alors
--       que sql_135 l'a sortie du périmètre (categorie_id=null). Le flag
--       résiduel la fait remonter dans la vue F-15 (get_joueurs_f15 filtre
--       sur le flag, pas sur categorie_id). -> flag retiré.
--
--   (2) RÈGLE SYSTÉMATIQUE (décision Manu) : toute fille en M14 doit être
--       identifiée F15 (double appartenance M14 ∩ F15). Or 3 filles nées
--       2014 (BODEIN, BOSSE, VACHER), montées M12->M14 par la bascule,
--       sont en M14 sans le flag (la bascule ne touche pas f15_integree).
--       -> flag ajouté à toute fille MOM en M14 qui ne l'a pas.
--
-- MODÈLE (rappel, code pt 109) : F15 n'est pas une catégorie physique ;
--   c'est un périmètre transversal porté par personnes.f15_integree.
--   Une fille « M14 ∩ F15 » = categorie_id M14 + f15_integree=true.
--
-- CIBLAGE (règle, pas liste d'UUID)
--   (1) source_creation SAR + flag true.
--   (2) categorie_id=M14 + sexe='F' + flag false, HORS partenaires SAR.
--
-- FAIT ÉTABLI (sondes DS-1) :
--   - (1) : 1 seule fiche SAR avec flag true = Fériel.
--   - (2) : 3 filles MOM en M14 sans flag (BODEIN, BOSSE, VACHER 2014) ;
--     4 déjà à true (DECOURCELLE, PIQUEREZ, TRISTANO 2012, HOCH 2013).
--
-- IDEMPOTENT : OUI (les WHERE ne ciblent que les lignes encore à corriger).
--   Fail-loud + rollback si résultat inattendu.
--
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- =====================================================================

BEGIN;

-- Contrôle AVANT
DO $verif$
DECLARE
  v_sar_on   int;
  v_m14_off  int;
BEGIN
  v_sar_on := (SELECT count(*) FROM personnes
               WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
                 AND f15_integree = true);
  v_m14_off := (SELECT count(*) FROM personnes
                WHERE categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
                  AND sexe = 'F'
                  AND f15_integree = false
                  AND source_creation IS DISTINCT FROM 'sporteasy_sar_minimes_2025-2026_v1');
  RAISE NOTICE 'sql_140 AVANT : % SAR à flag=true (à retirer), % filles M14 MOM sans flag (à ajouter).',
    v_sar_on, v_m14_off;
END
$verif$;

-- (1) Retirer le flag des partenaires SAR (hors périmètre)
UPDATE personnes
SET f15_integree = false,
    modifie_par  = 'sql_140_coherence_f15'
WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
  AND f15_integree = true;

-- (2) Règle systématique : flag F15 sur toute fille MOM en M14 sans flag
UPDATE personnes
SET f15_integree = true,
    modifie_par  = 'sql_140_coherence_f15'
WHERE categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
  AND sexe = 'F'
  AND f15_integree = false
  AND source_creation IS DISTINCT FROM 'sporteasy_sar_minimes_2025-2026_v1';

-- =====================================================================
-- Vérifications fail-loud
-- =====================================================================
DO $verif$
DECLARE
  v_sar_on   int;
  v_m14_off  int;
  v_m14_on   int;
BEGIN
  -- (1) plus aucun SAR avec flag true
  v_sar_on := (SELECT count(*) FROM personnes
               WHERE source_creation = 'sporteasy_sar_minimes_2025-2026_v1'
                 AND f15_integree = true);
  IF v_sar_on <> 0 THEN
    RAISE EXCEPTION 'sql_140 ÉCHEC : % partenaire(s) SAR gardent f15_integree=true (attendu 0).', v_sar_on;
  END IF;

  -- (2) plus aucune fille MOM en M14 sans flag
  v_m14_off := (SELECT count(*) FROM personnes
                WHERE categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
                  AND sexe = 'F'
                  AND f15_integree = false
                  AND source_creation IS DISTINCT FROM 'sporteasy_sar_minimes_2025-2026_v1');
  IF v_m14_off <> 0 THEN
    RAISE EXCEPTION 'sql_140 ÉCHEC : % fille(s) MOM en M14 sans flag (attendu 0).', v_m14_off;
  END IF;

  -- Info : total filles M14 MOM avec flag (attendu 7 : 4 déjà + 3 ajoutées)
  v_m14_on := (SELECT count(*) FROM personnes
               WHERE categorie_id = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'
                 AND sexe = 'F'
                 AND f15_integree = true);
  RAISE NOTICE 'sql_140 OK : Fériel hors F15, % filles MOM en M14 identifiées F15 (M14 ∩ F15).', v_m14_on;
END
$verif$;

COMMIT;
