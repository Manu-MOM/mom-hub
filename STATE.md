# MOM Hub · STATE.md

**État global du projet au 16 mai 2026**

> ⚠️ **Note de méthode — fiabilité de ce STATE.**
> Ce STATE.md a été **reconstruit à partir du code réellement déployé** (9 fichiers HTML de référence au 16/05/2026 : `index.html`, `evenements.html`, `joueurs.html`, `compositions.html`, `seance.html`, `bibliotheque.html`, `dashboard.html`, `login.html`, `test-supabase.html`), recoupé avec le Drive `00 - Documentation`.
> Il **remplace** le `STATE.md — Phase 5.12 TER (15 mai 2026)` (Drive `11R263U75dm4UkzWKQC4CrJpOo1qlfVn9ZEgy-uTCjbc`), qui était **factuellement périmé** : figé le 15 mai à 13:40, donc **avant** les livraisons Évènements (« 15/05 après-midi ») et Joueurs (« 15/05 soir, Phase 5.14 »).
> Chaque ligne porte un marqueur de fiabilité :
> - 🟢 **PROUVÉ** = constaté directement dans le code déployé (source de vérité)
> - 🟡 **À CONFIRMER** = non vérifiable depuis le HTML seul (versions JS internes, état SQL/RPC, dettes) — à confirmer côté conv Production
> - ⚪ **DRIVE** = établi via le Drive (audits, docs de conception)

---

## 📊 Récapitulatif exécutif

| Aspect | Statut | Détail | Fiab. |
|--------|--------|--------|-------|
| **Modules en ligne** | **5 outils métier + 3 système** | Bibliothèque, Préparation séance, Évènements, Joueurs, Compos + index/dashboard/login | 🟢 |
| **Modules métier todo** | Suivis de Match, Statistiques | `todo` dans index.html | 🟢 |
| **Niveau de complétude** | Hétérogène | Compos/Séance/Biblio matures ; Évènements/Joueurs = squelette UI | 🟢 |
| **Client Supabase** | `js/supabase-client.js` partagé | Chargé par tous les modules ; pattern `SupabaseHub` (auth) | 🟢 |
| **Version supabase-client** | v1.8.6 | Dernière version connue (STATE 15/05 + audits) | 🟡 |
| **Prochaine conv métier** | Suivi Match v2 → Conception → Production | Audit v2 en cours (conv Audits) | ⚪ |

---

## 🟢 État réel des modules (prouvé par le code déployé)

Reconstitué depuis `index.html` (badges `on`/`todo`) + en-têtes des fichiers HTML.

### Section 01 — Pédagogie EDR (4 outils, 2 disponibles)

| Outil | Fichier | Statut | Détail prouvé |
|---|---|---|---|
| Ressources pédagogiques | — | 🔲 todo | « À venir » |
| **Bibliothèque d'ateliers** | `bibliotheque.html` + `js/bibliotheque-browser.js` | ✅ **EN LIGNE** | « 4 rubriques · 62 fiches » |
| **Préparation de séance** | `seance.html` + `js/seance-editor.js` | ✅ **EN LIGNE** | Phase 5.12 TER, supabase-client v1.8.6, picker encadrants/matériel/ateliers |
| Planification annuelle | — | 🔲 todo | « À venir » |

### Section 02 — Mon équipe M14 SAR×MOM (5 outils, 3 disponibles)

| Outil | Fichier | Statut | Détail prouvé |
|---|---|---|---|
| **Évènements** | `evenements.html` + `js/evenements-browser.js` | ✅ **EN LIGNE (squelette UI)** | Livré « 15/05 après-midi » (S2.4.b). CSS `.evt-*`, calqué bibliotheque/seance. Commentaires code : « ZONE LISTE (S2.2 peuplera ceci) », « FAB Nouvel événement (S2.4 le câblera) », « MODALES (squelettes vides, contenu S2.4) » → **déployé mais pas fonctionnellement complet** |
| **Joueurs** | `joueurs.html` + `js/joueurs-browser.js` | ✅ **EN LIGNE (squelette UI)** | Livré « 15/05 soir ». En-tête code : « Version : v0 — 15 mai 2026 · Phase 5.14 · Module Joueurs · S2.1 », « calqué sur evenements.html v4 (S2.1 squelette) ». Filtres postes `postes.json` v1.1 |
| **Compos** | `compositions.html` + `js/compositions-editor.js` | ✅ **EN LIGNE** | « Phase 4.4 UI éditeur de compositions ». Le plus mature des trois |
| **Suivis de Match** | — | 🔲 **todo** | « À venir » · sous-titre code : « Tenue · score · événements » |
| **Statistiques** | — | 🔲 todo | « À venir » · « Équipe · joueurs · saison » |

