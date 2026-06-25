/**
 * MOM Hub · Module Joueurs · Browser
 * ====================================
 *
 * Module IIFE — initialise l'UI de la page joueurs.html.
 *
 * Version : v1.5 — 25 juin 2026
 *   v1.5 : JOUEURS-PERIMETRE-F15 (pt 109). Aiguillage de chargement :
 *          si la catégorie active est F15 (F15_CAT_UUID), l'effectif
 *          est chargé via SupabaseHub.getJoueursF15() (RPC
 *          get_joueurs_f15 / sql_111) au lieu de la boucle par équipe.
 *          Corrige le bug recette (capture image 4) : F15, n'ayant
 *          aucune équipe rattachée, retombait sur le repli M14 et
 *          affichait l'effectif M14. F15 est un périmètre transversal
 *          par flag personnes.f15_integree. Ajouts ADDITIFS : constante
 *          F15_CAT_UUID + branche en tête de _chargerJoueursCategorieActive
 *          + message d'erreur rendu générique. node --check OK.
 * Version : v1.1 — 15 mai 2026
 *   v0 :  Squelette S2.1 (init vide + chips filtres + binders modales)
 *   v1.0 : Phase 5.14 S2.2 + S2.3 lecture (cartes + fiche slide-in)
 *   v1.1 : Phase 5.14 S2.4 — câblage des 3 modales d'édition métier
 *          - currentEditPersonneId (state) + currentEditDetail (cache fiche)
 *          - openModalProfil / submitModalProfil : postes chips multi-toggle,
 *            aptitudes cases à cocher A+B colorées, taille (cm), poids (kg→g)
 *          - openModalEtat / submitModalEtat : indispo, blessure, suspension
 *          - openModalNotes / submitModalNotes : textarea notes_coach
 *          - bindFicheActions : 3 boutons fiche slide-in cliquables (plus disabled)
 *          - showModalMessage : helper succès/erreur + auto-scrollTop
 *            (factorisation P4-UI-evenements-4 anticipée)
 *          - Après save : reloadJoueurs() + reopenFiche() pour refresh complet
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

  /** UUID équipe M14 EQ1 (entente SAR×MOM) — REPLI de dégradation honnête.
   * Conservé : si le périmètre de catégories est indisponible (socle
   * ancien, droits vides, catégorie sans équipe), on retombe sur M14
   * = comportement d'origine. */
  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  /** UUID de la catégorie F15 (categories.id). F15 n'est PAS une
   * catégorie « à équipe » : ses joueuses sont membres de l'équipe
   * M14 et le périmètre F15 est porté par le flag personnes.f15_integree
   * (cf. RPC get_joueurs_f15 / sql_111). Quand cette catégorie est
   * active, on charge l'effectif via getJoueursF15() au lieu de la
   * boucle par équipe — sinon la résolution d'équipes renvoie []
   * et le repli M14 affiche l'effectif M14 (bug recette pt 108). */
  const F15_CAT_UUID = 'a948997c-255a-430d-88f3-e33cd8782240';

  // ------------------------------------------------------------
  // Propagation multi-catégories (catégorie active partagée)
  // ------------------------------------------------------------
  // Le périmètre de catégorie active est partagé entre écrans via le
  // socle (clé localStorage mom_hub.categorie_active). L'écran Joueurs
  // affiche TOUS les joueurs de TOUTES les équipes de la catégorie
  // active (agrégation légitime : « voir mon effectif de catégorie »
  // — ≠ compo/séance qui sont par équipe). Le sélecteur de catégorie
  // (helper UXSelecteurCategorie) n'apparaît que si l'encadrant a > 1
  // catégorie ; mono-cat → UX inchangée.

  // Périmètre courant (résolu au boot), pour le sélecteur + repli.
  let CTX_PERIMETRE = null;

  /**
   * Équipes de la catégorie active → [equipeId, …].
   * Repli [M14_TEAM_UUID] : socle absent, périmètre vide, aucune
   * équipe (jamais de liste muette par construction).
   */
  async function _joueursResoudreEquipesActives() {
    if (typeof SupabaseHub === 'undefined'
        || typeof SupabaseHub.listEquipes !== 'function') {
      return [M14_TEAM_UUID];
    }
    const catId = CTX_PERIMETRE && CTX_PERIMETRE.active;
    if (!catId) return [M14_TEAM_UUID];
    let equipes;
    try {
      equipes = await SupabaseHub.listEquipes(catId);
    } catch (e) {
      console.warn('Joueurs: listEquipes indisponible, repli M14.', e);
      return [M14_TEAM_UUID];
    }
    const ids = (Array.isArray(equipes) ? equipes : [])
      .map(function (eq) { return eq && eq.id; })
      .filter(Boolean);
    return ids.length > 0 ? ids : [M14_TEAM_UUID];
  }

  /**
   * Charge les joueurs de la catégorie active : 1 appel
   * getJoueursEquipe par équipe → fusion dédoublonnée par j.id.
   * N=1 équipe (cas réel actuel) → strictement équivalent à
   * l'appel unique d'origine getJoueursEquipe(M14) (garde-fou
   * non-régression mono-catégorie).
   * @returns {Promise<Array|null>} null si TOUTES les équipes
   *   échouent (préserve la branche d'erreur d'origine).
   */
  async function _chargerJoueursCategorieActive() {
    // Aiguillage F15 : catégorie transversale par flag (sans équipe).
    // Si la catégorie active est F15, on charge l'effectif via la RPC
    // dédiée get_joueurs_f15() (wrapper getJoueursF15) — même shape de
    // sortie que get_joueurs_equipe, donc le reste du module (cartes,
    // KPIs, fiche) est inchangé. On NE passe PAS par la boucle équipes
    // (qui retomberait sur le repli M14). Dégradation honnête : si le
    // wrapper est absent (socle ancien), on laisse le flux équipes
    // d'origine s'exécuter.
    const catActive = CTX_PERIMETRE && CTX_PERIMETRE.active;
    if (catActive === F15_CAT_UUID
        && typeof SupabaseHub !== 'undefined'
        && typeof SupabaseHub.getJoueursF15 === 'function') {
      return await SupabaseHub.getJoueursF15();
    }

    const equipes = await _joueursResoudreEquipesActives();
    const listes = await Promise.all(
      equipes.map(function (eqId) {
        return SupabaseHub.getJoueursEquipe(eqId);
      })
    );
    // Si toutes les équipes renvoient null → échec global (null,
    // comportement d'origine : message d'erreur honnête).
    if (listes.every(function (l) { return l === null; })) return null;
    // Fusion dédoublonnée par identité joueur (j.id) : un joueur
    // présent dans 2 équipes de la catégorie n'apparaît qu'une fois.
    const parId = new Map();
    listes.forEach(function (liste) {
      if (!Array.isArray(liste)) return;
      liste.forEach(function (j) {
        if (j && j.id && !parId.has(j.id)) parId.set(j.id, j);
      });
    });
    return Array.from(parId.values());
  }

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

  /** State d'édition courante (S2.4) */
  let currentEditPersonneId = null;
  let currentEditDetail = null;  // cache de la fiche en cours d'édition

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
    // P2-J.3 : FAB Ajouter personne → message Annuaire placeholder
    const fabAdd = document.getElementById('joueur-fab-add');
    if (fabAdd) {
      fabAdd.addEventListener('click', function () {
        alert('La création d\'une nouvelle personne (identité, licence FFR, coordonnées) se fait depuis l\'Annuaire global.\n\nLe module Annuaire est en cours de développement.\n\nPour ajouter manuellement une personne V1, contactez votre administrateur.');
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

  // ============================================================
  // P2-J.1 : CONFORMITÉ FFR (pastille carte + section fiche)
  // ============================================================

  /**
   * Retourne le HTML de la pastille conformité FFR pour une carte.
   * Données dispo dans la vue liste : numero_licence_ffr, qualite_ffr.
   * date_fin_affiliation et validation_ffr ne sont que dans le détail.
   * → Pastille carte = check basique (licence présente ou pas).
   * Pour les partenaires : pas de pastille (conformité gérée club d'origine).
   */
  function renderCardFFRPastille(j) {
    if (j.profil === 'partenaire') return '';
    if (!j.numero_licence_ffr) {
      return '<div class="joueur-card-ffr-pastille ffr-rouge" title="Licence FFR manquante">!</div>';
    }
    return '';
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
            ${renderCardFFRPastille(j)}
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

    // Mémorise pour l'édition (S2.4)
    currentEditPersonneId = personneId;
    currentEditDetail = null;

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
      currentEditDetail = detail;
      renderFiche(detail);
      bindFicheActions();
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
      + renderFicheActions(d)
      + renderFicheProfilSportif(d)
      + renderFicheEtatMetier(d)
      + wrapCollapsible(renderFicheFFR(d))
      + wrapCollapsible(renderFicheCoordonnees(d))
      + wrapCollapsible(renderFicheScolarite(d))
      + wrapCollapsible(renderFicheRGPD(d))
      + wrapCollapsible(renderFicheMetadonnees(d))
      + renderFicheFooterAnnuaire();
  }

  /**
   * P2-J.2 : Transforme une section fiche en section repliable mobile.
   * Ajoute la classe .joueur-fiche-collapsible, un chevron ▶ au titre,
   * et encadre le contenu après le titre dans .joueur-fiche-section-body.
   */
  function wrapCollapsible(html) {
    if (!html || !html.trim()) return '';
    var s = html.trim();
    // Ajout classe collapsible
    s = s.replace('joueur-fiche-section">', 'joueur-fiche-section joueur-fiche-collapsible">');
    // Ajout chevron au titre
    s = s.replace(/<\/div>\s*/, ' <span class="joueur-fiche-chevron">▶</span></div><div class="joueur-fiche-section-body">');
    // Ajout fermeture section-body avant la dernière </div>
    var lastClose = s.lastIndexOf('</div>');
    s = s.substring(0, lastClose) + '</div></div>';
    return s;
  }

  /**
   * P2-J.3 : Footer Annuaire mention dans la fiche (conception §3.2 / §5.3 Q7).
   */
  function renderFicheFooterAnnuaire() {
    return `
      <div class="joueur-fiche-section" style="border-top: 1px solid var(--line); padding-top: 10px;">
        <div style="font-size:11px; color:var(--ink-mute); line-height:1.5;">
          📌 L'identité (nom, licence, contacts) s'édite dans l'Annuaire global (module à venir).
        </div>
      </div>
    `;
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
    // P2-J.1 : Section conformité FFR structurée (conception §3.2-bis + §5.4 Q10)
    const isPartenaire = d.profil === 'partenaire';

    if (isPartenaire) {
      // Partenaires : conformité gérée par club d'origine (doctrine audit §1.7)
      return `
        <div class="joueur-fiche-section">
          <div class="joueur-fiche-section-title">🩺 Conformité FFR</div>
          <div class="joueur-fiche-ffr-partenaire">
            Pour ce joueur partenaire ${esc(d.club_principal_code || 'club d\'origine')},
            la conformité FFR (passeports JDD/ASR, certificat médical) est gérée
            par le club d'origine. Non vérifiable côté MOM.
          </div>
          ${d.numero_licence_ffr ? `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Licence FFR</div><div class="joueur-fiche-row-val">${esc(d.numero_licence_ffr)}</div></div>` : ''}
          ${d.date_fin_affiliation ? `<div class="joueur-fiche-row"><div class="joueur-fiche-row-lbl">Fin affiliation</div><div class="joueur-fiche-row-val">${esc(formatDate(d.date_fin_affiliation))}</div></div>` : ''}
        </div>
      `;
    }

    // Joueurs MOM / F-15 / Coach / Staff : grille conformité 4 documents
    const now = new Date();
    const SEUIL_JOURS = 30;

    // 1. Licence FFR
    const licenceOk = !!d.numero_licence_ffr;
    const licenceIcon = licenceOk ? '✅' : '🔴';
    const licenceCls = licenceOk ? 'ffr-ok' : 'ffr-alert';
    const licenceVal = licenceOk ? d.numero_licence_ffr : 'Manquante';

    // 2. Affiliation (date_fin_affiliation)
    let affilIcon = '❓', affilCls = '', affilVal = 'Non renseignée';
    if (d.date_fin_affiliation) {
      const dateFin = new Date(d.date_fin_affiliation);
      const joursRestants = Math.ceil((dateFin - now) / (1000 * 60 * 60 * 24));
      if (joursRestants < 0) {
        affilIcon = '🔴'; affilCls = 'ffr-alert';
        affilVal = 'Expirée depuis le ' + formatDate(d.date_fin_affiliation);
      } else if (joursRestants <= SEUIL_JOURS) {
        affilIcon = '🟡'; affilCls = 'ffr-warn';
        affilVal = 'Expire le ' + formatDate(d.date_fin_affiliation) + ' (J-' + joursRestants + ')';
      } else {
        affilIcon = '✅'; affilCls = 'ffr-ok';
        affilVal = 'Valide jusqu\'au ' + formatDate(d.date_fin_affiliation);
      }
    }

    // 3. Validation FFR
    let validIcon = '❓', validCls = '', validVal = 'Non renseignée';
    if (d.validation_ffr === true) {
      validIcon = '✅'; validCls = 'ffr-ok'; validVal = 'Validée';
    } else if (d.validation_ffr === false) {
      validIcon = '🔴'; validCls = 'ffr-alert'; validVal = 'Non validée';
    }

    // 4. Qualité FFR
    const qualIcon = d.qualite_ffr ? '✅' : '❓';
    const qualCls = d.qualite_ffr ? 'ffr-ok' : '';
    const qualVal = d.qualite_ffr ? 'Qualité ' + d.qualite_ffr : 'Non renseignée';

    // Infos complémentaires
    const extraRows = [];
    if (d.type_pratique) extraRows.push(['Type pratique', d.type_pratique]);
    if (d.annee_arrivee_club) extraRows.push(['Arrivée club', d.annee_arrivee_club]);

    return `
      <div class="joueur-fiche-section">
        <div class="joueur-fiche-section-title">🩺 Conformité FFR</div>
        <div class="joueur-fiche-ffr-grid">
          <div class="joueur-fiche-ffr-item">
            <span class="joueur-fiche-ffr-icon">${licenceIcon}</span>
            <div class="joueur-fiche-ffr-detail">
              <div class="joueur-fiche-ffr-label">Licence FFR</div>
              <div class="joueur-fiche-ffr-value ${licenceCls}">${esc(licenceVal)}</div>
            </div>
          </div>
          <div class="joueur-fiche-ffr-item">
            <span class="joueur-fiche-ffr-icon">${affilIcon}</span>
            <div class="joueur-fiche-ffr-detail">
              <div class="joueur-fiche-ffr-label">Affiliation</div>
              <div class="joueur-fiche-ffr-value ${affilCls}">${esc(affilVal)}</div>
            </div>
          </div>
          <div class="joueur-fiche-ffr-item">
            <span class="joueur-fiche-ffr-icon">${validIcon}</span>
            <div class="joueur-fiche-ffr-detail">
              <div class="joueur-fiche-ffr-label">Validation FFR</div>
              <div class="joueur-fiche-ffr-value ${validCls}">${esc(validVal)}</div>
            </div>
          </div>
          <div class="joueur-fiche-ffr-item">
            <span class="joueur-fiche-ffr-icon">${qualIcon}</span>
            <div class="joueur-fiche-ffr-detail">
              <div class="joueur-fiche-ffr-label">Qualité</div>
              <div class="joueur-fiche-ffr-value ${qualCls}">${esc(qualVal)}</div>
            </div>
          </div>
        </div>
        ${extraRows.map(([k, v]) =>
          `<div class="joueur-fiche-row" style="margin-top:6px;"><div class="joueur-fiche-row-lbl">${esc(k)}</div><div class="joueur-fiche-row-val">${esc(v)}</div></div>`
        ).join('')}
        <div class="joueur-form-hint" style="margin-top:8px;">⚠️ Le Hub signale ces points sans bloquer. La conformité reste sous votre responsabilité.</div>
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
    // S2.4 : boutons câblés vers les modales J3/J4/J5
    // pt 62 (câblage accès) : + accès « Stats de saison » → page autonome
    //   fiche-joueur-stats.html?joueur_id=<id>. C'est une CONSULTATION
    //   (lecture seule), distincte de l'édition métier → ligne séparée.
    //   L'id vient de currentEditPersonneId (posé par openFiche), pas d'un
    //   champ de `d` (évite toute hypothèse sur le nom de colonne du détail).
    return `
      <div class="joueur-fiche-section joueur-fiche-actions">
        <div class="joueur-fiche-section-title">📊 Suivi</div>
        <div class="joueur-fiche-actions-row">
          <button type="button" class="joueur-btn joueur-btn-stats" data-stats="saison">Stats de saison</button>
        </div>
        <div class="joueur-fiche-section-title" style="margin-top:14px;">✏️ Édition métier</div>
        <div class="joueur-fiche-actions-row">
          <button type="button" class="joueur-btn joueur-btn-edit" data-edit="profil">Modifier profil sportif</button>
          <button type="button" class="joueur-btn joueur-btn-edit" data-edit="etat">Modifier état</button>
          <button type="button" class="joueur-btn joueur-btn-edit" data-edit="notes">Notes coach</button>
        </div>
      </div>
    `;
  }

  /** Branche les 3 boutons d'édition de la fiche (à appeler après renderFiche). */
  function bindFicheActions() {
    // pt 62 — accès « Stats de saison » (consultation, page autonome).
    //   joueur_id = currentEditPersonneId (l'id passé à openFiche).
    document.querySelectorAll('.joueur-btn-stats[data-stats="saison"]').forEach(btn => {
      btn.addEventListener('click', function () {
        if (!currentEditPersonneId) return;
        window.location.href = 'fiche-joueur-stats.html?joueur_id=' + encodeURIComponent(currentEditPersonneId);
      });
    });
    document.querySelectorAll('.joueur-btn-edit[data-edit]').forEach(btn => {
      btn.addEventListener('click', function () {
        if (!currentEditDetail) return;
        const which = this.dataset.edit;
        if (which === 'profil') openModalProfil(currentEditDetail);
        else if (which === 'etat') openModalEtat(currentEditDetail);
        else if (which === 'notes') openModalNotes(currentEditDetail);
      });
    });
    // P2-J.2 : toggle collapsible mobile (FFR, coordonnées, scolarité, RGPD, meta)
    document.querySelectorAll('.joueur-fiche-collapsible .joueur-fiche-section-title').forEach(title => {
      title.addEventListener('click', function () {
        this.closest('.joueur-fiche-collapsible').classList.toggle('is-open');
      });
    });
  }

  // ============================================================
  // S2.4 — MODALES D'ÉDITION J3 / J4 / J5
  // ============================================================

  /**
   * Helper : affiche un message succès / erreur en haut du body de modale,
   * et fait remonter le scroll pour s'assurer qu'il est visible.
   * Anticipe la dette P4-UI-evenements-4 (factorisation).
   */
  function showModalMessage(modalMsgElId, modalBodyElId, type, text) {
    const msgEl = document.getElementById(modalMsgElId);
    const bodyEl = document.getElementById(modalBodyElId);
    if (msgEl) {
      const cls = type === 'success' ? 'joueur-form-success' : 'joueur-form-error';
      msgEl.innerHTML = `<div class="${cls}">${esc(text)}</div>`;
    }
    if (bodyEl) bodyEl.scrollTop = 0;
  }

  function clearModalMessage(modalMsgElId) {
    const msgEl = document.getElementById(modalMsgElId);
    if (msgEl) msgEl.innerHTML = '';
  }

  /**
   * Recharge la liste joueurs + ré-render KPIs/cartes/sidebar.
   * Appelé après save modale pour refresh UI complet.
   */
  async function reloadJoueurs() {
    const joueurs = await _chargerJoueursCategorieActive();
    if (joueurs) {
      ALL_JOUEURS = joueurs;
      buildIndexes();
      renderKpis();
      renderSidebarAlerts();
      render();
    }
  }

  /** Ré-ouvre la fiche du joueur courant pour refléter les modifs. */
  async function reopenFicheCurrent() {
    if (currentEditPersonneId) {
      await openFiche(currentEditPersonneId);
    }
  }

  // ----------------------------------------------------------------
  // J3 — Modale Profil sportif (postes + aptitudes + taille + poids)
  // ----------------------------------------------------------------

  function openModalProfil(d) {
    const overlay = document.getElementById('joueur-overlay-profil');
    if (!overlay) return;

    clearModalMessage('joueur-profil-msg');

    // Info en haut
    const infoEl = document.getElementById('joueur-profil-info');
    if (infoEl) {
      infoEl.innerHTML = '<span class="joueur-modal-info-strong">'
        + esc(d.prenom) + ' ' + esc(d.nom) + '</span> · '
        + esc(PROFIL_LABELS[d.profil] || 'Autre');
    }

    // Génère les chips postes
    renderModalProfilPostesChips(d.postes_uuids || []);

    // Génère la grille aptitudes
    renderModalProfilAptitudesGrid(d.aptitudes_uuids || []);

    // Pré-remplit taille / poids
    const inputTaille = document.getElementById('joueur-profil-taille');
    const inputPoids  = document.getElementById('joueur-profil-poids');
    if (inputTaille) inputTaille.value = (d.taille_cm !== null && d.taille_cm !== undefined) ? d.taille_cm : '';
    if (inputPoids)  inputPoids.value  = (d.poids_g !== null && d.poids_g !== undefined) ? (d.poids_g / 1000).toFixed(1) : '';

    // Active le bouton submit
    const submitBtn = document.getElementById('joueur-profil-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.onclick = submitModalProfil;
    }

    overlay.classList.add('show');
  }

  function renderModalProfilPostesChips(activeUuids) {
    const container = document.getElementById('joueur-profil-postes-chips');
    if (!container) return;
    const html = [];
    POSTES_BY_ID.forEach((p, uuid) => {
      const isActive = activeUuids.includes(uuid);
      html.push(
        `<span class="joueur-modal-chip-poste${isActive ? ' is-active' : ''}" data-poste-uuid="${esc(uuid)}">`
        + esc(p.libelle_court || p.code || '?')
        + `</span>`
      );
    });
    container.innerHTML = html.join('');
    // Toggle au clic
    container.querySelectorAll('.joueur-modal-chip-poste').forEach(chip => {
      chip.addEventListener('click', function () {
        this.classList.toggle('is-active');
      });
    });
  }

  function renderModalProfilAptitudesGrid(activeUuids) {
    const container = document.getElementById('joueur-profil-aptitudes-grid');
    if (!container) return;
    const html = [];
    APTITUDES_BY_ID.forEach((a, uuid) => {
      const isActive = activeUuids.includes(uuid);
      const couleur = a.couleur || '#888';
      html.push(
        `<label class="joueur-modal-apt-cell${isActive ? ' is-active' : ''}" data-apt-uuid="${esc(uuid)}">`
        + `<input type="checkbox" ${isActive ? 'checked' : ''} class="joueur-modal-apt-checkbox">`
        + `<span class="joueur-pill joueur-pill-apt" style="background:${esc(couleur)}">${esc(a.libelle_court || '?')}</span>`
        + `</label>`
      );
    });
    container.innerHTML = html.join('');
    // Toggle visuel au clic
    container.querySelectorAll('.joueur-modal-apt-cell').forEach(cell => {
      cell.addEventListener('change', function () {
        const cb = this.querySelector('input[type=checkbox]');
        this.classList.toggle('is-active', !!cb.checked);
      });
    });
  }

  async function submitModalProfil() {
    if (!currentEditPersonneId) return;
    clearModalMessage('joueur-profil-msg');

    const submitBtn = document.getElementById('joueur-profil-submit');
    if (submitBtn) submitBtn.disabled = true;

    try {
      // Lecture postes actifs
      const postesActifs = [];
      document.querySelectorAll('#joueur-profil-postes-chips .joueur-modal-chip-poste.is-active').forEach(chip => {
        postesActifs.push(chip.dataset.posteUuid);
      });

      // Lecture aptitudes actives
      const aptitudesActives = [];
      document.querySelectorAll('#joueur-profil-aptitudes-grid .joueur-modal-apt-cell').forEach(cell => {
        const cb = cell.querySelector('input[type=checkbox]');
        if (cb && cb.checked) {
          aptitudesActives.push(cell.dataset.aptUuid);
        }
      });

      // Lecture taille / poids
      const inputTaille = document.getElementById('joueur-profil-taille');
      const inputPoids  = document.getElementById('joueur-profil-poids');
      const tailleVal = inputTaille && inputTaille.value !== '' ? parseInt(inputTaille.value, 10) : null;
      const poidsKgVal = inputPoids && inputPoids.value !== '' ? parseFloat(inputPoids.value.replace(',', '.')) : null;

      // Validations côté client
      if (tailleVal !== null) {
        if (isNaN(tailleVal) || tailleVal < 50 || tailleVal > 250) {
          showModalMessage('joueur-profil-msg', 'joueur-profil-body', 'error',
            'Taille invalide. Doit être un entier entre 50 et 250 cm.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
      }
      if (poidsKgVal !== null) {
        if (isNaN(poidsKgVal) || poidsKgVal < 5 || poidsKgVal > 250) {
          showModalMessage('joueur-profil-msg', 'joueur-profil-body', 'error',
            'Poids invalide. Doit être entre 5 et 250 kg.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
      }

      // Conversion kg → g pour la RPC (entier)
      const poidsG = poidsKgVal !== null ? Math.round(poidsKgVal * 1000) : null;

      const patch = {
        postes_uuids:    postesActifs,
        aptitudes_uuids: aptitudesActives,
        taille_cm:       tailleVal,
        poids_g:         poidsG
      };

      const res = await SupabaseHub.updateJoueurMetier(currentEditPersonneId, patch);
      if (!res || !res.ok) {
        showModalMessage('joueur-profil-msg', 'joueur-profil-body', 'error',
          'Échec : ' + ((res && res.error) || 'erreur inconnue'));
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      // Succès : message + refresh
      showModalMessage('joueur-profil-msg', 'joueur-profil-body', 'success',
        '✅ Profil sportif mis à jour');

      // Ferme la modale et refresh fiche + liste
      setTimeout(async () => {
        document.getElementById('joueur-overlay-profil').classList.remove('show');
        await reloadJoueurs();
        await reopenFicheCurrent();
      }, 700);

    } catch (err) {
      console.error('Joueurs: submitModalProfil()', err);
      showModalMessage('joueur-profil-msg', 'joueur-profil-body', 'error',
        'Erreur inattendue : ' + (err.message || err));
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // ----------------------------------------------------------------
  // J4 — Modale État (indispo / blessure / suspension)
  // ----------------------------------------------------------------

  function openModalEtat(d) {
    const overlay = document.getElementById('joueur-overlay-etat');
    if (!overlay) return;

    clearModalMessage('joueur-etat-msg');

    const infoEl = document.getElementById('joueur-etat-info');
    if (infoEl) {
      infoEl.innerHTML = '<span class="joueur-modal-info-strong">'
        + esc(d.prenom) + ' ' + esc(d.nom) + '</span> · '
        + 'État actuel : ' + esc(ETAT_LABELS[d.etat_calcule] || d.etat_calcule);
    }

    // Pré-remplit les 3 champs
    const tIndispo = document.getElementById('joueur-etat-indispo');
    const tBlessure = document.getElementById('joueur-etat-blessure');
    const dSusp = document.getElementById('joueur-etat-suspension');
    if (tIndispo)  tIndispo.value  = d.indisponibilite || '';
    if (tBlessure) tBlessure.value = d.blessure_resume || '';
    if (dSusp)     dSusp.value     = d.suspension_jusqu_au || '';

    const submitBtn = document.getElementById('joueur-etat-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.onclick = submitModalEtat;
    }

    overlay.classList.add('show');
  }

  async function submitModalEtat() {
    if (!currentEditPersonneId) return;
    clearModalMessage('joueur-etat-msg');

    const submitBtn = document.getElementById('joueur-etat-submit');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const tIndispo  = document.getElementById('joueur-etat-indispo');
      const tBlessure = document.getElementById('joueur-etat-blessure');
      const dSusp     = document.getElementById('joueur-etat-suspension');

      const patch = {
        indisponibilite:     tIndispo  ? tIndispo.value  : '',
        blessure_resume:     tBlessure ? tBlessure.value : '',
        suspension_jusqu_au: dSusp     ? dSusp.value     : ''
      };

      const res = await SupabaseHub.updateJoueurMetier(currentEditPersonneId, patch);
      if (!res || !res.ok) {
        showModalMessage('joueur-etat-msg', 'joueur-etat-body', 'error',
          'Échec : ' + ((res && res.error) || 'erreur inconnue'));
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      showModalMessage('joueur-etat-msg', 'joueur-etat-body', 'success',
        '✅ État métier mis à jour');

      setTimeout(async () => {
        document.getElementById('joueur-overlay-etat').classList.remove('show');
        await reloadJoueurs();
        await reopenFicheCurrent();
      }, 700);

    } catch (err) {
      console.error('Joueurs: submitModalEtat()', err);
      showModalMessage('joueur-etat-msg', 'joueur-etat-body', 'error',
        'Erreur inattendue : ' + (err.message || err));
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // ----------------------------------------------------------------
  // J5 — Modale Notes coach
  // ----------------------------------------------------------------

  function openModalNotes(d) {
    const overlay = document.getElementById('joueur-overlay-notes');
    if (!overlay) return;

    clearModalMessage('joueur-notes-msg');

    const infoEl = document.getElementById('joueur-notes-info');
    if (infoEl) {
      infoEl.innerHTML = '<span class="joueur-modal-info-strong">'
        + esc(d.prenom) + ' ' + esc(d.nom) + '</span>'
        + ' · Notes privées coach (non visibles par le joueur ni les parents)';
    }

    const ta = document.getElementById('joueur-notes-texte');
    if (ta) ta.value = d.notes_coach || '';

    const submitBtn = document.getElementById('joueur-notes-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.onclick = submitModalNotes;
    }

    overlay.classList.add('show');
  }

  async function submitModalNotes() {
    if (!currentEditPersonneId) return;
    clearModalMessage('joueur-notes-msg');

    const submitBtn = document.getElementById('joueur-notes-submit');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const ta = document.getElementById('joueur-notes-texte');
      const patch = {
        notes_coach: ta ? ta.value : ''
      };

      const res = await SupabaseHub.updateJoueurMetier(currentEditPersonneId, patch);
      if (!res || !res.ok) {
        showModalMessage('joueur-notes-msg', 'joueur-notes-body', 'error',
          'Échec : ' + ((res && res.error) || 'erreur inconnue'));
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      showModalMessage('joueur-notes-msg', 'joueur-notes-body', 'success',
        '✅ Notes coach mises à jour');

      setTimeout(async () => {
        document.getElementById('joueur-overlay-notes').classList.remove('show');
        await reloadJoueurs();
        await reopenFicheCurrent();
      }, 700);

    } catch (err) {
      console.error('Joueurs: submitModalNotes()', err);
      showModalMessage('joueur-notes-msg', 'joueur-notes-body', 'error',
        'Erreur inattendue : ' + (err.message || err));
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // ============================================================
  // INIT
  // ============================================================

  async function init() {
    console.log('Joueurs: init() — v1.3 (P2-J.1 FFR + P2-J.2 mobile + P2-J.3 polish)');

    // 1. Préfs + bindings UI
    loadPrefs();
    reflectChipsFromState();
    bindFilters();
    bindSearch();
    bindModalClosers();

    // 1bis. Périmètre de catégorie active + sélecteur (multi-cat).
    // Résolu AVANT le chargement pour que _chargerJoueursCategorieActive
    // lise la bonne catégorie. Le sélecteur n'apparaît que si > 1
    // catégorie (helper UXSelecteurCategorie). Repli silencieux si le
    // socle ou le helper sont absents (UX d'origine, repli M14).
    if (typeof UXSelecteurCategorie !== 'undefined'
        && typeof UXSelecteurCategorie.resoudre === 'function') {
      try {
        const ctxCat = await UXSelecteurCategorie.resoudre();
        if (ctxCat && ctxCat.perimetre) {
          CTX_PERIMETRE = ctxCat.perimetre;
          UXSelecteurCategorie.monter({
            perimetre: CTX_PERIMETRE,
            ancreSelector: '.joueur-header',
            teamSpanSelector: '.joueur-header h2 .joueur-team',
            titreDocument: 'MOM Hub · Joueurs',
            wrapId: 'joueur-cat-selecteur-wrap',
            selectId: 'joueur-cat-selecteur',
            onChange: async function () {
              // Recharge la liste sur la nouvelle catégorie active.
              await reloadJoueurs();
            }
          });
        }
      } catch (e) {
        console.warn('Joueurs: résolution périmètre catégorie échouée, repli M14.', e);
      }
    }

    // 2. Référentiels JSON (en parallèle de la liste joueurs)
    const refPromise = loadReferentiels();

    // 3. Liste joueurs de la catégorie active (agrégée multi-équipes)
    const joueurs = await _chargerJoueursCategorieActive();
    if (!joueurs) {
      const listEl = document.getElementById('joueur-list');
      if (listEl) {
        listEl.innerHTML = '<div class="joueur-list-error">Échec du chargement de l\'effectif (RPC get_joueurs_equipe / get_joueurs_f15). Vérifie la console.</div>';
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
    _version: 'v1.5'  /* pt 109 : aiguillage F15 (RPC get_joueurs_f15, périmètre par flag) */
  };

})();
