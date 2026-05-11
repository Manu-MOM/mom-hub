# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 11 mai 2026 — fin Phase 2.4**

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

⚠️ **Repo GitHub PUBLIC** : ne jamais commit la clé `service_role`, les fiches Personne brutes, ou toute donnée perso.

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
- `js/supabase-client.js` : wrapper `SupabaseHub` autour du client supabase-js v2
- `js/dashboard-stats.js` v1.1 : met à jour les compteurs du dashboard via RPC
- Fonction RPC `get_dashboard_stats()` créée dans Supabase (SECURITY DEFINER)
- 5 modifs dans `index.html` : 5 IDs ajoutés (`stat-personnes`, `stat-m14`, `greeting-meta`, `greeting-sub`, `se-joueurs` optionnel) + 3 balises `<script>` avant `</body>`
- Page de diagnostic `test-supabase.html` à la racine, fonctionnelle
- **Validé visuellement** : "LUNDI 11 MAI 2026 · CONNECTÉ À SUPABASE", "293 personnes en base · données live Supabase"

### ⏳ Phase 2.5 — Authentification (À FAIRE)
**Décisions structurantes prises** :
- **Auth Magic Link** (mail → lien éphémère, pas de mot de passe)
- **3 rôles** : admin / coach / viewer
- **Premier écran** : Dashboard chiffres clés (le portail actuel)

**Implications techniques** :
- Magic Link sender par défaut : `noreply@mail.app.supabase.io` (OK pour démarrer)
- Rate limit free tier : 4 emails/heure
- Rôles non-natifs Supabase : prévoir table `auth_roles` mappant `auth.users.id` ↔ rôle

**Roadmap détaillée Phase 2.5** :
1. Créer table `auth_roles` (SQL ~15 min)
2. Configurer Magic Link dans Supabase (Auth → Settings)
3. Page `login.html` (~30 min)
4. Gestion session JS (extension `supabase-client.js`)
5. Page `dashboard.html` sécurisée (compteurs réels, accès role-based)
6. Tests bout-en-bout

---

## 🗃️ Schéma Supabase Vague 1 (état réel au 11 mai 2026)

Source de vérité agrégée — issue de `get_dashboard_stats()` :

```json
{
  "nb_personnes": 293,
  "nb_m14": 24,
  "nb_poles": 5,
  "nb_clubs": 4,
  "nb_categories": 14
}
```

| Table | Lignes | Source | Statut |
|---|---|---|---|
| `poles` | 5 | référentiel `postes.json`/Drive | ✅ rempli, lecture publique RLS |
| `categories` | 14 | référentiel `categories.json` (mirrorée dans data/) | ✅ rempli, lecture publique RLS |
| `clubs` | 4 | référentiel manuel | ✅ rempli, lecture publique RLS |
| `saisons` | 1 | saison active 2025-2026 | ✅ rempli, lecture publique RLS |
| `postes` | 20 | référentiel `postes.json` (v1.1, format 13) | ✅ rempli, lecture publique RLS |
| `personnes` | 293 | fiches Drive `01 - Référentiels/personnes/` | ✅ rempli, **PAS de policy SELECT publique** (RGPD) |
| `ententes` | 0 | — | ⏳ Vague 2 |
| `equipes` | 0 | — | ⏳ Vague 2 |
| `equipe_joueurs` | 0 | — | ⏳ Vague 2 |

---

## 🧠 Pattern technique acquis (réutilisable)

**RPC `SECURITY DEFINER` pour exposer des agrégats sans policy publique sur les tables sensibles.**

Cas d'usage : afficher des compteurs (nb_personnes, etc.) sur une page publique, sans exposer aucune donnée perso.

Pattern :
```sql
create or replace function public.ma_fonction()
returns json
language plpgsql
security definer  -- s'exécute avec les privilèges du créateur
set search_path = public
as $$ ... $$;

grant execute on function public.ma_fonction() to anon, authenticated;
```

Côté JS : `const { data, error } = await supabase.rpc('ma_fonction');`

