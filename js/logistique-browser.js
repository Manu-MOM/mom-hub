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
 * MULTI-CATEGORIES (FAIT FOI gelé 05/07/2026) : pioches catégories ET
 * responsables en cases à cocher (patron logi-days, M5/M6 complète).
 * Ordre de coche = ordre du tableau (T4) ; 1er coché = catégorie
 * principale / responsable officiel (scalaire, trigger T1 sql_156).
 * Responsables = UNION du staff des catégories cochées (T3 : un appel
 * listStaffDisponibles par catégorie, fusion dédupliquée côté front).
 * B5 souple (M2) : au moins une catégorie autorisée ; aucune coche =
 * « Bureau / Autre » (tableau vide), réservé transverses (M3) — le
 * guichet l'autorise donc seulement si isTransverse, la policy tranche.
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
  // Exceptions (sql_155, E6/E7) : les dates de dates_exclues sont
  // sautées APRÈS le calcul d'occurrence — un monthly dont la 1re
  // occurrence est exclue ne projette RIEN ce mois-là (pas de report),
  // d'où le marqueur moisPris posé AVANT le saut (aligné jumelles).
  // ============================================================
  function getOccurrences(rule, yr, mo) {
    if (!rule.active || rule.statut !== 'approved') return [];
    const until = new Date(rule.date_fin + 'T23:59:59');
    // Borne basse date_debut (sql_151, A1/A3 cycle de vie 07/2026) :
    // AUCUNE occurrence avant date_debut, toutes fréquences.
    // NULL = pas de borne (sémantique historique préservée).
    const depuis = rule.date_debut
      ? new Date(rule.date_debut + 'T00:00:00') : null;
    const dim = new Date(yr, mo + 1, 0).getDate();
    const occ = [];
    const exclues = rule.dates_exclues || [];
    let moisPris = false;
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(yr, mo, d);
      const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1; // 0=Lun..6=Dim
      if (rule.jours.indexOf(dow) === -1) continue;
      if (dt > until) continue;
      if (depuis && dt < depuis) continue;
      if (rule.freq === 'biweekly') {
        if (depuis) {
          // A2 : blocs de 7 jours ancrés sur date_debut (bloc 0 =
          // semaine de départ) ; arrondi JOUR pour neutraliser les
          // bascules d'heure d'été.
          const jrs = Math.round((dt - depuis) / 86400000);
          if (Math.floor(jrs / 7) % 2 !== 0) continue;
        } else {
          // Repli historique (date_debut NULL) : parité vs 1er janvier
          // de l'année de l'occurrence — formule d'origine inchangée.
          const wk = Math.floor((dt - new Date(yr, 0, 1)) / 604800000);
          if (wk % 2 !== 0) continue;
        }
      }
      // monthly : 1re occurrence du/des jour(s) dans le mois >= borne
      // (la borne s'applique AVANT le marqueur « première » — A3).
      if (rule.freq === 'monthly') {
        if (moisPris) continue;
        moisPris = true;
      }
      // E6 : saut de la date exclue APRÈS la pose du marqueur monthly
      // (l'occurrence exclue est consommée, jamais reportée).
      if (exclues.indexOf(dayKey(yr, mo, d)) !== -1) continue;
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
    catCoches: [],         // uuid[] catégories cochées, ORDRE DE COCHE (T4)
    respCoches: [],        // uuid[] responsables cochés, ORDRE DE COCHE (T4)
    recurOn: false,
    recurJours: [],
    // --- SURFACE-DEMANDEUR ----------------------------------------
    // « Mes demandes » = celles dont je suis le responsable OFFICIEL
    // (responsable_personne_id = qui_suis_je(), garde S2 des RPC).
    moiPersonneId: null,     // personne_id reliée au compte, ou null
    refById: {},             // uuid ressource -> { libelle, code } (toutes)
    catByIdEdit: {},         // uuid catégorie -> libellé (référentiel complet)
    editCtx: null,           // { src:'reservation'|'recurrence', row } édition
    editJours: [],           // jours cochés dans la modale (règle)
    editCats: [],            // uuid[] catégories cochées, ordre de coche (T4)
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
    // PERSONA-NON-STAFF (décision Manu, régression pt 194) : un membre
    // connecté SANS catégorie (ex : Jules) ne doit pas voir le formulaire de
    // NOUVELLE demande (geste d'écriture réservé au staff d'une catégorie).
    // On masque la zone de saisie + on affiche un bandeau honnête ; les
    // agendas et « Mes demandes » (consultation) restent intacts. Sécurité
    // déjà assurée en base (la policy tranche au submit).
    if (_perimetreVideLogi()) {
      _masquerSaisieLogi();
    } else {
      wireForm();
    }
    applyUrlPrefill();
    await refreshAgenda();
    await refreshCalendar();

    // SURFACE-DEMANDEUR : identité courante, référentiels de la modale
    // (toutes ressources + toutes catégories), câblage de la modale,
    // puis rendu de « Mes demandes ». Tout est fail-soft : un souci ici
    // ne casse pas la saisie ni les agendas.
    try {
      state.moiPersonneId = await SupabaseHub.quiSuisJe();
    } catch (e) { state.moiPersonneId = null; }
    await loadRefEdition();
    wireEdition();
    await refreshMesDemandes();

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

  // PERSONA-NON-STAFF : périmètre vide = non-transverse ET aucune catégorie
  // rattachée (membre ordinaire connecté sans fonction, ex : Jules).
  function _perimetreVideLogi() {
    return !state.isTransverse
      && (!Array.isArray(state.categories) || state.categories.length === 0);
  }

  // Masque la section « Nouvelle demande » (ressources + champs) et affiche
  // un bandeau honnête à la place. Les agendas et « Mes demandes »
  // (consultation) ne sont PAS touchés.
  function _masquerSaisieLogi() {
    var ress = el('logi-ressources');
    var section = ress ? ress.closest('.logi-section') : null;
    if (section) {
      section.innerHTML = '<h3 class="logi-section__title">Nouvelle demande</h3>'
        + '<div class="logi-empty" style="line-height:1.5;">'
        + 'Aucune catégorie ne vous est rattachée. La réservation est '
        + 'réservée aux encadrants d\'une catégorie.</div>';
    }
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
    const host = el('logi-categorie');
    if (!host) return;
    host.innerHTML = '';
    state.catCoches = [];
    // MULTI (M5) : cases à cocher patron logi-days, ordre de coche = ordre
    // du tableau (T4). Plus d'option « Bureau / Autre » explicite : AUCUNE
    // coche = tableau vide = Bureau/Autre (M3), permis aux seuls
    // transverses (contrôle au submit, la policy tranche en dernier).
    state.categories
      .slice()
      .sort(function (a, b) { return (a.ordre_tri || 0) - (b.ordre_tri || 0); })
      .forEach(function (c) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'logi-day';
        b.dataset.id = c.id;
        b.textContent = c.libelle_court || c.code || c.libelle_long || c.id;
        b.addEventListener('click', function () {
          const pos = state.catCoches.indexOf(c.id);
          if (pos === -1) { state.catCoches.push(c.id); b.classList.add('is-on'); }
          else { state.catCoches.splice(pos, 1); b.classList.remove('is-on'); }
          // Synchro inter-écrans : la PREMIÈRE cochée = principale
          if (state.catCoches.length
              && typeof SupabaseHub.memoriserCategorieActive === 'function') {
            SupabaseHub.memoriserCategorieActive(state.catCoches[0]);
          }
          loadResponsables(state.catCoches.slice());
        });
        host.appendChild(b);
      });
    // Synchro inter-écrans : pré-coche la catégorie active mémorisée
    // (clé partagée mom_hub.categorie_active via le socle) si présente.
    try {
      if (typeof SupabaseHub.lireCategorieActiveMemorisee === 'function') {
        const memo = SupabaseHub.lireCategorieActiveMemorisee();
        if (memo && state.categories.some(function (c) { return c.id === memo; })) {
          state.catCoches = [memo];
          const btn = host.querySelector('.logi-day[data-id="' + CSS.escape(memo) + '"]');
          if (btn) btn.classList.add('is-on');
        }
      }
    } catch (e) { /* honnête : pas de synchro, choix manuel */ }
    // Premier chargement responsables (union des coches, possiblement vide)
    loadResponsables(state.catCoches.slice());
  }

  async function loadResponsables(categorieIds) {
    const host = el('logi-responsable');
    if (!host) return;
    host.innerHTML = '<span class="logi-empty">Chargement…</span>';
    // T3 : UNION du staff des catégories cochées — un appel
    // listStaffDisponibles par catégorie (wrapper INCHANGÉ), fusion
    // dédupliquée par personne_id. Aucune coche → listStaffDisponibles(null)
    // = tous les staffs (cas « Bureau / Autre »).
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
      host.innerHTML = '<span class="logi-empty">Aucun encadrant disponible</span>';
      return;
    }
    // M6 complète : cases à cocher, 1er coché = responsable officiel
    // (scalaire), les suivants = indicatifs (tableau, ordre T4).
    staff.forEach(function (p) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'logi-day';
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

  // ============================================================
  // Formulaire — récurrence + soumission
  // ============================================================
  function wireForm() {
    // Toggle récurrence
    // Correctif post-pt 150 (retour terrain) : choix de mode EXPLICITE
    // ponctuelle/récurrente en tête de formulaire. En récurrence le champ
    // Date est MASQUÉ (il ne transporte rien dans ce mode) et sa valeur
    // éventuelle bascule dans « À partir du » (cas réel : date saisie
    // AVANT le choix du mode). Appels explicites : l'assignation .value
    // ne déclenche aucun listener (piège pt 140).
    function appliquerMode(recurrente) {
      state.recurOn = !!recurrente;
      const box = el('logi-recur-box');
      if (box) box.classList.toggle('is-open', state.recurOn);
      const fDate = el('logi-field-date');
      if (fDate) fDate.style.display = state.recurOn ? 'none' : '';
      if (state.recurOn) {
        const deb = el('logi-recur-debut');
        const dateInp = el('logi-date');
        if (deb && !deb.value) {
          if (dateInp && dateInp.value) {
            deb.value = dateInp.value; // la date déjà saisie devient la borne basse
          } else {
            const n = new Date();
            deb.value = dayKey(n.getFullYear(), n.getMonth(), n.getDate());
          }
        }
      }
    }
    const modeP = el('logi-mode-ponctuelle');
    const modeR = el('logi-mode-recurrente');
    if (modeP) modeP.addEventListener('change', function () { if (modeP.checked) appliquerMode(false); });
    if (modeR) modeR.addEventListener('change', function () { if (modeR.checked) appliquerMode(true); });
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
    // MULTI : tableaux ordonnés (T4). 1er élément = principal (scalaire,
    // écrit en double pour rétro-compat, trigger T1 synchronise de toute
    // façon). Aucune catégorie = Bureau/Autre, transverses seulement (M3).
    const categorieIds = state.catCoches.slice();
    const responsables = state.respCoches.slice();
    const date    = (el('logi-date') || {}).value || null;
    const hDebut  = (el('logi-heure-debut') || {}).value || null;
    const hFin    = (el('logi-heure-fin') || {}).value || null;
    const motif   = (el('logi-motif') || {}).value || null;

    if (!state.selectedRessourceId) { showToast('Choisis une ressource', false); return; }
    if (responsables.length === 0) { showToast('Coche au moins un responsable', false); return; }
    if (categorieIds.length === 0 && !state.isTransverse) {
      showToast('Coche au moins une catégorie', false); return;
    }
    if (!hDebut || !hFin) { showToast('Renseigne le créneau', false); return; }

    const submitBtn = el('logi-submit');
    if (submitBtn) submitBtn.disabled = true;

    let res;
    if (state.recurOn) {
      const dateFin   = (el('logi-recur-fin') || {}).value || null;
      const dateDebut = (el('logi-recur-debut') || {}).value || null;
      const freq    = (el('logi-recur-freq') || {}).value || 'weekly';
      if (state.recurJours.length === 0) {
        showToast('Choisis au moins un jour', false);
        if (submitBtn) submitBtn.disabled = false; return;
      }
      if (!dateFin) {
        showToast('Renseigne une date de fin', false);
        if (submitBtn) submitBtn.disabled = false; return;
      }
      // Contrôle formulaire (FAIT FOI §3 : pas de contrainte SQL) :
      // la borne basse ne peut pas dépasser la date de fin.
      if (dateDebut && dateDebut > dateFin) {
        showToast('« À partir du » doit précéder la date de fin', false);
        if (submitBtn) submitBtn.disabled = false; return;
      }
      res = await SupabaseHub.createRecurrence({
        ressource_id: state.selectedRessourceId,
        categorie_id: categorieIds[0] || null,
        categorie_ids: categorieIds,
        responsable_personne_id: responsables[0],
        responsables_personne_ids: responsables,
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
        categorie_id: categorieIds[0] || null,
        categorie_ids: categorieIds,
        responsable_personne_id: responsables[0],
        responsables_personne_ids: responsables,
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
    ['logi-date','logi-heure-debut','logi-heure-fin','logi-motif','logi-recur-fin','logi-recur-debut']
      .forEach(function (id) { if (el(id)) el(id).value = ''; });
    state.recurOn = false;
    state.recurJours = [];
    const mp = el('logi-mode-ponctuelle'); if (mp) mp.checked = true;
    const mr = el('logi-mode-recurrente'); if (mr) mr.checked = false;
    const fd = el('logi-field-date'); if (fd) fd.style.display = '';
    const box = el('logi-recur-box'); if (box) box.classList.remove('is-open');
    // Scopé à #logi-recur-jours : les cases catégories/responsables
    // (mêmes classes logi-day) survivent au submit, comme les anciens
    // <select> qui gardaient leur valeur — retrait tracé (1 ligne réécrite).
    Array.prototype.forEach.call(
      document.querySelectorAll('#logi-recur-jours .logi-day.is-on'),
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
  // SURFACE-DEMANDEUR — « Mes demandes » + modale d'édition demandeur
  // (réplique fidèle de la modale du poste logistique-validation.html,
  // scopée lmd-edit-*, D3=(i) : duplication assumée et tracée). « Mes »
  // = responsable_personne_id = state.moiPersonneId (garde S2). Cohérence
  // droit/visibilité STRICTE : la liste ne montre que ce que la garde
  // des RPC autorise à modifier/annuler.
  // ============================================================

  // Référentiels de la modale : toutes les ressources (id -> {libelle,
  // code}) et toutes les catégories (id -> libellé). Chargés une fois,
  // fail-soft.
  async function loadRefEdition() {
    try {
      const rs = await SupabaseHub.listRessourcesLogistiques() || [];
      rs.forEach(function (r) {
        state.refById[r.id] = { libelle: r.libelle || r.id, code: r.code || '' };
      });
    } catch (e) { /* fail-soft : modale ressource vide */ }
    try {
      const cs = await SupabaseHub.getCategories() || [];
      cs.forEach(function (c) {
        state.catByIdEdit[c.id] = c.libelle_court || c.libelle || c.code || c.id;
      });
    } catch (e) { /* fail-soft : cases catégories vides */ }
  }

  // Une demande est « mienne » si j'en suis le responsable officiel.
  function estMienne(row) {
    return !!state.moiPersonneId
      && row && row.responsable_personne_id === state.moiPersonneId;
  }

  function badgeStatut(statut) {
    var map = {
      pending:  ['lmd-badge--pending',  'En attente'],
      approved: ['lmd-badge--approved', 'Validée'],
      rejected: ['lmd-badge--rejected', 'Refusée']
    };
    var m = map[statut] || ['', statut || ''];
    return '<span class="lmd-badge ' + m[0] + '">' + escapeHtml(m[1]) + '</span>';
  }

  // Rendu tri-source. Statuts affichés : pending + approved + rejected
  // (avec motif_refus enfin visible) ; cancelled masquées (D2). Fenêtre :
  // à venir + 30 jours passés.
  async function refreshMesDemandes() {
    var host = el('logi-mes-demandes');
    if (!host) return;

    if (!state.moiPersonneId) {
      host.innerHTML = '<div class="lmd-empty">Votre compte n\'est pas rattaché à une fiche : vos demandes ne peuvent pas être affichées ici.</div>';
      return;
    }

    var bornePassee = new Date();
    bornePassee.setDate(bornePassee.getDate() - 30);
    var borneISO = bornePassee.getFullYear() + '-' +
      String(bornePassee.getMonth() + 1).padStart(2, '0') + '-' +
      String(bornePassee.getDate()).padStart(2, '0');
    var STATUTS = ['pending', 'approved', 'rejected'];

    var reservations = [], recurrences = [], bus = [];
    try { reservations = await SupabaseHub.listReservations({}) || []; } catch (e) {}
    try { recurrences  = await SupabaseHub.listRecurrences({})  || []; } catch (e) {}
    try { bus          = await SupabaseHub.listDemandesBus({})  || []; } catch (e) {}

    var items = [];
    reservations.forEach(function (r) {
      if (!estMienne(r) || STATUTS.indexOf(r.statut) === -1) return;
      if (r.date && r.date < borneISO) return;
      items.push({ src: 'reservation', id: r.id, statut: r.statut,
        dateTri: r.date || '', row: r,
        titre: (state.refById[r.ressource_id] || {}).libelle || 'Réservation',
        creneau: (r.heure_debut || '').slice(0, 5) + '–' + (r.heure_fin || '').slice(0, 5),
        motif: r.motif || '' });
    });
    recurrences.forEach(function (r) {
      if (!estMienne(r) || STATUTS.indexOf(r.statut) === -1) return;
      if (r.date_fin && r.date_fin < borneISO) return;
      var jrs = (r.jours || []).map(function (j) { return JOURS_LBL[j]; }).join(' ');
      items.push({ src: 'recurrence', id: r.id, statut: r.statut,
        dateTri: r.date_debut || r.date_fin || '', row: r,
        titre: '↻ ' + ((state.refById[r.ressource_id] || {}).libelle || 'Règle') +
          (jrs ? ' · ' + jrs : ''),
        creneau: (r.heure_debut || '').slice(0, 5) + '–' + (r.heure_fin || '').slice(0, 5),
        motif: r.motif || '' });
    });
    bus.forEach(function (r) {
      if (!estMienne(r) || STATUTS.indexOf(r.statut) === -1) return;
      if (r.date && r.date < borneISO) return;
      items.push({ src: 'bus', id: r.id, statut: r.statut,
        dateTri: r.date || '', row: r,
        titre: '🚌 ' + (r.destination || 'Demande de bus'),
        creneau: '', motif: '' });
    });

    items.sort(function (a, b) { return a.dateTri < b.dateTri ? -1 : a.dateTri > b.dateTri ? 1 : 0; });

    if (items.length === 0) {
      host.innerHTML = '<div class="lmd-empty">Vous n\'avez aucune demande en cours.</div>';
      return;
    }

    host.innerHTML = items.map(function (it) {
      var srcLbl = it.src === 'recurrence' ? 'Règle récurrente'
        : it.src === 'bus' ? 'Bus' : 'Réservation';
      var dateLbl = it.dateTri ? formatDateLong(it.dateTri) : '';
      var refus = (it.statut === 'rejected' && it.row.motif_refus)
        ? '<div class="lmd-refus"><b>Motif du refus :</b> ' + escapeHtml(it.row.motif_refus) + '</div>'
        : (it.statut === 'rejected'
            ? '<div class="lmd-refus"><b>Refusée</b> — aucun motif précisé.</div>' : '');
      return '<div class="lmd-card" data-src="' + it.src + '" data-id="' + escapeHtml(it.id) + '">' +
        '<div class="lmd-src">' + escapeHtml(srcLbl) + '</div>' +
        '<div class="lmd-line1">' +
          '<span class="lmd-date">' + escapeHtml(dateLbl) + '</span>' +
          (it.creneau ? '<span class="lmd-creneau">' + escapeHtml(it.creneau) + '</span>' : '') +
          badgeStatut(it.statut) +
        '</div>' +
        '<div class="lmd-motif">' + escapeHtml(it.titre) + (it.motif ? ' — ' + escapeHtml(it.motif) : '') + '</div>' +
        refus +
        '<div class="lmd-actions">' +
          '<button type="button" class="lmd-btn" data-act="modifier">Modifier</button>' +
          '<button type="button" class="lmd-btn" data-act="annuler">Annuler</button>' +
        '</div>' +
      '</div>';
    }).join('');

    Array.prototype.forEach.call(host.querySelectorAll('.lmd-card'), function (card) {
      var src = card.getAttribute('data-src');
      var id  = card.getAttribute('data-id');
      var bMod = card.querySelector('[data-act="modifier"]');
      var bAnn = card.querySelector('[data-act="annuler"]');
      if (bMod) bMod.addEventListener('click', function () { ouvrirEditionDemandeur(src, id); });
      if (bAnn) bAnn.addEventListener('click', function () { annulerDemandeur(src, id); });
    });
  }

  // ------------------------------------------------------------------
  // Modale d'édition demandeur (réplique lgv-edit-* → lmd-edit-*).
  // ------------------------------------------------------------------
  function renderEditCatsDemandeur() {
    var host = el('lmd-edit-categorie');
    if (!host) return;
    host.innerHTML = '';
    Object.keys(state.catByIdEdit).forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lmd-edit-day' + (state.editCats.indexOf(id) !== -1 ? ' is-on' : '');
      b.textContent = state.catByIdEdit[id];
      b.addEventListener('click', function () {
        var pos = state.editCats.indexOf(id);
        if (pos === -1) { state.editCats.push(id); b.classList.add('is-on'); }
        else { state.editCats.splice(pos, 1); b.classList.remove('is-on'); }
      });
      host.appendChild(b);
    });
  }

  function renderEditJoursDemandeur() {
    var host = el('lmd-edit-jours');
    if (!host) return;
    host.innerHTML = '';
    JOURS_LBL.forEach(function (lbl, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lmd-edit-day' + (state.editJours.indexOf(idx) !== -1 ? ' is-on' : '');
      b.textContent = lbl;
      b.addEventListener('click', function () {
        var pos = state.editJours.indexOf(idx);
        if (pos === -1) { state.editJours.push(idx); b.classList.add('is-on'); }
        else { state.editJours.splice(pos, 1); b.classList.remove('is-on'); }
      });
      host.appendChild(b);
    });
  }

  // Occurrences exclues (sql_155, E4/E5) — droit propriétaire (pt 153
  // E2=B1). Les RPC dédiées ne repassent PAS la règle en pending (E3).
  function renderEditExcluesDemandeur() {
    var host = el('lmd-edit-exclues');
    if (!host) return;
    host.innerHTML = '';
    var dates = ((state.editCtx && state.editCtx.row && state.editCtx.row.dates_exclues) || [])
      .slice().sort();
    if (dates.length === 0) {
      host.innerHTML = '<span class="lmd-edit-exclues-vide">Aucune date exclue.</span>';
      return;
    }
    dates.forEach(function (d) {
      var chip = document.createElement('span');
      chip.className = 'lmd-edit-exclue';
      chip.title = formatDateLong(d);
      chip.appendChild(document.createTextNode(formatDateLong(d)));
      var x = document.createElement('button');
      x.type = 'button';
      x.textContent = '\u2715';
      x.title = 'Réinclure cette date';
      x.addEventListener('click', function () { reinclureDateDemandeur(d); });
      chip.appendChild(x);
      host.appendChild(chip);
    });
  }

  async function exclureDateDemandeur() {
    if (!state.editCtx || state.editCtx.src !== 'recurrence') return;
    var inp = el('lmd-edit-exclure-date');
    var d = inp ? inp.value : '';
    if (!d) { showToast('Choisis une date à exclure', false); return; }
    var btn = el('lmd-edit-exclure-btn');
    if (btn) btn.disabled = true;
    var res = await SupabaseHub.exclureOccurrence(state.editCtx.row.id, d);
    if (btn) btn.disabled = false;
    if (!res.ok) { showToast('Échec : ' + (res.error || ''), false); return; }
    if (res.data) state.editCtx.row = res.data;
    if (inp) inp.value = '';
    renderEditExcluesDemandeur();
    showToast('Occurrence exclue — le créneau redevient libre', true);
    await refreshApresEdition();
  }

  async function reinclureDateDemandeur(d) {
    if (!state.editCtx || state.editCtx.src !== 'recurrence') return;
    var res = await SupabaseHub.reinclureOccurrence(state.editCtx.row.id, d);
    if (!res.ok) { showToast('Échec : ' + (res.error || ''), false); return; }
    if (res.data) state.editCtx.row = res.data;
    renderEditExcluesDemandeur();
    showToast('Occurrence réincluse', true);
    await refreshApresEdition();
  }

  async function rechargerLigneDemandeur(src, id) {
    var table = (src === 'recurrence')
      ? 'reservations_recurrentes' : 'reservations_logistiques';
    var q = await SupabaseHub.client.from(table).select('*').eq('id', id).single();
    return q.error ? null : q.data;
  }

  async function ouvrirEditionDemandeur(src, id) {
    // Bus : le mode ?edit= de bus.html porte déjà toute l'édition ;
    // retour intelligent vers le guichet (D5).
    if (src === 'bus') {
      window.location.href = 'bus.html?edit=' + encodeURIComponent(id) + '&retour=logistique';
      return;
    }
    var row = await rechargerLigneDemandeur(src, id);
    if (!row) { showToast('Impossible de recharger la demande.', false); return; }
    if (!estMienne(row)) { showToast('Cette demande ne vous appartient pas.', false); return; }
    if (row.statut === 'cancelled') {
      showToast('Demande annulée : non modifiable (re-créer).', false); return;
    }
    state.editCtx = { src: src, row: row };
    var isRecur = (src === 'recurrence');
    el('lmd-edit-titre').textContent = isRecur
      ? 'Modifier la règle récurrente' : 'Modifier la réservation';

    var sr = el('lmd-edit-ressource');
    if (sr) {
      sr.innerHTML = '';
      Object.keys(state.refById).forEach(function (rid) {
        var o = document.createElement('option');
        o.value = rid; o.textContent = state.refById[rid].libelle;
        sr.appendChild(o);
      });
      sr.value = row.ressource_id || '';
    }
    // MULTI : coches depuis categorie_ids, fallback scalaire (T4).
    state.editCats = (Array.isArray(row.categorie_ids) && row.categorie_ids.length)
      ? row.categorie_ids.slice()
      : (row.categorie_id ? [row.categorie_id] : []);
    renderEditCatsDemandeur();
    el('lmd-edit-hdebut').value = row.heure_debut ? String(row.heure_debut).slice(0, 5) : '';
    el('lmd-edit-hfin').value   = row.heure_fin   ? String(row.heure_fin).slice(0, 5)   : '';
    el('lmd-edit-motif').value  = row.motif || '';
    el('lmd-edit-f-date').style.display = isRecur ? 'none' : '';
    el('lmd-edit-recur').style.display  = isRecur ? '' : 'none';
    if (isRecur) {
      el('lmd-edit-freq').value = row.freq || 'weekly';
      state.editJours = (row.jours || []).slice();
      renderEditJoursDemandeur();
      el('lmd-edit-debut').value = row.date_debut || '';
      el('lmd-edit-fin').value   = row.date_fin || '';
      renderEditExcluesDemandeur();
      var exd = el('lmd-edit-exclure-date');
      if (exd) { exd.value = ''; exd.min = row.date_debut || ''; exd.max = row.date_fin || ''; }
    } else {
      el('lmd-edit-date').value = row.date || '';
    }
    el('lmd-edit-overlay').classList.add('is-open');
  }

  function fermerEditionDemandeur() {
    state.editCtx = null;
    el('lmd-edit-overlay').classList.remove('is-open');
  }

  async function enregistrerEditionDemandeur() {
    if (!state.editCtx) return;
    var btn = el('lmd-edit-enregistrer');
    var hd = el('lmd-edit-hdebut').value || null;
    var hf = el('lmd-edit-hfin').value || null;
    if (!hd || !hf) { showToast('Renseigne le créneau', false); return; }
    var res;
    if (btn) btn.disabled = true;
    if (state.editCtx.src === 'recurrence') {
      if (state.editJours.length === 0) {
        showToast('Choisis au moins un jour', false);
        if (btn) btn.disabled = false; return;
      }
      if (!el('lmd-edit-fin').value) {
        showToast('Renseigne une date de fin', false);
        if (btn) btn.disabled = false; return;
      }
      res = await SupabaseHub.modifierRecurrence(state.editCtx.row.id, {
        ressource_id: el('lmd-edit-ressource').value,
        categorie_id: state.editCats[0] || null,
        categorie_ids: state.editCats.slice(),
        freq: el('lmd-edit-freq').value || 'weekly',
        jours: state.editJours.slice(),
        heure_debut: hd,
        heure_fin: hf,
        date_debut: el('lmd-edit-debut').value || null,
        date_fin: el('lmd-edit-fin').value,
        motif: el('lmd-edit-motif').value || null
      });
    } else {
      if (!el('lmd-edit-date').value) {
        showToast('Renseigne une date', false);
        if (btn) btn.disabled = false; return;
      }
      res = await SupabaseHub.modifierReservation(state.editCtx.row.id, {
        ressource_id: el('lmd-edit-ressource').value,
        categorie_id: state.editCats[0] || null,
        categorie_ids: state.editCats.slice(),
        date: el('lmd-edit-date').value,
        heure_debut: hd,
        heure_fin: hf,
        motif: el('lmd-edit-motif').value || null
      });
    }
    if (btn) btn.disabled = false;
    if (!res.ok) { showToast('Échec : ' + (res.error || ''), false); return; }
    showToast('Demande modifiée — repassée en attente de validation', true);
    fermerEditionDemandeur();
    await refreshApresEdition();
  }

  async function annulerDemandeur(src, id) {
    if (src === 'bus') {
      // L'annulation d'un bus vit dans bus.html (mode ?edit=), retour guichet.
      window.location.href = 'bus.html?edit=' + encodeURIComponent(id) + '&retour=logistique';
      return;
    }
    if (!window.confirm('Annuler définitivement cette demande ? Elle disparaîtra des agendas (trace conservée).')) return;
    var res = (src === 'recurrence')
      ? await SupabaseHub.annulerRecurrence(id)
      : await SupabaseHub.annulerReservation(id);
    if (!res.ok) { showToast('Échec : ' + (res.error || ''), false); return; }
    showToast('Demande annulée', true);
    await refreshApresEdition();
  }

  // Rafraîchit les surfaces après une action demandeur.
  async function refreshApresEdition() {
    await refreshMesDemandes();
    await refreshAgenda();
    await refreshCalendar();
  }

  function wireEdition() {
    var f = el('lmd-edit-fermer');
    if (f) f.addEventListener('click', fermerEditionDemandeur);
    var s = el('lmd-edit-enregistrer');
    if (s) s.addEventListener('click', enregistrerEditionDemandeur);
    var a = el('lmd-edit-annuler-demande');
    if (a) a.addEventListener('click', function () {
      if (!state.editCtx) return;
      annulerDemandeur(state.editCtx.src, state.editCtx.row.id).then(function () {
        fermerEditionDemandeur();
      });
    });
    var ex = el('lmd-edit-exclure-btn');
    if (ex) ex.addEventListener('click', exclureDateDemandeur);
    var ov = el('lmd-edit-overlay');
    if (ov) ov.addEventListener('click', function (e) {
      if (e.target === ov) fermerEditionDemandeur();
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
