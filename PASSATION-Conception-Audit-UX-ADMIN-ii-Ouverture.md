# PASSATION — `Conception · Audit UX ADMIN-(ii) Espace admin transverse`

**Établi le 27 mai 2026** · Auteur : Manu via Claude (clôture cycle pt 20 + ouverture chantier ADMIN-(ii))
**À coller en tête de la nouvelle conv** (pattern projet STATE §0 pt 4, héritier de `PASSATION-Production-Refonte-UX-Evt-Compo-Ouverture.md` md5 `c4121b82` qui a très bien marché pt 19).

---

## §0 — Sujet strict de la conv + type + sortie attendue

**Sujet strict** : audit UX + conception UX du chantier **`ADMIN-(ii)`** (« espace admin transverse »), ouvert depuis pt 11 (conv `Conception · Collectif catégorie & compo 3 niveaux` 19/05), tracé non absorbé à travers pt 15/16/17/18/19/20, **prouvé bloquant en recette terrain pt 19** (test multi-équipes A4/A5 impossible car catégorie M14 a 1 seule équipe en base).

**Type de conv** : **Conception** stricte (pattern pt 18 `UX-PARCOURS-EVT-COMPO`). **Zéro code, zéro SQL, zéro mockup pixel-perfect**. Décisions ancrées aux modèles déployés (Évènements v1.2 / Collectif v1.1 / Doctrine v1.2). Implémentation = conv `Production` ultérieure dédiée (à ouvrir une fois le doc UX FAIT FOI livré au Drive).

**Sortie attendue** : 1 livrable FAIT FOI au Drive `00 - Documentation/` — nom proposé `Conception-UX-ADMIN-ii-v1.md` (forme libre, à confirmer en début de conv). Périmètre conçu niveau β+γ (suffisant pour ouvrir Production sans rouvrir Conception). Passation de sortie produite en geste de fin (pattern pt 18).

**Priorité non-figée à l'ouverture** (décision Manu pt 20 : laisser l'audit UX faire remonter la priorité 1 lors du recensement). Hypothèse de travail = priorité 1 sera probablement **création d'équipes par catégorie** (= ce qui débloque le test A4/A5), mais à confirmer/infirmer par le fait pendant l'audit.

---

## §1 — Lecture protocole obligatoire (ordre imposé)

Avant toute mutation, lire **À LA SOURCE** dans cet ordre :

1. **`CARTE-CONVERSATIONS-MOM-Hub.md`** au Drive `00 - Documentation/` — md5 attendu `cd5c8299` (pt 20 suite 2, commité 27/05). Confirmer `modifiedTime` Drive aligné. Index maître = quelle conv fait quoi.
2. **`PASSATION.md`** au Drive `00 - Documentation/` — kit de démarrage générique (discipline, où trouver quoi). Inchangé pt 20.
3. **`STATE.md`** au Drive `00 - Documentation/` — md5 attendu `8e21df01` (pt 20 suite 2, commité 27/05). Vérité opérationnelle du code. Lire intégralement les 3 blocs MAJ Production 27/05 (pt 20 livraison principale + pt 20 suite passe CSS L3b + pt 20 suite 2 UX-EVT-DOUBLON-GROUPER-BOUTON levée) + le bloc gouvernance pt 11 où ADMIN-(ii) est tracé pour la première fois + le bloc gouvernance pt 14 (mention `ADMIN-(ii)` distinct admin (i)) + le bloc gouvernance pt 18 (mention dépendance amont non bloquante §4.7 doc UX FAIT FOI).
4. **CE message de passation** (entête nouvelle conv).

**Si l'un des md5 attendus ne correspond pas** au Drive → STOP, demander à Manu de resync (ou attester verbalement « le Drive contient bien la dernière version »). Ne JAMAIS partir d'une version locale ou ancienne — discipline mémoire pt 17.

---

## §2 — Gate de version attendu début de conv

Avant toute écriture, **confirmer 4 points** auprès de Manu :

