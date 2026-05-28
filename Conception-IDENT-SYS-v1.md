# Conception · IDENT-SYS — Identité-personne, fusion des doublons & rattachement des comptes

**Document FAIT FOI** · v1.0 · 28 mai 2026
Emplacement cible : Drive `00 - Documentation/`
Statut : conception tranchée avec Manu — **aucun code, aucun SQL exécuté** (conv de conception). Sondes lecture seule uniquement, à la source.

---

## 0. Périmètre & résultat de cadrage

Cette conception couvre deux volets liés par la question « qu'est-ce qu'*une* identité-personne, et comment un compte s'y rattache » :

- **Volet A** — fusion des doublons d'identité (individus à 2 fiches `personnes` joueur + staff).
- **Volet B** — rattachement `auth.uid()` ↔ `personne`, et modèle des rôles/fonctions du staff.

**Décision de scission (acté avec Manu) :** A et B sont **deux chantiers Production distincts**. A est purement « données amont » (script de fusion, zéro impact auth) ; B est purement « architecture identité/rôles ». Ils ne se bloquent pas. A est prêt à industrialiser ; B est conçu ici mais s'implémente indépendamment.

Toutes les décisions ci-dessous sont ancrées sur des **sondes lecture seule réelles** (méthode anti-fabrication STATE pt 14) — la base fait foi, pas `sql/01` ni les `*.schema.json` (drift prouvé `MODELE-DOCTRINE-SQL01-DRIFT`).

Gate de version au démarrage : md5 `STATE.md` pt 28 = `14d8db07` ✅, `CARTE` pt 28 = `756339ce` ✅ (confirmés au byte près).

---

## 1. VOLET A — Fusion des doublons d'identité

### 1.1 Constat à la source (prouvé)

Les doublons ne sont **pas** 3 mais **4**. Motif d'apparition **systématique** : chaque individu a une fiche **joueur** issue de l'import OVAL-E (08/05, licence FFR renseignée + `uuid_legacy`) **et** une fiche **staff** issue de l'import SportEasy (`sporteasy_sar_minimes_2025-2026_v1`, 12/05, `numero_licence_ffr` NULL, `uuid_legacy` NULL).

| Individu | Fiche joueur (survivante) | Fiche staff (absorbée) |
|---|---|---|
| BELKIS Anne (1978-01-20) | `dfb8a23e-9131-40db-9e63-4b6408c9e068` — licence `1978012137480` | `de5fbc9b-159b-4235-9c2b-9fba0ed64ecb` — licence NULL |
| HELM Loic (1984-04-12) | `62c801db-85c3-4c2f-a5c7-34e0f4cf1f1d` — licence `1984041078692` | `64fa20f3-7351-4539-8632-7af794cbd800` — licence NULL |
| LACOMBE Baptiste (2007-09-07) | `8d4e1b3f-5638-48c2-98da-22ac913ce676` — licence `2007091940265` | `682fa749-d0ce-4719-b366-60cc3f16b1a3` — licence NULL |
| VOEGELI Lorène (2006-05-27) | `e7e979ae-b424-475a-9d2e-33e9d2a12b61` — licence `2006052186400` | `411f3f0d-6c82-489a-a99c-85c5ebfa0d60` — licence NULL |

**Faux positifs prouvés (NE PAS fusionner) :**
- **RULFO Vivien** (`de6a71f3…`, 1984) = **1 seule fiche** `joueur_et_parent_et_staff` — vrai double-rôle légitime. Modèle de référence pour la catégorie post-fusion (§1.4).
- **HELM Noam** (2011, fils) ≠ HELM Loic (date + prénom différents).
- **LACOMBE Jean Emmanuel** (1978, `parent_et_staff`) ≠ LACOMBE Baptiste (2007).
- **RULFO Timeo** (2012, joueur) ≠ RULFO Vivien.

### 1.2 Règle de survie (tranchée par les données)

La règle n'est **pas arbitraire**, elle se déduit du motif prouvé :

