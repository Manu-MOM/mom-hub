# PASSATION.md — Kit de démarrage MOM Hub

> Document à coller dans la 1ère message des nouvelles conversations pour que Claude reprenne efficacement.
> Complémentaire de STATE.md (état général technique) — ce fichier-ci sert à scinder le travail par THÉMATIQUE.

**Créé le 11 mai 2026, fin de Phase 2.4.**

---

## 🎯 Pourquoi ce document ?

À partir du 11 mai 2026, le travail MOM Hub se scinde en **2 axes parallèles** travaillés dans des conversations Claude distinctes :

| Axe | Thématique | Sortie attendue |
|---|---|---|
| **A · Production** | Le portail vivant : code, déploiement, base Supabase, auth, features utilisateur | Du code + de la doc qui finit sur GitHub/Supabase |
| **B · Audits & modélisation** | La réflexion sur les schémas métier : événements, suivi-match, stats, bilans, etc. | Des schémas JSON + des audits déposés sur Drive |

Les deux axes partagent le même STATE.md mais avancent indépendamment.

---

## ✅ Ce qui est COMMUN aux deux axes

Lis **STATE.md** à la racine du repo `Manu-MOM/mom-hub`. C'est la source de vérité technique.

Points doctrinaux à ne JAMAIS oublier (rappel) :
- **Simplicité d'usage avant tout**. Si tu as l'impression de proposer une cathédrale, t'es en train de te tromper.
- **Le Hub est un agrégateur**, pas une migration. Pas de fork SAR×MOM Compos (abandonné définitivement).
- **Budget 0 €**. Stack GitHub Pages + Supabase free + Drive.
- **Repo GitHub PUBLIC** : ne JAMAIS commit clé `service_role`, fiches Personne brutes, données sensibles.
- Manu code peu mais sait suivre ; il **préfère recevoir des fichiers complets prêts à uploader** plutôt qu'appliquer des patches lui-même.
- Style attendu : honnêteté brute, propose pauses si fatigue, recommande mais respecte choix Manu.
- **Pas-à-pas obligatoire** avec "OK" entre micro-étapes.
- Toujours faire `conversation_search` AVANT de proposer du neuf, vérifier l'état réel des fichiers Drive/GitHub/Supabase AVANT de coder.

---

## 🅰️ AXE A — Conv "MOM Hub · Production"

### Démarrage propre

**Premier message à coller dans la nouvelle conv** :

> Salut Claude. On reprend MOM Hub côté production.
> Avant toute proposition : lis `STATE.md` à la racine de `Manu-MOM/mom-hub` (search_files Drive ou web_fetch GitHub raw).
> Phase 2.4 (portail dynamique) est terminée et validée. Prochaine étape : Phase 2.5 — Authentification Magic Link.
> Roadmap Phase 2.5 dans STATE.md : table `auth_roles`, config Magic Link Supabase, page `login.html`, gestion session JS, `dashboard.html` sécurisée, tests bout-en-bout.
> On commence par l'étape 1 (table `auth_roles`) dès que tu as fini la lecture. Pas de proposition avant.

### Périmètre de la conv Production
- ✅ Code JS/HTML/CSS du Hub
- ✅ SQL Supabase (tables, RLS, RPC, fonctions, triggers)
- ✅ Workflows GitHub Actions
- ✅ Auth / sessions / rôles
- ✅ Tests bout-en-bout
- ✅ Dettes techniques #1 et #2 du STATE.md (réconciliation 293/294, 23/24)
- ❌ PAS de modélisation événements/matchs/stats (ça va dans axe B)
- ❌ PAS d'audit conceptuel des référentiels (axe B)

### Roadmap immédiate
1. **Phase 2.5.1** : Créer table `auth_roles` (~15 min)
2. **Phase 2.5.2** : Config Magic Link Supabase + sender
3. **Phase 2.5.3** : Page `login.html` simple
4. **Phase 2.5.4** : Extension `supabase-client.js` pour gérer sessions
5. **Phase 2.5.5** : `dashboard.html` post-login (compteurs déjà OK via RPC)
6. **Phase 2.5.6** : Routing : `/index.html` → check session → redirect login si non-loggué
7. **Phase 2.5.7** : Tests bout-en-bout sur 3 rôles
8. **Phase 2.5.8** : Mettre à jour STATE.md → Phase 2.5 ✅

---

## 🅱️ AXE B — Conv "MOM Hub · Audits & modélisation"

### Démarrage propre

