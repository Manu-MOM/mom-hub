/* =====================================================================
 * parcours-selections.js — Parcours Performance : sélections et
 * convocations (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.0 — 21 novembre 2026 — PARCOURS-PERFORMANCE v1.3, lot L6
 *   FAIT FOI v1.3 gelé par Manu le 21/11/2026 (D13-D22), maquette validée.
 *
 * OBJET
 *   Bloc « En sélection » de parcours-performance.html (D19) :
 *     1. chiffres clés de la saison en sélection ;
 *     2. une carte par convocation (type, dates, statuts, matchs) ;
 *     3. tableau des joueurs en sélection ;
 *   + modale convocation (D14-D15 : évènement + joueurs et statuts) ;
 *   + modale match de sélection (D16-D17 : saisie manuelle, rattachée à
 *     la convocation, grille = joueurs convoqués / retenus / réservistes).
 *
 * BRANCHEMENT
 *   parcours-performance.js (v1.5) appelle :
 *     ParcoursSelections.definir({ categorieId, saison, matchs, recharger })
 *       à chaque chargement (matchs = participations AVEC convocation_id) ;
 *     ParcoursSelections.peindre() à chaque rendu (zone #ps-zone).
 *
 * SOURCE DE VÉRITÉ
 *   RPC sql_281 via SupabaseHub (v2.01) : listParcoursConvocations,
 *   listParcoursConvocationJoueurs, listParcoursCandidats,
 *   saveParcoursConvocation, setParcoursConvocationJoueurs,
 *   deleteParcoursConvocation, saveParcoursMatch (convocation_id),
 *   deleteParcoursMatch. Droits portés par les RPC : l'UI relaie le refus.
 *
 * INVARIANTS
 *   - D3 / D19 : rien ici n'alimente les stats du collectif ; totaux
 *     séparés de ceux de l'équipe Performance.
 *   - D17 : clé d'un match de sélection = miroir de _pp_cle_match_sel
 *     (date | adversaire normalisé | phase normalisée si renseignée).
 *   - Aucune donnée affichée ici n'est publiée hors du Hub.
 * ===================================================================== */
