/* =====================================================================
 * recap-evals-match.js — Récap des évaluations d'un match (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.1 — 22 novembre 2026 — EVAL-JOUEUR Avenant C, lot C3
 *   FAIT FOI Conception-EVAL-JOUEUR-v1.md §11 (D42, D43), sql_286,
 *   js/criteres-eval.js v1.0.
 *   v1.1 : 6 critères C / J (libellés du référentiel) ; sous chaque
 *          pastille, nombre de points « à travailler » cochés ; colonnes
 *          « Poste joué » (déclaré par le joueur, sinon compo du
 *          titulaire) et « Objectifs prochain match » ; à l'écran,
 *          bouton « Détail » par joueur : points cochés (coach / joueur)
 *          et bilan des objectifs précédents, jamais imprimé (D43).
 * Version : v1.0 — 17 novembre 2026 — RECAP-EVALS-MATCH v1
 *   FAIT FOI : Conception-RECAP-EVALS-MATCH-v1.md (gelé par Manu le
 *   17/11/2026, « je suis tes recos... je gèle », R9 = a′). Demande de
 *   Jean (SR-F) relayée par Manu.
 *
 * Page : recap-evals-match.html?evenement=<uuid>. Staff connecté.
 * Ouverte uniquement depuis la page Évals match (R7, eval-match.js v1.5).
 * Rendu écran + impression A4 paysage (navigateur).
 *
 * Données (lecture seule, aucun SQL nouveau) :
 *   SupabaseHub.listEvalsMatch(evt) → lister_evals_match :
 *   match (libellé, date, domicile_exterieur, score, niveau),
 *   joueurs[] (ordre de la RPC : maillot, nom, prénom) avec
 *   eval (statut, feu, criteres, point_fort, axe_travail, mot_coach,
 *   reponse_joueur) et auto_eval (feux, commentaire, gene).
 *
 * Décisions appliquées :
 *   R3 colonnes ; R4 brouillons inclus, pas de lignes vierges ;
 *   R5 désaccord C/J encadré + synthèse ; R6 santé : ⚠ écran seul,
 *   jamais le détail, jamais imprimé (classe re-ecran-seul) ;
 *   R8 aucune troncature, thead répété si 2ᵉ page.
 * Anti-injection : toute donnée dynamique passe par esc().
 * ===================================================================== */
