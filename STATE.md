# MOM Hub — État du projet

*Dernière mise à jour : 11 mai 2026*

Ce fichier résume **où on en est** dans la construction du MOM Hub.
Il est mis à jour à la fin de chaque jalon important.

---

## 🎯 Vision

MOM Hub = plateforme web qui agrège les outils numériques du club de rugby
Mutzig Ovalie Molsheim (Bas-Rhin). Construite autour d'un **MOM Core**
(référentiels métier et fiches Personne) et de **modules natifs** branchés
dessus.

**Doctrine fondatrice** : simplicité d'usage avant tout, éviter
l'over-engineering, OVAL-E (avec un A) comme nom de la plateforme FFR.

---

## 🏗️ Architecture actuelle

```
┌─────────────────────────────────────────────────────────────┐
│  FRONT-END                                                  │
│  GitHub Pages : https://manu-mom.github.io/mom-hub/        │
│  Repo public  : https://github.com/Manu-MOM/mom-hub        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + clé anon
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND                                                    │
│  Supabase free tier : fvfqffxaiaoygqhjtxwr.supabase.co     │
│  338 lignes dans 6 tables remplies (sur 9 créées)          │
│  RLS activé partout, lecture publique sur référentiels     │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ ping quotidien 03h UTC
                              │
┌─────────────────────────────────────────────────────────────┐
│  AUTOMATION                                                 │
│  GitHub Actions : keep-alive Supabase (cron 24h)            │
│  Empêche la mise en pause après 7 jours d'inactivité       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STOCKAGE COMPLÉMENTAIRE                                    │
│  Google Drive : doctrines, audits, schémas Core (référence) │
│  Source historique des fiches Personne (avant migration)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 État des phases

```
PHASE 1 — Mise en service du Hub                ✅ DONE
  1.1 Déploiement portail sur GitHub Pages       ✅
  1.2 Repo GitHub configuré                       ✅
  1.3 Miroir Drive → GitHub (9 référentiels)     ✅
  1.4 Portail dynamique                          ⏸ Reporté (option C)

PHASE 2.0 — Fondations Supabase                 ✅ DONE
  2.0.1 Compte Supabase                          ✅
  2.0.2 Projet mom-hub                           ✅
  2.0.3 Clés API sécurisées                      ✅
  2.0.4 Modèle de tables conçu (Vague 1)        ✅
  2.0.5 9 tables créées                          ✅
  2.0.6 Policies RLS détaillées                  ⏸ Reportée à Phase 2.2
  2.0.7 5 référentiels migrés (44 lignes)        ✅
  2.0.8 294 personnes migrées                    ✅
  2.0.9 Keep-alive Supabase actif                ✅

PHASE 2.1 — Intégration Supabase au Hub        ⏳ NEXT
  → Page de login Supabase
  → Premier "Hello World" dynamique
  → Sécurisation cookies + sessions

PHASE 2.2 — Premier outil natif : MOM Compos   ⏳ APRÈS
  → Compositions d'équipes avec drag & drop
  → Conformité FFR live
  → Sous-tables Vague 2 nécessaires

PHASE 3-5 — Modules + passerelles + élargissement (lointain)
```

---

## 🗄️ Schéma Supabase (Vague 1)

```
Tables remplies (338 lignes au total)
─────────────────────────────────────
poles                  5 lignes   (EDR, Jeunes, Jeunes F, Seniors, Loisirs)
categories            14 lignes   (M5 à RLSP)
clubs                  4 lignes   (MOM, SAR, ASCS, CRIG)
saisons                1 ligne    (2025-2026 active)
postes                20 lignes   (15 XV + 5 regroupements)
personnes            294 lignes   (261 joueurs + 30 parents + 3 contacts-externes)

