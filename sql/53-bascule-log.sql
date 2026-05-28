-- ============================================================================
-- MOM Hub · sql/53-bascule-log.sql
-- ADMIN-(ii) · sous-chantier (2) Saisons + table neuve `bascule_log`
-- Doc FAIT FOI : Conception-UX-ADMIN-ii-v1.md (md5 ca043a48) §3.4.
-- ============================================================================
--
-- Pourquoi TOUT en RPC SECURITY DEFINER (décision UA-5 tranchée PAR LE FAIT) :
--   Sondes 28/05 à la source :
--     · saisons   : relrowsecurity=true, UNE seule policy (SELECT public).
--                   AUCUNE policy INSERT/UPDATE  -> write client = deny.
--     · personnes : relrowsecurity=true, ZÉRO policy (verrou RGPD, pt 15).
--                   -> ni lecture ni écriture client.
--   Donc un bulk client écrirait DANS LE VIDE (leçon REFONTE-EVT-write-M3/M5).
--   Le bulk client n'est pas « moins bon », il est IMPOSSIBLE. Tout passe par
--   des RPC SECURITY DEFINER gardées has_role('admin').
--
-- Schéma réel lu à la source (anti-fabrication pt 14 ; base fait foi, pas sql/01) :
--   · saisons    : requis INSERT = code, libelle, date_debut, date_fin
--                  (NOT NULL sans défaut) ; est_active bool défaut false ;
--                  CHECK(date_fin>date_debut) ; UNIQUE(code) ;
--                  INDEX UNIQUE PARTIEL idx_saisons_une_seule_active
--                  (est_active) WHERE est_active=true  -> mono-active garantie.
--   · personnes  : categorie_id uuid NULL (STOCKÉE, pas calculée) ; sexe text
--                  {M(225)/F(73)/NULL(75)} ; date_naissance date NULL ;
--                  f15_integree bool NOT NULL ; PAS de colonne surclassement ;
--                  categorie_personne LIKE '%joueur%' = scope « joueur » (302).
--   · categories : age_max int NULL ; genre {mixte(8)/M(3)/F(3)} ;
--                  code/libelle_court NOT NULL ; actives MOM = code présent
--                  dans un poles.categories_rattachees (M5 exclue, pt 22).
--
-- Décisions actées avec Manu (28/05, « A » puis « a a a a ») :
--   D1=A  Les 39 joueurs licencie_externe_partenaire SONT inclus (cohérence
--         d'entente). Scope = categorie_personne LIKE '%joueur%' (≈302).
--         Geste de masse assumé sur mineurs incluant des licenciés partenaires.
--   D2=a  bascule_log = table UNIQUE + détail JSONB (lean, P1).
--   D3=a  Surclassement DÉRIVÉ (pas de marqueur base) : categorie_id actuelle
--         <> catégorie dérivée pour la SAISON ACTIVE courante -> « à vérifier ».
--   D4=a  Rollback v1 = stockage bascule_log + SQL manuel. PAS de bouton UI v1.
--   D5=a  applique_par = auth.uid()::text, SANS FK (pattern cree_par/modifie_par,
--         IDENT-SYS non requis).
--   D6=A  (28/05, PROUVÉ par exécution réelle : sur 103 « aucune catégorie
--         dérivable », 95 = séniors/loisir vs 8 vrais cas-limites) — les
--         personnes dont la catégorie ACTUELLE a age_max NULL (SR-M / SR-F /
--         RLO / RLSP) sont EXCLUES du scope de bascule : hors logique
--         millésime, donc absentes des 3 groupes (P5 « nommer pour le sens » :
--         pas de faux « à vérifier »). L'aperçu ne montre que les catégories
--         d'âge. Scope effectif ≈ 207 (302 − 95).
--
-- Règle de dérivation FIGÉE (doc §3.4, NON réinventée) :
--   n = année_début_saison − année_naissance
--   catégorie cible = plus petit age_max > n, filtre genre {sexe, 'mixte'},
--   restreinte aux catégories actives MOM.
--   Exceptions -> groupe « à vérifier » (JAMAIS basculées automatiquement) :
--   date_naissance NULL · sexe NULL · f15_integree · aucune catégorie dérivable
--   (hors grille / fille F en tranche M) · catégorie actuelle NULL ·
--   surclassement dérivé (D3).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR
-- REPLACE FUNCTION). Fail-loud par construction + bloc de vérification final.
-- À EXÉCUTER dans le SQL Editor Supabase, RECOLLER la sortie de vérification.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) TABLE NEUVE bascule_log (D2=a : table unique + détail JSONB)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bascule_log (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  saison_cible_id   uuid NOT NULL REFERENCES public.saisons(id),
  date_application  timestamptz NOT NULL DEFAULT now(),
  applique_par      text,                 -- auth.uid()::text (D5=a, pas de FK)
  nb_basculees      integer NOT NULL,
  detail            jsonb   NOT NULL       -- [{personne_id, categorie_avant, categorie_apres}, …]
);

