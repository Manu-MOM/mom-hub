# PASSATION.md — Kit de démarrage MOM Hub

> Document à coller dans la 1ère message des nouvelles conversations pour que Claude reprenne efficacement.
> Complémentaire de STATE.md (état général technique) — ce fichier-ci sert à scinder le travail par THÉMATIQUE.

**Créé le 11 mai 2026, fin de Phase 2.4. — Mis à jour le 13 mai 2026 (très tard) après livraison Phase 4.1.A + 4.2.A/B/C.**

---

## 🎯 Pourquoi ce document ?

À partir du 11 mai 2026, le travail MOM Hub se scinde en **2 axes parallèles** travaillés dans des conversations Claude distinctes :

| Axe | Thématique | Sortie attendue |
|---|---|---|
| **A · Production** | Le portail vivant : code, déploiement, base Supabase, auth, features utilisateur | Du code + de la doc qui finit sur GitHub/Supabase |
| **B · Audits & modélisation** | La réflexion sur les schémas métier : événements, suivi-match, stats, bilans, etc. | Des schémas JSON + des audits déposés sur Drive |

Les deux axes partagent le même STATE.md mais avancent indépendamment.

---

## ✅ Ce qui est COMMUN aux deux axes

Lis **STATE.md** à la racine du repo `Manu-MOM/mom-hub`. C'est la source de vérité technique.

Points doctrinaux à ne JAMAIS oublier (rappel) :
- **Simplicité d'usage avant tout**. Si tu as l'impression de proposer une cathédrale, t'es en train de te tromper.
- **Le Hub est un agrégateur**, pas une migration. Pas de fork SAR×MOM Compos (abandonné définitivement).
- **Budget 0 €**. Stack GitHub Pages + Supabase free + Drive.
- **Repo GitHub PUBLIC** : ne JAMAIS commit clé `service_role`, fiches Personne brutes, données sensibles.
- Manu code peu mais sait suivre ; il **préfère recevoir des fichiers complets prêts à uploader** plutôt qu'appliquer des patches lui-même.
- Style attendu : honnêteté brute, propose pauses si fatigue, recommande mais respecte choix Manu.
- **Pas-à-pas obligatoire** avec "OK" entre micro-étapes.
- Toujours faire `conversation_search` AVANT de proposer du neuf, vérifier l'état réel des fichiers Drive/GitHub/Supabase AVANT de coder.
- **🆕 Anti-invention (leçon 13 mai 2026)** : avant de citer un détail factuel (nombre, code, nom de site/champ/objet), faire un `web_fetch` du repo OU un DRY-RUN sur Supabase. Ne JAMAIS faire confiance à ses propres notes précédentes — la doctrine OVAL-E §13 (Supabase autoritatif) s'applique aussi à Claude. Cas vécus : "Sarre-Union" inventé comme site adversaire, "16 Sites en dur dans le portail" qui n'a jamais existé. Cause racine : extraction de "vraisemblance" sous fatigue de contexte.

---

## 🅰️ AXE A — Conv "MOM Hub · Production"

### Démarrage propre

**Premier message à coller dans la nouvelle conv** :

