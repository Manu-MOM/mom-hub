/**
 * MOM Hub · Évènements Browser
 * ============================================================
 * Logique du module Évènements (page evenements.html).
 *
 * Responsabilités :
 *   1. Charger les évènements à venir + passés de l'équipe M14 via RPC Supabase
 *   2. Rendre la vue Liste verticale chronologique (cartes complètes)
 *   3. Gérer les filtres TYPE + COMPÉTITION + recherche libre
 *   4. Gérer le déploiement inline des tournois (parents + matchs enfants)
 *   5. Gérer le mini-calendrier sidebar (2 mois, clic = scroll)
 *   6. Gérer la fiche détaillée E2 (S2.3)
 *   7. Gérer les modales E3 Création / E4 Annulation / E5 Ajout match (S2.4)
 *
 * Architecture :
 *   - Module IIFE exposant window.EvenementsBrowser.init()
 *   - Suit le pattern bibliotheque-browser.js
 *   - Préfixage CSS .evt-* strict dans evenements.html
 *
 * Dépendances :
 *   - SupabaseHub v1.10+ (RPC événements C9 : sql/29)
 *   - DOM : voir evenements.html (zone #evt-list, KPIs, filtres, sidebar, modales)
 *
 * Version : 1.4 — S2.4.b (15 mai 2026 après-midi)
 *   v1.0 : S2.1 squelette init basique
 *   v1.1 : S2.2 — vraies cartes événements (trait coloré, pastilles type,
 *          statut compo), regroupement par mois, déploiement inline
 *          tournois avec sous-cartes matchs groupés par phase, mini-cal
 *          sidebar fonctionnel (2 mois, clic jour = scroll vers event).
 *   v1.2 : S2.2.fix — correction redondance affichage adversaire dans
 *          les enfants de tournoi : si le libellé commence déjà par
 *          "vs " (cas matchs poule de brassage), on n'ajoute pas une
 *          2e fois l'adversaire_nom. Exploite aussi les colonnes
 *          phase_libelle + ordre_dans_phase remontées par sql/31.
 *   v1.3 : S2.3 — Fiche détaillée E2 (panneau slide-in droite). Clic
 *          sur une carte (parent OU enfant) ouvre la fiche.
 *          Récupération via SupabaseHub.getEvenementWithEncadrants
 *          (sql/29 + v1.10). Sections empilées : identité, phases si
 *          tournoi (depuis CHILDREN_BY_PARENT), logistique
 *          conditionnelle, encadrants (array JSONB), notes_internes,
 *          score. Mode lecture seule (édition reportée S2.4 avec
 *          wrappers WRITE). Fermeture Escape + clic overlay + bouton ✕.
 *   v1.4 : S2.4.b — câblage complet des 3 modales E3/E4/E5 avec les
 *          wrappers WRITE v1.11. Récupération dynamique à l'init du
 *          saison_id + organisateur_principal_id depuis le prochain
 *          évent M14 (anti-invention). Chargement des sites actifs
 *          via listSitesActifs (v1.8.1). Forms validés côté client,
 *          appels createEvenement/cancelEvenement/addMatchToTournoi
 *          via wrappers v1.11, reload de la liste après succès.
 */

