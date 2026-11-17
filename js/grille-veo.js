/* =====================================================================
 * grille-veo.js — Grille d'analyse VEO à imprimer (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.0 — 17 novembre 2026 — GRILLE-VEO v1
 *   FAIT FOI : Conception-GRILLE-VEO-v1.md (gelé par Manu le 17/11/2026,
 *   « je gèle R2 »). Demande de Vivien (aide au visionnage VEO pour
 *   Théo), traitée dans la conversation EVAL-JOUEUR (« enchaîne ici »,
 *   écart tracé au STATE).
 *
 * Page : grille-veo.html?evenement=<uuid>. Staff connecté.
 * Rendu A4 paysage, une page (impression navigateur).
 *
 * Données (lecture seule, aucun SQL nouveau) :
 *   - SupabaseHub.listEvalsMatch(evt) : en-tête du match (libellé, date,
 *     adversaire, niveau) + garde de lecture de la catégorie ;
 *   - compo active du match (compositions type 'match', côté 'mom',
 *     est_active) via SupabaseHub.client puis getCompoComplete(id) :
 *     numéro de maillot + poste de chaque joueur ;
 *   - SupabaseHub.getPostes() : numero_xv de chaque poste.
 *
 * Classement (G3, R2) :
 *   - titulaire = maillot 1 à 15 ; remplaçant = 16 et plus, mention (R) ;
 *   - bloc = numero_xv du poste de compo, sinon (titulaire) le maillot :
 *     1-8 Avants, 11-14 3/4, 9-10-15 « 9 · 10 · 15 » ;
 *   - remplaçant sans poste : listé « À placer » sous l'en-tête ;
 *   - 1 ligne vierge par bloc ; sans compo : lignes vierges seulement.
 * Observables (G4/G5, 3ᵉ tour) : cochables avant impression (non
 * mémorisé, G7). Libellés imposés par Manu et Vivien.
 * Anti-injection : toute donnée dynamique passe par esc().
 * ===================================================================== */
