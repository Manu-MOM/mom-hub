# Cadrage des dettes backend `SUIVI-UI-1 / 5 / 6 + SUIVI-COACH-2` — volet COACH du Suivi

*Document de cadrage · cycle `SUIVI-COACH-1` · 17 mai 2026 · **réconcilié au STATE 17/05 11:17 / CARTE 11:24** (fold SUIVI-COACH-2 dans le couloir).*
*Carte d'instruction backend. PAS une conception SQL détaillée — il cadre le handoff vers le couloir backend, il ne code rien.*
*Sœur de `Cadrage-SUIVI-COACH-1.md` (carte de cycle) et `Conception-SUIVI-COACH-1-ObjetA.md` (Objet A, livré).*

---

## 0 · Protocole de démarrage (à tenir en ouvrant la conv backend)

Ce document est destiné à être déposé en `00 - Documentation/` **et** collé en tête de la conversation Production (couloir backend) qui instruira ces dettes. Avant toute production dans cette conv :

1. Lire `CARTE-CONVERSATIONS-MOM-Hub.md` — l'index.
2. Lire `STATE.md` — **la vérité de référence, fusion la plus récente** (repartir de lui, jamais d'une copie). Registre des dettes : section « Dettes ouvertes ». Les 4 dettes de ce couloir y figurent : `SUIVI-UI-1`, `SUIVI-UI-5`, `SUIVI-UI-6`, `SUIVI-COACH-2`.
3. Lire `Cadrage-SUIVI-COACH-1.md` — la carte du cycle (les 3 objets A/B/C, le séquencement).
4. Lire **ce document**.
5. Lire le SQL **C12-f** (`sql/C12-f-lien-ephemere.sql`) — c'est la source de vérité des signatures réelles ; ne rien inventer par-dessus.

Confirmer la lecture avant de proposer quoi que ce soit. Discipline projet : on ne devine pas une signature, on la vérifie à la source ; 1 fichier = 1 commit ; livraison de fichiers complets, jamais des patches.

---

## 1 · Pourquoi ces dettes, pourquoi maintenant

Objet A (point d'entrée coach « générer le lien de suivi ») est **livré** : `supabase-client.js` v1.13 (+wrapper `genererLienEphemere`) et `evenements-browser.js` v1.8 (section « Suivi de la rencontre » sur la fiche événement). Le Suivi est désormais réellement utilisable sur le terrain — la porte d'entrée existe, le lien n'a plus besoin d'être fabriqué en SQL à la main.

Objet A **ne dépendait d'aucune de ces dettes** (la RPC `generer_lien_ephemere` était déjà déployée). En revanche, **Objets B (Mode Vidéo) et C (temps de jeu + écran spectateur) en dépendent**, et **SUIVI-COACH-2 améliore l'état 3 d'Objet A** (lien persistant entre visites). Le `Cadrage-SUIVI-COACH-1.md` et le STATE l'ont posé noir sur blanc :

| Dette | Bloque / améliore | Couloir |
|---|---|---|
| **SUIVI-UI-1** | Améliore A (confort), nécessaire à B (en-tête rencontre fiable) | Production (backend) |
| **SUIVI-UI-5** | **Objet B** (consolidation score côté coach) | Production (backend) |
| **SUIVI-UI-6** | **Objet C-2** (écran spectateur distinct) | Production (backend) |
| **SUIVI-COACH-2** | Améliore A (état 3 « lien déjà généré » persistant entre visites) | Production (backend) |

Le séquencement validé est : *A maintenant (fait) ; dettes backend en parallèle (ce document) ; B puis C quand leurs pré-requis tombent*. Instruire ces dettes est donc le chemin critique pour débloquer la suite du cycle. Aucune n'est bloquante pour ce qui est déjà en ligne ; ce sont des **ajouts**, pas des correctifs.

---

## 2 · Les dettes — état réel et piste minimale

Principe directeur (doctrine MOM Hub, simplicité avant tout) : pour chacune, la **piste minimale** est esquissée à partir des patterns **déjà présents dans C12-f**. Le détail (noms exacts, champs, grants) revient à la conv backend. Ne pas sur-concevoir : pas de nouveau schéma riche là où une RPC `SECURITY DEFINER` jeton-validée suffit.

### Réalité commune (vérifiée dans C12-f)

- La table `lien_suivi` est **fermée** : RLS activé, `REVOKE ALL … FROM authenticated/anon`. Tout accès passe par des RPC `SECURITY DEFINER`.
- Le helper interne `valider_lien_suivi(p_token, p_role_requis)` existe déjà, renvoie l'`UUID` de la rencontre, lève une exception si le jeton est invalide/révoqué/expiré ou si le rôle ne correspond pas. C'est **la brique à réutiliser** pour toute nouvelle RPC jeton-bornée (`p_role_requis = NULL` pour de la lecture, `'saisie'` pour une écriture).
- Le pattern « payload réduit RGPD » est déjà illustré par `get_compo_reduite_rencontre(p_token)` (champs minimaux, jamais de coordonnées/médical, nom court via `chronologie_nom_court_personne`).
- Point connexe (hors de ces dettes, mais à garder en tête) : `chronologie_nom_court_personne` est **le seul point non câblé de tout C12** (dette `C12-nom`). Il est indépendant de SUIVI-UI-1/5/6/COACH-2 mais toute RPC renvoyant un nom de personne en hérite ; ne pas le re-instruire ici, juste ne pas l'oublier.

### SUIVI-UI-1 — RPC en-tête rencontre

**Ce que dit le STATE.** Aucune des 7 RPC C12 ne renvoie l'en-tête rencontre (libellé / catégorie / date / lieu / adversaire). Côté bénévole, le tampon « Avant » n'a pas de confirmation rencontre permanente (Option UI-stricte : vérification d'identité dégradée sur l'aperçu compo AV-2). Non bloquant (dégradation assumée) ; améliore le tampon une fois faite, et **fiabilise l'en-tête de l'écran Mode Vidéo (Objet B)**.

**Piste minimale.** Une RPC `SECURITY DEFINER` jeton-bornée, du type `get_entete_rencontre(p_token)`, qui : (1) valide le jeton via `valider_lien_suivi(p_token, NULL)` (lecture, les 2 rôles OK), (2) renvoie **uniquement** des champs en-tête RGPD-safe lus dans `evenements` (libellé, catégorie/`type_competition`, `date_debut`, lieu/site, `adversaire_nom`). Strictement aucune donnée personnelle (P6). `GRANT EXECUTE` à `anon` + `authenticated` (même posture que `get_compo_reduite_rencontre`). C'est le copier-coller du pattern C12-f §5 ; pas de nouvelle table, pas de schéma.

### SUIVI-UI-5 — consolidation du score côté coach

**Ce que dit le STATE.** `consolider_score_rencontre(p_evenement_uuid, p_token)` exige l'`evenementUuid`, que le bénévole sans login n'a pas (le jeton encapsule la rencontre côté serveur ; aucune RPC ne renvoie l'UUID). À la clôture, le score affiché est le **calcul client** (juste, invariant I1) ; la **photo** dans `evenements` n'est pas écrite. **Bloque Objet B.** Deux options déjà nommées :

- **(a)** consolidation déclenchée par le **coach authentifié** (il a l'UUID via l'accès Hub) à l'ouverture du Mode Vidéo / récap ;
- **(b)** un **wrapper backend jeton-seul** `consolider_score_rencontre(p_token)` qui résout l'événement depuis le jeton via `valider_lien_suivi(p_token, 'saisie')`.

**Recommandation (à trancher en conv backend, non décrétée ici).** L'option **(b)** est la plus simple et la plus auto-contenue : elle s'aligne exactement sur le pattern C12-f (chaque RPC prend `p_token` et résout la rencontre via le helper), n'introduit aucun couplage UI→UUID, et reste valable que la consolidation soit déclenchée par le bénévole en fin de match ou par le coach plus tard. C'est une **surcharge** de la RPC existante (même nom, signature jeton-seule), pas une nouvelle entité. L'option (a) reste possible en complément côté Objet B mais ne devrait pas être le seul chemin (elle laisse la photo non écrite tant que le coach n'ouvre pas le récap).

### SUIVI-UI-6 — rôle du jeton lisible côté client

**Ce que dit le STATE.** Le jeton est **opaque** côté client (`getToken()` lit `?t=` ; le rôle `saisie`/`spectateur` est tranché serveur par `valider_lien_suivi`). Aucune RPC n'expose le rôle. Conséquence : l'**écran spectateur distinct** (S-5.1, Objet C-2) n'est pas réalisable proprement (deviner par échec d'écriture = anti-pattern rejeté ; drapeau d'URL = mode d'UI fragile interdit par la spec). **La sécurité spectateur est déjà portée par le backend** (jeton spectateur sans droit d'écriture, RLS C12-f) — seul l'écran UI distinct manque. **Bloque Objet C-2.**

**Piste minimale.** La plus petite addition possible. Deux formes, à arbitrer en conv backend :

- une RPC dédiée minuscule `get_role_lien(p_token)` qui valide le jeton et renvoie son `role` (et rien d'autre) ;
- ou l'ajout d'un **champ `role`** au retour d'une RPC de lecture jeton-bornée déjà existante (p. ex. celle de SUIVI-UI-1 si elle est faite d'abord), pour éviter un aller-retour réseau supplémentaire.

Doctrine de simplicité : si SUIVI-UI-1 est traitée en premier, **piggy-back du `role` sur son retour** est l'option la plus économe (zéro RPC supplémentaire). Sinon, la RPC dédiée minuscule fait l'affaire. Pas de nouveau schéma dans les deux cas.

### SUIVI-COACH-2 — relecture du lien `saisie` actif d'une rencontre

**Ce que dit le STATE.** Apparue pendant Objet A (signalée, non contournée) : `lien_suivi` est fermée et `generer_lien_ephemere` ne fait que *créer* → aucune RPC ne permet de relire un lien actif existant. Conséquence : l'**état 3 d'Objet A** (« lien déjà généré ») est **borné à la session** (lien en RAM, jamais en `localStorage` ; après rechargement, retour à l'état 2 ; re-générer reste sûr — le relais backend révoque l'ancien). **Pas une régression** (option assumée, cohérente avec la sémantique relais) ; dette réelle uniquement si l'on veut un état 3 persistant entre visites. **Enregistrée au STATE le 17/05 sur décision Manu**, routée explicitement vers ce couloir backend (rejoint SUIVI-UI-1/5/6). **Non bloquant** (état 3 borné session = comportement assumé ; amélioration de confort).

**Piste minimale.** Une RPC `SECURITY DEFINER` **jeton-OU-event-bornée** renvoyant le **dernier lien `saisie` non révoqué non expiré** d'une rencontre, p. ex. `get_lien_saisie_actif(p_token)` (variante coach : bornée par `p_evenement_uuid` côté authentifié — le coach a l'UUID via l'accès Hub). Réutilise `valider_lien_suivi` pour la variante jeton. Aucune écriture, aucun nouveau schéma : c'est une lecture du dernier `lien_suivi` `saisie` filtrée sur révocation/expiration, dans le même esprit que les autres RPC C12-f. **Aucune retouche logique d'Objet A** : la section est déjà conçue pour réafficher un lien si on lui en fournit un — il suffira de l'alimenter depuis cette RPC pour rendre l'état 3 persistant entre visites.

---

## 3 · Genèse de SUIVI-COACH-2 (traçabilité — pour mémoire, décision close)

Pendant l'implémentation d'Objet A, ce manque backend a été **signalé, pas contourné en douce** : la table `lien_suivi` étant fermée et `generer_lien_ephemere` ne faisant que *créer*, aucune RPC ne permettait de relire un lien actif existant. Il a été **remonté pour décision**, sans auto-création d'entrée au STATE (discipline : on ne s'invente pas une dette de référence).

> **Décision prise (Manu, 17/05) :** la dette est **enregistrée au STATE sous `SUIVI-COACH-2`** et **rattachée à ce couloir backend**. Elle est donc désormais une dette instruite ici (cf. §2), au même titre que SUIVI-UI-1/5/6 — elle n'est plus « à arbitrer ». Elle améliorera l'état 3 d'Objet A sans aucune retouche d'Objet A côté logique.

Aucune décision n'est en attente sur ce point : ce paragraphe est conservé pour la seule traçabilité (comment la dette est née, et que la discipline « signaler, ne pas contourner » a été tenue).

---

## 4 · Ce que la conv backend NE fait PAS

- **Pas de retouche au module bénévole** (`suivi.html` / `suivi-app.js` / `suivi-client.js`) — clôturé, invariant « sans login » intangible.
- **Pas de retouche à Objet A** (`evenements-browser.js` v1.8 / le wrapper `genererLienEphemere`) — livré et conforme. Ces dettes sont des **ajouts backend**, pas des correctifs d'Objet A.
- **Pas de conception UX d'Objet B ni C-2** — c'est la suite du cycle, après que ces dettes tombent. Anticiper leur UI ici serait anticiper le pont (interdit doctrine).
- **Pas de re-câblage de `chronologie_nom_court_personne`** (dette `C12-nom` distincte) — la mentionner si une nouvelle RPC renvoie un nom, ne pas l'instruire ici.
- **Pas le deep-link compo** (`SUIVI-COACH-deeplink`, déjà enregistré au STATE) — cette dette appartient au couloir Conception / Production Évènements (convention d'URL paramétrée de `compositions.html`), pas à ce couloir backend.

---

## 5 · Séquencement recommandé

```
EN PARALLÈLE (cette conv backend)
 ├─ SUIVI-UI-1     RPC en-tête rencontre (token-bornée, RGPD-safe)
 ├─ SUIVI-COACH-2  RPC relecture lien saisie actif (token/event-bornée)
 ├─ SUIVI-UI-5     consolidation score jeton-seul  → débloque Objet B
 └─ SUIVI-UI-6     rôle du jeton lisible            → débloque Objet C-2

Ordre interne conseillé : SUIVI-UI-1 d'abord (sa RPC peut porter le
champ rôle → SUIVI-UI-6 gratuit en piggy-back) ; SUIVI-COACH-2 se
traite naturellement avec UI-1 (toutes deux lectures token-bornées
sur lien_suivi / evenements, même pattern C12-f) ; puis SUIVI-UI-5 ;
puis SUIVI-UI-6 (ou absorbé par UI-1).

ENSUITE (conv Conception → conv Production)
 ├─ Objet B (Mode Vidéo)        quand SUIVI-UI-5 (+idéalt -1) faites
 └─ Objet C (temps de jeu /     quand SUIVI-UI-6 faite
     écran spectateur)
```

Ce que ce séquencement refuse explicitement : tout sérialiser derrière les dettes aurait retardé Objet A (qui n'en dépendait pas — c'est pourquoi A est déjà livré) ; tout paralléliser ferait concevoir B/C sans pré-requis (anticipation du pont, interdit).

---

## 6 · Note de réconciliation STATE (état au 17/05)

Ces points sont **déjà répercutés** dans la version de référence de `STATE.md` (fusion 17/05, modifiedTime 11:17 ; CARTE 11:24). Listés ici pour mémoire et cohérence du dossier :

- `evenements-browser.js` v1.7 → **v1.8** (Objet A) — acté au STATE.
- `supabase-client.js` v1.12 → **v1.13** (wrapper `genererLienEphemere`) — acté au STATE.
- Dette **`SUIVI-COACH-1`** : **Objet A livré**. Objets B et C restent ouverts ; dettes backend SUIVI-UI-1/5/6 → en cours d'instruction (ce couloir).
- Dette **`SUIVI-COACH-2`** (RPC relecture lien `saisie` actif) : **enregistrée** au STATE le 17/05 sur décision Manu, **rattachée à ce couloir** (instruite ici, cf. §2/§5) — n'est plus « à arbitrer ».
- Dette **`SUIVI-COACH-deeplink`** (deep-link compo depuis l'état 1 d'Objet A) : **enregistrée** au STATE, routée Conception / Production Évènements (hors de ce couloir, cf. §4).

Plus aucun point « à arbitrer » sur le périmètre de ce cadrage : les 4 dettes du couloir sont identifiées, enregistrées et séquencées. La seule chose qui reste hors de portée de ce document est le détail SQL exact (signatures/champs/grants), délégué à la conv backend après lecture de C12-f à la source.

---

*Cadrage dettes backend `SUIVI-COACH-1` · MOM Hub · 17 mai 2026 (réconcilié STATE/CARTE 17/05).*
*4 dettes cadrées (UI-1 en-tête / UI-5 consolidation score / UI-6 rôle jeton / COACH-2 relecture lien actif), pistes minimales esquissées sur les patterns C12-f existants, détail délégué à la conv backend. Objet A livré ; B et C débloqués par ce couloir ; état 3 d'Objet A amélioré par COACH-2.*
