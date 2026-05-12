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
 * Version : 1.3 — mai 2026
 *   v1.0 : initial (référentiels publics + getDashboardStats)
 *   v1.1 : ajout auth Magic Link (requestMagicLink, getSession) — Phase 2.5.3
 *   v1.2 : requestMagicLink calcule explicitement emailRedirectTo
 *          (fix : supabase-js v2 utilise window.location.origin par défaut,
 *           pas la Site URL Supabase — d'où le redirect cassé sur les Pages
 *           hébergées dans un sous-chemin /mom-hub/).
 *   v1.3 : helpers de session pour pages sécurisées — Phase 2.5.4
 *          getMyRoles (cache mémoire), hasRole, isAdmin, requireAuth,
 *          onAuthChange ; signOut invalide le cache et redirige.
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
  // On utilise la bibliothèque officielle @supabase/supabase-js
  // qui doit être chargée AVANT ce fichier (via balise <script>).
  if (typeof supabase === 'undefined') {
    console.error(
      '❌ MOM Hub: la bibliothèque @supabase/supabase-js n\'est pas chargée. ' +
      'Ajoute <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script> AVANT supabase-client.js'
    );
    return;
  }

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Conserve la session dans le localStorage du navigateur
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true  // pour gérer les liens magiques retour
    }
  });

  // ============================================================
  // ÉTAT INTERNE — cache mémoire des rôles (Phase 2.5.4)
  // ============================================================
  // Cache des rôles de l'utilisateur courant. Vidé par signOut() et
  // par les événements SIGNED_OUT / SIGNED_IN (cf. onAuthChange).
  // null = pas encore résolu, [] = résolu et vide, ['admin', ...] = résolu.
  let _rolesCache = null;

  // ============================================================
  // API PUBLIQUE — fonctions utilitaires
  // ============================================================
  const SupabaseHub = {

    /**
     * Le client brut, pour usages avancés.
     */
    client: client,

    /**
     * Test de connectivité : renvoie OK si la connexion fonctionne,
     * KO sinon.
     */
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

    /**
     * Renvoie tous les pôles (5 lignes).
     */
    async getPoles() {
      const { data, error } = await client
        .from('poles')
        .select('*')
        .order('uuid_legacy');
      if (error) throw error;
      return data;
    },

    /**
     * Renvoie toutes les catégories (14 lignes), avec ordre de tri.
     */
    async getCategories() {
      const { data, error } = await client
        .from('categories')
        .select('*')
        .order('ordre_tri');
      if (error) throw error;
      return data;
    },

    /**
     * Renvoie tous les clubs (4 lignes).
     */
    async getClubs() {
      const { data, error } = await client
        .from('clubs')
        .select('*')
        .order('uuid_legacy');
      if (error) throw error;
      return data;
    },

    /**
     * Renvoie la saison active.
     */
    async getSaisonActive() {
      const { data, error } = await client
        .from('saisons')
        .select('*')
        .eq('est_active', true)
        .single();
      if (error) throw error;
      return data;
    },

    /**
     * Renvoie tous les postes (20 lignes).
     */
    async getPostes() {
      const { data, error } = await client
        .from('postes')
        .select('*')
        .order('numero_xv', { nullsFirst: false });
      if (error) throw error;
      return data;
    },

    // ----------------------------------------------------------
    // STATISTIQUES POUR LE DASHBOARD
    // ----------------------------------------------------------
    // Note : ces stats sont basées sur les référentiels publics
    // (poles, categories, clubs). Les stats nécessitant les fiches
    // Personne (323 personnes, etc.) passent par la RPC dédiée
    // get_dashboard_stats() (SECURITY DEFINER) exposée publiquement
    // pour les agrégats. cf. js/dashboard-stats.js

    /**
     * Renvoie un récap des chiffres clés disponibles publiquement.
     */
    async getDashboardStats() {
      try {
        const [poles, categories, clubs, postes, saison] = await Promise.all([
          this.getPoles(),
          this.getCategories(),
          this.getClubs(),
          this.getPostes(),
          this.getSaisonActive()
        ]);

        return {
          ok: true,
          nbPoles: poles.length,
          nbCategories: categories.length,
          nbClubs: clubs.length,
          nbPostes: postes.length,
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

    /**
     * Demande un Magic Link pour l'email fourni.
     *
     * Comportement :
     *   - Si l'email existe dans auth.users : envoi du lien de connexion
     *   - Sinon : crée un nouveau compte et envoi du lien (shouldCreateUser=true)
     *
     * Redirection après clic sur le lien :
     *   - Si `redirectTo` est fourni : utilisé tel quel.
     *   - Sinon : on calcule le DOSSIER PARENT de la page actuelle.
     *     Exemple : appel depuis https://manu-mom.github.io/mom-hub/login.html
     *               -> redirect vers https://manu-mom.github.io/mom-hub/
     *   - Le redirect doit être dans la whitelist Authentication > URL Configuration.
     *
     * ⚠️ Note historique : v1.1 ne passait pas emailRedirectTo, en supposant
     * que Supabase utiliserait la Site URL comme fallback. C'est faux :
     * supabase-js v2 utilise window.location.origin par défaut (juste l'origine,
     * sans chemin), ce qui casse pour les sites hébergés sur GitHub Pages
     * dans un sous-chemin /mom-hub/. v1.2 corrige.
     *
     * Rate limit Supabase free tier : 4 emails/heure.
     *
     * @param {string} email      - Adresse email cible (sera trim+lowercase).
     * @param {string} [redirectTo] - URL de retour explicite (optionnel).
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async requestMagicLink(email, redirectTo) {
      if (!email || typeof email !== 'string') {
        return { ok: false, error: 'Email manquant' };
      }
      const cleanEmail = email.trim().toLowerCase();
      // Validation très permissive (Supabase validera côté serveur de toute façon)
      if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
        return { ok: false, error: 'Email invalide' };
      }

      // Calcul de l'URL de retour
      let resolvedRedirect = redirectTo;
      if (!resolvedRedirect && typeof window !== 'undefined' && window.location) {
        // Dossier parent de la page courante (= remplace le dernier segment par '')
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

      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },

    /**
     * Renvoie la session Supabase en cours (token + user), ou null si
     * aucune session active.
     *
     * Préférer cette méthode à getCurrentUser() pour les checks de routing
     * (plus rapide, lit le storage local sans aller-retour réseau).
     *
     * @returns {Promise<object|null>}
     */
    async getSession() {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        console.error('MOM Hub: getSession() error', error);
        return null;
      }
      return session;
    },

    /**
     * Renvoie l'utilisateur connecté, ou null si non connecté.
     */
    async getCurrentUser() {
      const { data: { user } } = await client.auth.getUser();
      return user;
    },

    // ----------------------------------------------------------
    // SESSION & RÔLES — Phase 2.5.4
    // ----------------------------------------------------------

    /**
     * Renvoie les rôles de l'utilisateur courant (appelle la RPC get_my_roles
     * côté Supabase). Résultat mis en cache en mémoire pour la durée de vie
     * de la page (un seul appel réseau par chargement). Le cache est invalidé
     * par signOut() et par les événements SIGNED_OUT / SIGNED_IN.
     *
     * @returns {Promise<string[]>} Tableau de rôles (ex: ['admin']) ou [] si non connecté.
     */
    async getMyRoles() {
      if (_rolesCache !== null) {
        return _rolesCache;
      }
      const { data, error } = await client.rpc('get_my_roles');
      if (error) {
        console.error('MOM Hub: getMyRoles() error', error);
        return [];
      }
      _rolesCache = Array.isArray(data) ? data : [];
      return _rolesCache;
    },

    /**
     * True si l'utilisateur courant possède le rôle demandé.
     * @param {string} role - 'admin', 'coach' ou 'viewer'.
     */
    async hasRole(role) {
      const roles = await this.getMyRoles();
      return roles.includes(role);
    },

    /**
     * Raccourci pour hasRole('admin'). Utilisé par les pages sécurisées
     * pour des décisions UI rapides.
     */
    async isAdmin() {
      return this.hasRole('admin');
    },

    /**
     * Garde de page : vérifie qu'une session existe (et optionnellement
     * que l'utilisateur a un rôle requis). Sinon, redirige.
     *
     * Pattern d'usage (en TOUT premier dans le <script> d'une page sécurisée) :
     *
     *   document.body.classList.add('auth-pending');   // masque le contenu
     *   const ok = await SupabaseHub.requireAuth({ role: 'admin' });
     *   if (!ok) return;                                // redirect en cours
     *   document.body.classList.remove('auth-pending'); // révèle le contenu
     *
     * Avec côté CSS :
     *   body.auth-pending { visibility: hidden; }
     *
     * Comportement :
     *   - Pas de session : redirige vers loginUrl (défaut: 'login.html').
     *   - Session mais pas le bon rôle : redirige vers forbiddenUrl
     *     (défaut: la racine du Hub './').
     *   - OK : ne fait rien, renvoie true.
     *
     * @param {object}  [options]
     * @param {string}  [options.role]         - Rôle requis (ex: 'admin'). Optionnel.
     * @param {string}  [options.loginUrl]     - URL de redirection si non connecté.
     * @param {string}  [options.forbiddenUrl] - URL de redirection si mauvais rôle.
     * @returns {Promise<boolean>} true si l'accès est accordé, false si redirection en cours.
     */
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

    /**
     * Abonnement aux changements d'état de l'auth (SIGNED_IN, SIGNED_OUT,
     * TOKEN_REFRESHED, etc.). Le cache des rôles est automatiquement
     * invalidé sur SIGNED_OUT et SIGNED_IN avant que le callback ne soit
     * appelé.
     *
     * @param {(event: string, session: object|null) => void} callback
     * @returns {{ unsubscribe: () => void }} Un objet pour se désabonner.
     */
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

    /**
     * Déconnecte l'utilisateur, invalide le cache des rôles, et redirige
     * vers loginUrl (défaut: 'login.html').
     *
     * Si redirect=false, ne fait pas la redirection (utile pour des tests).
     *
     * @param {object}  [options]
     * @param {boolean} [options.redirect=true]
     * @param {string}  [options.loginUrl='login.html']
     */
    async signOut(options) {
      const opts = options || {};
      const redirect = opts.redirect !== false;
      const loginUrl = opts.loginUrl || 'login.html';

      _rolesCache = null;
      const { error } = await client.auth.signOut();
      if (error) {
        console.error('MOM Hub: signOut() error', error);
        // On redirige quand même : si la déconnexion serveur a échoué,
        // au moins l'utilisateur quitte la page.
      }
      if (redirect) {
        window.location.replace(loginUrl);
      }
      return !error;
    },


    // ============================================================
    // RPC PORTAIL (Phase 3.2) — KPI et sidebar du portail
    // ============================================================
    // Wrappers minces autour des 5 RPC définies dans
    // sql/05-rpc-portail.sql. Toutes retournent un nombre (ou null
    // pour la date). En cas d'erreur réseau / permissions, on loggue
    // et on retourne une valeur neutre (0 ou null) pour ne pas casser
    // le rendu du portail.

    /**
     * KPI K3 "CETTE SEMAINE" — fiches `personnes` créées dans les
     * 7 derniers jours glissants.
     * @returns {Promise<number>} entier ≥ 0, ou 0 si erreur
     */
    async countPersonnesCreatedLast7Days() {
      const { data, error } = await client.rpc('count_personnes_created_last_7_days');
      if (error) {
        console.error('MOM Hub: countPersonnesCreatedLast7Days() error', error);
        return 0;
      }
      return typeof data === 'number' ? data : 0;
    },

    /**
     * KPI K4 "SANS EMAIL" + sidebar Qualité des données — fiches
     * `personnes` sans email principal renseigné (NULL ou chaîne vide).
     * @returns {Promise<number>}
     */
    async countPersonnesWithoutEmail() {
      const { data, error } = await client.rpc('count_personnes_without_email');
      if (error) {
        console.error('MOM Hub: countPersonnesWithoutEmail() error', error);
        return 0;
      }
      return typeof data === 'number' ? data : 0;
    },

    /**
     * Sidebar Qualité des données — fiches `personnes` sans date
     * de naissance renseignée.
     * @returns {Promise<number>}
     */
    async countPersonnesWithoutBirthdate() {
      const { data, error } = await client.rpc('count_personnes_without_birthdate');
      if (error) {
        console.error('MOM Hub: countPersonnesWithoutBirthdate() error', error);
        return 0;
      }
      return typeof data === 'number' ? data : 0;
    },

    /**
     * Sidebar Qualité des données — fiches `personnes` dont
     * l'affiliation FFR expire entre aujourd'hui et J+90 jours.
     * Les affiliations déjà expirées ne sont PAS comptées.
     * @returns {Promise<number>}
     */
    async countPersonnesAffiliationExpiringWithin90Days() {
      const { data, error } = await client.rpc('count_personnes_affiliation_expiring_within_90_days');
      if (error) {
        console.error('MOM Hub: countPersonnesAffiliationExpiringWithin90Days() error', error);
        return 0;
      }
      return typeof data === 'number' ? data : 0;
    },

    /**
     * Sidebar carte 1 OVAL-E — date de la dernière modification
     * sur une fiche OVAL-E (source_creation ou modifie_par contient
     * 'OVAL-E').
     * @returns {Promise<string|null>} Date au format 'YYYY-MM-DD', ou null si aucune fiche OVAL-E
     */
    async getLastOvalESyncDate() {
      const { data, error } = await client.rpc('get_last_oval_e_sync_date');
      if (error) {
        console.error('MOM Hub: getLastOvalESyncDate() error', error);
        return null;
      }
      return data; // string YYYY-MM-DD ou null
    }

  };

  // ============================================================
  // EXPOSITION GLOBALE
  // ============================================================
  global.SupabaseHub = SupabaseHub;

  // Trace amicale dans la console
  console.log(
    '%c🏉 MOM Hub · Supabase Client v1.4 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);