COMMENT ON TABLE public.bascule_log IS
  'Journal des bascules de catégorie par millésime (ADMIN-(ii) 2b). Rollback v1 = SQL manuel depuis detail. 1 ligne = 1 application de bascule.';

-- RLS : lecture admin seul ; écriture UNIQUEMENT via appliquer_bascule (DEFINER).
ALTER TABLE public.bascule_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture admin du journal de bascule" ON public.bascule_log;
CREATE POLICY "Lecture admin du journal de bascule"
  ON public.bascule_log
  FOR SELECT
  TO authenticated
  USING (public.has_role('admin'));
-- (Pas de policy INSERT/UPDATE/DELETE : RLS active sans policy write = deny ;
--  l'INSERT se fait via appliquer_bascule SECURITY DEFINER qui contourne la RLS.)


-- ----------------------------------------------------------------------------
-- 2) creer_saison — (2a) création simple. saisons non écrivable client.
--    est_active=false à la création (activation = geste séparé, §1).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creer_saison(
  p_code        text,
  p_libelle     text,
  p_date_debut  date,
  p_date_fin    date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF coalesce(btrim(p_code), '') = '' OR coalesce(btrim(p_libelle), '') = ''
     OR p_date_debut IS NULL OR p_date_fin IS NULL THEN
    RAISE EXCEPTION 'Champs requis : code, libelle, date_debut, date_fin.';
  END IF;

  -- CHECK(date_fin>date_debut) + UNIQUE(code) appliqués par la base (fail-loud).
  INSERT INTO public.saisons (code, libelle, date_debut, date_fin, est_active)
  VALUES (btrim(p_code), btrim(p_libelle), p_date_debut, p_date_fin, false)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$func$;


-- ----------------------------------------------------------------------------
-- 3) activer_saison — désactive l'active courante PUIS active la cible,
--    même transaction (respecte idx_saisons_une_seule_active : interdit
--    deux est_active=true simultanés).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activer_saison(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_exists boolean;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  SELECT true INTO v_exists FROM public.saisons WHERE id = p_id;
  IF v_exists IS NULL THEN
    RAISE EXCEPTION 'Saison introuvable : %', p_id;
  END IF;

  -- Ordre obligatoire : OFF l'ancienne, PUIS ON la cible (sinon collision index).
  UPDATE public.saisons
     SET est_active = false, updated_at = now()
   WHERE est_active = true AND id <> p_id;

  UPDATE public.saisons
     SET est_active = true, updated_at = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'saison_id', p_id);
END;
$func$;


