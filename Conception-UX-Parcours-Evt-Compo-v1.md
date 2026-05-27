# Conception UX — Parcours Évènement → Compo & fluidité

*Document de conception · v1 · 26 mai 2026 · Conv `Conception · Audit UX parcours Évènement→Compo & fluidité`*

> **Nature du document.** Sortie « UX » de la conv. Conception **pure** : zéro code, zéro SQL, zéro mockup pixel-perfect. Décisions de conception ancrées au modèle déployé (`Modelisation-Evenements-v1.2.md`, `Modelisation-Collectif-Compo-3-Niveaux-v1.md` v1.1, STATE pt 17) — le code/modèle déployé fait foi, jamais le doc. Tranché avec Manu en pas-à-pas (~37 décisions Q-A1 → Q-A37). À déposer Drive `00 - Documentation/` (1 fichier = 1 commit).

> **Périmètre acté Q3 PASSATION (b) élargi.** Refonte UX modale création évènement + écran d'accueil Évènements + fiche évènement avec bannière + navigation Évènements↔Compositions. Hors périmètre : `groupe-base.html` (U-N2, déjà livré pt 15), `compositions.html` (U-N3, déjà livré pt 16), pas de refonte modèle (invariant PASSATION §5). Doctrine v1.2 → v1.3 candidat UX-PARCOURS-NAV cadré §5 mais non instruit (Q-A4 (ii) acté = conv suivante).

> **Articulation conversations.** Cette conv produit la **conception UX**. La conv `Production · Refonte UX modale création évènement` à ouvrir exécutera l'implémentation (RPC composite, refonte modale, fiche évènement, écran d'accueil) en cohérence avec ce doc.

---

## §0 · Cadre & sources

### 0.1 · Périmètre conv

| Inclus (décidé ici) | Hors périmètre |
|---|---|
| Refonte UX modale création évènement (5 modes adaptatifs) | Exécution SQL / code (→ conv Production) |
| Refonte UX écran d'accueil Évènements (filtres + vignettes) | Refonte modèle `evenements` v1.2 (invariant PASSATION §5) |
| Conception fiche évènement avec bannière 2 niveaux + 8 liens fonctionnalités | `groupe-base.html` (U-N2 livré pt 15) |
| Navigation Évènements ↔ Compositions/Suivi/etc. | `compositions.html` (U-N3 livré pt 16) |
| Décisions de conception consolidées (§4) | Doctrine v1.2 → v1.3 (chantier `UX-PARCOURS-NAV` reporté conv suivante) |
| Mini-cadrage dette `UX-PARCOURS-NAV` pour facilitation conv suivante (§5) | Module bénévole Suivi (cycle clos, hors couloir) |

### 0.2 · Sources lues à la source (jamais en mémoire)

**Modèle déployé (fait foi)** :
- `Modelisation-Evenements-v1.2.md` (M1→M8, doctrine §1.3 P4 « Hub avertit, ne bloque pas »)
- `Modelisation-Collectif-Compo-3-Niveaux-v1.md` v1.1 (N1 `collectif_membre`, N2 `equipe_engagee_membre` joueur|staff, frontière N2↔M8)
- `STATE.md` pt 17 (état post-livraison Collectif complet a+b+c+d+e, dette `UX-PARCOURS-EVT-COMPO` ouverte = cadrage Manu fin pt 16)

**Captures terrain Manu (4 lues à la source)** :
- Écran d'accueil Évènements MOM Hub actuel
- Modale Nouvel évènement mode Entraînement (2 captures bout en bout)
- Modale Nouvel évènement SAR×MOM mode Tournoi (référence comparative)
- Écran Calendrier SAR×MOM (référence comparative filtres)

**Aucune source inventée** : tout fait référencé dans `Modelisation-Evenements-v1.2.md`, `Modelisation-Collectif-Compo-3-Niveaux-v1.md` v1.1, ou capture Manu lue. Discipline pt 17 anti-fabrication tenue.

### 0.3 · Gate de version au démarrage de conv (rappel pt 17)

- `STATE.md` md5 `1a09244b…` → préfixe attendu PASSATION §0 ✅
- `CARTE-CONVERSATIONS-MOM-Hub.md` md5 `cfdc1841…` → préfixe attendu ✅
- `PASSATION-Conception-UX-Parcours-Evt-Compo-Ouverture.md` md5 `32a461c5…`
- Drive resync confirmé Manu (Q1 actée)

### 0.4 · Méthode de conception (rappel Q-A1→Q-A3 actées)

- **Q-A1** Proposition A actée : modale adaptative unique « SAR×MOM-like, sans renier MOM Hub » — supprime la rupture en 2 contextes (modale création + fiche évènement post-création) qui crée le ressenti UX-2a Manu *« lourd »*
- **Q-A2** Mode (c) intermédiaire : 2 sections détaillées + wrap-up final
- **Q-A3** Niveau (β+γ) ASCII + spec comportementale + maquette Visualizer sur écran phare

**Méthode terrain effective** : walkthrough live abandonné précocement au profit d'analyse comparative (capture SAR×MOM Manu utilisée comme référence positive partielle), suivi de 4 maquettes interactives Visualizer validées une à une, et collecte itérative des signaux terrain Manu (15 signaux apportés en cours de conv, ayant débloqué F11→F23).

---

## §1 · Recensement à la source (constat)

### 1.1 · Écran d'accueil Évènements MOM Hub actuel

**Lecture à la source de la capture (faits, pas interprétation)** :

- Bandeau haut MOM Hub / Mutzig Ovalie Molsheim · pastille saison · menu *Tableau de bord / Mes outils (actif) / Annuaire / Configuration*
- Titre **« MES ÉVÈNEMENTS — M14 SAR×MOM »** · sous-ligne *« 27 évènement(s) chargé(s) · 90 jours à venir, 30 jours passés »*
- 2 cartouches à droite : **12 À VENIR** + **9 PASSÉS** (total 21, pas 27 — écart 6 non clarifié)
- Barre de recherche
- **2 lignes de filtres pills** : TYPE [Tous/Compétition/Entraînement/Stage] + COMPÉT. [Toutes/Match de championnat/Phase 1/Phase 2/Phases Finales/Match amical/Plateau/Tournoi/Challenge Vié/Challenge Inter-Ligues/Seven] = **11 boutons COMPÉT.**
- Bouton encadré séparé *« Grouper par catégorie »*
- Liste démarre par **« PASSÉS · 9 »** zone grisée → l'éducateur arrive sur le passé en premier
- Panneau droit : calendriers MAI/JUIN 2026 avec points · encart AIDE · **bouton vert flottant** en bas à droite **« + NOUVEL ÉVÉNEMENT »**

### 1.2 · Modale « Nouvel évènement » MOM Hub actuel (mode par défaut Entraînement)

Ordre des champs lus à la source :

