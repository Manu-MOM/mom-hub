-- =====================================================================
-- sql_283 — IMPORT-FFR-RATTRAPAGE v1, lot L1 : garde du score,
--           scores administratifs, durées des périodes
-- ---------------------------------------------------------------------
-- FAIT FOI : Conception-IMPORT-FFR-RATTRAPAGE-v1.md (gelé par Manu le
-- 21/11/2026, « je gèle »), décisions D4, D5-B, D6-A.
-- Écart de gouvernance : chantier enchaîné dans la conversation
-- « calendriers M16 / seniors » à la demande de Manu (« on enchaîne ici »).
--
-- Contenu :
--   1. consolider_score_rencontre (signature INCHANGÉE → CREATE OR
--      REPLACE, droits conservés, pas de surcharge PGRST203) :
--        • D6-A : si evenements.notes_resultat commence par
--          '[SCORE ADMINISTRATIF]', le score n'est jamais écrasé ;
--        • D5-B : si aucune ligne active du suivi ne marque de points,
--          le score existant n'est pas écrasé (fin du « retour à 0-0 »
--          des matchs saisis par exception I1 le 21/11/2026) ;
--        • dans ces deux cas la RPC renvoie le score existant ;
--        • sinon : comportement C12-e inchangé (somme + photo).
--   2. D6-A : scores administratifs M16 R2
--        • J2 Entente Meuse (10/10, MEI) : 25-0 déjà saisi → marqueur ;
--        • J4 Moselle Est (14/11) : score officiel FFR 25-0 + marqueur.
--   3. D4 : suivi_chrono.durees_periodes pour les matchs de championnat
--      joués sans chrono : M16 = [35,35], Seniors M et F = [40,40].
--      EXCLUS (durée inconnue, à trancher en L2) : les 2 matchs du
--      plateau réserve du 31/10 (coups d'envoi 14:00 et 15:00).
--   4. Vérification fail-loud.
--
-- Sondes DS-1 (21/11/2026, lecture seule) : définition actuelle de
-- consolider_score_rencontre (1 seule signature ; ACL postgres, anon,
-- authenticated, service_role) ; colonnes et contraintes de suivi_chrono
-- (PK evenement_uuid ; durees_periodes NOT NULL DEFAULT [30,30]) ;
-- matchs joués M16 / SR-M / SR-F, leurs chronos et leurs scores.
--
-- Mode : COMMIT (identique au DRY-RUN hors tests, à appliquer uniquement
-- sur feu vert explicite de Manu). Dry-run vert le 21/11/2026 : VERIF OK
-- + 7 tests conformes (T1 à T7).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. consolider_score_rencontre : gardes D5-B et D6-A
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolider_score_rencontre(
    p_evenement_uuid UUID,
    p_token          TEXT DEFAULT NULL
) RETURNS TABLE (score_mom INTEGER, score_adverse INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_evt          UUID;
    v_score_notre  INTEGER;
    v_score_adv    INTEGER;
    v_nb_points    INTEGER;
    v_admin        BOOLEAN;
    v_old_mom      INTEGER;
    v_old_adv      INTEGER;
BEGIN
    -- Contrôle d'accès (inchangé, C12-e) :
    --  • jeton 'saisie' valide pointant cette rencontre, OU
    --  • coach authentifié / smoke-test (re-consolidation Mode Vidéo)
    IF p_token IS NOT NULL THEN
        v_evt := valider_lien_suivi(p_token, 'saisie');
        IF v_evt <> p_evenement_uuid THEN
            RAISE EXCEPTION 'Le jeton ne correspond pas à cette rencontre.';
        END IF;
    ELSE
        v_evt := p_evenement_uuid;
    END IF;

    SELECT e.score_mom, e.score_adverse,
           coalesce(e.notes_resultat LIKE '[SCORE ADMINISTRATIF]%', FALSE)
      INTO v_old_mom, v_old_adv, v_admin
      FROM evenements AS e
     WHERE e.id = v_evt;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rencontre introuvable : %', v_evt;
    END IF;

    SELECT
        COALESCE(SUM(cs.valeur_points) FILTER (
            WHERE cs.equipe_concernee = 'notre'   AND cs.annule = FALSE), 0),
        COALESCE(SUM(cs.valeur_points) FILTER (
            WHERE cs.equipe_concernee = 'adverse' AND cs.annule = FALSE), 0),
        COUNT(*) FILTER (WHERE cs.annule = FALSE AND cs.valeur_points <> 0)
      INTO v_score_notre, v_score_adv, v_nb_points
      FROM chronologie_suivi AS cs
     WHERE cs.evenement_uuid = v_evt;

    -- D6-A : score administratif (forfait, MEI…) → jamais écrasé.
    -- D5-B : aucun point dans le suivi → le score existant est conservé.
    IF v_admin OR v_nb_points = 0 THEN
        RETURN QUERY SELECT v_old_mom, v_old_adv;
        RETURN;
    END IF;

    -- Photo de consolidation dans evenements (couplage faible §3.3).
    UPDATE evenements AS e
       SET score_mom     = v_score_notre,
           score_adverse = v_score_adv
     WHERE e.id = v_evt;

    RETURN QUERY SELECT v_score_notre, v_score_adv;
END;
$function$;

-- ---------------------------------------------------------------------
-- 2. D6-A : scores administratifs M16 Régionale 2
-- ---------------------------------------------------------------------
UPDATE public.evenements
   SET notes_resultat = '[SCORE ADMINISTRATIF] MEI — score officiel FFR 25-0 (match joué)'
 WHERE id = 'be01727d-1c12-4b3c-bf16-f52e0337fdcc'          -- R2 J2 Entente Meuse 10/10
   AND score_mom = 25 AND score_adverse = 0;

UPDATE public.evenements
   SET score_mom = 25, score_adverse = 0,
       notes_resultat = '[SCORE ADMINISTRATIF] Score officiel FFR 25-0 (match joué : suivi 90-26)'
 WHERE id = '88b8d2a3-43a4-46fe-b99f-d0e2e51eb07e';         -- R2 J4 Moselle Est 14/11

-- ---------------------------------------------------------------------
-- 3. D4 : durées des périodes des matchs de championnat joués
-- ---------------------------------------------------------------------
INSERT INTO public.suivi_chrono (evenement_uuid, durees_periodes)
SELECT e.id,
       CASE c.code WHEN 'M16' THEN ARRAY[35, 35] ELSE ARRAY[40, 40] END
  FROM public.evenements AS e
  JOIN public.categories AS c ON c.id = e.categorie_id
 WHERE c.code IN ('M16', 'SR-M', 'SR-F')
   AND e.type_competition = 'match_championnat'
   AND e.evenement_parent_id IS NULL
   AND e.etat <> 'annule'
   AND e.date_debut < '2026-11-21 23:59:59+01'
   AND NOT EXISTS (SELECT 1 FROM public.suivi_chrono AS sc WHERE sc.evenement_uuid = e.id);

-- ---------------------------------------------------------------------
-- 4. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_n INTEGER;
BEGIN
    SELECT count(*) INTO v_n FROM pg_proc WHERE proname = 'consolider_score_rencontre';
    IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF : % signature(s) de consolider_score_rencontre', v_n; END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_proc
                    WHERE proname = 'consolider_score_rencontre'
                      AND pg_get_functiondef(oid) LIKE '%SCORE ADMINISTRATIF%') THEN
        RAISE EXCEPTION 'VERIF : garde D6-A absente';
    END IF;

    SELECT count(*) INTO v_n FROM public.evenements
     WHERE id IN ('be01727d-1c12-4b3c-bf16-f52e0337fdcc', '88b8d2a3-43a4-46fe-b99f-d0e2e51eb07e')
       AND notes_resultat LIKE '[SCORE ADMINISTRATIF]%' AND score_mom = 25 AND score_adverse = 0;
    IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF : % score(s) administratif(s) au lieu de 2', v_n; END IF;

    SELECT count(*) INTO v_n
      FROM public.evenements AS e
      JOIN public.categories AS c ON c.id = e.categorie_id
     WHERE c.code IN ('M16', 'SR-M', 'SR-F')
       AND e.type_competition = 'match_championnat'
       AND e.evenement_parent_id IS NULL
       AND e.etat <> 'annule'
       AND e.date_debut < '2026-11-21 23:59:59+01'
       AND NOT EXISTS (SELECT 1 FROM public.suivi_chrono AS sc WHERE sc.evenement_uuid = e.id);
    IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF : % match(s) joué(s) sans durées', v_n; END IF;
END $verif$;

COMMIT;
