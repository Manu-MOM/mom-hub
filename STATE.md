# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 14 mai 2026 (fin de journée) — Conv Audits a livré C7-a (Doctrine OVAL-E v1.4 + Audit-OVAL-E-Joueurs-Partenaires-v1), C7-b (Audit-Personnes v1.2), C8 (Audit-Module-Compositions-v3) ; Conv Production a livré Phase 4.3 (compositions + composition_joueurs + presences + RPC get_vivier_compo, 39 attaches partenaires SAR) puis C8-a/b/c (3 ALTER additifs préalables Phase 4.4 UI).**

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
| **Supabase** `mom-hub` (free tier) | Source de vérité des **données vivantes** (personnes, événements, présences, etc.) | 12 tables (9 Vague 1 + 3 Phase 4.2/4.3), fonctions RPC, RLS |

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

**Reste à faire (hors périmètre 2.5, reporté Phase 3)** : ergonomie du portail dans son ensemble — voir dette "Architecture portail".

### ✅ Phase 3 — Refonte portail + topbar partagée (FAIT — 12 mai 2026)

Travail livré ce 12 mai en deux temps (factorisation CSS puis refonte du contenu), guidé par le document de conception `Conception-Portail-Phase-3.md` v1.0 produit en amont par la conv « Conception Portail ».

