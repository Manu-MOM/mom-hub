# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 14 mai 2026 soir — Phase 4.3 (compositions/présences/RPC vivier) + dette C8-a/b/c TERMINÉES. 7 fichiers SQL livrés : sql/17 (39 attaches partenaires), sql/17b (fix categorie_id partenaires), sql/18 (compositions + composition_joueurs), sql/19 (presences), sql/21 (RPC get_vivier_compo), sql/22 (ALTER compositions ADD type_compo + compo_base_origine_id — C8-a/b), sql/23 (ALTER composition_joueurs ADD etat_joueur — C8-c). sql/20 (M-1 ALTER personnes bloc_5.categorie_surclassement_id) volontairement sauté en numérotation — reste dette ouverte. RPC validée par smoke test sur M14 EQ1 : 63 joueurs vivier / 62 réguliers (23 MOM + 39 partenaires SAR/ASCS) / 8 F-15 intégrées / 1 non-attaché. C7-e soldée naturellement par la RPC. C8-d (extension CHECK etat) et C8-e (RLS write compositions) restent dettes ouvertes non bloquantes. Phase 4.4 (éditeur UI compo) débloquée côté backend, préalable Conception (cycle UX dédié) à mener côté Audits.**

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
| **Supabase** `mom-hub` (free tier) | Source de vérité des **données vivantes** (personnes, événements, présences, compositions, etc.) | 12 tables (Vague 1 + noyau événements + compositions/présences), fonctions RPC, RLS |

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
- 6 dettes Axe B D1-D6 soldées (cf. registre-anomalies-OVAL-E + Audit-Personnes v1.1)
- Base finale : 323 lignes Supabase dont 298 licenciées FFR alignées OVAL-E

### ✅ Phase 2.5 — Authentification (FAIT — 11 mai 2026)
- Login Magic Link Supabase Auth opérationnel
- Table `auth_roles` (admin / coach / viewer) + 1 admin actif (Manu)
- Helpers `requireAuth()` / `isAdmin()` / `signOut()`
- Page `dashboard.html` admin
- Boutons d'auth intégrés au portail

### ✅ Phase 3 — Refonte portail + topbar partagée (FAIT — 12 mai 2026)

Travail livré ce 12 mai en deux temps (factorisation CSS puis refonte du contenu).

