# MOM Hub · STATE.md
**État global du projet au 15 mai 2026, fin de soirée**

---

## 📊 Récapitulatif exécutif

| Aspect | Statut | Détail |
|--------|--------|--------|
| **Phases complétées** | Phase 5.12 TER + Phase 4.4 UI Évènements + **Phase 5.14 Module Joueurs V1** | Préparation séance + Évènements + **Joueurs V1-Métier** |
| **Modules repo actifs** | **6/6** | Accueil v2, Compositions, Séances, Bibliothèque, Évènements, **Joueurs** |
| **Référentiels** | 7/7 | postes, ateliers, aptitudes, conformité FFR, observables, tests, encadrants |
| **Commits 15 mai matin** | 4 | seance-editor v1.11 TER, seance.html, encadrants JSON, STATE.md |
| **Commits 15 mai après-midi** | 9 | sql/29-31, supabase-client.js v1.11, evenements.html v4, evenements-browser.js v1.4.1, index.html v2, STATE.md, kickoffs |
| **Commits 15 mai soir** | **9** | sql/32, sql/33-fix, sql/34-fix, sql/35-fix, supabase-client.js v1.12, joueurs.html v1.1, joueurs-browser.js v1.1, index.html v2.1, STATE.md |
| **Prochaine conv** | Module Suivis de Match (Phase 5.15) ou Statistiques | Post-Joueurs |

---

## 🏗️ Architecture repo

### **Dossier `/` racine**
```
mom-hub/
├── index.html                    (Accueil v2.1, tuile Joueurs DISPONIBLE)
├── seance.html                   (Préparation séance, Phase 5.12 TER)
├── compositions.html             (Compositions, Phase 4.4)
├── evenements.html               (Évènements V1, S2.4.b)
├── joueurs.html                  (Joueurs V1, S2.4 — NEW 15 mai soir)
├── bibliotheque.html             (Bibliothèque ateliers EDR)
├── css/
│   ├── hub.css                   (Thème MOM + variables globales)
│   ├── compositions.css
│   └── seance.css
├── js/
│   ├── supabase-client.js        (v1.12, +3 wrappers Joueurs — NEW 15 mai soir)
│   ├── seance-editor.js          (v1.11 TER, IIFE)
│   ├── compositions-editor.js    (v2.1.5)
│   ├── evenements-browser.js     (v1.4.1, IIFE)
│   └── joueurs-browser.js        (v1.1, IIFE — NEW 15 mai soir)
├── sql/
│   ├── 29-rpc-evenements-c9.sql
│   ├── 30-rpc-evenements-c9-fix.sql
│   ├── 31-rpc-evenements-c9-fix2.sql
│   ├── 32-alter-personnes-metier-joueurs.sql  (v2.0 — NEW)
│   ├── 33-fix-rpc-joueurs-lecture.sql         (v1.1 — NEW)
│   ├── 34-fix-rpc-joueurs-write.sql           (v1.1 — NEW)
│   └── 35-fix-arrays-text.sql                 (v1.0 — NEW)
├── data/                         (référentiels inchangés)
├── assets/
└── README.md
```

---

## 📋 Phases complétées

### **Phase 5 — Préparation de séance** ✅ (matin du 15 mai)

Phases 5.5 → 5.12 TER inchangées. Voir versions précédentes du STATE.md pour le détail.

Synthèse : seance-editor.js v1.11 TER (3924 lignes, picker encadrants complet) + seance.html Phase 5.12 TER (2290 lignes, contexte categorie_uuid dynamique) + data/encadrants-par-categorie.json v1.0 (7 encadrants M14) + variable globale `window.momSeanceContext`.

---

### **Phase 4.4 UI Évènements — Module Évènements V1** ✅ (après-midi du 15 mai)

Module complet livré dans une seule conv, découpé en S1 backend + S2 UI selon doctrine MOM Hub. Inchangé depuis STATE.md précédent.

---

### **Phase 5.14 — Module Joueurs V1-Métier** ✅ (soirée du 15 mai)

