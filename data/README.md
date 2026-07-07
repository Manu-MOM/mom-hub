# MOM Core — Données de référence

Ce dossier contient les **référentiels métier** du MOM Hub, en miroir du Drive Google.

## ⚠️ Source de vérité

**La source de vérité reste Google Drive**, dans le dossier `MOM Hub / 01 - Référentiels/`.
Ce dossier `data/` est un **miroir** synchronisé manuellement par l'administrateur.

## 📁 Fichiers attendus

| Fichier | Source Drive |
|---|---|
| `poles.json` | `01 - Référentiels/poles.json` |
| `categories.json` | `01 - Référentiels/categories.json` |
| `clubs.json` | `01 - Référentiels/clubs.json` |
| `postes.json` | `01 - Référentiels/postes.json` |
| `aptitudes.json` | `01 - Référentiels/aptitudes.json` |
| `ateliers.json` | `01 - Référentiels/ateliers.json` |
| `observables-match.json` | `01 - Référentiels/observables-match.json` |
| `tests-physiques.json` | `01 - Référentiels/tests-physiques.json` |
| `conformite-ffr.json` | `01 - Référentiels/conformite-ffr.json` |

## 🔄 Procédure de mise à jour

Quand un référentiel est modifié sur Drive :

1. **Sur Drive** : télécharge la nouvelle version du fichier (clic droit → "Télécharger")
2. **Sur GitHub** : va dans le dossier `data/` du repo `mom-hub`
3. Clique sur le fichier à remplacer
4. Clique sur l'icône crayon (✏️) en haut à droite ou utilise le bouton "Edit"
5. Ou utilise "Add file" → "Upload files" pour remplacer en glisser-déposer
6. Commit le changement avec un message clair, ex : `MAJ categories.json v1.2`

## 🚫 Ce qui n'est PAS dans ce dossier

Pour des raisons de **confidentialité**, les fiches Personne (joueurs, parents, staff)
**ne sont pas miroitées** dans ce repo public. Elles restent uniquement sur Drive.

Le Hub n'aura accès aux données nominatives que dans une **phase ultérieure**, via une
architecture qui préservera leur confidentialité (authentification, repo privé, ou backend
séparé — décision à prendre Phase 3+).

## 🗓️ Données saisonnières (hors miroir Drive)

Par exception à la doctrine du miroir, ce dossier héberge aussi des **fichiers
saisonniers** produits directement pour le Hub (pas de source Drive) :

| Fichier | Contenu | Geste de rentrée |
|---|---|---|
| `vacances-feries-<saison>.json` | Fériés Alsace-Moselle + vacances scolaires zone B (académie de Strasbourg) de la saison, repères informatifs des agendas logistiques | Chaque été, générer le fichier de la saison suivante (fériés : calendrier.api.gouv.fr jeu alsace-moselle ; vacances : arrêté JORF via Service-Public), le commiter sous son nom millésimé — item de la checklist de bascule de saison |

Convention interne : dates ISO, fin de période INCLUSIVE — documentée dans le champ
`convention` du fichier lui-même. Les pages consommatrices sont fail-soft : fichier
absent ou invalide → agendas fonctionnels sans les repères.

## 📅 Dernière synchronisation

À mettre à jour à chaque commit qui touche ce dossier :

- **2026-05-XX** — Première mise en place du miroir (référentiels v1.0/v1.1)
- **2026-07-07** — Ajout `vacances-feries-2026-2027.json` (chantier AGENDA-VACANCES-FERIES)
