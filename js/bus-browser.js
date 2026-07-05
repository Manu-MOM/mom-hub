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
 *  - Validation (bureau|admin) : DÉMÉNAGÉE au poste tri-source
 *    logistique-validation.html (REFONTE-PARCOURS-LOGISTIQUE, FAIT FOI
 *    777551e9…, arbitrages 5.3/5.5) — le guichet est purifié.
 *
 * MULTI-CATEGORIES (FAIT FOI gelé 05/07/2026) : pioches catégories ET
 * responsables en cases à cocher (patron bus-days, M5/M6 complète),
 * ordre de coche = ordre du tableau (T4), 1er = principal/officiel.
 * Responsables = UNION du staff des catégories cochées (T3).
 * Mode ?edit= : catégories rechargées depuis categorie_ids (fallback
 * scalaire) et rééditables ; responsables AFFICHÉS FIGÉS (chips
 * désactivées, T2 — immuables en édition comme avant).
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

  // ============================================================
  // État
  // ============================================================
  const state = {
    editId: null,        // mode édition ?edit=<id> (cycle de vie B4)
    isTransverse: false,
    categories: [],
    catCoches: [],       // uuid[] catégories cochées, ORDRE DE COCHE (T4)
    respCoches: [],      // uuid[] responsables cochés, ORDRE DE COCHE (T4)
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

    document.body.classList.remove('auth-pending');
    document.body.classList.add('auth-resolved');

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
    await applyEditMode();

    console.log('%c🏉 Bus chargé', 'color:#2D7D46;font-weight:bold;');
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
    const host = el('b-cat');
    if (!host) return;
    host.innerHTML = '';
    state.catCoches = [];
    // MULTI (M5) : cases patron bus-days, ordre de coche = tableau (T4).
    // AUCUNE coche = « Bureau / Autre » (tableau vide, M3), contrôlé au
    // submit (transverses seulement), la policy tranche en dernier.
    state.categories
      .slice()
      .sort(function (a, b) { return (a.ordre_tri || 0) - (b.ordre_tri || 0); })
      .forEach(function (c) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bus-day';
        b.dataset.id = c.id;
        b.textContent = c.libelle_court || c.code || c.libelle_long || c.id;
        b.addEventListener('click', function () {
          const pos = state.catCoches.indexOf(c.id);
          if (pos === -1) { state.catCoches.push(c.id); b.classList.add('is-on'); }
          else { state.catCoches.splice(pos, 1); b.classList.remove('is-on'); }
          if (state.catCoches.length
              && typeof SupabaseHub.memoriserCategorieActive === 'function') {
            SupabaseHub.memoriserCategorieActive(state.catCoches[0]);
          }
          loadResponsables(state.catCoches.slice());
        });
        host.appendChild(b);
      });
    // Synchro inter-écrans : pré-coche la catégorie active mémorisée.
    try {
      if (typeof SupabaseHub.lireCategorieActiveMemorisee === 'function') {
        const memo = SupabaseHub.lireCategorieActiveMemorisee();
        if (memo && state.categories.some(function (c) { return c.id === memo; })) {
          state.catCoches = [memo];
          const btn = host.querySelector('.bus-day[data-id="' + CSS.escape(memo) + '"]');
          if (btn) btn.classList.add('is-on');
        }
      }
    } catch (e) { /* honnête : pas de synchro, choix manuel */ }
    loadResponsables(state.catCoches.slice());
  }

  async function loadResponsables(categorieIds) {
    const host = el('b-resp');
    if (!host) return;
    // T2 : en mode édition les responsables sont FIGÉS — un changement de
    // catégories ne re-rend pas la pioche éditable, on ré-affiche le gel.
    if (state.editId) { renderResponsablesFiges(state.respCoches.slice()); return; }
    host.innerHTML = '<span style="font-size:12px;color:var(--ink-mute);">Chargement…</span>';
    // T3 : UNION du staff des catégories cochées, fusion dédupliquée.
    // Aucune coche → listStaffDisponibles(null) = tous les staffs.
    const staff = [];
    const seen = {};
    const ids = (categorieIds && categorieIds.length) ? categorieIds : [null];
    for (let i = 0; i < ids.length; i++) {
      const lot = await SupabaseHub.listStaffDisponibles(ids[i]);
      (lot || []).forEach(function (p) {
        if (!p || !p.personne_id || seen[p.personne_id]) return;
        seen[p.personne_id] = true;
        staff.push(p);
      });
    }
    staff.sort(function (a, b) {
      return ((a.nom || '') + ' ' + (a.prenom || ''))
        .localeCompare(((b.nom || '') + ' ' + (b.prenom || '')), 'fr');
    });
    state.respCoches = [];
    host.innerHTML = '';
    if (staff.length === 0) {
      host.innerHTML = '<span style="font-size:12px;color:var(--ink-mute);">Aucun encadrant disponible</span>';
      return;
    }
    // M6 complète : 1er coché = responsable officiel, suivants indicatifs.
    staff.forEach(function (p) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bus-day';
      b.dataset.id = p.personne_id;
      b.textContent = ((p.nom || '') + ' ' + (p.prenom || '')).trim();
      b.addEventListener('click', function () {
        const pos = state.respCoches.indexOf(p.personne_id);
        if (pos === -1) { state.respCoches.push(p.personne_id); b.classList.add('is-on'); }
        else { state.respCoches.splice(pos, 1); b.classList.remove('is-on'); }
      });
      host.appendChild(b);
    });
  }

  // Mode ?edit= (T2) : responsables affichés cochés et DÉSACTIVÉS —
  // immuables en édition (modifier_bus ne les prend pas, comme avant).
  // Les libellés sont résolus via listStaffDisponibles(null) (tous staffs).
  async function renderResponsablesFiges(ids) {
    const host = el('b-resp');
    if (!host) return;
    host.innerHTML = '<span style="font-size:12px;color:var(--ink-mute);">Chargement…</span>';
    const tous = await SupabaseHub.listStaffDisponibles(null);
    const nomById = {};
    (tous || []).forEach(function (p) {
      if (p && p.personne_id) {
        nomById[p.personne_id] = ((p.nom || '') + ' ' + (p.prenom || '')).trim();
      }
    });
    host.innerHTML = '';
    (ids || []).forEach(function (id) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bus-day is-on';
      b.disabled = true;
      b.dataset.id = id;
      b.textContent = nomById[id] || '—';
      host.appendChild(b);
    });
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
    // MULTI : tableaux ordonnés (T4), 1er élément = scalaire.
    const categorieIds = state.catCoches.slice();
    const responsables = state.respCoches.slice();
    const date        = (el('b-date') || {}).value || null;
    const destination = (el('b-to') || {}).value || null;
    const arrivee     = (el('b-arrival') || {}).value || null;

    if (responsables.length === 0) { showToast('Coche au moins un responsable', false); return; }
    if (categorieIds.length === 0 && !state.isTransverse) {
      showToast('Coche au moins une catégorie', false); return;
    }
    if (!date)        { showToast('Renseigne la date', false); return; }
    if (!destination) { showToast('Renseigne la destination', false); return; }
    const arretsAller = state.arretsAller.filter(function (a) { return a.lieu; });
    if (arretsAller.length === 0) { showToast('Indique au moins un lieu de départ', false); return; }

    const t = computeTotaux();
    const submit = el('b-submit');
    if (submit) submit.disabled = true;

    const payload = {
      categorie_id: categorieIds[0] || null,
      categorie_ids: categorieIds,
      responsable_personne_id: responsables[0],
      responsables_personne_ids: responsables,
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

    // Cycle de vie (B4) : en mode édition, ré-émission INTÉGRALE via
    // modifierBus (UPDATE dur B7 — repasse en 'pending' B2).
    // responsable_personne_id du payload : ignoré par modifierBus
    // (immuable en édition, décision tracée FAIT FOI).
    const res = state.editId
      ? await SupabaseHub.modifierBus(state.editId, payload)
      : await SupabaseHub.createDemandeBus(payload);
    if (submit) submit.disabled = false;
    if (!res.ok) { showToast('Échec : ' + (res.error || 'erreur'), false); return; }
    if (state.editId) {
      showToast('Demande modifiée — repassée en attente de validation', true);
      // Retour au poste (l'entrée v1 de l'édition est le poste bureau).
      setTimeout(function () { window.location.href = 'logistique-validation.html'; }, 900);
      return;
    }
    showToast('Demande de bus envoyée (en attente)', true);
    resetForm();
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
  // REFONTE-PARCOURS-LOGISTIQUE (FAIT FOI 777551e9…, arbitrages 5.3/5.5) :
  // refreshValidation() (file pending + validerBus, bureau|admin) a
  // DÉMÉNAGÉ au poste tri-source logistique-validation.html.
  // ============================================================

  // ============================================================
  // Mode ÉDITION (?edit=<id>) — cycle de vie B4 (FAIT FOI b59b44d9).
  // Le formulaire de création est LA surface d'édition du bus (une
  // seule source de vérité) : la demande est rechargée INTÉGRALEMENT
  // (patron pt 141) puis ré-émise en entier via modifierBus (B7).
  // Entrée : bouton « Modifier » de logistique-validation.html ;
  // retour au poste après enregistrement ou annulation.
  // « Annuler la demande » (B5) vit ici, dans la surface d'édition.
  // ============================================================
  function getEditParam() {
    try {
      return new URLSearchParams(window.location.search).get('edit') || null;
    } catch (e) { return null; }
  }

  async function applyEditMode() {
    const editId = getEditParam();
    if (!editId || !/^[0-9a-f-]{36}$/i.test(editId)) return;
    const q = await SupabaseHub.client
      .from('demandes_bus').select('*').eq('id', editId).single();
    if (q.error || !q.data) {
      showToast('Demande introuvable — formulaire en mode création.', false);
      return;
    }
    const row = q.data;
    if (row.statut === 'cancelled') {
      showToast('Demande annulée : non modifiable (re-créer).', false);
      return;
    }
    state.editId = editId;
    // Pré-remplissage INTÉGRAL (B7) — MULTI : coches rechargées depuis
    // categorie_ids (fallback scalaire pour une demande d'avant chantier),
    // rééditables ; responsables FIGÉS depuis responsables_personne_ids
    // (fallback scalaire), chips désactivées (T2).
    state.catCoches = (Array.isArray(row.categorie_ids) && row.categorie_ids.length)
      ? row.categorie_ids.slice()
      : (row.categorie_id ? [row.categorie_id] : []);
    const catHost = el('b-cat');
    if (catHost) {
      Array.prototype.forEach.call(
        catHost.querySelectorAll('.bus-day'),
        function (b) {
          b.classList.toggle('is-on', state.catCoches.indexOf(b.dataset.id) !== -1);
        });
    }
    state.respCoches = (Array.isArray(row.responsables_personne_ids)
        && row.responsables_personne_ids.length)
      ? row.responsables_personne_ids.slice()
      : (row.responsable_personne_id ? [row.responsable_personne_id] : []);
    await renderResponsablesFiges(state.respCoches.slice());
    if (el('b-date')) el('b-date').value = row.date || '';
    if (el('b-comp')) el('b-comp').value = row.type_competition || '';
    if (el('b-to')) el('b-to').value = row.destination || '';
    if (el('b-arrival')) {
      el('b-arrival').value = row.heure_arrivee_souhaitee
        ? String(row.heure_arrivee_souhaitee).slice(0, 5) : '';
    }
    if (el('b-retour-depart')) {
      el('b-retour-depart').value = row.retour_depart
        ? String(row.retour_depart).slice(0, 5) : '';
    }
    if (el('b-retour-arrival')) {
      el('b-retour-arrival').value = row.retour_arrivee
        ? String(row.retour_arrivee).slice(0, 5) : '';
    }
    if (el('b-pax-joueurs')) el('b-pax-joueurs').value = row.pax_joueurs || 0;
    if (el('b-pax-staff')) el('b-pax-staff').value = row.pax_staff || 0;
    if (el('b-notes')) el('b-notes').value = row.notes || '';
    state.arretsAller = (Array.isArray(row.arrets_aller) && row.arrets_aller.length)
      ? row.arrets_aller.map(function (a) {
          return { lieu: a.lieu || '', heure: a.heure || '',
                   nb_mom: (a.nb_mom != null ? String(a.nb_mom) : '') };
        })
      : [{ lieu: '', heure: '', nb_mom: '' }];
    state.arretsRetour = (Array.isArray(row.arrets_retour) && row.arrets_retour.length)
      ? row.arrets_retour.map(function (a) {
          return { lieu: a.lieu || '', heure: a.heure || '' };
        })
      : [{ lieu: '', heure: '' }];
    state.delegations = Array.isArray(row.delegations)
      ? row.delegations.map(function (d) {
          return { club: d.club || '',
                   nb_pax: (d.nb_pax != null ? String(d.nb_pax) : '') };
        })
      : [];
    renderArrets('aller'); renderArrets('retour'); renderDelegations();
    updateTotaux();
    const banner = el('b-edit-banner');
    if (banner) banner.classList.add('is-on');
    const submit = el('b-submit');
    if (submit) submit.textContent = 'Enregistrer les modifications';
    const ann = el('b-annuler-demande');
    if (ann) {
      ann.classList.add('is-on');
      ann.addEventListener('click', annulerDemandeBus);
    }
  }

  async function annulerDemandeBus() {
    if (!state.editId) return;
    if (!window.confirm('Annuler définitivement cette demande de bus ? Elle disparaîtra des agendas (trace conservée).')) return;
    const ann = el('b-annuler-demande');
    if (ann) ann.disabled = true;
    const res = await SupabaseHub.annulerBus(state.editId);
    if (ann) ann.disabled = false;
    if (!res.ok) { showToast('Échec : ' + (res.error || ''), false); return; }
    showToast('Demande annulée', true);
    setTimeout(function () { window.location.href = 'logistique-validation.html'; }, 900);
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
