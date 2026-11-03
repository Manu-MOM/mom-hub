/* =====================================================================
 * parcours-ffr.js — Lecture des feuilles de match FFR (Mon Club House)
 * ---------------------------------------------------------------------
 * Version : v1.1 — 3 novembre 2026 — PARCOURS-PERFORMANCE lot L3 (D2, D8)
 *   v1.1 : collage « texte brut » de la page entière (Ctrl+A, recette
 *          terrain du 03/11) : la page y arrive éclatée (date / heure,
 *          score « 19 » « - » « 29 », « 12 » « Mi-temps » « 16 », nom puis
 *          « (Essai) » sur la ligne suivante) et porte des libellés
 *          d'images (« … logo », « logo équipe … », « go back icon »).
 *          Étape de recollage ajoutée dans lignes() ; menus et pied de
 *          page déjà ignorés (lecture à partir de l'en-tête du match).
 *   v1.0 : première version.
 *
 * OBJET
 *   Fonctions PURES (aucun accès réseau, aucun DOM) qui lisent le texte
 *   copié-collé des onglets « Résumé » et « Compositions » d'un match sur
 *   monclubhouse.ffr.fr, puis le rapprochent des joueurs inscrits au
 *   Parcours Performance. Utilisé par parcours-performance.js ; testable
 *   sous Node (module.exports).
 *
 * FORMATS ACCEPTÉS
 *   - texte brut (collage dans un champ texte) ;
 *   - texte avec liens Markdown [nom](https://…/joueurs/123456), tel que
 *     produit par certains collages : l'identifiant FFR du joueur est
 *     alors utilisé en priorité pour attribuer les actions.
 *
 * CE QUE LA FEUILLE DONNE / NE DONNE PAS (FAIT FOI F3, F4)
 *   - équipe qui reçoit = première nommée (à gauche) → lieu déduit ;
 *   - XV de départ (1-15), remplaçants, capitaine « C », changements ;
 *   - actions de score nominatives (essai, transformation, pénalité,
 *     drop) sans indication d'équipe : l'équipe est retrouvée par le nom
 *     dans les compositions ;
 *   - cartons sans nom, minutes peu fiables : ignorés (D7).
 *
 * CONTRÔLE BLOQUANT (D8, doctrine pt 277)
 *   Le score recalculé depuis la chronologie doit égaler le score de fin
 *   de match pour CHAQUE équipe (et celui de la mi-temps s'il est lu).
 *   Toute action non attribuable à une équipe bloque l'import.
 * ===================================================================== */
