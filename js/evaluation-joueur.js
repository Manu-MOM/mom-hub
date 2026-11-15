/* =====================================================================
 * evaluation-joueur.js — Page Évaluation d'un joueur (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.0 — 15 novembre 2026 — EVAL-JOUEUR lot L2
 *   FAIT FOI Conception-EVAL-JOUEUR-v1 (gelé par Manu le 15/11/2026),
 *   socle SQL sql_263, supabase-client v1.95.
 *
 * OBJET
 *   Page staff ouverte depuis la fiche joueur
 *   (evaluation-joueur.html?joueur=<personne_id>[&depuis=fiche]) :
 *     1. lien personnel joueur & famille (D1) : créer, copier, envoyer
 *        par WhatsApp, régénérer (l'ancien est révoqué) ;
 *     2. 4 bilans de période (D5 : Pré-saison, P1 sept./déc., P2
 *        janv./mars, P3 avr./juin) × 5 critères fixes (D6) : feu V/O/R +
 *        observation, 1 à 2 objectifs (D7-c) ; brouillon → publié (D2),
 *        dépublier (D13), supprimer un brouillon ; réponse du joueur
 *        affichée (D3) ;
 *     3. évals match du joueur (lecture ; saisie au lot L3).
 *
 * DROITS
 *   La RPC reste la vérité (sql_263). Le drapeau peut_ecrire renvoyé par
 *   lister_evals_joueur ne sert qu'à masquer les commandes d'écriture.
 *
 * NOTE L2
 *   L'espace joueur (espace-joueur.html, lot L4) n'existe pas encore : le
 *   lien généré n'est utile qu'une fois L4 en ligne (message affiché).
 * ===================================================================== */