Module complet livré dans **une seule conv** (Phase 5.14), découpé en S1.a + S1.b backend → S2.1-S2.4 UI, selon le pattern éprouvé Phase 4.4 Évènements.

**Scope V1-Métier** (arbitrage conv Production) : lecture complète + édition métier (postes, aptitudes, taille, poids, indispo, blessure, suspension, notes coach). Photos reportées V1.1 (C10-J-a à C10-J-e).

#### **S1.a — ALTER personnes (Clos ~18h)**

- [x] **sql/32-alter-personnes-metier-joueurs.sql v2.0** — 8 colonnes additives idempotentes :
  - États métier (3 col., dette C10-J-h) : `indisponibilite TEXT`, `blessure_resume TEXT`, `suspension_jusqu_au DATE`
  - Profil sportif (5 col., arbitrage Option 1) : `postes_uuids TEXT[]`, `aptitudes_uuids TEXT[]`, `taille_cm SMALLINT`, `poids_g INTEGER`, `notes_coach TEXT`
  - 2 contraintes CHECK (taille 50-250 cm, poids 5000-250000 g)
  - Bloc DO vérification (8 colonnes OK)

**Arbitrage doctrinal Option 1** (colonnes plates) : aligné avec le pattern existant (52 colonnes `personnes`), PG arrays cohérents avec `nationalites_complementaires UUID[]` déjà en table. Migration future vers Option 2 (tables liaison) possible sans casse. P1 Simplicité non négociable.

#### **S1.b — RPC lecture + écriture (Clos ~18h30)**

- [x] **sql/33-fix-rpc-joueurs-lecture.sql v1.1** — 2 RPC SECURITY DEFINER :
  - `get_joueurs_equipe(p_equipe_id UUID)` — vue liste ~30 colonnes, joueurs actifs (date_sortie NULL ou ≥ today), LEFT JOIN clubs/categories/poles, champs calculés `profil` (mom/f15/partenaire/coach/staff) et `etat_calcule` (actif/indisponible/blesse/suspendu/inactif). Smoke test M14 = 62 joueurs. Dette audit C10-J-f.
  - `get_joueur_detail(p_personne_id UUID)` — fiche ~60 colonnes avec coordonnées, identité étendue, RGPD, métadonnées. Dette audit C10-J-g.
  - Fix v1.1 : correction noms colonnes joints (clubs.code+nom_court, poles.libelle_court au lieu de nom inexistant)

- [x] **sql/34-fix-rpc-joueurs-write.sql v1.1** — 1 RPC SECURITY DEFINER :
  - `update_joueur_metier(p_personne_id UUID, p_patch JSONB)` — partial-patch whitelist 8 champs (postes_uuids, aptitudes_uuids, taille_cm, poids_g, notes_coach, indisponibilite, blessure_resume, suspension_jusqu_au). Normalisation TEXT trim+nullif. Autorisation has_role(admin/coach) + bypass superuser DB Studio. Dette audit C10-J-j.
  - Fix v1.1 : ajout clause session_user pour autoriser tests Studio

- [x] **sql/35-fix-arrays-text.sql v1.0** — Fix UUID[] → TEXT[] :
  - Les référentiels postes.json / aptitudes.json utilisent des IDs courts ("pst-011", "apt-A-001") qui ne sont pas des UUID standard. ALTER colonnes + recréation des 3 RPC avec TEXT[].

#### **S2.1 — Squelette UI (Clos ~17h40)**

- [x] **joueurs.html v0** (910 lignes) — topbar Hub partagée, bandeau "Mes joueurs — M14 SAR×MOM", KPIs (Actifs/Indispo/Blessés), recherche, 3 lignes filtres chips (Profil 6 valeurs / État 6 valeurs / Poste 10 valeurs regroupées), layout 1fr 280px, sidebar (Alertes + Aide), 3 modales squelettes J3/J4/J5, fiche slide-in J2.
- [x] **js/joueurs-browser.js v0** (359 lignes) — IIFE init, state filtres, prefs localStorage, bindings UI, render placeholder smoke check.