> **Survit** la fiche `source_creation = 'import-OVAL-E-automatique'` portant `numero_licence_ffr` non-NULL (+ `uuid_legacy` présent).
> **Est absorbée** la fiche `source_creation LIKE 'sporteasy_%'` à `numero_licence_ffr` NULL et `uuid_legacy` NULL.

Déterministe sur les 4 cas. La fiche survivante porte la donnée d'identité riche (licence FFR = clé d'or côté fédéral) ; la fiche absorbée n'apporte que le fait « cette personne est aussi staff », fait reporté via la catégorie (§1.4) et les rattachements (§1.5).

### 1.3 Détection des doublons (au-delà des 4 connus)

**La licence FFR est inexploitable comme clé de collision** : sonde 3b = 0 ligne. Les fiches staff SportEasy ont toutes `numero_licence_ffr` NULL → un côté de la paire est toujours vide. Elle sert seulement à *désigner la survivante*, pas à *détecter*.

**Clé de détection retenue :**
```
unaccent(lower(trim(nom))) || '|' || unaccent(lower(trim(prenom))) || '|' || date_naissance
```
La normalisation `unaccent` + `lower` + `trim` est **obligatoire** : VOEGELI échappait à la détection naïve à cause de l'accent (`Lorene` joueur OVAL-E vs `Lorène` staff SportEasy). Sans elle, faux négatif silencieux.

**Garde-fou anti-faux-positif :** ne traiter automatiquement que les paires dont les `categorie_personne` **diffèrent** et correspondent au motif joueur-OVAL-E / staff-SportEasy. Deux fiches `joueur` strictement homonymes = **revue manuelle**, jamais fusion auto (risque d'écraser deux personnes réelles distinctes).

**Limite assumée :** la détection automatique repose sur l'exactitude de `date_naissance` et de l'orthographe normalisée. Tout doublon avec date erronée ou nom radicalement mal saisi exige une **revue manuelle**. Le script signalera, ne fusionnera pas hors motif.

### 1.4 Catégorie de la fiche survivante après fusion (décision Manu)

> **Décision** : la fiche survivante passe en `categorie_personne = 'joueur_et_staff'`, **aligné sur le modèle RULFO** (`joueur_et_parent_et_staff`).

La survivante était `joueur` ; absorber le rôle staff la transforme en double-rôle explicite, cohérent avec le seul double-rôle légitime déjà en base. Le fait « est staff » n'est donc pas perdu : il vit dans la catégorie + dans les rattachements reportés.

### 1.5 Rattachements à reporter (inventaire FK prouvé)

Inventaire **exhaustif** des FK entrantes vers `personnes` (sonde 2). Deux familles, traitées différemment.

**Famille métier — l'identité EST le sujet → reporter de l'absorbée vers la survivante :**

| Table.colonne | delete_rule | Traitement |
|---|---|---|
| `collectif_membre.personne_id` | CASCADE | Reporter **avant** suppression + dédoublonner (cf. piège 1) |
| `equipe_joueurs.personne_id` | CASCADE | Idem |
| `composition_joueurs.joueur_id` | NO ACTION | Reporter ; bloque si non fait |
| `presences.personne_id` | NO ACTION | Reporter ; bloque si non fait |
| `evenement_encadrants.personne_id` | RESTRICT | Reporter ; bloque si non fait |
| `evenements.organisateur_principal_id` | RESTRICT | Reporter ; bloque si non fait |
| `chronologie_suivi.joueur_uuid` | RESTRICT | Reporter ; bloque si non fait |
| `equipes.coach_principal_id` | SET NULL | Reporter (sinon perte silencieuse) |
| `equipes.manager_id` | SET NULL | Reporter |
| `poles.responsable_principal_id` | SET NULL | Reporter |
| `poles.co_responsable_id` | SET NULL | Reporter |

**Famille audit — « qui a saisi », pas le sujet :**

`cree_par` / `modifie_par` / `saisie_par` sur `collectif_membre`, `compositions`, `evenement_encadrants`, `evenement_equipes_engagees`, `evenements`, `presences`, `sites`.

> **Constat décisif (sonde) : ces colonnes ne sont JAMAIS remplies aujourd'hui** (échantillons `cree_par` = 0 ligne). L'app n'écrit pas l'auteur. Donc en pratique aucune FK audit ne pointe vers les fiches absorbées → **non bloquantes**, aucun report nécessaire en l'état.
>
> **Décision de principe** (à respecter si l'app commence un jour à remplir l'audit) : **ne pas réécrire l'historique d'audit**. Sur les deux NO ACTION audit (`compositions.cree_par/modifie_par`, `presences.saisie_par`), si une ligne pointait vers l'absorbée et bloquait la suppression, neutraliser par `SET NULL` plutôt que reporter (l'auteur historique factuel devient « inconnu » plutôt que faussement attribué à la survivante).

