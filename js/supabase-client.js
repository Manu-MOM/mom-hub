/**
 * MOM Hub · Supabase Client
 * =========================
 *
 * Wrapper léger pour parler à Supabase depuis le Hub.
 *
 * USAGE depuis une page HTML :
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="js/supabase-client.js"></script>
 *   <script>
 *     SupabaseHub.getPoles().then(poles => console.log(poles));
 *   </script>
 *
 * NOTE DE SÉCURITÉ :
 *   La clé anon ci-dessous est PUBLIQUE par design.
 *   Elle n'autorise que ce que les policies RLS Supabase permettent.
 *   Pour l'accès aux données sensibles, l'utilisateur doit s'authentifier
 *   via Magic Link (Phase 2.5).
 *
 * Version : 1.80 — juillet 2026
 *   v1.80 : EDITION-EMAIL-FICHE (FAIT FOI gelé 10/07/2026). Wrapper ADDITIF
 *          majIdentiteFiche(personneId, patch) → RPC sql_196
 *          maj_identite_fiche() : canal identité e-mail réservé bureau/admin
 *          (email_principal / email_secondaire), même pattern de retour que
 *          updateJoueurMetier. Débloque la saisie d'e-mail des fiches sans
 *          adresse (39 M14 sondés). Aucune ligne existante touchée.
 *          node --check OK.
 *   v1.79 : REFONTE-ENROLEMENT (FAIT FOI gelé 10/07/2026, pt 193).
 *          Wrapper ADDITIF listMesFichesParEmail() → RPC sql_194
 *          list_mes_fiches_par_email() : résolution email→fiche(s) du
 *          compte connecté (Niveau strict), pioche de la modale
 *          « Qui êtes-vous ? » en remplacement de listFichesEnrolables().
 *          Miroir exact du wrapper existant (mapping personne_id/nom/prenom,
 *          dégradation honnête []). Aucune ligne existante touchée.
 *          node --check OK. (console.log boot NON touché — décalage
 *          header/boot préexistant, hors périmètre.)
 *   v1.78 : COMPO-RATTACHEMENT-CATEGORIE (D3 option a — pur front).
 *          Wrapper ADDITIF listCompositionsByCategorie(categorieId) :
 *          voie CATÉGORIE du listing compos (jointure evenements!inner
 *          sur categorie_id). Couvre les compos d'évènements rattachés-
 *          catégorie (equipe_id NULL, post-pt 169) que la jointure
 *          equipe_id de listCompositionsByEquipe excluait (H1 confirmée
 *          en base le 09/07 : 5 compos actives invisibles). Policies
 *          SELECT authenticated inchangées (relues pg_policies), ZÉRO
 *          SQL. listCompositionsByEquipe et getVivierCompo CONSERVÉS
 *          intacts mais DÉPRÉCIÉS (plus aucun consommateur après la
 *          bascule de compositions-editor.js v3.68 — D5).
 *   v1.77 : LOGISTIQUE-MULTI-CATEGORIES (FAIT FOI gelé 05/07/2026).
 *           3 mappings ADDITIFS p_categorie_ids (uuid[]) sur les wrappers
 *           modifierReservation / modifierRecurrence / modifierBus, alignés
 *           sur les signatures sql_157 (paramètre final DEFAULT NULL —
 *           null transmis = tableau dérivé du scalaire côté SQL, M4).
 *           create* INCHANGÉS dans leur code (INSERT PostgREST tel quel :
 *           categorie_ids / responsables_personne_ids passent dans le
 *           payload, trigger T1 sql_156 synchronise) — seuls les @param
 *           documentent les nouveaux champs. ANOMALIE TRACÉE : le boot
 *           v1.76 affichait encore « v1.75 chargé » (bump annoncé au
 *           changelog v1.76 mais non appliqué) — corrigé ici, boot → v1.77.
 *           node --check OK.
 *
 *   v1.76 : LOGISTIQUE-EXCEPTIONS-RECURRENCE (FAIT FOI gelé 05/07/2026).
 *           2 wrappers ADDITIFS vers les RPC sql_155 :
 *           exclureOccurrence(id, date) / reinclureOccurrence(id, date)
 *           (colonne dates_exclues SEULE écrite — E4 ; la règle ne
 *           repasse PAS en pending — E3, dérogation tracée à B2).
 *           node --check OK. boot v1.75 → v1.76.
 *
 *   v1.75 : CATEGORIE-SECTION-RUGBY (FAIT FOI gelé 05/07/2026, md5
 *           b67f451d + ADDENDUM 1). 2 wrappers ADDITIFS vers les RPC
 *           sql_154 : getJoueursSection() (jumelle de getJoueursF15,
 *           RPC get_joueurs_section, flag personnes.section_rugby) et
 *           setSectionRugby(personneId, actif) (RPC set_section_rugby,
 *           SEUL écrivain du flag ; garde SQL =
 *           puis_je_ecrire_categorie(SECTION) : admin, bureau,
 *           responsables du pôle Section). NB : get_joueur_detail
 *           (sql_154, ADDENDUM 1) sert désormais section_rugby en
 *           dernière colonne — getJoueurDetail() inchangé (lecture par
 *           nom, additif transparent).
 * Version : 1.74 — juillet 2026
 *   v1.74 : LOGISTIQUE-CYCLE-VIE-RESERVATIONS (FAIT FOI gelé 04/07/2026,
 *           md5 b59b44d9). 6 wrappers ADDITIFS vers les RPC sql_152
 *           (SECURITY DEFINER, patron valider_*, gardes bureau|admin OU
 *           demandeur propriétaire, B5 re-vérifié sur la catégorie cible
 *           pour les modifier_*) : modifierReservation / modifierRecurrence
 *           / modifierBus (UPDATE DUR de tous les champs métier — B7, le
 *           front ré-émet TOUT ; toute modification repasse statut
 *           'pending' et purge motif_refus/valide_par/valide_le — B2) ;
 *           annulerReservation / annulerRecurrence / annulerBus (statut
 *           'cancelled', trace conservée — B5). createRecurrence INCHANGÉ :
 *           le payload transite tel quel, date_debut (sql_151) passe sans
 *           modification du wrapper. Aucune méthode existante touchée.
 *   v1.73 : PORTAIL-MULTI-PERIMETRE (Lot 1, FAIT FOI gelé 03/07/2026).
 *           1 wrapper ADDITIF monContexteStaff() → RPC sql_149
 *           mon_contexte_staff (self-only via qui_suis_je, SECURITY
 *           DEFINER, EXECUTE authenticated, REVOKE public+anon) :
 *           fonction staff active + catégorie (id, code, libelle_court).
 *           Alimente la section 02 du portail (« Mon équipe — X ») —
 *           l'ORDER BY de la RPC est identique à ma_fonction_staff
 *           (invariant de cohérence topbar/greeting/section). Aucune
 *           méthode existante touchée.
 *   v1.72 : ENROLEMENT-REPARATION (option B, FAIT FOI gelé 03/07/2026).
 *           1 wrapper ADDITIF listFichesEnrolables() → RPC sql_147
 *           list_fiches_enrolables (SECURITY DEFINER, EXECUTE
 *           authenticated, REVOKE public+anon) : pioche DÉDIÉE de la
 *           modale d'enrôlement, limitée aux personnes ayant un rôle
 *           en attente (roles_en_attente) et pas encore reliées
 *           (auth_personne). Motif : la garde par rôle de
 *           list_staff_disponibles (retrofit u-admin v2) excluait les
 *           comptes orphelins — précisément ceux que la modale sert
 *           (œuf-et-poule, confirmé 2× en recette terrain 03/07).
 *           RGPD : un compte auto-inscrit sans pré-attribution voit
 *           une liste VIDE (vs ~46 fiches staff exposées si la garde
 *           avait été élargie). listStaffDisponibles INCHANGÉ (pioche
 *           u-admin). Va de pair avec sql_146 (fix 42702
 *           relier_ma_fiche) et index.html (swap d'appel de la
 *           modale). Sortie alignée [{personne_id, nom, prenom}],
 *           [] si erreur (dégradation honnête).
 *           node --check OK. boot v1.71 → v1.72.
 * Version : 1.71 — juillet 2026
 *   v1.71 : RECONDUCTION-SAISON (geste unique, FAIT FOI
 *           Conception-Reconduction-Saison-v1.md, md5 2f50aabf).
 *           2 wrappers ADDITIFS adossés aux RPC SECURITY DEFINER de
 *           sql_141 (has_role('admin')) :
 *           - apercuReconduction(sourceId, cibleId) →
 *             apercu_reconduction (LECTURE SEULE, plan des 3 volets
 *             ententes / équipes / collectif).
 *           - appliquerReconduction(sourceId, cibleId) →
 *             appliquer_reconduction (transaction unique, fail-loud,
 *             idempotente, journal reconduction_log).
 *           Comble le trou de sql/53 : la bascule surclassait les
 *           joueurs sans reconduire la chaîne saison → ententes →
 *           équipes → collectif (Hub bloqué au lendemain de la
 *           bascule, 01/07/2026). node --check OK. boot v1.70 → v1.71.
 * Version : 1.70 — juin 2026
 *   v1.70 : AGENDA-GOOGLE → SÉANCES (B-light, sens unique entrant).
 *           3 wrappers ADDITIFS pour le pont iCal Google Agenda
 *           « Missions de Lohann » → mission_seances (cf. FAIT FOI
 *           29/06/2026, gate amont pt 133) :
 *           - listMissionsSalarie(salarieId) → list_missions filtrée
 *             p_salarie_id (sélecteur de rattachement de l'import).
 *           - listMissionSeances(missionId) → list_mission_seances
 *             (SETOF mission_seances, inclut gcal_uid : pré-check
 *             anti-doublon).
 *           - creerSeancePonctuelle({...}) → creer_seance_ponctuelle
 *             étendue sql_134 (p_gcal_uid 11e param). Garde voie 3,
 *             état forcé 'realisee' pour Lohann, gcal_uid persisté.
 *           Lecture .ics déposée manuellement, parsée JS local côté
 *           page : zéro OAuth, zéro secret, zéro réseau Google ici.
 *           node --check OK. boot v1.69 → v1.70 (rattrapage : le
 *           console.log déployé affichait encore v1.68).
 * Version : 1.69 — juin 2026
 *   v1.69 : DASHBOARD-TUILES-PAR-CAPABILITY. 1 wrapper ADDITIF
 *           suisJeSalarie() adossé à la RPC suis_je_salarie() (sql_122),
 *           prédicat voie 3 « contrat salarié courant » (contrats_salaries,
 *           même WHERE que list_salaries() restreint à qui_suis_je()).
 *           Pilote la PORTE du dashboard élargi (admin|bureau|salarié) et la
 *           visibilité de la tuile « Suivi du salarié ». Fail-safe false.
 *           node --check OK. boot v1.68 → v1.69.
 * Version : 1.68 — juin 2026
 *   v1.68 : JOUEURS-AFFICHAGE-PAR-CATEGORIE (pt 110). 1 wrapper
 *           ADDITIF getJoueursCategorie(categorieId) adossé à la RPC
 *           get_joueurs_categorie (sql_112), jumelle de
 *           get_joueurs_f15/get_joueurs_equipe (même shape). Permet de
 *           charger l'effectif PAR CATÉGORIE (personnes.categorie_id)
 *           au lieu de par équipe — 13 catégories sur 14 avaient leurs
 *           joueurs rattachés à la catégorie sans ligne equipe_joueurs,
 *           donc invisibles à l'écran. node --check OK. boot v1.67 → v1.68.
 * Version : 1.67 — juin 2026
 *   v1.67 : JOUEURS-PERIMETRE-F15 (pt 109). 1 wrapper ADDITIF
 *           getJoueursF15() adossé à la RPC get_joueurs_f15 (sql_111),
 *           jumelle de get_joueurs_equipe (même shape de sortie). Ferme
 *           le bug recette : la catégorie F15 (sans équipe rattachée)
 *           affichait l'effectif M14 par repli. F15 est un périmètre
 *           transversal par flag personnes.f15_integree ; la RPC le
 *           charge sans passer par une équipe. Aiguillage côté écran
 *           (joueurs-browser.js). node --check OK. boot v1.66 → v1.67.
 * Version : 1.66 — juin 2026
 *   v1.66 : SEANCE-SOFT-DELETE (durcissement, Phase 5.13). 3 wrappers
 *           ADDITIFS pour fermer le DELETE physique accidentel d'une séance
 *           (incident pt 107 : RUGBY PP+SKILLS perdue). ZÉRO SQL : le CHECK
 *           seances_etat_check accepte déjà 'archivee', et archiveSeance
 *           existait déjà.
 *           (a) archiveSeancesEnLot(ids)  : UPDATE etat='archivee' en lot,
 *               depuis n'importe quel état (récupérable). Remplace l'usage
 *               UI de deleteSeancesEnLot pour les brouillons cochés.
 *           (b) purgerSeanceArchivee(id)  : DELETE BORNÉ .eq('etat','archivee')
 *               — purge définitive impossible sans passer par la corbeille.
 *           (c) purgerSeancesArchiveesEnLot(ids) : variante batch, même borne.
 *           deleteSeance / deleteSeancesEnLot CONSERVÉS (filet base) mais
 *           plus appelés par l'UI (cf. seance-editor v1.18).
 *           node --check OK. boot v1.65 → v1.66.
 * Version : 1.65 — juin 2026
 *   v1.65 : MULTI-COACHS par bloc (sql_110). 'encadrants_ids' (uuid[])
 *           ajouté aux whitelists addBlocToSeance (optionalKeys) et
 *           updateBloc (allowedKeys). Liste plate égalitaire des coachs
 *           d'un bloc ; remplace l'usage de encadrant_id (déprécié, gardé).
 *           2 lignes ajoutées. node --check OK. boot v1.64 → v1.65.
 * Version : 1.64 — juin 2026
 *   v1.64 : FIX réordonnancement d'étages parallèles (recette terrain).
 *           updateBloc : 'ordre' ajouté à allowedKeys. Le déplacement
 *           up/down d'un étage (seance-editor v1.10 _swapEtages) pilote
 *           le réordonnancement via updateBloc({ordre}) ; or 'ordre' était
 *           hors whitelist → patch vidé → « Aucun champ modifiable ».
 *           1 ligne ajoutée. node --check OK. boot v1.63 → v1.64.
 * Version : 1.63 — juin 2026
 *   v1.63 : SEANCE-BLOCS-PARALLELES (retours terrain). Migration sql_108
 *           ayant doté seances_blocs de `voie` (smallint, 0=pleine largeur,
 *           1..N=couloirs simultanés) et `encadrant_id` (FK personnes,
 *           coach par bloc), 3 retouches ADDITIVES aux wrappers blocs :
 *           (a) addBlocToSeance : `voie` + `encadrant_id` ajoutés à
 *               optionalKeys (insérés seulement si fournis ; défaut DB
 *               voie=0 / encadrant_id=null sinon).
 *           (b) updateBloc : `voie` + `encadrant_id` ajoutés à allowedKeys.
 *           (c) reorderBlocs : INCHANGÉ fonctionnellement — la danse 2
 *               passes ne touche QUE `ordre`, jamais `voie`, donc
 *               l'unicité élargie (seance_id, ordre, voie) est respectée.
 *               Seul un commentaire de garde est ajouté (le parallélisme
 *               se pilote via updateBloc({ordre,voie}), pas via reorderBlocs).
 *           Aucune signature existante cassée. node --check OK.
 *           console.log boot v1.62 → v1.63.
 *   v1.62 : ADMIN-RESPONSABLE-POLE (pt 106). 1 ajout ADDITIF :
 *           wrapper definirResponsablesPole(poleId, principalId, coId)
 *           adossé à la RPC SECURITY DEFINER definir_responsables_pole
 *           (sql_107, gardée has_role('admin')). Écrit les deux colonnes
 *           existantes poles.responsable_principal_id / co_responsable_id
 *           (FK -> personnes(id)) ; le pôle reste une DONNÉE, aucun rôle
 *           auth_roles créé. C'est la surface admin qui manquait pour
 *           (re)jouer la désignation faite jusqu'ici par UPDATE direct
 *           (Lohann EDR/SENIORS). Aucun wrapper existant touché.
 *           node --check OK. console.log boot v1.61 → v1.62.
 *   v1.61 : PLANIF-ECRITURE-POLE (front, temps 2). 1 ajout ADDITIF :
 *           wrapper mesPolesResponsable() (RPC mes_poles_responsable
 *           préexistante) exposant les pôles dont le connecté est
 *           responsable DÉSIGNÉ (principal|co-responsable). Sert au front
 *           de planification à calculer peutEditer sur les trames de pôle
 *           (adossé à la RLS d'écriture sql_106). DISTINCT de
 *           mesPolesAutorises (qui remonte les pôles dérivés des catégories
 *           d'encadrement). Aucun wrapper existant touché. node --check OK.
 *           console.log boot v1.60 → v1.61.
 *           (NB : le déployé v1.60 affichait encore l'entête « 1.59 » —
 *           seul le boot avait été bumpé pt 104 ; entête réalignée ici.)
 *   v1.59 : SOCLE MULTI-CATÉGORIES (UX-MULTI-CATEGORIES Lot 2). 3 ajouts
 *           ADDITIFS pour le sélecteur de catégorie active des écrans
 *           catégorie-portés (un encadrant multi-catégories comme Lohann
 *           ne voyait que M14, les écrans étant verrouillés sur
 *           M14_TEAM_UUID en dur) :
 *           - resoudrePerimetreCategories() : résout le périmètre via la
 *             RPC mes_categories_autorisees() (forme sondée à la source :
 *             (categorie_id uuid, est_transverse boolean)), dédoublonne
 *             par id (doublon pôle+fonction_staff possible), résout les
 *             libellés via getCategories(), trie par ordre_tri, calcule
 *             la catégorie active (mémorisée ou 1re). admin/bureau
 *             (est_transverse) → toutes les catégories. Dégradation
 *             honnête : aucun droit / référentiel KO → {vide:true}.
 *           - lireCategorieActiveMemorisee() / memoriserCategorieActive()
 *             : persistance localStorage (clé partagée mom_hub.categorie_
 *             active), repli silencieux si localStorage indisponible.
 *           Aucun wrapper existant touché ; node --check OK ; additivité
 *           prouvée Python. ZÉRO SQL (la RPC B5 existe déjà).
 *   v1.58 : PASTILLE TOPBAR — initiales dynamiques (bug (a) recette Vivien).
 *           La pastille `.avatar` était figée « EJ » EN DUR dans le HTML des
 *           21 pages -> tout utilisateur (ex. Vivien Rulfo) voyait « EJ »
 *           (Emmanuel Jung) au lieu de SES initiales. _remplirProfilTopbar
 *           remplit désormais aussi `.avatar` : initiales dérivées de la
 *           fiche reliée via quiSuisJe() -> _resolveNoms([id]) (get_noms_personnes,
 *           ouverte à tout authentifié depuis sql_93 ; self-only, 1 seul UUID =
 *           le sien). « VR » = prénom[0]+nom[0]. Dégradation honnête : pas de
 *           fiche reliée / Map vide -> avatar en dur conservé (pas de « ?? »).
 *           ADDITIF ; aucune RPC nouvelle ; aucune méthode existante touchée.
 *   v1.57 : VOIE 2 — renommage de la porte de rôle `referent` -> `encadrant`
 *           (côté front, étape 4/7 de la migration). _ROLE_LABELS : clé
 *           `referent` -> `encadrant` ; _ROLE_PRIORITE : idem. Ces deux-là
 *           ne servent qu'au REPLI d'affichage topbar (admin/bureau sans
 *           fonction) ; un encadrant réel passe par _FONCTION_LABELS via
 *           ma_fonction_staff (inchangé). ADDITIF ; aucune méthode touchée.
 *   v1.56 : VOIE 2 (lot 6b) — wrapper maFonctionStaff() (RPC self-only
 *           ma_fonction_staff, sql_92) + topbar : `.user-role` dérive de la
 *           FONCTION réelle (repli rôle), corrige l'affichage « Référent »
 *           pour un adjoint (bug pt 88). ADDITIF.
 *   v1.55 : VOIE 2 — 2 wrappers (lots 5/6). puisJeFaire(action, cat) :
 *           prédicat d'affichage délégant à puis_je_faire (sql_88), fail-safe
 *           false. validerComposition(id) : valide via la RPC dédiée
 *           valider_composition (sql_91, capability valider_compo) — seule
 *           voie conforme S1. ADDITIF ; aucune méthode existante touchée.
 *   v1.54 : PROFIL TOPBAR DYNAMIQUE (pt 88). Helper central auto-exécutant
 *           au DOMContentLoaded : remplit `.user-profile .user-name`/`.user-role`
 *           depuis la session (monPrenom + getMyRoles mappé) sur les 14 pages
 *           portant ce markup, 0 édition HTML. Dégradation honnête (pas de
 *           session ou prénom null → texte en dur conservé). Corrige aussi le
 *           log boot qui affichait encore v1.51.
 *   v1.53 : GREETING SELF-ONLY (ENROLEMENT-FRONT, pt 85→86). 1 wrapper
 *           ADDITIF : monPrenom() — RPC mon_prenom() (RETURNS text,
 *           self-only via auth.uid(), EXECUTE authenticated). Résout le
 *           prénom d'un compte relié SANS rôle pour le greeting, là où
 *           get_noms_personnes() (gardée admin|coach, RGPD) renvoyait une
 *           erreur. Aucune méthode existante touchée ; corps + droits lus
 *           à la source. node --check OK.
 *   v1.52 : ENRÔLEMENT FRONT (ENROLEMENT-FRONT-MANQUANT, pt 84). 2 wrappers
 *           ADDITIFS au bloc auth : quiSuisJe() — lit la personne_id reliée
 *           au compte via qui_suis_je() (RETURNS TABLE, null si orphelin) ;
 *           relierMaFiche(personneId) — pose le pont auth_personne via
 *           relier_ma_fiche(p_personne_id) (seul écrivain, matérialise les
 *           rôles pré-attribués, invalide _rolesCache). Aucune méthode
 *           existante touchée ; signatures + droits EXECUTE lus à la source.
 *   v1.51 : PLANIFICATION ANNUELLE (sql/73). 5 wrappers ADDITIFS :
 *           mesPolesAutorises() — RPC jumelle de mes_categories_autorisees
 *           (transverse ⇒ [{pole_id:null,est_transverse:true}], référent ⇒
 *           pôles dérivés de fonction_staff active) ; listPlanificationAxes()
 *           — référentiel des pioches collectif/physique/poste (actifs,
 *           triés type+ordre) ; listPlanificationBlocs({saisonId,categorieId|
 *           poleId}) — blocs d'une portée, RLS fait foi ; savePlanificationBloc
 *           (upsert) / deletePlanificationBloc(id) — écritures soumises RLS
 *           (pôle ⇒ admin|bureau ; catégorie ⇒ puis_je_ecrire_categorie).
 *           Aucun wrapper existant touché ; insertion en fin d'objet ;
 *           node --check OK. NB : forme de retour de mes_poles_autorises non
 *           sondable hors session (gardée) → à confirmer en recette en-app.
 *   v1.50 : MODULE LOGISTIQUE (Production). 11 wrappers ADDITIFS pour les
 *           4 tables neuves : lectures listRessourcesLogistiques /
 *           listReservations / listRecurrences / listDemandesBus ;
 *           écritures createReservation / createRecurrence / createDemandeBus
 *           (soumises RLS B5-saisie WITH CHECK puis_je_ecrire_categorie) ;
 *           validation validerReservation / validerRecurrence /
 *           setRecurrenceActive / validerBus (RPC SECURITY DEFINER gardées
 *           bureau|admin, D1). Écart gouvernance assumé (Manu, 5 juin 2026) :
 *           SAISIE adossée B5, VALIDATION hors-B5. Aucun wrapper existant
 *           touché ; insertion en fin d'objet ; node --check OK. (Corrige au
 *           passage le log v1.48 ↔ en-tête v1.49 → v1.50 unifié.)
 *   v1.49 : PILOTAGE CATÉGORIE (pt 63). 2 wrappers ADDITIFS de LECTURE :
 *           listPilotageCategorie(categorieId) — lignes joueur × équipe ×
 *           rôle × poste × match pour toute la catégorie (collectif M14,
 *           N équipes), compétition uniquement, via la RPC SECURITY DEFINER
 *           pilotage_categorie_lignes (sql pt 63, gardée admin|coach ;
 *           SELECT prouvé sonde S10). mesCategoriesAutorisees() — résout la
 *           catégorie du référent connecté via la RPC B5 mes_categories_
 *           autorisees() (D-PILOT-CAT-1). Aucun wrapper existant touché ;
 *           node --check OK. NB : forme de retour de mes_categories_autorisees
 *           non sondable hors session (gardée) → champ categorie_id supposé,
 *           à confirmer en recette en-app (tracé pt 63).
 * Version : 1.48 — juin 2026
 *   v1.48 : STATS SAISON (pt 61). 1 wrapper ADDITIF de LECTURE :
 *           listComposMatchDuJoueur(joueurId) — lignes de compo match d'un
 *           joueur sur la saison, toutes bases, via composition_joueurs
 *           (policy SELECT authenticated=true, sonde S61.7) joint
 *           compositions!inner filtré cote='mom'/type_compo='match'/
 *           est_active=true. JAMAIS equipe_id (D-FICHE-B, bug 6c-6).
 *           Voie d'agrégation saison de la fiche stats joueur (Objet 1).
 *           Aucun wrapper existant modifié. RGPD : noms hors scope ici
 *           (résolus par _resolveNoms côté appelant).
 *
 * Version : 1.47 — juin 2026
 *   v1.47 : getTempsDeJeuRencontre(evt [, evenementEquipeId]) — wrapper
 *           ADDITIF voie coach garde auth.uid() (backend C12-w,
 *           SUIVI-COACH-7). Lit le temps de jeu par joueur (calcul
 *           backend = intersection présence × fenêtres de période C12-v ;
 *           jamais minute_match). Dégradation honnête : chrono_complet=
 *           false + minutes_jeu=null si chrono absent/non clôturé →
 *           l'écran affiche « indisponible », jamais un 0 fabriqué.
 *           Aucun wrapper existant touché.
 * Version : 1.46 — juin 2026
 *   v1.46 : rapports phase & tournoi — saisi STRUCTURÉ (pt 55). Ajout
 *           ADDITIF : _mapRapport expose `donnees` (jsonb classement +
 *           aiguillage, NULL pour un match) ; upsertRapportMatch gagne
 *           un 3e argument optionnel `donnees` (défaut undefined → non
 *           transmis, le SQL préserve l'existant via COALESCE, C13-b).
 *           Phase et tournoi se rattachent À L'IDENTIQUE sur leur UUID
 *           (aucun nouveau wrapper, mêmes RPC). Appels 2-args du match
 *           inchangés. Aucun wrapper existant touché.
 *   v1.45 : rapports de match — saisi (2e temps). 4 wrappers ADDITIFS
 *           voie coach garde auth.uid() (backend C13-a) :
 *           getRapportMatch / upsertRapportMatch / finaliserRapport /
 *           rouvrirRapport + helper _mapRapport (sorties SQL out_* →
 *           objet métier nu). bilan + statut provisoire/finalise ;
 *           statut = mention, jamais un cadenas (pt 52). Aucun wrapper
 *           existant touché.
 * Version : 1.44 — juin 2026
 *   v1.44 : insererObservableCoach transmet joueurUuidEntrant
 *           (p_joueur_uuid_entrant) pour la substitution (L3c).
 * Version : 1.43 — juin 2026
 *   v1.43 : annulerObservableCoach(evt, ligneId) — wrapper ADDITIF voie
 *           coach de l'annulation (C12-t). Historique annulable (L4).
 * Version : 1.42 — juin 2026
 *   v1.42 : actionChronoCoach(evt, action, opts) + getChronoRencontreCoach(evt)
 *           — wrappers ADDITIFS voie coach du chrono persistant (C12-n).
 *           Suivi live éducateur seul, L2. Aucun wrapper existant touché.
 * Version : 1.41 — juin 2026
 *   v1.41 : listMatchsParBaseOrigine(baseId) — wrapper ADDITIF lisant les
 *           feuilles de match par compo_base_origine_id (sans jointure
 *           evenements!inner sur equipe_id, qui excluait à tort les matchs
 *           des équipes engagées ≠ M14 → bug 409 multi-équipes côté éditeur
 *           v3.24). Aucune méthode existante touchée. node --check OK.
 * Version : 1.40 — mai 2026
 *   v1.40 : listMesEvenementsAvecCompos — priorité d'affichage de l'équipe
 *          changée en nom_officiel || libelle_court || code (D9). Motif :
 *          libelle_court peut être NULL sur certaines équipes engagées
 *          (ex. SAR/MOM-M14-2, prouvé en base) → l'ancien ordre affichait
 *          « M14 » pour l'une et « SAR/MOM-M14-2 » pour l'autre (incohérent).
 *          nom_officiel est rempli sur les deux → libellés homogènes dans
 *          la page-raccourci. 1 ligne changée, reste identique.
 *   v1.39 : wrapper listMesEvenementsAvecCompos(limit) pour la page-
 *          raccourci P1 (« mes évènements avec compos », lien Compositions
 *          du menu). Liste 1 ligne par compo de base ACTIVE = 1 feuille
 *          d'équipe engagée. Part de compositions et embarque l'évènement
 *          + l'équipe engagée via la FK evenement_equipe_id (N3) — PAS de
 *          jointure evenements!inner mono-équipe, contrairement à
 *          listCompositionsByEquipe : les tournois multi-équipes (equipe_id
 *          NULL, ex. Challenge Vié) remontent enfin. Addition pure, aucun
 *          wrapper existant touché.
 *   v1.38 : wrapper listMatchsDeLequipe(racineId, equipeId) pour les
 *          onglets de compo de match (étape 6c-6) : récupère 2 niveaux
 *          d'évènements sous la racine, filtre par equipe_id + présence
 *          d'adversaire (isole les matchs réels des boîtes de phase),
 *          trie par phase puis ordre_dans_phase. Addition pure, aucun
 *          wrapper existant touché.
 *   v1.0 : initial (référentiels publics + getDashboardStats)
 *   v1.1 : ajout auth Magic Link (requestMagicLink, getSession) — Phase 2.5.3
 *   v1.2 : requestMagicLink calcule explicitement emailRedirectTo
 *   v1.3 : helpers de session pour pages sécurisées — Phase 2.5.4
 *   v1.4 : (mise à jour interne sans nouveaux helpers — changelog rattrapé en v1.5)
 *   v1.5 : wrappers Phase 4.2.C pour les RPC événements
 *   v1.6 : wrapper Phase 4.3 pour la RPC vivier — getVivierCompo(equipeId)
 *   v1.7 : wrappers ÉCRITURE Phase 4.4 UI compositions —
 *          createCompo, duplicateCompoFromBase, addJoueurCompo,
 *          updateJoueurCompo, removeJoueurCompo, updateCompoNotes,
 *          validateCompo, unvalidateCompo, markCompoUtilisee,
 *          archiveCompo, listCompositionsByEquipe, getCompoComplete.
 *   v1.7.1 : fix robustesse — remplacement de .single() par
 *          .maybeSingle() sur validateCompo / unvalidateCompo /
 *          markCompoUtilisee, qui combinent UPDATE + filtre sur état
 *          source. Sans ce fix, un appel "à blanc" (compo dans le
 *          mauvais état source) renvoyait l'erreur PostgREST brute
 *          "Cannot coerce the result to a single JSON object" au lieu
 *          du message métier "La compo n'est pas en état '...'".
 *          Détecté en smoke test : 2e appel validateCompo sur compo
 *          déjà validée. Comportement vu par l'utilisateur final
 *          désormais aligné sur le message custom du garde-fou.
 *   v1.8 : Phase 5.3 — 13 wrappers Préparation de séance.
 *          LECTURE (4) : listSeancesByEquipe, getSeanceComplete,
 *          getSeancesAVenir (RPC), listModelesSeance.
 *          ÉCRITURE séance (3) : createSeance, updateSeance, archiveSeance.
 *          ÉCRITURE bloc (4) : addBlocToSeance, updateBloc, removeBloc,
 *          reorderBlocs.
 *          ÉCRITURE rattachement atelier (2) : attachAtelierToBloc,
 *          detachAtelierFromBloc.
 *          Note : le brief listait 12 wrappers. Ajout du 13e
 *          getSeancesAVenir par cohérence avec la RPC SQL créée en
 *          Phase 5.1 (sinon orpheline).
 *   v1.8.1 : Phase 5.5.B1 — wrapper lecture listSitesActifs(options)
 *          pour alimenter le dropdown lieu_id du formulaire méta
 *          séance. Filtre actif=TRUE, tri alphabétique sur libelle.
 *          Pattern lecture identique listCompositionsByEquipe.
 *   v1.8.2 : Phase 5.6.A — wrapper lecture listBlocsBySeance(seanceId)
 *          pour alimenter la table de trame chronologique. Renvoie
 *          tous les blocs d'une séance triés par ordre. Alternative
 *          plus légère à la RPC get_seance_complete pour l'usage
 *          "afficher juste la trame sans les ateliers rattachés".
 *   v1.8.3 : Phase 5.8 — wrapper lecture
 *          listAteliersRattachesAuBloc(blocId). Renvoie la liste
 *          ordonnée des rattachements ateliers d'un bloc (table
 *          seances_blocs_ateliers : id, ordre, atelier_fileid_drive,
 *          notes_atelier, created_at). Sert au picker Bibliothèque
 *          côté éditeur de séance pour afficher les fiches déjà
 *          rattachées et permettre leur détachement par id.
 *   v1.8.4 : Phase 5.10 — 2 wrappers Préparation séance.
 *          (1) listBrouillonsVides(equipeId) : LECTURE des brouillons
 *          sans date_seance ET sans bloc rattaché. Implémentation JS
 *          (pas de RPC SQL pour rester simple) : SELECT brouillons
 *          puis filtrage côté client via count de seances_blocs par
 *          séance. Renvoie [{id, created_at}] des brouillons éligibles
 *          à la suppression.
 *          (2) deleteBrouillonsVides(seanceIds) : ÉCRITURE DELETE des
 *          séances correspondantes (CASCADE supprimera les rares blocs
 *          orphelins éventuels). Renvoie {ok, deleted_count}.
 *          Résout la dette D-SEANCE-STUB-VIDES héritée de Phase 5.5
 *          (le bouton "+ Nouvelle séance" crée un stub DB immédiatement,
 *          laissant des brouillons vides en cas d'abandon).
 *   v1.8.5 : Phase 5.12 fix — 2 wrappers de transition d'état séance.
 *          (1) validerSeance(seanceId) : bascule etat='brouillon' →
 *          'validee'. Garde-fou serveur via .eq('etat','brouillon')
 *          côté UPDATE pour éviter de valider une séance déjà validée
 *          ou archivée par accident.
 *          (2) repasserSeanceBrouillon(seanceId) : bascule
 *          etat='validee'|'utilisee' → 'brouillon'. Permet la
 *          re-modification après validation. Garde-fou serveur via
 *          .in('etat', ['validee','utilisee']).
 *          Pattern identique à archiveSeance (existant). Nécessaire
 *          car updateSeance() a une whitelist qui exclut volontairement
 *          le champ 'etat' (séparation transitions / updates métier).
 *          Bug d'origine : la Phase 5.12 v1.9 de seance-editor appelait
 *          updateSeance({etat:'validee'}) → patch filtré → erreur
 *          "Aucun champ modifiable dans ce patch".
 *   v1.8.6 : Phase 5.12 — suppression libre de séances.
 *          (1) deleteSeance(seanceId) : DELETE physique d'une séance.
 *          Garde-fou métier serveur via .eq('etat', 'brouillon') :
 *          seuls les brouillons sont supprimables, les validées et
 *          utilisées sont protégées (doctrine : conserver l'historique).
 *          Si on veut supprimer une séance validée, il faut d'abord la
 *          repasser en brouillon. Les archivées NE sont PAS supprimables
 *          via ce wrapper (utiliser un éventuel deleteSeanceArchivee
 *          plus tard si le besoin émerge).
 *          (2) deleteSeancesEnLot(seanceIds) : variante batch, accepte
 *          un tableau d'UUIDs, applique la même règle de garde-fou
 *          (uniquement brouillons). Renvoie {ok, deleted_count}.
 *          Le CASCADE FK supprime automatiquement les seances_blocs et
 *          seances_blocs_ateliers liés.
 *   v1.9 :  (numéro sauté pour éviter ambiguïté — version transitoire
 *          jamais déployée, voir merge v1.10 ci-dessous)
 *   v1.10 : Phase 4.4 UI Évènements — clôture dette C9-c (audit
 *          Évènements §8). 2 nouveaux wrappers LECTURE pour le cycle
 *          Évènements :
 *          (1) getEvenementsPasses(equipeId, joursPasses, limit) :
 *              symétrique de getEvenementsAVenir, consomme la nouvelle
 *              RPC get_evenements_passes (sql/29, dette C9-a). Tri DESC,
 *              inclut les événements 'annule' (visibles barrés côté UI).
 *          (2) getEvenementWithEncadrants(evenementId) : fiche détaillée
 *              E2, consomme la RPC get_evenement_with_encadrants
 *              (sql/29, dette C9-b). Retourne l'événement complet (24
 *              colonnes) avec son array JSONB encadrants enrichi
 *              (nom, prénom, rôles, ordre, notes).
 *          Note : les 2 wrappers existants getEvenementsAVenir et
 *          getProchainEvenementParEquipe n'ont PAS été modifiés. Leur
 *          signature d'entrée reste identique. PostgREST ramène
 *          naturellement la nouvelle colonne compo_status_summary
 *          (sql/29, dette C9-d) ajoutée aux 4 RPC événements pour
 *          alimenter les pastilles statut compo des cartes UI.
 *          Note historique : initialement bumpé en v1.9 ce matin
 *          (S1.4 conv Joueurs/Évènements) mais non poussé. Pendant ce
 *          temps une autre conv a livré v1.8.5 + v1.8.6 sur le module
 *          Préparation séance (transitions état + suppression séance).
 *          Merge propre en v1.10 par-dessus v1.8.6 sans rien écraser.
 *   v1.11 : Phase 4.4 UI Évènements S2.4.a — 7 wrappers ÉCRITURE pour
 *          le cycle Évènements (création, duplication, annulation,
 *          réactivation, update champs métier, update logistique,
 *          ajout match au tournoi). Tous suivent le pattern Hub
 *          { ok, data?, error? } cohérent avec les wrappers
 *          compositions v1.7. Whitelist explicite des champs autorisés
 *          en UPDATE pour sécurité (séparation transitions / updates
 *          métier).
 *
 *          (1) createEvenement(payload) : INSERT évent (parent ou
 *              enfant). Champs autorisés : code, libelle, type_evenement,
 *              type_competition, equipe_id, saison_id, format_de_jeu,
 *              date_debut, date_fin, site_id, organisateur_principal_id,
 *              evenement_parent_id, phase_libelle, ordre_dans_phase,
 *              adversaire_nom, domicile_exterieur, notes_internes.
 *              Etat initial forcé à 'creation'.
 *
 *          (2) duplicateEvenement(srcId, overrides) : SELECT source +
 *              INSERT nouveau évent avec champs hérités. V1 ne duplique
 *              QUE le parent (pas les enfants — dette
 *              P4-UI-evenements-2 V2). code et libelle auto-générés
 *              ou via overrides.
 *
 *          (3) addMatchToTournoi(tournoiId, payload) : wrapper spécialisé
 *              create avec evenement_parent_id forcé. Hérite
 *              type_competition + saison_id + equipe_id +
 *              organisateur_principal_id du parent si non fournis.
 *
 *          (4) updateEvenement(evenementId, patch) : UPDATE whitelist.
 *              Champs autorisés : libelle, type_competition, date_debut,
 *              date_fin, site_id, format_de_jeu, adversaire_nom,
 *              domicile_exterieur, phase_libelle, ordre_dans_phase,
 *              notes_internes, score_mom, score_adverse, classement_final,
 *              notes_resultat. PAS de etat dans la whitelist (transitions
 *              gérées par cancelEvenement / reactivateEvenement).
 *
 *          (5) cancelEvenement(evenementId, motif) : UPDATE etat='annule'.
 *              Garde-fou .eq('etat',...) pour interdire de re-annuler ou
 *              d'annuler depuis 'archive'. Stocke le motif dans
 *              notes_resultat (V1 simple, pas de colonne dédiée).
 *
 *          (6) reactivateEvenement(evenementId) : UPDATE etat='annule'
 *              → 'creation'. Garde-fou .eq('etat','annule') pour
 *              empêcher la réactivation depuis un autre état.
 *
 *          (7) updateLogistique(evenementId, jsonbPayload) : UPDATE
 *              de la seule colonne logistique_deplacement JSONB.
 *              Validation côté wrapper : doit être un object ou null.
 *
 *          Tous les wrappers exploitent la RLS write en place (sql/25)
 *          via has_role('admin') OR has_role('coach') côté authenticated.
 *
 *   v1.12 : Phase 5.14 S1.b — Module Joueurs. 3 wrappers calqués sur le
 *          pattern v1.11 Évènements et v1.7 Compositions :
 *
 *          (1) getJoueursEquipe(equipeId) : LECTURE de la liste des
 *              joueurs actifs d'une équipe via la RPC SECURITY DEFINER
 *              get_joueurs_equipe(p_equipe_id) (sql/33-fix v1.1).
 *              Retourne un tableau ~22 colonnes par joueur, incluant les
 *              champs calculés profil (mom/f15/partenaire/coach/staff)
 *              et etat_calcule (actif/indisponible/blesse/suspendu/inactif).
 *              Dette audit C10-J-f.
 *
 *          (2) getJoueurDetail(personneId) : LECTURE de la fiche
 *              détaillée d'une personne via la RPC SECURITY DEFINER
 *              get_joueur_detail(p_personne_id) (sql/33-fix v1.1).
 *              Retourne un objet ~55 colonnes avec coordonnées, identité
 *              étendue, RGPD, droits image, métadonnées. À utiliser pour
 *              le panneau slide-in droite (S2.3). Dette audit C10-J-g.
 *
 *          (3) updateJoueurMetier(personneId, patch) : ÉCRITURE patch
 *              partiel d'une fiche joueur via la RPC SECURITY DEFINER
 *              update_joueur_metier(p_personne_id, p_patch) (sql/34-fix
 *              v1.1). Whitelist 8 champs : postes_uuids, aptitudes_uuids,
 *              taille_cm, poids_g, notes_coach, indisponibilite,
 *              blessure_resume, suspension_jusqu_au. Toute clé hors
 *              whitelist est ignorée silencieusement côté SQL.
 *              Normalisation TEXT (trim + nullif empty → NULL).
 *              Dette audit C10-J-j.
 *
 *          Note doctrinale : ces 3 wrappers passent tous par RPC (pas
 *          de SELECT/UPDATE direct sur personnes) parce que la table
 *          personnes est interdite en accès client direct (P6
 *          confidentialité par construction, audit §2.2). Les RPC
 *          SECURITY DEFINER bypassent la RLS et appliquent leur propre
 *          contrôle d'accès (has_role + auth.uid).
 *
 *   v1.13 : SUIVI-COACH-1 Objet A — 1 wrapper C12-f.
 *          genererLienEphemere(evenementUuid, role, creePar) : ÉCRITURE
 *          via la RPC SECURITY DEFINER generer_lien_ephemere
 *          (sql/C12-f), qui RETURNS TABLE(token, role, expire_le) →
 *          on prend data[0] (même pattern que updateJoueurMetier /
 *          getEvenementWithEncadrants).
 *          Le garde-fou métier PI-7 (compo 'validee' active = pré-
 *          condition dure d'un lien 'saisie') est porté PAR LA RPC :
 *          elle lève une exception explicite, remontée fidèlement ici
 *          en { ok:false, error: <message PI-7> } sans réinterpréter
 *          ni dupliquer la règle côté client (anti-invention).
 *          p_config_chrono (DA-2) volontairement NON transmis : le SQL
 *          le stocke tel quel sans l'interpréter ; le moteur chrono
 *          n'est pas du périmètre Objet A (anti-anticipation). p_duree
 *          laissé au défaut serveur (36 h). p_cree_par : pass-through
 *          optionnel, jamais fabriqué ici.
 *          Périmètre Objet A : seul le rôle 'saisie' est appelé par
 *          l'UI ; le wrapper reflète fidèlement la RPC (param role
 *          présent, validé sur le même CHECK que le SQL) mais la
 *          non-exposition du lien spectateur est une décision d'UI
 *          (A-Q4), appliquée côté evenements-browser, pas un verrou
 *          client. Exposition spectateur tracée : Objet C-2 /
 *          SUIVI-UI-6 (hors de ce cycle).
 *
 *   v1.14 : SUIVI-COACH-2 — 1 wrapper C12-h.
 *          getLienSaisieActif(evenementUuid) : LECTURE via la RPC
 *          SECURITY DEFINER get_lien_saisie_actif (sql/C12-h), qui
 *          RETURNS TABLE(token, expire_le, date_creation) → on prend
 *          data[0] (même pattern que genererLienEphemere). Rend l'état
 *          3 d'Objet A (« lien déjà généré ») persistant entre visites
 *          côté coach authentifié.
 *          La RPC renvoie 0 ou 1 ligne, JAMAIS d'exception : 0 ligne
 *          = aucun lien 'saisie' actif → { ok:true, data:null } (PAS
 *          une erreur ; Objet A reste/retombe à l'état 2 « générer »,
 *          comportement correct). Une vraie erreur réseau/SQL revient
 *          en { ok:false, error }. La distinction null vs erreur est
 *          essentielle : ne jamais afficher de fausse erreur au coach
 *          sur une rencontre sans lien.
 *          Filtrage (role='saisie', revoque=FALSE, expire_le>NOW) fait
 *          PAR LA RPC : le client ne re-filtre rien (anti-invention,
 *          règle non dupliquée). Au plus 1 lien actif par rencontre
 *          (invariant relais C12-f) → data[0] sans ambiguïté. Le jeton
 *          est renvoyé BRUT tel que la RPC le donne ; la fabrication
 *          de l'URL suivi.html?t=… reste côté evenements-browser
 *          (suiviBuildUrl, déjà en place — fidélité à la source).
 *          Posture grant RPC = authenticated seul (event-bornée ;
 *          volet jeton rejeté backend pour escalade spectateur→
 *          rédacteur). Itération : persistance match simple ; tournoi
 *          reste borné session (décision de périmètre Manu).
 *   v1.15 : SUIVI-COACH-1 Objet B (Mode Vidéo) — couche données
 *          coach du Suivi. 5 wrappers + 1 helper. Ajout pur :
 *          aucun wrapper v1.0→v1.14 modifié (signatures et
 *          retours identiques). Signatures SQL vérifiées À LA
 *          SOURCE (sql/C12-j, sql/C12-k, sql/C12-e via
 *          suivi-client.js v1.1) — rien deviné.
 *
 *          ÉCRITURE coach (sql/C12-j, SUIVI-COACH-3, chemin
 *          coach-authentifié ; C12-c NON touché) :
 *          (1) insererObservableCoach(evenementUuid, obs) →
 *              inserer_observable_coach. Le backend FORCE
 *              source_saisie='video' + saisi_par_role='coach'
 *              + saisi_par='coach:auth:'<auth.uid()> : le
 *              wrapper n'envoie donc NI p_saisi_par_role NI
 *              p_source_saisie (n'existent pas dans la
 *              signature coach — diffère de C12-c bénévole).
 *          (2) annulerObservableCoach(evenementUuid, ligneId) →
 *              annuler_observable_coach (annule=TRUE, JAMAIS de
 *              DELETE).
 *          (3) corrigerObservableCoach(evenementUuid, ligneId,
 *              joueurUuid, timecodeVideo?) →
 *              corriger_observable_coach. timecode_video comblé
 *              PAR AJOUT côté SQL (NULL ⇒ COALESCE préserve
 *              l'existant) — interprétation B-Q2/B-Q4 tranchée
 *              par le code C12-j, pas par le client.
 *
 *          LECTURE coach (sql/C12-k, SUIVI-COACH-4, jumelle
 *          lecture de C12-j ; C12-d NON touché) :
 *          (4) getChronologieRencontreCoach(evenementUuid,
 *              inclureAnnulees?) → get_chronologie_rencontre_
 *              coach. Payload contrat-IDENTIQUE à C12-d
 *              (15 colonnes, dont source_saisie & timecode_
 *              video pour B-Q2/B-Q4 ; nom_court PEUT être NULL
 *              tant que C12-nom non câblé). Convention lecture
 *              projet : renvoie un Array, [] sur erreur/vide
 *              (identique SuiviClient.getChronologieRencontre).
 *
 *          CONSOLIDATION coach (sql/C12-e 2-arg, SUIVI-UI-5 ;
 *          C12-e NON modifié — la 2-arg résout déjà l'event et
 *          couvre le coach quand p_token est absent) :
 *          (5) consoliderScoreRencontreCoach(evenementUuid) →
 *              consolider_score_rencontre(p_evenement_uuid)
 *              SANS p_token (= chemin coach). Le score n'est
 *              JAMAIS saisi (I1) : la RPC le LIT et le recopie ;
 *              le coach CONSTATE, ne valide pas (B-Q3 / S-4.2.a).
 *
 *          HELPER :
 *          libelleJoueurSuivi(row) : RÉPLIQUE EXACTE de
 *          SuiviClient.libelleJoueur v1.1 (règle UNIQUE de
 *          dégradation nom_court NULL — ancre = numero_maillot
 *          quand présent, sinon nom_court, sinon '?'). NON une
 *          2ᵉ règle : copie fidèle, car mode-video.html ne
 *          charge PAS suivi-client.js (écran coach). Sur une
 *          ligne de chronologie le payload n'a pas de
 *          numero_maillot → dégrade en nom_court / '?' (limite
 *          acceptée projet tant que C12-nom non câblé).
 *
 *          Posture : tous via SupabaseHub.client (session coach
 *          authentifiée, persistSession:true). L'autorisation
 *          (rôle coach/admin + équipe-staff, Option A) est
 *          PORTÉE PAR LE BACKEND (C12-j/C12-k helpers) et
 *          remontée fidèlement en { ok:false, error } sans être
 *          réinterprétée ni dupliquée côté client (anti-
 *          invention, même principe que PI-7/genererLien).
 *
 *   v1.16 : SUIVI-COACH-1 Objet C-1 (temps de jeu) — 1 wrapper
 *          LECTURE coach. Ajout pur : aucun wrapper v1.0→v1.15
 *          modifié (signatures et retours identiques). Signature
 *          SQL vérifiée À LA SOURCE (sql/C12-l).
 *
 *          LECTURE coach (sql/C12-l, SUIVI-COACH-5 backend levée ;
 *          jumelle COMPO de C12-k ; C12-f NON touché) :
 *          (6) getCompoReduiteRencontreCoach(evenementUuid) →
 *              get_compo_reduite_rencontre_coach. Payload contrat-
 *              IDENTIQUE à get_compo_reduite_rencontre / C12-f §5
 *              (6 colonnes : joueur_uuid, numero_maillot,
 *              poste_uuid, role, etat_joueur, nom_court ; nom_court
 *              PEUT être NULL tant que C12-nom non câblé).
 *              Convention lecture projet : renvoie un Array, []
 *              sur erreur/refus/vide (identique
 *              getChronologieRencontreCoach). Autorisation Option A
 *              (rôle coach/admin + équipe-staff) portée par C12-l
 *              (helpers C12-j réutilisés).
 *
 *          PÉRIMÈTRE : ce wrapper est produit pour le besoin PROPRE
 *          d'Objet C-1 (baseline effectif : titulaires/remplaçants
 *          de la compo de départ pour l'estimation temps de jeu).
 *          Il est GÉNÉRIQUE et PARTAGÉ (PI-5, une seule vérité) ;
 *          son existence NE lève PAS la dégradation picker d'Objet B
 *          (cela exige de toucher mode-video.js, NON modifié ici —
 *          passation §5 respectée). Ajout pur, mode-video.js intact.
 *
 *   v1.17 : Refonte Évènements (Production · Évènements) — mise en
 *          cohérence AVAL de la migration SQL v1.1→v1.2 (M1/M2/M6),
 *          NIVEAU 1 SEUL (conséquent, prouvable par diff). Les
 *          wrappers liaison/adversaires M3/M5 sont VOLONTAIREMENT
 *          différés à un commit séparé (leur contrat dépend de
 *          l'UX U1→U4 ; ne pas inventer une signature « parce qu'il
 *          en faut une » — anti-pattern DS-1). Trois interventions,
 *          AUCUN wrapper v1.0→v1.16 modifié dans sa logique :
 *
 *          (1) createEvenement() : ajout de 'recurrence' à la
 *              whitelist allowedFields (M2 — la colonne JSONB
 *              nullable existe désormais en base, migration v1.2
 *              §5.1 commitée). Sans cet ajout, le champ M2 serait
 *              filtré silencieusement et donc inopérant. Aucune
 *              autre clé touchée ; État initial 'creation' inchangé.
 *
 *          (2) addMatchToTournoi() : CORRECTION D'UNE RÉGRESSION
 *              introduite par la migration. Le garde-fou lisait
 *              parent.type_evenement !== 'tournoi' ; or M1 a remappé
 *              'tournoi' → 'competition' en base, donc plus AUCUN
 *              parent ne satisfait l'ancien test → tout ajout de
 *              match à un tournoi existant échouait. Remplacé par la
 *              convention M6 (v1.2 §4.4) : un parent valide =
 *              type_evenement === 'competition' ET
 *              evenement_parent_id IS NULL (Compétition racine, pas
 *              une phase-boîte ni un match). type_evenement de
 *              l'enfant : 'match' → 'competition' (le domaine
 *              technique 'match' n'existe plus, CHECK v1.2). Défaut
 *              type_competition hérité : 'tournoi' (TOUJOURS valide —
 *              présent dans les 10 sous-types) ; conservé tel quel.
 *
 *          (3) JSDoc createEvenement / addMatchToTournoi : domaines
 *              CHECK périmés corrigés (étaient match/entrainement/
 *              stage/tournoi/journee_championnat et championnat/
 *              amical/coupe/tournoi → désormais competition/
 *              entrainement/stage et les 10 sous-types). Doc only.
 *
 *   v1.18 : Refonte Évènements (Production · Évènements) — wrappers
 *          LECTURE des tables M3/M5 créées par la migration v1.2 §5.1
 *          (evenement_equipes_engagees, evenement_adversaires).
 *          Ajout pur : aucun wrapper v1.0→v1.17 modifié.
 *
 *          (1) getEquipesEngagees(evenementId) : liste des équipes
 *              engagées d'une compétition (liaison M3), triée par
 *              `ordre` NULLS LAST puis date_creation. Inclut le
 *              format override par équipe (M4). Array, [] sur
 *              erreur/vide (convention projet, cf.
 *              getChronologieRencontreCoach).
 *
 *          (2) getAdversairesEvenement(evenementId) : adversaires
 *              d'une compétition SANS phases (M5), résolus via la
 *              liaison M3 (jointure equipe engagée → adversaires),
 *              triés par equipe puis `ordre`. Array, [] idem.
 *              NB frontière M5↔M6 (v1.2 §4.4) : pour les compétitions
 *              À phases, l'adversaire est porté par evenements.
 *              adversaire_nom du match (déjà lu par les RPC/wrappers
 *              événement existants) — CE wrapper ne couvre QUE le
 *              cas sans phases, par construction.
 *
 *          DETTE WRITE M3/M5 (tracée, non livrée ici) : les 2 tables
 *          ont RLS activé, SELECT authenticated, AUCUNE policy write
 *          (patron déployé voulu, v1.2 §4.3/4.4 ; identique à
 *          `evenements` dont les écritures sont service_role-only).
 *          Des wrappers d'écriture seraient rejetés par RLS à la
 *          livraison → NON livrés (pas de faux silencieux, cohérent
 *          UX §2.5). Même nature de dette que P2-E.4
 *          (evenement_encadrants write) et P4-write (evenements
 *          write) : à lever ensemble en session RLS write par rôle
 *          dédiée (préexistante au STATE). La modale U1→U4
 *          (fichiers browser à venir) câblera la SAISIE ; l'écriture
 *          effective M3/M5 dépend de cette dette, comme createEvenement
 *          en dépend déjà aujourd'hui.
 *
 *   v1.19 : Session RLS write par rôle (Production) — wrappers ÉCRITURE
 *          M3/M5. Lève la DETTE WRITE M3/M5 tracée en v1.18 (la RLS
 *          write est désormais posée : sql/41-rls-write-evenements-
 *          filles, INSERT/UPDATE/DELETE = has_role admin|coach,
 *          calquée sur le patron evenements déployé). Ajout pur :
 *          aucun wrapper v1.0→v1.18 modifié dans sa logique.
 *
 *          (1) addEquipeEngagee(evenementId, payload) : INSERT M3
 *              (evenement_equipes_engagees). Whitelist : equipe_id
 *              (requis), format_de_jeu, ordre, notes. Patron write
 *              identique createEvenement (insert→select→maybeSingle,
 *              { ok, data? | error }).
 *
 *          (2) removeEquipeEngagee(liaisonId) : DELETE M3 par id de
 *              liaison (décocher une équipe, UX §2.4/4a). Le ON DELETE
 *              CASCADE de sql/40 supprime automatiquement les
 *              adversaires M5 rattachés (zéro orphelin, pas de delete
 *              applicatif en cascade à écrire).
 *
 *          (3) addAdversaire(evenementEquipeId, payload) : INSERT M5
 *              (evenement_adversaires). Whitelist : adversaire_nom
 *              (requis), ordre, notes. NB asymétrie M3↔M5 : la table
 *              M5 n'a NI cree_par NI updated_at/trigger (sql/40
 *              §M5) — payload volontairement plus court que M3,
 *              ce n'est pas un oubli.
 *
 *          (4) removeAdversaire(adversaireId) : DELETE M5 par id.
 *
 *          cree_par NON renseigné (homogène createEvenement déployé :
 *          pas de mapping auth→personnes en base, l'autorisation est
 *          portée par la RLS has_role, le client ne s'auto-identifie
 *          pas comme personne — décision technique consignée).
 *          Convention de retour { ok, data? , error? } = patron WRITE
 *          du fichier (createEvenement / updateLogistique), PAS le
 *          patron lecture []/Array des wrappers v1.18.
 *
 *          NON livré ici, volontairement (anti-DS-1, pas de code sans
 *          appelant) : aucun wrapper update* M3/M5 (aucune UX U1→U4
 *          livrée ne modifie une ligne de liaison existante ; la
 *          policy UPDATE existe en base mais resterait sans appelant).
 *          Staff P2-E.4 (evenement_encadrants write) : MÊME nature,
 *          traité dans une étape séparée (Bloc 5 désactivé option b,
 *          câblage distinct du Bloc 4a — une étape = un livrable).
 *
 *   v1.20 : Session RLS write par rôle (Production) — 1 wrapper LECTURE
 *          getCategorieEquipe(equipeId). Résout la catégorie d'une
 *          équipe via la chaîne RÉELLE equipes.entente_id →
 *          ententes.categorie_id (sql/01 lu à la source, NON devinée ;
 *          entente_id + categorie_id sont NOT NULL → résolution sûre).
 *          Sert à alimenter listEquipes(categorieId) pour le Bloc 4a
 *          dans le module M14-mono-équipe (categorieId dérivé de
 *          M14_TEAM_UUID côté browser — décision périmètre Manu
 *          "option A" : M14 en dur, comme tout le module ; le
 *          multi-catégorie/multi-coach est la dette de fond
 *          "liaison auth→équipe→saison", chantier séparé tracé).
 *          Ajout pur : aucun wrapper v1.0→v1.19 modifié.
 *          Convention de retour : { ok, data? , error? } — c'est une
 *          lecture ciblée à résultat unique (pattern maybeSingle,
 *          comme le fallback contexte modal evenements-browser).
 *
 *   v1.21 : Session RLS write par rôle (Production) — getAdversaires
 *          Evenement expose désormais `id` (id de la ligne
 *          evenement_adversaires) dans l'objet aplati. Le SELECT le
 *          récupérait DÉJÀ (`evenement_adversaires ( id, … )`) ; il
 *          était simplement non recopié dans out.push → un appelant
 *          ne pouvait pas cibler un adversaire pour removeAdversaire.
 *          Strictement ADDITIF : 1 clé ajoutée en tête de l'objet,
 *          AUCUNE clé existante touchée (ordre/contenu des autres
 *          champs inchangés) ; aucun autre wrapper modifié ; aucun
 *          nouveau SQL ni RPC. Requis par evenements-browser v1.20
 *          (édition engagement depuis la fiche : retrait adversaire).
 *   v1.22 : Collectif & compo 3 niveaux (Production) — couche données
 *          N1/N2/N3. 9 wrappers ADDITIFS, patrons STRICTEMENT calqués
 *          sur les wrappers M3/M5 (addEquipeEngagee/removeEquipeEngagee)
 *          et compo (updateJoueurCompo/getCompoComplete) déployés —
 *          rien réinventé (PI-5). Modèle Modelisation-Collectif-Compo-
 *          3-Niveaux-v1.md v1.1 fait foi ; DDL sql/44 collectif_membre
 *          / sql/45 equipe_engagee_membre / sql/46 compositions.
 *          evenement_equipe_id (exécutés+vérifiés en base 19/05).
 *          N1 : listCollectifMembres, addCollectifMembre,
 *               updateCollectifMembre, listEntentes.
 *          N2 : listGroupeEngage, addGroupeMembre, removeGroupeMembre.
 *          N3 : getCompoForEvenementEquipe, setCompoEvenementEquipe.
 *          PAS de removeCollectifMembre (UA-4 sortie = date_fin datée,
 *          jamais DELETE — aucun appelant, anti-DS-1, précédent sql/43).
 *          Strictement ADDITIF : 9 méthodes + version + ce changelog ;
 *          AUCUNE méthode existante touchée ; aucun nouveau SQL/RPC ;
 *          autorisation = RLS par rôle (patron sql/43), aucun mapping
 *          auth→personnes (IDENT-SYS hors périmètre). Bascule de saison
 *          (UA-5/A-3) NON incluse ici — couloir U-admin (sous-décision
 *          mécanisme à trancher). Incohérence préexistante NON touchée
 *          (tracée, non absorbée) : le console.log de boot affiche
 *          encore « v1.16 chargé » (≠ header) — antérieure à cette
 *          passe, à reprendre en passe dédiée pour ne pas élargir le
 *          périmètre (précédent STATE pt 5 arbo suivi-app).
 *   v1.23 : Collectif & compo 3 niveaux (Production) — U-N2 entrée.
 *          1 wrapper ADDITIF getEvenementEquipeContext(evtEqId) :
 *          résolveur du point d'entrée de l'écran Groupe de base
 *          (doc UX §2 UN2-1). 1 requête imbriquée
 *          evenement_equipes_engagees → evenements (titre/date,
 *          « Plateau · date ») + equipes → ententes (entente_id =
 *          source N1 du vivier, « Collectif · saison » ; via
 *          equipes.entente_id NOT NULL, sql/01 — PAS de devinette
 *          de saison). Patron getCategorieEquipe (embed prouvé
 *          déployé+recetté) ; maybeSingle. Évite une résolution
 *          multi-sauts client fragile (anti-hypothèse). Strictement
 *          ADDITIF : 1 méthode + version + changelog ; AUCUNE
 *          méthode existante touchée ; aucun nouveau SQL/RPC ;
 *          aucune colonne inventée (toutes vérifiées sql/01/sql/42
 *          ou usage déployé). console.log boot v1.16 toujours NON
 *          touché (incohérence préexistante tracée, non absorbée).
 *   v1.24 : Collectif & compo 3 niveaux (Production) — U-admin (i).
 *          1 wrapper ADDITIF listJoueursCategorieEntente(ententeId) :
 *          pioche de l'écran U-admin (doc UX §4). « Joueurs de la
 *          catégorie » = personnes affectées (equipe_joueurs ACTIVE,
 *          date_sortie IS NULL) à une equipe dont entente_id =
 *          l'entente. Chemin VÉRIFIÉ à la source sql/01
 *          (ententes.categorie_id ← equipes.entente_id ←
 *          equipe_joueurs). ÉCART ASSUMÉ Manu (tracé clôture) :
 *          equipe_joueurs sert UNIQUEMENT à peupler la liste de
 *          pioche UI (candidats à l'instant T) — le STOCKAGE N1
 *          reste autonome (addCollectifMembre n'écrit JAMAIS
 *          equipe_joueurs ; modèle N1-2 « pas adossé » tenu au
 *          sens structurel). Patron embed listEquipes/getCompo
 *          Complete (prouvé déployé). Strictement ADDITIF : 1
 *          méthode + version + changelog ; AUCUNE méthode existante
 *          touchée ; aucun SQL/RPC neuf ; colonnes vérifiées sql/01
 *          (equipe_joueurs.date_sortie/personne_id/equipe_id ;
 *          equipes.entente_id ; personnes.nom/prenom). console.log
 *          boot v1.16 toujours NON touché (tracé, non absorbé).
 *   v1.25 : FIX PGRST201 (Production, prouvé terrain — la base
 *          fait foi). collectif_membre a 2 FK vers personnes
 *          (collectif_membre_personne_id_fkey ET
 *          collectif_membre_cree_par_fkey, vérifiées pg_constraint
 *          à la source) -> l'embed `personnes ( … )` était AMBIGU
 *          (PostgREST refuse : « Could not embed because more than
 *          one relationship was found »). listCollectifMembres
 *          plantait (renvoyait [] -> vivier U-N2 vide, pioche
 *          U-admin vide) ; listGroupeEngage portait la même
 *          ambiguïté LATENTE (sous-embed personnes via
 *          collectif_membre). FIX MINIMAL : embed désambiguïsé par
 *          le nom EXACT de la FK voulue
 *          (personnes!collectif_membre_personne_id_fkey) — vérifié
 *          source pg_constraint, NON deviné. STRICTEMENT 2 lignes
 *          d'embed modifiées (listCollectifMembres + sous-embed
 *          listGroupeEngage) + version + changelog. AUCUNE autre
 *          ligne, AUCUNE signature, AUCUN wrapper supplémentaire
 *          touché. listJoueursCategorieEntente (1 seule FK
 *          personnes, prouvé OK 62 terrain) et
 *          getEvenementEquipeContext (embeds 1-FK) INTACTS.
 *          node --check OK. console.log boot v1.16 NON touché.
 *   v1.26 : FIX noms via RPC (Production — prouvé terrain : SQL
 *          direct OK mais embed personnes = '' partout). CAUSE
 *          RACINE (constat source) : `personnes` RLS active + 0
 *          policy ⇒ embed PostgREST `personnes(...)` renvoie NULL
 *          (verrou RGPD délibéré). FIX : sql/47 câble C12-nom
 *          (chronologie_nom_court_personne) ET ajoute la RPC en
 *          lot get_noms_personnes(uuid[]) gardée has_role(admin|
 *          coach). Côté client : helper privé _resolveNoms(uuids)
 *          (1 appel RPC → Map) ; listCollectifMembres /
 *          listGroupeEngage / listJoueursCategorieEntente
 *          retirent l'embed personnes MORT et injectent les noms
 *          via le helper. Structures de sortie INCHANGÉES (les
 *          appelants groupe-base.js/u-admin.js lisent .personnes
 *          .nom et .nom — formes préservées à l'identique). Décision
 *          Manu (option 2, tracée clôture) : absorption résolution
 *          dette transverse C12-nom + arbitrage RGPD « Prénom NOM »
 *          (Manu informé chemin jeton public, assumé). Modif
 *          bornée : version+changelog + 1 helper + 3 wrappers
 *          (embed retiré, helper injecté) ; aucune autre méthode,
 *          aucune signature publique touchée ; node --check OK.
 *          console.log boot v1.16 toujours NON touché.
 *   v1.27 : Étape (c) U-N3 — extension additive createCompo pour
 *          accepter `evenement_equipe_id` optionnel (sql/46
 *          additif, colonne UUID NULL). NULL = comportement
 *          legacy mono-équipe strictement inchangé (rétro-compat
 *          prouvée). Renseigné = compo rattachée à l'équipe
 *          engagée (modèle Collectif v1.1 §4 N3-1, option A
 *          actée 20/05 conv (c)). Garde de cohérence ajoutée :
 *          `evenement_equipe_id` REFUSÉ avec `type_compo='match'`
 *          (pendant exact du pattern existant pour
 *          `compo_base_origine_id` + `type_compo='base'`) — les
 *          matchs dérivent leur équipe engagée via `compo_base_
 *          origine_id` (Q1a actée). `duplicateCompoFromBase`
 *          NON touché (matchs ne portent rien — modèle pur).
 *          2 call-sites existants prouvés rétro-compat (ne
 *          passent pas le nouveau paramètre) : duplicateCompoFrom
 *          Base l. 1874 (interne) et compositions-editor.js l.
 *          833 (mode legacy v3.7). Modif bornée : version +
 *          changelog + 1 wrapper (1 garde + 1 ligne payload) ;
 *          aucune autre méthode, aucune signature publique
 *          touchée ; node --check OK. console.log boot v1.16
 *          toujours NON touché (incohérence préexistante pt 13,
 *          hors périmètre).
 *   v1.28 : FIX projection getCompoForEvenementEquipe (bug
 *          pré-existant v1.26, masqué jusqu'ici car le wrapper
 *          n'avait pas d'appelant avant compositions-editor v3.8).
 *          Détecté à la recette terrain Manu 20/05 (essai 2 puis
 *          essai 3) : 1 seul clic sur le CTA « Créer la compo de
 *          base » créait bien la base en DB, mais l'éditeur
 *          réaffichait le CTA après reload car State.compos
 *          restait []. Le coach cliquait à nouveau, l'INSERT
 *          était refusé par sql/50 (idx_compositions_active_base
 *          _per_event_equipe_cote a fait son travail honnête,
 *          P4) → alert 409 affichée. CAUSE RACINE tranchée par
 *          le fait (sondes console : state.compos=[] puis KEYS
 *          retournées par getCompoForEvenementEquipe = 10 champs
 *          SANS type_compo). La projection .select() du wrapper
 *          omettait `type_compo` ET `compo_base_origine_id` →
 *          loadComposForCurrentEvent U-N3 cherchait
 *          .find(c => c.type_compo === 'base') sur un champ
 *          undefined → base=null → State.compos=[] → CTA
 *          réaffiché en boucle.
 *
 *          FIX : 2 champs ajoutés à la projection
 *          (type_compo + compo_base_origine_id). Discipline :
 *          on ne corrige que ce qui est cassé (P1 + pt 15 anti-
 *          débordement). Pas d'autres champs ajoutés sans usage
 *          réel pour les justifier.
 *
 *          Note traçage anti-hypothèse honnête : v3.9 (livrée
 *          au tour précédent) ajoutait une garde anti-concurrence
 *          dans onCreateBaseClick motivée par une hypothèse
 *          double-clic UX. Le fait l'a inversée — c'était UN
 *          SEUL clic à chaque fois (recette Manu : « 1 seul
 *          clic »). La garde v3.9 reste DÉFENSIVE UTILE (un
 *          vrai double-clic pourrait théoriquement survenir),
 *          mais elle ne fixait pas ce bug-ci. v1.28 fixe la
 *          cause racine réelle. Discipline pt 15 : inverser
 *          une hypothèse par le fait est un signal de BON
 *          fonctionnement de la méthode, pas un échec.
 *
 *          Modif bornée : version + changelog + 1 ligne
 *          projection .select() (2 champs ajoutés). Aucune
 *          autre méthode, aucune signature publique touchée ;
 *          aucun call-site touché (la projection enrichie est
 *          transparente pour les appelants existants).
 *          node --check OK. console.log boot v1.16 toujours
 *          NON touché.
 *   v1.29 : HYGIÈNE — bump console.log boot (conv `Production ·
 *          Hygiène — console.log boots + nettoyage données test`,
 *          pt 17). Le console.log de boot affichait encore
 *          « v1.16 chargé » depuis la passe Suivi A (mai 2026)
 *          alors que les bumps v1.17 → v1.28 (12 maillons, dont
 *          la chaîne Refonte Évènements + Session RLS write +
 *          Collectif & compo 3 niveaux + étape c U-N3) avaient
 *          tous laissé la ligne intacte, hors périmètre récurrent
 *          (incohérence préexistante tracée pt 13/15/16). S2
 *          option a actée pt 17 : libellé version-only durable,
 *          le changelog header raconte l'histoire, le console.log
 *          dit juste l'identité chargée.
 *
 *          Modif bornée : version header v1.28 → v1.29 + 1 entrée
 *          changelog (celle-ci) + 1 chaîne de caractères dans le
 *          console.log boot (`v1.16 chargé` → `v1.29 chargé`).
 *          Aucune méthode touchée. Aucune signature publique
 *          touchée. Aucun call-site touché. 3 hunks ciblés, diff
 *          prouvé minimal. Provenance md5 chaîne maillon par
 *          maillon : v1.28 fad1439c → v1.29 (recollé par Manu
 *          après écriture). node --check OK.
 *
 *   v1.30 : Refonte UX Évt→Compo (Production · 27/05/2026, pt 19) —
 *          1 NOUVEAU WRAPPER additif consommant la RPC composite
 *          sql/52 creer_evenement_complet (SECURITY DEFINER,
 *          transaction atomique côté serveur, 18 paramètres). Voie
 *          « rapide » de la modale création refondue 5 modes
 *          adaptatifs (doc UX FAIT FOI §3.1, R3 §3.1.6).
 *
 *          (1) createEvenementComplet(payload) : invocation RPC
 *              avec mapping payload JS → paramètres SQL (préfixe
 *              p_), validation minima côté client cohérente avec
 *              la garde RPC serveur (6 champs requis :
 *              type_evenement, libelle, code, date_debut, saison_id,
 *              organisateur_principal_id). Retour { ok, evenementId,
 *              error? } homogène avec les autres wrappers Évènements.
 *
 *          Différence avec createEvenement (v1.17) :
 *            - createEvenement       = INSERT racine REST seul,
 *                                      voie « lente » fiche pour
 *                                      ajout progressif M3/M5/M6/
 *                                      M8/N2 (wrappers REST séparés,
 *                                      R4 §3.1.6 — INTACT).
 *            - createEvenementComplet = transaction unique RPC
 *                                       côté serveur, tout-ou-rien
 *                                       atomique D-Q1, voie
 *                                       « rapide » modale.
 *
 *          ADDITION PURE prouvée par diff vs original v1.29
 *          vérifié md5 5ce8cb87 : seules 4 zones touchées —
 *          (a) version header 1.29 → 1.30 (1 ligne),
 *          (b) entrée changelog (ce bloc, addition pure),
 *          (c) ajout fonction createEvenementComplet juste après
 *              createEvenement (1 bloc additif autonome),
 *          (d) console.log boot v1.29 chargé → v1.30 chargé
 *              (1 ligne).
 *          Wrappers v1.0 → v1.29 byte-identiques (preuve par diff).
 *          Aucune signature publique modifiée. Aucun call-site
 *          modifié. Provenance md5 chaîne maillon par maillon :
 *          v1.29 5ce8cb87 → v1.30 (recollé après écriture).
 *          node --check OK.
 *   v1.31 : ADMIN-(ii) sous-chantier (1) Équipes par catégorie +
 *          (3) Ententes intégré (Production · 28/05/2026, pt 21).
 *          9 NOUVEAUX WRAPPERS additifs, colonnes TOUTES confirmées
 *          à la source (information_schema 28/05, aucune inventée —
 *          doc FAIT FOI Conception-UX-ADMIN-ii-v1.md md5 ca043a48) :
 *            LECTURE (4)
 *            - getPolesAvecCategories() : grille pôle → catégories
 *              actives du club. Mapping = poles.categories_rattachees
 *              (TEXT[] de codes catégorie) confirmé source → lève le
 *              candidat de la dette IMPL-CAT-ACTIVES-MAPPING ; M5
 *              exclue par construction (absente des tableaux).
 *              Jointure côté client par categories.code.
 *            - getEntenteCadre(categorieId, saisonId) : le cadre
 *              UNIQUE(saison_id, categorie_id) (≤ 1). data=null =
 *              cas F15/F18 « catégorie sans cadre ».
 *            - listEquipesByEntentes(ententeIds) : équipes de N
 *              ententes en 1 appel (.in), tous statuts/toute saison
 *              (grille admin) — vs listEquipes() active-only.
 *            - listSaisons() : bandeau saison (D4). Colonnes réelles
 *              id/code/libelle/date_debut/date_fin/est_active (PAS
 *              de `statut` : JSON saison divergent). Classement
 *              passé / active / futur dérivé côté écran. Sans filtre
 *              est_active (passées consultables, lecture seule UI).
 *            ÉCRITURE equipes (3)
 *            - createEquipe(payload)  : requis code / nom_officiel /
 *              entente_id (déduit du contexte, NON saisi).
 *            - updateEquipe(equipeId, patch) : PATCH partiel.
 *            - setEquipeStatut(equipeId, statut) : active/inactive,
 *              jamais de suppression dure (préserve l'historique evts).
 *            ÉCRITURE ententes (2)
 *            - createEntente(payload)  : cas rare F15/F18.
 *            - updateEntente(ententeId, patch) : régime / clubs /
 *              convention ; ancre saison_id × categorie_id IMMUABLE.
 *
 *          ⚠️ Chemin write « admin seul v1 » (doc §3.1 D2) : SUPPOSE
 *          une policy RLS write has_role('admin') sur equipes ET
 *          ententes. À CONFIRMER (pg_policies) AVANT recette terrain
 *          — leçon REFONTE-EVT-write-M3/M5 : RLS write absente =
 *          écriture silencieuse dans le vide (faux involontaire).
 *          Si absente, RLS DDL (patron sql/43) à livrer en commit
 *          séparé. Les wrappers eux sont corrects quel que soit
 *          l'état RLS (la base tranche).
 *
 *          ADDITION PURE prouvée par diff vs original v1.30 vérifié
 *          md5 b545c588 : 4 zones touchées —
 *          (a) version header 1.30 → 1.31 (1 ligne),
 *          (b) entrée changelog (ce bloc, addition pure),
 *          (c) 1 section contiguë de 9 méthodes en fin d'objet
 *              (virgule ajoutée après consoliderScoreRencontreCoach,
 *              dernier membre devenu non-terminal),
 *          (d) console.log boot v1.30 → v1.31 chargé (1 ligne).
 *          Wrappers v1.0 → v1.30 byte-identiques (preuve par diff).
 *          Aucune signature publique modifiée. Aucun call-site
 *          modifié. Provenance md5 : v1.30 b545c588 → v1.31 (recollé
 *          après écriture). node --check OK.
 *   v1.32 : ADMIN-(ii) sous-chantier (4) Sites — écran admin sites.
 *          Doc FAIT FOI Conception-UX-ADMIN-ii-v1.md §3.2. 4 wrappers
 *          ADDITIFS Sites, miroir du couple equipes :
 *            - listSites(options) : TOUS les sites (actifs + inactifs),
 *              projection riche (grille admin) — vs listSitesActifs()
 *              active-only INTACT (alimente le dropdown évènement).
 *            - createSite(payload) : requis libelle ; `code` AUTO-
 *              dérivé du libellé si absent (slug majuscule + suffixe
 *              base36 court anti-collision — `code` est NOT NULL SANS
 *              défaut DB, vérifié information_schema 28/05, donc c'est
 *              au client de le fournir ; décision technique déléguée
 *              tracée). `pays` non envoyé (défaut DB 'France') ;
 *              `club_principal_id` non exposé (NULL inutilisé, doc) ;
 *              `actif` non envoyé (défaut DB true), toggle via
 *              setSiteActif. Whitelist = colonnes réelles `sites`.
 *            - updateSite(siteId, patch) : PATCH partiel ; whitelist
 *              SANS `code` (identifiant stable, non édité) NI `actif`
 *              (chemin dédié setSiteActif, jamais deux écritures du
 *              booléen).
 *            - setSiteActif(siteId, actif) : bascule du BOOLÉEN `actif`
 *              (≠ setEquipeStatut qui écrit un statut TEXTE — `sites`
 *              n'a pas de colonne statut ; vérifié information_schema).
 *              Pas de DELETE dur (une policy DELETE admin existe en
 *              base mais doctrine = bascule actif, on ne l'expose pas).
 *
 *          Schéma + RLS `sites` LUS À LA SOURCE (information_schema +
 *          pg_policies, 28/05, anti-fabrication pt 14 ; la base fait
 *          foi, pas sql/01) : 19 colonnes ; write = has_role('admin')
 *          SEUL sur INSERT/UPDATE/DELETE (≠ equipes admin|coach) →
 *          aligne la garde UI admin-strict d'admin-sites.html. Aucune
 *          colonne devinée. NB : evenements-browser.js v1.26 lit DÉJÀ
 *          les sites via listSitesActifs (pas de constante en dur à
 *          remplacer, contrairement au libellé de la passation —
 *          vérifié à la source) → NON touché par ce chantier.
 *
 *          ADDITION PURE prouvée par diff vs original v1.31 vérifié
 *          md5 fb1fa7f5 : 4 zones touchées —
 *          (a) version header 1.31 → 1.32 (1 ligne),
 *          (b) entrée changelog (ce bloc, addition pure),
 *          (c) 1 section contiguë de 4 méthodes Sites insérée APRÈS
 *              listSitesActifs (virgule déjà terminale, aucun membre
 *              voisin muté),
 *          (d) console.log boot v1.31 → v1.32 chargé (1 ligne).
 *          Wrappers v1.0 → v1.31 byte-identiques (preuve par diff).
 *          Aucune signature publique modifiée. Aucun call-site
 *          modifié. Provenance md5 : v1.31 fb1fa7f5 → v1.32 (recollé
 *          après écriture). node --check OK.
 *
 *   v1.33 : ADMIN-(ii) sous-chantier (2) Saisons + bascule millésime.
 *          Doc FAIT FOI Conception-UX-ADMIN-ii-v1.md §3.4. 4 wrappers
 *          ADDITIFS appelant les RPC SECURITY DEFINER de sql/53 (md5
 *          304c37f6, gardées has_role('admin')) — saisons ET personnes
 *          ont une RLS write FERMÉE au client (sondes 28/05 : saisons =
 *          1 seule policy SELECT publique, aucune write ; personnes = 0
 *          policy), donc le bulk client est IMPOSSIBLE (écrirait dans le
 *          vide, leçon REFONTE-EVT-write-M3/M5) → TOUT passe par RPC :
 *            - createSaison(payload) : RPC creer_saison ; requis code /
 *              libelle / date_debut / date_fin ; est_active=false
 *              (activation = geste séparé). CHECK(date_fin>date_debut) +
 *              UNIQUE(code) appliqués par la base (fail-loud).
 *            - setSaisonActive(saisonId) : RPC activer_saison ; désactive
 *              l'active courante PUIS active la cible, atomique (respecte
 *              idx_saisons_une_seule_active, index unique partiel mono-
 *              active lu à la source 28/05).
 *            - apercuBascule(saisonId) : RPC apercu_bascule, LECTURE
 *              SEULE ; calcul serveur (personnes JAMAIS exposée, 0 policy
 *              SELECT), payload RGPD minimal {personne_id, nom_court,
 *              cat_avant, cat_apres, groupe, motif} ; 3 groupes
 *              a_basculer / inchange / a_verifier.
 *            - appliquerBascule(saisonId) : RPC appliquer_bascule,
 *              ÉCRITURE DE MASSE ; RECALCUL serveur (ne fait pas confiance
 *              au client) + UPDATE personnes.categorie_id + INSERT
 *              bascule_log, transaction fail-loud ; derrière garde-fou UI.
 *          listSaisons() (lecture, bandeau D4) existe depuis v1.31, NON
 *          touchée. Règle figée + scope PROUVÉS par exécution réelle
 *          (28/05 : 207 dans le scope = 77 a_basculer / 65 inchange /
 *          65 a_verifier ; séniors/loisir age_max NULL exclus, D6=A).
 *
 *          ADDITION PURE prouvée par diff vs original v1.32 vérifié
 *          md5 c1c5b41b : 4 zones touchées —
 *          (a) version header 1.32 → 1.33 (1 ligne),
 *          (b) entrée changelog (ce bloc, addition pure),
 *          (c) 1 section contiguë de 4 méthodes Saisons insérée APRÈS
 *              updateEntente (virgule ajoutée à sa fermeture, dernier
 *              membre de l'objet ; aucun voisin muté),
 *          (d) console.log boot v1.32 → v1.33 chargé (1 ligne).
 *          Wrappers v1.0 → v1.32 byte-identiques (preuve par diff).
 *          Aucune signature publique modifiée. Aucun call-site modifié.
 *          Provenance md5 : v1.32 c1c5b41b → v1.33 (recollé après
 *          écriture). node --check OK.
 *   v1.34 : Production · Écran de gestion du staff (collectif N1). 1
 *          wrapper ADDITIF listStaffDisponibles() alimentant la pioche
 *          staff de u-admin (option A : déroulante des personnes staff).
 *          Calque _resolveNoms / listJoueursCategorieEntente : RPC
 *          SECURITY DEFINER gardée (sql/56 list_staff_disponibles),
 *          PAS de SELECT client — `personnes` a 0 policy RLS (acté
 *          v1.33), seul chemin de lecture = RPC. Sortie INCHANGÉE et
 *          alignée sur listJoueursCategorieEntente : [{personne_id, nom,
 *          prenom}] trié, [] si erreur (dégradation honnête). Filtre
 *          staff = categorie_personne ILIKE '%staff%' LU À LA SOURCE
 *          (sonde GROUP BY 28/05 : staff+parent_et_staff+joueur_et_
 *          parent_et_staff = 46 ; aucune colonne devinée — personnes n'a
 *          PAS de colonne `role`, le filtre vit dans categorie_personne).
 *          Côté écriture : RIEN de neuf — addCollectifMembre accepte déjà
 *          role:'staff' (v1.24) et la RLS write collectif_membre admin|
 *          coach passe (patron addEquipeEngagee prouvé déployé), donc
 *          aucune RPC d'écriture ni SECURITY DEFINER write requise pour
 *          le staff. listCollectifMembres({role:'staff'}) existe déjà.
 *
 *          ADDITION PURE prouvée par diff vs original v1.33 vérifié
 *          md5 fa6603c2 : 4 zones touchées —
 *          (a) version header 1.33 → 1.34 (1 ligne),
 *          (b) entrée changelog (ce bloc, addition pure),
 *          (c) 1 méthode listStaffDisponibles insérée en fin d'objet
 *              APRÈS appliquerBascule (virgule ajoutée à sa fermeture,
 *              dernier membre de l'objet ; aucun voisin muté),
 *          (d) console.log boot v1.33 → v1.34 chargé (1 ligne).
 *          Wrappers v1.0 → v1.33 byte-identiques (preuve par diff).
 *          Aucune signature publique modifiée. Aucun call-site modifié.
 *          Provenance md5 : v1.33 fa6603c2 → v1.34 (recollé après
 *          écriture). node --check OK.
 *
 *   v1.35 : Horaires détaillés — ÉTAPE 3/4 (wrapper). createEvenementComplet
 *          mappe désormais 4 nouveaux champs du payload vers les paramètres
 *          RPC v7 : p_debut_match/p_fin_prevue/p_rdv_heure (TIME),
 *          p_rdv_lieu (TEXT), absents → null (DEFAULT côté SQL). Va de pair
 *          avec evenements-browser v1.42 (lecture des champs) + RPC v7 +
 *          migration colonnes. ADDITION PURE : 3 zones —
 *          (a) version header 1.34 → 1.35,
 *          (b) entrée changelog (ce bloc),
 *          (c) 4 lignes ajoutées dans rpcParams (après p_affectations_n2 ;
 *              virgule ajoutée à sa ligne ; aucun autre mapping muté),
 *          + console.log boot 1.34 → 1.35.
 *          Aucune autre signature/call-site modifié. node --check OK.
 *
 *   v1.36 : listStaffDisponibles(categorieId) — param optionnel transmis à
 *          la RPC list_staff_disponibles v2 (p_categorie_id). Fourni →
 *          staff de la catégorie (fonction active fonction_staff) ; absent/
 *          null → tout le staff (inchangé). Sortie {personne_id,nom,prenom}
 *          inchangée. Va de pair avec evenements-browser v1.46 (case
 *          « Afficher tout le staff »). ADDITION : signature élargie (1 arg
 *          optionnel) + passage p_categorie_id au rpc() ; + console.log boot
 *          1.35 → 1.36. node --check OK.
 *
 *   v1.37 : Wrapper modifierEvenementComplet(evenementId, payload) — édition
 *          complète via RPC modifier_evenement_complet (sql/53). Symétrique
 *          de createEvenementComplet : même payload (sans code/saison/
 *          organisateur, conservés serveur) + l'id en tête. Mappe les params
 *          p_* (méta + horaires + équipes + phases + encadrants + N2).
 *          ADDITION PURE : 1 méthode insérée après createEvenementComplet ;
 *          + console.log boot 1.36 → 1.37. node --check OK.
 */

(function (global) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================
  const SUPABASE_URL = 'https://fvfqffxaiaoygqhjtxwr.supabase.co';

  // CLÉ ANON PUBLIQUE — pas un secret, sécurisée par RLS Supabase
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2ZnFmZnhhaWFveWdxaGp0eHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjgyNzQsImV4cCI6MjA5NDAwNDI3NH0.1WgEmHTuI00CuKpWflvu5SqZ4ScoEpQgZ7ijJt5OQ00';

  // ============================================================
  // INITIALISATION
  // ============================================================
  if (typeof supabase === 'undefined') {
    console.error(
      '❌ MOM Hub: la bibliothèque @supabase/supabase-js n\'est pas chargée. ' +
      'Ajoute <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script> AVANT supabase-client.js'
    );
    return;
  }

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // Cache mémoire des rôles (Phase 2.5.4)
  let _rolesCache = null;

  // ============================================================
  // API PUBLIQUE
  // ============================================================
  const SupabaseHub = {

    client: client,

    async ping() {
      try {
        const { data, error } = await client
          .from('poles')
          .select('code')
          .limit(1);
        if (error) throw error;
        return { ok: true, message: '✅ Connexion Supabase OK', data };
      } catch (err) {
        return { ok: false, message: '❌ Connexion Supabase KO', error: err };
      }
    },

    // ----------------------------------------------------------
    // RÉFÉRENTIELS PUBLICS
    // ----------------------------------------------------------

    async getPoles() {
      const { data, error } = await client.from('poles').select('*').order('uuid_legacy');
      if (error) throw error;
      return data;
    },

    async getCategories() {
      const { data, error } = await client.from('categories').select('*').order('ordre_tri');
      if (error) throw error;
      return data;
    },

    async getClubs() {
      const { data, error } = await client.from('clubs').select('*').order('uuid_legacy');
      if (error) throw error;
      return data;
    },

    async getSaisonActive() {
      const { data, error } = await client.from('saisons').select('*').eq('est_active', true).single();
      if (error) throw error;
      return data;
    },

    async getPostes() {
      const { data, error } = await client.from('postes').select('*').order('numero_xv', { nullsFirst: false });
      if (error) throw error;
      return data;
    },

    async getDashboardStats() {
      try {
        const [poles, categories, clubs, postes, saison] = await Promise.all([
          this.getPoles(), this.getCategories(), this.getClubs(),
          this.getPostes(), this.getSaisonActive()
        ]);
        return {
          ok: true,
          nbPoles: poles.length, nbCategories: categories.length,
          nbClubs: clubs.length, nbPostes: postes.length,
          saisonActive: saison ? saison.libelle : 'aucune',
          dateMaj: new Date().toLocaleString('fr-FR')
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },

    // ----------------------------------------------------------
    // AUTHENTIFICATION — Phase 2.5
    // ----------------------------------------------------------

    async requestMagicLink(email, redirectTo) {
      if (!email || typeof email !== 'string') {
        return { ok: false, error: 'Email manquant' };
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
        return { ok: false, error: 'Email invalide' };
      }

      let resolvedRedirect = redirectTo;
      if (!resolvedRedirect && typeof window !== 'undefined' && window.location) {
        resolvedRedirect = window.location.origin +
          window.location.pathname.replace(/[^/]*$/, '');
      }

      const otpOptions = { shouldCreateUser: true };
      if (resolvedRedirect) {
        otpOptions.emailRedirectTo = resolvedRedirect;
      }

      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: otpOptions
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },

    async getSession() {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        console.error('MOM Hub: getSession() error', error);
        return null;
      }
      return session;
    },

    async getCurrentUser() {
      const { data: { user } } = await client.auth.getUser();
      return user;
    },

    async getMyRoles() {
      if (_rolesCache !== null) return _rolesCache;
      const { data, error } = await client.rpc('get_my_roles');
      if (error) {
        console.error('MOM Hub: getMyRoles() error', error);
        return [];
      }
      _rolesCache = Array.isArray(data) ? data : [];
      return _rolesCache;
    },

    async hasRole(role) {
      const roles = await this.getMyRoles();
      return roles.includes(role);
    },

    async isAdmin() {
      return this.hasRole('admin');
    },

    async requireAuth(options) {
      const opts = options || {};
      const loginUrl = opts.loginUrl || 'login.html';
      const forbiddenUrl = opts.forbiddenUrl || './';

      const session = await this.getSession();
      if (!session) {
        window.location.replace(loginUrl);
        return false;
      }
      if (opts.role) {
        const ok = await this.hasRole(opts.role);
        if (!ok) {
          window.location.replace(forbiddenUrl);
          return false;
        }
      }
      return true;
    },

    onAuthChange(callback) {
      const { data: { subscription } } = client.auth.onAuthStateChange(
        function (event, session) {
          if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
            _rolesCache = null;
          }
          if (typeof callback === 'function') {
            try {
              callback(event, session);
            } catch (err) {
              console.error('MOM Hub: onAuthChange callback error', err);
            }
          }
        }
      );
      return subscription;
    },

    async signOut(options) {
      const opts = options || {};
      const redirect = opts.redirect !== false;
      const loginUrl = opts.loginUrl || 'login.html';

      _rolesCache = null;
      const { error } = await client.auth.signOut();
      if (error) console.error('MOM Hub: signOut() error', error);
      if (redirect) window.location.replace(loginUrl);
      return !error;
    },

    // ----------------------------------------------------------
    // ENRÔLEMENT — liaison compte ↔ fiche (v1.52)
    // ----------------------------------------------------------
    /**
     * (v1.52) Renvoie la personne_id reliée au compte connecté, ou null.
     *
     * S'appuie sur la RPC `qui_suis_je()` (lue à la source :
     * RETURNS TABLE(personne_id uuid), EXECUTE accordé à
     * authenticated). Elle lit UNIQUEMENT `auth_personne` via
     * auth.uid() et ne renvoie AUCUNE ligne tant que le compte n'a
     * pas été relié (pas de fallback en base — le « Bonjour Manu »
     * de l'index était un défaut purement front, cf. pt 84).
     *
     * @returns {Promise<string|null>} personne_id si reliée, sinon null.
     *   null aussi en cas d'erreur (dégradation honnête : l'appelant
     *   bascule alors sur l'écran d'auto-identification).
     */
    async quiSuisJe() {
      const { data, error } = await client.rpc('qui_suis_je');
      if (error) {
        console.error('MOM Hub: quiSuisJe() error', error);
        return null;
      }
      // RETURNS TABLE → data est un tableau (0 ou 1 ligne).
      const row = Array.isArray(data) ? data[0] : data;
      return (row && row.personne_id) ? row.personne_id : null;
    },

    /**
     * (v1.52) Relie le compte connecté à une fiche `personnes`.
     *
     * Appelle la RPC `relier_ma_fiche(p_personne_id uuid)` (lue à la
     * source : SECURITY DEFINER, garde auth.uid() IS NOT NULL,
     * RETURNS TABLE(user_id, personne_id), EXECUTE accordé à
     * authenticated). Elle (1) pose le pont `auth_personne`
     * (ON CONFLICT user_id DO UPDATE), (2) matérialise les rôles
     * pré-attribués (roles_en_attente → auth_roles), (3) purge
     * l'attente. C'est le SEUL écrivain de `auth_personne`.
     *
     * @param {string} personneId UUID de la fiche choisie.
     * @returns {Promise<{ok:boolean, personneId?:string, error?:string}>}
     */
    async relierMaFiche(personneId) {
      if (!personneId || typeof personneId !== 'string') {
        return { ok: false, error: 'personne_id manquant' };
      }
      // Le rôle a pu changer (matérialisation) : on invalide le cache.
      _rolesCache = null;
      const { data, error } = await client.rpc('relier_ma_fiche', {
        p_personne_id: personneId
      });
      if (error) {
        console.error('MOM Hub: relierMaFiche() error', error);
        return { ok: false, error: error.message };
      }
      const row = Array.isArray(data) ? data[0] : data;
      const linked = row && row.personne_id ? row.personne_id : personneId;
      return { ok: true, personneId: linked };
    },

    /**
     * (v1.53) Renvoie le prénom de la fiche reliée au compte connecté,
     * ou null. Voie self-only pour le greeting d'un compte SANS rôle.
     *
     * S'appuie sur la RPC `mon_prenom()` (RETURNS text, SECURITY
     * DEFINER, EXECUTE authenticated, sans paramètre : résout la
     * fiche via auth_personne sur auth.uid()). Nécessaire parce que
     * get_noms_personnes() est gardée admin|coach (RGPD) → inappelable
     * par un compte relié sans rôle (cause du « Bonjour Manu »
     * résiduel, pt 84/front). mon_prenom() ne lit JAMAIS la fiche
     * d'autrui (aucun paramètre) → pas de risque RGPD.
     *
     * @returns {Promise<string|null>} prénom, ou null (orphelin/erreur).
     */
    async monPrenom() {
      const { data, error } = await client.rpc('mon_prenom');
      if (error) {
        console.error('MOM Hub: monPrenom() error', error);
        return null;
      }
      // RETURNS text → data est la valeur directe (ou null).
      return (typeof data === 'string' && data) ? data : null;
    },

    // ============================================================
    // RPC PORTAIL (Phase 3.2)
    // ============================================================

    async countPersonnesCreatedLast7Days() {
      const { data, error } = await client.rpc('count_personnes_created_last_7_days');
      if (error) { console.error('MOM Hub: countPersonnesCreatedLast7Days()', error); return 0; }
      return typeof data === 'number' ? data : 0;
    },

    async countPersonnesWithoutEmail() {
      const { data, error } = await client.rpc('count_personnes_without_email');
      if (error) { console.error('MOM Hub: countPersonnesWithoutEmail()', error); return 0; }
      return typeof data === 'number' ? data : 0;
    },

    async countPersonnesWithoutBirthdate() {
      const { data, error } = await client.rpc('count_personnes_without_birthdate');
      if (error) { console.error('MOM Hub: countPersonnesWithoutBirthdate()', error); return 0; }
      return typeof data === 'number' ? data : 0;
    },

    async countPersonnesAffiliationExpiringWithin90Days() {
      const { data, error } = await client.rpc('count_personnes_affiliation_expiring_within_90_days');
      if (error) { console.error('MOM Hub: countPersonnesAffiliationExpiringWithin90Days()', error); return 0; }
      return typeof data === 'number' ? data : 0;
    },

    async getLastOvalESyncDate() {
      const { data, error } = await client.rpc('get_last_oval_e_sync_date');
      if (error) { console.error('MOM Hub: getLastOvalESyncDate()', error); return null; }
      return data;
    },

    // ============================================================
    // PHASE 4.2.C — RPC événements
    // ============================================================

    async getEvenementsAVenir(equipeId = null, joursAVenir = 30, categorieId = null) {
      const { data, error } = await client.rpc('get_evenements_a_venir', {
        p_equipe_id: equipeId, p_jours_a_venir: joursAVenir, p_categorie_id: categorieId
      });
      if (error) { console.error('MOM Hub: getEvenementsAVenir()', error); return []; }
      return Array.isArray(data) ? data : [];
    },

    async getProchainEvenementParEquipe(equipeId) {
      const { data, error } = await client.rpc('get_prochain_evenement_par_equipe', {
        p_equipe_id: equipeId
      });
      if (error) { console.error('MOM Hub: getProchainEvenementParEquipe()', error); return null; }
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },

    // ============================================================
    // PHASE 4.4 UI ÉVÈNEMENTS — RPC événements v1.10 (C9-a/b)
    // ============================================================

    /**
     * Liste les événements passés d'une équipe (ou toutes équipes si null).
     * Symétrique de getEvenementsAVenir. ORDER BY date_debut DESC, plafond
     * configurable. Inclut les événements en état 'annule' (visibles barrés
     * côté UI, cohérent doc Conception §3.5). Exclut 'archive' (état
     * explicite de sortie de circulation).
     *
     * Chaque ligne contient la nouvelle colonne compo_status_summary JSONB
     * { total, brouillon, validee, utilisee } pour les pastilles statut compo.
     *
     * @param {string|null} [equipeId=null] UUID de l'équipe (null = toutes)
     * @param {number} [joursPasses=30] Fenêtre temporelle passée en jours
     * @param {number} [limit=50] Plafond résultats (cf. RPC p_limit)
     * @returns {Promise<Array>} 0..N événements passés, [] si erreur
     */
    async getEvenementsPasses(equipeId = null, joursPasses = 30, limit = 50, categorieId = null) {
      const { data, error } = await client.rpc('get_evenements_passes', {
        p_equipe_id:    equipeId,
        p_jours_passes: joursPasses,
        p_limit:        limit,
        p_categorie_id: categorieId
      });
      if (error) { console.error('MOM Hub: getEvenementsPasses()', error); return []; }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Fiche événement détaillée + array enrichi des encadrants. Aucun
     * filtre etat côté RPC : utilisable sur un événement annulé ou
     * archivé (cas réactivation, audit, lecture historique).
     *
     * Format de la colonne encadrants (jsonb array) retournée par la RPC :
     *   [
     *     {
     *       personne_id: "uuid",
     *       nom: "JUNG",
     *       prenom: "Emmanuel",
     *       roles_encadrement: ["coach_principal"],
     *       ordre: 1,
     *       notes: null
     *     },
     *     ...
     *   ]
     * Tri encadrants côté serveur : ordre NULLS LAST, puis date_creation ASC.
     *
     * Le retour inclut aussi compo_status_summary (JSONB des compteurs
     * de compos par état) + les colonnes héritées du noyau événement.
     *
     * @param {string} evenementId UUID de l'événement
     * @returns {Promise<Object|null>} L'événement complet (24 colonnes)
     *                                  ou null si non trouvé / erreur
     */
    async getEvenementWithEncadrants(evenementId) {
      if (!evenementId) {
        console.error('MOM Hub: getEvenementWithEncadrants() requiert un evenementId');
        return null;
      }
      const { data, error } = await client.rpc('get_evenement_with_encadrants', {
        p_evenement_id: evenementId
      });
      if (error) { console.error('MOM Hub: getEvenementWithEncadrants()', error); return null; }
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },

    // ============================================================
    // PHASE 4.4 UI ÉVÈNEMENTS — WRAPPERS ÉCRITURE v1.11 (S2.4.a)
    // ============================================================

    /**
     * Crée un nouvel évènement (parent ou enfant).
     *
     * Whitelist champs autorisés (les autres sont ignorés silencieusement
     * pour sécurité) :
     *   - code               (string, requis, UNIQUE en base)
     *   - libelle            (string, requis)
     *   - type_evenement     (string, requis, CHECK : competition/
     *                         entrainement/stage)
     *   - type_competition   (string, optionnel ; non vide seulement si
     *                         type_evenement='competition' ; CHECK : 10
     *                         sous-types de sous-types-competition.json)
     *   - equipe_id          (UUID, requis pour entrainement/stage ;
     *                         libre pour competition — équipes via la
     *                         liaison M3 evenement_equipes_engagees)
     *   - saison_id          (UUID, requis)
     *   - format_de_jeu      (string, optionnel ; CHECK : XV/13/12/X/9/8/7)
     *   - date_debut         (ISO string, requis)
     *   - date_fin           (ISO string, optionnel)
     *   - site_id            (UUID, optionnel)
     *   - organisateur_principal_id (UUID, requis)
     *   - evenement_parent_id (UUID, optionnel — série/exception M2 ou
     *                         hiérarchie Compétition→Phase→Match M6)
     *   - phase_libelle      (string, optionnel — nom de phase-boîte M6)
     *   - ordre_dans_phase   (integer, optionnel)
     *   - adversaire_nom     (string, optionnel)
     *   - domicile_exterieur (string, optionnel, CHECK : domicile/
     *                         exterieur/neutre)
     *   - recurrence         (JSONB, optionnel — règle de série M2,
     *                         structure libre non interprétée par CHECK)
     *   - notes_internes     (string, optionnel)
     *
     * État initial forcé à 'creation' (CHECK valide).
     *
     * @param {Object} payload Objet contenant les champs autorisés
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async createEvenement(payload) {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      // Champs minimaux requis pour passer les CHECK SQL
      if (!payload.code || !payload.libelle || !payload.type_evenement
          || !payload.date_debut || !payload.saison_id || !payload.organisateur_principal_id) {
        return { ok: false, error: 'Champs requis manquants : code, libelle, type_evenement, date_debut, saison_id, organisateur_principal_id' };
      }
      const allowedFields = [
        'code', 'libelle', 'type_evenement', 'type_competition',
        'equipe_id', 'saison_id', 'format_de_jeu',
        'date_debut', 'date_fin', 'site_id',
        'organisateur_principal_id',
        'evenement_parent_id', 'phase_libelle', 'ordre_dans_phase',
        'adversaire_nom', 'domicile_exterieur',
        'recurrence',                                  // M2 (migration v1.2 §5.1) — colonne JSONB nullable
        'notes_internes'
      ];
      const insertPayload = { etat: 'creation' };
      allowedFields.forEach(f => {
        if (payload[f] !== undefined) insertPayload[f] = payload[f];
      });

      const { data, error } = await client
        .from('evenements')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: createEvenement()', error);
        return { ok: false, error: error.message || 'Erreur INSERT evenements' };
      }
      return { ok: true, data: data };
    },

    /**
     * Crée un évènement complet en UNE transaction atomique côté
     * serveur, via la RPC composite sql/52 creer_evenement_complet
     * (SECURITY DEFINER, garde has_role admin|coach). Voie « rapide »
     * de la modale création refondue 5 modes adaptatifs (doc UX
     * FAIT FOI Conception-UX-Parcours-Evt-Compo-v1.md §3.1, R3
     * §3.1.6). Livré v1.30, 27/05/2026.
     *
     * Différence avec createEvenement (v1.17) :
     *   - createEvenement       = INSERT racine REST seul, voie
     *                             « lente » fiche pour ajout
     *                             progressif M3/M5/M6/M8/N2 via
     *                             wrappers REST séparés (R4 §3.1.6
     *                             INTACT).
     *   - createEvenementComplet = transaction unique RPC côté
     *                              serveur, tout-ou-rien atomique
     *                              D-Q1, voie « rapide » modale.
     *                              Crée en 1 appel : evenements
     *                              racine + N M3 + N M5 par M3 +
     *                              N phases-boîtes M6 + N matchs +
     *                              N M8 + N N2 staff.
     *
     * Validation client-side ALIGNÉE sur la garde serveur (anti-
     * faux silencieux, message métier explicite avant round-trip
     * réseau). Mapping payload JS → paramètres SQL via préfixe p_
     * conforme signature RPC (18 paramètres, 6 obligatoires + 12
     * optionnels).
     *
     * @param {Object} payload
     *   OBLIGATOIRES :
     *     - type_evenement              ('entrainement'|'competition'|'stage')
     *     - libelle                     (string)
     *     - code                        (string, unique côté UI)
     *     - date_debut                  (ISO 8601 string)
     *     - saison_id                   (UUID)
     *     - organisateur_principal_id   (UUID, FK personnes)
     *   OPTIONNELS (NULL OK côté table) :
     *     - type_competition            (string, NULL si pas compétition)
     *     - format_de_jeu               (string, format global racine A3)
     *     - date_fin                    (ISO 8601, stage/multi-jours)
     *     - site_id                     (UUID)
     *     - domicile_exterieur          ('domicile'|'exterieur'|'neutre')
     *     - equipe_id                   (UUID, entraînement/stage uniquement)
     *     - recurrence                  (JSONB M2 série récurrente A1)
     *     - notes_internes              (string)
     *   COMPOSITES JSONB (cf. doc d'en-tête sql/52) :
     *     - equipes_engagees            (Array d'objets, A3/A4/A5)
     *     - phases_par_equipe           (Array d'objets, A4/A5 avec phases)
     *     - encadrants                  (Array UUID personnes, tous modes)
     *     - affectations_n2             (Array d'objets, A4/A5 multi-équipes)
     *
     * @returns {Promise<{ok: boolean, evenementId?: string, error?: string}>}
     *   - ok=true + evenementId=UUID si succès
     *   - ok=false + error=string si validation client ou RPC échoue
     */
    async createEvenementComplet(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      // Validation minima alignée garde RPC serveur (sql/52 étape 1)
      const required = [
        'type_evenement', 'libelle', 'code',
        'date_debut', 'saison_id', 'organisateur_principal_id'
      ];
      const missing = required.filter(f => !payload[f]);
      if (missing.length > 0) {
        return {
          ok: false,
          error: 'Champs requis manquants : ' + missing.join(', ')
        };
      }

      // Mapping payload JS → paramètres SQL (préfixe p_, signature
      // RPC 18 paramètres dans l'ordre exact du CREATE FUNCTION
      // sql/52). Champs absents du payload → null explicite (Supabase
      // JS supporte les paramètres nommés avec valeurs null pour
      // déclencher les DEFAULT côté SQL).
      const rpcParams = {
        p_type_evenement:            payload.type_evenement,
        p_libelle:                   payload.libelle,
        p_code:                      payload.code,
        p_date_debut:                payload.date_debut,
        p_saison_id:                 payload.saison_id,
        p_organisateur_principal_id: payload.organisateur_principal_id,
        p_type_competition:          payload.type_competition          ?? null,
        p_format_de_jeu:             payload.format_de_jeu             ?? null,
        p_date_fin:                  payload.date_fin                  ?? null,
        p_site_id:                   payload.site_id                   ?? null,
        p_domicile_exterieur:        payload.domicile_exterieur        ?? null,
        p_equipe_id:                 payload.equipe_id                 ?? null,
        p_recurrence:                payload.recurrence                ?? null,
        p_notes_internes:            payload.notes_internes            ?? null,
        p_equipes_engagees:          payload.equipes_engagees          ?? null,
        p_phases_par_equipe:         payload.phases_par_equipe         ?? null,
        p_encadrants:                payload.encadrants                ?? null,
        p_affectations_n2:           payload.affectations_n2           ?? null,
        // v1.35 (étape 3/4 horaires détaillés) — 4 nouveaux paramètres RPC
        // v7 (DEFAULT NULL côté SQL). Champs absents du payload → null.
        p_debut_match:               payload.debut_match               ?? null,
        p_fin_prevue:                payload.fin_prevue                ?? null,
        p_rdv_heure:                 payload.rdv_heure                 ?? null,
        p_rdv_lieu:                  payload.rdv_lieu                  ?? null,
        // EVT-RATTACHEMENT-CATEGORIE — rattachement principal (sql_171).
        // Requis côté RPC pour entrainement/stage ; déduit des équipes
        // engagées pour une compétition si non fourni.
        p_categorie_id:              payload.categorie_id              ?? null
      };

      const { data, error } = await client.rpc('creer_evenement_complet', rpcParams);

      if (error) {
        console.error('MOM Hub: createEvenementComplet()', error);
        return {
          ok: false,
          error: error.message || 'Erreur RPC creer_evenement_complet'
        };
      }
      // RPC retourne directement l'UUID évènement parent (RETURNS UUID)
      return { ok: true, evenementId: data };
    },

    /**
     * Modification COMPLÈTE d'un évènement (méta + horaires + équipes +
     * phases + matchs + encadrants), via RPC modifier_evenement_complet
     * (sql/53, transaction atomique, stratégie « replace children »).
     * Symétrique de createEvenementComplet : même payload, + l'id.
     * @param {string} evenementId UUID racine
     * @param {Object} payload mêmes clés que createEvenementComplet (sans code)
     * @returns {Promise<{ok:boolean, evenementId?:string, error?:string}>}
     */
    async modifierEvenementComplet(evenementId, payload) {
      if (!evenementId) return { ok: false, error: 'evenementId manquant' };
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      const required = ['libelle', 'date_debut'];
      const missing = required.filter(f => !payload[f]);
      if (missing.length > 0) {
        return { ok: false, error: 'Champs requis manquants : ' + missing.join(', ') };
      }
      const rpcParams = {
        p_evenement_id:              evenementId,
        p_libelle:                   payload.libelle,
        p_date_debut:                payload.date_debut,
        p_type_competition:          payload.type_competition          ?? null,
        p_format_de_jeu:             payload.format_de_jeu             ?? null,
        p_date_fin:                  payload.date_fin                  ?? null,
        p_site_id:                   payload.site_id                   ?? null,
        p_domicile_exterieur:        payload.domicile_exterieur        ?? null,
        p_equipe_id:                 payload.equipe_id                 ?? null,
        p_notes_internes:            payload.notes_internes            ?? null,
        p_equipes_engagees:          payload.equipes_engagees          ?? null,
        p_phases_par_equipe:         payload.phases_par_equipe         ?? null,
        p_encadrants:                payload.encadrants                ?? null,
        p_affectations_n2:           payload.affectations_n2           ?? null,
        p_debut_match:               payload.debut_match               ?? null,
        p_fin_prevue:                payload.fin_prevue                ?? null,
        p_rdv_heure:                 payload.rdv_heure                 ?? null,
        p_rdv_lieu:                  payload.rdv_lieu                  ?? null
      };
      const { data, error } = await client.rpc('modifier_evenement_complet', rpcParams);
      if (error) {
        console.error('MOM Hub: modifierEvenementComplet()', error);
        return { ok: false, error: error.message || 'Erreur RPC modifier_evenement_complet' };
      }
      return { ok: true, evenementId: data };
    },

    /**
     * Duplique un évènement existant. V1 ne duplique QUE le parent
     * (les enfants ne sont PAS dupliqués — cf. dette P4-UI-evenements-2
     * pour la duplication arborescente V2).
     *
     * @param {string} srcId UUID de l'évènement source
     * @param {Object} [overrides] Champs à surcharger (code, libelle, date_debut...)
     *                              Si code non fourni, généré auto avec suffixe '-COPIE'.
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async duplicateEvenement(srcId, overrides) {
      if (!srcId) return { ok: false, error: 'srcId manquant' };
      overrides = overrides || {};

      // 1. Récupère l'évènement source
      const { data: src, error: errSrc } = await client
        .from('evenements')
        .select('*')
        .eq('id', srcId)
        .maybeSingle();

      if (errSrc) {
        console.error('MOM Hub: duplicateEvenement() lecture source', errSrc);
        return { ok: false, error: errSrc.message };
      }
      if (!src) {
        return { ok: false, error: 'Évènement source introuvable' };
      }

      // 2. Construit le payload du nouvel évent (champs whitelistés)
      const fieldsToCopy = [
        'libelle', 'type_evenement', 'type_competition',
        'equipe_id', 'categorie_id', 'saison_id', 'format_de_jeu',
        'date_debut', 'date_fin', 'site_id',
        'organisateur_principal_id',
        'adversaire_nom', 'domicile_exterieur'
        // categorie_id : rattachement principal (EVT-RATTACHEMENT-CATEGORIE).
        // NB : evenement_parent_id, phase_libelle, ordre_dans_phase NON copiés
        // (V1 ne duplique que les parents/orphelins). score, classement,
        // notes_resultat, logistique : ne pas copier non plus.
      ];
      const newPayload = { etat: 'creation' };
      fieldsToCopy.forEach(f => {
        if (src[f] !== undefined && src[f] !== null) newPayload[f] = src[f];
      });

      // 3. Applique les overrides + auto-génère code si absent
      Object.keys(overrides).forEach(k => { newPayload[k] = overrides[k]; });
      if (!newPayload.code) {
        newPayload.code = src.code + '-COPIE-' + Date.now().toString().substring(7);
      }
      if (!newPayload.libelle) {
        newPayload.libelle = (src.libelle || '') + ' (copie)';
      }

      // 4. INSERT
      const { data, error } = await client
        .from('evenements')
        .insert(newPayload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: duplicateEvenement() insertion', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data: data };
    },

    /**
     * EVT-RECURRENCE-OCCURRENCES — génère les occurrences (événements
     * enfants) d'un entraînement récurrent sur une fenêtre. Idempotent
     * (RPC generer_occurrences_evenement, garde admin|coach). En général
     * inutile à appeler à la main : un trigger génère automatiquement à la
     * création. Fourni pour prolonger la fenêtre.
     * @param {string} mereId UUID de l'événement mère récurrent
     * @param {string|null} [from=null] borne début (YYYY-MM-DD) ou null
     * @param {string|null} [to=null] borne fin (YYYY-MM-DD) ou null
     * @returns {Promise<{ok:boolean, creees?:number, existantes?:number, error?:string}>}
     */
    async genererOccurrencesEvenement(mereId, from = null, to = null) {
      if (!mereId) return { ok: false, error: 'mereId manquant' };
      const { data, error } = await client.rpc('generer_occurrences_evenement', {
        p_evenement_mere_id: mereId, p_from: from, p_to: to
      });
      if (error) { console.error('MOM Hub: genererOccurrencesEvenement()', error); return { ok: false, error: error.message }; }
      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, creees: row && row.out_nb_creees, existantes: row && row.out_nb_existantes };
    },

    /**
     * EVT-RECURRENCE-OCCURRENCES — propage le libellé de la mère à TOUTES
     * ses occurrences (enfants directs, evenement_parent_id = mereId).
     * Volontairement limité au SEUL champ libelle (D2 pt 201, validé Manu) :
     * date/site/etc. restent propres à chaque occurrence, une occurrence
     * ponctuelle (ex. tournoi remplaçant une séance) reste éditable seule
     * via updateEvenement (case à cocher décochée). UPDATE direct (pas de
     * RPC, RLS + policy UPDATE existante sur evenements suffit).
     * @param {string} mereId UUID de l'événement mère récurrent
     * @param {string} libelle Nouveau libellé à appliquer à toute la série
     * @returns {Promise<{ok:boolean, count?:number, error?:string}>}
     */
    async updateLibelleSerie(mereId, libelle) {
      if (!mereId) return { ok: false, error: 'mereId manquant' };
      if (!libelle || !libelle.trim()) return { ok: false, error: 'Libellé manquant' };
      const { data, error } = await client
        .from('evenements')
        .update({ libelle: libelle.trim() })
        .eq('evenement_parent_id', mereId)
        .select('id');
      if (error) { console.error('MOM Hub: updateLibelleSerie()', error); return { ok: false, error: error.message }; }
      return { ok: true, count: Array.isArray(data) ? data.length : 0 };
    },

    /**
     * EVT-RECURRENCE-OCCURRENCES — supprime UNE occurrence (enfant) et
     * exclut sa date de la série mère (anti-régénération). RPC
     * supprimer_occurrence_evenement (garde admin|coach). Pour supprimer la
     * série entière, supprimer la mère (CASCADE emporte les enfants).
     * @param {string} occurrenceId UUID de l'occurrence enfant
     * @returns {Promise<{ok:boolean, mereId?:string, dateExclue?:string, error?:string}>}
     */
    async supprimerOccurrenceEvenement(occurrenceId) {
      if (!occurrenceId) return { ok: false, error: 'occurrenceId manquant' };
      const { data, error } = await client.rpc('supprimer_occurrence_evenement', {
        p_occurrence_id: occurrenceId
      });
      if (error) { console.error('MOM Hub: supprimerOccurrenceEvenement()', error); return { ok: false, error: error.message }; }
      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, mereId: row && row.out_mere_id, dateExclue: row && row.out_date_exclue };
    },

    /**
     * EVT-SERIE-ECRAN — liste TOUTES les occurrences (enfants) d'une série
     * récurrente, indépendamment de la fenêtre 90 j de la liste principale.
     * Lecture directe de la table evenements (evenement_parent_id = mereId),
     * triée par date. Alimente la modale « voir la série ».
     * @param {string} mereId UUID de l'événement mère récurrent
     * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
     */
    async getOccurrencesSerie(mereId) {
      if (!mereId) return { ok: false, error: 'mereId manquant' };
      const { data, error } = await client
        .from('evenements')
        .select('id, code, libelle, type_evenement, date_debut, debut_match, fin_prevue, rdv_heure, etat, evenement_parent_id')
        .eq('evenement_parent_id', mereId)
        .order('date_debut', { ascending: true });
      if (error) {
        console.error('MOM Hub: getOccurrencesSerie()', error);
        return { ok: false, error: error.message || 'Erreur lecture série' };
      }
      return { ok: true, data: Array.isArray(data) ? data : [] };
    },

    /**
     * EVT-SERIE-ECRAN — modifie la récurrence d'une mère (Q4=B) : met à jour
     * le champ recurrence puis PROLONGE (regénère, idempotent) et, si la fin
     * est raccourcie, SUPPRIME les occurrences futures au-delà de la nouvelle
     * borne (jamais une séance passée). RPC modifier_recurrence_evenement
     * (garde admin|coach).
     * NB : à ne pas confondre avec modifierRecurrence() (récurrence des
     * réservations logistiques, RPC modifier_recurrence) — sujet distinct.
     * @param {string} mereId UUID de l'événement mère récurrent
     * @param {Object} recurrence objet JSONB { mode, frequence, fin }
     * @returns {Promise<{ok:boolean, creees?:number, supprimees?:number, borneFin?:string, error?:string}>}
     */
    async modifierRecurrenceEvenement(mereId, recurrence) {
      if (!mereId) return { ok: false, error: 'mereId manquant' };
      const { data, error } = await client.rpc('modifier_recurrence_evenement', {
        p_evenement_id: mereId,
        p_recurrence: recurrence || null
      });
      if (error) {
        console.error('MOM Hub: modifierRecurrenceEvenement()', error);
        return { ok: false, error: error.message || 'Erreur RPC modifier_recurrence_evenement' };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        ok: true,
        creees: row && row.out_nb_creees,
        supprimees: row && row.out_nb_supprimees,
        borneFin: row && row.out_borne_fin
      };
    },

    /**
     * EVT-SERIE-ECRAN — supprime un évènement (DELETE direct). Pour une mère
     * récurrente, la FK enfant ON DELETE CASCADE emporte toutes les
     * occurrences. Autorisation gérée par la RLS DELETE de evenements
     * (admin / bureau / puis_je_ecrire_categorie). Utilisé pour « supprimer
     * toute la série ».
     * @param {string} evenementId UUID de l'évènement (mère) à supprimer
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async supprimerEvenement(evenementId) {
      if (!evenementId) return { ok: false, error: 'evenementId manquant' };
      const { error } = await client
        .from('evenements')
        .delete()
        .eq('id', evenementId);
      if (error) {
        console.error('MOM Hub: supprimerEvenement()', error);
        return { ok: false, error: error.message || 'Erreur suppression évènement' };
      }
      return { ok: true };
    },

    /**
     * EVT-SERIE-SUPPRESSION-MERE (Option B « mère détachée ») — retire la
     * séance portée par la MÈRE d'une série récurrente SANS détruire la
     * série : la mère passe etat='annule' et sa propre date est ajoutée à
     * dates_exclues (idempotent). La mère reste l'ancrage invisible de la
     * récurrence. Réversible via rattacherMereSerie().
     * NB : DISTINCT de supprimerEvenement() (= supprimer TOUTE la série via
     * CASCADE) et de supprimerOccurrenceEvenement() (= supprimer un ENFANT).
     * RPC detacher_mere_serie (garde admin|bureau|gerer_evenements).
     * @param {string} mereId UUID de l'événement mère récurrent
     * @returns {Promise<{ok:boolean, mereId?:string, dateExclue?:string, nbExclues?:number, seancesRestantes?:number, error?:string}>}
     */
    async detacherMereSerie(mereId) {
      if (!mereId) return { ok: false, error: 'mereId manquant' };
      const { data, error } = await client.rpc('detacher_mere_serie', {
        p_mere_id: mereId
      });
      if (error) {
        console.error('MOM Hub: detacherMereSerie()', error);
        return { ok: false, error: error.message || 'Erreur RPC detacher_mere_serie' };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        ok: true,
        mereId: row && row.out_mere_id,
        dateExclue: row && row.out_date_exclue,
        nbExclues: row && row.out_nb_exclues,
        seancesRestantes: row && row.out_nb_seances_restantes
      };
    },

    /**
     * EVT-SERIE-SUPPRESSION-MERE — miroir de detacherMereSerie() : réintègre
     * la séance portée par la mère (etat='creation' + retrait de sa propre
     * date de dates_exclues ; les AUTRES dates exclues sont préservées).
     * RPC rattacher_mere_serie (garde admin|bureau|gerer_evenements).
     * @param {string} mereId UUID de l'événement mère récurrent
     * @returns {Promise<{ok:boolean, mereId?:string, dateReintegree?:string, nbExclues?:number, error?:string}>}
     */
    async rattacherMereSerie(mereId) {
      if (!mereId) return { ok: false, error: 'mereId manquant' };
      const { data, error } = await client.rpc('rattacher_mere_serie', {
        p_mere_id: mereId
      });
      if (error) {
        console.error('MOM Hub: rattacherMereSerie()', error);
        return { ok: false, error: error.message || 'Erreur RPC rattacher_mere_serie' };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        ok: true,
        mereId: row && row.out_mere_id,
        dateReintegree: row && row.out_date_reintegree,
        nbExclues: row && row.out_nb_exclues
      };
    },

    /**
     * Ajoute un match enfant à une compétition racine existante (cas
     * tournoi/challenge à matchs). Convention M6 (v1.2 §4.4) : le parent
     * doit être type_evenement='competition' ET sans evenement_parent_id ;
     * l'enfant créé est lui aussi 'competition' (le domaine technique
     * 'match' n'existe plus depuis la migration v1.2 §5.1). Hérite par
     * défaut du parent : type_competition, saison_id, equipe_id,
     * organisateur_principal_id, format_de_jeu, site_id.
     *
     * @param {string} tournoiId UUID de la compétition racine parente
     * @param {Object} payload Champs spécifiques au match
     *   - libelle           (string, requis — ex: "vs Nancy Seichamps")
     *   - date_debut        (ISO string, requis)
     *   - phase_libelle     (string, optionnel — ex: "Poule de brassage")
     *   - ordre_dans_phase  (integer, optionnel)
     *   - adversaire_nom    (string, optionnel)
     *   - format_de_jeu     (string, optionnel — sinon hérité du parent)
     *   - code              (string, optionnel — sinon auto-généré)
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async addMatchToTournoi(tournoiId, payload) {
      if (!tournoiId) return { ok: false, error: 'tournoiId manquant' };
      if (!payload || !payload.libelle || !payload.date_debut) {
        return { ok: false, error: 'Champs requis manquants : libelle, date_debut' };
      }

      // 1. Récupère le parent pour hériter
      const { data: parent, error: errParent } = await client
        .from('evenements')
        .select('id, code, type_evenement, type_competition, saison_id, equipe_id, organisateur_principal_id, format_de_jeu, site_id, domicile_exterieur, evenement_parent_id')
        .eq('id', tournoiId)
        .maybeSingle();

      if (errParent) {
        console.error('MOM Hub: addMatchToTournoi() lecture parent', errParent);
        return { ok: false, error: errParent.message };
      }
      if (!parent) return { ok: false, error: 'Tournoi parent introuvable' };
      // Convention M6 (v1.2 §4.4) : un parent recevant des matchs est une
      // COMPÉTITION RACINE. Le domaine technique 'tournoi' a été remappé en
      // 'competition' par la migration v1.2 §5.1 (M1) — l'ancien test
      // `!== 'tournoi'` rejetait désormais 100 % des parents (régression).
      // Parent valide = competition ET sans parent (pas une phase-boîte
      // ni un match enfant).
      if (parent.type_evenement !== 'competition' || parent.evenement_parent_id !== null) {
        return {
          ok: false,
          error: "L'évènement parent n'est pas une compétition racine (type_evenement="
                 + parent.type_evenement
                 + (parent.evenement_parent_id !== null ? ', a un parent' : '') + ')'
        };
      }

      // 2. Construit le payload enfant
      // Convention M6 (v1.2 §4.4) : un match enfant EST de la famille
      // 'competition' (le domaine technique 'match' n'existe plus depuis
      // la migration v1.2 §5.1). Il se distingue d'une phase-boîte par
      // evenement_parent_id renseigné + adversaire_nom + absence d'enfants
      // (convention applicative, pas de colonne marqueur — P1/P4).
      const childPayload = {
        type_evenement:            'competition',
        evenement_parent_id:       parent.id,
        type_competition:          payload.type_competition || parent.type_competition || 'tournoi',
        saison_id:                 parent.saison_id,
        equipe_id:                 parent.equipe_id,
        organisateur_principal_id: parent.organisateur_principal_id,
        format_de_jeu:             payload.format_de_jeu || parent.format_de_jeu,
        site_id:                   payload.site_id !== undefined ? payload.site_id : parent.site_id,
        domicile_exterieur:        payload.domicile_exterieur || parent.domicile_exterieur || 'neutre',
        libelle:                   payload.libelle,
        date_debut:                payload.date_debut,
        etat:                      'creation'
      };
      // Champs optionnels
      if (payload.phase_libelle)    childPayload.phase_libelle    = payload.phase_libelle;
      if (payload.ordre_dans_phase) childPayload.ordre_dans_phase = payload.ordre_dans_phase;
      if (payload.adversaire_nom)   childPayload.adversaire_nom   = payload.adversaire_nom;
      if (payload.date_fin)         childPayload.date_fin         = payload.date_fin;

      // Code auto-généré si absent
      if (payload.code) {
        childPayload.code = payload.code;
      } else {
        const ts = Date.now().toString().substring(7);
        childPayload.code = parent.code + '-M' + ts;
      }

      // 3. INSERT
      const { data, error } = await client
        .from('evenements')
        .insert(childPayload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: addMatchToTournoi() insertion', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data: data };
    },

    /**
     * Met à jour les champs métier d'un évènement existant.
     *
     * Whitelist : libelle, type_competition, date_debut, date_fin, site_id,
     * format_de_jeu, adversaire_nom, domicile_exterieur, phase_libelle,
     * ordre_dans_phase, notes_internes, score_mom, score_adverse,
     * classement_final, notes_resultat.
     *
     * NON modifiable via ce wrapper (volontaire) :
     *   - etat (utiliser cancelEvenement / reactivateEvenement)
     *   - type_evenement (changement de nature = nouvel évent)
     *   - equipe_id, saison_id (changement structurant)
     *   - evenement_parent_id (rattachement structurant)
     *   - logistique_deplacement (utiliser updateLogistique)
     *   - organisateur_principal_id (gestion encadrants à part)
     *
     * @param {string} evenementId UUID
     * @param {Object} patch Champs à modifier
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async updateEvenement(evenementId, patch) {
      if (!evenementId) return { ok: false, error: 'evenementId manquant' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'Patch manquant ou invalide' };
      }
      const allowedFields = [
        'libelle', 'type_competition',
        'date_debut', 'date_fin', 'site_id', 'format_de_jeu',
        'adversaire_nom', 'domicile_exterieur',
        'phase_libelle', 'ordre_dans_phase',
        'notes_internes',
        'score_mom', 'score_adverse', 'classement_final', 'notes_resultat'
      ];
      const safePatch = {};
      allowedFields.forEach(f => {
        if (patch[f] !== undefined) safePatch[f] = patch[f];
      });
      if (Object.keys(safePatch).length === 0) {
        return { ok: false, error: 'Aucun champ modifiable dans ce patch' };
      }

      const { data, error } = await client
        .from('evenements')
        .update(safePatch)
        .eq('id', evenementId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: updateEvenement()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: 'Évènement introuvable' };
      }
      return { ok: true, data: data };
    },

    /**
     * Annule un évènement (etat → 'annule'). Stocke le motif dans
     * notes_resultat (V1 simple, pas de colonne motif_annulation dédiée).
     *
     * Garde-fou : ne peut annuler que depuis 'creation', 'compo', 'joue',
     * 'resultat'. Pas depuis 'annule' (déjà annulé) ni 'archive'.
     *
     * @param {string} evenementId UUID
     * @param {string} [motif] Motif libre stocké dans notes_resultat
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async cancelEvenement(evenementId, motif) {
      if (!evenementId) return { ok: false, error: 'evenementId manquant' };

      const patch = { etat: 'annule' };
      if (motif && typeof motif === 'string' && motif.trim()) {
        // Préfixe pour identification ultérieure du motif d'annulation
        patch.notes_resultat = '[ANNULÉ] ' + motif.trim();
      }

      const { data, error } = await client
        .from('evenements')
        .update(patch)
        .eq('id', evenementId)
        .in('etat', ['creation', 'compo', 'joue', 'resultat'])
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: cancelEvenement()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: "L'évènement n'est pas dans un état permettant l'annulation (déjà annulé, archivé ou introuvable)" };
      }
      return { ok: true, data: data };
    },

    /**
     * Réactive un évènement annulé (etat='annule' → 'creation').
     * Cohérent doctrine P4 : le Hub n'enferme pas, réversibilité libre
     * sans condition temporelle.
     *
     * Garde-fou : ne peut réactiver que depuis 'annule'.
     *
     * @param {string} evenementId UUID
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async reactivateEvenement(evenementId) {
      if (!evenementId) return { ok: false, error: 'evenementId manquant' };

      const { data, error } = await client
        .from('evenements')
        .update({ etat: 'creation' })
        .eq('id', evenementId)
        .eq('etat', 'annule')
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: reactivateEvenement()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: "L'évènement n'est pas en état 'annule' (déjà actif ou introuvable)" };
      }
      return { ok: true, data: data };
    },

    // ============================================================
    // REFONTE ÉVÈNEMENTS — WRAPPERS LECTURE M3/M5 v1.18
    // ============================================================
    // Tables créées par la migration v1.2 §5.1 (commitée).
    // LECTURE seule : RLS SELECT authenticated OK. L'ÉCRITURE M3/M5
    // est une dette tracée (RLS write par rôle, session dédiée —
    // cf. changelog v1.18). Convention de retour : Array, [] sur
    // erreur/vide (identique getChronologieRencontreCoach, PI-5).

    /**
     * Équipes engagées d'une compétition (liaison M3
     * evenement_equipes_engagees). Pour le cas multi-équipes ; le cas
     * mono-équipe reste porté par evenements.equipe_id (v1.2 §4.3, le
     * "format effectif" se résout côté lecture appelante : override
     * liaison si présent, sinon evenements.format_de_jeu).
     *
     * @param {string} evenementId UUID de la compétition
     * @returns {Promise<Array>} lignes liaison (id, equipe_id,
     *   format_de_jeu, ordre, notes) triées ordre NULLS LAST puis
     *   date_creation ; [] sur erreur/vide.
     */
    async getEquipesEngagees(evenementId) {
      if (!evenementId) {
        console.error('MOM Hub: getEquipesEngagees() requiert un evenementId');
        return [];
      }
      const { data, error } = await client
        .from('evenement_equipes_engagees')
        .select('id, evenement_id, equipe_id, format_de_jeu, ordre, notes, date_creation')
        .eq('evenement_id', evenementId)
        .order('ordre', { ascending: true, nullsFirst: false })
        .order('date_creation', { ascending: true });
      if (error) {
        console.error('MOM Hub: getEquipesEngagees()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Adversaires d'une compétition SANS phases (M5), résolus via la
     * liaison M3 (evenement_adversaires.evenement_equipe_id →
     * evenement_equipes_engagees.id, filtré sur evenement_id).
     *
     * Frontière M5↔M6 (v1.2 §4.4) : ce wrapper ne couvre QUE les
     * compétitions sans phases. Pour les compétitions à phases,
     * l'adversaire est porté par evenements.adversaire_nom du match
     * (déjà exposé par les RPC/wrappers événement existants) — par
     * construction, une telle compétition n'a pas de lignes
     * evenement_adversaires.
     *
     * @param {string} evenementId UUID de la compétition
     * @returns {Promise<Array>} adversaires aplatis (evenement_equipe_id,
     *   equipe_id, adversaire_nom, ordre, notes) triés equipe puis
     *   ordre ; [] sur erreur/vide.
     */
    async getAdversairesEvenement(evenementId) {
      if (!evenementId) {
        console.error('MOM Hub: getAdversairesEvenement() requiert un evenementId');
        return [];
      }
      // Jointure imbriquée PostgREST : on part de la liaison M3 filtrée
      // sur l'événement, on ramène les adversaires rattachés.
      const { data, error } = await client
        .from('evenement_equipes_engagees')
        .select('id, equipe_id, ordre, evenement_adversaires ( id, adversaire_nom, ordre, notes, date_creation )')
        .eq('evenement_id', evenementId)
        .order('ordre', { ascending: true, nullsFirst: false });
      if (error) {
        console.error('MOM Hub: getAdversairesEvenement()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      // Aplatissement : 1 ligne par adversaire, équipe engagée portée.
      const out = [];
      data.forEach(eq => {
        const advs = Array.isArray(eq.evenement_adversaires) ? eq.evenement_adversaires : [];
        advs
          .slice()
          .sort((a, b) => {
            const ao = a.ordre == null ? Infinity : a.ordre;
            const bo = b.ordre == null ? Infinity : b.ordre;
            return ao - bo;
          })
          .forEach(adv => {
            out.push({
              id:                  adv.id,
              evenement_equipe_id: eq.id,
              equipe_id:           eq.equipe_id,
              adversaire_nom:      adv.adversaire_nom,
              ordre:               adv.ordre,
              notes:               adv.notes,
              date_creation:       adv.date_creation
            });
          });
      });
      return out;
    },

    // ============================================================
    // SESSION RLS WRITE PAR RÔLE — WRAPPERS ÉCRITURE M3/M5 v1.19
    // ============================================================
    // RLS write posée : sql/41-rls-write-evenements-filles
    // (INSERT/UPDATE/DELETE = has_role admin|coach, patron evenements
    // déployé). Convention de retour : { ok, data? , error? } =
    // patron WRITE (createEvenement), PAS le patron lecture [] ci-dessus.
    // cree_par NON renseigné (homogène createEvenement ; pas de mapping
    // auth→personnes en base — décision technique consignée changelog).

    /**
     * Engage une équipe sur une compétition (INSERT liaison M3
     * evenement_equipes_engagees). Lève la dette write M3 (RLS posée
     * sql/41). Patron write identique createEvenement.
     *
     * @param {string} evenementId UUID de la compétition
     * @param {Object} payload { equipe_id (requis), format_de_jeu?,
     *   ordre?, notes? }. format_de_jeu = override M4 par équipe
     *   (domaine CHECK sql/40 : XV|13|12|X|9|8|7) ; laissé au SQL.
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async addEquipeEngagee(evenementId, payload) {
      if (!evenementId) {
        return { ok: false, error: 'evenementId requis' };
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      if (!payload.equipe_id) {
        return { ok: false, error: 'Champ requis manquant : equipe_id' };
      }
      const allowedFields = ['format_de_jeu', 'ordre', 'notes'];
      const insertPayload = {
        evenement_id: evenementId,
        equipe_id:    payload.equipe_id
      };
      allowedFields.forEach(f => {
        if (payload[f] !== undefined) insertPayload[f] = payload[f];
      });

      const { data, error } = await client
        .from('evenement_equipes_engagees')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: addEquipeEngagee()', error);
        return { ok: false, error: error.message || 'Erreur INSERT evenement_equipes_engagees' };
      }
      return { ok: true, data: data };
    },

    /**
     * Retire une équipe engagée (DELETE liaison M3 par id). Cas
     * "décocher une équipe" du Bloc 4a (UX §2.4/4a). Le ON DELETE
     * CASCADE de sql/40 supprime automatiquement les adversaires M5
     * rattachés à cette liaison — aucun delete applicatif en cascade.
     *
     * @param {string} liaisonId UUID de la ligne evenement_equipes_engagees
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async removeEquipeEngagee(liaisonId) {
      if (!liaisonId) {
        return { ok: false, error: 'liaisonId requis' };
      }
      const { error } = await client
        .from('evenement_equipes_engagees')
        .delete()
        .eq('id', liaisonId);

      if (error) {
        console.error('MOM Hub: removeEquipeEngagee()', error);
        return { ok: false, error: error.message || 'Erreur DELETE evenement_equipes_engagees' };
      }
      return { ok: true };
    },

    /**
     * Ajoute un adversaire à une équipe engagée (INSERT M5
     * evenement_adversaires), cas compétition SANS phases
     * (frontière M5↔M6, v1.2 §4.4). Lève la dette write M5.
     *
     * NB asymétrie M3↔M5 (sql/40 §M5) : evenement_adversaires n'a NI
     * cree_par NI updated_at/trigger → payload volontairement plus
     * court que addEquipeEngagee, ce n'est pas un oubli.
     *
     * @param {string} evenementEquipeId UUID de la liaison M3
     *   (evenement_equipes_engagees.id) à laquelle rattacher l'adversaire
     * @param {Object} payload { adversaire_nom (requis), ordre?, notes? }
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async addAdversaire(evenementEquipeId, payload) {
      if (!evenementEquipeId) {
        return { ok: false, error: 'evenementEquipeId requis' };
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      if (!payload.adversaire_nom) {
        return { ok: false, error: 'Champ requis manquant : adversaire_nom' };
      }
      const allowedFields = ['ordre', 'notes'];
      const insertPayload = {
        evenement_equipe_id: evenementEquipeId,
        adversaire_nom:      payload.adversaire_nom
      };
      allowedFields.forEach(f => {
        if (payload[f] !== undefined) insertPayload[f] = payload[f];
      });

      const { data, error } = await client
        .from('evenement_adversaires')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: addAdversaire()', error);
        return { ok: false, error: error.message || 'Erreur INSERT evenement_adversaires' };
      }
      return { ok: true, data: data };
    },

    /**
     * Retire un adversaire (DELETE M5 par id).
     *
     * @param {string} adversaireId UUID de la ligne evenement_adversaires
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async removeAdversaire(adversaireId) {
      if (!adversaireId) {
        return { ok: false, error: 'adversaireId requis' };
      }
      const { error } = await client
        .from('evenement_adversaires')
        .delete()
        .eq('id', adversaireId);

      if (error) {
        console.error('MOM Hub: removeAdversaire()', error);
        return { ok: false, error: error.message || 'Erreur DELETE evenement_adversaires' };
      }
      return { ok: true };
    },

    /**
     * Liste les équipes d'une catégorie pour peupler le Bloc 4a
     * (cases à cocher Engagement, UX §2.4/4a). Lève la dette
     * REFONTE-EVT-listing-equipes (listing absent, module M14
     * mono-équipe hardcodé).
     *
     * Filtrage tranché avec Manu (décisions métier consignées) :
     *   - périmètre = équipes de la CATÉGORIE passée en paramètre
     *     (Q1 = option a : catégorie explicite, pas dérivée — le
     *     wrapper ne fait aucune hypothèse sur l'état du formulaire ;
     *     la source de categorieId côté UI = gate du câblage, traité
     *     à l'étape submitModalCreate, PAS présumé ici) ;
     *   - SAISON ACTIVE uniquement (Q2) — via ententes.saison_id →
     *     saisons.est_active = true ;
     *   - equipes.statut = 'active' uniquement.
     *
     * Chaîne de jointure RÉELLE (sql/01 lu à la source, NON devinée) :
     *   equipes.entente_id → ententes.id (NOT NULL) ;
     *   ententes.categorie_id (NOT NULL) ; ententes.saison_id
     *   (NOT NULL) → saisons.est_active. ententes a
     *   UNIQUE(saison_id, categorie_id) : au plus 1 entente par
     *   couple → pas de doublon d'équipe par construction.
     *
     * Convention de retour : Array, [] sur erreur/vide (patron
     * LECTURE liste v1.18 / PI-5 — c'est un wrapper de lecture).
     *
     * @param {string} categorieId UUID de la catégorie
     * @returns {Promise<Array>} équipes (id, code, nom_officiel,
     *   libelle_court, format_jeu_code, numero_equipe) triées
     *   numero_equipe puis nom_officiel ; [] sur erreur/vide.
     */
    async listEquipes(categorieId) {
      if (!categorieId) {
        console.error('MOM Hub: listEquipes() requiert un categorieId');
        return [];
      }
      const { data, error } = await client
        .from('equipes')
        .select('id, code, nom_officiel, libelle_court, format_jeu_code, numero_equipe, ententes!inner ( categorie_id, saisons!inner ( est_active ) )')
        .eq('statut', 'active')
        .eq('ententes.categorie_id', categorieId)
        .eq('ententes.saisons.est_active', true)
        .order('numero_equipe', { ascending: true, nullsFirst: false })
        .order('nom_officiel', { ascending: true });
      if (error) {
        console.error('MOM Hub: listEquipes()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Résout la catégorie d'une équipe (equipes.entente_id →
     * ententes.categorie_id). Sert à dériver le categorieId attendu
     * par listEquipes() à partir d'une équipe connue (cas Bloc 4a :
     * M14_TEAM_UUID → sa catégorie → équipes engageables).
     *
     * Chaîne RÉELLE (sql/01 lu à la source) : equipes.entente_id
     * (NOT NULL) → ententes.id ; ententes.categorie_id (NOT NULL).
     * Les 2 FK étant NOT NULL, une équipe existante a TOUJOURS une
     * catégorie résoluble (pas de cas null légitime). Lecture ciblée
     * à résultat unique : pattern maybeSingle (idem fallback contexte
     * modal evenements-browser l.~2397, NON inventé).
     *
     * @param {string} equipeId UUID de l'équipe
     * @returns {Promise<{ok: boolean, data?: {categorie_id: string},
     *   error?: string}>}
     */
    async getCategorieEquipe(equipeId) {
      if (!equipeId) {
        return { ok: false, error: 'equipeId requis' };
      }
      const { data, error } = await client
        .from('equipes')
        .select('ententes!inner ( categorie_id )')
        .eq('id', equipeId)
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: getCategorieEquipe()', error);
        return { ok: false, error: error.message || 'Erreur lecture catégorie équipe' };
      }
      const catId = data && data.ententes && data.ententes.categorie_id
        ? data.ententes.categorie_id
        : null;
      if (!catId) {
        return { ok: false, error: 'Catégorie introuvable pour cette équipe' };
      }
      return { ok: true, data: { categorie_id: catId } };
    },

    /**
     * Met à jour la colonne logistique_deplacement (JSONB) d'un évènement.
     * Wrapper séparé d'updateEvenement par souci de doctrine : la
     * logistique est un objet structuré qu'on veut pouvoir vider (passer
     * à NULL) sans toucher au reste.
     *
     * @param {string} evenementId UUID
     * @param {Object|null} jsonbPayload Objet JSONB libre (ou null pour vider)
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     */
    async updateLogistique(evenementId, jsonbPayload) {
      if (!evenementId) return { ok: false, error: 'evenementId manquant' };
      if (jsonbPayload !== null && (typeof jsonbPayload !== 'object' || Array.isArray(jsonbPayload))) {
        return { ok: false, error: 'logistique_deplacement doit être un object JSONB ou null' };
      }

      const { data, error } = await client
        .from('evenements')
        .update({ logistique_deplacement: jsonbPayload })
        .eq('id', evenementId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('MOM Hub: updateLogistique()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: 'Évènement introuvable' };
      }
      return { ok: true, data: data };
    },

    // ============================================================
    // PHASE 4.3 — RPC vivier compo
    // ============================================================

    // DÉPRÉCIÉ (v1.78, COMPO-RATTACHEMENT-CATEGORIE, D5) : plus aucun
    // consommateur (grep dépôt 09/07 : seul compositions-editor.js l.5924,
    // basculé sur getVivierCompoCategorie en v3.68). Conservé intact pour
    // réversibilité — ne pas réutiliser pour du neuf, préférer la voie catégorie.
    async getVivierCompo(equipeId) {
      if (!equipeId) {
        console.error('MOM Hub: getVivierCompo() requiert un equipeId');
        return [];
      }
      const { data, error } = await client.rpc('get_vivier_compo', { p_equipe_id: equipeId });
      if (error) { console.error('MOM Hub: getVivierCompo()', error); return []; }
      return Array.isArray(data) ? data : [];
    },

    // Chantier VIVIER-COMPO-CATEGORIE — variante catégorielle de getVivierCompo.
    // Le vivier est celui de la CATÉGORIE (rattachement séances→catégorie, pt 181),
    // plus de l'équipe. RPC get_vivier_compo_categorie(p_categorie_id) : mêmes
    // colonnes que get_vivier_compo, statut_attache/niveau_profil/date_affectation
    // renvoyés NULL (pas d'équipe). Règle F15/M14 préservée côté RPC.
    async getVivierCompoCategorie(categorieId) {
      if (!categorieId) {
        console.error('MOM Hub: getVivierCompoCategorie() requiert un categorieId');
        return [];
      }
      const { data, error } = await client.rpc('get_vivier_compo_categorie', { p_categorie_id: categorieId });
      if (error) { console.error('MOM Hub: getVivierCompoCategorie()', error); return []; }
      return Array.isArray(data) ? data : [];
    },

    // ============================================================
    // PHASE 4.4 UI — WRAPPERS ÉCRITURE COMPOSITIONS (v1.7)
    // ============================================================
    // Pattern de retour unifié pour tous les wrappers d'écriture :
    //   { ok: true,  data: <objet ou tableau> }      → succès
    //   { ok: false, error: <string|object> }        → échec
    //
    // Note v1.7.1 : les wrappers UPDATE qui combinent un filtre sur
    // l'état source (validateCompo, unvalidateCompo, markCompoUtilisee)
    // utilisent .maybeSingle() et non .single(). Raison : avec .single()
    // PostgREST traite "0 ligne updatée" comme une erreur PGRST116
    // ("Cannot coerce the result to a single JSON object"), masquant
    // le message métier qu'on veut renvoyer. Avec .maybeSingle(), data
    // vaut null si aucune ligne ne matche, et notre check `if (!data)`
    // peut alors renvoyer le message correct au caller.

    // ----------------------------------------------------------
    // LECTURE — Compositions
    // ----------------------------------------------------------

    /**
     * Liste les compositions d'une équipe (toutes versions actives confondues).
     * Utilisé par l'écran E1 Tableau de bord compositions.
     *
     * @param {string} equipeId UUID de l'équipe
     * @param {object} [options]
     * @param {boolean} [options.onlyActive=true] Filtre est_active=TRUE
     * @returns {Promise<Array>} compositions avec leur événement (joint), [] si erreur
     */
    // DÉPRÉCIÉ (v1.78, COMPO-RATTACHEMENT-CATEGORIE) : plus aucun
    // consommateur après la bascule de compositions-editor.js v3.68 (la
    // jointure evenements.equipe_id exclut les évènements rattachés-
    // catégorie, equipe_id NULL). Conservé intact pour réversibilité —
    // préférer listCompositionsByCategorie.
    async listCompositionsByEquipe(equipeId, options) {
      if (!equipeId) {
        console.error('MOM Hub: listCompositionsByEquipe() requiert un equipeId');
        return [];
      }
      const opts = options || {};
      const onlyActive = opts.onlyActive !== false;

      let q = client
        .from('compositions')
        .select(`
          id, evenement_id, cote, etat, version, est_active,
          type_compo, compo_base_origine_id, notes_compo,
          created_at, updated_at,
          evenements!inner ( id, code, libelle, type_evenement,
                             date_debut, equipe_id, format_de_jeu )
        `)
        .eq('evenements.equipe_id', equipeId)
        .order('created_at', { ascending: false });

      if (onlyActive) q = q.eq('est_active', true);

      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listCompositionsByEquipe()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Liste les compositions d'une CATÉGORIE (toutes versions actives
     * confondues), via la jointure evenements!inner sur categorie_id.
     * Voie catégorie du tableau de bord E1 — COMPO-RATTACHEMENT-CATEGORIE,
     * D3 option (a) : pur front, aucune RPC neuve, policies SELECT
     * authenticated inchangées sur compositions et evenements.
     * Couvre les évènements rattachés-catégorie (equipe_id NULL,
     * post-pt 169) invisibles de listCompositionsByEquipe.
     *
     * @param {string} categorieId UUID de la catégorie
     * @param {object} [options]
     * @param {boolean} [options.onlyActive=true] Filtre est_active=TRUE
     * @returns {Promise<Array>} compositions avec leur événement (joint), [] si erreur
     */
    async listCompositionsByCategorie(categorieId, options) {
      if (!categorieId) {
        console.error('MOM Hub: listCompositionsByCategorie() requiert un categorieId');
        return [];
      }
      const opts = options || {};
      const onlyActive = opts.onlyActive !== false;

      let q = client
        .from('compositions')
        .select(`
          id, evenement_id, cote, etat, version, est_active,
          type_compo, compo_base_origine_id, notes_compo,
          created_at, updated_at,
          evenements!inner ( id, code, libelle, type_evenement,
                             date_debut, equipe_id, categorie_id, format_de_jeu )
        `)
        .eq('evenements.categorie_id', categorieId)
        .order('created_at', { ascending: false });

      if (onlyActive) q = q.eq('est_active', true);

      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listCompositionsByCategorie()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Récupère une compo complète (compositions + composition_joueurs joints
     * + personnes joints pour nom/prenom). Utilisé à l'ouverture de E3/E4.
     *
     * @param {string} compoId UUID de la composition
     * @returns {Promise<Object|null>} { compo, joueurs: [...] } ou null si erreur
     */
    async getCompoComplete(compoId) {
      if (!compoId) {
        console.error('MOM Hub: getCompoComplete() requiert un compoId');
        return null;
      }
      const [compoRes, joueursRes] = await Promise.all([
        client.from('compositions').select('*').eq('id', compoId).single(),
        client
          .from('composition_joueurs')
          .select(`
            id, composition_id, joueur_id, poste_id, numero_maillot,
            role, ordre_remplacement, est_depannage_hors_categorie,
            etat_joueur, notes_joueur, created_at,
            personnes ( id, nom, prenom, sexe, date_naissance,
                        categorie_id, club_principal_id, f15_integree )
          `)
          .eq('composition_id', compoId)
          .order('numero_maillot', { nullsFirst: false })
      ]);

      if (compoRes.error) {
        console.error('MOM Hub: getCompoComplete() compo', compoRes.error);
        return null;
      }
      if (joueursRes.error) {
        console.error('MOM Hub: getCompoComplete() joueurs', joueursRes.error);
        return null;
      }
      return {
        compo: compoRes.data,
        joueurs: Array.isArray(joueursRes.data) ? joueursRes.data : []
      };
    },

    // ----------------------------------------------------------
    // ÉCRITURE — Compositions
    // ----------------------------------------------------------

    /**
     * Crée une nouvelle composition vierge (sans joueurs).
     *
     * v1.27 — extension additive `evenement_equipe_id` optionnel
     * (modèle Collectif v1.1 §4 N3-1, sql/46) : NULL/absent =
     * comportement legacy mono-équipe (rétro-compat stricte) ;
     * renseigné = compo rattachée à l'équipe engagée. Réservé
     * `type_compo='base'` (option A actée Q1a : les matchs ne
     * portent pas `evenement_equipe_id`, leur équipe engagée se
     * déduit via `compo_base_origine_id`).
     *
     * @param {Object} params
     * @param {string} params.evenement_id          UUID requis
     * @param {('base'|'match')} params.type_compo  requis
     * @param {string} [params.evenement_equipe_id] UUID optionnel
     *   (v1.27, base seule)
     * @param {string} [params.compo_base_origine_id] UUID optionnel
     *   (match seul)
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async createCompo(params) {
      if (!params || !params.evenement_id || !params.type_compo) {
        return { ok: false, error: 'evenement_id et type_compo requis' };
      }
      if (params.type_compo !== 'base' && params.type_compo !== 'match') {
        return { ok: false, error: "type_compo doit être 'base' ou 'match'" };
      }
      if (params.compo_base_origine_id && params.type_compo !== 'match') {
        return { ok: false, error: "compo_base_origine_id incompatible avec type_compo='base'" };
      }
      // v1.27 — garde de cohérence option A (Q1a actée) : les matchs
      // dérivent leur équipe engagée via compo_base_origine_id ; ils ne
      // portent JAMAIS evenement_equipe_id directement. Symétrique de la
      // garde compo_base_origine_id ci-dessus.
      if (params.evenement_equipe_id && params.type_compo !== 'base') {
        return { ok: false, error: "evenement_equipe_id incompatible avec type_compo='match'" };
      }

      const payload = {
        evenement_id: params.evenement_id,
        cote: 'mom',
        type_compo: params.type_compo,
        etat: 'brouillon',
        version: 1,
        est_active: true
      };
      if (params.compo_base_origine_id) {
        payload.compo_base_origine_id = params.compo_base_origine_id;
      }
      // v1.27 — additif : si absent, colonne reste NULL en base
      // (DEFAULT NULL posé par sql/46), comportement legacy strict
      if (params.evenement_equipe_id) {
        payload.evenement_equipe_id = params.evenement_equipe_id;
      }

      const { data, error } = await client
        .from('compositions')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('MOM Hub: createCompo()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Duplique une compo de base vers une nouvelle compo de match.
     * 2 appels successifs (INSERT compo + INSERT batch joueurs) en JS pur,
     * avec rollback manuel si la 2e étape échoue.
     */
    async duplicateCompoFromBase(compoBaseId, evenementId) {
      if (!compoBaseId || !evenementId) {
        return { ok: false, error: 'compoBaseId et evenementId requis' };
      }

      const source = await this.getCompoComplete(compoBaseId);
      if (!source) {
        return { ok: false, error: 'Compo source introuvable' };
      }
      if (source.compo.type_compo !== 'base') {
        return { ok: false, error: 'La compo source doit être de type "base"' };
      }

      const createRes = await this.createCompo({
        evenement_id: evenementId,
        type_compo: 'match',
        compo_base_origine_id: compoBaseId
      });
      if (!createRes.ok) return createRes;
      const newCompo = createRes.data;

      if (source.joueurs.length === 0) {
        return { ok: true, data: { compo: newCompo, joueurs: [] } };
      }
      const newJoueurs = source.joueurs.map(function (j) {
        return {
          composition_id: newCompo.id,
          joueur_id: j.joueur_id,
          poste_id: j.poste_id,
          numero_maillot: j.numero_maillot,
          role: j.role,
          ordre_remplacement: j.ordre_remplacement,
          est_depannage_hors_categorie: j.est_depannage_hors_categorie,
          etat_joueur: 'base',
          notes_joueur: null
        };
      });

      const { data: insertedJoueurs, error: joueursErr } = await client
        .from('composition_joueurs')
        .insert(newJoueurs)
        .select();

      if (joueursErr) {
        console.error('MOM Hub: duplicateCompoFromBase() joueurs error, rollback', joueursErr);
        await client.from('compositions').delete().eq('id', newCompo.id);
        return { ok: false, error: 'Échec duplication joueurs : ' + joueursErr.message };
      }

      return { ok: true, data: { compo: newCompo, joueurs: insertedJoueurs || [] } };
    },

    /**
     * Liste les MATCHS d'une équipe dans un tournoi (pour les onglets de
     * compo de match, étape 6c-6). Les matchs sont des lignes `evenements`
     * descendantes de la racine `racineId` (enfants = phases, petits-enfants
     * = matchs portant adversaire_nom). On récupère 2 niveaux sous la racine
     * puis on filtre : equipe_id == equipeId ET (adversaire_nom non vide OU
     * libellé « vs … »), ce qui isole les matchs réels (pas les phases).
     * @param {string} racineId UUID racine (tournoi)
     * @param {string} equipeId UUID equipe
     * @returns {Promise<Array>} matchs triés par phase puis ordre
     */
    async listMatchsDeLequipe(racineId, equipeId) {
      if (!racineId || !equipeId) return [];
      const cols = 'id, libelle, adversaire_nom, phase_libelle, ordre_dans_phase, evenement_parent_id, equipe_id';
      const { data: enfants, error: e1 } = await client
        .from('evenements').select(cols).eq('evenement_parent_id', racineId);
      if (e1) { console.error('MOM Hub: listMatchsDeLequipe() niveau 1', e1); return []; }
      const phaseIds = (enfants || []).map(function (e) { return e.id; });
      let petitsEnfants = [];
      if (phaseIds.length > 0) {
        const { data: pe, error: e2 } = await client
          .from('evenements').select(cols).in('evenement_parent_id', phaseIds);
        if (e2) { console.error('MOM Hub: listMatchsDeLequipe() niveau 2', e2); }
        else { petitsEnfants = pe || []; }
      }
      const estMatch = function (e) {
        if (!e || e.equipe_id !== equipeId) return false;
        const adv = (e.adversaire_nom || '').trim();
        const lib = (e.libelle || '').trim().toLowerCase();
        return adv !== '' || lib.indexOf('vs ') === 0;
      };
      const pool = petitsEnfants.length > 0 ? petitsEnfants : (enfants || []);
      const matchs = pool.filter(estMatch);
      matchs.sort(function (a, b) {
        const pa = a.phase_libelle || '', pb = b.phase_libelle || '';
        if (pa !== pb) return pa.localeCompare(pb, 'fr');
        return (a.ordre_dans_phase || 0) - (b.ordre_dans_phase || 0);
      });
      return matchs;
    },

    /**
     * Met à jour le champ notes_compo (autosave de la textarea).
     */
    async updateCompoNotes(compoId, notes) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ notes_compo: notes || null })
        .eq('id', compoId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: updateCompoNotes()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Passe une compo de 'brouillon' à 'validee'.
     * Utilise .maybeSingle() : si la compo n'est pas en 'brouillon',
     * data vaut null et on renvoie le message métier.
     */
    async validateCompo(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ etat: 'validee' })
        .eq('id', compoId)
        .eq('etat', 'brouillon')
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: validateCompo()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: "La compo n'est pas en état 'brouillon'" };
      }
      return { ok: true, data };
    },

    /**
     * Repasse une compo de 'validee' à 'brouillon'.
     * Utilise .maybeSingle() pour le garde-fou métier.
     */
    async unvalidateCompo(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ etat: 'brouillon' })
        .eq('id', compoId)
        .eq('etat', 'validee')
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: unvalidateCompo()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: "La compo n'est pas en état 'validee'" };
      }
      return { ok: true, data };
    },

    /**
     * Marque manuellement une compo comme 'utilisee'.
     * Utilise .maybeSingle() pour le garde-fou métier.
     */
    async markCompoUtilisee(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ etat: 'utilisee' })
        .eq('id', compoId)
        .eq('etat', 'validee')
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: markCompoUtilisee()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: "La compo n'est pas en état 'validee'" };
      }
      return { ok: true, data };
    },

    /**
     * Archive une compo (etat='archivee' + est_active=FALSE).
     */
    async archiveCompo(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ etat: 'archivee', est_active: false })
        .eq('id', compoId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: archiveCompo()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    // ----------------------------------------------------------
    // ÉCRITURE — Composition Joueurs (lignes)
    // ----------------------------------------------------------

    /**
     * Ajoute un joueur à une compo (1 ligne dans composition_joueurs).
     */
    async addJoueurCompo(params) {
      if (!params || !params.composition_id || !params.joueur_id || !params.poste_id) {
        return { ok: false, error: 'composition_id, joueur_id, poste_id requis' };
      }
      const payload = {
        composition_id: params.composition_id,
        joueur_id: params.joueur_id,
        poste_id: params.poste_id,
        role: params.role || 'titulaire',
        etat_joueur: params.etat_joueur || 'base',
        est_depannage_hors_categorie: !!params.est_depannage_hors_categorie
      };
      if (params.numero_maillot !== undefined && params.numero_maillot !== null) {
        payload.numero_maillot = params.numero_maillot;
      }
      if (params.ordre_remplacement !== undefined && params.ordre_remplacement !== null) {
        payload.ordre_remplacement = params.ordre_remplacement;
      }

      const { data, error } = await client
        .from('composition_joueurs')
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: addJoueurCompo()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Met à jour une ligne composition_joueurs avec whitelist des champs.
     */
    async updateJoueurCompo(compoJoueurId, patch) {
      if (!compoJoueurId) return { ok: false, error: 'compoJoueurId requis' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'patch (objet) requis' };
      }
      const allowedKeys = [
        'poste_id', 'role', 'numero_maillot', 'ordre_remplacement',
        'etat_joueur', 'est_depannage_hors_categorie', 'notes_joueur'
      ];
      const cleanPatch = {};
      for (const k of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          cleanPatch[k] = patch[k];
        }
      }
      if (Object.keys(cleanPatch).length === 0) {
        return { ok: false, error: 'Aucun champ modifiable dans patch' };
      }

      const { data, error } = await client
        .from('composition_joueurs')
        .update(cleanPatch)
        .eq('id', compoJoueurId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: updateJoueurCompo()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Raccourci : change uniquement l'etat_joueur (bleu/orange/vert/rouge).
     */
    async updateJoueurEtat(compoJoueurId, etat) {
      const validEtats = ['base', 'modifie', 'independant', 'blesse'];
      if (validEtats.indexOf(etat) === -1) {
        return { ok: false, error: 'etat invalide (base/modifie/independant/blesse)' };
      }
      return this.updateJoueurCompo(compoJoueurId, { etat_joueur: etat });
    },

    /**
     * Retire un joueur d'une compo (DELETE de la ligne composition_joueurs).
     */
    async removeJoueurCompo(compoJoueurId) {
      if (!compoJoueurId) return { ok: false, error: 'compoJoueurId requis' };
      const { data, error } = await client
        .from('composition_joueurs')
        .delete()
        .eq('id', compoJoueurId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: removeJoueurCompo()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    // ============================================================
    // PHASE 5.3 — WRAPPERS PRÉPARATION DE SÉANCE (v1.8)
    // ============================================================
    // 13 wrappers pour piloter les 3 tables seances / seances_blocs /
    // seances_blocs_ateliers créées en Phase 5.1, et appeler les 2 RPC
    // get_seances_a_venir + get_seance_complete.
    //
    // Pattern de retour identique aux wrappers Compositions Phase 4.4 :
    //   LECTURE     : retourne directement data (ou [] / null)
    //   ÉCRITURE    : retourne { ok: true, data } ou { ok: false, error }
    //
    // CHECK constraints SQL en miroir côté JS pour fail-fast :
    //   - type_bloc        : 11 valeurs (data/types-blocs.json)
    //   - intensite        : 4 valeurs (data/types-blocs.json)
    //   - etat (séance)    : 4 valeurs (brouillon/validee/utilisee/archivee)
    //   - atelier_fileid_drive : longueur exacte 33 caractères

    // ----------------------------------------------------------
    // LECTURE — Préparation de séance
    // ----------------------------------------------------------

    /**
     * Liste les séances d'une équipe (par défaut hors modèles, hors archivées).
     * Utilisé par la sidebar « Mes séances récentes » du module.
     *
     * @param {string} equipeId UUID de l'équipe
     * @param {object} [options]
     * @param {boolean} [options.includeModeles=false] Inclure les modèles (est_modele=TRUE)
     * @param {string}  [options.etat] Filtre exact sur etat (sinon : tous sauf archivee)
     * @param {boolean} [options.excludeArchivees=true] Exclure les séances archivées
     * @param {number}  [options.limit=10] Nombre max de résultats
     * @returns {Promise<Array>} Tableau de séances, [] si erreur
     */
    async listSeancesByEquipe(equipeId, options) {
      const opts = options || {};
      // Chantier SEANCE-RATTACHEMENT-CATEGORIE : si opts.categorieId fourni,
      // on filtre par catégorie (rattachement principal) ; sinon rétro-compat
      // par equipe_id.
      if (!equipeId && !opts.categorieId) {
        console.error('MOM Hub: listSeancesByEquipe() requiert equipeId ou opts.categorieId');
        return [];
      }

      let q = client
        .from('seances')
        .select('*');
      if (opts.categorieId) {
        q = q.eq('categorie_id', opts.categorieId);
      } else {
        q = q.eq('equipe_id', equipeId);
      }

      // Par défaut : exclut les modèles (vraies séances seulement)
      if (opts.includeModeles !== true) {
        q = q.eq('est_modele', false);
      }

      // Filtre par état (mutuellement exclusif avec excludeArchivees)
      if (opts.etat) {
        q = q.eq('etat', opts.etat);
      } else if (opts.excludeArchivees !== false) {
        q = q.neq('etat', 'archivee');
      }

      const limit = opts.limit || 10;
      q = q.order('date_seance', { ascending: false, nullsFirst: false })
           .order('created_at', { ascending: false })
           .limit(limit);

      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listSeancesByEquipe()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Récupère une séance complète via la RPC get_seance_complete :
     * 1 appel = séance + blocs (ordonnés) + ateliers rattachés à chaque bloc.
     * Utilisé à l'ouverture d'une séance dans l'éditeur.
     *
     * @param {string} seanceId UUID de la séance
     * @returns {Promise<Object|null>} JSONB { seance: {...}, blocs: [...] } ou null
     */
    async getSeanceComplete(seanceId) {
      if (!seanceId) {
        console.error('MOM Hub: getSeanceComplete() requiert un seanceId');
        return null;
      }
      const { data, error } = await client.rpc('get_seance_complete', {
        p_seance_id: seanceId
      });
      if (error) {
        console.error('MOM Hub: getSeanceComplete()', error);
        return null;
      }
      return data;
    },

    /**
     * Liste les séances futures d'une équipe via la RPC get_seances_a_venir.
     * Retourne les séances de J+0 à J+joursAVenir, hors modèles et hors archivées,
     * avec compteur de blocs par séance.
     *
     * @param {string} equipeId UUID de l'équipe
     * @param {number} [joursAVenir=14] Fenêtre en jours à partir d'aujourd'hui
     * @returns {Promise<Array>} Tableau de séances avec nb_blocs, [] si erreur
     */
    async getSeancesAVenir(equipeId, joursAVenir, categorieId) {
      // Chantier SEANCE-RATTACHEMENT-CATEGORIE : filtrage catégorie-first.
      // Rétro-compat : si categorieId absent, on filtre encore par equipeId.
      if (!equipeId && !categorieId) {
        console.error('MOM Hub: getSeancesAVenir() requiert categorieId ou equipeId');
        return [];
      }
      const jours = (joursAVenir === undefined || joursAVenir === null) ? 14 : joursAVenir;
      const { data, error } = await client.rpc('get_seances_a_venir', {
        p_equipe_id: equipeId || null,
        p_jours_a_venir: jours,
        p_categorie_id: categorieId || null
      });
      if (error) {
        console.error('MOM Hub: getSeancesAVenir()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Liste les modèles de séance disponibles (est_modele=TRUE, hors archivées).
     * Wrapper prêt pour la V2 « Nouvelle séance depuis modèle ».
     *
     * @param {object} [options]
     * @param {string} [options.equipeId] Filtrer par équipe (sinon : tous modèles)
     * @param {number} [options.limit=50]
     * @returns {Promise<Array>} Tableau de modèles, [] si erreur
     */
    async listModelesSeance(options) {
      const opts = options || {};
      let q = client
        .from('seances')
        .select('*')
        .eq('est_modele', true)
        .neq('etat', 'archivee');

      if (opts.equipeId) {
        q = q.eq('equipe_id', opts.equipeId);
      }

      const limit = opts.limit || 50;
      q = q.order('created_at', { ascending: false }).limit(limit);

      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listModelesSeance()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Liste les sites actifs (terrains et lieux d'entraînement / match).
     * Wrapper Phase 5.5.B1 ajouté pour alimenter le dropdown lieu_id du
     * formulaire méta séance.
     *
     * @param {object} [options]
     * @param {number} [options.limit=100] Plafond raisonnable (peu de sites en pratique)
     * @returns {Promise<Array>} Sites triés par libellé, [] si erreur
     */
    async listSitesActifs(options) {
      const opts = options || {};
      const limit = opts.limit || 100;
      const { data, error } = await client
        .from('sites')
        .select('id, code, libelle, libelle_court, ville, type_site')
        .eq('actif', true)
        .order('libelle', { ascending: true })
        .limit(limit);
      if (error) {
        console.error('MOM Hub: listSitesActifs()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * ADMIN-(ii) (4) — Liste TOUS les sites (actifs + inactifs), pour
     * la grille d'administration. Miroir admin de listSitesActifs()
     * (qui, lui, reste active-only et alimente le dropdown évènement).
     * Projection riche (toutes les colonnes éditables de la modale).
     * LECTURE seule ; RLS SELECT = tout authentifié (pg_policies 28/05).
     *
     * @param {object} [options]
     * @param {number} [options.limit=500]
     * @returns {Promise<Array>} Sites triés par libellé, [] si erreur
     */
    async listSites(options) {
      const opts = options || {};
      const limit = opts.limit || 500;
      const { data, error } = await client
        .from('sites')
        .select('id, code, libelle, libelle_court, adresse, code_postal, ' +
                'ville, pays, latitude, longitude, type_site, ' +
                'capacite_estimee, notes, actif')
        .order('libelle', { ascending: true })
        .limit(limit);
      if (error) {
        console.error('MOM Hub: listSites()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * ÉCRITURE — Crée un site (doc §3.2 ; écran admin sites, Voie A).
     * RLS write = has_role('admin') SEUL (pg_policies 28/05). Requis
     * (NOT NULL sans défaut, information_schema 28/05) : `libelle` +
     * `code`. `code` n'ayant PAS de défaut DB, il est AUTO-dérivé du
     * libellé ici s'il n'est pas fourni (slug majuscule + suffixe
     * base36 court anti-collision ; code invisible en UI — value du
     * dropdown évènement = id). `pays` (défaut 'France'), `actif`
     * (défaut true) et `id/created_at/...` (défauts DB) NON envoyés.
     * `club_principal_id` non exposé (NULL inutilisé, doc). Whitelist
     * = colonnes réelles `sites`.
     *
     * @param {Object} payload  { libelle (requis), ville?, type_site?, ... }
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async createSite(payload) {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      const libelle = (payload.libelle == null ? '' : String(payload.libelle)).trim();
      if (!libelle) {
        return { ok: false, error: 'Champ requis manquant : libelle (nom du site)' };
      }
      // `code` auto si absent : slug majuscule sans accents (≤ 24) +
      // suffixe base36 court (Date.now) pour limiter les collisions.
      let code = (payload.code == null ? '' : String(payload.code)).trim();
      if (!code) {
        const slug = libelle
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
          .toUpperCase().slice(0, 24);
        const suffix = Date.now().toString(36).slice(-4).toUpperCase();
        code = (slug || 'SITE') + '-' + suffix;
      }
      const allowedFields = [
        'libelle', 'libelle_court', 'adresse', 'code_postal', 'ville',
        'type_site', 'latitude', 'longitude', 'capacite_estimee', 'notes'
      ];
      const insertPayload = { code: code };
      allowedFields.forEach(function (f) {
        if (payload[f] !== undefined) insertPayload[f] = payload[f];
      });
      const { data, error } = await client
        .from('sites')
        .insert(insertPayload)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: createSite()', error);
        return { ok: false, error: error.message || 'Erreur INSERT sites' };
      }
      return { ok: true, data: data };
    },

    /**
     * ÉCRITURE — Met à jour un site (édition par clic, doc §3.2).
     * PATCH partiel : seuls les champs fournis sont écrits. Whitelist
     * SANS `code` (identifiant stable, non édité) NI `actif` (chemin
     * dédié setSiteActif). id/created_at/updated_at/cree_par exclus.
     * RLS write = has_role('admin') SEUL.
     *
     * @param {string} siteId  UUID sites.id
     * @param {Object} patch   sous-ensemble des colonnes site
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async updateSite(siteId, patch) {
      if (!siteId) return { ok: false, error: 'siteId manquant' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'patch manquant ou invalide' };
      }
      const allowedFields = [
        'libelle', 'libelle_court', 'adresse', 'code_postal', 'ville',
        'type_site', 'latitude', 'longitude', 'capacite_estimee', 'notes'
      ];
      const updatePayload = {};
      allowedFields.forEach(function (f) {
        if (patch[f] !== undefined) updatePayload[f] = patch[f];
      });
      if (Object.keys(updatePayload).length === 0) {
        return { ok: false, error: 'Aucun champ à mettre à jour' };
      }
      const { data, error } = await client
        .from('sites')
        .update(updatePayload)
        .eq('id', siteId)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: updateSite()', error);
        return { ok: false, error: error.message || 'Erreur UPDATE sites' };
      }
      return { ok: true, data: data };
    },

    /**
     * ÉCRITURE — Active / désactive un site (doc §3.2 : jamais de
     * suppression dure, on bascule le BOOLÉEN `actif` pour préserver
     * l'historique évènements ; listSitesActifs() ne renvoie que
     * actif=true). ≠ setEquipeStatut (statut TEXTE) : `sites` n'a pas
     * de colonne statut (vérifié information_schema 28/05).
     * RLS write = has_role('admin') SEUL.
     *
     * @param {string} siteId  UUID
     * @param {boolean} actif  nouvel état (true = actif, false = inactif)
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async setSiteActif(siteId, actif) {
      if (!siteId) return { ok: false, error: 'siteId manquant' };
      if (typeof actif !== 'boolean') {
        return { ok: false, error: 'actif requis (booléen)' };
      }
      const { data, error } = await client
        .from('sites')
        .update({ actif: actif })
        .eq('id', siteId)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: setSiteActif()', error);
        return { ok: false, error: error.message || 'Erreur UPDATE actif site' };
      }
      return { ok: true, data: data };
    },

    /**
     * Liste tous les blocs d'une séance, triés par ordre croissant.
     * Wrapper Phase 5.6.A : alternative légère à get_seance_complete
     * pour les usages "trame chronologique sans ateliers rattachés".
     *
     * @param {string} seanceId UUID de la séance
     * @returns {Promise<Array>} Tableau de blocs triés par ordre, [] si erreur
     */
    async listBlocsBySeance(seanceId) {
      if (!seanceId) {
        console.error('MOM Hub: listBlocsBySeance() requiert un seanceId');
        return [];
      }
      const { data, error } = await client
        .from('seances_blocs')
        .select('*')
        .eq('seance_id', seanceId)
        .order('ordre', { ascending: true });
      if (error) {
        console.error('MOM Hub: listBlocsBySeance()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    // ----------------------------------------------------------
    // ÉCRITURE — Séance
    // ----------------------------------------------------------

    /**
     * Crée une nouvelle séance (vraie séance datée ou modèle).
     * Si est_modele=true, date_seance doit rester null (CHECK SQL).
     *
     * @param {object} params
     * @param {string} params.equipe_id (requis)
     * @param {boolean} [params.est_modele=false]
     * @param {string} [params.evenement_id]
     * @param {string} [params.date_seance] ISO date 'YYYY-MM-DD'
     * @param {string} [params.heure_debut] 'HH:MM' ou 'HH:MM:SS'
     * @param {number} [params.duree_totale_min=75]
     * @param {number} [params.effectif_prevu]
     * @param {string} [params.lieu_id]
     * @param {string} [params.meteo_text]
     * @param {string} [params.encadrants_text]
     * @param {string} [params.axe_travail_general]
     * @param {string} [params.theme_principal]
     * @param {string} [params.objectifs_text]
     * @param {string} [params.bloc_cycle]
     * @param {string} [params.materiel_global_text]
     * @param {string} [params.modele_origine_id] Si dupliqué depuis modèle
     * @param {string} [params.etat='brouillon']
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async createSeance(params) {
      // Chantier SEANCE-RATTACHEMENT-CATEGORIE : le rattachement principal est
      // désormais categorie_id. equipe_id devient optionnel (nullable en base).
      // On exige au moins un rattachement (catégorie OU équipe).
      if (!params || (!params.categorie_id && !params.equipe_id)) {
        return { ok: false, error: 'categorie_id (ou equipe_id) requis' };
      }

      const isModele = !!params.est_modele;
      if (isModele && params.date_seance) {
        return { ok: false, error: 'Un modèle ne peut pas avoir de date_seance (CHECK SQL)' };
      }

      const payload = {
        est_modele: isModele,
        etat: params.etat || 'brouillon',
        duree_totale_min: params.duree_totale_min || 75
      };
      if (params.categorie_id) payload.categorie_id = params.categorie_id;

      // Champs optionnels (seulement si fournis explicitement)
      const optionalKeys = [
        'equipe_id',
        'evenement_id', 'date_seance', 'heure_debut', 'effectif_prevu',
        'lieu_id', 'meteo_text', 'encadrants_text',
        'axe_travail_general', 'theme_principal', 'objectifs_text',
        'bloc_cycle', 'materiel_global_text', 'modele_origine_id'
      ];
      for (const k of optionalKeys) {
        if (params[k] !== undefined) payload[k] = params[k];
      }

      const { data, error } = await client
        .from('seances')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('MOM Hub: createSeance()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Met à jour les méta d'une séance avec whitelist des champs.
     * NE TOUCHE PAS à : id, equipe_id, est_modele, modele_origine_id, etat,
     * created_at, created_by. Pour archiver : utiliser archiveSeance().
     *
     * @param {string} seanceId
     * @param {object} patch
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async updateSeance(seanceId, patch) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'patch (objet) requis' };
      }
      const allowedKeys = [
        'evenement_id', 'date_seance', 'heure_debut', 'duree_totale_min',
        'effectif_prevu', 'lieu_id', 'meteo_text', 'encadrants_text',
        'axe_travail_general', 'theme_principal', 'objectifs_text',
        'bloc_cycle', 'materiel_global_text'
      ];
      const cleanPatch = {};
      for (const k of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          cleanPatch[k] = patch[k];
        }
      }
      if (Object.keys(cleanPatch).length === 0) {
        return { ok: false, error: 'Aucun champ modifiable dans patch' };
      }

      const { data, error } = await client
        .from('seances')
        .update(cleanPatch)
        .eq('id', seanceId)
        .select()
        .single();

      if (error) {
        console.error('MOM Hub: updateSeance()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Archive une séance (etat='archivee'). UPDATE simple sans filtre d'état
     * source : on peut archiver depuis n'importe quel état.
     */
    async archiveSeance(seanceId) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      const { data, error } = await client
        .from('seances')
        .update({ etat: 'archivee' })
        .eq('id', seanceId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: archiveSeance()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Archive plusieurs séances par lot (Phase 5.13 — durcissement soft-delete).
     * UPDATE etat='archivee' sur tous les IDs fournis, depuis n'importe quel
     * état (l'archivage est récupérable, donc non restreint au brouillon).
     * Pendant utilisée comme remplaçant récupérable du DELETE en lot des
     * brouillons : « mettre à la corbeille » plutôt que supprimer.
     *
     * @param {string[]} seanceIds Tableau d'UUIDs à archiver
     * @returns {Promise<{ok:boolean, archived_count?:number, error?:string}>}
     */
    async archiveSeancesEnLot(seanceIds) {
      if (!Array.isArray(seanceIds)) {
        return { ok: false, error: 'seanceIds (tableau) requis' };
      }
      if (seanceIds.length === 0) {
        return { ok: true, archived_count: 0 };
      }
      const { data, error } = await client
        .from('seances')
        .update({ etat: 'archivee' })
        .in('id', seanceIds)
        .select('id');
      if (error) {
        console.error('MOM Hub: archiveSeancesEnLot()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, archived_count: Array.isArray(data) ? data.length : 0 };
    },

    /**
     * Purge DÉFINITIVE d'UNE séance archivée (Phase 5.13 — corbeille).
     * DELETE physique BORNÉ côté serveur par .eq('etat','archivee') : il est
     * IMPOSSIBLE de purger une séance brouillon/validée/utilisée — elle doit
     * d'abord passer par l'archivage (corbeille). Le CASCADE FK supprime les
     * seances_blocs et seances_blocs_ateliers liés.
     *
     * @param {string} seanceId UUID de la séance archivée à purger
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async purgerSeanceArchivee(seanceId) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      const { data, error } = await client
        .from('seances')
        .delete()
        .eq('id', seanceId)
        .eq('etat', 'archivee')
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: purgerSeanceArchivee()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: 'Séance introuvable ou pas archivée (seules les séances archivées sont purgeables)' };
      }
      return { ok: true, data };
    },

    /**
     * Purge DÉFINITIVE de plusieurs séances archivées par lot (Phase 5.13).
     * Même garde-fou serveur que purgerSeanceArchivee : DELETE borné par
     * .eq('etat','archivee'). Toute séance non-archivée dans la liste est
     * silencieusement ignorée (filtrée côté serveur par PostgREST).
     *
     * @param {string[]} seanceIds Tableau d'UUIDs archivés à purger
     * @returns {Promise<{ok:boolean, purged_count?:number, error?:string}>}
     */
    async purgerSeancesArchiveesEnLot(seanceIds) {
      if (!Array.isArray(seanceIds)) {
        return { ok: false, error: 'seanceIds (tableau) requis' };
      }
      if (seanceIds.length === 0) {
        return { ok: true, purged_count: 0 };
      }
      const { data, error } = await client
        .from('seances')
        .delete()
        .in('id', seanceIds)
        .eq('etat', 'archivee')
        .select('id');
      if (error) {
        console.error('MOM Hub: purgerSeancesArchiveesEnLot()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, purged_count: Array.isArray(data) ? data.length : 0 };
    },

    /**
     * Valide une séance (Phase 5.12) : bascule etat='brouillon' → 'validee'.
     * Garde-fou serveur via .eq('etat','brouillon') : refuse de valider
     * une séance déjà validée, utilisée ou archivée. Renvoie {ok:false}
     * si la séance n'est pas dans l'état attendu (data sera null).
     */
    async validerSeance(seanceId) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      const { data, error } = await client
        .from('seances')
        .update({ etat: 'validee' })
        .eq('id', seanceId)
        .eq('etat', 'brouillon')
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: validerSeance()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: 'Séance introuvable ou pas en état brouillon' };
      }
      return { ok: true, data };
    },

    /**
     * Repasse une séance en brouillon (Phase 5.12) : bascule
     * etat='validee'|'utilisee' → 'brouillon'. Permet la re-modification
     * libre après validation. Garde-fou serveur via .in('etat', [...]).
     */
    async repasserSeanceBrouillon(seanceId) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      const { data, error } = await client
        .from('seances')
        .update({ etat: 'brouillon' })
        .eq('id', seanceId)
        .in('etat', ['validee', 'utilisee'])
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: repasserSeanceBrouillon()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: 'Séance introuvable ou pas en état validée/utilisée' };
      }
      return { ok: true, data };
    },

    /**
     * Duplique une séance (méta + blocs + ateliers) via la RPC
     * dupliquer_seance (sql_184). La copie repart en 'brouillon', sans
     * date, filiation tracée via modele_origine_id. Garde B5 serveur
     * (admin|bureau|référent de la catégorie). Retourne l'uuid de la copie.
     * SEANCE-DUPLICATION v1.
     */
    async dupliquerSeance(sourceId) {
      if (!sourceId) return { ok: false, error: 'sourceId requis' };
      const { data, error } = await client.rpc('dupliquer_seance', {
        p_source_id: sourceId
      });
      if (error) {
        console.error('MOM Hub: dupliquerSeance()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Supprime physiquement une séance (Phase 5.12).
     * Garde-fou métier : seuls les brouillons sont supprimables.
     * Le CASCADE FK supprime automatiquement les seances_blocs et
     * seances_blocs_ateliers liés.
     */
    async deleteSeance(seanceId) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      const { data, error } = await client
        .from('seances')
        .delete()
        .eq('id', seanceId)
        .eq('etat', 'brouillon')
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: deleteSeance()', error);
        return { ok: false, error: error.message };
      }
      if (!data) {
        return { ok: false, error: 'Séance introuvable ou pas un brouillon (seuls les brouillons sont supprimables)' };
      }
      return { ok: true, data };
    },

    /**
     * Supprime plusieurs séances par lot (Phase 5.12).
     * Même garde-fou que deleteSeance : uniquement les brouillons.
     * Les séances non-brouillon dans la liste seront silencieusement
     * ignorées (PostgREST filtre côté serveur via .eq('etat','brouillon')).
     */
    async deleteSeancesEnLot(seanceIds) {
      if (!Array.isArray(seanceIds)) {
        return { ok: false, error: 'seanceIds (tableau) requis' };
      }
      if (seanceIds.length === 0) {
        return { ok: true, deleted_count: 0 };
      }
      const { data, error } = await client
        .from('seances')
        .delete()
        .in('id', seanceIds)
        .eq('etat', 'brouillon')
        .select('id');
      if (error) {
        console.error('MOM Hub: deleteSeancesEnLot()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, deleted_count: Array.isArray(data) ? data.length : 0 };
    },

    /**
     * Liste les brouillons "vides" d'une équipe (Phase 5.10).
     * Définition : etat='brouillon' ET date_seance IS NULL ET aucun bloc
     * rattaché (count seances_blocs = 0). Implémentation JS en 2 passes
     * (SELECT puis filtrage par count) pour éviter une RPC SQL dédiée.
     *
     * @param {string} equipeId UUID de l'équipe
     * @returns {Promise<Array<{id:string, created_at:string}>>} brouillons
     *          éligibles à la suppression (peut être vide)
     */
    async listBrouillonsVides(equipeId, categorieId) {
      // Chantier SEANCE-RATTACHEMENT-CATEGORIE : filtrage catégorie-first,
      // rétro-compat equipe_id si categorieId absent.
      if (!equipeId && !categorieId) {
        console.error('MOM Hub: listBrouillonsVides() requiert equipeId ou categorieId');
        return [];
      }
      // Étape 1 : SELECT brouillons sans date_seance
      let q1 = client
        .from('seances')
        .select('id, created_at')
        .eq('etat', 'brouillon')
        .eq('est_modele', false)
        .is('date_seance', null);
      q1 = categorieId ? q1.eq('categorie_id', categorieId) : q1.eq('equipe_id', equipeId);
      const { data: brouillons, error: e1 } = await q1;
      if (e1) {
        console.error('MOM Hub: listBrouillonsVides() étape 1', e1);
        return [];
      }
      if (!brouillons || brouillons.length === 0) return [];

      // Étape 2 : pour chaque brouillon, count des blocs ; garde ceux à 0
      // Note : count peut être null si la RLS retourne 0 lignes — dans ce cas
      // on considère aussi le brouillon comme vide (pas de blocs visibles).
      const vides = [];
      for (const b of brouillons) {
        const { count, error: e2 } = await client
          .from('seances_blocs')
          .select('id', { count: 'exact', head: true })
          .eq('seance_id', b.id);
        if (e2) {
          console.error('MOM Hub: listBrouillonsVides() étape 2 sur', b.id, e2);
          continue; // Skip ce brouillon mais continue les autres
        }
        // count peut être 0 (clair), null (RLS / aucune ligne), ou un nombre
        if (count === 0 || count === null || count === undefined) {
          vides.push(b);
        }
      }
      return vides;
    },

    /**
     * Supprime physiquement plusieurs séances par leurs IDs (Phase 5.10).
     * Le CASCADE FK ON DELETE supprimera les éventuels blocs orphelins
     * (normalement aucun, puisqu'on n'appelle ça que sur des brouillons
     * vides identifiés par listBrouillonsVides).
     *
     * @param {string[]} seanceIds Tableau d'UUIDs à supprimer
     * @returns {Promise<{ok:boolean, deleted_count?:number, error?:string}>}
     */
    async deleteBrouillonsVides(seanceIds) {
      if (!Array.isArray(seanceIds)) {
        return { ok: false, error: 'seanceIds (tableau) requis' };
      }
      if (seanceIds.length === 0) {
        return { ok: true, deleted_count: 0 };
      }
      // Garde-fou : on ne DELETE que des brouillons (double check côté serveur via .eq)
      const { data, error } = await client
        .from('seances')
        .delete()
        .in('id', seanceIds)
        .eq('etat', 'brouillon')
        .select('id');
      if (error) {
        console.error('MOM Hub: deleteBrouillonsVides()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, deleted_count: Array.isArray(data) ? data.length : 0 };
    },

    // ----------------------------------------------------------
    // ÉCRITURE — Blocs de séance
    // ----------------------------------------------------------

    // 11 types de bloc autorisés (mirror CHECK SQL seances_blocs.type_bloc)
    _validTypesBloc: [
      'accueil', 'mise_en_train', 'echauffement', 'echauffement_specifique',
      'corps_seance', 'jeu_application', 'match_application',
      'retour_au_calme', 'bilan', 'pause_boisson', 'bloc_libre'
    ],

    // 4 niveaux d'intensité autorisés (mirror CHECK SQL seances_blocs.intensite)
    _validIntensites: [
      'sans_contact', 'toucher_ceinture', 'contact_controle', 'live_combat_reel'
    ],

    /**
     * Ajoute un bloc à une séance. Si `ordre` n'est pas fourni, il est
     * calculé automatiquement = max(ordre actuel) + 1 (ajout en fin de trame).
     *
     * @param {string} seanceId
     * @param {object} params
     * @param {string} params.type_bloc (requis, 1 des 11 valeurs)
     * @param {number} params.duree_min (requis)
     * @param {number} [params.ordre] Auto-calculé si absent
     * @param {string} [params.titre_precision]
     * @param {string} [params.intensite] 1 des 4 valeurs ou null
     * @param {string} [params.etiquette_axe2]
     * @param {string} [params.etiquette_axe3]
     * @param {string} [params.comportements_attendus]
     * @param {string} [params.organisation_spatio_temporelle]
     * @param {Array}  [params.groupes_jsonb]
     * @param {Array}  [params.materiel_jsonb]
     * @param {object} [params.contenu_pedagogique_axe4]
     * @param {string} [params.notes_bloc]
     */
    async addBlocToSeance(seanceId, params) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      if (!params || !params.type_bloc || params.duree_min === undefined || params.duree_min === null) {
        return { ok: false, error: 'type_bloc et duree_min requis' };
      }
      if (this._validTypesBloc.indexOf(params.type_bloc) === -1) {
        return { ok: false, error: "type_bloc invalide (cf. data/types-blocs.json)" };
      }
      if (params.intensite && this._validIntensites.indexOf(params.intensite) === -1) {
        return { ok: false, error: "intensite invalide (cf. data/types-blocs.json)" };
      }

      // Auto-ordre : max(ordre) + 1
      let ordre = params.ordre;
      if (ordre === undefined || ordre === null) {
        const lastQuery = await client
          .from('seances_blocs')
          .select('ordre')
          .eq('seance_id', seanceId)
          .order('ordre', { ascending: false })
          .limit(1)
          .maybeSingle();
        ordre = lastQuery.data ? lastQuery.data.ordre + 1 : 1;
      }

      const payload = {
        seance_id: seanceId,
        ordre: ordre,
        type_bloc: params.type_bloc,
        duree_min: params.duree_min
      };
      const optionalKeys = [
        'titre_precision', 'intensite',
        'etiquette_axe2', 'etiquette_axe3',
        'comportements_attendus', 'organisation_spatio_temporelle',
        'groupes_jsonb', 'materiel_jsonb', 'contenu_pedagogique_axe4',
        'notes_bloc',
        // v1.63 — blocs parallèles + coach par bloc (sql_108)
        'voie', 'encadrant_id',
        // v1.65 — multi-coachs (sql_110) : liste plate uuid[]
        'encadrants_ids'
      ];
      for (const k of optionalKeys) {
        if (params[k] !== undefined) payload[k] = params[k];
      }

      const { data, error } = await client
        .from('seances_blocs')
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: addBlocToSeance()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Met à jour un bloc avec whitelist des champs.
     * NE TOUCHE PAS à : id, seance_id, ordre (cf. reorderBlocs).
     */
    async updateBloc(blocId, patch) {
      if (!blocId) return { ok: false, error: 'blocId requis' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'patch (objet) requis' };
      }
      const allowedKeys = [
        'type_bloc', 'titre_precision', 'duree_min', 'intensite',
        'etiquette_axe2', 'etiquette_axe3',
        'comportements_attendus', 'organisation_spatio_temporelle',
        'groupes_jsonb', 'materiel_jsonb', 'contenu_pedagogique_axe4',
        'notes_bloc',
        // v1.63 — blocs parallèles + coach par bloc (sql_108)
        'voie', 'encadrant_id',
        // v1.64 — réordonnancement d'étages parallèles : le déplacement
        // up/down d'un étage passe par updateBloc({ordre}). 'ordre' doit
        // donc être modifiable ici (il l'était déjà via reorderBlocs, mais
        // par un chemin distinct). Sans cela : « Aucun champ modifiable ».
        'ordre',
        // v1.65 — multi-coachs (sql_110) : liste plate uuid[]
        'encadrants_ids'
      ];
      const cleanPatch = {};
      for (const k of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          cleanPatch[k] = patch[k];
        }
      }
      if (Object.keys(cleanPatch).length === 0) {
        return { ok: false, error: 'Aucun champ modifiable dans patch' };
      }
      // Validation des valeurs ENUM si fournies
      if (cleanPatch.type_bloc && this._validTypesBloc.indexOf(cleanPatch.type_bloc) === -1) {
        return { ok: false, error: 'type_bloc invalide' };
      }
      if (cleanPatch.intensite && this._validIntensites.indexOf(cleanPatch.intensite) === -1) {
        return { ok: false, error: 'intensite invalide' };
      }

      const { data, error } = await client
        .from('seances_blocs')
        .update(cleanPatch)
        .eq('id', blocId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: updateBloc()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Supprime un bloc (DELETE). CASCADE supprime aussi les rattachements
     * ateliers liés (seances_blocs_ateliers).
     */
    async removeBloc(blocId) {
      if (!blocId) return { ok: false, error: 'blocId requis' };
      const { data, error } = await client
        .from('seances_blocs')
        .delete()
        .eq('id', blocId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: removeBloc()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Réordonne TOUS les blocs d'une séance selon l'ordre du tableau fourni.
     * Algo en 2 passes (à cause de la contrainte UNIQUE (seance_id, ordre)) :
     *   Passe 1 : tous les ordres passés en négatif (évite collision)
     *   Passe 2 : tous les ordres re-passés en positif (1, 2, 3...)
     *
     * ⚠️ Limite V1 : pas atomique. Si la passe 2 échoue, certains blocs
     * restent avec un ordre négatif → état incohérent jusqu'au prochain
     * appel réussi. À terme : RPC SQL transactionnelle (dette technique).
     *
     * v1.63 — blocs parallèles : cette fonction ne touche QUE `ordre`,
     * jamais `voie`. L'unicité élargie (seance_id, ordre, voie) est donc
     * respectée même pendant la passe négative (deux blocs au même ordre
     * négatif mais en voies distinctes restent uniques). Le pilotage du
     * parallélisme (dédoubler un étage, déplacer un bloc vers une voie)
     * passe par updateBloc({ ordre, voie }), PAS par reorderBlocs.
     *
     * @param {string} seanceId
     * @param {string[]} blocIdsInOrder Tableau d'UUIDs dans l'ordre souhaité
     */
    async reorderBlocs(seanceId, blocIdsInOrder) {
      if (!seanceId) return { ok: false, error: 'seanceId requis' };
      if (!Array.isArray(blocIdsInOrder) || blocIdsInOrder.length === 0) {
        return { ok: false, error: 'blocIdsInOrder doit être un tableau non vide' };
      }

      // Passe 1 : ordres temporaires négatifs
      for (let i = 0; i < blocIdsInOrder.length; i++) {
        const { error } = await client
          .from('seances_blocs')
          .update({ ordre: -(i + 1) })
          .eq('id', blocIdsInOrder[i])
          .eq('seance_id', seanceId);
        if (error) {
          console.error('MOM Hub: reorderBlocs() passe 1', error);
          return { ok: false, error: 'Échec passe 1 réordonnancement : ' + error.message };
        }
      }

      // Passe 2 : ordres définitifs positifs
      for (let i = 0; i < blocIdsInOrder.length; i++) {
        const { error } = await client
          .from('seances_blocs')
          .update({ ordre: i + 1 })
          .eq('id', blocIdsInOrder[i])
          .eq('seance_id', seanceId);
        if (error) {
          console.error('MOM Hub: reorderBlocs() passe 2', error);
          return {
            ok: false,
            error: 'Échec passe 2 réordonnancement : ' + error.message +
                   ' (⚠️ état incohérent possible — recharger la séance)'
          };
        }
      }

      return {
        ok: true,
        data: { seance_id: seanceId, nb_blocs: blocIdsInOrder.length }
      };
    },

    // ----------------------------------------------------------
    // LECTURE — Rattachements ateliers
    // ----------------------------------------------------------

    /**
     * Liste les rattachements ateliers d'un bloc, triés par ordre croissant.
     * Renvoie les lignes brutes de seances_blocs_ateliers : aucun JOIN
     * Bibliothèque (qui vit en Drive + miroir JSON, pas en DB).
     * Le rendu enrichi (titre / thème / niveau / lien Drive) est fait
     * côté éditeur de séance via le miroir data/fiches-all.json.
     *
     * @param {string} blocId UUID du bloc
     * @returns {Promise<Array>} Tableau de rattachements, [] si erreur/vide
     */
    async listAteliersRattachesAuBloc(blocId) {
      if (!blocId) {
        console.error('MOM Hub: listAteliersRattachesAuBloc() requiert un blocId');
        return [];
      }
      const { data, error } = await client
        .from('seances_blocs_ateliers')
        .select('id, ordre, atelier_fileid_drive, notes_atelier, created_at')
        .eq('bloc_id', blocId)
        .order('ordre', { ascending: true });
      if (error) {
        console.error('MOM Hub: listAteliersRattachesAuBloc()', error);
        return [];
      }
      return data || [];
    },

    // ----------------------------------------------------------
    // ÉCRITURE — Rattachements ateliers
    // ----------------------------------------------------------

    /**
     * Rattache une fiche Bibliothèque à un bloc de séance.
     * L'ordre du rattachement est auto-calculé (max + 1) pour ce bloc.
     *
     * @param {string} blocId UUID du bloc
     * @param {string} atelierFileIdDrive fileId Drive du dossier de la fiche
     *                                    (exactement 33 caractères)
     * @param {string} [notes] Notes contextuelles libres
     */
    async attachAtelierToBloc(blocId, atelierFileIdDrive, notes) {
      if (!blocId) return { ok: false, error: 'blocId requis' };
      if (!atelierFileIdDrive || typeof atelierFileIdDrive !== 'string') {
        return { ok: false, error: 'atelierFileIdDrive requis (chaîne)' };
      }
      if (atelierFileIdDrive.length !== 33) {
        return {
          ok: false,
          error: 'atelierFileIdDrive doit faire exactement 33 caractères (CHECK SQL)'
        };
      }

      // Auto-ordre = max(ordre) + 1 pour ce bloc
      const lastQuery = await client
        .from('seances_blocs_ateliers')
        .select('ordre')
        .eq('bloc_id', blocId)
        .order('ordre', { ascending: false })
        .limit(1)
        .maybeSingle();
      const ordre = lastQuery.data ? lastQuery.data.ordre + 1 : 1;

      const payload = {
        bloc_id: blocId,
        atelier_fileid_drive: atelierFileIdDrive,
        ordre: ordre
      };
      if (notes !== undefined && notes !== null) {
        payload.notes_atelier = notes;
      }

      const { data, error } = await client
        .from('seances_blocs_ateliers')
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: attachAtelierToBloc()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * Détache une fiche Bibliothèque d'un bloc (DELETE de la ligne).
     *
     * @param {string} rattachementId UUID de la ligne seances_blocs_ateliers
     */
    async detachAtelierFromBloc(rattachementId) {
      if (!rattachementId) return { ok: false, error: 'rattachementId requis' };
      const { data, error } = await client
        .from('seances_blocs_ateliers')
        .delete()
        .eq('id', rattachementId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: detachAtelierFromBloc()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    // ============================================================
    // PHASE 5.14 MODULE JOUEURS — WRAPPERS v1.12 (S1.b)
    // ============================================================
    //
    // 3 wrappers basés sur les RPC SECURITY DEFINER de sql/33-fix et
    // sql/34-fix. Doctrine : aucun SELECT/UPDATE direct sur personnes
    // (P6 confidentialité par construction, audit §2.2). Toute lecture
    // / écriture passe par RPC.
    //
    // Pattern de retour cohérent v1.7 compositions et v1.11 évènements :
    //   - Lecture : retourne data (array ou objet) ou null en cas d'erreur
    //   - Écriture : retourne { ok, data?, error? }
    // ============================================================

    /**
     * Récupère la liste des joueurs actifs d'une équipe via RPC.
     * (RPC : get_joueurs_equipe — sql/33-fix v1.1, dette audit C10-J-f)
     *
     * Filtre actifs : date_sortie IS NULL OR date_sortie >= CURRENT_DATE.
     * Tri : nom puis prénom.
     *
     * Shape retourné par joueur (~22 colonnes utiles pour cartes liste) :
     *   - Identité : id, nom, prenom, sexe, date_naissance
     *   - Type / qualités : type_personne, f15_integree, numero_licence_ffr,
     *     qualite_ffr
     *   - Refs résolues : club_principal_id + club_principal_code +
     *     club_principal_nom_court, categorie_id + categorie_libelle_court,
     *     pole_attache_id + pole_libelle_court
     *   - Profil sportif : postes_uuids, aptitudes_uuids, taille_cm, poids_g
     *   - État métier : indisponibilite, blessure_resume, suspension_jusqu_au
     *   - Équipe-joueurs : ej_statut, ej_niveau_profil, ej_club_provenance_*,
     *     ej_date_affectation, ej_date_sortie
     *   - Calculés :
     *       profil ∈ {mom, f15, partenaire, coach, staff, autre}
     *       etat_calcule ∈ {actif, indisponible, blesse, suspendu, inactif}
     *
     * @param {string} equipeId UUID de l'équipe (ex M14_TEAM_UUID)
     * @returns {Promise<Array<Object>|null>} Liste des joueurs, ou null si erreur
     */
    async getJoueursEquipe(equipeId) {
      if (!equipeId) {
        console.error('MOM Hub: getJoueursEquipe() requiert un equipeId');
        return null;
      }
      const { data, error } = await client.rpc('get_joueurs_equipe', {
        p_equipe_id: equipeId
      });
      if (error) {
        console.error('MOM Hub: getJoueursEquipe()', error);
        return null;
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Récupère l'effectif F15 via RPC get_joueurs_f15() (sql_111).
     *
     * Jumelle de getJoueursEquipe : MÊME shape de sortie (32 colonnes,
     * mêmes calculés profil/etat_calcule) → les cartes liste et la
     * fiche slide-in n'ont AUCUNE adaptation à faire. La seule
     * différence est la SOURCE : F15 n'est pas une catégorie « à
     * équipe » mais un périmètre transversal porté par le flag
     * personnes.f15_integree (cf. en-tête sql_111). La RPC part de
     * personnes (LEFT JOIN equipe_joueurs) et filtre f15_integree=TRUE,
     * donc une F15 flaggée non rattachée à une équipe apparaît bien.
     *
     * Aucun paramètre : le périmètre F15 est global (1 seul groupe F15
     * au club). L'aiguillage « catégorie active = F15 → cette RPC »
     * est fait côté écran (joueurs-browser.js).
     *
     * @returns {Promise<Array<Object>|null>} Liste des joueuses F15,
     *   ou null si erreur (même convention que getJoueursEquipe :
     *   null = échec honnête → message d'erreur côté écran).
     */
    async getJoueursF15() {
      const { data, error } = await client.rpc('get_joueurs_f15', {});
      if (error) {
        console.error('MOM Hub: getJoueursF15()', error);
        return null;
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Récupère l'effectif de la Section rugby scolaire via RPC
     * get_joueurs_section() (sql_154). Jumelle de getJoueursF15 :
     * MÊME shape de sortie (32 colonnes) → cartes et fiche inchangées.
     * Périmètre = flag personnes.section_rugby (patron F15), les membres
     * GARDENT leur categorie_id d'âge. Aiguillage côté écran
     * (joueurs-browser.js : SECTION_CAT_UUID → cette RPC).
     *
     * @returns {Promise<Array<Object>|null>} liste, ou null si erreur.
     */
    async getJoueursSection() {
      const { data, error } = await client.rpc('get_joueurs_section', {});
      if (error) {
        console.error('MOM Hub: getJoueursSection()', error);
        return null;
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Coche/décoche l'appartenance d'une personne à la Section rugby
     * via RPC set_section_rugby (sql_154) — SEUL écrivain du flag
     * personnes.section_rugby. Garde côté SQL :
     * puis_je_ecrire_categorie(SECTION) → admin, bureau, responsables
     * du pôle Section (et tout encadrant habilité par fonction_staff
     * sur SECTION). RETURNS boolean = le nouvel état.
     *
     * @param {string} personneId UUID de la personne (personnes.id)
     * @param {boolean} actif true = membre, false = retiré
     * @returns {Promise<boolean|null>} nouvel état, ou null si erreur
     *   (droit insuffisant inclus — l'appelant masque ou signale).
     */
    async setSectionRugby(personneId, actif) {
      if (!personneId || typeof actif !== 'boolean') {
        console.error('MOM Hub: setSectionRugby() requiert (personneId, boolean)');
        return null;
      }
      const { data, error } = await client.rpc('set_section_rugby', {
        p_personne_id: personneId,
        p_actif: actif
      });
      if (error) {
        console.error('MOM Hub: setSectionRugby()', error);
        return null;
      }
      return data === true || data === false ? data : null;
    },

    /**
     * Archive ou réactive une fiche personne via RPC archiver_personne()
     * (sql_202, pt 211 — cycle de vie licence). Réversible.
     * @param {string} personneId UUID de la personne.
     * @param {boolean} archive true = archiver, false = réactiver.
     * @returns {Promise<Object>} { personne_id, est_archive }.
     * @throws si la RPC échoue (garde admin, introuvable…), pour affichage front.
     */
    async archiverPersonne(personneId, archive) {
      if (!personneId || typeof archive !== 'boolean') {
        throw new Error('archiverPersonne() requiert (personneId, boolean)');
      }
      const { data, error } = await client.rpc('archiver_personne', {
        p_id: personneId,
        p_archive: archive
      });
      if (error) {
        console.error('MOM Hub: archiverPersonne()', error);
        throw error;
      }
      return Array.isArray(data) ? data[0] : data;
    },

    /**
     * Récupère l'effectif d'une catégorie via RPC get_joueurs_categorie()
     * (sql_112). Jumelle de getJoueursEquipe/getJoueursF15 : MÊME shape
     * de sortie (32 colonnes) → cartes et fiche inchangées.
     *
     * Charge par personnes.categorie_id (source de vérité du
     * rattachement, peuplée pour les 14 catégories), PAS par équipe :
     * seule M14 a un effectif via equipe_joueurs, les 13 autres ont
     * leurs joueurs rattachés à la catégorie sans ligne d'équipe. Un
     * joueur sans équipe (ex. Auriane DECOURCELLE) apparaît bien
     * (LEFT JOIN equipe_joueurs côté RPC).
     *
     * NB : ne couvre PAS F15 (ses joueuses ont categorie_id = M14, pas
     * F15) → l'écran route F15 vers getJoueursF15() et toute autre
     * catégorie vers celle-ci.
     *
     * @param {string} categorieId UUID de la catégorie (categories.id)
     * @returns {Promise<Array<Object>|null>} liste, ou null si erreur.
     */
    async getJoueursCategorie(categorieId) {
      if (!categorieId) {
        console.error('MOM Hub: getJoueursCategorie() requiert un categorieId');
        return null;
      }
      const { data, error } = await client.rpc('get_joueurs_categorie', {
        p_categorie_id: categorieId
      });
      if (error) {
        console.error('MOM Hub: getJoueursCategorie()', error);
        return null;
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Récupère la fiche détaillée d'une personne via RPC.
     * (RPC : get_joueur_detail — sql/33-fix v1.1, dette audit C10-J-g)
     *
     * À utiliser pour le panneau slide-in droite (S2.3).
     *
     * Shape retourné (~55 colonnes) :
     *   - Tout get_joueurs_equipe (sans contrainte d'équipe)
     *   - + variantes nom_long / libelle_long
     *   - + Coordonnées : email_*, telephone_*, adresse_postale, code_postal,
     *     ville, pays
     *   - + Identité étendue : lieu_naissance (jsonb), etablissement_scolaire,
     *     classe_scolaire, personne_a_prevenir_urgence (jsonb)
     *   - + FFR : date_fin_affiliation, annee_arrivee_club, validation_ffr
     *   - + RGPD : consentement_rgpd_date, canal_communication_prefere,
     *     droit_image_* (5 booléens), autorisation_intervention_medicale_urgence
     *   - + Métadonnées : source_creation, modifie_par, synchronisation_statut,
     *     visible_annuaire, tag_verifier, created_at, updated_at
     *   - + notes_coach (réservé à la fiche détail, pas dans la liste)
     *
     * @param {string} personneId UUID de la personne
     * @returns {Promise<Object|null>} Fiche complète ou null si introuvable / erreur
     */
    async getJoueurDetail(personneId) {
      if (!personneId) {
        console.error('MOM Hub: getJoueurDetail() requiert un personneId');
        return null;
      }
      const { data, error } = await client.rpc('get_joueur_detail', {
        p_personne_id: personneId
      });
      if (error) {
        console.error('MOM Hub: getJoueurDetail()', error);
        return null;
      }
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },

    /**
     * Met à jour les champs métier d'une fiche joueur via RPC partial-patch.
     * (RPC : update_joueur_metier — sql/34-fix v1.1, dette audit C10-J-j)
     *
     * Whitelist 8 champs autorisés dans `patch` (toute autre clé est
     * ignorée silencieusement côté SQL) :
     *   - postes_uuids        Array<string> d'UUIDs de postes (postes.json v1.1)
     *   - aptitudes_uuids     Array<string> d'UUIDs d'aptitudes (aptitudes.json v1.0)
     *   - taille_cm           number entier 50-250 (cm) ou null
     *   - poids_g             number entier 5000-250000 (grammes) ou null
     *   - notes_coach         string ou "" (vide = reset à NULL via trim+nullif)
     *   - indisponibilite     string ou "" (idem)
     *   - blessure_resume     string ou "" (idem)
     *   - suspension_jusqu_au string ISO date "YYYY-MM-DD" ou ""
     *
     * Comportement par clé :
     *   - clé absente du patch  → champ inchangé en base
     *   - clé présente          → champ écrasé (incl. NULL via "" pour TEXT/DATE)
     *
     * Validation côté wrapper :
     *   - postes_uuids et aptitudes_uuids doivent être des arrays (ou absents)
     *   - taille_cm / poids_g doivent être number ou null (ou absents)
     *
     * Autorisation côté RPC :
     *   has_role('admin') OR has_role('coach') OR superuser DB (Studio).
     *
     * @param {string} personneId UUID de la personne à modifier
     * @param {Object} patch Objet partiel avec les clés whitelistées
     * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
     *           data = shape personnes brut, appeler ensuite getJoueurDetail
     *           pour la vue enrichie avec jointures.
     */
    async updateJoueurMetier(personneId, patch) {
      if (!personneId) {
        return { ok: false, error: 'personneId requis' };
      }
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return { ok: false, error: 'patch doit être un objet JSON' };
      }

      // Validation pré-RPC des types JSON (pour messages d'erreur clairs côté UI)
      if (patch.postes_uuids !== undefined && !Array.isArray(patch.postes_uuids)) {
        return { ok: false, error: 'postes_uuids doit être un tableau' };
      }
      if (patch.aptitudes_uuids !== undefined && !Array.isArray(patch.aptitudes_uuids)) {
        return { ok: false, error: 'aptitudes_uuids doit être un tableau' };
      }
      if (patch.taille_cm !== undefined && patch.taille_cm !== null
          && patch.taille_cm !== '' && typeof patch.taille_cm !== 'number') {
        return { ok: false, error: 'taille_cm doit être un nombre, null ou ""' };
      }
      if (patch.poids_g !== undefined && patch.poids_g !== null
          && patch.poids_g !== '' && typeof patch.poids_g !== 'number') {
        return { ok: false, error: 'poids_g doit être un nombre, null ou ""' };
      }

      const { data, error } = await client.rpc('update_joueur_metier', {
        p_personne_id: personneId,
        p_patch: patch
      });

      if (error) {
        console.error('MOM Hub: updateJoueurMetier()', error);
        return { ok: false, error: error.message || 'Erreur update_joueur_metier' };
      }
      // La RPC retourne SETOF personnes : prendre la 1ère ligne
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return { ok: true, data: row };
    },

    /**
     * EDITION-EMAIL-FICHE (sql_196) — canal identité réservé bureau/admin.
     * Patch partiel de l'identité e-mail d'une fiche (email_principal /
     * email_secondaire). La garde d'autorisation (admin | bureau) est portée
     * par la RPC SECURITY DEFINER maj_identite_fiche : l'UI ne fait que
     * refléter le droit, la RPC reste la vérité (refuse même si l'UI est
     * forcée). Retour homogène { ok, data|error } (même pattern que
     * updateJoueurMetier). Valeur '' ou null sur un champ ⇒ efface (NULL).
     */
    async majIdentiteFiche(personneId, patch) {
      if (!personneId) {
        return { ok: false, error: 'personneId requis' };
      }
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return { ok: false, error: 'patch doit être un objet JSON' };
      }
      // Validation de forme minimale côté client (présence '@' si non vide),
      // pour un message clair avant l'aller-retour RPC. La RPC re-valide.
      const champs = ['email_principal', 'email_secondaire'];
      for (const c of champs) {
        if (patch[c] !== undefined && patch[c] !== null && patch[c] !== '') {
          if (typeof patch[c] !== 'string' || patch[c].indexOf('@') === -1) {
            return { ok: false, error: c + ' invalide (adresse e-mail attendue)' };
          }
        }
      }

      const { data, error } = await client.rpc('maj_identite_fiche', {
        p_personne_id: personneId,
        p_patch: patch
      });

      if (error) {
        console.error('MOM Hub: majIdentiteFiche()', error);
        return { ok: false, error: error.message || 'Erreur maj_identite_fiche' };
      }
      // La RPC retourne SETOF personnes : prendre la 1ère ligne
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return { ok: true, data: row };
    },

    // ============================================================
    // C12-f — WRAPPER SUIVI DE RENCONTRE v1.13 (SUIVI-COACH-1 Objet A)
    // ============================================================

    /**
     * Génère un lien éphémère de Suivi de rencontre pour un évènement
     * (point d'entrée coach — le chaînon Hub↔Suivi, Objet A).
     *
     * Encapsule la RPC SECURITY DEFINER generer_lien_ephemere
     * (sql/C12-f). Signature SQL réelle (fait foi) :
     *   generer_lien_ephemere(
     *     p_evenement_uuid UUID,
     *     p_role           TEXT     DEFAULT 'saisie',
     *     p_config_chrono  JSONB    DEFAULT NULL,
     *     p_duree          INTERVAL DEFAULT INTERVAL '36 hours',
     *     p_cree_par       TEXT     DEFAULT NULL
     *   ) RETURNS TABLE (token TEXT, role TEXT, expire_le TIMESTAMPTZ)
     *
     * La RPC RETURNS TABLE → data est un tableau ; on prend data[0]
     * (même pattern que getEvenementWithEncadrants / updateJoueurMetier).
     *
     * Garde-fou PI-7 (compo 'validee' active = pré-condition dure d'un
     * lien 'saisie') : porté PAR LA RPC, qui lève une exception
     * explicite. Elle revient ici en error.message et est remontée
     * fidèlement en { ok:false, error } — la règle n'est NI réinterprétée
     * NI dupliquée côté client (anti-invention ; la traduction UX
     * "compo pas réellement prête" se fait dans evenements-browser).
     *
     * Relais (S-5.2.a) : régénérer un lien 'saisie' pour la même
     * rencontre révoque côté serveur les liens 'saisie' actifs
     * précédents. C'est un effet de bord assumé de la RPC ; l'UI
     * (Objet A, état 3) doit en avertir l'utilisateur AVANT l'action.
     *
     * Notes de périmètre Objet A :
     *   - p_config_chrono (DA-2) NON transmis : le SQL le stocke tel
     *     quel sans l'interpréter ; le moteur chrono EDR n'est pas du
     *     périmètre Objet A (anti-anticipation, doctrine).
     *   - p_duree laissé au défaut serveur (36 h).
     *   - p_cree_par : pass-through optionnel, jamais fabriqué ici.
     *   - role : le wrapper reflète fidèlement la RPC (valeurs validées
     *     sur le même CHECK que le SQL). La non-exposition du lien
     *     'spectateur' est une décision d'UI (A-Q4), appliquée côté
     *     evenements-browser — PAS un verrou client. L'UI Objet A
     *     n'appelle JAMAIS ce wrapper avec 'spectateur'. Exposition
     *     spectateur tracée : Objet C-2 / SUIVI-UI-6 (hors cycle).
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @param {string} [role='saisie'] 'saisie' | 'spectateur'
     * @param {string} [creePar] Trace libre optionnelle (coach)
     * @returns {Promise<{ok: boolean, data?: {token: string, role: string, expire_le: string}, error?: string}>}
     */
    async genererLienEphemere(evenementUuid, role, creePar) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const r = role || 'saisie';
      // Miroir du CHECK SQL lien_suivi_role_check (saisie|spectateur)
      if (r !== 'saisie' && r !== 'spectateur') {
        return { ok: false, error: 'Rôle de lien invalide (attendu : saisie | spectateur)' };
      }

      const params = { p_evenement_uuid: evenementUuid, p_role: r };
      // p_cree_par : transmis seulement si fourni (jamais fabriqué).
      // p_config_chrono / p_duree : laissés aux défauts serveur.
      if (creePar && typeof creePar === 'string' && creePar.trim()) {
        params.p_cree_par = creePar.trim();
      }

      const { data, error } = await client.rpc('generer_lien_ephemere', params);

      if (error) {
        // Inclut le refus PI-7 (RAISE EXCEPTION côté RPC) : remonté tel
        // quel, l'UI le traduit en "compo pas réellement prête".
        console.error('MOM Hub: genererLienEphemere()', error);
        return { ok: false, error: error.message || 'Erreur generer_lien_ephemere' };
      }
      // RETURNS TABLE → prendre la 1ère ligne
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!row) {
        return { ok: false, error: "La RPC generer_lien_ephemere n'a renvoyé aucun jeton" };
      }
      return { ok: true, data: row };
    },

    /**
     * Relit le lien 'saisie' actif d'une rencontre, s'il existe
     * (SUIVI-COACH-2 — rend l'état 3 d'Objet A persistant entre
     * visites côté coach authentifié).
     *
     * Encapsule la RPC SECURITY DEFINER get_lien_saisie_actif
     * (sql/C12-h). Signature SQL réelle (fait foi) :
     *   get_lien_saisie_actif(p_evenement_uuid UUID)
     *   RETURNS TABLE (token TEXT, expire_le TIMESTAMPTZ,
     *                  date_creation TIMESTAMPTZ)
     *
     * La RPC RETURNS TABLE → data est un tableau ; on prend data[0]
     * (même pattern que genererLienEphemere).
     *
     * CONTRAT CLÉ : la RPC renvoie 0 ou 1 ligne, JAMAIS d'exception.
     *   - 0 ligne (tableau vide) = aucun lien 'saisie' actif pour
     *     cette rencontre → { ok:true, data:null }. CE N'EST PAS UNE
     *     ERREUR : Objet A reste/retombe à l'état 2 « générer », ce
     *     qui est le comportement correct. Ne JAMAIS transformer ce
     *     cas en { ok:false } (sinon fausse erreur affichée au coach
     *     sur toute rencontre sans lien).
     *   - 1 ligne = lien actif → { ok:true, data:{token, expire_le,
     *     date_creation} }.
     *   - erreur réseau/SQL réelle → { ok:false, error }.
     *
     * Le filtrage (role='saisie', revoque=FALSE, expire_le>NOW) est
     * fait PAR LA RPC : aucune re-vérification côté client (la règle
     * n'est ni dupliquée ni réinterprétée — anti-invention). Au plus
     * un lien actif par rencontre (invariant relais C12-f) : data[0]
     * sans ambiguïté. Le token est renvoyé BRUT ; la fabrication de
     * l'URL suivi.html?t=… reste côté evenements-browser
     * (suiviBuildUrl, déjà en place).
     *
     * Posture grant RPC = authenticated seul (event-bornée ; volet
     * jeton rejeté backend pour éviter l'escalade spectateur→
     * rédacteur, cf. sql/C12-h).
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @returns {Promise<{ok: boolean, data?: {token: string, expire_le: string, date_creation: string}|null, error?: string}>}
     */
    async getLienSaisieActif(evenementUuid) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }

      const { data, error } = await client.rpc('get_lien_saisie_actif', {
        p_evenement_uuid: evenementUuid
      });

      if (error) {
        console.error('MOM Hub: getLienSaisieActif()', error);
        return { ok: false, error: error.message || 'Erreur get_lien_saisie_actif' };
      }
      // RETURNS TABLE → 0 ou 1 ligne. 0 ligne = aucun lien actif :
      // succès avec data:null (PAS une erreur — Objet A → état 2).
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return { ok: true, data: row };
    },

    // ============================================================
    // SUIVI-COACH-1 OBJET B — MODE VIDÉO · couche données coach
    // v1.15 · C12-j (écriture) + C12-k (lecture) + C12-e (conso)
    // Signatures SQL vérifiées à la source. Ajouts purs.
    // ============================================================

    /**
     * Helper d'affichage joueur — RÉPLIQUE EXACTE de
     * SuiviClient.libelleJoueur (suivi-client.js v1.1). Règle
     * UNIQUE de dégradation nom_court NULL, NON dupliquée-
     * divergente : copie fidèle car l'écran coach Mode Vidéo ne
     * charge pas suivi-client.js. Ancre = numero_maillot si
     * présent ; sinon nom_court ; sinon '?'. Ne casse jamais
     * l'écran. NB : une ligne de get_chronologie_rencontre_coach
     * n'a PAS de numero_maillot → dégrade en nom_court / '?'
     * (limite acceptée projet tant que C12-nom non câblé).
     *
     * @param {Object} row ligne portant numero_maillot? + nom_court?
     * @returns {string} ex. "7 ROOS" · "ROOS" · "7" · "?"
     */
    libelleJoueurSuivi(row) {
      if (!row) return '?';
      const num = (row.numero_maillot !== undefined && row.numero_maillot !== null)
        ? String(row.numero_maillot) : null;
      const nom = (row.nom_court && String(row.nom_court).trim() !== '')
        ? String(row.nom_court).trim() : null;
      if (num && nom) return num + ' ' + nom;
      if (num) return num;
      if (nom) return nom;
      return '?';
    },

    /**
     * Charge la chronologie d'une rencontre pour le COACH
     * authentifié (Mode Vidéo). Encapsule la RPC SECURITY
     * DEFINER get_chronologie_rencontre_coach (sql/C12-k).
     * Signature SQL réelle (fait foi) :
     *   get_chronologie_rencontre_coach(
     *     p_evenement_uuid   UUID,
     *     p_inclure_annulees BOOLEAN DEFAULT FALSE
     *   ) RETURNS TABLE (15 colonnes, contrat IDENTIQUE à C12-d :
     *     id, horodatage, minute_match, periode, observable_id,
     *     categorie_obs, valeur_points, mode_saisie,
     *     equipe_concernee, joueur_uuid, nom_court,
     *     saisi_par_role, source_saisie, timecode_video, annule)
     *
     * Autorisation Option A (rôle coach/admin + équipe-staff)
     * portée par C12-k (helpers C12-j) : un refus revient en
     * error SQL — ici, convention lecture projet = renvoyer []
     * (jamais d'exception propagée), comme
     * SuiviClient.getChronologieRencontre. L'écran distingue
     * « vide » vs « refus » via un appel témoin si besoin ;
     * le détail du refus reste loggé en console.
     *
     * Tri horodatage ASC (ordre de jeu). nom_court PEUT être
     * NULL (dette C12-nom) → libelleJoueurSuivi() pour afficher.
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @param {boolean} [inclureAnnulees=false] true = vue audit
     * @returns {Promise<Array>} lignes (15 champs), [] si
     *          erreur/refus/vide
     */
    async getChronologieRencontreCoach(evenementUuid, inclureAnnulees) {
      if (!evenementUuid) {
        console.error('MOM Hub: getChronologieRencontreCoach() requiert un evenementUuid');
        return [];
      }
      const params = { p_evenement_uuid: evenementUuid };
      if (inclureAnnulees === true) params.p_inclure_annulees = true;
      const { data, error } = await client.rpc('get_chronologie_rencontre_coach', params);
      if (error) {
        console.error('MOM Hub: getChronologieRencontreCoach()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Charge la COMPO RÉDUITE (effectif) d'une rencontre pour le
     * COACH authentifié. Encapsule la RPC SECURITY DEFINER
     * get_compo_reduite_rencontre_coach (sql/C12-l). Jumelle COMPO
     * de getChronologieRencontreCoach (C12-l est à C12-k ce que
     * C12-f §5 est à C12-d). Signature SQL réelle (fait foi) :
     *   get_compo_reduite_rencontre_coach(p_evenement_uuid UUID)
     *   RETURNS TABLE (6 colonnes, contrat IDENTIQUE à
     *     get_compo_reduite_rencontre / C12-f §5 :
     *     joueur_uuid, numero_maillot, poste_uuid, role,
     *     etat_joueur, nom_court)
     *
     * Autorisation Option A (rôle coach/admin + équipe-staff)
     * portée par C12-l (helpers C12-j réutilisés) : un refus
     * revient en error SQL — convention lecture projet = renvoyer
     * [] (jamais d'exception propagée), comme
     * getChronologieRencontreCoach. Le détail du refus reste
     * loggé en console.
     *
     * Tri numero_maillot NULLS LAST (identique C12-f §5).
     * nom_court PEUT être NULL (dette C12-nom) →
     * libelleJoueurSuivi() pour afficher (ancre = numéro).
     *
     * USAGE C-1 (temps de jeu) : la baseline effectif (qui est
     * titulaire = entré au coup d'envoi vs remplaçant) que la
     * chronologie seule ne porte pas. Lecture pure, zéro écriture,
     * zéro RPC propre (C1-Q3 : RPC déjà livrée C12-l).
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @returns {Promise<Array>} lignes (6 champs), [] si
     *          erreur/refus/vide
     */
    async getCompoReduiteRencontreCoach(evenementUuid) {
      if (!evenementUuid) {
        console.error('MOM Hub: getCompoReduiteRencontreCoach() requiert un evenementUuid');
        return [];
      }
      const { data, error } = await client.rpc('get_compo_reduite_rencontre_coach', {
        p_evenement_uuid: evenementUuid
      });
      if (error) {
        console.error('MOM Hub: getCompoReduiteRencontreCoach()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Insère une ligne chronologie en Mode Vidéo (coach).
     * Encapsule la RPC SECURITY DEFINER inserer_observable_coach
     * (sql/C12-j). Signature SQL réelle (fait foi) :
     *   inserer_observable_coach(
     *     p_evenement_uuid   UUID,
     *     p_observable_id    TEXT,
     *     p_categorie_obs    TEXT,
     *     p_valeur_points    INTEGER,
     *     p_equipe_concernee TEXT,
     *     p_joueur_uuid      UUID     DEFAULT NULL,
     *     p_mode_saisie      TEXT     DEFAULT 'normal',
     *     p_minute_match     INTEGER  DEFAULT NULL,
     *     p_periode          INTEGER  DEFAULT 1,
     *     p_timecode_video   INTERVAL DEFAULT NULL,
     *     p_est_blessure     BOOLEAN  DEFAULT FALSE
     *   ) RETURNS TABLE (id UUID, horodatage TIMESTAMPTZ)
     *
     * Le backend FORCE source_saisie='video', saisi_par_role=
     * 'coach', saisi_par='coach:auth:'<auth.uid()> : la signature
     * coach NE PREND PAS p_saisi_par_role / p_source_saisie
     * (diffère de C12-c bénévole) → on ne les envoie jamais.
     * Garde-fou DS-1 (adverse→joueur NULL) et double effet
     * blessure PI-6 portés PAR LE BACKEND (non ré-implémentés).
     * Champs optionnels : on n'envoie QUE ce qui est fourni,
     * les DEFAULT SQL s'appliquent au reste (doctrine).
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @param {Object} obs
     *   @param {string}  obs.observableId    ref ('obs-A-…')
     *   @param {string}  obs.categorieObs    'A' | 'B'
     *   @param {number}  obs.valeurPoints    points (0 si non scorant)
     *   @param {string}  obs.equipeConcernee 'notre' | 'adverse'
     *   @param {string}  [obs.joueurUuid]    joueur (NULL si adverse / D-7)
     *   @param {string}  [obs.modeSaisie]    'normal' | 'expert'
     *   @param {number}  [obs.minuteMatch]
     *   @param {number}  [obs.periode]
     *   @param {string}  [obs.timecodeVideo] INTERVAL (position vidéo)
     *   @param {boolean} [obs.estBlessure]   true → double effet PI-6
     * @returns {Promise<{ok:boolean, data?:{id:string,
     *          horodatage:string}, error?:string}>}
     */
    async insererObservableCoach(evenementUuid, obs) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      if (!obs || typeof obs !== 'object') {
        return { ok: false, error: 'Observable manquant ou invalide' };
      }
      if (!obs.observableId || !obs.categorieObs || !obs.equipeConcernee) {
        return { ok: false, error: 'Champs requis manquants : observableId, categorieObs, equipeConcernee' };
      }
      const params = {
        p_evenement_uuid:   evenementUuid,
        p_observable_id:    obs.observableId,
        p_categorie_obs:    obs.categorieObs,
        p_valeur_points:    (typeof obs.valeurPoints === 'number') ? obs.valeurPoints : 0,
        p_equipe_concernee: obs.equipeConcernee
      };
      if (obs.joueurUuid !== undefined && obs.joueurUuid !== null) {
        params.p_joueur_uuid = obs.joueurUuid;
      }
      // L3c — joueur entrant d'une substitution (joueur_uuid = sortant).
      if (obs.joueurUuidEntrant !== undefined && obs.joueurUuidEntrant !== null) {
        params.p_joueur_uuid_entrant = obs.joueurUuidEntrant;
      }
      if (obs.modeSaisie !== undefined) params.p_mode_saisie = obs.modeSaisie;
      if (obs.minuteMatch !== undefined && obs.minuteMatch !== null) {
        params.p_minute_match = obs.minuteMatch;
      }
      if (obs.periode !== undefined && obs.periode !== null) {
        params.p_periode = obs.periode;
      }
      if (obs.timecodeVideo !== undefined && obs.timecodeVideo !== null) {
        params.p_timecode_video = obs.timecodeVideo;
      }
      if (obs.estBlessure === true) params.p_est_blessure = true;

      const { data, error } = await client.rpc('inserer_observable_coach', params);
      if (error) {
        console.error('MOM Hub: insererObservableCoach()', error);
        return { ok: false, error: error.message || 'Erreur inserer_observable_coach' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * ANNULATION (voie coach) — marque une ligne de chronologie annulée
     * (annule = TRUE, jamais DELETE). RPC annuler_observable_coach (C12-t).
     * Le score (calculé) ignore les lignes annulées → recalcul auto.
     * @param {string} evenementUuid  le MATCH
     * @param {string} ligneId        id de la ligne chronologie à annuler
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async annulerObservableCoach(evenementUuid, ligneId) {
      if (!evenementUuid) return { ok: false, error: 'evenementUuid manquant' };
      if (!ligneId)       return { ok: false, error: 'ligneId manquant' };
      const { error } = await client.rpc('annuler_observable_coach', {
        p_evenement_uuid: evenementUuid,
        p_ligne_id: ligneId
      });
      if (error) {
        console.error('MOM Hub: annulerObservableCoach()', error);
        return { ok: false, error: error.message || 'Erreur annuler_observable_coach' };
      }
      return { ok: true };
    },

    /**
     * Annule une ligne chronologie en Mode Vidéo (coach).
     * Encapsule annuler_observable_coach (sql/C12-j). Signature
     * SQL réelle (fait foi) :
     *   annuler_observable_coach(p_evenement_uuid UUID,
     *                            p_ligne_id UUID) RETURNS VOID
     * Met annule=TRUE, JAMAIS de DELETE (trace conservée, exclue
     * du score recalculé). Le backend vérifie que la ligne
     * appartient bien à la rencontre.
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @param {string} ligneId       UUID de la ligne à annuler
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async annulerObservableCoach(evenementUuid, ligneId) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      if (!ligneId) {
        return { ok: false, error: 'ligneId manquant' };
      }
      const { error } = await client.rpc('annuler_observable_coach', {
        p_evenement_uuid: evenementUuid,
        p_ligne_id:       ligneId
      });
      if (error) {
        console.error('MOM Hub: annulerObservableCoach()', error);
        return { ok: false, error: error.message || 'Erreur annuler_observable_coach' };
      }
      return { ok: true };
    },

    /**
     * Corrige l'attribution joueur (et/ou comble le timecode
     * vidéo) d'une ligne, en Mode Vidéo (coach). Encapsule
     * corriger_observable_coach (sql/C12-j). Signature SQL
     * réelle (fait foi) :
     *   corriger_observable_coach(
     *     p_evenement_uuid UUID,
     *     p_ligne_id       UUID,
     *     p_joueur_uuid    UUID,
     *     p_timecode_video INTERVAL DEFAULT NULL
     *   ) RETURNS VOID
     * p_joueur_uuid n'a PAS de défaut SQL → toujours transmis
     * (valeur null acceptée = désattribution ; le backend
     * applique DS-1 : adverse + joueur non NULL ⇒ refus).
     * p_timecode_video comblé PAR AJOUT côté SQL : NULL ⇒
     * COALESCE conserve l'existant (ne l'écrase jamais avec
     * NULL). corrigee_le horodaté côté serveur. Jamais de
     * DELETE (trace conservée).
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @param {string} ligneId       UUID de la ligne à corriger
     * @param {string|null} joueurUuid nouveau joueur (null =
     *        désattribuer)
     * @param {string} [timecodeVideo] INTERVAL ; omis/null =
     *        ne touche pas au timecode existant
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async corrigerObservableCoach(evenementUuid, ligneId, joueurUuid, timecodeVideo) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      if (!ligneId) {
        return { ok: false, error: 'ligneId manquant' };
      }
      const params = {
        p_evenement_uuid: evenementUuid,
        p_ligne_id:       ligneId,
        p_joueur_uuid:    (joueurUuid !== undefined ? joueurUuid : null)
      };
      if (timecodeVideo !== undefined && timecodeVideo !== null) {
        params.p_timecode_video = timecodeVideo;
      }
      const { error } = await client.rpc('corriger_observable_coach', params);
      if (error) {
        console.error('MOM Hub: corrigerObservableCoach()', error);
        return { ok: false, error: error.message || 'Erreur corriger_observable_coach' };
      }
      return { ok: true };
    },

    // ----------------------------------------------------------
    // COLLECTIF & COMPO 3 NIVEAUX — N1 / N2 / N3 (v1.22)
    //   Modèle Modelisation-Collectif-Compo-3-Niveaux-v1.md v1.1
    //   (fait foi). DDL : sql/44 collectif_membre / sql/45
    //   equipe_engagee_membre / sql/46 compositions.evenement_equipe_id
    //   (exécutés + vérifiés en base 19/05). Patrons d'écriture/lecture
    //   STRICTEMENT calqués sur les wrappers M3/M5 (addEquipeEngagee /
    //   removeEquipeEngagee) et compo (updateJoueurCompo /
    //   getCompoComplete) déployés — rien réinventé (PI-5). RLS par
    //   rôle (patron sql/43, has_role admin|coach) ; AUCUN mapping
    //   auth→personnes (IDENT-SYS hors périmètre). Embeds personnes
    //   = colonnes d'identité de getCompoComplete (non inventées).
    // ----------------------------------------------------------

    /**
     * N1 — Vivier d'un collectif : membres d'une entente (catégorie ×
     * saison, modèle §2.1). Colonne gauche U-N2 (vivier) + liste
     * U-admin. Embed personnes minimal calqué getCompoComplete.
     * Tri/recherche fine = côté UX (UN2-1) ; ici tri stable
     * top-level (role, date_debut) — pas d'hypothèse sur l'ordre
     * d'un embed PostgREST.
     *
     * @param {string} ententeId UUID ententes (porte catégorie+saison)
     * @param {Object} [options] { role?: 'joueur'|'staff',
     *   actifsSeuls?: boolean (date_fin IS NULL) }
     * @returns {Promise<Array>} [] si erreur (pattern getVivierCompo)
     */
    /**
     * Helper privé (v1.26) — résout nom/prenom pour une liste
     * d'UUID personnes via la RPC gardée get_noms_personnes
     * (sql/47). Existe parce que `personnes` est RLS-verrouillée
     * (RGPD délibéré) : l'embed PostgREST renvoie NULL. Centralise
     * la résolution (1 seul appel RPC, dédoublonné) pour les 3
     * wrappers Collectif — P1, une seule vérité.
     *
     * @param {Array<string>} uuids UUID personnes (doublons/NULL tolérés)
     * @returns {Promise<Map<string,{nom:string,prenom:string}>>}
     *   Map vide si aucun uuid / erreur (dégradation honnête : les
     *   appelants retombent sur nom/prenom '' comme avant le fix).
     */
    async _resolveNoms(uuids) {
      const uniq = [];
      const seen = new Set();
      (Array.isArray(uuids) ? uuids : []).forEach(function (u) {
        if (u && !seen.has(u)) { seen.add(u); uniq.push(u); }
      });
      const map = new Map();
      if (uniq.length === 0) return map;
      const { data, error } = await client.rpc('get_noms_personnes', {
        p_personne_uuids: uniq
      });
      if (error) {
        console.error('MOM Hub: _resolveNoms() / get_noms_personnes', error);
        return map;   // Map vide → appelants dégradent honnêtement
      }
      (Array.isArray(data) ? data : []).forEach(function (row) {
        if (row && row.personne_id) {
          map.set(row.personne_id, {
            nom:    row.nom || '',
            prenom: row.prenom || ''
          });
        }
      });
      return map;
    },

    async listCollectifMembres(ententeId, options) {
      if (!ententeId) {
        console.error('MOM Hub: listCollectifMembres() requiert un ententeId');
        return [];
      }
      const opt = (options && typeof options === 'object') ? options : {};
      let q = client
        .from('collectif_membre')
        .select(`
          id, personne_id, entente_id, role, statut,
          date_debut, date_fin
        `)
        .eq('entente_id', ententeId);
      if (opt.role === 'joueur' || opt.role === 'staff') {
        q = q.eq('role', opt.role);
      }
      if (opt.actifsSeuls === true) {
        q = q.is('date_fin', null);
      }
      const { data, error } = await q
        .order('role', { ascending: true })
        .order('date_debut', { ascending: true });
      if (error) {
        console.error('MOM Hub: listCollectifMembres()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      // RLS personnes verrouillée (RGPD) → noms via RPC gardée
      // (sql/47), pas par embed. Structure de sortie INCHANGÉE :
      // on réinjecte `.personnes {id,nom,prenom}` comme avant.
      const noms = await SupabaseHub._resolveNoms(
        data.map(function (r) { return r.personne_id; })
      );
      data.forEach(function (r) {
        const n = noms.get(r.personne_id);
        r.personnes = n
          ? { id: r.personne_id, nom: n.nom, prenom: n.prenom }
          : { id: r.personne_id, nom: '', prenom: '' };
      });
      return data;
    },

    /**
     * N1+ — Vivier du collectif FUSIONNÉ (pt 213, chantier
     * UNIFICATION-STAFF-COLLECTIF-FONCTION). RPC list_vivier_collectif :
     * membres collectif_membre existants UNION encadrants fonction_staff
     * de la catégorie de l'entente (dédup personne_id). Chaque membre porte
     * `origine` ('collectif' | 'fonction_staff') ; ceux de fonction_staff
     * ont id=null (à matérialiser à la convocation via convoquerMembre).
     * Réinjecte `.personnes {id,nom,prenom}` comme listCollectifMembres.
     * @param {string} ententeId
     * @returns {Promise<Array>} [] si erreur
     */
    async listVivierCollectif(ententeId) {
      if (!ententeId) {
        console.error('MOM Hub: listVivierCollectif() requiert un ententeId');
        return [];
      }
      const { data, error } = await client.rpc('list_vivier_collectif', {
        p_entente_id: ententeId
      });
      if (error) {
        console.error('MOM Hub: listVivierCollectif()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      const noms = await SupabaseHub._resolveNoms(
        data.map(function (r) { return r.personne_id; })
      );
      data.forEach(function (r) {
        const n = noms.get(r.personne_id);
        r.personnes = n
          ? { id: r.personne_id, nom: n.nom, prenom: n.prenom }
          : { id: r.personne_id, nom: '', prenom: '' };
      });
      return data;
    },

    /**
     * N2 — Convoque un membre (pt 213). RPC convoquer_membre atomique :
     * si le membre vient de fonction_staff (pas de collectif_membre_id),
     * matérialise d'abord sa ligne collectif_membre role='staff'
     * (idempotent), puis insère en N2. Sinon insère directement en N2.
     * @param {string} evenementEquipeId
     * @param {Object} membre { id (collectif_membre_id|null), personne_id,
     *   entente_id, role, origine }
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async convoquerMembre(evenementEquipeId, membre) {
      if (!evenementEquipeId) return { ok: false, error: 'evenementEquipeId requis' };
      if (!membre || typeof membre !== 'object') return { ok: false, error: 'membre requis' };
      const { data, error } = await client.rpc('convoquer_membre', {
        p_evenement_equipe_id: evenementEquipeId,
        p_collectif_membre_id: membre.id || null,
        p_personne_id: membre.personne_id || null,
        p_entente_id: membre.entente_id || null,
        p_role: membre.role || 'staff'
      });
      if (error) {
        console.error('MOM Hub: convoquerMembre()', error);
        return { ok: false, error: error.message || 'Erreur convoquer_membre' };
      }
      return { ok: true, data: Array.isArray(data) ? data[0] : data };
    },

    /**
     * N1 — Ajoute un membre au collectif (U-admin, INSERT
     * collectif_membre ; RLS admin|coach, l'UX gate admin UA-1).
     * date_debut défaut = aujourd'hui si absent (miroir intention
     * equipe_joueurs DEFAULT CURRENT_DATE ; la table N1 n'a pas de
     * default par design modèle §2.1, le wrapper fournit la même
     * valeur saine que le patron cité). PAS de removeCollectifMembre :
     * UA-4 « sortie = ligne datée, jamais supprimée » → date_fin via
     * updateCollectifMembre, on ne DELETE pas (aucun appelant UX,
     * anti-DS-1 — précédent sql/43). Pattern addEquipeEngagee.
     *
     * @param {Object} payload { personne_id (req), entente_id (req),
     *   role (req: 'joueur'|'staff'), statut?, date_debut?, date_fin? }
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async addCollectifMembre(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      if (!payload.personne_id || !payload.entente_id || !payload.role) {
        return { ok: false, error: 'Champs requis manquants : personne_id, entente_id, role' };
      }
      const insertPayload = {
        personne_id: payload.personne_id,
        entente_id:  payload.entente_id,
        role:        payload.role,
        date_debut:  payload.date_debut || new Date().toISOString().slice(0, 10)
      };
      ['statut', 'date_fin'].forEach(f => {
        if (payload[f] !== undefined) insertPayload[f] = payload[f];
      });
      const { data, error } = await client
        .from('collectif_membre')
        .insert(insertPayload)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: addCollectifMembre()', error);
        return { ok: false, error: error.message || 'Erreur INSERT collectif_membre' };
      }
      return { ok: true, data: data };
    },

    /**
     * N1 — Met à jour un membre (U-admin). Patch limité à statut
     * (qualifie la pioche, N1-5) et date_fin (sortie datée, UA-4 —
     * la sortie N'EST PAS un DELETE). role/personne/entente/date_debut
     * NON modifiables (identité de la ligne ; un changement = nouvelle
     * ligne, scénarios §2.3). Pattern updateJoueurCompo.
     *
     * @param {string} id UUID collectif_membre
     * @param {Object} patch { statut?, date_fin? }
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async updateCollectifMembre(id, patch) {
      if (!id) return { ok: false, error: 'id requis' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'patch (objet) requis' };
      }
      const allowedKeys = ['statut', 'date_fin'];
      const cleanPatch = {};
      for (const k of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          cleanPatch[k] = patch[k];
        }
      }
      if (Object.keys(cleanPatch).length === 0) {
        return { ok: false, error: 'Aucun champ modifiable dans patch (statut, date_fin)' };
      }
      const { data, error } = await client
        .from('collectif_membre')
        .update(cleanPatch)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: updateCollectifMembre()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * N1/admin — Liste les ententes pour le sélecteur U-admin (UA-2 :
     * catégorie × saison ; saisons passées CONSULTABLES, jamais
     * réécrites → AUCUN filtre est_active ici, contrairement à
     * listEquipes). LECTURE seule : la CRÉATION d'entente = chantier
     * ADMIN-(ii), hors périmètre (A-4/UA-6). Lecture directe
     * .from('ententes') = même chemin authentifié prouvé déployé +
     * recetté terrain que listEquipes (ententes!inner y fonctionne).
     *
     * @param {Object} [options] { saisonId?, categorieId? }
     * @returns {Promise<Array>} [] si erreur
     */
    async listEntentes(options) {
      const opt = (options && typeof options === 'object') ? options : {};
      let q = client
        .from('ententes')
        .select(`
          id, code, libelle_court, libelle_moyen,
          saison_id, categorie_id,
          saisons ( id, code ),
          categories ( id, code )
        `);
      if (opt.saisonId)    q = q.eq('saison_id', opt.saisonId);
      if (opt.categorieId) q = q.eq('categorie_id', opt.categorieId);
      const { data, error } = await q.order('code', { ascending: true });
      if (error) {
        console.error('MOM Hub: listEntentes()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * N2 — Groupe de base convoqué d'une équipe engagée (modèle §3.1).
     * Colonne droite U-N2 + source de pioche U-N3. Le rôle joueur|
     * staff est LU via collectif_membre.role (N2-6, zéro champ neuf) ;
     * l'UX compte joueurs/staff séparément. Embed 2 niveaux calqué
     * listEquipes (ententes!inner ( saisons!inner )) — pattern prouvé.
     *
     * @param {string} evenementEquipeId UUID evenement_equipes_engagees
     * @returns {Promise<Array>} [] si erreur
     */
    async listGroupeEngage(evenementEquipeId) {
      if (!evenementEquipeId) {
        console.error('MOM Hub: listGroupeEngage() requiert un evenementEquipeId');
        return [];
      }
      const { data, error } = await client
        .from('equipe_engagee_membre')
        .select(`
          id, evenement_equipe_id, collectif_membre_id,
          collectif_membre (
            id, role, statut, date_debut, date_fin, personne_id
          )
        `)
        .eq('evenement_equipe_id', evenementEquipeId);
      if (error) {
        console.error('MOM Hub: listGroupeEngage()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      // RLS personnes verrouillée → noms via RPC gardée (sql/47).
      // Structure INCHANGÉE : .collectif_membre.personnes {id,nom,prenom}
      const ids = [];
      data.forEach(function (r) {
        if (r.collectif_membre && r.collectif_membre.personne_id) {
          ids.push(r.collectif_membre.personne_id);
        }
      });
      const noms = await SupabaseHub._resolveNoms(ids);
      data.forEach(function (r) {
        const cm = r.collectif_membre;
        if (cm) {
          const n = noms.get(cm.personne_id);
          cm.personnes = n
            ? { id: cm.personne_id, nom: n.nom, prenom: n.prenom }
            : { id: cm.personne_id, nom: '', prenom: '' };
        }
      });
      return data;
    },

    /**
     * N2 — Convoque un membre du collectif dans une équipe engagée
     * (U-N2 « → ajoute »). INSERT equipe_engagee_membre. Le vrai
     * doublon (même membre 2× même équipe) est empêché par l'UNIQUE
     * sql/45 (erreur remontée telle quelle) ; le cumul inter-équipes
     * A&B reste autorisé (N3-5). Pattern addEquipeEngagee.
     *
     * @param {string} evenementEquipeId UUID evenement_equipes_engagees
     * @param {string} collectifMembreId UUID collectif_membre
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async addGroupeMembre(evenementEquipeId, collectifMembreId) {
      if (!evenementEquipeId) return { ok: false, error: 'evenementEquipeId requis' };
      if (!collectifMembreId) return { ok: false, error: 'collectifMembreId requis' };
      const { data, error } = await client
        .from('equipe_engagee_membre')
        .insert({
          evenement_equipe_id: evenementEquipeId,
          collectif_membre_id: collectifMembreId
        })
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: addGroupeMembre()', error);
        return { ok: false, error: error.message || 'Erreur INSERT equipe_engagee_membre' };
      }
      return { ok: true, data: data };
    },

    /**
     * N2 — Retire un membre du groupe convoqué (U-N2 « × retire »).
     * DELETE par id. N2-4 : liste vivante NON versionnée → le retrait
     * est l'opération normale (≠ N1 où la sortie est datée). Pattern
     * removeEquipeEngagee.
     *
     * @param {string} id UUID equipe_engagee_membre
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async removeGroupeMembre(id) {
      if (!id) return { ok: false, error: 'id requis' };
      const { error } = await client
        .from('equipe_engagee_membre')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('MOM Hub: removeGroupeMembre()', error);
        return { ok: false, error: error.message || 'Erreur DELETE equipe_engagee_membre' };
      }
      return { ok: true };
    },

    /**
     * N3 — Compo(s) rattachée(s) à une équipe engagée (feuille de
     * match, modèle N3-1). Lecture du nouveau lien additif
     * compositions.evenement_equipe_id (sql/46). Sert U-N3 à retrouver
     * la feuille de l'équipe engagée. NULL = mono-équipe (non renvoyé
     * ici, lu par evenement_id via le chemin existant — rétro-compat).
     * Tri est_active puis version (la plus récente d'abord).
     *
     * @param {string} evenementEquipeId UUID evenement_equipes_engagees
     * @returns {Promise<Array>} [] si erreur
     */
    async getCompoForEvenementEquipe(evenementEquipeId) {
      if (!evenementEquipeId) {
        console.error('MOM Hub: getCompoForEvenementEquipe() requiert un evenementEquipeId');
        return [];
      }
      const { data, error } = await client
        .from('compositions')
        .select(`
          id, evenement_id, evenement_equipe_id, type_compo,
          compo_base_origine_id, cote, etat,
          version, est_active, notes_compo, created_at, updated_at
        `)
        .eq('evenement_equipe_id', evenementEquipeId)
        .eq('cote', 'mom')
        .order('est_active', { ascending: false })
        .order('version', { ascending: false });
      if (error) {
        console.error('MOM Hub: getCompoForEvenementEquipe()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Liste les compos de MATCH dérivées d'une base donnée, via le lien
     * robuste compo_base_origine_id (option α). Multi-équipes : on NE filtre
     * PAS par equipe_id de l'évènement — les feuilles de match portent
     * l'evenement_id du match (dont equipe_id = équipe ENGAGÉE, ≠ M14), donc
     * une jointure evenements!inner sur M14 les exclurait à tort (bug 6c-6
     * multi-équipes). La base étant déjà résolue par équipe engagée
     * (getCompoForEvenementEquipe), son id suffit à retrouver ses matchs.
     */
    async listMatchsParBaseOrigine(baseId) {
      if (!baseId) {
        console.error('MOM Hub: listMatchsParBaseOrigine() requiert un baseId');
        return [];
      }
      const { data, error } = await client
        .from('compositions')
        .select(`
          id, evenement_id, evenement_equipe_id, type_compo,
          compo_base_origine_id, cote, etat,
          version, est_active, notes_compo, created_at, updated_at
        `)
        .eq('type_compo', 'match')
        .eq('compo_base_origine_id', baseId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('MOM Hub: listMatchsParBaseOrigine()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * N3 — Rattache (ou détache) une compo existante à une équipe
     * engagée : UPDATE compositions.evenement_equipe_id (sql/46,
     * colonne additive). null = retour mono-équipe (rétro-compat
     * stricte, N3-1). NE crée PAS de compo (createCompo déployé NON
     * touché — Façon 1, éditeur étendu pas dupliqué) ; emprunte le
     * chemin write compositions déjà utilisé par updateCompoNotes
     * (prouvé fonctionnel déployé). Pattern updateJoueurCompo.
     *
     * @param {string} compoId UUID compositions
     * @param {string|null} evenementEquipeId UUID equipe engagée, ou
     *   null pour détacher (mono-équipe)
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async setCompoEvenementEquipe(compoId, evenementEquipeId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      if (evenementEquipeId !== null && evenementEquipeId !== undefined &&
          typeof evenementEquipeId !== 'string') {
        return { ok: false, error: 'evenementEquipeId doit être un UUID ou null' };
      }
      const { data, error } = await client
        .from('compositions')
        .update({
          evenement_equipe_id: (evenementEquipeId === undefined ? null : evenementEquipeId)
        })
        .eq('id', compoId)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: setCompoEvenementEquipe()', error);
        return { ok: false, error: error.message };
      }
      return { ok: true, data };
    },

    /**
     * STATS SAISON (pt 61) — Liste les LIGNES de compo match d'un joueur sur
     * la saison, toutes bases confondues, via le lien robuste D-FICHE-B.
     *
     * Pourquoi ce wrapper : la fiche stats joueur agrège un joueur sur toute
     * sa saison ; il faut donc retrouver ses compos match SANS passer par
     * evenement_equipes.equipe_id (NULL multi-équipes → exclut tout, prouvé
     * 164 vs 0, bug 6c-6). On part de composition_joueurs (policy SELECT
     * `composition_joueurs_select_authenticated` = true, sonde pt 61 S61.7 :
     * lecture libre pour authentifié, pattern getCompoComplete) et on joint
     * compositions en !inner avec les filtres saison côté table embarquée
     * (pattern prouvé : listCompositionsByEquipe filtre déjà sur embed !inner).
     *
     * Filtres : role ∈ (titulaire,remplacant) ; compositions.cote='mom',
     * type_compo='match', est_active=true. PAS de filtre `etat` (la compo
     * match active peut être 'brouillon', learning pt 60). JAMAIS de jointure
     * equipe_id (D-FICHE-B).
     *
     * @param {string} joueurId UUID personne (= composition_joueurs.joueur_id,
     *   prouvé personnes.id, sonde pt 61 S61.4)
     * @returns {Promise<Array>} lignes [{ role, poste_id,
     *   est_depannage_hors_categorie, composition_id, compositions:{ id,
     *   evenement_id, compo_base_origine_id, cote, type_compo, est_active } }]
     *   — [] si aucun / erreur (dégradation honnête).
     */
    async listComposMatchDuJoueur(joueurId) {
      if (!joueurId) {
        console.error('MOM Hub: listComposMatchDuJoueur() requiert un joueurId');
        return [];
      }
      const { data, error } = await client
        .from('composition_joueurs')
        .select(`
          role, poste_id, est_depannage_hors_categorie, composition_id,
          compositions!inner ( id, evenement_id, compo_base_origine_id,
                               cote, type_compo, est_active )
        `)
        .eq('joueur_id', joueurId)
        .in('role', ['titulaire', 'remplacant'])
        .eq('compositions.cote', 'mom')
        .eq('compositions.type_compo', 'match')
        .eq('compositions.est_active', true);
      if (error) {
        console.error('MOM Hub: listComposMatchDuJoueur()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Pilotage CATÉGORIE (pt 63) — lignes joueur × équipe × rôle ×
     * poste × match pour TOUTE la catégorie (collectif M14, N équipes),
     * compétition uniquement. Appelle la RPC SECURITY DEFINER
     * pilotage_categorie_lignes (sql pt 63), gardée has_role(admin|coach),
     * qui traverse la self-FK compo_base_origine_id (embed PostgREST 5
     * niveaux jugé fragile → RPC, décision Manu pt 63). Le SELECT sous-
     * jacent est prouvé par la sonde S10 (base fait foi). nom_officiel =
     * seul champ équipe fiable (S3). Le poste est déjà résolu par la RPC
     * (numero_xv + poste_court) → le client n'a pas à re-joindre postes.
     *
     * @param {string} categorieId UUID de la catégorie
     * @returns {Promise<Array>} lignes brutes (1 par occurrence en feuille
     *   de match) ; [] si erreur ou accès refusé (dégradation honnête).
     */
    async listPilotageCategorie(categorieId) {
      if (!categorieId) {
        console.error('MOM Hub: listPilotageCategorie() requiert un categorieId');
        return [];
      }
      const { data, error } = await client.rpc('pilotage_categorie_lignes', {
        p_categorie_id: categorieId
      });
      if (error) {
        console.error('MOM Hub: listPilotageCategorie() / pilotage_categorie_lignes', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Pilotage CATÉGORIE — résout la catégorie de la personne connectée
     * via la RPC B5 mes_categories_autorisees() (déjà en base, gardée).
     * Pas de sélecteur : le référent pilote SA catégorie (D-PILOT-CAT-1).
     * Renvoie la liste des catégories autorisées ; le client décide quoi
     * faire si 0 (message honnête) ou N>1 (proposer un choix minimal).
     *
     * @returns {Promise<Array>} [{categorie_id, ...}] selon la RPC ; []
     *   si erreur / hors session authentifiée (dégradation honnête).
     */
    async mesCategoriesAutorisees() {
      const { data, error } = await client.rpc('mes_categories_autorisees');
      if (error) {
        console.error('MOM Hub: mesCategoriesAutorisees() / mes_categories_autorisees', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * U-N2 entrée — résout le contexte d'une équipe engagée pour
     * l'écran Groupe de base (doc UX §2 UN2-1, 3 dimensions :
     * « Plateau · date » = evenements ; « Groupe — Équipe » =
     * equipes ; « Collectif · saison » = ententes via N1). UNE
     * requête imbriquée (PI-5) ; entente_id résolu par
     * equipes.entente_id (NOT NULL, sql/01) — aucune devinette de
     * saison. Patron getCategorieEquipe (embed equipes→ententes
     * prouvé déployé+recetté). Toutes colonnes vérifiées source
     * (sql/01/sql/42) ou usage déployé — rien inventé (DS-1).
     *
     * @param {string} evenementEquipeId UUID evenement_equipes_engagees
     * @returns {Promise<{ok:boolean, data?:{evenement_equipe:Object,
     *   evenement:Object, equipe:Object, entente:Object},
     *   error?:string}>}
     */
    /**
     * v1.82 — ADVERSAIRE-MATCH-SIMPLE (demande Manu 20/07). Ajout du champ
     * evenement_adversaires au SELECT existant : pour un match simple
     * (1 seule équipe engagée, mono-adversaire, pas de match enfant), le
     * nom de l'adversaire vit sur cette table liée à l'engagement — la
     * bannière compositions-editor.js n'y avait jamais accès. Additif pur
     * (1 embed ajouté), aucun champ retiré, aucun filtre changé.
     */
    async getEvenementEquipeContext(evenementEquipeId) {
      if (!evenementEquipeId) {
        return { ok: false, error: 'evenementEquipeId requis' };
      }
      const { data, error } = await client
        .from('evenement_equipes_engagees')
        .select(`
          id, evenement_id, equipe_id, format_de_jeu, notes,
          evenements ( id, code, libelle, date_debut, type_evenement ),
          equipes (
            id, code, libelle_court, nom_officiel, entente_id,
            ententes ( id, code, libelle_court, libelle_moyen,
                        categorie_id, saison_id )
          ),
          evenement_adversaires ( adversaire_nom, ordre, notes )
        `)
        .eq('id', evenementEquipeId)
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: getEvenementEquipeContext()', error);
        return { ok: false, error: error.message || 'Erreur lecture contexte équipe engagée' };
      }
      if (!data) {
        return { ok: false, error: 'Équipe engagée introuvable' };
      }
      const eq   = data;
      const evt  = eq.evenements || null;
      const team = eq.equipes || null;
      const ent  = (team && team.ententes) ? team.ententes : null;
      if (!ent || !ent.id) {
        return { ok: false, error: "Entente introuvable pour cette équipe engagée (chaîne équipe→entente)" };
      }
      const adversaires = Array.isArray(eq.evenement_adversaires)
        ? eq.evenement_adversaires.slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        : [];
      return {
        ok: true,
        data: {
          evenement_equipe: {
            id:            eq.id,
            evenement_id:  eq.evenement_id,
            equipe_id:     eq.equipe_id,
            format_de_jeu: eq.format_de_jeu,
            notes:         eq.notes,
            adversaires:   adversaires
          },
          evenement: evt,
          equipe: team ? {
            id:            team.id,
            code:          team.code,
            libelle_court: team.libelle_court,
            nom_officiel:  team.nom_officiel,
            entente_id:    team.entente_id
          } : null,
          entente: ent
        }
      };
    },

    /**
     * P1 — Liste « mes évènements avec compos » pour la page-raccourci
     * (lien « Compositions » du menu). Une ligne par COMPO DE BASE
     * ACTIVE = une feuille d'équipe engagée.
     *
     * Pourquoi un wrapper neuf et pas listCompositionsByEquipe : ce
     * dernier joint evenements!inner sur evenements.equipe_id = M14,
     * ce qui EXCLUT les évènements multi-équipes (tournois, equipe_id
     * NULL) — prouvé à la source (Challenge Vié, equipe_id NULL, 2
     * bases d'équipes engagées invisibles côté tableau de bord). Ici
     * on part de compositions et on embarque l'évènement + l'équipe
     * engagée par la FK evenement_equipe_id (N3), sans filtre mono-
     * équipe → les tournois remontent.
     *
     * Embeds calqués sur getEvenementEquipeContext (prouvé déployé) :
     *   compositions → evenements (libellé/date/type)
     *   compositions → evenement_equipes_engagees → equipes (libellé)
     * Si PostgREST renvoie une ambiguïté d'embed (PGRST201) sur
     * evenement_equipes_engagees, désambiguïser par le nom de
     * contrainte FK (pattern projet pt 15). Au boot, le 1ᵉʳ appel
     * tranchera.
     *
     * Filtre : type_compo='base' + est_active=true + cote='mom'
     * (la feuille MOM, pas un éventuel côté adverse). evenement_equipe_id
     * NOT NULL implicite (une base sans équipe engagée = compo legacy
     * mono-équipe, hors scope multi-équipes ; on l'inclut quand même
     * si elle porte un evenement_id résoluble — voir mapping).
     *
     * @param {number} [limit=100] plafond de lignes
     * @returns {Promise<Array>} lignes prêtes pour l'affichage :
     *   [{ compo_id, etat, evenement_equipe_id, evenement: {id, libelle,
     *      date_debut, type_evenement}, equipe: {id, libelle} }]
     *   triées par date d'évènement décroissante ; [] si erreur
     *   (dégradation honnête, pattern getVivierCompo).
     */
    async listMesEvenementsAvecCompos(limit = 100) {
      const { data, error } = await client
        .from('compositions')
        .select(`
          id, etat, est_active, type_compo, cote,
          evenement_equipe_id,
          evenements ( id, code, libelle, date_debut, type_evenement ),
          evenement_equipes_engagees (
            id, equipe_id,
            equipes ( id, code, libelle_court, nom_officiel, ententes ( categorie_id ) )
          )
        `)
        .eq('type_compo', 'base')
        .eq('est_active', true)
        .eq('cote', 'mom')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        console.error('MOM Hub: listMesEvenementsAvecCompos()', error);
        return [];
      }
      const rows = Array.isArray(data) ? data : [];
      const out = rows.map(function (c) {
        const evt = c.evenements || null;
        const eee = c.evenement_equipes_engagees || null;
        const team = (eee && eee.equipes) ? eee.equipes : null;
        const equipeLibelle = team
          ? (team.nom_officiel || team.libelle_court || team.code || '')
          : '';
        // Catégorie de l'équipe engagée, dérivée via ententes.categorie_id
        // (chemin prouvé : equipes → ententes → categorie_id). Exposée pour
        // permettre le filtrage par catégorie active dans mes-compos.html.
        // PostgREST peut renvoyer l'embed ententes en objet OU en tableau
        // selon la cardinalité résolue → on gère les deux (repli null honnête).
        let ente = team ? team.ententes : null;
        if (Array.isArray(ente)) ente = ente[0] || null;
        const categorieId = (ente && ente.categorie_id) ? ente.categorie_id : null;
        return {
          compo_id: c.id,
          etat: c.etat,
          evenement_equipe_id: c.evenement_equipe_id,
          evenement: evt ? {
            id:             evt.id,
            libelle:        evt.libelle,
            date_debut:     evt.date_debut,
            type_evenement: evt.type_evenement
          } : null,
          equipe: team ? { id: team.id, libelle: equipeLibelle, categorie_id: categorieId } : null
        };
      });
      out.sort(function (a, b) {
        const da = (a.evenement && a.evenement.date_debut) || '';
        const db = (b.evenement && b.evenement.date_debut) || '';
        return db.localeCompare(da);
      });
      return out;
    },

    /**
     * U-admin pioche — « les joueurs de la catégorie » (doc UX §4) :
     * personnes affectées (equipe_joueurs ACTIVE, date_sortie IS
     * NULL) à une equipe dont entente_id = l'entente sélectionnée.
     * Chemin VÉRIFIÉ source sql/01 : ententes.categorie_id ←
     * equipes.entente_id ← equipe_joueurs(personne_id). ÉCART
     * ASSUMÉ (tracé clôture) : equipe_joueurs sert UNIQUEMENT à la
     * pioche UI ; le stockage N1 reste autonome. Dédoublonne par
     * personne (un joueur sur 2 équipes de l'entente = 1 entrée).
     * Patron embed listEquipes (equipes!inner) prouvé déployé.
     *
     * @param {string} ententeId UUID ententes
     * @returns {Promise<Array>} [{personne_id, nom, prenom}] trié
     *   nom/prenom ; [] si erreur (dégradation honnête, pattern
     *   getVivierCompo).
     */
    async listJoueursCategorieEntente(ententeId) {
      if (!ententeId) {
        console.error('MOM Hub: listJoueursCategorieEntente() requiert un ententeId');
        return [];
      }
      const { data, error } = await client
        .from('equipe_joueurs')
        .select(`
          personne_id, date_sortie,
          equipes!inner ( id, entente_id )
        `)
        .eq('equipes.entente_id', ententeId)
        .is('date_sortie', null);
      if (error) {
        console.error('MOM Hub: listJoueursCategorieEntente()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      // RLS personnes verrouillée → noms via RPC gardée (sql/47).
      // Sortie INCHANGÉE : [{personne_id, nom, prenom}] trié nom/prenom.
      const seen = new Set();
      const ids = [];
      data.forEach(function (row) {
        const pid = row && row.personne_id;
        if (pid && !seen.has(pid)) { seen.add(pid); ids.push(pid); }
      });
      const noms = await SupabaseHub._resolveNoms(ids);
      const out = ids.map(function (pid) {
        const n = noms.get(pid);
        return { personne_id: pid, nom: (n && n.nom) || '', prenom: (n && n.prenom) || '' };
      });
      out.sort(function (a, b) {
        const an = (a.nom + ' ' + a.prenom).toLowerCase();
        const bn = (b.nom + ' ' + b.prenom).toLowerCase();
        return an < bn ? -1 : (an > bn ? 1 : 0);
      });
      return out;
    },

    /**
     * Re-consolide le score après la revue vidéo (geste explicite
     * « Terminer la revue vidéo », B-Q3). Encapsule la fonction
     * 2-arg consolider_score_rencontre (sql/C12-e, NON modifié).
     * Signature SQL réelle (fait foi) :
     *   consolider_score_rencontre(p_evenement_uuid UUID
     *                              [, p_token TEXT])
     * Chemin COACH = p_evenement_uuid SEUL, SANS p_token (la
     * 2-arg résout déjà l'événement ; STATE SUIVI-UI-5 : couvre
     * la consolidation coach authentifié). Le score n'est JAMAIS
     * saisi (I1) : la RPC SOMME valeur_points par camp des
     * lignes non annulées et photographie evenements.score_mom/
     * score_adverse. Le coach CONSTATE le résultat, ne le valide
     * pas (S-4.2.a). Même forme de retour que
     * SuiviClient.consoliderScoreRencontre.
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @returns {Promise<{ok:boolean, data?:{score_mom:number,
     *          score_adverse:number}, error?:string}>}
     */
    async consoliderScoreRencontreCoach(evenementUuid) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const { data, error } = await client.rpc('consolider_score_rencontre', {
        p_evenement_uuid: evenementUuid
      });
      if (error) {
        console.error('MOM Hub: consoliderScoreRencontreCoach()', error);
        return { ok: false, error: error.message || 'Erreur consolider_score_rencontre' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    // ============================================================
    // SUIVI LIVE · CHRONO DE RENCONTRE (C12-n) — voie COACH
    //   Chrono persistant : coup d'envoi / pause / reprise /
    //   période suivante / fin / config. État = horodatages+durées
    //   en base ; l'écran recalcule les minutes (survit au reload).
    //   Voie jeton (bénévole) = suivi-client.js, ajout ultérieur.
    // ============================================================

    /**
     * ÉCRITURE — applique une action au chrono (coach authentifié).
     * RPC SECURITY DEFINER action_chrono_coach (C12-n).
     * @param {string} evenementUuid  le MATCH
     * @param {string} action  coup_envoi|pause|reprise|periode_suivante|fin|config
     * @param {{durees?:number[], modeAffichage?:string}} [opts]
     *   durees = minutes par période (config) ; modeAffichage = 'ecoule'|'rebours'
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async actionChronoCoach(evenementUuid, action, opts) {
      if (!evenementUuid) return { ok: false, error: 'evenementUuid manquant' };
      if (!action)        return { ok: false, error: 'action manquante' };
      const params = { p_evenement_uuid: evenementUuid, p_action: action };
      if (opts && Array.isArray(opts.durees)) params.p_durees = opts.durees;
      if (opts && opts.modeAffichage)         params.p_mode_affichage = opts.modeAffichage;
      const { error } = await client.rpc('action_chrono_coach', params);
      if (error) {
        console.error('MOM Hub: actionChronoCoach()', error);
        return { ok: false, error: error.message || 'Erreur action_chrono_coach' };
      }
      return { ok: true };
    },

    /**
     * LECTURE — état brut du chrono (coach authentifié). RPC
     * get_chrono_rencontre_coach (C12-n). L'écran recalcule les
     * minutes à partir des horodatages+durées renvoyés.
     * @param {string} evenementUuid  le MATCH
     * @returns {Promise<object|null>} 1 ligne d'état, ou null si
     *   chrono pas encore initialisé / refus (convention lecture).
     */
    async getChronoRencontreCoach(evenementUuid) {
      if (!evenementUuid) {
        console.error('MOM Hub: getChronoRencontreCoach() requiert un evenementUuid');
        return null;
      }
      const { data, error } = await client.rpc('get_chrono_rencontre_coach', {
        p_evenement_uuid: evenementUuid
      });
      if (error) {
        console.error('MOM Hub: getChronoRencontreCoach()', error);
        return null;
      }
      return Array.isArray(data) ? (data[0] || null) : (data || null);
    },

    /**
     * LECTURE — Temps de jeu par joueur d'un match (coach authentifié).
     * RPC get_temps_de_jeu_rencontre (C12-w, chantier SUIVI-COACH-7).
     *
     * Calcul backend = intersection [présence joueur] × [fenêtres de
     * période archivées C12-v] ; n'utilise JAMAIS minute_match (non
     * fiable, pt 53). Le front N'A AUCUN calcul à refaire : il affiche
     * tel quel out_minutes_jeu (ou l'absence si chrono incomplet).
     *
     * DÉGRADATION HONNÊTE : si le chrono n'a pas été lancé/clôturé sur
     * ce match, chaque ligne a chrono_complet=false et minutes_jeu=null.
     * L'écran doit afficher « temps de jeu indisponible » dans ce cas,
     * JAMAIS un 0 ni une minute fabriquée (cohérent rapports pt 53).
     *
     * @param {string} evenementUuid  le MATCH
     * @param {string} [evenementEquipeId]  désambiguïse le multi-équipes
     *   (à fournir seulement si >1 compo active de match ; sinon la RPC
     *    lève une erreur d'ambiguïté qu'on remonte telle quelle).
     * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
     *   data = 1 ligne / joueur : { out_joueur_id, out_role,
     *   out_numero_maillot, out_minutes_jeu, out_secondes_jeu,
     *   out_est_entre, out_chrono_complet }.
     */
    async getTempsDeJeuRencontre(evenementUuid, evenementEquipeId) {
      if (!evenementUuid) {
        console.error('MOM Hub: getTempsDeJeuRencontre() requiert un evenementUuid');
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const params = { p_evenement_uuid: evenementUuid };
      if (evenementEquipeId) params.p_evenement_equipe_id = evenementEquipeId;
      const { data, error } = await client.rpc('get_temps_de_jeu_rencontre', params);
      if (error) {
        console.error('MOM Hub: getTempsDeJeuRencontre()', error);
        return { ok: false, error: error.message || 'Erreur get_temps_de_jeu_rencontre' };
      }
      return { ok: true, data: Array.isArray(data) ? data : [] };
    },

    // ============================================================
    // ADMIN-(ii) · ESPACE ADMINISTRATION TRANSVERSE  (v1.31)
    //   Sous-chantier (1) Équipes par catégorie + (3) Ententes
    //   intégré. Doc FAIT FOI Conception-UX-ADMIN-ii-v1.md
    //   (md5 ca043a48) §3.1 / §3.3. Toutes les colonnes sont
    //   confirmées à la source (information_schema, 28/05/2026) —
    //   aucune inventée. Chemin write = « admin seul v1 » (RLS
    //   has_role('admin') à confirmer pg_policies, cf. changelog).
    // ============================================================

    /**
     * LECTURE — Grille pôles → catégories actives du club (doc
     * §3.1 D2bis « par pôle → catégorie verrouillée »). Structure
     * d'entrée de l'écran admin équipes.
     *
     * Mapping pôle↔catégorie = poles.categories_rattachees (TEXT[]
     * de CODES catégorie), confirmé à la source — lève le candidat
     * de la dette IMPL-CAT-ACTIVES-MAPPING : une catégorie est
     * « active au club » ssi son code figure dans le tableau d'un
     * pôle. M5 exclue par construction (absente des tableaux).
     * Jointure faite côté client par categories.code.
     *
     * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
     *   data = pôles (ordre getPoles), chacun
     *   { ...pole, categories: [...] } triées par ordre_tri.
     */
    async getPolesAvecCategories() {
      const [polesRes, catsRes] = await Promise.all([
        client.from('poles').select('*').order('uuid_legacy'),
        client.from('categories').select('*').order('ordre_tri', { ascending: true })
      ]);
      if (polesRes.error) {
        console.error('MOM Hub: getPolesAvecCategories() poles', polesRes.error);
        return { ok: false, error: polesRes.error.message || 'Erreur lecture poles' };
      }
      if (catsRes.error) {
        console.error('MOM Hub: getPolesAvecCategories() categories', catsRes.error);
        return { ok: false, error: catsRes.error.message || 'Erreur lecture categories' };
      }
      const cats = Array.isArray(catsRes.data) ? catsRes.data : [];
      const byCode = new Map(cats.map(c => [c.code, c]));
      const data = (Array.isArray(polesRes.data) ? polesRes.data : []).map(p => {
        const codes = Array.isArray(p.categories_rattachees) ? p.categories_rattachees : [];
        const categories = codes
          .map(code => byCode.get(code))
          .filter(Boolean)
          .sort((a, b) => (a.ordre_tri || 0) - (b.ordre_tri || 0));
        return Object.assign({}, p, { categories: categories });
      });
      return { ok: true, data: data };
    },

    /**
     * LECTURE — Le cadre « entente » d'une catégorie × saison
     * (doc §3.3). UNIQUE(saison_id, categorie_id) ⇒ au plus 1.
     * Sert (a) à déduire equipes.entente_id à la création d'une
     * équipe (champ verrouillé, contexte), (b) à détecter le cas
     * F15/F18 « catégorie sans cadre » (data=null → modale entente
     * en mode création avant toute équipe).
     *
     * @param {string} categorieId UUID categories.id
     * @param {string} saisonId    UUID saisons.id
     * @returns {Promise<{ok:boolean, data?:Object|null, error?:string}>}
     */
    async getEntenteCadre(categorieId, saisonId) {
      if (!categorieId || !saisonId) {
        return { ok: false, error: 'categorieId et saisonId requis' };
      }
      const { data, error } = await client
        .from('ententes')
        .select('id, code, slug, libelle_court, libelle_moyen, libelle_long, saison_id, categorie_id, club_principal_id, clubs_partenaires_ids, regime_actuel, date_mise_en_place, convention_ffr_url, date_signature_convention, date_fin_validite_convention, identifiant_sporteasy, competitions_engagees, notes')
        .eq('categorie_id', categorieId)
        .eq('saison_id', saisonId)
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: getEntenteCadre()', error);
        return { ok: false, error: error.message || 'Erreur lecture entente cadre' };
      }
      return { ok: true, data: data || null };
    },

    /**
     * LECTURE — Liste les saisons pour le bandeau ADMIN-(ii) (doc
     * §3.1 D4). Colonnes confirmées à la source (information_schema
     * 28/05) : id, code, libelle, date_debut, date_fin, est_active.
     * Le modèle réel n'a PAS de colonne `statut` (le JSON saison
     * diverge — gouvernance SQL↔JSON) : le classement passé / active
     * / futur se dérive de date_debut/date_fin + est_active côté
     * écran. Tri date_debut décroissant (plus récentes d'abord).
     * AUCUN filtre est_active : les saisons passées sont
     * CONSULTABLES (lecture seule côté UI, jamais réécrites).
     *
     * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
     */
    async listSaisons() {
      const { data, error } = await client
        .from('saisons')
        .select('id, code, libelle, date_debut, date_fin, est_active')
        .order('date_debut', { ascending: false });
      if (error) {
        console.error('MOM Hub: listSaisons()', error);
        return { ok: false, error: error.message || 'Erreur lecture saisons' };
      }
      return { ok: true, data: Array.isArray(data) ? data : [] };
    },

    /**
     * LECTURE — Équipes rattachées à un ENSEMBLE d'ententes, en un
     * seul appel (.in entente_id). Sert la grille ADMIN-(ii) : on
     * résout d'abord les ententes de la saison choisie
     * (listEntentes({saisonId})) puis on charge toutes leurs équipes
     * d'un coup, groupées côté écran par entente_id → catégorie.
     * Contrairement à listEquipes() (active-season-only +
     * statut='active'), renvoie TOUS les statuts — l'admin voit aussi
     * les équipes désactivées (grisées) — et toute saison (aucun
     * filtre est_active). select('*') = prérempli pour la modale
     * d'édition sans second fetch.
     *
     * @param {string[]} ententeIds liste d'UUID ententes.id
     * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
     */
    async listEquipesByEntentes(ententeIds) {
      if (!Array.isArray(ententeIds) || ententeIds.length === 0) {
        return { ok: true, data: [] };
      }
      const { data, error } = await client
        .from('equipes')
        .select('*')
        .in('entente_id', ententeIds)
        .order('numero_equipe', { ascending: true, nullsFirst: false });
      if (error) {
        console.error('MOM Hub: listEquipesByEntentes()', error);
        return { ok: false, error: error.message || 'Erreur lecture equipes' };
      }
      return { ok: true, data: Array.isArray(data) ? data : [] };
    },

    /**
     * ÉCRITURE — Crée une équipe (doc §3.1 modale création). v1
     * « admin seul » (RLS has_role('admin') à confirmer). entente_id
     * est DÉDUIT du contexte catégorie × saison (getEntenteCadre),
     * jamais saisi. Requis (NOT NULL sans défaut, schéma réel) :
     * code, nom_officiel, entente_id. Le reste est optionnel
     * (défauts base) ; whitelist = colonnes réelles equipes
     * (information_schema 28/05).
     *
     * @param {Object} payload
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async createEquipe(payload) {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      if (!payload.code || !payload.nom_officiel || !payload.entente_id) {
        return { ok: false, error: 'Champs requis manquants : code, nom_officiel, entente_id' };
      }
      const allowedFields = [
        'code', 'nom_officiel', 'alias', 'entente_id', 'numero_equipe',
        'libelle_court', 'libelle_moyen', 'libelle_long',
        'type_equipe', 'club_referent_id', 'mixte', 'mixte_detail',
        'format_jeu_code', 'format_jeu_libelle',
        'championnat_nom', 'championnat_ligue',
        'championnat_code_ffr', 'championnat_code_scorenco',
        'sites_utilises', 'site_principal_id', 'sites_note',
        'statut', 'coach_principal_id', 'coachs_adjoints_ids',
        'manager_id', 'jeux_maillots',
        'effectif_theorique', 'effectif_minimum_operationnel', 'notes'
      ];
      const insertPayload = {};
      allowedFields.forEach(f => {
        if (payload[f] !== undefined) insertPayload[f] = payload[f];
      });
      const { data, error } = await client
        .from('equipes')
        .insert(insertPayload)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: createEquipe()', error);
        return { ok: false, error: error.message || 'Erreur INSERT equipes' };
      }
      return { ok: true, data: data };
    },

    /**
     * ÉCRITURE — Met à jour une équipe (édition par clic sur carte,
     * doc §3.1 cycle de vie). PATCH partiel : seuls les champs
     * fournis sont écrits. Whitelist = colonnes réelles equipes
     * (entente_id reste éditable = re-rattachement possible) ;
     * id / created_at / updated_at exclus.
     *
     * @param {string} equipeId UUID equipes.id
     * @param {Object} patch    sous-ensemble des colonnes équipe
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async updateEquipe(equipeId, patch) {
      if (!equipeId) return { ok: false, error: 'equipeId manquant' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'patch manquant ou invalide' };
      }
      const allowedFields = [
        'code', 'nom_officiel', 'alias', 'entente_id', 'numero_equipe',
        'libelle_court', 'libelle_moyen', 'libelle_long',
        'type_equipe', 'club_referent_id', 'mixte', 'mixte_detail',
        'format_jeu_code', 'format_jeu_libelle',
        'championnat_nom', 'championnat_ligue',
        'championnat_code_ffr', 'championnat_code_scorenco',
        'sites_utilises', 'site_principal_id', 'sites_note',
        'statut', 'coach_principal_id', 'coachs_adjoints_ids',
        'manager_id', 'jeux_maillots',
        'effectif_theorique', 'effectif_minimum_operationnel', 'notes'
      ];
      const updatePayload = {};
      allowedFields.forEach(f => {
        if (patch[f] !== undefined) updatePayload[f] = patch[f];
      });
      if (Object.keys(updatePayload).length === 0) {
        return { ok: false, error: 'Aucun champ à mettre à jour' };
      }
      const { data, error } = await client
        .from('equipes')
        .update(updatePayload)
        .eq('id', equipeId)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: updateEquipe()', error);
        return { ok: false, error: error.message || 'Erreur UPDATE equipes' };
      }
      return { ok: true, data: data };
    },

    /**
     * ÉCRITURE — Active / désactive une équipe (doc §3.1 : jamais
     * de suppression dure, on bascule statut pour préserver
     * l'historique évènements ; listEquipes() ne renvoie que
     * statut='active'). Valeurs conventionnelles doc : 'active' /
     * 'inactive' (décision déléguée tracée — si la base emploie un
     * autre littéral de désactivation, ajuster sans casse). Le
     * statut est passé explicitement, non figé ici.
     *
     * @param {string} equipeId UUID
     * @param {string} statut   nouveau statut (chaîne non vide)
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async setEquipeStatut(equipeId, statut) {
      if (!equipeId) return { ok: false, error: 'equipeId manquant' };
      if (!statut || typeof statut !== 'string') {
        return { ok: false, error: 'statut requis (chaîne non vide)' };
      }
      const { data, error } = await client
        .from('equipes')
        .update({ statut: statut })
        .eq('id', equipeId)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: setEquipeStatut()', error);
        return { ok: false, error: error.message || 'Erreur UPDATE statut equipe' };
      }
      return { ok: true, data: data };
    },

    /**
     * ÉCRITURE — Crée le cadre entente d'une catégorie × saison
     * (doc §3.3, cas ultra-rare F15/F18 « catégorie sans cadre »).
     * UNIQUE(saison_id, categorie_id) garantit l'unicité côté base.
     * Requis (NOT NULL sans défaut, schéma réel) : code, saison_id,
     * categorie_id, club_principal_id, regime_actuel.
     *
     * @param {Object} payload
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async createEntente(payload) {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      if (!payload.code || !payload.saison_id || !payload.categorie_id
          || !payload.club_principal_id || !payload.regime_actuel) {
        return { ok: false, error: 'Champs requis manquants : code, saison_id, categorie_id, club_principal_id, regime_actuel' };
      }
      const allowedFields = [
        'code', 'slug', 'libelle_court', 'libelle_moyen', 'libelle_long',
        'saison_id', 'categorie_id', 'club_principal_id',
        'clubs_partenaires_ids', 'regime_actuel', 'date_mise_en_place',
        'convention_ffr_url', 'date_signature_convention',
        'date_fin_validite_convention', 'identifiant_sporteasy',
        'competitions_engagees', 'notes'
      ];
      const insertPayload = {};
      allowedFields.forEach(f => {
        if (payload[f] !== undefined) insertPayload[f] = payload[f];
      });
      const { data, error } = await client
        .from('ententes')
        .insert(insertPayload)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: createEntente()', error);
        return { ok: false, error: error.message || 'Erreur INSERT ententes' };
      }
      return { ok: true, data: data };
    },

    /**
     * ÉCRITURE — Édite le cadre entente (doc §3.3, geste rare :
     * corriger un régime, ajouter des clubs partenaires, renseigner
     * la convention FFR). L'ancre d'identité saison_id × categorie_id
     * est IMMUABLE dans ce chemin (décision déléguée tracée :
     * changer le couple = re-clé, hors usage « éditer le cadre ») —
     * exclue de la whitelist, comme id / created_at / updated_at.
     * PATCH partiel.
     *
     * @param {string} ententeId UUID ententes.id
     * @param {Object} patch
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async updateEntente(ententeId, patch) {
      if (!ententeId) return { ok: false, error: 'ententeId manquant' };
      if (!patch || typeof patch !== 'object') {
        return { ok: false, error: 'patch manquant ou invalide' };
      }
      const allowedFields = [
        'code', 'slug', 'libelle_court', 'libelle_moyen', 'libelle_long',
        'club_principal_id', 'clubs_partenaires_ids', 'regime_actuel',
        'date_mise_en_place', 'convention_ffr_url',
        'date_signature_convention', 'date_fin_validite_convention',
        'identifiant_sporteasy', 'competitions_engagees', 'notes'
      ];
      const updatePayload = {};
      allowedFields.forEach(f => {
        if (patch[f] !== undefined) updatePayload[f] = patch[f];
      });
      if (Object.keys(updatePayload).length === 0) {
        return { ok: false, error: 'Aucun champ à mettre à jour' };
      }
      const { data, error } = await client
        .from('ententes')
        .update(updatePayload)
        .eq('id', ententeId)
        .select()
        .maybeSingle();
      if (error) {
        console.error('MOM Hub: updateEntente()', error);
        return { ok: false, error: error.message || 'Erreur UPDATE ententes' };
      }
      return { ok: true, data: data };
    },

    // ============================================================
    // ADMIN-(ii) · (2) SAISONS + bascule millésime  (v1.33)
    //   Doc FAIT FOI Conception-UX-ADMIN-ii-v1.md (md5 ca043a48) §3.4.
    //   4 wrappers ADDITIFS appelant les RPC SECURITY DEFINER de sql/53
    //   (has_role('admin')). saisons ET personnes ont une RLS write
    //   FERMÉE au client (sondes 28/05) → aucune écriture directe
    //   possible : TOUT passe par RPC. listSaisons() (lecture, bandeau
    //   D4) existe depuis v1.31 et n'est PAS touchée ici.
    // ============================================================

    /**
     * ÉCRITURE — Crée une saison (2a). RPC creer_saison (SECURITY
     * DEFINER, has_role('admin')) : saisons n'a aucune policy write
     * (RLS deny côté client). Requis : code, libelle, date_debut,
     * date_fin (dates ISO 'YYYY-MM-DD'). est_active=false à la création
     * (activation = geste séparé, cf. setSaisonActive). La base applique
     * CHECK(date_fin>date_debut) + UNIQUE(code) (fail-loud).
     *
     * @param {Object} payload {code, libelle, date_debut, date_fin}
     * @returns {Promise<{ok:boolean, data?:string, error?:string}>} data=uuid
     */
    async createSaison(payload) {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Payload manquant ou invalide' };
      }
      const code = (payload.code == null ? '' : String(payload.code)).trim();
      const libelle = (payload.libelle == null ? '' : String(payload.libelle)).trim();
      const dd = (payload.date_debut == null ? '' : String(payload.date_debut)).trim();
      const df = (payload.date_fin == null ? '' : String(payload.date_fin)).trim();
      if (!code || !libelle || !dd || !df) {
        return { ok: false, error: 'Champs requis : code, libelle, date_debut, date_fin' };
      }
      const { data, error } = await client.rpc('creer_saison', {
        p_code: code, p_libelle: libelle, p_date_debut: dd, p_date_fin: df
      });
      if (error) {
        console.error('MOM Hub: createSaison()', error);
        return { ok: false, error: error.message || 'Erreur création saison' };
      }
      return { ok: true, data: data };   // data = uuid de la saison créée
    },

    /**
     * ÉCRITURE — Active une saison (2a). RPC activer_saison : désactive
     * l'active courante PUIS active la cible, dans la même transaction
     * (respecte l'index unique partiel idx_saisons_une_seule_active qui
     * interdit deux est_active=true). Indépendant de la bascule.
     *
     * @param {string} saisonId UUID saisons.id
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     */
    async setSaisonActive(saisonId) {
      if (!saisonId) return { ok: false, error: 'saisonId manquant' };
      const { data, error } = await client.rpc('activer_saison', { p_id: saisonId });
      if (error) {
        console.error('MOM Hub: setSaisonActive()', error);
        return { ok: false, error: error.message || 'Erreur activation saison' };
      }
      return { ok: true, data: data };
    },

    /**
     * LECTURE — Aperçu de la bascule par millésime (2b), STRICTEMENT
     * LECTURE SEULE (rien n'est écrit). RPC apercu_bascule : le calcul
     * (règle figée) est fait côté serveur car personnes a 0 policy SELECT
     * (verrou RGPD) → jamais exposée ; seul le payload réduit sort. Une
     * ligne par personne du scope : {personne_id, nom_court, cat_avant,
     * cat_apres, groupe, motif}. groupe ∈ {a_basculer, inchange,
     * a_verifier}.
     *
     * @param {string} saisonId UUID de la saison CIBLE (N+1)
     * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
     */
    async apercuBascule(saisonId) {
      if (!saisonId) return { ok: false, error: 'saisonId manquant' };
      const { data, error } = await client.rpc('apercu_bascule', { p_saison_id: saisonId });
      if (error) {
        console.error('MOM Hub: apercuBascule()', error);
        return { ok: false, error: error.message || 'Erreur aperçu bascule' };
      }
      return { ok: true, data: Array.isArray(data) ? data : [] };
    },

    /**
     * ÉCRITURE DE MASSE — Applique la bascule (2b). RPC appliquer_bascule :
     * RECALCULE serveur le groupe « à basculer » (ne fait PAS confiance à
     * une liste client → garantit « lecture seule jusqu'à Appliquer »),
     * UPDATE personnes.categorie_id + INSERT bascule_log dans une seule
     * transaction, fail-loud (nb modifiées = nb attendues sinon ROLLBACK).
     * À n'appeler que derrière une confirmation explicite (garde-fou UI).
     *
     * @param {string} saisonId UUID de la saison CIBLE
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     *          data = {ok, nb_basculees, log_id, message?}
     */
    async appliquerBascule(saisonId) {
      if (!saisonId) return { ok: false, error: 'saisonId manquant' };
      const { data, error } = await client.rpc('appliquer_bascule', { p_saison_id: saisonId });
      if (error) {
        console.error('MOM Hub: appliquerBascule()', error);
        return { ok: false, error: error.message || 'Erreur application bascule' };
      }
      return { ok: true, data: data };
    },

    // ============================================================
    // ADMIN-(ii) · (2c) RECONDUCTION DE SAISON  (v1.71)
    //   Doc FAIT FOI Conception-Reconduction-Saison-v1.md (md5 2f50aabf).
    //   2 wrappers ADDITIFS appelant les RPC SECURITY DEFINER de
    //   sql_141 (has_role('admin')). Comblent le trou fonctionnel de
    //   sql/53 : la bascule surclasse les joueurs mais ne reconduisait
    //   ni les ententes, ni le rattachement des équipes, ni le
    //   collectif. Geste unique cible (écran admin-saisons) :
    //   appliquerBascule PUIS appliquerReconduction, séquencés côté UI
    //   (si la première échoue, la seconde n'est pas tentée — P1,
    //   pas de méga-RPC).
    // ============================================================

    /**
     * LECTURE — Aperçu de la reconduction de saison (2c), STRICTEMENT
     * LECTURE SEULE (rien n'est écrit). RPC apercu_reconduction : plan
     * complet des 3 volets calculé serveur. Une ligne par objet :
     * {volet, groupe, libelle, detail}. volet ∈ {entente, equipe,
     * collectif} ; groupe ∈ {a_creer, deja_existante, a_rebrancher,
     * deja_rebranchee, a_amorcer, deja_amorce, sans_entente_cible}.
     * Payload RGPD minimal (nom court côté collectif, jamais personnes
     * brute — patron apercu_bascule). sans_entente_cible = catégories
     * sans entente MOM (ex-F18), non amorcées : attendu métier.
     *
     * @param {string} saisonSourceId UUID de la saison N (source)
     * @param {string} saisonCibleId  UUID de la saison N+1 (cible)
     * @returns {Promise<{ok:boolean, data?:Array, error?:string}>}
     */
    async apercuReconduction(saisonSourceId, saisonCibleId) {
      if (!saisonSourceId || !saisonCibleId) {
        return { ok: false, error: 'saisonSourceId et saisonCibleId requis' };
      }
      const { data, error } = await client.rpc('apercu_reconduction', {
        p_saison_source: saisonSourceId,
        p_saison_cible: saisonCibleId
      });
      if (error) {
        console.error('MOM Hub: apercuReconduction()', error);
        return { ok: false, error: error.message || 'Erreur aperçu reconduction' };
      }
      return { ok: true, data: Array.isArray(data) ? data : [] };
    },

    /**
     * ÉCRITURE DE MASSE — Applique la reconduction (2c). RPC
     * appliquer_reconduction : RECALCULE serveur (ne fait PAS confiance
     * à l'aperçu client), transaction unique ententes (création N+1
     * remillésimée : code/slug/libelle_long, tokens dérivés de
     * saisons.code) → équipes (re-rattachement entente_id + code) →
     * collectif (joueurs dérivés de personnes post-bascule, staff
     * copié, double garde anti-doublon patron sql/55), fail-loud
     * (nb écrit = nb attendu à chaque étape + invariants POST sinon
     * ROLLBACK total) + INSERT reconduction_log. IDEMPOTENTE : re-run
     * répond ok sans écrire ni journaliser. À n'appeler que derrière
     * une confirmation explicite (garde-fou UI), APRÈS appliquerBascule
     * dans le geste unique.
     *
     * @param {string} saisonSourceId UUID de la saison N (source)
     * @param {string} saisonCibleId  UUID de la saison N+1 (cible)
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     *          data = {ok, nb_ententes, nb_equipes, nb_membres,
     *          log_id, message?}
     */
    async appliquerReconduction(saisonSourceId, saisonCibleId) {
      if (!saisonSourceId || !saisonCibleId) {
        return { ok: false, error: 'saisonSourceId et saisonCibleId requis' };
      }
      const { data, error } = await client.rpc('appliquer_reconduction', {
        p_saison_source: saisonSourceId,
        p_saison_cible: saisonCibleId
      });
      if (error) {
        console.error('MOM Hub: appliquerReconduction()', error);
        return { ok: false, error: error.message || 'Erreur application reconduction' };
      }
      return { ok: true, data: data };
    },

    // ============================================================
    // PRODUCTION · STAFF DU COLLECTIF N1  (v1.34)
    //   Pioche staff de u-admin (option A). Côté écriture, RIEN de
    //   neuf : addCollectifMembre(role:'staff') + listCollectifMembres
    //   ({role:'staff'}) existent depuis v1.24. Seul manque = la SOURCE
    //   de pioche, ici résolue par RPC (personnes RLS-verrouillée).
    // ============================================================

    /**
     * U-admin pioche STAFF (option A) — les personnes staff du club,
     * pour rattachement manuel à l'entente sélectionnée. Calque exact
     * de listJoueursCategorieEntente côté SORTIE, mais la SOURCE diffère :
     * il n'existe AUCUNE table d'affectation staff par catégorie
     * (sonde 3a : pas de equipe_staff ; evenement_encadrants est au
     * niveau évènement, pas saison) — donc pas de filtre par entente,
     * l'admin choisit qui rattacher (Q1 acté : un staff peut encadrer
     * plusieurs catégories ; le rattachement est un geste explicite).
     *
     * `personnes` ayant 0 policy RLS (acté v1.33), le SELECT client
     * est impossible -> lecture via RPC SECURITY DEFINER gardée
     * (sql/56 list_staff_disponibles), patron get_noms_personnes /
     * apercu_bascule. Filtre serveur = categorie_personne ILIKE
     * '%staff%' (LU à la source, 46 personnes ; cf. sql/56). Payload
     * RGPD minimal {personne_id, nom, prenom}, jamais les colonnes
     * sensibles de personnes.
     *
     * Doublons attendus (IDENT-DOUBLONS, non résolu ici) : BELKIS /
     * HELM / VOEGELI ont une fiche staff distincte -> 1 ligne staff
     * chacune ; RULFO = 1 fiche double-rôle -> 1 ligne. Relève
     * d'IDENT-SYS, hors périmètre.
     *
     * @returns {Promise<Array>} [{personne_id, nom, prenom}] trié
     *   nom/prenom ; [] si erreur (dégradation honnête, miroir
     *   listJoueursCategorieEntente).
     */
    async listStaffDisponibles(categorieId) {
      // v1.36 — param categorieId optionnel transmis à la RPC v2
      // (p_categorie_id). Fourni → staff de la catégorie (fonction active) ;
      // absent/null → tout le staff du club (inchangé).
      const { data, error } = await client.rpc('list_staff_disponibles', {
        p_categorie_id: categorieId || null
      });
      if (error) {
        console.error('MOM Hub: listStaffDisponibles()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      // Sortie alignée sur listJoueursCategorieEntente : objets plats
      // {personne_id, nom, prenom}. La RPC trie déjà (nom, prenom) ;
      // on normalise les NULL éventuels sans réordonner.
      return data.map(function (r) {
        return {
          personne_id: r.personne_id,
          nom:    r.nom || '',
          prenom: r.prenom || ''
        };
      });
    },

    /**
     * (v1.72) Pioche de la modale d'enrôlement — voie DÉDIÉE (option B,
     * FAIT FOI ENROLEMENT-REPARATION, gelé 03/07/2026). Ne renvoie QUE
     * les personnes ayant un rôle en attente (roles_en_attente) et pas
     * encore reliées (auth_personne) — c'est-à-dire celles que
     * l'administrateur ATTEND. Remplace listStaffDisponibles() dans la
     * modale : sa garde par rôle (retrofit u-admin) excluait les
     * comptes orphelins, précisément ceux que la modale sert
     * (œuf-et-poule, recette 03/07/2026). RGPD : un compte auto-inscrit
     * sans pré-attribution voit une liste VIDE. RPC sql_147
     * list_fiches_enrolables, SECURITY DEFINER, EXECUTE authenticated.
     *
     * @returns {Promise<Array>} [{personne_id, nom, prenom}] trié
     *   nom/prenom ; [] si erreur (dégradation honnête, miroir
     *   listStaffDisponibles).
     */
    async listFichesEnrolables() {
      const { data, error } = await client.rpc('list_fiches_enrolables');
      if (error) {
        console.error('MOM Hub: listFichesEnrolables()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      return data.map(function (r) {
        return {
          personne_id: r.personne_id,
          nom:    r.nom || '',
          prenom: r.prenom || ''
        };
      });
    },

    /**
     * REFONTE-ENROLEMENT (sql_194) — résolution email -> fiche(s).
     *
     * Renvoie les fiches dont l'email principal correspond EXACTEMENT à
     * l'adresse du compte connecté (auth.email()), en excluant les fiches
     * déjà reliées à un compte (option A). Remplace listFichesEnrolables()
     * comme pioche de la modale « Qui êtes-vous ? » :
     *   - 0 fiche  -> l'adresse ne correspond à aucune fiche (D1, refus poli).
     *   - 1 fiche  -> rattachement direct possible (D2-cas1).
     *   - N fiches -> désambiguïsation famille-email (D2-cas2).
     *
     * @returns {Promise<Array>} [{personne_id, nom, prenom}] trié
     *   nom/prenom ; [] si erreur (dégradation honnête, miroir
     *   listFichesEnrolables).
     */
    async listMesFichesParEmail() {
      const { data, error } = await client.rpc('list_mes_fiches_par_email');
      if (error) {
        console.error('MOM Hub: listMesFichesParEmail()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      return data.map(function (r) {
        return {
          personne_id: r.personne_id,
          nom:    r.nom || '',
          prenom: r.prenom || ''
        };
      });
    },

    // ============================================================
    // RAPPORTS DE MATCH — saisi (2e temps). Wrappers ADDITIFS v1.45.
    //   Backend C13-a (table rapports + RPC SECURITY DEFINER garde
    //   auth.uid()). Le saisi = verdict « à froid » de l'éducateur
    //   (bilan + statut provisoire/finalise). Le statut est une
    //   MENTION, jamais un cadenas (pt 52) : l'écriture du bilan
    //   marche quel que soit le statut. Le DÉDUIT (score/familles/
    //   fil) reste calculé 100% front depuis chronologie_suivi
    //   (socle pt 53), il ne passe PAS par ces wrappers.
    //   Sorties SQL préfixées out_ (anti-ambiguïté 42702) → on
    //   re-mappe en clés métier nues côté client.
    // ============================================================

    /**
     * Lit le rapport (saisi) d'un match. RPC get_rapport_match (C13-a).
     * Renvoie null si aucun rapport n'a encore été saisi (le front
     * traite alors un rapport vierge, statut implicite 'provisoire').
     * @param {string} evenementUuid  le MATCH (ou racine demain)
     * @returns {Promise<{ok:boolean, data?:object|null, error?:string}>}
     */
    async getRapportMatch(evenementUuid) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const { data, error } = await client.rpc('get_rapport_match', {
        p_evenement_uuid: evenementUuid
      });
      if (error) {
        console.error('MOM Hub: getRapportMatch()', error);
        return { ok: false, error: error.message || 'Erreur get_rapport_match' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : (data || null);
      return { ok: true, data: r ? _mapRapport(r) : null };
    },

    /**
     * Écrit / met à jour le saisi d'un rapport (upsert). Vaut pour les
     * TROIS niveaux : match, phase, tournoi — chacun est un evenements à
     * UUID propre, la RPC est la même (pt 55). Crée la ligne à la volée
     * si absente. Marche quel que soit le statut (mention, pas cadenas,
     * pt 52). RPC upsert_rapport_match (C13-a + C13-b).
     * @param {string} evenementUuid  le MATCH, la PHASE ou le TOURNOI
     * @param {string} bilan          texte libre (peut être '')
     * @param {object} [donnees]      saisi structuré (classement +
     *   aiguillage) pour phase/tournoi. Omis/undefined → non transmis :
     *   le SQL PRÉSERVE l'existant (COALESCE). Pour un match : laisser
     *   omis. Convention front : renvoyer l'objet structuré COMPLET
     *   courant à chaque upsert (pas de patch partiel).
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async upsertRapportMatch(evenementUuid, bilan, donnees) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const params = {
        p_evenement_uuid: evenementUuid,
        p_bilan:          (bilan === undefined ? null : bilan)
      };
      // n'envoie p_donnees QUE s'il est fourni (undefined → COALESCE SQL préserve)
      if (donnees !== undefined) { params.p_donnees = donnees; }
      const { data, error } = await client.rpc('upsert_rapport_match', params);
      if (error) {
        console.error('MOM Hub: upsertRapportMatch()', error);
        return { ok: false, error: error.message || 'Erreur upsert_rapport_match' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r ? _mapRapport(r) : null };
    },

    /**
     * Finalise le rapport (statut='finalise' + audit). N'empêche PAS
     * l'édition ultérieure ni l'export (mention, pt 52). Crée la
     * ligne à la volée si besoin. RPC finaliser_rapport (C13-a).
     * @param {string} evenementUuid  le MATCH
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async finaliserRapport(evenementUuid) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const { data, error } = await client.rpc('finaliser_rapport', {
        p_evenement_uuid: evenementUuid
      });
      if (error) {
        console.error('MOM Hub: finaliserRapport()', error);
        return { ok: false, error: error.message || 'Erreur finaliser_rapport' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r ? _mapRapport(r) : null };
    },

    /**
     * Rouvre le rapport (statut='provisoire', audit effacé). Le bilan
     * est CONSERVÉ (Rouvrir = enrichir, pt 52). Fail-loud côté SQL si
     * aucun rapport n'existe. RPC rouvrir_rapport (C13-a).
     * @param {string} evenementUuid  le MATCH
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async rouvrirRapport(evenementUuid) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const { data, error } = await client.rpc('rouvrir_rapport', {
        p_evenement_uuid: evenementUuid
      });
      if (error) {
        console.error('MOM Hub: rouvrirRapport()', error);
        return { ok: false, error: error.message || 'Erreur rouvrir_rapport' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r ? _mapRapport(r) : null };
    },

    // ============================================================
    // MODULE LOGISTIQUE — wrappers ADDITIFS v1.50.
    //   Backend : 4 tables neuves (ressources_logistiques,
    //   reservations_logistiques, reservations_recurrentes,
    //   demandes_bus) + 4 RPC validation gardées bureau|admin.
    //   SAISIE adossée B5 (RLS WITH CHECK puis_je_ecrire_categorie) :
    //   un référent ne réserve que pour sa catégorie. VALIDATION
    //   hors-B5, gardée bureau|admin (D1). Aucun wrapper existant
    //   touché ; lecture dégradée honnête ([] / {ok:false}).
    // ============================================================

    /**
     * Catalogue des ressources réservables (tuiles). Filtre optionnel
     * par type ('site'|'materiel') et sous_type ('minibus'|'veo'|'autre').
     * Lecture RLS : tout authentifié.
     * @param {string} [type]      'site' | 'materiel'
     * @param {string} [sousType]  'minibus' | 'veo' | 'autre'
     * @returns {Promise<Array>} ressources actives ; [] si erreur.
     */
    async listRessourcesLogistiques(type, sousType) {
      let q = client
        .from('ressources_logistiques')
        .select('id, code, type, site_id, libelle, sous_type, conducteur_requis, actif')
        .eq('actif', true);
      if (type)     q = q.eq('type', type);
      if (sousType) q = q.eq('sous_type', sousType);
      q = q.order('libelle', { ascending: true });
      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listRessourcesLogistiques()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Réservations simples. Filtres optionnels : ressourceId, statut,
     * date (exacte). Lecture RLS : tout authentifié.
     * @param {Object} [filtre] { ressourceId, statut, date }
     * @returns {Promise<Array>} réservations ; [] si erreur.
     */
    async listReservations(filtre) {
      const f = filtre || {};
      let q = client
        .from('reservations_logistiques')
        .select('*');
      if (f.ressourceId) q = q.eq('ressource_id', f.ressourceId);
      if (f.statut)      q = q.eq('statut', f.statut);
      if (f.date)        q = q.eq('date', f.date);
      q = q.order('date', { ascending: true })
           .order('heure_debut', { ascending: true });
      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listReservations()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Règles récurrentes. Filtres optionnels : ressourceId, statut,
     * activeOnly (true → active=true). Lecture RLS : tout authentifié.
     * @param {Object} [filtre] { ressourceId, statut, activeOnly }
     * @returns {Promise<Array>} règles ; [] si erreur.
     */
    async listRecurrences(filtre) {
      const f = filtre || {};
      let q = client
        .from('reservations_recurrentes')
        .select('*');
      if (f.ressourceId)  q = q.eq('ressource_id', f.ressourceId);
      if (f.statut)       q = q.eq('statut', f.statut);
      if (f.activeOnly)   q = q.eq('active', true);
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listRecurrences()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Demandes de bus. Filtres optionnels : statut, date. Lecture RLS :
     * tout authentifié.
     * @param {Object} [filtre] { statut, date }
     * @returns {Promise<Array>} demandes ; [] si erreur.
     */
    async listDemandesBus(filtre) {
      const f = filtre || {};
      let q = client
        .from('demandes_bus')
        .select('*');
      if (f.statut) q = q.eq('statut', f.statut);
      if (f.date)   q = q.eq('date', f.date);
      q = q.order('date', { ascending: true });
      const { data, error } = await q;
      if (error) {
        console.error('MOM Hub: listDemandesBus()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Crée une réservation simple (statut 'pending' par défaut côté SQL).
     * Soumis RLS B5-saisie : échoue si le référent n'est pas habilité
     * sur la catégorie (ou categorie_id null hors transverse).
     * @param {Object} payload { ressource_id, categorie_id?, categorie_ids?,
     *   responsable_personne_id, responsables_personne_ids?,
     *   date, heure_debut, heure_fin, motif? }
     *   (multi : tableaux uuid[] transmis tels quels, trigger T1 sql_156
     *   synchronise scalaire ↔ tableau ; policy B5 souple sur le tableau)
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async createReservation(payload) {
      if (!payload || !payload.ressource_id || !payload.responsable_personne_id
          || !payload.date || !payload.heure_debut || !payload.heure_fin) {
        return { ok: false, error: 'Champs requis manquants : ressource_id, responsable_personne_id, date, heure_debut, heure_fin' };
      }
      const { data, error } = await client
        .from('reservations_logistiques')
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: createReservation()', error);
        return { ok: false, error: error.message || 'Erreur INSERT reservations_logistiques' };
      }
      return { ok: true, data: data };
    },

    /**
     * Crée une règle récurrente (statut 'pending' par défaut côté SQL).
     * Soumis RLS B5-saisie. jours : int[] (0=Lundi .. 6=Dimanche).
     * @param {Object} payload { ressource_id, categorie_id?, categorie_ids?,
     *   responsable_personne_id, responsables_personne_ids?,
     *   freq, jours, heure_debut, heure_fin, date_fin, motif? }
     *   (multi : cf. createReservation)
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async createRecurrence(payload) {
      if (!payload || !payload.ressource_id || !payload.responsable_personne_id
          || !payload.freq || !payload.heure_debut || !payload.heure_fin
          || !payload.date_fin) {
        return { ok: false, error: 'Champs requis manquants : ressource_id, responsable_personne_id, freq, heure_debut, heure_fin, date_fin' };
      }
      const { data, error } = await client
        .from('reservations_recurrentes')
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: createRecurrence()', error);
        return { ok: false, error: error.message || 'Erreur INSERT reservations_recurrentes' };
      }
      return { ok: true, data: data };
    },

    /**
     * Crée une demande de bus (statut 'pending' par défaut côté SQL).
     * Soumis RLS B5-saisie. arrets aller/retour et delegations : tableaux JSON.
     * @param {Object} payload { categorie_id?, categorie_ids?,
     *   responsable_personne_id, responsables_personne_ids?, date,
     *   destination, ... arrets_aller, arrets_retour, delegations, totaux }
     *   (multi : cf. createReservation)
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async createDemandeBus(payload) {
      if (!payload || !payload.responsable_personne_id || !payload.date
          || !payload.destination) {
        return { ok: false, error: 'Champs requis manquants : responsable_personne_id, date, destination' };
      }
      const { data, error } = await client
        .from('demandes_bus')
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: createDemandeBus()', error);
        return { ok: false, error: error.message || 'Erreur INSERT demandes_bus' };
      }
      return { ok: true, data: data };
    },

    /**
     * Valide/refuse une réservation simple. RPC gardée bureau|admin.
     * @param {string} id  reservation_id
     * @param {string} decision  'approved' | 'rejected'
     * @param {string} [motifRefus]  conservé si rejected
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async validerReservation(id, decision, motifRefus) {
      if (!id || !decision) {
        return { ok: false, error: 'id et decision requis' };
      }
      const { data, error } = await client.rpc('valider_reservation', {
        p_reservation_id: id,
        p_decision: decision,
        p_motif_refus: motifRefus || null
      });
      if (error) {
        console.error('MOM Hub: validerReservation()', error);
        return { ok: false, error: error.message || 'Erreur valider_reservation' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Valide/refuse une règle récurrente. RPC gardée bureau|admin.
     * @param {string} id  recurrence_id
     * @param {string} decision  'approved' | 'rejected'
     * @param {string} [motifRefus]
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async validerRecurrence(id, decision, motifRefus) {
      if (!id || !decision) {
        return { ok: false, error: 'id et decision requis' };
      }
      const { data, error } = await client.rpc('valider_recurrence', {
        p_recurrence_id: id,
        p_decision: decision,
        p_motif_refus: motifRefus || null
      });
      if (error) {
        console.error('MOM Hub: validerRecurrence()', error);
        return { ok: false, error: error.message || 'Erreur valider_recurrence' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Suspend/réactive une règle récurrente. RPC gardée bureau|admin.
     * @param {string} id  recurrence_id
     * @param {boolean} active  true = réactiver, false = suspendre
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async setRecurrenceActive(id, active) {
      if (!id || typeof active !== 'boolean') {
        return { ok: false, error: 'id et active (boolean) requis' };
      }
      const { data, error } = await client.rpc('set_recurrence_active', {
        p_recurrence_id: id,
        p_active: active
      });
      if (error) {
        console.error('MOM Hub: setRecurrenceActive()', error);
        return { ok: false, error: error.message || 'Erreur set_recurrence_active' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Valide/refuse une demande de bus. RPC gardée bureau|admin.
     * @param {string} id  demande_id
     * @param {string} decision  'approved' | 'rejected'
     * @param {string} [motifRefus]
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async validerBus(id, decision, motifRefus) {
      if (!id || !decision) {
        return { ok: false, error: 'id et decision requis' };
      }
      const { data, error } = await client.rpc('valider_bus', {
        p_demande_id: id,
        p_decision: decision,
        p_motif_refus: motifRefus || null
      });
      if (error) {
        console.error('MOM Hub: validerBus()', error);
        return { ok: false, error: error.message || 'Erreur valider_bus' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    // ========================================================
    // CYCLE DE VIE DES RÉSERVATIONS (sql_152) — 6 wrappers
    // ADDITIFS (v1.74). RPC SECURITY DEFINER gardées bureau|admin
    // OU demandeur propriétaire ; toute modification repasse la
    // demande en 'pending' (B2) ; UPDATE DUR côté SQL : TOUJOURS
    // ré-émettre TOUS les champs (B7, recharger la ligne avant).
    // ========================================================

    /**
     * Modifie une réservation ponctuelle (repasse en 'pending').
     * UPDATE DUR : tous les champs métier requis (B7).
     * @param {string} id  reservation_id
     * @param {Object} payload { ressource_id, categorie_id, categorie_ids?,
     *   date, heure_debut, heure_fin, motif? }
     *   (categorie_ids uuid[] — null/absent : SQL dérive du scalaire, M4)
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async modifierReservation(id, payload) {
      if (!id || !payload || !payload.ressource_id || !payload.date
          || !payload.heure_debut || !payload.heure_fin) {
        return { ok: false, error: 'Champs requis manquants : id, ressource_id, date, heure_debut, heure_fin' };
      }
      const { data, error } = await client.rpc('modifier_reservation', {
        p_reservation_id: id,
        p_ressource_id: payload.ressource_id,
        p_categorie_id: payload.categorie_id || null,
        p_date: payload.date,
        p_heure_debut: payload.heure_debut,
        p_heure_fin: payload.heure_fin,
        p_motif: payload.motif || null,
        p_categorie_ids: (Array.isArray(payload.categorie_ids)
          && payload.categorie_ids.length)
          ? payload.categorie_ids : null
      });
      if (error) {
        console.error('MOM Hub: modifierReservation()', error);
        return { ok: false, error: error.message || 'Erreur modifier_reservation' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Modifie une règle récurrente (repasse en 'pending').
     * UPDATE DUR : tous les champs métier requis (B7), dont
     * date_debut (sql_151 — null = pas de borne basse).
     * @param {string} id  recurrence_id
     * @param {Object} payload { ressource_id, categorie_id, categorie_ids?,
     *   freq, jours, heure_debut, heure_fin, date_debut?, date_fin, motif? }
     *   (categorie_ids uuid[] — null/absent : SQL dérive du scalaire, M4)
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async modifierRecurrence(id, payload) {
      if (!id || !payload || !payload.ressource_id || !payload.freq
          || !Array.isArray(payload.jours) || !payload.heure_debut
          || !payload.heure_fin || !payload.date_fin) {
        return { ok: false, error: 'Champs requis manquants : id, ressource_id, freq, jours[], heure_debut, heure_fin, date_fin' };
      }
      const { data, error } = await client.rpc('modifier_recurrence', {
        p_recurrence_id: id,
        p_ressource_id: payload.ressource_id,
        p_categorie_id: payload.categorie_id || null,
        p_freq: payload.freq,
        p_jours: payload.jours,
        p_heure_debut: payload.heure_debut,
        p_heure_fin: payload.heure_fin,
        p_date_debut: payload.date_debut || null,
        p_date_fin: payload.date_fin,
        p_motif: payload.motif || null,
        p_categorie_ids: (Array.isArray(payload.categorie_ids)
          && payload.categorie_ids.length)
          ? payload.categorie_ids : null
      });
      if (error) {
        console.error('MOM Hub: modifierRecurrence()', error);
        return { ok: false, error: error.message || 'Erreur modifier_recurrence' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Modifie une demande de bus (repasse en 'pending').
     * UPDATE DUR : tous les champs métier requis (B7), jsonb compris.
     * responsable_personne_id IMMUABLE (hors périmètre v1).
     * @param {string} id  demande_id
     * @param {Object} payload { categorie_id, categorie_ids?, date,
     *   type_competition,
     *   destination, heure_arrivee_souhaitee, retour_depart,
     *   retour_arrivee, arrets_aller, arrets_retour, delegations,
     *   pax_joueurs, pax_staff, total_mom, total_deleg, total_bus,
     *   notes? }
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async modifierBus(id, payload) {
      if (!id || !payload || !payload.date || !payload.destination) {
        return { ok: false, error: 'Champs requis manquants : id, date, destination' };
      }
      const { data, error } = await client.rpc('modifier_bus', {
        p_demande_id: id,
        p_categorie_id: payload.categorie_id || null,
        p_date: payload.date,
        p_type_competition: payload.type_competition || null,
        p_destination: payload.destination,
        p_heure_arrivee_souhaitee: payload.heure_arrivee_souhaitee || null,
        p_retour_depart: payload.retour_depart || null,
        p_retour_arrivee: payload.retour_arrivee || null,
        p_arrets_aller: Array.isArray(payload.arrets_aller) ? payload.arrets_aller : [],
        p_arrets_retour: Array.isArray(payload.arrets_retour) ? payload.arrets_retour : [],
        p_delegations: Array.isArray(payload.delegations) ? payload.delegations : [],
        p_pax_joueurs: payload.pax_joueurs || 0,
        p_pax_staff: payload.pax_staff || 0,
        p_total_mom: payload.total_mom || 0,
        p_total_deleg: payload.total_deleg || 0,
        p_total_bus: payload.total_bus || 0,
        p_notes: payload.notes || null,
        p_categorie_ids: (Array.isArray(payload.categorie_ids)
          && payload.categorie_ids.length)
          ? payload.categorie_ids : null
      });
      if (error) {
        console.error('MOM Hub: modifierBus()', error);
        return { ok: false, error: error.message || 'Erreur modifier_bus' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Annule une réservation ponctuelle (statut 'cancelled', trace
     * conservée en base ; disparaît de toutes les surfaces).
     * @param {string} id  reservation_id
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async annulerReservation(id) {
      if (!id) {
        return { ok: false, error: 'id requis' };
      }
      const { data, error } = await client.rpc('annuler_reservation', {
        p_reservation_id: id
      });
      if (error) {
        console.error('MOM Hub: annulerReservation()', error);
        return { ok: false, error: error.message || 'Erreur annuler_reservation' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Annule une règle récurrente (statut 'cancelled' : ne projette
     * plus aucune occurrence ; distinct de la suspension active=false).
     * @param {string} id  recurrence_id
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async annulerRecurrence(id) {
      if (!id) {
        return { ok: false, error: 'id requis' };
      }
      const { data, error } = await client.rpc('annuler_recurrence', {
        p_recurrence_id: id
      });
      if (error) {
        console.error('MOM Hub: annulerRecurrence()', error);
        return { ok: false, error: error.message || 'Erreur annuler_recurrence' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Annule une demande de bus (statut 'cancelled').
     * @param {string} id  demande_id
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async annulerBus(id) {
      if (!id) {
        return { ok: false, error: 'id requis' };
      }
      const { data, error } = await client.rpc('annuler_bus', {
        p_demande_id: id
      });
      if (error) {
        console.error('MOM Hub: annulerBus()', error);
        return { ok: false, error: error.message || 'Erreur annuler_bus' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Exclut UNE occurrence d'une règle récurrente (sql_155, E1-E4) :
     * la date est ajoutée à dates_exclues, sautée par les 3 projections.
     * La règle ne repasse PAS en 'pending' (E3, dérogation tracée à B2).
     * @param {string} id  recurrence_id
     * @param {string} date  'YYYY-MM-DD' (dans les bornes de la règle)
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async exclureOccurrence(id, date) {
      if (!id || !date) {
        return { ok: false, error: 'id et date requis' };
      }
      const { data, error } = await client.rpc('exclure_occurrence', {
        p_recurrence_id: id,
        p_date: date
      });
      if (error) {
        console.error('MOM Hub: exclureOccurrence()', error);
        return { ok: false, error: error.message || 'Erreur exclure_occurrence' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    /**
     * Réinclut une date précédemment exclue (sql_155, E5) : la date
     * est retirée de dates_exclues, l'occurrence réapparaît partout.
     * @param {string} id  recurrence_id
     * @param {string} date  'YYYY-MM-DD' (doit figurer dans dates_exclues)
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async reinclureOccurrence(id, date) {
      if (!id || !date) {
        return { ok: false, error: 'id et date requis' };
      }
      const { data, error } = await client.rpc('reinclure_occurrence', {
        p_recurrence_id: id,
        p_date: date
      });
      if (error) {
        console.error('MOM Hub: reinclureOccurrence()', error);
        return { ok: false, error: error.message || 'Erreur reinclure_occurrence' };
      }
      const r = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: r };
    },

    // ========================================================
    // PLANIFICATION ANNUELLE (sql/73) — 5 wrappers ADDITIFS
    // ========================================================

    /**
     * Pôles autorisés pour la personne connectée, via la RPC
     * mes_poles_autorises() (sql/73, jumelle de mes_categories_
     * autorisees). transverse admin|bureau ⇒ [{pole_id:null,
     * est_transverse:true}] ; référent ⇒ N {pole_id, est_transverse:
     * false} dérivés de fonction_staff active ; sinon ⇒ [].
     * Forme de retour non sondable hors session (RPC gardée) →
     * champs confirmés en recette en-app.
     *
     * @returns {Promise<Array>} [{pole_id, est_transverse}] ; [] si
     *   erreur / hors session (dégradation honnête).
     */
    async mesPolesAutorises() {
      const { data, error } = await client.rpc('mes_poles_autorises');
      if (error) {
        console.error('MOM Hub: mesPolesAutorises() / mes_poles_autorises', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Pôles dont la personne connectée est RESPONSABLE DÉSIGNÉ (responsable
     * principal OU co-responsable), via la RPC mes_poles_responsable()
     * (préexistante : qui_suis_je → personne_id confronté à
     * poles.responsable_principal_id / co_responsable_id). DISTINCT de
     * mesPolesAutorises() : ne remonte PAS les pôles dérivés des catégories
     * d'encadrement, seulement la responsabilité désignée (critère (a)).
     * Adossé à la RLS d'écriture pôle de planification_blocs (sql_106) :
     * c'est le périmètre d'ÉDITION réel d'une trame de pôle pour un
     * non-admin/bureau. La RLS reste l'arbitre ; ce wrapper sert au front
     * à refléter le droit (jamais à l'accorder).
     *
     * @returns {Promise<Array>} [{pole_id}] ; [] si erreur / hors session
     *   (dégradation honnête).
     */
    async mesPolesResponsable() {
      const { data, error } = await client.rpc('mes_poles_responsable');
      if (error) {
        console.error('MOM Hub: mesPolesResponsable() / mes_poles_responsable', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Référentiel des axes de planification (sql/73). Lecture ouverte
     * aux authentifiés (RLS planification_axes_select). Renvoie les
     * axes actifs, communs (categorie_id NULL) en v1, triés par type
     * puis ordre. Le client regroupe par type_axe pour les pioches.
     *
     * @returns {Promise<Array>} [{id,type_axe,libelle,ordre,categorie_id,actif}]
     *   ; [] si erreur (dégradation honnête).
     */
    async listPlanificationAxes() {
      const { data, error } = await client
        .from('planification_axes')
        .select('*')
        .eq('actif', true)
        .order('type_axe', { ascending: true })
        .order('ordre', { ascending: true });
      if (error) {
        console.error('MOM Hub: listPlanificationAxes()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Blocs de planification d'une saison, filtrés par portée :
     * soit une catégorie (categorieId), soit un pôle (poleId).
     * La RLS planification_blocs_select fait foi sur ce que la
     * personne a le droit de voir (catégorie autorisée / pôle de
     * son périmètre ou transverse). Triés par ordre.
     *
     * @param {{saisonId:string, categorieId?:string, poleId?:string}} opts
     * @returns {Promise<Array>} blocs ; [] si erreur ou paramètres absents.
     */
    async listPlanificationBlocs(opts) {
      const o = opts || {};
      if (!o.saisonId || (!o.categorieId && !o.poleId)) {
        console.error('MOM Hub: listPlanificationBlocs() requiert saisonId + (categorieId | poleId)');
        return [];
      }
      let q = client
        .from('planification_blocs')
        .select('*')
        .eq('saison_id', o.saisonId);
      if (o.poleId) {
        q = q.eq('pole_id', o.poleId);
      } else {
        q = q.eq('categorie_id', o.categorieId);
      }
      const { data, error } = await q.order('ordre', { ascending: true });
      if (error) {
        console.error('MOM Hub: listPlanificationBlocs()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Crée ou met à jour un bloc de planification (upsert par id).
     * L'écriture est soumise aux policies RLS planification_blocs
     * (pôle ⇒ admin|bureau ; catégorie ⇒ puis_je_ecrire_categorie).
     * Le payload doit porter EXACTEMENT une portée (categorie_id XOR
     * pole_id) — la CHECK planification_blocs_portee_chk le garantit
     * côté base. Renvoie le bloc persisté.
     *
     * @param {object} payload champs de planification_blocs
     * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
     */
    async savePlanificationBloc(payload) {
      if (!payload || !payload.saison_id) {
        return { ok: false, error: 'saison_id requis' };
      }
      const { data, error } = await client
        .from('planification_blocs')
        .upsert(payload)
        .select()
        .single();
      if (error) {
        console.error('MOM Hub: savePlanificationBloc()', error);
        return { ok: false, error: error.message || 'Erreur enregistrement bloc' };
      }
      return { ok: true, data: data };
    },

    /**
     * Supprime un bloc de planification par id. Soumis à la policy
     * RLS planification_blocs_delete (même garde que l'écriture).
     *
     * @param {string} id UUID du bloc
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async deletePlanificationBloc(id) {
      if (!id) {
        return { ok: false, error: 'id requis' };
      }
      const { error } = await client
        .from('planification_blocs')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('MOM Hub: deletePlanificationBloc()', error);
        return { ok: false, error: error.message || 'Erreur suppression bloc' };
      }
      return { ok: true };
    },

    /**
     * Voie 2 — modèle rôles encadrants S1 (lot 6). Prédicat d'affichage :
     * la personne connectée peut-elle réaliser <action> sur la catégorie
     * <categorieId> ? Délègue à la RPC B5 puis_je_faire(action, cat) (sql_88,
     * déjà en base) qui applique transverse admin/bureau + porte referent +
     * Union des capabilities de fonction. Sert à masquer les boutons d'action
     * (ex. cacher « valider » à l'adjoint sur compositions.html).
     *
     * Dégradation honnête / fail-safe : toute erreur, valeur non booléenne ou
     * absence de session renvoie false (on CACHE l'action plutôt que de la
     * montrer à tort — c'est un contrôle d'autorisation côté UI, l'écriture
     * reste de toute façon bornée par les policies RLS en base).
     *
     * @param {string} action  une des 6 actions de la matrice (ex. 'valider_compo',
     *   'ecrire_seance', 'ecrire_compo', 'gerer_presences', 'gerer_evenements',
     *   'composer_effectif')
     * @param {string} categorieId UUID de la catégorie concernée
     * @returns {Promise<boolean>} true ssi autorisé ; false sinon (fail-safe)
     */
    async puisJeFaire(action, categorieId) {
      if (!action || !categorieId) {
        return false;
      }
      const { data, error } = await client.rpc('puis_je_faire', {
        p_action: action,
        p_categorie_id: categorieId
      });
      if (error) {
        console.error('MOM Hub: puisJeFaire() / puis_je_faire', error);
        return false;
      }
      return data === true;
    },

    /**
     * (DASHBOARD-TUILES-PAR-CAPABILITY) Le compte courant est-il un salarié
     * du club AUJOURD'HUI ? Délègue à la RPC suis_je_salarie() (sql_122),
     * adossée à contrats_salaries (contrat COURANT : actif + fenêtre couvrant
     * le jour), même logique que list_salaries() restreinte à qui_suis_je().
     * Sert la PORTE du dashboard élargi + la visibilité de la tuile
     * « Suivi du salarié ». Fail-safe : false sur erreur (n'ouvre jamais par
     * défaut). N'accorde aucun droit — la garde SQL des pages-cibles reste la
     * vérité.
     *
     * @returns {Promise<boolean>} true si contrat salarié courant, sinon false.
     */
    async suisJeSalarie() {
      const { data, error } = await client.rpc('suis_je_salarie');
      if (error) {
        console.error('MOM Hub: suisJeSalarie() / suis_je_salarie', error);
        return false;
      }
      return data === true;
    },

    /**
     * Voie 2 — modèle rôles encadrants S1 (lot 5/6). Valide une
     * composition via la RPC dédiée valider_composition(p_id) (sql_91) :
     * transition brouillon→validee gardée par la capability valider_compo.
     * SEULE voie d'écriture du statut conforme au modèle S1 — remplace
     * l'UPDATE direct validateCompo pour la validation (FAITFOI §4.4).
     *
     * @param {string} compoId UUID de la composition
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     *   data = {id, etat} de la compo mutée ; error = message serveur
     *   (droit insuffisant / transition illégale / introuvable).
     */
    async validerComposition(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client.rpc('valider_composition', {
        p_id: compoId
      });
      if (error) {
        console.error('MOM Hub: validerComposition() / valider_composition', error);
        return { ok: false, error: error.message || 'Erreur validation' };
      }
      // RPC RETURNS TABLE(out_id, out_etat) → tableau d'1 ligne.
      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, data: row ? { id: row.out_id, etat: row.out_etat } : null };
    },

    /**
     * Voie 2 — modèle rôles encadrants S1 (lot 6b). Renvoie le LIBELLÉ
     * BRUT de la fonction_staff active la plus élevée de la personne
     * connectée (RPC self-only ma_fonction_staff, sql_92). Sert à la
     * topbar : afficher la vraie fonction (« Entraîneur adjoint ») plutôt
     * que le rôle brut « referent » (bug pt 88).
     *
     * @returns {Promise<?string>} libellé brut ; null si aucune fonction
     *   active, compte non relié, hors session ou erreur (dégradation honnête).
     */
    async maFonctionStaff() {
      const { data, error } = await client.rpc('ma_fonction_staff');
      if (error) {
        console.error('MOM Hub: maFonctionStaff() / ma_fonction_staff', error);
        return null;
      }
      return (typeof data === 'string' && data) ? data : null;
    },

    /**
     * PORTAIL-MULTI-PERIMETRE (Lot 1, v1.73) — contexte staff complet de la
     * personne connectée : fonction active + catégorie associée. Adossé à la
     * RPC self-only mon_contexte_staff() (sql_149), dont l'ORDER BY est
     * IDENTIQUE à ma_fonction_staff (sql_92) : la fonction élue ici est
     * toujours celle affichée par la topbar et le greeting (invariant de
     * cohérence — ne modifier l'une des deux RPC sans l'autre).
     *
     * Sert la section 02 du portail (« Mon équipe — <libelle_court> ») :
     * l'appelant ne révèle la section que si categorie_libelle_court est
     * non-null (fonction transverse sans catégorie → section masquée).
     *
     * @returns {Promise<?{fonction: string, categorie_id: ?string,
     *   categorie_code: ?string, categorie_libelle_court: ?string}>}
     *   null si aucune fonction active, compte non relié, hors session ou
     *   erreur (dégradation honnête : section masquée, jamais de mensonge).
     */
    async monContexteStaff() {
      const { data, error } = await client.rpc('mon_contexte_staff');
      if (error) {
        console.error('MOM Hub: monContexteStaff() / mon_contexte_staff', error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return (row && row.fonction) ? row : null;
    },

    // ============================================================
    // SOCLE MULTI-CATÉGORIES (v1.59) — UX-MULTI-CATEGORIES Lot 2
    // ============================================================
    // Résout, pour le compte connecté, le PÉRIMÈTRE de catégories sur
    // lequel il a le droit d'agir, prêt à alimenter un sélecteur de
    // catégorie active dans les écrans catégorie-portés (Évènements,
    // Séance, Compositions, Joueurs, Dashboard, Pilotage).
    //
    // Pourquoi ce helper central : les écrans étaient verrouillés sur
    // une équipe M14 EN DUR (M14_TEAM_UUID) → un encadrant multi-
    // catégories (ex. Lohann : EDR + SENIORS = 8 catégories) ne voyait
    // que M14. La RPC mes_categories_autorisees() renvoyait DÉJÀ le bon
    // périmètre ; aucun écran ne l'interrogeait. Ce socle factorise la
    // résolution une seule fois (DRY) pour les 6 écrans à recâbler.
    //
    // Forme de retour de mes_categories_autorisees() (sondée à la source,
    // pg_get_functiondef) : RETURNS TABLE(categorie_id uuid, est_transverse
    // boolean). Donc :
    //   - admin/bureau → 1 ligne {categorie_id:null, est_transverse:true}
    //     = laissez-passer transverse → on charge TOUTES les catégories ;
    //   - encadrant / responsable de pôle → N lignes {categorie_id:<uuid>,
    //     est_transverse:false}, DOUBLONS possibles (Lohann : SR-M présent
    //     via pôle SENIORS ET via fonction_staff) → on dédoublonne par id ;
    //   - aucun droit → [] → périmètre vide (dégradation honnête côté UI).
    //
    // Les libellés (« M14 ») viennent de getCategories() (lecture directe
    // de la table, policy SELECT ouverte à tout authentifié) — PAS d'UUID
    // affiché à l'écran.
    //
    // Catégorie active : mémorisée dans localStorage (clé partagée entre
    // écrans, convention mom_hub.*). Au boot, si la valeur mémorisée est
    // hors du périmètre courant (périmètre changé, autre compte), on
    // retombe sur la 1re catégorie par ordre_tri. Persistance via
    // memoriserCategorieActive().
    //
    // @returns {Promise<{
    //   categories: Array<{id, code, libelle_court, ordre_tri}>,  // dédoublonné, trié
    //   transverse: boolean,        // true = admin/bureau (toutes catégories)
    //   active: string|null,        // id de la catégorie active (ou null si périmètre vide)
    //   vide: boolean               // true = aucun droit (UI : message honnête)
    // }>}
    async resoudrePerimetreCategories() {
      const VIDE = { categories: [], transverse: false, active: null, vide: true };
      let rows = [];
      try {
        rows = await this.mesCategoriesAutorisees();
      } catch (e) {
        console.error('MOM Hub: resoudrePerimetreCategories() / mesCategoriesAutorisees', e);
        return VIDE;
      }
      if (!Array.isArray(rows) || rows.length === 0) return VIDE;

      const transverse = rows.some(r => r && r.est_transverse === true);

      // Référentiel des catégories (libellés). Lecture directe de table,
      // déjà exposée par getCategories() (tri ordre_tri). Échec → on
      // dégrade honnêtement sur le périmètre vide plutôt que d'afficher
      // des UUID nus.
      let toutes = [];
      try {
        toutes = await this.getCategories();
      } catch (e) {
        console.error('MOM Hub: resoudrePerimetreCategories() / getCategories', e);
        return VIDE;
      }
      if (!Array.isArray(toutes) || toutes.length === 0) return VIDE;

      let categories;
      if (transverse) {
        // admin/bureau : toutes les catégories.
        categories = toutes.slice();
      } else {
        // encadrant / responsable de pôle : on garde les categorie_id du
        // périmètre, DÉDOUBLONNÉS, puis on résout leurs libellés.
        const idsPerimetre = new Set(
          rows.map(r => r && r.categorie_id).filter(Boolean)
        );
        categories = toutes.filter(c => idsPerimetre.has(c.id));
      }

      if (categories.length === 0) return VIDE;

      // Tri stable par ordre_tri (puis libellé), cohérent list_categories.
      categories.sort((a, b) => {
        const oa = (a.ordre_tri == null) ? 9999 : a.ordre_tri;
        const ob = (b.ordre_tri == null) ? 9999 : b.ordre_tri;
        if (oa !== ob) return oa - ob;
        return String(a.libelle_court || a.code || '').localeCompare(String(b.libelle_court || b.code || ''));
      });

      // Catégorie active : mémorisée si elle est dans le périmètre,
      // sinon la 1re par ordre_tri.
      const memorisee = this.lireCategorieActiveMemorisee();
      const active = (memorisee && categories.some(c => c.id === memorisee))
        ? memorisee
        : categories[0].id;

      return { categories, transverse, active, vide: false };
    },

    // Clé localStorage partagée entre écrans pour la catégorie active.
    _CLE_CATEGORIE_ACTIVE: 'mom_hub.categorie_active',

    lireCategorieActiveMemorisee() {
      try {
        return localStorage.getItem(this._CLE_CATEGORIE_ACTIVE) || null;
      } catch (e) {
        return null; // localStorage indisponible → pas de mémoire, repli 1re catégorie
      }
    },

    memoriserCategorieActive(categorieId) {
      if (!categorieId) return;
      try {
        localStorage.setItem(this._CLE_CATEGORIE_ACTIVE, String(categorieId));
      } catch (e) {
        /* honnête : pas de persistance, le choix vaut pour la session courante */
      }
    },

    /**
     * ÉCRITURE (admin) — Désigne le responsable principal (+ co-responsable
     * optionnel) d'un pôle. Adosse la RPC SECURITY DEFINER
     * definir_responsables_pole(p_pole_id, p_principal_id, p_co_id)
     * (sql_107), gardée has_role('admin') côté base — la RLS/garde fait
     * foi, ce wrapper ne fait que transmettre.
     *
     * Écrit poles.responsable_principal_id / poles.co_responsable_id (deux
     * colonnes existantes FK -> personnes(id)). Le pôle reste une DONNÉE :
     * AUCUN rôle auth_roles créé (décision D-A). C'est la surface admin qui
     * manquait pour (re)jouer la désignation faite jusqu'ici par UPDATE
     * direct (Lohann EDR/SENIORS, pts 95/102/104).
     *
     * @param {string}  poleId      UUID poles.id (requis)
     * @param {string}  principalId UUID personnes.id du responsable principal (requis)
     * @param {?string} coId        UUID personnes.id du co-responsable (optionnel ; null = aucun)
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     *   data = la ligne `poles` mise à jour. Dégradation honnête : ok:false
     *   + message si la RPC lève (garde admin, paramètre invalide, etc.).
     */
    async definirResponsablesPole(poleId, principalId, coId) {
      if (!poleId || !principalId) {
        return { ok: false, error: 'poleId et principalId requis' };
      }
      const { data, error } = await client.rpc('definir_responsables_pole', {
        p_pole_id:      poleId,
        p_principal_id: principalId,
        p_co_id:        coId || null
      });
      if (error) {
        console.error('MOM Hub: definirResponsablesPole() / definir_responsables_pole', error);
        return { ok: false, error: error.message || 'Erreur écriture responsables de pôle' };
      }
      return { ok: true, data: data };
    },

    // ============================================================
    // AGENDA-GOOGLE → SÉANCES (B-light, sens unique entrant) — v1.70
    // Pont iCal Google Agenda « Missions de Lohann » vers mission_seances.
    // Lecture .ics déposé manuellement, parsé en JS local côté page ;
    // ces 3 wrappers ne font que LIRE les missions/séances et ÉCRIRE une
    // séance ponctuelle confirmée. Aucun secret, aucun OAuth, aucun réseau
    // Google ici (cf. FAIT FOI 29/06/2026). OVAL-E (avec A).
    // ============================================================

    /**
     * Liste les missions d'un salarié (sélecteur de rattachement de l'import
     * iCal). Adossé à list_missions(p_saison_id, p_salarie_id, p_entite_id) :
     * on ne passe QUE p_salarie_id, les deux autres restent null (pas de
     * filtre saison/entité). RETURNS SETOF missions → toutes les colonnes,
     * dont code, libelle, date_debut, date_fin, lieu_libre, etat, statut.
     * Tri RPC : date_debut DESC.
     *
     * @param {string} salarieId UUID personnes.id du salarié (requis)
     * @returns {Promise<Array>} 0..N missions du salarié, [] si erreur/absent
     */
    async listMissionsSalarie(salarieId) {
      if (!salarieId) { console.error('MOM Hub: listMissionsSalarie() salarieId requis'); return []; }
      const { data, error } = await client.rpc('list_missions', {
        p_saison_id:  null,
        p_salarie_id: salarieId,
        p_entite_id:  null
      });
      if (error) { console.error('MOM Hub: listMissionsSalarie() / list_missions', error); return []; }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Liste les séances d'une mission. Adossé à list_mission_seances(p_mission_id)
     * (RETURNS SETOF mission_seances → inclut la colonne-pont gcal_uid ajoutée
     * par sql_134). Sert le PRÉ-CHECK anti-doublon de l'import iCal : on
     * collecte les gcal_uid déjà présents pour griser les créneaux connus.
     *
     * @param {string} missionId UUID missions.id (requis)
     * @returns {Promise<Array>} 0..N séances de la mission, [] si erreur/absent
     */
    async listMissionSeances(missionId) {
      if (!missionId) { console.error('MOM Hub: listMissionSeances() missionId requis'); return []; }
      const { data, error } = await client.rpc('list_mission_seances', {
        p_mission_id: missionId
      });
      if (error) { console.error('MOM Hub: listMissionSeances() / list_mission_seances', error); return []; }
      return Array.isArray(data) ? data : [];
    },

    /**
     * Crée une séance ponctuelle confirmée depuis un créneau iCal importé.
     * Adossé à creer_seance_ponctuelle (étendue par sql_134 avec p_gcal_uid
     * en 11e paramètre). Garde voie 3 : Lohann (salarié de la mission) est
     * autorisé ; pour un non-admin l'état est FORCÉ à 'realisee' (p_etat
     * laissé au défaut). gcal_uid persiste l'UID iCal (anti-doublon dur via
     * l'index unique partiel ux_mission_seances_gcal_uid).
     *
     * Tous les paramètres optionnels par défaut à null : on ne transmet que
     * ce que le créneau iCal fournit (date/heure/durée/lieu_libre/notes/uid).
     *
     * @param {Object} p
     * @param {string}  p.missionId    UUID mission rattachée (requis)
     * @param {string}  p.dateSeance   'YYYY-MM-DD' (heure locale Europe/Paris, requis)
     * @param {?string} [p.heureDebut] 'HH:MM' locale, ou null
     * @param {?number} [p.dureeMin]   durée en minutes, ou null
     * @param {?string} [p.lieuLibre]  LOCATION iCal, ou null
     * @param {?number} [p.heuresReelles] pré-rempli dureeMin/60, modifiable, ou null
     * @param {?string} [p.notes]      SUMMARY iCal (+ DESCRIPTION si pertinente), ou null
     * @param {?string} [p.gcalUid]    UID iCal source (clé anti-doublon), ou null
     * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
     *   data = la ligne mission_seances créée. ok:false + message si la RPC lève
     *   (garde voie 3, mission introuvable, doublon gcal_uid = contrainte unique).
     */
    async creerSeancePonctuelle(p) {
      p = p || {};
      if (!p.missionId || !p.dateSeance) {
        return { ok: false, error: 'missionId et dateSeance requis' };
      }
      const { data, error } = await client.rpc('creer_seance_ponctuelle', {
        p_mission_id:     p.missionId,
        p_date_seance:    p.dateSeance,
        p_heure_debut:    p.heureDebut    != null ? p.heureDebut    : null,
        p_duree_min:      p.dureeMin       != null ? p.dureeMin       : null,
        p_lieu_id:        null,
        p_lieu_libre:     p.lieuLibre      != null ? p.lieuLibre      : null,
        p_refacturable:   null,
        p_heures_reelles: p.heuresReelles  != null ? p.heuresReelles  : null,
        p_notes:          p.notes          != null ? p.notes          : null,
        p_gcal_uid:       p.gcalUid        != null ? p.gcalUid        : null
      });
      if (error) {
        console.error('MOM Hub: creerSeancePonctuelle() / creer_seance_ponctuelle', error);
        return { ok: false, error: error.message || 'Erreur création séance ponctuelle' };
      }
      return { ok: true, data: data };
    }

  };

  // Normalise une ligne RPC rapports (sorties out_*) en objet métier nu.
  // Tolère les deux conventions (out_ ou nom direct) par robustesse.
  function _mapRapport(r) {
    if (!r || typeof r !== 'object') return null;
    return {
      id:             r.out_id             !== undefined ? r.out_id             : r.id,
      evenement_uuid: r.out_evenement_uuid !== undefined ? r.out_evenement_uuid : r.evenement_uuid,
      bilan:          r.out_bilan          !== undefined ? r.out_bilan          : r.bilan,
      donnees:        r.out_donnees        !== undefined ? r.out_donnees        : r.donnees,
      statut:         r.out_statut         !== undefined ? r.out_statut         : r.statut,
      finalise_le:    r.out_finalise_le    !== undefined ? r.out_finalise_le    : r.finalise_le,
      finalise_par:   r.out_finalise_par   !== undefined ? r.out_finalise_par   : r.finalise_par,
      created_at:     r.out_created_at     !== undefined ? r.out_created_at     : r.created_at,
      updated_at:     r.out_updated_at     !== undefined ? r.out_updated_at     : r.updated_at
    };
  }

  // ============================================================
  // EXPOSITION GLOBALE
  // ============================================================
  global.SupabaseHub = SupabaseHub;

  // ============================================================
  // PROFIL TOPBAR DYNAMIQUE (v1.54) — helper central, 0 édition HTML
  // ------------------------------------------------------------
  // Les topbars des pages secondaires affichaient un profil EN DUR
  // (« Emmanuel Jung · Référent M14 » / « Administrateur »), visible à
  // tort pour un autre encadrant connecté (retour terrain Vivien, pt 88).
  // Ce helper remplit `.user-profile .user-name` / `.user-role` depuis la
  // session, sur TOUTE page chargeant ce client et portant ce markup
  // homogène — un seul mécanisme couvre les 14 pages.
  //
  // Affichage : « Prénom · Rôle » (rôle brut mappé). Dégradation honnête :
  //   - pas de session → on ne touche à rien (texte en dur conservé) ;
  //   - monPrenom() null (compte admin sans pont, ou non relié) → on
  //     conserve le nom en dur plutôt que d'afficher « null ».
  // ============================================================
  const _ROLE_LABELS = {
    admin:    'Administrateur',
    bureau:   'Bureau',
    encadrant: 'Encadrant'
    // Repli d'affichage seulement (admin/bureau sans fonction). Un encadrant
    // réel a une fonction_staff -> topbar via _FONCTION_LABELS (ma_fonction_staff).
  };
  // Priorité d'affichage si plusieurs rôles (le plus « élevé » d'abord).
  const _ROLE_PRIORITE = ['admin', 'bureau', 'encadrant'];
  // Voie 2 (lot 6b) — mapping libellé BRUT fonction_staff -> affichage court topbar.
  // Libellés bruts réels (sonde 6b-3). Libellé inattendu -> affiché tel quel.
  const _FONCTION_LABELS = {
    'Référent de catégorie': 'Référent',
    'Manager':               'Manager',
    'Entraîneur principal':  'Entr. principal',
    'Entraîneur adjoint':    'Adjoint'
  };

  // ------------------------------------------------------------
  // Initiales de la pastille (v1.58) — self-only, sans RPC nouvelle.
  // quiSuisJe() donne MON personne_id ; _resolveNoms([id]) renvoie
  // {nom, prenom} via get_noms_personnes (ouverte à tout authentifié
  // depuis sql_93). On compose prénom[0]+nom[0]. Renvoie null si non
  // résolu (compte non relié, Map vide) → l'appelant garde l'avatar en dur.
  // ------------------------------------------------------------
  async function _initialesDepuisProfil() {
    const pid = await SupabaseHub.quiSuisJe();
    if (!pid) return null;
    const map = await SupabaseHub._resolveNoms([pid]);
    const fiche = map && map.get ? map.get(pid) : null;
    if (!fiche) return null;
    const p = (fiche.prenom || '').trim();
    const n = (fiche.nom || '').trim();
    const ini = ((p ? p[0] : '') + (n ? n[0] : '')).toUpperCase();
    return ini || null;
  }

  async function _remplirProfilTopbar() {
    try {
      const profile = (typeof document !== 'undefined')
        ? document.querySelector('.user-profile')
        : null;
      if (!profile) return;
      const elNom  = profile.querySelector('.user-name');
      const elRole = profile.querySelector('.user-role');
      if (!elNom && !elRole) return;

      // Pas de session → ne rien changer (la topbar gère déjà l'anonyme).
      const session = await SupabaseHub.getSession();
      if (!session) return;

      // Prénom réel (self-only). Null si compte sans fiche → on garde le dur.
      let prenom = null;
      try { prenom = await SupabaseHub.monPrenom(); } catch (e) { /* honnête */ }
      if (prenom && elNom) elNom.textContent = prenom;

      // Pastille initiales (v1.58). La `.avatar` était figée « EJ » en dur
      // dans les 21 HTML → un autre encadrant voyait les initiales de Manu.
      // On dérive prénom[0]+nom[0] de la fiche reliée, self-only :
      // quiSuisJe() (mon personne_id) → _resolveNoms([id]) (get_noms_personnes,
      // ouverte à tout authentifié depuis sql_93). Dégradation honnête :
      // pas de fiche reliée / Map vide / aucune initiale → on NE touche PAS
      // l'avatar (le « EJ » en dur reste, pas de « ?? »).
      const elAvatar = profile.querySelector('.avatar');
      if (elAvatar) {
        try {
          const initiales = await _initialesDepuisProfil();
          if (initiales) elAvatar.textContent = initiales;
        } catch (e) { /* honnête : avatar en dur conservé */ }
      }

      // Libellé de fonction/rôle. Voie 2 (lot 6b) : on privilégie la
      // FONCTION réelle (ma_fonction_staff) quand elle existe — c'est elle
      // qui corrige le bug pt 88 (un adjoint a le rôle `referent` comme
      // jeton de voie, mais doit afficher « Adjoint », pas « Référent »).
      // Repli sur le rôle mappé si aucune fonction (admin/bureau sans
      // fonction, ou erreur) — comportement v1.54 conservé.
      let libelleRole = null;
      let fonctionBrute = null;
      try { fonctionBrute = await SupabaseHub.maFonctionStaff(); } catch (e) { /* honnête */ }
      if (fonctionBrute) {
        libelleRole = _FONCTION_LABELS[fonctionBrute] || fonctionBrute;
      } else {
        let roles = [];
        try { roles = await SupabaseHub.getMyRoles(); } catch (e) { roles = []; }
        const roleCle = _ROLE_PRIORITE.find(r => Array.isArray(roles) && roles.indexOf(r) !== -1);
        if (roleCle) libelleRole = _ROLE_LABELS[roleCle];
      }
      if (libelleRole && elRole) elRole.textContent = libelleRole;
    } catch (err) {
      console.warn('MOM Hub: remplissage profil topbar échoué', err);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _remplirProfilTopbar);
    } else {
      _remplirProfilTopbar();
    }
  }

  console.log(
    '%c🏉 MOM Hub · Supabase Client v1.77 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
