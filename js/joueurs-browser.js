/**
 * MOM Hub · Module Joueurs · Browser
 * ====================================
 *
 * Module IIFE — initialise l'UI de la page joueurs.html.
 *
 * Version : v1.0 — 15 mai 2026
 *   v0 :  Squelette S2.1 (init vide + chips filtres + binders modales)
 *   v1.0 : Phase 5.14 S2.2 + S2.3 lecture
 *          - Chargement backend via SupabaseHub.getJoueursEquipe(M14_TEAM_UUID)
 *          - Chargement référentiels postes.json v1.1 + aptitudes.json v1.0
 *          - Indexes (JOUEURS_BY_ID + POSTES_BY_ID + APTITUDES_BY_ID)
 *          - renderCard() avec stripe colorée par profil, avatar initiales,
 *            badges club/cat/F-15, postes pills, aptitudes pills colorées,
 *            physique (taille/poids), badge état si non actif
 *          - renderKpis réel (Actifs / Indispo / Blessés)
 *          - renderSidebarAlerts réel (Sans email / FFR à renouveler / Indispo)
 *          - applyFilters réel (search + profil + etat + poste avec dégroupage)
 *          - Clic carte → openFiche avec getJoueurDetail
 *          - renderFiche : sections empilées (identité, profil sportif, état,
 *            FFR/conformité, coordonnées, métadonnées) en lecture seule
 *          - Édition métier S2.4 (boutons disabled avec tooltip "Câblage S2.4")
 *
 * Pattern calqué sur :
 *   - js/evenements-browser.js v1.4.1 (cartes + fiche)
 *   - SAR×MOM Compos screenshots (inspiration ergonomique)
 *
 * Doctrine MOM Hub :
 *   - P1 Simplicité : vanilla JS, pas de framework
 *   - Anti-invention : aucun UUID hardcodé sauf M14_TEAM_UUID
 *   - P6 Confidentialité : RPC SECURITY DEFINER (jamais SELECT direct sur personnes)
 *   - Préfixage CSS strict .joueur-*
 */

