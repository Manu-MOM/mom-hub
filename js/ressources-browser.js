/**
 * MOM Hub · Ressources Browser
 * ============================================================
 * Logique du module « Ressources pédagogiques ».
 *
 * Calqué sur bibliotheque-browser.js (module Bibliothèque d'ateliers),
 * avec deux écarts assumés (doc FAIT FOI Conception-Module-Ressources-Pedagogiques-v1) :
 *   - D4 : RECHERCHE TRANSVERSE en entrée principale (pas une batterie de filtres).
 *   - D5 : l'âge est une ÉTIQUETTE portée par une ressource, jamais un axe de rangement.
 *
 * Responsabilités :
 *   1. Charger data/ressources.json (index typé, édité à la main) — bloquant.
 *   2. Charger data/ressources-all.json (bundle des détails, converters) — arrière-plan.
 *   3. Recherche transverse : sur l'index (titre + thèmes + étiquette d'âge) ENRICHIE
 *      du texte du bundle quand il est chargé (intro/clés, rôles/attributs, sections/items,
 *      nœuds) — JAMAIS sur le texte des PDF (D6). Chaque résultat porte un badge de nature.
 *   4. Vue Plan : table des matières regroupée par NATURE (les 4 familles + extensible).
 *   5. Modale détail au clic : rendu ADAPTÉ PAR NATURE (D7) + boutons PDF/PPTX/Drive.
 *   6. Mode dégradé : si le bundle est absent, la modale montre au moins titre + nature
 *      + lien Drive (robustesse héritée de la Bibliothèque).
 *
 * Architecture :
 *   - Module IIFE exposant window.RessourcesBrowser.init() / openModal() / closeModal().
 *
 * Dépendances DOM attendues (cf. ressources.html) :
 *   #search                         → champ de recherche transverse
 *   #content                        → zone principale (résultats de recherche OU plan)
 *   [data-view]                     → boutons vue Recherche / Plan (toggle)
 *   #stat-* (compteurs bannière)    → totaux par nature
 *   #overlay + #m-*                 → modale détail
 *
 * Version : 1.0 — première intégration module Ressources pédagogiques
 */

