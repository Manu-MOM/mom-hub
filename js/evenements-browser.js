/**
 * MOM Hub · Évènements Browser
 * ============================================================
 * Logique du module Évènements (page evenements.html).
 *
 * Responsabilités :
 *   1. Charger les évènements à venir + passés de l'équipe M14 via RPC Supabase
 *   2. Rendre la vue Liste verticale chronologique (cartes complètes)
 *   3. Gérer les filtres TYPE + COMPÉTITION + recherche libre
 *   4. Gérer le déploiement inline des tournois (parents + matchs enfants)
 *   5. Gérer le mini-calendrier sidebar (2 mois, clic = scroll)
 *   6. Gérer la fiche détaillée E2 (S2.3)
 *   7. Gérer les modales E3 Création / E4 Annulation / E5 Ajout match (S2.4)
 *
 * Architecture :
 *   - Module IIFE exposant window.EvenementsBrowser.init()
 *   - Suit le pattern bibliotheque-browser.js
 *   - Préfixage CSS .evt-* strict dans evenements.html
 *
 * Dépendances :
 *   - SupabaseHub v1.10+ (RPC événements C9 : sql/29)
 *   - DOM : voir evenements.html (zone #evt-list, KPIs, filtres, sidebar, modales)
 *
 * Version : 1.63 — EVT-CREATION-HEURE-MINUIT : date_debut composée avec l'heure de début au submit (9 juillet 2026)
 *   v1.63 : CAUSE RACINE DU BUG MINUIT RÉSORBÉE. submitModalCreate (chemin
 *           partagé création + édition) envoyait date_debut =
 *           new Date(<input date>).toISOString() → date-seule parsée minuit
 *           UTC par la spec JS, alors que debut_match était lu et envoyé
 *           SÉPARÉMENT (TIME) : la racine naissait « sans heure » (convention
 *           pt 167) et toute ÉDITION re-calait à minuit une mère réparée
 *           (pt 183). Correctif : si debut_match est saisi, date_debut =
 *           new Date(dateDebut + 'T' + heure).toISOString() (parsing LOCAL →
 *           fuseau navigateur, 19:15 Paris été = 17:15Z). Sans heure :
 *           inchangé. Sites voulus tels quels et NON touchés : date_fin
 *           (borne date-seule), dates de phase, duplication (debut_match non
 *           copié), submitModalEdit (code mort). Purement additif (+N/−0).
 * Version : 1.62 — Vignette « Statistiques » câblée (deep-link pilotage.html?evenement_equipe=) (4 juin 2026)
 *   v1.62 : VIGNETTE #8 STATISTIQUES CÂBLÉE. La fonctionnalité Pilotage de
 *           saison existe (pilotage.html, pt 62) ; la vignette #8, jusqu'ici
 *           inerte « à venir », devient active en miroir EXACT de Rapports :
 *           statut adaptatif (eqEng.length>0) + action ouvrir-vue-statistiques
 *           + mécanisme multi-équipes + handler → pilotage.html?evenement_equipe=
 *           (pilotage.html étendu pt 65 résout la compo de base). Pilotage de
 *           l'ÉQUIPE choisie. Aucune autre fonction touchée.
 * Version : 1.61 — Vignette « Rapports » câblée (deep-link compositions.html?vue=rapport) (4 juin 2026)
 *   v1.61 : VIGNETTE #7 RAPPORTS CÂBLÉE. La fonctionnalité Rapports existe
 *           déjà (onglet « Rapport » de l'éditeur, pt 53-55) ; la vignette
 *           était restée statut 'a-venir' sans action. Câblage miroir EXACT
 *           de Vue terrain / Réseaux / Suivi (pt 45/60) : statut adaptatif
 *           (eqEng.length > 0 ? disponible : a-venir) + action ouvrir-vue-
 *           rapport + mécanisme multi-équipes EXISTANT de renderFonctionCellule
 *           (1 équipe → bouton direct, N → « Choisir l'équipe ▼ »). 3 points :
 *           (a) vignette #7 re-paramétrée ; (b) condition `multi` étendue à
 *           ouvrir-vue-rapport ; (c) handler neuf miroir de ouvrir-vue-reseaux
 *           → compositions.html?evenement_equipe=<id>&vue=rapport (capté par
 *           compositions-editor v3.63 au boot). Ajout pur, aucune fonction
 *           Suivi/renderFiche/Niveau 0 existante touchée.
 * Version : 1.60 — Vignette « Suivi de la rencontre » supprimée : liens migrés vers l'éditeur (SUIVI-LIEN-COACH-MIGRATION ✅) (3 juin 2026)
 *   v1.60 : LÈVE la dette SUIVI-LIEN-COACH-MIGRATION (passation pt 56).
 *           La génération des liens partageables (bénévole + spectateur)
 *           vit désormais dans l'onglet Suivi de l'éditeur
 *           (compositions-editor v3.61). La vignette « Suivi de la
 *           rencontre » (renderSuiviSection), seul générateur de lien du
 *           Hub jusqu'ici, est NEUTRALISÉE (retourne '' inconditionnel-
 *           lement, sans suppression du corps : les helpers Objet A/B/C
 *           — suiviGenerer, spectGenerer, renderSpectateurAcces, etc. —
 *           restent en place mais ne sont plus appelés ; geste minimal,
 *           pas de chasse aux références, additivité prouvable par diff).
 *           TROIS gestes (direction Manu pt 56, complétée tour pt 57) :
 *           (1) Tuile « ⏱ Suivi » de la grille : passe d'une expansion
 *               in-situ de la vignette à un DEEP-LINK vers l'éditeur Suivi
 *               (action ouvrir-vue-suivi → compositions.html?evenement_
 *               equipe=<id>&vue=suivi), miroir EXACT de ouvrir-vue-terrain
 *               / ouvrir-vue-reseaux (même mécanisme multi-équipes
 *               adaptatif : 1 équipe → bouton direct, N → choix équipe).
 *           (2) Match SIMPLE (hors tournoi, pas de section Phases détail) :
 *               gagne un bouton « Suivez le match en live » dans la tuile
 *               Suivi (sinon plus aucun accès au suivi pour ce type). Le
 *               deep-link porte &match=<evt.id> (le match = l'évènement
 *               lui-même) + &vue=suivi.
 *           (3) Le bouton « Suivez le match en live » des Phases du
 *               tournoi (détail) RESTE l'unique point d'entrée granulaire
 *               par match (libellé conservé, décision Manu pt 57).
 *           AUCUN SQL (front pur). Module bénévole suivi.html /
 *           suivi-app.js / suivi-client.js INTANGIBLE (non touché).
 *           node --check OK ; chemins de saisie/phase/tournoi inchangés.
 *   v1.59 : Chantier « lien direct suivi coach » (pt 56). DEUX gestes.
 *           (1) Section « Phases du tournoi (détail) » : chaque match non
 *               annulé gagne un bouton « Suivez le match en live » (classe
 *               evt-btn-live : vert prairie + point « live » pulsant, CSS
 *               dans evenements.html v+1)
 *               (data-action="suivre-match-live"). Handler = 4e miroir des
 *               ouvrir-vue-* : ouvre compositions.html?evenement_equipe=
 *               <evtEqId>&match=<child.id>&vue=suivi (éditeur v3.60 lit
 *               match/vue=suivi au boot). evtEqId résolu via map locale
 *               equipe_id→evenement_equipe.id construite sur evt.
 *               _equipesEngagees (getEquipesEngagees : id=engagement,
 *               equipe_id=équipe) — Voie A actée Manu (1 équipe = 1
 *               engagement par tournoi, pas de doublon equipe_id).
 *           (2) Vignette renderSuiviSection (branche tournoi) ALLÉGÉE :
 *               retrait de renderModeVideoAcces + renderTempsDeJeuMount
 *               (place naturelle = onglet Suivi/Rapport de l'éditeur).
 *               CONSERVÉS : renderSuiviRencontreBloc (génération du lien
 *               COACH — unique point de génération du Hub, cf. grep) et
 *               renderSpectateurAcces (dépend du lien coach généré :
 *               renvoie '' tant que SUIVI_LIENS_SESSION vide).
 *           DETTE SUIVI-LIEN-COACH-MIGRATION (tracée, NON levée ici) : la
 *               décision Manu pt 51 « vignette = lien spectateur seul » ne
 *               sera honorée à la lettre qu'une fois la génération du lien
 *               coach PORTÉE dans l'onglet Suivi de l'éditeur. Tant que
 *               renderSuiviRencontreBloc est l'unique générateur, le
 *               retirer de la vignette laisserait le lien spectateur
 *               éternellement vide (UI cassée). Épuration finale =
 *               chantier ultérieur (porter génération côté éditeur PUIS
 *               retirer de la vignette). Option 2 actée Manu pt 56.
 *           Branche match simple INCHANGÉE. node --check OK. Additif.
 * Version : 1.58 — Option B : gate suivi d'un tournoi = compo de BASE validée (matchs suivables sans validation par match) (2 juin 2026)
 *   v1.58 : Décision Manu (option B). Le gate « compo prête » d'un match de
 *           tournoi est désormais évalué UNE FOIS sur la compo de BASE du
 *           tournoi (racine), puis appliqué à tous les matchs via le 2e
 *           paramètre compoPreteOverride de renderSuiviRencontreBloc. Valider
 *           la base suffit à rendre tous les matchs suivables — plus besoin de
 *           valider chaque compo de match (qui n'était de toute façon pas
 *           validable depuis l'UI, cf. bug COMPO-VALIDATION-ONGLET tracé).
 *           Match simple : override undefined → test du match inchangé (zéro
 *           régression). Front uniquement, RPC non touchée. node --check OK.
 * Version : 1.57 — FIX gate suiviActionnable : tournois à phases (type_competition) reconnus (2 juin 2026)
 *   v1.57 : FIX cause racine (retour terrain Manu : vignette Suivi inactive
 *           sur le Challenge Vié). suiviActionnable testait
 *           type_evenement ∈ {match, tournoi} — or type_evenement n'est
 *           JAMAIS 'tournoi' en base (cf. correction v1.38 d'estEvtAPhases,
 *           ligne ~1539). Le gate refusait donc TOUS les tournois →
 *           renderSuiviSection renvoyait '' → section Suivi ET vignette
 *           (v1.56) inactives. Désormais : match simple OU estEvtAPhases
 *           (type_competition ∈ PHASES_SOUS_TYPES). 1 fonction, 1 usage
 *           (renderSuiviSection). Aucune régression (journee_championnat
 *           non-à-phases reste refusé comme avant). node --check OK.
 * Version : 1.56 — Vignette « Suivi » : panneau d'accès in-situ (générateur de lien + spectateur + revoir) (2 juin 2026)
 *   v1.56 : La vignette « ⏱ Suivi » de la grille passe d'une ancre scroll
 *           (voir-suivi) à une EXPANSION in-situ (expand-fonction, comme
 *           Encadrement), dont le panneau injecte le HTML de
 *           renderSuiviSection : match simple → accès directs (générer/
 *           copier/partager le lien coach, lien spectateur, revoir vidéo) ;
 *           tournoi → par phase → par match → mêmes accès. La section
 *           séparée #evt-suivi-rencontre est retirée (évite le doublon de
 *           boutons/montures ; suiviHtml désormais consommé par la vignette).
 *           Ajout PUR : 1 cas sectionId='suivi-acces' dans renderFonction-
 *           Cellule + redéclaration vignette #2 ; handler voir-suivi
 *           conservé (inerte, protégé null). Actions suivi câblées en
 *           délégation = fonctionnent dans la vignette. node --check OK.
 * Version : 1.56 — Sélecteur multi-catégories (UX-MULTI-CATEGORIES Lot 2, 24 juin 2026)
 *   v1.56 : Le module n'était plus mono-équipe figé. La constante
 *           M14_TEAM_UUID verrouillait l'affichage sur M14 → un encadrant
 *           multi-catégories (Lohann : EDR + SENIORS = 8 catégories) ne
 *           voyait que M14, ses 7 autres catégories inaccessibles (dette
 *           🔴 UX-MULTI-CATEGORIES, pt 102).
 *           FAMILLE A (lecture/affichage) recâblée sur le périmètre réel :
 *           - périmètre via le socle SupabaseHub.resoudrePerimetreCategories()
 *             (client v1.59) ; catégorie active mémorisée (localStorage,
 *             clé partagée mom_hub.categorie_active) ;
 *           - équipes de la catégorie active via listEquipes(catId) ; la
 *             RPC get_evenements_a_venir filtre par ÉQUIPE (sondé source,
 *             pas de filtre catégorie) → 1 appel par équipe + fusion par id
 *             (_fusionnerEvenements). 1 équipe = strictement équivalent à
 *             l'appel mono-équipe historique (non-régression) ;
 *           - sélecteur de catégorie injecté en JS dans le header SI > 1
 *             catégorie (mono-catégorie / transverse → aucun sélecteur,
 *             UX inchangée) ; titre h2 + <title> alignés sur la catégorie
 *             active (remplace « M14 » figé), repli en dur si non résolu.
 *           Dégradation honnête : périmètre indisponible / aucune équipe →
 *           repli sur [M14_TEAM_UUID] (comportement d'origine).
 *           FAMILLE B (création : payload.equipe_id, contexte modal de
 *           création) NON touchée — décision métier distincte (« sur quelle
 *           équipe créer quand N catégories »), tracée pour un lot suivant.
 *           M14_TEAM_UUID conservée comme constante de repli. Additivité
 *           prouvée Python ; node --check OK ; ZÉRO SQL.
 * Version : 1.55 — Vignettes « Vue terrain » et « Vue réseaux sociaux » câblées (1 juin 2026)
 *   v1.55 : Les 2 vignettes de la grille fonctionnalités (fiche évènement)
 *           passent de en-cours/à-venir à DISPONIBLE (statut adaptatif
 *           eqEng.length>0, comme Compositions). Réutilisent le mécanisme
 *           multi-équipes EXISTANT de renderFonctionCellule (1 équipe →
 *           bouton direct ; N → « Choisir l'équipe ▼ » + expansion). 2
 *           handlers neufs (miroir de ouvrir-feuille-equipe) : ouvrir-vue-
 *           terrain → compositions.html?evenement_equipe=<id>&vue=terrain ;
 *           ouvrir-vue-reseaux → …&vue=reseaux (capté par compositions-editor
 *           v3.25). Si l'équipe n'a pas encore de compo, compositions.html
 *           s'ouvre quand même (terrain vide / export prévient — décision
 *           Manu). Ajout PUR : 2 vignettes re-paramétrées + 1 condition
 *           étendue dans renderFonctionCellule + 2 handlers ; aucune fonction
 *           Suivi/renderFiche/Niveau 0 existante touchée. node --check OK.
 *
 * Version : 1.54 — Deep-link fiche : ?fiche=<id> ouvre la fiche au chargement (retour depuis Groupe de base / Compositions) (31 mai 2026)
 *   v1.0 : S2.1 squelette init basique
 *   v1.1 : S2.2 — vraies cartes événements
 *   v1.2 : S2.2.fix — correction adversaire tournois
 *   v1.3 : S2.3 — Fiche détaillée E2
 *   v1.4 : S2.4.b — câblage complet des 3 modales E3/E4/E5
 *   v1.4.1: S2.5 fix UX — auto-scrollTop modales
 *   v1.5 : P2-E.1 — Duplication événement dans E3 + redirect fiche tournoi
 *   v1.6 : P2-E.2 — Édition fiche : modale E6 (modifier identité) +
 *          modale E7 (notes internes). Boutons ✏️ Modifier et 📝 Notes
 *          câblés dans la fiche. Appels updateEvenement wrapper v1.12.
 *   v1.7 : RÉCONCILIATION DE BANDEAU (pas de nouveau code ici).
 *          Le corps contenait déjà P2-E.3 (formulaire logistique
 *          structuré + modale E8, ~ligne 1187) et P2-E.5 (sections
 *          fiche collapsibles mobile), conformes à l'état attendu par
 *          STATE.md (« evenements-browser v1.7 »), mais le bandeau
 *          était resté à v1.5/v1.6. Bandeau corrigé pour refléter le
 *          contenu réellement présent. Aucune ligne fonctionnelle
 *          modifiée par cette réconciliation.
 *   v1.8 : SUIVI-COACH-1 Objet A — point d'entrée coach « générer le
 *          lien de suivi ». Section dédiée « Suivi de la rencontre »
 *          sur la fiche (renderSuiviSection), visible pour
 *          type_evenement ∈ {match, tournoi} uniquement, gardée
 *          etat ∉ {annule, archive} (calque le pattern existant des
 *          autres actions de la fiche ; seuil exact = dette Audits
 *          C12-gate, signalée, non inventée).
 *          3 états adaptatifs (A-Q2) : compo pas prête (message +
 *          raccourci compositions) / compo prête (bouton générer) /
 *          lien actif (lien + copier·partager·régénérer). Tournoi
 *          (A-Q3) : 1 lien par match enfant, dans le regroupement par
 *          phase déjà utilisé par la section « Phases du tournoi »
 *          (structure réutilisée, jamais à plat). Lien de SAISIE seul
 *          (A-Q4) ; lien spectateur NON exposé (évolution tracée
 *          Objet C-2 / SUIVI-UI-6, hors cycle).
 *          État 3 borné à la SESSION (option i) : la table lien_suivi
 *          est fermée et aucune RPC ne relit un lien existant — le
 *          lien généré est gardé en RAM le temps de la session (jamais
 *          localStorage). Après rechargement : retour état 2 ;
 *          re-générer est sûr (relais backend C12-f révoque l'ancien).
 *          [NOTE v1.9 : ce point « borné session » est LEVÉ pour le
 *          match simple par SUIVI-COACH-2 ci-dessous — get_lien_saisie
 *          _actif (C12-h) permet désormais la relecture. Tournoi reste
 *          borné session. Historique conservé pour traçabilité.]
 *          « Compo prête » réutilise statutCompoBadge (notion DÉJÀ
 *          connue de la fiche) — aucun seuil inventé. Autorité réelle
 *          = garde-fou serveur PI-7 : un refus PI-7 est retraduit en
 *          « compo pas réellement prête », pas en erreur brute.
 *          Dépend de supabase-client v1.13 (wrapper genererLienEphemere).
 *
 *   v1.9 : SUIVI-COACH-2 — état 3 d'Objet A PERSISTANT entre visites
 *          (match simple). À l'ouverture d'une fiche (openFiche), si
 *          la rencontre est un match simple et qu'aucun lien n'est
 *          déjà en session, appel de SupabaseHub.getLienSaisieActif
 *          (wrapper C12-h, supabase-client v1.14). Si un lien 'saisie'
 *          actif existe → pré-remplissage de SUIVI_LIENS_SESSION →
 *          renderSuiviSection affiche directement l'état 3 (le coach
 *          retrouve son lien au lieu d'en regénérer un). Lève la
 *          limitation « borné session » de v1.8 pour le match simple.
 *          AUCUNE retouche de la logique d'Objet A : la section, les
 *          3 états, le tournoi, génération/copier/partager/régénérer
 *          sont inchangés — c'est une simple ALIMENTATION amont de
 *          SUIVI_LIENS_SESSION (cohérent STATE : « état 3 alimenté par
 *          cette RPC, aucune retouche logique »).
 *          Garde-fous : (1) match simple UNIQUEMENT — tournoi resterait
 *          N appels/enfant, reste borné session (décision périmètre
 *          Manu) ; (2) STRICTEMENT non bloquant — échec RPC ou wrapper
 *          absent n'empêche jamais l'ouverture de la fiche (persistance
 *          = confort, pas dépendance dure) ; (3) n'écrase pas un lien
 *          déjà en session (lien généré dans la session = plus récent,
 *          fait foi) ; (4) data:null (aucun lien actif) = cas NORMAL,
 *          jamais une erreur (Objet A → état 2). Filtrage actif/non
 *          révoqué/non expiré fait PAR la RPC, non re-vérifié client.
 *
 *   v1.10 : SUIVI-COACH-1 Objet B — ACCROCHE Mode Vidéo.
 *          Continuation adaptative de la section « Suivi de la
 *          rencontre » d'Objet A (B-Q1) : une fois la rencontre
 *          JOUÉE (etat ∈ {joue,resultat}, ∉ {archive,annule}),
 *          un accès « 🎬 Revoir ce match (Mode Vidéo) » ouvre
 *          l'écran coach distinct mode-video.html?e=<uuid>
 *          (convention ?e= posée dans js/mode-video.js, réutilisée
 *          à l'identique — un seul contrat). ADDITION PURE,
 *          modèle SUIVI-COACH-2 STRICT : 3 nouvelles fonctions
 *          (modeVideoBuildUrl, suiviRevoirActionnable,
 *          renderModeVideoAcces) + 2 appels EN AVAL de
 *          renderSuiviRencontreBloc (match simple & matchs
 *          enfants — A-Q3, hiérarchie réutilisée) + 1 forEach
 *          de binding. AUCUNE fonction d'Objet A modifiée,
 *          AUCUNE branche d'état / génération de lien touchée.
 *          Seuil « jouée » aligné dette Audits C12-gate (même
 *          posture qu'A-Q2/suiviActionnable, non inventé).
 *          Spec : Conception-SUIVI-COACH-1-ObjetB.md (validé
 *          Manu). Dépend de mode-video.html + mode-video.js +
 *          supabase-client v1.15 (couche données coach).
 *
 *   v1.11 : SUIVI-COACH-1 Objet C — ACCROCHE (panneau temps de jeu
 *          C-1 + lien spectateur C-2). ADDITION PURE, modèle
 *          SUIVI-COACH-2/v1.10 STRICT : nouvelles fonctions
 *          uniquement (spectateurBuildUrl, renderSpectateurAcces,
 *          renderTempsDeJeuMount + handlers spectGenerer/Copier/
 *          Partager) + appels EN AVAL de renderSuiviRencontreBloc
 *          (match simple & matchs enfants — A-Q3, hiérarchie
 *          réutilisée à l'identique) + forEach de binding siblings.
 *          AUCUNE fonction d'Objet A/B modifiée, AUCUNE branche
 *          d'état / génération de lien de saisie touchée.
 *          • C-1 (temps de jeu) : un placeholder est émis EN AVAL
 *            (gate suiviRevoirActionnable = MÊME seuil « phase aval »
 *            que Mode Vidéo, non inventé) puis TempsDeJeu.monter()
 *            est appelé post-render (js/temps-de-jeu.js, panneau
 *            replié, lecture pure). Non bloquant si TempsDeJeu
 *            absent (posture v1.9/v1.10).
 *          • C-2 (lien spectateur) : exposé « dans l'état 3 »
 *            (C2-Q3, évolution A-Q4) — renderSpectateurAcces rend
 *            '' sauf si un lien de saisie est actif en session.
 *            Coach-initié (génération = écriture délibérée, jamais
 *            d'auto-INSERT). Borné session : aucune RPC de
 *            relecture spectateur n'existe (seul getLienSaisieActif
 *            /C12-h, saisie-only) — même posture « borné session »
 *            que le lien de saisie v1.8 (honnête, non inventé).
 *            Map isolée SUIVI_SPECT_SESSION (la Map d'Objet A
 *            n'est NI touchée NI relue pour écrire). URL
 *            spectateur.html?t=<jeton> calquée sur suiviBuildUrl.
 *          genererLienEphemere(evtId,'spectateur') : contrat
 *          DÉJÀ présent (wrapper v1.13, role∈saisie|spectateur ;
 *          C12-f generer_lien_ephemere sans PI-7 ni relais pour
 *          'spectateur') — l'évolution « Objet C-2 / SUIVI-UI-6 »
 *          tracée par v1.8/A-Q4 est ICI réalisée (plus « hors
 *          cycle » : c'est ce cycle). Rien inventé, contrat activé.
 *          Spec : Conception-SUIVI-COACH-1-ObjetC.md (validé Manu).
 *          Dépend de spectateur.html + js/spectateur.js +
 *          js/temps-de-jeu.js + supabase-client v1.16.
 *
 *   v1.12 : Bouton de navigation « ← Retour aux compositions » dans le
 *          pied d'actions de la fiche évènement E2 (evt-fiche-actions).
 *          PENDANT de symétrie du bouton Compos→Évènements « Retour aux
 *          évènements » (côté compositions-editor — module Compos, hors
 *          périmètre de cette conv ; non touché). VERSION SIMPLE :
 *          navigation pure vers compositions.html, SANS deep-link ciblé
 *          — réplique EXACTE du pattern déjà déployé du raccourci
 *          'suivi-aller-compo' (l. ~1265), même commentaire d'honnêteté.
 *          La version ciblée (?evenement=<uuid>) suppose une convention
 *          d'URL côté compositions.html NON établie : enabler conv Compos
 *          (jumeau SUIVI-COACH-deeplink), NON défini ici (zéro couplage
 *          inventé). ADDITION PURE : 1 bouton dans renderFiche
 *          (evt-fiche-actions) + 1 forEach de binding dans
 *          bindFicheActions (sibling strict de edit/notes-from-fiche).
 *          Aucune fonction existante modifiée ; bouton toujours visible
 *          (aucune garde d'état inventée — navigation pure, utile aussi
 *          sur évènement annulé/archivé). data-event-id porté par
 *          cohérence avec les boutons frères, NON consommé (la version
 *          simple ne lit aucun id). evenements.html NON touché
 *          (.evt-btn / .evt-fiche-actions déjà présents). Aucune RPC :
 *          supabase-client NON touché.
 *
 *   v1.13 : ÉTAPE 1 refonte Évènements (retour terrain Manu 18/05) —
 *          REGROUPEMENT de la liste par les 3 GRANDES CATÉGORIES
 *          (Stage / Entraînement / Compétition). DISPLAY-ONLY, ZÉRO
 *          schéma, RÉVERSIBLE (retirer le bloc constantes + restaurer
 *          les 2 lignes renderListe = retour exact v1.12). Mapping
 *          validé Manu sur les valeurs RÉELLEMENT déployées du CHECK
 *          SQL type_evenement : stage→Stage, entrainement→Entraînement,
 *          match|tournoi|journee_championnat→Compétition. Hiérarchie :
 *          catégorie SOUS le split passés/à venir (option A, la plus
 *          réversible — non l'inverse ; choix signalé à Manu, ajustable
 *          en boucle). renderSection RÉUTILISÉE TELLE QUELLE (jamais
 *          modifiée) : addition pure = 1 bloc constantes + 1 fonction
 *          evtCategorie + 1 fonction renderSectionsParCategorie + 2
 *          lignes substituées dans renderListe. AUCUNE retouche de
 *          renderCard / openFiche / filtres / couche données / accroches
 *          Suivi A/B/C. Dégradation honnête : occasionnel vs récurrent
 *          NON distingués (aucun champ de récurrence en base) ;
 *          sous-types compétition (ph.1/ph.2, seven, Challenge…) NON
 *          ajoutés (valeurs absentes du CHECK déployé — les inventer =
 *          trancher le modèle, explicitement différé hors de cette conv).
 *          Fallback défensif → 'competition' : jamais d'évènement
 *          perdu/masqué. evenements.html & supabase-client NON touchés.
 *
 *   v1.14 : Refonte Évènements (Production · Évènements) — U3 SEUL
 *          (regroupement + tri calendrier). Implémente
 *          Conception-Refonte-Evenements-U1-U4-v1.md §4 (UX, fait
 *          foi), aligné sur le type_evenement RÉEL post-migration
 *          v1.2 §5.1 (commitée). U1/U2/U4 (modale, bascule Phases,
 *          palette) = commit SÉPARÉ suivant (v1.15). Périmètre
 *          strict, addition/réalignement prouvés par diff ;
 *          renderSection / renderCard / openFiche / couche données /
 *          accroches Suivi A/B/C JAMAIS touchés.
 *
 *          (1) RÉPARE une régression de v1.13 : v1.13 FORÇAIT le
 *              regroupement (toujours groupé, pas de retour chrono).
 *              L'UX §4 impose « regroupement = vue ACTIVABLE, défaut
 *              CHRONOLOGIQUE conservé » (ne pas régresser l'usage
 *              premier « c'est quand le prochain ? », cf. RPC portail).
 *              → Nouveau flag state.grouperParCategorie (DÉFAUT false
 *              = chronologique), persisté dans les prefs existantes.
 *              false → renderSection sur passés puis à venir (= retour
 *              EXACT au comportement v1.12, regroupement par mois) ;
 *              true → renderSectionsParCategorie. Bascule injectée en
 *              tête de #evt-list (zone que le module possède déjà —
 *              Façon 1, aucune dépendance evenements.html).
 *
 *          (2) CATEGORIE_ORDRE inversé : v1.13 = stage→entr→compét.
 *              UX §4 impose Compétition → Entraînement → Stage
 *              (P7 : l'enjeu central remonte). Tri chrono conservé
 *              DANS chaque famille (partitionnement stable inchangé).
 *
 *          (3) evtCategorie aligné sur le domaine RÉEL post-migration
 *              (type_evenement ∈ competition|entrainement|stage,
 *              CHECK v1.2 §5.1). Le mapping des anciennes valeurs
 *              techniques (match|tournoi|journee_championnat) devient
 *              le fallback défensif (ces valeurs n'existent plus en
 *              base) ; aucun évènement jamais perdu (doctrine v1.13
 *              conservée).
 *
 *          (4) TYPE_LABELS / TYPE_ICONS : ajout de l'entrée
 *              'competition' (sans cela, evt.type_evenement RÉEL
 *              ='competition' s'afficherait en chaîne brute).
 *              Anciennes clés conservées (fallback défensif additif).
 *
 *          (5) showCompet réaligné : v1.13 testait les valeurs mortes
 *              match|tournoi|journee_championnat. UX §4 : le filtre
 *              COMPÉT. n'a de sens que pour la famille Compétition
 *              (P1, pas de filtre inopérant) → visible si famille
 *              'all' ou 'competition'. NB : le JEU de chips (3
 *              familles / 10 sous-types) vit dans evenements.html
 *              (autre fichier, NON ici) — ce JS réaligne seulement
 *              SA logique de lecture/visibilité ; le rebranchement
 *              des chips = vérification Production sur evenements.html.
 *
 *   v1.15 : Refonte Évènements (Production · Évènements) — U4 JS-side
 *          (résolution M7 de classe) + mise en cohérence CONSÉQUENTE
 *          du flux de création post-migration v1.2 §5.1. Diff borné,
 *          prouvé ; renderSection/renderCard/openFiche/accroches
 *          Suivi A/B/C JAMAIS touchés.
 *
 *          ⚠️ PÉRIMÈTRE HONNÊTE — U1 (formulaire 5 blocs adaptatif)
 *          et U2 (bascule Phases, blocs +Phase/+Match) NE SONT PAS
 *          implémentés ici : leur structure (radios type_evenement,
 *          sélecteur type_competition, cases équipes, blocs
 *          répétables, CSS .evt-compet-*) vit dans evenements.html,
 *          NON fourni à cette conv. Fabriquer un formulaire parallèle
 *          aveugle = anti-pattern DS-1 + violation « le code déployé
 *          fait foi » → refusé. U1/U2 nécessitent evenements.html
 *          (entrée manquante signalée, NON inventée).
 *
 *          (1) Helper familleReelle(v) : remap DÉFENSIF d'une valeur
 *              radio (ancienne match|tournoi|journee_championnat ou
 *              nouvelle competition|entrainement|stage) → famille
 *              réelle. Forward-compatible : identité quand
 *              evenements.html émettra déjà les 3 familles.
 *
 *          (2) RÉGRESSION création réparée : post-migration la modale
 *              envoyait encore type_evenement='match'|'tournoi'|
 *              'journee_championnat' → violation evenements_type_check
 *              v1.2. type remappé via familleReelle AVANT le payload
 *              ET les overrides duplication (P2-E.1 préservé).
 *
 *          (3) updateCreateConditionalFields réaligné sur la famille
 *              réelle (competition → compét.+format ; stage → date_fin
 *              ; logique testée sur famille, plus sur valeurs mortes).
 *
 *          (4) RÉGRESSION P2-E.1 G9 réparée : redirect fiche
 *              post-création testait type==='tournoi' (mort). Remplacé
 *              par le successeur 1:1 fidèle (sous-type type_competition
 *              ='tournoi'). Le redirect élargi aux sous-types à phases
 *              = U2 (dépend evenements.html), NON pré-empté ici.
 *
 *          (5) generateEventCode : préfixe aligné sur familles réelles
 *              (COMP/ENTR/STAGE) ; anciennes clés = fallback défensif.
 *
 *          (6) U4 M7 — competClass DÉRIVE désormais 'evt-compet-' +
 *              code (référentiel sous-types-competition.json, _ → -).
 *              Plus de table parallèle COMPET_TO_CLASS (compet-champ-p1
 *              /compet-vie/compet-tournoi/compet-amical SUPPRIMÉE) :
 *              une seule source de vérité (le référentiel), le CSS la
 *              suit (UX §5.2/5.5, résolution structurelle M7).
 *              compet-fed n'a jamais existé dans ce JS, garanti absent.
 *              ⚠️ Les RÈGLES CSS .evt-compet-<code> (palette §5.4)
 *              vivent dans evenements.html (vérification Production) —
 *              ce JS pose la classe mécaniquement, pas la couleur.
 *
 *   v1.16 : Refonte Évènements (Production · Évènements) — U1/U2
 *          LOGIQUE ADAPTATIVE de la modale création, pilotant les
 *          12 ancres DOM posées par evenements.html commit (b1).
 *          Implémente Conception-Refonte-Evenements-U1-U4-v1.md
 *          §1/§2.4/§2.5/§3 (UX, fait foi). Extension de
 *          updateCreateConditionalFields (Façon 1, PAS un wizard) ;
 *          renderSection/renderCard/openFiche/accroches Suivi A/B/C
 *          JAMAIS touchés.
 *
 *          ⚠️ PÉRIMÈTRE HONNÊTE (constat de modèle, NON un trou
 *          inventé) — la PERSISTANCE M3 (multi-équipes) et M5
 *          (adversaires par équipe) est BLOQUÉE : tables RLS
 *          SELECT-only, aucune policy ni wrapper write (dette tracée
 *          supabase-client v1.18) ; et aucun wrapper de listing
 *          `equipes` n'existe (4a non peuplable réellement). Câbler
 *          ces blocs comme s'ils enregistraient = le « faux » que
 *          l'UX §2.5 interdit. Donc, MÊME PATRON HONNÊTE QUE LE
 *          STAFF (UX §2.5 option b) : l'UI Engagement (4a/4b/4c) est
 *          adaptative et visible mais étiquetée NON-PERSISTÉE tant
 *          que la dette write M3/M5 + le listing equipes ne sont pas
 *          livrés. Réversible : dette levée → on retire l'étiquette
 *          et on câble le submit, rien à redessiner.
 *
 *          (1) updateCreateConditionalFields ÉTENDU — règle
 *              d'adaptation à 3 entrées (UX §1) : famille (Bloc 1) ;
 *              occasionnel/récurrent si Entraînement (M2, forme
 *              d'écran seule — structure JSONB = D-M2, Production
 *              P3) ; bascule question Phases DÉRIVÉE du sous-type
 *              (UX §3.1 : visible seulement pour tournoi /
 *              challenge_vie / challenge_inter_ligues / plateau).
 *              Compétition → bloc Engagement affiché ; Stage/
 *              Entraînement → masqué (frontière CHECK relâché
 *              v1.2 §5.1). Aucune colonne marqueur (P1/M6 §4.4).
 *
 *          (2) Lignes répétables (UI pure) : +Adversaire (4c, patron
 *              unique, indice triangulaire/plateau UX §2.4/4c) ;
 *              +Phase / +Match (U2 §3.2, 2 niveaux d'UI, AUCUNE
 *              sous-phase — plafond M6 §4.4). Suppression par ligne.
 *
 *          (3) Question Phases (radios phases_mode) : OUI →
 *              « Phases & matchs » SE SUBSTITUE à 4c (masque
 *              adversaires simples) ; NON → adversaires simples
 *              (M5). Strictement UX §3.1/3.2.
 *
 *          (4) Bloc 5 Staff : AUCUN câblage write (déjà désactivé +
 *              étiquette en HTML b1, décision Manu option b). Le JS
 *              ne fait que NE PAS toucher — pas de faux.
 *
 *          (5) submitModalCreate : INCHANGÉ sur le périmètre M3/M5
 *              (rien collecté n'est envoyé — pas de faux). La
 *              création de l'évènement de base reste la voie
 *              existante (v1.15). Phases & matchs M6 : la
 *              persistance passe par des lignes `evenements`
 *              (createEvenement / addMatchToTournoi v1.17, table
 *              evenements — PAS M3/M5) ; le câblage submit des
 *              phases est laissé à un commit dédié (V2) pour ne pas
 *              mélanger UI adaptative et orchestration multi-INSERT
 *              dans le même diff (1 intention = 1 commit). L'UI
 *              Phases est livrée et fonctionnelle ; sa persistance
 *              = commit suivant, tracée, NON un faux (le bandeau
 *              n'affirme pas un enregistrement immédiat).
 *
 *   v1.17 : Refonte Évènements (Production · Évènements) — PERSISTANCE
 *          des Phases & matchs M6 (lève la dette « Phases enregistre-
 *          ment » tracée en v1.16). Orchestration en cascade sur la
 *          table `evenements` UNIQUEMENT (createEvenement v1.15) —
 *          PAS M3/M5 (dette write distincte, NON levée ici).
 *          renderSection/renderCard/openFiche/accroches Suivi A/B/C
 *          JAMAIS touchés ; submitModalCreate étendu en addition
 *          (la voie existante création/duplication est préservée
 *          telle quelle, l'orchestration ne s'active QUE si Phases=OUI).
 *
 *          (1) persisterPhasesEtMatchs(racineId, …) : après création
 *              réussie de la compétition racine, crée la hiérarchie
 *              M6 à 3 NIVEAUX (v1.2 §4.4) :
 *                racine (déjà créée)
 *                 └─ phase-boîte = ligne evenements enfant,
 *                    phase_libelle renseigné, PAS d'adversaire
 *                     └─ match = ligne evenements enfant de la
 *                        PHASE-BOÎTE, adversaire_nom renseigné,
 *                        equipe_id (équipe précise) ou NULL (toutes)
 *              Hérite de la racine : saison_id, organisateur,
 *              type_competition, format_de_jeu, site_id (lecture de
 *              la racine via createEvenement payload explicite).
 *              addMatchToTournoi NON utilisé pour les matchs de
 *              phase : il force parent=racine, or un match de phase
 *              a pour parent la PHASE-BOÎTE (3 niveaux). createEvenement
 *              est la voie correcte pour les 2 niveaux. Plafond M6 :
 *              2 niveaux d'UI, aucune sous-phase.
 *
 *          (2) INVARIANT SUIVI tenu : chaque match est créé comme
 *              une vraie LIGNE `evenements` (jamais une structure
 *              imbriquée) → compositions.evenement_id continue de
 *              s'y rattacher, accroches Suivi A/B/C non régressées
 *              (v1.2 §7, cadrage §5). Vérifié par diff (zéro
 *              modification des fonctions Suivi).
 *
 *          (3) STRATÉGIE D'ÉCHEC = création progressive (décision
 *              Manu). Pas de transaction client possible (API REST) :
 *              on n'invente pas un faux « tout ou rien ». En cas
 *              d'échec en cours de cascade, on N'ANNULE PAS (un
 *              nettoyage = écritures spéculatives qui peuvent elles
 *              aussi échouer, état pire). On ARRÊTE, on garde ce qui
 *              est créé (lignes valides et cohérentes), et on AFFICHE
 *              exactement où ça s'est arrêté + la raison. L'utilisateur
 *              complète manuellement via la fiche (déjà créée) et le
 *              « + Match » existant (chemin P2-E.1 G9 réaligné v1.15).
 *              Cohérent P4 « le Hub avertit, ne bloque pas » + doctrine
 *              « jamais de faux » (on n'affirme jamais plus que ce
 *              qui est réellement en base).
 *
 *          (4) Le redirect post-création vers la fiche (P2-E.1 G9)
 *              est CONSERVÉ et s'applique aussi après orchestration
 *              réussie OU partielle (l'utilisateur atterrit sur la
 *              compétition pour voir/compléter). submitModalCreate :
 *              addition pure, branche Phases gardée par phases_mode
 *              = 'oui' ET sous-type éligible (UX §3.1).
 *
 *   v1.18 : Session RLS write par rôle (Production) — CÂBLAGE WRITE du
 *          Bloc 4a/4c (Engagement M3/M5). Lève la dette 1
 *          (REFONTE-EVT-write-M3/M5 + listing equipes) côté UI : la
 *          RLS write est posée (sql/41), les wrappers existent
 *          (supabase-client v1.19 add/removeEquipeEngagee /
 *          add/removeAdversaire ; v1.20 getCategorieEquipe +
 *          listEquipes). v1.16 disait « rien collecté n'est envoyé
 *          (pas de faux) » : ce faux est maintenant levé, le Bloc 4a
 *          collecte ET persiste réellement.
 *
 *          PÉRIMÈTRE (décisions Manu consignées) :
 *          - categorieId dérivé de M14_TEAM_UUID (option A : module
 *            M14-mono-équipe, comme tout le reste du fichier). Le
 *            multi-catégorie/multi-coach = dette de fond séparée
 *            « liaison auth→équipe→saison » (tracée passation, PAS
 *            traitée ici — chantier de modélisation amont).
 *          - Câblage write M3/M5 UNIQUEMENT en mode adversaires
 *            simples (phases_mode ≠ 'oui'). La branche Phases=OUI
 *            persiste déjà via `evenements` M6 (v1.17,
 *            persisterPhasesEtMatchs) — PAS M3/M5 (frontière modèle
 *            v1.2 §4.4 M5↔M6). Câbler M3/M5 sur Phases = doublon
 *            d'une persistance déjà faite → exclu (anti-DS-1).
 *          - Staff Bloc 5 (dette 2, P2-E.4) : NON câblé ici. Bloqué
 *            sur source de lecture staff non vérifiée (RPC
 *            get_joueurs_equipe non lue) → dette tracée, pas une
 *            invention. Étape séparée.
 *
 *          (1) CTX_CATEGORIE_ID : résolu une fois au chargement du
 *              contexte modal (loadModalContext), via
 *              SupabaseHub.getCategorieEquipe(M14_TEAM_UUID). Même
 *              esprit que CTX_SAISON_ID/CTX_ORGANISATEUR_ID (lecture
 *              ciblée, variable de contexte). Défensif : si échec,
 *              le Bloc 4a affiche une erreur honnête, ne bloque pas
 *              la création de l'évènement de base.
 *
 *          (2) peuplerEquipesEngagees() : remplit #evt-create-equipes
 *              (cases à cocher) via SupabaseHub.listEquipes(
 *              CTX_CATEGORIE_ID). Appelé quand le bloc Engagement
 *              devient visible (hook updateCreateConditionalFields,
 *              addition — la logique conditionnelle existante n'est
 *              pas modifiée, seulement complétée). État honnête :
 *              « Chargement… » → cases, ou message d'erreur, ou
 *              « aucune équipe » (jamais une case fantôme).
 *
 *          (3) submitModalCreate ÉTENDU en addition pure : après
 *              création réussie de la compétition (createdId présent)
 *              ET si famille=competition ET phases_mode≠'oui', on
 *              persiste l'engagement : pour chaque équipe cochée →
 *              addEquipeEngagee(createdId,…) ; pour chaque adversaire
 *              saisi → addAdversaire(liaisonId,…) rattaché à la
 *              PREMIÈRE équipe engagée (cas simple/triangulaire UX
 *              §2.4/4c ; le multi-équipe×adversaire fin reste porté
 *              par l'UX existante, pas sur-spécifié ici). La voie
 *              création de base (v1.15) et la branche Phases (v1.17)
 *              sont INCHANGÉES (gardées par leurs conditions
 *              existantes).
 *
 *          (4) STRATÉGIE D'ÉCHEC = création progressive, MÊME doctrine
 *              que v1.17 persisterPhasesEtMatchs (décision Manu) :
 *              pas de transaction client (API REST), on n'invente pas
 *              un faux « tout ou rien ». Échec en cours
 *              d'engagement → on N'ANNULE PAS, on garde ce qui est
 *              créé, on rend compte exactement (combien d'équipes /
 *              adversaires enregistrés, où ça s'est arrêté). La
 *              compétition est créée ; l'utilisateur complète depuis
 *              la fiche. Cohérent P4 « le Hub avertit, ne bloque pas ».
 *
 *          (5) INVARIANT SUIVI : aucune fonction Suivi/render/openFiche
 *              touchée (addition pure, prouvé par diff signatures).
 *              M3/M5 sont des tables de liaison ; aucun match n'est
 *              créé/modifié ici (les matchs = lignes `evenements`,
 *              voie v1.17 inchangée) → compositions.evenement_id et
 *              accroches A/B/C non régressées par construction.
 *
 *   v1.19 : Session RLS write — READ-BACK fiche des équipes engagées
 *          + adversaires (M3/M5). Constat source 19/05 : la création
 *          persiste bien M3/M5 (sql/43 + câblage v1.18 prouvés par
 *          lecture base) MAIS la fiche ne les affichait NULLE PART
 *          (RPC fiche = `encadrants` seul ; getEquipesEngagees/
 *          getAdversairesEvenement déployés v1.18 JAMAIS appelés).
 *          Engagement écrit mais invisible. ADDITION : openFiche
 *          attache evt._equipesEngagees/_adversaires/_equipeNames
 *          (2 await NON BLOQUANTS, posture relecture lien Suivi) ;
 *          renderFiche rend une section calquée sur Encadrants.
 *
 *   v1.20 : Session RLS write — ÉDITION de l'engagement depuis la
 *          fiche (lève EVT-ENGAGEMENT-UI partie édition). Sur la
 *          section v1.19, gardé etat ∉ {annule,archive} (idem
 *          logistique) : engager une équipe (picker = listEquipes
 *          du club, équipes non déjà engagées), retirer une équipe
 *          (CASCADE M5 par FK sql/40, confirm), ajouter un
 *          adversaire (input par équipe), retirer un adversaire
 *          (via id exposé par supabase-client v1.21). Handlers
 *          STRICTEMENT calqués sur reactivate-from-fiche (bouton
 *          désactivé → await wrapper déployé → alert si échec →
 *          succès closeFiche/reloadEvents/openFiche). openFiche
 *          v1.19 étendu : liste club chargée pour TOUTE compétition
 *          (plus seulement si déjà engagée) → evt._equipesClub,
 *          pour que l'ajout d'une 1re équipe marche. Wrappers tous
 *          DÉJÀ déployés (v1.19 add/removeEquipeEngagee/addAdversaire,
 *          v1.21 removeAdversaire) ; AUCUN nouveau SQL/RPC ; lecture
 *          des noms = listing, repli honnête UUID (jamais un faux).
 *
 *          INVARIANT v1.19+v1.20 : renderCard/renderSection/
 *          accroches Suivi A/B/C/couche données/logique existante
 *          de openFiche & renderFiche & bindFicheActions NON
 *          touchés (addition pure prouvée par diff vs original
 *          vérifié md5 ; node --check OK). Aucune ancre
 *          evenements.html requise (fiche JS-construite) — DS-1
 *          tenu (patrons réutilisés, rien fabriqué en aveugle).
 *
 *   v1.21 : Collectif & compo 3 niveaux (Production) — Niveau 0
 *          (doc UX §1). NOUVELLE section fiche « 🧩 Équipes &
 *          compositions » (compétition + ≥1 équipe engagée) :
 *          par équipe nom + format (M3, lecture) + 2 accès
 *          (Groupe de base U-N2 / Feuille U-N3). Réutilise les
 *          données DÉJÀ attachées par openFiche
 *          (evt._equipesEngagees / _equipeNames) : ZÉRO nouvel
 *          appel, ZÉRO RPC/SQL, ZÉRO openFiche modifié. Boutons
 *          honnêtement DÉGRADÉS (disabled + « bientôt ») tant que
 *          U-N2 (étape b) / U-N3 (étape c) non livrés — patron
 *          projet « jamais de trou silencieux » (mode-video v0.1).
 *          Convention d'URL ?evenement_equipe=<id> = SD-1 (a)
 *          ASSUMÉE par Manu (lève partiellement SUIVI-COACH-
 *          deeplink — écart de gouvernance tracé, à acter clôture).
 *          INVARIANT v1.19+v1.20+v1.21 : renderCard/renderSection/
 *          accroches Suivi A/B/C/couche données/logique existante
 *          de openFiche & bindFicheActions & des sections existantes
 *          de renderFiche NON touchés ; renderFiche reçoit UNE
 *          section additive de plus à son point d'extension prévu
 *          (idem 5bis v1.19/v1.20) — addition pure prouvée par
 *          diff vs original vérifié md5 ; node --check OK. Aucune
 *          ancre evenements.html requise (fiche JS-construite),
 *          aucune classe CSS neuve (réutilise evt-fiche-*) — DS-1.
 *
 *   v1.22 : Collectif & compo 3 niveaux (Production) — étape (b) :
 *          ACTIVATION du bouton « Groupe de base » du Niveau 0
 *          (v1.21). Le bouton passe de dégradé honnête
 *          (disabled+« bientôt ») à ACTIF → navigation
 *          groupe-base.html?evenement_equipe=<id> (écran U-N2,
 *          doc UX §2). Handler additif dans bindFicheActions
 *          calqué EXACTEMENT sur compos-from-fiche (navigation
 *          pure). Le bouton « Feuille de match » reste dégradé
 *          (activé étape c U-N3). Diff = version + changelog +
 *          1 ligne bouton (disabled→actif, MA section v1.21) +
 *          1 bloc handler additif. renderCard/renderSection/
 *          openFiche/renderFiche (autres sections)/handlers
 *          bindFicheActions existants : byte-identiques (prouvé
 *          md5). node --check OK. Convention ?evenement_equipe
 *          = SD-1(a) assumée Manu (tracée clôture).
 *   v1.23 : Étape (c) U-N3 — activation accès « Feuille de match »
 *          (Niveau 0). Symétrique exact de l'activation v1.22 du
 *          bouton « Groupe de base ». Le bouton « Feuille de
 *          match » émis par v1.22 (data-action="ouvrir-feuille-
 *          equipe" + data-evenement-equipe-id, actuellement
 *          disabled+« bientôt ») passe à ACTIF → navigation
 *          compositions.html?evenement_equipe=<id> (éditeur
 *          étendu Façon 1, doc UX §3, compositions-editor v3.8
 *          + supabase-client v1.27 + sql/50 déployés en amont).
 *          Handler additif dans bindFicheActions calqué BYTE-
 *          IDENTIQUE sur ouvrir-groupe-base v1.22 (navigation
 *          pure, zéro logique métier). Diff = version + changelog
 *          + 1 ligne bouton (disabled→actif, retrait « bientôt »
 *          du libellé) + 1 bloc handler additif. renderCard /
 *          renderSection / openFiche / renderFiche (autres
 *          sections) / handlers bindFicheActions existants
 *          (incl. ouvrir-groupe-base) : byte-identiques (preuve
 *          md5). node --check OK. Convention ?evenement_equipe
 *          = SD-1(a) (déjà assumée v1.22, ré-utilisée).
 *          Cycle Collectif & compo 3 niveaux LIVRÉ DE BOUT EN
 *          BOUT côté UI une fois v1.23 déployée (étapes
 *          a/b/c/d/e du chantier).
 *
 *   v1.24 : Refonte UX Évt→Compo · L3a (Production · 27/05/2026, pt 19) —
 *          Câblage JS de la refonte HTML L4 (evenements.html refonte
 *          5 modes adaptatifs A1→A5 + écran d'accueil filtres §3.4 +
 *          KPIs cliquables H-3 + bouton admin H-5 + CTA primaire H-6).
 *          Consomme la RPC composite sql/52 creer_evenement_complet
 *          via le wrapper SupabaseHub.createEvenementComplet v1.30.
 *          Doc UX FAIT FOI : Conception-UX-Parcours-Evt-Compo-v1.md
 *          md5 4c8652d9.
 *
 *          PÉRIMÈTRE L3a (cette livraison) :
 *            (1) updateCreateConditionalFields refondu pour 5 modes
 *                adaptatifs : bandeau mode visible, masquage/affichage
 *                des blocs sous-type (A3/A4/A5), horaires détaillés
 *                (A3/A4/A5), récurrence (A1), engagement multi-équipes
 *                (A3/A4/A5), adversaire mono (A3) vs adv-par-équipe
 *                (A4/A5), phases-par-équipe F19 (A4/A5), affectations
 *                N2 plateau (A4 multi-équipes).
 *            (2) submitModalCreate refondu pour basculer sur
 *                createEvenementComplet (RPC composite atomique).
 *                Construction du payload composite (6 obligatoires +
 *                12 optionnels dont 4 JSONB) depuis le DOM.
 *            (3) Câblage HTML L4 dans bindEvents : CTA primaire
 *                evt-btn-create-top, KPIs cliquables (data-action
 *                filter-set), dropdown sous-type evt-soustype-select
 *                (au lieu des 11 pills compet retirées), bouton admin
 *                evt-btn-grouper-categorie (révélation conditionnelle
 *                si SupabaseHub.isAdmin), multijours toggle,
 *                récurrence toggle.
 *            (4) Nouvelles fonctions de peuplement dynamique : staff
 *                (lecture collectif N1 role='staff' actif saison
 *                courante, E-1 acté §4.6 doc UX), affectations N2
 *                plateau (dropdown par équipe cochée, sous-ensemble
 *                M8), structure multi-équipes (format-par-équipe +
 *                adv-par-équipe + phases-par-équipe-list dynamique
 *                sur change checkbox équipe).
 *            (5) Voie « lente » fiche R4 §3.1.6 INTACTE : modales
 *                E4/E5/E6 + wrappers REST inchangés. La voie « lente »
 *                reste exploitable post-création pour ajustements.
 *
 *          PÉRIMÈTRE DIFFÉRÉ L3b (dette UX-EVT-FICHE-REFONTE 🟡,
 *          livraison ultérieure) :
 *            - renderFiche §3.2-3.3 (bannière 2 niveaux + grille 8
 *              liens fonctionnalités + 3 actions). La fiche actuelle
 *              reste pleinement fonctionnelle (Suivi A/B/C +
 *              handlers Niveau 0 ouvrir-groupe-base/ouvrir-feuille-
 *              equipe byte-identiques par construction).
 *
 *          INVARIANTS PROTÉGÉS (preuve byte-identité dédiée md5) :
 *            - 11+ fonctions Suivi A/B/C (suiviBuildUrl, suiviGenerer,
 *              suiviPartager, renderSuiviRencontreBloc, renderSuiviSection,
 *              refreshSuiviSection, bindSuiviActions, modeVideoBuildUrl,
 *              renderModeVideoAcces, spectateurBuildUrl,
 *              renderSpectateurAcces, renderTempsDeJeuMount,
 *              spectGenerer, spectCopier, spectPartager)
 *            - 2 handlers Niveau 0 v1.22/v1.23 dans bindFicheActions
 *              (ouvrir-groupe-base + ouvrir-feuille-equipe)
 *            - M14_TEAM_UUID + constantes module
 *            - loadPrefs / savePrefs / loadEvenementsAVenir /
 *              loadEvenementsPasses / buildIndexes
 *            - renderFiche (différé L3b)
 *
 *          Bump console.log boot : "v1.4.1 (S2.5) chargé" → "v1.24
 *          (S3) chargé" — alignement cohérent header v1.24 (cycle
 *          Hygiène pt 17 répliqué, incohérence "v1.4.1" pré-existante
 *          jamais tracée en STATE absorbée ici, additif éditorial).
 *          Provenance md5 chaîne maillon par maillon : v1.23 a0af7b42
 *          → v1.24 (recollé après écriture).
 *
 *   v1.25 : Refonte UX Évt→Compo · L3b · renderFiche §3.2-3.3 (Production
 *          · 27/05/2026, pt 20) — Refonte intégrale de la fiche évènement
 *          conformément au doc UX FAIT FOI Conception-UX-Parcours-Evt-
 *          Compo-v1.md md5 4c8652d9, §3.2 bannière 2 niveaux + §3.3 grille
 *          8 liens fonctionnalités + 3 actions. Lève la dette UX-EVT-
 *          FICHE-REFONTE 🟡 ouverte pt 19. Doctrine F-1 : fiche évènement
 *          = centre névralgique, tout part de l'évènement créé.
 *
 *          STRUCTURE renderFiche v1.25 (9 blocs séquentiels) :
 *            (1) Header navigation : bouton « ← Retour au calendrier »
 *                F-4 + bouton contextuel « ↩ Retour à [parent] » si
 *                evenement_parent_id (préserve navigation enfant→tournoi
 *                parent du bloc v1.24 #4, remplace par bouton header).
 *            (2) Identité compacte : date+type+libellé+pills (etat,
 *                type_competition, domicile_exterieur). Bloc densifié
 *                (la ligne « secondaire » dispersée v1.24 partie en
 *                Niveau 1).
 *            (3) Bannière Niveau 1 : 5 cellules auto-adaptatives
 *                essentielles (HORAIRES, LIEU+domicile, ÉQUIPES
 *                ENGAGÉES+formats, ADVERSAIRES synthèse, SCORE
 *                conditionnel Q2 acté). Grille CSS auto-fit, gère
 *                gracieusement 1 à 5 cellules selon données peuplées
 *                (entraînement → 2 cellules HORAIRES+LIEU, compétition
 *                multi-équipes → 4-5 cellules).
 *            (4) Bannière Niveau 2 : 5 secondaires dépliables via
 *                chevron (STRUCTURE PHASES + lien « voir le détail » →
 *                #evt-phases-detail, RENDEZ-VOUS dégradation honnête
 *                MODELE-EVT-HORAIRES-RDV 🟠, STATUT COMPOSITIONS,
 *                ENCADREMENT résumé inline « Prénom N. », NOTES texte
 *                libre absorbé depuis ancien bloc #10 v1.24).
 *            (5) Bloc Suivi de rencontre : INVARIANT byte-identique
 *                via renderSuiviSection(evt). Wrapper id="evt-suivi-
 *                rencontre" addition pure pour ancre scroll depuis
 *                grille 8 liens. Aucune modification du contenu.
 *            (6) Grille FONCTIONNALITÉS DE L'ÉVÈNEMENT : 8 grands
 *                boutons avec icône + titre + sous-titre + badge
 *                statut honnête (Disponible ✅ / En cours ⏳ / À venir
 *                🔜). Q4=C adaptation multi-équipes pour Compositions/
 *                Groupes : 1 équipe → ouverture directe (handler
 *                Niveau 0 INVARIANT) ; N équipes → expansion in-situ
 *                avec liste équipes inline (handler expand-fonction
 *                neuf, réutilise data-evenement-equipe-id +
 *                ouvrir-groupe-base/ouvrir-feuille-equipe byte-
 *                identiques). Lien Suivi (#2) = ancre scroll vers le
 *                bloc (5). Lien Encadrement (#4) = expansion in-situ
 *                avec liste M8 détaillée (édition unifiée via Modifier).
 *                Liens #5-8 désactivés avec badges honnêtes.
 *            (7) Sous-section #evt-phases-detail : préserve byte-
 *                identique l'ancien bloc Phases du tournoi v1.24 #3
 *                (regroupement par phase + matchs avec heure/libellé/
 *                adversaire/badge). Valeur opérationnelle conservée,
 *                scrolled depuis lien « voir le détail » Niveau 2.
 *            (8) Bloc Logistique déplacement : préservé fonctionnel
 *                byte-identique (P2-E.3 formulaire structuré + collapsible
 *                + handler logistique-from-fiche). Position : entre
 *                grille 8 liens et Actions. Affiché si
 *                logistique_deplacement peuplé OU type='deplacement'.
 *            (9) Actions §3.3 doc UX strict : « ✏️ Modifier » + « 📋
 *                Dupliquer » + « 🗑 Supprimer » (3 boutons). Suivi
 *                convention soft-delete projet : « Supprimer » = handler
 *                cancel-from-fiche INVARIANT (etat='annule', scénario 5
 *                modèle v1.1 « passé immuable »). Cas etat='annule' →
 *                « ↩ Réactiver » (handler reactivate-from-fiche INVARIANT).
 *
 *          HELPER NEUF renderFonctionCellule(opts) : génère 1 cellule
 *          de la grille (6) avec statut adaptatif Disponible/En cours/À
 *          venir. Q4=C : Compositions/Groupes/Encadrement adaptatifs
 *          selon nombre d'équipes engagées. Action 'expand-fonction'
 *          neuve pour toggle expansion in-situ.
 *
 *          INVARIANTS BYTE-IDENTIQUES (preuve md5 individuel) :
 *            - 12 fonctions Suivi A/B/C : renderSuiviRencontreBloc,
 *              renderSuiviSection, refreshSuiviSection, bindSuiviActions,
 *              suiviBuildUrl, suiviGenerer, suiviPartager,
 *              modeVideoBuildUrl, renderModeVideoAcces, spectateurBuildUrl,
 *              renderSpectateurAcces, renderTempsDeJeuMount
 *            - Helpers utilitaires : escHtml, formatDateShort,
 *              formatHeureOnly, statutCompoBadge, TYPE_LABELS,
 *              EVENTS_BY_ID, CHILDREN_BY_PARENT, openFiche, closeFiche
 *            - Handlers Niveau 0 réutilisés (réutilisation byte-
 *              identique du data-action via la grille adaptative
 *              Q4=C) : ouvrir-groupe-base, ouvrir-feuille-equipe
 *            - Handlers actions préservés : edit-from-fiche, cancel-
 *              from-fiche, reactivate-from-fiche, logistique-from-fiche
 *            - Modale Création L4 v2 (openModalCreate, MODAL_CREATE_DUP
 *              _SRC_ID, populateDupSourceDropdown, prefillFormFromSource)
 *              réutilisée pour Modifier + Dupliquer via handlers.
 *
 *          HANDLERS NEUFS bindFicheActions v1.25 :
 *            - retour-calendrier (closeFiche())
 *            - retour-parent (closeFiche + openFiche(parent_id))
 *            - toggle-niveau-2 (toggle hidden + aria-expanded + chevron)
 *            - duplicate-from-fiche (closeFiche + openModalCreate +
 *              bascule radio create_mode=dupliquer + présélection source)
 *            - voir-suivi (scrollIntoView #evt-suivi-rencontre)
 *            - voir-phases-detail (scrollIntoView #evt-phases-detail)
 *            - expand-fonction (toggle hidden + aria-expanded de la
 *              section expand-{sectionId})
 *
 *          HANDLERS RETIRÉS bindFicheActions v1.25 (écart gouvernance
 *          E-5 §gouvernance, tracé en STATE pt 20) :
 *            - compos-from-fiche (Q5=A : « Retour au calendrier » F-4
 *              remplace ; navigation Évt↔Compos retravaillée en conv
 *              UX-PARCOURS-NAV suivante)
 *            - notes-from-fiche (Q3=B : Notes absorbées Niveau 2,
 *              édition unifiée via Modifier)
 *            - engager-equipe-from-fiche (Q3=B édition inline retirée)
 *            - retirer-equipe-from-fiche (Q3=B édition inline retirée)
 *            - ajouter-adversaire-from-fiche (Q3=B édition inline retirée)
 *            - retirer-adversaire-from-fiche (Q3=B édition inline retirée)
 *
 *          ÉCART GOUVERNANCE NEUF E-5 (à acter STATE pt 20, pattern
 *          option 2 pt 11/15/16/17/19) : Q3=B retire l'édition inline
 *          M3/M5 (engager/retirer équipe, +/− adversaire) au profit du
 *          parcours strict « Modifier rouvre la modale L4 v2 unique »
 *          (centre névralgique F-1). Régression fonctionnelle ponctuelle
 *          assumée : ajouter 1 adversaire = ouverture modale entière.
 *          Cohérent doctrine P1 simplicité + parcours unifié. Tracé
 *          changelog + STATE pt 20.
 *
 *          DETTE COSMÉTIQUE NON ABSORBÉE : UX-EVT-DOUBLON-GROUPER-BOUTON
 *          🟢 (ouverte pt 19, sur écran d'accueil §3.4) reste ouverte —
 *          sujet strict §3.2-3.3 ici, doublon est hors périmètre de la
 *          fiche évènement.
 *
 *          Bump console.log boot : "v1.24 (S3 Refonte UX Evt→Compo)" →
 *          "v1.25 (S3 Refonte UX Evt→Compo · L3b)" + "v1.24 (S3 Refonte
 *          UX Evt→Compo · L3a) chargé" → "v1.25 (S3 Refonte UX Evt→Compo
 *          · L3b) chargé". S2a strict version-only pattern pt 17.
 *
 *          Provenance md5 chaîne maillon par maillon : v1.24 9a8a06d8
 *          → v1.25 (recollé après écriture, audit md5 byte-identité
 *          12/12 fonctions Suivi A/B/C joint à la livraison).
 *
 *   v1.26 : UX-EVT-DOUBLON-GROUPER-BOUTON · retrait groupbar interne
 *          (Production · 27/05/2026, pt 20 suite 2) — Lève la dette
 *          cosmétique `UX-EVT-DOUBLON-GROUPER-BOUTON` 🟢 ouverte pt 19
 *          (observée terrain recette pt 19 : 2 boutons « Grouper par
 *          catégorie » visibles simultanément).
 *
 *          DIAGNOSTIC (cartographie source v1.25) :
 *            - Bouton OFFICIEL H-5 §3.4 doc UX FAIT FOI = bouton header
 *              `<button id="evt-btn-grouper-categorie">` dans
 *              `evenements.html` v3, caché display:none par défaut,
 *              révélé conditionnellement par `revelerBoutonAdminSiAdmin`
 *              v1.24 → ADMIN UNIQUEMENT (cohérent §3.4 H-5 admin-only
 *              strict). Câblage handler dans `bindEvents` ligne 4801-
 *              4809 : `state.grouperParCategorie = !` + `savePrefs()`
 *              + `renderListe()`.
 *            - Bouton LEGACY (doublon à retirer) = bloc `evt-groupbar`
 *              rendu dynamiquement par `renderListe` (lignes 1241-
 *              1255 v1.25) en tête de #evt-list. Handler câblé dans
 *              `bindCardEvents` ligne 1340-1347 sur le sélecteur
 *              `[data-action="toggle-grouper"]`. Reliquat de l'ère
 *              U3 v1.14 (bascule « Grouper par catégorie » antérieure
 *              à la doctrine UX §3.4 H-5 admin-only). VISIBLE PAR TOUS
 *              les utilisateurs (coach inclus) → CONTRADICTION avec
 *              doc UX §3.4 H-5 admin-only strict.
 *
 *          BONUS INATTENDU (correctif de gouvernance UX) : le retrait
 *          du bouton interne ne se contente pas de lever le doublon
 *          cosmétique, il CORRIGE aussi une régression silencieuse —
 *          un coach non-admin voyait jusqu'à présent la groupbar
 *          interne et pouvait activer le groupement par catégorie
 *          alors que doc UX §3.4 H-5 réserve cette fonction à l'admin
 *          strict. La gouvernance UX est désormais alignée doc.
 *
 *          PÉRIMÈTRE v1.26 (8 hunks ciblés diff prouvé minimal) :
 *            (1) Bump version en-tête v1.25 → v1.26.
 *            (2) Bloc changelog v1.26 ajouté en-tête (addition pure).
 *            (3) Retrait bloc `const toggleBar = '<div class="evt-
 *                groupbar">...</div>';` (lignes 1241-1255 v1.25, 15
 *                lignes) + commentaire « U3 (v1.14) — bascule "Grouper
 *                par catégorie" » associé.
 *            (4) Adapt usage `list.innerHTML = toggleBar + '<div...'`
 *                → `list.innerHTML = '<div...'` (branche total === 0).
 *            (5) Adapt usage `let html = toggleBar;` → `let html = '';`
 *                (branche total > 0).
 *            (6) Retrait handler `[data-action="toggle-grouper"]`
 *                dans `bindCardEvents` (lignes 1338-1347 v1.25, 10
 *                lignes) + commentaire « U3 (v1.14) » associé. Mort
 *                code après retrait (3).
 *            (7) Bump console.log boot init v1.25 (L3b) → v1.26.
 *            (8) Bump console.log boot final v1.25 (L3b) → v1.26.
 *
 *          Total : ~25 lignes retirées net, ~70 lignes ajoutées
 *          (changelog v1.26 dense + ce bloc). `evenements.html` v3
 *          NON TOUCHÉ (pas de CSS `.evt-groupbar` dans le `<style>`
 *          v3 → aucun CSS mort à nettoyer, périmètre strict JS).
 *
 *          INVARIANTS PROTÉGÉS (preuve byte-identité dédiée md5 post-
 *          écriture) :
 *            - 12 fonctions Suivi A/B/C (zone touchée = renderListe +
 *              bindCardEvents, hors fonctions Suivi)
 *            - `renderFiche` v1.25 byte-identique md5 (zone L3b
 *              §3.2-3.3 fiche évènement non touchée)
 *            - `bindFicheActions` v1.25 byte-identique md5 (zone L3b
 *              fiche évènement non touchée)
 *            - Handlers Niveau 0 `ouvrir-groupe-base` + `ouvrir-
 *              feuille-equipe` byte-identiques (dans bindFicheActions
 *              non touchée)
 *            - Helper `renderFonctionCellule` v1.25 byte-identique
 *              (zone L3b non touchée)
 *            - Bouton OFFICIEL H-5 admin-only `revelerBoutonAdmin
 *              SiAdmin` v1.24 + son handler dans bindEvents ligne
 *              4801-4809 byte-identiques (préservés strictement).
 *
 *          ÉCART GOUVERNANCE NEUF E-6 ASSUMÉ (à acter STATE pt 20
 *          sous-bloc « suite 2 », pattern option 2 pt 11/15/16/17/19/
 *          20) : cycle pt 20 = strict sujet `renderFiche` §3.2-3.3
 *          fiche évènement (livraison principale v1.25 + passe CSS
 *          L3b suite v3) ; `UX-EVT-DOUBLON-GROUPER-BOUTON` touche
 *          l'écran d'accueil §3.4 = périmètre différent. Absorption
 *          assumée pour cohérence fichier (continuité `evenements-
 *          browser.js`, recette terrain pt 20 absorbe naturellement
 *          v1.25 + v3 + v1.26).
 *
 *          Bump console.log boot : "v1.25 (S3 Refonte UX Evt→Compo ·
 *          L3b)" → "v1.26 (S3 · UX-EVT-DOUBLON-GROUPER-BOUTON levée)".
 *          S2a strict version-only pattern pt 17.
 *
 *          Provenance md5 chaîne maillon par maillon : v1.24 9a8a06d8
 *          → v1.25 3c841387 → v1.26 (recollé après écriture, audit
 *          md5 byte-identité 12/12 Suivi A/B/C + renderFiche +
 *          bindFicheActions joint à la livraison).
 *
 *   v1.27 : Éditeur de phases à la CRÉATION (tournoi multi-phases /
 *          multi-équipes). Implémente le doc FAIT FOI
 *          `Conception-Refonte-UX-Creation-Evt-MultiPhases-v1.md`
 *          (md5 c5f9998a, §3 décisions D1→D9). Constat de la conception
 *          (vérifié à la source) : le backend (RPC sql/52
 *          `creer_evenement_complet`, md5 2778691e) sait DÉJÀ tout faire
 *          — il consomme intégralement p_phases_par_equipe. La friction
 *          était PUREMENT UI : buildPhasesParEquipeList n'affichait aucun
 *          champ (texte de consigne) et submitModalCreate envoyait une
 *          phase fantôme codée en dur `phases:[{libelle:'Phase 1',
 *          ordre:1}]`. Cette version branche l'éditeur réel sur le
 *          backend prêt.
 *
 *          ZÉRO SQL, AUCUNE modification de la RPC. evenements.html v3
 *          (md5 d8b2aa2e) NON TOUCHÉ : tout le CSS nécessaire existait
 *          DÉJÀ (.evt-phase-box / .evt-phase-box-head / .evt-phase-match-
 *          row / .evt-eng-btn / .evt-eng-btn-remove + .evt-fiche-
 *          collapsible/.evt-fiche-chevron/.is-open pour le repli) — pièce
 *          d'UI jamais construite, branchée sur un design déjà stylé.
 *          Correction de périmètre signalée : la passation prévoyait une
 *          passe CSS ; lecture source → inutile (parité avec le pt 23
 *          sur la constante SITES).
 *
 *          Chantiers (1 seul fichier touché) :
 *            (1) buildPhasesParEquipeList REFONDU en éditeur réel : 1
 *                carte repliable par équipe cochée (D8), phases nommées
 *                + date optionnelle illimitées (D2 + D-PROD-2), matchs
 *                illimités par phase (D4), adversaires en emplacements
 *                « adv N » ajustables (D5). Départ VIDE (D-PROD-1 : 0
 *                phase, le coach clique « + Phase »). PRÉSERVATION à la
 *                re-coche : ne reconstruit que les cartes des équipes
 *                nouvellement cochées, retire les décochées, conserve les
 *                phases déjà saisies des autres (état porté par le DOM).
 *            (2) Helpers neufs : _phaseBoxHtml / _matchRowHtml /
 *                _refreshPhasesResume / _renumberDefaultAdversaires +
 *                bindPhasesEditor (délégation d'événements posée 1× dans
 *                bindEvents, idempotente via flag _phasesEditorBound).
 *            (3) submitModalCreate : bloc phases REFONDU — lecture réelle
 *                de l'éditeur → JSONB p_phases_par_equipe complet (mapping
 *                §4 doc FAIT FOI) + VALIDATION CLIENT « ≥ 1 phase par
 *                équipe » (message honnête, plus de phase fantôme).
 *
 *          Format par équipe (D7) DÉJÀ livré v1.24 (buildFormatParEquipe-
 *          Lines + lecture payload) → conservé byte-identique, non rouvert.
 *
 *          Invariants prouvés byte-identiques (baseline md5 par extraction
 *          avant/après écriture) : 12 fonctions Suivi A/B/C + handlers
 *          Niveau 0 (ouvrir-groupe-base / ouvrir-feuille-equipe via
 *          bindFicheActions) + renderFiche + renderFonctionCellule +
 *          helpers voisins (buildFormatParEquipeLines /
 *          buildAdvParEquipeLines / buildAffectationsN2Lines /
 *          peuplerStaff / peuplerEquipesEngagees / updatePhasesMode-
 *          Visibility). bindEvents NON byte-identique par construction
 *          (ajout de l'appel bindPhasesEditor, tracé).
 *
 *          Bump console.log boot init + final : "v1.26 (S3 · UX-EVT-
 *          DOUBLON-GROUPER-BOUTON levée)" → "v1.27 (S3 · éditeur de
 *          phases à la création)".
 *
 *          Provenance md5 : v1.26 2c7f9a50 → v1.27 (recollé après
 *          écriture, joint à la livraison).
 *
 *   v1.28 : Phases — couverture étendue + anti-doublon adversaires
 *          (corrections terrain post-v1.27, décisions Manu).
 *
 *          (A) PHASES POUR 4 SOUS-TYPES (pas seulement « tournoi ») :
 *          le multi-phases sert tournoi + Challenge Vié + Challenge
 *          Inter-Ligues + Seven (cohérent doc FAIT FOI §3.4, couverture
 *          Vié/Seven/coupe). Constante module UNIQUE PHASES_SOUS_TYPES,
 *          source de vérité partagée par updateCreateConditionalFields
 *          (calcul du mode A5) et submitModalCreate (lecture phases vs
 *          adversaires + exclusion A3). Avant : 'tournoi' en dur à 4
 *          endroits → Vié/inter-ligues/Seven ne déclenchaient rien.
 *
 *          (B) FRONTIÈRE NETTE plateau/tournoi (décision Manu) :
 *          A4 plateau = matchs simples (adversaires par équipe), JAMAIS
 *          de phases ; A5 (les 4 sous-types) = éditeur de phases, JAMAIS
 *          d'adversaires par équipe. La question « Avec phases ? » en A4
 *          est RETIRÉE (showPhasesQ=false) — un plateau n'a pas de phases.
 *          Supprime le doublon adversaires/phases (UX-2b) par
 *          construction : le bloc adv-par-équipe et l'éditeur de phases
 *          sont désormais mutuellement exclusifs (gouvernés par le mode).
 *
 *          Détails : showAdvParEq = A4 seul ; showPhasesZone = A5 seul ;
 *          peuplement adv/phases gouverné par le display réel des zones ;
 *          submit ne lit le bloc adv que hors PHASES_SOUS_TYPES ; isA3
 *          exclut plateau ET les 4 sous-types à phases ; isA5 mort retiré
 *          de updateMultiEquipesUI (l'affichage suit le display réel).
 *
 *          Recette terrain v1.27 OK (captures Manu : 2 équipes M14,
 *          formats XV/X hétérogènes, éditeur de phases fonctionnel,
 *          résumé live, repli) — v1.28 corrige le périmètre des
 *          sous-types + le doublon adv constaté en recette.
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html NON touché. Invariants
 *          (12 Suivi A/B/C + Niveau 0 + renderFiche + renderFonctionCellule
 *          + helpers voisins) byte-identiques. Provenance md5 : v1.27
 *          (3ccbf834) → v1.28 (recollé après écriture, joint).
 *
 *   v1.29 : Format par équipe — affichage dès 1 équipe + pré-sélection du
 *          format réel (corrections terrain v1.28, décisions Manu).
 *
 *          (A) Bloc FORMAT PAR ÉQUIPE visible dès 1 équipe cochée (était
 *          >= 2). Utile pour une équipe engagée dans un format spécifique
 *          (ex. Seven à VII alors que l'équipe joue normalement à XV).
 *
 *          (B) Dropdown format PRÉ-SÉLECTIONNÉ sur le format réel de chaque
 *          équipe. listEquipes (supabase-client v1.34 L2028) projette déjà
 *          `format_jeu_code` → stocké en data-format sur la checkbox équipe
 *          (peuplerEquipesEngagees), lu par buildFormatParEquipeLines qui
 *          ajoute `selected` sur l'option correspondante. GARDE de
 *          dégradation honnête : si la valeur ne matche aucune option du
 *          dropdown (CHECK base XV/13/12/X/9/8/7), reste sur « — Hérité — »
 *          (jamais d'erreur). Le mapping exact des valeurs format_jeu_code
 *          ↔ options reste à confirmer terrain (colonnes distinctes
 *          equipes.format_jeu_code vs override evenement format_de_jeu).
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html NON touché, wrapper
 *          listEquipes NON touché (le champ était déjà projeté). Invariants
 *          (12 Suivi A/B/C + Niveau 0 + renderFiche + renderFonctionCellule)
 *          byte-identiques ; buildFormatParEquipeLines + peuplerEquipes-
 *          Engagees modifiés (tracés). Provenance md5 : v1.28 (eb4d7c79)
 *          → v1.29 (recollé après écriture, joint).
 *
 *   v1.30 : Format par équipe INTÉGRÉ dans la ligne d'équipe (côte à côte,
 *          décision Manu : « équipes engagées et format par équipe sur la
 *          même ligne »). Supprime la répétition du nom d'équipe (avant :
 *          nom dans la case + nom au-dessus du dropdown séparé).
 *
 *          peuplerEquipesEngagees construit désormais, par équipe, une
 *          .evt-eng-equipe-line = [case + libellé] + [<select> format
 *          MASQUÉ par défaut, RÉVÉLÉ (inline-flex) quand la case est
 *          cochée]. Décisions Manu : format visible seulement si coché ;
 *          dès 1 équipe. Le select réutilise les classes EXACTES de
 *          l'ancien bloc (.evt-eng-format-row[data-equipe-id]
 *          .evt-eng-format-select) → submitModalCreate lit le format
 *          depuis #evt-create-equipes (fallback ancien conteneur), avec
 *          pré-sélection du format réel (data-format) + garde honnête.
 *
 *          Le bloc séparé #evt-create-format-par-equipe est NEUTRALISÉ
 *          (gardé masqué dans updateMultiEquipesUI, plus peuplé).
 *          buildFormatParEquipeLines conservée mais n'est plus appelée
 *          (morte de fait, laissée intacte — non régressée).
 *
 *          Layout via style inline minimal sur .evt-eng-equipe-line
 *          (flex/align/gap/wrap) + .evt-eng-format-inline → evenements.html
 *          NON touché (classes neuves, pas de CSS à ajouter).
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. Invariants (12 Suivi A/B/C + Niveau 0 + renderFiche
 *          + renderFonctionCellule + buildPhasesParEquipeList) byte-
 *          identiques ; seule peuplerEquipesEngagees modifiée (+ submit
 *          format-read adapté). Provenance md5 : v1.29 (6503f169) → v1.30
 *          (recollé après écriture, joint).
 *
 *   v1.31 : FIX création tournoi (bug terrain « essai 4 ») —
 *          `null value in column "libelle" of relation "evenements"
 *          violates not-null constraint`. Cause (diagnostic par le fait,
 *          pas supposé) : la RPC sql/52 crée chaque MATCH comme une ligne
 *          `evenements` (M6) où `libelle` est NOT NULL ; l'éditeur de
 *          phases v1.27 n'envoyait QUE { ordre, adversaire_nom? } pour
 *          les matchs — jamais de `libelle` → NULL → violation. La phase
 *          avait déjà un fallback client (« Phase N ») donc passait ; le
 *          match était le seul trou. Le libellé racine (« essai 4 ») et
 *          les phases n'étaient pas en cause.
 *
 *          Correctif minimal (submitModalCreate, bloc matchs) : chaque
 *          match porte désormais toujours un `libelle` dérivé —
 *          « vs <adversaire> » si un adversaire est saisi, sinon
 *          « Match N ». Aligné sur le pattern de la voie duplication
 *          (submitModalCreateDuplication : phaseLibelle + ' — vs ' + adv).
 *          1 seul bloc touché ; aucune autre logique modifiée.
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. Invariants byte-identiques (le bloc matchs vit
 *          dans submitModalCreate, hors fonctions invariantes). Provenance
 *          md5 : v1.30 (092b496a) → v1.31 (recollé après écriture, joint).
 *
 *   v1.32 : FIX collision `duplicate key value violates unique constraint
 *          "evenements_code_key"` à la création tournoi (bug terrain
 *          « essai 5 », Challenge Vié). Diagnostic à la source (sql/52
 *          md5 2778691e lue) : la RPC GÉNÈRE elle-même les codes enfants
 *          à partir du code racine — v_phase_code := p_code||'-PH'||ordre,
 *          v_match_code := v_phase_code||'-M'||ordre (L438/L465). Le code
 *          racine p_code (= generateEventCode côté client, confirmé : INSERT
 *          racine `code = p_code` L347, et voie duplication génère un code
 *          client par ligne) est donc le PRÉFIXE de tout l'arbre. Or
 *          l'ancien format gardait un préfixe CONSTANT pour tous les essais
 *          d'un même jour/type (EVT-AAAA-MM-JJ-TYPE-M14-<rand4>) → seuls
 *          4 chars distinguaient → collision sur essais répétés (racine ou
 *          enfant). Fournir un `code` par phase/match au payload aurait été
 *          inutile : la RPC ne le lit pas (H2 écartée par lecture).
 *
 *          Fix (generateEventCode, côté client — le projet génère p_code
 *          côté client) : entropie renforcée — segment HHMMSS issu de
 *          l'INSTANT DE GÉNÉRATION (now, pas de dateDebut sinon deux essais
 *          même date pré-remplie collisionneraient) + rand 4→6 chars.
 *          Nouveau format EVT-AAAA-MM-JJ-HHMMSS-TYPE-M14-<rand6>. Deux
 *          créations à des secondes différentes sont forcément distinctes ;
 *          rand6 couvre la même seconde. Couvre racine ET enfants (préfixe
 *          commun). Aucun site d'appel modifié (4 appels inchangés).
 *
 *          ZÉRO SQL, RPC sql/52 NON modifiée (lue seulement), evenements.html
 *          + supabase-client.js NON touchés. Invariants byte-identiques
 *          (generateEventCode hors fonctions invariantes). Provenance md5 :
 *          v1.31 (bdff2789) → v1.32 (recollé après écriture, joint).
 *
 *   v1.33 : Date de fin masquée tant que « Sur plusieurs jours » décoché
 *          (détail terrain). Symptôme : en mode tournoi/plateau (A4/A5),
 *          le champ DATE FIN s'affichait dès l'ouverture alors que la case
 *          « Sur plusieurs jours » n'était pas cochée. Cause : dans
 *          updateCreateConditionalFields, setDisplay('…-date-fin-group',
 *          showDateFin || showMultijours) → proposer la case multijours
 *          (showMultijours vrai en A4/A5) affichait AUSSI la date de fin
 *          immédiatement, avant toute interaction. Fix : la date de fin
 *          ne s'affiche à l'ouverture que si showDateFin (type qui la
 *          porte nativement, ex. stage) OU si la case multijours est
 *          EFFECTIVEMENT cochée (showMultijours && toggle.checked) ; sinon
 *          c'est le handler change de la case qui la révèle. form.reset()
 *          à l'ouverture (openModalCreate) décoche la case → pas d'état
 *          résiduel entre deux créations. Handler change inchangé.
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. 1 ligne logique modifiée dans
 *          updateCreateConditionalFields (hors fonctions invariantes).
 *          Provenance md5 : v1.32 (5ba27fb9) → v1.33 (recollé après
 *          écriture, joint).
 *
 *   v1.34 : Plateau (A4) — adversaires MULTIPLES par équipe + nom de poule
 *          (coquille terrain signalée). Un plateau est par nature une
 *          compétition où chaque équipe rencontre PLUSIEURS adversaires
 *          (poule) ; l'UI n'en permettait qu'UN (input unique par équipe).
 *          buildAdvParEquipeLines refondue : par équipe cochée, un champ
 *          « Nom de poule » (opt.) + une LISTE d'adversaires empilables
 *          (helper _advRowHtml, bouton « + Adversaire » data-action=add-adv,
 *          croix data-action=remove-adv ; délégation bindAdvEditor posée 1×,
 *          calquée sur bindPhasesEditor). submitModalCreate (bloc adv A4)
 *          lit désormais TOUS les .evt-eng-adv-input non vides → eng.
 *          adversaires[] avec ordre incrémental, et le nom de poule →
 *          eng.notes (M3). La RPC sql/52 consomme déjà adversaires[] (M5,
 *          boucle jsonb_array_elements L399) et notes M3 (L375) → AUCUN
 *          changement RPC/schéma. Bloc cantonné A4 (showAdvParEq = mode
 *          'A4') : A3 mono et A5 phases intacts. Classes .evt-eng-btn /
 *          .evt-eng-btn-remove déjà en CSS → evenements.html NON touché.
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. Invariants (12 Suivi A/B/C + Niveau 0 + renderFiche
 *          + renderFonctionCellule + buildPhasesParEquipeList) byte-
 *          identiques ; buildAdvParEquipeLines modifiée (tracée) + helpers
 *          neufs. Provenance md5 : v1.33 (f29a3fa6) → v1.34 (recollé après
 *          écriture, joint).
 *
 *   v1.35 : Match officiel/amical à 2+ équipes → comportement PLATEAU
 *          (coquille terrain). Le mode était calculé par le seul sous-type :
 *          match_championnat/match_amical → toujours A3 (mono-adversaire),
 *          même avec 2 équipes cochées → un seul champ adversaire affiché.
 *          Or 2 de nos équipes engagées = chacune son/ses adversaire(s)
 *          (cohérent avec le texte d'aide « 2+ = multi-équipes »). Fix :
 *          (A) calcul du mode — MATCH_SIMPLE_SOUS_TYPES (championnat/amical)
 *          bascule A3→A4 dès _nbEqCochees >= 2 (lecture des cases cochées) ;
 *          à 1 équipe, reste A3. (B) le hook change des cases équipe appelle
 *          désormais updateCreateConditionalFields() (recalcul du mode),
 *          plus seulement updateMultiEquipesUI() — peuplerEquipesEngagees
 *          étant idempotent (_eq4aLoadedForCat), la case cochée n'est pas
 *          détruite. Le submit était DÉJÀ correct (isA3 = cbList.length===1,
 *          donc 2 équipes → branche plateau, lecture adv par équipe v1.34).
 *          phasesOui basé sur PHASES_SOUS_TYPES → aucune exigence de phase
 *          pour un match à 2 équipes. Le sous-type stocké ne change pas.
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. Invariants byte-identiques (modifs dans
 *          updateCreateConditionalFields + hook change, hors fonctions
 *          invariantes). Provenance md5 : v1.34 (436de799) → v1.35 (recollé
 *          après écriture, joint).
 *
 *   v1.36 : Match officiel/amical à 2+ équipes : 1 SEUL adversaire par
 *          équipe (correction d'une sur-assimilation au plateau en v1.35).
 *          Un match officiel/amical ≠ plateau : chacune de nos équipes a
 *          UN adversaire programmé, pas une poule. buildAdvParEquipeLines
 *          gagne un paramètre plateauMode : true (type='plateau') → poule
 *          (multi-adversaires + nom de poule, v1.34) ; false (match_*
 *          multi-équipes) → un seul champ adversaire par équipe, NI bouton
 *          « + Adversaire » NI champ poule. updateMultiEquipesUI passe
 *          sousType==='plateau'. Les deux variantes gardent
 *          .evt-eng-adv-input + data-equipe-id → submitModalCreate lit sans
 *          changement (variante match = 1 input, pas de .evt-eng-poule-input
 *          → pas de notes). bindAdvEditor (boutons) appelé seulement en
 *          variante plateau. Le basculement A3↔A4 selon le nombre d'équipes
 *          (v1.35) est conservé.
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. Invariants byte-identiques (buildAdvParEquipeLines
 *          hors fonctions invariantes suivies). Provenance md5 : v1.35
 *          (39c5b6a0) → v1.36 (recollé après écriture, joint).
 *
 *   v1.37 : Modals — plus de fermeture au clic HORS modal (retour terrain
 *          critique : un clic accidentel sur le fond fermait le modal et
 *          faisait perdre TOUTE la saisie — dramatique sur le formulaire
 *          de création riche, 2 équipes × phases × adversaires). Le handler
 *          générique .evt-overlay (click → si target===overlay, remove
 *          'show') s'appliquait à TOUS les overlays, idem ficheOverlay.
 *          Les deux handlers de clic-fond sont SUPPRIMÉS (décision Manu :
 *          appliquer à tous les modals). Chaque modal garde son bouton de
 *          fermeture explicite (close-create/edit/notes/logistique/cancel/
 *          addmatch câblés L5526-5531 + croix close-fiche conservée) →
 *          aucun modal prisonnier. On ne ferme plus QUE par bouton.
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. Invariants byte-identiques (modif dans bindEvents,
 *          hors fonctions invariantes). Provenance md5 : v1.36 (23027526)
 *          → v1.37 (recollé après écriture, joint).
 *
 *   v1.38 : Détection tournoi corrigée — phases/matchs ENFIN affichés
 *          (carte, fiche, suivi). Bug terrain : un tournoi (Challenge Vié,
 *          etc.) a en base type_evenement='competition' + type_competition=
 *          'tournoi'. Or 3 endroits testaient `evt.type_evenement ===
 *          'tournoi'` — TOUJOURS faux → la carte n'affichait pas le chevron
 *          de déploiement, la fiche ne montrait pas la section « Phases du
 *          tournoi » (et ne chargeait même pas les enfants : enfants =
 *          isTournoi ? … : []), et le bloc Suivi ne listait pas les liens
 *          par match. Données pourtant présentes (4 enfants confirmés en
 *          base ET chargés côté client). Fix : helper estEvtAPhases(evt)
 *          basé sur type_competition ∈ PHASES_SOUS_TYPES (source de vérité
 *          unique), substitué aux 3 occurrences (renderCard L1534,
 *          renderFiche L2576, renderSuiviSection L2323). Plus aucun test
 *          actif sur type_evenement==='tournoi' (reste 1 commentaire).
 *
 *          ZÉRO SQL, RPC inchangée, evenements.html + supabase-client.js
 *          NON touchés. INVARIANTS renderCard/renderFiche/renderSuiviSection
 *          MODIFIÉS (tracé : vrai bug, détection corrigée — 1 ligne chacun
 *          via le helper) ; buildPhasesParEquipeList + buildAffectationsN2Lines
 *          byte-identiques. Provenance md5 : v1.37 (7a52ff5c) → v1.38
 *          (recollé après écriture, joint).
 *
 *   v1.39 : Fiche — les MATCHS s'affichent sous chaque phase (hiérarchie
 *          3 niveaux racine→phase→match). Bug terrain : la section « Phases
 *          du tournoi » de la fiche itérait sur les enfants DIRECTS de la
 *          racine (= les phase-boîtes) et les affichait comme s'ils étaient
 *          des matchs → « (adv. à déterminer) » partout, jamais les vrais
 *          matchs (vs Nord Alsace…), qui sont les enfants des phase-boîtes
 *          (CHILDREN_BY_PARENT[phaseBox.id]), pas de la racine. Données
 *          pourtant présentes ET chargées (8 matchs confirmés). Fix
 *          (renderFiche, section #evt-phases-detail) : regroupement par
 *          phase_libelle, et sous chaque phase on liste ses VRAIS matchs
 *          via CHILDREN_BY_PARENT[phaseBox.id] ; fusion des matchs des 2
 *          équipes partageant une même phase ; fallback structure 2 niveaux
 *          (phase-boîte portant elle-même un adversaire) préservé.
 *          ACCOMPAGNÉ d'un fix SQL v6 (get_evenements_a_venir/passes) qui
 *          charge les descendants des DEUX équipes engagées (sinon les
 *          matchs de M14-2 manquaient, equipe_id≠M14-1).
 *          TRACÉ (non fait ici) : renderEnfantsTournoi (carte dépliée) +
 *          renderSuiviSection ont la même hiérarchie 2-niveaux à corriger.
 *
 *          evenements.html + supabase-client.js NON touchés (le fix SQL
 *          vit dans fix-get_evenements_*.sql, à réexécuter en base).
 *          renderFiche MODIFIÉ (tracé) ; buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.38 (ad38da26) → v1.39 (recollé après écriture, joint).
 *
 *   v1.40 : Trois retours terrain (fiche tournoi).
 *          (n°1) Matchs groupés par PHASE puis par ÉQUIPE : sous chaque
 *          phase, un sous-titre par équipe engagée (« SAR/MOM-M14-1 », etc.)
 *          puis ses matchs. v1.39 fusionnait toutes équipes → on ne savait
 *          pas qui affrontait qui. Regroupement par equipe_id, nom via
 *          eqNames, repli UUID ; sous-titre masqué si une seule équipe.
 *          (n°2) Cohérence des noms d'équipe : eqNames utilise désormais
 *          nom_officiel EN PREMIER (homogène : SAR/MOM-M14-1 / -2) au lieu
 *          de libelle_court (incohérent : « M14 » pour M14-1, null→repli
 *          pour M14-2). Corrige aussi les vignettes Compositions/Groupes
 *          (renderFonctionCellule reçoit eqNames, non modifié).
 *          (n°3) Bannière « prochaine étape » pleine largeur au-dessus de
 *          la grille des fonctionnalités, mettant en avant Groupes de base
 *          (compétition + ≥1 équipe). Additive (grille des 8 fonctions =
 *          invariant NON touché) : bandeau cliquable data-action=
 *          focus-groupe-base → scrolle + surligne la vignette « groupes »
 *          existante. Handler neuf, réutilise la cellule, ne la duplique pas.
 *
 *          evenements.html + supabase-client.js NON touchés. renderFiche +
 *          bindFicheEvents MODIFIÉS (tracé) ; buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.39 (f589c731) → v1.40 (recollé après écriture, joint).
 *
 *   v1.41 : Heure « 2h » fantôme corrigée. Un évènement créé sans heure
 *          (input type=date, v3.4) est stocké à minuit UTC (00:00:00+00) ;
 *          affiché en heure de Paris (UTC+2 l'été) ça donnait « 2h » dans
 *          la cellule Horaires de la fiche — une heure que l'utilisateur
 *          n'a jamais saisie. Fix dans formatHeureOnly (helper central, donc
 *          corrige fiche + matchs + phases d'un coup) : si getUTCHours()===0
 *          ET getUTCMinutes()===0 (minuit UTC pile = heure non saisie) →
 *          renvoie '' (rien affiché). Les vraies heures (entraînements 18h
 *          Paris = 16h UTC, etc.) ont getUTCHours()≠0 → affichées normalement.
 *          Cellule Horaires de la fiche masquée si aucune heure significative
 *          (évite cellule vide / « → » orphelin).
 *
 *          evenements.html + supabase-client.js NON touchés. formatHeureOnly
 *          + cellule Horaires renderFiche MODIFIÉS (tracé) ;
 *          buildPhasesParEquipeList + buildAffectationsN2Lines byte-
 *          identiques. Provenance md5 : v1.40 (ca0ce515) → v1.41 (recollé
 *          après écriture, joint).
 *
 *   v1.42 : Horaires détaillés — ÉTAPE 3/4 (submit). Le bloc submit lit
 *          désormais les 4 champs horaires du formulaire (#evt-create-
 *          debut-match / -fin-prevue / -rdv-heure / -rdv-lieu) et les ajoute
 *          au payload createEvenementComplet (debut_match/fin_prevue/
 *          rdv_heure/rdv_lieu), seulement si renseignés (optionnels). Va de
 *          pair avec supabase-client v1.35 (mapping wrapper → p_debut_match
 *          etc.) et la RPC v7 (4 params + INSERT racine). Base = étape 1
 *          (migration colonnes TIME/TEXT, faite). RESTE étape 4/4 : afficher
 *          ces horaires en fiche + retirer le bandeau « pour mémoire » du HTML.
 *          Addition pure dans submitModalCreate (après les champs optionnels
 *          racines) ; buildPhasesParEquipeList + buildAffectationsN2Lines
 *          byte-identiques. Provenance md5 : v1.41 (95ba7da3) → v1.42
 *          (recollé après écriture, joint).
 *
 *   v1.43 : Horaires détaillés — ÉTAPE 4/4 (affichage fiche). La section
 *          « Rendez-vous » de la fiche affichait toujours « non saisi » +
 *          dette MODELE-EVT-HORAIRES-RDV 🔴. Maintenant que les horaires
 *          sont persistés (étapes 1-3), la section (renommée « Rendez-vous &
 *          horaires ») affiche les valeurs réelles : RDV (heure + lieu),
 *          début, fin prévue ; lignes construites seulement si renseignées ;
 *          repli « non saisi » honnête si tout vide ; DETTE LEVÉE (footnote
 *          retirée). Libellé du début ADAPTÉ au type (retour terrain) :
 *          « Début des matchs » (compétition) / « Début des activités »
 *          (stage) / « Début de l'entraînement » (entraînement). Helper
 *          local fmtT : TIME base "HH:MM:SS" → "HHhMM".
 *          ACCOMPAGNÉ du fix SQL v7 (get_evenements_a_venir/passes) qui
 *          REMONTE les 4 colonnes horaires (RETURNS TABLE + SELECT) — sans
 *          ça, evt.debut_match serait undefined côté fiche malgré la base.
 *          RESTE (volet B, tracé) : libellés ADAPTATIFS dans le FORMULAIRE
 *          de création (evenements.html + JS) selon le type sélectionné.
 *          renderFiche MODIFIÉ (tracé) ; buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.42 (dec1db5f) → v1.43 (recollé après écriture, joint).
 *
 *   v1.44 : Horaires détaillés — VOLET B (formulaire de création).
 *          (1) Le bloc horaires s'affiche désormais pour TOUS les types
 *          (showHoraires = true) — avant : A3/A4/A5 (compétition) seulement,
 *          donc absent en entraînement (A1) et stage (A2). Retour terrain :
 *          les horaires sont utiles pour tous.
 *          (2) Libellé du champ « début » ADAPTÉ au type sélectionné, comme
 *          en fiche : « Début des matchs » (compétition) / « des activités »
 *          (stage) / « de l'entraînement » (entraînement). Mise à jour du
 *          <label for="evt-create-debut-match"> dans updateMultiEquipesUI
 *          (au même endroit que le calcul du mode), sans toucher au HTML.
 *          Accompagné côté HTML (evenements.html, déployé v3.4) du retrait
 *          du bandeau jaune « pour mémoire » (faux : horaires persistés) +
 *          MAJ du commentaire bloc 6.
 *          buildPhasesParEquipeList + buildAffectationsN2Lines byte-
 *          identiques. Provenance md5 : v1.43 (e2dc7e5b) → v1.44 (recollé
 *          après écriture, joint).
 *
 *   v1.45 : Câblage des ENCADRANTS (zone « Encadrement » du formulaire de
 *          création). Bug : peuplerStaff() cherchait les wrappers
 *          listStaffParCategorie / listCollectifMembresStaff qui n'ont
 *          JAMAIS existé → fallback « wrapper non livré », zone vide, aucun
 *          encadrant cochable, payload.encadrants toujours vide. Or le
 *          wrapper réellement livré (v1.34 supabase-client) est
 *          listStaffDisponibles() (RPC list_staff_disponibles sql/56,
 *          SECURITY DEFINER, sortie {personne_id,nom,prenom} — exactement
 *          ce que peuplerStaff attend). Fix : branchement de
 *          listStaffDisponibles EN PREMIER dans peuplerStaff (fallbacks
 *          conservés). Chaîne complète rétablie : liste peuplée → cases
 *          cochées → payload.encadrants (uuid[]) → RPC insère M8
 *          evenement_encadrants. TRACÉ : la RPC renvoie TOUT le staff (46,
 *          toutes catégories), pas filtré M14 — raffinement ultérieur (la
 *          RPC n'a pas de paramètre catégorie). ZÉRO SQL, supabase-client
 *          + HTML NON touchés. buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.44 (48d4c2e4) → v1.45 (recollé après écriture, joint).
 *
 *   v1.46 : Staff FILTRÉ par catégorie (lève le « tout le staff » de v1.45).
 *          peuplerStaff(showAll) : par défaut (showAll falsy) appelle
 *          listStaffDisponibles(CTX_CATEGORIE_ID) → seul le staff ayant une
 *          fonction ACTIVE dans la catégorie (table fonction_staff, RPC v2
 *          p_categorie_id) ; pour M14 = RULFO + JUNG. Case à cocher
 *          « Afficher tout le staff du club » en tête de zone : cochée →
 *          peuplerStaff(true) → listStaffDisponibles(null) = tout le staff.
 *          Idempotence refondue : _staffLoadedKey = mode (cat:<id> | all),
 *          sinon le toggle ne rechargerait pas. Garde CTX_CATEGORIE_ID
 *          requise seulement en mode catégorie. Helper _bindStaffShowAll-
 *          Toggle neuf. Va de pair avec supabase-client v1.36 (param
 *          categorieId) + RPC list_staff_disponibles v2 (p_categorie_id +
 *          jointure fonction_staff). buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.45 (f001dbbe) → v1.46 (recollé après écriture, joint).
 *
 *   v1.47 : ÉDITION COMPLÈTE — « Modifier » rouvre le MODAL DE CRÉATION
 *          pré-rempli (objectif produit Manu : retomber sur le formulaire de
 *          création avec tout éditable). Avant : openModalEdit ouvrait un
 *          modal réduit aux méta. Maintenant : edit-from-fiche → closeFiche()
 *          + openModalEditComplet(id). Cette fonction ouvre le modal de
 *          création, pose MODAL_CREATE_EDIT_ID, et pré-remplit type, méta,
 *          date, horaires (TIME→HH:MM), équipes engagées (cochées via
 *          evt._equipesEngagees), phases+matchs (éditeur par équipe reconstruit
 *          par _prefillPhasesEditor : clics programmatiques +Phase/+Match puis
 *          remplissage), encadrants (cochés via evt.encadrants). Titre +
 *          bouton adaptés (« Modifier… » / « Enregistrer les modifications »).
 *          submitModalCreate bascule : si MODAL_CREATE_EDIT_ID → modifier-
 *          EvenementComplet(id, payload) (RPC sql/53) au lieu de createEvene-
 *          mentComplet. openModalCreate reset titre + drapeau (anti-résidu) ;
 *          closeModalCreate idem. Décisions techniques tranchées seul (mandat
 *          Manu) : RPC atomique « replace children » (supprime/recrée les
 *          enfants), garde de sécurité serveur si suivi/séances rattachés.
 *          Va de pair avec supabase-client v1.37 (wrapper modifierEvenement-
 *          Complet) + RPC sql/53. buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.46 (73a544c5) → v1.47 (recollé après écriture, joint).
 *
 *   v1.48 : FIX pré-remplissage de l'édition (v1.47 ne pré-remplissait pas
 *          les phases/matchs). Deux causes corrigées :
 *          (1) Les équipes à cocher étaient lues sur evt._equipesEngagees,
 *              ABSENT de l'objet (getEvenementWithEncadrants ne le renvoie
 *              pas → undefined → aucune équipe cochée → aucun bloc de phases).
 *              Désormais DÉDUITES des equipe_id distincts des phases enfants
 *              (CHILDREN_BY_PARENT[evtId]), toujours présents.
 *          (2) Les setTimeout fixes (60/250ms) étaient fragiles (peuplement
 *              async des cases). Remplacés par _waitFor (poll 50ms, ~3s max) :
 *              attend que les cases équipes existent → coche → updateMulti-
 *              EquipesUI → attend que les blocs équipe soient construits →
 *              _prefillPhasesEditor. Idem pour les encadrants.
 *          _prefillPhasesEditor : signature réduite à (phaseBoxes) ; clics
 *          programmatiques +Phase/+Match puis remplissage libellé/adversaire.
 *          buildPhasesParEquipeList + buildAffectationsN2Lines byte-
 *          identiques. Provenance md5 : v1.47 (98ca6ff1) → v1.48 (recollé
 *          après écriture, joint).
 *
 *   v1.49 : FICHE anti-redondance encadrement (Option B « sobriété »). Le
 *          résumé inline « Encadrement : Prénom N., … » du bloc Niveau 2 est
 *          RETIRÉ de renderFiche : il dupliquait la carte fonctionnelle
 *          « Encadrement » (renderFonctionCellule sectionId='encadrement')
 *          qui liste déjà les encadrants au dépliage. L'encadrement devient
 *          une fonction comme les autres (cohérent avec Compositions/Suivi).
 *          La variable encadrants reste utilisée par la carte (inchangée).
 *          ZÉRO SQL, supabase-client + HTML NON touchés. buildPhasesParEquipe-
 *          List + buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.48 (a599fd76) → v1.49 (recollé après écriture, joint).
 *
 *   v1.50 : FICHE — deux améliorations d'affichage (analyse fiche, points 6+7).
 *          (n°6) États traduits en clair : table ETAT_LABELS (creation→« En
 *            préparation », compo→« Compositions en cours », joue→« Joué »,
 *            resultat→« Résultats saisis », archive→« Archivé », annule→
 *            « Annulé »). Le badge affiche le libellé ; la valeur technique
 *            reste pour la classe CSS. Fallback brut si état inconnu.
 *            (L'ÉVOLUTION AUTOMATIQUE de l'état reste un chantier À PART,
 *            tracé, non traité : c'est de la logique métier.)
 *          (n°7) Séparation visuelle des équipes sous une phase : chaque
 *            groupe équipe (M14-1 / M14-2) est entouré d'un conteneur
 *            .evt-fiche-phase-equipe-bloc (bordure gauche verte + léger fond),
 *            uniquement quand un en-tête équipe est affiché (multi-équipes).
 *          ZÉRO SQL, supabase-client + HTML NON touchés. buildPhasesParEquipe-
 *          List + buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.49 (58c0bb54) → v1.50 (recollé après écriture, joint).
 *
 *   v1.51 : FICHE — dette MODELE-EVT-NOTES CLOSE (analyse fiche, point 5).
 *          Décision Manu : notes_internes reste un TEXTE LIBRE simple (pas de
 *          champ structuré), conforme au principe de simplicité. Le marqueur
 *          « Dette modèle MODELE-EVT-NOTES 🟡 (champ structuré à clarifier) »,
 *          qui s'affichait au coach sous le bloc Notes quand vide, est RETIRÉ
 *          de l'UI (il ne servait qu'au dev). Cas « aucune note » conservé,
 *          classe n2-dette → n2-notes. ZÉRO SQL, supabase-client + HTML NON
 *          touchés. buildPhasesParEquipeList + buildAffectationsN2Lines byte-
 *          identiques. Provenance md5 : v1.50 (543767c7) → v1.51 (recollé
 *          après écriture, joint).
 *
 *   v1.52 : FICHE — bouton « 📝 Notes » RÉTABLI. Constat : le champ
 *          notes_internes s'affichait (lecture, Niveau 2) mais n'était
 *          remplissable NULLE PART d'accessible — son bouton d'ouverture avait
 *          été retiré quand les Notes ont été absorbées en lecture (v1.24),
 *          alors que le modal de saisie dédié (#evt-overlay-notes) et toute sa
 *          chaîne (openModalEditNotes / submitModalEditNotes via updateEvenement
 *          / close-notes) restaient INTACTS et câblés. On rajoute (1) le bouton
 *          « 📝 Notes » dans les actions de la fiche (entre Modifier et
 *          Dupliquer, etat éditable), (2) son handler notes-from-fiche →
 *          openModalEditNotes(id). ZÉRO modif du modal/HTML/SQL (réutilisation
 *          pure de l'existant). buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.51 (7d30f85f) → v1.52 (recollé après écriture, joint).
 *
 *   v1.53 : FICHE — bouton « ← Retour au calendrier » RETIRÉ (partout, tous
 *          écrans). Redondant avec la croix ✕ qui ferme la fiche sur tous les
 *          écrans (décision Manu : retirer partout, pas seulement desktop). Le
 *          rendu du bouton (.evt-fiche-back) est supprimé de renderFiche ; le
 *          handler retour-calendrier reste (inoffensif, plus de cible). Le
 *          « ↩ Retour au tournoi parent » (.evt-fiche-back-parent) est
 *          CONSERVÉ (action distincte). La règle CSS mobile-only (min-width
 *          769px) ajoutée en v1.50 côté evenements.html est RETIRÉE → le HTML
 *          revient byte-identique à d802f559 (pas de redéploiement HTML
 *          nécessaire). ZÉRO SQL. buildPhasesParEquipeList +
 *          buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.52 (456c7294) → v1.53 (recollé après écriture, joint).
 *
 *   v1.54 : DEEP-LINK fiche. Nouveau : si l'URL porte ?fiche=<id_evenement>,
 *          init() ouvre directement la fiche de cet évènement après le rendu
 *          (EVENTS_BY_ID prêt, openFiche opérationnel ; id inconnu → ignoré).
 *          Permet aux pages Groupe de base / Compositions de revenir SUR la
 *          fiche (et non sur la liste) via evenements.html?fiche=<id> — la
 *          fiche étant un modal sans URL propre, ce paramètre lui donne une
 *          adresse. Va de pair avec groupe-base (flèche ← retour fiche).
 *          ZÉRO SQL, supabase-client + HTML NON touchés. buildPhasesParEquipe-
 *          List + buildAffectationsN2Lines byte-identiques. Provenance md5 :
 *          v1.53 (ec969510) → v1.54 (recollé après écriture, joint).
 */

(function () {
  'use strict';

  // ============================================================
  // 1. ÉTAT INTERNE DU MODULE
  // ============================================================

  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  // v1.28 — Sous-types de compétition à PHASES (éditeur de phases, mode
  // A5). Source de vérité UNIQUE partagée par updateCreateConditionalFields
  // (calcul du mode) et submitModalCreate (lecture phases vs adversaires).
  // Décision Manu : multi-phases = tournoi + Challenge Vié + Inter-Ligues
  // + Seven. Cohérent doc FAIT FOI §3.4 (universalité par nommage libre).
  const PHASES_SOUS_TYPES = ['tournoi', 'challenge_vie', 'challenge_inter_ligues', 'seven'];

  // v1.38 — Reconnaît un évènement « à phases » (tournoi/Vié/inter-ligues/
  // Seven). FIX terrain : la détection se fait sur `type_competition`
  // (valeur réelle en base, ex. 'tournoi') et NON sur `type_evenement`
  // (qui vaut 'competition', jamais 'tournoi'). L'ancien test
  // `type_evenement === 'tournoi'` était donc TOUJOURS faux → la carte et
  // la fiche n'affichaient jamais les phases/matchs d'un tournoi pourtant
  // présent en base. Source de vérité unique : PHASES_SOUS_TYPES.
  function estEvtAPhases(evt) {
    return !!evt && PHASES_SOUS_TYPES.indexOf(evt.type_competition) !== -1;
  }

  const FENETRE_JOURS_AVENIR  = 90;
  const FENETRE_JOURS_PASSES  = 30;
  const PASSES_LIMIT          = 50;

  const STORAGE_KEY_PREFS = 'mom_hub.evenements.prefs';

  let EVENEMENTS_AVENIR = [];
  let EVENEMENTS_PASSES = [];

  let EVENTS_BY_ID       = {};
  let CHILDREN_BY_PARENT = {};

  // S2.4.b — Context global récupéré dynamiquement à l'init
  // (pas de hardcode anti-doctrine — récupération via API)
  let CTX_SAISON_ID       = null;
  let CTX_ORGANISATEUR_ID = null;
  let CTX_CATEGORIE_ID    = null;  // v1.18 — catégorie M14 (dérivée de M14_TEAM_UUID), pour listEquipes Bloc 4a
  let SITES               = [];   // [{id, libelle_court, libelle}]

  // S2.4.b — Contexte courant des modales (event sélectionné pour E4, tournoi pour E5)
  let MODAL_CANCEL_EVENT_ID  = null;
  let MODAL_ADDMATCH_TOURNOI = null;   // objet event complet

  // SUIVI-COACH-1 Objet A — état borné à la SESSION (option i).
  // FICHE_EVT_COURANT : dernier évènement ouvert dans la fiche, pour
  // rafraîchir la section Suivi en place sans re-fetch réseau.
  let FICHE_EVT_COURANT = null;
  // Lien de suivi généré pendant la session, par UUID de rencontre.
  // En RAM UNIQUEMENT (jamais localStorage — cohérent avec l'invariant
  // I5 du module Suivi). evtId -> { token, role, expire_le, url }
  const SUIVI_LIENS_SESSION = new Map();

  // SUIVI-COACH-1 Objet C accroche (v1.11) — Map ISOLÉE des liens
  // spectateur (C2-Q3). Distincte de SUIVI_LIENS_SESSION (Objet A) :
  // jeton/rôle différents, lecture seule. En RAM UNIQUEMENT (jamais
  // localStorage — invariant I5). Borné session (aucune RPC de
  // relecture spectateur n'existe). evtId -> { token, expire_le, url }
  const SUIVI_SPECT_SESSION = new Map();

  const state = {
    typesActifs:   new Set(['all']),
    competsActifs: new Set(['all']),
    search:        '',
    showPassed:    true,
    // U3 (v1.14) : regroupement par 3 familles = vue ACTIVABLE.
    // Défaut false = CHRONOLOGIQUE (UX §4 — ne pas régresser
    // l'usage premier « c'est quand le prochain ? »).
    grouperParCategorie: false,
    expandedTournois: new Set()
  };

  const TYPE_LABELS = {
    // Domaine RÉEL post-migration v1.2 (CHECK : competition|entrainement|stage)
    competition:         'Compétition',
    entrainement:        'Entraînement',
    stage:               'Stage',
    // Anciennes valeurs techniques — fallback défensif (n'existent plus
    // en base après migration v1.2 §5.1 ; conservées par prudence
    // d'affichage, jamais de libellé brut).
    match:               'Match',
    tournoi:             'Tournoi',
    journee_championnat: 'Journée champ.'
  };

  // v1.50 — Libellés lisibles des états (domaine réel : creation|compo|joue|
  // resultat|archive|annule, cf. C12-a). Traduit le jargon technique en
  // vocabulaire coach pour l'affichage. La valeur technique reste utilisée
  // pour la classe CSS. Fallback : libellé brut si état inconnu.
  const ETAT_LABELS = {
    creation: 'En préparation',
    compo:    'Compositions en cours',
    joue:     'Joué',
    resultat: 'Résultats saisis',
    archive:  'Archivé',
    annule:   'Annulé'
  };

  const TYPE_ICONS = {
    competition:         '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    match:               '<circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/>',
    entrainement:        '<polyline points="22 4 12 14.01 9 11.01"/><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>',
    stage:               '<path d="M2 12h6l3-9 4 18 3-9h4"/>',
    tournoi:             '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    journee_championnat: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
  };

  // U4 M7 (v1.15) — plus de table parallèle code→classe (ancienne
  // COMPET_TO_CLASS championnat/coupe/tournoi/amical SUPPRIMÉE :
  // valeurs mortes post-migration + liste qui divergeait du
  // référentiel). La classe est désormais DÉRIVÉE du code de
  // sous-types-competition.json (cf. competClass) : une seule source
  // de vérité, le CSS la suit (UX §5.2/5.5, résolution M7).

  // ──────────────────────────────────────────────────────────────
  // U3 (refonte Évènements, v1.14) — REGROUPEMENT PAR 3 FAMILLES M1,
  // ALIGNÉ SUR LE type_evenement RÉEL post-migration v1.2 §5.1
  // (CHECK : competition | entrainement | stage). Vue ACTIVABLE
  // (state.grouperParCategorie, défaut chronologique — UX §4),
  // RÉVERSIBLE. Ordre Compétition → Entraînement → Stage (UX §4,
  // P7 : l'enjeu central remonte) ; tri chrono conservé DANS chaque
  // famille (partitionnement stable). Le mapping des anciennes
  // valeurs techniques (match|tournoi|journee_championnat) est
  // désormais le fallback défensif (valeurs absentes du CHECK après
  // migration) : ne JAMAIS perdre/masquer un évènement.
  const CATEGORIE_ORDRE  = ['competition', 'entrainement', 'stage'];
  const CATEGORIE_LABELS = {
    stage:        'Stage',
    entrainement: 'Entraînement',
    competition:  'Compétition'
  };
  function evtCategorie(evt) {
    const t = evt && evt.type_evenement;
    if (t === 'stage') return 'stage';
    if (t === 'entrainement') return 'entrainement';
    // 'competition' (valeur RÉELLE post-migration) ET fallback défensif
    // (anciennes valeurs mortes match|tournoi|journee_championnat, ou
    // tout cas imprévu) → compétition : jamais d'évènement perdu.
    return 'competition';
  }

  // U1-conséquent (v1.15) — remap DÉFENSIF d'une valeur de radio
  // type_evenement vers la famille RÉELLE (CHECK v1.2 §5.1 :
  // competition|entrainement|stage). Couvre l'ancien formulaire
  // (match|tournoi|journee_championnat encore présent dans
  // evenements.html non fourni) ET le futur (3 familles) :
  // FORWARD-COMPATIBLE — identité quand evenements.html émettra déjà
  // 'competition'. Sans ce remap, la création post-migration viole
  // evenements_type_check (régression active).
  function familleReelle(radioValue) {
    if (radioValue === 'entrainement') return 'entrainement';
    if (radioValue === 'stage') return 'stage';
    // 'competition' (futur) ET 'match'|'tournoi'|'journee_championnat'
    // (ancien, valeurs mortes en base) ET tout cas imprévu → competition.
    return 'competition';
  }

  // ============================================================
  // 2. CHARGEMENT DES DONNÉES
  // ============================================================

  // ------------------------------------------------------------
  // PÉRIMÈTRE MULTI-CATÉGORIES (UX-MULTI-CATEGORIES Lot 2)
  // ------------------------------------------------------------
  // Avant : le module était verrouillé sur M14_TEAM_UUID en dur → un
  // encadrant multi-catégories (Lohann : EDR + SENIORS = 8 catégories)
  // ne voyait que M14. Désormais le périmètre vient du socle central
  // SupabaseHub.resoudrePerimetreCategories() (v1.59), la catégorie
  // active pilote les équipes interrogées.
  //
  // La RPC get_evenements_a_venir filtre par ÉQUIPE (sondé à la source :
  // pas de filtre catégorie). « Tous les évènements de la catégorie » =
  // résoudre ses équipes via listEquipes(categorieId) puis charger
  // chaque équipe et fusionner par id (la RPC gère déjà le multi-équipes
  // d'un tournoi par équipe). 1 équipe → strictement équivalent à
  // l'appel mono-équipe historique (garde-fou de non-régression).
  //
  // Dégradation honnête : périmètre non résolu / aucune équipe → repli
  // sur M14_TEAM_UUID (comportement d'origine, jamais d'écran vide par
  // accident).
  let CTX_PERIMETRE       = null;   // {categories, transverse, active, vide} | null
  let CTX_EQUIPES_ACTIVES = null;   // [equipeId, …] de la catégorie active | null

  // Résout les équipes de la catégorie active courante. Repli M14.
  async function _resoudreEquipesCategorieActive() {
    const catId = CTX_PERIMETRE && CTX_PERIMETRE.active;
    // Plus de repli M14 silencieux (décision Manu) : pas de catégorie active
    // résolue → aucune équipe (liste vide → empty state honnête, pas les
    // évènements M14 sous un faux titre).
    if (!catId) return [];
    try {
      const eqs = await SupabaseHub.listEquipes(catId);
      const ids = Array.isArray(eqs) ? eqs.map(e => e && e.id).filter(Boolean) : [];
      return ids; // vide si la catégorie n'a aucune équipe sur la saison active (plus de repli M14)
    } catch (e) {
      console.warn('Évènements : listEquipes(catégorie active) échouée', e);
      return []; // échec de résolution → liste vide (plus de repli M14 trompeur)
    }
  }

  // EVT-RECURRENCE-OCCURRENCES : une occurrence d'entraînement récurrent est
  // un enfant (evenement_parent_id non nul) de type entrainement/stage. À
  // distinguer des enfants de tournoi (compétition), qui restent regroupés
  // sous leur racine.
  function _estOccurrenceEntrainement(evt) {
    return !!(evt && evt.evenement_parent_id)
      && (evt.type_evenement === 'entrainement' || evt.type_evenement === 'stage');
  }

  // EVT-SERIE-ECRAN : une MÈRE récurrente est une racine (pas de parent) de
  // type entrainement/stage portant un objet recurrence avec une fréquence.
  // C'est elle qui expose le bouton « Voir la série ».
  function _estMereRecurrente(evt) {
    return !!(evt && !evt.evenement_parent_id)
      && (evt.type_evenement === 'entrainement' || evt.type_evenement === 'stage')
      && !!(evt.recurrence && (evt.recurrence.frequence || evt.recurrence.mode === 'recurrent'));
  }

  // ══════════════════════════════════════════════════════════════════
  // EVT-SERIE-ECRAN — modale « voir la série » (V1, injectée en JS pour
  // ne pas toucher evenements.html/hub.css). Liste TOUTES les occurrences
  // d'une mère récurrente (au-delà de la fenêtre 90 j), permet de
  // supprimer une séance, de supprimer la série entière, et d'éditer la
  // date de fin de récurrence (prolongation/raccourcissement via
  // modifierRecurrenceEvenement).
  // ══════════════════════════════════════════════════════════════════
  let SERIE_MERE_ID = null;

  function _ensureModaleSerie() {
    let ov = document.getElementById('evt-overlay-serie');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'evt-overlay';
    ov.id = 'evt-overlay-serie';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="evt-modal">'
      + '<div class="evt-modal-title" id="evt-serie-title">Série récurrente</div>'
      + '<div class="evt-modal-body">'
      + '<div id="evt-serie-msg"></div>'
      + '<div class="evt-modal-info" id="evt-serie-info"><em>Chargement…</em></div>'
      + '<div id="evt-serie-recurrence" style="margin:14px 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);"></div>'
      + '<div id="evt-serie-liste"></div>'
      + '<div class="evt-modal-actions">'
      + '<button type="button" class="evt-btn" data-action="serie-fermer">Fermer</button>'
      + '<button type="button" class="evt-btn evt-fiche-suppr-occurrence" data-action="serie-supprimer-tout">🗑 Supprimer toute la série</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    // Fermeture par clic sur le fond
    ov.addEventListener('click', function (e) {
      if (e.target === ov) fermerModaleSerie();
    });
    ov.querySelector('[data-action="serie-fermer"]')
      .addEventListener('click', fermerModaleSerie);
    ov.querySelector('[data-action="serie-supprimer-tout"]')
      .addEventListener('click', _serieSupprimerTout);
    return ov;
  }

  function fermerModaleSerie() {
    const ov = document.getElementById('evt-overlay-serie');
    if (ov) ov.classList.remove('show');
    SERIE_MERE_ID = null;
  }

  async function ouvrirModaleSerie(mereId) {
    SERIE_MERE_ID = mereId;
    const ov = _ensureModaleSerie();
    ov.classList.add('show');
    const mere = EVENTS_BY_ID[mereId] || null;
    const titre = document.getElementById('evt-serie-title');
    if (titre) titre.textContent = 'Série : ' + ((mere && (mere.libelle || mere.code)) || '(récurrente)');
    document.getElementById('evt-serie-msg').innerHTML = '';
    document.getElementById('evt-serie-info').innerHTML = '<em>Chargement…</em>';
    document.getElementById('evt-serie-liste').innerHTML = '';
    document.getElementById('evt-serie-recurrence').innerHTML = '';
    await _chargerSerie(mereId, mere);
  }

  async function _chargerSerie(mereId, mere) {
    if (!window.SupabaseHub || typeof SupabaseHub.getOccurrencesSerie !== 'function') {
      document.getElementById('evt-serie-info').innerHTML =
        '<span class="evt-form-error">Fonction indisponible (client non chargé).</span>';
      return;
    }
    // EVT-SERIE-SUPPRESSION-MERE : une mère détachée passe etat='annule' et
    // sort de EVENTS_BY_ID (get_evenements_a_venir exclut 'annule'). On la
    // recharge donc par RPC directe (get_evenement_with_encadrants ne filtre
    // pas sur etat) pour garder la ligne mère et le bouton « Ré-attacher ».
    if ((!mere || mere.etat === 'annule') && typeof SupabaseHub.getEvenementWithEncadrants === 'function') {
      const mFrais = await SupabaseHub.getEvenementWithEncadrants(mereId);
      if (mFrais) mere = mFrais;
    }
    const res = await SupabaseHub.getOccurrencesSerie(mereId);
    if (!res || !res.ok) {
      document.getElementById('evt-serie-info').innerHTML =
        '<span class="evt-form-error">Erreur : ' + escHtml((res && res.error) || 'inconnue') + '</span>';
      return;
    }
    // La mère est une séance de la série au même titre que les enfants.
    const occ = res.data.slice();
    const lignes = [];
    if (mere) lignes.push({ ev: mere, estMere: true });
    occ.forEach(o => lignes.push({ ev: o, estMere: false }));
    lignes.sort((a, b) => String(a.ev.date_debut).localeCompare(String(b.ev.date_debut)));

    document.getElementById('evt-serie-info').innerHTML =
      '<strong>' + lignes.length + '</strong> séance' + (lignes.length > 1 ? 's' : '')
      + ' dans la série (dont la séance mère).';

    // Bloc d'édition de la fin de récurrence
    const finRec = (mere && mere.recurrence && mere.recurrence.fin) ? String(mere.recurrence.fin).slice(0, 10) : '';
    document.getElementById('evt-serie-recurrence').innerHTML =
      '<label class="evt-form-label" for="evt-serie-fin" style="display:block;margin-bottom:6px;">Fin de récurrence</label>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<input type="date" class="evt-form-input" id="evt-serie-fin" value="' + escHtml(finRec) + '" style="max-width:180px;">'
      + '<button type="button" class="evt-btn evt-btn-primary" data-action="serie-appliquer-fin">Appliquer</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--ink-soft);margin-top:6px;">Allonger crée les séances manquantes ; raccourcir supprime les séances futures au-delà de la nouvelle date (jamais une séance passée).</div>';
    const btnFin = document.querySelector('#evt-serie-recurrence [data-action="serie-appliquer-fin"]');
    if (btnFin) btnFin.addEventListener('click', () => _serieAppliquerFin(mere));

    // Liste des séances
    const now = new Date();
    let htmlL = '<div class="evt-serie-rows">';
    lignes.forEach(({ ev, estMere }) => {
      const d = ev.date_debut ? new Date(ev.date_debut) : null;
      const dateTxt = d ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '(date ?)';
      const heure = formatHeureOnly(ev.date_debut) || '';
      const passe = d && d < now;
      const badges = [];
      if (estMere) badges.push('<span style="font-size:10px;background:var(--vert-prairie);color:var(--paper);padding:1px 6px;border-radius:3px;">mère</span>');
      if (estMere && ev.etat === 'annule') badges.push('<span style="font-size:10px;background:var(--rouge-brique,#a33);color:var(--paper);padding:1px 6px;border-radius:3px;">détachée</span>');
      if (passe) badges.push('<span style="font-size:10px;color:var(--ink-soft);">passée</span>');
      htmlL += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);">'
        + '<button type="button" class="evt-serie-lien" data-action="serie-ouvrir" data-evt-id="' + escHtml(ev.id) + '" style="background:none;border:none;padding:0;cursor:pointer;color:var(--ink);text-align:left;font-size:13px;">'
        + escHtml(dateTxt) + (heure ? ' · ' + escHtml(heure) : '') + ' ' + badges.join(' ')
        + '</button>';
      if (!estMere) {
        htmlL += '<button type="button" class="evt-btn" data-action="serie-suppr-occ" data-occ-id="' + escHtml(ev.id) + '" title="Supprimer cette séance" style="padding:3px 9px;font-size:11px;">🗑</button>';
      } else {
        // Séance MÈRE : on ne la supprime pas (ce serait la série entière).
        // On la « détache » (etat=annule + auto-exclusion) ou on la
        // « ré-attache » selon son état courant. EVT-SERIE-SUPPRESSION-MERE.
        if (ev.etat === 'annule') {
          htmlL += '<button type="button" class="evt-btn" data-action="serie-rattacher-mere" title="Ré-attacher cette séance à la série" style="padding:3px 9px;font-size:11px;">↩ Ré-attacher</button>';
        } else {
          htmlL += '<button type="button" class="evt-btn" data-action="serie-detacher-mere" title="Retirer cette séance de la série (sans détruire la série)" style="padding:3px 9px;font-size:11px;">🗑 Détacher</button>';
        }
      }
      htmlL += '</div>';
    });
    htmlL += '</div>';
    document.getElementById('evt-serie-liste').innerHTML = htmlL;

    // Câblage : ouvrir une séance (ferme la modale, ouvre la fiche)
    document.querySelectorAll('#evt-serie-liste [data-action="serie-ouvrir"]').forEach(b => {
      b.addEventListener('click', function () {
        const id = this.getAttribute('data-evt-id');
        if (!id) return;
        fermerModaleSerie();
        openFiche(id);
      });
    });
    // Câblage : supprimer une occurrence
    document.querySelectorAll('#evt-serie-liste [data-action="serie-suppr-occ"]').forEach(b => {
      b.addEventListener('click', async function () {
        const occId = this.getAttribute('data-occ-id');
        if (!occId) return;
        if (!window.confirm('Supprimer cette séance ? Elle ne réapparaîtra pas dans la série.')) return;
        this.disabled = true;
        const r = await SupabaseHub.supprimerOccurrenceEvenement(occId);
        if (!r || !r.ok) {
          window.alert('Suppression impossible : ' + ((r && r.error) || 'erreur inconnue'));
          this.disabled = false;
          return;
        }
        await _chargerSerie(SERIE_MERE_ID, EVENTS_BY_ID[SERIE_MERE_ID] || null);
        await reloadEvents();
      });
    });
    // Câblage : détacher la séance mère (EVT-SERIE-SUPPRESSION-MERE)
    const btnDet = document.querySelector('#evt-serie-liste [data-action="serie-detacher-mere"]');
    if (btnDet) btnDet.addEventListener('click', _serieDetacherMere);
    // Câblage : ré-attacher la séance mère
    const btnRat = document.querySelector('#evt-serie-liste [data-action="serie-rattacher-mere"]');
    if (btnRat) btnRat.addEventListener('click', _serieRattacherMere);
  }

  // EVT-SERIE-SUPPRESSION-MERE — retire la séance portée par la mère SANS
  // détruire la série (etat=annule + auto-exclusion de sa date). Réversible.
  async function _serieDetacherMere() {
    if (!SERIE_MERE_ID) return;
    if (typeof SupabaseHub.detacherMereSerie !== 'function') {
      window.alert('Fonction indisponible (client non chargé).');
      return;
    }
    if (!window.confirm('Retirer la séance mère de la série ?\n\nLa série est conservée ; seule cette date disparaît. Vous pourrez la ré-attacher ensuite.')) return;
    const msg = document.getElementById('evt-serie-msg');
    if (msg) msg.innerHTML = '<em>Détachement…</em>';
    const r = await SupabaseHub.detacherMereSerie(SERIE_MERE_ID);
    if (!r || !r.ok) {
      if (msg) msg.innerHTML = '<span class="evt-form-error">Échec : ' + escHtml((r && r.error) || 'inconnue') + '</span>';
      return;
    }
    if (msg) msg.innerHTML = '<span class="evt-form-success">✅ Séance mère détachée ('
      + (r.seancesRestantes != null ? r.seancesRestantes + ' séance(s) restante(s))' : 'série conservée)') + '.</span>';
    await reloadEvents();
    await _chargerSerie(SERIE_MERE_ID, EVENTS_BY_ID[SERIE_MERE_ID] || null);
  }

  // EVT-SERIE-SUPPRESSION-MERE — miroir : réintègre la séance mère.
  async function _serieRattacherMere() {
    if (!SERIE_MERE_ID) return;
    if (typeof SupabaseHub.rattacherMereSerie !== 'function') {
      window.alert('Fonction indisponible (client non chargé).');
      return;
    }
    const msg = document.getElementById('evt-serie-msg');
    if (msg) msg.innerHTML = '<em>Ré-attachement…</em>';
    const r = await SupabaseHub.rattacherMereSerie(SERIE_MERE_ID);
    if (!r || !r.ok) {
      if (msg) msg.innerHTML = '<span class="evt-form-error">Échec : ' + escHtml((r && r.error) || 'inconnue') + '</span>';
      return;
    }
    if (msg) msg.innerHTML = '<span class="evt-form-success">✅ Séance mère ré-attachée à la série.</span>';
    await reloadEvents();
    await _chargerSerie(SERIE_MERE_ID, EVENTS_BY_ID[SERIE_MERE_ID] || null);
  }

  async function _serieAppliquerFin(mere) {
    if (!SERIE_MERE_ID) return;
    const input = document.getElementById('evt-serie-fin');
    const msg = document.getElementById('evt-serie-msg');
    const nouvelleFin = input && input.value ? input.value : null;
    // Repartir de la recurrence existante, ne changer que la fin.
    const recBase = (mere && mere.recurrence) ? Object.assign({}, mere.recurrence) : { mode: 'recurrent', frequence: 'hebdomadaire' };
    recBase.fin = nouvelleFin;
    if (msg) msg.innerHTML = '<em>Application…</em>';
    const r = await SupabaseHub.modifierRecurrenceEvenement(SERIE_MERE_ID, recBase);
    if (!r || !r.ok) {
      if (msg) msg.innerHTML = '<span class="evt-form-error">Échec : ' + escHtml((r && r.error) || 'inconnue') + '</span>';
      return;
    }
    if (msg) {
      msg.innerHTML = '<span class="evt-form-success">✅ Série mise à jour ('
        + (r.creees || 0) + ' créée(s), ' + (r.supprimees || 0) + ' supprimée(s)).</span>';
    }
    await reloadEvents();
    await _chargerSerie(SERIE_MERE_ID, EVENTS_BY_ID[SERIE_MERE_ID] || null);
  }

  async function _serieSupprimerTout() {
    if (!SERIE_MERE_ID) return;
    if (!window.confirm('Supprimer TOUTE la série (la séance mère et toutes ses occurrences) ? Action irréversible.')) return;
    const msg = document.getElementById('evt-serie-msg');
    if (msg) msg.innerHTML = '<em>Suppression…</em>';
    // Supprimer la mère → CASCADE emporte les enfants.
    const r = (typeof SupabaseHub.supprimerEvenement === 'function')
      ? await SupabaseHub.supprimerEvenement(SERIE_MERE_ID)
      : { ok: false, error: 'supprimerEvenement indisponible' };
    if (!r || !r.ok) {
      if (msg) msg.innerHTML = '<span class="evt-form-error">Échec : ' + escHtml((r && r.error) || 'inconnue') + '</span>';
      return;
    }
    fermerModaleSerie();
    closeFiche();
    await reloadEvents();
  }

  // Fusionne des listes d'évènements en dédoublonnant par id (un même
  // évènement-racine peut remonter pour plusieurs équipes engagées).
  function _fusionnerEvenements(listes) {
    const vus = new Set();
    const out = [];
    listes.forEach(liste => {
      (Array.isArray(liste) ? liste : []).forEach(e => {
        if (e && e.id && !vus.has(e.id)) { vus.add(e.id); out.push(e); }
      });
    });
    return out;
  }

  async function loadEvenementsAVenir() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsAVenir !== 'function') {
      throw new Error('SupabaseHub.getEvenementsAVenir indisponible (v1.10+ requis)');
    }
    // EVT-RATTACHEMENT-CATEGORIE : chargement PAR CATÉGORIE active. Capte à
    // la fois les entraînements/stages (equipe_id null, rattachés catégorie)
    // ET les compétitions de la catégorie. L'ancien chargement par équipe
    // ratait les entraînements sans équipe. Pas de catégorie active → liste
    // vide (empty state honnête, plus de repli M14).
    const catId = CTX_PERIMETRE && CTX_PERIMETRE.active;
    if (!catId) return [];
    const liste = await SupabaseHub.getEvenementsAVenir(null, FENETRE_JOURS_AVENIR, catId);
    return _fusionnerEvenements([liste]);
  }

  async function loadEvenementsPasses() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsPasses !== 'function') {
      throw new Error('SupabaseHub.getEvenementsPasses indisponible (v1.10+ requis)');
    }
    const catId = CTX_PERIMETRE && CTX_PERIMETRE.active;
    if (!catId) return [];
    const liste = await SupabaseHub.getEvenementsPasses(null, FENETRE_JOURS_PASSES, PASSES_LIMIT, catId);
    return _fusionnerEvenements([liste]);
  }

  async function buildIndexes() {
    EVENTS_BY_ID = {};
    CHILDREN_BY_PARENT = {};

    const all = EVENEMENTS_AVENIR.concat(EVENEMENTS_PASSES);
    all.forEach(e => {
      EVENTS_BY_ID[e.id] = e;
      if (e.evenement_parent_id) {
        if (!CHILDREN_BY_PARENT[e.evenement_parent_id]) {
          CHILDREN_BY_PARENT[e.evenement_parent_id] = [];
        }
        CHILDREN_BY_PARENT[e.evenement_parent_id].push(e);
      }
    });

    // EVT-SERIE-SUPPRESSION-MERE : une mère DÉTACHÉE (etat='annule') sort des
    // listes (get_evenements_a_venir exclut 'annule') mais ses occurrences
    // enfants restent visibles. Sans la mère dans EVENTS_BY_ID, le bouton
    // « ↩ Série » de l'enfant disparaît → plus aucun accès à la modale série
    // → ré-attachement impossible. On HYDRATE donc les mères référencées par
    // un enfant mais absentes du référentiel, par RPC directe (sans filtre
    // etat). Injectées dans EVENTS_BY_ID uniquement (PAS dans les listes) :
    // résolubles pour l'accès série, sans réapparaître comme carte-séance.
    if (typeof SupabaseHub.getEvenementWithEncadrants === 'function') {
      const meresManquantes = Object.keys(CHILDREN_BY_PARENT)
        .filter(pid => pid && !EVENTS_BY_ID[pid]);
      for (const pid of meresManquantes) {
        try {
          const m = await SupabaseHub.getEvenementWithEncadrants(pid);
          if (m && m.id) EVENTS_BY_ID[m.id] = m;
        } catch (e) {
          console.warn('buildIndexes: hydratation mère % impossible', pid, e);
        }
      }
    }

    Object.keys(CHILDREN_BY_PARENT).forEach(parentId => {
      CHILDREN_BY_PARENT[parentId].sort((a, b) => {
        const oa = a.ordre_dans_phase || 999;
        const ob = b.ordre_dans_phase || 999;
        if (oa !== ob) return oa - ob;
        return new Date(a.date_debut) - new Date(b.date_debut);
      });
    });
  }

  // ============================================================
  // 3. HELPERS GÉNÉRIQUES
  // ============================================================

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function formatDateShort(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    const dateFr = d.toLocaleDateString('fr-FR', opts);
    const hours = d.getHours();
    const mins = d.getMinutes();
    const heureFr = mins === 0 ? hours + 'h' : hours + 'h' + String(mins).padStart(2, '0');
    return dateFr + ' · ' + heureFr;
  }

  function formatHeureOnly(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    // v1.41 — Heure NON significative : un évènement créé sans heure (input
    // type=date, v3.4) est stocké à minuit UTC (00:00:00+00). Affiché en
    // heure de Paris ça donnait un faux « 2h » (UTC+2 en été). On teste les
    // composantes UTC (pas locales) : minuit UTC pile = pas d'heure saisie
    // → on n'affiche rien. Les vraies heures (entraînements 18h Paris =
    // 16h UTC, etc.) ont getUTCHours()≠0 → affichées normalement.
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return '';
    const h = d.getHours();
    const m = d.getMinutes();
    return m === 0 ? h + 'h' : h + 'h' + String(m).padStart(2, '0');
  }

  function formatMoisAnnee(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
  }

  function dateKey(isoString) {
    if (!isoString) return '';
    return isoString.substring(0, 10);
  }

  function moisKey(isoString) {
    if (!isoString) return '';
    return isoString.substring(0, 7);
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFS);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Évènements : prefs localStorage illisibles', e);
      return null;
    }
  }

  function savePrefs() {
    try {
      const payload = {
        typesActifs:   Array.from(state.typesActifs),
        competsActifs: Array.from(state.competsActifs),
        showPassed:    state.showPassed,
        grouperParCategorie: state.grouperParCategorie
      };
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(payload));
    } catch (e) {
      console.warn('Évènements : prefs localStorage non persistées', e);
    }
  }

  function pass(evt) {
    if (!state.typesActifs.has('all') && !state.typesActifs.has(evt.type_evenement)) return false;
    if (!state.competsActifs.has('all') && evt.type_competition && !state.competsActifs.has(evt.type_competition)) return false;
    if (state.search) {
      const s = state.search.toLowerCase();
      const libelle = (evt.libelle || '').toLowerCase();
      const adversaire = (evt.adversaire_nom || '').toLowerCase();
      if (libelle.indexOf(s) === -1 && adversaire.indexOf(s) === -1) return false;
    }
    return true;
  }

  /**
   * Pastille statut compo (cf. doc Conception §5.2 Q5)
   */
  function statutCompoBadge(summary) {
    if (!summary || typeof summary !== 'object') {
      return { cls: 'neutral', libelle: '0/0 à faire' };
    }
    const total     = parseInt(summary.total     || 0, 10);
    const brouillon = parseInt(summary.brouillon || 0, 10);
    const validee   = parseInt(summary.validee   || 0, 10);
    const utilisee  = parseInt(summary.utilisee  || 0, 10);

    if (total === 0) return { cls: 'neutral', libelle: '0/0 à faire' };
    if (utilisee === total) return { cls: 'utilisee', libelle: total + '/' + total + ' jouées' };
    if (validee + utilisee === total) return { cls: 'validee', libelle: total + '/' + total + ' prêtes' };
    if (brouillon > 0) return { cls: 'brouillon', libelle: (brouillon + validee + utilisee) + '/' + total + ' en cours' };
    return { cls: 'neutral', libelle: total + '/' + total + ' à faire' };
  }

  // U4 M7 (v1.15) — la classe CSS DÉRIVE exactement du code de
  // sous-types-competition.json : 'evt-compet-' + code, underscores
  // → tirets (ex. challenge_inter_ligues → evt-compet-challenge-
  // inter-ligues, UX §5.2). Plus jamais une liste parallèle. Vide si
  // pas de sous-type (entraînement/stage : famille, pas de classe
  // sous-type). Les RÈGLES CSS .evt-compet-<code> (palette §5.4)
  // vivent dans evenements.html (vérification Production) — ici on
  // pose la classe mécaniquement, pas la couleur.
  function competClass(typeCompet) {
    if (!typeCompet || typeof typeCompet !== 'string') return '';
    return 'evt-compet-' + typeCompet.replace(/_/g, '-');
  }

  function typeIconSvg(type) {
    const inner = TYPE_ICONS[type] || TYPE_ICONS.match;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  // ============================================================
  // 4. RENDU LISTE — CARTES + REGROUPEMENT PAR MOIS
  // ============================================================

  function renderCard(evt, isPasse) {
    const dateLib = formatDateShort(evt.date_debut);
    const competCls = competClass(evt.type_competition);
    const typeLbl = TYPE_LABELS[evt.type_evenement] || evt.type_evenement;
    const badge = statutCompoBadge(evt.compo_status_summary);

    const isAnnule = evt.etat === 'annule';
    const cardClasses = [
      'evt-card',
      competCls,
      isAnnule ? 'evt-card-annule' : '',
      isPasse ? 'evt-card-passe' : ''
    ].filter(Boolean).join(' ');

    const isTournoi = estEvtAPhases(evt);  // v1.38 — via type_competition
    const isExpanded = state.expandedTournois.has(evt.id);
    const enfants = CHILDREN_BY_PARENT[evt.id] || [];

    let secondaire = '';
    if (evt.site_libelle_court) secondaire = escHtml(evt.site_libelle_court);
    if (evt.adversaire_nom) {
      secondaire += (secondaire ? ' · ' : '') + 'vs ' + escHtml(evt.adversaire_nom);
    }

    let badgeJours = '';
    if (isPasse && typeof evt.jours_depuis_evenement === 'number') {
      badgeJours = '<span class="evt-card-jours">J-' + evt.jours_depuis_evenement + '</span>';
    } else if (!isPasse && typeof evt.jours_jusqu_a_evenement === 'number') {
      badgeJours = '<span class="evt-card-jours">J+' + evt.jours_jusqu_a_evenement + '</span>';
    }

    let html = '<div class="' + cardClasses + '" data-event-id="' + evt.id + '" data-mois="' + escHtml(moisKey(evt.date_debut)) + '">';
    html += '<div class="evt-card-stripe"></div>';
    html += '<div class="evt-card-body">';
    html += '<div class="evt-card-line1">';

    if (isTournoi && enfants.length > 0) {
      html += '<button type="button" class="evt-card-chevron" data-action="toggle-tournoi" data-tournoi-id="' + evt.id + '" title="Déplier / replier les matchs">';
      html += isExpanded ? '▼' : '▶';
      html += '</button>';
    }

    html += '<div class="evt-card-type-icon" title="' + escHtml(typeLbl) + '">' + typeIconSvg(evt.type_evenement) + '</div>';
    html += '<div class="evt-card-titre">';
    html += '<div class="evt-card-meta">' + escHtml(dateLib) + ' · ' + escHtml(typeLbl);
    if (badgeJours) html += ' · ' + badgeJours;
    // EVT-SERIE-VISIBILITE — badge identifiant la mère d'une série récurrente
    // dans la liste (repérage sans ouvrir la fiche).
    if (_estMereRecurrente(evt)) html += ' <span class="evt-card-serie" title="Entraînement récurrent (série)">🔁 Série</span>';
    html += '</div>';
    html += '<div class="evt-card-libelle">' + escHtml(evt.libelle || '(sans libellé)') + '</div>';
    if (secondaire) html += '<div class="evt-card-secondaire">' + secondaire + '</div>';
    html += '</div>';

    if (isAnnule) {
      html += '<div class="evt-card-badge evt-badge-annule">Annulé</div>';
    } else {
      html += '<div class="evt-card-badge evt-badge-' + badge.cls + '">' + escHtml(badge.libelle) + '</div>';
    }

    html += '</div>';
    html += '</div>';
    html += '</div>';

    if (isTournoi && isExpanded && enfants.length > 0) {
      html += renderEnfantsTournoi(evt, enfants);
    }

    return html;
  }

  function renderEnfantsTournoi(parent, enfants) {
    const phases = [];
    const byPhase = {};
    enfants.forEach(e => {
      const phase = e.phase_libelle || '(sans phase)';
      if (!byPhase[phase]) {
        byPhase[phase] = [];
        phases.push(phase);
      }
      byPhase[phase].push(e);
    });

    let html = '<div class="evt-tournoi-enfants">';
    phases.forEach(phaseName => {
      html += '<div class="evt-phase-titre">📍 ' + escHtml(phaseName) + '</div>';
      byPhase[phaseName].forEach(child => {
        html += renderEnfantCard(child);
      });
    });
    html += '<button type="button" class="evt-tournoi-add-match" data-action="add-match-to-tournoi" data-tournoi-id="' + parent.id + '">';
    html += '+ Ajouter un match';
    html += '</button>';
    html += '</div>';
    return html;
  }

  function renderEnfantCard(child) {
    const heure = formatHeureOnly(child.date_debut);

    // Évite la redondance "vs Nancy   vs Nancy" : si le libellé commence
    // déjà par "vs " (cas matchs poule contre équipe nommée), on n'ajoute
    // pas une 2e fois l'adversaire_nom à côté.
    const libelle = child.libelle || '';
    const libelleStartsWithVs = libelle.toLowerCase().indexOf('vs ') === 0;

    let adversaireBlock = '';
    if (libelleStartsWithVs) {
      // L'info est déjà dans le libellé → on n'affiche que le libellé tel quel
      adversaireBlock = '';
    } else if (child.adversaire_nom) {
      adversaireBlock = 'vs ' + escHtml(child.adversaire_nom);
    } else {
      adversaireBlock = '<em style="color:var(--ink-mute)">(adversaire à déterminer)</em>';
    }

    const badge = statutCompoBadge(child.compo_status_summary);
    const isAnnule = child.etat === 'annule';

    let html = '<div class="evt-enfant-row" data-event-id="' + child.id + '">';
    html += '<span class="evt-enfant-heure">' + escHtml(heure) + '</span>';
    html += '<span class="evt-enfant-libelle">' + escHtml(libelle) + '</span>';
    if (adversaireBlock) {
      html += '<span class="evt-enfant-adversaire">' + adversaireBlock + '</span>';
    } else {
      html += '<span class="evt-enfant-adversaire"></span>';
    }
    if (isAnnule) {
      html += '<span class="evt-card-badge evt-badge-annule evt-badge-sm">Annulé</span>';
    } else {
      html += '<span class="evt-card-badge evt-badge-' + badge.cls + ' evt-badge-sm">' + escHtml(badge.libelle) + '</span>';
    }
    html += '</div>';
    return html;
  }

  function renderListe() {
    const list = document.getElementById('evt-list');
    if (!list) return;

    // EVT-RECURRENCE-OCCURRENCES : une racine s'affiche toujours. Une
    // occurrence d'entraînement récurrent (enfant de type entrainement/
    // stage) s'affiche AUSSI comme une séance à part entière — au contraire
    // des enfants de tournoi (compétition : phases/matchs), qui restent
    // masqués et regroupés sous leur racine. Distinction par type.
    const filterRoot = evt =>
      (!evt.evenement_parent_id || _estOccurrenceEntrainement(evt)) && pass(evt);

    const filteredAvenir = EVENEMENTS_AVENIR.filter(filterRoot);
    const filteredPasses = state.showPassed ? EVENEMENTS_PASSES.filter(filterRoot) : [];
    const total = filteredAvenir.length + filteredPasses.length;

    // v1.26 — Retrait du bloc legacy U3 v1.14 `evt-groupbar` (doublon
    // de H-5 §3.4 doc UX FAIT FOI). Le bouton OFFICIEL admin-only est
    // dans evenements.html v3 `<button id="evt-btn-grouper-categorie">`
    // révélé conditionnellement par `revelerBoutonAdminSiAdmin` v1.24,
    // câblé dans bindEvents (ligne ~4801). Lève dette `UX-EVT-DOUBLON-
    // GROUPER-BOUTON` 🟢 + bonus correctif gouvernance (coach non-admin
    // ne voit plus le toggle, cohérent H-5 admin-only strict).

    if (total === 0) {
      // Distinguer deux cas d'absence : (a) la catégorie active n'a AUCUNE
      // équipe sur la saison active (ex. ententes 2026/2027 pas encore
      // créées) → message honnête, pas « élargissez les filtres » ; (b)
      // il y a des équipes mais aucun évènement passe les filtres.
      const sansEquipe = Array.isArray(CTX_EQUIPES_ACTIVES) && CTX_EQUIPES_ACTIVES.length === 0;
      // EMPTY-STATES-REFUS : distinguer (0) un membre SANS périmètre (parent
      // relié, mes_categories_autorisees()=0) → refus canon DONNÉES, de (a) un
      // encadrant AVEC périmètre dont la catégorie n'a pas encore d'équipe
      // engagée → message légitime « apparaîtront une fois l'équipe engagée ».
      const perimetreVide = !CTX_PERIMETRE
        || CTX_PERIMETRE.vide === true
        || !(CTX_PERIMETRE.active);
      if (perimetreVide) {
        list.innerHTML =
          '<div class="evt-list-empty">Ces informations sont réservées aux encadrants d\'une catégorie.</div>';
      } else if (sansEquipe) {
        const lib = (typeof _libelleCategorieActive === 'function' && _libelleCategorieActive()) || 'cette catégorie';
        list.innerHTML =
          '<div class="evt-list-empty">Aucune équipe pour ' + escHtml(lib) + ' sur la saison active.'
          + '<br><small>Aucune entente n\'est encore créée pour cette catégorie cette saison — '
          + 'les évènements apparaîtront une fois l\'équipe engagée.</small></div>';
      } else {
        list.innerHTML =
          '<div class="evt-list-empty">Aucun évènement trouvé.<br><small>Essayez d\'élargir les filtres ou de modifier la recherche.</small></div>';
      }
      bindCardEvents();
      return;
    }

    // U3 (v1.14) — DÉFAUT chronologique (UX §4, répare régression v1.13
    // qui forçait le regroupement). false → renderSection direct sur
    // passés puis à venir (= comportement EXACT v1.12, regroupement par
    // mois interne, tri chrono pur). true → regroupement par les 3
    // familles (ordre Compétition→Entraînement→Stage), tri chrono
    // conservé DANS chaque famille. renderSection JAMAIS modifiée.
    let html = '';
    if (state.grouperParCategorie) {
      if (filteredPasses.length > 0) {
        html += renderSectionsParCategorie(filteredPasses, true, 'passés');
      }
      if (filteredAvenir.length > 0) {
        html += renderSectionsParCategorie(filteredAvenir, false, 'à venir');
      }
    } else {
      if (filteredPasses.length > 0) {
        html += renderSection('Passés', filteredPasses, true);
      }
      if (filteredAvenir.length > 0) {
        html += renderSection('À venir', filteredAvenir, false);
      }
    }

    list.innerHTML = html;
    bindCardEvents();
  }

  // v1.13 — ÉTAPE 1 : émet une section renderSection() PAR catégorie
  // présente, dans l'ordre CATEGORIE_ORDRE. renderSection (regroupement
  // mois + cartes) est RÉUTILISÉE TELLE QUELLE, jamais modifiée
  // (addition pure). Partitionnement = préserve l'ordre relatif des
  // évènements → aucun changement de tri chronologique intra-catégorie.
  // Catégorie vide = non rendue. Le « · N » du titre vient de
  // renderSection (compte par catégorie).
  function renderSectionsParCategorie(events, isPasse, suffixe) {
    const parCat = {};
    events.forEach(e => {
      const c = evtCategorie(e);
      (parCat[c] = parCat[c] || []).push(e);
    });
    let html = '';
    CATEGORIE_ORDRE.forEach(cat => {
      const lot = parCat[cat];
      if (!lot || lot.length === 0) return;
      html += renderSection(CATEGORIE_LABELS[cat] + ' · ' + suffixe, lot, isPasse);
    });
    return html;
  }

  function renderSection(titre, events, isPasse) {
    const byMois = {};
    const moisOrder = [];
    events.forEach(e => {
      const m = moisKey(e.date_debut);
      if (!byMois[m]) {
        byMois[m] = { libelle: formatMoisAnnee(e.date_debut), events: [] };
        moisOrder.push(m);
      }
      byMois[m].events.push(e);
    });

    let html = '<div class="evt-section">';
    html += '<div class="evt-section-titre">' + escHtml(titre) + ' · ' + events.length + '</div>';
    moisOrder.forEach(m => {
      html += '<div class="evt-mois-titre" data-mois="' + escHtml(m) + '">' + escHtml(byMois[m].libelle) + '</div>';
      byMois[m].events.forEach(e => {
        html += renderCard(e, isPasse);
      });
    });
    html += '</div>';
    return html;
  }

  function bindCardEvents() {
    // v1.26 — Retrait du handler legacy `[data-action="toggle-grouper"]`
    // U3 v1.14 (mort code suite à retrait du bouton interne, voir
    // commentaire renderListe v1.26 ci-dessus). Le bouton OFFICIEL
    // H-5 §3.4 admin-only est câblé directement dans bindEvents (ligne
    // ~4801, byte-identique v1.24+), pas ici.

    document.querySelectorAll('.evt-card-chevron[data-action="toggle-tournoi"]').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const tournoiId = this.getAttribute('data-tournoi-id');
        if (state.expandedTournois.has(tournoiId)) {
          state.expandedTournois.delete(tournoiId);
        } else {
          state.expandedTournois.add(tournoiId);
        }
        renderListe();
      });
    });

    document.querySelectorAll('.evt-card').forEach(card => {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-action="toggle-tournoi"]')) return;
        if (e.target.closest('.evt-card-chevron')) return;
        const id = this.getAttribute('data-event-id');
        if (id) openFiche(id);
      });
    });

    document.querySelectorAll('[data-action="add-match-to-tournoi"]').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const tournoiId = this.getAttribute('data-tournoi-id');
        console.log('[S2.4 à venir] Ouvrir modale E5 pour ajouter match au tournoi', tournoiId);
        openModalAddMatch(tournoiId);
      });
    });

    // Clic sur ligne enfant de tournoi → fiche détaillée du match
    document.querySelectorAll('.evt-enfant-row[data-event-id]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function (e) {
        // Ignore les clics sur des éléments enfants interactifs (badges, etc.)
        if (e.target.closest('[data-action]')) return;
        const id = this.getAttribute('data-event-id');
        if (id) openFiche(id);
      });
    });
  }

  function renderKPIs() {
    const kpiAvenir = document.getElementById('kpi-avenir');
    const kpiPasses = document.getElementById('kpi-passes');
    // Une ligne affichée = une racine OU une occurrence d'entraînement récurrent.
    const estLigne = e => !e.evenement_parent_id || _estOccurrenceEntrainement(e);
    const avenirRoots = EVENEMENTS_AVENIR.filter(estLigne);
    const passesRoots = EVENEMENTS_PASSES.filter(estLigne);
    if (kpiAvenir) kpiAvenir.textContent = String(avenirRoots.length);
    if (kpiPasses) kpiPasses.textContent = String(passesRoots.length);

    const sub = document.getElementById('evt-header-sub');
    if (sub) {
      // Compter les lignes affichées (racines + occurrences d'entraînement)
      // et, séparément, les matchs enfants de tournoi (compétition).
      const nbRacines = avenirRoots.length + passesRoots.length;
      const nbMatchs  = (EVENEMENTS_AVENIR.length + EVENEMENTS_PASSES.length) - nbRacines;
      let txt = nbRacines + ' évènement(s)';
      if (nbMatchs > 0) txt += ' · ' + nbMatchs + ' match(s) de tournoi';
      txt += ' · ' + FENETRE_JOURS_AVENIR + ' jours à venir, ' + FENETRE_JOURS_PASSES + ' jours passés';
      sub.textContent = txt;
    }
  }

  // ============================================================
  // 5. MINI-CALENDRIER SIDEBAR
  // ============================================================

  function renderMiniCal() {
    const container = document.getElementById('evt-mini-cal');
    if (!container) return;

    const now = new Date();
    const months = [
      { year: now.getFullYear(), month: now.getMonth() },
      { year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), month: (now.getMonth() + 1) % 12 }
    ];

    const eventsByDay = {};
    const all = EVENEMENTS_AVENIR.concat(EVENEMENTS_PASSES);
    all.forEach(e => {
      // Masquer les enfants de tournoi, mais GARDER les occurrences
      // d'entraînement récurrent (chaque séance = une pastille).
      if (e.evenement_parent_id && !_estOccurrenceEntrainement(e)) return;
      const k = dateKey(e.date_debut);
      if (!eventsByDay[k]) eventsByDay[k] = [];
      eventsByDay[k].push(e);
    });

    let html = '';
    months.forEach(m => {
      html += renderMonthGrid(m.year, m.month, eventsByDay, now);
    });
    container.innerHTML = html;

    container.querySelectorAll('.evt-mini-day[data-day-key]').forEach(cell => {
      cell.addEventListener('click', function () {
        const dayKey = this.getAttribute('data-day-key');
        scrollToFirstEventOfDay(dayKey);
      });
    });
  }

  function renderMonthGrid(year, month, eventsByDay, today) {
    const moisDate = new Date(year, month, 1);
    const moisLib = moisDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startCol = firstDay.getDay() - 1;
    if (startCol < 0) startCol = 6;

    let html = '<div class="evt-mini-month">';
    html += '<div class="evt-mini-month-title">' + escHtml(moisLib) + '</div>';
    html += '<div class="evt-mini-grid">';
    html += '<div class="evt-mini-wday">L</div><div class="evt-mini-wday">M</div><div class="evt-mini-wday">M</div><div class="evt-mini-wday">J</div><div class="evt-mini-wday">V</div><div class="evt-mini-wday">S</div><div class="evt-mini-wday">D</div>';

    for (let i = 0; i < startCol; i++) {
      html += '<div class="evt-mini-day evt-mini-day-empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayKey = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const hasEvents = !!eventsByDay[dayKey];
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
      const cellClasses = [
        'evt-mini-day',
        hasEvents ? 'has-events' : '',
        isToday ? 'is-today' : ''
      ].filter(Boolean).join(' ');
      html += '<div class="' + cellClasses + '" data-day-key="' + dayKey + '"';
      if (hasEvents) html += ' title="' + eventsByDay[dayKey].length + ' évènement(s)"';
      html += '>';
      html += d;
      if (hasEvents) html += '<span class="evt-mini-dot"></span>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function scrollToFirstEventOfDay(dayKey) {
    const cards = document.querySelectorAll('.evt-card[data-event-id]');
    for (let i = 0; i < cards.length; i++) {
      const id = cards[i].getAttribute('data-event-id');
      const evt = EVENTS_BY_ID[id];
      if (evt && dateKey(evt.date_debut) === dayKey) {
        cards[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        cards[i].classList.add('evt-card-highlight');
        setTimeout(() => cards[i].classList.remove('evt-card-highlight'), 1500);
        return;
      }
    }
    console.log('Aucune carte trouvée pour la date', dayKey);
  }

  // ============================================================
  // 6. FICHE DÉTAILLÉE E2 (S2.3)
  // ============================================================

  /**
   * Ouvre le panneau fiche détaillée pour un événement donné.
   * Appelle SupabaseHub.getEvenementWithEncadrants (sql/29 + v1.10)
   * pour récupérer les 24 colonnes complètes + array encadrants JSONB.
   *
   * Mode lecture seule V1 (S2.3). Édition reportée S2.4.
   *
   * @param {string} evenementId UUID de l'événement à ouvrir
   */
  async function openFiche(evenementId) {
    if (!evenementId) {
      console.error('openFiche() : evenementId manquant');
      return;
    }

    const overlay = document.getElementById('evt-fiche-overlay');
    const body    = document.getElementById('evt-fiche-body');
    const code    = document.getElementById('evt-fiche-code');
    const title   = document.getElementById('evt-fiche-title');
    if (!overlay || !body || !title) return;

    // Affiche immédiatement le panneau en loading
    overlay.classList.add('show');
    if (code)  code.textContent  = '…';
    if (title) title.textContent = 'Chargement…';
    body.innerHTML = '<div class="evt-fiche-loading">Chargement de la fiche…</div>';

    try {
      if (!window.SupabaseHub || typeof SupabaseHub.getEvenementWithEncadrants !== 'function') {
        throw new Error('SupabaseHub.getEvenementWithEncadrants indisponible (v1.10+ requis)');
      }
      const evt = await SupabaseHub.getEvenementWithEncadrants(evenementId);
      if (!evt) {
        body.innerHTML = '<div class="evt-fiche-error">Évènement introuvable en base.</div>';
        if (title) title.textContent = 'Introuvable';
        return;
      }
      // Met à jour le header
      if (code)  code.textContent  = evt.code || '';
      if (title) title.textContent = evt.libelle || '(sans libellé)';

      // SUIVI-COACH-1 Objet A : mémorise l'évènement courant pour le
      // rafraîchissement en place de la section Suivi (sans re-fetch).
      FICHE_EVT_COURANT = evt;

      // SUIVI-COACH-2 : état 3 persistant entre visites (match simple).
      // Avant le rendu, si un lien 'saisie' actif existe déjà pour
      // cette rencontre, on pré-remplit SUIVI_LIENS_SESSION → la
      // section Suivi (Objet A) affichera directement l'état 3 au lieu
      // de retomber à l'état 2 « générer ».
      //   - Match simple UNIQUEMENT (décision de périmètre : les
      //     tournois resteraient N appels/enfant ; bornés session).
      //   - NON bloquant : un échec RPC / un wrapper absent ne doit
      //     JAMAIS empêcher l'ouverture de la fiche (la persistance
      //     est un confort, pas une dépendance dure).
      //   - N'écrase PAS un lien déjà en session (un lien généré dans
      //     cette session est le plus récent et fait foi).
      if (evt.type_evenement === 'match'
          && !SUIVI_LIENS_SESSION.has(evt.id)
          && window.SupabaseHub
          && typeof SupabaseHub.getLienSaisieActif === 'function') {
        try {
          const res = await SupabaseHub.getLienSaisieActif(evt.id);
          // res.ok && res.data === null = aucun lien actif : normal,
          // on ne fait rien (Objet A affichera l'état 2). Seul un
          // lien réellement présent pré-remplit la session.
          if (res && res.ok && res.data && res.data.token) {
            SUIVI_LIENS_SESSION.set(evt.id, {
              token:     res.data.token,
              role:      'saisie',   // la RPC ne renvoie que des 'saisie'
              expire_le: res.data.expire_le,
              url:       suiviBuildUrl(res.data.token)
            });
          }
        } catch (e) {
          // Strictement non bloquant : on log et on poursuit
          // l'ouverture de la fiche en l'état (état 2).
          console.error('MOM Hub: openFiche() relecture lien saisie', e);
        }
      }

      // ────────────────────────────────────────────────
      // v1.19/v1.20 — READ-BACK + ÉDITION ENGAGEMENT (M3/M5).
      // La RPC fiche (getEvenementWithEncadrants) ne porte PAS les
      // équipes engagées/adversaires (payload `encadrants` seul) :
      // l'engagement saisi à la création était écrit mais invisible.
      // On le récupère ICI via les wrappers LECTURE déployés
      // (getEquipesEngagees/getAdversairesEvenement) ; noms d'équipe
      // ET liste engageable résolus via le LISTING déployé
      // (getCategorieEquipe/listEquipes — même source que le Bloc
      // 4a, aucun nom inventé). Attaché à evt pour renderFiche
      // (sync). STRICTEMENT NON BLOQUANT (même posture que la
      // relecture lien Suivi ci-dessus) : tout échec → fiche rendue
      // sans le read-back (état honnête, tableaux/map vides).
      // Compétitions uniquement (M3/M5 n'existent que là ; cohérent
      // gating création Bloc 4a).
      evt._equipesEngagees = [];
      evt._adversaires     = [];
      evt._equipeNames     = {};
      evt._equipesClub     = [];
      if (evt.type_evenement === 'competition' && window.SupabaseHub) {
        try {
          if (typeof SupabaseHub.getEquipesEngagees === 'function') {
            const _eqs = await SupabaseHub.getEquipesEngagees(evt.id);
            evt._equipesEngagees = Array.isArray(_eqs) ? _eqs : [];
          }
          if (typeof SupabaseHub.getAdversairesEvenement === 'function') {
            const _advs = await SupabaseHub.getAdversairesEvenement(evt.id);
            evt._adversaires = Array.isArray(_advs) ? _advs : [];
          }
          // Liste du club (catégorie) : sert aux noms ET au picker
          // « + Engager ». Chargée pour TOUTE compétition (v1.20,
          // plus seulement si déjà engagée) afin que l'ajout d'une
          // 1re équipe fonctionne. Échec/silence = repli honnête
          // sur l'UUID côté renderFiche (jamais un faux).
          if (typeof SupabaseHub.listEquipes === 'function') {
            // Catégorie de l'événement affiché (EVT-RATTACHEMENT-CATEGORIE :
            // evt.categorie_id exposé par get_evenement_with_encadrants).
            // Repli sur la catégorie de l'équipe racine si absent (fiches
            // anciennes non rechargées), jamais M14 en dur.
            let _catId = evt.categorie_id || null;
            if (!_catId && evt.equipe_id
                && typeof SupabaseHub.getCategorieEquipe === 'function') {
              const _cat = await SupabaseHub.getCategorieEquipe(evt.equipe_id);
              if (_cat && _cat.ok && _cat.data) _catId = _cat.data.categorie_id;
            }
            if (_catId) {
              const _liste = await SupabaseHub.listEquipes(_catId);
              evt._equipesClub = Array.isArray(_liste) ? _liste : [];
              evt._equipesClub.forEach(function (e) {
                if (e && e.id) {
                  // v1.40 (n°2 cohérence) — nom_officiel EN PREMIER : il est
                  // rempli et homogène pour toutes les équipes (SAR/MOM-M14-1,
                  // SAR/MOM-M14-2). libelle_court était incohérent (M14-1 →
                  // « M14 », M14-2 → null → repli nom long) d'où l'affichage
                  // mixte « M14 » vs « SAR/MOM-M14-2 ». Repli libelle_court/
                  // code/id si nom_officiel absent.
                  evt._equipeNames[e.id] =
                    e.nom_officiel || e.libelle_court || e.code || e.id;
                }
              });
            }
          }
        } catch (e) {
          // Non bloquant : log, fiche rendue sans read-back complet.
          console.error('MOM Hub: openFiche() engagement (read-back/édition)', e);
        }
      }

      // Rend le corps de la fiche
      body.innerHTML = renderFiche(evt);

      // Câblage des actions internes (Annuler / Réactiver)
      bindFicheActions();
    } catch (err) {
      console.error('openFiche() erreur', err);
      body.innerHTML = '<div class="evt-fiche-error">Erreur de chargement : ' + escHtml(err.message || String(err)) + '</div>';
      if (title) title.textContent = 'Erreur';
    }
  }

  /** Ferme le panneau fiche détaillée */
  function closeFiche() {
    const overlay = document.getElementById('evt-fiche-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  // ============================================================
  // SUIVI DE LA RENCONTRE — SUIVI-COACH-1 Objet A
  // ============================================================
  // Point d'entrée coach : génère le lien éphémère de Suivi d'une
  // rencontre via SupabaseHub.genererLienEphemere (RPC C12-f) et le
  // transmet au bénévole. Spec : Conception-SUIVI-COACH-1-ObjetA.md.
  // Hors périmètre intangible : suivi.html / suivi-app.js /
  // suivi-client.js (module bénévole clôturé, sans login) NE sont PAS
  // touchés ; on ne fait qu'émettre le lien que ce module consomme.

  // URL de saisie du module bénévole (suivi.html).
  // Contrat documenté (STATE.md) : suivi.html est sans login et lit le
  // jeton dans le paramètre ?t=. Rien d'inventé ici.
  function suiviBuildUrl(token) {
    const u = new URL('suivi.html', window.location.href);
    u.search = '?t=' + encodeURIComponent(token);
    return u.toString();
  }

  // ============================================================
  // SUIVI-COACH-1 Objet B — ACCROCHE Mode Vidéo (ADDITION PURE)
  // ============================================================
  // Continuation adaptative de la section « Suivi de la rencontre »
  // d'Objet A (B-Q1). NOUVELLES fonctions uniquement, appelées EN
  // AVAL de renderSuiviRencontreBloc : ZÉRO retouche de la logique
  // d'Objet A (modèle SUIVI-COACH-2, comme v1.9). Spec :
  // Conception-SUIVI-COACH-1-ObjetB.md (validé Manu).

  // URL de l'écran Mode Vidéo (coach authentifié, fichier distinct
  // — B-Q1). Convention ?e= POSÉE dans js/mode-video.js (EVT_PARAM)
  // et réutilisée ici À L'IDENTIQUE (un seul contrat, pas deux).
  // Pattern calqué sur suiviBuildUrl — rien inventé.
  function modeVideoBuildUrl(evtId) {
    const u = new URL('mode-video.html', window.location.href);
    u.search = '?e=' + encodeURIComponent(evtId);
    return u.toString();
  }

  // La rencontre est-elle « revoyable » en Mode Vidéo ? B-Q1 :
  // visible une fois la rencontre JOUÉE. États evenements réels
  // (STATE / C12-a) : creation|compo|joue|resultat|archive|annule.
  // « Jouée » = {joue, resultat} (le match a eu lieu) ; avant, rien
  // à revoir ; archive/annule exclus. Même posture qu'A-Q2 /
  // suiviActionnable : on conçoit le COMPORTEMENT, le SEUIL exact
  // reste la dette Audits C12-gate — aligné, NON inventé.
  function suiviRevoirActionnable(rencontre) {
    if (!rencontre) return false;
    return rencontre.etat === 'joue' || rencontre.etat === 'resultat';
  }

  // Élément d'accès Mode Vidéo pour UNE rencontre (match simple OU
  // match enfant — A-Q3 : même unité réutilisée, hiérarchie tournoi
  // respectée sans la réinventer). '' si non applicable. Appelé EN
  // AVAL de renderSuiviRencontreBloc, ne le modifie pas. Style
  // calqué sur les blocs Objet A (mêmes variables CSS).
  function renderModeVideoAcces(rencontre) {
    if (!suiviRevoirActionnable(rencontre)) return '';
    const evtId = rencontre.id;
    let h = '<div style="padding:6px 0;border-top:1px solid var(--paper-warm);margin-top:8px;">';
    h += '<button type="button" class="evt-btn" data-action="suivi-revoir-video" data-event-id="' + escHtml(evtId) + '">🎬 Revoir ce match (Mode Vidéo)</button>';
    h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Écran coach a posteriori : compléter / corriger le déroulé depuis la vidéo, au calme.</div>';
    h += '</div>';
    return h;
  }

  // ============================================================
  // SUIVI-COACH-1 Objet C — ACCROCHE (ADDITION PURE)
  // ============================================================
  // Panneau temps de jeu C-1 + lien spectateur C-2. NOUVELLES
  // fonctions uniquement, appelées EN AVAL de renderSuiviRencontre-
  // Bloc : ZÉRO retouche de la logique d'Objet A/B (modèle v1.10).
  // Spec : Conception-SUIVI-COACH-1-ObjetC.md (validé Manu).

  // URL de l'écran spectateur (lecture seule, fichier distinct
  // — C2-Q1). Contrat ?t=<jeton> POSÉ dans js/spectateur.js /
  // suivi-client.js (getToken lit ?t=), réutilisé À L'IDENTIQUE.
  // Pattern calqué sur suiviBuildUrl — rien inventé.
  function spectateurBuildUrl(token) {
    const u = new URL('spectateur.html', window.location.href);
    u.search = '?t=' + encodeURIComponent(token);
    return u.toString();
  }

  // Accès « lien spectateur » pour UNE rencontre. C2-Q3 / évolution
  // A-Q4 : exposé UNIQUEMENT « dans l'état 3 » (un lien de saisie
  // est actif en session = le suivi est en place). '' sinon. Lecture
  // seule de SUIVI_LIENS_SESSION pour décider la visibilité (même
  // posture que renderModeVideoAcces qui lit rencontre.etat — on ne
  // modifie ni n'écrit la Map d'Objet A). Borné session (aucune RPC
  // de relecture spectateur n'existe — honnête, non inventé).
  function renderSpectateurAcces(rencontre) {
    const evtId = rencontre.id;
    if (!SUIVI_LIENS_SESSION.get(evtId)) return '';   // pas état 3
    const spect = SUIVI_SPECT_SESSION.get(evtId);
    let h = '<div style="padding:6px 0;border-top:1px solid var(--paper-warm);margin-top:8px;">';
    if (spect) {
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);margin-bottom:4px;">Lien spectateur (lecture seule — familles, public)</div>';
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--ink);word-break:break-all;background:var(--paper-warm);padding:8px;border-radius:6px;">' + escHtml(spect.url) + '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:4px;">Valable jusqu\'au ' + escHtml(formatDateShort(spect.expire_le)) + '</div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">';
      h += '<button type="button" class="evt-btn" data-action="suivi-spect-copier" data-event-id="' + escHtml(evtId) + '">📋 Copier</button>';
      h += '<button type="button" class="evt-btn" data-action="suivi-spect-partager" data-event-id="' + escHtml(evtId) + '">📤 Partager</button>';
      h += '<button type="button" class="evt-btn evt-btn-danger" data-action="suivi-spect-regenerer" data-event-id="' + escHtml(evtId) + '">🔄 Régénérer</button>';
      h += '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Lecture seule : ce lien ne permet jamais de saisir. Régénérer en crée un nouveau (les précédents restent valables jusqu\'à leur expiration).</div>';
    } else {
      h += '<button type="button" class="evt-btn" data-action="suivi-spect-generer" data-event-id="' + escHtml(evtId) + '">👁 Lien spectateur (lecture seule)</button>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Lien public à transmettre aux familles : suivi en lecture seule, aucune possibilité de saisie.</div>';
    }
    h += '</div>';
    return h;
  }

  // Placeholder de montage du panneau temps de jeu C-1. Émis EN
  // AVAL ; gate = suiviRevoirActionnable (MÊME seuil « phase aval »
  // que Mode Vidéo — non inventé). Le composant js/temps-de-jeu.js
  // est monté post-render (bindSuiviActions) ; il porte lui-même sa
  // logique de 4 états (replié, lecture pure). data-etat transmet
  // l'état rencontre (connu côté coach via la fiche — C1-Q3).
  function renderTempsDeJeuMount(rencontre) {
    if (!suiviRevoirActionnable(rencontre)) return '';
    return '<div data-tdj-mount data-event-id="' + escHtml(rencontre.id)
         + '" data-etat="' + escHtml(rencontre.etat || '') + '"></div>';
  }

  // Génération / régénération d'un lien SPECTATEUR (lecture seule).
  // Miroir de suiviGenerer mais role='spectateur' : C12-f
  // generer_lien_ephemere n'applique NI PI-7 NI relais pour
  // 'spectateur' (saisie-only) → génération inconditionnelle, et
  // les anciens liens restent valables (lecture seule, inoffensifs).
  async function spectGenerer(evtId, btn, isRegen) {
    if (!evtId) return;
    const labelInitial = isRegen ? '🔄 Régénérer' : '👁 Lien spectateur (lecture seule)';
    if (btn) { btn.disabled = true; btn.textContent = isRegen ? 'Régénération…' : 'Génération…'; }
    try {
      const res = await SupabaseHub.genererLienEphemere(evtId, 'spectateur');
      if (!res || !res.ok) {
        const msg = (res && res.error) || 'erreur inconnue';
        alert('Échec de la génération du lien spectateur : ' + msg);
        if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
        return;
      }
      const d = res.data;   // { token, role, expire_le }
      SUIVI_SPECT_SESSION.set(evtId, {
        token:     d.token,
        expire_le: d.expire_le,
        url:       spectateurBuildUrl(d.token)
      });
      refreshSuiviSection();
    } catch (err) {
      console.error('MOM Hub: spectGenerer()', err);
      alert('Erreur inattendue : ' + (err && err.message ? err.message : err));
      if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
    }
  }

  async function spectCopier(evtId) {
    const s = SUIVI_SPECT_SESSION.get(evtId);
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s.url);
      alert('Lien spectateur copié dans le presse-papiers.');
    } catch (e) {
      window.prompt('Copiez le lien spectateur :', s.url);
    }
  }

  async function spectPartager(evtId) {
    const s = SUIVI_SPECT_SESSION.get(evtId);
    if (!s) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Suivi de la rencontre (spectateur)',
          text:  'Lien spectateur — suivi en lecture seule',
          url:   s.url
        });
      } catch (e) {
        // Partage annulé : silencieux
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(s.url);
      alert('Partage non disponible sur cet appareil — lien copié à la place.');
    } catch (e) {
      window.prompt('Copiez le lien spectateur :', s.url);
    }
  }

  // Compo « prête » selon la notion DÉJÀ connue de la fiche.
  // AUCUN seuil inventé : on réutilise statutCompoBadge
  // (prête ⟺ validee+utilisee===total && total>0).
  function suiviCompoPrete(rencontre) {
    const b = statutCompoBadge(rencontre && rencontre.compo_status_summary);
    return b.cls === 'validee' || b.cls === 'utilisee';
  }

  // Le Suivi est-il proposable pour cette rencontre ?
  // A-Q1 : match|tournoi uniquement. Garde etat ∉ {annule,archive} =
  // calque du pattern existant des autres actions de la fiche
  // (le seuil exact reste la dette Audits C12-gate — signalée).
  function suiviActionnable(rencontre) {
    if (!rencontre) return false;
    // v1.57 FIX : aligner sur la correction v1.38. La détection « tournoi »
    // se fait via type_competition (estEvtAPhases), PAS via type_evenement
    // (qui n'est jamais 'tournoi' en base — cf. estEvtAPhases ligne ~1539).
    // Avant, ce gate testait type_evenement==='tournoi' (toujours faux) →
    // la section Suivi et la vignette restaient inactives pour les tournois
    // (Challenge Vié, Seven, etc.). Désormais : match simple OU évt à phases.
    var estMatch = rencontre.type_evenement === 'match';
    if (!estMatch && !estEvtAPhases(rencontre)) return false;
    return rencontre.etat !== 'annule' && rencontre.etat !== 'archive';
  }

  // Bloc 3-états pour UNE rencontre (match simple OU match enfant).
  function renderSuiviRencontreBloc(rencontre, compoPreteOverride) {
    const evtId = rencontre.id;
    const lien  = SUIVI_LIENS_SESSION.get(evtId);

    // v1.58 — gate « compo prête » : pour un match de tournoi, on autorise
    // la génération du lien dès que la compo de BASE du tournoi est validée
    // (compoPreteOverride passé par renderSuiviSection, calculé une fois sur
    // la racine), sans exiger une validation par match. Pour un match simple,
    // compoPreteOverride est undefined → on retombe sur le test du match lui-
    // même (comportement inchangé). Décision Manu (option B) : valider une
    // fois la base, tous les matchs deviennent suivables.
    const compoPrete = (typeof compoPreteOverride === 'boolean')
      ? compoPreteOverride
      : suiviCompoPrete(rencontre);

    // ÉTAT 3 — lien actif (borné session)
    if (lien) {
      let h = '<div style="padding:8px 0;">';
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);margin-bottom:4px;">Lien de saisie (à transmettre au bénévole)</div>';
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--ink);word-break:break-all;background:var(--paper-warm);padding:8px;border-radius:6px;">' + escHtml(lien.url) + '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:4px;">Valable jusqu\'au ' + escHtml(formatDateShort(lien.expire_le)) + '</div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">';
      h += '<button type="button" class="evt-btn" data-action="suivi-copier" data-event-id="' + escHtml(evtId) + '">📋 Copier</button>';
      h += '<button type="button" class="evt-btn" data-action="suivi-partager" data-event-id="' + escHtml(evtId) + '">📤 Partager</button>';
      h += '<button type="button" class="evt-btn evt-btn-danger" data-action="suivi-regenerer" data-event-id="' + escHtml(evtId) + '">🔄 Régénérer</button>';
      h += '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Régénérer crée un nouveau lien : l\'ancien cessera <strong>immédiatement</strong> de fonctionner.</div>';
      h += '</div>';
      return h;
    }

    // ÉTAT 1 — compo pas prête
    if (!compoPrete) {
      let h = '<div style="padding:8px 0;">';
      h += '<div style="font-size:13px;color:var(--ink);margin-bottom:8px;">La composition doit être <strong>validée</strong> avant de pouvoir générer le lien de suivi (pour un tournoi, validez la composition de base).</div>';
      // Raccourci honnête : compositions.html est une page réelle. Le
      // deep-link vers la compo de CETTE rencontre nécessiterait la
      // convention d'URL de compositions.html — NON inventée ici.
      h += '<button type="button" class="evt-btn" data-action="suivi-aller-compo">→ Aller aux compositions</button>';
      h += '</div>';
      return h;
    }

    // ÉTAT 2 — compo prête → bouton générer
    let h = '<div style="padding:8px 0;">';
    h += '<button type="button" class="evt-btn evt-btn-primary" data-action="suivi-generer" data-event-id="' + escHtml(evtId) + '">🔗 Générer le lien de suivi</button>';
    h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Générer peut remplacer un lien émis précédemment pour cette rencontre (l\'ancien serait alors révoqué).</div>';
    h += '</div>';
    return h;
  }

  // Section complète « Suivi de la rencontre » (ou '' si non
  // applicable). id stable evt-suivi-section pour le rafraîchissement
  // en place après génération.
  // v1.60 — NEUTRALISÉE : la vignette « Suivi de la rencontre » est
  // supprimée ; la génération des liens (bénévole + spectateur) vit
  // désormais dans l'onglet Suivi de l'éditeur (compositions-editor
  // v3.61). On retourne '' inconditionnellement. Le corps historique
  // (états bénévole, spectateur, par phase/match) est CONSERVÉ en aval
  // de ce return mais devient mort : geste minimal, additivité prouvable
  // (aucun helper supprimé, aucune référence à chasser). Dette
  // SUIVI-LIEN-COACH-MIGRATION ✅ levée. Voir suiviGenerer/spectGenerer
  // /renderSpectateurAcces ci-dessus : intacts mais plus appelés.
  function renderSuiviSection(evt) {
    return '';

    // eslint-disable-next-line no-unreachable
    if (!suiviActionnable(evt)) return '';

    let html = '<div class="evt-fiche-section" id="evt-suivi-section">';
    html += '<div class="evt-fiche-section-title">🔗 Suivi de la rencontre</div>';

    if (estEvtAPhases(evt)) {  // v1.38 — via type_competition (était type_evenement==='tournoi', tjrs faux)
      // A-Q3 : 1 lien par match enfant, DANS la structure du tournoi.
      // Réutilise le regroupement par phase déjà utilisé par la
      // section « Phases du tournoi » (structure non réinventée).
      // v1.58 (option B) : le gate « compo prête » est évalué UNE FOIS sur
      // la compo de BASE du tournoi (racine evt), puis appliqué à tous les
      // matchs. Valider la base suffit à rendre tous les matchs suivables.
      const compoPreteRacine = suiviCompoPrete(evt);
      const enfants = CHILDREN_BY_PARENT[evt.id] || [];
      if (enfants.length === 0) {
        html += '<div class="evt-fiche-empty">Aucun match interne pour ce tournoi — créez les matchs pour générer leurs liens de suivi.</div>';
      } else {
        const phases = [];
        const byPhase = {};
        enfants.forEach(c => {
          const p = c.phase_libelle || '(sans phase)';
          if (!byPhase[p]) { byPhase[p] = []; phases.push(p); }
          byPhase[p].push(c);
        });
        phases.forEach(phaseName => {
          html += '<div class="evt-fiche-phase-titre">📍 ' + escHtml(phaseName) + '</div>';
          byPhase[phaseName].forEach(child => {
            const heure = formatHeureOnly(child.date_debut);
            const childLibStartsVs = (child.libelle || '').toLowerCase().indexOf('vs ') === 0;
            const advBlock = childLibStartsVs
              ? ''
              : (child.adversaire_nom ? ' · vs ' + escHtml(child.adversaire_nom) : '');
            html += '<div style="border-top:1px solid var(--paper-warm);padding-top:6px;margin-top:6px;">';
            html += '<div style="font-size:13px;color:var(--ink);font-weight:600;">' + escHtml(heure) + ' · ' + escHtml(child.libelle || '') + advBlock + '</div>';
            if (child.etat === 'annule' || child.etat === 'archive') {
              html += '<div style="font-size:12px;color:var(--ink-mute);padding:6px 0;">Match ' + escHtml(child.etat) + ' — pas de lien de suivi.</div>';
            } else {
              html += renderSuiviRencontreBloc(child, compoPreteRacine);
              // v1.59 — Mode Vidéo (Objet B) + Temps de jeu (Objet C)
              // retirés de la vignette (place naturelle = onglet Suivi/
              // Rapport de l'éditeur). renderSuiviRencontreBloc CONSERVÉ
              // (unique générateur du lien coach) ; renderSpectateurAcces
              // CONSERVÉ (dépend du lien coach généré). Cf. dette
              // SUIVI-LIEN-COACH-MIGRATION en en-tête.
              html += renderSpectateurAcces(child);
            }
            html += '</div>';
          });
        });
      }
    } else {
      // Match simple
      html += renderSuiviRencontreBloc(evt);
      html += renderModeVideoAcces(evt);
      html += renderSpectateurAcces(evt);
      html += renderTempsDeJeuMount(evt);
    }

    html += '</div>';
    return html;
  }

  // Rafraîchit la seule section Suivi en place (pas de re-fetch, pas
  // de re-render de toute la fiche → ne perturbe pas les collapsibles).
  function refreshSuiviSection() {
    const cur = document.getElementById('evt-suivi-section');
    if (!cur || !FICHE_EVT_COURANT) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderSuiviSection(FICHE_EVT_COURANT);
    const fresh = tmp.firstElementChild;
    if (fresh) {
      cur.replaceWith(fresh);
      bindSuiviActions();
    }
  }

  // Génération / régénération d'un lien de saisie.
  async function suiviGenerer(evtId, btn, isRegen) {
    if (!evtId) return;
    if (isRegen) {
      const ok = window.confirm(
        'Régénérer le lien de suivi ?\n\n' +
        "L'ancien lien de cette rencontre cessera IMMÉDIATEMENT de " +
        'fonctionner. Le bénévole devra utiliser le nouveau lien.'
      );
      if (!ok) return;
    }
    const labelInitial = isRegen ? '🔄 Régénérer' : '🔗 Générer le lien de suivi';
    if (btn) { btn.disabled = true; btn.textContent = isRegen ? 'Régénération…' : 'Génération…'; }
    try {
      const res = await SupabaseHub.genererLienEphemere(evtId);
      if (!res || !res.ok) {
        const msg = (res && res.error) || 'erreur inconnue';
        // PI-7 : refus serveur faute de compo validée active. Retraduit
        // en message métier clair (pas une erreur brute).
        if (/PI-7|composition\s+valid|compo/i.test(msg)) {
          alert(
            "La composition de cette rencontre n'est pas validée côté " +
            'serveur : le suivi ne peut pas démarrer.\n\n' +
            'Validez la compo de la rencontre puis réessayez.'
          );
        } else {
          alert('Échec de la génération du lien : ' + msg);
        }
        if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
        return;
      }
      const d = res.data;   // { token, role, expire_le }
      SUIVI_LIENS_SESSION.set(evtId, {
        token:     d.token,
        role:      d.role,
        expire_le: d.expire_le,
        url:       suiviBuildUrl(d.token)
      });
      refreshSuiviSection();
    } catch (err) {
      console.error('MOM Hub: suiviGenerer()', err);
      alert('Erreur inattendue : ' + (err && err.message ? err.message : err));
      if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
    }
  }

  async function suiviCopier(evtId) {
    const lien = SUIVI_LIENS_SESSION.get(evtId);
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien.url);
      alert('Lien copié dans le presse-papiers.');
    } catch (e) {
      // Repli si Clipboard API indisponible / refusée
      window.prompt('Copiez le lien de suivi :', lien.url);
    }
  }

  async function suiviPartager(evtId) {
    const lien = SUIVI_LIENS_SESSION.get(evtId);
    if (!lien) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Suivi de la rencontre',
          text:  'Lien de saisie du suivi de la rencontre',
          url:   lien.url
        });
      } catch (e) {
        // Partage annulé par l'utilisateur : silencieux
      }
      return;
    }
    // Pas de Web Share → repli copie
    try {
      await navigator.clipboard.writeText(lien.url);
      alert('Partage non disponible sur cet appareil — lien copié à la place.');
    } catch (e) {
      window.prompt('Copiez le lien de suivi :', lien.url);
    }
  }

  // Câble les actions de la section Suivi. Appelée par
  // bindFicheActions() (rendu complet) ET refreshSuiviSection()
  // (rafraîchissement partiel — les anciens noeuds ont été remplacés,
  // donc aucun double-binding).
  function bindSuiviActions() {
    document.querySelectorAll('[data-action="suivi-generer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviGenerer(this.getAttribute('data-event-id'), this, false);
      });
    });
    document.querySelectorAll('[data-action="suivi-regenerer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviGenerer(this.getAttribute('data-event-id'), this, true);
      });
    });
    document.querySelectorAll('[data-action="suivi-copier"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviCopier(this.getAttribute('data-event-id'));
      });
    });
    document.querySelectorAll('[data-action="suivi-partager"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviPartager(this.getAttribute('data-event-id'));
      });
    });
    document.querySelectorAll('[data-action="suivi-aller-compo"]').forEach(btn => {
      btn.addEventListener('click', function () {
        // Raccourci honnête vers la page compositions (pas de deep-link
        // inventé — convention d'URL de compositions.html non connue).
        window.location.href = 'compositions.html';
      });
    });
    // SUIVI-COACH-1 Objet B : accès Mode Vidéo (ADDITION PURE —
    // sibling des bindings ci-dessus, pattern identique ; les
    // bindings d'Objet A ne sont pas touchés). Câblé sur full
    // render ET refreshSuiviSection (noeuds remplacés → pas de
    // double-binding, même garantie que les data-action d'A).
    document.querySelectorAll('[data-action="suivi-revoir-video"]').forEach(btn => {
      btn.addEventListener('click', function () {
        // Ouvre l'écran Mode Vidéo coach (fichier distinct, B-Q1).
        window.location.href = modeVideoBuildUrl(this.getAttribute('data-event-id'));
      });
    });

    // SUIVI-COACH-1 Objet C (v1.11) : lien spectateur + montage du
    // panneau temps de jeu (ADDITION PURE — siblings des bindings
    // ci-dessus, pattern identique ; les bindings d'Objet A/B ne
    // sont pas touchés). Câblé sur full render ET refreshSuiviSection
    // (noeuds remplacés → pas de double-binding).
    document.querySelectorAll('[data-action="suivi-spect-generer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectGenerer(this.getAttribute('data-event-id'), this, false);
      });
    });
    document.querySelectorAll('[data-action="suivi-spect-regenerer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectGenerer(this.getAttribute('data-event-id'), this, true);
      });
    });
    document.querySelectorAll('[data-action="suivi-spect-copier"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectCopier(this.getAttribute('data-event-id'));
      });
    });
    document.querySelectorAll('[data-action="suivi-spect-partager"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectPartager(this.getAttribute('data-event-id'));
      });
    });
    // Montage du panneau temps de jeu C-1 (composant js/temps-de-jeu.js,
    // panneau replié, lecture pure). Non bloquant si TempsDeJeu absent
    // (posture v1.9/v1.10 : l'accroche n'empêche jamais la fiche).
    // Garde data-tdj-done = pas de double-montage sur un même noeud
    // (refreshSuiviSection remplace tout le noeud → placeholder frais).
    document.querySelectorAll('[data-tdj-mount]').forEach(el => {
      if (el.getAttribute('data-tdj-done') === '1') return;
      if (!window.TempsDeJeu || typeof window.TempsDeJeu.monter !== 'function') return;
      el.setAttribute('data-tdj-done', '1');
      window.TempsDeJeu.monter(el, el.getAttribute('data-event-id'), {
        etat: el.getAttribute('data-etat') || null
      });
    });
  }

  /**
   * Construit le HTML complet du corps de la fiche détaillée.
   * Sections empilées selon doc Conception §3.3 :
   *   Identité → Phases (si tournoi) → Logistique (conditionnelle) →
   *   Encadrants → Notes → Score (si rempli) → Actions
   */
  // ============================================================
  // v1.25 — renderFiche refondu (L3b · dette UX-EVT-FICHE-REFONTE)
  // ============================================================
  // Refonte intégrale §3.2-3.3 doc UX FAIT FOI md5 4c8652d9.
  // Doctrine F-1 : fiche évènement = centre névralgique, tout part de
  // l'évènement créé. 9 blocs séquentiels (voir bloc changelog v1.25
  // en-tête fichier pour la spec complète).
  //
  // INVARIANTS BYTE-IDENTIQUES : renderSuiviSection, helpers utilitaires,
  // handlers Niveau 0 ouvrir-groupe-base/ouvrir-feuille-equipe (réutilisés
  // dans expansion in-situ multi-équipes Q4=C). RETIRÉS Q3=B + Q5=A
  // (écart gouvernance E-5) : édition inline M3/M5, bouton Retour aux
  // compositions, bouton Notes séparé.
  // ============================================================
  function renderFiche(evt) {
    let html = '';

    const isCompetition = evt.type_evenement === 'competition';
    const isTournoi     = estEvtAPhases(evt);  // v1.38 — via type_competition
    const isMatch       = evt.type_evenement === 'match';
    const eqEng  = Array.isArray(evt._equipesEngagees) ? evt._equipesEngagees : [];
    const advAll = Array.isArray(evt._adversaires) ? evt._adversaires : [];
    const eqNames = (evt._equipeNames && typeof evt._equipeNames === 'object')
      ? evt._equipeNames : {};
    const encadrants = Array.isArray(evt.encadrants) ? evt.encadrants : [];
    const enfants = isTournoi ? (CHILDREN_BY_PARENT[evt.id] || []) : [];
    const hasLogistique = evt.logistique_deplacement
      && typeof evt.logistique_deplacement === 'object'
      && Object.keys(evt.logistique_deplacement).length > 0;
    const showLogistique = hasLogistique || evt.type_evenement === 'deplacement';
    const editableEtat = (evt.etat !== 'annule' && evt.etat !== 'archive');
    const hasScore = (evt.score_mom !== null && evt.score_mom !== undefined
                      && evt.score_adverse !== null && evt.score_adverse !== undefined);

    // ────────────────────────────────────────────────
    // (1) HEADER NAVIGATION : retour calendrier F-4 + retour parent contextuel
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-header">';
    // v1.53 — Bouton « ← Retour au calendrier » RETIRÉ (partout) : redondant
    // avec la croix ✕ qui ferme la fiche sur tous les écrans. Le « ↩ Retour
    // au tournoi parent » ci-dessous est conservé (action distincte).
    if (evt.evenement_parent_id) {
      const parent = EVENTS_BY_ID[evt.evenement_parent_id];
      if (_estOccurrenceEntrainement(evt)) {
        // EVT-RECURRENCE-OCCURRENCES : occurrence d'un entraînement récurrent.
        // Retour vers la série + suppression de CETTE séance uniquement.
        if (parent) {
          const serieLib = parent.libelle || parent.code || '(série récurrente)';
          html += '<button type="button" class="evt-btn evt-fiche-back-parent" data-action="retour-parent" data-parent-id="' + escHtml(evt.evenement_parent_id) + '">↩ Série : ' + escHtml(serieLib) + '</button>';
        }
        html += '<button type="button" class="evt-btn evt-fiche-suppr-occurrence" data-action="supprimer-occurrence" data-occurrence-id="' + escHtml(evt.id) + '">🗑 Supprimer cette séance</button>';
      } else if (parent) {
        // Enfant de tournoi (compétition) : retour au tournoi parent.
        const parentLib = parent.libelle || parent.code || '(tournoi parent)';
        html += '<button type="button" class="evt-btn evt-fiche-back-parent" data-action="retour-parent" data-parent-id="' + escHtml(evt.evenement_parent_id) + '">↩ Retour à ' + escHtml(parentLib) + '</button>';
      }
    } else if (_estMereRecurrente(evt)) {
      // EVT-SERIE-ECRAN : mère récurrente → accès à la modale « voir la série »
      // (toutes les occurrences, au-delà de la fenêtre 90 j).
      html += '<button type="button" class="evt-btn evt-fiche-voir-serie" data-action="voir-serie" data-mere-id="' + escHtml(evt.id) + '">📅 Voir la série</button>';
    }
    html += '</div>';

    // ────────────────────────────────────────────────
    // (2) IDENTITÉ COMPACTE
    // ────────────────────────────────────────────────
    const dateLib = formatDateShort(evt.date_debut);
    const typeLbl = TYPE_LABELS[evt.type_evenement] || evt.type_evenement;
    const etatVal = evt.etat || 'creation';
    const etatPillCls = 'evt-fiche-pill-etat-' + etatVal;
    const etatLbl = ETAT_LABELS[etatVal] || etatVal;

    html += '<div class="evt-fiche-identite">';
    html += '<div class="evt-fiche-identite-meta">' + escHtml(dateLib) + ' · ' + escHtml(typeLbl) + '</div>';
    html += '<div class="evt-fiche-identite-libelle">' + escHtml(evt.libelle || '(sans libellé)') + '</div>';
    html += '<div class="evt-fiche-identite-row">';
    html += '<span class="evt-fiche-pill ' + etatPillCls + '">État : ' + escHtml(etatLbl) + '</span>';
    // EVT-SERIE-VISIBILITE — pastille identifiant la fiche mère d'une série
    // récurrente (visible même une fois la séance mère passée).
    if (_estMereRecurrente(evt)) {
      html += '<span class="evt-fiche-pill">🔁 Série récurrente</span>';
    }
    if (evt.type_competition) {
      html += '<span class="evt-fiche-pill">' + escHtml(evt.type_competition) + '</span>';
    }
    if (evt.domicile_exterieur) {
      html += '<span class="evt-fiche-pill">' + escHtml(evt.domicile_exterieur) + '</span>';
    }
    html += '</div>';
    html += '</div>';

    // ────────────────────────────────────────────────
    // (3) BANNIÈRE NIVEAU 1 — 5 cellules auto-adaptatives essentielles §3.2
    //     HORAIRES · LIEU+domicile · ÉQUIPES ENGAGÉES+formats · ADVERSAIRES
    //     + 5ᵉ cellule conditionnelle SCORE (Q2 acté) si match avec score.
    //     CSS grid auto-fit : 1-5 cellules selon données peuplées.
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-banniere-n1">';

    // HORAIRES — affichée seulement si une heure SIGNIFICATIVE existe
    // (v1.41 : formatHeureOnly renvoie '' pour minuit UTC = créé sans heure).
    // Évite une cellule « Horaires » vide ou un « → » orphelin.
    if (evt.date_debut) {
      const hDeb = formatHeureOnly(evt.date_debut);
      const hFin = evt.date_fin ? formatHeureOnly(evt.date_fin) : '';
      let horairesCellule = escHtml(hDeb);
      if (hFin) {
        horairesCellule = horairesCellule
          ? horairesCellule + ' → ' + escHtml(hFin)
          : escHtml(hFin);
      }
      if (horairesCellule) {
        html += '<div class="evt-fiche-n1-cellule">';
        html += '<div class="evt-fiche-n1-label">Horaires</div>';
        html += '<div class="evt-fiche-n1-value">' + horairesCellule + '</div>';
        html += '</div>';
      }
    }

    // LIEU + sous-ligne domicile/extérieur
    if (evt.site_libelle_court) {
      html += '<div class="evt-fiche-n1-cellule">';
      html += '<div class="evt-fiche-n1-label">Lieu</div>';
      html += '<div class="evt-fiche-n1-value">' + escHtml(evt.site_libelle_court) + '</div>';
      if (evt.domicile_exterieur) {
        html += '<div class="evt-fiche-n1-sub">🏠 ' + escHtml(evt.domicile_exterieur) + '</div>';
      }
      html += '</div>';
    }

    // ÉQUIPES ENGAGÉES (compétition + données chargées)
    if (isCompetition && eqEng.length > 0) {
      const formatsList = eqEng
        .map(function (eq) {
          const nomEq = eqNames[eq.equipe_id] || '(équipe)';
          return eq.format_de_jeu
            ? escHtml(nomEq) + ' : ' + escHtml(eq.format_de_jeu)
            : escHtml(nomEq);
        })
        .join(' · ');
      const plurNb = eqEng.length > 1 ? 's' : '';
      html += '<div class="evt-fiche-n1-cellule">';
      html += '<div class="evt-fiche-n1-label">Équipes engagées</div>';
      html += '<div class="evt-fiche-n1-value">' + eqEng.length + ' équipe' + plurNb + ' engagée' + plurNb + '</div>';
      html += '<div class="evt-fiche-n1-sub">' + formatsList + '</div>';
      html += '</div>';
    }

    // ADVERSAIRES (synthèse compétition)
    if (isCompetition && advAll.length > 0) {
      const advNoms = advAll
        .map(function (a) { return a.adversaire_nom; })
        .filter(function (n) { return n; });
      if (advNoms.length > 0) {
        html += '<div class="evt-fiche-n1-cellule">';
        html += '<div class="evt-fiche-n1-label">Adversaires</div>';
        html += '<div class="evt-fiche-n1-value">' + advNoms.map(escHtml).join(', ') + '</div>';
        html += '</div>';
      }
    }
    // Repli adversaire simple (cas non-compétition mais champ direct)
    else if (!isCompetition && evt.adversaire_nom) {
      html += '<div class="evt-fiche-n1-cellule">';
      html += '<div class="evt-fiche-n1-label">Adversaire</div>';
      html += '<div class="evt-fiche-n1-value">' + escHtml(evt.adversaire_nom) + '</div>';
      html += '</div>';
    }

    // SCORE (5ᵉ cellule conditionnelle, Q2 acté)
    if (hasScore) {
      html += '<div class="evt-fiche-n1-cellule evt-fiche-n1-score">';
      html += '<div class="evt-fiche-n1-label">Score</div>';
      html += '<div class="evt-fiche-n1-value evt-fiche-n1-score-val">' + escHtml(String(evt.score_mom)) + ' — ' + escHtml(String(evt.score_adverse)) + '</div>';
      html += '</div>';
    }

    html += '</div>';

    // ────────────────────────────────────────────────
    // (4) BANNIÈRE NIVEAU 2 — 5 secondaires dépliables §3.2
    //     STRUCTURE PHASES · RENDEZ-VOUS · STATUT COMPOSITIONS ·
    //     ENCADREMENT · NOTES. Chevron pivotant via toggle-niveau-2.
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-banniere-n2-toggle">';
    html += '<button type="button" class="evt-btn evt-fiche-toggle-btn" data-action="toggle-niveau-2" aria-expanded="false">Afficher les détails <span class="evt-fiche-chevron-n2">▶</span></button>';
    html += '</div>';
    html += '<div class="evt-fiche-banniere-n2" id="evt-fiche-n2-body" hidden>';

    // STRUCTURE PHASES (si tournoi avec enfants)
    if (isTournoi && enfants.length > 0) {
      const phasesSet = {};
      enfants.forEach(function (c) {
        const p = c.phase_libelle || '(sans phase)';
        phasesSet[p] = true;
      });
      const nbPhases = Object.keys(phasesSet).length;
      const nbMatchs = enfants.length;
      const plurPh = nbPhases > 1 ? 's' : '';
      const plurMa = nbMatchs > 1 ? 's' : '';
      html += '<div class="evt-fiche-n2-cellule">';
      html += '<div class="evt-fiche-n2-label">Structure phases</div>';
      html += '<div class="evt-fiche-n2-value">' + nbPhases + ' phase' + plurPh + ' · ' + nbMatchs + ' match' + plurMa + ' prévu' + plurMa + '</div>';
      html += '<button type="button" class="evt-btn evt-fiche-n2-link" data-action="voir-phases-detail">voir le détail →</button>';
      html += '</div>';
    }

    // RENDEZ-VOUS & HORAIRES (v1.43 — dette MODELE-EVT-HORAIRES-RDV LEVÉE :
    // les horaires détaillés sont désormais persistés (colonnes TIME/TEXT +
    // RPC v7 + submit v1.42). Affichage des valeurs réelles, repli « non
    // saisi » honnête si vide. Libellé du début adapté au type d'évènement.
    {
      // Format TIME base "HH:MM:SS" → "HHhMM" (ou "HHh" si minutes nulles).
      const fmtT = function (t) {
        if (!t) return '';
        const parts = String(t).split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1] || '0', 10);
        if (isNaN(h)) return '';
        return m === 0 ? h + 'h' : h + 'h' + String(m).padStart(2, '0');
      };
      // Libellé « début » adapté au type (retour terrain) :
      const labelDebut = evt.type_evenement === 'competition' ? 'Début des matchs'
                       : evt.type_evenement === 'stage'        ? 'Début des activités'
                       : 'Début de l\'entraînement';
      const hDeb = fmtT(evt.debut_match);
      const hFin = fmtT(evt.fin_prevue);
      const hRdv = fmtT(evt.rdv_heure);
      const lRdv = (evt.rdv_lieu || '').trim();

      // Lignes construites seulement si renseignées.
      const lignes = [];
      if (hRdv || lRdv) {
        let rdv = 'RDV';
        if (hRdv) rdv += ' ' + escHtml(hRdv);
        if (lRdv) rdv += (hRdv ? ' · ' : ' ') + escHtml(lRdv);
        lignes.push(rdv);
      }
      if (hDeb) lignes.push(escHtml(labelDebut) + ' ' + escHtml(hDeb));
      if (hFin) lignes.push('Fin prévue ' + escHtml(hFin));

      html += '<div class="evt-fiche-n2-cellule">';
      html += '<div class="evt-fiche-n2-label">Rendez-vous & horaires</div>';
      if (lignes.length > 0) {
        html += '<div class="evt-fiche-n2-value">' + lignes.join('<br>') + '</div>';
      } else {
        html += '<div class="evt-fiche-n2-value evt-fiche-n2-empty">— non saisi</div>';
      }
      html += '</div>';
    }

    // STATUT COMPOSITIONS
    const compoSummary = evt.compo_status_summary;
    if (compoSummary && compoSummary.total > 0) {
      const badge = statutCompoBadge(compoSummary);
      html += '<div class="evt-fiche-n2-cellule">';
      html += '<div class="evt-fiche-n2-label">Statut compositions</div>';
      html += '<div class="evt-fiche-n2-value">' + escHtml(badge.libelle) + '</div>';
      html += '<span class="evt-card-badge evt-badge-' + badge.cls + ' evt-badge-sm">' + escHtml(badge.libelle) + '</span>';
      html += '</div>';
    } else if (isCompetition || isMatch || isTournoi) {
      html += '<div class="evt-fiche-n2-cellule">';
      html += '<div class="evt-fiche-n2-label">Statut compositions</div>';
      html += '<div class="evt-fiche-n2-value evt-fiche-n2-empty">0 compo · à faire</div>';
      html += '</div>';
    }

    // ENCADREMENT : le résumé inline « Prénom N. » a été RETIRÉ du Niveau 2
    // (redondant avec la carte fonctionnelle « 🧑‍🏫 Encadrement » plus bas, qui
    // liste déjà les encadrants au dépliage). Choix « sobriété » : l'encadrement
    // est une fonction comme les autres (Compositions, Suivi…), pas un champ de
    // résumé. Voir renderFonctionCellule sectionId='encadrement'.

    // NOTES (champ notes_internes existant, absorbé Niveau 2)
    if (evt.notes_internes) {
      html += '<div class="evt-fiche-n2-cellule evt-fiche-n2-notes">';
      html += '<div class="evt-fiche-n2-label">Notes</div>';
      html += '<div class="evt-fiche-n2-value evt-fiche-n2-prose">' + escHtml(evt.notes_internes) + '</div>';
      html += '</div>';
    } else {
      // v1.51 — Dette MODELE-EVT-NOTES CLOSE : décision Manu = notes_internes
      // reste un TEXTE LIBRE simple (pas de champ structuré). Le marqueur de
      // dette « 🟡 champ structuré à clarifier » est RETIRÉ de l'UI (il ne
      // servait qu'au dev et s'affichait au coach).
      html += '<div class="evt-fiche-n2-cellule evt-fiche-n2-notes">';
      html += '<div class="evt-fiche-n2-label">Notes</div>';
      html += '<div class="evt-fiche-n2-value evt-fiche-n2-empty">— aucune note</div>';
      html += '</div>';
    }

    html += '</div>';  // /banniere-n2

    // ────────────────────────────────────────────────
    // (5) BLOC SUIVI DE RENCONTRE — v1.60 SUPPRIMÉ.
    //     La vignette « Suivi de la rencontre » (renderSuiviSection) est
    //     neutralisée : les liens partageables ont migré dans l'onglet
    //     Suivi de l'éditeur. La tuile « ⏱ Suivi » (grille fonctionnalités,
    //     plus bas) est désormais un deep-link vers l'éditeur. Plus aucun
    //     HTML de suivi injecté ici. Dette SUIVI-LIEN-COACH-MIGRATION ✅.
    // ────────────────────────────────────────────────

    // ────────────────────────────────────────────────
    // (6) GRILLE FONCTIONNALITÉS DE L'ÉVÈNEMENT — 8 grands boutons §3.3
    //     Statuts honnêtes Q-A28. Q4=C : Compositions/Groupes adaptatifs
    //     selon nombre d'équipes engagées (1→direct INVARIANT, N→expand).
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-grille-fonctions">';

    // v1.40 (n°3 retour terrain) — Bannière « prochaine étape » pleine
    // largeur mettant en avant Groupes de base, l'étape logique juste après
    // la création d'une compétition. Additive (ne modifie pas la grille des
    // 8 fonctions, invariant) : un simple bandeau cliquable au-dessus.
    // Cliquer scrolle/ouvre la vignette Groupes de base existante (action
    // partagée 'focus-groupe-base' → handler qui met en avant la cellule).
    // Affichée seulement si l'étape est pertinente (compétition + au moins
    // une équipe engagée).
    if (isCompetition && eqEng.length > 0) {
      html += '<button type="button" class="evt-fiche-next-step" '
        + 'data-action="focus-groupe-base" '
        + 'style="display:block; width:100%; text-align:left; cursor:pointer; '
        + 'border:1px solid var(--vert-pelouse); border-radius:10px; '
        + 'background:rgba(45,106,79,0.06); padding:14px 16px; margin-bottom:14px;">'
        + '<div style="font-weight:700; color:var(--vert-pelouse); font-size:1.05em;">'
        + '👥 Groupes de base</div>'
        + '<div style="color:var(--ink-mute); margin-top:2px;">'
        + 'Prochaine étape : sélectionnez votre groupe de base parmi le vivier '
        + 'de vos joueurs&nbsp;!</div>'
        + '</button>';
    }

    html += '<div class="evt-fiche-grille-titre">Fonctionnalités de l\'évènement</div>';
    html += '<div class="evt-fiche-grille-list">';

    // Fonction #1 — Compositions (Feuilles de match par équipe)
    html += renderFonctionCellule({
      titre: '📋 Compositions',
      sousTitre: 'Feuilles de match par équipe',
      statut: eqEng.length > 0 ? 'disponible' : 'a-venir',
      action: 'ouvrir-feuille-equipe',
      multiEquipes: eqEng,
      eqNames: eqNames,
      evt: evt,
      sectionId: 'compositions'
    });

    // Fonction #2 — Suivi : v1.60 — DEEP-LINK vers l'éditeur Suivi (miroir
    // de Vue terrain / Réseaux). La vignette génératrice de liens a migré
    // dans l'éditeur (compositions-editor v3.61) ; la tuile ne fait plus
    // d'expansion in-situ. Pour un match simple, le handler ajoute
    // &match=<evt.id> (le match = l'évènement). suivi disponible dès
    // qu'une équipe est engagée (comme Compositions / Vue terrain).
    html += renderFonctionCellule({
      titre: '⏱ Suivi',
      sousTitre: 'Saisie observables match',
      statut: eqEng.length > 0 ? 'disponible' : 'a-venir',
      action: 'ouvrir-vue-suivi',
      multiEquipes: eqEng,
      eqNames: eqNames,
      evt: evt,
      sectionId: 'suivi-acces',
      hintIndisponible: 'hors période ou type d\'évènement'
    });

    // Fonction #3 — Groupes de base (Pioche dans le vivier)
    html += renderFonctionCellule({
      titre: '👥 Groupes de base',
      sousTitre: 'Pioche dans le vivier',
      statut: eqEng.length > 0 ? 'disponible' : 'a-venir',
      action: 'ouvrir-groupe-base',
      multiEquipes: eqEng,
      eqNames: eqNames,
      evt: evt,
      sectionId: 'groupes'
    });

    // Fonction #4 — Encadrement (Staff et affectations)
    html += renderFonctionCellule({
      titre: '🧑‍🏫 Encadrement',
      sousTitre: 'Staff et affectations',
      statut: encadrants.length > 0 ? 'disponible' : 'a-venir',
      action: 'expand-fonction',
      evt: evt,
      sectionId: 'encadrement',
      encadrants: encadrants
    });

    // Fonction #5 — Vue terrain (deep-link vers compositions.html?vue=terrain)
    html += renderFonctionCellule({
      titre: '🏟 Vue terrain',
      sousTitre: 'Placement des joueurs',
      statut: eqEng.length > 0 ? 'disponible' : 'a-venir',
      action: 'ouvrir-vue-terrain',
      multiEquipes: eqEng,
      eqNames: eqNames,
      evt: evt,
      sectionId: 'vue-terrain'
    });

    // Fonction #6 — Vue réseaux sociaux (deep-link vers compositions.html?vue=reseaux)
    html += renderFonctionCellule({
      titre: '📲 Vue réseaux sociaux',
      sousTitre: 'Composition partageable',
      statut: eqEng.length > 0 ? 'disponible' : 'a-venir',
      action: 'ouvrir-vue-reseaux',
      multiEquipes: eqEng,
      eqNames: eqNames,
      evt: evt,
      sectionId: 'vue-reseaux'
    });

    // Fonction #7 — Rapports (deep-link vers compositions.html?vue=rapport)
    //   v1.61 — La fonctionnalité Rapports EXISTE déjà : c'est l'onglet
    //   « Rapport » de l'éditeur (compositions.html, livré pt 53-55). On
    //   câble la vignette en miroir EXACT de Vue terrain / Réseaux / Suivi :
    //   statut adaptatif + action ouvrir-vue-rapport + mécanisme multi-équipes.
    //   Le deep-link &vue=rapport est capté au boot par compositions-editor
    //   v3.63 (onglet Rapport tabs[3]).
    html += renderFonctionCellule({
      titre: '📝 Rapports',
      sousTitre: 'Compte-rendu de match',
      statut: eqEng.length > 0 ? 'disponible' : 'a-venir',
      action: 'ouvrir-vue-rapport',
      multiEquipes: eqEng,
      eqNames: eqNames,
      evt: evt,
      sectionId: 'vue-rapport'
    });

    // Fonction #8 — Statistiques (deep-link vers pilotage.html?evenement_equipe=)
    //   v1.62 — La fonctionnalité Pilotage de saison EXISTE (pilotage.html,
    //   pt 62). On câble la vignette en miroir EXACT des autres (Vue terrain /
    //   Réseaux / Rapports) : statut adaptatif + action ouvrir-vue-statistiques
    //   + mécanisme multi-équipes. pilotage.html (étendu pt 65) accepte
    //   ?evenement_equipe=<id> et résout lui-même la compo de base.
    html += renderFonctionCellule({
      titre: '📊 Statistiques',
      sousTitre: 'Pilotage de saison',
      statut: eqEng.length > 0 ? 'disponible' : 'a-venir',
      action: 'ouvrir-vue-statistiques',
      multiEquipes: eqEng,
      eqNames: eqNames,
      evt: evt,
      sectionId: 'vue-statistiques'
    });

    html += '</div>';  // /grille-list
    html += '</div>';  // /grille-fonctions

    // ────────────────────────────────────────────────
    // (7) SOUS-SECTION #evt-phases-detail (si tournoi avec enfants)
    //     Préserve la valeur opérationnelle de l'ancien bloc « Phases du
    //     tournoi » v1.24. Scrollée depuis lien « voir le détail » N2.
    //     Regroupement par phase identique v1.24 (structure préservée).
    // ────────────────────────────────────────────────
    if (isTournoi && enfants.length > 0) {
      // v1.40 — Groupement par phase PUIS par ÉQUIPE (retour terrain :
      // savoir quelle équipe affronte quel adversaire). Sous chaque phase,
      // les matchs sont regroupés par equipe_id, avec un sous-titre
      // d'équipe (nom via eqNames, repli UUID). v1.39 fusionnait toutes
      // équipes confondues → on ne savait pas qui jouait quoi.
      const phases = [];
      const matchsByPhase = {};   // phase -> [matchs]
      enfants.forEach(function (phaseBox) {
        const p = phaseBox.phase_libelle || phaseBox.libelle || '(sans phase)';
        if (!matchsByPhase[p]) { matchsByPhase[p] = []; phases.push(p); }
        const matchsDeLaPhase = CHILDREN_BY_PARENT[phaseBox.id] || [];
        if (matchsDeLaPhase.length > 0) {
          matchsDeLaPhase.forEach(function (m) { matchsByPhase[p].push(m); });
        } else if (phaseBox.adversaire_nom
                   || (phaseBox.libelle || '').toLowerCase().indexOf('vs ') === 0) {
          matchsByPhase[p].push(phaseBox);
        }
      });
      // v1.59 — Map locale equipe_id → evenement_equipe.id (Voie A, actée
      // Manu pt 56) pour bâtir le lien direct « Suivez le match en live ».
      // Source : eqEng (= evt._equipesEngagees, getEquipesEngagees :
      // chaque ligne porte id=evenement_equipe.id et equipe_id=équipe).
      // 1 équipe = 1 engagement par tournoi (pas de doublon equipe_id),
      // donc la clé equipe_id est non ambiguë. Le match enfant porte
      // m.equipe_id (déjà utilisé pour le regroupement par équipe) → on
      // résout son evenement_equipe_id par cette map. Map vide / équipe
      // absente = pas de bouton (dégradation honnête, pas de lien mort).
      const _eqEngParEquipe = {};
      eqEng.forEach(function (eq) {
        if (eq && eq.equipe_id && eq.id) _eqEngParEquipe[eq.equipe_id] = eq.id;
      });
      html += '<div class="evt-fiche-section" id="evt-phases-detail">';
      html += '<div class="evt-fiche-section-title">📋 Phases du tournoi (détail)</div>';
      phases.forEach(function (phaseName) {
        html += '<div class="evt-fiche-phase-titre">📍 ' + escHtml(phaseName) + '</div>';
        const matchs = matchsByPhase[phaseName];
        if (!matchs || matchs.length === 0) {
          html += '<div class="evt-fiche-phase-row"><span style="flex:1;">'
            + '<em style="color:var(--ink-mute)">(aucun match)</em></span></div>';
          return;
        }
        // Regroupe les matchs de cette phase par équipe (ordre d'apparition).
        const eqOrder = [];
        const byEq = {};
        matchs.forEach(function (m) {
          const k = m.equipe_id || '_sans_equipe';
          if (!byEq[k]) { byEq[k] = []; eqOrder.push(k); }
          byEq[k].push(m);
        });
        eqOrder.forEach(function (eqKey) {
          // Sous-titre équipe (sauf si une seule équipe sans id → on
          // n'affiche pas de sous-titre superflu).
          const nomEq = (eqKey !== '_sans_equipe')
            ? (eqNames[eqKey] || eqKey)
            : null;
          const showEqHeader = nomEq && (eqOrder.length > 1 || eqKey !== '_sans_equipe');
          // v1.50 (n°7) — conteneur visuel par équipe : bordure gauche +
          // léger fond, pour séparer nettement M14-1 / M14-2 sous une phase.
          // Seulement quand il y a vraiment un en-tête équipe (multi-équipes).
          if (showEqHeader) {
            html += '<div class="evt-fiche-phase-equipe-bloc" '
              + 'style="border-left:3px solid var(--vert-pelouse); '
              + 'background:rgba(0,0,0,0.02); border-radius:0 6px 6px 0; '
              + 'margin:8px 0 8px 12px; padding:4px 0 4px 8px;">';
            html += '<div class="evt-fiche-phase-equipe" '
              + 'style="font-size:0.85em; font-weight:600; color:var(--vert-pelouse); '
              + 'margin:0 0 2px 6px;">' + escHtml(nomEq) + '</div>';
          }
          byEq[eqKey].forEach(function (child) {
            const heure = formatHeureOnly(child.date_debut);
            const childBadge = statutCompoBadge(child.compo_status_summary);
            const childLibStartsVs = (child.libelle || '').toLowerCase().indexOf('vs ') === 0;
            const advBlock = childLibStartsVs
              ? ''
              : (child.adversaire_nom
                  ? ' · vs ' + escHtml(child.adversaire_nom)
                  : ' · <em style="color:var(--ink-mute)">(adv. à déterminer)</em>');
            const isChildAnnule = child.etat === 'annule';
            // v1.59 — résolution evtEqId du match via la map équipe→engagement.
            const _childEvtEqId = (child.equipe_id && _eqEngParEquipe[child.equipe_id])
              ? _eqEngParEquipe[child.equipe_id]
              : null;
            html += '<div class="evt-fiche-phase-row">';
            html += '<span class="evt-fiche-phase-heure">' + escHtml(heure) + '</span>';
            html += '<span style="flex:1;">' + escHtml(child.libelle || '') + advBlock + '</span>';
            if (isChildAnnule) {
              html += '<span class="evt-card-badge evt-badge-annule evt-badge-sm">Annulé</span>';
            } else {
              html += '<span class="evt-card-badge evt-badge-' + childBadge.cls + ' evt-badge-sm">' + escHtml(childBadge.libelle) + '</span>';
              // v1.59 — Lien direct suivi coach. Affiché seulement si l'on
              // sait bâtir le lien (evtEqId résolu) : pas de bouton mort.
              if (_childEvtEqId) {
                html += '<button type="button" class="evt-btn evt-btn-live evt-badge-sm" '
                  + 'data-action="suivre-match-live" '
                  + 'data-evenement-equipe-id="' + escHtml(_childEvtEqId) + '" '
                  + 'data-match-id="' + escHtml(child.id) + '">'
                  + '<span class="evt-btn-live__dot" aria-hidden="true"></span>'
                  + 'Suivez le match en live</button>';
              }
            }
            html += '</div>';
          });
          if (showEqHeader) {
            html += '</div>';  // ferme evt-fiche-phase-equipe-bloc
          }
        });
      });
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // (8) BLOC LOGISTIQUE DÉPLACEMENT — préservé fonctionnel P2-E.3
    //     Handler logistique-from-fiche INVARIANT byte-identique.
    //     Position entre grille 8 liens et Actions (au lieu de bloc #5
    //     comme v1.24 — pas de changement comportemental).
    // ────────────────────────────────────────────────
    if (showLogistique) {
      html += '<div class="evt-fiche-section evt-fiche-collapsible">';
      html += '<div class="evt-fiche-section-title">🚐 Logistique déplacement <span class="evt-fiche-chevron">▶</span></div>';
      html += '<div class="evt-fiche-section-body">';
      if (hasLogistique) {
        const lg = evt.logistique_deplacement;
        const logRows = [
          ['Transport', lg.transport],
          ['Départ', lg.depart],
          ['Retour', lg.retour],
          ['Hébergement', lg.hebergement],
          ['Conducteurs', lg.conducteurs],
          ['Notes logistique', lg.notes_logistique]
        ].filter(function (kv) { return kv[1]; });
        if (logRows.length > 0) {
          logRows.forEach(function (kv) {
            html += '<div style="display:flex;gap:8px;padding:4px 0;font-size:13px;border-bottom:1px solid var(--paper-warm);">';
            html += '<div style="min-width:110px;font-family:\'JetBrains Mono\',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);padding-top:3px;">' + escHtml(kv[0]) + '</div>';
            html += '<div style="flex:1;color:var(--ink);">' + escHtml(kv[1]) + '</div>';
            html += '</div>';
          });
        } else {
          html += '<div class="evt-fiche-empty">Logistique renseignée mais vide.</div>';
        }
      } else {
        html += '<div class="evt-fiche-empty">Aucune logistique renseignée.</div>';
      }
      if (editableEtat) {
        html += '<div style="margin-top:8px;"><button type="button" class="evt-btn" data-action="logistique-from-fiche" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;">✏️ ' + (hasLogistique ? 'Modifier' : '+ Ajouter logistique') + '</button></div>';
      }
      html += '</div>';
      html += '</div>';
    } else if (editableEtat && evt.type_evenement === 'deplacement') {
      html += '<div class="evt-fiche-section">';
      html += '<button type="button" class="evt-btn" data-action="logistique-from-fiche" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;color:var(--ink-mute);">+ Ajouter logistique de déplacement</button>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // (9) ACTIONS §3.3 doc UX — Modifier / Dupliquer / Supprimer
    //     OU Réactiver si etat='annule'. Convention soft-delete projet
    //     préservée : « Supprimer » = handler cancel-from-fiche INVARIANT
    //     (etat='annule', scénario 5 modèle v1.1 « passé immuable »).
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-actions">';
    if (editableEtat) {
      html += '<button type="button" class="evt-btn evt-btn-primary" data-action="edit-from-fiche" data-event-id="' + escHtml(evt.id) + '">✏️ Modifier</button>';
      html += '<button type="button" class="evt-btn" data-action="notes-from-fiche" data-event-id="' + escHtml(evt.id) + '">📝 Notes</button>';
      html += '<button type="button" class="evt-btn" data-action="duplicate-from-fiche" data-event-id="' + escHtml(evt.id) + '">📋 Dupliquer</button>';
      html += '<div class="evt-fiche-actions-spacer"></div>';
      html += '<button type="button" class="evt-btn evt-btn-danger" data-action="cancel-from-fiche" data-event-id="' + escHtml(evt.id) + '">🗑 Supprimer</button>';
    } else if (evt.etat === 'annule') {
      html += '<button type="button" class="evt-btn evt-btn-primary" data-action="reactivate-from-fiche" data-event-id="' + escHtml(evt.id) + '">↩ Réactiver l\'évènement</button>';
    }
    html += '</div>';

    return html;
  }

  // ============================================================
  // v1.25 — Helper renderFonctionCellule (grille 8 liens §3.3)
  // ============================================================
  // Génère 1 cellule de la grille FONCTIONNALITÉS. Statut ∈ {disponible,
  // en-cours, a-venir}. Pour disponible : Compositions/Groupes adaptatifs
  // selon nombre d'équipes (Q4=C : 1→direct via handler INVARIANT, N→
  // expansion in-situ via expand-fonction qui réutilise les handlers
  // Niveau 0 byte-identiques pour chaque équipe). Encadrement : expansion
  // in-situ de la liste M8 détaillée (édition unifiée via Modifier).
  // Suivi : scroll ancre interne vers bloc (5) renderSuiviSection.
  // ============================================================
  function renderFonctionCellule(opts) {
    const statut = opts.statut || 'a-venir';
    const evtId  = (opts.evt && opts.evt.id) || '';
    const multi  = Array.isArray(opts.multiEquipes) ? opts.multiEquipes : null;
    const eqN    = (opts.eqNames && typeof opts.eqNames === 'object') ? opts.eqNames : {};

    let html = '<div class="evt-fiche-fonction evt-fiche-fonction-' + escHtml(statut) + '" data-fonction-section="' + escHtml(opts.sectionId || '') + '">';

    // Badge statut honnête (sauf disponible)
    let badgeLib = '';
    if (statut === 'en-cours') badgeLib = 'en cours';
    else if (statut === 'a-venir') badgeLib = 'à venir';
    if (badgeLib) {
      html += '<span class="evt-card-badge evt-badge-sm evt-fiche-fonction-badge">' + escHtml(badgeLib) + '</span>';
    }

    html += '<div class="evt-fiche-fonction-titre">' + opts.titre + '</div>';
    html += '<div class="evt-fiche-fonction-soustitre">' + escHtml(opts.sousTitre) + '</div>';

    // Statut disponible → mécanisme adaptatif
    if (statut === 'disponible') {
      // Compositions/Groupes multi-équipes adaptatif (Q4=C)
      if (multi && (opts.action === 'ouvrir-feuille-equipe' || opts.action === 'ouvrir-groupe-base' || opts.action === 'ouvrir-vue-terrain' || opts.action === 'ouvrir-vue-reseaux' || opts.action === 'ouvrir-vue-suivi' || opts.action === 'ouvrir-vue-rapport' || opts.action === 'ouvrir-vue-statistiques')) {
        if (multi.length === 1) {
          // 1 équipe → bouton direct (handler Niveau 0 INVARIANT)
          const eq = multi[0];
          html += '<button type="button" class="evt-btn evt-fiche-fonction-cta" data-action="' + escHtml(opts.action) + '" data-evenement-equipe-id="' + escHtml(eq.id) + '" data-event-id="' + escHtml(evtId) + '">Ouvrir →</button>';
        } else {
          // N équipes → expansion in-situ (handlers Niveau 0 réutilisés)
          html += '<button type="button" class="evt-btn evt-fiche-fonction-cta" data-action="expand-fonction" data-fonction-target="' + escHtml(opts.sectionId) + '" aria-expanded="false">Choisir l\'équipe ▼</button>';
          html += '<div class="evt-fiche-fonction-expand" id="evt-fiche-expand-' + escHtml(opts.sectionId) + '" hidden>';
          multi.forEach(function (eq) {
            const nomEq = eqN[eq.equipe_id] || eq.equipe_id || '(équipe)';
            const formatStr = eq.format_de_jeu ? ' · ' + escHtml(eq.format_de_jeu) : '';
            html += '<button type="button" class="evt-btn evt-fiche-fonction-expand-item" data-action="' + escHtml(opts.action) + '" data-evenement-equipe-id="' + escHtml(eq.id) + '" data-event-id="' + escHtml(evtId) + '">→ ' + escHtml(nomEq) + formatStr + '</button>';
          });
          html += '</div>';
        }
      }
      // Suivi : ancre interne scroll (conservé, plus utilisé par défaut)
      else if (opts.action === 'voir-suivi') {
        html += '<button type="button" class="evt-btn evt-fiche-fonction-cta" data-action="voir-suivi" data-event-id="' + escHtml(evtId) + '">Voir ci-dessous ↓</button>';
      }
      // Suivi : expansion in-situ — panneau d'accès (v1.56). Réutilise le
      // HTML de renderSuiviSection (générateur de lien, spectateur, revoir),
      // organisé par match simple ou par phase→match (tournoi).
      else if (opts.sectionId === 'suivi-acces') {
        html += '<button type="button" class="evt-btn evt-fiche-fonction-cta" data-action="expand-fonction" data-fonction-target="suivi-acces" aria-expanded="false">Accéder au suivi ▼</button>';
        html += '<div class="evt-fiche-fonction-expand" id="evt-fiche-expand-suivi-acces" hidden>';
        html += (opts.suiviInnerHtml || '<div class="evt-fiche-empty">Suivi indisponible.</div>');
        html += '</div>';
      }
      // Encadrement : expansion in-situ (liste détaillée M8)
      else if (opts.sectionId === 'encadrement') {
        const enc = Array.isArray(opts.encadrants) ? opts.encadrants : [];
        html += '<button type="button" class="evt-btn evt-fiche-fonction-cta" data-action="expand-fonction" data-fonction-target="encadrement" aria-expanded="false">Voir le détail ▼</button>';
        html += '<div class="evt-fiche-fonction-expand" id="evt-fiche-expand-encadrement" hidden>';
        if (enc.length === 0) {
          html += '<div class="evt-fiche-empty">Aucun encadrant.</div>';
        } else {
          html += '<ul class="evt-fiche-list">';
          enc.forEach(function (e) {
            const nomComplet = [e.prenom, e.nom].filter(Boolean).join(' ') || '(sans nom)';
            const roles = Array.isArray(e.roles_encadrement) ? e.roles_encadrement.join(', ') : '';
            html += '<li class="evt-fiche-list-item">';
            html += '<span class="evt-fiche-list-puce">•</span>';
            html += '<div class="evt-fiche-list-content">';
            html += '<div class="evt-fiche-list-name">' + escHtml(nomComplet) + '</div>';
            if (roles) html += '<div class="evt-fiche-list-meta">' + escHtml(roles) + '</div>';
            if (e.notes) html += '<div class="evt-fiche-list-meta">📝 ' + escHtml(e.notes) + '</div>';
            html += '</div>';
            html += '</li>';
          });
          html += '</ul>';
        }
        html += '<div class="evt-fiche-empty" style="font-size:11px;margin-top:6px;">Édition via « ✏️ Modifier » (rouvre la modale).</div>';
        html += '</div>';
      }
    }
    // Statut en-cours ou à-venir : grand bouton désactivé honnête
    else {
      const hint = opts.hintIndisponible;
      html += '<button type="button" class="evt-btn evt-fiche-fonction-cta" disabled' + (hint ? ' title="' + escHtml(hint) + '"' : '') + '>—</button>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Câble les actions internes de la fiche détaillée v1.25 (refonte
   * §3.3 doc UX FAIT FOI md5 4c8652d9). 12 handlers délégués :
   *   - 6 PRÉSERVÉS BYTE-IDENTIQUES v1.24 : cancel-from-fiche,
   *     reactivate-from-fiche, edit-from-fiche, logistique-from-fiche,
   *     ouvrir-groupe-base (Niveau 0), ouvrir-feuille-equipe (Niveau 0)
   *   - 6 NEUFS v1.25 : retour-calendrier, retour-parent,
   *     toggle-niveau-2, duplicate-from-fiche, voir-suivi,
   *     voir-phases-detail, expand-fonction
   *   - 6 RETIRÉS v1.24 (écart gouvernance E-5 acté STATE pt 20) :
   *     compos-from-fiche, notes-from-fiche, engager-equipe-from-fiche,
   *     retirer-equipe-from-fiche, ajouter-adversaire-from-fiche,
   *     retirer-adversaire-from-fiche
   * Appelé après chaque renderFiche pour rebrancher les listeners.
   * Toggle collapsible mobile (logistique) préservé byte-identique.
   * SUIVI-COACH-1 Objet A : bindSuiviActions() appelée en fin (INVARIANT).
   */
  function bindFicheActions() {
    // ── PRÉSERVÉ v1.24 : Annuler évènement (renommé « Supprimer » dans
    //    le label UI v1.25, handler INVARIANT cancel-from-fiche, convention
    //    soft-delete projet préservée → openModalCancel).
    document.querySelectorAll('[data-action="cancel-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalCancel(id);
      });
    });
    // ── PRÉSERVÉ v1.24 : Réactiver évènement (handler INVARIANT
    //    reactivate-from-fiche, byte-identique v1.24).
    document.querySelectorAll('[data-action="reactivate-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.getAttribute('data-event-id');
        if (!id) return;
        this.disabled = true;
        this.textContent = 'Réactivation…';
        try {
          const res = await SupabaseHub.reactivateEvenement(id);
          if (!res || !res.ok) {
            alert('Échec : ' + ((res && res.error) || 'erreur inconnue'));
            this.disabled = false;
            this.textContent = "↩ Réactiver l'évènement";
            return;
          }
          closeFiche();
          await reloadEvents();
          openFiche(id);
        } catch (err) {
          console.error('reactivate-from-fiche', err);
          alert('Erreur inattendue : ' + (err.message || err));
          this.disabled = false;
          this.textContent = "↩ Réactiver l'évènement";
        }
      });
    });
    // ── PRÉSERVÉ v1.24 (P2-E.2) : édition identité via modale L4 v2.
    //    Q3=B : édition unifiée — toutes les modifs M3/M5/M6/M8 passent
    //    désormais par ce handler (centre névralgique F-1 §3.3 doc UX).
    document.querySelectorAll('[data-action="edit-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        // « Modifier » rouvre désormais le MODAL DE CRÉATION pré-rempli
        // (édition complète : méta + horaires + équipes + phases + matchs +
        // encadrants), au lieu de l'ancien modal d'édition réduit aux méta.
        if (id) { closeFiche(); openModalEditComplet(id); }
      });
    });
    // ── RÉTABLI v1.52 : bouton « 📝 Notes » → modal de saisie dédié
    //    (openModalEditNotes). Le modal et sa chaîne submit existaient déjà
    //    (intacts) mais son bouton d'ouverture avait été retiré quand les
    //    Notes ont été absorbées en lecture dans le Niveau 2 → champ devenu
    //    orphelin en écriture. On ne ferme PAS la fiche (le modal notes se
    //    superpose puis rouvre la fiche après save).
    document.querySelectorAll('[data-action="notes-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalEditNotes(id);
      });
    });
    // ── NEUF v1.25 (§3.3 ACTIONS) : Dupliquer = rouvre modale création
    //    en mode Dupliquer avec présélection source = evt courant. Réutilise
    //    le mécanisme existant openModalCreate() + radio create_mode + DOM
    //    select evt-create-dup-source (P2-E.1 v1.5). closeFiche() avant
    //    pour éviter le double-overlay (la modale create est un overlay
    //    séparé, mais on ferme la fiche par cohérence ergonomique :
    //    l'utilisateur veut créer un nouvel évènement copié, pas continuer
    //    sur la fiche source).
    document.querySelectorAll('[data-action="duplicate-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const srcId = this.getAttribute('data-event-id');
        if (!srcId) return;
        closeFiche();
        openModalCreate();
        // Bascule mode dupliquer (radio + déclenchement change pour
        // afficher dupGroup via le handler v1.24 bindEvents existant).
        const radioDup = document.querySelector('#evt-create-form input[name=create_mode][value=dupliquer]');
        if (radioDup) {
          radioDup.checked = true;
          radioDup.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Présélection de la source (déclenche prefillFormFromSource via
        // le handler change v1.24 bindEvents existant).
        const dupSel = document.getElementById('evt-create-dup-source');
        if (dupSel) {
          dupSel.value = srcId;
          dupSel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
    // ── NEUF v1.25 (§3.2 F-4) : Retour au calendrier = ferme l'overlay
    //    fiche, retour à la liste évènements. Remplace l'ancien
    //    « Retour aux compositions » (Q5=A acté).
    document.querySelectorAll('[data-action="retour-calendrier"]').forEach(btn => {
      btn.addEventListener('click', function () {
        closeFiche();
      });
    });
    // ── NEUF v1.25 (§3.2) : Retour parent contextuel = navigation
    //    enfant→tournoi parent. Préserve la valeur de l'ancien bloc
    //    « Rattaché à » v1.24 (sous forme de bouton header).
    document.querySelectorAll('[data-action="retour-parent"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const parentId = this.getAttribute('data-parent-id');
        if (!parentId) return;
        closeFiche();
        openFiche(parentId);
      });
    });
    // EVT-SERIE-ECRAN — ouvrir la modale « voir la série » depuis la mère.
    document.querySelectorAll('[data-action="voir-serie"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const mereId = this.getAttribute('data-mere-id');
        if (!mereId) return;
        ouvrirModaleSerie(mereId);
      });
    });
    // EVT-RECURRENCE-OCCURRENCES — supprimer une séance (occurrence) : purge
    // l'enfant + exclut sa date de la série (anti-régénération). Confirmation
    // explicite (action destructive).
    document.querySelectorAll('[data-action="supprimer-occurrence"]').forEach(btn => {
      btn.addEventListener('click', async function () {
        const occId = this.getAttribute('data-occurrence-id');
        if (!occId) return;
        if (!window.confirm('Supprimer cette séance ? Elle ne réapparaîtra pas dans la série. Les autres séances sont conservées.')) {
          return;
        }
        this.disabled = true;
        try {
          const res = await SupabaseHub.supprimerOccurrenceEvenement(occId);
          if (!res || !res.ok) {
            window.alert('Suppression impossible : ' + ((res && res.error) || 'erreur inconnue'));
            this.disabled = false;
            return;
          }
          closeFiche();
          await reloadEvents();
        } catch (e) {
          console.error('supprimer-occurrence', e);
          window.alert('Suppression impossible (erreur technique).');
          this.disabled = false;
        }
      });
    });
    // ── NEUF v1.25 (§3.2 chevron) : Toggle Niveau 2 dépliable.
    //    Bascule attribut hidden + aria-expanded + classe chevron pour
    //    rotation visuelle (CSS .evt-fiche-chevron-n2.is-open).
    document.querySelectorAll('[data-action="toggle-niveau-2"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const body = document.getElementById('evt-fiche-n2-body');
        if (!body) return;
        const isOpen = !body.hasAttribute('hidden');
        if (isOpen) {
          body.setAttribute('hidden', '');
          this.setAttribute('aria-expanded', 'false');
        } else {
          body.removeAttribute('hidden');
          this.setAttribute('aria-expanded', 'true');
        }
        const chev = this.querySelector('.evt-fiche-chevron-n2');
        if (chev) chev.classList.toggle('is-open', !isOpen);
      });
    });
    // ── NEUF v1.25 (§3.3 lien #2) : Ancre interne vers bloc Suivi de
    //    rencontre (id="evt-suivi-rencontre" wrappant
    //    renderSuiviSection INVARIANT).
    document.querySelectorAll('[data-action="voir-suivi"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const target = document.getElementById('evt-suivi-rencontre');
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    // ── NEUF v1.25 (§3.2 N2 lien) : Ancre interne vers sous-section
    //    Phases du tournoi détail (id="evt-phases-detail").
    document.querySelectorAll('[data-action="voir-phases-detail"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const target = document.getElementById('evt-phases-detail');
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    // v1.40 (n°3) — Bannière « prochaine étape » : scrolle vers la vignette
    // Groupes de base (data-fonction-section="groupes") et la met en
    // évidence brièvement. Réutilise la cellule existante, ne la duplique pas.
    document.querySelectorAll('[data-action="focus-groupe-base"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const cell = document.querySelector('[data-fonction-section="groupes"]');
        if (cell && cell.scrollIntoView) {
          cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
          cell.classList.add('evt-card-highlight');
          setTimeout(function () { cell.classList.remove('evt-card-highlight'); }, 1500);
        }
      });
    });
    // ── NEUF v1.25 (§3.3 Q4=C) : Expansion in-situ d'une cellule de la
    //    grille 8 liens (Compositions/Groupes multi-équipes, Encadrement).
    //    Bascule attribut hidden + aria-expanded du conteneur
    //    #evt-fiche-expand-{target}. Réutilise les handlers Niveau 0
    //    INVARIANTS ouvrir-groupe-base/ouvrir-feuille-equipe pour chaque
    //    item-équipe de l'expansion (cf. renderFonctionCellule).
    document.querySelectorAll('[data-action="expand-fonction"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const targetId = this.getAttribute('data-fonction-target');
        if (!targetId) return;
        const panel = document.getElementById('evt-fiche-expand-' + targetId);
        if (!panel) return;
        const isOpen = !panel.hasAttribute('hidden');
        if (isOpen) {
          panel.setAttribute('hidden', '');
          this.setAttribute('aria-expanded', 'false');
        } else {
          panel.removeAttribute('hidden');
          this.setAttribute('aria-expanded', 'true');
        }
      });
    });
    // ── PRÉSERVÉ v1.22 BYTE-IDENTIQUE : accès U-N2 « Groupe de base ».
    //    Réutilisé byte-identique dans la grille 8 liens v1.25
    //    (Compositions cellule + Groupes cellule, cf. renderFonctionCellule
    //    Q4=C). Navigation pure ?evenement_equipe=<id> = SD-1 (a).
    document.querySelectorAll('[data-action="ouvrir-groupe-base"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'groupe-base.html?evenement_equipe=' + encodeURIComponent(evtEqId);
        }
      });
    });
    // ── PRÉSERVÉ v1.23 BYTE-IDENTIQUE : accès U-N3 « Feuille de match ».
    //    Miroir byte-identique de ouvrir-groupe-base (seule diff = cible
    //    compositions.html). Réutilisé v1.25 dans la grille 8 liens
    //    (Compositions cellule, cf. renderFonctionCellule Q4=C).
    document.querySelectorAll('[data-action="ouvrir-feuille-equipe"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'compositions.html?evenement_equipe=' + encodeURIComponent(evtEqId);
        }
      });
    });
    // ── v1.55 : Vue terrain — miroir de ouvrir-feuille-equipe + &vue=terrain.
    //    compositions-editor.js v3.25 lit ?vue=terrain au boot et bascule
    //    directement sur l'onglet Terrain (compo courante déjà chargée).
    document.querySelectorAll('[data-action="ouvrir-vue-terrain"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'compositions.html?evenement_equipe=' + encodeURIComponent(evtEqId) + '&vue=terrain';
        }
      });
    });
    // ── v1.55 : Vue réseaux sociaux — miroir + &vue=reseaux. v3.25 lit
    //    ?vue=reseaux au boot et ouvre la modale d'export image.
    document.querySelectorAll('[data-action="ouvrir-vue-reseaux"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'compositions.html?evenement_equipe=' + encodeURIComponent(evtEqId) + '&vue=reseaux';
        }
      });
    });
    // ── v1.61 : Vue Rapport (tuile « 📝 Rapports ») — miroir EXACT de
    //    ouvrir-vue-reseaux + &vue=rapport. La fonctionnalité Rapports vit
    //    dans l'onglet « Rapport » de l'éditeur (compositions.html, pt 53-55) ;
    //    le deep-link &vue=rapport est capté au boot par compositions-editor
    //    v3.63 (onglet Rapport tabs[3]). Pour une compo de BASE, l'onglet
    //    Rapport agrège tournoi + phases ; pour une compo de match, le rapport
    //    de match. L'éditeur choisit selon l'onglet actif (comportement pt 55).
    document.querySelectorAll('[data-action="ouvrir-vue-rapport"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'compositions.html?evenement_equipe=' + encodeURIComponent(evtEqId) + '&vue=rapport';
        }
      });
    });
    // ── v1.62 : Vue Statistiques (tuile « 📊 Statistiques ») — miroir EXACT
    //    de ouvrir-vue-rapport, cible pilotage.html. Le pilotage de saison
    //    vit dans pilotage.html (pt 62) ; étendu pt 65 pour accepter
    //    ?evenement_equipe=<id> (résolution interne vers la compo de base via
    //    getCompoForEvenementEquipe). Pilotage de l'ÉQUIPE de cet évènement.
    document.querySelectorAll('[data-action="ouvrir-vue-statistiques"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'pilotage.html?evenement_equipe=' + encodeURIComponent(evtEqId);
        }
      });
    });
    // ── v1.60 : Vue Suivi (tuile « ⏱ Suivi ») — miroir de ouvrir-vue-
    //    terrain + &vue=suivi. Pour un match SIMPLE (pas un tournoi), le
    //    match = l'évènement lui-même → on ajoute &match=<evt.id> pour que
    //    l'éditeur ouvre directement la feuille de match sur l'onglet Suivi
    //    (compositions-editor v3.60 lit match/vue=suivi au boot). Pour un
    //    tournoi, pas de &match (le coach choisit l'onglet de match, ou
    //    utilise les boutons « Suivez le match en live » des Phases).
    document.querySelectorAll('[data-action="ouvrir-vue-suivi"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (!evtEqId) return;
        let url = 'compositions.html?evenement_equipe=' + encodeURIComponent(evtEqId) + '&vue=suivi';
        // Match simple : cibler le match (= l'évènement courant de la fiche).
        if (FICHE_EVT_COURANT && !estEvtAPhases(FICHE_EVT_COURANT) && FICHE_EVT_COURANT.id) {
          url += '&match=' + encodeURIComponent(FICHE_EVT_COURANT.id);
        }
        window.location.href = url;
      });
    });
    // ── v1.59 : « Suivez le match en live » — 4e miroir des ouvrir-vue-*.
    //    Cible un MATCH précis + l'onglet Suivi. compositions-editor.js
    //    v3.60 lit ?match=<id> (sélectionne la compo de match dont
    //    evenement_id===<id>) et ?vue=suivi (active l'onglet Suivi) au boot.
    document.querySelectorAll('[data-action="suivre-match-live"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        const matchId = this.getAttribute('data-match-id');
        if (evtEqId && matchId) {
          window.location.href = 'compositions.html?evenement_equipe=' + encodeURIComponent(evtEqId)
            + '&match=' + encodeURIComponent(matchId) + '&vue=suivi';
        }
      });
    });
    // ── PRÉSERVÉ v1.24 (P2-E.5) : toggle collapsible mobile pour le
    //    bloc Logistique déplacement v1.25 (#8). Les autres collapsibles
    //    v1.24 (Équipes engagées, Équipes & compositions Niveau 0,
    //    Encadrants, Notes internes) ont été absorbés dans la bannière
    //    2 niveaux + grille 8 liens v1.25, seul Logistique reste
    //    collapsible séparé.
    document.querySelectorAll('.evt-fiche-collapsible .evt-fiche-section-title').forEach(title => {
      title.addEventListener('click', function () {
        this.closest('.evt-fiche-collapsible').classList.toggle('is-open');
      });
    });
    // ── PRÉSERVÉ v1.24 (P2-E.3) : bouton édition logistique (handler
    //    logistique-from-fiche INVARIANT). Bloc Logistique v1.25 utilise
    //    le même handler byte-identique.
    document.querySelectorAll('[data-action="logistique-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalLogistique(id);
      });
    });
    // ── PRÉSERVÉ v1.8+ : SUIVI-COACH-1 Objet A actions de la section
    //    Suivi (bloc 5 renderFiche v1.25 — INVARIANT byte-identique
    //    renderSuiviSection md5 aa631ebe...).
    bindSuiviActions();
  }

  // ────────────────────────────────────────────────
  // E6 — Modale Édition événement (P2-E.2)
  // ────────────────────────────────────────────────

  let MODAL_EDIT_EVENT_ID = null;

  function populateEditSitesDropdown() {
    const sel = document.getElementById('evt-edit-site');
    if (!sel) return;
    let html = '<option value="">— Choisir un site —</option>';
    SITES.forEach(s => {
      const lib = s.libelle_court || s.libelle || '(sans nom)';
      html += '<option value="' + escHtml(s.id) + '">' + escHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
  }

  function openModalEdit(evenementId) {
    if (!evenementId) return;
    MODAL_EDIT_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];
    if (!evt) return;

    const msg = document.getElementById('evt-edit-msg');
    if (msg) msg.innerHTML = '';
    const info = document.getElementById('evt-edit-info');
    if (info) {
      const typeLbl = TYPE_LABELS[evt.type_evenement] || evt.type_evenement;
      info.innerHTML = '<span class="evt-modal-info-strong">' + escHtml(typeLbl) + '</span> · '
        + escHtml(evt.libelle || '(sans libellé)');
    }

    // Peuple le dropdown sites
    populateEditSitesDropdown();

    // Pré-remplissage des champs
    const f = document.getElementById('evt-edit-form');
    if (!f) return;

    f.elements.libelle.value = evt.libelle || '';

    // Date début : convertir ISO → datetime-local (YYYY-MM-DDTHH:MM)
    if (evt.date_debut) {
      try {
        const d = new Date(evt.date_debut);
        const pad = (n) => String(n).padStart(2, '0');
        f.elements.date_debut.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      } catch (_) {}
    }
    if (evt.date_fin) {
      try {
        const d = new Date(evt.date_fin);
        const pad = (n) => String(n).padStart(2, '0');
        f.elements.date_fin.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      } catch (_) {}
    }

    if (f.elements.domicile_exterieur) f.elements.domicile_exterieur.value = evt.domicile_exterieur || '';
    if (f.elements.site_id) f.elements.site_id.value = evt.site_id || '';
    if (f.elements.type_competition) f.elements.type_competition.value = evt.type_competition || '';
    if (f.elements.format_de_jeu) f.elements.format_de_jeu.value = evt.format_de_jeu || '';
    if (f.elements.adversaire_nom) f.elements.adversaire_nom.value = evt.adversaire_nom || '';

    // Affichage conditionnel compet/format selon type
    const showCompet = ['match', 'tournoi', 'journee_championnat'].indexOf(evt.type_evenement) !== -1;
    const showFormat = showCompet;
    const showDateFin = ['tournoi', 'stage'].indexOf(evt.type_evenement) !== -1;
    const competGroup = document.getElementById('evt-edit-compet-group');
    const formatGroup = document.getElementById('evt-edit-format-group');
    const dateFinGroup = document.getElementById('evt-edit-date-fin-group');
    if (competGroup) competGroup.style.display = showCompet ? '' : 'none';
    if (formatGroup) formatGroup.style.display = showFormat ? '' : 'none';
    if (dateFinGroup) dateFinGroup.style.display = showDateFin ? '' : 'none';

    // Reset submit button
    const btn = document.getElementById('evt-edit-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

    document.getElementById('evt-overlay-edit').classList.add('show');
  }

  function closeModalEdit() {
    MODAL_EDIT_EVENT_ID = null;
    document.getElementById('evt-overlay-edit').classList.remove('show');
  }

  async function submitModalEdit() {
    if (!MODAL_EDIT_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-edit-submit');
    const msg = document.getElementById('evt-edit-msg');
    if (!submitBtn || !msg) return;

    const f = document.getElementById('evt-edit-form');
    if (!f) return;

    const libelle = f.elements.libelle.value.trim();
    const dateDebut = f.elements.date_debut.value;

    if (!libelle) { msg.innerHTML = '<div class="evt-form-error">Le libellé est requis</div>'; return; }
    if (!dateDebut) { msg.innerHTML = '<div class="evt-form-error">La date de début est requise</div>'; return; }

    const patch = {
      libelle: libelle,
      date_debut: new Date(dateDebut).toISOString()
    };
    const dateFin = f.elements.date_fin.value;
    if (dateFin) patch.date_fin = new Date(dateFin).toISOString();
    else patch.date_fin = null;

    const siteId = f.elements.site_id.value;
    patch.site_id = siteId || null;
    const typeCompet = f.elements.type_competition.value;
    patch.type_competition = typeCompet || null;
    const formatJeu = f.elements.format_de_jeu.value;
    patch.format_de_jeu = formatJeu || null;
    const adversaire = f.elements.adversaire_nom.value.trim();
    patch.adversaire_nom = adversaire || null;
    const domicile = f.elements.domicile_exterieur.value;
    patch.domicile_exterieur = domicile || null;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.updateEvenement(MODAL_EDIT_EVENT_ID, patch);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const mb = document.querySelector('#evt-overlay-edit .evt-modal-body');
        if (mb) mb.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement mis à jour.</div>';
      const mb = document.querySelector('#evt-overlay-edit .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      const evtId = MODAL_EDIT_EVENT_ID;
      setTimeout(async () => {
        closeModalEdit();
        closeFiche();
        await reloadEvents();
        openFiche(evtId);
      }, 500);
    } catch (err) {
      console.error('submitModalEdit', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur : ' + escHtml(err.message || String(err)) + '</div>';
      const mb = document.querySelector('#evt-overlay-edit .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  }

  // ────────────────────────────────────────────────
  // E7 — Modale Édition notes internes (P2-E.2)
  // ────────────────────────────────────────────────

  let MODAL_NOTES_EVENT_ID = null;

  function openModalEditNotes(evenementId) {
    if (!evenementId) return;
    MODAL_NOTES_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];

    const msg = document.getElementById('evt-notes-msg');
    if (msg) msg.innerHTML = '';
    const info = document.getElementById('evt-notes-info');
    if (info && evt) {
      info.innerHTML = '<span class="evt-modal-info-strong">' + escHtml(evt.libelle || '(sans libellé)') + '</span>';
    }
    const textarea = document.getElementById('evt-notes-texte');
    if (textarea) textarea.value = (evt && evt.notes_internes) || '';

    const btn = document.getElementById('evt-notes-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

    document.getElementById('evt-overlay-notes').classList.add('show');
  }

  function closeModalEditNotes() {
    MODAL_NOTES_EVENT_ID = null;
    document.getElementById('evt-overlay-notes').classList.remove('show');
  }

  async function submitModalEditNotes() {
    if (!MODAL_NOTES_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-notes-submit');
    const msg = document.getElementById('evt-notes-msg');
    if (!submitBtn || !msg) return;

    const textarea = document.getElementById('evt-notes-texte');
    const notes = textarea ? textarea.value.trim() : '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.updateEvenement(MODAL_NOTES_EVENT_ID, {
        notes_internes: notes || null
      });
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const mb = document.querySelector('#evt-overlay-notes .evt-modal-body');
        if (mb) mb.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Notes mises à jour.</div>';
      const mb = document.querySelector('#evt-overlay-notes .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      const evtId = MODAL_NOTES_EVENT_ID;
      setTimeout(async () => {
        closeModalEditNotes();
        closeFiche();
        await reloadEvents();
        openFiche(evtId);
      }, 500);
    } catch (err) {
      console.error('submitModalEditNotes', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur : ' + escHtml(err.message || String(err)) + '</div>';
      const mb = document.querySelector('#evt-overlay-notes .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  }

  // ────────────────────────────────────────────────
  // E8 — Modale Édition logistique (P2-E.3)
  // ────────────────────────────────────────────────

  let MODAL_LOGISTIQUE_EVENT_ID = null;

  function openModalLogistique(evenementId) {
    if (!evenementId) return;
    MODAL_LOGISTIQUE_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];

    const msg = document.getElementById('evt-logistique-msg');
    if (msg) msg.innerHTML = '';
    const info = document.getElementById('evt-logistique-info');
    if (info && evt) {
      info.innerHTML = '<span class="evt-modal-info-strong">' + escHtml(evt.libelle || '(sans libellé)') + '</span>';
    }

    const f = document.getElementById('evt-logistique-form');
    if (f) {
      f.reset();
      const lg = (evt && evt.logistique_deplacement && typeof evt.logistique_deplacement === 'object')
        ? evt.logistique_deplacement : {};
      f.elements.transport.value = lg.transport || '';
      f.elements.depart.value = lg.depart || '';
      f.elements.retour.value = lg.retour || '';
      f.elements.hebergement.value = lg.hebergement || '';
      f.elements.conducteurs.value = lg.conducteurs || '';
      f.elements.notes_logistique.value = lg.notes_logistique || '';
    }

    const btn = document.getElementById('evt-logistique-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

    document.getElementById('evt-overlay-logistique').classList.add('show');
  }

  function closeModalLogistique() {
    MODAL_LOGISTIQUE_EVENT_ID = null;
    document.getElementById('evt-overlay-logistique').classList.remove('show');
  }

  async function submitModalLogistique() {
    if (!MODAL_LOGISTIQUE_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-logistique-submit');
    const msg = document.getElementById('evt-logistique-msg');
    if (!submitBtn || !msg) return;

    const f = document.getElementById('evt-logistique-form');
    if (!f) return;

    // Construire le JSONB (champs non vides uniquement)
    const payload = {};
    ['transport', 'depart', 'retour', 'hebergement', 'conducteurs', 'notes_logistique'].forEach(key => {
      const val = (f.elements[key].value || '').trim();
      if (val) payload[key] = val;
    });

    // Si tout vide → envoyer null (supprimer la logistique)
    const jsonbPayload = Object.keys(payload).length > 0 ? payload : null;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.updateLogistique(MODAL_LOGISTIQUE_EVENT_ID, jsonbPayload);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const mb = document.querySelector('#evt-overlay-logistique .evt-modal-body');
        if (mb) mb.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Logistique mise à jour.</div>';
      const mb = document.querySelector('#evt-overlay-logistique .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      const evtId = MODAL_LOGISTIQUE_EVENT_ID;
      setTimeout(async () => {
        closeModalLogistique();
        closeFiche();
        await reloadEvents();
        openFiche(evtId);
      }, 500);
    } catch (err) {
      console.error('submitModalLogistique', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur : ' + escHtml(err.message || String(err)) + '</div>';
      const mb = document.querySelector('#evt-overlay-logistique .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  }

  // ============================================================
  // 7. MODALES E3 / E4 / E5 (S2.4.b — câblage complet)
  // ============================================================

  // ────────────────────────────────────────────────
  // Récupération du contexte (saison + organisateur + sites)
  // ────────────────────────────────────────────────

  /**
   * Récupère dynamiquement saison_id + organisateur_principal_id depuis
   * le prochain évent M14 en base. Évite tout hardcode (doctrine
   * anti-invention). Charge aussi la liste des sites actifs pour le
   * dropdown des modales.
   */
  async function loadModalContext() {
    try {
      // 1. Saison = saison ACTIVE (plus de dérivation depuis le dernier
      // événement M14). Organisateur = personne courante (celle qui crée).
      // EVT-RATTACHEMENT-CATEGORIE : contexte indépendant de toute équipe.
      if (window.SupabaseHub && typeof SupabaseHub.getSaisonActive === 'function') {
        try {
          const saison = await SupabaseHub.getSaisonActive();
          if (saison && saison.id) {
            CTX_SAISON_ID = saison.id;
            console.log('Modal context : saison active =', CTX_SAISON_ID);
          }
        } catch (e) {
          console.warn('loadModalContext() getSaisonActive', e);
        }
      }
      if (window.SupabaseHub && typeof SupabaseHub.quiSuisJe === 'function') {
        try {
          const pid = await SupabaseHub.quiSuisJe();  // renvoie directement l'UUID (ou null)
          if (pid) {
            CTX_ORGANISATEUR_ID = pid;
            console.log('Modal context : organisateur =', CTX_ORGANISATEUR_ID);
          }
        } catch (e) {
          console.warn('loadModalContext() quiSuisJe', e);
        }
      }

      // Repli historique (si saison active ou identité indisponibles) :
      // lecture du dernier événement connu, sans filtre équipe figé.
      if ((!CTX_SAISON_ID || !CTX_ORGANISATEUR_ID)
          && window.SupabaseHub && SupabaseHub.client) {
        const { data, error } = await SupabaseHub.client
          .from('evenements')
          .select('saison_id, organisateur_principal_id')
          .order('date_debut', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          if (!CTX_SAISON_ID) CTX_SAISON_ID = data.saison_id;
          if (!CTX_ORGANISATEUR_ID) CTX_ORGANISATEUR_ID = data.organisateur_principal_id;
          console.log('Modal context (repli) : saison=', CTX_SAISON_ID, 'organisateur=', CTX_ORGANISATEUR_ID);
        } else if (error) {
          console.warn('loadModalContext() lecture saison/organisateur', error);
        }
      }

      // Catégorie du contexte modal = catégorie ACTIVE du sélecteur
      // (chantier EVT-RATTACHEMENT-CATEGORIE). Sert au filtrage du staff
      // (peuplerStaff → listStaffDisponibles) et au Bloc 4a. Plus de
      // dérivation depuis M14_TEAM_UUID figé. Défensif : un périmètre
      // absent laisse CTX_CATEGORIE_ID à null (le staff en mode catégorie
      // affichera une erreur honnête, jamais une case fantôme).
      if (CTX_PERIMETRE && CTX_PERIMETRE.active) {
        CTX_CATEGORIE_ID = CTX_PERIMETRE.active;
        console.log('Modal context : categorie=', CTX_CATEGORIE_ID);
      } else {
        console.warn('loadModalContext() : aucune catégorie active dans le périmètre');
      }

      // 2. Sites actifs pour le dropdown
      if (window.SupabaseHub && typeof SupabaseHub.listSitesActifs === 'function') {
        const sites = await SupabaseHub.listSitesActifs();
        SITES = Array.isArray(sites) ? sites : [];
        console.log('Modal context :', SITES.length, 'site(s) actif(s) chargé(s)');
      } else {
        console.warn('loadModalContext() : listSitesActifs indisponible (v1.8.1+ requis)');
      }

      // 3. Peuplement du dropdown sites dans la modale E3
      populateSitesDropdown();

    } catch (err) {
      console.error('loadModalContext() erreur', err);
    }
  }

  /** Peuple le <select> sites dans la modale E3 */
  function populateSitesDropdown() {
    const sel = document.getElementById('evt-create-site');
    if (!sel) return;
    // Conserve l'option "— Choisir —" en tête
    let html = '<option value="">— Choisir un site —</option>';
    SITES.forEach(s => {
      const lib = s.libelle_court || s.libelle || '(sans nom)';
      html += '<option value="' + escHtml(s.id) + '">' + escHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
  }

  // ────────────────────────────────────────────────
  // E3 — Modale Création
  // ────────────────────────────────────────────────

  // P2-E.1 : état duplication
  let MODAL_CREATE_DUP_SRC_ID = null;
  // Édition complète : id de l'évènement en cours d'édition (null = création)
  let MODAL_CREATE_EDIT_ID = null;

  /**
   * Peuple le dropdown source duplication dans E3 (événements parents uniquement,
   * triés par date décroissante pour trouver vite le dernier événement similaire).
   */
  function populateDupSourceDropdown() {
    const sel = document.getElementById('evt-create-dup-source');
    if (!sel) return;
    const allRoots = EVENEMENTS_AVENIR.concat(EVENEMENTS_PASSES)
      .filter(e => !e.evenement_parent_id)
      .sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || ''));
    let html = '<option value="">— Sélectionner l\'événement à dupliquer —</option>';
    allRoots.forEach(e => {
      const dateLib = formatDateShort(e.date_debut);
      const typeLbl = TYPE_LABELS[e.type_evenement] || e.type_evenement;
      const lib = dateLib + ' · ' + typeLbl + ' · ' + (e.libelle || '(sans libellé)');
      html += '<option value="' + escHtml(e.id) + '">' + escHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
  }

  /**
   * Pré-remplit le formulaire E3 depuis un événement source (pour duplication).
   * Ne touche PAS au code (auto-généré au submit) ni à la date (l'utilisateur
   * choisira la nouvelle date).
   */
  function prefillFormFromSource(srcId) {
    const evt = EVENTS_BY_ID[srcId];
    if (!evt) return;
    const f = document.getElementById('evt-create-form');
    if (!f) return;

    // Type
    const radioType = f.querySelector('input[name=type_evenement][value="' + evt.type_evenement + '"]');
    if (radioType) radioType.checked = true;
    updateCreateConditionalFields();

    // Libellé (sans le suffixe " (copie)" — le wrapper l'ajoutera si nécessaire)
    f.elements.libelle.value = evt.libelle || '';

    // Site
    if (f.elements.site_id && evt.site_id) {
      f.elements.site_id.value = evt.site_id;
    }
    // Compétition
    if (f.elements.type_competition && evt.type_competition) {
      f.elements.type_competition.value = evt.type_competition;
    }
    // Format de jeu
    if (f.elements.format_de_jeu && evt.format_de_jeu) {
      f.elements.format_de_jeu.value = evt.format_de_jeu;
    }
    // Adversaire
    if (f.elements.adversaire_nom) {
      f.elements.adversaire_nom.value = evt.adversaire_nom || '';
    }
    // Domicile/Extérieur
    if (f.elements.domicile_exterieur && evt.domicile_exterieur) {
      f.elements.domicile_exterieur.value = evt.domicile_exterieur;
    }
    // Date début : on laisse vide (la nouvelle date est à choisir)
    // Date fin : idem
  }

  function openModalCreate() {
    // Réinitialise le form
    const form = document.getElementById('evt-create-form');
    if (form) form.reset();
    // Coche par défaut "entrainement"
    const radioEntr = form && form.querySelector('input[name=type_evenement][value=entrainement]');
    if (radioEntr) radioEntr.checked = true;

    // P2-E.1 : reset mode duplication → vierge
    MODAL_CREATE_DUP_SRC_ID = null;
    const radioVierge = form && form.querySelector('input[name=create_mode][value=vierge]');
    if (radioVierge) radioVierge.checked = true;
    const dupGroup = document.getElementById('evt-create-dup-group');
    if (dupGroup) dupGroup.style.display = 'none';

    // Peuple le dropdown source pour la duplication
    populateDupSourceDropdown();

    updateCreateConditionalFields();
    const msg = document.getElementById('evt-create-msg');
    if (msg) msg.innerHTML = '';

    // Fix P2-E.1 : reset état du bouton submit (hors <form>, pas touché par form.reset())
    const submitBtn = document.getElementById('evt-create-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Créer l'évènement";
    }
    // Reset titre + mode édition (anti-résidu après une édition précédente).
    // NB : openModalEditComplet rappelle openModalCreate puis repose ces
    // valeurs en mode édition — l'ordre est donc correct.
    const titleEl0 = document.getElementById('evt-create-title');
    if (titleEl0) titleEl0.textContent = 'Nouvel évènement';
    MODAL_CREATE_EDIT_ID = null;

    // v1.16 — reset des zones répétables U1/U2 (form.reset() ne vide
    // pas le DOM injecté). Anti-résidu entre 2 ouvertures de modale.
    const advLines = document.getElementById('evt-create-adv-lines');
    if (advLines) advLines.innerHTML = '';
    const phasesList = document.getElementById('evt-create-phases-list');
    if (phasesList) phasesList.innerHTML = '';
    const formatLines = document.getElementById('evt-create-format-lines');
    if (formatLines) formatLines.innerHTML = '';
    // 4c démarre avec 1 ligne adversaire (patron unique, UX §2.4/4c).
    addAdversaireRow('');

    document.getElementById('evt-overlay-create').classList.add('show');
  }

  function closeModalCreate() {
    document.getElementById('evt-overlay-create').classList.remove('show');
    MODAL_CREATE_EDIT_ID = null;  // toujours réinitialiser le mode édition
  }

  // ────────────────────────────────────────────────────────────────
  // ÉDITION COMPLÈTE — « Modifier » rouvre le MODAL DE CRÉATION pré-rempli
  // (objectif produit Manu). Réutilise toute la richesse du formulaire de
  // création ; au submit, submitModalCreate bascule sur modifierEvenement-
  // Complet (RPC sql/53) car MODAL_CREATE_EDIT_ID est posé.
  // ────────────────────────────────────────────────────────────────
  async function openModalEditComplet(evtId) {
    const evt = EVENTS_BY_ID[evtId];
    if (!evt) { console.error('openModalEditComplet : évènement introuvable', evtId); return; }

    // EVT-EDITION-READBACK — READ-BACK FRAIS avant pré-cochage.
    //   L'objet `evt` provient d'EVENTS_BY_ID, peuplé par les LISTINGS
    //   (get_evenements_a_venir/passes) qui NE portent NI `encadrants` NI les
    //   équipes engagées. Résultat historique : à la réouverture de l'édition,
    //   les cases « staff » et « équipe engagée » ressortaient DÉCOCHÉES alors
    //   que les liaisons EXISTENT en base (evenement_encadrants +
    //   evenement_equipes_engagees) — bug d'affichage, PAS de perte de données.
    //   On enrichit donc `evt` ici, comme le fait déjà openFiche : (1)
    //   getEvenementWithEncadrants → `encadrants` (jsonb, clé personne_id) ;
    //   (2) getEquipesEngagees → équipes engagées RÉELLES (source
    //   evenement_equipes_engagees, indépendante des phases enfants → couvre le
    //   match simple sans phase). Non bloquant : tout échec = repli honnête
    //   (on garde ce que le cache portait), jamais un faux.
    try {
      if (window.SupabaseHub
          && typeof SupabaseHub.getEvenementWithEncadrants === 'function') {
        const _frais = await SupabaseHub.getEvenementWithEncadrants(evtId);
        if (_frais && Array.isArray(_frais.encadrants)) {
          evt.encadrants = _frais.encadrants;
        }
      }
      if (evt.type_evenement === 'competition'
          && window.SupabaseHub
          && typeof SupabaseHub.getEquipesEngagees === 'function') {
        const _eqs = await SupabaseHub.getEquipesEngagees(evtId);
        evt._equipesEngagees = Array.isArray(_eqs) ? _eqs : [];
      }
    } catch (e) {
      console.error('MOM Hub: openModalEditComplet() read-back', e);
    }

    openModalCreate();              // reset complet + ouverture
    MODAL_CREATE_EDIT_ID = evtId;   // bascule mode édition

    const f = document.getElementById('evt-create-form');
    if (!f) return;

    // Type d'évènement
    const fam = evt.type_evenement;
    const radioType = f.querySelector('input[name=type_evenement][value="' + fam + '"]');
    if (radioType) radioType.checked = true;

    // Mode vierge (pas duplication)
    const radioVierge = f.querySelector('input[name=create_mode][value=vierge]');
    if (radioVierge) radioVierge.checked = true;
    MODAL_CREATE_DUP_SRC_ID = null;

    // Méta
    f.elements.libelle.value = evt.libelle || '';
    if (f.elements.type_competition) f.elements.type_competition.value = evt.type_competition || '';
    if (f.elements.format_de_jeu)    f.elements.format_de_jeu.value    = evt.format_de_jeu || '';
    if (f.elements.adversaire_nom)   f.elements.adversaire_nom.value   = evt.adversaire_nom || '';
    if (f.elements.domicile_exterieur) f.elements.domicile_exterieur.value = evt.domicile_exterieur || '';
    if (f.elements.site_id && evt.site_id) f.elements.site_id.value = evt.site_id;
    if (f.elements.notes_internes) f.elements.notes_internes.value = evt.notes_internes || '';

    // Date début/fin (input type=date → yyyy-mm-dd)
    if (f.elements.date_debut && evt.date_debut) f.elements.date_debut.value = String(evt.date_debut).slice(0, 10);
    if (f.elements.date_fin && evt.date_fin)     f.elements.date_fin.value   = String(evt.date_fin).slice(0, 10);

    // Recalcule les blocs conditionnels (affiche horaires/engagement) AVANT prefill
    updateCreateConditionalFields();

    // Horaires (TIME "HH:MM:SS" → "HH:MM")
    const setTime = function (id, val) {
      const el = document.getElementById(id);
      if (el && val) el.value = String(val).slice(0, 5);
    };
    setTime('evt-create-debut-match', evt.debut_match);
    setTime('evt-create-fin-prevue',  evt.fin_prevue);
    setTime('evt-create-rdv-heure',   evt.rdv_heure);
    const rdvLieuEl = document.getElementById('evt-create-rdv-lieu');
    if (rdvLieuEl && evt.rdv_lieu) rdvLieuEl.value = evt.rdv_lieu;

    // EVT-EDITION-READBACK — RÉCURRENCE (série récurrente).
    //   `evt.recurrence` (jsonb) EST porté par les listings
    //   (get_evenements_a_venir/passes) → présent sur EVENTS_BY_ID, mais le
    //   prefill ne le relisait pas : à la réouverture, « Série récurrente »
    //   ressortait décochée et fréquence/jusqu'au vides. La zone récurrence
    //   n'est visible qu'en mode A1 (entraînement) — updateCreateConditionalFields()
    //   ci-dessus l'a déjà posée. On coche le toggle, on révèle les détails
    //   (comme le ferait le handler change) et on repose fréquence + fin.
    if (evt.recurrence && evt.recurrence.mode === 'recurrent') {
      const _recToggle = document.getElementById('evt-create-recurrence-toggle');
      const _recDetails = document.getElementById('evt-create-recurrence-details');
      if (_recToggle) _recToggle.checked = true;
      if (_recDetails) _recDetails.style.display = '';
      const _recFreq = document.getElementById('evt-create-recurrence-frequence');
      if (_recFreq && evt.recurrence.frequence) _recFreq.value = evt.recurrence.frequence;
      const _recFin = document.getElementById('evt-create-recurrence-fin');
      if (_recFin && evt.recurrence.fin) _recFin.value = String(evt.recurrence.fin).slice(0, 10);
    }

    // EVT-EDITION-READBACK — MULTI-JOURS (date de fin).
    //   `evt.date_fin` EST porté par les listings et posé sur le champ ci-dessus,
    //   mais la CASE « Sur plusieurs jours » (#evt-create-multijours-toggle) et
    //   la révélation du groupe date-fin ne l'étaient pas : sur un évènement
    //   multi-jours (ex. tournoi 2 jours), la case ressortait décochée et le
    //   champ date-fin masqué. La case n'existe qu'en A4/A5 (multi-équipes) —
    //   updateMultiEquipesUI() (dans le _waitFor équipes) finira de recaler le
    //   mode ; on prépare ici l'état « coché + révélé » pour qu'il survive.
    if (evt.date_fin) {
      const _mjToggle = document.getElementById('evt-create-multijours-toggle');
      const _mjGroup  = document.getElementById('evt-create-date-fin-group');
      if (_mjToggle) _mjToggle.checked = true;
      if (_mjGroup)  _mjGroup.style.display = '';
    }

    // Compétition : cocher équipes engagées + reconstruire phases/matchs.
    // Les équipes sont DÉDUITES des equipe_id des phases enfants (l'objet
    // evt n'a PAS de _equipesEngagees — getEvenementWithEncadrants ne le
    // renvoie pas). Attente ACTIVE (poll) au lieu de setTimeout fixes :
    // robuste face au peuplement asynchrone des cases équipes.
    if (fam === 'competition') {
      const enfants = CHILDREN_BY_PARENT[evtId] || [];   // phase-boîtes
      // EVT-EDITION-READBACK — UNION de deux sources d'équipes engagées :
      //   (a) equipe_id déduits des phases enfants (cas tournoi multi-équipes,
      //       comportement historique) ; (b) equipe_id du read-back frais
      //       evt._equipesEngagees (source evenement_equipes_engagees, cas
      //       match simple SANS phase enfant → l'ensemble (a) est vide). Sans
      //       (b), la case équipe engagée d'un match simple n'était jamais
      //       re-cochée à l'édition.
      const _eqEng = Array.isArray(evt._equipesEngagees) ? evt._equipesEngagees : [];
      const eqIds = Array.from(new Set(
        enfants.map(function (e) { return e.equipe_id; })
          .concat(_eqEng.map(function (x) { return x.equipe_id; }))
          .filter(Boolean)));

      // 1) Attendre que les cases équipes existent, puis cocher.
      _waitFor(function () {
        return document.querySelectorAll('#evt-create-equipes .evt-eng-equipe-cb').length > 0;
      }, function () {
        eqIds.forEach(function (eqId) {
          const cb = document.querySelector('#evt-create-equipes .evt-eng-equipe-cb[value="' + eqId + '"]');
          if (cb) cb.checked = true;
        });
        // EVT-EDITION-READBACK — recaler le MODE après cochage. Le mode A3→A4/A5
        //   dépend du nombre d'équipes cochées (_nbEqCochees) : au 1er passage
        //   de updateCreateConditionalFields() (avant ce _waitFor), aucune case
        //   n'était encore cochée → mode figé en A3, blocs multi-équipes/phases
        //   non révélés. On rappelle donc updateCreateConditionalFields() une
        //   fois les cases cochées, puis on RE-POSE l'état multi-jours (le
        //   recalcul a pu re-masquer le groupe date-fin selon l'état du toggle).
        if (eqIds.length > 0) updateCreateConditionalFields();
        // Re-cocher par sécurité : updateCreateConditionalFields est idempotent
        //   (peuplerEquipesEngagees garde-fou = pas de re-render si déjà peuplé
        //   pour la catégorie), mais on repose les coches défensivement au cas
        //   où un re-render surviendrait (aucun coût si déjà cochées).
        eqIds.forEach(function (eqId) {
          const cb2 = document.querySelector('#evt-create-equipes .evt-eng-equipe-cb[value="' + eqId + '"]');
          if (cb2) cb2.checked = true;
        });
        if (evt.date_fin) {
          const _mjToggle2 = document.getElementById('evt-create-multijours-toggle');
          const _mjGroup2  = document.getElementById('evt-create-date-fin-group');
          if (_mjToggle2) _mjToggle2.checked = true;
          if (_mjGroup2)  _mjGroup2.style.display = '';
        }
        updateMultiEquipesUI();   // construit l'éditeur de phases par équipe
        // 2) Attendre que les blocs équipe soient construits, puis pré-remplir.
        _waitFor(function () {
          const w = document.getElementById('evt-create-phases-par-equipe-list');
          return w && w.querySelectorAll('.evt-phases-equipe-block').length > 0;
        }, function () {
          _prefillPhasesEditor(enfants);
        });
      });
    }

    // Encadrants : cocher ceux rattachés (evt.encadrants, chargé par la fiche).
    // Attente active (peuplerStaff est asynchrone).
    const encs = Array.isArray(evt.encadrants) ? evt.encadrants : [];
    if (encs.length > 0) {
      _waitFor(function () {
        return document.querySelectorAll('#evt-create-staff .evt-eng-staff-cb').length > 0;
      }, function () {
        encs.forEach(function (enc) {
          const pid = enc.personne_id || enc.id;
          const cb = document.querySelector('#evt-create-staff .evt-eng-staff-cb[value="' + pid + '"]');
          if (cb) cb.checked = true;
        });
      });
    }

    // Titre + bouton adaptés
    const titleEl = document.getElementById('evt-create-title');
    if (titleEl) titleEl.textContent = 'Modifier l\'évènement';
    const submitBtn = document.getElementById('evt-create-submit');
    if (submitBtn) submitBtn.textContent = 'Enregistrer les modifications';
  }

  // Attente active : exécute onReady() dès que condFn() est vraie. Poll
  // toutes les 50ms, abandon après ~3s (60 essais) avec log. Évite les
  // setTimeout à délai fixe, fragiles face au réseau (coupures fréquentes).
  function _waitFor(condFn, onReady, _tries) {
    _tries = _tries || 0;
    if (condFn()) { onReady(); return; }
    if (_tries > 60) {
      console.warn('_waitFor : condition non remplie après ~3s, abandon');
      return;
    }
    setTimeout(function () { _waitFor(condFn, onReady, _tries + 1); }, 50);
  }

  // Reconstruit l'éditeur de phases/matchs par équipe depuis les enfants
  // (phase-boîtes + leurs matchs via CHILDREN_BY_PARENT). Appelé une fois les
  // blocs équipe construits (cf. _waitFor dans openModalEditComplet).
  function _prefillPhasesEditor(phaseBoxes) {
    const editorWrap = document.getElementById('evt-create-phases-par-equipe-list');
    if (!editorWrap) return;
    const phasesByEq = {};
    phaseBoxes.forEach(function (pb) {
      const k = pb.equipe_id || '_';
      if (!phasesByEq[k]) phasesByEq[k] = [];
      phasesByEq[k].push(pb);
    });
    editorWrap.querySelectorAll('.evt-phases-equipe-block').forEach(function (block) {
      const eqId = block.getAttribute('data-equipe-id');
      const phases = phasesByEq[eqId] || [];
      phases.forEach(function (pb) {
        const addPhaseBtn = block.querySelector('[data-action="add-phase"]');
        if (addPhaseBtn) addPhaseBtn.click();
        const boxes = block.querySelectorAll('.evt-phase-box');
        const box = boxes[boxes.length - 1];
        if (!box) return;
        const libInput = box.querySelector('.evt-phase-libelle');
        if (libInput) libInput.value = pb.phase_libelle || pb.libelle || '';
        const matchs = CHILDREN_BY_PARENT[pb.id] || [];
        matchs.forEach(function (m) {
          const addMatchBtn = box.querySelector('[data-action="add-match"]');
          if (addMatchBtn) addMatchBtn.click();
          const rows = box.querySelectorAll('.evt-phase-match-row');
          const row = rows[rows.length - 1];
          if (!row) return;
          const advInput = row.querySelector('.evt-match-adversaire');
          if (advInput) advInput.value = m.adversaire_nom || '';
        });
      });
    });
  }

  /**
   * U1/U2 (v1.16) — règle d'adaptation à 3 entrées de la modale E3
   * (UX §1). Entrée 1 famille (competition→Engagement+compét+format ;
   * stage→date_fin ; entrainement→occasionnel/récurrent M2). Entrée 2
   * occasionnel/récurrent. Entrée 3 sous-type → bascule question
   * Phases (UX §3.1, 4 sous-types éligibles). Idempotent, appelé sur
   * changement de type, de sous-type, et à l'ouverture. Aucune
   * colonne marqueur (P1/M6 §4.4) : pure adaptation d'écran.
   */
  /**
   * v1.24 — Règle d'adaptation 5 modes (refonte UX Evt→Compo doc UX
   * §3.1). Pilote la modale création par combo (type_evenement ×
   * type_competition) avec bandeau mode + sections conditionnelles.
   *
   * 5 modes :
   *   A1 = entrainement (récurrence possible)
   *   A2 = stage (multi-jours implicite, dates start/end)
   *   A3 = competition + sous-type sans phases (match_championnat,
   *        championnat_phase_1/2/finales, match_amical, seven,
   *        challenge_vie, challenge_inter_ligues — selon spec UX §3.1.3)
   *   A4 = competition + plateau (multi-équipes, phases optionnelles)
   *   A5 = competition + tournoi (phases obligatoires, multi-équipes
   *        possible)
   *
   * Idempotent (appelée à l'ouverture + sur change radio/select).
   * Préserve ancres v1.23 (evt-create-engagement, evt-create-equipes,
   * evt-create-phases-question, evt-create-phases-zone) et active
   * les nouvelles ancres L4 (evt-create-compet-group,
   * evt-create-mode-bandeau, evt-create-horaires-detailles-zone,
   * evt-create-recurrence-zone, evt-create-multijours-toggle-group,
   * evt-create-adversaire-mono-group, evt-create-adv-par-equipe-zone,
   * evt-create-phases-par-equipe-list, evt-create-affectations-n2-zone).
   */
  function updateCreateConditionalFields() {
    const checked = document.querySelector('#evt-create-form input[name=type_evenement]:checked');
    if (!checked) return;
    const famille = familleReelle(checked.value);

    const competSelect = document.getElementById('evt-create-compet');
    const sousType = competSelect ? competSelect.value : '';

    // ──────────────────────────────────────────────────────────────
    // Détermination du mode A1→A5
    // ──────────────────────────────────────────────────────────────
    // v1.28 — Sous-types à PHASES (A5) = constante module PHASES_SOUS_TYPES
    // (source de vérité unique : tournoi + Vié + Inter-Ligues + Seven).
    // A4 plateau = matchs simples (adversaires par équipe), JAMAIS de phases.
    const PHASES_OBLIG_SOUS_TYPES = PHASES_SOUS_TYPES;  // A5
    const PHASES_OPTIONNEL_SOUS_TYPES = ['plateau'];    // A4 (multi-équipes, matchs simples)
    // v1.35 — Nombre d'équipes cochées (coquille terrain) : un match
    // officiel/amical (match_championnat/match_amical) avec 2+ de NOS
    // équipes engagées n'est plus un match simple à 1 adversaire — chaque
    // équipe a son/ses adversaire(s). Il bascule donc en comportement
    // PLATEAU (A4 : adversaires par équipe). Cohérent avec le texte d'aide
    // « 1 équipe = match simple (A3) · 2+ = multi-équipes ». À 1 équipe,
    // il reste A3 (mono-adversaire). Le sous-type stocké en base ne change
    // pas (toujours match_championnat/match_amical) ; seul le COMPORTEMENT
    // de saisie s'adapte au nombre d'équipes.
    const _nbEqCochees = document.querySelectorAll(
      '#evt-create-equipes .evt-eng-equipe-cb:checked').length;
    const MATCH_SIMPLE_SOUS_TYPES = ['match_championnat', 'match_amical'];
    let mode = 'A1';
    if (famille === 'entrainement')      mode = 'A1';
    else if (famille === 'stage')         mode = 'A2';
    else if (famille === 'competition') {
      if (PHASES_OBLIG_SOUS_TYPES.indexOf(sousType) !== -1)     mode = 'A5';
      else if (PHASES_OPTIONNEL_SOUS_TYPES.indexOf(sousType) !== -1) mode = 'A4';
      else if (MATCH_SIMPLE_SOUS_TYPES.indexOf(sousType) !== -1 && _nbEqCochees >= 2) mode = 'A4';
      else                                                      mode = 'A3';
    }

    // ──────────────────────────────────────────────────────────────
    // Bandeau mode (signal visuel fort UX §3.1 P3 décision)
    // ──────────────────────────────────────────────────────────────
    setBandeauMode(mode, famille, sousType);

    // ──────────────────────────────────────────────────────────────
    // Visibilité des sections par mode
    // ──────────────────────────────────────────────────────────────
    const showCompet      = famille === 'competition';            // Bloc 3 sous-type
    const showEngagement  = famille === 'competition';            // Bloc 8 engagement
    const showHoraires    = true;                                // Bloc 6 horaires détaillés — TOUS les types (v1.44 : A1-A5)
    const showRecurrence  = mode === 'A1';                        // Bloc 7 série récurrente
    const showMultijours  = mode === 'A4' || mode === 'A5';       // Toggle multi-jours
    const showDateFin     = famille === 'stage';                  // Date fin auto pour stage
    const showFormatGlob  = false;                                // jamais en mode adaptatif (format-par-équipe le remplace)
    const showAdvMono     = mode === 'A3';                        // Adversaire singulier
    // v1.28 — Frontière nette plateau/tournoi (décision Manu) :
    //   A4 plateau = matchs simples → adversaires par équipe, JAMAIS de phases.
    //   A5 tournoi = éditeur de phases → JAMAIS d'adversaires par équipe.
    // La question « Avec phases ? » (A4) est RETIRÉE : un plateau n'a pas
    // de phases. Supprime le doublon adversaires/phases (UX-2b) par
    // construction, sans garde conditionnelle.
    const showAdvParEq    = mode === 'A4';                        // Adversaires par équipe (plateau seul)
    const showPhasesQ     = false;                                // Question phases retirée (plateau ≠ phases)
    const showPhasesZone  = mode === 'A5';                        // Phases : tournoi seul

    function setDisplay(id, show) {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    }

    setDisplay('evt-create-compet-group',                showCompet);
    setDisplay('evt-create-engagement',                  showEngagement);
    setDisplay('evt-create-horaires-detailles-zone',     showHoraires);
    // v1.44 (volet B) — Libellé du champ « début » adapté au type, comme en
    // fiche (cohérence). Cible le <label for="evt-create-debut-match"> sans
    // toucher au HTML. Famille connue ici (entrainement|stage|competition).
    {
      const _lblDebut = document.querySelector('label[for="evt-create-debut-match"]');
      if (_lblDebut) {
        _lblDebut.textContent = famille === 'competition' ? 'Début des matchs'
                              : famille === 'stage'        ? 'Début des activités'
                              : 'Début de l\'entraînement';
      }
    }
    setDisplay('evt-create-recurrence-zone',             showRecurrence);
    setDisplay('evt-create-multijours-toggle-group',     showMultijours);
    // v1.33 — La date de fin ne s'affiche à l'ouverture que si le type
    // la porte nativement (showDateFin, ex. stage). En mode multijours
    // (A4/A5), on affiche la CASE « Sur plusieurs jours » mais la date de
    // fin reste MASQUÉE tant que la case n'est pas cochée — c'est le
    // handler change de la case (bindEvents) qui la révèle. On préserve
    // le cas « case déjà cochée » (réouverture/rebascule de type) en
    // testant l'état réel de la case.
    var _mjToggle = document.getElementById('evt-create-multijours-toggle');
    var _mjChecked = !!(_mjToggle && _mjToggle.checked);
    setDisplay('evt-create-date-fin-group',              showDateFin || (showMultijours && _mjChecked));
    setDisplay('evt-create-format-group',                showFormatGlob);
    setDisplay('evt-create-adversaire-mono-group',       showAdvMono);
    setDisplay('evt-create-adv-par-equipe-zone',         showAdvParEq);
    setDisplay('evt-create-phases-question',             showPhasesQ);

    // Phases zone : A5 tournoi = visible (phases obligatoires). A4 plateau
    // et A1/A2/A3 = jamais. (v1.28 : plus de branche A4 conditionnelle.)
    const showPhasesZoneEffective = showPhasesZone;
    setDisplay('evt-create-phases-zone', showPhasesZoneEffective);

    // ──────────────────────────────────────────────────────────────
    // Peuplement dynamique des blocs visibles (idempotent)
    // ──────────────────────────────────────────────────────────────
    if (showEngagement) {
      peuplerEquipesEngagees();  // existant v1.18, idempotent
    }
    // Staff M8 ACTIF (E-1 acté §4.6 doc UX) — tous modes A1→A5
    peuplerStaff();

    // Affectations N2 plateau : visible uniquement mode A4 multi-équipes
    // (>= 2 équipes cochées). Géré par on-change checkbox équipe via
    // updateMultiEquipesUI() ; on déclenche un refresh ici par sécurité.
    updateMultiEquipesUI();

    // Règle Seven (préserve v1.16) : sous-type 'seven' → format '7'
    // (NB : format global retiré en mode adaptatif L4, mais l'ancre
    // existe encore — défensif, n'écrase pas un choix utilisateur).
    if (famille === 'competition' && sousType === 'seven') {
      const fmt = document.getElementById('evt-create-format');
      if (fmt && !fmt.value) fmt.value = '7';
    }
  }

  /**
   * v1.24 — Helper : affiche le bandeau mode (UX §3.1 P3 décision —
   * "adaptation visible par bandeau mode + sections conditionnelles,
   * pas seulement par champs grisés"). Texte court, factuel.
   */
  function setBandeauMode(mode, famille, sousType) {
    const bandeau = document.getElementById('evt-create-mode-bandeau');
    if (!bandeau) return;

    const LIBELLES = {
      'A1': '🎯 Mode A1 — Entraînement (récurrence possible)',
      'A2': '🏕️ Mode A2 — Stage (multi-jours)',
      'A3': '⚔️ Mode A3 — Compétition simple (1 équipe, 1 adversaire)',
      'A4': '🏆 Mode A4 — Plateau (multi-équipes, phases optionnelles)',
      'A5': '🥇 Mode A5 — Tournoi (multi-équipes, phases obligatoires)'
    };
    bandeau.textContent = LIBELLES[mode] || ('Mode ' + mode);
    bandeau.style.display = '';
  }

  /**
   * v1.24 — Met à jour les blocs dynamiques pilotés par le nombre
   * d'équipes cochées (Bloc 8b format-par-équipe, 8d adv-par-équipe,
   * 8f phases-par-équipe-list, Bloc 10 affectations N2 plateau).
   * Appelé sur change d'une checkbox équipe ET à chaque refresh
   * updateCreateConditionalFields.
   */
  function updateMultiEquipesUI() {
    const cbList = document.querySelectorAll('#evt-create-equipes .evt-eng-equipe-cb:checked');
    const nbCoches = cbList.length;

    const competSelect = document.getElementById('evt-create-compet');
    const sousType = competSelect ? competSelect.value : '';
    const isA4 = sousType === 'plateau';   // plateau = affectations N2 (matchs simples)
    // v1.28 — isA5 retiré : l'affichage adv/phases est gouverné par le
    // display réel posé par updateCreateConditionalFields (qui classe
    // tournoi/Vié/inter-ligues/Seven en A5). Un test 'tournoi' en dur ici
    // aurait raté les 3 autres formats à phases.

    const formatParEq = document.getElementById('evt-create-format-par-equipe');
    const advParEq    = document.getElementById('evt-create-adv-par-equipe-zone');
    const phasesParEq = document.getElementById('evt-create-phases-zone');
    const affectN2    = document.getElementById('evt-create-affectations-n2-zone');

    // v1.30 — Le format par équipe est désormais INTÉGRÉ dans la ligne
    // de chaque équipe (peuplerEquipesEngagees, select révélé à la coche).
    // Le bloc séparé #evt-create-format-par-equipe est NEUTRALISÉ (gardé
    // masqué, plus peuplé). buildFormatParEquipeLines conservée mais
    // n'est plus appelée (laissée intacte pour ne pas régresser un
    // appelant éventuel ; morte de fait).
    if (formatParEq) {
      formatParEq.style.display = 'none';
    }

    // Adv par équipe : peuplé si la zone est VISIBLE (A4) et >= 1 équipe.
    // v1.36 — variante selon le sous-type : 'plateau' = poule (multi-adv),
    // sinon (match_championnat/match_amical multi-équipes) = 1 adv/équipe.
    if (advParEq && advParEq.style.display !== 'none' && nbCoches >= 1) {
      buildAdvParEquipeLines(cbList, sousType === 'plateau');
    }

    // Phases par équipe : peuplé si la zone est VISIBLE (A5 tournoi seul,
    // v1.28) et au moins 1 équipe cochée.
    if (phasesParEq && phasesParEq.style.display !== 'none' && nbCoches >= 1) {
      buildPhasesParEquipeList(cbList);
    }

    // Affectations N2 : mode A4 plateau ET multi-équipes (>= 2)
    if (affectN2) {
      const showN2 = isA4 && nbCoches >= 2;
      affectN2.style.display = showN2 ? '' : 'none';
      if (showN2) buildAffectationsN2Lines(cbList);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // v1.24 — PEUPLEMENT STAFF M8 (E-1 acté §4.6 doc UX, bloc passif
  // → actif). Lecture dynamique collectif N1 role='staff' actif
  // saison courante via SupabaseHub. Cache résultats par catégorie
  // pour éviter re-fetch. Cases checkbox value=personne_id.
  // ────────────────────────────────────────────────────────────────
  let _staffLoadedKey = null;   // clé = catégorie + mode (M14 | all)
  let _staffCache = [];

  async function peuplerStaff(showAll) {
    const wrap = document.getElementById('evt-create-staff');
    if (!wrap) return;

    // Clé d'idempotence : dépend du mode (staff catégorie vs tout le staff)
    // pour que cocher/décocher « Afficher tout le staff » recharge bien.
    const modeKey = showAll ? 'all' : ('cat:' + (CTX_CATEGORIE_ID || '?'));
    if (_staffLoadedKey === modeKey
        && wrap.querySelector('input.evt-eng-staff-cb')) {
      return;
    }

    // En mode catégorie, CTX_CATEGORIE_ID est requis ; en mode « tout », non.
    if (!showAll && !CTX_CATEGORIE_ID) {
      wrap.innerHTML = '<div class="evt-form-error">Catégorie non '
        + 'résolue : impossible de filtrer le staff par catégorie. '
        + 'Cochez « Afficher tout le staff du club » ou complétez '
        + 'l\'encadrement depuis la fiche.</div>';
      return;
    }

    wrap.innerHTML = '<div class="evt-form-hint">Chargement de la liste d\'encadrement…</div>';

    let membres = [];
    try {
      // v1.46 — CÂBLAGE encadrants FILTRÉ par catégorie. listStaffDisponibles
      // accepte désormais un categorieId (RPC v2 p_categorie_id) :
      //   showAll=false → CTX_CATEGORIE_ID (staff de la catégorie, fonction
      //                   active dans fonction_staff) ;
      //   showAll=true  → null (tout le staff du club).
      // Fallbacks legacy conservés (listStaffParCategorie/Collectif) au cas où.
      if (typeof SupabaseHub.listStaffDisponibles === 'function') {
        membres = await SupabaseHub.listStaffDisponibles(showAll ? null : CTX_CATEGORIE_ID);
      } else if (typeof SupabaseHub.listStaffParCategorie === 'function') {
        membres = await SupabaseHub.listStaffParCategorie(CTX_CATEGORIE_ID);
      } else if (typeof SupabaseHub.listCollectifMembresStaff === 'function') {
        membres = await SupabaseHub.listCollectifMembresStaff(CTX_CATEGORIE_ID);
      } else {
        console.warn('peuplerStaff() : aucun wrapper SupabaseHub disponible pour lister le staff');
        wrap.innerHTML = '<div class="evt-form-hint">Liste d\'encadrement '
          + 'indisponible (wrapper non livré). Vous pourrez ajouter les '
          + 'encadrants depuis la fiche après création.</div>';
        return;
      }
    } catch (e) {
      console.error('peuplerStaff()', e);
      membres = [];
    }

    _staffCache = Array.isArray(membres) ? membres : [];
    _staffLoadedKey = modeKey;

    // Case « Afficher tout le staff du club » — toujours rendue en tête,
    // état reflétant le mode courant. Cochée → recharge sans filtre.
    const toggleHtml = '<label class="evt-eng-equipe-row" '
      + 'style="font-weight:600; margin-bottom:6px;">'
      + '<input type="checkbox" id="evt-create-staff-showall"'
      + (showAll ? ' checked' : '') + '> '
      + 'Afficher tout le staff du club</label>';

    if (_staffCache.length === 0) {
      wrap.innerHTML = toggleHtml
        + '<div class="evt-form-hint">'
        + (showAll
            ? 'Aucun staff actif pour la saison en cours.'
            : 'Aucun staff rattaché à cette catégorie. Cochez « Afficher '
              + 'tout le staff du club » pour voir l\'ensemble.')
        + '</div>';
      _bindStaffShowAllToggle();
      return;
    }

    const html = _staffCache.map(function (m) {
      // membre attendu : { personne_id, prenom, nom, role(s) }
      const pid = m.personne_id || m.id || '';
      const nom = escHtml(
        ((m.prenom || '') + ' ' + (m.nom || '')).trim()
        || m.libelle || m.email_principal || pid);
      return '<label class="evt-eng-equipe-row">'
        + '<input type="checkbox" class="evt-eng-staff-cb" '
        + 'value="' + escHtml(pid) + '"> '
        + nom + '</label>';
    }).join('');
    wrap.innerHTML = toggleHtml + html;
    _bindStaffShowAllToggle();

    // Hook change → met à jour le dropdown affectations N2 (qui ne
    // doit proposer que les staff cochés ici, cohérence intra-modale
    // D10 §3.1.6 doc UX).
    wrap.querySelectorAll('.evt-eng-staff-cb').forEach(function (cb) {
      cb.addEventListener('change', updateMultiEquipesUI);
    });
  }

  // v1.46 — Câble la case « Afficher tout le staff du club » : au changement,
  // recharge la liste dans le mode correspondant (tout vs catégorie). Le
  // changement de mode invalide l'idempotence (clé modeKey différente).
  function _bindStaffShowAllToggle() {
    const toggle = document.getElementById('evt-create-staff-showall');
    if (!toggle) return;
    toggle.addEventListener('change', function () {
      peuplerStaff(toggle.checked);
    });
  }

  // ────────────────────────────────────────────────────────────────
  // v1.24 — HELPERS BLOCS MULTI-ÉQUIPES (F19 arborescence par équipe,
  // doc UX §3.1.4). Tous générés dynamiquement depuis la liste des
  // checkboxes cochées dans evt-create-equipes. Idempotent : recrée
  // le contenu à chaque appel (anti-résidu si nb d'équipes change).
  // ────────────────────────────────────────────────────────────────

  /**
   * Bloc 8b — Format par équipe (visible dès 1 équipe cochée, v1.29).
   * 1 ligne par équipe avec dropdown format (override M4 §4.3),
   * pré-rempli sur le format réel de l'équipe (data-format).
   */
  function buildFormatParEquipeLines(checkedCbs) {
    const wrap = document.getElementById('evt-create-format-lines');
    if (!wrap) return;
    const FORMATS = [
      { v: '',   l: '— Hérité —' },
      { v: 'XV', l: 'XV (15)' },
      { v: '13', l: 'XIII' },
      { v: '12', l: 'XII' },
      { v: 'X',  l: 'X' },
      { v: '9',  l: 'IX' },
      { v: '8',  l: 'VIII' },
      { v: '7',  l: 'VII' }
    ];
    const html = Array.prototype.map.call(checkedCbs, function (cb) {
      const equipeId = cb.value;
      const equipeLabel = cb.parentElement ? cb.parentElement.textContent.trim() : equipeId;
      // v1.29 — format réel de l'équipe (data-format = format_jeu_code
      // projeté par listEquipes). Pré-sélectionne l'option correspondante
      // si elle existe dans FORMATS (CHECK base XV/13/12/X/9/8/7) ; sinon
      // reste sur « — Hérité — » (garde dégradation honnête, jamais d'erreur).
      const fmtReel = cb.getAttribute('data-format') || '';
      const matchFmt = FORMATS.some(function (f) { return f.v && f.v === fmtReel; });
      const optsHtml = FORMATS.map(function (f) {
        const sel = (matchFmt && f.v === fmtReel) ? ' selected' : '';
        return '<option value="' + escHtml(f.v) + '"' + sel + '>' + escHtml(f.l) + '</option>';
      }).join('');
      return '<div class="evt-eng-format-row" data-equipe-id="' + escHtml(equipeId) + '">'
        + '<span class="evt-eng-format-label">' + escHtml(equipeLabel) + '</span>'
        + '<select class="evt-form-select evt-eng-format-select">'
        + optsHtml + '</select>'
        + '</div>';
    }).join('');
    wrap.innerHTML = html;
  }

  /**
   * Bloc 8d — Adversaires par équipe (visible modes A4/A5 multi-équipes).
   * 1 input texte par équipe pour saisir l'adversaire / nom de poule.
   */
  /**
   * Helper v1.34 — une ligne adversaire (plateau A4, poule). Emplacement
   * texte libre + croix de retrait. `n` = numéro d'ordre affiché.
   * Classes alignées sur le pattern de l'éditeur de phases.
   */
  function _advRowHtml(n) {
    return '<div class="evt-eng-adv-item" '
      + 'style="display:flex; align-items:center; gap:6px; margin-top:6px;">'
      + '<input type="text" class="evt-form-input evt-eng-adv-input" '
      + 'placeholder="Adversaire ' + n + '">'
      + '<button type="button" class="evt-eng-btn-remove" '
      + 'data-action="remove-adv" title="Retirer cet adversaire">✕</button>'
      + '</div>';
  }

  /**
   * Bloc 8d — Adversaires par équipe (plateau A4). v1.34 — REFONTE :
   * un plateau est une compétition où chaque équipe rencontre PLUSIEURS
   * adversaires (poule), pas un seul (coquille terrain signalée). Par
   * équipe cochée : un champ « Nom de poule » (opt., → notes M3) + une
   * LISTE d'adversaires empilables (bouton « + Adversaire », croix de
   * retrait), au lieu d'un input unique. La RPC sql/52 consomme déjà
   * adversaires[] (M5, boucle jsonb_array_elements) et notes M3 → aucun
   * changement RPC/schéma (option UI). Départ : 1 ligne adversaire vide.
   * Délégation des boutons : bindAdvEditor (posée 1×).
   */
  /**
   * Bloc 8d — Adversaires par équipe (mode A4). v1.36 — DEUX variantes,
   * car « match officiel/amical à 2 équipes » ≠ « plateau » (correction
   * terrain) :
   *   • plateauMode=true  (type_competition='plateau') : chaque équipe
   *     rencontre PLUSIEURS adversaires (poule) → champ « Nom de poule »
   *     (opt.) + LISTE d'adversaires empilables (« + Adversaire ») [v1.34].
   *   • plateauMode=false (match_championnat/match_amical à 2+ équipes) :
   *     chacune de nos équipes a UN SEUL adversaire programmé → un seul
   *     champ par équipe, NI bouton « + Adversaire » NI nom de poule.
   * Les deux variantes utilisent .evt-eng-adv-input + data-equipe-id sur
   * .evt-eng-adv-row → submitModalCreate lit sans changement (variante
   * match = 1 input/équipe, pas de .evt-eng-poule-input → pas de notes).
   */
  function buildAdvParEquipeLines(checkedCbs, plateauMode) {
    const wrap = document.getElementById('evt-create-adv-par-equipe-lines');
    if (!wrap) return;
    const isPlateau = (plateauMode !== false);  // défaut = plateau (rétro-compat)
    const html = Array.prototype.map.call(checkedCbs, function (cb) {
      const equipeId = cb.value;
      const equipeLabel = cb.parentElement ? cb.parentElement.textContent.trim() : equipeId;
      if (isPlateau) {
        return '<div class="evt-eng-adv-row" data-equipe-id="' + escHtml(equipeId) + '" '
          + 'style="margin-bottom:14px;">'
          + '<div class="evt-eng-adv-head" '
            + 'style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">'
            + '<span class="evt-eng-adv-label">' + escHtml(equipeLabel) + '</span>'
            + '<input type="text" class="evt-form-input evt-eng-poule-input" '
            + 'placeholder="Nom de poule (opt.)" '
            + 'style="max-width:200px; margin-left:auto;">'
          + '</div>'
          + '<div class="evt-eng-adv-list">' + _advRowHtml(1) + '</div>'
          + '<button type="button" class="evt-eng-btn" data-action="add-adv" '
            + 'style="margin-top:6px;">+ Adversaire</button>'
          + '</div>';
      }
      // Variante MATCH simple : un seul adversaire par équipe.
      return '<div class="evt-eng-adv-row" data-equipe-id="' + escHtml(equipeId) + '" '
        + 'style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">'
        + '<span class="evt-eng-adv-label">' + escHtml(equipeLabel) + '</span>'
        + '<input type="text" class="evt-form-input evt-eng-adv-input" '
        + 'placeholder="Adversaire (opt.)" style="flex:1 1 auto;">'
        + '</div>';
    }).join('');
    wrap.innerHTML = html;
    if (isPlateau) bindAdvEditor();
  }

  /**
   * v1.34 — Délégation des boutons du bloc adversaires-par-équipe
   * (plateau A4) : + Adversaire / retrait. Posée 1× sur le conteneur.
   */
  function bindAdvEditor() {
    const wrap = document.getElementById('evt-create-adv-par-equipe-lines');
    if (!wrap || wrap._advEditorBound) return;
    wrap._advEditorBound = true;
    wrap.addEventListener('click', function (e) {
      const actEl = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!actEl || !wrap.contains(actEl)) return;
      const action = actEl.getAttribute('data-action');
      if (action === 'add-adv') {
        const row = actEl.closest('.evt-eng-adv-row');
        const list = row && row.querySelector('.evt-eng-adv-list');
        if (list) {
          const n = list.querySelectorAll('.evt-eng-adv-item').length + 1;
          const tmp = document.createElement('div');
          tmp.innerHTML = _advRowHtml(n);
          list.appendChild(tmp.firstChild);
        }
        return;
      }
      if (action === 'remove-adv') {
        const item = actEl.closest('.evt-eng-adv-item');
        const list = item && item.parentElement;
        // Ne pas vider complètement : on garde au moins 1 ligne.
        if (list && list.querySelectorAll('.evt-eng-adv-item').length > 1) {
          item.remove();
        } else if (item) {
          const input = item.querySelector('.evt-eng-adv-input');
          if (input) input.value = '';
        }
        return;
      }
    });
  }

  /**
   * Bloc 8f — Phases par équipe (F19 arborescence) — ÉDITEUR RÉEL v1.27.
   *
   * Refonte du texte de consigne (v1.26) en éditeur de phases opérant
   * dans l'écran, conforme au doc FAIT FOI
   * `Conception-Refonte-UX-Creation-Evt-MultiPhases-v1.md` §3 (D1→D9) :
   *   - 1 carte repliable par équipe cochée (D8, repli via .is-open,
   *     classes .evt-fiche-collapsible/.evt-fiche-chevron réutilisées) ;
   *   - phases nommées librement + date optionnelle, illimitées (D2 + D-PROD-2,
   *     bouton « + Phase ») ;
   *   - matchs illimités par phase (D4, bouton « + Match ») ;
   *   - adversaires en emplacements ajustables « adv N » texte libre (D5).
   *
   * Départ VIDE (D-PROD-1) : 0 phase à l'ouverture, le coach clique
   * « + Phase ». La validation « ≥ 1 phase par équipe » est faite côté
   * client dans submitModalCreate (plus de phase fantôme codée en dur).
   *
   * PRÉSERVATION À LA RE-COCHE : updateMultiEquipesUI rappelle cette
   * fonction à chaque changement de coche d'équipe. On ne reconstruit
   * QUE les cartes des équipes nouvellement cochées et on retire celles
   * des équipes décochées — les phases déjà saisies des autres équipes
   * sont conservées (état porté par le DOM, pas par un objet JS séparé).
   *
   * Mécanique : add/remove phase, add/remove match, repli = délégation
   * d'événements posée une seule fois dans bindEvents (bindPhasesEditor).
   */
  function buildPhasesParEquipeList(checkedCbs) {
    const wrap = document.getElementById('evt-create-phases-par-equipe-list');
    if (!wrap) return;

    // Index des équipes désormais cochées (id -> label)
    const wanted = {};
    Array.prototype.forEach.call(checkedCbs, function (cb) {
      const eqId = cb.value;
      const eqLabel = cb.parentElement ? cb.parentElement.textContent.trim() : eqId;
      wanted[eqId] = eqLabel;
    });

    // 1) Retire les cartes des équipes décochées (préserve les autres)
    Array.prototype.forEach.call(
      wrap.querySelectorAll('.evt-phases-equipe-block'),
      function (block) {
        const eqId = block.getAttribute('data-equipe-id');
        if (!Object.prototype.hasOwnProperty.call(wanted, eqId)) {
          block.remove();
        }
      });

    // 2) Ajoute une carte vide pour chaque équipe nouvellement cochée
    Object.keys(wanted).forEach(function (eqId) {
      if (wrap.querySelector('.evt-phases-equipe-block[data-equipe-id="' + eqId + '"]')) {
        return; // déjà présente : on ne touche pas à ses phases saisies
      }
      const block = document.createElement('div');
      block.className = 'evt-phases-equipe-block evt-fiche-collapsible is-open';
      block.setAttribute('data-equipe-id', eqId);
      block.innerHTML =
          '<div class="evt-phases-equipe-head evt-fiche-section-title" '
            + 'data-action="toggle-phases-equipe" style="display:flex; align-items:center; '
            + 'gap:8px; cursor:pointer; font-weight:600; margin-bottom:6px;">'
          + '<span class="evt-fiche-chevron">▸</span>'
          + '<span class="evt-phases-equipe-title">' + escHtml(wanted[eqId]) + '</span>'
          + '<span class="evt-phases-equipe-resume evt-form-hint" style="margin-left:auto;"></span>'
        + '</div>'
        + '<div class="evt-fiche-section-body">'
          + '<div class="evt-phases-list-for-equipe"></div>'
          + '<button type="button" class="evt-eng-btn" data-action="add-phase" '
            + 'style="margin-top:6px;">+ Phase</button>'
        + '</div>';
      wrap.appendChild(block);
      _refreshPhasesResume(block);
    });
  }

  /**
   * Fragment HTML d'une carte phase (D2 nom + D-PROD-2 date optionnelle,
   * D4 liste de matchs + bouton « + Match »). Aucune phase/match
   * pré-amorcé (D-PROD-1) : le coach ajoute via les boutons.
   */
  function _phaseBoxHtml() {
    return '<div class="evt-phase-box">'
      + '<div class="evt-phase-box-head">'
        + '<input type="text" class="evt-form-input evt-phase-libelle" '
          + 'placeholder="Nom de la phase (ex. Poule de brassage)">'
        + '<input type="date" class="evt-form-input evt-phase-date" '
          + 'style="flex:0 0 150px;" title="Date de la phase (optionnel)">'
        + '<button type="button" class="evt-eng-btn-remove" '
          + 'data-action="remove-phase" title="Supprimer cette phase">✕</button>'
      + '</div>'
      + '<div class="evt-phase-matchs-list"></div>'
      + '<button type="button" class="evt-eng-btn" data-action="add-match" '
        + 'style="margin-top:6px;">+ Match</button>'
    + '</div>';
  }

  /**
   * Fragment HTML d'une ligne match (D5 adversaire = emplacement
   * ajustable texte libre « adv N » pré-rempli, modifiable ensuite).
   * @param {number} n - numéro d'ordre pour l'emplacement par défaut.
   */
  function _matchRowHtml(n) {
    return '<div class="evt-phase-match-row">'
      + '<input type="text" class="evt-form-input evt-match-adversaire" '
        + 'value="adv ' + n + '" placeholder="Adversaire (ajustable)">'
      + '<button type="button" class="evt-eng-btn-remove" '
        + 'data-action="remove-match" title="Supprimer ce match">✕</button>'
    + '</div>';
  }

  /**
   * Met à jour le résumé compact « N phases · M matchs » de l'en-tête
   * d'une carte équipe (D8 : lisibilité à N équipes, carte repliée).
   */
  function _refreshPhasesResume(block) {
    if (!block) return;
    const resume = block.querySelector('.evt-phases-equipe-resume');
    if (!resume) return;
    const nbPhases = block.querySelectorAll('.evt-phase-box').length;
    const nbMatchs = block.querySelectorAll('.evt-phase-match-row').length;
    if (nbPhases === 0) {
      resume.textContent = 'aucune phase';
    } else {
      resume.textContent = nbPhases + ' phase' + (nbPhases > 1 ? 's' : '')
        + ' · ' + nbMatchs + ' match' + (nbMatchs > 1 ? 's' : '');
    }
  }

  /**
   * Renumérote les emplacements adversaires par défaut « adv N » d'une
   * phase après ajout/suppression — uniquement les inputs encore sur
   * leur valeur par défaut (ne touche pas un nom saisi par le coach, D5).
   */
  function _renumberDefaultAdversaires(matchsList) {
    if (!matchsList) return;
    let n = 0;
    Array.prototype.forEach.call(
      matchsList.querySelectorAll('.evt-match-adversaire'),
      function (inp) {
        n += 1;
        if (/^adv \d+$/.test(inp.value.trim())) {
          inp.value = 'adv ' + n;
        }
      });
  }

  /**
   * Délégation d'événements de l'éditeur de phases (posée 1× via
   * bindEvents). Gère add/remove phase, add/remove match, repli carte
   * équipe. Tout repose sur les data-action des fragments ci-dessus.
   */
  function bindPhasesEditor() {
    const wrap = document.getElementById('evt-create-phases-par-equipe-list');
    if (!wrap || wrap._phasesEditorBound) return;
    wrap._phasesEditorBound = true;

    wrap.addEventListener('click', function (e) {
      const actEl = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!actEl || !wrap.contains(actEl)) return;
      const action = actEl.getAttribute('data-action');
      const block = actEl.closest('.evt-phases-equipe-block');

      if (action === 'toggle-phases-equipe') {
        if (block) block.classList.toggle('is-open');
        return;
      }
      if (action === 'add-phase') {
        const list = block && block.querySelector('.evt-phases-list-for-equipe');
        if (list) {
          const tmp = document.createElement('div');
          tmp.innerHTML = _phaseBoxHtml();
          list.appendChild(tmp.firstChild);
          _refreshPhasesResume(block);
        }
        return;
      }
      if (action === 'remove-phase') {
        const box = actEl.closest('.evt-phase-box');
        if (box) box.remove();
        _refreshPhasesResume(block);
        return;
      }
      if (action === 'add-match') {
        const box = actEl.closest('.evt-phase-box');
        const list = box && box.querySelector('.evt-phase-matchs-list');
        if (list) {
          const n = list.querySelectorAll('.evt-phase-match-row').length + 1;
          const tmp = document.createElement('div');
          tmp.innerHTML = _matchRowHtml(n);
          list.appendChild(tmp.firstChild);
          _refreshPhasesResume(block);
        }
        return;
      }
      if (action === 'remove-match') {
        const row = actEl.closest('.evt-phase-match-row');
        const list = row && row.parentElement;
        if (row) row.remove();
        _renumberDefaultAdversaires(list);
        _refreshPhasesResume(block);
        return;
      }
    });
  }

  /**
   * Bloc 10 — Affectations N2 plateau (mode A4 plateau multi-équipes).
   * 1 ligne par équipe avec dropdown contenant uniquement les coachs
   * cochés en M8 (cohérence intra-modale D10 §3.1.6 — N2 sous-ensemble
   * M8). Vide = pas d'affectation N2 explicite (staff évènement global).
   */
  function buildAffectationsN2Lines(checkedCbs) {
    const wrap = document.getElementById('evt-create-affectations-n2-lines');
    if (!wrap) return;

    // Récupère les coachs cochés en M8
    const staffCochesCbs = document.querySelectorAll('#evt-create-staff .evt-eng-staff-cb:checked');
    if (staffCochesCbs.length === 0) {
      wrap.innerHTML = '<div class="evt-form-hint">Aucun encadrant '
        + 'coché en Bloc 9. Cochez d\'abord les coachs présents pour '
        + 'pouvoir les affecter par équipe.</div>';
      return;
    }
    const staffOptsHtml = '<option value="">— Aucun (staff global) —</option>'
      + Array.prototype.map.call(staffCochesCbs, function (scb) {
        const pid = scb.value;
        const lbl = scb.parentElement ? scb.parentElement.textContent.trim() : pid;
        return '<option value="' + escHtml(pid) + '">' + escHtml(lbl) + '</option>';
      }).join('');

    const html = Array.prototype.map.call(checkedCbs, function (cb) {
      const equipeId = cb.value;
      const equipeLabel = cb.parentElement ? cb.parentElement.textContent.trim() : equipeId;
      return '<div class="evt-eng-n2-row" data-equipe-id="' + escHtml(equipeId) + '" '
        + 'style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">'
        + '<span style="flex:0 0 40%;">' + escHtml(equipeLabel) + '</span>'
        + '<select class="evt-form-select evt-eng-n2-select" style="flex:1;">'
        + staffOptsHtml + '</select>'
        + '</div>';
    }).join('');
    wrap.innerHTML = html;
  }

  // v1.16 — U2 §3.1/3.2 : OUI → « Phases & matchs » se substitue à 4c
  // (masque adversaires simples) ; NON → adversaires simples (M5).
  function updatePhasesModeVisibility() {
    const q = document.getElementById('evt-create-phases-question');
    const advZone = document.getElementById('evt-create-adv-zone');
    const phasesZone = document.getElementById('evt-create-phases-zone');
    // Si la question est masquée (sous-type fiche simple), on est en
    // mode adversaires simples par construction.
    const questionVisible = q && q.style.display !== 'none';
    const oui = questionVisible
      && q.querySelector('input[name=phases_mode]:checked')
      && q.querySelector('input[name=phases_mode]:checked').value === 'oui';
    if (advZone)    advZone.style.display    = oui ? 'none' : '';
    if (phasesZone) phasesZone.style.display = oui ? '' : 'none';
  }

  // ────────────────────────────────────────────────────────────────
  // v1.18 — Bloc 4a : peuplement RÉEL des équipes engageables
  // (listEquipes via la catégorie M14). État honnête : chargement →
  // cases, erreur, ou « aucune équipe ». Jamais de case fantôme.
  // ────────────────────────────────────────────────────────────────
  let _eq4aLoadedForCat = null;  // idempotence : catégorie déjà peuplée

  async function peuplerEquipesEngagees() {
    const wrap = document.getElementById('evt-create-equipes');
    if (!wrap) return;

    // Idempotent : déjà peuplé pour cette catégorie → ne pas recharger
    // (évite un re-fetch à chaque changement de sous-type/format).
    if (_eq4aLoadedForCat && _eq4aLoadedForCat === CTX_CATEGORIE_ID
        && wrap.querySelector('input[type=checkbox]')) {
      return;
    }

    if (!CTX_CATEGORIE_ID) {
      wrap.innerHTML = '<div class="evt-form-error">Catégorie non '
        + 'résolue : impossible de lister les équipes engageables. '
        + 'L\'évènement reste créable ; complétez l\'engagement '
        + 'depuis la fiche.</div>';
      return;
    }

    wrap.innerHTML = '<div class="evt-form-hint">Chargement des équipes…</div>';

    let equipes = [];
    try {
      equipes = await SupabaseHub.listEquipes(CTX_CATEGORIE_ID);
    } catch (e) {
      console.error('peuplerEquipesEngagees()', e);
      equipes = [];
    }

    if (!Array.isArray(equipes) || equipes.length === 0) {
      wrap.innerHTML = '<div class="evt-form-hint">Aucune équipe '
        + 'active dans cette catégorie pour la saison en cours.</div>';
      _eq4aLoadedForCat = CTX_CATEGORIE_ID;
      return;
    }

    // v1.30 — FORMAT INTÉGRÉ dans la ligne d'équipe (décision Manu :
    // « format par équipe sur la même ligne que la case »). Le bloc
    // séparé #evt-create-format-par-equipe est neutralisé (cf.
    // updateMultiEquipesUI). Sur chaque ligne : case à cocher + libellé,
    // puis un <select> format MASQUÉ par défaut, RÉVÉLÉ quand la case est
    // cochée. Classes/attributs IDENTIQUES à l'ancien bloc
    // (.evt-eng-format-row[data-equipe-id] .evt-eng-format-select) pour
    // que submitModalCreate lise le format SANS modification.
    // Pré-sélection du format réel (data-format = format_jeu_code,
    // listEquipes v1.34 L2028) avec garde de dégradation honnête.
    const FORMATS = [
      { v: '',   l: '— Hérité —' },
      { v: 'XV', l: 'XV (15)' },
      { v: '13', l: 'XIII' },
      { v: '12', l: 'XII' },
      { v: 'X',  l: 'X' },
      { v: '9',  l: 'IX' },
      { v: '8',  l: 'VIII' },
      { v: '7',  l: 'VII' }
    ];
    const html = equipes.map(function (eq) {
      const label = escHtml(
        eq.nom_officiel || eq.libelle_court || eq.code || eq.id);
      const fmtReel = eq.format_jeu_code ? String(eq.format_jeu_code) : '';
      const matchFmt = FORMATS.some(function (f) { return f.v && f.v === fmtReel; });
      const optsHtml = FORMATS.map(function (f) {
        const sel = (matchFmt && f.v === fmtReel) ? ' selected' : '';
        return '<option value="' + escHtml(f.v) + '"' + sel + '>' + escHtml(f.l) + '</option>';
      }).join('');
      return '<div class="evt-eng-equipe-line" '
        + 'style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">'
        + '<label class="evt-eng-equipe-row">'
          + '<input type="checkbox" class="evt-eng-equipe-cb" '
          + 'value="' + escHtml(eq.id) + '" '
          + 'data-format="' + escHtml(fmtReel) + '"> '
          + label
        + '</label>'
        + '<span class="evt-eng-format-row evt-eng-format-inline" '
          + 'data-equipe-id="' + escHtml(eq.id) + '" '
          + 'style="display:none; align-items:center; gap:6px; margin-left:auto;">'
          + '<select class="evt-form-select evt-eng-format-select" '
          + 'style="min-width:130px;" title="Format de jeu de cette équipe">'
          + optsHtml + '</select>'
        + '</span>'
      + '</div>';
    }).join('');
    wrap.innerHTML = html;
    _eq4aLoadedForCat = CTX_CATEGORIE_ID;

    // Hook change : (1) révèle/masque le select format de CETTE ligne
    // (visible seulement si cochée, décision Manu) ; (2) met à jour les
    // blocs dynamiques (adv/phases/N2) via updateMultiEquipesUI.
    wrap.querySelectorAll('.evt-eng-equipe-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const line = cb.closest('.evt-eng-equipe-line');
        const fmtRow = line ? line.querySelector('.evt-eng-format-inline') : null;
        if (fmtRow) fmtRow.style.display = cb.checked ? 'inline-flex' : 'none';
        // v1.35 — Recalcule le MODE (pas seulement les blocs multi-équipes) :
        // un match officiel/amical bascule A3↔A4 selon qu'on coche 1 ou 2+
        // équipes. updateCreateConditionalFields rappelle updateMultiEquipesUI
        // en fin de course, et peuplerEquipesEngagees est idempotent
        // (_eq4aLoadedForCat) → la case qu'on vient de cocher n'est pas
        // détruite.
        updateCreateConditionalFields();
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  // v1.16 — U1/U2 : lignes répétables (UI pure, AUCUNE persistance —
  // M3/M5 write = dette tracée v1.18 ; cf. en-tête v1.16 périmètre
  // honnête). escHtml réutilisé (helper existant).
  // ────────────────────────────────────────────────────────────────

  // 4c — patron unique répétable (mono comme multi), UX §2.4/4c.
  function addAdversaireRow(valeur) {
    const wrap = document.getElementById('evt-create-adv-lines');
    if (!wrap) return;
    const row = document.createElement('div');
    row.className = 'evt-eng-adv-row';
    row.innerHTML =
      '<input type="text" class="evt-form-input" placeholder="Nom de l\'adversaire" '
      + 'value="' + escHtml(valeur || '') + '">'
      + '<button type="button" class="evt-eng-btn-remove" '
      + 'title="Retirer cet adversaire" aria-label="Retirer">×</button>';
    row.querySelector('.evt-eng-btn-remove').addEventListener('click', function () {
      row.remove();
    });
    wrap.appendChild(row);
  }

  // U2 §3.2 — phase-boîte répétable (nom + ordre) contenant des matchs
  // répétables (adversaire + sélecteur d'équipe). 2 niveaux d'UI,
  // AUCUNE sous-phase (plafond M6 §4.4). UI pure.
  function addMatchRow(matchesWrap) {
    const row = document.createElement('div');
    row.className = 'evt-phase-match-row';
    row.innerHTML =
      '<input type="text" class="evt-form-input" placeholder="Adversaire du match">'
      + '<select class="evt-form-select">'
      +   '<option value="">— Toutes les équipes engagées —</option>'
      + '</select>'
      + '<button type="button" class="evt-eng-btn-remove" '
      + 'title="Retirer ce match" aria-label="Retirer">×</button>';
    row.querySelector('.evt-eng-btn-remove').addEventListener('click', function () {
      row.remove();
    });
    matchesWrap.appendChild(row);
  }

  function addPhaseBox() {
    const list = document.getElementById('evt-create-phases-list');
    if (!list) return;
    const box = document.createElement('div');
    box.className = 'evt-phase-box';
    box.innerHTML =
      '<div class="evt-phase-box-head">'
      +   '<input type="text" class="evt-form-input" placeholder="Nom de la phase (ex : Poule de brassage)">'
      +   '<button type="button" class="evt-eng-btn-remove" '
      +   'title="Retirer cette phase" aria-label="Retirer">×</button>'
      + '</div>'
      + '<div class="evt-phase-matches"></div>'
      + '<button type="button" class="evt-eng-btn evt-phase-add-match">+ Match</button>';
    box.querySelector('.evt-eng-btn-remove').addEventListener('click', function () {
      box.remove();
    });
    const matchesWrap = box.querySelector('.evt-phase-matches');
    box.querySelector('.evt-phase-add-match').addEventListener('click', function () {
      addMatchRow(matchesWrap);
    });
    list.appendChild(box);
    addMatchRow(matchesWrap); // une phase démarre avec 1 match
  }

  /**
   * Génère un code unique pour le nouvel évent (pattern interne).
   * Format : EVT-YYYY-MM-DD-<TYPE>-M14-<RAND>
   */
  function generateEventCode(type, dateDebut) {
    const d = new Date(dateDebut);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const typeShort = (type === 'competition' ? 'COMP'
                    : type === 'entrainement' ? 'ENTR'
                    : type === 'stage' ? 'STAGE'
                    // fallback défensif anciennes valeurs (mortes en base)
                    : type === 'tournoi' ? 'TOURN'
                    : type === 'match' ? 'MATCH'
                    : type === 'journee_championnat' ? 'JCHAMP'
                    : 'EVT');
    // v1.32 — Entropie renforcée contre la collision `evenements_code_key`.
    // La RPC sql/52 dérive les codes enfants du code racine
    // (v_phase_code := p_code || '-PH'..., v_match_code := ...-M...), donc
    // un tournoi crée racine + N phases + N matchs tous préfixés par CE
    // code. Or l'ancien format (jour + 4 chars) gardait un préfixe
    // CONSTANT pour tous les essais d'un même jour/type → seuls 4 chars
    // distinguaient → collision en recette (essais répétés). Fix : on
    // horodate à la SECONDE et on porte le rand à 6 chars.
    // IMPORTANT : HHMMSS vient de l'INSTANT DE GÉNÉRATION (now), PAS de
    // dateDebut — sinon deux essais avec la même date d'évènement
    // pré-remplie produiraient le même HHMMSS. La date métier (dateDebut)
    // ne sert qu'au segment AAAA-MM-JJ (lisibilité). Deux créations à des
    // secondes différentes sont donc forcément distinctes ; le rand 6
    // couvre la même seconde. Couvre racine ET enfants (préfixe commun).
    const now = new Date();
    const HH = String(now.getHours()).padStart(2, '0');
    const MM = String(now.getMinutes()).padStart(2, '0');
    const SS = String(now.getSeconds()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return 'EVT-' + y + '-' + m + '-' + day + '-' + HH + MM + SS
         + '-' + typeShort + '-M14-' + rand;
  }

  // ────────────────────────────────────────────────────────────────
  // v1.17 — Persistance Phases & matchs M6 (orchestration en cascade).
  // 3 niveaux v1.2 §4.4 : racine (déjà créée) → phase-boîte → match.
  // Table `evenements` UNIQUEMENT (createEvenement) — PAS M3/M5.
  // INVARIANT SUIVI : chaque match = vraie ligne `evenements`
  // (compositions.evenement_id s'y rattache, A/B/C non régressés).
  // Stratégie d'échec = création PROGRESSIVE (décision Manu) : on
  // n'annule rien, on s'arrête, on rend compte exactement.
  //
  // racineId   : UUID de la compétition racine déjà créée
  // heritage   : { saison_id, organisateur_principal_id,
  //                type_competition, format_de_jeu, site_id }
  //              (valeurs connues au submit — pas de relecture base)
  // Retour : { phasesOk, matchsOk, stopped:bool, stopInfo:string }
  // ────────────────────────────────────────────────────────────────
  async function persisterPhasesEtMatchs(racineId, heritage) {
    const list = document.getElementById('evt-create-phases-list');
    const result = { phasesOk: 0, matchsOk: 0, stopped: false, stopInfo: '' };
    if (!list) return result;
    const boxes = list.querySelectorAll('.evt-phase-box');

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const phaseInput = box.querySelector('.evt-phase-box-head input[type="text"]');
      const phaseLibelle = phaseInput ? phaseInput.value.trim() : '';
      if (!phaseLibelle) {
        // Phase sans nom : P4 « avertir, ne pas bloquer » — on saute
        // cette phase-boîte sans interrompre (UX §3.3 : avertir).
        continue;
      }

      // Niveau 2 — phase-boîte : ligne evenements enfant de la racine,
      // phase_libelle renseigné, PAS d'adversaire (M6 §4.4).
      const phasePayload = {
        code:                       generateEventCode('competition', new Date().toISOString()),
        libelle:                    phaseLibelle,
        type_evenement:             'competition',
        type_competition:           heritage.type_competition || 'tournoi',
        saison_id:                  heritage.saison_id,
        organisateur_principal_id:  heritage.organisateur_principal_id,
        date_debut:                 heritage.date_debut,
        evenement_parent_id:        racineId,
        phase_libelle:              phaseLibelle,
        ordre_dans_phase:           i + 1
      };
      if (heritage.format_de_jeu) phasePayload.format_de_jeu = heritage.format_de_jeu;
      if (heritage.site_id)       phasePayload.site_id       = heritage.site_id;

      const phaseRes = await SupabaseHub.createEvenement(phasePayload);
      if (!phaseRes || !phaseRes.ok || !phaseRes.data || !phaseRes.data.id) {
        result.stopped = true;
        result.stopInfo = 'phase « ' + phaseLibelle + ' » : '
          + ((phaseRes && phaseRes.error) || 'erreur inconnue');
        return result; // création progressive : on s'arrête, on garde l'acquis
      }
      result.phasesOk++;
      const phaseId = phaseRes.data.id;

      // Niveau 3 — matchs de CETTE phase-boîte.
      const matchRows = box.querySelectorAll('.evt-phase-match-row');
      for (let j = 0; j < matchRows.length; j++) {
        const row = matchRows[j];
        const advInput = row.querySelector('input[type="text"]');
        const eqSelect = row.querySelector('select');
        const adv = advInput ? advInput.value.trim() : '';
        if (!adv) {
          // Match sans adversaire : P4 avertir, ne pas bloquer — sauté.
          continue;
        }
        const matchPayload = {
          code:                       generateEventCode('competition', new Date().toISOString()),
          libelle:                    phaseLibelle + ' — vs ' + adv,
          type_evenement:             'competition',
          type_competition:           heritage.type_competition || 'tournoi',
          saison_id:                  heritage.saison_id,
          organisateur_principal_id:  heritage.organisateur_principal_id,
          date_debut:                 heritage.date_debut,
          evenement_parent_id:        phaseId,        // parent = la PHASE-BOÎTE (3 niveaux)
          adversaire_nom:             adv
        };
        if (heritage.format_de_jeu) matchPayload.format_de_jeu = heritage.format_de_jeu;
        if (heritage.site_id)       matchPayload.site_id       = heritage.site_id;
        // Équipe précise (valeur du select) ou NULL = « toutes les
        // équipes engagées » (M6 §4.4 ; le select porte un UUID ou '').
        if (eqSelect && eqSelect.value) matchPayload.equipe_id = eqSelect.value;

        const matchRes = await SupabaseHub.createEvenement(matchPayload);
        if (!matchRes || !matchRes.ok) {
          result.stopped = true;
          result.stopInfo = 'match « vs ' + adv + ' » (phase « ' + phaseLibelle
            + ' ») : ' + ((matchRes && matchRes.error) || 'erreur inconnue');
          return result;
        }
        result.matchsOk++;
      }
    }
    return result;
  }

  /**
   * v1.24 — Soumission modale création refondue (5 modes adaptatifs).
   * Construit le payload composite et appelle SupabaseHub.
   * createEvenementComplet (RPC composite atomique sql/52). Voie
   * « rapide » R3 §3.1.6 doc UX.
   *
   * Modes (cf. updateCreateConditionalFields) :
   *   A1 = entrainement (récurrence optionnelle, equipe_id M14)
   *   A2 = stage (equipe_id M14, date_fin)
   *   A3 = competition + sous-type simple (1 équipe + 1 adversaire)
   *   A4 = competition + plateau (multi-équipes, adv-par-équipe,
   *        phases optionnelles, affectations N2)
   *   A5 = competition + tournoi (phases obligatoires par équipe)
   *
   * Pour A1/A2 : payload minimaliste (pas d'equipes_engagees).
   * Pour A3 : 1 équipe engagée + 1 adversaire (M5).
   * Pour A4/A5 : N équipes engagées + N adversaires par équipe + N
   *              phases par équipe + N affectations N2 plateau.
   *
   * Mode duplication : reste sur duplicateEvenement existant (voie
   * « lente » REST inchangée, R4 §3.1.6).
   */
  async function submitModalCreate() {
    const submitBtn = document.getElementById('evt-create-submit');
    const msg = document.getElementById('evt-create-msg');
    if (!submitBtn || !msg) return;

    if (!CTX_SAISON_ID || !CTX_ORGANISATEUR_ID) {
      msg.innerHTML = '<div class="evt-form-error">Contexte saison/organisateur non chargé. Rechargez la page.</div>';
      return;
    }

    const f = document.getElementById('evt-create-form');
    if (!f) return;

    const typeChecked = f.querySelector('input[name=type_evenement]:checked');
    if (!typeChecked) {
      msg.innerHTML = '<div class="evt-form-error">Veuillez sélectionner un type d\'évènement</div>';
      return;
    }
    const type        = typeChecked.value;
    const familleEvt  = familleReelle(type);
    const libelle     = f.elements.libelle.value.trim();
    const dateDebut   = f.elements.date_debut.value;
    const dateFin     = f.elements.date_fin.value;
    const siteId      = f.elements.site_id.value;
    const typeCompet  = f.elements.type_competition.value;
    const adversaire  = f.elements.adversaire_nom.value.trim();
    const domicile    = f.elements.domicile_exterieur.value;
    const notes       = f.elements.notes_internes ? f.elements.notes_internes.value.trim() : '';

    // Validation
    if (!libelle) {
      msg.innerHTML = '<div class="evt-form-error">Le libellé est requis</div>';
      return;
    }
    if (!dateDebut) {
      msg.innerHTML = '<div class="evt-form-error">La date de début est requise</div>';
      return;
    }
    if (familleEvt === 'competition' && !typeCompet) {
      msg.innerHTML = '<div class="evt-form-error">Le sous-type est requis pour une compétition</div>';
      return;
    }

    // Branche duplication : voie « lente » REST inchangée (R4 §3.1.6)
    const modeChecked = f.querySelector('input[name=create_mode]:checked');
    const isDuplication = modeChecked && modeChecked.value === 'dupliquer' && MODAL_CREATE_DUP_SRC_ID;
    if (isDuplication) {
      return submitModalCreateDuplication(libelle, dateDebut, dateFin, siteId,
        familleEvt, typeCompet, adversaire, domicile);
    }

    // ──────────────────────────────────────────────────────────────
    // Construction payload composite createEvenementComplet (RPC sql/52)
    // ──────────────────────────────────────────────────────────────
    const payload = {
      type_evenement:              familleEvt,
      libelle:                     libelle,
      code:                        generateEventCode(familleEvt, dateDebut),
      date_debut:                  new Date(dateDebut).toISOString(),
      saison_id:                   CTX_SAISON_ID,
      organisateur_principal_id:   CTX_ORGANISATEUR_ID
    };

    // Champs optionnels racines
    if (dateFin)   payload.date_fin = new Date(dateFin).toISOString();
    if (siteId)    payload.site_id  = siteId;
    if (typeCompet)payload.type_competition = typeCompet;
    if (domicile)  payload.domicile_exterieur = domicile;
    if (notes)     payload.notes_internes = notes;

    // v1.42 (étape 3/4 horaires détaillés) — lecture des 4 champs horaires
    // (type=time → "HH:MM" ou "" ; type=text pour le lieu). Ajoutés au
    // payload seulement si renseignés (champs optionnels, RPC v7 DEFAULT
    // NULL). Persistés sur la racine via createEvenementComplet.
    const _debutMatch = (document.getElementById('evt-create-debut-match') || {}).value || '';
    const _finPrevue  = (document.getElementById('evt-create-fin-prevue')  || {}).value || '';
    const _rdvHeure   = (document.getElementById('evt-create-rdv-heure')   || {}).value || '';
    const _rdvLieu    = ((document.getElementById('evt-create-rdv-lieu')   || {}).value || '').trim();
    if (_debutMatch) payload.debut_match = _debutMatch;
    if (_finPrevue)  payload.fin_prevue  = _finPrevue;
    if (_rdvHeure)   payload.rdv_heure   = _rdvHeure;
    if (_rdvLieu)    payload.rdv_lieu    = _rdvLieu;

    // EVT-CREATION-HEURE-MINUIT (v1.63) — composition date + heure.
    // Convention pt 167 : « minuit UTC pile = heure NON saisie ». Or la
    // racine naissait (création) et était RE-CALÉE (édition, même submit)
    // à minuit UTC alors que debut_match était renseigné → mère « sans
    // heure » aux agendas (cause racine du bug minuit tracé pt 183).
    // Si l'heure de début est saisie, on la compose avec la date en
    // parsing LOCAL (spec JS : 'YYYY-MM-DDTHH:MM' SANS suffixe Z = heure
    // locale du navigateur, qui porte le bon fuseau — témoin : 19:15
    // Paris été → 17:15Z) puis toISOString(). Même patron que l'ajout de
    // match à un tournoi (setHours local + toISOString). Sans heure
    // saisie : comportement inchangé, la convention minuit reste vraie.
    // Occurrences : aucun impact (le générateur lit debut_match, pas
    // l'heure de la mère — prouvé S3 du chantier). Duplication : rien à
    // faire (duplicateEvenement ne copie pas debut_match → la copie est
    // légitimement « sans heure »).
    if (_debutMatch) {
      payload.date_debut = new Date(dateDebut + 'T' + _debutMatch).toISOString();
    }

    // Rattachement CATÉGORIE (chantier EVT-RATTACHEMENT-CATEGORIE).
    // La catégorie active du sélecteur (CTX_PERIMETRE.active) est la
    // source de vérité — plus de M14 figé. Requise pour entraînement/
    // stage (CHECK categorie_obligatoire_si_pas_parent). equipe_id
    // racine reste NULL : l'entraînement appartient à la catégorie,
    // pas à une équipe précise (décision modèle 07/07/2026). Pour les
    // compétitions, l'équipe est portée par les M3 equipes_engagees et
    // la catégorie est déduite côté RPC.
    const _catActive = CTX_PERIMETRE && CTX_PERIMETRE.active;
    if (familleEvt === 'entrainement' || familleEvt === 'stage') {
      if (!_catActive) {
        msg.innerHTML = '<div class="evt-form-error">Aucune catégorie active : impossible de rattacher l\'entraînement. Sélectionnez une catégorie en haut de page.</div>';
        return;
      }
      payload.categorie_id = _catActive;
    } else if (_catActive) {
      // Compétition : on transmet la catégorie active en indication ;
      // la RPC la recoupe/déduit des équipes engagées.
      payload.categorie_id = _catActive;
    }

    // Mode A1 récurrence (JSONB recurrence brute, géré côté UI)
    if (familleEvt === 'entrainement') {
      const recToggle = document.getElementById('evt-create-recurrence-toggle');
      if (recToggle && recToggle.checked) {
        const freq = (document.getElementById('evt-create-recurrence-frequence') || {}).value || 'hebdomadaire';
        const fin  = (document.getElementById('evt-create-recurrence-fin') || {}).value || '';
        payload.recurrence = {
          mode: 'recurrent',
          frequence: freq,
          fin: fin || null
        };
      }
    }

    // Modes A3/A4/A5 : engagement (M3 + M5)
    if (familleEvt === 'competition') {
      const cbList = Array.prototype.slice.call(
        document.querySelectorAll('#evt-create-equipes .evt-eng-equipe-cb:checked'));
      if (cbList.length === 0) {
        msg.innerHTML = '<div class="evt-form-error">Au moins une équipe doit être engagée pour une compétition</div>';
        return;
      }

      // Mode A3 (1 équipe + 1 adversaire mono) : compétition simple SEULE.
      // v1.28 — exclut plateau ET tous les sous-types à phases
      // (tournoi/Vié/inter-ligues/Seven) ; sinon un Vié/Seven à 1 équipe
      // basculerait à tort en adversaire mono au lieu de l'éditeur de phases.
      const isA3 = cbList.length === 1
        && typeCompet !== 'plateau'
        && PHASES_SOUS_TYPES.indexOf(typeCompet) === -1;

      payload.equipes_engagees = cbList.map(function (cb, idx) {
        const eqId = cb.value;
        const localId = 'equipe_' + (idx + 1);
        const eng = {
          equipe_id:                 eqId,
          evenement_equipe_id_local: localId,
          ordre:                     idx + 1
        };

        // Format par équipe (override M4) si présent. v1.30 — le select
        // vit désormais dans la ligne d'équipe (#evt-create-equipes) ;
        // fallback sur l'ancien conteneur #evt-create-format-lines au cas
        // où (robustesse). Mêmes classes .evt-eng-format-row[data-equipe-id]
        // .evt-eng-format-select dans les deux cas.
        const formatRow = document.querySelector(
          '#evt-create-equipes .evt-eng-format-row[data-equipe-id="' + eqId + '"] .evt-eng-format-select')
          || document.querySelector(
          '#evt-create-format-lines .evt-eng-format-row[data-equipe-id="' + eqId + '"] .evt-eng-format-select');
        if (formatRow && formatRow.value) {
          eng.format_de_jeu = formatRow.value;
        }

        // Adversaires de cette équipe : A3 mono, ou A4 plateau par équipe.
        // JAMAIS pour un sous-type à phases (tournoi/Vié/inter-ligues/Seven) :
        // les matchs sont portés par l'éditeur de phases → bloc adv masqué,
        // non lu, anti-doublon v1.28.
        const advs = [];
        if (isA3 && adversaire) {
          advs.push({ adversaire_nom: adversaire, ordre: 1 });
        } else if (PHASES_SOUS_TYPES.indexOf(typeCompet) === -1) {
          // v1.36 — A4 : lecture robuste aux DEUX variantes (plateau =
          // N adversaires + poule ; match officiel/amical multi-équipes =
          // 1 adversaire/équipe, pas de poule). On lit tous les
          // .evt-eng-adv-input (1 ou N) ; ordre incrémental sur les non-
          // vides. Le nom de poule (.evt-eng-poule-input, absent en variante
          // match → null) va dans eng.notes (M3) — pas de colonne dédiée.
          const advRow = document.querySelector(
            '#evt-create-adv-par-equipe-lines .evt-eng-adv-row[data-equipe-id="' + eqId + '"]');
          if (advRow) {
            const inputs = advRow.querySelectorAll('.evt-eng-adv-input');
            let ord = 0;
            Array.prototype.forEach.call(inputs, function (inp) {
              const val = inp.value.trim();
              if (val) { ord += 1; advs.push({ adversaire_nom: val, ordre: ord }); }
            });
            const pouleInput = advRow.querySelector('.evt-eng-poule-input');
            if (pouleInput && pouleInput.value.trim()) {
              eng.notes = pouleInput.value.trim();
            }
          }
        }
        if (advs.length > 0) eng.adversaires = advs;

        return eng;
      });

      // Phases par équipe (éditeur réel v1.27) : sous-types à phases
      // (tournoi/Vié/inter-ligues/Seven) UNIQUEMENT — v1.28 source unique
      // PHASES_SOUS_TYPES. Le plateau A4 n'a pas de phases.
      const phasesOui = (PHASES_SOUS_TYPES.indexOf(typeCompet) !== -1);

      if (phasesOui) {
        // v1.27 — Lecture RÉELLE de l'éditeur de phases (plus de phase
        // fantôme « Phase 1 » codée en dur). Pour chaque équipe cochée,
        // on lit sa carte .evt-phases-equipe-block : ses phases (libellé
        // + date optionnelle) et, pour chacune, ses matchs (emplacement
        // adversaire texte libre « adv N » ajustable, D5).
        // Mapping → contrat RPC p_phases_par_equipe (doc FAIT FOI §4) :
        //   { evenement_equipe_id_local, phases:[ { libelle, date_debut?,
        //     ordre, matchs:[ { libelle?, adversaire_nom?, ordre } ] } ] }
        const editorWrap = document.getElementById('evt-create-phases-par-equipe-list');
        const phasesPayload = [];
        let phaseValidationError = null;

        cbList.forEach(function (cb, idx) {
          const eqId = cb.value;
          const localId = 'equipe_' + (idx + 1);
          const eqLabel = cb.parentElement ? cb.parentElement.textContent.trim() : eqId;
          const block = editorWrap
            ? editorWrap.querySelector('.evt-phases-equipe-block[data-equipe-id="' + eqId + '"]')
            : null;
          const phaseBoxes = block
            ? Array.prototype.slice.call(block.querySelectorAll('.evt-phase-box'))
            : [];

          if (phaseBoxes.length === 0) {
            // D-PROD-1 : départ vide → validation client honnête (≥ 1 phase
            // par équipe exigée par la RPC en mode phases). On signale, on
            // n'invente pas de phase fantôme.
            if (!phaseValidationError) {
              phaseValidationError = 'Au moins une phase est requise pour l\'équipe « '
                + eqLabel + ' ». Cliquez « + Phase » dans le bloc « Phases & matchs ».';
            }
            return;
          }

          const phases = phaseBoxes.map(function (box, pIdx) {
            const libInput  = box.querySelector('.evt-phase-libelle');
            const dateInput = box.querySelector('.evt-phase-date');
            const lib = (libInput && libInput.value.trim()) || ('Phase ' + (pIdx + 1));
            const phase = { libelle: lib, ordre: pIdx + 1 };
            if (dateInput && dateInput.value) {
              phase.date_debut = new Date(dateInput.value).toISOString();
            }
            const matchRows = Array.prototype.slice.call(
              box.querySelectorAll('.evt-phase-match-row'));
            const matchs = [];
            matchRows.forEach(function (row, mIdx) {
              const advInput = row.querySelector('.evt-match-adversaire');
              const adv = advInput ? advInput.value.trim() : '';
              // v1.31 fix — chaque match devient une ligne `evenements`
              // (M6) côté RPC : `libelle` y est NOT NULL. On dérive donc
              // toujours un libellé (jamais NULL) : « vs <adv> » si un
              // adversaire est saisi, sinon « Match N ». Aligné sur la voie
              // duplication (submitModalCreateDuplication : phaseLibelle +
              // ' — vs ' + adv). Sans ça : null value column "libelle"
              // violates not-null constraint (bug terrain essai 4).
              const m = {
                ordre:   mIdx + 1,
                libelle: adv ? ('vs ' + adv) : ('Match ' + (mIdx + 1))
              };
              if (adv) m.adversaire_nom = adv;
              matchs.push(m);
            });
            if (matchs.length > 0) phase.matchs = matchs;
            return phase;
          });

          phasesPayload.push({
            evenement_equipe_id_local: localId,
            phases: phases
          });
        });

        if (phaseValidationError) {
          msg.innerHTML = '<div class="evt-form-error">' + escHtml(phaseValidationError) + '</div>';
          const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
          if (modalBody) modalBody.scrollTop = 0;
          return;
        }

        payload.phases_par_equipe = phasesPayload;
      }
    }

    // Encadrement M8 (tous modes, E-1 acté)
    const staffCbs = Array.prototype.slice.call(
      document.querySelectorAll('#evt-create-staff .evt-eng-staff-cb:checked'));
    if (staffCbs.length > 0) {
      payload.encadrants = staffCbs.map(function (cb) { return cb.value; });
    }

    // Affectations N2 plateau (mode A4 multi-équipes uniquement)
    if (familleEvt === 'competition' && typeCompet === 'plateau') {
      const n2Rows = document.querySelectorAll(
        '#evt-create-affectations-n2-lines .evt-eng-n2-row');
      const affectations = [];
      Array.prototype.forEach.call(n2Rows, function (row, idx) {
        const select = row.querySelector('.evt-eng-n2-select');
        if (select && select.value) {
          affectations.push({
            evenement_equipe_id_local: 'equipe_' + (idx + 1),
            personne_id: select.value
          });
        }
      });
      if (affectations.length > 0) {
        payload.affectations_n2 = affectations;
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Appel RPC composite
    // ──────────────────────────────────────────────────────────────
    const isEdit = !!MODAL_CREATE_EDIT_ID;
    submitBtn.disabled = true;
    submitBtn.textContent = isEdit ? 'Enregistrement…' : 'Création…';
    msg.innerHTML = '';

    try {
      const res = isEdit
        ? await SupabaseHub.modifierEvenementComplet(MODAL_CREATE_EDIT_ID, payload)
        : await SupabaseHub.createEvenementComplet(payload);

      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : '
          + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Enregistrer les modifications' : "Créer l'évènement";
        return;
      }

      const resultId = res.evenementId || MODAL_CREATE_EDIT_ID;
      msg.innerHTML = '<div class="evt-form-success">✅ '
        + (isEdit ? 'Modifications enregistrées.' : 'Évènement créé (transaction atomique).')
        + '</div>';

      const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;

      setTimeout(async () => {
        closeModalCreate();
        await reloadEvents();
        // Ouvre la fiche : toujours en édition, ou si compétition en création
        if (isEdit && resultId) {
          openFiche(resultId);
        } else if (familleEvt === 'competition' && resultId) {
          openFiche(resultId);
        }
      }, 500);
    } catch (err) {
      console.error('submitModalCreate', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : '
        + escHtml(err.message || String(err)) + '</div>';
      const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = MODAL_CREATE_EDIT_ID ? 'Enregistrer les modifications' : "Créer l'évènement";
    }
  }

  /**
   * v1.24 — Branche duplication isolée (préserve la logique v1.17/v1.18).
   * Voie « lente » REST (duplicateEvenement + add wrappers progressifs),
   * inchangée. R4 §3.1.6 doc UX intact.
   */
  async function submitModalCreateDuplication(libelle, dateDebut, dateFin,
                                              siteId, familleEvt, typeCompet,
                                              adversaire, domicile) {
    const submitBtn = document.getElementById('evt-create-submit');
    const msg = document.getElementById('evt-create-msg');
    if (!submitBtn || !msg) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Duplication…';
    msg.innerHTML = '';

    // EVT-RATTACHEMENT-CATEGORIE : la copie hérite de la catégorie ACTIVE
    // (plus de M14 figé). equipe_id racine null pour tous les types
    // (l'entraînement appartient à la catégorie ; la compétition porte ses
    // équipes via les M3). categorie_id requis pour entraînement/stage.
    const _catActiveDup = CTX_PERIMETRE && CTX_PERIMETRE.active;
    if ((familleEvt === 'entrainement' || familleEvt === 'stage') && !_catActiveDup) {
      msg.innerHTML = '<div class="evt-form-error">Aucune catégorie active : impossible de dupliquer. Sélectionnez une catégorie en haut de page.</div>';
      submitBtn.disabled = false;
      submitBtn.textContent = "Créer l'évènement";
      return;
    }
    const overrides = {
      code:                      generateEventCode(familleEvt, dateDebut),
      libelle:                   libelle,
      type_evenement:            familleEvt,
      date_debut:                new Date(dateDebut).toISOString(),
      equipe_id:                 null,
      categorie_id:              _catActiveDup || null,
      saison_id:                 CTX_SAISON_ID,
      organisateur_principal_id: CTX_ORGANISATEUR_ID
    };
    if (dateFin)    overrides.date_fin = new Date(dateFin).toISOString();
    if (siteId)     overrides.site_id = siteId;
    if (typeCompet) overrides.type_competition = typeCompet;
    if (adversaire) overrides.adversaire_nom = adversaire;
    if (domicile)   overrides.domicile_exterieur = domicile;

    try {
      const res = await SupabaseHub.duplicateEvenement(MODAL_CREATE_DUP_SRC_ID, overrides);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec duplication : '
          + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        submitBtn.disabled = false;
        submitBtn.textContent = "Créer l'évènement";
        return;
      }
      const createdId = res.data && res.data.id ? res.data.id : null;
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement dupliqué.</div>';
      setTimeout(async () => {
        closeModalCreate();
        await reloadEvents();
        if (familleEvt === 'competition' && createdId) {
          openFiche(createdId);
        }
      }, 500);
    } catch (err) {
      console.error('submitModalCreateDuplication', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : '
        + escHtml(err.message || String(err)) + '</div>';
      submitBtn.disabled = false;
      submitBtn.textContent = "Créer l'évènement";
    }
  }

  // ────────────────────────────────────────────────
  // E4 — Modale Annulation
  // ────────────────────────────────────────────────

  function openModalCancel(evenementId) {
    if (!evenementId) return;
    MODAL_CANCEL_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];
    const info = document.getElementById('evt-cancel-info');
    const motif = document.getElementById('evt-cancel-motif');
    const msg = document.getElementById('evt-cancel-msg');
    if (motif) motif.value = '';
    if (msg)   msg.innerHTML = '';
    if (info && evt) {
      let html = '<span class="evt-modal-info-strong">';
      html += escHtml(formatDateShort(evt.date_debut)) + ' · ';
      html += escHtml(TYPE_LABELS[evt.type_evenement] || evt.type_evenement);
      html += '</span><br>';
      html += escHtml(evt.libelle || '(sans libellé)');
      if (evt.site_libelle_court) html += ' · ' + escHtml(evt.site_libelle_court);
      if (evt.adversaire_nom) html += ' · vs ' + escHtml(evt.adversaire_nom);
      // KPI compo
      if (evt.compo_status_summary && evt.compo_status_summary.total > 0) {
        html += '<br><em style="color:var(--ink-mute);">Cette annulation laissera orphelines : ' + evt.compo_status_summary.total + ' composition(s).</em>';
      }
      info.innerHTML = html;
    } else if (info) {
      info.innerHTML = '<em>Évènement non trouvé en cache.</em>';
    }
    document.getElementById('evt-overlay-cancel').classList.add('show');
  }

  function closeModalCancel() {
    MODAL_CANCEL_EVENT_ID = null;
    document.getElementById('evt-overlay-cancel').classList.remove('show');
  }

  async function submitModalCancel() {
    if (!MODAL_CANCEL_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-cancel-submit');
    const msg = document.getElementById('evt-cancel-msg');
    const motifInput = document.getElementById('evt-cancel-motif');
    if (!submitBtn || !msg || !motifInput) return;

    const motif = motifInput.value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Annulation…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.cancelEvenement(MODAL_CANCEL_EVENT_ID, motif);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const modalBody = document.querySelector('#evt-overlay-cancel .evt-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = "Annuler l'évènement";
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement annulé.</div>';
      const modalBody = document.querySelector('#evt-overlay-cancel .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      setTimeout(async () => {
        const wasId = MODAL_CANCEL_EVENT_ID;
        closeModalCancel();
        closeFiche();
        await reloadEvents();
        // Ré-ouvre la fiche pour montrer l'état "annulé" + bouton Réactiver
        if (wasId) openFiche(wasId);
      }, 500);
    } catch (err) {
      console.error('submitModalCancel', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : ' + escHtml(err.message || String(err)) + '</div>';
      const modalBody = document.querySelector('#evt-overlay-cancel .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = "Annuler l'évènement";
    }
  }

  // ────────────────────────────────────────────────
  // E5 — Modale Ajout match au tournoi
  // ────────────────────────────────────────────────

  function openModalAddMatch(tournoiId) {
    if (!tournoiId) return;
    const tournoi = EVENTS_BY_ID[tournoiId];
    MODAL_ADDMATCH_TOURNOI = tournoi || { id: tournoiId };

    const info = document.getElementById('evt-addmatch-info');
    const form = document.getElementById('evt-addmatch-form');
    const msg = document.getElementById('evt-addmatch-msg');
    if (form) form.reset();
    if (msg)  msg.innerHTML = '';

    if (info && tournoi) {
      let html = '<span class="evt-modal-info-strong">' + escHtml(tournoi.libelle || '(sans libellé)') + '</span>';
      html += '<br>' + escHtml(formatDateShort(tournoi.date_debut));
      if (tournoi.site_libelle_court) html += ' · ' + escHtml(tournoi.site_libelle_court);
      info.innerHTML = html;
    } else if (info) {
      info.innerHTML = '<em>Tournoi parent en chargement…</em>';
    }

    // Datalist phases existantes (depuis les enfants déjà rattachés)
    const datalist = document.getElementById('evt-addmatch-phases-datalist');
    if (datalist) {
      const existing = (CHILDREN_BY_PARENT[tournoiId] || [])
        .map(c => c.phase_libelle)
        .filter((v, i, arr) => v && arr.indexOf(v) === i);
      datalist.innerHTML = existing.map(p => '<option value="' + escHtml(p) + '"></option>').join('');
    }

    document.getElementById('evt-overlay-addmatch').classList.add('show');
  }

  function closeModalAddMatch() {
    MODAL_ADDMATCH_TOURNOI = null;
    document.getElementById('evt-overlay-addmatch').classList.remove('show');
  }

  async function submitModalAddMatch() {
    if (!MODAL_ADDMATCH_TOURNOI || !MODAL_ADDMATCH_TOURNOI.id) return;
    const submitBtn = document.getElementById('evt-addmatch-submit');
    const msg = document.getElementById('evt-addmatch-msg');
    const form = document.getElementById('evt-addmatch-form');
    if (!submitBtn || !msg || !form) return;

    const phase = form.elements.phase_libelle.value.trim();
    const libelle = form.elements.libelle.value.trim();
    const heure = form.elements.heure.value;
    const adversaire = form.elements.adversaire_nom.value.trim();
    const format = form.elements.format_de_jeu.value;

    if (!libelle) {
      msg.innerHTML = '<div class="evt-form-error">Le libellé est requis</div>';
      return;
    }
    if (!heure) {
      msg.innerHTML = '<div class="evt-form-error">L\'heure de début est requise</div>';
      return;
    }

    // Construit date_debut = jour du tournoi parent + heure choisie
    let dateDebutISO;
    try {
      const parentDate = new Date(MODAL_ADDMATCH_TOURNOI.date_debut);
      const [hh, mm] = heure.split(':').map(n => parseInt(n, 10));
      parentDate.setHours(hh, mm, 0, 0);
      dateDebutISO = parentDate.toISOString();
    } catch (e) {
      msg.innerHTML = '<div class="evt-form-error">Impossible de construire la date du match</div>';
      return;
    }

    // Calcul ordre_dans_phase = max(ordre des matchs de cette phase) + 1
    let ordreDansPhase = 1;
    if (phase) {
      const sameParent = CHILDREN_BY_PARENT[MODAL_ADDMATCH_TOURNOI.id] || [];
      const samePhase = sameParent.filter(c => c.phase_libelle === phase);
      if (samePhase.length > 0) {
        const maxOrdre = Math.max.apply(null, samePhase.map(c => c.ordre_dans_phase || 0));
        ordreDansPhase = maxOrdre + 1;
      }
    }

    const payload = {
      libelle:    libelle,
      date_debut: dateDebutISO,
      ordre_dans_phase: ordreDansPhase
    };
    if (phase)      payload.phase_libelle = phase;
    if (adversaire) payload.adversaire_nom = adversaire;
    if (format)     payload.format_de_jeu = format;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Ajout…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.addMatchToTournoi(MODAL_ADDMATCH_TOURNOI.id, payload);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const modalBody = document.querySelector('#evt-overlay-addmatch .evt-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ajouter le match';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Match ajouté.</div>';
      const modalBody = document.querySelector('#evt-overlay-addmatch .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      setTimeout(async () => {
        const wasTournoiId = MODAL_ADDMATCH_TOURNOI.id;
        closeModalAddMatch();
        await reloadEvents();
        // Re-déplie le tournoi pour montrer le nouveau match
        state.expandedTournois.add(wasTournoiId);
        renderListe();
      }, 500);
    } catch (err) {
      console.error('submitModalAddMatch', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : ' + escHtml(err.message || String(err)) + '</div>';
      const modalBody = document.querySelector('#evt-overlay-addmatch .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ajouter le match';
    }
  }

  // ────────────────────────────────────────────────
  // Helper commun : recharge la liste des évents après modif
  // ────────────────────────────────────────────────

  async function reloadEvents() {
    try {
      const [evtAvenir, evtPasses] = await Promise.all([
        loadEvenementsAVenir(),
        loadEvenementsPasses()
      ]);
      EVENEMENTS_AVENIR = evtAvenir;
      EVENEMENTS_PASSES = evtPasses;
      await buildIndexes();
      renderKPIs();
      renderListe();
      renderMiniCal();
    } catch (err) {
      console.error('reloadEvents() erreur', err);
    }
  }

  // ------------------------------------------------------------
  // SÉLECTEUR DE CATÉGORIE (UX-MULTI-CATEGORIES Lot 2)
  // ------------------------------------------------------------
  // Met à jour le titre de page + le <title> du document avec le code
  // de la catégorie active (remplace le « M14 » figé). Repli silencieux
  // si la catégorie active est introuvable (on garde le libellé en dur).
  function _libelleCategorieActive() {
    if (!CTX_PERIMETRE || !Array.isArray(CTX_PERIMETRE.categories)) return null;
    // Admin/bureau (transverse) A DÉSORMAIS une catégorie active (la
    // mémorisée ou la 1re) → on résout son libellé comme pour un encadrant.
    const c = CTX_PERIMETRE.categories.find(x => x.id === CTX_PERIMETRE.active);
    return c ? (c.libelle_court || c.code || null) : null;
  }

  function _majTitreCategorie() {
    const lib = _libelleCategorieActive();
    if (!lib) return; // périmètre transverse ou non résolu → titre en dur conservé
    const teamSpan = document.querySelector('.evt-header h2 .evt-team');
    if (teamSpan) teamSpan.textContent = lib;
    try { document.title = 'MOM Hub · Évènements ' + lib; } catch (e) { /* honnête */ }
  }

  // Monte le sélecteur dans le header SI le périmètre compte > 1 catégorie.
  // Un encadrant mono-catégorie (1 entrée) n'a pas de sélecteur (UX
  // inchangée). Un compte transverse (admin/bureau) OBTIENT le sélecteur
  // sur toutes les catégories du club (décision Manu). Choisir une
  // catégorie résout ses équipes (listEquipes) et charge leurs évènements ;
  // une catégorie sans équipe sur la saison active affiche un empty state
  // honnête (plus de repli M14). Insertion APRÈS .evt-header, dans la
  // colonne principale ; aucune édition du HTML de la page.
  function _monterSelecteurCategorie() {
    if (!CTX_PERIMETRE || !Array.isArray(CTX_PERIMETRE.categories)) return;
    // Admin/bureau (transverse) obtient AUSSI le sélecteur : ses catégories
    // sont toutes celles du club, il doit pouvoir naviguer entre elles
    // (décision Manu). Seul le cas mono-catégorie (encadrant à 1 entrée)
    // n'a pas de sélecteur.
    if (CTX_PERIMETRE.categories.length <= 1) return;

    const header = document.querySelector('.evt-header');
    if (!header || !header.parentNode) return;
    if (document.getElementById('evt-cat-selecteur-wrap')) return; // anti-doublon

    const wrap = document.createElement('div');
    wrap.id = 'evt-cat-selecteur-wrap';
    wrap.style.cssText = 'display:flex; align-items:center; gap:8px; margin:0 0 14px 0; ' +
      'font-family:\'JetBrains Mono\',monospace; font-size:10px; letter-spacing:0.10em; ' +
      'text-transform:uppercase; color:var(--ink-mute);';

    const label = document.createElement('label');
    label.setAttribute('for', 'evt-cat-selecteur');
    label.textContent = 'Catégorie :';
    label.style.cssText = 'flex-shrink:0;';

    const select = document.createElement('select');
    select.id = 'evt-cat-selecteur';
    select.style.cssText = 'padding:6px 10px; border:1px solid var(--line); border-radius:6px; ' +
      'background:var(--paper-warm); color:var(--ink); font-family:inherit; font-size:11px; ' +
      'letter-spacing:0.06em; cursor:pointer;';

    CTX_PERIMETRE.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.libelle_court || c.code || c.id;
      if (c.id === CTX_PERIMETRE.active) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', async function () {
      const nouvelleCat = this.value;
      if (!nouvelleCat || nouvelleCat === CTX_PERIMETRE.active) return;
      CTX_PERIMETRE.active = nouvelleCat;
      SupabaseHub.memoriserCategorieActive(nouvelleCat);
      // EVT-RATTACHEMENT-CATEGORIE : le contexte modal (catégorie servant
      // au filtrage du staff + au rattachement de l'entraînement) suit la
      // catégorie active. Le cache staff est invalidé pour forcer un
      // rechargement au prochain dépliage (sinon staff de l'ancienne cat).
      CTX_CATEGORIE_ID = nouvelleCat;
      _staffLoadedKey = null;
      select.disabled = true;
      try {
        CTX_EQUIPES_ACTIVES = await _resoudreEquipesCategorieActive();
        _majTitreCategorie();
        await reloadEvents();
      } catch (e) {
        console.error('Évènements : changement de catégorie échoué', e);
      } finally {
        select.disabled = false;
      }
    });

    wrap.appendChild(label);
    wrap.appendChild(select);
    header.parentNode.insertBefore(wrap, header.nextSibling);
  }

  // ============================================================
  // 8. ÉVÉNEMENTS DOM
  // ============================================================

  function bindEvents() {
    document.querySelectorAll('.evt-chip[data-type]').forEach(chip => {
      chip.addEventListener('click', function () {
        toggleTypeFilter(this.getAttribute('data-type'));
      });
    });

    document.querySelectorAll('.evt-chip[data-compet]').forEach(chip => {
      chip.addEventListener('click', function () {
        toggleCompetFilter(this.getAttribute('data-compet'));
      });
    });

    const searchInput = document.getElementById('evt-search');
    if (searchInput) {
      let to = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(to);
        to = setTimeout(() => {
          state.search = this.value.trim();
          renderListe();
        }, 200);
      });
    }

    const fab = document.getElementById('evt-fab-new');
    if (fab) fab.addEventListener('click', openModalCreate);

    document.querySelectorAll('[data-action="close-create"]').forEach(b => b.addEventListener('click', closeModalCreate));
    document.querySelectorAll('[data-action="close-cancel"]').forEach(b => b.addEventListener('click', closeModalCancel));
    document.querySelectorAll('[data-action="close-addmatch"]').forEach(b => b.addEventListener('click', closeModalAddMatch));
    document.querySelectorAll('[data-action="close-edit"]').forEach(b => b.addEventListener('click', closeModalEdit));
    document.querySelectorAll('[data-action="close-notes"]').forEach(b => b.addEventListener('click', closeModalEditNotes));
    document.querySelectorAll('[data-action="close-logistique"]').forEach(b => b.addEventListener('click', closeModalLogistique));

    // S2.4.b — Submit des 3 modales + P2-E.2 modales E6/E7
    const btnCreateSubmit = document.getElementById('evt-create-submit');
    if (btnCreateSubmit) btnCreateSubmit.addEventListener('click', submitModalCreate);
    // v1.27 — délégation d'événements de l'éditeur de phases (posée 1×,
    // idempotente via flag _phasesEditorBound sur le conteneur).
    bindPhasesEditor();
    const btnCancelSubmit = document.getElementById('evt-cancel-submit');
    if (btnCancelSubmit) btnCancelSubmit.addEventListener('click', submitModalCancel);
    const btnAddMatchSubmit = document.getElementById('evt-addmatch-submit');
    if (btnAddMatchSubmit) btnAddMatchSubmit.addEventListener('click', submitModalAddMatch);
    const btnEditSubmit = document.getElementById('evt-edit-submit');
    if (btnEditSubmit) btnEditSubmit.addEventListener('click', submitModalEdit);
    const btnNotesSubmit = document.getElementById('evt-notes-submit');
    if (btnNotesSubmit) btnNotesSubmit.addEventListener('click', submitModalEditNotes);
    const btnLogistiqueSubmit = document.getElementById('evt-logistique-submit');
    if (btnLogistiqueSubmit) btnLogistiqueSubmit.addEventListener('click', submitModalLogistique);

    // S2.4.b — Changement de type dans E3 → afficher/masquer champs conditionnels
    document.querySelectorAll('#evt-create-form input[name=type_evenement]').forEach(radio => {
      radio.addEventListener('change', updateCreateConditionalFields);
    });

    // v1.16 — U2 §3.1 : changement de SOUS-TYPE compétition →
    // ré-évalue l'éligibilité de la question Phases (dérivée du
    // sous-type) + règle Seven. Réutilise updateCreateConditionalFields
    // (déjà idempotent, ne casse aucun autre groupe).
    const competSelectEl = document.getElementById('evt-create-compet');
    if (competSelectEl) {
      competSelectEl.addEventListener('change', updateCreateConditionalFields);
    }

    // v1.16 — U2 §3.2 : OUI/NON Phases → substitution 4c ↔ Phases.
    document.querySelectorAll('#evt-create-form input[name=phases_mode]').forEach(radio => {
      radio.addEventListener('change', updatePhasesModeVisibility);
    });

    // v1.16 — 4c : bouton + Adversaire (patron unique répétable).
    const advAddBtn = document.getElementById('evt-create-adv-add');
    if (advAddBtn) {
      advAddBtn.addEventListener('click', function () { addAdversaireRow(''); });
    }

    // v1.16 — U2 §3.2 : bouton + Phase (phase-boîte répétable).
    const phaseAddBtn = document.getElementById('evt-create-phase-add');
    if (phaseAddBtn) {
      phaseAddBtn.addEventListener('click', addPhaseBox);
    }

    // P2-E.1 — Changement de mode dans E3 (vierge / dupliquer)
    document.querySelectorAll('#evt-create-form input[name=create_mode]').forEach(radio => {
      radio.addEventListener('change', function () {
        const dupGroup = document.getElementById('evt-create-dup-group');
        if (this.value === 'dupliquer') {
          if (dupGroup) dupGroup.style.display = '';
        } else {
          if (dupGroup) dupGroup.style.display = 'none';
          MODAL_CREATE_DUP_SRC_ID = null;
        }
      });
    });
    // P2-E.1 — Sélection de la source duplication → pré-remplissage
    const dupSourceSel = document.getElementById('evt-create-dup-source');
    if (dupSourceSel) {
      dupSourceSel.addEventListener('change', function () {
        MODAL_CREATE_DUP_SRC_ID = this.value || null;
        if (MODAL_CREATE_DUP_SRC_ID) {
          prefillFormFromSource(MODAL_CREATE_DUP_SRC_ID);
        }
      });
    }

    // v1.37 — Fermeture au clic sur le FOND retirée pour TOUS les overlays
    // (retour terrain : un clic accidentel hors du modal fermait et faisait
    // perdre toute la saisie — critique sur le formulaire de création riche,
    // 2 équipes × phases × adversaires). Chaque modal a un bouton de
    // fermeture explicite (close-create/edit/notes/logistique/cancel/
    // addmatch + croix close-fiche, vérifiés), donc aucun modal n'est
    // prisonnier. On ne ferme plus QUE par bouton explicite.
    // (Anciens handlers de clic-fond .evt-overlay + ficheOverlay supprimés ;
    //  le bouton croix close-fiche ci-dessous est CONSERVÉ.)

    // Fermeture du panneau fiche détaillée par son bouton croix (conservé).
    document.querySelectorAll('[data-action="close-fiche"]').forEach(b => {
      b.addEventListener('click', closeFiche);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        // Si fiche détaillée ouverte, on la ferme en priorité
        const ficheOverlay = document.getElementById('evt-fiche-overlay');
        if (ficheOverlay && ficheOverlay.classList.contains('show')) {
          closeFiche();
          return;
        }
        document.querySelectorAll('.evt-overlay.show').forEach(o => o.classList.remove('show'));
      }
    });

    // ──────────────────────────────────────────────────────────────
    // v1.24 — CÂBLAGES NOUVEAUX ÉLÉMENTS HTML L4 (refonte UX Evt→Compo)
    // ──────────────────────────────────────────────────────────────

    // H-6 §3.4 : CTA primaire "Nouvel évènement" près de la barre de
    // recherche (en plus du FAB existant). 2 entrées vers la même
    // modale (cohérent inline onclick défensif L4 v2).
    const ctaTop = document.getElementById('evt-btn-create-top');
    if (ctaTop) ctaTop.addEventListener('click', openModalCreate);

    // H-3 §3.4 : KPIs cliquables (compteurs → filtres actionnables).
    document.querySelectorAll('[data-action="filter-set"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const val = this.getAttribute('data-filter-value');
        if (val === 'avenir') {
          state.showPassed = false;
        } else if (val === 'passes') {
          state.showPassed = true;
        }
        savePrefs();
        renderListe();
      });
    });

    // H-2 §3.4 : Dropdown sous-type compétition (au lieu de pills).
    const sousTypeSelect = document.getElementById('evt-soustype-select');
    if (sousTypeSelect) {
      sousTypeSelect.addEventListener('change', function () {
        setSousTypeFilter(this.value);
      });
    }

    // H-5 §3.4 : Bouton "Grouper par catégorie" admin-only. Le bouton
    // est caché par défaut (style display:none HTML L4) ; révélé dans
    // init() après auth check si isAdmin. Câblage du click ici.
    const btnGrouperAdmin = document.getElementById('evt-btn-grouper-categorie');
    if (btnGrouperAdmin) {
      btnGrouperAdmin.addEventListener('click', function () {
        state.grouperParCategorie = !state.grouperParCategorie;
        this.classList.toggle('active', state.grouperParCategorie);
        savePrefs();
        renderListe();
      });
    }

    // §3.1.4 : Multi-jours toggle (modes A4/A5) — révèle la date_fin
    // automatiquement quand coché.
    const multijoursToggle = document.getElementById('evt-create-multijours-toggle');
    if (multijoursToggle) {
      multijoursToggle.addEventListener('change', function () {
        const dateFinGroup = document.getElementById('evt-create-date-fin-group');
        if (dateFinGroup) {
          dateFinGroup.style.display = this.checked ? '' : 'none';
        }
      });
    }

    // §3.1.2 : Récurrence toggle (mode A1) — révèle les détails
    // (fréquence + date fin série).
    const recurrenceToggle = document.getElementById('evt-create-recurrence-toggle');
    if (recurrenceToggle) {
      recurrenceToggle.addEventListener('change', function () {
        const detailsZone = document.getElementById('evt-create-recurrence-details');
        if (detailsZone) {
          detailsZone.style.display = this.checked ? '' : 'none';
        }
      });
    }

    // §3.1.4 : phases_mode radio change → recalcule visibilité phases-zone
    // (utilisé seulement par mode A4 plateau, A5 tournoi force phases).
    document.querySelectorAll('#evt-create-phases-question input[name=phases_mode]').forEach(function (radio) {
      radio.addEventListener('change', updateCreateConditionalFields);
    });
  }

  /**
   * v1.24 — Révèle le bouton "Grouper par catégorie" si l'utilisateur
   * a le rôle admin (H-5 §3.4 doc UX, F22 résolu — bruit cognitif
   * éliminé pour coach mono-catégorie). Appelé une fois après auth
   * check dans init(). Défensif : si SupabaseHub.isAdmin n'est pas
   * disponible, le bouton reste caché (échec côté sûreté).
   */
  async function revelerBoutonAdminSiAdmin() {
    const btn = document.getElementById('evt-btn-grouper-categorie');
    if (!btn) return;
    try {
      if (typeof SupabaseHub.isAdmin === 'function') {
        const isAdmin = await SupabaseHub.isAdmin();
        if (isAdmin) {
          btn.style.display = '';
          btn.classList.toggle('active', !!state.grouperParCategorie);
        }
      } else if (typeof SupabaseHub.hasRole === 'function') {
        const hasAdminRole = await SupabaseHub.hasRole('admin');
        if (hasAdminRole) {
          btn.style.display = '';
          btn.classList.toggle('active', !!state.grouperParCategorie);
        }
      } else {
        console.warn('revelerBoutonAdminSiAdmin : aucun wrapper isAdmin/hasRole disponible');
      }
    } catch (e) {
      console.warn('revelerBoutonAdminSiAdmin', e);
    }
  }

  /**
   * v1.24 — Toggle filtre TYPE refondu (HTML L4 : 4 pills, sous-type
   * via dropdown séparé). Affiche/masque le bloc dropdown sous-type
   * conditionnellement si famille Compétition active (H-2 doc UX §3.4).
   * Remplace toggleCompetFilter pills par changement sur dropdown.
   */
  function toggleTypeFilter(type) {
    if (type === 'all') {
      state.typesActifs.clear();
      state.typesActifs.add('all');
    } else {
      state.typesActifs.delete('all');
      if (state.typesActifs.has(type)) {
        state.typesActifs.delete(type);
        if (state.typesActifs.size === 0) state.typesActifs.add('all');
      } else {
        state.typesActifs.add(type);
      }
    }
    document.querySelectorAll('.evt-chip[data-type]').forEach(c => {
      c.classList.toggle('active', state.typesActifs.has(c.getAttribute('data-type')));
    });
    // v1.24 — Dropdown sous-type (HTML L4 evt-filters-soustype) visible
    // si famille Compétition active (ou Tous). Remplace les 11 pills
    // compétition retirées (cf. evenements.html L4 hunk 1).
    const sousTypeRow = document.getElementById('evt-filters-soustype');
    if (sousTypeRow) {
      const showSousType = state.typesActifs.has('all')
                        || state.typesActifs.has('competition');
      sousTypeRow.style.display = showSousType ? 'flex' : 'none';
    }
    // v1.23 — Préserve compat éventuelle si evt-filters-compet existe
    // encore (transition partielle). Sinon noop.
    const competRow = document.getElementById('evt-filters-compet');
    if (competRow) {
      const showCompet = state.typesActifs.has('all')
                      || state.typesActifs.has('competition');
      competRow.style.display = showCompet ? 'flex' : 'none';
    }
    savePrefs();
    renderListe();
  }

  /**
   * v1.24 — Filtre sous-type via dropdown (au lieu de pills v1.23).
   * Le state interne reste competsActifs (compat pass()).
   */
  function setSousTypeFilter(value) {
    if (!value || value === 'all') {
      state.competsActifs.clear();
      state.competsActifs.add('all');
    } else {
      state.competsActifs.clear();
      state.competsActifs.add(value);
    }
    savePrefs();
    renderListe();
  }

  // Préservé v1.23 pour rétrocompat (pills compet retirées HTML L4
  // mais fonction conservée pour API publique si appelée ailleurs).
  function toggleCompetFilter(compet) {
    if (compet === 'all') {
      state.competsActifs.clear();
      state.competsActifs.add('all');
    } else {
      state.competsActifs.delete('all');
      if (state.competsActifs.has(compet)) {
        state.competsActifs.delete(compet);
        if (state.competsActifs.size === 0) state.competsActifs.add('all');
      } else {
        state.competsActifs.add(compet);
      }
    }
    document.querySelectorAll('.evt-chip[data-compet]').forEach(c => {
      c.classList.toggle('active', state.competsActifs.has(c.getAttribute('data-compet')));
    });
    savePrefs();
    renderListe();
  }

  // ============================================================
  // 9. API PUBLIQUE
  // ============================================================

  async function init() {
    console.log('🏉 MOM Hub · Évènements Browser — init v1.56 (S4 · sélecteur multi-catégories)');

    const list = document.getElementById('evt-list');

    const prefs = loadPrefs();
    if (prefs) {
      if (Array.isArray(prefs.typesActifs))   state.typesActifs   = new Set(prefs.typesActifs);
      if (Array.isArray(prefs.competsActifs)) state.competsActifs = new Set(prefs.competsActifs);
      if (typeof prefs.showPassed === 'boolean') state.showPassed = prefs.showPassed;
      if (typeof prefs.grouperParCategorie === 'boolean') state.grouperParCategorie = prefs.grouperParCategorie;
      document.querySelectorAll('.evt-chip[data-type]').forEach(c => {
        c.classList.toggle('active', state.typesActifs.has(c.getAttribute('data-type')));
      });
      document.querySelectorAll('.evt-chip[data-compet]').forEach(c => {
        c.classList.toggle('active', state.competsActifs.has(c.getAttribute('data-compet')));
      });
    }

    // UX-MULTI-CATEGORIES Lot 2 — résolution du périmètre AVANT le 1er
    // chargement. Le socle central (v1.59) donne les catégories autorisées
    // + la catégorie active (mémorisée ou 1re). On en dérive les équipes
    // à interroger. Dégradation honnête : périmètre indisponible (client
    // ancien, erreur) → CTX_EQUIPES_ACTIVES reste null → loadEvenements*
    // retombe sur [M14_TEAM_UUID] (comportement d'origine).
    try {
      if (window.SupabaseHub && typeof SupabaseHub.resoudrePerimetreCategories === 'function') {
        CTX_PERIMETRE = await SupabaseHub.resoudrePerimetreCategories();
        CTX_EQUIPES_ACTIVES = await _resoudreEquipesCategorieActive();
      }
    } catch (e) {
      console.warn('Évènements : résolution du périmètre catégories échouée, repli M14', e);
      CTX_PERIMETRE = null;
      CTX_EQUIPES_ACTIVES = null;
    }

    try {
      const [evtAvenir, evtPasses] = await Promise.all([
        loadEvenementsAVenir(),
        loadEvenementsPasses()
      ]);
      EVENEMENTS_AVENIR = evtAvenir;
      EVENEMENTS_PASSES = evtPasses;

      await buildIndexes();

      console.log('Évènements chargés :',
        EVENEMENTS_AVENIR.length, 'à venir,',
        EVENEMENTS_PASSES.length, 'passé(s)',
        '·', Object.keys(CHILDREN_BY_PARENT).length, 'tournoi(s) avec enfants');

      bindEvents();
      // v1.24 — H-5 §3.4 : révèle le bouton admin "Grouper par catégorie"
      // si l'utilisateur a le rôle admin (auth check asynchrone, non
      // bloquant pour le rendu initial).
      revelerBoutonAdminSiAdmin();

      renderKPIs();
      renderListe();
      renderMiniCal();

      // UX-MULTI-CATEGORIES Lot 2 — sélecteur de catégorie (si > 1) +
      // titre de page aligné sur la catégorie active (remplace « M14 »
      // figé). Mono-catégorie / transverse → pas de sélecteur, titre
      // mis à jour seulement si une catégorie active est résolue.
      _monterSelecteurCategorie();
      _majTitreCategorie();
      // PERSONA-NON-STAFF (décision Manu) : membre connecté SANS catégorie
      // (ex : Jules) → on masque le geste de création « + Nouvel événement ».
      // Entorse assumée à D4 : utilisateur identifié sans catégorie cible,
      // le bouton n'a pas de sens. Sécurité inchangée (garde SQL
      // creer_evenement_complet : admin|bureau|gerer_evenements).
      (function _masquerFabSiPerimetreVide() {
        var vide = !CTX_PERIMETRE
          || CTX_PERIMETRE.vide === true
          || !(CTX_PERIMETRE.active);
        if (!vide) return;
        var fab = document.getElementById('evt-fab-new');
        if (fab) fab.style.display = 'none';
        var topBtn = document.getElementById('evt-btn-create-top');
        if (topBtn) topBtn.style.display = 'none';
      })();
      // directement la fiche de cet évènement au chargement (permet à la
      // page Groupe de base / Compositions de revenir SUR la fiche, pas
      // seulement sur la liste). Ouverture après le rendu (EVENTS_BY_ID prêt,
      // openFiche opérationnel). Id inconnu → ignoré silencieusement (liste).
      try {
        const ficheId = new URLSearchParams(window.location.search).get('fiche');
        if (ficheId) {
          // EVT-AGENDA-EDITION (A+) : openFiche() charge l'évènement par RPC
          // directe (getEvenementWithEncadrants) et gère « introuvable »
          // proprement — il ne dépend PAS de EVENTS_BY_ID. On l'appelle donc
          // dès qu'un id est fourni, MÊME hors fenêtre 90 j : le deep-link
          // depuis l'agenda des évènements (equipe-agenda.html, qui montre
          // toute la saison) doit pouvoir ouvrir une occurrence lointaine.
          // Historique conservé : un id présent dans EVENTS_BY_ID s'ouvre à
          // l'identique (openFiche re-fetche de toute façon la fiche fraîche).
          openFiche(ficheId);
        }
      } catch (e) {
        console.warn('deep-link ?fiche ignoré', e);
      }

      // S2.4.b — Charge le contexte des modales (saison, organisateur, sites)
      // en arrière-plan, non bloquant pour l'affichage initial
      loadModalContext();

      const smoke = document.getElementById('evt-footer-smoke');
      if (smoke) {
        const avenirRoots = EVENEMENTS_AVENIR.filter(e => !e.evenement_parent_id);
        const passesRoots = EVENEMENTS_PASSES.filter(e => !e.evenement_parent_id);
        // 'nœuds-parents' = tout parent ayant des enfants dans l'arbre
        // (racine → phase → match) : ce n'est PAS le nombre de tournois
        // de tête. On le nomme honnêtement pour ne pas laisser croire
        // « 10 tournois » quand la liste n'en montre que 2.
        smoke.textContent = 'MOM Hub · Module Évènements · S2.2 (v1.1) · ' +
          avenirRoots.length + ' à venir + ' +
          passesRoots.length + ' passé(s) racines · ' +
          Object.keys(CHILDREN_BY_PARENT).length + ' nœud(s)-parent(s) dans l\'arbre';
      }
    } catch (err) {
      console.error('Évènements : erreur lors du chargement', err);
      if (list) {
        list.innerHTML = '<div class="evt-list-error">Erreur de chargement : ' + escHtml(err.message || String(err)) + '<br><br><small>Vérifiez que SupabaseHub v1.10+ est chargé et que les RPC C9 (sql/29) sont déployées.</small></div>';
      }
      throw err;
    }
  }

  window.EvenementsBrowser = {
    init: init,
    openModalCreate:   openModalCreate,
    openModalCancel:   openModalCancel,
    openModalAddMatch: openModalAddMatch,
    openFiche:         openFiche,
    closeFiche:        closeFiche
  };

  console.log('%c🏉 MOM Hub · Évènements Browser v1.56 (S4 · sélecteur multi-catégories) chargé',
    'color: #2D7D46; font-weight: bold;');

})();
