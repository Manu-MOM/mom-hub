# Kit de passation — prochaine conversation

## Nom proposé pour la conv
**`Production · Rapport de match — stockage du saisi (2e temps)`**
*(variante courte : `Prod · Rapport — saisi v1`)*

> La 1re session a livré le **socle = rapport de match en lecture seule du déduit** (pt 53).
> Celle-ci attaque le **2e temps = le SAISI** : ce que l'éducateur écrit lui-même
> (verdict, bilan), qui rend le rapport éditable et débloque le statut Finaliser/Rouvrir.

---

## Point de départ
- **pt 53 gravé** : `compositions-editor.js` v3.50 `59c010d4`, `compositions.html` `70448c97`,
  `supabase-client.js` v1.44 (intact), zéro SQL touché au pt 53.
- **Vérifier d'abord que le pt 53 est bien déposé au Drive** `00 - Documentation/`
  (STATE + CARTE), puis partir du STATE courant. Gate md5/`modifiedTime` obligatoire.
- Supabase ref : `fvfqffxaiaoygqhjtxwr` · M14_TEAM_UUID : `bfb83b83-83ef-4dde-b526-48ff87313044`.
- Cas de test réel : match **VS NORD ALSACE** `b39d82bc-55c4-4c39-9684-ca022446d2ae`
  (racine Challenge Vié `1c5c5bcd-4263-41b8-a8aa-bd6930199137`).
- **Sonde base impossible côté Claude** (domaine hors allowlist) → **Manu exécute les requêtes SQL.**

## Objet de la session
Implémenter le **stockage du saisi** du rapport de match : le verdict de l'éducateur
(à froid), distinct du déduit (calculé). C'est le prérequis (a) du modèle pt 52,
explicitement reporté en 1re session.

---

## LA décision structurelle à trancher EN PREMIER (avant tout code)
**Où stocke-t-on le saisi ?** Deux options du modèle pt 52, à arbitrer avec Manu
APRÈS sonde du schéma réel :

1. **Champ JSONB sur la racine `evenements`** (ou sur l'événement-match).
   - Léger, pas de table neuve, cohérent P1.
   - À sonder : `evenements` a-t-il déjà une colonne libre (notes/JSONB) réutilisable ?
2. **Nouvelle table `rapports`** (1 ligne par match, FK vers l'évènement).
   - Plus structuré, plus extensible (phase/tournoi plus tard).
   - Coût : migration SQL + RLS + RPC d'écriture SECURITY DEFINER.

→ Touche le **modèle de données** = migration SQL = **Manu exécute en base**, domaine
   bloqué côté Claude. **Sonder le schéma `evenements` réel à la source AVANT de trancher**
   (anti-hypothèse DS-1 ; ne pas présumer l'existence d'une colonne).

## Champs du saisi à cadrer (modèle pt 52, pour mémoire)
- **Match (socle)** : observations Cat B « à froid » + **bilan** (texte libre éducateur).
- **Statut provisoire / finalisé**, piloté MANUELLEMENT (boutons **Finaliser / Rouvrir**).
- Rapport **TOUJOURS éditable ET exportable** quel que soit le statut → le statut est une
  **mention** (sur vue + export), **PAS un cadenas**. Rouvrir = enrichir.
- Phase / tournoi : le saisi se rattache à la **racine du tournoi** (vues dérivées) —
  mais **NIVEAU MATCH d'abord**, ne pas tout faire d'un coup.

## Découpage prod suggéré
1. Trancher le stockage (décision modèle + sonde schéma).
2. Migration SQL (Manu exécute) + RPC d'écriture si table neuve (SECURITY DEFINER,
   RLS, patron des RPC existantes ; `personnes`/écritures passent par RPC dans ce projet).
3. Wrapper(s) client dans `supabase-client.js` (additif, prouvé par diff md5).
4. UI dans l'onglet Rapport (`compositions-editor.js`/`compositions.html`) :
   zone de saisie du bilan + boutons Finaliser/Rouvrir + mention de statut.
   Le rapport reste éditable ET imprimable (le bouton Imprimer v3.50 existe déjà).

## Ce qui existe déjà et NE DOIT PAS être rouvert (acquis pt 53)
- Onglet « Rapport » câblé (`renderEditorRapport`, `bindViewTabs` tabs[3]).
- Déduit complet (score / familles / substitutions / fil chronologique) — lecture seule.
- Cadre charte clair + bouton Imprimer/PDF + `@media print`.
- Résolution des noms via `SupabaseHub._resolveNoms` (get_noms_personnes).
- Agrégation 100 % front, référentiel `data/observables-match.json`.

## Doctrine (inchangée)
- Lire le code **à la source** avant d'affirmer ; **sonder le schéma réel** avant de bâtir.
- **Fichier complet, jamais de patch** ; **1 fichier = 1 commit** (titre + corps fournis sans demander).
- `node --check` sur chaque JS ; **vérifier le md5 APRÈS chaque copie ET après chaque déploiement**
  (leçon pt 53 : un redéploiement d'une ancienne version a régressé `main`, rattrapé par le md5).
- Décisions structurelles tranchées avec Manu (boutons) ; décisions mineures tranchées + tracées.
- SQL fail-loud (invariants explicites, idempotence, transactions sécurisées).

## Dettes / faits à garder en tête
- **`SUIVI-COACH-7`** : substitutions — `joueur_uuid_entrant` EST stocké (bonne nouvelle pt 53),
  mais `minute_match` peu fiable → temps de jeu fiable reste un chantier backend (hors 2e temps saisi).
- **Voie compo-réduite COACH non déployée** (`get_compo_reduite_rencontre_coach` absente) —
  contournée par `get_noms_personnes`. À noter si un écran coach a besoin d'une compo réduite authentifiée.
- **`minute_match` non fiable** sur les données live actuelles (dégradation honnête en place).

## Pour ouvrir la conv
Soit coller ce kit, soit simplement dire **« reprends le pt 53, on attaque le stockage du saisi »**.
