# FAIT FOI — Évaluation joueurs & Espace joueur (EVAL-JOUEUR) — v1

**Statut : FAIT FOI (spec gelée).** Rédigé le 15/11/2026, gelé par Manu le 15/11/2026 (« je gèle », D1-D15 selon les recommandations).
Conversation : « MOM Hub — Évaluation joueurs (inspiration ABCD XV Alamercery) ».
Gate d'ouverture vérifié : STATE.md fourni par Manu le 15/11 (856 678 octets, md5 `73a046cf71e2dcd18bed33f840d3e9b1`) = taille du STATE Drive (`1hohNZXqlpAkWSwWZ0Fhwzt2Srrr1ZSng`, modifiedTime 2026-11-04T04:49:24Z). Tête = **pt 287** (COMPTE-TRESORERIE). Aucun chantier « évaluation » antérieur dans le STATE.
Maquette validée par Manu le 15/11/2026 : canevas « MOM Hub — Évaluation joueurs (maquette) » (3 écrans : staff bilans de période, staff éval match, espace joueur mobile).

---

## 0. Objet et esprit

Reprendre l'idée de la fiche individuelle d'évaluation de l'ABCD XV Alamercery (outil du staff ABCD, accès joueur/famille par code), en l'améliorant.

**Esprit (Manu, 15/11) :** l'évaluation est un **vrai canal de communication entre les joueurs et le staff**. Les joueurs doivent **avoir hâte** d'aller consulter leur évaluation, notamment après les matchs. Ce n'est pas un bulletin de notes : chaque retour valorise, oriente, et le joueur peut répondre.

Deux objets :
1. **Bilans de période** — 4 blocs par saison × 5 critères fixes, feu V/O/R + observation.
2. **Évals match** — retour court par joueur et par match.