#### **S2.2 — Cartes joueurs + S2.3 Fiche slide-in lecture (Clos ~18h55)**

- [x] **joueurs.html v1.0** (1180 lignes, +270) — CSS cartes (.joueur-card avec stripe colorée, avatar, badges, pills postes/aptitudes, badge état), CSS sections fiche (bandeau identité, rows clé/valeur, encart notes coach, actions désactivées).
- [x] **js/joueurs-browser.js v1.0** (901 lignes, +542) — chargement backend `getJoueursEquipe(M14_TEAM_UUID)`, chargement référentiels `postes.json` + `aptitudes.json` via fetch parallèle, indexes (JOUEURS_BY_ID, POSTES_BY_ID, APTITUDES_BY_ID), `renderCard()` avec stripe par profil (vert MOM, bleu SAR, terre ASCS, ocre coach, bordeaux staff), avatar initiales, KPIs réels, sidebar alertes, filtres opérationnels (search debounce 180ms + profil + état + poste avec dégroupage), clic carte → `openFiche()` → `getJoueurDetail()` → 9 sections empilées lecture seule.
- [x] **js/supabase-client.js v1.11 → v1.12** (2178 → 2375 lignes, +197) — 3 wrappers Joueurs : `getJoueursEquipe`, `getJoueurDetail`, `updateJoueurMetier`. Pattern RPC cohérent v1.11.

#### **S2.4 — Câblage 3 modales d'édition (Clos ~19h30)**

- [x] **joueurs.html v1.1** (1276 lignes, +96) — CSS modale J3 chips postes multi-toggle + grille aptitudes cases à cocher colorées + loading state.
- [x] **js/joueurs-browser.js v1.1** (1279 lignes, +378) — 3 modales câblées :
  - J3 Profil sportif : chips postes multi-toggle (15 postes depuis postes.json), grille aptitudes cases à cocher (6A + 7B M14 depuis aptitudes.json, couleurs JSON), inputs taille_cm + poids_kg (conversion kg ↔ g), validation client
  - J4 État métier : 3 textareas (indispo, blessure, suspension date)
  - J5 Notes coach : 1 textarea, rappel privacité
  - Helpers : `showModalMessage` (auto-scrollTop, leçon Évènements), `reloadJoueurs` (refresh liste + fiche), `bindFicheActions` (3 boutons cliquables)
  - Flow après save : message succès 700ms → close modale → reloadJoueurs → reopenFiche

#### **S2.5 — Clôture (Clos ~19h45)**

- [x] **index.html v2 → v2.1** — Tuile Joueurs basculée "À VENIR" → "DISPONIBLE", href="joueurs.html"
- [x] **STATE.md** — Mis à jour avec Phase 5.14 complète

---

## 🔧 Versions dépendances

| Module | Version | État |
|--------|---------|------|
| supabase-client.js | **v1.12** | ✅ +3 wrappers Joueurs |
| seance-editor.js | v1.11 TER | ✅ Stable |
| seance.html | Phase 5.12 TER | ✅ Stable |
| evenements.html | v4 | ✅ Stable |
| evenements-browser.js | v1.4.1 | ✅ Stable |
| **joueurs.html** | **v1.1** | ✅ NEW |
| **joueurs-browser.js** | **v1.1** | ✅ NEW |
| **index.html** | **v2.1** | ✅ Tuile Joueurs active |
| compositions-editor.js | v2.1.5 | ✅ Stable |

---

## 📍 Points clés doctrinaux Phase 5.14 (cette conv)

### **Arbitrage Option 1 — Colonnes plates**
Postes et aptitudes stockés en `TEXT[]` directement sur `personnes` (au lieu de tables liaison). Justification P1 Simplicité : aligné avec le pattern 52 colonnes existant, PG arrays déjà utilisés (`nationalites_complementaires`), migration Option 2 possible plus tard sans casse. Aucune FK déclarative sur les arrays : intégrité assurée par whitelist wrapper + tolérance UI (P4).

