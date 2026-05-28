-- ============================================================================
-- sql/57 — FUSION DES DOUBLONS D'IDENTITÉ (joueur OVAL-E + staff SportEasy)
-- ----------------------------------------------------------------------------
-- Chantier Production A du doc FAIT FOI `Conception-IDENT-SYS-v1.md` (md5 7b6bd06a),
-- Volet A §1. Conception tranchée pt 29 ; exécuté ici en Production.
--
-- OBJET : fusionner les 4 doublons d'identité prouvés (un individu = 2 fiches
--   `personnes` : 1 joueur issue de l'import OVAL-E [licence FFR + uuid_legacy],
--   1 staff issue de l'import SportEasy [licence+legacy NULL]). La fiche joueur
--   OVAL-E SURVIT ; la fiche staff SportEasy est ABSORBÉE. La survivante passe en
--   `categorie_personne='joueur_et_staff'` (décision Manu A4, modèle RULFO).
--
-- LOT (prouvé sondes 1/2, pt 29 — 8 IDs explicites, AUCUN élargissement auto A5) :
--   BELKIS Anne     : survivante dfb8a23e… / absorbée de5fbc9b…
--   HELM Loic       : survivante 62c801db… / absorbée 64fa20f3…
--   LACOMBE Baptiste: survivante 8d4e1b3f… / absorbée 682fa749…
--   VOEGELI Lorène  : survivante e7e979ae… / absorbée 411f3f0d…
--
-- MÉTHODE (anti-fabrication STATE pt 14) : tout ci-dessous est ancré sur des
--   sondes lecture seule réelles confrontées au doc §1.5 :
--   - S3  : `personnes` RLS active + 0 policy  → RPC SECURITY DEFINER admin (le
--           client ne peut pas écrire) — §1.8.
--   - S4  : clés d'unicité réelles
--           `collectif_membre_unique (personne_id, entente_id, role, date_debut)`
--           `equipe_joueurs … (equipe_id, personne_id, date_affectation)`.
--   - S5  : inventaire FK entrantes = §1.5 au mot près ; `auth_personne` ABSENTE
--           (Volet B non déployé → hors report, §2.4).
--   - S6a : audit NO ACTION (compositions.cree_par/modifie_par, presences.saisie_par)
--           VIDES → A6, aucun report/neutralisation audit.
--   - S6b : rattachements réels des absorbées = 3 lignes `collectif_membre`
--           (BELKIS/HELM/VOEGELI), LACOMBE staff = nu ; tout le reste = 0 ;
--           AUCUN RESTRICT non nul → aucun blocage de suppression.
--   - S7  : aucune collision d'unicité (role='staff' côté absorbée) → les 3 lignes
--           se REPOINTENT (pas de dédoublonnage réel) ; logique de dédoublon
--           néanmoins codée (robustesse/idempotence, piège 1 §1.6).
--
-- DÉCISIONS TECHNIQUES MINEURES DÉLÉGUÉES (mémoire pt 17 — tracées, non re-sollicitées) :
--   D1. unaccent ABSENT en base (sonde 2bis) → détection embarquée via translate()
--       (équivalent prouvé sonde 2 ; couvre Lorène/Lorene). Écart §1.3 acté.
--   D2. DDL `ident_fusion_log` figé ici (cf. §1.7) : journal réversibilité + RLS SELECT admin.
--   D3. Signatures RPC : apercu_fusion_identite() lecture seule ;
--       appliquer_fusion_identite(p_confirmer boolean) — garde-fou de confirmation
--       explicite calqué patron appliquer_bascule (pt 24).
--   D4. Le lot est FIGÉ en dur dans une vue interne (les 4 paires prouvées), pas
--       piloté par la détection auto (A5). La détection translate() tourne en
--       CONTRÔLE dans l'aperçu pour signaler tout doublon HORS lot.
--
-- ORDRE CANONIQUE (§1.6.3), par paire : (a) reporter/dédoublonner rattachements
--   métier → (b) audit : rien (prouvé vide) → (c) survivante → 'joueur_et_staff'
--   → (d) supprimer l'absorbée → journaliser.
--
-- IDEMPOTENT (pré-check existence des 2 fiches ; relance = no-op si absorbée
--   disparue) · FAIL-LOUD (RESTRICT non reporté = EXCEPTION) · RÉVERSIBLE
--   (snapshot + rattachements dans ident_fusion_log) · DRY-RUN D'ABORD (aperçu
--   validé AVANT toute écriture, patron apercu_bascule/appliquer_bascule pt 24).
-- ============================================================================

