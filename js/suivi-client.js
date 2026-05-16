/**
 * MOM Hub · Suivi Client
 * ======================
 *
 * Couche d'accès données DÉDIÉE au module Suivi de rencontre.
 * SÉPARÉE de supabase-client.js (SupabaseHub) par décision d'archi :
 * le Suivi est la première surface SANS login — le jeton porté dans
 * l'URL EST l'autorisation, pas une session SupabaseHub.
 *
 * USAGE — écran bénévole (sans login) :
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="js/suivi-client.js"></script>
 *   <script>
 *     const token = SuiviClient.getToken();           // lu depuis ?t=...
 *     SuiviClient.getChronologieRencontre(token)
 *       .then(lignes => console.log(lignes));
 *   </script>
 *
 * USAGE — écran coach (génération de lien) : charger AUSSI
 * supabase-client.js ; SuiviClient réutilise alors automatiquement
 * SupabaseHub.client (session coach authentifiée) pour les RPC
 * réservées au coach (generer_lien_ephemere).
 *
 * INVARIANTS DOCTRINAUX APPLIQUÉS (Conception-Portail-UI-Suivi.md) :
 *   I1 — aucun wrapper ne saisit un score. Le score est TOUJOURS
 *        un résultat calculé (consolider_score_rencontre lit, ne
 *        prend pas de score en entrée).
 *   I5 — ZÉRO état navigateur. Ce module ne met RIEN en localStorage /
 *        sessionStorage et ne cache aucun état de session. Tout se
 *        reconstruit depuis le Core via getChronologieRencontre.
 *        Le client de repli est créé avec persistSession:false.
 *   DS-1 — garde-fou (adverse→joueur NULL forcé ; notre+NULL OK) est
 *        porté par le BACKEND (RPC inserer_observable). Ce module ne
 *        le ré-implémente pas (frontière QUOI/COMMENT).
 *   PI-6 — la blessure est un constat : on passe p_est_blessure=true,
 *        le double effet (composition_joueurs.etat_joueur='blesse')
 *        est géré par le backend. Aucune logique de recomposition ici.
 *
 * VERROU CONNU (STATE 16/05, point 1) :
 *   chronologie_nom_court_personne renvoie NULL tant que le câblage
 *   Production sur la source nom RGPD-safe `personnes` n'est pas fait.
 *   → nom_court PEUT être NULL. L'ancre d'affichage est le NUMÉRO de
 *     maillot. Helper libelleJoueur() encapsule cette dégradation
 *     une seule fois pour tous les écrans (ne jamais casser l'écran).
 *
 * NOTE DE SÉCURITÉ :
 *   La clé anon est PUBLIQUE par design (mêmes valeurs que
 *   supabase-client.js). Elle n'autorise que les RPC SECURITY DEFINER
 *   du Suivi ; les tables chronologie_suivi / lien_suivi sont fermées
 *   (RLS + REVOKE). Le droit d'écrire est porté par le jeton 'saisie',
 *   validé côté serveur (valider_lien_suivi). Le jeton 'spectateur'
 *   ne peut que lire (sûr par construction).
 *
 * Version : 1.1 — mai 2026
 *   v1.0 : couche d'accès initiale. 7 wrappers C12 (signatures
 *          déployées vérifiées à la source, conv Production Suivi) :
 *          genererLienEphemere, getCompoReduiteRencontre,
 *          insererObservable, annulerObservable, corrigerObservable,
 *          getChronologieRencontre, consoliderScoreRencontre.
 *          + getToken() (lecture jeton URL) + libelleJoueur()
 *          (dégradation nom_court NULL → numéro). Réutilise
 *          SupabaseHub.client si présent, sinon client de repli
 *          léger (persistSession:false, I5).
 *   v1.1 : ajout chargerEtatInitial(token) pour le routage de boot
 *          (S-1.b). Les wrappers lecture renvoient [] aussi bien sur
 *          erreur que sur vide — insuffisant pour le routeur, qui
 *          doit distinguer jeton-absent / jeton-invalide /
 *          erreur-réseau / non-démarré / démarré. Cette méthode est
 *          le SEUL point qui tranche ces 5 issues + centralise
 *          l'heuristique « démarré = chronologie non vide ». Les 7
 *          wrappers v1.0 sont INCHANGÉS (signatures et retours
 *          identiques). Zéro état navigateur (I5).
 */