1. **Gate STATE/CARTE** : STATE `8e21df01` + CARTE `cd5c8299` confirmés derniers (Drive resync OK).
2. **Drive resync** : les 3 commits pt 20 (`evenements-browser.js` v1.25, STATE pt 20 initial, CARTE pt 20 initial) + 3 commits pt 20 suite (`evenements.html` v3, STATE pt 20 suite, CARTE pt 20 suite) + 3 commits pt 20 suite 2 (`evenements-browser.js` v1.26, STATE pt 20 suite 2, CARTE pt 20 suite 2) sont tous au Drive et synchrones.
3. **Recette terrain pt 20** : faite ou différée ? Le cycle pt 20 a produit 3 livrables code/HTML/JS groupés à recetter ensemble (v1.25 fiche refondue + v3 styles + v1.26 doublon levé). Si non faite → acter explicitement comme « tracé non absorbé » dans cette conv (pattern pt 13/14/19).
4. **Doc UX FAIT FOI Conception-UX-Parcours-Evt-Compo-v1.md** md5 `4c8652d9` toujours au Drive `00 - Documentation/` (référence pour la mention `ADMIN-(ii)` §4.7 dépendance amont non bloquante, et pattern d'écriture du futur doc ADMIN-(ii)).

---

## §3 — Contexte d'ouverture (généalogie du chantier)

`ADMIN-(ii)` est un chantier **distinct** de `ADMIN-(i)` (« admin collectif/staff par saison », conçu et implémenté pt 15 — `u-admin.html` + `u-admin.js` v1.0 livrés bout en bout). Il a été identifié à la même conv pt 11 comme « le entre autres / pas que » de Manu :

> *Espace admin transverse : création saisons / `ententes`, sites, référentiels, bascule club. Le « entre autres / pas que » de Manu. A-4 en dépend (création entente cible de la bascule de saison de l'admin (i)). DISTINCT de l'admin (i) (collectif/staff par saison, conçu ici).*

**Statut** : tracé pt 11 → non rouvert pt 14/15/16/17/18 (chantier distinct, conv dédiée) → **prouvé bloquant en recette pt 19** :

> *Test multi-équipes A4/A5 IMPOSSIBLE terrain : catégorie M14 a 1 seule équipe en base (`equipe_id bfb83b83-…`, « Entente SAR/MOM/ASCS M-14 », vérifié à la source `equipes JOIN ententes`). Impossible d'engager une 2ᵉ équipe sur le même évènement en l'état. Test différé tant qu'écran admin équipes catégories réelles non livré.*

**Mention pt 18 doc UX FAIT FOI §4.7** : *« `ADMIN-(ii)` = dépendance amont non bloquante : libellés génériques "Équipe 1/2/3" provisoires en maquette via Q-A10, code Production lira dynamiquement `equipes` filtrée catégorie+saison+`statut='active'` patron `listEquipes` STATE pt 14 »*.

Aujourd'hui pt 20, la dépendance est **devenue bloquante** pour exploiter la refonte UX Évt→Compo livrée (5 modes adaptatifs A1→A5 inutilisables au-delà de A1/A2/A3 mono-équipe).

---

## §4 — Périmètre cadré (7 sous-chantiers recensés)

À auditer en début de conv (pour confirmer/affiner, priorité non-figée) :

1. **Création équipes par catégorie** — débloque test multi-équipes A4/A5 prouvé bloquant pt 19. Hypothèse priorité 1.
2. **Création saisons** — bascule de saison `UA-5` (ouverte pt 15, sous-décision mécanisme RPC vs bulk client) dépend potentiellement.
3. **Création `ententes`** — `A-4` dépend (création entente cible de la bascule de saison admin (i)). Modèle `ententes` existant `sql/01`.
4. **Création sites** — besoin direct fiche évènement (sites listés au boot via `SITES` constante `evenements-browser.js`). Modèle `sites` existant.
5. **Référentiels JSON** — 6 fichiers déjà présents au Drive `01 - Référentiels/` (postes.json v1.1, ateliers.json, aptitudes.json, conformite-ffr.json, observables-match.json v1.1, tests-physiques.json — confirmé en mémoire courante, conformité au modèle déployé reste à évaluer dans cette conv).
6. **Bascule club** — multi-clubs futurs (M14 actuel = un seul club M2M, mais doctrine projet anticipe le multi-club via `equipes.statut='active'` + filtrage `M14_TEAM_UUID` patron).
7. **A-4** — dépendance entente cible bascule saison admin (i), à clarifier en lien avec `UA-5` (mécanisme bascule).

**Note** : la **FFR plateforme `OVAL-E`** (gestion des licences FFR, vérifié mémoire Manu) est l'autorité externe sur ententes/équipes/joueurs. À mentionner dans l'audit si la conception touche un point d'intégration FFR (probablement hors périmètre v1, mais à tracer).

---

## §5 — Signal terrain prouvé bloquant pt 19

À acter explicitement comme **point d'ouverture** :

> *Catégorie M14 a 1 seule équipe en base : `bfb83b83-…` « Entente SAR/MOM/ASCS M-14 ». Les modes A4 (Plateau multi-équipes, **priorité 1 Manu UX-2a doc UX §3.1**) et A5 (Tournoi à phases multi-équipes) sont impossibles à tester terrain. La modale création v1.25 + RPC composite `sql/52` v4 + helper `renderFonctionCellule` Q4=C expansion in-situ multi-équipes — tout est livré + recette unitaire OK mais **inactivé en pratique** par l'absence de 2ᵉ équipe M14.*

C'est le bloquant le plus opérationnel. Toute conception ADMIN-(ii) qui ne traite pas ce point comme priorité 1 doit le justifier explicitement (écart gouvernance à tracer).

---

## §6 — Dépendances en attente NE PAS rouvrir ni absorber

Chantiers distincts tracés depuis pt 11/14/15/16/17, **convs dédiées**, une conv = un sujet :

- **`IDENT-SYS`** 🆕 — liaison identité-système `auth.uid()` ↔ `personne`. NON ouverte (N1/N2/N3/Staff n'en dépendent pas, autorisation patron `sql/41` `has_role` suffit). À ouvrir si « coach ne voit que son équipe » devient nécessaire.
- **Réalignement DELETE M8** — Arbitrage Option A vs préexistant base admin-seul. Sujet distinct.
- **`UA-5` bascule de saison** — sous-décision mécanisme RPC vs bulk client OUVERTE pt 15. À traiter dans cette conv ADMIN-(ii) **OU** chantier dédié (à arbitrer en début de conv).
- **Source Staff** — modèle ne la définit pas (U-admin pt 15 Staff dégradé honnête). À clarifier hors ADMIN-(ii) sauf si l'audit identifie un lien direct.
- **Format minimal `chronologie_nom_court_personne` sur jeton public** — RGPD réajustement assumé Manu pt 15, conv dédiée si décidé.

**Si l'un de ces chantiers est tenté d'être absorbé dans cette conv ADMIN-(ii)** = écart gouvernance à signaler explicitement (pattern option 2 pt 11/15/16/17/19/20).

---

## §7 — Intangibles protégés à NE PAS rouvrir

Ne JAMAIS toucher conception/code/SQL de ces blocs dans cette conv (zéro code de toute façon, mais traçabilité doctrinale) :

- **Modèle Évènements v1.2** (M1→M8, `Modelisation-Evenements-v1.2.md`)
- **Modèle Collectif v1.1** (N1/N2/N3, `Modelisation-Collectif-Compo-3-Niveaux-v1.md` FAIT FOI)
- **Doctrine d'interconnexion v1.2** (P1 simplicité fil rouge)
- **Doc UX FAIT FOI `Conception-UX-Parcours-Evt-Compo-v1.md`** md5 `4c8652d9` (référence §4.7 dépendance amont)
- **Accroches Suivi A/B/C** (12/12 byte-identiques prouvés md5 pt 20)
- **Module bénévole `suivi.html`/`suivi-app.js`** (cycle clos pt 8)
- **RPC C12** entière (a/b/c/d/e/f/g/h/i/j/k/l, signatures figées contrats préservés)
- **Chaîne SQL** `sql/44`→`sql/52` (Collectif + RPC composite + nettoyages)
- **RLS write M3/M5** (`sql/43`, scope strict)
- **N1/N2/N3 DDL** (sql/44/45/46, `compositions.evenement_id` intact)
- **`renderFiche` v1.25 L3b** + helper `renderFonctionCellule` + `bindFicheActions` v1.25 (livrés pt 20)
- **Handlers Niveau 0** `ouvrir-groupe-base` + `ouvrir-feuille-equipe` (byte-identiques v1.22/v1.23+, réutilisés grille 8 liens v1.25)
- **PI-7** (garde `generer_lien_ephemere`) + **VIGIL-C12** (levée au fait pt 15)

---

## §8 — Doctrine P1 simplicité (fil rouge)

**Critère initial du projet = SIMPLICITÉ.** Manu observe constamment qu'on s'en éloigne quand un chantier devient ambitieux. Doctrine P1 « avertit ne bloque pas » + P5 « nommer pour le sens » couvrent les zones grises (cf. STATE pt 18 §4.6 doc UX).

**Risques connus ADMIN-(ii)** :
- Tentation d'absorber tout d'un coup (saisons + ententes + sites + référentiels + bascule + équipes + A-4) → écran admin obèse, P1 fragile.
- Tentation de re-modéliser (créer nouvelles tables) → INTANGIBLE, les modèles déployés font foi.
- Tentation de coupler à OVAL-E (intégration FFR) → hors périmètre v1 sauf décision Manu explicite.

**Antidote** : audit UX d'abord, priorisation après recensement, **un sous-chantier livrable à la fois en Production aval** (pattern pt 15/16/17 micro-livraisons cohérentes).

---

## §9 — Sortie attendue (forme du doc UX FAIT FOI)

Pattern à reprendre de `Conception-UX-Parcours-Evt-Compo-v1.md` (md5 `4c8652d9`, 53 508 octets, ~37 décisions Q-A tranchées pas-à-pas) :

- **§1 Cadrage** : ce qui était ouvert (dette pt 11 verbatim) + ce qu'on conçoit ici + ce qui reste hors
- **§2 Frictions tracées + acquis préservés** (méthode pt 18 : 23 frictions + 8 acquis)
- **§3 Surfaces conçues niveau β+γ** : par sous-chantier priorisé (1, 2, 3… selon ce que l'audit fait remonter)
- **§4 Décisions Q-A1→Q-Aₙ** tranchées Manu pas-à-pas (le cœur du doc)
- **§4.5 Invariants protégés** (liste §7 ci-dessus, transposée)
- **§4.6 Écarts gouvernance assumés** (option 2, si nécessaire)
- **§4.7 Dépendances amont non bloquantes** (par ex. si IDENT-SYS surgit en cours)
- **§5 Frontières aval** (ce qui sera dans la conv Production ; ce qui reste pour conv ultérieure)
- **§6 Maquettes Visualizer** validées une à une (méthode pt 18)
- **§7 Passation Production** (livrables attendus = SQL DDL + wrappers `supabase-client.js` + écrans `admin-*.html`/`.js` + ancres rétrocompat)

---

## §10 — Méthode suggérée (pattern pt 18 qui a marché)

1. **Cadrage d'ouverture** : Manu confirme/affine le périmètre §4 + acte priorité 1 par recensement (NON FIGÉE à l'ouverture).
2. **Audit UX large** d'abord : pour chaque sous-chantier, identifier (a) qui doit faire le geste (admin / coach / ?), (b) à quelle fréquence (one-shot / par saison / continu), (c) dépendances (référentiels OVAL-E ? saisie manuelle ?), (d) frictions terrain probables.
3. **Hypothèse à confronter par le fait** : la priorité 1 sera-t-elle équipes par catégorie ? L'audit doit le confirmer ou l'infirmer. Pattern pt 18 « 1 hypothèse INVERSÉE par le fait » = sain.
4. **Décisions Q-A pas-à-pas** : Manu tranche au fil, jamais en silence. Pattern pt 18 (~37 décisions).
5. **Maquettes Visualizer** : 1 par surface conçue, validée une à une (pas de pré-écriture massive).
6. **Signaux terrain Manu** : 15 signaux pt 18 sont remontés en cours (ex. capture SAR×MOM comparative), enrichissent l'audit en temps réel.
7. **Discipline anti-hypothèse** : aucune source inventée, tout vérifié à la source (mémoire pt 14 : `pg_proc`/`pg_indexes`/`pg_policies` lectures explicites si besoin Modélisation, fichiers Drive lectures explicites si besoin doctrine).
8. **Geste de fin** : doc UX déposé Drive + passation de sortie produite (le tout commité 1 fichier = 1 commit).

---

## §11 — Reste pt 20 non absorbé (tracer ou faire)

**Recette terrain pt 20** (v1.25 + v3 + v1.26) à acter explicitement en début de conv :

- **Option A** — Manu confirme l'a faite, terrain OK, on attaque ADMIN-(ii) (à acter en STATE prochain pt comme « recette pt 20 OK »).
- **Option B** — Manu différera, on attaque ADMIN-(ii) en parallèle (tracer en STATE comme « recette pt 20 différée non bloquante »).
- **Option C** — Manu n'a pas pu, on l'absorbe en début de cette conv (10 min, geste de fin pt 20 ; pattern pt 14 absorption micro hors périmètre).

Mon avis (pour mémoire) : **Option B** ou **A** légitimes. Option C = écart si non urgent.

---

## §12 — Références utiles (mémoires Manu et Drive)

**Mémoires Manu vérifiées** :
- **Manu = Emmanuel Jung = Coach principal + Référent catégorie M14 Mutzig Ovalie Molsheim** (confirmé 12/05/2026, ne pas inférer d'autre rôle).
- **OVAL-E** = plateforme de gestion des licences FFR (avec un A, pas OVL-E).
- **`01 - Référentiels/` Drive contient 6 fichiers JSON** : `postes.json` v1.1 (format 13, MAJ 9/05/2026), `ateliers.json`, `aptitudes.json`, `conformite-ffr.json`, `observables-match.json` v1.1, `tests-physiques.json`. **Conformité à la doctrine reste à évaluer** (signalé pt 19 dans recent_updates mémoire). À auditer dans cette conv si sous-chantier (d) Référentiels JSON devient priorité.

**Drive `00 - Documentation/`** : STATE.md / CARTE.md / PASSATION.md (toujours) + `Modelisation-*` + `Conception-*` + `PASSATION-Production-*-Cloture-v1.md` + `Audit-Module-Suivi-Match-v2.1.md` + (à venir) `Conception-UX-ADMIN-ii-v1.md` cette conv + sa passation de sortie.

**Drive `01 - Référentiels/`** : 6 fichiers JSON ci-dessus.

**Drive `02 - Code/`** (si existant) : pas de référence requise pour Conception pure.

---

## §13 — Préférences Manu à tenir constamment

- **1 fichier = 1 commit** (titres+corps fournis sans qu'il ait à demander)
- **Fichiers complets jamais patch** (Manu n'applique pas de patch manuel)
- **Décisions techniques mineures déléguées à Claude** (mémoire pt 17 : signatures, choix d'implémentation, stratégies d'échec → trancher + tracer)
- **Décisions structurelles → toujours demander à Manu** (modèle, écart gouvernance, périmètre)
- **Toujours demander la version la plus récente de STATE.md avant mutation** (jamais partir d'une version locale)
- **Anti-fabrication stricte** : aucune source inventée, tout vérifié à la source (pt 14/17 discipline)
- **Pattern option 2 absorption assumée** acceptable mais à tracer explicitement (écart gouvernance E-x)
- **Style honnêteté pt 15/16** : signaler les trous/incohérences AVANT que Manu les voie terrain

---

**Fin de passation.**

Tout est posé. À l'ouverture de la nouvelle conv `Conception · Audit UX ADMIN-(ii) Espace admin transverse`, Claude (la prochaine instance) doit :

1. Confirmer §1 lecture protocole exécutée (3 fichiers Drive lus à la source).
2. Confirmer §2 gate de version (4 points avec Manu).
3. Acter §11 recette terrain pt 20 (option A/B/C).
4. Démarrer §10 méthode (cadrage d'ouverture + audit large + Q-A pas-à-pas).

Bonne conv 🏉
