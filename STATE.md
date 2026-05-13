# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 13 mai 2026 fin d'après-midi — Énorme journée Production : Phase 4.3 (compositions/présences/RPC vivier) + dette C8-a/b/c + P4-2 (greeting J-N) + session RLS write par rôle (dettes i, l, C7-d, C8-e) TERMINÉES.**

**11 fichiers SQL livrés ce 13 mai** : sql/17 (39 attaches partenaires), sql/17b (fix categorie_id partenaires), sql/18 (compositions + composition_joueurs), sql/19 (presences), sql/21 (RPC get_vivier_compo), sql/22 (ALTER compositions ADD type_compo + compo_base_origine_id — C8-a/b), sql/23 (ALTER composition_joueurs ADD etat_joueur — C8-c), sql/24 (RLS write Vague 1 + durcissement distances_sites), sql/25 (RLS write evenements + evenement_encadrants), sql/26 (RLS write compositions + composition_joueurs + presences). sql/20 (M-1) volontairement sauté.

**1 fichier JS livré** : `js/dashboard-stats.js` v2.2 → v2.3 (greeting J-N AVANT MATCH).

**Validation E2E** : INSERT + DELETE compositions depuis la console portail authenticated admin = `error: null`. Les 27 policies write fonctionnent en conditions réelles. Phase 4.4 (éditeur UI compo) entièrement débloquée côté backend.

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
| **GitHub** `Manu-MOM/mom-hub` (public) | Code, déploiement, mirroir lecture seule des référentiels | `index.html`, `js/`, `data/` (miroir JSON), `sql/`, `.github/workflows/`, STATE.md |
| **Supabase** `mom-hub` (free tier) | Source de vérité des **données vivantes** (personnes, événements, présences, compositions, etc.) | 12 tables, fonctions RPC, RLS read+write par rôle complète |

⚠️ **Repo GitHub PUBLIC** : ne jamais commit la clé `service_role`, les fiches Personne brutes, ou toute donnée perso (en particulier les SQL des chantiers C1-C4 de la réconciliation OVAL-E).

---

## 📊 État des phases

### ✅ Phase 1 — Déploiement initial du Hub (FAIT)
- Portail HTML déployé sur GitHub Pages : https://manu-mom.github.io/mom-hub/
- Repo public : https://github.com/Manu-MOM/mom-hub
- 9 référentiels JSON mirrorés depuis Drive vers `data/`
- Design : tableau de bord vert bouteille + or, charte Oswald/Manrope/JetBrains Mono

