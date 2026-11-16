/* =====================================================================
 * eval-match.js — Saisie des évals match (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.4 — 16 novembre 2026 — EVAL-JOUEUR D28 (retour terrain,
 *   choix de Manu : 1 lien VEO du match + jusqu'à 5 moments)
 *   v1.4 : « Revoir tes actions » : lien VEO du match + 5 lignes fixes
 *          (minute 10 car. + libellé facultatif 60 car.) ; lignes vides
 *          ignorées. Envoi veo_moments (supabase-client v1.98, sql_267).
 * Version : v1.3 — 16 novembre 2026 — EVAL-JOUEUR Avenant A (retour
 *   recette de Manu : « obtenir le lien depuis l'éval match »)
 *   v1.3 : bloc « Lien joueur & famille » sous la saisie : Copier le lien,
 *          Envoyer par WhatsApp (message adapté : si l'éval est publiée et
 *          verrouillée, invite à donner son avis d'abord), ou Créer le lien
 *          s'il n'existe pas. Mêmes RPC que la page Évaluation joueur
 *          (get_lien_espace_joueur / generer_lien_espace_joueur), mêmes
 *          droits. La régénération reste sur la page Évaluation joueur.
 * Version : v1.2 — 16 novembre 2026 — EVAL-JOUEUR Avenant A, lot A2
 *   FAIT FOI §9 (D16–D27), sql_265 + sql_266, supabase-client v1.97.
 *   v1.2 : (D17) 5 critères V/O/R FACULTATIFS dans la saisie (re-clic =
 *          effacer), publication inchangée (feu + point fort).
 *          (D23) avis du joueur affiché à côté de chaque critère quand il
 *          a envoyé son auto-évaluation, + son mot ; sinon « pas encore ».
 *          (D19) rappel : l'éval publiée ne s'ouvre au joueur qu'après son
 *          auto-évaluation (évals antérieures à l'avenant : libres, D22).
 *          (D24–D26) signalement blessure / gêne / fatigue : badge ⚠ sur
 *          la feuille, compteur en tête, encart rouge avec le texte du
 *          joueur, blessures en cours (lecture), bouton « Créer une
 *          blessure » (saisie existante saveBlessure, préremplie). Jamais
 *          de blessure créée automatiquement.
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
 *                     travail, mot du coach, lien VEO + moments (v1.4).
 *   Paramètres optionnels : joueur=<id> (joueur présélectionné),
 *   depuis=joueur (retour vers la page Évaluation de ce joueur).
 *
 * DROITS
 *   La RPC reste la vérité (sql_263) : un refus s'affiche tel quel.
 * ===================================================================== */