1. TYPE D'ÉVÈNEMENT \* (3 radios)
2. COMMENT COMMENCER ? (2 radios : Créer vierge / Dupliquer)
3. LIBELLÉ \* (texte libre)
4. DATE DÉBUT \* (picker date+heure)
5. DOMICILE / EXTÉRIEUR (dropdown 3 valeurs)
6. SITE (dropdown sites + helper texte libre fallback)
7. ADVERSAIRE (OPT.) (texte libre singulier)
8. STAFF PRÉSENT (champ désactivé, message *« Saisie à venir P2-E.4 »*)
9. Pied : Annuler / Créer l'évènement

**Mode Compétition (récit verbal Manu, disposition exacte non vérifiée à la capture)** : ajoute *type de compétition* + *Format de Jeu*. ADVERSAIRE reste mais *« n'amène rien à ce stade »* (verbatim Manu).

### 1.3 · Modale SAR×MOM mode Tournoi (capture comparative)

Pour mise en perspective : TYPE scalaire unique (« Tournoi ») · DATE picker · NOM/JOURNÉE · **LIEU 1 champ texte libre** · **ÉQUIPES ENGAGÉES checkboxes inline** · **FORMAT PAR ÉQUIPE dropdown par équipe** · **PHASES ET MATCHS blocs structurés** · helper *« La compo de base s'applique à tous les matchs »*.

### 1.4 · Constat structurant (hypothèse 1 PASSATION §1 confirmée par le fait)

**MOM Hub organise la modale autour de la structure du modèle de données** (famille → sous-type → format global → adversaire singulier → équipes engagées DIFFÉRÉES à la fiche évènement post-création). **SAR×MOM organise la modale autour de l'intention utilisateur** (« je crée un Tournoi le 26/05, avec SAR/MOM 1 en XV et SAR/MOM 2 à 10, voici les phases — clic Créer, c'est fini »).

Le modèle v1.2 doctrine §1.3 P4 + cohérence fine UI/RPC **autorise les deux organisations UX**. Le différé post-création (M3/M4/M5/M6 en 2ᵉ temps) crée le ressenti UX-2a Manu *« lourd »* : 2 contextes mentaux, 2 modales, parcours en deux temps, là où SAR×MOM le fait en 1 modale 1 contexte.

**Avantage différentiel MOM Hub à préserver** : (a) distinction famille Entraînement/Stage/Compétition mentale claire, (b) option « Dupliquer évènement précédent » (vraie valeur terrain), (c) info structurée `domicile_exterieur` + FK `sites` (cartographie, stats déplacement) absentes SAR×MOM.

---

## §2 · Frictions tracées (23 frictions + 8 acquis)

### 2.1 · Tableau frictions

| Réf | Friction | Source | Statut |
|---|---|---|---|
| **F1** | Filtrage écran d'accueil **triplement structurel** : (a) trop de boutons (11 sur COMPÉT.) + (b) 2 lignes simultanées non contextuelles + (c) format/ordre/lien avec « Grouper par catégorie » incohérent | UX-1 PASSATION verbatim Manu | ✅ Résolue maquette §3.4 |
| F2 | Style « un peu plat » (esthétique globale) | Récit Manu | 🟡 Différée — cosmétique, conv style dédiée si décidée |
| F3 | Bouton « + Nouvel évènement » pas assez repérable | Récit Manu | ✅ Résolue maquette §3.4 (CTA primaire près titre) |
| F4 | Modale trop aérée, l'œil n'arrive pas à fixer | Récit Manu sur modale | ✅ Résolue socle commun §3.1 (densification ~30%) |
| F5 | Doublon DOMICILE/EXTÉRIEUR + SITE | Récit Manu | ✅ Résolue R1 §3.1 (LIEU unique + déduction modifiable) |
| F6 | ADVERSAIRE « n'amène rien à ce stade » | Récit Manu mode Compétition | ✅ Résolue §3.1 (différé engagement équipe / multi-équipes en plateau) |
| F7 | Équipes engagées absentes modale (différé fiche évènement) | Comparaison SAR×MOM | ✅ Résolue §3.1 (section inline checkboxes M3 capturé création) |
| F8 | Phases absentes modale (différé fiche évènement) | Comparaison SAR×MOM | ✅ Résolue §3.1 (section inline blocs extensibles M6 capturé création) |
| F9 | Format par équipe (override M4) absent modale | Comparaison SAR×MOM | ✅ Résolue §3.1 (dropdown inline par équipe cochée) |
| F10 | STAFF PRÉSENT désactivé déroutant (promesse non tenue visible) | Récit Manu | ✅ Résolue §3.1 (masquage initial → puis F20 a remplacé par bloc actif) |
| F11 | Libellés équipes doivent être lus dynamiquement de `equipes` filtrée catégorie+saison | Question Manu Q1 | ✅ Résolue Q-A10 (libellés génériques « Équipe 1/2/3 » provisoires, vraies équipes au câblage Production) |
| F12 | Sélecteur équipe absent sur `+ MATCH` ; adversaires par équipe nécessaires en plateau sans phases | Question Manu Q2 | ✅ Résolue §3.1 (sélecteur équipe ou hiérarchie par équipe selon F19) |
| F13 | Dépendance amont `ADMIN-(ii)` pour disponibilité équipes structurelles en base | Induite Q1 | 🟡 Tracée dépendance amont assumée — chantier `ADMIN-(ii)` distinct ouvert |
| F14 | DATE FIN optionnelle nécessaire pour tournoi multi-jours + dates propres par phase | Tournoi 2 jours Manu | ✅ Résolue §3.1 (checkbox « Sur plusieurs jours » + jour+heure par phase) |
| F15 | Récurrence M2 entraînements absente modale | Demande Manu | ✅ Résolue §3.1 (checkbox « Série récurrente » + jours semaine + période) |
| F16 | Méta : maquette doit montrer l'adaptation par type, pas juste 1 cas | Observation Manu sur maquette ponctuelle | ✅ Résolue §3.1 (modale interactive 5 modes Visualizer) |
| **F17** | Horaires différenciés par type : entraînement (début/fin), stage (accueil/fin par jour), compétition (RDV + lieu RDV + début match + fin prévue) — non portés modèle v1.2 nativement | Demande Manu groupes horaires | 🟠 Résolue UI (visuel champs présents) · **dette modèle `MODELE-EVT-HORAIRES-RDV` ouverte** pour persistance |
| F18 | Détail phases doit apparaître uniquement si « Avec phases » sélectionné | Remarque Manu maquette v2 | ✅ Résolue §3.1 (visibilité conditionnelle) |
| F19 | Phases dédiées par équipe sans mélange (option I) — Équipe 1 a SES phases, Équipe 2 a SES phases | Remarque Manu maquette v2 | ✅ Résolue §3.1 (arborescence par équipe) · dette `MODELE-EVT-PHASES-PAR-EQUIPE` 🟡 légère (`equipe_id` sur phase-boîte, à clarifier modèle v1.3 si nécessaire) |
| F20 | Sélection des coachs présents absente modale | Remarque Manu maquette v3 | ✅ Résolue §3.1 (bloc ENCADREMENT M8 tous modes + N2 affectation par équipe inline si plateau multi-équipes) — **écart gouvernance assumé** : absorbe câblage staff modale différé `DETTE-2-Staff` v1.1 §6 |
| F21 | Confirmation présence staff séance par séance pour entraînement récurrent (≠ staff par défaut série) | Particularité Q-A20 Manu | 🟡 Tracée dette UX `UX-EVT-SERIES-STAFF-PAR-SEANCE` à concevoir conv ultérieure |
| F22 | Bouton « Grouper par catégorie » visible en mode coach alors qu'inutile pour M14 mono-catégorie | Réponse Manu filtres | ✅ Résolue §3.4 (visibilité conditionnée rôle `has_role('admin')`) |
| F23 | Compteurs « À venir / Passés » étaient info statique → actionnables filtres | Conception Manu | ✅ Résolue §3.4 (cartouches deviennent filtres cliquables) |

