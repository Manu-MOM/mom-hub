# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 13 mai 2026 (début d'après-midi, ~13h36) — Grosse matinée bouclée. Côté Audits : C7-a (Doctrine OVAL-E v1.4) + C7-b (Audit-Personnes v1.2) + C8 (Audit-Module-Compositions v3). Côté Production : Phase 4.3 (compositions + composition_joueurs + presences + RPC vivier, 39 attaches partenaires SAR), C8-a/b/c (3 ALTER additifs préalables Phase 4.4 UI), session RLS write groupée résolvant (i)+(l)+C7-d+C8-e (27 policies sur 9 tables), et P4-2 (greeting J-N AVANT MATCH). Phase 4.4 UI éditeur de compo entièrement débloquée côté backend.**

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
| **Supabase** `mom-hub` (free tier) | Source de vérité des **données vivantes** (personnes, événements, présences, etc.) | 12 tables (9 Vague 1 + 3 Phase 4.2/4.3), fonctions RPC, RLS write par rôle complète |

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
- Page diagnostic `test-supabase.html`

### ✅ Phase 2.4.5 — Réconciliation OVAL-E (FAIT — 11 mai 2026)
- Réconciliation Drive (297 fiches) vs Supabase (323 fiches) vs OVAL-E export FFR
- Doctrine v1.3 publiée (§13 architecture sources, §14 mapping qualités FFR → type_personne)
- 6 dettes Axe B D1-D6 soldées
- Base finale : 323 lignes Supabase dont 298 licenciées FFR alignées OVAL-E

### ✅ Phase 2.5 — Authentification (FAIT — 11 mai 2026)
- Login Magic Link Supabase Auth opérationnel
- Table `auth_roles` (admin / coach / viewer) + 1 admin actif (Manu)
- Helpers `requireAuth()` / `isAdmin()` / `signOut()`
- Page `dashboard.html` admin
- Boutons d'auth intégrés au portail

### ✅ Phase 3 — Refonte portail + topbar partagée (FAIT — 12 mai 2026)

Travail livré ce 12 mai en deux temps (factorisation CSS puis refonte du contenu), guidé par `Conception-Portail-Phase-3.md` v1.0.

- **Phase 3 partie 1/2 (factorisation CSS + topbar partagée)** : `css/hub.css` (palette canonique, polices, reset, topbar Hub partagée, classes utilitaires).
- **Phase 3 partie 2/2 (refonte portail)** : zone sous-bandeau refondue. Greeting recontextualisé, 4 KPI repensés, 5 sections avec sous-titres, sidebar 3 cartes.

### ✅ Phase 4.1.B — Sites et distances (FAIT — 12 mai 2026 soir)
- Tables `sites` et `distances_sites` créées via `sql/07-sites.sql`
- 3 sites peuplés : Brencklé, Clubhouse, Holtzplatz (tous MOM)
- API distances (OpenRouteService) reportée à Phase 4.5 (optionnel)

### ✅ Phase 4.1.A — Peuplement Vague 1 + K2 ÉQUIPES dynamique (FAIT — 13 mai 2026 matin)
- **Peuplement via `sql/06-peuplement-vague1-equipes.sql`** :
  - 11 ententes (3 Permanente SAR/MOM/ASCS M14/M16/M19 + 8 Solo MOM)
  - 11 équipes
  - 23 attaches `equipe_joueurs` M14 MOM en statut `regulier`
- Coach M14 = Emmanuel JUNG (référent ET coach principal)
- SAR (37) et ASCS (2) M14 attaches **reportées à Phase 4.3** — peuplement effectif au cours de la matinée du 13 mai après instruction dette C7
- **Phase 4.1.A bis — K2 ÉQUIPES bascule en dynamique** : RPC `count_equipes_actives()` + `js/dashboard-stats.js` v2.1
- Ferme totalement la dette #5

### ✅ Phase 4.2.A — Noyau événements (FAIT — 13 mai 2026 matin)
- **`sql/10-noyau-evenements.sql`** : tables `evenements` (28 colonnes) + `evenement_encadrants` (9 colonnes), 13 indexes, 8 CHECK, RLS SELECT authenticated
- Test INSERT factice + ROLLBACK validé en prod

### ✅ Phase 4.2.B — RPC événements (FAIT — 13 mai 2026 matin)
- **`sql/11-rpc-evenements.sql`** : `get_evenements_a_venir` + `get_prochain_evenement_par_equipe`, SECURITY DEFINER authenticated-only
- Test fonctionnel 8 scénarios validé en prod

