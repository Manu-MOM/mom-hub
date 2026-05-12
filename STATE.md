# STATE.md — MOM Hub

> **Document de référence opérationnel.** À jour à la racine du repo, mis à jour à chaque fin de session significative.
> Sert de point de reprise universel : toute personne (ou tout Claude) qui ouvre ce fichier doit pouvoir reprendre le travail sans question.

**Dernière mise à jour : 12 mai 2026 — fin Phase 3 (Refonte portail + topbar partagée)**

---

## 🎯 Vision du projet

**MOM Hub** est une **plateforme web** qui sert de point d'entrée unique à tous les outils du club **Mutzig Ovalie Molsheim** (rugby, Alsace).

C'est un **portail/agrégateur**, PAS une migration. Les outils existants (SportEasy, Drive, OVAL-E FFR, etc.) continuent à vivre ; le Hub leur sert de couche de jonction.

**Doctrine fondatrice** : **simplicité d'usage avant tout**. Pas d'over-engineering, pas de schémas baroques, fichiers JSON éditables à la main si possible.

**Budget** : 0 € strict. Stack : GitHub Pages + Supabase free tier + Google Drive.

---

## 🏛️ Architecture en 3 lieux

| Lieu | Rôle | Contenu |
|---|---|---|
| **Google Drive** `MOM Hub/2025-2026/` | Source de vérité documentaire et workspace humain | Doctrine, audits, schémas JSON, plans d'attaque, référentiels métier (versions canoniques) |
| **GitHub** `Manu-MOM/mom-hub` (public) | Code, déploiement, mirroir lecture seule des référentiels | `index.html`, `js/`, `data/` (miroir JSON), `sql/`, `.github/workflows/`, STATE.md |
| **Supabase** `mom-hub` (free tier) | Source de vérité des **données vivantes** (personnes, événements, présences, etc.) | 9 tables Vague 1 (6 remplies), fonctions RPC, RLS |

⚠️ **Repo GitHub PUBLIC** : ne jamais commit la clé `service_role`, les fiches Personne brutes, ou toute donnée perso (en particulier les SQL des chantiers C1-C4 de la réconciliation OVAL-E).

---

## 📊 État des phases

### ✅ Phase 1 — Déploiement initial du Hub (FAIT)
- Portail HTML déployé sur GitHub Pages : https://manu-mom.github.io/mom-hub/
- Repo public : https://github.com/Manu-MOM/mom-hub
- 9 référentiels JSON mirrorés depuis Drive vers `data/`
- Design : tableau de bord vert bouteille + or, charte Oswald/Manrope/JetBrains Mono

