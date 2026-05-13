/**
 * MOM Hub · Compositions Editor
 * ============================================================
 *
 * Logique de l'éditeur de compositions (compositions.html).
 *
 * Phase 4.4 — Construit progressivement :
 *   - 6a : squelette HTML/CSS statique (placeholders)
 *   - 6b : chargement dynamique événements + sélecteur + compos
 *   - 6c-1 : panneau Effectif (vivier 63 joueurs branché) (CETTE VERSION)
 *   - 6c-2 : Vue Liste (XV + remplaçants + couleurs joueur)
 *   - 6c-3 : Popover Picker E5 (clic-clic d'ajout/remplacement)
 *   - 6c-4 : autosave + validation + repassage brouillon
 *   - 6c-5 : Vue Terrain (visualisation read-only XV)
 *   - 6c-6 : Modale Création E2 (radio base/match + dupliquer)
 *   - 6c-7 : Modale Historique E6 (versions précédentes)
 *
 * Dépendances :
 *   - js/supabase-client.js v1.7.1+ (SupabaseHub)
 *   - DOM de compositions.html (IDs définis ci-dessous)
 *
 * Version : 2.0 — Phase 4.4 étape 6c-1 (13 mai 2026)
 *   v1.0 — 6b : navigation événements + compos
 *   v2.0 — 6c-1 : ajout panneau Effectif (vivier)
 *     - State.vivier + State.filtreHideSAR
 *     - loadVivier() : 1 seul appel RPC getVivierCompo au démarrage
 *     - renderEffectifPanel() : tri par groupes + étiquettes + filtre
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CONSTANTES + ÉTAT GLOBAL
  // ============================================================

  // UUID de l'équipe M14 EQ1 (V1 hardcodé, multi-équipes V2 cf. P4-UI-1)
  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  const State = {
    evenements: [],
    selectedEvenementId: null,
    compos: [],
    selectedCompoId: null,
    // v2 (6c-1) :
    vivier: [],              // les 63 joueurs M14 piochables (1 fetch au démarrage)
    filtreHideSAR: false     // toggle "Masquer partenaires entente"
  };

  // ============================================================
  // 2. SÉLECTEURS DOM
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
    editorArea:        () => document.getElementById('editor-area'),
    // v2 (6c-1) :
    effectifTitle:     () => document.getElementById('effectif-title'),
    effectifFilter:    () => document.getElementById('effectif-filter-sar'),
    effectifBody:      () => document.getElementById('effectif-panel-body')
  };

  // ============================================================
  // 3. HELPERS UI
  // ============================================================

  function formatDateLong(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const mois  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
    const mois  = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]}`;
  }

  function libelleTypeEvenement(type) {
    if (type === 'entrainement')         return 'Entraînement';
    if (type === 'match')                return 'Match';
    if (type === 'journee_championnat')  return 'Match';
    if (type === 'tournoi')              return 'Tournoi';
    if (type === 'stage')                return 'Stage';
    return type || 'Événement';
  }

  function libelleEvenement(evt) {
    if (!evt) return '';
    if (evt.adversaire_nom) return 'vs ' + evt.adversaire_nom;
    return evt.libelle || evt.code || '';
  }

  function libelleEtatCompo(etat) {
    if (etat === 'brouillon') return 'Brouillon';
    if (etat === 'validee')   return 'Validée';
    if (etat === 'utilisee')  return 'Utilisée';
    if (etat === 'archivee')  return 'Archivée';
    return '';
  }

  // ----- Helpers v2 (vivier) -----

  // Initiales d'un nom pour l'avatar. "BARTHEL" → "BA", "DECOURCELLE" → "DE"
  function initiales(prenom, nom) {
    const p = (prenom || '').trim().charAt(0).toUpperCase();
    const n = (nom    || '').trim().charAt(0).toUpperCase();
    return (p + n) || '?';
  }

  // Étiquette discrète d'un joueur dans le vivier :
  //   F-15 prioritaire (plus parlant pour le coach)
  //   sinon SAR/ASCS pour partenaires
  //   sinon Renfort si statut_attache='renfort_temporaire'
  //   sinon rien (cas par défaut MOM régulier)
  function etiquetteJoueur(j) {
    if (j.f15_integree) return { label: 'F-15', kind: 'f15' };
    if (j.est_partenaire_entente) {
      const club = (j.club_principal_nom_court || '').toUpperCase();
      if (club === 'SAR' || club === 'ASCS') return { label: club, kind: 'partenaire' };
      return { label: 'Partenaire', kind: 'partenaire' };
    }
    if (j.statut_attache === 'renfort_temporaire') return { label: 'Renfort', kind: 'renfort' };
    return null;
  }

  // Détermine le groupe d'un joueur pour le tri en sections :
  //   'mom'        → Réguliers MOM (par défaut)
  //   'partenaire' → Partenaires SAR/ASCS
  //   'renfort'    → Renforts temporaires
  //   'autre'      → Non-attachés / en_transition
  function groupeJoueur(j) {
    if (j.est_partenaire_entente)              return 'partenaire';
    if (j.statut_attache === 'renfort_temporaire') return 'renfort';
    if (!j.statut_attache || j.statut_attache === 'en_transition') return 'autre';
    return 'mom';
  }

  // Tri alphabétique nom puis prénom
  function compareJoueurs(a, b) {
    const cmpN = (a.nom || '').localeCompare(b.nom || '', 'fr');
    if (cmpN !== 0) return cmpN;
    return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
  }

  // ============================================================
  // 4. RENDUS
  // ============================================================

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

  function renderCompoTabs() {
    const container = DOM.compoTabs();
    if (!container) return;
    container.innerHTML = '';

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

    const addTab = document.createElement('button');
    addTab.type = 'button';
    addTab.className = 'compo-tabs__tab compo-tabs__tab--add';
    addTab.textContent = '+';
    addTab.title = compoBase
      ? 'Créer une compo de match dérivée de la base'
      : 'Crée d\'abord une compo de base';
    addTab.disabled = !compoBase;
    addTab.addEventListener('click', function () {
      alert('Création de compo de match : à brancher en étape 6c-6');
    });
    container.appendChild(addTab);
  }

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
      '&nbsp;·&nbsp; <em style="color: var(--ink-mute);">détail joueurs en étape 6c-2</em>';
  }

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
          'arrive en étape 6c-2 et 6c-3.</em>' +
        '</p>' +
      '</div>';
  }

  // ----- v2 (6c-1) : rendu du panneau Effectif -----

  /**
   * Rendu du panneau Effectif (vivier des joueurs piochables).
   * En 6c-1, lecture seule : pas d'interaction au clic (sera ajoutée
   * en 6c-3 avec le Popover Picker).
   */
  function renderEffectifPanel() {
    const titleEl = DOM.effectifTitle();
    const bodyEl  = DOM.effectifBody();
    if (!bodyEl) return;

    // Filtrage selon le toggle "Masquer partenaires entente"
    let vivier = State.vivier;
    if (State.filtreHideSAR) {
      vivier = vivier.filter(j => !j.est_partenaire_entente);
    }

    // Titre dynamique avec le compteur filtré
    if (titleEl) {
      titleEl.textContent = 'Effectif (' + vivier.length + ')';
    }

    if (vivier.length === 0) {
      bodyEl.innerHTML =
        '<div class="effectif-panel__placeholder">' +
        '<em>Aucun joueur dans le vivier.</em>' +
        '</div>';
      return;
    }

    // Regroupement par catégorie
    const groupes = {
      mom:        { label: 'Réguliers MOM',        items: [] },
      partenaire: { label: 'Partenaires entente',  items: [] },
      renfort:    { label: 'Renforts temporaires', items: [] },
      autre:      { label: 'Non-attachés',         items: [] }
    };
    for (const j of vivier) {
      const g = groupeJoueur(j);
      groupes[g].items.push(j);
    }
    // Tri alpha à l'intérieur de chaque groupe
    for (const k in groupes) groupes[k].items.sort(compareJoueurs);

    // Construction du HTML
    let html = '';
    const ordre = ['mom', 'partenaire', 'renfort', 'autre'];
    for (const k of ordre) {
      const g = groupes[k];
      if (g.items.length === 0) continue;
      html += '<div class="effectif-group">';
      html +=   '<h3 class="effectif-group__title">' + g.label + ' <span class="effectif-group__count">(' + g.items.length + ')</span></h3>';
      html +=   '<ul class="effectif-list">';
      for (const j of g.items) {
        const etq = etiquetteJoueur(j);
        const tagHtml = etq
          ? '<span class="effectif-item__tag effectif-item__tag--' + etq.kind + '">' + etq.label + '</span>'
          : '';
        html += '<li class="effectif-item" data-joueur-id="' + j.joueur_id + '" title="' + (j.prenom || '') + ' ' + (j.nom || '') + '">';
        html +=   '<span class="effectif-item__avatar">' + initiales(j.prenom, j.nom) + '</span>';
        html +=   '<span class="effectif-item__name">';
        html +=     '<span class="effectif-item__nom">' + (j.nom || '?') + '</span>';
        html +=     '<span class="effectif-item__prenom">' + (j.prenom || '') + '</span>';
        html +=   '</span>';
        html +=   tagHtml;
        html += '</li>';
      }
      html +=   '</ul>';
      html += '</div>';
    }
    bodyEl.innerHTML = html;
  }

  // ============================================================
  // 5. ACTIONS
  // ============================================================

  async function selectEvenement(evtId) {
    State.selectedEvenementId = evtId;
    State.compos = [];
    State.selectedCompoId = null;
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    await loadComposForCurrentEvent();
    renderEventBanner();
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

  function toggleFiltreSAR(checked) {
    State.filtreHideSAR = !!checked;
    renderEffectifPanel();
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

    await loadComposForCurrentEvent();
    State.selectedCompoId = r.data.id;
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
  }

  // ============================================================
  // 6. CHARGEMENTS
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
    const all = await SupabaseHub.listCompositionsByEquipe(M14_TEAM_UUID);
    State.compos = all.filter(c => c.evenement_id === State.selectedEvenementId);

    const compoBase = State.compos.find(c => c.type_compo === 'base');
    if (compoBase) {
      State.selectedCompoId = compoBase.id;
    } else if (State.compos.length > 0) {
      State.selectedCompoId = State.compos[0].id;
    } else {
      State.selectedCompoId = null;
    }
  }

  // v2 (6c-1) : chargement du vivier (1 fetch, conservé tout au long
  // de la session — la composition de l'équipe ne change pas pendant
  // qu'on édite une compo, donc inutile de re-fetcher).
  async function loadVivier() {
    State.vivier = await SupabaseHub.getVivierCompo(M14_TEAM_UUID);
    return State.vivier;
  }

  // ============================================================
  // 7. INIT
  // ============================================================

  async function init() {
    // Chargements parallèles : événements + vivier (gain de latence)
    await Promise.all([
      loadEvenements(),
      loadVivier()
    ]);

    if (State.evenements.length > 0) {
      State.selectedEvenementId = State.evenements[0].id;
      await loadComposForCurrentEvent();
    }

    renderEventBanner();
    renderEventSelector();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();

    // Brancher le bouton du sélecteur d'événement
    const selBtn = DOM.eventSelectorBtn();
    if (selBtn) selBtn.addEventListener('click', toggleEventSelector);

    // Brancher le filtre "Masquer partenaires entente"
    const filterEl = DOM.effectifFilter();
    if (filterEl) {
      filterEl.addEventListener('change', function (e) {
        toggleFiltreSAR(e.target.checked);
      });
    }

    // Fermer la liste événement au clic en dehors
    document.addEventListener('click', function (e) {
      const list = DOM.eventSelectorList();
      const btn = DOM.eventSelectorBtn();
      if (!list || !list.classList.contains('is-open')) return;
      if (e.target === btn || btn.contains(e.target)) return;
      if (list.contains(e.target)) return;
      closeEventSelector();
    });

    console.log(
      '%c🏉 Compositions Editor v2 (étape 6c-1) chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        evenements: State.evenements.length,
        vivier: State.vivier.length,
        compos: State.compos.length
      }
    );
  }

  window.CompositionsEditor = {
    init: init,
    state: State,
    loadEvenements: loadEvenements,
    loadComposForCurrentEvent: loadComposForCurrentEvent,
    loadVivier: loadVivier
  };

})();