**Premier message à coller dans la nouvelle conv** :

> Salut Claude. On reprend MOM Hub côté modélisation/audits, en parallèle du travail de production qui se poursuit dans une autre conversation.
> Avant toute proposition : lis `STATE.md` à la racine de `Manu-MOM/mom-hub`, ET la doctrine Drive (`Doctrine-MOM-Hub-v2.md`, id `1Ebx20ANb80hU0giLSfVAl8n5OSZFwJZW`).
> Périmètre : modélisation des entités métier non encore en base (événements matchs/entraînements/tournois, sites, équipes, présences, compositions, observables, etc.), audit/évaluation des référentiels Drive existants.
> Pas de code de production ici. Tout passe par des schémas JSON et des documents d'audit déposés dans Drive.
> Première tâche : choisir ensemble par où commencer (modélisation événements OU évaluation référentiels Drive existants).

### Périmètre de la conv Audits
- ✅ Schémas JSON métier (modélisation conceptuelle)
- ✅ Documents d'audit dans Drive
- ✅ Évaluation des référentiels existants vs doctrine
- ✅ Spécifications conceptuelles pour la Vague 2 (événements, équipes, sites)
- ✅ Reprise des audits déjà rédigés (Compositions v2, Suivi-Match, Rapport, Stats, Bilans, Personnes)
- ❌ PAS de code SQL ni JS de production (ça va dans axe A)
- ❌ PAS d'écriture en base Supabase ni dans le repo GitHub

### Pistes prioritaires (à arbitrer en début de conv)

**Piste 1** : **Modélisation événements** (la plus urgente, identifiée comme prochaine session dans le STATE.md précédent)
- Matchs / entraînements / tournois / déplacements
- Lien avec personnes (présences, compositions, statuts)
- Lien avec équipes (Vague 2)
- Sortie : schéma JSON + doc d'audit déposé dans Drive

**Piste 2** : **Audit des 6 référentiels JSON Drive** (`01 - Référentiels/`)
- postes, ateliers, aptitudes, conformite-ffr, observables-match, tests-physiques
- Évaluer leur conformité à la doctrine (simplicité, format)
- Détecter incohérences, propositions de simplification
- Sortie : doc d'audit `Audit-Referentiels-v1.md` déposé dans Drive

**Piste 3** : Reprise des audits déjà rédigés pour MAJ post Phase 2.0/2.4

À demander à Manu en début de conv : *"Tu préfères qu'on commence par quelle piste ?"*

---

## 🔁 Synchronisation entre les 2 axes

Le STATE.md à la racine du repo est le point de vérité partagé :
- **Conv A (Production)** met à jour STATE.md à la fin de chaque phase
- **Conv B (Audits)** lit STATE.md en début de session pour connaître l'état tech, dépose ses sorties dans Drive
- Si Conv B identifie un travail de production (ex: "il faut créer la table `evenements`"), elle l'ajoute en **dette technique** dans STATE.md, et Conv A le prendra plus tard

**Règle d'or** : pas de double-tâche entre les conv. Si tu as un doute sur "où ça va", relis ce document.

---

## 📦 Inventaire fichiers de référence à porter dans chaque nouvelle conv

À avoir sous la main au démarrage :

| Fichier | Où il est | Pour quel axe |
|---|---|---|
| `STATE.md` | racine repo GitHub | A et B |
| `PASSATION.md` (ce doc) | racine repo GitHub | A et B |
| `Doctrine-MOM-Hub-v2.md` | Drive `00 - Documentation/` | A et B |
| `Phase-2-0-decisions-architecture.md` | Drive `00 - Documentation/` | A surtout |
| `Audit-Module-*.md` (5 docs) | Drive `00 - Documentation/` | B surtout |
| `MOM-Core-Synthese-globale-v2.md` | Drive | B surtout |
| `MOM-Core-Cartographie-Globale-v2.md` | Drive | B surtout |

---

## 🆘 En cas de doute

Si tu (Claude) ne sais plus dans quelle conv tu es ou ce que tu dois faire :
1. **STOP**. Ne propose rien.
2. Demande à Manu : *"Je vérifie : on est sur l'axe Production (code/Hub) ou Audits (modélisation/Drive) ?"*
3. Une fois la réponse reçue, relis le périmètre ci-dessus.
4. Puis seulement, propose.

**Manu n'a pas peur des questions de cadrage.** Il a peur que Claude propose des trucs hors-périmètre sans vérifier.