- **Phase 3 partie 1/2 (factorisation CSS + topbar partagée)** : création de `css/hub.css` (palette canonique, polices, reset, topbar Hub partagée, états d'auth, classes utilitaires).
- **Phase 3 partie 2/2 (refonte portail)** : refonte de la zone sous-bandeau d'`index.html`. Greeting recontextualisé, 4 KPI repensés, 5 sections avec sous-titres éditoriaux italique, sidebar 3 cartes, retrait du panneau ÉTAT DU HUB.

### ✅ Phase 4.1.B — Sites et distances (FAIT — 12 mai 2026 soir)
- Tables `sites` et `distances_sites` créées via `sql/07-sites.sql`
- 3 sites peuplés : Brencklé, Clubhouse, Holtzplatz (tous MOM)
- API distances (OpenRouteService) reportée à Phase 4.5 (optionnel)

### ✅ Phase 4.1.A — Peuplement Vague 1 + K2 ÉQUIPES dynamique (FAIT — 13 mai 2026)
- **Peuplement via `sql/06-peuplement-vague1-equipes.sql`** :
  - 11 ententes (3 Permanente SAR/MOM/ASCS M14/M16/M19 + 8 Solo MOM)
  - 11 équipes
  - 23 attaches `equipe_joueurs` M14 MOM en statut `regulier` (17 garçons + 6 F-15 intégrées)
- Coach M14 = Emmanuel JUNG (référent ET coach principal)
- SAR (37) et ASCS (2) M14 attaches **reportées** à Phase 4.3 (dette C7)
- **Phase 4.1.A bis — K2 ÉQUIPES bascule en dynamique** : RPC `count_equipes_actives()`, `js/dashboard-stats.js` v2.1
- Ferme **totalement** la dette #5

### ✅ Phase 4.2.A — Noyau événements (FAIT — 13 mai 2026 soir)
- **`sql/10-noyau-evenements.sql`** : création des 2 tables modélisées dans `Modelisation-Evenements-v1.1.md` §4.2 et §4.7
  - `evenements` (28 colonnes)
  - `evenement_encadrants` (9 colonnes : encadrement multi-rôles via `roles_encadrement TEXT[]`)
  - 13 indexes au total
  - 8 contraintes CHECK
  - Trigger `set_updated_at` réutilisant la fonction Vague 1 `trigger_set_updated_at()`
- **Choix doctrinaux validés** : naming `_id`, code manuel à l'INSERT, RLS SELECT authenticated.

### ✅ Phase 4.2.B — RPC événements (FAIT — 13 mai 2026 soir tard)
- **`sql/11-rpc-evenements.sql`** : 2 RPC SECURITY DEFINER, authenticated-only
  - `get_evenements_a_venir(p_equipe_id UUID DEFAULT NULL, p_jours_a_venir INTEGER DEFAULT 30)`
  - `get_prochain_evenement_par_equipe(p_equipe_id UUID)`
- **Test fonctionnel 8 scénarios validé en prod**.

### ✅ Phase 4.2.C — Wrappers JS v1.5 (FAIT — 13 mai 2026 soir tard)
- **`js/supabase-client.js` v1.4 → v1.5** : 2 méthodes ajoutées
  - `SupabaseHub.getEvenementsAVenir(equipeId = null, joursAVenir = 30)`
  - `SupabaseHub.getProchainEvenementParEquipe(equipeId)`

### ✅ Étape G — Peuplement événements M14 réels (FAIT — 13 mai 2026 vraiment très tard)
- **`sql/12-evenements-saison-2025-2026.sql`** : 4 événements M14 saison 2025-2026 importés depuis sarmom-compos :
  - `EVT-2026-05-02-FRANKFURT-M14` (tournoi passé, À 13)
  - `EVT-2026-05-09-J5-ECLR-M14` (journée championnat passée, XV, victoire 41-7)
  - `EVT-2026-05-23-LES-GEMMEURS-M14` (tournoi à venir)
  - `EVT-2026-06-07-CHALLENGE-VIE-M14` (tournoi à venir, finale régionale)
- **Découverte d'une dette annexe (k)** : pas de policy SELECT `authenticated` sur `equipes`. Résolue Étape K.

### ✅ Étape K — Policies RLS SELECT Vague 1 (FAIT — 13 mai 2026, ferme dette k)
- **`sql/13-rls-read-vague1.sql`** : 3 policies `SELECT TO authenticated USING (true)` sur ententes, equipes, equipe_joueurs.
- `personnes` **volontairement non touchée** : doctrine RGPD = accès via RPC uniquement.

### ✅ Étape H — 15 entraînements M14 fin de saison (FAIT — 13 mai 2026)
- **`sql/14-entrainements-m14-fin-saison-2025-2026.sql`** : 15 entraînements M14 hebdomadaires (LUNDI 18h00-19h15 + MERCREDI 14h00-16h00 à Brencklé) entre le 13 mai et le 1er juillet 2026.
- 14 en `creation`, 1 en `annule` (Pentecôte).

### ✅ Phase 4.4 Étape C — Widget "Prochain événement M14" en sidebar (FAIT — 13 mai 2026, fin de session)
- **`index.html`** : nouvelle carte `.sb-card` insérée entre carte 2 et 3.
- **`js/dashboard-stats.js` v2.1 → v2.2** : 8e appel `Promise.all`, calcul du label temporel en **jours CIVILS** côté JS (`AUJOURD'HUI` / `DEMAIN` / `DANS N JOURS`).
- **Phase 4.4 (UI portail) TERMINÉE** pour la partie "widget prochain événement". Greeting J-N (P4-2) reste à faire dans une session future.

### ✅ Phase 4.3 — Compositions, présences, RPC vivier + dette C8 (FAIT — 14 mai 2026)

Session de ~2h30, 7 fichiers SQL livrés. sql/20 sauté (M-1 dette ouverte).

**Livrables SQL Phase 4.3 (bloc initial, 5 fichiers)** :

- **`sql/17-attaches-partenaires-entente-m14.sql`** : 39 attaches `equipe_joueurs` pour les joueurs partenaires SAR/ASCS importés via sql/16. Statut `regulier`, `club_provenance_id = SAR` par défaut (distinction ASCS reportée à dette (m)). Total attaches actives M14 EQ1 : **62** (23 MOM + 39 partenaires). Idempotent via `WHERE NOT EXISTS`.
- **`sql/17b-fix-categorie-partenaires.sql`** : correctif post-sql/16 — les 39 joueurs partenaires avaient `categorie_id = NULL` (l'export SportEasy ne contenait pas la catégorie d'âge). UPDATE categorie_id = M14 sur les 39 joueurs. Les 11 staff/coaches partenaires restent à NULL (cohérent métier). Découvert lors du smoke test sql/21.
- **`sql/18-compositions.sql`** : tables `compositions` (11 colonnes initiales, états `brouillon`/`validee`/`jouee`, versioning via `est_active` + index unique partiel) et `composition_joueurs` (10 colonnes initiales, FK `joueur_id` vers `personnes` sans polymorphisme depuis abandon v1.1, UNIQUE titulaire par poste via index partiel, flag `est_depannage_hors_categorie`). 9 indexes au total. RLS SELECT authenticated. Trigger `set_updated_at_compositions`.
- **`sql/19-presences.sql`** : table `presences` (11 colonnes, FK `personne_id` unifiée MOM/partenaires/encadrants depuis C7, statuts `present`/`absent`/`present_partiel`, lien optionnel `composition_joueur_id` pour requêter "convoqué vs venu", UNIQUE (`evenement_id`, `personne_id`)). 6 indexes. RLS SELECT authenticated. Trigger `set_updated_at_presences`.
- **`sql/21-rpc-vivier-compo.sql`** : RPC `get_vivier_compo(p_equipe_id UUID)` SECURITY DEFINER authenticated-only, 15 colonnes retournées (IDs + libellés humains + flags `est_partenaire_entente`/`f15_integree` + `statut_attache` via LEFT JOIN `equipe_joueurs`). Pivot `equipes.entente_id → ententes.categorie_id`. Filtre `categorie_personne='joueur'` + (`categorie_id` match OR `f15_integree=TRUE` pour M14 uniquement). Ordre : réguliers > renforts > en_transition > non-attachés. TODO M-1 commenté pour filtre surclassés.

**Smoke test RPC** (M14 EQ1) : total **63** / réguliers **62** / partenaires **39** / f15 **8** / non_attachés **1**. Contrats métier OK.

**Livrables SQL dette C8 (bloc additionnel post-Audits, 2 fichiers)** :

- **`sql/22-alter-compositions-c8.sql`** : C8-a + C8-b. Ajoute `type_compo` TEXT NOT NULL DEFAULT `'match'` CHECK IN (`base`,`match`) — distingue compo de base (plan A J-7) vs compo de match (J-0). Ajoute `compo_base_origine_id` UUID NULL REFERENCES `compositions(id)` (auto-FK) — trace la dérivation compo de match ← compo de base, permet Vue Comparaison Phase 4.4. CHECK additionnel garantit que `compo_base_origine_id IS NULL OR type_compo = 'match'`. Index partiel `idx_compositions_origine` sur les compos dérivées. Table `compositions` passe à 13 colonnes / 5 CHECK explicites / 5 indexes.
- **`sql/23-alter-composition-joueurs-c8.sql`** : C8-c. Ajoute `etat_joueur` TEXT NOT NULL DEFAULT `'base'` CHECK IN (`base`,`modifie`,`independant`,`blesse`) — matérialise les 4 couleurs de l'éditeur SAR×MOM Compos hérité (bleu/orange/vert/rouge). Aussi support de l'écriture exceptionnelle Suivi Match (signalement blessé depuis la table de marque). Index partiel `idx_composition_joueurs_blesses` (WHERE etat_joueur='blesse') pour requête fréquente UI. Table `composition_joueurs` passe à 11 colonnes / 2 CHECK explicites / 6 indexes.

**Décisions doctrinales tranchées en session** :

- **États compositions** : `brouillon` / `validee` / `jouee` retenu (fidélité doctrine v1.1 §4.3). Extension `archivee` reportée à C8-d.
- **Transition automatique `evenements.etat: creation → compo`** : reportée. Pas de trigger SQL pour démarrer. P3 itération.
- **Test bout-en-bout** : reporté à Phase 4.4. Le test E2E (BEGIN/INSERT/ROLLBACK) a été préparé mais bloqué par un comportement de l'éditeur Supabase (Explain forcé sur multi-statements). Sera de toute façon exercé pour de bon par l'UI éditeur de compo en Phase 4.4.

**C7-e levée naturellement** : la RPC `get_vivier_compo` inclut sans jointure spéciale les `licencie_externe_partenaire` rattachés via `equipe_joueurs` — comme prévu doc §10.1.

**Dette doctrinale découverte (résolue en séance)** : le script sql/16 importait les fiches SportEasy sans `categorie_id` (champ absent de l'export brut). Pour les futurs imports SportEasy partenaires (M16, M18, autres saisons), prévoir le UPDATE `categorie_id` dans le script d'import lui-même, pas en post-correctif. À retenir pour le pattern de scripts d'import futurs.

---

## 🔧 Pattern technique acquis (Phase 2.4)

Pour toute donnée Supabase à afficher dans le Hub :

1. **Côté Supabase** : créer une **fonction RPC `SECURITY DEFINER`** qui retourne uniquement les chiffres agrégés nécessaires (pas de données perso brutes).
   ```sql
   CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
   RETURNS json
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
     -- agrégats safe : count, sum, etc. PAS de SELECT * FROM personnes
   $$;
   ```
2. **RLS strict sur la table** : pas de policy SELECT pour `anon` (compteur via RPC seulement).
3. **Côté Hub** : utiliser `supabaseClient.fetchData('rpc/<fn_name>', { method: 'POST', body: {} })`.
4. **Fallback gracieux** : si la RPC échoue, garder les chiffres statiques en place et logger l'erreur en console.

Ce pattern doit être appliqué à toute future statistique du portail (événements, présences, etc.).

---

## 🔄 Doctrine Réconciliation OVAL-E (sources de vérité)

Documents de référence (Drive `00 - Documentation/`) :
- `Doctrine-Import-OVAL-E-v1.4.md` (canonique, 14 mai 2026) — §13 architecture sources, §14 mapping qualités FFR (8 valeurs dont `licencie_externe_partenaire`), §11.7 partenaires d'entente
- `Doctrine-Import-OVAL-E-v1.3.md` à `v1.1.md` (conservées pour traçabilité)
- `Audit-Personnes-MOM-Hub-v1.2.md` (14 mai 2026) — 5 profils dont partenaires d'entente, §6 dédiée
- `Audit-OVAL-E-Joueurs-Partenaires-v1.md` (14 mai 2026) — doctrine C7
- `Audit-Module-Compositions-v3.md` (14 mai 2026 soir) — révision post-Phase 4.3, ouvre dette C8
- `Registre-anomalies-OVAL-E.md` — anomalie #1 ALTUN MURAT archivée

**Architecture des sources de vérité (§13 doctrine v1.4)** :
- **Drive figé au 10 mai 2026** pour la saison 2025-2026 (`01 - Référentiels/personnes/`) — utilisable comme **archive**
- **Supabase autoritatif** pour les données vivantes des personnes (323 fiches MOM + 50 partenaires)
- **OVAL-E export FFR** = source externe pour réconciliation annuelle/saisonnière
- Décision saison 2026-2027 reportée à l'été 2026 (nouveau cycle d'export OVAL-E)

**Mapping qualités FFR → type_personne (§14 doctrine v1.4)** : 5 valeurs licenciées MOM (`licencie_joueur`, `licencie_dirigeant`, `licencie_educateur`, `licencie_soigneur`, `licencie_arbitre`) + `non_licencie` + `non_licencie_au_mom` + **`licencie_externe_partenaire`** (8e valeur, ajoutée 14 mai pour les partenaires d'entente SAR/ASCS). CHECK constraint Supabase mise à jour via `sql/15-alter-type-personne-c7c.sql`.

---

## 🔁 Pipeline réconciliation OVAL-E (à pérenniser)

Pipeline en 4 chantiers (C1-C4) prêt à rejouer chaque saison :

- **C1** : Hygiène générale (rétro-import doublons, normalisation casse)
- **C2** : Alignement OVAL-E (insert manquants, update mismatches)
- **C3** : Conformité doctrinale (type_personne, qualités, statut FFR)
- **C4** : Audit final (croisement Drive ↔ Supabase ↔ OVAL-E)

**SQL scripts C1/C2/C3/C4** : **NON commit dans repo public** (contiennent des données perso). Archivés local + Drive.

Pipeline complet documenté dans `Doctrine-Import-OVAL-E-v1.4.md §11`.

```
OVAL-E export (XLSX) ── parse ──> normalisation ──> upsert idempotent
                                       │
                                       ↓
                              audit anomalies → registre
```

À rejouer chaque saison avec un nouvel export OVAL-E.

---

## 🩹 Dettes techniques à traiter

### ✅ Dettes résolues le 11 mai 2026 (Phase 2.4.5)

1. ~~**Écart 293 vs 294 personnes**~~ ✅ **RÉSOLU**
2. ~~**Écart 24 vs 23 M14**~~ ✅ **RÉSOLU** : Supabase a 24 M14 = 16 M-14 + 8 F-15 intégrées.

### 🟡 Dettes encore actives

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Pas bloquant tant qu'on ne ré-importe pas, à corriger pour la Vague 2.
4. **Référentiels Drive `01 - Référentiels/`** ⚠️ **PARTIELLEMENT RÉSOLU** : Lot 1 cohérence structurelle soldé le 12 mai 2026 matin. **Reste ouvert (Lots 2 et 3)** : couverture catégorielle F-18/F+18, peuplement métier ateliers/aptitudes EDR/barèmes physiques. Bloqué par dépendances externes (règlement LRGER 2025-2026, Lohann, préparateur physique).
5. ✅ ~~**Chiffres en dur résiduels dans index.html**~~ — **TOTALEMENT RÉSOLUE 13 mai 2026**.
6. ~~**Date `VENDREDI 8 MAI 2026` dans le HTML statique**~~ ✅ **RÉSOLU** (11 mai 2026).
7. ~~**Désalignement Drive ↔ Supabase post-réconciliation OVAL-E**~~ ✅ **ARBITRÉ** (11 mai 2026).
8. ✅ **CHECK constraint `personnes_type_personne_check`** **RÉSOLUE 12 mai soir** (ajout `licencie_soigneur` + `licencie_arbitre` via sql/08), puis **étendue 14 mai** par C7-c (ajout `licencie_externe_partenaire` via sql/15).

### 🔵 Dettes ouvertes par la Phase 2.5

9. ~~**Architecture du portail à revoir**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2).
10. ~~**Panneau "État du Hub" sidebar**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2).
11. ~~**CSS dupliqué**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.1).
12. **Mini-déséquilibre `<div>` ouverts/fermés dans `index.html`** (1 div fermante manquante). Tolérée par les navigateurs, sans impact visuel. À nettoyer plus tard.
13. **Allow new users to sign up = ON dans Supabase Auth** : à terme passer à OFF. À traiter quand les autres rôles seront déployés.

