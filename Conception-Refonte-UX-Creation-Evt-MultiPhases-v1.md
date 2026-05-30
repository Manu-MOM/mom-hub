# Conception — Refonte UX création évènement multi-phases / multi-équipes

> Document **FAIT FOI** de conception. Sortie de la conv `Conception · Refonte UX création
> évènement multi-phases`. À déposer au Drive `00 - Documentation/`.
> **Conception pure : zéro code, zéro SQL exécuté.** Décisions ancrées au modèle/RPC déployés,
> lus à la source (`raw.githubusercontent.com/Manu-MOM/mom-hub/main`, github.io bloqué par le
> proxy réseau). Le code/modèle déployé fait foi, jamais ce document.
> Sert de base à une future conv `Production` d'implémentation. **Une conv = un sujet.**

---

## 0. En une phrase

La création d'un tournoi multi-phases / multi-équipes (type « Challenge Vié ») doit se faire
**en un seul écran, en un seul geste**, structurée **par équipe** (chaque équipe engagée porte
ses propres phases et matchs), les adversaires saisis comme **emplacements ajustables** —
le tout reposant sur un modèle et une RPC qui **savent déjà tout faire**.

---

## 1. Diagnostic réel — corrigé à la source (acquis de départ révisé)

La passation d'ouverture posait comme hypothèse un « malaise de modèle » et un risque que le
modèle du Hub ne permette pas l'écran visé. **La lecture à la source a inversé ce diagnostic.**

**Sources lues (md5 confirmés identiques au STATE pt 35) :**
- `sql/52-rpc-creer-evenement-complet.sql` — md5 `2778691e9e9429ffb70df05ecad40dc9`
- `js/evenements-browser.js` v1.26 — md5 `2c7f9a502d287072a8f1b8c468c6b21d`
- `evenements.html` v3 — md5 `d8b2aa2eabd62ea86bbfffa7c65b924c`

**Constat n°1 — le modèle et la RPC sont déjà complets.**
La RPC `creer_evenement_complet` (déployée, recettée pt 19) accepte en **une transaction
atomique** un paramètre `p_phases_par_equipe` (JSONB) qu'elle **consomme intégralement** :
elle crée une phase-boîte M6 par phase (avec `equipe_id` F19, libellé, date, ordre) puis ses
matchs M6 (libellé, date, `adversaire_nom`, `format_de_jeu` override, ordre). Elle accepte
aussi `p_equipes_engagees` (tableau JSONB de taille libre, avec `format_de_jeu` override par
équipe) et `p_affectations_n2`. **Le backend sait déjà créer un tournoi complet à phases,
multi-équipes, à formats hétérogènes, en un seul appel.**

**Constat n°2 — la friction est purement UI.**
Dans `evenements-browser.js` v1.26, la section « PHASES & MATCHS » de la modale (`buildPhasesParEquipeList`)
**n'affiche aucun champ de saisie** — seulement un texte de consigne
(*« Au moins 1 phase requise par équipe. Édition fine depuis la fiche après création. »*).
Et `submitModalCreate` envoie une **phase fantôme codée en dur** :
`phases: [{ libelle: 'Phase 1', ordre: 1 }]`, identique pour chaque équipe, jamais saisie par
l'utilisateur. Commentaire du code à l'appui : *« Pour cette livraison L3a : structure minimale
1 phase par équipe (édition fine déportée à la fiche post-création) ».*

**Conséquence.** Le « geste coupé en deux » constaté par Manu (la modale promet « phases
obligatoires » puis renvoie à la fiche « après création ») n'est **pas** un trou de modèle ni
de RPC. C'est une **pièce d'UI jamais construite**, branchée sur un backend déjà prêt.
→ **Le piège n°1 de la passation (« ne pas promettre l'écran SAR×MOM sans vérifier que le
modèle le permet ») est levé par les faits : le modèle le permet déjà, intégralement.**

**Le vrai décalage mental (confirmé par le cas réel Manu).** L'éducateur raisonne **par équipe,
puis par phase, puis par match** — exactement la structure SAR×MOM (captures 6-7) et exactement
ce que le modèle F19 du Hub porte (`equipe_id` sur chaque phase-boîte). Le décalage ressenti
ne venait donc pas d'une opposition modèle/réalité, mais d'une UI qui n'exposait pas le modèle.

---

## 2. Le cas terrain de référence (récit Manu, verbatim reformulé)

**Challenge Vié A, 7 juin 2026, Villers-lès-Nancy.** Tournoi sur une journée. Nos 2 équipes à
XV (Équipe 1, Équipe 2) qualifiées parmi les 9 meilleures du Grand Est, engagées dans la même
compétition. Déroulé :
- **Matin — poules de brassage** : 3 poules de 3. Équipe 1 en poule 1 (vs Nord Alsace, vs
  Saint-André-les-Vergers) ; Équipe 2 en poule 2 (vs CRIG Illkirch, vs Reims).