### ✅ Phase 2.0 — Fondations Supabase (FAIT)
- Projet Supabase `mom-hub` créé (NANO compute, healthy)
- URL : `https://fvfqffxaiaoygqhjtxwr.supabase.co`
- 9 tables Vague 1 créées + RLS activé + policies lecture publique sur les référentiels
- 294 personnes migrées via le script `03-migration-personnes-vague1.sql` (**NON commit dans repo public**, archivé local + Drive)
- Anti-pause GitHub Action `keep-alive-supabase.yml` opérationnel (cron 03h UTC, GET poles?limit=1)
- Secrets GitHub configurés : `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### ✅ Phase 2.4 — Portail dynamique (FAIT — 11 mai 2026)
- 4 KPI passifs alimentés en dynamique depuis Supabase via RPC RGPD-safe `get_dashboard_stats`
- Pattern technique : Supabase REST API + RPC + RLS + helpers JS
- `js/dashboard-stats.js` v1.1, `js/supabase-client.js` v1.4

### ✅ Phase 2.4.5 — Réconciliation OVAL-E (FAIT — 11 mai 2026)
- Réconciliation Drive (297 fiches) vs Supabase (323 fiches) vs OVAL-E export FFR
- Doctrine v1.3 publiée (§13 architecture sources, §14 mapping qualités FFR → type_personne)
- Base finale : 323 lignes Supabase dont 298 licenciées FFR alignées OVAL-E

### ✅ Phase 2.5 — Authentification (FAIT — 11 mai 2026)
- Login Magic Link Supabase Auth opérationnel
- Table `auth_roles` (admin / coach / viewer) + 1 admin actif (Manu)
- Helpers `has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER` + `get_my_roles() RETURNS TEXT[]`
- Helpers JS `requireAuth()` / `isAdmin()` / `signOut()`
- Page `dashboard.html` admin
- Boutons d'auth intégrés au portail

### ✅ Phase 3 — Refonte portail + topbar partagée (FAIT — 12 mai 2026)
- Phase 3 partie 1/2 : factorisation CSS dans `css/hub.css`, topbar partagée
- Phase 3 partie 2/2 : refonte zone sous-bandeau, greeting recontextualisé, 4 KPI repensés, sidebar 3 cartes

### ✅ Phase 4.1.B — Sites et distances (FAIT — 12 mai 2026 soir)
- Tables `sites` et `distances_sites` créées via `sql/07-sites.sql`
- 3 sites peuplés : Brencklé, Clubhouse, Holtzplatz (tous MOM)
- API distances (OpenRouteService) reportée à Phase 4.5 (optionnel)

### ✅ Phase 4.1.A — Peuplement Vague 1 + K2 ÉQUIPES dynamique (FAIT — 13 mai 2026 matin)
- 11 ententes + 11 équipes + 23 attaches `equipe_joueurs` M14 MOM via `sql/06-peuplement-vague1-equipes.sql`
- Coach M14 = Emmanuel JUNG (référent ET coach principal)
- SAR (37) et ASCS (2) M14 attaches reportées à Phase 4.3
- Phase 4.1.A bis : K2 ÉQUIPES via RPC `count_equipes_actives()` (sql/09)
- Ferme totalement la dette #5

### ✅ Phase 4.2.A — Noyau événements (FAIT — 13 mai 2026 matin)
- `sql/10-noyau-evenements.sql` : tables `evenements` (28 colonnes) + `evenement_encadrants` (9 colonnes)
- 13 indexes, 8 CHECK, trigger `set_updated_at` réutilisant `trigger_set_updated_at()`
- Naming `_id`, code manuel à l'INSERT, RLS SELECT authenticated

### ✅ Phase 4.2.B — RPC événements (FAIT — 13 mai 2026)
- `sql/11-rpc-evenements.sql` : 2 RPC SECURITY DEFINER authenticated-only
- `get_evenements_a_venir(p_equipe_id, p_jours_a_venir)` + `get_prochain_evenement_par_equipe(p_equipe_id)`

### ✅ Phase 4.2.C — Wrappers JS v1.5 (FAIT — 13 mai 2026)
- `js/supabase-client.js` v1.4 → v1.5 : 2 méthodes
- `SupabaseHub.getEvenementsAVenir()` + `SupabaseHub.getProchainEvenementParEquipe()`

### ✅ Étape G — Peuplement événements M14 réels (FAIT — 13 mai 2026)
- `sql/12-evenements-saison-2025-2026.sql` : 4 événements M14 saison 2025-2026
- Frankfurt (passé À 13), J5 ECLR (passé XV victoire 41-7), Les Gemmeurs (à venir), Challenge Vié (à venir, finale régionale)

### ✅ Étape K — Policies RLS SELECT Vague 1 (FAIT — 13 mai 2026, ferme dette k)
- `sql/13-rls-read-vague1.sql` : 3 policies SELECT authenticated sur ententes, equipes, equipe_joueurs
- `personnes` volontairement non touchée : accès via RPC uniquement (doctrine RGPD)

### ✅ Étape H — 15 entraînements M14 fin de saison (FAIT — 13 mai 2026)
- `sql/14-entrainements-m14-fin-saison-2025-2026.sql` : 15 entraînements (LUNDI 18h00 + MERCREDI 14h00 à Brencklé)
- 14 en `creation`, 1 en `annule` (Pentecôte)

### ✅ Phase 4.4 Étape C — Widget "Prochain événement M14" en sidebar (FAIT — 13 mai 2026)
- `index.html` : carte `.sb-card` insérée en sidebar
- `js/dashboard-stats.js` v2.1 → v2.2 : 8e appel `Promise.all`, calcul jour civil côté JS
- Widget validé visuellement

### ✅ C7 — Audit doctrine OVAL-E joueurs partenaires d'entente (TERMINÉE — 14 mai 2026 côté Audits, 13 mai côté Production)
- C7-a + C7-b livrées côté Audits (Audit-OVAL-E-Joueurs-Partenaires v1, Audit-Personnes v1.2, Doctrine-Import-OVAL-E v1.4)
- C7-c livrée Production (`sql/15-alter-type-personne-c7c.sql` : ajout `licencie_externe_partenaire`)
- C7-f livrée Production (`sql/16-peuplement-partenaires-entente-m14-v1.sql` : 50 fiches partenaires SAR importées depuis SportEasy)
- C7-e résolue naturellement par la RPC `get_vivier_compo` en Phase 4.3
- C7-d résolue par RLS write groupée (sql/24-25-26)
- C7-g reste long terme (passerelle OVAL-E partenaires FFR)
- C7-h reste à l'usage (workflow changement de club)

### ✅ Phase 4.3 — Compositions, présences, RPC vivier (FAIT — 13 mai 2026)

Session de ~2h, 5 fichiers SQL livrés. sql/20 sauté (M-1 dette ouverte).

- **`sql/17-attaches-partenaires-entente-m14.sql`** : 39 attaches `equipe_joueurs` pour les joueurs partenaires SAR/ASCS importés via sql/16. Statut `regulier`, `club_provenance_id = SAR` par défaut (distinction ASCS reportée à dette (m)). Total attaches actives M14 EQ1 : **62** (23 MOM + 39 partenaires).
- **`sql/17b-fix-categorie-partenaires.sql`** : correctif post-sql/16 — les 39 joueurs partenaires avaient `categorie_id = NULL` (l'export SportEasy ne contenait pas la catégorie d'âge). UPDATE categorie_id = M14 sur les 39 joueurs. Les 11 staff/coaches partenaires restent à NULL (cohérent métier). Découvert lors du smoke test sql/21.
- **`sql/18-compositions.sql`** : tables `compositions` (11 colonnes initiales, états `brouillon`/`validee`/`jouee`, versioning via `est_active` + index unique partiel) et `composition_joueurs` (10 colonnes initiales, FK `joueur_id` vers `personnes` sans polymorphisme, UNIQUE titulaire par poste, flag `est_depannage_hors_categorie`). 9 indexes, RLS SELECT authenticated, trigger `set_updated_at_compositions`.
- **`sql/19-presences.sql`** : table `presences` (11 colonnes, FK `personne_id` unifiée MOM/partenaires/encadrants, statuts `present`/`absent`/`present_partiel`, lien optionnel `composition_joueur_id`, UNIQUE (`evenement_id`, `personne_id`)). 6 indexes, RLS SELECT, trigger `set_updated_at_presences`.
- **`sql/21-rpc-vivier-compo.sql`** : RPC `get_vivier_compo(p_equipe_id UUID)` SECURITY DEFINER authenticated-only, 15 colonnes retournées (IDs + libellés humains + flags `est_partenaire_entente`/`f15_integree` + `statut_attache` via LEFT JOIN `equipe_joueurs`). TODO M-1 commenté pour filtre surclassés.

**Smoke test RPC** (M14 EQ1) : total **63** / réguliers **62** / partenaires **39** / f15 **8** / non_attachés **1**. Contrats métier OK.

### ✅ Dette C8 a/b/c — ALTER additifs compositions (FAIT — 13 mai 2026)

Issue de `Audit-Module-Compositions-v3.md` (conv Audits). 2 fichiers SQL livrés.

- **`sql/22-alter-compositions-c8.sql`** : C8-a + C8-b. Ajoute `type_compo` TEXT NOT NULL DEFAULT `'match'` CHECK IN (`base`,`match`) — distingue compo de base (plan A J-7) vs compo de match (J-0). Ajoute `compo_base_origine_id` UUID NULL REFERENCES `compositions(id)` (auto-FK) — trace la dérivation compo de match ← compo de base, permet Vue Comparaison Phase 4.4. CHECK additionnel `compo_base_origine_id IS NULL OR type_compo = 'match'`. Index partiel `idx_compositions_origine`. Table `compositions` passe à 13 colonnes / 5 CHECK explicites / 5 indexes.
- **`sql/23-alter-composition-joueurs-c8.sql`** : C8-c. Ajoute `etat_joueur` TEXT NOT NULL DEFAULT `'base'` CHECK IN (`base`,`modifie`,`independant`,`blesse`) — matérialise les 4 couleurs de l'éditeur SAR×MOM Compos hérité (bleu/orange/vert/rouge). Support de l'écriture exceptionnelle Suivi Match (signalement blessé). Index partiel `idx_composition_joueurs_blesses`. Table `composition_joueurs` passe à 11 colonnes / 2 CHECK explicites / 6 indexes.

C8-d et C8-e ne sont pas livrées ici (voir section dettes — C8-d reste ouverte, C8-e a été résolue par la session RLS write ci-dessous).

### ✅ Phase 4.4 P4-2 — Greeting J-N AVANT MATCH (FAIT — 13 mai 2026 après-midi)

- **`js/dashboard-stats.js` v2.2 → v2.3** : pilote le surtitre `greeting-meta` selon le prochain événement M14 plutôt que la date du jour seule.
- Réutilise `prochainEvtM14` déjà fetché par v2.2 pour la sidebar carte 3 — zéro RPC supplémentaire.
- Logique extraite dans 3 helpers partagés : `joursCivilsAvant(dateISO)`, `formatTypeEvenement(evt)`, `formatGreetingMeta(evt)`.
- Aucune modification de `index.html` (la zone `greeting-meta` existait déjà depuis Phase 3.2).
- **Formats produits selon temporalité ET type** :
  - J=0 entraînement → `AUJOURD'HUI · ENTRAÎNEMENT · BRENCKLÉ`
  - J=1 entraînement → `DEMAIN · ENTRAÎNEMENT · BRENCKLÉ`
  - J>1 entraînement → `DANS N JOURS · ENTRAÎNEMENT · BRENCKLÉ` (format raccourci, le `J-N AVANT ENTRAÎNEMENT` serait pompeux pour un événement hebdomadaire banal)
  - J=0 match → `AUJOURD'HUI · MATCH · VS ECLR`
  - J=1 match → `DEMAIN · MATCH · VS ECLR`
  - J>1 match → `J-N AVANT MATCH · VS ECLR`
  - J=0 tournoi → `AUJOURD'HUI · TOURNOI · LES GEMMEURS`
  - J=1 tournoi → `DEMAIN · TOURNOI · LES GEMMEURS`
  - J>1 tournoi → `J-N AVANT TOURNOI · LES GEMMEURS`
