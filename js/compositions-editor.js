/**
 * MOM Hub · Compositions Editor
 * ============================================================
 *
 * Logique de l'éditeur de compositions (compositions.html).
 *
 * Phase 4.4 — Construit progressivement en 3 étapes :
 *   - 6a : squelette HTML/CSS statique (placeholders)
 *   - 6b : chargement dynamique des événements + sélecteur + liste
 *          des compos par événement + état vide (CETTE VERSION)
 *   - 6c : éditeur complet (vivier, Popover Picker, autosave,
 *          validation, modale E2 complète, etc.)
 *
 * Cette v1 ne gère QUE la navigation entre événements et compos.
 * L'édition de la compo elle-même (XV + remplaçants + drag-clic)
 * arrive en 6c.
 *
 * Dépendances :
 *   - js/supabase-client.js v1.7.1+ (SupabaseHub)
 *   - DOM de compositions.html (IDs définis ci-dessous)
 *
 * Version : 1.0 — Phase 4.4 étape 6b (13 mai 2026)
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CONSTANTES + ÉTAT GLOBAL
  // ============================================================

  // UUID de l'équipe M14 EQ1 (V1 hardcodé, multi-équipes en V2 cf. dette
  // P4-UI-1 du doc Conception §7.1)
  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  // État applicatif partagé entre les rendus. Volontairement plat
  // (pas de Redux ni de framework) — P1 simplicité.
  const State = {
    evenements: [],           // tous les événements à venir M14
    selectedEvenementId: null, // événement courant
    compos: [],               // toutes les compos de l'événement sélectionné
    selectedCompoId: null     // compo courante (BASE par défaut, sinon 1re trouvée)
  };

  // ============================================================
  // 2. SÉLECTEURS DOM (référencés par id depuis compositions.html)
  // ============================================================

  const DOM = {
    eventBannerType:   () => document.getElementById('event-type'),
    eventBannerLabel:  () => document.getElementById('event-label'),
    eventBannerMeta:   () => document.getElementById('event-meta'),
    eventBannerState:  () => document.getElementById('event-state'),
    eventSelectorBtn:  () => document.getElementById('event-selector-btn'),
    eventSelectorList: () => document.getElementById('event-selector-list'),
    compoTabs:         () => document.getElementById('compo-tabs'),
    fillIndicator:     () => document.getElementById('fill-indicator'),
    editorArea:        () => document.getElementById('editor-area')
  };

  // ============================================================
  // 3. HELPERS UI
  // ============================================================

  // Format date pour le bandeau événement : "samedi 23 mai 2026"
  function formatDateLong(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const mois  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Format date courte pour le sélecteur : "lun. 18 mai"
  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
    const mois  = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]}`;
  }

  // Libellé du type d'événement (humanisé)
  function libelleTypeEvenement(type) {
    if (type === 'entrainement')         return 'Entraînement';
    if (type === 'match')                return 'Match';
    if (type === 'journee_championnat')  return 'Match';
    if (type === 'tournoi')              return 'Tournoi';
    if (type === 'stage')                return 'Stage';
    return type || 'Événement';
  }

  // Libellé court de l'événement, sans préfixe redondant
  // ("EVT-2026-05-23-LES-GEMMEURS-M14" → "vs Les Gemmeurs" si adversaire,
  //  sinon depuis le libelle nettoyé)
  function libelleEvenement(evt) {
    if (!evt) return '';
    if (evt.adversaire_nom) return 'vs ' + evt.adversaire_nom;
    return evt.libelle || evt.code || '';
  }

  // Libellé d'état de compo (pour la pastille)
  function libelleEtatCompo(etat) {
    if (etat === 'brouillon') return 'Brouillon';
    if (etat === 'validee')   return 'Validée';
    if (etat === 'utilisee')  return 'Utilisée';
    if (etat === 'archivee')  return 'Archivée';
    return '';
  }

  // ============================================================
  // 4. RENDUS — chaque fonction (re)peint une zone du DOM
  // ============================================================

  /**
   * Rendu du bandeau événement (type, label, lieu, état de la compo BASE).
   */
  function renderEventBanner() {
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
    DOM.eventBannerLabel().textContent = libelleEvenement(evt) + ' · ' + formatDateLong(evt.date_debut);
    DOM.eventBannerMeta().textContent  = evt.site_libelle_court || '';

    // Pastille d'état : basée sur la compo BASE s'il y en a une, sinon vide
    const compoBase = State.compos.find(c => c.type_compo === 'base');
    const stateEl = DOM.eventBannerState();
    if (compoBase) {
      stateEl.textContent = libelleEtatCompo(compoBase.etat);
      stateEl.className   = 'event-banner__state state-' + compoBase.etat;
    } else {
      stateEl.textContent = 'Aucune compo';
      stateEl.className   = 'event-banner__state';
    }
  }

  /**
   * Rendu du dropdown de sélection d'événement (liste cliquable).
   * Reste caché tant qu'on ne clique pas sur le bandeau.
   */
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
      li.dataset.evtId = evt.id;
      li.innerHTML =
        '<span class="event-selector__date">' + formatDateShort(evt.date_debut) + '</span>' +
        '<span class="event-selector__type">' + libelleTypeEvenement(evt.type_evenement) + '</span>' +
        '<span class="event-selector__label">' + libelleEvenement(evt) + '</span>';
      li.addEventListener('click', function () {
        selectEvenement(evt.id);
        closeEventSelector();
      });
      list.appendChild(li);
    }
  }

  /**
   * Rendu de la barre d'onglets [BASE] / matchs dérivés / [+].
   */
  function renderCompoTabs() {
    const container = DOM.compoTabs();
    if (!container) return;
    container.innerHTML = '';

    // Onglet BASE (toujours présent, même si compo non créée)
    const compoBase = State.compos.find(c => c.type_compo === 'base');
    const baseTab = document.createElement('button');
    baseTab.type = 'button';
    baseTab.className = 'compo-tabs__tab';
    baseTab.textContent = 'Base';
    if (compoBase) {
      baseTab.dataset.compoId = compoBase.id;
      if (compoBase.id === State.selectedCompoId) baseTab.classList.add('is-active');
      baseTab.addEventListener('click', function () { selectCompo(compoBase.id); });
    } else {
      baseTab.classList.add('compo-tabs__tab--placeholder');
      baseTab.title = 'Aucune compo de base créée';
      baseTab.disabled = true;
    }
    container.appendChild(baseTab);

    // Onglets matchs dérivés
    const compoMatchs = State.compos
      .filter(c => c.type_compo === 'match')
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    for (const m of compoMatchs) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'compo-tabs__tab';
      tab.dataset.compoId = m.id;
      if (m.id === State.selectedCompoId) tab.classList.add('is-active');
      tab.textContent = libelleEvenement(State.evenements.find(e => e.id === m.evenement_id)) || 'Match';
      tab.addEventListener('click', function () { selectCompo(m.id); });
      container.appendChild(tab);
    }

    // Bouton + (création d'un match dérivé, désactivé tant que pas de BASE)
    const addTab = document.createElement('button');
    addTab.type = 'button';
    addTab.className = 'compo-tabs__tab compo-tabs__tab--add';
    addTab.textContent = '+';
    addTab.title = compoBase
      ? 'Créer une compo de match dérivée de la base'
      : 'Crée d\'abord une compo de base';
    addTab.disabled = !compoBase;
    addTab.addEventListener('click', function () {
      alert('Création de compo de match : à brancher en étape 6c');
    });
    container.appendChild(addTab);
  }

  /**
   * Rendu de l'indicateur de remplissage permanent.
   * En 6b on n'a pas encore les composition_joueurs chargés en mémoire,
   * donc on reste sur un affichage minimaliste. Détail vivant en 6c.
   */
  function renderFillIndicator() {
    const el = DOM.fillIndicator();
    if (!el) return;
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.innerHTML = '<em style="color: var(--ink-mute);">Aucune composition sélectionnée</em>';
      return;
    }
    el.innerHTML =
      '<strong>Composition ' + libelleEtatCompo(compo.etat).toLowerCase() + '</strong>' +
      '&nbsp;·&nbsp; v' + compo.version +
      '&nbsp;·&nbsp; type ' + compo.type_compo +
      '&nbsp;·&nbsp; <em style="color: var(--ink-mute);">détail joueurs en étape 6c</em>';
  }

  /**
   * Rendu de la zone d'édition centrale.
   * Trois cas : aucune compo → bouton "Créer la compo de base" ;
   * compo sélectionnée → récap simple ; pas d'événement → message.
   */
  function renderEditorArea() {
    const el = DOM.editorArea();
    if (!el) return;

    if (!State.selectedEvenementId) {
      el.innerHTML =
        '<div class="editor-area__placeholder">' +
        'Sélectionnez un événement pour commencer.' +
        '</div>';
      return;
    }

    if (State.compos.length === 0) {
      // Aucune compo pour cet événement → CTA "Créer la compo de base"
      el.innerHTML =
        '<div class="editor-area__empty">' +
          '<p class="editor-area__empty-title">Aucune composition créée pour cet événement.</p>' +
          '<p class="editor-area__empty-text">Commence par créer la compo de base (plan A, J-7).</p>' +
          '<button type="button" id="btn-create-base" class="editor-area__cta">' +
            'Créer la compo de base' +
          '</button>' +
        '</div>';
      const btn = document.getElementById('btn-create-base');
      if (btn) btn.addEventListener('click', onCreateBaseClick);
      return;
    }

    // Une compo est sélectionnée : on affiche un récap simple
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.innerHTML =
        '<div class="editor-area__placeholder">' +
        'Cliquez sur un onglet de composition pour l\'afficher.' +
        '</div>';
      return;
    }

    el.innerHTML =
      '<div class="editor-area__recap">' +
        '<p class="editor-area__recap-title">Composition ' + (compo.type_compo === 'base' ? 'de base' : 'de match') + '</p>' +
        '<dl class="editor-area__recap-list">' +
          '<dt>État</dt><dd>' + libelleEtatCompo(compo.etat) + '</dd>' +
          '<dt>Version</dt><dd>v' + compo.version + '</dd>' +
          '<dt>Type</dt><dd>' + compo.type_compo + '</dd>' +
          '<dt>Créée le</dt><dd>' + new Date(compo.created_at).toLocaleString('fr-FR') + '</dd>' +
          (compo.compo_base_origine_id
            ? '<dt>Dérivée de</dt><dd>compo de base ' + compo.compo_base_origine_id.substring(0, 8) + '…</dd>'
            : '') +
        '</dl>' +
        '<p class="editor-area__recap-todo">' +
          '<em>L\'éditeur complet (XV + remplaçants + clic-clic + Popover Picker) ' +
          'arrive en étape 6c.</em>' +
        '</p>' +
      '</div>';
  }

  // ============================================================
  // 5. ACTIONS — réagissent aux interactions utilisateur
  // ============================================================

  async function selectEvenement(evtId) {
    State.selectedEvenementId = evtId;
    State.compos = [];
    State.selectedCompoId = null;
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    // Charger les compos de cet événement
    await loadComposForCurrentEvent();
    renderEventBanner();    // peut changer si compo BASE détectée (pastille état)
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
  }

  function selectCompo(compoId) {
    State.selectedCompoId = compoId;
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
  }

  function toggleEventSelector() {
    const list = DOM.eventSelectorList();
    if (!list) return;
    list.classList.toggle('is-open');
  }

  function closeEventSelector() {
    const list = DOM.eventSelectorList();
    if (list) list.classList.remove('is-open');
  }

  async function onCreateBaseClick() {
    if (!State.selectedEvenementId) return;
    const btn = document.getElementById('btn-create-base');
    if (btn) { btn.disabled = true; btn.textContent = 'Création en cours…'; }

    const r = await SupabaseHub.createCompo({
      evenement_id: State.selectedEvenementId,
      type_compo: 'base'
    });

    if (!r.ok) {
      alert('Erreur création compo de base : ' + r.error);
      if (btn) { btn.disabled = false; btn.textContent = 'Créer la compo de base'; }
      return;
    }

    // Recharger les compos pour voir la nouvelle, et la sélectionner
    await loadComposForCurrentEvent();
    State.selectedCompoId = r.data.id;
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
  }

  // ============================================================
  // 6. CHARGEMENTS — requêtes Supabase
  // ============================================================

  async function loadEvenements() {
    State.evenements = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, 60);
    return State.evenements;
  }

  async function loadComposForCurrentEvent() {
    if (!State.selectedEvenementId) {
      State.compos = [];
      return;
    }
    // Récupère toutes les compos M14 actives, puis filtre côté JS sur l'événement
    // (l'API listCompositionsByEquipe ne filtre pas par evenement_id — on pourrait
    // l'ajouter en option plus tard, mais 4 événements M14 × 1-3 compos = ~12 lignes
    // max au stade actuel)
    const all = await SupabaseHub.listCompositionsByEquipe(M14_TEAM_UUID);
    State.compos = all.filter(c => c.evenement_id === State.selectedEvenementId);

    // Sélection par défaut : compo BASE si elle existe, sinon la 1re trouvée
    const compoBase = State.compos.find(c => c.type_compo === 'base');
    if (compoBase) {
      State.selectedCompoId = compoBase.id;
    } else if (State.compos.length > 0) {
      State.selectedCompoId = State.compos[0].id;
    } else {
      State.selectedCompoId = null;
    }
  }

  // ============================================================
  // 7. INIT
  // ============================================================

  async function init() {
    // 1. Charger les événements à venir
    await loadEvenements();

    // 2. Sélectionner par défaut le 1er événement (le plus proche)
    if (State.evenements.length > 0) {
      State.selectedEvenementId = State.evenements[0].id;
      await loadComposForCurrentEvent();
    }

    // 3. Premier rendu complet
    renderEventBanner();
    renderEventSelector();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();

    // 4. Brancher le bouton du sélecteur d'événement (toggle de la liste)
    const selBtn = DOM.eventSelectorBtn();
    if (selBtn) {
      selBtn.addEventListener('click', toggleEventSelector);
    }
    // Fermer la liste au clic en dehors
    document.addEventListener('click', function (e) {
      const list = DOM.eventSelectorList();
      const btn = DOM.eventSelectorBtn();
      if (!list || !list.classList.contains('is-open')) return;
      if (e.target === btn || btn.contains(e.target)) return;
      if (list.contains(e.target)) return;
      closeEventSelector();
    });

    console.log(
      '%c🏉 Compositions Editor v1 (étape 6b) chargé',
      'color: #2D7D46; font-weight: bold;',
      { evenements: State.evenements.length, compos: State.compos.length }
    );
  }

  // Exposition globale pour debug console
  window.CompositionsEditor = {
    init: init,
    state: State,
    loadEvenements: loadEvenements,
    loadComposForCurrentEvent: loadComposForCurrentEvent
  };

})();
