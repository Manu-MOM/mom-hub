# Conception — Suivi de match en direct par l'éducateur seul (v1)

> **Document FAIT FOI** · à déposer au Drive `00 - Documentation/`
> Conception pure : **zéro code, zéro SQL exécuté**. L'implémentation relève de conv(s) `Production` ultérieure(s).
> Établi le 1 juin 2026 · conv de cadrage `Conception · Refonte du module Suivi des matchs`.
> Gate de version : reparti du STATE pt 45 confirmé courant par Manu. Sources lues à la source (`raw.githubusercontent.com/Manu-MOM/mom-hub/main`) avant rédaction — md5 vérifiés (voir §6).

---

## 0. Objet et périmètre

Ce document cadre **une cible** : l'expérience de **suivi d'un match en direct par un éducateur seul**, c'est-à-dire un éducateur qui suit lui-même son match avec l'outil (il n'y a pas de parent bénévole à la table de marque ce jour-là).

C'est une **persona nouvelle**. Le module Suivi existant a été dimensionné sur d'autres personas :
- le **parent bénévole** à la table de marque (module bénévole `suivi.html`, sans login, jeton = autorisation) ;
- le **coach en revue à froid** (Mode Vidéo `mode-video.js`, saisie a posteriori) ;
- le **spectateur** et le **coach en consultation** (écran spectateur `spectateur.js`, panneau temps de jeu `temps-de-jeu.js`, lecture seule).

L'éducateur seul qui **saisit en live** tombe entre les mailles : il a un compte (donc il pourrait être coach authentifié), mais le **seul écran de saisie live qui existe est le module bénévole sans login**. C'est la raison nommée, validée par Manu, qui justifie de rouvrir un module par ailleurs clos et recetté terrain en mai 2026 : **il manque un écran de saisie live pensé pour le coach authentifié.**

**Intangible absolu : le module bénévole `suivi.html` / `suivi-app.js` / `suivi-client.js` n'est PAS touché.** La cible introduit une surface coach distincte ; elle ne réinterprète pas le bénévole.

---

## 1. Diagnostic terrain (vérifié à la source + écran)

Le déclencheur du chantier était formulé par Manu comme « je ne sais pas où trouver les accès au suivi ». La vérification a établi que **ce n'est pas une impression, mais un trou de parcours réel** :

1. **Le module Suivi n'est pas décâblé.** Les accroches Objet A/B/C sont bien appelées dans le rendu de la fiche évènement (`renderSuiviRencontreBloc` + `renderModeVideoAcces` + `renderSpectateurAcces` + `renderTempsDeJeuMount` appelées pour les matchs simples ET les matchs-enfants de tournoi — `evenements-browser.js` v1.55).

2. **Mais l'accès est mal placé pour la persona, et cassé pour les tournois :**
   - Sur la fiche d'un **tournoi-racine** (Challenge Vié), la vignette « Suivi · Saisie observables match » de la grille fonctionnalités est **inerte, badge « À VENIR »** (constat écran). Logique côté modèle — on ne suit pas un tournoi, on suit ses matchs — mais rien ne l'explique à l'utilisateur.
   - La section « PHASES DU TOURNOI (DÉTAIL) » liste bien tous les matchs réels (vs Nord Alsace, vs Illkirch (CRIG), vs Reims…), mais **les lignes de match ne sont pas cliquables** (constat terrain Manu : « cliquer sur la ligne de match ne fait rien »).
   - **Conséquence : dans un tournoi, le suivi par-match n'est atteignable par aucun chemin visible.** Le code le rend, l'UI n'y mène pas.

3. **Le parcours compo, lui, fonctionne** : la vignette « Compositions · Feuilles de match par équipe » a un bouton actif « Choisir l'équipe ▼ » qui mène à `compositions.html` avec ses onglets de match (chantier 6c-6, pt 37). Le chemin vers la **feuille de match** tient debout, alors que le chemin vers le **suivi du match** ne tient pas.

**Le fil « fonctionnalités décâblées » de Manu trouve ici sa réponse : ce n'est pas du décâblage de fonctions, c'est (a) une vignette inerte sur la racine de tournoi et (b) un chaînon de navigation manquant entre le tournoi et le suivi de ses matchs.**

---

## 2. Cible — vue d'ensemble

**Un seul écran de suivi live (l'onglet Suivi dans `compositions.html`, sur une feuille de match), atteint par plusieurs portes selon la persona.**

La fiche évènement **oriente** (aiguillage), la compo **exécute** (saisie). Plus de labyrinthe.

---

## 3. Décisions de cadrage (tranchées avec Manu, pas-à-pas)

### D1 — Point d'entrée = onglet Suivi dans `compositions.html`
L'écran de saisie live de l'éducateur seul est un **onglet « Suivi »** dans l'éditeur de compositions, à côté des onglets de vue existants (aujourd'hui : Liste, Terrain — vérifié à la source, `.view-tabs`). Surface coach distincte du module bénévole, qui reste intangible.

### D2 — Onglet actif uniquement sur une compo de MATCH
Le suivi ne s'ouvre que sur une **compo de match** (qui porte un adversaire et l'`evenement_id` du match). Sur une **compo de base**, l'onglet est **inerte** (présent mais désactivé, message d'invite). Justification : la base est l'ossature de l'équipe, elle ne porte pas d'adversaire — « suivre un match » n'y a pas de sens.
*Dépendance tracée : créer la compo de match devient un pré-requis du suivi ; le chemin de création relève du parcours compo amont (6c-6), pas de ce chantier.*

