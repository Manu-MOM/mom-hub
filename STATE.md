# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 12 mai 2026 (soir) — fin Phase 3 + Phase 4.1.B sites livrée + modélisation événements v1.1 livrée (conv Audits, après arbitrage conflit Vague 1)**

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
| **Supabase** `mom-hub` (free tier) | Source de vérité des **données vivantes** (personnes, événements, présences, etc.) | 9 tables Vague 1 (6 remplies), fonctions RPC, RLS |

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
- `Doctrine-Import-OVAL-E-v1.3.md` (canonique, mise à jour 11 mai 2026) — §13 sur l'architecture des sources, §14 sur le mapping qualités FFR
- `Doctrine-Import-OVAL-E-v1.2.md` (intermédiaire, conservée pour traçabilité)
- `Doctrine-Import-OVAL-E-v1.1.md` (initiale, conservée pour traçabilité)
- `Audit-Personnes-MOM-Hub-v1.1.md` — §N3 F-15 documenté, 8 noms confirmés (vs 6 dans v1.0)
- `Registre-anomalies-OVAL-E.md` — anomalie #1 ALTUN MURAT archivée

**Architecture des sources de vérité (§13 doctrine v1.3)** :
- **Drive figé au 10 mai 2026** pour la saison 2025-2026 (`01 - Référentiels/personnes/`) — utilisable comme **archive**
- **Supabase autoritatif** pour les données vivantes des personnes (323 fiches)
- **OVAL-E export FFR** = source externe pour réconciliation annuelle/saisonnière
- Décision saison 2026-2027 reportée à l'été 2026 (nouveau cycle d'export OVAL-E)

**Mapping qualités FFR → type_personne (§14 doctrine v1.3)** : 5 valeurs licenciées (`licencie_joueur`, `licencie_dirigeant`, `licencie_educateur`, `licencie_soigneur`, `licencie_arbitre`) + `non_licencie` + `non_licencie_au_mom`. La CHECK constraint Supabase est en attente d'extension (cf. dette #8).

---

## 🔁 Pipeline réconciliation OVAL-E (à pérenniser)

Pipeline en 4 chantiers (C1-C4) prêt à rejouer chaque saison :

- **C1** : Hygiène générale (rétro-import doublons, normalisation casse)
- **C2** : Alignement OVAL-E (insert manquants, update mismatches)
- **C3** : Conformité doctrinale (type_personne, qualités, statut FFR)
- **C4** : Audit final (croisement Drive ↔ Supabase ↔ OVAL-E)

**SQL scripts C1/C2/C3/C4** : **NON commit dans repo public** (contiennent des données perso). Archivés local + Drive.

Pipeline complet documenté dans `Doctrine-Import-OVAL-E-v1.3.md §11`.

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

1. ~~**Écart 293 vs 294 personnes**~~ ✅ **RÉSOLU** : OVAL-E a donné l'arbitrage. Le 294 était le chiffre cible du script de migration Phase 2.0 ; le 293 réel résultait d'un doublon perdu (LUTZ Hugo parent fantôme). La base est maintenant à 323 lignes dont 298 licenciées FFR alignées OVAL-E.
2. ~~**Écart 24 vs 23 M14**~~ ✅ **RÉSOLU** : Supabase a 24 M14 = 16 M-14 + 8 F-15 intégrées. Les 8 F-15 sont **confirmées par `Audit-Personnes-MOM-Hub v1.1 §N3`** (publié par la conv Audits le 11 mai 2026, après application de la doctrine §5 sur le stockage des F-15). Les 2 noms ajoutés par rapport à l'audit initial (qui n'en référençait que 6) sont **Eden FAUVEL** et **Auriane DECOURCELLE**. Si SportEasy n'en référence que 7, c'est probablement l'une de ces deux qui manque côté SportEasy — à vérifier.

