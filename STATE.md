# MOM Hub · STATE.md

**État global du projet au 16 mai 2026**

> 🧭 **À LIRE À TOUTE REPRISE DE TRAVAUX (ordre imposé)**
> Avant de reprendre quoi que ce soit, dans **n'importe quelle** conv (`Production`, `Audits`, `Conception`…), lire dans cet ordre :
> 1. **`CARTE-CONVERSATIONS-MOM-Hub.md`** — index maître : quelle conv fait quoi, laquelle ouvrir. Se place *au-dessus* de ce STATE.
> 2. **`PASSATION.md`** — kit de démarrage générique (discipline, où trouver quoi).
> 3. **CE `STATE.md`** — vérité opérationnelle du code (la présente version est une **fusion** : reconstruite conv `Audits` → enrichie conv `Conception` 16/05 → **repli de la résolution DS-1 par conv `Audits` le 16/05** ; succède à toutes les versions antérieures — toute copie antérieure est périmée).
> 4. Le **message de passation thématique** éventuel collé en tête de la conv reprise.
>
> Les 3 fronts vivants portent des noms courts : **`Production`** (code/SQL/déploiement), **`Audits`** (modélisation/audits/doctrine), **`Conception`** (portail + doctrine d'interconnexion + conception UX modules ← *cette conv a produit la présente MAJ*). Règle de coexistence : une conv = un sujet.

> 🔧 **MAJ Conception 16/05 — ce qui a changé depuis la version conv Audits.**
> Les lignes portant le marqueur **🔧 MAJ Conception 16/05** ont été modifiées par la session de conception du 16/05 (après le commit conv Audits). Synthèse des changements :
> - **Conception UX du Suivi de rencontre LIVRÉE** (`Conception-Portail-UI-Suivi.md`, 6 paquets S-1→S-6, cohérente, validée par Manu) → pipeline mis à jour.
> - **Dette DS-1 ouverte** (incohérence modélisation `chronologie_suivi` ↔ conception UX, bloquant la production de C12-a) → ajoutée aux dettes.
> - **Doctrine d'interconnexion : EXISTE désormais, en v1.2** (le STATE Audits disait « n'existe pas encore » — obsolète). Produite conv Conception, intègre DI-6 levée + DI-CHR-1.
> - **Patch `Conception-Portail-Architecture-V2` v1.1** produit (statuts réels DISPONIBLE, fermetures dettes P4-V2-1→4, note méthodo référentiels JSON).
> - Le reste du STATE (état code déployé, pile technique) **n'a pas changé** : pas de nouveau déploiement de code dans cette session (conception pure, pas de production).

> 🔧 **MAJ Audits 16/05 (post-Conception) — DS-1 TRANCHÉ.**
> Repli dans ce STATE de la décision prise conv `Audits` après réception du STATE Conception. Lignes portant **🔧 MAJ Audits 16/05 (DS-1)**. Synthèse :
> - **DS-1 tranché : Option A** — la contrainte `chronologie_suivi_adverse_sans_joueur` est **assouplie** (interdit uniquement `adverse` + joueur renseigné ; autorise `notre` + `joueur_uuid` NULL, cas D-7 « Équipe / je ne sais pas »). Option sentinelle « équipe » **écartée** (= un faux nom porté en base).
> - **Modélisation passée en v1.1** (`Modelisation-Chronologie-Suivi-v1.md`, patch DS-1 : §2.3/§3.4/§3.5/§4.1/§6.1/§6.4/§8.7/§10.4 + décision M-8).
> - **C12-a n'est plus bloqué par DS-1** : la conv Production peut créer la table dès qu'elle priorise le Suivi (contrainte définitive connue).
> - **Note aval ajoutée** : les futurs audits Rapport/Stats/Bilans doivent traiter l'essai non attribué (`notre` + NULL) *exprès* (« non attribué : N essais »), pas comme un bug.
> - État du code déployé **inchangé** (décision documentaire, pas de production).
>
> ⚠️ **Gouvernance — divergence signalée.** Deux STATE.md ont été édités en parallèle (conv Audits et conv Conception), exactement le risque que la `CARTE-CONVERSATIONS` anticipait. Cette version-ci est la **fusion de référence** qui réconcilie les deux. Discipline à tenir désormais : ne pas ré-éditer un STATE de son côté sans repartir de cette fusion ; tout STATE produit par une conv doit d'abord intégrer la dernière fusion connue (méthode appliquée ici).

