# Conception — GRILLE-VEO v1 (grille d'aide au visionnage VEO, à imprimer)

**Statut : GELÉ par Manu le 17/11/2026 (« je gèle R2 »).** Rédigée le 17/11/2026, puis mise à jour avec les réponses de Manu : « rajouter choix de jeu judicieux ou pas aux 9, 10, 15 / a fait gagner ou perdre du terrain à son équipe pour les communs », « les reporter dans le Hub se fera si on en voit l'utilité à l'usage », « plutôt une page si possible ». Maquette PDF fournie.

Origine : retour terrain de Vivien, relayé par Manu. Théo analyse les matchs en regardant la vidéo VEO. Vivien veut que le Hub édite une **grille à imprimer** avec la liste des joueurs et une série d'observables. On marque **un trait par observation**. Les joueurs sont classés en 3 groupes : **avants**, **3/4**, **9 · 10 · 15**. Certains observables sont communs (plaquages réussis ou ratés, en-avant…), d'autres sont propres à chaque groupe. Point de départ : la feuille Google Sheets « Statistiques match du … » de Vivien (PDF fourni par Manu). Elle compte 23 lignes et les colonnes suivantes :
- essais ;
- lancers en touche, pénalités / transformations et jeu au pied, en ok / X ;
- en-avant ;
- plaquages, en ok / X ;
- pénalités, en pour / contre ;
- attitude au ruck, en ok / x ;
- cartons, antijeu / brutalité, exploit individuel, commentaires ;
- un bloc collectif : touches, mêlées et pénalités, en gagnées / perdues.

Gouvernance : sujet traité dans la conversation EVAL-JOUEUR à la demande explicite de Manu (« enchaîne ici »). C'est un **écart tracé**, qui sera noté au STATE.

## 1. Ce qui existe déjà (DS-1, vérifié le 17/11/2026)

- **Compo du match** : `compositions` (type `match`, côté `mom`, active) et `composition_joueurs`, avec `numero_maillot`, `poste_id`, `role` et `ordre_remplacement`.
- **Postes** : table `postes`, avec `numero_xv` de 1 à 15 et une `ligne` (Première ligne, Deuxième ligne, Troisième ligne, Demis, Centres, Ailiers, Arrière). Les postes des formats réduits (12, X, 9, 8, 7) ont aussi un `numero_xv`. Le jeu à 5 n'en a pas.
- **Observables** : `data/observables-match.json` v1.4. Familles : score, tentatives ratées, discipline (dont le carton blanc), conquête touche / mêlée par issue, faute technique (en-avant, passe en avant), jeu au pied (8 contextes × issues), actions marquantes (socle de 12 : grattage, plaquage offensif, plaquage décisif, franchissement…).
- **Mode vidéo** (`mode-video.html`) : saisie des actions dans le Hub pendant la revue vidéo. Le Hub sait aussi enregistrer des observables « à froid » (RPC `enregistrer_observable_froid`).

## 2. Décisions proposées

- **G1 — Point d'entrée.** Un bouton « 🖨 Grille d'analyse VEO » dans la fiche du match (zone Suivi). Il ouvre une page dédiée, `grille-veo.html?evenement=<id>`, réservée au staff connecté (encadrants de la catégorie, admin, bureau), mise en page pour **A4 paysage** et imprimée via le navigateur. Aucune entrée de menu.
- **G2 — En-tête.** Le match (nom avec « VS adversaire »), la date, la catégorie et le niveau. Un champ « Analyste » et la date d'analyse, à remplir à la main.
- **G3 — Joueurs.** Ils viennent de la **compo active** du match et sont classés par poste :
  - **Avants** : postes 1 à 8 ;
  - **3/4** : postes 11 à 14 ;
  - **9 · 10 · 15** : demi de mêlée, demi d'ouverture, arrière.

  Pour classer, on prend le poste tenu dans la compo, sinon le numéro de maillot (1 à 15). Sans compo, la grille sort avec des lignes vierges seulement.
  **Remplaçants : R2 (gelé).**
  - Titulaire = numéro de maillot de 1 à 15. Son bloc dépend du poste tenu dans la compo, sinon du numéro de maillot.
  - Remplaçant = numéro de 16 et plus. Il est pré-rempli avec la mention (R) dans le bloc de son poste de compo.
  - Remplaçant sans poste dans la compo : il est listé sous l'en-tête (« À placer : … »), et l'analyste l'écrit sur une ligne vierge.
  - 1 ligne vierge par bloc pour un joueur entré en jeu sans être prévu.
  - Hauteur de ligne : 5,1 mm jusqu'à 21 lignes, 4 mm au-delà. Au-delà de 27 lignes, la grille passe sur une 2ᵉ page.
