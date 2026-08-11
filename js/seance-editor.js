/**
 * MOM Hub · Seance Editor
 * ============================================================
 *
 * Module IIFE qui pilote la page seance.html (Préparation de séance).
 * Calqué sur le pattern compositions-editor.js (Phase 4.4) :
 * sections numérotées, State global au module, DOM selectors lazy,
 * helpers, rendus, actions, chargements, init.
 *
 * Phase 5.5 — Construit progressivement :
 *   - 5.5.A : éditeur méta + sauvegarde manuelle (CETTE VERSION)
 *   - 5.5.B : autosave 30s + dropdowns lieu/événement + champs secondaires
 *
 * Version : 1.27 — RENCONTRES : colonne match 2× plus large (août 2026)
 *   v1.27 : Cosmétique rencontres. La ou les colonnes « match » de la matrice
 *           (écran + PDF) sont rendues 2× plus larges qu'une colonne atelier
 *           (une station-match vaut 2 groupes). Classes CSS ajoutées sur th/td
 *           (seance-circuit__matrix-match / seance-print__circuit-match) ;
 *           largeurs pilotées dans seance.html. Mode circuit inchangé.
 * Version : 1.26 — RENCONTRES TOURNANTES UI de saisie (août 2026)
 *   v1.26 : RENCONTRES-TOURNANTES (FAIT FOI gelé 11/08/2026), maillon 3/3.
 *           UI de saisie dans le panneau circuit : sélecteur Format
 *           (circuit/rencontres), rotation (cyclique/vainqueur_reste), et une
 *           rangée de rôles par voie (atelier/match). Helper
 *           _panneauRencontresControlsHtml + handlers onChangeCircuitMode /
 *           onChangeCircuitRotationKind / onToggleRoleVoie + _payloadCircuit
 *           (upsert ligne complète, préserve tous les champs). Style dans
 *           seance.html (commit séparé). Moteur/rendus v1.25 inchangés.
 * Version : 1.25 — RENCONTRES TOURNANTES moteur+rendus (août 2026)
 *   v1.25 : RENCONTRES-TOURNANTES (FAIT FOI gelé 11/08/2026), maillon 2/3.
 *           Mode 'rencontres' du circuit (extension additive). Helpers neufs
 *           _matriceRencontres / _matriceRencontresHtmlPdf /
 *           _matriceRencontresHtmlEcran / _roleVoie / _celluleRencontreTexte.
 *           Rendus écran + PDF routés par circ.mode. Cas (a) : 1 voie match
 *           (2 groupes, "G1 vs G2") + N ateliers, rotation cyclique "qui se
 *           repose". vainqueur_reste = cadre-règle sans matrice. Cas (b) =
 *           dette. _matriceRotation / _matriceRotationHtmlPdf INTOUCHÉS.
 *           UI de saisie du mode/rôles = maillon 3 (à venir).
 *   v1.24 : Deux retours de recette (Manu). (1) Retrait des SUGGESTIONS de
 *           noms de groupes (Perf/Dév/Ini) : helper _nomsSuggeresGroupes,
 *           rendu et bind add-groupe-nomme supprimés ; le bouton "+ Ajouter
 *           un groupe" (groupe vide, nommé ensuite) reste. (2) PDF coach :
 *           la matrice de rotation apparaît désormais sous chaque étage-
 *           circuit (helper _matriceRotationHtmlPdf, réutilise le calcul
 *           _matriceRotation) et chaque station affiche sa durée
 *           ("N min / station"). Additif, node --check OK. CSS PDF associé
 *           livré dans seance.html.
 *   v1.23 — CIRCUIT rendu rotation (août 2026)
 *   v1.23 : CIRCUIT D'ATELIERS — rendu visuel de la rotation. Nouveau helper
 *           _matriceRotation(blocsEtage) : matrice temps × stations (rendu
 *           dérivé, rien stocké — D5). Rotation cyclique : au tour t, le
 *           groupe g occupe la station (g+t) % S ; nb de tours = nb de
 *           stations. Stations = voies de l'étage ; groupes = union des noms
 *           distincts des groupes_jsonb des stations. Déséquilibres (choix
 *           Manu) : G<S → stations vides "—" ; G=S → nominal ; G>S →
 *           avertissement (pas de matrice élaborée). Chaque tour affiche son
 *           heure de début relative (station + pause). Affiché sous le
 *           panneau circuit. Le CSS .seance-circuit__matrix* est livré à
 *           part dans seance.html. Additif pur, node --check OK.
 *   v1.22 — GROUPES LIBRES (D3, août 2026)
 *   v1.22 : LIBÉRATION DES GROUPES (FAIT FOI D3). Fin des 3 groupes fixes
 *           G1/G2/G3 mappés au référentiel : les groupes sont désormais
 *           LIBRES — nommés à la volée, en nombre variable (0..N). Le
 *           référentiel groupes-joueur.json ne sert plus que de SUGGESTIONS
 *           de nom (boutons rapides). Couleur par POSITION (palette cyclique
 *           _couleurGroupeParIndex). getGroupesCourants retourne les groupes
 *           stockés tels quels (plus d'invariant 3). Nom éditable par carte,
 *           bouton supprimer-groupe, bouton "+ Ajouter un groupe". Nouvelles
 *           mutations onAddGroupe / onRenameGroupe (refus doublon) /
 *           onRemoveGroupe. persistGroupes filtre les groupes sans nom.
 *           Popover joueurs inchangé (référence par nom, couleur par
 *           position). Stockage groupes_jsonb, héritage et unicité déjà
 *           génériques : non touchés. AUCUN impact compositions
 *           (equipe_joueurs.niveau_profil) : usages disjoints. CSS des
 *           nouveaux contrôles livré à part dans seance.html. node --check OK.
 *   v1.21 — CIRCUIT-ATELIERS durée & pause (sql_242, août 2026)
 *   v1.21 : CIRCUIT D'ATELIERS — corrections recette terrain (Manu).
 *           (1) BUG durée : un étage-circuit compte ses stations en
 *           SUCCESSION, pas en simultané. Nouveau helper
 *           _dureeEffectiveEtage(etage) : durée = (station × nb_stations)
 *           + (pause × (nb_stations − 1)) pour un circuit, sinon dureeMax
 *           (parallèle simultané inchangé). Les 6 points consommant la
 *           durée d'étage (rendu trame, footer récap, export PDF joueurs
 *           & coachs) routés vers ce helper. (2) Pause entre stations :
 *           champ de saisie + handler onChangeCircuitPause (sql_242,
 *           colonne duree_pause_min). saveCircuit envoie désormais la
 *           ligne complète (station + pause) pour préserver l'autre champ
 *           à l'upsert. Récap enrichi : "N stations · X min au total".
 *           Additif pur, node --check OK.
 *   v1.20 : CIRCUIT D'ATELIERS — mécanisme (FAIT FOI gelé). Un étage
 *           PARALLÈLE peut être qualifié de "circuit" : les groupes tournent
 *           sur les voies. Ligne dépliable sous l'étage parallèle (case à
 *           cocher "Faire tourner les groupes" + saisie durée par station).
 *           État : State.circuits (fiches seances_etages_circuits, sql_241),
 *           chargé dans loadBlocs via listCircuits. Helper _circuitDeLetage.
 *           Handlers onToggleCircuit (saveCircuit/deleteCircuit) +
 *           onChangeCircuitDuree (saveCircuit upsert), pattern optimiste +
 *           repli honnête. Périmètre = MÉCANISME seul ; le rendu visuel de la
 *           rotation (groupes tournants) viendra dans un livrable dédié. Le
 *           CSS .seance-circuit__* est livré à part dans seance.html.
 *           Additif pur, node --check OK.
 *   v1.19 : Bug recette terrain (Manu, PC admin, M6 sélectionné) : la pioche
 *           encadrants méta ET la pioche coachs des blocs proposaient les 8
 *           encadrants M14, quelle que soit la catégorie choisie. Cause racine
 *           (sondée, DS-1) : depuis la bascule de saison (2026/2027 active), les
 *           ententes sont restées rattachées à 2025/2026 (inactive) →
 *           listEquipes(cat) renvoie [] pour TOUTE catégorie → l'écran retombait
 *           sur le repli en dur M14_TEAM_UUID (dans _seanceChoisirEquipeActive
 *           ET _equipeActive) → getCategorieEquipe résolvait la catégorie M14 →
 *           list_staff_disponibles(M14) = les 8 encadrants M14. Ce n'était donc
 *           NI un bug de getCategorieEquipe NI un trou de fonction_staff, mais le
 *           repli M14 silencieux qui masquait l'absence d'équipe active.
 *           Correctif (3 gestes solidaires, périmètre seance-editor.js seul) :
 *             (1) _equipeActive() → renvoie null (plus de repli M14).
 *             (2) _seanceChoisirEquipeActive() → liste vide pose equipeActive=null.
 *             (3) loadStaffDisponibles() → GARDE d'entrée : eqActive null →
 *                 State.staffDisponible=[] SANS appeler list_staff_disponibles(null)
 *                 (qui aurait renvoyé TOUT le staff du club, ~63 personnes).
 *           Résultat : pioche VIDE en intersaison (état honnête), le champ libre
 *           du menu encadrants reste pour un intervenant hors staff. Cas nominal
 *           (saison avec ententes) INCHANGÉ : listEquipes renvoie des équipes →
 *           choix 1re/mémorisée → comportement identique. Constante M14_TEAM_UUID
 *           conservée inerte (relique, plus référencée — retrait = geste séparé).
 *           Dette tracée : compositions.html/joueurs/pilotage ont probablement le
 *           même repli M14 (à auditer). Chantier distinct : reconduction des
 *           ententes à la bascule (l'outil bascule surclasse les joueurs mais ne
 *           reconduit pas les ententes → cause amont de cet état intersaison).
 *           node --check OK. boot v1.18.1 → v1.19.
 *   v1.19b : Effet de bord du fix v1.19 corrigé (recette Manu, immédiate) :
 *           _equipeActive() renvoyant null, onNouvelleSeance() envoyait
 *           equipe_id=null à createSeance → « Erreur création séance :
 *           equipe_id requis ». Garde ajoutée en tête de onNouvelleSeance :
 *           sans équipe active, message métier clair (intersaison, équipes
 *           non rattachées à la saison active) et AUCUN appel RPC. Les 4
 *           autres consommateurs de _equipeActive() (listSeancesByEquipe,
 *           listBrouillonsVides, getEvenementsAVenir, getVivierCompo)
 *           tolèrent déjà null (warning + []) → chargement intersaison OK.
 * Version : 1.18.1 — FIX hotfix : enterSelectionMode happé par un /** orphelin (juin 2026)
 *   v1.18.1 : Le bloc d'insertion v1.18 avait laissé un commentaire /**
 *             non fermé juste avant function enterSelectionMode(), qui
 *             happait sa définition → ReferenceError au boot (renderSidebar
 *             appelle enterSelectionMode). JSDoc restauré, fonction rendue
 *             à nouveau définie. Aucun autre changement. node --check OK.
 * Version : 1.18 — SEANCE-SOFT-DELETE : durcissement du brouillon (juin 2026)
 *   v1.18 : Incident pt 107 (RUGBY PP+SKILLS perdue) : un brouillon offrait
 *           DEUX boutons côte à côte — « 🗑 Supprimer » (DELETE physique
 *           irréversible) et « 📦 Archiver » (récupérable). Le confirm()
 *           n'a pas suffi. Durcissement (décision Manu, scénario b) :
 *           (1) Le bouton « 🗑 Supprimer » du brouillon DISPARAÎT du
 *               formulaire méta (déplié ET replié). Plus aucun DELETE
 *               physique à un clic dans l'éditeur. Il ne reste que
 *               « 📦 Archiver » → tout passe par la corbeille (récupérable).
 *           (2) Le mode sélection en sidebar agit selon le toggle archivées :
 *               - vue normale (archivées masquées) → coche les BROUILLONS,
 *                 bouton « 📦 Archiver N » (archiveSeancesEnLot v1.66) ;
 *               - vue archivées (toggle ON) → coche les ARCHIVÉES, bouton
 *                 « 🗑 Supprimer N définitivement » (purge bornée v1.66).
 *           (3) Purge définitive AUSSI par-ligne : sur chaque ligne archivée
 *               (toggle ON), un bouton 🗑 → purgerSeanceArchivee v1.66, borné
 *               serveur .eq('etat','archivee') : impossible de purger sans
 *               passer d'abord par l'archivage.
 *           onDeleteSeance / onDeleteSeancesEnLot CONSERVÉS dans le module
 *           (filet) mais PLUS câblés (chemins morts assumés, tracés).
 *           node --check OK. boot v1.17 → v1.18.
 * Version : 1.17 — FIX staff non rechargé au changement de catégorie (juin 2026)
 *   v1.17 : Bug recette (Manu) : après changement de catégorie via le
 *           sélecteur (ex. M14 → M10), les pioches coachs (blocs ET méta)
 *           proposaient toujours les coachs M14. Cause : _seanceRechargerDonnees()
 *           rechargeait séances/évènements/vivier mais PAS le staff, donc
 *           State.staffDisponible restait figé sur la catégorie initiale.
 *           Corrigé : loadStaffDisponibles() ajouté au Promise.all de
 *           rechargement (equipeActive déjà mis à jour en amont par
 *           _seanceChoisirEquipeActive, donc la bonne catégorie est résolue).
 *           Explique pourquoi Lohann (sans changement de cat) voyait juste.
 *           node --check OK. boot v1.16 → v1.17.
 * Version : 1.16 — FIX pioche encadrants méta (recette Lohann, juin 2026)
 *   v1.16 : La pioche « encadrants » de la méta séance proposait les coachs
 *           M14 pour TOUTES les catégories. Cause : ses propositions venaient
 *           de State.encadrantsRef (miroir data/encadrants-par-categorie.json
 *           figé, ne contenant que la clé cat-m14). Corrigé : propositions
 *           depuis State.staffDisponible (vrai staff de la catégorie, même
 *           source que la pioche coachs des blocs, résolue via getCategorieEquipe).
 *           Le champ libre du menu reste pour un intervenant hors staff.
 *           Stockage encadrants_text inchangé. node --check OK. boot v1.15 → v1.16.
 * Version : 1.15 — PDF : nom de fichier daté + logo + Joueurs aéré (juin 2026)
 *   v1.15 : Finitions PDF (recette). (1) Nom de fichier distinct par export,
 *           préfixé date AAAA-MM-JJ : « <date> - MOM Hub · Séance <CAT>
 *           coachs|joueurs » (pilotage document.title dans _imprimerVue,
 *           restauré après afterprint). Helpers _dateFichierSeance /
 *           _libelleCategorieCourt. (2) Logo MOM + bandeau vert charte en
 *           en-tête des deux PDF. (3) Tableau Joueurs aéré (colgroup largeurs,
 *           police 12pt, padding 10pt). Styles dans seance.html.
 *           node --check OK. boot v1.14 → v1.15.
 * Version : 1.14 — DEUX EXPORTS PDF (Coach / Joueurs) (juin 2026)
 *   v1.14 : Suite débrief Lohann. Deux exports PDF distincts (2 boutons) :
 *           - PDF Coach (onExportPdfCoach, async) : format complet par bloc
 *             + section ATELIERS rattachés (titre via lookupFiche + lien
 *             Drive cliquable via urlDriveDossier). Charge les ateliers de
 *             TOUS les blocs (_chargerAteliersTousBlocs) avant rendu.
 *           - PDF Joueurs (onExportPdfJoueurs) : tableau compact 5 colonnes
 *             (horaire, bloc, durée, intensité, coachs). Sans axe4/notes/ateliers.
 *           _buildPrintHtml(mode, ateliersParBloc) factorise les deux ;
 *           _imprimerVue commun. Styles print associés dans seance.html.
 *           node --check OK. boot v1.13 → v1.14.
 * Version : 1.13 — MULTI-COACHS par bloc (recette terrain, juin 2026)
 *   v1.13 : Un bloc peut être encadré par PLUSIEURS coachs (liste plate
 *           égalitaire, sql_110 encadrants_ids uuid[]). Le <select> coach
 *           unique devient une PIOCHE À CASES À COCHER (buildCheckboxesCoachs,
 *           data-coach-id). Collecte custom : cases cochées agrégées en
 *           patch.encadrants_ids au save (hors collecte générique
 *           data-bloc-field). Dirty tracking sur les cases. Lecture multi :
 *           _nomsCoachsBloc (pluriel) pour la trame ET le PDF (un tag par
 *           coach), avec repli sur encadrant_id déprécié si encadrants_ids
 *           vide. buildSelectCoach / _nomCoachBloc conservés (rétro-compat).
 *           node --check OK. boot v1.12 → v1.13.
 * Version : 1.12 — PDF enrichi (recette terrain, juin 2026)
 *   v1.12 : Export PDF enrichi par bloc (demande recette). _buildPrintHtml
 *           passe d'un tableau 4 colonnes à un format « fiche par étage » :
 *           pour chaque bloc (voie comprise) : titre/précision, intensité,
 *           coach encadrant, étiquettes (axes 2/3), résumé du contenu
 *           pédagogique (axe 4 FFR) et notes. Helpers _libelleSlugAxe /
 *           _libelleIntensite / _resumeAxe4 (traduction slug -> libellé via
 *           le vocabulaire chargé). Styles print associés dans seance.html.
 * Version : 1.11 — FIX recette terrain (juin 2026)
 *   v1.11 : Corrections post-recette du module Préparation de séance.
 *           (a) Pioche coach vide : loadStaffDisponibles envoyait la
 *               chaîne factice 'cat-m14' à la RPC au lieu d'un vrai
 *               categorie_id (uuid). Résolution désormais via
 *               getCategorieEquipe(_equipeActive()) -> ententes.categorie_id ;
 *               repli sur null (tout le staff) si échec. Va de pair avec
 *               sql_109 (garde RPC élargie admin|bureau|encadrant) et
 *               supabase-client v1.64 (ordre modifiable dans updateBloc).
 *           (Le réordonnancement d'étages — bug « Aucun champ modifiable »
 *            — est corrigé côté wrapper v1.64, pas ici.)
 * Version : 1.10 — SEANCE-BLOCS-PARALLELES (juin 2026, retours terrain)
 *   v1.10 : Trois améliorations « terrain » au module Préparation de séance,
 *           adossées à la migration sql_108 (voie + encadrant_id sur
 *           seances_blocs) et au wrapper supabase-client v1.63.
 *
 *           (1) BLOCS PARALLÈLES (voies). renderTrame regroupe désormais
 *               les blocs par ÉTAGE (= même `ordre`). Un étage à 1 bloc =
 *               ligne pleine largeur (inchangé) ; un étage à ≥2 blocs =
 *               voies côte à côte. Durée de l'étage = MAX des voies (les
 *               blocs tournent en simultané) ; le cumul horaire avance du
 *               max. Helpers _grouperBlocsParEtage / _nomCoachBloc.
 *               Bouton ⇄ « dédoubler » par étage (ajoute une voie via le
 *               picker, voie = max+1, ordre identique). Création directe en
 *               voie aussi possible (State.dedoublerOrdre consommé par
 *               onAddBloc). Les actions ↑/↓ opèrent sur l'ÉTAGE entier
 *               (onMoveEtageUp/Down -> _swapEtages, qui échange les `ordre`
 *               via updateBloc en préservant `voie` — PAS reorderBlocs, qui
 *               réaffecte 1..N à plat et casserait le parallélisme).
 *
 *           (2) COACH PAR BLOC. <select> « Coach encadrant (ce bloc) » dans
 *               renderBlocDetail, data-bloc-field="encadrant_id" (collecte
 *               générique existante -> updateBloc ; option vide => null).
 *               Source : State.staffDisponible via loadStaffDisponibles()
 *               (RPC list_staff_disponibles, UUID réels personnes.id). Le
 *               miroir encadrants-par-categorie.json a des uuid factices,
 *               inutilisables pour la FK : source distincte assumée.
 *               buildSelectCoach gère l'affectation orpheline (coach retiré
 *               du staff mais encore en base) sans la masquer.
 *
 *           (3) EXPORT PDF. Bouton « 🖨 Exporter PDF » dans le header de la
 *               trame. onExportPdf injecte une vue simplifiée (_buildPrintHtml)
 *               dans #seance-print-root puis window.print(). Mise en page
 *               portée par une feuille @media print à la charte (livrée à
 *               part). Aucune dépendance externe.
 *
 *           DÉTAIL : le 🗑 de suppression a quitté la trame (place au ⇄) et
 *           rejoint le détail du bloc (#seance-bloc-btn-supprimer), de sorte
 *           que chaque bloc — voie comprise — reste supprimable. Fonctions
 *           onMoveBlocUp/Down/onRemoveBloc conservées (additif). node --check OK.
 *           console.log boot v1.5 -> v1.10.
 * Version : 1.9 — Phase 5.12 (15 mai 2026)
 *   v1.0 : squelette IIFE, sidebar liste séances, bouton "+ Nouvelle séance",
 *          formulaire 6 champs méta (date, heure, durée, effectif, thème,
 *          axe de travail), sauvegarde manuelle via updateSeance(), feedback
 *          success/error. Sans autosave (Phase 5.5.B), sans lieu_id ni
 *          evenement_id (différés Phase 5.5.B après vérif schéma sites).
 *   v1.1 : Phase 5.5.B1 — ajout des 5 champs secondaires (meteo_text,
 *          encadrants_text, objectifs_text, bloc_cycle, materiel_global_text)
 *          + 2 dropdowns (lieu_id via listSitesActifs, evenement_id via
 *          getEvenementsAVenir). Toujours sauvegarde manuelle (autosave 30s
 *          et clic sidebar différés en Phase 5.5.B2).
 *   v1.2 : Phase 5.5.B2 — (1) autosave 30s : timer relancé à chaque ouverture
 *          de formulaire, vérifie State.isDirty à chaque tick et sauve
 *          silencieusement si dirty. Pastille .seance-autosave-pill dans
 *          le header du form avec 3 états (idle/saving/error).
 *          (2) clic sur item sidebar : recharge le formulaire avec la séance
 *          cliquée. confirm() natif si modif non sauvée.
 *          Refactor : extraction de la logique de save dans saveSeance(opts)
 *          partagée par onSaveSeance (manuel) et autosave (silencieux).
 *   v1.3 : Phase 5.6.A — trame chronologique (palier 1/2).
 *          Chargement des blocs via listBlocsBySeance(seanceId) (wrapper
 *          v1.8.2). Rendu d'une table 4 colonnes (Horaire | Bloc | Durée |
 *          Actions) sous le formulaire méta, triée par ordre. Calcul auto
 *          des horaires à partir de seance.heure_debut + cumul duree_min.
 *          Bouton "+ Ajouter un bloc" ouvre un popover de choix parmi les
 *          11 types (fetched data/types-blocs.json). Création via
 *          addBlocToSeance() avec duree_min + intensite par défaut du type.
 *          Boutons d'actions ↑↓🗑 différés au palier 5.6.B.
 *   v1.4 : Phase 5.6.B — trame chronologique (palier 2/2) + ergonomie.
 *          (1) Actions par bloc : boutons ↑ (move-up), ↓ (move-down),
 *          🗑 (remove). Move-up/down via reorderBlocs(seanceId, [ids dans
 *          nouvel ordre]). Suppression via removeBloc(blocId) avec
 *          confirm(). ↑ désactivé sur le 1er bloc, ↓ sur le dernier.
 *          (2) Repli du formulaire méta en résumé compact après save
 *          (arbitrage Manu 15 mai d'après screenshot Phase 5.6.A) : une
 *          fois la séance enregistrée, le form se replie en 1 ligne
 *          (📅 date · heure · durée · effectif · état) avec bouton
 *          "✏️ Modifier" pour redéployer. État stocké dans
 *          State.formCollapsed (default true si séance chargée avec
 *          date_seance non null, sinon false pour rester ouvert sur
 *          nouvelles séances vides). Donne toute la place à la trame.
 *   v1.4.1 : Fix UX post-déploiement v1.4 — le bouton "✏️ Modifier"
 *          ouvrait le formulaire mais on ne pouvait le refermer qu'en
 *          modifiant un champ + cliquant Enregistrer. Désormais, un
 *          bouton "↑ Replier" est ajouté en haut à droite du formulaire
 *          déplié (à côté de la pastille autosave + badge état) et
 *          permet de revenir au résumé compact sans modification.
 *          Si modifs en cours, confirm() avant repli.
 *   v1.5 : Phase 5.7 — détail d'un bloc.
 *          Clic sur une ligne de la trame ouvre l'éditeur complet du bloc
 *          (remplace la trame, bouton "← Retour à la trame" pour revenir).
 *          Champs édités :
 *          - Type de bloc (changeable), durée, titre précision, intensité
 *            (affichée conditionnellement selon le type)
 *          - 2 étiquettes Axe 2 (types d'unités) / Axe 3 (composants
 *            échauffement), affichées selon types-blocs.json.etiquettes_proposees
 *          - 10 champs FFR Axe 4 (objectif, but, consigne, cr, critère
 *            réalisation, comportements, variables, régulations, dispositif,
 *            transitions) stockés en jsonb contenu_pedagogique_axe4
 *          - Comportements attendus, organisation spatio-temporelle,
 *            notes bloc (3 textarea libres)
 *          Sauvegarde via updateBloc() + autosave 30s + pastille statut
 *          (pattern identique au form séance, refactor minimal).
 *          Charge vocabulaire-seance.json (4 axes) en plus de
 *          types-blocs.json à l'init.
 *   v1.6 : Phase 5.8 — picker ateliers Bibliothèque.
 *          Section "Ateliers rattachés" ajoutée en bas de la vue détail
 *          d'un bloc. Liste les fiches déjà rattachées (lecture via
 *          listAteliersRattachesAuBloc, wrapper v1.8.3), avec enrichissement
 *          local depuis data/fiches-all.json (62 fiches) : titre, thème,
 *          niveau, durée, lien Drive. Bouton 🗑 par rattachement →
 *          detachAtelierFromBloc(rattachementId).
 *          Bouton "+ Rattacher un atelier" ouvre une modale picker avec :
 *          champ recherche texte (filtre nom_fiche + titre + thème +
 *          niveau, insensible aux accents), liste filtrée des 62 fiches,
 *          clic sur une fiche → attachAtelierToBloc(blocId, fileIdDrive)
 *          puis reload + render. Modale fermable par overlay, Échap ou
 *          croix.
 *          Charge data/fiches-all.json (~140 KB, 62 fiches) à l'init en
 *          parallèle des autres référentiels. Cache navigateur activé
 *          (force-cache) car miroir Drive régénéré manuellement par
 *          le converter Python (pas en temps réel).
 *   v1.7 : Phase 5.9 — groupes G1/G2/G3 par bloc.
 *          Section "Groupes" ajoutée en bas de la vue détail bloc, après
 *          la section "Ateliers rattachés". 3 groupes fixes alimentés par
 *          data/groupes-joueur.json (Performance / Développement /
 *          Initiation, couleurs respectives bordeaux / orange / bleu).
 *          Joueurs sélectionnables depuis le vivier catégorie via RPC
 *          get_vivier_compo (wrapper getVivierCompo v1.6, 62 joueurs).
 *          UX : 3 popovers indépendants (un par groupe, calque sur
 *          pattern Compositions v3.4). Un joueur déjà placé dans un
 *          autre groupe est grisé + clic interdit (unicité par bloc).
 *          Héritage automatique à la création de bloc : les groupes du
 *          bloc immédiatement précédent sont copiés (commodité,
 *          arbitrage Manu 15 mai après brief Phase 5.9). Bloc sans
 *          prédécesseur ou trame vide → groupes vides à la création.
 *          Stockage : champ jsonb groupes_jsonb sur seances_blocs
 *          (existant Phase 5.1). Format :
 *          [{nom:"G1", joueurs:[uuid,...]}, ...]
 *          Pas de nouveau wrapper Supabase : updateBloc accepte déjà
 *          groupes_jsonb dans sa whitelist (v1.8.3).
 *   v1.8 : Phase 5.10 — sidebar enrichie + nettoyage brouillons.
 *          (1) Toggle "Afficher les archivées" dans le header de la
 *          sidebar. Quand activé, recharge la liste avec l'option
 *          excludeArchivees:false du wrapper listSeancesByEquipe.
 *          État persisté dans State.showArchivees (volatile, reset au
 *          rechargement de page — pas de localStorage par doctrine).
 *          (2) Bouton "📦 Archiver" dans le formulaire méta (déplié
 *          ET résumé replié). Confirm() avant action, puis recharge
 *          la liste et revient à l'écran vide.
 *          (3) Section "Brouillons vides" en bas de sidebar : affiche
 *          le compteur (X brouillons vides) + bouton "🧹 Nettoyer"
 *          quand au moins 1 brouillon vide existe. Confirm() avec
 *          détail du nombre, puis DELETE en lot via le wrapper
 *          deleteBrouillonsVides. Compteur rafraîchi à chaque init.
 *          Résout la dette D-SEANCE-STUB-VIDES héritée de Phase 5.5.
 *   v1.9 : Phase 5.12 — Ajustements V1 post-tests utilisateur.
 *          (1) Boutons "✓ Valider" et "↩ Brouillon" dans le formulaire
 *          méta (déplié ET résumé replié). Bouton Valider visible si
 *          etat='brouillon', bouton Brouillon visible si 'validee' ou
 *          'utilisee'. Garde-fou : refuse de valider sans date_seance.
 *          Wrapper existant updateSeance({etat: ...}) utilisé.
 *          (2) Libellés "Performance/Développement/Initiation" retirés
 *          des cartes Groupes et du popover joueurs. Seule la couleur
 *          du groupe + le nom court (G1/G2/G3) reste affiché. La
 *          couleur suffit à distinguer, et ça évite de prescrire un
 *          mapping rigide groupe ↔ niveau_profil.
 *          (3) Fix bug scroll popover groupes : à chaque clic sur un
 *          joueur, le re-render réinitialisait scrollTop à 0. Désormais
 *          le scrollTop de .seance-picker-groupe__list-wrap est sauvé
 *          avant le re-render et restauré après. Idem pattern pour le
 *          focus du champ recherche (déjà existant).
 *          (4) Refonte UX généralisée des champs texte : datalist HTML5
 *          avec propositions pré-saisies sur 16 champs (4 méta + 2
 *          détail bloc + 10 FFR Axe 4), picker à tags pour le matériel
 *          global de séance. Le coach peut toujours taper du texte libre
 *          (datalist = autocomplete non-bloquante). Entrée "Autres..."
 *          en fin de liste comme repère visuel. Chargement à l'init
 *          via fetch('data/propositions-seance.json').
 *          Champs préservés en texte libre par doctrine : objectifs,
 *          titre_precision, encadrants, notes_bloc, notes_atelier.
 *
 *          AJUSTEMENTS v1.9 BIS (15 mai 2026 fin d'après-midi, post retour usage) :
 *          (1) Fix bug "Aucun champ modifiable dans ce patch" via 2
 *          nouveaux wrappers validerSeance/repasserSeanceBrouillon
 *          (supabase-client v1.8.5).
 *          (2) Fix bug "compteur brouillons vides invisible jusqu'au
 *          coche du toggle archivées" : onNouvelleSeance appelle
 *          maintenant loadBrouillonsVides() avant renderSidebar().
 *          (3) Suppression libre de séances (brouillons uniquement) :
 *          - Bouton "🗑 Supprimer" dans le formulaire méta (déplié ET
 *            résumé replié), visible UNIQUEMENT si etat='brouillon'.
 *            Confirm() puis deleteSeance() wrapper v1.8.6, retour
 *            écran vide + refresh sidebar.
 *          - Mode "Sélectionner" en sidebar : bouton "✓ Sélectionner"
 *            en header sidebar bascule en mode multi-sélection. Cases
 *            à cocher apparaissent sur les BROUILLONS uniquement (les
 *            validées/utilisées/archivées sont protégées, doctrine
 *            "conserver l'historique"). Bouton "🗑 Supprimer N
 *            séance(s)" en bas de sidebar quand au moins 1 cochée.
 *            Bouton "✕ Annuler" pour sortir du mode sélection.
 *
 * Dépendances :
 *   - window.SupabaseHub v1.8.6 (wrappers Phase 5.3 + listSitesActifs +
 *     listBlocsBySeance + updateBloc + listAteliersRattachesAuBloc +
 *     getVivierCompo + listBrouillonsVides + deleteBrouillonsVides +
 *     validerSeance + repasserSeanceBrouillon + deleteSeance +
 *     deleteSeancesEnLot)
 *   - data/types-blocs.json v1.1 (fetched à l'init)
 *   - data/vocabulaire-seance.json v1.1 (fetched à l'init, Phase 5.7)
 *   - data/fiches-all.json (fetched à l'init, Phase 5.8)
 *   - data/groupes-joueur.json (fetched à l'init, Phase 5.9, 3 groupes)
 *   - data/propositions-seance.json (fetched à l'init, Phase 5.12,
 *     ~190 propositions sur 16 champs + 20 matériels)
 *   - DOM : #seance-sidebar-body, #btn-nouvelle-seance, #seance-editor-area,
 *     #btn-nouvelle-seance-cta (placeholder existants de seance.html v1)
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CONSTANTES + ÉTAT
  // ============================================================

  const NB_SEANCES_RECENTES = 10;
  const DUREE_DEFAULT_MIN = 75;
  const AUTOSAVE_INTERVAL_MS = 30000; // 30 secondes (Phase 5.5.B2)

  // Clé localStorage de l'équipe de séance active (distincte de la
  // catégorie active, gérée par le socle). Mémorise le choix d'équipe
  // quand la catégorie active a > 1 équipe (point dur 1, option b).
  const CLE_EQUIPE_SEANCE = 'mom_hub.seance.equipe_active';

  const State = {
    seances: [],            // liste pour la sidebar
    currentSeance: null,    // séance en cours d'édition (objet complet)
    isDirty: false,         // true si modif non sauvée
    sites: [],              // cache pour dropdown lieu_id (5.5.B1)
    evenements: [],         // cache pour dropdown evenement_id (5.5.B1)
    autosaveTimer: null,    // handle setInterval (5.5.B2)
    autosaveStatus: 'idle', // 'idle' | 'saving' | 'error' (5.5.B2)
    blocs: [],              // blocs de la séance courante, triés par ordre (5.6.A)
    circuits: [],           // fiches de marche circuit (seances_etages_circuits, sql_241) — 1 par étage rotatif
    staffDisponible: [],    // [{personne_id,nom,prenom}] coachs assignables par bloc (v1.10, sql_108)
    dedoublerOrdre: null,   // étage cible quand on ajoute une voie parallèle (v1.10)
    typesBlocsRef: null,    // référentiel des 11 types (data/types-blocs.json, 5.6.A)
    picker: null,           // état du popover "+ Ajouter un bloc" ({open: bool}, 5.6.A)
    formCollapsed: false,   // true : form méta replié en résumé compact (5.6.B)
    vocabulaireRef: null,   // référentiel des 4 axes (data/vocabulaire-seance.json, 5.7)
    currentBloc: null,      // bloc en cours d'édition (vue détail, 5.7)
    blocIsDirty: false,     // modifs non sauvées sur le bloc en édition (5.7)
    blocAutosaveTimer: null, // handle setInterval pour autosave du bloc (5.7)
    blocAutosaveStatus: 'idle', // 'idle' | 'saving' | 'error' (5.7)
    view: 'trame',          // 'trame' | 'bloc-detail' : vue active de la zone éditeur (5.7)
    // Phase 5.8 : picker ateliers Bibliothèque
    fichesRef: null,        // miroir data/fiches-all.json ({fileId_dossier: {...}})
    ateliersRattaches: [],  // rattachements du bloc courant (cache, rechargé à chaque ouverture)
    fichePicker: null,      // état modale picker ({open: bool, query: string})
    // Phase 5.9 : groupes G1/G2/G3 par bloc
    groupesRef: null,       // miroir data/groupes-joueur.json ({_meta, groupes:[...]})
    vivier: [],             // vivier de la catégorie active via getVivierCompoCategorie
    vivierById: null,       // Map (joueur_id → joueur) pour lookup rapide
    groupePicker: null,     // état popover groupe ({open: bool, nomGroupe: <nom libre>, query: string})
    // Phase 5.10 : sidebar enrichie + nettoyage brouillons
    showArchivees: false,        // toggle "Afficher les archivées" dans sidebar header
    brouillonsVides: [],         // liste des brouillons vides éligibles à suppression (cache)
    // Phase 5.12 : propositions pour datalist + matériel
    propositionsRef: null,        // miroir data/propositions-seance.json
    // Phase 5.12 BIS : mode sélection multiple pour suppression en lot
    selectionMode: false,         // bascule mode "Sélectionner" en sidebar
    selectionIds: new Set(),      // UUIDs des séances cochées dans la sidebar
    // Propagation multi-catégories (catégorie active partagée)
    perimetreCat: null,           // {categories, transverse, active, vide} | null
    equipesCategorieActive: [],   // équipes de la catégorie active (objets)
    equipeActive: null            // UUID de l'équipe de séance courante (repli M14)
  };

  // ------------------------------------------------------------
  // Propagation multi-catégories — résolution équipe active
  // ------------------------------------------------------------
  // L'écran Séance travaille à UNE équipe à la fois (créer/lister
  // séances, vivier, évènements d'une équipe). Point dur 1, option
  // (b) : la catégorie active vient du socle (clé partagée) ; si elle
  // a > 1 équipe, un 2e sélecteur d'équipe apparaît ; mono-équipe
  // (cas réel actuel M14) → résolution directe, aucun sélecteur.

  /**
   * UUID de l'équipe de séance courante, ou null si aucune équipe active
   * n'est résolue (intersaison : ententes non rattachées à la saison active
   * → listEquipes renvoie [] → aucune équipe légitime). v1.19 : plus de
   * repli M14_TEAM_UUID (trompeur — affichait le staff M14 sous une autre
   * catégorie). null = état honnête « pas d'équipe » ; les consommateurs
   * (loadStaffDisponibles) gèrent ce null explicitement.
   */
  function _equipeActive() {
    return State.equipeActive || null;
  }

  /**
   * Catégorie active du périmètre (chantier SEANCE-RATTACHEMENT-CATEGORIE).
   * Rattachement principal des séances depuis le pt 180. null si périmètre
   * non résolu (intersaison / droits non chargés).
   */
  function _catActive() {
    return (State.perimetreCat && State.perimetreCat.active) || null;
  }

  /** Équipes de la catégorie active → objets [{id,…}]. [] si indispo. */
  async function _seanceResoudreEquipesCategorieActive() {
    if (typeof SupabaseHub === 'undefined'
        || typeof SupabaseHub.listEquipes !== 'function') {
      return [];
    }
    const catId = State.perimetreCat && State.perimetreCat.active;
    if (!catId) return [];
    try {
      const eqs = await SupabaseHub.listEquipes(catId);
      return Array.isArray(eqs) ? eqs : [];
    } catch (e) {
      console.warn('SeanceEditor: listEquipes indisponible.', e);
      return [];
    }
  }

  /**
   * Choisit l'équipe active dans la liste des équipes de la catégorie
   * active : équipe mémorisée si elle est dans la liste, sinon la 1re ;
   * null si la liste est vide (v1.19). Pose State.equipeActive.
   */
  function _seanceChoisirEquipeActive() {
    const liste = State.equipesCategorieActive || [];
    if (liste.length === 0) {
      // v1.19 : aucune équipe active pour cette catégorie (intersaison :
      // ententes non rattachées à la saison active). On pose null au lieu
      // de retomber sur M14_TEAM_UUID — ce repli affichait le staff M14
      // sous n'importe quelle catégorie (bug recette Manu, M6). null =
      // état honnête : loadStaffDisponibles rendra une pioche vide.
      State.equipeActive = null;
      return;
    }
    let memorisee = null;
    try { memorisee = localStorage.getItem(CLE_EQUIPE_SEANCE) || null; } catch (e) { /* honnête */ }
    const ok = memorisee && liste.some(function (eq) { return eq && eq.id === memorisee; });
    State.equipeActive = ok ? memorisee : liste[0].id;
  }

  function _memoriserEquipeSeance(equipeId) {
    if (!equipeId) return;
    try { localStorage.setItem(CLE_EQUIPE_SEANCE, String(equipeId)); } catch (e) { /* honnête */ }
  }

  /**
   * Monte un sélecteur d'ÉQUIPE dans le header SI la catégorie active
   * a > 1 équipe. Mono-équipe → rien (UX inchangée). Au changement :
   * mémorise + recharge les données de l'écran.
   */
  function _monterSelecteurEquipe() {
    // Chantier SEANCE-RATTACHEMENT-CATEGORIE — le sélecteur d'ÉQUIPE est
    // retiré : les séances se rattachent à la CATÉGORIE, plus à l'équipe.
    // Fonction neutralisée par early-return (l'ancien corps historique de
    // montage du sélecteur, jamais atteint, a été retiré au chantier
    // HYGIENE-CODE-MORT). Conservée pour préserver ses appelants inchangés.
    return;
  }

  /** Retire le sélecteur d'équipe (avant remontage après changement de catégorie). */
  function _retirerSelecteurEquipe() {
    const w = document.getElementById('seance-equipe-selecteur-wrap');
    if (w && w.parentNode) w.parentNode.removeChild(w);
  }

  /**
   * Recharge les données dépendantes de l'équipe active + re-render.
   * Appelé au changement d'équipe ou de catégorie.
   */
  async function _seanceRechargerDonnees() {
    await Promise.all([
      loadSeances(),
      loadEvenements(),
      loadVivier(),
      // v1.17 — recharger le staff de la NOUVELLE catégorie (sinon la pioche
      // coachs des blocs ET la pioche encadrants méta restent figées sur la
      // catégorie initiale — bug : coachs M14 proposés après passage en M10).
      loadStaffDisponibles()
    ]);
    renderSidebar();
    renderEmptyEditor();
  }

  /**
   * Au changement de CATÉGORIE active : re-résout les équipes,
   * re-choisit l'équipe active, remonte le sélecteur d'équipe, recharge.
   */
  async function _seanceOnChangementCategorie() {
    State.equipesCategorieActive = await _seanceResoudreEquipesCategorieActive();
    _seanceChoisirEquipeActive();
    _retirerSelecteurEquipe();
    _monterSelecteurEquipe();
    await _seanceRechargerDonnees();
  }

  // ============================================================
  // 2. SÉLECTEURS DOM
  // ============================================================

  const DOM = {
    sidebarBody:   () => document.getElementById('seance-sidebar-body'),
    sidebarCta:    () => document.getElementById('btn-nouvelle-seance'),
    editorArea:    () => document.getElementById('seance-editor-area'),
    ctaCenter:     () => document.getElementById('btn-nouvelle-seance-cta'),
    // Champs du formulaire (n'existent que si renderForm() a été appelé)
    inputDate:        () => document.getElementById('seance-input-date'),
    inputHeure:       () => document.getElementById('seance-input-heure'),
    inputDuree:       () => document.getElementById('seance-input-duree'),
    inputEffectif:    () => document.getElementById('seance-input-effectif'),
    inputTheme:       () => document.getElementById('seance-input-theme'),
    inputAxe:         () => document.getElementById('seance-input-axe'),
    // Phase 5.5.B1 : 2 dropdowns + 5 champs secondaires
    selectLieu:       () => document.getElementById('seance-select-lieu'),
    selectEvenement:  () => document.getElementById('seance-select-evenement'),
    inputMeteo:       () => document.getElementById('seance-input-meteo'),
    inputEncadrants:  () => document.getElementById('seance-input-encadrants'),
    inputObjectifs:   () => document.getElementById('seance-input-objectifs'),
    inputCycle:       () => document.getElementById('seance-input-cycle'),
    inputMateriel:    () => document.getElementById('seance-input-materiel'),
    btnSave:       () => document.getElementById('seance-btn-save'),
    feedback:      () => document.getElementById('seance-feedback'),
    autosavePill:  () => document.getElementById('seance-autosave-pill'),
    // Phase 5.6.A : trame chronologique
    trameSection: () => document.getElementById('seance-trame-section'),
    trameBody:    () => document.getElementById('seance-trame-body'),
    btnAddBloc:   () => document.getElementById('seance-btn-add-bloc'),
    pickerRoot:   () => document.getElementById('seance-picker-root'),
    // Phase 5.7 : détail bloc
    blocDetailSection: () => document.getElementById('seance-bloc-detail'),
    blocAutosavePill:  () => document.getElementById('seance-bloc-autosave-pill'),
    blocBtnRetour:     () => document.getElementById('seance-bloc-btn-retour'),
    blocBtnSave:       () => document.getElementById('seance-bloc-btn-save'),
    blocInputs: () => document.querySelectorAll('[data-bloc-field]'), // tous les champs édités
    // Phase 5.8 : picker ateliers
    ateliersSection: () => document.getElementById('seance-ateliers-section'),
    ateliersList:    () => document.getElementById('seance-ateliers-list'),
    btnAddAtelier:   () => document.getElementById('seance-btn-add-atelier'),
    pickerFicheRoot: () => document.getElementById('seance-picker-fiche-root'),
    // Phase 5.9 : groupes G1/G2/G3
    groupesSection:   () => document.getElementById('seance-groupes-section'),
    pickerGroupeRoot: () => document.getElementById('seance-picker-groupe-root'),
    // Phase 5.10 : sidebar enrichie
    toggleArchivees:    () => document.getElementById('seance-toggle-archivees'),
    sidebarCleanup:     () => document.getElementById('seance-sidebar-cleanup'),
    btnCleanup:         () => document.getElementById('seance-btn-cleanup'),
    btnArchiveExpanded: () => document.getElementById('seance-btn-archive-expanded'),
    btnArchiveCollapsed:() => document.getElementById('seance-btn-archive-collapsed'),
    // Phase 5.12 : boutons Valider / Repasser-brouillon
    btnValiderExpanded:    () => document.getElementById('seance-btn-valider-expanded'),
    btnValiderCollapsed:   () => document.getElementById('seance-btn-valider-collapsed'),
    btnBrouillonExpanded:  () => document.getElementById('seance-btn-brouillon-expanded'),
    btnBrouillonCollapsed: () => document.getElementById('seance-btn-brouillon-collapsed'),
    // Phase 5.12 BIS : suppression libre + mode sélection
    btnDeleteExpanded:    () => document.getElementById('seance-btn-delete-expanded'),
    btnDeleteCollapsed:   () => document.getElementById('seance-btn-delete-collapsed'),
    btnSidebarSelect:     () => document.getElementById('seance-btn-sidebar-select'),
    btnSidebarSelectExit: () => document.getElementById('seance-btn-sidebar-select-exit'),
    btnSidebarDelete:     () => document.getElementById('seance-btn-sidebar-delete'),
    // Phase 5.13 : actions en lot contextuelles (archivage vs purge)
    btnSidebarArchive:    () => document.getElementById('seance-btn-sidebar-archive'),
    btnSidebarPurge:      () => document.getElementById('seance-btn-sidebar-purge')
  };

  // ============================================================
  // 3. HELPERS
  // ============================================================

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const jours = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
    const mois  = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()];
  }

  function libelleEtatSeance(etat) {
    if (etat === 'brouillon') return 'Brouillon';
    if (etat === 'validee')   return 'Validée';
    if (etat === 'utilisee')  return 'Utilisée';
    if (etat === 'archivee')  return 'Archivée';
    return etat || '—';
  }

  // ============================================================
  // Phase 5.12 — Helpers datalist + propositions
  // ============================================================

  /**
   * Retourne la liste des propositions pour un slug donné, en cherchant
   * dans les 3 sections (meta_seance, detail_bloc, axe_4_ffr) du référentiel.
   * Renvoie un tableau vide si introuvable.
   */
  function lookupPropositions(slug) {
    if (!State.propositionsRef || !slug) return [];
    const sections = ['meta_seance', 'detail_bloc', 'axe_4_ffr'];
    for (let i = 0; i < sections.length; i++) {
      const list = State.propositionsRef[sections[i]] || [];
      const found = list.find(function (item) { return item.slug === slug; });
      if (found) return found.propositions || [];
    }
    return [];
  }

  /**
   * Rend un <datalist> HTML pour un slug donné, avec un id unique.
   * Utilisation typique :
   *   <input list="dl-axe-travail-general" ...>
   *   <datalist id="dl-axe-travail-general">...</datalist>
   * Renvoie chaîne vide si pas de propositions (input sera mono-ligne libre).
   */
  function renderDatalist(slug) {
    const props = lookupPropositions(slug);
    if (props.length === 0) return '';
    const datalistId = 'dl-' + slug.replace(/_/g, '-');
    let html = '<datalist id="' + datalistId + '">';
    props.forEach(function (p) {
      // L'entrée "Autres..." est exclue du datalist : c'est un marqueur visuel
      // dans le référentiel pour rappeler que la saisie libre est possible.
      // Inclure "Autres..." dans le datalist polluerait l'autocomplete avec
      // un item qui ne fait rien quand on le sélectionne.
      if (p && p.trim() !== 'Autres...') {
        html += '<option value="' + escapeHtml(p) + '">';
      }
    });
    html += '</datalist>';
    return html;
  }

  /**
   * Helper : ID datalist depuis un slug (utilisé pour l'attribut list= de l'input).
   */
  function datalistIdForSlug(slug) {
    return 'dl-' + slug.replace(/_/g, '-');
  }

  /**
   * Retourne la liste des matériels proposés depuis le référentiel.
   */
  function lookupMaterielPropose() {
    if (!State.propositionsRef) return [];
    return State.propositionsRef.materiel_propose || [];
  }

  /**
   * Parse une chaîne matériel séparée par virgules en tableau (trim + filtre vide).
   * Inverse : tagsToString(tags) → "tag1, tag2, tag3"
   */
  function stringToTags(str) {
    if (!str || typeof str !== 'string') return [];
    return str.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 0; });
  }

  function tagsToString(tags) {
    if (!Array.isArray(tags)) return '';
    return tags.join(', ');
  }

  /**
   * Rend le picker à tags matériel comme HTML.
   * Format affichage : (×Cônes) (×Plots) (+ ajouter…)
   * Stockage : chaîne séparée par virgules dans materiel_global_text.
   */
  function renderMaterielTags(materielStr) {
    const tags = stringToTags(materielStr);
    let html = '';
    tags.forEach(function (tag, idx) {
      html +=
        '<span class="seance-materiel-tag" data-tag-idx="' + idx + '">' +
          '<span class="seance-materiel-tag__label">' + escapeHtml(tag) + '</span>' +
          '<button type="button" class="seance-materiel-tag__remove" ' +
                  'data-tag-idx="' + idx + '" title="Retirer">×</button>' +
        '</span>';
    });
    html +=
      '<button type="button" id="seance-materiel-add" ' +
              'class="seance-materiel-tag__add" title="Ajouter un matériel">' +
        '+ Ajouter…' +
      '</button>';
    return html;
  }

  /**
   * Re-rend le picker à tags matériel et re-bind ses handlers.
   * Synchronise l'input caché qui sert au save.
   */
  function refreshMaterielTags() {
    const container = document.getElementById('seance-materiel-tags');
    const hidden = document.getElementById('seance-input-materiel');
    if (!container || !hidden) return;
    container.innerHTML = renderMaterielTags(hidden.value || '');
    bindMaterielTags();
    setDirty(true); // marque le formulaire comme modifié
  }

  /**
   * Bind les boutons du picker à tags : × pour retirer, + Ajouter pour ouvrir
   * le menu d'ajout.
   */
  /**
   * Rendu des tags encadrants (Phase 5.12 TER).
   * Identique au pattern matériel : tags cliquables avec bouton ×
   */
  function renderEncadrantsTags(encadrantsStr) {
    const tags = stringToTags(encadrantsStr);
    let html = '';
    tags.forEach(function (tag, idx) {
      html +=
        '<span class="seance-encadrants-tag">' +
          '<span class="seance-encadrants-tag__label">' + escapeHtml(tag) + '</span>' +
          '<button type="button" class="seance-encadrants-tag__remove" data-tag-idx="' + idx + '" title="Supprimer">×</button>' +
        '</span>';
    });
    html +=
      '<button type="button" id="seance-encadrants-add" class="seance-encadrants-tag__add">+ Ajouter…</button>';
    return html;
  }

  function refreshEncadrantsTags() {
    const container = document.getElementById('seance-encadrants-tags');
    const hidden = document.getElementById('seance-input-encadrants');
    if (!container || !hidden) return;
    container.innerHTML = renderEncadrantsTags(hidden.value);
    bindEncadrantsTags();
  }

  function bindEncadrantsTags() {
    const container = document.getElementById('seance-encadrants-tags');
    const hidden = document.getElementById('seance-input-encadrants');
    if (!container || !hidden) return;

    // Boutons × de chaque tag
    container.querySelectorAll('.seance-encadrants-tag__remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-tag-idx'), 10);
        const tags = stringToTags(hidden.value);
        tags.splice(idx, 1);
        hidden.value = tagsToString(tags);
        setDirty(true);
        refreshEncadrantsTags();
      });
    });

    // Bouton "+ Ajouter…"
    const btnAdd = document.getElementById('seance-encadrants-add');
    if (btnAdd) {
      btnAdd.addEventListener('click', function () {
        openEncadrantsMenu(btnAdd);
      });
    }
  }

  function openEncadrantsMenu(anchorBtn) {
    closeEncadrantsMenu();

    const hidden = document.getElementById('seance-input-encadrants');
    if (!hidden) return;
    const tagsActuels = new Set(stringToTags(hidden.value));

    // Propositions depuis le VRAI staff de la catégorie (State.staffDisponible,
    // même source que la pioche coachs des blocs, résolue via la vraie
    // catégorie de l'équipe). v1.16 : remplace State.encadrantsRef, qui venait
    // du miroir data/encadrants-par-categorie.json figé sur M14 (bug : proposait
    // les coachs M14 pour toutes les catégories). Le champ libre ci-dessous
    // reste disponible pour un intervenant hors staff.
    const propose = (State.staffDisponible || [])
      .map(function (p) { return ((p.prenom || '') + ' ' + (p.nom || '')).trim(); })
      .filter(Boolean);

    let html =
      '<div id="seance-encadrants-menu" class="seance-encadrants-menu">' +
        '<div class="seance-encadrants-menu__header">' +
          '<span class="seance-encadrants-menu__title">Ajouter un encadrant</span>' +
          '<button type="button" id="seance-encadrants-menu-close" ' +
                  'class="seance-encadrants-menu__close" title="Fermer">✕</button>' +
        '</div>' +
        '<div class="seance-encadrants-menu__list">';
    propose.forEach(function (enc) {
      const deja = tagsActuels.has(enc);
      html +=
        '<button type="button" class="seance-encadrants-menu__item' +
                  (deja ? ' is-disabled' : '') + '" ' +
                'data-encadrant="' + escapeHtml(enc) + '"' +
                (deja ? ' disabled' : '') + '>' +
          escapeHtml(enc) +
          (deja ? ' <span class="seance-encadrants-menu__deja">déjà ajouté</span>' : '') +
        '</button>';
    });
    html +=
        '</div>' +
        '<div class="seance-encadrants-menu__custom">' +
          '<input type="text" id="seance-encadrants-custom" ' +
                 'class="seance-encadrants-menu__input" ' +
                 'placeholder="Ou tape un encadrant personnalisé…" ' +
                 'maxlength="80">' +
          '<button type="button" id="seance-encadrants-custom-add" ' +
                  'class="seance-encadrants-menu__add-btn">+ Ajouter</button>' +
        '</div>' +
      '</div>';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    anchorBtn.parentNode.insertBefore(wrapper.firstChild, anchorBtn.nextSibling);

    const menu = document.getElementById('seance-encadrants-menu');
    if (!menu) return;

    document.getElementById('seance-encadrants-menu-close').addEventListener('click', closeEncadrantsMenu);

    menu.querySelectorAll('.seance-encadrants-menu__item').forEach(function (item) {
      item.addEventListener('click', function () {
        if (item.disabled) return;
        const enc = item.getAttribute('data-encadrant');
        addEncadrant(enc);
      });
    });

    const inputCustom = document.getElementById('seance-encadrants-custom');
    const btnCustomAdd = document.getElementById('seance-encadrants-custom-add');
    function tryAddCustom() {
      const v = (inputCustom.value || '').trim();
      if (v) addEncadrant(v);
    }
    btnCustomAdd.addEventListener('click', tryAddCustom);
    inputCustom.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryAddCustom();
      }
    });

    setTimeout(function () {
      document.addEventListener('click', onEncadrantsMenuClickOutside);
    }, 0);

    if (inputCustom) setTimeout(function () { inputCustom.focus(); }, 0);
  }

  function closeEncadrantsMenu() {
    const menu = document.getElementById('seance-encadrants-menu');
    if (menu) menu.parentNode.removeChild(menu);
    document.removeEventListener('click', onEncadrantsMenuClickOutside);
  }

  function onEncadrantsMenuClickOutside(e) {
    const menu = document.getElementById('seance-encadrants-menu');
    if (!menu) return;
    if (menu.contains(e.target)) return;
    const addBtn = document.getElementById('seance-encadrants-add');
    if (addBtn && addBtn.contains(e.target)) return;
    closeEncadrantsMenu();
  }

  function addEncadrant(enc) {
    const hidden = document.getElementById('seance-input-encadrants');
    if (!hidden) return;
    const tags = stringToTags(hidden.value);
    if (tags.indexOf(enc) === -1) {
      tags.push(enc);
      hidden.value = tagsToString(tags);
      setDirty(true);
    }
    closeEncadrantsMenu();
    refreshEncadrantsTags();
  }

  function bindMaterielTags() {
    const container = document.getElementById('seance-materiel-tags');
    const hidden = document.getElementById('seance-input-materiel');
    if (!container || !hidden) return;

    // Boutons × de chaque tag
    container.querySelectorAll('.seance-materiel-tag__remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-tag-idx'), 10);
        const tags = stringToTags(hidden.value);
        tags.splice(idx, 1);
        hidden.value = tagsToString(tags);
        refreshMaterielTags();
      });
    });

    // Bouton "+ Ajouter…"
    const btnAdd = document.getElementById('seance-materiel-add');
    if (btnAdd) {
      btnAdd.addEventListener('click', function () {
        openMaterielMenu(btnAdd);
      });
    }
  }

  /**
   * Ouvre un menu dropdown sous le bouton "+ Ajouter…" avec :
   * - Les ~20 matériels proposés (cliquables)
   * - Un input pour saisie libre
   * - Bouton Fermer
   */
  function openMaterielMenu(anchorBtn) {
    // Si un menu est déjà ouvert, le fermer d'abord
    closeMaterielMenu();

    const hidden = document.getElementById('seance-input-materiel');
    if (!hidden) return;
    const tagsActuels = new Set(stringToTags(hidden.value));
    const propose = lookupMaterielPropose();

    let html =
      '<div id="seance-materiel-menu" class="seance-materiel-menu">' +
        '<div class="seance-materiel-menu__header">' +
          '<span class="seance-materiel-menu__title">Ajouter du matériel</span>' +
          '<button type="button" id="seance-materiel-menu-close" ' +
                  'class="seance-materiel-menu__close" title="Fermer">✕</button>' +
        '</div>' +
        '<div class="seance-materiel-menu__list">';
    propose.forEach(function (mat) {
      const deja = tagsActuels.has(mat);
      html +=
        '<button type="button" class="seance-materiel-menu__item' +
                  (deja ? ' is-disabled' : '') + '" ' +
                'data-materiel="' + escapeHtml(mat) + '"' +
                (deja ? ' disabled' : '') + '>' +
          escapeHtml(mat) +
          (deja ? ' <span class="seance-materiel-menu__deja">déjà ajouté</span>' : '') +
        '</button>';
    });
    html +=
        '</div>' +
        '<div class="seance-materiel-menu__custom">' +
          '<input type="text" id="seance-materiel-custom" ' +
                 'class="seance-materiel-menu__input" ' +
                 'placeholder="Ou tape un matériel personnalisé…" ' +
                 'maxlength="80">' +
          '<button type="button" id="seance-materiel-custom-add" ' +
                  'class="seance-materiel-menu__add-btn">+ Ajouter</button>' +
        '</div>' +
      '</div>';

    // Insertion juste après le bouton ancre
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    anchorBtn.parentNode.insertBefore(wrapper.firstChild, anchorBtn.nextSibling);

    // ----- Binds -----
    const menu = document.getElementById('seance-materiel-menu');
    if (!menu) return;

    document.getElementById('seance-materiel-menu-close').addEventListener('click', closeMaterielMenu);

    // Click sur un item proposé → ajout
    menu.querySelectorAll('.seance-materiel-menu__item').forEach(function (item) {
      item.addEventListener('click', function () {
        if (item.disabled) return;
        const mat = item.getAttribute('data-materiel');
        addMateriel(mat);
      });
    });

    // Bouton + Ajouter pour saisie libre
    const inputCustom = document.getElementById('seance-materiel-custom');
    const btnCustomAdd = document.getElementById('seance-materiel-custom-add');
    function tryAddCustom() {
      const v = (inputCustom.value || '').trim();
      if (v) addMateriel(v);
    }
    btnCustomAdd.addEventListener('click', tryAddCustom);
    inputCustom.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryAddCustom();
      }
    });

    // Fermeture par clic extérieur
    setTimeout(function () {
      document.addEventListener('click', onMaterielMenuClickOutside);
    }, 0);

    // Auto-focus sur l'input
    if (inputCustom) setTimeout(function () { inputCustom.focus(); }, 0);
  }

  function closeMaterielMenu() {
    const menu = document.getElementById('seance-materiel-menu');
    if (menu) menu.parentNode.removeChild(menu);
    document.removeEventListener('click', onMaterielMenuClickOutside);
  }

  function onMaterielMenuClickOutside(e) {
    const menu = document.getElementById('seance-materiel-menu');
    if (!menu) return;
    if (menu.contains(e.target)) return;
    // Si on a cliqué sur le bouton "+ Ajouter" qui a ouvert le menu, ignorer
    const addBtn = document.getElementById('seance-materiel-add');
    if (addBtn && addBtn.contains(e.target)) return;
    closeMaterielMenu();
  }

  /**
   * Ajoute un matériel au tableau de tags, ferme le menu, refresh l'affichage.
   * Évite les doublons (case-sensitive — un coach qui veut "ballons" et "Ballons" peut).
   */
  function addMateriel(mat) {
    const hidden = document.getElementById('seance-input-materiel');
    if (!hidden) return;
    const tags = stringToTags(hidden.value);
    if (tags.indexOf(mat) === -1) {
      tags.push(mat);
      hidden.value = tagsToString(tags);
    }
    closeMaterielMenu();
    refreshMaterielTags();
  }

  // Formate une time SQL ('18:30:00' ou '18:30') en 'HH:MM' pour <input type="time">
  function normalizeHeureForInput(heureSql) {
    if (!heureSql) return '';
    return String(heureSql).substring(0, 5);
  }

  function libelleSite(site) {
    if (!site) return '';
    // Préférence : libelle, sinon libelle_court, sinon code
    const base = site.libelle || site.libelle_court || site.code || '(sans nom)';
    return site.ville ? base + ' — ' + site.ville : base;
  }

  function libelleEvenement(evt) {
    if (!evt) return '';
    const date = evt.date_debut ? formatDateShort(evt.date_debut) : '';
    let nom;
    if (evt.adversaire_nom) {
      nom = 'vs ' + evt.adversaire_nom;
    } else {
      nom = evt.libelle || evt.code || 'Événement';
    }
    return date ? (date + ' · ' + nom) : nom;
  }

  // ----- Helpers Phase 5.6.A : trame chronologique -----

  /**
   * Cherche un type de bloc dans le référentiel chargé depuis types-blocs.json.
   * @param {string} slug ex : 'echauffement'
   * @returns {object|null} L'objet type avec emoji, libelle, etc. ; null si introuvable
   */
  function lookupTypeBloc(slug) {
    if (!State.typesBlocsRef || !slug) return null;
    const list = State.typesBlocsRef.types_blocs && State.typesBlocsRef.types_blocs.valeurs;
    if (!Array.isArray(list)) return null;
    return list.find(function (t) { return t.slug === slug; }) || null;
  }

  /**
   * Ajoute N minutes à une heure 'HH:MM' et retourne 'HH:MM'.
   * Gère le passage de minuit en mod 24h.
   */
  function addMinutesToHeure(heureHHMM, minutes) {
    if (!heureHHMM) return '';
    const parts = heureHHMM.split(':');
    if (parts.length < 2) return '';
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return '';
    let total = h * 60 + m + (parseInt(minutes, 10) || 0);
    total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60); // wrap 24h
    const newH = Math.floor(total / 60);
    const newM = total % 60;
    return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
  }

  function showFeedback(msg, type) {
    const el = DOM.feedback();
    if (!el) return;
    el.textContent = msg;
    el.className = 'seance-feedback is-visible seance-feedback--' + (type || 'info');
    // Auto-masquage après 4 secondes pour success/info
    if (type !== 'error') {
      setTimeout(function () {
        if (el.textContent === msg) {
          el.className = 'seance-feedback';
        }
      }, 4000);
    }
  }

  function setDirty(dirty) {
    State.isDirty = !!dirty;
    const btn = DOM.btnSave();
    if (btn) {
      btn.disabled = !dirty;
      btn.textContent = dirty ? '💾 Enregistrer les modifications' : '✓ Enregistré';
    }
  }

  function setAutosaveStatus(status) {
    State.autosaveStatus = status;
    const pill = DOM.autosavePill();
    if (!pill) return;
    // 3 états : 'idle' (vert "Sauvé"), 'saving' (ambre "Sauvegarde…"),
    // 'error' (rouge "Erreur autosave"). Toujours visible quand un form
    // est affiché ; les changements de couleur signalent l'activité.
    pill.classList.remove('is-idle','is-saving','is-error');
    if (status === 'saving') {
      pill.classList.add('is-saving');
      pill.textContent = '● Sauvegarde…';
    } else if (status === 'error') {
      pill.classList.add('is-error');
      pill.textContent = '● Erreur autosave';
    } else {
      pill.classList.add('is-idle');
      pill.textContent = '● Sauvé';
    }
  }

  // ============================================================
  // 4. RENDU SIDEBAR — Liste des séances récentes
  // ============================================================

  function renderSidebar() {
    const body = DOM.sidebarBody();
    if (!body) return;

    // Phase 5.10 + 5.12 BIS : header avec toggle + bouton "Sélectionner"
    const headerHtml =
      '<div class="seance-sidebar__filters">' +
        '<label class="seance-sidebar__toggle" title="Afficher aussi les séances archivées">' +
          '<input type="checkbox" id="seance-toggle-archivees"' +
            (State.showArchivees ? ' checked' : '') + '>' +
          '<span>Afficher les archivées</span>' +
        '</label>' +
        (State.selectionMode
          ? '<button type="button" id="seance-btn-sidebar-select-exit" ' +
                    'class="seance-sidebar__select-btn is-active" ' +
                    'title="Quitter le mode sélection">' +
              '✕ Annuler' +
            '</button>'
          : '<button type="button" id="seance-btn-sidebar-select" ' +
                    'class="seance-sidebar__select-btn" ' +
                    'title="Sélectionner plusieurs brouillons pour les supprimer">' +
              '☑ Sélectionner' +
            '</button>') +
      '</div>';

    // Liste des séances (ou placeholder si vide)
    let listHtml;
    if (State.seances.length === 0) {
      listHtml =
        '<div class="seance-sidebar__placeholder">' +
          'Aucune séance pour l\'instant.<br>' +
          'Clique sur « + Nouvelle séance » pour démarrer.' +
        '</div>';
    } else {
      const items = State.seances.map(function (s) {
        const isSelected = State.currentSeance && State.currentSeance.id === s.id;
        const dateLib = s.date_seance ? formatDateShort(s.date_seance) : 'Sans date';
        const heureLib = s.heure_debut ? normalizeHeureForInput(s.heure_debut) : '';
        const etatLib = libelleEtatSeance(s.etat);
        const titre = s.axe_travail_general
          ? escapeHtml(s.axe_travail_general).substring(0, 60)
          : (s.theme_principal ? escapeHtml(s.theme_principal).substring(0, 60) : 'Séance sans thème');
        // Phase 5.12 BIS + 5.13 : case à cocher en mode sélection. La cible
        // dépend du toggle archivées :
        //   - vue normale (archivées masquées) → on coche les BROUILLONS
        //     (pour archivage en lot, récupérable) ;
        //   - vue archivées (toggle ON) → on coche les ARCHIVÉES
        //     (pour purge définitive en lot, irréversible).
        const peutEtreCochee = State.showArchivees
          ? (s.etat === 'archivee')
          : (s.etat === 'brouillon');
        const estCochee = State.selectionIds.has(s.id);
        const checkboxHtml = (State.selectionMode && peutEtreCochee)
          ? '<input type="checkbox" class="seance-list-item__checkbox" ' +
                   'data-seance-id="' + escapeHtml(s.id) + '"' +
                   (estCochee ? ' checked' : '') + '>'
          : '';
        const isSelectionRowClass = (State.selectionMode && peutEtreCochee && estCochee)
          ? ' is-selection-checked' : '';
        const isProtectedClass = (State.selectionMode && !peutEtreCochee)
          ? ' is-selection-protected' : '';
        // Phase 5.13 : bouton purge par-ligne, UNIQUEMENT en vue archivées,
        // hors mode sélection, sur une séance réellement archivée.
        const purgeBtnHtml = (State.showArchivees && !State.selectionMode && s.etat === 'archivee')
          ? '<button type="button" class="seance-list-item__purge-btn" ' +
                    'data-purge-id="' + escapeHtml(s.id) + '" ' +
                    'title="Supprimer définitivement cette séance archivée">🗑</button>'
          : '';
        return (
          '<li class="seance-list-item' + (isSelected ? ' is-selected' : '') +
              isSelectionRowClass + isProtectedClass + '" ' +
              'data-seance-id="' + escapeHtml(s.id) + '" ' +
              (State.selectionMode
                ? (peutEtreCochee
                    ? (State.showArchivees
                        ? 'title="Cocher pour purger définitivement"'
                        : 'title="Cocher pour archiver (corbeille)"')
                    : 'title="Protégée : non cochable dans ce mode"')
                : 'title="Cliquer pour ouvrir cette séance"') + '>' +
            checkboxHtml +
            '<div class="seance-list-item__main">' +
              '<div class="seance-list-item__head">' +
                '<span class="seance-list-item__date">' + dateLib + (heureLib ? ' · ' + heureLib : '') + '</span>' +
                '<span class="seance-list-item__etat etat-' + escapeHtml(s.etat) + '">' + etatLib + '</span>' +
              '</div>' +
              '<div class="seance-list-item__title">' + titre + '</div>' +
            '</div>' +
            purgeBtnHtml +
          '</li>'
        );
      }).join('');
      listHtml = '<ul class="seance-list">' + items + '</ul>';
    }

    // Footer : 2 cas selon le mode
    let footerHtml = '';
    if (State.selectionMode) {
      // Phase 5.12 BIS + 5.13 : footer mode sélection, contextuel au toggle.
      //   - vue archivées (toggle ON) → purge définitive en lot ;
      //   - vue normale → archivage en lot (corbeille, récupérable).
      const enModePurge = State.showArchivees;
      const nbCochees = State.selectionIds.size;
      if (nbCochees > 0) {
        footerHtml =
          '<div id="seance-sidebar-cleanup" class="seance-sidebar__selection-actions">' +
            '<span class="seance-sidebar__selection-label">' +
              nbCochees + ' s\u00e9lectionn\u00e9' + (nbCochees > 1 ? 'es' : 'e') +
            '</span>' +
            (enModePurge
              ? '<button type="button" id="seance-btn-sidebar-purge" ' +
                        'class="seance-sidebar__delete-btn" ' +
                        'title="Supprimer définitivement les séances archivées cochées">' +
                  '🗑 Supprimer' +
                '</button>'
              : '<button type="button" id="seance-btn-sidebar-archive" ' +
                        'class="seance-sidebar__archive-btn" ' +
                        'title="Archiver les brouillons cochés (corbeille, récupérable)">' +
                  '📦 Archiver' +
                '</button>') +
          '</div>';
      } else {
        footerHtml =
          '<div class="seance-sidebar__selection-hint">' +
            (enModePurge
              ? '💡 Coche les archivées à supprimer définitivement'
              : '💡 Coche les brouillons à archiver') +
          '</div>';
      }
    } else {
      // Phase 5.10 : footer nettoyage brouillons vides (visible si compteur > 0)
      const nbVides = State.brouillonsVides ? State.brouillonsVides.length : 0;
      if (nbVides > 0) {
        footerHtml =
          '<div id="seance-sidebar-cleanup" class="seance-sidebar__cleanup">' +
            '<span class="seance-sidebar__cleanup-label">' +
              '🗑 ' + nbVides + ' brouillon' + (nbVides > 1 ? 's' : '') + ' vide' + (nbVides > 1 ? 's' : '') +
            '</span>' +
            '<button type="button" id="seance-btn-cleanup" ' +
                    'class="seance-sidebar__cleanup-btn" ' +
                    'title="Supprime les brouillons sans date ni blocs">' +
              '🧹 Nettoyer' +
            '</button>' +
          '</div>';
      }
    }

    body.innerHTML = headerHtml + listHtml + footerHtml;

    // ----- Binds -----
    const lis = body.querySelectorAll('.seance-list-item');
    lis.forEach(function (li) {
      const id = li.getAttribute('data-seance-id');
      if (State.selectionMode) {
        // En mode sélection : clic toggle la checkbox (si protégée, ignore)
        if (li.classList.contains('is-selection-protected')) return;
        li.addEventListener('click', function (e) {
          // Évite double-toggle si on a cliqué directement sur la checkbox
          if (e.target.tagName === 'INPUT') return;
          toggleSeanceSelection(id);
        });
      } else {
        // Mode normal : clic ouvre la séance
        li.addEventListener('click', function () { onSelectSeance(id); });
      }
    });

    // Binds des checkboxes (mode sélection)
    if (State.selectionMode) {
      body.querySelectorAll('.seance-list-item__checkbox').forEach(function (cb) {
        cb.addEventListener('click', function (e) {
          e.stopPropagation(); // évite que le clic remonte au li
          toggleSeanceSelection(cb.getAttribute('data-seance-id'));
        });
      });
    }

    // Phase 5.13 : binds purge par-ligne (vue archivées, hors mode sélection)
    body.querySelectorAll('.seance-list-item__purge-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation(); // évite d'ouvrir la séance
        onPurgerSeanceArchivee(btn.getAttribute('data-purge-id'));
      });
    });

    // Phase 5.10 : câbles toggle archivées et bouton nettoyage
    const toggle = DOM.toggleArchivees();
    if (toggle) toggle.addEventListener('change', onToggleArchivees);
    const btnCleanup = DOM.btnCleanup();
    if (btnCleanup) btnCleanup.addEventListener('click', onCleanupBrouillons);

    // Phase 5.12 BIS : binds mode sélection
    const btnSelect = DOM.btnSidebarSelect();
    if (btnSelect) btnSelect.addEventListener('click', enterSelectionMode);
    const btnSelectExit = DOM.btnSidebarSelectExit();
    if (btnSelectExit) btnSelectExit.addEventListener('click', exitSelectionMode);
    // Phase 5.13 : le bouton d'action en lot dépend du toggle archivées.
    const btnSidebarArchive = DOM.btnSidebarArchive();
    if (btnSidebarArchive) btnSidebarArchive.addEventListener('click', onArchiveSeancesEnLot);
    const btnSidebarPurge = DOM.btnSidebarPurge();
    if (btnSidebarPurge) btnSidebarPurge.addEventListener('click', onPurgerSeancesArchiveesEnLot);
  }

  // ============================================================
  // 5. RENDU ÉDITEUR
  // ============================================================

  function renderEmptyEditor() {
    const area = DOM.editorArea();
    if (!area) return;
    area.innerHTML =
      '<div class="seance-editor-area__empty">' +
        '<h3 class="seance-editor-area__empty-title">Aucune séance sélectionnée</h3>' +
        '<p class="seance-editor-area__empty-text">' +
          'Clique sur « + Nouvelle séance » dans la barre latérale pour en créer une.' +
        '</p>' +
      '</div>';
  }

  /**
   * Dispatcher : choisit entre renderFormCollapsed (résumé compact) et
   * renderFormExpanded (formulaire complet) selon State.formCollapsed.
   * Phase 5.6.B.
   */
  function renderForm() {
    if (State.formCollapsed) {
      renderFormCollapsed();
    } else {
      renderFormExpanded();
    }
  }

  /**
   * Rend le formulaire méta replié en 1 ligne (résumé compact).
   * Affiché par défaut quand on ouvre une séance déjà documentée
   * (date_seance non null). Bouton "✏️ Modifier" pour redéployer.
   * Phase 5.6.B.
   */
  function renderFormCollapsed() {
    const area = DOM.editorArea();
    if (!area || !State.currentSeance) return;
    const s = State.currentSeance;

    // Construire le résumé : "📅 ven. 15 mai · 18:30 · 75 min · Effectif 23"
    const parts = [];
    if (s.date_seance) {
      parts.push('📅 ' + formatDateShort(s.date_seance));
    } else {
      parts.push('📅 sans date');
    }
    if (s.heure_debut) {
      parts.push(normalizeHeureForInput(s.heure_debut));
    }
    if (s.duree_totale_min) {
      parts.push(s.duree_totale_min + ' min');
    }
    if (s.effectif_prevu) {
      parts.push('Effectif ' + s.effectif_prevu);
    }
    if (s.theme_principal) {
      parts.push('« ' + escapeHtml(s.theme_principal) + ' »');
    }

    area.innerHTML =
      '<div class="seance-form-collapsed">' +
        '<div class="seance-form-collapsed__left">' +
          '<span class="seance-form-collapsed__summary">' + parts.join(' · ') + '</span>' +
          '<span class="seance-form-collapsed__etat etat-' + escapeHtml(s.etat) + '">' + libelleEtatSeance(s.etat) + '</span>' +
        '</div>' +
        '<div class="seance-form-collapsed__right">' +
          '<span id="seance-autosave-pill" class="seance-autosave-pill is-idle" title="Sauvegarde automatique (30s si modifications)">● Sauvé</span>' +
          // Phase 5.12 : bouton Valider (si brouillon) ou Repasser-brouillon
          (s.etat === 'brouillon'
            ? '<button type="button" id="seance-btn-valider-collapsed" ' +
                      'class="seance-form__valider-btn" ' +
                      'title="Valider cette séance (prête à coacher)">' +
                '✓ Valider' +
              '</button>'
            : '') +
          ((s.etat === 'validee' || s.etat === 'utilisee')
            ? '<button type="button" id="seance-btn-brouillon-collapsed" ' +
                      'class="seance-form__brouillon-btn" ' +
                      'title="Repasser cette séance en brouillon (réédition libre)">' +
                '↩ Brouillon' +
              '</button>'
            : '') +
          // Phase 5.13 SEANCE-SOFT-DELETE : bouton « 🗑 Supprimer » du
          // brouillon RETIRÉ aussi dans le résumé replié (durcissement).
          '' +
          // Phase 5.10 : bouton Archiver dans le résumé replié
          '<button type="button" id="seance-btn-archive-collapsed" ' +
                  'class="seance-form__archive-btn" ' +
                  (s.etat === 'archivee' ? 'disabled title="Déjà archivée"' : 'title="Archiver cette séance"') + '>' +
            '📦 Archiver' +
          '</button>' +
          // SEANCE-DUPLICATION v1 : dupliquer la séance (copie brouillon).
          // Toujours actif, quel que soit l'état de la source.
          '<button type="button" id="seance-btn-dupliquer-collapsed" ' +
                  'class="seance-form-collapsed__edit-btn" ' +
                  'title="Dupliquer cette séance (nouvelle copie en brouillon)">' +
            '📋 Dupliquer' +
          '</button>' +
          '<button type="button" id="seance-btn-expand-form" class="seance-form-collapsed__edit-btn" title="Modifier les méta de la séance">' +
            '✏️ Modifier' +
          '</button>' +
        '</div>' +
        '<div id="seance-feedback" class="seance-feedback"></div>' +
      '</div>';

    // Bind du bouton "✏️ Modifier"
    const btn = document.getElementById('seance-btn-expand-form');
    if (btn) {
      btn.addEventListener('click', function () {
        State.formCollapsed = false;
        renderForm();
        renderTrame(); // re-render pour rester en place
      });
    }

    // SEANCE-DUPLICATION v1 : bind du bouton « 📋 Dupliquer »
    const btnDup = document.getElementById('seance-btn-dupliquer-collapsed');
    if (btnDup) btnDup.addEventListener('click', onDupliquerSeance);

    // Phase 5.10 : bind du bouton "📦 Archiver" en mode collapsed
    const btnArchive = DOM.btnArchiveCollapsed();
    if (btnArchive && !btnArchive.disabled) {
      btnArchive.addEventListener('click', onArchiveSeance);
    }

    // Phase 5.12 : binds Valider / Brouillon en mode collapsed
    const btnValiderC = DOM.btnValiderCollapsed();
    if (btnValiderC) btnValiderC.addEventListener('click', onValiderSeance);
    const btnBrouillonC = DOM.btnBrouillonCollapsed();
    if (btnBrouillonC) btnBrouillonC.addEventListener('click', onRepasserBrouillon);

    // Phase 5.12 BIS : bind bouton Supprimer en mode collapsed
    const btnDeleteC = DOM.btnDeleteCollapsed();
    if (btnDeleteC) btnDeleteC.addEventListener('click', onDeleteSeance);

    // Phase 5.6.A : rendu de la trame chronologique sous le résumé
    renderTrame();
  }

  function renderFormExpanded() {
    const area = DOM.editorArea();
    if (!area || !State.currentSeance) return;
    const s = State.currentSeance;

    // Options des dropdowns
    const lieuOptions = ['<option value="">— Aucun lieu —</option>']
      .concat(State.sites.map(function (site) {
        const selected = (site.id === s.lieu_id) ? ' selected' : '';
        return '<option value="' + escapeHtml(site.id) + '"' + selected + '>' +
                 escapeHtml(libelleSite(site)) +
               '</option>';
      })).join('');

    const evtOptions = ['<option value="">— Aucun événement —</option>']
      .concat(State.evenements.map(function (evt) {
        const selected = (evt.id === s.evenement_id) ? ' selected' : '';
        return '<option value="' + escapeHtml(evt.id) + '"' + selected + '>' +
                 escapeHtml(libelleEvenement(evt)) +
               '</option>';
      })).join('');

    area.innerHTML =
      '<form class="seance-form" id="seance-form" autocomplete="off" onsubmit="return false;">' +

        // ----- Header -----
        '<header class="seance-form__header">' +
          '<h3 class="seance-form__title">Méta de la séance</h3>' +
          '<div class="seance-form__header-right">' +
            '<span id="seance-autosave-pill" class="seance-autosave-pill is-idle" title="État de la sauvegarde automatique (30s si modifications)">● Sauvé</span>' +
            '<span class="seance-form__etat etat-' + escapeHtml(s.etat) + '">' + libelleEtatSeance(s.etat) + '</span>' +
            // Phase 5.12 : bouton Valider (si brouillon) ou Repasser-brouillon (si validee/utilisee)
            (s.etat === 'brouillon'
              ? '<button type="button" id="seance-btn-valider-expanded" ' +
                        'class="seance-form__valider-btn" ' +
                        'title="Valider cette séance (prête à coacher)">' +
                  '✓ Valider' +
                '</button>'
              : '') +
            ((s.etat === 'validee' || s.etat === 'utilisee')
              ? '<button type="button" id="seance-btn-brouillon-expanded" ' +
                        'class="seance-form__brouillon-btn" ' +
                        'title="Repasser cette séance en brouillon (réédition libre)">' +
                  '↩ Brouillon' +
                '</button>'
              : '') +
            // Phase 5.13 SEANCE-SOFT-DELETE : bouton « 🗑 Supprimer » du
            // brouillon RETIRÉ (durcissement). Le brouillon se met à la
            // corbeille via « 📦 Archiver » (récupérable). Purge définitive
            // uniquement dans la vue archivées (toggle ON).
            '' +
            // Phase 5.10 : bouton Archiver (désactivé si déjà archivée)
            '<button type="button" id="seance-btn-archive-expanded" ' +
                    'class="seance-form__archive-btn" ' +
                    (s.etat === 'archivee' ? 'disabled title="Déjà archivée"' : 'title="Archiver cette séance"') + '>' +
              '📦 Archiver' +
            '</button>' +
            '<button type="button" id="seance-btn-collapse-form" class="seance-form__collapse-btn" title="Replier le formulaire (raccourci : sans modifier)">' +
              '↑ Replier' +
            '</button>' +
          '</div>' +
        '</header>' +

        // ----- Section 1 : essentielle (date/heure/durée/effectif/thème/axe) -----
        '<div class="seance-form__grid">' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Date de la séance</span>' +
            '<input type="date" id="seance-input-date" class="seance-field__input" ' +
                   'value="' + escapeHtml(s.date_seance || '') + '">' +
          '</label>' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Heure de début</span>' +
            '<input type="time" id="seance-input-heure" class="seance-field__input" ' +
                   'value="' + escapeHtml(normalizeHeureForInput(s.heure_debut)) + '">' +
          '</label>' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Durée totale (min)</span>' +
            '<input type="number" id="seance-input-duree" class="seance-field__input" ' +
                   'min="15" max="240" step="5" ' +
                   'value="' + escapeHtml(s.duree_totale_min || DUREE_DEFAULT_MIN) + '">' +
          '</label>' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Effectif prévu</span>' +
            '<input type="number" id="seance-input-effectif" class="seance-field__input" ' +
                   'min="1" max="50" step="1" ' +
                   'value="' + escapeHtml(s.effectif_prevu || '') + '">' +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Thème principal</span>' +
            '<input type="text" id="seance-input-theme" class="seance-field__input" ' +
                   'list="' + datalistIdForSlug('theme_principal') + '" ' +
                   'placeholder="Ex : Défense au sol, Plaquage technique…" ' +
                   'maxlength="120" ' +
                   'value="' + escapeHtml(s.theme_principal || '') + '">' +
            renderDatalist('theme_principal') +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Axe de travail général</span>' +
            '<input type="text" id="seance-input-axe" class="seance-field__input" ' +
                   'list="' + datalistIdForSlug('axe_travail_general') + '" ' +
                   'placeholder="Une phrase qui résume l\'objectif principal de la séance…" ' +
                   'maxlength="500" ' +
                   'value="' + escapeHtml(s.axe_travail_general || '') + '">' +
            renderDatalist('axe_travail_general') +
          '</label>' +

        '</div>' +

        // ----- Section 2 : contexte (Phase 5.5.B1) -----
        '<details class="seance-form__details" open>' +
          '<summary class="seance-form__details-summary">Contexte (lieu, événement, encadrants…)</summary>' +

          '<div class="seance-form__grid">' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Lieu</span>' +
              '<select id="seance-select-lieu" class="seance-field__input">' +
                lieuOptions +
              '</select>' +
            '</label>' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Événement rattaché</span>' +
              '<select id="seance-select-evenement" class="seance-field__input">' +
                evtOptions +
              '</select>' +
            '</label>' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Météo prévue</span>' +
              '<input type="text" id="seance-input-meteo" class="seance-field__input" ' +
                     'list="' + datalistIdForSlug('meteo_text') + '" ' +
                     'placeholder="Ex : pluie fine, 12°C…" ' +
                     'maxlength="120" ' +
                     'value="' + escapeHtml(s.meteo_text || '') + '">' +
              renderDatalist('meteo_text') +
            '</label>' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Cycle / Période</span>' +
              '<input type="text" id="seance-input-cycle" class="seance-field__input" ' +
                     'list="' + datalistIdForSlug('bloc_cycle') + '" ' +
                     'placeholder="Ex : Cycle défense (sem. 3/6)" ' +
                     'maxlength="120" ' +
                     'value="' + escapeHtml(s.bloc_cycle || '') + '">' +
              renderDatalist('bloc_cycle') +
            '</label>' +

            '<label class="seance-field seance-field--full">' +
              '<span class="seance-field__label">Encadrants</span>' +
              '<div id="seance-encadrants-tags" class="seance-encadrants-tags">' +
                renderEncadrantsTags(s.encadrants_text || '') +
              '</div>' +
              '<input type="hidden" id="seance-input-encadrants" ' +
                     'value="' + escapeHtml(s.encadrants_text || '') + '">' +
            '</label>' +

            '<label class="seance-field seance-field--full">' +
              '<span class="seance-field__label">Objectifs détaillés</span>' +
              '<textarea id="seance-input-objectifs" class="seance-field__input seance-field__textarea" ' +
                        'rows="3" maxlength="1000" ' +
                        'placeholder="Une ou plusieurs lignes détaillant les objectifs visés…">' +
                escapeHtml(s.objectifs_text || '') +
              '</textarea>' +
            '</label>' +

            '<label class="seance-field seance-field--full">' +
              '<span class="seance-field__label">Matériel global</span>' +
              '<div id="seance-materiel-tags" class="seance-materiel-tags">' +
                renderMaterielTags(s.materiel_global_text || '') +
              '</div>' +
              // Input caché qui contient la valeur sérialisée (compatibilité saveSeance)
              '<input type="hidden" id="seance-input-materiel" ' +
                     'value="' + escapeHtml(s.materiel_global_text || '') + '">' +
            '</label>' +

          '</div>' +
        '</details>' +

        // ----- Footer -----
        '<div class="seance-form__footer">' +
          '<button type="button" id="seance-btn-save" class="seance-form__save-btn">' +
            '✓ Enregistré' +
          '</button>' +
          '<span class="seance-form__hint">' +
            'Phase 5.5.B2 · Sauvegarde manuelle + autosave 30s' +
          '</span>' +
        '</div>' +

        '<div id="seance-feedback" class="seance-feedback"></div>' +

      '</form>';

    // Bind change → setDirty(true) sur tous les champs
    const fields = [
      'inputDate','inputHeure','inputDuree','inputEffectif','inputTheme','inputAxe',
      'selectLieu','selectEvenement',
      'inputMeteo','inputEncadrants','inputObjectifs','inputCycle','inputMateriel'
    ];
    fields.forEach(function (key) {
      const el = DOM[key]();
      if (el) {
        el.addEventListener('input',  function () { setDirty(true); });
        el.addEventListener('change', function () { setDirty(true); });
      }
    });

    // Bind bouton Save
    const btnSave = DOM.btnSave();
    if (btnSave) {
      btnSave.disabled = true; // état initial : rien à enregistrer
      btnSave.addEventListener('click', onSaveSeance);
    }

    // Phase 5.6.B (fix v1.4.1) : bouton ↑ Replier
    const btnCollapse = document.getElementById('seance-btn-collapse-form');
    if (btnCollapse) {
      btnCollapse.addEventListener('click', onCollapseForm);
    }

    // Phase 5.10 : bouton 📦 Archiver
    const btnArchive = DOM.btnArchiveExpanded();
    if (btnArchive && !btnArchive.disabled) {
      btnArchive.addEventListener('click', onArchiveSeance);
    }

    // Phase 5.12 : binds Valider / Brouillon en mode expanded
    const btnValiderE = DOM.btnValiderExpanded();
    if (btnValiderE) btnValiderE.addEventListener('click', onValiderSeance);
    const btnBrouillonE = DOM.btnBrouillonExpanded();
    if (btnBrouillonE) btnBrouillonE.addEventListener('click', onRepasserBrouillon);

    // Phase 5.12 BIS : bind bouton Supprimer en mode expanded
    const btnDeleteE = DOM.btnDeleteExpanded();
    if (btnDeleteE) btnDeleteE.addEventListener('click', onDeleteSeance);

    // Phase 5.12 : bind picker à tags matériel global
    bindMaterielTags();

    // Phase 5.12 TER : bind picker à tags encadrants
    bindEncadrantsTags();

    // Phase 5.6.A : rendu de la trame chronologique sous le formulaire
    renderTrame();
  }

  // ============================================================
  // 5.bis. RENDU TRAME CHRONOLOGIQUE (Phase 5.6.A)
  // ============================================================

  /**
   * Rend la section "Trame chronologique" sous le formulaire méta.
   * Appelée après renderForm() et après chaque action (ajout, etc.).
   *
   * Phase 5.7 : si State.view === 'bloc-detail', la trame est cachée et
   * le détail du bloc en édition prend sa place (à la fin de la fonction).
   */
  /**
   * Regroupe les blocs (triés par ordre) en ÉTAGES (v1.10, sql_108).
   * Un étage = tous les blocs partageant le même `ordre` (voies parallèles),
   * triés par `voie` croissante. dureeMax = la plus longue durée de l'étage
   * (les voies tournent en simultané → l'étage dure le max). Renvoie un
   * tableau ordonné d'objets { ordre, blocs:[...], dureeMax }.
   */
  function _grouperBlocsParEtage(blocs) {
    const map = new Map();
    (blocs || []).forEach(function (b) {
      const ord = (b.ordre === undefined || b.ordre === null) ? 0 : b.ordre;
      if (!map.has(ord)) map.set(ord, []);
      map.get(ord).push(b);
    });
    const ordres = Array.from(map.keys()).sort(function (a, b) { return a - b; });
    return ordres.map(function (ord) {
      const lot = map.get(ord).slice().sort(function (a, b) {
        return ((a.voie || 0) - (b.voie || 0));
      });
      const dureeMax = lot.reduce(function (m, b) {
        return Math.max(m, b.duree_min || 0);
      }, 0);
      return { ordre: ord, blocs: lot, dureeMax: dureeMax };
    });
  }

  /**
   * Durée effective d'un étage (minutes), circuit-aware.
   * - Étage ordinaire (parallèle simultané ou bloc seul) : max des voies
   *   (dureeMax) — les voies se déroulent en même temps.
   * - Étage CIRCUIT (sql_241) : les groupes tournent, les stations se font
   *   en SUCCESSION. Durée = (durée_station × nb_stations)
   *                        + (durée_pause × (nb_stations − 1)).
   *   La pause n'existe qu'entre les stations (nb − 1 intervalles).
   *   Repli sur dureeMax si le circuit n'a pas de durée de station saisie.
   * @param {{ordre:number, blocs:Array, dureeMax:number}} etage
   * @returns {number} durée en minutes
   */
  function _dureeEffectiveEtage(etage) {
    if (!etage) return 0;
    const circ = _circuitDeLetage(etage.ordre);
    if (circ && circ.duree_station_min) {
      const nb = Array.isArray(etage.blocs) ? etage.blocs.length : 0;
      if (nb <= 0) return etage.dureeMax || 0;
      const station = circ.duree_station_min;
      const pause = circ.duree_pause_min || 0;
      return (station * nb) + (pause * (nb - 1));
    }
    return etage.dureeMax || 0;
  }

  /**
   * v1.23 — Calcule la matrice de rotation d'un étage-circuit (rendu dérivé,
   * rien n'est stocké — cf. D5). Rotation complète implicite : à chaque tour
   * chaque groupe avance d'une station (cyclique). Nb de tours = nb de stations.
   *
   * Stations = les voies (blocs) de l'étage. Groupes = union des noms de
   * groupes distincts présents dans les groupes_jsonb des stations.
   *
   * Déséquilibres (choix Manu) :
   *  - G < S (moins de groupes que de stations) : stations vides = null ("—").
   *  - G = S : cas nominal, toutes stations occupées.
   *  - G > S (plus de groupes que de stations) : signalé via desequilibre='trop'
   *    (l'appelant affiche un avertissement plutôt qu'une matrice élaborée).
   *
   * @param {Array} blocsEtage voies de l'étage (triées par voie)
   * @returns {{stations:string[], groupes:string[], grille:Array, desequilibre:string}}
   */
  function _matriceRotation(blocsEtage) {
    const stations = (blocsEtage || []).map(function (b) {
      const t = lookupTypeBloc(b.type_bloc);
      const lib = (t && t.libelle) || b.type_bloc || 'Station';
      return b.titre_precision ? (lib + ' — ' + b.titre_precision) : lib;
    });

    // Union ordonnée des noms de groupes distincts (première apparition).
    const vus = {};
    const groupes = [];
    (blocsEtage || []).forEach(function (b) {
      if (Array.isArray(b.groupes_jsonb)) {
        b.groupes_jsonb.forEach(function (g) {
          if (g && g.nom && !vus[g.nom]) { vus[g.nom] = true; groupes.push(g.nom); }
        });
      }
    });

    const S = stations.length;
    const G = groupes.length;
    let desequilibre = 'ok';
    if (G === 0) desequilibre = 'aucun';        // pas de groupe défini
    else if (G < S) desequilibre = 'moins';     // stations vides
    else if (G > S) desequilibre = 'trop';      // avertissement (choix ii)

    // Grille : nb de tours = nb de stations. grille[tour][idxStation] = nom|null.
    // Au tour t, le groupe d'indice g occupe la station (g + t) % S.
    const grille = [];
    if (S > 0 && G > 0 && desequilibre !== 'trop') {
      for (let t = 0; t < S; t++) {
        const ligne = new Array(S).fill(null);
        for (let g = 0; g < G; g++) {
          const idxStation = (g + t) % S;
          ligne[idxStation] = groupes[g];
        }
        grille.push(ligne);
      }
    }

    return { stations: stations, groupes: groupes, grille: grille, desequilibre: desequilibre };
  }

  /**
   * v1.24 — Rend la matrice de rotation en HTML statique pour le PDF coach
   * (pas d'inputs, styles print). Réutilise le calcul _matriceRotation.
   * @param {object} etage étage courant
   * @param {object} circ fiche circuit (durée station + pause)
   * @returns {string} HTML
   */
  function _matriceRotationHtmlPdf(etage, circ) {
    const mat = _matriceRotation(etage.blocs);
    if (mat.desequilibre === 'aucun') return '';
    if (mat.desequilibre === 'trop') {
      return '<p class="seance-print__circuit-warn">⚠️ Plus de groupes (' + mat.groupes.length +
             ') que de stations (' + mat.stations.length + ').</p>';
    }
    const station = circ.duree_station_min || 0;
    const pause = circ.duree_pause_min || 0;
    let thead = '<tr><th>Tour</th>';
    mat.stations.forEach(function (st) { thead += '<th>' + escapeHtml(st) + '</th>'; });
    thead += '</tr>';
    let tbody = '';
    mat.grille.forEach(function (ligne, t) {
      const debut = t * (station + pause);
      tbody += '<tr><td class="seance-print__circuit-tour">T' + (t + 1) + ' (' + debut + '\u2032)</td>';
      ligne.forEach(function (nomGroupe) {
        tbody += nomGroupe
          ? '<td>' + escapeHtml(nomGroupe) + '</td>'
          : '<td class="seance-print__circuit-vide">\u2014</td>';
      });
      tbody += '</tr>';
    });
    return '<table class="seance-print__circuit-matrix"><thead>' + thead +
           '</thead><tbody>' + tbody + '</tbody></table>';
  }

  // ============================================================
  //  RENCONTRES TOURNANTES (mode='rencontres') — ADDITIF
  //  Extension du circuit d'ateliers : une voie "match" consomme
  //  DEUX groupes (opposition), les voies "atelier" en consomment un.
  //  N'altère PAS _matriceRotation / _matriceRotationHtmlPdf (mode
  //  'circuit' inchangé). Périmètre livré : cas (a) — 1 voie match +
  //  N ateliers, rotation cyclique déterministe ("qui se repose").
  //  Cas (b) multi-équipes = dette tracée (STATE), non simulé ici.
  // ============================================================

  /**
   * Rôle d'une voie (station) en mode rencontres. Lit roles_voies_jsonb
   * du circuit : mapping { "<ordre_voie>": "match" | "atelier" }. La voie
   * est identifiée par son index (0..S-1) dans l'étage, converti en clé
   * string. Défaut 'atelier' si non renseigné. Ignoré hors mode rencontres.
   *
   * @param {object} circ fiche seances_etages_circuits
   * @param {number} idxVoie index de la voie dans l'étage
   * @returns {'match'|'atelier'}
   */
  function _roleVoie(circ, idxVoie) {
    const map = (circ && circ.roles_voies_jsonb && typeof circ.roles_voies_jsonb === 'object')
      ? circ.roles_voies_jsonb : {};
    const r = map[String(idxVoie)];
    return r === 'match' ? 'match' : 'atelier';
  }

  /**
   * Matrice de rotation en mode RENCONTRES (cas a, cyclique déterministe).
   * Modèle : parmi les voies, exactement UNE porte le rôle 'match' (elle
   * affiche une paire de groupes qui s'affrontent) ; les autres sont des
   * 'atelier' (un groupe chacune). Rotation "qui se repose" : à chaque tour,
   * une paire distincte est au match et chaque groupe passe à son tour hors
   * du match. Nb de tours = nb de groupes G (chaque groupe est "au repos
   * hors match" une fois). Déterministe → matrice pré-remplie.
   *
   * Retour parallèle à _matriceRotation, enrichi :
   *  - stations[] : libellés des voies (comme _matriceRotation)
   *  - rolesVoies[] : 'match'|'atelier' par voie (même ordre que stations)
   *  - groupes[] : union ordonnée des noms de groupes
   *  - grille[tour][idxVoie] : pour une voie 'atelier' → nom|null ;
   *                            pour la voie 'match' → { pair:[gA,gB] }|null
   *  - desequilibre : 'ok'|'aucun'|'non_simulable'
   *      'non_simulable' = config hors périmètre (a) : 0 ou >1 voie match,
   *      ou G<3, ou pas assez de groupes → l'appelant affiche un cadre-règle
   *      au lieu d'une matrice.
   *
   * @param {Array} blocsEtage voies de l'étage
   * @param {object} circ fiche circuit (mode='rencontres')
   * @returns {{stations:string[], rolesVoies:string[], groupes:string[], grille:Array, desequilibre:string}}
   */
  function _matriceRencontres(blocsEtage, circ) {
    const voies = blocsEtage || [];
    const stations = voies.map(function (b) {
      const t = lookupTypeBloc(b.type_bloc);
      const lib = (t && t.libelle) || b.type_bloc || 'Station';
      return b.titre_precision ? (lib + ' — ' + b.titre_precision) : lib;
    });
    const rolesVoies = voies.map(function (b, i) { return _roleVoie(circ, i); });

    // Union ordonnée des noms de groupes distincts (première apparition).
    const vus = {};
    const groupes = [];
    voies.forEach(function (b) {
      if (Array.isArray(b.groupes_jsonb)) {
        b.groupes_jsonb.forEach(function (g) {
          if (g && g.nom && !vus[g.nom]) { vus[g.nom] = true; groupes.push(g.nom); }
        });
      }
    });

    const S = stations.length;
    const G = groupes.length;
    const idxMatchs = [];
    rolesVoies.forEach(function (r, i) { if (r === 'match') idxMatchs.push(i); });

    // Périmètre livré (a) : exactement 1 voie match, >=3 groupes, et assez
    // de groupes pour peupler le match (2) + les ateliers (S-1).
    if (G === 0) {
      return { stations: stations, rolesVoies: rolesVoies, groupes: groupes, grille: [], desequilibre: 'aucun' };
    }
    const nbAteliers = S - 1;
    if (idxMatchs.length !== 1 || G < 3 || G < (2 + nbAteliers)) {
      return { stations: stations, rolesVoies: rolesVoies, groupes: groupes, grille: [], desequilibre: 'non_simulable' };
    }

    const idxMatch = idxMatchs[0];
    // Indices des voies atelier, dans l'ordre.
    const idxAteliers = [];
    rolesVoies.forEach(function (r, i) { if (r !== 'match') idxAteliers.push(i); });

    // Rotation "qui se repose" : au tour t, la paire au match = groupes
    // d'indices (t) et (t+1) mod G. Les groupes suivants (t+2, t+3, …)
    // remplissent les ateliers dans l'ordre. Ainsi chaque groupe occupe
    // successivement match puis ateliers puis re-match → chacun passe une
    // fois par chaque rôle sur G tours. Déterministe.
    const grille = [];
    for (let t = 0; t < G; t++) {
      const ligne = new Array(S).fill(null);
      const gA = groupes[t % G];
      const gB = groupes[(t + 1) % G];
      ligne[idxMatch] = { pair: [gA, gB] };
      for (let a = 0; a < idxAteliers.length; a++) {
        const gAtel = groupes[(t + 2 + a) % G];
        ligne[idxAteliers[a]] = gAtel;
      }
      grille.push(ligne);
    }

    return { stations: stations, rolesVoies: rolesVoies, groupes: groupes, grille: grille, desequilibre: 'ok' };
  }

  /**
   * Libellé d'une cellule de matrice rencontres (écran ou PDF).
   * @param {*} cell contenu grille[t][i] : {pair:[a,b]} | string | null
   * @returns {string} texte prêt à échapper ('' si vide)
   */
  function _celluleRencontreTexte(cell) {
    if (!cell) return '';
    if (typeof cell === 'object' && Array.isArray(cell.pair)) {
      return cell.pair[0] + ' vs ' + cell.pair[1];
    }
    return String(cell);
  }

  /**
   * Rend la matrice RENCONTRES en HTML statique pour le PDF coach.
   * Calque de _matriceRotationHtmlPdf. En 'vainqueur_reste' ou config hors
   * périmètre → cadre-règle textuel, pas de matrice simulée.
   *
   * @param {object} etage étage courant (etage.blocs)
   * @param {object} circ fiche circuit (mode='rencontres')
   * @returns {string} HTML
   */
  function _matriceRencontresHtmlPdf(etage, circ) {
    const kind = (circ && circ.rotation_kind === 'vainqueur_reste') ? 'vainqueur_reste' : 'cyclique';
    if (kind === 'vainqueur_reste') {
      return '<p class="seance-print__circuit-warn">🏆 Rencontres — « vainqueur reste » : ' +
             'l\u2019équipe qui gagne conserve le terrain, l\u2019équipe qui perd cède sa place au groupe suivant. ' +
             'Rotation dépendante du résultat — pas de matrice pré-remplie.</p>';
    }
    const mat = _matriceRencontres(etage.blocs, circ);
    if (mat.desequilibre === 'aucun') return '';
    if (mat.desequilibre === 'non_simulable') {
      return '<p class="seance-print__circuit-warn">⚔️ Rencontres tournantes — configuration hors ' +
             'rotation pré-remplie (une seule voie « match » et au moins 3 groupes requis). ' +
             'Organisez les oppositions au sifflet.</p>';
    }
    const station = circ.duree_station_min || 0;
    const pause = circ.duree_pause_min || 0;
    let thead = '<tr><th>Tour</th>';
    mat.stations.forEach(function (st, i) {
      const estMatch = mat.rolesVoies[i] === 'match';
      const tag = estMatch ? ' ⚔️' : '';
      const cls = estMatch ? ' class="seance-print__circuit-match"' : '';
      thead += '<th' + cls + '>' + escapeHtml(st) + tag + '</th>';
    });
    thead += '</tr>';
    let tbody = '';
    mat.grille.forEach(function (ligne, t) {
      const debut = t * (station + pause);
      tbody += '<tr><td class="seance-print__circuit-tour">T' + (t + 1) + ' (' + debut + '\u2032)</td>';
      ligne.forEach(function (cell, i) {
        const txt = _celluleRencontreTexte(cell);
        const estMatch = mat.rolesVoies[i] === 'match';
        if (txt) {
          tbody += '<td' + (estMatch ? ' class="seance-print__circuit-match"' : '') + '>' + escapeHtml(txt) + '</td>';
        } else {
          tbody += '<td class="seance-print__circuit-vide' + (estMatch ? ' seance-print__circuit-match' : '') + '">\u2014</td>';
        }
      });
      tbody += '</tr>';
    });
    return '<table class="seance-print__circuit-matrix"><thead>' + thead +
           '</thead><tbody>' + tbody + '</tbody></table>';
  }

  /**
   * Rend la matrice RENCONTRES en HTML pour l'écran (éditeur de trame).
   * Calque du rendu inline mode circuit. Renvoie le fragment matrice
   * (sans le panneau de durée, géré par l'appelant).
   *
   * @param {object} mat retour de _matriceRencontres
   * @param {object} circ fiche circuit
   * @returns {string} HTML
   */
  function _matriceRencontresHtmlEcran(mat, circ) {
    const kind = (circ && circ.rotation_kind === 'vainqueur_reste') ? 'vainqueur_reste' : 'cyclique';
    if (kind === 'vainqueur_reste') {
      return '<p class="seance-circuit__hint">🏆 « Vainqueur reste » : l\u2019équipe gagnante conserve le ' +
             'terrain, la perdante cède sa place. Rotation selon le résultat — pas de matrice pré-remplie.</p>';
    }
    if (mat.desequilibre === 'aucun') {
      return '<p class="seance-circuit__hint">Ajoutez des groupes aux stations pour visualiser les rencontres.</p>';
    }
    if (mat.desequilibre === 'non_simulable') {
      return '<p class="seance-circuit__warn">⚔️ Configuration hors rotation pré-remplie : il faut exactement ' +
             'une voie « match » et au moins 3 groupes (dont assez pour peupler les ateliers).</p>';
    }
    const station = circ.duree_station_min || 0;
    const pause = circ.duree_pause_min || 0;
    let thead = '<tr><th class="seance-circuit__matrix-corner">Tour</th>';
    mat.stations.forEach(function (st, i) {
      const estMatch = mat.rolesVoies[i] === 'match';
      const tag = estMatch ? ' ⚔️' : '';
      const cls = estMatch ? ' seance-circuit__matrix-match' : '';
      thead += '<th class="seance-circuit__matrix-col' + cls + '">' + escapeHtml(st) + tag + '</th>';
    });
    thead += '</tr>';
    let tbody = '';
    mat.grille.forEach(function (ligne, t) {
      const debut = t * (station + pause);
      tbody += '<tr>' +
        '<td class="seance-circuit__matrix-tour">T' + (t + 1) + ' <span class="seance-circuit__matrix-min">' + debut + '\u2032</span></td>';
      ligne.forEach(function (cell, i) {
        const txt = _celluleRencontreTexte(cell);
        const m = mat.rolesVoies[i] === 'match' ? ' seance-circuit__matrix-match' : '';
        if (txt) {
          tbody += '<td class="seance-circuit__matrix-grp' + m + '">' + escapeHtml(txt) + '</td>';
        } else {
          tbody += '<td class="seance-circuit__matrix-vide' + m + '">\u2014</td>';
        }
      });
      tbody += '</tr>';
    });
    return '<div class="seance-circuit__matrix-wrap">' +
             '<table class="seance-circuit__matrix">' +
               '<thead>' + thead + '</thead>' +
               '<tbody>' + tbody + '</tbody>' +
             '</table>' +
           '</div>';
  }

  /**
   * Contrôles de saisie du mode RENCONTRES (v1.26, maillon 3). Rendu dans le
   * panneau circuit : sélecteur Circuit/Rencontres ; si rencontres, choix
   * rotation_kind (Cyclique/Vainqueur reste) + une rangée listant les voies
   * de l'étage avec un bascule de rôle (Atelier/Match) chacune. Tous les
   * contrôles portent data-etage-ordre ; les rôles portent aussi data-voie-idx.
   *
   * @param {object} etage étage courant
   * @param {object} circ fiche circuit
   * @param {Array} blocsEtage voies de l'étage (pour la rangée de rôles)
   * @returns {string} HTML
   */
  function _panneauRencontresControlsHtml(etage, circ, blocsEtage) {
    const ordreAttr = escapeHtml(etage.ordre);
    const estRencontres = circ.mode === 'rencontres';

    // Sélecteur de mode (toujours affiché quand l'étage est un circuit).
    let html =
      '<label class="seance-circuit__field seance-circuit__field--mode">' +
        '<span class="seance-circuit__field-label">Format</span>' +
        '<select class="seance-circuit__select" data-action="circuit-mode" data-etage-ordre="' + ordreAttr + '">' +
          '<option value="circuit"' + (!estRencontres ? ' selected' : '') + '>🔄 Circuit (rotation simple)</option>' +
          '<option value="rencontres"' + (estRencontres ? ' selected' : '') + '>⚔️ Rencontres tournantes</option>' +
        '</select>' +
      '</label>';

    if (!estRencontres) return html;

    // rotation_kind
    const kind = circ.rotation_kind === 'vainqueur_reste' ? 'vainqueur_reste' : 'cyclique';
    html +=
      '<label class="seance-circuit__field seance-circuit__field--kind">' +
        '<span class="seance-circuit__field-label">Rotation</span>' +
        '<select class="seance-circuit__select" data-action="circuit-rotation-kind" data-etage-ordre="' + ordreAttr + '">' +
          '<option value="cyclique"' + (kind === 'cyclique' ? ' selected' : '') + '>Cyclique (matrice)</option>' +
          '<option value="vainqueur_reste"' + (kind === 'vainqueur_reste' ? ' selected' : '') + '>Vainqueur reste (règle)</option>' +
        '</select>' +
      '</label>';

    // Rangée de rôles par voie.
    const voies = Array.isArray(blocsEtage) ? blocsEtage : [];
    let roles = '';
    voies.forEach(function (b, i) {
      const role = _roleVoie(circ, i);
      const estMatch = role === 'match';
      const t = lookupTypeBloc(b.type_bloc);
      const lib = (t && t.libelle) || b.type_bloc || 'Voie';
      const libCourt = b.titre_precision ? (lib + ' — ' + b.titre_precision) : lib;
      roles +=
        '<button type="button" class="seance-circuit__role' + (estMatch ? ' is-match' : '') + '" ' +
                'data-action="circuit-role-voie" data-etage-ordre="' + ordreAttr + '" data-voie-idx="' + i + '" ' +
                'title="' + escapeHtml('Basculer le rôle de : ' + libCourt) + '">' +
          '<span class="seance-circuit__role-lib">' + escapeHtml(libCourt) + '</span>' +
          '<span class="seance-circuit__role-tag">' + (estMatch ? '⚔️ Match' : '🛠 Atelier') + '</span>' +
        '</button>';
    });
    html +=
      '<div class="seance-circuit__roles" data-etage-ordre="' + ordreAttr + '">' +
        '<span class="seance-circuit__roles-label">Rôle des voies</span>' +
        roles +
      '</div>';

    return html;
  }

  /**
   * Nom court d'un coach à partir de son encadrant_id (v1.10).
   * Cherche dans State.staffDisponible. Renvoie '' si introuvable ou null.
   */
  function _nomCoachBloc(encadrantId) {
    if (!encadrantId) return '';
    const liste = Array.isArray(State.staffDisponible) ? State.staffDisponible : [];
    const p = liste.find(function (x) { return x.personne_id === encadrantId; });
    if (!p) return '';
    return ((p.prenom || '') + ' ' + (p.nom || '')).trim();
  }

  /**
   * Noms des coachs d'un bloc à partir de sa liste encadrants_ids (v1.13).
   * Multi-coachs : renvoie un tableau de noms (ordre de la liste). Replie
   * sur encadrant_id (déprécié) si encadrants_ids est vide mais que
   * l'ancien champ est encore renseigné (rétro-compat lecture). Un id non
   * résolu dans State.staffDisponible est rendu '⚠️ hors liste' plutôt que
   * masqué (honest degradation).
   */
  function _nomsCoachsBloc(b) {
    const liste = Array.isArray(State.staffDisponible) ? State.staffDisponible : [];
    let ids = Array.isArray(b.encadrants_ids) ? b.encadrants_ids.slice() : [];
    if (ids.length === 0 && b.encadrant_id) ids = [b.encadrant_id]; // repli déprécié
    return ids.map(function (id) {
      const p = liste.find(function (x) { return x.personne_id === id; });
      return p ? (((p.prenom || '') + ' ' + (p.nom || '')).trim() || id) : '⚠️ hors liste';
    }).filter(Boolean);
  }

  function renderTrame() {
    const area = DOM.editorArea();
    if (!area || !State.currentSeance) return;

    // Si la section existe déjà, on remplace son innerHTML pour préserver
    // les autres éléments (le form). Sinon on l'ajoute en append.
    let section = DOM.trameSection();
    if (!section) {
      section = document.createElement('section');
      section.id = 'seance-trame-section';
      section.className = 'seance-trame';
      area.appendChild(section);
    }

    const heureDebut = State.currentSeance.heure_debut
      ? normalizeHeureForInput(State.currentSeance.heure_debut)
      : null;

    // Header de section
    let html =
      '<header class="seance-trame__header">' +
        '<h3 class="seance-trame__title">Trame chronologique</h3>' +
        '<div class="seance-trame__header-actions">' +
          // v1.14 — deux exports distincts (demande recette, débrief Lohann) :
          // « PDF Coach » (complet + ateliers liés) et « PDF Joueurs » (compact).
          '<button type="button" id="seance-btn-export-pdf-coach" class="seance-trame__pdf-btn" title="Export complet pour les coachs (détails + fiches ateliers)">' +
            '🖨 PDF Coach' +
          '</button>' +
          '<button type="button" id="seance-btn-export-pdf-joueurs" class="seance-trame__pdf-btn" title="Export compact pour les joueurs">' +
            '🖨 PDF Joueurs' +
          '</button>' +
          '<button type="button" id="seance-btn-add-bloc" class="seance-trame__add-btn">' +
            '+ Ajouter un bloc' +
          '</button>' +
        '</div>' +
      '</header>';

    if (!heureDebut) {
      html +=
        '<div class="seance-trame__warning">' +
          '⚠️ Renseigne l\'heure de début dans le formulaire méta ci-dessus ' +
          'pour voir les horaires calculés automatiquement.' +
        '</div>';
    }

    if (State.blocs.length === 0) {
      html +=
        '<div class="seance-trame__empty">' +
          'Aucun bloc dans la trame.<br>' +
          'Clique sur « + Ajouter un bloc » pour démarrer.' +
        '</div>';
    } else {
      // Table 4 colonnes
      html +=
        '<table class="seance-trame__table">' +
          '<thead>' +
            '<tr>' +
              '<th class="seance-trame__th-horaire">Horaire</th>' +
              '<th class="seance-trame__th-bloc">Bloc</th>' +
              '<th class="seance-trame__th-duree">Durée</th>' +
              '<th class="seance-trame__th-actions">Actions</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>';

      let curHeure = heureDebut;

      // v1.10 (sql_108) — Rendu groupé par ÉTAGE (ordre). Un étage à 1 bloc
      // = ligne classique pleine largeur (voie 0). Un étage à ≥2 blocs =
      // voies parallèles côte à côte. Durée de l'étage = MAX des voies
      // (les blocs tournent en simultané) ; le curseur horaire avance du max.
      const etages = _grouperBlocsParEtage(State.blocs);
      etages.forEach(function (etage, idxEtage) {
        const blocsEtage = etage.blocs;       // ≥1 bloc, triés par voie
        const dureeEtage = _dureeEffectiveEtage(etage);    // circuit-aware (succession si circuit, max sinon)
        const heureCell = curHeure || '—';
        const heureFin = curHeure ? addMinutesToHeure(curHeure, dureeEtage) : '';

        const isFirst = (idxEtage === 0);
        const isLast  = (idxEtage === etages.length - 1);
        const disUp   = isFirst ? ' disabled' : '';
        const disDown = isLast  ? ' disabled' : '';
        const parallele = blocsEtage.length > 1;

        // Cellule « Bloc » : une mini-carte par voie. En parallèle, elles
        // s'affichent en colonnes (classe --parallele pilote la CSS flex).
        let cellBlocs = '<div class="seance-trame__voies' + (parallele ? ' seance-trame__voies--parallele' : '') + '">';
        blocsEtage.forEach(function (b) {
          const t = lookupTypeBloc(b.type_bloc);
          const emoji = (t && t.emoji) || '·';
          const libType = (t && t.libelle) || b.type_bloc;
          const titreCompl = b.titre_precision ? ' — ' + escapeHtml(b.titre_precision) : '';
          const coachsNoms = _nomsCoachsBloc(b);
          const coachLabel = coachsNoms.length ? coachsNoms.join(', ') : '';
          const dureeVoie = (parallele && b.duree_min !== etage.dureeMax)
            ? '<span class="seance-trame__voie-duree">' + b.duree_min + ' min</span>' : '';
          cellBlocs +=
            '<div class="seance-trame__voie seance-trame__td-bloc--clickable" ' +
                 'data-action="open-detail" data-bloc-id="' + escapeHtml(b.id) + '" ' +
                 'title="Cliquer pour éditer ce bloc en détail">' +
              '<span class="seance-trame__emoji">' + emoji + '</span> ' +
              '<span class="seance-trame__type">' + escapeHtml(libType) + '</span>' +
              '<span class="seance-trame__precision">' + titreCompl + '</span>' +
              (coachLabel ? '<span class="seance-trame__coach">👤 ' + escapeHtml(coachLabel) + '</span>' : '') +
              dureeVoie +
            '</div>';
        });
        cellBlocs += '</div>';

        // Durée affichée de l'étage (max), avec marqueur « ∥ » si parallèle.
        const dureeAffichee = dureeEtage + ' min' + (parallele ? ' <span class="seance-trame__par-tag" title="Voies parallèles : durée = la plus longue">∥</span>' : '');

        html +=
          '<tr class="seance-trame__row' + (parallele ? ' seance-trame__row--parallele' : '') + '" data-etage-ordre="' + escapeHtml(etage.ordre) + '">' +
            '<td class="seance-trame__td-horaire">' +
              '<span class="seance-trame__horaire-start">' + heureCell + '</span>' +
              (heureFin ? '<span class="seance-trame__horaire-end">→ ' + heureFin + '</span>' : '') +
            '</td>' +
            '<td class="seance-trame__td-bloc">' + cellBlocs + '</td>' +
            '<td class="seance-trame__td-duree">' + dureeAffichee + '</td>' +
            '<td class="seance-trame__td-actions">' +
              '<button type="button" class="seance-trame__action-btn" data-action="up"        data-etage-ordre="' + escapeHtml(etage.ordre) + '" title="Monter cet étage"' + disUp + '>↑</button>' +
              '<button type="button" class="seance-trame__action-btn" data-action="down"      data-etage-ordre="' + escapeHtml(etage.ordre) + '" title="Descendre cet étage"' + disDown + '>↓</button>' +
              '<button type="button" class="seance-trame__action-btn" data-action="dedoubler" data-etage-ordre="' + escapeHtml(etage.ordre) + '" title="Ajouter une voie parallèle à cet étage">⇄</button>' +
            '</td>' +
          '</tr>';

        // v1.20 (sql_241) — Ligne dépliable CIRCUIT sous un étage PARALLÈLE.
        // Un étage parallèle peut être qualifié de "circuit" (les groupes
        // tournent sur les voies). La bascule crée/supprime la fiche de marche
        // (seances_etages_circuits) ; la durée de station y est saisie.
        // Étages simples (1 voie) : pas de circuit possible → pas de ligne.
        if (parallele) {
          const circ = _circuitDeLetage(etage.ordre);
          const estCircuit = !!circ;
          const nbStations = blocsEtage.length;
          const dureeStation = circ && circ.duree_station_min ? circ.duree_station_min : '';
          const dureePause = circ && circ.duree_pause_min ? circ.duree_pause_min : 0;
          let panneau = '';
          if (estCircuit) {
            const totalCircuit = _dureeEffectiveEtage(etage);
            let matriceHtml = '';
            if (circ.mode === 'rencontres') {
              // Mode rencontres tournantes (ADDITIF) : rendu dédié, court-circuite
              // la matrice circuit ci-dessous. _matriceRotation intouché.
              matriceHtml = _matriceRencontresHtmlEcran(_matriceRencontres(blocsEtage, circ), circ);
            } else {
            const mat = _matriceRotation(blocsEtage);
            if (mat.desequilibre === 'aucun') {
              matriceHtml =
                '<p class="seance-circuit__hint">Ajoutez des groupes aux stations pour visualiser la rotation.</p>';
            } else if (mat.desequilibre === 'trop') {
              matriceHtml =
                '<p class="seance-circuit__warn">⚠️ Plus de groupes (' + mat.groupes.length + ') que de stations (' + mat.stations.length + ') : réduisez les groupes ou ajoutez des stations pour une rotation nette.</p>';
            } else {
              // Matrice temps × stations. Lignes = tours, colonnes = stations.
              let thead = '<tr><th class="seance-circuit__matrix-corner">Tour</th>';
              mat.stations.forEach(function (st) {
                thead += '<th>' + escapeHtml(st) + '</th>';
              });
              thead += '</tr>';

              const station = circ.duree_station_min || 0;
              const pause = circ.duree_pause_min || 0;
              let tbody = '';
              mat.grille.forEach(function (ligne, t) {
                const debut = t * (station + pause);
                tbody += '<tr>' +
                  '<td class="seance-circuit__matrix-tour">T' + (t + 1) + ' <span class="seance-circuit__matrix-min">' + debut + '\u2032</span></td>';
                ligne.forEach(function (nomGroupe) {
                  if (nomGroupe) {
                    tbody += '<td class="seance-circuit__matrix-grp">' + escapeHtml(nomGroupe) + '</td>';
                  } else {
                    tbody += '<td class="seance-circuit__matrix-vide">\u2014</td>';
                  }
                });
                tbody += '</tr>';
              });

              matriceHtml =
                '<div class="seance-circuit__matrix-wrap">' +
                  '<table class="seance-circuit__matrix">' +
                    '<thead>' + thead + '</thead>' +
                    '<tbody>' + tbody + '</tbody>' +
                  '</table>' +
                '</div>';
            }
            } // fin else (mode circuit) — le panneau ci-dessous est commun aux 2 modes
            panneau =
              '<div class="seance-circuit__panel">' +
                _panneauRencontresControlsHtml(etage, circ, blocsEtage) +
                '<label class="seance-circuit__field">' +
                  '<span class="seance-circuit__field-label">Durée par station</span>' +
                  '<input type="number" min="1" max="240" class="seance-circuit__duree-input" ' +
                         'data-action="circuit-duree" data-etage-ordre="' + escapeHtml(etage.ordre) + '" ' +
                         'value="' + escapeHtml(dureeStation) + '" /> ' +
                  '<span class="seance-circuit__field-unit">min</span>' +
                '</label>' +
                '<label class="seance-circuit__field">' +
                  '<span class="seance-circuit__field-label">Pause entre stations</span>' +
                  '<input type="number" min="0" max="60" class="seance-circuit__duree-input" ' +
                         'data-action="circuit-pause" data-etage-ordre="' + escapeHtml(etage.ordre) + '" ' +
                         'value="' + escapeHtml(dureePause) + '" /> ' +
                  '<span class="seance-circuit__field-unit">min</span>' +
                '</label>' +
                '<span class="seance-circuit__recap">' + nbStations + ' stations · ' + totalCircuit + ' min au total · ' + (circ.mode === 'rencontres' ? 'les équipes s\u2019affrontent' : 'les groupes tournent') + '</span>' +
              '</div>' +
              matriceHtml;
          }
          html +=
            '<tr class="seance-trame__row seance-circuit__row' + (estCircuit ? ' is-on' : '') + '" data-etage-ordre="' + escapeHtml(etage.ordre) + '">' +
              '<td class="seance-circuit__cell" colspan="4">' +
                '<label class="seance-circuit__toggle">' +
                  '<input type="checkbox" data-action="circuit-toggle" data-etage-ordre="' + escapeHtml(etage.ordre) + '"' + (estCircuit ? ' checked' : '') + ' /> ' +
                  '<span class="seance-circuit__toggle-label">🔄 Faire tourner les groupes (circuit)</span>' +
                '</label>' +
                panneau +
              '</td>' +
            '</tr>';
        }

        if (curHeure) curHeure = heureFin;
      });

      html +=
          '</tbody>' +
        '</table>';

      // Footer récap : durée totale (somme des MAX par étage) vs durée prévue.
      const dureeBlocs = etages.reduce(function (sum, e) { return sum + (_dureeEffectiveEtage(e) || 0); }, 0);
      const dureePrevue = State.currentSeance.duree_totale_min || 0;
      const ecart = dureeBlocs - dureePrevue;
      let recapClass = 'is-ok';
      let recapText = 'Total blocs : ' + dureeBlocs + ' min · Prévu : ' + dureePrevue + ' min';
      if (ecart !== 0) {
        recapClass = ecart > 0 ? 'is-over' : 'is-under';
        recapText += ' · Écart : ' + (ecart > 0 ? '+' : '') + ecart + ' min';
      }
      html +=
        '<div class="seance-trame__recap ' + recapClass + '">' +
          recapText +
        '</div>';
    }

    // Container du popover (toujours présent dans le DOM)
    html += '<div id="seance-picker-root" class="seance-picker"></div>';

    section.innerHTML = html;

    // Bind du bouton "+ Ajouter un bloc"
    const btn = DOM.btnAddBloc();
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        // v1.10 — clic « + Ajouter un bloc » hors dédoublement : on ajoute
        // en fin de trame (pas sur un étage existant). On purge toute cible
        // de dédoublement résiduelle pour éviter un effet de bord.
        State.dedoublerOrdre = null;
        togglePicker();
      });
    }

    // v1.14 — binds des deux boutons export
    const btnPdfCoach = document.getElementById('seance-btn-export-pdf-coach');
    if (btnPdfCoach) {
      btnPdfCoach.addEventListener('click', function (e) {
        e.stopPropagation();
        onExportPdfCoach();
      });
    }
    const btnPdfJoueurs = document.getElementById('seance-btn-export-pdf-joueurs');
    if (btnPdfJoueurs) {
      btnPdfJoueurs.addEventListener('click', function (e) {
        e.stopPropagation();
        onExportPdfJoueurs();
      });
    }

    // Phase 5.6.B : bind des actions ↑ ↓ 🗑 sur chaque ligne
    section.querySelectorAll('.seance-trame__action-btn').forEach(function (btnEl) {
      btnEl.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btnEl.disabled) return;
        const action = btnEl.getAttribute('data-action');
        // v1.10 — les actions opèrent désormais sur l'ÉTAGE (data-etage-ordre),
        // plus sur un bloc individuel. up/down déplacent tout l'étage ;
        // dedoubler ajoute une voie parallèle au même ordre.
        const ordre = parseInt(btnEl.getAttribute('data-etage-ordre'), 10);
        if (action === 'up')        onMoveEtageUp(ordre);
        if (action === 'down')      onMoveEtageDown(ordre);
        if (action === 'dedoubler') onDedoublerEtage(ordre);
      });
    });

    // Phase 5.7 : bind des clics open-detail sur les cellules td-bloc
    section.querySelectorAll('[data-action="open-detail"]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        const blocId = cell.getAttribute('data-bloc-id');
        onOpenBlocDetail(blocId);
      });
    });

    // v1.20 (sql_241) : bascule CIRCUIT d'un étage parallèle (checkbox).
    // Cochée → crée la fiche de marche ; décochée → la supprime.
    section.querySelectorAll('[data-action="circuit-toggle"]').forEach(function (cb) {
      cb.addEventListener('change', function (e) {
        e.stopPropagation();
        const ordre = parseInt(cb.getAttribute('data-etage-ordre'), 10);
        onToggleCircuit(ordre, cb.checked);
      });
    });

    // v1.20 : saisie de la durée de station d'un circuit (input number).
    // Persistée sur 'change' (blur / validation), pas à chaque frappe.
    section.querySelectorAll('[data-action="circuit-duree"]').forEach(function (inp) {
      inp.addEventListener('change', function (e) {
        e.stopPropagation();
        const ordre = parseInt(inp.getAttribute('data-etage-ordre'), 10);
        onChangeCircuitDuree(ordre, inp.value);
      });
      // Empêche le clic dans l'input de déclencher d'autres handlers d'étage.
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    // v1.21 : saisie de la pause entre stations (input number).
    section.querySelectorAll('[data-action="circuit-pause"]').forEach(function (inp) {
      inp.addEventListener('change', function (e) {
        e.stopPropagation();
        const ordre = parseInt(inp.getAttribute('data-etage-ordre'), 10);
        onChangeCircuitPause(ordre, inp.value);
      });
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    // v1.26 : sélecteur de format (circuit / rencontres).
    section.querySelectorAll('[data-action="circuit-mode"]').forEach(function (sel) {
      sel.addEventListener('change', function (e) {
        e.stopPropagation();
        const ordre = parseInt(sel.getAttribute('data-etage-ordre'), 10);
        onChangeCircuitMode(ordre, sel.value);
      });
      sel.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    // v1.26 : sélecteur de rotation (cyclique / vainqueur_reste).
    section.querySelectorAll('[data-action="circuit-rotation-kind"]').forEach(function (sel) {
      sel.addEventListener('change', function (e) {
        e.stopPropagation();
        const ordre = parseInt(sel.getAttribute('data-etage-ordre'), 10);
        onChangeCircuitRotationKind(ordre, sel.value);
      });
      sel.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    // v1.26 : bascule du rôle d'une voie (match / atelier).
    section.querySelectorAll('[data-action="circuit-role-voie"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        const ordre = parseInt(btn.getAttribute('data-etage-ordre'), 10);
        const idx = parseInt(btn.getAttribute('data-voie-idx'), 10);
        onToggleRoleVoie(ordre, idx);
      });
    });

    // Phase 5.7 : si on est en vue détail bloc, masquer la trame et afficher le détail
    if (State.view === 'bloc-detail' && State.currentBloc) {
      section.style.display = 'none';
      renderBlocDetail();
    } else {
      section.style.display = '';
      // Si une section detail existe et est visible, la masquer
      const detail = DOM.blocDetailSection();
      if (detail) detail.style.display = 'none';
    }
  }

  /**
   * Ouvre / ferme le picker de choix de type de bloc.
   */
  function togglePicker() {
    if (State.picker && State.picker.open) {
      closePicker();
    } else {
      openPicker();
    }
  }

  function openPicker() {
    State.picker = { open: true };
    renderPicker();
  }

  function closePicker() {
    State.picker = { open: false };
    renderPicker();
  }

  /**
   * Rend le popover de choix parmi les 11 types de bloc.
   * Affiche la liste avec emoji + libellé + durée par défaut.
   */
  function renderPicker() {
    const root = DOM.pickerRoot();
    if (!root) return;
    if (!State.picker || !State.picker.open) {
      root.innerHTML = '';
      root.classList.remove('is-open');
      return;
    }

    const types = (State.typesBlocsRef
                && State.typesBlocsRef.types_blocs
                && State.typesBlocsRef.types_blocs.valeurs) || [];

    if (types.length === 0) {
      root.innerHTML =
        '<div class="seance-picker__panel">' +
          '<div class="seance-picker__error">⚠️ Référentiel types-blocs.json non chargé.</div>' +
        '</div>';
      root.classList.add('is-open');
      return;
    }

    const items = types.map(function (t) {
      return (
        '<li class="seance-picker__item" data-slug="' + escapeHtml(t.slug) + '">' +
          '<span class="seance-picker__item-emoji">' + (t.emoji || '·') + '</span>' +
          '<span class="seance-picker__item-libelle">' + escapeHtml(t.libelle) + '</span>' +
          '<span class="seance-picker__item-defaut">' + (t.duree_min_defaut || 10) + ' min</span>' +
        '</li>'
      );
    }).join('');

    root.innerHTML =
      '<div class="seance-picker__panel" role="dialog" aria-label="Choisir un type de bloc">' +
        '<header class="seance-picker__panel-header">' +
          '<span>Choisir un type de bloc</span>' +
          '<button type="button" class="seance-picker__close" aria-label="Fermer">×</button>' +
        '</header>' +
        '<ul class="seance-picker__list">' + items + '</ul>' +
      '</div>';
    root.classList.add('is-open');

    // Bind clics
    root.querySelectorAll('.seance-picker__item').forEach(function (li) {
      li.addEventListener('click', function () {
        const slug = li.getAttribute('data-slug');
        onAddBloc(slug);
      });
    });
    const closeBtn = root.querySelector('.seance-picker__close');
    if (closeBtn) closeBtn.addEventListener('click', closePicker);
  }

  /**
   * Fermeture du picker quand on clique en dehors.
   * Câblé une seule fois à l'init.
   */
  function bindPickerOutsideClick() {
    document.addEventListener('click', function (e) {
      const root = DOM.pickerRoot();
      const btn = DOM.btnAddBloc();
      if (!root || !root.classList.contains('is-open')) return;
      if (btn && (e.target === btn || btn.contains(e.target))) return;
      if (root.contains(e.target)) return;
      closePicker();
    });
  }

  // ============================================================
  // 5.ter. RENDU DÉTAIL BLOC (Phase 5.7)
  // ============================================================

  /**
   * Récupère la liste des termes d'un axe du vocabulaire-seance.json.
   * @param {string} axeKey ex : 'axe_2_types_unites', 'axe_3_composants_echauffement', 'axe_4_champs_ffr'
   * @returns {Array} Liste de {slug, libelle}, [] si introuvable
   */
  function lookupVocabAxe(axeKey) {
    if (!State.vocabulaireRef) return [];
    const axe = State.vocabulaireRef[axeKey];
    if (!axe || !Array.isArray(axe.valeurs)) return [];
    return axe.valeurs;
  }

  /**
   * Rend la pastille autosave du détail bloc (3 états comme la séance).
   */
  function setBlocAutosaveStatus(status) {
    State.blocAutosaveStatus = status;
    const pill = DOM.blocAutosavePill();
    if (!pill) return;
    pill.classList.remove('is-idle','is-saving','is-error');
    if (status === 'saving') {
      pill.classList.add('is-saving');
      pill.textContent = '● Sauvegarde…';
    } else if (status === 'error') {
      pill.classList.add('is-error');
      pill.textContent = '● Erreur autosave';
    } else {
      pill.classList.add('is-idle');
      pill.textContent = '● Sauvé';
    }
  }

  function setBlocDirty(dirty) {
    State.blocIsDirty = !!dirty;
    const btn = DOM.blocBtnSave();
    if (btn) {
      btn.disabled = !dirty;
      btn.textContent = dirty ? '💾 Enregistrer le bloc' : '✓ Enregistré';
    }
  }

  /**
   * Construit une grille d'options pour un <select>.
   * @param {Array} valeurs Liste {slug, libelle}
   * @param {string} selectedSlug Slug actuellement sélectionné (ou null)
   * @param {string} emptyLabel Libellé de l'option vide
   */
  function buildSelectOptions(valeurs, selectedSlug, emptyLabel) {
    let html = '<option value="">— ' + escapeHtml(emptyLabel || 'Aucun') + ' —</option>';
    valeurs.forEach(function (v) {
      const sel = (v.slug === selectedSlug) ? ' selected' : '';
      html += '<option value="' + escapeHtml(v.slug) + '"' + sel + '>' + escapeHtml(v.libelle) + '</option>';
    });
    return html;
  }

  /**
   * Construit les <option> du sélecteur de coach d'un bloc (v1.10, sql_108).
   * Source : State.staffDisponible = [{personne_id, nom, prenom}] (UUID réels
   * personnes.id, fournis par la RPC list_staff_disponibles).
   * Option vide (value="") => encadrant_id NULL (collecte: val.trim()||null).
   * Si selectedId n'est plus présent dans la liste (coach retiré du staff
   * catégorie mais encore référencé en base), on l'affiche quand même en
   * tête avec une mention, pour ne jamais masquer silencieusement une
   * affectation existante (honest degradation).
   *
   * @param {string|null} selectedId encadrant_id courant du bloc
   */
  /**
   * Construit la pioche à cases à cocher des coachs d'un bloc (v1.13).
   * Multi-coachs (liste plate égalitaire, encadrants_ids uuid[]).
   * Source : State.staffDisponible. Coche les ids déjà présents dans
   * selectedIds. Un id sélectionné absent de la liste (coach retiré du
   * staff mais encore en base) est rendu coché avec mention « hors liste »
   * pour ne pas le perdre silencieusement (honest degradation).
   *
   * Chaque case porte data-coach-id (PAS data-bloc-field) : la collecte
   * générique ignore donc ces cases ; elles sont agrégées séparément en
   * encadrants_ids lors du save.
   *
   * @param {string[]} selectedIds liste courante encadrants_ids du bloc
   */
  function buildCheckboxesCoachs(selectedIds) {
    const sel = Array.isArray(selectedIds) ? selectedIds : [];
    const liste = Array.isArray(State.staffDisponible) ? State.staffDisponible : [];
    let html = '<div class="seance-coachs-pioche" id="seance-coachs-pioche">';

    if (liste.length === 0) {
      html += '<p class="seance-coachs-pioche__vide">Aucun coach disponible (pioche vide).</p>';
    } else {
      liste.forEach(function (p) {
        const id = p.personne_id;
        const nom = ((p.prenom || '') + ' ' + (p.nom || '')).trim() || id;
        const checked = sel.indexOf(id) !== -1 ? ' checked' : '';
        html +=
          '<label class="seance-coachs-pioche__item">' +
            '<input type="checkbox" class="seance-coachs-pioche__cb" data-coach-id="' + escapeHtml(id) + '"' + checked + '>' +
            '<span>' + escapeHtml(nom) + '</span>' +
          '</label>';
      });
    }

    // Coachs sélectionnés mais hors liste (conservés, cochés, signalés).
    sel.forEach(function (id) {
      const present = liste.some(function (p) { return p.personne_id === id; });
      if (!present) {
        html +=
          '<label class="seance-coachs-pioche__item seance-coachs-pioche__item--orphelin">' +
            '<input type="checkbox" class="seance-coachs-pioche__cb" data-coach-id="' + escapeHtml(id) + '" checked>' +
            '<span>⚠️ Coach hors liste (conservé)</span>' +
          '</label>';
      }
    });

    html += '</div>';
    return html;
  }

  /**
   * Rend l'éditeur détail d'un bloc dans la zone éditeur (sous le résumé
   * méta replié). Remplace la trame chronologique tant qu'on est en vue
   * 'bloc-detail'. Phase 5.7.
   */
  function renderBlocDetail() {
    const area = DOM.editorArea();
    if (!area || !State.currentBloc) return;
    const b = State.currentBloc;

    // Crée la section detail si elle n'existe pas encore
    let section = DOM.blocDetailSection();
    if (!section) {
      section = document.createElement('section');
      section.id = 'seance-bloc-detail';
      section.className = 'seance-bloc-detail';
      area.appendChild(section);
    }
    section.style.display = '';

    // Lookup type de bloc actuel
    const typeDef = lookupTypeBloc(b.type_bloc);
    const emoji = (typeDef && typeDef.emoji) || '·';
    const libType = (typeDef && typeDef.libelle) || b.type_bloc;
    const positionDansTrame = State.blocs.findIndex(function (x) { return x.id === b.id; }) + 1;

    // Décide quels champs conditionnels afficher
    const afficheIntensite   = !!(typeDef && typeDef.affiche_intensite);
    const etiquettesProp     = (typeDef && Array.isArray(typeDef.etiquettes_proposees)) ? typeDef.etiquettes_proposees : [];
    const afficheAxe2        = etiquettesProp.indexOf('axe_2') !== -1;
    const afficheAxe3        = etiquettesProp.indexOf('axe_3') !== -1;

    // Référentiels pour les dropdowns
    const typesBlocs    = (State.typesBlocsRef && State.typesBlocsRef.types_blocs && State.typesBlocsRef.types_blocs.valeurs) || [];
    const intensites    = (State.typesBlocsRef && State.typesBlocsRef.intensites && State.typesBlocsRef.intensites.valeurs) || [];
    const valeursAxe2   = lookupVocabAxe('axe_2_types_unites');
    const valeursAxe3   = lookupVocabAxe('axe_3_composants_echauffement');
    const valeursAxe4   = lookupVocabAxe('axe_4_champs_ffr');

    // Contenu pédagogique Axe 4 (jsonb)
    const axe4 = b.contenu_pedagogique_axe4 || {};

    // ----- Construction du HTML -----
    let html =
      // Header avec bouton retour + pastille + bouton save
      '<header class="seance-bloc-detail__header">' +
        '<button type="button" id="seance-bloc-btn-retour" class="seance-bloc-detail__btn-retour" title="Retour à la trame chronologique">' +
          '← Retour à la trame' +
        '</button>' +
        '<h3 class="seance-bloc-detail__title">' +
          '<span class="seance-bloc-detail__emoji">' + emoji + '</span> ' +
          '<span>Bloc ' + positionDansTrame + ' · ' + escapeHtml(libType) + '</span>' +
        '</h3>' +
        '<div class="seance-bloc-detail__header-right">' +
          '<span id="seance-bloc-autosave-pill" class="seance-autosave-pill is-idle" title="Sauvegarde automatique du bloc (30s si modifications)">● Sauvé</span>' +
          // v1.10 — suppression du bloc déplacée ici (le 🗑 de la trame a
          // cédé sa place au ⇄ « dédoubler »). Chaque bloc, voie comprise,
          // reste supprimable depuis son détail.
          '<button type="button" id="seance-bloc-btn-supprimer" class="seance-bloc-detail__btn-supprimer" title="Supprimer ce bloc">🗑 Supprimer</button>' +
        '</div>' +
      '</header>' +

      // ----- Section essentielle : type, durée, intensité, titre précision -----
      '<div class="seance-bloc-detail__grid">' +

        '<label class="seance-field">' +
          '<span class="seance-field__label">Type de bloc</span>' +
          '<select class="seance-field__input" data-bloc-field="type_bloc">' +
            typesBlocs.map(function (t) {
              const sel = (t.slug === b.type_bloc) ? ' selected' : '';
              return '<option value="' + escapeHtml(t.slug) + '"' + sel + '>' +
                       (t.emoji || '·') + ' ' + escapeHtml(t.libelle) +
                     '</option>';
            }).join('') +
          '</select>' +
        '</label>' +

        '<label class="seance-field">' +
          '<span class="seance-field__label">Durée (min)</span>' +
          '<input type="number" class="seance-field__input" data-bloc-field="duree_min" ' +
                 'min="1" max="240" step="1" ' +
                 'value="' + escapeHtml(b.duree_min || 10) + '">' +
        '</label>' +

        // Intensité : afficher conditionnellement, sinon une cellule "—"
        '<label class="seance-field' + (afficheIntensite ? '' : ' seance-field--hidden') + '">' +
          '<span class="seance-field__label">Intensité contact</span>' +
          '<select class="seance-field__input" data-bloc-field="intensite">' +
            buildSelectOptions(intensites.map(function (i) {
              return { slug: i.slug, libelle: (i.emoji || '') + ' ' + i.libelle };
            }), b.intensite, 'Non spécifiée') +
          '</select>' +
        '</label>' +

        '<label class="seance-field' + (afficheIntensite ? ' seance-field--full' : ' seance-field--full') + '">' +
          '<span class="seance-field__label">Titre / précision</span>' +
          '<input type="text" class="seance-field__input" data-bloc-field="titre_precision" ' +
                 'maxlength="200" ' +
                 'placeholder="Ex : Mobilisation articulaire avec ballon" ' +
                 'value="' + escapeHtml(b.titre_precision || '') + '">' +
        '</label>' +

        // v1.13 (sql_110) — Coachs encadrant CE bloc : MULTI (liste plate
        // encadrants_ids). Pioche à cases à cocher. data-coach-id (pas
        // data-bloc-field) -> agrégé séparément au save. Repli lecture sur
        // encadrant_id déprécié si encadrants_ids vide.
        '<div class="seance-field seance-field--full">' +
          '<span class="seance-field__label">Coachs encadrant (ce bloc)</span>' +
          buildCheckboxesCoachs(
            (Array.isArray(b.encadrants_ids) && b.encadrants_ids.length)
              ? b.encadrants_ids
              : (b.encadrant_id ? [b.encadrant_id] : [])
          ) +
        '</div>' +

      '</div>';

    // ----- Section étiquettes (Axe 2 et/ou Axe 3) conditionnelle -----
    if (afficheAxe2 || afficheAxe3) {
      html +=
        '<details class="seance-bloc-detail__details" open>' +
          '<summary class="seance-bloc-detail__details-summary">Étiquettes contextuelles</summary>' +
          '<div class="seance-bloc-detail__grid">';

      if (afficheAxe2) {
        html +=
          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Type d\'unité (Axe 2)</span>' +
            '<select class="seance-field__input" data-bloc-field="etiquette_axe2">' +
              buildSelectOptions(valeursAxe2, b.etiquette_axe2, 'Non spécifié') +
            '</select>' +
          '</label>';
      }
      if (afficheAxe3) {
        html +=
          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Composant d\'échauffement (Axe 3)</span>' +
            '<select class="seance-field__input" data-bloc-field="etiquette_axe3">' +
              buildSelectOptions(valeursAxe3, b.etiquette_axe3, 'Non spécifié') +
            '</select>' +
          '</label>';
      }
      html +=
          '</div>' +
        '</details>';
    }

    // ----- Section Contenu pédagogique (Axe 4 : 10 champs FFR) -----
    html +=
      '<details class="seance-bloc-detail__details" open>' +
        '<summary class="seance-bloc-detail__details-summary">Contenu pédagogique (10 champs FFR · Axe 4)</summary>' +
        '<div class="seance-bloc-detail__grid">';

    valeursAxe4.forEach(function (champ) {
      const value = axe4[champ.slug] || '';
      // Phase 5.12 : tous les champs Axe 4 deviennent des input mono-ligne
      // avec datalist HTML5 (propositions issues de propositions-seance.json).
      // Le coach peut toujours taper du texte libre.
      html +=
        '<label class="seance-field seance-field--full">' +
          '<span class="seance-field__label">' + escapeHtml(champ.libelle) + '</span>' +
          '<input type="text" class="seance-field__input" ' +
                 'list="' + datalistIdForSlug(champ.slug) + '" ' +
                 'data-bloc-field-axe4="' + escapeHtml(champ.slug) + '" ' +
                 'maxlength="1000" ' +
                 'placeholder="Tape ou choisis dans la liste…" ' +
                 'value="' + escapeHtml(value) + '">' +
          renderDatalist(champ.slug) +
        '</label>';
    });

    html +=
        '</div>' +
      '</details>';

    // ----- Section Autres (libre) -----
    html +=
      '<details class="seance-bloc-detail__details">' +
        '<summary class="seance-bloc-detail__details-summary">Autres champs (organisation, notes…)</summary>' +
        '<div class="seance-bloc-detail__grid">' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Comportements attendus</span>' +
            '<input type="text" class="seance-field__input" ' +
                   'list="' + datalistIdForSlug('comportements_attendus') + '" ' +
                   'data-bloc-field="comportements_attendus" maxlength="500" ' +
                   'value="' + escapeHtml(b.comportements_attendus || '') + '">' +
            renderDatalist('comportements_attendus') +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Organisation spatio-temporelle</span>' +
            '<input type="text" class="seance-field__input" ' +
                   'list="' + datalistIdForSlug('organisation_spatio_temporelle') + '" ' +
                   'data-bloc-field="organisation_spatio_temporelle" maxlength="500" ' +
                   'value="' + escapeHtml(b.organisation_spatio_temporelle || '') + '">' +
            renderDatalist('organisation_spatio_temporelle') +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Notes / commentaires</span>' +
            '<textarea class="seance-field__input seance-field__textarea" ' +
                      'data-bloc-field="notes_bloc" rows="2" maxlength="1000">' +
              escapeHtml(b.notes_bloc || '') +
            '</textarea>' +
          '</label>' +

        '</div>' +
      '</details>';

    // ----- Phase 5.8 : Section "Ateliers rattachés" -----
    // Rendue à part dans renderAteliersSection() pour pouvoir la re-render
    // sans toucher au reste du formulaire après attach/detach.
    html +=
      '<div id="seance-ateliers-section" class="seance-ateliers-section">' +
        renderAteliersSectionInner() +
      '</div>';

    // ----- Phase 5.9 : Section "Groupes" (G1/G2/G3) -----
    // Idem : rendue à part dans renderGroupesSection() pour ré-render isolé
    // après modification d'un groupe via le popover joueurs.
    html +=
      '<div id="seance-groupes-section" class="seance-groupes-section">' +
        renderGroupesSectionInner() +
      '</div>';

    // ----- Footer : bouton save + hint -----
    html +=
      '<div class="seance-bloc-detail__footer">' +
        '<button type="button" id="seance-bloc-btn-save" class="seance-form__save-btn">' +
          '✓ Enregistré' +
        '</button>' +
        '<span class="seance-form__hint">' +
          'Phase 5.7 · Sauvegarde manuelle + autosave 30s du bloc' +
        '</span>' +
      '</div>';

    // ----- Phase 5.8 : Racine modale picker fiche (vide par défaut) -----
    html += '<div id="seance-picker-fiche-root"></div>';

    // ----- Phase 5.9 : Racine popover picker joueurs (vide par défaut) -----
    html += '<div id="seance-picker-groupe-root"></div>';

    section.innerHTML = html;

    // ----- Binds -----
    const btnRetour = DOM.blocBtnRetour();
    if (btnRetour) btnRetour.addEventListener('click', onCloseBlocDetail);

    // v1.10 — bouton supprimer le bloc courant (confirmation dans onRemoveBloc),
    // puis retour à la trame.
    const btnSupprBloc = document.getElementById('seance-bloc-btn-supprimer');
    if (btnSupprBloc) {
      btnSupprBloc.addEventListener('click', async function () {
        const id = State.currentBloc && State.currentBloc.id;
        if (!id) return;
        await onRemoveBloc(id);
        // Si la suppression a réussi, le bloc n'est plus dans State.blocs.
        const encore = State.blocs.some(function (b) { return b.id === id; });
        if (!encore) onCloseBlocDetail();
      });
    }

    const btnSave = DOM.blocBtnSave();
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.addEventListener('click', onSaveBloc);
    }

    // Bind dirty sur tous les champs du bloc
    DOM.blocInputs().forEach(function (el) {
      el.addEventListener('input',  function () { setBlocDirty(true); });
      el.addEventListener('change', function () { setBlocDirty(true); });
    });

    // v1.13 — dirty sur les cases à cocher coachs (hors data-bloc-field)
    document.querySelectorAll('.seance-coachs-pioche__cb').forEach(function (cb) {
      cb.addEventListener('change', function () { setBlocDirty(true); });
    });

    // Phase 5.8 : binds section ateliers
    bindAteliersSection();

    // Phase 5.9 : binds section groupes
    bindGroupesSection();
  }

  // ============================================================
  // 5.bis  PHASE 5.8 — PICKER ATELIERS BIBLIOTHÈQUE
  // ============================================================

  /**
   * Helper : lookup d'une fiche dans le miroir Bibliothèque par fileId_dossier.
   * Renvoie l'objet complet (source, cartouche, pedagogie, media, files) ou null.
   */
  function lookupFiche(fileIdDossier) {
    if (!State.fichesRef || !fileIdDossier) return null;
    return State.fichesRef[fileIdDossier] || null;
  }

  /**
   * Helper : libellé court d'une fiche pour affichage (titre ou nom_fiche fallback).
   * Concatène titre + thème si dispo.
   */
  function libelleFicheCourt(fiche) {
    if (!fiche) return '— fiche introuvable —';
    const titre = (fiche.cartouche && fiche.cartouche.titre) ? fiche.cartouche.titre.trim() : '';
    const nom   = (fiche.source && fiche.source.nom_fiche) ? fiche.source.nom_fiche.trim() : '';
    return titre || nom || '(sans titre)';
  }

  /**
   * Helper : URL Drive du dossier d'une fiche.
   */
  function urlDriveDossier(fileIdDossier) {
    return 'https://drive.google.com/drive/folders/' + fileIdDossier;
  }

  /**
   * Helper : normalise un texte pour recherche insensible aux accents/casse.
   */
  function normalizeForSearch(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Rendu HTML interne de la section "Ateliers rattachés".
   * Séparé de renderBlocDetail pour pouvoir être appelé seul après attach/detach.
   */
  function renderAteliersSectionInner() {
    const rattachements = State.ateliersRattaches || [];
    const fichesAvailable = State.fichesRef !== null;

    let html =
      '<div class="seance-ateliers-section__header">' +
        '<h3 class="seance-ateliers-section__title">' +
          '📚 Ateliers rattachés (' + rattachements.length + ')' +
        '</h3>' +
        '<button type="button" id="seance-btn-add-atelier" ' +
                'class="seance-form__save-btn"' +
                (fichesAvailable ? '' : ' disabled title="Bibliothèque non chargée — vérifier data/fiches-all.json"') +
                '>' +
          '+ Rattacher un atelier' +
        '</button>' +
      '</div>';

    if (rattachements.length === 0) {
      html +=
        '<p class="seance-ateliers-section__empty">' +
          'Aucun atelier rattaché à ce bloc. Clique sur ' +
          '<strong>+ Rattacher un atelier</strong> pour piocher dans la Bibliothèque.' +
        '</p>';
      return html;
    }

    if (!fichesAvailable) {
      html +=
        '<p class="seance-ateliers-section__empty seance-ateliers-section__empty--warn">' +
          '⚠️ Bibliothèque (data/fiches-all.json) non chargée — affichage minimal.' +
        '</p>';
    }

    html += '<ul id="seance-ateliers-list" class="seance-ateliers-list">';
    rattachements.forEach(function (rat) {
      const fiche = lookupFiche(rat.atelier_fileid_drive);
      const titre = libelleFicheCourt(fiche);
      const theme = (fiche && fiche.cartouche && fiche.cartouche.theme)
        ? fiche.cartouche.theme : '';
      const niveau = (fiche && fiche.cartouche && fiche.cartouche.niveau)
        ? fiche.cartouche.niveau : '';
      const duree  = (fiche && fiche.cartouche && fiche.cartouche.duree)
        ? fiche.cartouche.duree : '';
      const driveUrl = urlDriveDossier(rat.atelier_fileid_drive);

      html +=
        '<li class="seance-ateliers-list__item">' +
          '<div class="seance-ateliers-list__main">' +
            '<div class="seance-ateliers-list__titre">' +
              escapeHtml(titre) +
            '</div>' +
            '<div class="seance-ateliers-list__meta">';
      if (theme)  html += '<span class="seance-ateliers-list__chip">' + escapeHtml(theme) + '</span>';
      if (niveau) html += '<span class="seance-ateliers-list__chip">' + escapeHtml(niveau) + '</span>';
      if (duree)  html += '<span class="seance-ateliers-list__chip">⏱ ' + escapeHtml(duree) + '</span>';
      html +=
            '</div>' +
          '</div>' +
          '<div class="seance-ateliers-list__actions">' +
            '<a href="' + driveUrl + '" target="_blank" rel="noopener" ' +
              'class="seance-ateliers-list__btn seance-ateliers-list__btn--drive" ' +
              'title="Ouvrir le dossier Drive">📂 Drive</a>' +
            '<button type="button" ' +
              'class="seance-ateliers-list__btn seance-ateliers-list__btn--remove" ' +
              'data-rattachement-id="' + escapeHtml(rat.id) + '" ' +
              'title="Détacher cet atelier">🗑</button>' +
          '</div>' +
        '</li>';
    });
    html += '</ul>';

    return html;
  }

  /**
   * Re-rend la section "Ateliers rattachés" seule et re-bind ses handlers.
   * Appelé après attach/detach. N'affecte ni le formulaire bloc ni l'autosave.
   */
  function renderAteliersSection() {
    const section = DOM.ateliersSection();
    if (!section) return;
    section.innerHTML = renderAteliersSectionInner();
    bindAteliersSection();
  }

  /**
   * Bind les boutons de la section "Ateliers rattachés".
   * - Bouton "+ Rattacher un atelier" → ouvre la modale picker.
   * - Boutons 🗑 par item → détachement.
   */
  function bindAteliersSection() {
    const btnAdd = DOM.btnAddAtelier();
    if (btnAdd) btnAdd.addEventListener('click', openFichePicker);

    const list = DOM.ateliersList();
    if (list) {
      list.querySelectorAll('.seance-ateliers-list__btn--remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const rattId = btn.getAttribute('data-rattachement-id');
          onDetachAtelier(rattId);
        });
      });
    }
  }

  /**
   * Ouvre la modale picker fiche (Phase 5.8).
   * Liste les 62 fiches de la Bibliothèque avec champ recherche en haut.
   */
  function openFichePicker() {
    if (!State.fichesRef) {
      window.alert('La Bibliothèque (data/fiches-all.json) n\'est pas chargée.\n' +
                   'Vérifie la console et le déploiement du miroir.');
      return;
    }
    State.fichePicker = { open: true, query: '' };
    renderFichePicker();
    // Échap pour fermer
    document.addEventListener('keydown', onFichePickerEsc);
  }

  /**
   * Ferme la modale picker fiche.
   */
  function closeFichePicker() {
    State.fichePicker = null;
    const root = DOM.pickerFicheRoot();
    if (root) root.innerHTML = '';
    document.removeEventListener('keydown', onFichePickerEsc);
  }

  /**
   * Handler keydown pour fermer le picker à Échap.
   */
  function onFichePickerEsc(e) {
    if (e.key === 'Escape') closeFichePicker();
  }

  /**
   * Rend la modale picker fiche (overlay + contenu).
   * Re-rendu à chaque frappe dans le champ recherche.
   */
  function renderFichePicker() {
    const root = DOM.pickerFicheRoot();
    if (!root) return;
    if (!State.fichePicker || !State.fichePicker.open) {
      root.innerHTML = '';
      return;
    }

    const query = State.fichePicker.query || '';
    const qNorm = normalizeForSearch(query);

    // Filtre les fiches
    const allEntries = Object.entries(State.fichesRef || {});
    const fichesFiltrees = qNorm.length === 0
      ? allEntries
      : allEntries.filter(function (entry) {
          const fiche = entry[1];
          const fields = [
            fiche.source && fiche.source.nom_fiche,
            fiche.cartouche && fiche.cartouche.titre,
            fiche.cartouche && fiche.cartouche.theme,
            fiche.cartouche && fiche.cartouche.niveau
          ];
          return fields.some(function (f) {
            return f && normalizeForSearch(f).indexOf(qNorm) !== -1;
          });
        });

    // IDs des fiches déjà rattachées (pour griser ces lignes)
    const dejaRattaches = new Set(
      (State.ateliersRattaches || []).map(function (r) { return r.atelier_fileid_drive; })
    );

    let html =
      '<div class="seance-picker-fiche__overlay" id="seance-picker-fiche-overlay">' +
        '<div class="seance-picker-fiche__modal" role="dialog" aria-modal="true">' +
          '<div class="seance-picker-fiche__header">' +
            '<h3 class="seance-picker-fiche__title">' +
              '📚 Bibliothèque — choisir une fiche atelier' +
            '</h3>' +
            '<button type="button" id="seance-picker-fiche-close" ' +
                    'class="seance-picker-fiche__close" title="Fermer (Échap)">✕</button>' +
          '</div>' +
          '<div class="seance-picker-fiche__search">' +
            '<input type="text" id="seance-picker-fiche-query" ' +
                   'class="seance-picker-fiche__input" ' +
                   'placeholder="🔍 Rechercher (nom, titre, thème, niveau)…" ' +
                   'value="' + escapeHtml(query) + '" ' +
                   'autocomplete="off">' +
            '<span class="seance-picker-fiche__count">' +
              fichesFiltrees.length + ' / ' + allEntries.length + ' fiches' +
            '</span>' +
          '</div>' +
          '<div class="seance-picker-fiche__list-wrap">';

    if (fichesFiltrees.length === 0) {
      html += '<p class="seance-picker-fiche__empty">Aucune fiche ne correspond à cette recherche.</p>';
    } else {
      html += '<ul class="seance-picker-fiche__list">';
      fichesFiltrees.forEach(function (entry) {
        const fileId = entry[0];
        const fiche  = entry[1];
        const titre  = libelleFicheCourt(fiche);
        const theme  = (fiche.cartouche && fiche.cartouche.theme)  ? fiche.cartouche.theme  : '';
        const niveau = (fiche.cartouche && fiche.cartouche.niveau) ? fiche.cartouche.niveau : '';
        const duree  = (fiche.cartouche && fiche.cartouche.duree)  ? fiche.cartouche.duree  : '';
        const isDeja = dejaRattaches.has(fileId);

        html +=
          '<li class="seance-picker-fiche__item' + (isDeja ? ' seance-picker-fiche__item--deja' : '') + '" ' +
              'data-fileid="' + escapeHtml(fileId) + '"' +
              (isDeja ? ' title="Déjà rattaché à ce bloc"' : '') + '>' +
            '<div class="seance-picker-fiche__item-titre">' +
              escapeHtml(titre) +
              (isDeja ? ' <span class="seance-picker-fiche__badge-deja">déjà rattaché</span>' : '') +
            '</div>' +
            '<div class="seance-picker-fiche__item-meta">';
        if (theme)  html += '<span class="seance-ateliers-list__chip">' + escapeHtml(theme)  + '</span>';
        if (niveau) html += '<span class="seance-ateliers-list__chip">' + escapeHtml(niveau) + '</span>';
        if (duree)  html += '<span class="seance-ateliers-list__chip">⏱ ' + escapeHtml(duree) + '</span>';
        html +=
            '</div>' +
          '</li>';
      });
      html += '</ul>';
    }

    html +=
          '</div>' +
        '</div>' +
      '</div>';

    root.innerHTML = html;

    // ----- Binds modale -----
    const overlay = document.getElementById('seance-picker-fiche-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeFichePicker(); // clic sur overlay = fermer
      });
    }
    const btnClose = document.getElementById('seance-picker-fiche-close');
    if (btnClose) btnClose.addEventListener('click', closeFichePicker);

    const inputQuery = document.getElementById('seance-picker-fiche-query');
    if (inputQuery) {
      inputQuery.addEventListener('input', function () {
        if (!State.fichePicker) return;
        State.fichePicker.query = inputQuery.value;
        renderFichePicker();
        // Restaurer le focus + position curseur après re-render
        const newInput = document.getElementById('seance-picker-fiche-query');
        if (newInput) {
          newInput.focus();
          const len = newInput.value.length;
          newInput.setSelectionRange(len, len);
        }
      });
      // Auto-focus à l'ouverture
      setTimeout(function () { inputQuery.focus(); }, 0);
    }

    // Click sur un item → rattacher
    document.querySelectorAll('.seance-picker-fiche__item').forEach(function (item) {
      item.addEventListener('click', function () {
        const fileId = item.getAttribute('data-fileid');
        if (item.classList.contains('seance-picker-fiche__item--deja')) {
          window.alert('Cet atelier est déjà rattaché à ce bloc.');
          return;
        }
        onAttachAtelier(fileId);
      });
    });
  }

  /**
   * Rattache une fiche au bloc courant via attachAtelierToBloc().
   * Recharge la liste des rattachements + re-render la section + ferme le picker.
   */
  async function onAttachAtelier(fileIdDossier) {
    if (!State.currentBloc) return;
    if (!fileIdDossier) return;

    const res = await SupabaseHub.attachAtelierToBloc(
      State.currentBloc.id,
      fileIdDossier
    );
    if (!res.ok) {
      window.alert('Échec du rattachement :\n' + (res.error || 'erreur inconnue'));
      return;
    }
    // Recharger la liste depuis la DB pour avoir l'ordre + id de la nouvelle ligne
    State.ateliersRattaches = await SupabaseHub.listAteliersRattachesAuBloc(
      State.currentBloc.id
    );
    renderAteliersSection();
    closeFichePicker();
    showFeedback('Atelier rattaché ✓', 'success');
  }

  /**
   * Détache un atelier (DELETE de la ligne seances_blocs_ateliers par id).
   * Confirmation utilisateur, puis reload + re-render.
   */
  async function onDetachAtelier(rattachementId) {
    if (!rattachementId) return;
    const ok = window.confirm('Détacher cet atelier du bloc ?\n\n' +
                              '(La fiche reste dans la Bibliothèque, seul ce rattachement sera supprimé.)');
    if (!ok) return;

    const res = await SupabaseHub.detachAtelierFromBloc(rattachementId);
    if (!res.ok) {
      window.alert('Échec du détachement :\n' + (res.error || 'erreur inconnue'));
      return;
    }
    // Recharger la liste depuis la DB
    if (State.currentBloc) {
      State.ateliersRattaches = await SupabaseHub.listAteliersRattachesAuBloc(
        State.currentBloc.id
      );
    }
    renderAteliersSection();
    showFeedback('Atelier détaché ✓', 'success');
  }

  // ============================================================
  // 5.ter  PHASE 5.9 — GROUPES G1/G2/G3 PAR BLOC
  // ============================================================

  /**
   * Helper : retourne le libellé enrichi d'un groupe à partir de son nom
   * court (G1, G2, G3). Mappe sur les 3 groupes du référentiel par ordre
   * croissant : G1=Performance, G2=Développement, G3=Initiation.
   * Tolère un référentiel partiel (fallback sur le nom court).
   */
  // v1.22 — LIBÉRATION DES GROUPES (D3). Les groupes ne sont plus 3 fixes
  // (G1/G2/G3 mappés au référentiel) mais librement nommés et en nombre
  // variable (0..N), stockés tels quels dans groupes_jsonb. Le référentiel
  // groupes-joueur.json ne sert plus que de SUGGESTIONS de nom.

  /**
   * Palette cyclique de couleurs de groupe, indexée par POSITION (choix A).
   * Prévisible et stable au re-render (l'ordre des groupes est stable).
   * @param {number} idx position du groupe (0-based)
   * @returns {string} couleur hex
   */
  function _couleurGroupeParIndex(idx) {
    var PALETTE = ['#8B0000', '#FF8C00', '#4682B4', '#2D7D46', '#6A4C93', '#B8860B', '#008080', '#A0522D'];
    var i = (typeof idx === 'number' && idx >= 0) ? (idx % PALETTE.length) : 0;
    return PALETTE[i];
  }

  /**
   * Helper : normalise un nom court de joueur ("Dupont J.").
   */
  function libelleJoueurCourt(joueur) {
    if (!joueur) return '— joueur inconnu —';
    const nom = (joueur.nom || '').trim();
    const prenom = (joueur.prenom || '').trim();
    return prenom + ' ' + nom;
  }

  /**
   * Helper : récupère les groupes du bloc courant (lecture depuis State.currentBloc).
   * Retourne toujours un tableau de 3 entrées (G1, G2, G3), avec joueurs vides
   * pour les groupes non encore définis. Garantit l'invariant attendu par l'UI.
   */
  function getGroupesCourants() {
    // v1.22 : groupes LIBRES. On retourne les groupes stockés tels quels
    // (0..N, noms libres), sans plus forcer le triplet G1/G2/G3. Copie
    // défensive des tableaux de joueurs pour ne pas muter State directement.
    const stored = (State.currentBloc && Array.isArray(State.currentBloc.groupes_jsonb))
      ? State.currentBloc.groupes_jsonb
      : [];
    return stored
      .filter(function (g) { return g && typeof g.nom === 'string'; })
      .map(function (g) {
        return {
          nom: g.nom,
          joueurs: Array.isArray(g.joueurs) ? g.joueurs.slice() : []
        };
      });
  }

  /**
   * Helper : Set des joueur_id placés dans un autre groupe que celui passé.
   * Sert à griser les joueurs déjà pris dans le popover (unicité par bloc).
   */
  function getJoueursPlacesDansAutresGroupes(nomGroupeCible) {
    const set = new Set();
    getGroupesCourants().forEach(function (g) {
      if (g.nom !== nomGroupeCible) {
        g.joueurs.forEach(function (uid) { set.add(uid); });
      }
    });
    return set;
  }

  /**
   * Helper : Set des joueur_id du groupe cible (= déjà cochés dans ce popover).
   */
  function getJoueursDansGroupe(nomGroupeCible) {
    const set = new Set();
    getGroupesCourants().forEach(function (g) {
      if (g.nom === nomGroupeCible) {
        g.joueurs.forEach(function (uid) { set.add(uid); });
      }
    });
    return set;
  }

  /**
   * Rendu HTML interne de la section "Groupes".
   * 3 cartes (G1/G2/G3), chacune avec son badge couleur, son compteur,
   * la liste compacte des joueurs assignés, et un bouton "+ Ajouter…".
   */
  function renderGroupesSectionInner() {
    const groupes = getGroupesCourants();
    const vivierTotal = State.vivier ? State.vivier.length : 0;
    const totalPlaces = groupes.reduce(function (acc, g) { return acc + g.joueurs.length; }, 0);

    let html =
      '<div class="seance-groupes-section__header">' +
        '<h3 class="seance-groupes-section__title">' +
          '👥 Groupes (' + totalPlaces + ' / ' + vivierTotal + ' joueurs placés)' +
        '</h3>' +
      '</div>';

    if (!State.vivier || State.vivier.length === 0) {
      html +=
        '<p class="seance-groupes-section__empty seance-groupes-section__empty--warn">' +
          '⚠️ Vivier vide ou non chargé — vérifier la RPC get_vivier_compo_categorie.' +
        '</p>';
      return html;
    }

    html += '<div class="seance-groupes-grid">';
    groupes.forEach(function (g, idx) {
      const couleur = _couleurGroupeParIndex(idx);

      html +=
        '<div class="seance-groupe-card" data-groupe-idx="' + idx + '" ' +
              'style="border-color: ' + escapeHtml(couleur) + ';">' +
          '<div class="seance-groupe-card__header" ' +
                'style="background: ' + escapeHtml(couleur) + ';">' +
            '<input type="text" class="seance-groupe-card__nom-input" ' +
                   'data-action="rename-groupe" data-groupe-idx="' + idx + '" ' +
                   'value="' + escapeHtml(g.nom) + '" ' +
                   'placeholder="Nom du groupe" maxlength="40" ' +
                   'title="Renommer ce groupe" /> ' +
            '<span class="seance-groupe-card__count">' + g.joueurs.length + '</span>' +
            '<button type="button" class="seance-groupe-card__del-groupe" ' +
                    'data-action="remove-groupe" data-groupe-idx="' + idx + '" ' +
                    'title="Supprimer ce groupe">🗑</button>' +
          '</div>' +
          '<div class="seance-groupe-card__body">';

      if (g.joueurs.length === 0) {
        html += '<p class="seance-groupe-card__empty">Aucun joueur assigné.</p>';
      } else {
        html += '<ul class="seance-groupe-card__list">';
        g.joueurs.forEach(function (uid) {
          const j = State.vivierById ? State.vivierById.get(uid) : null;
          const nom = libelleJoueurCourt(j);
          html +=
            '<li class="seance-groupe-card__item">' +
              '<span class="seance-groupe-card__joueur">' + escapeHtml(nom) + '</span>' +
              '<button type="button" class="seance-groupe-card__remove" ' +
                      'data-groupe-idx="' + idx + '" ' +
                      'data-joueur-id="' + escapeHtml(uid) + '" ' +
                      'title="Retirer du groupe">\u2715</button>' +
            '</li>';
        });
        html += '</ul>';
      }

      html +=
            '<button type="button" class="seance-groupe-card__add" ' +
                    'data-groupe-idx="' + idx + '">' +
              '+ Ajouter\u2026' +
            '</button>' +
          '</div>' +
        '</div>';
    });

    // Bouton d'ajout d'un nouveau groupe (0..N, choix D3). Groupe cree vide,
    // nomme ensuite librement (les suggestions de nom ont ete retirees en
    // v1.24 a la demande de Manu).
    html +=
      '<div class="seance-groupes-add">' +
        '<button type="button" class="seance-groupes-add__btn" data-action="add-groupe">' +
          '\u2795 Ajouter un groupe' +
        '</button>' +
      '</div>';

    html += '</div>';

    return html;
  }

  /**
   * Re-rend la section "Groupes" seule et re-bind ses handlers.
   * Appelé après chaque modification d'un groupe (ajout/retrait joueur).
   * Ne touche ni au reste du formulaire bloc ni à l'autosave principal.
   */
  function renderGroupesSection() {
    const section = DOM.groupesSection();
    if (!section) return;
    section.innerHTML = renderGroupesSectionInner();
    bindGroupesSection();
  }

  /**
   * Bind les boutons de la section "Groupes" :
   * - "+ Ajouter…" par carte → ouvre le popover joueurs pour ce groupe
   * - "✕" par joueur → retrait du groupe
   */
  function bindGroupesSection() {
    const section = DOM.groupesSection();
    if (!section) return;

    // "+ Ajouter…" (joueurs) d'une carte → popover joueurs. Résolution
    // index→nom au clic (le popover fonctionne par nom). Un groupe sans nom
    // ne peut pas recevoir de joueurs (on invite d'abord à le nommer).
    section.querySelectorAll('.seance-groupe-card__add').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-groupe-idx'), 10);
        const groupes = getGroupesCourants();
        const g = groupes[idx];
        if (!g || !g.nom || !g.nom.trim()) {
          showFeedback('Nommez d\'abord ce groupe.', 'error');
          return;
        }
        openGroupePicker(g.nom);
      });
    });

    // "✕" sur un joueur → retrait (résolution index→nom).
    section.querySelectorAll('.seance-groupe-card__remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-groupe-idx'), 10);
        const joueurId = btn.getAttribute('data-joueur-id');
        const groupes = getGroupesCourants();
        const g = groupes[idx];
        if (g && g.nom) onRemoveJoueurFromGroupe(g.nom, joueurId);
      });
    });

    // v1.22 : renommer un groupe (input nom). Persiste sur 'change' (blur).
    section.querySelectorAll('[data-action="rename-groupe"]').forEach(function (inp) {
      inp.addEventListener('change', function (e) {
        e.stopPropagation();
        const idx = parseInt(inp.getAttribute('data-groupe-idx'), 10);
        onRenameGroupe(idx, inp.value);
      });
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    // v1.22 : supprimer un groupe entier.
    section.querySelectorAll('[data-action="remove-groupe"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-groupe-idx'), 10);
        onRemoveGroupe(idx);
      });
    });

    // v1.22 : ajouter un groupe vide.
    section.querySelectorAll('[data-action="add-groupe"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        onAddGroupe('');
      });
    });

  }

  /**
   * Ouvre le popover joueurs pour un groupe donné.
   * 3 popovers indépendants (un par G1/G2/G3). Pattern modale calqué sur
   * le picker fiche (Phase 5.8) : overlay sombre, modale centrée, champ
   * recherche, liste filtrée, fermeture par Échap/overlay/croix.
   */
  function openGroupePicker(nomGroupe) {
    if (!State.vivier || State.vivier.length === 0) {
      window.alert('Vivier non chargé — impossible d\'ouvrir le sélecteur.');
      return;
    }
    State.groupePicker = { open: true, nomGroupe: nomGroupe, query: '' };
    renderGroupePicker();
    document.addEventListener('keydown', onGroupePickerEsc);
  }

  function closeGroupePicker() {
    State.groupePicker = null;
    const root = DOM.pickerGroupeRoot();
    if (root) root.innerHTML = '';
    document.removeEventListener('keydown', onGroupePickerEsc);
  }

  function onGroupePickerEsc(e) {
    if (e.key === 'Escape') closeGroupePicker();
  }

  /**
   * Rend le popover picker joueurs.
   * Re-rendu à chaque frappe dans le champ recherche (avec restauration du focus).
   * Phase 5.12 : restaure aussi le scrollTop de la liste après re-render
   * (sinon la liste remonte à chaque coche, bug d'ergonomie remonté en V1).
   */
  function renderGroupePicker() {
    const root = DOM.pickerGroupeRoot();
    if (!root) return;
    if (!State.groupePicker || !State.groupePicker.open) {
      root.innerHTML = '';
      return;
    }

    // Phase 5.12 : sauvegarde du scrollTop AVANT re-render (s'il existe déjà)
    const oldList = root.querySelector('.seance-picker-groupe__list-wrap');
    const savedScrollTop = oldList ? oldList.scrollTop : 0;

    const nomGroupe = State.groupePicker.nomGroupe;
    const query = State.groupePicker.query || '';
    const qNorm = normalizeForSearch(query);

    // v1.22 : groupes libres — le nom EST le libellé ; la couleur vient de
    // la POSITION du groupe dans la liste courante (palette cyclique).
    const _grpIdx = getGroupesCourants().findIndex(function (g) { return g.nom === nomGroupe; });
    const couleur = _couleurGroupeParIndex(_grpIdx >= 0 ? _grpIdx : 0);
    const libelle = nomGroupe;

    // Filtre par recherche (nom + prénom + niveau_profil + poste éventuel)
    const allJoueurs = State.vivier || [];
    const joueursFiltres = qNorm.length === 0
      ? allJoueurs
      : allJoueurs.filter(function (j) {
          const fields = [j.nom, j.prenom, j.niveau_profil, j.poste, j.poste_libelle];
          return fields.some(function (f) {
            return f && normalizeForSearch(f).indexOf(qNorm) !== -1;
          });
        });

    const dansCeGroupe   = getJoueursDansGroupe(nomGroupe);
    const dansAutresGrp  = getJoueursPlacesDansAutresGroupes(nomGroupe);

    let html =
      '<div class="seance-picker-groupe__overlay" id="seance-picker-groupe-overlay">' +
        '<div class="seance-picker-groupe__modal" role="dialog" aria-modal="true">' +
          '<div class="seance-picker-groupe__header" style="background: ' + escapeHtml(couleur) + ';">' +
            '<h3 class="seance-picker-groupe__title">' +
              '👥 Groupe ' + escapeHtml(nomGroupe) +
            '</h3>' +
            '<button type="button" id="seance-picker-groupe-close" ' +
                    'class="seance-picker-groupe__close" title="Fermer (Échap)">✕</button>' +
          '</div>' +
          '<div class="seance-picker-groupe__search">' +
            '<input type="text" id="seance-picker-groupe-query" ' +
                   'class="seance-picker-groupe__input" ' +
                   'placeholder="🔍 Rechercher (nom, prénom, niveau)…" ' +
                   'value="' + escapeHtml(query) + '" ' +
                   'autocomplete="off">' +
            '<span class="seance-picker-groupe__count">' +
              joueursFiltres.length + ' / ' + allJoueurs.length + ' joueurs' +
            '</span>' +
          '</div>' +
          '<div class="seance-picker-groupe__list-wrap">';

    if (joueursFiltres.length === 0) {
      html += '<p class="seance-picker-groupe__empty">Aucun joueur ne correspond à cette recherche.</p>';
    } else {
      html += '<ul class="seance-picker-groupe__list">';
      joueursFiltres.forEach(function (j) {
        const uid = j.joueur_id;
        const estDansCeGrp = dansCeGroupe.has(uid);
        const estAilleurs  = dansAutresGrp.has(uid);
        const niveau = j.niveau_profil || '';

        let cls = 'seance-picker-groupe__item';
        if (estDansCeGrp) cls += ' seance-picker-groupe__item--coche';
        if (estAilleurs)  cls += ' seance-picker-groupe__item--ailleurs';

        let titleAttr = '';
        if (estAilleurs) titleAttr = ' title="Déjà placé dans un autre groupe"';
        else if (estDansCeGrp) titleAttr = ' title="Cliquer pour retirer du groupe"';

        html +=
          '<li class="' + cls + '" data-joueur-id="' + escapeHtml(uid) + '"' + titleAttr + '>' +
            '<span class="seance-picker-groupe__check">' +
              (estDansCeGrp ? '☑' : (estAilleurs ? '⛔' : '☐')) +
            '</span>' +
            '<span class="seance-picker-groupe__nom">' +
              escapeHtml(libelleJoueurCourt(j)) +
            '</span>';
        if (niveau) {
          html += '<span class="seance-picker-groupe__niveau">' + escapeHtml(niveau) + '</span>';
        }
        html += '</li>';
      });
      html += '</ul>';
    }

    html +=
          '</div>' +
          '<div class="seance-picker-groupe__footer">' +
            '<span class="seance-picker-groupe__hint">' +
              '💡 Cliquer pour ajouter/retirer · ⛔ = déjà dans un autre groupe' +
            '</span>' +
            '<button type="button" id="seance-picker-groupe-done" ' +
                    'class="seance-form__save-btn">Terminer</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    root.innerHTML = html;

    // Phase 5.12 : restaure le scrollTop de la liste après re-render
    // (sans transition pour ne pas attirer l'œil)
    if (savedScrollTop > 0) {
      const newList = root.querySelector('.seance-picker-groupe__list-wrap');
      if (newList) newList.scrollTop = savedScrollTop;
    }

    // ----- Binds modale -----
    const overlay = document.getElementById('seance-picker-groupe-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeGroupePicker();
      });
    }
    const btnClose = document.getElementById('seance-picker-groupe-close');
    if (btnClose) btnClose.addEventListener('click', closeGroupePicker);
    const btnDone = document.getElementById('seance-picker-groupe-done');
    if (btnDone) btnDone.addEventListener('click', closeGroupePicker);

    const inputQuery = document.getElementById('seance-picker-groupe-query');
    if (inputQuery) {
      inputQuery.addEventListener('input', function () {
        if (!State.groupePicker) return;
        State.groupePicker.query = inputQuery.value;
        renderGroupePicker();
        const newInput = document.getElementById('seance-picker-groupe-query');
        if (newInput) {
          newInput.focus();
          const len = newInput.value.length;
          newInput.setSelectionRange(len, len);
        }
      });
      setTimeout(function () { inputQuery.focus(); }, 0);
    }

    // Click sur un item → toggle (sauf si déjà ailleurs)
    document.querySelectorAll('.seance-picker-groupe__item').forEach(function (item) {
      item.addEventListener('click', function () {
        if (item.classList.contains('seance-picker-groupe__item--ailleurs')) {
          // Bloqué : déjà dans un autre groupe
          return;
        }
        const uid = item.getAttribute('data-joueur-id');
        const estCoche = item.classList.contains('seance-picker-groupe__item--coche');
        if (estCoche) {
          onRemoveJoueurFromGroupe(nomGroupe, uid, { silent: true });
        } else {
          onAddJoueurToGroupe(nomGroupe, uid);
        }
      });
    });
  }

  /**
   * Ajoute un joueur à un groupe (sans doublon, en respectant l'unicité
   * par bloc : retire d'abord d'un autre groupe si présent — défensif,
   * normalement bloqué par l'UI).
   * Persiste via updateBloc({groupes_jsonb}) puis re-render la section
   * et le popover.
   */
  async function onAddJoueurToGroupe(nomGroupe, joueurId) {
    if (!State.currentBloc) return;
    if (!nomGroupe || !joueurId) return;

    const groupes = getGroupesCourants();
    // Défense : retire le joueur de tout autre groupe (au cas où)
    groupes.forEach(function (g) {
      if (g.nom !== nomGroupe) {
        g.joueurs = g.joueurs.filter(function (uid) { return uid !== joueurId; });
      }
    });
    // Ajoute dans le groupe cible si pas déjà présent
    const cible = groupes.find(function (g) { return g.nom === nomGroupe; });
    if (cible && cible.joueurs.indexOf(joueurId) === -1) {
      cible.joueurs.push(joueurId);
    }

    await persistGroupes(groupes);
    renderGroupesSection();
    renderGroupePicker(); // garde le popover ouvert et synchronise les ☐/☑
  }

  /**
   * Retire un joueur d'un groupe.
   * @param {object} [opts]
   * @param {boolean} [opts.silent] si true, n'affiche pas de feedback
   */
  async function onRemoveJoueurFromGroupe(nomGroupe, joueurId, opts) {
    if (!State.currentBloc) return;
    if (!nomGroupe || !joueurId) return;

    const groupes = getGroupesCourants();
    const cible = groupes.find(function (g) { return g.nom === nomGroupe; });
    if (cible) {
      cible.joueurs = cible.joueurs.filter(function (uid) { return uid !== joueurId; });
    }

    await persistGroupes(groupes);
    renderGroupesSection();
    // Si popover ouvert, le rafraîchir aussi
    if (State.groupePicker && State.groupePicker.open) {
      renderGroupePicker();
    }
    if (!(opts && opts.silent)) {
      showFeedback('Joueur retiré ✓', 'success');
    }
  }

  /**
   * Persiste les groupes du bloc courant via updateBloc.
   * Met à jour aussi State.currentBloc.groupes_jsonb et l'entrée
   * correspondante dans State.blocs (pour cohérence inter-renders).
   */
  async function persistGroupes(groupes) {
    if (!State.currentBloc) return;
    // v1.22 : on persiste la liste LIBRE telle quelle (0..N groupes, noms
    // libres). Les groupes sans nom sont tolérés en mémoire mais filtrés à
    // la persistance (un groupe anonyme n'a pas de sens au reload).
    const clean = groupes
      .filter(function (g) { return g && typeof g.nom === 'string' && g.nom.trim() !== ''; })
      .map(function (g) {
        return { nom: g.nom.trim(), joueurs: g.joueurs.slice() };
      });

    const res = await SupabaseHub.updateBloc(State.currentBloc.id, {
      groupes_jsonb: clean
    });
    if (!res.ok) {
      window.alert('Échec de la sauvegarde des groupes :\n' + (res.error || 'erreur inconnue'));
      return;
    }
    // Synchro mémoire
    State.currentBloc.groupes_jsonb = clean;
    const idx = State.blocs.findIndex(function (b) { return b.id === State.currentBloc.id; });
    if (idx !== -1) State.blocs[idx].groupes_jsonb = clean;
  }

  /**
   * v1.22 — Ajoute un groupe (nom éventuellement vide, éditable ensuite).
   * @param {string} nom nom initial (peut être '')
   */
  async function onAddGroupe(nom) {
    const groupes = getGroupesCourants();
    groupes.push({ nom: (nom || '').trim(), joueurs: [] });
    // Un groupe au nom vide n'est pas persisté par persistGroupes (filtré) ;
    // pour qu'il survive à l'écran le temps d'être nommé, on met à jour la
    // mémoire directement AVANT de re-render, et on ne persiste que s'il est nommé.
    if ((nom || '').trim() !== '') {
      await persistGroupes(groupes);
    } else {
      // maintien en mémoire volatile (sera persisté au premier rename non vide)
      if (State.currentBloc) State.currentBloc.groupes_jsonb = groupes.map(function (g) {
        return { nom: g.nom, joueurs: g.joueurs.slice() };
      });
    }
    renderGroupesSection();
  }

  /**
   * v1.22 — Renomme le groupe à la position idx. Un nom vidé n'est pas
   * persisté (le groupe reste en mémoire, éditable) ; un doublon de nom est
   * refusé (le popover joueurs référence par nom).
   * @param {number} idx position du groupe
   * @param {string} nouveauNom
   */
  async function onRenameGroupe(idx, nouveauNom) {
    const groupes = getGroupesCourants();
    if (idx < 0 || idx >= groupes.length) return;
    const clean = (nouveauNom || '').trim();
    // Refus de doublon (hors ce même groupe).
    const doublon = groupes.some(function (g, i) {
      return i !== idx && g.nom && g.nom.trim().toLowerCase() === clean.toLowerCase() && clean !== '';
    });
    if (doublon) {
      showFeedback('Un autre groupe porte déjà ce nom.', 'error');
      renderGroupesSection(); // restaure l'affichage (annule la saisie)
      return;
    }
    groupes[idx].nom = clean;
    if (clean === '') {
      // Nom vidé : on garde en mémoire, non persisté (invariant persistGroupes).
      if (State.currentBloc) State.currentBloc.groupes_jsonb = groupes.map(function (g) {
        return { nom: g.nom, joueurs: g.joueurs.slice() };
      });
      renderGroupesSection();
      return;
    }
    await persistGroupes(groupes);
    renderGroupesSection();
  }

  /**
   * v1.22 — Supprime le groupe à la position idx (joueurs de ce groupe
   * libérés). 0 groupe est autorisé (choix Manu).
   * @param {number} idx position du groupe
   */
  async function onRemoveGroupe(idx) {
    const groupes = getGroupesCourants();
    if (idx < 0 || idx >= groupes.length) return;
    groupes.splice(idx, 1);
    await persistGroupes(groupes);
    // Reflète aussi le cas 0 groupe en mémoire (persistGroupes filtre déjà).
    if (State.currentBloc && groupes.length === 0) {
      State.currentBloc.groupes_jsonb = [];
      const k = State.blocs.findIndex(function (b) { return b.id === State.currentBloc.id; });
      if (k !== -1) State.blocs[k].groupes_jsonb = [];
    }
    renderGroupesSection();
  }

  // ============================================================
  // 6. ACTIONS
  // ============================================================

  // ----------------------------------------------------------
  // Phase 5.10 — Sidebar enrichie + nettoyage brouillons vides
  // ----------------------------------------------------------

  /**
   * Toggle "Afficher les archivées" dans le header de la sidebar.
   * Recharge la liste avec / sans les séances archivées et re-render.
   */
  async function onToggleArchivees() {
    const toggle = DOM.toggleArchivees();
    if (!toggle) return;
    State.showArchivees = toggle.checked;
    // Phase 5.13 : la cible cochable change avec le toggle (brouillons en vue
    // normale, archivées en vue archivées) → on vide la sélection courante
    // pour éviter de garder cochés des items devenus non cochables.
    if (State.selectionMode) State.selectionIds.clear();
    await loadSeances();
    renderSidebar();
  }

  /**
   * Nettoyage manuel des brouillons vides du M14 (Phase 5.10).
   * Confirme avec compteur, supprime en lot, puis recharge la liste
   * des séances et le compteur. Si la séance courante était dans la
   * liste supprimée (peu probable car on a fini de la travailler mais
   * sécurité), retour à l'écran vide.
   */
  async function onCleanupBrouillons() {
    const nb = State.brouillonsVides ? State.brouillonsVides.length : 0;
    if (nb === 0) return;

    const ok = window.confirm(
      'Supprimer ' + nb + ' brouillon' + (nb > 1 ? 's' : '') + ' vide' + (nb > 1 ? 's' : '') + ' ?\n\n' +
      'Ces séances n\'ont ni date ni bloc rattaché.\n' +
      'Cette action est irréversible.'
    );
    if (!ok) return;

    const idsASupprimer = State.brouillonsVides.map(function (b) { return b.id; });
    const currentInList = State.currentSeance && idsASupprimer.indexOf(State.currentSeance.id) !== -1;

    const res = await SupabaseHub.deleteBrouillonsVides(idsASupprimer);
    if (!res.ok) {
      window.alert('Échec du nettoyage :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    // Si la séance courante a été supprimée, retour écran vide
    if (currentInList) {
      stopAutosave();
      stopBlocAutosave();
      State.currentSeance = null;
      State.currentBloc = null;
      State.blocs = [];
      State.view = 'trame';
      renderEmptyEditor();
    }

    // Recharge la liste (loadSeances couple aussi le compteur brouillons vides)
    await loadSeances();
    renderSidebar();
    showFeedback(res.deleted_count + ' brouillon' + (res.deleted_count > 1 ? 's' : '') + ' supprimé' + (res.deleted_count > 1 ? 's' : '') + ' ✓', 'success');
  }

  /**
   * Archive la séance courante (Phase 5.10).
   * Bouton dans le formulaire méta (déplié ET résumé replié).
   * Confirme, archive via archiveSeance, recharge la sidebar et
   * revient à l'écran vide.
   */
  async function onArchiveSeance() {
    if (!State.currentSeance) return;
    const dateLib = State.currentSeance.date_seance
      ? formatDateShort(State.currentSeance.date_seance)
      : 'sans date';
    const ok = window.confirm(
      'Archiver cette séance (' + dateLib + ') ?\n\n' +
      'Elle n\'apparaîtra plus dans la sidebar par défaut.\n' +
      'Coche « Afficher les archivées » pour la retrouver.'
    );
    if (!ok) return;

    // Save préventif des modifs en cours pour éviter une perte
    if (State.isDirty) {
      await saveSeance({ silent: true });
    }

    const res = await SupabaseHub.archiveSeance(State.currentSeance.id);
    if (!res.ok) {
      window.alert('Échec de l\'archivage :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    // Reset propre + retour écran vide
    stopAutosave();
    stopBlocAutosave();
    State.currentSeance = null;
    State.currentBloc = null;
    State.blocs = [];
    State.view = 'trame';
    State.isDirty = false;
    State.blocIsDirty = false;

    await loadSeances();
    renderSidebar();
    renderEmptyEditor();
    showFeedback('Séance archivée ✓', 'success');
  }

  /**
   * SEANCE-DUPLICATION v1 : duplique la séance courante.
   * Appelle la RPC dupliquer_seance (méta + blocs + ateliers), qui crée
   * une copie en 'brouillon' sans date (filiation modele_origine_id).
   * Save préventif des modifs en cours, recharge la liste, PUIS ouvre la
   * copie (patron onSelectSeance : blocs chargés, form déployé car pas de
   * date). L'original n'est pas touché.
   */
  async function onDupliquerSeance() {
    if (!State.currentSeance) return;

    // Save préventif des modifs en cours (même pattern que onValiderSeance)
    if (State.isDirty) {
      await saveSeance({ silent: true });
    }

    const res = await SupabaseHub.dupliquerSeance(State.currentSeance.id);
    if (!res.ok || !res.data) {
      window.alert('Échec de la duplication :\n' + (res.error || 'erreur inconnue'));
      return;
    }
    const newId = res.data;

    // Recharge la liste (la copie doit y apparaître) puis ouvre la copie.
    stopAutosave();
    stopBlocAutosave();
    await loadSeances();

    const target = State.seances.find(function (s) { return s.id === newId; });
    if (!target) {
      // Sécurité : la copie existe en base mais pas dans le cache local.
      showFeedback('Séance dupliquée ✓ (recharge la page pour l\'ouvrir)', 'success');
      return;
    }

    State.currentSeance = target;
    State.currentBloc = null;
    State.view = 'trame';
    State.blocIsDirty = false;
    setDirty(false);
    await loadBlocs();
    // Copie sans date => form déployé (cohérent avec onSelectSeance).
    State.formCollapsed = !!target.date_seance;
    renderSidebar();
    renderForm();
    setAutosaveStatus('idle');
    startAutosave();
    showFeedback('Séance dupliquée ✓', 'success');
  }

  /**
   * Valide la séance courante (Phase 5.12).
   * Bouton manuel dans le formulaire méta (déplié ET résumé replié).
   * Bascule etat='brouillon' → 'validee'. Confirme, save préventif des
   * modifs en cours, update etat, recharge la sidebar, garde la séance
   * ouverte (contrairement à archivage).
   */
  async function onValiderSeance() {
    if (!State.currentSeance) return;

    // D4-bis : le garde-fou de date ne peut PAS se fier à State.isDirty ni à
    // State.currentSeance.date_seance seuls. Sur une séance dupliquée, la
    // pastille reste "Sauvé" après saisie de la date (isDirty non déclenché) —
    // saveSeance refuse alors de tourner (garde `if (!isDirty) return`) et
    // l'objet mémoire garde date_seance=null. On lit donc la date DIRECTEMENT
    // dans le champ du formulaire (comme le fait saveSeance) et on la persiste
    // via updateSeance, sans dépendre de isDirty.
    if (!State.formCollapsed) {
      const champDate = (DOM.inputDate() && DOM.inputDate().value) || '';
      if (!champDate) {
        window.alert('Impossible de valider une séance sans date.\n\n' +
                     'Renseigne au moins la date avant de valider.');
        return;
      }
      // Persister la date (et l'objet mémoire) si elle diffère de la base.
      if (champDate !== State.currentSeance.date_seance) {
        const up = await SupabaseHub.updateSeance(State.currentSeance.id, {
          date_seance: champDate
        });
        if (!up.ok) {
          window.alert('Échec de la sauvegarde de la date avant validation :\n' +
                       (up.error || 'erreur inconnue'));
          return;
        }
        State.currentSeance = up.data;
        const i = State.seances.findIndex(function (s) { return s.id === up.data.id; });
        if (i !== -1) State.seances[i] = up.data;
        setDirty(false);
      }
    } else if (!State.currentSeance.date_seance) {
      // Formulaire replié : la séance est censée être déjà datée. Garde-fou
      // conservé par sécurité.
      window.alert('Impossible de valider une séance sans date.\n\n' +
                   'Renseigne au moins la date avant de valider.');
      return;
    }

    const ok = window.confirm(
      'Valider cette séance ?\n\n' +
      'Elle passera de "brouillon" à "validée" (prête à coacher).\n' +
      'Tu pourras toujours la modifier ou la repasser en brouillon ensuite.'
    );
    if (!ok) return;

    const res = await SupabaseHub.validerSeance(State.currentSeance.id);
    if (!res.ok) {
      window.alert('Échec de la validation :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    // Synchro mémoire + refresh sidebar + re-render du formulaire en place
    State.currentSeance.etat = 'validee';
    const idx = State.seances.findIndex(function (s) { return s.id === State.currentSeance.id; });
    if (idx !== -1) State.seances[idx].etat = 'validee';

    await loadSeances();
    renderSidebar();
    renderForm();
    renderTrame();
    showFeedback('Séance validée ✓', 'success');
  }

  /**
   * Repasse une séance validée/utilisée en brouillon (Phase 5.12).
   * Permet d'éditer librement après validation. Boutton seulement
   * visible si etat='validee' ou 'utilisee' (pas pour archivée).
   */
  async function onRepasserBrouillon() {
    if (!State.currentSeance) return;
    if (State.currentSeance.etat === 'brouillon') return;

    const ok = window.confirm(
      'Repasser cette séance en brouillon ?\n\n' +
      'Elle redevient modifiable librement (statut "brouillon").'
    );
    if (!ok) return;

    if (State.isDirty) {
      await saveSeance({ silent: true });
    }

    const res = await SupabaseHub.repasserSeanceBrouillon(State.currentSeance.id);
    if (!res.ok) {
      window.alert('Échec du retour en brouillon :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    State.currentSeance.etat = 'brouillon';
    const idx = State.seances.findIndex(function (s) { return s.id === State.currentSeance.id; });
    if (idx !== -1) State.seances[idx].etat = 'brouillon';

    await loadSeances();
    renderSidebar();
    renderForm();
    renderTrame();
    showFeedback('Séance repassée en brouillon ✓', 'success');
  }

  // ============================================================
  // Phase 5.12 BIS — Suppression libre + mode sélection
  // ============================================================

  /**
   * Supprime physiquement la séance courante (uniquement si brouillon).
   * Garde-fou métier déjà côté wrapper supabase-client v1.8.6.
   * Reset l'éditeur après suppression (retour à l'écran vide).
   */
  async function onDeleteSeance() {
    if (!State.currentSeance) return;
    if (State.currentSeance.etat !== 'brouillon') {
      window.alert('Seuls les brouillons sont supprimables.\n\n' +
                   'Si tu veux retirer cette séance, archive-la (📦) ou ' +
                   'repasse-la en brouillon (↩) puis supprime.');
      return;
    }

    const s = State.currentSeance;
    const dateLib = s.date_seance ? formatDateShort(s.date_seance) : 'sans date';
    const titreLib = s.axe_travail_general || s.theme_principal || 'sans thème';

    const ok = window.confirm(
      'Supprimer définitivement ce brouillon ?\n\n' +
      '🗓  ' + dateLib + '\n' +
      '📋 ' + titreLib + '\n\n' +
      '⚠️ Cette action est IRRÉVERSIBLE. ' +
      'Tous les blocs et rattachements de cette séance seront aussi supprimés.'
    );
    if (!ok) return;

    const res = await SupabaseHub.deleteSeance(s.id);
    if (!res.ok) {
      window.alert('Échec de la suppression :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    // Reset complet de l'éditeur
    State.currentSeance = null;
    State.blocs = [];
    State.currentBloc = null;
    State.view = 'trame';
    State.isDirty = false;
    State.blocIsDirty = false;
    stopAutosave();
    stopBlocAutosave();

    // Retire la séance de la liste mémoire
    State.seances = State.seances.filter(function (x) { return x.id !== s.id; });

    // Refresh sidebar + compteur brouillons vides
    await loadBrouillonsVides();
    renderSidebar();
    renderEmptyEditor();
    showFeedback('Brouillon supprimé ✓', 'success');
  }

  /**
   * Supprime en lot toutes les séances cochées en sidebar (uniquement les
   * brouillons par construction, le wrapper applique le garde-fou serveur).
   */
  async function onDeleteSeancesEnLot() {
    if (State.selectionIds.size === 0) return;

    const nb = State.selectionIds.size;
    const ok = window.confirm(
      'Supprimer ' + nb + ' brouillon' + (nb > 1 ? 's' : '') + ' ?\n\n' +
      '⚠️ Cette action est IRRÉVERSIBLE. ' +
      'Tous les blocs et rattachements liés seront aussi supprimés.'
    );
    if (!ok) return;

    const ids = Array.from(State.selectionIds);
    const res = await SupabaseHub.deleteSeancesEnLot(ids);
    if (!res.ok) {
      window.alert('Échec de la suppression en lot :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    // Si la séance courante est dans la liste supprimée, reset l'éditeur
    if (State.currentSeance && ids.indexOf(State.currentSeance.id) !== -1) {
      State.currentSeance = null;
      State.blocs = [];
      State.currentBloc = null;
      State.view = 'trame';
      State.isDirty = false;
      State.blocIsDirty = false;
      stopAutosave();
      stopBlocAutosave();
      renderEmptyEditor();
    }

    // Retire les séances supprimées de la liste mémoire
    const idsSet = new Set(ids);
    State.seances = State.seances.filter(function (s) { return !idsSet.has(s.id); });

    // Sort du mode sélection + refresh sidebar
    State.selectionMode = false;
    State.selectionIds.clear();
    await loadBrouillonsVides();
    renderSidebar();

    showFeedback(res.deleted_count + ' brouillon' + (res.deleted_count > 1 ? 's supprimés' : ' supprimé') + ' ✓', 'success');
  }

  // ------------------------------------------------------------
  // Phase 5.13 — Durcissement soft-delete (SEANCE-SOFT-DELETE)
  // ------------------------------------------------------------

  /**
   * Archive en lot les brouillons cochés (vue normale, mode sélection).
   * Remplace l'usage UI de onDeleteSeancesEnLot : « mettre à la corbeille »
   * au lieu de supprimer. Récupérable via le toggle « Afficher les archivées ».
   */
  async function onArchiveSeancesEnLot() {
    if (State.selectionIds.size === 0) return;

    const nb = State.selectionIds.size;
    const ok = window.confirm(
      'Archiver ' + nb + ' brouillon' + (nb > 1 ? 's' : '') + ' ?\n\n' +
      '📦 Les séances seront mises à la corbeille (état « archivée »).\n' +
      'Elles restent récupérables via « Afficher les archivées ».'
    );
    if (!ok) return;

    const ids = Array.from(State.selectionIds);
    const res = await SupabaseHub.archiveSeancesEnLot(ids);
    if (!res.ok) {
      window.alert('Échec de l\'archivage en lot :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    // Si la séance courante est dans la liste archivée, reset l'éditeur
    if (State.currentSeance && ids.indexOf(State.currentSeance.id) !== -1) {
      State.currentSeance = null;
      State.blocs = [];
      State.currentBloc = null;
      State.view = 'trame';
      State.isDirty = false;
      State.blocIsDirty = false;
      stopAutosave();
      stopBlocAutosave();
      renderEmptyEditor();
    }

    // Sort du mode sélection puis recharge la liste (les archivées sont
    // désormais filtrées de la vue normale par loadSeances).
    State.selectionMode = false;
    State.selectionIds.clear();
    await loadSeances();
    renderSidebar();

    const n = res.archived_count;
    showFeedback(n + ' brouillon' + (n > 1 ? 's archivés' : ' archivé') + ' 📦', 'success');
  }

  /**
   * Purge DÉFINITIVE d'UNE séance archivée (bouton 🗑 par-ligne, vue archivées).
   * Borné serveur par le wrapper purgerSeanceArchivee (.eq('etat','archivee')).
   */
  async function onPurgerSeanceArchivee(seanceId) {
    if (!seanceId) return;
    const s = State.seances.find(function (x) { return x.id === seanceId; });
    const dateLib = (s && s.date_seance) ? formatDateShort(s.date_seance) : 'sans date';
    const titreLib = s ? (s.axe_travail_general || s.theme_principal || 'sans thème') : '';

    const ok = window.confirm(
      'Supprimer DÉFINITIVEMENT cette séance archivée ?\n\n' +
      '🗓  ' + dateLib + '\n' +
      (titreLib ? '📋 ' + titreLib + '\n' : '') + '\n' +
      '⚠️ Cette action est IRRÉVERSIBLE. La séance et tous ses blocs ' +
      'seront définitivement supprimés. Il n\'y a pas de récupération possible.'
    );
    if (!ok) return;

    const res = await SupabaseHub.purgerSeanceArchivee(seanceId);
    if (!res.ok) {
      window.alert('Échec de la suppression définitive :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    // Si la séance purgée est la courante, reset l'éditeur
    if (State.currentSeance && State.currentSeance.id === seanceId) {
      State.currentSeance = null;
      State.blocs = [];
      State.currentBloc = null;
      State.view = 'trame';
      State.isDirty = false;
      State.blocIsDirty = false;
      stopAutosave();
      stopBlocAutosave();
      renderEmptyEditor();
    }

    State.seances = State.seances.filter(function (x) { return x.id !== seanceId; });
    renderSidebar();
    showFeedback('Séance supprimée définitivement ✓', 'success');
  }

  /**
   * Purge DÉFINITIVE en lot des séances archivées cochées (vue archivées,
   * mode sélection). Borné serveur par purgerSeancesArchiveesEnLot.
   */
  async function onPurgerSeancesArchiveesEnLot() {
    if (State.selectionIds.size === 0) return;

    const nb = State.selectionIds.size;
    const ok = window.confirm(
      'Supprimer DÉFINITIVEMENT ' + nb + ' séance' + (nb > 1 ? 's' : '') + ' archivée' + (nb > 1 ? 's' : '') + ' ?\n\n' +
      '⚠️ Cette action est IRRÉVERSIBLE. Les séances et tous leurs blocs ' +
      'seront définitivement supprimés, sans récupération possible.'
    );
    if (!ok) return;

    const ids = Array.from(State.selectionIds);
    const res = await SupabaseHub.purgerSeancesArchiveesEnLot(ids);
    if (!res.ok) {
      window.alert('Échec de la suppression définitive en lot :\n' + (res.error || 'erreur inconnue'));
      return;
    }

    if (State.currentSeance && ids.indexOf(State.currentSeance.id) !== -1) {
      State.currentSeance = null;
      State.blocs = [];
      State.currentBloc = null;
      State.view = 'trame';
      State.isDirty = false;
      State.blocIsDirty = false;
      stopAutosave();
      stopBlocAutosave();
      renderEmptyEditor();
    }

    const idsSet = new Set(ids);
    State.seances = State.seances.filter(function (s) { return !idsSet.has(s.id); });

    State.selectionMode = false;
    State.selectionIds.clear();
    renderSidebar();

    const n = res.purged_count;
    showFeedback(n + ' séance' + (n > 1 ? 's supprimées' : ' supprimée') + ' définitivement ✓', 'success');
  }

  /**
   * Bascule le mode "Sélectionner" : cases à cocher apparaissent sur les
   * brouillons (vue normale) ou les archivées (vue archivées) en sidebar,
   * le clic sur un item ne charge plus la séance.
   */
  function enterSelectionMode() {
    State.selectionMode = true;
    State.selectionIds = new Set();
    renderSidebar();
  }

  /**
   * Quitte le mode "Sélectionner" : retour au comportement normal de la sidebar.
   */
  function exitSelectionMode() {
    State.selectionMode = false;
    State.selectionIds.clear();
    renderSidebar();
  }

  /**
   * Toggle la sélection d'une séance dans le mode "Sélectionner".
   * N'a d'effet que si la séance est un brouillon (les autres sont
   * protégées et le clic est intercepté en amont dans renderSidebar).
   */
  function toggleSeanceSelection(seanceId) {
    if (!State.selectionMode) return;
    if (State.selectionIds.has(seanceId)) {
      State.selectionIds.delete(seanceId);
    } else {
      State.selectionIds.add(seanceId);
    }
    renderSidebar();
  }

  async function onNouvelleSeance() {
    // Chantier SEANCE-RATTACHEMENT-CATEGORIE — le rattachement se fait
    // désormais à la CATÉGORIE active (State.perimetreCat.active), plus à
    // l'équipe. GARDE : sans catégorie active résolue, la création échouerait
    // (categorie_id NOT NULL en base). On intercepte AVANT l'appel.
    const _catActive = State.perimetreCat && State.perimetreCat.active;
    if (!_catActive) {
      alert('Aucune catégorie active : impossible de créer une séance.\n\n'
        + 'Le périmètre de catégorie n\'est pas résolu (intersaison, ou '
        + 'droits non chargés). Reviens une fois le périmètre en place.');
      return;
    }

    const sidebarBtn = DOM.sidebarCta();
    const centerBtn  = DOM.ctaCenter();
    if (sidebarBtn) sidebarBtn.disabled = true;
    if (centerBtn)  centerBtn.disabled  = true;

    const res = await SupabaseHub.createSeance({
      categorie_id: _catActive,
      duree_totale_min: DUREE_DEFAULT_MIN,
      etat: 'brouillon'
      // Pas d'equipe_id (D3) : rattachement catégorie seule.
      // Pas de date_seance par défaut : laisse le coach saisir
    });

    if (sidebarBtn) sidebarBtn.disabled = false;

    if (!res.ok) {
      console.error('SeanceEditor: onNouvelleSeance() KO', res.error);
      // On ré-affiche la zone vide et un feedback éphémère
      renderEmptyEditor();
      // Pas de DOM.feedback() disponible ici car le form n'est pas rendu
      // On utilise alert minimal en V1A (à améliorer en V1B avec feedback global)
      alert('Erreur création séance : ' + res.error);
      return;
    }

    State.currentSeance = res.data;
    State.seances.unshift(res.data); // ajoute en tête de liste
    State.blocs = [];                 // nouvelle séance = 0 bloc (Phase 5.6.A)
    State.currentBloc = null;         // Phase 5.7
    State.view = 'trame';             // Phase 5.7
    State.formCollapsed = false;      // nouvelle séance = form déployé (Phase 5.6.B)
    setDirty(false);                  // séance fraîche = pas de modif
    State.blocIsDirty = false;        // Phase 5.7
    // Phase 5.12 fix : rafraîchir le compteur de brouillons vides
    // (la nouvelle séance créée est un brouillon vide tant qu'on n'a ni
    //  date ni bloc, donc le compteur doit le refléter en sidebar).
    await loadBrouillonsVides();
    renderSidebar();
    renderForm();
    setAutosaveStatus('idle');
    startAutosave();                  // Phase 5.5.B2 : timer 30s
    showFeedback('Nouvelle séance créée. Renseigne les méta puis enregistre.', 'info');
  }

  /**
   * Sauvegarde silencieuse ou manuelle de la séance courante.
   * Partagée par onSaveSeance (clic bouton) et onTickAutosave (timer 30s).
   *
   * @param {object} [opts]
   * @param {boolean} [opts.silent=false] Si true : pas de feedback bruyant,
   *                                       pilote uniquement la pastille autosave.
   * @returns {Promise<boolean>} true si sauvegarde OK, false sinon
   */
  async function saveSeance(opts) {
    if (!State.currentSeance) return false;
    if (!State.isDirty) return false;
    const silent = !!(opts && opts.silent);

    // Vérouille le bouton manuel
    const btn = DOM.btnSave();
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Enregistrement…';
    }
    setAutosaveStatus('saving');

    // Collecte des valeurs du formulaire (lecture du DOM, pas du State)
    const patch = {
      date_seance:          (DOM.inputDate()     && DOM.inputDate().value)     || null,
      heure_debut:          (DOM.inputHeure()    && DOM.inputHeure().value)    || null,
      duree_totale_min:     parseInt((DOM.inputDuree() && DOM.inputDuree().value) || DUREE_DEFAULT_MIN, 10),
      effectif_prevu:       parseInt((DOM.inputEffectif() && DOM.inputEffectif().value) || '0', 10) || null,
      theme_principal:      (DOM.inputTheme()    && DOM.inputTheme().value.trim())    || null,
      axe_travail_general:  (DOM.inputAxe()      && DOM.inputAxe().value.trim())      || null,
      // Phase 5.5.B1 — 7 champs supplémentaires
      lieu_id:              (DOM.selectLieu()       && DOM.selectLieu().value)       || null,
      evenement_id:         (DOM.selectEvenement()  && DOM.selectEvenement().value)  || null,
      meteo_text:           (DOM.inputMeteo()       && DOM.inputMeteo().value.trim())       || null,
      encadrants_text:      (DOM.inputEncadrants()  && DOM.inputEncadrants().value.trim())  || null,
      objectifs_text:       (DOM.inputObjectifs()   && DOM.inputObjectifs().value.trim())   || null,
      bloc_cycle:           (DOM.inputCycle()       && DOM.inputCycle().value.trim())       || null,
      materiel_global_text: (DOM.inputMateriel()    && DOM.inputMateriel().value.trim())    || null
    };

    const res = await SupabaseHub.updateSeance(State.currentSeance.id, patch);

    if (!res.ok) {
      console.error('SeanceEditor: saveSeance() KO', res.error);
      setAutosaveStatus('error');
      if (!silent) {
        showFeedback('Erreur sauvegarde : ' + res.error, 'error');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer les modifications';
      }
      return false;
    }

    // Succès : on met à jour State avec la donnée canonique (côté DB)
    State.currentSeance = res.data;
    // Synchroniser aussi la ligne sidebar (recherche par id et remplace)
    const idx = State.seances.findIndex(function (s) { return s.id === res.data.id; });
    if (idx !== -1) State.seances[idx] = res.data;
    setDirty(false);
    setAutosaveStatus('idle');
    renderSidebar();
    // Phase 5.6.B : sur save MANUEL réussi, si la séance a au moins une
    // date_seance, on replie le formulaire pour donner la place à la trame.
    // En autosave (silent), on garde l'état actuel (intrusif sinon).
    if (!silent && res.data.date_seance) {
      State.formCollapsed = true;
      renderForm();
    } else {
      // Phase 5.6.A : si heure_debut a changé, le calcul des horaires de la
      // trame doit être rafraîchi. On relance renderTrame() de toute façon
      // (idempotent, opération légère).
      renderTrame();
    }
    if (!silent) {
      showFeedback('Séance enregistrée.', 'success');
    }
    return true;
  }

  /**
   * Handler du bouton "Enregistrer" : wrapper bruyant autour de saveSeance().
   */
  async function onSaveSeance() {
    await saveSeance({ silent: false });
  }

  /**
   * Tick autosave : vérifie isDirty, sauve silencieusement si oui.
   * Appelé toutes les AUTOSAVE_INTERVAL_MS ms par le setInterval.
   */
  async function onTickAutosave() {
    if (!State.isDirty) return;
    if (State.autosaveStatus === 'saving') return; // évite recouvrement
    await saveSeance({ silent: true });
  }

  /**
   * Démarre l'autosave (à appeler à chaque ouverture de formulaire).
   * Idempotent : arrête le timer existant avant d'en lancer un nouveau.
   */
  function startAutosave() {
    stopAutosave();
    State.autosaveTimer = setInterval(onTickAutosave, AUTOSAVE_INTERVAL_MS);
  }

  /**
   * Arrête l'autosave (à appeler à la fermeture du form ou avant bascule).
   */
  function stopAutosave() {
    if (State.autosaveTimer) {
      clearInterval(State.autosaveTimer);
      State.autosaveTimer = null;
    }
  }

  /**
   * Charge une séance existante (clic sidebar). Phase 5.5.B2.
   * Si isDirty, demande confirmation avant de basculer.
   */
  async function onSelectSeance(seanceId) {
    if (!seanceId) return;
    if (State.currentSeance && State.currentSeance.id === seanceId) return; // déjà ouverte

    if (State.isDirty) {
      const ok = window.confirm(
        'Tu as des modifications non sauvées sur la séance courante.\n\n' +
        'Continuer sans sauver ? (clique Annuler pour rester)'
      );
      if (!ok) return;
    }

    // Trouve la séance dans le cache (rechargement complet du form depuis State)
    const target = State.seances.find(function (s) { return s.id === seanceId; });
    if (!target) {
      console.error('SeanceEditor: onSelectSeance() séance introuvable dans State.seances', seanceId);
      return;
    }

    stopAutosave();
    stopBlocAutosave();              // Phase 5.7 : si on était en vue détail bloc d'une autre séance
    State.currentSeance = target;
    State.currentBloc = null;        // Phase 5.7
    State.view = 'trame';            // Phase 5.7
    State.blocIsDirty = false;
    setDirty(false);
    // Phase 5.6.A : charger les blocs de cette séance
    await loadBlocs();
    // Phase 5.6.B : ouvrir en mode replié si la séance est déjà documentée
    State.formCollapsed = !!target.date_seance;
    renderSidebar();
    renderForm();
    setAutosaveStatus('idle');
    startAutosave();
  }

  /**
   * Replie le formulaire méta sans modifier la séance. Phase 5.6.B fix v1.4.1.
   * Le bouton "↑ Replier" en haut du formulaire déplié déclenche cette fonction.
   * Si des modifs sont en cours (isDirty), confirm() avant repli.
   */
  function onCollapseForm() {
    if (!State.currentSeance) return;

    if (State.isDirty) {
      const ok = window.confirm(
        'Tu as des modifications non sauvées.\n\n' +
        'Replier sans sauver ? (clique Annuler pour rester sur le formulaire)'
      );
      if (!ok) return;
      // Reset dirty + état autosave : on a délibérément choisi d'ignorer les modifs
      setDirty(false);
      setAutosaveStatus('idle');
    }

    State.formCollapsed = true;
    renderForm();
  }

  /**
   * Crée un nouveau bloc dans la séance courante avec les valeurs par défaut
   * du type sélectionné. Phase 5.6.A.
   * @param {string} slug Slug du type de bloc (ex : 'echauffement')
   */
  async function onAddBloc(slug) {
    if (!State.currentSeance) {
      console.error('SeanceEditor: onAddBloc() sans currentSeance');
      return;
    }
    const typeDef = lookupTypeBloc(slug);
    if (!typeDef) {
      console.error('SeanceEditor: onAddBloc() type inconnu', slug);
      return;
    }

    closePicker();

    const params = {
      type_bloc: slug,
      duree_min: typeDef.duree_min_defaut || 10
    };
    // Intensité par défaut seulement si le type l'affiche
    if (typeDef.affiche_intensite && typeDef.intensite_defaut) {
      params.intensite = typeDef.intensite_defaut;
    }

    // v1.10 (sql_108) — DÉDOUBLEMENT : si un étage cible est mémorisé,
    // le nouveau bloc rejoint cet `ordre` sur une voie parallèle libre
    // (max voie de l'étage + 1) au lieu d'être ajouté en fin de trame.
    const ordreCible = State.dedoublerOrdre;
    State.dedoublerOrdre = null; // consommé (ne persiste pas entre ajouts)
    if (ordreCible !== undefined && ordreCible !== null) {
      const blocsEtage = State.blocs.filter(function (b) { return (b.ordre || 0) === ordreCible; });
      const voieMax = blocsEtage.reduce(function (m, b) { return Math.max(m, b.voie || 0); }, 0);
      params.ordre = ordreCible;
      params.voie = voieMax + 1;
    }

    // Phase 5.9 : héritage auto des groupes du bloc précédent.
    // Si la trame contient déjà au moins un bloc avec des groupes non vides,
    // on copie ces groupes dans le nouveau bloc (commodité doctrinale).
    // Le clone est volontairement profond (JSON parse/stringify) pour éviter
    // qu'une modification ultérieure du nouveau bloc ne contamine l'ancien.
    if (State.blocs && State.blocs.length > 0) {
      const dernier = State.blocs[State.blocs.length - 1];
      if (dernier && Array.isArray(dernier.groupes_jsonb) && dernier.groupes_jsonb.length > 0) {
        params.groupes_jsonb = JSON.parse(JSON.stringify(dernier.groupes_jsonb));
      }
    }

    const res = await SupabaseHub.addBlocToSeance(State.currentSeance.id, params);
    if (!res.ok) {
      console.error('SeanceEditor: onAddBloc() KO', res.error);
      alert('Erreur création bloc : ' + res.error);
      return;
    }

    // Ajoute le nouveau bloc dans State.blocs (déjà trié par ordre côté DB)
    State.blocs.push(res.data);
    renderTrame();
  }

  /**
   * Échange 2 blocs dans State.blocs et persiste via reorderBlocs.
   * Helper interne partagé par onMoveBlocUp / onMoveBlocDown.
   * Phase 5.6.B.
   */
  async function swapBlocs(idxA, idxB) {
    if (idxA < 0 || idxB < 0) return;
    if (idxA >= State.blocs.length || idxB >= State.blocs.length) return;

    // Échange optimiste en mémoire pour render immédiat
    const tmp = State.blocs[idxA];
    State.blocs[idxA] = State.blocs[idxB];
    State.blocs[idxB] = tmp;
    renderTrame();

    // Persistance : envoie la nouvelle séquence d'IDs
    const ids = State.blocs.map(function (b) { return b.id; });
    const res = await SupabaseHub.reorderBlocs(State.currentSeance.id, ids);
    if (!res.ok) {
      console.error('SeanceEditor: swapBlocs() KO', res.error);
      alert('Erreur réordonnancement : ' + res.error + '\n\nRechargement de la séance…');
      // Rollback : recharge depuis la DB pour resynchroniser
      await loadBlocs();
      renderTrame();
      return;
    }
    // Met à jour les valeurs 'ordre' locales pour cohérence (1-indexé)
    State.blocs.forEach(function (b, i) { b.ordre = i + 1; });
  }

  /**
   * Monte un bloc d'une place dans la trame.
   * Phase 5.6.B.
   */
  async function onMoveBlocUp(blocId) {
    const idx = State.blocs.findIndex(function (b) { return b.id === blocId; });
    if (idx <= 0) return; // 1er bloc ou introuvable
    await swapBlocs(idx, idx - 1);
  }

  /**
   * Descend un bloc d'une place dans la trame.
   * Phase 5.6.B.
   */
  async function onMoveBlocDown(blocId) {
    const idx = State.blocs.findIndex(function (b) { return b.id === blocId; });
    if (idx < 0 || idx >= State.blocs.length - 1) return; // introuvable ou dernier
    await swapBlocs(idx, idx + 1);
  }

  /**
   * Supprime un bloc de la trame après confirmation.
   * Phase 5.6.B.
   */
  async function onRemoveBloc(blocId) {
    const bloc = State.blocs.find(function (b) { return b.id === blocId; });
    if (!bloc) return;
    const typeDef = lookupTypeBloc(bloc.type_bloc);
    const libType = (typeDef && typeDef.libelle) || bloc.type_bloc;
    const titre = bloc.titre_precision ? ' « ' + bloc.titre_precision + ' »' : '';
    const ok = window.confirm(
      'Supprimer le bloc ' + libType + titre + ' (' + bloc.duree_min + ' min) ?\n\n' +
      'Cette action est définitive.'
    );
    if (!ok) return;

    const res = await SupabaseHub.removeBloc(blocId);
    if (!res.ok) {
      console.error('SeanceEditor: onRemoveBloc() KO', res.error);
      alert('Erreur suppression : ' + res.error);
      return;
    }

    // Retire le bloc de State.blocs sans toucher aux autres ordres
    // (les ordres restent valides : il y a juste un trou, ce qui est OK
    // pour un ORDER BY ordre côté DB)
    State.blocs = State.blocs.filter(function (b) { return b.id !== blocId; });
    renderTrame();
  }

  // ----------------------------------------------------------
  // v1.10 (sql_108) — Actions au niveau ÉTAGE (voies parallèles)
  // ----------------------------------------------------------

  /**
   * Échange les `ordre` de deux étages adjacents (tous les blocs concernés).
   *
   * ⚠️ Ne PAS utiliser reorderBlocs ici : il réaffecte ordre=1,2,3… à plat
   * et écraserait le parallélisme (deux blocs au même ordre récupéreraient
   * des ordres distincts). On échange donc directement les valeurs `ordre`
   * via updateBloc, en préservant `voie`. Danse anti-collision : on parque
   * d'abord l'étage source sur un ordre temporaire haut (max+1000) pour ne
   * jamais violer l'unique (seance_id, ordre, voie) pendant la bascule.
   *
   * @param {number} ordreA étage à déplacer
   * @param {number} ordreB étage cible (adjacent)
   */
  async function _swapEtages(ordreA, ordreB) {
    const blocsA = State.blocs.filter(function (b) { return (b.ordre || 0) === ordreA; });
    const blocsB = State.blocs.filter(function (b) { return (b.ordre || 0) === ordreB; });
    if (blocsA.length === 0 || blocsB.length === 0) return;

    const maxOrdre = State.blocs.reduce(function (m, b) { return Math.max(m, b.ordre || 0); }, 0);
    const parking = maxOrdre + 1000;

    // Mise à jour optimiste en mémoire d'abord (render immédiat)
    blocsA.forEach(function (b) { b.ordre = ordreB; });
    blocsB.forEach(function (b) { b.ordre = ordreA; });
    renderTrame();

    try {
      // Passe 1 : parquer A (ordre source -> parking, voie préservée)
      for (let i = 0; i < blocsA.length; i++) {
        const r = await SupabaseHub.updateBloc(blocsA[i].id, { ordre: parking + i });
        if (!r.ok) throw new Error(r.error);
      }
      // Passe 2 : B prend l'ancien ordre de A
      for (const b of blocsB) {
        const r = await SupabaseHub.updateBloc(b.id, { ordre: ordreA });
        if (!r.ok) throw new Error(r.error);
      }
      // Passe 3 : A prend l'ordre de B (sort du parking)
      for (const b of blocsA) {
        const r = await SupabaseHub.updateBloc(b.id, { ordre: ordreB });
        if (!r.ok) throw new Error(r.error);
      }
    } catch (e) {
      console.error('SeanceEditor: _swapEtages() KO', e);
      alert('Erreur réordonnancement des étages : ' + e.message + '\n\nRechargement…');
      await loadBlocs();
      renderTrame();
    }
  }

  /** Monte un étage entier d'une position. */
  async function onMoveEtageUp(ordre) {
    const etages = _grouperBlocsParEtage(State.blocs);
    const idx = etages.findIndex(function (e) { return e.ordre === ordre; });
    if (idx <= 0) return; // premier étage ou introuvable
    await _swapEtages(ordre, etages[idx - 1].ordre);
  }

  /** Descend un étage entier d'une position. */
  async function onMoveEtageDown(ordre) {
    const etages = _grouperBlocsParEtage(State.blocs);
    const idx = etages.findIndex(function (e) { return e.ordre === ordre; });
    if (idx < 0 || idx >= etages.length - 1) return; // dernier ou introuvable
    await _swapEtages(ordre, etages[idx + 1].ordre);
  }

  /**
   * Dédouble un étage : ajoute une voie parallèle au même `ordre`.
   * Ouvre le picker de type ; le bloc choisi sera créé sur cet étage en
   * voie = (max voie de l'étage) + 1. On mémorise l'étage cible dans
   * State.dedoublerOrdre, consommé par onAddBloc.
   */
  function onDedoublerEtage(ordre) {
    State.dedoublerOrdre = ordre;
    // Réutilise le picker existant ; onAddBloc lira State.dedoublerOrdre.
    togglePicker();
  }

  // ------------------------------------------------------------------
  // v1.20 (sql_241) — CIRCUIT D'ATELIERS : bascule + durée de station.
  // Un étage parallèle peut devenir un "circuit" (les groupes tournent
  // sur les voies). L'état vit dans une fiche de marche
  // (seances_etages_circuits), 1 par étage rotatif, clé (seance_id, ordre).
  // Périmètre v1.20 = MÉCANISME (activer/désactiver + saisir la durée) ;
  // le rendu visuel de la rotation viendra dans un livrable dédié.
  // ------------------------------------------------------------------

  /**
   * Active ou désactive le mode circuit d'un étage parallèle.
   * Coché → crée la fiche de marche (saveCircuit) avec une durée par défaut.
   * Décoché → supprime la fiche (deleteCircuit). L'étage redevient un
   * parallèle simultané ordinaire. Mise à jour optimiste puis persistance ;
   * repli (rechargement) en cas d'échec.
   * @param {number} ordre ordre de l'étage
   * @param {boolean} actif nouvel état souhaité
   */
  async function onChangeCircuitDuree(ordre, valeur) {
    const circ = _circuitDeLetage(ordre);
    if (!circ) return; // pas de circuit sur cet étage — rien à faire
    let n = parseInt(valeur, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 240) n = 240;
    circ.duree_station_min = n; // optimiste
    const r = await SupabaseHub.saveCircuit({
      id: circ.id,
      seance_id: circ.seance_id,
      ordre: circ.ordre,
      duree_station_min: n,
      duree_pause_min: circ.duree_pause_min || 0 // préservé (upsert = ligne complète)
    });
    if (!r || !r.ok) {
      // Repli honnête : recharge l'état réel et re-render.
      await loadBlocs();
    }
    renderTrame();
  }

  /**
   * Change la pause entre stations d'un circuit (v1.21). Bornée 0..60.
   * Préserve la durée de station existante dans l'upsert.
   * @param {number} ordre ordre de l'étage-circuit
   * @param {string} valeur saisie brute de l'input
   */
  async function onChangeCircuitPause(ordre, valeur) {
    const circ = _circuitDeLetage(ordre);
    if (!circ) return;
    let n = parseInt(valeur, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 60) n = 60;
    circ.duree_pause_min = n; // optimiste
    const r = await SupabaseHub.saveCircuit({
      id: circ.id,
      seance_id: circ.seance_id,
      ordre: circ.ordre,
      duree_station_min: circ.duree_station_min, // préservé
      duree_pause_min: n
    });
    if (!r || !r.ok) {
      await loadBlocs();
    }
    renderTrame();
  }

  async function onToggleCircuit(ordre, actif) {
    if (!State.currentSeance) return;
    if (actif) {
      const existant = _circuitDeLetage(ordre);
      if (existant) { renderTrame(); return; } // déjà circuit
      const r = await SupabaseHub.saveCircuit({
        seance_id: State.currentSeance.id,
        ordre: ordre,
        duree_station_min: 15 // valeur de départ raisonnable, éditable ensuite
      });
      if (r && r.ok && r.data) {
        State.circuits.push(r.data); // optimiste sur la donnée réelle renvoyée
      } else {
        await loadBlocs(); // repli honnête
      }
    } else {
      const circ = _circuitDeLetage(ordre);
      if (circ) {
        const r = await SupabaseHub.deleteCircuit(circ.id);
        if (r && r.ok) {
          State.circuits = State.circuits.filter(function (c) { return c.id !== circ.id; });
        } else {
          await loadBlocs(); // repli honnête
        }
      }
    }
    renderTrame();
  }

  /**
   * Construit le payload complet d'un circuit pour un upsert (v1.26). L'upsert
   * réécrit la ligne entière : on repart de l'objet circ courant pour préserver
   * tous les champs, en appliquant les surcharges passées. Évite d'écraser
   * duree_station_min / duree_pause_min / mode / rotation_kind / roles_voies_jsonb.
   *
   * @param {object} circ fiche circuit courante
   * @param {object} surcharges champs à remplacer
   * @returns {object} payload prêt pour saveCircuit
   */
  function _payloadCircuit(circ, surcharges) {
    const base = {
      id: circ.id,
      seance_id: circ.seance_id,
      ordre: circ.ordre,
      duree_station_min: circ.duree_station_min,
      duree_pause_min: circ.duree_pause_min || 0,
      mode: circ.mode || 'circuit',
      rotation_kind: circ.rotation_kind || 'cyclique',
      roles_voies_jsonb: circ.roles_voies_jsonb || {}
    };
    return Object.assign(base, surcharges || {});
  }

  /**
   * Change le format d'un circuit (v1.26) : 'circuit' | 'rencontres'.
   * @param {number} ordre ordre de l'étage-circuit
   * @param {string} valeur nouveau mode
   */
  async function onChangeCircuitMode(ordre, valeur) {
    const circ = _circuitDeLetage(ordre);
    if (!circ) return;
    const mode = valeur === 'rencontres' ? 'rencontres' : 'circuit';
    circ.mode = mode; // optimiste
    const r = await SupabaseHub.saveCircuit(_payloadCircuit(circ, { mode: mode }));
    if (!r || !r.ok) { await loadBlocs(); }
    renderTrame();
  }

  /**
   * Change le type de rotation d'un circuit en mode rencontres (v1.26) :
   * 'cyclique' | 'vainqueur_reste'.
   * @param {number} ordre ordre de l'étage-circuit
   * @param {string} valeur nouveau rotation_kind
   */
  async function onChangeCircuitRotationKind(ordre, valeur) {
    const circ = _circuitDeLetage(ordre);
    if (!circ) return;
    const kind = valeur === 'vainqueur_reste' ? 'vainqueur_reste' : 'cyclique';
    circ.rotation_kind = kind; // optimiste
    const r = await SupabaseHub.saveCircuit(_payloadCircuit(circ, { rotation_kind: kind }));
    if (!r || !r.ok) { await loadBlocs(); }
    renderTrame();
  }

  /**
   * Bascule le rôle d'une voie (match <-> atelier) en mode rencontres (v1.26).
   * Le rôle est stocké dans roles_voies_jsonb sous la clé string de l'index.
   * @param {number} ordre ordre de l'étage-circuit
   * @param {number} idxVoie index de la voie dans l'étage
   */
  async function onToggleRoleVoie(ordre, idxVoie) {
    const circ = _circuitDeLetage(ordre);
    if (!circ) return;
    const map = (circ.roles_voies_jsonb && typeof circ.roles_voies_jsonb === 'object')
      ? Object.assign({}, circ.roles_voies_jsonb) : {};
    const cle = String(idxVoie);
    const actuel = map[cle] === 'match' ? 'match' : 'atelier';
    map[cle] = actuel === 'match' ? 'atelier' : 'match';
    circ.roles_voies_jsonb = map; // optimiste
    const r = await SupabaseHub.saveCircuit(_payloadCircuit(circ, { roles_voies_jsonb: map }));
    if (!r || !r.ok) { await loadBlocs(); }
    renderTrame();
  }

  /**
   * Export PDF (v1.10) — construit une vue d'impression simplifiée de la
   * trame puis déclenche window.print(). La mise en page (charte hub,
   * 1–3 pages, masquage de l'app) est portée par la feuille @media print
   * livrée à part. Aucune dépendance externe.
   *
   * La vue print est injectée dans #seance-print-root (créé à la volée),
   * visible uniquement à l'impression. On la régénère à chaque export pour
   * refléter l'état courant, puis on la vide après impression.
   */
  /**
   * Impression commune : injecte le HTML dans #seance-print-root et
   * déclenche window.print(). (v1.14 ; v1.15 : pilote document.title pour
   * proposer un nom de fichier distinct par export.)
   *
   * Le nom de fichier d'un PDF « imprimer vers PDF » est dérivé par le
   * navigateur du document.title. On le force juste avant l'impression
   * puis on le restaure (after-print) pour ne pas polluer l'onglet.
   *
   * @param {string} htmlContent
   * @param {string} [titreFichier] titre proposé comme nom de fichier
   */
  function _imprimerVue(htmlContent, titreFichier) {
    let root = document.getElementById('seance-print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'seance-print-root';
      document.body.appendChild(root);
    }
    root.innerHTML = htmlContent;

    const titreOriginal = document.title;
    if (titreFichier) document.title = titreFichier;

    // Restauration du titre après la boîte d'impression (ou à la volée).
    const restore = function () {
      document.title = titreOriginal;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    window.setTimeout(function () {
      window.print();
      // Filet de sécurité si afterprint ne se déclenche pas (certains envs).
      window.setTimeout(restore, 1500);
    }, 50);
  }

  /** Date de la séance en AAAA-MM-JJ pour préfixer les noms de fichier (v1.15). */
  function _dateFichierSeance() {
    const s = State.currentSeance;
    if (s && s.date_seance) {
      // date_seance est déjà ISO (AAAA-MM-JJ) ou parsable ; on garde les 10 1ers car.
      const iso = String(s.date_seance).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
    // Repli : date du jour.
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const jj = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + jj;
  }

  /** Libellé court de la catégorie (ex. « M14 ») pour les noms de fichier (v1.15). */
  function _libelleCategorieCourt() {
    const ctx = window.momSeanceContext;
    const raw = (ctx && ctx.categorie_uuid) ? String(ctx.categorie_uuid) : '';
    // 'cat-m14' -> 'M14' ; sinon repli 'M14' (module mono-équipe M14).
    const m = raw.replace(/^cat-/i, '').trim();
    return m ? m.toUpperCase() : 'M14';
  }

  /**
   * Charge les ateliers rattachés de TOUS les blocs de la séance (v1.14).
   * State.ateliersRattaches ne contient que le bloc courant ; pour le PDF
   * Coach il faut tous les blocs. Renvoie une Map blocId -> [rattachements].
   * Échec d'un bloc -> entrée vide (honest degradation, pas de blocage).
   */
  async function _chargerAteliersTousBlocs() {
    const map = {};
    const blocs = State.blocs || [];
    await Promise.all(blocs.map(async function (b) {
      try {
        const rats = await SupabaseHub.listAteliersRattachesAuBloc(b.id);
        map[b.id] = Array.isArray(rats) ? rats : [];
      } catch (e) {
        console.warn('SeanceEditor: chargement ateliers bloc ' + b.id + ' KO', e);
        map[b.id] = [];
      }
    }));
    return map;
  }

  /**
   * Export PDF COACH (v1.14) — complet : tous les détails par bloc +
   * section ateliers rattachés (titre + lien Drive cliquable). Asynchrone
   * car il charge les ateliers de tous les blocs avant de rendre.
   */
  async function onExportPdfCoach() {
    if (!State.currentSeance) return;
    const btn = document.getElementById('seance-btn-export-pdf-coach');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Préparation…'; }
    try {
      const ateliersParBloc = await _chargerAteliersTousBlocs();
      const nomFichier = _dateFichierSeance() + ' - MOM Hub · Séance ' + _libelleCategorieCourt() + ' coachs';
      _imprimerVue(_buildPrintHtml('coach', ateliersParBloc), nomFichier);
    } catch (e) {
      console.error('SeanceEditor: onExportPdfCoach() KO', e);
      alert('Erreur préparation du PDF Coach : ' + (e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🖨 PDF Coach'; }
    }
  }

  /**
   * Export PDF JOUEURS (v1.14) — compact : tableau 5 colonnes (type, durée,
   * intensité, titre/précision, coachs). Pas d'axe4, notes, ni ateliers.
   */
  function onExportPdfJoueurs() {
    if (!State.currentSeance) return;
    const nomFichier = _dateFichierSeance() + ' - MOM Hub · Séance ' + _libelleCategorieCourt() + ' joueurs';
    _imprimerVue(_buildPrintHtml('joueurs', null), nomFichier);
  }

  /**
   * Construit le HTML simplifié de la trame pour l'impression (v1.10).
   * Reprend les données de State (séance + étages) sans les contrôles
   * d'édition. Les voies parallèles d'un étage sont listées ensemble.
   */
  /**
   * Traduit un slug en libellé lisible via le vocabulaire d'un axe (v1.12).
   * Renvoie le slug brut si non trouvé (jamais vide).
   */
  function _libelleSlugAxe(axeKey, slug) {
    if (!slug) return '';
    const vals = lookupVocabAxe(axeKey);
    const found = vals.find(function (v) { return v.slug === slug; });
    return found ? found.libelle : slug;
  }

  /** Libellé lisible d'une intensité (slug -> libellé, v1.12). */
  function _libelleIntensite(slug) {
    if (!slug) return '';
    const vals = (State.typesBlocsRef && State.typesBlocsRef.intensites && State.typesBlocsRef.intensites.valeurs) || [];
    const found = vals.find(function (v) { return v.slug === slug; });
    return found ? ((found.emoji ? found.emoji + ' ' : '') + found.libelle) : slug;
  }

  /**
   * Résumé lisible du contenu pédagogique axe 4 d'un bloc (v1.12).
   * contenu_pedagogique_axe4 = { slug_champ_ffr: texte }. On traduit les
   * slugs en libellés (axe_4_champs_ffr) et on rend « Libellé : texte ».
   * Renvoie '' si vide.
   */
  function _resumeAxe4(axe4) {
    if (!axe4 || typeof axe4 !== 'object') return '';
    const lignes = [];
    Object.keys(axe4).forEach(function (slug) {
      const v = axe4[slug];
      if (v && String(v).trim()) {
        lignes.push('<strong>' + escapeHtml(_libelleSlugAxe('axe_4_champs_ffr', slug)) + '</strong> : ' + escapeHtml(String(v).trim()));
      }
    });
    return lignes.join('<br>');
  }

  /**
   * Construit le HTML d'impression (v1.14). Deux modes :
   *  - 'coach'   : complet (détails par bloc + ateliers rattachés liés Drive).
   *  - 'joueurs' : compact (tableau 5 colonnes).
   * @param {'coach'|'joueurs'} mode
   * @param {Object|null} ateliersParBloc map blocId -> [rattachements] (mode coach)
   */
  function _buildPrintHtml(mode, ateliersParBloc) {
    const s = State.currentSeance;
    const heureDebut = s.heure_debut ? normalizeHeureForInput(s.heure_debut) : null;
    const dateStr = s.date_seance ? formatDateShort(s.date_seance) : '';
    const isJoueurs = (mode === 'joueurs');

    // En-tête séance (commun)
    let html =
      '<div class="seance-print">' +
        '<header class="seance-print__header">' +
          '<div class="seance-print__brand">' +
            '<img class="seance-print__logo" src="assets/logo-m2m.png" alt="MOM Rugby">' +
            '<div class="seance-print__brand-text">' +
              '<h1 class="seance-print__titre">Trame de séance' +
                (s.theme_principal ? ' — ' + escapeHtml(s.theme_principal) : '') +
                '<span class="seance-print__public"> · ' + (isJoueurs ? 'Joueurs' : 'Coachs') + '</span>' +
              '</h1>' +
              '<div class="seance-print__meta">' +
                (dateStr ? '<span>📅 ' + escapeHtml(dateStr) + '</span>' : '') +
                (heureDebut ? '<span>🕒 ' + escapeHtml(heureDebut) + '</span>' : '') +
                (s.duree_totale_min ? '<span>⏱ ' + s.duree_totale_min + ' min prévues</span>' : '') +
                (s.encadrants_text ? '<span>👥 ' + escapeHtml(s.encadrants_text) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          (s.objectifs_text ? '<p class="seance-print__objectifs">🎯 ' + escapeHtml(s.objectifs_text) + '</p>' : '') +
        '</header>';

    const etages = _grouperBlocsParEtage(State.blocs);

    if (etages.length === 0) {
      html += '<p class="seance-print__vide">Aucun bloc dans cette trame.</p>';
    } else if (isJoueurs) {
      // ----- MODE JOUEURS : tableau compact 5 colonnes -----
      html +=
        '<table class="seance-print__jtable">' +
          '<colgroup>' +
            '<col class="c-horaire"><col class="c-bloc"><col class="c-duree">' +
            '<col class="c-intensite"><col class="c-coachs">' +
          '</colgroup>' +
          '<thead><tr>' +
          '<th>Horaire</th><th>Bloc</th><th>Durée</th><th>Intensité</th><th>Coachs</th>' +
        '</tr></thead><tbody>';
      let cur = heureDebut;
      etages.forEach(function (etage) {
        const fin = cur ? addMinutesToHeure(cur, _dureeEffectiveEtage(etage)) : '';
        const horaire = cur ? (cur + (fin ? '→' + fin : '')) : '—';
        const parallele = etage.blocs.length > 1;
        etage.blocs.forEach(function (b, k) {
          const t = lookupTypeBloc(b.type_bloc);
          const emoji = (t && t.emoji) || '·';
          const libType = (t && t.libelle) || b.type_bloc;
          const titre = b.titre_precision ? ' — ' + escapeHtml(b.titre_precision) : '';
          const intensite = _libelleIntensite(b.intensite) || '—';
          const coachs = _nomsCoachsBloc(b);
          const coachLabel = coachs.length ? coachs.join(', ') : '—';
          // L'horaire n'est affiché que sur la 1re voie de l'étage.
          html +=
            '<tr>' +
              '<td class="seance-print__horaire">' + (k === 0 ? horaire : '') + '</td>' +
              '<td>' + (parallele ? '∥ ' : '') + emoji + ' ' + escapeHtml(libType) + titre + '</td>' +
              '<td class="seance-print__duree">' + b.duree_min + ' min</td>' +
              '<td>' + escapeHtml(intensite) + '</td>' +
              '<td>' + escapeHtml(coachLabel) + '</td>' +
            '</tr>';
        });
        if (cur) cur = fin;
      });
      html += '</tbody></table>';
    } else {
      // ----- MODE COACH : fiches détaillées par étage + ateliers liés -----
      let cur = heureDebut;
      etages.forEach(function (etage) {
        const fin = cur ? addMinutesToHeure(cur, _dureeEffectiveEtage(etage)) : '';
        const horaire = cur ? (cur + (fin ? ' → ' + fin : '')) : '—';
        const parallele = etage.blocs.length > 1;
        const circPdf = _circuitDeLetage(etage.ordre); // v1.24 : circuit ? (durée station + matrice PDF)

        html +=
          '<section class="seance-print__etage' + (parallele ? ' seance-print__etage--parallele' : '') + '">' +
            '<div class="seance-print__etage-head">' +
              '<span class="seance-print__etage-horaire">' + horaire + '</span>' +
              '<span class="seance-print__etage-duree">' + _dureeEffectiveEtage(etage) + ' min' +
                (parallele ? ' · ∥ ' + etage.blocs.length + ' voies parallèles' : '') +
              '</span>' +
            '</div>' +
            '<div class="seance-print__voies' + (parallele ? ' seance-print__voies--par' : '') + '">';

        etage.blocs.forEach(function (b) {
          const t = lookupTypeBloc(b.type_bloc);
          const emoji = (t && t.emoji) || '·';
          const libType = (t && t.libelle) || b.type_bloc;
          const coachs = _nomsCoachsBloc(b);
          const intensite = _libelleIntensite(b.intensite);
          const axe2 = _libelleSlugAxe('axe_2_types_unites', b.etiquette_axe2);
          const axe3 = _libelleSlugAxe('axe_3_composants_echauffement', b.etiquette_axe3);
          const resumeAxe4 = _resumeAxe4(b.contenu_pedagogique_axe4);
          const coachsTags = coachs.map(function (nom) {
            return '<span class="seance-print__tag">👤 ' + escapeHtml(nom) + '</span>';
          }).join('');

          // Ateliers rattachés à ce bloc (lien Drive cliquable).
          let ateliersHtml = '';
          const rats = (ateliersParBloc && ateliersParBloc[b.id]) ? ateliersParBloc[b.id] : [];
          if (rats.length) {
            ateliersHtml += '<div class="seance-print__ateliers"><strong>📚 Ateliers :</strong>';
            rats.forEach(function (rat) {
              const fiche = lookupFiche(rat.atelier_fileid_drive);
              const lib = fiche ? libelleFicheCourt(fiche) : '(fiche)';
              const url = urlDriveDossier(rat.atelier_fileid_drive);
              ateliersHtml +=
                '<div class="seance-print__atelier">' +
                  '• ' + escapeHtml(lib) +
                  ' <a class="seance-print__atelier-lien" href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>' +
                  (rat.notes_atelier ? '<span class="seance-print__atelier-note"> — ' + escapeHtml(rat.notes_atelier) + '</span>' : '') +
                '</div>';
            });
            ateliersHtml += '</div>';
          }

          html +=
            '<div class="seance-print__bloc">' +
              '<div class="seance-print__bloc-titre">' +
                emoji + ' <strong>' + escapeHtml(libType) + '</strong>' +
                (b.titre_precision ? ' — ' + escapeHtml(b.titre_precision) : '') +
                (circPdf && circPdf.duree_station_min ? ' <span class="seance-print__bloc-station">(' + circPdf.duree_station_min + ' min / station)</span>' : '') +
              '</div>' +
              '<div class="seance-print__bloc-tags">' +
                coachsTags +
                (intensite ? '<span class="seance-print__tag">💥 ' + escapeHtml(intensite) + '</span>' : '') +
                (axe2 ? '<span class="seance-print__tag">🏷 ' + escapeHtml(axe2) + '</span>' : '') +
                (axe3 ? '<span class="seance-print__tag">🏷 ' + escapeHtml(axe3) + '</span>' : '') +
              '</div>' +
              (resumeAxe4 ? '<div class="seance-print__bloc-axe4">' + resumeAxe4 + '</div>' : '') +
              (b.notes_bloc ? '<div class="seance-print__bloc-notes">📝 ' + escapeHtml(b.notes_bloc) + '</div>' : '') +
              ateliersHtml +
            '</div>';
        });

        html += '</div>';
        if (circPdf) {
          html += (circPdf.mode === 'rencontres')
            ? _matriceRencontresHtmlPdf(etage, circPdf)
            : _matriceRotationHtmlPdf(etage, circPdf);
        }
        html += '</section>';
        if (cur) cur = fin;
      });
    }

    html +=
        '<footer class="seance-print__footer">' +
          'MOM Hub · Préparation de séance' +
        '</footer>' +
      '</div>';
    return html;
  }

  // ----------------------------------------------------------
  // Phase 5.7 — Actions vue détail bloc
  // ----------------------------------------------------------

  /**
   * Ouvre la vue détail d'un bloc (remplace la trame).
   * @param {string} blocId UUID du bloc à éditer
   */
  async function onOpenBlocDetail(blocId) {
    const bloc = State.blocs.find(function (b) { return b.id === blocId; });
    if (!bloc) {
      console.error('SeanceEditor: onOpenBlocDetail() bloc introuvable', blocId);
      return;
    }
    State.currentBloc = bloc;
    State.blocIsDirty = false;
    State.view = 'bloc-detail';
    // Phase 5.8 : charger les rattachements ateliers AVANT le 1er rendu
    // pour que la section "Ateliers rattachés" s'affiche d'emblée.
    State.ateliersRattaches = await SupabaseHub.listAteliersRattachesAuBloc(blocId);
    renderTrame();             // bascule la vue (renderTrame appelle renderBlocDetail si view='bloc-detail')
    setBlocAutosaveStatus('idle');
    startBlocAutosave();
  }

  /**
   * Ferme la vue détail (retour à la trame).
   * Si des modifs sont en cours sur le bloc, confirm().
   */
  function onCloseBlocDetail() {
    if (State.blocIsDirty) {
      const ok = window.confirm(
        'Tu as des modifications non sauvées sur ce bloc.\n\n' +
        'Retour à la trame sans sauver ? (Annuler pour rester)'
      );
      if (!ok) return;
    }
    stopBlocAutosave();
    State.view = 'trame';
    State.currentBloc = null;
    State.blocIsDirty = false;
    State.ateliersRattaches = []; // Phase 5.8 : vider le cache
    closeFichePicker();           // Phase 5.8 : fermer le picker si ouvert
    closeGroupePicker();          // Phase 5.9 : idem pour le picker groupe
    renderTrame();
  }

  /**
   * Sauvegarde du bloc courant (manuel ou silencieux selon opts.silent).
   * Partagée par onSaveBloc (clic bouton) et onTickBlocAutosave (timer).
   *
   * @param {object} [opts]
   * @param {boolean} [opts.silent=false]
   * @returns {Promise<boolean>}
   */
  async function saveBloc(opts) {
    if (!State.currentBloc) return false;
    if (!State.blocIsDirty) return false;
    const silent = !!(opts && opts.silent);

    const btn = DOM.blocBtnSave();
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Enregistrement…';
    }
    setBlocAutosaveStatus('saving');

    // Collecte des valeurs depuis le DOM
    const patch = {};
    DOM.blocInputs().forEach(function (el) {
      const field = el.getAttribute('data-bloc-field');
      const axe4Slug = el.getAttribute('data-bloc-field-axe4');
      if (field) {
        let val = el.value;
        // Trim pour les chaînes, parseInt pour duree_min
        if (field === 'duree_min') {
          val = parseInt(val, 10);
          if (isNaN(val) || val < 1) val = 1;
        } else if (typeof val === 'string') {
          val = val.trim() || null;
        }
        patch[field] = val;
      }
    });

    // Reconstruction du jsonb contenu_pedagogique_axe4
    const axe4Patch = {};
    document.querySelectorAll('[data-bloc-field-axe4]').forEach(function (el) {
      const slug = el.getAttribute('data-bloc-field-axe4');
      const v = (el.value || '').trim();
      if (v) axe4Patch[slug] = v;
    });
    patch.contenu_pedagogique_axe4 = axe4Patch;

    // v1.13 — Multi-coachs : agrège les cases cochées de la pioche en
    // encadrants_ids (uuid[]). Ces cases portent data-coach-id (hors
    // collecte générique data-bloc-field). Liste vide = aucun coach.
    const encadrantsIds = [];
    document.querySelectorAll('.seance-coachs-pioche__cb').forEach(function (cb) {
      if (cb.checked) {
        const id = cb.getAttribute('data-coach-id');
        if (id && encadrantsIds.indexOf(id) === -1) encadrantsIds.push(id);
      }
    });
    patch.encadrants_ids = encadrantsIds;

    const res = await SupabaseHub.updateBloc(State.currentBloc.id, patch);

    if (!res.ok) {
      console.error('SeanceEditor: saveBloc() KO', res.error);
      setBlocAutosaveStatus('error');
      if (!silent) alert('Erreur sauvegarde du bloc : ' + res.error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer le bloc';
      }
      return false;
    }

    // Succès : MAJ State.currentBloc + ligne dans State.blocs
    State.currentBloc = res.data;
    const idx = State.blocs.findIndex(function (b) { return b.id === res.data.id; });
    if (idx !== -1) State.blocs[idx] = res.data;
    setBlocDirty(false);
    setBlocAutosaveStatus('idle');

    // Si le type a changé, on doit re-render le détail (étiquettes peuvent changer)
    // + on re-render la trame (emoji/libellé du type peut changer) — au retour seulement
    return true;
  }

  async function onSaveBloc() {
    await saveBloc({ silent: false });
  }

  async function onTickBlocAutosave() {
    if (!State.blocIsDirty) return;
    if (State.blocAutosaveStatus === 'saving') return;
    await saveBloc({ silent: true });
  }

  function startBlocAutosave() {
    stopBlocAutosave();
    State.blocAutosaveTimer = setInterval(onTickBlocAutosave, AUTOSAVE_INTERVAL_MS);
  }

  function stopBlocAutosave() {
    if (State.blocAutosaveTimer) {
      clearInterval(State.blocAutosaveTimer);
      State.blocAutosaveTimer = null;
    }
  }

  // ============================================================
  // 7. CHARGEMENTS
  // ============================================================

  async function loadSeances() {
    // Phase 5.10 : respecte le toggle "Afficher les archivées" et
    // rafraîchit en parallèle le compteur de brouillons vides
    const [seances] = await Promise.all([
      SupabaseHub.listSeancesByEquipe(null, {
        categorieId: _catActive(),
        limit: NB_SEANCES_RECENTES,
        excludeArchivees: !State.showArchivees
      }),
      loadBrouillonsVides()
    ]);
    State.seances = seances;
  }

  /**
   * Charge la liste des brouillons vides du M14 (Phase 5.10).
   * Met à jour State.brouillonsVides. Le compteur est ensuite affiché
   * en bas de sidebar par renderSidebar.
   */
  async function loadBrouillonsVides() {
    State.brouillonsVides = await SupabaseHub.listBrouillonsVides(null, _catActive());
  }

  async function loadSites() {
    State.sites = await SupabaseHub.listSitesActifs();
  }

  async function loadEvenements() {
    // Fenêtre de 60 jours par défaut, élargie à l'usage : on couvre la
    // prochaine demi-saison sans submerger le dropdown.
    State.evenements = await SupabaseHub.getEvenementsAVenir(null, 60, _catActive());
  }

  /**
   * Charge le référentiel data/types-blocs.json (Phase 5.6.A).
   * Appelé une seule fois à l'init. Mis en cache dans State.typesBlocsRef.
   */
  async function loadTypesBlocsRef() {
    try {
      const resp = await fetch('data/types-blocs.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.typesBlocsRef = await resp.json();
    } catch (e) {
      console.error('SeanceEditor: loadTypesBlocsRef() KO', e);
      State.typesBlocsRef = null;
    }
  }

  /**
   * Charge le référentiel data/vocabulaire-seance.json (Phase 5.7).
   * 4 axes du Vocabulaire MOM Hub. Utilisé pour les dropdowns Axe 2 / Axe 3
   * et les 10 champs FFR Axe 4 dans la vue détail bloc.
   */
  async function loadVocabulaireRef() {
    try {
      const resp = await fetch('data/vocabulaire-seance.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.vocabulaireRef = await resp.json();
    } catch (e) {
      console.error('SeanceEditor: loadVocabulaireRef() KO', e);
      State.vocabulaireRef = null;
    }
  }

  /**
   * Charge le miroir Bibliothèque (Phase 5.8). Top-level = objet
   * { fileId_dossier (33 chars) : { source, cartouche, pedagogie, media, files } }
   * avec ~62 fiches. Régénéré manuellement par le converter Python depuis Drive.
   * En cas d'échec (fichier absent / réseau), State.fichesRef reste null et
   * le picker affichera un message d'erreur — pas de crash.
   */
  async function loadFichesRef() {
    try {
      const resp = await fetch('data/fiches-all.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.fichesRef = await resp.json();
      const nb = State.fichesRef ? Object.keys(State.fichesRef).length : 0;
      console.log('SeanceEditor: fiches-all.json chargé (' + nb + ' fiches)');
    } catch (e) {
      console.error('SeanceEditor: loadFichesRef() KO', e);
      State.fichesRef = null;
    }
  }

  /**
   * Charge le référentiel des 3 groupes (Phase 5.9).
   * Structure : { _meta:{...}, groupes:[{uuid, libelle_court, couleur, ordre, ...}, ...] }
   * En cas d'échec, fallback hardcodé sur les 3 libellés par défaut.
   */
  async function loadGroupesRef() {
    try {
      const resp = await fetch('data/groupes-joueur.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.groupesRef = await resp.json();
      const nb = (State.groupesRef && State.groupesRef.groupes) ? State.groupesRef.groupes.length : 0;
      console.log('SeanceEditor: groupes-joueur.json chargé (' + nb + ' groupes)');
    } catch (e) {
      console.error('SeanceEditor: loadGroupesRef() KO, fallback hardcodé', e);
      // Fallback en cas d'absence du fichier : on garde la fonctionnalité
      State.groupesRef = {
        groupes: [
          { libelle_court: 'Performance',   couleur: '#8B0000', ordre: 10, actif: true },
          { libelle_court: 'Développement', couleur: '#FF8C00', ordre: 20, actif: true },
          { libelle_court: 'Initiation',    couleur: '#4682B4', ordre: 30, actif: true }
        ]
      };
    }
  }

  /**
   * Charge le référentiel des propositions pré-saisies (Phase 5.12).
   * Structure : { _meta:{...}, meta_seance:[{slug, libelle, propositions}...],
   *               detail_bloc:[...], axe_4_ffr:[...], materiel_propose:[...] }
   * En cas d'échec (fichier absent / réseau), State.propositionsRef reste null
   * et les datalist seront simplement vides — saisie libre conservée.
   */
  async function loadPropositionsRef() {
    try {
      const resp = await fetch('data/propositions-seance.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.propositionsRef = await resp.json();
      const nbMeta = (State.propositionsRef.meta_seance || []).length;
      const nbBloc = (State.propositionsRef.detail_bloc || []).length;
      const nbAxe4 = (State.propositionsRef.axe_4_ffr || []).length;
      const nbMat  = (State.propositionsRef.materiel_propose || []).length;
      console.log('SeanceEditor: propositions-seance.json chargé (' + nbMeta + ' méta, ' +
                  nbBloc + ' bloc, ' + nbAxe4 + ' Axe 4, ' + nbMat + ' matériels)');
    } catch (e) {
      console.warn('SeanceEditor: loadPropositionsRef() KO, datalist vides', e);
      State.propositionsRef = null;
    }
  }

  /**
   * Charge le vivier de la catégorie active via la RPC get_vivier_compo_categorie.
   * Indexe les joueurs par joueur_id dans une Map pour lookup rapide.
   * Pattern identique à compositions-editor.js (Phase 4.4).
   */
  /**
   * Charge les encadrants de la catégorie de l'utilisateur (Phase 5.12 TER).
   */
  async function loadEncadrantsForCategorie() {
    try {
      const categorie = window.momSeanceContext && window.momSeanceContext.categorie_uuid 
                        ? window.momSeanceContext.categorie_uuid 
                        : 'cat-m14';
      const resp = await fetch('data/encadrants-par-categorie.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      const catData = data[categorie];
      State.encadrantsRef = (catData && catData.encadrants) ? catData.encadrants : [];
      const nbEnc = State.encadrantsRef.length;
      console.log('SeanceEditor: encadrants-par-categorie.json chargé (' + nbEnc + ' encadrants pour ' + categorie + ')');
    } catch (e) {
      console.warn('SeanceEditor: loadEncadrantsForCategorie() KO, saisie libre active', e);
      State.encadrantsRef = [];
    }
  }

  /**
   * Charge le staff assignable comme ENCADRANT D'UN BLOC (v1.10, sql_108).
   *
   * ⚠️ Source distincte du picker encadrants de la séance : ce dernier
   * s'alimente du miroir data/encadrants-par-categorie.json, dont les
   * `uuid` sont factices (enc-m14-1…) et NE correspondent PAS à
   * personnes.id. Or encadrant_id est une vraie FK -> personnes(id) :
   * on a donc besoin des UUID réels, fournis uniquement par la RPC
   * list_staff_disponibles (wrapper listStaffDisponibles).
   *
   * Sortie stockée : State.staffDisponible = [{personne_id, nom, prenom}].
   * Échec → tableau vide → le <select> coach n'affiche que « — Aucun ».
   */
  async function loadStaffDisponibles() {
    try {
      // Chantier SEANCE-RATTACHEMENT-CATEGORIE — la pioche staff se résout
      // désormais DIRECTEMENT depuis la catégorie active (State.perimetreCat.
      // active), sans détour par l'équipe (getCategorieEquipe supprimé ici).
      // GARDE : pas de catégorie active → pioche VIDE (on ne tombe pas sur
      // list_staff_disponibles(null) = tout le staff club, bug recette M6).
      const categorieId = _catActive();
      if (!categorieId) {
        State.staffDisponible = [];
        console.log('SeanceEditor: aucune catégorie active → pioche staff vide.');
        return;
      }

      const liste = await SupabaseHub.listStaffDisponibles(categorieId);
      State.staffDisponible = Array.isArray(liste) ? liste : [];
      console.log('SeanceEditor: staff disponible chargé (' + State.staffDisponible.length + ' personnes assignables par bloc, categorie=' + categorieId + ')');
    } catch (e) {
      console.warn('SeanceEditor: loadStaffDisponibles() KO, sélecteur coach vide', e);
      State.staffDisponible = [];
    }
  }

  async function loadVivier() {
    // Chantier VIVIER-COMPO-CATEGORIE — vivier joueurs indexé CATÉGORIE
    // (rattachement séances→catégorie, pt 181), plus l'équipe. Source de la
    // catégorie : _catActive() (= State.perimetreCat.active), peuplé avant cet
    // appel dans la séquence d'init. RPC get_vivier_compo_categorie.
    const catId = _catActive();
    if (!catId) {
      State.vivier = [];
      State.vivierById = new Map();
      console.log('SeanceEditor: vivier non chargé (aucune catégorie active).');
      return;
    }
    try {
      State.vivier = await SupabaseHub.getVivierCompoCategorie(catId);
      State.vivierById = new Map();
      (State.vivier || []).forEach(function (j) {
        if (j && j.joueur_id) State.vivierById.set(j.joueur_id, j);
      });
      console.log('SeanceEditor: vivier chargé (' + (State.vivier ? State.vivier.length : 0) + ' joueurs)');
    } catch (e) {
      console.error('SeanceEditor: loadVivier() KO', e);
      State.vivier = [];
      State.vivierById = new Map();
    }
  }

  /**
   * Charge les blocs de la séance courante (Phase 5.6.A).
   */
  async function loadBlocs() {
    if (!State.currentSeance) {
      State.blocs = [];
      State.circuits = [];
      return;
    }
    State.blocs = await SupabaseHub.listBlocsBySeance(State.currentSeance.id);
    // Circuits d'ateliers (sql_241) : fiches de marche des étages rotatifs.
    // Chargés en parallèle des blocs ; [] si le wrapper est absent (repli honnête).
    if (typeof SupabaseHub !== 'undefined' && typeof SupabaseHub.listCircuits === 'function') {
      State.circuits = await SupabaseHub.listCircuits(State.currentSeance.id);
    } else {
      State.circuits = [];
    }
  }

  /**
   * Retourne la fiche de marche circuit d'un étage donné (par son `ordre`),
   * ou null si l'étage n'est pas un circuit. Clé (seance_id, ordre) : au plus
   * un circuit par étage (unicité base sql_241).
   * @param {number} ordre ordre de l'étage
   * @returns {object|null}
   */
  function _circuitDeLetage(ordre) {
    if (!Array.isArray(State.circuits)) return null;
    return State.circuits.find(function (c) { return c.ordre === ordre; }) || null;
  }

  // ============================================================
  // 8. INIT
  // ============================================================

  async function init() {
    // Périmètre de catégorie active + équipe active (multi-cat).
    // Résolu AVANT les chargements pour que les 5 appels lisent la
    // bonne équipe via _equipeActive(). Repli silencieux si le socle
    // est absent (équipe active = M14, comportement d'origine).
    if (typeof SupabaseHub !== 'undefined'
        && typeof SupabaseHub.resoudrePerimetreCategories === 'function') {
      try {
        State.perimetreCat = await SupabaseHub.resoudrePerimetreCategories();
      } catch (e) {
        console.warn('SeanceEditor: périmètre catégories indisponible, repli M14.', e);
        State.perimetreCat = null;
      }
    }
    State.equipesCategorieActive = await _seanceResoudreEquipesCategorieActive();
    _seanceChoisirEquipeActive(); // pose State.equipeActive (repli M14 si vide)

    // Chargements parallèles : séances pour la sidebar (couple aussi le
    // compteur de brouillons vides Phase 5.10), sites et événements pour
    // les dropdowns du formulaire, types-blocs.json pour la trame (5.6.A),
    // vocabulaire-seance.json pour le détail bloc (5.7), fiches-all.json
    // pour le picker ateliers (5.8), groupes-joueur.json + vivier catégorie pour
    // les groupes G1/G2/G3 par bloc (5.9), propositions-seance.json pour
    // les datalist + matériel (5.12)
    await Promise.all([
      loadSeances(),
      loadSites(),
      loadEvenements(),
      loadTypesBlocsRef(),
      loadVocabulaireRef(),
      loadFichesRef(),
      loadGroupesRef(),
      loadVivier(),
      loadPropositionsRef(),
      loadEncadrantsForCategorie(),
      loadStaffDisponibles()
    ]);

    renderSidebar();
    renderEmptyEditor();

    // Sélecteurs multi-cat : catégorie (helper UI, si > 1 catégorie)
    // + équipe (inline, si la catégorie active a > 1 équipe). Mono-cat
    // mono-équipe (cas réel actuel) → aucun sélecteur, UX inchangée.
    if (typeof UXSelecteurCategorie !== 'undefined'
        && typeof UXSelecteurCategorie.monter === 'function'
        && State.perimetreCat) {
      UXSelecteurCategorie.monter({
        perimetre: State.perimetreCat,
        ancreSelector: '.seance-header',
        teamSpanSelector: '.seance-header__title',
        titreDocument: 'MOM Hub · Séance',
        wrapId: 'seance-cat-selecteur-wrap',
        selectId: 'seance-cat-selecteur',
        onChange: async function () {
          await _seanceOnChangementCategorie();
        }
      });
    }
    _monterSelecteurEquipe();
    const sidebarCta = DOM.sidebarCta();
    if (sidebarCta) {
      sidebarCta.disabled = false;
      sidebarCta.addEventListener('click', onNouvelleSeance);
    }
    const ctaCenter = DOM.ctaCenter();
    if (ctaCenter) {
      ctaCenter.disabled = false;
      ctaCenter.textContent = '+ Nouvelle séance';
      ctaCenter.addEventListener('click', onNouvelleSeance);
    }

    // Phase 5.6.A : câbler le clic en dehors pour fermer le picker
    bindPickerOutsideClick();

    // Warn si modif non sauvée à la fermeture de l'onglet (V1A : check basique)
    // + arrêt propre des 2 timers autosave (Phase 5.5.B2 + 5.7)
    window.addEventListener('beforeunload', function (e) {
      stopAutosave();
      stopBlocAutosave();
      if (State.isDirty || State.blocIsDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    console.log(
      '%c🏉 Seance Editor v1.18.1 (parallèles + multi-coachs + PDF + soft-delete durci) chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        seances: State.seances.length,
        sites: State.sites.length,
        evenements: State.evenements.length,
        types_blocs_ref: State.typesBlocsRef ? 'OK' : 'KO',
        vocabulaire_ref: State.vocabulaireRef ? 'OK' : 'KO',
        autosave_interval_ms: AUTOSAVE_INTERVAL_MS
      }
    );
  }

  // ============================================================
  // 9. EXPOSITION PUBLIQUE
  // ============================================================

  window.SeanceEditor = {
    init: init,
    state: State,
    loadSeances: loadSeances,
    loadSites: loadSites,
    loadEvenements: loadEvenements,
    loadBlocs: loadBlocs,
    loadVocabulaireRef: loadVocabulaireRef,
    // Phase 5.5.B2 : exposition autosave pour debug console
    startAutosave: startAutosave,
    stopAutosave: stopAutosave,
    // Phase 5.7 : exposition autosave bloc
    startBlocAutosave: startBlocAutosave,
    stopBlocAutosave: stopBlocAutosave
  };

})();