-- ============================================================================
-- PARTIE 1 — TABLE DE JOURNAL (réversibilité §1.7) — idempotente
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ident_fusion_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survivante_id   uuid NOT NULL,
  absorbee_id     uuid NOT NULL,
  snapshot_absorbee jsonb NOT NULL,          -- fiche personnes absorbée, telle qu'avant suppression
  rattachements   jsonb NOT NULL,            -- {repointes:[...], supprimes:[...], neutralises:[...]}
  applique_par    uuid,                      -- auth.uid() de l'admin exécutant
  applique_le     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ident_fusion_log IS
  'Journal des fusions d''identité (sql/57). Réversibilité : snapshot de la fiche absorbée + rattachements repointés/supprimés/neutralisés, pour rollback manuel et audit. Doc FAIT FOI Conception-IDENT-SYS-v1.md §1.7.';

-- RLS : SELECT réservé admin (cohérent personnes/bascule_log).
ALTER TABLE public.ident_fusion_log ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ident_fusion_log'
      AND policyname = 'ident_fusion_log_select_admin'
  ) THEN
    CREATE POLICY ident_fusion_log_select_admin
      ON public.ident_fusion_log
      FOR SELECT
      USING (public.has_role('admin'));
  END IF;
END
$rls$;

-- ============================================================================
-- PARTIE 2 — VUE INTERNE DU LOT (les 4 paires prouvées, FIGÉES — A5)
-- ----------------------------------------------------------------------------
-- Le lot n'est PAS piloté par la détection auto (jamais d'élargissement sans
-- accord Manu). Ces 8 IDs sont ceux des sondes 1/2/5/6/7, pt 29.
-- ============================================================================
CREATE OR REPLACE VIEW public._ident_fusion_lot AS
SELECT * FROM (
  VALUES
    ('BELKIS Anne',      'dfb8a23e-9131-40db-9e63-4b6408c9e068'::uuid, 'de5fbc9b-159b-4235-9c2b-9fba0ed64ecb'::uuid),
    ('HELM Loic',        '62c801db-85c3-4c2f-a5c7-34e0f4cf1f1d'::uuid, '64fa20f3-7351-4539-8632-7af794cbd800'::uuid),
    ('LACOMBE Baptiste', '8d4e1b3f-5638-48c2-98da-22ac913ce676'::uuid, '682fa749-d0ce-4719-b366-60cc3f16b1a3'::uuid),
    ('VOEGELI Lorene',   'e7e979ae-b424-475a-9d2e-33e9d2a12b61'::uuid, '411f3f0d-6c82-489a-a99c-85c5ebfa0d60'::uuid)
) AS t(label, survivante_id, absorbee_id);

REVOKE ALL ON public._ident_fusion_lot FROM anon, authenticated;

-- ============================================================================
-- PARTIE 3 — HELPER INTERNE : normalisation accents (D1, unaccent absent)
-- ----------------------------------------------------------------------------
-- Équivalent fonctionnel d'unaccent(lower(trim(x))) prouvé par sonde 2.
-- IMMUTABLE pour pouvoir être utilisé librement.
-- ============================================================================
CREATE OR REPLACE FUNCTION public._ident_norm(p_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(translate(
    coalesce(p_txt, ''),
    'àâäáãåçčéèêëẽíìîïñóòôöõúùûüýÿœæÀÂÄÁÃÅÇČÉÈÊËẼÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆ',
    'aaaaaacceeeeeiiiinooooouuuuyyoeAAAAAACCEEEEEIIIINOOOOOUUUUYYOE'
  )));
