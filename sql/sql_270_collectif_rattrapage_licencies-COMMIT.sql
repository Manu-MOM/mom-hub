-- =====================================================================
-- sql_270_collectif_rattrapage_licencies
-- Demande de Manu (17/11/2026), après le signalement de Jean (seniors F) :
--   « toutes ses joueuses n'apparaissaient pas dans la pioche pour
--   constituer son groupe de base ».
-- Cause : la pioche du groupe de base = collectif_membre de l'entente de la
--   saison (list_vivier_collectif). Les collectifs ont été remplis le
--   01/07/2026 ; les licences arrivées ensuite n'y ont jamais été ajoutées
--   (81 licenciés MOM sur 9 catégories au 17/11/2026).
--
-- Données seulement : INSERT dans collectif_membre (role 'joueur', statut
--   'regulier', date_debut = aujourd'hui), pour chaque licencié MOM
--   (type_personne 'licencie_competition', non archivé) d'une catégorie
--   ayant une entente sur la saison active, sans adhésion active à cette
--   entente. Rien n'est modifié ni supprimé. Même écriture que le bouton
--   « Enrôler » de U-admin (addCollectifMembre).
-- AJOUT (Manu, 17/11/2026, avant COMMIT) : 5 joueuses du CRIG qui jouent
--   pour l'équipe seniors F du MOM, absentes de la base. Créées comme les
--   joueurs partenaires existants : type_personne 'licencie_externe_
--   partenaire', categorie_personne 'joueur', catégorie SR-F, club CRIG,
--   puis inscrites au collectif SR-F. Noms tels que donnés par Manu
--   (sans accent ajouté).
-- Garde-fous : nombre attendu (81) vérifié avant insertion ; aucune
--   entente en double par catégorie ; après insertion, 0 licencié restant
--   hors collectif (fail-loud).
-- Mode : COMMIT (corps identique au dry-run vert du 17/11/2026, sans le
--   contrôle final). Appliqué via apply_migration (sans BEGIN/COMMIT).
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
  IF v_n <> 81 THEN
    RAISE EXCEPTION 'GARDE: % licencié(s) à inscrire au lieu des 81 attendus, rien n''est modifié', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM (SELECT personne_id FROM _a_inscrire GROUP BY personne_id HAVING count(*) > 1) d;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GARDE: % personne(s) en double', v_n; END IF;
END;
$garde$;

INSERT INTO public.collectif_membre (personne_id, entente_id, role, statut, date_debut)
SELECT a.personne_id, a.entente_id, 'joueur', 'regulier', CURRENT_DATE
FROM _a_inscrire a;

-- Joueuses CRIG pour les seniors F du MOM (5).
DO $garde_crig$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM public.personnes p
  WHERE (upper(p.nom), lower(p.prenom)) IN (('GENTNER','camille'), ('LIBBRA','victoria'), ('BOUDELE','sara'),
                                            ('BANNAY','lucie'), ('MAUBOURGUET','anais'));
  IF v_n <> 0 THEN RAISE EXCEPTION 'GARDE: % fiche(s) CRIG déjà existante(s), rien n''est créé', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.clubs WHERE id = '0152d537-8db4-40ad-9e2a-697c6b4c71f9' AND code = 'CRIG';
  IF v_n <> 1 THEN RAISE EXCEPTION 'GARDE: club CRIG introuvable'; END IF;
  SELECT count(*) INTO v_n FROM public.ententes
  WHERE id = 'f98f815f-4c92-4bee-a584-06ce8b11a6d2' AND categorie_id = '10a2fbbb-c3db-466b-aa21-ca7bdc5e83d3'
    AND saison_id = public._pp_saison_active();
  IF v_n <> 1 THEN RAISE EXCEPTION 'GARDE: entente SR-F de la saison introuvable'; END IF;
END;
$garde_crig$;

CREATE TEMP TABLE _crig (id uuid PRIMARY KEY) ON COMMIT DROP;
WITH nouvelles AS (
  INSERT INTO public.personnes (nom, prenom, categorie_personne, type_personne, categorie_id, club_principal_id,
                                pays, nationalite_principale, modifie_par, source_creation)
  SELECT v.nom, v.prenom, 'joueur', 'licencie_externe_partenaire', '10a2fbbb-c3db-466b-aa21-ca7bdc5e83d3',
         '0152d537-8db4-40ad-9e2a-697c6b4c71f9', 'France', 'France',
         'claude-sql_270-2026-11-17', 'demande_manu_srf_crig_2026-11-17'
  FROM (VALUES ('GENTNER', 'Camille'), ('LIBBRA', 'Victoria'), ('BOUDELE', 'Sara'),
               ('BANNAY', 'Lucie'), ('MAUBOURGUET', 'Anais')) AS v (nom, prenom)
  RETURNING id
)
INSERT INTO _crig (id) SELECT id FROM nouvelles;

INSERT INTO public.collectif_membre (personne_id, entente_id, role, statut, date_debut)
SELECT c.id, 'f98f815f-4c92-4bee-a584-06ce8b11a6d2', 'joueur', 'regulier', CURRENT_DATE
FROM _crig c;

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
  SELECT count(*) INTO v_n FROM _crig c JOIN public.collectif_membre cm
    ON cm.personne_id = c.id AND cm.entente_id = 'f98f815f-4c92-4bee-a584-06ce8b11a6d2' AND cm.date_fin IS NULL;
  IF v_n <> 5 THEN RAISE EXCEPTION 'VERIF: % joueuse(s) CRIG inscrite(s) sur 5', v_n; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

COMMIT;
