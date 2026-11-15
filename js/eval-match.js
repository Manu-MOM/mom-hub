/* =====================================================================
 * eval-match.js — Saisie des évals match (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.1 — 15 novembre 2026 — EVAL-JOUEUR lot L5
 *   v1.1 : (D8) bloc « Repères du suivi » sous la saisie, en lecture seule,
 *          pour aider à rédiger : repères complets du joueur sur le match
 *          (reperes_match_joueur, sql_264 ; supabase-client v1.96). Chargé
 *          à la sélection du joueur, mis en cache ; masqué si le client est
 *          trop ancien ; « match non suivi » si aucune donnée.
 * Version : v1.0 — 15 novembre 2026 — EVAL-JOUEUR lot L3
 *   FAIT FOI Conception-EVAL-JOUEUR-v1 (gelé par Manu le 15/11/2026),
 *   socle SQL sql_263, supabase-client v1.95.
 *
 * DEUX MODES
 *   ?categorie=<id>   liste des matchs de la catégorie (saison active),
 *                     avancement publiées / brouillons → clic = un match.
 *   ?evenement=<id>   feuille du match (D9 : compo de match active, quel que
 *                     soit son état, + joueurs déjà évalués ; sans compo :
 *                     ajout depuis les joueurs de la catégorie) et saisie
 *                     de l'éval du joueur sélectionné (D7-a/b) : feu,
 *                     point fort (obligatoire pour publier, D7-f), axe de
 *                     travail, mot du coach, lien VEO + minute.
 *   Paramètres optionnels : joueur=<id> (joueur présélectionné),
 *   depuis=joueur (retour vers la page Évaluation de ce joueur).
 *
 * DROITS
 *   La RPC reste la vérité (sql_263) : un refus s'affiche tel quel.
 * ===================================================================== */
