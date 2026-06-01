/**
 * MOM Hub · Compositions Editor
 * ============================================================
 *
 * Phase 4.4 — Construit progressivement :
 *   - 6a/6b/6c-1 : déjà livrés (squelette, navigation, vivier)
 *   - 6c-2/6c-3 : Vue Liste éditable + Popover Picker (CETTE VERSION)
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
 *           Logos chargés depuis img/ (ecusson-mom.png, logo-entente.png).
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
      const eqLabel = State.evenementEquipeContext.equipe.libelle_court ||
                      State.evenementEquipeContext.equipe.nom_officiel ||
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
  // v3.15 (Vue Terrain, étape A) — câblage des onglets Liste/Terrain
  // ════════════════════════════════════════════════════════════
  // Les onglets sont statiques dans compositions.html (jamais
  // régénérés) → câblage unique au boot. Clic = set viewMode +
  // is-active + re-rendu de l'éditeur. Le HTML retire le is-active
  // codé en dur (piloté ici). Robuste si les boutons sont absents.
  function bindViewTabs() {
    const tabs = document.querySelectorAll('.view-tabs__tab');
    if (!tabs || tabs.length < 2) return;
    const setMode = function (mode, clickedTab) {
      State.viewMode = mode;
      tabs.forEach(function (t) { t.classList.remove('is-active'); });
      clickedTab.classList.add('is-active');
      renderEditorArea();
    };
    // Convention HTML : 1er onglet = Liste, 2e = Terrain.
    tabs[0].addEventListener('click', function () { setMode('liste', tabs[0]); });
    tabs[1].addEventListener('click', function () { setMode('terrain', tabs[1]); });
    // État initial cohérent avec State.viewMode (défaut 'liste').
    tabs.forEach(function (t) { t.classList.remove('is-active'); });
    (State.viewMode === 'terrain' ? tabs[1] : tabs[0]).classList.add('is-active');
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
        mom: 'img/ecusson-mom.png',
        entente: 'img/logo-entente.png'
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

    let html = '<div class="view-terrain" aria-label="Vue terrain de la composition (lecture seule)">';
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
      const all = await SupabaseHub.listCompositionsByEquipe(M14_TEAM_UUID);
      const matchsDeLaBase = (all || []).filter(
        c => c.type_compo === 'match' &&
             c.compo_base_origine_id === base.id
      );
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
      '%c🏉 Compositions Editor v3.23 chargé',
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