> 🔧 **MAJ Production 16/05 — Phase 5.14 + Phase 2 complétion Évènements + Joueurs.**
> Lignes portant **🔧 MAJ Prod 16/05**. Cette MAJ **repart de la fusion Audits/Conception** et y intègre les déploiements réels de code.
> - **Phase 5.14 Module Joueurs V1-Métier** déployée 15/05 soir : 4 SQL (32-35), supabase-client **v1.12** (+3 wrappers Joueurs), joueurs.html v1.2, joueurs-browser.js v1.2, index.html v2.1 (tuile Joueurs DISPONIBLE). Arbitrage Option 1 colonnes plates TEXT[].
> - **Phase 2 complétion fonctionnelle** déployée 16/05 : Évènements v1.4.1 → **v1.7** (+517 lignes, 4 jalons P2-E), Joueurs v1.2 → **v1.3** (+148 lignes, 3 jalons P2-J). Cadrage doctrinal strict (Doctrine Interconnexion v1.2, 3 règles : aucune anticipation Suivi, aucun couplage module→module, aucun pont pédagogie).
> - **Plusieurs 🟡 levés en 🟢** : versions JS confirmées, dettes C9 (Évènements) et C10-f/g/h/j (Joueurs) résolues.
> - État du code déployé **mis à jour** : Évènements et Joueurs ne sont plus « squelette UI » mais **fonctionnellement complets** (hors photos V1.1 et encadrants CRUD V1.1).

> ⚠️ **Note de méthode — fiabilité de ce STATE.**
> Ce STATE.md a été **reconstruit à partir du code réellement déployé** (9 fichiers HTML de référence au 16/05/2026 : `index.html`, `evenements.html`, `joueurs.html`, `compositions.html`, `seance.html`, `bibliotheque.html`, `dashboard.html`, `login.html`, `test-supabase.html`), recoupé avec le Drive `00 - Documentation`, puis **enrichi par la conv Conception 16/05** (livrables documentaires, pas de code).
> Il **remplace** le `STATE.md — Phase 5.12 TER (15 mai 2026)` (Drive `11R263U75dm4UkzWKQC4CrJpOo1qlfVn9ZEgy-uTCjbc`), périmé.
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
| **Niveau de complétude** | 🔧 MAJ Prod 16/05 — **Évènements et Joueurs fonctionnellement complets** (Phase 2 livrée) | Compos/Séance/Biblio matures ; Évènements v1.7 + Joueurs v1.3 = Phase 2 complète (hors photos V1.1 et encadrants CRUD V1.1) | 🟢 |
| **Client Supabase** | `js/supabase-client.js` partagé | Chargé par tous les modules ; pattern `SupabaseHub` (auth) | 🟢 |
| **Version supabase-client** | 🔧 MAJ Prod 16/05 — **v1.12** | +3 wrappers Joueurs (Phase 5.14) + 7 wrappers Évènements WRITE (Phase 4.4) | 🟢 |
| **Suivi de rencontre** | **Conçu (UX), pas produit** | 🔧 MAJ Audits 16/05 (DS-1) — audit v2.1 + modélisation v1.1 + conception UX complète ; **DS-1 tranché, plus aucun verrou de modélisation** ; reste priorisation production | ⚪ |
| **Prochaine conv métier** | Suivi : Production C12 (quand priorisé) | 🔧 MAJ Audits 16/05 (DS-1) — audit + modélisation + conception UX + DS-1 faits ; ne reste que la priorisation prod (après v2 Évènements) | ⚪ |

---

## 🟢 État réel des modules (prouvé par le code déployé)