Tables vides (créées, en attente de Phase 2.1+)
────────────────────────────────────────────────
ententes               0
equipes                0
equipe_joueurs         0
```

**Conventions** :
- Toutes les tables ont `id UUID PK + created_at + updated_at`
- Le champ `uuid_legacy` (TEXT UNIQUE) garde le lien avec les anciens
  IDs JSON Drive (ex: `pole-edr`, `cat-m14`, `personne-e36325`)
- RLS activé partout, lecture publique sur les 5 référentiels

---

## 🚨 Dettes techniques connues

### 1. Drive personnes désynchronisé (à traiter Phase 2.2)

**Problème** : 293 fichiers JSON sur 294 ont un nom-de-fichier qui ne
correspond pas à leur contenu interne (script d'export raté dans le
passé). Le doublon WINCKLER/CAMPESE a été résolu côté Supabase.

**Statut** : Supabase est désormais la source de vérité (propre).
Le Drive sera régénéré depuis Supabase après Phase 2.2 (quand les
sous-tables Vague 2 seront en place).

### 2. Sous-tables Vague 2 à créer

Les blocs 3, 4, 6, 7, 8 des fiches Personne ne sont **pas encore migrés**
parce que les sous-tables n'existent pas :
- `personne_roles` (bloc 3)
- `personne_liens_familiaux` (bloc 4)
- `personne_postes`, `personne_aptitudes`, `personne_certifications`,
  `personne_journal_observations`, `personne_engagements_externes` (bloc 6)
- `personne_documents` (bloc 8)
- `dossiers_medicaux` (séparé, sécurisé)

À faire en Phase 2.2 avant MOM Compos.

### 3. Consentement RGPD à collecter

Le champ `consentement_rgpd_date` est NULL pour les 294 personnes.
À collecter dans une future campagne (formulaire dédié à imaginer).

### 4. Le portail HTML reste statique

`index.html` affiche encore les chiffres en dur (296 personnes, 16 sites,
11 équipes, 23 M14). Sera connecté au backend Supabase en Phase 2.1.

---

## 📁 Structure du repo `mom-hub`

```
mom-hub/
├── .github/
│   └── workflows/
│       └── keep-alive-supabase.yml      (workflow GitHub Actions)
├── data/                                 (miroir Drive des référentiels)
│   ├── README.md
│   ├── poles.json
│   ├── categories.json
│   ├── clubs.json
│   ├── postes.json
│   ├── aptitudes.json
│   ├── ateliers.json
│   ├── observables-match.json
│   ├── tests-physiques.json
│   └── conformite-ffr.json
├── js/
│   └── data-loader.js                   (chargeur JSON côté front)
├── sql/                                  (scripts de migration archivés)
│   ├── 01-creation-tables-vague1.sql
│   └── 02-migration-referentiels-vague1.sql
│   ↳ 03-migration-personnes-vague1.sql NON archivé (données nominatives)
├── README.md
├── STATE.md                              (ce fichier)
└── index.html                            (portail public)
```

⚠️ **Note sécurité** : le script `03-migration-personnes-vague1.sql`
contient des données nominatives (noms, emails, téléphones, adresses,
n° licences FFR). Il NE DOIT PAS être commit dans ce repo public.
Le conserver en local ou dans un repo privé séparé.

---

## 🔐 Secrets GitHub configurés

Dans **Settings > Secrets and variables > Actions** :

```
SUPABASE_URL        = URL projet Supabase
SUPABASE_ANON_KEY   = clé publique anon (utilisée par le keep-alive)
```

⚠️ **Ne JAMAIS commit** la `SUPABASE_SERVICE_ROLE_KEY` ni dans le repo,
ni dans les secrets GitHub Actions (pas nécessaire pour le keep-alive).

---

## 🎯 Prochaine session

Pour reprendre, dire à Claude :
> *"On reprend MOM Hub, on attaque Phase 2.1 — intégration Supabase au Hub"*

Décisions structurantes attendues en Phase 2.1 :
- Quel système d'authentification (email/password, Google, magic link) ?
- Quels rôles applicatifs (admin, coach, parent, joueur) ?
- Où héberger le code JS Supabase dans le repo ?
- Premier écran à construire pour "preuve de concept" ?

---

*Maintenu par Manu avec assistance Claude · Doctrine MOM : simplicité d'usage avant tout*
