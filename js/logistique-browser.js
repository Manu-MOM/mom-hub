/**
 * MOM Hub · Logistique — Browser (logistique.html)
 * ================================================
 * Moteur de réservation simple, filtré par ?type=site|minibus|autre (D6,
 * Option 2). Réplique l'UX de la maquette mom-logistique (réservation +
 * récurrence + agenda + validation), branchée sur le socle Hub :
 * persistance Supabase, RLS B5-saisie, rôles auth_roles.
 *
 * SAISIE adossée B5 : la pioche catégorie = mesCategoriesAutorisees() ;
 * un référent ne réserve que pour sa catégorie. VALIDATION : DÉMÉNAGÉE au
 * poste tri-source logistique-validation.html (REFONTE-PARCOURS-LOGISTIQUE,
 * FAIT FOI 777551e9…, arbitrage 5.5) — le guichet est purifié : demande +
 * occupation seulement, plus aucune interface bureau|admin ici.
 *
 * PRÉ-REMPLISSAGE PAR URL (§5.7 du FAIT FOI) : le boot lit, en plus de
 * ?type=, les paramètres ressource / date / debut / fin posés par l'agenda
 * de consultation (logistique-agenda.html, clic créneau libre) et rejoue la
 * sélection de la carte ressource + les champs du formulaire.
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

  function el(id) { return document.getElementById(id); }

  // ============================================================
  // getOccurrences — réplique fidèle de la maquette.
  // jours : int[] 0=Lundi..6=Dimanche. Renvoie les jours (1..31) du
  // mois (yr, mo 0-based) où la règle s'applique.
  // ============================================================
  // Lundi de la semaine calendaire d'une date (0=Lun..6=Dim) —
  // ancre biweekly du cycle de vie (A2).
  function mondayOf(dt) {
    const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dow);
    return d;
  }

  function getOccurrences(rule, yr, mo) {
    if (!rule.active || rule.statut !== 'approved') return [];
    const until = new Date(rule.date_fin + 'T23:59:59');
    // Cycle de vie (sql_151) : borne basse date_debut, NULL = pas de borne.
    const depuis = rule.date_debut ? new Date(rule.date_debut + 'T00:00:00') : null;
    const dim = new Date(yr, mo + 1, 0).getDate();
    const occ = [];
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(yr, mo, d);
      const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1; // 0=Lun..6=Dim
      if (rule.jours.indexOf(dow) === -1) continue;
      if (dt > until) continue;
      // A3 : AUCUNE occurrence avant date_debut, toutes fréquences.
      if (depuis && dt < depuis) continue;
      if (rule.freq === 'biweekly') {
        if (depuis) {
          // A2 : semaine 0 = semaine calendaire de date_debut, puis 1/2.
          // Math.round absorbe les décalages DST (±1 h).
          const wk = Math.round((mondayOf(dt) - mondayOf(depuis)) / 604800000);
          if (wk % 2 !== 0) continue;
        } else {
          // Repli sans borne : parité vs 1er janvier (sémantique historique).
          const wk = Math.floor((dt - new Date(yr, 0, 1)) / 604800000);
          if (wk % 2 !== 0) continue;
        }
      }
      // monthly : 1re occurrence du/des jour(s) dans le mois — le filtre
      // date_debut s'applique EN AMONT de ce marqueur (A3) : la 1re
      // occurrence projetée est la 1re >= date_debut.
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
    recurOn: false,
    recurJours: [],
    // --- Calendrier d'occupation (v1) -----------------------------
    // Vue unifiée TOUTES ressources (≠ state.ressources qui est filtré
    // au type courant). Chargé une fois au boot, indexé par jour,
    // navigation sans re-fetch (D-Chargement).
    cal: {
      ressById: {},        // ressource_id -> libellé (toutes ressources)
      occByDay: {},        // 'YYYY-MM-DD' -> [ {creneau, res, motif, recur} ]
      viewYear: 0,         // mois affiché (année)
      viewMonth: 0,        // mois affiché (0-based)
      selectedKey: null,   // jour sélectionné 'YYYY-MM-DD'
      minDate: null,       // borne saison début (Date)
      maxDate: null        // borne saison fin (Date)
    }
  };

  // ============================================================
  // Boot
  // ============================================================
  async function boot() {
    // Garde d'auth : tout authentifié (la saisie est pilotée par B5,
    // pas par une garde de page restrictive).
    const session = await SupabaseHub.getSession();
    if (!session) { window.location.replace('login.html'); return; }

    document.body.classList.remove('auth-pending');
    document.body.classList.add('auth-resolved');

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
    applyUrlPrefill();
    await refreshAgenda();
    await refreshCalendar();

    console.log('%c🏉 Logistique chargé', 'color:#2D7D46;font-weight:bold;',
      { type: state.type, ressources: state.ressources.length });
  }

  // ============================================================
  // Pré-remplissage par URL (§5.7 FAIT FOI REFONTE-PARCOURS) :
  // ?ressource=<uuid>&date=<iso>&debut=<hh:mm>&fin=<hh:mm>, posés
  // par le clic créneau libre de logistique-agenda.html. Fail-soft
  // intégral : paramètre absent/invalide → champ laissé tel quel.
  // La carte ressource est sélectionnée en REJOUANT son click()
  // (état + classes + activation du formulaire, un seul chemin).
  // NB : les champs date/heures n'ont pas de listener d'état → le
  // .value programmatique suffit (piège pt 140 sans objet ici).
  // ============================================================
  function applyUrlPrefill() {
    const sp = new URLSearchParams(window.location.search);
    const ressource = sp.get('ressource');
    const date = sp.get('date');
    const debut = sp.get('debut');
    const fin = sp.get('fin');
    if (!ressource && !date && !debut && !fin) return;

    if (ressource) {
      const host = el('logi-ressources');
      const card = host
        ? host.querySelector('.logi-res-card[data-id="' + CSS.escape(ressource) + '"]')
        : null;
      if (card) card.click();
    }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && el('logi-date')) {
      el('logi-date').value = date;
    }
    if (debut && /^\d{2}:\d{2}$/.test(debut) && el('logi-heure-debut')) {
      el('logi-heure-debut').value = debut;
    }
    if (fin && /^\d{2}:\d{2}$/.test(fin) && el('logi-heure-fin')) {
      el('logi-heure-fin').value = fin;
    }
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
    // Synchro inter-écrans : pré-sélectionne la catégorie active
    // mémorisée (clé partagée mom_hub.categorie_active via le socle)
    // si elle figure dans la liste, et mémorise tout nouveau choix.
    try {
      if (typeof SupabaseHub.lireCategorieActiveMemorisee === 'function') {
        const memo = SupabaseHub.lireCategorieActiveMemorisee();
        if (memo && state.categories.some(function (c) { return c.id === memo; })) {
          sel.value = memo;
        }
      }
    } catch (e) { /* honnête : pas de synchro, choix manuel */ }
    // Au changement de catégorie → mémoriser + recharger la pioche responsable
    sel.onchange = function () {
      if (sel.value && typeof SupabaseHub.memoriserCategorieActive === 'function') {
        SupabaseHub.memoriserCategorieActive(sel.value);
      }
      loadResponsables(sel.value || null);
    };
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
        // Cycle de vie (A1) : « À partir du » pré-rempli à la date du
        // jour à l'ouverture (seulement si vide — ne pas écraser un
        // choix). Appel explicite : .value programmatique ne déclenche
        // aucun listener (piège pt 140, sans objet ici).
        if (state.recurOn) {
          const deb = el('logi-recur-debut');
          if (deb && !deb.value) {
            const now = new Date();
            deb.value = now.getFullYear() + '-'
              + String(now.getMonth() + 1).padStart(2, '0') + '-'
              + String(now.getDate()).padStart(2, '0');
          }
        }
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
      const dateFin   = (el('logi-recur-fin') || {}).value || null;
      const dateDebut = (el('logi-recur-debut') || {}).value || null;
      const freq      = (el('logi-recur-freq') || {}).value || 'weekly';
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
        date_debut: dateDebut,
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
  }

  function resetForm() {
    ['logi-date','logi-heure-debut','logi-heure-fin','logi-motif','logi-recur-debut','logi-recur-fin']
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
  // REFONTE-PARCOURS-LOGISTIQUE (FAIT FOI 777551e9…, arbitrage 5.5) :
  // refreshValidation() et refreshRecurrences() (bureau|admin) ont
  // DÉMÉNAGÉ au poste tri-source logistique-validation.html.
  // ============================================================

  // ============================================================
  // CALENDRIER D'OCCUPATION (v1)
  // Conception-Calendrier-Logistique-v1.md
  //   D-Forme       : mini-calendrier latéral + détail du jour
  //   D-Occupation  : approved seulement
  //   D-Temporel    : saison entière (navigation mois par mois)
  //   D-Chargement  : saison chargée 1× au boot, indexée par jour,
  //                   navigation sans re-fetch, ZÉRO nouveau SQL
  //   D-Périmètre   : vue unifiée TOUTES ressources, 3 pages
  //   D-Récurrences : projetées via getOccurrences
  //   D-Détail      : liste créneaux du jour, tri heure+ressource,
  //                   ressource toujours nommée (vue unifiée)
  // ============================================================

  function dayKey(yr, mo /* 0-based */, d) {
    return yr + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // Résout les bornes de la saison via listSaisons() (wrapper Hub
  // existant v1.50, lecture). On n'utilise QUE date_debut/date_fin de
  // la saison active — jamais le `code` parsé (format non fiable, cf.
  // dette DATA-SAISON-CODE-FORMAT). Repli honnête : 12 mois glissants
  // autour d'aujourd'hui si aucune saison active résolue.
  async function resolveSaisonBornes() {
    const now = new Date();
    let min = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    let max = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    try {
      if (SupabaseHub && typeof SupabaseHub.listSaisons === 'function') {
        const res = await SupabaseHub.listSaisons();
        if (res && res.ok && Array.isArray(res.data)) {
          const active = res.data.find(function (s) { return s.est_active === true; });
          if (active && active.date_debut && active.date_fin) {
            // Fenêtre de chargement ÉLARGIE autour de la saison active
            // (−6 mois / +18 mois) : une réservation peut chevaucher la
            // saison suivante (stage d'été, pré-rentrée). La navigation est
            // libre (flèches non bornées) ; cette fenêtre dit seulement
            // jusqu'où les données sont préchargées. Hors fenêtre = mois
            // affiché vide (honnête), pas une erreur.
            const d = new Date(active.date_debut + 'T00:00:00');
            const f = new Date(active.date_fin + 'T23:59:59');
            min = new Date(d.getFullYear(), d.getMonth() - 6, 1);
            max = new Date(f.getFullYear(), f.getMonth() + 18, 0);
          }
        }
      }
    } catch (e) {
      console.warn('Logistique calendrier : bornes saison non résolues, repli 12 mois', e);
    }
    state.cal.minDate = min;
    state.cal.maxDate = max;
  }

  // Itère les mois (year, month 0-based) de la saison, du début à la fin.
  function moisDeLaSaison() {
    const out = [];
    if (!state.cal.minDate || !state.cal.maxDate) return out;
    const cur = new Date(state.cal.minDate.getFullYear(), state.cal.minDate.getMonth(), 1);
    const fin = new Date(state.cal.maxDate.getFullYear(), state.cal.maxDate.getMonth(), 1);
    while (cur <= fin) {
      out.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }

  function pushOcc(key, occ) {
    if (!state.cal.occByDay[key]) state.cal.occByDay[key] = [];
    state.cal.occByDay[key].push(occ);
  }

  // Chargement unique de la saison (D-Chargement) : TOUTES ressources
  // (D-Périmètre), réservations simples approved + occurrences
  // récurrentes projetées (D-Récurrences). Indexé par jour.
  async function loadCalendarData() {
    state.cal.occByDay = {};
    state.cal.ressById = {};

    // 1) Toutes les ressources, tous types (vue unifiée) — appel SANS
    //    filtre, ≠ loadRessources() qui est filtré au type courant.
    let toutesRess = [];
    try {
      toutesRess = await SupabaseHub.listRessourcesLogistiques() || [];
    } catch (e) {
      console.warn('Logistique calendrier : ressources non chargées', e);
      return;
    }
    toutesRess.forEach(function (r) { state.cal.ressById[r.id] = r.libelle; });

    const mois = moisDeLaSaison();

    // 2) Par ressource : simples approved + récurrences approuvées
    for (let i = 0; i < toutesRess.length; i++) {
      const r = toutesRess[i];
      const label = state.cal.ressById[r.id] || '—';

      // Réservations simples approuvées (indexées sur leur date)
      let simples = [];
      try {
        simples = await SupabaseHub.listReservations({ ressourceId: r.id, statut: 'approved' }) || [];
      } catch (e) { simples = []; }
      simples.forEach(function (s) {
        if (!s.date) return;
        pushOcc(s.date, {
          creneau: (s.heure_debut || '').slice(0, 5) + '–' + (s.heure_fin || '').slice(0, 5),
          res: label,
          motif: s.motif || '',
          recur: false,
          hd: (s.heure_debut || '')
        });
      });

      // Règles récurrentes approuvées/actives → projection mois par mois
      let regles = [];
      try {
        regles = await SupabaseHub.listRecurrences({ ressourceId: r.id, statut: 'approved', activeOnly: true }) || [];
      } catch (e) { regles = []; }
      regles.forEach(function (rule) {
        mois.forEach(function (m) {
          const occ = getOccurrences(rule, m.year, m.month); // jours 1..31
          occ.forEach(function (d) {
            const key = dayKey(m.year, m.month, d);
            pushOcc(key, {
              creneau: (rule.heure_debut || '').slice(0, 5) + '–' + (rule.heure_fin || '').slice(0, 5),
              res: label,
              motif: rule.motif || '',
              recur: true,
              hd: (rule.heure_debut || '')
            });
          });
        });
      });
    }
  }

  // Rendu de la grille mensuelle (esprit renderMiniCal d'Évènements :
  // grille L→D, pastille sur jours occupés, is-today). Interaction
  // neuve : clic = sélection du jour → met à jour le détail.
  function renderCalendarGrid() {
    const grid = el('logi-cal-grid');
    const title = el('logi-cal-title');
    if (!grid) return;

    const yr = state.cal.viewYear;
    const mo = state.cal.viewMonth;

    if (title) {
      title.textContent = (MOIS[mo] || '') + ' ' + yr;
    }

    const today = new Date();
    const firstDay = new Date(yr, mo, 1);
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    let startCol = firstDay.getDay() - 1; // 0=Lun
    if (startCol < 0) startCol = 6;

    let html = '';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (w) {
      html += '<div class="logi-cal__wday">' + w + '</div>';
    });
    for (let i = 0; i < startCol; i++) {
      html += '<div class="logi-cal__day logi-cal__day--empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dayKey(yr, mo, d);
      const has = !!(state.cal.occByDay[key] && state.cal.occByDay[key].length);
      const isToday = today.getFullYear() === yr && today.getMonth() === mo && today.getDate() === d;
      const isSel = state.cal.selectedKey === key;
      const cls = ['logi-cal__day',
        has ? 'logi-cal__day--has' : '',
        isToday ? 'logi-cal__day--today' : '',
        isSel ? 'logi-cal__day--selected' : ''
      ].filter(Boolean).join(' ');
      let titleAttr = '';
      if (has) titleAttr = ' title="' + state.cal.occByDay[key].length + ' occupation(s)"';
      html += '<div class="' + cls + '" data-day-key="' + key + '"' + titleAttr + '>' + d + '</div>';
    }
    grid.innerHTML = html;

    grid.querySelectorAll('.logi-cal__day[data-day-key]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        state.cal.selectedKey = this.getAttribute('data-day-key');
        renderCalendarGrid();      // re-peint pour le surlignage
        renderCalendarDetail();
      });
    });

    // Navigation LIBRE (décision Manu pt 69) : les flèches ne sont jamais
    // désactivées — une réservation peut chevaucher d'une saison à l'autre.
    // Le bornage strict à la saison (D-Temporel pt 68) est levé : hypothèse
    // inversée par le fait métier. Les mois hors fenêtre préchargée
    // s'affichent vides (honnête), sans erreur.
    const prev = el('logi-cal-prev');
    const next = el('logi-cal-next');
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  }

  // Détail du jour sélectionné (D-Détail) : liste des créneaux occupés,
  // tri heure_debut puis ressource ; ressource TOUJOURS nommée (vue
  // unifiée → sinon ambigu sur une page de type donné).
  function renderCalendarDetail() {
    const body = el('logi-cal-detail-body');
    const title = el('logi-cal-detail-title');
    if (!body) return;

    const key = state.cal.selectedKey;
    if (!key) {
      body.innerHTML = '<div class="logi-cal__detail-empty">Sélectionnez un jour.</div>';
      if (title) title.textContent = 'Détail du jour';
      return;
    }

    if (title) title.textContent = formatDateLong(key);

    const occ = (state.cal.occByDay[key] || []).slice();
    occ.sort(function (a, b) {
      if (a.hd !== b.hd) return a.hd < b.hd ? -1 : 1;
      return a.res < b.res ? -1 : (a.res > b.res ? 1 : 0);
    });

    if (occ.length === 0) {
      body.innerHTML = '<div class="logi-cal__detail-empty">Aucune occupation ce jour.</div>';
      return;
    }

    body.innerHTML = occ.map(function (it) {
      return '<div class="logi-cal__detail-row">' +
        '<div class="logi-cal__detail-line1">' +
          '<span class="logi-cal__detail-creneau">' + escapeHtml(it.creneau) + '</span>' +
          '<span class="logi-cal__detail-res">' + (it.recur ? '↻ ' : '') + escapeHtml(it.res) + '</span>' +
        '</div>' +
        (it.motif ? '<div class="logi-cal__detail-motif">' + escapeHtml(it.motif) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function wireCalendarNav() {
    const prev = el('logi-cal-prev');
    const next = el('logi-cal-next');
    if (prev) prev.addEventListener('click', function () {
      if (prev.disabled) return;
      let yr = state.cal.viewYear, mo = state.cal.viewMonth - 1;
      if (mo < 0) { mo = 11; yr--; }
      state.cal.viewYear = yr; state.cal.viewMonth = mo;
      renderCalendarGrid();
    });
    if (next) next.addEventListener('click', function () {
      if (next.disabled) return;
      let yr = state.cal.viewYear, mo = state.cal.viewMonth + 1;
      if (mo > 11) { mo = 0; yr++; }
      state.cal.viewYear = yr; state.cal.viewMonth = mo;
      renderCalendarGrid();
    });
  }

  // Orchestration : bornes → données → mois courant (borné saison) →
  // sélection du jour courant par défaut → rendu.
  async function refreshCalendar() {
    if (!el('logi-cal-grid')) return;
    await resolveSaisonBornes();
    await loadCalendarData();

    // Mois affiché = mois courant, mais borné à la saison.
    const now = new Date();
    let viewY = now.getFullYear(), viewM = now.getMonth();
    if (state.cal.minDate && now < state.cal.minDate) {
      viewY = state.cal.minDate.getFullYear(); viewM = state.cal.minDate.getMonth();
    } else if (state.cal.maxDate && now > state.cal.maxDate) {
      viewY = state.cal.maxDate.getFullYear(); viewM = state.cal.maxDate.getMonth();
    }
    state.cal.viewYear = viewY;
    state.cal.viewMonth = viewM;

    // Jour sélectionné par défaut = aujourd'hui s'il est dans la fenêtre
    // affichée, sinon aucun (détail invite à sélectionner).
    if (now.getFullYear() === viewY && now.getMonth() === viewM) {
      state.cal.selectedKey = dayKey(viewY, viewM, now.getDate());
    } else {
      state.cal.selectedKey = null;
    }

    wireCalendarNav();
    renderCalendarGrid();
    renderCalendarDetail();
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