### D3 — Adversaire déjà connu, démarrage direct
À l'ouverture de l'onglet sur une feuille de match, le suivi **connaît déjà l'adversaire** (porté par la compo de match → match → `evenement_adversaires`). **Pas de re-sélection d'adversaire** (divergence assumée avec la référence SAR×MOM qui, elle, fait choisir l'adversaire).
*Vigilance Production (non bloquante) : vérifier à la source que la chaîne compo de match → match → adversaire est lisible côté client au moment d'ouvrir le suivi.*

### D4 — Coup d'envoi explicite
L'éducateur ouvre l'écran prêt (compo, adversaire, chrono à zéro) et déclenche lui-même un **« ▶ Coup d'envoi »** qui démarre le chrono et ouvre la saisie. Pas de saisie avant. Justification : le coup d'envoi réel ne coïncide pas avec l'ouverture du téléphone ; le sas cale le chrono sur le vrai début. Cohérent avec l'invariant I4 du module bénévole (« saisie verrouillée avant »).

### D5 — Écran unique en scroll
Tout le live tient sur **un seul écran qui scrolle** (ossature de la référence SAR×MOM) : score, palette, événements, temps de jeu, historique, chrono.
*Nuance honnête : la référence est en vue desktop large ; sur téléphone (situation réelle de l'éducateur), le rendu sera une colonne plus longue. Intention « tout accessible en scrollant, rien de caché » — le rendu mobile se calera aux maquettes Production.*

### D6 — Palette = référentiel `observables-match.json` (Cat A devant, Cat B en retrait)
La palette de saisie vient du **référentiel projet `observables-match.json`** (lu à la source, voir §5), pas du barème simple de la référence. Profondeur :
- **Cat A au premier plan** : score (Essai +5, Transfo +2, Pénalité +3, Drop +3), discipline (carton jaune/rouge, avertissement), mouvement (substitution, blessure), jeu collectif (mêlées/touches gagnées/perdues).
- **Cat B pédagogique atteignable mais en retrait** — pas étalée à côté du score, ouverte par un geste explicite quand le moment le permet. Mécanisme aligné sur le module bénévole (mode Normal/Expert basculable, « le mode = capacité du moment, pas statut de personne »).

### D7 — Attribution toujours nominative (côté nous)
Chaque action côté SAR/MOM est rattachée à un **joueur nommé** (comme la référence). Pas d'action anonyme côté nous. L'adversaire reste en **score brut** sans attribution (on ne connaît pas ses joueurs) — asymétrie déjà inscrite dans le `_meta` du référentiel (« interface détaillée pour SAR/MOM, simplifiée pour adversaire »).
*Tension assumée : éducateur seul + mains prises + attribution obligatoire = le geste « action → joueur » doit être le plus rapide possible ; l'effectif affiché doit être le bon (compos multi-format). Point d'ergonomie central pour la Production.*

### D8 — Cat B : accessible en live, surtout exploitée à froid
L'observation pédagogique (Cat B) est **accessible pendant le live** (en retrait, D6) mais **majoritairement saisie à froid**, dans la **revue** — qui est le **Mode Vidéo existant** (`mode-video.js`), sur la **même chronologie**. La cible ne crée donc pas d'écran de revue neuf : live (Cat A devant, Cat B en retrait) → revue à froid (Cat B au cœur, Mode Vidéo).

### D9 — Temps de jeu : en direct ET en bilan, FIABLE
Le temps de jeu par joueur est affiché **en direct** (piloter le roulement pendant le match) **et en bilan** (vue d'ensemble après). Exigence de **fiabilité** : minutes exactes par joueur, remplaçants entrés et cartons décomptés.
**Conséquence assumée : chantier backend.** Aujourd'hui la substitution est mono-ligne (`SUIVI-COACH-7`) — la base ne reconstitue pas entrée/sortie/minute, le temps de jeu n'est qu'une estimation aveugle au roulement (les remplaçants entrés ressortent « non décomptés »). La cible **assume de faire évoluer le stockage de la substitution** (sortant + entrant + minute) pour rendre le calcul fiable. Le référentiel le prévoit déjà (`obs-A-substitution` porte `[joueur_sortant, joueur_entrant]`) ; c'est la chaîne de stockage (`chronologie_suivi`, RPC C12-c/d/k) qui ne stocke qu'un joueur. **Remédiation = ajout pur** (nouvelle structure/RPC exposant le signal manquant, sans jamais modifier l'existant), **décision tracée** car elle rouvre du SQL C12. **Lève `SUIVI-COACH-7`.**

### D10 — Fin de match : score figé + passage au suivant par les onglets
À la fin, score figé + accès au Rapport. Le **passage au match suivant d'un tournoi se fait par les onglets de match existants** (6c-6) — l'éducateur clique l'onglet du prochain match, relance un coup d'envoi. **Pas de bouton « match suivant » dédié** : aucune logique d'ordre fragile à inventer (les poules n'ont pas d'ordre figé). Choix validé sur maquette comparative.

### D11 — Vignette Suivi de la fiche = aiguillage (« Diffuser le lien » / « Suivre en direct »)
La vignette « Suivi » de la fiche évènement, aujourd'hui inerte « À VENIR », devient un **aiguillage** à deux actions explicites :
- **« Diffuser le lien »** → génère/partage le lien (parent bénévole à la table de marque, ou spectateur) ;
- **« Suivre en direct »** → mène l'éducateur seul à **l'écran de suivi dans la compo** (onglet Suivi, D1), **match déjà choisi**.

Pour un **tournoi**, « Suivre en direct » fait d'abord **choisir le match** (comme « Choisir l'équipe ▼ » le fait pour les compos), puis ouvre la feuille de ce match avec l'onglet Suivi actif — de sorte que **l'écran d'arrivée n'a jamais d'ambiguïté de match**.

**Conséquence : refaire la vignette Suivi (aiguillage actif) EST la réparation du trou d'accès tournoi → suivi (§1).** Les deux ne sont pas des chantiers séparés : la même refonte résout le placement et l'accès.

### D12 — Deux entrées, chacune pour qui de droit (ajouter, pas déplacer)
On **ajoute** l'entrée live (compo) **sans supprimer** l'orientation depuis la fiche. Les personas ne se chevauchent pas : le bénévole et le spectateur n'ouvrent jamais l'éditeur de compo (ils reçoivent un lien) → leur place reste la fiche (« Diffuser le lien ») ; l'éducateur seul est déjà dans la compo le jour J → sa place est l'onglet Suivi, atteint aussi via « Suivre en direct ». Pas de doublon fonctionnel, pas de friction.

---

## 4. Personas et portes d'entrée (synthèse)

| Persona | Action | Porte d'entrée | Écran |
|---|---|---|---|
| Parent bénévole (table de marque) | Reçoit un lien de saisie | Fiche → vignette Suivi → « Diffuser le lien » | `suivi.html` (intangible) |
| Spectateur | Reçoit un lien lecture seule | Fiche → vignette Suivi → « Diffuser le lien » | `spectateur.html` (existant) |
| Éducateur seul (live) | Saisit lui-même | Compo (onglet Suivi) **ou** Fiche → « Suivre en direct » | **Onglet Suivi dans `compositions.html` (neuf)** |
| Coach (revue à froid) | Corrige/complète a posteriori (Cat B) | Fiche → « Revoir ce match » | `mode-video.html` (existant) |

---

## 5. Référentiel `observables-match.json` — contenu réel (lu à la source)

Fichier `data/observables-match.json`, `_meta.version` = **1.0** (le STATE le cite « v1.1 » — écart documentaire tracé, non corrigé ici).

**Catégorie A — universelle, 4 familles :**
- **Score** : Essai (5), Transformation (2, filtre aptitude botteur), Pénalité (3, filtre botteur), Drop (3) — saisie associée : joueur.
- **Discipline** : Carton jaune, Carton rouge (joueur + motif optionnel), Avertissement (joueur).
- **Mouvement** : Substitution (`joueur_sortant` + `joueur_entrant`), Blessure (joueur + nature optionnelle).
- **Jeu collectif** : Mêlée gagnée/perdue, Touche gagnée/perdue — pas d'attribution joueur.

**Catégorie B — pré-suggestions paramétrables par catégorie d'âge** (observables qualitatifs/pédagogiques) : jeux distincts pour `EDR_M-6_M-8_M-10_M-12`, `M-14_F-15`, `M-16_M-19`, `F-18`, `M+18_F+18` (ex. « lecture de l'intervalle », « plaquage offensif », « soutien intérieur »…).

