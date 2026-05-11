# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 11 mai 2026 — fin Phase 2.4.5 (Réconciliation OVAL-E)**

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
- `js/supabase-client.js` : wrapper `SupabaseHub` autour du client supabase-js v2
- `js/dashboard-stats.js` v1.1 : met à jour les compteurs du dashboard via RPC
- Fonction RPC `get_dashboard_stats()` créée dans Supabase (SECURITY DEFINER)
- 5 modifs dans `index.html` : 5 IDs ajoutés (`stat-personnes`, `stat-m14`, `greeting-meta`, `greeting-sub`, `se-joueurs` optionnel) + 3 balises `<script>` avant `</body>`
- Page de diagnostic `test-supabase.html` à la racine, fonctionnelle
- **Validé visuellement** : "LUNDI 11 MAI 2026 · CONNECTÉ À SUPABASE", "293 personnes en base · données live Supabase"

### ✅ Phase 2.4.5 — Réconciliation OVAL-E (FAIT — 11 mai 2026)

Première synchronisation Supabase ↔ OVAL-E (export FFR XLSX 358 lignes, 298 personnes uniques). Permet de clore les dettes techniques #1 et #2.

**Effets sur la base** :
- C1 (doublons) : 4 DELETE + 3 UPDATE (293 → 289 lignes)
- C2 (LRGER fantôme) : 1 DELETE de la fiche WINCKLER qui contenait par erreur les données CAMPESE (289 → 288)
- C3 (enrichissement) : 2 UPDATE pour ajouter les licences FFR de JUNG Emmanuel et RULFO Vivien
- C4 (création) : 35 UPSERT pour les licenciés OVAL-E absents de Supabase (1 joueur M-10 + 22 parent_et_staff + 12 staff/dirigeant) → 288 → **323 lignes**
- C5 (comparaison des 261 en intersection) : 0 divergence — le batch correction du 10 mai avait déjà parfaitement aligné les fiches

**Évolutions schéma `personnes`** :
- CHECK constraint `personnes_categorie_personne_check` étendue avec 3 nouvelles valeurs : `joueur_et_parent`, `joueur_et_staff`, `joueur_et_parent_et_staff`
- INDEX UNIQUE créé sur `numero_licence_ffr` (idempotence des futurs imports OVAL-E)

**Pattern réutilisable saisonnier** : les scripts C4 (UPSERT `ON CONFLICT (numero_licence_ffr) DO UPDATE`) sont conçus pour être rejoués à chaque export OVAL-E (été 2026 pour saison 26-27, etc.) sans dégât. La doctrine §10 est respectée : les champs OVAL-E faisant autorité sont mis à jour, les enrichissements manuels (email, tel, adresse déjà renseignés) sont préservés via `coalesce`.

**Cible alignement OVAL-E atteinte** :
- Supabase : 323 personnes, dont **298 licenciées FFR (alignement strict OVAL-E)** + 25 non-licenciées (parents non-MOM, 1 contact LRGER CAMPESE)

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

## 🗃️ Schéma Supabase Vague 1 (état réel au 11 mai 2026, post-Phase 2.4.5)

Source de vérité agrégée — issue de `get_dashboard_stats()` :

```json
{
  "nb_personnes": 323,
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
| `personnes` | **323** | fiches Drive + reconciliation OVAL-E 2026-05-11 | ✅ rempli, **PAS de policy SELECT publique** (RGPD) |
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

**UPSERT idempotent par licence FFR pour les imports OVAL-E saisonniers (acquis Phase 2.4.5).**

Pattern :
```sql
insert into personnes (...) values (...)
on conflict (numero_licence_ffr) do update set
    -- champs §10 OVAL-E faisant autorité (toujours écrasés)
    nom = excluded.nom,
    prenom = excluded.prenom,
    qualite_ffr = excluded.qualite_ffr,
    date_fin_affiliation = excluded.date_fin_affiliation,
    -- champs hors §10 (préservation des enrichissements manuels)
    email_principal = coalesce(personnes.email_principal, excluded.email_principal),
    telephone_principal = coalesce(personnes.telephone_principal, excluded.telephone_principal),
    adresse_postale = coalesce(personnes.adresse_postale, excluded.adresse_postale),
    -- type_personne : on ne dégrade jamais un licencié vers non_licencie
    type_personne = case when personnes.type_personne in ('non_licencie','non_licencie_au_mom')
                         then excluded.type_personne else personnes.type_personne end,
    modifie_par = excluded.modifie_par,
    updated_at = now();
