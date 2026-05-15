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
 * Version : 1.6 — Phase 5.8 (15 mai 2026)
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
 *   v1.4.1 : Fix UX post-déploiement v1.4 — le bouton "✏️ Modifier"
 *          ouvrait le formulaire mais on ne pouvait le refermer qu'en
 *          modifiant un champ + cliquant Enregistrer. Désormais, un
 *          bouton "↑ Replier" est ajouté en haut à droite du formulaire
 *          déplié (à côté de la pastille autosave + badge état) et
 *          permet de revenir au résumé compact sans modification.
 *          Si modifs en cours, confirm() avant repli.
 *   v1.5 : Phase 5.7 — détail d'un bloc.
 *          Clic sur une ligne de la trame ouvre l'éditeur complet du bloc
 *          (remplace la trame, bouton "← Retour à la trame" pour revenir).
 *          Champs édités :
 *          - Type de bloc (changeable), durée, titre précision, intensité
 *            (affichée conditionnellement selon le type)
 *          - 2 étiquettes Axe 2 (types d'unités) / Axe 3 (composants
 *            échauffement), affichées selon types-blocs.json.etiquettes_proposees
 *          - 10 champs FFR Axe 4 (objectif, but, consigne, cr, critère
 *            réalisation, comportements, variables, régulations, dispositif,
 *            transitions) stockés en jsonb contenu_pedagogique_axe4
 *          - Comportements attendus, organisation spatio-temporelle,
 *            notes bloc (3 textarea libres)
 *          Sauvegarde via updateBloc() + autosave 30s + pastille statut
 *          (pattern identique au form séance, refactor minimal).
 *          Charge vocabulaire-seance.json (4 axes) en plus de
 *          types-blocs.json à l'init.
 *   v1.6 : Phase 5.8 — picker ateliers Bibliothèque.
 *          Section "Ateliers rattachés" ajoutée en bas de la vue détail
 *          d'un bloc. Liste les fiches déjà rattachées (lecture via
 *          listAteliersRattachesAuBloc, wrapper v1.8.3), avec enrichissement
 *          local depuis data/fiches-all.json (62 fiches) : titre, thème,
 *          niveau, durée, lien Drive. Bouton 🗑 par rattachement →
 *          detachAtelierFromBloc(rattachementId).
 *          Bouton "+ Rattacher un atelier" ouvre une modale picker avec :
 *          champ recherche texte (filtre nom_fiche + titre + thème +
 *          niveau, insensible aux accents), liste filtrée des 62 fiches,
 *          clic sur une fiche → attachAtelierToBloc(blocId, fileIdDrive)
 *          puis reload + render. Modale fermable par overlay, Échap ou
 *          croix.
 *          Charge data/fiches-all.json (~140 KB, 62 fiches) à l'init en
 *          parallèle des autres référentiels. Cache navigateur activé
 *          (force-cache) car miroir Drive régénéré manuellement par
 *          le converter Python (pas en temps réel).
 *
 * Dépendances :
 *   - window.SupabaseHub v1.8.3 (wrappers Phase 5.3 + listSitesActifs +
 *     listBlocsBySeance + updateBloc + listAteliersRattachesAuBloc)
 *   - data/types-blocs.json v1.1 (fetched à l'init)
 *   - data/vocabulaire-seance.json v1.1 (fetched à l'init, Phase 5.7)
 *   - data/fiches-all.json (fetched à l'init, Phase 5.8, miroir Drive
 *     de la Bibliothèque ateliers ; clé = fileId_dossier, 62 fiches)
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
    formCollapsed: false,   // true : form méta replié en résumé compact (5.6.B)
    vocabulaireRef: null,   // référentiel des 4 axes (data/vocabulaire-seance.json, 5.7)
    currentBloc: null,      // bloc en cours d'édition (vue détail, 5.7)
    blocIsDirty: false,     // modifs non sauvées sur le bloc en édition (5.7)
    blocAutosaveTimer: null, // handle setInterval pour autosave du bloc (5.7)
    blocAutosaveStatus: 'idle', // 'idle' | 'saving' | 'error' (5.7)
    view: 'trame',          // 'trame' | 'bloc-detail' : vue active de la zone éditeur (5.7)
    // Phase 5.8 : picker ateliers Bibliothèque
    fichesRef: null,        // miroir data/fiches-all.json ({fileId_dossier: {...}})
    ateliersRattaches: [],  // rattachements du bloc courant (cache, rechargé à chaque ouverture)
    fichePicker: null       // état modale picker ({open: bool, query: string})
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
    pickerRoot:   () => document.getElementById('seance-picker-root'),
    // Phase 5.7 : détail bloc
    blocDetailSection: () => document.getElementById('seance-bloc-detail'),
    blocAutosavePill:  () => document.getElementById('seance-bloc-autosave-pill'),
    blocBtnRetour:     () => document.getElementById('seance-bloc-btn-retour'),
    blocBtnSave:       () => document.getElementById('seance-bloc-btn-save'),
    blocInputs: () => document.querySelectorAll('[data-bloc-field]'), // tous les champs édités
    // Phase 5.8 : picker ateliers
    ateliersSection: () => document.getElementById('seance-ateliers-section'),
    ateliersList:    () => document.getElementById('seance-ateliers-list'),
    btnAddAtelier:   () => document.getElementById('seance-btn-add-atelier'),
    pickerFicheRoot: () => document.getElementById('seance-picker-fiche-root')
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
            '<button type="button" id="seance-btn-collapse-form" class="seance-form__collapse-btn" title="Replier le formulaire (raccourci : sans modifier)">' +
              '↑ Replier' +
            '</button>' +
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

    // Phase 5.6.B (fix v1.4.1) : bouton ↑ Replier
    const btnCollapse = document.getElementById('seance-btn-collapse-form');
    if (btnCollapse) {
      btnCollapse.addEventListener('click', onCollapseForm);
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
   *
   * Phase 5.7 : si State.view === 'bloc-detail', la trame est cachée et
   * le détail du bloc en édition prend sa place (à la fin de la fonction).
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
            '<td class="seance-trame__td-bloc seance-trame__td-bloc--clickable" ' +
                 'data-action="open-detail" data-bloc-id="' + escapeHtml(b.id) + '" ' +
                 'title="Cliquer pour éditer ce bloc en détail">' +
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

    // Phase 5.7 : bind des clics open-detail sur les cellules td-bloc
    section.querySelectorAll('[data-action="open-detail"]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        const blocId = cell.getAttribute('data-bloc-id');
        onOpenBlocDetail(blocId);
      });
    });

    // Phase 5.7 : si on est en vue détail bloc, masquer la trame et afficher le détail
    if (State.view === 'bloc-detail' && State.currentBloc) {
      section.style.display = 'none';
      renderBlocDetail();
    } else {
      section.style.display = '';
      // Si une section detail existe et est visible, la masquer
      const detail = DOM.blocDetailSection();
      if (detail) detail.style.display = 'none';
    }
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
  // 5.ter. RENDU DÉTAIL BLOC (Phase 5.7)
  // ============================================================

  /**
   * Récupère la liste des termes d'un axe du vocabulaire-seance.json.
   * @param {string} axeKey ex : 'axe_2_types_unites', 'axe_3_composants_echauffement', 'axe_4_champs_ffr'
   * @returns {Array} Liste de {slug, libelle}, [] si introuvable
   */
  function lookupVocabAxe(axeKey) {
    if (!State.vocabulaireRef) return [];
    const axe = State.vocabulaireRef[axeKey];
    if (!axe || !Array.isArray(axe.valeurs)) return [];
    return axe.valeurs;
  }

  /**
   * Rend la pastille autosave du détail bloc (3 états comme la séance).
   */
  function setBlocAutosaveStatus(status) {
    State.blocAutosaveStatus = status;
    const pill = DOM.blocAutosavePill();
    if (!pill) return;
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

  function setBlocDirty(dirty) {
    State.blocIsDirty = !!dirty;
    const btn = DOM.blocBtnSave();
    if (btn) {
      btn.disabled = !dirty;
      btn.textContent = dirty ? '💾 Enregistrer le bloc' : '✓ Enregistré';
    }
  }

  /**
   * Construit une grille d'options pour un <select>.
   * @param {Array} valeurs Liste {slug, libelle}
   * @param {string} selectedSlug Slug actuellement sélectionné (ou null)
   * @param {string} emptyLabel Libellé de l'option vide
   */
  function buildSelectOptions(valeurs, selectedSlug, emptyLabel) {
    let html = '<option value="">— ' + escapeHtml(emptyLabel || 'Aucun') + ' —</option>';
    valeurs.forEach(function (v) {
      const sel = (v.slug === selectedSlug) ? ' selected' : '';
      html += '<option value="' + escapeHtml(v.slug) + '"' + sel + '>' + escapeHtml(v.libelle) + '</option>';
    });
    return html;
  }

  /**
   * Rend l'éditeur détail d'un bloc dans la zone éditeur (sous le résumé
   * méta replié). Remplace la trame chronologique tant qu'on est en vue
   * 'bloc-detail'. Phase 5.7.
   */
  function renderBlocDetail() {
    const area = DOM.editorArea();
    if (!area || !State.currentBloc) return;
    const b = State.currentBloc;

    // Crée la section detail si elle n'existe pas encore
    let section = DOM.blocDetailSection();
    if (!section) {
      section = document.createElement('section');
      section.id = 'seance-bloc-detail';
      section.className = 'seance-bloc-detail';
      area.appendChild(section);
    }
    section.style.display = '';

    // Lookup type de bloc actuel
    const typeDef = lookupTypeBloc(b.type_bloc);
    const emoji = (typeDef && typeDef.emoji) || '·';
    const libType = (typeDef && typeDef.libelle) || b.type_bloc;
    const positionDansTrame = State.blocs.findIndex(function (x) { return x.id === b.id; }) + 1;

    // Décide quels champs conditionnels afficher
    const afficheIntensite   = !!(typeDef && typeDef.affiche_intensite);
    const etiquettesProp     = (typeDef && Array.isArray(typeDef.etiquettes_proposees)) ? typeDef.etiquettes_proposees : [];
    const afficheAxe2        = etiquettesProp.indexOf('axe_2') !== -1;
    const afficheAxe3        = etiquettesProp.indexOf('axe_3') !== -1;

    // Référentiels pour les dropdowns
    const typesBlocs    = (State.typesBlocsRef && State.typesBlocsRef.types_blocs && State.typesBlocsRef.types_blocs.valeurs) || [];
    const intensites    = (State.typesBlocsRef && State.typesBlocsRef.intensites && State.typesBlocsRef.intensites.valeurs) || [];
    const valeursAxe2   = lookupVocabAxe('axe_2_types_unites');
    const valeursAxe3   = lookupVocabAxe('axe_3_composants_echauffement');
    const valeursAxe4   = lookupVocabAxe('axe_4_champs_ffr');

    // Contenu pédagogique Axe 4 (jsonb)
    const axe4 = b.contenu_pedagogique_axe4 || {};

    // ----- Construction du HTML -----
    let html =
      // Header avec bouton retour + pastille + bouton save
      '<header class="seance-bloc-detail__header">' +
        '<button type="button" id="seance-bloc-btn-retour" class="seance-bloc-detail__btn-retour" title="Retour à la trame chronologique">' +
          '← Retour à la trame' +
        '</button>' +
        '<h3 class="seance-bloc-detail__title">' +
          '<span class="seance-bloc-detail__emoji">' + emoji + '</span> ' +
          '<span>Bloc ' + positionDansTrame + ' · ' + escapeHtml(libType) + '</span>' +
        '</h3>' +
        '<div class="seance-bloc-detail__header-right">' +
          '<span id="seance-bloc-autosave-pill" class="seance-autosave-pill is-idle" title="Sauvegarde automatique du bloc (30s si modifications)">● Sauvé</span>' +
        '</div>' +
      '</header>' +

      // ----- Section essentielle : type, durée, intensité, titre précision -----
      '<div class="seance-bloc-detail__grid">' +

        '<label class="seance-field">' +
          '<span class="seance-field__label">Type de bloc</span>' +
          '<select class="seance-field__input" data-bloc-field="type_bloc">' +
            typesBlocs.map(function (t) {
              const sel = (t.slug === b.type_bloc) ? ' selected' : '';
              return '<option value="' + escapeHtml(t.slug) + '"' + sel + '>' +
                       (t.emoji || '·') + ' ' + escapeHtml(t.libelle) +
                     '</option>';
            }).join('') +
          '</select>' +
        '</label>' +

        '<label class="seance-field">' +
          '<span class="seance-field__label">Durée (min)</span>' +
          '<input type="number" class="seance-field__input" data-bloc-field="duree_min" ' +
                 'min="1" max="240" step="1" ' +
                 'value="' + escapeHtml(b.duree_min || 10) + '">' +
        '</label>' +

        // Intensité : afficher conditionnellement, sinon une cellule "—"
        '<label class="seance-field' + (afficheIntensite ? '' : ' seance-field--hidden') + '">' +
          '<span class="seance-field__label">Intensité contact</span>' +
          '<select class="seance-field__input" data-bloc-field="intensite">' +
            buildSelectOptions(intensites.map(function (i) {
              return { slug: i.slug, libelle: (i.emoji || '') + ' ' + i.libelle };
            }), b.intensite, 'Non spécifiée') +
          '</select>' +
        '</label>' +

        '<label class="seance-field' + (afficheIntensite ? ' seance-field--full' : ' seance-field--full') + '">' +
          '<span class="seance-field__label">Titre / précision</span>' +
          '<input type="text" class="seance-field__input" data-bloc-field="titre_precision" ' +
                 'maxlength="200" ' +
                 'placeholder="Ex : Mobilisation articulaire avec ballon" ' +
                 'value="' + escapeHtml(b.titre_precision || '') + '">' +
        '</label>' +

      '</div>';

    // ----- Section étiquettes (Axe 2 et/ou Axe 3) conditionnelle -----
    if (afficheAxe2 || afficheAxe3) {
      html +=
        '<details class="seance-bloc-detail__details" open>' +
          '<summary class="seance-bloc-detail__details-summary">Étiquettes contextuelles</summary>' +
          '<div class="seance-bloc-detail__grid">';

      if (afficheAxe2) {
        html +=
          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Type d\'unité (Axe 2)</span>' +
            '<select class="seance-field__input" data-bloc-field="etiquette_axe2">' +
              buildSelectOptions(valeursAxe2, b.etiquette_axe2, 'Non spécifié') +
            '</select>' +
          '</label>';
      }
      if (afficheAxe3) {
        html +=
          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Composant d\'échauffement (Axe 3)</span>' +
            '<select class="seance-field__input" data-bloc-field="etiquette_axe3">' +
              buildSelectOptions(valeursAxe3, b.etiquette_axe3, 'Non spécifié') +
            '</select>' +
          '</label>';
      }
      html +=
          '</div>' +
        '</details>';
    }

    // ----- Section Contenu pédagogique (Axe 4 : 10 champs FFR) -----
    html +=
      '<details class="seance-bloc-detail__details" open>' +
        '<summary class="seance-bloc-detail__details-summary">Contenu pédagogique (10 champs FFR · Axe 4)</summary>' +
        '<div class="seance-bloc-detail__grid">';

    valeursAxe4.forEach(function (champ) {
      const value = axe4[champ.slug] || '';
      const isShort = (champ.slug === 'cr' || champ.slug === 'critere_realisation');
      html +=
        '<label class="seance-field seance-field--full">' +
          '<span class="seance-field__label">' + escapeHtml(champ.libelle) + '</span>' +
          '<textarea class="seance-field__input seance-field__textarea" ' +
                    'data-bloc-field-axe4="' + escapeHtml(champ.slug) + '" ' +
                    'rows="' + (isShort ? '2' : '2') + '" maxlength="1000" ' +
                    'placeholder="…">' +
            escapeHtml(value) +
          '</textarea>' +
        '</label>';
    });

    html +=
        '</div>' +
      '</details>';

    // ----- Section Autres (libre) -----
    html +=
      '<details class="seance-bloc-detail__details">' +
        '<summary class="seance-bloc-detail__details-summary">Autres champs (organisation, notes…)</summary>' +
        '<div class="seance-bloc-detail__grid">' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Comportements attendus</span>' +
            '<textarea class="seance-field__input seance-field__textarea" ' +
                      'data-bloc-field="comportements_attendus" rows="2" maxlength="500">' +
              escapeHtml(b.comportements_attendus || '') +
            '</textarea>' +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Organisation spatio-temporelle</span>' +
            '<textarea class="seance-field__input seance-field__textarea" ' +
                      'data-bloc-field="organisation_spatio_temporelle" rows="2" maxlength="500">' +
              escapeHtml(b.organisation_spatio_temporelle || '') +
            '</textarea>' +
          '</label>' +

          '<label class="seance-field seance-field--full">' +
            '<span class="seance-field__label">Notes / commentaires</span>' +
            '<textarea class="seance-field__input seance-field__textarea" ' +
                      'data-bloc-field="notes_bloc" rows="2" maxlength="1000">' +
              escapeHtml(b.notes_bloc || '') +
            '</textarea>' +
          '</label>' +

        '</div>' +
      '</details>';

    // ----- Phase 5.8 : Section "Ateliers rattachés" -----
    // Rendue à part dans renderAteliersSection() pour pouvoir la re-render
    // sans toucher au reste du formulaire après attach/detach.
    html +=
      '<div id="seance-ateliers-section" class="seance-ateliers-section">' +
        renderAteliersSectionInner() +
      '</div>';

    // ----- Footer : bouton save + hint -----
    html +=
      '<div class="seance-bloc-detail__footer">' +
        '<button type="button" id="seance-bloc-btn-save" class="seance-form__save-btn">' +
          '✓ Enregistré' +
        '</button>' +
        '<span class="seance-form__hint">' +
          'Phase 5.7 · Sauvegarde manuelle + autosave 30s du bloc' +
        '</span>' +
      '</div>';

    // ----- Phase 5.8 : Racine modale picker fiche (vide par défaut) -----
    html += '<div id="seance-picker-fiche-root"></div>';

    section.innerHTML = html;

    // ----- Binds -----
    const btnRetour = DOM.blocBtnRetour();
    if (btnRetour) btnRetour.addEventListener('click', onCloseBlocDetail);

    const btnSave = DOM.blocBtnSave();
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.addEventListener('click', onSaveBloc);
    }

    // Bind dirty sur tous les champs du bloc
    DOM.blocInputs().forEach(function (el) {
      el.addEventListener('input',  function () { setBlocDirty(true); });
      el.addEventListener('change', function () { setBlocDirty(true); });
    });

    // Phase 5.8 : binds section ateliers
    bindAteliersSection();
  }

  // ============================================================
  // 5.bis  PHASE 5.8 — PICKER ATELIERS BIBLIOTHÈQUE
  // ============================================================

  /**
   * Helper : lookup d'une fiche dans le miroir Bibliothèque par fileId_dossier.
   * Renvoie l'objet complet (source, cartouche, pedagogie, media, files) ou null.
   */
  function lookupFiche(fileIdDossier) {
    if (!State.fichesRef || !fileIdDossier) return null;
    return State.fichesRef[fileIdDossier] || null;
  }

  /**
   * Helper : libellé court d'une fiche pour affichage (titre ou nom_fiche fallback).
   * Concatène titre + thème si dispo.
   */
  function libelleFicheCourt(fiche) {
    if (!fiche) return '— fiche introuvable —';
    const titre = (fiche.cartouche && fiche.cartouche.titre) ? fiche.cartouche.titre.trim() : '';
    const nom   = (fiche.source && fiche.source.nom_fiche) ? fiche.source.nom_fiche.trim() : '';
    return titre || nom || '(sans titre)';
  }

  /**
   * Helper : URL Drive du dossier d'une fiche.
   */
  function urlDriveDossier(fileIdDossier) {
    return 'https://drive.google.com/drive/folders/' + fileIdDossier;
  }

  /**
   * Helper : normalise un texte pour recherche insensible aux accents/casse.
   */
  function normalizeForSearch(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Rendu HTML interne de la section "Ateliers rattachés".
   * Séparé de renderBlocDetail pour pouvoir être appelé seul après attach/detach.
   */
  function renderAteliersSectionInner() {
    const rattachements = State.ateliersRattaches || [];
    const fichesAvailable = State.fichesRef !== null;

    let html =
      '<div class="seance-ateliers-section__header">' +
        '<h3 class="seance-ateliers-section__title">' +
          '📚 Ateliers rattachés (' + rattachements.length + ')' +
        '</h3>' +
        '<button type="button" id="seance-btn-add-atelier" ' +
                'class="seance-form__save-btn"' +
                (fichesAvailable ? '' : ' disabled title="Bibliothèque non chargée — vérifier data/fiches-all.json"') +
                '>' +
          '+ Rattacher un atelier' +
        '</button>' +
      '</div>';

    if (rattachements.length === 0) {
      html +=
        '<p class="seance-ateliers-section__empty">' +
          'Aucun atelier rattaché à ce bloc. Clique sur ' +
          '<strong>+ Rattacher un atelier</strong> pour piocher dans la Bibliothèque.' +
        '</p>';
      return html;
    }

    if (!fichesAvailable) {
      html +=
        '<p class="seance-ateliers-section__empty seance-ateliers-section__empty--warn">' +
          '⚠️ Bibliothèque (data/fiches-all.json) non chargée — affichage minimal.' +
        '</p>';
    }

    html += '<ul id="seance-ateliers-list" class="seance-ateliers-list">';
    rattachements.forEach(function (rat) {
      const fiche = lookupFiche(rat.atelier_fileid_drive);
      const titre = libelleFicheCourt(fiche);
      const theme = (fiche && fiche.cartouche && fiche.cartouche.theme)
        ? fiche.cartouche.theme : '';
      const niveau = (fiche && fiche.cartouche && fiche.cartouche.niveau)
        ? fiche.cartouche.niveau : '';
      const duree  = (fiche && fiche.cartouche && fiche.cartouche.duree)
        ? fiche.cartouche.duree : '';
      const driveUrl = urlDriveDossier(rat.atelier_fileid_drive);

      html +=
        '<li class="seance-ateliers-list__item">' +
          '<div class="seance-ateliers-list__main">' +
            '<div class="seance-ateliers-list__titre">' +
              escapeHtml(titre) +
            '</div>' +
            '<div class="seance-ateliers-list__meta">';
      if (theme)  html += '<span class="seance-ateliers-list__chip">' + escapeHtml(theme) + '</span>';
      if (niveau) html += '<span class="seance-ateliers-list__chip">' + escapeHtml(niveau) + '</span>';
      if (duree)  html += '<span class="seance-ateliers-list__chip">⏱ ' + escapeHtml(duree) + '</span>';
      html +=
            '</div>' +
          '</div>' +
          '<div class="seance-ateliers-list__actions">' +
            '<a href="' + driveUrl + '" target="_blank" rel="noopener" ' +
              'class="seance-ateliers-list__btn seance-ateliers-list__btn--drive" ' +
              'title="Ouvrir le dossier Drive">📂 Drive</a>' +
            '<button type="button" ' +
              'class="seance-ateliers-list__btn seance-ateliers-list__btn--remove" ' +
              'data-rattachement-id="' + escapeHtml(rat.id) + '" ' +
              'title="Détacher cet atelier">🗑</button>' +
          '</div>' +
        '</li>';
    });
    html += '</ul>';

    return html;
  }

  /**
   * Re-rend la section "Ateliers rattachés" seule et re-bind ses handlers.
   * Appelé après attach/detach. N'affecte ni le formulaire bloc ni l'autosave.
   */
  function renderAteliersSection() {
    const section = DOM.ateliersSection();
    if (!section) return;
    section.innerHTML = renderAteliersSectionInner();
    bindAteliersSection();
  }

  /**
   * Bind les boutons de la section "Ateliers rattachés".
   * - Bouton "+ Rattacher un atelier" → ouvre la modale picker.
   * - Boutons 🗑 par item → détachement.
   */
  function bindAteliersSection() {
    const btnAdd = DOM.btnAddAtelier();
    if (btnAdd) btnAdd.addEventListener('click', openFichePicker);

    const list = DOM.ateliersList();
    if (list) {
      list.querySelectorAll('.seance-ateliers-list__btn--remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const rattId = btn.getAttribute('data-rattachement-id');
          onDetachAtelier(rattId);
        });
      });
    }
  }

  /**
   * Ouvre la modale picker fiche (Phase 5.8).
   * Liste les 62 fiches de la Bibliothèque avec champ recherche en haut.
   */
  function openFichePicker() {
    if (!State.fichesRef) {
      window.alert('La Bibliothèque (data/fiches-all.json) n\'est pas chargée.\n' +
                   'Vérifie la console et le déploiement du miroir.');
      return;
    }
    State.fichePicker = { open: true, query: '' };
    renderFichePicker();
    // Échap pour fermer
    document.addEventListener('keydown', onFichePickerEsc);
  }

  /**
   * Ferme la modale picker fiche.
   */
  function closeFichePicker() {
    State.fichePicker = null;
    const root = DOM.pickerFicheRoot();
    if (root) root.innerHTML = '';
    document.removeEventListener('keydown', onFichePickerEsc);
  }

  /**
   * Handler keydown pour fermer le picker à Échap.
   */
  function onFichePickerEsc(e) {
    if (e.key === 'Escape') closeFichePicker();
  }

  /**
   * Rend la modale picker fiche (overlay + contenu).
   * Re-rendu à chaque frappe dans le champ recherche.
   */
  function renderFichePicker() {
    const root = DOM.pickerFicheRoot();
    if (!root) return;
    if (!State.fichePicker || !State.fichePicker.open) {
      root.innerHTML = '';
      return;
    }

    const query = State.fichePicker.query || '';
    const qNorm = normalizeForSearch(query);

    // Filtre les fiches
    const allEntries = Object.entries(State.fichesRef || {});
    const fichesFiltrees = qNorm.length === 0
      ? allEntries
      : allEntries.filter(function (entry) {
          const fiche = entry[1];
          const fields = [
            fiche.source && fiche.source.nom_fiche,
            fiche.cartouche && fiche.cartouche.titre,
            fiche.cartouche && fiche.cartouche.theme,
            fiche.cartouche && fiche.cartouche.niveau
          ];
          return fields.some(function (f) {
            return f && normalizeForSearch(f).indexOf(qNorm) !== -1;
          });
        });

    // IDs des fiches déjà rattachées (pour griser ces lignes)
    const dejaRattaches = new Set(
      (State.ateliersRattaches || []).map(function (r) { return r.atelier_fileid_drive; })
    );

    let html =
      '<div class="seance-picker-fiche__overlay" id="seance-picker-fiche-overlay">' +
        '<div class="seance-picker-fiche__modal" role="dialog" aria-modal="true">' +
          '<div class="seance-picker-fiche__header">' +
            '<h3 class="seance-picker-fiche__title">' +
              '📚 Bibliothèque — choisir une fiche atelier' +
            '</h3>' +
            '<button type="button" id="seance-picker-fiche-close" ' +
                    'class="seance-picker-fiche__close" title="Fermer (Échap)">✕</button>' +
          '</div>' +
          '<div class="seance-picker-fiche__search">' +
            '<input type="text" id="seance-picker-fiche-query" ' +
                   'class="seance-picker-fiche__input" ' +
                   'placeholder="🔍 Rechercher (nom, titre, thème, niveau)…" ' +
                   'value="' + escapeHtml(query) + '" ' +
                   'autocomplete="off">' +
            '<span class="seance-picker-fiche__count">' +
              fichesFiltrees.length + ' / ' + allEntries.length + ' fiches' +
            '</span>' +
          '</div>' +
          '<div class="seance-picker-fiche__list-wrap">';

    if (fichesFiltrees.length === 0) {
      html += '<p class="seance-picker-fiche__empty">Aucune fiche ne correspond à cette recherche.</p>';
    } else {
      html += '<ul class="seance-picker-fiche__list">';
      fichesFiltrees.forEach(function (entry) {
        const fileId = entry[0];
        const fiche  = entry[1];
        const titre  = libelleFicheCourt(fiche);
        const theme  = (fiche.cartouche && fiche.cartouche.theme)  ? fiche.cartouche.theme  : '';
        const niveau = (fiche.cartouche && fiche.cartouche.niveau) ? fiche.cartouche.niveau : '';
        const duree  = (fiche.cartouche && fiche.cartouche.duree)  ? fiche.cartouche.duree  : '';
        const isDeja = dejaRattaches.has(fileId);

        html +=
          '<li class="seance-picker-fiche__item' + (isDeja ? ' seance-picker-fiche__item--deja' : '') + '" ' +
              'data-fileid="' + escapeHtml(fileId) + '"' +
              (isDeja ? ' title="Déjà rattaché à ce bloc"' : '') + '>' +
            '<div class="seance-picker-fiche__item-titre">' +
              escapeHtml(titre) +
              (isDeja ? ' <span class="seance-picker-fiche__badge-deja">déjà rattaché</span>' : '') +
            '</div>' +
            '<div class="seance-picker-fiche__item-meta">';
        if (theme)  html += '<span class="seance-ateliers-list__chip">' + escapeHtml(theme)  + '</span>';
        if (niveau) html += '<span class="seance-ateliers-list__chip">' + escapeHtml(niveau) + '</span>';
        if (duree)  html += '<span class="seance-ateliers-list__chip">⏱ ' + escapeHtml(duree) + '</span>';
        html +=
            '</div>' +
          '</li>';
      });
      html += '</ul>';
    }

    html +=
          '</div>' +
        '</div>' +
      '</div>';

    root.innerHTML = html;

    // ----- Binds modale -----
    const overlay = document.getElementById('seance-picker-fiche-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeFichePicker(); // clic sur overlay = fermer
      });
    }
    const btnClose = document.getElementById('seance-picker-fiche-close');
    if (btnClose) btnClose.addEventListener('click', closeFichePicker);

    const inputQuery = document.getElementById('seance-picker-fiche-query');
    if (inputQuery) {
      inputQuery.addEventListener('input', function () {
        if (!State.fichePicker) return;
        State.fichePicker.query = inputQuery.value;
        renderFichePicker();
        // Restaurer le focus + position curseur après re-render
        const newInput = document.getElementById('seance-picker-fiche-query');
        if (newInput) {
          newInput.focus();
          const len = newInput.value.length;
          newInput.setSelectionRange(len, len);
        }
      });
      // Auto-focus à l'ouverture
      setTimeout(function () { inputQuery.focus(); }, 0);
    }

    // Click sur un item → rattacher
    document.querySelectorAll('.seance-picker-fiche__item').forEach(function (item) {
      item.addEventListener('click', function () {
        const fileId = item.getAttribute('data-fileid');
        if (item.classList.contains('seance-picker-fiche__item--deja')) {
          window.alert('Cet atelier est déjà rattaché à ce bloc.');
          return;
        }
        onAttachAtelier(fileId);
      });
    });
  }

  /**
   * Rattache une fiche au bloc courant via attachAtelierToBloc().
   * Recharge la liste des rattachements + re-render la section + ferme le picker.
   */
  async function onAttachAtelier(fileIdDossier) {
    if (!State.currentBloc) return;
    if (!fileIdDossier) return;

    const res = await SupabaseHub.attachAtelierToBloc(
      State.currentBloc.id,
      fileIdDossier
    );
    if (!res.ok) {
      window.alert('Échec du rattachement :\n' + (res.error || 'erreur inconnue'));
      return;
    }
    // Recharger la liste depuis la DB pour avoir l'ordre + id de la nouvelle ligne
    State.ateliersRattaches = await SupabaseHub.listAteliersRattachesAuBloc(
      State.currentBloc.id
    );
    renderAteliersSection();
    closeFichePicker();
    showFeedback('Atelier rattaché ✓', 'success');
  }

  /**
   * Détache un atelier (DELETE de la ligne seances_blocs_ateliers par id).
   * Confirmation utilisateur, puis reload + re-render.
   */
  async function onDetachAtelier(rattachementId) {
    if (!rattachementId) return;
    const ok = window.confirm('Détacher cet atelier du bloc ?\n\n' +
                              '(La fiche reste dans la Bibliothèque, seul ce rattachement sera supprimé.)');
    if (!ok) return;

    const res = await SupabaseHub.detachAtelierFromBloc(rattachementId);
    if (!res.ok) {
      window.alert('Échec du détachement :\n' + (res.error || 'erreur inconnue'));
      return;
    }
    // Recharger la liste depuis la DB
    if (State.currentBloc) {
      State.ateliersRattaches = await SupabaseHub.listAteliersRattachesAuBloc(
        State.currentBloc.id
      );
    }
    renderAteliersSection();
    showFeedback('Atelier détaché ✓', 'success');
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
    State.currentBloc = null;         // Phase 5.7
    State.view = 'trame';             // Phase 5.7
    State.formCollapsed = false;      // nouvelle séance = form déployé (Phase 5.6.B)
    setDirty(false);                  // séance fraîche = pas de modif
    State.blocIsDirty = false;        // Phase 5.7
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
    stopBlocAutosave();              // Phase 5.7 : si on était en vue détail bloc d'une autre séance
    State.currentSeance = target;
    State.currentBloc = null;        // Phase 5.7
    State.view = 'trame';            // Phase 5.7
    State.blocIsDirty = false;
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
   * Replie le formulaire méta sans modifier la séance. Phase 5.6.B fix v1.4.1.
   * Le bouton "↑ Replier" en haut du formulaire déplié déclenche cette fonction.
   * Si des modifs sont en cours (isDirty), confirm() avant repli.
   */
  function onCollapseForm() {
    if (!State.currentSeance) return;

    if (State.isDirty) {
      const ok = window.confirm(
        'Tu as des modifications non sauvées.\n\n' +
        'Replier sans sauver ? (clique Annuler pour rester sur le formulaire)'
      );
      if (!ok) return;
      // Reset dirty + état autosave : on a délibérément choisi d'ignorer les modifs
      setDirty(false);
      setAutosaveStatus('idle');
    }

    State.formCollapsed = true;
    renderForm();
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

  // ----------------------------------------------------------
  // Phase 5.7 — Actions vue détail bloc
  // ----------------------------------------------------------

  /**
   * Ouvre la vue détail d'un bloc (remplace la trame).
   * @param {string} blocId UUID du bloc à éditer
   */
  async function onOpenBlocDetail(blocId) {
    const bloc = State.blocs.find(function (b) { return b.id === blocId; });
    if (!bloc) {
      console.error('SeanceEditor: onOpenBlocDetail() bloc introuvable', blocId);
      return;
    }
    State.currentBloc = bloc;
    State.blocIsDirty = false;
    State.view = 'bloc-detail';
    // Phase 5.8 : charger les rattachements ateliers AVANT le 1er rendu
    // pour que la section "Ateliers rattachés" s'affiche d'emblée.
    State.ateliersRattaches = await SupabaseHub.listAteliersRattachesAuBloc(blocId);
    renderTrame();             // bascule la vue (renderTrame appelle renderBlocDetail si view='bloc-detail')
    setBlocAutosaveStatus('idle');
    startBlocAutosave();
  }

  /**
   * Ferme la vue détail (retour à la trame).
   * Si des modifs sont en cours sur le bloc, confirm().
   */
  function onCloseBlocDetail() {
    if (State.blocIsDirty) {
      const ok = window.confirm(
        'Tu as des modifications non sauvées sur ce bloc.\n\n' +
        'Retour à la trame sans sauver ? (Annuler pour rester)'
      );
      if (!ok) return;
    }
    stopBlocAutosave();
    State.view = 'trame';
    State.currentBloc = null;
    State.blocIsDirty = false;
    State.ateliersRattaches = []; // Phase 5.8 : vider le cache
    closeFichePicker();           // Phase 5.8 : fermer le picker si ouvert
    renderTrame();
  }

  /**
   * Sauvegarde du bloc courant (manuel ou silencieux selon opts.silent).
   * Partagée par onSaveBloc (clic bouton) et onTickBlocAutosave (timer).
   *
   * @param {object} [opts]
   * @param {boolean} [opts.silent=false]
   * @returns {Promise<boolean>}
   */
  async function saveBloc(opts) {
    if (!State.currentBloc) return false;
    if (!State.blocIsDirty) return false;
    const silent = !!(opts && opts.silent);

    const btn = DOM.blocBtnSave();
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Enregistrement…';
    }
    setBlocAutosaveStatus('saving');

    // Collecte des valeurs depuis le DOM
    const patch = {};
    DOM.blocInputs().forEach(function (el) {
      const field = el.getAttribute('data-bloc-field');
      const axe4Slug = el.getAttribute('data-bloc-field-axe4');
      if (field) {
        let val = el.value;
        // Trim pour les chaînes, parseInt pour duree_min
        if (field === 'duree_min') {
          val = parseInt(val, 10);
          if (isNaN(val) || val < 1) val = 1;
        } else if (typeof val === 'string') {
          val = val.trim() || null;
        }
        patch[field] = val;
      }
    });

    // Reconstruction du jsonb contenu_pedagogique_axe4
    const axe4Patch = {};
    document.querySelectorAll('[data-bloc-field-axe4]').forEach(function (el) {
      const slug = el.getAttribute('data-bloc-field-axe4');
      const v = (el.value || '').trim();
      if (v) axe4Patch[slug] = v;
    });
    patch.contenu_pedagogique_axe4 = axe4Patch;

    const res = await SupabaseHub.updateBloc(State.currentBloc.id, patch);

    if (!res.ok) {
      console.error('SeanceEditor: saveBloc() KO', res.error);
      setBlocAutosaveStatus('error');
      if (!silent) alert('Erreur sauvegarde du bloc : ' + res.error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer le bloc';
      }
      return false;
    }

    // Succès : MAJ State.currentBloc + ligne dans State.blocs
    State.currentBloc = res.data;
    const idx = State.blocs.findIndex(function (b) { return b.id === res.data.id; });
    if (idx !== -1) State.blocs[idx] = res.data;
    setBlocDirty(false);
    setBlocAutosaveStatus('idle');

    // Si le type a changé, on doit re-render le détail (étiquettes peuvent changer)
    // + on re-render la trame (emoji/libellé du type peut changer) — au retour seulement
    return true;
  }

  async function onSaveBloc() {
    await saveBloc({ silent: false });
  }

  async function onTickBlocAutosave() {
    if (!State.blocIsDirty) return;
    if (State.blocAutosaveStatus === 'saving') return;
    await saveBloc({ silent: true });
  }

  function startBlocAutosave() {
    stopBlocAutosave();
    State.blocAutosaveTimer = setInterval(onTickBlocAutosave, AUTOSAVE_INTERVAL_MS);
  }

  function stopBlocAutosave() {
    if (State.blocAutosaveTimer) {
      clearInterval(State.blocAutosaveTimer);
      State.blocAutosaveTimer = null;
    }
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
   * Charge le référentiel data/vocabulaire-seance.json (Phase 5.7).
   * 4 axes du Vocabulaire MOM Hub. Utilisé pour les dropdowns Axe 2 / Axe 3
   * et les 10 champs FFR Axe 4 dans la vue détail bloc.
   */
  async function loadVocabulaireRef() {
    try {
      const resp = await fetch('data/vocabulaire-seance.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.vocabulaireRef = await resp.json();
    } catch (e) {
      console.error('SeanceEditor: loadVocabulaireRef() KO', e);
      State.vocabulaireRef = null;
    }
  }

  /**
   * Charge le miroir Bibliothèque (Phase 5.8). Top-level = objet
   * { fileId_dossier (33 chars) : { source, cartouche, pedagogie, media, files } }
   * avec ~62 fiches. Régénéré manuellement par le converter Python depuis Drive.
   * En cas d'échec (fichier absent / réseau), State.fichesRef reste null et
   * le picker affichera un message d'erreur — pas de crash.
   */
  async function loadFichesRef() {
    try {
      const resp = await fetch('data/fiches-all.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      State.fichesRef = await resp.json();
      const nb = State.fichesRef ? Object.keys(State.fichesRef).length : 0;
      console.log('SeanceEditor: fiches-all.json chargé (' + nb + ' fiches)');
    } catch (e) {
      console.error('SeanceEditor: loadFichesRef() KO', e);
      State.fichesRef = null;
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
    // pour les dropdowns du formulaire, types-blocs.json pour la trame (5.6.A),
    // vocabulaire-seance.json pour le détail bloc (5.7), fiches-all.json pour
    // le picker ateliers (5.8)
    await Promise.all([
      loadSeances(),
      loadSites(),
      loadEvenements(),
      loadTypesBlocsRef(),
      loadVocabulaireRef(),
      loadFichesRef()
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
    // + arrêt propre des 2 timers autosave (Phase 5.5.B2 + 5.7)
    window.addEventListener('beforeunload', function (e) {
      stopAutosave();
      stopBlocAutosave();
      if (State.isDirty || State.blocIsDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    console.log(
      '%c🏉 Seance Editor v1.5 (Phase 5.7) chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        seances: State.seances.length,
        sites: State.sites.length,
        evenements: State.evenements.length,
        types_blocs_ref: State.typesBlocsRef ? 'OK' : 'KO',
        vocabulaire_ref: State.vocabulaireRef ? 'OK' : 'KO',
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
    loadVocabulaireRef: loadVocabulaireRef,
    // Phase 5.5.B2 : exposition autosave pour debug console
    startAutosave: startAutosave,
    stopAutosave: stopAutosave,
    // Phase 5.7 : exposition autosave bloc
    startBlocAutosave: startBlocAutosave,
    stopBlocAutosave: stopBlocAutosave
  };

})();
