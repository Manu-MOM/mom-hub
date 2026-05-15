/**
 * MOM Hub · Évènements Browser
 * ============================================================
 * Logique du module Évènements (page evenements.html).
 *
 * Responsabilités :
 *   1. Charger les évènements à venir + passés de l'équipe M14 via RPC Supabase
 *   2. Rendre la vue Liste verticale chronologique (S2.2)
 *   3. Gérer les filtres TYPE + COMPÉTITION + recherche libre (S2.2)
 *   4. Gérer le mini-calendrier sidebar (S2.2)
 *   5. Gérer la fiche détaillée E2 (S2.3, modal ou page)
 *   6. Gérer les modales E3 Création / E4 Annulation / E5 Ajout match (S2.4)
 *
 * Architecture :
 *   - Module IIFE exposant window.EvenementsBrowser.init()
 *   - Suit le pattern bibliotheque-browser.js (Phase 4.4 Bibliothèque)
 *   - Préfixage CSS .evt-* dans evenements.html
 *
 * Dépendances :
 *   - SupabaseHub v1.9+ (RPC événements C9 : sql/29)
 *   - DOM : voir evenements.html (zone #evt-list, KPIs, filtres, modales)
 *
 * Version : 1.0 — S2.1 squelette init basique (15 mai 2026)
 */