(function () {
  'use strict';

  // Avenant A (D16/D17) : les 5 critères des bilans (mêmes libellés, D6).
  var CRITERES = [
    { cle: 'tech_indiv', nom: 'Niveau technique individuel' },
    { cle: 'physique', nom: 'Niveau physique' },
    { cle: 'tech_poste', nom: 'Niveau technique au poste' },
    { cle: 'comprehension', nom: 'Compréhension du jeu' },
    { cle: 'etat_esprit', nom: "État d'esprit" }
  ];
  var FEUX_CRITERE = [
    { v: 'V', titre: 'Vert — acquis' },
    { v: 'O', titre: 'Orange — en progrès' },
    { v: 'R', titre: 'Rouge — à travailler' }
  ];

  var FEUX_MATCH = [
    { v: 'V', libelle: 'V · Gros match' },
    { v: 'O', libelle: 'O · Dans le match' },
    { v: 'R', libelle: 'R · Match difficile' }
  ];

  // v1.3 : page publique de l'espace joueur (jeton dans ?t=), comme evaluation-joueur.js.
  var PAGE_ESPACE = 'espace-joueur.html';
  var NB_MOMENTS = 5;   // v1.4 (D28)

  var etat = {
    params: null,
    evenementId: null,
    categorieId: null,
    feuille: null,       // réponse de lister_evals_match
    joueurs: [],         // [{personne_id, nom, prenom, numero, club, eval}]
    choisi: null,        // personne_id sélectionné
    modifie: false,
    reperes: {},         // v1.1 : personne_id -> repères (ou null si non suivi)
    blessures: {},       // v1.2 : personne_id -> blessures en cours (D26), ou null si refus
    formBlessure: false, // v1.2 : formulaire « Créer une blessure » ouvert
    liens: {}            // v1.3 : personne_id -> jeton | null (pas de lien) ; absent = inconnu
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
  // v1.2 (D24) : le joueur a-t-il signalé une blessure / gêne / fatigue ?
  function aSignale(j) {
    return !!(j && j.auto_eval && j.auto_eval.gene && j.auto_eval.gene.signalee);
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
    var nbSignal = 0, nbAuto = 0;
    etat.joueurs.forEach(function (j) {
      var e = etatJoueur(j);
      if (e.cls === 'em-etat-afaire') nb.afaire++; else if (e.cls === 'em-etat-brouillon') nb.brouillon++; else nb.publiee++;
      if (j.auto_eval) nbAuto++;
      if (aSignale(j)) nbSignal++;
    });
    var score = (m.score_mom != null && m.score_adverse != null) ? ' · ' + m.score_mom + ' – ' + m.score_adverse : '';
    var sous = [m.niveau, dateCourte(m.date)].filter(Boolean).join(' · ') + score;

    var tete = htmlRetour()
      + '<div class="ev-head"><div><h1>' + esc(titreMatch(m)) + '</h1>'
      + '<p class="ev-sub">' + esc(sous) + '</p></div>'
      + '<div class="ev-actions"><span class="ev-note">' + nb.publiee + ' publiée(s) · ' + nb.brouillon + ' brouillon(s) · '
      + nb.afaire + ' à faire · ' + nbAuto + ' auto-éval' + (nbAuto > 1 ? 's' : '') + '</span>'
      + (nbSignal ? '<span class="em-badge-gene">⚠ ' + nbSignal + ' signalement' + (nbSignal > 1 ? 's' : '') + '</span>' : '')
      + '<button type="button" class="ev-btn" id="em-publier-tous"' + (nb.brouillon ? '' : ' disabled') + '>Publier tous les brouillons</button>'
      + '</div></div>';

    var liste = etat.joueurs.map(function (j) {
      var e = etatJoueur(j);
      return '<button type="button" class="em-joueur" data-joueur="' + esc(j.personne_id) + '"'
        + ' aria-current="' + (j.personne_id === etat.choisi ? 'true' : 'false') + '">'
        + '<span class="em-num">' + esc(j.numero != null ? j.numero : '') + '</span>'
        + '<span class="em-nom">' + esc((j.nom || '') + ' ' + (j.prenom || ''))
        + (j.club ? '<span class="em-club">' + esc(j.club) + '</span>' : '') + '</span>'
        + (aSignale(j) ? '<span class="em-badge-gene" title="Blessure, gêne ou fatigue signalée par le joueur">⚠</span>' : '')
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
    afficherBlessures();
    afficherLien();
  }

  // ------------------------------------------------------------------
  // v1.3 — lien personnel du joueur depuis l'éval match
  // ------------------------------------------------------------------
  function urlEspace(jeton) {
    var base = window.location.href.split('?')[0].split('#')[0];
    base = base.substring(0, base.lastIndexOf('/') + 1);
    return base + PAGE_ESPACE + '?t=' + encodeURIComponent(jeton);
  }
  function msgLien(texte, ok) {
    var z = $('em-lien-msg');
    if (z) z.innerHTML = texte ? '<div class="' + (ok ? 'ev-ok' : 'ev-erreur') + '">' + esc(texte) + '</div>' : '';
  }
  function rendreLien(pid) {
    var z = $('em-lien-actions');
    if (!z || etat.choisi !== pid) return;
    var t = etat.liens[pid];
    if (t === undefined) { z.innerHTML = '<span class="ev-note">Lien indisponible pour toi.</span>'; return; }
    z.innerHTML = t
      ? '<button type="button" class="ev-btn" data-lien="copier">Copier le lien</button>'
        + '<button type="button" class="ev-btn" data-lien="whatsapp">Envoyer par WhatsApp</button>'
      : '<span class="ev-note">Aucun lien pour ce joueur.</span>'
        + '<button type="button" class="ev-btn" data-lien="creer">Créer le lien</button>';
  }
  async function afficherLien() {
    var pid = etat.choisi;
    if (!pid || typeof SupabaseHub.getLienEspaceJoueur !== 'function') { var z = $('em-lien'); if (z) z.hidden = true; return; }
    if (Object.prototype.hasOwnProperty.call(etat.liens, pid)) { rendreLien(pid); return; }
    var r = await SupabaseHub.getLienEspaceJoueur(pid);
    if (r.ok) etat.liens[pid] = (r.data && r.data.token) ? r.data.token : null;
    rendreLien(pid);
  }
  function texteWhatsApp(j, url) {
    var m = (etat.feuille && etat.feuille.match) || {};
    var e = j.eval;
    var adv = m.adversaire ? ' contre ' + m.adversaire : '';
    if (e && e.statut === 'publie' && e.auto_eval_requise && !j.auto_eval) {
      return 'Salut ' + (j.prenom || '') + ', ton coach a évalué ton match' + adv
        + '. Donne d’abord ton avis sur ton match pour découvrir le sien : ' + url;
    }
    return 'Salut ' + (j.prenom || '') + ', voici ton espace joueur MOM pour suivre tes évaluations : ' + url
      + ' (lien personnel, à garder pour toi et ta famille).';
  }
  async function agirLien(action, bouton) {
    var j = joueurChoisi();
    if (!j) return;
    msgLien('');
    if (action === 'creer') {
      bouton.disabled = true;
      var r = await SupabaseHub.genererLienEspaceJoueur(j.personne_id);
      if (!r.ok) { bouton.disabled = false; msgLien(r.error); return; }
      etat.liens[j.personne_id] = r.data && r.data.token ? r.data.token : null;
      if (!etat.liens[j.personne_id]) delete etat.liens[j.personne_id]; // relire au prochain affichage
      await afficherLien();
      msgLien('Lien créé.', true);
      return;
    }
    var t = etat.liens[j.personne_id];
    if (!t) return;
    var url = urlEspace(t);
    if (action === 'whatsapp') {
      window.open('https://wa.me/?text=' + encodeURIComponent(texteWhatsApp(j, url)), '_blank', 'noopener');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      msgLien('Lien copié dans le presse-papiers.', true);
    } catch (_) {
      var z = $('em-lien-msg');
      z.innerHTML = '<div class="ev-ok">Copie automatique impossible. Lien à copier :</div>'
        + '<input type="text" readonly class="ev-obs" id="em-lien-brut" value="' + esc(url) + '">';
      var champ = $('em-lien-brut');
      if (champ) { champ.focus(); champ.select(); }
    }
  }

  // ------------------------------------------------------------------
  // v1.4 (D28) — lien VEO du match + jusqu'à 5 moments
  // ------------------------------------------------------------------
  function rendreVeo(e) {
    var moments = Array.isArray(e.veo_moments) ? e.veo_moments : [];
    var lignes = '';
    for (var i = 0; i < NB_MOMENTS; i++) {
      var m = moments[i] || {};
      lignes += '<div class="em-moment" style="display:grid;grid-template-columns:minmax(80px,110px) minmax(0,1fr);gap:.5rem">'
        + '<input type="text" data-moment-minute="' + i + '" maxlength="10" placeholder="' + (i === 0 ? '24:10' : 'mm:ss') + '"'
        + ' aria-label="' + esc('Moment ' + (i + 1) + ' — minute') + '" value="' + esc(m.minute || '') + '">'
        + '<input type="text" data-moment-libelle="' + i + '" maxlength="60" placeholder="' + (i === 0 ? 'Ex. ton plaquage sur le 10' : 'Libellé (facultatif)') + '"'
        + ' aria-label="' + esc('Moment ' + (i + 1) + ' — libellé') + '" value="' + esc(m.libelle || '') + '">'
        + '</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:.5rem;background:var(--feedback-info-bg,#eaf1fa);border-radius:10px;padding:.8rem .9rem">'
      + '<label class="ev-champ">Revoir tes actions — lien VEO du match <span class="em-aide">Facultatif, commence par https://</span>'
      + '<input type="url" id="em-veo-url" inputmode="url" placeholder="https://app.veo.co/matches/…" value="' + esc(e.veo_url || '') + '"></label>'
      + '<div class="ev-champ" style="margin:0">Moments à revoir <span class="em-aide">Jusqu’à ' + NB_MOMENTS + ' : minute + ce qu’il doit regarder</span></div>'
      + lignes + '</div>';
  }
  function lireMoments() {
    var out = [];
    for (var i = 0; i < NB_MOMENTS; i++) {
      var mi = document.querySelector('#em-saisie [data-moment-minute="' + i + '"]');
      var li = document.querySelector('#em-saisie [data-moment-libelle="' + i + '"]');
      var minute = mi ? mi.value.trim() : '';
      var libelle = li ? li.value.trim() : '';
      if (minute || libelle) out.push({ minute: minute, libelle: libelle || null });
    }
    return out;
  }
  function ecrireMoments(moments) {
    for (var i = 0; i < NB_MOMENTS; i++) {
      var m = moments[i] || {};
      var mi = document.querySelector('#em-saisie [data-moment-minute="' + i + '"]');
      var li = document.querySelector('#em-saisie [data-moment-libelle="' + i + '"]');
      if (mi) mi.value = m.minute || '';
      if (li) li.value = m.libelle || '';
    }
  }

  // ------------------------------------------------------------------
  // v1.2 (Avenant A) — critères du coach + avis du joueur (D17, D23)
  // ------------------------------------------------------------------
  function rendreCriteres(e, auto, requise) {
    var crit = e.criteres || {};
    var feuxJoueur = auto && auto.feux ? auto.feux : null;
    var lignes = CRITERES.map(function (c) {
      var boutons = FEUX_CRITERE.map(function (f) {
        return '<button type="button" class="ev-feu ev-feu-' + f.v + '" title="' + esc(f.titre) + '"'
          + ' aria-pressed="' + (crit[c.cle] === f.v ? 'true' : 'false') + '"'
          + ' data-critere="' + c.cle + '" data-feu="' + f.v + '">' + f.v + '</button>';
      }).join('');
      var avis = feuxJoueur && feuxJoueur[c.cle]
        ? '<span class="em-avis">Le joueur : <span class="ev-pastille ev-pastille-' + esc(feuxJoueur[c.cle]) + '">'
          + esc(feuxJoueur[c.cle]) + '</span></span>'
        : '';
      return '<div class="em-critere"><span class="em-critere-nom">' + esc(c.nom) + '</span>'
        + '<div class="ev-feux" role="group" aria-label="' + esc('Critère — ' + c.nom) + '">' + boutons + '</div>'
        + avis + '</div>';
    }).join('');
    var etatAuto;
    if (auto) {
      etatAuto = '<p class="ev-note" style="margin:.4rem 0 0">Auto-évaluation envoyée le ' + esc(dateCourte(auto.envoye_le)) + '.'
        + (auto.commentaire ? '</p><div class="ev-reponse" style="margin-top:.4rem"><div class="ev-reponse-titre">Le mot du joueur</div><p>'
          + esc(auto.commentaire) + '</p></div>' : '</p>');
    } else {
      etatAuto = '<p class="ev-note" style="margin:.4rem 0 0">Le joueur n’a pas encore envoyé son auto-évaluation.'
        + (requise ? ' Ton éval publiée ne s’ouvrira pour lui qu’après.' : '') + '</p>';
    }
    return '<div><div class="ev-champ" id="em-crit-label">Les 5 critères <span class="em-aide">Facultatif — re-clic pour effacer</span></div>'
      + '<div class="em-criteres" role="group" aria-labelledby="em-crit-label">' + lignes + '</div>' + etatAuto + '</div>';
  }

  // ------------------------------------------------------------------
  // v1.2 (D24–D26) — signalement blessure / gêne / fatigue
  // ------------------------------------------------------------------
  function rendreSignalement(j) {
    if (!aSignale(j)) return '';
    var g = j.auto_eval.gene;
    var form = '';
    if (etat.formBlessure) {
      var m = (etat.feuille && etat.feuille.match) || {};
      var d = String(m.date || '').slice(0, 10);
      form = '<div class="em-blessure-form">'
        + '<label class="ev-champ">Libellé<input type="text" id="em-bl-libelle" maxlength="120" placeholder="Ex. entorse cheville droite"></label>'
        + '<label class="ev-champ">Début<input type="date" id="em-bl-debut" value="' + esc(d) + '"></label>'
        + '<label class="ev-champ">Retour prévu <span class="em-aide">Facultatif</span><input type="date" id="em-bl-fin"></label>'
        + '<label class="ev-champ em-bl-notes">Notes<textarea id="em-bl-notes" rows="2">'
        + esc('Signalé par le joueur après le match du ' + dateCourte(m.date) + ' : ' + (g.detail || '')) + '</textarea></label>'
        + '<div class="ev-actions"><button type="button" class="ev-btn ev-btn-discret" data-blessure="annuler">Annuler</button>'
        + '<button type="button" class="ev-btn ev-btn-primaire" data-blessure="creer">Enregistrer la blessure</button></div></div>';
    }
    return '<div class="em-alerte" role="note">'
      + '<div class="em-alerte-titre">⚠ Le joueur signale une blessure, une gêne ou une fatigue</div>'
      + '<p>' + esc(g.detail || '') + '</p>'
      + '<div id="em-blessures" class="ev-note"></div>'
      + (etat.formBlessure ? form
        : '<div class="ev-actions"><button type="button" class="ev-btn" data-blessure="ouvrir">Créer une blessure</button></div>')
      + '<p class="em-aide" style="margin:.4rem 0 0">Visible du joueur et des encadrants de la catégorie seulement. Rien n’est créé automatiquement.</p>'
      + '</div>';
  }

  function rendreBlessures(liste) {
    var z = $('em-blessures');
    if (!z) return;
    if (liste === null) { z.textContent = ''; return; }
    var actives = (liste || []).filter(function (b) { return b.est_active; });
    z.textContent = actives.length
      ? 'Blessure' + (actives.length > 1 ? 's' : '') + ' en cours : ' + actives.map(function (b) {
        return b.libelle + ' (depuis le ' + dateCourte(b.date_debut) + ')';
      }).join(' · ')
      : 'Aucune blessure en cours enregistrée pour ce joueur.';
  }

  async function afficherBlessures() {
    var j = joueurChoisi();
    if (!aSignale(j) || typeof SupabaseHub.listBlessuresJoueur !== 'function') return;
    var pid = j.personne_id;
    if (Object.prototype.hasOwnProperty.call(etat.blessures, pid)) { rendreBlessures(etat.blessures[pid]); return; }
    var l = await SupabaseHub.listBlessuresJoueur(pid); // null si refus ou erreur
    etat.blessures[pid] = l;
    if (etat.choisi === pid) rendreBlessures(l);
  }

  async function creerBlessure(bouton) {
    var j = joueurChoisi();
    if (!j) return;
    var b = {
      personne_id: j.personne_id,
      libelle: $('em-bl-libelle').value.trim(),
      date_debut: $('em-bl-debut').value,
      date_fin: $('em-bl-fin').value || null,
      notes: $('em-bl-notes').value.trim()
    };
    if (!b.libelle || !b.date_debut) { message('Le libellé et la date de début sont obligatoires.'); return; }
    bouton.disabled = true;
    var r = await SupabaseHub.saveBlessure(b);
    if (!r.ok) {
      bouton.disabled = false;
      message(/Droit insuffisant/.test(r.error || '') ? 'Tu n’as pas le droit d’enregistrer une blessure pour ce joueur.' : r.error);
      return;
    }
    etat.formBlessure = false;
    delete etat.blessures[j.personne_id];
    rendreMatch();
    message('Blessure enregistrée.', true);
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
      + rendreSignalement(j)
      + '<div><div class="ev-champ" id="em-feu-label">Feu du match</div>'
      + '<div class="em-feux-match" id="em-feux-match" role="group" aria-labelledby="em-feu-label">' + feux + '</div></div>'
      + '<div class="em-deux">'
      + '<label class="ev-champ em-pf">Ton point fort du match <span class="em-aide">Obligatoire pour publier — toujours au moins un positif</span>'
      + '<textarea id="em-point-fort" rows="3">' + esc(e.point_fort || '') + '</textarea></label>'
      + '<label class="ev-champ em-axe">Ton axe de travail <span class="em-aide">Un seul, concret</span>'
      + '<textarea id="em-axe" rows="3">' + esc(e.axe_travail || '') + '</textarea></label>'
      + '</div>'
      + '<label class="ev-champ">Le mot du coach <span class="em-aide">Facultatif</span>'
      + '<textarea id="em-mot" rows="2">' + esc(e.mot_coach || '') + '</textarea></label>'
      + rendreVeo(e)
      + rendreCriteres(e, j.auto_eval || null, !j.eval || !!e.auto_eval_requise)
      + reponse
      + '<div id="em-reperes" aria-live="polite"></div>'
      + '<div class="em-lien" id="em-lien" style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;border-top:1px dashed var(--ev-bord);padding-top:.8rem">'
      + '<span class="ev-lien-titre">Lien joueur &amp; famille</span>'
      + '<div class="ev-actions" id="em-lien-actions"><span class="ev-note">Chargement…</span></div>'
      + '<div id="em-lien-msg" aria-live="polite" style="flex-basis:100%"></div></div>'
      + '</div>'
      + '<div class="ev-pied"><span class="ev-pied-info" id="em-info">' + esc(info) + '</span>'
      + '<div class="ev-actions">' + actions + '</div></div></div>';
  }

  function lireSaisie() {
    var actif = document.querySelector('#em-feux-match .ev-feu[aria-pressed="true"]');
    var criteres = {};
    CRITERES.forEach(function (c) {
      var a = document.querySelector('#em-saisie .ev-feu[data-critere="' + c.cle + '"][aria-pressed="true"]');
      criteres[c.cle] = a ? a.getAttribute('data-feu') : null;
    });
    return {
      personne_id: etat.choisi,
      evenement_id: etat.evenementId,
      feu: actif ? actif.getAttribute('data-feu') : null,
      point_fort: $('em-point-fort').value.trim(),
      axe_travail: $('em-axe').value.trim(),
      mot_coach: $('em-mot').value.trim(),
      veo_url: $('em-veo-url').value.trim(),
      veo_moments: lireMoments(),
      criteres: criteres
    };
  }

  function majEval(nouvelle) {
    var j = joueurChoisi();
    if (j) j.eval = nouvelle;
  }

  function choisir(personneId) {
    etat.choisi = personneId;
    etat.modifie = false;
    etat.formBlessure = false;
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
        message(rp.data && rp.data.auto_eval_requise && !j.auto_eval
          ? 'Éval publiée. Le joueur la découvrira après son auto-évaluation.' : 'Éval publiée.', true);
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
      var li = b.getAttribute('data-lien');
      if (li) { agirLien(li, b); return; }
      var bl = b.getAttribute('data-blessure');
      if (bl) {
        if (bl === 'ouvrir') { etat.formBlessure = true; garderSaisie(); }
        else if (bl === 'annuler') { etat.formBlessure = false; garderSaisie(); }
        else if (bl === 'creer') { creerBlessure(b); }
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
      // Le formulaire blessure n'est pas la saisie de l'éval.
      if (ev.target.closest && ev.target.closest('#em-saisie') && !ev.target.closest('.em-blessure-form')) marquerModifie();
    });
    window.addEventListener('beforeunload', function (ev) {
      if (etat.modifie) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  // v1.2 : ouvre / ferme le formulaire blessure sans perdre la saisie de
  // l'éval en cours (relue puis réinjectée après le rendu).
  function garderSaisie() {
    var s = etat.modifie ? lireSaisie() : null;
    rendreMatch();
    if (!s) return;
    $('em-point-fort').value = s.point_fort; $('em-axe').value = s.axe_travail; $('em-mot').value = s.mot_coach;
    $('em-veo-url').value = s.veo_url; ecrireMoments(s.veo_moments);
    Array.prototype.forEach.call(document.querySelectorAll('#em-feux-match .ev-feu'), function (x) {
      x.setAttribute('aria-pressed', x.getAttribute('data-feu') === s.feu ? 'true' : 'false');
    });
    CRITERES.forEach(function (c) {
      Array.prototype.forEach.call(document.querySelectorAll('#em-saisie .ev-feu[data-critere="' + c.cle + '"]'), function (x) {
        x.setAttribute('aria-pressed', x.getAttribute('data-feu') === s.criteres[c.cle] ? 'true' : 'false');
      });
    });
    marquerModifie();
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
