# Conception — Autorisation granulaire par catégorie (B5)

**Statut :** doc FAIT FOI · conception pure (zéro code, zéro SQL exécuté)
**Date :** 30 mai 2026
**Auteur :** conv `Conception · Autorisation granulaire référent par catégorie (B5)` (assistance Claude)
**Origine :** B5 du doc FAIT FOI `Conception-IDENT-SYS-v1.md` (`7b6bd06a`), posé hors périmètre au pt 29, débloqué par le socle livré au pt 31.
**Successeur attendu :** une conv `Production · Autorisation par catégorie` (implémentation).

---

## 0. Pourquoi ce document existe maintenant (et pas avant)

Le doc FAIT FOI `Conception-IDENT-SYS-v1.md` tranchait B5 ainsi (table des décisions, ligne B5) :

> « Autorisation fine par catégorie = hors périmètre (pas de besoin terrain) — P1 »

Cette décision était **juste au pt 29** : un seul compte (`admin`), aucun coach authentifié, donc une garde « par catégorie » n'aurait borné personne. Construire à ce moment-là aurait été du sur-engineering — une serrure pour une porte sans visiteurs.

**Ce qui a changé (mai 2026, validé par Manu) :** les staffs 2026/2027 sont en cours d'établissement. Au passage de saison, Manu compte saisir la composition des staffs sur l'écran `fonctions-staff`, **et les référents de catégorie utiliseront un compte authentifié dès le début de la saison prochaine**. Le besoin terrain devient réel et daté. La condition de réactivation posée par `IDENT-SYS` §2.6 (« réactivable plus tard sur le socle posé ») est remplie.

B5 n'est donc plus un chantier de *fondation* (la fondation a été posée au pt 31) : c'est un chantier de **gardes d'autorisation** qui s'appuie sur l'existant sans nouvelle table d'identité.

---

## 1. Sondes à la source (lecture seule — base/repo font foi, méthode pt 14)

Closes avant toute conception, lues à la source (`raw.githubusercontent.com`, branche `main`, dépôt `Manu-MOM/mom-hub` ; github.io bloqué par le proxy). Le fait tranche, jamais l'hypothèse.

| # | Objet | Résultat prouvé | Conséquence pour B5 |
|---|---|---|---|
| **S1** | `auth_roles` (`sql/04-auth-roles.sql`) | Table à CHECK **fermé** `role IN ('admin','coach','viewer')`. Helpers `has_role(p_role text)` et `get_my_roles()` SECURITY DEFINER, filtrant `auth.uid()`. PK `(user_id, role)` → **cumul de rôles déjà permis**. 1 ligne réelle = `admin` (`7ac40334…`). `coach`/`viewer` jamais peuplés. | Le rôle `referent` se heurterait au CHECK actuel → **ALTER du CHECK requis** (Décision 1). Le cumul de rôles est gratuit (déjà PK composite). |
| **S2** | `fonction_staff` (`sql/61`) | `fonction` = `text` libre, **aucune contrainte d'unicité bloquante** sur `(personne, catégorie, fonction)`. Invariant « 1 active » tenu **par personne**, pas par catégorie. → **plusieurs titulaires de la même fonction sur la même catégorie sont nativement possibles**. 1 ligne réelle = Emmanuel JUNG · Référent de catégorie · M14. | La dérivation « mes catégories » et le multi-titulaires (1 à 3 référents/cat) sont portés **sans modification de table**. |
| **S3** | Pont auth↔personne (`sql/60`) | RPC `qui_suis_je()` → renvoie la `personne_id` reliée à `auth.uid()` (ou aucune ligne). `relier_ma_fiche(p_personne_id)` = auto-déclaration du compte courant. | La chaîne `auth.uid()` → `personne_id` → catégories est **déjà disponible**. B5 n'ajoute aucune table d'identité. |
| **S4** | `evenements` (`sql/10` + migration v1.2 `sql/40`) | **Aucune colonne `categorie_id` directe** sur `evenements`. **Aucun champ « visibilité » / « club-wide ».** `equipe_id` nullable (FK `ON DELETE RESTRICT`), autorisé vide **uniquement pour `competition`** (CHECK v1.2) ; obligatoire pour `entrainement`/`stage`. Multi-équipes via table M3 `evenement_equipes_engagees`. | La catégorie d'un évènement est **dérivée**, pas stockée. **La « fête du club » (évènement transverse) n'a aucun modèle aujourd'hui** → Décision 2. |
| **S5** | Chaîne de rattachement (`sql/01`) | `evenements.equipe_id` → `equipes.entente_id` → `ententes.categorie_id` → `categories.id`. `ententes` porte `UNIQUE(saison_id, categorie_id)` → **une entente = une catégorie pour une saison**. | Dérivation évènement→catégorie **déterministe** (un seul chemin, une seule catégorie par équipe). |

