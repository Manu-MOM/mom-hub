-- =====================================================================
-- sql_271_collectif_rattrapage_import_18-11
-- Demande de Manu (19/11/2026) : « faire en sorte que les joueurs importés
--   [import OVAL-E du 18/11/2026] apparaissent dans les pioches ».
-- Cause (identique à sql_270) : la pioche = collectif_membre de l'entente
--   de la saison (list_vivier_collectif). L'import OVAL-E crée la fiche
--   (avec categorie_id) mais ne l'inscrit pas au collectif.
-- Sonde du 19/11/2026 : 7 licenciés créés par l'import du 18/11 hors
--   collectif (M6 ×3, M8 ×3, SR-M ×1).
-- HORS PÉRIMÈTRE (non traités ici, signalés à Manu) :
--   - fiches sans catégorie (GARDES Aurelie, créée le 18/11 ; ABDALLAH,
--     BECKER, JOUFFREY, VANDEPUTTE plus anciennes) : pas d'entente possible ;
--   - 8 licenciées F18 : aucune entente F18 sur la saison active.
--
-- Données seulement : INSERT dans collectif_membre (role 'joueur', statut
--   'regulier', date_debut = aujourd'hui). Rien n'est modifié ni supprimé.
--   Même écriture que sql_270 et que le bouton « Enrôler » de U-admin.
-- Garde-fous : nombre attendu (7) vérifié avant insertion ; aucune entente
--   en double par catégorie ; après insertion, 0 licencié restant hors
--   collectif (fail-loud).
-- Mode : DRY-RUN (contrôle puis ROLLBACK). Version COMMIT = même fichier
--   sans le contrôle final, COMMIT final, sur feu vert de Manu.
-- =====================================================================

BEGIN;

CREATE TEMP TABLE _a_inscrire ON COMMIT DROP AS
SELECT p.id AS personne_id, en.id AS entente_id, c.code AS categorie
FROM public.personnes p
JOIN public.ententes en ON en.categorie_id = p.categorie_id AND en.saison_id = public._pp_saison_active()
JOIN public.categories c ON c.id = p.categorie_id
WHERE p.type_personne = 'licencie_competition'
  AND NOT coalesce(p.est_archive, false)
  AND NOT EXISTS (
    SELECT 1 FROM public.collectif_membre cm
    WHERE cm.personne_id = p.id AND cm.entente_id = en.id
      AND (cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE));

DO $garde$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM (
    SELECT en.categorie_id FROM public.ententes en
    WHERE en.saison_id = public._pp_saison_active()
    GROUP BY en.categorie_id HAVING count(*) > 1) d;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GARDE: % catégorie(s) avec plusieurs ententes sur la saison', v_n; END IF;
  SELECT count(*) INTO v_n FROM _a_inscrire;
  IF v_n <> 7 THEN
    RAISE EXCEPTION 'GARDE: % licencié(s) à inscrire au lieu des 7 attendus, rien n''est modifié', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM (SELECT personne_id FROM _a_inscrire GROUP BY personne_id HAVING count(*) > 1) d;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GARDE: % personne(s) en double', v_n; END IF;
END;
$garde$;

INSERT INTO public.collectif_membre (personne_id, entente_id, role, statut, date_debut)
SELECT a.personne_id, a.entente_id, 'joueur', 'regulier', CURRENT_DATE
FROM _a_inscrire a;

DO $verif$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM public.personnes p
  JOIN public.ententes en ON en.categorie_id = p.categorie_id AND en.saison_id = public._pp_saison_active()
  WHERE p.type_personne = 'licencie_competition' AND NOT coalesce(p.est_archive, false)
    AND NOT EXISTS (SELECT 1 FROM public.collectif_membre cm
                    WHERE cm.personne_id = p.id AND cm.entente_id = en.id
                      AND (cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE));
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % licencié(s) encore hors collectif', v_n; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

-- ===== CONTRÔLE (dry-run uniquement) =====
DO $fin$ BEGIN RAISE EXCEPTION 'RESULTATS_DRYRUN: inscrits = %', (
  SELECT string_agg(a.categorie || ' ' || p.nom || ' ' || p.prenom, ', ' ORDER BY a.categorie, p.nom)
  FROM _a_inscrire a JOIN public.personnes p ON p.id = a.personne_id);
END $fin$;

ROLLBACK;
