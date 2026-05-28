/**
 * MOM Hub · Administration des sites (ADMIN-(ii) sous-chantier 4)
 * ================================================================
 *
 * Contrôleur de admin-sites.html. Doc FAIT FOI
 * Conception-UX-ADMIN-ii-v1.md (md5 ca043a48) §3.2 (Sites). Données
 * via SupabaseHub v1.32 (wrappers ADMIN-(ii) Sites : listSites,
 * createSite, updateSite, setSiteActif).
 *
 * Principes (doctrine P1 simplicité) :
 *  - Liste PLATE triée par libellé (α : pas d'arborescence ; pas de
 *    regroupement domicile/extérieur, club_principal_id NULL sur
 *    toutes les données réelles → distinction non portée, on ne
 *    l'invente pas).
 *  - Modale unique création/édition : 3 essentiels (nom, ville, type)
 *    + Compléments dépliables (nom court, adresse, CP, capacité, GPS
 *    en 1 champ « lat, lng » facultatif, notes).
 *  - `code` non saisi (auto-dérivé par createSite) ; `pays` défaut
 *    DB ; `actif` toggle en édition (jamais de suppression dure :
 *    bascule du booléen via setSiteActif).
 *  - Garde UI admin-strict (D2) — la page refuse déjà les non-admins
 *    (cf. admin-sites.html). La RLS base est has_role('admin') SEUL
 *    sur sites (aligné, pas de filet permissif ici contrairement à
 *    equipes admin|coach).
 *  - NB périmètre : evenements-browser.js v1.26 lit DÉJÀ les sites
 *    via listSitesActifs (dropdown évènement) — NON touché.
 *
 * Version : 1.0 — 28/05/2026 (Production ADMIN-(ii), pt 22→23).
 */
