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
 * Version : 1.11 — SUIVI-COACH-1 Objet C accroche (18 mai 2026)
 *   v1.0 : S2.1 squelette init basique
 *   v1.1 : S2.2 — vraies cartes événements
 *   v1.2 : S2.2.fix — correction adversaire tournois
 *   v1.3 : S2.3 — Fiche détaillée E2
 *   v1.4 : S2.4.b — câblage complet des 3 modales E3/E4/E5
 *   v1.4.1: S2.5 fix UX — auto-scrollTop modales
 *   v1.5 : P2-E.1 — Duplication événement dans E3 + redirect fiche tournoi
 *   v1.6 : P2-E.2 — Édition fiche : modale E6 (modifier identité) +
 *          modale E7 (notes internes). Boutons ✏️ Modifier et 📝 Notes
 *          câblés dans la fiche. Appels updateEvenement wrapper v1.12.
 *   v1.7 : RÉCONCILIATION DE BANDEAU (pas de nouveau code ici).
 *          Le corps contenait déjà P2-E.3 (formulaire logistique
 *          structuré + modale E8, ~ligne 1187) et P2-E.5 (sections
 *          fiche collapsibles mobile), conformes à l'état attendu par
 *          STATE.md (« evenements-browser v1.7 »), mais le bandeau
 *          était resté à v1.5/v1.6. Bandeau corrigé pour refléter le
 *          contenu réellement présent. Aucune ligne fonctionnelle
 *          modifiée par cette réconciliation.
 *   v1.8 : SUIVI-COACH-1 Objet A — point d'entrée coach « générer le
 *          lien de suivi ». Section dédiée « Suivi de la rencontre »
 *          sur la fiche (renderSuiviSection), visible pour
 *          type_evenement ∈ {match, tournoi} uniquement, gardée
 *          etat ∉ {annule, archive} (calque le pattern existant des
 *          autres actions de la fiche ; seuil exact = dette Audits
 *          C12-gate, signalée, non inventée).
 *          3 états adaptatifs (A-Q2) : compo pas prête (message +
 *          raccourci compositions) / compo prête (bouton générer) /
 *          lien actif (lien + copier·partager·régénérer). Tournoi
 *          (A-Q3) : 1 lien par match enfant, dans le regroupement par
 *          phase déjà utilisé par la section « Phases du tournoi »
 *          (structure réutilisée, jamais à plat). Lien de SAISIE seul
 *          (A-Q4) ; lien spectateur NON exposé (évolution tracée
 *          Objet C-2 / SUIVI-UI-6, hors cycle).
 *          État 3 borné à la SESSION (option i) : la table lien_suivi
 *          est fermée et aucune RPC ne relit un lien existant — le
 *          lien généré est gardé en RAM le temps de la session (jamais
 *          localStorage). Après rechargement : retour état 2 ;
 *          re-générer est sûr (relais backend C12-f révoque l'ancien).
 *          [NOTE v1.9 : ce point « borné session » est LEVÉ pour le
 *          match simple par SUIVI-COACH-2 ci-dessous — get_lien_saisie
 *          _actif (C12-h) permet désormais la relecture. Tournoi reste
 *          borné session. Historique conservé pour traçabilité.]
 *          « Compo prête » réutilise statutCompoBadge (notion DÉJÀ
 *          connue de la fiche) — aucun seuil inventé. Autorité réelle
 *          = garde-fou serveur PI-7 : un refus PI-7 est retraduit en
 *          « compo pas réellement prête », pas en erreur brute.
 *          Dépend de supabase-client v1.13 (wrapper genererLienEphemere).
 *
 *   v1.9 : SUIVI-COACH-2 — état 3 d'Objet A PERSISTANT entre visites
 *          (match simple). À l'ouverture d'une fiche (openFiche), si
 *          la rencontre est un match simple et qu'aucun lien n'est
 *          déjà en session, appel de SupabaseHub.getLienSaisieActif
 *          (wrapper C12-h, supabase-client v1.14). Si un lien 'saisie'
 *          actif existe → pré-remplissage de SUIVI_LIENS_SESSION →
 *          renderSuiviSection affiche directement l'état 3 (le coach
 *          retrouve son lien au lieu d'en regénérer un). Lève la
 *          limitation « borné session » de v1.8 pour le match simple.
 *          AUCUNE retouche de la logique d'Objet A : la section, les
 *          3 états, le tournoi, génération/copier/partager/régénérer
 *          sont inchangés — c'est une simple ALIMENTATION amont de
 *          SUIVI_LIENS_SESSION (cohérent STATE : « état 3 alimenté par
 *          cette RPC, aucune retouche logique »).
 *          Garde-fous : (1) match simple UNIQUEMENT — tournoi resterait
 *          N appels/enfant, reste borné session (décision périmètre
 *          Manu) ; (2) STRICTEMENT non bloquant — échec RPC ou wrapper
 *          absent n'empêche jamais l'ouverture de la fiche (persistance
 *          = confort, pas dépendance dure) ; (3) n'écrase pas un lien
 *          déjà en session (lien généré dans la session = plus récent,
 *          fait foi) ; (4) data:null (aucun lien actif) = cas NORMAL,
 *          jamais une erreur (Objet A → état 2). Filtrage actif/non
 *          révoqué/non expiré fait PAR la RPC, non re-vérifié client.
 *
 *   v1.10 : SUIVI-COACH-1 Objet B — ACCROCHE Mode Vidéo.
 *          Continuation adaptative de la section « Suivi de la
 *          rencontre » d'Objet A (B-Q1) : une fois la rencontre
 *          JOUÉE (etat ∈ {joue,resultat}, ∉ {archive,annule}),
 *          un accès « 🎬 Revoir ce match (Mode Vidéo) » ouvre
 *          l'écran coach distinct mode-video.html?e=<uuid>
 *          (convention ?e= posée dans js/mode-video.js, réutilisée
 *          à l'identique — un seul contrat). ADDITION PURE,
 *          modèle SUIVI-COACH-2 STRICT : 3 nouvelles fonctions
 *          (modeVideoBuildUrl, suiviRevoirActionnable,
 *          renderModeVideoAcces) + 2 appels EN AVAL de
 *          renderSuiviRencontreBloc (match simple & matchs
 *          enfants — A-Q3, hiérarchie réutilisée) + 1 forEach
 *          de binding. AUCUNE fonction d'Objet A modifiée,
 *          AUCUNE branche d'état / génération de lien touchée.
 *          Seuil « jouée » aligné dette Audits C12-gate (même
 *          posture qu'A-Q2/suiviActionnable, non inventé).
 *          Spec : Conception-SUIVI-COACH-1-ObjetB.md (validé
 *          Manu). Dépend de mode-video.html + mode-video.js +
 *          supabase-client v1.15 (couche données coach).
 *
 *   v1.11 : SUIVI-COACH-1 Objet C — ACCROCHE (panneau temps de jeu
 *          C-1 + lien spectateur C-2). ADDITION PURE, modèle
 *          SUIVI-COACH-2/v1.10 STRICT : nouvelles fonctions
 *          uniquement (spectateurBuildUrl, renderSpectateurAcces,
 *          renderTempsDeJeuMount + handlers spectGenerer/Copier/
 *          Partager) + appels EN AVAL de renderSuiviRencontreBloc
 *          (match simple & matchs enfants — A-Q3, hiérarchie
 *          réutilisée à l'identique) + forEach de binding siblings.
 *          AUCUNE fonction d'Objet A/B modifiée, AUCUNE branche
 *          d'état / génération de lien de saisie touchée.
 *          • C-1 (temps de jeu) : un placeholder est émis EN AVAL
 *            (gate suiviRevoirActionnable = MÊME seuil « phase aval »
 *            que Mode Vidéo, non inventé) puis TempsDeJeu.monter()
 *            est appelé post-render (js/temps-de-jeu.js, panneau
 *            replié, lecture pure). Non bloquant si TempsDeJeu
 *            absent (posture v1.9/v1.10).
 *          • C-2 (lien spectateur) : exposé « dans l'état 3 »
 *            (C2-Q3, évolution A-Q4) — renderSpectateurAcces rend
 *            '' sauf si un lien de saisie est actif en session.
 *            Coach-initié (génération = écriture délibérée, jamais
 *            d'auto-INSERT). Borné session : aucune RPC de
 *            relecture spectateur n'existe (seul getLienSaisieActif
 *            /C12-h, saisie-only) — même posture « borné session »
 *            que le lien de saisie v1.8 (honnête, non inventé).
 *            Map isolée SUIVI_SPECT_SESSION (la Map d'Objet A
 *            n'est NI touchée NI relue pour écrire). URL
 *            spectateur.html?t=<jeton> calquée sur suiviBuildUrl.
 *          genererLienEphemere(evtId,'spectateur') : contrat
 *          DÉJÀ présent (wrapper v1.13, role∈saisie|spectateur ;
 *          C12-f generer_lien_ephemere sans PI-7 ni relais pour
 *          'spectateur') — l'évolution « Objet C-2 / SUIVI-UI-6 »
 *          tracée par v1.8/A-Q4 est ICI réalisée (plus « hors
 *          cycle » : c'est ce cycle). Rien inventé, contrat activé.
 *          Spec : Conception-SUIVI-COACH-1-ObjetC.md (validé Manu).
 *          Dépend de spectateur.html + js/spectateur.js +
 *          js/temps-de-jeu.js + supabase-client v1.16.
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

  // SUIVI-COACH-1 Objet A — état borné à la SESSION (option i).
  // FICHE_EVT_COURANT : dernier évènement ouvert dans la fiche, pour
  // rafraîchir la section Suivi en place sans re-fetch réseau.
  let FICHE_EVT_COURANT = null;
  // Lien de suivi généré pendant la session, par UUID de rencontre.
  // En RAM UNIQUEMENT (jamais localStorage — cohérent avec l'invariant
  // I5 du module Suivi). evtId -> { token, role, expire_le, url }
  const SUIVI_LIENS_SESSION = new Map();

  // SUIVI-COACH-1 Objet C accroche (v1.11) — Map ISOLÉE des liens
  // spectateur (C2-Q3). Distincte de SUIVI_LIENS_SESSION (Objet A) :
  // jeton/rôle différents, lecture seule. En RAM UNIQUEMENT (jamais
  // localStorage — invariant I5). Borné session (aucune RPC de
  // relecture spectateur n'existe). evtId -> { token, expire_le, url }
  const SUIVI_SPECT_SESSION = new Map();

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

      // SUIVI-COACH-1 Objet A : mémorise l'évènement courant pour le
      // rafraîchissement en place de la section Suivi (sans re-fetch).
      FICHE_EVT_COURANT = evt;

      // SUIVI-COACH-2 : état 3 persistant entre visites (match simple).
      // Avant le rendu, si un lien 'saisie' actif existe déjà pour
      // cette rencontre, on pré-remplit SUIVI_LIENS_SESSION → la
      // section Suivi (Objet A) affichera directement l'état 3 au lieu
      // de retomber à l'état 2 « générer ».
      //   - Match simple UNIQUEMENT (décision de périmètre : les
      //     tournois resteraient N appels/enfant ; bornés session).
      //   - NON bloquant : un échec RPC / un wrapper absent ne doit
      //     JAMAIS empêcher l'ouverture de la fiche (la persistance
      //     est un confort, pas une dépendance dure).
      //   - N'écrase PAS un lien déjà en session (un lien généré dans
      //     cette session est le plus récent et fait foi).
      if (evt.type_evenement === 'match'
          && !SUIVI_LIENS_SESSION.has(evt.id)
          && window.SupabaseHub
          && typeof SupabaseHub.getLienSaisieActif === 'function') {
        try {
          const res = await SupabaseHub.getLienSaisieActif(evt.id);
          // res.ok && res.data === null = aucun lien actif : normal,
          // on ne fait rien (Objet A affichera l'état 2). Seul un
          // lien réellement présent pré-remplit la session.
          if (res && res.ok && res.data && res.data.token) {
            SUIVI_LIENS_SESSION.set(evt.id, {
              token:     res.data.token,
              role:      'saisie',   // la RPC ne renvoie que des 'saisie'
              expire_le: res.data.expire_le,
              url:       suiviBuildUrl(res.data.token)
            });
          }
        } catch (e) {
          // Strictement non bloquant : on log et on poursuit
          // l'ouverture de la fiche en l'état (état 2).
          console.error('MOM Hub: openFiche() relecture lien saisie', e);
        }
      }

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

  // ============================================================
  // SUIVI DE LA RENCONTRE — SUIVI-COACH-1 Objet A
  // ============================================================
  // Point d'entrée coach : génère le lien éphémère de Suivi d'une
  // rencontre via SupabaseHub.genererLienEphemere (RPC C12-f) et le
  // transmet au bénévole. Spec : Conception-SUIVI-COACH-1-ObjetA.md.
  // Hors périmètre intangible : suivi.html / suivi-app.js /
  // suivi-client.js (module bénévole clôturé, sans login) NE sont PAS
  // touchés ; on ne fait qu'émettre le lien que ce module consomme.

  // URL de saisie du module bénévole (suivi.html).
  // Contrat documenté (STATE.md) : suivi.html est sans login et lit le
  // jeton dans le paramètre ?t=. Rien d'inventé ici.
  function suiviBuildUrl(token) {
    const u = new URL('suivi.html', window.location.href);
    u.search = '?t=' + encodeURIComponent(token);
    return u.toString();
  }

  // ============================================================
  // SUIVI-COACH-1 Objet B — ACCROCHE Mode Vidéo (ADDITION PURE)
  // ============================================================
  // Continuation adaptative de la section « Suivi de la rencontre »
  // d'Objet A (B-Q1). NOUVELLES fonctions uniquement, appelées EN
  // AVAL de renderSuiviRencontreBloc : ZÉRO retouche de la logique
  // d'Objet A (modèle SUIVI-COACH-2, comme v1.9). Spec :
  // Conception-SUIVI-COACH-1-ObjetB.md (validé Manu).

  // URL de l'écran Mode Vidéo (coach authentifié, fichier distinct
  // — B-Q1). Convention ?e= POSÉE dans js/mode-video.js (EVT_PARAM)
  // et réutilisée ici À L'IDENTIQUE (un seul contrat, pas deux).
  // Pattern calqué sur suiviBuildUrl — rien inventé.
  function modeVideoBuildUrl(evtId) {
    const u = new URL('mode-video.html', window.location.href);
    u.search = '?e=' + encodeURIComponent(evtId);
    return u.toString();
  }

  // La rencontre est-elle « revoyable » en Mode Vidéo ? B-Q1 :
  // visible une fois la rencontre JOUÉE. États evenements réels
  // (STATE / C12-a) : creation|compo|joue|resultat|archive|annule.
  // « Jouée » = {joue, resultat} (le match a eu lieu) ; avant, rien
  // à revoir ; archive/annule exclus. Même posture qu'A-Q2 /
  // suiviActionnable : on conçoit le COMPORTEMENT, le SEUIL exact
  // reste la dette Audits C12-gate — aligné, NON inventé.
  function suiviRevoirActionnable(rencontre) {
    if (!rencontre) return false;
    return rencontre.etat === 'joue' || rencontre.etat === 'resultat';
  }

  // Élément d'accès Mode Vidéo pour UNE rencontre (match simple OU
  // match enfant — A-Q3 : même unité réutilisée, hiérarchie tournoi
  // respectée sans la réinventer). '' si non applicable. Appelé EN
  // AVAL de renderSuiviRencontreBloc, ne le modifie pas. Style
  // calqué sur les blocs Objet A (mêmes variables CSS).
  function renderModeVideoAcces(rencontre) {
    if (!suiviRevoirActionnable(rencontre)) return '';
    const evtId = rencontre.id;
    let h = '<div style="padding:6px 0;border-top:1px solid var(--paper-warm);margin-top:8px;">';
    h += '<button type="button" class="evt-btn" data-action="suivi-revoir-video" data-event-id="' + escHtml(evtId) + '">🎬 Revoir ce match (Mode Vidéo)</button>';
    h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Écran coach a posteriori : compléter / corriger le déroulé depuis la vidéo, au calme.</div>';
    h += '</div>';
    return h;
  }

  // ============================================================
  // SUIVI-COACH-1 Objet C — ACCROCHE (ADDITION PURE)
  // ============================================================
  // Panneau temps de jeu C-1 + lien spectateur C-2. NOUVELLES
  // fonctions uniquement, appelées EN AVAL de renderSuiviRencontre-
  // Bloc : ZÉRO retouche de la logique d'Objet A/B (modèle v1.10).
  // Spec : Conception-SUIVI-COACH-1-ObjetC.md (validé Manu).

  // URL de l'écran spectateur (lecture seule, fichier distinct
  // — C2-Q1). Contrat ?t=<jeton> POSÉ dans js/spectateur.js /
  // suivi-client.js (getToken lit ?t=), réutilisé À L'IDENTIQUE.
  // Pattern calqué sur suiviBuildUrl — rien inventé.
  function spectateurBuildUrl(token) {
    const u = new URL('spectateur.html', window.location.href);
    u.search = '?t=' + encodeURIComponent(token);
    return u.toString();
  }

  // Accès « lien spectateur » pour UNE rencontre. C2-Q3 / évolution
  // A-Q4 : exposé UNIQUEMENT « dans l'état 3 » (un lien de saisie
  // est actif en session = le suivi est en place). '' sinon. Lecture
  // seule de SUIVI_LIENS_SESSION pour décider la visibilité (même
  // posture que renderModeVideoAcces qui lit rencontre.etat — on ne
  // modifie ni n'écrit la Map d'Objet A). Borné session (aucune RPC
  // de relecture spectateur n'existe — honnête, non inventé).
  function renderSpectateurAcces(rencontre) {
    const evtId = rencontre.id;
    if (!SUIVI_LIENS_SESSION.get(evtId)) return '';   // pas état 3
    const spect = SUIVI_SPECT_SESSION.get(evtId);
    let h = '<div style="padding:6px 0;border-top:1px solid var(--paper-warm);margin-top:8px;">';
    if (spect) {
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);margin-bottom:4px;">Lien spectateur (lecture seule — familles, public)</div>';
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--ink);word-break:break-all;background:var(--paper-warm);padding:8px;border-radius:6px;">' + escHtml(spect.url) + '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:4px;">Valable jusqu\'au ' + escHtml(formatDateShort(spect.expire_le)) + '</div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">';
      h += '<button type="button" class="evt-btn" data-action="suivi-spect-copier" data-event-id="' + escHtml(evtId) + '">📋 Copier</button>';
      h += '<button type="button" class="evt-btn" data-action="suivi-spect-partager" data-event-id="' + escHtml(evtId) + '">📤 Partager</button>';
      h += '<button type="button" class="evt-btn evt-btn-danger" data-action="suivi-spect-regenerer" data-event-id="' + escHtml(evtId) + '">🔄 Régénérer</button>';
      h += '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Lecture seule : ce lien ne permet jamais de saisir. Régénérer en crée un nouveau (les précédents restent valables jusqu\'à leur expiration).</div>';
    } else {
      h += '<button type="button" class="evt-btn" data-action="suivi-spect-generer" data-event-id="' + escHtml(evtId) + '">👁 Lien spectateur (lecture seule)</button>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Lien public à transmettre aux familles : suivi en lecture seule, aucune possibilité de saisie.</div>';
    }
    h += '</div>';
    return h;
  }

  // Placeholder de montage du panneau temps de jeu C-1. Émis EN
  // AVAL ; gate = suiviRevoirActionnable (MÊME seuil « phase aval »
  // que Mode Vidéo — non inventé). Le composant js/temps-de-jeu.js
  // est monté post-render (bindSuiviActions) ; il porte lui-même sa
  // logique de 4 états (replié, lecture pure). data-etat transmet
  // l'état rencontre (connu côté coach via la fiche — C1-Q3).
  function renderTempsDeJeuMount(rencontre) {
    if (!suiviRevoirActionnable(rencontre)) return '';
    return '<div data-tdj-mount data-event-id="' + escHtml(rencontre.id)
         + '" data-etat="' + escHtml(rencontre.etat || '') + '"></div>';
  }

  // Génération / régénération d'un lien SPECTATEUR (lecture seule).
  // Miroir de suiviGenerer mais role='spectateur' : C12-f
  // generer_lien_ephemere n'applique NI PI-7 NI relais pour
  // 'spectateur' (saisie-only) → génération inconditionnelle, et
  // les anciens liens restent valables (lecture seule, inoffensifs).
  async function spectGenerer(evtId, btn, isRegen) {
    if (!evtId) return;
    const labelInitial = isRegen ? '🔄 Régénérer' : '👁 Lien spectateur (lecture seule)';
    if (btn) { btn.disabled = true; btn.textContent = isRegen ? 'Régénération…' : 'Génération…'; }
    try {
      const res = await SupabaseHub.genererLienEphemere(evtId, 'spectateur');
      if (!res || !res.ok) {
        const msg = (res && res.error) || 'erreur inconnue';
        alert('Échec de la génération du lien spectateur : ' + msg);
        if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
        return;
      }
      const d = res.data;   // { token, role, expire_le }
      SUIVI_SPECT_SESSION.set(evtId, {
        token:     d.token,
        expire_le: d.expire_le,
        url:       spectateurBuildUrl(d.token)
      });
      refreshSuiviSection();
    } catch (err) {
      console.error('MOM Hub: spectGenerer()', err);
      alert('Erreur inattendue : ' + (err && err.message ? err.message : err));
      if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
    }
  }

  async function spectCopier(evtId) {
    const s = SUIVI_SPECT_SESSION.get(evtId);
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s.url);
      alert('Lien spectateur copié dans le presse-papiers.');
    } catch (e) {
      window.prompt('Copiez le lien spectateur :', s.url);
    }
  }

  async function spectPartager(evtId) {
    const s = SUIVI_SPECT_SESSION.get(evtId);
    if (!s) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Suivi de la rencontre (spectateur)',
          text:  'Lien spectateur — suivi en lecture seule',
          url:   s.url
        });
      } catch (e) {
        // Partage annulé : silencieux
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(s.url);
      alert('Partage non disponible sur cet appareil — lien copié à la place.');
    } catch (e) {
      window.prompt('Copiez le lien spectateur :', s.url);
    }
  }

  // Compo « prête » selon la notion DÉJÀ connue de la fiche.
  // AUCUN seuil inventé : on réutilise statutCompoBadge
  // (prête ⟺ validee+utilisee===total && total>0).
  function suiviCompoPrete(rencontre) {
    const b = statutCompoBadge(rencontre && rencontre.compo_status_summary);
    return b.cls === 'validee' || b.cls === 'utilisee';
  }

  // Le Suivi est-il proposable pour cette rencontre ?
  // A-Q1 : match|tournoi uniquement. Garde etat ∉ {annule,archive} =
  // calque du pattern existant des autres actions de la fiche
  // (le seuil exact reste la dette Audits C12-gate — signalée).
  function suiviActionnable(rencontre) {
    if (!rencontre) return false;
    if (rencontre.type_evenement !== 'match' && rencontre.type_evenement !== 'tournoi') return false;
    return rencontre.etat !== 'annule' && rencontre.etat !== 'archive';
  }

  // Bloc 3-états pour UNE rencontre (match simple OU match enfant).
  function renderSuiviRencontreBloc(rencontre) {
    const evtId = rencontre.id;
    const lien  = SUIVI_LIENS_SESSION.get(evtId);

    // ÉTAT 3 — lien actif (borné session)
    if (lien) {
      let h = '<div style="padding:8px 0;">';
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);margin-bottom:4px;">Lien de saisie (à transmettre au bénévole)</div>';
      h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--ink);word-break:break-all;background:var(--paper-warm);padding:8px;border-radius:6px;">' + escHtml(lien.url) + '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:4px;">Valable jusqu\'au ' + escHtml(formatDateShort(lien.expire_le)) + '</div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">';
      h += '<button type="button" class="evt-btn" data-action="suivi-copier" data-event-id="' + escHtml(evtId) + '">📋 Copier</button>';
      h += '<button type="button" class="evt-btn" data-action="suivi-partager" data-event-id="' + escHtml(evtId) + '">📤 Partager</button>';
      h += '<button type="button" class="evt-btn evt-btn-danger" data-action="suivi-regenerer" data-event-id="' + escHtml(evtId) + '">🔄 Régénérer</button>';
      h += '</div>';
      h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Régénérer crée un nouveau lien : l\'ancien cessera <strong>immédiatement</strong> de fonctionner.</div>';
      h += '</div>';
      return h;
    }

    // ÉTAT 1 — compo pas prête
    if (!suiviCompoPrete(rencontre)) {
      let h = '<div style="padding:8px 0;">';
      h += '<div style="font-size:13px;color:var(--ink);margin-bottom:8px;">La composition de cette rencontre doit être <strong>validée</strong> avant de pouvoir générer le lien de suivi.</div>';
      // Raccourci honnête : compositions.html est une page réelle. Le
      // deep-link vers la compo de CETTE rencontre nécessiterait la
      // convention d'URL de compositions.html — NON inventée ici.
      h += '<button type="button" class="evt-btn" data-action="suivi-aller-compo">→ Aller aux compositions</button>';
      h += '</div>';
      return h;
    }

    // ÉTAT 2 — compo prête → bouton générer
    let h = '<div style="padding:8px 0;">';
    h += '<button type="button" class="evt-btn evt-btn-primary" data-action="suivi-generer" data-event-id="' + escHtml(evtId) + '">🔗 Générer le lien de suivi</button>';
    h += '<div style="font-size:11px;color:var(--ink-mute);margin-top:6px;">Générer peut remplacer un lien émis précédemment pour cette rencontre (l\'ancien serait alors révoqué).</div>';
    h += '</div>';
    return h;
  }

  // Section complète « Suivi de la rencontre » (ou '' si non
  // applicable). id stable evt-suivi-section pour le rafraîchissement
  // en place après génération.
  function renderSuiviSection(evt) {
    if (!suiviActionnable(evt)) return '';

    let html = '<div class="evt-fiche-section" id="evt-suivi-section">';
    html += '<div class="evt-fiche-section-title">🔗 Suivi de la rencontre</div>';

    if (evt.type_evenement === 'tournoi') {
      // A-Q3 : 1 lien par match enfant, DANS la structure du tournoi.
      // Réutilise le regroupement par phase déjà utilisé par la
      // section « Phases du tournoi » (structure non réinventée).
      const enfants = CHILDREN_BY_PARENT[evt.id] || [];
      if (enfants.length === 0) {
        html += '<div class="evt-fiche-empty">Aucun match interne pour ce tournoi — créez les matchs pour générer leurs liens de suivi.</div>';
      } else {
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
            const childLibStartsVs = (child.libelle || '').toLowerCase().indexOf('vs ') === 0;
            const advBlock = childLibStartsVs
              ? ''
              : (child.adversaire_nom ? ' · vs ' + escHtml(child.adversaire_nom) : '');
            html += '<div style="border-top:1px solid var(--paper-warm);padding-top:6px;margin-top:6px;">';
            html += '<div style="font-size:13px;color:var(--ink);font-weight:600;">' + escHtml(heure) + ' · ' + escHtml(child.libelle || '') + advBlock + '</div>';
            if (child.etat === 'annule' || child.etat === 'archive') {
              html += '<div style="font-size:12px;color:var(--ink-mute);padding:6px 0;">Match ' + escHtml(child.etat) + ' — pas de lien de suivi.</div>';
            } else {
              html += renderSuiviRencontreBloc(child);
              html += renderModeVideoAcces(child);
              html += renderSpectateurAcces(child);
              html += renderTempsDeJeuMount(child);
            }
            html += '</div>';
          });
        });
      }
    } else {
      // Match simple
      html += renderSuiviRencontreBloc(evt);
      html += renderModeVideoAcces(evt);
      html += renderSpectateurAcces(evt);
      html += renderTempsDeJeuMount(evt);
    }

    html += '</div>';
    return html;
  }

  // Rafraîchit la seule section Suivi en place (pas de re-fetch, pas
  // de re-render de toute la fiche → ne perturbe pas les collapsibles).
  function refreshSuiviSection() {
    const cur = document.getElementById('evt-suivi-section');
    if (!cur || !FICHE_EVT_COURANT) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderSuiviSection(FICHE_EVT_COURANT);
    const fresh = tmp.firstElementChild;
    if (fresh) {
      cur.replaceWith(fresh);
      bindSuiviActions();
    }
  }

  // Génération / régénération d'un lien de saisie.
  async function suiviGenerer(evtId, btn, isRegen) {
    if (!evtId) return;
    if (isRegen) {
      const ok = window.confirm(
        'Régénérer le lien de suivi ?\n\n' +
        "L'ancien lien de cette rencontre cessera IMMÉDIATEMENT de " +
        'fonctionner. Le bénévole devra utiliser le nouveau lien.'
      );
      if (!ok) return;
    }
    const labelInitial = isRegen ? '🔄 Régénérer' : '🔗 Générer le lien de suivi';
    if (btn) { btn.disabled = true; btn.textContent = isRegen ? 'Régénération…' : 'Génération…'; }
    try {
      const res = await SupabaseHub.genererLienEphemere(evtId);
      if (!res || !res.ok) {
        const msg = (res && res.error) || 'erreur inconnue';
        // PI-7 : refus serveur faute de compo validée active. Retraduit
        // en message métier clair (pas une erreur brute).
        if (/PI-7|composition\s+valid|compo/i.test(msg)) {
          alert(
            "La composition de cette rencontre n'est pas validée côté " +
            'serveur : le suivi ne peut pas démarrer.\n\n' +
            'Validez la compo de la rencontre puis réessayez.'
          );
        } else {
          alert('Échec de la génération du lien : ' + msg);
        }
        if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
        return;
      }
      const d = res.data;   // { token, role, expire_le }
      SUIVI_LIENS_SESSION.set(evtId, {
        token:     d.token,
        role:      d.role,
        expire_le: d.expire_le,
        url:       suiviBuildUrl(d.token)
      });
      refreshSuiviSection();
    } catch (err) {
      console.error('MOM Hub: suiviGenerer()', err);
      alert('Erreur inattendue : ' + (err && err.message ? err.message : err));
      if (btn) { btn.disabled = false; btn.textContent = labelInitial; }
    }
  }

  async function suiviCopier(evtId) {
    const lien = SUIVI_LIENS_SESSION.get(evtId);
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien.url);
      alert('Lien copié dans le presse-papiers.');
    } catch (e) {
      // Repli si Clipboard API indisponible / refusée
      window.prompt('Copiez le lien de suivi :', lien.url);
    }
  }

  async function suiviPartager(evtId) {
    const lien = SUIVI_LIENS_SESSION.get(evtId);
    if (!lien) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Suivi de la rencontre',
          text:  'Lien de saisie du suivi de la rencontre',
          url:   lien.url
        });
      } catch (e) {
        // Partage annulé par l'utilisateur : silencieux
      }
      return;
    }
    // Pas de Web Share → repli copie
    try {
      await navigator.clipboard.writeText(lien.url);
      alert('Partage non disponible sur cet appareil — lien copié à la place.');
    } catch (e) {
      window.prompt('Copiez le lien de suivi :', lien.url);
    }
  }

  // Câble les actions de la section Suivi. Appelée par
  // bindFicheActions() (rendu complet) ET refreshSuiviSection()
  // (rafraîchissement partiel — les anciens noeuds ont été remplacés,
  // donc aucun double-binding).
  function bindSuiviActions() {
    document.querySelectorAll('[data-action="suivi-generer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviGenerer(this.getAttribute('data-event-id'), this, false);
      });
    });
    document.querySelectorAll('[data-action="suivi-regenerer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviGenerer(this.getAttribute('data-event-id'), this, true);
      });
    });
    document.querySelectorAll('[data-action="suivi-copier"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviCopier(this.getAttribute('data-event-id'));
      });
    });
    document.querySelectorAll('[data-action="suivi-partager"]').forEach(btn => {
      btn.addEventListener('click', function () {
        suiviPartager(this.getAttribute('data-event-id'));
      });
    });
    document.querySelectorAll('[data-action="suivi-aller-compo"]').forEach(btn => {
      btn.addEventListener('click', function () {
        // Raccourci honnête vers la page compositions (pas de deep-link
        // inventé — convention d'URL de compositions.html non connue).
        window.location.href = 'compositions.html';
      });
    });
    // SUIVI-COACH-1 Objet B : accès Mode Vidéo (ADDITION PURE —
    // sibling des bindings ci-dessus, pattern identique ; les
    // bindings d'Objet A ne sont pas touchés). Câblé sur full
    // render ET refreshSuiviSection (noeuds remplacés → pas de
    // double-binding, même garantie que les data-action d'A).
    document.querySelectorAll('[data-action="suivi-revoir-video"]').forEach(btn => {
      btn.addEventListener('click', function () {
        // Ouvre l'écran Mode Vidéo coach (fichier distinct, B-Q1).
        window.location.href = modeVideoBuildUrl(this.getAttribute('data-event-id'));
      });
    });

    // SUIVI-COACH-1 Objet C (v1.11) : lien spectateur + montage du
    // panneau temps de jeu (ADDITION PURE — siblings des bindings
    // ci-dessus, pattern identique ; les bindings d'Objet A/B ne
    // sont pas touchés). Câblé sur full render ET refreshSuiviSection
    // (noeuds remplacés → pas de double-binding).
    document.querySelectorAll('[data-action="suivi-spect-generer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectGenerer(this.getAttribute('data-event-id'), this, false);
      });
    });
    document.querySelectorAll('[data-action="suivi-spect-regenerer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectGenerer(this.getAttribute('data-event-id'), this, true);
      });
    });
    document.querySelectorAll('[data-action="suivi-spect-copier"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectCopier(this.getAttribute('data-event-id'));
      });
    });
    document.querySelectorAll('[data-action="suivi-spect-partager"]').forEach(btn => {
      btn.addEventListener('click', function () {
        spectPartager(this.getAttribute('data-event-id'));
      });
    });
    // Montage du panneau temps de jeu C-1 (composant js/temps-de-jeu.js,
    // panneau replié, lecture pure). Non bloquant si TempsDeJeu absent
    // (posture v1.9/v1.10 : l'accroche n'empêche jamais la fiche).
    // Garde data-tdj-done = pas de double-montage sur un même noeud
    // (refreshSuiviSection remplace tout le noeud → placeholder frais).
    document.querySelectorAll('[data-tdj-mount]').forEach(el => {
      if (el.getAttribute('data-tdj-done') === '1') return;
      if (!window.TempsDeJeu || typeof window.TempsDeJeu.monter !== 'function') return;
      el.setAttribute('data-tdj-done', '1');
      window.TempsDeJeu.monter(el, el.getAttribute('data-event-id'), {
        etat: el.getAttribute('data-etat') || null
      });
    });
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
    // SUIVI DE LA RENCONTRE (SUIVI-COACH-1 Objet A)
    //   Section dédiée — match|tournoi, etat ∉ {annule,archive}.
    //   Rendu vide ('') si non applicable (P7 : ne se manifeste que
    //   quand pertinente).
    // ────────────────────────────────────────────────
    html += renderSuiviSection(evt);

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
    //    P2-E.3 : formulaire structuré (remplace JSON brut)
    //    P2-E.5 : collapsible mobile
    // ────────────────────────────────────────────────
    const hasLogistique = evt.logistique_deplacement && typeof evt.logistique_deplacement === 'object' && Object.keys(evt.logistique_deplacement).length > 0;
    const showLogistique = hasLogistique || evt.type_evenement === 'deplacement';
    if (showLogistique) {
      html += '<div class="evt-fiche-section evt-fiche-collapsible">';
      html += '<div class="evt-fiche-section-title">🚐 Logistique déplacement <span class="evt-fiche-chevron">▶</span></div>';
      html += '<div class="evt-fiche-section-body">';
      if (hasLogistique) {
        const lg = evt.logistique_deplacement;
        const logRows = [
          ['Transport', lg.transport],
          ['Départ', lg.depart],
          ['Retour', lg.retour],
          ['Hébergement', lg.hebergement],
          ['Conducteurs', lg.conducteurs],
          ['Notes logistique', lg.notes_logistique]
        ].filter(([, v]) => v);
        if (logRows.length > 0) {
          logRows.forEach(([k, v]) => {
            html += '<div style="display:flex;gap:8px;padding:4px 0;font-size:13px;border-bottom:1px solid var(--paper-warm);">';
            html += '<div style="min-width:110px;font-family:\'JetBrains Mono\',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-mute);padding-top:3px;">' + escHtml(k) + '</div>';
            html += '<div style="flex:1;color:var(--ink);">' + escHtml(v) + '</div>';
            html += '</div>';
          });
        } else {
          html += '<div class="evt-fiche-empty">Logistique renseignée mais vide.</div>';
        }
      } else {
        html += '<div class="evt-fiche-empty">Aucune logistique renseignée.</div>';
      }
      if (evt.etat !== 'annule' && evt.etat !== 'archive') {
        html += '<div style="margin-top:8px;"><button type="button" class="evt-btn" data-action="logistique-from-fiche" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;">✏️ ' + (hasLogistique ? 'Modifier' : '+ Ajouter logistique') + '</button></div>';
      }
      html += '</div>';
      html += '</div>';
    } else if (evt.etat !== 'annule' && evt.etat !== 'archive') {
      // Pas de section logistique mais bouton discret pour en ajouter une
      html += '<div class="evt-fiche-section">';
      html += '<button type="button" class="evt-btn" data-action="logistique-from-fiche" data-event-id="' + escHtml(evt.id) + '" style="font-size:11px;color:var(--ink-mute);">+ Ajouter logistique de déplacement</button>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 6. ENCADRANTS (array JSONB depuis la RPC)
    //    P2-E.5 : collapsible mobile
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-section evt-fiche-collapsible">';
    html += '<div class="evt-fiche-section-title">👥 Encadrants <span class="evt-fiche-chevron">▶</span></div>';
    html += '<div class="evt-fiche-section-body">';
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
    html += '</div>';

    // ────────────────────────────────────────────────
    // 7. NOTES INTERNES
    //    P2-E.5 : collapsible mobile
    // ────────────────────────────────────────────────
    if (evt.notes_internes) {
      html += '<div class="evt-fiche-section evt-fiche-collapsible">';
      html += '<div class="evt-fiche-section-title">📝 Notes internes <span class="evt-fiche-chevron">▶</span></div>';
      html += '<div class="evt-fiche-section-body">';
      html += '<div class="evt-fiche-text">' + escHtml(evt.notes_internes) + '</div>';
      html += '</div>';
      html += '</div>';
    }

    // ────────────────────────────────────────────────
    // 8. ACTIONS EN PIED (P2-E.2 : boutons câblés)
    // ────────────────────────────────────────────────
    html += '<div class="evt-fiche-actions">';
    if (evt.etat !== 'annule' && evt.etat !== 'archive') {
      html += '<button type="button" class="evt-btn" data-action="edit-from-fiche" data-event-id="' + escHtml(evt.id) + '">✏️ Modifier</button>';
      html += '<button type="button" class="evt-btn" data-action="notes-from-fiche" data-event-id="' + escHtml(evt.id) + '">📝 Notes</button>';
    }
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
    // P2-E.2 : boutons édition identité + notes
    document.querySelectorAll('[data-action="edit-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalEdit(id);
      });
    });
    document.querySelectorAll('[data-action="notes-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalEditNotes(id);
      });
    });
    // P2-E.5 : toggle collapsible mobile (logistique, encadrants, notes)
    document.querySelectorAll('.evt-fiche-collapsible .evt-fiche-section-title').forEach(title => {
      title.addEventListener('click', function () {
        this.closest('.evt-fiche-collapsible').classList.toggle('is-open');
      });
    });
    // P2-E.3 : bouton édition logistique
    document.querySelectorAll('[data-action="logistique-from-fiche"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-event-id');
        if (id) openModalLogistique(id);
      });
    });
    // SUIVI-COACH-1 Objet A : actions de la section Suivi
    bindSuiviActions();
  }

  // ────────────────────────────────────────────────
  // E6 — Modale Édition événement (P2-E.2)
  // ────────────────────────────────────────────────

  let MODAL_EDIT_EVENT_ID = null;

  function populateEditSitesDropdown() {
    const sel = document.getElementById('evt-edit-site');
    if (!sel) return;
    let html = '<option value="">— Choisir un site —</option>';
    SITES.forEach(s => {
      const lib = s.libelle_court || s.libelle || '(sans nom)';
      html += '<option value="' + escHtml(s.id) + '">' + escHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
  }

  function openModalEdit(evenementId) {
    if (!evenementId) return;
    MODAL_EDIT_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];
    if (!evt) return;

    const msg = document.getElementById('evt-edit-msg');
    if (msg) msg.innerHTML = '';
    const info = document.getElementById('evt-edit-info');
    if (info) {
      const typeLbl = TYPE_LABELS[evt.type_evenement] || evt.type_evenement;
      info.innerHTML = '<span class="evt-modal-info-strong">' + escHtml(typeLbl) + '</span> · '
        + escHtml(evt.libelle || '(sans libellé)');
    }

    // Peuple le dropdown sites
    populateEditSitesDropdown();

    // Pré-remplissage des champs
    const f = document.getElementById('evt-edit-form');
    if (!f) return;

    f.elements.libelle.value = evt.libelle || '';

    // Date début : convertir ISO → datetime-local (YYYY-MM-DDTHH:MM)
    if (evt.date_debut) {
      try {
        const d = new Date(evt.date_debut);
        const pad = (n) => String(n).padStart(2, '0');
        f.elements.date_debut.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      } catch (_) {}
    }
    if (evt.date_fin) {
      try {
        const d = new Date(evt.date_fin);
        const pad = (n) => String(n).padStart(2, '0');
        f.elements.date_fin.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      } catch (_) {}
    }

    if (f.elements.domicile_exterieur) f.elements.domicile_exterieur.value = evt.domicile_exterieur || '';
    if (f.elements.site_id) f.elements.site_id.value = evt.site_id || '';
    if (f.elements.type_competition) f.elements.type_competition.value = evt.type_competition || '';
    if (f.elements.format_de_jeu) f.elements.format_de_jeu.value = evt.format_de_jeu || '';
    if (f.elements.adversaire_nom) f.elements.adversaire_nom.value = evt.adversaire_nom || '';

    // Affichage conditionnel compet/format selon type
    const showCompet = ['match', 'tournoi', 'journee_championnat'].indexOf(evt.type_evenement) !== -1;
    const showFormat = showCompet;
    const showDateFin = ['tournoi', 'stage'].indexOf(evt.type_evenement) !== -1;
    const competGroup = document.getElementById('evt-edit-compet-group');
    const formatGroup = document.getElementById('evt-edit-format-group');
    const dateFinGroup = document.getElementById('evt-edit-date-fin-group');
    if (competGroup) competGroup.style.display = showCompet ? '' : 'none';
    if (formatGroup) formatGroup.style.display = showFormat ? '' : 'none';
    if (dateFinGroup) dateFinGroup.style.display = showDateFin ? '' : 'none';

    // Reset submit button
    const btn = document.getElementById('evt-edit-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

    document.getElementById('evt-overlay-edit').classList.add('show');
  }

  function closeModalEdit() {
    MODAL_EDIT_EVENT_ID = null;
    document.getElementById('evt-overlay-edit').classList.remove('show');
  }

  async function submitModalEdit() {
    if (!MODAL_EDIT_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-edit-submit');
    const msg = document.getElementById('evt-edit-msg');
    if (!submitBtn || !msg) return;

    const f = document.getElementById('evt-edit-form');
    if (!f) return;

    const libelle = f.elements.libelle.value.trim();
    const dateDebut = f.elements.date_debut.value;

    if (!libelle) { msg.innerHTML = '<div class="evt-form-error">Le libellé est requis</div>'; return; }
    if (!dateDebut) { msg.innerHTML = '<div class="evt-form-error">La date de début est requise</div>'; return; }

    const patch = {
      libelle: libelle,
      date_debut: new Date(dateDebut).toISOString()
    };
    const dateFin = f.elements.date_fin.value;
    if (dateFin) patch.date_fin = new Date(dateFin).toISOString();
    else patch.date_fin = null;

    const siteId = f.elements.site_id.value;
    patch.site_id = siteId || null;
    const typeCompet = f.elements.type_competition.value;
    patch.type_competition = typeCompet || null;
    const formatJeu = f.elements.format_de_jeu.value;
    patch.format_de_jeu = formatJeu || null;
    const adversaire = f.elements.adversaire_nom.value.trim();
    patch.adversaire_nom = adversaire || null;
    const domicile = f.elements.domicile_exterieur.value;
    patch.domicile_exterieur = domicile || null;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.updateEvenement(MODAL_EDIT_EVENT_ID, patch);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const mb = document.querySelector('#evt-overlay-edit .evt-modal-body');
        if (mb) mb.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement mis à jour.</div>';
      const mb = document.querySelector('#evt-overlay-edit .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      const evtId = MODAL_EDIT_EVENT_ID;
      setTimeout(async () => {
        closeModalEdit();
        closeFiche();
        await reloadEvents();
        openFiche(evtId);
      }, 500);
    } catch (err) {
      console.error('submitModalEdit', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur : ' + escHtml(err.message || String(err)) + '</div>';
      const mb = document.querySelector('#evt-overlay-edit .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  }

  // ────────────────────────────────────────────────
  // E7 — Modale Édition notes internes (P2-E.2)
  // ────────────────────────────────────────────────

  let MODAL_NOTES_EVENT_ID = null;

  function openModalEditNotes(evenementId) {
    if (!evenementId) return;
    MODAL_NOTES_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];

    const msg = document.getElementById('evt-notes-msg');
    if (msg) msg.innerHTML = '';
    const info = document.getElementById('evt-notes-info');
    if (info && evt) {
      info.innerHTML = '<span class="evt-modal-info-strong">' + escHtml(evt.libelle || '(sans libellé)') + '</span>';
    }
    const textarea = document.getElementById('evt-notes-texte');
    if (textarea) textarea.value = (evt && evt.notes_internes) || '';

    const btn = document.getElementById('evt-notes-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

    document.getElementById('evt-overlay-notes').classList.add('show');
  }

  function closeModalEditNotes() {
    MODAL_NOTES_EVENT_ID = null;
    document.getElementById('evt-overlay-notes').classList.remove('show');
  }

  async function submitModalEditNotes() {
    if (!MODAL_NOTES_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-notes-submit');
    const msg = document.getElementById('evt-notes-msg');
    if (!submitBtn || !msg) return;

    const textarea = document.getElementById('evt-notes-texte');
    const notes = textarea ? textarea.value.trim() : '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.updateEvenement(MODAL_NOTES_EVENT_ID, {
        notes_internes: notes || null
      });
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const mb = document.querySelector('#evt-overlay-notes .evt-modal-body');
        if (mb) mb.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Notes mises à jour.</div>';
      const mb = document.querySelector('#evt-overlay-notes .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      const evtId = MODAL_NOTES_EVENT_ID;
      setTimeout(async () => {
        closeModalEditNotes();
        closeFiche();
        await reloadEvents();
        openFiche(evtId);
      }, 500);
    } catch (err) {
      console.error('submitModalEditNotes', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur : ' + escHtml(err.message || String(err)) + '</div>';
      const mb = document.querySelector('#evt-overlay-notes .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  }

  // ────────────────────────────────────────────────
  // E8 — Modale Édition logistique (P2-E.3)
  // ────────────────────────────────────────────────

  let MODAL_LOGISTIQUE_EVENT_ID = null;

  function openModalLogistique(evenementId) {
    if (!evenementId) return;
    MODAL_LOGISTIQUE_EVENT_ID = evenementId;
    const evt = EVENTS_BY_ID[evenementId];

    const msg = document.getElementById('evt-logistique-msg');
    if (msg) msg.innerHTML = '';
    const info = document.getElementById('evt-logistique-info');
    if (info && evt) {
      info.innerHTML = '<span class="evt-modal-info-strong">' + escHtml(evt.libelle || '(sans libellé)') + '</span>';
    }

    const f = document.getElementById('evt-logistique-form');
    if (f) {
      f.reset();
      const lg = (evt && evt.logistique_deplacement && typeof evt.logistique_deplacement === 'object')
        ? evt.logistique_deplacement : {};
      f.elements.transport.value = lg.transport || '';
      f.elements.depart.value = lg.depart || '';
      f.elements.retour.value = lg.retour || '';
      f.elements.hebergement.value = lg.hebergement || '';
      f.elements.conducteurs.value = lg.conducteurs || '';
      f.elements.notes_logistique.value = lg.notes_logistique || '';
    }

    const btn = document.getElementById('evt-logistique-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

    document.getElementById('evt-overlay-logistique').classList.add('show');
  }

  function closeModalLogistique() {
    MODAL_LOGISTIQUE_EVENT_ID = null;
    document.getElementById('evt-overlay-logistique').classList.remove('show');
  }

  async function submitModalLogistique() {
    if (!MODAL_LOGISTIQUE_EVENT_ID) return;
    const submitBtn = document.getElementById('evt-logistique-submit');
    const msg = document.getElementById('evt-logistique-msg');
    if (!submitBtn || !msg) return;

    const f = document.getElementById('evt-logistique-form');
    if (!f) return;

    // Construire le JSONB (champs non vides uniquement)
    const payload = {};
    ['transport', 'depart', 'retour', 'hebergement', 'conducteurs', 'notes_logistique'].forEach(key => {
      const val = (f.elements[key].value || '').trim();
      if (val) payload[key] = val;
    });

    // Si tout vide → envoyer null (supprimer la logistique)
    const jsonbPayload = Object.keys(payload).length > 0 ? payload : null;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    msg.innerHTML = '';
    try {
      const res = await SupabaseHub.updateLogistique(MODAL_LOGISTIQUE_EVENT_ID, jsonbPayload);
      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const mb = document.querySelector('#evt-overlay-logistique .evt-modal-body');
        if (mb) mb.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Logistique mise à jour.</div>';
      const mb = document.querySelector('#evt-overlay-logistique .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      const evtId = MODAL_LOGISTIQUE_EVENT_ID;
      setTimeout(async () => {
        closeModalLogistique();
        closeFiche();
        await reloadEvents();
        openFiche(evtId);
      }, 500);
    } catch (err) {
      console.error('submitModalLogistique', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur : ' + escHtml(err.message || String(err)) + '</div>';
      const mb = document.querySelector('#evt-overlay-logistique .evt-modal-body');
      if (mb) mb.scrollTop = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
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

  // P2-E.1 : état duplication
  let MODAL_CREATE_DUP_SRC_ID = null;

  /**
   * Peuple le dropdown source duplication dans E3 (événements parents uniquement,
   * triés par date décroissante pour trouver vite le dernier événement similaire).
   */
  function populateDupSourceDropdown() {
    const sel = document.getElementById('evt-create-dup-source');
    if (!sel) return;
    const allRoots = EVENEMENTS_AVENIR.concat(EVENEMENTS_PASSES)
      .filter(e => !e.evenement_parent_id)
      .sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || ''));
    let html = '<option value="">— Sélectionner l\'événement à dupliquer —</option>';
    allRoots.forEach(e => {
      const dateLib = formatDateShort(e.date_debut);
      const typeLbl = TYPE_LABELS[e.type_evenement] || e.type_evenement;
      const lib = dateLib + ' · ' + typeLbl + ' · ' + (e.libelle || '(sans libellé)');
      html += '<option value="' + escHtml(e.id) + '">' + escHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
  }

  /**
   * Pré-remplit le formulaire E3 depuis un événement source (pour duplication).
   * Ne touche PAS au code (auto-généré au submit) ni à la date (l'utilisateur
   * choisira la nouvelle date).
   */
  function prefillFormFromSource(srcId) {
    const evt = EVENTS_BY_ID[srcId];
    if (!evt) return;
    const f = document.getElementById('evt-create-form');
    if (!f) return;

    // Type
    const radioType = f.querySelector('input[name=type_evenement][value="' + evt.type_evenement + '"]');
    if (radioType) radioType.checked = true;
    updateCreateConditionalFields();

    // Libellé (sans le suffixe " (copie)" — le wrapper l'ajoutera si nécessaire)
    f.elements.libelle.value = evt.libelle || '';

    // Site
    if (f.elements.site_id && evt.site_id) {
      f.elements.site_id.value = evt.site_id;
    }
    // Compétition
    if (f.elements.type_competition && evt.type_competition) {
      f.elements.type_competition.value = evt.type_competition;
    }
    // Format de jeu
    if (f.elements.format_de_jeu && evt.format_de_jeu) {
      f.elements.format_de_jeu.value = evt.format_de_jeu;
    }
    // Adversaire
    if (f.elements.adversaire_nom) {
      f.elements.adversaire_nom.value = evt.adversaire_nom || '';
    }
    // Domicile/Extérieur
    if (f.elements.domicile_exterieur && evt.domicile_exterieur) {
      f.elements.domicile_exterieur.value = evt.domicile_exterieur;
    }
    // Date début : on laisse vide (la nouvelle date est à choisir)
    // Date fin : idem
  }

  function openModalCreate() {
    // Réinitialise le form
    const form = document.getElementById('evt-create-form');
    if (form) form.reset();
    // Coche par défaut "entrainement"
    const radioEntr = form && form.querySelector('input[name=type_evenement][value=entrainement]');
    if (radioEntr) radioEntr.checked = true;

    // P2-E.1 : reset mode duplication → vierge
    MODAL_CREATE_DUP_SRC_ID = null;
    const radioVierge = form && form.querySelector('input[name=create_mode][value=vierge]');
    if (radioVierge) radioVierge.checked = true;
    const dupGroup = document.getElementById('evt-create-dup-group');
    if (dupGroup) dupGroup.style.display = 'none';

    // Peuple le dropdown source pour la duplication
    populateDupSourceDropdown();

    updateCreateConditionalFields();
    const msg = document.getElementById('evt-create-msg');
    if (msg) msg.innerHTML = '';

    // Fix P2-E.1 : reset état du bouton submit (hors <form>, pas touché par form.reset())
    const submitBtn = document.getElementById('evt-create-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Créer l'évènement";
    }

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

    // Appel wrapper : branche selon mode (P2-E.1 duplication vs création vierge)
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création…';
    msg.innerHTML = '';

    // P2-E.1 : mode duplication ?
    const modeChecked = f.querySelector('input[name=create_mode]:checked');
    const isDuplication = modeChecked && modeChecked.value === 'dupliquer' && MODAL_CREATE_DUP_SRC_ID;

    try {
      let res;
      if (isDuplication) {
        // Mode duplication : appel duplicateEvenement(srcId, overrides)
        // Les overrides sont les champs modifiés par l'utilisateur
        const overrides = {
          code: generateEventCode(type, dateDebut),
          libelle: libelle,
          type_evenement: type,
          date_debut: new Date(dateDebut).toISOString(),
          equipe_id: M14_TEAM_UUID,
          saison_id: CTX_SAISON_ID,
          organisateur_principal_id: CTX_ORGANISATEUR_ID
        };
        if (dateFin)    overrides.date_fin = new Date(dateFin).toISOString();
        if (siteId)     overrides.site_id = siteId;
        if (typeCompet) overrides.type_competition = typeCompet;
        if (formatJeu)  overrides.format_de_jeu = formatJeu;
        if (adversaire) overrides.adversaire_nom = adversaire;
        if (domicile)   overrides.domicile_exterieur = domicile;
        res = await SupabaseHub.duplicateEvenement(MODAL_CREATE_DUP_SRC_ID, overrides);
      } else {
        // Mode création vierge : appel createEvenement(payload) existant
        res = await SupabaseHub.createEvenement(payload);
      }

      if (!res || !res.ok) {
        msg.innerHTML = '<div class="evt-form-error">Échec : ' + escHtml((res && res.error) || 'erreur inconnue') + '</div>';
        const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = "Créer l'évènement";
        return;
      }
      // Succès
      const createdId = res.data && res.data.id ? res.data.id : null;
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement ' + (isDuplication ? 'dupliqué' : 'créé') + '.</div>';
      const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      setTimeout(async () => {
        closeModalCreate();
        await reloadEvents();
        // P2-E.1 G9 : si tournoi créé, ouvrir la fiche pour ajouter les matchs
        if (type === 'tournoi' && createdId) {
          openFiche(createdId);
        }
      }, 500);
    } catch (err) {
      console.error('submitModalCreate', err);
      msg.innerHTML = '<div class="evt-form-error">Erreur inattendue : ' + escHtml(err.message || String(err)) + '</div>';
      const modalBody = document.querySelector('#evt-overlay-create .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
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
        const modalBody = document.querySelector('#evt-overlay-cancel .evt-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = "Annuler l'évènement";
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Évènement annulé.</div>';
      const modalBody = document.querySelector('#evt-overlay-cancel .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
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
      const modalBody = document.querySelector('#evt-overlay-cancel .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
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
        const modalBody = document.querySelector('#evt-overlay-addmatch .evt-modal-body');
        if (modalBody) modalBody.scrollTop = 0;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ajouter le match';
        return;
      }
      msg.innerHTML = '<div class="evt-form-success">✅ Match ajouté.</div>';
      const modalBody = document.querySelector('#evt-overlay-addmatch .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
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
      const modalBody = document.querySelector('#evt-overlay-addmatch .evt-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
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
    document.querySelectorAll('[data-action="close-edit"]').forEach(b => b.addEventListener('click', closeModalEdit));
    document.querySelectorAll('[data-action="close-notes"]').forEach(b => b.addEventListener('click', closeModalEditNotes));
    document.querySelectorAll('[data-action="close-logistique"]').forEach(b => b.addEventListener('click', closeModalLogistique));

    // S2.4.b — Submit des 3 modales + P2-E.2 modales E6/E7
    const btnCreateSubmit = document.getElementById('evt-create-submit');
    if (btnCreateSubmit) btnCreateSubmit.addEventListener('click', submitModalCreate);
    const btnCancelSubmit = document.getElementById('evt-cancel-submit');
    if (btnCancelSubmit) btnCancelSubmit.addEventListener('click', submitModalCancel);
    const btnAddMatchSubmit = document.getElementById('evt-addmatch-submit');
    if (btnAddMatchSubmit) btnAddMatchSubmit.addEventListener('click', submitModalAddMatch);
    const btnEditSubmit = document.getElementById('evt-edit-submit');
    if (btnEditSubmit) btnEditSubmit.addEventListener('click', submitModalEdit);
    const btnNotesSubmit = document.getElementById('evt-notes-submit');
    if (btnNotesSubmit) btnNotesSubmit.addEventListener('click', submitModalEditNotes);
    const btnLogistiqueSubmit = document.getElementById('evt-logistique-submit');
    if (btnLogistiqueSubmit) btnLogistiqueSubmit.addEventListener('click', submitModalLogistique);

    // S2.4.b — Changement de type dans E3 → afficher/masquer champs conditionnels
    document.querySelectorAll('#evt-create-form input[name=type_evenement]').forEach(radio => {
      radio.addEventListener('change', updateCreateConditionalFields);
    });

    // P2-E.1 — Changement de mode dans E3 (vierge / dupliquer)
    document.querySelectorAll('#evt-create-form input[name=create_mode]').forEach(radio => {
      radio.addEventListener('change', function () {
        const dupGroup = document.getElementById('evt-create-dup-group');
        if (this.value === 'dupliquer') {
          if (dupGroup) dupGroup.style.display = '';
        } else {
          if (dupGroup) dupGroup.style.display = 'none';
          MODAL_CREATE_DUP_SRC_ID = null;
        }
      });
    });
    // P2-E.1 — Sélection de la source duplication → pré-remplissage
    const dupSourceSel = document.getElementById('evt-create-dup-source');
    if (dupSourceSel) {
      dupSourceSel.addEventListener('change', function () {
        MODAL_CREATE_DUP_SRC_ID = this.value || null;
        if (MODAL_CREATE_DUP_SRC_ID) {
          prefillFormFromSource(MODAL_CREATE_DUP_SRC_ID);
        }
      });
    }

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
    console.log('🏉 MOM Hub · Évènements Browser — init S2.5 (v1.4.1)');

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

  console.log('%c🏉 MOM Hub · Évènements Browser v1.4.1 (S2.5) chargé',
    'color: #2D7D46; font-weight: bold;');

})();
