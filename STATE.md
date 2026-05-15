# MOM Hub · STATE.md
**État global du projet au 15 mai 2026**

---

## 📊 Récapitulatif exécutif

| Aspect | Statut | Détail |
|--------|--------|--------|
| **Phases complétées** | 5 / 5.12 (BIS, TER) | Préparation de séance finalisée avec encadrants dynamiques |
| **Modules repo** | 4/4 actifs | Accueil, Compositions, Séances, Ateliers |
| **Référentiels** | 7/7 | postes, ateliers, aptitudes, conformité FFR, observables, tests, encadrants |
| **Commits prêts** | 3 | seance-editor v1.10 TER, seance.html ctx, STATE.md |
| **Prochaine conv** | Joueurs/Événements | Phase 5.13 — Core Joueur + gestion événements |

---

## 🏗️ Architecture repo

### **Dossier `/` racine**
```
mom-hub/
├── index.html                    (Accueil, portail modules)
├── seance.html                   (Préparation séance, Phase 5.12)
├── compositions.html             (Compositions, Phase 4.4)
├── css/
│   ├── hub.css                   (Thème MOM + variables globales)
│   ├── compositions.css
│   └── seance.css
├── js/ (ou intégré inline)
│   ├── supabase-client.js       (v1.8.6, RPC wrappers)
│   ├── seance-editor.js         (v1.10 TER, IIFE)
│   └── compositions-editor.js   (v2.1.5)
├── data/
│   ├── propositions-seance.json (v1.0, matériel + méta + Axe 4)
│   ├── encadrants-par-categorie.json (v1.0, NEW — sync dynamique)
│   ├── fiches-all.json          (~140 KB, 62 fiches atelier)
│   ├── types-blocs.json
│   ├── vocabulaire-seance.json
│   ├── groupes-joueur.json
│   └── [autres referentiels]
├── assets/
│   └── logo-m2m.png
└── README.md
```

### **Dossier Drive `/01 - Référentiels`** (7 fichiers)
```
01 - Référentiels/
├── postes.json (v1.1)
├── ateliers.json
├── aptitudes.json
├── conformite-ffr.json
├── observables-match.json
├── tests-physiques.json
└── encadrants-par-categorie.json (v1.0, NEW — 15 mai)
   └── 7 encadrants M14 (Emmanuel Jung, Milan Gonthier, Vivien Rulfo, etc.)
```

---

## 📋 Phases complétées

### **Phase 5 — Préparation de séance** ✅

#### **Phase 5.5 (Clos 14 mai)**
- [x] Éditeur formulaire 6 champs méta + autosave 30s
- [x] 5 champs secondaires (météo, encadrants, objectifs, bloc_cycle, matériel global)
- [x] 2 dropdowns (lieu, événement)

#### **Phase 5.6 (Clos 14 mai)**
- [x] Trame chronologique (table blocs triée par horaire)
- [x] Actions bloc (↑ ↓ 🗑 avec repli/dépli du form méta)

#### **Phase 5.7 (Clos 14 mai)**
- [x] Éditeur détail bloc (10 champs FFR Axe 4)
- [x] Comportements attendus + organisation spatio-temporelle

#### **Phase 5.8 (Clos 14 mai)**
- [x] Picker ateliers (62 fiches rattachées par bloc)
- [x] Recherche insensible accents, Drive link enrichi

#### **Phase 5.9 (Clos 14 mai)**
- [x] Groupes G1/G2/G3 par bloc (perf/dev/init)
- [x] Vivier M14 enrichi (Phase 4.3 ✅)

#### **Phase 5.12 (Clos 15 mai)**
- [x] Propositions-seance.json v1.0 (208 entrées, 4 sections)
- [x] Picker matériel (20 items + saisie libre)
- [x] Datalist méta/bloc/Axe 4 dynamiques
- [x] Document Word MOM-Hub_propositions-seance-V1.0.docx uploadé Drive

#### **Phase 5.12 BIS (Clos 15 mai, 11h)**
- [x] Datalist "Autres…" filtré HTML (marqueur éditeur only)
- [x] Picker matériel tags multi-select (pattern cohérent)
- [x] seance-editor.js v1.9 BIS (3739 lignes, 154 KB)

#### **Phase 5.12 TER (Clos 15 mai, 15h)** 🆕
- [x] Encadrants synchronisés par catégorie (cat-m14 = 7 staff)
- [x] Référentiel `data/encadrants-par-categorie.json` v1.0 créé + Drive
- [x] `loadEncadrantsForCategorie()` + init async dans seance-editor.js
- [x] Variable globale `window.momSeanceContext` (categorie_uuid, equipe_uuid)
- [x] Pattern dynamique : catégorie → fetch encadrants → datalist picker
- [x] seance-editor.js v1.10 TER (3763 lignes, 155 KB)
- [x] seance.html v1.10 TER (variable contexte + 2172 lignes)

---

## 🔧 Versions dépendances

| Package/Module | Version | Rôle | État |
|--------|---------|------|------|
| supabase-js | ~2.x | Auth + DB | ✅ v1.8.6 stable |
| seance-editor.js | v1.10 TER | IIFE éditeur | ✅ 15 mai, loadEncadrants |
| seance.html | Phase 5.12 TER | Template | ✅ window.momSeanceContext |
| propositions-seance.json | v1.0 | Datalist + matériel | ✅ 208 items |
| encadrants-par-categorie.json | v1.0 | Ref staff par cat | ✅ NEW, 7 encadrants M14 |
| compositions-editor.js | v2.1.5 | Phase 4.4 | ✅ Stable |

