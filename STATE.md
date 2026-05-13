# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 13 mai 2026 fin de journée — Journée massive Production : Phase 4.3 + dette C8 a/b/c/d/e + P4-2 (greeting J-N) + session RLS write par rôle + Phase 4.4 UI compos étapes 6a/6b/6c-1/6c-2/6c-3 toutes livrées et fonctionnelles en prod.**

**Bilan chiffré du 13 mai 2026** :
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
│   ├── ateliers.json
│   ├── conformite-ffr.json
│   ├── observables-match.json
│   ├── postes.json
│   ├── tests-physiques.json
│   └── (groupes-joueur.json à mirroir post upload Drive)
├── js/
│   ├── data-loader.js
│   ├── supabase-client.js                     # v1.7.1 — 13 wrappers Phase 4.4 + fix maybeSingle
│   ├── dashboard-stats.js                     # v2.3 — greeting J-N + 8 sources dynamiques
│   └── compositions-editor.js                 # v3.4 — Vue Liste éditable + Popover Picker (6c-2 + 6c-3)
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
│   └── 27-alter-compositions-etat-c8d.sql
│   # NB: sql/20 sauté (M-1 ALTER personnes bloc_5, dette ouverte)
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit (données perso)
├── index.html
├── login.html
├── dashboard.html
├── compositions.html                          # NOUVEAU 13 mai — éditeur de compositions Phase 4.4
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
| `Modelisation-Evenements-v1.1.md` | `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u` | **Modélisation événements v1.1** — référence canonique |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit Compos v2 historique |
| `Audit-Module-Compositions-v3.md` | `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ` | **Audit Compos v3** — révision post-Phase 4.3 |
| `Audit-Personnes-MOM-Hub-v1.2.md` | `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA` | **Audit Personnes v1.2** — 5 profils |
| `Registre-anomalies-OVAL-E.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Registre anomalies réconciliation FFR |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h`
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE`
- `01 - Référentiels/ateliers/` : `113VOQterlhlKpl3nxLNHd20F2BINAdeg` (créé 13 mai par conv Modules Ateliers)

---

## 🚀 Prochaine session

**Avant de démarrer toute Phase 4.4 (suite)** :

1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Lire `Conception-Portail-Phase-4-UI-Compo.md` (Drive) pour les 12 dettes P4-UI-* verbatim
4. Vérifier que la chaîne Hub → Supabase fonctionne (console portail → `✅ MOM Hub Dashboard v2.3` ET `🏉 MOM Hub · Supabase Client v1.7.1 chargé`)
5. Vérifier le greeting J-N et le widget "Prochain événement M14" en sidebar
6. Vérifier `compositions.html` : créer une compo de base test, ajouter 2-3 joueurs, vérifier l'affichage, supprimer la compo de test
7. Vérifier que `login.html` envoie bien un Magic Link aboutissant sur `dashboard.html`

**Travaux en attente — Conv Production** :

- **Phase 4.4 UI 6c-4 à 6c-7** (suite directe) :
  - 6c-4 : autosave notes_compo 30s + 4 boutons d'action (valider / repasser-brouillon / marquer utilisée / archiver) câblés aux wrappers existants
  - 6c-5 : Vue Terrain (visualisation read-only XV) — positions hardcodées ou via postes.json
  - 6c-6 : Modale Création E2 (radio base/match + sélecteur compo source pour dupliquer)
  - 6c-7 : Modale Historique E6 (versions précédentes lecture seule)

- **Recopier dans STATE.md les 12 dettes P4-UI-* verbatim** depuis le doc Drive Conception (la liste actuelle est de mémoire, à recaler).

- **Dette (q)** : table de jonction `coach_equipes` quand un 2e coach réel arrivera.

- **Greeting J-N** : ✅ livré, optionnellement à enrichir avec multi-équipes en V2.

**Travaux en attente — Conv Audits** :
- **Reprise audit Suivi-Match** (recommandation forte) à la lumière de Phase 4.3 + dette C3.
- Audits Rapport, Stats, Bilans à reprendre post-Phase 4.3.
- Lots 2-3 de l'audit référentiels (bloqués par tiers).
- Modélisation événements extra-sportifs (C2, Phase 5).
- Modélisation compo adverse + joueurs adverses (C1, reportée après usage réel).

**Travaux en attente — Conv Conception Portail** :
- `Conception-Portail-Phase-3.md` v1.0 livrée.
- `Conception-Portail-Phase-4-UI-Compo.md` livré le 13 mai et exploité Phase 4.4 6a→6c-3.
- Pour 6c-4 à 6c-7, possible nouvelle itération si besoin d'arbitrage UX (autosave, modale Historique).

**Travaux en attente — Conv Modules Ateliers** :
- Migration physique 62 PPTX vers structure plate par UUID
- Extraction médias embarqués
- Génération index ateliers.json
- Voir `PASSATION-Ateliers-vers-Production-v1.md` (Drive `00 - Documentation/`)

**Travaux en attente — Conv Suivi Match** (à ouvrir, recommandation forte) :
- Module à construire, audit v2 existant, dette C3 à instruire. Pré-requis C8-c livré ✅.

---

## 📓 Leçons doctrinales accumulées 13 mai (dette j renforcée)

Le 13 mai a été particulièrement riche en bugs causés par des inventions de détails non vérifiés. **Mitigation systématique pour les sessions futures** :

1. **Avant de coder qui touche aux colonnes Supabase** : lire un objet réel depuis console JS (`Object.keys(obj)` ou `JSON.stringify(obj)`) pour confirmer les noms de colonnes exacts. Ne JAMAIS supposer que la structure JSON Drive d'un référentiel = structure SQL Supabase (ex : `postes.json` utilise `uuid`/`numero_maillot_default`, table `postes` utilise `id`/`numero_xv`).

2. **Avant d'utiliser une constante slug type `'cat-m14'`** : vérifier la valeur réelle en base. Les catégories utilisent des UUIDs en base, pas des slugs.

3. **Avant de supposer qu'une jointure Supabase ramène un objet enrichi** : tester d'abord. Si la table jointe a une RLS stricte (`personnes` doctrine RGPD), la jointure retourne `null` même côté `authenticated`. Workaround : passer par une RPC `SECURITY DEFINER` ou par un lookup côté JS dans un cache déjà chargé.

4. **Avant d'écrire un SQL avec des colonnes nommées (ex : `WHERE equipe_id = ...`)** : si pas 100% sûr du nom, demander à l'utilisateur de coller un `Object.keys()` côté JS du wrapper qui lit cette table. C'est 30 secondes côté lui et zéro tâtonnement côté Claude.

5. **Pour les fichiers > 30k caractères livrés via `create_file`** : préférer construction par blocs successifs via `bash heredoc` (échec connu de `create_file` avec contenus très longs : "Field required").

6. **Pour les commits côté Manu** : toujours vérifier que le commit est bien poussé sur GitHub avant de soupçonner un bug. Lancer dans la console : `fetch('js/<fichier>.js').then(r => r.text()).then(t => console.log(t.match(/Version : ([\d.]+)/)?.[1]))` pour vérifier la version réellement servie par GitHub Pages.

---

*Fin du STATE.md. Document maintenu à jour à chaque session significative. Pour reprendre le travail : lire ce fichier en premier.*
