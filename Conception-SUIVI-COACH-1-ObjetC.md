# Conception UX — `SUIVI-COACH-1` · Objet C — Temps de jeu (C-1) + Écran spectateur (C-2)

*Document de design · Conv « Conception » · 17 mai 2026*
*Cycle de conception détaillé. Fait suite au `Cadrage-SUIVI-COACH-1.md` (carte de cycle), à `Conception-SUIVI-COACH-1-ObjetA.md` (Objet A, livré) et `Conception-SUIVI-COACH-1-ObjetB.md` (Objet B, conçu/validé puis LIVRÉ en conv Production 17/05). Sœur de ces deux documents.*

> **Statut : VALIDÉ par Manu (17/05/2026), validation pas-à-pas micro-étape par micro-étape** (ordre tranché en ouverture C-Q5 : C-2 d'abord — C2-Q1 → C2-Q2 → C2-Q3 — puis C-1 — C1-Q1 → C1-Q2 → C1-Q3 — puis clôture du cycle). **Version réconciliée 17/05 (soir)** : voir l'encart §0bis. Document de référence du cycle, au même rang que `…-ObjetA.md` / `…-ObjetB.md`. Prêt pour dépôt Drive `00 - Documentation/`.

---

## 0 · Statut et périmètre

Objet C = **le dernier objet du cycle `SUIVI-COACH-1`**. Il couvre **deux surfaces de natures différentes**, traitées dans **une seule session** (décision Manu, carte d'ouverture §3) mais conçues **l'une après l'autre, sans les fondre** :

- **C-2 — Écran spectateur** : dérivé lecture seule distinct, destination du lien spectateur qu'Objet A produit déjà.
- **C-1 — Temps de jeu** : panneau de consultation côté coach, estimation dérivée des remplacements saisis.

**Conception de fond déjà tranchée par la spec** `Conception-Portail-UI-Suivi.md` (S-5.1 spectateur, S-5.4 temps de jeu), **vérifiée à la source** en ouverture de conv. Ce document **ne réinvente pas le fond** : il tranche l'articulation et le détail UX (C-Qx), pas la doctrine S-5.1/S-5.4.

**Contraintes dures de l'existant (STATE de référence du 17/05, version vivante vérifiée — protocole 8/8 tenu à l'ouverture, relecture à la source à la réconciliation du soir) :**

- **Couloir backend dettes SUIVI clos.** C12-a→f + C12-g/h/i exécutés/committés. **SUIVI-UI-6 livrée** (rôle du jeton lisible via `role_lien` piggy-back C12-g) → **le seul verrou dur d'Objet C (C-2) est tombé**. Objet C est cadrable.
- **Objet B (Mode Vidéo) LIVRÉ** en conv Production 17/05 (`sql/C12-k` lecture coach, `supabase-client.js` v1.15, `mode-video.js` v0.1, `evenements-browser.js` v1.10 accroche B-Q1 ; `mode-video.html` = version Manu). Voir §0bis pour l'impact sur Objet C.
- Sécurité spectateur **déjà portée par le backend** : jeton spectateur sans droit d'écriture, RLS C12-f. Rôle lisible via `role_lien` (C12-g).
- Couche de lecture déjà en place : `getChronologieRencontre` (`suivi-client.js` v1.1, voie jeton), tokens CSS `.suivi-*`, format de ligne `1MT 0'` / `2MT 11'`.
- États `evenements` réels : `creation|compo|joue|resultat|archive|annule` (pas d'état `termine` ; seuil exact = dette **C12-gate**, conv Audits). Corrections Mode Vidéo (Objet B) possibles tant que `evenement.etat` ≠ `archive`.
- Frontières déjà posées par les sœurs : **A-Q4** a tracé l'exposition du lien spectateur comme **évolution d'Objet A** conditionnée à la réalisabilité de C-2 (C-2 = destination, pas de re-conception du lien, pas de retouche d'A). **B-Q5** a **exclu** le temps de jeu de B (« porte ouverte côté C, fermée côté B ») ; **B-Q6** a posé C-2 hors-sujet de B.

---

## 0bis · Encart de réconciliation (17/05 soir — §4 bis règle 9)

> **Divergence signalée et réconciliée, jamais écrasée.** Pendant un stand-by entre la validation de ce document et la MAJ STATE, la conv `Production` a tourné en parallèle et **livré Objet B (Mode Vidéo)**. Le `STATE.md` Drive est passé de la version d'ouverture (15:27, 46 535 o) à 18:35, 59 917 o. STATE relu intégralement à la source avant cette réémission. **Aucun écrasement, aucune branche parallèle.**

**Impact sur Objet C — fond INCHANGÉ, deux réconciliations ciblées :**

1. **Collision de nom de dette résolue.** La version initiale de ce document *proposait* (sans figer — confirmation Manu en attente pendant le stand-by) le code `SUIVI-COACH-4` pour la réserve de vérification C12-d. Entre-temps, la conv Production a **réellement consommé et levé `SUIVI-COACH-4`** pour le chemin coach-authentifié de **lecture** chronologie (`sql/C12-k` = `get_chronologie_rencontre_coach`). Le code de la réserve d'Objet C est donc **renommé `SUIVI-COACH-6`** (codes pris : 1, 2, 3, 3-auth, 3-equipe, 4, 5 ; 6 = premier libre — confirmé Manu).

2. **Réserve C12-d fortement réduite par le travail Production (réconciliation tracée, pas réécriture silencieuse).** Pour ouvrir `SUIVI-COACH-4`, la conv Production a **vérifié C12-d à la source**. Constat reporté au STATE : `get_chronologie_rencontre` est **jeton-seul** (anon+jeton ; `p_evenement_uuid` verrouillé au bypass smoke-test superuser ; session coach `authenticated` → `RAISE 'Jeton requis.'`). `sql/C12-k` livre `get_chronologie_rencontre_coach` avec un **payload contrat-identique aux 15 colonnes de C12-d**, même tri horodatage ASC, paramètre `p_inclure_annulees`. Conséquences sur les 3 points de la réserve initiale :
   - **Point 1 — résolution jeton spectateur (C-2) : LEVÉ à la source.** C12-d **reste la voie spectateur** (jeton-seul, anon+jeton intact, non modifié par Production). C-2 lit via C12-d avec le jeton spectateur, exactement comme conçu en C2-Q1/C2-Q2.
   - **Point 2 — comportement annule/corrigee : LEVÉ à la source.** Le paramètre `p_inclure_annulees` existe (exposé par C12-k, miroir contractuel de C12-d). C12-d sait donc filtrer/inclure les lignes annulées : le « récit effectif » de C2-Q2 (annulées masquées) est **réalisable côté RPC**, le repli « filtrage client » devient un simple confort d'affichage, plus une incertitude.
   - **Point 3 — granularité colonnes remplacements pour C-1 : RÉSIDUEL.** Le payload 15 colonnes est traité par Production comme suffisant pour la chronologie générale, mais **non vérifié sous l'angle précis du calcul temps de jeu** (joueur entrant + joueur sortant + horodatage de la ligne de remplacement). Reste à confirmer finement — **sans dette backend probable** : si C-1 lit côté coach authentifié, il consomme `get_chronologie_rencontre_coach` (C12-k, **déjà livré**), pas une RPC à concevoir.

3. **C-1 lecture coach = C12-k déjà livré (renforce C1-Q3).** La conception C1-Q3 dit « aucune RPC propre, lecture de la même chronologie ». Le STATE confirme que le chemin coach-authentifié de lecture **existe et est livré** (`get_chronologie_rencontre_coach`, C12-k, payload identique C12-d). C-1, s'il lit côté coach, consomme cette RPC existante — **zéro RPC à inventer**, conforme à la frontière C1-Q3.

**Conclusion de réconciliation :** les 6 décisions (C2-Q1/Q2/Q3, C1-Q1/Q2/Q3) **tiennent intégralement, aucune invalidée**. La réserve d'Objet C rétrécit à son seul point résiduel (granularité colonnes pour C-1), renommée `SUIVI-COACH-6`. Objet B livré ne télescope pas Objet C (surfaces distinctes : B = écriture coach Mode Vidéo ; C-1 = consultation lecture ; C-2 = lecture spectateur). Le fond conçu et validé pas-à-pas n'est pas modifié.

---

# PARTIE I — C-2 · Écran spectateur (lecture seule distincte)

> Traité en premier (C-Q5 tranché en ouverture) : conception la plus contrainte (S-5.1 entièrement tranché, backend entièrement prêt) → le moins de risque d'invention ; destination du lien qu'Objet A produit déjà ; frontière dure à border en premier ; valeur la plus concrète (tribune).

## 1 · C2-Q1 — Architecture de l'écran

**Décision : un fichier distinct dédié spectateur, qui réutilise le *rendu en lecture* de `suivi.html` (bandeau score Zone A, chrono, fil d'historique Zone E) et qui est structurellement dépourvu de toute surface d'écriture — aucune Zone C palette, aucune Zone D joueur, aucune Zone B bascule, aucun ⚙, aucun sas.**

C-2 est essentiellement une **recomposition de composants de lecture déjà conçus dans une coquille sans code d'écriture** (couche `getChronologieRencontre` voie jeton existante, mêmes tokens `.suivi-*`, même format de ligne) — zéro nouveau schéma, zéro mécanique nouvelle. Application directe de P1.

Justification :

- **S-5.1.a au mot.** « Lien sans droit d'écriture, sûr par construction » → l'écran symétrique est un écran **sans code d'écriture, sûr par construction**. La sécurité n'est pas un état d'UI : c'est l'absence de surface d'écriture *plus* le backend qui refuse de toute façon (RLS C12-f) — défense en profondeur, pas drapeau.
- **`role_lien` (C12-g) informe, n'active pas.** L'écran affiche « vous suivez en spectateur » de façon lisible (SUIVI-UI-6 livrée) ; il ne *déduit pas* le mode par échec d'écriture, ne masque pas des boutons selon un drapeau. Exactement ce que la spec exige (anti « deviner par échec », anti « drapeau d'URL fragile »).
- **Cohérent décision d'archi `SUIVI-COACH-2`** (volet jeton rejeté pour escalade spectateur→rédacteur) : le spectateur ne voit jamais le jeton `saisie`, C-2 ne connaît que son jeton spectateur dans l'URL.
- **Précédent B-Q1** (écran distinct, fichier nouveau — confirmé par la livraison réelle d'Objet B : `mode-video.html` fichier distinct) et **intangible carte d'ouverture §6** (`suivi.html` non retouché logiquement — confirmé : la livraison Objet B n'a pas touché le module bénévole).

**Écarté : `suivi.html` en « mode lecture seule » piloté par le rôle du jeton** (un seul fichier qui masque les surfaces d'écriture si spectateur). C'est précisément l'anti-pattern « mode d'UI fragile » que S-5.1.a interdit, et ça toucherait le module bénévole intangible. Rejeté, pas à reconsidérer.

## 2 · C2-Q2 — Surface de lecture (contenu, score, cycle de vie)

S-5.1.b fixe le cadre (score/chrono/fil en lecture ; pas de palette/⚙/bascule ; refresh ~10 s ; payload réduit RGPD). C2-Q2 tranche les **4 détails ouverts** :

1. **Source du score = la chronologie lue, jamais la photo `evenements`.** Score affiché = `SUM(valeur_points)` **calculé côté client** sur la chronologie du refresh (pattern « En cours », I1). Raison dure : avant clôture la photo `evenements` n'existe pas encore (consolidée seulement à « Fin du match », S-4.2.a) ; après clôture la chronologie reste la vérité (un correctif Mode Vidéo se reflète par la donnée). Une seule source cohérente à tout instant. Aucune RPC « score consolidé en lecture » à inventer.
2. **Le fil = le récit *effectif*, pas la tuyauterie.** Lignes **annulées non affichées** ; lignes **corrigées affichées à leur valeur courante** (`corriger_observable` mute en place, la valeur courante *est* la vérité). Le bénévole voit la tuyauterie d'annulation parce qu'il agit dessus ; le spectateur a zéro écriture → aucune raison de lui montrer des essais barrés / du bookkeeping (bruit contraire au fil minimal S-5.1.b, anxiogène en tribune). Le score (SUM hors annulées) reste automatiquement cohérent avec le fil. *(Réconciliation §0bis pt 2 : C12-d expose `p_inclure_annulees` — le masquage des annulées est réalisable côté RPC, le filtrage client n'est qu'un confort.)*
3. **Pas de marqueur de provenance `source_saisie`.** B-Q2(a) a rendu la provenance live/vidéo visible *pour le coach* (besoin de complétion ; confirmé par la livraison Objet B `mode-video.js` v0.1 : une seule liste + provenance par ligne). Le spectateur ne complète rien → marqueur = bruit hors S-5.1.b. Fil spectateur = récit propre, sans provenance. (Frontière confirmée avec B-Q6.)
4. **Cycle de vie honnête — jamais d'écran cassé** (miroir lecture du principe A-Q2) :
   - *Pas commencé* (chronologie vide) → message d'attente honnête « le match n'a pas encore commencé ». **Pas** le tampon bénévole (aucun bouton, aucun « Coup d'envoi » — ni le persona ni le rôle).
   - *En cours* → score calculé + chrono + fil, refresh ~10 s.
   - *Terminé* → « Match terminé » + score/fil ; refresh **ralenti/arrêté** + bouton « Rafraîchir » manuel (sert le rationnel « ménage le réseau / persona réseau instable » déjà écrit S-5.1.b).
   - *Lien expiré/révoqué* (J+1 modélisation ; ou régénéré côté A-Q2 état 3) → message honnête « ce lien n'est plus actif », jamais un écran vide.
5. **RGPD inchangé** — payload réduit identique (numéro + nom court ; `libelleJoueur()` dégrade proprement si `nom_court` NULL, dette `C12-nom` non câblée, numéro = ancre). Réaffirmé, pas re-décidé.

## 3 · C2-Q3 — Relation C-2 ↔ Objet A (= C-Q4)

**Décision : A génère, C-2 ouvre. Le lien spectateur n'est ni re-conçu ni re-généré ici, et Objet A n'est pas retouché dans ce document.**

Partage des rôles, sans recouvrement :

- **Backend** (déployé, intangible) : `generer_lien_ephemere` (C12-f) produit **déjà** le lien spectateur distinct sécurisé (jeton sans droit d'écriture, RLS C12-f) ; rôle lisible via `role_lien` (C12-g). Acquis, rien à concevoir.
- **Objet A** : A-Q4 a tranché — la section « Suivi de la rencontre » n'expose que le lien de saisie pour l'instant ; l'exposition du lien spectateur est une **évolution tracée de cette même section** (état 3 enrichi), conditionnée à la réalisabilité de C-2, *« pas un nouvel objet »*.
- **C-2** (conçu ici) : la **destination** de ce lien.

**Ce que C2-Q3 acte :** la condition qu'A-Q4 attendait (« quand C-2 sera réellement réalisable ») est désormais **remplie** (C-2 conçu C2-Q1/Q2 ; verrou SUIVI-UI-6 tombé). L'évolution A-Q4 « exposer le lien spectateur dans l'état 3 de la section » est donc **débloquée** — mais :

> **Cette évolution n'est PAS produite ni re-conçue ici.** C'est une **retouche d'`evenements-browser.js`** (état 3 d'Objet A : afficher aussi le lien spectateur + copier/partager, même libellé honnête que le lien saisie ; en tournoi, un lien spectateur par match enfant dans la structure — réutilise A-Q3, jamais à plat). Elle se tranche **en conv Production**, sur le **modèle exact SUIVI-COACH-2 / B-Q1** : alimentation/extension amont, vérification d'intégrité, **zéro retouche de la logique d'Objet A**. *Précédent désormais éprouvé : la livraison Objet B a ajouté l'accroche « Revoir ce match » dans `evenements-browser.js` v1.10 en **addition pure prouvée** (diff = 1 ligne de header de version) — c'est exactement le modèle que la future retouche lien spectateur suivra.* La conception (ici) *spécifie* que l'état 3 gagne le lien spectateur quand C-2 est livré ; elle ne touche pas le fichier. **Aucune dette backend** (le lien existe déjà côté C12-f).

Frontière dure confirmée : aucune génération de lien dans C-2, aucune logique de rôle de jeton conçue dans C-2 (l'écran *affiche honnêtement* « spectateur » via `role_lien`, il ne *décide* rien). C-2 ne connaît qu'un jeton dans l'URL et la RPC de lecture. Symétrie exacte avec B-Q6 (B n'empiète pas sur C-2 ; C-2 n'empiète pas sur A).

### Synthèse C-2

```
OBJET C-2 — Écran spectateur (lecture seule distincte)
═══════════════════════════════════════════════════════
✅ C2-Q1 — fichier distinct dédié ; réutilise le rendu
   lecture de suivi.html (score Zone A, chrono, fil
   Zone E) ; ZÉRO surface d'écriture ; role_lien =
   informe, n'active pas. suivi.html non retouché.
   Lit C12-d voie jeton spectateur (confirmé source).
✅ C2-Q2 — score = SUM client de la chronologie lue
   (jamais la photo) ; fil = récit effectif (annulées
   masquées via p_inclure_annulees C12-d, corrigées à
   valeur courante) ; pas de marqueur source_saisie ;
   4 états de cycle de vie honnêtes ; payload réduit
   RGPD inchangé.
✅ C2-Q3 — A génère / C-2 ouvre ; évolution A-Q4
   débloquée mais NON produite ici (retouche
   evenements-browser.js = conv Production, modèle
   SUIVI-COACH-2 / addition pure éprouvée v1.10).
```

---

# PARTIE II — C-1 · Temps de jeu (panneau d'estimation coach)

> Traité en second. Fond tranché S-5.4 : panneau de consultation côté coach, estimation dérivée des remplacements, honnêteté épistémique, **jamais donnée d'autorité**, jamais une saisie. Non réinventé.

## 4 · C1-Q1 — Où vit C-1 ? (= C-Q1)

**Le point était réellement rouvert :** le cadrage du cycle §4 disait « panneau dans B et/ou fiche événement », mais B-Q5 a exclu le temps de jeu de B (« porte ouverte côté C, fermée côté B »). La place de C-1 n'était plus présumée.

**Décision : C-1 vit comme un panneau de consultation dans la section « Suivi de la rencontre » de la fiche événement (Objet A), affiché une fois la rencontre jouée — *pas* dans l'écran B, *pas* dans un écran distinct, *pas* dans `suivi.html`, *pas* exposé au spectateur. Coach only.**

Justification, par ordre de poids :

- **B-Q5 a désigné la direction sans la fermer.** Sa note d'articulation pour le cycle C : C-1 pourra être *« présenté à proximité (fiche événement ou adjacent) sans être bâti dans l'écran de correction de B »*. C1-Q1 tranche cette porte : fiche événement, pas adjacent flou, pas dans B. *(Confirmé par la livraison Objet B : `mode-video.js` v0.1 ne porte aucun panneau temps de jeu — l'exclusion B-Q5 a bien été tenue en Production.)*
- **Un seul lieu Suivi côté coach (cohérence A-Q1 / B-Q1).** A a établi la section « Suivi de la rencontre » comme LE lieu Suivi ; B-Q1 s'y est rattaché plutôt que créer un second point d'entrée (confirmé : accroche « Revoir ce match » ajoutée dans cette section, `evenements-browser.js` v1.10). C-1 suit la même discipline (phase aval, rencontre jouée). Trois lieux Suivi = la friction que A-Q1 et B-Q1 ont refusée.
- **Nature = consultation, pas surface de travail.** C-2 méritait un fichier distinct (persona/auth spectateur) ; B méritait un fichier distinct (plan de travail desktop, écriture — confirmé : `mode-video.html`). C-1 n'est ni l'un ni l'autre : un petit panneau de lecture pour le coach déjà authentifié sur sa fiche. Lui dédier un écran = sur-ingénierie que P1 refuse (réflexe « caser le bouton dans un écran » déjà écarté S-3.4.d).
- **Cohérent C-2.** C-2 = surface spectateur (lien éphémère). C-1 = lecture coach authentifié (accès Hub). S-5.4 dit « accès Hub ou lien lecture seule » → tranché : **accès Hub via la fiche événement**, le plus simple et le plus cohérent avec le reste du cycle.

**Écarté :** dans l'écran B (B-Q5 l'a déjà tranché, livraison Objet B le confirme) ; écran distinct dédié (sur-ingénierie, contraire P1) ; dans `suivi.html` / visible au bénévole en live (sorti dès S-3.4.d ; `suivi.html` intangible) ; exposé au spectateur C-2 (une estimation non fiable n'a rien sur l'écran public ; incohérent avec « jamais donnée d'autorité »).

> **Articulation tracée (pas une retouche ici, modèle SUIVI-COACH-2 — cohérent C2-Q3).** Loger C-1 dans la section signifie qu'elle gagne, en phase aval, **un panneau de consultation temps de jeu** (en plus de l'accroche Mode Vidéo B-Q1 *déjà livrée* et du lien spectateur C2-Q3 *à venir*). Retouche d'`evenements-browser.js` tranchée **en conv Production**, vérification d'intégrité, **zéro retouche de la logique d'Objet A** (modèle de l'addition pure prouvée v1.10). La section Objet A devient le point d'agrégation aval cohérent du cycle coach (accroche B livrée + lien spectateur + panneau temps de jeu) — **évolution unique et cohérente d'une même section**, pas trois greffes éparses.

## 5 · C1-Q2 — Forme de l'estimation (= C-Q2)

**Décision : estimation *par joueur* (minutes estimées sur la rencontre), agrégée simplement, sous un libellé d'incertitude explicite et permanent — pas de découpage par période, pas de précision à la minute affichée comme exacte.**

1. **Granularité = par joueur, sur la rencontre entière.** Seule granularité qui sert l'usage S-5.4 (rotation pendant, récap après) : *qui a peu/beaucoup joué*. Découpage par période **écarté** : multiplie l'affichage, suggère une précision absente (un remplacement non saisi fausse déjà le total), alourdit un panneau qui doit rester un coup d'œil. P1 : le minimum qui sert la décision.
2. **Calcul = dérivé des entrées/sorties, borné par le chrono.** Temps estimé = somme des intervalles [entrée → sortie] déduits des remplacements de `chronologie_suivi` ; titulaire = « entré au coup d'envoi » ; joueur encore en jeu = « sorti à l'instant courant » (live) ou « à la fin » (terminé). Aucune saisie, aucune RPC nouvelle : **lecture de la chronologie déjà disponible** — voie coach authentifié = `get_chronologie_rencontre_coach` (C12-k, **livré**, payload contrat-identique C12-d 15 colonnes). Calcul côté client. Strictement parallèle au score (calculé, jamais saisi — I1).
3. **Présentation = liste sobre, valeur arrondie, incertitude permanente.** Liste joueur → minutes estimées, lisible d'un coup d'œil. **Arrondi assumé** (« ~38 min », pas « 38:12 » — afficher des secondes mentirait sur la précision). **Libellé d'incertitude permanent et non refermable** en tête : *« Estimation basée sur les remplacements saisis — peut être incomplète si un remplacement n'a pas été noté »*. Constitutif de l'affichage, pas un disclaimer optionnel (S-5.4 honnêteté épistémique ; cohérent D-5 / S-3.1.b).
4. **Statut visuel = aide consultable, pas tableau de bord.** Panneau **discret et replié par défaut** (même patron que ⚙ chrono S-2.3 / aperçu compo AV-2 — motif éprouvé du projet), ouvrable à la demande. Raison dure S-5.4 : en faire une fonctionnalité de premier plan = construire sur du sable (V6, refusé). Le repli **matérialise** le statut d'estimation secondaire — la forme dit la fiabilité.

**Écarté :** découpage par période (fausse précision) ; affichage à la seconde / barre « officielle » (autorité interdite S-5.4) ; panneau proéminent par défaut (contraire S-5.4) ; alimenter une alerte automatique (S-5.4 l'exclut nommément ; C-1 informe, ne décide jamais à la place du coach — cohérent P4).

> **Cohérence H-1 rappelée (pas une dette).** S-6.2 a inscrit H-1 : la fiabilité de saisie des remplacements sur une saison conditionnera le statut futur du temps de jeu (estimation → éventuellement donnée fiable). C1-Q2 ne tranche pas H-1 : il conçoit la V1 *en estimation honnête* (« V1 = hypothèse, le terrain juge » — P3). Rien à rouvrir.

## 6 · C1-Q3 — Frontière calcul/lecture + cycle de vie

**Décision : C-1 est en lecture pure, sans aucune écriture ni RPC propre, et se comporte honnêtement sur tout le cycle de vie — exactement parallèle au score (calculé, jamais saisi).**

1. **Frontière dure : zéro écriture, aucune RPC propre.** C-1 ne crée, ne corrige, n'annule aucune ligne. Il **lit** la chronologie (voie coach authentifié = `get_chronologie_rencontre_coach` / C12-k, **déjà livré, à consommer tel quel** — aucune RPC à concevoir) et **calcule côté client**. Pas de RPC « temps de jeu », pas de champ persisté, **jamais consolidé nulle part** (à la différence du score, qui a une photo `evenements` à la clôture). Raison dure S-5.4 : une estimation non fiable ne mérite pas d'être figée comme une vérité — la garder volatile (recalculée à l'affichage) **est** la traduction technique de « jamais donnée d'autorité ». Aucune dette backend de ce fait.
2. **Frontière QUOI/POURQUOI préservée.** C-1 affiche un fait dérivé (minutes estimées), aucune interprétation (« il a trop joué », « rotation déséquilibrée » = analyse → le **Rapport**, module aval distinct). Aucun champ commentaire. Cohérent S-5.3.c / B-Q2(c) (frontière dure QUOI tenue en Production sur Objet B : zéro champ analyse dans `mode-video.js` v0.1).
3. **Cycle de vie — honnête à chaque état** (miroir lecture du principe A-Q2 ; cohérent C2-Q2 point 4) :
   - *Pas commencé* (chronologie vide) → panneau **non proposé** (rien à estimer ; pas de panneau vide trompeur).
   - *En cours* → estimations « à l'instant » (joueurs encore en jeu comptés jusqu'au temps courant), recalculées à l'ouverture/refresh. Le libellé C1-Q2 porte aussi la nature « provisoire ».
   - *Terminé* → estimations finales ; recalculées si un correctif Mode Vidéo (Objet B) modifie un remplacement *tant que* `evenement.etat` ≠ `archive`. C-1 **ne re-consolide rien** (rien à consolider) : il reflète la chronologie courante à chaque lecture (cohérent B-Q3 : le score a un geste explicite « Terminer la revue vidéo » livré dans `mode-video.js` v0.1 ; le temps de jeu non, car pas de photo).
   - *Archivé* (`evenement.etat = archive`) → chronologie figée → estimation figée de fait, sans mécanique spéciale.
4. **Cohérence interconnexion.** C-1 lit le Core, point. Ne parle ni à B ni à C-2 ni à Compositions (PI-1 : aucun couplage direct ; tout passe par la donnée). Un correctif B se reflète dans C-1 *parce que B a écrit dans le Core* — raisonnement B-Q6 appliqué en miroir, désormais concret (Objet B écrit via C12-j ; C-1 relit via C12-k ; aucun lien direct C-1↔B).

### Synthèse C-1

```
OBJET C-1 — Temps de jeu (panneau d'estimation coach)
═══════════════════════════════════════════════════════
✅ C1-Q1 — panneau de consultation dans la section
   « Suivi de la rencontre » (fiche événement, Objet A),
   phase aval ; PAS dans B (B-Q5, confirmé livraison),
   PAS écran distinct, PAS suivi.html, PAS exposé au
   spectateur. Coach only.
✅ C1-Q2 — estimation PAR JOUEUR sur la rencontre,
   arrondie, libellé d'incertitude permanent constitutif,
   panneau replié par défaut (la forme dit la fiabilité).
   Lecture via C12-k (déjà livré), calcul client.
✅ C1-Q3 — lecture pure (zéro écriture, aucune RPC
   propre — consomme C12-k existant ; jamais consolidé) ;
   frontière QUOI/POURQUOI ; 4 états de cycle de vie
   honnêtes ; reflète le Core, zéro couplage module→
   module.
```

---

## 7 · Synthèse Objet C & dépendances

**Les 5 points d'articulation de la carte d'ouverture (§4) — tous résolus, aucun inventé :**

| Point | Question | Tranché par | Décision |
|---|---|---|---|
| **C-Q5** | Ordre de traitement | Ouverture de conv | C-2 d'abord, puis C-1 (le plus contraint d'abord = moins de risque d'invention ; destination du lien A ; valeur concrète) |
| **C-Q3** | Quel dérivé de `suivi.html` pour C-2 | C2-Q1 + C2-Q2 | Fichier distinct, rendu lecture réutilisé, zéro surface d'écriture ; score = SUM client ; récit effectif (annulées masquées via `p_inclure_annulees`) ; payload réduit ; lit C12-d voie jeton spectateur |
| **C-Q4** | Relation C-2 ↔ Objet A | C2-Q3 | A génère / C-2 ouvre ; évolution A-Q4 débloquée mais retouche `evenements-browser.js` = Production (modèle SUIVI-COACH-2 / addition pure éprouvée v1.10) ; zéro retouche A ici |
| **C-Q1** | Où vit C-1 | C1-Q1 | Panneau de consultation dans la section « Suivi de la rencontre » (fiche événement) ; pas dans B (confirmé livraison B), pas écran distinct |
| **C-Q2** | Forme de l'estimation C-1 | C1-Q2 | Par joueur, arrondie, libellé d'incertitude permanent constitutif, panneau replié par défaut ; lecture via C12-k livré |

**RÉSERVE PRODUCTION — unique, isolée, tracée, RÉDUITE (non bloquante) — `SUIVI-COACH-6` :**

```
• SUIVI-COACH-6 — vérification résiduelle C12-d/C12-k pour C-1.
  Contexte : la conv Production (Objet B) a vérifié C12-d à la
  source et livré C12-k (get_chronologie_rencontre_coach,
  payload contrat-identique 15 colonnes, p_inclure_annulees).
  → Points 1 (jeton spectateur C-2) et 2 (annule/corrigee)
    de la réserve initiale : LEVÉS à la source par ce travail.
  → Point résiduel SEUL : confirmer que les 15 colonnes du
    payload C12-d/C12-k portent de quoi reconstituer
    entrée/sortie des remplacements (joueur entrant, joueur
    sortant, horodatage de la ligne) pour le calcul temps de
    jeu C-1. À vérifier à la source `sql/` C12-d/C12-k en
    conv Production AVANT spec fine de C-1.
  Issues :
   - champs présents → C-1 calcule côté client tel quel,
     AUCUNE dette, consomme C12-k (déjà livré) ;
   - champs absents/insuffisants → le calcul s'appuie sur
     ce qui est exposé OU dette backend conditionnelle
     (pattern C12-i/C12-k ; ajout pur, jamais C12-d modifié).
  Renommée SUIVI-COACH-4 → SUIVI-COACH-6 (collision : la
  conv Production a consommé SUIVI-COACH-4 pour C12-k).
  Modèle exact des réserves C12-gate (Objet A) et C12-c
  (Objet B, désormais levée par C12-j) : non conçue ici,
  non présumée tombée, PAS un blocage de conception.
```

**Dépendances non bloquantes déjà tracées ailleurs (rappel, pas rouvertes ici) :**

- **C12-gate** (conv Audits) — seuil exact « rencontre jouée » (états `evenements`) : conditionne *quand* le panneau C-1 et l'accroche apparaissent ; le comportement est conçu, le seuil s'y alignera (même posture qu'A-Q2 / B-Q1, livraison B confirme l'alignement conservateur).
- **C12-nom** (conv Production) — câblage `chronologie_nom_court_personne` : `libelleJoueur()` dégrade déjà proprement (numéro = ancre). Inchangé.

**INTANGIBLES RESPECTÉS :**

- `suivi.html` / module bénévole : **non touché** (invariant sans-login intangible, carte d'ouverture §6 ; confirmé : la livraison Objet B ne l'a pas touché).
- Objet A : la conception **spécifie** (évolution A-Q4 débloquée + panneau C-1 + accroche), retouche `evenements-browser.js` tranchée **en conv Production** (modèle SUIVI-COACH-2 / addition pure prouvée v1.10, zéro retouche logique d'A). **Zéro retouche A ici.**
- Objet B : **non touché** (B-Q5 / B-Q6 symétriques) ; livré en Production, ne télescope pas Objet C (surfaces distinctes).
- Backend : **aucun nouveau backend conçu** ; réserve `SUIVI-COACH-6` tracée comme conditionnelle et réduite (C12-k déjà livré couvre la lecture coach).
- Frontière dure **QUOI** : aucune analyse (C-1 et C-2 sont en lecture/consultation ; l'analyse = le Rapport).
- H-1 : V1 = estimation honnête (P3) ; statut futur reste une hypothèse à valider, pas tranché ici.

**État du cycle `SUIVI-COACH-1` : A livré · B LIVRÉ (Mode Vidéo opérationnel, conv Production 17/05) · C conçu/validé (C-1 + C-2) → CONCEPTUELLEMENT COMPLET.**

**Prochaines étapes (hors de ce document) :**

1. **Validation pas-à-pas Manu** — ✅ FAIT (17/05/2026, micro-étape par micro-étape) ; réconciliation soir ✅ validée (code `SUIVI-COACH-6`, réémission complète).
2. **Dépôt Drive** — ce document (version réconciliée) en `00 - Documentation/`, au même rang que `…-ObjetA.md` / `…-ObjetB.md`.
3. **MAJ `STATE.md`** — acter Objet C conçu, cycle conceptuellement complet, réserve `SUIVI-COACH-6` enregistrée, divergence stand-by réconciliée. *(Repartir de la version Drive vivante la plus récente — modifiedTime à revérifier juste avant.)*
4. **MAJ `CARTE-CONVERSATIONS-MOM-Hub.md`** — ligne Conception : Objet C conçu.
5. **Message de passation** conv `Conception` → conv `Production` Objet C.
6. **conv Production (Objet C)** — quand priorisé : (a) vérifier `SUIVI-COACH-6` à la source (granularité colonnes C12-d/C12-k pour le calcul temps de jeu) ; (b) coder C-2 (fichier distinct lecture seule, lit C12-d voie jeton spectateur) et le panneau C-1 (lit C12-k voie coach authentifié, déjà livré) ; (c) spécifier en Production la retouche d'accroche dans `evenements-browser.js` (section Suivi : lien spectateur état 3 + panneau temps de jeu), modèle SUIVI-COACH-2 / addition pure prouvée.
7. **conv Audits** — C12-gate (seuil états `evenements`) à instruire pour lever la dépendance non bloquante.

---

*Conception `SUIVI-COACH-1` Objet C · MOM Hub · conv Conception · 17 mai 2026 (version réconciliée, soir)*
*6 décisions tranchées pas-à-pas (C2-Q1/Q2/Q3 puis C1-Q1/Q2/Q3), aucune invalidée par la réconciliation. Fond S-5.1 / S-5.4 vérifié à la source, non réinventé. 5 points d'articulation de la carte d'ouverture tous résolus. Réconciliation §0bis (§4 bis r.9) : divergence STATE pendant stand-by signalée non écrasée ; Objet B livré en Production ne télescope pas Objet C ; réserve renommée `SUIVI-COACH-4`→`SUIVI-COACH-6` (collision, code 4 consommé par C12-k Production) et RÉDUITE (points jeton-spectateur + annule/corrigee levés à la source par la vérif C12-d de Production ; reste le seul point granularité colonnes pour C-1) ; C-1 lecture coach = C12-k déjà livré (zéro RPC à concevoir). Objet A / Objet B / module bénévole / backend intangibles respectés. VALIDÉ par Manu (validation pas-à-pas + réconciliation soir, 17/05/2026) — document de référence, prêt pour dépôt Drive. Cycle `SUIVI-COACH-1` conceptuellement complet (A livré, B LIVRÉ, C conçu).*