### ✅ Phase 2.0 — Fondations Supabase (FAIT)
- Projet Supabase `mom-hub` créé (NANO compute, healthy)
- URL : `https://fvfqffxaiaoygqhjtxwr.supabase.co`
- 9 tables Vague 1 créées + RLS activé + policies lecture publique sur les référentiels
- 294 personnes migrées via le script `03-migration-personnes-vague1.sql` (**NON commit dans repo public**, archivé local + Drive)
- Anti-pause GitHub Action `keep-alive-supabase.yml` opérationnel (cron 03h UTC, GET poles?limit=1)
- Secrets GitHub configurés : `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### ✅ Phase 2.4 — Portail dynamique (FAIT — 11 mai 2026)
- `js/supabase-client.js` : wrapper `SupabaseHub` autour du client supabase-js v2
- `js/dashboard-stats.js` v1.1 : met à jour les compteurs du dashboard via RPC
- Fonction RPC `get_dashboard_stats()` créée dans Supabase (SECURITY DEFINER)
- 5 modifs dans `index.html` : 5 IDs ajoutés (`stat-personnes`, `stat-m14`, `greeting-meta`, `greeting-sub`, `se-joueurs` optionnel) + 3 balises `<script>` avant `</body>`
- Page de diagnostic `test-supabase.html` à la racine, fonctionnelle
- **Validé visuellement** : "LUNDI 11 MAI 2026 · CONNECTÉ À SUPABASE", "293 personnes en base · données live Supabase"

### ✅ Phase 2.4.5 — Réconciliation OVAL-E (FAIT — 11 mai 2026)

Première synchronisation Supabase ↔ OVAL-E (export FFR XLSX 358 lignes, 298 personnes uniques). Permet de clore les dettes techniques #1 et #2.

**Effets sur la base** :
- C1 (doublons) : 4 DELETE + 3 UPDATE (293 → 289 lignes)
- C2 (LRGER fantôme) : 1 DELETE de la fiche WINCKLER qui contenait par erreur les données CAMPESE (289 → 288)
- C3 (enrichissement) : 2 UPDATE pour ajouter les licences FFR de JUNG Emmanuel et RULFO Vivien
- C4 (création) : 35 UPSERT pour les licenciés OVAL-E absents de Supabase (1 joueur M-10 + 22 parent_et_staff + 12 staff/dirigeant) → 288 → **323 lignes**
- C5 (comparaison des 261 en intersection) : 0 divergence — le batch correction du 10 mai avait déjà parfaitement aligné les fiches

**Évolutions schéma `personnes`** :
- CHECK constraint `personnes_categorie_personne_check` étendue avec 3 nouvelles valeurs : `joueur_et_parent`, `joueur_et_staff`, `joueur_et_parent_et_staff`
- INDEX UNIQUE créé sur `numero_licence_ffr` (idempotence des futurs imports OVAL-E)

**Pattern réutilisable saisonnier** : les scripts C4 (UPSERT `ON CONFLICT (numero_licence_ffr) DO UPDATE`) sont conçus pour être rejoués à chaque export OVAL-E (été 2026 pour saison 26-27, etc.) sans dégât. La doctrine §10 est respectée : les champs OVAL-E faisant autorité sont mis à jour, les enrichissements manuels (email, tel, adresse déjà renseignés) sont préservés via `coalesce`.

**Cible alignement OVAL-E atteinte** :
- Supabase : 323 personnes, dont **298 licenciées FFR (alignement strict OVAL-E)** + 25 non-licenciées (parents non-MOM, 1 contact LRGER CAMPESE)

### ✅ Phase 2.5 — Authentification Magic Link (FAIT — 11 mai 2026)

**Décisions structurantes appliquées** :
- **Auth Magic Link** (mail → lien éphémère, pas de mot de passe)
- **3 rôles** : admin / coach / viewer (seul `admin` réellement attribué à ce jour, sur le compte de Manu)
- Premier admin : Manu (UID `7ac40334-0d2a-4b1f-822b-133d564abe6c`), attribué via `INSERT` SQL direct après création du compte par Magic Link

**Sous-étapes livrées** :
1. ✅ **2.5.1** — Table `auth_roles` (pk composite `user_id, role`, CHECK in `('admin','coach','viewer')`), helpers SQL `has_role(p_role)` et `get_my_roles()` en `SECURITY DEFINER`, RLS activée avec 2 policies SELECT (own + admin). Fichier : `sql/04-auth-roles.sql`.
2. ✅ **2.5.2** — Config Supabase Auth : Email Enabled, Confirm email ON, Site URL `https://manu-mom.github.io/mom-hub`, Redirect URLs whitelist `https://manu-mom.github.io/mom-hub/**`.
3. ✅ **2.5.3** — `login.html` (page minimaliste, charte Hub, bouton "Recevoir le lien"), extension `js/supabase-client.js` v1.1 puis v1.2.
4. ✅ **2.5.4** — Session helpers JS dans `supabase-client.js` v1.3 : `getMyRoles()` (cache mémoire), `hasRole(role)`, `isAdmin()`, `requireAuth({ role })` avec redirect, `onAuthChange(callback)`, `signOut()` enrichi.
5. ✅ **2.5.5** — `dashboard.html` page admin sécurisée via `requireAuth({ role: 'admin' })`, pattern `auth-pending` pour éviter tout flash de contenu pendant la vérification de session.
6. ✅ **2.5.6** — Intégration auth au portail (`index.html`) : boutons icônes "Admin" + "Déconnexion" dans la puce `.user-profile` (mode admin), pilule "Se connecter" à la place de la puce (mode anonyme). Tout piloté par classes `body.auth-resolved` / `body.auth-anon` / `body.auth-admin`.