$$;

REVOKE ALL ON FUNCTION public._ident_norm(text) FROM anon, authenticated;

-- ============================================================================
-- PARTIE 4 — RPC APERÇU (dry-run, lecture seule) — §1.7 / §1.8
-- ----------------------------------------------------------------------------
-- Retourne, par paire du lot : l'état de présence des 2 fiches, la catégorie
-- cible, et le détail des rattachements métier qui bougeront (repointés vs
-- supprimés-pour-doublon), table par table. + un bloc CONTRÔLE signalant tout
-- doublon homonyme HORS lot (détection translate()), pour confirmer A5.
-- SECURITY DEFINER + garde admin (personnes RLS fermée, S3).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apercu_fusion_identite()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_lot          jsonb := '[]'::jsonb;
  v_hors_lot     jsonb := '[]'::jsonb;
  r              record;
  v_paire        jsonb;
  v_ratt         jsonb;
  v_surv_exists  boolean;
  v_abs_exists   boolean;
  v_surv_cat     text;
  v_abs_cat      text;
BEGIN
  -- Garde admin (fail-loud)
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'apercu_fusion_identite: accès refusé (rôle admin requis)';
  END IF;

  -- ---- (A) Détail par paire du lot ----
  FOR r IN SELECT label, survivante_id, absorbee_id FROM public._ident_fusion_lot LOOP

    SELECT EXISTS(SELECT 1 FROM personnes WHERE id = r.survivante_id),
           EXISTS(SELECT 1 FROM personnes WHERE id = r.absorbee_id)
      INTO v_surv_exists, v_abs_exists;

    SELECT categorie_personne INTO v_surv_cat FROM personnes WHERE id = r.survivante_id;
    SELECT categorie_personne INTO v_abs_cat  FROM personnes WHERE id = r.absorbee_id;

    -- Rattachements métier de l'absorbée (les 11 FN §1.5), avec verdict repoint/suppr.
    -- collectif_membre & equipe_joueurs : dédoublonnage sur clé d'unicité réelle (S4).
    v_ratt := jsonb_build_object(
      'collectif_membre', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'id', cm.id, 'entente_id', cm.entente_id, 'role', cm.role,
                 'date_debut', cm.date_debut,
                 'action', CASE WHEN EXISTS (
                     SELECT 1 FROM collectif_membre s
                     WHERE s.personne_id = r.survivante_id
                       AND s.entente_id  = cm.entente_id
                       AND s.role        = cm.role
                       AND s.date_debut  = cm.date_debut)
                   THEN 'supprimer_doublon' ELSE 'repointer' END)), '[]'::jsonb)
        FROM collectif_membre cm WHERE cm.personne_id = r.absorbee_id),
      'equipe_joueurs', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'id', ej.id, 'equipe_id', ej.equipe_id, 'date_affectation', ej.date_affectation,
                 'action', CASE WHEN EXISTS (
                     SELECT 1 FROM equipe_joueurs s
                     WHERE s.personne_id = r.survivante_id
                       AND s.equipe_id   = ej.equipe_id
                       AND s.date_affectation = ej.date_affectation)
                   THEN 'supprimer_doublon' ELSE 'repointer' END)), '[]'::jsonb)
        FROM equipe_joueurs ej WHERE ej.personne_id = r.absorbee_id),
      'composition_joueurs', (SELECT count(*) FROM composition_joueurs   WHERE joueur_id            = r.absorbee_id),
      'presences',           (SELECT count(*) FROM presences             WHERE personne_id          = r.absorbee_id),
      'evenement_encadrants',(SELECT count(*) FROM evenement_encadrants  WHERE personne_id          = r.absorbee_id),
      'evenements_organisateur',(SELECT count(*) FROM evenements         WHERE organisateur_principal_id = r.absorbee_id),
      'chronologie_suivi',   (SELECT count(*) FROM chronologie_suivi     WHERE joueur_uuid          = r.absorbee_id),
      'equipes_coach',       (SELECT count(*) FROM equipes               WHERE coach_principal_id   = r.absorbee_id),
      'equipes_manager',     (SELECT count(*) FROM equipes               WHERE manager_id           = r.absorbee_id),
      'poles_responsable',   (SELECT count(*) FROM poles                 WHERE responsable_principal_id = r.absorbee_id),
      'poles_co_responsable',(SELECT count(*) FROM poles                 WHERE co_responsable_id    = r.absorbee_id)
    );

    v_paire := jsonb_build_object(
      'label', r.label,
      'survivante_id', r.survivante_id,
      'absorbee_id', r.absorbee_id,
      'survivante_existe', v_surv_exists,
      'absorbee_existe', v_abs_exists,
      'categorie_survivante_actuelle', v_surv_cat,
      'categorie_survivante_cible', 'joueur_et_staff',
      'statut',
        CASE
          WHEN NOT v_abs_exists THEN 'deja_fusionne_ou_absorbee_absente'
          WHEN NOT v_surv_exists THEN 'ERREUR_survivante_absente'
          ELSE 'a_fusionner'
        END,
      'rattachements', v_ratt
    );

    v_lot := v_lot || v_paire;
  END LOOP;

  -- ---- (B) Contrôle A5 : doublons homonymes HORS lot (détection translate()) ----
  -- Tout groupe homonyme >1 fiche dont au moins un ID n'est PAS dans le lot.
  WITH norm AS (
    SELECT id, _ident_norm(nom) AS n, _ident_norm(prenom) AS p, date_naissance,
           categorie_personne, source_creation
    FROM personnes
  ),
  groupes AS (
    SELECT n, p, date_naissance,
           count(*) AS nb,
           jsonb_agg(jsonb_build_object('id', id, 'cat', categorie_personne, 'src', source_creation)
                     ORDER BY source_creation) AS fiches,
           array_agg(id) AS ids
    FROM norm
    GROUP BY n, p, date_naissance
    HAVING count(*) > 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'nom', n, 'prenom', p, 'date_naissance', date_naissance,
           'nb', nb, 'fiches', fiches)), '[]'::jsonb)
    INTO v_hors_lot
  FROM groupes g
  WHERE NOT (
    g.ids <@ ARRAY(SELECT survivante_id FROM public._ident_fusion_lot
                   UNION SELECT absorbee_id FROM public._ident_fusion_lot)
  );

  RETURN jsonb_build_object(
    'genere_le', now(),
    'lot', v_lot,
    'doublons_hors_lot', v_hors_lot,
    'note', 'Dry-run lecture seule. Aucune écriture. Valider avant appliquer_fusion_identite(true).'
  );