---

## 📍 Points clés doctrine Phase 5.12 TER

### **Synchronisation encadrants**
```
Utilisateur connecté (cat-m14)
  ↓
window.momSeanceContext.categorie_uuid = 'cat-m14'
  ↓
loadEncadrantsForCategorie() fetch data/encadrants-par-categorie.json
  ↓
State.encadrantsRef = [...] (7 encadrants M14)
  ↓
Picker datalist (mêmes patterns que matériel)
  ↓
seance.encadrants_text = "Emmanuel Jung, Milan Gonthier, ..."
```

### **Simplicity rules**
1. **Pas de complexité AJAX multi-tour** : categorie en variable globale
2. **Fichier JSON éditable à la main** : ajouter/retirer encadrants sans code
3. **Picker identique matériel** : cohérence UI/UX, zéro duplicata code
4. **Saisie libre active** : coach peut ajouter ad-hoc (pas en liste)

### **Whitelist updateSeance**
```javascript
// Seuls ces champs sont patchables :
{
  date_seance, heure_debut, duree_seance, effectif_prevu,
  theme_seance, axe_travail_general, meteo_text, encadrants_text,
  objectifs_text, bloc_cycle, materiel_global_text,
  lieu_id, evenement_id, contenu_pedagogique_axe4_global,
  notes_seance
}
// Pas de patch direct sur etat, seance_id, timestamps, etc.
```

### **Brouillons vides (Phase 5.10)**
Bug doctrinal : `loadBrouillonsVides()` appelé dans init mais pas utilisé. À remontrer après création d'une séance pour vider le brouillon du compteur.

---

## 🚀 Prochaines phases (pipeline)

### **Phase 5.13 — Joueurs & Événements** (Conv suivante)
- **Joueur** : Core entity, attributs (prénom, nom, date_naissance, positions, etc.)
- **Événement** : match, préparation, tournoi (lié aux séances)
- **Kickoff** : doc prêt en `/mnt/user-data/outputs/kickoff-conv-joueurs-evenements.md`

### **Phase 5.14+** (À définir)
- Bilan séance (Phase 5.10 postponé)
- Rapports statistiques (Phase 5.11 postponé)
- Intégration OVAL-E (FFR license management) - **NOM CORRECT avec A**

---

## 📁 Fichiers livrés Phase 5.12 TER

| Fichier | Taille | Ligne | Statut | Destination |
|---------|--------|-------|--------|-------------|
| seance-editor.js | 155 KB | 3763 | ✅ À uploader | `/js/seance-editor.js` |
| seance.html | 62 KB | 2163 | ✅ À uploader | `/seance.html` |
| encadrants-par-categorie.json | 4 KB | 85 | ✅ Uploadé Drive | `01 - Référentiels/` (fileId: 1KydxHRx6YF6hRyE6mjbAgFIbFWze_kgg) |
| STATE.md | Ceci | — | ✅ À uploader | `/` ou `outputs/` |

---

## ⚡ Checklist avant production

- [ ] seance-editor.js v1.10 TER testé sur séance existante
- [ ] Variable `window.momSeanceContext` visible en DevTools
- [ ] `data/encadrants-par-categorie.json` accessible via fetch
- [ ] Picker encadrants popup (tags cliquables)
- [ ] Saisie libre fonctionnelle
- [ ] Autosave réagit à modifs encadrants
- [ ] Drive links `encadrants-par-categorie.json` statables (cache 7j)
- [ ] STATE.md en `/` du repo (symlink ou copie)

---

## 📝 Leçons doctrinales consolidées

### **De Phase 5.12 TER**
1. **Synchronisation dynamique > statique** : référentiel centralisé, load au démarrage
2. **Variable contexte globale** : simple, pas d'API layer
3. **Éditable JSON** : Manu peut ajouter/retirer staff sans déploiement
4. **Pattern réutilisé** : matériel → encadrants → [futur: lieux?]
5. **Fallback saisie libre** : robustesse si champ manquant/mal nommé

### **Bug connu à corriger post-TER**
- `loadBrouillonsVides()` appelé mais pas utilisé ← appeler après création séance pour vider le compteur brouillon

### **Vocabulaire MOM Hub stabilisé**
- **MOM** = Mutzig Ovalie Molsheim (club)
- **SAR** = Structure partenaire ateliers (coach invité)
- **OVAL-E** = Plateforme FFR license management (avec A)
- **Référent** = Coach principal catégorie (Emmanuel Jung pour M14)
- **Encadrants** = Staff (coachs, entraîneurs, assistants)

---

## 🔐 Sécurité & Confidentialité

- Aucun identifiant personnel (email, tel) stocké en public
- Encadrants = prénoms + noms (publics au club)
- Drive access control via dossier Drive partagé
- Cache navigateur 7j sur fiches + propositions + encadrants

---

**Document généré : 15 mai 2026, 15h30**
**Prochaine maj attendue : Après Phase 5.13 (Joueurs/Événements)**