(function (global) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================
  // Mêmes valeurs que supabase-client.js. Dupliquées volontairement :
  // l'écran bénévole est SANS login et ne doit PAS charger les 70+
  // wrappers coach + la machinerie d'auth de supabase-client.js. Le
  // prix de ce découplage = 2 constantes (la clé anon est publique
  // par design, l'URL est stable). Honnête et assumé.
  const SUPABASE_URL = 'https://fvfqffxaiaoygqhjtxwr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2ZnFmZnhhaWFveWdxaGp0eHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjgyNzQsImV4cCI6MjA5NDAwNDI3NH0.1WgEmHTuI00CuKpWflvu5SqZ4ScoEpQgZ7ijJt5OQ00';

  // Nom du paramètre d'URL portant le jeton opaque (lien éphémère).
  // Convention front, isolée ici : si Manu veut un autre nom, c'est
  // l'unique endroit à changer. La CONSTRUCTION d'URL partageable
  // (quelle page) est volontairement différée au paquet S-5
  // (l'écran cible n'existe pas encore — pas de généralisation
  // prématurée, cohérent S-3.4.d / S-5.4).
  const TOKEN_PARAM = 't';

  // ============================================================
  // INITIALISATION
  // ============================================================
  if (typeof supabase === 'undefined') {
    console.error(
      '❌ MOM Hub Suivi: la bibliothèque @supabase/supabase-js n\'est pas chargée. ' +
      'Ajoute <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script> AVANT suivi-client.js'
    );
    return;
  }

  // Client de repli, créé À LA DEMANDE (lazy singleton). persistSession
  // false = I5 strict : aucune écriture localStorage par ce module.
  let _fallbackClient = null;

  /**
   * Renvoie le client Supabase à utiliser.
   * - Si supabase-client.js est chargé (écran coach) → réutilise
   *   SupabaseHub.client (session coach authentifiée préservée :
   *   indispensable pour generer_lien_ephemere, réservé authenticated).
   * - Sinon (écran bénévole, sans login) → client de repli léger,
   *   persistSession:false (I5 : zéro état navigateur).
   * @returns {Object} client supabase-js
   */
  function getClient() {
    if (global.SupabaseHub && global.SupabaseHub.client) {
      return global.SupabaseHub.client;
    }
    if (!_fallbackClient) {
      _fallbackClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,    // I5 : rien dans le navigateur
          autoRefreshToken: false,
          detectSessionInUrl: false // le ?t= n'est PAS un token Supabase
        }
      });
    }
    return _fallbackClient;
  }

  // ============================================================
  // API PUBLIQUE
  // ============================================================
  const SuiviClient = {

    // ----------------------------------------------------------
    // HELPERS (jeton URL + dégradation nom_court)
    // ----------------------------------------------------------

    /**
     * Lit le jeton opaque depuis l'URL courante (?t=...).
     * Le jeton EST l'autorisation de l'écran bénévole (pas de login).
     * @returns {string|null} le jeton, ou null si absent
     */
    getToken() {
      try {
        const params = new URLSearchParams(global.location.search);
        const t = params.get(TOKEN_PARAM);
        return (t && t.trim() !== '') ? t.trim() : null;
      } catch (err) {
        console.error('MOM Hub Suivi: getToken()', err);
        return null;
      }
    },

    /**
     * Libellé d'affichage d'un joueur, avec dégradation propre quand
     * nom_court est NULL (verrou Production non câblé — STATE point 1).
     * Règle unique, centralisée : l'ANCRE est le numéro de maillot,
     * toujours disponible ; le nom n'est qu'un filet de vérification.
     * Ne casse jamais l'écran, même si tout est NULL.
     *
     * @param {Object} row ligne de get_compo_reduite_rencontre ou
     *        get_chronologie_rencontre (champs numero_maillot, nom_court)
     * @returns {string} ex. "7 ROOS" · "7" (nom non câblé) · "?" (rien)
     */
    libelleJoueur(row) {
      if (!row) return '?';
      const num = (row.numero_maillot !== undefined && row.numero_maillot !== null)
        ? String(row.numero_maillot) : null;
      const nom = (row.nom_court && String(row.nom_court).trim() !== '')
        ? String(row.nom_court).trim() : null;
      if (num && nom) return num + ' ' + nom;
      if (num) return num;        // cas nominal tant que nom_court NULL
      if (nom) return nom;
      return '?';                 // aucun joueur identifié (cas D-7)
    },

    /**
     * Charge l'état initial pour le ROUTAGE DE BOOT (S-1.b).
     *
     * Pourquoi cette méthode existe : les wrappers de lecture
     * renvoient [] aussi bien sur erreur que sur vide (convention
     * v1.12 « lecture → défaut sûr »). Le routeur a besoin de
     * distinguer 5 issues — c'est le SEUL point qui le fait, et il
     * centralise l'heuristique « démarré = chronologie non vide »
     * (sémantique exacte du marqueur « coup d'envoi » finalisée en
     * S-1.d, dépend du référentiel observables). Zéro état
     * navigateur (I5) : aucune lecture/écriture de stockage.
     *
     * @param {string|null} token jeton lu via SuiviClient.getToken()
     * @returns {Promise<{statut:string, chronologie?:Array, error?:string}>}
     *   statut ∈
     *     'jeton-absent'   — pas de ?t= dans l'URL
     *     'jeton-invalide' — le backend rejette (lien invalide/expiré)
     *     'erreur-reseau'  — appel impossible (persona réseau instable)
     *     'non-demarre'    — jeton OK, 0 ligne → tampon (I4 verrouille
     *                        la saisie avant le sas)
     *     'demarre'        — jeton OK, ≥1 ligne → En cours / reprise
     *                        (split = S-5)
     */
    async chargerEtatInitial(token) {
      if (!token) {
        return { statut: 'jeton-absent' };
      }
      let resp;
      try {
        resp = await getClient().rpc('get_chronologie_rencontre', {
          p_token: token
        });
      } catch (e) {
        // L'appel n'a pas abouti (réseau coupé, CDN, etc.) — distinct
        // d'un rejet applicatif. Persona « réseau instable » : ce cas
        // doit être réessayable côté UI (≠ jeton-invalide).
        console.error('MOM Hub Suivi: chargerEtatInitial() réseau', e);
        return { statut: 'erreur-reseau', error: (e && e.message) || String(e) };
      }
      const data = resp ? resp.data : null;
      const error = resp ? resp.error : null;
      if (error) {
        // Le backend a répondu mais REJETTE : valider_lien_suivi a
        // levé (jeton inconnu, révoqué, expiré). Réessayer n'aide pas.
        console.error('MOM Hub Suivi: chargerEtatInitial() jeton', error);
        return { statut: 'jeton-invalide', error: error.message || 'Jeton refusé' };
      }
      const lignes = Array.isArray(data) ? data : [];
      // Heuristique de routage : 0 ligne ⇒ coup d'envoi pas encore
      // donné (I4 verrouille la saisie avant le sas) ⇒ tampon.
      // ≥1 ligne ⇒ match démarré ⇒ En cours / reprise (split S-5).
      return {
        statut: lignes.length === 0 ? 'non-demarre' : 'demarre',
        chronologie: lignes
      };
    },

    // ----------------------------------------------------------
    // C12-f · GÉNÉRATION DE LIEN (coach authentifié uniquement)
    // ----------------------------------------------------------

    /**
     * Crée un lien éphémère pour une rencontre (RPC generer_lien_ephemere).
     * RÉSERVÉ au coach authentifié (GRANT authenticated ; jamais anon).
     * Nécessite donc que supabase-client.js soit chargé et la session
     * coach active. PI-7 : le backend exige une compo 'validee' active
     * pour un lien 'saisie'. Relais (S-5.2.a) : régénérer un lien
     * 'saisie' révoque les liens 'saisie' actifs précédents.
     *
     * @param {string} evenementUuid  UUID de la rencontre
     * @param {string} role           'saisie' (écriture) | 'spectateur' (lecture seule)
     * @param {Object} [configChrono] pré-réglage chrono JSONB (DA-2 :
     *        stocké, NON interprété par le backend). null si non fourni.
     * @param {string} [duree='24:00:00'] durée de validité (INTERVAL
     *        Postgres : '24:00:00', '1 day', '02:00:00'…). Défaut
     *        FRONT (le backend ne fixe pas de défaut) ; expire_le
     *        renvoyé fait foi.
     * @param {string} [creePar]      identifiant du coach créateur
     *        (traçabilité). Recommandé.
     * @returns {Promise<{ok:boolean, data?:{token:string, role:string,
     *        expire_le:string}, error?:string}>}
     */
    async genererLienEphemere(evenementUuid, role, configChrono, duree, creePar) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      if (role !== 'saisie' && role !== 'spectateur') {
        return { ok: false, error: "role doit être 'saisie' ou 'spectateur'" };
      }
      const params = {
        p_evenement_uuid: evenementUuid,
        p_role: role,
        p_config_chrono: configChrono || null,
        p_duree: duree || '24:00:00',
        p_cree_par: creePar || null
      };
      const { data, error } = await getClient().rpc('generer_lien_ephemere', params);
      if (error) {
        console.error('MOM Hub Suivi: genererLienEphemere()', error);
        return { ok: false, error: error.message || 'Erreur generer_lien_ephemere' };
      }
      const row = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: row };
    },

    // ----------------------------------------------------------
    // C12-f · COMPO RÉDUITE (lien saisie OU spectateur)
    // ----------------------------------------------------------

    /**
     * Compo 'validee' active de la rencontre, en payload RGPD réduit
     * (RPC get_compo_reduite_rencontre). Sert : la grille joueurs
     * (S-3.1) et l'aperçu compo replié (S-4.1). nom_court PEUT être
     * NULL (verrou non câblé) → utiliser libelleJoueur() pour afficher.
     *
     * @param {string} token jeton du lien (saisie ou spectateur)
     * @returns {Promise<Array<{joueur_uuid, numero_maillot, poste_uuid,
     *          role, etat_joueur, nom_court}>>} [] si erreur/jeton absent
     */
    async getCompoReduiteRencontre(token) {
      if (!token) {
        console.error('MOM Hub Suivi: getCompoReduiteRencontre() requiert un token');
        return [];
      }
      const { data, error } = await getClient().rpc('get_compo_reduite_rencontre', {
        p_token: token
      });
      if (error) {
        console.error('MOM Hub Suivi: getCompoReduiteRencontre()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    // ----------------------------------------------------------
    // C12-c · ÉCRITURE : insérer / annuler / corriger
    // ----------------------------------------------------------

    /**
     * Insère 1 ligne chronologie = 1 tap (RPC inserer_observable).
     * Garde-fou DS-1 porté par le BACKEND (adverse→joueur forcé NULL ;
     * notre+NULL OK, cas D-7 « Équipe / je ne sais pas »). PI-6 : si
     * estBlessure=true, le backend déclenche le double effet
     * (composition_joueurs.etat_joueur='blesse') — AUCUNE recomposition
     * ici. Le score n'est JAMAIS saisi (I1) : il se déduit de
     * valeur_points via consoliderScoreRencontre.
     *
     * @param {string} token            jeton 'saisie'
     * @param {Object} obs              l'observable :
     *   @param {string} obs.observableId   ref référentiel ('obs-xxx')
     *   @param {string} obs.categorieObs   'A' | 'B'
     *   @param {number} obs.valeurPoints   points (essai=5, transfo=2…; 0 si non scorant)
     *   @param {string} obs.equipeConcernee 'notre' | 'adverse'
     *   @param {string} [obs.joueurUuid]   joueur (NULL si adverse OU cas D-7)
     *   @param {string} [obs.modeSaisie='normal'] 'normal' | 'expert'
     *   @param {number} [obs.minuteMatch]  minute de jeu
     *   @param {number} [obs.periode=1]    n° de période
     *   @param {string} [obs.saisiParRole='benevole'] 'benevole' | 'coach'
     *   @param {string} [obs.sourceSaisie='live'] 'live' | 'video' | 'correction'
     *   @param {string} [obs.timecodeVideo] position Veo (INTERVAL, Mode Vidéo)
     *   @param {boolean} [obs.estBlessure=false] true → double effet PI-6
     * @returns {Promise<{ok:boolean, data?:{id:string, horodatage:string}, error?:string}>}
     */
    async insererObservable(token, obs) {
      if (!token) {
        return { ok: false, error: 'Jeton de saisie manquant' };
      }
      if (!obs || typeof obs !== 'object') {
        return { ok: false, error: 'Observable manquant ou invalide' };
      }
      if (!obs.observableId || !obs.categorieObs || !obs.equipeConcernee) {
        return { ok: false, error: 'Champs requis manquants : observableId, categorieObs, equipeConcernee' };
      }
      // Construction des params : on n'envoie QUE ce qui est fourni,
      // les DEFAULT SQL s'appliquent au reste (doctrine champs optionnels).
      const params = {
        p_token: token,
        p_observable_id: obs.observableId,
        p_categorie_obs: obs.categorieObs,
        p_valeur_points: (typeof obs.valeurPoints === 'number') ? obs.valeurPoints : 0,
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
      if (obs.saisiParRole !== undefined) params.p_saisi_par_role = obs.saisiParRole;
      if (obs.sourceSaisie !== undefined) params.p_source_saisie = obs.sourceSaisie;
      if (obs.timecodeVideo !== undefined && obs.timecodeVideo !== null) {
        params.p_timecode_video = obs.timecodeVideo;
      }
      if (obs.estBlessure === true) params.p_est_blessure = true;

      const { data, error } = await getClient().rpc('inserer_observable', params);
      if (error) {
        console.error('MOM Hub Suivi: insererObservable()', error);
        return { ok: false, error: error.message || 'Erreur inserer_observable' };
      }
      const row = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: row };
    },

    /**
     * Annule une ligne (RPC annuler_observable) : met annule=TRUE,
     * JAMAIS de DELETE (la trace est conservée). Exclue du score
     * recalculé. Sert l'annulation universelle ET le « −1 » adverse
     * (S-3.4.b — c'est le même appel, l'UX en fait deux gestes).
     *
     * @param {string} token   jeton 'saisie'
     * @param {string} ligneId UUID de la ligne chronologie à annuler
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async annulerObservable(token, ligneId) {
      if (!token) {
        return { ok: false, error: 'Jeton de saisie manquant' };
      }
      if (!ligneId) {
        return { ok: false, error: 'ligneId manquant' };
      }
      const { error } = await getClient().rpc('annuler_observable', {
        p_token: token,
        p_ligne_id: ligneId
      });
      if (error) {
        console.error('MOM Hub Suivi: annulerObservable()', error);
        return { ok: false, error: error.message || 'Erreur annuler_observable' };
      }
      return { ok: true };
    },

    /**
     * Corrige l'attribution joueur d'une ligne (RPC corriger_observable) :
     * cas « mauvais numéro » (S-3.2) et ré-attribution Mode Vidéo de
     * l'essai « Équipe / je ne sais pas » (S-3.1.c → S-5.3.a). Met
     * corrigee_le horodaté côté serveur. Mutation directe, trace
     * conservée (jamais de perte).
     *
     * @param {string} token      jeton 'saisie'
     * @param {string} ligneId    UUID de la ligne à corriger
     * @param {string} joueurUuid nouveau joueur attribué (peut être
     *        null pour « désattribuer » si le backend l'accepte)
     * @returns {Promise<{ok:boolean, data?:any, error?:string}>}
     */
    async corrigerObservable(token, ligneId, joueurUuid) {
      if (!token) {
        return { ok: false, error: 'Jeton de saisie manquant' };
      }
      if (!ligneId) {
        return { ok: false, error: 'ligneId manquant' };
      }
      const { data, error } = await getClient().rpc('corriger_observable', {
        p_token: token,
        p_ligne_id: ligneId,
        p_joueur_uuid: (joueurUuid !== undefined ? joueurUuid : null)
      });
      if (error) {
        console.error('MOM Hub Suivi: corrigerObservable()', error);
        return { ok: false, error: error.message || 'Erreur corriger_observable' };
      }
      const row = Array.isArray(data) ? (data[0] || null) : (data || null);
      return { ok: true, data: row };
    },

    // ----------------------------------------------------------
    // C12-d · LECTURE : la chronologie de la rencontre
    // ----------------------------------------------------------

    /**
     * Le fil du match (RPC get_chronologie_rencontre). SEULE RPC de
     * lecture v1. Lecture autorisée aux DEUX rôles de jeton ('saisie'
     * ET 'spectateur'). Tri par horodatage (ordre de jeu). Payload
     * RGPD réduit ; nom_court PEUT être NULL (→ libelleJoueur()).
     *
     * C'est la source unique de reconstruction de l'état (I5) : score,
     * chrono, historique, mode, période se recalculent depuis ce
     * retour — JAMAIS depuis le navigateur. C'est ce qui rend le
     * relais / la reconnexion sans perte (S-5.2).
     *
     * @param {string} token jeton (saisie ou spectateur)
     * @param {boolean} [inclureAnnulees=false] true = vue « audit »
     *        (inclut les lignes annulées)
     * @returns {Promise<Array>} lignes chronologie (15 champs dont
     *          nom_court), [] si erreur/jeton absent
     */
    async getChronologieRencontre(token, inclureAnnulees) {
      if (!token) {
        console.error('MOM Hub Suivi: getChronologieRencontre() requiert un token');
        return [];
      }
      const params = { p_token: token };
      if (inclureAnnulees === true) params.p_inclure_annulees = true;
      const { data, error } = await getClient().rpc('get_chronologie_rencontre', params);
      if (error) {
        console.error('MOM Hub Suivi: getChronologieRencontre()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },

    // ----------------------------------------------------------
    // C12-e · SCORE CONSOLIDÉ (jamais saisi — I1)
    // ----------------------------------------------------------

    /**
     * Consolide le score (RPC consolider_score_rencontre) : somme
     * valeur_points PAR camp des lignes non annulées, puis photo dans
     * evenements.score_mom/score_adverse. Le score n'est JAMAIS saisi
     * (I1 / décision Q3) — cette fonction le LIT et le recopie.
     * Appelée : à la clôture (sas « Fin du match », S-4.2.a) et
     * ré-appelable après toute correction Mode Vidéo (S-5.3.b).
     *
     * Accès : jeton 'saisie' (clôture côté bénévole) OU coach
     * authentifié (re-consolidation Mode Vidéo) — passer token=null
     * dans ce dernier cas (supabase-client.js doit alors être chargé).
     *
     * @param {string} evenementUuid UUID de la rencontre
     * @param {string} [token]       jeton 'saisie' ; null/omis = coach
     * @returns {Promise<{ok:boolean, data?:{score_mom:number,
     *          score_adverse:number}, error?:string}>}
     */
    async consoliderScoreRencontre(evenementUuid, token) {
      if (!evenementUuid) {
        return { ok: false, error: 'evenementUuid manquant' };
      }
      const params = { p_evenement_uuid: evenementUuid };
      if (token) params.p_token = token;
      const { data, error } = await getClient().rpc('consolider_score_rencontre', params);
      if (error) {
        console.error('MOM Hub Suivi: consoliderScoreRencontre()', error);
        return { ok: false, error: error.message || 'Erreur consolider_score_rencontre' };
      }
      const row = Array.isArray(data) ? (data[0] || null) : data;
      return { ok: true, data: row };
    }

  };

  // ============================================================
  // EXPOSITION GLOBALE
  // ============================================================
  global.SuiviClient = SuiviClient;

  console.log(
    '%c🏉 MOM Hub · Suivi Client v1.1 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