**Leçons techniques apprises** :
- `supabase-js` v2 utilise `window.location.origin` par défaut comme `emailRedirectTo` (pas la Site URL Supabase). Pour les Pages hébergées dans un sous-chemin (`/mom-hub/`), il faut **passer explicitement** le bon redirect. Cf. `requestMagicLink()` v1.2.
- Gmail scanne les liens Magic Link à la réception (antiphishing), ce qui peut consommer le token avant le clic utilisateur. Workaround testé : copier-coller le lien dans la barre d'adresse plutôt que clic direct. Pour les tests futurs, préférer une adresse non-Gmail.
- Lors d'un `str_replace` qui injecte du HTML près d'une fermeture, **toujours vérifier l'équilibre des balises ouvrantes/fermantes** dans le bloc remplacé (et viser un pattern de remplacement qui inclut la balise fermante connue). Erreur faite en 2.5.6 : injection dans `.user-profile` au lieu de à côté → boutons masqués par effet de bord.
- Pour positionner un nouvel élément dans une topbar existante en `display: grid`, ne **pas** essayer de le placer en `position: absolute` calé au pixel près — intégrer plutôt l'élément dans un conteneur existant qui a déjà son slot dans le grid.

**Reste à faire (hors périmètre 2.5, reporté Phase 3)** : ergonomie du portail dans son ensemble — voir dette "Architecture portail".

---

### ✅ Phase 3 — Refonte portail + topbar partagée (FAIT — 12 mai 2026)

Refonte complète de l'expérience utilisateur du portail, en réponse aux dettes #9 (architecture portail), #10 (panneau ÉTAT DU HUB obsolète), #11 (CSS dupliqué).

