# Carte des conversations — MOM Hub

> Index maître de navigation. Se place **au-dessus** de `STATE.md` (vérité opérationnelle du code)
> et `PASSATION.md` (kit de démarrage). Ce document ne remplace ni l'un ni l'autre : il dit
> *quelle conversation fait quoi, où elle en est, et laquelle ouvrir pour quoi*.
>
> Établi le 16 mai 2026 · révisé le 17 mai 2026 (MAJ Prod — UI Suivi : **module bénévole CLÔTURÉ S-1→S-6** ; **`SUIVI-COACH-1` Objet A LIVRÉ** (evenements-browser v1.8 / supabase-client v1.13) ; **couloir `Production · Suivi backend` CLOS** : C12-g/h/i livrés, dettes SUIVI-UI-1/5/6 + SUIVI-COACH-2 soldées ; **Objets B/C de `SUIVI-COACH-1` débloqués** ; **Conception 17/05 : Objet B (Mode Vidéo) conçu/validé** (`Conception-SUIVI-COACH-1-ObjetB.md`, à déposer) — reste Objet C) · 23 lignes de conversation recensées (dont 1 couloir à localiser ; couloir backend Suivi désormais clos) · À garder à jour à la main.
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
| **Production · Évènements** (`evenements.html`) | 17/05 | ⚠️ **non localisée** | Couloir de production du module Évènements. **`SUIVI-COACH-1` Objet A = LIVRÉ 17/05** ici (section « Suivi de la rencontre » sur la fiche événement : `evenements-browser.js` v1.7→**v1.8** + `supabase-client.js` v1.12→**v1.13** wrapper `genererLienEphemere`). La conv exacte qui a produit Objet A **n'est pas identifiée** (le « lot v2 Évènements » mentionné par Manu n'a pas été localisé, confirmé 17/05) — mais le livrable est acté au STATE. ➡️ **Si reprise Évènements nécessaire (Objet A déjà fait) : retrouver la conv ou en ouvrir une dédiée**, 1er message = lecture STATE/CARTE. |
| **Production · Suivi de rencontre** (backend C12) | 16/05 | ⚪ | **Close.** Backend Suivi `chronologie_suivi`/`lien_suivi` : C12-a→f produits, **exécutés en base Supabase + rangés `sql/` + committés**. Mission backend accomplie. À rouvrir uniquement si retouche SQL C12 nécessaire. |
| **Production · Suivi backend (dettes SUIVI-UI)** | 17/05 | ⚪ | **CLOSE.** Couloir backend rouvert pour instruire les 4 dettes backend du cycle coach. **LIVRÉ 17/05** (exécutés en base + rangés `sql/` + committés, 1 fichier = 1 commit) : **`C12-g`** (`get_entete_rencontre` — SUIVI-UI-1 + SUIVI-UI-6 absorbée en piggy-back `role_lien`), **`C12-h`** (`get_lien_saisie_actif` — SUIVI-COACH-2 ; **décision d'archi : event-bornée authentifiée seule, volet jeton rejeté pour escalade spectateur→rédacteur**), **`C12-i`** (surcharge jeton-seul `consolider_score_rencontre` — SUIVI-UI-5, délègue à C12-e non modifié). Lecture protocole 5/5 à la source ; module bénévole et Objet A NON touchés (ajouts purs). Cadrage `Cadrage-SUIVI-COACH-1-Dettes-Backend.md` **réconcilié** (version Drive périmée à remplacer). **Sous-point ouvert remonté** : catégorie d'âge dans l'en-tête SUIVI-UI-1 (décision Manu). À rouvrir uniquement si retouche SQL nécessaire. |
| **Production · UI Suivi de rencontre** | 16/05 | 🟢 | **Module bénévole CLÔTURÉ (S-1 → S-6).** UI du Suivi par-dessus le backend C12 : `suivi.html` + `js/suivi-client.js` v1.1 + `js/suivi-app.js` **v0.14**. Complet, utilisable en live de bout en bout (entrée→coup d'envoi→saisie complète→correction→blessure→mode→fin verrouillée→reprise/relais). S-6 fait (revue vs 5 invariants OK, sans code). **Plus aucun code prévu côté bénévole.** Suite = **cycle coach séparé `SUIVI-COACH-1`** (Mode Vidéo + temps de jeu + pont Hub↔Suivi). Pré-requis backend (SUIVI-UI-1/5/6 + SUIVI-COACH-2) **désormais tous livrés** → Objets B/C cadrables en conv Conception. Dettes ouvertes : SUIVI-UI-2/3/4 + SUIVI-COACH-1(B/C) + SUIVI-COACH-deeplink (voir STATE). |
| MOM Hub - Production Module Bibliothèque d'ateliers | 14/05 | 🟡 | Scripts Python migration Drive + module Bibliothèque v6. Transféré vers Production. |

→ **Module Suivi bénévole CLÔTURÉ + couloir backend dettes SUIVI CLOS.** Plus de reprise prévue sur la conv `Production · UI Suivi de rencontre` côté bénévole. Les dettes backend SUIVI-UI-1/5/6 + SUIVI-COACH-2 sont **instruites et livrées** (C12-g/h/i). La suite du Suivi = **cycle coach `SUIVI-COACH-1` Objets B/C** (Mode Vidéo / temps de jeu / écran spectateur). **Objet B (Mode Vidéo) conçu/validé 17/05** (`Conception-SUIVI-COACH-1-ObjetB.md`) → suite = **conv `Production` Objet B** (sous réserve d'une vérif source `sql/` C12-c — réserve `SUIVI-COACH-3`), puis **Objet C à concevoir** (temps de jeu C-1 + écran spectateur C-2) en conv **Conception**. Les deux conv backend Suivi (C12 a→f, dettes g/h/i) restent **closes** (rouvrir seulement si retouche SQL). Seul câblage backend Suivi encore ouvert, hors couloir : `C12-nom`.

### Lignée C — Audits / modélisation / doctrine 🟢

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| MOM Hub — Schémas formels du Core et cartographie globale | 10/05 | ⚪ | Schémas formels du Core + cartographie globale initiale. |
| Audits des modules MOM Hub selon flux opérationnel | 10/05 | ⚪ | Audits des 4 modules : Suivi Match, Rapport, Stats, Bilans. |
| Audit des modules | 11/05 | ⚪ | Suite : statut pivot de Compositions, doctrine à faire évoluer. |
| MOM Hub · Audits | 15/05 | 🟢 | **Front actif.** Nom court : **`Audits`**. Modélisation entités métier + audits référentiels. STATE.md mis à jour et committé depuis cette conv le 16/05. |
| MOM Hub - Conception du Portail | 16/05 | 🟢 | **Front actif.** Nom court : **`Conception`**. Conception du portail + doctrine d'interconnexion + conception UX modules (UI Suivi S-1→S-6). **A produit la conception `SUIVI-COACH-1` Objet B (Mode Vidéo), validée Manu 17/05** : `Conception-SUIVI-COACH-1-ObjetB.md` (sœur de `…-ObjetA.md`, à déposer Drive). Suite côté Conception = Objet C (temps de jeu C-1 + écran spectateur C-2). |

→ **Reprise Audits = conv `Audits`** ; **reprise Conception = conv `Conception`**.
→ ⚠️ **`STATE.md` à jour = fusion Audits/Conception → MAJ Prod 16/05 (Phase 5.14/Phase 2 + C12 + Suivi UI S-1) → MAJ Prod 17/05 (Suivi UI S-2→S-5.a + clôture S-6 module bénévole) → MAJ Prod 17/05 (couloir backend dettes SUIVI : C12-g/h/i, SUIVI-UI-1/5/6 + SUIVI-COACH-2 livrées).** Toute reprise lit cette version, pas une copie antérieure.
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
| Reprendre le Suivi (Mode Vidéo, temps de jeu, écran spectateur) | **Cycle `SUIVI-COACH-1`.** Objet A livré ; **Objet B (Mode Vidéo) conçu/validé 17/05** → **conv `Production` Objet B** (d'abord vérifier à la source `sql/` C12-c — réserve `SUIVI-COACH-3` ; puis coder l'écran + spécifier l'accroche `evenements-browser.js`). **Objet C** (temps de jeu C-1 + écran spectateur C-2) = à **concevoir en conv `Conception`**. PAS dans la conv UI Suivi bénévole (clôturée). |
| Reprendre/retoucher Évènements (Objet A déjà livré) | **Couloir `Production · Évènements`** (ligne ⚠️ ci-dessus, conv à localiser ou rouvrir). Objet A `SUIVI-COACH-1` est FAIT (evenements-browser v1.8). |
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
 Pour le Suivi, le module bénévole est clôturé et les deux couloirs backend (C12 a→f, dettes g/h/i) sont clos ; Objet B (Mode Vidéo) est conçu/validé (suite = conv `Production`), reste Objet C à concevoir en conv `Conception`.
2. **Renomme les fils clos** avec un préfixe `[ARCHIVE]` (ex. `[ARCHIVE] Production · Suivi de rencontre (backend C12)`, `[ARCHIVE] Production · Suivi backend (dettes SUIVI-UI)`).
 Tu réduis le bruit visuel sans rien perdre.
3. **`STATE.md` reste l'unique source de vérité du code.** Dernière version : **fusion Audits/Conception + MAJ Prod 16/05 (Phase 5.14/Phase 2 + C12 + Suivi UI S-1) + MAJ Prod 17/05 (Suivi UI S-2→S-5.a, clôture S-6) + MAJ Prod 17/05 (couloir backend dettes SUIVI : C12-g/h/i ; SUIVI-UI-1/5/6 + SUIVI-COACH-2 livrées ; décision archi SUIVI-COACH-2)**.
 Cette carte ne le double pas, elle pointe vers lui. Toute conv qui reprend lit d'abord le `STATE.md` committé.
4. **Maintien de cette carte** : à chaque clôture/ouverture de fil, mettre à jour la ligne + la date d'en-tête. Fichier à éditer à la main, comme `STATE.md`.
5. **La conv ⚠️ du 15/05** : à ouvrir, identifier son sujet, ranger ou archiver. Seul angle mort de cette carte.

---

*Fin de la carte · à uploader dans Drive `00 - Documentation/`*