### ✅ Dette résolue le 12 mai 2026 (conv Audits — modélisation événements)

14. ~~**Modélisation entités événements / compositions / présences**~~ ✅ **RÉSOLU** (12 mai 2026, conv Audits) : `Modelisation-Evenements-v1.1.md` publié. **Implémentation Phase 4.2.A à 4.3 livrée intégralement au 14 mai 2026 soir.**

### 🔵 Dettes ouvertes par la Phase 3

P4-1. **Adaptation portail par rôle** (`coach`, `viewer`) : quand des comptes réels existeront.

P4-2. **Greeting contextualisé `J-N AVANT MATCH`** ⚠️ **DÉBLOQUÉ** (12 mai 2026) : RPC en place. Reste l'UI à brancher dans une session future.

P4-3. **KPI ou widget « prochain match »** ✅ **LIVRÉ partie widget** (13 mai 2026, Phase 4.4 Étape C). Greeting reste à faire.

P4-4. **Sync SportEasy automatisée** : Hors périmètre actuel.

P4-5. **Greeting mode anonyme à préciser** : à traiter avec compte `viewer` réel.

P4-6. **Personnalisation des `RACCOURCIS` (sidebar carte 3)** : à terme.

P4-7. **Outil de listing filtré des fiches** : à terme.