(function () {
  'use strict';

  var FEUX_MATCH = [
    { v: 'V', libelle: 'V · Gros match' },
    { v: 'O', libelle: 'O · Dans le match' },
    { v: 'R', libelle: 'R · Match difficile' }
  ];

  var etat = {
    params: null,
    evenementId: null,
    categorieId: null,
    feuille: null,       // réponse de lister_evals_match
    joueurs: [],         // [{personne_id, nom, prenom, numero, club, eval}]
    choisi: null,        // personne_id sélectionné
    modifie: false,
    reperes: {}          // v1.1 : personne_id -> repères (ou null si non suivi)
  };

  // ------------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------------
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }
  function dateCourte(iso) {
    var s = String(iso || '').slice(0, 10).split('-');
    return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : '';
  }
  function titreMatch(m) {
    if (!m) return 'Match';
    return m.adversaire ? 'MOM – ' + m.adversaire : (m.libelle || 'Match');
  }
  function message(texte, ok) {
    var z = $('em-msg');
    if (z) z.innerHTML = texte ? '<div class="' + (ok ? 'ev-ok' : 'ev-erreur') + '">' + esc(texte) + '</div>' : '';
  }
  function erreurPage(texte, retour) {
    $('ev-page').innerHTML = '<section class="ev-bloc"><div class="ev-bloc-corps"><p class="ev-erreur">' + esc(texte)
      + '</p>' + (retour || '') + '</div></section>';
  }
  function etatJoueur(j) {
    if (!j.eval) return { cls: 'em-etat-afaire', txt: 'À faire' };
    if (j.eval.statut === 'publie') return { cls: 'em-etat-publiee', txt: 'Publiée' };
    return { cls: 'em-etat-brouillon', txt: 'Brouillon' };
  }
  function joueurChoisi() {
    for (var i = 0; i < etat.joueurs.length; i++) {
      if (etat.joueurs[i].personne_id === etat.choisi) return etat.joueurs[i];
    }
    return null;
  }
  function lienRetour() {
    var p = etat.params;
    if (p.get('depuis') === 'joueur' && p.get('joueur')) {
      return { href: 'evaluation-joueur.html?joueur=' + encodeURIComponent(p.get('joueur')), txt: '← Évaluation du joueur' };
    }
    if (etat.evenementId && etat.categorieId) {
      return { href: 'eval-match.html?categorie=' + encodeURIComponent(etat.categorieId), txt: '← Matchs de la catégorie' };
    }
    return { href: 'pilotage-categorie.html', txt: '← Pilotage de saison' };
  }
  function htmlRetour() {
    var r = lienRetour();
    return '<a class="ev-retour" href="' + esc(r.href) + '">' + esc(r.txt) + '</a>';
  }

  // ------------------------------------------------------------------
  // Mode liste : matchs d'une catégorie
  // ------------------------------------------------------------------
  async function modeListe() {
    var r = await SupabaseHub.listMatchsEval(etat.categorieId);
    if (!r.ok) {
      erreurPage(/Droit insuffisant/.test(r.error || '') ? 'Tu n’as pas accès aux matchs de cette catégorie.'
        : 'Chargement impossible : ' + (r.error || 'erreur inconnue'), htmlRetour());
      return;
    }
    var ms = Array.isArray(r.data) ? r.data : [];
    var suffixe = etat.params.get('depuis') === 'joueur' && etat.params.get('joueur')
      ? '&depuis=joueur&joueur=' + encodeURIComponent(etat.params.get('joueur')) : '';
    var corps = ms.length === 0
      ? '<div class="ev-bloc-corps"><p class="ev-note">Aucun match pour cette catégorie cette saison.</p></div>'
      : '<ul class="em-matchs">' + ms.map(function (m) {
        var avance = (m.nb_publiees || 0) + ' publiée' + (m.nb_publiees > 1 ? 's' : '')
          + (m.nb_brouillons ? ' · ' + m.nb_brouillons + ' brouillon' + (m.nb_brouillons > 1 ? 's' : '') : '');
        return '<li><a href="eval-match.html?evenement=' + encodeURIComponent(m.evenement_id) + suffixe + '">'
          + '<span class="ev-match-texte"><strong>' + esc(titreMatch(m)) + '</strong>'
          + '<span class="ev-match-meta"> · ' + esc(dateCourte(m.date)) + '</span></span>'
          + (m.niveau ? '<span class="ev-niveau">' + esc(m.niveau) + '</span>' : '')
          + '<span class="ev-match-meta">' + esc(avance) + '</span></a></li>';
      }).join('') + '</ul>';
    $('ev-page').innerHTML = htmlRetour()
      + '<div class="ev-head"><div><h1>Évals match</h1>'
      + '<p class="ev-sub">Choisis un match pour évaluer ses joueurs.</p></div></div>'
      + '<section class="ev-bloc">' + corps + '</section>';
  }

  // ------------------------------------------------------------------
  // Mode match : feuille + saisie
  // ------------------------------------------------------------------
  async function chargerFeuille() {
    var r = await SupabaseHub.listEvalsMatch(etat.evenementId);
    if (!r.ok || !r.data) {
      erreurPage(/Droit insuffisant/.test(r.error || '') ? 'Tu n’as pas accès à ce match.'
        : 'Chargement impossible : ' + (r.error || 'erreur inconnue'), htmlRetour());
      return false;
    }
    etat.feuille = r.data;
    etat.categorieId = r.data.match ? r.data.match.categorie_id : null;
    // Conserve les joueurs ajoutés localement (hors compo) pas encore enregistrés.
    var ajoutes = etat.joueurs.filter(function (j) { return j.ajoute && !j.eval; });
    etat.joueurs = (r.data.joueurs || []).slice();
    ajoutes.forEach(function (a) {
      if (!etat.joueurs.some(function (j) { return j.personne_id === a.personne_id; })) etat.joueurs.push(a);
    });
    return true;
  }

  function rendreMatch() {
    var m = etat.feuille.match || {};
    var nb = { afaire: 0, brouillon: 0, publiee: 0 };
    etat.joueurs.forEach(function (j) {
      var e = etatJoueur(j);
      if (e.cls === 'em-etat-afaire') nb.afaire++; else if (e.cls === 'em-etat-brouillon') nb.brouillon++; else nb.publiee++;
    });
    var score = (m.score_mom != null && m.score_adverse != null) ? ' · ' + m.score_mom + ' – ' + m.score_adverse : '';
    var sous = [m.niveau, dateCourte(m.date)].filter(Boolean).join(' · ') + score;

    var tete = htmlRetour()
      + '<div class="ev-head"><div><h1>' + esc(titreMatch(m)) + '</h1>'
      + '<p class="ev-sub">' + esc(sous) + '</p></div>'
      + '<div class="ev-actions"><span class="ev-note">' + nb.publiee + ' publiée(s) · ' + nb.brouillon + ' brouillon(s) · '
      + nb.afaire + ' à faire</span>'
      + '<button type="button" class="ev-btn" id="em-publier-tous"' + (nb.brouillon ? '' : ' disabled') + '>Publier tous les brouillons</button>'
      + '</div></div>';

    var liste = etat.joueurs.map(function (j) {
      var e = etatJoueur(j);
      return '<button type="button" class="em-joueur" data-joueur="' + esc(j.personne_id) + '"'
        + ' aria-current="' + (j.personne_id === etat.choisi ? 'true' : 'false') + '">'
        + '<span class="em-num">' + esc(j.numero != null ? j.numero : '') + '</span>'
        + '<span class="em-nom">' + esc((j.nom || '') + ' ' + (j.prenom || ''))
        + (j.club ? '<span class="em-club">' + esc(j.club) + '</span>' : '') + '</span>'
        + '<span class="em-etat ' + e.cls + '">' + e.txt + '</span></button>';
    }).join('');
    if (etat.joueurs.length === 0) {
      liste = '<div class="ev-bloc-corps"><p class="ev-note">Aucun joueur sur la feuille.</p></div>';
    }
    var ajout = '';
    var vivier = (etat.feuille.joueurs_categorie || []).filter(function (p) {
      return !etat.joueurs.some(function (j) { return j.personne_id === p.personne_id; });
    });
    if (!etat.feuille.avec_compo) {
      ajout = '<div class="em-ajout"><label class="ev-note" for="em-ajout-sel">Pas de compo pour ce match : ajoute les joueurs.</label>'
        + '<select id="em-ajout-sel"><option value="">Choisir un joueur…</option>'
        + vivier.map(function (p) {
          return '<option value="' + esc(p.personne_id) + '">' + esc((p.nom || '') + ' ' + (p.prenom || '')
            + (p.club ? ' (' + p.club + ')' : '')) + '</option>';
        }).join('')
        + '</select><button type="button" class="ev-btn" id="em-ajout-btn">Ajouter</button></div>';
    }
    var feuille = '<aside class="ev-bloc em-feuille">'
      + '<div class="ev-periode-tete"><h2>Feuille de match</h2></div>' + liste + ajout + '</aside>';

    $('ev-page').innerHTML = tete + '<div id="em-msg" aria-live="polite"></div>'
      + '<div class="em-grille">' + feuille + '<section class="em-saisie" id="em-saisie">' + rendreSaisie() + '</section></div>';
    afficherReperes();
  }

  // ------------------------------------------------------------------
  // v1.1 (L5, D8) — repères du suivi (lecture seule, aide à la rédaction)
  // ------------------------------------------------------------------
  function texteReperes(r) {
    if (!r) return null;
    var c = r.cartons || {};
    var buteur = [];
    if (r.transformations || r.transformations_ratees) buteur.push('transfo ' + r.transformations + '/' + (r.transformations + (r.transformations_ratees || 0)));
    if (r.penalites || r.penalites_ratees) buteur.push('pénalités ' + r.penalites + '/' + (r.penalites + (r.penalites_ratees || 0)));
    if (r.drops) buteur.push('drops ' + r.drops);
    var positifs = [
      r.points ? r.points + ' pt' + (r.points > 1 ? 's' : '') : null,
      r.essais ? r.essais + ' essai' + (r.essais > 1 ? 's' : '') : null,
      buteur.length ? buteur.join(', ') : null,
      r.pied_tentes ? 'jeu au pied ' + r.pied_reussis + ' réussi' + (r.pied_reussis > 1 ? 's' : '') + ' / ' + r.pied_tentes : null
    ].filter(Boolean);
    var actions = (r.actions || []).map(function (a) { return a.libelle + (a.nombre > 1 ? ' ×' + a.nombre : ''); });
    var cartons = ['blanc', 'jaune', 'rouge'].filter(function (k) { return c[k]; })
      .map(function (k) { return c[k] + ' ' + k; });
    var vigilance = [
      r.fautes ? r.fautes + ' faute' + (r.fautes > 1 ? 's' : '') : null,
      r.en_avant ? r.en_avant + ' en-avant' : null,
      r.passe_avant ? r.passe_avant + ' passe' + (r.passe_avant > 1 ? 's' : '') + ' en avant' : null,
      cartons.length ? 'carton' + (cartons.length > 1 ? 's' : '') + ' : ' + cartons.join(', ') : null
    ].filter(Boolean);
    return { positifs: positifs, actions: actions, vigilance: vigilance };
  }

  function rendreReperes(r) {
    var z = $('em-reperes');
    if (!z) return;
    var t = texteReperes(r);
    var corps;
    if (!t) {
      corps = '<p style="margin:.25rem 0 0">Match non suivi : pas de repères.</p>';
    } else {
      corps = '<p style="margin:.25rem 0 0"><strong>Positif :</strong> ' + esc(t.positifs.length ? t.positifs.join(' · ') : 'rien de noté au suivi') + '</p>'
        + (t.actions.length ? '<p style="margin:.25rem 0 0"><strong>Actions marquantes :</strong> ' + esc(t.actions.join(' · ')) + '</p>' : '')
        + (t.vigilance.length ? '<p style="margin:.25rem 0 0"><strong>À surveiller :</strong> ' + esc(t.vigilance.join(' · ')) + '</p>' : '');
    }
    z.innerHTML = '<div class="ev-bloc" style="margin:0;border-style:dashed"><div class="ev-bloc-corps" style="font-size:.88rem">'
      + '<span class="ev-lien-titre">Repères du suivi · visibles du staff seulement</span>' + corps
      + '<p class="ev-note" style="margin:.35rem 0 0">Le joueur ne verra que les repères positifs.</p></div></div>';
  }

  async function afficherReperes() {
    var pid = etat.choisi;
    if (!pid || !window.SupabaseHub || typeof SupabaseHub.reperesMatchJoueur !== 'function') return;
    if (Object.prototype.hasOwnProperty.call(etat.reperes, pid)) { rendreReperes(etat.reperes[pid]); return; }
    var r = await SupabaseHub.reperesMatchJoueur(etat.evenementId, pid);
    if (!r.ok) return; // repères facultatifs : en cas d'erreur, rien n'est affiché
    etat.reperes[pid] = r.data || null;
    if (etat.choisi === pid) rendreReperes(etat.reperes[pid]);
  }

  function rendreSaisie() {
    var j = joueurChoisi();
    if (!j) {
      return '<div class="ev-bloc"><div class="ev-bloc-corps"><p class="ev-note">Choisis un joueur dans la feuille de match.</p></div></div>';
    }
    var e = j.eval || {};
    var badge = !j.eval ? '<span class="ev-badge ev-badge-vide">Pas encore évalué</span>'
      : (e.statut === 'publie' ? '<span class="ev-badge ev-badge-publie">Publiée</span>'
        : '<span class="ev-badge ev-badge-brouillon">Brouillon · invisible pour le joueur</span>');
    var feux = FEUX_MATCH.map(function (f) {
      return '<button type="button" class="ev-feu ev-feu-' + f.v + '" data-feu="' + f.v + '" aria-pressed="'
        + (e.feu === f.v ? 'true' : 'false') + '">' + esc(f.libelle) + '</button>';
    }).join('');
    var actions;
    if (j.eval && e.statut === 'publie') {
      actions = '<button type="button" class="ev-btn ev-btn-discret" data-action="depublier">Dépublier</button>'
        + '<button type="button" class="ev-btn" data-action="enregistrer">Enregistrer</button>';
    } else {
      actions = (j.eval ? '<button type="button" class="ev-btn ev-btn-danger" data-action="supprimer">Supprimer le brouillon</button>' : '')
        + '<button type="button" class="ev-btn" data-action="enregistrer">Enregistrer</button>'
        + '<button type="button" class="ev-btn ev-btn-primaire" data-action="publier">Publier au joueur</button>';
    }
    actions += '<button type="button" class="ev-btn" data-action="suivant">Joueur suivant →</button>';
    var reponse = e.reponse_joueur
      ? '<div class="ev-reponse"><div class="ev-reponse-titre">Réponse du joueur</div><p>' + esc(e.reponse_joueur) + '</p></div>' : '';
    var info = j.eval
      ? (e.redige_par_nom ? 'Rédigé par ' + e.redige_par_nom : '')
      : 'Rien d’enregistré pour ce joueur.';

    return '<div class="ev-bloc">'
      + '<div class="ev-periode-tete"><h2>' + esc((j.numero != null ? 'N° ' + j.numero + ' · ' : '') + (j.nom || '') + ' ' + (j.prenom || '')) + '</h2>' + badge + '</div>'
      + '<div class="ev-bloc-corps" style="display:flex;flex-direction:column;gap:1rem">'
      + '<div><div class="ev-champ" id="em-feu-label">Feu du match</div>'
      + '<div class="em-feux-match" role="group" aria-labelledby="em-feu-label">' + feux + '</div></div>'
      + '<div class="em-deux">'
      + '<label class="ev-champ em-pf">Ton point fort du match <span class="em-aide">Obligatoire pour publier — toujours au moins un positif</span>'
      + '<textarea id="em-point-fort" rows="3">' + esc(e.point_fort || '') + '</textarea></label>'
      + '<label class="ev-champ em-axe">Ton axe de travail <span class="em-aide">Un seul, concret</span>'
      + '<textarea id="em-axe" rows="3">' + esc(e.axe_travail || '') + '</textarea></label>'
      + '</div>'
      + '<label class="ev-champ">Le mot du coach <span class="em-aide">Facultatif</span>'
      + '<textarea id="em-mot" rows="2">' + esc(e.mot_coach || '') + '</textarea></label>'
      + '<div class="em-veo">'
      + '<label class="ev-champ">Revoir ton action — lien VEO <span class="em-aide">Facultatif, commence par https://</span>'
      + '<input type="url" id="em-veo-url" inputmode="url" placeholder="https://…" value="' + esc(e.veo_url || '') + '"></label>'
      + '<label class="ev-champ">À la minute<input type="text" id="em-veo-minute" maxlength="10" placeholder="24:10" value="' + esc(e.veo_minute || '') + '"></label>'
      + '</div>' + reponse
      + '<div id="em-reperes" aria-live="polite"></div>'
      + '</div>'
      + '<div class="ev-pied"><span class="ev-pied-info" id="em-info">' + esc(info) + '</span>'
      + '<div class="ev-actions">' + actions + '</div></div></div>';
  }

  function lireSaisie() {
    var actif = document.querySelector('#em-saisie .ev-feu[aria-pressed="true"]');
    return {
      personne_id: etat.choisi,
      evenement_id: etat.evenementId,
      feu: actif ? actif.getAttribute('data-feu') : null,
      point_fort: $('em-point-fort').value.trim(),
      axe_travail: $('em-axe').value.trim(),
      mot_coach: $('em-mot').value.trim(),
      veo_url: $('em-veo-url').value.trim(),
      veo_minute: $('em-veo-minute').value.trim()
    };
  }

  function majEval(nouvelle) {
    var j = joueurChoisi();
    if (j) j.eval = nouvelle;
  }

  function choisir(personneId) {
    etat.choisi = personneId;
    etat.modifie = false;
    rendreMatch();
  }

  async function enregistrer() {
    var r = await SupabaseHub.saveEvalMatch(lireSaisie());
    if (!r.ok) { message(r.error); return false; }
    majEval(r.data);
    etat.modifie = false;
    return true;
  }

  async function agir(action, bouton) {
    message('');
    var j = joueurChoisi();
    if (!j) return;
    bouton.disabled = true;
    try {
      if (action === 'enregistrer') {
        if (await enregistrer()) { rendreMatch(); message('Enregistré.', true); }
      } else if (action === 'publier') {
        var s = lireSaisie();
        if (!s.feu || !s.point_fort) { message('Le feu et le point fort sont obligatoires pour publier.'); return; }
        if (etat.modifie || !j.eval) { if (!(await enregistrer())) return; }
        var rp = await SupabaseHub.statutEvalMatch(j.eval.id, 'publier');
        if (!rp.ok) { message(rp.error); return; }
        majEval(rp.data);
        rendreMatch();
        message('Éval publiée.', true);
      } else if (action === 'depublier') {
        if (etat.modifie) { message('Enregistre d’abord tes modifications.'); return; }
        if (!window.confirm('Dépublier cette éval ? Elle ne sera plus visible du joueur.')) return;
        var rd = await SupabaseHub.statutEvalMatch(j.eval.id, 'depublier');
        if (!rd.ok) { message(rd.error); return; }
        majEval(rd.data);
        rendreMatch();
        message('Éval repassée en brouillon.', true);
      } else if (action === 'supprimer') {
        if (!window.confirm('Supprimer ce brouillon ? Cette action est définitive.')) return;
        var rs = await SupabaseHub.statutEvalMatch(j.eval.id, 'supprimer');
        if (!rs.ok) { message(rs.error); return; }
        j.eval = null;
        etat.modifie = false;
        rendreMatch();
        message('Brouillon supprimé.', true);
      } else if (action === 'suivant') {
        // Enregistre la saisie en cours (brouillon) avant de passer au suivant.
        if (etat.modifie) { if (!(await enregistrer())) return; }
        var i = etat.joueurs.indexOf(j);
        var suivant = etat.joueurs[(i + 1) % etat.joueurs.length];
        choisir(suivant.personne_id);
      }
    } finally {
      if (document.body.contains(bouton)) bouton.disabled = false;
    }
  }

  async function publierTous(bouton) {
    message('');
    if (etat.modifie) { message('Enregistre d’abord la saisie en cours.'); return; }
    if (!window.confirm('Publier tous les brouillons complets (feu + point fort) de ce match ?')) return;
    bouton.disabled = true;
    var r = await SupabaseHub.publierBrouillonsMatch(etat.evenementId);
    if (!r.ok) { bouton.disabled = false; message(r.error); return; }
    if (await chargerFeuille()) {
      rendreMatch();
      var d = r.data || {};
      message((d.publiees || 0) + ' éval(s) publiée(s)'
        + (d.brouillons_restants ? ' · ' + d.brouillons_restants + ' brouillon(s) incomplet(s) restant(s)' : '') + '.', true);
    }
  }

  function ajouterJoueur() {
    var sel = $('em-ajout-sel');
    if (!sel || !sel.value) return;
    var p = (etat.feuille.joueurs_categorie || []).filter(function (x) { return x.personne_id === sel.value; })[0];
    if (!p) return;
    etat.joueurs.push({ personne_id: p.personne_id, nom: p.nom, prenom: p.prenom, club: p.club, numero: null, eval: null, ajoute: true });
    choisir(p.personne_id);
  }

  function brancher() {
    var page = $('ev-page');
    page.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.classList.contains('em-joueur')) {
        var cible = b.getAttribute('data-joueur');
        if (cible === etat.choisi) return;
        if (etat.modifie && !window.confirm('Saisie non enregistrée pour ce joueur. Changer quand même ?')) return;
        choisir(cible);
        return;
      }
      if (b.classList.contains('ev-feu')) {
        var actif = b.getAttribute('aria-pressed') === 'true';
        Array.prototype.forEach.call(b.parentNode.querySelectorAll('.ev-feu'), function (x) { x.setAttribute('aria-pressed', 'false'); });
        if (!actif) b.setAttribute('aria-pressed', 'true');
        marquerModifie();
        return;
      }
      var action = b.getAttribute('data-action');
      if (action) { agir(action, b); return; }
      if (b.id === 'em-publier-tous') { publierTous(b); return; }
      if (b.id === 'em-ajout-btn') { ajouterJoueur(); return; }
    });
    page.addEventListener('input', function (ev) {
      if (ev.target.closest && ev.target.closest('#em-saisie')) marquerModifie();
    });
    window.addEventListener('beforeunload', function (ev) {
      if (etat.modifie) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  function marquerModifie() {
    etat.modifie = true;
    var info = $('em-info');
    if (info) info.textContent = 'Modifications non enregistrées';
  }

  // ------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------
  async function demarrer() {
    etat.params = new URLSearchParams(window.location.search);
    etat.evenementId = etat.params.get('evenement');
    etat.categorieId = etat.params.get('categorie');
    if (!window.SupabaseHub || typeof SupabaseHub.listEvalsMatch !== 'function') {
      erreurPage('Client Supabase indisponible (version trop ancienne ?).');
      return;
    }
    if (etat.evenementId) {
      if (!(await chargerFeuille())) return;
      var pre = etat.params.get('joueur');
      etat.choisi = pre && etat.joueurs.some(function (j) { return j.personne_id === pre; })
        ? pre : (etat.joueurs[0] ? etat.joueurs[0].personne_id : null);
      rendreMatch();
      brancher();
    } else if (etat.categorieId) {
      await modeListe();
    } else {
      erreurPage('Aucun match ni catégorie indiqué. Ouvre cette page depuis le pilotage de saison ou la page Évaluation d’un joueur.',
        '<a class="ev-retour" href="pilotage-categorie.html">← Pilotage de saison</a>');
    }
  }

  window.EvalMatch = { demarrer: demarrer };
})();
