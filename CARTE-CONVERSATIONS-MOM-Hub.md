# Carte des conversations — MOM Hub

> Index maître de navigation. Se place **au-dessus** de `STATE.md` (vérité opérationnelle du code)
> et `PASSATION.md` (kit de démarrage). Ce document ne remplace ni l'un ni l'autre : il dit
> *quelle conversation fait quoi, où elle en est, et laquelle ouvrir pour quoi*.
>
> Établi le 16 mai 2026 · révisé le 17 mai 2026 (MAJ Prod — UI Suivi : **module bénévole CLÔTURÉ S-1→S-6** ; **`SUIVI-COACH-1` Objet A LIVRÉ** (evenements-browser v1.8 / supabase-client v1.13) ; **couloir `Production · Suivi backend` CLOS** : C12-g/h/i livrés, dettes SUIVI-UI-1/5/6 + SUIVI-COACH-2 soldées ; **Objets B/C de `SUIVI-COACH-1` débloqués** ; **Conception 17/05 : Objet B conçu/validé** ; **MAJ Prod 17/05 : `SUIVI-COACH-1` Objet B (Mode Vidéo) LIVRÉ conv `Production`** — 4 fichiers (`sql/C12-k`, `supabase-client.js` v1.15, `js/mode-video.js` v0.1, `js/evenements-browser.js` v1.10 ; `mode-video.html` = Manu), `SUIVI-COACH-3-auth` (Option A) + `SUIVI-COACH-4` levées, dettes `SUIVI-COACH-3-equipe`/`SUIVI-COACH-5` ouvertes non bloquantes ; **Conception 17/05 (soir) : Objet C conçu/validé** — `Conception-SUIVI-COACH-1-ObjetC.md` (C-1 temps de jeu + C-2 écran spectateur, 6 décisions, réserve réduite `SUIVI-COACH-6`) → cycle conceptuellement complet ; **MAJ Prod 18/05 : `SUIVI-COACH-1` Objet C LIVRÉ conv `Production`** — 5 fichiers (`spectateur.html`, `js/spectateur.js` v1.0, `js/temps-de-jeu.js` v1.0, `js/supabase-client.js` v1.16, `js/evenements-browser.js` v1.11 ; additions pures prouvées) ; `SUIVI-COACH-6` RÉSOLUE à la source, 2 dettes conditionnelles non bloquantes `SUIVI-COACH-7`/`-8` ouvertes (dégradations honnêtes en place) → **cycle `SUIVI-COACH-1` LIVRÉ A+B+C de bout en bout, clos**) · 25 lignes de conversation recensées (dont 1 couloir à localiser ; couloir backend Suivi désormais clos) · À garder à jour à la main.
>
> ⚠️ **RÉCONCILIATION 18/05 — « livré de bout en bout » à nuancer.** Test terrain Manu : la conv `Production · Suivi de rencontre (backend C12)` a été **rouverte** (seul titre autorisé : retouche SQL C12) pour un bug bloquant — `generer_lien_ephemere` plantait (3 bugs SQL empilés, corrigés à la source, `sql/C12-f` resync committé, RPC vérifiées en base). Backend du parcours = **réparé et recetté**. **MAIS** la compo ne s'affiche toujours pas côté bénévole (bug **client**, dette **`SUIVI-CLIENT-1`** 🔴 bloquant terrain, hors périmètre backend, non diagnostiqué — console requise ; conv module bénévole ou fil dédié). **« Cycle SUIVI-COACH-1 livré A+B+C » = code livré/committé, PAS = parcours bénévole recetté terrain** tant que `SUIVI-CLIENT-1` ouverte. Détail : STATE gouvernance pt 9.
>
> **Convention de nommage adoptée :** les 3 fronts vivants portent un nom court — `Production`,
> `Audits`, `Conception`. Les fils clos/en pause gardent leur nom d'origine (préfixé `[ARCHIVE]`
> le cas échéant).

---

## 1. Pourquoi on se perd (le constat)

