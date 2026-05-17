# Conception UX — `SUIVI-COACH-1` · Objet B — Mode Vidéo (saisie coach a posteriori)

*Document de design · Conv « Conception » · 17 mai 2026*
*Cycle de conception détaillé. Fait suite au `Cadrage-SUIVI-COACH-1.md` (carte de cycle) et à `Conception-SUIVI-COACH-1-ObjetA.md` (Objet A, livré). Sœur de ces deux documents.*

> **Statut : VALIDÉ par Manu (17/05/2026), validation groupée sur le document complet.** Décisions tranchées d'un trait (B-Q5 → B-Q6 → B-Q1 → B-Q2 → B-Q4 → B-Q3). Document de référence du cycle, au même rang que `Conception-SUIVI-COACH-1-ObjetA.md`. Prêt pour dépôt Drive `00 - Documentation/`.

---

## 0 · Statut et périmètre

Objet B = **le Mode Vidéo** : le coach authentifié, au calme, devant la vidéo du match, **complète et corrige a posteriori le QUOI factuel** de la chronologie saisie en live par le bénévole. C'est le cœur de valeur côté coach du cycle (analyse a posteriori sereine), mais il s'appuie sur un socle entièrement en place — l'enjeu est qu'il soit conçu juste, pas vite.

**Conception de fond déjà tranchée par la spec** `Conception-Portail-UI-Suivi.md` (S-5.3 Mode Vidéo, S-5.4 temps de jeu, S-5.1 spectateur), **vérifiée à la source** en ouverture de conv. Ce document **ne réinvente pas le fond** : il tranche l'articulation et le détail UX d'Objet B (B-Qx), pas la doctrine S-5.3.

**Contraintes dures de l'existant (STATE de référence du 17/05 13:37, vérifiées) :**