**Décisions structurantes appliquées** (cf. `Conception-Portail-Phase-3.md` v1.0 sur Drive, id `12xrICwk5NTzk1XZLpq964CkWwhft3zc2`) :
- **Phase 3 partie 1/2 (factorisation CSS + topbar partagée)** : création de `css/hub.css` (palette canonique, polices, reset, topbar Hub partagée, états d'auth, classes utilitaires `.page-centered/.card/.btn/.feedback/.footer`). Adoption de la topbar Hub sur `index.html` (mode `fullscreen-app`), `login.html` (variante minimaliste), `dashboard.html` (variante admin complète).
- **Phase 3 partie 2/2 (refonte portail)** : refonte de la zone sous-bandeau d'`index.html` selon §2.2 à §2.5 du doc de conception. Greeting recontextualisé, 4 KPI repensés (2 vert stable + 2 ambre actions), 5 sections avec sous-titres éditoriaux italique, sidebar 3 cartes (OVAL-E / Qualité des données / Raccourcis), retrait du panneau ÉTAT DU HUB.

**Sous-étapes livrées** :
1. ✅ **3.1.A** — `css/hub.css` créé (482 lignes), `index.html` factorisé (-22%), `login.html` adopte topbar minimaliste (-27%), `dashboard.html` adopte topbar complète (-20%). 1 commit `Phase 3 (1/2) — factorisation CSS + topbar partagée (dette #11)`.
2. ✅ **3.2.A** — `sql/05-rpc-portail.sql` : 5 fonctions PostgreSQL (`count_personnes_created_last_7_days`, `count_personnes_without_email`, `count_personnes_without_birthdate`, `count_personnes_affiliation_expiring_within_90_days`, `get_last_oval_e_sync_date`). Exécutées en prod Supabase, testées.
3. ✅ **3.2.B** — `js/supabase-client.js` v1.3 → v1.4 : 5 wrappers async `SupabaseHub.countPersonnesCreatedLast7Days()` etc., avec tolérance d'erreur (valeur neutre 0/null si échec).
4. ✅ **3.2.C** — Refonte `index.html` : nouveau greeting (surtitre dyn `LUNDI 12 MAI 2026 · TABLEAU DE BORD`, titre `BONJOUR MANU,`, sous-ligne `Référent M14 · saison 2025-2026`), 4 KPI (PERSONNES vert / ÉQUIPES vert dur=11 / CETTE SEMAINE ambre / SANS EMAIL ambre), 5 sections avec 18 outils v3 (4-4-3-4-3) tous "À VENIR" et sous-titres éditoriaux, sidebar 3 cartes. Adaptation `js/dashboard-stats.js` v1.1 → v2.0 pour peuplement dynamique.

**Effets de bord temporels assumés** (option A doctrine — ne pas masquer) :
- **K3 CETTE SEMAINE = +323** : tous les fichiers ayant été créés dans les 7 derniers jours (premier import OVAL-E le 10 mai, batch v1.1 le 10 mai, réconciliation le 11 mai), le compteur affichera 100% pendant quelques semaines. Redeviendra normal à partir du ~19 mai 2026.
- **Sidebar QUALITÉ FFR 90j = 298** : presque toutes les affiliations 2025-2026 expirent le 30 juin par construction. Effet saisonnier qui reviendra entre fin avril et début juillet chaque année.

**Leçons techniques apprises** :
- L'archivage de la topbar Hub en CSS partagé (`hub.css`) demande de bien isoler les classes utilitaires génériques (`.card` sans contrainte de largeur) des classes contextuelles (`.card--login` qui ajoute max-width). Sinon collision entre login (carte large 420px) et dashboard (mini-cartes grid). Cf. discussion `.page` → `.page-centered` au début de la session.
- Pour un peuplement dynamique multi-RPC, utiliser `Promise.all` plutôt que des `await` séquentiels — gain de latence x6 quand on a 6 appels indépendants. Cf. `dashboard-stats.js` v2.0.
- L'éclaircissement entre version Doctrine (riche en données) et version v3 (riche en libellés) se résout par l'option C : adopter v3 pour les libellés/icônes/structure (gratuit), garder Doctrine pour les données (pas d'invention). Cas non trivial : "Réservation matériel" v3 EN LIGNE avec sous-titre infrastructures = ambiguïté sémantique. Solution Manu : "aucun outil n'est en ligne aujourd'hui, tous À VENIR, ils seront basculés au fil de l'intégration réelle".

**Reste à faire (hors périmètre, reporté Phase 4)** : voir 7 dettes P4-1 à P4-7 ouvertes ci-dessous.

---

## 🗃️ Schéma Supabase Vague 1 (état réel au 11 mai 2026, post-Phase 2.4.5)

Source de vérité agrégée — issue de `get_dashboard_stats()` :

```json
{
  "nb_personnes": 323,
  "nb_m14": 24,
  "nb_poles": 5,
  "nb_clubs": 4,
  "nb_categories": 14
}
```

| Table | Lignes | Source | Statut |
|---|---|---|---|
| `poles` | 5 | référentiel `postes.json`/Drive | ✅ rempli, lecture publique RLS |
| `categories` | 14 | référentiel `categories.json` (mirrorée dans data/) | ✅ rempli, lecture publique RLS |
| `clubs` | 4 | référentiel manuel | ✅ rempli, lecture publique RLS |
| `saisons` | 1 | saison active 2025-2026 | ✅ rempli, lecture publique RLS |
| `postes` | 20 | référentiel `postes.json` (v1.1, format 13) | ✅ rempli, lecture publique RLS |
| `personnes` | **323** | fiches Drive + reconciliation OVAL-E 2026-05-11 | ✅ rempli, **PAS de policy SELECT publique** (RGPD) |
| `ententes` | 0 | — | ⏳ Vague 2 |
| `equipes` | 0 | — | ⏳ Vague 2 |
| `equipe_joueurs` | 0 | — | ⏳ Vague 2 |

---

## 🧠 Pattern technique acquis (réutilisable)

**RPC `SECURITY DEFINER` pour exposer des agrégats sans policy publique sur les tables sensibles.**

Cas d'usage : afficher des compteurs (nb_personnes, etc.) sur une page publique, sans exposer aucune donnée perso.

Pattern :
```sql
create or replace function public.ma_fonction()
returns json
language plpgsql
security definer  -- s'exécute avec les privilèges du créateur
set search_path = public
as $$ ... $$;

grant execute on function public.ma_fonction() to anon, authenticated;
```

Côté JS : `const { data, error } = await supabase.rpc('ma_fonction');`

À réutiliser pour tous les futurs compteurs/agrégats du Hub.

**UPSERT idempotent par licence FFR pour les imports OVAL-E saisonniers (acquis Phase 2.4.5).**

Pattern :
```sql
insert into personnes (...) values (...)
on conflict (numero_licence_ffr) do update set
    -- champs §10 OVAL-E faisant autorité (toujours écrasés)
    nom = excluded.nom,
    prenom = excluded.prenom,
    qualite_ffr = excluded.qualite_ffr,
    date_fin_affiliation = excluded.date_fin_affiliation,
    -- champs hors §10 (préservation des enrichissements manuels)
    email_principal = coalesce(personnes.email_principal, excluded.email_principal),
    telephone_principal = coalesce(personnes.telephone_principal, excluded.telephone_principal),
    adresse_postale = coalesce(personnes.adresse_postale, excluded.adresse_postale),
    -- type_personne : on ne dégrade jamais un licencié vers non_licencie
    type_personne = case when personnes.type_personne in ('non_licencie','non_licencie_au_mom')
                         then excluded.type_personne else personnes.type_personne end,
    modifie_par = excluded.modifie_par,
    updated_at = now();
```

À rejouer chaque saison avec un nouvel export OVAL-E.

---

## 🩹 Dettes techniques à traiter

### ✅ Dettes résolues le 11 mai 2026 (Phase 2.4.5)

1. ~~**Écart 293 vs 294 personnes**~~ ✅ **RÉSOLU** : OVAL-E a donné l'arbitrage. Le 294 était le chiffre cible du script de migration Phase 2.0 ; le 293 réel résultait d'un doublon perdu (LUTZ Hugo parent fantôme). La base est maintenant à 323 lignes dont 298 licenciées FFR alignées OVAL-E.
2. ~~**Écart 24 vs 23 M14**~~ ✅ **RÉSOLU** : Supabase a 24 M14 = 16 M-14 + 8 F-15 intégrées. SportEasy doit avoir 1 F-15 manquante (Eden FAUVEL et Auriane DECOURCELLE sont les 2 F-15 qui n'étaient pas dans l'audit Personnes — à vérifier dans SportEasy).

### 🟡 Dettes encore actives

3. **293 fichiers JSON personnes** ont nom-de-fichier ≠ uuid contenu interne. Détecté lors de la migration Phase 2.0. Pas bloquant tant qu'on ne ré-importe pas, mais à corriger pour la Vague 2.
4. **Référentiels Drive `01 - Référentiels/`** : 6 fichiers JSON existent (postes, ateliers, aptitudes, conformite-ffr, observables-match, tests-physiques) mais leur **contenu et conformité à la doctrine reste à évaluer** (Axe B / conv Audits).
5. ~~**Chiffres en dur résiduels dans index.html**~~ ⚠️ **PARTIEL** : "16 Sites" et "11 Équipes" restent en dur tant que les tables `sites` et `equipes` ne sont pas créées/remplies (Phase 2.2 future). Le compteur "323 personnes" est dynamique via la RPC. **24 M14** est aussi dynamique depuis Phase 2.4.5.
6. ~~**Date `VENDREDI 8 MAI 2026 · HUB INITIALISÉ` dans le HTML statique**~~ ✅ **RÉSOLU** (11 mai 2026, Phase 2.5.6) : remplacé par "TABLEAU DE BORD" (date injectée dynamiquement par JS au format `toLocaleDateString('fr-FR')`). Greeting-sub neutralisé en "Effectifs synchronisés avec OVAL-E" (et probablement écrasé par `dashboard-stats.js` au runtime avec le compteur dynamique). Panneau sidebar "État du Hub" : "Hub initialisé aujourd'hui" → "Hub en production".
7. ~~**Désalignement Drive ↔ Supabase post-réconciliation OVAL-E**~~ ✅ **ARBITRÉ** (11 mai 2026, conv Audits) : Drive figé au 10 mai 2026 pour la saison 2025-2026, Supabase devient source autoritative des données vivantes. Décision saison 2026-2027 reportée à l'été. Doctrine : `Doctrine-Import-OVAL-E-v1.3.md §13`. Pas d'action Production requise.
8. **CHECK constraint `personnes_type_personne_check` à étendre** (arbitré 11 mai 2026) : suite à la décision doctrinale `Doctrine-Import-OVAL-E-v1.3.md §14`, ajouter `licencie_soigneur` et `licencie_arbitre` aux valeurs autorisées de `personnes.type_personne` (fidélité à la nomenclature FFR : Joueur / Dirigeant / Éducateur / Soigneur / Arbitre).
   - Migrer les fiches existantes classées par défaut `licencie_dirigeant` mais en réalité soigneurs (minimum MICHEL STEPHANE) vers `licencie_soigneur`
   - Mettre à jour le script d'import OVAL-E (été 2026) pour appliquer le nouveau mapping `qualite_ffr_principale → type_personne` du §14
   - Effort estimé : ~10 minutes côté SQL + migration ponctuelle

### 🔵 Dettes ouvertes par la Phase 2.5

9. ~~**Architecture du portail à revoir**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2) : la version actuelle de `index.html` est fonctionnelle mais a une architecture d'information faible (KPI passifs "323 / 16 / 11 / 24" plutôt qu'orientés actions, greeting plat, sidebar pauvre, hiérarchie des outils peu lisible). **Référence v3 à conserver** comme inspiration : capture d'écran d'un prototype antérieur (mom-hub-accueil-v3) qui propose un greeting contextualisé ("J-3 AVANT MATCH · 3 actions en attente · compo M14 à finaliser · 2 nouveaux licenciés"), des KPI orientés actions ("3 PRÉSENCES / 1 COMPO / +2 LICENCIÉS / 8 CERT. MÉD."), des sous-titres de section ("construction & planification" / "le quotidien du coach"), et 3 cartes sidebar utiles (Prochain match, À venir, Passerelle synchronisée). Travail à reprendre côté axe B (conception) avant retour Production.
10. ~~**Panneau "État du Hub" sidebar contient encore des infos obsolètes**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.2) : panneau retiré, remplacé par sidebar 3 cartes (OVAL-E / Qualité des données / Raccourcis).
11. ~~**CSS dupliqué entre `index.html`, `login.html`, `dashboard.html`**~~ ✅ **RÉSOLU** (12 mai 2026, Phase 3.1) : factorisation dans `css/hub.css` (palette canonique 15+6 vars, reset, topbar Hub partagée, classes utilitaires).
12. **Mini-déséquilibre `<div>` ouverts/fermés dans `index.html`** (1 div fermante manquante quelque part, présent dès la version initiale du fichier). Tolérée par les navigateurs, sans impact visuel constaté. À nettoyer lors de la refonte.
13. **Allow new users to sign up = ON dans Supabase Auth** : à terme passer à OFF pour fermer les inscriptions spontanées (les comptes seront créés par un admin). À traiter quand les autres rôles seront déployés (coach, viewer).