Le projet a été découpé en conversations séparées pour ne pas saturer les fils — décision saine.
Mais le découpage a produit **3 lignées vivantes** (Production, Audits, Modules pédagogiques)
qui avancent en parallèle, des conversations à vie courte déjà closes, et plusieurs
**one-shots** ponctuels. Sans index, impossible de savoir d'un coup d'œil où reprendre.

La règle de coexistence reste : **une conv = un sujet**, pas de double-tâche.
Ce document est l'exception légitime : c'est un méta-document de coordination, comme les
messages de passation et `STATE.md`.

---

## 2. Le mécanisme d'interconnexion (il existe déjà)

```
STATE.md → vérité opérationnelle du code (phases, dettes, schéma base)
PASSATION.md → kit de démarrage par thématique
Message passation → fil de transfert d'une conv à l'autre (à coller en 1er message)
CETTE CARTE → index au-dessus de tout : navigation entre conversations
```

Discipline qui fait que ça tient : à la fin de chaque session, la conv produit un
**message de passation complet** (jamais des extraits) que tu colles en tête de la
conv suivante. Cette carte ne fait que rendre visible la topologie de ces fils.

---

## 3. Les lignées thématiques

Légende statut : 🟢 vivante (on y reprend) · 🟡 en pause (réactivable) · ⚪ close (terminée) · 🔵 one-shot (mission ponctuelle finie) · ⚠️ à classer par toi

### Lignée A — Genèse & socle (close, valeur d'archive)

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| Base de données partagée pour applications rugby | 08/05 | ⚪ | **Acte fondateur** : l'idée d'une BDD commune aux apps rugby. |
| Progression du projet | 08/05 | ⚪ | Enrichissement M-14 SportEasy, `sites.json`, premières personnes. Socle de données. |

### Lignée B — Production (code / Hub vivant / SQL / déploiement) 🟢

