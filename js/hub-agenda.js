/* ============================================================================
   HUB-AGENDA v1.0 — module partagé du patron agenda (AGENDA-HUB-PATRON, pt 147)
   ----------------------------------------------------------------------------
   Grille horaire hebdomadaire + mini-mois navigateur + plein écran + légende
   + modale de détail + repli mobile en liste empilée.

   ORIGINE : extraction SANS changement de comportement du bloc ag* de
   suivi-salarie.html (SUIVI-AGENDA-TOUS-TYPES, FAIT FOI pt 145 §4 + ADDENDUM 1,
   version déployée md5 14d7de7e9ff04d9d8bdf76c9fcffef39). Le code des rendus
   est repris À L'IDENTIQUE au scoping/paramétrage près — chaque adaptation est
   tracée dans la table de migration du chantier (pt 147).

   DOCTRINE (FAIT FOI AGENDA-HUB-PATRON v1, gelé le 04/07/2026) :
   - Le module ne connaît NI Supabase, NI les RPC, NI les rôles : chaque page
     fournit un adaptateur (fetchWindow) et injecte l'action métier de la
     modale de détail (garde d'écriture, verrous, flux d'édition).
   - Multi-instances : tout le DOM est généré DANS le container fourni, toutes
     les références sont scopées à l'instance (aucun getElementById global).
   - CSS structurel dans css/hub-agenda.css (préfixe ag- conservé) ; la palette
     de couleurs par type (.t-<code>) est fournie PAR LA PAGE consommatrice.
   - Interdits : appel réseau direct, dépendance au CSS d'une page, logique de
     rôle, comportement divergent de l'agenda salarié d'origine.

   CONTRAT — HubAgenda.create(container, config) :
     container : Element vide ; reçoit la classe ag-root et le squelette.
     config = {
       titre        : str  — titre de la section (ex. 'Agenda — toutes les séances'),
       libelleVide  : str  — message de semaine vide en liste mobile,
       fetchWindow  : function (debutISO, finISO) -> Promise<item[]>,
       types        : [ { code, lib }, … ]  — ordre = ordre de légende,
       detail       : {
         titre  : function (item) -> str,
         rows   : function (item) -> [ { lbl, val }, … ],
         action : function (item) -> null | { label, disabled, title,
                                              onClick(item, closeDetail) }
       },
       capacites    : { pleinEcran: bool, caseAnnulees: bool },
       estAnnulee   : function (item) -> bool   (défaut : etat === 'annulee'),
       etatMark     : function (item) -> str    (défaut : ''),
       onError      : function (error)          (défaut : silencieux)
     }
     item = { id, date:'YYYY-MM-DD', heure:'HH:MM'|null, duree_min:int|null,
              type:code, libelle:str|null, etat:str, meta:<opaque> }
     Retour : { init() -> Promise, refresh() -> Promise (no-op si non
                initialisée), isFullscreen() -> bool }
   ========================================================================== */