> Salut Claude. On reprend MOM Hub côté production, après une grosse session du 13 mai 2026 (Phase 4.1.A + 4.2.A/B/C livrées).
> Avant toute proposition : lis `STATE.md` à la racine de `Manu-MOM/mom-hub` (via web_fetch GitHub) ET `PASSATION.md` (ce doc).
> Si tu vas toucher au noyau événements ou aux compositions, lis aussi `Modelisation-Evenements-v1.1.md` (Drive fileId `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u`).
>
> État livré : noyau événements complet (tables + RPC + wrappers JS v1.5), portail à 4 KPI dynamiques.
> Options pour cette session (à choisir avec moi) :
> - **Phase 4.3** : compositions + présences — bloquée par préalable dette C7 (audit doctrine OVAL-E pour joueurs SAR partenaires d'entente, à instruire en conv Audits)
> - **Phase 4.4** : UI portail (greeting J-N + widget prochain match) — requiert cycle Conception dédié pour spécifier l'UX
> - **Dette (i)** : policies RLS write par rôle sur evenements/encadrants/equipes
> - **Insertion d'événements réels M14** pour tester en conditions réelles
>
> ⚠️ **Doctrine anti-invention (leçon du 13 mai)** : avant de citer un nombre, un code, un nom de site/champ : `web_fetch` du repo OU DRY-RUN Supabase. Pas de confiance dans tes propres notes précédentes.
>
> Pas de proposition tant que tu n'as pas fini les lectures.

### Périmètre de la conv Production
- ✅ Code JS/HTML/CSS du Hub
- ✅ SQL Supabase (tables, RLS, RPC, fonctions, triggers)
- ✅ Workflows GitHub Actions
- ✅ Auth / sessions / rôles
- ✅ Tests bout-en-bout
- ✅ Dettes techniques #1 et #2 du STATE.md (réconciliation 293/294, 23/24)
- ❌ PAS de modélisation événements/matchs/stats (ça va dans axe B)
- ❌ PAS d'audit conceptuel des référentiels (axe B)

### Roadmap immédiate

**État au 13 mai 2026 soir tard** : Phases 1 à 4.2.C terminées. Reste à faire (par ordre d'envergure) :

**Court terme — sessions ciblées (15-45 min)** :
1. **Dette (i)** : Policies RLS write par rôle (admin/coach/viewer) sur `evenements`, `evenement_encadrants`, `equipes`, `equipe_joueurs`. Préalable : connaître précisément le schéma `auth_roles`.
2. **Insertion d'événements M14 réels** : pour tester les wrappers `getEvenementsAVenir` et `getProchainEvenementParEquipe` en conditions réelles. Requiert l'apport de Manu (matchs/entraînements concrets de la saison).
3. **Phase 4.4 (UI portail)** : greeting "J-N AVANT MATCH" + widget sidebar "prochain match". Requiert d'abord un cycle Conception dédié (UX à spécifier : placement, format date, comportement multi-équipes).

**Moyen terme — sessions de phase (~1h)** :
4. **Phase 4.3** : compositions + présences (tables `compositions`, `composition_joueurs`, `presences` + RPC `get_vivier_compo` la plus complexe). **Préalable bloquant : dette C7 instruite par conv Audits** (audit doctrine OVAL-E sur joueurs SAR partenaires d'entente). Sans C7, on ne peut pas peupler les compos avec les attaches SAR/ASCS.

**Long terme — optionnel** :
5. **Phase 4.5** : API distances OpenRouteService (RPC `get_distance_between_sites`, cache, secret API en GitHub Actions). Reportée car non-critique.

**Dettes mineures en cours** :
- (h) Compteur K3 CETTE SEMAINE biaisé jusqu'au 17 mai 2026 (auto-résolutif).
- (g) D-qualite-ffr-array (à grouper avec import OVAL-E été 2026).
- (f) Déploiement comptes `coach` et `viewer` réels (préalable à P4-1).
- (c) Mirror `groupes-joueur.json` v1.1 dans `data/` une fois déposé dans Drive.

---

## 🅱️ AXE B — Conv "MOM Hub · Audits & modélisation"

### Démarrage propre

**Premier message à coller dans la nouvelle conv** :

> Salut Claude. On reprend MOM Hub côté modélisation/audits, en parallèle du travail de production qui se poursuit dans une autre conversation.
> Avant toute proposition : lis `STATE.md` à la racine de `Manu-MOM/mom-hub`, le `PASSATION.md` de la racine, ET la doctrine Drive (`Doctrine-MOM-Hub-v2.md`).
>
> **État au 13 mai 2026 soir tard** : la modélisation événements **v1.1 est LIVRÉE** (`Modelisation-Evenements-v1.1.md` dans Drive `00 - Documentation/`, fileId `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u`). La conv Production a implémenté Phase 4.1.A (peuplement Vague 1) + Phase 4.2.A/B/C (noyau événements en base + RPC + wrappers JS).
>
> Travaux Axe Audits restants (par priorité) :
> 1. **Dette C7 (priorité, bloquante)** : audit doctrine OVAL-E pour les joueurs partenaires d'entente avec `bloc_5.club_principal_id != MOM` (cas SAR/ASCS pour les ententes M14/M16/M19). **Bloque Phase 4.3 (compositions/présences) côté Production**.
> 2. **Lots 2 et 3 de l'audit référentiels** (postes, ateliers, aptitudes, conformite-ffr, observables-match, tests-physiques) — actuellement bloqués par tiers (règlement LRGER 2025-2026, Lohann pour EDR aptitudes, préparateur physique pour barèmes).
> 3. **Reprise des audits modules** (Compositions v2, Suivi-Match, Rapport, Stats, Bilans) à la lumière de la modélisation événements v1.1.
> 4. **Modélisation événements extra-sportifs** (dette Phase 5, C2 du doc modélisation).
> 5. **Modélisation compo adverse + joueurs adverses** (dette C1, reportée après quelques mois d'usage de l'app).
>
> ⚠️ Doctrine anti-invention : ne JAMAIS citer un détail factuel sans `web_fetch`/`Drive:read_file_content` préalable.
>
> Pas de code de production ici. Tout passe par des schémas JSON et des documents d'audit déposés dans Drive.
> Première tâche : me demander par où je veux commencer (C7 fortement recommandée car bloque Phase 4.3).

### Périmètre de la conv Audits
- ✅ Schémas JSON métier (modélisation conceptuelle)
- ✅ Documents d'audit dans Drive
- ✅ Évaluation des référentiels existants vs doctrine
- ✅ Spécifications conceptuelles pour la Vague 2 (événements, équipes, sites)
- ✅ Reprise des audits déjà rédigés (Compositions v2, Suivi-Match, Rapport, Stats, Bilans, Personnes)
- ❌ PAS de code SQL ni JS de production (ça va dans axe A)
- ❌ PAS d'écriture en base Supabase ni dans le repo GitHub

### Pistes prioritaires (à arbitrer en début de conv)

**Piste 1** : ✅ **LIVRÉE 12 mai 2026 soir** — Modélisation événements v1.1 (`Modelisation-Evenements-v1.1.md` Drive `00 - Documentation/`, fileId `1fUJPJ5cQjBORHhHK_DD-b-eBSDnfjs7u`). Implémentée côté Production en Phase 4.2.A/B/C le 13 mai.

**Piste 2 (PRIORITÉ ACTUELLE)** : **Dette C7 — Audit doctrine OVAL-E joueurs partenaires d'entente**
- Statut : ouverte, **bloque Phase 4.3 (compositions/présences) côté Production**
- Périmètre : statuer sur la doctrine OVAL-E §11.3 pour les joueurs avec `bloc_5.club_principal_id != MOM` (cas SAR pour M14 : 37 joueurs ; cas ASCS : 2 joueurs)
- Question centrale : comment représenter en base un joueur SAR qui joue en entente M14 SAR/MOM/ASCS ? Fiche complète dans `personnes` MOM (avec marqueur) ? Fiche allégée ? Pas de fiche du tout (juste un `equipe_joueurs.club_provenance='SAR'`) ?
- Sortie attendue : doc d'audit `Audit-OVAL-E-Joueurs-Partenaires-v1.md` déposé dans Drive
- Préalable à C7 : aucun

**Piste 3** : **Audit des 6 référentiels JSON Drive** (`01 - Référentiels/`)
- postes, ateliers, aptitudes, conformite-ffr, observables-match, tests-physiques
- Statut : Lot 1 (audit générique) ✅ fait. Lots 2 et 3 (audit par référentiel) bloqués par tiers (règlement LRGER 2025-2026, Lohann pour EDR aptitudes, préparateur physique pour barèmes)

**Piste 4** : Reprise des **audits modules** (Compositions v2, Suivi-Match, Rapport, Stats, Bilans) à la lumière de la modélisation événements v1.1 — MAJ post-Phase 4.2.

**Piste 5** : Modélisation **événements extra-sportifs** (dette Phase 5, C2 du doc modélisation).

**Piste 6** : Modélisation **compo adverse + joueurs adverses** (dette C1, reportée après quelques mois d'usage de l'app).

À demander à Manu en début de conv : *"Tu préfères qu'on commence par C7 (recommandé, débloque Phase 4.3) ou une autre piste ?"*

---

## 🔁 Synchronisation entre les 2 axes

Le STATE.md à la racine du repo est le point de vérité partagé :
- **Conv A (Production)** met à jour STATE.md à la fin de chaque phase
- **Conv B (Audits)** lit STATE.md en début de session pour connaître l'état tech, dépose ses sorties dans Drive
- Si Conv B identifie un travail de production (ex: "il faut créer la table `evenements`"), elle l'ajoute en **dette technique** dans STATE.md, et Conv A le prendra plus tard

**Règle d'or** : pas de double-tâche entre les conv. Si tu as un doute sur "où ça va", relis ce document.

---

## 📦 Inventaire fichiers de référence à porter dans chaque nouvelle conv

À avoir sous la main au démarrage :

| Fichier | Où il est | Pour quel axe |
|---|---|---|
| `STATE.md` | racine repo GitHub | A et B |
| `PASSATION.md` (ce doc) | racine repo GitHub | A et B |
| `Doctrine-MOM-Hub-v2.md` | Drive `00 - Documentation/` | A et B |
| `Phase-2-0-decisions-architecture.md` | Drive `00 - Documentation/` | A surtout |
| `Audit-Module-*.md` (5 docs) | Drive `00 - Documentation/` | B surtout |
| `MOM-Core-Synthese-globale-v2.md` | Drive | B surtout |
| `MOM-Core-Cartographie-Globale-v2.md` | Drive | B surtout |

---

## 🆘 En cas de doute

Si tu (Claude) ne sais plus dans quelle conv tu es ou ce que tu dois faire :
1. **STOP**. Ne propose rien.
2. Demande à Manu : *"Je vérifie : on est sur l'axe Production (code/Hub) ou Audits (modélisation/Drive) ?"*
3. Une fois la réponse reçue, relis le périmètre ci-dessus.
4. Puis seulement, propose.

**Manu n'a pas peur des questions de cadrage.** Il a peur que Claude propose des trucs hors-périmètre sans vérifier.