(function () {
  'use strict';

  var PERIODES = [
    { code: 'pre_saison', num: '01', titre: 'PRÉ-SAISON' },
    { code: 'p1', num: '02', titre: 'PÉRIODE 1 — SEPTEMBRE / DÉCEMBRE' },
    { code: 'p2', num: '03', titre: 'PÉRIODE 2 — JANVIER / MARS' },
    { code: 'p3', num: '04', titre: 'PÉRIODE 3 — AVRIL / JUIN' }
  ];
  var CRITERES = [
    { cle: 'tech_indiv', nom: 'Niveau technique individuel' },
    { cle: 'physique', nom: 'Niveau physique' },
    { cle: 'tech_poste', nom: 'Niveau technique au poste' },
    { cle: 'comprehension', nom: 'Compréhension du jeu' },
    { cle: 'etat_esprit', nom: "État d'esprit" }
  ];
  var FEUX = [
    { v: 'V', titre: 'Vert — acquis' },
    { v: 'O', titre: 'Orange — en progrès' },
    { v: 'R', titre: 'Rouge — à travailler' }
  ];
  // L4 : page publique de l'espace joueur (jeton dans ?t=).
  var PAGE_ESPACE = 'espace-joueur.html';

  var etat = {
    joueurId: null,
    dossier: null,     // réponse de lister_evals_joueur
    modifies: {}       // periode -> true si saisie non enregistrée
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
  function dateFr(iso, avecHeure) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var opts = avecHeure
      ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return d.toLocaleString('fr-FR', opts);
  }
  function dateCourte(iso) {
    var s = String(iso || '').slice(0, 10).split('-');
    return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : '';
  }
  function bilanDe(periode) {
    var b = etat.dossier && Array.isArray(etat.dossier.bilans) ? etat.dossier.bilans : [];
    for (var i = 0; i < b.length; i++) { if (b[i].periode === periode) return b[i]; }
    return null;
  }
  function peutEcrire() { return !!(etat.dossier && etat.dossier.peut_ecrire); }
  function lienEspace(token) {
    var base = window.location.href.split('?')[0].split('#')[0];
    base = base.substring(0, base.lastIndexOf('/') + 1);
    return base + PAGE_ESPACE + '?t=' + encodeURIComponent(token);
  }
  function message(zoneId, texte, ok) {
    var z = $(zoneId);
    if (!z) return;
    z.innerHTML = texte ? '<div class="' + (ok ? 'ev-ok' : 'ev-erreur') + '">' + esc(texte) + '</div>' : '';
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------
  function rendre() {
    var d = etat.dossier;
    var j = d.joueur || {};
    var params = new URLSearchParams(window.location.search);
    var depuisFiche = params.get('depuis') === 'fiche';
    var retourHref = depuisFiche ? 'joueurs.html?fiche=' + encodeURIComponent(etat.joueurId) : 'joueurs.html';
    var retourTxt = depuisFiche ? '← Retour à la fiche joueur' : '← Joueurs';
    var sousTitre = [j.categorie_code, j.annee_naissance ? 'Né(e) en ' + j.annee_naissance : null, j.club,
      d.saison && d.saison.code ? 'Saison ' + d.saison.code : null].filter(Boolean).join(' · ');

    var html = ''
      + '<a class="ev-retour" href="' + esc(retourHref) + '">' + esc(retourTxt) + '</a>'
      + '<div class="ev-head"><div>'
      + '<h1>' + esc((j.nom || '') + ' ' + (j.prenom || '')) + ' · Évaluation</h1>'
      + '<p class="ev-sub">' + esc(sousTitre) + '</p></div>'
      + '<div class="ev-actions"><button type="button" class="ev-btn ev-btn-discret" id="ev-imprimer">Imprimer</button></div>'
      + '</div>'
      + rendreLien()
      + rendreSynthese()
      + PERIODES.map(rendrePeriode).join('')
      + rendreMatchs();
    $('ev-page').innerHTML = html;
    brancher();
  }

  function rendreLien() {
    if (!peutEcrire()) return '';
    var l = etat.dossier.lien;
    var etatTxt = l
      ? 'Lien actif depuis le ' + dateFr(l.date_creation) + ' · '
        + (l.derniere_consultation ? 'dernière consultation le ' + dateFr(l.derniere_consultation, true) : 'jamais consulté')
      : 'Aucun lien créé pour ce joueur.';
    var boutons = l
      ? '<button type="button" class="ev-btn ev-btn-primaire" id="ev-lien-copier">Copier le lien</button>'
        + '<button type="button" class="ev-btn" id="ev-lien-whatsapp">Envoyer par WhatsApp</button>'
        + '<button type="button" class="ev-btn ev-btn-discret" id="ev-lien-regenerer">Régénérer</button>'
      : '<button type="button" class="ev-btn ev-btn-primaire" id="ev-lien-creer">Créer le lien</button>';
    return '<section class="ev-bloc" id="ev-bloc-lien"><div class="ev-bloc-corps">'
      + '<div class="ev-lien"><div>'
      + '<div class="ev-lien-titre">Lien joueur &amp; famille</div>'
      + '<div class="ev-lien-etat">' + esc(etatTxt) + '</div>'
      + '<div class="ev-note">Le joueur et sa famille ne voient que les évaluations publiées. '
      + 'L’espace joueur sera en ligne au lot L4 : n’envoie pas encore le lien.</div>'
      + '</div><div class="ev-actions">' + boutons + '</div></div>'
      + '<div id="ev-lien-msg" aria-live="polite"></div>'
      + '</div></section>';
  }

  function rendreSynthese() {
    var bilans = etat.dossier.bilans || [];
    var nbCriteres = 0, nbPublies = 0, nbReponses = 0;
    bilans.forEach(function (b) {
      CRITERES.forEach(function (c) { if (b.feux && b.feux[c.cle]) nbCriteres++; });
      if (b.statut === 'publie') nbPublies++;
      if (b.reponse_joueur) nbReponses++;
    });
    (etat.dossier.matchs || []).forEach(function (m) { if (m.reponse_joueur) nbReponses++; });
    var total = PERIODES.length * CRITERES.length;
    return '<section class="ev-bloc"><div class="ev-bloc-corps ev-lien">'
      + '<div class="ev-kpis">'
      + '<div><div class="ev-kpi-v">' + nbCriteres + ' / ' + total + '</div><div class="ev-kpi-l">critères évalués</div></div>'
      + '<div><div class="ev-kpi-v">' + nbPublies + '</div><div class="ev-kpi-l">bilan' + (nbPublies > 1 ? 's' : '') + ' publié' + (nbPublies > 1 ? 's' : '') + '</div></div>'
      + '<div><div class="ev-kpi-v">' + nbReponses + '</div><div class="ev-kpi-l">réponse' + (nbReponses > 1 ? 's' : '') + ' du joueur</div></div>'
      + '</div>'
      + '<p class="ev-legende"><strong>V</strong> acquis · <strong>O</strong> en progrès · <strong>R</strong> à travailler. '
      + 'Le joueur ne voit que ce qui est <strong>publié</strong>.</p>'
      + '</div></section>';
  }

  function rendrePeriode(p) {
    var b = bilanDe(p.code);
    var ecrire = peutEcrire();
    var badge = !b
      ? '<span class="ev-badge ev-badge-vide">Non commencé</span>'
      : (b.statut === 'publie'
        ? '<span class="ev-badge ev-badge-publie">Publié le ' + esc(dateFr(b.publie_le)) + '</span>'
        : '<span class="ev-badge ev-badge-brouillon">Brouillon · invisible pour le joueur</span>');
    var dis = ecrire ? '' : ' disabled';

    var objectifs = '<div class="ev-objectifs">'
      + [1, 2].map(function (n) {
        var v = b ? b['objectif_' + n] : '';
        return '<label class="ev-champ">Objectif ' + n + (n === 2 ? ' <span class="ev-note">(facultatif)</span>' : '')
          + '<input type="text" maxlength="200" data-periode="' + p.code + '" data-objectif="' + n + '" value="' + esc(v || '') + '"' + dis + '></label>';
      }).join('')
      + '</div>';

    var criteres = CRITERES.map(function (c) {
      var feu = b && b.feux ? b.feux[c.cle] : null;
      var obs = b && b.obs ? b.obs[c.cle] : '';
      var boutons = FEUX.map(function (f) {
        return '<button type="button" class="ev-feu ev-feu-' + f.v + '" title="' + esc(f.titre) + '"'
          + ' aria-pressed="' + (feu === f.v ? 'true' : 'false') + '"'
          + ' data-periode="' + p.code + '" data-critere="' + c.cle + '" data-feu="' + f.v + '"' + dis + '>' + f.v + '</button>';
      }).join('');
      return '<div class="ev-critere">'
        + '<span class="ev-critere-nom">' + esc(c.nom) + '</span>'
        + '<div class="ev-feux" role="group" aria-label="' + esc('Feu — ' + c.nom) + '">' + boutons + '</div>'
        + '<textarea class="ev-obs" rows="2" aria-label="' + esc('Observation — ' + c.nom) + '"'
        + ' data-periode="' + p.code + '" data-obs="' + c.cle + '"' + dis
        + ' placeholder="Observation (visible du joueur et de sa famille une fois publiée)">' + esc(obs || '') + '</textarea>'
        + '</div>';
    }).join('');

    var reponse = b && b.reponse_joueur
      ? '<div class="ev-reponse"><div class="ev-reponse-titre">Réponse du joueur'
        + (b.reponse_le ? ' · ' + esc(dateFr(b.reponse_le, true)) : '') + '</div><p>' + esc(b.reponse_joueur) + '</p></div>'
      : '';

    var info = b
      ? (b.redige_par_nom ? 'Rédigé par ' + b.redige_par_nom : '')
        + (b.updated_at ? (b.redige_par_nom ? ' · ' : '') + 'modifié le ' + dateFr(b.updated_at, true) : '')
      : 'Rien d’enregistré pour cette période.';
    var pied = '';
    if (ecrire) {
      var actions = '<button type="button" class="ev-btn" data-action="enregistrer" data-periode="' + p.code + '">Enregistrer</button>';
      if (b && b.statut === 'publie') {
        actions = '<button type="button" class="ev-btn ev-btn-discret" data-action="depublier" data-periode="' + p.code + '">Dépublier</button>'
          + '<button type="button" class="ev-btn ev-btn-primaire" data-action="enregistrer" data-periode="' + p.code + '">Enregistrer</button>';
      } else {
        if (b) actions = '<button type="button" class="ev-btn ev-btn-danger" data-action="supprimer" data-periode="' + p.code + '">Supprimer le brouillon</button>' + actions;
        actions += '<button type="button" class="ev-btn ev-btn-primaire" data-action="publier" data-periode="' + p.code + '">Publier au joueur</button>';
      }
      pied = '<div class="ev-pied"><span class="ev-pied-info" id="ev-info-' + p.code + '">' + esc(info) + '</span>'
        + '<div class="ev-actions">' + actions + '</div></div>';
    } else if (b) {
      pied = '<div class="ev-pied"><span class="ev-pied-info">' + esc(info) + '</span></div>';
    }

    return '<section class="ev-bloc" id="ev-periode-' + p.code + '">'
      + '<div class="ev-periode-tete"><h2><span class="ev-num">' + p.num + '</span>' + esc(p.titre) + '</h2>' + badge + '</div>'
      + '<div class="ev-bloc-corps">' + objectifs + criteres + reponse
      + '<div id="ev-msg-' + p.code + '" aria-live="polite"></div></div>'
      + pied + '</section>';
  }

  function rendreMatchs() {
    var ms = etat.dossier.matchs || [];
    var corps;
    if (ms.length === 0) {
      corps = '<p class="ev-note">Aucune éval match pour ce joueur cette saison. La saisie match par match arrive au lot L3.</p>';
    } else {
      corps = '<ul class="ev-matchs">' + ms.map(function (m) {
        var x = m.match || {};
        var titre = x.adversaire ? 'vs ' + x.adversaire : (x.libelle || 'Match');
        var pastille = m.feu
          ? '<span class="ev-pastille ev-pastille-' + esc(m.feu) + '">' + esc(m.feu) + '</span>'
          : '<span class="ev-pastille ev-pastille-vide">·</span>';
        var statut = m.statut === 'publie'
          ? '<span class="ev-badge ev-badge-publie">Publiée</span>'
          : '<span class="ev-badge ev-badge-brouillon">Brouillon</span>';
        return '<li>' + pastille
          + '<div class="ev-match-texte"><strong>' + esc(titre) + '</strong>'
          + '<div class="ev-match-meta">' + esc(dateCourte(x.date))
          + (m.point_fort ? ' · Point fort : ' + esc(m.point_fort) : '') + '</div>'
          + (m.reponse_joueur ? '<div class="ev-match-meta">Réponse du joueur : ' + esc(m.reponse_joueur) + '</div>' : '')
          + '</div>'
          + (x.niveau ? '<span class="ev-niveau">' + esc(x.niveau) + '</span>' : '')
          + statut + '</li>';
      }).join('') + '</ul>';
    }
    return '<section class="ev-bloc"><div class="ev-bloc-corps">'
      + '<h2 class="ev-titre-section">Évals match</h2>' + corps + '</div></section>';
  }

  // ------------------------------------------------------------------
  // Interactions
  // ------------------------------------------------------------------
  function brancher() {
    var imp = $('ev-imprimer');
    if (imp) imp.addEventListener('click', function () { window.print(); });

    var page = $('ev-page');
    page.addEventListener('click', function (ev) {
      var cible = ev.target.closest('button');
      if (!cible || cible.disabled) return;
      if (cible.classList.contains('ev-feu')) { basculerFeu(cible); return; }
      var action = cible.getAttribute('data-action');
      if (action) { agirPeriode(action, cible.getAttribute('data-periode'), cible); return; }
      if (cible.id === 'ev-lien-creer') { genererLien(false); return; }
      if (cible.id === 'ev-lien-regenerer') { genererLien(true); return; }
      if (cible.id === 'ev-lien-copier') { copierLien(); return; }
      if (cible.id === 'ev-lien-whatsapp') { envoyerWhatsApp(); return; }
    });
    page.addEventListener('input', function (ev) {
      var p = ev.target && ev.target.getAttribute('data-periode');
      if (p) marquerModifie(p);
    });
  }

  function marquerModifie(periode) {
    etat.modifies[periode] = true;
    var info = $('ev-info-' + periode);
    if (info) info.textContent = 'Modifications non enregistrées';
  }

  function basculerFeu(btn) {
    var periode = btn.getAttribute('data-periode');
    var groupe = btn.parentNode.querySelectorAll('.ev-feu');
    var dejaActif = btn.getAttribute('aria-pressed') === 'true';
    Array.prototype.forEach.call(groupe, function (b) { b.setAttribute('aria-pressed', 'false'); });
    if (!dejaActif) btn.setAttribute('aria-pressed', 'true'); // re-clic = effacer le feu
    marquerModifie(periode);
  }

  function lireFormulaire(periode) {
    var sec = $('ev-periode-' + periode);
    var b = { personne_id: etat.joueurId, periode: periode, feux: {}, obs: {},
      saison_id: etat.dossier.saison ? etat.dossier.saison.id : null };
    [1, 2].forEach(function (n) {
      var el = sec.querySelector('input[data-objectif="' + n + '"]');
      b['objectif_' + n] = el ? el.value.trim() : '';
    });
    CRITERES.forEach(function (c) {
      var actif = sec.querySelector('.ev-feu[data-critere="' + c.cle + '"][aria-pressed="true"]');
      b.feux[c.cle] = actif ? actif.getAttribute('data-feu') : null;
      var obs = sec.querySelector('textarea[data-obs="' + c.cle + '"]');
      b.obs[c.cle] = obs ? obs.value.trim() : '';
    });
    return b;
  }

  async function agirPeriode(action, periode, bouton) {
    var zone = 'ev-msg-' + periode;
    message(zone, '');
    var boutons = $('ev-periode-' + periode).querySelectorAll('.ev-pied button');
    Array.prototype.forEach.call(boutons, function (b) { b.disabled = true; });
    try {
      if (action === 'enregistrer' || action === 'publier') {
        // Publier enregistre d'abord la saisie en cours.
        if (action === 'enregistrer' || etat.modifies[periode] || !bilanDe(periode)) {
          var r = await SupabaseHub.saveEvalBilan(lireFormulaire(periode));
          if (!r.ok) { message(zone, r.error); return; }
          delete etat.modifies[periode];
          remplacerBilan(r.data);
        }
        if (action === 'publier') {
          var b = bilanDe(periode);
          if (!window.confirm('Publier ce bilan ? Le joueur et sa famille pourront le lire.')) { rendre(); return; }
          var rp = await SupabaseHub.statutEvalBilan(b.id, 'publier');
          if (!rp.ok) { rendre(); message(zone, rp.error); return; }
          remplacerBilan(rp.data);
        }
        rendre();
        message(zone, action === 'publier' ? 'Bilan publié.' : 'Enregistré.', true);
      } else if (action === 'depublier') {
        if (etat.modifies[periode]) {
          message(zone, 'Enregistre d’abord tes modifications.');
          return;
        }
        if (!window.confirm('Dépublier ce bilan ? Il ne sera plus visible du joueur.')) return;
        var rd = await SupabaseHub.statutEvalBilan(bilanDe(periode).id, 'depublier');
        if (!rd.ok) { message(zone, rd.error); return; }
        remplacerBilan(rd.data);
        rendre();
        message('ev-msg-' + periode, 'Bilan repassé en brouillon.', true);
      } else if (action === 'supprimer') {
        if (!window.confirm('Supprimer ce brouillon ? Cette action est définitive.')) return;
        var rs = await SupabaseHub.statutEvalBilan(bilanDe(periode).id, 'supprimer');
        if (!rs.ok) { message(zone, rs.error); return; }
        etat.dossier.bilans = (etat.dossier.bilans || []).filter(function (x) { return x.periode !== periode; });
        delete etat.modifies[periode];
        rendre();
        message('ev-msg-' + periode, 'Brouillon supprimé.', true);
      }
    } finally {
      var sec = $('ev-periode-' + periode);
      if (sec && sec.contains(bouton)) {
        Array.prototype.forEach.call(sec.querySelectorAll('.ev-pied button'), function (b) { b.disabled = false; });
      }
    }
  }

  function remplacerBilan(nouveau) {
    if (!nouveau || !nouveau.periode) return;
    var liste = (etat.dossier.bilans || []).filter(function (x) { return x.periode !== nouveau.periode; });
    liste.push(nouveau);
    etat.dossier.bilans = liste;
  }

  // ------------------------------------------------------------------
  // Lien personnel (D1)
  // ------------------------------------------------------------------
  async function genererLien(regenerer) {
    if (regenerer && !window.confirm('Régénérer le lien ? L’ancien lien ne fonctionnera plus : il faudra renvoyer le nouveau au joueur.')) return;
    message('ev-lien-msg', '');
    var r = await SupabaseHub.genererLienEspaceJoueur(etat.joueurId);
    if (!r.ok) { message('ev-lien-msg', r.error); return; }
    etat.dossier.lien = { actif: true, date_creation: r.data.date_creation, derniere_consultation: null };
    rendre();
    message('ev-lien-msg', regenerer ? 'Nouveau lien créé. L’ancien ne fonctionne plus.' : 'Lien créé.', true);
  }

  async function lireJeton() {
    var r = await SupabaseHub.getLienEspaceJoueur(etat.joueurId);
    if (!r.ok) { message('ev-lien-msg', r.error); return null; }
    if (!r.data || !r.data.token) { message('ev-lien-msg', 'Aucun lien actif.'); return null; }
    return r.data.token;
  }

  async function copierLien() {
    message('ev-lien-msg', '');
    var jeton = await lireJeton();
    if (!jeton) return;
    var url = lienEspace(jeton);
    try {
      await navigator.clipboard.writeText(url);
      message('ev-lien-msg', 'Lien copié dans le presse-papiers.', true);
    } catch (_) {
      // Repli : afficher le lien à copier à la main.
      var z = $('ev-lien-msg');
      z.innerHTML = '<div class="ev-ok">Copie automatique impossible. Lien à copier :</div>'
        + '<input type="text" readonly class="ev-obs" id="ev-lien-brut" value="' + esc(url) + '">';
      var champ = $('ev-lien-brut');
      if (champ) { champ.focus(); champ.select(); }
    }
  }

  async function envoyerWhatsApp() {
    message('ev-lien-msg', '');
    var jeton = await lireJeton();
    if (!jeton) return;
    var j = etat.dossier.joueur || {};
    var texte = 'Bonjour ' + (j.prenom || '') + ', voici ton espace joueur MOM pour suivre tes évaluations : '
      + lienEspace(jeton) + ' (lien personnel, à garder pour toi et ta famille).';
    window.open('https://wa.me/?text=' + encodeURIComponent(texte), '_blank', 'noopener');
  }

  // ------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------
  async function demarrer() {
    var params = new URLSearchParams(window.location.search);
    etat.joueurId = params.get('joueur');
    var page = $('ev-page');
    if (!etat.joueurId) {
      page.innerHTML = '<section class="ev-bloc"><div class="ev-bloc-corps"><p class="ev-erreur">Aucun joueur indiqué. '
        + 'Ouvre cette page depuis la fiche d’un joueur.</p><a class="ev-retour" href="joueurs.html">← Joueurs</a></div></section>';
      return;
    }
    if (!window.SupabaseHub || typeof SupabaseHub.listEvalsJoueur !== 'function') {
      page.innerHTML = '<section class="ev-bloc"><div class="ev-bloc-corps"><p class="ev-erreur">Client Supabase indisponible (version trop ancienne ?).</p></div></section>';
      return;
    }
    var r = await SupabaseHub.listEvalsJoueur(etat.joueurId);
    if (!r.ok || !r.data) {
      page.innerHTML = '<section class="ev-bloc"><div class="ev-bloc-corps"><p class="ev-erreur">'
        + esc(r.error && /Droit insuffisant/.test(r.error)
          ? 'Tu n’as pas accès aux évaluations de ce joueur.'
          : 'Chargement impossible : ' + (r.error || 'erreur inconnue'))
        + '</p><a class="ev-retour" href="joueurs.html">← Joueurs</a></div></section>';
      return;
    }
    etat.dossier = r.data;
    rendre();
    window.addEventListener('beforeunload', function (ev) {
      if (Object.keys(etat.modifies).length > 0) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  window.EvaluationJoueur = { demarrer: demarrer };
})();