### 2.2 · Acquis préservés (8)

| Réf | Acquis | Décision |
|---|---|---|
| A1 | Calendrier latéral écran d'accueil | Préservé maquette §3.4 |
| A2 | Cartes/vignettes évènements | Préservées maquette §3.4 |
| A3 | Libellé « Nouvel évènement » clair | Conservé |
| A4 | Champs *TYPE D'ÉVÈNEMENT* + *COMMENT COMMENCER ?* intéressants | Conservés tels quels §3.1 |
| A5 | LIBELLÉ + DATE neutres OK | Conservés |
| A6 | *Type de compétition* OK (mode Compétition) | Conservé §3.1 |
| A7 | *Format de Jeu* OK | Conservé §3.1, étendu format par équipe |
| A8 | Option « Dupliquer évènement précédent » | Conservée — acquis différentiel MOM Hub absent SAR×MOM |

---

## §3 · Plans détaillés des écrans refondus (niveau β+γ)

### 3.1 · Modale création évènement — 5 modes adaptatifs

**Principe directeur** : la modale **s'adapte au choix `type_evenement` (radios en haut)** et expose dans la même modale les capacités M3 (équipes engagées) + M4 (format par équipe) + M6 (phases) + M8 (encadrement) + N2 (staff par équipe) **quand la famille est `competition`**. 1 modale, 1 contexte mental, 1 clic *Créer l'évènement*.

#### 3.1.1 · Mode A1 · Entraînement

```
┌─ NOUVEL ÉVÈNEMENT ─────────────────────────────────────┐
│  Mode : Entraînement — séance hebdomadaire ou ponctuelle│
│                                                         │
│  TYPE D'ÉVÈNEMENT *                                     │
│  ● Entraînement   ○ Compétition   ○ Stage              │
│                                                         │
│  COMMENT COMMENCER ?                                    │
│  ● Créer vierge   ○ Dupliquer un évènement précédent   │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  LIBELLÉ *  [Entraînement M14 du mercredi (28/05)    ] │
│                                                         │
│  DATE *               LIEU                              │
│  [28/05/2026 📅]     [Brenckle (Mutzig)  ▾]            │
│                       🏠 domicile (modifier)            │
│                                                         │
│  HORAIRES                                               │
│  DÉBUT  [18h30]      FIN  [20h00]                      │
│                                                         │
│  ☐ Série récurrente (entraînements réguliers)          │
│    [si coché → grille jours semaine + période du/au]   │
│                                                         │
│  ENCADREMENT                                            │
│  ☑ Emmanuel Jung    ☐ Christophe Martin                │
│  ☐ Sébastien Dupont ☐ Marc Petit                       │
│  ─────────────────────────────────────────────────────  │
│              [ Annuler ]    [ Créer l'évènement ]      │
└─────────────────────────────────────────────────────────┘
```

**Spec comportementale A1** :
- Pas de sous-type, pas d'équipes engagées (cohérent v1.2 M3 « multi-équipes = famille Compétition uniquement »), pas de phases, pas d'adversaire
- LIEU défaut Brenckle (cookie/localStorage dernière saisie réussie + fallback site MOM principal référentiel)
- Si COMMENT COMMENCER = *Dupliquer* → ouverture sélecteur évènement précédent même type, pré-remplit libellé/lieu/horaire, l'utilisateur ajuste date
- **Cas Série récurrente coché** : helper *« Staff par défaut de la série, vous confirmerez la présence séance par séance depuis la liste des entraînements »* (référence dette `UX-EVT-SERIES-STAFF-PAR-SEANCE`)
- Horaires DÉBUT+FIN dérivables de `recurrence.debut`/`recurrence.fin` JSONB pour série, libellé pour ponctuel (en attendant `MODELE-EVT-HORAIRES-RDV`)

#### 3.1.2 · Mode A2 · Stage

Spec différence A1/A2 :
- DATE étendue : **DATE DÉBUT + DATE FIN** (champ requis)
- Section **HORAIRES ET LIEU PAR JOUR** : liste générée dynamiquement depuis (DATE DÉBUT → DATE FIN), chaque jour porte ACCUEIL + FIN + LIEU (Q-A15 « par jour » + « horaires + lieu par jour » actés)
- LIEU global ligne 2 conservé (= lieu de référence stage)
- Bandeau jaune `MODELE-EVT-HORAIRES-RDV` (transparence honnête)

#### 3.1.3 · Mode A3 · Compétition simple (Match championnat / amical / Seven)

```
┌─ NOUVEL ÉVÈNEMENT ─────────────────────────────────────┐
│  Mode : Match simple — 1 équipe vs 1 adversaire        │
│                                                         │
│  [TYPE radios] · [COMMENT COMMENCER radios]            │
│                                                         │
│  SOUS-TYPE *  [Match championnat ▾]                    │
│  LIBELLÉ *    [Match SAR/MOM vs Strasbourg          ]  │
│                                                         │
│  DATE *               LIEU                              │
│  [23/05/2026 📅]     [Strasbourg AS ▾]                 │
│                       🏠 extérieur (modifier)           │
│                                                         │
│  HORAIRES                                               │
│  DÉBUT MATCH [15h00]   FIN PRÉVUE [17h00]              │
│  HEURE RDV   [14h00]   LIEU RDV   [Brenckle]           │
│                                                         │
│  ÉQUIPES ENGAGÉES *                                     │
│  ☑ Équipe 1 — format [À 15 ▾]                          │
│  ☐ Équipe 2                                             │
│                                                         │
│  ADVERSAIRE  [Strasbourg AS                          ]  │
│                                                         │
│  ENCADREMENT  ☑ Emmanuel  ☐ Christophe …               │
│  ─────────────────────────────────────────────────────  │
│              [ Annuler ]    [ Créer l'évènement ]      │
└─────────────────────────────────────────────────────────┘
```

**Spec comportementale A3** :
- ÉQUIPES ENGAGÉES auto-coche équipe par défaut du rôle utilisateur (Référent M14)
- ADVERSAIRE champ texte unique visible **uniquement si exactement 1 équipe cochée** (cohérent M5 frontière)
- PHASES ET MATCHS **masquées** par défaut (sous-type *Match championnat / amical / Seven* = phases improbables). Lien discret « + Ajouter structure phases » en bas si exceptionnel
- HORAIRES bloc complet RDV/début/fin (dette `MODELE-EVT-HORAIRES-RDV` tracée pour persistance)

#### 3.1.4 · Mode A4 · Compétition plateau / multi-équipes (priorité 1 Manu UX-2a)