(function () {
  'use strict';

  // ============================================================
  // 1. ÉTAT INTERNE DU MODULE
  // ============================================================

  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  const FENETRE_JOURS_AVENIR  = 90;
  const FENETRE_JOURS_PASSES  = 30;
  const PASSES_LIMIT          = 50;

  const STORAGE_KEY_PREFS = 'mom_hub.evenements.prefs';

  let EVENEMENTS_AVENIR = [];
  let EVENEMENTS_PASSES = [];

  let EVENTS_BY_ID       = {};
  let CHILDREN_BY_PARENT = {};

  // S2.4.b — Context global récupéré dynamiquement à l'init
  // (pas de hardcode anti-doctrine — récupération via API)
  let CTX_SAISON_ID       = null;
  let CTX_ORGANISATEUR_ID = null;
  let SITES               = [];   // [{id, libelle_court, libelle}]

  // S2.4.b — Contexte courant des modales (event sélectionné pour E4, tournoi pour E5)
  let MODAL_CANCEL_EVENT_ID  = null;
  let MODAL_ADDMATCH_TOURNOI = null;   // objet event complet

  const state = {
    typesActifs:   new Set(['all']),
    competsActifs: new Set(['all']),
    search:        '',
    showPassed:    true,
    expandedTournois: new Set()
  };

  const TYPE_LABELS = {
    match:               'Match',
    entrainement:        'Entraînement',
    stage:               'Stage',
    tournoi:             'Tournoi',
    journee_championnat: 'Journée champ.'
  };

  const TYPE_ICONS = {
    match:               '<circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/>',
    entrainement:        '<polyline points="22 4 12 14.01 9 11.01"/><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>',
    stage:               '<path d="M2 12h6l3-9 4 18 3-9h4"/>',
    tournoi:             '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    journee_championnat: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
  };

  const COMPET_TO_CLASS = {
    championnat: 'compet-champ-p1',
    coupe:       'compet-vie',
    tournoi:     'compet-tournoi',
    amical:      'compet-amical'
  };

  // ============================================================
  // 2. CHARGEMENT DES DONNÉES
  // ============================================================

  async function loadEvenementsAVenir() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsAVenir !== 'function') {
      throw new Error('SupabaseHub.getEvenementsAVenir indisponible (v1.10+ requis)');
    }
    const events = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, FENETRE_JOURS_AVENIR);
    return Array.isArray(events) ? events : [];
  }

  async function loadEvenementsPasses() {
    if (!window.SupabaseHub || typeof SupabaseHub.getEvenementsPasses !== 'function') {
      throw new Error('SupabaseHub.getEvenementsPasses indisponible (v1.10+ requis)');
    }
    const events = await SupabaseHub.getEvenementsPasses(M14_TEAM_UUID, FENETRE_JOURS_PASSES, PASSES_LIMIT);
    return Array.isArray(events) ? events : [];
  }

  function buildIndexes() {
    EVENTS_BY_ID = {};
    CHILDREN_BY_PARENT = {};

    const all = EVENEMENTS_AVENIR.concat(EVENEMENTS_PASSES);
    all.forEach(e => {
      EVENTS_BY_ID[e.id] = e;
      if (e.evenement_parent_id) {
        if (!CHILDREN_BY_PARENT[e.evenement_parent_id]) {
          CHILDREN_BY_PARENT[e.evenement_parent_id] = [];
        }
        CHILDREN_BY_PARENT[e.evenement_parent_id].push(e);
      }
    });

    Object.keys(CHILDREN_BY_PARENT).forEach(parentId => {
      CHILDREN_BY_PARENT[parentId].sort((a, b) => {
        const oa = a.ordre_dans_phase || 999;
        const ob = b.ordre_dans_phase || 999;
        if (oa !== ob) return oa - ob;
        return new Date(a.date_debut) - new Date(b.date_debut);
      });
    });
  }

  // ============================================================
  // 3. HELPERS GÉNÉRIQUES
  // ============================================================

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

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

  function formatHeureOnly(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const h = d.getHours();
    const m = d.getMinutes();
    return m === 0 ? h + 'h' : h + 'h' + String(m).padStart(2, '0');
  }

  function formatMoisAnnee(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
  }

  function dateKey(isoString) {
    if (!isoString) return '';
    return isoString.substring(0, 10);
  }

  function moisKey(isoString) {
    if (!isoString) return '';
    return isoString.substring(0, 7);
  }

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

  function pass(evt) {
    if (!state.typesActifs.has('all') && !state.typesActifs.has(evt.type_evenement)) return false;
    if (!state.competsActifs.has('all') && evt.type_competition && !state.competsActifs.has(evt.type_competition)) return false;
    if (state.search) {
      const s = state.search.toLowerCase();
      const libelle = (evt.libelle || '').toLowerCase();
      const adversaire = (evt.adversaire_nom || '').toLowerCase();
      if (libelle.indexOf(s) === -1 && adversaire.indexOf(s) === -1) return false;
    }
    return true;
  }

  /**
   * Pastille statut compo (cf. doc Conception §5.2 Q5)
   */
  function statutCompoBadge(summary) {
    if (!summary || typeof summary !== 'object') {
      return { cls: 'neutral', libelle: '0/0 à faire' };
    }
    const total     = parseInt(summary.total     || 0, 10);
    const brouillon = parseInt(summary.brouillon || 0, 10);
    const validee   = parseInt(summary.validee   || 0, 10);
    const utilisee  = parseInt(summary.utilisee  || 0, 10);

    if (total === 0) return { cls: 'neutral', libelle: '0/0 à faire' };
    if (utilisee === total) return { cls: 'utilisee', libelle: total + '/' + total + ' jouées' };
    if (validee + utilisee === total) return { cls: 'validee', libelle: total + '/' + total + ' prêtes' };
    if (brouillon > 0) return { cls: 'brouillon', libelle: (brouillon + validee + utilisee) + '/' + total + ' en cours' };
    return { cls: 'neutral', libelle: total + '/' + total + ' à faire' };
  }

  function competClass(typeCompet) {
    return COMPET_TO_CLASS[typeCompet] || '';
  }

  function typeIconSvg(type) {
    const inner = TYPE_ICONS[type] || TYPE_ICONS.match;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  // ============================================================
  // 4. RENDU LISTE — CARTES + REGROUPEMENT PAR MOIS
  // ============================================================

  function renderCard(evt, isPasse) {
    const dateLib = formatDateShort(evt.date_debut);
    const competCls = competClass(evt.type_competition);
    const typeLbl = TYPE_LABELS[evt.type_evenement] || evt.type_evenement;
    const badge = statutCompoBadge(evt.compo_status_summary);

    const isAnnule = evt.etat === 'annule';
    const cardClasses = [
      'evt-card',
      competCls,
      isAnnule ? 'evt-card-annule' : '',
      isPasse ? 'evt-card-passe' : ''
    ].filter(Boolean).join(' ');

    const isTournoi = evt.type_evenement === 'tournoi';
    const isExpanded = state.expandedTournois.has(evt.id);
    const enfants = CHILDREN_BY_PARENT[evt.id] || [];

    let secondaire = '';
    if (evt.site_libelle_court) secondaire = escHtml(evt.site_libelle_court);
    if (evt.adversaire_nom) {
      secondaire += (secondaire ? ' · ' : '') + 'vs ' + escHtml(evt.adversaire_nom);
    }

    let badgeJours = '';
    if (isPasse && typeof evt.jours_depuis_evenement === 'number') {
      badgeJours = '<span class="evt-card-jours">J-' + evt.jours_depuis_evenement + '</span>';
    } else if (!isPasse && typeof evt.jours_jusqu_a_evenement === 'number') {
      badgeJours = '<span class="evt-card-jours">J+' + evt.jours_jusqu_a_evenement + '</span>';
    }

    let html = '<div class="' + cardClasses + '" data-event-id="' + evt.id + '" data-mois="' + escHtml(moisKey(evt.date_debut)) + '">';
    html += '<div class="evt-card-stripe"></div>';
    html += '<div class="evt-card-body">';
    html += '<div class="evt-card-line1">';

    if (isTournoi && enfants.length > 0) {
      html += '<button type="button" class="evt-card-chevron" data-action="toggle-tournoi" data-tournoi-id="' + evt.id + '" title="Déplier / replier les matchs">';
      html += isExpanded ? '▼' : '▶';
      html += '</button>';
    }

    html += '<div class="evt-card-type-icon" title="' + escHtml(typeLbl) + '">' + typeIconSvg(evt.type_evenement) + '</div>';
    html += '<div class="evt-card-titre">';
    html += '<div class="evt-card-meta">' + escHtml(dateLib) + ' · ' + escHtml(typeLbl);
    if (badgeJours) html += ' · ' + badgeJours;
    html += '</div>';
    html += '<div class="evt-card-libelle">' + escHtml(evt.libelle || '(sans libellé)') + '</div>';
    if (secondaire) html += '<div class="evt-card-secondaire">' + secondaire + '</div>';
    html += '</div>';

    if (isAnnule) {
      html += '<div class="evt-card-badge evt-badge-annule">Annulé</div>';
    } else {
      html += '<div class="evt-card-badge evt-badge-' + badge.cls + '">' + escHtml(badge.libelle) + '</div>';
    }

    html += '</div>';
    html += '</div>';
    html += '</div>';

    if (isTournoi && isExpanded && enfants.length > 0) {
      html += renderEnfantsTournoi(evt, enfants);
    }

    return html;
  }

  function renderEnfantsTournoi(parent, enfants) {
    const phases = [];
    const byPhase = {};
    enfants.forEach(e => {
      const phase = e.phase_libelle || '(sans phase)';
      if (!byPhase[phase]) {
        byPhase[phase] = [];
        phases.push(phase);
      }
      byPhase[phase].push(e);
    });

    let html = '<div class="evt-tournoi-enfants">';
    phases.forEach(phaseName => {
      html += '<div class="evt-phase-titre">📍 ' + escHtml(phaseName) + '</div>';
      byPhase[phaseName].forEach(child => {
        html += renderEnfantCard(child);
      });
    });
    html += '<button type="button" class="evt-tournoi-add-match" data-action="add-match-to-tournoi" data-tournoi-id="' + parent.id + '">';
    html += '+ Ajouter un match';
    html += '</button>';
    html += '</div>';
    return html;
  }

  function renderEnfantCard(child) {
    const heure = formatHeureOnly(child.date_debut);

    // Évite la redondance "vs Nancy   vs Nancy" : si le libellé commence
    // déjà par "vs " (cas matchs poule contre équipe nommée), on n'ajoute
    // pas une 2e fois l'adversaire_nom à côté.
    const libelle = child.libelle || '';
    const libelleStartsWithVs = libelle.toLowerCase().indexOf('vs ') === 0;

    let adversaireBlock = '';
    if (libelleStartsWithVs) {
      // L'info est déjà dans le libellé → on n'affiche que le libellé tel quel
      adversaireBlock = '';
    } else if (child.adversaire_nom) {
      adversaireBlock = 'vs ' + escHtml(child.adversaire_nom);
    } else {
      adversaireBlock = '<em style="color:var(--ink-mute)">(adversaire à déterminer)</em>';
    }

    const badge = statutCompoBadge(child.compo_status_summary);
    const isAnnule = child.etat === 'annule';

    let html = '<div class="evt-enfant-row" data-event-id="' + child.id + '">';
    html += '<span class="evt-enfant-heure">' + escHtml(heure) + '</span>';
    html += '<span class="evt-enfant-libelle">' + escHtml(libelle) + '</span>';
    if (adversaireBlock) {
      html += '<span class="evt-enfant-adversaire">' + adversaireBlock + '</span>';
    } else {
      html += '<span class="evt-enfant-adversaire"></span>';
    }
    if (isAnnule) {
      html += '<span class="evt-card-badge evt-badge-annule evt-badge-sm">Annulé</span>';
    } else {
      html += '<span class="evt-card-badge evt-badge-' + badge.cls + ' evt-badge-sm">' + escHtml(badge.libelle) + '</span>';
    }
    html += '</div>';
    return html;
  }

  function renderListe() {
    const list = document.getElementById('evt-list');
    if (!list) return;

    const filterRoot = evt => !evt.evenement_parent_id && pass(evt);

    const filteredAvenir = EVENEMENTS_AVENIR.filter(filterRoot);
    const filteredPasses = state.showPassed ? EVENEMENTS_PASSES.filter(filterRoot) : [];
    const total = filteredAvenir.length + filteredPasses.length;

    if (total === 0) {
      list.innerHTML = '<div class="evt-list-empty">Aucun évènement trouvé.<br><small>Essayez d\'élargir les filtres ou de modifier la recherche.</small></div>';
      return;
    }

    let html = '';
    if (filteredPasses.length > 0) {
      html += renderSection('Évènements passés', filteredPasses, true);
    }
    if (filteredAvenir.length > 0) {
      html += renderSection('Évènements à venir', filteredAvenir, false);
    }

    list.innerHTML = html;
    bindCardEvents();
  }

  function renderSection(titre, events, isPasse) {
    const byMois = {};
    const moisOrder = [];
    events.forEach(e => {
      const m = moisKey(e.date_debut);
      if (!byMois[m]) {
        byMois[m] = { libelle: formatMoisAnnee(e.date_debut), events: [] };
        moisOrder.push(m);
      }
      byMois[m].events.push(e);
    });

    let html = '<div class="evt-section">';
    html += '<div class="evt-section-titre">' + escHtml(titre) + ' · ' + events.length + '</div>';
    moisOrder.forEach(m => {
      html += '<div class="evt-mois-titre" data-mois="' + escHtml(m) + '">' + escHtml(byMois[m].libelle) + '</div>';
      byMois[m].events.forEach(e => {
        html += renderCard(e, isPasse);
      });
    });
    html += '</div>';
    return html;
  }

  function bindCardEvents() {
    document.querySelectorAll('.evt-card-chevron[data-action="toggle-tournoi"]').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const tournoiId = this.getAttribute('data-tournoi-id');
        if (state.expandedTournois.has(tournoiId)) {
          state.expandedTournois.delete(tournoiId);
        } else {
          state.expandedTournois.add(tournoiId);
        }
        renderListe();
      });
    });

    document.querySelectorAll('.evt-card').forEach(card => {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-action="toggle-tournoi"]')) return;
        if (e.target.closest('.evt-card-chevron')) return;
        const id = this.getAttribute('data-event-id');
        if (id) openFiche(id);
      });
    });

    document.querySelectorAll('[data-action="add-match-to-tournoi"]').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const tournoiId = this.getAttribute('data-tournoi-id');
        console.log('[S2.4 à venir] Ouvrir modale E5 pour ajouter match au tournoi', tournoiId);
        openModalAddMatch(tournoiId);
      });
    });

    // Clic sur ligne enfant de tournoi → fiche détaillée du match
    document.querySelectorAll('.evt-enfant-row[data-event-id]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function (e) {
        // Ignore les clics sur des éléments enfants interactifs (badges, etc.)
        if (e.target.closest('[data-action]')) return;
        const id = this.getAttribute('data-event-id');
        if (id) openFiche(id);
      });
    });
  }

  function renderKPIs() {
    const kpiAvenir = document.getElementById('kpi-avenir');
    const kpiPasses = document.getElementById('kpi-passes');
    const avenirRoots = EVENEMENTS_AVENIR.filter(e => !e.evenement_parent_id);
    const passesRoots = EVENEMENTS_PASSES.filter(e => !e.evenement_parent_id);
    if (kpiAvenir) kpiAvenir.textContent = String(avenirRoots.length);
    if (kpiPasses) kpiPasses.textContent = String(passesRoots.length);

    const sub = document.getElementById('evt-header-sub');
    if (sub) {
      const totalAll = EVENEMENTS_AVENIR.length + EVENEMENTS_PASSES.length;
      sub.textContent = totalAll + ' évènement(s) chargé(s) · ' + FENETRE_JOURS_AVENIR + ' jours à venir, ' + FENETRE_JOURS_PASSES + ' jours passés';
    }
  }

  // ============================================================
  // 5. MINI-CALENDRIER SIDEBAR
  // ============================================================

  function renderMiniCal() {
    const container = document.getElementById('evt-mini-cal');
    if (!container) return;

    const now = new Date();
    const months = [
      { year: now.getFullYear(), month: now.getMonth() },
      { year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), month: (now.getMonth() + 1) % 12 }
    ];

    const eventsByDay = {};
    const all = EVENEMENTS_AVENIR.concat(EVENEMENTS_PASSES);
    all.forEach(e => {
      if (e.evenement_parent_id) return;
      const k = dateKey(e.date_debut);
      if (!eventsByDay[k]) eventsByDay[k] = [];
      eventsByDay[k].push(e);
    });

    let html = '';
    months.forEach(m => {
      html += renderMonthGrid(m.year, m.month, eventsByDay, now);
    });
    container.innerHTML = html;

    container.querySelectorAll('.evt-mini-day[data-day-key]').forEach(cell => {
      cell.addEventListener('click', function () {
        const dayKey = this.getAttribute('data-day-key');
        scrollToFirstEventOfDay(dayKey);
      });
    });
  }

  function renderMonthGrid(year, month, eventsByDay, today) {
    const moisDate = new Date(year, month, 1);
    const moisLib = moisDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startCol = firstDay.getDay() - 1;
    if (startCol < 0) startCol = 6;

    let html = '<div class="evt-mini-month">';
    html += '<div class="evt-mini-month-title">' + escHtml(moisLib) + '</div>';
    html += '<div class="evt-mini-grid">';
    html += '<div class="evt-mini-wday">L</div><div class="evt-mini-wday">M</div><div class="evt-mini-wday">M</div><div class="evt-mini-wday">J</div><div class="evt-mini-wday">V</div><div class="evt-mini-wday">S</div><div class="evt-mini-wday">D</div>';

    for (let i = 0; i < startCol; i++) {
      html += '<div class="evt-mini-day evt-mini-day-empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayKey = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const hasEvents = !!eventsByDay[dayKey];
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
      const cellClasses = [
        'evt-mini-day',
        hasEvents ? 'has-events' : '',
        isToday ? 'is-today' : ''
      ].filter(Boolean).join(' ');
      html += '<div class="' + cellClasses + '" data-day-key="' + dayKey + '"';
      if (hasEvents) html += ' title="' + eventsByDay[dayKey].length + ' évènement(s)"';
      html += '>';
      html += d;
      if (hasEvents) html += '<span class="evt-mini-dot"></span>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function scrollToFirstEventOfDay(dayKey) {
    const cards = document.querySelectorAll('.evt-card[data-event-id]');
    for (let i = 0; i < cards.length; i++) {
      const id = cards[i].getAttribute('data-event-id');
      const evt = EVENTS_BY_ID[id];
      if (evt && dateKey(evt.date_debut) === dayKey) {
        cards[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        cards[i].classList.add('evt-card-highlight');
        setTimeout(() => cards[i].classList.remove('evt-card-highlight'), 1500);
        return;
      }
    }
    console.log('Aucune carte trouvée pour la date', dayKey);
  }

  // ============================================================
  // 6. FICHE DÉTAILLÉE E2 (S2.3)
  // ============================================================

  /**
   * Ouvre le panneau fiche détaillée pour un événement donné.
   * Appelle SupabaseHub.getEvenementWithEncadrants (sql/29 + v1.10)
   * pour récupérer les 24 colonnes complètes + array encadrants JSONB.
   *
   * Mode lecture seule V1 (S2.3). Édition reportée S2.4.
   *
   * @param {string} evenementId UUID de l'événement à ouvrir
   */
  async function openFiche(evenementId) {
    if (!evenementId) {
      console.error('openFiche() : evenementId manquant');
      return;
    }

    const overlay = document.getElementById('evt-fiche-overlay');
    const body    = document.getElementById('evt-fiche-body');
    const code    = document.getElementById('evt-fiche-code');
    const title   = document.getElementById('evt-fiche-title');
    if (!overlay || !body || !title) return;

    // Affiche immédiatement le panneau en loading
    overlay.classList.add('show');
    if (code)  code.textContent  = '…';
    if (title) title.textContent = 'Chargement…';
    body.innerHTML = '<div class="evt-fiche-loading">Chargement de la fiche…</div>';

    try {
      if (!window.SupabaseHub || typeof SupabaseHub.getEvenementWithEncadrants !== 'function') {
        throw new Error('SupabaseHub.getEvenementWithEncadrants indisponible (v1.10+ requis)');
      }
      const evt = await SupabaseHub.getEvenementWithEncadrants(evenementId);
      if (!evt) {
        body.innerHTML = '<div class="evt-fiche-error">Évènement introuvable en base.</div>';
        if (title) title.textContent = 'Introuvable';
        return;
      }
      // Met à jour le header
      if (code)  code.textContent  = evt.code || '';
      if (title) title.textContent = evt.libelle || '(sans libellé)';

      // Rend le corps de la fiche
      body.innerHTML = renderFiche(evt);

      // Câblage des actions internes (Annuler / Réactiver)
      bindFicheActions();
    } catch (err) {
      console.error('openFiche() erreur', err);
      body.innerHTML = '<div class="evt-fiche-error">Erreur de chargement : ' + escHtml(err.message || String(err)) + '</div>';
      if (title) title.textContent = 'Erreur';
    }
  }

  /** Ferme le panneau fiche détaillée */
  function closeFiche() {
    const overlay = document.getElementById('evt-fiche-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  /**
   * Construit le HTML complet du corps de la fiche détaillée.
   * Sections empilées selon doc Conception §3.3 :
   *   Identité → Phases (si tournoi) → Logistique (conditionnelle) →
   *   Encadrants → Notes → Score (si rempli) → Actions
   */
  function renderFiche(evt) {
    let html = '';

    // ────────────────────────────────────────────────
    // 1. BANDEAU IDENTITÉ
    // ────────────────────────────────────────────────
    const dateLib = formatDateShort(evt.date_debut);
    const typeLbl = TYPE_LABELS[evt.type_evenement] || evt.type_evenement;
    const badge   = statutCompoBadge(evt.compo_status_summary);
    const etatPillCls = 'evt-fiche-pill-etat-' + (evt.etat || 'creation');

    let secondaire = '';
    if (evt.site_libelle_court) secondaire = escHtml(evt.site_libelle_court);
    if (evt.adversaire_nom) {
      secondaire += (secondaire ? ' · ' : '') + 'vs ' + escHtml(evt.adversaire_nom);
    }
    if (evt.type_competition) {
      secondaire += (secondaire ? ' · ' : '') + escHtml(evt.type_competition);
    }
    if (evt.format_de_jeu) {
      secondaire += (secondaire ? ' · ' : '') + escHtml(evt.format_de_jeu);
    }

    html += '<div class="evt-fiche-identite">';
    html += '<div class="evt-fiche-identite-meta">' + escHtml(dateLib) + ' · ' + escHtml(typeLbl) + '</div>';
    html += '<div class="evt-fiche-identite-libelle">' + escHtml(evt.libelle || '(sans libellé)') + '</div>';
    if (secondaire) {
      html += '<div class="evt-fiche-identite-secondaire">' + secondaire + '</div>';
    }
    html += '<div class="evt-fiche-identite-row">';
    html += '<span class="evt-fiche-pill ' + etatPillCls + '">État : ' + escHtml(evt.etat || 'creation') + '</span>';
    if (evt.compo_status_summary && evt.compo_status_summary.total > 0) {
      html += '<span class="evt-fiche-pill">' + escHtml(badge.libelle) + '</span>';
    } else if (evt.type_evenement === 'match' || evt.type_evenement === 'tournoi') {
      html += '<span class="evt-fiche-pill">0 compo · à faire</span>';
    }
    if (evt.domicile_exterieur) {
      html += '<span class="evt-fiche-pill">' + escHtml(evt.domicile_exterieur) + '</span>';
    }
    html += '</div>';
    html += '</div>';

    // ────────────────────────────────────────────────
    // 2. SCORE (si match joué)
    // ────────────────────────────────────────────────
    if (evt.score_mom !== null && evt.score_mom !== undefined && evt.score_adverse !== null && evt.score_adverse !== undefined) {
      html += '<div class="evt-fiche-section">';
      html += '<div class="evt-fiche-section-title">🏆 Score</div>';
      html += '<div class="evt-fiche-score">';
      html += '<span class="evt-fiche-score-num">' + escHtml(String(evt.score_mom)) + '</span>';
      html += '<span class="evt-fiche-score-vs">—</span>';
      html += '<span class="evt-fiche-score-num">' + escHtml(String(evt.score_adverse)) + '</span>';
      html += '</div>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 3. PHASES (si tournoi avec enfants — repris depuis CHILDREN_BY_PARENT)
    // ────────────────────────────────────────────────
    if (evt.type_evenement === 'tournoi') {
      const enfants = CHILDREN_BY_PARENT[evt.id] || [];
      html += '<div class="evt-fiche-section">';
      html += '<div class="evt-fiche-section-title">📋 Phases du tournoi</div>';
      if (enfants.length === 0) {
        html += '<div class="evt-fiche-empty">Aucun match interne créé pour ce tournoi.</div>';
      } else {
        // Regroupement par phase_libelle
        const phases = [];
        const byPhase = {};
        enfants.forEach(c => {
          const p = c.phase_libelle || '(sans phase)';
          if (!byPhase[p]) { byPhase[p] = []; phases.push(p); }
          byPhase[p].push(c);
        });
        phases.forEach(phaseName => {
          html += '<div class="evt-fiche-phase-titre">📍 ' + escHtml(phaseName) + '</div>';
          byPhase[phaseName].forEach(child => {
            const heure = formatHeureOnly(child.date_debut);
            const childBadge = statutCompoBadge(child.compo_status_summary);
            const childLibStartsVs = (child.libelle || '').toLowerCase().indexOf('vs ') === 0;
            const advBlock = childLibStartsVs
              ? ''
              : (child.adversaire_nom
                  ? ' · vs ' + escHtml(child.adversaire_nom)
                  : ' · <em style="color:var(--ink-mute)">(adv. à déterminer)</em>');
            const isChildAnnule = child.etat === 'annule';
            html += '<div class="evt-fiche-phase-row">';
            html += '<span class="evt-fiche-phase-heure">' + escHtml(heure) + '</span>';
            html += '<span style="flex:1;">' + escHtml(child.libelle || '') + advBlock + '</span>';
            if (isChildAnnule) {
              html += '<span class="evt-card-badge evt-badge-annule evt-badge-sm">Annulé</span>';
            } else {
              html += '<span class="evt-card-badge evt-badge-' + childBadge.cls + ' evt-badge-sm">' + escHtml(childBadge.libelle) + '</span>';
            }
            html += '</div>';
          });
        });
      }
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 4. PARENT (si match enfant de tournoi)
    // ────────────────────────────────────────────────
    if (evt.evenement_parent_id) {
      const parent = EVENTS_BY_ID[evt.evenement_parent_id];
      if (parent) {
        html += '<div class="evt-fiche-section">';
        html += '<div class="evt-fiche-section-title">🏟️ Rattaché à</div>';
        html += '<div class="evt-fiche-text">' + escHtml(parent.libelle || parent.code || '(tournoi parent)');
        if (evt.phase_libelle) {
          html += ' <span style="color:var(--ink-mute);">— ' + escHtml(evt.phase_libelle) + '</span>';
        }
        html += '</div>';
        html += '</div>';
      }
    }

    // ────────────────────────────────────────────────
    // 5. LOGISTIQUE DÉPLACEMENT (conditionnelle, cf. doc §5.3 Q6)
    // ────────────────────────────────────────────────
    const hasLogistique = evt.logistique_deplacement && typeof evt.logistique_deplacement === 'object' && Object.keys(evt.logistique_deplacement).length > 0;
    if (hasLogistique || evt.type_evenement === 'deplacement') {
      html += '<div class="evt-fiche-section">';
      html += '<div class="evt-fiche-section-title">🚐 Logistique déplacement</div>';
      if (hasLogistique) {
        // V1 : affichage JSON brut (formattage structuré attendu en S2.4 quand on aura les wrappers UPDATE)
        html += '<pre class="evt-fiche-jsonbloc">' + escHtml(JSON.stringify(evt.logistique_deplacement, null, 2)) + '</pre>';
      } else {
        html += '<div class="evt-fiche-empty">Aucune logistique renseignée.</div>';
      }
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 6. ENCADRANTS (array JSONB depuis la RPC)
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-section">';
    html += '<div class="evt-fiche-section-title">👥 Encadrants</div>';
    const encadrants = Array.isArray(evt.encadrants) ? evt.encadrants : [];
    if (encadrants.length === 0) {
      html += '<div class="evt-fiche-empty">Aucun encadrant rattaché à cet évènement.</div>';
    } else {
      html += '<ul class="evt-fiche-list">';
      encadrants.forEach(enc => {
        const nomComplet = [enc.prenom, enc.nom].filter(Boolean).join(' ') || '(sans nom)';
        const roles = Array.isArray(enc.roles_encadrement)
          ? enc.roles_encadrement.join(', ')
          : '';
        html += '<li class="evt-fiche-list-item">';
        html += '<span class="evt-fiche-list-puce">•</span>';
        html += '<div class="evt-fiche-list-content">';
        html += '<div class="evt-fiche-list-name">' + escHtml(nomComplet) + '</div>';
        if (roles) {
          html += '<div class="evt-fiche-list-meta">' + escHtml(roles) + '</div>';
        }
        if (enc.notes) {
          html += '<div class="evt-fiche-list-meta">📝 ' + escHtml(enc.notes) + '</div>';
        }
        html += '</div>';
        html += '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';

    // ────────────────────────────────────────────────
    // 7. NOTES INTERNES
    // ────────────────────────────────────────────────
    if (evt.notes_internes) {
      html += '<div class="evt-fiche-section">';
      html += '<div class="evt-fiche-section-title">📝 Notes internes</div>';
      html += '<div class="evt-fiche-text">' + escHtml(evt.notes_internes) + '</div>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 8. ACTIONS EN PIED (S2.4 câblera les vrais boutons)
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-actions">';
    html += '<button type="button" class="evt-btn" disabled title="Câblage en S2.5 (V1.1)">✏️ Modifier</button>';
    if (evt.etat === 'annule') {
      html += '<div class="evt-fiche-actions-spacer"></div>';
      html += '<button type="button" class="evt-btn evt-btn-primary" data-action="reactivate-from-fiche" data-event-id="' + escHtml(evt.id) + '">↩ Réactiver l\'évènement</button>';
    } else if (evt.etat !== 'archive') {
      html += '<div class="evt-fiche-actions-spacer"></div>';
      html += '<button type="button" class="evt-btn evt-btn-danger" data-action="cancel-from-fiche" data-event-id="' + escHtml(evt.id) + '">🗑 Annuler l\'évènement</button>';
    }
    html += '</div>';

    return html;
  }

  /**
   * Câble les actions internes de la fiche détaillée (boutons Annuler /
   * Réactiver). Appelé après chaque renderFiche pour rebrancher les listeners.
   */
  function bindFicheActions() {
    document.querySelectorAll('[data-action="cancel-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalCancel(id);
      });
    });
    document.querySelectorAll('[data-action="reactivate-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.getAttribute('data-event-id');
        if (!id) return;
        this.disabled = true;
        this.textContent = 'Réactivation…';
        try {
          const res = await SupabaseHub.reactivateEvenement(id);
          if (!res || !res.ok) {
            alert('Échec : ' + ((res && res.error) || 'erreur inconnue'));
            this.disabled = false;
            this.textContent = "↩ Réactiver l'évènement";
            return;
          }
          // Succès : recharge + ré-ouvre fiche
          closeFiche();
          await reloadEvents();
          openFiche(id);
        } catch (err) {
          console.error('reactivate-from-fiche', err);
          alert('Erreur inattendue : ' + (err.message || err));
          this.disabled = false;
          this.textContent = "↩ Réactiver l'évènement";
        }
      });
    });
  }

  // ============================================================
  // 7. MODALES E3 / E4 / E5 (S2.4.b — câblage complet)
  // ============================================================

  // ────────────────────────────────────────────────
  // Récupération du contexte (saison + organisateur + sites)
  // ────────────────────────────────────────────────

  /**
   * Récupère dynamiquement saison_id + organisateur_principal_id depuis
   * le prochain évent M14 en base. Évite tout hardcode (doctrine
   * anti-invention). Charge aussi la liste des sites actifs pour le
   * dropdown des modales.
   */
  async function loadModalContext() {
    try {
      // 1. Saison + organisateur depuis le prochain évent
      if (window.SupabaseHub && typeof SupabaseHub.getProchainEvenementParEquipe === 'function') {
        const proch = await SupabaseHub.getProchainEvenementParEquipe(M14_TEAM_UUID);
        if (proch) {
          // saison_id n'est pas dans le retour de cette RPC (pas dans les 20 cols)
          // On va donc le récupérer depuis EVENEMENTS_AVENIR[0] ou EVENEMENTS_PASSES[0]
          // qui ne le retournent pas non plus en réalité !
          // → Fallback : on lit directement depuis la table evenements via from()
        }
      }

      // Fallback fiable : lecture directe depuis la table evenements pour
      // récupérer saison_id + organisateur_principal_id du dernier événement M14.
      // Ces 2 champs ne sont pas dans le retour des RPC liste mais bien dans
      // la table elle-même.
      if (window.SupabaseHub && SupabaseHub.client) {
        const { data, error } = await SupabaseHub.client
          .from('evenements')
          .select('saison_id, organisateur_principal_id')
          .eq('equipe_id', M14_TEAM_UUID)
          .order('date_debut', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          CTX_SAISON_ID       = data.saison_id;
          CTX_ORGANISATEUR_ID = data.organisateur_principal_id;
          console.log('Modal context : saison=', CTX_SAISON_ID, 'organisateur=', CTX_ORGANISATEUR_ID);
        } else if (error) {
          console.warn('loadModalContext() lecture saison/organisateur', error);
        }
      }

      // 2. Sites actifs pour le dropdown
      if (window.SupabaseHub && typeof SupabaseHub.listSitesActifs === 'function') {
        const sites = await SupabaseHub.listSitesActifs();
        SITES = Array.isArray(sites) ? sites : [];
        console.log('Modal context :', SITES.length, 'site(s) actif(s) chargé(s)');
      } else {
        console.warn('loadModalContext() : listSitesActifs indisponible (v1.8.1+ requis)');
      }

      // 3. Peuplement du dropdown sites dans la modale E3
      populateSitesDropdown();

    } catch (err) {
      console.error('loadModalContext() erreur', err);
    }
  }

  /** Peuple le <select> sites dans la modale E3 */
  function populateSitesDropdown() {
    const sel = document.getElementById('evt-create-site');
    if (!sel) return;
    // Conserve l'option "— Choisir —" en tête
    let html = '<option value="">— Choisir un site —</option>';
    SITES.forEach(s => {
      const lib = s.libelle_court || s.libelle || '(sans nom)';
      html += '<option value="' + escHtml(s.id) + '">' + escHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
  }

  // ────────────────────────────────────────────────
  // E3 — Modale Création
  // ────────────────────────────────────────────────

  function openModalCreate() {
    // Réinitialise le form
    const form = document.getElementById('evt-create-form');
    if (form) form.reset();
    // Coche par défaut "entrainement"
    const radioEntr = document.querySelector('#evt-create-form input[name=type_evenement][value=entrainement]');
    if (radioEntr) radioEntr.checked = true;
    updateCreateConditionalFields();
    const msg = document.getElementById('evt-create-msg');
    if (msg) msg.innerHTML = '';
    document.getElementById('evt-overlay-create').classList.add('show');
  }

  function closeModalCreate() {
    document.getElementById('evt-overlay-create').classList.remove('show');
  }

  /**
   * Affiche/masque les champs conditionnels de E3 selon le type sélectionné :
   * - type_competition + format_de_jeu : seulement match / tournoi / journee_championnat
   * - date_fin : seulement tournoi / stage
   */
  function updateCreateConditionalFields() {
    const checked = document.querySelector('#evt-create-form input[name=type_evenement]:checked');
    if (!checked) return;
    const type = checked.value;

    const competGroup = document.getElementById('evt-create-compet-group');
    const formatGroup = document.getElementById('evt-create-format-group');
    const dateFinGroup = document.getElementById('evt-create-date-fin-group');

    const showCompet = ['match', 'tournoi', 'journee_championnat'].indexOf(type) !== -1;
    const showFormat = ['match', 'tournoi', 'journee_championnat'].indexOf(type) !== -1;
    const showDateFin = ['tournoi', 'stage'].indexOf(type) !== -1;

    if (competGroup)  competGroup.style.display  = showCompet  ? '' : 'none';
    if (formatGroup)  formatGroup.style.display  = showFormat  ? '' : 'none';
    if (dateFinGroup) dateFinGroup.style.display = showDateFin ? '' : 'none';
  }

  /**
   * Génère un code unique pour le nouvel évent (pattern interne).
   * Format : EVT-YYYY-MM-DD-<TYPE>-M14-<RAND>
   */
  function generateEventCode(type, dateDebut) {
    const d = new Date(dateDebut);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const typeShort = (type === 'entrainement' ? 'ENTR'
                    : type === 'tournoi' ? 'TOURN'
                    : type === 'match' ? 'MATCH'
                    : type === 'stage' ? 'STAGE'
                    : type === 'journee_championnat' ? 'JCHAMP'
                    : 'EVT');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return 'EVT-' + y + '-' + m + '-' + day + '-' + typeShort + '-M14-' + rand;
  }

  async function submitModalCreate() {
    const submitBtn = document.getElementById('evt-create-submit');
    const msg = document.getElementById('evt-create-msg');
    if (!submitBtn || !msg) return;

    // Pré-requis context
    if (!CTX_SAISON_ID || !CTX_ORGANISATEUR_ID) {
      msg.innerHTML = '<div class="evt-form-error">Contexte saison/organisateur non chargé. Rechargez la page.</div>';
      return;
    }

    // Lecture du form
    const f = document.getElementById('evt-create-form');
    if (!f) return;

    const typeChecked = f.querySelector('input[name=type_evenement]:checked');
    if (!typeChecked) {
      msg.innerHTML = '<div class="evt-form-error">Veuillez sélectionner un type d\'évènement</div>';
      return;
    }
    const type = typeChecked.value;
    const libelle = f.elements.libelle.value.trim();
    const dateDebut = f.elements.date_debut.value;
    const dateFin = f.elements.date_fin.value;
    const siteId = f.elements.site_id.value;
    const typeCompet = f.elements.type_competition.value;
    const formatJeu = f.elements.format_de_jeu.value;
    const adversaire = f.elements.adversaire_nom.value.trim();
    const domicile = f.elements.domicile_exterieur.value;

    // Validation
    if (!libelle) {
      msg.innerHTML = '<div class="evt-form-error">Le libellé est requis</div>';
      return;
    }
    if (!dateDebut) {
      msg.innerHTML = '<div class="evt-form-error">La date de début est requise</div>';
      return;
    }
    if ((type === 'match' || type === 'journee_championnat') && !formatJeu) {
      msg.innerHTML = '<div class="evt-form-error">Le format de jeu est requis pour ' + (type === 'match' ? 'un match' : 'une journée de championnat') + '</div>';
      return;
    }

    // Construction du payload
    const payload = {
      code:                       generateEventCode(type, dateDebut),
      libelle:                    libelle,
      type_evenement:             type,
      equipe_id:                  M14_TEAM_UUID,
      saison_id:                  CTX_SAISON_ID,
      organisateur_principal_id:  CTX_ORGANISATEUR_ID,
      date_debut:                 new Date(dateDebut).toISOString()
    };
    if (dateFin)    payload.date_fin = new Date(dateFin).toISOString();
    if (siteId)     payload.site_id = siteId;
    if (typeCompet) payload.type_competition = typeCompet;
    if (formatJeu)  payload.format_de_jeu = formatJeu;
    if (adversaire) payload.adversaire_nom = adversaire;
    if (domicile)   payload.domicile_exterieur = domicile;

    // Appel wrapper
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.createEvenement(payload);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        submitBtn.disabled = false;
        submitBtn.textContent = "Créer l'évènement";
        return;
      }
      // Succès → ferme la modale + reload de la liste
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement créé.</div>';
      setTimeout(async () => {
        closeModalCreate();
        await reloadEvents();
      }, 500);
    } catch (err) {
      console.error('submitModalCreate', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : ' + escHtml(err.message || String(err)) + '</div>';
      submitBtn.disabled = false;
      submitBtn.textContent = "Créer l'évènement";
    }
  }

  // ────────────────────────────────────────────────
  // E4 — Modale Annulation
  // ────────────────────────────────────────────────

  function openModalCancel(evenementId) {
    if (!evenementId) return;
    MODAL_CANCEL_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];
    const info = document.getElementById('evt-cancel-info');
    const motif = document.getElementById('evt-cancel-motif');
    const msg = document.getElementById('evt-cancel-msg');
    if (motif) motif.value = '';
    if (msg)   msg.innerHTML = '';
    if (info && evt) {
      let html = '<span class="evt-modal-info-strong">';
      html += escHtml(formatDateShort(evt.date_debut)) + ' · ';
      html += escHtml(TYPE_LABELS[evt.type_evenement] || evt.type_evenement);
      html += '</span><br>';
      html += escHtml(evt.libelle || '(sans libellé)');
      if (evt.site_libelle_court) html += ' · ' + escHtml(evt.site_libelle_court);
      if (evt.adversaire_nom) html += ' · vs ' + escHtml(evt.adversaire_nom);
      // KPI compo
      if (evt.compo_status_summary && evt.compo_status_summary.total > 0) {
        html += '<br><em style="color:var(--ink-mute);">Cette annulation laissera orphelines : ' + evt.compo_status_summary.total + ' composition(s).</em>';
      }
      info.innerHTML = html;
    } else if (info) {
      info.innerHTML = '<em>Évènement non trouvé en cache.</em>';
    }
    document.getElementById('evt-overlay-cancel').classList.add('show');
  }

  function closeModalCancel() {
    MODAL_CANCEL_EVENT_ID = null;
    document.getElementById('evt-overlay-cancel').classList.remove('show');
  }

  async function submitModalCancel() {
    if (!MODAL_CANCEL_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-cancel-submit');
    const msg = document.getElementById('evt-cancel-msg');
    const motifInput = document.getElementById('evt-cancel-motif');
    if (!submitBtn || !msg || !motifInput) return;

    const motif = motifInput.value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Annulation…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.cancelEvenement(MODAL_CANCEL_EVENT_ID, motif);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        submitBtn.disabled = false;
        submitBtn.textContent = "Annuler l'évènement";
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement annulé.</div>';
      setTimeout(async () => {
        const wasId = MODAL_CANCEL_EVENT_ID;
        closeModalCancel();
        closeFiche();
        await reloadEvents();
        // Ré-ouvre la fiche pour montrer l'état "annulé" + bouton Réactiver
        if (wasId) openFiche(wasId);
      }, 500);
    } catch (err) {
      console.error('submitModalCancel', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : ' + escHtml(err.message || String(err)) + '</div>';
      submitBtn.disabled = false;
      submitBtn.textContent = "Annuler l'évènement";
    }
  }

  // ────────────────────────────────────────────────
  // E5 — Modale Ajout match au tournoi
  // ────────────────────────────────────────────────

  function openModalAddMatch(tournoiId) {
    if (!tournoiId) return;
    const tournoi = EVENTS_BY_ID[tournoiId];
    MODAL_ADDMATCH_TOURNOI = tournoi || { id: tournoiId };

    const info = document.getElementById('evt-addmatch-info');
    const form = document.getElementById('evt-addmatch-form');
    const msg = document.getElementById('evt-addmatch-msg');
    if (form) form.reset();
    if (msg)  msg.innerHTML = '';

    if (info && tournoi) {
      let html = '<span class="evt-modal-info-strong">' + escHtml(tournoi.libelle || '(sans libellé)') + '</span>';
      html += '<br>' + escHtml(formatDateShort(tournoi.date_debut));
      if (tournoi.site_libelle_court) html += ' · ' + escHtml(tournoi.site_libelle_court);
      info.innerHTML = html;
    } else if (info) {
      info.innerHTML = '<em>Tournoi parent en chargement…</em>';
    }

    // Datalist phases existantes (depuis les enfants déjà rattachés)
    const datalist = document.getElementById('evt-addmatch-phases-datalist');
    if (datalist) {
      const existing = (CHILDREN_BY_PARENT[tournoiId] || [])
        .map(c => c.phase_libelle)
        .filter((v, i, arr) => v && arr.indexOf(v) === i);
      datalist.innerHTML = existing.map(p => '<option value="' + escHtml(p) + '"></option>').join('');
    }

    document.getElementById('evt-overlay-addmatch').classList.add('show');
  }

  function closeModalAddMatch() {
    MODAL_ADDMATCH_TOURNOI = null;
    document.getElementById('evt-overlay-addmatch').classList.remove('show');
  }

  async function submitModalAddMatch() {
    if (!MODAL_ADDMATCH_TOURNOI || !MODAL_ADDMATCH_TOURNOI.id) return;
    const submitBtn = document.getElementById('evt-addmatch-submit');
    const msg = document.getElementById('evt-addmatch-msg');
    const form = document.getElementById('evt-addmatch-form');
    if (!submitBtn || !msg || !form) return;

    const phase = form.elements.phase_libelle.value.trim();
    const libelle = form.elements.libelle.value.trim();
    const heure = form.elements.heure.value;
    const adversaire = form.elements.adversaire_nom.value.trim();
    const format = form.elements.format_de_jeu.value;

    if (!libelle) {
      msg.innerHTML = '<div class="evt-form-error">Le libellé est requis</div>';
      return;
    }
    if (!heure) {
      msg.innerHTML = '<div class="evt-form-error">L\'heure de début est requise</div>';
      return;
    }

    // Construit date_debut = jour du tournoi parent + heure choisie
    let dateDebutISO;
    try {
      const parentDate = new Date(MODAL_ADDMATCH_TOURNOI.date_debut);
      const [hh, mm] = heure.split(':').map(n => parseInt(n, 10));
      parentDate.setHours(hh, mm, 0, 0);
      dateDebutISO = parentDate.toISOString();
    } catch (e) {
      msg.innerHTML = '<div class="evt-form-error">Impossible de construire la date du match</div>';
      return;
    }

    // Calcul ordre_dans_phase = max(ordre des matchs de cette phase) + 1
    let ordreDansPhase = 1;
    if (phase) {
      const sameParent = CHILDREN_BY_PARENT[MODAL_ADDMATCH_TOURNOI.id] || [];
      const samePhase = sameParent.filter(c => c.phase_libelle === phase);
      if (samePhase.length > 0) {
        const maxOrdre = Math.max.apply(null, samePhase.map(c => c.ordre_dans_phase || 0));
        ordreDansPhase = maxOrdre + 1;
      }
    }

    const payload = {
      libelle:    libelle,
      date_debut: dateDebutISO,
      ordre_dans_phase: ordreDansPhase
    };
    if (phase)      payload.phase_libelle = phase;
    if (adversaire) payload.adversaire_nom = adversaire;
    if (format)     payload.format_de_jeu = format;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Ajout…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.addMatchToTournoi(MODAL_ADDMATCH_TOURNOI.id, payload);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ajouter le match';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Match ajouté.</div>';
      setTimeout(async () => {
        const wasTournoiId = MODAL_ADDMATCH_TOURNOI.id;
        closeModalAddMatch();
        await reloadEvents();
        // Re-déplie le tournoi pour montrer le nouveau match
        state.expandedTournois.add(wasTournoiId);
        renderListe();
      }, 500);
    } catch (err) {
      console.error('submitModalAddMatch', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : ' + escHtml(err.message || String(err)) + '</div>';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ajouter le match';
    }
  }

  // ────────────────────────────────────────────────
  // Helper commun : recharge la liste des évents après modif
  // ────────────────────────────────────────────────

  async function reloadEvents() {
    try {
      const [evtAvenir, evtPasses] = await Promise.all([
        loadEvenementsAVenir(),
        loadEvenementsPasses()
      ]);
      EVENEMENTS_AVENIR = evtAvenir;
      EVENEMENTS_PASSES = evtPasses;
      buildIndexes();
      renderKPIs();
      renderListe();
      renderMiniCal();
    } catch (err) {
      console.error('reloadEvents() erreur', err);
    }
  }

  // ============================================================
  // 8. ÉVÉNEMENTS DOM
  // ============================================================

  function bindEvents() {
    document.querySelectorAll('.evt-chip[data-type]').forEach(chip => {
      chip.addEventListener('click', function () {
        toggleTypeFilter(this.getAttribute('data-type'));
      });
    });

    document.querySelectorAll('.evt-chip[data-compet]').forEach(chip => {
      chip.addEventListener('click', function () {
        toggleCompetFilter(this.getAttribute('data-compet'));
      });
    });

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

    const fab = document.getElementById('evt-fab-new');
    if (fab) fab.addEventListener('click', openModalCreate);

    document.querySelectorAll('[data-action="close-create"]').forEach(b => b.addEventListener('click', closeModalCreate));
    document.querySelectorAll('[data-action="close-cancel"]').forEach(b => b.addEventListener('click', closeModalCancel));
    document.querySelectorAll('[data-action="close-addmatch"]').forEach(b => b.addEventListener('click', closeModalAddMatch));

    // S2.4.b — Submit des 3 modales
    const btnCreateSubmit = document.getElementById('evt-create-submit');
    if (btnCreateSubmit) btnCreateSubmit.addEventListener('click', submitModalCreate);
    const btnCancelSubmit = document.getElementById('evt-cancel-submit');
    if (btnCancelSubmit) btnCancelSubmit.addEventListener('click', submitModalCancel);
    const btnAddMatchSubmit = document.getElementById('evt-addmatch-submit');
    if (btnAddMatchSubmit) btnAddMatchSubmit.addEventListener('click', submitModalAddMatch);

    // S2.4.b — Changement de type dans E3 → afficher/masquer champs conditionnels
    document.querySelectorAll('#evt-create-form input[name=type_evenement]').forEach(radio => {
      radio.addEventListener('change', updateCreateConditionalFields);
    });

    document.querySelectorAll('.evt-overlay').forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });

    // Fermeture du panneau fiche détaillée
    document.querySelectorAll('[data-action="close-fiche"]').forEach(b => {
      b.addEventListener('click', closeFiche);
    });
    const ficheOverlay = document.getElementById('evt-fiche-overlay');
    if (ficheOverlay) {
      ficheOverlay.addEventListener('click', function (e) {
        if (e.target === ficheOverlay) closeFiche();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        // Si fiche détaillée ouverte, on la ferme en priorité
        const ficheOverlay = document.getElementById('evt-fiche-overlay');
        if (ficheOverlay && ficheOverlay.classList.contains('show')) {
          closeFiche();
          return;
        }
        document.querySelectorAll('.evt-overlay.show').forEach(o => o.classList.remove('show'));
      }
    });
  }

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
    document.querySelectorAll('.evt-chip[data-type]').forEach(c => {
      c.classList.toggle('active', state.typesActifs.has(c.getAttribute('data-type')));
    });
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
      c.classList.toggle('active', state.competsActifs.has(c.getAttribute('data-compet')));
    });
    savePrefs();
    renderListe();
  }

  // ============================================================
  // 9. API PUBLIQUE
  // ============================================================

  async function init() {
    console.log('🏉 MOM Hub · Évènements Browser — init S2.4.b (v1.4)');

    const list = document.getElementById('evt-list');

    const prefs = loadPrefs();
    if (prefs) {
      if (Array.isArray(prefs.typesActifs))   state.typesActifs   = new Set(prefs.typesActifs);
      if (Array.isArray(prefs.competsActifs)) state.competsActifs = new Set(prefs.competsActifs);
      if (typeof prefs.showPassed === 'boolean') state.showPassed = prefs.showPassed;
      document.querySelectorAll('.evt-chip[data-type]').forEach(c => {
        c.classList.toggle('active', state.typesActifs.has(c.getAttribute('data-type')));
      });
      document.querySelectorAll('.evt-chip[data-compet]').forEach(c => {
        c.classList.toggle('active', state.competsActifs.has(c.getAttribute('data-compet')));
      });
    }

    try {
      const [evtAvenir, evtPasses] = await Promise.all([
        loadEvenementsAVenir(),
        loadEvenementsPasses()
      ]);
      EVENEMENTS_AVENIR = evtAvenir;
      EVENEMENTS_PASSES = evtPasses;

      buildIndexes();

      console.log('Évènements chargés :',
        EVENEMENTS_AVENIR.length, 'à venir,',
        EVENEMENTS_PASSES.length, 'passé(s)',
        '·', Object.keys(CHILDREN_BY_PARENT).length, 'tournoi(s) avec enfants');

      bindEvents();
      renderKPIs();
      renderListe();
      renderMiniCal();

      // S2.4.b — Charge le contexte des modales (saison, organisateur, sites)
      // en arrière-plan, non bloquant pour l'affichage initial
      loadModalContext();

      const smoke = document.getElementById('evt-footer-smoke');
      if (smoke) {
        const avenirRoots = EVENEMENTS_AVENIR.filter(e => !e.evenement_parent_id);
        const passesRoots = EVENEMENTS_PASSES.filter(e => !e.evenement_parent_id);
        smoke.textContent = 'MOM Hub · Module Évènements · S2.2 (v1.1) · ' +
          avenirRoots.length + ' à venir + ' +
          passesRoots.length + ' passé(s) racines · ' +
          Object.keys(CHILDREN_BY_PARENT).length + ' tournoi(s) avec matchs';
      }
    } catch (err) {
      console.error('Évènements : erreur lors du chargement', err);
      if (list) {
        list.innerHTML = '<div class="evt-list-error">Erreur de chargement : ' + escHtml(err.message || String(err)) + '<br><br><small>Vérifiez que SupabaseHub v1.10+ est chargé et que les RPC C9 (sql/29) sont déployées.</small></div>';
      }
      throw err;
    }
  }

  window.EvenementsBrowser = {
    init: init,
    openModalCreate:   openModalCreate,
    openModalCancel:   openModalCancel,
    openModalAddMatch: openModalAddMatch,
    openFiche:         openFiche,
    closeFiche:        closeFiche
  };

  console.log('%c🏉 MOM Hub · Évènements Browser v1.4 (S2.4.b) chargé',
    'color: #2D7D46; font-weight: bold;');

})();
