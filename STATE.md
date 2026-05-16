# MOM Hub · STATE.md

**État global du projet au 16 mai 2026**

> 🧭 **À LIRE À TOUTE REPRISE DE TRAVAUX (ordre imposé)**
> Avant de reprendre quoi que ce soit, dans **n'importe quelle** conv (`Production`, `Audits`, `Conception`…), lire dans cet ordre :
> 1. **`CARTE-CONVERSATIONS-MOM-Hub.md`** — index maître : quelle conv fait quoi, laquelle ouvrir. Se place *au-dessus* de ce STATE.
> 2. **`PASSATION.md`** — kit de démarrage générique (discipline, où trouver quoi).
> 3. **CE `STATE.md`** — vérité opérationnelle du code (fusion : reconstruite conv `Audits` → enrichie conv `Conception` 16/05 → repli DS-1 conv `Audits` 16/05 → MAJ Production 16/05 Phase 5.14 + Phase 2 → MAJ Production 16/05 (C12) : Suivi priorisé + C12-a→f produits → **MAJ Production 16/05 (Suivi UI S-1) : paquet S-1 livré**). Succède à toutes les versions antérieures.
> 4. Le **message de passation thématique** éventuel collé en tête de la conv reprise.
>
> Les 3 fronts vivants portent des noms courts : **`Production`** (code/SQL/déploiement), **`Audits`** (modélisation/audits/doctrine), **`Conception`** (portail + doctrine d'interconnexion + conception UX modules). Règle de coexistence : une conv = un sujet.

> 🔧 **MAJ Conception 16/05.** Conception UX du Suivi LIVRÉE (`Conception-Portail-UI-Suivi.md`, 6 paquets S-1→S-6). Dette DS-1 ouverte puis tranchée. Doctrine d'interconnexion en v1.2 (DI-6 levée + DI-CHR-1). Patch `Conception-Portail-Architecture-V2` v1.1. Aucun code déployé dans cette session (conception pure).

> 🔧 **MAJ Audits 16/05 (DS-1) — TRANCHÉ.** DS-1 = Option A : contrainte `chronologie_suivi_adverse_sans_joueur` assouplie (interdit uniquement `adverse` + joueur ; autorise `notre` + `joueur_uuid` NULL, cas D-7). Sentinelle « équipe » écartée. Modélisation passée en **v1.1**. C12-a débloqué. Note aval : Rapport/Stats doivent traiter l'essai non attribué (`notre`+NULL) *exprès*. État du code inchangé (décision documentaire).

> 🔧 **MAJ Production 16/05 — Phase 5.14 + Phase 2 complétion Évènements + Joueurs.** Repart de la fusion Audits/Conception. Phase 5.14 Module Joueurs V1-Métier déployée (sql 32-35, supabase-client **v1.12**, joueurs.html v1.2, joueurs-browser.js v1.2, index.html v2.1). Phase 2 : Évènements v1.4.1 → **v1.7**, Joueurs v1.2 → **v1.3**. Cadrage doctrinal strict (Doctrine Interconnexion v1.2 : aucune anticipation Suivi, aucun couplage module→module, aucun pont pédagogie). Évènements/Joueurs ne sont plus « squelette » mais **fonctionnellement complets** (hors photos V1.1 et encadrants CRUD V1.1).

> 🔧 **MAJ Production 16/05 (C12) — Suivi de rencontre PRIORISÉ + backend produit.**
> **Décision Manu (16/05, après-midi) : priorisation explicite du Suivi de rencontre.** Cette priorisation **prime** sur le « Suivi non priorisé » des versions antérieures (réconciliation explicite, anti-divergence §4 bis ; repart de la fusion 16:50).
> Produit conv `Production` (consomme modélisation `chronologie_suivi` v1.1 + conception UX Suivi S-1→S-6) :
> - **C12-a** `CREATE TABLE chronologie_suivi` + index (DDL §4.1/§4.2).
> - **C12-b** RLS « table fermée » (zéro policy permissive, accès 100 % via RPC SECURITY DEFINER).
> - **C12-f** table **`lien_suivi`** + `generer_lien_ephemere` + **lien spectateur distinct** + `get_compo_reduite_rencontre` (payload RGPD réduit) + hook `config_chrono` (DA-2, stocké non interprété) + helpers `valider_lien_suivi`, `chronologie_nom_court_personne`. PI-7 appliqué. Relais = nouveau lien révoque les `saisie` actifs.
> - **C12-c** `inserer_observable` / `annuler_observable` / `corriger_observable` + double effet blessure (PI-6). Garde-fou DS-1.
> - **C12-d** `get_chronologie_rencontre` payload réduit (seule RPC lecture v1).
> - **C12-e** `consolider_score_rencontre` (score = SUM par camp, photo dans `evenements`).
> - 6 fichiers SQL **exécutés en base Supabase** (ordre a→b→f→c→d→e) + rangés dans `sql/` + committés (fait par Manu le 16/05).
> - 🟡 **À CONFIRMER (Production) — 1 câblage** : `chronologie_nom_court_personne` (C12-f) à brancher sur la source nom RGPD-safe `personnes`. Le Suivi tourne avec les numéros en attendant.
> - 🟡 **À CONFIRMER (Audits)** : gate de saisie `resultat` vs `archive`. Pas d'état `termine` réel (`evenements` : creation|compo|joue|resultat|archive|annule). Choix conservateur : bloque si `etat IN ('archive','annule')`.

> 🔧 **MAJ Production 16/05 (Suivi UI S-1) — paquet S-1 LIVRÉ (conv `Production · UI Suivi de rencontre`).**
> Reprise de la conv UI Suivi par-dessus le backend C12 déployé. Lecture protocole tenue (Carte → Passation → STATE fusion C12 → message thématique → spec `Conception-Portail-UI-Suivi.md` S-1→S-6 intégrale). **Aucune divergence STATE/Carte constatée au démarrage** (modifiedTime identiques). **Hors scope tenu** : zéro retouche backend C12.
> Produit (3 fichiers GitHub, déposés/committés par Manu — 1 fichier = 1 commit) :
> - **`js/suivi-client.js` v1.1** (NOUVEAU) — couche d'accès Suivi **dédiée**, séparée de `supabase-client.js` (v1.12 NON touchée). 7 wrappers C12 (signatures déployées vérifiées à la source, rien d'inventé) : `genererLienEphemere`, `getCompoReduiteRencontre`, `insererObservable`, `annulerObservable`, `corrigerObservable`, `getChronologieRencontre`, `consoliderScoreRencontre`. + `getToken()` (jeton URL = autorisation), `libelleJoueur()` (règle UNIQUE dégradation `nom_court` NULL → numéro), `chargerEtatInitial()` (routage boot : 5 issues, heuristique « démarré = chronologie non vide »). Réutilise `SupabaseHub.client` si présent, sinon client de repli `persistSession:false` (I5).
> - **`suivi.html`** (NOUVEAU) — coquille SANS login (pas de `SupabaseHub`, le jeton EST l'autorisation), réconciliée `hub.css` (tokens `.suivi-*` mappés sur la charte canonique ; couleurs d'état joueur doctrinales `--bleu-base/--clay/--vert-prairie/--rouge-blesse` ; polices projet Oswald/Manrope/JetBrains Mono). 5 états d'écran. Tampon « Avant » assemblé (S-4.1, Option UI-stricte).
> - **`js/suivi-app.js` v0.3** (NOUVEAU) — contrôleur d'écran dédié (pattern projet). Boot/routage piloté Core (I5, zéro localStorage) ; aperçu compo AV-2 paresseux ; sas ▶ Coup d'envoi (I4, Path A).
> **Décisions actées (validées Manu) :** (1) **module dédié** `suivi-client.js` (pas d'extension de v1.12) ; (2) **Option UI-stricte** — pas de ligne d'en-tête rencontre (aucune RPC ne la fournit), vérification d'identité par l'aperçu compo AV-2 ; (3) **Path A coup d'envoi** — sas = transition cliente pure, zéro écriture Core (aucun observable « coup d'envoi » au référentiel ; inventer = anti-pattern type DS-1).
> **Invariants tenus :** I1 (aucun score saisi), I2 (tampon ne réapparaît jamais une fois démarré — *assoupli* sur edge reconnexion-avant-1ʳᵉ-action, limite V1 tracée), I3 (auto-explicatif, « ? »), I4 (saisie verrouillée — tenu structurellement : pas de surface de saisie avant le sas), I5 (zéro état navigateur, tout reconstruit du Core).
> **Restes Suivi UI :** S-2 (écran « En cours », le cœur) → S-3 (mécaniques) → S-4 (Avant/Après) → S-5 (périphériques) → S-6 (synthèse). Voir nouvelles dettes ci-dessous.