(function (global) {
  'use strict';

  const Hub = global.SupabaseHub;
  const $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function strOrUndef(v) {
    const t = (v == null ? '' : String(v)).trim();
    return t === '' ? undefined : t;
  }
  function numOrUndef(v) {
    if (v === '' || v == null) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }

  const State = {
    isAdmin: false,
    sites: [],
    siteCtx: null   // { mode: 'create'|'edit', site? }
  };

  // ----------------------------------------------------------------
  // GPS — un seul champ « lat, lng ». Parse robuste ; renvoie
  // { lat, lng } si valide, null si vide, false si malformé.
  // ----------------------------------------------------------------
  function parseGps(raw) {
    const t = (raw == null ? '' : String(raw)).trim();
    if (t === '') return null;
    const parts = t.split(',');
    if (parts.length !== 2) return false;
    const lat = Number(parts[0].trim());
    const lng = Number(parts[1].trim());
    if (!isFinite(lat) || !isFinite(lng)) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return { lat: lat, lng: lng };
  }
  function formatGps(site) {
    if (site && site.latitude != null && site.longitude != null) {
      return site.latitude + ', ' + site.longitude;
    }
    return '';
  }

  function typeLabel(t) {
    const v = (t == null ? '' : String(t)).trim();
    return v === '' ? 'site' : v;
  }

  // ----------------------------------------------------------------
  // RENDU — liste plate
  // ----------------------------------------------------------------
  function renderList() {
    const ul = $('as-list');
    const count = $('as-count');
    const sites = State.sites;

    if (!sites.length) {
      ul.style.display = 'none';
      count.textContent = '';
      // message vide rendu hors <ul> pour rester sémantique
      let empty = $('as-empty');
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'as-empty';
        empty.className = 'as-empty';
        ul.parentNode.insertBefore(empty, ul.nextSibling);
      }
      empty.textContent = 'Aucun site enregistré pour le moment.';
      empty.style.display = 'block';
      return;
    }

    const existingEmpty = $('as-empty');
    if (existingEmpty) existingEmpty.style.display = 'none';

    const nbActifs = sites.filter(function (s) { return s.actif; }).length;
    count.textContent = sites.length + ' site' + (sites.length > 1 ? 's' : '') +
      ' · ' + nbActifs + ' actif' + (nbActifs > 1 ? 's' : '');

    ul.innerHTML = sites.map(function (s) {
      const nom = s.libelle || s.libelle_court || s.code || '(sans nom)';
      const metaBits = [];
      if (s.ville) metaBits.push(esc(s.ville));
      if (s.code_postal) metaBits.push(esc(s.code_postal));
      const meta = metaBits.join(' · ');
      const typeB = '<span class="as-type-badge">' + esc(typeLabel(s.type_site)) + '</span>';
      const inactiveB = s.actif ? '' : '<span class="as-inactive-badge">Inactif</span>';
      return '' +
        '<li class="as-item' + (s.actif ? '' : ' as-item--inactive') + '" ' +
        'data-action="open-site-edit" data-site="' + esc(s.id) + '" ' +
        'role="button" tabindex="0">' +
          '<div class="as-item-main">' +
            '<span class="as-item-nom">' + esc(nom) + '</span>' +
            (meta ? '<span class="as-item-meta">' + meta + '</span>' : '') +
          '</div>' +
          inactiveB +
          typeB +
        '</li>';
    }).join('');
    ul.style.display = 'flex';
  }

  // ----------------------------------------------------------------
  // MODALE
  // ----------------------------------------------------------------
  function openModal(id) { $(id).classList.add('is-open'); }
  function closeModal(id) { $(id).classList.remove('is-open'); }

  function setSiteError(msg) {
    const el = $('as-site-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg; el.style.display = 'block';
  }

  function fillSiteForm(site) {
    $('as-site-nom').value = (site && site.libelle) || '';
    $('as-site-ville').value = (site && site.ville) || '';
    $('as-site-type').value = (site && site.type_site) || '';
    $('as-site-libelle-court').value = (site && site.libelle_court) || '';
    $('as-site-adresse').value = (site && site.adresse) || '';
    $('as-site-cp').value = (site && site.code_postal) || '';
    $('as-site-capacite').value = (site && site.capacite_estimee != null) ? site.capacite_estimee : '';
    $('as-site-gps').value = formatGps(site);
    $('as-site-notes').value = (site && site.notes) || '';
  }

  function findSite(siteId) {
    return State.sites.find(function (s) { return s.id === siteId; }) || null;
  }

  function openSiteCreate() {
    State.siteCtx = { mode: 'create', site: null };
    setSiteError('');
    $('as-site-modal-title').textContent = 'Nouveau site';
    fillSiteForm(null);
    $('as-site-complements').open = false;
    $('as-site-statut-toggle').style.display = 'none';
    openModal('as-modal-site');
    $('as-site-nom').focus();
  }

  function openSiteEdit(siteId) {
    const site = findSite(siteId);
    if (!site) return;
    State.siteCtx = { mode: 'edit', site: site };
    setSiteError('');
    $('as-site-modal-title').textContent = 'Modifier — ' + (site.libelle || site.code || 'site');
    fillSiteForm(site);
    $('as-site-complements').open = false;
    const toggle = $('as-site-statut-toggle');
    toggle.style.display = '';
    toggle.textContent = site.actif ? 'Désactiver' : 'Réactiver';
    openModal('as-modal-site');
  }

  // NB v1 (parité admin-equipes) : un champ complément vidé n'est PAS
  // remis à null en édition (undefined = on ne touche pas la colonne).
  function collectSitePayload() {
    return {
      libelle: strOrUndef($('as-site-nom').value),
      ville: strOrUndef($('as-site-ville').value),
      type_site: strOrUndef($('as-site-type').value),
      libelle_court: strOrUndef($('as-site-libelle-court').value),
      adresse: strOrUndef($('as-site-adresse').value),
      code_postal: strOrUndef($('as-site-cp').value),
      capacite_estimee: numOrUndef($('as-site-capacite').value)
    };
  }

  async function saveSite() {
    const ctx = State.siteCtx;
    if (!ctx) return;
    setSiteError('');
    const btn = $('as-site-save');
    btn.disabled = true;
    try {
      const payload = collectSitePayload();
      if (!payload.libelle) { setSiteError('Le nom du site est requis.'); return; }

      // GPS : un seul champ « lat, lng ».
      const gps = parseGps($('as-site-gps').value);
      if (gps === false) {
        setSiteError('GPS invalide. Format attendu : « latitude, longitude » (ex. 48.5421, 7.4567).');
        return;
      }
      if (gps) { payload.latitude = gps.lat; payload.longitude = gps.lng; }

      let res;
      if (ctx.mode === 'create') {
        res = await Hub.createSite(payload);
      } else {
        res = await Hub.updateSite(ctx.site.id, payload);
      }
      if (!res || !res.ok) { setSiteError((res && res.error) || 'Échec de l\u2019enregistrement.'); return; }
      closeModal('as-modal-site');
      await refresh();
    } catch (e) {
      console.error('AdminSites.saveSite()', e);
      setSiteError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
    }
  }

  async function toggleActifSite() {
    const ctx = State.siteCtx;
    if (!ctx || ctx.mode !== 'edit' || !ctx.site) return;
    const btn = $('as-site-statut-toggle');
    btn.disabled = true;
    const wasActive = !!ctx.site.actif;
    try {
      const res = await Hub.setSiteActif(ctx.site.id, !wasActive);
      if (!res || !res.ok) { setSiteError((res && res.error) || 'Échec du changement de statut.'); return; }
      closeModal('as-modal-site');
      await refresh();
    } catch (e) {
      console.error('AdminSites.toggleActifSite()', e);
      setSiteError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
    }
  }

  // ----------------------------------------------------------------
  // ERREUR PAGE / REFRESH / EVENTS
  // ----------------------------------------------------------------
  function showError(msg) {
    const el = $('as-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg; el.style.display = 'block';
  }

  async function refresh() {
    const sites = await Hub.listSites();
    State.sites = Array.isArray(sites) ? sites : [];
    renderList();
  }

  function bindEvents() {
    $('as-new').addEventListener('click', openSiteCreate);

    // délégation sur la liste (clic + clavier Enter/Espace)
    const list = $('as-list');
    list.addEventListener('click', function (e) {
      const t = e.target.closest('[data-action="open-site-edit"]');
      if (!t) return;
      openSiteEdit(t.getAttribute('data-site'));
    });
    list.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = e.target.closest('[data-action="open-site-edit"]');
      if (!t) return;
      e.preventDefault();
      openSiteEdit(t.getAttribute('data-site'));
    });

    // modale site
    $('as-site-save').addEventListener('click', saveSite);
    $('as-site-cancel').addEventListener('click', function () { closeModal('as-modal-site'); });
    $('as-site-close').addEventListener('click', function () { closeModal('as-modal-site'); });
    $('as-site-statut-toggle').addEventListener('click', toggleActifSite);

    // fermer la modale en cliquant le voile
    $('as-modal-site').addEventListener('click', function (e) {
      if (e.target === this) closeModal('as-modal-site');
    });
  }

  // ----------------------------------------------------------------
  // INIT
  // ----------------------------------------------------------------
  async function init(opts) {
    State.isAdmin = !!(opts && opts.isAdmin);
    $('as-badge').textContent = '🔒 Mode admin';

    try {
      bindEvents();
      await refresh();
    } catch (e) {
      console.error('AdminSites.init()', e);
      showError('Erreur d\u2019initialisation : ' + (e && e.message ? e.message : e));
    }
  }

  global.AdminSites = { init: init };

  console.log('%c🏉 MOM Hub · admin-sites.js v1.0 chargé', 'color: #2D7D46; font-weight: bold;');

})(typeof window !== 'undefined' ? window : globalThis);
