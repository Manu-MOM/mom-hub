/* =====================================================================
 * parcours-performance.js — Page Parcours Performance (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.3 — 3 novembre 2026 — lot L4 (mise en valeur)
 *   v1.3 : paramètre ?joueur=<personne_id> : ouvre directement
 *          l'historique du joueur (lien depuis sa fiche).
 * Version : v1.2 — 3 novembre 2026 — lot L3 (import des feuilles FFR)
 *   v1.2 : bouton « Importer une feuille FFR » : collage des onglets
 *          Résumé + Compositions, lecture et contrôle bloquant du score
 *          par js/parcours-ffr.js, puis vérification dans la grille de
 *          saisie (source = ffr). Un match déjà saisi à la même date est
 *          mis à jour (lignes existantes réutilisées, pas de doublon, D8).
 * Version : v1.1 — 3 novembre 2026 — amendement D7bis (lieu du match)
 *   v1.1 : lieu domicile | exterieur | neutre (sql_262). Affichage façon
 *          FFR : équipe qui reçoit d'abord, score dans le même ordre ;
 *          neutre ou non renseigné : notre équipe d'abord. Le résultat
 *          (V/N/D) reste lu de notre point de vue.
 *   v1.0 : lot L2 (saisie manuelle).
 *
 * OBJET
 *   Page dédiée (parcours-performance.html), ouverte depuis le pilotage
 *   de saison (D9). Trois blocs :
 *     1. chiffres clés de la saison en Parcours Performance ;
 *     2. joueurs engagés (statut de saison posé depuis la fiche, L1),
 *        clic sur une ligne = historique de ce joueur ;
 *     3. matchs saisis, regroupés par match (date + adversaire), avec
 *        saisie / correction / suppression d'un match pour PLUSIEURS
 *        joueurs à la fois (une participation par joueur en base).
 *
 * SOURCE DE VÉRITÉ
 *   RPC sql_261 via SupabaseHub (v1.93) : listParcoursSaison,
 *   listParcoursMatchs, saveParcoursMatch, deleteParcoursMatch.
 *   Les droits sont portés par les RPC (lecture : puis_je_lire_categorie ;
 *   écriture : puis_je_ecrire_categorie) — l'UI ne fait que relayer
 *   le refus de la base.
 *
 * INVARIANTS
 *   - D3 : rien ici n'alimente les stats du collectif (tables dédiées).
 *   - D7 : pas de minutes ni de cartons ; un joueur qui marque est
 *     compté « entré » (forcé aussi côté base).
 *   - Clé de regroupement = miroir de _pp_cle_match (date|adversaire
 *     normalisé), donc identique à l'unicité en base.
 *   - Contrôle bloquant : les points saisis pour nos joueurs ne peuvent
 *     pas dépasser le score de l'équipe d'accueil.
 * ===================================================================== */