(function (racine) {
  'use strict';

  var POINTS = { essai: 5, essai_penalite: 7, transformation: 2, penalite: 3, drop: 3 };
  var TYPES_RE = '(Essai de p[ée]nalit[ée]|Essai|Transformation|P[ée]nalit[ée]|Drop)';
  var STATUTS_MATCH = /^(termin[ée]|en cours|[àa] venir|report[ée]|annul[ée]|mi-temps)$/i;

  // ------------------------------------------------------------------
  // Lignes : retire les liens Markdown, garde l'identifiant FFR éventuel
  // ------------------------------------------------------------------
  function lignes(texte) {
    var out = String(texte || '').replace(/\r/g, '').split('\n').map(function (brut) {
      var id = null;
      var m = /\/joueurs\/(\d+)/.exec(brut);
      if (m) id = m[1];
      var t = brut.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s*[*\-•]\s+/, '')
        .replace(/ /g, ' ')
        .trim();
      return { t: t, id: id };
    }).filter(function (l) { return l.t !== '' && !IMAGE_RE.test(l.t); });
    return recoller(out);
  }

  // Libellés d'images de la page FFR, sans valeur pour la lecture.
  var IMAGE_RE = /( logo$|^logo |^go back icon$|^google store logo$|^ios store logo$)/i;

  // v1.1 — Collage texte brut : recolle les éléments que le navigateur
  // sépare sur plusieurs lignes, pour retrouver la forme d'une ligne.
  function recoller(L) {
    var res = [];
    var num = function (x) { return x && /^\d{1,3}$/.test(x.t); };
    for (var i = 0; i < L.length; i++) {
      var a = L[i], b = L[i + 1], c = L[i + 2];
      // « 31/10/2026 » + « 14h30 »
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(a.t) && b && /^\d{1,2}h\d{2}$/.test(b.t)) {
        res.push({ t: a.t + b.t, id: null }); i += 1; continue;
      }
      // « 19 » + « - » + « 29 » ; « 12 » + « Mi-temps » + « 16 » ; idem « Fin de match »
      if (num(a) && b && c && num(c) && /^(-|–|mi-temps|fin de match)$/i.test(b.t)) {
        res.push({ t: a.t + (b.t === '–' ? '-' : b.t) + c.t, id: null }); i += 2; continue;
      }
      // « E. GUIOT » + « (Essai) » (ou « (E. GUIOT) » pour un changement)
      if (b && /^\(.+\)$/.test(b.t) && !/^\(/.test(a.t) && !/^\d{1,3}'?$/.test(a.t)) {
        res.push({ t: a.t + b.t, id: a.id || b.id }); i += 1; continue;
      }
      res.push(a);
    }
    return res;
  }

  function typeCanonique(s) {
    var x = sansAccents(s).toLowerCase();
    if (x.indexOf('essai de penalite') === 0) return 'essai_penalite';
    if (x === 'essai') return 'essai';
    if (x === 'transformation') return 'transformation';
    if (x === 'penalite') return 'penalite';
    if (x === 'drop') return 'drop';
    return null;
  }

  function dateFr(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
  }

  function sansAccents(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // ------------------------------------------------------------------
  // Noms : « E. GOETTLE », « E.GOETTLE », « L. RACINE PALENN... »
  // ------------------------------------------------------------------
  function cleNom(s) {
    var x = sansAccents(s).toUpperCase().trim();
    var tronque = /(\.\.\.|…)$/.test(x);
    x = x.replace(/(\.\.\.|…)$/, '').trim();
    var m = /^([A-Z])\s*\.\s*(.+)$/.exec(x);
    if (!m) return null;
    var nom = m[2].replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!nom) return null;
    return { initiale: m[1], nom: nom, tronque: tronque };
  }

  function memesNoms(a, b) {
    if (!a || !b || a.initiale !== b.initiale) return false;
    if (a.nom === b.nom) return true;
    if (a.tronque && b.nom.indexOf(a.nom) === 0) return true;
    if (b.tronque && a.nom.indexOf(b.nom) === 0) return true;
    return false;
  }

  // Clé d'une personne du Hub (prénom + nom complets, jamais tronqués).
  function clePersonne(prenom, nom) {
    var p = sansAccents(prenom).toUpperCase().replace(/[^A-Z]/g, '');
    var n = sansAccents(nom).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!p || !n) return null;
    return { initiale: p.charAt(0), nom: n, tronque: false };
  }

  // ------------------------------------------------------------------
  // En-tête commun aux deux onglets
  // ------------------------------------------------------------------
  function lireEntete(L) {
    var iDate = -1, date = null, heure = null;
    for (var i = 0; i < L.length; i++) {
      var m = /^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{1,2}h\d{2})?/.exec(L[i].t);
      if (m) { iDate = i; date = m[3] + '-' + m[2] + '-' + m[1]; heure = m[4] || null; break; }
    }
    if (iDate < 0) return null;
    var iScore = -1, sDom = null, sExt = null;
    for (var j = iDate + 1; j < Math.min(L.length, iDate + 8); j++) {
      var s = /^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(L[j].t);
      if (s) { iScore = j; sDom = +s[1]; sExt = +s[2]; break; }
    }
    if (iScore < 0 || iScore - iDate < 2) return null;
    var domicile = L[iScore - 1].t;
    var milieu = L.slice(iDate + 1, iScore - 1).map(function (l) { return l.t; });
    var k = iScore + 1;
    while (k < L.length && STATUTS_MATCH.test(L[k].t)) k++;
    if (k >= L.length) return null;
    return {
      date: date, heure: heure,
      competition: milieu[0] || null,
      phase: milieu.length > 1 ? milieu.slice(1).join(' - ') : null,
      domicile: domicile, exterieur: L[k].t,
      score: { dom: sDom, ext: sExt },
      fin: k
    };
  }

  // ------------------------------------------------------------------
  // Onglet Compositions
  // ------------------------------------------------------------------
  function lireCompositions(texte, entete) {
    var L = lignes(texte);
    var e = lireEntete(L);
    var res = { dom: [], ext: [], changements: [], erreurs: [] };
    if (!e) { res.erreurs.push('Compositions : en-tête du match introuvable (date, équipes, score).'); return res; }
    var nDom = sansAccents(e.domicile).toLowerCase();
    var nExt = sansAccents(e.exterieur).toLowerCase();
    var section = null, cote = null, numEnAttente = null, dernier = null;
    var banc = [], prec = null;

    function ajouter(num, l) {
      var j = { num: num, nom: l.t, ffrId: l.id, cle: cleNom(l.t), titulaire: true, capitaine: false };
      res[cote].push(j);
      dernier = j;
    }

    for (var i = e.fin + 1; i < L.length; i++) {
      var l = L[i], t = l.t, tn = sansAccents(t).toLowerCase();
      if (/^informations$/i.test(t)) break;
      if (section !== 'changements' && section !== 'banc') {
        if (tn === nDom) { section = 'xv'; cote = 'dom'; numEnAttente = null; continue; }
        if (tn === nExt) { section = 'xv'; cote = 'ext'; numEnAttente = null; continue; }
      }
      if (/^changements$/i.test(t)) { section = 'changements'; continue; }
      if (/^rempla[çc]ants$/i.test(t)) { section = 'banc'; numEnAttente = null; continue; }

      if (section === 'xv') {
        if (/^[VDN]$/.test(t)) continue;               // forme récente de l'équipe
        if (t === 'C') { if (dernier) dernier.capitaine = true; continue; }
        var mx = /^(\d{1,2})(?:\s+(.+))?$/.exec(t);
        if (mx && !mx[2]) { numEnAttente = +mx[1]; continue; }
        if (mx && mx[2]) { ajouter(+mx[1], { t: mx[2], id: l.id }); continue; }
        if (numEnAttente != null) { ajouter(numEnAttente, l); numEnAttente = null; }
      } else if (section === 'changements') {
        if (/^\d{1,3}'$/.test(t)) { res.changements.push({ minute: parseInt(t, 10), entrant: null, sortant: null }); continue; }
        var c = res.changements[res.changements.length - 1];
        if (!c) continue;
        var j2 = { nom: t, ffrId: l.id, cle: cleNom(t) };
        if (!c.entrant) c.entrant = j2; else if (!c.sortant) c.sortant = j2;
      } else if (section === 'banc') {
        var mb = /^(\d{1,2})(?:\s+(.+))?$/.exec(t);
        if (mb && !mb[2]) { numEnAttente = +mb[1]; continue; }
        var num = null, ln = l;
        if (mb && mb[2]) { num = +mb[1]; ln = { t: mb[2], id: l.id }; }
        else if (numEnAttente != null) { num = numEnAttente; numEnAttente = null; }
        if (num == null) continue;
        banc.push({ num: num, nom: ln.t, ffrId: ln.id, cle: cleNom(ln.t), titulaire: false, capitaine: false });
      }
    }

    // Banc : les remplaçants du club qui reçoit d'abord, puis ceux du club
    // visiteur ; la numérotation repart à l'équipe suivante.
    var coteBanc = 'dom';
    banc.forEach(function (j) {
      if (prec != null && j.num <= prec && coteBanc === 'dom') coteBanc = 'ext';
      prec = j.num;
      res[coteBanc].push(j);
    });

    if (!res.dom.length || !res.ext.length) {
      res.erreurs.push('Compositions : impossible de lire les deux équipes (' + res.dom.length + ' / ' + res.ext.length + ' joueurs).');
    }
    res.entete = e;
    return res;
  }

  // ------------------------------------------------------------------
  // Onglet Résumé
  // ------------------------------------------------------------------
  function lireResume(texte) {
    var L = lignes(texte);
    var e = lireEntete(L);
    var res = { evenements: [], miTemps: null, finMatch: null, erreurs: [] };
    if (!e) { res.erreurs.push('Résumé : en-tête du match introuvable (date, équipes, score).'); return res; }
    var reApres = new RegExp('^(.+?)\\s*\\(' + TYPES_RE + '\\)\\s*(?:\\d{1,3}\')?$', 'i');
    var reAvant = new RegExp('^\\(' + TYPES_RE + '\\)\\s*(.+?)(?:\\s+\\d{1,3}\')?$', 'i');
    var reSeul = new RegExp('^' + TYPES_RE + '$', 'i');
    var periode = 1;
    for (var i = e.fin + 1; i < L.length; i++) {
      var t = L[i].t.replace(/^\d{1,3}'\s*/, '');
      var mt = /^(\d{1,3})\s*Mi-temps\s*(\d{1,3})$/i.exec(t);
      if (mt) { res.miTemps = { dom: +mt[1], ext: +mt[2] }; periode = 2; continue; }
      var mf = /^(\d{1,3})\s*Fin de match\s*(\d{1,3})$/i.exec(t);
      if (mf) { res.finMatch = { dom: +mf[1], ext: +mf[2] }; continue; }
      var m = reApres.exec(t), nom = null, type = null;
      if (m) { nom = m[1]; type = m[2]; }
      else if ((m = reAvant.exec(t))) { type = m[1]; nom = m[2]; }
      else if ((m = reSeul.exec(t))) { type = m[1]; }
      if (!type) continue;
      var tc = typeCanonique(type);
      if (!tc) continue;
      res.evenements.push({ type: tc, nom: nom ? nom.trim() : null, ffrId: nom ? L[i].id : null,
        cle: nom ? cleNom(nom) : null, periode: periode });
    }
    res.entete = e;
    return res;
  }

  // ------------------------------------------------------------------
  // Analyse complète : compositions + résumé + contrôles bloquants
  // ------------------------------------------------------------------
  function trouverDans(liste, ref) {
    return liste.filter(function (j) {
      if (ref.ffrId && j.ffrId) return ref.ffrId === j.ffrId;
      return memesNoms(j.cle, ref.cle);
    });
  }

  function analyser(texteResume, texteCompos) {
    var C = lireCompositions(texteCompos);
    var R = lireResume(texteResume);
    var erreurs = C.erreurs.concat(R.erreurs);
    var alertes = [];
    if (erreurs.length && /rempla[çc]ants/i.test(String(texteResume)) && /mi-temps|fin de match/i.test(String(texteCompos))) {
      return { ok: false, alertes: alertes, erreurs: ['Les deux collages semblent inversés : Résumé dans le premier champ, Compositions dans le second.'] };
    }
    if (erreurs.length) return { ok: false, erreurs: erreurs, alertes: alertes };

    var e = C.entete;
    var eR = R.entete;
    if (eR.date !== e.date || sansAccents(eR.domicile).toLowerCase() !== sansAccents(e.domicile).toLowerCase() ||
        sansAccents(eR.exterieur).toLowerCase() !== sansAccents(e.exterieur).toLowerCase()) {
      return { ok: false, alertes: alertes,
        erreurs: ['Les deux onglets ne concernent pas le même match (Résumé : ' + eR.domicile + ' – ' + eR.exterieur +
          ' le ' + dateFr(eR.date) + ' ; Compositions : ' + e.domicile + ' – ' + e.exterieur + ' le ' + dateFr(e.date) + ').'] };
    }

    // Entrées en jeu : un remplaçant qui apparaît comme entrant.
    C.changements.forEach(function (ch) {
      if (!ch.entrant) return;
      ['dom', 'ext'].forEach(function (cote) {
        trouverDans(C[cote], ch.entrant).forEach(function (j) { if (!j.titulaire) j.entre = true; });
      });
    });

    // Attribution des actions de score.
    var totaux = { dom: 0, ext: 0 }, miTemps = { dom: 0, ext: 0 };
    ['dom', 'ext'].forEach(function (c) {
      C[c].forEach(function (j) { j.essais = 0; j.transformations = 0; j.penalites = 0; j.drops = 0; });
    });
    R.evenements.forEach(function (ev) {
      if (!ev.nom) {
        erreurs.push('Action « ' + ev.type.replace('_', ' ') + ' » sans nom de joueur : équipe impossible à déterminer.');
        return;
      }
      var dDom = trouverDans(C.dom, ev), dExt = trouverDans(C.ext, ev);
      var tous = dDom.concat(dExt);
      if (tous.length !== 1) {
        erreurs.push(tous.length === 0
          ? ev.nom + ' (' + ev.type + ') introuvable dans les compositions.'
          : ev.nom + ' (' + ev.type + ') correspond à plusieurs joueurs des compositions.');
        return;
      }
      var j = tous[0], cote = dDom.length ? 'dom' : 'ext';
      var champ = { essai: 'essais', transformation: 'transformations', penalite: 'penalites', drop: 'drops' }[ev.type];
      if (champ) j[champ] += 1;
      if (!j.titulaire) j.entre = true;           // D7 : un joueur qui marque est entré
      totaux[cote] += POINTS[ev.type];
      if (ev.periode === 1) miTemps[cote] += POINTS[ev.type];
    });

    var fin = R.finMatch || e.score;
    if (R.finMatch && (R.finMatch.dom !== e.score.dom || R.finMatch.ext !== e.score.ext)) {
      erreurs.push('Score de fin de match (' + R.finMatch.dom + '-' + R.finMatch.ext +
        ') différent du score affiché (' + e.score.dom + '-' + e.score.ext + ').');
    }
    if (totaux.dom !== fin.dom || totaux.ext !== fin.ext) {
      erreurs.push('Score recalculé ' + totaux.dom + '-' + totaux.ext + ' ≠ score de la feuille ' +
        fin.dom + '-' + fin.ext + ' : la chronologie est incomplète ou incohérente.');
    }
    var miOk = null;
    if (R.miTemps) {
      miOk = (miTemps.dom === R.miTemps.dom && miTemps.ext === R.miTemps.ext);
      if (!miOk) {
        erreurs.push('Score à la mi-temps recalculé ' + miTemps.dom + '-' + miTemps.ext +
          ' ≠ feuille ' + R.miTemps.dom + '-' + R.miTemps.ext + '.');
      }
    } else {
      alertes.push('Score à la mi-temps non lu : seul le score final est contrôlé.');
    }

    return {
      ok: erreurs.length === 0,
      erreurs: erreurs,
      alertes: alertes,
      match: {
        date: e.date, heure: e.heure, competition: e.competition, phase: e.phase,
        domicile: e.domicile, exterieur: e.exterieur,
        score: { dom: fin.dom, ext: fin.ext },
        miTemps: R.miTemps, miTempsControle: miOk
      },
      equipes: { dom: C.dom, ext: C.ext },
      totaux: totaux
    };
  }

  // ------------------------------------------------------------------
  // Rapprochement avec les joueurs inscrits au Parcours Performance
  //   engages : [{ personne_id, prenom, nom, equipe_accueil }]
  // ------------------------------------------------------------------
  function rapprocher(analyse, engages) {
    var res = { ok: false, erreurs: [], alertes: [], cote: null, lignes: [] };
    if (!analyse || !analyse.ok) { res.erreurs.push('Analyse de la feuille non valide.'); return res; }
    var cles = (engages || []).map(function (p) {
      return { p: p, cle: clePersonne(p.prenom, p.nom) };
    }).filter(function (x) { return x.cle; });

    var trouves = { dom: [], ext: [] };
    ['dom', 'ext'].forEach(function (cote) {
      analyse.equipes[cote].forEach(function (j) {
        var cand = cles.filter(function (x) { return memesNoms(j.cle, x.cle); });
        if (cand.length === 1) trouves[cote].push({ j: j, p: cand[0].p });
        else if (cand.length > 1) {
          res.alertes.push(j.nom + ' correspond à plusieurs joueurs inscrits (' +
            cand.map(function (x) { return x.p.prenom + ' ' + x.p.nom; }).join(', ') + ') : non importé.');
        }
      });
    });
    if (!trouves.dom.length && !trouves.ext.length) {
      res.erreurs.push('Aucun joueur inscrit au Parcours Performance n\'apparaît sur cette feuille.');
      return res;
    }
    if (trouves.dom.length && trouves.ext.length) {
      res.erreurs.push('Des joueurs inscrits apparaissent dans les deux équipes : vérifie les inscriptions (' +
        trouves.dom.concat(trouves.ext).map(function (x) { return x.j.nom; }).join(', ') + ').');
      return res;
    }
    var cote = trouves.dom.length ? 'dom' : 'ext';
    var autre = cote === 'dom' ? 'ext' : 'dom';
    res.cote = cote;
    res.lieu = cote === 'dom' ? 'domicile' : 'exterieur';
    res.equipeFFR = analyse.match[cote === 'dom' ? 'domicile' : 'exterieur'];
    res.adversaire = analyse.match[autre === 'dom' ? 'domicile' : 'exterieur'];
    res.scorePour = analyse.match.score[cote];
    res.scoreContre = analyse.match.score[autre];
    res.lignes = trouves[cote].map(function (x) {
      var j = x.j;
      return {
        personne_id: x.p.personne_id, prenom: x.p.prenom, nom: x.p.nom, nomFFR: j.nom,
        numero: j.num,
        statut_joueur: j.titulaire ? 'titulaire' : (j.entre ? 'entre' : 'non_entre'),
        capitaine: !!j.capitaine,
        essais: j.essais || 0, transformations: j.transformations || 0,
        penalites: j.penalites || 0, drops: j.drops || 0
      };
    });
    res.ok = true;
    return res;
  }

  var api = {
    analyser: analyser,
    rapprocher: rapprocher,
    // exposés pour les tests
    _lignes: lignes, _cleNom: cleNom, _memesNoms: memesNoms, _lireEntete: lireEntete,
    _lireCompositions: lireCompositions, _lireResume: lireResume
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.ParcoursFFR = api;
})(typeof window !== 'undefined' ? window : this);