### 1.6 Pièges de fusion (à coder en Production)

1. **CASCADE = report AVANT suppression + dédoublonnage d'unicité.** Un simple `DELETE` de l'absorbée ferait disparaître ses lignes `collectif_membre`/`equipe_joueurs`. Et un `UPDATE personne_id = survivante` peut violer une contrainte d'unicité si la survivante a déjà une ligne sur la même entente/équipe (`collectif_membre` a `UNIQUE(personne_id, entente_id, role, date_debut)` — cf. STATE pt 25). La fusion doit : pour chaque rattachement, **si la survivante l'a déjà → supprimer la ligne de l'absorbée ; sinon → la repointer**.
2. **RESTRICT = report obligatoire** sinon la suppression échoue (garde-fou utile : fail-loud).
3. **Ordre canonique** : (a) reporter/dédoublonner tous les rattachements métier → (b) neutraliser l'audit bloquant si présent → (c) passer la survivante en `joueur_et_staff` → (d) supprimer la fiche absorbée.

### 1.7 Idempotence & réversibilité

- **Idempotence** : la fusion s'identifie par le couple (survivante, absorbée). Relancer le script une 2ᵉ fois ne doit rien faire si l'absorbée n'existe plus. Pré-check d'existence des deux fiches avant tout geste.
- **Réversibilité** : avant suppression, **journaliser** dans une table de trace (proposition `ident_fusion_log` : `survivante_id`, `absorbee_id`, snapshot JSON de la fiche absorbée + liste des rattachements repointés/supprimés, `date`, `applique_par`). Permet un rollback manuel et un audit. (DDL à figer en Production — décision technique mineure déléguée.)
- **Dry-run d'abord** : le script Production produit un *aperçu* (qui fusionne avec qui, quels rattachements bougent) lu et validé par Manu **avant** tout écrit — patron `apercu_bascule`/`appliquer_bascule` déjà éprouvé (STATE pt 24).

### 1.8 Sortie Volet A → Production

Chantier Production « Fusion doublons identité » :
- Script idempotent + fail-loud + dry-run, calqué sur le patron bascule (aperçu/appliquer sous confirmation).
- `personnes` ayant 0 policy RLS et write fermée au client (STATE pt 25) → **RPC SECURITY DEFINER gardée `has_role('admin')`** (le client ne peut pas écrire en masse). Patron `sql/53`/`sql/56`.
- Lot initial = les **4** doublons prouvés. La détection (§1.3) tourne en amont pour confirmer qu'il n'y en a pas d'autres.
- Journal `ident_fusion_log` pour réversibilité.

> Dette STATE `IDENT-DOUBLONS-JOUEUR-STAFF` 🟡 : passe de « éclairée » à « **conçue, prête à industrialiser** » (résolution = exécution du chantier Production A).

---

## 2. VOLET B — Rattachement compte ↔ personne & rôles du staff

### 2.1 Constat à la source (prouvé)

