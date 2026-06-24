/* ============================================================================
 * js/planification-editor.js — Module « Planification annuelle » (MOM Hub)
 * ----------------------------------------------------------------------------
 * Version : 1.0 — juin 2026
 *   [PLANIF-ECRITURE-POLE — juin 2026] Écriture des trames de pôle ouverte
 *   au responsable DÉSIGNÉ (sql_106). Le boot charge les droits réels une
 *   fois (_chargerDroits : transverse / pôles responsables via
 *   mesPolesResponsable / catégories du périmètre) ; le responsable de pôle
 *   non-transverse accède à l'écran de choix COMPLET (tous pôles +
 *   catégories), édite ses cibles, lit le reste (peutEditer calculé par
 *   cible = reflet RLS, jamais accordé par le front). demarrerPole/
 *   demarrerCategorie et deep links ?pole=/?categorie= reflètent ce droit ;
 *   ecranChoixTransverse renommé ecranChoixComplet ; libellés « EDR »
 *   généralisés. Requiert supabase-client ≥ v1.61 (wrapper
 *   mesPolesResponsable) ; dégradation honnête si absent (droits vides).
 *   Éditeur de blocs (modèle repris de MOM Ateliers) + frise emboîtée à l'écran.
 *   Portée CATÉGORIE (référent / transverse) OU PÔLE (transverse uniquement).
 *   Backend : sql/73 (planification_blocs, planification_axes,
 *   mes_poles_autorises) via les wrappers supabase-client v1.51.
 *
 *   Patron d'auth/boot calqué sur pilotage-categorie.html (pt 64) :
 *   mes_categories_autorisees() / mes_poles_autorises() pilotent l'adaptation.
 *   Page HTML mince + ce module (window.PlanificationEditor), comme
 *   stats-saison.js.
 *
 *   Axe individuel = 4 items FIXES (liés biblio), comme l'éditeur Ateliers.
 *   Axes collectif/physique/poste = pioche (planification_axes) + « Autre
 *   (texte libre) » résolu à l'enregistrement (la base ne stocke que la valeur
 *   finale, jamais le couple valeur/custom).
 * ========================================================================== */
