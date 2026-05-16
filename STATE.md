# MOM Hub · STATE.md

**État global du projet au 16 mai 2026**

> 🧭 **À LIRE À TOUTE REPRISE DE TRAVAUX (ordre imposé)**
> Avant de reprendre quoi que ce soit, dans **n'importe quelle** conv (`Production`, `Audits`, `Conception`…), lire dans cet ordre :
> 1. **`CARTE-CONVERSATIONS-MOM-Hub.md`** — index maître : quelle conv fait quoi, laquelle ouvrir. Se place *au-dessus* de ce STATE.
> 2. **`PASSATION.md`** — kit de démarrage générique (discipline, où trouver quoi).
> 3. **CE `STATE.md`** — vérité opérationnelle du code (fusion : reconstruite conv `Audits` → enrichie conv `Conception` 16/05 → repli DS-1 conv `Audits` 16/05 → MAJ Production 16/05 Phase 5.14 + Phase 2 → **MAJ Production 16/05 (C12) : Suivi priorisé + C12-a→f produits**). Succède à toutes les versions antérieures.
> 4. Le **message de passation thématique** éventuel collé en tête de la conv reprise.
>
> Les 3 fronts vivants portent des noms courts : **`Production`** (code/SQL/déploiement), **`Audits`** (modélisation/audits/doctrine), **`Conception`** (portail + doctrine d'interconnexion + conception UX modules). Règle de coexistence : une conv = un sujet.

> 🔧 **MAJ Conception 16/05.** Conception UX du Suivi LIVRÉE (`Conception-Portail-UI-Suivi.md`, 6 paquets S-1→S-6). Dette DS-1 ouverte puis tranchée. Doctrine d'interconnexion en v1.2 (DI-6 levée + DI-CHR-1). Patch `Conception-Portail-Architecture-V2` v1.1. Aucun code déployé dans cette session (conception pure).

> 🔧 **MAJ Audits 16/05 (DS-1) — TRANCHÉ.** DS-1 = Option A : contrainte `chronologie_suivi_adverse_sans_joueur` assouplie (interdit uniquement `adverse` + joueur ; autorise `notre` + `joueur_uuid` NULL, cas D-7). Sentinelle « équipe » écartée. Modélisation passée en **v1.1**. C12-a débloqué. Note aval : Rapport/Stats doivent traiter l'essai non attribué (`notre`+NULL) *exprès*. État du code inchangé (décision documentaire).

> 🔧 **MAJ Production 16/05 — Phase 5.14 + Phase 2 complétion Évènements + Joueurs.** Repart de la fusion Audits/Conception. Phase 5.14 Module Joueurs V1-Métier déployée (sql 32-35, supabase-client **v1.12**, joueurs.html v1.2, joueurs-browser.js v1.2, index.html v2.1). Phase 2 : Évènements v1.4.1 → **v1.7**, Joueurs v1.2 → **v1.3**. Cadrage doctrinal strict (Doctrine Interconnexion v1.2 : aucune anticipation Suivi, aucun couplage module→module, aucun pont pédagogie). Évènements/Joueurs ne sont plus « squelette » mais **fonctionnellement complets** (hors photos V1.1 et encadrants CRUD V1.1).

> 🔧 **MAJ Production 16/05 (C12) — Suivi de rencontre PRIORISÉ + backend produit.**
> **Décision Manu (16/05, après-midi) : priorisation explicite du Suivi de rencontre** — c'est le déclencheur « sur priorisation Manu » que les versions précédentes anticipaient. Cette priorisation **prime** sur le « Suivi non priorisé » des versions antérieures (réconciliation explicite, anti-divergence §4 bis ; repart de la fusion 16:50).
> Produit conv `Production` (consomme modélisation `chronologie_suivi` v1.1 + conception UX Suivi S-1→S-6) :
> - **C12-a** `CREATE TABLE chronologie_suivi` + index (DDL §4.1/§4.2).
> - **C12-b** RLS « table fermée » (recommandation forte §5.2 : zéro policy permissive, accès 100 % via RPC SECURITY DEFINER).
> - **C12-f** table **`lien_suivi`** (jetons éphémères) + `generer_lien_ephemere` + **lien spectateur distinct** (sûr par construction, S-5.1.a) + `get_compo_reduite_rencontre` (payload RGPD réduit) + hook `config_chrono` (DA-2, stocké non interprété) + helpers `valider_lien_suivi`, `chronologie_nom_court_personne`. **PI-7 appliqué** (compo `validee` active = pré-condition dure du lien `saisie`). Relais = nouveau lien révoque les `saisie` actifs précédents (S-5.2.a).
> - **C12-c** `inserer_observable` / `annuler_observable` / `corriger_observable` + **double effet blessure** (PI-6 : update `composition_joueurs.etat_joueur='blesse'`, jamais d'écriture `presences`). Garde-fou DS-1 (adverse→joueur NULL forcé ; notre+NULL OK).
> - **C12-d** `get_chronologie_rencontre` payload réduit (seule RPC lecture v1, décision Q4).
> - **C12-e** `consolider_score_rencontre` (score = SUM par camp des lignes non annulées, photo dans `evenements`).
> - 6 fichiers SQL livrés en téléchargement (ordre d'exécution **a→b→f→c→d→e**) + recette de déploiement. **À exécuter dans Supabase + ranger dans `sql/` + commiter** (pas encore fait au moment de cette MAJ : production des scripts faite, déploiement base à la main de Manu).
> - 🟡 **À CONFIRMER (Production) — 1 seul câblage** : fonction `chronologie_nom_court_personne` (C12-f) à brancher sur la source nom RGPD-safe `personnes` existante (non inventée volontairement). Tout le reste est opérationnel ; le Suivi tourne avec les numéros en attendant.
> - 🟡 **À CONFIRMER (Audits)** : gate de saisie. La modélisation §6.1 dit « termine/archive » mais le schéma réel `evenements` (Modelisation-Evenements-v1.1 §4.2/§7.1) n'a **pas** d'état `termine` (états : creation|compo|joue|resultat|archive|annule). Choix conservateur retenu : bloque la saisie si `etat IN ('archive','annule')` ; corrections Mode Vidéo possibles jusqu'à `archive`. À trancher : faut-il aussi bloquer dès `resultat` ?

> ⚠️ **Gouvernance — divergence signalée et réconciliée.** Le message de passation thématique d'ouverture de la conv `Production` Suivi disait « Production non démarrée, produire C12-a » alors que la fusion STATE 16:50 et le PASSATION fin de journée disaient « Suivi non priorisé, attente priorisation explicite Manu ». Réconcilié explicitement : Manu a tranché la priorisation (16/05), elle prime. Cette version intègre la fusion 16:50 + la production C12. Discipline tenue : on repart de la fusion de référence, on ne ré-édite pas une branche parallèle.

> ⚠️ **Note de méthode — fiabilité.** STATE reconstruit depuis le code déployé (9 HTML de référence), recoupé Drive `00 - Documentation`, enrichi conv Conception, MAJ Production. Marqueurs : 🟢 PROUVÉ (code déployé) · 🟡 À CONFIRMER (non vérifiable depuis HTML : versions JS, état SQL/RPC, dettes) · ⚪ DRIVE (audits, docs).

---

## 📊 Récapitulatif exécutif

| Aspect | Statut | Détail | Fiab. |
|--------|--------|--------|-------|
| **Modules en ligne** | **5 outils métier + 3 système** | Bibliothèque, Préparation séance, Évènements, Joueurs, Compos + index/dashboard/login | 🟢 |
| **Modules métier todo (UI)** | Suivis de Match, Statistiques | `todo` dans index.html (backend Suivi produit mais UI non démarrée) | 🟢 |
| **Niveau de complétude** | Évènements/Joueurs Phase 2 complets | Compos/Séance/Biblio matures ; Évènements v1.7 + Joueurs v1.3 (hors photos V1.1, encadrants CRUD V1.1) | 🟢 |
| **Client Supabase** | `js/supabase-client.js` v1.12 | +3 wrappers Joueurs (5.14) + 7 wrappers Évènements WRITE (4.4) | 🟢 |
| **Version supabase-client** | **v1.12** | — | 🟢 |
| **Suivi de rencontre** | **Backend C12 produit ; à déployer ; UI à faire** | 🔧 MAJ Prod 16/05 (C12) — audit v2.1 + modélisation v1.1 + conception UX + DS-1 + **C12-a→f produits (SQL livrés)**. Reste : exécution Supabase + commit + 1 câblage `nom_court` + UI Suivi | ⚪/🟡 |
| **Prochaine conv métier** | Suivi : déploiement C12 + UI | 🔧 MAJ Prod 16/05 (C12) — backend produit, priorisé par Manu | ⚪ |

---

## 🟢 État réel des modules (prouvé par le code déployé)

Reconstitué depuis `index.html` (badges `on`/`todo`) + en-têtes HTML. Inchangé par les sessions documentaires Conception/Audits.

### Section 01 — Pédagogie EDR (4 outils, 2 disponibles)

| Outil | Fichier | Statut | Détail prouvé |
|---|---|---|---|
| Ressources pédagogiques | — | 🔲 todo | « À venir » |
| **Bibliothèque d'ateliers** | `bibliotheque.html` + `js/bibliotheque-browser.js` | ✅ EN LIGNE | « 4 rubriques · 62 fiches » |
| **Préparation de séance** | `seance.html` + `js/seance-editor.js` | ✅ EN LIGNE | Phase 5.12 TER, picker encadrants/matériel/ateliers |
| Planification annuelle | — | 🔲 todo | « À venir » |

### Section 02 — Mon équipe M14 SAR×MOM (5 outils, 3 disponibles)

| Outil | Fichier | Statut | Détail prouvé |
|---|---|---|---|
| **Évènements** | `evenements.html` + `js/evenements-browser.js` | ✅ EN LIGNE — Phase 2 complète | 🔧 MAJ Prod 16/05 — evenements-browser **v1.7**. P2-E.1 duplication, P2-E.2 édition fiche, P2-E.3 logistique structurée, P2-E.5 mobile repliable. Dette V1.1 : encadrants CRUD (P2-E.4) |
| **Joueurs** | `joueurs.html` + `js/joueurs-browser.js` | ✅ EN LIGNE — Phase 2 complète | 🔧 MAJ Prod 16/05 — joueurs-browser **v1.3**. Phase 5.14 V1-Métier (3 RPC + 3 modales) + P2-J.1 conformité FFR + P2-J.2 mobile + P2-J.3 FAB/footer. sql/32-35. Dette V1.1 : photos (C10-a→e) |
| **Compos** | `compositions.html` + `js/compositions-editor.js` | ✅ EN LIGNE | Phase 4.4 UI éditeur. Le plus mature |
| **Suivis de Match** | — (backend produit, UI todo) | 🔲 todo (UI) · ✅ backend C12 produit · ⚪ conçu (UX) | 🔧 MAJ Prod 16/05 (C12) — **C12-a→f produits** (SQL livrés, à déployer Supabase + commit). Conception UX complète, modélisation v1.1, DS-1 tranché. UI Suivi non démarrée. Sous-titre code : « Tenue · score · événements » |
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
├── index.html            ✅ portail (auth SupabaseHub, KPI, sidebar)
├── dashboard.html        ✅ admin
├── login.html            ✅ connexion
├── test-supabase.html    ✅ test technique
├── bibliotheque.html     ✅ Bibliothèque ateliers
├── seance.html           ✅ Préparation séance (Phase 5.12 TER)
├── compositions.html     ✅ Compos (Phase 4.4 UI)
├── evenements.html       ✅ Évènements (Phase 2 complète)
├── joueurs.html          ✅ Joueurs (Phase 2 complète)
├── css/
│   └── hub.css           ✅ thème commun
├── js/
│   ├── supabase-client.js     ✅ client + SupabaseHub (auth) [v1.12 🟢]
│   ├── dashboard-stats.js     ✅ stats portail
│   ├── bibliotheque-browser.js ✅
│   ├── seance-editor.js       ✅ [v1.11 TER 🟡]
│   ├── compositions-editor.js ✅ [v2.1.5 🟡]
│   ├── evenements-browser.js  ✅ [v1.7 🟢 Phase 2]
│   └── joueurs-browser.js     ✅ [v1.3 🟢 Phase 2]
├── sql/
│   ├── … (Vague 1 → 35, Phases 4.x/5.14)
│   └── 🔧 C12-a→f (Suivi) — PRODUITS, à déployer + ranger ici
└── assets/
    └── logo-m2m.png      ✅
```

🟡 Versions JS entre crochets non revérifiables depuis le HTML seul. Aucun fichier de code applicatif modifié par les sessions documentaires. Les SQL C12 sont produits mais leur exécution en base + commit restent à la main de Manu (MAJ Prod 16/05 C12).

---

## ⚪ État Drive — Documentation (audits & conception)

Inventaire `00 - Documentation` (parentId `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`).

| Document | Créé | Rôle |
|---|---|---|
| `Audit-Module-Suivi-Match.md` | 10 mai | Audit v1 (révisé → v2.1) |
| `Audit-Module-Rapport.md` | 10 mai | Audit v1 |
| `Audit-Module-Statistiques.md` | 10 mai | Audit v1 |
| `Audit-Module-Bilans.md` | 10 mai | Audit v1 |
| `Audit-Module-Compositions-v3.md` | 13 mai | Révisé post-Phase 4.3 |
| `Audit-Ateliers-v1.md` | 13 mai | Audit ateliers |
| `Audit-Module-Evenements-v1.md` | 15 mai | Audit v1 |
| `Audit-Module-Joueurs-v1.md` | 15 mai | Audit v1 |
| `Conception-Portail-Architecture-V2.md` | 15 mai | Architecture v2 — patché v1.1 le 16/05 |
| `Conception-Portail-UI-Evenements.md` | 15 mai | Conception UX Évènements |
| `Conception-Portail-UI-Joueurs.md` | 15 mai | Conception UX Joueurs |
| `Audit-Module-Suivi-Match-v2.md` (v2.1) | 16 mai | Option C tranchée, patch doctrinal |
| `Modelisation-Chronologie-Suivi-v1.md` (**v1.1**) | 16 mai | Modélisation `chronologie_suivi`, patch DS-1. **Input de C12** |
| `Doctrine-Interconnexion-Modules-v1.2.md` | 16 mai | DI-6 fermée, DI-CHR-1 ajoutée, dettes C11→C12 |
| `Conception-Portail-UI-Suivi.md` | 16 mai | Conception UX Suivi complète (S-1→S-6). **Input de C12** |
| `STATE.md — Phase 5.12 TER` | 15 mai | **Périmé** |

---

## 🔧 Pile technique (état connu)

| Élément | Valeur | Fiab. |
|---|---|---|
| Front | HTML/CSS/JS statique, `css/hub.css` commun, préfixes CSS par module | 🟢 |
| Auth | `SupabaseHub` (getSession / isAdmin / onAuthChange / signOut) | 🟢 |
| Backend | Supabase (`@supabase/supabase-js@2` via CDN jsdelivr) | 🟢 |
| Client JS | `js/supabase-client.js` **v1.12** | 🟢 |
| Modèle données | Phase 4.2 (`evenements`) + 4.3 (`compositions`, `composition_joueurs`, `presences`) ; 🔧 MAJ Prod 16/05 (C12) — **`chronologie_suivi` + `lien_suivi` modélisées ET produites (C12-a/f)**, à exécuter en base | 🟢/🟡 |
| Référentiels | 7 (postes v1.1, ateliers, aptitudes, conformité-ffr, observables-match, tests-physiques, encadrants-par-categorie) — IDs courts TEXT | ⚪ |

---

## 🚀 Pipeline (prochaines étapes)

### ✅ Fait — conv `Audits` (16/05)
- Audit Suivi-Match v2.1, §0bis Option C, DI-6/C11-a levée (modélisation v1), DS-1 tranché (modélisation v1.1).

### ✅ Fait — conv `Conception` (16/05)
- Doctrine Interconnexion v1.1 → v1.2, patch Architecture-V2 v1.1, conception UX Suivi complète (S-1→S-6).

### ✅ Fait — conv `Production` (16/05)
- Phase 5.14 + Phase 2 complétion Évènements/Joueurs.
- 🔧 **MAJ Prod 16/05 (C12)** — **backend Suivi C12-a→f produit** (6 SQL + recette), conforme modélisation v1.1 + conception UX. Priorisation Suivi actée par Manu.

### ⏳ Prochaines étapes
1. **Déployer C12** (Manu) : exécuter les 6 SQL dans Supabase (ordre a→b→f→c→d→e), ranger dans `sql/`, commiter.
2. **Câbler `chronologie_nom_court_personne`** (Production) sur la source nom RGPD-safe `personnes` — seul point ouvert.
3. **Confirmer le gate de saisie** (Audits) : `resultat` vs `archive` (pas d'état `termine` réel).
4. **UI Suivi de rencontre** (Production, à venir) : implémenter les 6 paquets S-1→S-6 sur le backend C12.
5. **DI-1** (audit Préparation de séance) → **DI-7** (suivi de séance réalisée) — conv Audits, temporisés.
6. **DI-CHR-1** (procédure RGPD effacement personne avec historique) — conv Audits, avant mise en service du Suivi, non bloquant production.
7. **Statistiques** — plus tard ; tenir compte de la note aval DS-1 (essai non attribué).

### Dettes ouvertes

| # | Dette | Nature | Destinataire | Bloquant ? |
|---|---|---|---|---|
| **DS-1** ✅ TRANCHÉE | Contrainte assouplie (notre+NULL OK, adverse+joueur interdit) | Résolue (modélisation v1.1, **appliquée C12-a**) | conv Audits (fait) | ✅ Levée |
| **DS-2** | Alerte coach blessure côté **Compositions** (lecture `etat_joueur='blesse'`), pas dans le Suivi (PI-1) | Articulation inter-module | conv Conception (futur cycle Compositions) | 🟢 Non bloquant ; à tracer |
| **DI-CHR-1** | Procédure RGPD effacement personne avec historique (ON DELETE RESTRICT `joueur_uuid`) | Dette d'instruction | conv Audits | 🟢 Non bloquant prod ; avant mise en service |
| **C12-nom** 🆕 | Câbler `chronologie_nom_court_personne` sur source nom RGPD-safe `personnes` | Câblage technique | conv Production | 🟡 Non bloquant (numéros OK) ; nom affiché après câblage |
| **C12-gate** 🆕 | Gate saisie `resultat` vs `archive` (pas d'état `termine` réel) | À confirmer doctrine | conv Audits | 🟢 Non bloquant (choix conservateur en place) |

Dépendances amont tracées (pas codées par anticipation) : DA-1 format de jeu lisible depuis équipe/événement ; DA-2 config chrono via génération lien — **hook posé** dans `lien_suivi.config_chrono` (stocké non interprété). Note aval DS-1 : Rapport/Stats traitent l'essai `notre`+NULL *exprès* (« non attribué : N essais »).

**Dettes Production C12 — état :** C12-a→f **PRODUITS** (SQL livrés). Restent : exécution base + commit (Manu), câblage `nom_court`, confirmation gate, puis UI Suivi.

**Dettes ouvertes — autres (inchangées) :** photos Joueurs C10-a→e (V1.1), C10-i (V2), P2-E.4 encadrants CRUD (V1.1), P2-J-split filtre Partenaire (V1.1), C7-c, C8-d, (m) ASCS, (n) sexe/dn partenaires, (q) durcissement `coach_equipes`.

---

## 📝 Vocabulaire stabilisé

- **MOM** = Mutzig Ovalie Molsheim (club)
- **SAR** = club partenaire entente (M14 SAR×MOM)
- **OVAL-E** = plateforme FFR de gestion des licences (**avec un A**)
- **Référent** = coach principal de catégorie (**Emmanuel Jung pour M14**, également Coach principal M14)
- **Encadrants** = staff (coachs, entraîneurs, assistants)
- **Suivis de Match** = vignette 2.4 (pluriel, code). Concept doctrinal = « suivi de rencontre ». Périmètre Option C (match + tournoi)
- **chronologie_suivi** = table « mémoire factuelle d'une rencontre » (1 ligne/observable). **lien_suivi** = jetons éphémères (saisie / spectateur)
- **DS-x** = dette conception UX ; **C12-x** = dette Production (modélisation) ; **DI-x** = dette d'instruction ; **DA-x** = dépendance amont tracée

---

## 🔐 Sécurité & confidentialité

- Auth via `SupabaseHub`, modes `auth-admin` / `auth-anon` / `auth-resolved`
- Pas d'identifiant personnel (email/tel) en public ; contrôle d'accès Drive via dossier partagé
- RGPD : doctrine confidentialité par construction (P6)
- 🔧 MAJ Prod 16/05 (C12) — Suivi produit avec P6 par construction : `chronologie_suivi` et `lien_suivi` en **tables fermées** (RLS + REVOKE, accès 100 % via RPC SECURITY DEFINER) ; lien spectateur = jeton sans droit d'écriture ; payload réduit RGPD (numéro + nom court, jamais médical/coordonnées) ; le nom court transite par un point unique à câbler (`chronologie_nom_court_personne`). Dette DI-CHR-1 (effacement RGPD personne avec historique) à instruire avant mise en service.

---

**STATE.md — version de référence (FUSION).** Reconstruite conv `Audits` → enrichie conv `Conception` 16/05 → repli DS-1 conv `Audits` 16/05 → MAJ Production 16/05 (Phase 5.14 + Phase 2) → **MAJ Production 16/05 (C12) : Suivi priorisé par Manu + backend C12-a→f produit (déploiement base + commit à faire par Manu)**.
**Chaîne documentaire : `CARTE-CONVERSATIONS` → `PASSATION.md` → ce `STATE.md` → message de passation thématique. Discipline anti-divergence (§4 bis) : toute conv qui produit un STATE repart de cette fusion.**