- **Après-midi — poules de classement** : les vainqueurs de brassage s'affrontent pour les
  places 1-3, les 2èmes pour les places 4-6, etc. **Composition connue seulement à midi.**

**Pratique de préparation déclarée par Manu :** *« quand je prépare l'évènement, je mets adv 1,
adv 2… et j'ajuste quand je connais le nom des équipes. »* → la saisie ne doit jamais être
bloquée par l'attente d'un tirage.

---

## 3. Conception retenue — structure à 3 niveaux, par équipe

### 3.1 Principe directeur
**Un seul écran, un seul geste.** On épouse le modèle F19 (« par équipe d'abord ») et la
logique SAR×MOM (éditeur de phases opérant dans l'écran), au lieu de lutter contre.

### 3.2 La structure (générique, sans format codé en dur)

```
Évènement tournoi  (libellé · date · lieu)
│
├─ Équipe engagée 1   (case cochée + format propre)
│   ├─ Phase « … »  (nom libre · date)
│   │   ├─ match  vs adv 1
│   │   ├─ match  vs adv 2
│   │   └─ + match            (illimité)
│   └─ + phase                (illimité)
│
├─ Équipe engagée 2   (case cochée + format propre)
│   └─ …
└─ … N équipes
```

Trois niveaux : **équipe → phases → matchs.** Aucun niveau « poule » distinct (décision §4, D3).

### 3.3 Décisions de conception (tranchées avec Manu)

- **D1 — Structure par équipe.** Un bloc par équipe engagée ; chaque bloc contient ses phases
  et ses matchs, indépendamment des autres. (Manu a explicitement rejeté la variante « phases
  communes aux 2 équipes » au profit de la séparation par équipe, comme SAR×MOM.)
  → mappe `p_equipes_engagees[]` + `p_phases_par_equipe[]` (clé `evenement_equipe_id_local`).

- **D2 — Phases nommées librement et illimitées.** L'utilisateur tape le nom qu'il veut
  (« Poule de brassage », « Poule de classement », « 1/4 de finale », « 1/2 finale »,
  « Finale »…) et ajoute autant de phases que nécessaire. **C'est ce qui rend le modèle
  universel** : un plateau simple = 1 phase ; une coupe à élimination = autant de phases que de
  tours ; le Vié = 2 phases. Aucun format de tournoi codé en dur.
  → mappe le champ `libelle` de chaque phase dans `p_phases_par_equipe`.

- **D3 — Pas de niveau « poule » distinct.** Le nom de phase libre porte aussi bien
  « Poule de classement » que « 1/2 finale ». Un champ « poule » séparé serait une rigidité
  contraire à D2 et au principe P1 (simplicité). Le nom de poule, si besoin, s'écrit dans le
  libellé de la phase ou du match. **Décidé : pas de niveau poule.**

- **D4 — Matchs illimités par phase.** `+ match` autant de fois que voulu. C'est ce qui absorbe
  les poules de tailles variables (poule de 3 = 2 matchs ; poule de 5 = 4 matchs).
  → mappe le tableau `matchs[]` de chaque phase.

- **D5 — Adversaires en emplacements ajustables.** À la création, l'utilisateur saisit
  « adv 1 », « adv 2 »… (emplacements), puis revient écrire les vrais noms quand le tirage est
  connu. Vaut pour **tout le tournoi**, pas seulement l'après-midi. Aligné SAR×MOM (matchs
  « 1 », « 2 », « 3 », « 4 » dans les captures). Modifier plus tard = éditer un libellé.
  → mappe le champ `adversaire_nom` de chaque match (texte libre, déjà porté par M5/M6).

- **D6 — N équipes engagées (≥ 2).** 2, 4, 6 équipes : même structure répétée, 1 bloc par
  équipe. Aucune limite (le tableau `p_equipes_engagees` est de taille libre, la RPC boucle
  dessus). Conséquence ergonomique seule, pas structurelle (voir D8).

- **D7 — Format de jeu par équipe.** Chaque équipe engagée porte son propre format (Éq.1 à XV,
  Éq.2 à X, Éq.3-4 à VII…), réglé **à côté de la case à cocher de l'équipe**, dans le bloc
  « équipes engagées » en haut (cohérent avec le « FORMAT PAR ÉQUIPE » que le Hub affiche déjà
  et avec SAR×MOM « chaque équipe joue dans son propre format »). Déjà porté nativement :
  `p_equipes_engagees[].format_de_jeu` est un override par équipe dans le contrat RPC.

- **D8 — Cartes équipe repliables.** Pour rester lisible à 4+ équipes, chaque carte équipe se
  replie : on déplie celle qu'on remplit (phases visibles), les autres restent en ligne
  compacte (format + résumé « N phases, M matchs »). Décision ergonomique, sans impact modèle.

- **D9 — Création en un seul geste.** Bouton « Créer le tournoi » → un seul appel RPC composite
  atomique. Pas de renvoi vers une fiche « après création ». Résout la friction Manu
  *« il manque des boutons valider, on est obligé de repasser par le tableau de bord »*.

### 3.4 Couverture des formats (preuve de généralité)

| Format | Expression dans la structure |
|---|---|
| Challenge Vié (brassage + classement) | 1 équipe → 2 phases nommées, matchs en emplacements |
| Plateau simple | 1 équipe → 1 phase → N matchs |
| Tournoi Seven à 4 équipes | 4 blocs équipe, formats éventuellement différents |
| Coupe à élimination | 1 équipe → phases « 1/4 », « 1/2 », « Finale » |
| Poule de taille variable | `+ match` autant que nécessaire |
| Formats mixtes par équipe | `format_de_jeu` propre à chaque bloc (D7) |

---

## 4. Ancrage modèle / RPC (pour la conv Production)

Aucune extension de modèle ni de RPC n'est requise. Le mapping UI → contrat existant :

- **Équipe engagée + format** → un élément de `p_equipes_engagees` :
  `{ "equipe_id", "format_de_jeu"|null, "ordre", "evenement_equipe_id_local", "adversaires":[…] }`
- **Phases d'une équipe** → un élément de `p_phases_par_equipe` :
  `{ "evenement_equipe_id_local", "phases":[ { "libelle", "date_debut", "ordre", "matchs":[…] } ] }`
- **Match** → un élément de `phases[].matchs` :
  `{ "libelle", "date_debut", "adversaire_nom"|null, "format_de_jeu"|null, "ordre" }`
- **Emplacement adversaire** → champ `adversaire_nom` en texte libre (« adv 1 »…), éditable
  ensuite via la voie d'édition normale.

Le lien logique équipe↔phases passe par `evenement_equipe_id_local` (identifiant côté client,
ex. `"equipe_1"`), résolu en UUID par la RPC après création de la ligne M3 — déjà documenté
dans l'en-tête de `sql/52`. **Aucune pré-génération d'UUID côté client, aucun round-trip.**

**Travail Production attendu (résumé, à détailler en conv dédiée) :**
1. Remplacer `buildPhasesParEquipeList` (texte de consigne) par un **éditeur de phases opérant
   par équipe** : champ nom de phase + date, lignes match répétables avec emplacement
   adversaire, boutons `+ phase` / `+ match`, cartes équipe repliables.
2. Remplacer dans `submitModalCreate` la **phase fantôme codée en dur** par la lecture réelle
   de cet éditeur → construction du JSONB `p_phases_par_equipe` complet.
3. Exposer le **format par équipe** à côté de chaque case d'équipe engagée → `format_de_jeu`.
4. Conserver l'appel unique à `createEvenementComplet` (RPC composite) — pas de renvoi fiche.

**Aucun DDL, aucune migration, aucune modification de la RPC `creer_evenement_complet`.**

---

## 5. Hors périmètre — signalé, NON traité (pour la conv Production)

Ces points affleurent dans la même modale mais relèvent d'autres sujets (une conv = un sujet).
Tracés ici pour que la conv Production les connaisse, **sans être conçus dans ce document.**

- **`MODELE-EVT-HORAIRES-RDV` 🟠** — les horaires détaillés (heure de RDV / lieu de RDV / heure
  de fin prévue) sont saisis dans la modale « pour mémoire » mais **ne persistent pas** (bandeau
  jaune visible dans les captures). Dette modèle déjà ouverte (STATE pt 18). À traiter en conv
  `Modélisation` dédiée. **Non absorbé ici.**
- **Encadrement « wrapper non livré »** — la liste d'encadrement de la modale affiche
  « indisponible (wrapper non livré) ». Relève du câblage UI fiche/staff, hors sujet création
  tournoi. **Non absorbé ici.**
- **`MODELE-EVT-PHASES-PAR-EQUIPE` 🟡** — clarification sémantique de `equipe_id` sur la
  phase-boîte (§4.4 v1.2). **Cette conception la consomme implicitement** (chaque phase porte
  son `equipe_id` via D1) ; la dette de clarification documentaire reste ouverte mais n'est plus
  bloquante. À acter en conv Modélisation si une formalisation explicite est souhaitée.

---

## 6. Invariants protégés (rappel)

Conception pure : aucun fichier de code/SQL touché. Modèle Évènements v1.2 / Collectif v1.1 /
Doctrine v1.2 / RPC `creer_evenement_complet` / accroches Suivi A/B/C / module bénévole /
`compositions.evenement_id` / N1/N2/N3 — **tous intacts** (extensions UI conçues, non
implémentées). La refonte vise la seule surface de saisie des phases dans la modale de création.

---

## 7. Sortie attendue → conv Production

Ouvrir une conv `Production · Refonte UX saisie des phases à la création (tournoi multi-phases)`
avec ce document FAIT FOI en main. Livrables pressentis : refonte de l'éditeur de phases dans
`evenements.html` (UI) + `evenements-browser.js` (`buildPhasesParEquipeList` + `submitModalCreate`).
Aucun SQL. Gate de version au démarrage. Recette terrain sur le Challenge Vié A réel.