(function () {
  'use strict';

  // ---- Dates (copies privées de suivi-salarie.html — anti-UTC + lundi ISO ;
  //      duplication tracée G5 : la page garde les siennes pour ses autres usages) ----
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function mondayOf(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = (x.getDay() + 6) % 7; // 0 = lundi
    x.setDate(x.getDate() - day);
    return x;
  }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function sameYMD(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  var JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // Libellé de durée (« 45 min », « 2 h », « 1 h 30 »). Exposé en utilitaire
  // statique : les pages en ont besoin pour composer leurs lignes de détail.
  function dureeLabel(min) {
    if (min == null) return '';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), r = min % 60;
    return r === 0 ? (h + ' h') : (h + ' h ' + (r < 10 ? '0' + r : r));
  }

  var AG_PXMIN = 0.7;    // px par minute (grille horaire)
  var AG_MINH = 22;      // hauteur mini d'un evenement (lisibilite)

  function create(container, cfg) {
    cfg = cfg || {};
    var capacites = cfg.capacites || {};
    var estAnnulee = cfg.estAnnulee || function (it) { return it.etat === 'annulee'; };
    var etatMark = cfg.etatMark || function () { return ''; };
    var onError = cfg.onError || function () {};
    var typeByCode = {};
    (cfg.types || []).forEach(function (t) { typeByCode[t.code] = t; });
    function typeLabel(code) { var t = typeByCode[code]; return t ? t.lib : (code || '—'); }

    var state = {
      weekStart: null,     // Date (lundi ISO) de la semaine affichee
      monthAnchor: null,   // 1er du mois affiche dans le mini-mois
      showAnnulees: false, // Q5 : annulees masquees par defaut
      rows: [],            // cache de la fenetre courante
      fullscreen: false,
      inited: false
    };

    // ---- Squelette (reprend À L'IDENTIQUE le HTML statique extrait de la page :
    //      mêmes classes, mêmes libellés de contrôles ; ids fixes -> refs d'instance) ----
    var els = {};
    function el(tag, className, text) {
      var e = document.createElement(tag);
      if (className) e.className = className;
      if (text != null) e.textContent = text;
      return e;
    }
    function buildSkeleton() {
      container.classList.add('ag-root');
      var head = el('div', 'ag-head');
      head.appendChild(el('h2', null, cfg.titre || 'Agenda'));
      var ctrls = el('div', 'ag-head-ctrls');
      if (capacites.caseAnnulees) {
        var chk = el('label', 'ag-chk');
        els.showAnnulees = el('input');
        els.showAnnulees.type = 'checkbox';
        chk.appendChild(els.showAnnulees);
        chk.appendChild(document.createTextNode(' afficher les annulées'));
        ctrls.appendChild(chk);
      }
      if (capacites.pleinEcran) {
        els.fsBtn = el('button', 'ag-fsbtn', '⛶ Plein écran');
        els.fsBtn.type = 'button';
        ctrls.appendChild(els.fsBtn);
      }
      head.appendChild(ctrls);
      container.appendChild(head);

      var layout = el('div', 'ag-layout');
      var main = el('div', 'ag-main');
      var weeknav = el('div', 'ag-weeknav');
      els.weekPrev = el('button', null, '‹ Semaine préc.'); els.weekPrev.type = 'button';
      els.weekLabel = el('span', 'ag-weeklabel', '—');
      els.weekNext = el('button', null, 'Semaine suiv. ›'); els.weekNext.type = 'button';
      weeknav.appendChild(els.weekPrev); weeknav.appendChild(els.weekLabel); weeknav.appendChild(els.weekNext);
      main.appendChild(weeknav);
      var week = el('div', 'ag-week');
      els.weekHd = el('div', 'ag-weekhd');
      els.weekBody = el('div', 'ag-weekbody');
      week.appendChild(els.weekHd); week.appendChild(els.weekBody);
      main.appendChild(week);
      els.list = el('div', 'ag-list');
      main.appendChild(els.list);
      layout.appendChild(main);

      var mini = el('aside', 'ag-mini');
      els.mini = mini;
      var mininav = el('div', 'ag-mininav');
      els.miniPrev = el('button', null, '‹'); els.miniPrev.type = 'button'; els.miniPrev.setAttribute('aria-label', 'Mois précédent');
      els.miniLabel = el('span', 'ag-minilabel', '—');
      els.miniNext = el('button', null, '›'); els.miniNext.type = 'button'; els.miniNext.setAttribute('aria-label', 'Mois suivant');
      els.miniToggle = el('button', 'ag-fsbtn ag-minitoggle', 'Replier'); els.miniToggle.type = 'button';
      mininav.appendChild(els.miniPrev); mininav.appendChild(els.miniLabel); mininav.appendChild(els.miniNext); mininav.appendChild(els.miniToggle);
      mini.appendChild(mininav);
      els.miniGrid = el('div', 'ag-minigrid');
      mini.appendChild(els.miniGrid);
      els.legend = el('div', 'ag-legend');
      mini.appendChild(els.legend);
      layout.appendChild(mini);
      container.appendChild(layout);
    }

    // Modale de détail : générique (titre + lignes lbl/val + Fermer + action
    // injectée par la page). Classes ag-overlay/ag-modal/ag-btn : règles copiées
    // à l'identique de ss-overlay/ss-modal/ss-btn dans css/hub-agenda.css
    // (écart tracé §3 du FAIT FOI — z-index 60 CONSERVÉ, au-dessus du plein
    // écran z-50 : correctif recette du 04/07 toujours effectif).
    function buildDetailModal() {
      els.overlay = el('div', 'ag-overlay');
      var modal = el('div', 'ag-modal');
      modal.style.maxWidth = '460px';
      els.detTitre = el('h3', null, '—');
      modal.appendChild(els.detTitre);
      els.detRows = el('div');
      modal.appendChild(els.detRows);
      var act = el('div', 'ag-modal-act');
      els.detCancel = el('button', 'ag-btn ag-btn-ghost', 'Fermer'); els.detCancel.type = 'button';
      els.detAction = el('button', 'ag-btn', 'Modifier'); els.detAction.type = 'button'; els.detAction.hidden = true;
      act.appendChild(els.detCancel); act.appendChild(els.detAction);
      modal.appendChild(act);
      els.overlay.appendChild(modal);
      document.body.appendChild(els.overlay);
    }

    // Rows filtrees (Q5 : annulees masquees sauf case cochee).
    function filteredRows() {
      if (state.showAnnulees) return state.rows.slice();
      return state.rows.filter(function (it) { return !estAnnulee(it); });
    }

    // Libelle de puce : « heure · duree » + libelle (repli : libelle du type). Q3.
    function chipText(it) {
      var bits = [];
      if (it.heure) bits.push(it.heure);
      var dl = dureeLabel(it.duree_min);
      if (dl) bits.push(dl);
      var head = bits.join(' · ');
      var lib = it.libelle || typeLabel(it.type);
      return { head: head, lib: lib };
    }

    // Un evenement de grille (positionne en absolu) OU une puce empilee (liste/untimed).
    function buildEvent(it, positioned) {
      var e = document.createElement('div');
      e.className = (positioned ? 'ag-ev ' : 'ag-chip ') + 't-' + it.type + ' ' + it.etat;
      var t = chipText(it);
      var mark = etatMark(it);
      var pt = document.createElement('div');
      pt.className = 'ag-ev-t';
      pt.textContent = (t.head ? t.head + ' ' : '') + (mark ? mark + ' ' : '');
      var pl = document.createElement('div');
      pl.className = 'ag-ev-l';
      pl.textContent = t.lib;                 // texte libre -> textContent (jamais innerHTML)
      e.appendChild(pt);
      e.appendChild(pl);
      e.addEventListener('click', function () { openDetail(it); });
      return e;
    }

    // ---- Grille horaire (semaine) ----
    function renderWeek() {
      var hd = els.weekHd; var body = els.weekBody;
      hd.innerHTML = ''; body.innerHTML = '';
      var rows = filteredRows();
      var wk = state.weekStart;
      var days = [];
      for (var i = 0; i < 7; i++) { var d = addDays(wk, i); days.push({ d: d, iso: isoDate(d), timed: [], untimed: [] }); }
      var byIso = {};
      days.forEach(function (dd) { byIso[dd.iso] = dd; });
      rows.forEach(function (it) {
        var dd = byIso[it.date];
        if (!dd) return;
        if (it.heure) dd.timed.push(it); else dd.untimed.push(it);
      });

      // Plage horaire dynamique : min heure -1 -> max fin +1 ; repli 08-19 si vide.
      var minH = 24, maxH = 0, has = false;
      days.forEach(function (dd) {
        dd.timed.forEach(function (it) {
          has = true;
          var sh = parseInt(String(it.heure).slice(0, 2), 10);
          var sm = parseInt(String(it.heure).slice(3, 5), 10);
          var start = sh * 60 + sm;
          var dur = (it.duree_min != null ? it.duree_min : 60);
          minH = Math.min(minH, Math.floor(start / 60));
          maxH = Math.max(maxH, Math.ceil((start + dur) / 60));
        });
      });
      if (!has) { minH = 8; maxH = 19; } else { minH = Math.max(0, minH - 1); maxH = Math.min(24, maxH + 1); }
      var rangeMin = (maxH - minH) * 60;
      var bodyH = rangeMin * AG_PXMIN;
      var todayIso = isoDate(new Date());

      // En-tete : cellule d'axe vide + 7 jours.
      var axisHd = document.createElement('div'); axisHd.className = 'ag-hcell ag-axis'; axisHd.textContent = '';
      hd.appendChild(axisHd);
      days.forEach(function (dd, idx) {
        var c = document.createElement('div');
        c.className = 'ag-hcell' + (dd.iso === todayIso ? ' today' : '');
        c.textContent = JOURS[idx] + ' ' + dd.d.getDate();
        hd.appendChild(c);
      });

      // Corps : colonne d'axe (labels heures) + 7 colonnes-jour.
      var axis = document.createElement('div');
      axis.className = 'ag-axiscol'; axis.style.height = bodyH + 'px';
      for (var h = minH; h <= maxH; h++) {
        var lbl = document.createElement('div');
        lbl.className = 'ag-hourlbl';
        lbl.style.top = ((h - minH) * 60 * AG_PXMIN) + 'px';
        lbl.textContent = (h < 10 ? '0' + h : h) + 'h';
        axis.appendChild(lbl);
      }
      body.appendChild(axis);

      days.forEach(function (dd) {
        var col = document.createElement('div');
        col.className = 'ag-daycol'; col.style.height = bodyH + 'px';
        // Lignes horaires.
        for (var h2 = minH; h2 <= maxH; h2++) {
          var line = document.createElement('div');
          line.className = 'ag-hourline';
          line.style.top = ((h2 - minH) * 60 * AG_PXMIN) + 'px';
          col.appendChild(line);
        }
        // Seances sans heure : bandeau en tete de colonne.
        if (dd.untimed.length) {
          var ut = document.createElement('div');
          ut.className = 'ag-untimed';
          dd.untimed.forEach(function (it) { ut.appendChild(buildEvent(it, false)); });
          col.appendChild(ut);
        }
        // Seances horodatees : positionnees + partage de largeur (chevauchements).
        layoutTimed(dd.timed).forEach(function (pos) {
          var it = pos.it;
          var sh = parseInt(String(it.heure).slice(0, 2), 10);
          var sm = parseInt(String(it.heure).slice(3, 5), 10);
          var start = sh * 60 + sm;
          var dur = (it.duree_min != null ? it.duree_min : 60);
          var top = (start - minH * 60) * AG_PXMIN;
          var hgt = Math.max(dur * AG_PXMIN, AG_MINH);
          var ev = buildEvent(it, true);
          ev.style.top = top + 'px';
          ev.style.height = hgt + 'px';
          ev.style.left = (pos.lane / pos.lanes * 100) + '%';
          ev.style.width = (1 / pos.lanes * 100) + '%';
          col.appendChild(ev);
        });
        body.appendChild(col);
      });
    }

    // Partage de largeur : algorithme glouton par grappe de chevauchement.
    function layoutTimed(list) {
      var evs = list.map(function (it) {
        var sh = parseInt(String(it.heure).slice(0, 2), 10);
        var sm = parseInt(String(it.heure).slice(3, 5), 10);
        var start = sh * 60 + sm;
        var dur = (it.duree_min != null ? it.duree_min : 60);
        return { it: it, start: start, end: start + dur, lane: 0, lanes: 1 };
      });
      evs.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
      var out = [];
      var batch = [];
      var lanesEnd = [];        // fin courante de chaque lane du batch
      function flush() {
        var n = lanesEnd.length || 1;
        batch.forEach(function (e) { e.lanes = n; out.push(e); });
        batch = []; lanesEnd = [];
      }
      evs.forEach(function (e) {
        if (batch.length && e.start >= Math.max.apply(null, lanesEnd)) flush();
        var placed = false;
        for (var i = 0; i < lanesEnd.length; i++) {
          if (e.start >= lanesEnd[i]) { e.lane = i; lanesEnd[i] = e.end; placed = true; break; }
        }
        if (!placed) { e.lane = lanesEnd.length; lanesEnd.push(e.end); }
        batch.push(e);
      });
      flush();
      return out;
    }

    // ---- Liste empilee (mobile, Q6 : jours vides masques) ----
    function renderList() {
      var host = els.list; host.innerHTML = '';
      var rows = filteredRows();
      var wk = state.weekStart;
      for (var i = 0; i < 7; i++) {
        var d = addDays(wk, i); var iso = isoDate(d);
        var dayRows = rows.filter(function (it) { return it.date === iso; });
        dayRows.sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
        if (!dayRows.length) continue;                 // jour vide masque
        var blk = document.createElement('div'); blk.className = 'ag-lday';
        var h4 = document.createElement('h4');
        h4.textContent = JOURS[i] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()];
        blk.appendChild(h4);
        dayRows.forEach(function (it) { blk.appendChild(buildEvent(it, false)); });
        host.appendChild(blk);
      }
      if (!host.children.length) {
        var e = document.createElement('div'); e.className = 'ag-empty'; e.textContent = cfg.libelleVide || 'Aucun élément cette semaine.';
        host.appendChild(e);
      }
    }

    // ---- Mini-mois navigateur ----
    function renderMini() {
      var lbl = els.miniLabel; var grid = els.miniGrid;
      var anchor = state.monthAnchor;
      lbl.textContent = MOIS[anchor.getMonth()] + ' ' + anchor.getFullYear();
      grid.innerHTML = '';
      var dows = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
      dows.forEach(function (x) { var c = document.createElement('div'); c.className = 'ag-minidow'; c.textContent = x; grid.appendChild(c); });

      // Jours a pastille (fenetre courante, filtrage Q5).
      var withItem = {};
      filteredRows().forEach(function (it) { withItem[it.date] = true; });

      var first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      var gridStart = mondayOf(first);
      var selMon = state.weekStart ? isoDate(state.weekStart) : null;
      var todayIso = isoDate(new Date());
      for (var k = 0; k < 42; k++) {
        var d = addDays(gridStart, k);
        var iso = isoDate(d);
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'ag-miniday'
          + (d.getMonth() !== anchor.getMonth() ? ' oth' : '')
          + (selMon && isoDate(mondayOf(d)) === selMon ? ' selweek' : '')
          + (iso === todayIso ? ' today' : '');
        cell.textContent = String(d.getDate());
        if (withItem[iso]) { var dot = document.createElement('span'); dot.className = 'ag-dot'; cell.appendChild(dot); }
        (function (dd) {
          cell.addEventListener('click', function () {
            state.weekStart = mondayOf(dd);
            fetchAndRender().catch(onError);
          });
        })(d);
        grid.appendChild(cell);
      }
    }

    // ---- Legende (ordre = config.types) ----
    function renderLegend() {
      var host = els.legend; if (!host || host.dataset.done === '1') return;
      (cfg.types || []).forEach(function (t) {
        var lg = document.createElement('span'); lg.className = 'ag-lg';
        var sw = document.createElement('span'); sw.className = 'ag-sw t-' + t.code;
        lg.appendChild(sw);
        var tx = document.createElement('span'); tx.textContent = t.lib;
        lg.appendChild(tx);
        host.appendChild(lg);
      });
      host.dataset.done = '1';
    }

    // ---- Fenetre de donnees : union [semaine affichee ∪ grille mini-mois 42 j] ----
    function windowOf() {
      var wkStart = state.weekStart, wkEnd = addDays(wkStart, 6);
      var mFirst = new Date(state.monthAnchor.getFullYear(), state.monthAnchor.getMonth(), 1);
      var mStart = mondayOf(mFirst), mEnd = addDays(mStart, 41);
      var debut = (wkStart < mStart) ? wkStart : mStart;
      var fin = (wkEnd > mEnd) ? wkEnd : mEnd;
      return { debut: debut, fin: fin };
    }
    function renderAll() { renderWeek(); renderList(); renderMini(); renderLegend(); updateWeekLabel(); }
    function updateWeekLabel() {
      var s = state.weekStart, e = addDays(s, 6);
      els.weekLabel.textContent = s.getDate() + ' ' + MOIS[s.getMonth()] + ' – ' + e.getDate() + ' ' + MOIS[e.getMonth()];
    }
    async function fetchAndRender() {
      var w = windowOf();
      var data = await cfg.fetchWindow(isoDate(w.debut), isoDate(w.fin));
      state.rows = data || [];
      renderAll();
    }

    // ---- Modale de detail (Q4) — contenu injecté par config.detail ----
    var detailCourant = null;
    var actionCourante = null;
    function openDetail(it) {
      detailCourant = it;
      els.detTitre.textContent = (cfg.detail && cfg.detail.titre) ? cfg.detail.titre(it) : (it.libelle || typeLabel(it.type));
      els.detRows.innerHTML = '';
      var rows = (cfg.detail && cfg.detail.rows) ? cfg.detail.rows(it) : [];
      rows.forEach(function (r) {
        var row = el('div', 'ag-det-row');
        row.appendChild(el('span', 'ag-det-lbl', r.lbl));
        row.appendChild(el('span', null, r.val != null ? r.val : '—'));
        els.detRows.appendChild(row);
      });
      // Action métier (ex. « Modifier » admin|bureau + verrou A2) : entièrement
      // décidée par la page — le module ne porte aucune logique de rôle.
      actionCourante = (cfg.detail && cfg.detail.action) ? cfg.detail.action(it) : null;
      var btn = els.detAction;
      if (actionCourante) {
        btn.hidden = false;
        btn.disabled = !!actionCourante.disabled;
        btn.title = actionCourante.title || '';
        btn.textContent = actionCourante.label || 'Modifier';
      } else {
        btn.hidden = true;
      }
      els.overlay.classList.add('open');
    }
    function closeDetail() { els.overlay.classList.remove('open'); detailCourant = null; actionCourante = null; }

    // ---- Plein ecran (Q2 : classe CSS + verrou scroll + Echap ; pas d'API Fullscreen) ----
    function setFullscreen(on) {
      state.fullscreen = !!on;
      container.classList.toggle('ag-fs', state.fullscreen);
      document.body.classList.toggle('ag-fs-lock', state.fullscreen);
      if (els.fsBtn) els.fsBtn.textContent = state.fullscreen ? '⛶ Quitter' : '⛶ Plein écran';
      if (state.fullscreen) { renderWeek(); }  // relayout a la nouvelle largeur
    }

    // ---- Cablage ----
    function wireEvents() {
      els.weekPrev.addEventListener('click', function () {
        state.weekStart = addDays(state.weekStart, -7);
        fetchAndRender().catch(onError);
      });
      els.weekNext.addEventListener('click', function () {
        state.weekStart = addDays(state.weekStart, 7);
        fetchAndRender().catch(onError);
      });
      els.miniPrev.addEventListener('click', function () {
        state.monthAnchor = new Date(state.monthAnchor.getFullYear(), state.monthAnchor.getMonth() - 1, 1);
        fetchAndRender().catch(onError);
      });
      els.miniNext.addEventListener('click', function () {
        state.monthAnchor = new Date(state.monthAnchor.getFullYear(), state.monthAnchor.getMonth() + 1, 1);
        fetchAndRender().catch(onError);
      });
      if (els.showAnnulees) {
        els.showAnnulees.addEventListener('change', function () {
          state.showAnnulees = els.showAnnulees.checked;
          renderAll();
        });
      }
      if (els.fsBtn) {
        els.fsBtn.addEventListener('click', function () { setFullscreen(!state.fullscreen); });
      }
      els.miniToggle.addEventListener('click', function () { els.mini.classList.toggle('ag-mini-collapsed'); });
      els.detCancel.addEventListener('click', closeDetail);
      els.detAction.addEventListener('click', function () {
        if (actionCourante && actionCourante.onClick && detailCourant) {
          actionCourante.onClick(detailCourant, closeDetail);
        }
      });
      els.overlay.addEventListener('click', function (e) { if (e.target === els.overlay) closeDetail(); });
      // Echap : ferme la modale de detail, sinon sort du plein ecran (Q2/Q4). Additif :
      // les modales existantes ne consomment pas Echap, aucun conflit.
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (els.overlay.classList.contains('open')) { closeDetail(); return; }
        if (state.fullscreen) { setFullscreen(false); }
      });
    }

    async function init() {
      state.weekStart = mondayOf(new Date());
      var t = new Date();
      state.monthAnchor = new Date(t.getFullYear(), t.getMonth(), 1);
      state.showAnnulees = false;
      state.inited = true;
      await fetchAndRender();
    }
    async function refresh() {
      if (!state.inited) return;   // no-op tant que init() n'a pas ete appelee
      await fetchAndRender();
    }

    buildSkeleton();
    buildDetailModal();
    wireEvents();

    return {
      init: init,
      refresh: refresh,
      isFullscreen: function () { return state.fullscreen; }
    };
  }

  window.HubAgenda = {
    version: '1.0',
    create: create,
    dureeLabel: dureeLabel
  };
})();