(function () {
  'use strict';

  // ============================================================
  // 1. ÉTAT INTERNE DU MODULE
  // ============================================================

  // UUID de l'équipe M14 EQ1 (constante hardcodée V1, dette `(q) coach_equipes` quand multi-équipes)
  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  // Fenêtres de chargement par défaut (cf. arbitrage S2.0 #8)
  const FENETRE_JOURS_AVENIR  = 90;
  const FENETRE_JOURS_PASSES  = 30;
  const PASSES_LIMIT          = 50;

  // Clé localStorage pour les préférences utilisateur (arbitrage S2.0 #6)
  const STORAGE_KEY_PREFS = 'mom_hub.evenements.prefs';

  // Données chargées
  let EVENEMENTS_AVENIR = [];   // tableau d'événements à venir (RPC get_evenements_a_venir)
  let EVENEMENTS_PASSES = [];   // tableau d'événements passés (RPC get_evenements_passes)

  // État de l'UI (filtres, recherche, tri)
  const state = {
    typesActifs:   new Set(['all']),    // 'all' par défaut, ou sous-ensemble des 5 types
    competsActifs: new Set(['all']),    // 'all' par défaut, ou sous-ensemble des type_competition
    search:        '',                   // texte de recherche libre (insensible casse)
    showPassed:    true                  // afficher événements passés dans la liste (V1 oui)
  };

  // Libellés humains des types d'événements (alignés sur sql/10 CHECK contraintes)
  const TYPE_LABELS = {
    match:               'Match',
    entrainement:        'Entraînement',
    stage:               'Stage',
    tournoi:             'Tournoi',
    journee_championnat: 'Journée champ.'
  };

  // Couleurs sémantiques des types de compétition (cohérent doc Conception §6.1)
  // Les hex définitifs sont en CSS via .evt-chip.compet-*.active
  const COMPET_LABELS = {
    championnat: 'Championnat',
    coupe:       'Coupe',
    tournoi:     'Tournoi',
    amical:      'Amical'
  };

  // ============================================================
  // 2. CHARGEMENT DES DONNÉES
  // ============================================================

  /**
   * Charge les événements à venir de l'équipe M14 sur la fenêtre par défaut.
   * Appelle la RPC get_evenements_a_venir (Phase 4.4 backend, sql/29 v1.9).
   * @returns {Promise<Array>} Liste des événements (peut être vide, jamais null)
   */
  async function loadEvenementsAVenir() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsAVenir !== 'function') {
      throw new Error('SupabaseHub.getEvenementsAVenir indisponible (v1.9+ requis)');
    }
    const events = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, FENETRE_JOURS_AVENIR);
    return Array.isArray(events) ? events : [];
  }

  /**
   * Charge les événements passés de l'équipe M14 sur la fenêtre par défaut.
   * Appelle la RPC get_evenements_passes (Phase 4.4 backend, sql/29 v1.9).
   * @returns {Promise<Array>} Liste des événements (peut être vide, jamais null)
   */
  async function loadEvenementsPasses() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsPasses !== 'function') {
      throw new Error('SupabaseHub.getEvenementsPasses indisponible (v1.9+ requis)');
    }
    const events = await SupabaseHub.getEvenementsPasses(M14_TEAM_UUID, FENETRE_JOURS_PASSES, PASSES_LIMIT);
    return Array.isArray(events) ? events : [];
  }

  // ============================================================
  // 3. HELPERS GÉNÉRIQUES
  // ============================================================

  /** Échappement HTML défensif (sécurité XSS sur libellés issus de la DB) */
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /** Formate une date ISO en libellé fr court (« sam 23 mai · 14h00 ») */
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

  /** Récupère les préférences utilisateur depuis localStorage (filtres mémorisés) */
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

  /** Persiste les préférences utilisateur dans localStorage */
  function savePrefs() {
    try {
      const payload = {
        typesActifs:   Array.from(state.typesActifs),
        competsActifs: Array.from(state.competsActifs),
        showPassed:    state.showPassed
      };
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(payload));
    } catch (e) {
      console.warn('Évènements : prefs localStorage non persistées', e);
    }
  }

  /**
   * Test d'inclusion d'un événement dans les filtres actifs.
   * @param {Object} evt Événement (issu d'une RPC)
   * @returns {boolean} true si l'événement passe tous les filtres
   */
  function pass(evt) {
    // Filtre TYPE
    if (!state.typesActifs.has('all') && !state.typesActifs.has(evt.type_evenement)) return false;
    // Filtre COMPÉTITION (seulement si type_competition pertinent)
    if (!state.competsActifs.has('all') && evt.type_competition && !state.competsActifs.has(evt.type_competition)) return false;
    // Recherche libre
    if (state.search) {
      const s = state.search.toLowerCase();
      const libelle = (evt.libelle || '').toLowerCase();
      const adversaire = (evt.adversaire_nom || '').toLowerCase();
      if (libelle.indexOf(s) === -1 && adversaire.indexOf(s) === -1) return false;
    }
    return true;
  }

  // ============================================================
  // 4. RENDU LISTE (S2.2 fera le détail des cartes)
  // ============================================================

  /**
   * Rend la liste des évènements (zone #evt-list).
   * S2.1 : rendu minimaliste textuel pour valider que les données arrivent.
   * S2.2 : remplacera par les cartes complètes avec trait coloré, pastilles, etc.
   */
  function renderListe() {
    const list = document.getElementById('evt-list');
    if (!list) return;

    const filteredAvenir = EVENEMENTS_AVENIR.filter(pass);
    const filteredPasses = state.showPassed ? EVENEMENTS_PASSES.filter(pass) : [];
    const total = filteredAvenir.length + filteredPasses.length;

    if (total === 0) {
      list.innerHTML = '<div class="evt-list-empty">Aucun évènement trouvé.<br><small>Essayez d\'élargir les filtres ou de modifier la recherche.</small></div>';
      return;
    }

    // S2.1 — Rendu textuel basique (sera remplacé par cartes en S2.2)
    let html = '<div class="evt-list-loading" style="text-align:left; color: var(--ink-soft); padding: 14px 0;">';
    html += '<strong>S2.1 — rendu de validation</strong><br><br>';
    html += filteredAvenir.length + ' évènement(s) à venir, ' + filteredPasses.length + ' passé(s) :';
    html += '<ul style="margin: 12px 0 0 12px; padding-left: 14px; font-family: inherit; letter-spacing: normal; text-transform: none;">';

    filteredAvenir.forEach(e => {
      html += '<li style="margin-bottom: 4px;"><code style="font-size: 11px;">' + escHtml(e.code) + '</code> · ' + escHtml(e.libelle) + ' · J+' + e.jours_jusqu_a_evenement + '</li>';
    });
    filteredPasses.forEach(e => {
      html += '<li style="margin-bottom: 4px; opacity: 0.6;"><code style="font-size: 11px;">' + escHtml(e.code) + '</code> · ' + escHtml(e.libelle) + ' · J-' + e.jours_depuis_evenement + '</li>';
    });

    html += '</ul></div>';
    list.innerHTML = html;
  }

  /**
   * Met à jour les compteurs KPI (À venir / Passés) en tête de page.
   */
  function renderKPIs() {
    const kpiAvenir = document.getElementById('kpi-avenir');
    const kpiPasses = document.getElementById('kpi-passes');
    if (kpiAvenir) kpiAvenir.textContent = String(EVENEMENTS_AVENIR.length);
    if (kpiPasses) kpiPasses.textContent = String(EVENEMENTS_PASSES.length);

    // Sous-titre : nombre total + saison
    const sub = document.getElementById('evt-header-sub');
    if (sub) {
      const total = EVENEMENTS_AVENIR.length + EVENEMENTS_PASSES.length;
      sub.textContent = total + ' évènement(s) chargé(s) · ' + FENETRE_JOURS_AVENIR + ' jours à venir, ' + FENETRE_JOURS_PASSES + ' jours passés';
    }
  }

  // ============================================================
  // 5. MINI-CALENDRIER SIDEBAR (S2.2)
  // ============================================================

  // → renderMiniCal() viendra en S2.2

  // ============================================================
  // 6. FICHE DÉTAILLÉE E2 (S2.3)
  // ============================================================

  // → openFiche(evenementId) / closeFiche() viendront en S2.3

  // ============================================================
  // 7. MODALES E3 / E4 / E5 (S2.4)
  // ============================================================

  /**
   * Stubs minimalistes pour les 3 modales — câblage complet en S2.4.
   * Pour l'instant : ouverture / fermeture seulement, contenu placeholder.
   */
  function openModalCreate()   { document.getElementById('evt-overlay-create').classList.add('show'); }
  function closeModalCreate()  { document.getElementById('evt-overlay-create').classList.remove('show'); }
  function openModalCancel(evenementId)  { document.getElementById('evt-overlay-cancel').classList.add('show'); }
  function closeModalCancel()  { document.getElementById('evt-overlay-cancel').classList.remove('show'); }
  function openModalAddMatch(tournoiId)  { document.getElementById('evt-overlay-addmatch').classList.add('show'); }
  function closeModalAddMatch(){ document.getElementById('evt-overlay-addmatch').classList.remove('show'); }

  // ============================================================
  // 8. ÉVÉNEMENTS DOM (filtres, recherche, FAB, modales)
  // ============================================================

  function bindEvents() {
    // Filtres TYPE
    document.querySelectorAll('.evt-chip[data-type]').forEach(chip => {
      chip.addEventListener('click', function () {
        const type = this.getAttribute('data-type');
        toggleTypeFilter(type);
      });
    });

    // Filtres COMPÉTITION
    document.querySelectorAll('.evt-chip[data-compet]').forEach(chip => {
      chip.addEventListener('click', function () {
        const compet = this.getAttribute('data-compet');
        toggleCompetFilter(compet);
      });
    });

    // Recherche libre (debounce 200 ms léger)
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

    // FAB → modale création
    const fab = document.getElementById('evt-fab-new');
    if (fab) fab.addEventListener('click', openModalCreate);

    // Fermeture des modales (boutons data-action="close-*")
    document.querySelectorAll('[data-action="close-create"]').forEach(b => b.addEventListener('click', closeModalCreate));
    document.querySelectorAll('[data-action="close-cancel"]').forEach(b => b.addEventListener('click', closeModalCancel));
    document.querySelectorAll('[data-action="close-addmatch"]').forEach(b => b.addEventListener('click', closeModalAddMatch));

    // Fermeture des modales au clic hors-modal (sur l'overlay)
    document.querySelectorAll('.evt-overlay').forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });

    // Fermeture des modales à la touche Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.evt-overlay.show').forEach(o => o.classList.remove('show'));
      }
    });
  }

  /** Toggle d'un chip filtre TYPE (gère exclusion mutuelle avec 'all') */
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
    // Met à jour les classes .active des chips TYPE
    document.querySelectorAll('.evt-chip[data-type]').forEach(c => {
      const t = c.getAttribute('data-type');
      c.classList.toggle('active', state.typesActifs.has(t));
    });
    // Masque ou affiche la barre COMPÉT selon présence Match/Tournoi (cf. doc §5.2 Q3)
    const competRow = document.getElementById('evt-filters-compet');
    if (competRow) {
      const showCompet = state.typesActifs.has('all')
                      || state.typesActifs.has('match')
                      || state.typesActifs.has('tournoi')
                      || state.typesActifs.has('journee_championnat');
      competRow.style.display = showCompet ? 'flex' : 'none';
    }
    savePrefs();
    renderListe();
  }

  /** Toggle d'un chip filtre COMPÉTITION (gère exclusion mutuelle avec 'all') */
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
      const v = c.getAttribute('data-compet');
      c.classList.toggle('active', state.competsActifs.has(v));
    });
    savePrefs();
    renderListe();
  }

  // ============================================================
  // 9. API PUBLIQUE
  // ============================================================

  async function init() {
    console.log('🏉 MOM Hub · Évènements Browser — init S2.1');

    const list = document.getElementById('evt-list');

    // Restaure les préférences utilisateur si disponibles
    const prefs = loadPrefs();
    if (prefs) {
      if (Array.isArray(prefs.typesActifs))   state.typesActifs   = new Set(prefs.typesActifs);
      if (Array.isArray(prefs.competsActifs)) state.competsActifs = new Set(prefs.competsActifs);
      if (typeof prefs.showPassed === 'boolean') state.showPassed = prefs.showPassed;
      // Réapplique les classes .active à partir de l'état restauré
      document.querySelectorAll('.evt-chip[data-type]').forEach(c => {
        c.classList.toggle('active', state.typesActifs.has(c.getAttribute('data-type')));
      });
      document.querySelectorAll('.evt-chip[data-compet]').forEach(c => {
        c.classList.toggle('active', state.competsActifs.has(c.getAttribute('data-compet')));
      });
    }

    try {
      // Charge en parallèle pour gagner du temps
      const [evtAvenir, evtPasses] = await Promise.all([
        loadEvenementsAVenir(),
        loadEvenementsPasses()
      ]);
      EVENEMENTS_AVENIR = evtAvenir;
      EVENEMENTS_PASSES = evtPasses;

      console.log('Évènements chargés :',
        EVENEMENTS_AVENIR.length, 'à venir,',
        EVENEMENTS_PASSES.length, 'passé(s)');

      bindEvents();
      renderKPIs();
      renderListe();

      // Met à jour le footer smoke check
      const smoke = document.getElementById('evt-footer-smoke');
      if (smoke) {
        smoke.textContent = 'MOM Hub · Module Évènements · S2.1 · ' +
          EVENEMENTS_AVENIR.length + ' à venir + ' +
          EVENEMENTS_PASSES.length + ' passé(s) chargé(s)';
      }
    } catch (err) {
      console.error('Évènements : erreur lors du chargement', err);
      if (list) {
        list.innerHTML = '<div class="evt-list-error">Erreur de chargement : ' + escHtml(err.message || String(err)) + '<br><br><small>Vérifiez que SupabaseHub v1.9+ est chargé et que les RPC C9 (sql/29) sont déployées.</small></div>';
      }
      throw err;
    }
  }

  // Exposition publique
  window.EvenementsBrowser = {
    init: init,
    // Exposés pour usage inline éventuel (pattern bibliotheque-browser.js)
    openModalCreate:   openModalCreate,
    openModalCancel:   openModalCancel,
    openModalAddMatch: openModalAddMatch
  };

  console.log('%c🏉 MOM Hub · Évènements Browser v1.0 (S2.1) chargé',
    'color: #2D7D46; font-weight: bold;');

})();
