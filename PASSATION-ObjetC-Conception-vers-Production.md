# Passation — `Conception` Objet C → `Production` : `SUIVI-COACH-1` Objet C

> À coller en **1er message** de la conv `Production` pour ouvrir le couloir de production
> d'**Objet C** du cycle `SUIVI-COACH-1` (C-1 temps de jeu + C-2 écran spectateur).
> Émise le 17 mai 2026 (soir) depuis la conv `Conception`, à la clôture de la conception
> d'Objet C. **Dernier objet du cycle** : à sa livraison, `SUIVI-COACH-1` sera complet de bout en bout.

---

## 0. Lecture protocole AVANT toute production (ordre imposé, à la source)

Ne produire **aucune ligne de code** avant d'avoir lu, **dans cet ordre, à la source Drive** :

1. `CARTE-CONVERSATIONS-MOM-Hub.md` (vérifier `modifiedTime`) — topologie des conv. Le maillon attendu en queue : *Conception 17/05 (soir) : Objet C conçu/validé — cycle conceptuellement complet*.
2. `PASSATION.md` — kit de démarrage générique (discipline, où trouver quoi).
3. `STATE.md` — **vérité opérationnelle du code**. Vérifier le `modifiedTime` Drive **avant** de t'en servir comme base ; c'est la version de référence (FUSION). Dernier maillon attendu : *MAJ Conception 17/05 (cycle `SUIVI-COACH-1` — Objet C conçu/validé)*. **Si divergence : la signaler et la réconcilier explicitement (jamais d'écrasement). Repartir toujours de la fusion vivante.**
4. `Conception-SUIVI-COACH-1-ObjetC.md` (validé Manu, version réconciliée soir) — **les 6 décisions C2-Q1/Q2/Q3 + C1-Q1/Q2/Q3 y sont figées. Entrées de production, à NE PAS rouvrir.** L'encart §0bis et la réserve `SUIVI-COACH-6` y sont tracés.
5. `Conception-Portail-UI-Suivi.md` — **S-5.1** (écran spectateur) et **S-5.4** (temps de jeu) : conception de fond déjà tranchée ; Objet C la **décline**, le code la **respecte**, ne la refait pas.
6. `Conception-SUIVI-COACH-1-ObjetA.md` + `Conception-SUIVI-COACH-1-ObjetB.md` — pour le style « accroche / addition pure » et la cohérence du cycle (modèle SUIVI-COACH-2 strict).

---

## 1. Ce qui vient de se passer (état du cycle)

`SUIVI-COACH-1` : **Objet A LIVRÉ** · **Objet B (Mode Vidéo) LIVRÉ** (conv `Production`, 17/05) · **Objet C conçu/validé** (conv `Conception`, 17/05 soir, validation pas-à-pas micro-étape par micro-étape). **Cycle conceptuellement complet.**

**Il reste à PRODUIRE Objet C** = deux surfaces distinctes, conçues sans être fondues :

- **C-2 — écran spectateur** : dérivé **lecture seule distinct**, destination du lien spectateur qu'Objet A produit déjà.
- **C-1 — temps de jeu** : **panneau de consultation** côté coach (estimation), dans la section « Suivi de la rencontre » de la fiche événement.

Ta mission : **coder Objet C** (les deux surfaces) en respectant strictement les 6 décisions de `Conception-SUIVI-COACH-1-ObjetC.md`, **validation Manu**, **1 fichier = 1 commit**. À la clôture : MAJ `STATE.md` + `CARTE` + message de passation. Le cycle `SUIVI-COACH-1` sera alors **complet de bout en bout**.

---

## 2. Première action obligatoire — vérifier `SUIVI-COACH-6` à la source (AVANT spec fine)

C'est la **seule réserve ouverte** d'Objet C, et elle est **réduite** :

- La conv Production (Objet B) a déjà **vérifié C12-d à la source** et livré **C12-k** (`get_chronologie_rencontre_coach`, payload contrat-identique aux 15 colonnes de C12-d, paramètre `p_inclure_annulees`). De ce fait : le **point jeton-spectateur (C-2)** et le **point annule/corrigee** sont **déjà levés à la source** (C12-d reste la voie spectateur jeton-seul ; `p_inclure_annulees` existe).
- **Reste le seul point résiduel `SUIVI-COACH-6`** : confirmer **à la source `sql/`** (lire C12-d ET C12-k) que les **15 colonnes du payload portent de quoi reconstituer entrée/sortie des remplacements** — joueur entrant, joueur sortant, horodatage de la ligne de remplacement — pour le calcul d'estimation temps de jeu de C-1.
  - **Champs présents** → C-1 calcule côté client tel quel, **aucune dette**, consomme C12-k (déjà livré).
  - **Champs absents/insuffisants** → soit le calcul s'appuie sur ce qui est exposé, soit **dette backend conditionnelle** (pattern strict C12-k : ajout pur, helpers C12-j v1.1 réutilisés, **C12-d JAMAIS modifié**, `authenticated` seul, idempotent). **À tracer, jamais inventer.**

**Ne rien deviner sur ce point. Vérifier d'abord, coder ensuite.**

---

## 3. Tes entrées (contrats figés, vérifiés à la source — NE PAS rouvrir)

### C-2 — écran spectateur

- **C2-Q1** : **fichier distinct dédié** (pas un mode de `suivi.html` — anti-pattern S-5.1.a explicitement rejeté). Réutilise le *rendu lecture* de `suivi.html` (score Zone A, chrono, fil Zone E), mêmes tokens `.suivi-*`, même format de ligne. **ZÉRO surface d'écriture** (pas de Zone C palette, pas de Zone D joueur, pas de Zone B bascule, pas de ⚙, pas de sas) — sûr par construction. `role_lien` (C12-g) **informe** (« vous suivez en spectateur »), **n'active rien**. Cohérent décision d'archi `SUIVI-COACH-2` : le spectateur ne voit **jamais** le jeton `saisie`, C-2 ne connaît que son jeton spectateur dans l'URL.
- **C2-Q2** : score = **SUM calculé client** sur la chronologie lue (jamais la photo `evenements` — I1). Fil = **récit effectif** : lignes annulées **non affichées** (C12-d sait le faire via `p_inclure_annulees`), corrigées **à valeur courante**. **Pas** de marqueur `source_saisie` (≠ B-Q2a : le spectateur ne complète rien). 4 états de cycle de vie honnêtes (pas commencé / en cours refresh ~10 s / terminé refresh ralenti + bouton manuel / lien expiré). **Payload réduit RGPD** inchangé (numéro + nom court ; `libelleJoueur()` dégrade si `nom_court` NULL).
- **C2-Q3** : **A génère / C-2 ouvre.** Le lien spectateur est **déjà produit par C12-f** : ni re-conçu ni re-généré. C-2 = la **destination**. Lecture via **C12-d voie jeton spectateur** (anon+jeton, intact, non modifié).
- **Source de lecture C-2** : `getChronologieRencontre` (`suivi-client.js` v1.1, voie jeton) — la couche existe déjà.

### C-1 — temps de jeu

- **C1-Q1** : **panneau de consultation dans la section « Suivi de la rencontre »** de la fiche événement (Objet A). **PAS** dans l'écran B (B-Q5, confirmé : `mode-video.js` v0.1 ne le porte pas), **PAS** écran distinct, **PAS** `suivi.html`, **PAS** exposé au spectateur. **Coach only** (accès Hub).
- **C1-Q2** : estimation **par joueur** sur la rencontre, **arrondie** (« ~38 min », jamais de secondes). **Libellé d'incertitude permanent et non refermable**, constitutif de l'affichage (honnêteté épistémique S-5.4). Panneau **discret, replié par défaut** (la forme dit la fiabilité ; anti V6). **Lecture via `get_chronologie_rencontre_coach` (C12-k, déjà livré, voie coach authentifié)**, calcul côté client. Découpage par période / barre « officielle » / alerte automatique = **écartés** (jamais donnée d'autorité).
- **C1-Q3** : **lecture pure** — zéro écriture, **aucune RPC propre** (consomme C12-k existant), **jamais consolidé nulle part** (la volatilité = traduction technique de « jamais autorité »). Frontière dure **QUOI/POURQUOI** : aucun champ analyse/commentaire (l'analyse = le Rapport). 4 états de cycle de vie honnêtes. Zéro couplage module→module (PI-1 : C-1 lit le Core, ne parle ni à B ni à C-2).

### Accroche dans `evenements-browser.js` (modèle SUIVI-COACH-2 strict)

- La section « Suivi de la rencontre » d'Objet A gagne, en phase aval : **le lien spectateur** (évolution A-Q4, état 3) **et le panneau temps de jeu C-1**. **C'est une retouche d'`evenements-browser.js` tranchée ICI (Production)**, sur le **modèle exact de l'accroche Objet B** : **addition pure prouvée** (diff = idéalement la seule ligne de header de version + le bloc ajouté), `node --check` OK, **zéro retouche de la logique d'Objet A**. Le précédent v1.9→v1.10 (accroche « Revoir ce match ») est la référence. En tournoi : un lien spectateur **par match enfant dans la structure** (réutilise A-Q3, jamais à plat).

---

## 4. Doctrine non négociable (rappel)

- **P1 — simplicité avant tout.** C-2 = recomposition de composants de lecture existants dans une coquille sans écriture ; C-1 = petit panneau replié. Pas de schéma riche, pas d'architecture élaborée. Si ça devient lourd, c'est qu'on s'égare.
- **Ne rien deviner.** Tout contrat (colonnes C12-d/C12-k, payload, seuil) se **vérifie à la source** avant d'être codé. Hypothèse non vérifiée = **dette tracée**, jamais invention silencieuse. `SUIVI-COACH-6` se vérifie AVANT spec fine de C-1.
- **Lecture seule = lecture seule.** C-2 spectateur : aucune surface d'écriture, escalade impossible par construction (jamais le jeton `saisie`). C-1 : aucune écriture, aucune RPC propre.
- **Temps de jeu = estimation, jamais autorité.** Le vocabulaire compte (« estimation », libellé d'incertitude permanent). Jamais une barre « officielle », jamais une alerte automatique.
- **Frontière dure QUOI / POURQUOI.** Aucun champ analyse/commentaire dans Objet C.
- **Intangibles.** `suivi.html`/module bénévole **non touché** (invariant sans-login). Objet A **non retouché en logique** (accroche = addition pure prouvée, modèle SUIVI-COACH-2). Objet B **non touché**. C12-d/C12-f/C12-e/C12-k/C12-l **non modifiés** (toute dette backend éventuelle = ajout pur pattern C12-k).
- **1 fichier = 1 commit** ; titre + corps fournis systématiquement, sans que Manu ait à le demander.
- **Fichiers COMPLETS prêts à déposer, JAMAIS de patches** ni d'extraits.
- **Réconciliation explicite** de toute divergence STATE/CARTE (jamais d'écrasement ; repartir de la fusion vivante, revérifier `modifiedTime` avant toute MAJ).
- **Pas-à-pas avec validation Manu.** Validation groupée possible sur document/lot complet (comme Objet B).
- **Une conv = un sujet** : cette conv = **production Objet C uniquement**. Pas de retour sur A/B, pas de re-conception (les 6 décisions sont figées).

---

## 5. Ce qui n'est PAS ton périmètre

- **Aucune re-conception.** Les 6 décisions de `Conception-SUIVI-COACH-1-ObjetC.md` sont des **entrées figées**. Si une vraie question de conception émerge en cours de route → la **tracer** et la remonter, ne pas trancher en Production.
- **Objet A / Objet B sont LIVRÉS** — on ne les « améliore » pas. L'accroche dans `evenements-browser.js` est une **addition pure** (modèle SUIVI-COACH-2), pas une retouche logique.
- **Module bénévole** (`suivi.html`/`suivi-app.js`/`suivi-client.js`) : clôturé, intangible. Hors sujet (sauf **réutilisation en lecture seule** de patterns/tokens pour C-2, sans toucher les fichiers bénévoles).
- **Backend SQL C12** : ne pas le retoucher. Si `SUIVI-COACH-6` révèle un besoin backend réel (**prouvé à la source**, pas supposé), l'**inscrire en dette** pour le couloir `Production · Suivi backend` (pattern strict C12-k : ajout pur, C12-d jamais modifié) — ne pas le concevoir/coder dans cette conv si ça sort du périmètre écran.
- **`SUIVI-COACH-5`** (compo réduite coach, `C12-l` livré backend ; activation UI = wrapper `supabase-client.js` v1.16 + picker `mode-video.js`) concerne **Objet B**, pas Objet C. Ne pas la traiter ici.
- **`SUIVI-COACH-3-equipe`** : non bloquante, statuée (rôle = staff par construction). Ne pas ouvrir de chantier.

---

## 6. Points de vigilance

- **`SUIVI-COACH-6` d'abord.** Vérifier les colonnes C12-d/C12-k à la source **avant** la spec fine de C-1. C'est la seule inconnue ; tout le reste est figé.
- **C2-Q1 fichier distinct, pas un mode.** Re-piloter `suivi.html` par le rôle du jeton = anti-pattern S-5.1.a explicitement rejeté en conception **et** touche le module bénévole intangible. Fichier neuf, dédié, sans code d'écriture.
- **C-2 voie jeton ≠ C-1 voie coach.** C-2 lit C12-d (anon+jeton spectateur). C-1 lit C12-k (coach authentifié). Deux voies distinctes, ne pas les confondre.
- **Accroche = addition pure prouvée.** `evenements-browser.js` : viser un diff minimal (header de version + bloc ajouté), `node --check` OK, zéro retouche logique d'A. Le précédent Objet B (v1.9→v1.10) est la référence exacte.
- **C12-gate** (seuil d'état `evenements` « jouée ») reste une **dette Audits non tranchée**. Si C-1/C-2 ont besoin d'un seuil d'apparition, **s'aligner sur la posture conservatrice existante** (comme A-Q2 / accroche Objet B) et **tracer**, ne pas inventer un seuil.
- **C-1 jamais consolidé.** Pas de RPC « temps de jeu », pas de champ persisté, pas de photo. Recalcul volatil à chaque affichage = la traduction technique de « jamais autorité ». Ne pas « optimiser » en persistant.
- **Cycle** : à la clôture, Objet C livré → cycle `SUIVI-COACH-1` **complet de bout en bout**. MAJ `STATE.md` (revérifier `modifiedTime` avant) + `CARTE` + message de passation de sortie. 1 fichier = 1 commit.

---

## 7. Décision attendue de Manu en ouverture de la conv Production

1. Confirmer le **protocole de lecture 0→6 tenu** (sources à la source, `modifiedTime` STATE/CARTE vérifié, divergences signalées/réconciliées).
2. **Première action : vérifier `SUIVI-COACH-6`** (colonnes C12-d/C12-k à la source) → trancher : champs présents (aucune dette) ou dette backend conditionnelle tracée.
3. Puis **ordre de production** (proposition à valider) : C-2 d'abord (le plus contraint, backend entièrement prêt, destination du lien A) puis C-1 puis l'accroche `evenements-browser.js` ; ou l'ordre que Manu préfère.
4. Production pas-à-pas, validations Manu, 1 fichier = 1 commit.

**À la clôture de la conv :** fichiers Objet C livrés (C-2 fichier distinct + cerveau écran ; C-1 panneau ; accroche `evenements-browser.js` addition pure) + MAJ `STATE.md` + MAJ `CARTE` + message de passation. Le cycle `SUIVI-COACH-1` sera alors **livré de bout en bout (A + B + C)**.

---

*Fin de la passation · cycle `SUIVI-COACH-1` Objet C · conv source : `Conception` (Objet C conçu/validé 17/05 soir) · conv cible : `Production`*
*6 décisions figées (C2-Q1/Q2/Q3 + C1-Q1/Q2/Q3). 1 réserve réduite ouverte : `SUIVI-COACH-6` (colonnes C12-d/C12-k, à vérifier à la source AVANT spec fine C-1). Intangibles : suivi.html / Objet A logique / Objet B / backend C12 non modifiés. Dernier objet du cycle.*
