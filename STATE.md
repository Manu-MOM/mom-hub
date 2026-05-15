# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 15 mai 2026 — Module Préparation de séance V1 COMPLET (Phases 5.1 → 5.11 livrées et déployées) ET Conv Joueurs/Évènements OUVERTE en après-midi (S1 Phase 4.4 backend Évènements livrée : sql/29 + js v1.9 = clôture dettes C9-a/b/c/d, C9-e reportée V2). Conv Production générale a livré aujourd'hui les 4 dernières phases du module Séances en une journée : 5.8 (picker ateliers Bibliothèque), 5.9 (groupes G1/G2/G3 par bloc), 5.10 (sidebar enrichie + nettoyage brouillons vides), 5.11 (activation tuile dashboard). Hier (14 mai) avait livré le module Bibliothèque et activé les 2 premières tuiles ; aujourd'hui le module Préparation de séance ferme la 3e tuile active du portail. En après-midi, la conv Joueurs/Évènements a démarré et livré la S1 backend Évènements.**

**Bilan chiffré du 15 mai 2026** :
- **4 phases du module Préparation de séance livrées en une journée** : 5.8 + 5.9 + 5.10 + 5.11.
- **Fichiers ajoutés / modifiés** :
  - `js/seance-editor.js` : v1.5 → **v1.8** (~1 000 lignes ajoutées sur la journée — picker ateliers, groupes G1/G2/G3, sidebar enrichie, état total ~2988 lignes).
  - `js/supabase-client.js` : v1.8.2 → **v1.8.4** (3 nouveaux wrappers : `listAteliersRattachesAuBloc`, `listBrouillonsVides`, `deleteBrouillonsVides` — état total ~1521 lignes).
  - `seance.html` : ~600 lignes CSS ajoutées (sections ateliers, groupes, sidebar, popovers, archive) + smoke check v1.8.4 + footer Phase 5.10.
  - `data/groupes-joueur.json` : nouveau (3 KB, 3 groupes Performance/Développement/Initiation, miroir Drive `01 - Référentiels/`).
  - `index.html` : modifié pour activer la tuile "Préparation de séance" (section 01 Pédagogie EDR), renommage `Constructeur de séance` → `Préparation de séance`, sous-titre actualisé, compteurs `sec-meta` corrigés (section 01 "4 outils · 2 disponibles", section 02 "4 outils · 1 disponible").
