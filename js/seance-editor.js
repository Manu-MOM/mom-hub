/**
 * MOM Hub · Seance Editor
 * ============================================================
 *
 * Module IIFE qui pilote la page seance.html (Préparation de séance).
 * Calqué sur le pattern compositions-editor.js (Phase 4.4) :
 * sections numérotées, State global au module, DOM selectors lazy,
 * helpers, rendus, actions, chargements, init.
 *
 * Phase 5.5 — Construit progressivement :
 *   - 5.5.A : éditeur méta + sauvegarde manuelle (CETTE VERSION)
 *   - 5.5.B : autosave 30s + dropdowns lieu/événement + champs secondaires
 *
 * Version : 1.4 — Phase 5.6.B (15 mai 2026)
 *   v1.0 : squelette IIFE, sidebar liste séances, bouton "+ Nouvelle séance",
 *          formulaire 6 champs méta (date, heure, durée, effectif, thème,
 *          axe de travail), sauvegarde manuelle via updateSeance(), feedback
 *          success/error. Sans autosave (Phase 5.5.B), sans lieu_id ni
 *          evenement_id (différés Phase 5.5.B après vérif schéma sites).
 *   v1.1 : Phase 5.5.B1 — ajout des 5 champs secondaires (meteo_text,
 *          encadrants_text, objectifs_text, bloc_cycle, materiel_global_text)
 *          + 2 dropdowns (lieu_id via listSitesActifs, evenement_id via
 *          getEvenementsAVenir). Toujours sauvegarde manuelle (autosave 30s
 *          et clic sidebar différés en Phase 5.5.B2).
 *   v1.2 : Phase 5.5.B2 — (1) autosave 30s : timer relancé à chaque ouverture
 *          de formulaire, vérifie State.isDirty à chaque tick et sauve
 *          silencieusement si dirty. Pastille .seance-autosave-pill dans
 *          le header du form avec 3 états (idle/saving/error).
 *          (2) clic sur item sidebar : recharge le formulaire avec la séance
 *          cliquée. confirm() natif si modif non sauvée.
 *          Refactor : extraction de la logique de save dans saveSeance(opts)
 *          partagée par onSaveSeance (manuel) et autosave (silencieux).
 *   v1.3 : Phase 5.6.A — trame chronologique (palier 1/2).
 *          Chargement des blocs via listBlocsBySeance(seanceId) (wrapper
 *          v1.8.2). Rendu d'une table 4 colonnes (Horaire | Bloc | Durée |
 *          Actions) sous le formulaire méta, triée par ordre. Calcul auto
 *          des horaires à partir de seance.heure_debut + cumul duree_min.
 *          Bouton "+ Ajouter un bloc" ouvre un popover de choix parmi les
 *          11 types (fetched data/types-blocs.json). Création via
 *          addBlocToSeance() avec duree_min + intensite par défaut du type.
 *          Boutons d'actions ↑↓🗑 différés au palier 5.6.B.
 *   v1.4 : Phase 5.6.B — trame chronologique (palier 2/2) + ergonomie.
 *          (1) Actions par bloc : boutons ↑ (move-up), ↓ (move-down),
 *          🗑 (remove). Move-up/down via reorderBlocs(seanceId, [ids dans
 *          nouvel ordre]). Suppression via removeBloc(blocId) avec
 *          confirm(). ↑ désactivé sur le 1er bloc, ↓ sur le dernier.
 *          (2) Repli du formulaire méta en résumé compact après save
 *          (arbitrage Manu 15 mai d'après screenshot Phase 5.6.A) : une
 *          fois la séance enregistrée, le form se replie en 1 ligne
 *          (📅 date · heure · durée · effectif · état) avec bouton
 *          "✏️ Modifier" pour redéployer. État stocké dans
 *          State.formCollapsed (default true si séance chargée avec
 *          date_seance non null, sinon false pour rester ouvert sur
 *          nouvelles séances vides). Donne toute la place à la trame.
 *
 * Dépendances :
 *   - window.SupabaseHub v1.8.2 (wrappers Phase 5.3 + listSitesActifs +
 *     listBlocsBySeance)
 *   - data/types-blocs.json v1.1 (fetched à l'init)
 *   - DOM : #seance-sidebar-body, #btn-nouvelle-seance, #seance-editor-area,
 *     #btn-nouvelle-seance-cta (placeholder existants de seance.html v1)
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CONSTANTES + ÉTAT
  // ============================================================

  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';
  const NB_SEANCES_RECENTES = 10;
  const DUREE_DEFAULT_MIN = 75;
  const AUTOSAVE_INTERVAL_MS = 30000; // 30 secondes (Phase 5.5.B2)

  const State = {
    seances: [],            // liste pour la sidebar
    currentSeance: null,    // séance en cours d'édition (objet complet)
    isDirty: false,         // true si modif non sauvée
    sites: [],              // cache pour dropdown lieu_id (5.5.B1)
    evenements: [],         // cache pour dropdown evenement_id (5.5.B1)
    autosaveTimer: null,    // handle setInterval (5.5.B2)
    autosaveStatus: 'idle', // 'idle' | 'saving' | 'error' (5.5.B2)
    blocs: [],              // blocs de la séance courante, triés par ordre (5.6.A)
    typesBlocsRef: null,    // référentiel des 11 types (data/types-blocs.json, 5.6.A)
    picker: null,           // état du popover "+ Ajouter un bloc" ({open: bool}, 5.6.A)
    formCollapsed: false    // true : form méta replié en résumé compact (5.6.B)
  };

  // ============================================================
  // 2. SÉLECTEURS DOM
  // ============================================================

  const DOM = {
    sidebarBody:   () => document.getElementById('seance-sidebar-body'),
    sidebarCta:    () => document.getElementById('btn-nouvelle-seance'),
    editorArea:    () => document.getElementById('seance-editor-area'),
    ctaCenter:     () => document.getElementById('btn-nouvelle-seance-cta'),
    // Champs du formulaire (n'existent que si renderForm() a été appelé)
    inputDate:        () => document.getElementById('seance-input-date'),
    inputHeure:       () => document.getElementById('seance-input-heure'),
    inputDuree:       () => document.getElementById('seance-input-duree'),
    inputEffectif:    () => document.getElementById('seance-input-effectif'),
    inputTheme:       () => document.getElementById('seance-input-theme'),
    inputAxe:         () => document.getElementById('seance-input-axe'),
    // Phase 5.5.B1 : 2 dropdowns + 5 champs secondaires
    selectLieu:       () => document.getElementById('seance-select-lieu'),
    selectEvenement:  () => document.getElementById('seance-select-evenement'),
    inputMeteo:       () => document.getElementById('seance-input-meteo'),
    inputEncadrants:  () => document.getElementById('seance-input-encadrants'),
    inputObjectifs:   () => document.getElementById('seance-input-objectifs'),
    inputCycle:       () => document.getElementById('seance-input-cycle'),
    inputMateriel:    () => document.getElementById('seance-input-materiel'),
    btnSave:       () => document.getElementById('seance-btn-save'),
    feedback:      () => document.getElementById('seance-feedback'),
    autosavePill:  () => document.getElementById('seance-autosave-pill'),
    // Phase 5.6.A : trame chronologique
    trameSection: () => document.getElementById('seance-trame-section'),
    trameBody:    () => document.getElementById('seance-trame-body'),
    btnAddBloc:   () => document.getElementById('seance-btn-add-bloc'),
    pickerRoot:   () => document.getElementById('seance-picker-root')
  };

  // ============================================================
  // 3. HELPERS
  // ============================================================

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const jours = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
    const mois  = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()];
  }

  function libelleEtatSeance(etat) {
    if (etat === 'brouillon') return 'Brouillon';
    if (etat === 'validee')   return 'Validée';
    if (etat === 'utilisee')  return 'Utilisée';
    if (etat === 'archivee')  return 'Archivée';
    return etat || '—';
  }

  // Formate une time SQL ('18:30:00' ou '18:30') en 'HH:MM' pour <input type="time">
  function normalizeHeureForInput(heureSql) {
    if (!heureSql) return '';
    return String(heureSql).substring(0, 5);
  }

  function libelleSite(site) {
    if (!site) return '';
    // Préférence : libelle, sinon libelle_court, sinon code
    const base = site.libelle || site.libelle_court || site.code || '(sans nom)';
    return site.ville ? base + ' — ' + site.ville : base;
  }

  function libelleEvenement(evt) {
    if (!evt) return '';
    const date = evt.date_debut ? formatDateShort(evt.date_debut) : '';
    let nom;
    if (evt.adversaire_nom) {
      nom = 'vs ' + evt.adversaire_nom;
    } else {
      nom = evt.libelle || evt.code || 'Événement';
    }
    return date ? (date + ' · ' + nom) : nom;
  }

  // ----- Helpers Phase 5.6.A : trame chronologique -----

  /**
   * Cherche un type de bloc dans le référentiel chargé depuis types-blocs.json.
   * @param {string} slug ex : 'echauffement'
   * @returns {object|null} L'objet type avec emoji, libelle, etc. ; null si introuvable
   */
  function lookupTypeBloc(slug) {
    if (!State.typesBlocsRef || !slug) return null;
    const list = State.typesBlocsRef.types_blocs && State.typesBlocsRef.types_blocs.valeurs;
    if (!Array.isArray(list)) return null;
    return list.find(function (t) { return t.slug === slug; }) || null;
  }

  /**
   * Ajoute N minutes à une heure 'HH:MM' et retourne 'HH:MM'.
   * Gère le passage de minuit en mod 24h.
   */
  function addMinutesToHeure(heureHHMM, minutes) {
    if (!heureHHMM) return '';
    const parts = heureHHMM.split(':');
    if (parts.length < 2) return '';
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return '';
    let total = h * 60 + m + (parseInt(minutes, 10) || 0);
    total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60); // wrap 24h
    const newH = Math.floor(total / 60);
    const newM = total % 60;
    return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
  }

  function showFeedback(msg, type) {
    const el = DOM.feedback();
    if (!el) return;
    el.textContent = msg;
    el.className = 'seance-feedback is-visible seance-feedback--' + (type || 'info');
    // Auto-masquage après 4 secondes pour success/info
    if (type !== 'error') {
      setTimeout(function () {
        if (el.textContent === msg) {
          el.className = 'seance-feedback';
        }
      }, 4000);
    }
  }

  function setDirty(dirty) {
    State.isDirty = !!dirty;
    const btn = DOM.btnSave();
    if (btn) {
      btn.disabled = !dirty;
      btn.textContent = dirty ? '💾 Enregistrer les modifications' : '✓ Enregistré';
    }
  }

  function setAutosaveStatus(status) {
    State.autosaveStatus = status;
    const pill = DOM.autosavePill();
    if (!pill) return;
    // 3 états : 'idle' (vert "Sauvé"), 'saving' (ambre "Sauvegarde…"),
    // 'error' (rouge "Erreur autosave"). Toujours visible quand un form
    // est affiché ; les changements de couleur signalent l'activité.
    pill.classList.remove('is-idle','is-saving','is-error');
    if (status === 'saving') {
      pill.classList.add('is-saving');
      pill.textContent = '● Sauvegarde…';
    } else if (status === 'error') {
      pill.classList.add('is-error');
      pill.textContent = '● Erreur autosave';
    } else {
      pill.classList.add('is-idle');
      pill.textContent = '● Sauvé';
    }
  }

  // ============================================================
  // 4. RENDU SIDEBAR — Liste des séances récentes
  // ============================================================

  function renderSidebar() {
    const body = DOM.sidebarBody();
    if (!body) return;

    if (State.seances.length === 0) {
      body.innerHTML =
        '<div class="seance-sidebar__placeholder">' +
          'Aucune séance pour l\'instant.<br>' +
          'Clique sur « + Nouvelle séance » pour démarrer.' +
        '</div>';
      return;
    }

    const items = State.seances.map(function (s) {
      const isSelected = State.currentSeance && State.currentSeance.id === s.id;
      const dateLib = s.date_seance ? formatDateShort(s.date_seance) : 'Sans date';
      const heureLib = s.heure_debut ? normalizeHeureForInput(s.heure_debut) : '';
      const etatLib = libelleEtatSeance(s.etat);
      const titre = s.axe_travail_general
        ? escapeHtml(s.axe_travail_general).substring(0, 60)
        : (s.theme_principal ? escapeHtml(s.theme_principal).substring(0, 60) : 'Séance sans thème');
      return (
        '<li class="seance-list-item' + (isSelected ? ' is-selected' : '') + '" ' +
            'data-seance-id="' + escapeHtml(s.id) + '" ' +
            'title="Cliquer pour ouvrir cette séance">' +
          '<div class="seance-list-item__head">' +
            '<span class="seance-list-item__date">' + dateLib + (heureLib ? ' · ' + heureLib : '') + '</span>' +
            '<span class="seance-list-item__etat etat-' + escapeHtml(s.etat) + '">' + etatLib + '</span>' +
          '</div>' +
          '<div class="seance-list-item__title">' + titre + '</div>' +
        '</li>'
      );
    }).join('');

    body.innerHTML = '<ul class="seance-list">' + items + '</ul>';
    // Phase 5.5.B2 : câble le clic sur chaque item → recharge la séance
    const lis = body.querySelectorAll('.seance-list-item');
    lis.forEach(function (li) {
      li.addEventListener('click', function () {
        const id = li.getAttribute('data-seance-id');
        onSelectSeance(id);
      });
    });
  }

  // ============================================================
  // 5. RENDU ÉDITEUR
  // ============================================================

  function renderEmptyEditor() {
    const area = DOM.editorArea();
    if (!area) return;
    area.innerHTML =
      '<div class="seance-editor-area__empty">' +
        '<h3 class="seance-editor-area__empty-title">Aucune séance sélectionnée</h3>' +
        '<p class="seance-editor-area__empty-text">' +
          'Clique sur « + Nouvelle séance » dans la barre latérale pour en créer une.' +
        '</p>' +
      '</div>';
  }

  /**
   * Dispatcher : choisit entre renderFormCollapsed (résumé compact) et
   * renderFormExpanded (formulaire complet) selon State.formCollapsed.
   * Phase 5.6.B.
   */
  function renderForm() {
    if (State.formCollapsed) {
      renderFormCollapsed();
    } else {
      renderFormExpanded();
    }
  }

  /**
   * Rend le formulaire méta replié en 1 ligne (résumé compact).
   * Affiché par défaut quand on ouvre une séance déjà documentée
   * (date_seance non null). Bouton "✏️ Modifier" pour redéployer.
   * Phase 5.6.B.
   */
  function renderFormCollapsed() {
    const area = DOM.editorArea();
    if (!area || !State.currentSeance) return;
    const s = State.currentSeance;

    // Construire le résumé : "📅 ven. 15 mai · 18:30 · 75 min · Effectif 23"
    const parts = [];
    if (s.date_seance) {
      parts.push('📅 ' + formatDateShort(s.date_seance));
    } else {
      parts.push('📅 sans date');
    }
    if (s.heure_debut) {
      parts.push(normalizeHeureForInput(s.heure_debut));
    }
    if (s.duree_totale_min) {
      parts.push(s.duree_totale_min + ' min');
    }
    if (s.effectif_prevu) {
      parts.push('Effectif ' + s.effectif_prevu);
    }
    if (s.theme_principal) {
      parts.push('« ' + escapeHtml(s.theme_principal) + ' »');
    }

    area.innerHTML =
      '<div class="seance-form-collapsed">' +
        '<div class="seance-form-collapsed__left">' +
          '<span class="seance-form-collapsed__summary">' + parts.join(' · ') + '</span>' +
          '<span class="seance-form-collapsed__etat etat-' + escapeHtml(s.etat) + '">' + libelleEtatSeance(s.etat) + '</span>' +
        '</div>' +
        '<div class="seance-form-collapsed__right">' +
          '<span id="seance-autosave-pill" class="seance-autosave-pill is-idle" title="Sauvegarde automatique (30s si modifications)">● Sauvé</span>' +
          '<button type="button" id="seance-btn-expand-form" class="seance-form-collapsed__edit-btn" title="Modifier les méta de la séance">' +
            '✏️ Modifier' +
          '</button>' +
        '</div>' +
        '<div id="seance-feedback" class="seance-feedback"></div>' +
      '</div>';

    // Bind du bouton "✏️ Modifier"
    const btn = document.getElementById('seance-btn-expand-form');
    if (btn) {
      btn.addEventListener('click', function () {
        State.formCollapsed = false;
        renderForm();
        renderTrame(); // re-render pour rester en place
      });
    }

    // Phase 5.6.A : rendu de la trame chronologique sous le résumé
    renderTrame();
  }

  function renderFormExpanded() {
    const area = DOM.editorArea();
    if (!area || !State.currentSeance) return;
    const s = State.currentSeance;

    // Options des dropdowns
    const lieuOptions = ['<option value="">— Aucun lieu —</option>']
      .concat(State.sites.map(function (site) {
        const selected = (site.id === s.lieu_id) ? ' selected' : '';
        return '<option value="' + escapeHtml(site.id) + '"' + selected + '>' +
                 escapeHtml(libelleSite(site)) +
               '</option>';
      })).join('');

    const evtOptions = ['<option value="">— Aucun événement —</option>']
      .concat(State.evenements.map(function (evt) {
        const selected = (evt.id === s.evenement_id) ? ' selected' : '';
        return '<option value="' + escapeHtml(evt.id) + '"' + selected + '>' +
                 escapeHtml(libelleEvenement(evt)) +
               '</option>';
      })).join('');

    area.innerHTML =
      '<form class="seance-form" id="seance-form" autocomplete="off" onsubmit="return false;">' +

        // ----- Header -----
        '<header class="seance-form__header">' +
          '<h3 class="seance-form__title">Méta de la séance</h3>' +
          '<div class="seance-form__header-right">' +
            '<span id="seance-autosave-pill" class="seance-autosave-pill is-idle" title="État de la sauvegarde automatique (30s si modifications)">● Sauvé</span>' +
            '<span class="seance-form__etat etat-' + escapeHtml(s.etat) + '">' + libelleEtatSeance(s.etat) + '</span>' +
          '</div>' +
        '</header>' +

        // ----- Section 1 : essentielle (date/heure/durée/effectif/thème/axe) -----
        '<div class="seance-form__grid">' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Date de la séance</span>' +
            '<input type="date" id="seance-input-date" class="seance-field__input" ' +
                   'value="' + escapeHtml(s.date_seance || '') + '">' +
          '</label>' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Heure de début</span>' +
            '<input type="time" id="seance-input-heure" class="seance-field__input" ' +
                   'value="' + escapeHtml(normalizeHeureForInput(s.heure_debut)) + '">' +
          '</label>' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Durée totale (min)</span>' +
            '<input type="number" id="seance-input-duree" class="seance-field__input" ' +
                   'min="15" max="240" step="5" ' +
                   'value="' + escapeHtml(s.duree_totale_min || DUREE_DEFAULT_MIN) + '">' +
          '</label>' +

          '<label class="seance-field">' +
            '<span class="seance-field__label">Effectif prévu</span>' +
            '<input type="number" id="seance-input-effectif" class="seance-field__input" ' +
                   'min="1" max="50" step="1" ' +
                   'value="' + escapeHtml(s.effectif_prevu || '') + '">' +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Thème principal</span>' +
            '<input type="text" id="seance-input-theme" class="seance-field__input" ' +
                   'placeholder="Ex : Défense au sol, Plaquage technique…" ' +
                   'maxlength="120" ' +
                   'value="' + escapeHtml(s.theme_principal || '') + '">' +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Axe de travail général</span>' +
            '<textarea id="seance-input-axe" class="seance-field__input seance-field__textarea" ' +
                      'rows="2" maxlength="500" ' +
                      'placeholder="Une phrase qui résume l\'objectif principal de la séance…">' +
              escapeHtml(s.axe_travail_general || '') +
            '</textarea>' +
          '</label>' +

        '</div>' +

        // ----- Section 2 : contexte (Phase 5.5.B1) -----
        '<details class="seance-form__details" open>' +
          '<summary class="seance-form__details-summary">Contexte (lieu, événement, encadrants…)</summary>' +

          '<div class="seance-form__grid">' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Lieu</span>' +
              '<select id="seance-select-lieu" class="seance-field__input">' +
                lieuOptions +
              '</select>' +
            '</label>' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Événement rattaché</span>' +
              '<select id="seance-select-evenement" class="seance-field__input">' +
                evtOptions +
              '</select>' +
            '</label>' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Météo prévue</span>' +
              '<input type="text" id="seance-input-meteo" class="seance-field__input" ' +
                     'placeholder="Ex : pluie fine, 12°C…" ' +
                     'maxlength="120" ' +
                     'value="' + escapeHtml(s.meteo_text || '') + '">' +
            '</label>' +

            '<label class="seance-field">' +
              '<span class="seance-field__label">Cycle / Période</span>' +
              '<input type="text" id="seance-input-cycle" class="seance-field__input" ' +
                     'placeholder="Ex : Cycle défense (sem. 3/6)" ' +
                     'maxlength="120" ' +
                     'value="' + escapeHtml(s.bloc_cycle || '') + '">' +
            '</label>' +

            '<label class="seance-field seance-field--full">' +
              '<span class="seance-field__label">Encadrants</span>' +
              '<input type="text" id="seance-input-encadrants" class="seance-field__input" ' +
                     'placeholder="Ex : Manu, Pierre, Loïc" ' +
                     'maxlength="200" ' +
                     'value="' + escapeHtml(s.encadrants_text || '') + '">' +
            '</label>' +

            '<label class="seance-field seance-field--full">' +
              '<span class="seance-field__label">Objectifs détaillés</span>' +
              '<textarea id="seance-input-objectifs" class="seance-field__input seance-field__textarea" ' +
                        'rows="3" maxlength="1000" ' +
                        'placeholder="Une ou plusieurs lignes détaillant les objectifs visés…">' +
                escapeHtml(s.objectifs_text || '') +
              '</textarea>' +
            '</label>' +

            '<label class="seance-field seance-field--full">' +
              '<span class="seance-field__label">Matériel global</span>' +
              '<textarea id="seance-input-materiel" class="seance-field__input seance-field__textarea" ' +
                        'rows="2" maxlength="500" ' +
                        'placeholder="Ex : 20 plots, 6 boucliers, 4 ballons…">' +
                escapeHtml(s.materiel_global_text || '') +
              '</textarea>' +
            '</label>' +

          '</div>' +
        '</details>' +

        // ----- Footer -----
        '<div class="seance-form__footer">' +
          '<button type="button" id="seance-btn-save" class="seance-form__save-btn">' +
            '✓ Enregistré' +
          '</button>' +
          '<span class="seance-form__hint">' +
            'Phase 5.5.B2 · Sauvegarde manuelle + autosave 30s' +
          '</span>' +
        '</div>' +

        '<div id="seance-feedback" class="seance-feedback"></div>' +

      '</form>';

    // Bind change → setDirty(true) sur tous les champs
    const fields = [
      'inputDate','inputHeure','inputDuree','inputEffectif','inputTheme','inputAxe',
      'selectLieu','selectEvenement',
      'inputMeteo','inputEncadrants','inputObjectifs','inputCycle','inputMateriel'
    ];
    fields.forEach(function (key) {
      const el = DOM[key]();
      if (el) {
        el.addEventListener('input',  function () { setDirty(true); });
        el.addEventListener('change', function () { setDirty(true); });
      }
    });

    // Bind bouton Save
    const btnSave = DOM.btnSave();
    if (btnSave) {
      btnSave.disabled = true; // état initial : rien à enregistrer
      btnSave.addEventListener('click', onSaveSeance);
    }

    // Phase 5.6.A : rendu de la trame chronologique sous le formulaire
    renderTrame();
  }

  // ============================================================
  // 5.bis. RENDU TRAME CHRONOLOGIQUE (Phase 5.6.A)
  // ============================================================

  /**
   * Rend la section "Trame chronologique" sous le formulaire méta.
   * Appelée après renderForm() et après chaque action (ajout, etc.).
   */
  function renderTrame() {
    const area = DOM.editorArea();
    if (!area || !State.currentSeance) return;

    // Si la section existe déjà, on remplace son innerHTML pour préserver
    // les autres éléments (le form). Sinon on l'ajoute en append.
    let section = DOM.trameSection();
    if (!section) {
      section = document.createElement('section');
      section.id = 'seance-trame-section';
      section.className = 'seance-trame';
      area.appendChild(section);
    }

    const heureDebut = State.currentSeance.heure_debut
      ? normalizeHeureForInput(State.currentSeance.heure_debut)
      : null;

    // Header de section
    let html =
      '<header class="seance-trame__header">' +
        '<h3 class="seance-trame__title">Trame chronologique</h3>' +
        '<button type="button" id="seance-btn-add-bloc" class="seance-trame__add-btn">' +
          '+ Ajouter un bloc' +
        '</button>' +
      '</header>';

    if (!heureDebut) {
      html +=
        '<div class="seance-trame__warning">' +
          '⚠️ Renseigne l\'heure de début dans le formulaire méta ci-dessus ' +
          'pour voir les horaires calculés automatiquement.' +
        '</div>';
    }

    if (State.blocs.length === 0) {
      html +=
        '<div class="seance-trame__empty">' +
          'Aucun bloc dans la trame.<br>' +
          'Clique sur « + Ajouter un bloc » pour démarrer.' +
        '</div>';
    } else {
      // Table 4 colonnes
      html +=
        '<table class="seance-trame__table">' +
          '<thead>' +
            '<tr>' +
              '<th class="seance-trame__th-horaire">Horaire</th>' +
              '<th class="seance-trame__th-bloc">Bloc</th>' +
              '<th class="seance-trame__th-duree">Durée</th>' +
              '<th class="seance-trame__th-actions">Actions</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>';

      let curHeure = heureDebut;
      State.blocs.forEach(function (b, i) {
        const t = lookupTypeBloc(b.type_bloc);
        const emoji = (t && t.emoji) || '·';
        const libType = (t && t.libelle) || b.type_bloc;
        const titreCompl = b.titre_precision ? ' — ' + escapeHtml(b.titre_precision) : '';
        const heureCell = curHeure || '—';
        const heureFin = curHeure ? addMinutesToHeure(curHeure, b.duree_min) : '';

        // Phase 5.6.B : actions ↑ ↓ 🗑
        const isFirst = (i === 0);
        const isLast  = (i === State.blocs.length - 1);
        const disUp   = isFirst ? ' disabled' : '';
        const disDown = isLast  ? ' disabled' : '';

        html +=
          '<tr class="seance-trame__row" data-bloc-id="' + escapeHtml(b.id) + '">' +
            '<td class="seance-trame__td-horaire">' +
              '<span class="seance-trame__horaire-start">' + heureCell + '</span>' +
              (heureFin ? '<span class="seance-trame__horaire-end">→ ' + heureFin + '</span>' : '') +
            '</td>' +
            '<td class="seance-trame__td-bloc">' +
              '<span class="seance-trame__emoji">' + emoji + '</span> ' +
              '<span class="seance-trame__type">' + escapeHtml(libType) + '</span>' +
              '<span class="seance-trame__precision">' + titreCompl + '</span>' +
            '</td>' +
            '<td class="seance-trame__td-duree">' + b.duree_min + ' min</td>' +
            '<td class="seance-trame__td-actions">' +
              '<button type="button" class="seance-trame__action-btn" data-action="up"     data-bloc-id="' + escapeHtml(b.id) + '" title="Monter d\'une place"' + disUp + '>↑</button>' +
              '<button type="button" class="seance-trame__action-btn" data-action="down"   data-bloc-id="' + escapeHtml(b.id) + '" title="Descendre d\'une place"' + disDown + '>↓</button>' +
              '<button type="button" class="seance-trame__action-btn seance-trame__action-btn--danger" data-action="remove" data-bloc-id="' + escapeHtml(b.id) + '" title="Supprimer ce bloc">🗑</button>' +
            '</td>' +
          '</tr>';

        // Avance le curseur horaire pour le prochain bloc
        if (curHeure) curHeure = heureFin;
      });

      html +=
          '</tbody>' +
        '</table>';

      // Footer récap : durée totale des blocs vs durée prévue
      const dureeBlocs = State.blocs.reduce(function (sum, b) { return sum + (b.duree_min || 0); }, 0);
      const dureePrevue = State.currentSeance.duree_totale_min || 0;
      const ecart = dureeBlocs - dureePrevue;
      let recapClass = 'is-ok';
      let recapText = 'Total blocs : ' + dureeBlocs + ' min · Prévu : ' + dureePrevue + ' min';
      if (ecart !== 0) {
        recapClass = ecart > 0 ? 'is-over' : 'is-under';
        recapText += ' · Écart : ' + (ecart > 0 ? '+' : '') + ecart + ' min';
      }
      html +=
        '<div class="seance-trame__recap ' + recapClass + '">' +
          recapText +
        '</div>';
    }

    // Container du popover (toujours présent dans le DOM)
    html += '<div id="seance-picker-root" class="seance-picker"></div>';

    section.innerHTML = html;

    // Bind du bouton "+ Ajouter un bloc"
    const btn = DOM.btnAddBloc();
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        togglePicker();
      });
    }

    // Phase 5.6.B : bind des actions ↑ ↓ 🗑 sur chaque ligne
    section.querySelectorAll('.seance-trame__action-btn').forEach(function (btnEl) {
      btnEl.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btnEl.disabled) return;
        const action = btnEl.getAttribute('data-action');
        const blocId = btnEl.getAttribute('data-bloc-id');
        if (action === 'up')     onMoveBlocUp(blocId);
        if (action === 'down')   onMoveBlocDown(blocId);
        if (action === 'remove') onRemoveBloc(blocId);
      });
    });
  }

  /**
   * Ouvre / ferme le picker de choix de type de bloc.
   */
  function togglePicker() {
    if (State.picker && State.picker.open) {
      closePicker();
    } else {
      openPicker();
    }
  }

  function openPicker() {
    State.picker = { open: true };
    renderPicker();
  }

  function closePicker() {
    State.picker = { open: false };
    renderPicker();
  }

  /**
   * Rend le popover de choix parmi les 11 types de bloc.
   * Affiche la liste avec emoji + libellé + durée par défaut.
   */
  function renderPicker() {
    const root = DOM.pickerRoot();
    if (!root) return;
    if (!State.picker || !State.picker.open) {
      root.innerHTML = '';
      root.classList.remove('is-open');
      return;
    }

    const types = (State.typesBlocsRef
                && State.typesBlocsRef.types_blocs
                && State.typesBlocsRef.types_blocs.valeurs) || [];

    if (types.length === 0) {
      root.innerHTML =
        '<div class="seance-picker__panel">' +
          '<div class="seance-picker__error">⚠️ Référentiel types-blocs.json non chargé.</div>' +
        '</div>';
      root.classList.add('is-open');
      return;
    }

    const items = types.map(function (t) {
      return (
        '<li class="seance-picker__item" data-slug="' + escapeHtml(t.slug) + '">' +
          '<span class="seance-picker__item-emoji">' + (t.emoji || '·') + '</span>' +
          '<span class="seance-picker__item-libelle">' + escapeHtml(t.libelle) + '</span>' +
          '<span class="seance-picker__item-defaut">' + (t.duree_min_defaut || 10) + ' min</span>' +
        '</li>'
      );
    }).join('');

    root.innerHTML =
      '<div class="seance-picker__panel" role="dialog" aria-label="Choisir un type de bloc">' +
        '<header class="seance-picker__panel-header">' +
          '<span>Choisir un type de bloc</span>' +
          '<button type="button" class="seance-picker__close" aria-label="Fermer">×</button>' +
        '</header>' +
        '<ul class="seance-picker__list">' + items + '</ul>' +
      '</div>';
    root.classList.add('is-open');

    // Bind clics
    root.querySelectorAll('.seance-picker__item').forEach(function (li) {
      li.addEventListener('click', function () {
        const slug = li.getAttribute('data-slug');
        onAddBloc(slug);
      });
    });
    const closeBtn = root.querySelector('.seance-picker__close');
    if (closeBtn) closeBtn.addEventListener('click', closePicker);
  }

  /**
   * Fermeture du picker quand on clique en dehors.
   * Câblé une seule fois à l'init.
   */
  function bindPickerOutsideClick() {
    document.addEventListener('click', function (e) {
      const root = DOM.pickerRoot();
      const btn = DOM.btnAddBloc();
      if (!root || !root.classList.contains('is-open')) return;
      if (btn && (e.target === btn || btn.contains(e.target))) return;
      if (root.contains(e.target)) return;
      closePicker();
    });
  }

  // ============================================================
  // 6. ACTIONS
  // ============================================================

  async function onNouvelleSeance() {
    const sidebarBtn = DOM.sidebarCta();
    const centerBtn  = DOM.ctaCenter();
    if (sidebarBtn) sidebarBtn.disabled = true;
    if (centerBtn)  centerBtn.disabled  = true;

    const res = await SupabaseHub.createSeance({
      equipe_id: M14_TEAM_UUID,
      duree_totale_min: DUREE_DEFAULT_MIN,
      etat: 'brouillon'
      // Pas de date_seance par défaut : laisse le coach saisir
    });

    if (sidebarBtn) sidebarBtn.disabled = false;

    if (!res.ok) {
      console.error('SeanceEditor: onNouvelleSeance() KO', res.error);
      // On ré-affiche la zone vide et un feedback éphémère
      renderEmptyEditor();
      // Pas de DOM.feedback() disponible ici car le form n'est pas rendu
      // On utilise alert minimal en V1A (à améliorer en V1B avec feedback global)
      alert('Erreur création séance : ' + res.error);
      return;
    }

    State.currentSeance = res.data;
    State.seances.unshift(res.data); // ajoute en tête de liste
    State.blocs = [];                 // nouvelle séance = 0 bloc (Phase 5.6.A)
    State.formCollapsed = false;      // nouvelle séance = form déployé (Phase 5.6.B)
    setDirty(false);                  // séance fraîche = pas de modif
    renderSidebar();
    renderForm();
    setAutosaveStatus('idle');
    startAutosave();                  // Phase 5.5.B2 : timer 30s
    showFeedback('Nouvelle séance créée. Renseigne les méta puis enregistre.', 'info');
  }

  /**
   * Sauvegarde silencieuse ou manuelle de la séance courante.
   * Partagée par onSaveSeance (clic bouton) et onTickAutosave (timer 30s).
   *
   * @param {object} [opts]
   * @param {boolean} [opts.silent=false] Si true : pas de feedback bruyant,
   *                                       pilote uniquement la pastille autosave.
   * @returns {Promise<boolean>} true si sauvegarde OK, false sinon
   */
  async function saveSeance(opts) {
    if (!State.currentSeance) return false;
    if (!State.isDirty) return false;
    const silent = !!(opts && opts.silent);

    // Vérouille le bouton manuel
    const btn = DOM.btnSave();
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Enregistrement…';
    }
    setAutosaveStatus('saving');

    // Collecte des valeurs du formulaire (lecture du DOM, pas du State)
    const patch = {
      date_seance:          (DOM.inputDate()     && DOM.inputDate().value)     || null,
      heure_debut:          (DOM.inputHeure()    && DOM.inputHeure().value)    || null,
      duree_totale_min:     parseInt((DOM.inputDuree() && DOM.inputDuree().value) || DUREE_DEFAULT_MIN, 10),
      effectif_prevu:       parseInt((DOM.inputEffectif() && DOM.inputEffectif().value) || '0', 10) || null,
      theme_principal:      (DOM.inputTheme()    && DOM.inputTheme().value.trim())    || null,
      axe_travail_general:  (DOM.inputAxe()      && DOM.inputAxe().value.trim())      || null,
      // Phase 5.5.B1 — 7 champs supplémentaires
      lieu_id:              (DOM.selectLieu()       && DOM.selectLieu().value)       || null,
      evenement_id:         (DOM.selectEvenement()  && DOM.selectEvenement().value)  || null,
      meteo_text:           (DOM.inputMeteo()       && DOM.inputMeteo().value.trim())       || null,
      encadrants_text:      (DOM.inputEncadrants()  && DOM.inputEncadrants().value.trim())  || null,
      objectifs_text:       (DOM.inputObjectifs()   && DOM.inputObjectifs().value.trim())   || null,
      bloc_cycle:           (DOM.inputCycle()       && DOM.inputCycle().value.trim())       || null,
      materiel_global_text: (DOM.inputMateriel()    && DOM.inputMateriel().value.trim())    || null
    };

    const res = await SupabaseHub.updateSeance(State.currentSeance.id, patch);

    if (!res.ok) {
      console.error('SeanceEditor: saveSeance() KO', res.error);
      setAutosaveStatus('error');
      if (!silent) {
        showFeedback('Erreur sauvegarde : ' + res.error, 'error');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer les modifications';
      }
      return false;
    }

    // Succès : on met à jour State avec la donnée canonique (côté DB)
    State.currentSeance = res.data;
    // Synchroniser aussi la ligne sidebar (recherche par id et remplace)
    const idx = State.seances.findIndex(function (s) { return s.id === res.data.id; });
    if (idx !== -1) State.seances[idx] = res.data;
    setDirty(false);
    setAutosaveStatus('idle');
    renderSidebar();
    // Phase 5.6.B : sur save MANUEL réussi, si la séance a au moins une
    // date_seance, on replie le formulaire pour donner la place à la trame.
    // En autosave (silent), on garde l'état actuel (intrusif sinon).
    if (!silent && res.data.date_seance) {
      State.formCollapsed = true;
      renderForm();
    } else {
      // Phase 5.6.A : si heure_debut a changé, le calcul des horaires de la
      // trame doit être rafraîchi. On relance renderTrame() de toute façon
      // (idempotent, opération légère).
      renderTrame();
    }
    if (!silent) {
      showFeedback('Séance enregistrée.', 'success');
    }
    return true;
  }

  /**
   * Handler du bouton "Enregistrer" : wrapper bruyant autour de saveSeance().
   */
  async function onSaveSeance() {
    await saveSeance({ silent: false });
  }

  /**
   * Tick autosave : vérifie isDirty, sauve silencieusement si oui.
   * Appelé toutes les AUTOSAVE_INTERVAL_MS ms par le setInterval.
   */
  async function onTickAutosave() {
    if (!State.isDirty) return;
    if (State.autosaveStatus === 'saving') return; // évite recouvrement
    await saveSeance({ silent: true });
  }

  /**
   * Démarre l'autosave (à appeler à chaque ouverture de formulaire).
   * Idempotent : arrête le timer existant avant d'en lancer un nouveau.
   */
  function startAutosave() {
    stopAutosave();
    State.autosaveTimer = setInterval(onTickAutosave, AUTOSAVE_INTERVAL_MS);
  }

  /**
   * Arrête l'autosave (à appeler à la fermeture du form ou avant bascule).
   */
  function stopAutosave() {
    if (State.autosaveTimer) {
      clearInterval(State.autosaveTimer);
      State.autosaveTimer = null;
    }
  }

  /**
   * Charge une séance existante (clic sidebar). Phase 5.5.B2.
   * Si isDirty, demande confirmation avant de basculer.
   */
  async function onSelectSeance(seanceId) {
    if (!seanceId) return;
    if (State.currentSeance && State.currentSeance.id === seanceId) return; // déjà ouverte

    if (State.isDirty) {
      const ok = window.confirm(
        'Tu as des modifications non sauvées sur la séance courante.\n\n' +
        'Continuer sans sauver ? (clique Annuler pour rester)'
      );
      if (!ok) return;
    }

    // Trouve la séance dans le cache (rechargement complet du form depuis State)
    const target = State.seances.find(function (s) { return s.id === seanceId; });
    if (!target) {
      console.error('SeanceEditor: onSelectSeance() séance introuvable dans State.seances', seanceId);
      return;
    }

    stopAutosave();
    State.currentSeance = target;
    setDirty(false);
    // Phase 5.6.A : charger les blocs de cette séance
    await loadBlocs();
    // Phase 5.6.B : ouvrir en mode replié si la séance est déjà documentée
    State.formCollapsed = !!target.date_seance;
    renderSidebar();
    renderForm();
    setAutosaveStatus('idle');
    startAutosave();
  }

  /**
   * Crée un nouveau bloc dans la séance courante avec les valeurs par défaut
   * du type sélectionné. Phase 5.6.A.
   * @param {string} slug Slug du type de bloc (ex : 'echauffement')
   */
  async function onAddBloc(slug) {
    if (!State.currentSeance) {
      console.error('SeanceEditor: onAddBloc() sans currentSeance');
      return;
    }
    const typeDef = lookupTypeBloc(slug);
    if (!typeDef) {
      console.error('SeanceEditor: onAddBloc() type inconnu', slug);
      return;
    }

    closePicker();

    const params = {
      type_bloc: slug,
      duree_min: typeDef.duree_min_defaut || 10
    };
    // Intensité par défaut seulement si le type l'affiche
    if (typeDef.affiche_intensite && typeDef.intensite_defaut) {
      params.intensite = typeDef.intensite_defaut;
    }

    const res = await SupabaseHub.addBlocToSeance(State.currentSeance.id, params);
    if (!res.ok) {
      console.error('SeanceEditor: onAddBloc() KO', res.error);
      alert('Erreur création bloc : ' + res.error);
      return;
    }

    // Ajoute le nouveau bloc dans State.blocs (déjà trié par ordre côté DB)
    State.blocs.push(res.data);
    renderTrame();
  }

  /**
   * Échange 2 blocs dans State.blocs et persiste via reorderBlocs.
   * Helper interne partagé par onMoveBlocUp / onMoveBlocDown.
   * Phase 5.6.B.
   */
  async function swapBlocs(idxA, idxB) {
    if (idxA < 0 || idxB < 0) return;
    if (idxA >= State.blocs.length || idxB >= State.blocs.length) return;

    // Échange optimiste en mémoire pour render immédiat
    const tmp = State.blocs[idxA];
    State.blocs[idxA] = State.blocs[idxB];
    State.blocs[idxB] = tmp;
    renderTrame();

    // Persistance : envoie la nouvelle séquence d'IDs
    const ids = State.blocs.map(function (b) { return b.id; });
    const res = await SupabaseHub.reorderBlocs(State.currentSeance.id, ids);
    if (!res.ok) {
      console.error('SeanceEditor: swapBlocs() KO', res.error);
      alert('Erreur réordonnancement : ' + res.error + '\n\nRechargement de la séance…');
      // Rollback : recharge depuis la DB pour resynchroniser
      await loadBlocs();
      renderTrame();
      return;
    }
    // Met à jour les valeurs 'ordre' locales pour cohérence (1-indexé)
    State.blocs.forEach(function (b, i) { b.ordre = i + 1; });
  }

  /**
   * Monte un bloc d'une place dans la trame.
   * Phase 5.6.B.
   */
  async function onMoveBlocUp(blocId) {
    const idx = State.blocs.findIndex(function (b) { return b.id === blocId; });
    if (idx <= 0) return; // 1er bloc ou introuvable
    await swapBlocs(idx, idx - 1);
  }

  /**
   * Descend un bloc d'une place dans la trame.
   * Phase 5.6.B.
   */
  async function onMoveBlocDown(blocId) {
    const idx = State.blocs.findIndex(function (b) { return b.id === blocId; });
    if (idx < 0 || idx >= State.blocs.length - 1) return; // introuvable ou dernier
    await swapBlocs(idx, idx + 1);
  }

  /**
   * Supprime un bloc de la trame après confirmation.
   * Phase 5.6.B.
   */
  async function onRemoveBloc(blocId) {
    const bloc = State.blocs.find(function (b) { return b.id === blocId; });
    if (!bloc) return;
    const typeDef = lookupTypeBloc(bloc.type_bloc);
    const libType = (typeDef && typeDef.libelle) || bloc.type_bloc;
    const titre = bloc.titre_precision ? ' « ' + bloc.titre_precision + ' »' : '';
    const ok = window.confirm(
      'Supprimer le bloc ' + libType + titre + ' (' + bloc.duree_min + ' min) ?\n\n' +
      'Cette action est définitive.'
    );
    if (!ok) return;

    const res = await SupabaseHub.removeBloc(blocId);
    if (!res.ok) {
      console.error('SeanceEditor: onRemoveBloc() KO', res.error);
      alert('Erreur suppression : ' + res.error);
      return;
    }

    // Retire le bloc de State.blocs sans toucher aux autres ordres
    // (les ordres restent valides : il y a juste un trou, ce qui est OK
    // pour un ORDER BY ordre côté DB)
    State.blocs = State.blocs.filter(function (b) { return b.id !== blocId; });
    renderTrame();
  }

  // ============================================================
  // 7. CHARGEMENTS
  // ============================================================

  async function loadSeances() {
    State.seances = await SupabaseHub.listSeancesByEquipe(M14_TEAM_UUID, {
      limit: NB_SEANCES_RECENTES
    });
  }

  async function loadSites() {
    State.sites = await SupabaseHub.listSitesActifs();
  }

  async function loadEvenements() {
    // Fenêtre de 60 jours par défaut, élargie à l'usage : on couvre la
    // prochaine demi-saison sans submerger le dropdown.
    State.evenements = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, 60);
  }

  /**
   * Charge le référentiel data/types-blocs.json (Phase 5.6.A).
   * Appelé une seule fois à l'init. Mis en cache dans State.typesBlocsRef.
   */
  async function loadTypesBlocsRef() {
    try {
      const resp = await fetch('data/types-blocs.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.typesBlocsRef = await resp.json();
    } catch (e) {
      console.error('SeanceEditor: loadTypesBlocsRef() KO', e);
      State.typesBlocsRef = null;
    }
  }

  /**
   * Charge les blocs de la séance courante (Phase 5.6.A).
   */
  async function loadBlocs() {
    if (!State.currentSeance) {
      State.blocs = [];
      return;
    }
    State.blocs = await SupabaseHub.listBlocsBySeance(State.currentSeance.id);
  }

  // ============================================================
  // 8. INIT
  // ============================================================

  async function init() {
    // Chargements parallèles : séances pour la sidebar, sites et événements
    // pour les dropdowns du formulaire, types-blocs.json pour la trame (5.6.A)
    await Promise.all([
      loadSeances(),
      loadSites(),
      loadEvenements(),
      loadTypesBlocsRef()
    ]);

    renderSidebar();
    renderEmptyEditor();

    // Activation des 2 CTA "+ Nouvelle séance"
    const sidebarCta = DOM.sidebarCta();
    if (sidebarCta) {
      sidebarCta.disabled = false;
      sidebarCta.addEventListener('click', onNouvelleSeance);
    }
    const ctaCenter = DOM.ctaCenter();
    if (ctaCenter) {
      ctaCenter.disabled = false;
      ctaCenter.textContent = '+ Nouvelle séance';
      ctaCenter.addEventListener('click', onNouvelleSeance);
    }

    // Phase 5.6.A : câbler le clic en dehors pour fermer le picker
    bindPickerOutsideClick();

    // Warn si modif non sauvée à la fermeture de l'onglet (V1A : check basique)
    // + arrêt propre du timer autosave (Phase 5.5.B2)
    window.addEventListener('beforeunload', function (e) {
      stopAutosave();
      if (State.isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    console.log(
      '%c🏉 Seance Editor v1.4 (Phase 5.6.B) chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        seances: State.seances.length,
        sites: State.sites.length,
        evenements: State.evenements.length,
        types_blocs_ref: State.typesBlocsRef ? 'OK' : 'KO',
        autosave_interval_ms: AUTOSAVE_INTERVAL_MS
      }
    );
  }

  // ============================================================
  // 9. EXPOSITION PUBLIQUE
  // ============================================================

  window.SeanceEditor = {
    init: init,
    state: State,
    loadSeances: loadSeances,
    loadSites: loadSites,
    loadEvenements: loadEvenements,
    loadBlocs: loadBlocs,
    // Phase 5.5.B2 : exposition autosave pour debug console
    startAutosave: startAutosave,
    stopAutosave: stopAutosave
  };

})();
