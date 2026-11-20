-- =====================================================================
-- sql_275 — Renfort M19 dans le collectif SR-M 2026/2027 (option A)
-- Retour terrain Lohann HUMBERT (20/11/2026) : pouvoir intégrer les M19
-- à la pioche seniors pour ses compos.
--
-- Constat (base, 20/11/2026) : la pioche du groupe de base / des compos
-- lit list_vivier_collectif(entente) -> collectif_membre de l'entente.
-- ENTENTE-SR-M-2026-2027 : 71 joueurs, 0 M19. Aucun écran ne permet au
-- référent d'y ajouter un joueur d'une autre catégorie (option B, chantier
-- à venir avec FAIT FOI).
--
-- Correctif : inscrire les 18 M19 (catégorie de fiche M19, tous déjà
-- membres actifs de ENTENTE-M19-2026-2027) au collectif SR-M avec
-- statut 'renfort_temporaire' (badge « Renfort » déjà géré côté compos).
-- Leur adhésion M19 est conservée. Réversible : date_fin datée (jamais
-- DELETE, doctrine UA-4).
-- Idempotent : ON CONFLICT (personne_id, entente_id, role, date_debut).
-- Choix de Manu : « A puis B » (20/11/2026).
-- =====================================================================

BEGIN;

INSERT INTO public.collectif_membre (personne_id, entente_id, role, statut, date_debut)
SELECT p.id,
       en.id,
       'joueur', 'renfort_temporaire', DATE '2026-11-20'
FROM public.personnes p
JOIN public.categories c ON c.id = p.categorie_id
CROSS JOIN public.ententes en
WHERE c.code = 'M19'
  AND NOT p.est_archive
  AND en.code = 'ENTENTE-SR-M-2026-2027'
  AND NOT EXISTS (
    SELECT 1 FROM public.collectif_membre cm
    WHERE cm.personne_id = p.id
      AND cm.entente_id = en.id
      AND cm.role = 'joueur'
      AND (cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE)
  )
ON CONFLICT (personne_id, entente_id, role, date_debut) DO NOTHING;

DO $verif$
DECLARE
  v_n int;
  v_m19 int;
BEGIN
  SELECT count(*) INTO v_m19
  FROM public.personnes p JOIN public.categories c ON c.id = p.categorie_id
  WHERE c.code = 'M19' AND NOT p.est_archive;

  SELECT count(*) INTO v_n
  FROM public.collectif_membre cm
  JOIN public.ententes en ON en.id = cm.entente_id
  JOIN public.personnes p ON p.id = cm.personne_id
  JOIN public.categories c ON c.id = p.categorie_id
  WHERE en.code = 'ENTENTE-SR-M-2026-2027'
    AND c.code = 'M19'
    AND cm.role = 'joueur'
    AND cm.statut = 'renfort_temporaire'
    AND cm.date_fin IS NULL;

  IF v_n <> v_m19 THEN
    RAISE EXCEPTION 'FAIL: % renforts M19 au collectif SR-M, % attendus', v_n, v_m19;
  END IF;
  RAISE NOTICE 'sql_275 OK : % M19 en renfort au collectif SR-M', v_n;
END
$verif$;

COMMIT;