### ✅ Phase 4.2.C — Wrappers JS v1.5 (FAIT — 13 mai 2026 matin)
- **`js/supabase-client.js` v1.4 → v1.5** : `SupabaseHub.getEvenementsAVenir()` + `SupabaseHub.getProchainEvenementParEquipe()`
- Test prod console validé

### ✅ Étape G — Peuplement événements M14 réels (FAIT — 13 mai 2026 matin)
- **`sql/12-evenements-saison-2025-2026.sql`** : 4 événements M14 saison 2025-2026 importés depuis sarmom-compos
  - Frankfurt (tournoi PASSÉ, 5ème/10)
  - ECLR J5 (championnat PASSÉ, victoire 41-7)
  - Les Gemmeurs (tournoi À VENIR, Rion-des-Landes)
  - Challenge Vié (tournoi À VENIR, Nancy, finale régionale)

### ✅ Étape K — Policies RLS SELECT Vague 1 (FAIT — 13 mai 2026 matin, ferme dette k)
- **`sql/13-rls-read-vague1.sql`** : 3 policies SELECT sur `ententes`, `equipes`, `equipe_joueurs`
- `personnes` volontairement non touchée (doctrine RGPD = accès RPC uniquement)

### ✅ Étape H — 15 entraînements M14 fin de saison (FAIT — 13 mai 2026 matin)
- **`sql/14-entrainements-m14-fin-saison-2025-2026.sql`** : 15 entraînements hebdomadaires
- LUNDI 18h00-19h15 + MERCREDI 14h00-16h00 à Brencklé
- 14 en état `creation`, 1 en état `annule` (Pentecôte 25 mai)

### ✅ Phase 4.4 Étape C — Widget "Prochain événement M14" en sidebar (FAIT — 13 mai 2026 matin)
- **`index.html`** : nouvelle carte `.sb-card` avec IDs JS `evt-when`, `evt-type`, `evt-site`
- **`js/dashboard-stats.js` v2.1 → v2.2** : 8e appel Promise.all, humanisation, calcul jours civils
- Test prod validé visuellement

### ✅ Phase 4.3 — Compositions + présences + vivier (FAIT — 13 mai 2026 matin)

Session Production ~2h, 5 fichiers SQL.