---

## 2. Le besoin réel (recadré par Manu, mai 2026)

Quatre niveaux d'accès, et non deux :

| Niveau | Qui | Peut faire | Ne peut pas |
|---|---|---|---|
| **1. Admin général** | Manu + **1 second** (sécurité / redondance) | **Tout, partout** : sportif + config technique (sites, saisons, bascule millésime, gestion des comptes/rôles). | — |
| **2. Bureau** (transverse) | Lohann + **1-2** du comité | Lecture + écriture **transverse sur tout le sportif** (évènements, compositions, collectif, toutes catégories) ; **créer des évènements club-wide** (fête du club). | **La config technique** (sites, saisons, bascule, attribution des rôles) — « la vision sans les clés du camion ». |
| **3. Référent de catégorie** | 1 à 3 personnes **par catégorie** | Lecture + écriture **sur sa/ses catégorie(s) uniquement** (évènements, compositions, collectif de cette catégorie). **Voit les évènements club-wide** (consultation). | **Aucun accès** à ce qui concerne les autres catégories. Ne crée pas d'évènement club-wide. |
| **4. Compte sans droit** | Compte authentifié sans rôle / sans fonction qualifiante | **Rien** (porte fermée). Écran l'invitant à contacter l'admin. | Tout. |

**Distinction structurelle fondatrice (héritée de `IDENT-SYS` §2.3, à ne jamais violer) :** le **rôle d'autorisation** (`auth_roles` — ce qui *ouvre des droits*) ≠ la **fonction staff** (`fonction_staff` — descriptif métier, n'ouvre rien par lui-même). B5 articule les deux **sans les mélanger** : le rôle ouvre la *porte*, la fonction borne le *périmètre catégoriel*.

> **Piège explicitement écarté (clarifié avec Manu).** Au MOM, le mot « admin » a deux sens distincts :
> - l'**`admin` du Hub** = rôle d'autorisation technique (niveau 1) ;
> - l'**« admin » de catégorie au sens MOM** = la personne qui gère le hors-terrain d'une catégorie (licences, évènements). Ce **n'est pas** un rôle d'autorisation : c'est une **`fonction_staff`**, enregistrée sous **« Manager »**. Un tel « admin de catégorie » est donc un compte de niveau 3 (`referent`) dont la fiche porte la fonction « Manager ». Encoder ce rôle métier dans `auth_roles` serait l'erreur de conception que `IDENT-SYS` §2.3 met en garde.

---

## 3. Décisions tranchées

| # | Décision | Trancheur |
|---|---|---|
| **D1** | Quatre niveaux d'accès (admin / bureau / référent / rien), pas deux. | **Manu** |
| **D2** | Niveau 1 = rôle `admin` existant, attribué à 2 personnes (Manu + 1). | **Manu** |
| **D3** | Niveau 2 = **nouveau rôle `bureau`** : écriture transverse sportif + évènements club-wide, **sans** config technique. (≠ option « tout le monde admin ».) | **Manu** (A2) |
| **D4** | Niveau 3 = **nouveau rôle `referent`** (B-i) : la présence du rôle ouvre la porte ; les **catégories** sont dérivées de `fonction_staff`. Multi-titulaires (1-3/cat) porté nativement (S2). | **Manu** (B-i) |
| **D5** | **Fonctions `fonction_staff` qualifiant l'écriture catégorielle = {« Référent de catégorie », « Entraîneur principal », « Manager »}.** Les autres (Entraîneur adjoint, Logisticien, Responsable arbitrage, Délégué sportif, Soigneur) sont **purement descriptives** et n'ouvrent aucun droit. | **Manu** (chemin 2) |
| **D6** | **Entraîneur adjoint = descriptif**, n'ouvre **pas** l'écriture catégorielle. | **Manu** |
| **D7** | **Plancher = aucun accès** : un compte `referent` sans fonction qualifiante active dérive zéro catégorie → ne voit rien (pas de lecture-seule par défaut). Accès = toujours un geste explicite (lui donner une fonction qualifiante). | **Manu** |
| **D8** | **Rôles `auth_roles` = `{admin, bureau, referent}`.** `coach` et `viewer` (jamais peuplés) **retirés** du CHECK. (Décision 1 = option b.) | **Manu** (suit reco) |
| **D9** | **Évènement club-wide :** B5 pose la **règle d'accès** (visible par tous les niveaux ≥3 en lecture ; créable par `admin`/`bureau` seulement) et **renvoie la modélisation technique** (comment stocker « cet évènement appartient au club, pas à une catégorie ») au **chantier `Accès`** (non urgent). Pas d'absorption en silence. (Décision 2 = option α.) | **Manu** (suit reco) |
| **D10** | **Périmètre B5 = staff authentifié uniquement.** Les accès des non-staff (parents, joueurs, spectateurs, public, articulation avec le jeton URL Suivi) = **chantier `Accès` dédié, non urgent**, hors de cette conv. | **Manu** |

