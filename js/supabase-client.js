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
 * Version : 1.8.2 — mai 2026
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
    }

  };

  // ============================================================
  // EXPOSITION GLOBALE
  // ============================================================
  global.SupabaseHub = SupabaseHub;

  console.log(
    '%c🏉 MOM Hub · Supabase Client v1.8.5 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
