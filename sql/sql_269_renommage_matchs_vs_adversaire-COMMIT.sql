-- =====================================================================
-- sql_269_renommage_matchs_vs_adversaire
-- Demande de Manu (17/11/2026) : ajouter « - VS <adversaire> » à la fin
--   du nom des matchs déjà joués de la saison 2026/2027.
-- Adversaires : agenda (evenement_adversaires) ; R2 J2, J3, J4 et
--   Nationale J6 donnés par Manu.
--
-- Données seulement : UPDATE de la colonne evenements.libelle, par id.
--   Rien d'autre n'est modifié ni supprimé. Stats, évals, auto-évals,
--   compos et suivi sont rattachés par id (vérifié : aucune fonction ni
--   aucun écran ne retrouve un match par son nom).
-- Pourquoi pas le formulaire « Modifier » de l'agenda : il refuse les
--   matchs déjà suivis (modifier_evenement_complet).
-- Garde-fous : chaque ligne n'est modifiée que si son nom actuel est
--   exactement celui attendu ; sinon l'ensemble échoue (fail-loud).
-- Mode : COMMIT (corps identique au dry-run vert du 17/11/2026, sans le
--   contrôle final). Appliqué via apply_migration (sans BEGIN/COMMIT).
-- =====================================================================

BEGIN;

CREATE TEMP TABLE _ren (id uuid PRIMARY KEY, avant text NOT NULL, adversaire text NOT NULL) ON COMMIT DROP;
INSERT INTO _ren (id, avant, adversaire) VALUES
  ('76d1f1b7-5f99-4ffd-92f5-07c0e6ce2ebf', 'Championnat de National - Poule 2', 'CRIG - Rhin Ovalie'),
  ('66fee627-8f11-4f3d-abf4-f3a0940c104c', 'Régionale 2 - J1', 'Vosges M16'),
  ('d5936cf6-9b5f-404a-b1df-944aa6e5294a', 'Nationale - Qualifications -  Poule 2 - J2 - Aller', 'COMPIEGNE/BEAUVAIS/MERU/CLERMONT/NOYON/CREPY/SENLIS/CHANTILLY/PLESSIS LAGNY NU16'),
  ('b5ad6daa-bfea-41fb-8005-77ae06e1cf7a', 'Nationale - Qualifications -  Poule 2 - J3 - Aller', 'Rassemblement ANTONY/MASSY/BAGNEUX M16 NAT'),
  ('be01727d-1c12-4b3c-bf16-f52e0337fdcc', 'Régionale 2 - J2', 'Entente Meuse M-16'),
  ('23448b3f-228d-4c51-8cc5-cf86a50e691f', 'J1 FED', 'ARLESTQUEENS'),
  ('28b2b55b-c85b-4199-8f41-1023504aa40f', 'Nationale - Qualifications - Poule 2 - J4 - Aller', 'USO MASSIF CENTRAL'),
  ('5fedfb47-35e8-48fd-ae45-2d06fe308401', 'Régionale 2 - J3', 'Chalons Ardennes M-16'),
  ('42b11a62-f138-4070-90b8-a0b6c6ff4495', 'Nationale - Qualifications -  Poule 2 - J5 - Aller', 'CS BEAUNOIS CS NUITON CHAMBERTIN U16 NAT'),
  ('0d4fbad3-f2f1-40f5-83d3-c8db69f994c5', 'Nationale - Qualifications -  Poule 2 - J6 - Aller', 'US Ris Orangis'),
  ('88b8d2a3-43a4-46fe-b99f-d0e2e51eb07e', 'Régionale 2 - J4', 'Moselle Est M-16');

DO $garde$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM _ren r JOIN public.evenements e ON e.id = r.id
  WHERE e.libelle = r.avant AND e.type_evenement = 'competition';
  IF v_n <> 11 THEN
    RAISE EXCEPTION 'GARDE: % match(s) sur 11 ont le nom attendu, rien n''est modifié', v_n;
  END IF;
END;
$garde$;

UPDATE public.evenements e
  SET libelle = r.avant || ' - VS ' || r.adversaire
  FROM _ren r
  WHERE e.id = r.id AND e.libelle = r.avant;

DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM _ren r JOIN public.evenements e ON e.id = r.id
  WHERE e.libelle = r.avant || ' - VS ' || r.adversaire;
  IF v_n <> 11 THEN RAISE EXCEPTION 'VERIF: % match(s) renommé(s) sur 11', v_n; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