### **Découpage S1/S2 — pattern reconduit**
Le même découpage backend → UI qu'Évènements a été appliqué. Bénéfice confirmé : les fix SQL (sql/33-fix, sql/34-fix, sql/35-fix) ont été absorbés sans casser l'UI, grâce à la séparation des couches.

### **Pattern fix SQL incrémental**
3 fix SQL livrés en cours de route (sur le modèle sql/30+sql/31 Évènements). Causes : noms colonnes joints erronés (clubs.nom → clubs.code), autorisation superuser Studio, UUID[] → TEXT[]. Doctrine préservée : idempotence, DROP+CREATE pour signatures changées.

### **Référentiels JSON = source de vérité pour IDs**
Les IDs de postes ("pst-001") et aptitudes ("apt-A-001") viennent des fichiers JSON Drive (`data/postes.json`, `data/aptitudes.json`), pas de tables SQL avec vrais UUIDs. Le module Joueurs lit ces JSON via fetch au init et construit les indexes côté client. Conséquence : `TEXT[]` obligatoire pour les arrays en base.

### **Smoke tests SQL + JS systématiques**
Chaque RPC testée en SQL Studio avant câblage JS. Chaque wrapper testé en console DevTools avant intégration UI. Pattern à reproduire.

---

## 🐛 Dettes ouvertes

### **Dettes Phase 5.12 (matin) — préservées**
- `loadBrouillonsVides()` appelé mais non utilisé après création séance

### **Dettes Phase 4.4 UI Évènements — préservées**
(Inchangées depuis STATE.md précédent — V1.1 proches + V2 lointaines)

### **Nouvelles dettes Phase 5.14 Module Joueurs**

#### **Dettes V1.1 (proches)**
| Code | Description |
|---|---|
| P5-14-joueurs-1 | Photos joueurs V1.1 (C10-J-a à C10-J-e : ALTER photo_*, bucket Storage, RLS, RPC upload/signed URL, workflow consentement) |
| P5-14-joueurs-2 | KPI "Sans email" non calculable depuis get_joueurs_equipe (email_principal absent de la vue liste — ajout colonne RPC ou sidebar différée) |
| P5-14-joueurs-3 | KPI "FFR à renouveler" non calculable (date_fin_affiliation absente de la vue liste — idem) |
| P5-14-joueurs-4 | Filtrage RGPD inter-rôle V1.1 (audit §1.5 : coach principal voit lecture étendue, resp. pôle voit lecture étendue sans édition, etc. — V1 admin unique = Manu) |
| P5-14-joueurs-5 | Migration données SAR×MOM Compos → MOM Hub (postes/aptitudes/taille/poids de ~62 joueurs — actuellement seulement Léandre BERNHART peuplé via tests) |