(function () {
  'use strict';

  // ============================================================
  // 1. ÉTAT INTERNE
  // ============================================================

  let RESSOURCES = [];      // index, depuis data/ressources.json
  let BUNDLE = {};          // détails, depuis data/ressources-all.json (indexé par fileId_dossier)
  let BUNDLE_LOADED = false; // flag : bundle chargé ou non

  const state = { view: 'search', search: '' };

  // Métadonnées d'affichage par NATURE (les 4 familles + extensible).
  // icon = pastille ; color/bg = accents ; label = badge de nature ; bloc = clé du bloc typé.
  const NATURES = {
    fiche_technique: {
      label: 'Fiche technique', short: 'Fiche', icon: '📘',
      color: '#0f4f28', bg: '#edf9f2', bloc: 'concept', ordre: 1
    },
    comportements_poste: {
      label: 'Comportements par poste', short: 'Poste', icon: '🎽',
      color: '#1a3a7a', bg: '#e8f1fb', bloc: 'poste', ordre: 2
    },
    referentiel_categorie: {
      label: 'Référentiel par catégorie', short: 'Référentiel', icon: '📋',
      color: '#5a3a00', bg: '#fdf3d0', bloc: 'grille', ordre: 3
    },
    carte_mentale: {
      label: 'Carte mentale', short: 'Carte', icon: '🧠',
      color: '#4a1a7a', bg: '#f0e8ff', bloc: 'carte', ordre: 4
    }
  };

  const NATURE_DEFAUT = {
    label: 'Ressource', short: 'Ressource', icon: '📄',
    color: '#374151', bg: '#f3f4f6', bloc: 'data', ordre: 99
  };

  function natureMeta(type) { return NATURES[type] || NATURE_DEFAUT; }

  // ============================================================
  // 2. CHARGEMENT DES DONNÉES
  // ============================================================

  async function loadIndex() {
    const r = await fetch('data/ressources.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('data/ressources.json introuvable (HTTP ' + r.status + ')');
    const data = await r.json();
    RESSOURCES = Array.isArray(data) ? data : (data.ressources || []);
    // _idx stable pour openModal + corpus de recherche pré-calculé (index seul pour l'instant)
    RESSOURCES.forEach((res, i) => {
      res._idx = i;
      res._corpus = corpusIndex(res);
    });
  }

  async function loadBundle() {
    try {
      const r = await fetch('data/ressources-all.json', { cache: 'no-cache' });
      if (r.ok) {
        BUNDLE = await r.json();
        BUNDLE_LOADED = true;
        // Enrichit le corpus de recherche avec le texte du bundle (D6 : JSON, pas PDF)
        RESSOURCES.forEach(res => {
          const entry = BUNDLE[res.fileId_dossier];
          if (entry) res._corpus = (res._corpus + ' ' + corpusBundle(entry)).toLowerCase();
        });
        console.log('Ressources : ressources-all.json chargé (' + Object.keys(BUNDLE).length + ' entrées)');
      } else {
        console.warn('Ressources : ressources-all.json absent (' + r.status + ') — modale en mode dégradé');
      }
    } catch (e) {
      console.warn('Ressources : ressources-all.json non chargé : ' + e.message);
    }
  }

  // ============================================================
  // 3. HELPERS
  // ============================================================

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // Corpus de recherche issu de l'INDEX seul (toujours disponible).
  function corpusIndex(res) {
    const parts = [res.titre || '', (res.themes || []).join(' '), res.etiquette_age || '',
                   natureMeta(res.type).label];
    return parts.join(' ').toLowerCase();
  }

  // Corpus enrichi issu du BUNDLE (texte des JSON typés — jamais le PDF, D6).
  function corpusBundle(entry) {
    const t = entry.type;
    const parts = [];
    if (t === 'fiche_technique') {
      const c = entry.concept || {};
      parts.push(c.titre || '');
      (c.intro || []).forEach(b => { parts.push(b.label || ''); (b.contenu || []).forEach(x => parts.push(x)); });
      (c.cles || []).forEach(k => { parts.push(k.label || ''); (k.contenu || []).forEach(x => parts.push(x)); });
    } else if (t === 'comportements_poste') {
      const p = entry.poste || {};
      parts.push(p.nom || '', p.numeros || '', p.avis_coachs || '');
      Object.values(p.attributs || {}).forEach(v => parts.push(v));
      Object.values(p.roles || {}).forEach(v => parts.push(v));
      (p.points_vigilance || []).forEach(x => parts.push(x));
    } else if (t === 'referentiel_categorie') {
      const g = entry.grille || {};
      parts.push(g.categorie || '', g.sous_titre || '');
      (g.sections || []).forEach(s => {
        parts.push(s.titre || '');
        (s.sous_blocs || []).forEach(sb => { parts.push(sb.nom || ''); (sb.items || []).forEach(x => parts.push(x)); });
      });
    } else if (t === 'carte_mentale') {
      const c = entry.carte || {};
      parts.push(c.titre || '', c.centre || '');
      (c.noeuds || []).forEach(x => parts.push(x));
    }
    return parts.filter(Boolean).join(' ');
  }

  // Filtre de recherche : tous les mots de la requête doivent être présents dans le corpus.
  function matchSearch(res, q) {
    if (!q) return true;
    const mots = q.toLowerCase().split(/\s+/).filter(Boolean);
    return mots.every(m => res._corpus.indexOf(m) !== -1);
  }

  function updateStats() {
    const compteur = {};
    RESSOURCES.forEach(r => { compteur[r.type] = (compteur[r.type] || 0) + 1; });
    setText('stat-total', RESSOURCES.length);
    setText('stat-fiches', compteur.fiche_technique || 0);
    setText('stat-postes', compteur.comportements_poste || 0);
    setText('stat-grilles', compteur.referentiel_categorie || 0);
    setText('stat-cartes', compteur.carte_mentale || 0);
  }

  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  // ============================================================
  // 4. VUE RECHERCHE (entrée principale — D4)
  // ============================================================

  function ageBadge(res) {
    return res.etiquette_age
      ? `<span class="res-age">${escHtml(res.etiquette_age)}</span>` : '';
  }

  function themesBadges(res) {
    return (res.themes || []).map(t => `<span class="res-theme">${escHtml(t)}</span>`).join('');
  }

  function makeResultCard(res) {
    const meta = natureMeta(res.type);
    return `
      <div class="res-card" onclick="window.RessourcesBrowser.openModal(${res._idx})" style="border-left-color:${meta.color}">
        <div class="res-card-pastille" style="background:${meta.bg};color:${meta.color}">${meta.icon}</div>
        <div class="res-card-main">
          <div class="res-card-top">
            <span class="res-nature" style="background:${meta.bg};color:${meta.color}">${escHtml(meta.label)}</span>
            ${ageBadge(res)}
          </div>
          <div class="res-card-title">${escHtml(res.titre)}</div>
          <div class="res-card-themes">${themesBadges(res)}</div>
        </div>
        <div class="res-card-chev">›</div>
      </div>
    `;
  }

  function renderSearch() {
    const q = state.search.trim();
    const items = RESSOURCES.filter(r => matchSearch(r, q));

    if (q && items.length === 0) {
      return `<div class="res-empty">Aucune ressource ne correspond à « ${escHtml(q)} ».<br>
        <span class="res-empty-hint">Essayez un mot plus simple (« duel », « plaquage », « soutien »…) ou passez en vue Plan.</span></div>`;
    }

    // Sans recherche : on montre TOUT, groupé par nature (proche du plan, mais en cartes).
    // Avec recherche : liste à plat, toutes natures confondues (la recherche réunit, D4).
    let h = '';
    if (q) {
      h += `<div class="res-results-count">${items.length} résultat${items.length > 1 ? 's' : ''} pour « ${escHtml(q)} »</div>`;
      h += '<div class="res-results">';
      items.forEach(r => { h += makeResultCard(r); });
      h += '</div>';
    } else {
      h += '<div class="res-hint-banner">💡 Tapez un mot-clé (un geste, un thème, un poste) pour chercher dans toutes les ressources — ou parcourez ci-dessous.</div>';
      orderedNatures().forEach(type => {
        const sub = items.filter(r => r.type === type);
        if (sub.length === 0) return;
        const meta = natureMeta(type);
        h += `<div class="res-group-h" style="border-color:${meta.color}">
                <span class="res-group-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</span>
                <span class="res-group-title" style="color:${meta.color}">${escHtml(meta.label)}</span>
                <span class="res-group-count" style="background:${meta.bg};color:${meta.color}">${sub.length}</span>
              </div>`;
        h += '<div class="res-results">';
        sub.forEach(r => { h += makeResultCard(r); });
        h += '</div>';
      });
    }
    return h;
  }

  // ============================================================
  // 5. VUE PLAN (table des matières par nature)
  // ============================================================

  function orderedNatures() {
    return Object.keys(NATURES).sort((a, b) => NATURES[a].ordre - NATURES[b].ordre);
  }

  function renderPlan() {
    let h = '';
    orderedNatures().forEach(type => {
      const sub = RESSOURCES.filter(r => r.type === type);
      if (sub.length === 0) return;
      const meta = natureMeta(type);
      h += `
        <div class="res-plan-nat">
          <div class="res-plan-nat-h" onclick="this.parentElement.classList.toggle('open')" style="--nat-color:${meta.color}">
            <span class="res-plan-nat-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</span>
            <span class="res-plan-nat-title">${escHtml(meta.label)}</span>
            <span class="res-plan-nat-count" style="background:${meta.bg};color:${meta.color}">${sub.length}</span>
            <span class="res-plan-nat-chev">▾</span>
          </div>
          <div class="res-plan-nat-body">
      `;
      sub.forEach(r => {
        h += `
          <div class="res-plan-item" onclick="window.RessourcesBrowser.openModal(${r._idx})">
            <span class="res-plan-item-t">${escHtml(r.titre)}</span>
            <span class="res-plan-item-meta">${ageBadge(r)}${themesBadges(r)}</span>
          </div>
        `;
      });
      h += '</div></div>';
    });
    return h;
  }

  // ============================================================
  // 6. RENDER + DISPATCHER
  // ============================================================

  function render() {
    updateStats();
    const content = document.getElementById('content');
    if (!content) return;
    content.innerHTML = state.view === 'plan' ? renderPlan() : renderSearch();
  }

  // ============================================================
  // 7. MODALE — rendu ADAPTÉ PAR NATURE (D7)
  // ============================================================

  function liensFooter(res, entry) {
    // Liens : priorité au bundle (fileId médias réels), repli sur l'index.
    const files = (entry && entry.files) || {};
    const pdf  = files.pdf  || (res.liens && res.liens.pdf);
    const pptx = files.pptx || (res.liens && res.liens.pptx);
    const drive = res.fileId_dossier || (res.liens && res.liens.drive);
    const out = [];
    if (pdf)  out.push(`<a class="res-btn res-btn-sec" href="https://drive.google.com/file/d/${pdf}/view" target="_blank" rel="noopener">📄 PDF</a>`);
    if (pptx) out.push(`<a class="res-btn res-btn-sec" href="https://drive.google.com/file/d/${pptx}/view" target="_blank" rel="noopener">📊 PPTX</a>`);
    if (drive) out.push(`<a class="res-btn res-btn-pri" href="https://drive.google.com/drive/folders/${drive}" target="_blank" rel="noopener">📁 Ouvrir dans Drive</a>`);
    return out.join('');
  }

  // --- Gabarit FICHE TECHNIQUE : intro + clés étapées ---
  function renderFiche(concept) {
    let h = '';
    (concept.intro || []).forEach(b => {
      if (b.label) h += `<div class="res-m-lbl">${escHtml(b.label)}</div>`;
      (b.contenu || []).forEach(p => { h += `<p class="res-m-text">${escHtml(p)}</p>`; });
    });
    if ((concept.cles || []).length) {
      h += '<div class="res-m-lbl">Points clés</div><div class="res-cles">';
      concept.cles.forEach(k => {
        const lab = [k.etape, k.label].filter(Boolean).join(' · ');
        h += `<div class="res-cle">
                <div class="res-cle-lbl">${escHtml(lab || '')}</div>
                <div class="res-cle-c">${(k.contenu || []).map(x => `<span>${escHtml(x)}</span>`).join('')}</div>
              </div>`;
      });
      h += '</div>';
    }
    return h || '<p class="res-m-text">—</p>';
  }

  // --- Gabarit COMPORTEMENTS PAR POSTE : 2 colonnes attaque/défense + attributs + avis + vigilance ---
  function renderPoste(poste) {
    let h = '';
    if (poste.numeros) h += `<div class="res-poste-num">${escHtml(poste.numeros)}</div>`;

    const attrs = poste.attributs || {};
    const attrKeys = Object.keys(attrs);
    if (attrKeys.length) {
      h += '<div class="res-m-lbl">Profil</div><div class="res-attrs">';
      attrKeys.forEach(k => {
        h += `<div class="res-attr"><span class="res-attr-k">${escHtml(k)}</span><span class="res-attr-v">${escHtml(attrs[k])}</span></div>`;
      });
      h += '</div>';
    }

    const roles = poste.roles || {};
    if (roles.attaque || roles.defense) {
      h += '<div class="res-m-lbl">Rôles</div><div class="res-roles">';
      if (roles.attaque) h += `<div class="res-role res-role-att"><div class="res-role-h">⚔ Attaque</div><p>${escHtml(roles.attaque)}</p></div>`;
      if (roles.defense) h += `<div class="res-role res-role-def"><div class="res-role-h">🛡 Défense</div><p>${escHtml(roles.defense)}</p></div>`;
      h += '</div>';
    }

    if (poste.avis_coachs) {
      h += `<div class="res-m-lbl">Avis des coachs</div><div class="res-avis">${escHtml(poste.avis_coachs)}</div>`;
    }

    if ((poste.points_vigilance || []).length) {
      h += '<div class="res-m-lbl">Points de vigilance</div><div class="res-vigilance">';
      poste.points_vigilance.forEach(v => { h += `<span class="res-vig-chip">${escHtml(v)}</span>`; });
      h += '</div>';
    }
    return h || '<p class="res-m-text">—</p>';
  }

  // --- Gabarit RÉFÉRENTIEL CATÉGORIE : sections → sous-blocs → items ---
  function renderGrille(grille) {
    let h = '';
    if (grille.sous_titre) h += `<div class="res-grille-sub">${escHtml(grille.sous_titre)}</div>`;
    (grille.sections || []).forEach(s => {
      h += `<div class="res-section"><div class="res-section-h">${escHtml(s.titre || '')}</div>`;
      (s.sous_blocs || []).forEach(sb => {
        if (sb.nom) h += `<div class="res-sb-nom">${escHtml(sb.nom)}</div>`;
        if ((sb.items || []).length) {
          h += '<ul class="res-items">';
          sb.items.forEach(it => { h += `<li>${escHtml(it)}</li>`; });
          h += '</ul>';
        }
      });
      h += '</div>';
    });
    return h || '<p class="res-m-text">—</p>';
  }

  // --- Gabarit CARTE MENTALE : visuel PDF préservé (pas de reconstruction) + nœuds en appoint ---
  function renderCarte(carte, entry, res) {
    let h = '';
    const files = (entry && entry.files) || {};
    const pdf = files.pdf || (res.liens && res.liens.pdf);
    if (carte.centre) h += `<div class="res-carte-centre">Centre : <b>${escHtml(carte.centre)}</b></div>`;
    if (pdf) {
      h += `<div class="res-carte-visuel">
              <iframe src="https://drive.google.com/file/d/${pdf}/preview" allow="autoplay" loading="lazy"></iframe>
            </div>`;
    } else {
      h += '<div class="res-m-note">Visuel non disponible (bundle absent) — voir le dossier Drive.</div>';
    }
    if ((carte.noeuds || []).length) {
      h += '<div class="res-m-lbl">Nœuds</div><div class="res-noeuds">';
      carte.noeuds.forEach(n => { h += `<span class="res-noeud">${escHtml(n)}</span>`; });
      h += '</div>';
    }
    return h;
  }

  function openModal(idx) {
    const res = RESSOURCES[idx];
    if (!res) return;
    const meta = natureMeta(res.type);
    const entry = BUNDLE[res.fileId_dossier] || null;

    // Tête
    document.getElementById('m-pastille').textContent = meta.icon;
    document.getElementById('m-pastille').style.background = 'rgba(255,255,255,0.15)';
    document.getElementById('m-badge').textContent = meta.label;
    document.getElementById('m-title').textContent = res.titre;
    const subBits = [];
    if (res.etiquette_age) subBits.push(res.etiquette_age);
    (res.themes || []).forEach(t => subBits.push(t));
    document.getElementById('m-sub').textContent = subBits.join(' · ');

    // Corps : rendu par nature, OU mode dégradé si le bundle n'a pas l'entrée
    const body = document.getElementById('m-body-render');
    const degrade = document.getElementById('m-degrade');
    if (entry) {
      degrade.style.display = 'none';
      const bloc = entry[meta.bloc] || {};
      let html = '';
      switch (res.type) {
        case 'fiche_technique':       html = renderFiche(bloc); break;
        case 'comportements_poste':   html = renderPoste(bloc); break;
        case 'referentiel_categorie': html = renderGrille(bloc); break;
        case 'carte_mentale':         html = renderCarte(bloc, entry, res); break;
        default:                      html = '<p class="res-m-text">Type non reconnu.</p>';
      }
      body.innerHTML = html;
      body.style.display = '';
    } else {
      // Mode dégradé (D-robustesse) : titre + nature + thèmes + lien Drive seulement
      body.innerHTML = '';
      body.style.display = 'none';
      degrade.style.display = '';
    }

    // Pied : liens PDF / PPTX / Drive
    document.getElementById('m-foot').innerHTML = liensFooter(res, entry);

    document.getElementById('overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('overlay').classList.remove('open');
    // Stoppe un éventuel aperçu (carte mentale) en arrière-plan
    const body = document.getElementById('m-body-render');
    if (body) {
      const ifr = body.querySelector('iframe');
      if (ifr) ifr.src = '';
    }
  }

  // ============================================================
  // 8. ÉVÉNEMENTS
  // ============================================================

  function bindEvents() {
    document.querySelectorAll('[data-view]').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        state.view = b.dataset.view;
        render();
      };
    });

    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.oninput = e => {
        state.search = e.target.value;
        // Une recherche bascule automatiquement en vue Recherche
        if (state.view !== 'search' && e.target.value.trim()) {
          state.view = 'search';
          document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === 'search'));
        }
        render();
      };
    }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    const closeBtn = document.querySelector('.res-modal-close');
    if (closeBtn) closeBtn.onclick = closeModal;
    document.querySelectorAll('[data-modal-close]').forEach(b => { b.onclick = closeModal; });
  }

  // ============================================================
  // 9. API PUBLIQUE
  // ============================================================

  async function init() {
    try {
      await loadIndex();
      const bundlePromise = loadBundle();
      bindEvents();
      render();
      await bundlePromise;
      // Le bundle a enrichi le corpus : si une recherche est en cours, on re-render
      if (state.search.trim()) render();
    } catch (err) {
      console.error('Ressources : erreur d\'initialisation', err);
      const content = document.getElementById('content');
      if (content) {
        content.innerHTML = '<div class="res-empty res-empty-error">Impossible de charger les Ressources : ' + escHtml(err.message) + '</div>';
      }
    }
  }

  window.RessourcesBrowser = {
    init: init,
    openModal: openModal,
    closeModal: closeModal
  };

})();
