/**
 * MOM Hub · Compositions Editor
 * ============================================================
 *
 * Phase 4.4 — Construit progressivement :
 *   - 6a/6b/6c-1 : déjà livrés (squelette, navigation, vivier)
 *   - 6c-2/6c-3 : Vue Liste éditable + Popover Picker (CETTE VERSION)
 *   - 6c-4 : autosave + validation + repassage brouillon
 *   - 6c-5 : Vue Terrain (visualisation read-only XV)
 *   - 6c-6 : Modale Création E2 complète
 *   - 6c-7 : Modale Historique E6
 *
 * Version : 3.0 — Phase 4.4 étape 6c-2/6c-3 (13 mai 2026)
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CONSTANTES + ÉTAT
  // ============================================================

  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';
  const M14_CATEGORIE_ID = 'cat-m14';
  const NB_TITULAIRES_XV = 15;
  const NB_REMPLACANTS = 8;

  const State = {
    evenements: [],
    selectedEvenementId: null,
    compos: [],
    selectedCompoId: null,
    vivier: [],
    vivierById: new Map(),
    filtreHideSAR: false,
    postes: [],
    postesById: new Map(),
    compoJoueurs: [],
    popover: null
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
    effectifTitle:     () => document.getElementById('effectif-title'),
    effectifFilter:    () => document.getElementById('effectif-filter-sar'),
    effectifBody:      () => document.getElementById('effectif-panel-body'),
    popoverRoot:       () => document.getElementById('popover-root')
  };

  // ============================================================
  // 3. HELPERS
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
  function initiales(prenom, nom) {
    const p = (prenom || '').trim().charAt(0).toUpperCase();
    const n = (nom    || '').trim().charAt(0).toUpperCase();
    return (p + n) || '?';
  }
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
  function groupeJoueur(j) {
    if (j.est_partenaire_entente)                                  return 'partenaire';
    if (j.statut_attache === 'renfort_temporaire')                 return 'renfort';
    if (!j.statut_attache || j.statut_attache === 'en_transition') return 'autre';
    return 'mom';
  }
  function compareJoueurs(a, b) {
    const cmpN = (a.nom || '').localeCompare(b.nom || '', 'fr');
    if (cmpN !== 0) return cmpN;
    return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
  }
  function getPoste(posteId) { return State.postesById.get(posteId); }
  function getJoueurVivier(joueurId) { return State.vivierById.get(joueurId); }
  function joueursDejaPlaces() {
    const set = new Set();
    for (const cj of State.compoJoueurs) set.add(cj.joueur_id);
    return set;
  }
  function postesVides() {
    const occupes = new Set();
    for (const cj of State.compoJoueurs) if (cj.role === 'titulaire') occupes.add(cj.poste_id);
    return State.postes.filter(p => !occupes.has(p.uuid));
  }
  function joueurDuPoste(posteId) {
    return State.compoJoueurs.find(cj => cj.role === 'titulaire' && cj.poste_id === posteId);
  }
  function compteurs() {
    const titulaires = State.compoJoueurs.filter(cj => cj.role === 'titulaire').length;
    const remplacants = State.compoJoueurs.filter(cj => cj.role === 'remplacant').length;
    const modifs = State.compoJoueurs.filter(cj => cj.etat_joueur && cj.etat_joueur !== 'base').length;
    return { titulaires, remplacants, modifs };
  }
  function cssClassEtatJoueur(etat) { return 'etat-' + (etat || 'base'); }
  function libelleEtatJoueurCourt(etat) {
    if (etat === 'base')        return 'Base';
    if (etat === 'modifie')     return 'Modifié';
    if (etat === 'independant') return 'Indép.';
    if (etat === 'blesse')      return 'Blessé';
    return '';
  }
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ============================================================
  // 4. RENDUS — banner, sélecteur, onglets, indicateur
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
      li.innerHTML =
        '<span class="event-selector__date">' + formatDateShort(evt.date_debut) + '</span>' +
        '<span class="event-selector__type">' + libelleTypeEvenement(evt.type_evenement) + '</span>' +
        '<span class="event-selector__label">' + escapeHtml(libelleEvenement(evt)) + '</span>';
      li.addEventListener('click', function () { selectEvenement(evt.id); closeEventSelector(); });
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
      if (compoBase.id === State.selectedCompoId) baseTab.classList.add('is-active');
      baseTab.addEventListener('click', function () { selectCompo(compoBase.id); });
    } else {
      baseTab.classList.add('compo-tabs__tab--placeholder');
      baseTab.title = 'Aucune compo de base créée';
      baseTab.disabled = true;
    }
    container.appendChild(baseTab);

    const compoMatchs = State.compos.filter(c => c.type_compo === 'match')
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    for (const m of compoMatchs) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'compo-tabs__tab';
      if (m.id === State.selectedCompoId) tab.classList.add('is-active');
      tab.textContent = libelleEvenement(State.evenements.find(e => e.id === m.evenement_id)) || 'Match';
      tab.addEventListener('click', function () { selectCompo(m.id); });
      container.appendChild(tab);
    }

    const addTab = document.createElement('button');
    addTab.type = 'button';
    addTab.className = 'compo-tabs__tab compo-tabs__tab--add';
    addTab.textContent = '+';
    addTab.title = compoBase ? 'Créer une compo de match dérivée de la base' : 'Crée d\'abord une compo de base';
    addTab.disabled = !compoBase;
    addTab.addEventListener('click', function () { alert('Création de compo de match : à brancher en étape 6c-6'); });
    container.appendChild(addTab);
  }

  function renderFillIndicator() {
    const el = DOM.fillIndicator();
    if (!el) return;
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.className = 'fill-indicator';
      el.innerHTML = '<em style="color: var(--ink-mute);">Aucune composition sélectionnée</em>';
      return;
    }
    const c = compteurs();
    const ratio = c.titulaires / NB_TITULAIRES_XV;
    let colorClass = 'fill-low';
    if (ratio >= 0.9)      colorClass = 'fill-high';
    else if (ratio >= 0.6) colorClass = 'fill-mid';
    el.className = 'fill-indicator ' + colorClass;
    el.innerHTML =
      '<strong>' + c.titulaires + ' / ' + NB_TITULAIRES_XV + ' postes pourvus</strong>' +
      '&nbsp;·&nbsp; ' + c.remplacants + ' / ' + NB_REMPLACANTS + ' remplaçants' +
      (compo.type_compo === 'match' ? '&nbsp;·&nbsp; ' + c.modifs + ' modification' + (c.modifs > 1 ? 's' : '') + ' vs base' : '');
  }

  // ============================================================
  // 5. RENDU — Vue Liste (XV + Remplaçants)
  // ============================================================

  function renderEditorArea() {
    const el = DOM.editorArea();
    if (!el) return;

    if (!State.selectedEvenementId) {
      el.innerHTML = '<div class="editor-area__placeholder">Sélectionnez un événement pour commencer.</div>';
      return;
    }
    if (State.compos.length === 0) {
      el.innerHTML =
        '<div class="editor-area__empty">' +
          '<p class="editor-area__empty-title">Aucune composition créée pour cet événement.</p>' +
          '<p class="editor-area__empty-text">Commence par créer la compo de base (plan A, J-7).</p>' +
          '<button type="button" id="btn-create-base" class="editor-area__cta">Créer la compo de base</button>' +
        '</div>';
      const btn = document.getElementById('btn-create-base');
      if (btn) btn.addEventListener('click', onCreateBaseClick);
      return;
    }
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.innerHTML = '<div class="editor-area__placeholder">Cliquez sur un onglet de composition pour l\'afficher.</div>';
      return;
    }

    let html = '<div class="view-liste">';
    html += '<section class="view-liste__section">';
    html +=   '<h3 class="view-liste__title">XV de départ</h3>';
    html +=   '<ul class="view-liste__slots">';
    for (const poste of State.postes) html += renderSlotPoste(poste);
    html +=   '</ul>';
    html += '</section>';

    const remplacants = State.compoJoueurs.filter(cj => cj.role === 'remplacant')
      .sort((a, b) => (a.ordre_remplacement || a.numero_maillot || 99) - (b.ordre_remplacement || b.numero_maillot || 99));
    html += '<section class="view-liste__section">';
    html +=   '<h3 class="view-liste__title">Remplaçants <span class="view-liste__count">(' + remplacants.length + '/' + NB_REMPLACANTS + ')</span></h3>';
    html +=   '<ul class="view-liste__slots view-liste__slots--remplacants">';
    for (let i = 0; i < NB_REMPLACANTS; i++) {
      html += renderSlotRemplacant(i + 16, remplacants[i]);
    }
    html +=   '</ul>';
    html += '</section>';
    html += '</div>';
    el.innerHTML = html;

    bindSlotHandlers();
  }

  function renderSlotPoste(poste) {
    const cj = joueurDuPoste(poste.uuid);
    if (!cj) {
      return (
        '<li class="slot slot--vide" data-poste-id="' + escapeHtml(poste.uuid) + '" data-role="titulaire">' +
          '<span class="slot__num">' + escapeHtml(poste.numero_maillot || '') + '</span>' +
          '<span class="slot__poste-label">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
          '<span class="slot__add">+ Ajouter</span>' +
        '</li>'
      );
    }
    const p = cj.personnes || {};
    return (
      '<li class="slot slot--occupe ' + cssClassEtatJoueur(cj.etat_joueur) + '" data-compo-joueur-id="' + escapeHtml(cj.id) + '" data-poste-id="' + escapeHtml(poste.uuid) + '">' +
        '<span class="slot__num">' + escapeHtml(cj.numero_maillot != null ? cj.numero_maillot : poste.numero_maillot || '') + '</span>' +
        '<span class="slot__poste-label">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
        '<span class="slot__joueur">' +
          '<span class="slot__nom">' + escapeHtml(p.nom || '?') + '</span>' +
          '<span class="slot__prenom">' + escapeHtml(p.prenom || '') + '</span>' +
        '</span>' +
        (cj.est_depannage_hors_categorie ? '<span class="slot__warning" title="Joueur hors catégorie M14">⚠</span>' : '') +
        '<span class="slot__etat" title="État du joueur">' + libelleEtatJoueurCourt(cj.etat_joueur) + '</span>' +
        '<button class="slot__remove" title="Retirer ce joueur" type="button">×</button>' +
      '</li>'
    );
  }

  function renderSlotRemplacant(numeroMaillot, cj) {
    if (!cj) {
      return (
        '<li class="slot slot--vide slot--remplacant" data-role="remplacant" data-numero-maillot="' + numeroMaillot + '">' +
          '<span class="slot__num">' + numeroMaillot + '</span>' +
          '<span class="slot__poste-label">Remp.</span>' +
          '<span class="slot__add">+ Ajouter</span>' +
        '</li>'
      );
    }
    const p = cj.personnes || {};
    return (
      '<li class="slot slot--occupe slot--remplacant ' + cssClassEtatJoueur(cj.etat_joueur) + '" data-compo-joueur-id="' + escapeHtml(cj.id) + '">' +
        '<span class="slot__num">' + escapeHtml(cj.numero_maillot || numeroMaillot) + '</span>' +
        '<span class="slot__poste-label">Remp.</span>' +
        '<span class="slot__joueur">' +
          '<span class="slot__nom">' + escapeHtml(p.nom || '?') + '</span>' +
          '<span class="slot__prenom">' + escapeHtml(p.prenom || '') + '</span>' +
        '</span>' +
        (cj.est_depannage_hors_categorie ? '<span class="slot__warning" title="Joueur hors catégorie M14">⚠</span>' : '') +
        '<span class="slot__etat">' + libelleEtatJoueurCourt(cj.etat_joueur) + '</span>' +
        '<button class="slot__remove" title="Retirer ce joueur" type="button">×</button>' +
      '</li>'
    );
  }

  function bindSlotHandlers() {
    document.querySelectorAll('.slot--vide').forEach(function (slot) {
      slot.addEventListener('click', function (e) {
        e.stopPropagation();
        const posteId = slot.dataset.posteId || null;
        const role    = slot.dataset.role || 'titulaire';
        const numero  = slot.dataset.numeroMaillot ? parseInt(slot.dataset.numeroMaillot, 10) : null;
        openPickerForSlot(posteId, role, numero);
      });
    });
    document.querySelectorAll('.slot--occupe .slot__remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const cjId = btn.closest('.slot').dataset.compoJoueurId;
        if (cjId) onRemoveJoueurClick(cjId);
      });
    });
  }

  // ============================================================
  // 6. PANNEAU EFFECTIF
  // ============================================================

  function renderEffectifPanel() {
    const titleEl = DOM.effectifTitle();
    const bodyEl  = DOM.effectifBody();
    if (!bodyEl) return;

    let vivier = State.vivier;
    if (State.filtreHideSAR) vivier = vivier.filter(j => !j.est_partenaire_entente);
    if (titleEl) titleEl.textContent = 'Effectif (' + vivier.length + ')';

    if (vivier.length === 0) {
      bodyEl.innerHTML = '<div class="effectif-panel__placeholder"><em>Aucun joueur dans le vivier.</em></div>';
      return;
    }

    const placedIds = joueursDejaPlaces();
    const groupes = {
      mom:        { label: 'Réguliers MOM',        items: [] },
      partenaire: { label: 'Partenaires entente',  items: [] },
      renfort:    { label: 'Renforts temporaires', items: [] },
      autre:      { label: 'Non-attachés',         items: [] }
    };
    for (const j of vivier) groupes[groupeJoueur(j)].items.push(j);
    for (const k in groupes) groupes[k].items.sort(compareJoueurs);

    let html = '';
    for (const k of ['mom', 'partenaire', 'renfort', 'autre']) {
      const g = groupes[k];
      if (g.items.length === 0) continue;
      html += '<div class="effectif-group">';
      html +=   '<h3 class="effectif-group__title">' + g.label + ' <span class="effectif-group__count">(' + g.items.length + ')</span></h3>';
      html +=   '<ul class="effectif-list">';
      for (const j of g.items) {
        const isPlaced = placedIds.has(j.joueur_id);
        const etq = etiquetteJoueur(j);
        const tagHtml = etq ? '<span class="effectif-item__tag effectif-item__tag--' + etq.kind + '">' + etq.label + '</span>' : '';
        html += '<li class="effectif-item' + (isPlaced ? ' effectif-item--placed' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '" title="' + escapeHtml((j.prenom || '') + ' ' + (j.nom || '')) + (isPlaced ? ' — déjà dans la compo' : '') + '">';
        html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
        html +=   '<span class="effectif-item__name">';
        html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
        html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
        html +=   '</span>';
        html +=   tagHtml;
        html += '</li>';
      }
      html +=   '</ul>';
      html += '</div>';
    }
    bodyEl.innerHTML = html;

    document.querySelectorAll('.effectif-item').forEach(function (item) {
      if (item.classList.contains('effectif-item--placed')) return;
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        const joueurId = item.dataset.joueurId;
        if (joueurId) openPickerForJoueur(joueurId);
      });
    });
  }

  // ============================================================
  // 7. POPOVER PICKER
  // ============================================================

  function openPickerForSlot(posteId, role, numeroMaillot) {
    if (!State.selectedCompoId) return;
    State.popover = { mode: 'slot-vide', posteId: posteId || null, role: role || 'titulaire', numeroMaillot: numeroMaillot || null, search: '' };
    renderPopover();
  }

  function openPickerForJoueur(joueurId) {
    if (!State.selectedCompoId) return;
    State.popover = { mode: 'joueur-vivier', joueurId: joueurId, search: '' };
    renderPopover();
  }

  function closePopover() {
    State.popover = null;
    renderPopover();
  }

  function renderPopover() {
    const root = DOM.popoverRoot();
    if (!root) return;
    if (!State.popover) { root.innerHTML = ''; root.classList.remove('is-open'); return; }

    if (State.popover.mode === 'slot-vide')      root.innerHTML = renderPopoverSlotVide();
    else if (State.popover.mode === 'joueur-vivier') root.innerHTML = renderPopoverJoueurVivier();
    root.classList.add('is-open');
    bindPopoverHandlers();
  }

  function renderPopoverSlotVide() {
    const pv = State.popover;
    const search = (pv.search || '').toLowerCase();
    const placedIds = joueursDejaPlaces();
    const candidates = State.vivier
      .filter(j => !placedIds.has(j.joueur_id))
      .filter(j => !search || ((j.nom || '') + ' ' + (j.prenom || '')).toLowerCase().includes(search))
      .sort(compareJoueurs);

    let titre;
    if (pv.role === 'titulaire' && pv.posteId) {
      const poste = getPoste(pv.posteId);
      titre = poste ? ('Poste ' + poste.numero_maillot + ' — ' + (poste.libelle_long || poste.libelle_court)) : 'Poste inconnu';
    } else {
      titre = 'Remplaçant n°' + (pv.numeroMaillot || '?');
    }

    let html = '<div class="popover" role="dialog" aria-label="Choisir un joueur">';
    html +=   '<div class="popover__header">';
    html +=     '<h3 class="popover__title">' + escapeHtml(titre) + '</h3>';
    html +=     '<button type="button" class="popover__close" data-action="close" aria-label="Fermer">×</button>';
    html +=   '</div>';
    html +=   '<div class="popover__search">';
    html +=     '<input type="text" class="popover__input" id="popover-search" placeholder="Rechercher un joueur…" value="' + escapeHtml(pv.search || '') + '" autocomplete="off">';
    html +=   '</div>';
    html +=   '<ul class="popover__list">';
    if (candidates.length === 0) {
      html += '<li class="popover__empty">Aucun joueur disponible.</li>';
    } else {
      for (const j of candidates) {
        const horsCat = j.categorie_id !== M14_CATEGORIE_ID;
        const etq = etiquetteJoueur(j);
        const tagHtml = etq ? '<span class="effectif-item__tag effectif-item__tag--' + etq.kind + '">' + etq.label + '</span>' : '';
        html += '<li class="popover__item' + (horsCat ? ' popover__item--warning' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '">';
        html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
        html +=   '<span class="effectif-item__name">';
        html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
        html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
        html +=   '</span>';
        html +=   tagHtml;
        if (horsCat) html += '<span class="popover__warning" title="Hors catégorie M14 (dépannage)">⚠</span>';
        html += '</li>';
      }
    }
    html +=   '</ul>';
    html += '</div>';
    return html;
  }

  function renderPopoverJoueurVivier() {
    const pv = State.popover;
    const joueur = getJoueurVivier(pv.joueurId);
    if (!joueur) return '';
    const search = (pv.search || '').toLowerCase();
    const postesLibres = postesVides().filter(p =>
      !search || (((p.libelle_long || '') + ' ' + (p.libelle_court || '') + ' ' + (p.code || '')).toLowerCase().includes(search))
    );

    let html = '<div class="popover" role="dialog" aria-label="Affecter à un poste">';
    html +=   '<div class="popover__header">';
    html +=     '<h3 class="popover__title">' + escapeHtml((joueur.nom || '') + ' ' + (joueur.prenom || '')) + '</h3>';
    html +=     '<button type="button" class="popover__close" data-action="close" aria-label="Fermer">×</button>';
    html +=   '</div>';
    html +=   '<p class="popover__subtitle">Choisir un poste libre ou la zone des remplaçants.</p>';
    html +=   '<div class="popover__search">';
    html +=     '<input type="text" class="popover__input" id="popover-search" placeholder="Rechercher un poste…" value="' + escapeHtml(pv.search || '') + '" autocomplete="off">';
    html +=   '</div>';
    html +=   '<ul class="popover__list">';
    if (postesLibres.length === 0) {
      html += '<li class="popover__empty">Tous les postes XV sont déjà occupés.</li>';
    } else {
      for (const p of postesLibres) {
        html += '<li class="popover__item popover__item--poste" data-poste-id="' + escapeHtml(p.uuid) + '">';
        html +=   '<span class="slot__num">' + escapeHtml(p.numero_maillot) + '</span>';
        html +=   '<span class="popover__poste-libelle">' + escapeHtml(p.libelle_long || p.libelle_court) + '</span>';
        html += '</li>';
      }
    }
    html += '<li class="popover__item popover__item--remp" data-mode="remplacant">';
    html +=   '<span class="slot__num">R</span>';
    html +=   '<span class="popover__poste-libelle">→ Mettre dans les remplaçants</span>';
    html += '</li>';
    html +=   '</ul>';
    html += '</div>';
    return html;
  }

  function bindPopoverHandlers() {
    const root = DOM.popoverRoot();
    if (!root) return;

    root.querySelectorAll('[data-action="close"]').forEach(el =>
      el.addEventListener('click', function (e) { e.stopPropagation(); closePopover(); })
    );

    const input = root.querySelector('#popover-search');
    if (input) {
      input.focus();
      input.addEventListener('input', function (e) {
        if (State.popover) State.popover.search = e.target.value;
        renderPopover();
      });
    }

    if (State.popover && State.popover.mode === 'slot-vide') {
      root.querySelectorAll('.popover__item[data-joueur-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickJoueurPourSlot(li.dataset.joueurId); })
      );
    } else if (State.popover && State.popover.mode === 'joueur-vivier') {
      root.querySelectorAll('.popover__item[data-poste-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(li.dataset.posteId); })
      );
      const rempEl = root.querySelector('.popover__item--remp');
      if (rempEl) rempEl.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(null); });
    }
  }

  function bindPopoverOutsideClick() {
    document.addEventListener('click', function (e) {
      const root = DOM.popoverRoot();
      if (!State.popover || !root) return;
      if (root.contains(e.target)) return;
      closePopover();
    });
  }

  // ============================================================
  // 8. ACTIONS
  // ============================================================

  async function selectEvenement(evtId) {
    State.selectedEvenementId = evtId;
    State.compos = [];
    State.selectedCompoId = null;
    State.compoJoueurs = [];
    closePopover();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();

    await loadComposForCurrentEvent();
    if (State.selectedCompoId) await loadCompoJoueurs();

    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function selectCompo(compoId) {
    State.selectedCompoId = compoId;
    State.compoJoueurs = [];
    closePopover();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();

    await loadCompoJoueurs();

    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  function toggleEventSelector() {
    const list = DOM.eventSelectorList();
    if (list) list.classList.toggle('is-open');
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

    const r = await SupabaseHub.createCompo({ evenement_id: State.selectedEvenementId, type_compo: 'base' });
    if (!r.ok) {
      alert('Erreur création compo de base : ' + r.error);
      if (btn) { btn.disabled = false; btn.textContent = 'Créer la compo de base'; }
      return;
    }
    await loadComposForCurrentEvent();
    State.selectedCompoId = r.data.id;
    await loadCompoJoueurs();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onPickJoueurPourSlot(joueurId) {
    const pv = State.popover;
    if (!pv) return;
    const joueur = getJoueurVivier(joueurId);
    if (!joueur) return;

    const horsCat = joueur.categorie_id !== M14_CATEGORIE_ID;
    const params = {
      composition_id: State.selectedCompoId,
      joueur_id: joueurId,
      role: pv.role || 'titulaire',
      etat_joueur: 'base',
      est_depannage_hors_categorie: horsCat
    };
    if (pv.role === 'titulaire' && pv.posteId) {
      params.poste_id = pv.posteId;
      const p = getPoste(pv.posteId);
      if (p && p.numero_maillot) params.numero_maillot = p.numero_maillot;
    } else if (pv.role === 'remplacant') {
      const libres = postesVides();
      params.poste_id = libres.length > 0 ? libres[0].uuid : State.postes[0].uuid;
      params.numero_maillot = pv.numeroMaillot || 16;
    }

    const r = await SupabaseHub.addJoueurCompo(params);
    if (!r.ok) { alert('Erreur ajout joueur : ' + r.error); return; }
    closePopover();
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onPickPostePourJoueur(posteId) {
    const pv = State.popover;
    if (!pv) return;
    const joueur = getJoueurVivier(pv.joueurId);
    if (!joueur) return;

    const horsCat = joueur.categorie_id !== M14_CATEGORIE_ID;
    const params = {
      composition_id: State.selectedCompoId,
      joueur_id: pv.joueurId,
      etat_joueur: 'base',
      est_depannage_hors_categorie: horsCat
    };
    if (posteId) {
      params.role = 'titulaire';
      params.poste_id = posteId;
      const p = getPoste(posteId);
      if (p && p.numero_maillot) params.numero_maillot = p.numero_maillot;
    } else {
      const remp = State.compoJoueurs.filter(cj => cj.role === 'remplacant');
      const usedNums = new Set(remp.map(cj => cj.numero_maillot).filter(Boolean));
      let nextNum = 16;
      while (usedNums.has(nextNum) && nextNum <= 23) nextNum++;
      params.role = 'remplacant';
      params.numero_maillot = nextNum <= 23 ? nextNum : null;
      const libres = postesVides();
      params.poste_id = libres.length > 0 ? libres[0].uuid : State.postes[0].uuid;
    }

    const r = await SupabaseHub.addJoueurCompo(params);
    if (!r.ok) { alert('Erreur ajout joueur : ' + r.error); return; }
    closePopover();
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onRemoveJoueurClick(compoJoueurId) {
    const r = await SupabaseHub.removeJoueurCompo(compoJoueurId);
    if (!r.ok) { alert('Erreur retrait : ' + r.error); return; }
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  // ============================================================
  // 9. CHARGEMENTS
  // ============================================================

  async function loadEvenements() {
    State.evenements = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, 60);
    return State.evenements;
  }
  async function loadComposForCurrentEvent() {
    if (!State.selectedEvenementId) { State.compos = []; return; }
    const all = await SupabaseHub.listCompositionsByEquipe(M14_TEAM_UUID);
    State.compos = all.filter(c => c.evenement_id === State.selectedEvenementId);
    const compoBase = State.compos.find(c => c.type_compo === 'base');
    if (compoBase)                       State.selectedCompoId = compoBase.id;
    else if (State.compos.length > 0)    State.selectedCompoId = State.compos[0].id;
    else                                 State.selectedCompoId = null;
  }
  async function loadCompoJoueurs() {
    if (!State.selectedCompoId) { State.compoJoueurs = []; return; }
    const complet = await SupabaseHub.getCompoComplete(State.selectedCompoId);
    State.compoJoueurs = complet ? complet.joueurs : [];
  }
  async function loadVivier() {
    State.vivier = await SupabaseHub.getVivierCompo(M14_TEAM_UUID);
    State.vivierById = new Map();
    for (const j of State.vivier) State.vivierById.set(j.joueur_id, j);
    return State.vivier;
  }
  async function loadPostes() {
    const all = await SupabaseHub.getPostes();
    // formats_applicables peut être un array OU une string CSV selon le mapping JSON→SQL. On gère les 2.
    State.postes = all.filter(function (p) {
      const fa = p.formats_applicables;
      if (Array.isArray(fa)) return fa.includes('XV');
      if (typeof fa === 'string') return fa.includes('XV');
      return true; // par défaut on garde (le tri par numéro fera le reste)
    }).sort((a, b) => (a.numero_maillot || 99) - (b.numero_maillot || 99));
    State.postesById = new Map();
    for (const p of State.postes) State.postesById.set(p.uuid, p);
    return State.postes;
  }

  // ============================================================
  // 10. INIT
  // ============================================================

  async function init() {
    await Promise.all([ loadEvenements(), loadVivier(), loadPostes() ]);

    if (State.evenements.length > 0) {
      State.selectedEvenementId = State.evenements[0].id;
      await loadComposForCurrentEvent();
      if (State.selectedCompoId) await loadCompoJoueurs();
    }

    renderEventBanner();
    renderEventSelector();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
    renderPopover();

    const selBtn = DOM.eventSelectorBtn();
    if (selBtn) selBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleEventSelector(); });

    const filterEl = DOM.effectifFilter();
    if (filterEl) filterEl.addEventListener('change', function (e) { toggleFiltreSAR(e.target.checked); });

    document.addEventListener('click', function (e) {
      const list = DOM.eventSelectorList();
      const btn = DOM.eventSelectorBtn();
      if (!list || !list.classList.contains('is-open')) return;
      if (e.target === btn || (btn && btn.contains(e.target))) return;
      if (list.contains(e.target)) return;
      closeEventSelector();
    });

    bindPopoverOutsideClick();

    console.log(
      '%c🏉 Compositions Editor v3 (étape 6c-2 + 6c-3) chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        evenements: State.evenements.length,
        vivier: State.vivier.length,
        postes: State.postes.length,
        compos: State.compos.length,
        compoJoueurs: State.compoJoueurs.length
      }
    );
  }

  window.CompositionsEditor = {
    init: init,
    state: State,
    loadEvenements: loadEvenements,
    loadComposForCurrentEvent: loadComposForCurrentEvent,
    loadCompoJoueurs: loadCompoJoueurs,
    loadVivier: loadVivier,
    loadPostes: loadPostes
  };

})();
