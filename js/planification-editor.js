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

  // PLANIF-SOUSBLOCS-PAR-JOUR (sql_234) : jours d'entraînement d'un bloc.
  // Liste fermée 0=toute la semaine, 1=lundi … 7=dimanche (aligné CHECK
  // planification_jours_jour_chk élargi à 0..7 par sql_236). « Toute la
  // semaine » sert aux blocs qui ne différencient pas les objectifs par jour.
  // Additif : le bloc conserve son rendu/axes actuels intacts ; les jours
  // s'ajoutent EN PLUS, dans une sous-section dédiée. Un bloc sans jour =
  // comportement historique inchangé.
  var JOURS_SEMAINE = [
    { v: 0, label: 'Tous les entraînements du bloc' },
    { v: 1, label: 'Les lundis' },
    { v: 2, label: 'Les mardis' },
    { v: 3, label: 'Les mercredis' },
    { v: 4, label: 'Les jeudis' },
    { v: 5, label: 'Les vendredis' },
    { v: 6, label: 'Les samedis' },
    { v: 7, label: 'Les dimanches' }
  ];

  function libelleJour(v) {
    var j = JOURS_SEMAINE.filter(function (x) { return x.v === Number(v); })[0];
    return j ? j.label : '';
  }

  // Un jour « brouillon » (non encore en base) a un id temporaire tmpj-*.
  function newJourDraft(blocId) {
    return {
      id: 'tmpj-' + Date.now() + '-' + Math.round(Math.random() * 1e6),
      _draft: true,
      bloc_id: blocId,
      jour: 1,
      titre: '',
      axe_indiv: [],
      axe_collectif: '',
      axe_physique: '',
      axe_poste: '',
      commentaire: ''
    };
  }

  var State = {
    mount: null,
    saison: null,        // { id, code, libelle, date_debut, date_fin }
    portee: null,        // 'categorie' | 'pole'
    cibleId: null,       // categorie_id OU pole_id selon portee
    cibleLabel: '',
    peutEditer: false,   // droit d'écriture sur la cible courante
    // PLANIF-FRISE-COSMETIQUE-EXPORT : référent(s)/responsable(s) résolus
    // pour le cartouche d'export. [{prenom, nom}] ; [] si non résolu
    // (cartouche affiché sans nom, dégradation honnête).
    referents: [],
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
      rejoint_frise: false,
      periodes: [],
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
        // PLANIF-SOUSBLOCS-PAR-JOUR : hydrate les jours de chaque bloc
        // persisté (b._jours). Non bloquant : en cas d'échec, b._jours = []
        // et le bloc affiche sa saisie historique (dégradation honnête).
        return chargerJoursDesBlocs().then(function () {
          // PLANIF-FRISE-COSMETIQUE-EXPORT : résout le(s) référent(s) pour le
          // cartouche d'export. Non bloquant : en cas d'échec ou d'absence,
          // State.referents reste [] et le cartouche s'affiche sans nom.
          return chargerReferents().then(render);
        });
      });
    });
  }

  // Résout le(s) nom(s) de référent/responsable de la cible courante pour
  // le cartouche d'export. Catégorie → RPC referent_de_categorie (multi-
  // référent possible). Pôle → responsables désignés (données pôle).
  // Dégradation honnête : toute erreur laisse State.referents = [].
  function chargerReferents() {
    State.referents = [];
    var h = hub();
    if (!h) return Promise.resolve();
    if (State.portee === 'categorie'
        && typeof h.referentDeCategorie === 'function') {
      return Promise.resolve(h.referentDeCategorie(State.cibleId))
        .then(function (rows) {
          State.referents = (Array.isArray(rows) ? rows : []).map(function (r) {
            return { prenom: r.prenom || '', nom: r.nom || '' };
          });
        })
        .catch(function () { State.referents = []; });
    }
    if (State.portee === 'pole' && typeof h.getPoles === 'function') {
      return Promise.resolve(h.getPoles())
        .then(function (liste) {
          var p = (liste || []).filter(function (x) { return x.id === State.cibleId; })[0];
          var ids = [];
          if (p) {
            if (p.responsable_principal_id) ids.push(p.responsable_principal_id);
            if (p.co_responsable_id) ids.push(p.co_responsable_id);
          }
          if (!ids.length || typeof h._resolveNoms !== 'function') return;
          return Promise.resolve(h._resolveNoms(ids)).then(function (map) {
            var out = [];
            if (map && typeof map.forEach === 'function') {
              ids.forEach(function (id) {
                var v = map.get(id);
                if (v) out.push({ prenom: v.prenom || '', nom: v.nom || '' });
              });
            }
            State.referents = out;
          });
        })
        .catch(function () { State.referents = []; });
    }
    return Promise.resolve();
  }

  // PLANIF-SOUSBLOCS-PAR-JOUR : hydrate b._jours pour chaque bloc PERSISTÉ
  // (les brouillons tmp-* n'ont pas encore d'id base → jours en mémoire seule).
  // Chargement en parallèle ; dégradation honnête (b._jours = [] si échec).
  function chargerJoursDesBlocs() {
    var h = hub();
    if (!h || typeof h.listPlanificationJours !== 'function') {
      State.blocs.forEach(function (b) { if (!Array.isArray(b._jours)) b._jours = []; });
      return Promise.resolve();
    }
    var proms = State.blocs.map(function (b) {
      if (b._draft) { b._jours = Array.isArray(b._jours) ? b._jours : []; return Promise.resolve(); }
      return Promise.resolve(h.listPlanificationJours(b.id))
        .then(function (rows) {
          b._jours = (Array.isArray(rows) ? rows : []).map(function (j) {
            j.axe_indiv = Array.isArray(j.axe_indiv) ? j.axe_indiv : [];
            return j;
          });
        })
        .catch(function () { b._jours = []; });
    });
    return Promise.all(proms);
  }

  // Libellé « Prénom NOM » concaténé des référents (pour le cartouche).
  // '' si aucun → le cartouche masque alors la ligne.
  function libelleReferents() {
    var noms = (State.referents || []).map(function (r) {
      return ((r.prenom || '') + ' ' + (r.nom || '')).trim();
    }).filter(function (s) { return s; });
    return noms.join(' · ');
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

    // PLANIF-SOUSBLOCS-PAR-JOUR (recette) : les 4 axes ne se saisissent plus au
    // niveau du bloc (doublon avec les jours). Ils vivent desormais uniquement
    // dans la section « Jours d'entrainement » ci-dessous. Les axes des blocs
    // existants ont ete migres vers un 1er jour (sql_235).

    // Bloc intercalé
    var ck = b.intercale ? ' checked' : '';
    h += '<label class="pa-check pa-check--inline"><input type="checkbox"' + ck + dis +
      ' data-f="intercale" data-id="' + esc(b.id) + '"> Bloc intercalé sur la saison (ex : défense en plusieurs parties)</label>';

    // PLANIF-BLOCS-INTERCALES-MULTIPERIODES (additif) : quand le bloc est
    // intercalé, il peut être constitué de plusieurs périodes disjointes.
    // Éditeur déplié uniquement si intercale=true. Les dates début/fin du
    // bloc sont recalculées côté base (trigger trg_planif_bloc_sync_dates =
    // min/max des périodes), donc pas besoin de les toucher ici.
    if (b.intercale) {
      h += renderPeriodesEditor(b, dis);
      // PLANIF recette v4 : option « rejoindre la frise principale ».
      // Cochée → les périodes descendent sur la ligne principale. La case
      // est gardée par une détection de collision bloquante (onRejointFrise).
      var ckRf = b.rejoint_frise ? ' checked' : '';
      h += '<label class="pa-check pa-check--inline" data-rf-wrap="' + esc(b.id) + '">' +
        '<input type="checkbox"' + ckRf + dis +
        ' data-rf="' + esc(b.id) + '"> Faire rejoindre les périodes à la frise principale' +
        '</label>';
      h += '<div class="pa-rf-alert" data-rf-alert="' + esc(b.id) + '"' +
        (b._rfAlert ? '' : ' style="display:none"') + '>' +
        esc(b._rfAlert || '') + '</div>';
    }

    // Commentaires
    h += '<label class="pa-field pa-field--full"><span>💬 Commentaires libres</span>' +
      '<textarea rows="2" data-f="commentaires" data-id="' + esc(b.id) + '"' + dis +
      ' placeholder="Objectifs spécifiques, notes, remarques…">' + esc(b.commentaires || '') + '</textarea></label>';

    // PLANIF-SOUSBLOCS-PAR-JOUR : section « Jours d'entraînement » (additive).
    // Le bloc ci-dessus reste inchangé ; les jours s'affichent EN DESSOUS.
    h += renderJoursSection(b, dis);

    if (State.peutEditer) {
      h += '<div class="pa-bloc__save">' +
        '<button type="button" class="pa-btn" data-act="save" data-id="' + esc(b.id) + '">' +
        (b._draft ? 'Enregistrer ce bloc' : 'Mettre à jour') + '</button>' +
        '<span class="pa-bloc__state" data-state="' + esc(b.id) + '"></span></div>';
    }

    h += '</div>';
    return h;
  }

  // ---- Rendu : éditeur de périodes d'un bloc intercalé (additif) ----
  // PLANIF-BLOCS-INTERCALES-MULTIPERIODES. Liste de couples début/fin ;
  // ajout / suppression de lignes. Réutilise les classes existantes
  // (pa-field, pa-btn) — aucune dépendance à hub.css (INTERDIT intact).
  function renderPeriodesEditor(b, dis) {
    var periodes = Array.isArray(b.periodes) ? b.periodes : [];
    var h = '<div class="pa-periodes" data-periodes-for="' + esc(b.id) + '">';
    h += '<div class="pa-periodes__lbl">🗓️ Périodes intercalées ' +
      '<em>(le bloc peut se décomposer en plusieurs plages qui ne s\'enchaînent pas)</em></div>';
    if (!periodes.length) {
      h += '<p class="pa-periodes__hint">Aucune période saisie. ' +
        'Sans période, le bloc utilise ses dates début/fin ci-dessus.</p>';
    }
    periodes.forEach(function (p, idx) {
      h += '<div class="pa-periode-row">' +
        '<label class="pa-field"><span>du</span>' +
          '<input type="date" value="' + esc(p && p.debut ? p.debut : '') + '"' +
          ' data-per-debut="' + idx + '" data-id="' + esc(b.id) + '"' + dis + '></label>' +
        '<label class="pa-field"><span>au</span>' +
          '<input type="date" value="' + esc(p && p.fin ? p.fin : '') + '"' +
          ' data-per-fin="' + idx + '" data-id="' + esc(b.id) + '"' + dis + '></label>';
      if (!dis) {
        h += '<button type="button" class="pa-btn pa-btn--mini" ' +
          'data-act="per-del" data-per="' + idx + '" data-id="' + esc(b.id) + '" ' +
          'title="Supprimer cette période">✕</button>';
      }
      h += '</div>';
    });
    if (!dis) {
      h += '<button type="button" class="pa-btn pa-btn--mini" ' +
        'data-act="per-add" data-id="' + esc(b.id) + '">+ Ajouter une période</button>';
    }
    h += '</div>';
    return h;
  }

  // ---- Rendu : périodes intercalées dans le détail (lecture seule) ----
  // PLANIF-BLOCS-INTERCALES-MULTIPERIODES. N'affiche la liste que si le bloc
  // est intercalé ET porte au moins 2 périodes (une seule = équivalent d'un
  // bloc simple, déjà résumé par la ligne de dates min→max au-dessus).
  function renderPeriodesDetail(b) {
    if (!b || !b.intercale) return '';
    var periodes = (Array.isArray(b.periodes) ? b.periodes : [])
      .filter(function (p) { return p && p.debut && p.fin; })
      .sort(function (x, y) { return x.debut < y.debut ? -1 : (x.debut > y.debut ? 1 : 0); });
    if (periodes.length < 2) return '';
    var h = '<ul class="pa-fv__periodes">';
    periodes.forEach(function (p, i) {
      h += '<li><span class="pa-fv__periode-n">Période ' + (i + 1) + '</span> ' +
        esc(p.debut) + ' → ' + esc(p.fin) + '</li>';
    });
    h += '</ul>';
    return h;
  }

  // ---- Rendu : section « Jours d'entraînement » d'un bloc (additif) ----
  // Réutilise STRICTEMENT le markup axes existant (pa-axe / pa-indiv / pa-check
  // / renderAxeSelect). Seule nouveauté visuelle : le conteneur .pa-jour (trait
  // de séparation, défini dans planification.html — hub.css INTERDIT intact).
  // Un bloc brouillon (tmp-*) ne peut pas encore recevoir de jours (il faut son
  // id base) : on invite à enregistrer le bloc d'abord.
  function renderJoursSection(b, dis) {
    var jours = Array.isArray(b._jours) ? b._jours : [];
    var h = '<div class="pa-jours" data-jours-of="' + esc(b.id) + '">';
    h += '<div class="pa-jours__lbl">📅 Jours d\'entraînement <em>(axes déclinés par jour)</em></div>';

    if (b._draft) {
      h += '<p class="pa-jours__hint">Enregistrez d\'abord le bloc pour lui ajouter des jours d\'entraînement.</p>';
      h += '</div>';
      return h;
    }

    if (jours.length === 0) {
      h += '<p class="pa-jours__hint">Aucun jour défini. Le bloc utilise ses axes ci-dessus. ' +
        'Ajoutez des jours pour décliner une thématique différente par séance.</p>';
    } else {
      jours.forEach(function (j) { h += renderJourEdit(b, j, dis); });
    }

    if (State.peutEditer) {
      h += '<button type="button" class="pa-btn pa-btn--add pa-jours__add" ' +
        'data-jouract="add" data-bloc="' + esc(b.id) + '">+ Ajouter un jour d\'entraînement</button>';
    }
    h += '</div>';
    return h;
  }

  // Rendu d'UN jour : sélecteur jour + titre + les 4 axes (markup identique au
  // bloc, mais attributs data-jour-* / data-jid pour des handlers dédiés).
  function renderJourEdit(b, j, dis) {
    var h = '<div class="pa-jour" data-jid="' + esc(j.id) + '" data-bloc="' + esc(b.id) + '">';

    // Barre : sélecteur jour + titre + suppression + duplication.
    h += '<div class="pa-jour__bar">';
    h += '<select class="pa-jour__select" data-jour-f="jour" data-jid="' + esc(j.id) + '"' + dis + '>';
    JOURS_SEMAINE.forEach(function (d) {
      var sel = (Number(j.jour) === d.v) ? ' selected' : '';
      h += '<option value="' + d.v + '"' + sel + '>' + esc(d.label) + '</option>';
    });
    h += '</select>';
    h += '<input type="text" class="pa-jour__titre" value="' + esc(j.titre || '') + '" ' +
      'data-jour-f="titre" data-jid="' + esc(j.id) + '"' + dis +
      ' placeholder="Thématique du jour…">';
    if (State.peutEditer) {
      h += '<span class="pa-jour__actions">' +
        '<button type="button" class="pa-mini" data-jouract="dup" data-jid="' + esc(j.id) + '" data-bloc="' + esc(b.id) + '" title="Dupliquer ce jour">Dupliquer</button>' +
        '<button type="button" class="pa-mini pa-mini--del" data-jouract="del" data-jid="' + esc(j.id) + '">Supprimer</button>' +
        '</span>';
    }
    h += '</div>';

    // Axe individuel (cases fixes) — markup identique au bloc, attributs jour.
    h += '<div class="pa-axe"><div class="pa-axe__lbl">🧍 Axe de travail individuel <em>(Technique individuelle)</em></div>';
    h += '<div class="pa-indiv">';
    AXE_INDIV_ITEMS.forEach(function (it) {
      var ck = (j.axe_indiv || []).indexOf(it.id) >= 0 ? ' checked' : '';
      h += '<label class="pa-check"><input type="checkbox"' + ck + dis +
        ' data-jour-indiv="' + esc(it.id) + '" data-jid="' + esc(j.id) + '"> ' + esc(it.label) + '</label>';
    });
    h += '</div></div>';

    // Axes pioche — même helper que le bloc, mode « jour ».
    h += renderAxeSelectJour(j, 'axe_collectif', '🧠 Axe de travail collectif', State.axes.collectif, dis);
    h += renderAxeSelectJour(j, 'axe_physique', '💪 Axe de travail physique', State.axes.physique, dis);
    h += renderAxeSelectJour(j, 'axe_poste', '🏟️ Axe jeu au poste', State.axes.poste, dis);

    // Commentaire libre du jour.
    h += '<label class="pa-field pa-field--full"><span>💬 Commentaires libres</span>' +
      '<textarea rows="2" data-jour-f="commentaire" data-jid="' + esc(j.id) + '"' + dis +
      ' placeholder="Objectifs spécifiques, notes, remarques…">' + esc(j.commentaire || '') + '</textarea></label>';

    // Auto-save : plus de bouton, seulement un indicateur d'état discret.
    if (State.peutEditer) {
      h += '<div class="pa-jour__foot"><span class="pa-bloc__state" data-jstate="' + esc(j.id) + '"></span></div>';
    }

    h += '</div>';
    return h;
  }

  // Jumelle de renderAxeSelect, ciblée « jour » (attributs data-jouraxe*).
  // Même comportement « Autre (texte libre) » et même markup visuel.
  function renderAxeSelectJour(j, champ, label, liste, dis) {
    var val = j[champ] || '';
    var known = liste.indexOf(val) >= 0;
    var estAutre = (val !== '' && !known);
    var h = '<div class="pa-axe"><div class="pa-axe__lbl">' + esc(label) + '</div>';
    h += '<select class="pa-select" data-jouraxe="' + esc(champ) + '" data-jid="' + esc(j.id) + '"' + dis + '>';
    h += '<option value="">-- Choisir --</option>';
    liste.forEach(function (opt) {
      var sel = (opt === val) ? ' selected' : '';
      h += '<option value="' + esc(opt) + '"' + sel + '>' + esc(opt) + '</option>';
    });
    h += '<option value="' + esc(AUTRE) + '"' + (estAutre ? ' selected' : '') + '>' + esc(AUTRE) + '</option>';
    h += '</select>';
    h += '<input type="text" class="pa-axe__custom" data-jouraxecustom="' + esc(champ) + '" data-jid="' + esc(j.id) + '"' +
      dis + ' placeholder="Préciser…" value="' + esc(estAutre ? val : '') + '" style="' +
      (estAutre ? '' : 'display:none') + '">';
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

  // Cycle de couleurs des chevrons (alternance contrastée : 3 teintes MOM).
  // Un bloc intercalé sort du cycle (rendu hachuré or, classe dédiée).
  var FRISE_CYCLE = ['c-vertf', 'c-gold', 'c-vert', 'c-clay'];

  // PLANIF-FRISE-CHRONOLOGIQUE : cycle de teintes pour différencier les blocs
  // INTERCALÉS entre eux (motif hachuré commun = « intercalé » ; la teinte
  // distingue quel bloc). INTER_NIVEAUX = nb de sous-niveaux verticaux pour
  // éviter le croisement de deux intercalés aux périodes entremêlées.
  var INTER_CYCLE = ['i-or', 'i-clay', 'i-violet', 'i-bleu'];
  var INTER_NIVEAUX = 2;

  // Agrège les axes d'un bloc en une liste de libellés (ordre : individuel,
  // collectif, physique, poste). Utilisé par les deux frises.
  function axesDuBloc(b) {
    var axes = [];
    (b.axe_indiv || []).forEach(function (id) {
      var it = AXE_INDIV_ITEMS.filter(function (x) { return x.id === id; })[0];
      if (it) axes.push(it.label);
    });
    if (b.axe_collectif) axes.push(b.axe_collectif);
    if (b.axe_physique) axes.push(b.axe_physique);
    if (b.axe_poste) axes.push(b.axe_poste);
    return axes;
  }

  // PLANIF-SOUSBLOCS-PAR-JOUR : axes agrégés d'UN jour (même ordre que le bloc).
  function axesDuJour(j) {
    var axes = [];
    (j.axe_indiv || []).forEach(function (id) {
      var it = AXE_INDIV_ITEMS.filter(function (x) { return x.id === id; })[0];
      if (it) axes.push(it.label);
    });
    if (j.axe_collectif) axes.push(j.axe_collectif);
    if (j.axe_physique) axes.push(j.axe_physique);
    if (j.axe_poste) axes.push(j.axe_poste);
    return axes;
  }

  // PLANIF-SOUSBLOCS-PAR-JOUR : rendu lecture des jours d'un bloc dans la frise.
  // Additif : '' si le bloc n'a aucun jour (frise historique inchangée). Les
  // jours (persistés uniquement) sont triés (jour, created_at) via le back ;
  // ici on respecte l'ordre déjà chargé. Réutilise .pa-fv-jours (défini dans
  // planification.html — hub.css INTERDIT intact).
  function renderJoursFrise(b) {
    var jours = (Array.isArray(b._jours) ? b._jours : []).filter(function (j) { return !j._draft; });
    if (jours.length === 0) return '';
    var h = '<div class="pa-fv-jours">';
    jours.forEach(function (j) {
      var axes = axesDuJour(j);
      var tete = libelleJour(j.jour) + (j.titre ? ' — ' + j.titre : '');
      h += '<div class="pa-fv-jour">' +
        '<span class="pa-fv-jour__tete">' + esc(tete) + '</span>' +
        (axes.length
          ? '<ul>' + axes.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
          : '') +
        (j.commentaire ? '<p class="pa-fv-jour__comm">' + esc(j.commentaire) + '</p>' : '') +
        '</div>';
    });
    h += '</div>';
    return h;
  }

  // Cartouche d'en-tête (type club) : écusson MOM, catégorie/pôle, saison,
  // référent(s) résolu(s). Visible à l'écran ET repris en tête d'export PDF.
  function renderCartouche() {
    var s = State.saison || {};
    var saisonLbl = esc(s.libelle || s.code || '');
    var cible = esc(State.cibleLabel || '');
    var typeLbl = State.portee === 'pole' ? 'Trame de pôle' : 'Catégorie';
    var refs = libelleReferents();
    var ligneRef = refs
      ? '<p class="pa-cartouche__sous">' +
          (State.portee === 'pole' ? 'Responsable : ' : 'Référent : ') +
          esc(refs) + '</p>'
      : '';
    return '<div class="pa-cartouche">' +
      '<img class="pa-cartouche__ecusson" src="assets/ecusson-mom.png" alt="Écusson MOM">' +
      '<div class="pa-cartouche__txt">' +
        '<p class="pa-cartouche__club">Mutzig Ovalie Molsheim</p>' +
        '<p class="pa-cartouche__titre">Planification saison — ' + cible + '</p>' +
        '<p class="pa-cartouche__sous">' + esc(typeLbl) + '</p>' +
        ligneRef +
      '</div>' +
      (saisonLbl
        ? '<div class="pa-cartouche__saison"><span class="pa-cartouche__pill">SAISON ' + saisonLbl + '</span></div>'
        : '') +
      '</div>';
  }

  // ---- Rendu : frise (lecture) — 2 vues complémentaires ----
  //   1. Frise HORIZONTALE : chevrons emboîtés, couleurs alternées,
  //      scrollable (overflow-x), titre + dates seulement, cliquables
  //      (goBloc → saut au détail). À l'impression : wrap + tout visible.
  //   2. Frise VERTICALE : détail des contenus (axes, commentaires),
  //      toujours visible sous l'horizontale, mêmes codes couleur.
  //   + Cartouche + bouton d'export.
  // ── PLANIF-FRISE-CHRONOLOGIQUE : frise à échelle de temps réelle ──
  // Parse 'YYYY-MM-DD' en timestamp (ms). Renvoie NaN si invalide.
  function parseJour(s) {
    if (!s) return NaN;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }

  // Périodes effectives d'un bloc pour la frise :
  //  - bloc intercalé avec periodes saisies → ses périodes (couples complets) ;
  //  - sinon → une pseudo-période unique [date_debut, date_fin] si datée.
  // Chaque période renvoyée porte {d0, d1} en ms (d1 borné >= d0).
  function periodesEffectives(b) {
    var out = [];
    if (b.intercale && Array.isArray(b.periodes) && b.periodes.length) {
      b.periodes.forEach(function (p) {
        if (!p || !p.debut || !p.fin) return;
        var a = parseJour(p.debut), z = parseJour(p.fin);
        if (isNaN(a) || isNaN(z)) return;
        out.push({ d0: Math.min(a, z), d1: Math.max(a, z), debut: p.debut, fin: p.fin });
      });
    }
    if (out.length === 0) {
      var a2 = parseJour(b.date_debut), z2 = parseJour(b.date_fin);
      if (!isNaN(a2) || !isNaN(z2)) {
        var dd = isNaN(a2) ? z2 : a2, ff = isNaN(z2) ? a2 : z2;
        out.push({ d0: Math.min(dd, ff), d1: Math.max(dd, ff),
                   debut: b.date_debut || b.date_fin, fin: b.date_fin || b.date_debut });
      }
    }
    out.sort(function (x, y) { return x.d0 - y.d0; });
    return out;
  }

  // Libellé mois court FR à partir d'un timestamp ms.
  var MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
                 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function moisLabel(ms) {
    var d = new Date(ms);
    return MOIS_FR[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
  }
  // Formate un 'YYYY-MM-DD' en 'JJ/MM' pour les étiquettes compactes.
  function jjmm(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? (m[3] + '/' + m[2]) : esc(s || '');
  }

  // Rendu de la frise chronologique. HTML positionné en % (responsive +
  // scroll conservé). Deux couches : blocs datés (bas) + intercalés (haut).
  function renderFriseTemporelle(persistes) {
    // Sépare datés / non datés.
    var datesToutes = [];
    var blocsDatables = [];
    var nonDates = 0;
    persistes.forEach(function (b, i) {
      var pers = periodesEffectives(b);
      if (pers.length === 0) { nonDates++; return; }
      pers.forEach(function (p) { datesToutes.push(p.d0); datesToutes.push(p.d1); });
      blocsDatables.push({ b: b, i: i, pers: pers });
    });

    if (blocsDatables.length === 0) {
      var vide = '<p class="pa-attente">Aucun bloc daté à afficher sur l\'axe.</p>';
      if (nonDates > 0) {
        vide += '<p class="pa-ft__nondate">' + nonDates +
          ' bloc(s) non daté(s) — visibles dans le détail ci-dessous.</p>';
      }
      return vide;
    }

    // Échelle : min/max des dates saisies. Plancher anti-division par zéro
    // (min=max ⇒ on force une fenêtre d'1 mois pour donner une largeur).
    var tMin = Math.min.apply(null, datesToutes);
    var tMax = Math.max.apply(null, datesToutes);
    if (tMax <= tMin) { tMax = tMin + 30 * 24 * 3600 * 1000; }
    var span = tMax - tMin;
    var pct = function (ms) { return ((ms - tMin) / span) * 100; };

    // Graduations mensuelles (1er de chaque mois dans la fenêtre).
    var grads = '';
    var cur = new Date(tMin);
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
    for (var guard = 0; guard < 60; guard++) {
      var ms = cur.getTime();
      if (ms > tMax) break;
      if (ms >= tMin) {
        var left = pct(ms);
        grads += '<span class="pa-ft__grad" style="left:' + left.toFixed(3) + '%">' +
          '<span class="pa-ft__grad-lbl">' + esc(moisLabel(ms)) + '</span></span>';
      }
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }

    // Couche basse : blocs principaux (non intercalés) + intercalés ayant
    // « rejoint la frise principale » (rejoint_frise=true). Ces derniers
    // sont rendus en une barre par période, à leur teinte intercalée.
    var bas = '';
    var ci = 0;
    // Index de teinte : stable par bloc intercalé, pour cohérence avec la
    // légende et un éventuel autre intercalé resté en couche haute.
    var rangInterBas = 0;
    blocsDatables.forEach(function (o) {
      if (o.b.intercale && !o.b.rejoint_frise) return; // reste en couche haute
      if (!o.b.intercale) {
        // Bloc principal : chevron plein, cycle de couleurs de saison.
        var couleurCls = FRISE_CYCLE[ci % FRISE_CYCLE.length]; ci++;
        var p = o.pers[0];
        var l = pct(p.d0), w = Math.max(pct(p.d1) - pct(p.d0), 2.2);
        bas += '<div class="pa-ft__bloc ' + couleurCls + '" ' +
          'style="left:' + l.toFixed(3) + '%;width:' + w.toFixed(3) + '%" ' +
          'data-act="gobloc" data-n="' + (o.i + 1) + '" ' +
          'title="' + esc(o.b.titre || 'Sans titre') + '">' +
          '<span class="pa-ft__num">' + (o.i + 1) + '</span>' +
          '<span class="pa-ft__titre">' + esc(o.b.titre || 'Sans titre') + '</span>' +
          '<span class="pa-ft__date">' + jjmm(p.debut) + '→' + jjmm(p.fin) + '</span>' +
          '</div>';
      } else {
        // Intercalé rejoint : une barre chevron par période, teinte du bloc.
        var teinteB = INTER_CYCLE[rangInterBas % INTER_CYCLE.length]; rangInterBas++;
        var numB = o.i + 1;
        o.pers.forEach(function (p, k) {
          var lb = pct(p.d0), wb = Math.max(pct(p.d1) - pct(p.d0), 1.8);
          bas += '<div class="pa-ft__bloc pa-ft__bloc--rf ' + teinteB + '" ' +
            'style="left:' + lb.toFixed(3) + '%;width:' + wb.toFixed(3) + '%" ' +
            'data-act="gobloc" data-n="' + numB + '" ' +
            'title="' + esc(o.b.titre || 'Sans titre') + ' · période ' + (k + 1) +
              ' (' + jjmm(p.debut) + '→' + jjmm(p.fin) + ')">' +
            '<span class="pa-ft__num">' + numB + '·' + (k + 1) + '</span>' +
            '<span class="pa-ft__titre">' + esc(o.b.titre || 'Sans titre') + '</span>' +
            '</div>';
        });
      }
    });

    // Couche haute : blocs intercalés, une barre par période, reliées.
    // Chaque bloc intercalé reçoit une TEINTE distincte (cycle) pour être
    // différenciable d'un autre bloc intercalé, et un NIVEAU vertical (0,1,…)
    // pour éviter que deux blocs se croisent quand leurs périodes s'entremêlent.
    var haut = '';
    var interComptes = blocsDatables.filter(function (o) {
      return o.b.intercale && !o.b.rejoint_frise;
    });
    interComptes.forEach(function (o, rangInter) {
      var teinte = INTER_CYCLE[rangInter % INTER_CYCLE.length];
      var niveau = rangInter % INTER_NIVEAUX; // 0..INTER_NIVEAUX-1
      var num = o.i + 1;
      var lFirst = pct(o.pers[0].d0);
      var lLast = pct(o.pers[o.pers.length - 1].d1);
      haut += '<div class="pa-ft__lien ' + teinte + ' niv' + niveau + '" style="left:' +
        lFirst.toFixed(3) + '%;width:' + Math.max(lLast - lFirst, 0).toFixed(3) + '%"></div>';
      o.pers.forEach(function (p, k) {
        var l = pct(p.d0), w = Math.max(pct(p.d1) - pct(p.d0), 1.8);
        haut += '<div class="pa-ft__inter ' + teinte + ' niv' + niveau + '" ' +
          'style="left:' + l.toFixed(3) + '%;width:' + w.toFixed(3) + '%" ' +
          'data-act="gobloc" data-n="' + num + '" ' +
          'title="' + esc(o.b.titre || 'Sans titre') + ' · période ' + (k + 1) +
            ' (' + jjmm(p.debut) + '→' + jjmm(p.fin) + ')">' +
          '<span class="pa-ft__inter-num">' + num + '·' + (k + 1) + '</span>' +
          '</div>';
      });
    });

    var h = '<div class="pa-ft-scroll"><div class="pa-ft">';
    h += '<div class="pa-ft__axe">' + grads + '</div>';
    h += '<div class="pa-ft__haut">' + haut + '</div>';
    h += '<div class="pa-ft__bas">' + bas + '</div>';
    h += '</div></div>';
    if (nonDates > 0) {
      h += '<p class="pa-ft__nondate">' + nonDates +
        ' bloc(s) non daté(s) — non placés sur l\'axe, visibles dans le détail ci-dessous.</p>';
    }
    return h;
  }

  function renderFrise() {
    var persistes = State.blocs.filter(function (b) { return !b._draft; });
    var h = '<section class="pa-card pa-frise-card">';
    h += renderCartouche();

    if (persistes.length === 0) {
      h += '<p class="pa-attente">Aucun bloc enregistré pour l\'instant. La frise s\'affichera ici.</p>';
      h += '</section>';
      return h;
    }

    // Barre d'outils (export) — masquée à l'impression via @media print.
    h += '<div class="pa-frise-tools">' +
      '<button type="button" class="pa-btn pa-frise-export" data-act="export">' +
      'Exporter / Imprimer (PDF)</button></div>';

    // 1) Frise chronologique (échelle de temps réelle, une seule ligne).
    // PLANIF-FRISE-CHRONOLOGIQUE : remplace l'ancienne frise séquentielle
    // de chevrons (pa-fh). Les blocs sont positionnés/dimensionnés selon
    // leurs vraies dates ; un bloc intercalé se fractionne en une barre par
    // période (posées sur le haut, texte par étages pour rester lisible).
    h += renderFriseTemporelle(persistes);

    // 2) Frise verticale (détail), toujours visible.
    h += '<div class="pa-fv-titre">Détail des blocs</div>';
    h += '<div class="pa-fv"><div class="pa-fv__rail"></div><div class="pa-fv-grid">';
    persistes.forEach(function (b, i) {
      var inter = !!b.intercale;
      var couleur = inter ? '' : FRISE_CYCLE[i % FRISE_CYCLE.length];
      // PLANIF-SOUSBLOCS-PAR-JOUR (recette) : les axes vivent au niveau du jour.
      // On n'affiche les axes génériques du bloc QUE s'il n'a aucun jour
      // (fallback résiduel) ; sinon la frise ne montre que les jours, pour
      // éviter le doublon bloc/jour.
      var joursPersistes = (Array.isArray(b._jours) ? b._jours : [])
        .filter(function (j) { return !j._draft; });
      var axes = (joursPersistes.length > 0) ? [] : axesDuBloc(b);
      var periode = (b.date_debut || b.date_fin)
        ? esc(b.date_debut || '?') + ' → ' + esc(b.date_fin || '?')
        : '';
      h += '<div class="pa-fv__item' + (inter ? ' pa-fv__item--inter' : '') + '" id="pa-bloc-' + (i + 1) + '">' +
        '<div class="pa-fv__num ' + couleur + '">' + (i + 1) + '</div>' +
        '<div class="pa-fv__card ' + couleur + '">' +
          '<div class="pa-fv__bar">' +
            '<span class="pa-fv__titre">' + esc(b.titre || 'Sans titre') +
              (inter ? ' <em>· intercalé</em>' : '') + '</span>' +
            (periode ? '<span class="pa-fv__date">' + periode + '</span>' : '') +
          '</div>' +
          renderPeriodesDetail(b) +
          (axes.length
            ? '<ul>' + axes.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
            : '') +
          renderJoursFrise(b) +
          (b.commentaires ? '<p>' + esc(b.commentaires) + '</p>' : '') +
        '</div>' +
        '</div>';
    });
    h += '</div></div>';

    h += '</section>';
    return h;
  }

  // Saut doux vers le bloc de détail n (clic sur un chevron), + flash.
  function goBloc(n) {
    var el = document.getElementById('pa-bloc-' + n);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var card = el.querySelector('.pa-fv__card');
    if (!card) return;
    card.classList.remove('is-target');
    // reflow pour relancer l'animation même si déjà ciblé
    void card.offsetWidth;
    card.classList.add('is-target');
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
        // PLANIF-BLOCS-INTERCALES-MULTIPERIODES : cocher/décocher « intercalé »
        // déplie/replie l'éditeur de périodes → re-render.
        if (f === 'intercale') render();
      });
    });

    // PLANIF-BLOCS-INTERCALES-MULTIPERIODES : inputs date des périodes.
    root.querySelectorAll('[data-per-debut], [data-per-fin]').forEach(function (el) {
      el.addEventListener('input', function () {
        var b = findBloc(el.getAttribute('data-id'));
        if (!b) return;
        b.periodes = Array.isArray(b.periodes) ? b.periodes : [];
        var isDebut = el.hasAttribute('data-per-debut');
        var idx = parseInt(el.getAttribute(isDebut ? 'data-per-debut' : 'data-per-fin'), 10);
        if (isNaN(idx) || idx < 0) return;
        if (!b.periodes[idx]) b.periodes[idx] = { debut: '', fin: '' };
        b.periodes[idx][isDebut ? 'debut' : 'fin'] = el.value;
      });
    });

    // PLANIF recette v4 : case « rejoindre la frise principale » (bloquante).
    root.querySelectorAll('[data-rf]').forEach(function (el) {
      el.addEventListener('change', function () {
        onRejointFrise(el.getAttribute('data-rf'), el.checked);
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
        if (act === 'gobloc') return goBloc(el.getAttribute('data-n'));
        if (act === 'export') return window.print();
        var id = el.getAttribute('data-id');
        if (act === 'save') return onSave(id);
        if (act === 'del') return onDelete(id);
        if (act === 'up') return onMove(id, -1);
        if (act === 'down') return onMove(id, 1);
        // PLANIF-BLOCS-INTERCALES-MULTIPERIODES : gestion des périodes.
        if (act === 'per-add') return onPeriodeAdd(id);
        if (act === 'per-del') return onPeriodeDel(id, el.getAttribute('data-per'));
      });
    });

    // ── PLANIF-SOUSBLOCS-PAR-JOUR : handlers dédiés « jour » (additifs) ──
    // Champs simples du jour (select jour / titre). Auto-save au changement.
    root.querySelectorAll('[data-jour-f]').forEach(function (el) {
      var evt = (el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(evt, function () {
        var jid = el.getAttribute('data-jid');
        var j = findJour(jid);
        if (!j) return;
        var f = el.getAttribute('data-jour-f');
        j[f] = (f === 'jour') ? Number(el.value) : el.value;
        scheduleAutosaveJour(jid);
      });
    });

    // Axe individuel du jour (cases). Auto-save au changement.
    root.querySelectorAll('[data-jour-indiv]').forEach(function (el) {
      el.addEventListener('change', function () {
        var jid = el.getAttribute('data-jid');
        var j = findJour(jid);
        if (!j) return;
        var id = el.getAttribute('data-jour-indiv');
        j.axe_indiv = j.axe_indiv || [];
        var pos = j.axe_indiv.indexOf(id);
        if (el.checked && pos < 0) j.axe_indiv.push(id);
        if (!el.checked && pos >= 0) j.axe_indiv.splice(pos, 1);
        scheduleAutosaveJour(jid);
      });
    });

    // Pioches axes du jour (select) → bascule champ libre. Auto-save.
    root.querySelectorAll('[data-jouraxe]').forEach(function (el) {
      el.addEventListener('change', function () {
        var jid = el.getAttribute('data-jid');
        var j = findJour(jid);
        if (!j) return;
        var champ = el.getAttribute('data-jouraxe');
        var custom = root.querySelector('[data-jouraxecustom="' + champ + '"][data-jid="' + jid + '"]');
        if (el.value === AUTRE) {
          if (custom) { custom.style.display = ''; j[champ] = custom.value || ''; }
        } else {
          if (custom) custom.style.display = 'none';
          j[champ] = el.value;
        }
        scheduleAutosaveJour(jid);
      });
    });

    // Champs libres axes du jour. Auto-save à la frappe.
    root.querySelectorAll('[data-jouraxecustom]').forEach(function (el) {
      el.addEventListener('input', function () {
        var jid = el.getAttribute('data-jid');
        var j = findJour(jid);
        if (!j) return;
        j[el.getAttribute('data-jouraxecustom')] = el.value;
        scheduleAutosaveJour(jid);
      });
    });

    // Boutons d'action « jour » (ajout / suppression / duplication).
    // Plus de bouton « save » : l'enregistrement est automatique.
    root.querySelectorAll('[data-jouract]').forEach(function (el) {
      el.addEventListener('click', function () {
        var act = el.getAttribute('data-jouract');
        if (act === 'add') return onAddJour(el.getAttribute('data-bloc'));
        var jid = el.getAttribute('data-jid');
        if (act === 'del') return onDeleteJour(jid);
        if (act === 'dup') return onDupJour(el.getAttribute('data-bloc'), jid);
      });
    });
  }

  // Cherche un jour dans tous les _jours de tous les blocs.
  function findJour(jid) {
    for (var i = 0; i < State.blocs.length; i++) {
      var arr = State.blocs[i]._jours || [];
      for (var k = 0; k < arr.length; k++) {
        if (String(arr[k].id) === String(jid)) return arr[k];
      }
    }
    return null;
  }

  function blocDeJour(jid) {
    for (var i = 0; i < State.blocs.length; i++) {
      var arr = State.blocs[i]._jours || [];
      for (var k = 0; k < arr.length; k++) {
        if (String(arr[k].id) === String(jid)) return State.blocs[i];
      }
    }
    return null;
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
      rejoint_frise: !!b.rejoint_frise,
      // PLANIF-BLOCS-INTERCALES-MULTIPERIODES : périodes poussées uniquement
      // si le bloc est intercalé ; on ne garde que les couples complets et
      // triés par début (le trigger base recalcule ensuite date_debut/fin).
      periodes: (b.intercale && Array.isArray(b.periodes))
        ? b.periodes
            .filter(function (p) { return p && p.debut && p.fin; })
            .map(function (p) { return { debut: p.debut, fin: p.fin }; })
            .sort(function (x, y) { return x.debut < y.debut ? -1 : (x.debut > y.debut ? 1 : 0); })
        : [],
      axe_indiv: b.axe_indiv || [],
      axe_collectif: b.axe_collectif || null,
      axe_physique: b.axe_physique || null,
      axe_poste: b.axe_poste || null,
      commentaires: b.commentaires || null
    };
    if (!b._draft) p.id = b.id;
    return p;
  }

  // PLANIF-BLOCS-INTERCALES-MULTIPERIODES : ajoute une période vide au bloc.
  // PLANIF recette v4 : deux intervalles [a0,a1] et [b0,b1] se chevauchent ?
  function intervallesChevauchent(a0, a1, b0, b1) {
    return a0 <= b1 && b0 <= a1;
  }

  // Détecte si les périodes du bloc `cible` (intercalé) chevauchent un bloc
  // DÉJÀ présent sur la ligne principale : bloc principal (non intercalé,
  // daté) OU autre intercalé ayant déjà rejoint (rejoint_frise=true).
  // Renvoie le titre du 1er bloc en collision, ou null si aucune.
  function collisionLignePrincipale(cible) {
    var persCible = periodesEffectives(cible);
    if (persCible.length === 0) return null;
    var autres = State.blocs.filter(function (x) {
      if (x._draft) return false;
      if (String(x.id) === String(cible.id)) return false;
      var surLigne = (!x.intercale) || (x.intercale && x.rejoint_frise);
      return surLigne;
    });
    for (var i = 0; i < autres.length; i++) {
      var persAutre = periodesEffectives(autres[i]);
      for (var a = 0; a < persCible.length; a++) {
        for (var z = 0; z < persAutre.length; z++) {
          if (intervallesChevauchent(persCible[a].d0, persCible[a].d1,
                                     persAutre[z].d0, persAutre[z].d1)) {
            return autres[i].titre || 'Sans titre';
          }
        }
      }
    }
    return null;
  }

  // Handler de la case « rejoindre la frise principale » (bloquant).
  // Coché : n'active que si aucune collision, sinon avertit et re-décoche.
  function onRejointFrise(id, checked) {
    var b = findBloc(id);
    if (!b) return;
    if (!checked) {
      b.rejoint_frise = false;
      b._rfAlert = '';
      render();
      return;
    }
    var conflit = collisionLignePrincipale(b);
    if (conflit) {
      b.rejoint_frise = false;
      b._rfAlert = '⛔ Impossible : une période chevauche « ' + conflit +
        ' » déjà sur la frise principale. Ajuste les dates avant d\'activer.';
      render();
      return;
    }
    b.rejoint_frise = true;
    b._rfAlert = '';
    render();
  }

  function onPeriodeAdd(id) {
    var b = findBloc(id);
    if (!b) return;
    b.periodes = Array.isArray(b.periodes) ? b.periodes : [];
    b.periodes.push({ debut: '', fin: '' });
    render();
  }

  // PLANIF-BLOCS-INTERCALES-MULTIPERIODES : retire la période d'indice idx.
  function onPeriodeDel(id, idxAttr) {
    var b = findBloc(id);
    if (!b) return;
    var idx = parseInt(idxAttr, 10);
    if (isNaN(idx) || idx < 0) return;
    b.periodes = Array.isArray(b.periodes) ? b.periodes : [];
    if (idx < b.periodes.length) b.periodes.splice(idx, 1);
    render();
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
        // Preserve les jours deja charges en memoire : res.data vient de
        // planification_blocs et ne porte PAS _jours (autre table). Sans ca,
        // les jours disparaissent a l'ecran jusqu'au prochain rechargement.
        res.data._jours = Array.isArray(State.blocs[i]._jours) ? State.blocs[i]._jours : [];
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

  // ── PLANIF-SOUSBLOCS-PAR-JOUR : actions « jour » ──
  function setStateJour(jid, msg, ok) {
    var sel = (window.CSS && CSS.escape) ? CSS.escape(jid) : jid;
    var el = State.mount.querySelector('[data-jstate="' + sel + '"]');
    if (el) { el.textContent = msg; el.className = 'pa-bloc__state' + (ok === false ? ' pa-bloc__state--err' : (ok ? ' pa-bloc__state--ok' : '')); }
  }

  // Payload propre d'un jour pour la base (id omis si brouillon).
  function payloadJour(j) {
    var p = {
      bloc_id: j.bloc_id,
      jour: Number(j.jour),
      titre: j.titre || null,
      axe_indiv: j.axe_indiv || [],
      axe_collectif: j.axe_collectif || null,
      axe_physique: j.axe_physique || null,
      axe_poste: j.axe_poste || null,
      commentaire: j.commentaire || null
    };
    if (!j._draft) p.id = j.id;
    return p;
  }

  function onAddJour(blocId) {
    var b = findBloc(blocId);
    if (!b || b._draft) return; // un bloc non persisté ne peut pas porter de jour
    b._jours = b._jours || [];
    b._jours.push(newJourDraft(b.id));
    render();
  }

  // Duplique un jour (contenu identique, nouveau brouillon à enregistrer).
  function onDupJour(blocId, jid) {
    var b = findBloc(blocId);
    var src = findJour(jid);
    if (!b || !src) return;
    var copie = newJourDraft(b.id);
    copie.jour = Number(src.jour);
    copie.titre = src.titre || '';
    copie.axe_indiv = (src.axe_indiv || []).slice();
    copie.axe_collectif = src.axe_collectif || '';
    copie.axe_physique = src.axe_physique || '';
    copie.axe_poste = src.axe_poste || '';
    copie.commentaire = src.commentaire || '';
    b._jours = b._jours || [];
    b._jours.push(copie);
    render();
  }

  // ── PLANIF-SOUSBLOCS-PAR-JOUR (recette) : AUTO-SAVE des jours ──
  // Plus de bouton « Mettre à jour » : chaque modif d'un champ jour programme
  // un enregistrement differé (debounce). L'auto-save est SILENCIEUX (pas de
  // render()) pour ne pas voler le focus pendant la saisie ; seul l'indicateur
  // d'état est mis à jour. Un draft (tmpj-*) est d'abord inséré (récupère son
  // uuid), puis les modifs suivantes passent en update.
  var AUTOSAVE_DELAY = 800;
  var _jourTimers = {};   // jid -> timeout
  var _jourSaving = {};   // jid -> bool (verrou anti double-insert)
  var _jourRedo = {};     // jid -> bool (une modif est survenue pendant un save)

  function scheduleAutosaveJour(jid) {
    if (!State.peutEditer) return;
    setStateJour(jid, 'Modifié…', null);
    if (_jourTimers[jid]) clearTimeout(_jourTimers[jid]);
    _jourTimers[jid] = setTimeout(function () { flushAutosaveJour(jid); }, AUTOSAVE_DELAY);
  }

  function flushAutosaveJour(jid) {
    var j = findJour(jid);
    var b = blocDeJour(jid);
    if (!j || !b) return;
    // Verrou : si un save est déjà en cours pour ce jour, on note qu'il faudra
    // resauver après (évite deux inserts concurrents d'un même draft).
    if (_jourSaving[jid]) { _jourRedo[jid] = true; return; }
    _jourSaving[jid] = true;
    setStateJour(jid, 'Enregistrement…', null);

    var etaitDraft = !!j._draft;
    hub().savePlanificationJour(payloadJour(j)).then(function (res) {
      _jourSaving[jid] = false;
      if (!res || !res.ok) {
        setStateJour(jid, 'Échec : ' + ((res && res.error) || 'erreur'), false);
        return;
      }
      // Draft inséré : on récupère l'uuid réel et on ré-étiquette l'objet +
      // les éléments DOM du jour (sans render, pour garder le focus).
      if (etaitDraft && res.data && res.data.id) {
        var nouvelId = res.data.id;
        j.id = nouvelId;
        j._draft = false;
        reetiqueterJourDom(jid, nouvelId);
        // bascule les timers/verrous éventuels sur le nouvel id
        if (_jourRedo[jid]) { delete _jourRedo[jid]; _jourRedo[nouvelId] = true; }
        jid = nouvelId;
      }
      setStateJour(jid, 'Enregistré ✓', true);
      // Une modif est arrivée pendant l'enregistrement : on resauve.
      if (_jourRedo[jid]) { delete _jourRedo[jid]; scheduleAutosaveJour(jid); }
    }).catch(function () {
      _jourSaving[jid] = false;
      setStateJour(jid, 'Échec réseau', false);
    });
  }

  // Après insertion d'un draft, remplace l'id temporaire par l'uuid réel sur
  // tous les éléments DOM du jour, pour que les modifs suivantes ciblent bien
  // la ligne en base (sans re-render complet).
  function reetiqueterJourDom(ancienId, nouvelId) {
    var root = State.mount;
    if (!root) return;
    var esc1 = (window.CSS && CSS.escape) ? CSS.escape(ancienId) : ancienId;
    root.querySelectorAll('[data-jid="' + esc1 + '"]').forEach(function (el) {
      el.setAttribute('data-jid', nouvelId);
    });
    var st = root.querySelector('[data-jstate="' + esc1 + '"]');
    if (st) st.setAttribute('data-jstate', nouvelId);
  }

  function onDeleteJour(jid) {
    var j = findJour(jid);
    var b = blocDeJour(jid);
    if (!j || !b) return;
    // Brouillon non persisté : suppression locale directe.
    if (j._draft) {
      b._jours = (b._jours || []).filter(function (x) { return String(x.id) !== String(jid); });
      render();
      return;
    }
    if (!global.confirm('Supprimer ce jour d\'entraînement ? Cette action est définitive.')) return;
    hub().deletePlanificationJour(jid).then(function (res) {
      if (!res || !res.ok) { setStateJour(jid, 'Échec suppression : ' + ((res && res.error) || ''), false); return; }
      b._jours = (b._jours || []).filter(function (x) { return String(x.id) !== String(jid); });
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
    State.mount.innerHTML = bloc('Accès réservé',
      '<p>Cet espace est réservé aux encadrants et responsables de pôle.</p>');
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