(function () {
  'use strict';

  var TYPES = {
    scf: 'Super Challenge de France',
    interdep: 'Tournoi interdépartemental',
    tournoi: 'Autre tournoi en sélection',
    journee_bleue: 'Journée bleue',
    stage: 'Stage / regroupement',
    detection: 'Détection',
    autre: 'Autre'
  };
  var STATUTS = {
    convoque: 'Convoqué',
    retenu: 'Retenu',
    reserviste: 'Réserviste',
    absent: 'Absent / blessé',
    non_retenu: 'Non retenu'
  };
  var JOUANTS = ['convoque', 'retenu', 'reserviste'];
  var STATUT_JOUEUR = { titulaire: 'Titulaire', entre: 'Entré', non_entre: 'Non entré' };
  var LIEUX = { neutre: 'Terrain neutre', domicile: 'Domicile', exterieur: 'Extérieur' };
  var PHASES = ['Poule', 'Poule A', 'Poule B', 'Quart de finale', 'Demi-finale', 'Finale', 'Match de classement'];
  var EQUIPE_DEFAUT = 'Équipe d\'Alsace';
  var ORGANISATEUR_DEFAUT = 'CCEAR';

  var S = {
    categorieId: null,
    saison: null,
    convocs: [],
    joueurs: [],
    matchs: [],
    candidats: null,
    candidatsCat: null,
    charge: false,
    erreur: false,
    recharger: null,
    edition: null,       // convocation en cours d'édition
    editionMatch: null   // { conv, groupe }
  };
  var cable = false;

  // ------------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : esc(iso);
  }
  // Même affichage que parcours-performance.js (Prénom NOM) ; tri par NOM.
  function nomJoueur(r) {
    return (r.prenom ? r.prenom + ' ' : '') + String(r.nom || '').toUpperCase();
  }
  function cleTri(r) {
    return String(r.nom || '').toUpperCase() + ' ' + String(r.prenom || '');
  }
  function entier(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = parseInt(v, 10);
    return isNaN(x) ? null : x;
  }
  function norm(v) {
    return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase();
  }
  // Miroir de public._pp_cle_match_sel (D17).
  function cleSel(date, adversaire, phase) {
    var base = String(date || '').slice(0, 10) + '|' + norm(adversaire);
    var ph = norm(phase);
    return ph ? base + '|' + ph : base;
  }
  function pointsDe(r) {
    return (r.essais || 0) * 5 + (r.transformations || 0) * 2 +
           ((r.penalites || 0) + (r.drops || 0)) * 3;
  }
  function detailMarque(r) {
    var parts = [];
    function ajoute(n, sing, plur) { if (n > 0) parts.push(n + ' ' + (n > 1 ? plur : sing)); }
    ajoute(r.essais || 0, 'essai', 'essais');
    ajoute(r.transformations || 0, 'transfo', 'transfos');
    ajoute(r.penalites || 0, 'pénalité', 'pénalités');
    ajoute(r.drops || 0, 'drop', 'drops');
    return parts.join(', ');
  }
  function messageErreur(err) {
    var m = String(err || '');
    if (/droit insuffisant/i.test(m)) return 'Tu n\'as pas les droits d\'écriture sur cette catégorie (référents, bureau, admin).';
    return m || 'Erreur inconnue.';
  }
  function aujourdhui() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var jj = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + jj;
  }
  function hub() { return window.SupabaseHub; }

  // ------------------------------------------------------------------
  // Données
  // ------------------------------------------------------------------
  function grouperSel(rows) {
    var map = new Map();
    rows.forEach(function (r) {
      var k = r.convocation_id + '#' + cleSel(r.date_match, r.adversaire, r.phase);
      if (!map.has(k)) {
        map.set(k, {
          cle: k, convocation_id: r.convocation_id, date_match: r.date_match,
          phase: r.phase, adversaire: r.adversaire, lieu: r.lieu,
          equipe_accueil: r.equipe_accueil, score_pour: r.score_pour,
          score_contre: r.score_contre, notes: r.notes, lignes: []
        });
      }
      var g = map.get(k);
      if (g.score_pour == null && r.score_pour != null) g.score_pour = r.score_pour;
      if (g.score_contre == null && r.score_contre != null) g.score_contre = r.score_contre;
      g.lignes.push(r);
    });
    var groupes = Array.from(map.values());
    groupes.forEach(function (g) {
      g.lignes.sort(function (a, b) {
        var na = a.numero == null ? 99 : a.numero, nb = b.numero == null ? 99 : b.numero;
        return na !== nb ? na - nb : cleTri(a).localeCompare(cleTri(b));
      });
    });
    // Même jour : ordre du tournoi (poule avant finale), puis alphabétique.
    function rang(ph) {
      var n = norm(ph), i = PHASES.map(norm).indexOf(n);
      if (i !== -1) return i;
      return /poule/.test(n) ? 2 : /finale/.test(n) ? 6 : 50;
    }
    groupes.sort(function (a, b) {
      var d = String(a.date_match).localeCompare(String(b.date_match));
      if (d !== 0) return d;
      var r = rang(a.phase) - rang(b.phase);
      return r !== 0 ? r : String(a.phase || '').localeCompare(String(b.phase || ''));
    });
    return groupes;
  }
  function groupesDe(convId) {
    return grouperSel(S.matchs.filter(function (m) { return m.convocation_id === convId; }));
  }
  function resultat(g) {
    if (g.score_pour == null || g.score_contre == null) return '';
    if (g.score_pour > g.score_contre) return 'V';
    if (g.score_pour < g.score_contre) return 'D';
    return 'N';
  }

  function definir(ctx) {
    S.categorieId = ctx.categorieId;
    S.saison = ctx.saison || null;
    S.matchs = Array.isArray(ctx.matchs) ? ctx.matchs : [];
    S.recharger = ctx.recharger || null;
    S.charge = false;
    S.erreur = false;
    if (S.candidatsCat !== S.categorieId) { S.candidats = null; S.candidatsCat = null; }
    var h = hub();
    if (!h || typeof h.listParcoursConvocations !== 'function') {
      S.erreur = true; S.charge = true; peindre(); return Promise.resolve();
    }
    peindre();
    return Promise.all([
      h.listParcoursConvocations(S.categorieId),
      h.listParcoursConvocationJoueurs(S.categorieId)
    ]).then(function (r) {
      if (r[0] === null || r[1] === null) { S.erreur = true; }
      else { S.convocs = r[0]; S.joueurs = r[1]; }
      S.charge = true;
      peindre();
    }).catch(function (e) {
      console.error('parcours-selections definir', e);
      S.erreur = true; S.charge = true; peindre();
    });
  }

  // ------------------------------------------------------------------
  // Rendu du bloc « En sélection »
  // ------------------------------------------------------------------
  function puce(texte, classe) {
    return '<span class="ps-puce ' + classe + '">' + esc(texte) + '</span>';
  }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

  function ligneMatch(g, conv) {
    var res = resultat(g);
    var exterieur = g.lieu === 'exterieur';
    var nous = esc(g.equipe_accueil || conv.equipe || 'Sélection');
    var eux = esc(g.adversaire || '—');
    var score = (g.score_pour != null && g.score_contre != null)
      ? '<span class="pp-score pp-score-' + res + '">' +
        (exterieur ? g.score_contre + ' – ' + g.score_pour : g.score_pour + ' – ' + g.score_contre) +
        (res ? ' · ' + res : '') + '</span>'
      : '<span class="pp-score">score non saisi</span>';
    var titu = g.lignes.filter(function (l) { return l.statut_joueur === 'titulaire'; }).length;
    var ess = g.lignes.reduce(function (s, l) { return s + (l.essais || 0); }, 0);
    return '<li class="ps-match">' +
      '<span class="ps-match-phase">' + esc(g.phase || fmtDate(g.date_match)) + '</span>' +
      '<span class="ps-match-titre">' + (exterieur ? eux : nous) + ' <span class="pp-vs">vs</span> ' +
        (exterieur ? nous : eux) + ' ' + score + '</span>' +
      '<span class="ps-match-resume">' + pluriel(g.lignes.length, 'joueur', 'joueurs') +
        ' · ' + pluriel(titu, 'titulaire', 'titulaires') + (ess ? ' · ' + pluriel(ess, 'essai', 'essais') : '') +
      '</span></li>';
  }

  function carteConvocation(c) {
    var aVenir = String(c.date_debut) > aujourdhui();
    var dates = fmtDate(c.date_debut) + (c.date_fin && c.date_fin !== c.date_debut ? ' → ' + fmtDate(c.date_fin) : '');
    var meta = [dates, c.lieu, c.organisateur ? 'organisé par ' + c.organisateur : null].filter(Boolean).join(' · ');
    var seulsConvoques = (c.nb_convoques || 0) - (c.nb_retenus || 0) - (c.nb_reservistes || 0);
    var puces = '';
    if (c.nb_retenus) puces += puce(pluriel(c.nb_retenus, 'retenu', 'retenus'), 'ps-p-retenu');
    if (c.nb_reservistes) puces += puce(pluriel(c.nb_reservistes, 'réserviste', 'réservistes'), 'ps-p-reserviste');
    if (seulsConvoques > 0) puces += puce(pluriel(seulsConvoques, 'convoqué', 'convoqués'), 'ps-p-convoque');
    if (c.nb_non_retenus) puces += puce(pluriel(c.nb_non_retenus, 'non retenu', 'non retenus'), 'ps-p-gris');
    if (c.nb_absents) puces += puce(pluriel(c.nb_absents, 'absent / blessé', 'absents / blessés'), 'ps-p-gris');
    if (!puces) puces = '<span class="pp-note">Aucun joueur pour l\'instant.</span>';
    var groupes = groupesDe(c.id);
    var matchs = groupes.length
      ? '<ul class="ps-matchs">' + groupes.map(function (g) { return ligneMatch(g, c); }).join('') + '</ul>'
      : '<p class="pp-note">Aucun match saisi.</p>';
    return '<article class="ps-carte">' +
      '<div class="ps-carte-head"><div>' +
        '<div><span class="pp-badge">' + esc(TYPES[c.type] || c.type) + '</span>' +
          (aVenir ? ' <span class="ps-avenir">à venir</span>' : '') + '</div>' +
        '<div class="ps-carte-titre">' + esc(c.intitule) + (c.equipe ? ' · ' + esc(c.equipe) : '') + '</div>' +
        '<div class="pp-match-date">' + esc(meta) + '</div>' +
      '</div><button type="button" class="pp-btn" data-ps-ouvrir="' + esc(c.id) + '">Ouvrir</button></div>' +
      '<div class="ps-puces">' + puces + '</div>' + matchs +
      '</article>';
  }

  function tableauJoueurs() {
    var parJ = new Map();
    function fiche(r) {
      if (!parJ.has(r.personne_id)) {
        parJ.set(r.personne_id, { nom: r.nom, prenom: r.prenom, club: r.club || '', conv: 0, retenu: 0, matchs: 0, titu: 0, essais: 0, points: 0 });
      }
      return parJ.get(r.personne_id);
    }
    S.joueurs.forEach(function (j) {
      var f = fiche(j);
      if (j.club) f.club = j.club;
      f.conv += 1;
      if (j.statut === 'retenu') f.retenu += 1;
    });
    S.matchs.forEach(function (m) {
      var f = fiche(m);
      f.matchs += 1;
      if (m.statut_joueur === 'titulaire') f.titu += 1;
      f.essais += m.essais || 0;
      f.points += pointsDe(m);
    });
    if (parJ.size === 0) return '';
    var lignes = Array.from(parJ.values()).sort(function (a, b) { return cleTri(a).localeCompare(cleTri(b)); });
    return '<h3 class="pp-h3">Joueurs en sélection</h3><div class="pp-scroll"><table class="pp-table"><thead><tr>' +
      '<th>Joueur</th><th>Club</th><th class="pp-num">Convocations</th><th class="pp-num">Retenu</th>' +
      '<th class="pp-num">Matchs</th><th class="pp-num">Titu.</th><th class="pp-num">Essais</th><th class="pp-num">Points</th>' +
      '</tr></thead><tbody>' +
      lignes.map(function (f) {
        return '<tr><td><strong>' + esc(nomJoueur(f)) + '</strong></td><td class="pp-club">' + esc(f.club) + '</td>' +
          '<td class="pp-num">' + f.conv + '</td><td class="pp-num">' + f.retenu + '</td>' +
          '<td class="pp-num">' + f.matchs + '</td><td class="pp-num">' + f.titu + '</td>' +
          '<td class="pp-num">' + f.essais + '</td><td class="pp-num">' + f.points + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function peindre() {
    var el = document.getElementById('ps-zone');
    if (!el) return;
    var h = '<section class="pp-bloc ps-bloc"><div class="pp-bloc-head"><h2>En sélection</h2>' +
      '<div class="pp-actions"><button type="button" class="pp-btn pp-btn-primaire" data-ps-action="nouvelle"' +
      (S.charge && !S.erreur ? '' : ' disabled') + '>+ Nouvelle convocation</button></div></div>';
    if (!S.charge) { el.innerHTML = h + '<p class="pp-load">Chargement…</p></section>'; return; }
    if (S.erreur) { el.innerHTML = h + '<p class="pp-attente">Lecture des convocations impossible.</p></section>'; return; }

    var groupesTous = grouperSel(S.matchs);
    var convoques = new Set();
    S.joueurs.forEach(function (j) { if (JOUANTS.indexOf(j.statut) !== -1) convoques.add(j.personne_id); });
    var titu = 0, essais = 0, points = 0;
    S.matchs.forEach(function (m) {
      if (m.statut_joueur === 'titulaire') titu += 1;
      essais += m.essais || 0;
      points += pointsDe(m);
    });
    function kpi(v, l) {
      return '<div class="pp-kpi"><span class="pp-kpi__v">' + v + '</span><span class="pp-kpi__l">' + l + '</span></div>';
    }
    h += '<div class="pp-kpis">' + kpi(S.convocs.length, 'Convocations') + kpi(convoques.size, 'Joueurs convoqués') +
      kpi(groupesTous.length, 'Matchs') + kpi(titu, 'Titularisations') + kpi(essais, 'Essais') + kpi(points, 'Points') + '</div>';
    if (S.convocs.length === 0) {
      h += '<p class="pp-attente">Aucune convocation saisie cette saison. ' +
        'Pour en ajouter une : « + Nouvelle convocation » (référents de la catégorie).</p>';
    } else {
      h += S.convocs.map(carteConvocation).join('');
    }
    h += tableauJoueurs();
    h += '<p class="pp-note">Les matchs en sélection ne sont jamais comptés dans les statistiques du collectif.</p></section>';
    el.innerHTML = h;

    var bN = el.querySelector('[data-ps-action="nouvelle"]');
    if (bN) bN.addEventListener('click', function () { ouvrirConvocation(null); });
    el.querySelectorAll('[data-ps-ouvrir]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = S.convocs.find(function (x) { return x.id === b.getAttribute('data-ps-ouvrir'); });
        if (c) ouvrirConvocation(c);
      });
    });
  }

  // ------------------------------------------------------------------
  // Modale convocation (D14-D15)
  // ------------------------------------------------------------------
  function chargerCandidats() {
    if (S.candidats && S.candidatsCat === S.categorieId) return Promise.resolve(S.candidats);
    return Promise.resolve(hub().listParcoursCandidats(S.categorieId)).then(function (rows) {
      S.candidats = Array.isArray(rows) ? rows : [];
      S.candidatsCat = S.categorieId;
      return S.candidats;
    });
  }

  function ouvrirConvocation(c) {
    var ov = document.getElementById('ps-overlay');
    var f = document.getElementById('ps-form');
    if (!ov || !f) return;
    S.edition = c ? Object.assign({}, c) : { id: null };
    document.getElementById('ps-modal-titre').textContent = c ? 'Convocation' : 'Nouvelle convocation';
    f.innerHTML = '<p class="pp-load">Chargement des joueurs…</p>';
    document.getElementById('ps-supprimer').hidden = !c;
    ov.hidden = false;
    chargerCandidats().then(function (cands) { remplirConvocation(c, cands); })
      .catch(function (e) {
        console.error('parcours-selections candidats', e);
        f.innerHTML = '<p class="pp-erreur">Liste des joueurs indisponible.</p>';
      });
  }

  function remplirConvocation(c, cands) {
    var f = document.getElementById('ps-form');
    var existants = {};
    if (c) S.joueurs.forEach(function (j) { if (j.convocation_id === c.id) existants[j.personne_id] = j; });
    var liste = cands.map(function (x) { return { personne_id: x.personne_id, nom: x.nom, prenom: x.prenom, club: x.club }; });
    Object.keys(existants).forEach(function (pid) {
      if (!liste.some(function (x) { return x.personne_id === pid; })) {
        var j = existants[pid];
        liste.push({ personne_id: pid, nom: j.nom, prenom: j.prenom, club: j.club });
      }
    });
    liste.sort(function (a, b) { return cleTri(a).localeCompare(cleTri(b)); });

    var optsType = Object.keys(TYPES).map(function (k) {
      return '<option value="' + k + '"' + (c && c.type === k ? ' selected' : '') + '>' + esc(TYPES[k]) + '</option>';
    }).join('');
    var h = '<div class="pp-grid2">' +
      '<label>Type *<select name="type">' + optsType + '</select></label>' +
      '<label>Intitulé *<input type="text" name="intitule" maxlength="120" required value="' + esc(c ? c.intitule : '') + '" placeholder="ex. SCF phase 3"></label>' +
      '<label>Du *<input type="date" name="date_debut" required value="' + esc(c ? String(c.date_debut).slice(0, 10) : '') + '"></label>' +
      '<label>Au (facultatif)<input type="date" name="date_fin" value="' + esc(c && c.date_fin ? String(c.date_fin).slice(0, 10) : '') + '"></label>' +
      '<label>Équipe<input type="text" name="equipe" maxlength="80" list="ps-dl-equipe" value="' + esc(c ? c.equipe || '' : EQUIPE_DEFAUT) + '"></label>' +
      '<label>Organisateur<input type="text" name="organisateur" maxlength="80" value="' + esc(c ? c.organisateur || '' : ORGANISATEUR_DEFAUT) + '"></label>' +
      '<label>Lieu<input type="text" name="lieu" maxlength="120" value="' + esc(c ? c.lieu || '' : '') + '"></label>' +
      '<label>Note (staff)<input type="text" name="notes" maxlength="500" value="' + esc(c ? c.notes || '' : '') + '" placeholder="RDV, consignes…"></label>' +
      '</div><datalist id="ps-dl-equipe"><option value="' + esc(EQUIPE_DEFAUT) + '"></option></datalist>' +
      '<div class="ps-joueurs-head"><h3 class="pp-h3">Joueurs de la convocation</h3><span class="pp-note" id="ps-compte"></span></div>' +
      '<div class="ps-filtres"><label class="ps-filtre">Rechercher<input type="search" id="ps-recherche" placeholder="Nom ou prénom"></label>' +
      '<label class="ps-coche"><input type="checkbox" id="ps-seulement"> Seulement les cochés</label></div>' +
      '<div class="pp-scroll ps-liste"><table class="pp-table pp-grille"><thead><tr>' +
      '<th>Convoqué</th><th>Joueur</th><th>Club</th><th>Statut</th><th>Note</th></tr></thead><tbody>' +
      liste.map(function (j) {
        var e = existants[j.personne_id];
        var st = e ? e.statut : 'convoque';
        return '<tr data-pid="' + esc(j.personne_id) + '" data-nom="' + esc(norm(nomJoueur(j))) + '">' +
          '<td><input type="checkbox" data-champ="present"' + (e ? ' checked' : '') + ' aria-label="Convoquer ' + esc(nomJoueur(j)) + '"></td>' +
          '<td>' + esc(nomJoueur(j)) + '</td><td class="pp-club">' + esc(j.club || '') + '</td>' +
          '<td><select data-champ="statut" aria-label="Statut">' + Object.keys(STATUTS).map(function (k) {
            return '<option value="' + k + '"' + (st === k ? ' selected' : '') + '>' + STATUTS[k] + '</option>';
          }).join('') + '</select></td>' +
          '<td><input type="text" data-champ="note" maxlength="200" aria-label="Note" value="' + esc(e && e.note ? e.note : '') + '"></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="pp-note">Liste = joueurs du collectif de l\'entente. « Absent / blessé » et « non retenu » ne sont jamais montrés au joueur.</p>';

    if (c) {
      var groupes = groupesDe(c.id);
      h += '<div class="ps-joueurs-head"><h3 class="pp-h3">Matchs de la convocation</h3>' +
        '<button type="button" class="pp-btn pp-btn-primaire" data-ps-action="ajouter-match">+ Ajouter un match</button></div>';
      h += groupes.length
        ? '<ul class="ps-matchs ps-matchs-edit">' + groupes.map(function (g) {
            return '<li class="ps-match-edit">' + ligneMatch(g, c).replace(/^<li class="ps-match">|<\/li>$/g, '') +
              '<button type="button" class="pp-btn" data-ps-modifier="' + esc(g.cle) + '">Modifier</button></li>';
          }).join('') + '</ul>'
        : '<p class="pp-note">Aucun match saisi. Les joueurs proposés pour un match sont ceux enregistrés comme convoqués, retenus ou réservistes.</p>';
    } else {
      h += '<p class="pp-note">Enregistre d\'abord la convocation pour pouvoir saisir ses matchs.</p>';
    }
    h += '<p class="pp-erreur" id="ps-erreur" role="alert"></p>';
    f.innerHTML = h;

    function majCompte() {
      var n = f.querySelectorAll('tr[data-pid] [data-champ="present"]:checked').length;
      var el = document.getElementById('ps-compte');
      if (el) el.textContent = n + ' coché' + (n > 1 ? 's' : '') + ' sur ' + liste.length;
    }
    function filtrer() {
      var q = norm(document.getElementById('ps-recherche').value);
      var seul = document.getElementById('ps-seulement').checked;
      f.querySelectorAll('tr[data-pid]').forEach(function (tr) {
        var ok = (!q || tr.getAttribute('data-nom').indexOf(q) !== -1) &&
                 (!seul || tr.querySelector('[data-champ="present"]').checked);
        tr.hidden = !ok;
      });
    }
    f.querySelectorAll('tr[data-pid] select, tr[data-pid] input[data-champ="note"]').forEach(function (el) {
      el.addEventListener('input', function () {
        var cb = el.closest('tr').querySelector('[data-champ="present"]');
        if (cb && !cb.checked) { cb.checked = true; majCompte(); }
      });
    });
    f.querySelectorAll('[data-champ="present"]').forEach(function (cb) { cb.addEventListener('change', majCompte); });
    document.getElementById('ps-recherche').addEventListener('input', filtrer);
    document.getElementById('ps-seulement').addEventListener('change', filtrer);
    var bA = f.querySelector('[data-ps-action="ajouter-match"]');
    if (bA) bA.addEventListener('click', function () { fermerConvocation(); ouvrirMatch(c, null); });
    f.querySelectorAll('[data-ps-modifier]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = groupesDe(c.id).find(function (x) { return x.cle === b.getAttribute('data-ps-modifier'); });
        if (g) { fermerConvocation(); ouvrirMatch(c, g); }
      });
    });
    majCompte();
    var premier = f.querySelector('[name="intitule"]');
    if (premier) premier.focus();
  }

  function fermerConvocation() {
    document.getElementById('ps-overlay').hidden = true;
    S.edition = null;
  }

  function erreurConv(msg) {
    var el = document.getElementById('ps-erreur');
    if (el) el.textContent = msg || '';
  }

  function enregistrerConvocation() {
    var f = document.getElementById('ps-form');
    if (!S.edition || !f.querySelector('[name="type"]')) return;
    var v = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value.trim().replace(/[ \t]+/g, ' ') : ''; };
    var conv = {
      id: S.edition.id || null,
      categorie_id: S.categorieId,
      type: v('type'),
      intitule: v('intitule'),
      date_debut: v('date_debut'),
      date_fin: v('date_fin') || null,
      equipe: v('equipe'),
      organisateur: v('organisateur'),
      lieu: v('lieu'),
      notes: v('notes')
    };
    if (!conv.intitule) return erreurConv('L\'intitulé est obligatoire.');
    if (!conv.date_debut) return erreurConv('La date de début est obligatoire.');
    if (conv.date_fin && conv.date_fin < conv.date_debut) return erreurConv('La date de fin précède la date de début.');
    var joueurs = [];
    f.querySelectorAll('tr[data-pid]').forEach(function (tr) {
      if (!tr.querySelector('[data-champ="present"]').checked) return;
      joueurs.push({
        personne_id: tr.getAttribute('data-pid'),
        statut: tr.querySelector('[data-champ="statut"]').value,
        note: tr.querySelector('[data-champ="note"]').value.trim() || null
      });
    });
    var bouton = document.getElementById('ps-enregistrer');
    bouton.disabled = true;
    erreurConv('');
    hub().saveParcoursConvocation(conv).then(function (r) {
      if (!r.ok || !r.data) throw new Error(messageErreur(r.error));
      S.edition.id = r.data.id; // un 2e essai met à jour au lieu de recréer
      return hub().setParcoursConvocationJoueurs(r.data.id, joueurs).then(function (r2) {
        if (!r2.ok) throw new Error('Convocation enregistrée, mais pas la liste des joueurs : ' + messageErreur(r2.error));
      });
    }).then(function () {
      fermerConvocation();
      if (S.recharger) S.recharger();
    }).catch(function (e) {
      erreurConv(e.message || String(e));
    }).then(function () { bouton.disabled = false; });
  }

  function supprimerConvocation() {
    if (!S.edition || !S.edition.id) return;
    if (!window.confirm('Supprimer cette convocation et sa liste de joueurs ?')) return;
    hub().deleteParcoursConvocation(S.edition.id).then(function (r) {
      if (!r.ok) {
        var m = String(r.error || '');
        erreurConv(/match/i.test(m) ? 'Cette convocation a des matchs : supprime-les d\'abord.' : messageErreur(m));
        return;
      }
      fermerConvocation();
      if (S.recharger) S.recharger();
    });
  }

  // ------------------------------------------------------------------
  // Modale match de sélection (D16-D17)
  // ------------------------------------------------------------------
  function ouvrirMatch(conv, g) {
    var ov = document.getElementById('psm-overlay');
    var f = document.getElementById('psm-form');
    if (!ov || !f) return;
    S.editionMatch = { conv: conv, groupe: g };
    var parId = {};
    if (g) g.lignes.forEach(function (l) { parId[l.personne_id] = l; });
    var joueurs = S.joueurs.filter(function (j) {
      return j.convocation_id === conv.id && JOUANTS.indexOf(j.statut) !== -1;
    }).map(function (j) { return { personne_id: j.personne_id, nom: j.nom, prenom: j.prenom, statut: j.statut }; });
    if (g) g.lignes.forEach(function (l) {
      if (!joueurs.some(function (x) { return x.personne_id === l.personne_id; })) {
        joueurs.push({ personne_id: l.personne_id, nom: l.nom, prenom: l.prenom, statut: null });
      }
    });
    joueurs.sort(function (a, b) { return cleTri(a).localeCompare(cleTri(b)); });
    var fin = String(conv.date_fin || conv.date_debut).slice(0, 10);
    var debut = String(conv.date_debut).slice(0, 10);

    document.getElementById('psm-modal-titre').textContent = g ? 'Modifier le match de sélection' : 'Match de sélection';
    var h = '<div class="pp-bandeau">Rattaché à : <strong>' + esc(conv.intitule) + (conv.equipe ? ' · ' + esc(conv.equipe) : '') +
      ' · ' + fmtDate(debut) + (fin !== debut ? ' → ' + fmtDate(fin) : '') + '</strong> · saisie à la main</div>' +
      '<div class="pp-grid2">' +
      '<label>Date *<input type="date" name="date_match" required min="' + esc(debut) + '" max="' + esc(fin) + '" value="' + esc(g ? String(g.date_match).slice(0, 10) : debut) + '"></label>' +
      '<label>Phase<input type="text" name="phase" maxlength="80" list="psm-dl-phase" value="' + esc(g ? g.phase || '' : '') + '" placeholder="ex. Poule, Finale"></label>' +
      '<label>Adversaire *<input type="text" name="adversaire" maxlength="80" required value="' + esc(g ? g.adversaire || '' : '') + '"></label>' +
      '<label>Lieu<select name="lieu">' + Object.keys(LIEUX).map(function (k) {
        return '<option value="' + k + '"' + ((g ? g.lieu || 'neutre' : 'neutre') === k ? ' selected' : '') + '>' + LIEUX[k] + '</option>';
      }).join('') + '</select></label>' +
      '<div class="pp-score-saisie"><label>Score de notre équipe<input type="number" name="score_pour" min="0" max="250" value="' + esc(g && g.score_pour != null ? g.score_pour : '') + '"></label>' +
      '<label>Score adverse<input type="number" name="score_contre" min="0" max="250" value="' + esc(g && g.score_contre != null ? g.score_contre : '') + '"></label></div>' +
      '</div><datalist id="psm-dl-phase">' + PHASES.map(function (p) { return '<option value="' + esc(p) + '"></option>'; }).join('') + '</datalist>' +
      '<p class="pp-note">La phase distingue deux matchs contre la même équipe le même jour (poule puis finale).</p>' +
      '<h3 class="pp-h3">Joueurs de la convocation</h3>';
    if (joueurs.length === 0) {
      h += '<p class="pp-attente">Aucun joueur convoqué, retenu ou réserviste sur cette convocation : complète d\'abord sa liste.</p>';
    } else {
      h += '<div class="pp-scroll"><table class="pp-table pp-grille"><thead><tr>' +
        '<th>Joué</th><th>Joueur</th><th>Rôle</th><th class="pp-num">N°</th><th>C</th>' +
        '<th class="pp-num" title="Essais">E</th><th class="pp-num" title="Transformations">T</th>' +
        '<th class="pp-num" title="Pénalités">P</th><th class="pp-num" title="Drops">D</th></tr></thead><tbody>' +
        joueurs.map(function (j) {
          var l = parId[j.personne_id];
          function num(champ) {
            return '<td class="pp-num"><input type="number" min="0" max="20" data-champ="' + champ + '" value="' + esc(l ? (l[champ] || 0) : '') + '"></td>';
          }
          return '<tr data-pid="' + esc(j.personne_id) + '"' + (l ? ' data-id="' + esc(l.id) + '"' : '') + '>' +
            '<td><input type="checkbox" data-champ="present"' + (l ? ' checked' : '') + ' aria-label="A joué"></td>' +
            '<td>' + esc(nomJoueur(j)) + (j.statut ? ' <span class="ps-st ps-st-' + j.statut + '">' + esc(STATUTS[j.statut]) + '</span>' : '') + '</td>' +
            '<td><select data-champ="statut_joueur" aria-label="Rôle">' + Object.keys(STATUT_JOUEUR).map(function (k) {
              return '<option value="' + k + '"' + ((l ? l.statut_joueur : 'titulaire') === k ? ' selected' : '') + '>' + STATUT_JOUEUR[k] + '</option>';
            }).join('') + '</select></td>' +
            '<td class="pp-num"><input type="number" min="1" max="99" data-champ="numero" aria-label="Numéro" value="' + esc(l && l.numero != null ? l.numero : '') + '"></td>' +
            '<td><input type="checkbox" data-champ="capitaine"' + (l && l.capitaine ? ' checked' : '') + ' aria-label="Capitaine"></td>' +
            num('essais') + num('transformations') + num('penalites') + num('drops') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += '<label class="pp-notes">Notes<textarea name="notes" rows="2" maxlength="500">' + esc(g && g.notes ? g.notes : '') + '</textarea></label>' +
      '<p class="pp-erreur" id="psm-erreur" role="alert"></p>';
    f.innerHTML = h;
    f.querySelectorAll('tr[data-pid] input:not([data-champ="present"]), tr[data-pid] select').forEach(function (el) {
      el.addEventListener('input', function () {
        var cb = el.closest('tr').querySelector('[data-champ="present"]');
        if (cb && !cb.checked) cb.checked = true;
      });
    });
    document.getElementById('psm-supprimer').hidden = !g;
    ov.hidden = false;
    var premier = f.querySelector('[name="phase"]');
    if (premier) premier.focus();
  }

  function fermerMatch() {
    document.getElementById('psm-overlay').hidden = true;
    S.editionMatch = null;
  }
  function erreurMatch(msg) {
    var el = document.getElementById('psm-erreur');
    if (el) el.textContent = msg || '';
  }

  function lireMatch() {
    var f = document.getElementById('psm-form');
    var v = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value.trim().replace(/[ \t]+/g, ' ') : ''; };
    var match = {
      date_match: v('date_match'), phase: v('phase'), adversaire: v('adversaire'), lieu: v('lieu') || null,
      score_pour: entier(v('score_pour')), score_contre: entier(v('score_contre')), notes: v('notes')
    };
    var lignes = [];
    f.querySelectorAll('tr[data-pid]').forEach(function (tr) {
      var c = function (n) { return tr.querySelector('[data-champ="' + n + '"]'); };
      lignes.push({
        personne_id: tr.getAttribute('data-pid'), id: tr.getAttribute('data-id') || null,
        nom: tr.children[1].firstChild ? tr.children[1].firstChild.textContent : '',
        present: c('present').checked, statut_joueur: c('statut_joueur').value,
        numero: entier(c('numero').value), capitaine: c('capitaine').checked,
        essais: entier(c('essais').value) || 0, transformations: entier(c('transformations').value) || 0,
        penalites: entier(c('penalites').value) || 0, drops: entier(c('drops').value) || 0
      });
    });
    return { match: match, lignes: lignes };
  }

  function validerMatch(saisie) {
    var conv = S.editionMatch.conv, m = saisie.match;
    var debut = String(conv.date_debut).slice(0, 10), fin = String(conv.date_fin || conv.date_debut).slice(0, 10);
    if (!m.date_match) return 'La date du match est obligatoire.';
    if (m.date_match < debut || m.date_match > fin) return 'La date doit être comprise dans les dates de la convocation.';
    if (!m.adversaire) return 'L\'adversaire est obligatoire.';
    if ((m.score_pour == null) !== (m.score_contre == null)) return 'Saisis les deux scores, ou aucun.';
    var presents = saisie.lignes.filter(function (l) { return l.present; });
    if (presents.length === 0) return 'Coche au moins un joueur (ou utilise « Supprimer le match »).';
    if (presents.filter(function (l) { return l.capitaine; }).length > 1) return 'Un seul capitaine par match.';
    var numeros = {};
    for (var i = 0; i < presents.length; i++) {
      var n = presents[i].numero;
      if (n == null) continue;
      if (n < 1 || n > 99) return 'N° de maillot invalide pour ' + presents[i].nom + ' (1 à 99).';
      if (numeros[n]) return 'Le n° ' + n + ' est attribué à deux joueurs.';
      numeros[n] = true;
    }
    if (m.score_pour != null) {
      var total = presents.reduce(function (s, l) { return s + pointsDe(l); }, 0);
      if (total > m.score_pour) return 'Les points saisis pour nos joueurs (' + total + ') dépassent le score de l\'équipe (' + m.score_pour + ').';
    }
    var nouvelle = conv.id + '#' + cleSel(m.date_match, m.adversaire, m.phase);
    var ancienne = S.editionMatch.groupe ? S.editionMatch.groupe.cle : null;
    if (nouvelle !== ancienne && groupesDe(conv.id).some(function (g) { return g.cle === nouvelle; })) {
      return 'Ce match (même date, même adversaire, même phase) existe déjà. Modifie-le plutôt, ou précise la phase.';
    }
    return null;
  }

  function enregistrerMatch() {
    if (!S.editionMatch) return;
    var conv = S.editionMatch.conv;
    var saisie = lireMatch();
    var err = validerMatch(saisie);
    if (err) return erreurMatch(err);
    var retraits = saisie.lignes.filter(function (l) { return !l.present && l.id; });
    if (retraits.length && !window.confirm('Retirer de ce match : ' + retraits.map(function (l) { return l.nom; }).join(', ') + ' ?')) return;
    var m = saisie.match;
    var ops = saisie.lignes.filter(function (l) { return l.present; }).map(function (l) {
      return function () {
        return hub().saveParcoursMatch({
          id: l.id, personne_id: l.personne_id, date_match: m.date_match,
          competition: conv.intitule, phase: m.phase,
          equipe_accueil: conv.equipe || 'Sélection', adversaire: m.adversaire,
          score_pour: m.score_pour, score_contre: m.score_contre,
          statut_joueur: l.statut_joueur, numero: l.numero, capitaine: l.capitaine,
          essais: l.essais, transformations: l.transformations, penalites: l.penalites, drops: l.drops,
          source: 'manuel', notes: m.notes, lieu: m.lieu, convocation_id: conv.id
        }).then(function (r) { return { nom: l.nom, r: r }; });
      };
    }).concat(retraits.map(function (l) {
      return function () { return hub().deleteParcoursMatch(l.id).then(function (r) { return { nom: l.nom, r: r }; }); };
    }));
    var echecs = [];
    var bouton = document.getElementById('psm-enregistrer');
    bouton.disabled = true;
    erreurMatch('');
    ops.reduce(function (p, op) {
      return p.then(op).then(function (x) { if (!x.r.ok) echecs.push(x.nom + ' : ' + messageErreur(x.r.error)); });
    }, Promise.resolve()).then(function () {
      bouton.disabled = false;
      if (echecs.length) { erreurMatch('Enregistrement partiel. ' + echecs.join(' · ')); if (S.recharger) S.recharger(); return; }
      fermerMatch();
      if (S.recharger) S.recharger();
    });
  }

  function supprimerMatch() {
    if (!S.editionMatch || !S.editionMatch.groupe) return;
    var g = S.editionMatch.groupe;
    if (!window.confirm('Supprimer ce match pour ses ' + g.lignes.length + ' joueur(s) ?')) return;
    var echecs = [];
    g.lignes.reduce(function (p, l) {
      return p.then(function () { return hub().deleteParcoursMatch(l.id); }).then(function (r) {
        if (!r.ok) echecs.push(nomJoueur(l) + ' : ' + messageErreur(r.error));
      });
    }, Promise.resolve()).then(function () {
      if (echecs.length) { erreurMatch(echecs.join(' · ')); return; }
      fermerMatch();
      if (S.recharger) S.recharger();
    });
  }

  // ------------------------------------------------------------------
  // Câblage des modales (une seule fois)
  // ------------------------------------------------------------------
  function cabler() {
    if (cable) return;
    var ov = document.getElementById('ps-overlay');
    var ovm = document.getElementById('psm-overlay');
    if (!ov || !ovm) return;
    cable = true;
    ov.addEventListener('click', function (ev) { if (ev.target === ov) fermerConvocation(); });
    ov.querySelectorAll('[data-action="ps-fermer"]').forEach(function (b) { b.addEventListener('click', fermerConvocation); });
    document.getElementById('ps-enregistrer').addEventListener('click', enregistrerConvocation);
    document.getElementById('ps-supprimer').addEventListener('click', supprimerConvocation);
    ovm.addEventListener('click', function (ev) { if (ev.target === ovm) fermerMatch(); });
    ovm.querySelectorAll('[data-action="psm-fermer"]').forEach(function (b) { b.addEventListener('click', fermerMatch); });
    document.getElementById('psm-enregistrer').addEventListener('click', enregistrerMatch);
    document.getElementById('psm-supprimer').addEventListener('click', supprimerMatch);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!ov.hidden) fermerConvocation();
      if (!ovm.hidden) fermerMatch();
    });
  }

  window.ParcoursSelections = {
    definir: function (ctx) { cabler(); return definir(ctx); },
    peindre: function () { cabler(); peindre(); },
    // Exposés pour les tests (fonctions pures).
    _cleSel: cleSel,
    _grouperSel: grouperSel
  };
})();