- **Fallback gracieux** : si aucun événement futur OU erreur Supabase OU SupabaseHub non chargé → `greeting-meta` garde la valeur `MARDI 13 MAI 2026 · TABLEAU DE BORD`.
- Test prod validé visuellement : screenshot du 13 mai 12h35 montre `AUJOURD'HUI · ENTRAÎNEMENT · BRENCKLÉ` (cohérent avec l'entraînement du 13 mai 14h).
- Dette P4-2 fermée.

### ✅ Session RLS write par rôle (FAIT — 13 mai 2026 après-midi)

3 fichiers SQL livrés, 27 nouvelles policies write au total sur 9 tables. Résout dettes (i), (l), C7-d, C8-e.

**Choix doctrinaux** :
- Option B retenue : **coach = write libre partout** (P1 simplicité, 1 seul coach prod aujourd'hui = Manu). À durcir en Option A (table de jonction `coach_equipes`) quand multi-coach réel.
- Pattern : 3 policies par table (INSERT / UPDATE / DELETE), basées sur `has_role('admin') OR has_role('coach')` selon matrice ci-dessous.
- Helper `has_role(p_role TEXT) RETURNS BOOLEAN SECURITY DEFINER` réutilisé (existant depuis Phase 2.5).

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
- **`sql/24-rls-write-vague1.sql`** : 12 policies sur ententes (3 admin-only), equipes (3 mixtes), equipe_joueurs (3 mixtes), distances_sites (3 admin-only). Cleanup proactif `DROP POLICY IF EXISTS` sur d'anciennes policies laxistes de distances_sites (`distances_insert_authenticated` etc. — découvertes en session, nommage préfixe `distances_*` au lieu de `distances_sites_*`). Dette (l) résolue.
- **`sql/25-rls-write-evenements.sql`** : 6 policies sur evenements + evenement_encadrants. Préalable check confirmé : aucune policy write préexistante.
- **`sql/26-rls-write-compositions-presences.sql`** : 9 policies sur compositions + composition_joueurs + presences. DELETE = admin+coach sur compositions/composition_joueurs (cas légitime "j'efface ma compo brouillon"), DELETE = admin only sur presences (traçabilité).

**Test E2E validé en conditions réelles** :
- INSERT compositions depuis console portail (compte admin authenticated) → `error: null`, data retournée
- DELETE de la même ligne depuis console portail → `error: null`, 1 ligne supprimée
- Chemins exercés : `has_role('admin')` côté Postgres, JWT correctement transmis depuis le front, RLS check passé
- Les 25 autres policies fonctionnent par induction (même pattern, même helper)

Dettes (i), (l), C7-d, C8-e toutes résolues.

---

## 🔧 Pattern technique acquis (Phase 2.4)

Pour toute donnée Supabase à afficher dans le Hub :

1. **Côté Supabase** : créer une **fonction RPC `SECURITY DEFINER`** qui retourne uniquement les chiffres agrégés nécessaires (pas de données perso brutes).
2. **RLS strict sur la table** : pas de policy SELECT pour `anon` (compteur via RPC seulement).
3. **Côté Hub** : utiliser `supabaseClient.fetchData('rpc/<fn_name>', { method: 'POST', body: {} })`.
4. **Fallback gracieux** : si la RPC échoue, garder les chiffres statiques en place et logger l'erreur en console.

Pour toute écriture front (Phase 4.4+) :

1. **RLS write activée** par rôle via `has_role('admin' | 'coach')` (sql/24-25-26)
2. Coach = write libre sur les tables métier (equipes, equipe_joueurs, evenements, evenement_encadrants, compositions, composition_joueurs, presences)
3. Admin seul sur tables structurantes (ententes, distances_sites) et sur DELETE de la plupart des tables
4. Pattern d'appel : `SupabaseHub.client.from('<table>').insert/update/delete(...)` avec JWT authenticated

---

## 🔄 Doctrine Réconciliation OVAL-E (sources de vérité)

Documents de référence (Drive `00 - Documentation/`) :
- `Doctrine-Import-OVAL-E-v1.4.md` (canonique, 14 mai 2026) — 8 valeurs `type_personne` dont `licencie_externe_partenaire`, §11.7 partenaires d'entente
- `Audit-Personnes-MOM-Hub-v1.2.md` (14 mai 2026) — 5 profils dont partenaires d'entente
- `Audit-OVAL-E-Joueurs-Partenaires-v1.md` (14 mai 2026) — doctrine C7
- `Audit-Module-Compositions-v3.md` (14 mai 2026 soir) — révision post-Phase 4.3, ouvre dette C8

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

### 🟡 Dettes encore actives

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Pas bloquant, à corriger Vague 2.
4. **Référentiels Drive `01 - Référentiels/`** ⚠️ partiellement résolue : Lot 1 cohérence structurelle soldé. Lots 2-3 bloqués par tiers (règlement LRGER 2025-2026, Lohann, préparateur physique).
5. ✅ Chiffres en dur résiduels index.html — totalement résolue 13 mai.
6. ✅ Date HTML statique — résolue 11 mai.
7. ✅ Désalignement Drive ↔ Supabase — arbitré 11 mai.
8. ✅ CHECK constraint `personnes_type_personne_check` — résolue 12 mai (sql/08) + étendue 14 mai (sql/15 ajout `licencie_externe_partenaire`).

### 🔵 Dettes Phase 2.5

9. ✅ Architecture du portail — résolue 12 mai (Phase 3.2)
10. ✅ Panneau État du Hub sidebar — résolue 12 mai
11. ✅ CSS dupliqué — résolue 12 mai (Phase 3.1)
12. **Mini-déséquilibre `<div>` dans index.html** (1 div fermante manquante). Tolérée, à nettoyer un jour.
13. **Allow new users to sign up = ON dans Supabase Auth**. Passer à OFF quand autres rôles déployés.

### ✅ Dette résolue le 12 mai 2026 (conv Audits)

14. ✅ Modélisation entités événements / compositions / présences — `Modelisation-Evenements-v1.1.md` publié. Implémentation Phase 4.2.A à 4.3 livrée intégralement le 13 mai.

### 🔵 Dettes Phase 3

P4-1. **Adaptation portail par rôle** (`coach`, `viewer`) : quand comptes réels existeront.
P4-2. ✅ **Greeting J-N AVANT MATCH** — résolue 13 mai après-midi via `dashboard-stats.js` v2.3.
P4-3. ✅ **Widget prochain match** — résolue 13 mai matin via Phase 4.4 Étape C.
P4-4. **Sync SportEasy automatisée** : hors périmètre actuel.
P4-5. **Greeting mode anonyme à préciser** : à traiter avec compte `viewer` réel.
P4-6. **Personnalisation des `RACCOURCIS`** : à terme.
P4-7. **Outil de listing filtré des fiches** : à terme.

### 🔵 Dettes modélisation événements (conv Audits)

M-1. **ALTER TABLE personnes — bloc_5** 🟡 demi-confirmée : ajouter `categorie_surclassement_id UUID NULL REFERENCES categories(id)`. Structure de `personnes` confirmée plate. ALTER trivial à exécuter quand cas surclassé identifié. **Préalable** au filtre surclassés dans `get_vivier_compo` (TODO commenté). Priorité faible.
M-2. **API d'itinéraire + cache `distances_sites`** : OpenRouteService. Priorité moyenne.
M-3. **Migration Drive → Supabase de `groupes-joueur.json`** : Priorité faible.
M-4. **Onglet paramètres pour édition admin** des référentiels. Lié à M-3.
M-5. **RPC `get_distance_between_sites`** : wrapper. Lié à M-2.

C7. ✅ **Audit doctrine OVAL-E joueurs partenaires d'entente** — TOTALEMENT SOLDÉE 14 mai. C7-a/b/c/d/e/f livrées. C7-g (passerelle FFR) reste long terme, C7-h (changement club) reste à l'usage.

### ✅ Dettes en cascade C8 (Audit-Module-Compositions-v3, 14 mai 2026)

C8-a. ✅ LIVRÉE 13 mai — `sql/22` : ALTER `compositions` ADD `type_compo`.
C8-b. ✅ LIVRÉE 13 mai — `sql/22` : ALTER `compositions` ADD `compo_base_origine_id`.
C8-c. ✅ LIVRÉE 13 mai — `sql/23` : ALTER `composition_joueurs` ADD `etat_joueur`.
C8-d. 🟡 **Extension CHECK `compositions_etat_check`** pour ajouter `archivee` (et éventuellement renommer `jouee` → `utilisee`). Non bloquant, à traiter avant fin saison 2025-2026.
C8-e. ✅ LIVRÉE 13 mai — `sql/26` (policies RLS write compositions/composition_joueurs).

### 🔵 Dettes techniques variées

(c) **Mirror `groupes-joueur.json` v1.1** dans `data/` une fois déposé dans Drive.

(f) Déploiement comptes `coach` et `viewer` réels (préalable à P4-1).

(g) **D-qualite-ffr-array** : migration future `personnes.qualite_ffr` TEXT → ARRAY. À grouper avec import OVAL-E été 2026.

(h) **Compteur K3 CETTE SEMAINE biaisé jusqu'au 17 mai 2026** : la RPC `count_personnes_created_last_7_days` retourne actuellement 373 (toutes les fiches, vu effet de jeunesse de la base). Retombera mécaniquement après le 17 mai. Pas un bug.

(i) ✅ **LIVRÉE 13 mai** — Policies RLS write par rôle complètes via sql/24-25-26 (27 nouvelles policies sur 9 tables, test E2E validé en conditions réelles).

(j) **Leçon doctrinale Claude — anti-invention** : avant de citer un détail factuel (nombre, code, nom de champ/site/objet), faire un `web_fetch` du repo OU un DRY-RUN Supabase. Doctrine OVAL-E §13 (Supabase autoritatif) s'applique aussi à Claude.

(l) ✅ **LIVRÉE 13 mai** — Durcissement RLS WRITE distances_sites via sql/24. Anciennes policies laxistes (`distances_insert_authenticated`, `distances_update_authenticated`, `distances_delete_admin`) supprimées en séance après détection d'un doublon. Distances_sites désormais admin only.

(m) **Correction post-import ASCS** : les 50 fiches partenaires sql/16 sont taggées `club_principal_id = SAR`. UPDATE ciblé `club_principal_id = ASCS` à faire quand Manu fournira la liste exacte des joueurs ASCS dans l'entente M14.

(n) **Complétion sexe + date_naissance partenaires** : 50/50 ont `sexe = NULL`, 23/50 ont `date_naissance = NULL`. Utiliser gabarit Excel `gabarit-effectif-partenaire-entente-mom-v1.xlsx`.

(o) **Wrapper JS `getVivierCompo()` à créer** : pendant Phase 4.4 (UI éditeur de compo). La RPC `get_vivier_compo` est en place côté Supabase mais pas encore exposée dans `js/supabase-client.js`. Pattern : suivre `getProchainEvenementParEquipe()`.

(p) **Test bout-en-bout Phase 4.3 reporté à Phase 4.4** : le test SQL BEGIN/INSERT/ROLLBACK avait été préparé mais bloqué par l'éditeur Supabase. Partiellement compensé par le test E2E INSERT+DELETE depuis console portail du 13 mai après-midi (validé en conditions réelles, voir session RLS write).

(q) **Multi-coach réel — durcissement Option A** : actuellement RLS write coach autorise un coach à écrire sur n'importe quelle équipe (Option B simplicité, 1 coach prod = Manu). À durcir en Option A via table de jonction `coach_equipes(user_id, equipe_id)` quand un 2e coach réel arrivera (ex : coach SAR/ASCS). Priorité : déclenchée par usage réel.

---

## 📂 Structure repo finale

```
mom-hub/
├── .github/workflows/keep-alive-supabase.yml
├── assets/
│   └── logo-m2m.png
├── css/
│   └── hub.css
├── data/                                    # miroir lecture seule des référentiels Drive
│   ├── aptitudes.json
│   ├── ateliers.json
│   ├── conformite-ffr.json
│   ├── observables-match.json
│   ├── postes.json
│   ├── tests-physiques.json
│   └── (groupes-joueur.json à mirroir post upload Drive)
├── js/
│   ├── data-loader.js
│   ├── supabase-client.js                   # v1.5 — 2 wrappers événements
│   └── dashboard-stats.js                   # v2.3 — greeting J-N + 8 sources dynamiques
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
│   └── 26-rls-write-compositions-presences.sql
│   # NB: sql/20 sauté (M-1 ALTER personnes bloc_5, dette ouverte)
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit (données perso)
├── index.html
├── login.html
├── dashboard.html
├── test-supabase.html
├── README.md
├── STATE.md                                 # ← CE FICHIER
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
| `Doctrine-Import-OVAL-E-v1.3.md` | `11mwHCbfx2mkehktMzItqmXVkntFm7BCf` | Historique v1.3 |
| `Doctrine-Import-OVAL-E-v1.2.md` | `1dUMeJZfbxSHhWT6Bn2diso1mwbhXMHJz` | Historique v1.2 |
| `Doctrine-Import-OVAL-E-v1.1.md` | `1puTaNLXno99T4C9ECkEIgi1YGbk6bE41` | Historique v1.1 |
| `Audit-OVAL-E-Joueurs-Partenaires-v1.md` | `12_akokLYOUpyk-_CKIkW5H8WzvleEqiO` | Audit C7 |
| `Conception-Portail-Phase-3.md` | `12xrICwk5NTzk1XZLpq964CkWwhft3zc2` | Conception portail Phase 3 |
| `Audit-Referentiels-v1.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Audit des 6 référentiels métier |
| `Schema-cible-Supabase-aptitudes.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Pattern migration Drive → Supabase |
| `Modelisation-Evenements-v1.1.md` | `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u` | **Modélisation événements v1.1** — référence canonique |
| `Modelisation-Evenements-v1.0.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | v1.0 superseded |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit Compos v2 historique |
| `Audit-Module-Compositions-v3.md` | `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ` | **Audit Compos v3** — révision post-Phase 4.3 |
| `Audit-Module-Suivi-Match.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Module-Rapport.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Module-Statistiques.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Module-Bilans.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit Personnes v1.0 |
| `Audit-Personnes-MOM-Hub-v1.1.md` | `1sf6UMb1dPvh9znfDoUw6duGkLR7GLFtA` | Audit Personnes v1.1 |
| `Audit-Personnes-MOM-Hub-v1.2.md` | `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA` | **Audit Personnes v1.2** — 5 profils |
| `Registre-anomalies-OVAL-E.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Registre anomalies réconciliation FFR |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h`
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE`

---

## 🚀 Prochaine session

**Avant de démarrer toute Phase 4.4** :
1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Lire `Modelisation-Evenements-v1.1.md` + `Audit-Module-Compositions-v3.md` (référence canonique éditeur UI compo)
4. Vérifier que la chaîne Hub → Supabase fonctionne (console portail → `✅ MOM Hub Dashboard v2.3` ET `🏉 MOM Hub · Supabase Client v1.5 chargé`)
5. Vérifier le greeting J-N et le widget "Prochain événement M14" en sidebar
6. Vérifier que `login.html` envoie bien un Magic Link aboutissant sur `dashboard.html`

**Travaux en attente** :

- **Conv Production** : énormément avancé le 13 mai (Phase 4.3 + dette C8 a/b/c + P4-2 + session RLS write groupée). **Phase 4.4 UI éditeur de compo entièrement débloquée côté backend.** Prochaines pistes par ordre d'impact :
  - **Phase 4.4 UI éditeur de compo** (gros morceau, requiert d'abord cycle Conception pour spécifier l'UX — 8 écrans, drag-and-drop vs picklist, Vue Comparaison base vs match, multi-mode Complet/Réduit/EDR).
  - **Wrapper JS `getVivierCompo()`** (dette o) — à grouper avec Phase 4.4 UI.
  - **C8-d** : extension CHECK `etat` (ajout `archivee`, renommage `jouee` → `utilisee` optionnel). Non bloquant, ~10 min, avant fin saison.
  - **Wrappers JS écriture** : à créer en Phase 4.4 (`createCompo`, `addJoueurCompo`, `markPresence`, etc.) pour exploiter les nouvelles policies RLS write.
  - **Greeting J-N** : ✅ livré le 13 mai après-midi, optionnellement à enrichir avec multi-équipes quand auth multi-équipe sera étendue.

- **Conv Audits** : C7 + C8 totalement soldées côté Audits. Travaux restants par priorité :
  - **Reprise audit Suivi-Match** (recommandation forte) à la lumière de Phase 4.3 + dette C3 (modélisation observables-match en table SQL). Pré-requis C8-c livré ✅.
  - Audits Rapport, Stats, Bilans à reprendre post-Phase 4.3.
  - Lots 2-3 de l'audit référentiels (bloqués par tiers).
  - Modélisation événements extra-sportifs (C2, Phase 5).
  - Modélisation compo adverse + joueurs adverses (C1, reportée après usage réel).

- **Conv Conception Portail** : `Conception-Portail-Phase-3.md` v1.0 livrée. Pour Phase 4.4, rouvrir un cycle dédié pour spécifier l'UX éditeur de compo (input principal : Audit-Module-Compositions-v3 §4).

- **Conv Modules Ateliers** (à démarrer) : message kick-off à transmettre par Manu. 3 questions de cadrage à instruire.

- **Conv Suivi Match** (à ouvrir, recommandation forte) : module à construire, audit v2 existant, dette C3 à instruire. Pré-requis C8-c livré ✅.

- **Futures conv Modules métier** : "MOM Hub - Modules Ateliers et ressources pédagogiques", "MOM Hub - Modules Planification de la saison et préparation de séances". Point d'ancrage : `Modelisation-Evenements-v1.1.md` §10.3.