-- ----------------------------------------------------------------------------
-- 4) _derive_bascule — RÈGLE FIGÉE, UN SEUL ENDROIT (consommée par aperçu ET
--    appliquer : impossible qu'ils divergent). Interne : REVOKE plus bas pour
--    qu'aucun client ne l'appelle directement (sinon fuite personnes via DEFINER).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._derive_bascule(p_saison_id uuid)
RETURNS TABLE (
  personne_id     uuid,
  nom_court       text,
  cat_avant_id    uuid,
  cat_avant_code  text,
  cat_apres_id    uuid,
  cat_apres_code  text,
  groupe          text,   -- 'a_basculer' | 'inchange' | 'a_verifier'
  motif           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_annee_target int;
  v_annee_active int;
BEGIN
  -- Défense en profondeur (en plus du REVOKE) : interne réservé admin.
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  SELECT extract(year FROM date_debut)::int INTO v_annee_target
  FROM public.saisons WHERE id = p_saison_id;
  IF v_annee_target IS NULL THEN
    RAISE EXCEPTION 'Saison cible introuvable : %', p_saison_id;
  END IF;

  -- Saison active courante (référence pour la détection de surclassement, D3).
  -- Peut être NULL si aucune saison active : dans ce cas la détection de
  -- surclassement est neutralisée (on ne peut pas comparer honnêtement).
  SELECT extract(year FROM date_debut)::int INTO v_annee_active
  FROM public.saisons WHERE est_active = true;

  RETURN QUERY
  WITH joueurs AS (
    SELECT p.id, p.prenom, p.nom, p.sexe, p.date_naissance,
           p.categorie_id, p.f15_integree
    FROM public.personnes p
    LEFT JOIN public.categories c_cur ON c_cur.id = p.categorie_id
    WHERE p.categorie_personne LIKE '%joueur%'          -- D1=A (partenaires inclus)
      AND NOT (p.categorie_id IS NOT NULL AND c_cur.age_max IS NULL)  -- D6=A (séniors/loisir hors scope)
  ),
  calc AS (
    SELECT
      j.id,
      btrim(coalesce(j.prenom, '') || ' ' || upper(coalesce(j.nom, ''))) AS nm,
      j.categorie_id AS av_id,
      tgt.id         AS ap_id,   -- catégorie dérivée pour la saison CIBLE
      cur.id         AS cur_id,  -- catégorie dérivée pour la saison ACTIVE
      j.date_naissance, j.sexe, j.f15_integree
    FROM joueurs j
    LEFT JOIN LATERAL (
      SELECT c.id
      FROM public.categories c
      WHERE c.age_max IS NOT NULL
        AND c.age_max > (v_annee_target - extract(year FROM j.date_naissance)::int)
        AND (c.genre = 'mixte' OR c.genre = j.sexe)
        AND EXISTS (SELECT 1 FROM public.poles po
                    WHERE c.code = ANY (po.categories_rattachees))
      ORDER BY c.age_max ASC, c.code ASC
      LIMIT 1
    ) tgt ON true
    LEFT JOIN LATERAL (
      SELECT c.id
      FROM public.categories c
      WHERE v_annee_active IS NOT NULL
        AND c.age_max IS NOT NULL
        AND c.age_max > (v_annee_active - extract(year FROM j.date_naissance)::int)
        AND (c.genre = 'mixte' OR c.genre = j.sexe)
        AND EXISTS (SELECT 1 FROM public.poles po
                    WHERE c.code = ANY (po.categories_rattachees))
      ORDER BY c.age_max ASC, c.code ASC
      LIMIT 1
    ) cur ON true
  )
  SELECT
    calc.id,
    calc.nm,
    calc.av_id,
    cav.code,
    calc.ap_id,
    cap.code,
    CASE
      WHEN calc.f15_integree                       THEN 'a_verifier'
      WHEN calc.date_naissance IS NULL             THEN 'a_verifier'
      WHEN calc.sexe IS NULL                       THEN 'a_verifier'
      WHEN calc.ap_id IS NULL                       THEN 'a_verifier'  -- hors grille / fille F tranche M
      WHEN calc.av_id IS NULL                       THEN 'a_verifier'  -- pas de catégorie actuelle
      WHEN v_annee_active IS NOT NULL AND calc.cur_id IS NOT NULL
           AND calc.av_id <> calc.cur_id            THEN 'a_verifier'  -- surclassement dérivé (D3)
      WHEN calc.av_id = calc.ap_id                  THEN 'inchange'
      ELSE 'a_basculer'
    END AS grp,
    CASE
      WHEN calc.f15_integree                       THEN 'F15 intégrée'
      WHEN calc.date_naissance IS NULL             THEN 'date de naissance manquante'
      WHEN calc.sexe IS NULL                       THEN 'sexe non renseigné'
      WHEN calc.ap_id IS NULL                       THEN 'aucune catégorie dérivable (hors grille / fille en tranche M)'
      WHEN calc.av_id IS NULL                       THEN 'aucune catégorie actuelle'
      WHEN v_annee_active IS NOT NULL AND calc.cur_id IS NOT NULL
           AND calc.av_id <> calc.cur_id            THEN 'placement manuel (sur/déclassement) — non basculé automatiquement'
      ELSE NULL
    END AS mtf
  FROM calc
  LEFT JOIN public.categories cav ON cav.id = calc.av_id
  LEFT JOIN public.categories cap ON cap.id = calc.ap_id;
END;
$func$;


-- ----------------------------------------------------------------------------
-- 5) apercu_bascule — LECTURE SEULE. Payload RGPD minimal (id, nom court, codes
--    catégorie, groupe, motif). personnes JAMAIS exposée au client (0 policy
--    SELECT) : seul ce payload réduit sort.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apercu_bascule(p_saison_id uuid)
RETURNS TABLE (
  personne_id  uuid,
  nom_court    text,
  cat_avant    text,
  cat_apres    text,
  groupe       text,
  motif        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT d.personne_id, d.nom_court, d.cat_avant_code, d.cat_apres_code,
         d.groupe, d.motif
  FROM public._derive_bascule(p_saison_id) d
  ORDER BY d.groupe, d.cat_apres_code NULLS LAST, d.nom_court;
END;
$func$;


-- ----------------------------------------------------------------------------
-- 6) appliquer_bascule — RECALCULE serveur le groupe « à basculer » (ne fait
--    PAS confiance à une liste client : « lecture seule jusqu'à Appliquer »
--    garanti). UPDATE personnes.categorie_id + INSERT bascule_log, une seule
--    transaction (fonction = atomique), fail-loud (nb modifiées = nb attendues).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.appliquer_bascule(p_saison_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_attendu  int;
  v_modifie  int;
  v_detail   jsonb;
  v_log_id   uuid;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  DROP TABLE IF EXISTS _basc_tmp;
  CREATE TEMP TABLE _basc_tmp ON COMMIT DROP AS
    SELECT personne_id, cat_avant_id, cat_apres_id
    FROM public._derive_bascule(p_saison_id)
    WHERE groupe = 'a_basculer';

  SELECT count(*)::int INTO v_attendu FROM _basc_tmp;

  IF v_attendu = 0 THEN
    RETURN jsonb_build_object('ok', true, 'nb_basculees', 0, 'log_id', NULL,
      'message', 'Aucune personne à basculer pour cette saison.');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'personne_id',     personne_id,
           'categorie_avant', cat_avant_id,
           'categorie_apres', cat_apres_id))
    INTO v_detail
  FROM _basc_tmp;

  UPDATE public.personnes p
     SET categorie_id = b.cat_apres_id,
         updated_at   = now()
    FROM _basc_tmp b
   WHERE p.id = b.personne_id;

  GET DIAGNOSTICS v_modifie = ROW_COUNT;

  -- Fail-loud : tout ce qui était prévu doit avoir été écrit (sinon ROLLBACK).
  IF v_modifie <> v_attendu THEN
    RAISE EXCEPTION 'Incohérence bascule : % personnes modifiées vs % attendues.',
      v_modifie, v_attendu;
  END IF;

  INSERT INTO public.bascule_log (saison_cible_id, applique_par, nb_basculees, detail)
  VALUES (p_saison_id, auth.uid()::text, v_modifie, v_detail)
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('ok', true, 'nb_basculees', v_modifie, 'log_id', v_log_id);
END;
$func$;