window.JoueursBrowser = (function () {
  'use strict';

  // ============================================================
  // CONSTANTES
  // ============================================================

  /** UUID équipe M14 EQ1 (entente SAR×MOM) — seule constante autorisée */
  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  /** Clé localStorage pour persister les préférences de filtres */
  const PREFS_KEY = 'mom-hub.joueurs.prefs.v1';

  /** Seuil "FFR à renouveler" : moins de 90j avant date_fin_affiliation */
  const FFR_RENOUVELLEMENT_JOURS = 90;

  /** Catégorie B audit pour M14 (cf. aptitudes.json) */
  const APTITUDES_B_CAT_KEY = 'M-14_F-15_M-16_M-19_F-18_M+18_F+18';

  /** Couleurs profil (cohérentes avec joueurs.html .joueur-chip.profil-*) */
  const PROFIL_COLOR_DEFAULT = '#2D7D46';     // vert prairie
  const PROFIL_COLOR_PARTENAIRE_SAR = '#2e63a8';  // bleu marine
  const PROFIL_COLOR_PARTENAIRE_ASCS = '#8a5a3a'; // terre
  const PROFIL_COLOR_COACH = '#cf6a1a';        // ocre/doré
  const PROFIL_COLOR_STAFF = '#8b3a3a';        // rouge bordeaux
  const PROFIL_COLOR_AUTRE = '#5f6b75';        // gris ardoise

  /** Labels profil pour l'UI */
  const PROFIL_LABELS = {
    mom: 'MOM régulier',
    f15: 'F-15 intégrée',
    partenaire: 'Partenaire',
    coach: 'Coach',
    staff: 'Staff médical',
    autre: 'Autre'
  };

  /** Labels état métier */
  const ETAT_LABELS = {
    actif: 'Actif',
    indisponible: 'Indisponible',
    blesse: 'Blessé',
    suspendu: 'Suspendu',
    inactif: 'Inactif'
  };

  // ============================================================
  // STATE INTERNE
  // ============================================================

  /** Tous les joueurs chargés depuis la RPC */
  let ALL_JOUEURS = [];

  /** Index par personne_id pour accès rapide depuis cartes / fiche */
  let JOUEURS_BY_ID = new Map();

  /** Référentiels chargés depuis data/*.json */
  let POSTES_BY_ID = new Map();
  let POSTES_GROUPES_BY_ID = new Map();
  let APTITUDES_BY_ID = new Map();

  /** Filtres actifs */
  let state = {
    search: '',
    profil: 'all',
    etat: 'all',
    poste: 'all'
  };

  // ============================================================
  // CHARGEMENT RÉFÉRENTIELS (postes + aptitudes)
  // ============================================================

  async function loadReferentiels() {
    try {
      const [postesRes, aptitudesRes] = await Promise.all([
        fetch('data/postes.json'),
        fetch('data/aptitudes.json')
      ]);
      const postesJson = await postesRes.json();
      const aptitudesJson = await aptitudesRes.json();

      // Postes précis (15 entrées XV)
      (postesJson.postes_precis || []).forEach(p => {
        POSTES_BY_ID.set(p.uuid, p);
      });
      // Postes regroupés (Piliers, 2es lignes, 3es lignes, Centres, Ailiers)
      (postesJson.postes_regroupes || []).forEach(g => {
        POSTES_GROUPES_BY_ID.set(g.uuid, g);
      });

      // Aptitudes catégorie A (universelles, 6 entrées)
      (aptitudesJson.categorie_A || []).forEach(a => {
        APTITUDES_BY_ID.set(a.uuid, a);
      });
      // Aptitudes catégorie B M14 (7 entrées)
      const aptB = (aptitudesJson.categorie_B_par_age || {})[APTITUDES_B_CAT_KEY] || [];
      aptB.forEach(a => {
        APTITUDES_BY_ID.set(a.uuid, a);
      });

      console.log('Joueurs: référentiels chargés —',
        POSTES_BY_ID.size, 'postes,',
        POSTES_GROUPES_BY_ID.size, 'groupes,',
        APTITUDES_BY_ID.size, 'aptitudes');
    } catch (err) {
      console.error('Joueurs: échec chargement référentiels JSON', err);
      // Pas critique : on peut afficher les cartes sans les libellés des postes/apt
    }
  }

  // ============================================================
  // INDEXES (à appeler après chargement ALL_JOUEURS)
  // ============================================================

  function buildIndexes() {
    JOUEURS_BY_ID.clear();
    ALL_JOUEURS.forEach(j => JOUEURS_BY_ID.set(j.id, j));
  }

  // ============================================================
  // HELPERS PROFIL / ÉTAT
  // ============================================================

  /** Retourne la couleur de stripe selon profil + club provenance */
  function getProfilColor(j) {
    if (j.profil === 'partenaire') {
      const code = (j.ej_club_provenance_code || '').toUpperCase();
      if (code === 'ASCS') return PROFIL_COLOR_PARTENAIRE_ASCS;
      return PROFIL_COLOR_PARTENAIRE_SAR;  // default partenaire
    }
    if (j.profil === 'coach') return PROFIL_COLOR_COACH;
    if (j.profil === 'staff') return PROFIL_COLOR_STAFF;
    if (j.profil === 'mom' || j.profil === 'f15') return PROFIL_COLOR_DEFAULT;
    return PROFIL_COLOR_AUTRE;
  }

  /** Initiales pour avatar */
  function getInitiales(j) {
    const p = (j.prenom || '').trim();
    const n = (j.nom || '').trim();
    return ((p[0] || '?') + (n[0] || '?')).toUpperCase();
  }

  /** Échappe HTML pour insertion sûre */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Formate taille_cm en m */
  function formatTaille(cm) {
    if (cm === null || cm === undefined) return null;
    return (cm / 100).toFixed(2).replace('.', ',') + ' m';
  }

  /** Formate poids_g en kg */
  function formatPoids(g) {
    if (g === null || g === undefined) return null;
    return (g / 1000).toFixed(1).replace('.', ',') + ' kg';
  }

  /** Formate date ISO en JJ/MM/AAAA */
  function formatDate(iso) {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    } catch (_) {
      return iso;
    }
  }

  /** Âge calculé depuis date_naissance */
  function calcAge(iso) {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const mDiff = now.getMonth() - d.getMonth();
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < d.getDate())) age--;
      return age;
    } catch (_) {
      return null;
    }
  }

  // ============================================================
  // PRÉFÉRENCES (localStorage)
  // ============================================================

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (prefs && typeof prefs === 'object') {
        if (prefs.profil) state.profil = prefs.profil;
        if (prefs.etat) state.etat = prefs.etat;
        if (prefs.poste) state.poste = prefs.poste;
      }
    } catch (err) {
      console.warn('Joueurs: prefs localStorage corrompues, ignorées', err);
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        profil: state.profil,
        etat: state.etat,
        poste: state.poste
      }));
    } catch (_) {
      // SilentFail
    }
  }

  // ============================================================
  // FILTRES (chips) — bindings + reflet d'état
  // ============================================================

  function reflectChipsFromState() {
    document.querySelectorAll('.joueur-chip[data-profil]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.profil === state.profil);
    });
    document.querySelectorAll('.joueur-chip[data-etat]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.etat === state.etat);
    });
    document.querySelectorAll('.joueur-chip[data-poste]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.poste === state.poste);
    });
  }

  function bindFilters() {
    document.querySelectorAll('.joueur-chip[data-profil]').forEach(chip => {
      chip.addEventListener('click', function () {
        state.profil = this.dataset.profil;
        reflectChipsFromState();
        savePrefs();
        render();
      });
    });
    document.querySelectorAll('.joueur-chip[data-etat]').forEach(chip => {
      chip.addEventListener('click', function () {
        state.etat = this.dataset.etat;
        reflectChipsFromState();
        savePrefs();
        render();
      });
    });
    document.querySelectorAll('.joueur-chip[data-poste]').forEach(chip => {
      chip.addEventListener('click', function () {
        state.poste = this.dataset.poste;
        reflectChipsFromState();
        savePrefs();
        render();
      });
    });
  }

  function bindSearch() {
    const input = document.getElementById('joueur-search');
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      const val = this.value;
      debounceTimer = setTimeout(() => {
        state.search = val.trim().toLowerCase();
        render();
      }, 180);
    });
  }

  // ============================================================
  // FERMETURE MODALES & FICHE
  // ============================================================

  function closeAllOverlays() {
    document.querySelectorAll('.joueur-overlay.show').forEach(o => o.classList.remove('show'));
    const ficheOverlay = document.getElementById('joueur-fiche-overlay');
    if (ficheOverlay) ficheOverlay.classList.remove('show');
  }

  function bindModalClosers() {
    document.querySelectorAll('[data-action^="close-"]').forEach(btn => {
      btn.addEventListener('click', closeAllOverlays);
    });
    document.querySelectorAll('.joueur-overlay').forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });
    const ficheOverlay = document.getElementById('joueur-fiche-overlay');
    if (ficheOverlay) {
      ficheOverlay.addEventListener('click', function (e) {
        if (e.target === ficheOverlay) ficheOverlay.classList.remove('show');
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllOverlays();
    });
  }

  // ============================================================
  // FILTRAGE
  // ============================================================

  function applyFilters(joueurs) {
    return joueurs.filter(j => {
      // Recherche par nom/prénom
      if (state.search) {
        const blob = ((j.nom || '') + ' ' + (j.prenom || '')).toLowerCase();
        if (!blob.includes(state.search)) return false;
      }
      // Profil
      if (state.profil !== 'all' && j.profil !== state.profil) return false;
      // État
      if (state.etat !== 'all' && j.etat_calcule !== state.etat) return false;
      // Poste : si filtre = uuid groupe, déplier les postes_inclus
      if (state.poste !== 'all') {
        const posteUuids = j.postes_uuids || [];
        const groupe = POSTES_GROUPES_BY_ID.get(state.poste);
        if (groupe) {
          // Le filtre est un groupe (ex pst-grp-001 Piliers)
          const inclus = groupe.postes_inclus || [];
          if (!posteUuids.some(u => inclus.includes(u))) return false;
        } else {
          // Le filtre est un poste précis
          if (!posteUuids.includes(state.poste)) return false;
        }
      }
      return true;
    });
  }

  // ============================================================
  // RENDU CARTES
  // ============================================================

  function renderPostesPills(postesUuids) {
    if (!postesUuids || postesUuids.length === 0) {
      return '<div class="joueur-card-empty-line">Postes non définis</div>';
    }
    const pills = postesUuids.map(u => {
      const p = POSTES_BY_ID.get(u);
      const libelle = p ? p.libelle_court : '?';
      return `<span class="joueur-pill joueur-pill-poste">${esc(libelle)}</span>`;
    }).join('');
    return `<div class="joueur-card-postes">${pills}</div>`;
  }

  function renderAptitudesPills(aptitudesUuids) {
    if (!aptitudesUuids || aptitudesUuids.length === 0) return '';
    const pills = aptitudesUuids.map(u => {
      const a = APTITUDES_BY_ID.get(u);
      if (!a) return '';
      const couleur = a.couleur || '#888';
      const libelle = a.libelle_court || '?';
      return `<span class="joueur-pill joueur-pill-apt" style="background:${esc(couleur)}">${esc(libelle)}</span>`;
    }).join('');
    return `<div class="joueur-card-aptitudes">${pills}</div>`;
  }

  function renderEtatBadge(etat) {
    if (etat === 'actif') return '';
    const cls = 'joueur-badge-etat joueur-badge-etat-' + etat;
    return `<span class="${cls}">${esc(ETAT_LABELS[etat] || etat)}</span>`;
  }

  function renderPhysiqueLine(j) {
    const parts = [];
    const t = formatTaille(j.taille_cm);
    const p = formatPoids(j.poids_g);
    if (t) parts.push(`📏 ${t}`);
    if (p) parts.push(`⚖️ ${p}`);
    if (j.qualite_ffr) parts.push(`🛡️ ${esc(j.qualite_ffr)}`);
    if (parts.length === 0) return '';
    return `<div class="joueur-card-physique">${parts.join(' · ')}</div>`;
  }

  function renderCard(j) {
    const color = getProfilColor(j);
    const init = getInitiales(j);
    const cardClass = 'joueur-card joueur-card-' + (j.profil || 'autre');
    const stateMod = j.etat_calcule !== 'actif' ? ' is-' + j.etat_calcule : '';

    return `
      <div class="${cardClass}${stateMod}" data-id="${esc(j.id)}">
        <div class="joueur-card-stripe" style="background:${color}"></div>
        <div class="joueur-card-body">
          <div class="joueur-card-head">
            <div class="joueur-card-avatar" style="background:${color}">${esc(init)}</div>
            <div class="joueur-card-identite">
              <div class="joueur-card-name">
                ${esc(j.prenom)} <strong>${esc(j.nom)}</strong>
              </div>
              <div class="joueur-card-badges">
                ${j.club_principal_code ? `<span class="joueur-badge joueur-badge-club">${esc(j.club_principal_code)}</span>` : ''}
                ${j.categorie_libelle_court ? `<span class="joueur-badge joueur-badge-cat">${esc(j.categorie_libelle_court)}</span>` : ''}
                ${j.profil === 'f15' ? `<span class="joueur-badge joueur-badge-f15">F-15</span>` : ''}
                ${j.profil === 'coach' ? `<span class="joueur-badge joueur-badge-coach">Coach</span>` : ''}
                ${j.profil === 'staff' ? `<span class="joueur-badge joueur-badge-staff">Staff</span>` : ''}
              </div>
            </div>
            ${renderEtatBadge(j.etat_calcule)}
          </div>
          ${renderPostesPills(j.postes_uuids)}
          ${renderAptitudesPills(j.aptitudes_uuids)}
          ${renderPhysiqueLine(j)}
        </div>
      </div>
    `;
  }

  // ============================================================
  // RENDU LISTE + BINDING CLICS CARTES
  // ============================================================

  function render() {
    const listEl = document.getElementById('joueur-list');
    if (!listEl) return;

    if (ALL_JOUEURS.length === 0) {
      listEl.innerHTML = '<div class="joueur-list-loading">Aucune donnée chargée — backend muet ?</div>';
      return;
    }

    const filtered = applyFilters(ALL_JOUEURS);
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="joueur-list-empty">Aucun joueur ne correspond aux filtres actifs.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(renderCard).join('');
    bindCardClicks();
  }

  function bindCardClicks() {
    document.querySelectorAll('.joueur-card[data-id]').forEach(card => {
      card.addEventListener('click', function () {
        const id = this.dataset.id;
        if (id) openFiche(id);
      });
    });
  }

  // ============================================================
  // KPIs + SIDEBAR ALERTES
  // ============================================================

  function renderKpis() {
    const actifs  = ALL_JOUEURS.filter(j => j.etat_calcule === 'actif').length;
    const indispo = ALL_JOUEURS.filter(j => j.etat_calcule === 'indisponible').length;
    const blesses = ALL_JOUEURS.filter(j => j.etat_calcule === 'blesse').length;

    const elActifs  = document.getElementById('kpi-actifs');
    const elIndispo = document.getElementById('kpi-indispo');
    const elBlesses = document.getElementById('kpi-blesses');
    if (elActifs)  elActifs.textContent  = actifs;
    if (elIndispo) elIndispo.textContent = indispo;
    if (elBlesses) elBlesses.textContent = blesses;

    const sub = document.getElementById('joueur-header-sub');
    if (sub) {
      sub.textContent = ALL_JOUEURS.length + ' joueurs au total · '
        + ALL_JOUEURS.filter(j => j.profil === 'mom' || j.profil === 'f15').length + ' MOM/F-15 · '
        + ALL_JOUEURS.filter(j => j.profil === 'partenaire').length + ' partenaires';
    }
  }

  function renderSidebarAlerts() {
    const el = document.getElementById('joueur-sb-alerts');
    if (!el) return;

    const sansEmail = ALL_JOUEURS.filter(j =>
      // Seuls les MOM ont une vraie attente d'email (les partenaires sont gérés ailleurs)
      (j.profil === 'mom' || j.profil === 'f15')
      // Note : email_principal n'est PAS dans get_joueurs_equipe. À voir si on l'ajoute
      // (pour l'instant on ne peut pas calculer ça depuis la liste)
      && false
    ).length;

    // FFR à renouveler : pas remonté par get_joueurs_equipe (date_fin_affiliation
    // est dans get_joueur_detail uniquement). Placeholder pour V1.1.
    const ffrARenouveler = 0;

    const indispoCount = ALL_JOUEURS.filter(j => j.etat_calcule === 'indisponible').length;
    const blessesCount = ALL_JOUEURS.filter(j => j.etat_calcule === 'blesse').length;
    const suspCount    = ALL_JOUEURS.filter(j => j.etat_calcule === 'suspendu').length;

    el.innerHTML = ''
      + '<div class="joueur-sb-alert-item">'
      + '  <span class="joueur-sb-alert-lbl">Indispo en cours</span>'
      + '  <span class="joueur-sb-alert-cnt' + (indispoCount > 0 ? ' warn' : '') + '">' + indispoCount + '</span>'
      + '</div>'
      + '<div class="joueur-sb-alert-item">'
      + '  <span class="joueur-sb-alert-lbl">Blessés</span>'
      + '  <span class="joueur-sb-alert-cnt' + (blessesCount > 0 ? ' warn' : '') + '">' + blessesCount + '</span>'
      + '</div>'
      + '<div class="joueur-sb-alert-item">'
      + '  <span class="joueur-sb-alert-lbl">Suspendus</span>'
      + '  <span class="joueur-sb-alert-cnt' + (suspCount > 0 ? ' warn' : '') + '">' + suspCount + '</span>'
      + '</div>';
  }

  // ============================================================
  // FICHE DÉTAILLÉE (slide-in droite, lecture seule)
  // ============================================================

  /** Ouvre la fiche détaillée d'un joueur */
  async function openFiche(personneId) {
    const overlay  = document.getElementById('joueur-fiche-overlay');
    const codeEl   = document.getElementById('joueur-fiche-code');
    const titleEl  = document.getElementById('joueur-fiche-title');
    const bodyEl   = document.getElementById('joueur-fiche-body');
    if (!overlay || !bodyEl) return;

    // Affichage immédiat depuis le cache liste (preview)
    const lite = JOUEURS_BY_ID.get(personneId);
    if (lite) {
      if (codeEl)  codeEl.textContent  = (lite.club_principal_code || '') + ' · ' + (lite.categorie_libelle_court || '');
      if (titleEl) titleEl.textContent = (lite.prenom || '') + ' ' + (lite.nom || '');
    }
    bodyEl.innerHTML = '<div class="joueur-fiche-loading">Chargement de la fiche…</div>';
    overlay.classList.add('show');

    // Fetch détaillée
    try {
      const detail = await SupabaseHub.getJoueurDetail(personneId);
      if (!detail) {
        bodyEl.innerHTML = '<div class="joueur-fiche-error">Fiche introuvable ou accès refusé.</div>';
        return;
      }
      renderFiche(detail);
    } catch (err) {
      console.error('Joueurs: openFiche()', err);
      bodyEl.innerHTML = '<div class="joueur-fiche-error">Erreur de chargement : ' + esc(err.message || err) + '</div>';
    }
  }

  /** Rend toutes les sections de la fiche */
  function renderFiche(d) {
    const codeEl   = document.getElementById('joueur-fiche-code');
    const titleEl  = document.getElementById('joueur-fiche-title');
    const bodyEl   = document.getElementById('joueur-fiche-body');
    if (!bodyEl) return;

    if (codeEl) codeEl.textContent = (d.club_principal_code || '') + ' · ' + (d.categorie_libelle_court || '');
    if (titleEl) {
      const displayName = (d.prenom || '') + ' ' + (d.nom || '');
      titleEl.textContent = displayName + (d.surnom ? ' « ' + d.surnom + ' »' : '');
    }

    bodyEl.innerHTML = ''
      + renderFicheIdentite(d)
      + renderFicheProfilSportif(d)
      + renderFicheEtatMetier(d)
      + renderFicheFFR(d)
      + renderFicheCoordonnees(d)
      + renderFicheScolarite(d)
      + renderFicheRGPD(d)
      + renderFicheMetadonnees(d)
      + renderFicheActions(d);
  }

  function renderFicheIdentite(d) {
    const age = calcAge(d.date_naissance);
    const profilColor = getProfilColor(d);
    return `
      <div class="joueur-fiche-identite">
        <div class="joueur-fiche-identite-head">
          <div class="joueur-fiche-avatar" style="background:${profilColor}">${esc(getInitiales(d))}</div>
          <div class="joueur-fiche-identite-meta-block">
            <div class="joueur-fiche-identite-meta">${esc(PROFIL_LABELS[d.profil] || 'Autre')}</div>
            <div class="joueur-fiche-identite-secondaire">
              ${d.sexe === 'F' ? 'Joueuse' : 'Joueur'}${age ? ' · ' + age + ' ans' : ''}
              ${d.date_naissance ? ' · né' + (d.sexe === 'F' ? 'e' : '') + ' le ' + formatDate(d.date_naissance) : ''}
            </div>
          </div>
          ${renderEtatBadge(d.etat_calcule)}
        </div>
        <div class="joueur-fiche-identite-badges">
          ${d.club_principal_nom_long ? `<span class="joueur-fiche-badge">${esc(d.club_principal_nom_long)}</span>` : ''}
          ${d.categorie_libelle_long ? `<span class="joueur-fiche-badge">${esc(d.categorie_libelle_long)}</span>` : ''}
          ${d.pole_libelle_court ? `<span class="joueur-fiche-badge">Pôle ${esc(d.pole_libelle_court)}</span>` : ''}
          ${d.nationalite_principale ? `<span class="joueur-fiche-badge">${esc(d.nationalite_principale)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function renderFicheProfilSportif(d) {
    const taille = formatTaille(d.taille_cm);
    const poids = formatPoids(d.poids_g);
    const hasContent =
      (d.postes_uuids && d.postes_uuids.length > 0)
      || (d.aptitudes_uuids && d.aptitudes_uuids.length > 0)
      || taille || poids;

    let body = '';
    if (d.postes_uuids && d.postes_uuids.length > 0) {
      body += '<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Postes</div><div class="joueur-fiche-row-val">'
            + renderPostesPills(d.postes_uuids) + '</div></div>';
    } else {
      body += '<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Postes</div><div class="joueur-fiche-row-val joueur-fiche-empty">Non définis</div></div>';
    }

    if (d.aptitudes_uuids && d.aptitudes_uuids.length > 0) {
      body += '<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Aptitudes</div><div class="joueur-fiche-row-val">'
            + renderAptitudesPills(d.aptitudes_uuids) + '</div></div>';
    } else {
      body += '<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Aptitudes</div><div class="joueur-fiche-row-val joueur-fiche-empty">Non définies</div></div>';
    }

    if (taille || poids) {
      body += '<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Physique</div><div class="joueur-fiche-row-val">'
            + [taille && `📏 ${taille}`, poids && `⚖️ ${poids}`].filter(Boolean).join(' · ')
            + '</div></div>';
    }

    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">🏉 Profil sportif</div>
        ${body}
      </div>
    `;
  }

  function renderFicheEtatMetier(d) {
    const hasIndispo = d.indisponibilite && d.indisponibilite.trim().length > 0;
    const hasBlessure = d.blessure_resume && d.blessure_resume.trim().length > 0;
    const hasSusp = d.suspension_jusqu_au !== null && d.suspension_jusqu_au !== undefined;

    let body = '';
    if (hasIndispo) {
      body += `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Indispo.</div><div class="joueur-fiche-row-val joueur-fiche-warn">${esc(d.indisponibilite)}</div></div>`;
    }
    if (hasBlessure) {
      body += `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Blessure</div><div class="joueur-fiche-row-val joueur-fiche-alert">${esc(d.blessure_resume)}</div></div>`;
    }
    if (hasSusp) {
      body += `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Suspendu jusqu'au</div><div class="joueur-fiche-row-val joueur-fiche-alert">${esc(formatDate(d.suspension_jusqu_au))}</div></div>`;
    }
    if (!hasIndispo && !hasBlessure && !hasSusp) {
      body = '<div class="joueur-fiche-empty">Aucun état métier déclaré · joueur disponible</div>';
    }

    // Notes coach (seule fiche détail)
    if (d.notes_coach && d.notes_coach.trim().length > 0) {
      body += `<div class="joueur-fiche-row joueur-fiche-row-block"><div class="joueur-fiche-row-lbl">Notes coach</div><div class="joueur-fiche-row-val joueur-fiche-notes">${esc(d.notes_coach)}</div></div>`;
    }

    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">⚕️ État métier</div>
        ${body}
      </div>
    `;
  }

  function renderFicheFFR(d) {
    const items = [];
    if (d.numero_licence_ffr) items.push(['Licence FFR', d.numero_licence_ffr]);
    if (d.qualite_ffr) items.push(['Qualité FFR', d.qualite_ffr]);
    if (d.type_pratique) items.push(['Type pratique', d.type_pratique]);
    if (d.date_fin_affiliation) items.push(['Fin affiliation', formatDate(d.date_fin_affiliation)]);
    if (d.annee_arrivee_club) items.push(['Arrivée club', d.annee_arrivee_club]);
    if (d.validation_ffr !== null && d.validation_ffr !== undefined) {
      items.push(['Validation FFR', d.validation_ffr ? '✓ validée' : '✗ non validée']);
    }
    if (items.length === 0) return '';
    const rows = items.map(([k, v]) =>
      `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">${esc(k)}</div><div class="joueur-fiche-row-val">${esc(v)}</div></div>`
    ).join('');
    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">🏛️ Affiliation FFR</div>
        ${rows}
      </div>
    `;
  }

  function renderFicheCoordonnees(d) {
    // Pour partenaires : doctrine audit §1.7 = bloc coordonnées vide côté MOM
    if (d.profil === 'partenaire') {
      return `
        <div class="joueur-fiche-section">
          <div class="joueur-fiche-section-title">📞 Coordonnées</div>
          <div class="joueur-fiche-empty">Non gérées côté MOM (joueur partenaire — info parents reste côté ${esc(d.club_principal_code || 'club d\'origine')})</div>
        </div>
      `;
    }
    const items = [];
    if (d.email_principal) items.push(['Email', d.email_principal]);
    if (d.email_secondaire) items.push(['Email 2nd', d.email_secondaire]);
    if (d.telephone_principal) items.push(['Téléphone', d.telephone_principal]);
    if (d.telephone_secondaire) items.push(['Téléphone 2nd', d.telephone_secondaire]);
    if (d.adresse_postale) items.push(['Adresse', d.adresse_postale]);
    if (d.code_postal || d.ville) items.push(['Ville', (d.code_postal || '') + ' ' + (d.ville || '')]);
    if (items.length === 0) {
      return `
        <div class="joueur-fiche-section">
          <div class="joueur-fiche-section-title">📞 Coordonnées</div>
          <div class="joueur-fiche-empty">Coordonnées incomplètes (à compléter dans l'Annuaire)</div>
        </div>
      `;
    }
    const rows = items.map(([k, v]) =>
      `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">${esc(k)}</div><div class="joueur-fiche-row-val">${esc(v)}</div></div>`
    ).join('');
    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">📞 Coordonnées</div>
        ${rows}
      </div>
    `;
  }

  function renderFicheScolarite(d) {
    if (!d.etablissement_scolaire && !d.classe_scolaire) return '';
    const items = [];
    if (d.etablissement_scolaire) items.push(['Établissement', d.etablissement_scolaire]);
    if (d.classe_scolaire) items.push(['Classe', d.classe_scolaire]);
    const rows = items.map(([k, v]) =>
      `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">${esc(k)}</div><div class="joueur-fiche-row-val">${esc(v)}</div></div>`
    ).join('');
    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">🎒 Scolarité</div>
        ${rows}
      </div>
    `;
  }

  function renderFicheRGPD(d) {
    const items = [];
    if (d.canal_communication_prefere) {
      items.push(['Canal préféré', d.canal_communication_prefere]);
    }
    if (d.consentement_rgpd_date) {
      items.push(['Consentement RGPD', formatDate(d.consentement_rgpd_date)]);
    }
    // Droits image (5 booléens)
    const droits = [];
    if (d.droit_image_photos_individuelles === true) droits.push('Photos individuelles');
    if (d.droit_image_photos_groupe === true) droits.push('Photos groupe');
    if (d.droit_image_site_web === true) droits.push('Site web');
    if (d.droit_image_reseaux_sociaux === true) droits.push('Réseaux sociaux');
    if (d.droit_image_presse_locale === true) droits.push('Presse locale');
    if (droits.length > 0) {
      items.push(['Droits image OK', droits.join(', ')]);
    }
    if (d.autorisation_intervention_medicale_urgence === true) {
      items.push(['Médical urgence', '✓ Autorisée']);
    }
    if (items.length === 0) return '';
    const rows = items.map(([k, v]) =>
      `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">${esc(k)}</div><div class="joueur-fiche-row-val">${esc(v)}</div></div>`
    ).join('');
    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">🔐 RGPD & droits</div>
        ${rows}
      </div>
    `;
  }

  function renderFicheMetadonnees(d) {
    const items = [];
    if (d.source_creation) items.push(['Source', d.source_creation]);
    if (d.modifie_par) items.push(['Modifié par', d.modifie_par]);
    if (d.updated_at) items.push(['Mise à jour', formatDate(d.updated_at)]);
    if (d.synchronisation_statut) items.push(['Sync', d.synchronisation_statut]);
    if (items.length === 0) return '';
    const rows = items.map(([k, v]) =>
      `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">${esc(k)}</div><div class="joueur-fiche-row-val joueur-fiche-meta">${esc(v)}</div></div>`
    ).join('');
    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">📋 Métadonnées</div>
        ${rows}
      </div>
    `;
  }

  function renderFicheActions(d) {
    // S2.4 : ces boutons seront câblés vers les modales J3/J4/J5
    return `
      <div class="joueur-fiche-section joueur-fiche-actions">
        <div class="joueur-fiche-section-title">✏️ Édition métier</div>
        <div class="joueur-fiche-actions-row">
          <button type="button" class="joueur-btn" disabled title="Câblage en S2.4">Modifier profil sportif</button>
          <button type="button" class="joueur-btn" disabled title="Câblage en S2.4">Modifier état</button>
          <button type="button" class="joueur-btn" disabled title="Câblage en S2.4">Notes coach</button>
        </div>
        <div class="joueur-form-hint" style="margin-top: 8px;">Les boutons d'édition seront câblés en sous-jalon S2.4 (modales J3/J4/J5).</div>
      </div>
    `;
  }

  // ============================================================
  // INIT
  // ============================================================

  async function init() {
    console.log('Joueurs: init() — v1.0 (S2.2 + S2.3 lecture)');

    // 1. Préfs + bindings UI
    loadPrefs();
    reflectChipsFromState();
    bindFilters();
    bindSearch();
    bindModalClosers();

    // 2. Référentiels JSON (en parallèle de la liste joueurs)
    const refPromise = loadReferentiels();

    // 3. Liste joueurs M14
    const joueurs = await SupabaseHub.getJoueursEquipe(M14_TEAM_UUID);
    if (!joueurs) {
      const listEl = document.getElementById('joueur-list');
      if (listEl) {
        listEl.innerHTML = '<div class="joueur-list-error">Échec du chargement (RPC get_joueurs_equipe). Vérifie la console.</div>';
      }
      return;
    }
    ALL_JOUEURS = joueurs;
    buildIndexes();

    // 4. Attendre fin chargement référentiels (idéalement déjà fini)
    await refPromise;

    // 5. Render
    renderKpis();
    renderSidebarAlerts();
    render();

    console.log('Joueurs: init() OK —', ALL_JOUEURS.length, 'joueurs chargés');
  }

  // ============================================================
  // API PUBLIQUE
  // ============================================================

  return {
    init: init,
    // Exposés pour debug console
    _state: () => state,
    _data: () => ALL_JOUEURS,
    _byId: () => JOUEURS_BY_ID,
    _postesById: () => POSTES_BY_ID,
    _aptitudesById: () => APTITUDES_BY_ID,
    _version: 'v1.0'
  };

})();
