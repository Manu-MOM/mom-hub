/**
 * MOM Hub · Bibliothèque Browser
 * ============================================================
 * Logique du module Bibliothèque d'ateliers.
 *
 * Responsabilités :
 *   1. Charger data/ateliers.json (taxonomie) et data/fiches-all.json (détails pédagogiques)
 *   2. Rendre la vue "Cartes" (grille de cartes regroupées par rubrique)
 *   3. Rendre la vue "Plan" (arborescence accordéon rubrique → sous-rubrique → ateliers)
 *   4. Gérer la modal détail atelier (vidéo embed Drive, pédagogie, ressources)
 *   5. Gérer les filtres : âge, famille (tactique/technique/physique), type (fiches/vidéos), recherche
 *
 * Architecture :
 *   - Module IIFE exposant window.BibliothequeBrowser.init()
 *   - Adapté de la maquette v6 (conv Modules Ateliers, 14 mai 2026)
 *   - Adopte le design system MOM Hub (couleurs sémantiques par rubrique conservées
 *     car utiles à la distinction visuelle des 4 grandes familles)
 *
 * Dépendances DOM attendues (cf. bibliotheque.html) :
 *   #content                                  → zone principale (vue Cartes ou Plan)
 *   #stat-fiches, #stat-videos, #stat-age     → compteurs de la bannière
 *   #age-display                               → texte "Affichage : ..."
 *   #search                                    → champ de recherche
 *   [data-age], [data-fam], [data-vid]         → boutons filtres
 *   [data-view]                                → boutons vue Cartes / Plan
 *   #overlay                                   → modal overlay
 *   #m-* (multiples)                           → éléments de la modal
 *
 * Version : 1.0 — première intégration MOM Hub (14 mai 2026)
 */