### Sections 03 / 04 / 05 — Logistique / Pilotage club / Espace famille

🔲 **Tout `todo`** (prouvé) : Réservation infrastructures, Minibus, VEO, Autres réservations / Tableau de bord EDR, Licences, Cotisations, Communication / Mon enfant, Covoiturage, Espace joueur.

### Modules système

| Fichier | Rôle | Statut |
|---|---|---|
| `index.html` | Portail / tableau de bord | ✅ EN LIGNE — auth `SupabaseHub`, greeting dynamique, sidebar (OVAL-E, qualité données, prochain événement M14, raccourcis) |
| `dashboard.html` | Tableau de bord admin | ✅ EN LIGNE — `js/dashboard-stats.js` |
| `login.html` | Connexion | ✅ EN LIGNE |
| `test-supabase.html` | Page de test technique | ✅ présent |

---

## 🏗️ Architecture repo (reconstituée depuis le code)

```
mom-hub/
├── index.html                 ✅ portail (auth SupabaseHub, KPI, sidebar)
├── dashboard.html             ✅ admin
├── login.html                 ✅ connexion
├── test-supabase.html         ✅ test technique
├── bibliotheque.html          ✅ Bibliothèque ateliers
├── seance.html                ✅ Préparation séance (Phase 5.12 TER)
├── compositions.html          ✅ Compos (Phase 4.4 UI)
├── evenements.html            ✅ Évènements (squelette S2.x, déployé 15/05 a-m)
├── joueurs.html               ✅ Joueurs (v0 squelette S2.1, déployé 15/05 soir)
├── css/
│   └── hub.css                ✅ thème commun (chargé par tous)
├── js/
│   ├── supabase-client.js     ✅ client + SupabaseHub (auth)  [v1.8.6 🟡]
│   ├── dashboard-stats.js     ✅ stats portail
│   ├── bibliotheque-browser.js ✅
│   ├── seance-editor.js       ✅ [v1.11 TER 🟡]
│   ├── compositions-editor.js ✅ [v2.1.5 🟡]
│   ├── evenements-browser.js  ✅ [version 🟡]
│   └── joueurs-browser.js     ✅ [version 🟡]
└── assets/
    └── logo-m2m.png           ✅
```

🟡 Les numéros de version JS entre crochets viennent du STATE 15/05 / des audits, **non revérifiables depuis le HTML** (scripts externes non fournis). À confirmer côté Production.

---

## ⚪ État Drive — Documentation (audits & conception)

Inventaire `00 - Documentation` (parentId `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`), par date de création réelle (métadonnées Drive font foi) :

| Document | Créé | Rôle |
|---|---|---|
| `Audit-Module-Suivi-Match.md` | 10 mai | Audit v1 (à réviser v2 — **en cours, conv Audits**) |
| `Audit-Module-Rapport.md` | 10 mai | Audit v1 |
| `Audit-Module-Statistiques.md` | 10 mai | Audit v1 |
| `Audit-Module-Bilans.md` | 10 mai | Audit v1 |
| `Audit-Module-Compositions-v3.md` | 13 mai | Révisé post-Phase 4.3 |
| `Audit-Ateliers-v1.md` | 13 mai | Audit ateliers |
| `Audit-Module-Evenements-v1.md` | 15 mai 05:27 | Audit v1 |
| `Audit-Module-Joueurs-v1.md` | 15 mai 05:40 | Audit v1 |
| `Conception-Portail-Architecture-V2.md` | 15 mai 05:12 | Architecture v2 portail |
| `Conception-Portail-UI-Evenements.md` | 15 mai 07:12 | Conception UX Évènements |
| `Conception-Portail-UI-Joueurs.md` | 15 mai 07:58 | Conception UX Joueurs |
| `STATE.md — Phase 5.12 TER` | 15 mai 13:40 | **Périmé** (remplacé par le présent STATE) |