C'est la colonne vertébrale technique. Elle s'est compactée plusieurs fois.

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| MOM Hub · Production | 12/05 | ⚪ | Origine de la lignée. Phase 2.5 Auth Magic Link. |
| MOM Hub - Production 2 | 13/05 | ⚪ | Reprise post-compactage. Phase 4, commits GitHub propres. |
| MOM Hub · Production · Phases 4.3-4.4 — Compositions & Présences | 15/05 | 🟡 | Compositions/Présences + intégration Bibliothèque. 3 chantiers laissés ouverts. |
| MOM Hub - Production Modules Joueurs | 16/05 | ⚪ | **Close.** Phase 5.14 Module Joueurs V1-Métier + Phase 2 complétion Évènements (v1.7) + Joueurs (v1.3). |
| **Production · Évènements** (`evenements.html`) | 17/05 | ⚠️ **non localisée** | Couloir de production du module Évènements. **`SUIVI-COACH-1` Objet A = LIVRÉ 17/05** ici (section « Suivi de la rencontre » sur la fiche événement : `evenements-browser.js` v1.7→v1.8 (Objet A) puis →**v1.10** (accroche Objet B « Revoir ce match ») + `supabase-client.js` v1.12→v1.13→**v1.15** (wrapper `genererLienEphemere` + couche données coach)). La conv exacte qui a produit Objet A **n'est pas identifiée** (le « lot v2 Évènements » mentionné par Manu n'a pas été localisé, confirmé 17/05) — mais le livrable est acté au STATE. ➡️ **Si reprise Évènements nécessaire (Objet A déjà fait) : retrouver la conv ou en ouvrir une dédiée**, 1er message = lecture STATE/CARTE. |
| **Production · `SUIVI-COACH-1` Objet B** (Mode Vidéo) | 17/05 | ⚪ | **Close.** Objet B (Mode Vidéo) **LIVRÉ** : `sql/C12-k` (lecture coach, SUIVI-COACH-4) + `js/supabase-client.js` v1.14→**v1.15** + `js/mode-video.js` **v0.1** (cerveau écran) + `js/evenements-browser.js` v1.9→**v1.10** (accroche B-Q1, addition pure prouvée) ; `mode-video.html` = version Manu. **`SUIVI-COACH-3-auth` levée Option A** (rôle+équipe ; mapping auth→personnes inexistant) · **`SUIVI-COACH-4` levée**. Dettes ouvertes non bloquantes : **`SUIVI-COACH-3-equipe`** & **`SUIVI-COACH-5`** (compo réduite coach ; UI Objet B honnêtement dégradée). **Objet C LIVRÉ 18/05** (ligne ci-dessous). |
| **Production · `SUIVI-COACH-1` Objet C** (spectateur + temps de jeu) | 18/05 | ⚪ | **Close.** Objet C **LIVRÉ DE BOUT EN BOUT** (5 fichiers, 1 fichier = 1 commit) : `spectateur.html` + `js/spectateur.js` **v1.0** (C-2 écran spectateur lecture seule, réutilise `SuiviClient` ; format de ligne = réplique exacte `suivi-app.js` v0.14) + `js/temps-de-jeu.js` **v1.0** (C-1 panneau temps de jeu, lecture pure, zéro RPC propre, libellé d'incertitude permanent) + `js/supabase-client.js` v1.15→**v1.16** (1 wrapper C12-l, addition pure prouvée, `mode-video.js` non touché) + `js/evenements-browser.js` v1.10→**v1.11** (accroche Objet C : panneau C-1 EN AVAL + lien spectateur C-2 dans l'état 3 / évolution A-Q4, addition pure prouvée). Lectures à la source tenues ; divergences remontées et tranchées par Manu (Option A wrapper v1.16 ; codes `SUIVI-COACH-7`/`-8` ; dégradations honnêtes). **`SUIVI-COACH-6` RÉSOLUE à la source** (scindée). **2 dettes conditionnelles non bloquantes ouvertes** : **`SUIVI-COACH-7`** (substitutions mono-ligne → C-1 dégradé honnête) & **`SUIVI-COACH-8`** (« terminé » non exposé voie spectateur → C-2 dégradé honnête) — pattern strict C12-k, non construites, à instruire en couloir backend uniquement si besoin terrain. Cycle `SUIVI-COACH-1` **clos**. À rouvrir seulement si besoin neuf. |
| **Production · Suivi de rencontre** (backend C12) | 16/05 · rouverte 18/05 | ⚪ | **Close** (re-close 18/05). Backend Suivi `chronologie_suivi`/`lien_suivi` : C12-a→f produits, exécutés en base + committés. **Rouverte 18/05 au seul titre « retouche SQL C12 »** : bug terrain `generer_lien_ephemere` (3 bugs SQL empilés) corrigé à la source, `sql/C12-f` resync committé, RPC vérifiées en base — backend réparé/recetté. A généré la dette **`SUIVI-CLIENT-1`** (bug affichage compo côté **client**, hors périmètre, 🔴 bloquant terrain — voir réconciliation en-tête + STATE pt 9). À rouvrir uniquement si retouche SQL C12 nécessaire. |
| **Production · Suivi backend (dettes SUIVI-UI)** | 17/05 | ⚪ | **CLOSE.** Couloir backend rouvert pour instruire les 4 dettes backend du cycle coach. **LIVRÉ 17/05** (exécutés en base + rangés `sql/` + committés, 1 fichier = 1 commit) : **`C12-g`** (`get_entete_rencontre` — SUIVI-UI-1 + SUIVI-UI-6 absorbée en piggy-back `role_lien`), **`C12-h`** (`get_lien_saisie_actif` — SUIVI-COACH-2 ; **décision d'archi : event-bornée authentifiée seule, volet jeton rejeté pour escalade spectateur→rédacteur**), **`C12-i`** (surcharge jeton-seul `consolider_score_rencontre` — SUIVI-UI-5, délègue à C12-e non modifié). Lecture protocole 5/5 à la source ; module bénévole et Objet A NON touchés (ajouts purs). Cadrage `Cadrage-SUIVI-COACH-1-Dettes-Backend.md` **réconcilié** (version Drive périmée à remplacer). **Sous-point ouvert remonté** : catégorie d'âge dans l'en-tête SUIVI-UI-1 (décision Manu). À rouvrir uniquement si retouche SQL nécessaire. |
| **Production · UI Suivi de rencontre** | 16/05 | 🔴 | **Module bénévole codé S-1→S-6 — mais bug terrain BLOQUANT (`SUIVI-CLIENT-1`, 18/05).** UI du Suivi par-dessus le backend C12 : `suivi.html` + `js/suivi-client.js` v1.1 + `js/suivi-app.js` **v0.14**. Code complet (entrée→coup d'envoi→saisie→correction→blessure→mode→fin→reprise), S-6 revu. **MAIS test terrain 18/05 : la compo ne s'affiche pas côté bénévole** alors que le backend est réparé et renvoie 20 lignes valides → bug **client** non diagnostiqué (`SUIVI-CLIENT-1` 🔴, console requise). **Le module n'est donc PAS recetté terrain** : « clôturé S-1→S-6 » = code écrit, pas = utilisable par un bénévole aujourd'hui. **➡️ À ROUVRIR pour diagnostiquer `SUIVI-CLIENT-1`** (ou nouveau fil dédié). Cycle coach `SUIVI-COACH-1` A+B+C = code livré/committé (≠ recetté tant que SUIVI-CLIENT-1 ouverte). Dettes ouvertes : **`SUIVI-CLIENT-1` 🔴 bloquant** + SUIVI-UI-2/3/4 + SUIVI-COACH-3-equipe/5/7/8 + SUIVI-COACH-deeplink (voir STATE). |
| MOM Hub - Production Module Bibliothèque d'ateliers | 14/05 | 🟡 | Scripts Python migration Drive + module Bibliothèque v6. Transféré vers Production. |

→ **Module Suivi bénévole CLÔTURÉ + couloir backend dettes SUIVI CLOS + cycle coach `SUIVI-COACH-1` LIVRÉ A+B+C de bout en bout (18/05).** Plus de reprise prévue sur la conv `Production · UI Suivi de rencontre` côté bénévole. **Objet B (Mode Vidéo) LIVRÉ 17/05** (4 fichiers) ; **Objet C (spectateur C-2 + temps de jeu C-1 + accroche) LIVRÉ 18/05 conv `Production`** : `spectateur.html` + `js/spectateur.js` v1.0 + `js/temps-de-jeu.js` v1.0 + `js/supabase-client.js` **v1.16** + `js/evenements-browser.js` **v1.11** (additions pures prouvées). `SUIVI-COACH-3`/`-3-auth`/`-4` levées ; `SUIVI-COACH-6` RÉSOLUE à la source ; dettes ouvertes non bloquantes `SUIVI-COACH-3-equipe`/`-5` + **2 dettes conditionnelles `SUIVI-COACH-7`** (substitutions mono-ligne, C-1 dégradé honnête) **/ `SUIVI-COACH-8`** (« terminé » non exposé voie spectateur, C-2 dégradé honnête) — pattern strict C12-k, non construites, à instruire en couloir backend **uniquement si besoin terrain**. **Cycle `SUIVI-COACH-1` clos** (ne pas rouvrir A/B/C sauf besoin neuf). Les conv backend Suivi (C12 a→f, dettes g/h/i) restent **closes** (rouvrir seulement si retouche SQL). Seul câblage backend Suivi encore ouvert, hors couloir : `C12-nom`.

### Lignée C — Audits / modélisation / doctrine 🟢

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| MOM Hub — Schémas formels du Core et cartographie globale | 10/05 | ⚪ | Schémas formels du Core + cartographie globale initiale. |
| Audits des modules MOM Hub selon flux opérationnel | 10/05 | ⚪ | Audits des 4 modules : Suivi Match, Rapport, Stats, Bilans. |
| Audit des modules | 11/05 | ⚪ | Suite : statut pivot de Compositions, doctrine à faire évoluer. |
| MOM Hub · Audits | 15/05 | 🟢 | **Front actif.** Nom court : **`Audits`**. Modélisation entités métier + audits référentiels. STATE.md mis à jour et committé depuis cette conv le 16/05. |
| MOM Hub - Conception du Portail | 16/05 | 🟢 | **Front actif.** Nom court : **`Conception`**. Conception du portail + doctrine d'interconnexion + conception UX modules (UI Suivi S-1→S-6). A produit la conception `SUIVI-COACH-1` Objet B (Mode Vidéo, validée Manu 17/05, **LIVRÉ en conv `Production`**) **puis Objet C (validé Manu 17/05 soir, pas-à-pas)** : `Conception-SUIVI-COACH-1-ObjetC.md` (sœur de `…-ObjetA.md`/`…-ObjetB.md`, déposé Drive ; C-1 temps de jeu + C-2 écran spectateur, 6 décisions C2-Q1/Q2/Q3 + C1-Q1/Q2/Q3, réserve réduite `SUIVI-COACH-6`). **➡️ Cycle `SUIVI-COACH-1` LIVRÉ A+B+C de bout en bout (Objet C LIVRÉ 18/05 conv `Production`).** Suite côté Conception sur ce cycle = rien (cycle clos). |

→ **Reprise Audits = conv `Audits`** ; **reprise Conception = conv `Conception`**.
→ ⚠️ **`STATE.md` à jour = fusion Audits/Conception → MAJ Prod 16/05 (Phase 5.14/Phase 2 + C12 + Suivi UI S-1) → MAJ Prod 17/05 (Suivi UI S-2→S-5.a + clôture S-6 module bénévole) → MAJ Prod 17/05 (couloir backend dettes SUIVI : C12-g/h/i, SUIVI-UI-1/5/6 + SUIVI-COACH-2 livrées) → MAJ Prod 17/05 (couloir backend SUIVI-COACH-3 : `sql/C12-j` écriture coach) → MAJ Prod 17/05 (couloir Production Objet B : `sql/C12-k` + supabase-client v1.15 + mode-video.js v0.1 + evenements-browser v1.10 ; SUIVI-COACH-3-auth Option A + SUIVI-COACH-4 levées ; SUIVI-COACH-3-equipe/5 ouvertes ; **Objet B LIVRÉ**) → MAJ Prod 17/05 (couloir backend SUIVI-COACH-5 : `sql/C12-l` compo réduite coach, levée backend) → **MAJ Conception 17/05 (Objet C conçu/validé : 6 décisions C2/C1, réserve réduite `SUIVI-COACH-6`) → **MAJ Prod 18/05 (`SUIVI-COACH-1` Objet C LIVRÉ : `spectateur.html`+`js/spectateur.js` v1.0 C-2, `js/temps-de-jeu.js` v1.0 C-1, `js/supabase-client.js` v1.16, accroche `js/evenements-browser.js` v1.11 ; additions pures prouvées ; `SUIVI-COACH-6` résolue à la source ; dettes conditionnelles `SUIVI-COACH-7`/`-8` ouvertes non bloquantes ; cycle `SUIVI-COACH-1` LIVRÉ A+B+C de bout en bout)**.** Toute reprise lit cette version, pas une copie antérieure.
→ Note : 2 dettes nouvelles touchent cette lignée — **SUIVI-UI-2** (observable « coup d'envoi » au référentiel + contrat aval Rapport/Stats type DS-1) côté Audits/Référentiels ; **C12-gate** (`resultat` vs `archive`) côté Audits.

### Lignée D — Réconciliation source externe (vie courte, close) ⚪

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| MOM Hub · Extractions OVAL-E | 11/05 | ⚪ | Réconciliation extraction OVAL-E (FFR) vs base Supabase. 293→298 licenciés alignés. À rouvrir à la prochaine extraction OVAL-E. |

### Lignée E — Modules pédagogiques & contenus 🟢

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| MOM Hub - Modules Ateliers et ressources pédagogiques | 14/05 | 🟢 | App web `manu-mom.github.io/ateliers-edr` + module Bibliothèque + futur module Ateliers. |
| Converter PPTX → cartouche fiches v2 | 14/05 | 🟢 | **Strictement** le convertisseur Python PPTX→fiche.json + rendu cartouche. Ne rien y mélanger. |
| MOM Hub - Modules Planification de la saison et préparation de séances | 12/05 | 🟡 | Modules Planification de saison + Préparation de séances. |
| MOM Hub - Référentiel Jeux à toucher | 14/05 | 🔵 | 2 docx livrés. Mission finie. |
| Terminologie et blocs pour planification de saison rugby | 14/05 | 🔵 | Recherche vocabulaire de périodisation. Finie. |

### Lignée F — À classer par toi ⚠️

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| (conversation du 15/05) | 15/05 | ⚠️ | Contenu non récupérable depuis une autre conversation. À ouvrir et reclasser, ou archiver. |

---

## 4. Guide de décision — quelle conv j'ouvre ?

| Je veux… | J'ouvre / je reprends |
|---|---|
| 🔴 **Réparer le Suivi qui ne marche pas en terrain (compo ne s'affiche pas côté bénévole)** | **PRIORITÉ — dette `SUIVI-CLIENT-1`.** Bug **client** établi 18/05 : backend réparé/recetté (RPC renvoie 20 lignes en base) mais la compo ne s'affiche pas → `suivi.html`/`suivi-app.js`/`suivi-client.js`. **Rouvrir la conv `Production · UI Suivi de rencontre`** (ou nouveau fil dédié). 1ʳᵉ chose à fournir : **console navigateur (F12) quand le bénévole ouvre le lien** (appel RPC émis ? réponse reçue ? erreur JS ?). NE PAS deviner — causes opposées, le fait tranche. PAS la conv backend C12 (backend déjà sain). |
| Reprendre le Suivi (Mode Vidéo, temps de jeu, écran spectateur) | **Cycle `SUIVI-COACH-1` LIVRÉ A+B+C de bout en bout (clos).** Objet A livré ; Objet B (Mode Vidéo) LIVRÉ 17/05 ; **Objet C LIVRÉ 18/05 conv `Production`** (`spectateur.html`+`js/spectateur.js` v1.0 C-2, `js/temps-de-jeu.js` v1.0 C-1, `js/supabase-client.js` v1.16, accroche `js/evenements-browser.js` v1.11). **Ne pas rouvrir A/B/C sauf besoin neuf.** 2 dettes conditionnelles non bloquantes au registre (dégradations honnêtes en place), à instruire en **couloir backend, pattern strict C12-k, uniquement si besoin terrain** : `SUIVI-COACH-7` (substitutions mono-ligne → backend doit stocker le sens) ; `SUIVI-COACH-8` (« terminé » non exposé voie spectateur → backend doit exposer un état à la voie jeton). Backend `SUIVI-COACH-5`/`-3-equipe` inchangées (non bloquantes). Câblage backend restant indépendant : `C12-nom`. PAS dans la conv UI Suivi bénévole (clôturée). |
| Reprendre/retoucher Évènements (Objet A déjà livré) | **Couloir `Production · Évènements`** (ligne ⚠️ ci-dessus, conv à localiser ou rouvrir). Objet A `SUIVI-COACH-1` est FAIT (evenements-browser **v1.11** : Objet A + accroche Objet B + accroche Objet C). |
| Instruire les dettes backend SUIVI-UI-1/5/6 (+ SUIVI-COACH-2) | **FAIT** — couloir `Production · Suivi backend (dettes SUIVI-UI)` **clos** (C12-g/h/i exécutés + committés 17/05). Rien à rouvrir sauf retouche SQL. |
| Retoucher le backend SQL C12 du Suivi (a→f ou g/h/i) | conv **`Production · Suivi de rencontre` (backend C12)** ou **`Production · Suivi backend (dettes SUIVI-UI)`** — closes, à rouvrir pour ce seul motif |
| Coder un autre module, écrire du SQL, déployer | nouvelle conv Production (ou la conv Production pertinente) |
| Modéliser une entité métier, écrire un audit, trancher SUIVI-UI-2 / C12-gate | conv **`Audits`** |
| Travailler la structure du portail / la doctrine d'interconnexion | conv **`Conception`** |
| Toucher au convertisseur PPTX→JSON | **Converter PPTX → cartouche fiches v2** |
| Travailler l'app ateliers-edr / module Bibliothèque ou Ateliers | **MOM Hub - Modules Ateliers et ressources pédagogiques** |
| Travailler Planification de saison / Préparation de séances | **MOM Hub - Modules Planification…** |
| Réconcilier une nouvelle extraction OVAL-E | Nouvelle conv calquée sur **Extractions OVAL-E** |
| Un sujet neuf et autonome | Nouvelle conv + 1er message = lecture STATE.md/PASSATION.md + cette carte |

---

## 5. Recommandations de consolidation

1. **3 fronts vivants seulement, aux noms courts.** `Production`, `Audits`, `Conception`.
 Pour le Suivi, le module bénévole est clôturé et les deux couloirs backend (C12 a→f, dettes g/h/i) sont clos ; **cycle `SUIVI-COACH-1` LIVRÉ A+B+C de bout en bout** (Objet B conv `Production` 17/05 ; Objet C conv `Production` 18/05) → **cycle clos**, plus aucun couloir Suivi ouvert (2 dettes conditionnelles non bloquantes `SUIVI-COACH-7`/`-8` à instruire seulement si besoin terrain).
2. **Renomme les fils clos** avec un préfixe `[ARCHIVE]` (ex. `[ARCHIVE] Production · Suivi de rencontre (backend C12)`, `[ARCHIVE] Production · Suivi backend (dettes SUIVI-UI)`, `[ARCHIVE] Production · SUIVI-COACH-1 Objet B`, `[ARCHIVE] Production · SUIVI-COACH-1 Objet C`).
 Tu réduis le bruit visuel sans rien perdre.
3. **`STATE.md` reste l'unique source de vérité du code.** Dernière version : **fusion Audits/Conception + MAJ Prod 16/05 (Phase 5.14/Phase 2 + C12 + Suivi UI S-1) + MAJ Prod 17/05 (Suivi UI S-2→S-5.a, clôture S-6) + MAJ Prod 17/05 (couloir backend dettes SUIVI : C12-g/h/i ; SUIVI-UI-1/5/6 + SUIVI-COACH-2 livrées ; décision archi SUIVI-COACH-2) + MAJ Prod 17/05 (SUIVI-COACH-3 : C12-j écriture coach) + MAJ Prod 17/05 (Objet B LIVRÉ : C12-k + supabase-client v1.15 + mode-video.js v0.1 + evenements-browser v1.10 ; SUIVI-COACH-3-auth Option A + SUIVI-COACH-4 levées ; SUIVI-COACH-3-equipe/5 ouvertes) + MAJ Prod 17/05 (`sql/C12-l` compo réduite coach, SUIVI-COACH-5 levée backend) + MAJ Conception 17/05 (Objet C conçu/validé, réserve réduite `SUIVI-COACH-6`) + MAJ Prod 18/05 (`SUIVI-COACH-1` Objet C LIVRÉ : spectateur.html + spectateur.js v1.0 + temps-de-jeu.js v1.0 + supabase-client v1.16 + evenements-browser v1.11 ; additions pures prouvées ; SUIVI-COACH-6 résolue à la source ; dettes conditionnelles SUIVI-COACH-7/8 ouvertes non bloquantes ; cycle `SUIVI-COACH-1` LIVRÉ A+B+C de bout en bout)**.
 Cette carte ne le double pas, elle pointe vers lui. Toute conv qui reprend lit d'abord le `STATE.md` committé.
4. **Maintien de cette carte** : à chaque clôture/ouverture de fil, mettre à jour la ligne + la date d'en-tête. Fichier à éditer à la main, comme `STATE.md`.
5. **La conv ⚠️ du 15/05** : à ouvrir, identifier son sujet, ranger ou archiver. Seul angle mort de cette carte.

---

*Fin de la carte · à uploader dans Drive `00 - Documentation/`*