Reconstitué depuis `index.html` (badges `on`/`todo`) + en-têtes des fichiers HTML. **Inchangé par la session Conception 16/05** (aucun déploiement de code dans cette session).

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
| **Évènements** | `evenements.html` + `js/evenements-browser.js` | ✅ **EN LIGNE — Phase 2 complète** | 🔧 MAJ Prod 16/05 — evenements-browser **v1.7** (2098 lignes). P2-E.1 duplication, P2-E.2 édition fiche (E6/E7), P2-E.3 logistique structurée (E8), P2-E.5 mobile repliable. Dette V1.1 : encadrants CRUD (P2-E.4). | 🟢 |
| **Joueurs** | `joueurs.html` + `js/joueurs-browser.js` | ✅ **EN LIGNE — Phase 2 complète** | 🔧 MAJ Prod 16/05 — joueurs-browser **v1.3** (1428 lignes). Phase 5.14 V1-Métier (3 RPC + 3 modales édition) + P2-J.1 conformité FFR structurée + P2-J.2 mobile + P2-J.3 FAB/footer Annuaire. sql/32-35 (ALTER + RPC). Dette V1.1 : photos (C10-a→e). | 🟢 |
| **Compos** | `compositions.html` + `js/compositions-editor.js` | ✅ **EN LIGNE** | « Phase 4.4 UI éditeur de compositions ». Le plus mature des trois |
| **Suivis de Match** | — | 🔲 **todo (code)** · ⚪ **conçu (UX)** | 🔧 MAJ Audits 16/05 (DS-1) — code non démarré, **conception UX complète livrée** (`Conception-Portail-UI-Suivi.md`), périmètre Option C, **DS-1 tranché (modélisation v1.1)**. Prod en attente de **priorisation seule** (plus de verrou modélisation). Sous-titre code : « Tenue · score · événements » |
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
├── evenements.html            ✅ Évènements (Phase 2 complète — 1719 lignes)
├── joueurs.html               ✅ Joueurs (Phase 2 complète — 1461 lignes)
├── css/
│   └── hub.css                ✅ thème commun (chargé par tous)
├── js/
│   ├── supabase-client.js     ✅ client + SupabaseHub (auth)  [v1.12 🟢 MAJ Prod 16/05]
│   ├── dashboard-stats.js     ✅ stats portail
│   ├── bibliotheque-browser.js ✅
│   ├── seance-editor.js       ✅ [v1.11 TER 🟡]
│   ├── compositions-editor.js ✅ [v2.1.5 🟡]
│   ├── evenements-browser.js  ✅ [v1.7 🟢 MAJ Prod 16/05 — Phase 2 complet]
│   └── joueurs-browser.js     ✅ [v1.3 🟢 MAJ Prod 16/05 — Phase 2 complet]
└── assets/
    └── logo-m2m.png           ✅
