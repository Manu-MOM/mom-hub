# MOM Hub · STATE.md
**État global du projet au 15 mai 2026, fin d'après-midi**

---

## 📊 Récapitulatif exécutif

| Aspect | Statut | Détail |
|--------|--------|--------|
| **Phases complétées** | Phase 5.12 TER + Phase 4.4 UI Évènements complète | Préparation séance + Module Évènements V1 livré |
| **Modules repo actifs** | 5/5 | Accueil v2, Compositions, Séances, Bibliothèque, Évènements |
| **Référentiels** | 7/7 | postes, ateliers, aptitudes, conformité FFR, observables, tests, encadrants |
| **Commits 15 mai matin** | 4 | seance-editor v1.11 TER, seance.html, encadrants JSON, STATE.md |
| **Commits 15 mai après-midi** | 9 | sql/29, sql/30, sql/31, supabase-client.js v1.11, evenements.html v4, evenements-browser.js v1.4.1, index.html v2, STATE.md, + kickoffs |
| **Prochaine conv** | Module Joueurs (Phase 5.14) | Audit + conception + production module Joueurs |

---

## 🏗️ Architecture repo

### **Dossier `/` racine**
```
mom-hub/
├── index.html                    (Accueil v2, portail 5 sections 20 tuiles)
├── seance.html                   (Préparation séance, Phase 5.12 TER)
├── compositions.html             (Compositions, Phase 4.4)
├── evenements.html               (Évènements V1, S2.4.b — NEW 15 mai)
├── bibliotheque.html             (Bibliothèque ateliers EDR)
├── css/
│   ├── hub.css                   (Thème MOM + variables globales)
│   ├── compositions.css
│   └── seance.css
├── js/
│   ├── supabase-client.js        (v1.11, RPC wrappers + 7 wrappers WRITE évents)
│   ├── seance-editor.js          (v1.11 TER, IIFE)
│   ├── compositions-editor.js    (v2.1.5)
│   └── evenements-browser.js     (v1.4.1, IIFE — NEW 15 mai)
├── sql/
│   ├── 29-rpc-evenements-c9.sql     (RPC C9 lecture, NEW 15 mai)
│   ├── 30-rpc-evenements-c9-fix.sql (fix evenement_parent_id, NEW 15 mai)
│   └── 31-rpc-evenements-c9-fix2.sql (fix phase_libelle+ordre, NEW 15 mai)
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

Module complet livré dans **une seule conv** (Joueurs/Évènements), découpé en **S1 backend + S2 UI** selon doctrine MOM Hub :

#### **S1 — Backend RPC + wrappers lecture (Clos ~14h30)**

- [x] **sql/29-rpc-evenements-c9.sql** — 4 RPC C9 :
  - `get_evenements_a_venir(equipe_id, jours_a_venir)` — modifiée (ajout `compo_status_summary JSONB`)
  - `get_prochain_evenement_par_equipe(equipe_id)` — recréée
  - `get_evenements_passes(equipe_id, jours_passes, limit)` — NOUVELLE (C9-a)
  - `get_evenement_with_encadrants(evenement_id)` — NOUVELLE (C9-b, retourne array JSONB encadrants)
- [x] **js/supabase-client.js v1.8.6 → v1.10** — merge propre (saut v1.9 documenté) :
  - 2 wrappers lecture : `getEvenementsPasses`, `getEvenementWithEncadrants`
  - Préservation totale des wrappers Phase 5.12 (séances)
- [x] **Test data SQL** : 6 matchs enfants au tournoi Challenge Vié via `test-matchs-enfants-challenge-vie.sql` (NON commit, diagnostic local)

#### **S2.1 — Squelette UI (Clos ~15h15)**

- [x] **evenements.html v1** (598 lignes) — topbar Hub partagée, KPIs, recherche, filtres TYPE (5) + COMPÉT (4), layout 1fr 280px, FAB, 3 modales squelettes
- [x] **js/evenements-browser.js v1.0** (438 lignes) — IIFE calqué sur bibliotheque-browser.js, state filtres, prefs localStorage

#### **S2.2 — Cartes + déploiement tournois + mini-cal (Clos ~15h45)**

- [x] **evenements.html v2** (948 lignes) — +350 lignes CSS : cartes avec trait coloré gauche par type_competition, icône SVG type, pastilles statut compo (4 états), animation flash highlight, déploiement tournoi inline, mini-cal grid 7 colonnes L-D
- [x] **js/evenements-browser.js v1.1** (733 lignes) — buildIndexes() EVENTS_BY_ID + CHILDREN_BY_PARENT, TYPE_ICONS, statutCompoBadge, renderCard avec chevron tournoi, renderEnfantsTournoi groupés par phase, renderMiniCal + scrollToFirstEventOfDay

##### **S2.2.fix — 2 patches SQL + correction JS**

- [x] **sql/30-rpc-evenements-c9-fix.sql** — Ajout `evenement_parent_id UUID` aux 3 RPC liste (17 → 18 cols). Sans cette colonne, les matchs enfants remontaient comme racines, KPI à 21 au lieu de 15.
- [x] **sql/31-rpc-evenements-c9-fix2.sql** — Ajout `phase_libelle TEXT` + `ordre_dans_phase INTEGER` aux 3 RPC liste (18 → 20 cols). Sans ces colonnes, déploiement tournoi affichait "(sans phase)" au lieu des phases attendues.
- [x] **js/evenements-browser.js v1.2** (756 lignes) — fix renderEnfantCard : si libellé commence par "vs " (case-insensitive), ne pas réafficher adversaire_nom (évite doublon "vs Nancy  vs Nancy")

#### **S2.3 — Fiche détaillée slide-in droite (Clos ~16h15)**

- [x] **evenements.html v3** (1283 lignes) — +335 lignes : panneau slide-in droite 480px (mobile plein écran), overlay 32% noir, header sticky, 7 sections empilées
- [x] **js/evenements-browser.js v1.3** (1051 lignes) — `openFiche`, `closeFiche`, `renderFiche` avec 7 sections conditionnelles (Identité, Score si rempli, Phases si tournoi, Parent si enfant, Logistique conditionnelle, Encadrants, Notes, Actions). Clic carte parent OU enfant ouvre fiche. Mode lecture seule V1, boutons disabled avec tooltip "Câblage en S2.4". Fermeture Escape + clic overlay + ✕. Wrapper : `getEvenementWithEncadrants`.

#### **S2.4.a — 7 wrappers WRITE supabase-client (Clos ~16h45)**

- [x] **js/supabase-client.js v1.10 → v1.11** (2178 lignes, +431) — 7 wrappers ÉCRITURE (doc Conception §9.1) :
  1. `createEvenement(payload)` — INSERT, etat forcé 'creation', whitelist 17 champs
  2. `duplicateEvenement(srcId, overrides)` — V1 duplique parent seul (dette V2 cascade)
  3. `addMatchToTournoi(tournoiId, payload)` — hérite type_competition/saison/equipe/organisateur/format/site du parent
  4. `updateEvenement(id, patch)` — UPDATE whitelist 15 champs métier
  5. `cancelEvenement(id, motif)` — etat → 'annule', garde-fou `.in('etat',...)`, motif dans notes_resultat préfixé '[ANNULÉ]'
  6. `reactivateEvenement(id)` — etat 'annule' → 'creation', garde-fou `.eq('etat','annule')`
  7. `updateLogistique(id, jsonbPayload)` — UPDATE colonne logistique_deplacement, accepte null
- Conventions Hub : `{ ok, data?, error? }`, `.maybeSingle()`, `console.error('MOM Hub: <fn>()', error)`, JSDoc complet
- Smoke test console PASSÉ : cancel + reactivate Challenge Vié OK

#### **S2.4.b — Câblage 3 modales E3/E4/E5 (Clos ~17h)**

- [x] **evenements.html v4** (1533 lignes, +250) — Forms HTML complets :
  - E3 Création : radio 5 types, libellé, date début/fin (cond.), site dropdown dynamique, type_competition (cond.), format_de_jeu (cond.), adversaire, domicile_exterieur
  - E4 Annulation : récap event + textarea motif + bouton rouge
  - E5 Ajout match : phase (datalist autocomplete), libellé, heure, adversaire, format
- [x] **js/evenements-browser.js v1.4** (1558 lignes, +507) — câblage complet :
  - `loadModalContext()` : récupération **dynamique** saison_id + organisateur_principal_id (anti-invention)
  - 3 paires `openModal*/closeModal*/submitModal*`
  - `bindFicheActions()` : Annuler/Réactiver de la fiche (Modifier reporté V1.1)
  - `reloadEvents()` : recharge sans reload de page
  - `generateEventCode()` : pattern EVT-YYYY-MM-DD-TYPE-M14-RAND

#### **S2.5 — Clôture (Clos ~17h30)**

- [x] **index.html v1 → v2** (1121 lignes) — Refonte portail selon `Conception-Portail-Architecture-v2.md` :
  - Section 01 PÉDAGOGIE EDR : 4 tuiles (Ressources péda nouveau / Bibliothèque / Préparation séance / Planification annuelle renommée). Suppression "Comportements attendus" (absorbée).
  - Section 02 MON ÉQUIPE : 5 tuiles (**Évènements DISPONIBLE** / Joueurs / Compos renommée / Suivis de Match nouveau / Statistiques nouveau). Suppression "Présences" + "Convocations" + "Carnet de progression".
  - Section 03 LOGISTIQUE MOM : renommée (CLUB → MOM), 4 tuiles unifiées autour de "Réservation"
  - Sections 04/05 inchangées
- [x] **js/evenements-browser.js v1.4 → v1.4.1** (1581 lignes) — fix UX scroll modale : auto-scrollTop après message d'erreur/succès (sinon invisible si scrollé)

---

## 🔧 Versions dépendances

| Module | Version | État |
|--------|---------|------|
| supabase-client.js | **v1.11** | ✅ +7 wrappers WRITE évents |
| seance-editor.js | v1.11 TER | ✅ Matin |
| seance.html | Phase 5.12 TER | ✅ Matin |
| **evenements.html** | **v4** | ✅ NEW après-midi |
| **evenements-browser.js** | **v1.4.1** | ✅ NEW après-midi |
| **index.html** | **v2** | ✅ Refondu après-midi |
| compositions-editor.js | v2.1.5 | ✅ Stable |

---

## 📍 Points clés doctrinaux S1+S2 (cette conv)

### **Architecture module Évènements V1**

```
┌─────────────────────────────────────────────┐
│ Page evenements.html (1533 lignes)          │
│ • KPIs · filtres · liste cartes · mini-cal  │
│ • 3 modales E3/E4/E5 · fiche slide-in       │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ js/evenements-browser.js v1.4.1 (1581 l.)   │
│ Module IIFE window.EvenementsBrowser.init() │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ js/supabase-client.js v1.11 (2178 lignes)   │
│ 2 wrappers RPC C9 + 7 wrappers WRITE        │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ sql/29 + sql/30 + sql/31                    │
│ 4 RPC C9 → table evenements (RLS sql/25)    │
└─────────────────────────────────────────────┘
```

### **Anti-invention au runtime**
- `saison_id` et `organisateur_principal_id` récupérés **dynamiquement** à l'init via lecture directe table evenements (dernier évent M14). Pas de hardcode.
- Sites via `SupabaseHub.listSitesActifs()` (existant v1.8.1)
- Seul `M14_TEAM_UUID` est constante module (équipe propriétaire de la page)

### **Découpage S1/S2 — leçon doctrinale**
La séparation **backend (S1) → UI (S2)** a payé. Bénéfices :
- Smoke test SQL pur avant tout JS
- Versionning JS distinct (v1.10 read-only puis v1.11 add WRITE)
- Réaction rapide si modélisation backend a un défaut (sql/30 puis sql/31)

### **Doctrine "tester avec données hiérarchiques"**
Bug découvert en S2.2 : le smoke test S1 avait validé les RPC à vide d'enfants. Une fois 6 matchs créés sous Challenge Vié, on a découvert que `evenement_parent_id` n'était pas remonté. **Leçon** : quand modélisation contient self-référence, tester systématiquement avec données parent+enfants peuplées avant de clore S1.

---

## 🐛 Dettes ouvertes

### **Dettes Phase 5.12 (matin) — préservées**
- `loadBrouillonsVides()` appelé mais non utilisé après création séance

### **Nouvelles dettes Phase 4.4 UI Évènements**

#### **Dettes V1.1 (proches)**
| Code | Description |
|---|---|
| P4-UI-evenements-1 | Bouton "✏️ Modifier" fiche détaillée disabled. Nécessite modale E6 avec form pré-rempli + `updateEvenement(id, patch)` |
| P4-UI-evenements-2 | `duplicateEvenement` V2 cascade enfants (V1 duplique parent seul) |
| P4-UI-evenements-3 | Section logistique fiche : affichage JSON brut V1, formattage structuré V1.1 |
| P4-UI-evenements-4 | Auto-scroll modale fix UX ad-hoc dans 3 endroits — factoriser en helper `showModalMessage()` |

#### **Dettes V2 (lointaines)**
| Code | Description |
|---|---|
| P4-UI-evenements-5 | Multi-coachs : UUID organisateur récupéré du dernier évent — à revisiter pour onboarding nouveau coach |
| P4-UI-evenements-6 | Filtre `etat` exposé dans l'UI (afficher/masquer annulés/archivés) |
| P4-UI-evenements-7 | Édition encadrants depuis fiche détaillée (actuellement lecture seule) |
| P4-UI-evenements-8 | Édition matchs enfants tournoi (drag&drop réordo, changement phase) |
| P4-UI-evenements-9 | Pagination événements passés au-delà de 50 (limit actuelle) |
| P4-UI-evenements-10 | Vue calendrier complet (mois entier en grille style Google Calendar) |

### **Dettes Phase 4.4 wrappers WRITE (à monitor)**
| Code | Description |
|---|---|
| C10-a | `cancelEvenement` cascade vers compositions actives (transition auto `validee` → `annulee` ?) — arbitrage post-Suivi Match |
| C10-b | `cancelEvenement` annule pas matchs enfants tournoi annulé (cascade orchestrée UI V1 uniquement) |

### **Dettes refonte portail v2**
| Code | Description |
|---|---|
| Portail-V2-1 | Tuile "Préparation séance" reste DISPONIBLE alors que doc v2 la marque "À VENIR" — arbitrage : préserver l'état réel |
| Portail-V2-2 | 11 dettes sessions conception module (cf. `Conception-Portail-Architecture-v2.md` §3) |

---

## 🚀 Prochaines phases (pipeline)

### **Phase 5.14 — Module Joueurs** (Conv suivante — kickoff prêt)
- Audit Joueurs : conv Audits → `Audit-Module-Joueurs-v1.md`
- Conception UX Joueurs : conv Conception Portail → session dédiée post-audit
- Backend (S1) : RPC liste joueurs + fiche joueur, wrappers lecture
- UI (S2) : page joueurs.html + js/joueurs-browser.js sur le modèle Évènements
- Activation tuile "Joueurs" dans index.html section 02

### **Phase 5.15+**
- Module Statistiques (post-Évènements + post-Joueurs)
- Module Suivis de Match (transition `validee` → `utilisee`)
- Module Ressources pédagogiques (catch-all)
- Modules Logistique MOM (Infrastructures / Minibus / VEO / Autres)

---

## 📁 Fichiers à committer (15 mai après-midi)

| Fichier | Version | Statut |
|---|---|---|
| sql/29-rpc-evenements-c9.sql | v1.0 | ✅ Commité |
| sql/30-rpc-evenements-c9-fix.sql | v1.0 | ✅ Commité |
| sql/31-rpc-evenements-c9-fix2.sql | v1.0 | ✅ Commité |
| js/supabase-client.js | v1.11 | ✅ Commité |
| evenements.html | v4 | ✅ Commité |
| js/evenements-browser.js | v1.4.1 | ✅ Commité |
| index.html | v2 | ⏳ À committer |
| STATE.md | (ce fichier) | ⏳ À committer |

---

## 📝 Leçons doctrinales consolidées (cette conv)

1. **Découpage S1 backend / S2 UI** : pattern à reproduire pour Joueurs et tous modules futurs
2. **Smoke test SQL avec données hiérarchiques** : tester systématiquement parent+enfants peuplés avant clore S1 (leçon sql/30+sql/31)
3. **Anti-invention runtime** : tout UUID structurel doit venir d'une lecture base, pas d'un hardcode
4. **Versioning JS micro** : v1.4 → v1.4.1 pour fix UX ponctuel (vs v1.5 pour feature)
5. **Bumped en parallèle** : récupérer version GitHub réelle avant remplacement, merger explicitement (jamais écraser à l'aveugle)
6. **Vérifier en base avant code** : `pg_get_function_result(oid)` avant de supposer qu'une colonne remonte
7. **1 fichier = 1 commit** strictement respecté : 9 commits cet après-midi
8. **Picker `ask_user_input_v0`** : utilisé à chaque clarif structurante — pas-à-pas doctrinal validé
9. **UX scroll modale** : les messages d'erreur/succès doivent être visibles sans scroll utilisateur — auto-scrollTop systématique

### **Vocabulaire MOM Hub stabilisé**
- **MOM** = Mutzig Ovalie Molsheim (club)
- **SAR** = Structure partenaire ateliers
- **OVAL-E** = Plateforme FFR license management
- **Référent** = Coach principal catégorie
- **Encadrants** = Staff
- **S1 / S2** = découpage Backend / UI pour un module
- **C9 / C10** = numérotation interne RPC évents

---

## 🔐 Sécurité

- RLS write sur table evenements (sql/25) : `has_role('admin') OR has_role('coach')` côté authenticated
- Manu = admin (`auth_roles.user_id = 7ac40334...`, role = 'admin') → wrappers WRITE testés OK
- Aucun identifiant personnel public, cache navigateur 7j

---

**Document généré : 15 mai 2026, fin d'après-midi (post-S2.5)**
**Prochaine maj : Après Phase 5.14 (Module Joueurs)**
