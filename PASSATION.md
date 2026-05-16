# MOM Hub · PASSATION.md

**Kit de démarrage générique — à lire à toute reprise de travaux**

*Établi le 16 mai 2026 depuis la conv `Audits`. Document stable, édité à la main. Ne porte pas l'état du code (ça, c'est `STATE.md`) ni l'index des conversations (ça, c'est la Carte). Il dit **comment reprendre proprement**. Dernière mise à jour : 16/05/2026 — §6 réécrite (Suivi priorisé + backend C12 produit).*

---

## 0. Ordre de lecture obligatoire à toute reprise

Quelle que soit la conv reprise (`Production`, `Audits`, `Conception`, ou un fil en pause), lire **dans cet ordre** avant d'agir :

1. **`CARTE-CONVERSATIONS-MOM-Hub.md`** — index maître. Dit quelle conv fait quoi, où chacune en est, laquelle ouvrir pour quoi. Se place au-dessus de tout.
2. **CE `PASSATION.md`** — la discipline de travail, les invariants, où trouver quoi.
3. **`STATE.md`** — la vérité opérationnelle du code (phases, modules en ligne, dettes, schéma base). **La dernière version committée fait foi** ; toute copie antérieure est périmée.
4. **Le message de passation thématique** éventuellement collé en tête de la conv reprise (fil de transfert spécifique à la tâche en cours).

Ne jamais agir sans avoir lu 1→4. Une reprise « à l'aveugle » reproduit les erreurs déjà corrigées.

> ⚠️ En cas de divergence entre un message de passation thématique (point 4) et les méta-documents réconciliés (points 1-3), **signaler l'écart à Manu sans rien écraser en silence** et réconcilier explicitement (§4 bis règle 9). Cas survenu et géré le 16/05 (Suivi : le message thématique disait « produire C12 » ; les méta-docs disaient « non priorisé » → Manu a tranché la priorisation, qui prime).

---

## 1. Les 3 fronts vivants (noms courts)

| Conv | Rôle | Ne fait PAS |
|---|---|---|
| **`Production`** | Code, SQL, déploiement du Hub. Front technique actif. | Pas de doctrine ni d'audit (lit les audits, ne les écrit pas). |
| **`Audits`** | Modélisation des entités métier, audits de modules, doctrine. Produit des docs Drive. | Pas de code de production. |
| **`Conception`** | Structure du portail, UX, **doctrine d'interconnexion des modules**. Consomme les audits. | Pas d'implémentation. |

Règle de coexistence non négociable : **une conv = un sujet**. Pas de double-tâche. Les méta-documents (Carte, ce Passation, STATE) sont la seule exception légitime de coordination transverse.

Tout le reste des conversations est **clos**, **en pause** (réactivable pour son sujet exact uniquement), ou **one-shot terminé** — voir la Carte pour le détail.

---

## 2. Sources de vérité — hiérarchie

```
CARTE-CONVERSATIONS → navigation : quelle conv, où elle en est
PASSATION.md (ici)  → discipline : comment reprendre
STATE.md            → vérité du CODE : ce qui est en ligne / les dettes
Message passation   → transfert d'une tâche précise d'une conv à l'autre
```

Principe directeur fort, appris à la dure : **le code déployé fait foi sur l'avancée réelle**, pas un STATE figé. Un `STATE.md` peut avoir un train de retard si une livraison a eu lieu après sa rédaction. En cas de doute sur « qu'est-ce qui est réellement en ligne ? », la référence est l'inspection des fichiers HTML déployés, recoupée avec le Drive.

Corollaire : à chaque livraison significative, **le STATE doit être régénéré et committé**, et la Carte mise à jour.

---

## 3. Invariants doctrinaux (rappel — ne jamais transgresser)

