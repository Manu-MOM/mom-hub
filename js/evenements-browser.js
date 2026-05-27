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
 * Version : 1.23 — Niveau 0 : activation accès « Feuille de match » (U-N3) (20 mai 2026)
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
 */

(function () {
  'use strict';

  // ============================================================
  // 1. ÉTAT INTERNE DU MODULE
  // ============================================================

  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

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

  async function loadEvenementsAVenir() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsAVenir !== 'function') {
      throw new Error('SupabaseHub.getEvenementsAVenir indisponible (v1.10+ requis)');
    }
    const events = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, FENETRE_JOURS_AVENIR);
    return Array.isArray(events) ? events : [];
  }

  async function loadEvenementsPasses() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsPasses !== 'function') {
      throw new Error('SupabaseHub.getEvenementsPasses indisponible (v1.10+ requis)');
    }
    const events = await SupabaseHub.getEvenementsPasses(M14_TEAM_UUID, FENETRE_JOURS_PASSES, PASSES_LIMIT);
    return Array.isArray(events) ? events : [];
  }

  function buildIndexes() {
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

    const isTournoi = evt.type_evenement === 'tournoi';
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

    const filterRoot = evt => !evt.evenement_parent_id && pass(evt);

    const filteredAvenir = EVENEMENTS_AVENIR.filter(filterRoot);
    const filteredPasses = state.showPassed ? EVENEMENTS_PASSES.filter(filterRoot) : [];
    const total = filteredAvenir.length + filteredPasses.length;

    // U3 (v1.14) — bascule « Grouper par catégorie ». Injectée en tête
    // de #evt-list (zone possédée par le module — Façon 1, aucune
    // dépendance evenements.html). Liée dans bindCardEvents (appelé en
    // fin de renderListe, là où sont liés les contrôles internes liste).
    const toggleBar =
      '<div class="evt-groupbar">' +
        '<button type="button" class="evt-groupbar-btn' +
          (state.grouperParCategorie ? ' active' : '') +
          '" data-action="toggle-grouper" ' +
          'aria-pressed="' + (state.grouperParCategorie ? 'true' : 'false') + '">' +
          (state.grouperParCategorie
            ? 'Grouper par catégorie : activé'
            : 'Grouper par catégorie') +
        '</button>' +
      '</div>';

    if (total === 0) {
      list.innerHTML = toggleBar +
        '<div class="evt-list-empty">Aucun évènement trouvé.<br><small>Essayez d\'élargir les filtres ou de modifier la recherche.</small></div>';
      bindCardEvents();
      return;
    }

    // U3 (v1.14) — DÉFAUT chronologique (UX §4, répare régression v1.13
    // qui forçait le regroupement). false → renderSection direct sur
    // passés puis à venir (= comportement EXACT v1.12, regroupement par
    // mois interne, tri chrono pur). true → regroupement par les 3
    // familles (ordre Compétition→Entraînement→Stage), tri chrono
    // conservé DANS chaque famille. renderSection JAMAIS modifiée.
    let html = toggleBar;
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
    // U3 (v1.14) — bascule « Grouper par catégorie ». Persistée dans
    // les prefs existantes (savePrefs étendu), re-render immédiat.
    const grpBtn = document.querySelector('[data-action="toggle-grouper"]');
    if (grpBtn) {
      grpBtn.addEventListener('click', function () {
        state.grouperParCategorie = !state.grouperParCategorie;
        savePrefs();
        renderListe();
      });
    }

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
    const avenirRoots = EVENEMENTS_AVENIR.filter(e => !e.evenement_parent_id);
    const passesRoots = EVENEMENTS_PASSES.filter(e => !e.evenement_parent_id);
    if (kpiAvenir) kpiAvenir.textContent = String(avenirRoots.length);
    if (kpiPasses) kpiPasses.textContent = String(passesRoots.length);

    const sub = document.getElementById('evt-header-sub');
    if (sub) {
      const totalAll = EVENEMENTS_AVENIR.length + EVENEMENTS_PASSES.length;
      sub.textContent = totalAll + ' évènement(s) chargé(s) · ' + FENETRE_JOURS_AVENIR + ' jours à venir, ' + FENETRE_JOURS_PASSES + ' jours passés';
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
      if (e.evenement_parent_id) return;
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
          if (typeof SupabaseHub.getCategorieEquipe === 'function'
              && typeof SupabaseHub.listEquipes === 'function') {
            const _cat = await SupabaseHub.getCategorieEquipe(M14_TEAM_UUID);
            if (_cat && _cat.ok && _cat.data && _cat.data.categorie_id) {
              const _liste = await SupabaseHub.listEquipes(_cat.data.categorie_id);
              evt._equipesClub = Array.isArray(_liste) ? _liste : [];
              evt._equipesClub.forEach(function (e) {
                if (e && e.id) {
                  evt._equipeNames[e.id] =
                    e.libelle_court || e.nom_officiel || e.code || e.id;
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
    if (rencontre.type_evenement !== 'match' && rencontre.type_evenement !== 'tournoi') return false;
    return rencontre.etat !== 'annule' && rencontre.etat !== 'archive';
  }

  // Bloc 3-états pour UNE rencontre (match simple OU match enfant).
  function renderSuiviRencontreBloc(rencontre) {
    const evtId = rencontre.id;
    const lien  = SUIVI_LIENS_SESSION.get(evtId);

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
    if (!suiviCompoPrete(rencontre)) {
      let h = '<div style="padding:8px 0;">';
      h += '<div style="font-size:13px;color:var(--ink);margin-bottom:8px;">La composition de cette rencontre doit être <strong>validée</strong> avant de pouvoir générer le lien de suivi.</div>';
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
  function renderSuiviSection(evt) {
    if (!suiviActionnable(evt)) return '';

    let html = '<div class="evt-fiche-section" id="evt-suivi-section">';
    html += '<div class="evt-fiche-section-title">🔗 Suivi de la rencontre</div>';

    if (evt.type_evenement === 'tournoi') {
      // A-Q3 : 1 lien par match enfant, DANS la structure du tournoi.
      // Réutilise le regroupement par phase déjà utilisé par la
      // section « Phases du tournoi » (structure non réinventée).
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
              html += renderSuiviRencontreBloc(child);
              html += renderModeVideoAcces(child);
              html += renderSpectateurAcces(child);
              html += renderTempsDeJeuMount(child);
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
  function renderFiche(evt) {
    let html = '';

    // ────────────────────────────────────────────────
    // 1. BANDEAU IDENTITÉ
    // ────────────────────────────────────────────────
    const dateLib = formatDateShort(evt.date_debut);
    const typeLbl = TYPE_LABELS[evt.type_evenement] || evt.type_evenement;
    const badge   = statutCompoBadge(evt.compo_status_summary);
    const etatPillCls = 'evt-fiche-pill-etat-' + (evt.etat || 'creation');

    let secondaire = '';
    if (evt.site_libelle_court) secondaire = escHtml(evt.site_libelle_court);
    if (evt.adversaire_nom) {
      secondaire += (secondaire ? ' · ' : '') + 'vs ' + escHtml(evt.adversaire_nom);
    }
    if (evt.type_competition) {
      secondaire += (secondaire ? ' · ' : '') + escHtml(evt.type_competition);
    }
    if (evt.format_de_jeu) {
      secondaire += (secondaire ? ' · ' : '') + escHtml(evt.format_de_jeu);
    }

    html += '<div class="evt-fiche-identite">';
    html += '<div class="evt-fiche-identite-meta">' + escHtml(dateLib) + ' · ' + escHtml(typeLbl) + '</div>';
    html += '<div class="evt-fiche-identite-libelle">' + escHtml(evt.libelle || '(sans libellé)') + '</div>';
    if (secondaire) {
      html += '<div class="evt-fiche-identite-secondaire">' + secondaire + '</div>';
    }
    html += '<div class="evt-fiche-identite-row">';
    html += '<span class="evt-fiche-pill ' + etatPillCls + '">État : ' + escHtml(evt.etat || 'creation') + '</span>';
    if (evt.compo_status_summary && evt.compo_status_summary.total > 0) {
      html += '<span class="evt-fiche-pill">' + escHtml(badge.libelle) + '</span>';
    } else if (evt.type_evenement === 'match' || evt.type_evenement === 'tournoi') {
      html += '<span class="evt-fiche-pill">0 compo · à faire</span>';
    }
    if (evt.domicile_exterieur) {
      html += '<span class="evt-fiche-pill">' + escHtml(evt.domicile_exterieur) + '</span>';
    }
    html += '</div>';
    html += '</div>';

    // ────────────────────────────────────────────────
    // 2. SCORE (si match joué)
    // ────────────────────────────────────────────────
    if (evt.score_mom !== null && evt.score_mom !== undefined && evt.score_adverse !== null && evt.score_adverse !== undefined) {
      html += '<div class="evt-fiche-section">';
      html += '<div class="evt-fiche-section-title">🏆 Score</div>';
      html += '<div class="evt-fiche-score">';
      html += '<span class="evt-fiche-score-num">' + escHtml(String(evt.score_mom)) + '</span>';
      html += '<span class="evt-fiche-score-vs">—</span>';
      html += '<span class="evt-fiche-score-num">' + escHtml(String(evt.score_adverse)) + '</span>';
      html += '</div>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // SUIVI DE LA RENCONTRE (SUIVI-COACH-1 Objet A)
    //   Section dédiée — match|tournoi, etat ∉ {annule,archive}.
    //   Rendu vide ('') si non applicable (P7 : ne se manifeste que
    //   quand pertinente).
    // ────────────────────────────────────────────────
    html += renderSuiviSection(evt);

    // ────────────────────────────────────────────────
    // 3. PHASES (si tournoi avec enfants — repris depuis CHILDREN_BY_PARENT)
    // ────────────────────────────────────────────────
    if (evt.type_evenement === 'tournoi') {
      const enfants = CHILDREN_BY_PARENT[evt.id] || [];
      html += '<div class="evt-fiche-section">';
      html += '<div class="evt-fiche-section-title">📋 Phases du tournoi</div>';
      if (enfants.length === 0) {
        html += '<div class="evt-fiche-empty">Aucun match interne créé pour ce tournoi.</div>';
      } else {
        // Regroupement par phase_libelle
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
            const childBadge = statutCompoBadge(child.compo_status_summary);
            const childLibStartsVs = (child.libelle || '').toLowerCase().indexOf('vs ') === 0;
            const advBlock = childLibStartsVs
              ? ''
              : (child.adversaire_nom
                  ? ' · vs ' + escHtml(child.adversaire_nom)
                  : ' · <em style="color:var(--ink-mute)">(adv. à déterminer)</em>');
            const isChildAnnule = child.etat === 'annule';
            html += '<div class="evt-fiche-phase-row">';
            html += '<span class="evt-fiche-phase-heure">' + escHtml(heure) + '</span>';
            html += '<span style="flex:1;">' + escHtml(child.libelle || '') + advBlock + '</span>';
            if (isChildAnnule) {
              html += '<span class="evt-card-badge evt-badge-annule evt-badge-sm">Annulé</span>';
            } else {
              html += '<span class="evt-card-badge evt-badge-' + childBadge.cls + ' evt-badge-sm">' + escHtml(childBadge.libelle) + '</span>';
            }
            html += '</div>';
          });
        });
      }
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 4. PARENT (si match enfant de tournoi)
    // ────────────────────────────────────────────────
    if (evt.evenement_parent_id) {
      const parent = EVENTS_BY_ID[evt.evenement_parent_id];
      if (parent) {
        html += '<div class="evt-fiche-section">';
        html += '<div class="evt-fiche-section-title">🏟️ Rattaché à</div>';
        html += '<div class="evt-fiche-text">' + escHtml(parent.libelle || parent.code || '(tournoi parent)');
        if (evt.phase_libelle) {
          html += ' <span style="color:var(--ink-mute);">— ' + escHtml(evt.phase_libelle) + '</span>';
        }
        html += '</div>';
        html += '</div>';
      }
    }

    // ────────────────────────────────────────────────
    // 5. LOGISTIQUE DÉPLACEMENT (conditionnelle, cf. doc §5.3 Q6)
    //    P2-E.3 : formulaire structuré (remplace JSON brut)
    //    P2-E.5 : collapsible mobile
    // ────────────────────────────────────────────────
    const hasLogistique = evt.logistique_deplacement && typeof evt.logistique_deplacement === 'object' && Object.keys(evt.logistique_deplacement).length > 0;
    const showLogistique = hasLogistique || evt.type_evenement === 'deplacement';
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
        ].filter(([, v]) => v);
        if (logRows.length > 0) {
          logRows.forEach(([k, v]) => {
            html += '<div style="display:flex;gap:8px;padding:4px 0;font-size:13px;border-bottom:1px solid var(--paper-warm);">';
            html += '<div style="min-width:110px;font-family:\'JetBrains Mono\',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);padding-top:3px;">' + escHtml(k) + '</div>';
            html += '<div style="flex:1;color:var(--ink);">' + escHtml(v) + '</div>';
            html += '</div>';
          });
        } else {
          html += '<div class="evt-fiche-empty">Logistique renseignée mais vide.</div>';
        }
      } else {
        html += '<div class="evt-fiche-empty">Aucune logistique renseignée.</div>';
      }
      if (evt.etat !== 'annule' && evt.etat !== 'archive') {
        html += '<div style="margin-top:8px;"><button type="button" class="evt-btn" data-action="logistique-from-fiche" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;">✏️ ' + (hasLogistique ? 'Modifier' : '+ Ajouter logistique') + '</button></div>';
      }
      html += '</div>';
      html += '</div>';
    } else if (evt.etat !== 'annule' && evt.etat !== 'archive') {
      // Pas de section logistique mais bouton discret pour en ajouter une
      html += '<div class="evt-fiche-section">';
      html += '<button type="button" class="evt-btn" data-action="logistique-from-fiche" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;color:var(--ink-mute);">+ Ajouter logistique de déplacement</button>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 5bis. ÉQUIPES ENGAGÉES + ADVERSAIRES (M3/M5)
    //    v1.19 read-back · v1.20 édition (engager/retirer
    //    équipe, ajouter/retirer adversaire). Compétitions
    //    uniquement. Données attachées par openFiche (wrappers
    //    LECTURE déployés) ; écritures via wrappers déployés
    //    (add/removeEquipeEngagee, add/removeAdversaire). Noms via
    //    listing, repli honnête UUID. Calqué sur le bloc Encadrants
    //    (classes/collapsible P2-E.5) + patron data-action +
    //    bindFicheActions (refresh = reactivate-from-fiche).
    //    Édition gardée etat ∉ {annule,archive} (idem logistique).
    // ────────────────────────────────────────────────
    if (evt.type_evenement === 'competition') {
      const eqEng  = Array.isArray(evt._equipesEngagees) ? evt._equipesEngagees : [];
      const advAll = Array.isArray(evt._adversaires) ? evt._adversaires : [];
      const eqNames = (evt._equipeNames && typeof evt._equipeNames === 'object')
        ? evt._equipeNames : {};
      const clubEq = Array.isArray(evt._equipesClub) ? evt._equipesClub : [];
      const engEditable = (evt.etat !== 'annule' && evt.etat !== 'archive');
      const engagedIds = {};
      eqEng.forEach(function (eq) { engagedIds[eq.equipe_id] = true; });
      html += '<div class="evt-fiche-section evt-fiche-collapsible">';
      html += '<div class="evt-fiche-section-title">🏉 Équipes engagées <span class="evt-fiche-chevron">▶</span></div>';
      html += '<div class="evt-fiche-section-body">';
      if (eqEng.length === 0) {
        html += '<div class="evt-fiche-empty">Aucune équipe engagée pour cette compétition.</div>';
      } else {
        html += '<ul class="evt-fiche-list">';
        eqEng.forEach(function (eq) {
          const nomEq = eqNames[eq.equipe_id] || eq.equipe_id || '(équipe inconnue)';
          html += '<li class="evt-fiche-list-item">';
          html += '<span class="evt-fiche-list-puce">•</span>';
          html += '<div class="evt-fiche-list-content">';
          html += '<div class="evt-fiche-list-name">' + escHtml(nomEq);
          if (engEditable) {
            html += ' <button type="button" class="evt-btn" data-action="retirer-equipe-from-fiche" data-liaison-id="' + escHtml(eq.id) + '" data-event-id="' + escHtml(evt.id) + '" style="font-size:10px;color:var(--ink-mute);">✕ retirer</button>';
          }
          html += '</div>';
          if (eq.format_de_jeu) {
            html += '<div class="evt-fiche-list-meta">Format : ' + escHtml(eq.format_de_jeu) + '</div>';
          }
          advAll
            .filter(function (a) { return a.evenement_equipe_id === eq.id; })
            .forEach(function (a) {
              if (a.adversaire_nom) {
                html += '<div class="evt-fiche-list-meta">vs ' + escHtml(a.adversaire_nom);
                if (engEditable && a.id) {
                  html += ' <button type="button" class="evt-btn" data-action="retirer-adversaire-from-fiche" data-adv-id="' + escHtml(a.id) + '" data-event-id="' + escHtml(evt.id) + '" style="font-size:10px;color:var(--ink-mute);">✕</button>';
                }
                html += '</div>';
              }
            });
          if (engEditable) {
            html += '<div class="evt-fiche-list-meta" style="margin-top:4px;">';
            html += '<input type="text" class="evt-form-input" data-adv-input-for="' + escHtml(eq.id) + '" placeholder="Ajouter un adversaire…" style="font-size:12px;max-width:200px;">';
            html += ' <button type="button" class="evt-btn" data-action="ajouter-adversaire-from-fiche" data-liaison-id="' + escHtml(eq.id) + '" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;">+ adversaire</button>';
            html += '</div>';
          }
          if (eq.notes) {
            html += '<div class="evt-fiche-list-meta">📝 ' + escHtml(eq.notes) + '</div>';
          }
          html += '</div>';
          html += '</li>';
        });
        html += '</ul>';
      }
      if (engEditable) {
        const dispo = clubEq.filter(function (e) { return e && e.id && !engagedIds[e.id]; });
        html += '<div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
        if (dispo.length === 0) {
          html += '<span class="evt-fiche-empty" style="margin:0;">'
            + (clubEq.length === 0
                ? 'Liste des équipes indisponible (chargement / hors-ligne).'
                : 'Toutes les équipes du club sont déjà engagées.')
            + '</span>';
        } else {
          html += '<select class="evt-form-select" data-eng-picker="' + escHtml(evt.id) + '" style="font-size:12px;max-width:220px;">';
          html += '<option value="">— Engager une équipe… —</option>';
          dispo.forEach(function (e) {
            const lib = e.libelle_court || e.nom_officiel || e.code || e.id;
            html += '<option value="' + escHtml(e.id) + '">' + escHtml(lib) + '</option>';
          });
          html += '</select>';
          html += ' <button type="button" class="evt-btn" data-action="engager-equipe-from-fiche" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;">+ Engager</button>';
        }
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 5ter. ÉQUIPES & COMPOSITIONS (Niveau 0 — Collectif &
    //    compo 3 niveaux, doc UX §1). Compétition + ≥1 équipe
    //    engagée. Par équipe : nom + format (M3, lecture) + 2 accès
    //    (Groupe de base U-N2 / Feuille U-N3). Réutilise les données
    //    DÉJÀ attachées par openFiche (evt._equipesEngagees /
    //    _equipeNames) — ZÉRO nouvel appel, ZÉRO openFiche touché.
    //    Boutons honnêtement DÉGRADÉS (disabled + « bientôt ») tant
    //    que U-N2 (étape b) / U-N3 (étape c) non livrés — patron
    //    projet « jamais de trou silencieux ». data-evenement-equipe-id
    //    = eq.id (evenement_equipes_engagees.id) = param U-N2/U-N3.
    //    Convention ?evenement_equipe=<id> = SD-1 (a) assumée Manu.
    // ────────────────────────────────────────────────
    if (evt.type_evenement === 'competition') {
      const eqEngN0 = Array.isArray(evt._equipesEngagees) ? evt._equipesEngagees : [];
      if (eqEngN0.length > 0) {
        const eqNamesN0 = (evt._equipeNames && typeof evt._equipeNames === 'object')
          ? evt._equipeNames : {};
        html += '<div class="evt-fiche-section evt-fiche-collapsible">';
        html += '<div class="evt-fiche-section-title">🧩 Équipes &amp; compositions <span class="evt-fiche-chevron">▶</span></div>';
        html += '<div class="evt-fiche-section-body">';
        html += '<ul class="evt-fiche-list">';
        eqEngN0.forEach(function (eq) {
          const nomEq = eqNamesN0[eq.equipe_id] || eq.equipe_id || '(équipe inconnue)';
          html += '<li class="evt-fiche-list-item">';
          html += '<span class="evt-fiche-list-puce">•</span>';
          html += '<div class="evt-fiche-list-content">';
          html += '<div class="evt-fiche-list-name">' + escHtml(nomEq) + '</div>';
          if (eq.format_de_jeu) {
            html += '<div class="evt-fiche-list-meta">Format : ' + escHtml(eq.format_de_jeu) + '</div>';
          }
          html += '<div class="evt-fiche-list-meta" style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">';
          html += '<button type="button" class="evt-btn" data-action="ouvrir-groupe-base" data-evenement-equipe-id="' + escHtml(eq.id) + '" data-event-id="' + escHtml(evt.id) + '" title="Ouvrir le groupe de base de cette équipe engagée" style="font-size:11px;">👥 Groupe de base</button>';
          html += '<button type="button" class="evt-btn" data-action="ouvrir-feuille-equipe" data-evenement-equipe-id="' + escHtml(eq.id) + '" data-event-id="' + escHtml(evt.id) + '" title="Ouvrir la feuille de match de cette équipe engagée" style="font-size:11px;">📋 Feuille de match</button>';
          html += '</div>';
          html += '</div>';
          html += '</li>';
        });
        html += '</ul>';
        html += '<div class="evt-fiche-empty" style="margin-top:6px;font-size:11px;">Accès Groupe de base (U-N2) et Feuille de match (U-N3) — activés aux étapes suivantes du chantier Collectif &amp; compo 3 niveaux.</div>';
        html += '</div>';
        html += '</div>';
      }
    }

    // ────────────────────────────────────────────────
    // 6. ENCADRANTS (array JSONB depuis la RPC)
    //    P2-E.5 : collapsible mobile
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-section evt-fiche-collapsible">';
    html += '<div class="evt-fiche-section-title">👥 Encadrants <span class="evt-fiche-chevron">▶</span></div>';
    html += '<div class="evt-fiche-section-body">';
    const encadrants = Array.isArray(evt.encadrants) ? evt.encadrants : [];
    if (encadrants.length === 0) {
      html += '<div class="evt-fiche-empty">Aucun encadrant rattaché à cet évènement.</div>';
    } else {
      html += '<ul class="evt-fiche-list">';
      encadrants.forEach(enc => {
        const nomComplet = [enc.prenom, enc.nom].filter(Boolean).join(' ') || '(sans nom)';
        const roles = Array.isArray(enc.roles_encadrement)
          ? enc.roles_encadrement.join(', ')
          : '';
        html += '<li class="evt-fiche-list-item">';
        html += '<span class="evt-fiche-list-puce">•</span>';
        html += '<div class="evt-fiche-list-content">';
        html += '<div class="evt-fiche-list-name">' + escHtml(nomComplet) + '</div>';
        if (roles) {
          html += '<div class="evt-fiche-list-meta">' + escHtml(roles) + '</div>';
        }
        if (enc.notes) {
          html += '<div class="evt-fiche-list-meta">📝 ' + escHtml(enc.notes) + '</div>';
        }
        html += '</div>';
        html += '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';
    html += '</div>';

    // ────────────────────────────────────────────────
    // 7. NOTES INTERNES
    //    P2-E.5 : collapsible mobile
    // ────────────────────────────────────────────────
    if (evt.notes_internes) {
      html += '<div class="evt-fiche-section evt-fiche-collapsible">';
      html += '<div class="evt-fiche-section-title">📝 Notes internes <span class="evt-fiche-chevron">▶</span></div>';
      html += '<div class="evt-fiche-section-body">';
      html += '<div class="evt-fiche-text">' + escHtml(evt.notes_internes) + '</div>';
      html += '</div>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 8. ACTIONS EN PIED (P2-E.2 : boutons câblés)
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-actions">';
    // v1.12 — Bouton « Retour aux compositions » (pendant de symétrie du
    // bouton Compos→Évènements « Retour aux évènements »). Toujours
    // visible : navigation pure, aucune garde d'état inventée (utile
    // aussi sur un évènement annulé/archivé). data-event-id porté par
    // cohérence avec les boutons frères, NON consommé en version simple.
    html += '<button type="button" class="evt-btn" data-action="compos-from-fiche" data-event-id="' + escHtml(evt.id) + '">← Retour aux compositions</button>';
    if (evt.etat !== 'annule' && evt.etat !== 'archive') {
      html += '<button type="button" class="evt-btn" data-action="edit-from-fiche" data-event-id="' + escHtml(evt.id) + '">✏️ Modifier</button>';
      html += '<button type="button" class="evt-btn" data-action="notes-from-fiche" data-event-id="' + escHtml(evt.id) + '">📝 Notes</button>';
    }
    if (evt.etat === 'annule') {
      html += '<div class="evt-fiche-actions-spacer"></div>';
      html += '<button type="button" class="evt-btn evt-btn-primary" data-action="reactivate-from-fiche" data-event-id="' + escHtml(evt.id) + '">↩ Réactiver l\'évènement</button>';
    } else if (evt.etat !== 'archive') {
      html += '<div class="evt-fiche-actions-spacer"></div>';
      html += '<button type="button" class="evt-btn evt-btn-danger" data-action="cancel-from-fiche" data-event-id="' + escHtml(evt.id) + '">🗑 Annuler l\'évènement</button>';
    }
    html += '</div>';

    return html;
  }

  /**
   * Câble les actions internes de la fiche détaillée (boutons Annuler /
   * Réactiver). Appelé après chaque renderFiche pour rebrancher les listeners.
   */
  function bindFicheActions() {
    document.querySelectorAll('[data-action="cancel-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalCancel(id);
      });
    });
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
    // P2-E.2 : boutons édition identité + notes
    document.querySelectorAll('[data-action="edit-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalEdit(id);
      });
    });
    document.querySelectorAll('[data-action="notes-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalEditNotes(id);
      });
    });
    // v1.12 — Bouton « Retour aux compositions » : sibling strict de
    // edit/notes-from-fiche. Navigation pure = réplique EXACTE du
    // pattern déjà déployé 'suivi-aller-compo' ci-dessous (même
    // commentaire d'honnêteté : pas de deep-link inventé, la convention
    // d'URL de compositions.html n'est pas connue ; la version ciblée
    // est un enabler conv Compos, non défini ici — zéro couplage
    // inventé). data-event-id présent mais NON lu (version simple).
    document.querySelectorAll('[data-action="compos-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        window.location.href = 'compositions.html';
      });
    });
    // Collectif & compo 3 niveaux (v1.22) — accès U-N2 « Groupe de
    // base » (Niveau 0). Navigation pure calquée compos-from-fiche.
    document.querySelectorAll('[data-action="ouvrir-groupe-base"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'groupe-base.html?evenement_equipe=' + encodeURIComponent(evtEqId);
        }
      });
    });
    // Collectif & compo 3 niveaux (v1.23) — accès U-N3 « Feuille de
    // match » (Niveau 0). Navigation pure, miroir BYTE-IDENTIQUE de
    // ouvrir-groupe-base ci-dessus, seule différence = la cible
    // (compositions.html au lieu de groupe-base.html). Zéro logique
    // métier, zéro couplage module→module : l'URL ?evenement_equipe
    // est lue par compositions-editor v3.8 qui bascule en mode U-N3.
    document.querySelectorAll('[data-action="ouvrir-feuille-equipe"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const evtEqId = this.getAttribute('data-evenement-equipe-id');
        if (evtEqId) {
          window.location.href = 'compositions.html?evenement_equipe=' + encodeURIComponent(evtEqId);
        }
      });
    });
    // P2-E.5 : toggle collapsible mobile (logistique, encadrants, notes)
    document.querySelectorAll('.evt-fiche-collapsible .evt-fiche-section-title').forEach(title => {
      title.addEventListener('click', function () {
        this.closest('.evt-fiche-collapsible').classList.toggle('is-open');
      });
    });
    // P2-E.3 : bouton édition logistique
    document.querySelectorAll('[data-action="logistique-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalLogistique(id);
      });
    });
    // v1.20 — Édition de l'engagement depuis la fiche (M3/M5).
    // Patron STRICTEMENT calqué sur reactivate-from-fiche ci-dessus :
    // bouton désactivé → await wrapper DÉPLOYÉ → alert si échec →
    // succès closeFiche(); await reloadEvents(); openFiche(id) (la
    // fiche rerend, openFiche relit M3/M5). Wrappers déjà déployés
    // (add/removeEquipeEngagee/addAdversaire v1.19, removeAdversaire
    // v1.21). Aucune logique inventée, aucun nouveau SQL.
    document.querySelectorAll('[data-action="engager-equipe-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', async function () {
        const evtId = this.getAttribute('data-event-id');
        if (!evtId) return;
        const sel = document.querySelector('[data-eng-picker="' + evtId + '"]');
        const equipeId = sel ? sel.value : '';
        if (!equipeId) { alert('Sélectionne une équipe à engager.'); return; }
        this.disabled = true;
        const _t = this.textContent;
        this.textContent = 'Engagement…';
        try {
          const res = await SupabaseHub.addEquipeEngagee(evtId, { equipe_id: equipeId });
          if (!res || !res.ok) {
            alert('Échec : ' + ((res && res.error) || 'erreur inconnue'));
            this.disabled = false;
            this.textContent = _t;
            return;
          }
          closeFiche();
          await reloadEvents();
          openFiche(evtId);
        } catch (err) {
          console.error('engager-equipe-from-fiche', err);
          alert('Erreur inattendue : ' + (err.message || err));
          this.disabled = false;
          this.textContent = _t;
        }
      });
    });
    document.querySelectorAll('[data-action="retirer-equipe-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', async function () {
        const evtId = this.getAttribute('data-event-id');
        const liaisonId = this.getAttribute('data-liaison-id');
        if (!evtId || !liaisonId) return;
        if (!confirm('Retirer cette équipe engagée ? Ses adversaires saisis seront aussi supprimés (cascade FK).')) return;
        this.disabled = true;
        const _t = this.textContent;
        this.textContent = '…';
        try {
          const res = await SupabaseHub.removeEquipeEngagee(liaisonId);
          if (!res || !res.ok) {
            alert('Échec : ' + ((res && res.error) || 'erreur inconnue'));
            this.disabled = false;
            this.textContent = _t;
            return;
          }
          closeFiche();
          await reloadEvents();
          openFiche(evtId);
        } catch (err) {
          console.error('retirer-equipe-from-fiche', err);
          alert('Erreur inattendue : ' + (err.message || err));
          this.disabled = false;
          this.textContent = _t;
        }
      });
    });
    document.querySelectorAll('[data-action="ajouter-adversaire-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', async function () {
        const evtId = this.getAttribute('data-event-id');
        const liaisonId = this.getAttribute('data-liaison-id');
        if (!evtId || !liaisonId) return;
        const inp = document.querySelector('[data-adv-input-for="' + liaisonId + '"]');
        const nom = inp ? inp.value.trim() : '';
        if (!nom) { alert('Saisis le nom de l\'adversaire.'); return; }
        this.disabled = true;
        const _t = this.textContent;
        this.textContent = '…';
        try {
          const res = await SupabaseHub.addAdversaire(liaisonId, { adversaire_nom: nom });
          if (!res || !res.ok) {
            alert('Échec : ' + ((res && res.error) || 'erreur inconnue'));
            this.disabled = false;
            this.textContent = _t;
            return;
          }
          closeFiche();
          await reloadEvents();
          openFiche(evtId);
        } catch (err) {
          console.error('ajouter-adversaire-from-fiche', err);
          alert('Erreur inattendue : ' + (err.message || err));
          this.disabled = false;
          this.textContent = _t;
        }
      });
    });
    document.querySelectorAll('[data-action="retirer-adversaire-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', async function () {
        const evtId = this.getAttribute('data-event-id');
        const advId = this.getAttribute('data-adv-id');
        if (!evtId || !advId) return;
        if (!confirm('Retirer cet adversaire ?')) return;
        this.disabled = true;
        try {
          const res = await SupabaseHub.removeAdversaire(advId);
          if (!res || !res.ok) {
            alert('Échec : ' + ((res && res.error) || 'erreur inconnue'));
            this.disabled = false;
            return;
          }
          closeFiche();
          await reloadEvents();
          openFiche(evtId);
        } catch (err) {
          console.error('retirer-adversaire-from-fiche', err);
          alert('Erreur inattendue : ' + (err.message || err));
          this.disabled = false;
        }
      });
    });
    // SUIVI-COACH-1 Objet A : actions de la section Suivi
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
      // 1. Saison + organisateur depuis le prochain évent
      if (window.SupabaseHub && typeof SupabaseHub.getProchainEvenementParEquipe === 'function') {
        const proch = await SupabaseHub.getProchainEvenementParEquipe(M14_TEAM_UUID);
        if (proch) {
          // saison_id n'est pas dans le retour de cette RPC (pas dans les 20 cols)
          // On va donc le récupérer depuis EVENEMENTS_AVENIR[0] ou EVENEMENTS_PASSES[0]
          // qui ne le retournent pas non plus en réalité !
          // → Fallback : on lit directement depuis la table evenements via from()
        }
      }

      // Fallback fiable : lecture directe depuis la table evenements pour
      // récupérer saison_id + organisateur_principal_id du dernier événement M14.
      // Ces 2 champs ne sont pas dans le retour des RPC liste mais bien dans
      // la table elle-même.
      if (window.SupabaseHub && SupabaseHub.client) {
        const { data, error } = await SupabaseHub.client
          .from('evenements')
          .select('saison_id, organisateur_principal_id')
          .eq('equipe_id', M14_TEAM_UUID)
          .order('date_debut', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          CTX_SAISON_ID       = data.saison_id;
          CTX_ORGANISATEUR_ID = data.organisateur_principal_id;
          console.log('Modal context : saison=', CTX_SAISON_ID, 'organisateur=', CTX_ORGANISATEUR_ID);
        } else if (error) {
          console.warn('loadModalContext() lecture saison/organisateur', error);
        }
      }

      // v1.18 — Catégorie M14 (dérivée de M14_TEAM_UUID) pour peupler
      // le Bloc 4a via listEquipes. Module M14-mono-équipe (décision
      // périmètre option A). Défensif : un échec ici N'EMPÊCHE PAS la
      // création de l'évènement de base ; seul le Bloc 4a affichera
      // une erreur honnête (jamais une case fantôme).
      if (window.SupabaseHub && typeof SupabaseHub.getCategorieEquipe === 'function') {
        const catRes = await SupabaseHub.getCategorieEquipe(M14_TEAM_UUID);
        if (catRes && catRes.ok && catRes.data) {
          CTX_CATEGORIE_ID = catRes.data.categorie_id;
          console.log('Modal context : categorie=', CTX_CATEGORIE_ID);
        } else {
          console.warn('loadModalContext() résolution catégorie M14',
            catRes && catRes.error);
        }
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
    const PHASES_OBLIG_SOUS_TYPES = ['tournoi'];        // A5
    const PHASES_OPTIONNEL_SOUS_TYPES = ['plateau'];    // A4 (multi-équipes possible)
    let mode = 'A1';
    if (famille === 'entrainement')      mode = 'A1';
    else if (famille === 'stage')         mode = 'A2';
    else if (famille === 'competition') {
      if (PHASES_OBLIG_SOUS_TYPES.indexOf(sousType) !== -1)     mode = 'A5';
      else if (PHASES_OPTIONNEL_SOUS_TYPES.indexOf(sousType) !== -1) mode = 'A4';
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
    const showHoraires    = mode === 'A3' || mode === 'A4' || mode === 'A5'; // Bloc 6 horaires détaillés
    const showRecurrence  = mode === 'A1';                        // Bloc 7 série récurrente
    const showMultijours  = mode === 'A4' || mode === 'A5';       // Toggle multi-jours
    const showDateFin     = famille === 'stage';                  // Date fin auto pour stage
    const showFormatGlob  = false;                                // jamais en mode adaptatif (format-par-équipe le remplace)
    const showAdvMono     = mode === 'A3';                        // Adversaire singulier
    const showAdvParEq    = mode === 'A4' || mode === 'A5';       // Adversaires par équipe
    const showPhasesQ     = mode === 'A4';                        // Question phases (A4 plateau seul)
    const showPhasesZone  = mode === 'A5';                        // Phases activées par défaut A5 tournoi

    function setDisplay(id, show) {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    }

    setDisplay('evt-create-compet-group',                showCompet);
    setDisplay('evt-create-engagement',                  showEngagement);
    setDisplay('evt-create-horaires-detailles-zone',     showHoraires);
    setDisplay('evt-create-recurrence-zone',             showRecurrence);
    setDisplay('evt-create-multijours-toggle-group',     showMultijours);
    setDisplay('evt-create-date-fin-group',              showDateFin || showMultijours);
    setDisplay('evt-create-format-group',                showFormatGlob);
    setDisplay('evt-create-adversaire-mono-group',       showAdvMono);
    setDisplay('evt-create-adv-par-equipe-zone',         showAdvParEq);
    setDisplay('evt-create-phases-question',             showPhasesQ);

    // Phases zone : A5 = visible par défaut (tournoi = phases obligatoires)
    // A4 = visible si phases_mode=oui sinon caché. A1/A2/A3 = jamais.
    let showPhasesZoneEffective = showPhasesZone;
    if (mode === 'A4') {
      const radioOui = document.querySelector('#evt-create-phases-question input[name=phases_mode][value=oui]:checked');
      showPhasesZoneEffective = !!radioOui;
    }
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
    const isA4 = sousType === 'plateau';
    const isA5 = sousType === 'tournoi';

    const formatParEq = document.getElementById('evt-create-format-par-equipe');
    const advParEq    = document.getElementById('evt-create-adv-par-equipe-zone');
    const phasesParEq = document.getElementById('evt-create-phases-zone');
    const affectN2    = document.getElementById('evt-create-affectations-n2-zone');

    // Format par équipe visible si >= 2 équipes cochées (override M4)
    if (formatParEq) {
      formatParEq.style.display = (nbCoches >= 2) ? '' : 'none';
      if (nbCoches >= 2) buildFormatParEquipeLines(cbList);
    }

    // Adv par équipe : peuplé si A4/A5 et au moins 1 équipe
    if (advParEq && (isA4 || isA5) && nbCoches >= 1) {
      buildAdvParEquipeLines(cbList);
    }

    // Phases par équipe : peuplé si A4 (avec phases_mode=oui) ou A5
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
  let _staffLoadedForCat = null;
  let _staffCache = [];

  async function peuplerStaff() {
    const wrap = document.getElementById('evt-create-staff');
    if (!wrap) return;

    // Idempotent : même catégorie déjà chargée
    if (_staffLoadedForCat && _staffLoadedForCat === CTX_CATEGORIE_ID
        && wrap.querySelector('input[type=checkbox]')) {
      return;
    }

    if (!CTX_CATEGORIE_ID) {
      wrap.innerHTML = '<div class="evt-form-error">Catégorie non '
        + 'résolue : impossible de lister le staff. L\'évènement reste '
        + 'créable ; complétez l\'encadrement depuis la fiche.</div>';
      return;
    }

    wrap.innerHTML = '<div class="evt-form-hint">Chargement de la liste d\'encadrement…</div>';

    let membres = [];
    try {
      // Pattern défensif : si SupabaseHub.listStaffParCategorie n'existe pas
      // (wrapper potentiellement non livré), on tombe sur fallback honnête.
      if (typeof SupabaseHub.listStaffParCategorie === 'function') {
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
    _staffLoadedForCat = CTX_CATEGORIE_ID;

    if (_staffCache.length === 0) {
      wrap.innerHTML = '<div class="evt-form-hint">Aucun staff actif '
        + 'sur cette catégorie pour la saison en cours. Vous pourrez '
        + 'ajouter les encadrants depuis la fiche.</div>';
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
    wrap.innerHTML = html;

    // Hook change → met à jour le dropdown affectations N2 (qui ne
    // doit proposer que les staff cochés ici, cohérence intra-modale
    // D10 §3.1.6 doc UX).
    wrap.querySelectorAll('.evt-eng-staff-cb').forEach(function (cb) {
      cb.addEventListener('change', updateMultiEquipesUI);
    });
  }

  // ────────────────────────────────────────────────────────────────
  // v1.24 — HELPERS BLOCS MULTI-ÉQUIPES (F19 arborescence par équipe,
  // doc UX §3.1.4). Tous générés dynamiquement depuis la liste des
  // checkboxes cochées dans evt-create-equipes. Idempotent : recrée
  // le contenu à chaque appel (anti-résidu si nb d'équipes change).
  // ────────────────────────────────────────────────────────────────

  /**
   * Bloc 8b — Format par équipe (visible si >= 2 équipes cochées).
   * 1 ligne par équipe avec dropdown format (override M4 §4.3).
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
      const optsHtml = FORMATS.map(function (f) {
        return '<option value="' + escHtml(f.v) + '">' + escHtml(f.l) + '</option>';
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
  function buildAdvParEquipeLines(checkedCbs) {
    const wrap = document.getElementById('evt-create-adv-par-equipe-lines');
    if (!wrap) return;
    const html = Array.prototype.map.call(checkedCbs, function (cb) {
      const equipeId = cb.value;
      const equipeLabel = cb.parentElement ? cb.parentElement.textContent.trim() : equipeId;
      return '<div class="evt-eng-adv-row" data-equipe-id="' + escHtml(equipeId) + '">'
        + '<span class="evt-eng-adv-label">' + escHtml(equipeLabel) + '</span>'
        + '<input type="text" class="evt-form-input evt-eng-adv-input" '
        + 'placeholder="Adversaire / nom poule (opt.)">'
        + '</div>';
    }).join('');
    wrap.innerHTML = html;
  }

  /**
   * Bloc 8f — Phases par équipe (F19 arborescence). 1 sous-conteneur
   * par équipe cochée avec liste répétable de phases (+ matchs par phase).
   * Pour cette livraison L3a : structure minimale (1 phase par défaut,
   * boutons + Phase et + Match dans chaque phase). L'arborescence
   * complète UI évoluera progressivement.
   */
  function buildPhasesParEquipeList(checkedCbs) {
    const wrap = document.getElementById('evt-create-phases-par-equipe-list');
    if (!wrap) return;
    const html = Array.prototype.map.call(checkedCbs, function (cb) {
      const equipeId = cb.value;
      const equipeLabel = cb.parentElement ? cb.parentElement.textContent.trim() : equipeId;
      return '<div class="evt-phases-equipe-block" data-equipe-id="' + escHtml(equipeId) + '" '
        + 'style="border:1px solid var(--line); padding:8px; margin-bottom:8px; border-radius:4px;">'
        + '<div class="evt-phases-equipe-title" style="font-weight:600; margin-bottom:6px;">'
        + escHtml(equipeLabel) + '</div>'
        + '<div class="evt-phases-list-for-equipe" data-equipe-id="' + escHtml(equipeId) + '">'
        + '<div class="evt-form-hint">Au moins 1 phase requise par équipe. Édition fine depuis la fiche après création.</div>'
        + '</div>'
        + '</div>';
    }).join('');
    wrap.innerHTML = html;
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

    // Cases à cocher : 1 par équipe. value = equipe_id (consommé au
    // submit). Libellé = nom officiel (+ libellé court si présent).
    const html = equipes.map(function (eq) {
      const label = escHtml(
        eq.nom_officiel || eq.libelle_court || eq.code || eq.id);
      return '<label class="evt-eng-equipe-row">'
        + '<input type="checkbox" class="evt-eng-equipe-cb" '
        + 'value="' + escHtml(eq.id) + '"> '
        + label + '</label>';
    }).join('');
    wrap.innerHTML = html;
    _eq4aLoadedForCat = CTX_CATEGORIE_ID;

    // v1.24 — Hook change → met à jour les blocs dynamiques pilotés
    // par le nombre d'équipes cochées (format-par-équipe, adv-par-
    // équipe, phases-par-équipe-list, affectations N2 plateau).
    wrap.querySelectorAll('.evt-eng-equipe-cb').forEach(function (cb) {
      cb.addEventListener('change', updateMultiEquipesUI);
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
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return 'EVT-' + y + '-' + m + '-' + day + '-' + typeShort + '-M14-' + rand;
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

    // equipe_id racine : modes A1/A2 (entraînement/stage) → M14_TEAM_UUID
    // requis par CHECK equipe_obligatoire_si_pas_parent. Modes A3/A4/A5
    // (competition) → NULL (l'équipe est portée par les M3 evenement_
    // equipes_engagees).
    if (familleEvt === 'entrainement' || familleEvt === 'stage') {
      payload.equipe_id = M14_TEAM_UUID;
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

      // Mode A3 (1 équipe + 1 adversaire mono)
      // Mode A4/A5 (multi-équipes + adv-par-équipe)
      const isA3 = cbList.length === 1 && typeCompet !== 'plateau' && typeCompet !== 'tournoi';

      payload.equipes_engagees = cbList.map(function (cb, idx) {
        const eqId = cb.value;
        const localId = 'equipe_' + (idx + 1);
        const eng = {
          equipe_id:                 eqId,
          evenement_equipe_id_local: localId,
          ordre:                     idx + 1
        };

        // Format par équipe (override M4) si présent
        const formatRow = document.querySelector(
          '#evt-create-format-lines .evt-eng-format-row[data-equipe-id="' + eqId + '"] .evt-eng-format-select');
        if (formatRow && formatRow.value) {
          eng.format_de_jeu = formatRow.value;
        }

        // Adversaires de cette équipe (mode A3 mono ou A4/A5 par équipe)
        const advs = [];
        if (isA3 && adversaire) {
          advs.push({ adversaire_nom: adversaire, ordre: 1 });
        } else {
          const advInput = document.querySelector(
            '#evt-create-adv-par-equipe-lines .evt-eng-adv-row[data-equipe-id="' + eqId + '"] .evt-eng-adv-input');
          if (advInput && advInput.value.trim()) {
            advs.push({ adversaire_nom: advInput.value.trim(), ordre: 1 });
          }
        }
        if (advs.length > 0) eng.adversaires = advs;

        return eng;
      });

      // Phases par équipe (F19 arborescence) : modes A4 (avec phases_mode=oui) + A5
      const phasesQ = document.getElementById('evt-create-phases-question');
      const phasesQVisible = phasesQ && phasesQ.style.display !== 'none';
      const phasesOuiEl = phasesQ && phasesQ.querySelector('input[name=phases_mode]:checked');
      const phasesOui = (phasesQVisible && phasesOuiEl && phasesOuiEl.value === 'oui')
                        || typeCompet === 'tournoi'; // A5 forcé

      if (phasesOui) {
        // Pour cette livraison L3a : structure minimale 1 phase par équipe
        // (édition fine déportée à la fiche post-création, voie « lente » R4).
        payload.phases_par_equipe = cbList.map(function (cb, idx) {
          return {
            evenement_equipe_id_local: 'equipe_' + (idx + 1),
            phases: [
              { libelle: 'Phase 1', ordre: 1 }
            ]
          };
        });
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
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création…';
    msg.innerHTML = '';

    try {
      const res = await SupabaseHub.createEvenementComplet(payload);

      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : '
          + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = "Créer l'évènement";
        return;
      }

      const createdId = res.evenementId;
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement créé (transaction atomique).</div>';

      const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;

      setTimeout(async () => {
        closeModalCreate();
        await reloadEvents();
        // Ouvre la fiche si compétition (pour ajustements voie « lente »)
        if (familleEvt === 'competition' && createdId) {
          openFiche(createdId);
        }
      }, 500);
    } catch (err) {
      console.error('submitModalCreate', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : '
        + escHtml(err.message || String(err)) + '</div>';
      const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = "Créer l'évènement";
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

    const overrides = {
      code:                      generateEventCode(familleEvt, dateDebut),
      libelle:                   libelle,
      type_evenement:            familleEvt,
      date_debut:                new Date(dateDebut).toISOString(),
      equipe_id:                 (familleEvt === 'competition') ? null : M14_TEAM_UUID,
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
      buildIndexes();
      renderKPIs();
      renderListe();
      renderMiniCal();
    } catch (err) {
      console.error('reloadEvents() erreur', err);
    }
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

    document.querySelectorAll('.evt-overlay').forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });

    // Fermeture du panneau fiche détaillée
    document.querySelectorAll('[data-action="close-fiche"]').forEach(b => {
      b.addEventListener('click', closeFiche);
    });
    const ficheOverlay = document.getElementById('evt-fiche-overlay');
    if (ficheOverlay) {
      ficheOverlay.addEventListener('click', function (e) {
        if (e.target === ficheOverlay) closeFiche();
      });
    }

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
    console.log('🏉 MOM Hub · Évènements Browser — init v1.24 (S3 Refonte UX Evt→Compo)');

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

    try {
      const [evtAvenir, evtPasses] = await Promise.all([
        loadEvenementsAVenir(),
        loadEvenementsPasses()
      ]);
      EVENEMENTS_AVENIR = evtAvenir;
      EVENEMENTS_PASSES = evtPasses;

      buildIndexes();

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

      // S2.4.b — Charge le contexte des modales (saison, organisateur, sites)
      // en arrière-plan, non bloquant pour l'affichage initial
      loadModalContext();

      const smoke = document.getElementById('evt-footer-smoke');
      if (smoke) {
        const avenirRoots = EVENEMENTS_AVENIR.filter(e => !e.evenement_parent_id);
        const passesRoots = EVENEMENTS_PASSES.filter(e => !e.evenement_parent_id);
        smoke.textContent = 'MOM Hub · Module Évènements · S2.2 (v1.1) · ' +
          avenirRoots.length + ' à venir + ' +
          passesRoots.length + ' passé(s) racines · ' +
          Object.keys(CHILDREN_BY_PARENT).length + ' tournoi(s) avec matchs';
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

  console.log('%c🏉 MOM Hub · Évènements Browser v1.24 (S3 Refonte UX Evt→Compo · L3a) chargé',
    'color: #2D7D46; font-weight: bold;');

})();