- **G4 — Observables communs** (retour de Vivien du 17/11/2026, 3ᵉ tour), dans cet ordre :
  - plaquage ✓ / ✗ ;
  - **attitude sur ruck ✓ / ✗** (fusion de « attitude PB », « attitude soutien » et « grattage ») ;
  - **franchissement** ;
  - **duel ✓ / ✗** ;
  - **passe décisive** ;
  - en-avant ;
  - pénalité concédée ;
  - ballon perdu ;
  - essai ;
  - carton ;
  - action remarquable.

  Franchissement, duel et passe décisive passent dans les communs (« pour tout le monde »).
- **G5 — Observables spécifiques** (3ᵉ tour) :
  - **Avants** : lancer en touche ✓ / ✗, prise en touche ✓ / ✗, attitude en mêlée ✓ / ✗, **avancée au contact** (remplace « percussions ») ;
  - **3/4** : bonne course, contest aérien ;
  - **9 · 10 · 15** : gestion ✓ / ✗, choix de jeu ✓ / ✗, animation au pied ✓ / ✗, tir au but ✓ / ✗.
- **G6 — Forme d'une case.** Une colonne par observable, assez large pour des traits, avec deux sous-colonnes ✓ / ✗ quand l'observable a une réussite et un échec. On ajoute une colonne « Commentaires » par joueur, et un **bloc collectif** dans l'en-tête : touches gagnées / perdues, mêlées gagnées / perdues, pénalités pour / contre. **Le tout tient sur une seule page A4 paysage**, vérifié dans Chrome : R1 avec 15 titulaires et 6 lignes vierges, R2 avec 23 joueurs et 3 lignes vierges. Au-delà, la grille passe sur une 2ᵉ page.
- **G7 — Réglage avant impression.** Les observables se cochent ou se décochent. La largeur s'ajuste pour rester sur une page. Le réglage n'est pas mémorisé en v1 : la liste par défaut est celle de G4 et G5. Si Vivien veut garder ses propres réglages, ce sera une v2.
- **G8 — Libellés.** On reprend autant que possible les libellés du référentiel d'observables, pour qu'un report dans le Hub reste possible plus tard.
- **G9 — Hors périmètre v1.** Ne font pas partie de la v1 : la saisie à l'écran, les grilles de l'adversaire et le jeu à 5. Le report des traits dans le Hub **ne se fera que si on en voit l'utilité à l'usage** (Manu).

## 3. Modèle

- **Aucun SQL en v1** si la lecture de la compo d'un match est déjà disponible côté staff. Sinon, une RPC de lecture seule. À vérifier en DS-1 au moment du code.
- Fichiers prévus :
  - `grille-veo.html` + `js/grille-veo.js` (page, réglage, rendu à imprimer) ;
  - le lien depuis la fiche match dans `js/evenements-browser.js`.

## 4. Réponses de Manu (17/11/2026)

1. Observables : trois tours de retours (Manu, puis Vivien) ; liste en G4 et G5. Maquettes `grille-veo-maquette-R1.pdf` et `grille-veo-maquette-R2.pdf`, chacune sur une page.
2. Report dans le Hub : seulement si l'utilité apparaît à l'usage.
3. **Une seule page** si possible : c'est le cas sur la maquette (`grille-veo-maquette.pdf`).