- Mode Vidéo = **anti-écran-live** (S-5.3) : coach / desktop / tablette / calme / temps disponible. Les contraintes ergonomiques du live (gros boutons, zone pouce, une main, pluie) **ne s'appliquent pas**.
- Auth = **coach authentifié sur le Hub**, pas de lien éphémère (S-5.3). Observables portés : `saisi_par_role='coach'`, `source_saisie='video'`, `timecode_video` renseigné (S-5.3.a, modélisation §6.2 — signature déployée à confirmer en Production).
- **Backend du cycle entièrement tombé.** C12-a→f + C12-g/h/i exécutés/committés. **SUIVI-UI-5 livrée** : la fonction 2-arg de `consolider_score_rencontre` (`p_token` NULL) **couvre déjà** la consolidation côté coach authentifié — corollaire tracé au STATE : *Objet B n'a rien à ajouter côté backend pour la re-consolidation*.
- **SUIVI-UI-4 ouverte, non bloquante** : le mécanisme Normal/Expert (`mode_saisie`/`modeSaisie` par ligne, zéro migration) est livré ; le **contenu de la palette Cat B n'est pas spécifié** (suggestions par catégorie d'âge dans `observables-match.json`, conv Audits/Référentiels). Référentiel `observables-match.json` v1.1 = **13 observables Cat A** figés et vérifiés ; aucun observable « coup d'envoi »/période.
- Objet A intangible : section « Suivi de la rencontre » sur la fiche événement, 3 états adaptatifs, match/tournoi only, hors `suivi.html`, hors `index.html` (`evenements-browser.js` v1.8 / `supabase-client.js` v1.13 au STATE).
- États `evenements` réels : `creation|compo|joue|resultat|archive|annule` (pas d'état `termine` ; seuil exact = dette **C12-gate**, conv Audits). Corrections possibles **tant que `evenement.etat` n'est pas `archive`** (S-5.3.a, modélisation §8.4).

**Divergence Q0 — réconciliation, neutralisée pour B.** Le cadrage Objet B (§1/§5) annonçait Objet A en v1.14/v1.9 avec un wrapper frontend `getLienSaisieActif` (C12-h) ; le STATE (qui fait foi) acte C12-h **backend seul** (`sql/C12-h`) et Objet A inchangé (v1.13/v1.8, « aucune retouche logique d'Objet A »). **Cette divergence ne touche pas Objet B** : C12-h sert la persistance de l'état 3 d'*Objet A* (le lien *saisie* du bénévole). Objet B est coach authentifié, possède l'`evenement_uuid` via le Hub, et n'a **aucun usage de `getLienSaisieActif`**. Objet B est donc conçu pour **ne dépendre de C12-h ni dans un sens ni dans l'autre**. La version réelle d'`evenements-browser.js` reste une vérification d'hygiène STATE au moment de spécifier l'accroche (B-Q1), pas une porte d'entrée.

**Aucune dépendance backend bloquante.** Objet B est cadrable et codable maintenant (sous réserve de la vérification source C12-c, §B-Q2, qui n'est pas un blocage de conception mais un point Production tracé).

---

## 1 · B-Q5 — Périmètre : le temps de jeu (S-5.4) n'appartient PAS à Objet B

**Décision : Objet B exclut le temps de jeu. Le panneau d'estimation S-5.4 relève strictement d'Objet C (C-1), cycle suivant.**

Périmètre d'Objet B en une phrase : *le coach authentifié, au calme devant la vidéo, complète et corrige le QUOI factuel de la chronologie a posteriori* — rien d'autre.

Justification :

- Le STATE qualifie S-5.4 de « conceptuellement proche de B mais objet distinct, à ne pas absorber sans décision ». La décision explicite que B-Q5 exige est prise : une **exclusion**, pas une absorption silencieuse.
- **Nature différente.** Le Mode Vidéo est une surface de saisie/correction (écrire des lignes `chronologie_suivi`). Le temps de jeu est un **dérivé en lecture** calculé des remplacements, présenté en estimation honnête, jamais une donnée d'autorité (S-5.4). Mêler une surface de correction et un panneau de consultation brouille le mandat « QUOI net » de B et ajoute une complexité que la doctrine de simplicité refuse.
- **Frontière QUOI/POURQUOI préservée.** B enrichit le factuel ; il ne glisse pas vers un tableau de bord dérivé.

Écarté : « panneau temps de jeu logé dans B » (option laissée ouverte par le cadrage du cycle §4 : « dans B et/ou fiche événement »). Tranché : *pas* dans B.

> **Note d'articulation pour le cycle C (pas une décision de B, tracée pour ne pas la perdre).** Le coach en Mode Vidéo est déjà dans un contexte post-match authentifié ; quand C-1 sera conçu, il pourra être *présenté à proximité* (fiche événement ou adjacent) sans être *bâti dans* l'écran de correction de B. Porte ouverte côté C, fermée côté B.

---

## 2 · B-Q6 — Frontière : Objet B n'empiète pas sur l'écran spectateur (Objet C-2)

**Décision : la conception d'Objet B ne touche en rien l'écran spectateur. C-2 reste un objet distinct, hors de cette conv. Aucune surface lecture-seule spectateur, aucune exposition/génération de lien spectateur, aucune logique de rôle de jeton dans B.**

La frontière est déjà tracée par l'architecture ; B-Q6 ne fait que la confirmer :

- **Surfaces opposées.** Objet B = surface d'**écriture** authentifiée. C-2 = surface de **lecture seule** (S-5.1 : `get_chronologie_rencontre`, aucune RPC d'écriture, refresh ~10 s, payload réduit RGPD). Personas distincts, auth distincte. Zéro recouvrement par construction.
- **Le lien spectateur n'est pas le sujet de B.** Son exposition est déjà cadrée en A-Q4 (Objet A) comme « évolution tracée », conditionnée à la réalisabilité de C-2. B ne génère ni n'expose ce lien.
- **C-2 débloqué backend ≠ C-2 dans cette conv.** SUIVI-UI-6 livrée (`role_lien` piggy-back C12-g) débloque C-2 côté backend, mais le cadrage Objet B le dit : C-2 « hors de ce cycle-ci ».

> **Point à ne pas confondre avec un empiètement.** Quand B re-consolidera le score (B-Q3) et écrira ses corrections dans le Core, un futur écran spectateur lisant `get_chronologie_rencontre` verra ces corrections. **Ce n'est pas B qui touche C-2** : l'information remonte *par la donnée* via le Core (PI-1, pas de couplage direct module→module). B écrit dans le Core ; tout ce qui lit le Core en bénéficie. La doctrine, pas une violation.

Écarté : toute vue « aperçu spectateur » dans B, toute anticipation de C-2.

---

## 3 · B-Q1 — Point d'entrée : continuation adaptative de la section « Suivi de la rencontre »

**Décision : le point d'entrée d'Objet B est un accès dédié au sein de la section « Suivi de la rencontre » existante d'Objet A, sur la fiche événement. Il apparaît comme un état/extension supplémentaire de la logique adaptative de cette section une fois la rencontre jouée (et non archivée), et ouvre l'écran Mode Vidéo dans un fichier distinct.**

Justification :

- **Un seul endroit Suivi côté coach.** Objet A a établi la section « Suivi de la rencontre » comme LE lieu Suivi sur la fiche événement (A-Q1 : section dédiée, match/tournoi only, P7 — se manifeste quand pertinente). Un second point d'entrée Mode Vidéo ailleurs créerait une incohérence et de la friction. Objet B s'ajoute comme **continuation naturelle de la logique adaptative à 3 états d'Objet A** : là où A gère « compo pas prête / compo prête / lien actif » (phase amont/live), B ajoute la phase aval « rencontre jouée → Revoir / compléter ce match (Mode Vidéo) ».
- **Écran distinct, fichier nouveau (cadrage du cycle §4).** L'accès dans la section est le **déclencheur** ; le clic ouvre une **page Mode Vidéo dédiée** (desktop/tablette, anti-écran-live), *pas* un dépliement inline dans la fiche. La section porte le bouton, l'écran B est un fichier séparé. Conforme : « ni `suivi.html`, ni une simple section d'Évènements ».
- **Objet A intangible — la conception spécifie, ne retouche pas.** L'accroche (un accès dans la section, conditionné à l'état « rencontre jouée et non archivée ») est *spécifiée* ici. La modification effective d'`evenements-browser.js` se tranche en **conv Production**, avec vérification d'intégrité, sur le modèle SUIVI-COACH-2 (alimentation amont, zéro retouche logique). Aucune retouche Objet A dans ce document.
- **Seuil d'apparition aligné, pas inventé.** L'accès est visible quand la rencontre est jouée et `etat` ≠ `archive`/`annule`. Le **seuil exact** s'aligne sur ce que la conv Audits tranchera (dette **C12-gate**, états `evenements`), exactement comme A-Q2 conçoit le comportement et laisse le seuil s'aligner. Pas de seuil arbitraire codé.
- **Q0 neutralisé ici.** L'apparition de l'accès dépend de l'**état de la rencontre** (lisible par Évènements), pas de `getLienSaisieActif` (C12-h). La divergence v1.8/v1.9 n'a aucune incidence sur B-Q1.
- **Tournoi.** Cohérent A-Q3 : la structure tournoi→matchs enfants étant déjà affichée, l'accès Mode Vidéo suit la même hiérarchie (un accès par match enfant joué). Pattern réutilisé, structure non réinventée.

Écarté :
- *Point d'entrée distinct hors section Suivi* : créerait un deuxième endroit Suivi côté coach, contredit A-Q1 (incohérence, friction).
- *Dépliement inline du Mode Vidéo dans la fiche* : contredit le cadrage §4 (« écran distinct, nouveau fichier ») ; l'ergonomie desktop calme de B ne tient pas dans une section de fiche.

---

## 4 · B-Q2 — Relation au live bénévole : une seule chronologie, provenance lisible, le coach corrige

S-5.3.a tranche **déjà le principe** (le coach complète ET corrige, y compris des observables bénévole — l'exemple canonique « Équipe / je ne sais pas » → « essai de SCHIMPF » EST une correction de ligne bénévole ; jamais supprimer la trace). B-Q2 conçoit la présentation et borne la vérification source.

**Décision :**

- **(a) Une seule chronologie, provenance visible par ligne.** L'écran B affiche la chronologie complète, live bénévole + vidéo coach **mélangés dans l'ordre temporel** — c'est UNE `chronologie_suivi`, pas deux. Chaque ligne porte une marque **discrète** de provenance via `source_saisie` (live terrain vs vidéo coach). **Jamais deux listes séparées** (ce serait une fiction : la modélisation crée une seule chronologie ; `saisi_par_role`/`source_saisie` sont des attributs de ligne). Le coach a besoin de voir ce qui vient du terrain vs ce qu'il a ajouté/corrigé au calme pour savoir où en est son travail de complétion. Cohérent I1 (l'historique est un citoyen de premier rang).
- **(b) Le coach corrige un observable bénévole, pas seulement ajoute les siens.** Réattribution via `corriger_observable` (sans perte de trace, `corrigee_le` horodaté — modélisation §6.2). Annulation d'un observable manifestement erroné via `annuler_observable` (`annule=TRUE`, ligne **jamais supprimée**, exclue du score recalculé). **Jamais de DELETE** (S-5.3.a). Complétion = nouvelles lignes `source_saisie='video'`, `timecode_video` renseigné. La traçabilité `saisi_par`/`saisi_par_role` est préservée à travers live et vidéo.
- **(c) Frontière dure QUOI/POURQUOI maintenue (S-5.3.c).** Le coach corrige/complète des **faits**. **Aucun champ commentaire, aucune note d'analyse, aucun « pourquoi »** dans l'écran B. Si le coach veut analyser → c'est le **Rapport** (module aval distinct). « Une envie de petit champ notes = signal de fuite de périmètre » — consigné, frontière dure.

> **⚠️ Seul vrai risque d'invention de toute la conception B — signalé franchement, non contourné.** La spec S-5.3.a *présuppose* `corriger_observable` comme mécanisme de correction coach vidéo, et la modélisation §8.4 décrit conceptuellement les corrections post-clôture comme « le travail du coach via son accès Hub complet ». Mais le STATE ne confirme explicitement un **chemin coach-authentifié (token NULL, résolution par `evenement_uuid`)** que pour **C12-e** (`consolider_score_rencontre` 2-arg, via SUIVI-UI-5). Il **ne le confirme pas pour C12-c** (`inserer_observable`/`corriger_observable`/`annuler_observable`) ni pour le câblage de `timecode_video`. **À vérifier à la source (`sql/` C12-c) en conv Production, avant de spécifier le comportement fin :**
> - **Si C12-c expose déjà un chemin coach-authentifié** (token NULL symétrique à C12-e) → B le consomme via `supabase-client.js` (client coach authentifié), rien à ajouter backend.
> - **Si C12-c est jeton-seul** (pas de chemin coach authentifié) → **dette backend nouvelle à tracer dans le couloir backend** (proposition de code : `SUIVI-COACH-3` — surcharge/chemin authentifié de `corriger`/`inserer`/`annuler`, exactement le pattern qui a produit C12-i pour consolider). **Non conçue ici, non présumée tombée.** Conforme au cadrage §4 (« pas de nouveau backend présumé ; si besoin émerge → trace comme dette, jamais en douce »).
>
> Ce point n'est **pas un blocage de conception UX** (le comportement voulu est clair et juste) : c'est une **vérification + dette conditionnelle Production**, isolée et tracée, sur le modèle exact de la dette C12-gate d'Objet A.

---

## 5 · B-Q4 — Écran de saisie vidéo : chronologie au centre, palette Cat A, cadre Expert différé

Préconisation validée (path b) : B conçu sur Cat A + capacité Expert structurelle + palette Expert Cat B différée/tracée.

**Décision — agencement de l'écran B (anti-écran-live) :**

- **Pas la palette mobile du bénévole.** S-5.3 : les contraintes live ne s'appliquent pas. L'écran B est un **plan de travail desktop/tablette**, pas une transposition de l'écran « En cours ».
- **Inversion de hiérarchie : la chronologie domine, la palette est en appui.** En live la palette domine (geste ~50×/match sous stress). Au calme, c'est la **revue de la chronologie** qui domine : le coach lit le déroulé en regardant la vidéo, repère les trous/erreurs, agit ponctuellement. Donc : timeline complète lisible (provenance live/vidéo visible — B-Q2 (a)), actions (compléter / corriger / annuler une ligne ; ajouter une ligne manquante) attachées **à la ligne** ou via une palette latérale sobre. **Pas de hiérarchisation par urgence** (S-2.2.a) — non pertinente hors live.
- **Palette = Cat A maintenant, cadre Expert structurel présent mais vide, Cat B différé.** B porte la **capacité Expert par nature** (S-5.3 : « Cat B au calme »), mécanisme `mode_saisie` par ligne déjà livré (STATE SUIVI-UI-4). Mais le *contenu* Cat B n'est pas spécifié. Donc B livre la complétion/correction sur les **13 observables Cat A réels** (vérifiés `observables-match.json` v1.1), avec l'**emplacement Expert prévu structurellement mais vide** tant que SUIVI-UI-4 n'est pas tranchée (conv Audits/Référentiels). **Aucun observable Cat B inventé en UI.** Limite assumée et tracée — précédent exact d'A-Q4 (évolution tracée de la même surface, pas codée par anticipation).
- **`timecode_video` (S-5.3.a) = factuel, pas analytique.** Renseigner « où dans la vidéo » est un fait (localisation), pas une interprétation → ne viole pas la frontière QUOI/POURQUOI. Présence d'un champ timecode sur les lignes ajoutées/corrigées. **À vérifier à la source** que `chronologie_suivi`/C12-c portent bien `timecode_video` (même item de vérification Production que B-Q2 ; si non câblé → tracé avec la dette C12-c, pas inventé).
- **Aucun champ d'analyse / commentaire** (S-5.3.c, rappelé).

---

## 6 · B-Q3 — Re-consolidation du score : un geste explicite de fin de revue

Backend **entièrement couvert** (STATE SUIVI-UI-5 : 2-arg `consolider_score_rencontre`, `p_token` NULL, couvre la consolidation coach authentifié ; « Objet B n'a rien à ajouter »). B-Q3 = uniquement le **déclencheur UX**.

**Décision : re-consolidation explicite, déclenchée à un geste de fin de revue / sortie de session Mode Vidéo. Pas après chaque action.**

- **Pas de re-consolidation par action.** Le coach enchaîne souvent plusieurs corrections/ajouts (il revoit une mi-temps entière). Re-consolider à chaque ligne = appels redondants + score qui « saute » en cours de revue (un score intermédiaire de revue partielle n'a pas de sens). Cohérent S-5.3.b : le score *se recalcule* (jamais saisi, I1) ; la photo `evenements` n'a besoin d'être rafraîchie qu'à un point stable.
- **Geste explicite de fin.** Quand le coach a fini sa passe vidéo, un geste clair — « Terminer la revue vidéo » — qui (1) ré-appelle `consolider_score_rencontre` (2-arg, `p_token` NULL — backend déjà là), (2) rafraîchit la photo score dans `evenements`. Le coach **constate** le score recalculé, il ne le **valide** pas (I1, S-4.2.a : « il ne valide pas un score, il constate celui calculé »).
- **Honnêteté de bout en bout.** Le score affiché *pendant* la revue reflète la chronologie en cours (calculé client, comme en live — I1). La consolidation = photo persistée à la sortie. Cohérent S-5.3.b (« la photo `evenements` est rafraîchie ; la vérité reste la chronologie »).
- **Aucun état transitoire complexe** (anti-V6, cohérent S-4.2.c qui a écarté la fenêtre de grâce pour la même raison). Un point stable, un geste, une photo.

Écarté : re-consolidation auto à chaque action (bruit + redondance) ; re-consolidation auto **silencieuse** à la fermeture (le coach ne saurait pas que le score a bougé — moins honnête qu'un geste « Terminer la revue » qui montre le score recalculé).

---

## 7 · Synthèse Objet B & dépendances

```
OBJET B — Mode Vidéo (saisie coach a posteriori)
═══════════════════════════════════════════════════════
✅ B-Q5 — temps de jeu EXCLU de B (→ Objet C-1, cycle suivant)
✅ B-Q6 — écran spectateur HORS-SUJET (→ Objet C-2, distinct)
✅ B-Q1 — accès = continuation adaptative de la section
          « Suivi de la rencontre » d'Objet A ; écran distinct
          (fichier nouveau) ; seuil aligné C12-gate ; Q0 neutralisé
✅ B-Q2 — une seule chronologie, provenance source_saisie visible ;
          le coach corrige+complète (jamais DELETE) ; frontière
          dure QUOI/POURQUOI (zéro champ analyse)
✅ B-Q4 — plan de travail desktop ; chronologie au centre,
          palette Cat A + cadre Expert structurel vide (Cat B
          différé/tracé) ; timecode_video factuel
✅ B-Q3 — re-consolidation = geste explicite « Terminer la
          revue » (backend déjà couvert SUIVI-UI-5) ; constat,
          pas validation ; aucun état transitoire

DÉPENDANCES & DETTES TRACÉES (ni inventées ni codées par anticip.)
• ⚠️ C12-c (conv Production, à vérifier source AVANT spec fine) —
  chemin coach-authentifié (token NULL) de inserer/corriger/
  annuler + câblage timecode_video. CONFIRMÉ pour C12-e seul
  (SUIVI-UI-5). Si absent pour C12-c → dette backend nouvelle
  proposée « SUIVI-COACH-3 » (pattern C12-i). Non conçue ici,
  non présumée tombée. Seul vrai risque d'invention de B.
• C12-gate (conv Audits) — seuil exact « rencontre jouée »
  (états evenements). B-Q1 conçoit le comportement ; le seuil
  s'y aligne (même posture qu'A-Q2).
• SUIVI-UI-4 (conv Audits/Référentiels) — contenu palette Cat B.
  Mécanisme Expert livré ; contenu différé. B livré en Cat A,
  cadre Expert vide jusqu'à instruction (précédent A-Q4).
• Q0 (hygiène STATE) — version réelle evenements-browser.js
  (C12-h frontend ?). NEUTRALISÉ : B n'utilise pas
  getLienSaisieActif. Vérification d'hygiène au moment de
  spécifier l'accroche en Production, pas un blocage.

INTANGIBLES RESPECTÉS
• Objet A : la conception SPÉCIFIE l'accroche ; retouche
  evenements-browser.js tranchée en Production (intégrité,
  modèle SUIVI-COACH-2). Zéro retouche A ici.
• Module bénévole (suivi.html/suivi-app.js/suivi-client.js) :
  non touché (invariant sans-login intangible).
• Backend : aucun nouveau backend conçu ; besoin émergent
  (C12-c) tracé comme dette conditionnelle, pas conçu en douce.
• Objet C (temps de jeu hors B-Q5, écran spectateur) : cycle
  suivant, hors de cette conv.

AUCUNE dépendance BLOQUANTE pour la conception. La seule
réserve (C12-c) est une vérification + dette conditionnelle
Production, isolée et tracée — pas un blocage de cadrage.
```

**Prochaines étapes (hors de ce document) :**

1. **Validation groupée Manu** — ✅ FAIT (17/05/2026).
2. **Dépôt Drive** — ce document en `00 - Documentation/`, au même rang que `Conception-SUIVI-COACH-1-ObjetA.md`.
3. **STATE.md** — acter : conception Objet B livrée ; dépendance conditionnelle C12-c (vérification source + dette `SUIVI-COACH-3` éventuelle) enregistrée ; B-Q5 (temps de jeu = Objet C-1) et B-Q6 (spectateur = Objet C-2) consignées comme frontières du cycle. *(Demander à Manu la version Drive la plus récente de STATE.md avant toute MAJ — ne jamais partir d'une copie locale.)*
4. **conv Production (Objet B)** — quand priorisé : (a) **d'abord** vérifier à la source `sql/` C12-c (chemin coach-authentifié + `timecode_video`) → consommer si présent, ouvrir la dette backend `SUIVI-COACH-3` si absent ; (b) coder l'écran Mode Vidéo (fichier distinct, via `supabase-client.js` coach authentifié) ; (c) spécifier en Production la retouche d'accroche dans `evenements-browser.js` (section Suivi d'Objet A), vérification d'intégrité, modèle SUIVI-COACH-2.
5. **conv Audits** — C12-gate (seuil états `evenements`, alimente B-Q1) et SUIVI-UI-4 (palette Cat B, enrichit B-Q4) à instruire pour lever les deux dépendances non bloquantes.

---

*Conception `SUIVI-COACH-1` Objet B · MOM Hub · conv Conception · 17 mai 2026*
*6 décisions tranchées (B-Q5/B-Q6 périmètre, B-Q1 point d'entrée, B-Q2 relation live↔vidéo, B-Q4 écran, B-Q3 re-consolidation). Fond S-5.3 vérifié à la source, non réinventé. 1 réserve isolée et tracée (C12-c, vérification + dette conditionnelle Production), 3 dépendances non bloquantes (C12-gate, SUIVI-UI-4, Q0 neutralisé). Objet A / module bénévole / backend / Objet C intangibles respectés. VALIDÉ par Manu (validation groupée, 17/05/2026) — document de référence, prêt pour dépôt Drive.*
