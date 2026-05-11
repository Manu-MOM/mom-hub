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
 * Version : 1.2 — mai 2026
 *   v1.0 : initial (référentiels publics + getDashboardStats)
 *   v1.1 : ajout auth Magic Link (requestMagicLink, getSession) — Phase 2.5.3
 *   v1.2 : requestMagicLink calcule explicitement emailRedirectTo
 *          (fix : supabase-js v2 utilise window.location.origin par défaut,
 *           pas la Site URL Supabase — d'où le redirect cassé sur les Pages
 *           hébergées dans un sous-chemin /mom-hub/).
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

    /**
     * Déconnecte l'utilisateur.
     */
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return true;
    }
  };

  // ============================================================
  // EXPOSITION GLOBALE
  // ============================================================
  global.SupabaseHub = SupabaseHub;

  // Trace amicale dans la console
  console.log(
    '%c🏉 MOM Hub · Supabase Client v1.2 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
