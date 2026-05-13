-- =====================================================================
-- sql/21-rpc-vivier-compo.sql
-- =====================================================================
-- Phase 4.3 — RPC get_vivier_compo(p_equipe_id UUID)
--
-- Retourne le vivier de joueurs piochables pour composer une équipe sur
-- un événement donné. Pivot via equipes.entente_id → ententes.categorie_id
-- (cf. Modelisation-Evenements-v1.1.md §4.3, "Vivier de pioche").
--
-- Inclut naturellement :
--   - Joueurs MOM de la catégorie nominale       (categorie_id match)
--   - Joueurs partenaires d'entente SAR/ASCS     (idem catégorie, club ≠ MOM)
--   - F-15 intégrées si catégorie cible = M14    (flag personnes.f15_integree)
--   - TODO M-1 : surclassés officiels            (categorie_surclassement_id
--                                                 sera ajouté à personnes)
--
-- LEFT JOIN à equipe_joueurs pour renvoyer le statut d'attache :
--   - 'regulier' / 'renfort_temporaire' / 'en_transition' = déjà tracé
--   - NULL = renfort potentiel à tracer si la compo est validée
--
-- Référence : STATE.md §C7-e ; doc §4.3 vivier ; doc §10.1 dette M-1.
--
-- Conventions Production (cf. Phase 4.2.B) :
--   - SECURITY DEFINER, authenticated-only (REVOKE PUBLIC + GRANT authenticated)
--   - Paramètre préfixé p_
--   - search_path verrouillé à public
--
-- Auteur : conv Production · 14 mai 2026
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_vivier_compo(p_equipe_id UUID)
RETURNS TABLE (
  joueur_id                 UUID,
  nom                       TEXT,
  prenom                    TEXT,
  sexe                      TEXT,
  date_naissance            DATE,
  categorie_id              UUID,
  categorie_libelle_court   TEXT,
  club_principal_id         UUID,
  club_principal_nom_court  TEXT,
  type_personne             TEXT,
  f15_integree              BOOLEAN,
  est_partenaire_entente    BOOLEAN,
  -- est_surclasse          BOOLEAN  -- TODO M-1 (categorie_surclassement_id)
  statut_attache            TEXT,        -- regulier/renfort_temporaire/en_transition/NULL
  niveau_profil             TEXT,        -- Performance/Développement/Initiation
  date_affectation          DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categorie_id              UUID;
  v_categorie_code            TEXT;
  v_club_principal_entente_id UUID;
BEGIN
  -- 1. Résoudre la catégorie cible + club principal de l'entente parent
  SELECT en.categorie_id, c.code, en.club_principal_id
    INTO v_categorie_id, v_categorie_code, v_club_principal_entente_id
  FROM equipes      e
  JOIN ententes     en ON e.entente_id   = en.id
  JOIN categories   c  ON en.categorie_id = c.id
  WHERE e.id = p_equipe_id;

  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Équipe % introuvable ou sans entente parent.', p_equipe_id;
  END IF;

  -- 2. Renvoyer le vivier filtré + statut d'attache
  RETURN QUERY
  SELECT
    p.id                                                              AS joueur_id,
    p.nom,
    p.prenom,
    p.sexe,
    p.date_naissance,
    p.categorie_id,
    cat.libelle_court                                                 AS categorie_libelle_court,
    p.club_principal_id,
    clb.nom_court                                                     AS club_principal_nom_court,
    p.type_personne,
    p.f15_integree,
    (p.club_principal_id IS DISTINCT FROM v_club_principal_entente_id) AS est_partenaire_entente,
    ej.statut                                                         AS statut_attache,
    ej.niveau_profil,
    ej.date_affectation
  FROM personnes p
  LEFT JOIN categories cat ON p.categorie_id      = cat.id
  LEFT JOIN clubs      clb ON p.club_principal_id = clb.id
  LEFT JOIN equipe_joueurs ej
         ON ej.equipe_id    = p_equipe_id
        AND ej.personne_id  = p.id
        AND ej.date_sortie IS NULL
  WHERE p.categorie_personne = 'joueur'
    AND (
          p.categorie_id = v_categorie_id
       OR (p.f15_integree = TRUE AND v_categorie_code = 'M14')
       -- TODO M-1 : OR p.categorie_surclassement_id = v_categorie_id
        )
  ORDER BY
    CASE ej.statut
      WHEN 'regulier'           THEN 1
      WHEN 'renfort_temporaire' THEN 2
      WHEN 'en_transition'      THEN 3
      ELSE                           4   -- NULL = pas attaché
    END,
    p.nom,
    p.prenom;
END;
$$;

-- Permissions : authenticated only (pattern Phase 4.2.B)
REVOKE ALL  ON FUNCTION public.get_vivier_compo(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vivier_compo(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_vivier_compo(UUID) IS
  'Phase 4.3 — Vivier de pioche pour composer une équipe. Filtre personnes '
  'par catégorie de l''entente parent (+ F-15 intégrées si M14), LEFT JOIN '
  'equipe_joueurs pour le statut d''attache. Inclut naturellement les '
  'partenaires d''entente SAR/ASCS via leur categorie_id. TODO M-1 : '
  'intégrer les surclassés officiels une fois categorie_surclassement_id '
  'ajouté à personnes.';

COMMIT;


-- =====================================================================
-- Smoke test (à exécuter séparément après le COMMIT) :
--
-- 1) Récupérer l'UUID de l'équipe M14 EQ1
--    SELECT e.id FROM equipes e
--    JOIN ententes en ON e.entente_id = en.id
--    JOIN categories c ON en.categorie_id = c.id
--    WHERE c.code = 'M14' AND e.numero_equipe = 1;
--
-- 2) Appeler la RPC
--    SELECT * FROM get_vivier_compo('<uuid_m14_eq1>');
--
-- 3) Vérifier les contrats :
--    SELECT
--      COUNT(*)                                                 AS total,
--      COUNT(*) FILTER (WHERE statut_attache = 'regulier')      AS reguliers,
--      COUNT(*) FILTER (WHERE est_partenaire_entente = TRUE)    AS partenaires,
--      COUNT(*) FILTER (WHERE f15_integree = TRUE)              AS f15,
--      COUNT(*) FILTER (WHERE statut_attache IS NULL)           AS non_attaches
--    FROM get_vivier_compo('<uuid_m14_eq1>');
--
-- Attendu (sur la base actuelle au 14 mai 2026) :
--    total       = 62 minimum  (23 MOM + 39 partenaires, + éventuels non-attachés)
--    reguliers   = 62          (les 23 + 39 ont tous statut='regulier' après sql/17)
--    partenaires = 39          (SAR/ASCS via club_principal_id ≠ MOM de l'entente)
--    f15         = 6+          (les F-15 intégrées de l'effectif)
--    non_attaches = 0 si tous les M14 de personnes sont attachés via Vague 1+sql/17
--
-- =====================================================================

-- =====================================================================
-- ROLLBACK manuel si problème détecté :
--   DROP FUNCTION IF EXISTS public.get_vivier_compo(UUID);
-- =====================================================================