Restitués dans un **Espace joueur** (lecture, mobile d'abord) accessible au joueur et à sa famille par un **lien personnel**.

## 1. Faits sondés (DS-1 du 15/11/2026)

Sources : clone `main` (shallow, 15/11) + sondes lecture seule sur la base `fvfqffxaiaoygqhjtxwr`.

- **F1 — Lien à jeton : patron existant.** `sql/C12-f-lien-ephemere.sql` : table fermée `lien_suivi` (RLS active, REVOKE ALL à PUBLIC/anon/authenticated), jeton opaque = 2 × `gen_random_uuid()` sans tirets (64 hex), validé côté serveur par `valider_lien_suivi(p_token, p_role_requis)` (SECURITY DEFINER), RPC de lecture accordées à `anon, authenticated`. Écran `spectateur.html` / `js/spectateur.js` : lecture seule, jeton `?t=` dans l'URL, « zéro surface d'écriture ». **Patron repris tel quel** pour l'Espace joueur (table de jetons distincte, cf. D1).
- **F2 — Joueurs.** `personnes.categorie_id` (uuid) porte la catégorie. `type_personne` : `licencie_competition`, `licencie_externe_partenaire`, etc. Joueurs non archivés en M16 : **15 MOM + 41 partenaires** ; M14 : 31 + 31. 4 MOM + 17 partenaires sans catégorie.
- **F3 — Matchs.** `evenements.type_evenement = 'competition'` (53 événements). Colonnes utiles : `id`, `categorie_id`, `saison_id`, `date_debut`, `adversaire_nom`, `score_mom`, `score_adverse`, `domicile_exterieur`.
- **F4 — Feuille de match.** `compositions` (`evenement_id`, `type_compo`, `etat`, `est_active`) + `composition_joueurs` (`composition_id`, `joueur_id`, `numero_maillot`, `role`, …). **Constat : 27 compositions `type_compo='match'` actives, TOUTES en `etat='brouillon'`, aucune `validee`.** ⇒ la feuille de l'éval match ne peut PAS exiger une compo validée (cf. D9).
- **F5 — Autorisation.** Présents en base : `has_role(p_role text)`, `puis_je_ecrire_categorie(p_categorie_id uuid)`, `est_staff(p_personne_id uuid)`. Patron d'écriture en usage : `has_role('admin') OR has_role('bureau') OR puis_je_ecrire_categorie(cat)` (ex. `sql/C15-a`).
- **F6 — Saison.** `saisons.est_active` ; saison active = `2026/2027`.
- **F7 — Stats joueur.** `fiche-joueur-stats.html` + `js/stats-saison.js` (v1.8) : « restitution famille », par niveau (Nat / Rég), actions marquantes, jeu au pied, fautes. Calcul **côté client** à partir de lectures réservées aux comptes connectés. Réservé au staff aujourd'hui.
- **F8 — INTERDITS.** `hub-agenda.js` (`817b4a6f`), `hub-agenda.css` (`13d67a67`), `hub.css`, `hub-nav.js` — **nouvelle empreinte de référence `4412b82a…`** depuis la dérogation ESPACE-SALARIE (STATE). Aucun n'est touché par ce chantier. Les hooks Suivi A/B/C de `evenements-browser.js` ne doivent pas régresser : ce chantier **n'y touche pas** (cf. D12).
- **F9 — Charte visuelle.** `hub.css` : Oswald / Manrope ; `--vert-bouteille #0c3d24`, `--paper #f8f5ec`, `--gold #d4a93a`, `--clay #b8451f`, `--bleu-base #3066BE`. Les nouvelles pages s'y alignent (maquette).

## 2. Décisions

### 2.1 Déjà tranchées par Manu (15/11/2026)

- **D1 — Accès joueur & famille = lien personnel (option A).** Un lien unique par joueur, jeton opaque dans l'URL, lecture seule (+ la seule écriture prévue en D3). Pas de compte, pas de mot de passe. Le staff peut **régénérer** le lien (l'ancien est révoqué). Même mécanique que F1, mais **table de jetons dédiée** (`lien_espace_joueur`), distincte de `lien_suivi` (rien de commun : pas d'événement, pas d'expiration).
- **D2 — Publication.** Toute évaluation (bilan ou match) naît **brouillon** ; elle n'est visible dans l'Espace joueur qu'après **« Publier au joueur »** par un encadrant.
- **D3 — Échange.** Le joueur peut laisser **une réponse courte** (280 caractères max) sous chaque évaluation **publiée**. Le staff la voit sur la fiche. Pas de fil de discussion.
- **D4 — Périmètre.** Toutes les catégories. Saisie par les encadrants de la catégorie (B5).
- **D5 — Périodes (découpage ABCD XV, libellé Manu).** `pre_saison` « Pré-saison » · `p1` « Période 1 — septembre / décembre » · `p2` « Période 2 — janvier / mars » · `p3` « Période 3 — avril / juin ».
- **D6 — Critères fixes (ceux de l'ABCD XV).** Niveau technique individuel · Niveau physique · Niveau technique au poste · Compréhension du jeu · État d'esprit. Feu **V / O / R** (V acquis, O en progrès, R à travailler) + observation libre. Feux toujours accompagnés de leur lettre (lisibles sans la couleur).
- **D7 — Améliorations validées.** (a) Éval match au format « point fort / axe de travail / mot du coach » ; (b) lien vers une action VEO + minute ; (c) 1 à 2 objectifs fixés par période ; (d) frise de progression critère × période ; (e) repère « Nouveau » quand une évaluation a été publiée depuis la dernière visite ; (f) garde-fous : aucun classement ni comparaison entre joueurs, **point fort obligatoire** pour publier une éval match, niveau Nationale / Régionale toujours affiché.
- **D8 — Stats individuelles : OUI, en DERNIER LOT (L5).** Sous chaque éval match, bloc « Tes repères du match », **uniquement si le match a été suivi**, **uniquement des repères positifs** côté joueur (actions marquantes, réussites) ; le staff voit tout comme aide à la rédaction. Les lots L1–L4 ne dépendent pas des stats. Cumul de saison dans l'Espace joueur : hors v1.

### 2.2 Gelées par Manu le 15/11/2026 (recommandations de l'agent retenues)

- **D9 — Feuille de l'éval match.** Liste des joueurs à évaluer pour un match = joueurs de la **composition `type_compo='match'` active** de l'événement, **quel que soit son `etat`** (F4 : aucune n'est validée). Sans composition : l'encadrant choisit parmi les joueurs de la catégorie. [Recommandé]
- **D10 — Joueurs partenaires inclus.** Un joueur est évaluable s'il est rattaché à la catégorie (`personnes.categorie_id`), **quel que soit son club** (MOM ou partenaire d'entente). En M16, 41 des 56 joueurs sont partenaires (F2). [Recommandé : inclus]
- **D11 — Qui publie.** Tout encadrant autorisé sur la catégorie du joueur (`admin | bureau | puis_je_ecrire_categorie`) peut rédiger ET publier. Pas de circuit de validation par le référent (simplicité). Chaque évaluation trace qui l'a rédigée et publiée. [Recommandé]
- **D12 — Points d'entrée.**
  - Bilans : bouton **« Évaluation »** sur la fiche joueur → nouvelle page `evaluation-joueur.html?joueur=<id>` (même patron que `parcours-performance.html?joueur=` / `&depuis=fiche`).
  - Éval match : nouvelle page `eval-match.html?evenement=<id>`, ouverte depuis la page Évaluation (liste des matchs de la catégorie) et, si c'est simple, depuis le pilotage de catégorie. **Pas de modification de `evenements-browser.js`** (hooks Suivi protégés). [Recommandé]
  - Espace joueur : nouvelle page publique `espace-joueur.html?t=<jeton>`, `<meta name="robots" content="noindex">`.
- **D13 — Dépublier.** Un encadrant peut **dépublier** une évaluation (retour en brouillon, invisible côté joueur ; la réponse éventuelle du joueur est conservée côté staff). Pas de suppression d'une évaluation publiée. Un brouillon peut être supprimé. [Recommandé]
- **D14 — Réponse du joueur modifiable.** Le joueur peut modifier ou effacer sa réponse tant que l'évaluation reste publiée ; la date de dernière modification est affichée au staff. [Recommandé]
- **D15 — Payload Espace joueur réduit (RGPD).** Prénom, NOM, catégorie, saison ; évaluations publiées uniquement ; matchs : date, adversaire, niveau, score. **Aucune** autre donnée de `personnes` (ni date de naissance, ni coordonnées, ni santé, ni `notes_coach`). Noms des encadrants : prénom uniquement. [Recommandé]

## 3. Modèle de données proposé

Principe : schéma minimal, colonnes « à plat » (critères fixes, D6), lisible à la main. Les noms exacts sont confirmés en L1 après relecture DS-1 (aucune colonne inventée hors de ce qui est sondé en §1).

**3.1 `lien_espace_joueur`** — table **fermée** (RLS + REVOKE ALL, comme `lien_suivi`).
`id uuid PK` · `personne_id uuid NOT NULL → personnes(id)` · `token text UNIQUE NOT NULL` (64 hex, patron F1) · `revoque boolean NOT NULL DEFAULT false` · `cree_par uuid` · `date_creation timestamptz` · `derniere_consultation timestamptz` (sert au repère « Nouveau » côté joueur et à l'info « dernière consultation » côté staff).
Au plus **un lien actif** par joueur (index unique partiel `WHERE NOT revoque`). Régénérer = révoquer l'actif + en créer un.

**3.2 `eval_bilan`** — un bilan par joueur × saison × période.
`id` · `personne_id` · `saison_id → saisons` · `periode text CHECK IN ('pre_saison','p1','p2','p3')` · `objectif_1 text` · `objectif_2 text` · 5 × `feu_<critère> text CHECK IN ('V','O','R')` (nullable) · 5 × `obs_<critère> text` · `statut text CHECK IN ('brouillon','publie') DEFAULT 'brouillon'` · `redige_par uuid` · `publie_par uuid` · `publie_le timestamptz` · `reponse_joueur varchar(280)` · `reponse_le timestamptz` · `created_at` · `updated_at`.
`UNIQUE (personne_id, saison_id, periode)`.

**3.3 `eval_match`** — une éval par joueur × match.
`id` · `personne_id` · `evenement_id → evenements` · `feu text CHECK IN ('V','O','R')` · `point_fort text` · `axe_travail text` · `mot_coach text` · `veo_url text` · `veo_minute text` · `statut` / `redige_par` / `publie_par` / `publie_le` / `reponse_joueur` / `reponse_le` / `created_at` / `updated_at` (comme 3.2).
`UNIQUE (personne_id, evenement_id)`. Publication refusée si `feu` ou `point_fort` vides (D7-f), contrôle **côté RPC**.

**3.4 Accès.** Les 3 tables : RLS active, aucun accès direct client ; tout passe par des RPC SECURITY DEFINER (doctrine `personnes`).

## 4. RPC (contrat ; signatures fixées en L1)

**Staff (`authenticated`, garde = `has_role('admin') OR has_role('bureau') OR puis_je_ecrire_categorie(<catégorie du joueur>)`)**
- `lister_evals_joueur(personne_id, saison_id)` → bilans + évals match du joueur (tous statuts) + réponses.
- `enregistrer_eval_bilan(...)` / `publier_eval_bilan(id)` / `depublier_eval_bilan(id)` / `supprimer_eval_bilan(id)` (brouillon seulement).
- `lister_evals_match(evenement_id)` → feuille D9 + état de chaque éval.
- `enregistrer_eval_match(...)` / `publier_eval_match(id)` / `depublier_eval_match(id)` / `supprimer_eval_match(id)` (brouillon seulement).
- `get_lien_espace_joueur(personne_id)` / `generer_lien_espace_joueur(personne_id)` (crée ou régénère).

**Joueur (`anon, authenticated`, garde = jeton valide non révoqué)**
- `get_espace_joueur(token)` → payload D15 (publié seulement) ; met à jour `derniere_consultation` et renvoie la valeur précédente (calcul du « Nouveau »).
- `repondre_eval(token, type 'bilan'|'match', eval_id, texte)` → refusé si l'éval n'appartient pas au joueur du jeton ou n'est pas publiée ; texte ≤ 280 ; vide = effacement (D14).

## 5. Lots de livraison

- **L1 — Socle SQL.** 3 tables, RLS, RPC §4, grants. Dry-run `BEGIN…ROLLBACK` + `DO $verif$` fail-loud, puis apply sur « feu vert COMMIT », SELECT séparé après. Sondes DS-1 à rejouer en ouverture : colonnes `personnes`, `evenements`, `compositions`, `composition_joueurs`, `saisons` ; signatures `puis_je_ecrire_categorie`, `has_role`.
- **L2 — Staff : bilans de période.** `evaluation-joueur.html` + `js/evaluation-joueur.js` ; enveloppes RPC dans `js/supabase-client.js` ; bouton sur la fiche joueur ; encart lien (copier / régénérer / dernière consultation) ; aperçu côté joueur ; impression navigateur (`window.print`, patron fiche stats).
- **L3 — Staff : éval match.** `eval-match.html` + JS ; feuille D9 ; enchaînement « Joueur suivant » ; « Publier tous les brouillons » ; accès depuis la page Évaluation (+ pilotage de catégorie si simple).
- **L4 — Espace joueur.** `espace-joueur.html` + JS (client anon minimal, patron `spectateur.js`) : dernier match + Nouveau, revoir l'action VEO, réponse, objectifs, frise de progression, liste des matchs, bilans publiés.
- **L5 — Repères de match (D8).** Lecture des stats d'un joueur sur un match : côté staff (aide à la rédaction) et côté joueur (positifs seulement, si match suivi). **Pré-requis : DS-1 dédié sur `stats-saison.js`** (calcul client) pour choisir entre une RPC jeton qui renvoie les observables bruts du joueur et un calcul serveur ; option à soumettre à Manu avant code.

Recette terrain : comptes Manu (admin), Vivien RULFO (encadrant M16), Jean-Emmanuel LACOMBE ; Espace joueur testé sur mobile par un joueur et sa famille.

## 6. Hors périmètre v1

Auto-évaluation du joueur · cumul de stats de saison dans l'Espace joueur · notifications (push / e-mail) · export PDF stylé (l'impression navigateur suffit) · évaluation des matchs joués hors MOM (ABCD XV, Parcours Performance) · critères paramétrables par catégorie · comptes joueurs.

## 7. Invariants

INTERDITS non modifiés (`hub-agenda.js` `817b4a6f`, `hub-agenda.css` `13d67a67`, `hub.css`, `hub-nav.js` `4412b82a…`) · `evenements-browser.js` non modifié · `lien_suivi` et l'écran spectateur non modifiés · 1 fichier = 1 commit · fichiers complets.

## 8. Journal

- 15/11/2026 — L1 appliqué : migration `sql_263_eval_joueur_socle` (version 20261115135909) sur « feu vert COMMIT » de Manu. Dry-run 24/24 verts avant ; SELECT séparé après : 3 tables RLS, 0 policy, 12 RPC SECURITY DEFINER, 8 helpers fermés, seules `get_espace_joueur` et `repondre_eval` ouvertes à anon, tables vides.
- 15/11/2026 — L2 (page Évaluation + bouton fiche), L3 (évals match + liens pilotage), L4 (espace joueur) livrés ; recettes vertes.
- 15/11/2026 — L5 : option **A** retenue par Manu (« je te suis ») après DS-1 de `stats-saison.js` v1.8 : repères calculés en base (`sql_264` : `_ej_reperes`, `_ej_libelle_marq`, `reperes_match_joueur`, `_ej_json_match` remplacé à signature identique). Côté joueur : positifs seulement (points, essais, buteur réussi, coups de pied réussis **sans total**, actions marquantes nommées), bloc masqué si match non suivi ou rien de positif. Côté staff : détail complet en aide à la rédaction. Dry-run 7/7 verts (recoupement indépendant des comptages sur le match du 31/10).
  - **Invariant ajouté** : la règle de comptage des observables existe en deux lectures alignées (`js/stats-saison.js` et `sql_264`). Toute évolution du référentiel des observables (préfixes `obs-A-…`, libellés du socle des actions marquantes) doit être reportée aux deux endroits.
- 15/11/2026 — L5 appliqué : migration `sql_264_eval_joueur_reperes` (version 20261115164453) sur « feu vert COMMIT » de Manu. SELECT séparé après : 3 fonctions nouvelles, `_ej_json_match` unique et porteur des repères, anon limité à `get_espace_joueur` / `repondre_eval`, 0 helper ouvert.
- 16/11/2026 — Avenant A, A1 appliqué : migration `sql_265_eval_joueur_auto_eval` (version 20261116092140) sur « feu vert COMMIT » de Manu. Dry-run 14/14 verts avant ; SELECT séparé après : RLS active sur `auto_eval_match` (vide), 1 éval existante non verrouillée (D22), défaut `auto_eval_requise = true`, une seule signature pour `enregistrer_eval_match` (13 paramètres) et `envoyer_auto_eval`, anon limité à `get_espace_joueur` / `repondre_eval` / `envoyer_auto_eval`.
  - **Consigne transitoire** : ne pas publier de nouvelle éval match avant A2 + A3 (elle serait verrouillée côté joueur sans formulaire d'auto-évaluation disponible).
- 16/11/2026 — Avenant A complété par **D24–D27 (signalement blessure / gêne / fatigue)**, gelés par Manu (« je gèle ») ; implémentation `sql_266`.
- 16/11/2026 — Recette A1–A3 verte (Manu). Retours : lien joueur accessible depuis l'éval match (eval-match.js v1.3) ; **D28** moments VEO multiples. Auto-évaluation de recette (Julien WEIL, 14/11) supprimée à la demande de Manu. Consigne transitoire levée.
- 22/11/2026 — **Avenant C** (ressources FFR, sous-critères, objectifs) rédigé et proposé au gel (§11). Contenu gelé par Manu le 22/11/2026 (« je gèle » sur le document `Criteres-EVAL-JOUEUR.docx` v2, puis sur l'option 1 « colonnes fixes »). Chantier enchaîné dans la conversation d'idéation à la demande de Manu (choix « B ») : écart de gouvernance à tracer dans STATE.
- 22/11/2026 — **Avenant C gelé par Manu** (« je te suis et je gèle ») : D29–D42 retenus, **D43** ajouté (tableau récap après match adapté). Prochaine étape : DS-1 puis C1 (`sql_286`) en dry-run.
- 22/11/2026 — Avenant C, **C1 appliqué** : migration `sql_286_eval_joueur_avenant_c` (version 20261122105521) sur « feu vert COMMIT » de Manu. Dry-run 19/19 verts avant (rien conservé) ; SELECT séparé après : 10 colonnes ajoutées, une seule signature pour `enregistrer_eval_bilan` (18 paramètres), `enregistrer_eval_match` (16) et `envoyer_auto_eval` (15), 0 helper `_ej_` ouvert, anon limité aux 6 RPC de l'espace joueur, données existantes intactes (2 bilans, 6 évals match, 2 auto-évaluations, sans Mental ni sous-critères). Sondes et dry-run exécutés via MCP Supabase en lecture / essai à blanc.
- 22/11/2026 — Avenant C, **C2 livré** : `data/criteres-eval.json` v1.0 (6 critères, 25 sous-critères de ressources, 10 familles de postes / 67 sous-critères, Buteur, seuil 3, messages coach / joueur). **D44** ajouté (masquages par catégorie, choix de Manu). Codes de postes sans famille (`3LU`, `3L`, `J1`–`J5`) : le joueur choisit (D36), décision technique tracée.

---

## 9. Avenant A — AUTO-ÉVALUATION MATCH (GELÉ par Manu le 16/11/2026)

Ouvert le 16/11/2026 à l'initiative de Manu. Décisions déjà exprimées par Manu : l'auto-évaluation porte **sur les matchs uniquement** (les bilans de période restent inchangés) ; format **B** = les 5 critères des bilans de saison en V/O/R ; option **B1 d'emblée** = le coach peut lui aussi noter ces 5 critères dans son éval match. Recommandations de l'agent pour le reste ➜ entre crochets, **toutes retenues** par Manu (« pour le reste, je te suis », 16/11/2026).

### 9.1 Décisions

- **D16 — Périmètre.** Auto-évaluation par match, sur les 5 critères D6 (mêmes libellés), feu V/O/R. Bilans de période inchangés. *(Manu)*
- **D17 — Critères côté coach (B1).** L'éval match du coach gagne les 5 critères V/O/R, **facultatifs** : la publication reste possible sans eux (règle D7-f inchangée : feu global + point fort). *(Manu)*
- **D18 — Ouverture.** L'auto-évaluation d'un match s'ouvre dès que le match est passé, pour les joueurs de la feuille (règle D9), sans attendre le coach. Un joueur absent de la feuille n'a rien à auto-évaluer. [Recommandé]
- **D19 — Verrou.** L'éval match du coach (feu, point fort, axe, mot, VEO, repères) n'est visible dans l'espace joueur **qu'après l'envoi de l'auto-évaluation de ce match**. Masquage **côté base** (rien n'est envoyé au navigateur tant que le verrou tient), pas seulement à l'écran. [Recommandé]
- **D20 — Auto-évaluation figée dès l'envoi.** Pas de modification après envoi (empêche de recopier le coach ; plus simple que « figée après découverte »). [Recommandé]
- **D21 — Un mot facultatif.** Commentaire libre du joueur, 280 caractères, facultatif. [Recommandé]
- **D22 — Non rétroactif.** Les évals match publiées avant la mise en service restent visibles sans auto-évaluation. [Recommandé]
- **D23 — Comparaison neutre.** Côté joueur, après déverrouillage : « ton avis / l'avis du coach » critère par critère (quand le coach a noté), écarts signalés sans jugement (« vous voyez ça différemment »), et frise « Comment je me vois » match après match. Côté staff : auto-évaluation et écarts visibles sur la page éval match (à côté de la saisie) et tendance sur la page Évaluation du joueur. [Recommandé]
- **D24 — Question santé obligatoire.** En fin de formulaire : « T'es-tu blessé, ou ressens-tu une gêne ou une fatigue importante ? » Oui / Non, réponse requise. Si Oui, « Explique-nous » requis, 500 caractères max. *(Manu ; format recommandé par l'agent)*
- **D25 — Visibilité restreinte.** Le signalement n'est visible que du joueur (son espace) et des encadrants de la catégorie. Il n'entre ni dans la frise « Comment je me vois » ni dans la comparaison avec le coach (ce n'est pas un critère de performance). [Recommandé]
- **D26 — Alerte staff, sans automatisme.** Badge « ⚠ signalement » sur la feuille éval match, texte du joueur dans son dossier, bouton « Créer une blessure » ouvrant la saisie existante (`upsert_blessure`) préremplie. Le signalement **ne crée jamais** de ligne `blessures` automatiquement : le staff qualifie. [Recommandé]
- **D27 — Pas d'exception au gel.** Le signalement est figé avec l'auto-évaluation (D20). Une gêne apparue après l'envoi passe par le circuit habituel (le joueur prévient son coach). [Recommandé]
- **D28 — Plusieurs moments VEO (retour terrain du 16/11/2026, choix de Manu).** « Revoir tes actions » = **un** lien VEO du match + jusqu'à **5 moments** (minute requise, 10 car. ; libellé facultatif, 60 car.). Remplace la minute unique de D7-b. Lien requis dès qu'un moment est saisi. Implémentation `sql_267` (`eval_match.veo_moments` jsonb, `veo_minute` supprimée ; `p_veo_minute` gardé en compatibilité), supabase-client v1.98, eval-match.js v1.4, espace-joueur.js v1.3.
- *Note RGPD* : données de santé, majoritairement de mineurs. D25 limite l'accès ; une mention dans l'information aux familles (« les signalements de gêne sont transmis aux encadrants de la catégorie ») est recommandée, à valider par le bureau (l'agent n'est pas juriste).

### 9.2 Modèle (à confirmer en DS-1 du lot)

- **Nouvelle table `auto_eval_match`** (indépendante de l'éval du coach, qui peut ne pas exister encore) : `personne_id`, `evenement_id`, 5 feux `feu_<critère>` (V/O/R, tous requis à l'envoi), `commentaire varchar(280)`, `envoye_le`, `UNIQUE (personne_id, evenement_id)`. RLS + REVOKE ALL, accès RPC seulement.
- **`eval_match` +** 5 colonnes `feu_<critère>` (facultatives, coach) **+** `auto_eval_requise boolean NOT NULL DEFAULT true`, mise à `false` par la migration pour toutes les lignes existantes (D22).
- **RPC anon (jeton)** : `envoyer_auto_eval(token, evenement, 5 feux, commentaire)` — refusée si le joueur n'est pas sur la feuille, si le match n'est pas passé, ou si une auto-évaluation existe déjà (D20). `get_espace_joueur` étendue : matchs à auto-évaluer, auto-évaluations envoyées, et masquage des évals verrouillées (D19).
- **RPC staff** : `enregistrer_eval_match` accepte les 5 critères ; lecture des auto-évaluations dans `lister_evals_match` / `lister_evals_joueur`.
- **Complément D24 (`sql_266`)** : `auto_eval_match` + `gene_signalee boolean NOT NULL` + `gene_detail varchar(500)`, contrainte « détail requis si et seulement si Oui ». `envoyer_auto_eval` DROP + CREATE (+ `p_gene_signalee`, `p_gene_detail`, jamais d'overload). `_ej_json_auto` renvoie `gene: {signalee, detail}` (le joueur ne voit que la sienne ; staff via les RPC de lecture déjà étendues).

### 9.3 Lots

- **A1 — SQL** (dry-run, puis « feu vert COMMIT »).
- **A2 — Staff** : 5 critères facultatifs dans `eval-match.js` + auto-évaluation du joueur affichée à côté ; tendance dans `evaluation-joueur.js`.
- **A3 — Espace joueur** : carte « À toi de jouer : comment tu as vu ton match ? », formulaire 5 critères + un mot, déverrouillage, comparaison, frise.

### 9.4 Hors périmètre de l'avenant

Auto-évaluation des bilans de période ; relances / notifications ; modification d'une auto-évaluation envoyée.

## 10. Avenant B — APPLI INSTALLABLE ET CODE PERSO (GELÉ par Manu le 16/11/2026)

Retour terrain de Manu : « cette fiche pourrait se transformer en appli installable, non ? » et « ne serait-il pas préférable que l'accès à cette appli soit protégée par un code perso ». Proposition de l'agent, gelée par Manu (« je gèle : code à 4 chiffres / durée de session de 2 h / code oublié : réinitialiser seulement le code »).

### 10.1 Décisions

- **B1 — Installable.** L'espace joueur devient installable sur l'écran d'accueil (manifest, icône MOM, plein écran), sous le nom « MOM · Mon espace ». Les données viennent toujours de la base : rien n'est gardé en cache sur le téléphone. Sans réseau, l'appli affiche « Pas de connexion ».
- **B2 — Premier lancement.** Le joueur ouvre une fois son lien perso. Le téléphone mémorise le jeton du lien, et l'adresse est nettoyée (le jeton disparaît de la barre et de l'historique). L'icône installée relit ce jeton. Sur iPhone, l'appli installée a sa propre mémoire : si elle n'a pas le jeton, elle affiche un écran « Colle ton lien perso » (à vérifier en recette).
- **B3 — Code perso de 4 chiffres** par joueur. Il est choisi à la première ouverture, partagé avec la famille si le joueur le souhaite, vérifié en base et stocké chiffré (bcrypt, jamais en clair).
- **B4 — Session de 2 h.** Le code ouvre une session de 2 h. Le jeton de session est gardé le temps de l'onglet ou de l'appli (sessionStorage), jamais au-delà. Le code n'est jamais mémorisé sur le téléphone. **Le jeton du lien seul ne donne plus accès aux données** : il faut une session.
- **B5 — Anti-essais.** Après 5 codes faux, l'accès est bloqué 15 minutes. Une erreur de code ne lève pas d'exception, pour que le compteur soit bien enregistré.
- **B6 — Code oublié : réinitialiser seulement le code.** Le coach clique « Réinitialiser le code » dans le Hub. Le lien ne change pas, les sessions ouvertes sont fermées, et le joueur choisit un nouveau code à la prochaine ouverture. « Régénérer le lien » reste disponible en cas de lien transféré par erreur.
- **B7 — Transition.** Les liens déjà distribués restent valables. Le code est demandé à leur prochaine ouverture. Côté staff, le Hub affiche « code défini : oui / non » et un éventuel blocage.
- **B8 — Hors périmètre.** Notifications push (chantier à part, il faut un serveur d'envoi), comptes séparés pour les parents.

### 10.2 Modèle (`sql_268`)

- `lien_espace_joueur` gagne 4 colonnes : `code_hash`, `code_defini_le`, `essais_echoues` (défaut 0) et `bloque_jusqua`.
- Nouvelle table `session_espace_joueur` : `jeton` (64 hex, clé primaire), `lien_id` (FK, suppression en cascade), `cree_le`, `expire_le` (+ 2 h). RLS sans policy, REVOKE ALL.
- Fonctions anon, qui prennent le jeton du **lien** :
  - `etat_acces_espace` → `{code_defini, bloque_jusqua}`, sans aucune donnée personnelle ;
  - `definir_code_espace` → ouvre une session, seulement si aucun code n'est défini ;
  - `ouvrir_session_espace` → `{ok, session, expire_le}` ou `{ok:false, raison, essais_restants, bloque_jusqua}`.
- Fonctions anon existantes (`get_espace_joueur`, `repondre_eval`, `envoyer_auto_eval`) : signatures inchangées. Leur paramètre `p_token` attend désormais le jeton de **session** : `_ej_personne_du_jeton` est remplacé à signature identique et résout une session valide, d'un lien non révoqué.
- Fonctions staff :
  - nouvelle `reinitialiser_code_espace` ;
  - `get_lien_espace_joueur` et `lister_evals_joueur.lien` renvoient en plus `code_defini` et `code_bloque_jusqua`.
- **Coupure assumée** : entre l'application du SQL et le déploiement du front B, l'ancien espace joueur ne s'ouvre plus. Le front doit être déployé juste après le COMMIT.

### 10.3 Lots

- **B-SQL** : `sql_268`, dry-run puis COMMIT.
- **B-FRONT** :
  - espace joueur : écran code (créer / saisir), session, mémorisation du jeton, adresse nettoyée, écran « Colle ton lien perso » ;
  - appli : manifest, icônes, service worker minimal sans cache de données ;
  - staff : `evaluation-joueur.js` (code défini, bouton « Réinitialiser le code ») et `supabase-client.js` (wrapper).

### 10.4 Invariant modifié

L'invariant « 3 fonctions anon » devient **6 fonctions anon** : `get_espace_joueur`, `repondre_eval`, `envoyer_auto_eval`, `etat_acces_espace`, `definir_code_espace`, `ouvrir_session_espace`. Aucune donnée ne sort sans session valide.

## 11. Avenant C — RESSOURCES FFR, SOUS-CRITÈRES ET OBJECTIFS (GELÉ par Manu le 22/11/2026)

Retours terrain du 22/11/2026 : **Milan** (référent M16) demande que le joueur se fixe des objectifs pour le prochain match ; **Lohann** (pôle EDR / seniors) demande des critères selon le poste joué. Réflexion menée avec Manu le 22/11/2026, contenu gelé par Manu (« je gèle ») sur le document de travail `Criteres-EVAL-JOUEUR.docx` v2 (libellés, sous-critères, listes par famille de postes) et sur l'option 1 (colonnes fixes). Avenant gelé par Manu le 22/11/2026 (« je te suis et je gèle ») : toutes les recommandations [Recommandé] sont retenues, avec l'ajout D43 (tableau récap).

### 11.1 Faits sondés (DS-1 du 22/11/2026)

- Porte : STATE pt 295 (914 875 octets, md5 `fbcea632…`, Drive modifiedTime 2026-11-22T05:09:11Z) ; clone `main` = `d68f773`.
- Volumes en base : `eval_bilan` 2 lignes (2 publiées) ; `eval_match` 6 lignes (4 publiées, 6 avec au moins un critère) ; `auto_eval_match` 2 lignes. La reprise de l'historique porte donc sur très peu de données.
- Critères : 5 colonnes `feu_<critère>` dans `eval_bilan` (+ `obs_<critère>`), `eval_match` (facultatives) et `auto_eval_match` (NOT NULL). Libellés en dur dans 4 fichiers front : `evaluation-joueur.js`, `eval-match.js`, `espace-joueur.js` (v2.2), `recap-evals-match.js` ; wrappers dans `supabase-client.js`.
- Postes : `composition_joueurs.poste_id` référence la table `postes` (uuid ; codes `PG`, `TAL`, `PD`, `2LG`, `2LD`, `2LU`, `3LG`, `3LD`, `3LU`, `N8`, `DM`, `DO`, `AG`, `AIU`, `AD`, `CG`, `CTU`, `CD`, `AR`, `J1`–`J5`, regroupements `PIL`, `2L`, `3L`, `CTR`, `AIL`).
- **Remplaçants** : dans les compos de match actives, ils sont presque tous rangés sur un poste « par défaut » (78 sur `2LU`, 32 sur `PG`). Le poste de la compo n'est fiable que pour les **titulaires**.
- `get_espace_joueur` a été remplacée en dernier par `sql_282` (Parcours) : c'est la base à reprendre.

### 11.2 Décisions

- **D29 — 6 critères alignés sur les ressources du joueur FFR** (Plan de formation du joueur) : 1 Technique (ressources techniques), 2 Physique (ressources physiques), 3 Lecture du jeu (ressources perceptives et décisionnelles), 4 Engagement & collectif (ressources affectives et relationnelles), 5 Mental (habiletés mentales), 6 Technique au poste. *(Manu)*
- **D30 — Affichage.** Libellé court du critère, avec rappel de la ressource FFR en petit. *(Manu)*
- **D31 — Partout.** Les 6 critères valent pour l'éval match du coach, l'auto-évaluation et les **bilans de période**. *(Manu)*
- **D32 — Reprise de l'historique.** Les 5 critères actuels deviennent : technique individuelle → Technique ; physique → Physique ; compréhension du jeu → Lecture du jeu ; état d'esprit → Engagement & collectif ; technique au poste → Technique au poste. **Mental** est nouveau, sans historique (affiché « — » sur les évaluations antérieures). [Recommandé]
- **D33 — Sous-critères, déclenchement a + b.** (a) Le coach qui note un critère O ou R peut cocher des sous-critères « à travailler » ; le joueur les découvre une fois l'éval déverrouillée (D19 inchangé). (b) Le joueur qui se note O ou R dans son auto-évaluation peut aussi cocher des sous-critères, facultatifs. Simple case cochée, **pas de V/O/R par sous-critère**. *(Manu)*
- **D34 — Plafond non bloquant.** À partir de **3** cases cochées dans un même critère, un message invite à prioriser (formulation coach / formulation joueur) ; on peut continuer. Seuil réglable dans le référentiel. *(Manu)*
- **D35 — Sous-critères du critère 6 par famille de postes** : Piliers (1-3), Talonneur (2), 2ᵉ lignes (4-5), Flankers (6-7), N°8 (8), Demi de mêlée (9), Ouvreur (10), Ailiers (11-14), Centres (12-13), Arrière (15) ; plus un sous-critère **Buteur** (« Mes tirs au but et transformations ») proposé à tout joueur, quel que soit son poste. Contenu = document v2 gelé. *(Manu)*
- **D36 — Poste du match.** Proposé par défaut depuis la compo de match **pour les titulaires seulement** ; le joueur peut le corriger. Pour un remplaçant, ou sans compo, ou sur un poste sans famille (`J1`–`J5`), le joueur choisit sa famille de postes (pas de pré-remplissage, cf. 11.1). Le coach voit le poste déclaré par le joueur ; à défaut, celui de la compo. *(Manu, précisé par la sonde [Recommandé])*
- **D37 — Adaptation selon l'âge.** Liste unique ; un sous-critère peut être masqué pour certaines catégories (champ du référentiel). Les masquages sont **vérifiés dans les règlements Rugby éducatif** déjà présents dans le Hub avant d'être saisis (lifter en touche, contester les mauls, box kick, tirs au but, flankers en format 13). *(Manu)*
- **D38 — Où vivent les critères (option 1).** Les **6 critères principaux** restent des **colonnes fixes** en base (continuité sql_263 / sql_265). Les **libellés, rappels FFR, sous-critères, familles de postes, masquages et seuil** vivent dans un référentiel JSON du dépôt, modifiable à la main. Ajouter ou retirer un critère principal = futur chantier SQL + front (assumé). *(Manu)*
- **D39 — Sous-critères aussi dans les bilans de période (côté coach).** Même mécanique que l'éval match : O ou R → cases facultatives. [Recommandé]
- **D40 — Objectifs du prochain match (demande de Milan).** En fin d'auto-évaluation : « Mes objectifs pour le prochain match », **jusqu'à 3**, texte libre (120 caractères chacun), facultatifs, figés avec l'auto-évaluation (D20). Visibles du joueur et du staff (page éval match, récap après match). [Recommandé]
- **D41 — Rappel au match suivant.** À l'auto-évaluation suivante, le joueur voit ses objectifs précédents et répond pour chacun « atteint / en partie / pas atteint » (facultatif). La réponse est gardée avec la nouvelle auto-évaluation. [Recommandé]
- **D42 — Comparaison et frise.** La comparaison coach / joueur (D23) et la frise « Comment je me vois » passent à 6 critères ; les sous-critères cochés s'affichent sous le critère, côte à côte coach / joueur, sans jugement. Le récap après match (RECAP-EVALS-MATCH) affiche les 6 critères et le nombre de sous-critères cochés. [Recommandé]
- **D43 — Tableau récap après match adapté (ajout de Manu au gel).** `recap-evals-match.js` passe à 6 critères (coach / joueur) et affiche, pour chaque joueur, le poste joué, les sous-critères cochés (coach et joueur) et les objectifs du joueur pour le prochain match. À l'écran : détail complet. À l'impression A4 paysage : nombre de sous-critères cochés par critère et objectifs en texte court, pour tenir sur la page. Règle de la gêne santé inchangée (⚠ à l'écran sans détail, jamais imprimée). *(Manu ; format d'impression recommandé par l'agent)*
- **D44 — Masquages par catégorie (choix de Manu, 22/11/2026, après lecture des règlements Rugby éducatif 2026-2027 du Hub).** M6, M8, M10 : aucun sous-critère « Technique au poste » ni « Buteur » (pas de mêlée, de touche disputée ni de tir au but en M10 ; le critère lui-même reste noté V/O/R). M12 : « Lifter en touche » (piliers, 2ᵉ lignes) et « Me lier et pousser en mêlée » (flankers) masqués ; Buteur gardé (fiche muette sur les transformations). Contester les mauls : non précisé par les fiches, non masqué. Le « format 13 » n'existe plus en M14 en 2026-2027 (jeu à XV, à X, sevens). *(Manu)*

### 11.3 Modèle (à confirmer en DS-1 du lot C1)

- **Noms de colonnes conservés** (`feu_tech_indiv`, `feu_comprehension`, `feu_etat_esprit`…) : seule la signification affichée change (D32). Aucune migration de données, aucun renommage risqué. *(décision technique, tracée)*
- `eval_bilan` + `feu_mental`, `obs_mental`, `sous_criteres jsonb NOT NULL DEFAULT '{}'`.
- `eval_match` + `feu_mental`, `sous_criteres jsonb NOT NULL DEFAULT '{}'`.
- `auto_eval_match` + `feu_mental` (**nullable** : 2 lignes antérieures ; exigé par l'écran pour les nouvelles), `sous_criteres jsonb NOT NULL DEFAULT '{}'`, `poste_famille text`, `objectifs jsonb NOT NULL DEFAULT '[]'`, `bilan_objectifs jsonb NOT NULL DEFAULT '[]'`.
- Format `sous_criteres` : `{ "<critère>": ["<code sous-critère>", …] }`, clés limitées aux 6 critères ; contrôle en base de la **forme** seulement (objet de listes de textes) et de la règle « sous-critères seulement si le critère est O ou R ». Les codes eux-mêmes ne sont pas contrôlés en base (le référentiel vit dans le dépôt) : coût assumé, cohérent avec D38.
- Contraintes : `objectifs` 3 au plus, 120 car. ; `bilan_objectifs` = liste de `{objectif, resultat: atteint|en_partie|pas_atteint}`.
- Référentiel **`data/criteres-eval.json`** : 6 critères (clé colonne, libellé, rappel FFR, ordre) ; sous-critères par critère (code, libellé, catégories masquées) ; familles de postes (code, libellé, codes `postes` inclus, sous-critères) ; sous-critère Buteur ; seuil d'alerte (3) ; formulations du message coach / joueur.
- RPC (DROP + CREATE dès que la signature change, jamais d'overload) : `enregistrer_eval_bilan`, `enregistrer_eval_match`, `envoyer_auto_eval` (+ mental, sous-critères, famille de poste, objectifs, bilan des objectifs ; nouveaux paramètres avec `DEFAULT NULL` pour que le front actuel continue de fonctionner jusqu'au déploiement) ; `_ej_json_bilan`, `_ej_json_match`, `_ej_json_auto` remplacés à signature identique ; `get_espace_joueur` (base `sql_282`) : + objectifs de la dernière auto-évaluation envoyée, à rappeler ; + poste de compo (titulaire) pour le pré-remplissage.

### 11.4 Lots

- **C1 — SQL** `sql_286` : schéma + RPC ; dry-run `BEGIN … ROLLBACK` avec tests fail-loud, puis COMMIT sur « feu vert COMMIT » de Manu, vérifié par SELECT séparé.
- **C2 — Référentiel** `data/criteres-eval.json` : contenu du document v2 ; masquages par catégorie après vérification dans les règlements Rugby éducatif (D37).
- **C3 — Front staff** : `supabase-client.js`, `evaluation-joueur.js` (bilans 6 critères + sous-critères), `eval-match.js` (6 critères, sous-critères, poste, objectifs du joueur), `recap-evals-match.js` (D43 : 6 critères, poste, sous-critères, objectifs ; impression condensée).
- **C4 — Front joueur** : `espace-joueur.js` (auto-évaluation 6 critères, poste, sous-critères, message de priorisation, objectifs, rappel des objectifs, comparaison et frise à 6).
- Maquette des écrans auto-évaluation et éval match à valider par Manu avant C3 / C4.

### 11.5 Hors périmètre de l'avenant

- Points de vigilance du coach repris automatiquement dans l'auto-évaluation suivante (variante « c » évoquée en réflexion).
- Statistiques sur les sous-critères (tendances d'équipe, besoins les plus cochés).
- Ajout d'un 7ᵉ critère principal (cf. D38).
