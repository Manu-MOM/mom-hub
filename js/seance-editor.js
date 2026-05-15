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
 * Version : 1.1 — Phase 5.5.B1 (15 mai 2026)
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
 *
 * Dépendances :
 *   - window.SupabaseHub v1.8.1 (wrappers Phase 5.3 + listSitesActifs)
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

  const State = {
    seances: [],            // liste pour la sidebar
    currentSeance: null,    // séance en cours d'édition (objet complet)
    isDirty: false,         // true si modif non sauvée
    sites: [],              // cache pour dropdown lieu_id (5.5.B1)
    evenements: []          // cache pour dropdown evenement_id (5.5.B1)
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
    feedback:      () => document.getElementById('seance-feedback')
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
            'title="Sélection · Phase 5.5.B">' +
          '<div class="seance-list-item__head">' +
            '<span class="seance-list-item__date">' + dateLib + (heureLib ? ' · ' + heureLib : '') + '</span>' +
            '<span class="seance-list-item__etat etat-' + escapeHtml(s.etat) + '">' + etatLib + '</span>' +
          '</div>' +
          '<div class="seance-list-item__title">' + titre + '</div>' +
        '</li>'
      );
    }).join('');

    body.innerHTML = '<ul class="seance-list">' + items + '</ul>';
    // Note 5.5.A : pas de listener de clic — le rechargement par clic
    // sera activé en 5.5.B (nécessite gestion de isDirty + confirm si non sauvé).
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

  function renderForm() {
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
          '<span class="seance-form__etat etat-' + escapeHtml(s.etat) + '">' + libelleEtatSeance(s.etat) + '</span>' +
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
            'Phase 5.5.B1 · Sauvegarde manuelle (autosave 30s prévu en Phase 5.5.B2)' +
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
    setDirty(false);                  // séance fraîche = pas de modif
    renderSidebar();
    renderForm();
    showFeedback('Nouvelle séance créée. Renseigne les méta puis enregistre.', 'info');
  }

  async function onSaveSeance() {
    if (!State.currentSeance) return;
    if (!State.isDirty) return;

    const btn = DOM.btnSave();
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Enregistrement…';
    }

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
      console.error('SeanceEditor: onSaveSeance() KO', res.error);
      showFeedback('Erreur sauvegarde : ' + res.error, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer les modifications';
      }
      return;
    }

    // Succès : on met à jour State avec la donnée canonique (côté DB)
    State.currentSeance = res.data;
    // Synchroniser aussi la ligne sidebar (recherche par id et remplace)
    const idx = State.seances.findIndex(function (s) { return s.id === res.data.id; });
    if (idx !== -1) State.seances[idx] = res.data;
    setDirty(false);
    renderSidebar();
    showFeedback('Séance enregistrée.', 'success');
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

  // ============================================================
  // 8. INIT
  // ============================================================

  async function init() {
    // Chargements parallèles : séances pour la sidebar, sites et événements
    // pour les dropdowns du formulaire
    await Promise.all([
      loadSeances(),
      loadSites(),
      loadEvenements()
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

    // Warn si modif non sauvée à la fermeture de l'onglet (V1A : check basique)
    window.addEventListener('beforeunload', function (e) {
      if (State.isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    console.log(
      '%c🏉 Seance Editor v1.1 (Phase 5.5.B1) chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        seances: State.seances.length,
        sites: State.sites.length,
        evenements: State.evenements.length
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
    loadEvenements: loadEvenements
  };

})();