#### **Dettes V2 (lointaines)**
| Code | Description |
|---|---|
| P5-14-joueurs-6 | Multi-équipes : contexte coach sélecteur d'équipe (dette (q) coach_equipes) |
| P5-14-joueurs-7 | Historique joueur (RPC get_joueur_historique, dette C10-J-i audit) |
| P5-14-joueurs-8 | Intégration cross-modules : "Aligné en compo X / Y matchs cette saison", "Présent X / Y entraînements" (lecture composition_joueurs + événements) |
| P5-14-joueurs-9 | Édition identité depuis fiche joueur (lien vers Annuaire global — audit §1.3 colonne "Éditer identité") |
| P5-14-joueurs-10 | AbortController sur submit modale (si user ferme la modale pendant save, le timeout 700ms s'exécute quand même — sans conséquence mais pas propre) |

### **Dettes refonte portail v2 — préservées**
(Inchangées)

---

## 🚀 Prochaines phases (pipeline)

### **Phase 5.15 — Module Suivis de Match** (Conv suivante)
- Audit Suivi-Match : conv Audits → recommandation forte (résolution dette C3)
- Transition `validee` → `utilisee` sur compositions
- Bénévole table de marque : saisie terrain (3 champs joueur)

### **Phase 5.16+**
- Module Statistiques (post-Évènements + post-Joueurs + post-Suivis)
- Module Ressources pédagogiques
- Modules Logistique MOM (Infrastructures / Minibus / VEO / Autres)
- Photos joueurs V1.1 (C10-J-a à e)
- Migration données SAR×MOM Compos → MOM Hub

---

## 📁 Fichiers à committer (15 mai soir — Phase 5.14)

| Fichier | Version | Statut |
|---|---|---|
| sql/32-alter-personnes-metier-joueurs.sql | v2.0 | ✅ Committé |
| sql/33-fix-rpc-joueurs-lecture.sql | v1.1 | ✅ Committé |
| sql/34-fix-rpc-joueurs-write.sql | v1.1 | ✅ Committé |
| sql/35-fix-arrays-text.sql | v1.0 | ⏳ À committer |
| js/supabase-client.js | v1.12 | ✅ Committé |
| joueurs.html | v1.1 | ⏳ Dernier push à confirmer |
| js/joueurs-browser.js | v1.1 | ⏳ Dernier push à confirmer |
| index.html | v2.1 | ⏳ Bascule tuile Joueurs |
| STATE.md | (ce fichier) | ⏳ À committer |

---

## 📝 Leçons doctrinales consolidées (Phase 5.14)

1. **Découpage S1 backend / S2 UI** : pattern reconduit avec succès (3e module consécutif)
2. **Fix SQL incrémentaux** : le pattern sql/N-fix est désormais établi (3 fix absorbés sans casser l'UI)
3. **Référentiels JSON = IDs courts, pas UUIDs** : TEXT[] obligatoire en base, pas UUID[] (leçon sql/35)
4. **Arbitrage Option 1 (colonnes plates)** : validé terrain, cohérent, réversible vers Option 2 plus tard
5. **Smoke test SQL Studio + bypass superuser** : le bypass session_user IN ('postgres') est un pattern à reproduire pour tout RPC SECURITY DEFINER (leçon sql/34-fix)
6. **Diagnostic schema avant RPC** : toujours inspecter information_schema avant de supposer les noms de colonnes (clubs.nom n'existe pas → clubs.code+nom_court)
7. **Conversion kg ↔ g symétrique** : poids_g INTEGER en base, affichage en kg côté UI, conversion × 1000 dans submit et / 1000 dans render. Pas de floats.
8. **Chips multi-toggle + grille aptitudes** : pattern UX réutilisable pour tout module futur qui manipule des référentiels JSON multi-select
9. **Auto-scrollTop modale** : systématique après affichage erreur/succès (hérité Évènements S2.5)

### **Vocabulaire MOM Hub stabilisé (ajouts Phase 5.14)**
- **Option 1** = colonnes plates postes_uuids TEXT[] / aptitudes_uuids TEXT[] sur personnes
- **C10-J-\*** = dettes audit Module Joueurs (suffixe J pour différencier de C10-a/b Évènements)
- **profil** = catégorisation calculée d'un joueur (mom / f15 / partenaire / coach / staff / autre)
- **etat_calcule** = état métier calculé (actif / indisponible / blesse / suspendu / inactif)

---

## 🔐 Sécurité

- RLS write sur table evenements (sql/25) : `has_role('admin') OR has_role('coach')` côté authenticated
- **RPC SECURITY DEFINER Joueurs** (sql/33-fix, sql/34-fix, sql/35-fix) : pas de SELECT/UPDATE direct sur `personnes` (P6 confidentialité par construction). Check has_role + fallback auth.uid + bypass superuser Studio.
- Manu = admin (`auth_roles.user_id = 7ac40334...`, role = 'admin') → wrappers WRITE testés OK
- Aucun identifiant personnel public, cache navigateur 7j

---

**Document généré : 15 mai 2026, fin de soirée (post-Phase 5.14 S2.5)**
**Prochaine maj : Après Phase 5.15 (Module Suivis de Match ou Statistiques)**