### 🔵 Dettes ouvertes par la modélisation événements (12 mai 2026 — conv Audits)

M-1. **ALTER TABLE personnes — bloc_5** 🟡 **RÉDUIT en v1.1 + DEMI-CONFIRMÉ 14 mai 2026** : ajouter `categorie_surclassement_id UUID NULL REFERENCES categories(id)` pour tracer les surclassements officiels. Structure de `personnes` **confirmée** comme colonnes plates (pas de JSONB sur bloc_5, cf. SELECT info_schema 14 mai : `categorie_id`, `club_principal_id`, `f15_integree` sont des colonnes individuelles). Donc l'ALTER TABLE est trivial : `ALTER TABLE personnes ADD COLUMN categorie_surclassement_id UUID REFERENCES categories(id);` + UPDATE ciblé sur les fiches concernées. Reste à exécuter quand Manu identifiera les joueurs surclassés (probablement 0 à ce jour pour M14). **Préalable** à l'activation du filtre surclassés dans `get_vivier_compo` (actuellement commenté `TODO M-1` dans sql/21). Priorité : faible (cas marginal).

M-2. **Intégration API d'itinéraire + cache `distances_sites`** : OpenRouteService (free tier). Priorité moyenne.

M-3. **Migration future Drive → Supabase de `groupes-joueur.json`** : quand l'onglet paramètres sera implémenté. Priorité faible.