(function () {
  'use strict';

  // ============================================================
  // 1. ÉTAT INTERNE DU MODULE
  // ============================================================

  let RUBRIQUES = [];                                // depuis data/ateliers.json
  let ATELIERS  = [];                                // ateliers_flat depuis data/ateliers.json
  let FICHES    = {};                                // détails depuis data/fiches-all.json
  let FICHES_LOADED = false;                         // flag : fiches chargées ou pas

  const AGE_LABELS = {
    M6:     'M6 (4-5 ans)',
    M8:     'M8 (6-7 ans)',
    M10:    'M10 (8-9 ans)',
    M12:    'M12 (10-11 ans)',
    M14F15: 'M14/F15 (12-13 ans)',
    M16:    'M16 (14-15 ans)',
    M18:    'M18 (16-17 ans)',
    SENF:   'Seniors F',
    SENM:   'Seniors M'
  };

  // Couleurs sémantiques par rubrique (conservées de la v6 pour la distinction visuelle).
  // Le reste du design adopte les variables MOM Hub définies dans css/hub.css.
  const RUB_COLORS = { oc: '#0f4f28', ti: '#4a1a7a', ap: '#5a3a00', jp: '#1a3a7a' };
  const RUB_BG     = { oc: '#edf9f2', ti: '#f0e8ff', ap: '#fdf3d0', jp: '#ddeaff' };

  const state = { age: 'all', fam: 'all', vid: 'all', view: 'cards', search: '' };

  // ============================================================
  // 2. CHARGEMENT DES DONNÉES
  // ============================================================

  async function loadAteliers() {
    const r = await fetch('data/ateliers.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('data/ateliers.json introuvable (HTTP ' + r.status + ')');
    const data = await r.json();
    RUBRIQUES = data.rubriques || [];
    ATELIERS  = data.ateliers_flat || [];
    // _idx attribué pour réutilisation dans openModal()
    ATELIERS.forEach((a, i) => { a._idx = i; });
  }

  async function loadFiches() {
    try {
      const r = await fetch('data/fiches-all.json', { cache: 'no-cache' });
      if (r.ok) {
        FICHES = await r.json();
        FICHES_LOADED = true;
        console.log('Bibliothèque : fiches-all.json chargé (' + Object.keys(FICHES).length + ' fiches)');
      } else {
        console.warn('Bibliothèque : fiches-all.json absent (' + r.status + ') — modal en mode dégradé');
      }
    } catch (e) {
      console.warn('Bibliothèque : fiches-all.json non chargé : ' + e.message);
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

  function pass(a) {
    if (state.age !== 'all' && a.ages.indexOf(state.age) === -1) return false;
    if (state.fam !== 'all' && a.famille !== state.fam) return false;
    if (state.vid === 'videos' && !a.video) return false;
    if (state.vid === 'fiches' && a.video) return false;
    if (state.search) {
      const s = state.search.toLowerCase();
      if (a.t.toLowerCase().indexOf(s) === -1 && (a.s || '').toLowerCase().indexOf(s) === -1) return false;
    }
    return true;
  }

  function rubHasNoItems(rub) {
    // Rubrique "À venir" si toutes ses sous-rubriques marquent .soon
    return rub.subs.every(sub => sub.soon || (sub.ss || []).every(ss => ss.soon));
  }

  function findRubData(rubId) { return RUBRIQUES.find(r => r.id === rubId); }
  function findSubData(rubId, subId) {
    const r = findRubData(rubId);
    return r && r.subs.find(s => s.id === subId);
  }

  function updateStats() {
    const items = ATELIERS.filter(pass);
    const seen = new Set();
    let fiches = 0, videos = 0;
    items.forEach(a => {
      const key = a.id || (a.rub_id + '|' + a.sub_id + '|' + a.t);
      if (!seen.has(key)) {
        seen.add(key);
        if (a.video) videos++; else fiches++;
      }
    });
    document.getElementById('stat-fiches').textContent = fiches;
    document.getElementById('stat-videos').textContent = videos;
    document.getElementById('stat-age').textContent = state.age === 'all' ? 'Tous' : state.age;

    const ageEl = document.getElementById('age-display');
    if (ageEl) {
      ageEl.textContent = state.age === 'all'
        ? '🎯 Affichage : Toutes catégories'
        : '🎯 Affichage : ' + (AGE_LABELS[state.age] || state.age);
    }
  }

  // ============================================================
  // 4. VUE CARTES
  // ============================================================

  function makeCard(a) {
    const ageChips = a.ages.map(x => `<span class="age-chip ${state.age === x ? 'on' : ''}">${x}</span>`).join('');
    const isVideo = a.video;
    const subData = findSubData(a.rub_id, a.sub_id) || {};
    const pastilleColor = isVideo ? '#c53a22' : (subData.badge || '#c4efd4');
    const pastilleText  = isVideo ? '#fff'    : (subData.badgeText || '#0a3a1e');
    const pastilleIcon  = isVideo ? '▶'        : (subData.icon || '');
    const topColor      = isVideo ? '#c53a22' : (subData.color || '#0a3a1e');
    const famTag        = a.famille ? `<span class="tag fam-${a.famille}">${a.famille}</span>` : '';
    const crossTag      = a.cross   ? `<span class="tag cross">aussi : ${escHtml(a.cross)}</span>` : '';
    const customTags    = (a.tags || []).map(t => `<span class="tag">${escHtml(t)}</span>`).join('');

    return `
      <div class="biblio-card" onclick="window.BibliothequeBrowser.openModal(${a._idx})" style="border-top-color:${topColor}">
        <div class="biblio-card-top">
          <div class="pastille md" style="background:${pastilleColor};color:${pastilleText}">${pastilleIcon}</div>
          <div class="biblio-card-top-info">
            <div class="biblio-card-num">${escHtml(a.n)}</div>
            <div class="biblio-card-sub-label">${escHtml(a.sub_label)}</div>
          </div>
        </div>
        <div class="biblio-card-body">
          <div class="biblio-card-title">${escHtml(a.t)}</div>
          <div class="biblio-card-desc">${escHtml(a.s || '')}</div>
          <div class="biblio-card-tags">${famTag}${customTags}${crossTag}</div>
          <div class="biblio-card-ages">${ageChips}</div>
        </div>
      </div>
    `;
  }

  function renderCards() {
    const items = ATELIERS.filter(pass);
    const rubsPlaceholder = RUBRIQUES.filter(rubHasNoItems);

    // Si aucun résultat ET aucune rubrique placeholder → message vide
    if (items.length === 0 && rubsPlaceholder.length === 0) {
      return '<div class="biblio-empty">Aucun atelier ne correspond aux filtres.</div>';
    }

    const byRub = {};
    items.forEach(a => {
      if (!byRub[a.rub_id]) byRub[a.rub_id] = [];
      byRub[a.rub_id].push(a);
    });

    let h = '';
    let first = true;
    RUBRIQUES.forEach(rub => {
      const rubItems = byRub[rub.id] || [];
      const isPlaceholder = rubHasNoItems(rub);
      if (rubItems.length === 0 && !isPlaceholder) return;

      const color = RUB_COLORS[rub.id] || '#0f4f28';
      const bg    = RUB_BG[rub.id]     || '#edf9f2';
      h += `
        <div class="biblio-rub-h" style="border-color:${color}">
          <div class="pastille lg" style="background:${color};color:#fff">${rub.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="biblio-rub-h-num" style="color:${color}">Rubrique ${escHtml(rub.num)}</div>
            <div class="biblio-rub-h-title" style="color:${color}">${escHtml(rub.label)}</div>
            <div class="biblio-rub-h-desc">${escHtml(rub.desc || '')}</div>
          </div>
          <div class="biblio-rub-h-count" style="background:${bg};color:${color}">${rubItems.length} ${rubItems.length > 1 ? 'ateliers' : 'atelier'}</div>
        </div>
      `;

      if (isPlaceholder) {
        h += '<div class="rub-soon-body">';
        rub.subs.forEach(sub => {
          h += `
            <div class="rub-soon-sub">
              <div style="flex:1">
                <div class="rub-soon-sub-title">${escHtml(sub.label)}</div>
                <div class="rub-soon-sub-sub">${escHtml(sub.sub || '')}</div>
              </div>
              <span class="rub-soon-badge">Bientôt</span>
            </div>
          `;
        });
        h += '</div>';
      } else {
        h += '<div class="biblio-cards-grid">';
        rubItems.forEach(a => { h += makeCard(a); });
        h += '</div>';
      }

      first = false;
    });

    return h;
  }

  // ============================================================
  // 5. VUE PLAN (accordéon)
  // ============================================================

  function renderPlan() {
    const items = ATELIERS.filter(pass);

    let h = '';
    RUBRIQUES.forEach(rub => {
      const rubItems = items.filter(a => a.rub_id === rub.id);
      const isPlaceholder = rubHasNoItems(rub);
      if (rubItems.length === 0 && !isPlaceholder) return;

      const color = RUB_COLORS[rub.id] || '#0f4f28';
      const bg    = RUB_BG[rub.id]     || '#edf9f2';

      h += `
        <div class="plan-rub">
          <div class="plan-rub-h" onclick="this.parentElement.classList.toggle('open')" style="--rub-color:${color}">
            <div class="pastille md" style="background:${color};color:#fff">${rub.icon}</div>
            <div class="plan-rub-h-l">
              <div class="plan-rub-h-num" style="color:${color}">Rubrique ${escHtml(rub.num)}</div>
              <div class="plan-rub-h-title">${escHtml(rub.label)}</div>
              <div class="plan-rub-h-desc">${escHtml(rub.desc || '')}</div>
            </div>
            <div class="plan-rub-h-count" style="background:${bg};color:${color}">${isPlaceholder ? 'Bientôt' : rubItems.length}</div>
            <span class="plan-rub-h-chev">▾</span>
          </div>
          <div class="plan-rub-body">
      `;

      if (isPlaceholder) {
        rub.subs.forEach(sub => {
          h += `
            <div class="plan-sub plan-sub-placeholder">
              <div class="plan-sub-h">
                <span class="plan-sub-icon">${escHtml(sub.icon || '')}</span>
                <span class="plan-sub-title">${escHtml(sub.label)}</span>
                <span class="rub-soon-badge">Bientôt</span>
              </div>
            </div>
          `;
        });
      } else {
        const visibleSubs = rub.subs.filter(s => !s.soon && rubItems.some(a => a.sub_id === s.id));
        const autoOpen = visibleSubs.length === 1;
        visibleSubs.forEach(sub => {
          const subItems = rubItems.filter(a => a.sub_id === sub.id);
          const subColor = sub.color || color;
          const subBadge = sub.badge || bg;
          const subBadgeText = sub.badgeText || color;
          h += `
            <div class="plan-sub${autoOpen ? ' open' : ''}">
              <div class="plan-sub-h" onclick="this.parentElement.classList.toggle('open')">
                <span class="plan-sub-icon" style="background:${subBadge};color:${subBadgeText}">${escHtml(sub.icon || '')}</span>
                <span class="plan-sub-title">${escHtml(sub.label)}</span>
                <span class="plan-sub-sub">${escHtml(sub.sub || '')}</span>
                <span class="plan-sub-count">${subItems.length}</span>
                <span class="plan-sub-chev">▾</span>
              </div>
              <div class="plan-sub-body">
          `;

          const visibleSS = (sub.ss || []).filter(ss => !ss.soon && subItems.some(a => a.ss_id === ss.id));
          if (visibleSS.length === 0) {
            // Pas de sous-sous-rubriques : on liste les items directement
            subItems.forEach(a => {
              const ic = a.video ? '<div class="plan-item-icon">▶</div>' : '';
              const cr = a.cross ? `<span class="plan-item-cross">↔ ${escHtml(a.cross)}</span>` : '';
              const pastBg = a.video ? '#fff0ed' : subBadge;
              const pastFg = a.video ? '#c53a22' : subBadgeText;
              h += `
                <div class="plan-item" onclick="window.BibliothequeBrowser.openModal(${a._idx})">
                  <div class="plan-item-pastille" style="background:${pastBg};color:${pastFg}">${escHtml(a.n)}</div>
                  <span class="plan-item-t">${escHtml(a.t)}</span>
                  <div class="plan-item-meta">${cr}${ic}</div>
                </div>
              `;
            });
          } else {
            visibleSS.forEach(ss => {
              const ssItems = subItems.filter(a => a.ss_id === ss.id);
              h += `<div class="plan-ss"><div class="plan-ss-title">${escHtml(ss.label)}</div>`;
              ssItems.forEach(a => {
                const ic = a.video ? '<div class="plan-item-icon">▶</div>' : '';
                const cr = a.cross ? `<span class="plan-item-cross">↔ ${escHtml(a.cross)}</span>` : '';
                const pastBg = a.video ? '#fff0ed' : subBadge;
                const pastFg = a.video ? '#c53a22' : subBadgeText;
                h += `
                  <div class="plan-item" onclick="window.BibliothequeBrowser.openModal(${a._idx})">
                    <div class="plan-item-pastille" style="background:${pastBg};color:${pastFg}">${escHtml(a.n)}</div>
                    <span class="plan-item-t">${escHtml(a.t)}</span>
                    <div class="plan-item-meta">${cr}${ic}</div>
                  </div>
                `;
              });
              h += '</div>';
            });
          }

          h += '</div></div>';
        });
      }

      h += '</div></div>';
    });

    return h;
  }

  // ============================================================
  // 6. RENDER + DISPATCHER
  // ============================================================

  function render() {
    updateStats();
    document.getElementById('content').innerHTML = state.view === 'cards' ? renderCards() : renderPlan();
  }

  // ============================================================
  // 7. MODAL
  // ============================================================

  function showText(secId, textId, txt) {
    const sec = document.getElementById(secId);
    const el  = document.getElementById(textId);
    if (txt && String(txt).trim()) {
      sec.style.display = '';
      el.textContent = txt;
    } else {
      sec.style.display = 'none';
    }
  }

  function showList(secId, listId, items) {
    const sec = document.getElementById(secId);
    const el  = document.getElementById(listId);
    if (items && items.length) {
      sec.style.display = '';
      el.innerHTML = items.map(i => `<li>${escHtml(i)}</li>`).join('');
    } else {
      sec.style.display = 'none';
    }
  }

  function openModal(idx) {
    const a = ATELIERS[idx];
    if (!a) return;
    const subData = findSubData(a.rub_id, a.sub_id) || {};
    const fiche   = FICHES[a.id] || null;

    // === Head ===
    document.getElementById('m-pastille').textContent = a.video ? '▶' : (subData.icon || '');
    document.getElementById('m-badge').textContent    = a.rub_label;

    const ficheTitre = fiche && fiche.cartouche && fiche.cartouche.titre;
    const displayTitle = ficheTitre || a.t;
    document.getElementById('m-title').textContent = displayTitle;
    document.getElementById('m-sub').textContent   = a.sub_label + (a.ss_label ? ' — ' + a.ss_label : '');

    const origNom = fiche && fiche.source && fiche.source.nom_fiche;
    if (origNom && origNom !== displayTitle) {
      document.getElementById('m-orig').style.display = '';
      document.getElementById('m-orig-name').textContent = origNom;
    } else {
      document.getElementById('m-orig').style.display = 'none';
    }

    // === Body ===
    showText('m-desc-sec', 'm-desc', a.s);

    // Cartouche meta
    const metaChips = [];
    if (fiche && fiche.cartouche) {
      const c = fiche.cartouche;
      if (c.duree)            metaChips.push(`<span class="m-chip-meta">⏱ ${escHtml(c.duree)}</span>`);
      if (c.format)           metaChips.push(`<span class="m-chip-meta">🎯 ${escHtml(c.format)}</span>`);
      if (c.niveau)           metaChips.push(`<span class="m-chip-meta">📊 ${escHtml(c.niveau)}</span>`);
      if (c.effectif)         metaChips.push(`<span class="m-chip-meta">👥 ${escHtml(c.effectif)}</span>`);
      if (c.rapport_de_force) metaChips.push(`<span class="m-chip-meta">⚔ ${escHtml(c.rapport_de_force)}</span>`);
      if (c.materiel)         metaChips.push(`<span class="m-chip-meta">🎒 ${escHtml(c.materiel)}</span>`);
      if (c.theme)            metaChips.push(`<span class="m-chip-meta m-chip-meta-theme"><b>Thème :</b> ${escHtml(c.theme)}</span>`);
    }
    if (metaChips.length) {
      document.getElementById('m-meta-sec').style.display = '';
      document.getElementById('m-meta').innerHTML = metaChips.join('');
    } else {
      document.getElementById('m-meta-sec').style.display = 'none';
    }

    // Ages
    document.getElementById('m-ages').innerHTML = a.ages.map(x => `<span class="m-chip">${AGE_LABELS[x] || x}</span>`).join('');

    // Tags transverses
    const tagsAll = [];
    if (a.famille) tagsAll.push(`<span class="m-chip m-chip-fam">Famille : ${escHtml(a.famille)}</span>`);
    (a.tags || []).forEach(t => tagsAll.push(`<span class="m-chip m-chip-tag">${escHtml(t)}</span>`));
    if (a.video) tagsAll.push(`<span class="m-chip m-chip-video">▶ Vidéo</span>`);
    if (tagsAll.length) {
      document.getElementById('m-tags-sec').style.display = '';
      document.getElementById('m-tags').innerHTML = tagsAll.join('');
    } else {
      document.getElementById('m-tags-sec').style.display = 'none';
    }

    // Renvoi croisé
    if (a.cross) {
      document.getElementById('m-cross-sec').style.display = '';
      document.getElementById('m-cross').textContent = a.cross;
    } else {
      document.getElementById('m-cross-sec').style.display = 'none';
    }

    // === Vidéo principale (depuis files.videos) ===
    const videos = (fiche && fiche.files && fiche.files.videos) || [];
    const vSec    = document.getElementById('m-video-sec');
    const vFrame  = document.getElementById('m-video-frame');
    const vExtras = document.getElementById('m-video-extras');
    if (videos.length > 0) {
      vSec.style.display = '';
      vFrame.src = `https://drive.google.com/file/d/${videos[0]}/preview`;
      if (videos.length > 1) {
        vExtras.innerHTML = videos.slice(1).map((vid, i) =>
          `<a class="m-video-btn" href="https://drive.google.com/file/d/${vid}/view" target="_blank" rel="noopener">▶ Vidéo ${i + 2}</a>`
        ).join('');
      } else {
        vExtras.innerHTML = '';
      }
    } else {
      vSec.style.display = 'none';
      vFrame.src = '';
      vExtras.innerHTML = '';
    }

    // === Pédagogie ===
    const pedaSecs = ['m-objectifs-sec', 'm-but-sec', 'm-lancement-sec', 'm-consignes-sec', 'm-critere-sec', 'm-compatt-sec', 'm-variantes-sec'];
    if (fiche && fiche.pedagogie) {
      const p = fiche.pedagogie;
      showList('m-objectifs-sec', 'm-objectifs', p.objectifs);
      showText('m-but-sec', 'm-but', p.but);
      showText('m-lancement-sec', 'm-lancement', p.lancement);
      showList('m-consignes-sec', 'm-consignes', p.consignes);
      showList('m-critere-sec', 'm-critere', p.critere_reussite || p.criteres_reussite); // tolère singulier (Converter v3.2) ET pluriel (v2.0)
      showList('m-compatt-sec', 'm-compatt', p.comportements_attendus);
      const v = p.variantes || {};
      const hasAnyVar = (v.plus && v.plus.trim()) || (v.moins && v.moins.trim()) || (v.progression && v.progression.trim());
      document.getElementById('m-variantes-sec').style.display = hasAnyVar ? '' : 'none';
      showText('m-var-plus-row', 'm-var-plus', v.plus);
      showText('m-var-moins-row', 'm-var-moins', v.moins);
      showText('m-var-progression-row', 'm-var-progression', v.progression);
    } else {
      pedaSecs.forEach(id => { document.getElementById(id).style.display = 'none'; });
    }

    // Avertissement fiche manquante
    document.getElementById('m-fiche-missing-sec').style.display = (FICHES_LOADED || fiche) ? 'none' : '';

    // Compétences de la sous-rubrique parent
    if (a.sub_comp && a.sub_comp.length) {
      document.getElementById('m-comp-sec').style.display = '';
      document.getElementById('m-comp').innerHTML = a.sub_comp.map(c => `<span class="m-chip">${escHtml(c)}</span>`).join('');
    } else {
      document.getElementById('m-comp-sec').style.display = 'none';
    }

    // === Ressources Drive (boutons) ===
    const resHtml = [];
    if (fiche && fiche.files) {
      const f = fiche.files;
      if (f.fiche_pdf_id)          resHtml.push(`<a class="m-res-btn" href="https://drive.google.com/file/d/${f.fiche_pdf_id}/view" target="_blank" rel="noopener">📄 Fiche PDF</a>`);
      if (f.fiche_pptx_id)         resHtml.push(`<a class="m-res-btn" href="https://drive.google.com/file/d/${f.fiche_pptx_id}/view" target="_blank" rel="noopener">📊 PPTX nettoyé</a>`);
      if (f.fiche_origine_pptx_id) resHtml.push(`<a class="m-res-btn" href="https://drive.google.com/file/d/${f.fiche_origine_pptx_id}/view" target="_blank" rel="noopener">📊 PPTX original</a>`);
    }
    resHtml.push(`<a class="m-res-btn" href="https://drive.google.com/drive/folders/${a.id}" target="_blank" rel="noopener">📁 Dossier Drive</a>`);
    document.getElementById('m-resources').innerHTML = resHtml.join('');

    // Bouton footer "Ouvrir dans Drive"
    document.getElementById('m-open-drive').onclick = () => window.open(`https://drive.google.com/drive/folders/${a.id}`, '_blank');

    document.getElementById('overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('overlay').classList.remove('open');
    // Stopper la lecture vidéo (sinon elle continue en arrière-plan)
    const vf = document.getElementById('m-video-frame');
    if (vf) vf.src = '';
  }

  // ============================================================
  // 8. ÉVÉNEMENTS
  // ============================================================

  function bindEvents() {
    document.querySelectorAll('[data-age]').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('[data-age]').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        state.age = b.dataset.age;
        render();
      };
    });
    document.querySelectorAll('[data-fam]').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('[data-fam]').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        state.fam = b.dataset.fam;
        render();
      };
    });
    document.querySelectorAll('[data-vid]').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('[data-vid]').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        state.vid = b.dataset.vid;
        render();
      };
    });
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
      searchInput.oninput = e => { state.search = e.target.value; render(); };
    }

    // Modal close handlers
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    const overlay = document.getElementById('overlay');
    if (overlay) {
      overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    }
    const closeBtn = document.querySelector('.biblio-modal-close');
    if (closeBtn) closeBtn.onclick = closeModal;

    // Footer modal buttons
    document.querySelectorAll('[data-modal-close]').forEach(b => { b.onclick = closeModal; });
    const addSeance = document.getElementById('m-add-seance');
    if (addSeance) addSeance.onclick = () => alert('Module Préparation de séance — à venir.');
  }

  // ============================================================
  // 9. API PUBLIQUE
  // ============================================================

  async function init() {
    try {
      // Charge la taxonomie d'abord (bloquant), puis les fiches détaillées en parallèle au rendu
      await loadAteliers();
      // Lance le fetch des fiches en arrière-plan
      const fichesPromise = loadFiches();
      // Premier rendu (sans fiches détaillées si pas encore chargées — modal en mode dégradé)
      bindEvents();
      render();
      // Quand les fiches arrivent, re-render pour les badges de comptage (pas obligatoire mais propre)
      await fichesPromise;
    } catch (err) {
      console.error('Bibliothèque : erreur d\'initialisation', err);
      const content = document.getElementById('content');
      if (content) {
        content.innerHTML = '<div class="biblio-empty biblio-empty-error">Impossible de charger la Bibliothèque : ' + escHtml(err.message) + '</div>';
      }
    }
  }

  window.BibliothequeBrowser = {
    init: init,
    openModal: openModal,
    closeModal: closeModal
  };

})();
