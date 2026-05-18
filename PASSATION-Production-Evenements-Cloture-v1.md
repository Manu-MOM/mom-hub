# Clôture — Refonte Évènements : build exécuté (Production · Évènements)

*Passation émise par la conv `Production · Évènements` (Refonte Évènements),
18/05/2026. La conv `Production · Évènements` est **CLOSE sur ce cycle** : le build
§5.2 de `Modelisation-Evenements-v1.2.md` est exécuté. Ce qui reste est de la dette
explicitement tracée, hors du couloir de cette conv. À coller en tête de la conv qui
prendra la suite (session RLS write par rôle, ou réconciliation STATE/CARTE).*

## 0 · Lecture protocole (ordre imposé)

1. `CARTE-CONVERSATIONS-MOM-Hub.md` — index maître.
2. `PASSATION.md` — kit générique.
3. `STATE.md` — version Drive vivante (`modifiedTime` vérifié, jamais une copie
   ancienne ; demander à Manu la dernière version avant toute MAJ).
4. Ce message.
5. **`Modelisation-Evenements-v1.2.md` (modèle, fait foi)** + `sous-types-competition.json`
   + **`Conception-Refonte-Evenements-U1-U4-v1.md` (UX, fait foi)**
   + `PASSATION-Conception-Refonte-Evenements-vers-Production.md` (passation d'ouverture).

## 1 · Ce que la conv Production a produit et clos

Build §5.2 exécuté en pas-à-pas, chaque livrable ancré à une décision M1→M8 ou
U1→U4 — jamais une structure inventée (anti-pattern DS-1 tenu : `evenements.html`
a été **demandé**, jamais fabriqué en aveugle). 1 fichier = 1 commit ; titre + corps
fournis pour chacun ; additions prouvées par diff ; accroches Suivi A/B/C non
régressées à chaque commit.

**Vérifications §5.0 closes sur données réelles en base (décisions Production) :**
V1 `type_competition='coupe'` = **0** → suppression nette. V2 `format_de_jeu='5'`
= **0** → suppression nette. V3 répartition (31 lignes) → remap : 14 `competition`
· 17 `entrainement` · 0 `stage`. Aucun `UPDATE` de remap de valeur (hors les
3 remaps de taxonomie V3).

**Incertitude de version résolue sur le code déployé (jamais la doc) :**
`evenements-browser.js` déployé = **v1.13** (STATE/CARTE disaient v1.11, cadrage v1.12 —
doc périmée). `supabase-client.js` déployé = **v1.16**.

**Livrables (ordre de production), tous commités sauf le dernier :**

| # | Livrable | Contenu | État |
|---|---|---|---|
| 1 | `sql/40-migration-evenements-v1_2.sql` | Transaction §5.1 (M1/M2/M4 CHECK + M3/M5 tables + recurrence), bloc vérif post-migration | ✅ commité |
| 2 | `supabase-client.js` v1.17 | M2 `recurrence` whitelist · **régression `addMatchToTournoi`** (parent='tournoi' mort → convention M6) · JSDoc | ✅ commité |
| 3 | `supabase-client.js` v1.18 | Wrappers **lecture** M3/M5 (`getEquipesEngagees`, `getAdversairesEvenement`) · dette write tracée | ✅ commité |
| 4 | `evenements-browser.js` v1.14 | **U3** : regroupement aligné `type_evenement` réel · vue activable, **défaut chrono restauré** (répare régression v1.13) · ordre Compét→Entr→Stage · `showCompet` réaligné | ✅ commité |
| 5 | `evenements-browser.js` v1.15 | **U4 JS** (`competClass` dérive `evt-compet-<code>`, M7) · 3 régressions création réparées (`familleReelle`, conditional fields, G9, code) | ✅ commité |
| 6 | `evenements.html` (a) | **U4 palette §5.4** (classes dérivées, **`compet-fed` supprimé**) · réalignement valeurs (3 familles / 10 sous-types / 7 formats) | ✅ commité |
| 7 | `evenements.html` (b1) | Structure **U1/U2** : blocs Engagement (4a/4b/4c) + Phases + **Bloc 5 Staff désactivé+étiquette** (option b) | ✅ commité |
| 8 | `evenements-browser.js` v1.16 | **U1/U2 logique adaptative** : règle 3 entrées · bascule Phases dérivée du sous-type · lignes répétables · M3/M5 UI honnête non-persistée | ✅ commité |
| 9 | `evenements-browser.js` v1.17 | **Persistance Phases M6** (dette 4 levée) : orchestration 3 niveaux, création progressive | ⏳ **à commiter** |
| — | RPC `sql/11` | **Vérification close — aucune modif** : relais brut, contrat 16 colonnes intact, zéro logique sur les valeurs | ✅ vérifiée |

Périmètre conv Production = **CLOS** sur ce cycle. Le §5.2 ne se rouvre pas sans
raison neuve forte.

## 2 · Le modèle, l'UX, le build en bref (ne pas re-trancher)

**Modèle (v1.2, fait foi) et UX (U1→U4, fait foi) : non rouverts.** Le build s'y est
strictement conformé. Rappels structurants tenus : 3 familles `competition/
entrainement/stage` (M1) · 10 sous-types `type_competition` Compétition only (M1) ·
`recurrence` JSONB (M2) · liaison `evenement_equipes_engagees` + `evenement_adversaires`
(M3/M5, additives) · 7 formats (M4) · phases 3 niveaux via `evenement_parent_id` +
`phase_libelle`, **un match reste une ligne `evenements`** (M6) · `evenement_encadrants`
déjà déployée (M8) · CHECK relâchés au minimum, cohérence fine = UI/RPC (P4). UX :
fenêtre adaptative (extension `updateCreateConditionalFields`, pas un wizard) ·
5 blocs · question Phases dérivée du sous-type · Bloc 5 désactivé tant que P2-E.4 ·
calendrier vue activable défaut chrono · palette §5.4, `compet-fed` disparaît.

## 3 · Ce que la conv suivante doit faire (lever les 3 dettes restantes)

Les trois dettes partagent **une cause racine unique** : la décision « qui a le
droit d'écrire quoi » (RLS write par rôle) n'est pas prise, et c'était **déjà un
chantier séparé préexistant au STATE** (`sql/10` + v1.2 §8). Les lever ensemble
dans cette session dédiée est le geste logique — pas de contournement local.

- **Dette 1 — Écriture M3/M5.** `evenement_equipes_engagees` /
  `evenement_adversaires` : RLS SELECT-only, aucune policy ni wrapper write.
  À livrer : policies write par rôle + wrappers `addEquipeEngagee` /
  `addAdversaire` (+ contrat d'appel calé sur l'UX §2.4/3.2 désormais connue) +
  câblage `submitModalCreate` (l'UI Engagement est déjà livrée et adaptative,
  v1.16, étiquetée non-persistée — il suffira de retirer l'étiquette et brancher
  le submit, **rien à redessiner**).
- **Dette 2 — Staff (P2-E.4).** Même nature sur `evenement_encadrants`
  (déployée, RLS SELECT-only). Décision Manu déjà prise : option b. Bloc 5
  présent + désactivé + étiquette (HTML b1). À livrer : policies write +
  CRUD/UI. Réversible : dette levée → bloc s'active sans rien redessiner.
- **Dette 3 — Listing `equipes`.** Aucun wrapper de listing des équipes
  (module mono-équipe M14 hardcodé). À livrer : wrapper lecture
  `listEquipes(...)`. ⚠️ Le **filtrage exact** (catégorie/club) = décision
  métier explicitement « vérification Production, non présumée » (UX §2.4/4a,
  §7) — à trancher avec Manu, **ne pas inventer**.

Dette 4 (persistance Phases M6) = **levée** par `evenements-browser.js` v1.17.

## 4 · Ce que la conv suivante NE doit PAS faire

- Ne pas rouvrir M1→M8 (modèle v1.2 tranché) ni U1→U4 (UX tranchée) ni
  ré-inventer une structure « parce qu'il en faut une » (DS-1).
- Ne pas toucher `STATE.md` / `CARTE-CONVERSATIONS` (cadrage §F). Réconciliation
  différée, dette « Refonte Évènements (b) ».
- Ne pas absorber les bugs hors périmètre : **`SUIVI-CLIENT-1`** (compo non
  affichée côté bénévole, 🔴 conv module bénévole) ; **bug SQL `evenement_uuid`**
  (Suivi backend, conv `Production · Suivi de rencontre (backend C12)`).
- Ne pas « bricoler » un contournement write local pour M3/M5/Staff : c'est la
  session RLS write par rôle qui tranche, globalement et une fois.

## 5 · Vérifications & invariants portés (preuves)

- **Invariant Suivi non négociable tenu.** Un match reste une ligne `evenements`
  → `compositions.evenement_id` (et **non** `evenement_uuid` — `sql/18` déployé
  fait foi, STATE gouvernance pt 9). Accroches Suivi A/B/C (Objets A/B/C de
  `SUIVI-COACH-1`) : **38 = 38** fonctions inchangées à chaque commit JS ;
  **4 = 4** appels RPC C12 réels inchangés (v1.18). L'orchestration Phases v1.17
  crée chaque match comme vraie ligne `evenements`, jamais imbriqué.
- **Façon 1 tenue.** Socle relationnel conservé ; `compositions`/`presences`/
  `sites` inchangés ; M1→M8 = extensions + 2 tables additives ; aucune réécriture
  document ; aucune fonction C12 touchée.
- **Régressions actives détectées et réparées** (introduites par la migration,
  pas par l'UX) : `addMatchToTournoi` (v1.17 supabase-client), création modale
  envoyant un `type_evenement` mort (v1.15), redirect G9 mort (v1.15).
- **DS-1 tenu.** `evenements.html` demandé puis fourni, jamais fabriqué en
  aveugle. Wrappers write M3/M5 **non inventés** (faux silencieux refusé,
  cohérent UX §2.5).
- `sql/40` **n'est pas idempotent** : suite d'`ALTER`/`CREATE` en transaction,
  bloc `DO` de vérification post-migration avec `RAISE EXCEPTION` → ROLLBACK si
  incohérent.

## 6 · Restes hors périmètre — à Manu

- **Session RLS write par rôle** (chantier préexistant `sql/10` + v1.2 §8) :
  lève **dettes 1, 2, 3** ensemble. C'est la conv suivante naturelle de la chaîne.
- **Réconciliation `STATE.md` / `CARTE-CONVERSATIONS`** : ultérieure, depuis la
  version Drive **vivante** (`modifiedTime` vérifié — **demander à Manu la
  dernière version avant toute MAJ**), édition chirurgicale, dette « Refonte
  Évènements (b) » → chaîne Audits → Conception → Production · Évènements →
  (session RLS write). Le couloir Production · Évènements y est désormais
  **résolu** : `evenements-browser.js` **v1.17**, `supabase-client.js` **v1.18**,
  `evenements.html` réaligné, `sql/40` migré.
- **Gouvernance §A** (gestion des conv closes vs lignée séparée) et **dépôt
  Drive §B** : décisions de Manu, hors de ce cycle.
- **Action immédiate restante :** commiter `evenements-browser.js` v1.17
  (titre/corps déjà fournis), et déposer ce fichier de passation dans
  Drive `00 - Documentation/` (1 fichier = 1 commit).

*Fin de passation. La conv `Production · Évènements` est close sur ce cycle :
modèle v1.2 et UX U1→U4 non rouverts, invariants Suivi/`compositions.evenement_id`/
Façon 1 tenus et prouvés, 3 dettes convergentes pointées vers la session RLS write
par rôle. STATE/CARTE non touchés (cadrage §F).*