**Cœur de la refonte** — résout F7+F8+F9+F12+F14+F19+F20 d'un coup. Visualizer interactif validé Q-A12+Q-A31.

```
┌─ NOUVEL ÉVÈNEMENT ─────────────────────────────────────┐
│  Mode : Plateau — multi-équipes possibles, phases opt. │
│                                                         │
│  [TYPE radios] · [COMMENT COMMENCER radios]            │
│                                                         │
│  SOUS-TYPE *  [Plateau ▾]                              │
│  LIBELLÉ *    [Plateau M14 du 23/05                  ] │
│                                                         │
│  DATE *               LIEU                              │
│  [23/05/2026 📅]     [Brenckle (Mutzig) ▾]             │
│                       🏠 domicile (modifier)            │
│                                                         │
│  HORAIRES                                               │
│  DÉBUT MATCH [10h00]   FIN PRÉVUE [17h00]              │
│  HEURE RDV   [09h15]   LIEU RDV   [Brenckle parking]   │
│                                                         │
│  ☐ Sur plusieurs jours  [si coché → DATE FIN]          │
│                                                         │
│  ÉQUIPES ENGAGÉES *                                     │
│  ☑ Équipe 1 — format [À 15 ▾]                          │
│  ☑ Équipe 2 — format [À 10 ▾]                          │
│  ☐ Équipe 3                                             │
│                                                         │
│  ADVERSAIRES PAR ÉQUIPE                                 │
│  Équipe 1 : [Strasbourg, Mulhouse              ]       │
│  Équipe 2 : [Colmar, Sélestat                  ]       │
│                                                         │
│  STRUCTURE DE PHASES                                    │
│  ○ Pas de phases (matchs libres)                        │
│  ● Avec phases                                          │
│    ┌─ Équipe 1 ──────────────────────────────┐          │
│    │ Phase : [Poule brassage] [sam] [09h30] ✕│          │
│    │   • [Strasbourg]  [10h00]  ✕            │          │
│    │   + Match                              │          │
│    │ + Phase pour cette équipe              │          │
│    └─────────────────────────────────────────┘          │
│    ┌─ Équipe 2 ──────────────────────────────┐          │
│    │ Phase : [Poule brassage] [sam] [09h30] ✕│          │
│    │   • [Colmar]    [10h00]   ✕             │          │
│    │   + Match                              │          │
│    │ + Phase pour cette équipe              │          │
│    └─────────────────────────────────────────┘          │
│                                                         │
│  ENCADREMENT                                            │
│  ☑ Emmanuel  ☑ Christophe  ☑ Sébastien  ☐ Marc         │
│                                                         │
│  AFFECTATION PAR ÉQUIPE (optionnel)                    │
│  Équipe 1 : [Emmanuel ▾]                                │
│  Équipe 2 : [Christophe ▾]                              │
│                                                         │
│  💡 Vous pourrez ajuster équipes, phases, matchs et    │
│     compositions depuis la fiche évènement.             │
│  ─────────────────────────────────────────────────────  │
│              [ Annuler ]    [ Créer l'évènement ]      │
└─────────────────────────────────────────────────────────┘
```

**Spec comportementale A4 (priorité 1 Manu)** :
- SOUS-TYPE = *Plateau / Championnat Phase 1/2/Finales* → section ÉQUIPES ENGAGÉES affiche **toutes les équipes catégorie** (M14 = lecture dynamique `equipes` filtrée par catégorie + saison active + `statut='active'`, patron `listEquipes` STATE pt 14 + UX-2a Q-A10 libellés génériques provisoires)
- Format par équipe : dropdown indépendant par équipe cochée → 1 ligne `evenement_equipes_engagees` par équipe avec `format_de_jeu` override M4
- **ADVERSAIRES** : 1 champ multi-valeur **par équipe cochée** (bloc dynamique selon les checkboxes équipes). Cohérent M5 frontière (`evenement_adversaires` accroché à `evenement_equipes_engagees(id)`)
- STRUCTURE DE PHASES :
  - Radio « Pas de phases / Avec phases » (P4 simplicité)
  - Détail visible **uniquement si « Avec phases » coché** (F18 Q-A en cours)
  - Avec phases → **arborescence par équipe (F19 option I Q-A16)** : chaque équipe cochée a son propre conteneur, chaque conteneur a ses phases avec leurs matchs. Plus de sélecteur d'équipe par match (l'équipe est portée par le conteneur parent)
  - Match : adversaire texte + heure (+ jour si tournoi multi-jours)
- ENCADREMENT M8 :
  - Section visible **tous modes** (Q-A20 (iii) Q-A19 Option B)
  - Liste des coachs catégorie (lecture dynamique depuis collectif N1 `role='staff'`)
  - Multi-sélection (cohérent M8 `evenement_encadrants` N par évènement)
