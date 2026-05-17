# Carte des conversations — MOM Hub

> Index maître de navigation. Se place **au-dessus** de `STATE.md` (vérité opérationnelle du code)
> et `PASSATION.md` (kit de démarrage). Ce document ne remplace ni l'un ni l'autre : il dit
> *quelle conversation fait quoi, où elle en est, et laquelle ouvrir pour quoi*.
>
> Établi le 16 mai 2026 · révisé le 17 mai 2026 (MAJ Prod — UI Suivi : **module bénévole CLÔTURÉ S-1→S-6**, revue invariants OK ; suite = cycle coach séparé `SUIVI-COACH-1`) · 21 conversations recensées · À garder à jour à la main.
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
| **Production · Suivi de rencontre** (backend C12) | 16/05 | ⚪ | **Close.** Backend Suivi `chronologie_suivi`/`lien_suivi` : C12-a→f produits, **exécutés en base Supabase + rangés `sql/` + committés**. Mission backend accomplie. À rouvrir uniquement si retouche SQL C12 nécessaire. |
| **Production · UI Suivi de rencontre** | 16/05 | 🟢 | **Module bénévole CLÔTURÉ (S-1 → S-6).** UI du Suivi par-dessus le backend C12 : `suivi.html` + `js/suivi-client.js` v1.1 + `js/suivi-app.js` **v0.14**. Complet, utilisable en live de bout en bout (entrée→coup d'envoi→saisie complète→correction→blessure→mode→fin verrouillée→reprise/relais). S-6 fait (revue vs 5 invariants OK, sans code). **Plus aucun code prévu côté bénévole.** Suite = **cycle coach séparé `SUIVI-COACH-1`** (Mode Vidéo + temps de jeu + pont Hub↔Suivi), à cadrer en conv Conception après instruction des dettes backend. Dettes ouvertes : SUIVI-UI-1/2/3/4/5/6 + SUIVI-COACH-1 (voir STATE). |
| MOM Hub - Production Module Bibliothèque d'ateliers | 14/05 | 🟡 | Scripts Python migration Drive + module Bibliothèque v6. Transféré vers Production. |

→ **Module Suivi bénévole CLÔTURÉ.** Plus de reprise prévue sur la conv `Production · UI Suivi de rencontre` côté bénévole. La suite du Suivi = **cycle coach `SUIVI-COACH-1`** (Mode Vidéo / temps de jeu / pont Hub↔Suivi), à **ouvrir en conv Conception** après instruction des dettes backend SUIVI-UI-1/5/6 (conv Production). La conv backend C12 reste **close** (rouvrir seulement si retouche SQL C12).

### Lignée C — Audits / modélisation / doctrine 🟢

| Conv | Date | Statut | Rôle |
|---|---|---|---|
| MOM Hub — Schémas formels du Core et cartographie globale | 10/05 | ⚪ | Schémas formels du Core + cartographie globale initiale. |
| Audits des modules MOM Hub selon flux opérationnel | 10/05 | ⚪ | Audits des 4 modules : Suivi Match, Rapport, Stats, Bilans. |
| Audit des modules | 11/05 | ⚪ | Suite : statut pivot de Compositions, doctrine à faire évoluer. |
| MOM Hub · Audits | 15/05 | 🟢 | **Front actif.** Nom court : **`Audits`**. Modélisation entités métier + audits référentiels. STATE.md mis à jour et committé depuis cette conv le 16/05. |
| MOM Hub - Conception du Portail | 16/05 | 🟢 | **Front actif.** Nom court : **`Conception`**. Conception du portail + doctrine d'interconnexion + conception UX modules (UI Suivi S-1→S-6). |

→ **Reprise Audits = conv `Audits`** ; **reprise Conception = conv `Conception`**.
→ ⚠️ **`STATE.md` à jour = fusion Audits/Conception + MAJ Prod 16/05 (Phase 5.14/Phase 2 + C12 + Suivi UI S-1).** Toute reprise lit cette version, pas une copie antérieure.
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
| Reprendre le Suivi (Mode Vidéo, temps de jeu, pont Hub) | **Nouveau cycle `SUIVI-COACH-1`** : cadrer en conv **Conception** (après dettes backend SUIVI-UI-1/5/6 en conv Production). PAS dans la conv UI Suivi bénévole (clôturée). |
| Retoucher le backend SQL C12 du Suivi | conv **`Production · Suivi de rencontre` (backend C12)** — close, à rouvrir pour ce seul motif |
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
 Pour le Suivi, le front Production actif est **`Production · UI Suivi de rencontre`** ;
 la conv backend C12 est close (rouvrir seulement pour retouche SQL C12).
2. **Renomme les fils clos** avec un préfixe `[ARCHIVE]` (ex. `[ARCHIVE] Production · Suivi de rencontre (backend C12)`).
 Tu réduis le bruit visuel sans rien perdre.
3. **`STATE.md` reste l'unique source de vérité du code.** Dernière version : **fusion Audits/Conception + MAJ Prod 16/05 (Phase 5.14/Phase 2 + C12 + Suivi UI S-1)**.
 Cette carte ne le double pas, elle pointe vers lui. Toute conv qui reprend lit d'abord le `STATE.md` committé.
4. **Maintien de cette carte** : à chaque clôture/ouverture de fil, mettre à jour la ligne + la date d'en-tête. Fichier à éditer à la main, comme `STATE.md`.
5. **La conv ⚠️ du 15/05** : à ouvrir, identifier son sujet, ranger ou archiver. Seul angle mort de cette carte.

---

*Fin de la carte · à uploader dans Drive `00 - Documentation/`*