### 🟡 Dettes encore actives

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Détecté lors de la migration Phase 2.0. Pas bloquant tant qu'on ne ré-importe pas, mais à corriger pour la Vague 2.
4. **Référentiels Drive `01 - Référentiels/`** ⚠️ **PARTIELLEMENT RÉSOLU** : audit complet publié le 11 mai 2026 soir (`Audit-Referentiels-v1.md`, Drive), puis **Lot 1 "cohérence structurelle" soldé le 12 mai 2026 matin** par la conv Audits :
   - `aptitudes.json` v1.1 (refonte cat B avec structure plate et `categories_applicables` explicite, UUIDs renommés `apt-B-M14-NNN` → `apt-B-NNN`, ajout `actif` + `ordre` pour préparation onglet paramètres)
   - `conformite-ffr.json` v1.2 (`_meta` enrichi avec champs obligatoires/optionnels, `statut: "a_confirmer"` sur 3 règles avec `source_a_consulter`, `_couverture_a_completer` documentant le trou F-18/F+18)
   - `postes.json` v1.2 (`_couverture_a_completer` documentant la lacune des formats X et 7)
   - `observables-match.json` v1.1 (note `_note_jeu_collectif` expliquant l'absence de `libelle_long` et `saisie_associee` sur ce sous-type)
   - `Schema-cible-Supabase-aptitudes.md` v1.0 (anticipation migration Drive → Supabase pour quand l'onglet paramètres sera implémenté)
   - **Ajout 12 mai 2026 soir** : nouveau référentiel `groupes-joueur.json` v1.0 généré par la modélisation événements (3 groupes par défaut : Performance / Développement / Initiation), à déposer dans `01 - Référentiels/`

   **Reste ouvert (Lots 2 et 3)** : couverture catégorielle F-18/F+18, peuplement métier ateliers/aptitudes EDR/barèmes physiques. Bloqué par dépendances externes (règlement LRGER 2025-2026, Lohann, préparateur physique), pas faisable seul en conv Audits.
5. ~~**Chiffres en dur résiduels dans index.html**~~ ⚠️ **PARTIEL** : "16 Sites" et "11 Équipes" restent en dur tant que les tables `sites` et `equipes` ne sont pas créées/remplies (cf. dette résolue #14 ci-dessous, modélisation publiée — implémentation Phase 4). Le compteur "323 personnes" est dynamique via la RPC. **24 M14** est aussi dynamique depuis Phase 2.4.5.
6. ~~**Date `VENDREDI 8 MAI 2026 · HUB INITIALISÉ` dans le HTML statique**~~ ✅ **RÉSOLU** (11 mai 2026, Phase 2.5.6) : remplacé par "TABLEAU DE BORD" (date injectée dynamiquement par JS au format `toLocaleDateString('fr-FR')`). Greeting-sub neutralisé en "Effectifs synchronisés avec OVAL-E" (et probablement écrasé par `dashboard-stats.js` au runtime avec le compteur dynamique). Panneau sidebar "État du Hub" : "Hub initialisé aujourd'hui" → "Hub en production".
7. ~~**Désalignement Drive ↔ Supabase post-réconciliation OVAL-E**~~ ✅ **ARBITRÉ** (11 mai 2026, conv Audits) : Drive figé au 10 mai 2026 pour la saison 2025-2026, Supabase devient source autoritative des données vivantes. Décision saison 2026-2027 reportée à l'été. Doctrine : `Doctrine-Import-OVAL-E-v1.3.md §13`. Pas d'action Production requise.
8. **CHECK constraint `personnes_type_personne_check` à étendre** (arbitré 11 mai 2026, **prêt à exécuter** depuis publication doctrine §14) : la `Doctrine-Import-OVAL-E-v1.3.md §14` est désormais publiée (mapping qualités FFR → `type_personne` officiel : 5 valeurs licenciées + `non_licencie` + `non_licencie_au_mom`). Le SQL est donc cadré, plus d'ambiguïté de spec. Ajouter `licencie_soigneur` et `licencie_arbitre` aux valeurs autorisées de `personnes.type_personne` (fidélité à la nomenclature FFR : Joueur / Dirigeant / Éducateur / Soigneur / Arbitre).
   - Migrer les fiches existantes classées par défaut `licencie_dirigeant` mais en réalité soigneurs (minimum MICHEL STEPHANE) vers `licencie_soigneur`
   - Mettre à jour le script d'import OVAL-E (été 2026) pour appliquer le nouveau mapping `qualite_ffr_principale → type_personne` du §14
   - Effort estimé : ~10 minutes côté SQL + migration ponctuelle

### 🔵 Dettes ouvertes par la Phase 2.5

9. ~~**Architecture du portail à revoir**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2) : la version actuelle de `index.html` est fonctionnelle mais a une architecture d'information faible (KPI passifs "323 / 16 / 11 / 24" plutôt qu'orientés actions, greeting plat, sidebar pauvre, hiérarchie des outils peu lisible). **Référence v3 à conserver** comme inspiration : capture d'écran d'un prototype antérieur (mom-hub-accueil-v3) qui propose un greeting contextualisé ("J-3 AVANT MATCH · 3 actions en attente · compo M14 à finaliser · 2 nouveaux licenciés"), des KPI orientés actions ("3 PRÉSENCES / 1 COMPO / +2 LICENCIÉS / 8 CERT. MÉD."), des sous-titres de section ("construction & planification" / "le quotidien du coach"), et 3 cartes sidebar utiles (Prochain match, À venir, Passerelle synchronisée). Travail à reprendre côté axe B (conception) avant retour Production.
10. ~~**Panneau "État du Hub" sidebar contient encore des infos obsolètes**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2) : panneau retiré, remplacé par sidebar 3 cartes (OVAL-E / Qualité des données / Raccourcis).
11. ~~**CSS dupliqué entre `index.html`, `login.html`, `dashboard.html`**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.1) : factorisation dans `css/hub.css` (palette canonique 15+6 vars, reset, topbar Hub partagée, classes utilitaires).
12. **Mini-déséquilibre `<div>` ouverts/fermés dans `index.html`** (1 div fermante manquante quelque part, présent dès la version initiale du fichier). Tolérée par les navigateurs, sans impact visuel constaté. À nettoyer lors de la refonte.
13. **Allow new users to sign up = ON dans Supabase Auth** : à terme passer à OFF pour fermer les inscriptions spontanées (les comptes seront créés par un admin). À traiter quand les autres rôles seront déployés (coach, viewer).