END
$func$;

REVOKE ALL ON FUNCTION public.apercu_fusion_identite() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apercu_fusion_identite() TO authenticated;

-- ============================================================================
-- PARTIE 5 — RPC APPLIQUER (écriture réelle, transaction, fail-loud) — §1.6/§1.7
-- ----------------------------------------------------------------------------
-- Garde admin + garde-fou de confirmation (p_confirmer = true requis).
-- Pour chaque paire EXISTANTE (idempotence : skip si absorbée absente) :
--   (a) reporter/dédoublonner collectif_membre + equipe_joueurs (clé d'unicité S4) ;
--       repointer les 9 autres FK métier (toutes à 0 aujourd'hui — codées robustes) ;
--   (b) audit : rien (prouvé vide S6a — fail-loud si une RESTRICT survenait) ;
--   (c) survivante → categorie_personne='joueur_et_staff' ;
--   (d) snapshot + DELETE absorbée + INSERT ident_fusion_log.
-- Toute la procédure est dans une transaction implicite de fonction : une
-- EXCEPTION annule TOUT (rollback complet, base intacte).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.appliquer_fusion_identite(p_confirmer boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  r              record;
  v_uid          uuid := auth.uid();
  v_resultats    jsonb := '[]'::jsonb;
  v_snapshot     jsonb;
  v_repointes    jsonb;
  v_supprimes    jsonb;
  v_cm           record;
  v_ej           record;
  v_restrict_cnt bigint;
BEGIN
  -- Gardes (fail-loud)
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'appliquer_fusion_identite: accès refusé (rôle admin requis)';
  END IF;
  IF p_confirmer IS NOT TRUE THEN
    RAISE EXCEPTION 'appliquer_fusion_identite: confirmation requise (appeler avec p_confirmer => true après validation de l''aperçu)';
  END IF;

  FOR r IN SELECT label, survivante_id, absorbee_id FROM public._ident_fusion_lot LOOP

    -- Idempotence : si l'absorbée n'existe plus, paire déjà traitée → skip.
    IF NOT EXISTS (SELECT 1 FROM personnes WHERE id = r.absorbee_id) THEN
      v_resultats := v_resultats || jsonb_build_object(
        'label', r.label, 'absorbee_id', r.absorbee_id, 'statut', 'skip_deja_fusionne');
      CONTINUE;
    END IF;

    -- Garde-fou : la survivante DOIT exister (sinon incohérence → fail-loud).
    IF NOT EXISTS (SELECT 1 FROM personnes WHERE id = r.survivante_id) THEN
      RAISE EXCEPTION 'appliquer_fusion_identite: survivante % absente pour le lot % (incohérence, abandon)',
        r.survivante_id, r.label;
    END IF;

    v_repointes := '[]'::jsonb;
    v_supprimes := '[]'::jsonb;

    -- Snapshot AVANT toute mutation (réversibilité)
    SELECT to_jsonb(p.*) INTO v_snapshot FROM personnes p WHERE p.id = r.absorbee_id;

    -- ---- (a) collectif_membre : dédoublonner sur (entente_id, role, date_debut) ----
    FOR v_cm IN SELECT * FROM collectif_membre WHERE personne_id = r.absorbee_id LOOP
      IF EXISTS (
        SELECT 1 FROM collectif_membre s
        WHERE s.personne_id = r.survivante_id
          AND s.entente_id  = v_cm.entente_id
          AND s.role        = v_cm.role
          AND s.date_debut  = v_cm.date_debut
      ) THEN
        DELETE FROM collectif_membre WHERE id = v_cm.id;
        v_supprimes := v_supprimes || jsonb_build_object('table','collectif_membre','id',v_cm.id);
      ELSE
        UPDATE collectif_membre SET personne_id = r.survivante_id WHERE id = v_cm.id;
        v_repointes := v_repointes || jsonb_build_object('table','collectif_membre','id',v_cm.id);
      END IF;
    END LOOP;

    -- ---- (a) equipe_joueurs : dédoublonner sur (equipe_id, date_affectation) ----
    FOR v_ej IN SELECT * FROM equipe_joueurs WHERE personne_id = r.absorbee_id LOOP
      IF EXISTS (
        SELECT 1 FROM equipe_joueurs s
        WHERE s.personne_id = r.survivante_id
          AND s.equipe_id   = v_ej.equipe_id
          AND s.date_affectation = v_ej.date_affectation
      ) THEN
        DELETE FROM equipe_joueurs WHERE id = v_ej.id;
        v_supprimes := v_supprimes || jsonb_build_object('table','equipe_joueurs','id',v_ej.id);
      ELSE
        UPDATE equipe_joueurs SET personne_id = r.survivante_id WHERE id = v_ej.id;
        v_repointes := v_repointes || jsonb_build_object('table','equipe_joueurs','id',v_ej.id);
      END IF;
    END LOOP;

    -- ---- (a) FK métier sans contrainte d'unicité bloquante : repointage direct ----
    -- (toutes à 0 aujourd'hui, S6b — codées pour robustesse/idempotence)
    UPDATE composition_joueurs  SET joueur_id   = r.survivante_id WHERE joueur_id   = r.absorbee_id;
    UPDATE presences            SET personne_id = r.survivante_id WHERE personne_id = r.absorbee_id;
    UPDATE evenement_encadrants SET personne_id = r.survivante_id WHERE personne_id = r.absorbee_id;
    UPDATE evenements           SET organisateur_principal_id = r.survivante_id WHERE organisateur_principal_id = r.absorbee_id;
    UPDATE chronologie_suivi    SET joueur_uuid = r.survivante_id WHERE joueur_uuid = r.absorbee_id;
    UPDATE equipes              SET coach_principal_id = r.survivante_id WHERE coach_principal_id = r.absorbee_id;
    UPDATE equipes              SET manager_id  = r.survivante_id WHERE manager_id  = r.absorbee_id;
    UPDATE poles                SET responsable_principal_id = r.survivante_id WHERE responsable_principal_id = r.absorbee_id;
    UPDATE poles                SET co_responsable_id = r.survivante_id WHERE co_responsable_id = r.absorbee_id;

    -- ---- (b) audit : aucun report (S6a vide). Fail-loud de sûreté : si une FK
    --         RESTRICT pointe encore vers l'absorbée, le DELETE (d) lèvera. On
    --         vérifie explicitement les RESTRICT pour un message clair. ----
    SELECT
        (SELECT count(*) FROM evenement_encadrants WHERE personne_id = r.absorbee_id)
      + (SELECT count(*) FROM evenements           WHERE organisateur_principal_id = r.absorbee_id)
      + (SELECT count(*) FROM chronologie_suivi    WHERE joueur_uuid = r.absorbee_id)
      INTO v_restrict_cnt;
    IF v_restrict_cnt > 0 THEN
      RAISE EXCEPTION 'appliquer_fusion_identite: % rattachement(s) RESTRICT subsiste(nt) vers l''absorbée % (lot %) — report incomplet, abandon',
        v_restrict_cnt, r.absorbee_id, r.label;
    END IF;

    -- ---- (c) survivante → joueur_et_staff (A4) ----
    UPDATE personnes SET categorie_personne = 'joueur_et_staff' WHERE id = r.survivante_id;

    -- ---- (d) supprimer l'absorbée + journaliser ----
    DELETE FROM personnes WHERE id = r.absorbee_id;

    INSERT INTO ident_fusion_log (survivante_id, absorbee_id, snapshot_absorbee, rattachements, applique_par)
    VALUES (r.survivante_id, r.absorbee_id, v_snapshot,
            jsonb_build_object('repointes', v_repointes, 'supprimes', v_supprimes, 'neutralises', '[]'::jsonb),
            v_uid);

    v_resultats := v_resultats || jsonb_build_object(
      'label', r.label,
      'survivante_id', r.survivante_id,
      'absorbee_id', r.absorbee_id,
      'statut', 'fusionne',
      'repointes', v_repointes,
      'supprimes', v_supprimes);
  END LOOP;

  RETURN jsonb_build_object(
    'applique_le', now(),
    'applique_par', v_uid,
    'resultats', v_resultats
  );
END
$func$;

REVOKE ALL ON FUNCTION public.appliquer_fusion_identite(boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appliquer_fusion_identite(boolean) TO authenticated;

-- ============================================================================
-- FIN sql/57. Aucune écriture exécutée par le seul chargement de ce fichier
-- (création d'objets uniquement). La fusion réelle est déclenchée par l'appel
-- explicite appliquer_fusion_identite(true), APRÈS validation de apercu_fusion_identite().
-- ============================================================================