M-4. **Onglet paramètres pour édition admin** des référentiels. Lié à M-3. Priorité faible.

M-5. **RPC `get_distance_between_sites(origine_id, destination_id)`** : wrapper côté serveur. Lié à M-2.

C7. ✅ **Audit doctrine OVAL-E sur joueurs partenaires d'entente** — **TOTALEMENT SOLDÉE 14 mai 2026** :
   - C7-a livrée (Audit-OVAL-E-Joueurs-Partenaires v1)
   - C7-b livrée (Audit-Personnes-MOM-Hub v1.2)
   - C7-c livrée (sql/15 ALTER CHECK)
   - C7-e ✅ **LIVRÉE 14 mai 2026** (Phase 4.3) : RPC `get_vivier_compo` (`sql/21-rpc-vivier-compo.sql`) inclut naturellement les `licencie_externe_partenaire` via LEFT JOIN `equipe_joueurs` filtré par `equipe_id`. Aucune jointure spéciale. Smoke test : 39 partenaires SAR retournés avec `est_partenaire_entente = TRUE`.
   - C7-f livrée (sql/16 import 50 fiches partenaires)
   - C7-d (RLS write joueurs partenaires) reste à grouper avec dette (i)
   - C7-g (passerelle OVAL-E FFR) reste long terme
   - C7-h (workflow changement club) reste à l'usage