- **Note** : `data/fiches-all.json` (livré 14 mai pour la Bibliothèque) sert aussi pour le picker ateliers Phase 5.8 — pas de duplication, le même miroir alimente les 2 modules.
- **9 commits séparés** poussés sur `main` sur la journée (Phase 5.8 : 4 commits, Phase 5.9 : 3 commits, Phase 5.10 : 3 commits, Phase 5.11 : 1 commit — selon le pattern "1 fichier = 1 commit").
- **Incident GitHub Actions/Pages** rencontré et résorbé en cours de journée (degraded availability sur le déploiement Pages pendant ~20 min, file de workflows en `Queued`). Diagnostic : status.github.com avant de chercher midi à 14h. Rien à faire côté code, attente uniquement.
- **Dette D-SEANCE-STUB-VIDES résolue** par la Phase 5.10 (bouton manuel "🧹 Nettoyer" avec compteur en bas de sidebar).
- **3 nouvelles dettes ouvertes** : D-SEANCE-GROUPES-DEFAUT (override groupes par défaut au niveau séance, si l'usage le réclame), D-BLOC-TYPE-CHANGE-NO-RERENDER (changer le type d'un bloc en édition ne refresh pas les étiquettes Axes 2/3), D-PORTAIL-V2-REFONTE (refonte d'`index.html` selon `Conception-Portail-Architecture-V2.md`).
- **Conv Joueurs/Évènements préparée** : audits `Audit-Module-Joueurs-v1.md` (73 KB) et `Audit-Module-Evenements-v1.md` (56 KB) disponibles sur Drive `00 - Documentation/`, message kickoff de Production rédigé (`kickoff-conv-joueurs-evenements.md`, 12 KB) — à coller dans nouvelle conv quand Manu sera prêt à enchaîner.

**Bilan chiffré du 15 mai 2026 — session après-midi (Conv Joueurs/Évènements, S1 backend Évènements)** :
- **Conv ouverte** après kickoff matin. Pré-requis : lecture des 2 audits + 2 docs Conception UI Évènements + UI Joueurs (4 docs Drive consultés via `Google Drive:read_file_content`).
- **Séquencement validé** : 4 sessions module-par-module, Évènements d'abord. S1 backend Évènements (~1h) → S2 UI Évènements → S3 backend Joueurs → S4 UI Joueurs.
- **Décision structurante actée** (cf. doc Conception UI Joueurs §préambule) : la fiche Personne sera codée comme un **composant unique réutilisable à 2 modes** (`mode=metier` côté Joueurs vs `mode=identite` côté Annuaire futur). Niveau d'architecture validé = fichier dédié `js/fiche-personne.js` (module IIFE autonome). Pas de surcoût immédiat, gain énorme à l'ouverture future de la conv Annuaire.
- **Fichiers livrés S1** :
  - `sql/29-rpc-evenements-c9.sql` (NOUVEAU, 488 lignes) : 4 RPC dans une transaction BEGIN/COMMIT — `get_evenements_a_venir` modifiée (ajout colonne `compo_status_summary` JSONB, 16→17 cols retour), `get_prochain_evenement_par_equipe` recréée (hérite nouvelle signature), `get_evenements_passes` créée (dette C9-a), `get_evenement_with_encadrants` créée (dette C9-b, 24 cols dont array JSONB encadrants enrichis nom/prénom/rôles/ordre).
  - `js/supabase-client.js` : v1.8.4 → **v1.9** (+84 lignes net = 2 nouveaux wrappers `getEvenementsPasses` + `getEvenementWithEncadrants`, état total ~1605 lignes). Les 2 wrappers existants `getEvenementsAVenir` et `getProchainEvenementParEquipe` NON modifiés (signature d'entrée identique, PostgREST ramène naturellement la nouvelle colonne `compo_status_summary` dans la réponse JSON).
- **Doctrine compo_status_summary (C9-d arbitré V1 simple)** : agrégat JSONB `{total, brouillon, validee, utilisee}` filtré `cote='mom' AND est_active=TRUE`, pas de récursion serveur parent→enfants. Pour un tournoi parent, valeur = `{0,0,0,0}` ; l'agrégat parent↔enfants se fera côté client UI à l'affichage (P1 simplicité, trivial en JS).
- **Filtres `etat` divergents** (doctrinés en en-tête du fichier SQL) : `get_evenements_a_venir` exclut `'annule'` ET `'archive'` (comportement Phase 4.2.B conservé) ; `get_evenements_passes` exclut `'archive'` seulement (les `'annule'` restent visibles barrés dans la liste UI, cohérent doc Conception §3.5) ; `get_evenement_with_encadrants` aucun filtre (fiche détail doit ouvrir un événement annulé ou archivé pour audit/réactivation).
- **Smoke test passé en base (8 tests fonctionnels)** : 4 RPC créées avec arités correctes (17/17/17/24 cols), 9 events à venir 30j (NULL filter) + 15 events 90j (M14 EQ1) + 1 event passé (NOW()-365j) + 1 event archivé (fiche `EVT-2026-05-02-FRANKFURT-M14`) ouvrable, `jsonb_typeof(compo_status_summary)='object'` partout (jamais null), `encadrants=[]` (pas `null`, COALESCE OK), TEST 8 cohérence comptable validé (0 ligne car aucune compo en base sur les events à venir, comportement attendu).
- **2 commits séparés** poussés sur `main` (sql/29 puis js v1.9 — convention "1 fichier = 1 commit" respectée).
- **Dette C9 totalement soldée** : C9-a/b/c/d closes, C9-e reportée V2 (transition automatique `creation → compo`, doctrine P3 itération).
- **Nouvelles dettes ouvertes** : 8 dettes `P4-UI-evenements-*` (du doc Conception UI Évènements §8), 12 dettes `P4-UI-joueurs-*` (du doc Conception UI Joueurs §8), 10 dettes `C10-a à C10-j` préalables S3 backend Joueurs (du doc audit Joueurs §8). Toutes listées plus bas dans la section dettes.

**Bilan chiffré du 14 mai 2026** (rappel) :
- **4 fichiers nouveaux livrés et committés** : `bibliotheque.html` (38 KB, page module à la racine), `js/bibliotheque-browser.js` (26 KB, module IIFE), `data/ateliers.json` (87 KB, taxonomie 4 rubriques / 82 ateliers), `data/fiches-all.json` (139 KB, bundle 62 fiches PPTX généré par Apps Script `Build-Fiches-All.gs` côté Drive).
- **1 fichier modifié** : `index.html` (activation 2 tuiles dashboard : Compositions + Bibliothèque, et 2 liens sidebar).
- **5 commits séparés** poussés sur `main` (ateliers.json, fiches-all.json, bibliotheque-browser.js, bibliotheque.html, index.html dans cet ordre — fichiers de dépendance d'abord pour qu'aucun état intermédiaire ne soit cassé).
- **Convention d'activation des tuiles** posée (première utilisation) : `class="tool todo"` + statut "todo À venir" → `class="tool" onclick="location.href='X.html'" role="link" tabindex="0"` + statut "on Disponible". À reprendre pour les futures activations.
- **Tests post-déploiement** vague 1 (smoke) + vague 2 (fonctionnels Bibliothèque : auth, chargement données, vue Cartes, modal détail, vue Plan, filtres, déconnexion) tous **passés vert**. Vague 3 (cas dégradé + responsive) reportée à plus tard.

**Bilan chiffré du 13 mai 2026** (rappel) :
- **12 fichiers SQL** : sql/17 (39 attaches partenaires), sql/17b (fix categorie_id partenaires), sql/18 (compositions + composition_joueurs), sql/19 (presences), sql/21 (RPC get_vivier_compo), sql/22 (ALTER compositions ADD type_compo + compo_base_origine_id — C8-a/b), sql/23 (ALTER composition_joueurs ADD etat_joueur — C8-c), sql/24 (RLS write Vague 1 + durcissement distances_sites), sql/25 (RLS write evenements + evenement_encadrants), sql/26 (RLS write compositions + composition_joueurs + presences), sql/27 (ALTER état compositions : `jouee` → `utilisee` + ajout `archivee` — C8-d). sql/20 volontairement sauté (M-1).
- **3 fichiers JS livrés** : `js/dashboard-stats.js` v2.3 (greeting J-N), `js/supabase-client.js` v1.6→v1.7.1 (13 wrappers Phase 4.4 + fix `.maybeSingle()`), `js/compositions-editor.js` v3.4 (Vue Liste éditable + Popover Picker).
- **2 fichiers CSS/HTML livrés** : `css/hub.css` v1.1 (ajout `--bleu-base` + `--rouge-blesse`), `compositions.html` (page complète éditeur de compo + styles inline ~500 lignes).
- **1 brief Conception** : `brief-conception-phase-4-4-ui-compo.md` rédigé, retour reçu sous forme de `Conception-Portail-Phase-4-UI-Compo.md` (Drive `00 - Documentation/`).
- **Validation E2E** : compo M14 créée bout-en-bout depuis le portail (créer compo de base → cliquer slot → popover → choisir joueur → slot occupé bleu → bouton × retire). 4 bugs successivement débuggés et corrigés en ligne (mismatch id/uuid, RLS jointure personnes null, UUID catégorie inventé, recherche à l'envers).

---

## 🎯 Vision du projet

**MOM Hub** est une **plateforme web** qui sert de point d'entrée unique à tous les outils du club **Mutzig Ovalie Molsheim** (rugby, Alsace).

C'est un **portail/agrégateur**, PAS une migration. Les outils existants (SportEasy, Drive, OVAL-E FFR, etc.) continuent à vivre ; le Hub leur sert de couche de jonction.

**Doctrine fondatrice** : **simplicité d'usage avant tout**. Pas d'over-engineering, pas de schémas baroques, fichiers JSON éditables à la main si possible.

**Budget** : 0 € strict. Stack : GitHub Pages + Supabase free tier + Google Drive.

---

## 🏛️ Architecture en 3 lieux

| Lieu | Rôle | Contenu |
|---|---|---|
| **Google Drive** `MOM Hub/2025-2026/` | Source de vérité documentaire et workspace humain | Doctrine, audits, schémas JSON, plans d'attaque, référentiels métier (versions canoniques) |
| **GitHub** `Manu-MOM/mom-hub` (public) | Code, déploiement, mirroir lecture seule des référentiels | `index.html`, `compositions.html`, `js/`, `css/`, `data/` (miroir JSON), `sql/`, `.github/workflows/`, STATE.md |
| **Supabase** `mom-hub` (free tier) | Source de vérité des **données vivantes** (personnes, événements, présences, compositions, etc.) | 13 tables, fonctions RPC, RLS read+write par rôle complète |

⚠️ **Repo GitHub PUBLIC** : ne jamais commit la clé `service_role`, les fiches Personne brutes, ou toute donnée perso (en particulier les SQL des chantiers C1-C4 de la réconciliation OVAL-E).

---

## 📊 État des phases

### ✅ Phase 1 — Déploiement initial du Hub (FAIT)
- Portail HTML déployé sur GitHub Pages : https://manu-mom.github.io/mom-hub/
- Repo public : https://github.com/Manu-MOM/mom-hub
- 9 référentiels JSON mirrorés depuis Drive vers `data/`
- Design : tableau de bord vert bouteille + or, charte Oswald/Manrope/JetBrains Mono

### ✅ Phase 2.0 — Fondations Supabase (FAIT)
- Projet Supabase `mom-hub` créé, URL : `https://fvfqffxaiaoygqhjtxwr.supabase.co`
- Tables Vague 1 créées + RLS activé + policies lecture publique sur les référentiels
- 294 personnes migrées (sql/03 archivé local + Drive, **NON commit dans repo public**)
- Anti-pause GitHub Action `keep-alive-supabase.yml` opérationnel
- Secrets GitHub configurés : `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### ✅ Phase 2.4 — Portail dynamique (FAIT — 11 mai 2026)
- 4 KPI passifs alimentés en dynamique depuis Supabase via RPC RGPD-safe `get_dashboard_stats`
- Pattern technique : Supabase REST API + RPC + RLS + helpers JS

### ✅ Phase 2.4.5 — Réconciliation OVAL-E (FAIT — 11 mai 2026)
- Réconciliation Drive (297 fiches) vs Supabase (323 fiches) vs OVAL-E export FFR
- Doctrine v1.3 publiée (§13 architecture sources, §14 mapping qualités FFR → type_personne)
- Base finale : 323 lignes Supabase dont 298 licenciées FFR alignées OVAL-E

### ✅ Phase 2.5 — Authentification (FAIT — 11 mai 2026)
- Login Magic Link Supabase Auth opérationnel
- Table `auth_roles` (admin / coach / viewer) + 1 admin actif (Manu)
- Helpers `has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER` + `get_my_roles() RETURNS TEXT[]`
- Helpers JS `requireAuth()` / `isAdmin()` / `signOut()`
- Page `dashboard.html` admin + boutons d'auth intégrés au portail

### ✅ Phase 3 — Refonte portail + topbar partagée (FAIT — 12 mai 2026)
- Phase 3 partie 1/2 : factorisation CSS dans `css/hub.css`, topbar partagée
- Phase 3 partie 2/2 : refonte zone sous-bandeau, greeting recontextualisé, 4 KPI repensés, sidebar 3 cartes

### ✅ Phase 4.1.A — Peuplement Vague 1 + K2 ÉQUIPES dynamique (FAIT — 13 mai 2026 matin)
- 11 ententes + 11 équipes + 23 attaches `equipe_joueurs` M14 MOM via `sql/06`
- Coach M14 = Emmanuel JUNG (référent ET coach principal)
- SAR (37) et ASCS (2) M14 attaches reportées à Phase 4.3 (livrées)
- Phase 4.1.A bis : K2 ÉQUIPES via RPC `count_equipes_actives()` (sql/09)

### ✅ Phase 4.1.B — Sites et distances (FAIT — 12 mai 2026 soir)
- Tables `sites` et `distances_sites` créées via `sql/07-sites.sql`
- 3 sites peuplés : Brencklé, Clubhouse, Holtzplatz (tous MOM)
- API distances (OpenRouteService) reportée à Phase 4.5 (optionnel)

### ✅ Phase 4.2.A — Noyau événements (FAIT — 13 mai 2026 matin)
- `sql/10` : tables `evenements` (28 colonnes) + `evenement_encadrants` (9 colonnes)
- 13 indexes, 8 CHECK, trigger `set_updated_at` réutilisant `trigger_set_updated_at()`
- Naming `_id`, code manuel à l'INSERT, RLS SELECT authenticated

### ✅ Phase 4.2.B — RPC événements (FAIT — 13 mai 2026)
- `sql/11` : 2 RPC SECURITY DEFINER authenticated-only
- `get_evenements_a_venir(p_equipe_id, p_jours_a_venir)` + `get_prochain_evenement_par_equipe(p_equipe_id)`

### ✅ Phase 4.2.C — Wrappers JS v1.5 (FAIT — 13 mai 2026)
- `js/supabase-client.js` v1.4 → v1.5 : 2 méthodes
- `SupabaseHub.getEvenementsAVenir()` + `SupabaseHub.getProchainEvenementParEquipe()`

### ✅ Étape G — Peuplement événements M14 réels (FAIT — 13 mai 2026)
- `sql/12` : 4 événements M14 saison 2025-2026
- Frankfurt (passé), J5 ECLR (passé XV victoire 41-7), Les Gemmeurs (à venir), Challenge Vié (à venir, finale régionale)

### ✅ Étape K — Policies RLS SELECT Vague 1 (FAIT — 13 mai 2026)
- `sql/13` : 3 policies SELECT authenticated sur ententes, equipes, equipe_joueurs
- `personnes` volontairement non touchée : accès via RPC uniquement (doctrine RGPD)

### ✅ Étape H — 15 entraînements M14 fin de saison (FAIT — 13 mai 2026)
- `sql/14` : 15 entraînements (LUNDI 18h00 + MERCREDI 14h00 à Brencklé)
- 14 en `creation`, 1 en `annule` (Pentecôte)

### ✅ Phase 4.4 Étape C — Widget "Prochain événement M14" en sidebar (FAIT — 13 mai 2026)
- `index.html` : carte `.sb-card` insérée en sidebar
- `js/dashboard-stats.js` v2.1 → v2.2 : 8e appel `Promise.all`, calcul jour civil côté JS

### ✅ C7 — Audit doctrine OVAL-E joueurs partenaires d'entente (TERMINÉE)
- C7-a/b/c/d/e/f/g/h toutes soldées ou clarifiées. Détail :
  - C7-a + C7-b livrées côté Audits (Audit-OVAL-E-Joueurs-Partenaires v1, Audit-Personnes v1.2, Doctrine-Import-OVAL-E v1.4)
  - C7-c livrée Production (`sql/15` : ajout type `licencie_externe_partenaire`)
  - C7-f livrée Production (`sql/16` : 50 fiches partenaires SAR importées)
  - C7-e résolue naturellement par la RPC `get_vivier_compo` en Phase 4.3
  - C7-d résolue par RLS write groupée (sql/24-25-26)
  - C7-g reste long terme (passerelle OVAL-E partenaires FFR)
  - C7-h reste à l'usage (workflow changement de club)

### ✅ Phase 4.3 — Compositions, présences, RPC vivier (FAIT — 13 mai 2026 matin)

Session de ~2h, 5 fichiers SQL livrés. sql/20 sauté (M-1 dette ouverte).

- **`sql/17-attaches-partenaires-entente-m14.sql`** : 39 attaches `equipe_joueurs` pour les joueurs partenaires SAR/ASCS importés via sql/16. Statut `regulier`, `club_provenance_id = SAR` par défaut (distinction ASCS reportée à dette (m)). Total attaches actives M14 EQ1 : **62** (23 MOM + 39 partenaires).
- **`sql/17b-fix-categorie-partenaires.sql`** : correctif post-sql/16 — les 39 joueurs partenaires avaient `categorie_id = NULL` (l'export SportEasy ne contenait pas la catégorie d'âge). UPDATE `categorie_id = M14` sur les 39 joueurs. Découvert lors du smoke test sql/21.
- **`sql/18-compositions.sql`** : tables `compositions` (11 colonnes initiales, états `brouillon`/`validee`/`jouee`, versioning via `est_active` + index unique partiel) et `composition_joueurs` (10 colonnes initiales, FK `joueur_id` vers `personnes` sans polymorphisme, UNIQUE titulaire par poste, flag `est_depannage_hors_categorie`). 9 indexes, RLS SELECT authenticated.
- **`sql/19-presences.sql`** : table `presences` (11 colonnes, FK `personne_id` unifiée MOM/partenaires/encadrants, statuts `present`/`absent`/`present_partiel`, lien optionnel `composition_joueur_id`, UNIQUE `(evenement_id, personne_id)`). 6 indexes, RLS SELECT.
- **`sql/21-rpc-vivier-compo.sql`** : RPC `get_vivier_compo(p_equipe_id UUID)` SECURITY DEFINER authenticated-only, 15 colonnes retournées (IDs + libellés humains + flags `est_partenaire_entente`/`f15_integree` + `statut_attache`).

**Smoke test RPC** (M14 EQ1) : total **63** / réguliers **62** / partenaires **39** / f15 **8** / non_attachés **1**. Contrats métier OK.

### ✅ Dette C8 a/b/c/d/e — ALTER additifs compositions (TOTALEMENT SOLDÉE 13 mai 2026)

Issue de `Audit-Module-Compositions-v3.md` (conv Audits).

- **`sql/22-alter-compositions-c8.sql`** (C8-a + C8-b) : ajoute `type_compo` TEXT NOT NULL DEFAULT `'match'` CHECK IN (`base`,`match`) — distingue compo de base (plan A J-7) vs compo de match (J-0). Ajoute `compo_base_origine_id` UUID NULL REFERENCES `compositions(id)` (auto-FK) — trace la dérivation compo de match ← compo de base. CHECK additionnel cohérence + index partiel. Table `compositions` passe à 13 colonnes / 5 CHECK / 5 indexes.
- **`sql/23-alter-composition-joueurs-c8.sql`** (C8-c) : ajoute `etat_joueur` TEXT NOT NULL DEFAULT `'base'` CHECK IN (`base`,`modifie`,`independant`,`blesse`) — matérialise les 4 couleurs de l'éditeur SAR×MOM Compos hérité (bleu/orange/vert/rouge). Support de l'écriture exceptionnelle Suivi Match (signalement blessé). Index partiel sur blessés. Table `composition_joueurs` passe à 11 colonnes / 2 CHECK / 6 indexes.
- **`sql/27-alter-compositions-etat-c8d.sql`** (C8-d) : renommage `etat='jouee'` → `etat='utilisee'` + ajout `etat='archivee'`. Pattern BEGIN + pre-check (table doit être vide ou compatible) + DROP CHECK + UPDATE éventuels + ADD nouveau CHECK + post-check. Exécuté sur base vide, zéro risque.
- **C8-e** résolue par la session RLS write groupée (sql/26).

### ✅ Phase 4.4 P4-2 — Greeting J-N AVANT MATCH (FAIT — 13 mai 2026 après-midi)

- **`js/dashboard-stats.js` v2.2 → v2.3** : pilote le surtitre `greeting-meta` selon le prochain événement M14.
- Réutilise `prochainEvtM14` déjà fetché par v2.2 pour la sidebar — zéro RPC supplémentaire.
- Logique extraite dans 3 helpers : `joursCivilsAvant`, `formatTypeEvenement`, `formatGreetingMeta`.
- **Formats produits** :
  - J=0 entraînement → `AUJOURD'HUI · ENTRAÎNEMENT · BRENCKLÉ`
  - J=1 → `DEMAIN · TYPE · IDENTIFIANT`
  - J>1 entraînement → `DANS N JOURS · ENTRAÎNEMENT · BRENCKLÉ` (raccourci, pas "J-N AVANT ENTRAÎNEMENT" pompeux)
  - J>1 match/tournoi → `J-N AVANT MATCH · VS ECLR` / `J-N AVANT TOURNOI · LES GEMMEURS`
  - Fallback gracieux : `MARDI 13 MAI 2026 · TABLEAU DE BORD`
- Test prod validé visuellement le 13 mai 12h35. Dette P4-2 fermée.

### ✅ Session RLS write par rôle (FAIT — 13 mai 2026 après-midi)

3 fichiers SQL livrés, 27 nouvelles policies write au total sur 9 tables. Résout dettes (i), (l), C7-d, C8-e.

**Choix doctrinaux** :
- Option B retenue : **coach = write libre partout** (P1 simplicité, 1 seul coach prod aujourd'hui = Manu). À durcir en Option A (table de jonction `coach_equipes`) quand multi-coach réel (dette q).
- Helper `has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER` réutilisé (existant Phase 2.5).

**Matrice de droits appliquée** :

| Table | INSERT | UPDATE | DELETE |
|---|---|---|---|
| ententes | admin | admin | admin |
| equipes | admin + coach | admin + coach | admin |
| equipe_joueurs | admin + coach | admin + coach | admin |
| evenements | admin + coach | admin + coach | admin |
| evenement_encadrants | admin + coach | admin + coach | admin |
| compositions | admin + coach | admin + coach | admin + coach |
| composition_joueurs | admin + coach | admin + coach | admin + coach |
| presences | admin + coach | admin + coach | admin |
| distances_sites | admin | admin | admin |

**Fichiers** :
- `sql/24-rls-write-vague1.sql` : 12 policies (ententes 3 admin-only, equipes 3 mixtes, equipe_joueurs 3 mixtes, distances_sites 3 admin-only). Cleanup proactif `DROP POLICY IF EXISTS` sur d'anciennes policies laxistes `distances_*`. Dette (l) résolue.
- `sql/25-rls-write-evenements.sql` : 6 policies sur evenements + evenement_encadrants.
- `sql/26-rls-write-compositions-presences.sql` : 9 policies sur compositions, composition_joueurs, presences.

**Test E2E validé** depuis console portail (admin authenticated) : INSERT compositions → `error: null` + DELETE → 1 ligne supprimée. Chemins exercés : `has_role('admin')` côté Postgres, JWT correctement transmis depuis le front, RLS check passé.

Dettes (i), (l), C7-d, C8-e toutes résolues.

### ✅ Phase 4.4 — UI éditeur de compositions (étapes 6a, 6b, 6c-1, 6c-2, 6c-3 LIVRÉES — 13 mai 2026 fin de journée)

Module **`compositions.html`** (page dédiée à la racine), accessible aux rôles **admin** ET **coach**.

**Brief Conception préparé** : `brief-conception-phase-4-4-ui-compo.md` rédigé pour transmettre à conv Conception Portail. 10 sections couvrant contexte, choix tranchés, API JS disponible, modèle données, workflows, contraintes, 8 questions UX.

**Retour Conception reçu** : `Conception-Portail-Phase-4-UI-Compo.md` uploadé par Manu (Drive `00 - Documentation/`). Décisions actées :
- **6 écrans V1** : E1 dashboard, E2 modale création, E3 vue Liste (édition principale clic-clic bidirectionnel via Popover Picker), E4 vue Terrain read-only, E5 Popover Picker, E6 modale historique versions
- **2 écrans V2 différés** : E7 Vue Réseaux Sociaux, E8 saisie présences (SportEasy reste référence)
- **Composants transverses** : topbar Hub, bandeau Événement, barre onglets `[BASE]`/matchs, bandeau légende 4 couleurs permanent, indicateur de remplissage, pastille état
- **Q1 terrain** : Liste + Terrain côte à côte (XV statique V1, X/7/5 différé V2)
- **Q2 ajout** : clic-clic V1, drag-and-drop V1.1
- **Q3** : pas de Vue Comparaison séparée (4 couleurs + onglets suffisent)
- **Q4** : modale historique lecture seule
- **Q5** : auto-save 30s + verrouillage souple (validateCompo / unvalidateCompo / markCompoUtilisee)
- **Q6** : vivier trié par groupe (Réguliers MOM / Partenaires / Renforts / Non-attachés) + étiquettes discrètes + 1 filtre "Masquer partenaires"
- **Q7** : PAS de saisie présences en Phase 4.4
- **Q8** : responsive desktop + mobile dégradé (breakpoint 1024px)

**Couleurs joueur validées** : `--bleu-base #3066BE` (base), `--clay` (modifié, existant), `--vert-prairie` (indépendant, existant), `--rouge-blesse #C73E3E` (blessé). Ajoutées dans `css/hub.css` v1.1.

**Wrappers JS écriture livrés** (`js/supabase-client.js` v1.6 → v1.7.1) — 13 wrappers :
- Lecture (3) : `getVivierCompo`, `listCompositionsByEquipe`, `getCompoComplete`
- Écriture compositions (7) : `createCompo`, `duplicateCompoFromBase`, `updateCompoNotes`, `validateCompo`, `unvalidateCompo`, `markCompoUtilisee`, `archiveCompo`
- Écriture composition_joueurs (4) : `addJoueurCompo`, `updateJoueurCompo`, `updateJoueurEtat`, `removeJoueurCompo`
- Pattern de retour unifié `{ok, data?, error?}`
- v1.7.1 = fix `.maybeSingle()` sur les 3 wrappers à garde-fou (validateCompo / unvalidateCompo / markCompoUtilisee) — sinon PGRST116 masquait les messages métier custom
- Dette (o) soldée

**Étape 6a — Squelette HTML/CSS** (LIVRÉE) :
- `compositions.html` créé à la racine. DOM minimal : topbar Hub partagée, bandeau événement, barre onglets `[Base]`+`[+]`, bandeau légende 4 couleurs, indicateur remplissage, onglets Liste/Terrain, grille [panneau effectif 320px sticky | éditeur central 1fr].
- `css/hub.css` v1.0 → v1.1 : ajout `--bleu-base` et `--rouge-blesse` dans `:root`.
- Auth garde : `requireAuth` pour admin OU coach (les 2 rôles autorisés).
- Responsive 1024px (basculement single-column).

**Étape 6b — Chargement dynamique** (LIVRÉE) :
- `compositions-editor.js` v1 : navigation événements (16 chargés depuis RPC `get_evenements_a_venir`), sélecteur cliquable, création compo BASE testée bout-en-bout (INSERT compositions OK, onglet `[BASE]` actif, état "Brouillon · v1 · base").

**Étape 6c-1 — Panneau Effectif vivier** (LIVRÉE) :
- `compositions-editor.js` v2 : vivier 63 joueurs M14 affichés en groupes (`RÉGULIERS MOM (23)` / `PARTENAIRES ENTENTE (39)` / `NON-ATTACHÉS (1)`), avatars 28px circulaires (initiales Oswald), étiquettes discrètes (F-15 gold, SAR clay, Renfort bleu-base). Filtre "Masquer les partenaires entente" (63 → 24). Tri alpha intra-groupe. Lecture seule.

**Étape 6c-2 + 6c-3 — Vue Liste éditable + Popover Picker** (LIVRÉE FUSIONNÉE) :
- `compositions-editor.js` v3.0 → v3.4 après 4 fix successifs en debugging live :
  - v3.0 → v3.1 : mismatch `poste.uuid` (JSON Drive) vs `poste.id` (table Supabase) — `params.poste_id` était `undefined` → erreur "poste_id requis". Idem `numero_maillot` → `numero_xv`. Filtre `formats_applicables` retiré (la table contient déjà uniquement les 15 XV).
  - v3.1 → v3.2 : `cj.personnes` retourne `null` car RLS bloque la jointure depuis `composition_joueurs` vers `personnes` (doctrine RGPD). Remplacement par lookup dans `State.vivierById` (chargé via RPC `get_vivier_compo` SECURITY DEFINER, RLS-safe).
  - v3.2 → v3.3 : warning ⚠ "hors-M14" s'affichait pour tous les joueurs. Cause : `M14_CATEGORIE_ID = 'cat-m14'` (slug inventé, dette j anti-invention) alors que la table `categories` utilise l'UUID `312ebb88-25e8-40c5-8a37-9dd2e3927e2e`. Remplacement par l'UUID réel. En V1, la RPC filtre déjà sur M14 donc le warning ne s'affichera jamais en pratique ; le code reste prêt pour V2 multi-équipes.
  - v3.3 → v3.4 : recherche popover "à l'envers" (taper "obi" donnait "ibo"). Cause : à chaque frappe, `renderPopover()` recréait l'input dont le curseur retournait en position 0. Refactor : extraction des items dans 2 helpers (`popoverListItemsSlotVide`, `popoverListItemsJoueurVivier`), nouvelle fonction `refreshPopoverList()` qui ne touche qu'au `<ul>`.
- Page `compositions.html` : ~500 lignes avec ~110 règles CSS dédiées (slots 6 colonnes, 4 variantes état joueur, popover overlay 420px, indicateur 3 paliers couleur, responsive 1024px adapté).

**Fonctionnalité validée bout-en-bout** : créer compo de base → cliquer slot vide poste 1 (Pilier G) → popover liste 63 joueurs filtrables par recherche → choisir un joueur → slot devient occupé bleu avec nom, indicateur passe à `1/15 postes pourvus`, joueur grisé dans panneau Effectif, bouton × retire proprement. Base de test nettoyée en fin de session (DELETE ciblés sur 2 compos de debug par UUID).

**Étapes restantes Phase 4.4** :
- 6c-4 : autosave notes_compo 30s + validation/repassage brouillon/marquer utilisée + boutons d'action (valider/repasser-brouillon/marquer utilisée/archiver) dans la zone d'édition
- 6c-5 : Vue Terrain (visualisation read-only XV via positions hardcodées ou postes.json)
- 6c-6 : Modale Création E2 complète (radio base/match + sélecteur compo source pour dupliquer)
- 6c-7 : Modale Historique E6 (versions précédentes lecture seule)

### ✅ Module Bibliothèque d'ateliers EDR (FAIT — 14 mai 2026)

Module **autonome** intégré au portail MOM Hub. Aucune modification de fichiers partagés (`css/hub.css`, `js/supabase-client.js`, etc.). Livré par la conv "Production Module Bibliothèque" (ouverte le 14 mai 2026, distincte de la conv Modules Ateliers qui avait fait le cadrage doctrinal v1.0 et de la conv Production générale qui possède l'architecture du portail).

**Architecture** : Scénario 2 — **Drive = source ET lieu de lecture**. Pas de Supabase pour ce module (contrairement aux autres modules MOM Hub). Le Hub web lit directement les 2 JSON dans `data/`. Bascule prévue en Scénario 3 (table Supabase `ateliers` miroir) à l'arrivée du module Préparation de séance (à coordonner).

**Fichiers livrés et committés** (5 commits séparés sur `main`) :
- `bibliotheque.html` : page module à la racine, ~38 KB, 1257 lignes. Topbar Hub standardisée (onglet "Bibliothèque" en `.active`). CSS spécifique inline (~25 KB) avec classes préfixées `.biblio-*` pour la plupart, ainsi que `.m-*` (modal) et `.plan-*` (vue Plan) — toutes scopées au document. Auth admin OR coach (pattern identique à `compositions.html`).
- `js/bibliotheque-browser.js` : module IIFE `window.BibliothequeBrowser.{init, openModal, closeModal}`, cohérent avec `js/compositions-editor.js`. Fetch `data/ateliers.json` + `data/fiches-all.json` en parallèle, mode dégradé si bundle absent. Rendu vues Cartes / Plan, modal détail avec vidéo embed Drive `/preview` 16:9, filtres âge/famille/type/recherche texte. Stop automatique de la vidéo à la fermeture de la modal.
- `data/ateliers.json` : index taxonomique, 87 KB, schéma v2.0. 4 rubriques (Organisation collective, Technique individuelle, Activations physiques, Jeu au poste), 14 sous-rubriques, 82 ateliers_flat. Clé étrangère = `id` atelier (fileId Drive 33 caractères). Édité à la main par Manu depuis Drive `01 - Référentiels/ateliers/`.
- `data/fiches-all.json` : bundle détaillé, 139 KB. Object Drive-fileId-keyed (62 fiches sur 82 ateliers déclarés ; les 20 sans fiche sont soit des vidéos pures, soit des ateliers en attente de production — gérés en mode dégradé par le JS). Généré par `Build-Fiches-All.gs` (Apps Script de Manu) sur Drive fileId `156WucB3mgISTssfIZC3MSSOZCNHt5OOO` dans `_MOM-Hub-WORK/`. À régénérer à chaque évolution des fiches (Converter v3.3 à venir, retouches PPTX, nouvelles fiches Jeu au poste, etc.).

**Modification `index.html`** : activation des 2 premières tuiles du dashboard (convention posée pour la première fois) :
- Tuile "Compositions" : `class="tool todo"` → `class="tool" onclick="location.href='compositions.html'" role="link" tabindex="0"`. Statut "todo À venir" → "on Disponible". *Note : la page `compositions.html` était en prod depuis le 13 mai mais sa tuile était restée par oubli en mode "À venir".*
- Tuile "Bibliothèque ateliers" : idem activation. Sous-titre "4 rubriques · fiches PPTX" → "4 rubriques · 62 fiches".
- Sidebar : 2 liens activés (`href="compositions.html"` et `href="bibliotheque.html"`).

Le CSS de `hub.css` définit déjà `.tool-status.on` (vert-prairie) — rien à modifier dans `hub.css`. Le choix `onclick` plutôt que wrap `<a>` évite tout problème de styling sur les éléments enfants.

**Convention d'activation des tuiles** (à reprendre pour les futures) :
```
AVANT : <div class="tool todo">...<div class="tool-status todo">À venir</div></div>
APRÈS : <div class="tool" onclick="location.href='X.html'" role="link" tabindex="0" title="...">
        ...<div class="tool-status on">Disponible</div></div>
```

**Tests post-déploiement validés** (14 mai) :
- Vague 1 smoke : page d'accueil OK, tuiles vertes "Disponible", liens sidebar fonctionnels, console JS propre.
- Vague 2 fonctionnels Bibliothèque : auth admin/coach OK, chargement `ateliers.json` + `fiches-all.json` OK, vue Cartes (4 rubriques), modal détail (cartouche meta + pédagogie + vidéo embed), arrêt vidéo à fermeture modal OK, vue Plan (accordéon), filtres âge/famille/recherche texte, déconnexion → `login.html`.
- Vague 3 cas dégradé + responsive : **reportée**, à faire à tête reposée.

**Coordinations en attente** :
- À l'arrivée du module **Préparation de séance** (annoncé "dans quelques semaines") : bascule en Scénario 3 (table Supabase `ateliers` miroir). Clé étrangère pour `seances_ateliers` = `fileId_dossier` Drive (string ~33 caractères), pas d'`atl-NNNN` séquentiel. Specs précises de la table à fournir par la conv "Production Module Bibliothèque" le moment venu.
- **Converter PPTX v3.3** (conv Converter) : schéma `fiche.json` cible aligné sur `Schema-atelier-json-v2.0.md`. Le module Bibliothèque actuel **tolère les deux schémas** (`critere_reussite` singulier v3.2 ET `criteres_reussite` pluriel v2.0), pas de rupture attendue.

**Caveats** :
- Vidéos Drive : transcoding lent au premier accès (>50 MB), affiche "traitement en cours" quelques heures. Pas un bug. Long terme : envisager extraction 720p H.264 ~10-30 MB max (à coordonner avec Converter v3.3+).
- Le dossier Drive `_MOM-Hub-WORK/ateliers-converted/` **doit rester en partage "Tous les utilisateurs disposant du lien, Lecteur"** pour que les iframes `/preview` fonctionnent. Conséquence : contenu pédagogique accessible via lien direct par quiconque connaît le lien. Cohérent avec module servi sur GitHub Pages public + auth coach minimum.

---

### ✅ Module Préparation de séance (FAIT — 15 mai 2026, Phases 5.1 → 5.11 V1 complet)

Module **complet** intégré au portail MOM Hub. 3e tuile activée en dashboard (après Compositions et Bibliothèque). Livré par la conv "Production générale" (cette conv) en 11 phases techniques étalées entre le 14 mai (squelette + méta + trame + détail bloc) et le 15 mai (picker ateliers + groupes + sidebar enrichie + activation tuile).

**Architecture** : Scénario 1 — **Supabase = source de vérité** (3 tables `seances`, `seances_blocs`, `seances_blocs_ateliers` + 2 RPC). Le module lit le miroir `data/fiches-all.json` (livré 14 mai par la Bibliothèque) pour enrichir l'affichage des ateliers rattachés à un bloc — pas de duplication, le même JSON sert pour 2 modules.

**11 phases livrées** :

| Phase | Sujet | Date |
|---|---|---|
| 5.1 | Modélisation Supabase : `sql/28-seances.sql` (3 tables + indexes + 2 RPC `get_seances_a_venir` / `get_seance_complete` + RLS write admin/coach + smoke test SQL séparé) | 14 mai |
| 5.2 | Référentiels statiques : `data/types-blocs.json` v1.1 (11 types : accueil, mise_en_train, echauffement, echauffement_specifique, corps_seance, jeu_application, match_application, retour_au_calme, bilan, pause_boisson, bloc_libre) + `data/vocabulaire-seance.json` v1.1 (4 axes FFR : phases macro, types d'unités, composants échauffement, champs FFR) | 14 mai |
| 5.3 | Wrappers JS : `js/supabase-client.js` v1.7.1 → v1.8 (13 wrappers Préparation : `listSeancesByEquipe`, `getSeanceComplete`, `getSeancesAVenir`, `listModelesSeance`, `createSeance`, `updateSeance`, `archiveSeance`, `addBlocToSeance`, `updateBloc`, `removeBloc`, `reorderBlocs`, `attachAtelierToBloc`, `detachAtelierFromBloc`) | 14 mai |
| 5.4 | UI squelette `seance.html` : topbar Hub onglet "Préparation de séance" en `.active`, sidebar liste séances, zone éditeur vide, auth admin OR coach, CSS spécifique inline `.seance-*` | 14 mai |
| 5.5.A | Éditeur méta v1 : 6 champs (date, heure, durée, effectif, thème, axe travail) + sauvegarde manuelle | 14 mai |
| 5.5.B1 | 2 dropdowns (lieu_id via `listSitesActifs` wrapper v1.8.1, evenement_id via `getEvenementsAVenir`) + 5 champs secondaires (météo, encadrants, objectifs, cycle, matériel) | 14 mai |
| 5.5.B2 | Autosave 30s + clic sidebar → recharge séance + pastille statut 3 états | 14 mai |
| 5.6.A | Trame chronologique palier 1/2 : table 4 colonnes (Horaire / Bloc / Durée / Actions), calcul auto horaires (cumul), popover "+ Ajouter un bloc" (11 types), wrapper `listBlocsBySeance` v1.8.2 | 14 mai |
| 5.6.B | Trame palier 2/2 + ergonomie : actions ↑↓🗑 par bloc, repli auto formulaire en résumé compact après save (arbitrage UX), bouton "↑ Replier" (fix v1.4.1) | 14 mai |
| 5.7 | Détail bloc : édition complète (type changeable, durée, titre précision, intensité conditionnelle 4 niveaux FFR/World Rugby, 2 étiquettes Axes 2/3 selon type, 10 champs FFR Axe 4 en jsonb, comportements/organisation/notes), autosave 30s du bloc, wrappers `updateBloc` + `removeBloc` + `reorderBlocs` | 14 mai |
| **5.8** | **Picker ateliers Bibliothèque** : section "📚 Ateliers rattachés" en bas de détail bloc, modale picker avec recherche live insensible aux accents (62 fiches), enrichissement depuis `data/fiches-all.json` (titre/thème/niveau/durée/lien Drive), boutons 🗑 par rattachement, anti-doublon (badge "déjà rattaché" + clic bloqué). Wrapper `listAteliersRattachesAuBloc` ajouté en v1.8.3 | **15 mai** |
| **5.9** | **Groupes G1/G2/G3 par bloc** : section "👥 Groupes" en bas de détail bloc, 3 cartes côte à côte (G1=Performance #8B0000, G2=Développement #FF8C00, G3=Initiation #4682B4), 3 popovers indépendants pour sélection joueurs depuis vivier M14 (`getVivierCompo` existant), unicité par bloc (joueur dans 1 seul groupe à la fois, ⛔ grisé), héritage auto des groupes du bloc précédent à la création. Stockage jsonb dans champ `groupes_jsonb` existant (Phase 5.1). Nouveau référentiel `data/groupes-joueur.json` (miroir Drive). Pas de nouveau wrapper Supabase. | **15 mai** |
| **5.10** | **Sidebar enrichie + nettoyage brouillons** : toggle "Afficher les archivées" en header sidebar (volatile, pas de localStorage par doctrine), bouton "📦 Archiver" dans formulaire méta (déplié ET résumé replié, désactivé si déjà archivée), section "🗑 N brouillons vides" en bas de sidebar avec bouton "🧹 Nettoyer" (visible uniquement si N>0), `loadSeances()` couplé à `loadBrouillonsVides()` pour rafraîchissement automatique. 2 nouveaux wrappers `listBrouillonsVides` + `deleteBrouillonsVides` (v1.8.4). **Résout la dette D-SEANCE-STUB-VIDES**. | **15 mai** |
| **5.11** | **Activation tuile dashboard** : modif `index.html` section 01 / Pédagogie EDR. Tuile "Constructeur de séance" (libellé v1) → "Préparation de séance" (libellé v2 issu de `Conception-Portail-Architecture-V2.md`), `class="tool todo"` → `class="tool" onclick="location.href='seance.html'" role="link" tabindex="0"`, statut "À venir" → "Disponible". Compteurs `sec-meta` corrigés (section 01 "4 outils · 2 disponibles", section 02 "4 outils · 1 disponible"). | **15 mai** |

**Fichiers livrés et committés** (état au soir du 15 mai) :
- `sql/28-seances.sql` : 3 tables + 2 RPC + RLS write (Phase 5.1).
- `seance.html` : ~1815 lignes (squelette + CSS spécifique inline `.seance-*` + 6 sous-sections CSS : sidebar/form/trame/détail bloc/ateliers/groupes/popovers/responsive).
- `js/seance-editor.js` : v1.8 (Phase 5.10), ~2988 lignes, module IIFE `window.SeanceEditor.{init}`. Pattern identique à `compositions-editor.js` (sections numérotées, State global, DOM lazy, helpers, rendus, actions, chargements, init).
- `js/supabase-client.js` : v1.8.4 (Phase 5.10), ~1521 lignes. 16 wrappers Préparation au total (les 13 de Phase 5.3 + listBlocsBySeance + listAteliersRattachesAuBloc + listBrouillonsVides + deleteBrouillonsVides ; + le wrapper existant `getVivierCompo` réutilisé pour les groupes).
- `data/types-blocs.json` v1.1, `data/vocabulaire-seance.json` v1.1, `data/groupes-joueur.json` v1.1 : 3 référentiels statiques fetched à l'init en parallèle via Promise.all (force-cache).
- `index.html` modifié (Phase 5.11).

**Couplage avec les autres modules** :
- **Bibliothèque** : un bloc peut rattacher 1+ ateliers via `seances_blocs_ateliers.atelier_fileid_drive` (TEXT 33 chars). Clé étrangère **logique**, pas SQL stricte (dette D-BIBLIO-V2-MIGRATION ouverte — la table Supabase `ateliers` miroir n'existe pas encore).
- **Événements** : une séance peut être **optionnellement** rattachée à un événement existant (`seances.evenement_id` NULLABLE, lien vers les 15 entraînements M14 peuplés via `sql/14`).
- **Vivier M14** : groupes G1/G2/G3 peuplés via la RPC `get_vivier_compo` existante (Phase 4.3) — 62 joueurs (23 MOM + 39 partenaires SAR/ASCS) au 15 mai.
- **Compositions** : pas de lien direct V1 (V2 envisageable : un bloc pourrait référencer une compo de match pour préparer le déroulé).

**Tests post-déploiement validés** (15 mai) :
- Console portail : `🏉 MOM Hub · Supabase Client v1.8.4 chargé` + `✅ wrappers v1.8.4 disponibles` + `SeanceEditor: fiches-all.json chargé (62 fiches)` + `SeanceEditor: groupes-joueur.json chargé (3 groupes)` + `SeanceEditor: vivier M14 chargé (63 joueurs)` + `🏉 Seance Editor v1.8 (Phase 5.10) chargé`. (NB : 63 joueurs vs 62 attendus — 1 joueur ajouté au vivier dans la journée, info volatile, pas un bug.)
- Tuile dashboard "Préparation de séance" verte "Disponible" cliquable, mène à `seance.html`.

**Limites connues V1** (différées V2) :
- Export PDF du cartouche de séance (chantier conséquent — jsPDF + html2canvas ou Apps Script Drive).
- Modèles de séance (champ `est_modele` déjà dans le schéma DB, UI à coder).
- Drag-and-drop pour réordonner blocs (V1 livre flèches ↑↓).
- Bilan post-séance (observations/régulations + axes prochaine).
- Météo structurée (V1 texte libre).
- Encadrants structurés via `evenement_encadrants` quand `evenement_id` renseigné (V1 texte libre).
- Multi-équipes (V1 M14 EQ1 hardcodé via constante `M14_TEAM_UUID`).

### ✅ Phase 4.4 backend Évènements — RPC C9 (FAIT — 15 mai 2026 après-midi)

Conv « Joueurs/Évènements » (cf. kickoff matin). Session 1 du séquencement validé en 4 sessions module-par-module.

**Livraisons** :
- `sql/29-rpc-evenements-c9.sql` (NOUVEAU, 488 lignes, transaction BEGIN/COMMIT atomique) :
  - **MODIFIE** `get_evenements_a_venir(p_equipe_id, p_jours_a_venir)` : DROP+CREATE pour ajouter colonne `compo_status_summary JSONB` (16→17 cols retour). Comportement Phase 4.2.B conservé (exclut `'annule'` + `'archive'`).
  - **MODIFIE** `get_prochain_evenement_par_equipe(p_equipe_id)` : recréée pour hériter de la nouvelle signature à 17 cols. Continue d'appeler `get_evenements_a_venir(p_equipe_id, 365) LIMIT 1`.
  - **CRÉE** `get_evenements_passes(p_equipe_id, p_jours_passes, p_limit)` : dette C9-a, symétrique de `a_venir`. ORDER BY `date_debut DESC`, plafond configurable. Inclut `'annule'` (visibles barrés UI cohérent doc Conception §3.5), exclut `'archive'` seulement.
  - **CRÉE** `get_evenement_with_encadrants(p_evenement_id)` : dette C9-b, fiche détaillée E2. 24 cols dont `encadrants JSONB` array enrichi (`personne_id, nom, prenom, roles_encadrement, ordre, notes`) trié `ORDER BY ordre NULLS LAST, date_creation ASC`. Aucun filtre `etat` (utilisable sur événement annulé ou archivé).
- `js/supabase-client.js` : v1.8.4 → **v1.9** (+84 lignes net, état total ~1605 lignes) — dette C9-c.
  - **AJOUTE** `getEvenementsPasses(equipeId, joursPasses=30, limit=50)` → `[]` ou tableau.
  - **AJOUTE** `getEvenementWithEncadrants(evenementId)` → `null` ou objet (validation evenementId obligatoire).
  - NON modifiés (transparent côté entrée, +1 col côté sortie via PostgREST) : `getEvenementsAVenir`, `getProchainEvenementParEquipe`.

**Doctrine `compo_status_summary` (C9-d V1 simple)** : agrégat JSONB `{total, brouillon, validee, utilisee}` filtré `cote='mom' AND est_active=TRUE`. Pas de récursion serveur parent→enfants. Pour un tournoi parent, valeur = `{0,0,0,0}`. L'agrégat parent↔enfants se fera côté client UI à l'affichage (P1).

**Smoke test passé en base** : 8 tests fonctionnels successifs validés (signatures 17/17/17/24 cols, JSONB type=`object` partout, encadrants type=`array` même vide grâce à `COALESCE([]::jsonb)`).

**2 commits séparés** poussés sur main (sql/29 puis js v1.9).

**Reste à venir** : S2 UI Évènements (~2-3h, 5 écrans E1-E5 selon doc Conception), puis S3 backend Joueurs (~3h30-4h30, 10 dettes C10), puis S4 UI Joueurs (~3-4h, 6 écrans J1-J6 + composant fiche-personne.js à 2 modes).

---

## 🔧 Patterns techniques acquis

**Pattern lecture RGPD-safe** (depuis Phase 2.4) :
1. Côté Supabase : fonction RPC `SECURITY DEFINER` qui retourne uniquement les chiffres ou objets nécessaires
2. RLS strict sur la table sensible : pas de policy SELECT pour `anon`/`authenticated` sur `personnes`
3. Côté JS : `supabaseClient.fetchData('rpc/<fn_name>')`
4. Fallback gracieux

**Pattern écriture par rôle** (depuis sql/24-25-26) :
- RLS write activée par rôle via `has_role('admin' | 'coach')`
- Coach = write libre sur les tables métier (equipes, equipe_joueurs, evenements, evenement_encadrants, compositions, composition_joueurs, presences)
- Admin seul sur tables structurantes (ententes, distances_sites) et sur DELETE de la plupart des tables
- Appel : `SupabaseHub.client.from('<table>').insert/update/delete(...)` avec JWT authenticated

**Pattern wrapper JS Phase 4.4** (`js/supabase-client.js` v1.7.1) :
- Retour unifié `{ok: bool, data?: any, error?: string}`
- Garde-fous côté wrapper avec messages métier custom (ex : "La compo n'est pas en état 'brouillon'")
- `.maybeSingle()` au lieu de `.single()` quand UPDATE avec filtre sur état source (sinon PGRST116 masque le message custom)
- Whitelist de champs explicite dans les UPDATE (sécurité)
- Rollback manuel JS quand séquence d'opérations sans transaction (ex : `duplicateCompoFromBase`)

**Pattern UI render efficient** (depuis Phase 4.4 6c-2/6c-3 v3.4) :
- Quand un input texte de recherche est dans le rendu, ne PAS re-render tout le conteneur à chaque frappe
- Extraire la zone qui change (liste de résultats) dans un helper réutilisable
- Fonction dédiée de "refresh ciblé" qui touche uniquement au sous-DOM concerné + recâble les listeners click
- Préserve le focus + position du curseur de l'input

---

## 🔄 Doctrine Réconciliation OVAL-E (sources de vérité)

Documents de référence (Drive `00 - Documentation/`) :
- `Doctrine-Import-OVAL-E-v1.4.md` (canonique) — 8 valeurs `type_personne` dont `licencie_externe_partenaire`, §11.7 partenaires d'entente
- `Audit-Personnes-MOM-Hub-v1.2.md` — 5 profils dont partenaires d'entente
- `Audit-OVAL-E-Joueurs-Partenaires-v1.md` — doctrine C7
- `Audit-Module-Compositions-v3.md` — révision post-Phase 4.3, ouvre dette C8
- `Conception-Portail-Phase-4-UI-Compo.md` — spécifications UI éditeur compo Phase 4.4

**Architecture des sources de vérité** :
- Drive figé au 10 mai 2026 pour la saison 2025-2026 — utilisable comme **archive**
- Supabase **autoritatif** pour les données vivantes (323 fiches MOM + 50 partenaires)
- OVAL-E export FFR = source externe pour réconciliation annuelle

**Mapping qualités FFR → type_personne** : 5 valeurs licenciées MOM (`licencie_joueur`, `licencie_dirigeant`, `licencie_educateur`, `licencie_soigneur`, `licencie_arbitre`) + `non_licencie` + `non_licencie_au_mom` + `licencie_externe_partenaire`. CHECK constraint Supabase mise à jour via `sql/15`.

---

## 🩹 Dettes techniques

### ✅ Dettes résolues le 11 mai 2026 (Phase 2.4.5)

1. ✅ Écart 293 vs 294 personnes
2. ✅ Écart 24 vs 23 M14 (= 16 M-14 + 8 F-15 intégrées)

### 🟡 Dettes encore actives (génériques)

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Pas bloquant.
4. **Référentiels Drive `01 - Référentiels/`** ⚠️ partiellement résolue : Lot 1 cohérence structurelle soldé. Lots 2-3 bloqués par tiers (règlement LRGER 2025-2026, Lohann, préparateur physique).
5. ✅ Chiffres en dur résiduels index.html — résolue 13 mai.
6. ✅ Date HTML statique — résolue 11 mai.
7. ✅ Désalignement Drive ↔ Supabase — arbitré 11 mai.
8. ✅ CHECK constraint `personnes_type_personne_check` — résolue 12 mai (sql/08) + étendue 14 mai (sql/15).

### 🔵 Dettes Phase 2.5

9. ✅ Architecture du portail — résolue 12 mai (Phase 3.2)
10. ✅ Panneau État du Hub sidebar — résolue 12 mai
11. ✅ CSS dupliqué — résolue 12 mai (Phase 3.1)
12. **Mini-déséquilibre `<div>` dans index.html** (1 div fermante manquante). Tolérée.
13. **Allow new users to sign up = ON dans Supabase Auth**. Passer à OFF quand autres rôles déployés.

### ✅ Dette résolue le 12 mai (conv Audits)

14. ✅ Modélisation entités événements / compositions / présences — Implémentation Phase 4.2.A à 4.3 livrée intégralement.

### 🔵 Dettes Phase 3

P4-1. **Adaptation portail par rôle** (`coach`, `viewer`) : quand comptes réels existeront.
P4-2. ✅ **Greeting J-N AVANT MATCH** — résolue 13 mai après-midi via `dashboard-stats.js` v2.3.
P4-3. ✅ **Widget prochain match** — résolue 13 mai matin via Phase 4.4 Étape C.
P4-4. **Sync SportEasy automatisée** : hors périmètre actuel.
P4-5. **Greeting mode anonyme à préciser** : à traiter avec compte `viewer` réel.
P4-6. **Personnalisation des `RACCOURCIS`** : à terme.
P4-7. **Outil de listing filtré des fiches** : à terme.

### 🔵 Dettes modélisation événements

M-1. **ALTER TABLE personnes — bloc_5** 🟡 demi-confirmée : ajouter `categorie_surclassement_id UUID NULL REFERENCES categories(id)`. Préalable au filtre surclassés dans `get_vivier_compo` (TODO commenté). Priorité faible.
M-2. **API d'itinéraire + cache `distances_sites`** : OpenRouteService. Priorité moyenne.
M-3. **Migration Drive → Supabase de `groupes-joueur.json`** : Priorité faible.
M-4. **Onglet paramètres pour édition admin** des référentiels. Lié à M-3.
M-5. **RPC `get_distance_between_sites`** : wrapper. Lié à M-2.

C7. ✅ **TOTALEMENT SOLDÉE** sauf C7-g (passerelle FFR long terme) et C7-h (changement club à l'usage).

### ✅ Dettes C8 (TOUTES SOLDÉES 13 mai 2026)

C8-a/b. ✅ LIVRÉE — `sql/22` : ALTER `compositions` ADD `type_compo` + `compo_base_origine_id`.
C8-c. ✅ LIVRÉE — `sql/23` : ALTER `composition_joueurs` ADD `etat_joueur`.
C8-d. ✅ LIVRÉE — `sql/27` : renommage `etat='jouee'` → `etat='utilisee'` + ajout `etat='archivee'`.
C8-e. ✅ LIVRÉE — `sql/26` (RLS write compositions/composition_joueurs).

### 🔵 Dettes techniques variées (lettres minuscules)

(c) **Mirror `groupes-joueur.json` v1.1** dans `data/` une fois déposé dans Drive.

(f) Déploiement comptes `coach` et `viewer` réels (préalable à P4-1).

(g) **D-qualite-ffr-array** : migration future `personnes.qualite_ffr` TEXT → ARRAY. À grouper avec import OVAL-E été 2026.

(h) **Compteur K3 CETTE SEMAINE biaisé jusqu'au 17 mai 2026** : la RPC retourne 373 (effet jeunesse de la base). Retombera mécaniquement après le 17 mai. Pas un bug.

(i) ✅ **LIVRÉE 13 mai** — RLS write par rôle via sql/24-25-26.

(j) **Leçon doctrinale Claude — anti-invention** : avant de citer un détail factuel (nombre, code, nom de champ/site/objet, UUID, slug), faire un `web_fetch` du repo OU un DRY-RUN Supabase. Renforcée 13 mai en debugging Phase 4.4 6c-2 : 4 bugs successifs causés par des inventions (`poste.uuid` au lieu de `poste.id`, `M14_CATEGORIE_ID = 'cat-m14'` au lieu de l'UUID réel, jointure `personnes` supposée fonctionner sans tester, `equipe_id` inventé pour le DELETE). Pattern de mitigation : avant d'écrire du code qui touche aux colonnes Supabase, lire un objet réel via console JS pour confirmer la structure.

(l) ✅ **LIVRÉE 13 mai** — Durcissement RLS WRITE distances_sites via sql/24.

(m) **Correction post-import ASCS** : les 50 fiches partenaires sql/16 sont taggées `club_principal_id = SAR`. UPDATE ciblé `club_principal_id = ASCS` à faire quand liste exacte fournie.

(n) **Complétion sexe + date_naissance partenaires** : 50/50 ont `sexe = NULL`, 23/50 ont `date_naissance = NULL`.

(o) ✅ **LIVRÉE 13 mai** — Wrapper JS `getVivierCompo()` créé en Phase 4.4 via `js/supabase-client.js` v1.6.

(p) ✅ **LIVRÉE 13 mai** — Test bout-en-bout Phase 4.3 compensé par les tests E2E de la session RLS write (INSERT+DELETE compositions depuis console portail) PUIS par les tests Phase 4.4 UI (cycle compo bout-en-bout depuis l'interface).

(q) **Multi-coach réel — durcissement Option A** : actuellement RLS write coach autorise un coach à écrire sur n'importe quelle équipe (Option B simplicité, 1 coach prod = Manu). À durcir en Option A via table de jonction `coach_equipes(user_id, equipe_id)` quand un 2e coach réel arrivera. Priorité : déclenchée par usage réel.

### 🔵 Dettes Phase 4.4 UI (issues du doc Conception Drive)

12 dettes ouvertes pour V1.1/V2 selon le doc `Conception-Portail-Phase-4-UI-Compo.md` (Drive `00 - Documentation/`). **Liste à recopier verbatim depuis le doc Drive lors d'une session de tri ultérieure** — résumé non-exhaustif :

- **P4-UI-1** : Drag-and-drop sur slots (V1.1, alternative au clic-clic) — V1 livre clic-clic.
- **P4-UI-2** : Vue Terrain interactive (V2) — V1 livre Vue Terrain read-only seulement (étape 6c-5 à coder).
- **P4-UI-3** : Format 13 / X / 7 (V2) — V1 livre uniquement XV.
- **P4-UI-4** : Multi-équipes (V2) — V1 livre M14 EQ1 uniquement.
- **P4-UI-5** : Vue Réseaux Sociaux (V2) — différée.
- **P4-UI-6** : Saisie présences depuis l'éditeur (V2) — SportEasy reste référence en V1.
- **P4-UI-7** : Aptitudes / postes compatibles dans le Popover Picker (V2) — V1 livre Popover sans filtre compatibilité.
- **P4-UI-8** : Mobile natif (V2) — V1 livre desktop + mobile dégradé.
- **P4-UI-9** : Notifications encadrement (V2).
- **P4-UI-10** : Export compo PDF/image (V2).
- **P4-UI-11** : ✅ Résolue 13 mai via sql/27 — renommage `jouee` → `utilisee` + ajout `archivee`.
- **P4-UI-12** : Indication "Modifié vs base" plus visible (V1.1).

⚠️ **À faire en début de prochaine session** : ouvrir le doc Drive `Conception-Portail-Phase-4-UI-Compo.md` (uploadé par Manu 13 mai) et recopier les 12 dettes verbatim dans ce STATE.md pour avoir la liste fidèle (la liste ci-dessus est reconstituée de mémoire et probablement imprécise sur 1-2 items).

### ✅ Dettes résolues le 15 mai 2026 (Module Préparation de séance)

- **D-SEANCE-STUB-VIDES** ✅ résolue par Phase 5.10. Le bouton "+ Nouvelle séance" crée toujours un stub DB immédiatement (pattern conservé pour rester réactif), mais désormais la sidebar affiche en bas un compteur "🗑 N brouillons vides" + bouton "🧹 Nettoyer" quand au moins 1 brouillon vide existe (`etat='brouillon'` ET `date_seance IS NULL` ET aucun bloc rattaché). Confirm() avec compteur, DELETE en lot via le nouveau wrapper `deleteBrouillonsVides`. Si la séance courante était dans la liste supprimée, retour automatique à l'écran vide.

### 🔵 Dettes Module Préparation de séance (V1 livré, V2 à venir)

- **D-SEANCE-V2-EXPORT-PDF** : Export PDF du cartouche de séance (format A4 selon `MOM-Hub_cartouche-seance.docx` Drive). Chantier conséquent (jsPDF + html2canvas ou Apps Script Drive). Priorité moyenne, à coder une fois que Manu aura validé le format à l'usage.
- **D-SEANCE-V2-MODELES** : Modèles de séance. Schéma DB déjà prêt (`seances.est_modele` BOOLEAN DEFAULT FALSE + `modele_origine_id` UUID NULLABLE — Phase 5.1). Reste à coder l'UI : "Enregistrer comme modèle" + sélecteur "Nouvelle séance depuis modèle". Priorité moyenne.
- **D-SEANCE-V2-DRAG-DROP** : Drag-and-drop pour réordonner les blocs (V1 livre flèches ↑↓ qui suffisent).
- **D-SEANCE-V2-BILAN** : Bilan post-séance (champs Observations/régulations + Axes prochaine séance, cf. cartouche docx). Pas vital en V1.
- **D-SEANCE-V2-METEO** : Météo structurée via API (V1 = texte libre). Liée au champ `lieu_id` ↔ coordonnées GPS site.
- **D-SEANCE-V2-ENCADRANTS** : Encadrants structurés via table `evenement_encadrants` existante quand `evenement_id` renseigné (V1 = texte libre).
- **D-SEANCE-V2-MULTI-EQUIPES** : V1 hardcode `M14_TEAM_UUID`. À débloquer quand 2e équipe sera concernée.
- **D-SEANCE-GROUPES-DEFAUT** 🆕 (15 mai) : Pas d'override "groupes par défaut au niveau séance". V1 livre uniquement granularité **par bloc** avec héritage auto du bloc précédent à la création (arbitrage doctrinal Manu : commencer simple, voir si l'usage le réclame). Si à l'usage Manu re-saisit sans cesse les mêmes groupes au début de chaque séance, ajouter un champ `seances.groupes_default_jsonb` + UI au formulaire méta. Priorité **à observer**.
- **D-BLOC-TYPE-CHANGE-NO-RERENDER** 🆕 (15 mai) : Changer le type d'un bloc en édition (dropdown "Type de bloc") ne refresh pas les étiquettes Axes 2/3 (qui dépendent du type via `etiquettes_proposees` dans `types-blocs.json`). Workaround : sauver puis rouvrir le bloc. Bug d'ergonomie mineur. Priorité faible.
- **D-BIBLIO-V2-MIGRATION** 🔁 (déjà ouverte 14 mai, toujours active) : Pas de FK SQL stricte entre `seances_blocs_ateliers.atelier_fileid_drive` (TEXT 33 chars) et une éventuelle table `ateliers`. La Bibliothèque vit aujourd'hui en Drive + miroir JSON (`data/ateliers.json` + `data/fiches-all.json`). À l'arrivée du module Préparation, on avait prévu de basculer en Scénario 3 (table Supabase `ateliers` miroir, FK stricte). **Note 15 mai** : finalement la bascule n'a PAS été faite, le module Préparation s'est contenté du miroir JSON existant et ça fonctionne très bien. La dette reste ouverte si un jour on veut un vrai contrôle d'intégrité référentielle.
- **D-REORDER-NON-ATOMIQUE** 🔁 (active depuis Phase 5.3) : `reorderBlocs(seance_id, blocIdsInOrder)` JS fait 2 passes UPDATE (ordres négatifs puis positifs) à cause de la contrainte UNIQUE `(seance_id, ordre)`. Si la passe 2 échoue, certains blocs restent avec ordre négatif → état incohérent jusqu'au prochain appel réussi. À terme : RPC SQL transactionnelle.

### 🔵 Dettes Architecture V2 portail (issues de `Conception-Portail-Architecture-V2.md`)

- **D-PORTAIL-V2-REFONTE** 🆕 (15 mai) : Refonte cosmétique d'`index.html` selon le doc `Conception-Portail-Architecture-V2.md` (livré par la conv Conception Portail le 15 mai matin, uploadé par Manu pendant la Phase 5.11). **Décision Manu Phase 5.11** : on a fait la Phase 5.11 minimaliste (juste activer la tuile Préparation de séance + corriger 2 compteurs `sec-meta`) et reporté la refonte v2 complète. **Liste des modifs reportées** :
  - Section 01 / Pédagogie EDR : renommer `Comportements attendus` → `Ressources pédagogiques` (catch-all), renommer `Plan de saison` → `Planification annuelle`.
  - Section 02 / Mon équipe — M14 SAR×MOM : supprimer 3 vignettes obsolètes (`Présences entraînement`, `Convocations`, `Carnet de progression` — toutes redondantes avec SportEasy ou absorbées ailleurs), ajouter 3 vignettes V2 (`Evènements`, `Joueurs`, `Statistiques` toutes en À VENIR), renommer `Compositions` → `Compos`, renommer `Suivi des matchs` → `Suivis de Match`.
  - Section 03 : renommer la **section** `LOGISTIQUE CLUB` → `LOGISTIQUE MOM` (la logistique reste portée par MOM seul, pas par l'entente — précision doctrinale). Refondre les 3 vignettes autour du verbe `Réservation` : `Réservation matériel` → `Réservation infrastructures`, `Réservation bus` → `Réservation Minibus`, `Veo · vidéos` → `Réservation VEO`. Ajouter `Autres réservations` (catch-all).
  - Suppression généralisée des possessifs (`Mon canevas`, `Mes joueurs` → libellés impersonnels) — partiellement fait Phase 5.11 sur la seule tuile activée.
  - 11 dettes ouvertes vers sessions de conception module (P4-V2-1 à P4-V2-11) listées dans le doc — voir doc complet sur Drive `00 - Documentation/`.

  **Stratégie d'exécution** : doctrine "sujets séparés par conv" → ouvrir une mini-conv "Production Portail v2" dédiée plutôt que mélanger avec d'autres chantiers métier. Priorité **basse** (cosmétique, pas bloquant).

### ✅ Dette C9 SOLDÉE 15 mai 2026 (Conv Joueurs/Évènements S1)

- **C9-a** ✅ RPC `get_evenements_passes(equipe_id, jours, limit)` créée (sql/29).
- **C9-b** ✅ RPC `get_evenement_with_encadrants(evenement_id)` créée (sql/29).
- **C9-c** ✅ Wrappers JS `getEvenementsPasses` + `getEvenementWithEncadrants` ajoutés (js/supabase-client.js v1.9).
- **C9-d** ✅ Arbitrage pastille statut compo : calcul côté serveur dans les 3 RPC événements, V1 simple sans récursion serveur parent→enfants (agrégat côté client UI à l'affichage).
- **C9-e** 🔵 reportée V2 : transition automatique `creation → compo` à l'apparition d'une compo. Doctrine V1 = manuel (P3 itération). À reconsidérer après 1 saison d'usage.

### 🔵 Dettes Conv Joueurs/Évènements — UI Évènements (issues du doc Drive `Conception-Portail-UI-Evenements.md` §8)

8 dettes ouvertes pour V1.1 / V2 / Phase 4.5 :

- **P4-UI-evenements-1** : Vue Calendrier mensuelle grille (toggle vue Liste / Grille style Google Calendar). V1 livre liste verticale uniquement avec mini-calendrier sidebar comme navigateur. — V2 si demande.
- **P4-UI-evenements-2** : Duplication arborescente d'un tournoi (parent + matchs internes en récursif). V1 ne duplique que le parent. — V2 si demande sur tournois récurrents annuels.
- **P4-UI-evenements-3** : Filtre par date / période avancée (« Cette semaine / Ce mois / Période personnalisée »). V1 = scroll + mini-calendrier. — V2 si saison chargée.
- **P4-UI-evenements-4** : Affichage de la distance Brencklé → site (via API OpenRouteService, lié à dettes M-2 et M-5). — Phase 4.5.
- **P4-UI-evenements-5** : Transition automatique `creation → compo` (alias C9-e). — V2.
- **P4-UI-evenements-6** : Vue consolidée multi-équipes pour Resp. pôle (sélecteur d'équipe en tête). Préalable : dette `(q) coach_equipes`. — Quand 2e coach onboardé.
- **P4-UI-evenements-7** : Notification automatique aux encadrants à la création/annulation d'événement (email tiers type SendGrid/Resend). — V2 si décision communication asynchrone supplémentaire à SportEasy.
- **P4-V2-evenements-1** : Export iCal pour Google Agenda EDR (flux `.ics` souscrit dans Google Calendar par les coachs). — Dette priorisable, hors V1, ~3-4h Production.

### 🔵 Dettes Conv Joueurs/Évènements — UI Joueurs (issues du doc Drive `Conception-Portail-UI-Joueurs.md` §8)

12 dettes ouvertes pour V1.1 / V2+ :

- **P4-UI-joueurs-1** : Mode tableau (toggle vue Grille / Tableau dense). V1 livre grille de cartes seule. — V2 si demande admin pour scan « qui n'a pas de photo, pas de poste ».
- **P4-UI-joueurs-2** : Filtre par conformité FFR (chips `OK / Expire <30j / Non conforme / Non vérifiable`). V1 = pastilles visibles sur cartes. — V2 si demande saisonnière.
- **P4-UI-joueurs-3** : Filtre par postes (multi-sélection 10+ valeurs XV, probablement dropdown). V1 = postes visibles en chips sur cartes. — V2.
- **P4-UI-joueurs-4** : Vue Comparaison de fiches (2-3 joueurs côte à côte pour aider sélection compo). — V2+.
- **P4-UI-joueurs-5** : Édition aptitudes inline alternative à la modale (chips toggleable au survol). V1 = modale dédiée. — V2 si demande gain de temps sur édition en lot.
- **P4-UI-joueurs-6** : Workflow consentement photo automatisé (envoi email parent avec lien validation, type DocuSign light). V1 = workflow manuel. — V2.
- **P4-UI-joueurs-7** : Pose photo par joueur / parent eux-mêmes (interface dédiée depuis SportEasy ou espace Hub). V1 = seul coach/admin peut uploader. — V2+.
- **P4-UI-joueurs-8** : Indicateurs fidélisation sur cartes (mode opt-in via préférences utilisateur). V1 = indicateurs dans la fiche détaillée seulement. — V2.
- **P4-UI-joueurs-9** : Conformité FFR avec workflow validation (édition passeports JDD/ASR + certif médical + validation admin ou OVAL-E sync). V1 = réservé admin via RPC. — V2+.
- **P4-UI-joueurs-10** : Vue multi-équipes pour Resp. pôle (sélecteur d'équipe en tête). Préalable : dette `(q) coach_equipes`. — Quand 2e coach onboardé.
- **P4-UI-joueurs-frontiere-1** : Activation du lien « Voir dans l'Annuaire » en pied de fiche. V1 = mention discrète sans lien actif. — Quand Annuaire ouvert.
- **P4-UI-joueurs-frontiere-2** : Activation du bouton « + Ajouter une personne » vers Annuaire (création identité). V1 = modale informative « Annuaire à venir ». — Quand Annuaire ouvert.

### 🔴 Dettes Conv Joueurs/Évènements — Backend Joueurs C10 (issues du doc Drive `Audit-Module-Joueurs-v1.md` §8)

10 dettes préalables à S4 UI Joueurs. Effort total ~3h30-4h30. **Bloquant** pour S4 :

- **C10-a** : ALTER `personnes` ADD 3 colonnes photo (`photo_storage_key TEXT NULL`, `photo_uploaded_at TIMESTAMPTZ NULL`, `photo_uploaded_by UUID NULL REFERENCES personnes(id)`). ~10 min.
- **C10-b** : Création bucket Supabase Storage `photos-joueurs/` + RLS adaptées (SELECT autorisé seulement via URL signée, INSERT/UPDATE/DELETE réservé aux coachs/admins via RPC). ~30 min.
- **C10-c** : RPC `upload_photo_joueur(personne_id, fichier_base64, extension)` SECURITY DEFINER. Vérifie droits + consentement + validation extension/taille, génère clé Storage, met à jour les 3 colonnes photo. ~30 min.
- **C10-d** : RPC `get_photo_url_signed(personne_id)` SECURITY DEFINER. Vérifie droits + existence + consentement, génère URL signée Storage (TTL ~1h). ~20 min.
- **C10-e** : ALTER `personnes` (ou `bloc_7`) pour `consentement_photo` JSONB structuré (`{valide, date_consentement, saisi_par, portee}`). ~10 min.
- **C10-f** : RPC `get_joueurs_equipe(equipe_id)` filtrée par rôle, retournant ~75 fiches M14 avec champs autorisés selon profil joueur × rôle utilisateur. ~30 min.
- **C10-g** : RPC `get_joueur_detail(personne_id)` retournant la fiche complète avec tous les blocs autorisés selon rôle. ~30 min.
- **C10-h** : ALTER `personnes` ADD 3 colonnes métier (`indisponibilite JSONB NULL` avec sous-champs `du/au/motif`, `blessure_resume JSONB NULL` avec `description/date_debut/date_estimation_retour`, `suspension_jusqu_au DATE NULL`). ~15 min.
- **C10-i** : RPC `get_joueur_historique_compo_presences(personne_id, saison_id)` retournant compteurs de fidélisation (matchs alignés, entraînements présents, capitanats). ~30 min.
- **C10-j** : RPC `update_joueur_metier(personne_id, ...)` restreinte aux champs métier (postes, aptitudes, indispo, blessure, suspension, notes coach). Vérifie le droit d'édition selon rôle × équipe. ~30 min.

### 🔵 Doctrine structurante actée pour S4 UI Joueurs

**Composant fiche Personne à 2 modes** : sera codé comme fichier dédié `js/fiche-personne.js` (module IIFE autonome avec API publique `render(container, {personneId, mode, onSave})`). 2 modes :
- `mode=metier` (S4 Joueurs) : édition restreinte aux champs métier (postes, aptitudes, indispo, blessure, suspension, notes coach, photo).
- `mode=identite` (Annuaire futur) : édition étendue (identité, coordonnées, famille, licence FFR) selon rôle.

Conséquence : aucune réécriture lors de l'ouverture de la conv Annuaire — le même composant sera invoqué en `mode=identite` sans rupture (gain économique structurant validé doctrine kickoff).

---

## 📂 Structure repo finale

```
mom-hub/
├── .github/workflows/keep-alive-supabase.yml
├── assets/
│   └── logo-m2m.png
├── css/
│   └── hub.css                                # v1.1 — ajout --bleu-base + --rouge-blesse
├── data/                                      # miroir lecture seule des référentiels Drive
│   ├── aptitudes.json
│   ├── ateliers.json                          # 14 mai — taxonomie Bibliothèque (4 rubriques, 82 ateliers)
│   ├── conformite-ffr.json
│   ├── fiches-all.json                        # 14 mai — bundle détaillé 62 fiches PPTX (servi 2 modules : Bibliothèque + picker ateliers Phase 5.8)
│   ├── groupes-joueur.json                    # 15 mai — référentiel 3 groupes G1/G2/G3 Phase 5.9 (miroir Drive 01-Référentiels/)
│   ├── observables-match.json
│   ├── postes.json
│   ├── tests-physiques.json
│   ├── types-blocs.json                       # 14 mai — référentiel 11 types de blocs Phase 5.2
│   └── vocabulaire-seance.json                # 14 mai — référentiel 4 axes FFR Phase 5.2
├── js/
│   ├── data-loader.js
│   ├── supabase-client.js                     # v1.8.4 — Phase 5.10 (16 wrappers Préparation : 13 Phase 5.3 + listBlocsBySeance + listAteliersRattachesAuBloc + listBrouillonsVides + deleteBrouillonsVides)
│   ├── dashboard-stats.js                     # v2.3 — greeting J-N + 8 sources dynamiques
│   ├── compositions-editor.js                 # v3.4 — Vue Liste éditable + Popover Picker (6c-2 + 6c-3)
│   ├── bibliotheque-browser.js                # 14 mai — module IIFE Bibliothèque d'ateliers
│   └── seance-editor.js                       # 15 mai — v1.8 Phase 5.10 (Préparation de séance complet, ~2988 lignes)
├── sql/
│   ├── 01-creation-tables-vague1.sql
│   ├── 02-migration-referentiels-vague1.sql
│   ├── 04-auth-roles.sql
│   ├── 06-peuplement-vague1-equipes.sql
│   ├── 07-sites.sql
│   ├── 08-extend-type-personne-check.sql
│   ├── 09-rpc-equipes.sql
│   ├── 10-noyau-evenements.sql
│   ├── 11-rpc-evenements.sql
│   ├── 12-evenements-saison-2025-2026.sql
│   ├── 13-rls-read-vague1.sql
│   ├── 14-entrainements-m14-fin-saison-2025-2026.sql
│   ├── 15-alter-type-personne-c7c.sql
│   ├── 16-peuplement-partenaires-entente-m14-v1.sql
│   ├── 17-attaches-partenaires-entente-m14.sql
│   ├── 17b-fix-categorie-partenaires.sql
│   ├── 18-compositions.sql
│   ├── 19-presences.sql
│   ├── 21-rpc-vivier-compo.sql
│   ├── 22-alter-compositions-c8.sql
│   ├── 23-alter-composition-joueurs-c8.sql
│   ├── 24-rls-write-vague1.sql
│   ├── 25-rls-write-evenements.sql
│   ├── 26-rls-write-compositions-presences.sql
│   ├── 27-alter-compositions-etat-c8d.sql
│   └── 28-seances.sql                         # 14 mai — Phase 5.1 (3 tables + 2 RPC + RLS write Préparation de séance)
│   # NB: sql/20 sauté (M-1 ALTER personnes bloc_5, dette ouverte)
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit (données perso)
├── index.html                                 # 15 mai — Phase 5.11 (3 tuiles activées : Compositions + Bibliothèque + Préparation de séance ; libellé renommé `Constructeur de séance` → `Préparation de séance`)
├── login.html
├── dashboard.html
├── compositions.html                          # 13 mai — éditeur de compositions Phase 4.4
├── bibliotheque.html                          # 14 mai — Bibliothèque d'ateliers EDR
├── seance.html                                # 15 mai — Préparation de séance Phase 5.10 (~1815 lignes)
├── test-supabase.html
├── README.md
├── STATE.md                                   # ← CE FICHIER
└── PASSATION.md
```

---

## 🔐 Secrets & accès

- Secrets GitHub Actions : `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Clé `service_role` Supabase : **stockée par Manu en local, jamais commit**
- Mot de passe DB Supabase : **stocké par Manu en local**
- (à venir) Clé API OpenRouteService (cf. dette M-2) : **secret GitHub Actions / Supabase, jamais commit**

---

## 📚 Documents Drive de référence

Dossier `MOM Hub/2025-2026/` :

| Document | id Drive | Rôle |
|---|---|---|
| `Doctrine-MOM-Hub-v2.md` | `1Ebx20ANb80hU0giLSfVAl8n5OSZFwJZW` | Doctrine fondatrice |
| `Phase-2-0-decisions-architecture.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Décisions Phase 2.0 |
| `MOM-Core-Synthese-globale-v2.md` | `1X0FjB6Z9eVlxH0VcEQ4le2wf8eCMmmly` | Synthèse globale modèle |
| `MOM-Core-Cartographie-Globale-v2.md` | `1N2I86T751XneQT9fx1wCQWusmeCz235T` | Cartographie complète |
| `Doctrine-Import-OVAL-E-v1.4.md` | `1Va9h9lQVIXHmPfTRK0s5ZuoQoGAy3dwQ` | **Doctrine import licences FFR v1.4** — canonique |
| `Audit-OVAL-E-Joueurs-Partenaires-v1.md` | `12_akokLYOUpyk-_CKIkW5H8WzvleEqiO` | Audit C7 |
| `Conception-Portail-Phase-3.md` | `12xrICwk5NTzk1XZLpq964CkWwhft3zc2` | Conception portail Phase 3 |
| `Conception-Portail-Phase-4-UI-Compo.md` | uploadé par Manu 13 mai (Drive `00 - Documentation/`) | **Conception UI éditeur compo** — référence canonique pour Phase 4.4 6c-* |
| `Conception-Portail-Architecture-V2.md` | uploadé par Manu 15 mai (Drive `00 - Documentation/`) | **Architecture v2 du portail** — actualisation de la Phase 3 ; définit les 5 sections + 13 vignettes V2 (libellés actés). Phase 5.11 a appliqué un sous-ensemble minimaliste ; refonte complète reportée — dette D-PORTAIL-V2-REFONTE. |
| `Brief-Conception-Module-Preparation-Seance-v1.md` | `132DT2Ps0usznZ4LXH2ohz_ubFUygpm-T` (Drive `00 - Documentation/`) | **Brief de conception module Préparation de séance** — exploité pour Phases 5.1 → 5.11. Modèle de référence pour les futurs briefs modules. |
| `Modelisation-Evenements-v1.1.md` | `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u` | **Modélisation événements v1.1** — référence canonique |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit Compos v2 historique |
| `Audit-Module-Compositions-v3.md` | `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ` | **Audit Compos v3** — révision post-Phase 4.3 |
| `Audit-Module-Joueurs-v1.md` | `1t9sQPXMt1jqujWk_tcMS9vtTCv2_zMaq` | **Audit Joueurs v1** — 15 mai matin, prêt pour conv Production Joueurs/Événements |
| `Audit-Module-Evenements-v1.md` | `1G7UEEFMYwQi9H7PNhm_RXWgEA64dj5Vr` | **Audit Évènements v1** — 15 mai matin, prêt pour conv Production Joueurs/Événements |
| `Audit-Personnes-MOM-Hub-v1.2.md` | `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA` | **Audit Personnes v1.2** — 5 profils |
| `Registre-anomalies-OVAL-E.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Registre anomalies réconciliation FFR |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h`
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE`
- `01 - Référentiels/ateliers/` : `113VOQterlhlKpl3nxLNHd20F2BINAdeg` (créé 13 mai par conv Modules Ateliers)

---

## 🚀 Prochaine session

**Avant de démarrer toute nouvelle phase** :

1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Vérifier que la chaîne Hub → Supabase fonctionne (console portail → `✅ MOM Hub Dashboard v2.3` ET `🏉 MOM Hub · Supabase Client v1.9 chargé`)
4. Vérifier le greeting J-N et le widget "Prochain événement M14" en sidebar
5. Vérifier les 3 tuiles dashboard actives (Compositions, Bibliothèque, **Préparation de séance**)
6. Vérifier `compositions.html` : créer une compo de base test, ajouter 2-3 joueurs, supprimer
7. Vérifier `seance.html` : créer une séance, ajouter un bloc, rattacher un atelier de la Bibliothèque, créer un groupe G1 avec 2-3 joueurs, archiver — puis nettoyer les brouillons vides résiduels
8. Vérifier que `login.html` envoie bien un Magic Link aboutissant sur `dashboard.html`

**Travaux en attente — Conv Production générale (cette conv)** :

- **Phase 4.4 UI 6c-4 à 6c-7** (toujours en attente, non bloquant) :
  - 6c-4 : autosave notes_compo 30s + 4 boutons d'action (valider / repasser-brouillon / marquer utilisée / archiver) câblés aux wrappers existants
  - 6c-5 : Vue Terrain (visualisation read-only XV) — positions hardcodées ou via postes.json
  - 6c-6 : Modale Création E2 (radio base/match + sélecteur compo source pour dupliquer)
  - 6c-7 : Modale Historique E6 (versions précédentes lecture seule)

- **Vague 3 tests Bibliothèque** (cas dégradé + responsive + performance) à faire à tête reposée — non bloquant.

- **Recopier dans STATE.md les 12 dettes P4-UI-* verbatim** depuis le doc Drive Conception (la liste actuelle est de mémoire, à recaler).

- **Dette (q)** : table de jonction `coach_equipes` quand un 2e coach réel arrivera.

- **D-PORTAIL-V2-REFONTE** : refonte cosmétique d'`index.html` selon `Conception-Portail-Architecture-V2.md`. Doctrine sujets séparés → ouvrir mini-conv "Production Portail v2" dédiée plutôt que de mélanger.

**Travaux en attente — Conv Production Module Préparation de séance** (cette conv, livraison V1 close 15 mai) :
- ✅ **Module V1 complet** — Phases 5.1 → 5.11 livrées. Plus rien à faire sur la V1.
- V2 envisagée si l'usage le réclame : Export PDF cartouche, Modèles de séance, Drag-and-drop blocs, Bilan post-séance, Météo structurée, Encadrants structurés, Multi-équipes (cf. dettes Phase 5 listées plus haut).

**Travaux en attente — Conv "Production Module Bibliothèque"** (ouverte 14 mai 2026) :
- ✅ **Module Préparation de séance arrivé** sans avoir besoin de la table Supabase `ateliers` miroir. Le scénario 2 (Drive + JSON) tient bien la route. La bascule en Scénario 3 reste optionnelle (dette D-BIBLIO-V2-MIGRATION).
- Coordonner avec la conv **Converter PPTX** le passage en v3.3 (schéma `fiche.json` aligné v2.0).
- Coordonner avec la conv **Modules Ateliers** (cadrage doctrinal) si évolutions du schéma `atelier.json` v2.0.

**Travaux en attente — Conv Audits** :
- ✅ **Audits Joueurs + Événements livrés 15 mai matin** : `Audit-Module-Joueurs-v1.md` (73 KB, fileId `1t9sQPXMt1jqujWk_tcMS9vtTCv2_zMaq`) et `Audit-Module-Evenements-v1.md` (56 KB, fileId `1G7UEEFMYwQi9H7PNhm_RXWgEA64dj5Vr`). Disponibles sur Drive `00 - Documentation/`. À enchaîner par une conv Production dédiée (kickoff prêt — voir ci-dessous).
- **Reprise audit Suivi-Match** (recommandation forte) à la lumière de Phase 4.3 + dette C3.
- Audits Rapport, Stats, Bilans à reprendre post-Phase 4.3.
- Lots 2-3 de l'audit référentiels (bloqués par tiers).
- Modélisation événements extra-sportifs (C2).
- Modélisation compo adverse + joueurs adverses (C1, reportée après usage réel).

**Travaux en attente — Conv Conception Portail** :
- `Conception-Portail-Phase-3.md` v1.0 livrée.
- `Conception-Portail-Phase-4-UI-Compo.md` livré le 13 mai et exploité Phase 4.4 6a→6c-3.
- ✅ **`Conception-Portail-Architecture-V2.md`** livré 15 mai par la conv Conception. Définit les évolutions cosmétiques de l'`index.html` (5 sections, 13 vignettes actées, renommage section LOGISTIQUE MOM, suppression de 3 vignettes obsolètes, ajout de 3 nouvelles vignettes V2). Phase 5.11 a appliqué un sous-ensemble minimaliste (juste activation tuile Préparation + 2 compteurs corrigés). Refonte v2 complète reportée — dette D-PORTAIL-V2-REFONTE.
- Pour 6c-4 à 6c-7, possible nouvelle itération si besoin d'arbitrage UX (autosave, modale Historique).
- Sessions à venir : Conception UX module Joueurs + module Événements post-audits (dettes P4-V2-3 et P4-V2-4 du doc Architecture V2).

**Travaux en attente — Conv Modules Ateliers** :
- Cadrage doctrinal v1.0 du schéma `atelier.json` figé. Évolutions à venir uniquement si arbitrages nouveaux.
- Voir `Schema-atelier-json-v2.0.md` (Drive `00 - Documentation/`) — schéma v2.0 figé le 14 mai par la conv Production Module Bibliothèque.

**Travaux en attente — Conv Production Modules Joueurs & Évènements** (OUVERTE 15 mai après-midi, S1 LIVRÉE) :
- ✅ **Conv ouverte** 15 mai après-midi après kickoff matin. Audits + 2 docs Conception UI lus en début de session.
- ✅ **S1 backend Évènements livrée** (~1h) : sql/29 + js v1.9, dettes C9-a/b/c/d closes. Cf. section Phase 4.4 backend Évènements + Bilan 15 mai après-midi plus haut.
- 🔵 **S2 UI Évènements** (~2-3h, à venir) : 5 écrans E1-E5 selon doc Conception UI Évènements. E1 Vue Liste (liste verticale + mini-calendrier + 3 filtres), E2 Fiche détaillée (modes lecture/édition), E3 Modale Création (workflow 3 étapes), E4 Modale Annulation, E5 Modale Ajout match aux entraînements.
- 🔴 **S3 Backend Joueurs C10** (~3h30-4h30, à venir) : 10 dettes `C10-a → C10-j` à solder avant S4. Détail dans la section dettes plus haut. **Bloquant** pour S4.
- 🔵 **S4 UI Joueurs** (~3-4h, à venir) : 6 écrans J1-J6 selon doc Conception UI Joueurs. J1 Vue Grille + filtres, J2 Fiche détaillée mode metier (composant `js/fiche-personne.js`), J3 Workflow consentement photo, J4 Édition aptitudes, J5 Édition indispo/blessure/suspension, J6 Historique fidélisation.
- 📓 Doctrine structurante actée : composant `js/fiche-personne.js` à 2 modes (mode=metier S4 / mode=identite Annuaire futur). Cf. section "Doctrine structurante actée pour S4 UI Joueurs" plus haut.
- Pré-requis avant S3 : 10 entraînements M14 déjà en base via sql/14, 1 événement archivé `EVT-2026-05-02-FRANKFURT-M14` (tournoi Frankfurt) utilisable pour tests fiche détaillée mode lecture archive.

**Travaux en attente — Conv Suivi Match** (à ouvrir, recommandation forte) :
- Module à construire, audit v2 existant, dette C3 à instruire. Pré-requis C8-c livré ✅.

---

## 📓 Leçons doctrinales accumulées 13-15 mai (dette j renforcée + conventions activation + GitHub status + count null)

Le 13 mai a été particulièrement riche en bugs causés par des inventions de détails non vérifiés. **Mitigation systématique pour les sessions futures** :

1. **Avant de coder qui touche aux colonnes Supabase** : lire un objet réel depuis console JS (`Object.keys(obj)` ou `JSON.stringify(obj)`) pour confirmer les noms de colonnes exacts. Ne JAMAIS supposer que la structure JSON Drive d'un référentiel = structure SQL Supabase (ex : `postes.json` utilise `uuid`/`numero_maillot_default`, table `postes` utilise `id`/`numero_xv`).

2. **Avant d'utiliser une constante slug type `'cat-m14'`** : vérifier la valeur réelle en base. Les catégories utilisent des UUIDs en base, pas des slugs.

3. **Avant de supposer qu'une jointure Supabase ramène un objet enrichi** : tester d'abord. Si la table jointe a une RLS stricte (`personnes` doctrine RGPD), la jointure retourne `null` même côté `authenticated`. Workaround : passer par une RPC `SECURITY DEFINER` ou par un lookup côté JS dans un cache déjà chargé.

4. **Avant d'écrire un SQL avec des colonnes nommées (ex : `WHERE equipe_id = ...`)** : si pas 100% sûr du nom, demander à l'utilisateur de coller un `Object.keys()` côté JS du wrapper qui lit cette table. C'est 30 secondes côté lui et zéro tâtonnement côté Claude.

5. **Pour les fichiers > 30k caractères livrés via `create_file`** : préférer construction par blocs successifs via `bash heredoc` (échec connu de `create_file` avec contenus très longs : "Field required").

6. **Pour les commits côté Manu** : toujours vérifier que le commit est bien poussé sur GitHub avant de soupçonner un bug. Lancer dans la console : `fetch('js/<fichier>.js').then(r => r.text()).then(t => console.log(t.match(/Version : ([\d.]+)/)?.[1]))` pour vérifier la version réellement servie par GitHub Pages.

7. **Classes CSS non préfixées dans une page module dédiée** (leçon 14 mai sur Bibliothèque) : pas un risque réel tant que (a) les classes sont définies dans un `<style>` inline (scopage au document), (b) elles ne sont **pas** définies dans `hub.css` partagé, (c) elles ne sont pas utilisées par d'autres pages. La note d'intégration affirmait "toutes les classes préfixées `.biblio-*`" alors qu'en réalité ~40% restaient non préfixées (`.pastille`, `.tag`, `.age-chip`, `.m-*`, `.plan-*`). Vérifié OK car aucune collision avec `hub.css` ni `index.html`. **Mais** : si plus tard d'autres modules à pages dédiées sont ajoutés (ex : `seance.html`), revérifier que ces noms restent libres. **Note 15 mai** : `seance.html` ajouté, classes `.seance-*` préfixées strictement, aucune collision constatée.

8. **Convention d'activation des tuiles dashboard** posée 14 mai (première utilisation, à reprendre systématiquement) : `class="tool todo"` + statut "todo À venir" → `class="tool" onclick="location.href='X.html'" role="link" tabindex="0" title="..."` + statut "on Disponible". Le CSS `hub.css` a déjà la définition `.tool-status.on` (vert-prairie) — rien à modifier. Choix `onclick` plutôt que wrap `<a>` pour éviter problèmes de styling (text-decoration, color) sur les éléments enfants. **Réutilisée Phase 5.11 sans accroc.**

9. **Commits séparés pour un module multi-fichiers** (leçon 14 mai sur intégration Bibliothèque) : un commit par fichier en remontant la pile de dépendances (data → js → html → index modifié). À chaque commit intermédiaire, l'état du repo reste cohérent : aucun fichier n'utilise un autre fichier pas encore committé. Pratique pour la traçabilité, le diff lisible, et les rollbacks si besoin.

10. **Avant tout diagnostic prolongé sur un déploiement GitHub Pages qui traîne** (leçon 15 mai sur incident Phase 5.10) : **réflexe → vérifier https://www.githubstatus.com/ AVANT de chercher midi à 14h**. Les workflows en `Queued` depuis plus de 2-3 minutes sans raison évidente sont symptomatiques d'un incident Actions/Pages global. ~20 min perdues le 15 mai à chercher un bug côté code qui n'existait pas. Bannière `Actions is experiencing degraded availability` quand on l'a enfin consultée.

11. **Avant d'écrire `if (count === 0)` après un `select(..., { count: 'exact', head: true })`** (leçon 15 mai sur wrapper `listBrouillonsVides`) : PostgREST peut renvoyer `count: null` (pas 0) si la RLS bloque la query ou si la requête échoue silencieusement. Toujours tester `count === 0 || count === null || count === undefined` quand on veut détecter "aucune ligne". Sinon le filtre rate certains cas et les éléments à filtrer disparaissent en silence.

12. **Anti-invention sur les paramètres d'options des wrappers** (leçon 15 mai, sécurité méthodologique) : avant de chercher à coder un nouveau wrapper Supabase, **toujours grep l'existant** pour vérifier si l'option n'est pas déjà supportée. Exemple Phase 5.10 : `listSeancesByEquipe(equipeId, options)` acceptait déjà `opts.excludeArchivees` (default `true`), donc l'option D du toggle archivées s'est intégrée en 1 ligne de plus dans `loadSeances()`. Une `grep -n "async listSeancesByEquipe" supabase-client.js` avant de poser la question UX permet d'éviter de poser des contraintes fausses à Manu.

13. **Verrouillage doctrinal avant Production** (leçon 15 mai sur Phases 5.9/5.10) : Manu valorise les questions structurées en boutons `ask_user_input_v0` plutôt que les questions ouvertes — mais **certaines questions doctrinales structurantes méritent une discussion préalable**, pas un picker à boutons. Cas Phase 5.9 : la granularité des groupes (séance vs bloc vs mixte) était un arbitrage structurant qui méritait un échange avec présentation des conséquences UX/DB de chaque option, suivi seulement après de la confirmation par picker. Pattern à reproduire : (a) présenter les options en prose avec leurs implications, (b) recommander, (c) confirmer via picker court.

14. **Verrouillage avant Phase d'activation** (leçon 15 mai sur Phase 5.11) : Manu a uploadé `Conception-Portail-Architecture-V2.md` juste avant que je commence la 5.11. Bon réflexe — un doc de Conception fraîchement livré change le périmètre d'une Phase d'activation. À reproduire pour toute Phase d'activation : demander à Manu s'il y a des docs récents qui pourraient affecter le périmètre, plutôt que d'enchaîner mécaniquement.

---

*Fin du STATE.md. Document maintenu à jour à chaque session significative. Pour reprendre le travail : lire ce fichier en premier.*
