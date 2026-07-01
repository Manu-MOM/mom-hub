# FAIT FOI — Reconduction de saison en un geste (ententes · équipes · collectif) — v1

**Statut : FAIT FOI (spec gelée).** Rédigé le 01/07/2026, validé par Manu (périmètre B) le 01/07/2026.
Conversation : « Reconduction des ententes à la bascule de saison » (suite du pt 134).
Gate d'ouverture vérifié : STATE.md md5 `21bfe117faeef251c0d18a1ccdb73a95` · CARTE.md md5 `c06dfabfff45d39d75a6ceb8e454449e` (valeurs pt 134 conformes, versions Drive du 01/07/2026).

---

## 0. Objet et décision de périmètre

La bascule 2026/2027 (sql/53, `bascule_log` `6b00c94e`, appliquée le 01/07/2026 au matin)
surclasse les joueurs (`personnes.categorie_id`) mais ne reconduit ni les ententes, ni le
rattachement des équipes, ni le collectif. Conséquence : `listEquipes(cat)` (filtre
`saisons.est_active = true`) renvoie `[]` pour toute catégorie, et les ententes 2026/2027
naîtraient avec un vivier `collectif_membre` vide. Le Hub est inutilisable sur la nouvelle
saison tant que la reconduction n'est pas faite.

**Décision Manu (01/07/2026) — périmètre B : LA BASCULE DE SAISON EST UN GESTE UNIQUE.**
Le trou fonctionnel de sql/53 est comblé par une reconduction qui traite, dans une seule
transaction : (1) les ententes, (2) le rattachement des équipes, (3) le collectif. À terme,
l'écran admin-saisons enchaîne bascule joueurs + reconduction comme un seul geste apparent.
Les options « structurel seul » et « deux boutons » sont écartées (blocage réel > confort de
conception). Défaut d'anticipation de sql/53 acté : la chaîne saison → ententes → équipes →
collectif était dans le modèle et aurait dû être couverte dès la conception de la bascule.

## 1. Faits sondés (DS-1, sondes du 01/07/2026 + sources déployées main)

- **F1** — 11 ententes, toutes saison 2025/2026 (`73645edf…`, inactive) : 8 « Solo » (MOM
  pures) + 3 « Permanente » (M14/M16/M19, partenaires SAR `50e8602c…` + ASCS `08b910f7…`,
  `identifiant_sporteasy = 'SAR'`). `club_principal_id` MOM (`af95d630…`) partout. Champs
  convention FFR et `date_mise_en_place` : null sur les 11 lignes.
- **F2** — Le millésime vit dans 3 champs d'entente : `code` (`ENTENTE-M10-2025-2026`),
  `slug` (`…-2025-2026`), `libelle_long` (`· 2025/2026`). `libelle_court` / `libelle_moyen`
  sans millésime. Pattern homogène 11/11.
- **F3** — 13 équipes, toutes `active`, mapping complet vers les 11 ententes (M14 : 3 équipes
  sur l'entente unique). `equipes.code` porte le millésime (`MOM-M10-2025-2026`) ; `code` est
  UNIQUE mais n'est jamais clé de jointure ni de filtre (front : repli d'affichage derrière
  `nom_officiel`/`libelle_court` ; SQL : aucun usage). `nom_officiel` sans millésime.
- **F4** — RLS live : `ententes` write = admin only (conforme sql/24). `equipes` a DIVERGÉ de
  sql/24 : policies `equipes_*_admin_bureau_referent` (admin OU bureau OU
  `puis_je_ecrire_categorie(_b5_categorie_de_equipe(id))`). Sans incidence : la reconduction
  passe en SECURITY DEFINER.
- **F5** — Aucune fonction déployée n'écrit `equipes.entente_id` (sonde pg_proc ; les 3 hits
  du filet — `creer/modifier_evenement_complet`, `appliquer_fusion_identite` — sont des faux
  positifs vérifiés sources). Unique écrivain existant : front `Hub.updateEquipe` (whitelist
  inclut `entente_id`). Terrain vierge pour la RPC.
- **F6** — `collectif_membre` : FK `entente_id NOT NULL … ON DELETE CASCADE`, clé
  `UNIQUE(personne_id, entente_id, role, date_debut)` (sql/44). Vivier actif 2025/2026 :
  288 joueurs + 12 staff (M12 : 4, M14 : 8), zéro ligne close. Staff amorcé uniquement sur
  M12/M14 (sql/55 : staff = liste manuelle, jamais généralisé).