-- ----------------------------------------------------------------------------
-- 7) GRANTS — RPC publiques exposées (garde has_role à l'intérieur) ;
--    _derive_bascule REVOQUÉE du client (appelée seulement par aperçu/appliquer).
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._derive_bascule(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._derive_bascule(uuid) FROM authenticated, anon;

GRANT EXECUTE ON FUNCTION public.creer_saison(text, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activer_saison(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apercu_bascule(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.appliquer_bascule(uuid)               TO authenticated;


-- ----------------------------------------------------------------------------
-- 8) VÉRIFICATION FAIL-LOUD (état-cible). RAISE si une pièce manque.
-- ----------------------------------------------------------------------------
DO $verif$
DECLARE
  v_table     int;
  v_policy    int;
  v_secdef    int;
  v_derive    int;
BEGIN
  SELECT count(*) INTO v_table
  FROM information_schema.tables
  WHERE table_schema='public' AND table_name='bascule_log';
  IF v_table <> 1 THEN RAISE EXCEPTION 'Vérif KO : table bascule_log absente.'; END IF;

  SELECT count(*) INTO v_policy
  FROM pg_policies
  WHERE schemaname='public' AND tablename='bascule_log' AND cmd='SELECT';
  IF v_policy <> 1 THEN RAISE EXCEPTION 'Vérif KO : policy SELECT bascule_log absente.'; END IF;

  -- 4 RPC exposées doivent être SECURITY DEFINER (prosecdef=true).
  SELECT count(*) INTO v_secdef
  FROM pg_proc
  WHERE proname IN ('creer_saison','activer_saison','apercu_bascule','appliquer_bascule')
    AND pronamespace = 'public'::regnamespace
    AND prosecdef = true;
  IF v_secdef <> 4 THEN
    RAISE EXCEPTION 'Vérif KO : % RPC SECURITY DEFINER trouvées sur 4 attendues.', v_secdef;
  END IF;

  -- _derive_bascule existe et n'est PAS exécutable par authenticated.
  SELECT count(*) INTO v_derive
  FROM pg_proc
  WHERE proname='_derive_bascule' AND pronamespace='public'::regnamespace;
  IF v_derive <> 1 THEN RAISE EXCEPTION 'Vérif KO : _derive_bascule absente.'; END IF;
  IF has_function_privilege('authenticated', 'public._derive_bascule(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Vérif KO : _derive_bascule encore exécutable par authenticated (REVOKE raté).';
  END IF;

  RAISE NOTICE 'sql/53 OK : bascule_log + 1 policy + 4 RPC SECURITY DEFINER + _derive_bascule REVOQUÉE.';
END;
$verif$;

COMMIT;

-- ============================================================================
-- PREUVE À LA SOURCE (recoller la sortie) — à exécuter APRÈS le COMMIT.
-- L'aperçu doit donner 3 groupes ; rien n'est écrit tant que appliquer_bascule
-- n'est pas appelée.
-- ============================================================================
-- -- Remplace <SAISON_CIBLE> par l'UUID de la saison N+1 (créée via creer_saison) :
-- SELECT groupe, count(*) AS n
-- FROM public.apercu_bascule('<SAISON_CIBLE>')
-- GROUP BY groupe ORDER BY groupe;
--
-- -- Échantillon lisible (10 lignes) :
-- SELECT nom_court, cat_avant, cat_apres, groupe, motif
-- FROM public.apercu_bascule('<SAISON_CIBLE>')
-- ORDER BY groupe, cat_apres NULLS LAST, nom_court
-- LIMIT 10;
-- ============================================================================