### ✅ Dette résolue le 12 mai 2026 (conv Audits — modélisation événements)

14. ~~**Modélisation entités événements / compositions / présences**~~ ✅ **RÉSOLU** (12 mai 2026, conv Audits) : document `Modelisation-Evenements-v1.1.md` publié dans Drive `00 - Documentation/` (~89 000 caractères, 1 482 lignes). v1.0 conservée pour traçabilité mais **supersedée par v1.1** (conflit Vague 1 détecté en soirée par conv Production, arbitrage Option C : conserver schémas Vague 1 intacts, adapter la modélisation événements).

   **6 nouvelles tables Supabase** à créer : `evenements`, `compositions`, `composition_joueurs`, `presences`, `evenement_encadrants`, `sites`, `distances_sites` (les 3 tables `ententes`, `equipes`, `equipe_joueurs` Vague 1 sont **conservées telles quelles** et juste peuplées).

   **22 décisions de cadrage** actées (dont 6 révisées en v1.1 : #1, #12, #13, Q-eq-1 (b) abandonnée, Q-eq-3 (a) révisée, #16 précisée). **10 cas d'usage** couverts (match standard, ententes SAR×MOM, triangulaire M-14, quadrangulaire, Challenge Vié multi-phases, tournoi multi-jours, stage EDR multi-catégories, EDR mono-catégorie, matchs simultanés, dépannage hors-catégorie). Cycle de vie événement à 5 états + `annule`. Référentiel `groupes-joueur.json` **v1.1** (doctrine d'usage clarifiée : référentiel des valeurs valides, valeur appliquée vit dans `equipe_joueurs.niveau_profil` Vague 1).

   **Débloque P4-2** (greeting `J-N AVANT MATCH`) **et P4-3** (KPI prochain match). 5 dettes Production transmises (M-1 à M-5, dont **M-1 réduit en v1.1**) + 7 dettes conceptuelles consignées dans le document final §9.2 (dont **C7 nouvelle** : audit doctrine OVAL-E sur joueurs partenaires d'entente).

### 🔵 Dettes ouvertes par la Phase 3

Issues directes du doc `Conception-Portail-Phase-3.md` §3 (12 dettes consolidées en 7).

P4-1. **Adaptation portail par rôle** (`coach`, `viewer`) : en Phase 3, tous les rôles voient le même portail avec mêmes 18 outils, mêmes sections, mêmes KPI, même sidebar. Quand des comptes `coach` et `viewer` réels existeront et auront fourni des retours d'usage, calibrer un portail dédié (filtrage sections vs vignettes, sidebar personnalisée, KPI contextualisés). Référence doc §2.6.

P4-2. **Greeting contextualisé `J-N AVANT MATCH`** ⚠️ **DÉBLOQUÉ** (12 mai 2026) : la table `evenements` est désormais modélisée (cf. dette résolue #14 et `Modelisation-Evenements-v1.1.md`). Implémentation possible en Phase 4 par conv Production une fois les CREATE TABLE exécutés. RPC suggérée : `get_evenements_a_venir(equipe_uuid, n_jours)`.

P4-3. **KPI ou widget « prochain match / présences / compo »** ⚠️ **DÉBLOQUÉ** (12 mai 2026) : idem P4-2. RPC suggérée : `get_prochain_evenement_par_equipe(equipe_uuid)`. Pertinent uniquement pour rôle `coach`.

P4-4. **Sync SportEasy automatisée** (avec sidebar dédiée) : remplacerait à terme la mention historique `SportEasy · M14 enrichis (23)` par un vrai état de sync bidirectionnelle. Hors périmètre actuel ; à arbitrer Phase 4 sur la base d'un vrai cas d'usage.

P4-5. **Greeting mode anonyme à préciser** : §2.2 du doc évoque un libellé `BIENVENUE SUR MOM HUB,` pour visiteur non connecté, mais l'expérience mode anonyme n'est pas formellement définie. À traiter quand on activera un vrai compte `viewer` ou qu'on aura une page d'accueil publique.

P4-6. **Personnalisation des `RACCOURCIS` (sidebar carte 3)** : actuellement 3 liens en dur (Annuaire complet / Éditeur de compositions / Bibliothèque ateliers) communs à tous. À terme, personnaliser selon le rôle (un coach a d'autres priorités qu'un dirigeant) ou même selon l'historique de clics. Référence doc §2.5.

P4-7. **Outil de listing filtré des fiches** (cible des liens carte 2 Qualité des données) : actuellement les chiffres "1 fiches sans email / 25 fiches sans naissance / 298 affiliations expirent dans 90j" sont du texte non cliquable. À terme, transformer en liens vers une vue filtrée des fiches concernées. Référence doc §2.5.

### 🔵 Dettes ouvertes par la modélisation événements (12 mai 2026 — conv Audits)

Issues directes du doc `Modelisation-Evenements-v1.1.md` §9.1. Destinées à la conv Production (M-1 à M-5), sauf C7 destinée à la conv Audits.

M-1. **ALTER TABLE personnes — bloc_5** 🟡 **RÉDUIT en v1.1** : ajouter `categorie_surclassement_uuid UUID NULL REFERENCES categories(id)` pour tracer les surclassements officiels. **Préalable** à la prise en compte propre des surclassements dans le vivier de composition (cf. décision cadrage #20). Priorité : moyenne.

   **Note v1.1** : l'ALTER `bloc_6.groupe_indicatif_uuid` prévu en v1.0 est **abandonné**. La valeur du groupe (Performance / Développement / Initiation) est portée par `equipe_joueurs.niveau_profil` (Vague 1, TEXT) au niveau de l'attache joueur ↔ équipe, pas par les fiches Personne globales. Cohérent avec le commentaire SQL Vague 1 qui mentionnait déjà "Performance / Développement / Initiation pour M14".

M-2. **Intégration API d'itinéraire + cache `distances_sites`** : pour le calcul automatique des distances et durées de trajet inter-sites. Recommandation : **OpenRouteService** (free tier 2 000 req/jour, respecte la doctrine budget 0€) ; alternative : OSRM auto-hébergé. Pattern lazy (calcul à la demande, mise en cache ~1 an). Clé API stockée en secret GitHub Actions / variable Supabase, **jamais en commit**. Priorité : moyenne.

M-3. **Migration future Drive → Supabase de `groupes-joueur.json`** : quand l'onglet paramètres sera implémenté. Pattern de référence : `Schema-cible-Supabase-aptitudes.md` (Drive `00 - Documentation/`). Priorité : faible.

M-4. **Onglet paramètres pour édition admin** des référentiels `groupes-joueur` et `aptitudes` : permettre à un admin de créer/désactiver/réordonner les valeurs sans éditer le JSON Drive. Lié à M-3. Priorité : faible.

M-5. **RPC `get_distance_between_sites(origine_uuid, destination_uuid)`** : wrapper côté serveur qui interroge le cache `distances_sites` puis l'API externe si besoin. Lié à M-2. Priorité : liée à M-2.

C7. **🆕 Audit doctrine OVAL-E sur `personnes.bloc_5.club_principal_id != MOM`** (côté conv Audits, ouvert par v1.1) : confirmer que la doctrine OVAL-E v1.3 §11.3 (`non_licencie_au_mom`) couvre proprement le cas des joueurs partenaires d'entente qui ont leur licence FFR ailleurs (SAR par exemple). Si l'audit révèle une incompatibilité (ex. : `non_licencie_au_mom` est réservé aux contacts vraiment externes, pas aux joueurs actifs licenciés ailleurs), une révision doctrinale légère pourra être nécessaire (ajout d'une valeur `type_personne = licencie_externe_partenaire` ou similaire). **À traiter par la conv Audits avant que Phase 4.3 commence à peupler `personnes` avec des joueurs SAR.** Priorité : moyenne, liée à Phase 4.3.

### 🔵 Dette technique mineure ouverte par Phase 3

P3-mineure-1. ✅ **RÉSOLU (12 mai 2026 soir)** — Logo M2M externalisé dans `assets/logo-m2m.png` (PNG transparent récupéré du Drive, 106 ko). Les 3 HTML pointent désormais vers le PNG (favicon + img). Gain net repo : ~80 ko (avec un PNG plus lourd que le JPEG initial mais visuellement intégré sans fond noir parasite sur la topbar Phase 3 sombre). Ancien `assets/logo-m2m.jpg` supprimé.

P3-mineure-2. ✅ **RÉSOLU** — `sql/04-auth-roles.sql` déplacé du root vers `sql/` (par conv Audits avant cette session).

### 🔵 Dettes techniques mineures ouvertes par Phase 4.1

D-qualite-ffr-array. **`personnes.qualite_ffr` actuellement TEXT singulier** (cf. doctrine OVAL-E v1.3 §8bis) alors qu'un licencié peut avoir simultanément plusieurs qualités (ex: dirigeant + arbitre + soigneur). Migration future à prévoir : `qualite_ffr` TEXT → `qualites_ffr` ARRAY + ajout `qualite_ffr_principale` TEXT. Priorité faible, à grouper avec l'import OVAL-E été 2026 (Phase 5).

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
│   ├── supabase-client.js                 # wrapper SupabaseHub
│   └── dashboard-stats.js                 # v1.1 — utilise RPC get_dashboard_stats
├── sql/
│   ├── 01-creation-tables-vague1.sql
│   └── 02-migration-referentiels-vague1.sql
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit (données perso)
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
| `Doctrine-Import-OVAL-E-v1.1.md` | `1puTaNLXno99T4C9ECkEIgi1YGbk6bE41` | Doctrine import licences FFR (v1.2 et v1.3 ajoutées le 11 mai 2026 dans le même dossier Drive) |
| `Conception-Portail-Phase-3.md` | `12xrICwk5NTzk1XZLpq964CkWwhft3zc2` | Conception portail Phase 3 livrée 12 mai 2026 |
| `Audit-Referentiels-v1.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Audit des 6 référentiels métier (11 mai 2026) |
| `Schema-cible-Supabase-aptitudes.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Pattern de migration Drive → Supabase (12 mai 2026) |
| `Modelisation-Evenements-v1.0.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Modélisation événements v1.0 (12 mai matin) — superseded par v1.1, conservée pour traçabilité |
| `Modelisation-Evenements-v1.1.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | **Modélisation événements v1.1 (12 mai soir)** — référence canonique pour Phase 4, intègre arbitrage Option C (Vague 1 conservée) |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit module Compos (v2) — à reprendre post-modélisation événements |
| `Audit-Module-Suivi-Match.md` | — | Audit module Suivi-Match — à reprendre post-modélisation événements |
| `Audit-Module-Rapport.md` | — | Audit module Rapport — à reprendre post-modélisation événements |
| `Audit-Module-Statistiques.md` | — | Audit module Stats — à reprendre post-modélisation événements |
| `Audit-Module-Bilans.md` | — | Audit module Bilans — à reprendre post-modélisation événements |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit du modèle Personnes (v1.1 ajoutée le 11 mai 2026 dans le même dossier Drive) |
| `Registre-anomalies-OVAL-E.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Registre des anomalies de réconciliation FFR |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h` (6 fichiers JSON existants + `groupes-joueur.json` à déposer post-modélisation événements)
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE` (sous-dossiers joueurs/parents/contacts-externes)

---

## 🚀 Prochaine session

**Avant de démarrer toute Phase 4** :
1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Lire `Modelisation-Evenements-v1.1.md` (le document de référence canonique pour les futurs CREATE TABLE de Phase 4, après arbitrage Option C)
4. Vérifier que la chaîne Hub → Supabase fonctionne toujours (ouvrir `https://manu-mom.github.io/mom-hub/`, F12 console, doit afficher `✅ MOM Hub Dashboard: stats mises à jour depuis Supabase` ET `🏉 MOM Hub · Supabase Client v1.4 chargé`)
5. Vérifier que le portail affiche bien **323 personnes** (compteur dynamique post-Phase 2.4.5) et que les boutons d'auth réagissent (icône grille + flèche en mode admin, pilule verte "Se connecter" en mode anonyme)
6. Vérifier que `login.html` affiche bien `v1.4 chargé` dans la console et que l'envoi d'un Magic Link sur ton email aboutit sur `dashboard.html` avec session active

**Travaux en attente** :
- **Conv Production** : la Phase 3 est terminée + Phase 4.1.B sites livrée (12 mai soir). Travaux prioritaires pour la suite Phase 4 :
  - (a) **Implémentation des tables modélisées** (cf. `Modelisation-Evenements-v1.1.md` §4) :
    - Vague 1 (CONSERVÉE intacte, à **peupler** seulement) : `ententes`, `equipes`, `equipe_joueurs`
    - Phase 4.1.B ✅ **TERMINÉE** : `sites`, `distances_sites` créés et peuplés (3 sites MOM en prod : Brencklé, Clubhouse, Holtzplatz)
    - Phase 4.2 à venir : `evenements`, `evenement_encadrants` (⚠️ `joueurs_externes` **ABANDONNÉE en v1.1**)
    - Phase 4.3 à venir : `compositions`, `composition_joueurs`, `presences`
    - Plus 1 ALTER TABLE `personnes` (M-1 réduit en v1.1 : seul `bloc_5.categorie_surclassement_uuid` ; `bloc_6.groupe_indicatif_uuid` abandonné)
  - (b) **RPC associées** : `get_evenements_a_venir`, `get_prochain_evenement_par_equipe`, `get_distance_between_sites`, `get_vivier_compo`. Débloque P4-2 et P4-3.
  - (c) **Mirror `groupes-joueur.json` v1.1** dans `data/` une fois déposé dans Drive.
  - (d) ✅ **Dette #8 RÉSOLUE** (12 mai soir) : CHECK constraint `type_personne` étendue avec `licencie_soigneur` + `licencie_arbitre`. MICHEL Stéphane (UUID `f7c3ba6f-a124-41fd-9229-0433cdb0fdc6`) reclassé `licencie_soigneur`. Reste à commiter `sql/08-extend-type-personne-check.sql` sur GitHub.
  - (e) ✅ **Dettes mineures RÉSOLUES** : logo M2M externalisé en PNG transparent (P3-mineure-1) + `04-auth-roles.sql` déplacé (P3-mineure-2).
  - (f) Déploiement comptes `coach` et `viewer` réels (préalable à P4-1).
  - (g) **🆕 D-qualite-ffr-array** (ouverte 12 mai soir) : migration future `personnes.qualite_ffr` TEXT → ARRAY (cf. section dettes ci-dessus). À grouper avec import OVAL-E été 2026.

  **Plan de découpage Phase 4 acté (12 mai 2026 soir, post-arbitrage Option C)** :
  - **Phase 4.1.A** Fondations administratives — Vague 1 (DÉBLOQUÉE post-arbitrage) : **peupler** `ententes` + `equipes` + `equipe_joueurs` (Vague 1, schémas conservés intacts). Le fichier prévu `sql/06-equipes.sql` devient `sql/06-peuplement-vague1-equipes.sql` (peuplement, pas création). K2 ÉQUIPES du portail bascule en dynamique (ferme partie de dette #5).
  - **Phase 4.1.B** ✅ **TERMINÉE** : `sql/07-sites.sql` (sites + distances_sites créés et peuplés ; API distances reportée à 4.5).
  - **Phase 4.2** Noyau événements : `sql/08-evenements.sql`, `sql/09-evenement-encadrants.sql` (⚠️ `joueurs_externes` ABANDONNÉE en v1.1 — les joueurs partenaires d'entente vivront dans `personnes` avec `bloc_5.club_principal_id` adapté). Extension `js/supabase-client.js` v1.5 avec 2-3 wrappers (`getEvenementsAVenir`, `getProchainEvenementParEquipe`).
  - **Phase 4.3** Compositions + présences : `sql/10-compositions.sql` + `composition_joueurs`, `sql/11-presences.sql`, 1 ALTER TABLE `personnes` (M-1 réduit), référentiel `groupes-joueur.json` v1.1 dans Drive, RPC `get_vivier_compo` (la plus complexe — joint `equipe_joueurs` Vague 1 pour flag d'attache régulier/renfort). **Condition préalable** : dette C7 instruite par conv Audits (audit doctrine OVAL-E pour joueurs SAR).
  - **Phase 4.4** Intégration UI portail : `dashboard-stats.js` v3 avec prochain match dans le greeting (P4-2) et nouveau widget sidebar (P4-3).
  - **Phase 4.5** API distances (optionnel) : intégration OpenRouteService + cache, RPC `get_distance_between_sites`, secret API en GitHub Actions (M-2 + M-5).

- **Conv Audits** : modélisation événements **v1.1 livrée** (12 mai 2026 soir, après arbitrage conflit Vague 1). Travaux restants côté Audits :
  - **🆕 Dette C7 (priorité)** : audit doctrine OVAL-E sur `personnes.bloc_5.club_principal_id != MOM` pour les joueurs partenaires d'entente. **À traiter avant Phase 4.3** (peuplement compositions avec joueurs SAR).
  - Lots 2 et 3 de l'audit référentiels (bloqués par tiers : règlement LRGER 2025-2026, Lohann pour EDR aptitudes, préparateur physique pour barèmes).
  - Reprise des **audits modules** (Compositions v2, Suivi-Match, Rapport, Stats, Bilans) à la lumière de la modélisation événements v1.1 pour MAJ post-Phase 2.5/3.
  - Modélisation **événements extra-sportifs** (dette Phase 5, C2 du doc modélisation).
  - Modélisation **compo adverse + joueurs adverses** (dette C1 du doc modélisation, reportée après quelques mois d'usage de l'app).
- **Conv Conception Portail** : a livré `Conception-Portail-Phase-3.md` v1.0 (Drive `12xrICwk5NTzk1XZLpq964CkWwhft3zc2`). Pour Phase 4, rouvrir un cycle Conception si besoin de définir le portail par rôle (P4-1), ou de spécifier précisément l'UX greeting/widget prochain match maintenant que la modélisation événements v1.1 est livrée (P4-2/P4-3 débloquées).
- **Futures conv Modules métier** (annoncées) : "MOM Hub - Modules Ateliers et ressources pédagogiques" et "MOM Hub - Modules Planification de la saison et préparation de séances". Trouveront dans `Modelisation-Evenements-v1.1.md` §10.3 leur point d'ancrage avec les autres conv.