- **F7** — Prédicat joueur éprouvé (sql/55) : `personnes.categorie_personne ILIKE '%joueur%'
  AND categorie_id IS NOT NULL`, entente cible jointe sur `categorie_id`, double garde
  (NOT EXISTS actif sur l'entente + ON CONFLICT DO NOTHING). Catégories sans entente
  (ex-F18) : non amorcées, volontaire.
- **F8** — Patron sql/53 intégralement lu : `_derive_*` privée (REVOKE authenticated),
  `apercu_*` lecture seule, `appliquer_*` recalcul serveur + transaction unique + fail-loud
  (nb écrit = nb attendu) + log. Garde `has_role('admin')`. `bascule_log` est sémantiquement
  dédiée aux personnes (`nb_basculees`) : non réutilisée.

## 2. Spécification de dérivation (gelée)

Tokens de remillésimage, dérivés des lignes `saisons` (aucune constante en dur) :
`tok_slash_src/cib = saisons.code` (`2025/2026` → `2026/2027`) ;
`tok_dash_src/cib = replace(saisons.code, '/', '-')` (`2025-2026` → `2026-2027`).

### 2.1 Volet ententes (11 créations)
Pour chaque entente de la saison source sans homologue (même `categorie_id`) sur la saison
cible : INSERT d'une ligne neuve avec `saison_id = cible` ;
`code`, `slug`, `libelle_long` remillésimés (double replace dash puis slash) ;
`libelle_court`, `libelle_moyen`, `club_principal_id`, `clubs_partenaires_ids`,
`regime_actuel`, `date_mise_en_place`, champs convention FFR, `identifiant_sporteasy`,
`competitions_engagees`, `notes` **copiés à l'identique**. Garde naturelle :
`UNIQUE(saison_id, categorie_id)`.

### 2.2 Volet équipes (13 rebranchements)
Pour chaque équipe `statut = 'active'` dont l'entente est sur la saison source : UPDATE
`entente_id` → entente cible de même `categorie_id`, et `code` remillésimé (même double
replace ; sans effet si le code ne porte pas le token). `nom_officiel` et tous les autres
champs intouchés. Les équipes inactives ne sont pas rebranchées (historique préservé).

### 2.3 Volet collectif (~300 insertions)
- **Joueurs — dérivés de `personnes` (source de vérité post-bascule)** : prédicat F7,
  entente cible jointe sur `p.categorie_id` **et `e.saison_id = cible`** (ajout obligatoire
  vs sql/55, écrit en mono-saison). `role='joueur'`, `statut='regulier'`,
  `date_debut = saisons.date_debut` de la cible, `date_fin = NULL`, `cree_par = NULL`.
- **Staff — copié à l'identique** (non dérivable, F6) : lignes `role='staff'` actives
  (`date_fin IS NULL`) des ententes source → même personne sur l'entente cible de même
  catégorie, `statut` préservé, `date_debut = saisons.date_debut` cible.
- **Double garde sql/55 sur les deux voies** : NOT EXISTS (ligne active même personne ×
  entente cible × rôle) + ON CONFLICT DO NOTHING.
- **Les lignes 2025/2026 ne sont PAS touchées** (ni closes, ni supprimées) : l'historique
  du vivier reste lisible par saison. Catégories sans entente cible : personnes non
  amorcées, comptées dans l'aperçu (groupe `sans_entente_cible`), comportement attendu.

## 3. Architecture (patron sql/53, gelée)

Un fichier SQL (n° suivant la série, style sql_1xx), idempotent, `BEGIN…COMMIT`, bloc
`DO $verif$` fail-loud final, REVOKE anon + PUBLIC :

1. **`reconduction_log`** (table neuve, patron `bascule_log`) : `id`, `saison_source_id` FK,
   `saison_cible_id` FK, `date_application`, `applique_par text`, `nb_ententes int`,
   `nb_equipes int`, `nb_membres int`, `detail jsonb`. RLS : SELECT admin ; écriture
   uniquement via la RPC DEFINER.
2. **`_derive_reconduction(p_saison_source uuid, p_saison_cible uuid)`** — privée, REVOQUÉE
   de authenticated/anon. Retourne l'intégralité du plan : une ligne par objet avec
   `volet` (`entente` | `equipe` | `collectif`), `groupe` (§4), identifiants et libellés.
3. **`apercu_reconduction(source, cible)`** — SECURITY DEFINER, `has_role('admin')`,
   LECTURE SEULE, payload RGPD minimal (nom court pour le volet collectif, jamais
   `personnes` brute).
4. **`appliquer_reconduction(source, cible)`** — SECURITY DEFINER, `has_role('admin')`,
   RECALCULE serveur (ne fait pas confiance à l'aperçu client), transaction unique dans
   l'ordre ententes → équipes → collectif, fail-loud (§5), INSERT `reconduction_log`,
   RETURNS jsonb `{ok, nb_ententes, nb_equipes, nb_membres, log_id}`.

Signature à 2 paramètres explicites (source + cible) : déterministe, aucune inférence
magique de « saison précédente ».

## 4. Groupes de l'aperçu

| volet | groupes |
|---|---|
| entente | `a_creer` · `deja_existante` |
| equipe | `a_rebrancher` · `deja_rebranchee` |
| collectif | `a_amorcer` · `deja_amorce` · `sans_entente_cible` |

Aperçu attendu au premier passage : 11 `a_creer`, 13 `a_rebrancher`, ~300 `a_amorcer`.
Re-run : tout en `deja_*`, appliquer répond `ok` sans écrire (idempotence prouvable).

## 5. Invariants fail-loud (RAISE EXCEPTION → ROLLBACK total)

- nb ententes créées = nb `a_creer` recalculé ; idem équipes et collectif.
- POST : zéro équipe active pointant encore vers une entente de la saison source.
- POST : chaque équipe rebranchée conserve sa catégorie (catégorie de l'entente cible =
  catégorie de l'entente source).
- POST : zéro doublon actif (personne × entente cible × rôle).

## 6. Exploitation et front

**Déblocage immédiat (jour même)** : après déploiement du SQL,
`SELECT public.appliquer_reconduction('<uuid 2025/2026>', '<uuid 2026/2027>');` dans le
SQL Editor suffit — le front n'est pas bloquant. Les UUID complets se lisent via
`SELECT id, code, est_active FROM public.saisons ORDER BY code;`.

**Phase 2 — front (outillage pérenne)** : wrappers `apercuReconduction` /
`appliquerReconduction` (supabase-client.js, patron des 4 wrappers ADMIN-(ii)) ; section
« Reconduction ententes · équipes · collectif » dans admin-saisons (aperçu → appliquer,
patron bascule) ; **enchaînement geste unique** : le bouton Appliquer de l'écran déroule
séquentiellement `appliquer_bascule` puis `appliquer_reconduction` avec restitution
combinée — deux RPC atomiques enchaînées côté UI, pas de méga-RPC (P1 ; si la première
échoue, la seconde n'est pas tentée).

## 7. Décisions tracées (mineures, délégation standard)

- D1 — `equipes.code` remillésimé dans le même geste (F3 : affichage seul, prouvé).
- D2 — `notes` et `competitions_engagees` copiées à l'identique (rien de perdu ; les notes
  périmées — ex. M14 « dette C7 » — s'ajustent après coup via `updateEntente`).
- D3 — Journal dédié `reconduction_log` (F8 : `bascule_log` non détournée).
- D4 — `date_debut` collectif = `saisons.date_debut` de la cible (déterministe, remplace le
  `2025-09-01` en dur de sql/55).
- D5 — Joueurs ré-amorcés en `statut='regulier'` uniformément (patron sql/55 ; les statuts
  fins se re-posent en cours de saison).
- D6 — L'effectif amorcé est celui connu au 01/07 ; l'ajustement départs/arrivées se fera
  naturellement à l'import OVAL-E de rentrée (gestes normaux du Hub, pas de re-run).

## 8. Hors périmètre (dettes tracées, conversations dédiées)

- Audit des replis « M14 en dur » des écrans catégorie-portés (compositions, joueurs,
  pilotage) — le repli de seance-editor.js est corrigé (v1.19), les autres restent à auditer
  même si la reconduction les rend silencieux.
- Renommage cosmétique des policies `equipes_*_referent` (nommage pré-pt 96).
- Vérification que `_b5_categorie_de_equipe` ne filtre pas sur `est_active` (a priori non —
  sinon les encadrants auraient perdu le write equipes le 01/07 au matin ; à confirmer en
  passant lors du livrable SQL).

## 9. Livrables et séquencement

1. **sql_14x_reconduction_saison.sql** (prochain livrable). Sonde d'entrée : colonnes live
   de `collectif_membre` et `equipes` (information_schema) — leçon F4 : la base peut avoir
   divergé des DDL du repo. Validation : `sqlfluff parse`, preuve idempotence.
2. Exécution + `appliquer_reconduction` par Manu → **déblocage**. Recette : `listEquipes`
   non vide, vivier compo non vide, aperçu re-run tout `deja_*`.
3. supabase-client.js (2 wrappers, `node --check`, additivité difflib).
4. admin-saisons.html + js/admin-saisons.js (section + enchaînement geste unique).
5. STATE.md / CARTE.md (head-insertion, versions Drive fraîches demandées avant édition).

Un livrable à la fois, SQL avant front, 1 fichier = 1 commit.