### 🔵 Dettes ouvertes par la Phase 3

Issues directes du doc `Conception-Portail-Phase-3.md` §3 (12 dettes consolidées en 7).

P4-1. **Adaptation portail par rôle** (`coach`, `viewer`) : en Phase 3, tous les rôles voient le même portail avec mêmes 18 outils, mêmes sections, mêmes KPI, même sidebar. Quand des comptes `coach` et `viewer` réels existeront et auront fourni des retours d'usage, calibrer un portail dédié (filtrage sections vs vignettes, sidebar personnalisée, KPI contextualisés). Référence doc §2.6.

P4-2. **Greeting contextualisé `J-N AVANT MATCH`** : pour reproduire l'intuition forte de la v3 (afficher l'événement à venir le plus proche dans le surtitre), il faut d'abord la table `evenements` qui n'existe pas. Modélisation à mener côté conv Audits. Référence doc §2.2.

P4-3. **KPI ou widget « prochain match / présences / compo »** : idem P4-2, attend la modélisation événements + présences + compositions. Pertinent uniquement pour rôle `coach`.

P4-4. **Sync SportEasy automatisée** (avec sidebar dédiée) : remplacerait à terme la mention historique `SportEasy · M14 enrichis (23)` par un vrai état de sync bidirectionnelle. Hors périmètre actuel ; à arbitrer Phase 4 sur la base d'un vrai cas d'usage.