- **Phase 3 partie 1/2 (factorisation CSS + topbar partagée)** : création de `css/hub.css` (palette canonique, polices, reset, topbar Hub partagée, états d'auth, classes utilitaires `.page-centered/.card/.btn/.feedback/.footer`). Adoption de la topbar Hub sur `index.html` (mode `fullscreen-app`), `login.html` (variante minimaliste), `dashboard.html` (variante admin complète).
- **Phase 3 partie 2/2 (refonte portail)** : refonte de la zone sous-bandeau d'`index.html` selon §2.2 à §2.5 du doc de conception. Greeting recontextualisé, 4 KPI repensés (2 vert stable + 2 ambre actions), 5 sections avec sous-titres éditoriaux italique, sidebar 3 cartes (OVAL-E / Qualité des données / Raccourcis), retrait du panneau ÉTAT DU HUB.

Détails techniques :
1. ✅ **3.1.A** — `css/hub.css` créé (482 lignes), `index.html` factorisé (-22%), `login.html` adopte topbar minimaliste (-27%), `dashboard.html` adopte topbar complète (-20%). 1 commit `Phase 3 (1/2) — factorisation CSS + topbar partagée (dette #11)`.

**Reste à faire (hors périmètre, reporté Phase 4)** : voir 7 dettes P4-1 à P4-7 ouvertes ci-dessous.

### ✅ Phase 4.1.B — Sites et distances (FAIT — 12 mai 2026 soir)
- Tables `sites` et `distances_sites` créées via `sql/07-sites.sql`
- 3 sites peuplés : Brencklé, Clubhouse, Holtzplatz (tous MOM — le `sql/07` ne contient que ces 3 INSERT)
- API distances (OpenRouteService) reportée à Phase 4.5 (optionnel)

### ✅ Phase 4.1.A — Peuplement Vague 1 + K2 ÉQUIPES dynamique (FAIT — 13 mai 2026)
- **Peuplement via `sql/06-peuplement-vague1-equipes.sql`** :
  - 11 ententes (3 Permanente SAR/MOM/ASCS M14/M16/M19 + 8 Solo MOM Sen.M, Sen.F, M12/M10/M8/M6 EDR, RLO=Rugby5, RLSP=Touch)
  - 11 équipes (1 par entente, `numero_equipe=1`, type `entente` ou `mono_club` selon cas)
  - 23 attaches `equipe_joueurs` M14 MOM en statut `regulier` (17 garçons + 6 F-15 intégrées, `club_provenance=MOM`)
- Coach M14 = Emmanuel JUNG (référent ET coach principal, confirmé 13 mai 2026)
- SAR (37) et ASCS (2) M14 attaches **reportées** à Phase 4.3 (après instruction dette C7)
- **Phase 4.1.A bis — K2 ÉQUIPES bascule en dynamique** :
  - Nouvelle RPC `count_equipes_actives()` (`sql/09-rpc-equipes.sql`, SECURITY DEFINER, authenticated-only)
  - `js/dashboard-stats.js` v2.1 : 7e appel Promise.all + `updateEl('stat-equipes', nbEquipes)`
  - `index.html` ligne 699 : `<div class="kpi-num" id="stat-equipes">…</div>` remplace le `11` en dur
  - Test prod validé : console `✅ MOM Hub Dashboard v2.1 ... { nbEquipes: 11 }`
- Ferme **totalement** la dette #5 (Phase 4.1.A bis du matin — voir note de correction dette #5 sur l'absence de KPI "Sites" dans le portail)

### ✅ Phase 4.2.A — Noyau événements (FAIT — 13 mai 2026 soir)
- **`sql/10-noyau-evenements.sql`** : création des 2 tables modélisées dans `Modelisation-Evenements-v1.1.md` §4.2 et §4.7
  - `evenements` (28 colonnes : id, code, libelle, type_evenement, type_competition, equipe_id, saison_id, format_de_jeu, date_debut/fin, site_id, organisateur_principal_id, evenement_parent_id, phase_libelle, ordre_dans_phase, etat, adversaire_nom, domicile_exterieur, score_mom/adverse, classement_final, notes_resultat, logistique_deplacement JSONB, notes_internes, métadonnées)
  - `evenement_encadrants` (9 colonnes : encadrement multi-rôles optionnel via `roles_encadrement TEXT[]`)
  - 13 indexes au total (7 explicites sur evenements + 2 explicites sur encadrants + 2 PK + 2 UNIQUE auto)
  - 8 contraintes CHECK sur evenements (type, competition, format, etat, domicile, equipe_obligatoire_si_pas_parent, format_obligatoire pour match/journee_championnat, dates_coherentes)
  - Trigger `set_updated_at` réutilisant la fonction Vague 1
- **Choix doctrinaux validés (13 mai 2026)** :
  - Naming `_id` partout (cohérence Vague 1, au lieu de `_uuid` du doc modélisation)
  - Code de l'événement = manuel à l'INSERT pour démarrer (P1 simplicité)
  - RLS : SELECT pour `authenticated`, write réservé `service_role` à ce stade (policies par rôle admin/coach/viewer à définir dans une session dédiée — **dette ouverte**)
- **Test INSERT factice + ROLLBACK validé en prod** : tables OK, FK OK (saisons/equipes/sites/personnes), CHECK OK.

### ✅ Phase 4.2.B — RPC événements (FAIT — 13 mai 2026 soir tard)
- **`sql/11-rpc-evenements.sql`** : création de 2 RPC SECURITY DEFINER, authenticated-only
  - `get_evenements_a_venir(p_equipe_id UUID DEFAULT NULL, p_jours_a_venir INTEGER DEFAULT 30)` → TABLE 16 colonnes (event + libellés joints equipe/site + delta jours)
  - `get_prochain_evenement_par_equipe(p_equipe_id UUID)` → wrapper de la 1re sur 365j LIMIT 1
- Conventions : paramètres préfixés `p_`, `p_equipe_id` NULL = toutes équipes, exclut états `annule`/`archive`, filtre `date_debut >= NOW()`.
- **Test fonctionnel 8 scénarios validé en prod** (INSERT factice + 6 appels RPC avec filtres variés + ROLLBACK propre).
- Débloque P4-2 (greeting "J-N AVANT MATCH") et P4-3 (widget sidebar) techniquement — reste l'UI à brancher.

### ✅ Phase 4.2.C — Wrappers JS v1.5 (FAIT — 13 mai 2026 soir tard)
- **`js/supabase-client.js` v1.4 → v1.5** : ajout de 2 méthodes consommant les RPC de 4.2.B
  - `SupabaseHub.getEvenementsAVenir(equipeId = null, joursAVenir = 30)` → `Promise<Array>`
  - `SupabaseHub.getProchainEvenementParEquipe(equipeId)` → `Promise<Object|null>`
- Cohérent avec le pattern des wrappers Phase 3.2 (`countPersonnes*`, `getLastOvalESyncDate`).
- Test prod console validé : `🏉 MOM Hub · Supabase Client v1.5 chargé`, `getEvenementsAVenir()` retourne `[]`, `getProchainEvenementParEquipe(uuid)` retourne `null` (cohérent vu table evenements vide).
- Au passage : changelog rattrapé (v1.3 → v1.5, v1.4 marquée "interne sans helper").

### ✅ Étape G — Peuplement événements M14 réels (FAIT — 13 mai 2026 vraiment très tard)
- **`sql/12-evenements-saison-2025-2026.sql`** : insère 4 événements M14 de la saison 2025-2026, importés depuis l'export JSON de l'app `sarmom-compos` (https://manu-mom.github.io/sarmom-compos/) :
  - `EVT-2026-05-02-FRANKFURT-M14` (tournoi PASSÉ, À 13, 5ème/10, 4V-2D, Frankfurt Allemagne)
  - `EVT-2026-05-09-J5-ECLR-M14` (journee_championnat PASSÉ, XV, victoire 41-7 vs ECLR, domicile Brencklé)
  - `EVT-2026-05-23-LES-GEMMEURS-M14` (tournoi À VENIR, XV, Rion-des-Landes)
  - `EVT-2026-06-07-CHALLENGE-VIE-M14` (tournoi À VENIR, XV, Nancy, finale régionale)
- **Test wrappers JS validé en conditions réelles** depuis la console du portail (session authenticated).
- **Découverte d'une dette annexe (k)** : pas de policy SELECT `authenticated` sur la table `equipes` (HTTP 406). Probablement étendue à toutes les tables Vague 1. À durcir avec la dette (i) policies write par rôle dans une session dédiée RLS.

### ✅ Étape K — Policies RLS SELECT Vague 1 (FAIT — 13 mai 2026, ferme dette k)
- **`sql/13-rls-read-vague1.sql`** : ajoute 3 policies `SELECT TO authenticated USING (true)` sur `ententes`, `equipes`, `equipe_joueurs`.
- Pattern identique aux 9 policies SELECT existantes (sites, evenements, etc.).
- `personnes` **volontairement non touchée** : doctrine RGPD = accès via RPC `count_personnes_*` et `get_dashboard_stats` uniquement.
- **Dette (k) FERMÉE.** Reste dette (i) policies WRITE par rôle pour une session future.

### ✅ Étape H — 15 entraînements M14 fin de saison (FAIT — 13 mai 2026)
- **`sql/14-entrainements-m14-fin-saison-2025-2026.sql`** : insère 15 entraînements M14 hebdomadaires entre le 13 mai et le 1er juillet 2026.
- Calendrier validé Manu : **LUNDI 18h00-19h15** + **MERCREDI 14h00-16h00** à Brencklé.
- Total : 7 lundis + 8 mercredis = 15 occurrences. 14 en état `creation`, 1 en état `annule` (lundi 25 mai = Pentecôte).

### ✅ Phase 4.4 Étape C — Widget "Prochain événement M14" en sidebar (FAIT — 13 mai 2026, fin de session)
- **`index.html`** : nouvelle carte `.sb-card` avec 3 IDs JS : `evt-when`, `evt-type`, `evt-site`.
- **`js/dashboard-stats.js` v2.1 → v2.2** : 8e appel `Promise.all` (`getProchainEvenementParEquipe(M14_TEAM_UUID)`), humanisation, calcul jours civils côté JS.
- **Test prod validé visuellement** : la carte affiche `[DEMAIN · 14H00]` / `Type : Entraînement` / `Lieu : Brencklé` (soir du 12 mai 2026 pour entraînement du 13 mai 14h).
- UUID M14 hardcodé pour démarrer ; à paramétrer par rôle utilisateur quand l'auth multi-équipe sera étendue.

### ✅ Phase 4.3 — Compositions + présences + vivier (FAIT — 14 mai 2026)

Session Production 14 mai 2026 (~2h, 5 fichiers SQL).

- **`sql/17-attaches-partenaires-sar-m14.sql`** : 39 attaches `equipe_joueurs` partenaires SAR `statut='regulier'` sur M14 EQ1. Total attaches actives M14 EQ1 = 62 (23 MOM + 39 partenaires).
- **`sql/17b-fix-categorie-id-partenaires.sql`** : fix `UPDATE categorie_id = M14` sur les 39 joueurs partenaires (l'export SportEasy ne contenait pas la catégorie d'âge → joueurs invisibles dans la RPC vivier au smoke test sql/21). Les 11 staff/coaches partenaires restent à NULL (cohérent métier).
- **`sql/18-compositions.sql`** : tables `compositions` (versioning via `version`+`est_active`, états `brouillon`/`validee`/`jouee`) + `composition_joueurs` (FK unifiée `joueur_id` vers personnes sans polymorphisme, UNIQUE titulaire par poste). Conforme `Modelisation-Evenements-v1.1.md §4.3`.
- **`sql/19-presences.sql`** : table `presences` (joueurs + encadrants, 3 statuts `present`/`absent`/`present_partiel`, lien optionnel `composition_joueur_id`). Conforme §4.4.
- **`sql/21-rpc-vivier-compo.sql`** : RPC `get_vivier_compo` SECURITY DEFINER authenticated-only.

**Smoke test final sur M14 EQ1** :
```
total       = 63    (24 M14 MOM + 39 partenaires)
reguliers   = 62    (23 MOM + 39 partenaires)
partenaires = 39    (club_principal ≠ MOM de l'entente)
f15         = 8     (intégrées au flag personnes.f15_integree)
non_attaches = 1    (1 M14 MOM dans personnes pas dans
                     equipe_joueurs, probablement Eden FAUVEL
                     ou Auriane DECOURCELLE)
```

Contrats métier OK. **C7-e levée naturellement** par le LEFT JOIN à `equipe_joueurs` (les `licencie_externe_partenaire` sortent sans jointure spéciale).

**Décisions prises côté Production lors de la session** :
- États compositions = brouillon/validee/jouee (fidélité v1.1 §4.3).
- Transition automatique `evenements.etat` creation→compo : reportée (pas de trigger SQL pour démarrer ; P3 itération).
- `sql/20` (M-1 ALTER personnes bloc_5 categorie_surclassement_id) : **SAUTÉ en numérotation**. Reste dette ouverte. Structure plate de personnes confirmée via SELECT info_schema → ALTER TABLE ADD COLUMN trivial à exécuter quand un cas de surclassement officiel sera identifié. Filtre surclassés en TODO commenté dans `sql/21`.
- Test bout-en-bout SQL reporté à Phase 4.4 (sera l'UI éditeur de compo elle-même).

### ✅ Dette C8-a/b/c — 3 ALTER additifs compositions (FAIT — 14 mai 2026 soir)

Session Production complémentaire (~15 min, 2 fichiers SQL) après transmission de l'audit `Audit-Module-Compositions-v3.md` par conv Audits.

- **`sql/22-alter-compositions-type-et-origine.sql`** : C8-a + C8-b regroupés (2 ALTER sur `compositions`)
  - **C8-a** : `ADD COLUMN type_compo TEXT NOT NULL DEFAULT 'match' CHECK IN ('base', 'match')` — distingue compo de base (plan A) et compo de match
  - **C8-b** : `ADD COLUMN compo_base_origine_id UUID NULL REFERENCES compositions(id)` — auto-référence, trace la dérivation compo de match → compo de base
  - **Bonus Production (validé par Audits)** : CHECK additionnel `compositions_origine_only_for_match_check` interdit qu'une compo de base dérive d'une autre compo (`compo_base_origine_id IS NULL OR type_compo = 'match'`). Aligné avec doctrine : une compo de base est par définition originale.
  - **Bonus Production (validé par Audits)** : index partiel `idx_compositions_origine WHERE compo_base_origine_id IS NOT NULL` pour la future Vue Comparaison.
- **`sql/23-alter-composition-joueurs-etat.sql`** : C8-c
  - **C8-c** : `ADD COLUMN etat_joueur TEXT NOT NULL DEFAULT 'base' CHECK IN ('base', 'modifie', 'independant', 'blesse')` — matérialise les 4 couleurs de l'éditeur (bleu/orange/vert/rouge)
  - **Bonus Production** : index partiel `idx_composition_joueurs_blesses WHERE etat_joueur='blesse'` pour le filtre UI des joueurs blessés.

**État final tables après C8-a/b/c** :
```
compositions ............ : 13 colonnes / 5 CHECK explicites / 5 indexes
composition_joueurs ..... : 11 colonnes / 2 CHECK explicites / 6 indexes
```

**Préalables Phase 4.4 UI éditeur de compo : LEVÉS.** Backend entièrement débloqué.

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
- **`Doctrine-Import-OVAL-E-v1.4.md`** (canonique, 14 mai 2026) — ajoute la 8e valeur `licencie_externe_partenaire` au §14 + nouveau §11.7 dédié aux joueurs partenaires d'entente
- `Doctrine-Import-OVAL-E-v1.3.md` (11 mai 2026, superseded par v1.4 mais conservée pour traçabilité)
- `Doctrine-Import-OVAL-E-v1.2.md`, `v1.1.md` (conservées pour traçabilité)
- **`Audit-Personnes-MOM-Hub-v1.2.md`** (14 mai 2026, étend à 5 profils dont partenaires d'entente)
- `Audit-Personnes-MOM-Hub-v1.1.md`, `v1.0.md` (conservées pour traçabilité)
- **`Audit-OVAL-E-Joueurs-Partenaires-v1.md`** (14 mai 2026, instruction complète C7)
- `Registre-anomalies-OVAL-E.md` — anomalie #1 ALTUN MURAT archivée

**Architecture des sources de vérité (§13 doctrine v1.4)** :
- **Drive figé au 10 mai 2026** pour la saison 2025-2026 (`01 - Référentiels/personnes/`) — utilisable comme **archive**
- **Supabase autoritatif** pour les données vivantes des personnes (323 fiches)
- **OVAL-E export FFR** = source externe pour réconciliation annuelle/saisonnière
- Décision saison 2026-2027 reportée à l'été 2026 (nouveau cycle d'export OVAL-E)

**Mapping qualités FFR → type_personne (§14 doctrine v1.4)** : **8 valeurs** au total — 5 valeurs licenciées MOM (`licencie_competition`, `licencie_dirigeant`, `licencie_educateur`, `licencie_soigneur`, `licencie_arbitre`) + **`licencie_externe_partenaire`** (8e valeur ajoutée v1.4 pour joueurs SAR/ASCS d'entente) + `non_licencie` + `non_licencie_au_mom`.

**Note structure Supabase (confirmée 14 mai 2026 par Production)** : la table `personnes` est en **structure plate** (pas de JSONB sur bloc_5). Colonnes existantes : `categorie_personne`, `type_personne`, `categorie_id`, `club_principal_id`, `annee_arrivee_club`, `f15_integree`, `source_creation`. Les 9 blocs doctrinaux vivent côté Drive (figé) et conceptuellement dans les schémas JSON ; Supabase n'expose qu'un noyau aplati.

---

## 🔁 Pipeline réconciliation OVAL-E (à pérenniser)

Pipeline en 4 chantiers (C1-C4) prêt à rejouer chaque saison :

- **C1** : Hygiène générale (rétro-import doublons, normalisation casse)
- **C2** : Alignement OVAL-E (insert manquants, update mismatches)
- **C3** : Conformité doctrinale (type_personne, qualités, statut FFR)
- **C4** : Audit final (croisement Drive ↔ Supabase ↔ OVAL-E)

**SQL scripts C1/C2/C3/C4** : **NON commit dans repo public** (contiennent des données perso). Archivés local + Drive.

Pipeline complet documenté dans `Doctrine-Import-OVAL-E-v1.4.md §11`.

À rejouer chaque saison avec un nouvel export OVAL-E.

---

## 🩹 Dettes techniques à traiter

### ✅ Dettes résolues le 11 mai 2026 (Phase 2.4.5)

1. ~~**Écart 293 vs 294 personnes**~~ ✅ **RÉSOLU** : OVAL-E a donné l'arbitrage. Base à 323 lignes dont 298 licenciées FFR alignées OVAL-E.
2. ~~**Écart 24 vs 23 M14**~~ ✅ **RÉSOLU** : 24 M14 = 16 M-14 + 8 F-15 intégrées. Confirmées par `Audit-Personnes-MOM-Hub v1.1 §N3`. Les 2 noms ajoutés sont **Eden FAUVEL** et **Auriane DECOURCELLE**.

### 🟡 Dettes encore actives

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Pas bloquant tant qu'on ne ré-importe pas, mais à corriger pour la Vague 2.
4. **Référentiels Drive `01 - Référentiels/`** ⚠️ **PARTIELLEMENT RÉSOLU** : audit complet publié 11 mai 2026 (`Audit-Referentiels-v1.md`), Lot 1 "cohérence structurelle" soldé 12 mai 2026. Reste ouvert (Lots 2 et 3) : couverture catégorielle F-18/F+18, peuplement métier ateliers/aptitudes EDR/barèmes physiques. Bloqué par dépendances externes.
5. ✅ ~~**Chiffres en dur résiduels dans index.html**~~ — **TOTALEMENT RÉSOLUE 13 mai 2026** : "11 Équipes" dynamique via RPC.
6. ~~**Date `VENDREDI 8 MAI 2026 · HUB INITIALISÉ` dans le HTML statique**~~ ✅ **RÉSOLU**.
7. ~~**Désalignement Drive ↔ Supabase post-réconciliation OVAL-E**~~ ✅ **ARBITRÉ** : Drive figé, Supabase autoritatif. Doctrine `v1.4 §13`.
8. ~~**CHECK constraint `personnes_type_personne_check` à étendre**~~ ✅ **RÉSOLU 12 mai 2026** (`sql/08-extend-type-personne-check.sql` poussé) : ajout `licencie_soigneur` et `licencie_arbitre`. **⚠️ Note 14 mai** : cette extension couvrait 5 valeurs licenciées + 2 non-licenciées (= 7 valeurs). L'ajout de la 8e valeur `licencie_externe_partenaire` (C7-c) reste à exécuter — voir dette C7-c plus bas.

### 🔵 Dettes ouvertes par la Phase 2.5

9. ~~**Architecture du portail à revoir**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2).
10. ~~**Panneau "État du Hub" sidebar contient encore des infos obsolètes**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2).
11. ~~**CSS dupliqué entre `index.html`, `login.html`, `dashboard.html`**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.1).
12. **Mini-déséquilibre `<div>` ouverts/fermés dans `index.html`** (1 div fermante manquante). Tolérée par les navigateurs, à nettoyer lors d'une refonte future.
13. **Allow new users to sign up = ON dans Supabase Auth** : à terme passer à OFF. À traiter quand les autres rôles seront déployés (coach, viewer).

### ✅ Dette résolue le 12 mai 2026 (conv Audits — modélisation événements)

14. ~~**Modélisation entités événements / compositions / présences**~~ ✅ **RÉSOLU** (12 mai 2026, conv Audits) : document `Modelisation-Evenements-v1.1.md` publié dans Drive `00 - Documentation/` (~89 000 caractères, 1 482 lignes). v1.0 conservée pour traçabilité mais **supersedée par v1.1** (conflit Vague 1 détecté en soirée, arbitrage Option C : conserver schémas Vague 1 intacts, adapter la modélisation événements). 6 nouvelles tables Supabase à créer dont `evenements`, `compositions`, `composition_joueurs`, `presences`, `evenement_encadrants`, `sites`, `distances_sites` — **toutes livrées en Phases 4.1.B + 4.2 + 4.3 entre 12 et 14 mai 2026**.

### 🔵 Dettes ouvertes par la Phase 3

P4-1. **Adaptation portail par rôle** (`coach`, `viewer`) : à calibrer quand des comptes réels existeront. Référence doc §2.6.

P4-2. **Greeting contextualisé `J-N AVANT MATCH`** ⚠️ **DÉBLOQUÉ** (12 mai 2026, conv Audits) + **techniquement disponible** (Phase 4.2.B/C livrées 13 mai). Reste l'UI à brancher dans une session future.

P4-3. **KPI ou widget « prochain match / présences / compo »** ⚠️ **PARTIELLEMENT RÉSOLU** (13 mai soir) : widget "Prochain événement M14" en sidebar livré (Phase 4.4 Étape C). Reste : KPI dans la zone supérieure si pertinent.

P4-4. **Sync SportEasy automatisée** (avec sidebar dédiée) : hors périmètre actuel ; à arbitrer Phase 4 sur la base d'un vrai cas d'usage.

P4-5. **Greeting mode anonyme à préciser** : à traiter quand on activera un vrai compte `viewer` ou qu'on aura une page d'accueil publique.

P4-6. **Personnalisation des `RACCOURCIS` (sidebar carte 3)** : à terme, personnaliser selon le rôle. Référence doc §2.5.

P4-7. **Outil de listing filtré des fiches** : actuellement chiffres en texte non cliquable. À transformer en liens vers une vue filtrée.

### 🔵 Dettes ouvertes par la modélisation événements (12 mai 2026 — conv Audits)

M-1. **ALTER TABLE personnes — bloc_5** 🟡 **RÉDUIT en v1.1** : ajouter `categorie_surclassement_id UUID NULL REFERENCES categories(id)` pour tracer les surclassements officiels. **Note 14 mai (Production)** : structure plate de personnes confirmée, ALTER trivial à exécuter dès qu'un cas surclassé sera identifié. Filtre surclassés en TODO commenté dans `sql/21` (RPC vivier). Priorité faible.

M-2. **Intégration API d'itinéraire + cache `distances_sites`** : OpenRouteService recommandé (free tier 2 000 req/jour). Clé API en secret. Priorité moyenne.

M-3. **Migration future Drive → Supabase de `groupes-joueur.json`** : quand l'onglet paramètres sera implémenté. Priorité faible.

M-4. **Onglet paramètres pour édition admin** des référentiels `groupes-joueur` et `aptitudes`. Lié à M-3. Priorité faible.

M-5. **RPC `get_distance_between_sites(origine_id, destination_id)`** : wrapper côté serveur. Lié à M-2.

### ✅ Dette C7 — Audit doctrine OVAL-E sur joueurs partenaires d'entente

C7 a été ouverte par la modélisation v1.1 (§9.2) puis instruite par la conv Audits le 14 mai 2026. **Statut au 14 mai soir** : **côté Audits totalement soldée** (C7-a + C7-b livrées). 6 sous-dettes restent ouvertes côté Production.

**Doctrine retenue (résumé)** : les joueurs SAR/ASCS d'entente sont créés dans `personnes` Supabase comme fiches complètes, avec `bloc_5.club_principal_id = club-sar` ou `club-ascs` (pas `club-mom`), `type_personne = licencie_externe_partenaire` (8e valeur OVAL-E v1.4). Attache via `equipe_joueurs.club_provenance_id` (Vague 1, déjà prévu pour ce cas). Blocs sensibles (coordonnées, famille, préférences, documents) restent vides ou minimaux côté MOM par doctrine RGPD.

**Sous-dettes C7** :

**C7-a** ✅ **LIVRÉE 14 mai 2026 (conv Audits)** : Doctrine OVAL-E révisée v1.3 → v1.4 + audit complet. 2 livrables Drive :
- `Audit-OVAL-E-Joueurs-Partenaires-v1.md` (fileId `12_akokLYOUpyk-_CKIkW5H8WzvleEqiO`) — doctrine retenue, analyse 3 pistes, 8 actions cascade
- `Doctrine-Import-OVAL-E-v1.4.md` (fileId `1Va9h9lQVIXHmPfTRK0s5ZuoQoGAy3dwQ`) — ajout `licencie_externe_partenaire` au §14, précision §11.3, nouveau §11.7 dédié

**C7-b** ✅ **LIVRÉE 14 mai 2026 (conv Audits)** : `Audit-Personnes-MOM-Hub-v1.2.md` (fileId `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA`) — extension à 5 profils (ajout colonne "Partenaires d'entente"), nouvelle §6 dédiée.

**C7-c** ⚠️ **STATUT À CONFIRMER** : ALTER CHECK `personnes_type_personne_check` pour autoriser la valeur `licencie_externe_partenaire`. Pattern identique à dette #8 résolue 12 mai. **⚠️ Note méthode 14 mai soir** : Production a peuplé 39 attaches `equipe_joueurs` partenaires SAR en `sql/17`, mais le message de session ne mentionne pas explicitement l'exécution de C7-c. À vérifier prochaine session Production :
- Le CHECK `personnes_type_personne_check` autorise-t-il bien `licencie_externe_partenaire` ?
- Les 39 fiches partenaires SAR référencées par `equipe_joueurs.personne_id` ont-elles `type_personne = 'licencie_externe_partenaire'` ?
- Ou bien les fiches `personnes` partenaires ne sont-elles pas encore créées (auquel cas C7-c reste un préalable au peuplement réel des fiches) ?

C7-c reste **PRÉALABLE BLOQUANT** au peuplement effectif des fiches `personnes` partenaires d'entente. Effort ~5 min.

**C7-d** Ouverte : policies RLS write par rôle prévoir le cas `licencie_externe_partenaire` (coach SAR/entente en lecture seule sur fiches partenaires de son entente). À grouper avec dette (i).

**C7-e** ✅ **LEVÉE NATURELLEMENT 14 mai 2026 par Production** : la RPC `get_vivier_compo` (`sql/21`) retourne les joueurs partenaires via LEFT JOIN `equipe_joueurs` sans jointure spéciale. Smoke test M14 EQ1 retourne bien 39 partenaires.

**C7-f** Ouverte : choisir canal d'import pour le peuplement initial M14 (39 fiches SAR/ASCS) et futurs M16 (~35) et M19 (similaire). 3 options : Excel manuel (recommandé), extraction SportEasy, passerelle OVAL-E partenaires future. Préalable opérationnel.

**C7-g** Long terme : passerelle OVAL-E partenaires officielle FFR. Dépend FFR.

**C7-h** À l'usage : workflow changement de club d'un joueur en cours de saison (muté SAR → MOM ou inverse).

### ✅ Dette C8 — Audit Compositions v3 + 3 ALTER additifs

C8 a été ouverte par la conv Audits le 14 mai soir lors de la révision de l'audit Compositions v2 → v3 (`Audit-Module-Compositions-v3.md`, fileId `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ`), suite à l'identification de 3 décalages structurels entre la doctrine v2 (riche métier) et le schéma Phase 4.3 (simplifié). **Statut au 14 mai soir** : C8-a + C8-b + C8-c livrés en base. C8-d et C8-e restent ouverts.

**3 décalages D1/D2/D3 résolus par 3 ALTER additifs** :
- D1 (type de compo absent) → C8-a
- D2 (lien dérivation absent) → C8-b
- D3 (4 états joueur absents) → C8-c

**C8-a** ✅ **LIVRÉ 14 mai 2026 soir (Production)** : `ALTER TABLE compositions ADD COLUMN type_compo TEXT NOT NULL DEFAULT 'match' CHECK IN ('base', 'match')` via `sql/22-alter-compositions-type-et-origine.sql`.

**C8-b** ✅ **LIVRÉ 14 mai 2026 soir (Production)** : `ALTER TABLE compositions ADD COLUMN compo_base_origine_id UUID NULL REFERENCES compositions(id)` via `sql/22`. Bonus : CHECK additionnel `compositions_origine_only_for_match_check` + index partiel `idx_compositions_origine`. Validés par conv Audits.

**C8-c** ✅ **LIVRÉ 14 mai 2026 soir (Production)** : `ALTER TABLE composition_joueurs ADD COLUMN etat_joueur TEXT NOT NULL DEFAULT 'base' CHECK IN ('base', 'modifie', 'independant', 'blesse')` via `sql/23-alter-composition-joueurs-etat.sql`. Bonus : index partiel `idx_composition_joueurs_blesses`. Validé par conv Audits.

**État final tables après C8-a/b/c** :
- `compositions` : 13 colonnes / 5 CHECK explicites / 5 indexes
- `composition_joueurs` : 11 colonnes / 2 CHECK explicites / 6 indexes

**C8-d** Ouverte 🟡 : extension CHECK `compositions_etat_check` pour ajouter `archivee`. Arbitrage à faire : Option A (renommage `jouee` → `utilisee`) ou Option B (juste ajout `archivee`, garder `jouee`). Non bloquant, à traiter avant fin saison 2025-2026.

**C8-e** Ouverte 🟡 : policies RLS write par rôle sur `compositions` et `composition_joueurs`. À grouper avec dette (i) + C7-d + (l) durcissement INSERT distances_sites dans une session RLS write par rôle dédiée (~1-2h). Matrice de droits dans `Audit-Module-Compositions-v3 §1.3`.

### 🔵 Dettes mineures Phase 4

(a) **Implémentation des tables modélisées** : ✅ **TERMINÉE 14 mai 2026** (Phases 4.1.B + 4.2.A/B/C + 4.3). Reste seulement M-1 (ALTER personnes bloc_5 categorie_surclassement_id) à exécuter sur cas surclassé.

(b) **RPC associées** : ✅ `get_evenements_a_venir` + `get_prochain_evenement_par_equipe` (Phase 4.2.B) + `get_vivier_compo` (Phase 4.3) LIVRÉES. Reste à faire : `get_distance_between_sites` (Phase 4.5).

(c) **Mirror `groupes-joueur.json` v1.1** dans `data/` une fois déposé dans Drive.

(d) ✅ **Dette #8 RÉSOLUE et committée**.

(e) ✅ **Dettes mineures RÉSOLUES** : logo M2M PNG, `04-auth-roles.sql` déplacé.

(f) Déploiement comptes `coach` et `viewer` réels (préalable à P4-1).

(g) **D-qualite-ffr-array** : migration future `personnes.qualite_ffr` TEXT → ARRAY. À grouper avec import OVAL-E été 2026.

(h) **Compteur K3 CETTE SEMAINE biaisé jusqu'au 17 mai 2026** : retombera mécaniquement après 7 jours glissants. Pas un bug.

(i) **Dette ouverte Phase 4.2.A — policies RLS write par rôle** : `evenements` + `evenement_encadrants` ont RLS activée mais seules les policies SELECT pour `authenticated` sont définies. Aucune policy write → seul le `service_role` peut INSERT/UPDATE/DELETE. À durcir dans une session dédiée. **À grouper avec C7-d + C8-e + (l)**. Étendre aussi à `equipes`, `equipe_joueurs`, `compositions`, `composition_joueurs`, `presences`.

(j) **Leçon doctrinale Claude (13 mai très tard) — anti-invention** : avant de citer un détail factuel, faire un `web_fetch` du repo OU un DRY-RUN sur Supabase OU consulter le fichier Drive. Doctrine OVAL-E §13 (Supabase autoritatif) s'applique aussi à Claude.

(k) ✅ **Dette FERMÉE 13 mai 2026 fin de session** — policies RLS READ pour Vague 1.

(l) **Durcissement RLS WRITE distances_sites** : table autorise actuellement INSERT/UPDATE à tout `authenticated` (pas seulement admin). À regrouper avec dette (i).

(m) **🆕 Correction post-import ASCS** (Production, 14 mai) : UPDATE ciblé `club_principal_id` sur les fiches ASCS quand Manu fournira la liste. Ouvert.

(n) **🆕 Complétion sexe + date_naissance partenaires SAR** (Production, 14 mai) : gabarit Excel déjà livré, complétion en cours. Ouvert.

(o) **🆕 Wrapper JS `getVivierCompo()`** (Production, 14 mai) : à créer en Phase 4.4 (préalable UI éditeur de compo). Ouvert.

(p) **🆕 Test E2E Phase 4.3** (Production, 14 mai) : reporté à Phase 4.4 (sera l'UI éditeur de compo elle-même).

---

## 📂 Structure repo finale

```
mom-hub/
├── .github/workflows/keep-alive-supabase.yml
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
│   └── dashboard-stats.js                 # v2.2 — 8 sources dynamiques
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
│   └── 23-alter-composition-joueurs-etat.sql          # C8-c
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit (données perso)
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
| `Doctrine-Import-OVAL-E-v1.2.md` | (dans `00 - Documentation/`) | Doctrine import licences FFR — v1.2 (11 mai 2026) |
| `Doctrine-Import-OVAL-E-v1.3.md` | (dans `00 - Documentation/`) | Doctrine import licences FFR — v1.3 (11 mai 2026) |
| **`Doctrine-Import-OVAL-E-v1.4.md`** | `1Va9h9lQVIXHmPfTRK0s5ZuoQoGAy3dwQ` | **Doctrine import licences FFR — v1.4 (14 mai 2026)** — canonique, ajoute `licencie_externe_partenaire` + §11.7 dédié aux partenaires d'entente. Résout C7. |
| `Conception-Portail-Phase-3.md` | `12xrICwk5NTzk1XZLpq964CkWwhft3zc2` | Conception portail Phase 3 livrée 12 mai 2026 |
| `Audit-Referentiels-v1.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Audit des 6 référentiels métier (11 mai 2026) |
| `Schema-cible-Supabase-aptitudes.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Pattern de migration Drive → Supabase (12 mai 2026) |
| `Modelisation-Evenements-v1.0.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Modélisation événements v1.0 (12 mai matin) — superseded par v1.1 |
| `Modelisation-Evenements-v1.1.md` | `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u` | **Modélisation événements v1.1 (12 mai soir)** — référence canonique, intègre arbitrage Option C. Implémentée intégralement en Phases 4.1.B + 4.2 + 4.3. |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit module Compos — v2 historique (10 mai 2026) |
| **`Audit-Module-Compositions-v3.md`** | `1QOUvIX7QJeGYwKnK8COTYDrSOY_4qjsJ` | **Audit module Compos — v3 (14 mai 2026 soir)** — révision post-Phase 4.3. 3 décalages structurels résolus, 4 statuts cycle de vie, 20 hypothèses terrain. Ouvre dette C8 (5 sous-dettes). |
| `Audit-Module-Suivi-Match.md` | `1i9ba9foFHzZ9ggfbVwmsHwqp7tF41yTD` | Audit module Suivi-Match — à reprendre post-Phase 4.3 (recommandation forte) |
| `Audit-Module-Rapport.md` | — | Audit module Rapport — à reprendre post-modélisation événements |
| `Audit-Module-Statistiques.md` | `1z1xWDOL9T-qNyY-C_P5E4CNt08wXZcoP` | Audit module Stats — à reprendre post-Phase 4.3 |
| `Audit-Module-Bilans.md` | — | Audit module Bilans — à reprendre post-Phase 4.3 |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit du modèle Personnes — v1.0 historique |
| `Audit-Personnes-MOM-Hub-v1.1.md` | `1sf6UMb1dPvh9znfDoUw6duGkLR7GLFtA` | Audit du modèle Personnes — v1.1 (11 mai 2026) avec §N3 résolu |
| **`Audit-Personnes-MOM-Hub-v1.2.md`** | `136ACCR8bazOGQXzE1XoEoCEPnXuXEYnA` | **Audit du modèle Personnes — v1.2 (14 mai 2026)** — étend à 5 profils (ajout colonne "Partenaires d'entente"), nouvelle §6 dédiée. Résout C7-b. |
| **`Audit-OVAL-E-Joueurs-Partenaires-v1.md`** | `12_akokLYOUpyk-_CKIkW5H8WzvleEqiO` | **Audit C7 (14 mai 2026)** — doctrine de représentation des joueurs SAR/ASCS d'entente. Analyse 3 pistes, retient (a), 8 actions cascade. |
| `Registre-anomalies-OVAL-E.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Registre des anomalies de réconciliation FFR |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h` (6 fichiers JSON existants + `groupes-joueur.json` à déposer post-modélisation événements)
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE` (sous-dossiers joueurs/parents/contacts-externes)

---

## 🚀 Prochaine session

**Avant de démarrer toute session Phase 4.4 ou autre** :
1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Lire `Modelisation-Evenements-v1.1.md` (référence canonique implémentée en Phases 4.1.B + 4.2 + 4.3)
4. Vérifier que la chaîne Hub → Supabase fonctionne toujours (ouvrir `https://manu-mom.github.io/mom-hub/`, F12 console, doit afficher `✅ MOM Hub Dashboard: stats mises à jour depuis Supabase` ET `🏉 MOM Hub · Supabase Client v1.5 chargé`)
5. Vérifier que le portail affiche bien **323 personnes**, **11 équipes** et la carte sidebar "Prochain événement M14" avec le bon entraînement à venir

**Travaux en attente** :

- **Conv Production** : Phases 1 à 4.3 + Étapes G/K/H + Phase 4.4 Étape C (widget) + C8-a/b/c terminées. **Prochain travail prioritaire** : confirmer le statut C7-c (ALTER CHECK `personnes_type_personne_check` pour `licencie_externe_partenaire`) avant de peupler les fiches personnes partenaires. Puis Phase 4.4 UI éditeur de compo (préalable Conception UX dédié recommandé). Dettes restantes :
  - **C7-c (PRÉALABLE pour fiches partenaires)** : ALTER CHECK constraint, ~5 min. À confirmer si déjà exécutée.
  - **C7-d + C7-h** : RLS partenaires + workflow changement de club. À grouper avec dette (i).
  - **C7-f (préalable opérationnel)** : choisir canal d'import des fiches partenaires (Excel manuel recommandé pour démarrer).
  - **C8-d** : extension CHECK `etat` (ajout `archivee`, renommage `jouee` optionnel). Non bloquant, avant fin saison.
  - **C8-e + dette (i) + dette (l) RLS write groupées** : session ~1-2h dédiée.
  - **(o) Wrapper JS `getVivierCompo()`** : préalable Phase 4.4 UI éditeur de compo.
  - **(p) Test E2E** : à faire au passage Phase 4.4.
  - **(m) Correction post-import ASCS** + **(n) Complétion sexe/date_naissance partenaires** : ouverts.
  - **M-1 (ALTER bloc_5 categorie_surclassement_id)** : trivial, à exécuter dès qu'un cas surclassé sera identifié.
  - Phase 4.5 (API distances OpenRouteService) : reportée, non-critique.
  - Phase 4.4 P4-2 greeting J-N : optionnel.

- **Conv Audits** : **Dettes C7 et C8 totalement soldées côté Audits.** Travaux restants par priorité :
  - **Reprise audit Suivi-Match + résolution dette C3** (recommandation forte) : Suivi-Match est le prochain module à construire ; C3 (modélisation observables-match en table SQL dédiée) profite autant à Suivi-Match qu'à la conv Modules Ateliers.
  - Audits Rapport / Stats / Bilans post-Phase 4.3.
  - Lots 2 et 3 audit référentiels (bloqués par tiers : règlement LRGER 2025-2026, Lohann, préparateur physique).
  - Modélisation événements extra-sportifs (C2, dette Phase 5).
  - Modélisation compo adverse + joueurs adverses (C1, reportée après usage réel).

- **Conv Conception Portail** : à rouvrir pour cycle UX dédié de l'**éditeur de compo Phase 4.4**. Input principal : `Audit-Module-Compositions-v3 §4` (8 écrans détaillés). À spécifier : workflow drag-and-drop, multi-mode (Complet/Réduit/EDR), Vue Comparaison base vs match, workflow verrouillage UI cohérent avec `etat=validee`.

- **Conv Modules Ateliers** (à démarrer si pas déjà fait) : message de kick-off préparé par conv Audits avec 3 questions de cadrage Q1/Q2/Q3 (modèle de données / articulation atelier ↔ aptitude ↔ poste / granularité temporelle).

- **Conv Suivi Match** (à ouvrir) : module à construire post-Phase 4.3. Audit doctrine v2 existant à reprendre. Dette C3 à instruire. Pré-requis levés : C8-c livré (`etat_joueur='blesse'` = écriture exceptionnelle Suivi Match).