- **Aucun pont `auth.uid()` ↔ `personne` n'existe en base.** `personnes` n'a aucune colonne pointant vers `auth.users` (sonde 1 : ni `user_id` ni `auth_uid` ; `id_sporteasy` pointe vers un système externe).
- L'autorisation actuelle = table **`auth_roles(user_id uuid, role text, created_at, created_by)`** lue par `has_role(p_role text)` et `get_my_roles()` (SECURITY DEFINER, `where user_id = auth.uid()`). **Mapping compte → rôle texte, jamais compte → personne.**
- **`auth_roles` ne contient qu'1 ligne** : `7ac40334…` = `admin` (le compte fondateur). Aucun coach authentifié.
- **Espaces d'ID disjoints prouvés** : aucun `auth_roles.user_id` n'existe comme `personnes.id` (intersection = 0). Le compte admin n'a pas de fiche `personnes` reliée par UUID partagé.
- `cree_par` (FK vers `personnes`) **jamais rempli** → aucun pont implicite via l'audit.

### 2.2 Le besoin réel (recadré par Manu)

Le besoin n'est **pas** « le coach ne voit que sa catégorie » (autorisation fine par catégorie — pas de sujet aujourd'hui, écarté/reporté). Le besoin réel et immédiat est :

> Gérer **qui occupe quelle fonction dans le staff d'une catégorie** : en M14, Anne = admin, Manu = référent de la catégorie, Milan = entraîneur principal, Vivien = entraîneur adjoint, Julien = logisticien… et pouvoir **ajouter un membre du staff à la main** (ex. Alex logisticien).

### 2.3 Distinction structurelle fondatrice (décision Manu : « les deux selon le rôle »)

Deux axes **séparés**, à ne jamais mélanger :

| | **Rôle d'autorisation** | **Fonction staff** |
|---|---|---|
| Question | Que peut **faire** le compte dans le Hub ? | Quel **poste** occupe la personne dans une catégorie ? |
| Exemples | `admin` | entraîneur principal / adjoint / logisticien / référent |
| Ouvre des droits ? | **Oui** (RLS, RPC gardées) | **Non** (descriptif métier) |
| Porté par | **`auth_roles`** (lié à `auth.uid()`) | **table dédiée** (liée à `personne_id` + catégorie) |
| Anne | `admin` (1 ligne `auth_roles`) | + éventuellement une fonction staff M14 |

**Piège évité** : encoder « logisticien » dans `auth_roles` en ferait un faux rôle d'autorisation qui n'ouvre rien — erreur de conception classique. Anne « admin » **et** Anne « staff M14 » = deux lignes dans deux tables différentes, reliées par le pont du §2.4.

### 2.4 Le pont auth ↔ personne (fondation B)