- **P1 Simplicité d'usage** : si l'outil est complexe, il ne sera pas utilisé. Filtre universel. Pas de schéma sur-conçu, pas d'architecture cathédrale, fichiers éditables à la main quand c'est possible.
- **Le Core porte le QUOI, le module porte le COMMENT.** Les modules ne se parlent jamais directement : tout passe par le Core (Supabase).
- **P3 Itération sur le terrain** : la V1 est une hypothèse, le terrain juge.
- **P4 Le Hub avertit, ne bloque pas.**
- **P5 Référencement par UUID.**
- **P6 Confidentialité par construction** : pas de SELECT direct client sur `personnes` ; payloads réduits via RPC ; RGPD différencié.
- **P7 Asymétrie selon l'enjeu** : effort de saisie proportionné (match de championnat ≠ entraînement hebdo).
- **PI-1** modules jamais en couplage direct · **PI-6** la blessure = seule écriture remontante · **PI-7** compo `validee` = pré-condition dure pour démarrer un suivi.
- **Budget 0 €.** **FFR = OVAL-E** (avec un **A**), à écrire ainsi partout.
- **Référent M14 = Emmanuel Jung** (également Coach principal M14). Ne pas lui inventer d'autre rôle.

---

## 4. Méthode de travail (la discipline qui fait que ça tient)

1. **Pas-à-pas avec validation** entre micro-étapes. Pas de livrable massif sans accord intermédiaire (sauf demande explicite de Manu de produire en bloc — cas Suivi C12 le 16/05).
2. **Vérifier l'état réel avant d'émettre une hypothèse** : lire les fichiers / le code / le Drive concernés, ne pas présumer. Investiguer soi-même plutôt que poser une question évitable.
3. **Anti-invention** : ne jamais citer un fichier, une version, une dette sans l'avoir vérifié. En cas d'incertitude, baliser explicitement « à confirmer » plutôt qu'inventer. L'honnêteté épistémique prime sur la performance apparente.
4. **Livrables complets, jamais des patchs à appliquer à la main.** Fournir le fichier entier prêt à déposer.
5. **Fin de session = message de passation complet** (jamais des extraits) à coller en tête de la conv suivante. Puis mettre à jour STATE (si le code a bougé) et la Carte (si une lignée a bougé).
6. **Méthode d'audit = patch ciblé** quand on révise un audit existant — éprouvée sur Compositions v3, Suivi Match v2/v2.1, modélisation Chronologie v1.1.

### 4 bis. Règles STATE.md — non négociables (apprises à la dure le 16/05)