---

## 4. Mécanisme retenu (le « comment », à industrialiser en Production)

> **Principe P1 :** le plus simple qui tient. La dérivation s'appuie sur le socle pt 31 **sans aucune table neuve d'identité ou d'autorisation**. Le seul ajout structurel est un helper SQL et l'élargissement du CHECK `auth_roles`.

### 4.1 Helper de dérivation « mes catégories autorisées »

Un helper SQL `SECURITY DEFINER`, sur le patron de `has_role`, calculant les catégories sur lesquelles le **compte courant** a un droit d'écriture catégoriel. Logique (pseudo, à figer en Production) :

- Si `has_role('admin')` **ou** `has_role('bureau')` → **toutes les catégories** (sentinelle « transverse », à représenter explicitement, p. ex. un booléen `est_transverse` distinct de la liste, pour ne pas confondre « toutes » avec « aucune »).
- Sinon, si `has_role('referent')` → les `categorie_id` tels que :
  `auth.uid()` → `qui_suis_je()` → `personne_id`, puis
  `fonction_staff WHERE personne_id = … AND date_fin IS NULL AND fonction IN ('Référent de catégorie','Entraîneur principal','Manager')`.
- Sinon → **ensemble vide** (D7, plancher = rien).

> **Point d'attention Production (délégué) :** la comparaison de `fonction` doit être **insensible à la casse et aux accents** et tolérer les variantes d'espaces, car `fonction` est un `text` libre (S2). Le référentiel `data/fonctions-staff.json` fournit les 3 libellés canoniques ; la dérivation doit rester robuste à une saisie « entraineur principal » sans accent. Normalisation à figer en Production (patron `translate()`/`lower()`/`btrim()` déjà employé au pt 30, `unaccent` absent en base).

### 4.2 Où la garde s'applique (surfaces à border)

Les surfaces dont l'écriture/lecture est **catégorielle** et qui passent aujourd'hui par des RPC gardées `has_role('admin')` strict :