**Note d'intention déjà inscrite (`_meta`)** : « interface détaillée pour SAR/MOM, simplifiée pour adversaire (+5/+2/+3/+3/−1) » — confirme l'asymétrie nous/adversaire de D7.

---

## 6. État de l'existant vérifié à la source (gate)

md5 confirmés concordants avec le STATE pt 45 :
- `compositions.html` — `a3ceac43…` (onglets de vue : **Liste + Terrain seulement** ; aucune trace de Suivi/chrono/coup d'envoi → l'onglet Suivi est bien un ajout neuf).
- `compositions-editor.js` v3.25 — `94b6c027…`
- `supabase-client.js` v1.41 — `2f8e4638…`
- `evenements-browser.js` v1.55 — accroches Suivi A/B/C **appelées** dans le rendu de la fiche (lignes 2682-2685 matchs-enfants, 2693-2696 match simple).
- `mode-video.js` `29491060…`, `temps-de-jeu.js` `09392745…`, `spectateur.js` `03d3fe0d…`, `suivi.html` `abf76c49…`, `suivi-app.js` `2dcd2f0e…`, `data/observables-match.json` (Cat A 13 obs + Cat B par âge).

---

## 7. Chantiers et dettes que la Production devra porter

Trois éléments **ne sont pas des acquis** et sont signalés honnêtement comme du travail à faire :