7. **Toujours demander/charger la version la plus récente du STATE AVANT de le mettre à jour.** Jamais une copie locale « parce qu'on l'a sous la main ». Plusieurs convs éditent le STATE → une copie locale est presque toujours périmée.
8. **À chaque livraison d'un STATE mis à jour, fournir systématiquement le titre + le corps du commit**, sans que Manu ait à le demander.
9. **Discipline anti-divergence** : toute MAJ repart de la dernière fusion de référence (jamais d'une branche parallèle). Si deux versions ont divergé, on les réconcilie explicitement (en signalant les écarts à Manu, sans rien écraser en silence) avant de continuer. Le STATE est unique, traçé par des marqueurs `🔧 MAJ <conv> <date>`.

Nommage : le fichier canonique du dépôt est **`STATE.md`** tout court.

---

## 5. Où trouver quoi (Drive `00 - Documentation`)

- **Doctrine** : `Doctrine-MOM-Hub-v2.md` (7 principes), `Doctrine-Import-OVAL-E` (dernière version), `Doctrine-Interconnexion-Modules-v1.2.md` (récit vécu, 7 principes PI, DI-6 levée, DI-CHR-1).
- **Audits de modules** : `Audit-Module-*` (Compositions v3, Évènements v1, Joueurs v1, Suivi-Match **v2.1**, Rapport, Statistiques, Bilans), `Audit-Ateliers-v1`, `Audit-Referentiels-v1`, `Audit-Personnes` (dernière version).
- **Modélisation** : `Modelisation-Evenements-v1.1`, `Modelisation-Chronologie-Suivi-v1.md` (**v1.1**, patch DS-1), `Schema-atelier-json` (dernière version), schémas Core.
- **Conception** : `Conception-Portail-Architecture-V2` (+ patch v1.1), `Conception-Portail-UI-Suivi.md`, `Conception-Portail-UI-Evenements`, `Conception-Portail-UI-Joueurs`, `Conception-Portail-Phase-3/4`.
- **Production Suivi (C12)** : 6 fichiers SQL `C12-a→f` + `RECETTE-deploiement-Suivi.md` (produits 16/05, à exécuter Supabase + ranger dans `sql/` + commiter).
- **Coordination** : `CARTE-CONVERSATIONS-MOM-Hub.md`, ce `PASSATION.md`, `STATE.md` (dernier committé = la fusion de référence).
- **Passations thématiques** : `PASSATION-Ateliers-vers-Production-v1`, `PASSATION-Modules-Ateliers-v3`, `PASSATION-Audits-vers-Conception-Suivi`, `PASSATION-Audits-vers-Production-C12`, `SYNC-Conception-STATE-fusionne`.

⚠️ Le connecteur Drive peut être en échec d'écriture par moments (lecture OK). Dans ce cas, les livrables sont fournis en téléchargement et déposés manuellement — ça ne change rien à la discipline.

---

## 6. État de reprise au 16/05/2026 (fin de journée — pointeur, le détail est dans STATE.md)

> Section volatile, vieillit vite. La référence reste **`STATE.md` committé (la fusion) + la Carte**.

- **Code en ligne** : Bibliothèque, Préparation de séance, Compos matures ; **Évènements (v1.7) et Joueurs (v1.3) complétés Phase 2** le 16/05. `supabase-client.js` **v1.12**. Suivi de rencontre + Statistiques = `todo` côté **UI** (pas de code applicatif).
- **Front `Audits`** : a produit l'`Audit-Module-Suivi-Match-v2.1`, la `Modelisation-Chronologie-Suivi-v1.1`, tranché **DS-1**, périmètre Suivi **Option C**, DI-6/C11-a levée. Reste, temporisé : **DI-1** → **DI-7**, **DI-CHR-1** (avant mise en service Suivi). À confirmer : gate de saisie Suivi `resultat` vs `archive` (le schéma `evenements` réel n'a pas d'état `termine`) — point remonté par la production C12.
- **Front `Conception`** : a produit `Doctrine-Interconnexion-Modules-v1.2`, le patch `Architecture-V2 v1.1`, et la **conception UX complète du Suivi** (`Conception-Portail-UI-Suivi.md`, S-1→S-6). Dette à tracer : **DS-2** (alerte blessure côté Compositions).
- **Front `Production`** : Phase 5.14 + Phase 2 Évènements/Joueurs livrées. Dettes V1.1 : P2-E.4 (encadrants CRUD), photos Joueurs (C10-a→e), split filtre Partenaire. **🔧 Suivi de rencontre PRIORISÉ par Manu (16/05) et backend C12-a→f PRODUIT** : 6 SQL livrés (ordre d'exécution a→b→f→c→d→e) + recette. Restent à faire : exécuter les SQL en base Supabase + ranger dans `sql/` + commiter (à la main de Manu) ; **câbler la fonction unique `chronologie_nom_court_personne`** sur la source nom RGPD-safe `personnes` ; confirmer le gate de saisie (Audits) ; puis **UI Suivi** (implémenter S-1→S-6 sur le backend C12). `chronologie_suivi` et `lien_suivi` = tables fermées (RLS + accès RPC only).
- **Gouvernance** : épisode de divergence STATE (deux convs en parallèle) réconcilié le 16/05 → règles §4 bis. Second cas le 16/05 (message thématique Suivi vs méta-docs « non priorisé ») : signalé à Manu, tranché par sa priorisation explicite, STATE/PASSATION repris depuis la fusion de référence.
- **Angle mort** : 1 conv non classée du 15/05 (voir Carte §3 lignée F).

---

*Fin du kit de passation · à déposer dans Drive `00 - Documentation/` à côté de la Carte et du STATE · relire/mettre à jour quand la discipline ou les fronts changent.*
