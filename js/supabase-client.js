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
 * Version : 1.7 — mai 2026
 *   v1.0 : initial (référentiels publics + getDashboardStats)
 *   v1.1 : ajout auth Magic Link (requestMagicLink, getSession) — Phase 2.5.3
 *   v1.2 : requestMagicLink calcule explicitement emailRedirectTo
 *          (fix : supabase-js v2 utilise window.location.origin par défaut,
 *           pas la Site URL Supabase — d'où le redirect cassé sur les Pages
 *           hébergées dans un sous-chemin /mom-hub/).
 *   v1.3 : helpers de session pour pages sécurisées — Phase 2.5.4
 *          getMyRoles (cache mémoire), hasRole, isAdmin, requireAuth,
 *          onAuthChange ; signOut invalide le cache et redirige.
 *   v1.4 : (mise à jour interne sans nouveaux helpers — changelog rattrapé en v1.5)
 *   v1.5 : wrappers Phase 4.2.C pour les RPC événements —
 *          getEvenementsAVenir(equipeId, joursAVenir),
 *          getProchainEvenementParEquipe(equipeId).
 *   v1.6 : wrapper Phase 4.3 pour la RPC vivier — getVivierCompo(equipeId).
 *          Ferme la dette (o) du STATE.md.
 *   v1.7 : wrappers ÉCRITURE Phase 4.4 UI compositions —
 *          createCompo, duplicateCompoFromBase, addJoueurCompo,
 *          updateJoueurCompo, removeJoueurCompo, updateCompoNotes,
 *          validateCompo, unvalidateCompo, markCompoUtilisee,
 *          archiveCompo, listCompositionsByEquipe, getCompoComplete.
 *          Pattern : retour {ok, data, error} unifié pour gérer
 *          gracefully les erreurs RLS côté UI. Doctrine côté JS
 *          (pas de RPC dédiée) pour la duplication base→match :
 *          INSERT compo + INSERT batch joueurs en 2 appels,
 *          rollback manuel côté JS si la 2e requête échoue.
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
    // Permet aux callers (UI) un branchement simple :
    //   const r = await SupabaseHub.createCompo({...});
    //   if (!r.ok) { alert(r.error); return; }
    //   const compo = r.data;
    //
    // RLS write actives depuis sql/24-25-26 :
    //   - INSERT/UPDATE compositions, composition_joueurs : admin OU coach
    //   - DELETE compositions, composition_joueurs       : admin OU coach
    //   - Toutes les écritures requièrent une session authentifiée

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

      // Jointure compositions ← evenements (via FK evenement_id) pour
      // obtenir équipe_id et libellés. Filtre côté evenements.equipe_id
      // ne fonctionne pas en select() chaîné classique : on passe par
      // une jointure inner et on filtre via .eq() sur la colonne jointe.
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
      // 2 requêtes en parallèle : la compo elle-même et ses joueurs
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
     * Utilisé par E2 Modale Création quand l'utilisateur choisit "Compo vierge".
     *
     * @param {object} params
     * @param {string} params.evenement_id UUID de l'événement
     * @param {string} params.type_compo   'base' ou 'match'
     * @param {string} [params.compo_base_origine_id] UUID compo origine (si type='match' et dérivation)
     * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
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
     * avec rollback manuel si la 2e étape échoue. Pattern P1 simplicité
     * (pas de RPC dédiée tant que les volumes restent faibles).
     *
     * Utilisé par E2 quand l'utilisateur choisit "Dupliquer une compo"
     * ou par l'action "Créer la compo de match à partir de la base"
     * depuis E1/E3.
     *
     * @param {string} compoBaseId UUID de la compo source (type='base')
     * @param {string} evenementId UUID de l'événement cible (peut être identique
     *                             à celui de la base — cas normal d'un même match
     *                             — ou différent si rejouer une base sur un autre événement)
     * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
     *          data = { compo: <nouvelleCompo>, joueurs: [<lignesDupliquees>] }
     */
    async duplicateCompoFromBase(compoBaseId, evenementId) {
      if (!compoBaseId || !evenementId) {
        return { ok: false, error: 'compoBaseId et evenementId requis' };
      }

      // 1) Lecture de la compo source + ses joueurs
      const source = await this.getCompoComplete(compoBaseId);
      if (!source) {
        return { ok: false, error: 'Compo source introuvable' };
      }
      if (source.compo.type_compo !== 'base') {
        return { ok: false, error: 'La compo source doit être de type "base"' };
      }

      // 2) Création de la nouvelle compo de match
      const createRes = await this.createCompo({
        evenement_id: evenementId,
        type_compo: 'match',
        compo_base_origine_id: compoBaseId
      });
      if (!createRes.ok) return createRes;
      const newCompo = createRes.data;

      // 3) Duplication batch des joueurs : tous initialement etat_joueur='base'
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
          etat_joueur: 'base',  // ← tous en bleu au démarrage
          notes_joueur: null     // on ne reprend pas les notes individuelles
        };
      });

      const { data: insertedJoueurs, error: joueursErr } = await client
        .from('composition_joueurs')
        .insert(newJoueurs)
        .select();

      if (joueursErr) {
        // Rollback manuel : on tente de supprimer la compo créée à l'étape 2
        console.error('MOM Hub: duplicateCompoFromBase() joueurs error, rollback', joueursErr);
        await client.from('compositions').delete().eq('id', newCompo.id);
        return { ok: false, error: 'Échec duplication joueurs : ' + joueursErr.message };
      }

      return { ok: true, data: { compo: newCompo, joueurs: insertedJoueurs || [] } };
    },

    /**
     * Met à jour le champ notes_compo d'une compo (autosave de la textarea).
     *
     * @param {string} compoId UUID
     * @param {string} notes   Nouveau texte (peut être vide)
     * @returns {Promise<{ok, data?, error?}>}
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
     * Passe une compo de 'brouillon' à 'validee'. Le coach a explicitement
     * confirmé. Pastille d'état devient verte côté UI.
     *
     * @param {string} compoId UUID
     * @returns {Promise<{ok, data?, error?}>}
     */
    async validateCompo(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ etat: 'validee' })
        .eq('id', compoId)
        .eq('etat', 'brouillon')   // garde-fou : seul brouillon → validee autorisé ici
        .select()
        .single();
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
     * Repasse une compo de 'validee' à 'brouillon'. Accessible au coach
     * jusqu'au coup d'envoi (cf. doc Conception §5.5).
     *
     * @param {string} compoId UUID
     * @returns {Promise<{ok, data?, error?}>}
     */
    async unvalidateCompo(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ etat: 'brouillon' })
        .eq('id', compoId)
        .eq('etat', 'validee')     // garde-fou : seul validee → brouillon
        .select()
        .single();
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
     * Marque manuellement une compo comme 'utilisee' (verrouillage final V1).
     * À automatiser plus tard quand le module Suivi Match sera construit
     * (cf. doc Conception §5.5).
     *
     * @param {string} compoId UUID
     * @returns {Promise<{ok, data?, error?}>}
     */
    async markCompoUtilisee(compoId) {
      if (!compoId) return { ok: false, error: 'compoId requis' };
      const { data, error } = await client
        .from('compositions')
        .update({ etat: 'utilisee' })
        .eq('id', compoId)
        .eq('etat', 'validee')     // garde-fou : seul validee → utilisee
        .select()
        .single();
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
     * Conserve la traçabilité, retire du flux actif.
     *
     * @param {string} compoId UUID
     * @returns {Promise<{ok, data?, error?}>}
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
     * Utilisé après sélection dans le Popover Picker (E5).
     *
     * @param {object} params
     * @param {string} params.composition_id UUID de la compo
     * @param {string} params.joueur_id      UUID du joueur (FK personnes)
     * @param {string} params.poste_id       Code poste (postes.json, ex 'pst-001')
     * @param {string} [params.role='titulaire'] 'titulaire' | 'remplacant' | 'reserve'
     * @param {string} [params.etat_joueur='base'] 'base' | 'modifie' | 'independant' | 'blesse'
     * @param {number} [params.numero_maillot]   Optionnel
     * @param {number} [params.ordre_remplacement] Optionnel
     * @param {boolean} [params.est_depannage_hors_categorie=false]
     * @returns {Promise<{ok, data?, error?}>}
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
     * Met à jour une ligne composition_joueurs.
     * Champs autorisés : poste_id, role, numero_maillot, ordre_remplacement,
     * etat_joueur, est_depannage_hors_categorie, notes_joueur.
     *
     * @param {string} compoJoueurId UUID de la ligne
     * @param {object} patch         Objet partiel des champs à mettre à jour
     * @returns {Promise<{ok, data?, error?}>}
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
     * Wrapper sur updateJoueurCompo pour le cas d'usage le plus fréquent.
     *
     * @param {string} compoJoueurId UUID
     * @param {string} etat          'base' | 'modifie' | 'independant' | 'blesse'
     * @returns {Promise<{ok, data?, error?}>}
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
     *
     * @param {string} compoJoueurId UUID de la ligne
     * @returns {Promise<{ok, data?, error?}>}
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
    }

  };

  // ============================================================
  // EXPOSITION GLOBALE
  // ============================================================
  global.SupabaseHub = SupabaseHub;

  console.log(
    '%c🏉 MOM Hub · Supabase Client v1.7 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