| Surface | Rattachement catégorie | Garde B5 |
|---|---|---|
| **Évènements** (`evenements`, `evenement_equipes_engagees`) | dérivé `equipe_id → entente → categorie` (S5) | admin/bureau : toutes ; référent : sa/ses catégorie(s) ; club-wide : lecture tous, écriture admin/bureau (D9). |
| **Compositions** (`compositions`, lié à l'évènement→équipe) | via l'évènement de la compo | idem évènements (la compo hérite de la catégorie de son évènement). |
| **Collectif N1** (`collectif_membre` via `entente_id`) | `entente_id → categorie` | admin/bureau : tous ; référent : les ententes de ses catégories. |
| **Fonctions staff** (`fonction_staff`, écran `fonctions-staff`) | `categorie_id` direct | **reste admin-only** (nommer le staff d'une catégorie est un geste de gouvernance, pas un geste de référent) — *à confirmer en Production ; valeur par défaut prudente.* |
| **Écrans `admin-*`** (équipes, sites, saisons, bascule) | transverse / technique | **admin-only strict** (config technique = clés du camion, exclue du bureau par D3). |

> **Mécanisme de garde (Q-mécanisme, délégué Production, recommandation P1) :** privilégier le **filtrage dans les RPC existantes** (chaque RPC d'écriture vérifie « la catégorie cible ∈ mes catégories autorisées » via le helper 4.1), **plutôt que** des policies RLS par catégorie (plus lourdes à maintenir sur des tables à rattachement indirect) ou un filtrage UI seul (non sûr — l'UI ne protège pas l'API). Le filtrage RPC est le patron déjà déployé partout dans le projet (gardes `has_role('admin')`), donc cohérent et minimal. La décision finale RPC-vs-RLS est **déléguée à la Production**, à trancher au fait selon la surface.

### 4.3 Attribution des rôles

`auth_roles` n'a aujourd'hui **aucune policy write** (attribution via SQL Editor / service_role, cf. `sql/04`). B5 ne change pas ce principe pour démarrer : l'attribution de `bureau`/`referent` se fera **par l'admin** (SQL Editor, ou une future RPC `attribuer_role` gardée `has_role('admin')` — à décider en Production). Cohérent avec D3 (le bureau ne distribue pas les rôles).

---

## 5. Ce qui n'a PAS été fait / ne doit pas être absorbé

- **Modélisation technique de l'évènement club-wide** (comment stocker « appartient au club, pas à une catégorie ») → **chantier `Accès`** (D9). B5 ne pose que la règle d'accès.
- **Accès des non-staff** : parents, joueurs, spectateurs, public, articulation avec le jeton URL du module Suivi bénévole, questions RGPD afférentes → **chantier `Accès` dédié, non urgent** (D10). « Une conv = un sujet. »
- **Aucun code ni SQL touché.** `auth_roles`/`has_role` (`sql/04`), `auth_personne` (`sql/60`), `fonction_staff` (`sql/61`), `list_categories` (`sql/62`), modèle Évènements v1.2, Collectif v1.1, `supabase-client.js` v1.34 — non rouverts. Le module bénévole Suivi (jeton URL, sans login) n'est pas touché.
- **Non absorbés (chantiers distincts, rappel) :** réalignement DELETE M8, bascule saison UA-5, Gouvernance SQL↔JSON, ADMIN-(ii) (6) bascule club v2, format jeton public RGPD, hygiène Drive, resync `sql/01`.

---

## 6. Sortie B5 → Production

Chantier Production « Autorisation par catégorie », à ouvrir, ordre indicatif :

1. **`auth_roles` : élargir le CHECK** à `{admin, bureau, referent}` (retirer `coach`/`viewer`), idempotent (D8). Migration triviale — aucune ligne existante affectée (seul `admin` peuplé).
2. **Helper de dérivation** `mes_categories_autorisees()` (+ sentinelle transverse) SECURITY DEFINER, normalisation `fonction` robuste (4.1).
3. **Border les RPC d'écriture catégorielles** (évènements, compositions, collectif) par le helper, en complément de `has_role` (4.2). Patron de garde projet.
4. **Règle d'accès club-wide** appliquée en lecture (visible tous niveaux ≥ référent) / écriture (admin/bureau) — sur le modèle d'évènement transverse **tel qu'il sera défini par le chantier `Accès`** (dépendance signalée, D9).
5. **Attribution des rôles** : geste admin (SQL Editor ou RPC `attribuer_role` gardée admin) (4.3).
6. **Recette terrain** : créer un compte `referent` test relié à une fiche `fonction_staff` M14, vérifier qu'il ne voit/écrit que M14, qu'un compte sans fonction qualifiante ne voit rien (D7), et qu'un compte `bureau` voit tout le sportif mais pas les écrans `admin-*`.

**Dépendance unique :** point 4 dépend de la définition de l'évènement club-wide par le chantier `Accès`. Les points 1-3, 5-6 sont autonomes et livrables sans attendre.

---

*Doc FAIT FOI · à déposer dans Drive `00 - Documentation/`. Conception pure : le document est le seul livrable. Sources lues à la source (repo `Manu-MOM/mom-hub` branche main) : `sql/04`, `sql/10`, `sql/40`, `sql/01`, `sql/60`, `sql/61`, `sql/62`, `data/fonctions-staff.json`, `Conception-IDENT-SYS-v1.md` (`7b6bd06a`).*
