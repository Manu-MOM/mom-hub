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
 * Version : 1.24 — mai 2026
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

    async getEvenementsAVenir(equipeId = null, joursAVenir = 30) {
      const { data, error } = await client.rpc('get_evenements_a_venir', {
        p_equipe_id: equipeId, p_jours_a_venir: joursAVenir
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
    async getEvenementsPasses(equipeId = null, joursPasses = 30, limit = 50) {
      const { data, error } = await client.rpc('get_evenements_passes', {
        p_equipe_id:    equipeId,
        p_jours_passes: joursPasses,
        p_limit:        limit
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
        'equipe_id', 'saison_id', 'format_de_jeu',
        'date_debut', 'date_fin', 'site_id',
        'organisateur_principal_id',
        'adversaire_nom', 'domicile_exterieur'
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

    async getVivierCompo(equipeId) {
      if (!equipeId) {
        console.error('MOM Hub: getVivierCompo() requiert un equipeId');
        return [];
      }
      const { data, error } = await client.rpc('get_vivier_compo', { p_equipe_id: equipeId });
      if (error) { console.error('MOM Hub: getVivierCompo()', error); return []; }
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
      if (!equipeId) {
        console.error('MOM Hub: listSeancesByEquipe() requiert un equipeId');
        return [];
      }
      const opts = options || {};

      let q = client
        .from('seances')
        .select('*')
        .eq('equipe_id', equipeId);

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
    async getSeancesAVenir(equipeId, joursAVenir) {
      if (!equipeId) {
        console.error('MOM Hub: getSeancesAVenir() requiert un equipeId');
        return [];
      }
      const jours = (joursAVenir === undefined || joursAVenir === null) ? 14 : joursAVenir;
      const { data, error } = await client.rpc('get_seances_a_venir', {
        p_equipe_id: equipeId,
        p_jours_a_venir: jours
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
      if (!params || !params.equipe_id) {
        return { ok: false, error: 'equipe_id requis' };
      }

      const isModele = !!params.est_modele;
      if (isModele && params.date_seance) {
        return { ok: false, error: 'Un modèle ne peut pas avoir de date_seance (CHECK SQL)' };
      }

      const payload = {
        equipe_id: params.equipe_id,
        est_modele: isModele,
        etat: params.etat || 'brouillon',
        duree_totale_min: params.duree_totale_min || 75
      };

      // Champs optionnels (seulement si fournis explicitement)
      const optionalKeys = [
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
    async listBrouillonsVides(equipeId) {
      if (!equipeId) {
        console.error('MOM Hub: listBrouillonsVides() requiert un equipeId');
        return [];
      }
      // Étape 1 : SELECT brouillons sans date_seance
      const { data: brouillons, error: e1 } = await client
        .from('seances')
        .select('id, created_at')
        .eq('equipe_id', equipeId)
        .eq('etat', 'brouillon')
        .eq('est_modele', false)
        .is('date_seance', null);
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
        'notes_bloc'
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
        'notes_bloc'
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
          date_debut, date_fin,
          personnes ( id, nom, prenom )
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
      return Array.isArray(data) ? data : [];
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
            id, role, statut, date_debut, date_fin, personne_id,
            personnes ( id, nom, prenom )
          )
        `)
        .eq('evenement_equipe_id', evenementEquipeId);
      if (error) {
        console.error('MOM Hub: listGroupeEngage()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
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
          id, evenement_id, evenement_equipe_id, cote, etat,
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
          )
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
      return {
        ok: true,
        data: {
          evenement_equipe: {
            id:            eq.id,
            evenement_id:  eq.evenement_id,
            equipe_id:     eq.equipe_id,
            format_de_jeu: eq.format_de_jeu,
            notes:         eq.notes
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
          equipes!inner ( id, entente_id ),
          personnes ( id, nom, prenom )
        `)
        .eq('equipes.entente_id', ententeId)
        .is('date_sortie', null);
      if (error) {
        console.error('MOM Hub: listJoueursCategorieEntente()', error);
        return [];
      }
      if (!Array.isArray(data)) return [];
      const seen = new Set();
      const out = [];
      data.forEach(function (row) {
        const pid = row && row.personne_id;
        if (!pid || seen.has(pid)) return;
        seen.add(pid);
        const p = row.personnes || {};
        out.push({ personne_id: pid, nom: p.nom || '', prenom: p.prenom || '' });
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
    }

  };

  // ============================================================
  // EXPOSITION GLOBALE
  // ============================================================
  global.SupabaseHub = SupabaseHub;

  console.log(
    '%c🏉 MOM Hub · Supabase Client v1.16 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
