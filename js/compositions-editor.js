/**
 * MOM Hub · Compositions Editor
 * ============================================================
 *
 * Phase 4.4 — Construit progressivement :
 *   - 6a/6b/6c-1 : déjà livrés (squelette, navigation, vivier)
 *   - 6c-2/6c-3 : Vue Liste éditable + Popover Picker (CETTE VERSION)
 *
 * Version : 3.49 — Rapport de match : fil chronologique du match (déroulé) (3 juin 2026)
 *   v3.49 : pt 53. Ajout du FIL CHRONOLOGIQUE au rapport de match
 *           (manque révélé par le rapport SAR×MOM de référence : le récap
 *           par famille donne le « combien », le fil donne le « comment »).
 *           _peindreFilRapport : toutes les actions effectives, groupées
 *           par période (_libellePeriode), ordonnées par HORODATAGE (base
 *           de temps fiable). Par ligne : minute (affichée seulement si
 *           > 0 — 0 = chrono non lancé sur nos données → omise, jamais un
 *           faux « 0' »), action (libellé + icône via SuiviObs.libelle),
 *           acteur (joueur via _resolveNoms / substitution sortant→entrant
 *           / nom adversaire / vide si fait d'équipe), points (+N si > 0).
 *           Noms résolus via _resolveNoms (repli #id). Inséré entre les
 *           substitutions et le panneau temps de jeu. Lecture pure, zéro
 *           écriture. + CSS .rapport-fil* dans compositions.html.
 *           node --check OK.
 * Version : 3.48 — Rapport de match : noms des substitutions via get_noms_personnes (3 juin 2026)
 *   v3.48 : pt 53 (fix recette). Les substitutions du rapport affichaient
 *           « #87dd → #6366 » au lieu des noms : la résolution passait par
 *           getCompoReduiteRencontreCoach, dont la RPC coach
 *           (get_compo_reduite_rencontre_coach) N'EXISTE PAS en base
 *           (seule get_compo_reduite_rencontre, voie jeton, est déployée —
 *           pan « coach » jamais déployé, leçon pt 47-48). _peindreSubsRapport
 *           résout désormais les noms via SupabaseHub._resolveNoms (RPC en
 *           lot get_noms_personnes, gardée admin|coach, déployée, RGPD-safe) :
 *           Map uuid→{nom,prenom}, composition « Prénom NOM », repli #id court
 *           si non résolu (honnêteté). Couvre titulaires ET remplaçants
 *           (résolution par UUID). Seul _peindreSubsRapport change ;
 *           renderEditorRapport / _peindreRapport / _familleDeObs inchangés.
 *           node --check OK.
 * Version : 3.47 — Rapport de match v1 (socle, lecture seule du déduit) (3 juin 2026)
 *   v3.47 : pt 53. RAPPORT DE MATCH v1. 4e onglet « Rapport » à côté de
 *           Suivi (compositions.html). renderEditorRapport (ajout pur,
 *           calqué sur renderEditorSuivi) : LECTURE SEULE du déduit, sur
 *           feuille de match uniquement (base → message inerte). Lit la
 *           chronologie via SupabaseHub.getChronologieRencontreCoach
 *           (C12-k) ET le référentiel (SuiviObs.charger), agrège 100 %
 *           côté front : score (réutilise _calculerScore, SUM par camp
 *           hors annulées), récap par famille (Score/Discipline/Jeu
 *           collectif, mapping observable_id→famille via _familleDeObs
 *           dérivé de SuiviObs.catA), substitutions nominatives
 *           (sortant→entrant, noms via getCompoReduiteRencontreCoach +
 *           libelleJoueurSuivi, repli #id court — jamais de faux nom),
 *           panneau temps de jeu REPLIÉ avec libellé d'incertitude
 *           permanent (minute_match peu fiable → dégradation honnête,
 *           SUIVI-COACH-7). AUCUNE écriture (stockage du saisi reporté
 *           au 2e temps). bindViewTabs câble tabs[3] ; renderEditorArea
 *           aiguille viewMode==='rapport'. Chemins Liste/Terrain/Suivi
 *           inchangés. node --check OK.
 * Version : 3.46 — Suivi live : L5 observations Cat B + fix libellés historique (2 juin 2026)
 *   v3.46 : L5. (1) Section repliable « Observations » (Cat B, en retrait,
 *           D8) en bas de palette : observations qualitatives par joueur,
 *           sans points ; liste selon tranche d'âge déduite du nom d'équipe
 *           (SuiviObs.observablesB ; repli M-14_F-15) ; saisie via attribution
 *           joueur, categorieObs='B', observable_id = slug (_slugObsB).
 *           (2) FIX régression d'affichage : l'historique montrait les
 *           identifiants bruts (obs-A-…) quand le référentiel n'était pas
 *           encore chargé au 1er rendu. _peindreHistorique charge désormais
 *           SuiviObs si besoin puis re-peint. SuiviObs.libelle résout aussi
 *           les libellés Cat B. Référentiel fetché (admin = OBSERVABLES-ADMIN
 *           futur). node --check OK.
 * Version : 3.45 — Suivi live : substitution filtrée (vrais entrants/sortants) (2 juin 2026)
 *   v3.45 : #3 version simple (retour terrain Manu). La substitution filtre
 *           désormais les listes : « qui sort ? » = joueurs sur le terrain,
 *           « qui entre ? » = joueurs au banc. _etatTerrain() reconstitue
 *           l'état à l'instant T depuis l'effectif (titulaires/remplaçants)
 *           + les substitutions non annulées (ordre chrono). Lignes mémo
 *           dans SuiviChrono.lignes (pas d'appel réseau au clic). Blessures/
 *           cartons NON pris en compte (raffinement futur). node --check OK.
 * Version : 3.44 — Vue Terrain : cadre charte réseaux (bandeau + liseré, toggle partagé) (2 juin 2026)
 *   v3.44 : Le cadre « réseaux sociaux » (bandeau logo+nom + liseré +
 *           toggle MOM/entente) est désormais aussi sur l'onglet TERRAIN
 *           (retour terrain Manu). Toggle PARTAGÉ avec Suivi via
 *           SuiviHabillage. Bandeau factorisé : helpers _bandeauHTML /
 *           _bindHabillageToggle / _habillageCourant / _logoHabillage,
 *           réutilisés par renderEditorSuivi et renderEditorTerrain (zéro
 *           duplication). Logo selon habillage. node --check OK.
 * Version : 3.43 — Suivi live : fix logo du bandeau selon l'habillage (2 juin 2026)
 *   v3.43 : FIX (retour terrain Manu). Le logo du bandeau suivait toujours
 *           MOM (logo-m2m.png en dur). Désormais selon l'habillage :
 *           assets/ecusson-mom.png (mom) / assets/logo-entente.png (entente),
 *           chemins repris de _collecterDonneesExport. node --check OK.
 * Version : 3.42 — Suivi live : score en 3 colonnes + palette score Nous/centre/Adverse (2 juin 2026)
 *   v3.42 : Lisibilité (retour terrain Manu). (1) Bloc SCORE en 3 colonnes :
 *           notre équipe + son score à gauche, « — » au centre, adverse +
 *           son score à droite (nom en haut, gros score dessous). (2) Lignes
 *           de la palette SCORE : bouton Nous à gauche, libellé centré,
 *           bouton Adverse à droite (familles mouvement/discipline/jeu
 *           collectif inchangées). Purement présentation. node --check OK.
 * Version : 3.41 — Suivi live : cadre charte réseaux (bandeau + liseré, MOM/entente) (2 juin 2026)
 *   v3.41 : CADRE rappel charte « réseaux sociaux » (retour terrain Manu).
 *           Bandeau en haut (logo + nom d'équipe + sous-titre + filet doré)
 *           + liseré autour de .view-suivi. Toggle MOM / entente
 *           (SuiviHabillage, runtime, défaut mom) qui ne change QUE le
 *           cadre — l'intérieur sombre est inchangé. Couleurs reprises de
 *           compo-export.js (mom : vert bouteille + or ; entente : bleu
 *           marine + bleu ciel). node --check OK.
 * Version : 3.40 — Suivi live : thème « tableau de stade » sur tout l'onglet (2 juin 2026)
 *   v3.40 : DESIGN étendu (retour terrain Manu). Le thème sombre tableau
 *           de stade s'applique désormais à TOUTE la feuille de suivi
 *           (score, chrono à tous états dès avant le coup d'envoi, palette
 *           score/mouvement/discipline/jeu collectif, attribution,
 *           historique), scopé .view-suivi (Liste/Terrain restent clairs).
 *           Purement CSS ; la classe conditionnelle suivi-chrono--stade de
 *           v3.39 est retirée (plus nécessaire). node --check OK.
 * Version : 3.39 — Suivi live : design « tableau de stade » du chrono (2 juin 2026)
 *   v3.39 : DESIGN chrono pro (direction A, retour terrain Manu). Le bloc
 *           chrono en état EN COURS / PAUSE adopte un look tableau de stade :
 *           fond sombre (#14181c), chiffres ambre lumineux fluides
 *           (clamp 64→104px, responsive mobile), halo, contrôles adaptés
 *           au fond sombre. Classe modificatrice suivi-chrono--stade
 *           posée/retirée dans _peindreChrono (états config/armé/terminé
 *           gardent le style sobre). Aucune logique touchée. node --check OK.
 * Version : 3.38 — Affichage équipe : nom_officiel prioritaire (1 juin 2026)
 *   v3.38 : NOM D'ÉQUIPE. En-tête (eqLabel) + score du suivi (_nomNotreEquipe)
 *           affichent désormais nom_officiel || libelle_court || code (au
 *           lieu de libelle_court d'abord). Corrige « M14 » → « SAR/MOM-M14-1 »
 *           et le cas libelle_court NULL (équipes E2/E3). Aligne les deux
 *           endroits sur le même ordre (cohérent avec wrapper v1.39).
 * Version : 3.37 — Suivi live : temps additionnel + vrais noms d'équipes (1 juin 2026)
 *   v3.37 : Améliorations terrain. (1) TEMPS ADDITIONNEL : au-delà de la
 *           durée réglementaire, le chrono continue et affiche le
 *           dépassement « 30:00 +2:15 » (ou « 00:00 +2:15 » en rebours).
 *           _tempsAffiche {principal, additionnel}. (2) NOMS D'ÉQUIPES :
 *           score « MOM/ADV » remplacé par les vrais noms (notre équipe via
 *           evenementEquipeContext, adversaire via matchsDeLequipe) — MOM
 *           était faux pour une entente SAR/ASCS. _nomNotreEquipe /
 *           _nomAdversaireCourt. node --check OK.
 * Version : 3.36 — Suivi live : discipline + jeu collectif (L3d) (1 juin 2026)
 *   v3.36 : L3d. Sections « Discipline » (cartons jaune/rouge,
 *           avertissement → attribution nominative comme un score Nous)
 *           et « Jeu collectif » (mêlées/touches gagnées/perdues → fait
 *           d'équipe, equipe=notre, sans joueur, 1 clic). 0 point (hors
 *           score, dans l'historique). Palette Cat A désormais complète.
 *           Motif optionnel des cartons = dette légère (non implémenté).
 * Version : 3.35 — Suivi live : substitution + blessure (L3c) (1 juin 2026)
 *   v3.35 : L3c. Section « Mouvement » dans la palette. Substitution :
 *           double sélection « qui sort ? » → « qui entre ? » (tout
 *           l'effectif), enregistrée avec joueurUuid=sortant +
 *           joueurUuidEntrant=entrant (consomme C12-m via wrapper v1.44).
 *           Blessure : attribution simple + flag estBlessure. 0 point
 *           (hors score). _ouvrirSubstitution ; _ouvrirAttribution gagne
 *           opts.estBlessure + valeurPoints sécurisé. node --check OK.
 * Version : 3.34 — Suivi live : historique replacé sous le chrono (1 juin 2026)
 *   v3.34 : ORDRE de l'écran suivi : score → chrono → palette →
 *           historique (le chrono, info de pilotage, juste sous le score ;
 *           l'historique, consultatif, en bas). Retour terrain Manu.
 * Version : 3.33 — Suivi live : historique annulable (L4) (1 juin 2026)
 *   v3.33 : L4. Historique des actions sous le score (anti-chrono, récent
 *           en haut) : minute · action · joueur/camp, bouton « annuler »
 *           par ligne active (annulerObservableCoach C12-t → annule=TRUE,
 *           jamais DELETE) ; lignes annulées barrées (badge « annulée »).
 *           Libellé via SuiviObs.libelle (uuid→libelle_court). Score +
 *           historique rafraîchis ensemble (_rafraichirScoreEtHistorique,
 *           lecture inclureAnnulees=true). Bouton liste joueurs renommé
 *           « ↩ Retour » (vs annulation d'action). node --check OK.
 * Version : 3.32 — Suivi live : attribution nominative côté Nous (L3b) (1 juin 2026)
 *   v3.32 : L3b. Boutons « Nous » de la palette score ouvrent la liste
 *           d'attribution (effectif compo trié titulaires 1→15 puis
 *           remplaçants ; nom en avant + numéro en pastille). Tap joueur
 *           → insererObservableCoach (equipe notre, joueurUuid=cj.joueur_id,
 *           minute du chrono) → score rafraîchi, retour palette. Effectif
 *           résolu via getJoueurVivier (cj.personnes bloqué par RLS).
 *           _effectifPourSaisie / _ouvrirAttribution. node --check OK.
 * Version : 3.31 — Suivi live : palette Cat A + saisie score adverse (L3a) (1 juin 2026)
 *   v3.31 : L3a. Référentiel observables FETCHÉ une fois depuis
 *           data/observables-match.json (objet SuiviObs ; cible
 *           OBSERVABLES-ADMIN = éditable admin plus tard). Palette score
 *           sous le chrono (période en cours) : essai/transfo/pénalité/
 *           drop, 2 boutons Nous (inerte L3a) / Adverse (actif). Boutons
 *           Adverse → insererObservableCoach (equipe adverse, sans joueur,
 *           minute du chrono) → score rafraîchi. _saisirObservable.
 *           Attribution nominative côté Nous = L3b.
 * Version : 3.30 — Suivi live : mode rebours + score affiché (L2/3b) (1 juin 2026)
 *   v3.30 : CHRONO 3b. (1) Mode compte à REBOURS : secondesAffichees()
 *           selon mode_affichage (durée période − écoulé, borné 0) ;
 *           toggle ⏳/⏱ qui persiste via set_mode (C12-r). (2) SCORE
 *           calculé affiché en haut (MOM x — y ADV), _calculerScore
 *           répliqué de suivi-app.js (I1 jamais stocké), lu via
 *           getChronologieRencontreCoach, rafraîchi à chaque action.
 *           Reste à 0-0 jusqu'à L3 (saisie d'observables).
 * Version : 3.29 — Suivi live : bouton Réinitialiser le chrono (1 juin 2026)
 *   v3.29 : CHRONO bouton ↺ Réinitialiser (action reset, C12-q) dans les
 *           états armée / en cours / terminé, avec confirmation. Remet le
 *           chrono à zéro (config durées conservée) ; ne touche PAS les
 *           observables de jeu. Helpers _btnReset/_bindReset. Retour terrain.
 * Version : 3.28 — Suivi live : démarrage manuel par période + périodes variables (1 juin 2026)
 *   v3.28 : CHRONO retour terrain. (1) Démarrage MANUEL de chaque période :
 *           « ▶ Démarrer » par période ; « Fin de la <période> » arme la
 *           suivante SANS la relancer (état armé en attente). Émet
 *           demarrer_periode (cf. C12-p), plus coup_envoi. (2) Nombre de
 *           périodes VARIABLE (1/2/3…) + durée par période, vocabulaire
 *           adaptatif (période unique / mi-temps / tiers-temps). _peindreChrono
 *           réécrit : config / armée / en cours / terminé.
 * Version : 3.27 — Suivi live éducateur seul : chrono de rencontre (L2/3a) (1 juin 2026)
 *   v3.27 : CHRONO L2/3a. renderEditorSuivi réécrit : config des durées
 *           (avant coup d'envoi) + chrono persistant (C12-n) qui tourne
 *           (recalcul depuis horodatages, survit au reload) + pause/
 *           reprise/mi-temps/fin. Objet SuiviChrono (interval désarmé en
 *           sortie d'onglet via setMode, anti-fuite). Adversaire résolu
 *           via State.matchsDeLequipe (point parké L1 corrigé). Voie
 *           coach (actionChronoCoach/getChronoRencontreCoach). Mode
 *           rebours + score = 3b. Chemin Liste/Terrain inchangé.
 *   v3.26 : SUIVI L1. 3e onglet « Suivi » + aiguillage renderEditorArea
 *           → renderEditorSuivi (ajout pur) ; compo de match → écran prêt,
 *           base → message inerte (D2). bindViewTabs câble tabs[2].
 * Version : 3.25 — Deep-link de mode ?vue=terrain|reseaux depuis la fiche évènement (1 juin 2026)
 *   v3.25 : DEEP-LINK DE MODE. Les vignettes « Vue terrain » et « Vue
 *           réseaux sociaux » de la fiche évènement (evenements-browser.js)
 *           pointent vers compositions.html?evenement_equipe=<id>&vue=<terrain
 *           |reseaux>. Au boot, après bindViewTabs/bindExportImage et le
 *           chargement de la compo : ?vue=terrain bascule State.viewMode et
 *           active l'onglet Terrain ; ?vue=reseaux déclenche le bouton
 *           d'export (ouvre la modale). Ajout PUR (un bloc try au boot,
 *           aucune fonction existante touchée). node --check OK.
 *
 * Version : 3.24 — FIX chargement feuilles de match multi-équipes (1 juin 2026)
 *   v3.24 : FIX 409 « duplicate key idx_compositions_active_match_per_base_cote ».
 *           En multi-équipes engagées, loadComposForCurrentEvent chargeait les
 *           feuilles de match via listCompositionsByEquipe(M14_TEAM_UUID), dont
 *           la jointure evenements!inner filtre sur equipe_id=M14. Or une feuille
 *           de match a pour evenement_id le MATCH, dont equipe_id = l'équipe
 *           ENGAGÉE (≠ M14) → exclue à tort → onglet affiché « à faire » alors
 *           que la compo existe → clic = re-création → 409 (contrainte unique).
 *           FIX : chargement par compo_base_origine_id via le nouveau wrapper
 *           SupabaseHub.listMatchsParBaseOrigine(base.id) (lien robuste, sans
 *           jointure equipe_id restrictive). Aucune donnée touchée, bug 100%
 *           côté lecture front. node --check OK.
 *
 * Version : 3.23 — Export image de la composition (réseaux sociaux) (1 juin 2026)
 *   v3.23 : EXPORT IMAGE. Bouton « 📷 Image » ajouté à côté des onglets
 *           Liste/Terrain (action, pas un mode de vue). Au clic, collecte
 *           la compo COURANTE (titulaires triés par numero_xv + remplaçants
 *           16→23, badge club via club_principal_nom_court, ligne av/ch/ar
 *           dérivée du numéro) et délègue au module autonome window.CompoExport
 *           (js/compo-export.js, rendu Canvas natif, versions MOM/entente,
 *           export PNG). Aucune fonction d'écriture ni de rendu existante
 *           touchée : ajouts purs (bindExportImage + _collecterDonneesExport
 *           + _ligneDePoste). v1 : initiales (pas de photos), pas de staff.
 *           Logos chargés depuis assets/ (ecusson-mom.png, logo-entente.png).
 *           node --check OK.
 *
 * Version : 3.22 — Vue Terrain MULTI-FORMAT (XV / XIII / X / VII) (1 juin 2026)
 *   v3.22 : MULTI-FORMAT de la vue Terrain (chantier UX-EVT-VUE-TERRAIN).
 *           Jusque-là la vue Terrain plaçait les joueurs avec la seule table
 *           TERRAIN_POS_XV en dur. Ajout de 3 tables sœurs (TERRAIN_POS_13,
 *           TERRAIN_POS_X, TERRAIN_POS_7), d'un sélecteur TERRAIN_POS_PAR_FORMAT
 *           et d'un helper terrainPosCourant() qui lit le format de l'équipe
 *           engagée (State.evenementEquipeContext.evenement_equipe.format_de_jeu)
 *           et renvoie la table adéquate, DÉFAUT XV (legacy/NULL/inconnu :
 *           dégradation honnête). renderEditorTerrain itère désormais sur la
 *           table courante au lieu de TERRAIN_POS_XV en dur (seule ligne de
 *           rendu modifiée ; tout le reste — DnD, banc, états — inchangé).
 *           Compositions par format alignées sur postes.formats_applicables
 *           corrigé en base (sql/70) : XIII = XV sans flankers (coords XV
 *           réutilisées) ; X (10) = pack à 5 dont 2L sur les extérieurs +
 *           9-10-12-14-15 ; VII (7) = 3 avants + 9-10 + 12 + 11. Vocabulaires
 *           format non alignés (format_de_jeu 12/7 ≠ formats_applicables
 *           XV/13/X/7 ≠ dropdown Évènements) réconciliés par mapping front
 *           ('12'→XV) — dette MODELE-FORMAT-VOCAB. node --check OK.
 *
 * Version : 3.21 — État joueur DÉRIVÉ par comparaison à la base (fix rouge figé) (1 juin 2026)
 *   v3.21 : FIX bug « modifié rouge figé » (Manu) — un joueur revenu à son
 *           choix de base restait marqué modifié. L'état base/modifié n'est
 *           plus lu du champ stocké etat_joueur mais DÉRIVÉ (etatDeriveJoueur)
 *           par comparaison à la compo de BASE (par poste + rôle, décisions
 *           Manu). loadCompoJoueurs charge State.baseJoueurs (compo de base)
 *           quand la courante est un match. Les états explicites blesse/
 *           independant sont préservés. Tous les rendus (Liste slot titulaire
 *           & remplaçant, Terrain pastille) et le compteur « N modifs vs base »
 *           utilisent l'état dérivé. node --check OK.
 *
 * Version : 3.20 — Vue Terrain/Liste : fix promotion remplaçant + bouton « ↓ banc » (1 juin 2026)
 *   v3.20 : 2 fixes issus de la recette (Manu). (1) BUG promotion remplaçant
 *           depuis le picker vue Liste : un remplaçant cliqué sur un poste
 *           vacant passait par onPickJoueurPourSlot (INSERT) → violait
 *           composition_joueurs_unique_per_compo (joueur déjà présent). Fix :
 *           les items « --from-bench » du picker sont routés vers
 *           onDropJoueurSurPoste (gère existant→updateJoueurCompo) ; le vivier
 *           garde le chemin add (onPickJoueurPourSlot inchangé). (2) En vue
 *           Liste, le slot titulaire a désormais DEUX actions : « ↓ banc »
 *           (rétrograder en remplaçant, via onDropJoueurSurBanc) ET « × »
 *           (retrait TOTAL de la compo, ex. blessure — onRemoveJoueurClick,
 *           inchangé). renderSlotPoste + bindSlotHandlers modifiés en
 *           conséquence (ajouts ciblés, croix existante préservée).
 *           compositions.html : CSS .slot__bench. node --check OK.
 *
 * Version : 3.19 — Vue Terrain : banc drag+drop, rempl. au picker Liste, pastilles +grandes (1 juin 2026)
 *   v3.19 : suite recette drag (retours Manu). (1) BANC drag+drop bidirectionnel :
 *           les remplaçants (vt-bench-item) sont draggables (source) → on peut
 *           les glisser sur un poste (montée au XV) ; le bandeau banc est une
 *           zone de drop (.vt-bench-drop) → déposer un titulaire l'envoie au
 *           banc (onDropJoueurSurBanc, prochain n° 16-23, refus si plein).
 *           Corrige le bug v3.18 « impossible de sortir un joueur du banc ».
 *           (2) Picker vue LISTE : sur un poste vacant, section « Remplaçants »
 *           ajoutée (popoverListItemsSlotVide) → cliquer un remplaçant le
 *           promeut au XV via onPickJoueurPourSlot (handler existant inchangé,
 *           addJoueurCompo réaffecte ; banc non recompacté). (3) Pastilles
 *           agrandies : disque 48→54px, numéro 22→24px. compositions.html :
 *           CSS pastilles + feedback banc + section remplaçants. node --check OK.
 *
 * Version : 3.18 — Vue Terrain étape C : édition au drag (1 juin 2026)
 *   v3.18 : ÉDITION AU DRAG sur le terrain (sortie du lecture seule). 3 gestes :
 *           pastille→pastille (déplacer un titulaire), vivier→pastille (faire
 *           entrer un joueur), dépôt sur poste vide. Règle (Manu) : dépôt sur
 *           poste OCCUPÉ → l'occupant part au BANC (prochain n° 16-23 libre ;
 *           si banc plein → sort au vivier), puis le joueur déposé prend le
 *           poste. Drag autorisé même sur compo validée. onDropJoueurSurPoste
 *           applique la règle et écrit UNIQUEMENT via la couche existante
 *           (addJoueurCompo / updateJoueurCompo / removeJoueurCompo) ; état via
 *           etatJoueurPourCompoCourante() (→ 'modifie' en compo de match).
 *           Pastilles : draggable + data-joueur-id (source) + data-poste-id
 *           (cible), câblage bindTerrainDnD. Items vivier rendus draggables
 *           (dragstart) dans renderEffectifPanel (U-N3 + legacy). compositions.html :
 *           CSS feedback (grab, survol cible, dragging). node --check OK.
 *
 * Version : 3.17 — Vue Terrain : pastilles agrandies + noms complets (1 juin 2026)
 *   v3.17 : retours recette terrain Manu sur la vue Terrain (étape B). (1)
 *           Pastilles agrandies : disque 40→48px, numéro 18→22px (lisibilité).
 *           (2) Noms longs ne sont plus tronqués : nomJoueurCompact utilise
 *           désormais les champs SÉPARÉS prenom/nom du vivier (au lieu de
 *           re-découper la chaîne concaténée, qui cassait sur les prénoms
 *           composés — « Sidi-Mohamed Chakor » → « S.MOHAMED CHAK… ») →
 *           initiale du prénom + nom de famille COMPLET ; CSS .vt-mark__nom
 *           élargi (110px) sans ellipse, retour à la ligne autorisé
 *           (overflow-wrap:anywhere). compositions.html : CSS pastilles.
 *           node --check OK.
 *
 * Version : 3.16 — Vue Terrain étape B (terrain dessiné + placement oblique) (1 juin 2026)
 *   v3.16 : VUE TERRAIN, étape B. renderEditorTerrain RÉÉCRIT : remplace la
 *           grille de l'étape A par un terrain de rugby DESSINÉ (SVG fond :
 *           en-buts, lignes 22m/10m/médiane, poteaux haut+bas) avec les
 *           pastilles positionnées à leurs COORDONNÉES TACTIQUES (table
 *           TERRAIN_POS_XV en % left/top, dérivée d'une maquette validée
 *           par Manu : 1ʳᵉ ligne 1-2-3 à plat ; 4-5 ; flankers 6-7 avancés
 *           et écartés ; N°8 à la base ; charnière 9-10 en diagonale ;
 *           trois-quarts 11-12-13-14 ALIGNÉS ; arrière 15 centré ; PACK EN
 *           HAUT → ARRIÈRE EN BAS). Pastille .vt-mark = libellé poste +
 *           disque numéroté + nom compact, posée en absolu (translate -50%).
 *           Toujours LECTURE SEULE, toujours branché sur la compo COURANTE
 *           (suit base/match). Le câblage onglets/viewMode/aiguillage de
 *           l'étape A est conservé tel quel. Coordonnées figées côté front
 *           (la base postes n'a pas de x/y) ; format XV uniquement (les
 *           autres formats auront leur propre table, étape ultérieure).
 *           compositions.html : CSS .view-terrain réécrit (pitch en ratio
 *           140%, SVG en fond, .vt-mark en absolu). node --check OK.
 *
 * Version : 3.15 — Vue Terrain étape A (lecture seule) (1 juin 2026)
 *   v3.15 : VUE TERRAIN, étape A (chantier UX-EVT-VUE-TERRAIN). Câble
 *           enfin les onglets Liste/Terrain (morts jusque-là : aucun
 *           handler) via bindViewTabs() au boot. Nouveau State.viewMode
 *           ('liste'|'terrain', préférence d'affichage indépendante de la
 *           compo). renderEditorArea() aiguille : si viewMode==='terrain',
 *           appelle renderEditorTerrain(el, compo) et sort ; le chemin
 *           'liste' est byte-identique (mêmes gardes, même bloc view-liste,
 *           même bindSlotHandlers). renderEditorTerrain = projection
 *           LECTURE SEULE de la compo COURANTE (State.compoJoueurs, suit
 *           l'onglet base/match) sur un terrain : placement dérivé de
 *           postes.ligne (7 rangs, PACK EN HAUT → ARRIÈRE EN BAS), nom
 *           résolu comme la vue Liste (getJoueurVivier → prenom/nom),
 *           états réutilisant cssClassEtatJoueur. Bandeau remplaçants sous
 *           le terrain. AUCUNE édition (pas de bindSlotHandlers en terrain).
 *           Étape A = format XV figé (15 postes) ; le filtre multi-format
 *           (VII/XIII/X via formats_applicables + format_de_jeu, déjà
 *           exposé par getEvenementEquipeContext) = étape A-bis, séparée.
 *           compositions.html : retrait du is-active codé en dur sur
 *           l'onglet Liste (piloté par bindViewTabs) + CSS .view-terrain
 *           (esthétique minimale assumée ; charte Top 14 = chantier export
 *           réseaux sociaux). node --check OK.
 *
 * Version : 3.14 — Fix réf évènement en mode U-N3 (P2) (31 mai 2026)
 *   v3.14 : FIX P2 (retour terrain Manu) — quand on arrivait sur la page
 *           Compositions DEPUIS un évènement (mode U-N3, ?evenement_equipe=…),
 *           aucune référence à l'évènement n'était visible (ni titre, ni date,
 *           ni équipe) : on tombait directement sur le bandeau d'état. Cause :
 *           init() faisait selBtn.style.display='none' en U-N3 (v3.8, pour
 *           retirer le sélecteur d'évènement qui n'a pas de sens quand l'évt
 *           est fixé par l'URL) — or #event-selector-btn EST le conteneur de
 *           event-type + event-label + event-meta (le titre que renderEventBanner
 *           remplit). Le masquer effaçait le titre avec le bouton. FIX : en U-N3
 *           on NE masque plus, on neutralise — classe CSS event-banner__btn--static
 *           (pas de ▾, pas de hover, curseur normal) ; le bouton reste affiché donc
 *           le titre redevient visible, mais n'agit plus (aucun handler de toggle
 *           attaché). Legacy strictement byte-identique (handler attaché, pas de
 *           classe). Modif bornée : header + 1 bloc init() (display:none → classList.add)
 *           + console.log boot + 3 règles CSS dans compositions.html. node --check OK.
 *
 * Version : 3.13 — Fix état joueur dans compo de match (31 mai 2026)
 *   v3.13 : FIX 6c-6 (recette terrain Manu) — un remplacement dans une compo
 *           de match restait marqué « BASE » (couleur bleue) et le compteur
 *           affichait « 0 modification vs base ». Cause : onPickJoueurPourSlot
 *           ET onPickPostePourJoueur posaient etat_joueur:'base' EN DUR, quel
 *           que soit le type de compo. Or dans une compo de match, un joueur
 *           qu'on place/remplace est une modification vs la base. FIX : helper
 *           etatJoueurPourCompoCourante() → 'modifie' si la compo sélectionnée
 *           est type_compo==='match', sinon 'base'. Les 2 chemins de placement
 *           l'utilisent. La copie initiale (duplicateCompoFromBase, etat='base')
 *           reste correcte (joueurs hérités = base, compteur 0 à la création).
 *           Valeur 'modifie' : reconnue par compteurs() (!=='base'),
 *           cssClassEtatJoueur (etat-modifie = couleur « Modifié pour ce
 *           match ») et libelleEtatJoueurCourt ('Modifié'). addJoueurCompo
 *           l'accepte (pas de whitelist). node --check OK.
 *
 * Version : 3.12 — Création de compo de MATCH (étape 6c-6) (31 mai 2026)
 *   v3.12 : CHANTIER 6c-6 — « préparer ses compos de match ». Le bouton « + »
 *           était un placeholder (alert « à brancher en étape 6c-6 ») : la
 *           création de compo de match n'existait pas. Implémenté en 4 briques.
 *           Décisions actées avec Manu :
 *           • Onglets pré-générés depuis les matchs saisis de l'équipe (option
 *             A : TOUS les matchs en onglets d'emblée, même sans compo) ;
 *             regroupés par phase SI plus d'une phase ; + un « + » pour une
 *             compo libre (brouillon).
 *           • Compo de match = COPIE de la base, puis ajustée
 *             (duplicateCompoFromBase, wrapper existant).
 *           • Option α (preuve : aucune contrainte evenement_id=racine ; la
 *             ligne ~511 cherchait déjà l'évènement de m.evenement_id) : la
 *             compo de match porte evenement_id = LE MATCH (pas la racine).
 *             Pas de migration schéma.
 *           Briques : (0) wrapper supabase-client listMatchsDeLequipe(racine,
 *           equipe) [2 niveaux sous racine, filtre equipe_id + adversaire] ;
 *           (1) loadComposForCurrentEvent charge State.matchsDeLequipe et
 *           reconnaît les compos de match par compo_base_origine_id===base.id
 *           SEUL (l'ancien filtre evenement_id===racine, faux en α, est retiré) ;
 *           (2) renderCompoTabs réécrit : [Base] + onglets matchs (par phase si
 *           >1), appariés à leur compo via compo.evenement_id===match.id, état
 *           vide (--todo, clic=créer) vs composé (clic=ouvrir), + « + » libre ;
 *           (3) onCreateMatchCompo(matchId) : garde isCreatingMatch, ouvre si
 *           déjà composé sinon duplicateCompoFromBase(base.id, matchId||racine).
 *           Mode legacy (sans équipe engagée) PRÉSERVÉ (branche else onglets
 *           bruts). CSS compositions.html : --todo, __phase, flex-wrap.
 *           node --check OK.
 *
 * Version : 3.11 — Barre de parcours (← Fiche / ← Groupe de base) (31 mai 2026)
 *   v3.11 : NAVIGATION du parcours. Ajout d'une barre #compo-parcours en
 *           haut de page (HTML + CSS compo-parcours__link), avec deux liens
 *           remplis dynamiquement (renderParcours, appelée par renderEvent-
 *           Banner) : « ← Fiche évènement » → evenements.html?fiche=<evenement
 *           .id> (deep-link lu par evenements-browser v1.54 ; lève la dette
 *           SUIVI-COACH-deeplink mentionnée en v3.6) ; « ← Groupe de base » →
 *           groupe-base.html?evenement_equipe=<evenementEquipeId>. Le bouton
 *           « Retour aux évènements » rendu dans la bannière (v3.6, navigation
 *           sèche vers la liste, conditionné état validé) est RETIRÉ au profit
 *           de cette barre (toujours visible en mode U-N3). Affichée seulement
 *           si contexte équipe engagée présent (evenementEquipeId + evenement).
 *           ids tirés de State.evenementEquipeContext (déjà chargé, rien de
 *           neuf côté données). node --check OK.
 *
 * Version : 3.10 — Hygiène console.log boot (20 mai 2026)
 *   v3.10 : HYGIÈNE — bump console.log boot (conv `Production ·
 *           Hygiène — console.log boots + nettoyage données test`,
 *           pt 17). Le console.log de boot affichait encore
 *           « v3.6 (étape 6c-2 + 6c-3 + validation compo + retour
 *           évènements) chargé » alors que les bumps v3.7 → v3.9
 *           (3 maillons) avaient tous laissé la ligne intacte, hors
 *           périmètre récurrent (incohérence préexistante tracée
 *           pt 13/15/16). S2bis option a actée pt 17 : libellé
 *           version-only durable + diag object 2ᵉ argument
 *           PRÉSERVÉ byte-identique (sa valeur opérationnelle a
 *           été prouvée à la recette terrain pt 16 — boot éditeur
 *           U-N3 `{evenements:1, vivier:15, postes:15, compos:1,
 *           compoJoueurs:0}` était la 2ᵉ des 3 confirmations
 *           chiffrées tranchant la cause racine).
 *
 *           Modif bornée : version header v3.9 → v3.10 + 1 entrée
 *           changelog (celle-ci) + 1 chaîne de caractères dans le
 *           console.log boot (1er arg seul changé, 2ᵉ arg style +
 *           3ᵉ arg diag object byte-identiques). Aucune autre
 *           fonction touchée. Aucun comportement legacy/U-N3
 *           modifié. 2 hunks ciblés (1 addition pure changelog +
 *           1 ligne console.log), diff prouvé minimal.
 *           Provenance md5 : v3.9 2d6a19b1 → v3.10 (recollé par
 *           Manu après écriture). node --check OK.
 *
 * Version : 3.9 — Étape (c) U-N3 garde anti-concurrence (20 mai 2026)
 *   v3.9 : FIX double-clic CTA « Créer la compo de base » détecté à
 *           la recette terrain Manu 20/05. Symptôme : 2 clics rapides
 *           déclenchent 2 INSERT concurrents → 2ᵉ refusé par sql/50
 *           (index unique partiel idx_compositions_active_base_per_
 *           event_equipe_cote) → alert remontée à l'écran (« duplicate
 *           key value violates unique constraint »). État base sain
 *           (l'index a fait son travail, P4 honnête) ; UX dégradée
 *           (friction sur le terrain). Cause racine : la garde
 *           btn.disabled=true v3.7 ne protège pas si (a) deux clics
 *           sont émis avant que le DOM ait propagé l'état, ou (b) le
 *           bouton est re-rendu entre les deux. Le fait a tranché —
 *           recette Manu : « 1 peut-être 2 clics... pas sûr et
 *           certain » + sonde base = 1 ligne créée + 1 erreur =
 *           hypothèse double-clic confirmée par la cohérence des
 *           faits. FIX : garde State.isCreatingBase + try/finally
 *           (patron anti-double-submit propre) — si la fonction est
 *           ré-entrée concurremment, le 2ᵉ appel retourne
 *           instantanément. Compatible legacy ET U-N3 (la garde est
 *           au niveau du flux, pas du mode). Aucun retry automatique
 *           (anti-mutation silencieuse) : le clic unique correctement
 *           garde-foué suffit. Modif bornée : version + changelog +
 *           1 champ State + refonte onCreateBaseClick (try/finally).
 *           Aucune autre fonction touchée ; aucun comportement
 *           legacy modifié hors flux protégé. node --check OK.
 *           Chaîne md5 v3.7 18733c08 → v3.8 63a62d73 → v3.9.
 *
 * Version : 3.8 — Étape (c) U-N3 (20 mai 2026)
 *   v3.8 : Extension Façon 1 « éditeur étendu pas dupliqué » — bascule
 *           par paramètre d'URL ?evenement_equipe=<uuid> (SD-1 actée
 *           20/05). Param absent = comportement legacy STRICTEMENT
 *           inchangé (mode mono-équipe M14 hard-codé), preuve par diff
 *           vs md5 18733c08 : tous les chemins legacy tombent dans
 *           l'else du dispatch et restent byte-identiques. Param
 *           présent = mode U-N3 :
 *           - UN3-1 pioche = groupe N2 de l'équipe engagée
 *             (listGroupeEngage déployé v1.22+)
 *           - création base = geste explicite via CTA existant
 *             (btn-create-base réutilisé), createCompo passe
 *             evenement_equipe_id (v1.27 prête, addition pure
 *             rétro-compat)
 *           - UN3-3/4/5 repli hors-groupe : toggle persistant dans
 *             le panneau effectif (calque pattern existant
 *             effectif-filter-sar) → pioche élargie via
 *             listJoueursCategorieEntente, joueurs hors-groupe
 *             marqués `_horsGroupe=true` en mémoire, placés avec
 *             `est_depannage_hors_categorie=true` (champ EXISTANT
 *             sql/18, exposé non inventé). UI : visuel orange.
 *             Jamais bloquant (P4).
 *           - UN3-6 frontière joueur/staff tenue : pioche N2 filtre
 *             role='joueur' (le staff convoqué ne joue pas)
 *           - A1 sélecteur d'évènement masqué en mode U-N3
 *             (l'évènement est fixé par l'URL ; retour à la fiche
 *             pour changer)
 *           - B1 onglets matchs filtrés par equipe engagée
 *             (compos rattachées via evenement_equipe_id pour la
 *             base, puis matchs dérivés via compo_base_origine_id
 *             === base.id — option A pure Q1a)
 *           - bannière enrichie : libellé court de l'équipe affiché
 *             à côté du libellé évènement (3 dimensions évènement /
 *             équipe / état de compo)
 *           Décisions actées 20/05 conv (c) : Q1a option A pure
 *           (matchs ne portent pas evenement_equipe_id, dérivent via
 *           compo_base_origine_id) ; Q2a N matchs actifs simultanés
 *           multi-équipes ; Q3b sql/50 deux index unique partiels
 *           (NULLS NOT DISTINCT bases / par base matchs) ; Q4a
 *           création base via CTA existant (jamais à la volée).
 *           Modèle Collectif v1.1 §3-4 + UX §3 FAIT FOI, non rouverts.
 *           Hors périmètre intentionnel : NB_TITULAIRES_XV=15 reste
 *           hard-codé (Partie B format adaptatif XV/X/7/13 = chantier
 *           distinct tracé v3.7) ; console.log boot v3.6 NON touché
 *           (incohérence préexistante v3.6 ≠ header v3.7, hors
 *           périmètre, pendant à console.log v1.16 supabase-client).
 *           Wrappers v1.27 utilisés : createCompo étendu,
 *           listGroupeEngage, getCompoForEvenementEquipe,
 *           getEvenementEquipeContext, listJoueursCategorieEntente
 *           (tous déjà déployés). Aucune nouvelle RPC ; aucune
 *           mutation modèle ; addition pure prouvée par diff.
 *
 * Version : 3.7 — Phase 4.4 étape 6c-2/6c-3 (18 mai 2026)
 *   v3.7 : Fix « 20 slots titulaires au lieu de 15 » (P2 Partie A).
 *           loadPostes() exclut désormais les lignes
 *           est_regroupement=true (PIL/2L/3L/CTR/AIL = regroupements
 *           tactiques, jamais des positions). La table postes contient
 *           20 lignes (15 réelles + 5 regroupements) ; l'hypothèse
 *           codée v3.1 « la table n'a que les 15 XV » était périmée.
 *           Source-safe, aucun arbitrage : le booléen est_regroupement
 *           est porté par la table (dump vérifié). NB : le compte/liste
 *           pilotés par le format réel de la rencontre (XV/X/7/13) =
 *           Partie B, séparée (dépend de l'exposition de format_de_jeu
 *           par la RPC get_evenements_a_venir — non traitée ici).
 *
 * Version : 3.6 — Phase 4.4 étape 6c-2/6c-3 (18 mai 2026)
 *   v3.6 : Bouton « Retour aux évènements » dans la bannière, affiché
 *           une fois la compo de base au moins validée (validee /
 *           utilisee / archivee). Navigation simple vers evenements.html,
 *           SANS paramètre : un retour ciblé sur la rencontre relèverait
 *           d'une convention d'URL côté Évènements (dette
 *           SUIVI-COACH-deeplink, autre module/conv). Zéro couplage.
 *
 * Version : 3.5 — Phase 4.4 étape 6c-2/6c-3 (18 mai 2026)
 *   v3.5 : Action de validation de la compo dans la bannière.
 *           - Bouton "Valider la compo" (etat brouillon) / "Repasser en
 *             brouillon" (etat validee), adossé aux wrappers DÉJÀ déployés
 *             SupabaseHub.validateCompo / unvalidateCompo (garde-fou
 *             serveur .eq('etat',...), aucune règle dupliquée côté client)
 *           - Cible = compo de base (type_compo==='base'), exactement la
 *             compo que la bannière d'état reflète déjà (renderEventBanner) :
 *             pill et bouton restent toujours cohérents
 *           - Pas de gate de complétude (le "X/15" reste informatif) ;
 *             réversibilité offerte ; AUCUNE mention du Suivi/PI-7 ici
 *             (doctrine interconnexion : zéro couplage module→module)
 *
 * Version : 3.4 — Phase 4.4 étape 6c-2/6c-3 (13 mai 2026)
 *   v3.0 : Vue Liste + Popover Picker
 *   v3.1 : Fix mapping colonnes table postes Supabase :
 *           - poste.uuid → poste.id
 *           - poste.numero_maillot → poste.numero_xv
 *           - retrait du filtre formats_applicables (la table n'a que les 15 XV)
 *   v3.2 : Fix lecture nom/prenom joueur :
 *           - cj.personnes est null car RLS bloque la jointure depuis
 *             composition_joueurs vers personnes
 *           - lookup direct dans State.vivierById qui passe par la RPC
 *             get_vivier_compo (SECURITY DEFINER) → RLS-safe
 *   v3.3 : Fix warning catégorie sur tous les joueurs :
 *           - M14_CATEGORIE_ID était 'cat-m14' (slug imaginaire) au lieu
 *             de l'UUID réel de la catégorie M14 → tous les joueurs étaient
 *             marqués hors-M14
 *           - Remplacement par l'UUID réel 312ebb88-25e8-40c5-8a37-9dd2e3927e2e
 *           - En V1 M14, la RPC get_vivier_compo filtre déjà sur M14
 *             uniquement, donc le warning ne s'affichera jamais — c'est OK,
 *             le code reste prêt pour V2 multi-équipes
 *   v3.4 : Fix recherche popover à l'envers :
 *           - À chaque frappe, renderPopover() était appelé → re-render
 *             complet du popover → input détruit/recréé → curseur replacé
 *             en position 0 → "obi" tapé donnait "ibo" affiché
 *           - Refactor : extraction des items de liste dans 2 helpers
 *             (popoverListItemsSlotVide, popoverListItemsJoueurVivier)
 *           - Nouvelle fonction refreshPopoverList() qui met à jour
 *             uniquement le <ul class="popover__list"> + recâble les clics
 *           - Handler input remplace renderPopover() par refreshPopoverList()
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CONSTANTES + ÉTAT
  // ============================================================

  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';
  const M14_CATEGORIE_ID = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'; // UUID réel catégorie M14
  const NB_TITULAIRES_XV = 15;
  const NB_REMPLACANTS = 8;

  const State = {
    evenements: [],
    selectedEvenementId: null,
    compos: [],
    selectedCompoId: null,
    vivier: [],
    vivierById: new Map(),
    filtreHideSAR: false,
    postes: [],
    postesById: new Map(),
    compoJoueurs: [],
    popover: null,
    // ────────────────────────────────────────────────────────
    // v3.8 — état U-N3 (mode « éditeur étendu pas dupliqué »).
    // Tous les champs sont à valeur neutre (null/false/Set vide)
    // en mode legacy mono-équipe → les chemins legacy testent ce
    // flag en première ligne et tombent dans l'else byte-identique
    // au v3.7. Preuve de rétro-compat stricte par diff.
    // ────────────────────────────────────────────────────────
    evenementEquipeId: null,            // UUID si ?evenement_equipe=… (URL)
    evenementEquipeContext: null,       // résultat getEvenementEquipeContext
    matchsDeLequipe: [],                // v3.12 (6c-6) matchs de l'équipe (onglets)
    includeHorsGroupe: false,           // toggle UN3-3 (repli hors-groupe)
    groupeIds: new Set(),               // cache personne_id du groupe N2
    // ────────────────────────────────────────────────────────
    // v3.9 — Garde anti-concurrence pour onCreateBaseClick.
    // false par défaut, basculé true pendant la création, restauré
    // par try/finally. Empêche un 2ᵉ clic rapide de déclencher un
    // INSERT concurrent (cf. fix recette terrain 20/05). Mode legacy
    // ET U-N3 protégés (le bug guettait aussi en legacy).
    // ────────────────────────────────────────────────────────
    isCreatingBase: false,
    isCreatingMatch: false,
    // ────────────────────────────────────────────────────────
    // v3.15 (Vue Terrain, étape A) — mode d'affichage de l'éditeur :
    // 'liste' (défaut, rendu historique byte-identique) ou 'terrain'
    // (projection LECTURE SEULE de la compo courante sur le terrain).
    // C'est une préférence d'AFFICHAGE, indépendante de la compo
    // sélectionnée : changer d'onglet base↔match conserve viewMode,
    // le terrain se met simplement à jour avec State.compoJoueurs.
    // La compo reste la source de vérité ; le terrain ne fait que
    // refléter (aucune édition en étape A).
    // ────────────────────────────────────────────────────────
    viewMode: 'liste',
    baseJoueurs: []
  };

  // ============================================================
  // 2. SÉLECTEURS DOM
  // ============================================================

  const DOM = {
    eventBannerType:   () => document.getElementById('event-type'),
    eventBannerLabel:  () => document.getElementById('event-label'),
    eventBannerMeta:   () => document.getElementById('event-meta'),
    eventBannerState:  () => document.getElementById('event-state'),
    compoValidateHost: () => document.getElementById('compo-validate-host'),
    compoParcours:     () => document.getElementById('compo-parcours'),
    compoNavFiche:     () => document.getElementById('compo-nav-fiche'),
    compoNavGroupe:    () => document.getElementById('compo-nav-groupe'),
    eventSelectorBtn:  () => document.getElementById('event-selector-btn'),
    eventSelectorList: () => document.getElementById('event-selector-list'),
    compoTabs:         () => document.getElementById('compo-tabs'),
    fillIndicator:     () => document.getElementById('fill-indicator'),
    editorArea:        () => document.getElementById('editor-area'),
    effectifTitle:     () => document.getElementById('effectif-title'),
    effectifFilter:    () => document.getElementById('effectif-filter-sar'),
    effectifBody:      () => document.getElementById('effectif-panel-body'),
    popoverRoot:       () => document.getElementById('popover-root')
  };

  // ============================================================
  // 3. HELPERS
  // ============================================================

  function formatDateLong(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const mois  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  }
  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
    const mois  = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()];
  }
  function libelleTypeEvenement(type) {
    if (type === 'entrainement')         return 'Entraînement';
    if (type === 'match')                return 'Match';
    if (type === 'journee_championnat')  return 'Match';
    if (type === 'tournoi')              return 'Tournoi';
    if (type === 'stage')                return 'Stage';
    return type || 'Événement';
  }
  function libelleEvenement(evt) {
    if (!evt) return '';
    if (evt.adversaire_nom) return 'vs ' + evt.adversaire_nom;
    return evt.libelle || evt.code || '';
  }
  function libelleEtatCompo(etat) {
    if (etat === 'brouillon') return 'Brouillon';
    if (etat === 'validee')   return 'Validée';
    if (etat === 'utilisee')  return 'Utilisée';
    if (etat === 'archivee')  return 'Archivée';
    return '';
  }
  function initiales(prenom, nom) {
    const p = (prenom || '').trim().charAt(0).toUpperCase();
    const n = (nom    || '').trim().charAt(0).toUpperCase();
    return (p + n) || '?';
  }
  function etiquetteJoueur(j) {
    if (j.f15_integree) return { label: 'F-15', kind: 'f15' };
    if (j.est_partenaire_entente) {
      const club = (j.club_principal_nom_court || '').toUpperCase();
      if (club === 'SAR' || club === 'ASCS') return { label: club, kind: 'partenaire' };
      return { label: 'Partenaire', kind: 'partenaire' };
    }
    if (j.statut_attache === 'renfort_temporaire') return { label: 'Renfort', kind: 'renfort' };
    return null;
  }
  function groupeJoueur(j) {
    if (j.est_partenaire_entente)                                  return 'partenaire';
    if (j.statut_attache === 'renfort_temporaire')                 return 'renfort';
    if (!j.statut_attache || j.statut_attache === 'en_transition') return 'autre';
    return 'mom';
  }
  function compareJoueurs(a, b) {
    const cmpN = (a.nom || '').localeCompare(b.nom || '', 'fr');
    if (cmpN !== 0) return cmpN;
    return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
  }
  function getPoste(posteId) { return State.postesById.get(posteId); }
  function getJoueurVivier(joueurId) { return State.vivierById.get(joueurId); }
  function joueursDejaPlaces() {
    const set = new Set();
    for (const cj of State.compoJoueurs) set.add(cj.joueur_id);
    return set;
  }
  function postesVides() {
    const occupes = new Set();
    for (const cj of State.compoJoueurs) if (cj.role === 'titulaire') occupes.add(cj.poste_id);
    return State.postes.filter(p => !occupes.has(p.id));
  }
  function joueurDuPoste(posteId) {
    return State.compoJoueurs.find(cj => cj.role === 'titulaire' && cj.poste_id === posteId);
  }
  function compteurs() {
    const titulaires = State.compoJoueurs.filter(cj => cj.role === 'titulaire').length;
    const remplacants = State.compoJoueurs.filter(cj => cj.role === 'remplacant').length;
    const modifs = State.compoJoueurs.filter(cj => etatDeriveJoueur(cj) !== 'base').length;
    return { titulaires, remplacants, modifs };
  }
  function cssClassEtatJoueur(etat) { return 'etat-' + (etat || 'base'); }

  // v3.21 — état d'affichage DÉRIVÉ d'un joueur de la compo courante.
  // Corrige le bug « rouge figé » : l'état base/modifié n'est plus lu du champ
  // stocké etat_joueur (qui restait 'modifie' même après retour au choix de
  // base), mais CALCULÉ par comparaison à la compo de BASE.
  //  • Les états explicites 'blesse' / 'independant' sont PRÉSERVÉS (posés
  //    volontairement par l'éducateur, ils priment).
  //  • Sur une compo de BASE (ou hors contexte de comparaison), l'état stocké
  //    est rendu tel quel (la base est sa propre référence).
  //  • Sur une compo de MATCH : 'base' si le poste est tenu par le MÊME joueur
  //    AVEC le même rôle qu'en base ; sinon 'modifie'. (Comparaison par poste
  //    + rôle, décisions Manu.)
  function etatDeriveJoueur(cj) {
    if (!cj) return 'base';
    if (cj.etat_joueur === 'blesse' || cj.etat_joueur === 'independant') {
      return cj.etat_joueur;
    }
    const compoCourante = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compoCourante || compoCourante.type_compo !== 'match') {
      return cj.etat_joueur || 'base';
    }
    // Compo de match : comparer à la base (par poste + rôle).
    const enBase = (State.baseJoueurs || []).find(b => b.poste_id === cj.poste_id);
    if (enBase && enBase.joueur_id === cj.joueur_id && enBase.role === cj.role) {
      return 'base';
    }
    return 'modifie';
  }
  // v3.13 (6c-6 fix) — état par défaut d'un joueur qu'on place MAINTENANT,
  // selon le type de la compo courante : dans une compo de MATCH, tout joueur
  // ajouté/remplacé est une modification par rapport à la base → 'modifie'
  // (coloré « Modifié pour ce match », compté dans « N modifications vs base »).
  // Dans la compo de base (ou hors contexte), reste 'base'. Centralise la
  // logique pour les 2 chemins de placement (onPickJoueurPourSlot +
  // onPickPostePourJoueur), qui posaient 'base' en dur (bug : un remplacement
  // dans une compo de match restait marqué BASE, compteur à 0).
  function etatJoueurPourCompoCourante() {
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    return (compo && compo.type_compo === 'match') ? 'modifie' : 'base';
  }
  function libelleEtatJoueurCourt(etat) {
    if (etat === 'base')        return 'Base';
    if (etat === 'modifie')     return 'Modifié';
    if (etat === 'independant') return 'Indép.';
    if (etat === 'blesse')      return 'Blessé';
    return '';
  }
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ============================================================
  // 4. RENDUS — banner, sélecteur, onglets, indicateur
  // ============================================================

  // v3.11 — Barre de parcours : « ← Fiche évènement » (deep-link
  // evenements.html?fiche=<id>) + « ← Groupe de base » (groupe-base.html?
  // evenement_equipe=<id>). Révélée seulement en mode U-N3 (contexte équipe
  // engagée présent), car hors de ce mode l'écran n'a pas d'évènement_equipe
  // ni d'évènement unique de référence.
  function renderParcours() {
    const bar = DOM.compoParcours();
    if (!bar) return;
    const ctx = State.evenementEquipeContext;
    const evId = ctx && ctx.evenement && ctx.evenement.id;
    const evtEqId = State.evenementEquipeId;
    if (!evtEqId || !evId) { bar.style.display = 'none'; return; }
    const navFiche = DOM.compoNavFiche();
    const navGroupe = DOM.compoNavGroupe();
    if (navFiche)  navFiche.setAttribute('href', 'evenements.html?fiche=' + encodeURIComponent(evId));
    if (navGroupe) navGroupe.setAttribute('href', 'groupe-base.html?evenement_equipe=' + encodeURIComponent(evtEqId));
    bar.style.display = 'flex';
  }

  function renderEventBanner() {
    renderParcours();
    const evt = State.evenements.find(e => e.id === State.selectedEvenementId);
    if (!evt) {
      DOM.eventBannerType().textContent  = '—';
      DOM.eventBannerLabel().textContent = 'Aucun événement à venir';
      DOM.eventBannerMeta().textContent  = '';
      DOM.eventBannerState().textContent = '';
      DOM.eventBannerState().className   = 'event-banner__state';
      return;
    }
    DOM.eventBannerType().textContent  = libelleTypeEvenement(evt.type_evenement);
    // v3.8 — en mode U-N3, le libellé court de l'équipe engagée
    // s'ajoute discrètement après la date pour clarifier qu'on édite
    // la feuille d'UNE équipe précise (3 dimensions évènement / équipe
    // / état). En legacy : libellé strictement inchangé (preuve diff).
    let labelText = libelleEvenement(evt) + ' · ' + formatDateLong(evt.date_debut);
    if (State.evenementEquipeId && State.evenementEquipeContext &&
        State.evenementEquipeContext.equipe) {
      const eqLabel = State.evenementEquipeContext.equipe.nom_officiel ||
                      State.evenementEquipeContext.equipe.libelle_court ||
                      State.evenementEquipeContext.equipe.code || '';
      if (eqLabel) labelText += ' — ' + eqLabel;
    }
    DOM.eventBannerLabel().textContent = labelText;
    DOM.eventBannerMeta().textContent  = evt.site_libelle_court || '';

    const compoBase = State.compos.find(c => c.type_compo === 'base');
    const stateEl = DOM.eventBannerState();
    if (compoBase) {
      stateEl.textContent = libelleEtatCompo(compoBase.etat);
      stateEl.className   = 'event-banner__state state-' + compoBase.etat;
    } else {
      stateEl.textContent = 'Aucune compo';
      stateEl.className   = 'event-banner__state';
    }

    renderCompoValidation();
  }

  // Contrôle de validation de la compo (bannière).
  // Cible = compo de base : c'est la compo que le pill d'état ci-dessus
  // reflète déjà (compoBase), pill et bouton restent donc cohérents.
  // Aucune règle métier dupliquée ici : le garde-fou d'état vit côté
  // serveur dans validateCompo/unvalidateCompo (.eq('etat',...)).
  function renderCompoValidation() {
    const host = DOM.compoValidateHost();
    if (!host) return;
    host.innerHTML = '';

    const base = State.compos.find(c => c.type_compo === 'base');
    if (!base) return; // rien à valider tant qu'il n'y a pas de compo de base

    if (base.etat === 'brouillon') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'compo-validate-btn';
      b.textContent = 'Valider la compo';
      b.addEventListener('click', function () { onValidateCompoClick(base.id); });
      host.appendChild(b);
    } else if (base.etat === 'validee') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'compo-validate-btn compo-validate-btn--undo';
      b.textContent = 'Repasser en brouillon';
      b.addEventListener('click', function () { onUnvalidateCompoClick(base.id); });
      host.appendChild(b);
    }
    // 'utilisee' / 'archivee' : pas de bascule d'état (verrou aval, hors périmètre Compos)

    // v3.11 — le bouton « Retour aux évènements » (ancien, navigation sèche
    // vers la liste, conditionné à l'état validé) est RETIRÉ d'ici : remplacé
    // par la barre de parcours en haut de page (#compo-parcours), toujours
    // visible, avec « ← Fiche évènement » (deep-link ?fiche=<id>, dette
    // SUIVI-COACH-deeplink LEVÉE par evenements-browser v1.54) et « ← Groupe
    // de base ». Voir renderParcours().
  }

  function renderEventSelector() {
    const list = DOM.eventSelectorList();
    if (!list) return;
    list.innerHTML = '';
    if (State.evenements.length === 0) {
      list.innerHTML = '<li class="event-selector__empty">Aucun événement à venir dans les 60 prochains jours</li>';
      return;
    }
    for (const evt of State.evenements) {
      const li = document.createElement('li');
      li.className = 'event-selector__item';
      if (evt.id === State.selectedEvenementId) li.classList.add('is-selected');
      li.innerHTML =
        '<span class="event-selector__date">' + formatDateShort(evt.date_debut) + '</span>' +
        '<span class="event-selector__type">' + libelleTypeEvenement(evt.type_evenement) + '</span>' +
        '<span class="event-selector__label">' + escapeHtml(libelleEvenement(evt)) + '</span>';
      li.addEventListener('click', function () { selectEvenement(evt.id); closeEventSelector(); });
      list.appendChild(li);
    }
  }

  function renderCompoTabs() {
    const container = DOM.compoTabs();
    if (!container) return;
    container.innerHTML = '';

    const compoBase = State.compos.find(c => c.type_compo === 'base');
    const baseTab = document.createElement('button');
    baseTab.type = 'button';
    baseTab.className = 'compo-tabs__tab';
    baseTab.textContent = 'Base';
    if (compoBase) {
      if (compoBase.id === State.selectedCompoId) baseTab.classList.add('is-active');
      baseTab.addEventListener('click', function () { selectCompo(compoBase.id); });
    } else {
      baseTab.classList.add('compo-tabs__tab--placeholder');
      baseTab.title = 'Aucune compo de base créée';
      baseTab.disabled = true;
    }
    container.appendChild(baseTab);

    // v3.12 (6c-6) — ONGLETS PAR MATCH. En mode U-N3 (équipe engagée), on
    // affiche TOUS les matchs de l'équipe (State.matchsDeLequipe) en onglets,
    // même sans compo encore (option A actée). Chaque match est apparié à sa
    // compo éventuelle via compo.evenement_id === match.id (option α). Clic :
    //   - match SANS compo → crée la compo (copie de la base) puis l'ouvre ;
    //   - match AVEC compo → ouvre la compo.
    // Regroupés par phase SI plus d'une phase (sinon à la suite). Un bouton
    // « + » final permet une compo de match « libre » (brouillon, hors match).
    const compoMatchs = State.compos.filter(c => c.type_compo === 'match');
    const compoParMatch = {};   // match.id -> compo
    compoMatchs.forEach(function (c) { if (c.evenement_id) compoParMatch[c.evenement_id] = c; });

    if (State.evenementEquipeId && Array.isArray(State.matchsDeLequipe)) {
      const matchs = State.matchsDeLequipe;
      const phases = [];
      matchs.forEach(function (m) {
        const p = m.phase_libelle || '';
        if (phases.indexOf(p) === -1) phases.push(p);
      });
      const plusieursPhases = phases.filter(Boolean).length > 1;

      const appendMatchTab = function (m) {
        const compo = compoParMatch[m.id] || null;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'compo-tabs__tab';
        const libMatch = (m.adversaire_nom && m.adversaire_nom.trim())
          ? ('vs ' + m.adversaire_nom.trim())
          : (m.libelle || 'Match');
        if (compo) {
          if (compo.id === State.selectedCompoId) tab.classList.add('is-active');
          tab.textContent = libMatch;
          tab.title = 'Compo de match : ' + libMatch;
          tab.addEventListener('click', function () { selectCompo(compo.id); });
        } else {
          // Onglet « à faire » : style placeholder, clic = créer (copie base)
          tab.classList.add('compo-tabs__tab--todo');
          tab.textContent = libMatch;
          tab.title = compoBase
            ? 'Créer la compo de ce match (copie de la base)'
            : "Crée d'abord la compo de base";
          tab.disabled = !compoBase;
          tab.addEventListener('click', function () { onCreateMatchCompo(m.id); });
        }
        container.appendChild(tab);
      };

      if (plusieursPhases) {
        phases.forEach(function (p) {
          if (p) {
            const sep = document.createElement('span');
            sep.className = 'compo-tabs__phase';
            sep.textContent = p;
            container.appendChild(sep);
          }
          matchs.filter(function (m) { return (m.phase_libelle || '') === p; })
                .forEach(appendMatchTab);
        });
      } else {
        matchs.forEach(appendMatchTab);
      }
    } else {
      // Mode legacy (pas d'équipe engagée) : onglets compos de match bruts
      compoMatchs.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      for (const m of compoMatchs) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'compo-tabs__tab';
        if (m.id === State.selectedCompoId) tab.classList.add('is-active');
        tab.textContent = libelleEvenement(State.evenements.find(e => e.id === m.evenement_id)) || 'Match';
        tab.addEventListener('click', function () { selectCompo(m.id); });
        container.appendChild(tab);
      }
    }

    const addTab = document.createElement('button');
    addTab.type = 'button';
    addTab.className = 'compo-tabs__tab compo-tabs__tab--add';
    addTab.textContent = '+';
    addTab.title = compoBase ? 'Créer une compo de match libre (brouillon, hors match planifié)' : "Crée d'abord une compo de base";
    addTab.disabled = !compoBase;
    addTab.addEventListener('click', function () { onCreateMatchCompo(null); });
    container.appendChild(addTab);
  }

  function renderFillIndicator() {
    const el = DOM.fillIndicator();
    if (!el) return;
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.className = 'fill-indicator';
      el.innerHTML = '<em style="color: var(--ink-mute);">Aucune composition sélectionnée</em>';
      return;
    }
    const c = compteurs();
    const ratio = c.titulaires / NB_TITULAIRES_XV;
    let colorClass = 'fill-low';
    if (ratio >= 0.9)      colorClass = 'fill-high';
    else if (ratio >= 0.6) colorClass = 'fill-mid';
    el.className = 'fill-indicator ' + colorClass;
    el.innerHTML =
      '<strong>' + c.titulaires + ' / ' + NB_TITULAIRES_XV + ' postes pourvus</strong>' +
      '&nbsp;·&nbsp; ' + c.remplacants + ' / ' + NB_REMPLACANTS + ' remplaçants' +
      (compo.type_compo === 'match' ? '&nbsp;·&nbsp; ' + c.modifs + ' modification' + (c.modifs > 1 ? 's' : '') + ' vs base' : '');
  }

  // ============================================================
  // 5. RENDU — Vue Liste (XV + Remplaçants)
  // ============================================================

  function renderEditorArea() {
    const el = DOM.editorArea();
    if (!el) return;

    if (!State.selectedEvenementId) {
      el.innerHTML = '<div class="editor-area__placeholder">Sélectionnez un événement pour commencer.</div>';
      return;
    }
    if (State.compos.length === 0) {
      el.innerHTML =
        '<div class="editor-area__empty">' +
          '<p class="editor-area__empty-title">Aucune composition créée pour cet événement.</p>' +
          '<p class="editor-area__empty-text">Commence par créer la compo de base (plan A, J-7).</p>' +
          '<button type="button" id="btn-create-base" class="editor-area__cta">Créer la compo de base</button>' +
        '</div>';
      const btn = document.getElementById('btn-create-base');
      if (btn) btn.addEventListener('click', onCreateBaseClick);
      return;
    }
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.innerHTML = '<div class="editor-area__placeholder">Cliquez sur un onglet de composition pour l\'afficher.</div>';
      return;
    }

    // v3.15 (Vue Terrain, étape A) — aiguillage d'affichage. En mode
    // 'terrain', on projette la compo courante sur le terrain (lecture
    // seule) et on sort. Le chemin 'liste' ci-dessous est strictement
    // inchangé (mêmes gardes au-dessus, même bloc view-liste, même
    // bindSlotHandlers) → invariant recetté préservé.
    if (State.viewMode === 'terrain') {
      renderEditorTerrain(el, compo);
      return;
    }

    // L1 (Suivi live éducateur seul, D1-D4) — aiguillage d'affichage.
    // En mode 'suivi', écran de saisie live (compo de match uniquement,
    // D2). Le chemin 'liste' ci-dessous reste strictement inchangé.
    if (State.viewMode === 'suivi') {
      renderEditorSuivi(el, compo);
      return;
    }

    // pt 53 (Rapport de match v1, lecture seule du déduit) — aiguillage.
    // En mode 'rapport', on lit la chronologie du match et on agrège
    // côté front (score / familles / substitutions / temps de jeu).
    // Aucune écriture. Le chemin 'liste' ci-dessous reste inchangé.
    if (State.viewMode === 'rapport') {
      renderEditorRapport(el, compo);
      return;
    }

    let html = '<div class="view-liste">';
    html += '<section class="view-liste__section">';
    html +=   '<h3 class="view-liste__title">XV de départ</h3>';
    html +=   '<ul class="view-liste__slots">';
    for (const poste of State.postes) html += renderSlotPoste(poste);
    html +=   '</ul>';
    html += '</section>';

    const remplacants = State.compoJoueurs.filter(cj => cj.role === 'remplacant')
      .sort((a, b) => (a.ordre_remplacement || a.numero_maillot || 99) - (b.ordre_remplacement || b.numero_maillot || 99));
    html += '<section class="view-liste__section">';
    html +=   '<h3 class="view-liste__title">Remplaçants <span class="view-liste__count">(' + remplacants.length + '/' + NB_REMPLACANTS + ')</span></h3>';
    html +=   '<ul class="view-liste__slots view-liste__slots--remplacants">';
    for (let i = 0; i < NB_REMPLACANTS; i++) {
      html += renderSlotRemplacant(i + 16, remplacants[i]);
    }
    html +=   '</ul>';
    html += '</section>';
    html += '</div>';
    el.innerHTML = html;

    bindSlotHandlers();
  }

  // ════════════════════════════════════════════════════════════
  // L2/3a (Suivi live éducateur seul) — CHRONO de rencontre.
  // D2 : compo de MATCH uniquement. D3 : adversaire résolu via
  // State.matchsDeLequipe (compo.evenement_id === match.id, option α).
  // D4 : ▶ Coup d'envoi fonctionnel. Chrono persistant (C12-n) :
  //   config durées (avant coup d'envoi) + minutes recalculées depuis
  //   les horodatages (survit au rechargement) + pause/reprise/mi-temps/
  //   fin. Mode rebours + score = 3b. Voie coach (actionChronoCoach /
  //   getChronoRencontreCoach). Aucune minute figée (I-esprit).
  // ════════════════════════════════════════════════════════════

  // Objet de contrôle du chrono — état runtime + interval d'affichage.
  // Hors State (transient, lié à l'écran). Cycle de vie : armé à
  // l'entrée de l'onglet Suivi (match en cours), désarmé en sortie /
  // re-rendu — pas de fuite d'interval.
  var SuiviChrono = {
    intervalId: null,
    evtId: null,         // UUID du MATCH piloté
    etat: null,          // dernier état lu (objet RPC) ou null
    score: { mom: 0, adv: 0 },  // L2/3b — score calculé (jamais stocké, I1)
    lignes: [],                 // #3 — dernière chronologie lue (calcul état terrain)
    nomNous: 'Nous',            // amélioration 2 — vrais noms d'équipes
    nomAdv: 'Adversaire',
    busy: false,         // garde anti-double-clic pendant une action

    desarmer: function () {
      if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    },

    // Minutes/secondes écoulées de la période courante, en tenant
    // compte des pauses. Recalcul pur depuis les horodatages.
    secondesEcoulees: function () {
      var e = this.etat;
      if (!e || !e.debut_periode_at) return 0;
      var debut = new Date(e.debut_periode_at).getTime();
      var maintenant = Date.now();
      var pauseEnCours = 0;
      if (e.en_pause && e.pause_depuis_at) {
        pauseEnCours = Math.floor((maintenant - new Date(e.pause_depuis_at).getTime()) / 1000);
      }
      var brut = Math.floor((maintenant - debut) / 1000);
      var net = brut - (e.pause_cumul_secondes || 0) - pauseEnCours;
      return net > 0 ? net : 0;
    },

    // L2/3b — durée (secondes) de la période courante, depuis la config.
    dureePeriodeSecondes: function () {
      var e = this.etat;
      if (!e || !Array.isArray(e.durees_periodes)) return 0;
      var idx = (e.periode_courante || 1) - 1;
      var min = e.durees_periodes[idx];
      return (min > 0 ? min : 0) * 60;
    },

    // L2/3b — temps à AFFICHER selon le mode : écoulé, ou rebours
    // (durée période − écoulé, borné à 0). Le mode vient de l'état persistant.
    secondesAffichees: function () {
      var ecoule = this.secondesEcoulees();
      var e = this.etat;
      if (e && e.mode_affichage === 'rebours') {
        var d = this.dureePeriodeSecondes();
        var reste = d - ecoule;
        return reste > 0 ? reste : 0;
      }
      return ecoule;
    },

    estRebours: function () {
      return !!(this.etat && this.etat.mode_affichage === 'rebours');
    }
  };

  function _fmtMMSS(totalSec) {
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Amélioration 1 — texte du chrono avec TEMPS ADDITIONNEL. Au-delà de
  // la durée réglementaire de la période, le chrono ne s'arrête pas :
  //   mode écoulé  : « 30:00 +2:15 » (durée figée + dépassement)
  //   mode rebours : « 00:00 +2:15 » (rebours à 0 + dépassement)
  // Renvoie { principal, additionnel } (additionnel = '' si pas de dépassement).
  function _tempsAffiche() {
    var ecoule = SuiviChrono.secondesEcoulees();
    var d = SuiviChrono.dureePeriodeSecondes();
    var rebours = SuiviChrono.estRebours();
    var depassement = (d > 0 && ecoule > d) ? (ecoule - d) : 0;
    var principal;
    if (rebours) {
      var reste = d - ecoule;
      principal = _fmtMMSS(reste > 0 ? reste : 0);
    } else {
      principal = _fmtMMSS(depassement > 0 ? d : ecoule);
    }
    return {
      principal: principal,
      additionnel: depassement > 0 ? ('+' + _fmtMMSS(depassement).replace(/^0/, '')) : ''
    };
  }

  // L2/3b — score calculé (somme valeur_points par camp, hors annulées).
  // Réplique calculerScore de suivi-app.js (I1 : jamais stocké en live).
  function _calculerScore(lignes) {
    var mom = 0, adv = 0;
    if (lignes && lignes.length) {
      for (var i = 0; i < lignes.length; i++) {
        var l = lignes[i];
        if (!l || l.annule === true) continue;
        var pts = (typeof l.valeur_points === 'number') ? l.valeur_points : 0;
        if (!pts) continue;
        if (l.equipe_concernee === 'adverse') adv += pts;
        else mom += pts;
      }
    }
    return { mom: mom, adv: adv };
  }

  // L3a — Référentiel observables Cat A, FETCHÉ une fois depuis
  // data/observables-match.json (cible : éditable en admin plus tard,
  // chantier OBSERVABLES-ADMIN). Mémo runtime ; dégradation honnête si
  // le fetch échoue (palette indisponible, le chrono reste utilisable).
  var SuiviObs = {
    catA: null,        // { score:[], discipline:[], mouvement:[], jeu_collectif:[] } ou null
    catB: null,        // { tranche: [{libelle}, …], … } ou null (L5)
    charge: false,
    enCours: false,
    charger: function (cb) {
      if (this.charge) { if (cb) cb(this.catA); return; }
      if (this.enCours) { return; }
      this.enCours = true;
      var self = this;
      fetch('data/observables-match.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          self.catA = (d && d.categorie_A) ? d.categorie_A : null;
          self.catB = (d && d.categorie_B_pre_suggestions) ? d.categorie_B_pre_suggestions : null;
          self.charge = true; self.enCours = false;
          if (cb) cb(self.catA);
        })
        .catch(function () {
          self.charge = true; self.enCours = false; self.catA = null; self.catB = null;
          if (cb) cb(null);
        });
    },
    // L4/L5 — libellé d'un observable par son uuid (catA) ou slug (catB).
    libelle: function (observableId) {
      if (!observableId) return null;
      if (this.catA) {
        var familles = ['score', 'discipline', 'mouvement', 'jeu_collectif'];
        for (var f = 0; f < familles.length; f++) {
          var arr = this.catA[familles[f]];
          if (Array.isArray(arr)) {
            for (var i = 0; i < arr.length; i++) {
              if (arr[i] && arr[i].uuid === observableId) {
                return { libelle: arr[i].libelle_court, icone: arr[i].icone || '' };
              }
            }
          }
        }
      }
      if (observableId.indexOf('obs-B-') === 0 && this.catB) {
        for (var cle in this.catB) {
          var liste = this.catB[cle];
          if (Array.isArray(liste)) {
            for (var j = 0; j < liste.length; j++) {
              if (liste[j] && _slugObsB(liste[j].libelle) === observableId) {
                return { libelle: liste[j].libelle, icone: '📝' };
              }
            }
          }
        }
        return { libelle: 'Observation', icone: '📝' };
      }
      return null;
    },
    // L5 — observables Cat B pour une équipe (tranche déduite du nom ;
    // repli M-14_F-15). Édition admin = chantier OBSERVABLES-ADMIN.
    observablesB: function (nomEquipe) {
      if (!this.catB) return [];
      var n = (nomEquipe || '').toUpperCase();
      var cle = null;
      if (/M-?16|M-?19/.test(n)) cle = 'M-16_M-19';
      else if (/F-?18/.test(n)) cle = 'F-18';
      else if (/M-?14|F-?15/.test(n)) cle = 'M-14_F-15';
      else if (/M-?6|M-?8|M-?10|M-?12|EDR/.test(n)) cle = 'EDR_M-6_M-8_M-10_M-12';
      else if (/\+ ?18|SENIOR|SEN/.test(n)) cle = 'M+18_F+18';
      if (!cle || !this.catB[cle]) cle = 'M-14_F-15';
      return Array.isArray(this.catB[cle]) ? this.catB[cle] : [];
    }
  };

  // L5 — slug stable d'un observable Cat B depuis son libellé.
  function _slugObsB(libelle) {
    var s = (libelle || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return 'obs-B-' + (s || 'obs');
  }

  // Résout l'adversaire du match porté par la compo (point parké L1) :
  // l'objet COMPO ne porte pas adversaire_nom — c'est l'objet MATCH
  // (State.matchsDeLequipe) qui le porte, apparié par evenement_id.
  function _adversaireDeCompo(compo) {
    var m = (Array.isArray(State.matchsDeLequipe))
      ? State.matchsDeLequipe.find(function (x) { return x.id === compo.evenement_id; })
      : null;
    if (m && m.adversaire_nom && m.adversaire_nom.trim()) return 'vs ' + m.adversaire_nom.trim();
    if (compo.adversaire_nom && compo.adversaire_nom.trim()) return 'vs ' + compo.adversaire_nom.trim();
    return compo.libelle || 'Match à suivre';
  }

  // Amélioration 2 — noms COURTS des deux équipes pour le score
  // (« MOM/ADV » remplacés par les vrais noms ; MOM est faux pour une
  // entente SAR/ASCS). Notre équipe = contexte de la compo ; adversaire
  // = objet match (State.matchsDeLequipe).
  function _nomNotreEquipe() {
    var c = State.evenementEquipeContext;
    if (c && c.equipe) {
      return (c.equipe.nom_officiel || c.equipe.libelle_court || c.equipe.code || 'Nous');
    }
    return 'Nous';
  }
  function _nomAdversaireCourt(compo) {
    var m = (compo && Array.isArray(State.matchsDeLequipe))
      ? State.matchsDeLequipe.find(function (x) { return x.id === compo.evenement_id; })
      : null;
    if (m && m.adversaire_nom && m.adversaire_nom.trim()) return m.adversaire_nom.trim();
    if (compo && compo.adversaire_nom && compo.adversaire_nom.trim()) return compo.adversaire_nom.trim();
    return 'Adversaire';
  }

  // Habillage du cadre suivi (rappel charte réseaux sociaux) : 'mom' ou
  // 'entente'. Confort d'affichage runtime, défaut 'mom'. Ne touche QUE
  // le bandeau + liseré ; l'intérieur sombre est inchangé.
  var SuiviHabillage = { choix: 'mom' };

  // Helper factorisé (v3.44) : bandeau « charte réseaux » réutilisé par
  // les vues Suivi et Terrain. logo + nom équipe + sous-titre + toggle.
  function _habillageCourant() {
    return (SuiviHabillage.choix === 'entente') ? 'entente' : 'mom';
  }
  function _logoHabillage(hab) {
    return (hab === 'entente') ? 'assets/logo-entente.png' : 'assets/ecusson-mom.png';
  }
  function _bandeauHTML(nomEq, sousTitre) {
    var hab = _habillageCourant();
    return '<div class="view-suivi__bandeau">' +
        '<div class="view-suivi__brand">' +
          '<img class="view-suivi__logo" src="' + _logoHabillage(hab) + '" alt="" aria-hidden="true">' +
          '<div class="view-suivi__brand-txt">' +
            '<div class="view-suivi__brand-eq">' + escapeHtml(nomEq || '') + '</div>' +
            '<div class="view-suivi__brand-sub">' + escapeHtml(sousTitre || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="view-suivi__habillage" role="group" aria-label="Habillage">' +
          '<button type="button" class="view-suivi__hbtn" data-hab="mom"' + (hab === 'mom' ? ' aria-pressed="true"' : '') + '>MOM</button>' +
          '<button type="button" class="view-suivi__hbtn" data-hab="entente"' + (hab === 'entente' ? ' aria-pressed="true"' : '') + '>Entente</button>' +
        '</div>' +
      '</div>';
  }
  // Câble le toggle d'habillage ; au changement, exécute rerender().
  function _bindHabillageToggle(racine, rerender) {
    if (!racine) return;
    racine.querySelectorAll('.view-suivi__hbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var h = b.getAttribute('data-hab');
        if (h && h !== SuiviHabillage.choix) {
          SuiviHabillage.choix = h;
          if (typeof rerender === 'function') rerender();
        }
      });
    });
  }

  function renderEditorSuivi(el, compo) {
    SuiviChrono.desarmer();

    // D2 — la base ne porte pas d'adversaire : on ne suit pas un match.
    if (!compo || compo.type_compo !== 'match') {
      SuiviChrono.evtId = null; SuiviChrono.etat = null;
      el.innerHTML =
        '<div class="view-suivi">' +
          '<div class="view-suivi__inert">' +
            'Le suivi en direct s\'ouvre sur une <strong>feuille de match</strong>.<br>' +
            'Sélectionne un onglet de match ci-dessus (ou crée-le) pour suivre la rencontre.' +
          '</div>' +
        '</div>';
      return;
    }

    var evtId = compo.evenement_id || null;
    SuiviChrono.evtId = evtId;
    SuiviChrono.nomNous = _nomNotreEquipe();
    SuiviChrono.nomAdv = _nomAdversaireCourt(compo);
    var adversaire = _adversaireDeCompo(compo);
    var habillage = _habillageCourant();

    // Rendu initial (chargement), puis lecture asynchrone de l'état.
    // Bandeau + liseré = rappel de la charte « réseaux sociaux »
    // (versions mom / entente, cf. compo-export.js). N'habille QUE le
    // pourtour ; l'intérieur (thème sombre) est inchangé.
    el.innerHTML =
      '<div class="view-suivi view-suivi--' + habillage + '">' +
        _bandeauHTML(SuiviChrono.nomNous, 'Suivi du match — ' + adversaire) +
        '<div id="suivi-score" class="suivi-score">' + _scoreHTML() + '</div>' +
        '<div id="suivi-chrono-host" class="suivi-chrono"><div class="view-suivi__hint">Chargement du chrono…</div></div>' +
        '<div id="suivi-palette"></div>' +
        '<div id="suivi-historique" class="suivi-historique"></div>' +
      '</div>';

    // Toggle d'habillage MOM / entente — ne change QUE le cadre. Re-rend
    // la vue suivi pour réappliquer l'habillage.
    _bindHabillageToggle(el.querySelector('.view-suivi'), function () {
      renderEditorSuivi(el, compo);
    });

    if (!evtId) {
      var host0 = document.getElementById('suivi-chrono-host');
      if (host0) host0.innerHTML = '<div class="view-suivi__hint">Match non résolu (evenement_id absent).</div>';
      return;
    }

    _rafraichirChrono(evtId, true);
  }

  // ════════════════════════════════════════════════════════════
  // pt 53 — RAPPORT DE MATCH v1 (socle, LECTURE SEULE DU DÉDUIT).
  // Onglet « Rapport » à côté de Suivi. Affiche, pour une feuille de
  // match, le DÉDUIT calculé depuis la chronologie : score (SUM par
  // camp), récap par famille (score/discipline/jeu collectif),
  // substitutions (nominatif), et un panneau temps de jeu REPLIÉ avec
  // libellé d'incertitude permanent (minute_match peu fiable, base de
  // temps = horodatage ; dégradation honnête SUIVI-COACH-7).
  // AUCUNE écriture : pas de stockage du saisi (reporté 2e temps).
  // Agrégation 100 % front (mapping observable_id→famille via SuiviObs,
  // référentiel JSON = seule source ; cf. gouvernance SQL↔JSON).
  // ════════════════════════════════════════════════════════════

  // Famille d'un observable (score|discipline|mouvement|jeu_collectif)
  // dérivée du référentiel chargé. null si inconnu ou non chargé.
  function _familleDeObs(observableId) {
    if (!observableId || !SuiviObs.catA) return null;
    var familles = ['score', 'discipline', 'mouvement', 'jeu_collectif'];
    for (var f = 0; f < familles.length; f++) {
      var arr = SuiviObs.catA[familles[f]];
      if (Array.isArray(arr)) {
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] && arr[i].uuid === observableId) return familles[f];
        }
      }
    }
    return null;
  }

  function renderEditorRapport(el, compo) {
    SuiviChrono.desarmer();

    // Comme le Suivi (D2) : le rapport de match s'ouvre sur une feuille
    // de match (la base ne porte pas d'adversaire ni de chronologie).
    if (!compo || compo.type_compo !== 'match') {
      el.innerHTML =
        '<div class="view-rapport">' +
          '<div class="view-rapport__inert">' +
            'Le rapport de match s\'affiche sur une <strong>feuille de match</strong>.<br>' +
            'Sélectionne un onglet de match ci-dessus pour voir son rapport.' +
          '</div>' +
        '</div>';
      return;
    }

    var evtId = compo.evenement_id || null;
    var nomNous = _nomNotreEquipe();
    var nomAdv = _nomAdversaireCourt(compo);
    var adversaire = _adversaireDeCompo(compo);
    var habillage = _habillageCourant();

    el.innerHTML =
      '<div class="view-rapport view-rapport--' + habillage + '">' +
        _bandeauHTML(nomNous, 'Rapport de match — ' + adversaire) +
        '<div class="rapport__statut">Statut : <strong>provisoire</strong> · lecture seule (déduit du suivi)</div>' +
        '<div id="rapport-corps" class="rapport__corps">' +
          '<div class="view-suivi__hint">Chargement du rapport…</div>' +
        '</div>' +
      '</div>';

    _bindHabillageToggle(el.querySelector('.view-rapport'), function () {
      renderEditorRapport(el, compo);
    });

    if (!evtId) {
      var corps0 = document.getElementById('rapport-corps');
      if (corps0) corps0.innerHTML = '<div class="view-suivi__hint">Match non résolu (evenement_id absent).</div>';
      return;
    }

    if (!window.SupabaseHub || !SupabaseHub.getChronologieRencontreCoach) {
      var corps1 = document.getElementById('rapport-corps');
      if (corps1) corps1.innerHTML = '<div class="view-suivi__hint">Lecture du suivi indisponible.</div>';
      return;
    }

    // Charge le référentiel (familles/libellés) ET la chronologie, puis
    // peint. Le référentiel est mémo (SuiviObs.charger idempotent).
    SuiviObs.charger(function () {
      SupabaseHub.getChronologieRencontreCoach(evtId, true).then(function (lignes) {
        // Anti-périmé : si on a quitté l'onglet entre-temps, ne rien peindre.
        if (State.viewMode !== 'rapport' || State.selectedCompoId !== compo.id) return;
        var arr = Array.isArray(lignes) ? lignes : [];
        _peindreRapport(arr, nomNous, nomAdv);
      }).catch(function () {
        var c = document.getElementById('rapport-corps');
        if (c) c.innerHTML = '<div class="view-suivi__hint">Lecture du suivi impossible.</div>';
      });
    });
  }

  // Agrège la chronologie et peint le corps du rapport. Lecture pure.
  function _peindreRapport(lignes, nomNous, nomAdv) {
    var corps = document.getElementById('rapport-corps');
    if (!corps) return;

    // Lignes effectives (annulées exclues du déduit).
    var eff = [];
    for (var i = 0; i < lignes.length; i++) {
      if (lignes[i] && lignes[i].annule !== true) eff.push(lignes[i]);
    }

    if (eff.length === 0) {
      corps.innerHTML =
        '<div class="rapport__vide">Aucune action enregistrée pour ce match.<br>' +
        'Le rapport se remplira à partir du suivi (onglet « Suivi »).</div>';
      return;
    }

    // 1) Score (réutilise la logique SUM par camp, hors annulées).
    var score = _calculerScore(lignes);

    // 2) Décompte par observable et par camp.
    //    compte[observable_id] = { nous, adv }
    var compte = {};
    var subs = [];        // substitutions effectives (sortant→entrant)
    for (var j = 0; j < eff.length; j++) {
      var l = eff[j];
      var oid = l.observable_id;
      if (!oid) continue;
      if (oid === 'obs-A-substitution') {
        subs.push(l);
        continue;
      }
      if (!compte[oid]) compte[oid] = { nous: 0, adv: 0 };
      if (l.equipe_concernee === 'adverse') compte[oid].adv += 1;
      else compte[oid].nous += 1;
    }

    // 3) Regroupe par famille pour l'affichage.
    var ordreFam = ['score', 'discipline', 'jeu_collectif'];
    var titreFam = { score: 'Score', discipline: 'Discipline', jeu_collectif: 'Jeu collectif' };
    var parFamille = { score: [], discipline: [], jeu_collectif: [], autre: [] };
    for (var oid2 in compte) {
      if (!compte.hasOwnProperty(oid2)) continue;
      var fam = _familleDeObs(oid2);
      var info = (typeof SuiviObs.libelle === 'function') ? SuiviObs.libelle(oid2) : null;
      var ligne = {
        libelle: (info && info.libelle) ? info.libelle : oid2,
        icone: (info && info.icone) ? info.icone : '',
        nous: compte[oid2].nous,
        adv: compte[oid2].adv
      };
      if (fam === 'score') parFamille.score.push(ligne);
      else if (fam === 'discipline') parFamille.discipline.push(ligne);
      else if (fam === 'jeu_collectif') parFamille.jeu_collectif.push(ligne);
      else if (fam === 'mouvement') { /* substitution déjà sortie ; blessure → mouvement */ parFamille.discipline.push(ligne); }
      else parFamille.autre.push(ligne);
    }

    var html = '';

    // SCORE en grand (le déduit phare).
    html += '<div class="rapport-score">' +
              '<div class="rapport-score__side">' +
                '<div class="rapport-score__eq">' + escapeHtml(nomNous || 'Nous') + '</div>' +
                '<div class="rapport-score__pts">' + score.mom + '</div>' +
              '</div>' +
              '<div class="rapport-score__sep">—</div>' +
              '<div class="rapport-score__side">' +
                '<div class="rapport-score__eq">' + escapeHtml(nomAdv || 'Adversaire') + '</div>' +
                '<div class="rapport-score__pts">' + score.adv + '</div>' +
              '</div>' +
            '</div>';

    // RÉCAP PAR FAMILLE (tableau Nous / Adverse).
    for (var f = 0; f < ordreFam.length; f++) {
      var key = ordreFam[f];
      var liste = parFamille[key];
      if (!liste || liste.length === 0) continue;
      html += '<section class="rapport-bloc">' +
                '<h4 class="rapport-bloc__titre">' + titreFam[key] + '</h4>' +
                '<table class="rapport-tab">' +
                  '<thead><tr><th>Action</th><th>' + escapeHtml(nomNous || 'Nous') + '</th><th>' + escapeHtml(nomAdv || 'Adv.') + '</th></tr></thead>' +
                  '<tbody>';
      for (var k = 0; k < liste.length; k++) {
        var r = liste[k];
        html += '<tr>' +
                  '<td>' + (r.icone ? (escapeHtml(r.icone) + ' ') : '') + escapeHtml(r.libelle) + '</td>' +
                  '<td class="rapport-tab__n">' + r.nous + '</td>' +
                  '<td class="rapport-tab__n">' + r.adv + '</td>' +
                '</tr>';
      }
      html += '</tbody></table></section>';
    }

    // SUBSTITUTIONS (nominatif sortant → entrant, côté nous).
    if (subs.length > 0) {
      html += '<section class="rapport-bloc">' +
                '<h4 class="rapport-bloc__titre">🔄 Substitutions <span class="rapport-bloc__n">(' + subs.length + ')</span></h4>' +
                '<ul id="rapport-subs" class="rapport-subs">' +
                  '<li class="view-suivi__hint">Résolution des noms…</li>' +
                '</ul>' +
              '</section>';
    }

    // FIL CHRONOLOGIQUE (le « comment » du match) — toutes les actions
    // effectives, groupées par période, ordonnées par horodatage. Noms
    // résolus en asynchrone (comme les substitutions). Le récap par
    // famille ci-dessus donne le « combien » ; ce fil donne le déroulé.
    html += '<section class="rapport-bloc">' +
              '<h4 class="rapport-bloc__titre">📋 Déroulé du match <span class="rapport-bloc__n">(' + eff.length + ')</span></h4>' +
              '<div id="rapport-fil" class="rapport-fil">' +
                '<p class="view-suivi__hint">Résolution des noms…</p>' +
              '</div>' +
            '</section>';

    // TEMPS DE JEU — panneau replié, incertitude assumée (SUIVI-COACH-7).
    html += '<details class="rapport-tdj">' +
              '<summary class="rapport-tdj__sum">⏱ Temps de jeu (estimation indicative)</summary>' +
              '<div class="rapport-tdj__corps">' +
                '<p class="rapport-tdj__avert">Estimation <strong>indicative</strong> : le suivi n\'enregistre pas de minutage fiable ' +
                'pour ce match. Les durées ci-dessous sont calculées à partir de l\'ordre des actions, ' +
                'pas d\'un chronomètre — à lire comme un ordre de grandeur, jamais comme un temps officiel.</p>' +
                '<div id="rapport-tdj-detail">' +
                  '<p class="view-suivi__hint">' + subs.length + ' substitution(s) enregistrée(s). ' +
                  'Le détail par joueur sera affiné avec un minutage fiable.</p>' +
                '</div>' +
              '</div>' +
            '</details>';

    corps.innerHTML = html;

    // Résolution asynchrone des noms pour les substitutions (RPC en lot
    // get_noms_personnes). Dégradation honnête : repli #id si non résolu.
    if (subs.length > 0) _peindreSubsRapport(subs);

    // Fil chronologique (noms résolus en asynchrone, même voie).
    _peindreFilRapport(eff);
  }

  // Résout les noms (sortant/entrant) des substitutions via la RPC en
  // lot get_noms_personnes (SupabaseHub._resolveNoms → Map uuid→{nom,
  // prenom}), puis peint la liste. Lecture pure, jamais d'écriture.
  // NB : la voie compo-réduite-coach n'existe PAS en base (seule la voie
  // jeton get_compo_reduite_rencontre est déployée) ; _resolveNoms est
  // la voie RGPD-safe dédiée (gardée has_role admin|coach, déployée),
  // et elle couvre titulaires ET remplaçants (résout par UUID, pas par
  // appartenance à une compo).
  function _peindreSubsRapport(subs) {
    var ul = document.getElementById('rapport-subs');
    if (!ul) return;

    function peindre(resolveNom) {
      var h = '';
      for (var i = 0; i < subs.length; i++) {
        var s = subs[i];
        var sortant = resolveNom(s.joueur_uuid);
        var entrant = resolveNom(s.joueur_uuid_entrant);
        var min = (typeof s.minute_match === 'number') ? (' · ' + s.minute_match + '\'') : '';
        h += '<li class="rapport-sub">' +
               '<span class="rapport-sub__out">' + escapeHtml(sortant) + '</span>' +
               '<span class="rapport-sub__arr">→</span>' +
               '<span class="rapport-sub__in">' + escapeHtml(entrant) + '</span>' +
               '<span class="rapport-sub__min">' + escapeHtml(min) + '</span>' +
             '</li>';
      }
      ul.innerHTML = h || '<li class="view-suivi__hint">Aucune substitution.</li>';
    }

    // Compose « Prénom NOM » depuis l'entrée Map de _resolveNoms ; repli
    // sur le fragment d'UUID si la personne n'est pas résolue (honnêteté).
    function nomDepuisMap(map, uuid) {
      if (!uuid) return '—';
      var e = map && map.get ? map.get(uuid) : null;
      if (e) {
        var p = (e.prenom || '').trim();
        var n = (e.nom || '').trim();
        var label = (p + ' ' + n).trim();
        if (label) return label;
      }
      return _idCourt(uuid);
    }

    // Lot d'UUID uniques (sortants + entrants).
    var uuids = [];
    for (var i = 0; i < subs.length; i++) {
      if (subs[i].joueur_uuid) uuids.push(subs[i].joueur_uuid);
      if (subs[i].joueur_uuid_entrant) uuids.push(subs[i].joueur_uuid_entrant);
    }

    if (window.SupabaseHub && typeof SupabaseHub._resolveNoms === 'function') {
      SupabaseHub._resolveNoms(uuids).then(function (map) {
        peindre(function (uuid) { return nomDepuisMap(map, uuid); });
      }).catch(function () {
        peindre(function (uuid) { return _idCourt(uuid); });
      });
    } else {
      peindre(function (uuid) { return _idCourt(uuid); });
    }
  }

  // Repli ultime quand le nom n'est pas résolvable : fragment d'UUID
  // (jamais un faux nom). Honnêteté : on montre qu'on ne sait pas.
  function _idCourt(uuid) {
    if (!uuid) return '—';
    return '#' + String(uuid).slice(0, 4);
  }

  // Fil chronologique du match : toutes les actions effectives, groupées
  // par période, ordonnées par horodatage. Pour chaque ligne : minute (si
  // cohérente), action (libellé + icône via SuiviObs.libelle), camp/joueur,
  // points (si > 0). Noms résolus via _resolveNoms (repli #id). Lecture
  // pure. La minute n'est affichée QUE si elle est strictement croissante
  // dans la période (sinon minute_match peu fiable → omise, jamais un
  // faux « 0' » ; même honnêteté que le panneau temps de jeu).
  function _peindreFilRapport(eff) {
    var box = document.getElementById('rapport-fil');
    if (!box) return;

    // Ordre de jeu = horodatage (base de temps fiable). Tri stable.
    var arr = eff.slice().sort(function (a, b) {
      var ta = a.horodatage || ''; var tb = b.horodatage || '';
      return ta < tb ? -1 : (ta > tb ? 1 : 0);
    });

    // Substitution : on a besoin du nom de l'entrant aussi.
    var uuids = [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].joueur_uuid) uuids.push(arr[i].joueur_uuid);
      if (arr[i].joueur_uuid_entrant) uuids.push(arr[i].joueur_uuid_entrant);
    }

    function nomDe(map, uuid) {
      if (!uuid) return '';
      var e = map && map.get ? map.get(uuid) : null;
      if (e) {
        var lbl = ((e.prenom || '').trim() + ' ' + (e.nom || '').trim()).trim();
        if (lbl) return lbl;
      }
      return _idCourt(uuid);
    }

    function peindre(map) {
      var html = '';
      var periodeCourante = null;
      for (var i = 0; i < arr.length; i++) {
        var l = arr[i];
        var per = (typeof l.periode === 'number') ? l.periode : 1;

        // Intertitre de période au changement.
        if (per !== periodeCourante) {
          periodeCourante = per;
          html += '<div class="rapport-fil__periode">' + escapeHtml(_libellePeriode(per)) + '</div>';
        }

        var info = (typeof SuiviObs.libelle === 'function') ? SuiviObs.libelle(l.observable_id) : null;
        var icone = (info && info.icone) ? info.icone : '';
        var libelle = (info && info.libelle) ? info.libelle : (l.observable_id || 'Action');

        // Minute : affichée seulement si > 0 (0 = chrono non lancé sur nos
        // données réelles → omise plutôt que trompeuse).
        var min = (typeof l.minute_match === 'number' && l.minute_match > 0)
          ? (l.minute_match + '\'') : '';

        // Acteur : substitution = sortant → entrant ; sinon joueur ou camp.
        var acteur;
        if (l.observable_id === 'obs-A-substitution') {
          acteur = nomDe(map, l.joueur_uuid) + ' → ' + nomDe(map, l.joueur_uuid_entrant);
        } else if (l.equipe_concernee === 'adverse') {
          acteur = escapeHtml(SuiviChrono.nomAdv || 'Adversaire');
        } else if (l.joueur_uuid) {
          acteur = nomDe(map, l.joueur_uuid);
        } else {
          acteur = ''; // fait d'équipe sans joueur nommé (ex. mêlée gagnée)
        }

        var pts = (typeof l.valeur_points === 'number' && l.valeur_points > 0)
          ? ('+' + l.valeur_points) : '';

        html += '<div class="rapport-fil__ligne">' +
                  '<span class="rapport-fil__min">' + escapeHtml(min) + '</span>' +
                  '<span class="rapport-fil__act">' + (icone ? (escapeHtml(icone) + ' ') : '') + escapeHtml(libelle) + '</span>' +
                  '<span class="rapport-fil__who">' + escapeHtml(acteur) + '</span>' +
                  '<span class="rapport-fil__pts">' + escapeHtml(pts) + '</span>' +
                '</div>';
      }
      box.innerHTML = html || '<p class="view-suivi__hint">Aucune action.</p>';
    }

    if (window.SupabaseHub && typeof SupabaseHub._resolveNoms === 'function') {
      SupabaseHub._resolveNoms(uuids).then(function (map) { peindre(map); })
        .catch(function () { peindre(new Map()); });
    } else {
      peindre(new Map());
    }
  }

  // Libellé de période (vocabulaire rugby ; au-delà de 2 = « Période N »).
  function _libellePeriode(p) {
    if (p === 1) return '1re période';
    if (p === 2) return '2e période';
    return 'Période ' + p;
  }

  // Lit l'état en base puis (re)peint l'écran. Si armerInterval, lance
  // le tick d'affichage chaque seconde (uniquement si chrono actif).
  function _rafraichirChrono(evtId, armerInterval) {
    if (!window.SupabaseHub || !SupabaseHub.getChronoRencontreCoach) return;
    // L4 — charge score + historique (chronologie de jeu), en parallèle.
    _rafraichirScoreEtHistorique(evtId);
    SupabaseHub.getChronoRencontreCoach(evtId).then(function (etat) {
      if (SuiviChrono.evtId !== evtId) return; // on a changé d'onglet entre-temps
      SuiviChrono.etat = etat; // peut être null (chrono pas encore initialisé)
      _peindreChrono();
      SuiviChrono.desarmer();
      var actif = SuiviChrono.etat && SuiviChrono.etat.coup_envoi_at && !SuiviChrono.etat.termine_at;
      if (armerInterval && actif) {
        SuiviChrono.intervalId = setInterval(_peindreChronoTick, 1000);
      }
    });
  }

  // Bloc score (calculé, jamais stocké — I1). Adversaire abrégé « ADV ».
  function _scoreHTML() {
    var nous = escapeHtml(SuiviChrono.nomNous || 'Nous');
    var adv = escapeHtml(SuiviChrono.nomAdv || 'Adversaire');
    return '<div class="suivi-score__side">' +
             '<div class="suivi-score__eq">' + nous + '</div>' +
             '<div class="suivi-score__pts">' + SuiviChrono.score.mom + '</div>' +
           '</div>' +
           '<div class="suivi-score__sep">—</div>' +
           '<div class="suivi-score__side">' +
             '<div class="suivi-score__eq">' + adv + '</div>' +
             '<div class="suivi-score__pts">' + SuiviChrono.score.adv + '</div>' +
           '</div>';
  }

  // L4 — recharge la chronologie (annulées incluses) puis met à jour
  // le score ET l'historique. Source unique de rafraîchissement.
  function _rafraichirScoreEtHistorique(evtId) {
    if (!window.SupabaseHub || !SupabaseHub.getChronologieRencontreCoach) return;
    SupabaseHub.getChronologieRencontreCoach(evtId, true).then(function (lignes) {
      if (SuiviChrono.evtId !== evtId) return;
      var arr = Array.isArray(lignes) ? lignes : [];
      SuiviChrono.lignes = arr; // #3 — mémo pour le calcul d'état terrain (substitutions)
      SuiviChrono.score = _calculerScore(arr);
      var sc = document.getElementById('suivi-score');
      if (sc) sc.innerHTML = _scoreHTML();
      _peindreHistorique(evtId, arr);
    });
  }

  // L4 — historique annulable. Lignes anti-chronologiques (récent en
  // haut) ; annulées barrées sans bouton ; actives avec « annuler ».
  function _peindreHistorique(evtId, lignes) {
    var box = document.getElementById('suivi-historique');
    if (!box) return;
    // Le référentiel (libellés Cat A/B) doit être chargé pour afficher les
    // libellés et non les identifiants bruts. S'il ne l'est pas encore, on
    // le charge puis on re-peint (corrige l'affichage brut au 1er rendu).
    if (!SuiviObs.charge) {
      SuiviObs.charger(function () { _peindreHistorique(evtId, lignes); });
      return;
    }
    var actives = (lignes || []).slice();
    // Tri anti-chronologique par horodatage.
    actives.sort(function (a, b) {
      return new Date(b.horodatage).getTime() - new Date(a.horodatage).getTime();
    });
    if (!actives.length) { box.innerHTML = ''; return; }

    var html = '<div class="suivi-histo">';
    html += '<div class="suivi-histo__title">Actions du match</div>';
    html += '<div class="suivi-histo__list">';
    actives.forEach(function (l) {
      var ref = (typeof SuiviObs.libelle === 'function') ? SuiviObs.libelle(l.observable_id) : null;
      var lib = ref ? ((ref.icone ? ref.icone + ' ' : '') + ref.libelle) : (l.observable_id || 'Action');
      var qui = (l.equipe_concernee === 'adverse')
        ? 'Adverse'
        : (l.nom_court ? escapeHtml(l.nom_court) : 'Nous');
      var min = (l.minute_match != null) ? (l.minute_match + "'") : '';
      var pts = (l.valeur_points ? ' (+' + l.valeur_points + ')' : '');
      var annulee = (l.annule === true);
      html += '<div class="suivi-histo__row' + (annulee ? ' suivi-histo__row--annulee' : '') + '">';
      html +=   '<span class="suivi-histo__txt">' + (min ? '<b>' + min + '</b> ' : '') + escapeHtml(lib) + pts + ' · ' + qui + '</span>';
      if (!annulee) {
        html += '<button type="button" class="suivi-histo__annuler" data-id="' + escapeHtml(l.id) + '">annuler</button>';
      } else {
        html += '<span class="suivi-histo__badge">annulée</span>';
      }
      html += '</div>';
    });
    html += '</div></div>';
    box.innerHTML = html;

    box.querySelectorAll('.suivi-histo__annuler').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        if (!id || SuiviChrono.busy) return;
        if (!window.SupabaseHub || !SupabaseHub.annulerObservableCoach) return;
        SuiviChrono.busy = true;
        SupabaseHub.annulerObservableCoach(evtId, id).then(function (res) {
          SuiviChrono.busy = false;
          if (!res || !res.ok) {
            window.alert('Annulation impossible : ' + ((res && res.error) || 'erreur inconnue'));
            return;
          }
          _rafraichirScoreEtHistorique(evtId);
        });
      });
    });
  }

  // Tick léger : ne touche qu'au temps affiché (pas de re-render complet,
  // pas d'appel réseau). Le re-render complet est réservé aux actions.
  function _peindreChronoTick() {
    var t = document.getElementById('suivi-chrono-time');
    if (!t || !SuiviChrono.etat) return;
    if (SuiviChrono.etat.en_pause) return; // figé en pause
    var ta = _tempsAffiche();
    t.innerHTML = ta.principal + (ta.additionnel ? ' <span class="suivi-chrono__add">' + ta.additionnel + '</span>' : '');
  }

  // Peint l'écran complet selon l'état (config / prêt / en cours /
  // pause / terminé). Câble les boutons.
  // Vocabulaire adaptatif selon le nombre de périodes (D : 1/2/3…).
  //   1 → « période unique » ; 2 → mi-temps ; 3 → tiers-temps ; sinon période.
  function _termePeriode(nbPeriodes) {
    if (nbPeriodes === 2) return 'mi-temps';
    if (nbPeriodes === 3) return 'tiers-temps';
    return 'période';
  }
  function _ordinalFr(n) {
    if (n === 1) return '1re';
    return n + 'e';
  }
  // Libellé d'une période : « 2e mi-temps », « 1er tiers-temps », « période unique »…
  function _libellePeriode(n, nbPeriodes) {
    if (nbPeriodes <= 1) return 'Période unique';
    var terme = _termePeriode(nbPeriodes);
    // « tiers-temps » → ordinal masculin (1er) ; « mi-temps » → 1re/2e
    if (terme === 'tiers-temps') return (n === 1 ? '1er' : n + 'e') + ' ' + terme;
    return _ordinalFr(n) + ' ' + terme;
  }

  // Bouton « Réinitialiser » (action destructrice du chrono seul, avec
  // confirmation). Disponible dès qu'un chrono est lancé/terminé.
  function _btnReset() {
    return '<button type="button" class="suivi-chrono__btn suivi-chrono__btn--danger" id="chrono-reset">↺ Réinitialiser</button>';
  }
  function _bindReset(evtId) {
    var b = document.getElementById('chrono-reset');
    if (!b) return;
    b.addEventListener('click', function () {
      if (window.confirm('Réinitialiser le chrono ? La configuration des durées est conservée, mais le temps écoulé et la période sont remis à zéro. Les actions de match déjà saisies ne sont PAS touchées.')) {
        _actionChrono(evtId, 'reset', null, null);
      }
    });
  }

  function _peindreChrono() {
    var host = document.getElementById('suivi-chrono-host');
    if (!host) return;
    var e = SuiviChrono.etat;
    var evtId = SuiviChrono.evtId;
    // L3a — palette vidée par défaut ; seul l'état « en cours » la remplit.
    var palReset = document.getElementById('suivi-palette');
    if (palReset) palReset.innerHTML = '';

    var durees = (e && Array.isArray(e.durees_periodes) && e.durees_periodes.length)
      ? e.durees_periodes : [30, 30];
    var nbPeriodes = durees.length;
    var perCourante = (e && e.periode_courante) ? e.periode_courante : 1;

    // ── Cas TERMINÉ ──
    if (e && e.termine_at) {
      host.innerHTML =
        '<div class="suivi-chrono__periode">Match terminé</div>' +
        '<div class="suivi-chrono__time suivi-chrono__time--paused">--:--</div>' +
        '<div class="suivi-chrono__state suivi-chrono__state--done">Rencontre clôturée</div>' +
        '<div class="suivi-chrono__controls">' + _btnReset() + '</div>';
      _bindReset(evtId);
      return;
    }

    // ── Cas CONFIG (rien n'a jamais démarré : pas de coup_envoi_at) ──
    if (!e || !e.coup_envoi_at) {
      var rows = '';
      for (var i = 0; i < nbPeriodes; i++) {
        rows +=
          '<div class="suivi-chrono__config-row">' +
            '<label for="chrono-d' + i + '">' + _libellePeriode(i + 1, nbPeriodes) + '</label>' +
            '<input id="chrono-d' + i + '" class="chrono-duree" type="number" min="1" max="60" value="' + (durees[i] || 30) + '"></div>';
      }
      host.innerHTML =
        '<div class="suivi-chrono__config">' +
          '<div class="suivi-chrono__config-row">' +
            '<label for="chrono-nb">Nombre de périodes</label>' +
            '<input id="chrono-nb" type="number" min="1" max="5" value="' + nbPeriodes + '"></div>' +
          '<div class="suivi-chrono__config-title">Durée de chaque période (minutes)</div>' +
          '<div id="chrono-durees">' + rows + '</div>' +
        '</div>' +
        '<button type="button" class="suivi-chrono__btn suivi-chrono__btn--primary" id="chrono-demarrer">▶ Démarrer la ' + _libellePeriode(1, nbPeriodes).toLowerCase() + '</button>';

      // Le champ « nombre de périodes » régénère les lignes de durée (sans appel réseau).
      var nb = document.getElementById('chrono-nb');
      if (nb) nb.addEventListener('change', function () {
        var n = parseInt(nb.value, 10); if (!(n > 0)) n = 1; if (n > 5) n = 5;
        // Conserver les durées déjà saisies, compléter à 30 par défaut.
        var cur = _lireDureesConfig();
        var next = [];
        for (var k = 0; k < n; k++) next.push(cur[k] || 30);
        // Mémo transitoire dans l'état pour re-rendu cohérent.
        SuiviChrono.etat = Object.assign({}, e || {}, { durees_periodes: next, periode_courante: 1 });
        _peindreChrono();
      });

      var bd = document.getElementById('chrono-demarrer');
      if (bd) bd.addEventListener('click', function () {
        var dd = _lireDureesConfig();
        // Config (nb périodes + durées) PUIS démarrage de la 1re période.
        _actionChrono(evtId, 'config', { durees: dd }, function () {
          _actionChrono(evtId, 'demarrer_periode', null, null);
        });
      });
      return;
    }

    // ── Cas PÉRIODE ARMÉE (coup d'envoi déjà donné, mais période pas lancée) ──
    if (!e.debut_periode_at) {
      host.innerHTML =
        '<div class="suivi-chrono__periode">' + _libellePeriode(perCourante, nbPeriodes) + '</div>' +
        '<div class="suivi-chrono__time suivi-chrono__time--paused">' + _fmtMMSS(0) + '</div>' +
        '<div class="suivi-chrono__state suivi-chrono__state--paused">En attente — prêt à démarrer</div>' +
        '<div class="suivi-chrono__controls">' +
          '<button type="button" class="suivi-chrono__btn suivi-chrono__btn--primary" id="chrono-demarrer-p">▶ Démarrer la ' + _libellePeriode(perCourante, nbPeriodes).toLowerCase() + '</button>' +
          _btnReset() +
          '<button type="button" class="suivi-chrono__btn suivi-chrono__btn--danger" id="chrono-fin">⏹ Fin du match</button>' +
        '</div>';
      var bdp = document.getElementById('chrono-demarrer-p');
      if (bdp) bdp.addEventListener('click', function () { _actionChrono(evtId, 'demarrer_periode', null, null); });
      _bindReset(evtId);
      var bfa = document.getElementById('chrono-fin');
      if (bfa) bfa.addEventListener('click', function () {
        if (window.confirm('Terminer le match ?')) _actionChrono(evtId, 'fin', null, null);
      });
      return;
    }

    // ── Cas EN COURS (période lancée, avec ou sans pause) ──
    var ta = _tempsAffiche();
    var enPause = !!e.en_pause;
    var rebours = SuiviChrono.estRebours();
    var estDerniere = (perCourante >= nbPeriodes);
    var html =
      '<div class="suivi-chrono__periode">' + _libellePeriode(perCourante, nbPeriodes) + (rebours ? ' · à rebours' : '') + '</div>' +
      '<div id="suivi-chrono-time" class="suivi-chrono__time' + (enPause ? ' suivi-chrono__time--paused' : '') + '">' + ta.principal + (ta.additionnel ? ' <span class="suivi-chrono__add">' + ta.additionnel + '</span>' : '') + '</div>' +
      '<div class="suivi-chrono__state' + (enPause ? ' suivi-chrono__state--paused' : '') + '">' + (enPause ? '⏸ En pause' : '● En cours') + '</div>' +
      '<div class="suivi-chrono__controls">';
    if (enPause) {
      html += '<button type="button" class="suivi-chrono__btn suivi-chrono__btn--primary" id="chrono-reprise">▶ Reprise</button>';
    } else {
      html += '<button type="button" class="suivi-chrono__btn" id="chrono-pause">⏸ Pause</button>';
    }
    if (!estDerniere) {
      html += '<button type="button" class="suivi-chrono__btn" id="chrono-periode">Fin de la ' + _libellePeriode(perCourante, nbPeriodes).toLowerCase() + '</button>';
    }
    html += '<button type="button" class="suivi-chrono__btn" id="chrono-mode">' + (rebours ? '⏱ Afficher écoulé' : '⏳ Afficher rebours') + '</button>';
    html += _btnReset();
    html += '<button type="button" class="suivi-chrono__btn suivi-chrono__btn--danger" id="chrono-fin">⏹ Fin du match</button>';
    html += '</div>';
    host.innerHTML = html;

    var bmode = document.getElementById('chrono-mode');
    if (bmode) bmode.addEventListener('click', function () {
      _actionChrono(evtId, 'set_mode', { modeAffichage: (rebours ? 'ecoule' : 'rebours') }, null);
    });
    var bp = document.getElementById('chrono-pause');
    if (bp) bp.addEventListener('click', function () { _actionChrono(evtId, 'pause', null, null); });
    var br = document.getElementById('chrono-reprise');
    if (br) br.addEventListener('click', function () { _actionChrono(evtId, 'reprise', null, null); });
    var bper = document.getElementById('chrono-periode');
    if (bper) bper.addEventListener('click', function () {
      var suiv = _libellePeriode(perCourante + 1, nbPeriodes).toLowerCase();
      if (window.confirm('Terminer la ' + _libellePeriode(perCourante, nbPeriodes).toLowerCase() + ' ? La ' + suiv + ' sera prête à démarrer manuellement.')) {
        _actionChrono(evtId, 'periode_suivante', null, null);
      }
    });
    var bf = document.getElementById('chrono-fin');
    if (bf) bf.addEventListener('click', function () {
      if (window.confirm('Terminer le match ? Le chrono s\'arrête définitivement.')) {
        _actionChrono(evtId, 'fin', null, null);
      }
    });
    _bindReset(evtId);
    // L3a — palette de saisie (uniquement période en cours, hors pause facultatif).
    _peindrePalette(evtId, perCourante);
  }

  // L3b — effectif de la compo courante pour l'attribution, trié
  // (titulaires 1→15 par numero_xv, puis remplaçants). Réutilise
  // getJoueurVivier (le nom n'est PAS sur cj — RLS bloque cj.personnes).
  function _effectifPourSaisie() {
    if (!Array.isArray(State.compoJoueurs)) return [];
    var tit = State.compoJoueurs
      .filter(function (cj) { return cj.role === 'titulaire'; })
      .map(function (cj) {
        var p = (typeof getPoste === 'function' ? getPoste(cj.poste_id) : null) || {};
        var j = (typeof getJoueurVivier === 'function' ? getJoueurVivier(cj.joueur_id) : null) || {};
        return {
          uuid: cj.joueur_id,
          num: (cj.numero_maillot != null ? cj.numero_maillot : (p.numero_xv || '')),
          ordre: p.numero_xv || 99,
          nom: (j.nom || '').trim(),
          prenom: (j.prenom || '').trim()
        };
      })
      .sort(function (a, b) { return a.ordre - b.ordre; });
    var rem = State.compoJoueurs
      .filter(function (cj) { return cj.role === 'remplacant'; })
      .sort(function (a, b) {
        return (a.ordre_remplacement || a.numero_maillot || 99) -
               (b.ordre_remplacement || b.numero_maillot || 99);
      })
      .map(function (cj, idx) {
        var j = (typeof getJoueurVivier === 'function' ? getJoueurVivier(cj.joueur_id) : null) || {};
        return {
          uuid: cj.joueur_id,
          num: (cj.numero_maillot != null ? cj.numero_maillot : (16 + idx)),
          ordre: 100 + idx,
          nom: (j.nom || '').trim(),
          prenom: (j.prenom || '').trim()
        };
      });
    return tit.concat(rem);
  }

  // L3b — nom affiché « Prénom NOM » (nom en avant choisi par Manu :
  // on met le nom de famille en majuscules, prénom derrière).
  function _nomJoueur(jo) {
    var nom = (jo.nom || '').toUpperCase();
    var prenom = jo.prenom || '';
    var plein = (nom + (prenom ? ' ' + prenom : '')).trim();
    return plein || ('Joueur ' + (jo.num || '?'));
  }

  // L3b/c — ouvre la liste d'attribution dans #suivi-palette pour une
  // action « Nous » à 1 joueur ; au tap, enregistre puis revient à la palette.
  // opts.estBlessure : passe le flag (mouvement blessure).
  function _ouvrirAttribution(evtId, perCourante, obs, opts) {
    opts = opts || {};
    var pal = document.getElementById('suivi-palette');
    if (!pal) return;
    var effectif = _effectifPourSaisie();
    var html = '<div class="suivi-attrib">';
    html += '<div class="suivi-attrib__title">' + (obs.icone || '') + ' ' + escapeHtml(obs.libelle_court) + ' — qui ?</div>';
    if (!effectif.length) {
      html += '<div class="view-suivi__hint">Aucun joueur dans la compo.</div>';
    } else {
      html += '<div class="suivi-attrib__list">';
      effectif.forEach(function (jo) {
        html +=
          '<button type="button" class="suivi-attrib__joueur" data-uuid="' + escapeHtml(jo.uuid || '') + '">' +
            '<span class="suivi-attrib__nom">' + escapeHtml(_nomJoueur(jo)) + '</span>' +
            '<span class="suivi-attrib__num">' + escapeHtml(String(jo.num || '?')) + '</span>' +
          '</button>';
      });
      html += '</div>';
    }
    html += '<button type="button" class="suivi-chrono__btn" id="attrib-annuler">↩ Retour</button>';
    html += '</div>';
    pal.innerHTML = html;

    var annul = document.getElementById('attrib-annuler');
    if (annul) annul.addEventListener('click', function () { _peindrePalette(evtId, perCourante); });

    pal.querySelectorAll('.suivi-attrib__joueur').forEach(function (b) {
      b.addEventListener('click', function () {
        var uuid = b.getAttribute('data-uuid') || null;
        var minute = Math.floor(SuiviChrono.secondesEcoulees() / 60);
        var payload = {
          observableId: obs.uuid,
          categorieObs: (obs._categorieObs === 'B') ? 'B' : 'A',
          valeurPoints: (typeof obs.points === 'number' ? obs.points : 0),
          equipeConcernee: 'notre',
          joueurUuid: uuid,
          minuteMatch: minute,
          periode: perCourante
        };
        if (opts.estBlessure) payload.estBlessure = true;
        _saisirObservable(evtId, payload, function () { _peindrePalette(evtId, perCourante); });
      });
    });
  }

  // L3c — substitution : double sélection « Qui sort ? » → « Qui entre ? ».
  // joueur_uuid = sortant, joueur_uuid_entrant = entrant (cf. C12-m).
  // #3 — reconstitue l'état du terrain à l'instant T à partir de l'effectif
  // (titulaires sur le terrain, remplaçants au banc) et des SUBSTITUTIONS
  // non annulées (ordre chrono). Retourne { surTerrain:Set, auBanc:Set } d'uuid.
  // Version simple : ne tient compte que des substitutions (pas blessures/cartons).
  function _etatTerrain() {
    var surTerrain = {}, auBanc = {};
    (State.compoJoueurs || []).forEach(function (cj) {
      if (cj.role === 'titulaire') surTerrain[cj.joueur_id] = true;
      else if (cj.role === 'remplacant') auBanc[cj.joueur_id] = true;
    });
    // Substitutions dans l'ordre chronologique croissant.
    var subs = (SuiviChrono.lignes || [])
      .filter(function (l) { return l && l.observable_id === 'obs-A-substitution' && l.annule !== true; })
      .slice()
      .sort(function (a, b) { return new Date(a.horodatage) - new Date(b.horodatage); });
    subs.forEach(function (l) {
      var sortant = l.joueur_uuid, entrant = l.joueur_uuid_entrant;
      if (sortant) { delete surTerrain[sortant]; auBanc[sortant] = true; }
      if (entrant) { delete auBanc[entrant]; surTerrain[entrant] = true; }
    });
    return { surTerrain: surTerrain, auBanc: auBanc };
  }

  function _ouvrirSubstitution(evtId, perCourante, obs) {
    var pal = document.getElementById('suivi-palette');
    if (!pal) return;
    var effectif = _effectifPourSaisie();
    var etat = _etatTerrain();
    var sortants = effectif.filter(function (jo) { return etat.surTerrain[jo.uuid]; });
    var entrants = effectif.filter(function (jo) { return etat.auBanc[jo.uuid]; });

    function rendreEtape(titre, liste, vide, onPick) {
      var html = '<div class="suivi-attrib">';
      html += '<div class="suivi-attrib__title">' + (obs.icone || '') + ' ' + titre + '</div>';
      if (!liste.length) {
        html += '<div class="view-suivi__hint">' + vide + '</div>';
      } else {
        html += '<div class="suivi-attrib__list">';
        liste.forEach(function (jo) {
          html +=
            '<button type="button" class="suivi-attrib__joueur" data-uuid="' + escapeHtml(jo.uuid || '') + '">' +
              '<span class="suivi-attrib__nom">' + escapeHtml(_nomJoueur(jo)) + '</span>' +
              '<span class="suivi-attrib__num">' + escapeHtml(String(jo.num || '?')) + '</span>' +
            '</button>';
        });
        html += '</div>';
      }
      html += '<button type="button" class="suivi-chrono__btn" id="attrib-annuler">↩ Retour</button>';
      html += '</div>';
      pal.innerHTML = html;
      var annul = document.getElementById('attrib-annuler');
      if (annul) annul.addEventListener('click', function () { _peindrePalette(evtId, perCourante); });
      pal.querySelectorAll('.suivi-attrib__joueur').forEach(function (b) {
        b.addEventListener('click', function () { onPick(b.getAttribute('data-uuid') || null); });
      });
    }

    // Étape 1 : qui sort ? (joueurs sur le terrain)
    rendreEtape('Substitution — qui SORT ?', sortants, 'Aucun joueur sur le terrain.', function (sortant) {
      // Étape 2 : qui entre ? (joueurs au banc)
      rendreEtape('Substitution — qui ENTRE ?', entrants, 'Aucun joueur disponible au banc.', function (entrant) {
        var minute = Math.floor(SuiviChrono.secondesEcoulees() / 60);
        _saisirObservable(evtId, {
          observableId: obs.uuid,
          categorieObs: 'A',
          valeurPoints: 0,
          equipeConcernee: 'notre',
          joueurUuid: sortant,
          joueurUuidEntrant: entrant,
          minuteMatch: minute,
          periode: perCourante
        }, function () { _peindrePalette(evtId, perCourante); });
      });
    });
  }

  // L3a — Palette de saisie Cat A (score d'abord). Rendue sous le chrono,
  // dans #suivi-palette. En L3a : boutons « Adverse » câblés (score brut,
  // sans attribution, D7) ; boutons « Nous » présents mais inertes
  // (attribution nominative = L3b). minute_match = minute du chrono.
  function _peindrePalette(evtId, perCourante) {
    var pal = document.getElementById('suivi-palette');
    if (!pal) return;
    SuiviObs.charger(function (catA) {
      if (SuiviChrono.evtId !== evtId) return;
      if (!catA || !Array.isArray(catA.score)) {
        pal.innerHTML = '<div class="view-suivi__hint">Palette indisponible (référentiel non chargé).</div>';
        return;
      }
      var html = '<div class="suivi-palette">';
      html += '<div class="suivi-palette__title">Score</div>';
      html += '<div class="suivi-palette__grid">';
      catA.score.forEach(function (obs, idx) {
        html +=
          '<div class="suivi-palette__action suivi-palette__action--score">' +
            '<button type="button" class="suivi-palette__btn suivi-palette__btn--nous" data-idx="' + idx + '">Nous</button>' +
            '<span class="suivi-palette__lbl suivi-palette__lbl--center">' + (obs.icone || '') + ' ' + escapeHtml(obs.libelle_court) + ' <em>+' + obs.points + '</em></span>' +
            '<button type="button" class="suivi-palette__btn suivi-palette__btn--adv" data-obs="' + escapeHtml(obs.uuid) + '" data-pts="' + obs.points + '">Adverse</button>' +
          '</div>';
      });
      html += '</div>'; // fin grid score
      // L3c — section Mouvement (substitution, blessure) côté nous.
      var mvt = Array.isArray(catA.mouvement) ? catA.mouvement : [];
      if (mvt.length) {
        html += '<div class="suivi-palette__title suivi-palette__title--sep">Mouvement</div>';
        html += '<div class="suivi-palette__grid">';
        mvt.forEach(function (obs, idx) {
          html +=
            '<div class="suivi-palette__action">' +
              '<span class="suivi-palette__lbl">' + (obs.icone || '') + ' ' + escapeHtml(obs.libelle_court) + '</span>' +
              '<div class="suivi-palette__btns">' +
                '<button type="button" class="suivi-palette__btn suivi-palette__btn--mvt" data-midx="' + idx + '">Saisir</button>' +
              '</div>' +
            '</div>';
        });
        html += '</div>';
      }
      // L3d — section Discipline (cartons, avertissement) : attribution joueur.
      var disc = Array.isArray(catA.discipline) ? catA.discipline : [];
      if (disc.length) {
        html += '<div class="suivi-palette__title suivi-palette__title--sep">Discipline</div>';
        html += '<div class="suivi-palette__grid">';
        disc.forEach(function (obs, idx) {
          html +=
            '<div class="suivi-palette__action">' +
              '<span class="suivi-palette__lbl">' + (obs.icone || '') + ' ' + escapeHtml(obs.libelle_court) + '</span>' +
              '<div class="suivi-palette__btns">' +
                '<button type="button" class="suivi-palette__btn suivi-palette__btn--disc" data-didx="' + idx + '">Joueur…</button>' +
              '</div>' +
            '</div>';
        });
        html += '</div>';
      }
      // L3d — section Jeu collectif (mêlées/touches) : sans attribution, 1 clic.
      var jc = Array.isArray(catA.jeu_collectif) ? catA.jeu_collectif : [];
      if (jc.length) {
        html += '<div class="suivi-palette__title suivi-palette__title--sep">Jeu collectif</div>';
        html += '<div class="suivi-palette__grid">';
        jc.forEach(function (obs, idx) {
          html +=
            '<div class="suivi-palette__action">' +
              '<span class="suivi-palette__lbl">' + escapeHtml(obs.libelle_court) + '</span>' +
              '<div class="suivi-palette__btns">' +
                '<button type="button" class="suivi-palette__btn suivi-palette__btn--jc" data-jidx="' + idx + '">Saisir</button>' +
              '</div>' +
            '</div>';
        });
        html += '</div>';
      }
      // L5 — section Cat B « Observations » (repliable, en retrait, D8).
      var obsB = SuiviObs.observablesB(SuiviChrono.nomNous);
      if (obsB.length) {
        html += '<details class="suivi-obsb">';
        html += '<summary class="suivi-obsb__summary">Observations (à froid)</summary>';
        html += '<div class="suivi-obsb__grid">';
        obsB.forEach(function (o, idx) {
          html += '<button type="button" class="suivi-obsb__btn" data-bidx="' + idx + '">' + escapeHtml(o.libelle) + '</button>';
        });
        html += '</div></details>';
      }
      html += '</div>'; // fin suivi-palette
      pal.innerHTML = html;

      // L3b — boutons « Nous » : ouvrent l'attribution nominative.
      pal.querySelectorAll('.suivi-palette__btn--nous').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = parseInt(b.getAttribute('data-idx'), 10);
          var obs = catA.score[idx];
          if (obs) _ouvrirAttribution(evtId, perCourante, obs);
        });
      });
      // L3a — boutons « Adverse » : score brut, sans attribution.
      pal.querySelectorAll('.suivi-palette__btn--adv').forEach(function (b) {
        b.addEventListener('click', function () {
          var obsId = b.getAttribute('data-obs');
          var pts = parseInt(b.getAttribute('data-pts'), 10) || 0;
          var minute = Math.floor(SuiviChrono.secondesEcoulees() / 60);
          _saisirObservable(evtId, {
            observableId: obsId,
            categorieObs: 'A',
            valeurPoints: pts,
            equipeConcernee: 'adverse',
            minuteMatch: minute,
            periode: perCourante
          });
        });
      });
      // L3c — boutons « Mouvement » : substitution (double choix) ou blessure.
      pal.querySelectorAll('.suivi-palette__btn--mvt').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = parseInt(b.getAttribute('data-midx'), 10);
          var obs = mvt[idx];
          if (!obs) return;
          if (obs.uuid === 'obs-A-substitution') {
            _ouvrirSubstitution(evtId, perCourante, obs);
          } else {
            // Blessure (et tout mouvement à 1 joueur) : attribution simple.
            _ouvrirAttribution(evtId, perCourante, obs, { estBlessure: (obs.uuid === 'obs-A-blessure') });
          }
        });
      });
      // L3d — boutons « Discipline » : attribution nominative (joueur).
      pal.querySelectorAll('.suivi-palette__btn--disc').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = parseInt(b.getAttribute('data-didx'), 10);
          var obs = disc[idx];
          if (obs) _ouvrirAttribution(evtId, perCourante, obs);
        });
      });
      // L3d — boutons « Jeu collectif » : fait d'équipe, sans joueur, 1 clic.
      pal.querySelectorAll('.suivi-palette__btn--jc').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = parseInt(b.getAttribute('data-jidx'), 10);
          var obs = jc[idx];
          if (!obs) return;
          var minute = Math.floor(SuiviChrono.secondesEcoulees() / 60);
          _saisirObservable(evtId, {
            observableId: obs.uuid,
            categorieObs: 'A',
            valeurPoints: 0,
            equipeConcernee: 'notre',
            minuteMatch: minute,
            periode: perCourante
          });
        });
      });
      // L5 — boutons « Observations » Cat B : attribution joueur, sans points.
      pal.querySelectorAll('.suivi-obsb__btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = parseInt(b.getAttribute('data-bidx'), 10);
          var o = obsB[idx];
          if (!o) return;
          _ouvrirAttribution(evtId, perCourante, {
            uuid: _slugObsB(o.libelle),
            libelle_court: o.libelle,
            icone: '📝',
            points: 0,
            _categorieObs: 'B'
          });
        });
      });
    });
  }

  // L3a/b — enregistre un observable (voie coach) puis rafraîchit le score.
  // onApres : callback optionnel après succès (ex. retour à la palette).
  function _saisirObservable(evtId, obs, onApres) {
    if (SuiviChrono.busy) return;
    if (!window.SupabaseHub || !SupabaseHub.insererObservableCoach) return;
    SuiviChrono.busy = true;
    SupabaseHub.insererObservableCoach(evtId, obs).then(function (res) {
      SuiviChrono.busy = false;
      if (!res || !res.ok) {
        window.alert('Saisie impossible : ' + ((res && res.error) || 'erreur inconnue'));
        return;
      }
      // L4 — rafraîchir score + historique (relecture chronologie).
      _rafraichirScoreEtHistorique(evtId);
      if (typeof onApres === 'function') onApres();
    });
  }

  // Lit les durées saisies dans le formulaire de config (champs .chrono-duree).
  function _lireDureesConfig() {
    var inputs = document.querySelectorAll('#chrono-durees .chrono-duree');
    var arr = [];
    inputs.forEach(function (inp) {
      var v = parseInt(inp.value, 10);
      arr.push(v > 0 ? v : 30);
    });
    return arr.length ? arr : [30, 30];
  }

  // Exécute une action chrono (voie coach) puis relit l'état et repeint.
  // Garde anti-double-clic. onApres = callback optionnel après succès.
  function _actionChrono(evtId, action, opts, onApres) {
    if (SuiviChrono.busy) return;
    if (!window.SupabaseHub || !SupabaseHub.actionChronoCoach) return;
    SuiviChrono.busy = true;
    SupabaseHub.actionChronoCoach(evtId, action, opts || undefined).then(function (res) {
      SuiviChrono.busy = false;
      if (!res || !res.ok) {
        window.alert('Action chrono impossible : ' + ((res && res.error) || 'erreur inconnue'));
        return;
      }
      if (typeof onApres === 'function') { onApres(); return; }
      _rafraichirChrono(evtId, true);
    });
  }
  // régénérés) → câblage unique au boot. Clic = set viewMode +
  // is-active + re-rendu de l'éditeur. Le HTML retire le is-active
  // codé en dur (piloté ici). Robuste si les boutons sont absents.
  function bindViewTabs() {
    const tabs = document.querySelectorAll('.view-tabs__tab');
    if (!tabs || tabs.length < 2) return;
    const setMode = function (mode, clickedTab) {
      State.viewMode = mode;
      // L2/3a — en quittant l'onglet Suivi, stopper le tick d'affichage
      // (le chrono continue en base ; l'affichage resync au retour).
      if (mode !== 'suivi' && typeof SuiviChrono !== 'undefined') SuiviChrono.desarmer();
      tabs.forEach(function (t) { t.classList.remove('is-active'); });
      clickedTab.classList.add('is-active');
      renderEditorArea();
    };
    // Convention HTML : 1er onglet = Liste, 2e = Terrain, 3e = Suivi (L1).
    tabs[0].addEventListener('click', function () { setMode('liste', tabs[0]); });
    tabs[1].addEventListener('click', function () { setMode('terrain', tabs[1]); });
    if (tabs[2]) {
      tabs[2].addEventListener('click', function () { setMode('suivi', tabs[2]); });
    }
    // pt 53 — 4e onglet « Rapport » (lecture seule du déduit).
    if (tabs[3]) {
      tabs[3].addEventListener('click', function () { setMode('rapport', tabs[3]); });
    }
    // État initial cohérent avec State.viewMode (défaut 'liste').
    tabs.forEach(function (t) { t.classList.remove('is-active'); });
    var initialTab = tabs[0];
    if (State.viewMode === 'terrain') initialTab = tabs[1];
    else if (State.viewMode === 'suivi' && tabs[2]) initialTab = tabs[2];
    else if (State.viewMode === 'rapport' && tabs[3]) initialTab = tabs[3];
    initialTab.classList.add('is-active');
  }

  // ════════════════════════════════════════════════════════════
  // v3.23 — EXPORT IMAGE (réseaux sociaux). Bouton « Image » à côté
  // des onglets. Collecte la compo COURANTE (titulaires + remplaçants)
  // et délègue le rendu Canvas au module autonome window.CompoExport.
  // N'altère aucune fonction d'écriture/rendu existante.
  // ════════════════════════════════════════════════════════════
  // Classe un poste en ligne d'affichage : avants (1-8), charnière
  // (9-10), arrières (11-15). Dérivé de numero_xv (robuste, multi-format).
  function _ligneDePoste(poste) {
    var n = poste && poste.numero_xv ? Number(poste.numero_xv) : 99;
    if (n <= 8) return 'av';
    if (n <= 10) return 'ch';
    return 'ar';
  }

  function _collecterDonneesExport() {
    var ctx = State.evenementEquipeContext;
    var evt = ctx && ctx.evenement ? ctx.evenement : null;
    var eq  = ctx && ctx.equipe ? ctx.equipe : null;

    // Titulaires triés par numero_xv du poste (1→15) ; remplaçants par ordre.
    var tit = State.compoJoueurs
      .filter(function (cj) { return cj.role === 'titulaire'; })
      .map(function (cj) {
        var p = getPoste(cj.poste_id) || {};
        var j = getJoueurVivier(cj.joueur_id) || {};
        return {
          num: (cj.numero_maillot != null ? cj.numero_maillot : (p.numero_xv || '')),
          ordre: p.numero_xv || 99,
          nom: (j.nom || '').trim(),
          prenom: (j.prenom || '').trim(),
          poste: (p.libelle_long || p.libelle_court || p.code || ''),
          club: (j.club_principal_nom_court || '').toUpperCase(),
          ligne: _ligneDePoste(p)
        };
      })
      .sort(function (a, b) { return a.ordre - b.ordre; });

    var remBruts = State.compoJoueurs
      .filter(function (cj) { return cj.role === 'remplacant'; })
      .sort(function (a, b) {
        return (a.ordre_remplacement || a.numero_maillot || 99) -
               (b.ordre_remplacement || b.numero_maillot || 99);
      })
      .map(function (cj, idx) {
        var j = getJoueurVivier(cj.joueur_id) || {};
        return {
          num: (cj.numero_maillot != null ? cj.numero_maillot : (16 + idx)),
          nom: nomJoueurCompact(cj)
        };
      });
    // Compléter jusqu'à 8 emplacements (16→23) avec des places vides.
    var rem = [];
    for (var i = 0; i < 8; i++) {
      rem.push(remBruts[i] || { num: 16 + i, nom: '–' });
    }

    // Méta : titre, sous-titre (équipe), compétition/date/lieu.
    var titre = (eq && (eq.nom_officiel || eq.libelle_court)) || 'COMPOSITION';
    var sousTitre = (eq && eq.libelle_court) ? eq.libelle_court : '';
    var meta1 = evt ? (evt.libelle || '') : '';
    var dateStr = evt && evt.date_debut ? new Date(evt.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    var meta2 = dateStr;

    return {
      titre: titre.toUpperCase(),
      sousTitre: sousTitre,
      meta1: meta1,
      meta2: meta2,
      dateExport: new Date().toLocaleDateString('fr-FR'),
      slug: (titre || 'compo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      titulaires: tit,
      remplacants: rem,
      logos: {
        mom: 'assets/ecusson-mom.png',
        entente: 'assets/logo-entente.png'
      }
    };
  }

  function bindExportImage() {
    var btn = document.getElementById('btn-export-image');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!window.CompoExport) {
        alert("Le module d'export n'est pas chargé.");
        return;
      }
      if (!State.compoJoueurs || State.compoJoueurs.length === 0) {
        alert('Aucune composition à exporter pour le moment.');
        return;
      }
      window.CompoExport.ouvrir(_collecterDonneesExport());
    });
  }

  // ════════════════════════════════════════════════════════════
  // v3.15 (Vue Terrain, étape A) — RENDU TERRAIN, LECTURE SEULE
  // ════════════════════════════════════════════════════════════
  // Projection de la compo COURANTE (State.compoJoueurs, qui suit
  // l'onglet base/match sélectionné) sur un terrain. Aucune édition :
  // pour modifier, l'utilisateur repasse en vue Liste. La compo reste
  // la source de vérité.
  //
  // v3.16 (Vue Terrain, étape B) — TERRAIN DESSINÉ + PLACEMENT OBLIQUE.
  // Remplace la grille de l'étape A par un terrain de rugby dessiné (SVG)
  // avec les pastilles positionnées à leurs coordonnées tactiques réelles.
  //
  // Coordonnées XV en % du terrain (left x, top y), dérivées de la maquette
  // validée terrain par Manu (positions : 1ʳᵉ ligne 1-2-3 à plat en haut ;
  // 2ᵉ ligne 4-5 ; flankers 6-7 avancés et écartés ; N°8 à la base ;
  // charnière 9-10 en diagonale ; trois-quarts 11-12-13-14 ALIGNÉS ;
  // arrière 15 centré en bas). PACK EN HAUT → ARRIÈRE EN BAS.
  // Étape B = format XV figé ; les autres formats (VII/XIII/X) auront
  // leur propre table de coordonnées (étape ultérieure ; la base n'a pas
  // de x/y, ces positions sont donc définies ici en dur côté front).
  const TERRAIN_POS_XV = {
    'PG':  { x: 30.0, y: 8.5 },
    'TAL': { x: 45.0, y: 8.5 },
    'PD':  { x: 60.0, y: 8.5 },
    '2LG': { x: 37.5, y: 19.9 },
    '2LD': { x: 52.5, y: 19.9 },
    '3LG': { x: 22.5, y: 28.8 },
    '3LD': { x: 67.5, y: 28.8 },
    'N8':  { x: 45.0, y: 33.2 },
    'DM':  { x: 33.8, y: 51.6 },
    'DO':  { x: 57.0, y: 59.2 },
    'AG':  { x: 12.5, y: 75.9 },
    'CG':  { x: 40.0, y: 75.9 },
    'CD':  { x: 65.0, y: 75.9 },
    'AD':  { x: 87.5, y: 75.9 },
    'AR':  { x: 50.0, y: 93.4 }
  };

  // v3.22 — Tables de coordonnées des AUTRES formats (multi-format vue
  // Terrain, chantier UX-EVT-VUE-TERRAIN). Mêmes conventions que XV :
  // clés = code poste, valeurs = { x:%, y:% } dans le viewBox SVG 100×140,
  // PACK EN HAUT → ARRIÈRE EN BAS. Les postes retenus par format sont
  // alignés sur postes.formats_applicables corrigé en base (sql/70) :
  //   XIII {XV,13} = XV sans les flankers 3LG/3LD (N8 conservé) → 13 postes,
  //                  coordonnées XV RÉUTILISÉES à l'identique (sous-ensemble).
  //   X    {X}     = pack à 5 (1-2-3 + 2L sur les EXTÉRIEURS) + 9-10-12-14-15
  //                  → 10 postes (compo dictée par Manu).
  //   VII  {7}     = 3 avants (1-2-3) + charnière 9-10 + 1 centre (12) +
  //                  1 ailier (11=AG) → 7 postes (compo dictée par Manu).
  // Coordonnées définies en dur côté front (la base postes n'a pas de x/y).
  const TERRAIN_POS_13 = {
    'PG':  { x: 30.0, y: 8.5 },
    'TAL': { x: 45.0, y: 8.5 },
    'PD':  { x: 60.0, y: 8.5 },
    '2LG': { x: 37.5, y: 19.9 },
    '2LD': { x: 52.5, y: 19.9 },
    'N8':  { x: 45.0, y: 33.2 },
    'DM':  { x: 33.8, y: 51.6 },
    'DO':  { x: 57.0, y: 59.2 },
    'AG':  { x: 12.5, y: 75.9 },
    'CG':  { x: 40.0, y: 75.9 },
    'CD':  { x: 65.0, y: 75.9 },
    'AD':  { x: 87.5, y: 75.9 },
    'AR':  { x: 50.0, y: 93.4 }
  };
  const TERRAIN_POS_X = {
    'PG':  { x: 30.0, y: 8.5 },
    'TAL': { x: 45.0, y: 8.5 },
    'PD':  { x: 60.0, y: 8.5 },
    '2LG': { x: 14.0, y: 20.0 },   // 2L sur l'extérieur gauche (consigne Manu)
    '2LD': { x: 86.0, y: 20.0 },   // 2L sur l'extérieur droit
    'DM':  { x: 34.0, y: 46.0 },
    'DO':  { x: 55.0, y: 55.0 },
    'CG':  { x: 32.0, y: 78.0 },
    'AD':  { x: 78.0, y: 78.0 },
    'AR':  { x: 45.0, y: 93.0 }
  };
  const TERRAIN_POS_7 = {
    'PG':  { x: 30.0, y: 8.5 },
    'TAL': { x: 45.0, y: 8.5 },
    'PD':  { x: 60.0, y: 8.5 },
    'DM':  { x: 30.0, y: 42.0 },
    'DO':  { x: 52.0, y: 52.0 },
    'CG':  { x: 30.0, y: 80.0 },
    'AG':  { x: 62.0, y: 80.0 }
  };

  // v3.22 — Sélecteur de table par format. Les vocabulaires NE SONT PAS
  // alignés entre les tables (dette MODELE-FORMAT-VOCAB) :
  //   • evenement_equipes_engagees.format_de_jeu : '12', '7' (réels en base)
  //   • postes.formats_applicables                : 'XV','13','X','7'
  //   • dropdown Évènements                        : 'XV','13','12','X','9','8','7'
  // On réconcilie ici par un mapping front explicite. '12' → structure XV
  // (effectif réduit, placement XV conservé — décision Manu). Tout format
  // inconnu / NULL / legacy → XV (dégradation honnête, jamais d'écran vide).
  const TERRAIN_POS_PAR_FORMAT = {
    'XV': TERRAIN_POS_XV,
    '15': TERRAIN_POS_XV,
    '12': TERRAIN_POS_XV,   // rugby à XII = structure XV, effectif réduit
    '13': TERRAIN_POS_13,
    'X':  TERRAIN_POS_X,
    '10': TERRAIN_POS_X,
    '7':  TERRAIN_POS_7,
    'VII': TERRAIN_POS_7
  };

  // v3.22 — Table de coordonnées à utiliser pour la compo courante.
  // Lit le format de l'équipe engagée (mode U-N3) ; défaut XV sinon.
  function terrainPosCourant() {
    const ctx = State.evenementEquipeContext;
    const fmt = ctx && ctx.evenement_equipe && ctx.evenement_equipe.format_de_jeu;
    if (fmt != null) {
      const key = String(fmt).trim().toUpperCase();
      if (TERRAIN_POS_PAR_FORMAT[key]) return TERRAIN_POS_PAR_FORMAT[key];
    }
    return TERRAIN_POS_XV; // legacy / NULL / format inconnu
  }

  // SVG du terrain de rugby (fond) : en-buts, lignes 22m / 10m / médiane,
  // poteaux haut et bas. viewBox 100×140 (ratio terrain), tracé en blanc
  // semi-transparent sur fond vert. Indépendant des joueurs.
  function pitchSvg() {
    return '' +
      '<svg class="vt-pitch-svg" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">' +
        '<rect x="0" y="0" width="100" height="140" fill="#3f9b4f"/>' +
        '<rect x="0" y="0" width="100" height="9" fill="#379247"/>' +
        '<rect x="0" y="131" width="100" height="9" fill="#379247"/>' +
        '<g stroke="#ffffff" stroke-width="0.5" fill="none" opacity="0.85">' +
          '<rect x="5" y="9" width="90" height="122"/>' +
          '<line x1="5" y1="28" x2="95" y2="28"/>' +
          '<line x1="5" y1="112" x2="95" y2="112"/>' +
          '<line x1="5" y1="47" x2="95" y2="47" stroke-dasharray="2 2"/>' +
          '<line x1="5" y1="93" x2="95" y2="93" stroke-dasharray="2 2"/>' +
          '<line x1="5" y1="70" x2="95" y2="70"/>' +
        '</g>' +
        '<g stroke="#cfd3d6" stroke-width="0.8" fill="none">' +
          '<line x1="46" y1="1" x2="47.5" y2="9"/><line x1="54" y1="1" x2="52.5" y2="9"/><line x1="46.5" y1="5" x2="53.5" y2="5"/>' +
          '<line x1="47.5" y1="131" x2="46" y2="139"/><line x1="52.5" y1="131" x2="54" y2="139"/><line x1="46.5" y1="135" x2="53.5" y2="135"/>' +
        '</g>' +
      '</svg>';
  }

  function renderEditorTerrain(el, compo) {
    const posteParCode = new Map();
    for (const p of State.postes) posteParCode.set(p.code, p);

    var habillage = _habillageCourant();
    var sousTitreT = _adversaireDeCompo(compo); // « vs … » ou libellé
    let html = '<div class="view-terrain view-suivi--' + habillage + '" aria-label="Vue terrain de la composition (lecture seule)">';
    html += _bandeauHTML(_nomNotreEquipe(), sousTitreT);
    html += '<div class="view-terrain__pitch">';
    html += pitchSvg();

    // Pastilles positionnées en absolu (left/top %) par-dessus le terrain.
    // v3.22 — table de coordonnées selon le format de l'équipe (défaut XV).
    const TERRAIN_POS = terrainPosCourant();
    for (const code in TERRAIN_POS) {
      const pos = TERRAIN_POS[code];
      const poste = posteParCode.get(code);
      if (!poste) continue; // robustesse : code absent du référentiel
      const cj = joueurDuPoste(poste.id);
      const num = poste.numero_xv || '';
      const style = 'left:' + pos.x + '%;top:' + pos.y + '%;';
      const libellePoste = poste.libelle_long || poste.libelle_court || poste.code;
      if (!cj) {
        html += '<div class="vt-mark vt-mark--vide vt-drop" data-poste-id="' + escapeHtml(poste.id) + '" style="' + style + '" title="' +
                  escapeHtml(libellePoste + ' — libre (déposer un joueur ici)') + '">' +
                  '<span class="vt-mark__poste">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
                  '<span class="vt-mark__disc"><span class="vt-mark__num">' + escapeHtml(num) + '</span></span>' +
                  '<span class="vt-mark__nom">—</span>' +
                '</div>';
        continue;
      }
      html += '<div class="vt-mark vt-drop vt-drag ' + cssClassEtatJoueur(etatDeriveJoueur(cj)) + '" draggable="true"' +
                ' data-joueur-id="' + escapeHtml(cj.joueur_id) + '"' +
                ' data-poste-id="' + escapeHtml(poste.id) + '"' +
                ' style="' + style + '" title="' +
                escapeHtml(libellePoste + ' · ' + nomJoueurComplet(cj) + ' (glisser pour déplacer)') + '">' +
                '<span class="vt-mark__poste">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
                '<span class="vt-mark__disc"><span class="vt-mark__num">' + escapeHtml(num) + '</span></span>' +
                '<span class="vt-mark__nom">' + escapeHtml(nomJoueurCompact(cj)) + '</span>' +
              '</div>';
    }

    html += '</div>'; // pitch

    // Bandeau remplaçants sous le terrain (lecture seule, compact)
    const remplacants = State.compoJoueurs.filter(cj => cj.role === 'remplacant')
      .sort((a, b) => (a.ordre_remplacement || a.numero_maillot || 99) - (b.ordre_remplacement || b.numero_maillot || 99));
    html += '<div class="view-terrain__bench vt-bench-drop">';
    html += '<span class="view-terrain__bench-title">Remplaçants</span>';
    if (remplacants.length === 0) {
      html += '<span class="view-terrain__bench-empty">aucun</span>';
    } else {
      for (let i = 0; i < remplacants.length; i++) {
        const cj = remplacants[i];
        html += '<span class="vt-bench-item vt-drag" draggable="true" data-joueur-id="' + escapeHtml(cj.joueur_id) + '" title="' +
                  escapeHtml(nomJoueurComplet(cj) + ' (glisser sur un poste ou hors du banc)') + '">' +
                  '<span class="vt-bench-item__num">' + escapeHtml(cj.numero_maillot != null ? cj.numero_maillot : (16 + i)) + '</span>' +
                  escapeHtml(nomJoueurCompact(cj)) +
                '</span>';
      }
    }
    html += '</div>';

    html += '</div>'; // view-terrain
    el.innerHTML = html;
    bindTerrainDnD(el); // v3.18 — édition au drag (3 gestes + éviction au banc)
    // Toggle d'habillage partagé (v3.44) — re-rend la vue terrain.
    _bindHabillageToggle(el.querySelector('.view-terrain'), function () {
      renderEditorTerrain(el, compo);
    });
  }

  // v3.18 — câblage drag & drop du terrain. Source = pastilles draggables
  // (.vt-drag, data-joueur-id) ET items du panneau vivier (.effectif-item
  // [data-joueur-id], rendus draggables par renderEffectifPanel). Cibles =
  // toutes les pastilles (.vt-drop, data-poste-id). Le drop appelle
  // onDropJoueurSurPoste, qui applique la règle d'éviction et écrit via la
  // couche existante.
  function bindTerrainDnD(scope) {
    const root = scope || document;
    // Sources internes au terrain (titulaires déplaçables)
    root.querySelectorAll('.vt-drag[data-joueur-id]').forEach(function (mark) {
      mark.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', mark.dataset.joueurId);
        e.dataTransfer.effectAllowed = 'move';
        mark.classList.add('vt-dragging');
      });
      mark.addEventListener('dragend', function () { mark.classList.remove('vt-dragging'); });
    });
    // Cibles (toutes les pastilles, vides ou occupées)
    root.querySelectorAll('.vt-drop[data-poste-id]').forEach(function (cible) {
      cible.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cible.classList.add('vt-drop-hover');
      });
      cible.addEventListener('dragleave', function () { cible.classList.remove('vt-drop-hover'); });
      cible.addEventListener('drop', function (e) {
        e.preventDefault();
        cible.classList.remove('vt-drop-hover');
        const joueurId = e.dataTransfer.getData('text/plain');
        if (joueurId) onDropJoueurSurPoste(joueurId, cible.dataset.posteId);
      });
    });
    // v3.19 — le BANC est une zone de drop : déposer un joueur → remplaçant.
    root.querySelectorAll('.vt-bench-drop').forEach(function (bench) {
      bench.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        bench.classList.add('vt-bench-hover');
      });
      bench.addEventListener('dragleave', function () { bench.classList.remove('vt-bench-hover'); });
      bench.addEventListener('drop', function (e) {
        e.preventDefault();
        bench.classList.remove('vt-bench-hover');
        const joueurId = e.dataTransfer.getData('text/plain');
        if (joueurId) onDropJoueurSurBanc(joueurId);
      });
    });
  }

  // Nom compact pour pastille terrain : « INITIALE.NOM » si possible.
  // Nom compact pour pastille terrain : « I.NOM-DE-FAMILLE » en entier.
  // v3.17 — utilise les champs SÉPARÉS prenom/nom du vivier (pas un
  // re-découpage de la chaîne concaténée, qui cassait sur les prénoms
  // composés type « Sidi-Mohamed Chakor » → affichait « S.MOHAMED CHAK… »).
  // Initiale du 1er prénom + nom de famille COMPLET (jamais tronqué).
  function nomJoueurCompact(cj) {
    if (!cj) return '';
    const j = getJoueurVivier(cj.joueur_id) || {};
    const nom = (j.nom || '').trim();
    const prenom = (j.prenom || '').trim();
    if (!nom && !prenom) return '';
    const initiale = prenom ? (prenom.charAt(0) + '.') : '';
    return (initiale + nom).toUpperCase().trim();
  }

  // Nom complet d'un compo_joueur via le vivier (RLS-safe).
  // S'aligne EXACTEMENT sur la vue Liste (renderSlotPoste) : lookup via
  // getJoueurVivier(joueur_id), champs .nom / .prenom.
  function nomJoueurComplet(cj) {
    if (!cj) return '';
    const j = getJoueurVivier(cj.joueur_id) || {};
    return ((j.prenom || '') + ' ' + (j.nom || '')).trim();
  }

  // ════════════════════════════════════════════════════════════
  // v3.18 (Vue Terrain, étape C) — ÉDITION AU DRAG
  // ════════════════════════════════════════════════════════════
  // Règle (décisions Manu) : déposer un joueur sur un poste —
  //  • poste VIDE → placement simple ;
  //  • poste OCCUPÉ → l'occupant part au BANC (remplaçant, prochain
  //    n° 16-23 libre ; si banc plein → sort vers le vivier), puis le
  //    joueur déposé prend le poste.
  // Le joueur déposé peut venir d'une pastille du terrain (titulaire qui
  // se déplace — il libère son ancien poste) ou du panneau vivier.
  // Drag autorisé même sur compo validée. Écriture UNIQUEMENT via la
  // couche existante (addJoueurCompo / updateJoueurCompo / removeJoueurCompo) ;
  // état via etatJoueurPourCompoCourante() (→ 'modifie' en compo de match).
  //
  // Calcule le prochain numéro de banc libre (16..23) ou null si plein.
  function prochainNumeroBancLibre() {
    const used = new Set(
      State.compoJoueurs
        .filter(cj => cj.role === 'remplacant')
        .map(cj => cj.numero_maillot)
        .filter(n => n != null)
    );
    for (let n = 16; n <= 23; n++) { if (!used.has(n)) return n; }
    return null; // banc plein
  }

  // Applique un dépôt « joueur → poste cible ». joueurId = joueur déposé.
  // posteCibleId = poste de destination. Réutilise la couche d'écriture.
  async function onDropJoueurSurPoste(joueurId, posteCibleId) {
    if (!joueurId || !posteCibleId) return;
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) return;

    const joueur = getJoueurVivier(joueurId);
    if (!joueur) return;

    // Occupant actuel du poste cible (titulaire), s'il existe.
    const occupant = State.compoJoueurs.find(
      cj => cj.role === 'titulaire' && cj.poste_id === posteCibleId
    );
    // Si on dépose le joueur sur SON propre poste : rien à faire.
    if (occupant && occupant.joueur_id === joueurId) return;

    const posteCible = getPoste(posteCibleId);
    const numMaillotCible = (posteCible && posteCible.numero_xv) ? posteCible.numero_xv : null;
    const etat = etatJoueurPourCompoCourante();
    const horsCat = State.evenementEquipeId
      ? !!joueur._horsGroupe
      : (joueur.categorie_id !== M14_CATEGORIE_ID);

    // 1) Évincer l'occupant vers le banc (ou le vivier si banc plein).
    if (occupant) {
      const numBanc = prochainNumeroBancLibre();
      if (numBanc == null) {
        // Banc plein → l'occupant sort de la compo (vers le vivier).
        const rOut = await SupabaseHub.removeJoueurCompo(occupant.id);
        if (!rOut.ok) { alert('Erreur (sortie occupant) : ' + rOut.error); return; }
      } else {
        const rBanc = await SupabaseHub.updateJoueurCompo(occupant.id, {
          role: 'remplacant',
          numero_maillot: numBanc,
          etat_joueur: etat
        });
        if (!rBanc.ok) { alert('Erreur (envoi au banc) : ' + rBanc.error); return; }
      }
    }

    // 2) Le joueur déposé est-il déjà dans la compo (déplacement) ou nouveau (vivier) ?
    const existant = State.compoJoueurs.find(cj => cj.joueur_id === joueurId);
    if (existant) {
      // Déplacement : on met à jour son poste/numéro/rôle.
      const rMove = await SupabaseHub.updateJoueurCompo(existant.id, {
        role: 'titulaire',
        poste_id: posteCibleId,
        numero_maillot: numMaillotCible,
        etat_joueur: etat
      });
      if (!rMove.ok) { alert('Erreur (déplacement) : ' + rMove.error); return; }
    } else {
      // Nouveau joueur (depuis le vivier) : ajout sur le poste cible.
      const rAdd = await SupabaseHub.addJoueurCompo({
        composition_id: State.selectedCompoId,
        joueur_id: joueurId,
        role: 'titulaire',
        poste_id: posteCibleId,
        numero_maillot: numMaillotCible,
        etat_joueur: etat,
        est_depannage_hors_categorie: horsCat
      });
      if (!rAdd.ok) { alert('Erreur (ajout) : ' + rAdd.error); return; }
    }

    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  // v3.19 — dépôt d'un joueur sur le BANC : il devient remplaçant (prochain
  // n° 16-23 libre). S'il était titulaire, son poste se libère. S'il est déjà
  // au banc, rien à faire. Si le banc est plein, on refuse proprement.
  async function onDropJoueurSurBanc(joueurId) {
    if (!joueurId) return;
    const joueur = getJoueurVivier(joueurId);
    if (!joueur) return;

    const existant = State.compoJoueurs.find(cj => cj.joueur_id === joueurId);
    if (existant && existant.role === 'remplacant') return; // déjà au banc

    const numBanc = prochainNumeroBancLibre();
    if (numBanc == null) { alert('Le banc est complet (8 remplaçants).'); return; }

    const etat = etatJoueurPourCompoCourante();
    const horsCat = State.evenementEquipeId
      ? !!joueur._horsGroupe
      : (joueur.categorie_id !== M14_CATEGORIE_ID);

    if (existant) {
      const r = await SupabaseHub.updateJoueurCompo(existant.id, {
        role: 'remplacant', numero_maillot: numBanc, etat_joueur: etat
      });
      if (!r.ok) { alert('Erreur (envoi au banc) : ' + r.error); return; }
    } else {
      const libres = postesVides();
      const posteId = libres.length > 0 ? libres[0].id : (State.postes[0] && State.postes[0].id);
      const r = await SupabaseHub.addJoueurCompo({
        composition_id: State.selectedCompoId,
        joueur_id: joueurId,
        role: 'remplacant',
        numero_maillot: numBanc,
        poste_id: posteId,
        etat_joueur: etat,
        est_depannage_hors_categorie: horsCat
      });
      if (!r.ok) { alert('Erreur (ajout au banc) : ' + r.error); return; }
    }

    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  // v3.2 : lookup joueur depuis State.vivierById (RLS-safe via RPC get_vivier_compo)
  function renderSlotPoste(poste) {
    const cj = joueurDuPoste(poste.id);
    if (!cj) {
      return (
        '<li class="slot slot--vide" data-poste-id="' + escapeHtml(poste.id) + '" data-role="titulaire">' +
          '<span class="slot__num">' + escapeHtml(poste.numero_xv || '') + '</span>' +
          '<span class="slot__poste-label">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
          '<span class="slot__add">+ Ajouter</span>' +
        '</li>'
      );
    }
    const j = getJoueurVivier(cj.joueur_id) || {};
    return (
      '<li class="slot slot--occupe ' + cssClassEtatJoueur(etatDeriveJoueur(cj)) + '" data-compo-joueur-id="' + escapeHtml(cj.id) + '" data-poste-id="' + escapeHtml(poste.id) + '">' +
        '<span class="slot__num">' + escapeHtml(cj.numero_maillot != null ? cj.numero_maillot : poste.numero_xv || '') + '</span>' +
        '<span class="slot__poste-label">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
        '<span class="slot__joueur">' +
          '<span class="slot__nom">' + escapeHtml(j.nom || '?') + '</span>' +
          '<span class="slot__prenom">' + escapeHtml(j.prenom || '') + '</span>' +
        '</span>' +
        (cj.est_depannage_hors_categorie ? '<span class="slot__warning" title="Joueur hors catégorie M14">⚠</span>' : '') +
        '<span class="slot__etat" title="État du joueur">' + libelleEtatJoueurCourt(etatDeriveJoueur(cj)) + '</span>' +
        '<button class="slot__bench" title="Envoyer au banc" type="button">↓ banc</button>' +
        '<button class="slot__remove" title="Retirer totalement de la compo" type="button">×</button>' +
      '</li>'
    );
  }

  // v3.2 : idem
  function renderSlotRemplacant(numeroMaillot, cj) {
    if (!cj) {
      return (
        '<li class="slot slot--vide slot--remplacant" data-role="remplacant" data-numero-maillot="' + numeroMaillot + '">' +
          '<span class="slot__num">' + numeroMaillot + '</span>' +
          '<span class="slot__poste-label">Remp.</span>' +
          '<span class="slot__add">+ Ajouter</span>' +
        '</li>'
      );
    }
    const j = getJoueurVivier(cj.joueur_id) || {};
    return (
      '<li class="slot slot--occupe slot--remplacant ' + cssClassEtatJoueur(etatDeriveJoueur(cj)) + '" data-compo-joueur-id="' + escapeHtml(cj.id) + '">' +
        '<span class="slot__num">' + escapeHtml(cj.numero_maillot || numeroMaillot) + '</span>' +
        '<span class="slot__poste-label">Remp.</span>' +
        '<span class="slot__joueur">' +
          '<span class="slot__nom">' + escapeHtml(j.nom || '?') + '</span>' +
          '<span class="slot__prenom">' + escapeHtml(j.prenom || '') + '</span>' +
        '</span>' +
        (cj.est_depannage_hors_categorie ? '<span class="slot__warning" title="Joueur hors catégorie M14">⚠</span>' : '') +
        '<span class="slot__etat">' + libelleEtatJoueurCourt(etatDeriveJoueur(cj)) + '</span>' +
        '<button class="slot__remove" title="Retirer ce joueur" type="button">×</button>' +
      '</li>'
    );
  }

  function bindSlotHandlers() {
    document.querySelectorAll('.slot--vide').forEach(function (slot) {
      slot.addEventListener('click', function (e) {
        e.stopPropagation();
        const posteId = slot.dataset.posteId || null;
        const role    = slot.dataset.role || 'titulaire';
        const numero  = slot.dataset.numeroMaillot ? parseInt(slot.dataset.numeroMaillot, 10) : null;
        openPickerForSlot(posteId, role, numero);
      });
    });
    document.querySelectorAll('.slot--occupe .slot__remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const cjId = btn.closest('.slot').dataset.compoJoueurId;
        if (cjId) onRemoveJoueurClick(cjId);
      });
    });
    // v3.19→ fix bug 1 : bouton « ↓ banc » = rétrograder un titulaire au banc
    // (≠ croix × qui le sort totalement de la compo, ex. blessure). Réutilise
    // onDropJoueurSurBanc (passe par le joueur_id, pas le compo_joueur_id).
    document.querySelectorAll('.slot--occupe .slot__bench').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const slot = btn.closest('.slot');
        const cjId = slot.dataset.compoJoueurId;
        const cj = State.compoJoueurs.find(function (x) { return x.id === cjId; });
        if (cj) onDropJoueurSurBanc(cj.joueur_id);
      });
    });
  }

  // ============================================================
  // 6. PANNEAU EFFECTIF
  // ============================================================

  function renderEffectifPanel() {
    const titleEl = DOM.effectifTitle();
    const bodyEl  = DOM.effectifBody();
    if (!bodyEl) return;

    // ────────────────────────────────────────────────────────
    // v3.8 — Dispatch mode U-N3 vs legacy. En legacy, le bloc else
    // est byte-identique au code v3.7 (preuve par diff). En U-N3,
    // mapping différent (Joueurs du groupe / Hors groupe), toggle
    // UN3-3 et visuel orange UN3-4.
    // ────────────────────────────────────────────────────────
    if (State.evenementEquipeId) {
      let vivier = State.vivier;
      if (titleEl) titleEl.textContent = 'Effectif (' + vivier.length + ')';

      if (vivier.length === 0) {
        bodyEl.innerHTML =
          renderToggleHorsGroupeUN3() +
          '<div class="effectif-panel__placeholder"><em>Aucun joueur dans le groupe de base.</em></div>';
        bindToggleHorsGroupeUN3();
        return;
      }

      const placedIds = joueursDejaPlaces();
      const sectionGroupe = { label: 'Joueurs du groupe', items: [] };
      const sectionHors   = { label: 'Hors groupe (dépannage)', items: [] };
      for (const j of vivier) {
        if (j._horsGroupe) sectionHors.items.push(j); else sectionGroupe.items.push(j);
      }
      sectionGroupe.items.sort(compareJoueurs);
      sectionHors.items.sort(compareJoueurs);

      let html = renderToggleHorsGroupeUN3();
      const sections = [sectionGroupe];
      if (sectionHors.items.length > 0) sections.push(sectionHors);
      for (const g of sections) {
        if (g.items.length === 0) continue;
        const isHors = (g === sectionHors);
        html += '<div class="effectif-group">';
        html +=   '<h3 class="effectif-group__title">' + escapeHtml(g.label) +
                  ' <span class="effectif-group__count">(' + g.items.length + ')</span></h3>';
        html +=   '<ul class="effectif-list">';
        for (const j of g.items) {
          const isPlaced = placedIds.has(j.joueur_id);
          const tagHtml = isHors
            ? '<span class="effectif-item__tag effectif-item__tag--renfort" title="Joueur hors du groupe de base (dépannage)">hors groupe</span>'
            : '';
          html += '<li class="effectif-item' + (isPlaced ? ' effectif-item--placed' : '') + (isHors ? ' effectif-item--hors-groupe' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '" title="' + escapeHtml((j.prenom || '') + ' ' + (j.nom || '')) + (isPlaced ? ' — déjà dans la compo' : (isHors ? ' — hors du groupe de base (dépannage)' : '')) + '">';
          html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
          html +=   '<span class="effectif-item__name">';
          html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
          html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
          html +=   '</span>';
          html +=   tagHtml;
          html += '</li>';
        }
        html +=   '</ul>';
        html += '</div>';
      }
      bodyEl.innerHTML = html;
      bindToggleHorsGroupeUN3();

      document.querySelectorAll('.effectif-item').forEach(function (item) {
        if (item.classList.contains('effectif-item--placed')) return;
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          const joueurId = item.dataset.joueurId;
          if (joueurId) openPickerForJoueur(joueurId);
        });
        // v3.18 — drag vers le terrain (geste vivier → poste)
        if (item.dataset.joueurId) {
          item.setAttribute('draggable', 'true');
          item.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/plain', item.dataset.joueurId);
            e.dataTransfer.effectAllowed = 'move';
          });
        }
      });
      return;
    }

    // ────────────────────────────────────────────────────────
    // Mode legacy — code v3.7 BYTE-IDENTIQUE (preuve par diff).
    // ────────────────────────────────────────────────────────
    let vivier = State.vivier;
    if (State.filtreHideSAR) vivier = vivier.filter(j => !j.est_partenaire_entente);
    if (titleEl) titleEl.textContent = 'Effectif (' + vivier.length + ')';

    if (vivier.length === 0) {
      bodyEl.innerHTML = '<div class="effectif-panel__placeholder"><em>Aucun joueur dans le vivier.</em></div>';
      return;
    }

    const placedIds = joueursDejaPlaces();
    const groupes = {
      mom:        { label: 'Réguliers MOM',        items: [] },
      partenaire: { label: 'Partenaires entente',  items: [] },
      renfort:    { label: 'Renforts temporaires', items: [] },
      autre:      { label: 'Non-attachés',         items: [] }
    };
    for (const j of vivier) groupes[groupeJoueur(j)].items.push(j);
    for (const k in groupes) groupes[k].items.sort(compareJoueurs);

    let html = '';
    for (const k of ['mom', 'partenaire', 'renfort', 'autre']) {
      const g = groupes[k];
      if (g.items.length === 0) continue;
      html += '<div class="effectif-group">';
      html +=   '<h3 class="effectif-group__title">' + g.label + ' <span class="effectif-group__count">(' + g.items.length + ')</span></h3>';
      html +=   '<ul class="effectif-list">';
      for (const j of g.items) {
        const isPlaced = placedIds.has(j.joueur_id);
        const etq = etiquetteJoueur(j);
        const tagHtml = etq ? '<span class="effectif-item__tag effectif-item__tag--' + etq.kind + '">' + etq.label + '</span>' : '';
        html += '<li class="effectif-item' + (isPlaced ? ' effectif-item--placed' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '" title="' + escapeHtml((j.prenom || '') + ' ' + (j.nom || '')) + (isPlaced ? ' — déjà dans la compo' : '') + '">';
        html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
        html +=   '<span class="effectif-item__name">';
        html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
        html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
        html +=   '</span>';
        html +=   tagHtml;
        html += '</li>';
      }
      html +=   '</ul>';
      html += '</div>';
    }
    bodyEl.innerHTML = html;

    document.querySelectorAll('.effectif-item').forEach(function (item) {
      if (item.classList.contains('effectif-item--placed')) return;
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        const joueurId = item.dataset.joueurId;
        if (joueurId) openPickerForJoueur(joueurId);
      });
      // v3.18 — drag vers le terrain (geste vivier → poste)
      if (item.dataset.joueurId) {
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', item.dataset.joueurId);
          e.dataTransfer.effectAllowed = 'move';
        });
      }
    });
  }

  // v3.8 — Toggle UN3-3 : « Piocher hors du groupe de base ».
  // Calque exact du pattern existant pour effectif-filter-sar (CSS
  // classes effectif-panel__filter réutilisées). Rendu inline dans
  // le panneau effectif (pas de modif HTML compositions.html).
  // Annonce de la conséquence dans le label : « élargit la pioche
  // au-delà du groupe » → satisfait UX §3 UN3-3.
  function renderToggleHorsGroupeUN3() {
    return (
      '<label class="effectif-panel__filter" style="margin-bottom:8px;">' +
        '<input type="checkbox" id="un3-toggle-hors-groupe"' +
          (State.includeHorsGroupe ? ' checked' : '') + '>' +
        ' Piocher hors du groupe de base ' +
        '<span style="color: var(--ink-mute); font-size: 11px;">' +
          '(dépannage — élargit la pioche au-delà du groupe)' +
        '</span>' +
      '</label>'
    );
  }

  function bindToggleHorsGroupeUN3() {
    const t = document.getElementById('un3-toggle-hors-groupe');
    if (t) t.addEventListener('change', function (e) { toggleIncludeHorsGroupe(e.target.checked); });
  }

  // ============================================================
  // 7. POPOVER PICKER
  // ============================================================

  function openPickerForSlot(posteId, role, numeroMaillot) {
    if (!State.selectedCompoId) return;
    State.popover = { mode: 'slot-vide', posteId: posteId || null, role: role || 'titulaire', numeroMaillot: numeroMaillot || null, search: '' };
    renderPopover();
  }

  function openPickerForJoueur(joueurId) {
    if (!State.selectedCompoId) return;
    State.popover = { mode: 'joueur-vivier', joueurId: joueurId, search: '' };
    renderPopover();
  }

  function closePopover() {
    State.popover = null;
    renderPopover();
  }

  function renderPopover() {
    const root = DOM.popoverRoot();
    if (!root) return;
    if (!State.popover) { root.innerHTML = ''; root.classList.remove('is-open'); return; }

    if (State.popover.mode === 'slot-vide')      root.innerHTML = renderPopoverSlotVide();
    else if (State.popover.mode === 'joueur-vivier') root.innerHTML = renderPopoverJoueurVivier();
    root.classList.add('is-open');
    bindPopoverHandlers();
  }

  // v3.4 : helper extrait pour pouvoir rafraîchir uniquement la liste
  // sans détruire l'input search (évite l'effet "à l'envers")
  // v3.8 : en mode U-N3, le marquage warning bascule de « hors
  // catégorie M14 » (legacy, comparaison categorie_id) à « hors
  // groupe » (U-N3, lecture du flag _horsGroupe). Le mode legacy
  // reste byte-identique (branche else).
  function popoverListItemsSlotVide() {
    const pv = State.popover;
    const search = (pv.search || '').toLowerCase();
    const placedIds = joueursDejaPlaces();
    const candidates = State.vivier
      .filter(j => !placedIds.has(j.joueur_id))
      .filter(j => !search || ((j.nom || '') + ' ' + (j.prenom || '')).toLowerCase().includes(search))
      .sort(compareJoueurs);

    let html = '';

    // v3.19 — section « Remplaçants » : on propose AUSSI les joueurs du banc
    // pour les promouvoir sur ce poste (le clic appelle onPickJoueurPourSlot
    // comme pour le vivier ; addJoueurCompo réaffecte le joueur au poste →
    // il quitte le banc, sa place se libère, banc non recompacté). N'apparaît
    // que pour un poste de titulaire (pas quand on remplit un slot banc).
    if (pv.role === 'titulaire' && pv.posteId) {
      const remps = State.compoJoueurs
        .filter(cj => cj.role === 'remplacant')
        .map(cj => getJoueurVivier(cj.joueur_id))
        .filter(j => j && (!search || ((j.nom || '') + ' ' + (j.prenom || '')).toLowerCase().includes(search)))
        .sort(compareJoueurs);
      if (remps.length > 0) {
        html += '<li class="popover__group-label">Remplaçants (monter au XV)</li>';
        for (const j of remps) {
          html += '<li class="popover__item popover__item--from-bench" data-joueur-id="' + escapeHtml(j.joueur_id) + '">';
          html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
          html +=   '<span class="effectif-item__name">';
          html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
          html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
          html +=   '</span>';
          html +=   '<span class="effectif-item__tag effectif-item__tag--bench" title="Actuellement remplaçant">banc</span>';
          html += '</li>';
        }
        html += '<li class="popover__group-label">Vivier</li>';
      }
    }

    if (candidates.length === 0) {
      html += '<li class="popover__empty">Aucun joueur disponible.</li>';
    } else {
      for (const j of candidates) {
        if (State.evenementEquipeId) {
          // U-N3 : warning = hors du groupe de base (dépannage)
          const horsGroupe = !!j._horsGroupe;
          html += '<li class="popover__item' + (horsGroupe ? ' popover__item--warning' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '">';
          html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
          html +=   '<span class="effectif-item__name">';
          html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
          html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
          html +=   '</span>';
          if (horsGroupe) {
            html += '<span class="effectif-item__tag effectif-item__tag--renfort" title="Joueur hors du groupe de base">hors groupe</span>';
            html += '<span class="popover__warning" title="Hors du groupe de base (dépannage)">⚠</span>';
          }
          html += '</li>';
        } else {
          // Legacy : warning = hors catégorie M14 (byte-identique v3.7)
          const horsCat = j.categorie_id !== M14_CATEGORIE_ID;
          const etq = etiquetteJoueur(j);
          const tagHtml = etq ? '<span class="effectif-item__tag effectif-item__tag--' + etq.kind + '">' + etq.label + '</span>' : '';
          html += '<li class="popover__item' + (horsCat ? ' popover__item--warning' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '">';
          html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
          html +=   '<span class="effectif-item__name">';
          html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
          html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
          html +=   '</span>';
          html +=   tagHtml;
          if (horsCat) html += '<span class="popover__warning" title="Hors catégorie M14 (dépannage)">⚠</span>';
          html += '</li>';
        }
      }
    }
    return html;
  }

  function renderPopoverSlotVide() {
    const pv = State.popover;
    let titre;
    if (pv.role === 'titulaire' && pv.posteId) {
      const poste = getPoste(pv.posteId);
      titre = poste ? ('Poste ' + poste.numero_xv + ' — ' + (poste.libelle_long || poste.libelle_court)) : 'Poste inconnu';
    } else {
      titre = 'Remplaçant n°' + (pv.numeroMaillot || '?');
    }

    let html = '<div class="popover" role="dialog" aria-label="Choisir un joueur">';
    html +=   '<div class="popover__header">';
    html +=     '<h3 class="popover__title">' + escapeHtml(titre) + '</h3>';
    html +=     '<button type="button" class="popover__close" data-action="close" aria-label="Fermer">×</button>';
    html +=   '</div>';
    html +=   '<div class="popover__search">';
    html +=     '<input type="text" class="popover__input" id="popover-search" placeholder="Rechercher un joueur…" value="' + escapeHtml(pv.search || '') + '" autocomplete="off">';
    html +=   '</div>';
    html +=   '<ul class="popover__list">';
    html +=     popoverListItemsSlotVide();
    html +=   '</ul>';
    html += '</div>';
    return html;
  }

  // v3.4 : helper extrait pour rafraîchissement ciblé (cf slot-vide)
  function popoverListItemsJoueurVivier() {
    const pv = State.popover;
    const search = (pv.search || '').toLowerCase();
    const postesLibres = postesVides().filter(p =>
      !search || (((p.libelle_long || '') + ' ' + (p.libelle_court || '') + ' ' + (p.code || '')).toLowerCase().includes(search))
    );

    let html = '';
    if (postesLibres.length === 0) {
      html += '<li class="popover__empty">Tous les postes XV sont déjà occupés.</li>';
    } else {
      for (const p of postesLibres) {
        html += '<li class="popover__item popover__item--poste" data-poste-id="' + escapeHtml(p.id) + '">';
        html +=   '<span class="slot__num">' + escapeHtml(p.numero_xv) + '</span>';
        html +=   '<span class="popover__poste-libelle">' + escapeHtml(p.libelle_long || p.libelle_court) + '</span>';
        html += '</li>';
      }
    }
    html += '<li class="popover__item popover__item--remp" data-mode="remplacant">';
    html +=   '<span class="slot__num">R</span>';
    html +=   '<span class="popover__poste-libelle">→ Mettre dans les remplaçants</span>';
    html += '</li>';
    return html;
  }

  function renderPopoverJoueurVivier() {
    const pv = State.popover;
    const joueur = getJoueurVivier(pv.joueurId);
    if (!joueur) return '';

    let html = '<div class="popover" role="dialog" aria-label="Affecter à un poste">';
    html +=   '<div class="popover__header">';
    html +=     '<h3 class="popover__title">' + escapeHtml((joueur.nom || '') + ' ' + (joueur.prenom || '')) + '</h3>';
    html +=     '<button type="button" class="popover__close" data-action="close" aria-label="Fermer">×</button>';
    html +=   '</div>';
    html +=   '<p class="popover__subtitle">Choisir un poste libre ou la zone des remplaçants.</p>';
    html +=   '<div class="popover__search">';
    html +=     '<input type="text" class="popover__input" id="popover-search" placeholder="Rechercher un poste…" value="' + escapeHtml(pv.search || '') + '" autocomplete="off">';
    html +=   '</div>';
    html +=   '<ul class="popover__list">';
    html +=     popoverListItemsJoueurVivier();
    html +=   '</ul>';
    html += '</div>';
    return html;
  }

  function bindPopoverHandlers() {
    const root = DOM.popoverRoot();
    if (!root) return;

    root.querySelectorAll('[data-action="close"]').forEach(el =>
      el.addEventListener('click', function (e) { e.stopPropagation(); closePopover(); })
    );

    const input = root.querySelector('#popover-search');
    if (input) {
      input.focus();
      // v3.4 : ne pas re-render tout le popover à chaque frappe, sinon
      // l'input est détruit/recréé et le curseur retourne en position 0
      // (effet "à l'envers" : 'obi' devient 'ibo'). On rafraîchit
      // uniquement la liste de résultats.
      input.addEventListener('input', function (e) {
        if (State.popover) State.popover.search = e.target.value;
        refreshPopoverList();
      });
    }

    if (State.popover && State.popover.mode === 'slot-vide') {
      root.querySelectorAll('.popover__item[data-joueur-id]').forEach(function (li) {
        li.addEventListener('click', function (e) {
          e.stopPropagation();
          const joueurId = li.dataset.joueurId;
          // v3.19→ fix : un joueur DÉJÀ dans la compo (remplaçant promu, classe
          // --from-bench) ne peut pas passer par onPickJoueurPourSlot (INSERT →
          // viole l'unicité). On le promeut via onDropJoueurSurPoste qui gère
          // existant→updateJoueurCompo. Les joueurs du vivier (nouveaux) gardent
          // le chemin add historique (onPickJoueurPourSlot, byte-identique).
          if (li.classList.contains('popover__item--from-bench')) {
            const posteId = State.popover && State.popover.posteId;
            closePopover();
            if (posteId) onDropJoueurSurPoste(joueurId, posteId);
          } else {
            onPickJoueurPourSlot(joueurId);
          }
        });
      });
    } else if (State.popover && State.popover.mode === 'joueur-vivier') {
      root.querySelectorAll('.popover__item[data-poste-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(li.dataset.posteId); })
      );
      const rempEl = root.querySelector('.popover__item--remp');
      if (rempEl) rempEl.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(null); });
    }
  }

  function bindPopoverOutsideClick() {
    document.addEventListener('click', function (e) {
      const root = DOM.popoverRoot();
      if (!State.popover || !root) return;
      if (root.contains(e.target)) return;
      closePopover();
    });
  }

  // v3.4 : rafraîchir uniquement la liste de résultats sans toucher
  // à l'input de recherche. Évite que le curseur retourne en position 0
  // à chaque frappe ("obi" devenait "ibo").
  function refreshPopoverList() {
    const root = DOM.popoverRoot();
    if (!root || !State.popover) return;
    const ul = root.querySelector('.popover__list');
    if (!ul) return;

    if (State.popover.mode === 'slot-vide') {
      ul.innerHTML = popoverListItemsSlotVide();
      ul.querySelectorAll('.popover__item[data-joueur-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickJoueurPourSlot(li.dataset.joueurId); })
      );
    } else if (State.popover.mode === 'joueur-vivier') {
      ul.innerHTML = popoverListItemsJoueurVivier();
      ul.querySelectorAll('.popover__item[data-poste-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(li.dataset.posteId); })
      );
      const rempEl = ul.querySelector('.popover__item--remp');
      if (rempEl) rempEl.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(null); });
    }
  }

  // ============================================================
  // 8. ACTIONS
  // ============================================================

  async function selectEvenement(evtId) {
    State.selectedEvenementId = evtId;
    State.compos = [];
    State.selectedCompoId = null;
    State.compoJoueurs = [];
    closePopover();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();

    await loadComposForCurrentEvent();
    if (State.selectedCompoId) await loadCompoJoueurs();

    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function selectCompo(compoId) {
    State.selectedCompoId = compoId;
    State.compoJoueurs = [];
    closePopover();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();

    await loadCompoJoueurs();

    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  function toggleEventSelector() {
    const list = DOM.eventSelectorList();
    if (list) list.classList.toggle('is-open');
  }
  function closeEventSelector() {
    const list = DOM.eventSelectorList();
    if (list) list.classList.remove('is-open');
  }
  function toggleFiltreSAR(checked) {
    State.filtreHideSAR = !!checked;
    renderEffectifPanel();
  }

  // v3.8 — Toggle UN3-3 : élargit la pioche au hors-groupe. Recharge
  // le vivier (chemin loadVivier U-N3 lit listJoueursCategorieEntente
  // si State.includeHorsGroupe, sinon listGroupeEngage seul). Le
  // refresh complet effectif + slots est nécessaire car la pioche
  // disponible change.
  async function toggleIncludeHorsGroupe(checked) {
    State.includeHorsGroupe = !!checked;
    await loadVivier();
    renderEffectifPanel();
  }

  async function onCreateBaseClick() {
    if (!State.selectedEvenementId) return;
    // v3.9 — Garde anti-concurrence : si la fonction est déjà en
    // cours d'exécution (double-clic, re-render concurrent), on
    // sort immédiatement. Plus robuste que btn.disabled seul (qui
    // peut être contourné par 2 clics avant propagation DOM ou par
    // un re-render du bouton entre les deux clics).
    if (State.isCreatingBase) return;
    State.isCreatingBase = true;

    const btn = document.getElementById('btn-create-base');
    if (btn) { btn.disabled = true; btn.textContent = 'Création en cours…'; }

    try {
      // v3.8 — en mode U-N3, on propage evenement_equipe_id à la
      // base créée (Q4a actée : geste explicite via CTA existant +
      // option A Q1a : seule la base porte le lien équipe engagée).
      // createCompo v1.27 accepte le paramètre additif (rétro-compat
      // stricte : absent = comportement legacy, NULL en base).
      const params = { evenement_id: State.selectedEvenementId, type_compo: 'base' };
      if (State.evenementEquipeId) {
        params.evenement_equipe_id = State.evenementEquipeId;
      }
      const r = await SupabaseHub.createCompo(params);
      if (!r.ok) {
        alert('Erreur création compo de base : ' + r.error);
        if (btn) { btn.disabled = false; btn.textContent = 'Créer la compo de base'; }
        return;
      }
      await loadComposForCurrentEvent();
      State.selectedCompoId = r.data.id;
      await loadCompoJoueurs();
      renderEventBanner();
      renderCompoTabs();
      renderFillIndicator();
      renderEditorArea();
      renderEffectifPanel();
    } finally {
      // v3.9 — Garde toujours relâchée, même en cas d'erreur ou
      // exception. Indispensable pour permettre une nouvelle
      // tentative si la 1ʳᵉ a échoué pour une raison légitime
      // (réseau, conflit base, etc.).
      State.isCreatingBase = false;
    }
  }

  // v3.12 (6c-6) — Crée une compo de MATCH par duplication de la base.
  //   matchId fourni  → compo rattachée à ce match (evenement_id = matchId,
  //                     option α). Cas onglet « à faire ».
  //   matchId === null → compo « libre » (brouillon) rattachée à la racine
  //                     (bouton « + »). Pas de match précis.
  // Garde anti-double-clic (State.isCreatingMatch + try/finally), patron
  // identique à onCreateBaseClick. Après succès : recharge, sélectionne la
  // nouvelle compo, re-rend.
  async function onCreateMatchCompo(matchId) {
    if (State.isCreatingMatch) return;
    const base = State.compos.find(c => c.type_compo === 'base');
    if (!base) { alert('Crée d\'abord la compo de base.'); return; }
    // Si ce match a DÉJÀ une compo, on l'ouvre au lieu d'en recréer une.
    if (matchId) {
      const existante = State.compos.find(
        c => c.type_compo === 'match' && c.evenement_id === matchId
      );
      if (existante) { selectCompo(existante.id); return; }
    }
    State.isCreatingMatch = true;
    try {
      // evenement_id de la nouvelle compo : le match (α) ou la racine (libre).
      const cibleEvenementId = matchId || State.selectedEvenementId;
      const r = await SupabaseHub.duplicateCompoFromBase(base.id, cibleEvenementId);
      if (!r || !r.ok) {
        alert('Erreur création compo de match : ' + ((r && r.error) || 'inconnue'));
        return;
      }
      await loadComposForCurrentEvent();
      const newId = r.data && r.data.compo && r.data.compo.id;
      if (newId) State.selectedCompoId = newId;
      await loadCompoJoueurs();
      renderEventBanner();
      renderCompoTabs();
      renderFillIndicator();
      renderEditorArea();
      renderEffectifPanel();
    } finally {
      State.isCreatingMatch = false;
    }
  }

  async function onPickJoueurPourSlot(joueurId) {
    const pv = State.popover;
    if (!pv) return;
    const joueur = getJoueurVivier(joueurId);
    if (!joueur) return;

    // v3.8 — en mode U-N3, est_depannage_hors_categorie reflète
    // « hors du groupe de base » (UN3-4, expose le champ EXISTANT
    // sql/18, non inventé). En legacy, comportement v3.7 préservé
    // (comparaison categorie_id).
    const horsCat = State.evenementEquipeId
      ? !!joueur._horsGroupe
      : (joueur.categorie_id !== M14_CATEGORIE_ID);
    const params = {
      composition_id: State.selectedCompoId,
      joueur_id: joueurId,
      role: pv.role || 'titulaire',
      etat_joueur: etatJoueurPourCompoCourante(),
      est_depannage_hors_categorie: horsCat
    };
    if (pv.role === 'titulaire' && pv.posteId) {
      params.poste_id = pv.posteId;
      const p = getPoste(pv.posteId);
      if (p && p.numero_xv) params.numero_maillot = p.numero_xv;
    } else if (pv.role === 'remplacant') {
      const libres = postesVides();
      params.poste_id = libres.length > 0 ? libres[0].id : (State.postes[0] && State.postes[0].id);
      params.numero_maillot = pv.numeroMaillot || 16;
    }

    if (!params.poste_id) {
      alert('Erreur interne : aucun poste disponible en base. Vérifie le chargement du référentiel postes.');
      return;
    }

    const r = await SupabaseHub.addJoueurCompo(params);
    if (!r.ok) { alert('Erreur ajout joueur : ' + r.error); return; }
    closePopover();
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onPickPostePourJoueur(posteId) {
    const pv = State.popover;
    if (!pv) return;
    const joueur = getJoueurVivier(pv.joueurId);
    if (!joueur) return;

    // v3.8 — idem onPickJoueurPourSlot ci-dessus : bascule par mode.
    const horsCat = State.evenementEquipeId
      ? !!joueur._horsGroupe
      : (joueur.categorie_id !== M14_CATEGORIE_ID);
    const params = {
      composition_id: State.selectedCompoId,
      joueur_id: pv.joueurId,
      etat_joueur: etatJoueurPourCompoCourante(),
      est_depannage_hors_categorie: horsCat
    };
    if (posteId) {
      params.role = 'titulaire';
      params.poste_id = posteId;
      const p = getPoste(posteId);
      if (p && p.numero_xv) params.numero_maillot = p.numero_xv;
    } else {
      const remp = State.compoJoueurs.filter(cj => cj.role === 'remplacant');
      const usedNums = new Set(remp.map(cj => cj.numero_maillot).filter(Boolean));
      let nextNum = 16;
      while (usedNums.has(nextNum) && nextNum <= 23) nextNum++;
      params.role = 'remplacant';
      params.numero_maillot = nextNum <= 23 ? nextNum : null;
      const libres = postesVides();
      params.poste_id = libres.length > 0 ? libres[0].id : (State.postes[0] && State.postes[0].id);
    }

    if (!params.poste_id) {
      alert('Erreur interne : aucun poste disponible en base. Vérifie le chargement du référentiel postes.');
      return;
    }

    const r = await SupabaseHub.addJoueurCompo(params);
    if (!r.ok) { alert('Erreur ajout joueur : ' + r.error); return; }
    closePopover();
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onRemoveJoueurClick(compoJoueurId) {
    const r = await SupabaseHub.removeJoueurCompo(compoJoueurId);
    if (!r.ok) { alert('Erreur retrait : ' + r.error); return; }
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  // Validation / dé-validation de la compo de base.
  // Le garde-fou d'état est porté par le serveur (validateCompo/
  // unvalidateCompo : .eq('etat',...)), on remonte juste son message.
  async function onValidateCompoClick(compoId) {
    if (!compoId) return;
    const r = await SupabaseHub.validateCompo(compoId);
    if (!r.ok) { alert('Validation impossible : ' + r.error); return; }
    await loadComposForCurrentEvent();
    if (State.selectedCompoId) await loadCompoJoueurs();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onUnvalidateCompoClick(compoId) {
    if (!compoId) return;
    if (!window.confirm('Repasser cette compo en brouillon ? Elle ne sera plus considérée comme validée.')) return;
    const r = await SupabaseHub.unvalidateCompo(compoId);
    if (!r.ok) { alert('Action impossible : ' + r.error); return; }
    await loadComposForCurrentEvent();
    if (State.selectedCompoId) await loadCompoJoueurs();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  // ============================================================
  // 9. CHARGEMENTS
  // ============================================================

  async function loadEvenements() {
    // v3.8 — En mode U-N3, l'évènement est fixé par l'URL et résolu
    // via getEvenementEquipeContext (1 seul evt, pas un listing).
    // En legacy : byte-identique v3.7 (listing 60 jours pour M14).
    if (State.evenementEquipeId) {
      const ctx = await SupabaseHub.getEvenementEquipeContext(State.evenementEquipeId);
      if (!ctx || !ctx.ok) {
        console.error('MOM Hub: loadEvenements() U-N3 — contexte introuvable', ctx && ctx.error);
        State.evenements = [];
        State.evenementEquipeContext = null;
        return State.evenements;
      }
      State.evenementEquipeContext = ctx.data;
      const evt = ctx.data.evenement || null;
      State.evenements = evt ? [{
        id: evt.id,
        code: evt.code,
        libelle: evt.libelle,
        date_debut: evt.date_debut,
        type_evenement: evt.type_evenement
      }] : [];
      return State.evenements;
    }
    State.evenements = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, 60);
    return State.evenements;
  }
  async function loadComposForCurrentEvent() {
    if (!State.selectedEvenementId) { State.compos = []; return; }
    // v3.8 — En mode U-N3 : compos rattachées à l'équipe engagée
    // courante. Lecture en 2 temps cohérente Q1a (matchs ne portent
    // pas evenement_equipe_id, dérivent via compo_base_origine_id) :
    //   1) getCompoForEvenementEquipe → base de cette équipe engagée
    //   2) listCompositionsByEquipe → matchs filtrés par
    //      compo_base_origine_id === base.id
    // En legacy : code v3.7 byte-identique (listCompositionsByEquipe
    // sur M14_TEAM_UUID, filtre par evenement_id).
    if (State.evenementEquipeId) {
      const liesAEquipe = await SupabaseHub.getCompoForEvenementEquipe(State.evenementEquipeId);
      // base = type_compo='base' (peut être 0 ou 1 ; sql/50 garantit
      // au plus 1 active par (evt, equipe engagée, cote))
      const base = (liesAEquipe || []).find(c => c.type_compo === 'base') || null;
      if (!base) {
        State.compos = [];
        State.selectedCompoId = null;
        State.matchsDeLequipe = [];
        return;
      }
      // v3.12 (6c-6) — charge les MATCHS de cette équipe dans le tournoi
      // (pour les onglets). Racine = evenement de la base ; equipe via ctx.
      const racineId = State.selectedEvenementId;
      const equipeId = State.evenementEquipeContext
                    && State.evenementEquipeContext.equipe
                    && State.evenementEquipeContext.equipe.id;
      State.matchsDeLequipe = (racineId && equipeId)
        ? await SupabaseHub.listMatchsDeLequipe(racineId, equipeId)
        : [];
      // v3.12 (6c-6, option α) — les compos de MATCH dérivées de cette base
      // sont reconnues par compo_base_origine_id === base.id (lien robuste).
      // Leur evenement_id pointe vers le MATCH (plus la racine) → on NE filtre
      // PLUS par evenement_id === racine (ancien filtre v3.8 devenu faux en α).
      // v3.24 — FIX multi-équipes : les feuilles de match portent
      // l'evenement_id du MATCH (equipe_id = équipe ENGAGÉE, ≠ M14), donc
      // listCompositionsByEquipe(M14) les excluait via sa jointure
      // evenements!inner sur equipe_id (bug : onglet match affiché « à faire »
      // alors que la compo existe → re-création → 409 contrainte unique).
      // On lit désormais les matchs par compo_base_origine_id (lien robuste).
      const matchsDeLaBase = await SupabaseHub.listMatchsParBaseOrigine(base.id);
      State.compos = [base].concat(matchsDeLaBase);
      State.selectedCompoId = base.id;
      return;
    }
    const all = await SupabaseHub.listCompositionsByEquipe(M14_TEAM_UUID);
    State.compos = all.filter(c => c.evenement_id === State.selectedEvenementId);
    const compoBase = State.compos.find(c => c.type_compo === 'base');
    if (compoBase)                       State.selectedCompoId = compoBase.id;
    else if (State.compos.length > 0)    State.selectedCompoId = State.compos[0].id;
    else                                 State.selectedCompoId = null;
  }
  async function loadCompoJoueurs() {
    if (!State.selectedCompoId) { State.compoJoueurs = []; State.baseJoueurs = []; return; }
    const complet = await SupabaseHub.getCompoComplete(State.selectedCompoId);
    State.compoJoueurs = complet ? complet.joueurs : [];
    // v3.21 — pour dériver l'état (base/modifié) par comparaison, on charge
    // aussi les joueurs de la compo de BASE quand la compo courante est un
    // match. Indexés par poste pour comparaison rapide. Pour la base elle-même
    // (ou hors contexte), baseJoueurs reste vide (pas de comparaison).
    const compoCourante = State.compos.find(c => c.id === State.selectedCompoId);
    if (compoCourante && compoCourante.type_compo === 'match') {
      const base = State.compos.find(c => c.type_compo === 'base');
      if (base) {
        const baseComplet = await SupabaseHub.getCompoComplete(base.id);
        State.baseJoueurs = baseComplet ? baseComplet.joueurs : [];
      } else {
        State.baseJoueurs = [];
      }
    } else {
      State.baseJoueurs = [];
    }
  }
  async function loadVivier() {
    // v3.8 — En mode U-N3, la pioche = groupe N2 de l'équipe engagée
    // (UN3-1), avec filtre role='joueur' (UN3-6, le staff ne joue
    // pas). Toggle UN3-3 : si State.includeHorsGroupe, on élargit
    // via listJoueursCategorieEntente (pioche élargie au collectif
    // de la catégorie), avec marquage _horsGroupe sur les joueurs
    // qui ne sont PAS dans le groupe N2. Normalisation vers la forme
    // legacy {joueur_id, nom, prenom, categorie_id, ...} pour rester
    // compatible avec les helpers de rendu existants (getJoueurVivier,
    // renderSlotPoste etc. — qui lisent .joueur_id et .nom/.prenom).
    // En legacy : code v3.7 byte-identique (getVivierCompo M14).
    if (State.evenementEquipeId) {
      const ctx = State.evenementEquipeContext;
      const ententeId = ctx && ctx.entente ? ctx.entente.id : null;
      const categorieId = ctx && ctx.entente ? ctx.entente.categorie_id : null;

      // Pioche N2 (groupe convoqué)
      const groupe = await SupabaseHub.listGroupeEngage(State.evenementEquipeId);
      const groupeJoueurs = (groupe || []).filter(
        m => m.collectif_membre && m.collectif_membre.role === 'joueur'
      );
      State.groupeIds = new Set();
      const vivier = groupeJoueurs.map(function (m) {
        const cm = m.collectif_membre;
        const personnes = cm.personnes || {};
        State.groupeIds.add(cm.personne_id);
        return {
          joueur_id: cm.personne_id,
          nom: personnes.nom || '',
          prenom: personnes.prenom || '',
          categorie_id: categorieId,
          _horsGroupe: false
        };
      });

      // Pioche élargie si toggle UN3-3 actif
      if (State.includeHorsGroupe && ententeId) {
        const elargi = await SupabaseHub.listJoueursCategorieEntente(ententeId);
        for (const j of (elargi || [])) {
          if (!State.groupeIds.has(j.personne_id)) {
            vivier.push({
              joueur_id: j.personne_id,
              nom: j.nom || '',
              prenom: j.prenom || '',
              categorie_id: categorieId,
              _horsGroupe: true
            });
          }
        }
      }

      State.vivier = vivier;
      State.vivierById = new Map();
      for (const j of State.vivier) State.vivierById.set(j.joueur_id, j);
      return State.vivier;
    }
    State.vivier = await SupabaseHub.getVivierCompo(M14_TEAM_UUID);
    State.vivierById = new Map();
    for (const j of State.vivier) State.vivierById.set(j.joueur_id, j);
    return State.vivier;
  }
  async function loadPostes() {
    const all = await SupabaseHub.getPostes();
    // v3.7 — n'expose QUE les vrais postes de terrain. Les lignes
    // est_regroupement=true (PIL/2L/3L/CTR/AIL) sont des regroupements
    // tactiques de substitution, jamais des positions de jeu : exclues
    // du référentiel de slots. Source : dump table postes (20 lignes =
    // 15 est_regroupement=false + 5 true). Corrige le rendu de 20 slots
    // titulaires au lieu de 15. Prédicat défensif (!truthy) : seules les
    // lignes explicitement regroupement sont retirées.
    State.postes = (all || [])
      .filter(p => !p.est_regroupement)
      .sort((a, b) => (a.numero_xv || 99) - (b.numero_xv || 99));
    State.postesById = new Map();
    for (const p of State.postes) State.postesById.set(p.id, p);
    return State.postes;
  }

  // ============================================================
  // 10. INIT
  // ============================================================

  async function init() {
    // v3.8 — Lecture URL ?evenement_equipe=<uuid> au boot (SD-1
    // actée 20/05). Param absent = mode legacy (M14 hard-codé,
    // chemins v3.7 byte-identiques). Param présent = mode U-N3.
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('evenement_equipe');
      if (raw && raw.trim()) State.evenementEquipeId = raw.trim();
    } catch (_) { /* SSR ou contexte sans window — laisser null */ }

    await Promise.all([ loadEvenements(), loadVivier(), loadPostes() ]);

    if (State.evenements.length > 0) {
      State.selectedEvenementId = State.evenements[0].id;
      await loadComposForCurrentEvent();
      if (State.selectedCompoId) await loadCompoJoueurs();
    }

    renderEventBanner();
    renderEventSelector();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
    renderPopover();
    bindViewTabs(); // v3.15 — câble les onglets Liste/Terrain (statiques, 1 fois)
    bindExportImage(); // v3.23 — câble le bouton « Image » (export réseaux sociaux)

    // v3.25 — Deep-link de mode depuis la fiche évènement : ?vue=terrain
    // ouvre directement la vue Terrain ; ?vue=reseaux ouvre la modale
    // d'export image. Les vignettes « Vue terrain » / « Vue réseaux
    // sociaux » de la fiche évènement (evenements-browser.js) pointent
    // vers compositions.html?evenement_equipe=<id>&vue=<terrain|reseaux>.
    // La compo courante est déjà chargée à ce stade (loadCompoJoueurs
    // ci-dessus) ; si aucune compo n'existe encore, terrain s'affiche
    // vide et l'export prévient « aucune composition » (dégradation
    // honnête, décision Manu).
    try {
      const vue = new URLSearchParams(window.location.search).get('vue');
      if (vue === 'terrain') {
        State.viewMode = 'terrain';
        renderEditorArea();
        const tabs = document.querySelectorAll('.view-tabs__tab');
        if (tabs && tabs.length >= 2) {
          tabs.forEach(function (t) { t.classList.remove('is-active'); });
          tabs[1].classList.add('is-active');
        }
      } else if (vue === 'reseaux') {
        const btnImg = document.getElementById('btn-export-image');
        if (btnImg) btnImg.click();
      }
    } catch (_) { /* contexte sans window — ignorer */ }

    // v3.8 — A1 : en mode U-N3, l'évènement est fixé par l'URL ;
    // le sélecteur d'évènements n'a pas de sens (retour à la fiche
    // évènement pour changer). On COUPE son handler (plus de toggle).
    // v3.14 (P2) — mais on NE masque plus le bouton : il porte le
    // titre + le type + le lieu de l'évènement (event-type / event-label
    // / event-meta sont ses enfants). Le masquer (display:none, ancien
    // v3.8) effaçait toute référence à l'évènement quand on arrivait
    // depuis un évènement (« aucune réf »). On le rend STATIQUE (classe
    // --static : pas de ▾, pas de hover, curseur normal) → le titre
    // reste visible, le bouton n'agit plus. En legacy : comportement
    // v3.7 byte-identique (handler de toggle attaché, pas de classe).
    const selBtn = DOM.eventSelectorBtn();
    if (State.evenementEquipeId) {
      if (selBtn) selBtn.classList.add('event-banner__btn--static');
    } else {
      if (selBtn) selBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleEventSelector(); });
    }

    const filterEl = DOM.effectifFilter();
    if (filterEl) filterEl.addEventListener('change', function (e) { toggleFiltreSAR(e.target.checked); });

    document.addEventListener('click', function (e) {
      const list = DOM.eventSelectorList();
      const btn = DOM.eventSelectorBtn();
      if (!list || !list.classList.contains('is-open')) return;
      if (e.target === btn || (btn && btn.contains(e.target))) return;
      if (list.contains(e.target)) return;
      closeEventSelector();
    });

    bindPopoverOutsideClick();

    console.log(
      '%c🏉 Compositions Editor v3.49 chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        evenements: State.evenements.length,
        vivier: State.vivier.length,
        postes: State.postes.length,
        compos: State.compos.length,
        compoJoueurs: State.compoJoueurs.length
      }
    );
  }

  window.CompositionsEditor = {
    init: init,
    state: State,
    loadEvenements: loadEvenements,
    loadComposForCurrentEvent: loadComposForCurrentEvent,
    loadCompoJoueurs: loadCompoJoueurs,
    loadVivier: loadVivier,
    loadPostes: loadPostes
  };

})();