> ⚠️ **Gouvernance — divergences signalées et réconciliées.** (1) 16/05 : message de passation thématique d'ouverture Suivi vs fusion STATE 16:50 — réconcilié, Manu a tranché la priorisation. (2) 16/05 conv UI Suivi : **aucune divergence** (STATE/Carte inchangés au démarrage, vérifié par modifiedTime). Discipline tenue : on repart toujours de la fusion de référence, on ne ré-édite pas une branche parallèle.

> ⚠️ **Note de méthode — fiabilité.** STATE reconstruit depuis le code déployé, recoupé Drive `00 - Documentation`, enrichi conv Conception, MAJ Production. Marqueurs : 🟢 PROUVÉ (code déployé) · 🟡 À CONFIRMER (versions JS, état SQL/RPC, dettes) · ⚪ DRIVE (audits, docs).

---

## 📊 Récapitulatif exécutif

| Aspect | Statut | Détail | Fiab. |
|--------|--------|--------|-------|
| **Modules en ligne** | **5 outils métier + 3 système** | Bibliothèque, Préparation séance, Évènements, Joueurs, Compos + index/dashboard/login | 🟢 |
| **Suivi de rencontre** | **Backend C12 déployé · UI paquet S-1 livré** | 🔧 MAJ Prod 16/05 (Suivi UI S-1) — `suivi.html` + `js/suivi-client.js` v1.1 + `js/suivi-app.js` v0.3. S-2→S-6 à faire | 🟢/🟡 |
| **Modules métier todo (UI)** | Statistiques | `todo` dans index.html | 🟢 |
| **Niveau de complétude** | Évènements/Joueurs Phase 2 complets | Compos/Séance/Biblio matures ; Évènements v1.7 + Joueurs v1.3 | 🟢 |
| **Client Supabase coach** | `js/supabase-client.js` **v1.12** | NON touché par la session UI Suivi (module dédié séparé) | 🟢 |
| **Client Suivi (sans login)** | `js/suivi-client.js` **v1.1** | 7 wrappers C12 + getToken/libelleJoueur/chargerEtatInitial | 🟡 |
| **Prochaine conv métier** | Suivi UI : S-2 (écran « En cours ») | Reprendre conv `Production · UI Suivi de rencontre` | ⚪ |

