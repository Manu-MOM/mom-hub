/**
 * MOM Hub · Logistique — Bus Browser (bus.html)
 * =============================================
 * Formulaire de demande de bus (6 blocs), réplique de la maquette
 * mom-logistique, branché sur le socle Hub : persistance demandes_bus
 * (JSONB arrets/delegations), RLS B5-saisie, rôles auth_roles.
 *
 * Adaptations socle (vs maquette) :
 *  - Catégorie : pioche B5 (mesCategoriesAutorisees), pas de liste en dur.
 *  - Responsable : pioche personnes (D2), pas de texte libre.
 *  - Persistance : createDemandeBus (wrapper v1.50), pas de mémoire JS.
 *  - Validation (bureau|admin) : file des demandes pending + validerBus.
 *
 * Mapping JSONB (aligné schéma SQL §4.4) :
 *   arrets_aller  [{lieu, heure, nb_mom}]
 *   arrets_retour [{lieu, heure}]
 *   delegations   [{club, nb_pax}]
 *
 * Dépend de : js/supabase-client.js (v1.50+).
 */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet',
                'août','septembre','octobre','novembre','décembre'];
  function formatDateLong(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
  }

  // ============================================================
  // État
  // ============================================================
  const state = {
    isTransverse: false,
    canValidate: false,
    categories: [],
    arretsAller:  [{ lieu: '', heure: '', nb_mom: '' }],
    arretsRetour: [{ lieu: '', heure: '' }],
    delegations:  []
  };

  // ============================================================
  // Boot
  // ============================================================
  async function boot() {
    const session = await SupabaseHub.getSession();
    if (!session) { window.location.replace('login.html'); return; }

    const roles = await SupabaseHub.getMyRoles();
    state.canValidate = roles.indexOf('bureau') !== -1 || roles.indexOf('admin') !== -1;

    document.body.classList.remove('auth-pending');
    document.body.classList.add('auth-resolved');
    if (state.canValidate) document.body.classList.add('show-admin');

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

    await loadCategories();
    wireForm();
    renderArrets('aller');
    renderArrets('retour');
    renderDelegations();
    updateTotaux();
    if (state.canValidate) await refreshValidation();

    console.log('%c🏉 Bus chargé', 'color:#2D7D46;font-weight:bold;',
      { validation: state.canValidate });
  }

  // ============================================================
  // Catégories (B5) + responsable
  // ============================================================
  async function loadCategories() {
    const mesCat = await SupabaseHub.mesCategoriesAutorisees();
    state.isTransverse = (mesCat || []).some(function (c) { return c.est_transverse; });
    const all = await fetchCategories();
    if (state.isTransverse) {
      state.categories = all;
    } else {
      const ids = (mesCat || []).map(function (c) { return c.categorie_id; }).filter(Boolean);
      state.categories = all.filter(function (c) { return ids.indexOf(c.id) !== -1; });
    }
    renderCategorieOptions();
  }

  async function fetchCategories() {
    if (SupabaseHub.client && SupabaseHub.client.from) {
      const { data, error } = await SupabaseHub.client
        .from('categories')
        .select('id, code, libelle_court, libelle_long, ordre_tri')
        .order('ordre_tri', { ascending: true });
      if (error) { console.error('MOM Hub: bus fetchCategories()', error); return []; }
      return Array.isArray(data) ? data : [];
    }
    return [];
  }

  function renderCategorieOptions() {
    const sel = el('b-cat');
    if (!sel) return;
    let html = state.isTransverse ? '<option value="">— Bureau / Autre —</option>'
                                  : '<option value="">— Sélectionner —</option>';
    state.categories
      .slice()
      .sort(function (a, b) { return (a.ordre_tri || 0) - (b.ordre_tri || 0); })
      .forEach(function (c) {
        html += '<option value="' + escapeHtml(c.id) + '">' +
          escapeHtml(c.libelle_court || c.code || c.libelle_long || c.id) + '</option>';
      });
    sel.innerHTML = html;
    sel.onchange = function () { loadResponsables(sel.value || null); };
    loadResponsables(sel.value || null);
  }

  async function loadResponsables(categorieId) {
    const sel = el('b-resp');
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
      html += '<option value="' + escapeHtml(p.personne_id) + '">' + escapeHtml(nom) + '</option>';
    });
    sel.innerHTML = html;
  }

  // ============================================================
  // Arrêts (aller : lieu/heure/nb_mom ; retour : lieu/heure) — max 3
  // ============================================================
  function renderArrets(type) {
    const host = el('arrets-' + type + '-list');
    if (!host) return;
    const list = type === 'aller' ? state.arretsAller : state.arretsRetour;
    host.innerHTML = '';
    list.forEach(function (a, i) {
      const row = document.createElement('div');
      row.className = 'bus-arret-row';
      let html =
        '<div class="bus-field"><label>Lieu</label>' +
          '<input type="text" data-f="lieu" placeholder="Ex : Stade Brencklé" value="' + escapeHtml(a.lieu) + '"></div>' +
        '<div class="bus-field bus-field--sm"><label>Heure</label>' +
          '<input type="time" data-f="heure" value="' + escapeHtml(a.heure) + '"></div>';
      if (type === 'aller') {
        html += '<div class="bus-field bus-field--sm"><label>Nb MOM</label>' +
          '<input type="number" min="0" max="60" data-f="nb_mom" value="' + escapeHtml(a.nb_mom) + '"></div>';
      }
      html += '<button type="button" class="bus-del-btn" title="Retirer">−</button>';
      row.innerHTML = html;

      Array.prototype.forEach.call(row.querySelectorAll('input'), function (inp) {
        inp.addEventListener('input', function () {
          a[inp.dataset.f] = inp.value;
          if (inp.dataset.f === 'nb_mom') updateTotaux();
        });
      });
      row.querySelector('.bus-del-btn').addEventListener('click', function () {
        list.splice(i, 1);
        if (list.length === 0) {
          list.push(type === 'aller' ? { lieu: '', heure: '', nb_mom: '' } : { lieu: '', heure: '' });
        }
        renderArrets(type);
        updateTotaux();
      });
      host.appendChild(row);
    });
    const addBtn = el('btn-add-' + type);
    if (addBtn) addBtn.style.display = list.length >= 3 ? 'none' : 'inline-flex';
  }

  function addArret(type) {
    const list = type === 'aller' ? state.arretsAller : state.arretsRetour;
    if (list.length >= 3) return;
    list.push(type === 'aller' ? { lieu: '', heure: '', nb_mom: '' } : { lieu: '', heure: '' });
    renderArrets(type);
  }

  // ============================================================
  // Délégations (club / nb_pax) — max 3
  // ============================================================
  function renderDelegations() {
    const host = el('delegations-list');
    if (!host) return;
    host.innerHTML = '';
    state.delegations.forEach(function (d, i) {
      const row = document.createElement('div');
      row.className = 'bus-deleg-row';
      row.innerHTML =
        '<div class="bus-field"><label>Club</label>' +
          '<input type="text" data-f="club" placeholder="Ex : RC Strasbourg" value="' + escapeHtml(d.club) + '"></div>' +
        '<div class="bus-field bus-field--sm"><label>Nb passagers</label>' +
          '<input type="number" min="1" max="40" data-f="nb_pax" value="' + escapeHtml(d.nb_pax) + '"></div>' +
        '<button type="button" class="bus-del-btn" title="Retirer">−</button>';
      Array.prototype.forEach.call(row.querySelectorAll('input'), function (inp) {
        inp.addEventListener('input', function () {
          d[inp.dataset.f] = inp.value;
          if (inp.dataset.f === 'nb_pax') updateTotaux();
        });
      });
      row.querySelector('.bus-del-btn').addEventListener('click', function () {
        state.delegations.splice(i, 1);
        renderDelegations();
        updateTotaux();
      });
      host.appendChild(row);
    });
    const addBtn = el('btn-add-deleg');
    if (addBtn) addBtn.style.display = state.delegations.length >= 3 ? 'none' : 'inline-flex';
  }

  function addDelegation() {
    if (state.delegations.length >= 3) return;
    state.delegations.push({ club: '', nb_pax: '' });
    renderDelegations();
  }

  // ============================================================
  // Totaux — réplique fidèle de la maquette
  // totalMOM = (somme nb_mom des arrêts) si > 0, sinon joueurs + staff
  // ============================================================
  function computeTotaux() {
    const joueurs = parseInt((el('b-pax-joueurs') || {}).value, 10) || 0;
    const staff   = parseInt((el('b-pax-staff') || {}).value, 10) || 0;
    const stopsNb = state.arretsAller.reduce(function (s, a) {
      return s + (parseInt(a.nb_mom, 10) || 0); }, 0);
    const totalMom = stopsNb > 0 ? stopsNb + staff : joueurs + staff;
    const totalDeleg = state.delegations.reduce(function (s, d) {
      return s + (parseInt(d.nb_pax, 10) || 0); }, 0);
    return { joueurs: joueurs, staff: staff, totalMom: totalMom,
             totalDeleg: totalDeleg, totalBus: totalMom + totalDeleg };
  }

  function updateTotaux() {
    const t = computeTotaux();
    if (el('total-mom-display')) el('total-mom-display').textContent = String(t.totalMom);
    if (el('total-bus-display')) el('total-bus-display').textContent = String(t.totalBus);
    const recap = el('recap-passagers');
    if (recap) recap.style.display = t.totalBus > 0 ? 'block' : 'none';
  }

  // ============================================================
  // Soumission
  // ============================================================
  function wireForm() {
    ['b-pax-joueurs','b-pax-staff'].forEach(function (id) {
      const inp = el(id);
      if (inp) inp.addEventListener('input', updateTotaux);
    });
    const addAller = el('btn-add-aller');
    if (addAller) addAller.addEventListener('click', function () { addArret('aller'); });
    const addRetour = el('btn-add-retour');
    if (addRetour) addRetour.addEventListener('click', function () { addArret('retour'); });
    const addDeleg = el('btn-add-deleg');
    if (addDeleg) addDeleg.addEventListener('click', addDelegation);
    const submit = el('b-submit');
    if (submit) submit.addEventListener('click', onSubmit);
  }

  function showToast(msg, ok) {
    const t = el('bus-toast');
    if (!t) { alert(msg); return; }
    t.textContent = msg;
    t.className = 'bus-toast is-show ' + (ok === false ? 'is-err' : 'is-ok');
    setTimeout(function () { t.className = 'bus-toast'; }, 3200);
  }

  async function onSubmit() {
    const categorieId = (el('b-cat') || {}).value || null;
    const responsable = (el('b-resp') || {}).value || null;
    const date        = (el('b-date') || {}).value || null;
    const destination = (el('b-to') || {}).value || null;
    const arrivee     = (el('b-arrival') || {}).value || null;

    if (!responsable) { showToast('Choisis un responsable', false); return; }
    if (!date)        { showToast('Renseigne la date', false); return; }
    if (!destination) { showToast('Renseigne la destination', false); return; }
    const arretsAller = state.arretsAller.filter(function (a) { return a.lieu; });
    if (arretsAller.length === 0) { showToast('Indique au moins un lieu de départ', false); return; }

    const t = computeTotaux();
    const submit = el('b-submit');
    if (submit) submit.disabled = true;

    const payload = {
      categorie_id: categorieId,
      responsable_personne_id: responsable,
      date: date,
      type_competition: (el('b-comp') || {}).value || null,
      destination: destination,
      heure_arrivee_souhaitee: arrivee,
      retour_depart:  (el('b-retour-depart') || {}).value || null,
      retour_arrivee: (el('b-retour-arrival') || {}).value || null,
      arrets_aller: arretsAller.map(function (a) {
        return { lieu: a.lieu, heure: a.heure || null, nb_mom: parseInt(a.nb_mom, 10) || 0 }; }),
      arrets_retour: state.arretsRetour.filter(function (a) { return a.lieu; })
        .map(function (a) { return { lieu: a.lieu, heure: a.heure || null }; }),
      delegations: state.delegations.filter(function (d) { return d.club; })
        .map(function (d) { return { club: d.club, nb_pax: parseInt(d.nb_pax, 10) || 0 }; }),
      pax_joueurs: t.joueurs,
      pax_staff: t.staff,
      total_mom: t.totalMom,
      total_deleg: t.totalDeleg,
      total_bus: t.totalBus,
      notes: (el('b-notes') || {}).value || null
    };

    const res = await SupabaseHub.createDemandeBus(payload);
    if (submit) submit.disabled = false;
    if (!res.ok) { showToast('Échec : ' + (res.error || 'erreur'), false); return; }
    showToast('Demande de bus envoyée (en attente)', true);
    resetForm();
    if (state.canValidate) await refreshValidation();
  }

  function resetForm() {
    ['b-date','b-to','b-arrival','b-retour-depart','b-retour-arrival',
     'b-pax-joueurs','b-pax-staff','b-notes','b-comp']
      .forEach(function (id) { if (el(id)) el(id).value = ''; });
    state.arretsAller  = [{ lieu: '', heure: '', nb_mom: '' }];
    state.arretsRetour = [{ lieu: '', heure: '' }];
    state.delegations  = [];
    renderArrets('aller'); renderArrets('retour'); renderDelegations();
    updateTotaux();
  }

  // ============================================================
  // Validation (bureau|admin)
  // ============================================================
  async function refreshValidation() {
    const host = el('bus-validation');
    if (!host) return;
    const pend = await SupabaseHub.listDemandesBus({ statut: 'pending' });
    const badge = el('bus-validation-badge');
    if (badge) badge.textContent = pend.length ? String(pend.length) : '';
    if (!pend || pend.length === 0) {
      host.innerHTML = '<div class="bus-empty">Aucune demande en attente.</div>';
      return;
    }
    host.innerHTML = '';
    pend.forEach(function (r) {
      const row = document.createElement('div');
      row.className = 'bus-valid-row';
      row.innerHTML =
        '<span class="bus-valid-dest">' + escapeHtml(r.destination || '—') + '</span>' +
        '<span class="bus-valid-meta">' + escapeHtml(formatDateLong(r.date)) +
          ' · ' + (r.total_bus || 0) + ' pax</span>';
      const actions = document.createElement('span');
      actions.className = 'bus-valid-actions';

      const ok = document.createElement('button');
      ok.type = 'button'; ok.className = 'bus-btn-ok'; ok.textContent = 'Approuver';
      ok.addEventListener('click', async function () {
        ok.disabled = true;
        const res = await SupabaseHub.validerBus(r.id, 'approved');
        if (res.ok) { showToast('Bus approuvé', true); await refreshValidation(); }
        else { showToast('Échec : ' + (res.error||''), false); ok.disabled = false; }
      });
      const no = document.createElement('button');
      no.type = 'button'; no.className = 'bus-btn-no'; no.textContent = 'Refuser';
      no.addEventListener('click', async function () {
        const motif = window.prompt('Motif du refus (facultatif) :') || null;
        no.disabled = true;
        const res = await SupabaseHub.validerBus(r.id, 'rejected', motif);
        if (res.ok) { showToast('Bus refusé', true); await refreshValidation(); }
        else { showToast('Échec : ' + (res.error||''), false); no.disabled = false; }
      });
      actions.appendChild(ok); actions.appendChild(no);
      row.appendChild(actions);
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