### 🔵 Dettes en cascade ouvertes par C8 (Audit-Module-Compositions-v3, 14 mai 2026 soir)

C8-a. ✅ **LIVRÉE 14 mai 2026 soir** — `sql/22-alter-compositions-c8.sql` : ALTER `compositions` ADD `type_compo` TEXT NOT NULL DEFAULT 'match' CHECK IN ('base', 'match'). Distingue compo de base (plan A J-7) vs compo de match (J-0). Côté **conv Production**.

C8-b. ✅ **LIVRÉE 14 mai 2026 soir** — `sql/22-alter-compositions-c8.sql` : ALTER `compositions` ADD `compo_base_origine_id` UUID NULL REFERENCES compositions(id). Trace la dérivation compo de match ← compo de base. CHECK additionnel garantit que seules les compos de type 'match' peuvent avoir une origine. Index partiel `idx_compositions_origine`. Côté **conv Production**.

C8-c. ✅ **LIVRÉE 14 mai 2026 soir** — `sql/23-alter-composition-joueurs-c8.sql` : ALTER `composition_joueurs` ADD `etat_joueur` TEXT NOT NULL DEFAULT 'base' CHECK IN ('base', 'modifie', 'independant', 'blesse'). Matérialise les 4 couleurs de l'éditeur (bleu/orange/vert/rouge). Aussi support de l'écriture exceptionnelle 'blesse' depuis Suivi Match. Index partiel `idx_composition_joueurs_blesses`. Côté **conv Production**.

C8-d. 🟡 **Extension CHECK `compositions_etat_check`** pour ajouter `archivee`. Optionnellement renommer `jouee` → `utilisee` (Option A) ou garder `jouee` (Option B). Non bloquant, à traiter avant fin saison 2025-2026. Côté **conv Production**.

C8-e. 🟡 **Policies RLS write par rôle sur `compositions` et `composition_joueurs`**. À grouper avec dette (i) et C7-d. Matrice de droits dans `Audit-Module-Compositions-v3 §1.3`. Côté **conv Production**.

### 🔵 Dettes techniques mineures variées

(c) **Mirror `groupes-joueur.json` v1.1** dans `data/` une fois déposé dans Drive.

(f) Déploiement comptes `coach` et `viewer` réels (préalable à P4-1).

(g) **D-qualite-ffr-array** : migration future `personnes.qualite_ffr` TEXT → ARRAY. À grouper avec import OVAL-E été 2026.

(h) **Compteur K3 CETTE SEMAINE biaisé jusqu'au 17 mai 2026** : la RPC `count_personnes_created_last_7_days` retourne actuellement 323. Effet de jeunesse de la base, retombera mécaniquement après 7 jours glissants. Pas un bug.

(i) **Dette ouverte — policies RLS write par rôle** : `evenements`, `evenement_encadrants`, `equipes`, `equipe_joueurs`, `compositions`, `composition_joueurs`, `presences` ont actuellement RLS activée mais seules les policies SELECT pour `authenticated` sont définies. Aucune policy write n'existe → seul le `service_role` peut INSERT/UPDATE/DELETE. À durcir dans une session dédiée : policies write basées sur `auth_roles` (admin/coach/viewer) avec règles métier. **À grouper avec C7-d, C8-e et dette (l).**

(j) **Leçon doctrinale Claude (13 mai très tard) — anti-invention** : avant de citer un détail factuel (nombre, code, nom de champ/site/objet), faire un `web_fetch` sur le fichier du repo OU un DRY-RUN sur Supabase. Doctrine OVAL-E §13 (Supabase autoritatif) s'applique aussi à Claude.

(l) **Durcissement RLS WRITE distances_sites** : table autorise actuellement INSERT/UPDATE à tout `authenticated`. À regrouper avec dette (i).

(m) **Correction post-import ASCS** : les 50 fiches partenaires sql/16 sont TOUTES taggées `club_principal_id = SAR`. UPDATE ciblé à faire `club_principal_id = ASCS` quand Manu fournira la liste exacte des joueurs ASCS dans l'entente M14.

(n) **Complétion sexe + date_naissance partenaires** : sur les 50 fiches, 50/50 ont `sexe = NULL` et 23/50 ont `date_naissance = NULL`. Utiliser gabarit Excel `gabarit-effectif-partenaire-entente-mom-v1.xlsx`.

