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

> 🔧 **MAJ Production 17/05 (Suivi UI S-2 → S-5.a) — module bénévole COMPLET de bout en bout (conv `Production · UI Suivi de rencontre`).**
> Reprise 17/05, aucune divergence STATE/Carte au démarrage (modifiedTime vérifiés). Lecture protocole tenue (Carte → Passation → STATE fusion → spec `Conception-Portail-UI-Suivi.md` S-1→S-6 relue intégralement). Hors scope tenu : zéro retouche backend C12 ; vérifs à la source avant chaque lot (signatures RPC, référentiel `observables-match.json` v1.1 décodé).
> Produit (2 fichiers GitHub : `js/suivi-app.js` v0.3 → **v0.14**, `suivi.html` ; 1 fichier = 1 commit, déposés/committés par Manu) :
> - **S-2** (écran « En cours », le cœur — 80 % de l'usage) : S-2.a structure 5 zones (Option B aménagée) · S-2.b alimentation lecture (score CALCULÉ client, jamais consolidé en live — I1 ; historique 2 lignes) · S-2.c palette à contenu variable (Notre = 3 sections étiquetées Scorantes/Événements/Jeu ; Adverse = score seul + −1 ; référentiel 13 obs Cat A figé en dur, vérifié source) · S-2.d feedback tap + écriture (`insererObservable`, anti-double-tap, erreur non bloquante, seam joueur dégradé DS-1) · S-2.e dépliement historique (overlay in situ, jamais une autre page).
> - **S-3** (mécaniques) : S-3.a Zone D sélecteur joueur (grille pavés numéro+nom, titulaires/remplaçants D-5, bouton « Équipe / je ne sais pas » D-7) · S-3.b correction mauvais numéro (tap ligne historique → `corrigerObservable`, D-8) · S-3.c blessure constat (mode Zone D « Qui est blessé ? », `estBlessure:true` → double effet PI-6 backend, ZÉRO recomposition) · S-3.d bascule mode Normal/Expert (⚙ délibéré, `modeSaisie` par ligne) · S-3.e bouton Période (séquence générique 2 MT = repli P4 spec S-2.3 ; sas confirm ; « Fin du match » verrouille la saisie I4).
> - **S-4** : S-4.1 (écran « Avant ») = DÉJÀ livré par le tampon S-1.c (conformité vérifiée, rien retouché) ; S-4.2 (écran « Après ») = score final + récap sobre (nb actions + blessures, calculé client) + message de mission, verrouillage dur AP-3, pas de stats (frontière aval).
> - **S-5.a** : écran de reprise (S-5.2.b) — **SEAM reprise/En cours RÉSOLU** : au statut `demarre`, écran de reprise systématique (résumé + « Je reprends » → reconstruction depuis le Core, zéro réseau, I5). Détection reconnexion/relais impossible sans état (I5 l'interdit) → écran systématique = lecture honnête.
> **Invariants tenus de bout en bout** : I1 (score toujours calculé, jamais saisi/consolidé en live), I2, I3, I4 (saisie verrouillée avant sas ET après « Fin du match »), I5 (ZÉRO `localStorage`/`sessionStorage` ; tout reconstruit du Core — vérifié à chaque lot). Toutes les écritures via wrappers C12 (signatures vérifiées source). Anti-injection systématique (`textContent`/`createElement`). `node --check` à chaque lot.
> **État module bénévole : COMPLET et utilisable en live de bout en bout** (entrée → coup d'envoi → saisie complète → correction → blessure → mode → fin de match verrouillée → reprise/relais).
> **Restes Suivi UI : ARBITRÉ 17/05 (option C).** S-5.b (Mode Vidéo S-5.3 + temps de jeu S-5.4) vise le **COACH authentifié**, pas le bénévole sans login : l'intégrer dans `suivi.html` casserait l'invariant fondateur « sans login » (jeton URL = autorisation, zéro `SupabaseHub`). **Décision : aucun code S-5.b dans le module bénévole.** S-5.3/S-5.4 sont des décisions de *conception* déjà tranchées par la spec (Mode Vidéo = anti-écran-live, `saisi_par_role='coach'`/`source_saisie='video'`, frontière dure QUOI/POURQUOI ; temps de jeu = panneau d'estimation côté coach). Le Mode Vidéo + temps de jeu + le **point d'entrée coach « générer le lien de suivi depuis une rencontre »** forment un **nouveau cycle dédié** (jalon `SUIVI-COACH-1` ci-dessous), à ouvrir APRÈS instruction des dettes backend (SUIVI-UI-1/5/6) — vraisemblablement rattaché au module Compositions/Évènements, hors du fichier bénévole. **S-6 effectué (revue documentaire, sans code) : cohérence du module bénévole vérifiée vs les 5 invariants — I1 (score toujours calculé, aucun appel réel à `consoliderScoreRencontre`), I2, I3, I4 (3 gardes `_termine` + sas), I5 (zéro `localStorage`/`sessionStorage` réel — seules occurrences = commentaires d'invariant) ; `node --check` OK sur les 2 fichiers ; versions/bannières cohérentes (app v0.14, client v1.1).**
> **➡️ Module Suivi bénévole : CLÔTURÉ.** Complet, cohérent, utilisable en live de bout en bout. Plus aucun code prévu sur `suivi.html`/`suivi-app.js`/`suivi-client.js` dans le périmètre bénévole. La suite (Mode Vidéo, temps de jeu, pont Hub↔Suivi) = cycle coach séparé `SUIVI-COACH-1`.

> ⚠️ **Gouvernance — divergences signalées et réconciliées.** (1) 16/05 : message de passation thématique d'ouverture Suivi vs fusion STATE 16:50 — réconcilié, Manu a tranché la priorisation. (2) 16/05 conv UI Suivi : **aucune divergence** (STATE/Carte inchangés au démarrage, vérifié par modifiedTime). (3) 17/05 conv UI Suivi (reprise S-2→S-5.a) : aucune divergence au démarrage NI à la clôture (STATE modifiedTime vérifié = version livrée plus tôt, 22171 o). Dettes **SUIVI-UI-3** (joueur fautif sur pénalité, ouverte sur question de Manu) puis **SUIVI-UI-4/5/6** (issues de l'implémentation S-3/S-4/S-5.a) tracées vers leurs couloirs respectifs, NON résolues en UI (hors périmètre). Discipline tenue : on repart toujours de la fusion de référence, on ne ré-édite pas une branche parallèle.

> ⚠️ **Note de méthode — fiabilité.** STATE reconstruit depuis le code déployé, recoupé Drive `00 - Documentation`, enrichi conv Conception, MAJ Production. Marqueurs : 🟢 PROUVÉ (code déployé) · 🟡 À CONFIRMER (versions JS, état SQL/RPC, dettes) · ⚪ DRIVE (audits, docs).

---

## 📊 Récapitulatif exécutif

| Aspect | Statut | Détail | Fiab. |
|--------|--------|--------|-------|
| **Modules en ligne** | **5 outils métier + 3 système** | Bibliothèque, Préparation séance, Évènements, Joueurs, Compos + index/dashboard/login | 🟢 |
| **Suivi de rencontre** | **Backend C12 déployé · UI module bénévole CLÔTURÉ (S-1→S-6)** | 🔧 MAJ Prod 17/05 — `suivi.html` + `js/suivi-client.js` v1.1 + `js/suivi-app.js` **v0.14**. Complet, utilisable en live de bout en bout. S-6 fait (revue invariants OK). Suite = cycle coach séparé `SUIVI-COACH-1` (Mode Vidéo/temps de jeu/pont Hub), hors module bénévole | 🟢 |
| **Modules métier todo (UI)** | Statistiques | `todo` dans index.html | 🟢 |
| **Niveau de complétude** | Évènements/Joueurs Phase 2 complets | Compos/Séance/Biblio matures ; Évènements v1.7 + Joueurs v1.3 | 🟢 |
| **Client Supabase coach** | `js/supabase-client.js` **v1.13** | v1.12→v1.13 via Objet A (wrapper `genererLienEphemere`, couloir Évènements). Module bénévole Suivi ne le charge **toujours pas** (invariant sans-login intact) | 🟢 |
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
| **Évènements** | `evenements.html` + `js/evenements-browser.js` | ✅ EN LIGNE — Phase 2 complète + Objet A | evenements-browser **v1.8** (Objet A : section « Suivi de la rencontre »). Dette V1.1 : encadrants CRUD (P2-E.4) |
| **Joueurs** | `joueurs.html` + `js/joueurs-browser.js` | ✅ EN LIGNE — Phase 2 complète | joueurs-browser **v1.3**. Dette V1.1 : photos (C10-a→e) |
| **Compos** | `compositions.html` + `js/compositions-editor.js` | ✅ EN LIGNE | Phase 4.4 UI éditeur. Le plus mature |
| **Suivis de Match** | `suivi.html` + `js/suivi-client.js` v1.1 + `js/suivi-app.js` **v0.14** | 🟢 **UI module bénévole CLÔTURÉ (S-1→S-6)** · ✅ backend C12 déployé · ⚪ conçu (UX S-1→S-6) | 🔧 MAJ Prod 17/05. Complet, utilisable en live de bout en bout (entrée→coup d'envoi→saisie→correction→blessure→fin→reprise). S-6 fait (revue invariants OK). Suite = cycle coach `SUIVI-COACH-1` (hors module bénévole) |
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
│ ├── supabase-client.js ✅ client coach + SupabaseHub [v1.13 🟢 — Objet A ; module bénévole Suivi ne le charge PAS]
│ ├── dashboard-stats.js ✅
│ ├── bibliotheque-browser.js ✅
│ ├── seance-editor.js ✅ [v1.11 TER 🟡]
│ ├── compositions-editor.js ✅ [v2.1.5 🟡]
│ ├── evenements-browser.js ✅ [v1.8 🟢 Phase 2 + Objet A]
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
| Client JS coach | `js/supabase-client.js` **v1.13** | 🟢 (v1.13 = Objet A ; non chargé par le Suivi bénévole) |
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
| **SUIVI-UI-4** 🆕 | **Palette Mode Expert / observables Cat B.** S-3.d livre le *mécanisme* de bascule Normal/Expert (tag lecture seule + ⚙ délibéré) et le marquage `modeSaisie` **par ligne** (doctrine v1.2 §5, zéro migration). Mais le Mode Expert ajoute les observables **Cat B** ; le référentiel figé côté client en S-2.c ne porte que les 13 Cat A (Cat B = suggestions libres par catégorie d'âge dans `observables-match.json`). Le *contenu* de la palette Expert (quels observables Cat B, par catégorie) n'est pas inventable en UI | Évolution référentiel + conception UX | **conv Audits/Référentiels + conv Conception** | 🟢 Non bloquant (mécanisme livré ; palette Expert vide tant que non spécifiée) |
| **SUIVI-UI-5** 🆕 | **Consolidation du score côté coach.** `consolider_score_rencontre(p_evenement_uuid, p_token)` exige `evenementUuid`, que le bénévole sans login n'a pas (le jeton encapsule la rencontre côté serveur ; aucune RPC ne renvoie l'UUID — lié SUIVI-UI-1). À la clôture (S-3.e/S-4.2) le score affiché est le **calcul client** (juste, I1) ; la *photo* dans `evenements` n'est pas écrite. Options : (a) consolidation déclenchée par le **coach authentifié** (a l'UUID via accès Hub) à l'ouverture Mode Vidéo / récap ; (b) **wrapper backend jeton-seul** `consolider_score_rencontre(p_token)` résolvant l'événement depuis le jeton | Décision backend/architecture | **conv Production (couloir backend)** | 🟢 Non bloquant (score client juste en V1 ; photo aval = confort Rapport/Stats) |
| **SUIVI-UI-6** 🆕 | **Rôle du jeton non lisible côté client (lien spectateur).** Le jeton est **opaque** côté client (`getToken()` lit `?t=` ; le rôle `saisie`/`spectateur` est tranché serveur par `valider_lien_suivi`). Aucune RPC n'expose le rôle. Conséquence : l'**écran spectateur distinct** (S-5.1, lecture seule) n'est pas réalisable proprement en UI (deviner par échec d'écriture = anti-pattern rejeté ; drapeau d'URL = « mode d'UI fragile » que la spec S-5.1.a interdit). La **sécurité spectateur est déjà portée par le backend** (jeton spectateur sans droit d'écriture, RLS C12-f) ; seul l'écran UI distinct manque. Besoin : une RPC exposant le rôle du jeton (ou champ de retour) | Ajout backend signalé | **conv Production (couloir backend)** | 🟢 Non bloquant (sécurité OK ; écran reprise S-5.a livré ; écran spectateur en attente) |
| **SUIVI-COACH-1** 🆕 | **Cycle coach dédié : Mode Vidéo + temps de jeu + pont Hub↔Suivi.** Regroupe (a) **Mode Vidéo** (S-5.3 — coach authentifié au calme, anti-écran-live, complète/corrige le live, `saisi_par_role='coach'`/`source_saisie='video'`, frontière dure QUOI/POURQUOI), (b) **temps de jeu** (S-5.4 — panneau d'estimation côté coach), (c) **point d'entrée coach** : l'écran depuis lequel le coach **génère le lien éphémère** d'une rencontre et le transmet au bénévole = **le vrai chaînon Hub↔Suivi**. **➡️ Objet A (point c) = LIVRÉ 17/05** : `supabase-client.js` v1.12→**v1.13** (wrapper `genererLienEphemere`) + `evenements-browser.js` v1.7→**v1.8** (section « Suivi de la rencontre » sur la fiche événement, 3 états adaptatifs, tournoi = 1 lien/match enfant inline, lien `saisie` seul). Le Suivi est désormais réellement lançable terrain (plus de SQL manuel). **Objets B et C restent OUVERTS** : B (Mode Vidéo) bloqué par SUIVI-UI-5 ; C-2 (écran spectateur) bloqué par SUIVI-UI-6 ; SUIVI-UI-1 améliore A + fiabilise l'en-tête de B. Périmètre distinct du module bénévole (auth Hub). Décidé 17/05 (option C). | Cycle en cours : A livré, B/C après dettes backend | A : **conv Production Évènements (livré)** · B/C : **conv Conception → Production**, après dettes | 🟢 Non bloquant (A livré ; B/C = évolutions) |
| **SUIVI-COACH-2** 🆕 | **RPC de relecture du lien `saisie` actif d'une rencontre.** Apparue pendant Objet A (signalée, non contournée) : la table `lien_suivi` est fermée et `generer_lien_ephemere` ne fait que *créer* → aucune RPC ne permet de relire un lien actif existant. Conséquence : l'**état 3 d'Objet A (« lien déjà généré »)** est **borné à la session** (lien en RAM, jamais en `localStorage` ; après rechargement, retour à l'état 2 ; re-générer reste sûr — le relais backend révoque l'ancien). Pas une régression (option assumée, cohérente avec la sémantique relais), mais dette réelle pour un état 3 persistant entre visites. Forme minimale : RPC `SECURITY DEFINER` jeton-OU-event-bornée renvoyant le dernier lien `saisie` non révoqué non expiré (réutilise `valider_lien_suivi`). Objet A déjà conçu pour réafficher un lien si on lui en fournit un → aucune retouche logique d'Objet A nécessaire | Ajout backend (enregistré 17/05 sur décision Manu) | **conv Production (couloir backend C12)** — rejoint SUIVI-UI-1/5/6 | 🟢 Non bloquant (état 3 borné session = comportement assumé ; amélioration de confort) |
| **SUIVI-COACH-deeplink** 🆕 | **Deep-link compo depuis l'état 1 d'Objet A.** L'état 1 (« compo pas prête ») propose un raccourci vers la compo ; le lien pointe honnêtement vers la page `compositions.html` en place mais **sans deep-link ciblé sur la rencontre** (nécessiterait la convention d'URL paramétrée de `compositions.html`, non établie). Raccourci fonctionnel, juste non ciblé | Convention d'URL `compositions.html` à définir | **conv Conception / Production Évènements** | 🟢 Non bloquant (raccourci honnête en place) |
| **SUIVI-UI-3** 🆕 | **Identification du joueur fautif sur pénalité concédée.** `obs-A-penalite` (référentiel v1.1) = le **buteur** qui passe la pénalité (type `score`, +3, `saisie_associee:["joueur"]`), PAS le joueur qui commet la faute. Aucun observable « pénalité concédée / faute commise » au référentiel (discipline limitée à jaune/rouge/avertissement). Besoin exprimé par Manu : suivre l'indiscipline individuelle (quels joueurs commettent des fautes). Tension doctrinale à arbitrer : la faute concédée est une lecture **interprétative** (frontière QUOI/POURQUOI — relève plutôt du Rapport ; encore moins observable en live qu'un essai non vu, cf. S-3.1.c). Décision = **ajout référentiel `observables-match.json` + conception UX** (nouvel observable + placement palette + sélection joueur), pas une retouche UI | Évolution référentiel + conception UX | **conv Audits/Référentiels + conv Conception** | 🟢 Non bloquant (UI S-2 livrable sans) ; à instruire avant si l'indiscipline individuelle est jugée prioritaire |

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

**STATE.md — version de référence (FUSION).** Reconstruite conv `Audits` → enrichie conv `Conception` 16/05 → repli DS-1 conv `Audits` 16/05 → MAJ Production 16/05 (Phase 5.14 + Phase 2) → MAJ Production 16/05 (C12) → MAJ Production 16/05 (Suivi UI S-1) → MAJ Production 17/05 (Suivi UI S-2 → S-5.a) → MAJ Production 17/05 (clôture S-6 module bénévole + jalon SUIVI-COACH-1) → **Réconciliation 17/05 (cadrage dettes backend §6) : `SUIVI-COACH-1` Objet A LIVRÉ (`supabase-client.js` v1.13, `evenements-browser.js` v1.8) ; dettes `SUIVI-COACH-2` (relecture lien actif) et `SUIVI-COACH-deeplink` enregistrées ; dettes backend SUIVI-UI-1/5/6 en instruction couloir backend C12**.
**Chaîne documentaire : `CARTE-CONVERSATIONS` → `PASSATION.md` → ce `STATE.md` → message de passation thématique.**
