# Conception — RECAP-EVALS-MATCH v1 (tableau récapitulatif des évaluations d'un match)

**Statut : GELÉ par Manu le 17/11/2026 (« je suis tes recos... je gèle » ; R9 = a′).** Rédigée le 17/11/2026 à partir des réponses de Manu : « 1 - ok », « 2 - maquette stp basée sur un match des seniors f », « 3 - je te suis », « 4 - uniquement un bouton sur la page Évals match, là où vivent les évals », puis, sur la maquette v1 : « ce serait bien que les remarques générales des coachs (point fort, axe de travail, mot du coach et le retour du joueur) figurent dans le tableau ». La maquette v2 a été acceptée (« ok »).

**Origine.** Demande de Jean (SR-F) relayée par Manu : après un match, pouvoir éditer un tableau qui rassemble l'évaluation du coach et l'auto-évaluation de chaque joueur.

**Gouvernance.** Conversation dédiée (1 conversation = 1 sujet). Base : STATE pt 291.

## 1. Ce qui existe déjà (DS-1, vérifié le 17/11/2026)

- **Gate.** STATE au Drive = pt 291 (886 921 octets, md5 `a7c8d4fe`, modifiedTime 2026-11-17T17:58:06Z). Clone `main` = `3d4a8e4`.
- **RPC `lister_evals_match(p_evenement_id uuid) → jsonb`.** Créée en sql_263, remplacée en sql_265. Définition relue en base, identique à `sql_265…-COMMIT.sql`. Garde : `has_role('admin') OR has_role('bureau') OR puis_je_lire_categorie(cat)`.
  - Renvoie `match` (date, libellé, adversaire, domicile/extérieur, score, niveau, `categorie_id`), `avec_compo` et `joueurs[]`.
  - `joueurs[]` = joueurs de la compo active du match, plus les joueurs évalués hors compo. Tri : numéro de maillot, puis nom, puis prénom.
  - Pour chaque joueur : `personne_id`, `nom`, `prenom`, `numero`, `club`, `eval` et `auto_eval`.
- **`eval`** (`_ej_json_match(m, true)`, dernière version sql_267) :
  - `statut` (`brouillon` / `publie`) et `feu` (V / O / R) ;
  - `criteres` (5 critères V/O/R, facultatifs) ;
  - `point_fort`, `axe_travail`, `mot_coach` : type `text`, **sans longueur maximale** ;
  - `reponse_joueur` (280 caractères), `veo_url`, `veo_moments` et le rédacteur.
- **`auto_eval`** (`_ej_json_auto`, dernière version sql_266) :
  - `feux` (5 critères V/O/R, obligatoires) ;
  - **un seul** `commentaire` (280 caractères) ;
  - `gene` (`signalee`, `detail`) et `envoye_le`.
- **Auto-évaluation sans éval coach.** Un joueur de la compo active peut s'auto-évaluer même sans éval coach (`_ej_match_auto_evaluable`).
- **Libellés.** Ceux de `js/eval-match.js` v1.4 :
  - critères : Niveau technique individuel, Niveau physique, Niveau technique au poste, Compréhension du jeu, État d'esprit ;
  - V acquis / O en progrès / R à travailler ;
  - feu du match : V gros match / O dans le match / R match difficile.
- **Modèle d'impression.** `grille-veo.html` + `js/grille-veo.js` v1.0 : page autonome sans `hub.css`, A4 paysage via `@page`, aperçu à l'écran, impression par le navigateur.
- **Point d'entrée.** `js/eval-match.js` v1.4 (md5 `8f5fd7d0`), fonction `rendreMatch()`, bloc `ev-actions` de l'en-tête (à côté de « Publier tous les brouillons »).
  - `rendreMatch()` est **réellement appelée** (l. 481 et 625). Leçon du pt 291 appliquée.
  - Côté client, la RPC est déjà appelée par `SupabaseHub.listEvalsMatch`.
- **Données.** Aucun match SR-F n'a encore d'éval ; il n'y a que **2 auto-évaluations** dans toute la base.
- **Droits de lecture, corrigé après sonde.** `puis_je_lire_categorie` repose sur `mes_categories_autorisees()`. Cette fonction ne renvoie `est_transverse = true` que pour **admin et bureau**. Les autres comptes ont seulement les catégories de leur `fonction_staff` (référent, manager, entraîneur principal ou adjoint) et celles de leur pôle s'ils en sont responsables.
  - Mon premier diagnostic disait « toute personne ayant une catégorie transverse ». **C'était inexact** : l'écart avec D25 ne concerne que l'admin, le bureau et les responsables de pôle.

## 2. Décisions

- **R1 — Usage.** Écran et impression **A4 paysage** par le navigateur (« Imprimer », ou « Enregistrer en PDF »). Pas d'export tableur en v1.
- **R2 — Page.** `recap-evals-match.html?evenement=<id>` + `js/recap-evals-match.js`, pages nouvelles.
  - Page autonome, comme la grille VEO. Lecture seule, staff connecté.
  - Droits = ceux de la RPC. En cas de refus, message « Tu n'as pas accès à ce match. »
  - Lien de retour vers `eval-match.html?evenement=<id>`.