Pour que « le compte d'Anne » sache qu'il EST « la personne Anne » (et donc puisse afficher sa/ses fonction(s) staff, pré-remplir `cree_par`, gérer l'« est-ce moi »), il faut matérialiser le lien aujourd'hui absent.

**Forme retenue (P1, la plus simple qui tient) : table de liaison dédiée.**

```
auth_personne (
  user_id     uuid  NOT NULL,   -- = auth.uid()
  personne_id uuid  NOT NULL REFERENCES personnes(id),
  created_at  timestamptz NOT NULL default now(),
  UNIQUE(user_id),              -- 1 compte ↔ 1 personne
  UNIQUE(personne_id)           -- 1 personne ↔ 1 compte (révisable si besoin)
)
```

Choix de la **table de liaison** plutôt que d'une **colonne `user_id` dans `personnes`** :
- N'élargit pas la table `personnes` (déjà 60+ colonnes) ni ne touche à ses contraintes/RLS — additif pur, P1.
- Cohérent avec `auth_roles` (même patron « table latérale indexée sur `auth.uid()` »).
- Les `UNIQUE` posent la règle « 1 compte = 1 personne » sans la figer dans `personnes`. Le `UNIQUE(personne_id)` est **révisable** si un jour une personne a plusieurs comptes (peu probable).

> **Cohérence avec Volet A** : si une personne est fusionnée (A) après avoir été reliée à un compte (B), le report doit inclure `auth_personne.personne_id` (= reporter de l'absorbée vers la survivante). À ajouter à l'inventaire §1.5 **le jour où `auth_personne` existe** (elle n'existe pas encore → pas dans la FK actuelle, mais le chantier A doit en tenir compte si B est livré avant la fusion). **Dépendance d'ordonnancement tracée.**

### 2.5 Le modèle des fonctions staff (table dédiée)

`collectif_membre` **ne convient pas** comme réceptacle, prouvé à la source :
- Son `role` est contraint en dur à `('joueur','staff')` (CHECK `collectif_membre_role_check`) → impossible d'y encoder « entraîneur principal ».
- Il est rattaché à **`entente_id`, pas à une catégorie** → or les fonctions staff sont catégorielles (« principal en M14 »).
- Le multi-catégories simultané (Vivien adjoint M14 **+** autre fonction en M16 — décision Manu) exige plusieurs lignes par personne sur des catégories distinctes.

**Forme retenue (P1) : petite table dédiée.**

```
fonction_staff (
  id          uuid PRIMARY KEY default uuid_generate_v4(),
  personne_id uuid NOT NULL REFERENCES personnes(id),
  categorie_id uuid NOT NULL REFERENCES categories(id),   -- la fonction est catégorielle
  fonction    text NOT NULL,        -- liste suggérée + champ libre (pas de CHECK fermé)
  date_debut  date NOT NULL default current_date,
  date_fin    date,                 -- NULL = en cours ; historisable
  cree_par    uuid REFERENCES personnes(id),
  created_at  timestamptz NOT NULL default now(),
  updated_at  timestamptz NOT NULL default now()
)
```

Décisions Manu intégrées :
- **Multi-catégories** : une personne = plusieurs lignes (M14 + M16). ✅ porté nativement (pas de contrainte d'unicité bloquante sur `personne_id`).
- **Liste suggérée + champ libre** : `fonction` est `text` **sans CHECK fermé**. La liste suggérée (entraîneur principal / adjoint / logisticien / référent de catégorie) vit côté **UI** (datalist/suggestions), pas en contrainte base → permet « Alex logisticien » à la main et toute fonction future sans migration. (Un référentiel `fonctions-staff` documentaire JSON peut lister les valeurs suggérées — gouvernance « JSON fait foi » pour un référentiel sans logique, STATE pt 26.)
- **Ajout manuel d'un membre** (Alex) : un simple INSERT (personne_id + categorie_id + fonction). Si Alex n'a pas encore de fiche `personnes`, le geste amont = créer la fiche, puis la fonction. Réutilise la pioche staff de l'écran `u-admin` (STATE pt 28).
- **Historisation** : `date_debut`/`date_fin` permettent de tracer les changements de staff d'une saison à l'autre sans écraser (cohérent avec le datage `collectif_membre`).

> **Note de cohérence** : `fonction_staff` (qui encadre quoi) recoupe partiellement le rôle `staff` de `collectif_membre` (qui appartient au collectif). Ils sont **complémentaires, pas redondants** : `collectif_membre.role='staff'` = « X fait partie du staff de cette entente » (appartenance N1) ; `fonction_staff` = « X occupe telle fonction dans telle catégorie » (rôle fonctionnel). Ne PAS fusionner les deux : niveaux et clés de rattachement différents (entente vs catégorie).

### 2.6 Rôles d'autorisation (inchangé)

`auth_roles` + `has_role`/`get_my_roles` restent **tels quels** pour les vrais droits applicatifs (`admin` aujourd'hui ; demain éventuellement un rôle `coach` si un besoin de droit réel émerge). On **n'y ajoute aucune fonction staff**. L'autorisation fine « voir seulement sa catégorie » reste **hors périmètre** (pas de besoin terrain : un seul compte admin) — réactivable plus tard sur le socle posé (pont §2.4 + rôles).

### 2.7 Sortie Volet B → Production

Chantier Production « Identité & rôles staff », indépendant de A :
1. Table `auth_personne` (pont) + RPC/wrapper « relier mon compte à ma fiche » et « qui suis-je ».
2. Table `fonction_staff` + écran de gestion (lister/ajouter/dater les fonctions staff par catégorie), réutilisant la pioche staff `u-admin`.
3. Référentiel suggéré `fonctions-staff` (JSON documentaire, valeurs proposées en UI).
4. RPC SECURITY DEFINER gardées `has_role('admin')` pour les écritures (patron éprouvé).

**Ordonnancement A↔B** : si B (`auth_personne`) est livré **avant** la fusion A, ajouter `auth_personne.personne_id` au report de fusion (§2.4). Sinon, A passe sans le savoir et B se câble après sur les fiches survivantes. Les deux ordres sont valides ; le seul interdit est de fusionner A *en ignorant* un `auth_personne` déjà déployé.

---

## 3. Synthèse des décisions tranchées

| # | Décision | Trancheur |
|---|---|---|
| A1 | Doublons = **4** (BELKIS, HELM, LACOMBE Baptiste, VOEGELI) | Sonde |
| A2 | Survie = fiche OVAL-E à licence non-NULL ; absorbée = fiche SportEasy | Sonde |
| A3 | Détection = homonymie `unaccent`+date ; licence inexploitable ; faux positifs hors auto | Sonde |
| A4 | Catégorie post-fusion survivante = `joueur_et_staff` (modèle RULFO) | **Manu** |
| A5 | LACOMBE Baptiste = vrai doublon, dans le lot | **Manu** |
| A6 | Audit `cree_par` jamais rempli → non bloquant ; ne pas réécrire l'historique | Sonde + principe |
| A7 | Fusion idempotente + réversible (journal) + dry-run, RPC admin | Patron projet |
| B1 | Concevoir B maintenant (pas de report) | **Manu** |
| B2 | Deux axes séparés : rôle d'autorisation (`auth_roles`) ≠ fonction staff | **Manu** (« les deux selon le rôle ») |
| B3 | Pont `auth↔personne` = table `auth_personne` (1 compte = 1 personne) | Conception P1 |
| B4 | Fonctions staff = table `fonction_staff` (catégorielle, multi-cat, fonction libre, datée) | Conception (multi-cat + liste libre = Manu) |
| B5 | Autorisation fine par catégorie = hors périmètre (pas de besoin terrain) | P1 |
| S | Scission A / B = **deux chantiers Production distincts** | Conception |

## 4. Ce qui n'a PAS été fait / ne doit pas être absorbé

- **Aucun code, aucun SQL exécuté.** Aucune fusion réelle, aucune table créée. Sondes lecture seule uniquement.
- Non rouverts : écran staff pt 28, ADMIN-(ii), bascule millésime, Gouvernance SQL↔JSON, modèles Évènements/Collectif/Doctrine, RPC C12, accroches Suivi.
- Non absorbés : ADMIN-(ii) (6) bascule club v2, réalignement DELETE M8, admin transverse (staff sans catégorie), hygiène Drive, `DATA-SAISON-CODE-FORMAT` 🟢, resync `sql/01`.
- DDL exacts (`ident_fusion_log`, index, signatures RPC) = décisions techniques mineures **déléguées à la Production** (tracer, trancher, enchaîner).

## 5. Passation(s) Production

- **Chantier A — Fusion doublons identité** : §1.8. Prêt. Lot = 4 doublons. Patron aperçu/appliquer + journal + RPC admin.
- **Chantier B — Identité & rôles staff** : §2.7. Indépendant. `auth_personne` + `fonction_staff` + écran fonctions staff + référentiel suggéré.
- **Dépendance unique** : ordonnancement A↔B sur `auth_personne` (§2.4 / §2.7).