(o) **🆕 Wrapper JS `getVivierCompo()` à créer** : pendant Phase 4.4 (UI éditeur de compo). La RPC `get_vivier_compo` est en place côté Supabase mais pas encore exposée dans `js/supabase-client.js`. Pattern : suivre `getProchainEvenementParEquipe()` (Phase 4.2.C). À grouper avec le développement de l'écran de composition.

(p) **🆕 Test bout-en-bout Phase 4.3 reporté à Phase 4.4** : le test SQL (BEGIN/INSERT compo + joueurs + presences/ROLLBACK) a été préparé mais l'éditeur Supabase forçait l'Explain sur multi-statements. Sera de toute façon exercé pour de bon par l'UI éditeur de compo Phase 4.4.

### 🔵 Dette technique mineure ouverte par Phase 3

P3-mineure-1. ✅ **RÉSOLU (12 mai 2026 soir)** — Logo M2M externalisé.

P3-mineure-2. ✅ **RÉSOLU** — `sql/04-auth-roles.sql` déplacé.

---

## 📂 Structure repo finale

```
mom-hub/
├── .github/workflows/keep-alive-supabase.yml
├── assets/
│   └── logo-m2m.png
├── css/
│   └── hub.css                              # palette + topbar partagée + utilitaires
├── data/                                    # miroir lecture seule des référentiels Drive
│   ├── aptitudes.json
│   ├── ateliers.json
│   ├── conformite-ffr.json
│   ├── observables-match.json
│   ├── postes.json
│   ├── tests-physiques.json
│   └── (groupes-joueur.json à mirroir post upload Drive)
├── js/
│   ├── data-loader.js                       # ancien loader des référentiels statiques
│   ├── supabase-client.js                   # v1.5 — 2 wrappers événements
│   └── dashboard-stats.js                   # v2.2 — 8 sources dynamiques
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
│   └── 23-alter-composition-joueurs-c8.sql
│   # NB: sql/20 sauté (M-1 ALTER personnes bloc_5, dette ouverte)
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit (données perso)
├── index.html                               # portail dynamique
├── login.html
├── dashboard.html
├── test-supabase.html                       # page de diagnostic
├── README.md
├── STATE.md                                 # ← CE FICHIER
└── PASSATION.md                             # kit de démarrage par thématique
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
| `Doctrine-Import-OVAL-E-v1.4.md` | `1Va9h9lQVIXHmPfTRK0s5ZuoQoGAy3dwQ` | **Doctrine import licences FFR — v1.4 (14 mai 2026)** — canonique, ajoute `licencie_externe_partenaire` et §11.7. Résout C7. |
| `Doctrine-Import-OVAL-E-v1.3.md` | `11mwHCbfx2mkehktMzItqmXVkntFm7BCf` | Historique v1.3 (11 mai 2026) |
| `Doctrine-Import-OVAL-E-v1.2.md` | `1dUMeJZfbxSHhWT6Bn2diso1mwbhXMHJz` | Historique v1.2 |
| `Doctrine-Import-OVAL-E-v1.1.md` | `1puTaNLXno99T4C9ECkEIgi1YGbk6bE41` | Historique v1.1 |
| `Audit-OVAL-E-Joueurs-Partenaires-v1.md` | `12_akokLYOUpyk-_CKIkW5H8WzvleEqiO` | **Audit C7 (14 mai 2026)** — doctrine de représentation des joueurs SAR/ASCS d'entente. |
| `Conception-Portail-Phase-3.md` | `12xrICwk5NTzk1XZLpq964CkWwhft3zc2` | Conception portail Phase 3 livrée 12 mai 2026 |
| `Audit-Referentiels-v1.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Audit des 6 référentiels métier (11 mai 2026) |
| `Schema-cible-Supabase-aptitudes.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Pattern de migration Drive → Supabase |
| `Modelisation-Evenements-v1.1.md` | `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u` | **Modélisation événements v1.1 (12 mai soir)** — référence canonique Phase 4. Implémentée intégralement en Phase 4.2 + 4.3 au 14 mai. |
| `Modelisation-Evenements-v1.0.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | v1.0 superseded, conservée pour traçabilité |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit module Compos — v2 historique (10 mai 2026) |
| `Audit-Module-Compositions-v3.md` | `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ` | **Audit module Compos — v3 (14 mai 2026 soir)** — révision post-Phase 4.3. Ouvre dette C8. |
| `Audit-Module-Suivi-Match.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Module-Rapport.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Module-Statistiques.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Module-Bilans.md` | — | À reprendre post-Phase 4.3 |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit Personnes — v1.0 historique |
| `Audit-Personnes-MOM-Hub-v1.1.md` | `1sf6UMb1dPvh9znfDoUw6duGkLR7GLFtA` | Audit Personnes — v1.1 (11 mai) |
| `Audit-Personnes-MOM-Hub-v1.2.md` | `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA` | **Audit Personnes — v1.2 (14 mai 2026)** — 5 profils dont partenaires d'entente. Résout C7-b. |
| `Registre-anomalies-OVAL-E.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Registre des anomalies de réconciliation FFR |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h` (6 fichiers JSON existants + `groupes-joueur.json` à déposer)
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE`

---

## 🚀 Prochaine session

**Avant de démarrer toute Phase 4.4** :
1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Lire `Modelisation-Evenements-v1.1.md` + `Audit-Module-Compositions-v3.md` (référence canonique pour l'éditeur UI compo)
4. Vérifier que la chaîne Hub → Supabase fonctionne (console portail → `✅ MOM Hub Dashboard: stats mises à jour depuis Supabase` ET `🏉 MOM Hub · Supabase Client v1.5 chargé`)
5. Vérifier le widget "Prochain événement M14" en sidebar du portail
6. Vérifier que `login.html` envoie bien un Magic Link aboutissant sur `dashboard.html`

**Travaux en attente** :

- **Conv Production** : Phase 4.3 + dette C8-a/b/c **TERMINÉES (14 mai 2026 soir)**. **Backend Phase 4.4 entièrement débloqué.** Prochaines pistes par ordre d'impact :
  - **Phase 4.4 UI éditeur de compo** (impact métier majeur, préalable Conception requis : cycle UX dédié — 8 écrans à spécifier, drag-and-drop vs picklist, multi-mode Complet/Réduit/EDR, Vue Comparaison base vs match, workflow verrouillage cohérent avec `etat=validee`).
  - **Wrapper JS `getVivierCompo()`** (dette o, à grouper avec Phase 4.4 UI).
  - **Greeting J-N AVANT MATCH (P4-2)** : RPC et widget existent, reste l'UI greeting à brancher.
  - **Session RLS write par rôle groupée** (dettes i + C7-d + C8-e + l) : ~1-2h, débloque les écritures depuis le front authentifié.
  - **C8-d** : extension CHECK `etat` (ajout `archivee`). Non bloquant, avant fin saison.

  Récap implémentation modélisation événements v1.1 :
  - Vague 1 ✅ peuplée (13 mai)
  - Phase 4.1.B ✅ sites + distances_sites (3 sites MOM)
  - Phase 4.2.A ✅ evenements + evenement_encadrants
  - Phase 4.2.B ✅ 2 RPC événements
  - Phase 4.2.C ✅ Wrappers JS v1.5
  - Étape G ✅ 4 événements M14 réels
  - Étape K ✅ RLS read Vague 1
  - Étape H ✅ 15 entraînements M14
  - Phase 4.4 Étape C ✅ Widget Prochain événement
  - **Phase 4.3 ✅ compositions + composition_joueurs + presences + RPC get_vivier_compo (14 mai)**
  - **Dette C8 ✅ a/b/c (3 ALTER additifs post-Audits v3, 14 mai soir)**
  - Phase 4.5 (API distances) : optionnel, reporté
  - Phase 4.4 (UI portail) : widget livré, greeting + éditeur compo en attente

- **Conv Audits** : C7 + C8 TOTALEMENT SOLDÉES côté Audits. Travaux restants par ordre de priorité :
  - **Reprise audit Suivi-Match** (recommandation forte) à la lumière de Phase 4.3 livrée + dette C3 (modélisation observables-match en table SQL dédiée). Pré-requis : C8-c livré ✅ (`etat_joueur='blesse'` = support de l'écriture exceptionnelle depuis Suivi Match).
  - Audits Rapport, Stats, Bilans à reprendre post-Phase 4.3.
  - Lots 2 et 3 de l'audit référentiels (bloqués par tiers : règlement LRGER 2025-2026, Lohann, préparateur physique).
  - Modélisation **événements extra-sportifs** (C2, Phase 5).
  - Modélisation **compo adverse + joueurs adverses** (C1, reportée après usage réel).

- **Conv Conception Portail** : `Conception-Portail-Phase-3.md` v1.0 livrée. Pour Phase 4.4, rouvrir un cycle dédié pour spécifier l'UX éditeur de compo (input principal : Audit-Module-Compositions-v3 §4).

- **Conv Modules Ateliers** (à démarrer) : message kick-off à transmettre par Manu. 3 questions de cadrage à instruire en première session.

- **Conv Suivi Match** (à ouvrir, recommandation forte) : module à construire, audit v2 existant à reprendre, dette C3 (observables-match en table SQL) à instruire. Pré-requis C8-c livré ✅.

- **Futures conv Modules métier** annoncées : "MOM Hub - Modules Ateliers et ressources pédagogiques" et "MOM Hub - Modules Planification de la saison et préparation de séances". Point d'ancrage : `Modelisation-Evenements-v1.1.md` §10.3.