- **R3 — Colonnes** (maquette v2), dans cet ordre :
  - n°, joueur, feu du match (coach) ;
  - les 5 critères avec **C | J côte à côte** (coach | joueur) ;
  - **Point fort**, **Axe de travail**, **Mot du coach** ;
  - **Retour du joueur** : son commentaire d'auto-évaluation, puis sa réponse à l'éval du coach, précédée de « ↪ Au coach » ;
  - statut (Publiée / Brouillon / Pas d'éval, puis Auto ✔ / Auto —) ;
  - ⚠, à l'écran seulement (R6).

  En-têtes abrégés : Tech. indiv., Physique, Tech. poste, Compréhension, Esprit. Un « — » veut dire non saisi.
  L'en-tête de la page porte le libellé du match, la date, domicile ou extérieur, le niveau et le score s'il est saisi. La catégorie n'y figure pas : la RPC ne renvoie que `categorie_id`, et aller lire son code demanderait une lecture de plus, non vérifiée en DS-1 (ajustement mineur, tracé à la livraison).
- **R4 — Lignes.** Celles de la RPC, dans son ordre. Pas de lignes vierges.
  - Brouillons **inclus**, avec la mention « Brouillon », à l'écran comme à l'impression (document interne au staff).
  - Sans compo, seuls les joueurs évalués apparaissent (comportement de la RPC).
- **R5 — Lecture.** Quand le coach et le joueur ne sont pas d'accord sur un critère, la case est encadrée. Une légende courte figure sous le titre.
  - Synthèse en bas : évals coach (dont publiées) / total ; auto-évaluations / total ; nombre de désaccords.
  - Pied de page : « MOM Hub · document interne au staff · imprimé le <date> ».
- **R6 — Santé.** Colonne ⚠ **à l'écran seulement**, sans le détail : le détail se lit sur la page Évals match. **Jamais imprimée** (`@media print`) et absente de la synthèse imprimée. Ce choix tient tant que la mention RGPD n'est pas validée par le bureau.
- **R7 — Accès.** **Un seul bouton**, « 🖨 Récap du match », sur la page Évals match en mode match (`rendreMatch()`, bloc `ev-actions`). Il ouvre un nouvel onglet. Rien dans l'onglet Suivi de la compo ni dans Évènements.
- **R8 — Mise en page.** Une page A4 paysage visée. Vérifié dans Chrome sur la maquette v2 : 22 joueuses avec des textes courts = 1 page.
  - Les textes coach n'ont pas de longueur maximale. Au-delà d'une page, l'impression continue en page 2, avec l'en-tête du tableau répété (`thead` en `table-header-group`, vérifié).
  - Aucune troncature des textes.
- **R9 — Données santé et D25.** **Tranché : (a′).** Le constat corrigé est au §1 : l'admin, le bureau et les responsables de pôle reçoivent déjà le détail de la gêne par `lister_evals_match`.
  - **(a′) [Retenu]** On garde le périmètre actuel et on précise D25 : « joueur, encadrants de la catégorie, responsable du pôle, admin et bureau ». Ce sont les mêmes personnes qui peuvent déjà rédiger et publier les évals (D11). Le bureau est l'instance qui valide la mention RGPD. Pas de SQL. Le récap n'affiche jamais le détail (R6).
  - **(b)** [Écarté] Masquer `gene.detail` pour qui n'a pas de `fonction_staff` active sur la catégorie. Cela demande un nouveau helper qui lit `fonction_staff` directement, car `mes_categories_autorisees()` court-circuite l'admin et le bureau. Effet de bord : Manu, admin, ne verrait plus le détail sur les catégories qu'il n'encadre pas. Il faudrait un `sql_271` avec dry-run.

  Ma recommandation d'origine était (b). Je la remplace par (a′) parce que l'écart réel est bien plus étroit que ce que j'avais annoncé.
- **R10 — Hors périmètre v1.** Export tableur ; récap par joueur sur la saison ; moments VEO ; tri ou filtre ; mémorisation de réglages.

## 3. Livraison

Lot unique **L1, front seul** (R9 = a′) :

| Fichier | Nature |
|---|---|
| `recap-evals-match.html` | nouveau |
| `js/recap-evals-match.js` v1.0 | nouveau |
| `js/eval-match.js` v1.5 | ajout pur du bouton (R7) |

Avant livraison :
- `node --check` sur chaque JS ;
- test dans Chrome avec un stub `SupabaseHub` (feuille de 22 joueurs, brouillons, éval absente, auto-évaluation absente, signalements, textes longs) : impression 1 page et 2 pages, colonne ⚠ absente du PDF ;
- md5 vérifiés à la source après les commits de Manu.

**Recette** : Jean, sur un match SR-F, une fois des évals et des auto-évaluations saisies ; à défaut, Manu sur un match M16.

## 4. Points ouverts hérités (non traités ici)

- 🔴 `js/evenements-browser.js` : au fetch de `origin/main` du 17/11/2026 à 19:26, le dernier commit de ce fichier est `4244856` (v1.65, md5 `206e2186`). Restauration v1.64 (`bb60197c`) non visible sur `main` (à recontrôler).
- 🟡 Mention RGPD sur les signalements santé à faire valider par le bureau (pt 289–291).