(function (global) {
  'use strict';

  var AUTRE = 'Autre (texte libre)';

  // Items fixes de l'axe individuel (ids stables, alignés modèle Ateliers).
  var AXE_INDIV_ITEMS = [
    { id: 'ti-manip',  label: 'Passer / Réceptionner le ballon' },
    { id: 'ti-duels',  label: 'Jouer des duels' },
    { id: 'ti-plaq',   label: 'Plaquer' },
    { id: 'ti-zones',  label: 'Se comporter sur les zones de blocage' }
  ];

  var State = {
    mount: null,
    saison: null,        // { id, code, libelle, date_debut, date_fin }
    portee: null,        // 'categorie' | 'pole'
    cibleId: null,       // categorie_id OU pole_id selon portee
    cibleLabel: '',
    peutEditer: false,   // droit d'écriture sur la cible courante
    axes: { collectif: [], physique: [], poste: [] },
    blocs: [],           // blocs chargés (objets DB) + brouillons locaux
    // Multi-catégories (portée catégorie d'un encadrant N>1) : liste des
    // catégories de son périmètre, pour le sélecteur intégré au header.
    categoriesPerimetre: [],
    // PLANIF-ECRITURE-POLE (front) : cache des droits d'écriture réels,
    // résolu une fois au boot pour refléter la RLS (sql_106) sans la
    // dupliquer. Sets d'UUID éditables ; transverseGlobal = admin/bureau.
    droitsPolesEditables: null,   // Set<pole_id> | null (non résolu)
    droitsCatsEditables: null,    // Set<categorie_id> | null (non résolu)
    transverseGlobal: false       // admin/bureau (édite partout)
  };

  // ---- Helpers ----
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hub() { return global.SupabaseHub; }

  function groupAxes(rows) {
    var g = { collectif: [], physique: [], poste: [] };
    (rows || []).forEach(function (a) {
      if (g[a.type_axe]) g[a.type_axe].push(a.libelle);
    });
    return g;
  }

  // Un bloc « brouillon » (non encore en base) a un id temporaire tmp-*.
  function newBlocDraft() {
    return {
      id: 'tmp-' + Date.now() + '-' + Math.round(Math.random() * 1e6),
      _draft: true,
      saison_id: State.saison ? State.saison.id : null,
      categorie_id: State.portee === 'categorie' ? State.cibleId : null,
      pole_id: State.portee === 'pole' ? State.cibleId : null,
      ordre: State.blocs.length + 1,
      titre: '',
      date_debut: '',
      date_fin: '',
      intercale: false,
      axe_indiv: [],
      axe_collectif: '',
      axe_physique: '',
      axe_poste: '',
      commentaires: ''
    };
  }

  // ---- Chargement du contexte (saison + axes + blocs) ----
  function loadContext() {
    State.mount.innerHTML = '<p class="pa-load">Chargement de la planification…</p>';
    return Promise.all([
      hub().getSaisonActive(),
      hub().listPlanificationAxes(),
      hub().listPlanificationBlocs(
        State.portee === 'pole'
          ? { saisonId: null, poleId: State.cibleId }      // saisonId injecté après
          : { saisonId: null, categorieId: State.cibleId }
      ).catch(function () { return []; }) // sera rechargé après saison résolue
    ]).then(function (res) {
      State.saison = res[0] || null;
      State.axes = groupAxes(res[1]);
      if (!State.saison) {
        State.mount.innerHTML = bloc('Saison introuvable',
          'Aucune saison active n\'est définie. La planification s\'appuie sur la saison active.');
        return;
      }
      // Rechargement des blocs avec la saison réellement résolue.
      var opts = State.portee === 'pole'
        ? { saisonId: State.saison.id, poleId: State.cibleId }
        : { saisonId: State.saison.id, categorieId: State.cibleId };
      return hub().listPlanificationBlocs(opts).then(function (blocs) {
        State.blocs = (blocs || []).map(function (b) {
          b.axe_indiv = Array.isArray(b.axe_indiv) ? b.axe_indiv : [];
          return b;
        });
        render();
      });
    });
  }

  // ---- Rendu : enveloppe ----
  function bloc(titre, corps) {
    return '<section class="pa-card"><h2>' + esc(titre) + '</h2>' + corps + '</section>';
  }

  function enteteContexte() {
    var s = State.saison;
    var pp = State.portee === 'pole' ? 'Trame pôle' : 'Catégorie';
    var lecture = State.peutEditer ? '' :
      '<p class="pa-readonly">Lecture seule — vous n\'avez pas les droits d\'édition sur cette ' +
      (State.portee === 'pole' ? 'trame de pôle.' : 'catégorie.') + '</p>';
    // Sélecteur de catégorie : uniquement en portée catégorie ET si
    // l'encadrant a > 1 catégorie dans son périmètre (multi-cat). En
    // portée pôle ou mono-catégorie → pas de sélecteur (UX inchangée).
    var selecteur = '';
    if (State.portee === 'categorie'
        && Array.isArray(State.categoriesPerimetre)
        && State.categoriesPerimetre.length > 1) {
      var opts = State.categoriesPerimetre.map(function (c) {
        var sel = (c.id === State.cibleId) ? ' selected' : '';
        return '<option value="' + esc(c.id) + '"' + sel + '>' +
          esc(c.libelle_court || c.code || c.id) + '</option>';
      }).join('');
      selecteur = '<p class="pa-sub" style="margin-top:8px;">' +
        '<label for="pa-cat-selecteur" style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-mute); margin-right:8px;">Catégorie :</label>' +
        '<select id="pa-cat-selecteur" style="padding:5px 9px; border:1px solid var(--line); border-radius:6px; background:var(--paper-warm); color:var(--ink); font-family:inherit; font-size:12px; cursor:pointer;">' +
        opts + '</select></p>';
    }
    return '<header class="pa-head">' +
      '<h1>Planification annuelle</h1>' +
      '<p class="pa-sub">' + esc(pp) + ' : <strong>' + esc(State.cibleLabel) + '</strong>' +
      ' · Saison ' + esc(s.libelle || s.code || '') + '</p>' +
      selecteur +
      lecture +
      '</header>';
  }

  // ---- Rendu : un bloc éditable ----
  function renderBlocEdit(b, index) {
    var dis = State.peutEditer ? '' : ' disabled';
    var h = '';
    h += '<div class="pa-bloc" data-id="' + esc(b.id) + '">';
    h += '<div class="pa-bloc__bar"><span class="pa-bloc__rang">Bloc ' + (index + 1) + '</span>';
    if (State.peutEditer) {
      h += '<span class="pa-bloc__actions">' +
        (index > 0 ? '<button type="button" class="pa-mini" data-act="up" data-id="' + esc(b.id) + '">↑</button>' : '') +
        (index < State.blocs.length - 1 ? '<button type="button" class="pa-mini" data-act="down" data-id="' + esc(b.id) + '">↓</button>' : '') +
        '<button type="button" class="pa-mini pa-mini--del" data-act="del" data-id="' + esc(b.id) + '">Supprimer</button>' +
        '</span>';
    }
    h += '</div>';

    // Titre + dates
    h += '<div class="pa-row">';
    h += '<label class="pa-field pa-field--grow"><span>Titre du bloc</span>' +
      '<input type="text" value="' + esc(b.titre) + '" data-f="titre" data-id="' + esc(b.id) + '"' + dis + '></label>';
    h += '<label class="pa-field"><span>Du</span>' +
      '<input type="date" value="' + esc(b.date_debut || '') + '" data-f="date_debut" data-id="' + esc(b.id) + '"' + dis + '></label>';
    h += '<label class="pa-field"><span>au</span>' +
      '<input type="date" value="' + esc(b.date_fin || '') + '" data-f="date_fin" data-id="' + esc(b.id) + '"' + dis + '></label>';
    h += '</div>';

    // Axe individuel (cases fixes)
    h += '<div class="pa-axe"><div class="pa-axe__lbl">🧍 Axe de travail individuel <em>(Technique individuelle)</em></div>';
    h += '<div class="pa-indiv">';
    AXE_INDIV_ITEMS.forEach(function (it) {
      var ck = (b.axe_indiv || []).indexOf(it.id) >= 0 ? ' checked' : '';
      h += '<label class="pa-check"><input type="checkbox"' + ck + dis +
        ' data-indiv="' + esc(it.id) + '" data-id="' + esc(b.id) + '"> ' + esc(it.label) + '</label>';
    });
    h += '</div></div>';

    // Axes pioche (collectif / physique / poste)
    h += renderAxeSelect(b, 'axe_collectif', '🧠 Axe de travail collectif', State.axes.collectif, dis);
    h += renderAxeSelect(b, 'axe_physique', '💪 Axe de travail physique', State.axes.physique, dis);
    h += renderAxeSelect(b, 'axe_poste', '🏟️ Axe jeu au poste', State.axes.poste, dis);

    // Bloc intercalé
    var ck = b.intercale ? ' checked' : '';
    h += '<label class="pa-check pa-check--inline"><input type="checkbox"' + ck + dis +
      ' data-f="intercale" data-id="' + esc(b.id) + '"> Bloc intercalé sur la saison (ex : défense en plusieurs parties)</label>';

    // Commentaires
    h += '<label class="pa-field pa-field--full"><span>💬 Commentaires libres</span>' +
      '<textarea rows="2" data-f="commentaires" data-id="' + esc(b.id) + '"' + dis +
      ' placeholder="Objectifs spécifiques, notes, remarques…">' + esc(b.commentaires || '') + '</textarea></label>';

    if (State.peutEditer) {
      h += '<div class="pa-bloc__save">' +
        '<button type="button" class="pa-btn" data-act="save" data-id="' + esc(b.id) + '">' +
        (b._draft ? 'Enregistrer ce bloc' : 'Mettre à jour') + '</button>' +
        '<span class="pa-bloc__state" data-state="' + esc(b.id) + '"></span></div>';
    }

    h += '</div>';
    return h;
  }

  // Un select pioche : valeur courante peut être un libellé connu OU du texte
  // libre (alors on sélectionne « Autre » et on pré-remplit le champ).
  function renderAxeSelect(b, champ, label, liste, dis) {
    var val = b[champ] || '';
    var known = liste.indexOf(val) >= 0;
    var estAutre = (val !== '' && !known);
    var h = '<div class="pa-axe"><div class="pa-axe__lbl">' + esc(label) + '</div>';
    h += '<select class="pa-select" data-axe="' + esc(champ) + '" data-id="' + esc(b.id) + '"' + dis + '>';
    h += '<option value="">-- Choisir --</option>';
    liste.forEach(function (opt) {
      var sel = (opt === val) ? ' selected' : '';
      h += '<option value="' + esc(opt) + '"' + sel + '>' + esc(opt) + '</option>';
    });
    h += '<option value="' + esc(AUTRE) + '"' + (estAutre ? ' selected' : '') + '>' + esc(AUTRE) + '</option>';
    h += '</select>';
    // Champ texte libre (visible si « Autre »)
    h += '<input type="text" class="pa-axe__custom" data-axecustom="' + esc(champ) + '" data-id="' + esc(b.id) + '"' +
      dis + ' placeholder="Préciser…" value="' + esc(estAutre ? val : '') + '" style="' +
      (estAutre ? '' : 'display:none') + '">';
    h += '</div>';
    return h;
  }

  // ---- Rendu : frise (lecture, blocs emboîtés) ----
  function renderFrise() {
    var persistes = State.blocs.filter(function (b) { return !b._draft; });
    if (persistes.length === 0) {
      return bloc('Frise de la saison', '<p class="pa-attente">Aucun bloc enregistré pour l\'instant. La frise s\'affichera ici.</p>');
    }
    var h = '<section class="pa-card"><h2>Frise de la saison</h2><div class="pa-frise">';
    persistes.forEach(function (b, i) {
      var axes = [];
      (b.axe_indiv || []).forEach(function (id) {
        var it = AXE_INDIV_ITEMS.filter(function (x) { return x.id === id; })[0];
        if (it) axes.push(it.label);
      });
      if (b.axe_collectif) axes.push(b.axe_collectif);
      if (b.axe_physique) axes.push(b.axe_physique);
      if (b.axe_poste) axes.push(b.axe_poste);
      var periode = '';
      if (b.date_debut || b.date_fin) {
        periode = '<div class="pa-frise__date">' + esc(b.date_debut || '?') + ' → ' + esc(b.date_fin || '?') + '</div>';
      }
      h += '<div class="pa-frise__bloc' + (b.intercale ? ' pa-frise__bloc--inter' : '') + '">' +
        '<div class="pa-frise__num">' + (i + 1) + '</div>' +
        '<div class="pa-frise__titre">' + esc(b.titre || 'Sans titre') + '</div>' +
        periode +
        (axes.length ? '<ul class="pa-frise__axes"><li>' + axes.map(esc).join('</li><li>') + '</li></ul>' : '') +
        (b.commentaires ? '<div class="pa-frise__comm">' + esc(b.commentaires) + '</div>' : '') +
        '</div>';
    });
    h += '</div></section>';
    return h;
  }

  // ---- Rendu global ----
  function render() {
    var h = enteteContexte();
    h += renderFrise();

    // Éditeur (liste des blocs + ajout)
    h += '<section class="pa-card"><h2>Blocs de la saison</h2>';
    if (State.blocs.length === 0) {
      h += '<p class="pa-attente">Aucun bloc. Commencez par en ajouter un.</p>';
    } else {
      State.blocs.forEach(function (b, i) { h += renderBlocEdit(b, i); });
    }
    if (State.peutEditer) {
      h += '<button type="button" class="pa-btn pa-btn--add" data-act="add">+ Ajouter un bloc</button>';
    }
    h += '</section>';

    State.mount.innerHTML = h;
    bindEvents();
  }

  // ---- Évènements (délégation) ----
  function bindEvents() {
    var root = State.mount;

    // Sélecteur de catégorie (multi-cat) : mémorise + rebascule la cible.
    var selCat = root.querySelector('#pa-cat-selecteur');
    if (selCat) {
      selCat.addEventListener('change', function () {
        var nouvelle = selCat.value;
        if (!nouvelle || nouvelle === State.cibleId) return;
        var h = hub();
        if (h && typeof h.memoriserCategorieActive === 'function') {
          h.memoriserCategorieActive(nouvelle);
        }
        demarrerCategorie(nouvelle, State.peutEditer);
      });
    }

    // Champs simples (input/textarea texte + dates + checkbox intercale)
    root.querySelectorAll('[data-f]').forEach(function (el) {
      var evt = (el.type === 'checkbox') ? 'change' : 'input';
      el.addEventListener(evt, function () {
        var b = findBloc(el.getAttribute('data-id'));
        if (!b) return;
        var f = el.getAttribute('data-f');
        b[f] = (el.type === 'checkbox') ? el.checked : el.value;
      });
    });

    // Axe individuel (cases)
    root.querySelectorAll('[data-indiv]').forEach(function (el) {
      el.addEventListener('change', function () {
        var b = findBloc(el.getAttribute('data-id'));
        if (!b) return;
        var id = el.getAttribute('data-indiv');
        b.axe_indiv = b.axe_indiv || [];
        var pos = b.axe_indiv.indexOf(id);
        if (el.checked && pos < 0) b.axe_indiv.push(id);
        if (!el.checked && pos >= 0) b.axe_indiv.splice(pos, 1);
      });
    });

    // Pioches axes (select) → bascule champ libre
    root.querySelectorAll('[data-axe]').forEach(function (el) {
      el.addEventListener('change', function () {
        var b = findBloc(el.getAttribute('data-id'));
        if (!b) return;
        var champ = el.getAttribute('data-axe');
        var custom = root.querySelector('[data-axecustom="' + champ + '"][data-id="' + el.getAttribute('data-id') + '"]');
        if (el.value === AUTRE) {
          if (custom) { custom.style.display = ''; b[champ] = custom.value || ''; }
        } else {
          if (custom) custom.style.display = 'none';
          b[champ] = el.value; // '' si « -- Choisir -- »
        }
      });
    });

    // Champs libres axes
    root.querySelectorAll('[data-axecustom]').forEach(function (el) {
      el.addEventListener('input', function () {
        var b = findBloc(el.getAttribute('data-id'));
        if (!b) return;
        b[el.getAttribute('data-axecustom')] = el.value;
      });
    });

    // Boutons d'action
    root.querySelectorAll('[data-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        var act = el.getAttribute('data-act');
        if (act === 'add') return onAdd();
        var id = el.getAttribute('data-id');
        if (act === 'save') return onSave(id);
        if (act === 'del') return onDelete(id);
        if (act === 'up') return onMove(id, -1);
        if (act === 'down') return onMove(id, 1);
      });
    });
  }

  function findBloc(id) {
    return State.blocs.filter(function (b) { return String(b.id) === String(id); })[0] || null;
  }

  function onAdd() {
    State.blocs.push(newBlocDraft());
    render();
  }

  function onMove(id, delta) {
    var i = State.blocs.findIndex(function (b) { return String(b.id) === String(id); });
    var j = i + delta;
    if (i < 0 || j < 0 || j >= State.blocs.length) return;
    var tmp = State.blocs[i]; State.blocs[i] = State.blocs[j]; State.blocs[j] = tmp;
    // Réindexation ordre (1-based) — persistée au prochain save de chaque bloc.
    State.blocs.forEach(function (b, k) { b.ordre = k + 1; });
    render();
  }

  function setState(id, msg, ok) {
    var el = State.mount.querySelector('[data-state="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (el) { el.textContent = msg; el.className = 'pa-bloc__state' + (ok === false ? ' pa-bloc__state--err' : (ok ? ' pa-bloc__state--ok' : '')); }
  }

  // Construit le payload propre pour la base (résout « Autre » déjà fait
  // dans b.axe_* ; on ne pousse jamais l'id tmp-* ni les flags internes).
  function payloadOf(b) {
    var p = {
      saison_id: State.saison.id,
      categorie_id: State.portee === 'categorie' ? State.cibleId : null,
      pole_id: State.portee === 'pole' ? State.cibleId : null,
      ordre: b.ordre,
      titre: b.titre || null,
      date_debut: b.date_debut || null,
      date_fin: b.date_fin || null,
      intercale: !!b.intercale,
      axe_indiv: b.axe_indiv || [],
      axe_collectif: b.axe_collectif || null,
      axe_physique: b.axe_physique || null,
      axe_poste: b.axe_poste || null,
      commentaires: b.commentaires || null
    };
    if (!b._draft) p.id = b.id;
    return p;
  }

  function onSave(id) {
    var b = findBloc(id);
    if (!b) return;
    setState(id, 'Enregistrement…', null);
    hub().savePlanificationBloc(payloadOf(b)).then(function (res) {
      if (!res || !res.ok) {
        setState(id, 'Échec : ' + ((res && res.error) || 'erreur'), false);
        return;
      }
      // Remplace le brouillon par l'objet persisté (récupère l'uuid réel).
      var i = State.blocs.findIndex(function (x) { return String(x.id) === String(id); });
      if (i >= 0 && res.data) {
        res.data.axe_indiv = Array.isArray(res.data.axe_indiv) ? res.data.axe_indiv : [];
        State.blocs[i] = res.data;
      }
      render();
    });
  }

  function onDelete(id) {
    var b = findBloc(id);
    if (!b) return;
    // Brouillon non persisté : suppression locale directe.
    if (b._draft) {
      State.blocs = State.blocs.filter(function (x) { return String(x.id) !== String(id); });
      render();
      return;
    }
    if (!global.confirm('Supprimer ce bloc ? Cette action est définitive.')) return;
    hub().deletePlanificationBloc(id).then(function (res) {
      if (!res || !res.ok) { setState(id, 'Échec suppression : ' + ((res && res.error) || ''), false); return; }
      State.blocs = State.blocs.filter(function (x) { return String(x.id) !== String(id); });
      render();
    });
  }

  // ---- Démarrage adaptatif (portée) ----
  // Résout la portée à éditer :
  //   - ?pole=<uuid>      → trame pôle (droit = transverse)
  //   - ?categorie=<uuid> → catégorie explicite
  //   - sinon : mes_categories_autorisees() →
  //       référent mono-cat : catégorie directe ;
  //       transverse : écran de choix (catégories + pôles) ;
  //       aucun : message indéterminé.
  // PLANIF-ECRITURE-POLE (front) : résout UNE FOIS les droits d'écriture
  // réels du connecté, pour que le front reflète la RLS (sql_106) sans la
  // dupliquer. Renseigne State.transverseGlobal / droitsPolesEditables /
  // droitsCatsEditables. Dégradation honnête : en cas d'échec, Sets vides
  // (aucune édition affichée) plutôt qu'un faux « éditable ». La RLS reste
  // l'arbitre réel — ce cache ne sert qu'à l'affichage.
  function _chargerDroits() {
    var h = hub();
    if (!h) {
      State.transverseGlobal = false;
      State.droitsPolesEditables = new Set();
      State.droitsCatsEditables = new Set();
      return Promise.resolve();
    }
    var pPerim = (typeof h.resoudrePerimetreCategories === 'function')
      ? Promise.resolve(h.resoudrePerimetreCategories()).catch(function () { return null; })
      : Promise.resolve(null);
    var pPolesResp = (typeof h.mesPolesResponsable === 'function')
      ? Promise.resolve(h.mesPolesResponsable()).catch(function () { return []; })
      : Promise.resolve([]);
    return Promise.all([pPerim, pPolesResp]).then(function (res) {
      var perim = res[0];
      var polesResp = Array.isArray(res[1]) ? res[1] : [];
      State.transverseGlobal = !!(perim && perim.transverse);
      // Catégories éditables = celles du périmètre (mes_categories_autorisees).
      var cats = new Set();
      if (perim && Array.isArray(perim.categories)) {
        perim.categories.forEach(function (c) {
          var id = c.id || c.categorie_id;
          if (id) cats.add(id);
        });
      }
      State.droitsCatsEditables = cats;
      // Pôles éditables = pôles dont on est responsable désigné (sql_106).
      var poles = new Set();
      polesResp.forEach(function (p) {
        var id = (p && (p.pole_id || p.id)) || null;
        if (id) poles.add(id);
      });
      State.droitsPolesEditables = poles;
    }).catch(function () {
      State.transverseGlobal = false;
      State.droitsPolesEditables = new Set();
      State.droitsCatsEditables = new Set();
    });
  }

  // Vrai si le connecté peut ÉDITER le pôle donné (transverse OU responsable
  // désigné). Reflète la RLS d'écriture pôle (sql_106).
  function _peutEditerPole(poleId) {
    if (State.transverseGlobal) return true;
    return !!(State.droitsPolesEditables && State.droitsPolesEditables.has(poleId));
  }

  // Vrai si le connecté peut ÉDITER la catégorie donnée (transverse OU
  // catégorie de son périmètre d'encadrement).
  function _peutEditerCategorie(catId) {
    if (State.transverseGlobal) return true;
    return !!(State.droitsCatsEditables && State.droitsCatsEditables.has(catId));
  }

  function start(mountEl) {
    State.mount = mountEl;
    if (!hub()) {
      mountEl.innerHTML = bloc('Erreur', '<p>Client Supabase indisponible.</p>');
      return;
    }
    var params = new URLSearchParams(global.location.search);
    var pole = params.get('pole');
    var cat = params.get('categorie');

    if (pole) { return demarrerPole(pole); }
    if (cat) {
      // Deep link catégorie : peutEditer reflète le droit réel (RLS), pas un
      // « true » présumé. Charge le cache de droits si nécessaire.
      var pretCat = (State.droitsCatsEditables !== null)
        ? Promise.resolve()
        : _chargerDroits();
      return pretCat.then(function () {
        return demarrerCategorie(cat, _peutEditerCategorie(cat));
      });
    }

    // Résolution du périmètre via le socle (lève l'angle mort rows[0] :
    // un encadrant multi-catégories n'est plus figé sur la 1re).
    //   - transverse (admin/bureau) → écran de choix pôles + catégories
    //     INCHANGÉ (dualité préservée, décision Manu) ;
    //   - encadrant : démarre sur la catégorie active mémorisée (sinon
    //     1re) ; le sélecteur intégré (render) permet de basculer si N>1 ;
    //   - aucun droit → message indéterminé.
    var h = hub();
    if (h && typeof h.resoudrePerimetreCategories === 'function') {
      // Résout d'abord les droits réels (transverse / pôles responsables /
      // catégories), puis route. Le cache sert ensuite à demarrerPole /
      // demarrerCategorie pour refléter la RLS au lieu de forcer peutEditer.
      return _chargerDroits()
        .then(function () { return Promise.resolve(h.resoudrePerimetreCategories()); })
        .then(function (perimetre) {
          if (!perimetre || perimetre.vide
              || !Array.isArray(perimetre.categories)
              || perimetre.categories.length === 0) {
            // Pas de catégorie d'encadrement : un responsable de pôle SANS
            // catégorie doit tout de même accéder à l'écran de choix complet.
            if (State.droitsPolesEditables && State.droitsPolesEditables.size > 0) {
              return ecranChoixComplet();
            }
            return messageIndetermine();
          }
          // Admin/bureau : écran de choix complet (pôles + catégories) INCHANGÉ.
          if (perimetre.transverse) {
            return ecranChoixComplet();
          }
          // Responsable de pôle (non-transverse) : décision Manu = voir
          // l'écran de choix COMPLET (tous pôles + toutes catégories), édite
          // ses cibles, lit le reste. peutEditer est calculé par cible.
          if (State.droitsPolesEditables && State.droitsPolesEditables.size > 0) {
            return ecranChoixComplet();
          }
          // Encadrant simple : mémorise la liste pour le sélecteur, démarre
          // sur la catégorie active (mémorisée via le socle, sinon 1re).
          State.categoriesPerimetre = perimetre.categories;
          var active = perimetre.active || perimetre.categories[0].id;
          return demarrerCategorie(active, _peutEditerCategorie(active));
        })
        .catch(function (e) {
          if (global.console) global.console.error('planification boot', e);
          return messageIndetermine();
        });
    }

    // Repli : socle ancien → ancien chemin mes_categories_autorisees.
    Promise.resolve(_chargerDroits())
      .then(function () { return hub().mesCategoriesAutorisees(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          if (State.droitsPolesEditables && State.droitsPolesEditables.size > 0) {
            return ecranChoixComplet();
          }
          return messageIndetermine();
        }
        var r = rows[0];
        var catId = r.categorie_id || r.id || null;
        if (catId && !r.est_transverse) {
          if (State.droitsPolesEditables && State.droitsPolesEditables.size > 0) {
            return ecranChoixComplet();
          }
          return demarrerCategorie(catId, _peutEditerCategorie(catId));
        }
        if (r.est_transverse) {
          return ecranChoixComplet();
        }
        messageIndetermine();
      })
      .catch(function (e) {
        if (global.console) global.console.error('planification boot', e);
        messageIndetermine();
      });
  }

  function messageIndetermine() {
    State.mount.innerHTML = bloc('Périmètre indéterminé',
      '<p>Aucune catégorie ni pôle n\'a pu être déterminé pour votre compte. ' +
      'La planification annuelle est réservée aux encadrants (leur catégorie) ' +
      'et aux responsables de pôle (trames de leur pôle).</p>');
  }

  // Référent / lien direct : on connaît la catégorie, droit d'écriture présumé
  // par la RLS (confirmé en-app). On résout le libellé via list_categories.
  function demarrerCategorie(catId, peutEditer) {
    State.portee = 'categorie';
    State.cibleId = catId;
    State.peutEditer = !!peutEditer;
    return resoudreLibelleCategorie(catId).then(function (lib) {
      State.cibleLabel = lib || catId;
      return loadContext();
    });
  }

  function demarrerPole(poleId) {
    State.portee = 'pole';
    State.cibleId = poleId;
    // Droit d'édition pôle (reflet RLS sql_106) = transverse (admin/bureau)
    // OU responsable DÉSIGNÉ du pôle (mes_poles_responsable). La RLS reste
    // l'arbitre réel. Si le cache de droits n'est pas encore résolu (cas
    // deep link ?pole=<uuid> avant boot), on le charge d'abord.
    var pretDroits = (State.droitsPolesEditables !== null)
      ? Promise.resolve()
      : _chargerDroits();
    return pretDroits.then(function () {
      State.peutEditer = _peutEditerPole(poleId);
      return resoudreLibellePole(poleId).then(function (lib) {
        State.cibleLabel = lib || poleId;
        return loadContext();
      });
    });
  }

  // Écran de choix COMPLET : tous les pôles + toutes les catégories.
  // Atteint par admin/bureau (transverse) ET par le responsable de pôle
  // (décision Manu). peutEditer est calculé PAR CIBLE au clic (reflet RLS) :
  // l'utilisateur édite ses pôles/catégories, lit le reste (« lecture seule »
  // annoncée à l'entrée de la trame via State.peutEditer=false).
  function ecranChoixComplet() {
    State.mount.innerHTML = '<p class="pa-load">Chargement des périmètres…</p>';
    Promise.all([
      Promise.resolve(hub().client.rpc('list_categories')).catch(function () { return null; }),
      hub().getPoles ? hub().getPoles() : Promise.resolve([])
    ]).then(function (res) {
      var cats = extraireListe(res[0]);
      var poles = Array.isArray(res[1]) ? res[1] : [];
      cats.sort(function (a, b) { return (a.ordre_tri || 0) - (b.ordre_tri || 0); });

      var h = enteteChoix();
      h += '<section class="pa-card"><h2>Choisir un périmètre</h2>';
      h += '<div class="pa-choix">';
      h += '<div class="pa-choix__col"><h3>Trames de pôle</h3>';
      if (poles.length === 0) {
        h += '<p class="pa-attente">Aucun pôle.</p>';
      } else {
        poles.forEach(function (p) {

          h += '<button type="button" class="pa-choix__item" data-pole="' + esc(p.id) + '">' +
            esc(p.libelle_court || p.libelle_long || p.code || p.id) +
            (_peutEditerPole(p.id) ? '' : ' <span style="font-size:.78em;opacity:.6;font-weight:400;">👁 lecture</span>') + '</button>';
        });
      }
      h += '</div>';
      h += '<div class="pa-choix__col"><h3>Catégories</h3>';
      if (cats.length === 0) {
        h += '<p class="pa-attente">Aucune catégorie.</p>';
      } else {
        cats.forEach(function (c) {
          h += '<button type="button" class="pa-choix__item" data-cat="' + esc(c.id) + '">' +
            esc(c.libelle_court || c.code || c.id) +
            (_peutEditerCategorie(c.id) ? '' : ' <span style="font-size:.78em;opacity:.6;font-weight:400;">👁 lecture</span>') + '</button>';
        });
      }
      h += '</div></div></section>';
      State.mount.innerHTML = h;

      // Tout cliquable (décision Manu) : on ouvre la trame en lecture seule
      // si la cible n'est pas éditable. peutEditer calculé par cible.
      State.mount.querySelectorAll('[data-pole]').forEach(function (el) {
        el.addEventListener('click', function () { demarrerPole(el.getAttribute('data-pole')); });
      });
      State.mount.querySelectorAll('[data-cat]').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-cat');
          demarrerCategorie(id, _peutEditerCategorie(id));
        });
      });
    });
  }

  function enteteChoix() {
    return '<header class="pa-head"><h1>Planification annuelle</h1>' +
      '<p class="pa-sub">Choisissez une trame de pôle ou une catégorie à planifier.</p></header>';
  }

  function extraireListe(res) {
    if (!res) return [];
    var payload = res.data !== undefined ? res.data : res;
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function resoudreLibelleCategorie(catId) {
    return Promise.resolve(hub().client.rpc('list_categories'))
      .then(function (res) {
        var liste = extraireListe(res);
        var c = liste.filter(function (x) { return x.id === catId; })[0];
        return c ? (c.libelle_court || c.code || catId) : catId;
      })
      .catch(function () { return catId; });
  }

  function resoudreLibellePole(poleId) {
    if (!hub().getPoles) return Promise.resolve(poleId);
    return Promise.resolve(hub().getPoles())
      .then(function (liste) {
        var p = (liste || []).filter(function (x) { return x.id === poleId; })[0];
        return p ? (p.libelle_court || p.libelle_long || p.code || poleId) : poleId;
      })
      .catch(function () { return poleId; });
  }

  // ---- Exposition ----
  global.PlanificationEditor = { start: start };

  if (global.console) {
    global.console.log('%c🏉 MOM Hub · Planification annuelle v1.0 chargé',
      'color: #2d7a3e; font-weight: bold;');
  }

})(typeof window !== 'undefined' ? window : globalThis);
