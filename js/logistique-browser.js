/**
 * MOM Hub · Logistique — Browser (logistique.html)
 * ================================================
 * Moteur de réservation simple, filtré par ?type=site|minibus|autre (D6,
 * Option 2). Réplique l'UX de la maquette mom-logistique (réservation +
 * récurrence + agenda + validation), branchée sur le socle Hub :
 * persistance Supabase, RLS B5-saisie, rôles auth_roles.
 *
 * SAISIE adossée B5 : la pioche catégorie = mesCategoriesAutorisees() ;
 * un référent ne réserve que pour sa catégorie. VALIDATION révélée si
 * bureau|admin (D1), via RPC valider_reservation / valider_recurrence /
 * set_recurrence_active.
 *
 * Occurrences récurrentes projetées 100% front (réplique getOccurrences) ;
 * aucune matérialisation en base. Convention jours : 0=Lundi .. 6=Dimanche.
 *
 * Dépend de : js/supabase-client.js (v1.50+).
 * Source UX : manu-mom/mom-logistique/index.html.
 */
(function () {
  'use strict';

  // ============================================================
  // Contexte type (?type=site|minibus|autre) — D6
  // ============================================================
  const TYPES = {
    site:    { titre: 'Infrastructures', sousTitre: 'Réservation des lieux',
               resType: 'site',     sousType: null },
    minibus: { titre: 'Minibus',         sousTitre: 'Réservation des minibus',
               resType: 'materiel', sousType: 'minibus' },
    autre:   { titre: 'Autres réservations', sousTitre: 'Matériel & caméra Veo',
               resType: 'materiel', sousType: null /* veo + autre */ }
  };

  function getTypeParam() {
    const p = new URLSearchParams(window.location.search).get('type');
    return TYPES[p] ? p : 'site';
  }

  // ============================================================
  // Helpers
  // ============================================================
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet',
                'août','septembre','octobre','novembre','décembre'];
  const JOURS_LBL = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']; // 0=Lun..6=Dim

  function formatDateLong(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    return JOURS_LBL[dow] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function libelleStatut(s) {
    switch (s) {
      case 'pending':  return 'En attente';
      case 'approved': return 'Approuvée';
      case 'rejected': return 'Refusée';
      default:         return s || '';
    }
  }

  function el(id) { return document.getElementById(id); }

  // ============================================================
  // getOccurrences — réplique fidèle de la maquette.
  // jours : int[] 0=Lundi..6=Dimanche. Renvoie les jours (1..31) du
  // mois (yr, mo 0-based) où la règle s'applique.
  // ============================================================
  function getOccurrences(rule, yr, mo) {
    if (!rule.active || rule.statut !== 'approved') return [];
    const until = new Date(rule.date_fin + 'T23:59:59');
    const dim = new Date(yr, mo + 1, 0).getDate();
    const occ = [];
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(yr, mo, d);
      const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1; // 0=Lun..6=Dim
      if (rule.jours.indexOf(dow) === -1) continue;
      if (dt > until) continue;
      if (rule.freq === 'biweekly') {
        const wk = Math.floor((dt - new Date(yr, 0, 1)) / 604800000);
        if (wk % 2 !== 0) continue;
      }
      // monthly : 1re occurrence du/des jour(s) dans le mois
      if (rule.freq === 'monthly') {
        const premier = occ.length === 0;
        if (!premier) continue;
      }
      occ.push(d);
    }
    return occ;
  }

  // ============================================================
  // État module
  // ============================================================
  const state = {
    type: getTypeParam(),
    ressources: [],
    selectedRessourceId: null,
    categories: [],        // mes catégories autorisées (B5) résolues
    isTransverse: false,   // admin|bureau → toutes catégories
    canValidate: false,    // bureau|admin → section validation
    recurOn: false,
    recurJours: []
  };

  // ============================================================
  // Boot
  // ============================================================
  async function boot() {
    // Garde d'auth : tout authentifié (la saisie est pilotée par B5,
    // pas par une garde de page restrictive).
    const session = await SupabaseHub.getSession();
    if (!session) { window.location.replace('login.html'); return; }

    const roles = await SupabaseHub.getMyRoles();
    state.canValidate = roles.indexOf('bureau') !== -1 || roles.indexOf('admin') !== -1;

    document.body.classList.remove('auth-pending');
    document.body.classList.add('auth-resolved');
    if (state.canValidate) document.body.classList.add('auth-can-validate');

    // Déconnexion
    const signoutBtn = el('btn-signout');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', async function () {
        signoutBtn.disabled = true;
        await SupabaseHub.signOut();
      });
    }
    if (SupabaseHub.onAuthChange) {
      SupabaseHub.onAuthChange(function (event) {
        if (event === 'SIGNED_OUT') window.location.replace('login.html');
      });
    }

    // En-tête contextuel
    const ctx = TYPES[state.type];
    if (el('logi-title'))    el('logi-title').textContent = ctx.titre;
    if (el('logi-subtitle')) el('logi-subtitle').textContent = ctx.sousTitre;

    await Promise.all([loadRessources(), loadCategories()]);
    wireForm();
    if (state.canValidate) {
      document.body.classList.add('show-admin');
      await refreshValidation();
      await refreshRecurrences();
    }
    await refreshAgenda();

    console.log('%c🏉 Logistique chargé', 'color:#2D7D46;font-weight:bold;',
      { type: state.type, ressources: state.ressources.length, validation: state.canValidate });
  }

  // ============================================================
  // Chargements
  // ============================================================
  async function loadRessources() {
    const ctx = TYPES[state.type];
    let list = await SupabaseHub.listRessourcesLogistiques(ctx.resType, ctx.sousType);
    // 'autre' = matériel hors minibus (veo + autre). Le wrapper ne filtre
    // pas l'exclusion → on retire les minibus côté front.
    if (state.type === 'autre') {
      list = list.filter(function (r) { return r.sous_type !== 'minibus'; });
    }
    state.ressources = list;
    renderRessources();
  }

  async function loadCategories() {
    const mesCat = await SupabaseHub.mesCategoriesAutorisees();
    // Forme RPC : [{categorie_id, est_transverse}]. Une ligne
    // (null, true) = laissez-passer transverse (admin|bureau).
    state.isTransverse = (mesCat || []).some(function (c) { return c.est_transverse; });
    if (state.isTransverse) {
      // toutes les catégories du référentiel
      state.categories = await fallbackCategories();
    } else {
      // seulement les catégories du référent → on résout leurs libellés
      const ids = (mesCat || []).map(function (c) { return c.categorie_id; })
        .filter(Boolean);
      const all = await fallbackCategories();
      state.categories = (all || []).filter(function (c) {
        return ids.indexOf(c.id) !== -1;
      });
    }
    renderCategorieOptions();
  }

  // Catégories : SELECT direct sur la table `categories` (RLS lecture
  // ouverte ; voie éprouvée déployée dans supabase-client, vs RPC
  // list_categories non câblée comme wrapper). Projection alignée sonde 3.
  async function fallbackCategories() {
    if (SupabaseHub.client && SupabaseHub.client.from) {
      const { data, error } = await SupabaseHub.client
        .from('categories')
        .select('id, code, libelle_court, libelle_long, ordre_tri')
        .order('ordre_tri', { ascending: true });
      if (error) {
        console.error('MOM Hub: logistique fallbackCategories()', error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    }
    return [];
  }

  // ============================================================
  // Rendu — grille ressources
  // ============================================================
  function renderRessources() {
    const host = el('logi-ressources');
    if (!host) return;
    if (state.ressources.length === 0) {
      host.innerHTML = '<div class="logi-empty">Aucune ressource disponible.</div>';
      return;
    }
    host.innerHTML = '';
    state.ressources.forEach(function (r) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'logi-res-card';
      card.dataset.id = r.id;
      card.innerHTML =
        '<span class="logi-res-card__label">' + escapeHtml(r.libelle) + '</span>' +
        (r.conducteur_requis
          ? '<span class="logi-res-card__tag">conducteur requis</span>' : '');
      card.addEventListener('click', function () {
        state.selectedRessourceId = r.id;
        Array.prototype.forEach.call(
          host.querySelectorAll('.logi-res-card'),
          function (c) { c.classList.remove('is-selected'); });
        card.classList.add('is-selected');
        const ff = el('logi-form-fields');
        if (ff) ff.classList.add('is-active');
      });
      host.appendChild(card);
    });
  }

  function renderCategorieOptions() {
    const sel = el('logi-categorie');
    if (!sel) return;
    let html = '';
    // Option « sans catégorie » seulement si transverse (un référent
    // doit choisir une de ses catégories — RLS le rejetterait sinon).
    if (state.isTransverse) {
      html += '<option value="">— Bureau / Autre —</option>';
    }
    state.categories
      .slice()
      .sort(function (a, b) { return (a.ordre_tri || 0) - (b.ordre_tri || 0); })
      .forEach(function (c) {
        html += '<option value="' + escapeHtml(c.id) + '">' +
          escapeHtml(c.libelle_court || c.code || c.libelle_long || c.id) +
          '</option>';
      });
    sel.innerHTML = html;
    // Au changement de catégorie → recharger la pioche responsable filtrée
    sel.onchange = function () { loadResponsables(sel.value || null); };
    // Premier chargement responsable
    loadResponsables(sel.value || null);
  }

  async function loadResponsables(categorieId) {
    const sel = el('logi-responsable');
    if (!sel) return;
    sel.innerHTML = '<option value="">Chargement…</option>';
    const staff = await SupabaseHub.listStaffDisponibles(categorieId);
    if (!staff || staff.length === 0) {
      sel.innerHTML = '<option value="">Aucun encadrant disponible</option>';
      return;
    }
    let html = '<option value="">— Choisir —</option>';
    staff.forEach(function (p) {
      const nom = ((p.nom || '') + ' ' + (p.prenom || '')).trim();
      html += '<option value="' + escapeHtml(p.personne_id) + '">' +
        escapeHtml(nom) + '</option>';
    });
    sel.innerHTML = html;
  }

  // ============================================================
  // Formulaire — récurrence + soumission
  // ============================================================
  function wireForm() {
    // Toggle récurrence
    const recurToggle = el('logi-recur-toggle');
    if (recurToggle) {
      recurToggle.addEventListener('change', function () {
        state.recurOn = recurToggle.checked;
        const box = el('logi-recur-box');
        if (box) box.classList.toggle('is-open', state.recurOn);
      });
    }
    // Jours de la semaine (0=Lun..6=Dim)
    const joursHost = el('logi-recur-jours');
    if (joursHost) {
      joursHost.innerHTML = '';
      JOURS_LBL.forEach(function (lbl, idx) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'logi-day';
        b.textContent = lbl;
        b.addEventListener('click', function () {
          const pos = state.recurJours.indexOf(idx);
          if (pos === -1) { state.recurJours.push(idx); b.classList.add('is-on'); }
          else { state.recurJours.splice(pos, 1); b.classList.remove('is-on'); }
        });
        joursHost.appendChild(b);
      });
    }
    // Soumission
    const submitBtn = el('logi-submit');
    if (submitBtn) submitBtn.addEventListener('click', onSubmit);
  }

  function showToast(msg, ok) {
    const t = el('logi-toast');
    if (!t) { alert(msg); return; }
    t.textContent = msg;
    t.className = 'logi-toast is-show ' + (ok === false ? 'is-err' : 'is-ok');
    setTimeout(function () { t.className = 'logi-toast'; }, 3200);
  }

  async function onSubmit() {
    const categorieId = (el('logi-categorie') || {}).value || null;
    const responsable = (el('logi-responsable') || {}).value || null;
    const date    = (el('logi-date') || {}).value || null;
    const hDebut  = (el('logi-heure-debut') || {}).value || null;
    const hFin    = (el('logi-heure-fin') || {}).value || null;
    const motif   = (el('logi-motif') || {}).value || null;

    if (!state.selectedRessourceId) { showToast('Choisis une ressource', false); return; }
    if (!responsable) { showToast('Choisis un responsable', false); return; }
    if (!hDebut || !hFin) { showToast('Renseigne le créneau', false); return; }

    const submitBtn = el('logi-submit');
    if (submitBtn) submitBtn.disabled = true;

    let res;
    if (state.recurOn) {
      const dateFin = (el('logi-recur-fin') || {}).value || null;
      const freq    = (el('logi-recur-freq') || {}).value || 'weekly';
      if (state.recurJours.length === 0) {
        showToast('Choisis au moins un jour', false);
        if (submitBtn) submitBtn.disabled = false; return;
      }
      if (!dateFin) {
        showToast('Renseigne une date de fin', false);
        if (submitBtn) submitBtn.disabled = false; return;
      }
      res = await SupabaseHub.createRecurrence({
        ressource_id: state.selectedRessourceId,
        categorie_id: categorieId,
        responsable_personne_id: responsable,
        freq: freq,
        jours: state.recurJours.slice(),
        heure_debut: hDebut,
        heure_fin: hFin,
        date_fin: dateFin,
        motif: motif
      });
    } else {
      if (!date) {
        showToast('Renseigne une date', false);
        if (submitBtn) submitBtn.disabled = false; return;
      }
      res = await SupabaseHub.createReservation({
        ressource_id: state.selectedRessourceId,
        categorie_id: categorieId,
        responsable_personne_id: responsable,
        date: date,
        heure_debut: hDebut,
        heure_fin: hFin,
        motif: motif
      });
    }

    if (submitBtn) submitBtn.disabled = false;
    if (!res.ok) {
      showToast('Échec : ' + (res.error || 'erreur'), false);
      return;
    }
    showToast('Demande envoyée (en attente de validation)', true);
    resetForm();
    await refreshAgenda();
    if (state.canValidate) { await refreshValidation(); await refreshRecurrences(); }
  }

  function resetForm() {
    ['logi-date','logi-heure-debut','logi-heure-fin','logi-motif','logi-recur-fin']
      .forEach(function (id) { if (el(id)) el(id).value = ''; });
    state.recurOn = false;
    state.recurJours = [];
    const tg = el('logi-recur-toggle'); if (tg) tg.checked = false;
    const box = el('logi-recur-box'); if (box) box.classList.remove('is-open');
    Array.prototype.forEach.call(
      document.querySelectorAll('.logi-day.is-on'),
      function (b) { b.classList.remove('is-on'); });
  }

  // ============================================================
  // Agenda — liste chronologique (P1 ; getOccurrences réplique exacte)
  // ============================================================
  async function refreshAgenda() {
    const host = el('logi-agenda');
    if (!host) return;
    const resIds = state.ressources.map(function (r) { return r.id; });
    const byId = {};
    state.ressources.forEach(function (r) { byId[r.id] = r.libelle; });

    // Réservations simples approuvées des ressources de ce type
    const simples = [];
    for (let i = 0; i < state.ressources.length; i++) {
      const rs = await SupabaseHub.listReservations({
        ressourceId: state.ressources[i].id, statut: 'approved' });
      rs.forEach(function (r) { simples.push(r); });
    }
    // Règles récurrentes approuvées → occurrences du mois courant
    const now = new Date();
    const recs = [];
    for (let i = 0; i < state.ressources.length; i++) {
      const rr = await SupabaseHub.listRecurrences({
        ressourceId: state.ressources[i].id, statut: 'approved', activeOnly: true });
      rr.forEach(function (r) { recs.push(r); });
    }

    const items = [];
    simples.forEach(function (r) {
      items.push({ date: r.date, label: byId[r.ressource_id] || '—',
        creneau: (r.heure_debut || '').slice(0,5) + '–' + (r.heure_fin || '').slice(0,5),
        recur: false, motif: r.motif });
    });
    recs.forEach(function (r) {
      const occ = getOccurrences(r, now.getFullYear(), now.getMonth());
      occ.forEach(function (d) {
        const iso = now.getFullYear() + '-' +
          String(now.getMonth()+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
        items.push({ date: iso, label: byId[r.ressource_id] || '—',
          creneau: (r.heure_debut || '').slice(0,5) + '–' + (r.heure_fin || '').slice(0,5),
          recur: true, motif: r.motif });
      });
    });

    items.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.creneau < b.creneau ? -1 : 1;
    });

    if (items.length === 0) {
      host.innerHTML = '<div class="logi-empty">Aucune réservation approuvée ce mois-ci.</div>';
      return;
    }
    host.innerHTML = items.map(function (it) {
      return '<div class="logi-agenda-row">' +
        '<span class="logi-agenda-date">' + escapeHtml(formatDateLong(it.date)) + '</span>' +
        '<span class="logi-agenda-res">' + (it.recur ? '↻ ' : '') + escapeHtml(it.label) + '</span>' +
        '<span class="logi-agenda-creneau">' + escapeHtml(it.creneau) + '</span>' +
        (it.motif ? '<span class="logi-agenda-motif">' + escapeHtml(it.motif) + '</span>' : '') +
      '</div>';
    }).join('');
  }

  // ============================================================
  // Validation (bureau|admin) — file des demandes en attente
  // ============================================================
  async function refreshValidation() {
    const host = el('logi-validation');
    if (!host) return;
    const byId = {};
    state.ressources.forEach(function (r) { byId[r.id] = r.libelle; });

    const pendingSimples = [];
    for (let i = 0; i < state.ressources.length; i++) {
      const rs = await SupabaseHub.listReservations({
        ressourceId: state.ressources[i].id, statut: 'pending' });
      rs.forEach(function (r) { pendingSimples.push(r); });
    }

    const badge = el('logi-validation-badge');
    if (badge) badge.textContent = pendingSimples.length
      ? String(pendingSimples.length) : '';

    if (pendingSimples.length === 0) {
      host.innerHTML = '<div class="logi-empty">Aucune demande en attente.</div>';
      return;
    }
    host.innerHTML = '';
    pendingSimples.forEach(function (r) {
      const row = document.createElement('div');
      row.className = 'logi-valid-row';
      row.innerHTML =
        '<span class="logi-valid-res">' + escapeHtml(byId[r.ressource_id] || '—') + '</span>' +
        '<span class="logi-valid-meta">' + escapeHtml(formatDateLong(r.date)) + ' · ' +
          escapeHtml((r.heure_debut||'').slice(0,5)) + '–' +
          escapeHtml((r.heure_fin||'').slice(0,5)) + '</span>' +
        (r.motif ? '<span class="logi-valid-motif">' + escapeHtml(r.motif) + '</span>' : '');
      const actions = document.createElement('span');
      actions.className = 'logi-valid-actions';

      const ok = document.createElement('button');
      ok.type = 'button'; ok.className = 'logi-btn-ok'; ok.textContent = 'Approuver';
      ok.addEventListener('click', async function () {
        ok.disabled = true;
        const res = await SupabaseHub.validerReservation(r.id, 'approved');
        if (res.ok) { showToast('Réservation approuvée', true); await refreshValidation(); await refreshAgenda(); }
        else { showToast('Échec : ' + (res.error||''), false); ok.disabled = false; }
      });

      const no = document.createElement('button');
      no.type = 'button'; no.className = 'logi-btn-no'; no.textContent = 'Refuser';
      no.addEventListener('click', async function () {
        const motif = window.prompt('Motif du refus (facultatif) :') || null;
        no.disabled = true;
        const res = await SupabaseHub.validerReservation(r.id, 'rejected', motif);
        if (res.ok) { showToast('Réservation refusée', true); await refreshValidation(); }
        else { showToast('Échec : ' + (res.error||''), false); no.disabled = false; }
      });

      actions.appendChild(ok);
      actions.appendChild(no);
      row.appendChild(actions);
      host.appendChild(row);
    });
  }

  // ============================================================
  // Récurrents (bureau|admin) — activer / suspendre
  // ============================================================
  async function refreshRecurrences() {
    const host = el('logi-recurrents');
    if (!host) return;
    const byId = {};
    state.ressources.forEach(function (r) { byId[r.id] = r.libelle; });

    const all = [];
    for (let i = 0; i < state.ressources.length; i++) {
      const rr = await SupabaseHub.listRecurrences({ ressourceId: state.ressources[i].id });
      rr.forEach(function (r) { all.push(r); });
    }
    if (all.length === 0) {
      host.innerHTML = '<div class="logi-empty">Aucune règle récurrente.</div>';
      return;
    }
    host.innerHTML = '';
    all.forEach(function (r) {
      const joursTxt = (r.jours || []).map(function (j) { return JOURS_LBL[j]; }).join(' ');
      const row = document.createElement('div');
      row.className = 'logi-recur-row' + (r.active ? '' : ' is-suspended');
      row.innerHTML =
        '<span class="logi-recur-res">' + escapeHtml(byId[r.ressource_id] || '—') + '</span>' +
        '<span class="logi-recur-meta">' + escapeHtml(r.freq) + ' · ' + escapeHtml(joursTxt) +
          ' · jusqu\'au ' + escapeHtml(formatDateLong(r.date_fin)) +
          ' · ' + escapeHtml(libelleStatut(r.statut)) + '</span>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'logi-recur-toggle-btn';
      btn.textContent = r.active ? 'Suspendre' : 'Réactiver';
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        const res = await SupabaseHub.setRecurrenceActive(r.id, !r.active);
        if (res.ok) { showToast('Règle mise à jour', true); await refreshRecurrences(); await refreshAgenda(); }
        else { showToast('Échec : ' + (res.error||''), false); btn.disabled = false; }
      });
      row.appendChild(btn);
      host.appendChild(row);
    });
  }

  // ============================================================
  // Lancement
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