(function () {
  'use strict';

  var STATUT_SAISON = { integre: 'Intégré', renfort: 'Renfort', double_licence: 'Double licence' };
  var STATUT_JOUEUR = { titulaire: 'Titulaire', entre: 'Entré', non_entre: 'Non entré' };
  var LIEUX = { domicile: 'Domicile', exterieur: 'Extérieur', neutre: 'Terrain neutre' };
  var COMPETITIONS_DEFAUT = ['Elite Alamercery', 'Gaudermen'];
  var EQUIPES_DEFAUT = ['ABCD XV', 'Oyonnax'];

  var ETAT = {
    categorieId: null,
    categorieLib: '',
    saison: null,          // objet saisons actif (libelle, date_debut, date_fin)
    engages: [],           // lignes list_parcours_saison
    matchs: [],            // lignes list_parcours_matchs
    filtreJoueur: null,    // personne_id ou null
    edition: null          // groupe en cours d'édition (ou {} pour création)
  };

  var mount = null;

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

  function nomJoueur(r) {
    return (r.prenom ? r.prenom + ' ' : '') + String(r.nom || '').toUpperCase();
  }

  function entier(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = parseInt(v, 10);
    return isNaN(x) ? null : x;
  }

  // Miroir exact de public._pp_cle_match : date ISO | adversaire minuscule,
  // espaces de bord retirés, espaces internes réduits à un seul.
  function cleMatch(date, adversaire) {
    var adv = String(adversaire == null ? '' : adversaire).trim().replace(/\s+/g, ' ').toLowerCase();
    return String(date || '').slice(0, 10) + '|' + adv;
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
    if (/droit insuffisant/i.test(m)) return 'Tu n\'as pas les droits d\'écriture sur cette catégorie.';
    if (/aucune saison/i.test(m)) return 'Aucune saison ne couvre cette date.';
    return m || 'Erreur inconnue.';
  }

  // ------------------------------------------------------------------
  // Regroupement des participations par match
  // ------------------------------------------------------------------
  function grouperMatchs(rows) {
    var map = new Map();
    rows.forEach(function (r) {
      var k = cleMatch(r.date_match, r.adversaire);
      if (!map.has(k)) {
        map.set(k, {
          cle: k,
          date_match: r.date_match,
          competition: r.competition,
          phase: r.phase,
          equipe_accueil: r.equipe_accueil,
          adversaire: r.adversaire,
          lieu: r.lieu,
          score_pour: r.score_pour,
          score_contre: r.score_contre,
          lignes: []
        });
      }
      var g = map.get(k);
      // Champs de match : on garde la première valeur non vide rencontrée.
      ['competition', 'phase', 'equipe_accueil', 'adversaire', 'lieu'].forEach(function (c) {
        if (!g[c] && r[c]) g[c] = r[c];
      });
      if (g.score_pour == null && r.score_pour != null) g.score_pour = r.score_pour;
      if (g.score_contre == null && r.score_contre != null) g.score_contre = r.score_contre;
      g.lignes.push(r);
    });
    var groupes = Array.from(map.values());
    groupes.forEach(function (g) {
      g.lignes.sort(function (a, b) {
        var na = a.numero == null ? 99 : a.numero;
        var nb = b.numero == null ? 99 : b.numero;
        if (na !== nb) return na - nb;
        return nomJoueur(a).localeCompare(nomJoueur(b));
      });
    });
    groupes.sort(function (a, b) { return String(b.date_match).localeCompare(String(a.date_match)); });
    return groupes;
  }

  function resultat(g) {
    if (g.score_pour == null || g.score_contre == null) return '';
    if (g.score_pour > g.score_contre) return 'V';
    if (g.score_pour < g.score_contre) return 'D';
    return 'N';
  }

  // ------------------------------------------------------------------
  // Chargement
  // ------------------------------------------------------------------
  function charger() {
    var hub = window.SupabaseHub;
    mount.querySelector('#pp-zone').innerHTML = '<p class="pp-load">Chargement…</p>';
    return Promise.all([
      hub.listParcoursSaison(ETAT.categorieId),
      hub.listParcoursMatchs(ETAT.categorieId)
    ]).then(function (r) {
      if (r[0] === null || r[1] === null) {
        mount.querySelector('#pp-zone').innerHTML =
          '<section class="pp-bloc"><h2>Accès réservé</h2>' +
          '<p>Ces informations sont réservées aux encadrants de la catégorie.</p></section>';
        return;
      }
      ETAT.engages = r[0];
      ETAT.matchs = r[1];
      if (ETAT.filtreJoueur && !ETAT.engages.some(function (e) { return e.personne_id === ETAT.filtreJoueur; })
          && !ETAT.matchs.some(function (m) { return m.personne_id === ETAT.filtreJoueur; })) {
        ETAT.filtreJoueur = null;
      }
      rendre();
    }).catch(function (e) {
      console.error('parcours-performance charger', e);
      mount.querySelector('#pp-zone').innerHTML =
        '<section class="pp-bloc"><h2>Erreur</h2><p>Chargement impossible.</p></section>';
    });
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------
  function statsJoueur(personneId) {
    var s = { feuilles: 0, titulaire: 0, entre: 0, essais: 0, points: 0 };
    ETAT.matchs.forEach(function (m) {
      if (m.personne_id !== personneId) return;
      s.feuilles += 1;
      if (m.statut_joueur === 'titulaire') s.titulaire += 1;
      if (m.statut_joueur === 'entre') s.entre += 1;
      s.essais += m.essais || 0;
      s.points += pointsDe(m);
    });
    return s;
  }

  function rendreKpis(groupes) {
    var titu = 0, essais = 0, points = 0;
    ETAT.matchs.forEach(function (m) {
      if (m.statut_joueur === 'titulaire') titu += 1;
      essais += m.essais || 0;
      points += pointsDe(m);
    });
    function kpi(v, l) {
      return '<div class="pp-kpi"><span class="pp-kpi__v">' + v + '</span>' +
             '<span class="pp-kpi__l">' + l + '</span></div>';
    }
    return '<section class="pp-bloc"><h2>Saison en chiffres</h2><div class="pp-kpis">' +
      kpi(ETAT.engages.length, 'Joueurs engagés') +
      kpi(groupes.length, 'Matchs') +
      kpi(ETAT.matchs.length, 'Feuilles de match') +
      kpi(titu, 'Titularisations') +
      kpi(essais, 'Essais') +
      kpi(points, 'Points') +
      '</div><p class="pp-note">Ces matchs ne sont jamais comptés dans les statistiques du collectif.</p></section>';
  }

  function rendreEngages() {
    var h = '<section class="pp-bloc"><h2>Joueurs engagés</h2>';
    if (ETAT.engages.length === 0) {
      return h + '<p class="pp-attente">Aucun joueur inscrit au Parcours Performance cette saison. ' +
        'Pour en inscrire un : Effectif → fiche du joueur → « Modifier le Parcours Performance ».</p></section>';
    }
    h += '<div class="pp-scroll"><table class="pp-table"><thead><tr>' +
      '<th>Joueur</th><th>Statut</th><th>Structure · équipe</th>' +
      '<th class="pp-num">Feuilles</th><th class="pp-num">Titu.</th>' +
      '<th class="pp-num">Entrées</th><th class="pp-num">Points</th></tr></thead><tbody>';
    ETAT.engages.forEach(function (e) {
      var s = statsJoueur(e.personne_id);
      var actif = ETAT.filtreJoueur === e.personne_id ? ' pp-ligne-active' : '';
      var meta = [e.structure, e.equipe_accueil].filter(Boolean).join(' · ') || '—';
      h += '<tr class="pp-ligne' + actif + '" data-joueur="' + esc(e.personne_id) + '" tabindex="0" ' +
        'title="Voir l\'historique de ' + esc(nomJoueur(e)) + '">' +
        '<td><strong>' + esc(nomJoueur(e)) + '</strong>' +
        (e.club ? ' <span class="pp-club">' + esc(e.club) + '</span>' : '') + '</td>' +
        '<td><span class="pp-badge">' + esc(STATUT_SAISON[e.statut] || e.statut) + '</span></td>' +
        '<td>' + esc(meta) + '</td>' +
        '<td class="pp-num">' + s.feuilles + '</td>' +
        '<td class="pp-num">' + s.titulaire + '</td>' +
        '<td class="pp-num">' + s.entre + '</td>' +
        '<td class="pp-num">' + s.points + '</td></tr>';
    });
    h += '</tbody></table></div><p class="pp-note">Clique sur un joueur pour afficher son historique.</p></section>';
    return h;
  }

  function rendreMatchs(groupes) {
    var filtre = ETAT.filtreJoueur;
    var visibles = filtre
      ? groupes.filter(function (g) { return g.lignes.some(function (l) { return l.personne_id === filtre; }); })
      : groupes;
    var titre = 'Matchs';
    if (filtre) {
      var ref = ETAT.engages.find(function (e) { return e.personne_id === filtre; }) ||
                ETAT.matchs.find(function (m) { return m.personne_id === filtre; });
      titre = 'Historique de ' + (ref ? nomJoueur(ref) : 'ce joueur');
    }
    var h = '<section class="pp-bloc"><div class="pp-bloc-head"><h2>' + esc(titre) + '</h2><div class="pp-actions">';
    if (filtre) h += '<button type="button" class="pp-btn" data-action="tout">Tous les matchs</button>';
    h += '<button type="button" class="pp-btn" data-action="importer"' +
      (ETAT.engages.length === 0 || !window.ParcoursFFR ? ' disabled title="Inscris d\'abord un joueur"' : '') +
      '>Importer une feuille FFR</button>';
    h += '<button type="button" class="pp-btn pp-btn-primaire" data-action="nouveau"' +
      (ETAT.engages.length === 0 ? ' disabled title="Inscris d\'abord un joueur"' : '') +
      '>+ Saisir un match</button></div></div>';

    if (visibles.length === 0) {
      return h + '<p class="pp-attente">Aucun match saisi' + (filtre ? ' pour ce joueur' : '') + ' cette saison.</p></section>';
    }

    visibles.forEach(function (g) {
      var res = resultat(g);
      // D7bis : à l'extérieur, l'équipe qui reçoit (l'adversaire) d'abord,
      // score dans le même ordre ; sinon notre équipe d'abord.
      var exterieur = g.lieu === 'exterieur';
      var nous = esc(g.equipe_accueil || 'Équipe Performance');
      var eux = esc(g.adversaire || '—');
      var aGauche = exterieur ? eux : nous;
      var aDroite = exterieur ? nous : eux;
      var score = (g.score_pour != null && g.score_contre != null)
        ? '<span class="pp-score pp-score-' + res + '" title="' + (res === 'V' ? 'Victoire' : res === 'D' ? 'Défaite' : 'Nul') + '">' +
          (exterieur ? g.score_contre + ' – ' + g.score_pour : g.score_pour + ' – ' + g.score_contre) + '</span>'
        : '<span class="pp-score">score non saisi</span>';
      var ctx = [g.competition, g.phase, LIEUX[g.lieu]].filter(Boolean).join(' · ');
      h += '<article class="pp-match">' +
        '<div class="pp-match-head"><div>' +
          '<div class="pp-match-date">' + fmtDate(g.date_match) + (ctx ? ' · ' + esc(ctx) : '') + '</div>' +
          '<div class="pp-match-titre">' + aGauche +
            ' <span class="pp-vs">vs</span> ' + aDroite + ' ' + score + '</div>' +
        '</div><button type="button" class="pp-btn" data-action="modifier" data-cle="' + esc(g.cle) + '">Modifier</button></div>' +
        '<ul class="pp-match-joueurs">';
      g.lignes.forEach(function (l) {
        var dim = (filtre && l.personne_id !== filtre) ? ' pp-dim' : '';
        var marque = detailMarque(l);
        h += '<li class="' + dim.trim() + '">' +
          '<span class="pp-num-maillot">' + (l.numero != null ? esc(l.numero) : '–') + '</span>' +
          '<span class="pp-j-nom">' + esc(nomJoueur(l)) + (l.capitaine ? ' <span class="pp-cap" title="Capitaine">C</span>' : '') + '</span>' +
          '<span class="pp-j-statut pp-st-' + esc(l.statut_joueur) + '">' + esc(STATUT_JOUEUR[l.statut_joueur] || l.statut_joueur) + '</span>' +
          (marque ? '<span class="pp-j-marque">' + esc(marque) + ' · ' + pointsDe(l) + ' pts</span>' : '') +
          (l.source === 'ffr' ? '<span class="pp-src" title="Importé d\'une feuille FFR">FFR</span>' : '') +
          '</li>';
      });
      h += '</ul></article>';
    });
    return h + '</section>';
  }

  function rendre() {
    var groupes = grouperMatchs(ETAT.matchs);
    var zone = mount.querySelector('#pp-zone');
    zone.innerHTML = rendreKpis(groupes) + rendreEngages() + rendreMatchs(groupes);

    zone.querySelectorAll('tr.pp-ligne').forEach(function (tr) {
      function choisir() {
        var id = tr.getAttribute('data-joueur');
        ETAT.filtreJoueur = (ETAT.filtreJoueur === id) ? null : id;
        rendre();
      }
      tr.addEventListener('click', choisir);
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choisir(); }
      });
    });
    var bTout = zone.querySelector('[data-action="tout"]');
    if (bTout) bTout.addEventListener('click', function () { ETAT.filtreJoueur = null; rendre(); });
    var bNouveau = zone.querySelector('[data-action="nouveau"]');
    if (bNouveau) bNouveau.addEventListener('click', function () { ouvrirModale(null); });
    var bImporter = zone.querySelector('[data-action="importer"]');
    if (bImporter) bImporter.addEventListener('click', ouvrirImport);
    zone.querySelectorAll('[data-action="modifier"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cle = b.getAttribute('data-cle');
        var g = grouperMatchs(ETAT.matchs).find(function (x) { return x.cle === cle; });
        if (g) ouvrirModale(g);
      });
    });
  }

  // ------------------------------------------------------------------
  // Modale de saisie d'un match (plusieurs joueurs)
  // ------------------------------------------------------------------
  function valeursDistinctes(champ, defauts) {
    var set = [];
    (defauts || []).concat(ETAT.matchs.map(function (m) { return m[champ]; }))
      .concat(champ === 'equipe_accueil' ? ETAT.engages.map(function (e) { return e.equipe_accueil; }) : [])
      .forEach(function (v) { if (v && set.indexOf(v) === -1) set.push(v); });
    return set;
  }

  function optionsDatalist(id, valeurs) {
    return '<datalist id="' + id + '">' + valeurs.map(function (v) {
      return '<option value="' + esc(v) + '"></option>';
    }).join('') + '</datalist>';
  }

  // Joueurs proposés dans la grille : engagés + joueurs déjà présents sur ce
  // match mais plus engagés (pour pouvoir les corriger ou les retirer).
  function joueursGrille(g) {
    var liste = ETAT.engages.map(function (e) {
      return { personne_id: e.personne_id, nom: e.nom, prenom: e.prenom, equipe_accueil: e.equipe_accueil };
    });
    if (g) {
      g.lignes.concat(g.retraits || []).forEach(function (l) {
        if (!liste.some(function (x) { return x.personne_id === l.personne_id; })) {
          liste.push({ personne_id: l.personne_id, nom: l.nom, prenom: l.prenom, equipe_accueil: null });
        }
      });
    }
    liste.sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom)); });
    return liste;
  }

  // opts (import FFR) : { source: 'ffr', titre, bandeau (HTML déjà échappé) }.
  // g.retraits : participations existantes absentes de la feuille, affichées
  // décochées (leur suppression est confirmée à l'enregistrement).
  function ouvrirModale(g, opts) {
    opts = opts || {};
    ETAT.edition = g || { lignes: [] };
    ETAT.edition.source = opts.source || 'manuel';
    var ov = document.getElementById('pp-overlay');
    var parId = {}, retraitParId = {};
    ETAT.edition.lignes.forEach(function (l) { parId[l.personne_id] = l; });
    (ETAT.edition.retraits || []).forEach(function (l) { retraitParId[l.personne_id] = l; });
    var joueurs = joueursGrille(g);

    // Équipe d'accueil par défaut en création : commune à tous les engagés.
    var equipeDefaut = '';
    if (!g) {
      var eqs = ETAT.engages.map(function (e) { return e.equipe_accueil || ''; });
      if (eqs.length && eqs.every(function (x) { return x && x === eqs[0]; })) equipeDefaut = eqs[0];
    }

    document.getElementById('pp-modal-titre').textContent =
      opts.titre || (g ? 'Modifier le match' : 'Saisir un match');
    var f = document.getElementById('pp-form');
    f.innerHTML = (opts.bandeau ? '<div class="pp-bandeau">' + opts.bandeau + '</div>' : '') +
      '<div class="pp-grid2">' +
        '<label>Date du match *<input type="date" name="date_match" required value="' + esc(g ? String(g.date_match).slice(0, 10) : '') + '"></label>' +
        '<label>Adversaire *<input type="text" name="adversaire" required maxlength="80" value="' + esc(g ? g.adversaire || '' : '') + '" placeholder="ex. Rouen"></label>' +
        '<label>Lieu<select name="lieu"><option value="">Non renseigné</option>' +
          Object.keys(LIEUX).map(function (k) {
            return '<option value="' + k + '"' + (g && g.lieu === k ? ' selected' : '') + '>' + LIEUX[k] + '</option>';
          }).join('') + '</select></label>' +
        '<label>Équipe d\'accueil<input type="text" name="equipe_accueil" list="pp-dl-equipe" maxlength="80" value="' + esc(g ? g.equipe_accueil || '' : equipeDefaut) + '"></label>' +
        '<label>Compétition<input type="text" name="competition" list="pp-dl-competition" maxlength="80" value="' + esc(g ? g.competition || '' : '') + '"></label>' +
        '<label>Phase<input type="text" name="phase" list="pp-dl-phase" maxlength="80" value="' + esc(g ? g.phase || '' : '') + '"></label>' +
        '<div class="pp-score-saisie"><label>Score de notre équipe<input type="number" name="score_pour" min="0" max="250" value="' + esc(g && g.score_pour != null ? g.score_pour : '') + '"></label>' +
        '<label>Score adverse<input type="number" name="score_contre" min="0" max="250" value="' + esc(g && g.score_contre != null ? g.score_contre : '') + '"></label></div>' +
      '</div>' +
      optionsDatalist('pp-dl-equipe', valeursDistinctes('equipe_accueil', EQUIPES_DEFAUT)) +
      optionsDatalist('pp-dl-competition', valeursDistinctes('competition', COMPETITIONS_DEFAUT)) +
      optionsDatalist('pp-dl-phase', valeursDistinctes('phase', [])) +
      '<h3 class="pp-h3">Nos joueurs sur la feuille</h3>' +
      '<p class="pp-note">Coche les joueurs présents sur la feuille de match. Un joueur qui marque est compté « entré ».</p>' +
      '<div class="pp-scroll"><table class="pp-table pp-grille"><thead><tr>' +
        '<th></th><th>Joueur</th><th>Statut</th><th class="pp-num">N°</th><th>C</th>' +
        '<th class="pp-num" title="Essais">E</th><th class="pp-num" title="Transformations">T</th>' +
        '<th class="pp-num" title="Pénalités">P</th><th class="pp-num" title="Drops">D</th></tr></thead><tbody>' +
      joueurs.map(function (j) {
        var l = parId[j.personne_id];
        var pid = esc(j.personne_id);
        function num(champ, max) {
          var val = l ? (l[champ] || 0) : '';
          return '<td class="pp-num"><input type="number" min="0" max="' + max + '" data-champ="' + champ +
            '" value="' + esc(val) + '"></td>';
        }
        var idLigne = l ? l.id : (retraitParId[j.personne_id] ? retraitParId[j.personne_id].id : null);
        return '<tr data-pid="' + pid + '"' + (idLigne ? ' data-id="' + esc(idLigne) + '"' : '') + '>' +
          '<td><input type="checkbox" data-champ="present"' + (l ? ' checked' : '') + ' aria-label="Présent"></td>' +
          '<td>' + esc(nomJoueur(j)) + '</td>' +
          '<td><select data-champ="statut_joueur">' +
            Object.keys(STATUT_JOUEUR).map(function (k) {
              var sel = (l ? l.statut_joueur : 'titulaire') === k ? ' selected' : '';
              return '<option value="' + k + '"' + sel + '>' + STATUT_JOUEUR[k] + '</option>';
            }).join('') + '</select></td>' +
          '<td class="pp-num"><input type="number" min="1" max="99" data-champ="numero" value="' + esc(l && l.numero != null ? l.numero : '') + '"></td>' +
          '<td><input type="checkbox" data-champ="capitaine"' + (l && l.capitaine ? ' checked' : '') + ' aria-label="Capitaine"></td>' +
          num('essais', 20) + num('transformations', 20) + num('penalites', 20) + num('drops', 20) +
          '</tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<label class="pp-notes">Notes<textarea name="notes" rows="2" maxlength="500">' +
        esc(g && g.lignes[0] && g.lignes[0].notes ? g.lignes[0].notes : '') + '</textarea></label>' +
      '<p class="pp-erreur" id="pp-erreur" role="alert"></p>';

    // Saisir une valeur dans une ligne coche automatiquement « présent ».
    f.querySelectorAll('tr[data-pid] input:not([data-champ="present"]), tr[data-pid] select').forEach(function (el) {
      el.addEventListener('input', function () {
        var cb = el.closest('tr').querySelector('[data-champ="present"]');
        if (cb && !cb.checked) cb.checked = true;
      });
    });

    document.getElementById('pp-supprimer').hidden = !(g && g.cle) || ETAT.edition.source === 'ffr';
    ov.hidden = false;
    var premier = f.querySelector('input[name="date_match"]');
    if (premier) premier.focus();
  }

  function fermerModale() {
    document.getElementById('pp-overlay').hidden = true;
    ETAT.edition = null;
  }

  function lireFormulaire() {
    var f = document.getElementById('pp-form');
    var v = function (n) {
      var el = f.querySelector('[name="' + n + '"]');
      return el ? el.value.trim().replace(/[ \t]+/g, ' ') : '';
    };
    var match = {
      date_match: v('date_match'),
      adversaire: v('adversaire'),
      lieu: v('lieu') || null,
      equipe_accueil: v('equipe_accueil'),
      competition: v('competition'),
      phase: v('phase'),
      score_pour: entier(v('score_pour')),
      score_contre: entier(v('score_contre')),
      notes: v('notes')
    };
    var lignes = [];
    f.querySelectorAll('tr[data-pid]').forEach(function (tr) {
      var g = function (c) { return tr.querySelector('[data-champ="' + c + '"]'); };
      lignes.push({
        personne_id: tr.getAttribute('data-pid'),
        id: tr.getAttribute('data-id') || null,
        nom: tr.children[1].textContent,
        present: g('present').checked,
        statut_joueur: g('statut_joueur').value,
        numero: entier(g('numero').value),
        capitaine: g('capitaine').checked,
        essais: entier(g('essais').value) || 0,
        transformations: entier(g('transformations').value) || 0,
        penalites: entier(g('penalites').value) || 0,
        drops: entier(g('drops').value) || 0
      });
    });
    return { match: match, lignes: lignes };
  }

  function valider(saisie) {
    var m = saisie.match;
    if (!m.date_match) return 'La date du match est obligatoire.';
    if (!m.adversaire) return 'L\'adversaire est obligatoire.';
    if ((m.score_pour == null) !== (m.score_contre == null)) return 'Saisis les deux scores, ou aucun.';
    var presents = saisie.lignes.filter(function (l) { return l.present; });
    if (presents.length === 0) return 'Coche au moins un joueur (ou utilise « Supprimer le match »).';
    var capitaines = presents.filter(function (l) { return l.capitaine; });
    if (capitaines.length > 1) return 'Un seul capitaine par match.';
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
      if (total > m.score_pour) {
        return 'Les points saisis pour nos joueurs (' + total + ') dépassent le score de l\'équipe (' + m.score_pour + ').';
      }
    }
    if (ETAT.saison && ETAT.saison.date_debut) {
      var fin = ETAT.saison.date_fin || '9999-12-31';
      if (m.date_match < ETAT.saison.date_debut || m.date_match > fin) {
        return 'Cette date est hors de la saison ' + (ETAT.saison.libelle || 'active') + '.';
      }
    }
    // Changement de date/adversaire : la nouvelle clé ne doit pas déjà
    // exister pour un autre match (sinon fusion silencieuse en base).
    var nouvelle = cleMatch(m.date_match, m.adversaire);
    var ancienne = ETAT.edition && ETAT.edition.cle;
    if (nouvelle !== ancienne && grouperMatchs(ETAT.matchs).some(function (g) { return g.cle === nouvelle; })) {
      return 'Un match contre cet adversaire existe déjà à cette date. Modifie-le plutôt.';
    }
    return null;
  }

  function enregistrer() {
    var saisie = lireFormulaire();
    var err = valider(saisie);
    var zoneErr = document.getElementById('pp-erreur');
    if (err) { zoneErr.textContent = err; return; }

    var retraits = saisie.lignes.filter(function (l) { return !l.present && l.id; });
    if (retraits.length && !window.confirm('Retirer de ce match : ' +
        retraits.map(function (l) { return l.nom; }).join(', ') + ' ?')) {
      return;
    }

    var hub = window.SupabaseHub;
    var bouton = document.getElementById('pp-enregistrer');
    bouton.disabled = true;
    zoneErr.textContent = '';
    var m = saisie.match;
    var ops = saisie.lignes.filter(function (l) { return l.present; }).map(function (l) {
      return function () {
        return hub.saveParcoursMatch({
          id: l.id,
          personne_id: l.personne_id,
          date_match: m.date_match,
          competition: m.competition,
          phase: m.phase,
          equipe_accueil: m.equipe_accueil,
          adversaire: m.adversaire,
          lieu: m.lieu,
          score_pour: m.score_pour,
          score_contre: m.score_contre,
          statut_joueur: l.statut_joueur,
          numero: l.numero,
          capitaine: l.capitaine,
          essais: l.essais,
          transformations: l.transformations,
          penalites: l.penalites,
          drops: l.drops,
          source: ETAT.edition.source || 'manuel',
          notes: m.notes
        }).then(function (r) { return { nom: l.nom, r: r }; });
      };
    }).concat(retraits.map(function (l) {
      return function () {
        return hub.deleteParcoursMatch(l.id).then(function (r) { return { nom: l.nom, r: r }; });
      };
    }));

    // Séquentiel : messages d'erreur lisibles, pas de rafale sur la base.
    var echecs = [];
    ops.reduce(function (p, op) {
      return p.then(op).then(function (x) {
        if (!x.r || !x.r.ok) echecs.push(x.nom + ' : ' + messageErreur(x.r && x.r.error));
      });
    }, Promise.resolve()).then(function () {
      bouton.disabled = false;
      if (echecs.length) {
        zoneErr.textContent = 'Non enregistré — ' + echecs.join(' ; ');
        charger();
        return;
      }
      fermerModale();
      charger();
    });
  }

  function supprimerMatch() {
    var g = ETAT.edition;
    if (!g || !g.lignes || !g.lignes.length) return;
    if (!window.confirm('Supprimer ce match (' + fmtDate(g.date_match) + ' contre ' + (g.adversaire || '—') +
        ') pour ' + g.lignes.length + ' joueur(s) ?')) return;
    var hub = window.SupabaseHub;
    var echecs = [];
    g.lignes.reduce(function (p, l) {
      return p.then(function () { return hub.deleteParcoursMatch(l.id); }).then(function (r) {
        if (!r || !r.ok) echecs.push(nomJoueur(l) + ' : ' + messageErreur(r && r.error));
      });
    }, Promise.resolve()).then(function () {
      if (echecs.length) {
        document.getElementById('pp-erreur').textContent = 'Suppression incomplète — ' + echecs.join(' ; ');
        charger();
        return;
      }
      fermerModale();
      charger();
    });
  }

  function cablerModale() {
    var ov = document.getElementById('pp-overlay');
    ov.addEventListener('click', function (ev) { if (ev.target === ov) fermerModale(); });
    document.querySelectorAll('[data-action="fermer"]').forEach(function (b) {
      b.addEventListener('click', fermerModale);
    });
    document.getElementById('pp-enregistrer').addEventListener('click', enregistrer);
    document.getElementById('pp-supprimer').addEventListener('click', supprimerMatch);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      var imp = document.getElementById('pp-import-overlay');
      if (!ov.hidden) fermerModale();
      else if (imp && !imp.hidden) fermerImport();
    });
    var imp = document.getElementById('pp-import-overlay');
    if (imp) {
      imp.addEventListener('click', function (ev) { if (ev.target === imp) fermerImport(); });
      imp.querySelectorAll('[data-action="fermer-import"]').forEach(function (b) {
        b.addEventListener('click', fermerImport);
      });
      document.getElementById('pp-imp-analyser').addEventListener('click', analyserImport);
      document.getElementById('pp-imp-continuer').addEventListener('click', continuerImport);
      ['pp-imp-resume', 'pp-imp-compos'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', function () {
          IMPORT.analyse = null;
          document.getElementById('pp-imp-continuer').disabled = true;
        });
      });
    }
  }

  // ------------------------------------------------------------------
  // Import d'une feuille FFR (L3) : collage → analyse → grille de saisie
  // ------------------------------------------------------------------
  var IMPORT = { analyse: null, rapprochement: null };

  function ouvrirImport() {
    if (!window.ParcoursFFR) return;
    IMPORT.analyse = null; IMPORT.rapprochement = null;
    document.getElementById('pp-imp-resume').value = '';
    document.getElementById('pp-imp-compos').value = '';
    document.getElementById('pp-imp-resultat').innerHTML = '';
    document.getElementById('pp-imp-continuer').disabled = true;
    document.getElementById('pp-import-overlay').hidden = false;
    document.getElementById('pp-imp-resume').focus();
  }

  function fermerImport() {
    document.getElementById('pp-import-overlay').hidden = true;
  }

  function liste(items, classe) {
    return '<ul class="' + classe + '">' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  }

  function analyserImport() {
    var zone = document.getElementById('pp-imp-resultat');
    var bouton = document.getElementById('pp-imp-continuer');
    bouton.disabled = true;
    var a = window.ParcoursFFR.analyser(
      document.getElementById('pp-imp-resume').value,
      document.getElementById('pp-imp-compos').value);
    if (!a.ok) {
      zone.innerHTML = '<p class="pp-imp-ko">Import impossible :</p>' + liste(a.erreurs, 'pp-imp-erreurs');
      return;
    }
    var rap = window.ParcoursFFR.rapprocher(a, ETAT.engages);
    if (!rap.ok) {
      zone.innerHTML = '<p class="pp-imp-ko">Import impossible :</p>' + liste(rap.erreurs, 'pp-imp-erreurs') +
        (rap.alertes.length ? liste(rap.alertes, 'pp-imp-alertes') : '');
      return;
    }
    IMPORT.analyse = a; IMPORT.rapprochement = rap;
    var m = a.match;
    var mi = m.miTemps ? ' · mi-temps ' + m.miTemps.dom + ' – ' + m.miTemps.ext + ' ✓' : '';
    zone.innerHTML =
      '<p class="pp-imp-ok">✓ ' + esc(m.domicile) + ' <strong>' + m.score.dom + ' – ' + m.score.ext + '</strong> ' +
        esc(m.exterieur) + ' — score recalculé depuis la chronologie ✓' + mi + '</p>' +
      '<p class="pp-note">' + fmtDate(m.date) + (m.competition ? ' · ' + esc(m.competition) : '') +
        (m.phase ? ' · ' + esc(m.phase) : '') + ' · ' + esc(LIEUX[rap.lieu]) + '</p>' +
      '<div class="pp-scroll"><table class="pp-table"><thead><tr><th class="pp-num">N°</th><th>Joueur</th>' +
        '<th>Sur la feuille</th><th>Statut</th><th>Réalisations</th></tr></thead><tbody>' +
      rap.lignes.map(function (l) {
        return '<tr><td class="pp-num">' + esc(l.numero) + '</td><td><strong>' + esc(nomJoueur(l)) + '</strong>' +
          (l.capitaine ? ' <span class="pp-cap" title="Capitaine">C</span>' : '') + '</td>' +
          '<td>' + esc(l.nomFFR) + '</td><td>' + esc(STATUT_JOUEUR[l.statut_joueur]) + '</td>' +
          '<td>' + esc(detailMarque(l) || '—') + (pointsDe(l) ? ' · ' + pointsDe(l) + ' pts' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (rap.alertes.length || a.alertes.length ? liste(a.alertes.concat(rap.alertes), 'pp-imp-alertes') : '');
    bouton.disabled = false;
  }

  // Match déjà saisi à la même date (quel que soit le libellé de l'adversaire).
  function matchExistant(date, adversaireFFR) {
    var memeDate = grouperMatchs(ETAT.matchs).filter(function (g) {
      return String(g.date_match).slice(0, 10) === date;
    });
    if (memeDate.length <= 1) return memeDate[0] || null;
    var cible = cleMatch(date, adversaireFFR).split('|')[1];
    return memeDate.find(function (g) {
      var adv = g.cle.split('|')[1];
      return adv && (cible.indexOf(adv) === 0 || adv.indexOf(cible) === 0);
    }) || null;
  }

  function continuerImport() {
    var a = IMPORT.analyse, rap = IMPORT.rapprochement;
    if (!a || !rap) return;
    var m = a.match;
    var ex = matchExistant(m.date, rap.adversaire);
    var parPersonne = {};
    if (ex) ex.lignes.forEach(function (l) { parPersonne[l.personne_id] = l; });
    var importes = {};
    var lignesG = rap.lignes.map(function (l) {
      importes[l.personne_id] = true;
      var old = parPersonne[l.personne_id];
      return {
        id: old ? old.id : null, personne_id: l.personne_id, nom: l.nom, prenom: l.prenom,
        statut_joueur: l.statut_joueur, numero: l.numero, capitaine: l.capitaine,
        essais: l.essais, transformations: l.transformations, penalites: l.penalites, drops: l.drops,
        notes: old ? old.notes : null
      };
    });
    // Équipe d'accueil : libellé du match existant, sinon celui commun aux
    // joueurs reconnus (statut de saison), sinon le nom FFR.
    var equipe = ex && ex.equipe_accueil;
    if (!equipe) {
      var eqs = rap.lignes.map(function (l) {
        var e = ETAT.engages.find(function (x) { return x.personne_id === l.personne_id; });
        return e && e.equipe_accueil;
      });
      equipe = (eqs.length && eqs.every(function (x) { return x && x === eqs[0]; })) ? eqs[0] : rap.equipeFFR;
    }
    var g = {
      cle: ex ? ex.cle : undefined,
      date_match: m.date,
      competition: m.competition, phase: m.phase,
      equipe_accueil: equipe,
      adversaire: ex ? ex.adversaire : rap.adversaire,
      lieu: rap.lieu,
      score_pour: rap.scorePour, score_contre: rap.scoreContre,
      lignes: lignesG,
      retraits: ex ? ex.lignes.filter(function (l) { return !importes[l.personne_id]; }) : []
    };
    var bandeau = '<strong>Feuille FFR</strong> : ' + esc(m.domicile) + ' ' + m.score.dom + ' – ' + m.score.ext + ' ' +
      esc(m.exterieur) + ' · score contrôlé ✓' + (m.miTemps ? ' · mi-temps ✓' : '') + '. ' +
      rap.lignes.length + ' joueur(s) du Parcours reconnu(s).' +
      (ex ? ' <br>Ce match est déjà saisi (' + fmtDate(ex.date_match) + ' contre ' + esc(ex.adversaire || '—') +
        ') : il sera <strong>mis à jour</strong>, sans doublon.' : '') +
      ' Vérifie puis enregistre.';
    fermerImport();
    ouvrirModale(g, { source: 'ffr', titre: 'Vérifier l\'import FFR', bandeau: bandeau });
  }

  // ------------------------------------------------------------------
  // Boot : résolution de la catégorie (patron pilotage-categorie.html)
  // ------------------------------------------------------------------
  function peindreCadre(categories) {
    var sel = '';
    if (categories && categories.length > 1) {
      sel = '<div class="pp-selecteur"><label for="pp-cat-select">Catégorie :</label> ' +
        '<select id="pp-cat-select">' + categories.map(function (c) {
          return '<option value="' + esc(c.id) + '"' + (c.id === ETAT.categorieId ? ' selected' : '') + '>' +
            esc(c.libelle_court || c.code || c.id) + '</option>';
        }).join('') + '</select></div>';
    }
    mount.innerHTML =
      '<div class="pp-head"><h1>⭐ Parcours Performance <span id="pp-cat-lib"></span></h1>' +
      '<p class="pp-sub">Nos joueurs en équipe Performance' +
      (ETAT.saison && ETAT.saison.libelle ? ' · saison ' + esc(ETAT.saison.libelle) : '') + '</p>' +
      '<a class="pp-retour" href="pilotage-categorie.html">← Retour au pilotage de saison</a></div>' +
      sel + '<div id="pp-zone"></div>';
    majLibelle(categories);
    var s = document.getElementById('pp-cat-select');
    if (s) s.addEventListener('change', function () {
      ETAT.categorieId = this.value;
      ETAT.filtreJoueur = null;
      if (typeof window.SupabaseHub.memoriserCategorieActive === 'function') {
        window.SupabaseHub.memoriserCategorieActive(this.value);
      }
      majLibelle(categories);
      charger();
    });
  }

  function majLibelle(categories) {
    var c = (categories || []).find(function (x) { return x.id === ETAT.categorieId; });
    var el = document.getElementById('pp-cat-lib');
    if (el) el.textContent = c ? '— ' + (c.libelle_court || c.code || '') : '';
  }

  function demarrer() {
    mount = document.getElementById('pp-page');
    var hub = window.SupabaseHub;
    if (!mount) return;
    if (!hub || typeof hub.listParcoursSaison !== 'function') {
      mount.innerHTML = '<section class="pp-bloc"><h2>Erreur</h2><p>Module Parcours Performance indisponible.</p></section>';
      return;
    }
    cablerModale();
    var params = new URLSearchParams(window.location.search);
    var override = params.get('categorie');
    // v1.3 (L4) : historique d'un joueur ouvert depuis sa fiche ; ignoré
    // au chargement s'il n'est ni engagé ni présent dans les matchs.
    if (params.get('joueur')) ETAT.filtreJoueur = params.get('joueur');

    Promise.resolve(hub.getSaisonActive()).catch(function () { return null; }).then(function (saison) {
      ETAT.saison = saison;
      return Promise.resolve(hub.resoudrePerimetreCategories()).catch(function () { return null; });
    }).then(function (perimetre) {
      var cats = (perimetre && Array.isArray(perimetre.categories)) ? perimetre.categories : [];
      if (override && cats.some(function (c) { return c.id === override; })) {
        ETAT.categorieId = override;
      } else if (perimetre && !perimetre.vide && cats.length) {
        ETAT.categorieId = perimetre.active || cats[0].id;
      }
      if (!ETAT.categorieId) {
        mount.innerHTML = '<section class="pp-bloc"><h2>Accès réservé</h2>' +
          '<p>Ces informations sont réservées aux encadrants d\'une catégorie.</p></section>';
        return;
      }
      peindreCadre(cats);
      charger();
    });
  }

  window.ParcoursPerformance = {
    demarrer: demarrer,
    // Exposés pour les tests (fonctions pures).
    _cleMatch: cleMatch,
    _grouperMatchs: grouperMatchs,
    _pointsDe: pointsDe
  };
})();