- AFFECTATION PAR ÉQUIPE N2 :
  - Affichée **uniquement** en mode Compétition multi-équipes (>1 équipe cochée)
  - Dropdown par équipe propose **uniquement** les coachs déjà cochés en ENCADREMENT (cohérence intra-modale P4, N2 sous-ensemble M8)
  - Optionnel (laisser vide = staff événement global, pas d'affectation N2 explicite)
- HORAIRES bloc complet RDV (dette `MODELE-EVT-HORAIRES-RDV` tracée)

#### 3.1.5 · Mode A5 · Compétition à phases obligatoires (Tournoi / Challenge Vié / Challenge inter-ligues)

Variante A4 avec phases **affichées par défaut « Avec phases »**. Sinon identique : multi-équipes, adversaires par équipe, encadrement + affectation par équipe.

#### 3.1.6 · Règles transverses Proposition A

**R1 · Déduction `domicile_exterieur` depuis LIEU (F5 résolu)**

| Sélection LIEU | `domicile_exterieur` déduit | Modifiable |
|---|---|---|
| Site MOM principal (Brenckle…) | `domicile` | Bouton « modifier » |
| Site MOM secondaire / dépôt référentiel | `domicile` ou `neutre` selon flag site | ✅ |
| Site externe référencé (Strasbourg AS…) | `exterieur` | ✅ |
| Texte libre (déplacement non listé) | `exterieur` | ✅ |
| Vide | `NULL` | — |

P4 « avertit ne bloque pas » → la déduction est **proposée**, l'éducateur peut surcharger en 1 clic (cas terrain neutre, tournoi hôte tiers).

**R2 · Validation soft à la création (P4)**

| Cas | Comportement |
|---|---|
| Famille Compétition + 0 équipe engagée cochée | Warning jaune *« Au moins une équipe doit être engagée pour une compétition »* → bloque création |
| Famille Compétition + équipe cochée + format = `IS NULL` | Warning bleu *« Format non précisé — sera demandé à l'engagement »* → laisse créer |
| Plateau + 0 phase remplie | Pas de warning, création minimale OK (équivalent « Pas de phases ») |
| Avec phases + phase sans match | Pas de warning, phase-boîte créée vide, matchs ajoutables fiche |

**R3 · RPC composite à exposer côté backend (passation Production §5)**

```
RPC creer_evenement_complet(
  type_evenement TEXT,            -- 'entrainement' | 'competition' | 'stage'
  type_competition TEXT,          -- NULL si pas competition
  libelle TEXT,
  date_debut TIMESTAMPTZ,
  date_fin TIMESTAMPTZ,           -- NULL sauf Stage / multijours
  site_id UUID,
  domicile_exterieur TEXT,
  recurrence JSONB,               -- série récurrente entraînement
  equipes_engagees JSONB[],       -- [{equipe_id, format_de_jeu, adversaires:[]}, ...]
  phases_par_equipe JSONB[],      -- [{equipe_id, phases:[{libelle, date_debut, matchs:[]}]}]
  encadrants UUID[],              -- M8 ids personnes
  affectations_n2 JSONB[],        -- [{evenement_equipe_id, collectif_membre_id}]
  equipe_id_simple UUID,          -- entraînement/stage
  copie_de_evenement_id UUID      -- mode Dupliquer
) RETURNS UUID
```

Transaction unique : `evenements` + N `evenement_equipes_engagees` + N `evenement_adversaires` + N phases-boîtes `evenements` (avec `equipe_id` par équipe — F19) + N matchs `evenements` + N `evenement_encadrants` (M8) + N `equipe_engagee_membre` `role='staff'` (N2). SECURITY DEFINER, garde `has_role admin|coach`, return ID évènement parent. **Patron `sql/50`-like** (idempotent, fail-loud, cadrage source pré-INSERT recollable).

**R4 · Engagement progressif post-création préservé**

La fiche évènement (§3.2-3.3 + section *Modifier*) **reste utilisable** pour ajustements ultérieurs : ajouter équipe, modifier format, ajouter adversaire, ajouter phase, ajouter match, ajouter encadrant. **Capacité actuelle préservée** — la refonte ajoute la voie « rapide » modale, ne supprime pas la voie « lente » fiche.

### 3.2 · Fiche évènement avec bannière 2 niveaux

**Flux entrée** : clic sur vignette de l'écran d'accueil (§3.4) ouvre la fiche évènement (page dédiée, non modale). Bouton « ← Retour au calendrier » en haut à gauche.

**Bannière à 2 niveaux (Q-A30 acté)** :

**Niveau 1 (essentiel toujours visible)** — 4 infos d'un coup d'œil dans une grille auto-adaptative :

| Bloc | Contenu | Source modèle |
|---|---|---|
| HORAIRES | « 10h00 → 17h00 » | `evenements.date_debut` + dette horaires |
| LIEU | « Brenckle » + sous-ligne *domicile* | `evenements.site_id` + `domicile_exterieur` |
| ÉQUIPES ENGAGÉES | « 2 équipes engagées » + sous-ligne format par équipe (« Équipe 1 : à 15 · Équipe 2 : à 10 ») | M3 `evenement_equipes_engagees` + `format_de_jeu` |
| ADVERSAIRES | Liste synthétique (« Strasbourg, Colmar, Mulhouse ») | M5 `evenement_adversaires` |

**Bouton « Afficher les détails »** (chevron pivotant) déplie le Niveau 2.

**Niveau 2 (détails dépliables)** — 5 infos secondaires :

| Bloc | Contenu | Source modèle |
|---|---|---|
| STRUCTURE PHASES | « 2 phases · 4 matchs prévus » | Compte M6 phases-boîtes + matchs |
| RENDEZ-VOUS | « 09h15 · Brenckle (parking) » | Dette `MODELE-EVT-HORAIRES-RDV` |
| STATUT COMPOSITIONS | « 2/2 prêtes » + badge *« complet »* | Compte `compositions` `etat='validee'` filtrées par `evenement_equipe_id` |
| ENCADREMENT | « Emmanuel J., Christophe M., Sébastien D. » | M8 `evenement_encadrants` |
| NOTES | Prose libre éducateur (sur toute la largeur) | Dette `MODELE-EVT-NOTES` (champ optionnel à clarifier conv Modélisation) |

### 3.3 · Fiche évènement — Grille de 8 liens fonctionnalités + actions

**Section FONCTIONNALITÉS DE L'ÉVÈNEMENT** (Q-A27 liste actée, Q-A28 transparence totale actée) :

| # | Lien | Statut | Cible |
|---|---|---|---|
| 1 | **Compositions** « Feuilles de match par équipe » | ✅ Disponible | `compositions.html?evenement_equipe=…` (route U-N3 pt 16) |
| 2 | **Suivi** « Saisie observables match » | ✅ Disponible | Accroches déjà câblées `evenements-browser.js` v1.11/v1.23 (Suivi A/B/C livré) |
| 3 | **Groupes de base** « Pioche dans le vivier » | ✅ Disponible | `groupe-base.html?evenement_equipe=…` (U-N2 pt 15) |
| 4 | **Encadrement** « Staff et affectations » | ✅ Disponible (conception) | Lecture M8 + N2 — câblage UI fiche à livrer Production (en parallèle modale création) |
| 5 | **Vue terrain** « Placement des joueurs » | ⏳ En cours | Module compositions partiel — dette `UX-EVT-VUE-TERRAIN` |
| 6 | **Vue réseaux sociaux** « Composition partageable » | 🔜 À venir | Dette `UX-EVT-VUE-RESEAUX-SOCIAUX` |
| 7 | **Rapports** « Compte-rendu de match » | 🔜 À venir | Dette `UX-EVT-RAPPORTS` |
| 8 | **Statistiques** « Synthèse chiffrée » | 🔜 À venir | Dette `UX-EVT-STATISTIQUES` |

**Représentation visuelle** : chaque lien = grand bouton avec icône + titre + sous-titre explicatif. Statuts honnêtes :
- **Disponible** : icône en couleur info, cliquable, pas de badge
- **En cours** : icône en jaune-orangé + badge *« en cours »*, cliquable vers module partiel
- **À venir** : grisé, désactivé, badge *« à venir »*

**Section ACTIONS** :
- **Modifier** (rouvre modale création pré-remplie)
- **Dupliquer** (rouvre modale création en mode *Dupliquer*)
- **Supprimer** (rouge léger, modale de confirmation obligatoire — action sensible)

### 3.4 · Écran d'accueil Évènements refondu

**Architecture** :

```
┌─ MES ÉVÈNEMENTS ─────────────────────────────────────────┐
│ M14 SAR/MOM · 27 évènements sur 90 jours                │
│                                       [12 à venir] [9 passés]
│                                                          │
│ 🔍 Rechercher un évènement…              [+ Nouvel évèt] │
│                                                          │
│ ┌─ Filtres ─────────────────────────────────────────────┐│
│ │ TYPE  ●Tous  ○Entraînement  ○Compétition  ○Stage     ││
│ │ ──── (si Compétition) ────                           ││
│ │ SOUS-TYPE [Plateau ▾]                                ││
│ │ ──── (si admin) ────                                 ││
│ │ [Grouper par catégorie] (visible mode admin)         ││
│ └───────────────────────────────────────────────────────┘│
│                                                          │
│ JUIN 2026                                                │
│ ┌────────────────────────────────────────────────────────┐
│ │ |SAM. 07 JUIN · 10h00  [CHALLENGE VIÉ]              │ │
│ │ | Challenge Vié                          [0/8 compos]│ │
│ │ | 📍 Nancy  👥 2 équipes                             │ │
│ └────────────────────────────────────────────────────────┘
│                                                          │
│ MAI 2026                                                 │
│ ┌────────────────────────────────────────────────────────┐
│ │ |SAM. 23 MAI · 10h00  [PLATEAU]                     │ │
│ │ | Plateau M14 · Les Gemmeurs           [2/2 compos] │ │
│ │ | 📍 Rion-des-Landes  👥 1 équipe                    │ │
│ └────────────────────────────────────────────────────────┘
│ ...                                                      │
└──────────────────────────────────────────────────────────┘
```

**Spec comportementale écran d'accueil** :

- **Filtres TYPE** (1 ligne, 4 pills) : *Tous · Entraînement · Compétition · Stage* (F1.a résolu — passe de 11 pills COMPÉT. à 4 TYPE)
- **Dropdown SOUS-TYPE** apparaît **uniquement si filtre Compétition actif** (F1.b résolu — pas de saturation ligne 2 quand non pertinent). 10 sous-types modèle v1.2 + option « Tous sous-types »
- **Cartouches À VENIR / PASSÉS** : compteurs cliquables qui basculent en filtre actif (F23 résolu — info devient action). Filtre « À venir » actif par défaut → l'éducateur arrive sur le futur (constat étape 1 corrigé)
- **Bouton « Grouper par catégorie »** visible **uniquement si `has_role('admin')`** + mention honnête *« visible en mode admin général uniquement »* (F22 résolu — élimine bruit cognitif coach mono-catégorie)
- **CTA primaire « + Nouvel évènement »** près du titre, à côté barre recherche (F3 résolu — plus repérable que bouton flottant solo)
- **Vignettes compactes** : barre verticale couleur (sous-type), date+horaire, pill sous-type, titre, ligne info (lieu + nb équipes), **statut compositions à droite** (« 2/2 compos » / « 0/8 compos » / « 1/2 prêtes » / « annulé »). Cohérent ressenti positif Manu sur le compteur SAR×MOM
- **Regroupement temporel** par mois (« JUIN 2026 », « MAI 2026 ») — préserve A2 cartes/vignettes + clarté chronologique
- **Clic vignette** → ouverture fiche évènement (§3.2-3.3)
- **Calendrier latéral** A1 préservé (non détaillé ici — `00 - Documentation/` doit le maintenir)

---

## §4 · Décisions de conception consolidées

### 4.1 · Décisions principales (P1→P3)

| # | Décision | Référence Manu | Ancrage modèle / doctrine |
|---|---|---|---|
| **P1** | **Proposition A retenue** : modale adaptative unique 1 contexte, vs Proposition B 2 modales chaînées | Q-A1 acté | Hypothèse 1 PASSATION §1 confirmée par capture SAR×MOM ; doctrine P1 simplicité |
| **P2** | **5 modes adaptatifs** au choix `type_evenement` × `type_competition` : A1 Entraînement / A2 Stage / A3 Compétition simple / A4 Plateau-multi-équipes / A5 Tournoi à phases | Q-A5 ✅ | Modèle v1.2 §1 hiérarchie famille→sous-type |
| **P3** | **Adaptation visible** par bandeau mode + sections conditionnelles, pas seulement par champs grisés | F16 + Q-A11 maquette interactive | Doctrine P5 « nommer pour le sens » |

### 4.2 · Décisions par friction principale

| # | Décision | Friction résolue | Ancrage modèle |
|---|---|---|---|
| **D1** | **LIEU unique** avec combo (autocomplete sites + texte libre fallback) ; `domicile_exterieur` **déduit** modifiable bouton | F5 | Modèle v1.2 §4.6 sites + doctrine P4 « avertit ne bloque pas » |
| **D2** | **Équipes engagées inline checkboxes** + format par équipe dropdown, **libellés génériques provisoires** « Équipe 1/2/3 » | F7+F9+F11 | M3 §4.3 + M4 override + Q-A10 acté |
| **D3** | **Adversaires** : champ singulier si 1 équipe cochée, **bloc par équipe** si multi-équipes ; **différé** au niveau match si phases | F6+F12 | M5 §4.4 frontière |
| **D4** | **Phases inline blocs extensibles** + **arborescence par équipe** (option I, F19) | F8+F12+F19 | M6 §4.4 phase-boîte → match · dette `MODELE-EVT-PHASES-PAR-EQUIPE` 🟡 |
| **D5** | **DATE FIN optionnelle** via checkbox « Sur plusieurs jours » pour plateau/tournoi | F14 | `evenements_dates_coherentes` CHECK v1.2 inchangée |
| **D6** | **Récurrence M2** via checkbox « Série récurrente » + jours semaine + période du/au | F15 | Modèle v1.2 §3 M2 récurrence JSONB |
| **D7** | **Horaires différenciés** par mode (entraînement début/fin · stage accueil+fin+lieu par jour · compétition RDV + début + fin) — **visuels UI, persistance différée** | F17 Q-A13 Option α | **Dette modèle `MODELE-EVT-HORAIRES-RDV` 🟠 ouverte** à instruire conv Modélisation |
| **D8** | **Encadrement M8 tous modes** + **affectation par équipe N2** inline si plateau multi-équipes | F20 Q-A19 Option B + Q-A20 iii | M8 §4.5 + N2-6/N2-7 Collectif v1.1 ; **écart gouvernance assumé** : absorbe câblage staff modale différé `DETTE-2-Staff` |
| **D9** | **Entraînement récurrent** : staff M8 = staff par défaut série, occurrences pré-cochées dérivation, décochage individuel séance par séance ailleurs | F21 Q-A21 (a) | **Dette UX `UX-EVT-SERIES-STAFF-PAR-SEANCE` 🟡** à concevoir conv ultérieure |
| **D10** | **Bouton ENCADREMENT N2 sous-ensemble M8** : dropdown affectation propose uniquement coachs déjà cochés en M8 | Cohérence intra-modale | Doctrine P4 + N2-7 frontière N2↔M8 |

### 4.3 · Décisions fiche évènement

| # | Décision | Ancrage |
|---|---|---|
| **F-1** | **Fiche évènement = centre névralgique** : tout part de l'évènement créé, liens directs vers 8 fonctionnalités | Verbatim Manu *« tout doit pouvoir partir de l'évènement »* |
| **F-2** | **Bannière 2 niveaux** : 4 essentiels toujours visibles + 5 dépliables (Q-A30 acté) | Doctrine P1 simplicité + lutte saturation |
| **F-3** | **Transparence statuts** : afficher tous les liens, marquer honnêtement les statuts (Disponible / En cours / À venir) | Q-A28 acté + doctrine pt 16/17 transparence |
| **F-4** | **Bouton « Retour au calendrier »** en haut à gauche | Résout partiellement UX-4 PASSATION *« obligé de repasser par tableau de bord »* |
| **F-5** | **Actions ACTIONS** : Modifier (rouvre modale) / Dupliquer / Supprimer (confirmation obligatoire) | Doctrine P4 action sensible non bloquante |

### 4.4 · Décisions écran d'accueil

| # | Décision | Ancrage |
|---|---|---|
| **H-1** | **1 ligne filtres TYPE** (4 pills) | Q-A32 acté + F1.a résolu |
| **H-2** | **Dropdown SOUS-TYPE conditionnel** au choix Compétition | F1.b résolu |
| **H-3** | **Compteurs À venir/Passés cliquables** = filtres actionnables | F23 + résout liste s'ouvre sur passés |
| **H-4** | **Filtre par défaut « À venir »** actif au chargement | Constat étape 1 corrigé |
| **H-5** | **Bouton « Grouper par catégorie »** visible **uniquement si `has_role('admin')`** | F22 + Q-A32 + Collectif v1.1 §A-1 |
| **H-6** | **CTA primaire « + Nouvel évènement »** près du titre, à côté barre recherche | F3 résolu |
| **H-7** | **Vignettes avec statut compositions** à droite | Acquis SAR×MOM ressenti positif Manu |
| **H-8** | **Regroupement temporel** par mois (préserve A2) | Étape 1 + A2 |
| **H-9** | **Clic vignette → fiche évènement** (§3.2-3.3) | F-1 + verbatim Manu |

### 4.5 · Invariants protégés (PASSATION §5 tenu)

- ✅ **Modèle Évènements v1.2** non rouvert (extensions UI seulement)
- ✅ **Modèle Collectif v1.1** non rouvert
- ✅ **Doctrine v1.2 → v1.3** non rouverte ici (`UX-PARCOURS-NAV` cadré §5 pour conv suivante, Q-A4 ii)
- ✅ **Accroches Suivi A/B/C** non touchées
- ✅ **`compositions.evenement_id`** intact
- ✅ **PI-7** non fragilisé
- ✅ **Module bénévole** non touché
- ✅ **`groupe-base.html` U-N2** + **`compositions.html` U-N3** non rouverts (livrés pt 15-16)

### 4.6 · Écarts de gouvernance assumés (pattern Manu pt 11/15/16/17)

| # | Écart | Cause | Statut |
|---|---|---|---|
| **E-1** | Cette conv UX absorbe **câblage bloc Staff en modale** que PASSATION §5 différait à P2-E.4 | F20 + Q-A19 Option B + N1 livré pt 15 = M8 RLS write fonctionnelle, plus de blocage technique. Cohérent pattern option 2 pt 11/15/16 | Tracé, à acter en passation Production §5 |
| **E-2** | Cette conv UX **ne creuse pas UX-4 navigation Évt↔Compos↔retour** au-delà du bouton « Retour au calendrier » fiche évènement | Q-A4 ii acté : `UX-PARCOURS-NAV` reporté conv Conception suivante (méthode (c) hybride PASSATION §2 M1 dit *« scénario plateau prioritaire »*, UX-4 secondaire) | Tracé, à instruire conv suivante (§5) |
| **E-3** | Méthode walkthrough live abandonnée précocement au profit d'analyse comparative + maquettes | Préférence terrain Manu *« trouve cette méthode un peu fastidieuse »* (verbatim) | Tracé, méthode adaptée au profil utilisateur |

### 4.7 · Dépendances amont (non bloquantes)

| Dépendance | Détail | Statut |
|---|---|---|
| `ADMIN-(ii)` | Création équipes structurelles dans `equipes` table (Équipe 1/2/3 réelles M14 en base) | Chantier `ADMIN-(ii)` ouvert distinct — UX maquette utilise libellés génériques en attendant (Q-A10 ta 3ᵉ voie) |
| `MODELE-EVT-HORAIRES-RDV` | Persistance horaires détaillés (RDV / fin prévue / accueil par jour) | Dette modèle 🟠 ouverte (D7 ci-dessus) |
| `MODELE-EVT-PHASES-PAR-EQUIPE` | Clarification sémantique `equipe_id` sur phase-boîte v1.2 §4.4 | Dette modèle 🟡 légère (D4 ci-dessus) — pas bloquant en l'état |
| `MODELE-EVT-NOTES` | Champ notes éducateur (utilisé bannière niveau 2) | Dette modèle 🟡 à clarifier si formalisation nécessaire |

---

## §5 · Passation Production + mini-cadrage `UX-PARCOURS-NAV`

### 5.1 · Passation vers conv `Production · Refonte UX modale création évènement + fiche évènement + écran d'accueil`

**Sortie de cette conv** : ce document `Conception-UX-Parcours-Evt-Compo-v1.md` Drive `00 - Documentation/`.

**Livrables Production à produire** (chacun = 1 fichier = 1 commit, pattern userMemories pt 17) :

| Livrable | Cible | Notes |
|---|---|---|
| **`sql/52-rpc-creer-evenement-complet.sql`** | RPC composite R3 §3.1.6 | Transaction unique multi-tables ; patron `sql/50` idempotent fail-loud cadrage source pré-INSERT ; SECURITY DEFINER + garde `has_role admin|coach` ; return ID évènement parent |
| **`js/supabase-client.js` v1.30** | Nouvelle méthode `createEvenementComplet` | Addition pure version+method, chaîne md5 prolongée depuis v1.29 pt 17 ; wrappers existants byte-identiques md5 prouvés |
| **`js/evenements-browser.js` v1.24+** | Refonte écran d'accueil (filtres §3.4) + fiche évènement (§3.2-3.3 bannière 2 niveaux + 8 liens + actions) | Addition + remplacement progressif, additions pures prouvées par diff vs original + `node --check` |
| **`evenements.html`** | Refonte modale création 5 modes adaptatifs (§3.1) + structure fiche évènement | Composant adaptatif `type_evenement` × `type_competition` ; lecture dynamique `equipes` (catégorie+saison+statut active) ; lecture dynamique collectif N1 `role='staff'` pour M8 ; horaires UI visuels (persistance différée `MODELE-EVT-HORAIRES-RDV`) |
| **Tests régression** | Suivi A/B/C intacts + `compositions.evenement_id` intact + PI-7 non fragilisé + Niveau 0 fiche évènement (boutons Groupe de base U-N2 + Feuille de match U-N3) | Audit régression `evenements-browser.js` v1.23 → vN ; preuve par diff additions pures sur fonctions invariantes |

**Doctrine production** :
- 1 fichier = 1 commit (titre + corps fournis)
- Fichiers complets jamais patch (préférence Manu pt 17)
- Chaîne md5 maillon par maillon pour les versions code
- Discipline anti-hypothèse pt 14/15/16/17 : lecture à la source avant chaque livrable, fausses pistes écartées, hypothèses inversées par le fait
- Modèle v1.2 / Collectif v1.1 / Doctrine non rouverts
- Accroches Suivi A/B/C / `compositions.evenement_id` / PI-7 intacts (preuve par fail-loud / régression)
- `console.log` boots non régressés (incohérences déjà résolues pt 17)

### 5.2 · Dettes UX/modèle ouvertes (récapitulatif)

| Dette | Statut | Suite |
|---|---|---|
| **`MODELE-EVT-HORAIRES-RDV` 🟠** | Ouverte — neuve cette conv | Conv Modélisation à ouvrir (extension additive `evenements` colonnes optionnelles `heure_rdv` / `lieu_rdv_id` / `heure_fin_prevue` ou JSONB `horaires_detailles`) ; coût modèle assumé Manu Q-A13 Option α |
| **`MODELE-EVT-PHASES-PAR-EQUIPE` 🟡** | Ouverte légère — neuve cette conv | Conv Modélisation si confirmation explicite souhaitée (sémantique `equipe_id` sur phase-boîte) — pas bloquant en l'état |
| **`MODELE-EVT-NOTES` 🟡** | Ouverte légère — neuve cette conv | Conv Modélisation si formalisation nécessaire (champ notes éducateur bannière niveau 2) |
| **`UX-EVT-SERIES-STAFF-PAR-SEANCE` 🟡** | Ouverte — neuve cette conv | Conv Conception à ouvrir (écran complémentaire « Liste séances → confirmation présence staff ») — F21 Q-A22 acté tracée dette |
| **`UX-EVT-VUE-TERRAIN` 🟠** | Ouverte | Conception module compositions partiel — verbatim Manu *« qu'on a pas encore terminé dans compos »* |
| **`UX-EVT-VUE-RESEAUX-SOCIAUX` 🔜** | Ouverte | Conv Conception ultérieure |
| **`UX-EVT-RAPPORTS` 🔜** | Ouverte | Conv Conception ultérieure |
| **`UX-EVT-STATISTIQUES` 🔜** | Ouverte | Conv Conception ultérieure |
| **`UX-PARCOURS-NAV` 🟡** | Ouverte — cadrée §5.3 ci-dessous pour facilitation conv suivante | Conv Conception suivante (Q-A4 ii acté) |
| **`DETTE-2-Staff`** | Résolu en grande partie par D8 (câblage modale) | Reste câblage UI fiche évènement (lecture M8 + N2) à finaliser conv Production §5.1 |

### 5.3 · Mini-cadrage `UX-PARCOURS-NAV` (Q-A7 mini-cadrage acté)

**Observation Manu UX-4 PASSATION verbatim** : *« manque boutons valider + redirection source, obligé de repasser par tableau de bord »*.

**Hypothèse 2 PASSATION §1** : pattern breadcrumb/retour manquant doctrine v1.2 → candidat évolution doctrine v1.3 si confirmé par audit.

**Ce que la présente conv résout déjà partiellement** :
- Bouton **« Retour au calendrier »** fiche évènement (F-4 §4.3) = retour direct, sans repasser par tableau de bord
- **Proposition A actée** (modale création adaptative = 1 contexte) supprime la rupture en 2 contextes du parcours création
- **Fiche évènement = centre névralgique** avec 8 liens directs (F-1) = navigation outbound depuis évènement vers compos/suivi/etc. simplifiée

**Ce qui reste non résolu et mérite conv dédiée** :
- **Navigation inbound** : depuis `compositions.html` U-N3, comment revenir à la fiche évènement parent ? Bouton « ← Retour à l'évènement » présent ?
- **Navigation transverse** : depuis fiche évènement A, comment naviguer vers évènement B sans repasser par accueil ?
- **Breadcrumb global** : Tableau de bord → Évènements → Évènement X → Compositions Équipe 1 — cette hiérarchie est-elle visible ?
- **Boutons « Valider » + redirection contextuelle** verbatim Manu : après création compo, à quoi mène le bouton « Enregistrer » ? Retour à la fiche évènement ? Reste sur le formulaire ? Cas variable selon le contexte d'entrée

**Pour conv suivante (à ouvrir)** :
- Titre suggéré : `Conception · Audit UX navigation transverse Évènement↔Compos↔Tableau de bord (UX-PARCOURS-NAV)`
- Méthode candidate : walkthrough mobile sur écran spectateur + écran coach Suivi + écran compositions, identification précise des points de rupture
- Sortie attendue : `Conception-UX-Parcours-Navigation-v1.md` Drive `00 - Documentation/`
- Doctrine candidate v1.2 → v1.3 : pattern breadcrumb/retour à formaliser si l'audit le confirme (P-nouveau « Le Hub garde toujours le chemin de retour visible »)

**Articulation** : cette conv courante traite **création + centre névralgique évènement**. La conv suivante traite **navigation transverse** entre écrans MOM Hub. Cohérent doctrine « une conv = un sujet » + complémentarité.

### 5.4 · Articulation conversations

```
conv `Conception · Audit UX parcours Évènement→Compo & fluidité`  (cette conv)
       │
       │   sortie = Conception-UX-Parcours-Evt-Compo-v1.md (ce doc)
       │
       ├──→ conv `Production · Refonte UX modale création évènement + fiche évènement + écran d'accueil`
       │         exécute §5.1 : sql/52 + supabase-client v1.30 + evenements-browser v1.24+ + evenements.html
       │
       ├──→ conv `Modélisation · Extension horaires détaillés évènements (MODELE-EVT-HORAIRES-RDV)`
       │         instruit dette modèle 🟠 D7
       │
       ├──→ conv `Conception · UX écran complémentaire confirmation staff par séance (UX-EVT-SERIES-STAFF-PAR-SEANCE)`
       │         conçoit écran complémentaire F21
       │
       └──→ conv `Conception · Audit UX navigation transverse (UX-PARCOURS-NAV)`
                 instruit doctrine v1.2 → v1.3 candidat, mini-cadré §5.3
```

`STATE.md` / `CARTE` à mettre à jour en sortie de cette conv :
- Bloc MAJ Conception 26/05 : doc UX livré, dettes ouvertes/levées récapitulées
- Gouvernance pt 18 : écarts gouvernance E-1/E-2/E-3 §4.6 tracés
- Dette `UX-PARCOURS-EVT-COMPO` (ouverte pt 16) → **CONÇUE BOUT EN BOUT par ce doc**, reste implémentation Production §5.1
- Dettes neuves ouvertes : `MODELE-EVT-HORAIRES-RDV` · `MODELE-EVT-PHASES-PAR-EQUIPE` · `MODELE-EVT-NOTES` · `UX-EVT-SERIES-STAFF-PAR-SEANCE` · `UX-EVT-VUE-TERRAIN` · `UX-EVT-VUE-RESEAUX-SOCIAUX` · `UX-EVT-RAPPORTS` · `UX-EVT-STATISTIQUES` · `UX-PARCOURS-NAV`

---

*Fin du document. Conception UX pure, écrans détaillés niveau β+γ, 4 maquettes Visualizer validées par Manu (modale v4 / fiche évènement / bannière 2 niveaux v2 / écran d'accueil refondu), ~37 décisions tranchées Q-A1→Q-A37. Modèle v1.2 / Collectif v1.1 / Doctrine / Accroches Suivi non rouverts. Écarts de gouvernance assumés tracés. STATE/CARTE non touchés ici (réconciliation différée, geste de fin). Le doc fait FOI pour conv Production aval ; le code/modèle déployé fait FOI pour tout ce qui touche aux invariants.*