- **`sql/17-attaches-partenaires-sar-m14.sql`** : 39 attaches `equipe_joueurs` partenaires SAR `statut='regulier'` sur M14 EQ1. Total attaches actives M14 EQ1 = 62 (23 MOM + 39 partenaires).
- **`sql/17b-fix-categorie-id-partenaires.sql`** : fix `UPDATE categorie_id = M14` sur les 39 joueurs partenaires (export SportEasy ne contenait pas la catégorie d'âge). Les 11 staff/coaches partenaires restent à NULL.
- **`sql/18-compositions.sql`** : tables `compositions` (versioning `version`+`est_active`, états `brouillon`/`validee`/`jouee`) + `composition_joueurs` (FK unifiée `joueur_id` vers personnes, UNIQUE titulaire par poste). Conforme `Modelisation-Evenements-v1.1.md §4.3`.
- **`sql/19-presences.sql`** : table `presences` (joueurs + encadrants, 3 statuts, lien optionnel `composition_joueur_id`). Conforme §4.4.
- **`sql/21-rpc-vivier-compo.sql`** : RPC `get_vivier_compo` SECURITY DEFINER authenticated-only.

**Smoke test final sur M14 EQ1** :
```
total       = 63    (24 M14 MOM + 39 partenaires)
reguliers   = 62    (23 MOM + 39 partenaires)
partenaires = 39
f15         = 8
non_attaches = 1
```

Contrats métier OK. **C7-e levée naturellement** par le LEFT JOIN à `equipe_joueurs`.

**Décisions Production** :
- États compositions = brouillon/validee/jouee (fidélité v1.1).
- Transition automatique `evenements.etat` creation→compo : reportée (P3 itération).
- `sql/20` (M-1 ALTER) : sauté en numérotation. Structure plate de personnes confirmée → ALTER trivial à exécuter sur cas surclassé.

### ✅ Dette C8-a/b/c — 3 ALTER additifs compositions (FAIT — 13 mai 2026 matin)

Session Production ~15 min, 2 fichiers SQL après transmission de `Audit-Module-Compositions-v3.md`.

- **`sql/22-alter-compositions-type-et-origine.sql`** : C8-a + C8-b
  - **C8-a** : `ADD COLUMN type_compo TEXT NOT NULL DEFAULT 'match' CHECK IN ('base', 'match')`
  - **C8-b** : `ADD COLUMN compo_base_origine_id UUID NULL REFERENCES compositions(id)`
  - **Bonus Production (validé par Audits)** : CHECK `compositions_origine_only_for_match_check` (compo de base ne peut pas dériver) + index partiel `idx_compositions_origine`
- **`sql/23-alter-composition-joueurs-etat.sql`** : C8-c
  - **C8-c** : `ADD COLUMN etat_joueur TEXT NOT NULL DEFAULT 'base' CHECK IN ('base', 'modifie', 'independant', 'blesse')`
  - **Bonus Production** : index partiel `idx_composition_joueurs_blesses`

**État final tables** :
```
compositions ............ : 13 colonnes / 5 CHECK explicites / 5 indexes
composition_joueurs ..... : 11 colonnes / 2 CHECK explicites / 6 indexes
```

### ✅ Session RLS write groupée — résout (i) + (l) + C7-d + C8-e (FAIT — 13 mai 2026 matin)

Session Production groupée dans la foulée de C8-a/b/c, 3 fichiers SQL, **27 nouvelles policies write sur 9 tables**.

- **`sql/24-rls-write-evenements-equipes.sql`** : write sur `evenements`, `evenement_encadrants`, `equipes`, `equipe_joueurs`, plus **durcissement de `distances_sites`** (anciennes policies laxistes détectées + supprimées par DROP IF EXISTS, recréation admin-only)
- **`sql/25-rls-write-personnes.sql`** : write par rôle sur `personnes` (cas particulier `licencie_externe_partenaire` couvert)
- **`sql/26-rls-write-compositions-presences.sql`** : write sur `compositions`, `composition_joueurs`, `presences`

**Pattern doctrinal** : `has_role('admin') OR has_role('coach')` sur INSERT/UPDATE pour la plupart des tables. DELETE également pour `compositions` et `composition_joueurs`. Pour `presences` : admin-only sur DELETE (préserve traçabilité).

**Choix doctrinal Option B retenu** : coach = write libre partout (pas de restriction par équipe). P1 simplicité, 1 seul coach prod aujourd'hui = Manu. **Nouvelle dette (q)** ouverte pour durcissement futur Option A (table de jonction `coach_equipes`) quand un 2e coach réel arrivera.

**Test E2E validé** : INSERT + DELETE compositions depuis la console portail authenticated admin → `error: null`.

**Dettes soldées** : (i) RLS write par rôle, (l) distances_sites admin-only, C7-d RLS write partenaires d'entente, C8-e RLS write compositions/composition_joueurs.

### ✅ Phase 4.4 P4-2 — Greeting J-N AVANT MATCH (FAIT — 13 mai 2026 matin)

- **`js/dashboard-stats.js` v2.2 → v2.3** : le surtitre `greeting-meta` affiche désormais le prochain événement M14. Zéro RPC supplémentaire (réutilise `prochainEvtM14` de v2.2).

**Formats produits** :
- J=0 entraînement → `AUJOURD'HUI · ENTRAÎNEMENT · BRENCKLÉ`
- J=1 entraînement → `DEMAIN · ENTRAÎNEMENT · BRENCKLÉ`
- J>1 entraînement → `DANS N JOURS · ENTRAÎNEMENT · BRENCKLÉ`
- J>1 match → `J-N AVANT MATCH · VS ECLR`
- J>1 tournoi → `J-N AVANT TOURNOI · LES GEMMEURS`
- Fallback → date du jour

**Validé visuellement** : screenshot 13 mai 12h35 affichant `AUJOURD'HUI · ENTRAÎNEMENT · BRENCKLÉ`.

**Phase 4.4 partie UI portail (greeting + widget) : COMPLÈTE.**

---

## 🔧 Pattern technique acquis (Phase 2.4)

Pour toute donnée Supabase à afficher dans le Hub :

1. **Côté Supabase** : créer une **fonction RPC `SECURITY DEFINER`** qui retourne uniquement les chiffres agrégés nécessaires (pas de données perso brutes).
2. **RLS strict sur la table** : pas de policy SELECT pour `anon` (compteur via RPC seulement).
3. **Côté Hub** : utiliser `supabaseClient.fetchData('rpc/<fn_name>', { method: 'POST', body: {} })`.
4. **Fallback gracieux** : si la RPC échoue, garder les chiffres statiques en place et logger l'erreur en console.

---

## 🔄 Doctrine Réconciliation OVAL-E (sources de vérité)

Documents de référence (Drive `00 - Documentation/`) :
- **`Doctrine-Import-OVAL-E-v1.4.md`** (canonique, 13 mai 2026) — ajoute la 8e valeur `licencie_externe_partenaire` au §14 + nouveau §11.7 dédié aux joueurs partenaires d'entente
- `Doctrine-Import-OVAL-E-v1.3.md` (11 mai 2026, superseded mais conservée)
- `Doctrine-Import-OVAL-E-v1.2.md`, `v1.1.md` (conservées pour traçabilité)
- **`Audit-Personnes-MOM-Hub-v1.2.md`** (13 mai 2026, étend à 5 profils dont partenaires d'entente)
- `Audit-Personnes-MOM-Hub-v1.1.md`, `v1.0.md` (conservées pour traçabilité)
- **`Audit-OVAL-E-Joueurs-Partenaires-v1.md`** (13 mai 2026, instruction complète C7)
- `Registre-anomalies-OVAL-E.md`

**Architecture des sources de vérité (§13 doctrine v1.4)** :
- **Drive figé au 10 mai 2026** pour la saison 2025-2026 — utilisable comme archive
- **Supabase autoritatif** pour les données vivantes (323 fiches)
- **OVAL-E export FFR** = source externe pour réconciliation annuelle
- Décision saison 2026-2027 reportée à l'été 2026

**Mapping qualités FFR → type_personne (§14 doctrine v1.4)** : **8 valeurs** — 5 licenciées MOM + **`licencie_externe_partenaire`** (8e valeur v1.4) + `non_licencie` + `non_licencie_au_mom`.

**Note structure Supabase (confirmée 13 mai 2026 par Production)** : la table `personnes` est en **structure plate** (pas de JSONB sur bloc_5). Colonnes : `categorie_personne`, `type_personne`, `categorie_id`, `club_principal_id`, `annee_arrivee_club`, `f15_integree`, `source_creation`. Les 9 blocs doctrinaux vivent côté Drive (figé) et conceptuellement dans les schémas JSON.

---

## 🔁 Pipeline réconciliation OVAL-E (à pérenniser)

Pipeline en 4 chantiers (C1-C4) prêt à rejouer chaque saison :
- **C1** : Hygiène générale (rétro-import doublons, normalisation casse)
- **C2** : Alignement OVAL-E (insert manquants, update mismatches)
- **C3** : Conformité doctrinale (type_personne, qualités, statut FFR)
- **C4** : Audit final (croisement Drive ↔ Supabase ↔ OVAL-E)

**SQL scripts C1/C2/C3/C4** : **NON commit dans repo public**. Archivés local + Drive.

---

## 🩹 Dettes techniques à traiter

### ✅ Dettes résolues le 11 mai 2026 (Phase 2.4.5)

1. ~~**Écart 293 vs 294 personnes**~~ ✅ **RÉSOLU** : base à 323 lignes dont 298 licenciées FFR.
2. ~~**Écart 24 vs 23 M14**~~ ✅ **RÉSOLU** : 24 M14 = 16 M-14 + 8 F-15 intégrées. Les 2 noms ajoutés sont **Eden FAUVEL** et **Auriane DECOURCELLE**.

### 🟡 Dettes encore actives

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Pas bloquant.
4. **Référentiels Drive `01 - Référentiels/`** ⚠️ **PARTIELLEMENT RÉSOLU** : Lot 1 soldé. Lots 2 et 3 bloqués par tiers (règlement LRGER 2025-2026, Lohann, préparateur physique).
5. ✅ ~~**Chiffres en dur résiduels dans index.html**~~ — **RÉSOLU 13 mai 2026**.
6. ~~**Date `VENDREDI 8 MAI 2026 · HUB INITIALISÉ`**~~ ✅ **RÉSOLU**.
7. ~~**Désalignement Drive ↔ Supabase**~~ ✅ **ARBITRÉ** : Drive figé, Supabase autoritatif.
8. ~~**CHECK constraint `personnes_type_personne_check` à étendre**~~ ✅ **RÉSOLU 12 mai 2026** (`sql/08`) : ajout `licencie_soigneur` + `licencie_arbitre` (7 valeurs). **⚠️ L'ajout de la 8e valeur `licencie_externe_partenaire` (C7-c) reste à exécuter** — voir C7-c plus bas.

### 🔵 Dettes ouvertes par la Phase 2.5

9. ~~**Architecture du portail à revoir**~~ ✅ **RÉSOLU** (Phase 3).
10. ~~**Panneau "État du Hub" sidebar**~~ ✅ **RÉSOLU** (Phase 3).
11. ~~**CSS dupliqué**~~ ✅ **RÉSOLU** (Phase 3).
12. **Mini-déséquilibre `<div>` ouverts/fermés dans `index.html`**. Tolérée par les navigateurs.
13. **Allow new users to sign up = ON dans Supabase Auth** : à passer à OFF quand autres rôles déployés.

### ✅ Dette résolue le 12 mai 2026 (conv Audits — modélisation événements)

14. ~~**Modélisation entités événements / compositions / présences**~~ ✅ **RÉSOLU** : `Modelisation-Evenements-v1.1.md` publié. 6 nouvelles tables modélisées — **toutes livrées en Phases 4.1.B + 4.2 + 4.3 entre 12 et 13 mai 2026**.

### 🔵 Dettes ouvertes par la Phase 3

P4-1. **Adaptation portail par rôle** (`coach`, `viewer`) : à calibrer quand des comptes réels existeront.

P4-2. ✅ **LIVRÉ 13 mai 2026 matin** : greeting contextualisé `AUJOURD'HUI · ENTRAÎNEMENT · BRENCKLÉ` / `J-N AVANT MATCH · VS ECLR` / etc.

P4-3. ✅ **LIVRÉ 13 mai 2026 matin** : widget "Prochain événement M14" en sidebar.

P4-4. **Sync SportEasy automatisée** : hors périmètre actuel.

P4-5. **Greeting mode anonyme à préciser** : à traiter quand un compte `viewer` sera actif.

P4-6. **Personnalisation des `RACCOURCIS` (sidebar carte 3)** selon le rôle.

P4-7. **Outil de listing filtré des fiches** (chiffres Qualité des données cliquables).

### 🔵 Dettes ouvertes par la modélisation événements (12 mai 2026)

M-1. **ALTER TABLE personnes — bloc_5** 🟡 **RÉDUIT en v1.1** : ajouter `categorie_surclassement_id UUID NULL REFERENCES categories(id)`. Structure plate confirmée, ALTER trivial à exécuter sur cas surclassé. Priorité faible.

M-2. **Intégration API d'itinéraire + cache `distances_sites`** : OpenRouteService recommandé. Priorité moyenne.

M-3. **Migration future Drive → Supabase de `groupes-joueur.json`**. Priorité faible.

M-4. **Onglet paramètres pour édition admin** des référentiels. Lié à M-3.

M-5. **RPC `get_distance_between_sites(origine_id, destination_id)`**. Lié à M-2.

### ✅ Dette C7 — Audit doctrine OVAL-E sur joueurs partenaires d'entente

C7 a été ouverte par la modélisation v1.1 (§9.2) puis instruite par la conv Audits le 13 mai 2026. **Statut au 13 mai 13h36** : **côté Audits totalement soldée**. Côté Production, 2 sous-dettes déjà soldées dans la même journée (C7-d, C7-e), 4 restent ouvertes.

**Doctrine retenue (résumé)** : les joueurs SAR/ASCS d'entente sont créés dans `personnes` Supabase comme fiches complètes, avec `bloc_5.club_principal_id = club-sar` ou `club-ascs`, `type_personne = licencie_externe_partenaire` (8e valeur OVAL-E v1.4). Attache via `equipe_joueurs.club_provenance_id`. Blocs sensibles vides ou minimaux côté MOM par doctrine RGPD.

**Sous-dettes C7** :

**C7-a** ✅ **LIVRÉE 13 mai 2026 (conv Audits)** : 2 livrables Drive :
- `Audit-OVAL-E-Joueurs-Partenaires-v1.md` (fileId `12_akokLYOUpyk-_CKIkW5H8WzvleEqiO`)
- `Doctrine-Import-OVAL-E-v1.4.md` (fileId `1Va9h9lQVIXHmPfTRK0s5ZuoQoGAy3dwQ`)

**C7-b** ✅ **LIVRÉE 13 mai 2026 (conv Audits)** : `Audit-Personnes-MOM-Hub-v1.2.md` (fileId `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA`) — extension à 5 profils.

**C7-c** ⚠️ **STATUT À CONFIRMER** : ALTER CHECK `personnes_type_personne_check` pour autoriser la valeur `licencie_externe_partenaire`. Pattern identique à dette #8. Production a peuplé 39 attaches `equipe_joueurs` partenaires SAR en `sql/17`, mais les messages de session ne mentionnent pas explicitement l'exécution de C7-c. À vérifier prochaine session Production :
- Le CHECK `personnes_type_personne_check` autorise-t-il bien `licencie_externe_partenaire` ?
- Les 39 fiches partenaires SAR référencées par `equipe_joueurs.personne_id` ont-elles `type_personne = 'licencie_externe_partenaire'` ?
- Ou bien les fiches `personnes` partenaires ne sont-elles pas encore créées (auquel cas C7-c reste un préalable au peuplement réel des fiches) ?

C7-c reste **PRÉALABLE BLOQUANT** au peuplement effectif des fiches `personnes` partenaires d'entente. Effort ~5 min.

**C7-d** ✅ **LIVRÉE 13 mai 2026 (Production, sql/24-26)** : couverte par les policies génériques sur `equipe_joueurs` lors de la session RLS write groupée.

**C7-e** ✅ **LEVÉE NATURELLEMENT 13 mai 2026** : la RPC `get_vivier_compo` retourne les joueurs partenaires via LEFT JOIN `equipe_joueurs` sans jointure spéciale.

**C7-f** Ouverte : choisir canal d'import pour le peuplement initial M14 (39 fiches SAR/ASCS) et futurs M16 (~35) et M19 (similaire). 3 options : Excel manuel (recommandé), extraction SportEasy, passerelle OVAL-E partenaires future. Préalable opérationnel.

**C7-g** Long terme : passerelle OVAL-E partenaires officielle FFR. Dépend FFR.

**C7-h** À l'usage : workflow changement de club d'un joueur en cours de saison.

### ✅ Dette C8 — Audit Compositions v3 + 3 ALTER additifs + RLS write

C8 a été ouverte par la conv Audits le 13 mai matin (`Audit-Module-Compositions-v3.md`, fileId `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ`), suite à l'identification de 3 décalages structurels entre la doctrine v2 et le schéma Phase 4.3. **Statut au 13 mai 13h36** : C8-a + C8-b + C8-c + C8-e livrés en base. C8-d reste ouvert (non bloquant).

**3 décalages D1/D2/D3 résolus** par 3 ALTER additifs :
- D1 (type de compo absent) → C8-a
- D2 (lien dérivation absent) → C8-b
- D3 (4 états joueur absents) → C8-c

**C8-a** ✅ **LIVRÉ 13 mai 2026 matin (Production, sql/22)**.

**C8-b** ✅ **LIVRÉ 13 mai 2026 matin (Production, sql/22)**. Bonus : CHECK additionnel + index partiel `idx_compositions_origine`.

**C8-c** ✅ **LIVRÉ 13 mai 2026 matin (Production, sql/23)**. Bonus : index partiel `idx_composition_joueurs_blesses`.

**C8-d** Ouverte 🟡 : extension CHECK `compositions_etat_check` pour ajouter `archivee`. Arbitrage à faire : Option A (renommage `jouee` → `utilisee`) ou Option B (juste ajout `archivee`, garder `jouee`). Non bloquant, à traiter avant fin saison 2025-2026.

**C8-e** ✅ **LIVRÉ 13 mai 2026 matin (Production, sql/26)** : policies RLS write par rôle sur `compositions` et `composition_joueurs` lors de la session RLS write groupée.

### 🔵 Dettes mineures Phase 4

(a) **Implémentation des tables modélisées** : ✅ **TERMINÉE 13 mai 2026**. Reste seulement M-1 sur cas surclassé.

(b) **RPC associées** : ✅ `get_evenements_a_venir` + `get_prochain_evenement_par_equipe` + `get_vivier_compo` LIVRÉES. Reste à faire : `get_distance_between_sites` (Phase 4.5).

(c) **Mirror `groupes-joueur.json` v1.1** dans `data/` une fois déposé dans Drive.

(d) ✅ **Dette #8 RÉSOLUE et committée**.

(e) ✅ **Dettes mineures RÉSOLUES** : logo M2M PNG, `04-auth-roles.sql` déplacé.

(f) Déploiement comptes `coach` et `viewer` réels (préalable à P4-1).

(g) **D-qualite-ffr-array** : migration future TEXT → ARRAY. À grouper avec import OVAL-E été 2026.

(h) **Compteur K3 CETTE SEMAINE biaisé jusqu'au 17 mai 2026** : retombera mécaniquement après 7 jours glissants.

(i) ✅ **LIVRÉE 13 mai 2026 matin (Production, sql/24-26)** : 27 policies RLS write sur 9 tables.

(j) **Leçon doctrinale Claude (anti-invention)** : avant de citer un détail factuel, faire un `web_fetch` du repo OU un DRY-RUN sur Supabase OU consulter le fichier Drive.

(k) ✅ **Dette FERMÉE 13 mai 2026 matin** — policies RLS READ pour Vague 1.

(l) ✅ **LIVRÉE 13 mai 2026 matin (Production, sql/24)** : durcissement RLS WRITE `distances_sites` admin-only.

(m) **Correction post-import ASCS** : UPDATE ciblé `club_principal_id` sur les fiches ASCS quand Manu fournira la liste. Ouvert.

(n) **Complétion sexe + date_naissance partenaires SAR** : gabarit Excel déjà livré, complétion en cours. Ouvert.

(o) **Wrapper JS `getVivierCompo()`** : à créer en Phase 4.4 (préalable UI éditeur de compo). Ouvert.

(p) **Test E2E Phase 4.3** : reporté à Phase 4.4. Ouvert.

(q) **🆕 Durcissement futur Option A** : table de jonction `coach_equipes` à introduire quand un 2e coach réel arrivera, pour passer du modèle Option B (coach = write libre partout) à Option A (coach = write sur ses équipes uniquement). Priorité faible.

---

## 📂 Structure repo finale

```
mom-hub/
├── .github/workflows/keep-alive-supabase.yml
├── css/
│   └── hub.css                            # palette canonique + topbar partagée
├── data/                                  # miroir lecture seule des référentiels Drive
│   ├── README.md
│   ├── aptitudes.json
│   ├── ateliers.json
│   ├── categories.json
│   ├── conformite-ffr.json
│   ├── observables-match.json
│   ├── postes.json
│   ├── tests-physiques.json
│   └── (3 autres dont groupes-joueur.json à mirroir post upload Drive)
├── js/
│   ├── data-loader.js                     # ancien loader des référentiels statiques
│   ├── supabase-client.js                 # wrapper SupabaseHub v1.5
│   └── dashboard-stats.js                 # v2.3 — 8 sources dynamiques + greeting J-N
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
│   ├── 17-attaches-partenaires-sar-m14.sql
│   ├── 17b-fix-categorie-id-partenaires.sql
│   ├── 18-compositions.sql
│   ├── 19-presences.sql
│   ├── 21-rpc-vivier-compo.sql
│   ├── 22-alter-compositions-type-et-origine.sql      # C8-a + C8-b
│   ├── 23-alter-composition-joueurs-etat.sql          # C8-c
│   ├── 24-rls-write-evenements-equipes.sql            # (i) + (l) + C7-d partiel
│   ├── 25-rls-write-personnes.sql                     # (i) + C7-d
│   └── 26-rls-write-compositions-presences.sql        # C8-e
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit
│   # NB: sql/15, sql/16, sql/20 sautés (réservés à M-1 et autres dettes)
├── README.md
├── STATE.md                               # ← CE FICHIER
├── PASSATION.md                           # kit de démarrage par thématique
├── index.html                             # portail dynamique
└── test-supabase.html                     # page de diagnostic
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
| `Doctrine-MOM-Hub-v2.md` | `1Ebx20ANb80hU0giLSfVAl8n5OSZFwJZW` | Doctrine fondatrice (simplicité, 3 lieux) |
| `Phase-2-0-decisions-architecture.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Acte décisions Phase 2.0 |
| `MOM-Core-Synthese-globale-v2.md` | `1X0FjB6Z9eVlxH0VcEQ4le2wf8eCMmmly` | Synthèse globale modèle |
| `MOM-Core-Cartographie-Globale-v2.md` | `1N2I86T751XneQT9fx1wCQWusmeCz235T` | Cartographie complète |
| `Doctrine-Import-OVAL-E-v1.1.md` | `1puTaNLXno99T4C9ECkEIgi1YGbk6bE41` | Doctrine import licences FFR — v1.1 historique |
| `Doctrine-Import-OVAL-E-v1.2.md` | (dans `00 - Documentation/`) | Doctrine — v1.2 (11 mai 2026) |
| `Doctrine-Import-OVAL-E-v1.3.md` | (dans `00 - Documentation/`) | Doctrine — v1.3 (11 mai 2026) |
| **`Doctrine-Import-OVAL-E-v1.4.md`** | `1Va9h9lQVIXHmPfTRK0s5ZuoQoGAy3dwQ` | **Doctrine — v1.4 (13 mai 2026 matin)** canonique, ajoute `licencie_externe_partenaire` + §11.7 dédié aux partenaires d'entente. Résout C7. |
| `Conception-Portail-Phase-3.md` | `12xrICwk5NTzk1XZLpq964CkWwhft3zc2` | Conception portail Phase 3 (12 mai 2026) |
| `Audit-Referentiels-v1.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Audit des 6 référentiels métier (11 mai 2026) |
| `Schema-cible-Supabase-aptitudes.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Pattern Drive → Supabase (12 mai 2026) |
| `Modelisation-Evenements-v1.0.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Modélisation événements v1.0 — superseded par v1.1 |
| `Modelisation-Evenements-v1.1.md` | `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u` | **Modélisation événements v1.1 (12 mai soir)** — référence canonique. Implémentée intégralement en Phases 4.1.B + 4.2 + 4.3. |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit module Compos — v2 historique |
| **`Audit-Module-Compositions-v3.md`** | `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ` | **Audit module Compos — v3 (13 mai 2026 matin)** — révision post-Phase 4.3. 3 décalages structurels résolus, 4 statuts cycle de vie. Ouvre dette C8. |
| `Audit-Module-Suivi-Match.md` | `1i9ba9foFHzZ9ggfbVwmsHwqp7tF41yTD` | À reprendre post-Phase 4.3 (recommandation forte) |
| `Audit-Module-Rapport.md` | — | À reprendre post-modélisation événements |
| `Audit-Module-Statistiques.md` | `1z1xWDOL9T-qNyY-C_P5E4CNt08wXZcoP` | À reprendre post-Phase 4.3 |
| `Audit-Module-Bilans.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit Personnes — v1.0 historique |
| `Audit-Personnes-MOM-Hub-v1.1.md` | `1sf6UMb1dPvh9znfDoUw6duGkLR7GLFtA` | Audit Personnes — v1.1 (11 mai 2026) |
| **`Audit-Personnes-MOM-Hub-v1.2.md`** | `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA` | **Audit Personnes — v1.2 (13 mai 2026 matin)** — étend à 5 profils. Résout C7-b. |
| **`Audit-OVAL-E-Joueurs-Partenaires-v1.md`** | `12_akokLYOUpyk-_CKIkW5H8WzvleEqiO` | **Audit C7 (13 mai 2026 matin)** — doctrine de représentation des joueurs SAR/ASCS d'entente. |
| `Registre-anomalies-OVAL-E.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Registre des anomalies de réconciliation FFR |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h`
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE`

---

## 🚀 Prochaine session

**Avant de démarrer toute session** :
1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Lire `Modelisation-Evenements-v1.1.md` (référence canonique implémentée en Phases 4.1.B + 4.2 + 4.3)
4. Vérifier que la chaîne Hub → Supabase fonctionne toujours (`https://manu-mom.github.io/mom-hub/`, F12 console)
5. Vérifier que le portail affiche bien **323 personnes**, **11 équipes**, le surtitre greeting J-N contextualisé, et la carte sidebar "Prochain événement M14"

**Travaux en attente** :

- **Conv Production** : Phases 1 à 4.3 + Étapes G/K/H + Phase 4.4 widget+greeting + C8-a/b/c + session RLS write groupée terminées. **Phase 4.4 UI éditeur de compo entièrement débloquée côté backend.** Prochain travail :
  - **Cycle Conception UX dédié** à mener côté conv Conception Portail avant de coder l'UI éditeur de compo (spec UX des 8 écrans, drag-and-drop vs picklist, Vue Comparaison base vs match, multi-mode Complet/Réduit/EDR, workflow verrouillage).
  - **(o) Wrapper JS `getVivierCompo()`** : préalable Phase 4.4 UI.
  - **(p) Test E2E** : à faire au passage Phase 4.4.
  - **C7-c (statut à confirmer)** : ALTER CHECK constraint, ~5 min. À vérifier : la valeur `licencie_externe_partenaire` est-elle autorisée dans le CHECK ?
  - **C7-f (préalable opérationnel)** : choisir canal d'import des fiches partenaires (Excel manuel recommandé pour démarrer).
  - **(m) Correction post-import ASCS** + **(n) Complétion sexe/date_naissance partenaires** : ouverts.
  - **C8-d** : extension CHECK `etat` (ajout `archivee`, renommage `jouee` optionnel). Non bloquant, avant fin saison.
  - **M-1** : ALTER `personnes` bloc_5 categorie_surclassement_id. Trivial, à exécuter dès qu'un cas surclassé sera identifié.
  - Phase 4.5 (API distances OpenRouteService) : reportée, non-critique.
  - **(q)** : durcissement futur Option A (table `coach_equipes`) quand un 2e coach réel arrivera.

- **Conv Audits** : **Dettes C7 et C8 totalement soldées côté Audits.** Travaux restants par priorité :
  - **Reprise audit Suivi-Match + résolution dette C3** (recommandation forte) : Suivi-Match est le prochain module à construire ; C3 (modélisation observables-match en table SQL dédiée) profite autant à Suivi-Match qu'à la conv Modules Ateliers. Pré-requis levés : C8-c livré (`etat_joueur='blesse'` = écriture exceptionnelle Suivi Match).
  - Audits Rapport / Stats / Bilans post-Phase 4.3.
  - Lots 2 et 3 audit référentiels (bloqués par tiers).
  - Modélisation événements extra-sportifs (C2, Phase 5).
  - Modélisation compo adverse + joueurs adverses (C1, reportée après usage réel).

- **Conv Conception Portail** : à rouvrir pour cycle UX dédié de l'**éditeur de compo Phase 4.4**. Input principal : `Audit-Module-Compositions-v3 §4`.

- **Conv Modules Ateliers** (à démarrer si pas déjà fait) : message de kick-off préparé avec 3 questions de cadrage Q1/Q2/Q3.

- **Conv Suivi Match** (à ouvrir, recommandation forte) : module à construire. Audit doctrine v2 existant à reprendre. Dette C3 à instruire.
