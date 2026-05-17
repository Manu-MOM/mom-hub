# Cadrage backend — `SUIVI-COACH-3` · chemin coach-authentifié de C12-c

*Document de consigne · cycle `SUIVI-COACH-1` · 17 mai 2026.*
*À déposer dans Drive `00 - Documentation/` **et** coller tel quel, en entier, en 1er message de la conv `Production · Suivi backend` (couloir backend C12) qui instruira cette dette.*
*Sœur de `Cadrage-SUIVI-COACH-1-Dettes-Backend.md`. Émis par la conv `Production` Objet B après vérification de C12-c à la source.*

---

## 0. Protocole de démarrage (à tenir en ouvrant la conv backend)

Avant toute production dans la conv backend, lire **dans cet ordre, à la source** :

1. `CARTE-CONVERSATIONS-MOM-Hub.md` (Drive `00 - Documentation/`) — l'index.
2. `STATE.md` (Drive `00 - Documentation/`) — vérité de référence. **Vérifier le `modifiedTime` Drive, repartir de la version vivante, jamais d'une copie.**
3. Ce document.
4. Le SQL **`sql/C12-c-rpc-ecriture.sql`** à la source — c'est la fonction canonique sur laquelle on s'appuie ; ne rien inventer par-dessus.
5. Le SQL **`sql/C12-i-consolider-score-jeton.sql`** à la source — c'est le **pattern de référence** (chemin ajouté par surcharge, fonction canonique non modifiée).

Confirmer la lecture avant de proposer quoi que ce soit.

---

## 1. Le constat (vérifié à la source, pas présumé)

`C12-c` (`sql/C12-c-rpc-ecriture.sql`) expose trois fonctions d'écriture : `inserer_observable`, `annuler_observable`, `corriger_observable`. Les trois résolvent la rencontre **exactement de deux manières** :

- **chemin jeton** : `p_token` fourni → `valider_lien_suivi(p_token, 'saisie')` (jeton éphémère bénévole, rôle `saisie`) ;
- **chemin bypass smoke-test** : `session_user IN ('postgres','supabase_admin')` **ET** `p_evenement_uuid` fourni — réservé au rôle base superutilisateur, pour les tests SQL Studio.

Tout autre appel tombe sur `RAISE EXCEPTION 'Jeton de saisie requis.'`.

**Verdict : il n'existe AUCUN chemin coach-authentifié dans C12-c.** Un coach connecté au Hub via `supabase-client.js` s'exécute sous le rôle `authenticated` (PostgREST), **pas** `postgres`/`supabase_admin`. Le `GRANT EXECUTE … TO anon, authenticated` ne suffit pas : la logique interne, elle, n'a pas de branche `auth.uid()`. Un coach appelant sans jeton `saisie` (ce qui est précisément la situation d'Objet B — coach authentifié, possède l'`evenement_uuid` via le Hub, ne détient pas de jeton bénévole) reçoit l'exception et ne peut rien écrire.

Constat secondaire utile pour la spec : `inserer_observable` accepte déjà `p_timecode_video` / `p_source_saisie` / `p_saisi_par_role`, mais reste inatteignable par le coach faute de chemin. `corriger_observable` ne met à jour que `joueur_uuid` + `corrigee_le` — il **ne touche pas** `timecode_video`.

→ La réserve conditionnelle `SUIVI-COACH-3` du STATE est donc **confirmée réelle** (cas « absent » du protocole de passation Objet B §2). Elle doit être instruite **avant** la spec fine de l'écran Mode Vidéo.

---

## 2. La dette à livrer (pattern C12-i — par ajout, sans toucher C12-c)

Ajouter un **chemin d'écriture coach-authentifié** pour les trois gestes (`inserer` / `corriger` / `annuler`), **par ajout pur**, sur le modèle exact de `C12-i` (qui a ajouté la surcharge jeton-seul de `consolider_score_rencontre` en déléguant à la fonction canonique non modifiée).

Exigences fermes :