```

🟡 Les numéros de version JS entre crochets viennent du STATE 15/05 / des audits, **non revérifiables depuis le HTML** (scripts externes non fournis). À confirmer côté Production. **Aucun fichier de code modifié par la session Conception 16/05.**

---

## ⚪ État Drive — Documentation (audits & conception)

Inventaire `00 - Documentation` (parentId `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`). 🔧 MAJ Conception 16/05 — ajout des livrables de la session Conception (à déposer par Manu si pas encore fait) :

| Document | Créé | Rôle |
|---|---|---|
| `Audit-Module-Suivi-Match.md` | 10 mai | Audit v1 (révisé → v2.1) |
| `Audit-Module-Rapport.md` | 10 mai | Audit v1 |
| `Audit-Module-Statistiques.md` | 10 mai | Audit v1 |
| `Audit-Module-Bilans.md` | 10 mai | Audit v1 |
| `Audit-Module-Compositions-v3.md` | 13 mai | Révisé post-Phase 4.3 |
| `Audit-Ateliers-v1.md` | 13 mai | Audit ateliers |
| `Audit-Module-Evenements-v1.md` | 15 mai 05:27 | Audit v1 |
| `Audit-Module-Joueurs-v1.md` | 15 mai 05:40 | Audit v1 |
| `Conception-Portail-Architecture-V2.md` | 15 mai 05:12 | Architecture v2 portail — 🔧 **patché v1.1 le 16/05** (statuts DISPONIBLE, fermetures P4-V2-1→4, note méthodo référentiels JSON) |
| `Conception-Portail-UI-Evenements.md` | 15 mai 07:12 | Conception UX Évènements |
| `Conception-Portail-UI-Joueurs.md` | 15 mai 07:58 | Conception UX Joueurs |
| `Audit-Module-Suivi-Match-v2.md` (v2.1) | 16 mai | ⚪ Audit v2.1 — Option C tranchée, patch doctrinal. Déposé conv Audits |
| `Modelisation-Chronologie-Suivi-v1.md` | 16 mai | ⚪ Modélisation `chronologie_suivi` (DI-6 levée). **v1.1** 🔧 MAJ Audits 16/05 (DS-1) — patch DS-1 intégré (contrainte assouplie). Déposé conv Audits |
| `Doctrine-Interconnexion-Modules-v1.2.md` | 16 mai | 🔧 **MAJ Conception 16/05 — EXISTE désormais** (le STATE Audits disait « n'existe pas »). v1.2 : DI-6 fermée, DI-CHR-1 ajoutée, dettes reséquencées C11→C12 |
| `Conception-Portail-UI-Suivi.md` | 16 mai | 🔧 **MAJ Conception 16/05 — NOUVEAU.** Conception UX complète du Suivi de rencontre (6 paquets S-1→S-6). Périmètre Option C. 2 dettes (DS-1, DS-2) |
| `STATE.md — Phase 5.12 TER` | 15 mai 13:40 | **Périmé** |

🔧 MAJ Conception 16/05 : la mention « `Doctrine-Interconnexion-Modules-v1.md` n'existe pas encore » du STATE conv Audits est **caduque** — la doctrine existe, en v1.2 (produite conv Conception, déjà en v1.1 puis patchée v1.2 après livraison de la modélisation).

---

## 🔧 Pile technique (état connu) — inchangée session Conception

| Élément | Valeur | Fiab. |
|---|---|---|
| Front | HTML/CSS/JS statique, `css/hub.css` commun, préfixes CSS par module (`.evt-*`, `.joueur-*`, `.seance-*`) | 🟢 |
| Auth | `SupabaseHub` (getSession / isAdmin / onAuthChange / signOut) | 🟢 |
| Backend | Supabase (`@supabase/supabase-js@2` via CDN jsdelivr) | 🟢 |
| Client JS | `js/supabase-client.js` **v1.12** 🔧 MAJ Prod 16/05 | 🟢 |
| Modèle données | Phase 4.2 (`evenements`) + 4.3 (`compositions`, `composition_joueurs`, `presences`) ; `chronologie_suivi` **modélisée v1.1 non créée** (dette C12-a — 🔧 MAJ Audits 16/05 (DS-1) : **DS-1 levé, plus de pré-requis bloquant**) | ⚪/🟡 |
| Référentiels | 7 (postes v1.1, ateliers, aptitudes, conformité-ffr, observables-match, tests-physiques, encadrants-par-categorie) — IDs courts TEXT, pas UUID (note méthodo Architecture v1.1 §6) | ⚪ |

---

## 🚀 Pipeline (prochaines étapes)

### ✅ Fait — conv `Audits` (16/05)
- ✅ **`Audit-Module-Suivi-Match-v2.md` (v2.1)** : réalignement post-Phase 4.2/4.3, frontière `presences`, 6 dettes C11→C12, patch doctrinal v2.1 (C1/C2/C3/P4).
- ✅ **§0bis TRANCHÉ : Option C** « Suivi de rencontre » (`type_evenement ∈ {match, tournoi}`).
- ✅ **DI-6 / dette C11-a LEVÉE** : `Modelisation-Chronologie-Suivi-v1.md`. DDL + index + RLS + 5 RPC + double effet blessure. 4 arbitrages Manu (Q1-Q4). 6 dettes Production C12-a→f + dette instruction DI-CHR-1 (RGPD effacement).
- ✅ **DS-1 TRANCHÉ (modélisation v1.1)** 🔧 MAJ Audits 16/05 (DS-1) : contrainte `chronologie_suivi_adverse_sans_joueur` assouplie (Option A — autorise `notre` + `joueur_uuid` NULL, cas D-7 ; sentinelle écartée). **Lève le verrou de production de C12-a.** Note aval ajoutée (Rapport/Stats : essai non attribué traité exprès).

### ✅ Fait — conv `Conception` (16/05) 🔧 MAJ Conception 16/05
- ✅ **`Doctrine-Interconnexion-Modules` v1.1 puis v1.2** : récit vécu du coach, 7 principes PI, corrections doctrinales (faux argument doublon, modes découplés, trou DI-7) ; v1.2 acte DI-6 levée + DI-CHR-1.
- ✅ **Patch `Conception-Portail-Architecture-V2` v1.1** : statuts réels DISPONIBLE (Évènements/Joueurs/Préparation de séance), fermetures dettes P4-V2-1→4, note méthodo référentiels JSON (IDs courts TEXT).
- ✅ **`Conception-Portail-UI-Suivi.md` — conception UX complète** (6 paquets S-1→S-6, validée Manu) : socle 5 invariants, écran « En cours » (Option B aménagée), mécaniques (sélecteur joueur, mode capacité du moment, Période, annulations, blessure constat), Avant/Après (verrouillage dur), périphériques (lien spectateur sûr par construction, relais/reconnexion sans perte, Mode Vidéo, temps de jeu = estimation), synthèse + cohérence vérifiée vs les 5 invariants.

### ⏳ Prochaines étapes — ordre imposé par les dépendances 🔧 MAJ Audits 16/05 (DS-1)
1. ✅ **DS-1 tranché (conv `Audits`, fait)** — n'est plus un pré-requis bloquant. La contrainte définitive de `chronologie_suivi` est connue (modélisation v1.1) : la production de C12-a est débloquée.
2. **conv `Production` — Suivi en file d'attente, PAS prioritaire maintenant** : 🔧 MAJ Prod 16/05 — la **Phase 2 complétion Évènements + Joueurs est terminée**. Le Suivi viendra après, sur priorisation Manu. Quand priorisé : produire C12-a→f (ordre modélisation : a→b→f→c→d→e), **sans pré-requis DS-1 (levé)**.
3. **conv `Production` — 🔧 MAJ Prod 16/05 — terminé** : Phase 2 Évènements (4/5 jalons, dette V1.1 = encadrants CRUD) + Phase 2 Joueurs (3/3 jalons). **Cadrage respecté : aucune anticipation Suivi (Règle 1), aucun couplage module→module (Règle 2), aucun pont pédagogie (Règle 3).**
4. **DI-1** (audit Préparation de séance) puis **DI-7** (trou « suivi de séance réalisée ») — conv Audits, non urgents (temporisés par Manu).
5. **DI-CHR-1** (procédure RGPD effacement d'une personne avec historique) — conv Audits, avant mise en service du Suivi, non bloquant production.
6. **Statistiques** (audit v1 existant, non conçu/produit) — plus tard, quand la chaîne amont génère assez de données. Tenir compte de la note aval DS-1 (essai non attribué).

### Dettes ouvertes

**🔧 MAJ Conception 16/05 — dettes issues de la conception UX Suivi :**

| # | Dette | Nature | Destinataire | Bloquant ? |
|---|---|---|---|---|
| **DS-1** ✅ **TRANCHÉE** | ~~`equipe_concernee='notre'` + `joueur_uuid` NULL non permis~~ → **résolu (modélisation v1.1)** : contrainte assouplie, interdit uniquement `adverse`+joueur, autorise `notre`+NULL (cas D-7). Sentinelle écartée. | Incohérence modélisation ↔ conception **résolue** | conv Audits (fait 16/05) | ✅ Levée — C12-a débloqué |
| **DS-2** | Alerte du coach sur blessure se conçoit côté **Compositions** (lecture `composition_joueurs.etat_joueur='blesse'`), PAS dans le Suivi (PI-1) | Articulation inter-module | conv Conception (futur cycle Compositions) | 🟢 Non bloquant ; à tracer |
| **DI-CHR-1** | Procédure RGPD d'effacement d'une personne avec historique (conséquence ON DELETE RESTRICT `joueur_uuid`) | Dette d'instruction | conv Audits (lien audit Personnes) | 🟢 Non bloquant prod ; avant mise en service |

Dépendances amont tracées (pas des dettes, ne pas coder par anticipation) : DA-1 format de jeu lisible depuis équipe/événement (pré-réglage chrono M16+) ; DA-2 génération lien éphémère C12-f expose un point de config chrono (EDR). 🔧 MAJ Audits 16/05 (DS-1) — **note aval DS-1** : les futurs audits Rapport/Stats/Bilans doivent traiter l'essai `notre`+`joueur_uuid` NULL *exprès* (ligne « non attribué : N essais »), jamais l'ignorer ni fausser un total individuel (cf. modélisation v1.1 §10.4).

**Dettes Production C12 (de la modélisation, à produire quand le Suivi sera priorisé) :**
C12-a `CREATE TABLE chronologie_suivi` (🔴 bloquant Suivi ; 🔧 MAJ Audits 16/05 (DS-1) — **pré-requis DS-1 LEVÉ**, contrainte v1.1 connue) · C12-b RLS lien éphémère · C12-c RPC inserer/annuler/corriger + déclenche blessure · C12-d `get_chronologie_rencontre` payload réduit · C12-e `consolider_score_rencontre` · C12-f `generer_lien_ephemere` + payload compo réduit (génère aussi le lien spectateur distinct).

**Dettes ouvertes — 🔧 MAJ Prod 16/05 — mise à jour après Phase 5.14 + Phase 2 :**
- ✅ Dettes Évènements C9-a/b/c **RÉSOLUES** (RPC + wrappers livrés v1.11/v1.12)
- ✅ Dettes Joueurs C10-f/g/h/j **RÉSOLUES** (Phase 5.14 : sql/32-35, RPC get_joueurs_equipe/get_joueur_detail/update_joueur_metier)
- ⏰ Dettes Joueurs C10-a→e (photos) **REPORTÉES V1.1** (décision Phase 5.14 — pan Storage complet)
- ⏰ Dettes Joueurs C10-i (historique) **REPORTÉE V2** (RPC cross-module, post-Stats)
- ⏰ **P2-E.4** : Encadrants CRUD Évènements (wrappers WRITE `evenement_encadrants` + form — V1.1)
- ⏰ **P2-J-split** : Split filtre Partenaire → SAR / ASCS (incertitude codes clubs — V1.1)
- C7-c (CHECK personnes), C8-d (`archivee`), (m) ASCS post-import, (n) sexe/dn partenaires, (q) durcissement `coach_equipes` — **inchangés**
- ✅ État réel complétude Évènements/Joueurs : **confirmé Phase 2 complet** (plus "squelette")

---

## 📝 Vocabulaire stabilisé

- **MOM** = Mutzig Ovalie Molsheim (club)
- **SAR** = club partenaire entente (M14 SAR×MOM)
- **OVAL-E** = plateforme FFR de gestion des licences (**avec un A**)
- **Référent** = coach principal de catégorie (**Emmanuel Jung pour M14**, également Coach principal M14)
- **Encadrants** = staff (coachs, entraîneurs, assistants)
- **Suivis de Match** = nom de la vignette 2.4 dans le code déployé (pluriel). 🔧 MAJ Conception 16/05 — périmètre **tranché** (Option C : match + tournoi). Concept doctrinal = « suivi de rencontre ». Vignette et fichier d'audit inchangés
- 🔧 MAJ Conception 16/05 — **DS-x** = dette issue de la Conception UX ; **C12-x** = dette Production (modélisation) ; **DI-x** = dette d'instruction (doctrine) ; **DA-x** = dépendance amont (pré-requis tracé, pas codé par anticipation). 🔧 MAJ Audits 16/05 — **DS-1 tranchée** (Option A, contrainte assouplie) ; DS-2 et DI-CHR-1 restent ouvertes (non bloquantes)

---

## 🔐 Sécurité & confidentialité

- Auth via `SupabaseHub`, modes `auth-admin` / `auth-anon` / `auth-resolved`
- Pas d'identifiant personnel (email/tel) en public
- Contrôle d'accès Drive via dossier partagé
- RGPD : doctrine confidentialité par construction (P6) — RLS Supabase 🟡 à confirmer Production
- 🔧 MAJ Conception 16/05 — Suivi de rencontre conçu avec P6 par construction : payload réduit RGPD partout (numéro + nom court, jamais médical/coordonnées), lien spectateur = lien sans droit d'écriture. Dette DI-CHR-1 (effacement RGPD personne avec historique) à instruire avant mise en service

---

**STATE.md — version de référence (FUSION). Reconstruite conv `Audits` → enrichie conv `Conception` 16/05 → repli résolution DS-1 conv `Audits` 16/05 → 🔧 MAJ Production 16/05 (Phase 5.14 + Phase 2 complétion).**
**Chaîne documentaire : `CARTE-CONVERSATIONS` (index) → `PASSATION.md` (kit démarrage) → ce `STATE.md` (vérité code) → message de passation thématique. ⚠️ Discipline anti-divergence : toute conv qui produit un STATE repart de cette fusion. Prochaine MAJ : implémentation C12-a→f (Suivi priorisé), ou DI-1/DI-7 (conv Audits), ou prochaine session Production.**