⚪ **`Doctrine-Interconnexion-Modules-v1.md` : n'existe pas encore sur Drive.** Annoncée en parallèle côté conv Conception Portail, non livrée à ce jour. L'audit Suivi Match v2 signalera les tensions d'interconnexion pour l'alimenter.

---

## 🔧 Pile technique (état connu)

| Élément | Valeur | Fiab. |
|---|---|---|
| Front | HTML/CSS/JS statique, `css/hub.css` commun, préfixes CSS par module (`.evt-*`, `.joueur-*`, `.seance-*`) | 🟢 |
| Auth | `SupabaseHub` (getSession / isAdmin / onAuthChange / signOut) | 🟢 |
| Backend | Supabase (`@supabase/supabase-js@2` via CDN jsdelivr) | 🟢 |
| Client JS | `js/supabase-client.js` v1.8.6 | 🟡 |
| Modèle données | Phase 4.2 (`evenements`) + 4.3 (`compositions`, `composition_joueurs`, `presences`) | ⚪/🟡 |
| Référentiels | 7 (postes v1.1, ateliers, aptitudes, conformité-ffr, observables-match, tests-physiques, encadrants-par-categorie) | ⚪ |

---

## 🚀 Pipeline (prochaines étapes)

### En cours — conv Audits
- 🔄 **Audit-Module-Suivi-Match v1 → v2** : réalignement post-Phase 4.2/4.3 + arbitrage périmètre « Suivi Match » vs « Suivi d'événement » (question doctrinale ouverte, à trancher par Manu). Préalable à la construction du module (vignette 2.4, `todo`).

### Ensuite
- Conception UX Suivi Match (conv Conception Portail) une fois l'audit v2 validé
- Production Suivi Match
- Complétion fonctionnelle Évènements (S2.2 liste, S2.4 modales/FAB) et Joueurs (au-delà du squelette S2.1) — **dette de complétude à confirmer Production**
- Statistiques (audit v1 existant, non encore conçu/produit)

### Dettes ouvertes — 🟡 à confirmer côté Production
Non vérifiables depuis le HTML déployé. À récupérer via le dernier message / PASSATION de la conv Production :
- Dettes Évènements (C9-a `get_evenements_passes`, C9-b `get_evenement_with_encadrants`, C9-c wrappers JS, C9-d/e mineures)
- Dettes Joueurs (C10-a→j : photos Storage, champs métier, RPC dédiées)
- C7-c (CHECK personnes), C8-d (`archivee`), (m) ASCS post-import, (n) sexe/dn partenaires, (q) durcissement `coach_equipes`
- État réel complétude fonctionnelle Évènements/Joueurs (squelette → complet)

---

## 📝 Vocabulaire stabilisé

- **MOM** = Mutzig Ovalie Molsheim (club)
- **SAR** = club partenaire entente (M14 SAR×MOM)
- **OVAL-E** = plateforme FFR de gestion des licences (**avec un A**)
- **Référent** = coach principal de catégorie (**Emmanuel Jung pour M14**, également Coach principal M14)
- **Encadrants** = staff (coachs, entraîneurs, assistants)
- **Suivis de Match** = nom de la vignette 2.4 dans le code déployé (pluriel) — périmètre en cours d'arbitrage (audit v2)

---

## 🔐 Sécurité & confidentialité

- Auth via `SupabaseHub`, modes `auth-admin` / `auth-anon` / `auth-resolved`
- Pas d'identifiant personnel (email/tel) en public
- Contrôle d'accès Drive via dossier partagé
- RGPD : doctrine confidentialité par construction (P6) — RLS Supabase 🟡 à confirmer Production

---

**STATE.md reconstruit le 16 mai 2026 depuis le code déployé (source de vérité) + Drive.**
**Remplace le STATE 15/05 13:40 (périmé). Prochaine MAJ : après réception d'un état Production pour lever les 🟡.**
