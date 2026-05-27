-- ============================================================
-- sql/52 · RPC creer_evenement_complet · transaction atomique
-- ============================================================
-- Conv : `Production · Refonte UX modale création évènement +
--        fiche évènement + écran d'accueil` (27 mai 2026, pt 19).
-- Dette adressée (1ère brique impl) : `UX-PARCOURS-EVT-COMPO` —
--        refonte modale création (R3 §3.1.6 du doc UX FAIT FOI
--        `Conception-UX-Parcours-Evt-Compo-v1.md` md5 4c8652d9).
--
-- ────────────────────────────────────────────────────────────
-- INTENTION
-- ────────────────────────────────────────────────────────────
-- Expose une RPC composite côté serveur qui crée en UNE
-- transaction atomique toutes les lignes d'un évènement complet
-- conformément à la conception UX §3.1 (5 modes adaptatifs) :
--   1. evenements (parent racine)
--   2. N evenement_equipes_engagees (M3)         si famille=competition
--   3. N evenement_adversaires (M5)              par M3
--   4. N evenements (phases-boîtes M6)           parent_id=racine, equipe_id F19
--   5. N evenements (matchs M6)                  parent_id=phase-boîte
--   6. N evenement_encadrants (M8)               tous modes
--   7. N equipe_engagee_membre (N2 role='staff') résolu via N1
--
-- Voie « rapide » modale = 1 clic = 1 état cohérent ou rien
-- (transaction atomique PL/pgSQL native, D-Q1 actée). Voie
-- « lente » fiche (post-création, ajout match par match, etc.)
-- RESTE INCHANGÉE via les wrappers REST existants :
--   createEvenement v1.17, addMatchToTournoi v1.17,
--   addEquipeEngagee v1.19, addAdversaire v1.19,
--   removeEquipeEngagee, removeAdversaire (R4 §3.1.6 doc UX).
--
-- ────────────────────────────────────────────────────────────
-- DÉCISIONS TECHNIQUES ACTÉES (Claude, Manu déléguées 27/05)
-- ────────────────────────────────────────────────────────────
-- D-Q1 Stratégie d'échec = atomique strict tout-ou-rien.
-- D-Q2 Paramètres composites = JSONB unique (pas JSONB[]) ;
--      jsonb_array_elements côté serveur, array littéral côté JS.
-- D-Q3 Horaires détaillés (RDV / fin prévue / accueil par jour) =
--      non persistés (option γ). Dette MODELE-EVT-HORAIRES-RDV 🟠
--      tracée pour conv Modélisation aval. Pas de stockage caché
--      dans recurrence/notes (anti-dette technique invisible).
-- D-Q4 Récurrence M2 = JSONB brut passé par le client (pattern
--      whitelist createEvenement v1.17 répliqué).
-- D-Q5 Mode visuel fiche évènement = panneau slide-in conservé
--      (écart §3.2 doc UX « page dédiée » assumé tracé, hors
--      scope L1 — concerne L3 uniquement).
--
-- D-Q6 Mapping local_id → uuid M3 enrichi en JSONB {m3_id, equipe_id}
--      à l'INSERT M3, plutôt que SELECT col INTO var FROM table
--      après coup. Acté 27/05 suite à incident parsing PG 17 sur
--      l'exécution initiale du script (ERROR 42P01 relation
--      "v_equipe_id_for_phase" does not exist) : le SELECT INTO
--      standalone dans le corps de la fonction posait un souci de
--      validation à la création de la fonction. Le refactor élimine
--      le pattern + supprime 1 round-trip serveur (perf gain mineur,
--      simplicité gagnée). Le pattern RETURNING ... INTO ... après
--      INSERT est conservé (pattern PL/pgSQL canonique distinct
--      de SELECT INTO, validé sans erreur).
--
-- D-Q7 Dollar-quoting TAGUÉ pour éliminer toute ambiguïté de
--      parsing entre le corps fonction et le DO block fail-loud
--      post-CREATE. Acté 27/05 suite à 2e incident parsing
--      (ERROR 42P01 relation "v_count" does not exist sur le
--      SELECT INTO du DO block). Cause racine inférée : 2 niveaux
--      de $$ ... $$ au même niveau (corps fonction + DO block)
--      provoquaient un mis-parsing du splitter de statements
--      Supabase SQL Editor / PG 17, qui extrayait le SELECT INTO
--      du DO block et l'interprétait comme plain SQL CREATE TABLE
--      AS, cherchant v_count comme relation. Solution :
--        - AS $func$ ... $func$  pour le corps fonction
--        - DO $verif$ ... $verif$ pour le DO block
--      + refactor du SELECT INTO résiduel en 2 assignments from
--      scalar subquery (par sécurité, élimine définitivement le
--      pattern problématique du script).
--
-- D-Q8 cree_par OMIS dans les INSERT (alignement strict pattern
--      projet). Acté 27/05 suite à 3e incident à l'exécution
--      smoke test :
--        ERROR 23503 : insert or update on table "evenements"
--        violates foreign key constraint "evenements_cree_par_fkey"
--        Key (cree_par)=(<auth.uid()>) is not present in table
--        "personnes".
--      Cause racine : auth.uid() retourne l'UUID Supabase Auth de
--      l'appelant, mais la FK cree_par pointe vers personnes.id.
--      Le mapping auth.uid() → personne_id n'existe pas (dette
--      LIAISON-IDENT-FOND / IDENT-SYS tracée STATE pt 14/15,
--      « mapping auth→personnes inexistant »). Faute discipline
--      anti-DS-1 du v3 (variable inventée vs comportement déployé).
--      Cadrage source pattern projet : createEvenement v1.17 +
--      addEquipeEngagee v1.19 + addAdversaire v1.19 + addMatchTo
--      Tournoi v1.17 = TOUS laissent cree_par à NULL (whitelist
--      sans ce champ). Le RPC v4 s'aligne strictement : cree_par
--      OMIS dans les 5 INSERT (racine + M3 + phase + match + M8),
--      la variable v_caller_uid est supprimée du DECLARE, l'init
--      v_caller_uid := auth.uid() retirée. Anti-régression
--      invisible vs le pattern déployé. La traçabilité créateur
--      reste DETTE OUVERTE (LIAISON-IDENT-FOND / IDENT-SYS) à
--      instruire séparément, non absorbée ici (« une conv = un
--      sujet »).
--
-- ────────────────────────────────────────────────────────────
-- OBSERVATIONS SCHÉMA ACTÉES
-- ────────────────────────────────────────────────────────────
-- Obs 1 evenement_encadrants.roles_encadrement TEXT[] NOT NULL.
--       L'UI modale (D8 doc UX §3.1) ne demande PAS le rôle fin
--       (cases à cocher coachs présents). Défaut '{coach}'::text[]
--       injecté côté SQL. Le rôle fin (assistant/kiné/dirigeant)
--       éditable a posteriori via écran Encadrement (lien #4
--       grille fiche, dette à câbler L3).
--
-- Obs 2 equipe_engagee_membre schéma minimaliste 3 colonnes
--       (id, evenement_equipe_id, collectif_membre_id) — PAS de
--       colonne role. La distinction joueur/staff vit en N1
--       (collectif_membre.role). p_affectations_n2 reçoit donc
--       {evenement_equipe_id_local, personne_id} ; la RPC résout
--       personne_id → collectif_membre_id via N1 filtré role='staff'
--       + date_fin IS NULL + saison active. Plus simple côté UI
--       (la modale coche des personnes, pas des UUID N1).
--
-- Obs 3 SECURITY DEFINER bypasse la RLS → garde explicite
--       `has_role('admin') OR has_role('coach')` en début de RPC
--       (cohérent matrice INSERT 5 tables des 20 policies pg_policies
--       lues à la source, voir CADRAGE ci-dessous).
--
-- Obs 4 DELETE evenement_encadrants admin-seul : divergence
--       Arbitrage Option A tracée gouvernance pt 14. HORS SCOPE L1
--       (cette RPC fait des INSERT seulement).
--
-- Obs 5 DELETE evenements admin-seul : HORS SCOPE L1. Cascade FK
--       ON DELETE gérera enfants via fiche Action « Supprimer »
--       (livrée L3, soumise au CHECK admin-seul existant).
--
-- ────────────────────────────────────────────────────────────
-- CADRAGE SOURCE PRÉ-WRITE (Q5b strict pt 16/17 répliqué)
-- 5 sondes Postgres exécutées et recollées Manu en conv avant
-- écriture de ce SQL. Aucune source inventée :
-- ────────────────────────────────────────────────────────────
-- (a1) evenements = 29 colonnes ; 6 NOT NULL sans défaut :
--        code, libelle, type_evenement, saison_id, date_debut,
--        organisateur_principal_id.
--      Défauts gérés serveur : id (uuid_generate_v4), etat
--        ('creation'), date_creation/updated_at (now()).
-- (a2) 7 CHECK v1.2 conformes (post-sql/42, 19/05) :
--        type_check 3 familles · competition_check 10 sous-types
--        · format_check 7 formats · domicile_check 3 valeurs ·
--        etat_check 6 états · equipe_obligatoire_si_pas_parent
--        (entrainement/stage ⇒ equipe_id NOT NULL ; competition
--        libre) · dates_coherentes (date_fin ≥ date_debut).
-- (b) Tables filles lues à la source :
--     - evenement_equipes_engagees : id+evenement_id+equipe_id
--       (NOT NULL), format_de_jeu/ordre/notes/cree_par/notes,
--       date_creation/updated_at NOT NULL DEFAULT now().
--     - evenement_adversaires : id+evenement_equipe_id+adversaire_nom
--       (NOT NULL), ordre/notes, date_creation NOT NULL DEFAULT now().
--       Asymétrie M3↔M5 confirmée : pas de cree_par/updated_at.
--     - evenement_encadrants : id+evenement_id+personne_id+
--       roles_encadrement TEXT[] (NOT NULL — Obs 1), ordre/notes/
--       cree_par, date_creation/updated_at NOT NULL DEFAULT now().
--     - equipe_engagee_membre : 3 colonnes seulement (Obs 2).
-- (c) Helpers : has_role(p_role text) RETURNS boolean SECURITY
--     DEFINER ✅. Pas de helper coach-spécifique requis ici.
-- (d) 20 policies RLS write (5 tables × 4 cmds), toutes
--     authenticated PERMISSIVE. INSERT/UPDATE = admin|coach.
--     DELETE = admin|coach SAUF evenements et evenement_encadrants
--     (admin-seul, Obs 4/5).
-- (e1) Référentiel : 1 seule équipe M14 réelle en base
--      (bfb83b83-…, code ENTENTE-M14-2025-2026, libellé court M14).
--      Cohérent dépendance ADMIN-(ii) 🟡 doc UX §4.7. RPC accepte
--      N≥1 équipes ; mode A4 plateau fonctionnel limité tant que
--      ADMIN-(ii) non livré (UI L4 affichera libellés génériques).
-- (e2) 0 staff actif dans collectif_membre role='staff' date_fin
--      NULL saison active. Cohérent dette « source Staff non
--      définie » pt 15. RPC accepte p_encadrants/p_affectations_n2
--      vides ; L4 affichera dégradation honnête modale.
--
-- ────────────────────────────────────────────────────────────
-- SCHÉMA DES PARAMÈTRES JSONB
-- ────────────────────────────────────────────────────────────
-- p_equipes_engagees :
--   [
--     {
--       "equipe_id": "uuid",
--       "format_de_jeu": "XV"|null,         -- override M4 par équipe
--       "ordre": 1|null,
--       "evenement_equipe_id_local": "equipe_1"|null,  -- mapping logique
--       "adversaires": [
--         {"adversaire_nom": "Strasbourg", "ordre": 1|null, "notes": null}
--       ]
--     }
--   ]
--
-- p_phases_par_equipe :
--   [
--     {
--       "evenement_equipe_id_local": "equipe_1",  -- résolu en UUID via mapping
--       "phases": [
--         {
--           "libelle": "Poule brassage",
--           "date_debut": "ISO 8601",            -- jour+heure de la phase
--           "ordre": 1,
--           "matchs": [
--             {
--               "libelle": "vs Strasbourg",
--               "date_debut": "ISO 8601",
--               "adversaire_nom": "Strasbourg"|null,
--               "format_de_jeu": "XV"|null,      -- override match
--               "ordre": 1|null
--             }
--           ]
--         }
--       ]
--     }
--   ]
--
-- p_affectations_n2 :
--   [
--     {"evenement_equipe_id_local": "equipe_1", "personne_id": "uuid"}
--   ]
--
-- evenement_equipe_id_local = identifiant logique côté client
-- (ex. "equipe_1", "equipe_2"), mappé dans v_local_to_uuid à un
-- objet JSONB enrichi {m3_id, equipe_id} après création de la
-- ligne M3 par cette RPC. Permet de référencer une équipe engagée
-- pour ses phases / son affectation N2 sans pré-générer d'UUID
-- côté client (impossible en transaction unique : le client ne
-- connaît pas les UUID avant exécution) ET sans round-trip SELECT
-- supplémentaire (D-Q6 actée).
--
-- ────────────────────────────────────────────────────────────
-- DISCIPLINE
-- ────────────────────────────────────────────────────────────
-- Idempotent : CREATE OR REPLACE FUNCTION (jamais DROP/CREATE,
-- préserve les éventuels GRANT existants).
-- Transaction unique côté serveur (atomicité PL/pgSQL native).
-- Fail-loud par construction : RAISE EXCEPTION sur tout invariant
-- violé → ROLLBACK automatique. Aucune écriture spéculative,
-- aucune création muette (DS-1 tenu).
-- Fail-loud post-CREATE en DO $$ : la fonction existe, signature
-- unique, SECURITY DEFINER (patron sql/50 §4 répliqué).
-- Aucune mutation de :
--   - schéma des 5 tables touchées (pas de ALTER TABLE) ;
--   - policies RLS (pas de CREATE/DROP POLICY — sql/43 intact) ;
--   - autres fonctions (chronologie_nom_court_personne,
--     generer_lien_ephemere, RPC C12 Suivi, sql/44→51 — toutes
--     non touchées) ;
--   - aucune ligne de données (la RPC est juste CRÉÉE ici,
--     pas exécutée).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.creer_evenement_complet(
  -- Obligatoires (NOT NULL sans défaut côté table evenements)
  p_type_evenement              TEXT,
  p_libelle                     TEXT,
  p_code                        TEXT,
  p_date_debut                  TIMESTAMPTZ,
  p_saison_id                   UUID,
  p_organisateur_principal_id   UUID,
  -- Optionnels (NULL OK côté table evenements)
  p_type_competition            TEXT          DEFAULT NULL,
  p_format_de_jeu               TEXT          DEFAULT NULL,
  p_date_fin                    TIMESTAMPTZ   DEFAULT NULL,
  p_site_id                     UUID          DEFAULT NULL,
  p_domicile_exterieur          TEXT          DEFAULT NULL,
  p_equipe_id                   UUID          DEFAULT NULL,
  p_recurrence                  JSONB         DEFAULT NULL,
  p_notes_internes              TEXT          DEFAULT NULL,
  -- Composites (parsés en boucle dans la RPC)
  p_equipes_engagees            JSONB         DEFAULT NULL,
  p_phases_par_equipe           JSONB         DEFAULT NULL,
  p_encadrants                  UUID[]        DEFAULT NULL,
  p_affectations_n2             JSONB         DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_evenement_id          UUID;
  v_evenement_equipe_id   UUID;
  v_phase_id              UUID;
  v_collectif_membre_id   UUID;
  v_engagement            JSONB;
  v_adversaire            JSONB;
  v_phase_block           JSONB;
  v_phase                 JSONB;
  v_match                 JSONB;
  v_local_id              TEXT;
  v_local_to_uuid         JSONB := '{}'::jsonb;  -- mapping local_id → uuid réel M3
  v_personne_id           UUID;
  v_equipe_id_for_phase   UUID;       -- récupéré du mapping enrichi (4)
  v_m3_entry              JSONB;
  v_phase_ordre           INTEGER;
  v_match_ordre           INTEGER;
  v_phase_code            TEXT;
  v_match_code            TEXT;
  -- compteurs pour fail-loud invariants d'état-cible
  v_n_m3_attendu          INTEGER := 0;
  v_n_m3_insere           INTEGER := 0;
  v_n_m8_attendu          INTEGER := 0;
  v_n_m8_insere           INTEGER := 0;
  v_n_n2_attendu          INTEGER := 0;
  v_n_n2_insere           INTEGER := 0;
BEGIN
  -- ────────────────────────────────────────────────────────
  -- (0) GARDE RÔLE (SECURITY DEFINER bypasse RLS — Obs 3)
  -- ────────────────────────────────────────────────────────
  IF NOT (has_role('admin') OR has_role('coach')) THEN
    RAISE EXCEPTION 'access denied: admin or coach role required (creer_evenement_complet)';
  END IF;

  -- ────────────────────────────────────────────────────────
  -- (1) VALIDATION MINIMUMS
  --     CHECK constraints PG remonteront aussi si on les rate,
  --     mais on attrape tôt avec un message métier explicite.
  -- ────────────────────────────────────────────────────────
  IF p_type_evenement NOT IN ('entrainement', 'competition', 'stage') THEN
    RAISE EXCEPTION 'invalid type_evenement: % (expected entrainement|competition|stage)', p_type_evenement;
  END IF;

  IF p_type_evenement IN ('entrainement', 'stage') AND p_equipe_id IS NULL THEN
    RAISE EXCEPTION 'equipe_id requis pour type_evenement=% (CHECK equipe_obligatoire_si_pas_parent)', p_type_evenement;
  END IF;

  IF p_type_evenement = 'competition' THEN
    IF p_equipes_engagees IS NULL OR jsonb_array_length(p_equipes_engagees) = 0 THEN
      RAISE EXCEPTION 'au moins une équipe engagée requise pour une compétition (R2 §3.1.6 doc UX)';
    END IF;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- (2) INSERT racine evenements
  --     cree_par OMIS : pattern projet aligné (createEvenement
  --     v1.17 ne le renseigne pas non plus). FK personnes.id
  --     non résolvable depuis auth.uid() — dette LIAISON-IDENT-
  --     FOND / IDENT-SYS tracée STATE pt 14/15, non absorbée ici.
  -- ────────────────────────────────────────────────────────
  INSERT INTO public.evenements (
    code, libelle, type_evenement, type_competition,
    equipe_id, saison_id, format_de_jeu,
    date_debut, date_fin, site_id,
    organisateur_principal_id,
    domicile_exterieur, recurrence, notes_internes
  ) VALUES (
    p_code, p_libelle, p_type_evenement, p_type_competition,
    p_equipe_id, p_saison_id, p_format_de_jeu,
    p_date_debut, p_date_fin, p_site_id,
    p_organisateur_principal_id,
    p_domicile_exterieur, p_recurrence, p_notes_internes
  ) RETURNING id INTO v_evenement_id;

  IF v_evenement_id IS NULL THEN
    RAISE EXCEPTION 'INSERT evenements racine échoué — id NULL retour';
  END IF;

  -- ────────────────────────────────────────────────────────
  -- (3) INSERT M3 evenement_equipes_engagees + M5 adversaires
  --     par équipe (compétition uniquement).
  --     Construit le mapping local_id → uuid_réel pour
  --     résolution phases (4) + N2 (6) en transaction unique.
  -- ────────────────────────────────────────────────────────
  IF p_equipes_engagees IS NOT NULL THEN
    v_n_m3_attendu := jsonb_array_length(p_equipes_engagees);

    FOR v_engagement IN SELECT * FROM jsonb_array_elements(p_equipes_engagees) LOOP
      INSERT INTO public.evenement_equipes_engagees (
        evenement_id, equipe_id, format_de_jeu, ordre, notes
      ) VALUES (
        v_evenement_id,
        (v_engagement->>'equipe_id')::uuid,
        v_engagement->>'format_de_jeu',
        NULLIF(v_engagement->>'ordre', '')::integer,
        v_engagement->>'notes'
      ) RETURNING id INTO v_evenement_equipe_id;

      v_n_m3_insere := v_n_m3_insere + 1;

      -- Mapping local_id → {m3_id, equipe_id} pour résolution
      -- phases (4) et N2 (6) SANS SELECT supplémentaire.
      -- (équipe_id stocké à l'INSERT, évite un round-trip et le
      --  pattern SELECT INTO qui posait souci de parsing PG 17
      --  sur ce script — décision technique actée 27/05.)
      v_local_id := v_engagement->>'evenement_equipe_id_local';
      IF v_local_id IS NOT NULL AND v_local_id <> '' THEN
        v_local_to_uuid := v_local_to_uuid || jsonb_build_object(
          v_local_id,
          jsonb_build_object(
            'm3_id',     v_evenement_equipe_id::text,
            'equipe_id', (v_engagement->>'equipe_id')
          )
        );
      END IF;

      -- INSERT M5 adversaires de cette équipe engagée (cohérent M5
      -- frontière v1.2 §4.4 : adversaires rattachés à M3, pas à racine)
      IF v_engagement ? 'adversaires' AND jsonb_typeof(v_engagement->'adversaires') = 'array' THEN
        FOR v_adversaire IN SELECT * FROM jsonb_array_elements(v_engagement->'adversaires') LOOP
          INSERT INTO public.evenement_adversaires (
            evenement_equipe_id, adversaire_nom, ordre, notes
          ) VALUES (
            v_evenement_equipe_id,
            v_adversaire->>'adversaire_nom',
            NULLIF(v_adversaire->>'ordre', '')::integer,
            v_adversaire->>'notes'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- (4) INSERT M6 phases-boîtes + matchs par équipe (F19
  --     arborescence par équipe, §3.1.4 doc UX).
  --     phase-boîte = ligne evenements avec evenement_parent_id
  --                   = racine, equipe_id propagé.
  --     match       = ligne evenements avec evenement_parent_id
  --                   = phase-boîte.
  --     Codes générés : <code_racine>-PH<ordre>[-M<ordre>].
  -- ────────────────────────────────────────────────────────
  IF p_phases_par_equipe IS NOT NULL THEN
    FOR v_phase_block IN SELECT * FROM jsonb_array_elements(p_phases_par_equipe) LOOP
      v_local_id := v_phase_block->>'evenement_equipe_id_local';

      IF v_local_id IS NULL OR (v_local_to_uuid->v_local_id) IS NULL THEN
        RAISE EXCEPTION 'p_phases_par_equipe : evenement_equipe_id_local=% introuvable dans p_equipes_engagees', v_local_id;
      END IF;

      -- Résolution mapping enrichi (m3_id + equipe_id stockés à l'INSERT M3)
      v_m3_entry            := v_local_to_uuid->v_local_id;
      v_evenement_equipe_id := (v_m3_entry->>'m3_id')::uuid;
      v_equipe_id_for_phase := (v_m3_entry->>'equipe_id')::uuid;

      v_phase_ordre := 0;
      FOR v_phase IN SELECT * FROM jsonb_array_elements(v_phase_block->'phases') LOOP
        v_phase_ordre := v_phase_ordre + 1;
        v_phase_code := p_code || '-PH' || v_phase_ordre::text;

        INSERT INTO public.evenements (
          code, libelle, type_evenement, type_competition,
          equipe_id, saison_id,
          date_debut,
          organisateur_principal_id,
          evenement_parent_id, phase_libelle, ordre_dans_phase
        ) VALUES (
          v_phase_code,
          v_phase->>'libelle',
          'competition',
          p_type_competition,
          v_equipe_id_for_phase,
          p_saison_id,
          COALESCE((v_phase->>'date_debut')::timestamptz, p_date_debut),
          p_organisateur_principal_id,
          v_evenement_id,
          v_phase->>'libelle',
          NULLIF(v_phase->>'ordre', '')::integer
        ) RETURNING id INTO v_phase_id;

        -- Matchs dans cette phase
        IF v_phase ? 'matchs' AND jsonb_typeof(v_phase->'matchs') = 'array' THEN
          v_match_ordre := 0;
          FOR v_match IN SELECT * FROM jsonb_array_elements(v_phase->'matchs') LOOP
            v_match_ordre := v_match_ordre + 1;
            v_match_code := v_phase_code || '-M' || v_match_ordre::text;

            INSERT INTO public.evenements (
              code, libelle, type_evenement, type_competition,
              equipe_id, saison_id, format_de_jeu,
              date_debut,
              organisateur_principal_id,
              evenement_parent_id, phase_libelle, ordre_dans_phase,
              adversaire_nom
            ) VALUES (
              v_match_code,
              v_match->>'libelle',
              'competition',
              p_type_competition,
              v_equipe_id_for_phase,
              p_saison_id,
              COALESCE(v_match->>'format_de_jeu', p_format_de_jeu),
              COALESCE((v_match->>'date_debut')::timestamptz, p_date_debut),
              p_organisateur_principal_id,
              v_phase_id,
              v_phase->>'libelle',
              NULLIF(v_match->>'ordre', '')::integer,
              v_match->>'adversaire_nom'
            );
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- (5) INSERT M8 encadrants (tous modes A1→A5)
  --     roles_encadrement = '{coach}'::text[] par défaut (Obs 1)
  -- ────────────────────────────────────────────────────────
  IF p_encadrants IS NOT NULL THEN
    v_n_m8_attendu := array_length(p_encadrants, 1);
    IF v_n_m8_attendu IS NULL THEN v_n_m8_attendu := 0; END IF;

    FOREACH v_personne_id IN ARRAY p_encadrants LOOP
      INSERT INTO public.evenement_encadrants (
        evenement_id, personne_id, roles_encadrement
      ) VALUES (
        v_evenement_id,
        v_personne_id,
        ARRAY['coach']::text[]
      );
      v_n_m8_insere := v_n_m8_insere + 1;
    END LOOP;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- (6) INSERT N2 equipe_engagee_membre staff
  --     Résolution personne_id → collectif_membre_id (Obs 2)
  --     via N1 collectif_membre filtré :
  --       role = 'staff' ET date_fin IS NULL ET saison active
  --     Fail-loud si personne non trouvée en staff actif
  --     (DS-1 : pas d'INSERT muet).
  -- ────────────────────────────────────────────────────────
  IF p_affectations_n2 IS NOT NULL THEN
    v_n_n2_attendu := jsonb_array_length(p_affectations_n2);

    FOR v_engagement IN SELECT * FROM jsonb_array_elements(p_affectations_n2) LOOP
      v_local_id := v_engagement->>'evenement_equipe_id_local';
      v_personne_id := (v_engagement->>'personne_id')::uuid;

      IF v_local_id IS NULL OR (v_local_to_uuid->v_local_id) IS NULL THEN
        RAISE EXCEPTION 'p_affectations_n2 : evenement_equipe_id_local=% introuvable', v_local_id;
      END IF;
      -- Mapping enrichi : extraction m3_id
      v_evenement_equipe_id := ((v_local_to_uuid->v_local_id)->>'m3_id')::uuid;

      -- Résolution N1 (filtre staff actif saison courante)
      -- Assignment from scalar subquery (évite SELECT INTO).
      v_collectif_membre_id := (
        SELECT cm.id
        FROM public.collectif_membre cm
        JOIN public.ententes en ON en.id = cm.entente_id
        JOIN public.saisons   s  ON s.id  = en.saison_id
        WHERE cm.personne_id = v_personne_id
          AND cm.role = 'staff'
          AND cm.date_fin IS NULL
          AND s.est_active = TRUE
        LIMIT 1
      );

      IF v_collectif_membre_id IS NULL THEN
        RAISE EXCEPTION 'p_affectations_n2 : personne_id=% non trouvée dans collectif_membre role=staff actif saison courante (DS-1 anti-muette)', v_personne_id;
      END IF;

      INSERT INTO public.equipe_engagee_membre (
        evenement_equipe_id, collectif_membre_id
      ) VALUES (
        v_evenement_equipe_id,
        v_collectif_membre_id
      );
      v_n_n2_insere := v_n_n2_insere + 1;
    END LOOP;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- (7) FAIL-LOUD AVANT RETOUR : invariants d'état-cible
  --     atteints (M3/M8/N2 insérés = attendus).
  --     Si EXCEPTION ici → ROLLBACK automatique transaction.
  -- ────────────────────────────────────────────────────────
  IF v_n_m3_insere <> v_n_m3_attendu THEN
    RAISE EXCEPTION 'fail-loud M3 : % insérés, % attendus', v_n_m3_insere, v_n_m3_attendu;
  END IF;
  IF v_n_m8_insere <> v_n_m8_attendu THEN
    RAISE EXCEPTION 'fail-loud M8 : % insérés, % attendus', v_n_m8_insere, v_n_m8_attendu;
  END IF;
  IF v_n_n2_insere <> v_n_n2_attendu THEN
    RAISE EXCEPTION 'fail-loud N2 : % insérés, % attendus', v_n_n2_insere, v_n_n2_attendu;
  END IF;

  RAISE NOTICE 'creer_evenement_complet OK : evenement=% M3=% M8=% N2=%',
    v_evenement_id, v_n_m3_insere, v_n_m8_insere, v_n_n2_insere;

  RETURN v_evenement_id;
END;
$func$;

-- GRANT EXECUTE — accessible aux authentifiés. Sécurité réelle =
-- garde role-pure à l'intérieur de la fonction (étape 0).
GRANT EXECUTE ON FUNCTION public.creer_evenement_complet(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID,
  TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, UUID, JSONB, TEXT,
  JSONB, JSONB, UUID[], JSONB
) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FAIL-LOUD POST-CREATE (patron sql/50 §4 répliqué) : la
-- fonction existe avec la bonne signature et SECURITY DEFINER.
-- Si invariant violé → ROLLBACK automatique transaction entière.
-- ────────────────────────────────────────────────────────────
DO $verif$
DECLARE
  v_count   INTEGER;
  v_secdef  BOOLEAN;
BEGIN
  -- Assignment from scalar subquery (évite SELECT col INTO var FROM
  -- pattern qui posait souci de parsing — D-Q7 actée 27/05).
  v_count := (
    SELECT COUNT(*)
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.proname = 'creer_evenement_complet'
  );

  v_secdef := (
    SELECT bool_and(p.prosecdef)
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.proname = 'creer_evenement_complet'
  );

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'sql/52 FAIL-LOUD : creer_evenement_complet count=% (attendu 1) — CREATE raté. ROLLBACK.',
      v_count;
  END IF;

  IF NOT v_secdef THEN
    RAISE EXCEPTION
      'sql/52 FAIL-LOUD : creer_evenement_complet n''est pas SECURITY DEFINER. ROLLBACK.';
  END IF;

  RAISE NOTICE 'sql/52 OK : creer_evenement_complet créée, SECURITY DEFINER, GRANT authenticated.';
END $verif$;

COMMIT;

-- ============================================================
-- VÉRIFICATION POST-COMMIT (à exécuter séparément après run)
-- ============================================================
-- (1) Présence et signature :
--
-- SELECT p.proname,
--        p.prosecdef,
--        pg_get_function_identity_arguments(p.oid) AS args,
--        pg_get_function_result(p.oid) AS returns
-- FROM   pg_proc p
-- JOIN   pg_namespace n ON n.oid = p.pronamespace
-- WHERE  n.nspname = 'public'
--   AND  p.proname = 'creer_evenement_complet';
--
-- Attendu : 1 ligne, prosecdef=true, returns=uuid,
--           args = 18 paramètres dans l'ordre signature.
--
-- (2) Smoke test minimal (mode A1 Entraînement ponctuel) — à
-- exécuter authentifié coach côté JS, PAS dans SQL Editor (sinon
-- has_role bypassable par contexte service_role) :
--
-- const { data, error } = await SupabaseHub.client.rpc('creer_evenement_complet', {
--   p_type_evenement:            'entrainement',
--   p_libelle:                   'Smoke test sql/52',
--   p_code:                      'SMOKE-52-' + Date.now(),
--   p_date_debut:                new Date().toISOString(),
--   p_saison_id:                 '<uuid saison active>',
--   p_organisateur_principal_id: '<uuid coach>',
--   p_equipe_id:                 'bfb83b83-83ef-4dde-b526-48ff87313044'
-- });
-- console.log({data, error});  // data = uuid évènement, error = null
--
-- Cleanup smoke test (admin) :
-- DELETE FROM public.evenements WHERE code LIKE 'SMOKE-52-%';
-- ============================================================