```

À rejouer chaque saison avec un nouvel export OVAL-E.

---

## 🩹 Dettes techniques à traiter

### ✅ Dettes résolues le 11 mai 2026 (Phase 2.4.5)

1. ~~**Écart 293 vs 294 personnes**~~ ✅ **RÉSOLU** : OVAL-E a donné l'arbitrage. Le 294 était le chiffre cible du script de migration Phase 2.0 ; le 293 réel résultait d'un doublon perdu (LUTZ Hugo parent fantôme). La base est maintenant à 323 lignes dont 298 licenciées FFR alignées OVAL-E.
2. ~~**Écart 24 vs 23 M14**~~ ✅ **RÉSOLU** : Supabase a 24 M14 = 16 M-14 + 8 F-15 intégrées. SportEasy doit avoir 1 F-15 manquante (Eden FAUVEL et Auriane DECOURCELLE sont les 2 F-15 qui n'étaient pas dans l'audit Personnes — à vérifier dans SportEasy).

### 🟡 Dettes encore actives

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Détecté lors de la migration Phase 2.0. Pas bloquant tant qu'on ne ré-importe pas, mais à corriger pour la Vague 2.
4. **Référentiels Drive `01 - Référentiels/`** : 6 fichiers JSON existent (postes, ateliers, aptitudes, conformite-ffr, observables-match, tests-physiques) mais leur **contenu et conformité à la doctrine reste à évaluer** (Axe B / conv Audits).
5. **Chiffres en dur résiduels dans index.html** : "16 Sites" et "11 Équipes" restent en dur tant que les tables `sites` et `equipes` ne sont pas créées/remplies (Phase 2.2 future). Le compteur "323 personnes" est désormais dynamique via la RPC.
6. **Date `VENDREDI 8 MAI 2026 · HUB INITIALISÉ` dans le HTML statique** : remplacée dynamiquement par le JS, mais reste comme fallback en dur. Pas grave.
7. **Désalignement Drive ↔ Supabase post-réconciliation OVAL-E** (nouveau, créé par la Phase 2.4.5) : Drive contient 297 fiches Personne conformes (audit doctrine §12), Supabase en a 323. Écart de 26 fiches : il faut décider si on régénère les 26 fiches Drive manquantes ou si on accepte le désalignement (Drive devient documentaire historique, Supabase source autoritative). À arbitrer en conv Audits (Axe B).
8. **Schéma `type_personne` incomplet vs catégories FFR** (nouveau) : la FFR distingue 5 catégories de licences (Joueur, Dirigeant, Arbitre, Éducateur, Soigneur). Le schéma actuel n'autorise que 3 valeurs `licencie_*` (competition, dirigeant, educateur). Les soigneurs (`SOI`) sont actuellement rangés en `licencie_dirigeant` par défaut. À étendre si on veut fidélité FFR (ajout `licencie_soigneur` et `licencie_arbitre`).

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

---

## 📚 Documents Drive de référence

Dossier `MOM Hub/2025-2026/` :

| Document | id Drive | Rôle |
|---|---|---|
| `Doctrine-MOM-Hub-v2.md` | `1Ebx20ANb80hU0giLSfVAl8n5OSZFwJZW` | Doctrine fondatrice (simplicité, 3 lieux) |
| `Phase-2-0-decisions-architecture.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Acte décisions Phase 2.0 |
| `MOM-Core-Synthese-globale-v2.md` | `1X0FjB6Z9eVlxH0VcEQ4le2wf8eCMmmly` | Synthèse globale modèle |
| `MOM-Core-Cartographie-Globale-v2.md` | `1N2I86T751XneQT9fx1wCQWusmeCz235T` | Cartographie complète |
| `Doctrine-Import-OVAL-E-v1.1.md` | `1puTaNLXno99T4C9ECkEIgi1YGbk6bE41` | Doctrine import licences FFR (v1.2 à rédiger — cf dettes Axe B) |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit module Compos (v2) |
| `Audit-Module-Suivi-Match.md` | — | Audit module Suivi-Match |
| `Audit-Module-Rapport.md` | — | Audit module Rapport |
| `Audit-Module-Statistiques.md` | — | Audit module Stats |
| `Audit-Module-Bilans.md` | — | Audit module Bilans |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit du modèle Personnes (à compléter — cf dettes Axe B) |

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
4. Vérifier que le portail affiche bien **323 personnes** (compteur dynamique post-Phase 2.4.5)

**Travaux en attente** :
- **Conv Production** : Phase 2.5 Magic Link
- **Conv Audits** : reprise des audits + modélisation événements (matchs / entraînements / tournois) + transmission des dettes Axe B (D1-D6) issues de la réconciliation OVAL-E (voir `dettes-axe-b-reconciliation-OVAL-E.md` déposé dans Drive)