P4-5. **Greeting mode anonyme à préciser** : §2.2 du doc évoque un libellé `BIENVENUE SUR MOM HUB,` pour visiteur non connecté, mais l'expérience mode anonyme n'est pas formellement définie. À traiter quand on activera un vrai compte `viewer` ou qu'on aura une page d'accueil publique.

P4-6. **Personnalisation des `RACCOURCIS` (sidebar carte 3)** : actuellement 3 liens en dur (Annuaire complet / Éditeur de compositions / Bibliothèque ateliers) communs à tous. À terme, personnaliser selon le rôle (un coach a d'autres priorités qu'un dirigeant) ou même selon l'historique de clics. Référence doc §2.5.

P4-7. **Outil de listing filtré des fiches** (cible des liens carte 2 Qualité des données) : actuellement les chiffres "1 fiches sans email / 25 fiches sans naissance / 298 affiliations expirent dans 90j" sont du texte non cliquable. À terme, transformer en liens vers une vue filtrée des fiches concernées. Référence doc §2.5.

### 🔵 Dette technique mineure ouverte par Phase 3

P3-mineure. **Logo M2M dupliqué en base64 dans 3 HTML** (~56 ko × 3 = ~170 ko inutiles dans le repo) : `index.html`, `login.html`, `dashboard.html` contiennent chacun une copie base64 du logo. À externaliser dans `assets/logo-m2m.jpg` chargé via `<img src="assets/logo-m2m.jpg">`. Non bloquant, traitable à toute occasion.