(function () {
  'use strict';

  // v1.1 (Avenant C) : 6 critères ; noms complets du référentiel
  // (js/criteres-eval.js), libellés courts pour l'en-tête du tableau.
  var CE = window.CriteresEval || null;
  var COURT = { tech_indiv: 'Techn.', physique: 'Phys.', comprehension: 'Lecture', etat_esprit: 'Engag.', mental: 'Mental', tech_poste: 'Poste' };
  var CRITERES = [
    { cle: 'tech_indiv', nom: 'Technique' }, { cle: 'physique', nom: 'Physique' },
    { cle: 'comprehension', nom: 'Lecture du jeu' }, { cle: 'etat_esprit', nom: 'Engagement & collectif' },
    { cle: 'mental', nom: 'Mental' }, { cle: 'tech_poste', nom: 'Technique au poste' }
  ];
  var FEUX = { V: true, O: true, R: true };

  var etat = { evenementId: null, match: null, joueurs: [] };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function texte(s) { return (s == null) ? '' : String(s).trim(); }
  function dateFr(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function pastille(v) {
    return FEUX[v] ? '<span class="p p-' + v + '">' + v + '</span>' : '<span class="vide">—</span>';
  }
  var VIDE = '<span class="vide">—</span>';
  // v1.1 : nombre de points « à travailler » cochés (écran et impression).
  function nb(codes) { var n = Array.isArray(codes) ? codes.length : 0; return n ? '<span class="nb">' + n + '</span>' : ''; }
  function posteJoue(j) {
    var a = j.auto_eval;
    if (a && a.poste_famille) return CE ? CE.libelleFamille(a.poste_famille) || a.poste_famille : a.poste_famille;
    if (j.poste_compo) { var f = CE ? CE.familleDuPoste(j.poste_compo) : null; return f && CE ? CE.libelleFamille(f) : j.poste_compo; }
    return '';
  }
  function libs(cle, codes) { return (codes || []).map(function (x) { return CE ? CE.libelle(cle, x) : x; }); }

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
    etat.joueurs = (r.data.joueurs || []).slice();
    return true;
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------
  function enTete() {
    var m = etat.match || {};
    var lieu = m.domicile_exterieur === 'domicile' ? 'Domicile'
      : (m.domicile_exterieur === 'exterieur' ? 'Extérieur' : '');
    var score = (m.score_mom != null && m.score_adverse != null)
      ? 'Score : ' + m.score_mom + ' – ' + m.score_adverse : 'Score : non saisi';
    var meta = [m.niveau, dateFr(m.date), lieu, score].filter(Boolean).join(' · ');
    return '<div class="tete"><h1>Récap évaluations — ' + esc(m.libelle || 'Match') + '</h1>'
      + '<div class="meta">' + esc(meta) + '</div></div>'
      + '<div class="legende">Pour chaque critère : <b>C</b> = coach, <b>J</b> = joueur (auto-évaluation) ; le petit chiffre = points « à travailler » cochés. '
      + '<span class="p p-V">V</span> acquis · <span class="p p-O">O</span> en progrès · <span class="p p-R">R</span> à travailler. '
      + 'Case encadrée = coach et joueur ne sont pas d’accord. « Retour du joueur » = son mot dans l’auto-évaluation, puis ↪ sa réponse à l’éval du coach. '
      + 'Feu match : V gros match · O dans le match · R match difficile. — = pas encore saisi.</div>';
  }

  function colgroup() {
    var c = '<col style="width:5.5mm"><col style="width:30mm"><col style="width:16mm"><col style="width:9mm">';
    for (var i = 0; i < CRITERES.length * 2; i++) c += '<col style="width:5.6mm">';
    return '<colgroup>' + c + '<col><col><col><col><col>'
      + '<col style="width:12mm"><col class="re-ecran-seul" style="width:6mm"></colgroup>';
  }

  function thead() {
    var l1 = '<tr><th rowspan="2">N°</th><th rowspan="2">Joueur</th><th rowspan="2">Poste<br>joué</th><th rowspan="2">Feu<br>match</th>';
    var l2 = '<tr class="sous">';
    CRITERES.forEach(function (c) {
      l1 += '<th colspan="2" class="sep" title="' + esc(c.nom) + '">' + esc(COURT[c.cle] || c.nom) + '</th>';
      l2 += '<th class="sep">C</th><th>J</th>';
    });
    l1 += '<th rowspan="2" class="sep tt">Point fort</th><th rowspan="2" class="tt">Axe de travail</th>'
      + '<th rowspan="2" class="tt">Mot du coach</th><th rowspan="2" class="tt">Retour du joueur</th>'
      + '<th rowspan="2" class="tt">Objectifs prochain match</th>'
      + '<th rowspan="2" class="sep">Statut</th>'
      + '<th rowspan="2" class="re-ecran-seul" title="Blessure, gêne ou fatigue signalée">⚠</th></tr>';
    return '<thead>' + l1 + l2 + '</tr></thead>';
  }

  function aSignale(j) {
    return !!(j && j.auto_eval && j.auto_eval.gene && j.auto_eval.gene.signalee);
  }

  function ligne(j, compte) {
    var e = j.eval || null;
    var a = j.auto_eval || null;
    var crit = (e && e.criteres) || {};
    var feux = (a && a.feux) || {};
    var scC = (e && e.sous_criteres) || {};
    var scJ = (a && a.sous_criteres) || {};
    var poste = posteJoue(j);
    var h = '<tr><td><b>' + esc(j.numero != null ? j.numero : '') + '</b></td>'
      + '<td class="nom">' + esc((j.nom || '') + ' ' + (j.prenom || ''))
      + ' <button type="button" class="re-detail-btn re-ecran-seul" data-detail="' + esc(j.personne_id) + '" aria-expanded="false">Détail</button></td>'
      + '<td class="poste">' + (poste ? esc(poste) : VIDE) + '</td>'
      + '<td>' + pastille(e && e.feu) + '</td>';
    CRITERES.forEach(function (c) {
      var cv = FEUX[crit[c.cle]] ? crit[c.cle] : null;
      var jv = FEUX[feux[c.cle]] ? feux[c.cle] : null;
      var diff = !!(cv && jv && cv !== jv);
      if (diff) compte.ecarts++;
      h += '<td class="sep' + (diff ? ' ecart' : '') + '">' + pastille(cv) + nb(scC[c.cle]) + '</td>'
        + '<td class="j' + (diff ? ' ecart' : '') + '">' + pastille(jv) + nb(scJ[c.cle]) + '</td>';
    });
    var pf = texte(e && e.point_fort), ax = texte(e && e.axe_travail), mc = texte(e && e.mot_coach);
    var com = texte(a && a.commentaire), rep = texte(e && e.reponse_joueur);
    var retour = com ? esc(com) : (a ? '' : VIDE);
    if (rep) retour += '<span class="rep"><b>↪ Au coach :</b> ' + esc(rep) + '</span>';
    h += '<td class="t sep">' + (pf ? esc(pf) : VIDE) + '</td>'
      + '<td class="t">' + (ax ? esc(ax) : VIDE) + '</td>'
      + '<td class="t">' + (mc ? esc(mc) : VIDE) + '</td>'
      + '<td class="t">' + retour + '</td>'
      + '<td class="t">' + (a && Array.isArray(a.objectifs) && a.objectifs.length
        ? a.objectifs.map(function (o, i) { return (i + 1) + '. ' + esc(o); }).join('\n') : VIDE) + '</td>';
    var st = !e ? '<span class="vide">Pas d’éval</span>'
      : (e.statut === 'publie' ? 'Publiée' : '<span class="st-b">Brouillon</span>');
    st += '<br>' + (a ? 'Auto ✔' : '<span class="vide">Auto —</span>');
    h += '<td class="statut sep">' + st + '</td>'
      + '<td class="re-ecran-seul">' + (aSignale(j)
        ? '<span class="gene" title="Signalement : voir la page Évals match">⚠</span>' : '') + '</td></tr>';
    h += ligneDetail(j, scC, scJ);
    return h;
  }

  // v1.1 (D43) : détail à l'écran seulement (jamais imprimé).
  function ligneDetail(j, scC, scJ) {
    var a = j.auto_eval || null;
    var libRes = {};
    (CE ? CE.resultatsObjectifs() : []).forEach(function (r) { libRes[r.code] = r.libelle; });
    var lignes = CRITERES.map(function (c) {
      var lc = libs(c.cle, scC[c.cle]), lj = libs(c.cle, scJ[c.cle]);
      if (!lc.length && !lj.length) return '';
      return '<div><b>' + esc(c.nom) + '</b> — coach : ' + (lc.length ? esc(lc.join(' · ')) : '—')
        + ' / joueur : ' + (lj.length ? esc(lj.join(' · ')) : '—') + '</div>';
    }).join('');
    var bilan = a && Array.isArray(a.bilan_objectifs) && a.bilan_objectifs.length
      ? '<div><b>Objectifs du match précédent</b> — ' + a.bilan_objectifs.map(function (b) {
        return esc(b.objectif) + ' : ' + esc(libRes[b.resultat] || b.resultat);
      }).join(' · ') + '</div>' : '';
    var corps = lignes + bilan || '<div class="vide">Aucun point à travailler coché ni objectif.</div>';
    return '<tr class="re-detail re-ecran-seul" data-detail-de="' + esc(j.personne_id) + '" hidden>'
      + '<td colspan="' + (CRITERES.length * 2 + 11) + '">' + corps + '</td></tr>';
  }

  function rendre() {
    var compte = { ecarts: 0 };
    var nbEval = 0, nbPub = 0, nbAuto = 0, nbGene = 0;
    var corps = etat.joueurs.map(function (j) {
      if (j.eval) { nbEval++; if (j.eval.statut === 'publie') nbPub++; }
      if (j.auto_eval) nbAuto++;
      if (aSignale(j)) nbGene++;
      return ligne(j, compte);
    }).join('');
    var n = etat.joueurs.length;
    if (!n) {
      corps = '<tr><td colspan="' + (CRITERES.length * 2 + 11) + '" class="vide">Aucun joueur sur la feuille de ce match (pas de compo active ni d’éval).</td></tr>';
    }
    var h = '<div class="re-feuille">' + enTete()
      + '<table>' + colgroup() + thead() + '<tbody>' + corps + '</tbody></table>'
      + '<div class="synthese">'
      + '<span><b>' + nbEval + '/' + n + '</b> évals coach (' + nbPub + ' publiée' + (nbPub > 1 ? 's' : '') + ')</span>'
      + '<span><b>' + nbAuto + '/' + n + '</b> auto-évaluations</span>'
      + '<span><b>' + compte.ecarts + '</b> désaccord' + (compte.ecarts > 1 ? 's' : '') + ' coach / joueur sur les critères</span>'
      + (nbGene ? '<span class="re-ecran-seul"><b class="gene">⚠ ' + nbGene + '</b> signalement'
        + (nbGene > 1 ? 's' : '') + ' (écran seulement)</span>' : '')
      + '</div>'
      + '<div class="pied">MOM Hub · document interne au staff · imprimé le '
      + esc(new Date().toLocaleDateString('fr-FR')) + '</div></div>';
    $('re-tableau').innerHTML = h;
  }

  function erreur(msg) {
    $('re-ecran').innerHTML = '<div class="re-erreur">' + esc(msg) + '</div>';
  }

  async function demarrer() {
    etat.evenementId = new URLSearchParams(window.location.search).get('evenement');
    if (!window.SupabaseHub || typeof SupabaseHub.listEvalsMatch !== 'function') {
      erreur('Client Supabase indisponible.');
      return;
    }
    if (!etat.evenementId) { erreur('Aucun match indiqué. Ouvre cette page depuis la page Évals match.'); return; }
    $('re-retour').href = 'eval-match.html?evenement=' + encodeURIComponent(etat.evenementId);
    // v1.1 : référentiel des critères (repli sur les 6 libellés s'il manque).
    if (CE) {
      await CE.charger();
      var l = CE.criteres();
      if (l.length) CRITERES = l;
    }
    if (!(await charger())) return;
    rendre();
    $('re-imprimer').addEventListener('click', function () { window.print(); });
    // v1.1 : ouvrir / fermer le détail d'un joueur (écran seulement).
    $('re-tableau').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-detail]');
      if (!b) return;
      var tr = document.querySelector('tr[data-detail-de="' + b.getAttribute('data-detail') + '"]');
      if (!tr) return;
      tr.hidden = !tr.hidden;
      b.setAttribute('aria-expanded', tr.hidden ? 'false' : 'true');
    });
  }

  window.RecapEvalsMatch = { demarrer: demarrer };
})();