---

## 🟢 État réel des modules (prouvé par le code déployé)

### Section 01 — Pédagogie EDR (4 outils, 2 disponibles)

| Outil | Fichier | Statut | Détail prouvé |
|---|---|---|---|
| Ressources pédagogiques | — | 🔲 todo | « À venir » |
| **Bibliothèque d'ateliers** | `bibliotheque.html` + `js/bibliotheque-browser.js` | ✅ EN LIGNE | « 4 rubriques · 62 fiches » |
| **Préparation de séance** | `seance.html` + `js/seance-editor.js` | ✅ EN LIGNE | Phase 5.12 TER |
| Planification annuelle | — | 🔲 todo | « À venir » |

### Section 02 — Mon équipe M14 SAR×MOM (5 outils, 3 disponibles)

| Outil | Fichier | Statut | Détail prouvé |
|---|---|---|---|
| **Évènements** | `evenements.html` + `js/evenements-browser.js` | ✅ EN LIGNE — Phase 2 complète | evenements-browser **v1.7**. Dette V1.1 : encadrants CRUD (P2-E.4) |
| **Joueurs** | `joueurs.html` + `js/joueurs-browser.js` | ✅ EN LIGNE — Phase 2 complète | joueurs-browser **v1.3**. Dette V1.1 : photos (C10-a→e) |
| **Compos** | `compositions.html` + `js/compositions-editor.js` | ✅ EN LIGNE | Phase 4.4 UI éditeur. Le plus mature |
| **Suivis de Match** | `suivi.html` + `js/suivi-client.js` v1.1 + `js/suivi-app.js` v0.3 | 🟡 **UI paquet S-1 livré** · ✅ backend C12 déployé · ⚪ conçu (UX S-1→S-6) | 🔧 MAJ Prod 16/05 (Suivi UI S-1). Parcours d'entrée complet (coquille, boot/route, tampon, sas Path A). S-2→S-6 à faire |
| **Statistiques** | — | 🔲 todo | « À venir » |