À réutiliser pour tous les futurs compteurs/agrégats du Hub.

---

## 🩹 Dettes techniques à traiter

1. **Écart 293 vs 294 personnes** : la base contient 293 lignes, mais on pensait avoir migré 294. À investiguer (doublon supprimé silencieusement par le script ? row perdu ? compteur précédent erroné ?).
2. **Écart 24 vs 23 M14** : Supabase indique 24 M14, SportEasy en référence 23. À réconcilier (joueur transféré ? affiliation ambiguë ?).
3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Détecté lors de la migration. Pas bloquant tant qu'on ne ré-importe pas, mais à corriger pour la Vague 2.
4. **Référentiels Drive `01 - Référentiels/`** : 6 fichiers JSON existent (postes, ateliers, aptitudes, conformite-ffr, observables-match, tests-physiques) mais leur **contenu et conformité à la doctrine reste à évaluer**.
5. **Chiffres en dur résiduels dans index.html** : "16 Sites" et "11 Équipes" restent en dur tant que les tables `sites` et `equipes` ne sont pas créées/remplies (Phase 2.2 future).
6. **Date `VENDREDI 8 MAI 2026 · HUB INITIALISÉ` dans le HTML statique** : remplacée dynamiquement par le JS, mais reste comme fallback en dur. Pas grave.

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
│   └── (3 autres)
├── js/
│   ├── data-loader.js                     # ancien loader des référentiels statiques
│   ├── supabase-client.js                 # wrapper SupabaseHub
│   └── dashboard-stats.js                 # v1.1 — utilise RPC get_dashboard_stats
├── sql/
│   ├── 01-creation-tables-vague1.sql
│   └── 02-migration-referentiels-vague1.sql
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
├── README.md
├── STATE.md                               # ← CE FICHIER
├── index.html                             # portail dynamique
└── test-supabase.html                     # page de diagnostic
```

---

## 🔐 Secrets & accès

- Secrets GitHub Actions : `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Clé `service_role` Supabase : **stockée par Manu en local, jamais commit**
- Mot de passe DB Supabase : **stocké par Manu en local**

---

## 📚 Documents Drive de référence

Dossier `MOM Hub/2025-2026/` :

| Document | id Drive | Rôle |
|---|---|---|
| `Doctrine-MOM-Hub-v2.md` | `1Ebx20ANb80hU0giLSfVAl8n5OSZFwJZW` | Doctrine fondatrice (simplicité, 3 lieux) |
| `Phase-2-0-decisions-architecture.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Acte décisions Phase 2.0 |
| `MOM-Core-Synthese-globale-v2.md` | `1X0FjB6Z9eVlxH0VcEQ4le2wf8eCMmmly` | Synthèse globale modèle |
| `MOM-Core-Cartographie-Globale-v2.md` | `1N2I86T751XneQT9fx1wCQWusmeCz235T` | Cartographie complète |
| `Doctrine-Import-OVAL-E-v1.1.md` | `1puTaNLXno99T4C9ECkEIgi1YGbk6bE41` | Doctrine import licences FFR |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit module Compos (v2) |
| `Audit-Module-Suivi-Match.md` | — | Audit module Suivi-Match |
| `Audit-Module-Rapport.md` | — | Audit module Rapport |
| `Audit-Module-Statistiques.md` | — | Audit module Stats |
| `Audit-Module-Bilans.md` | — | Audit module Bilans |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit du modèle Personnes |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h` (6 fichiers JSON, conformité à évaluer)
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE` (sous-dossiers joueurs/parents/contacts-externes)

---

## 🚀 Prochaine session

**Avant de démarrer toute Phase 2.5** :
1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Vérifier que la chaîne Hub → Supabase fonctionne toujours (ouvrir `https://manu-mom.github.io/mom-hub/`, F12 console, doit afficher `✅ MOM Hub Dashboard: stats mises à jour depuis Supabase`)

**Travaux en attente** :
- **Conv Production** : Phase 2.5 Magic Link
- **Conv Audits** : reprise des audits + modélisation événements (matchs / entraînements / tournois)