(function () {
  'use strict';

  // G4 — communs (ordre imposé). d = colonnes ✓ / ✗.
  var COMMUNS = [
    { id: 'plaquage', nom: 'Plaquage', d: true },
    { id: 'ruck', nom: 'Attitude sur ruck', d: true },
    { id: 'franchissement', nom: 'Franchis.', titre: 'Franchissement' },
    { id: 'duel', nom: 'Duel', d: true },
    { id: 'passe_dec', nom: 'Passe déc.', titre: 'Passe décisive' },
    { id: 'en_avant', nom: 'En-avant' },
    { id: 'pen_conc', nom: 'Pén. conc.', titre: 'Pénalité concédée' },
    { id: 'ballon_perdu', nom: 'Ballon perdu' },
    { id: 'essai', nom: 'Essai' },
    { id: 'carton', nom: 'Carton' },
    { id: 'action_remarq', nom: 'Action remarq.', titre: 'Action remarquable' }
  ];
  // G5 — spécifiques par bloc.
  var BLOCS = [
    { id: 'avants', nom: 'Avants', specs: [
      { id: 'lancer', nom: 'Lancer touche', d: true },
      { id: 'prise', nom: 'Prise touche', d: true },
      { id: 'melee', nom: 'Attitude mêlée', d: true },
      { id: 'contact', nom: 'Avancée au contact' }
    ] },
    { id: 'trois_quarts', nom: '3/4', specs: [
      { id: 'course', nom: 'Bonne course' },
      { id: 'contest', nom: 'Contest aérien' }
    ] },
    { id: 'charniere', nom: '9 · 10 · 15', specs: [
      { id: 'gestion', nom: 'Gestion', d: true },
      { id: 'choix', nom: 'Choix de jeu', d: true },
      { id: 'pied', nom: 'Animation au pied', d: true },
      { id: 'but', nom: 'Tir au but', d: true }
    ] }
  ];
  var LIGNES_SANS_COMPO = { avants: 10, trois_quarts: 6, charniere: 5 };

  var etat = {
    evenementId: null,
    match: null,
    blocs: { avants: [], trois_quarts: [], charniere: [] },
    aPlacer: [],
    avecCompo: false,
    decoches: {}            // cle 'commun:<id>' ou '<bloc>:<id>' -> true
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateFr(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function blocDuNumero(n) {
    if (n >= 1 && n <= 8) return 'avants';
    if (n >= 11 && n <= 14) return 'trois_quarts';
    if (n === 9 || n === 10 || n === 15) return 'charniere';
    return null;
  }

  // ------------------------------------------------------------------
  // Chargement
  // ------------------------------------------------------------------
  async function charger() {
    var r = await SupabaseHub.listEvalsMatch(etat.evenementId);
    if (!r.ok || !r.data) {
      erreur(/Droit insuffisant/.test(r.error || '') ? 'Tu n’as pas accès à ce match.'
        : 'Chargement impossible : ' + (r.error || 'erreur inconnue'));
      return false;
    }
    etat.match = r.data.match || {};
    var noms = {};
    (r.data.joueurs || []).forEach(function (j) { noms[j.personne_id] = j; });

    // Compo active du match (même critère que lister_evals_match).
    var cr = await SupabaseHub.client.from('compositions').select('id, updated_at')
      .eq('evenement_id', etat.evenementId).eq('type_compo', 'match').eq('cote', 'mom').eq('est_active', true)
      .order('updated_at', { ascending: false }).limit(1);
    var compoId = (!cr.error && cr.data && cr.data[0]) ? cr.data[0].id : null;
    if (!compoId) return true;
    var compo = await SupabaseHub.getCompoComplete(compoId);
    if (!compo || !compo.joueurs) return true;
    var postes = await SupabaseHub.getPostes();
    var numXv = {};
    (Array.isArray(postes) ? postes : (postes && postes.data) || []).forEach(function (p) { numXv[p.id] = p.numero_xv; });

    etat.avecCompo = true;
    var vus = {};
    compo.joueurs.forEach(function (cj) {
      var p = cj.personnes || noms[cj.joueur_id] || {};
      if (!cj.joueur_id || vus[cj.joueur_id]) return;
      vus[cj.joueur_id] = true;
      var maillot = cj.numero_maillot;
      var remp = !(maillot >= 1 && maillot <= 15);
      var bloc = blocDuNumero(numXv[cj.poste_id]) || (remp ? null : blocDuNumero(maillot));
      var ligne = { num: maillot, nom: (p.nom || '').toUpperCase(), prenom: p.prenom || '', remp: remp };
      if (bloc) etat.blocs[bloc].push(ligne); else etat.aPlacer.push(ligne);
    });
    Object.keys(etat.blocs).forEach(function (b) {
      etat.blocs[b].sort(function (a, c) { return (a.remp - c.remp) || ((a.num || 99) - (c.num || 99)); });
    });
    return true;
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------
  function colonnesDe(bloc) {
    var cols = [];
    COMMUNS.forEach(function (c) { if (!etat.decoches['commun:' + c.id]) cols.push(c); });
    bloc.specs.forEach(function (c) { if (!etat.decoches[bloc.id + ':' + c.id]) cols.push(c); });
    return cols;
  }
  // Largeurs explicites : avec table-layout:fixed, la 1re ligne d'en-tête
  // (colspans) ne fixe rien. 9 mm par case d'observable : les communs
  // tombent alignés d'un bloc à l'autre ; Commentaires prend le reste.
  function colgroup(cols) {
    var nb = cols.reduce(function (n, c) { return n + (c.d ? 2 : 1); }, 0);
    return '<colgroup><col style="width:7mm"><col style="width:42mm">'
      + new Array(nb + 1).join('<col style="width:9mm">') + '<col></colgroup>';
  }
  function enteteTable(cols) {
    var r1 = '<th rowspan="2" class="num">N°</th><th rowspan="2" class="nom">Joueur</th>', r2 = '';
    cols.forEach(function (c) {
      if (c.d) {
        r1 += '<th colspan="2" title="' + esc(c.titre || c.nom) + '">' + esc(c.nom) + '</th>';
        r2 += '<th class="s">✓</th><th class="s">✗</th>';
      } else {
        r1 += '<th rowspan="2" class="v" title="' + esc(c.titre || c.nom) + '"><span>' + esc(c.nom) + '</span></th>';
      }
    });
    return '<tr>' + r1 + '<th rowspan="2" class="com">Commentaires</th></tr><tr>' + r2 + '</tr>';
  }
  function ligneTable(l, cols) {
    var nb = cols.reduce(function (n, c) { return n + (c.d ? 2 : 1); }, 0);
    var nom = l ? esc(l.nom) + ' ' + esc(l.prenom) + (l.remp ? ' <small>(R)</small>' : '') : '';
    return '<tr><td class="num">' + (l && l.num != null ? esc(l.num) : '') + '</td><td class="nom">' + nom + '</td>'
      + new Array(nb + 1).join('<td></td>') + '<td class="com"></td></tr>';
  }
  function totalLignes() {
    return BLOCS.reduce(function (n, b) {
      return n + (etat.avecCompo ? etat.blocs[b.id].length + 1 : LIGNES_SANS_COMPO[b.id]);
    }, 0);
  }

  function rendreGrille() {
    var m = etat.match || {};
    var titre = m.libelle || 'Match';
    var meta = [titre, dateFr(m.date), m.niveau].filter(Boolean).join(' · ');
    var serre = totalLignes() > 21;
    var h = '<div class="gv-feuille' + (serre ? ' gv-serre' : '') + '">'
      + '<div class="tete"><div><h1>Grille d’analyse VEO</h1><div class="meta">' + esc(meta) + '</div></div>'
      + '<div class="meta" style="display:flex;gap:4mm;align-items:flex-end">'
      + '<table class="coll"><caption>Collectif</caption>'
      + '<tr><th colspan="2">Touches</th><th colspan="2">Mêlées</th><th colspan="2">Pénalités</th></tr>'
      + '<tr><th class="s">Gagnées</th><th class="s">Perdues</th><th class="s">Gagnées</th><th class="s">Perdues</th><th class="s">Pour</th><th class="s">Contre</th></tr>'
      + '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>'
      + '<div>Analyste <span class="champ"></span><br><br>Date <span class="champ" style="min-width:25mm"></span></div></div></div>'
      + '<div class="legende">Un trait par action. ✓ réussi / ✗ raté · (R) : remplaçant · Ligne vierge : joueur entré en jeu non prévu.'
      + (etat.avecCompo ? '' : ' · <strong>Pas de compo de match enregistrée : noms à écrire à la main.</strong>')
      + (etat.aPlacer.length ? ' · <strong>À placer :</strong> ' + etat.aPlacer.map(function (l) {
        return esc((l.num != null ? l.num + ' ' : '') + l.nom + ' ' + l.prenom);
      }).join(', ') : '')
      + '</div>';
    BLOCS.forEach(function (b) {
      var cols = colonnesDe(b);
      var lignes = etat.avecCompo ? etat.blocs[b.id].slice() : [];
      var vierges = etat.avecCompo ? 1 : LIGNES_SANS_COMPO[b.id];
      h += '<table class="bloc"><caption>' + esc(b.nom) + '</caption>' + colgroup(cols) + enteteTable(cols)
        + lignes.map(function (l) { return ligneTable(l, cols); }).join('')
        + new Array(vierges + 1).join(ligneTable(null, cols)) + '</table>';
    });
    h += '</div>';
    $('gv-grille').innerHTML = h;
  }

  function rendreReglages() {
    var case_ = function (cle, c) {
      return '<label class="gv-case"><input type="checkbox" data-cle="' + esc(cle) + '"'
        + (etat.decoches[cle] ? '' : ' checked') + '> ' + esc(c.titre || c.nom) + (c.d ? ' ✓/✗' : '') + '</label>';
    };
    var h = '<fieldset><legend>Communs (tous les blocs)</legend>'
      + COMMUNS.map(function (c) { return case_('commun:' + c.id, c); }).join('') + '</fieldset>';
    BLOCS.forEach(function (b) {
      h += '<fieldset><legend>' + esc(b.nom) + '</legend>'
        + b.specs.map(function (c) { return case_(b.id + ':' + c.id, c); }).join('') + '</fieldset>';
    });
    $('gv-reglages').innerHTML = h;
  }

  function erreur(msg) {
    $('gv-ecran').innerHTML = '<div class="gv-erreur">' + esc(msg) + '</div>';
  }

  async function demarrer() {
    etat.evenementId = new URLSearchParams(window.location.search).get('evenement');
    if (!window.SupabaseHub || typeof SupabaseHub.listEvalsMatch !== 'function' || !SupabaseHub.client) {
      erreur('Client Supabase indisponible.');
      return;
    }
    if (!etat.evenementId) { erreur('Aucun match indiqué. Ouvre cette page depuis la fiche du match.'); return; }
    if (!(await charger())) return;
    $('gv-retour').href = 'evenements.html';
    rendreReglages();
    rendreGrille();
    $('gv-reglages').addEventListener('change', function (e) {
      var cle = e.target && e.target.getAttribute('data-cle');
      if (!cle) return;
      if (e.target.checked) delete etat.decoches[cle]; else etat.decoches[cle] = true;
      rendreGrille();
    });
    $('gv-imprimer').addEventListener('click', function () { window.print(); });
  }

  window.GrilleVeo = { demarrer: demarrer };
})();