### Sections 03 / 04 / 05 — Logistique / Pilotage club / Espace famille

🔲 **Tout `todo`** (inchangé).

### Modules système

| Fichier | Rôle | Statut |
|---|---|---|
| `index.html` | Portail / tableau de bord | ✅ EN LIGNE — auth `SupabaseHub` |
| `dashboard.html` | Tableau de bord admin | ✅ EN LIGNE |
| `login.html` | Connexion | ✅ EN LIGNE |
| `test-supabase.html` | Page de test technique | ✅ présent |

---

## 🏗️ Architecture repo (reconstituée depuis le code)

```
mom-hub/
├── index.html ✅ portail (auth SupabaseHub, KPI, sidebar)
├── dashboard.html ✅ admin
├── login.html ✅ connexion
├── test-supabase.html ✅ test technique
├── bibliotheque.html ✅ Bibliothèque ateliers
├── seance.html ✅ Préparation séance (Phase 5.12 TER)
├── compositions.html ✅ Compos (Phase 4.4 UI)
├── evenements.html ✅ Évènements (Phase 2 complète)
├── joueurs.html ✅ Joueurs (Phase 2 complète)
├── suivi.html ✅ 🔧 Suivi de rencontre — SANS login (jeton URL) — paquet S-1
├── css/
│ └── hub.css ✅ thème commun (v1.1, lié par suivi.html)
├── js/
│ ├── supabase-client.js ✅ client coach + SupabaseHub [v1.12 🟢 — NON touché par Suivi UI]
│ ├── dashboard-stats.js ✅
│ ├── bibliotheque-browser.js ✅
│ ├── seance-editor.js ✅ [v1.11 TER 🟡]
│ ├── compositions-editor.js ✅ [v2.1.5 🟡]
│ ├── evenements-browser.js ✅ [v1.7 🟢 Phase 2]
│ ├── joueurs-browser.js ✅ [v1.3 🟢 Phase 2]
│ ├── suivi-client.js ✅ 🔧 couche d'accès Suivi DÉDIÉE [v1.1 🟡 — sans login, jeton URL]
│ └── suivi-app.js ✅ 🔧 contrôleur d'écran Suivi [v0.3 🟡 — boot/route + tampon + sas]
├── sql/
│ ├── … (Vague 1 → 35, Phases 4.x/5.14)
│ └── C12-a→f (Suivi) — EXÉCUTÉS en base + rangés + committés
└── assets/
 └── logo-m2m.png ✅
```

🟡 Versions JS entre crochets non revérifiables depuis le HTML seul. `suivi-client.js`/`suivi-app.js` sont des **modules nouveaux** (versions internes 1.1 / 0.3).

---

## ⚪ État Drive — Documentation (audits & conception)

Inchangé par la session UI Suivi (les 3 livrables sont des fichiers **GitHub**, pas des docs Drive). Inventaire de référence : voir version C12 (Audit-Module-Suivi-Match-v2.1, Modelisation-Chronologie-Suivi-v1.1, Doctrine-Interconnexion-v1.2, Conception-Portail-UI-Suivi.md, etc.).

---

## 🔧 Pile technique (état connu)