1. **Backend substitution (temps de jeu fiable, D9)** — stockage sortant + entrant + minute ; ajout pur, décision tracée (rouvre SQL C12) ; lève `SUIVI-COACH-7`.
2. **Cat B réellement utilisable en live (D6/D8)** — aujourd'hui dette `SUIVI-UI-4` (« pas de différence visible Normal/Expert », cadre Expert livré structurellement vide). Rendre la Cat B exploitable est un vrai morceau, pas un acquis.
3. **Vignette Suivi inerte → aiguillage actif (D11)** — réparation du trou d'accès tournoi → suivi (§1) ; inclut, pour les tournois, la sélection du match avant l'écran.

---

## 8. Intangibles tenus

Module bénévole (`suivi.html` / `suivi-app.js` / `suivi-client.js`) **non touché**. Mode Vidéo (`mode-video.js`) et spectateur (`spectateur.js`) **réutilisés tels quels** (revue à froid, diffusion). Compo de match 6c-6 (`compositions.evenement_id`), N1-N2-N3, RPC C12 existantes (C12-c/d/k non modifiées — la fiabilisation substitution est un ajout pur), accroches Suivi A/B/C, Doctrine v1.2 — **non rouverts**.

---

## 9. Sortie attendue

Conception close sur ce cycle. Implémentation en conv(s) `Production` :
- **Front** : onglet Suivi dans `compositions.html` (écran live D1-D10) + refonte vignette Suivi de la fiche en aiguillage (D11).
- **Backend** : fiabilisation de la substitution (D9, ajout pur SQL C12, décision tracée).
- Vérifications à la source obligatoires avant tout code (versions/md5, chaîne compo de match → adversaire, état réel `mode-video.js` / `temps-de-jeu.js`).

**Geste de fin de cette conv** : commiter ce document (1 fichier = 1 commit) + le déposer au Drive `00 - Documentation/` ; MAJ STATE/CARTE (bloc nouveau pt en tête, aucun bloc historique réécrit).