P3-mineure-2. **`sql/04-auth-roles.sql` mal placé à la racine du repo** au lieu du dossier `sql/`. À déplacer un jour pour cohérence (les fichiers SQL 01, 02, 05 sont bien dans `sql/`). Non bloquant.

---

## 📂 Structure repo finale

```
mom-hub/
├── .github/workflows/keep-alive-supabase.yml
├── data/                                  # miroir lecture seule des référentiels Drive
│   ├── README.md
│   ├── aptitudes.json
│   ├── ateliers.json
│   ├── categories.json
│   ├── conformite-ffr.json
│   ├── observables-match.json
│   ├── postes.json
│   ├── tests-physiques.json
│   └── (3 autres)
├── js/
│   ├── data-loader.js                     # ancien loader des référentiels statiques
│   ├── supabase-client.js                 # wrapper SupabaseHub
│   └── dashboard-stats.js                 # v1.1 — utilise RPC get_dashboard_stats
├── sql/
│   ├── 01-creation-tables-vague1.sql
│   └── 02-migration-referentiels-vague1.sql
│   # NB: 03-migration-personnes-vague1.sql NON commit (données perso)
│   # NB: C1/C2/C3/C4-*.sql (réconciliation OVAL-E 2026-05-11) NON commit (données perso)
├── README.md
├── STATE.md                               # ← CE FICHIER
├── PASSATION.md                           # kit de démarrage par thématique
├── index.html                             # portail dynamique
└── test-supabase.html                     # page de diagnostic
```

---

## 🔐 Secrets & accès