| Élément | Valeur | Fiab. |
|---|---|---|
| Front | HTML/CSS/JS statique, `css/hub.css` commun, préfixes CSS par module | 🟢 |
| Auth coach | `SupabaseHub` (getSession / isAdmin / onAuthChange / signOut) | 🟢 |
| **Auth Suivi (bénévole)** | **AUCUNE** — le jeton opaque dans l'URL EST l'autorisation (lien éphémère C12-f). `suivi.html` ne charge PAS `supabase-client.js`/`SupabaseHub` | 🟢 |
| Backend | Supabase (`@supabase/supabase-js@2` via CDN jsdelivr) | 🟢 |
| Client JS coach | `js/supabase-client.js` **v1.12** | 🟢 |
| Client JS Suivi | `js/suivi-client.js` **v1.1** (client de repli `persistSession:false`, I5) | 🟡 |
| Modèle données | Phases 4.2/4.3 + **`chronologie_suivi` + `lien_suivi` déployées (C12, tables fermées RLS+RPC)** | 🟢 |
| Référentiels | 7 (dont `observables-match.json` v1.1 — 13 obs Cat A, **AUCUN observable « coup d'envoi »/période** : voir dette Path B) | ⚪ |

---

## 🚀 Pipeline (prochaines étapes)

### ✅ Fait — conv `Audits` (16/05)
Audit Suivi-Match v2.1, Option C, DI-6/C11-a levée, DS-1 tranché (modélisation v1.1).

### ✅ Fait — conv `Conception` (16/05)
Doctrine Interconnexion v1.2, patch Architecture-V2 v1.1, conception UX Suivi complète (S-1→S-6).

### ✅ Fait — conv `Production` (16/05)
- Phase 5.14 + Phase 2 complétion Évènements/Joueurs.
- 🔧 **MAJ Prod (C12)** — backend Suivi C12-a→f produit, exécuté en base, rangé `sql/`, committé.
- 🔧 **MAJ Prod (Suivi UI S-1)** — conv `Production · UI Suivi de rencontre` : paquet **S-1 complet** (S-1.a coquille réconciliée hub.css · S-1.b boot/route piloté Core · S-1.c tampon « Avant » Option UI-stricte · S-1.d sas Path A). 3 fichiers : `suivi.html`, `js/suivi-client.js` v1.1, `js/suivi-app.js` v0.3.

### ⏳ Prochaines étapes
1. **Câbler `chronologie_nom_court_personne`** (Production) sur la source nom RGPD-safe `personnes` — seul point ouvert backend.
2. **Confirmer le gate de saisie** (Audits) : `resultat` vs `archive`.
3. **UI Suivi S-2→S-6** (Production, conv `Production · UI Suivi de rencontre`) : S-2 écran « En cours » (le cœur) → S-3 mécaniques → S-4 Avant/Après → S-5 périphériques → S-6 synthèse.
4. **DI-1 → DI-7**, **DI-CHR-1** (conv Audits, temporisés, avant mise en service).
5. **Statistiques** — plus tard ; tenir compte note aval DS-1.

### Dettes ouvertes

| # | Dette | Nature | Destinataire | Bloquant ? |
|---|---|---|---|---|
| **DS-1** ✅ TRANCHÉE | Contrainte assouplie (notre+NULL OK) | Résolue (modélisation v1.1, appliquée C12-a) | conv Audits (fait) | ✅ Levée |
| **DS-2** | Alerte coach blessure côté **Compositions** (lecture `etat_joueur='blesse'`), pas dans le Suivi (PI-1) | Articulation inter-module | conv Conception (futur Compositions) | 🟢 Non bloquant ; à tracer |
| **DI-CHR-1** | Procédure RGPD effacement personne avec historique | Dette d'instruction | conv Audits | 🟢 Non bloquant prod ; avant mise en service |
| **C12-nom** 🟡 | Câbler `chronologie_nom_court_personne` sur source nom RGPD-safe `personnes` | Câblage technique | conv Production | 🟡 Non bloquant (numéros OK) ; nom affiché après câblage. **Côté UI : `libelleJoueur()` dégrade déjà proprement (numéro = ancre)** |
| **C12-gate** 🟡 | Gate saisie `resultat` vs `archive` (pas d'état `termine` réel) | À confirmer doctrine | conv Audits | 🟢 Non bloquant (choix conservateur en place) |
| **SUIVI-UI-1** 🆕 | **RPC en-tête rencontre** (libellé/catégorie/date/lieu/adversaire), token-bornée, RGPD-safe. Aucune des 7 RPC C12 ne renvoie l'en-tête rencontre → le tampon n'a PAS de confirmation rencontre permanente (Option UI-stricte : vérification d'identité dégradée sur l'aperçu compo AV-2, optionnel) | Ajout backend signalé | **conv Production (couloir backend)** | 🟢 Non bloquant (dégradation assumée) ; améliore le tampon une fois faite |
| **SUIVI-UI-2** 🆕 | **Observable « coup d'envoi » au référentiel** `observables-match.json` (Path B). Absent → Path A retenu (sas = transition cliente, zéro écriture Core). Conséquence : I2 *assoupli* sur edge reconnexion-avant-1ʳᵉ-action (tampon re-routé, re-tap sans dégât — limite V1, sœur de S-5.2.c). **Contrat aval type DS-1** : Rapport/Stats devraient ignorer/traiter cet observable structurel | Ajout référentiel + contrat aval | **conv Audits/Référentiels** | 🟢 Non bloquant (Path A en place, limite tracée) |
| **SUIVI-UI-SEAM-S5** 🆕 | Routage statut `demarre` → actuellement « En cours ». Le split « même bénévole reconnecté » vs « relais nouveau » (→ écran de reprise) est **renvoyé à S-5** (non anticipé, cohérent doctrine) | Seam de conception | conv Production (S-5) | 🟢 Non bloquant ; à traiter en S-5 |

**Dettes ouvertes — autres (inchangées) :** photos Joueurs C10-a→e (V1.1), C10-i (V2), P2-E.4 encadrants CRUD (V1.1), P2-J split filtre Partenaire (V1.1), C7-c, C8-d, (m) ASCS, (n) sexe/dn partenaires, (q) durcissement `coach_equipes`. Note aval DS-1 maintenue.

---

## 📝 Vocabulaire stabilisé

- **MOM** = Mutzig Ovalie Molsheim · **SAR** = club partenaire entente (M14 SAR×MOM)
- **OVAL-E** = plateforme FFR de gestion des licences (**avec un A**)
- **Référent** = coach principal de catégorie (**Emmanuel Jung pour M14**, également Coach principal M14)
- **Suivis de Match** = vignette code ; concept = « suivi de rencontre ». Périmètre Option C (match + tournoi)
- **chronologie_suivi** = mémoire factuelle d'une rencontre (1 ligne/observable). **lien_suivi** = jetons éphémères (saisie / spectateur)
- **suivi-client.js** = couche d'accès Suivi DÉDIÉE (sans login, jeton URL). **suivi-app.js** = contrôleur d'écran Suivi
- **Option UI-stricte** = principe de la conv UI Suivi : rester « UI only », dégrader honnêtement, tracer les besoins backend comme dettes, ne rien inventer
- **Path A (coup d'envoi)** = sas = transition cliente pure, zéro écriture Core (vs Path B = observable « coup d'envoi » au référentiel + contrat aval)
- **DS-x** = dette conception UX ; **C12-x** = dette Production (modélisation) ; **DI-x** = dette d'instruction ; **DA-x** = dépendance amont ; **SUIVI-UI-x** = dette née de l'implémentation UI Suivi

---

## 🔐 Sécurité & confidentialité

- Auth coach via `SupabaseHub` ; **Suivi bénévole SANS login : le jeton opaque de l'URL est l'autorisation** (lien éphémère C12-f, RLS table fermée). `suivi.html` ne charge jamais `supabase-client.js`.
- RGPD : payload réduit (numéro + nom court) ; `libelleJoueur()` dégrade proprement quand `nom_court` est NULL (verrou `chronologie_nom_court_personne` non câblé) ; jamais médical/coordonnées.
- I5 par construction : `suivi-client.js`/`suivi-app.js` n'écrivent RIEN en localStorage/sessionStorage ; tout l'état se reconstruit depuis le Core (`get_chronologie_rencontre`) — fondement du relais/reconnexion sans perte.
- DI-CHR-1 (effacement RGPD personne avec historique) à instruire avant mise en service.

---

**STATE.md — version de référence (FUSION).** Reconstruite conv `Audits` → enrichie conv `Conception` 16/05 → repli DS-1 conv `Audits` 16/05 → MAJ Production 16/05 (Phase 5.14 + Phase 2) → MAJ Production 16/05 (C12) → **MAJ Production 16/05 (Suivi UI S-1) : paquet S-1 livré (suivi.html + suivi-client.js v1.1 + suivi-app.js v0.3)**.
**Chaîne documentaire : `CARTE-CONVERSATIONS` → `PASSATION.md` → ce `STATE.md` → message de passation thématique.**