- **Ne PAS modifier les fonctions canoniques de C12-c.** Ajout/surcharge uniquement (nouvelle signature ou nouveau chemin de résolution interne explicitement coach), comme C12-i l'a fait pour le score.
- Le chemin coach doit porter ce dont Objet B a besoin (déjà tranché par `Conception-SUIVI-COACH-1-ObjetB.md`, à ne pas rouvrir) : `source_saisie='video'`, `saisi_par_role='coach'`, et **`timecode_video` renseignable** à l'insertion **et** sur la correction d'une ligne (la spec B-Q2/B-Q4 prévoit un timecode factuel sur les lignes ajoutées **et** corrigées — or `corriger_observable` canonique ne gère pas `timecode_video` aujourd'hui ; le chemin coach doit combler ce manque **par ajout**, sans réécrire le canonique).
- Garde-fous DS-1 conservés à l'identique (jamais de joueur sur une ligne `adverse` ; `notre`+NULL autorisé). Jamais de DELETE. Aucune écriture dans `presences`.
- Doctrine de simplicité (P1) : pas de nouveau schéma, pas de table. Une surcharge `SECURITY DEFINER` qui réutilise les briques existantes, dans l'esprit de tout C12.

---

## 3. Le seul point à trancher À LA SOURCE (ne pas inventer)

**Comment un coach authentifié est-il rattaché à une rencontre donnée, côté backend ?**

C'est le modèle d'autorisation du chemin coach. Il **ne doit pas être inventé** : il se vérifie à la source, sur le pattern d'auth Hub déjà éprouvé sur le projet (session Supabase / `auth.uid()` et le lien rencontre↔équipe↔coach déjà utilisé ailleurs dans le code, exactement comme `C12-h` a vérifié sa posture à la source plutôt que de la présumer). La conv backend tranche ce point en lisant le code réel, puis l'implémente. Tout le reste de la dette (les 3 gestes, le timecode, les garde-fous) est déjà cadré ci-dessus et n'a pas à être rediscuté.

---

## 4. Ce que la conv backend NE fait PAS

- Pas de modification des fonctions canoniques de `C12-c` (ajout pur, pattern C12-i).
- Pas de retouche au module bénévole (`suivi.html` / `suivi-app.js` / `suivi-client.js`) — clôturé, invariant « sans login » intangible.
- Pas de retouche à Objet A (`evenements-browser.js` / `supabase-client.js`).
- Pas de conception ni de code de l'écran Mode Vidéo — c'est la conv `Production` Objet B, **après** que cette dette tombe.

---

## 5. Séquencement

```
1. Conv backend (couloir C12) : livrer SUIVI-COACH-3
   (chemin coach-authentifié, par ajout, pattern C12-i),
   exécuté en base + rangé sql/ + committé. 1 fichier = 1 commit.
   STATE/CARTE mis à jour à la clôture du couloir.
2. PUIS conv Production Objet B reprend à son §3 :
   spec fine + écran Mode Vidéo (fichier distinct,
   via supabase-client.js coach), puis accroche
   evenements-browser.js (modèle SUIVI-COACH-2).
```

L'écran Objet B est **bloqué** tant que SUIVI-COACH-3 n'est pas livré. C'est voulu et tracé — pas un retard subi, le chemin prévu pour ce cas.

---

## 6. Discipline projet (rappel, non négociable)

- Fichiers **complets** prêts à uploader, jamais de patches.
- **1 fichier = 1 commit** ; fournir titre + corps de commit à chaque livraison sans qu'on le demande.
- Vérifier la version Drive la plus récente du STATE (`modifiedTime`) avant toute MAJ.
- Ne rien deviner : signature/règle/auth → vérifier à la source, ou tracer en dette. Jamais d'invention silencieuse.
- Simplicité avant tout : pas d'over-engineering, surcharge minimale, solution lean.

*Fin du cadrage · `SUIVI-COACH-3` · vérifié à la source depuis la conv `Production` Objet B · 17/05/2026.*