- Secrets GitHub Actions : `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Clé `service_role` Supabase : **stockée par Manu en local, jamais commit**
- Mot de passe DB Supabase : **stocké par Manu en local**

---

## 📚 Documents Drive de référence

Dossier `MOM Hub/2025-2026/` :

| Document | id Drive | Rôle |
|---|---|---|
| `Doctrine-MOM-Hub-v2.md` | `1Ebx20ANb80hU0giLSfVAl8n5OSZFwJZW` | Doctrine fondatrice (simplicité, 3 lieux) |
| `Phase-2-0-decisions-architecture.md` | dans `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK` | Acte décisions Phase 2.0 |
| `MOM-Core-Synthese-globale-v2.md` | `1X0FjB6Z9eVlxH0VcEQ4le2wf8eCMmmly` | Synthèse globale modèle |
| `MOM-Core-Cartographie-Globale-v2.md` | `1N2I86T751XneQT9fx1wCQWusmeCz235T` | Cartographie complète |
| `Doctrine-Import-OVAL-E-v1.1.md` | `1puTaNLXno99T4C9ECkEIgi1YGbk6bE41` | Doctrine import licences FFR (v1.2 et v1.3 ajoutées le 11 mai 2026 dans le même dossier Drive) |
| `Audit-Module-Compositions-v2.md` | `114UBo2lSqB8t8J2o0YRc55Nc8uoNtgCM` | Audit module Compos (v2) |
| `Audit-Module-Suivi-Match.md` | — | Audit module Suivi-Match |
| `Audit-Module-Rapport.md` | — | Audit module Rapport |
| `Audit-Module-Statistiques.md` | — | Audit module Stats |
| `Audit-Module-Bilans.md` | — | Audit module Bilans |
| `Audit-Personnes-MOM-Hub.md` | `1DsehRBgzGq_kAraCZvpKElCvddmAOM3b` | Audit du modèle Personnes (v1.1 ajoutée le 11 mai 2026 dans le même dossier Drive) |

Dossiers clés :
- `01 - Référentiels/` : `1RpOU_TtO20GMQejvJv8th0jXcQYqHb8h` (6 fichiers JSON, conformité à évaluer)
- `00 - Documentation/` : `1CkeBrMBJGChqGui4r7mVkHa3NwaLwOSK`
- `01 - Référentiels/personnes/` : `17hmQpAX_etb3pdRvJ_-NBeL2RK17T2NE` (sous-dossiers joueurs/parents/contacts-externes)

---

## 🚀 Prochaine session

**Avant de démarrer toute Phase 3** :
1. Lire ce STATE.md (5 min)
2. Lire `PASSATION.md` (kit de démarrage par thématique)
3. Vérifier que la chaîne Hub → Supabase fonctionne toujours (ouvrir `https://manu-mom.github.io/mom-hub/`, F12 console, doit afficher `✅ MOM Hub Dashboard: stats mises à jour depuis Supabase` ET `🏉 MOM Hub · Supabase Client v1.4 chargé`)
4. Vérifier que le portail affiche bien **323 personnes** (compteur dynamique post-Phase 2.4.5) et que les boutons d'auth réagissent (icône grille + flèche en mode admin, pilule verte "Se connecter" en mode anonyme)
5. Vérifier que `login.html` affiche bien `v1.3 chargé` dans la console et que l'envoi d'un Magic Link sur ton email aboutit sur `dashboard.html` avec session active

**Travaux en attente** :
- **Conv Production** : la Phase 3 est terminée. Travaux possibles pour la Phase 4 selon priorités à arbitrer : (a) modélisation table `evenements` (P4-2/P4-3) — préalable à toute évolution UX du portail orientée "prochain match" ; (b) déploiement comptes `coach` et `viewer` réels (P4-1) ; (c) externalisation logo M2M (dette mineure P3) ; (d) déplacement `04-auth-roles.sql` vers `sql/` (dette mineure P3-2).
- **Conv Audits** : reprise des audits + modélisation événements (matchs / entraînements / tournois) + transmission des dettes Axe B (D1-D6) issues de la réconciliation OVAL-E (voir `dettes-axe-b-reconciliation-OVAL-E.md` déposé dans Drive). Maintenant que la conception portail Phase 3 est livrée, la modélisation événements devient le prochain gros chantier conceptuel.
- **Conv Conception Portail** : a livré `Conception-Portail-Phase-3.md` v1.0 (Drive `12xrICwk5NTzk1XZLpq964CkWwhft3zc2`). Pour Phase 4, rouvrir un cycle Conception si besoin de définir le portail par rôle (P4-1).