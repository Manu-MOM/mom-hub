/* =====================================================================
 * espace-joueur.js — Espace joueur & famille (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.2 — 16 novembre 2026 — EVAL-JOUEUR Avenant A, lot A3
 *   FAIT FOI §9 (D16–D27), sql_265 + sql_266.
 *   v1.2 : AUTO-ÉVALUATION MATCH.
 *          - Carte « À toi de jouer » en tête pour chaque match passé où
 *            le joueur est sur la feuille (a_auto_evaluer, D18) : 5 critères
 *            V/O/R requis (D16), question santé Oui/Non requise + « Explique-
 *            nous » requis si Oui, 500 car. (D24), un mot facultatif 280 car.
 *            (D21). Envoi définitif (D20) via envoyer_auto_eval.
 *          - Éval du coach verrouillée (verrouille:true, D19) : cadenas et
 *            renvoi vers le formulaire ; rien du contenu n'est reçu.
 *          - Après envoi : rechargement des données (déverrouillage), en
 *            conservant la visite précédente d'origine (les « Nouveau »
 *            de la visite restent).
 *          - Comparaison neutre « ton avis / l'avis du coach » critère par
 *            critère (D23), écarts signalés sans jugement ; le signalement
 *            santé est rappelé à part, hors comparaison (D25).
 *          - Carte « Comment je me vois » : frise des auto-évaluations par
 *            critère (D23), sans le signalement santé (D25).
 * Version : v1.1 — 15 novembre 2026 — EVAL-JOUEUR lot L5
 *   v1.1 : (D8) « Tes repères du match » sous chaque éval match publiée,
 *          si le match a été suivi : repères POSITIFS seulement (points,
 *          essais, buteur, coups de pied réussis sans total, actions
 *          marquantes), calculés et filtrés en base (sql_264, clé
 *          'reperes' de get_espace_joueur). Rien n'est affiché si la clé
 *          est absente ou nulle.
 * Version : v1.0 — 15 novembre 2026 — EVAL-JOUEUR lot L4
 *   FAIT FOI Conception-EVAL-JOUEUR-v1 (gelé par Manu le 15/11/2026),
 *   socle SQL sql_263.
 *
 * OBJET
 *   Page publique ouverte par le lien personnel du joueur (D1) :
 *   espace-joueur.html?t=<jeton>. Affiche les évaluations PUBLIÉES
 *   (D2) de la saison active : dernier match (repère « Nouveau »,
 *   D7-e), action VEO (D7-b), objectifs de période (D7-c), progression
 *   critère × période (D7-d), bilans et matchs. Seule écriture : la
 *   réponse courte du joueur sous chaque évaluation (D3, D14).
 *
 * SÉCURITÉ / RGPD
 *   - Client anon minimal propre (patron spectateur.js) : 2 constantes
 *     PUBLIQUES par design dupliquées depuis supabase-client.js ;
 *     persistSession:false, aucun localStorage/sessionStorage.
 *   - N'appelle QUE get_espace_joueur, repondre_eval (sql_263) et
 *     envoyer_auto_eval (sql_265/266) ; la garde est le jeton, vérifiée
 *     côté base.
 *   - Tout texte venant de la base est échappé (esc) ; le lien VEO n'est
 *     rendu cliquable que s'il commence par https:// (contrainte base
 *     eval_match_veo_check + contrôle ici).
 *   - Aucun classement ni comparaison entre joueurs (D7-f).
 *
 * NOTE
 *   Chaque ouverture met à jour la date de dernière consultation côté
 *   base (le « Nouveau » se calcule sur la visite précédente). Après une
 *   réponse, la page ne se recharge pas (sinon les « Nouveau » de la
 *   visite en cours disparaîtraient).
 * ===================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://fvfqffxaiaoygqhjtxwr.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2ZnFmZnhhaWFveWdxaGp0eHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjgyNzQsImV4cCI6MjA5NDAwNDI3NH0.1WgEmHTuI00CuKpWflvu5SqZ4ScoEpQgZ7ijJt5OQ00';
  var MAX_REPONSE = 280;
  var MAX_GENE = 500;      // D24
  var FRISE_MAX = 10;      // frise « Comment je me vois » : 10 derniers matchs

  var PERIODES = [
    { code: 'pre_saison', court: 'Pré-s.', titre: 'Pré-saison' },
    { code: 'p1', court: 'P1', titre: 'Période 1 · septembre / décembre' },
    { code: 'p2', court: 'P2', titre: 'Période 2 · janvier / mars' },
    { code: 'p3', court: 'P3', titre: 'Période 3 · avril / juin' }
  ];
  var CRITERES = [
    { cle: 'tech_indiv', nom: 'Technique individuelle' },
    { cle: 'physique', nom: 'Physique' },
    { cle: 'tech_poste', nom: 'Technique au poste' },
    { cle: 'comprehension', nom: 'Compréhension du jeu' },
    { cle: 'etat_esprit', nom: "État d'esprit" }
  ];
  var FEU_BILAN = { V: 'Acquis', O: 'En progrès', R: 'À travailler' };
  var FEU_MATCH = { V: 'Gros match', O: 'Dans le match', R: 'Match difficile' };
  // Avenant A : lecture d'un critère sur UN match (auto-évaluation et critères du coach).
  var FEU_CRITERE_MATCH = { V: 'Bien', O: 'Moyen', R: 'Difficile' };
  var COULEUR = { V: '#2d7a3e', O: '#b86e0a', R: '#c73e3e' };

  var etat = { token: null, donnees: null, client: null,
    visitePrecedente: undefined, // v1.2 : figée au 1er chargement
    saisies: {} };               // v1.2 : evenement_id -> { feux, gene, detail, mot }

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
  function estNouveau(publieLe) {
    if (!publieLe) return false;
    var prec = etat.visitePrecedente;
    if (!prec) return true; // première visite : tout est nouveau
    return new Date(publieLe).getTime() > new Date(prec).getTime();
  }
  function veoSur(url) { return typeof url === 'string' && /^https:\/\//i.test(url); }
  function getClient() {
    if (etat.client) return etat.client;
    if (typeof supabase === 'undefined') return null;
    etat.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return etat.client;
  }
  function titreMatch(x) {
    x = x || {};
    return x.adversaire ? 'vs ' + x.adversaire : (x.libelle || 'Match');
  }
  function tagNiveau(niveau) {
    if (!niveau) return '';
    var nat = /nat/i.test(niveau);
    return '<span class="ej-tag ' + (nat ? 'ej-tag-nat' : 'ej-tag-autre') + '">' + esc(niveau) + '</span>';
  }
  function metaMatch(x) {
    x = x || {};
    var score = (x.score_mom != null && x.score_adverse != null) ? x.score_mom + ' – ' + x.score_adverse : '';
    return [dateCourte(x.date), score].filter(Boolean).join(' · ');
  }
  function pastille(feu) {
    return feu
      ? '<span class="ej-pastille" style="background:' + COULEUR[feu] + '" aria-label="' + esc(FEU_BILAN[feu]) + '">' + esc(feu) + '</span>'
      : '<span class="ej-pastille ej-pastille-vide" aria-hidden="true">·</span>';
  }

  // ------------------------------------------------------------------
  // Blocs
  // ------------------------------------------------------------------
  function blocReponse(type, ev) {
    var id = type + '-' + ev.id;
    var valeur = ev.reponse_joueur || '';
    return '<div class="ej-reponse" data-reponse-type="' + type + '" data-reponse-id="' + esc(ev.id) + '">'
      + '<label for="rep-' + esc(id) + '">Ta réponse au coach</label>'
      + '<textarea id="rep-' + esc(id) + '" rows="2" maxlength="' + MAX_REPONSE + '" placeholder="Un mot, une question…">' + esc(valeur) + '</textarea>'
      + '<div class="ej-compteur"><span data-compteur>' + valeur.length + '</span> / ' + MAX_REPONSE + '</div>'
      + '<button type="button" class="ej-btn" data-envoyer>' + (valeur ? 'Mettre à jour ma réponse' : 'Envoyer') + '</button>'
      + '<div data-msg aria-live="polite"></div></div>';
  }

  // v1.1 (L5, D8) — repères positifs du match (déjà filtrés côté base).
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function blocReperes(r) {
    if (!r) return '';
    var items = [];
    if (r.points) items.push(pluriel(r.points, 'point', 'points'));
    if (r.essais) items.push(pluriel(r.essais, 'essai', 'essais'));
    if (r.transformations) items.push(pluriel(r.transformations, 'transformation réussie', 'transformations réussies'));
    if (r.penalites) items.push(pluriel(r.penalites, 'pénalité réussie', 'pénalités réussies'));
    if (r.drops) items.push(pluriel(r.drops, 'drop', 'drops'));
    if (r.pied_reussis) items.push(pluriel(r.pied_reussis, 'coup de pied réussi', 'coups de pied réussis'));
    (Array.isArray(r.actions) ? r.actions : []).forEach(function (a) {
      if (a && a.libelle) items.push(a.libelle + (a.nombre > 1 ? ' ×' + a.nombre : ''));
    });
    if (!items.length) return '';
    return '<div class="ej-encart ej-mot"><span class="ej-encart-titre">Tes repères du match</span>'
      + '<p>' + items.map(esc).join(' · ') + '</p></div>';
  }

  // v1.2 (D19) : éval du coach verrouillée tant que l'auto-évaluation n'est pas envoyée.
  function contenuVerrouille(m) {
    var x = m.match || {};
    var ouvert = aAutoEvaluer(m.evenement_id);
    return '<div class="ej-cadenas"><span class="ej-cadenas-ico" aria-hidden="true">🔒</span><div>'
      + '<strong>Ton coach t’a écrit sur ce match.</strong>'
      + '<div class="ej-meta">' + esc(titreMatch(x)) + (metaMatch(x) ? ' · ' + esc(metaMatch(x)) : '') + '</div>'
      + '<p>' + (ouvert ? 'Donne d’abord ton avis sur ton match pour découvrir le sien.'
        : 'Ton avis sur ce match n’est plus disponible ici : parles-en à ton coach.') + '</p>'
      + (ouvert ? '<button type="button" class="ej-btn ej-btn-clair" data-aller-auto="' + esc(m.evenement_id) + '">Donner mon avis</button>' : '')
      + '</div></div>';
  }

  // v1.2 (D23) : comparaison neutre, critère par critère.
  function blocComparaison(m) {
    var a = m.auto_eval;
    if (!a || !a.feux) return '';
    var coach = m.criteres || {};
    var coachNote = CRITERES.some(function (c) { return coach[c.cle]; });
    var ecarts = 0;
    var lignes = CRITERES.map(function (c) {
      var moi = a.feux[c.cle], lui = coach[c.cle];
      var diff = coachNote && moi && lui && moi !== lui;
      if (diff) ecarts++;
      return '<div class="ej-compare-ligne"><span class="ej-grille-nom">' + esc(c.nom) + '</span>'
        + pastille(moi) + (coachNote ? pastille(lui) : '<span></span>')
        + '<span class="ej-compare-note">' + (diff ? 'vu différemment' : '') + '</span></div>';
    }).join('');
    var tete = '<div class="ej-compare-ligne ej-compare-tete"><span></span><span>Toi</span>'
      + (coachNote ? '<span>Coach</span>' : '<span></span>') + '<span></span></div>';
    var conclusion = !coachNote
      ? 'Ton coach n’a pas noté les critères sur ce match.'
      : (ecarts ? 'Vous voyez ' + ecarts + ' point' + (ecarts > 1 ? 's' : '') + ' différemment : c’est un bon sujet à aborder avec ton coach.'
        : 'Vous voyez ton match de la même façon.');
    var gene = a.gene && a.gene.signalee
      ? '<div class="ej-encart ej-gene"><span class="ej-encart-titre">Ce que tu as signalé</span><p>' + esc(a.gene.detail || '')
        + '</p><span class="ej-meta">Ton coach en est informé.</span></div>' : '';
    return '<div class="ej-encart ej-compare"><span class="ej-encart-titre">Ton avis · l’avis du coach</span>'
      + tete + lignes + '<p class="ej-meta" style="margin-top:6px">' + esc(conclusion) + '</p>'
      + (a.commentaire ? '<p class="ej-meta">Ton mot : ' + esc(a.commentaire) + '</p>' : '') + '</div>' + gene;
  }

  function contenuMatch(m) {
    if (m.verrouille) return contenuVerrouille(m);
    var x = m.match || {};
    var h = '<div class="ej-feu-ligne">'
      + (m.feu ? '<span class="ej-feu ej-feu-' + esc(m.feu) + '">' + esc(m.feu) + '</span>' : '')
      + '<div><div class="ej-feu-libelle">' + esc(FEU_MATCH[m.feu] || '') + '</div>'
      + '<div class="ej-meta">' + esc(titreMatch(x)) + (metaMatch(x) ? ' · ' + esc(metaMatch(x)) : '') + ' ' + tagNiveau(x.niveau) + '</div></div></div>';
    if (m.point_fort) {
      h += '<div class="ej-encart ej-pf"><span class="ej-encart-titre">Ton point fort</span><p>' + esc(m.point_fort) + '</p></div>';
    }
    if (m.axe_travail) {
      h += '<div class="ej-encart ej-axe"><span class="ej-encart-titre">Ton axe de travail</span><p>' + esc(m.axe_travail) + '</p></div>';
    }
    h += blocReperes(m.reperes);
    h += blocComparaison(m);
    if (m.mot_coach) {
      h += '<div class="ej-encart ej-mot"><span class="ej-encart-titre">Le mot du coach'
        + (m.publie_par_prenom ? ' · ' + esc(m.publie_par_prenom) : '') + '</span><p>' + esc(m.mot_coach) + '</p></div>';
    }
    if (veoSur(m.veo_url)) {
      h += '<a class="ej-veo" href="' + esc(m.veo_url) + '" target="_blank" rel="noopener noreferrer">'
        + '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>'
        + 'Revoir ton action' + (m.veo_minute ? ' (' + esc(m.veo_minute) + ')' : '') + '</a>';
    }
    return h + blocReponse('match', m);
  }

  function contenuBilan(b) {
    var h = '';
    var objs = [b.objectif_1, b.objectif_2].filter(Boolean);
    if (objs.length) {
      h += '<div class="ej-encart ej-mot"><span class="ej-encart-titre">Tes objectifs</span><p>' + objs.map(esc).join('\n') + '</p></div>';
    }
    h += CRITERES.map(function (c) {
      var feu = b.feux ? b.feux[c.cle] : null;
      var obs = b.obs ? b.obs[c.cle] : null;
      if (!feu && !obs) return '';
      return '<div class="ej-critere">' + pastille(feu)
        + '<div class="ej-critere-texte"><strong>' + esc(c.nom) + (feu ? ' · ' + esc(FEU_BILAN[feu]) : '') + '</strong>'
        + (obs ? esc(obs) : '') + '</div></div>';
    }).join('');
    if (b.publie_par_prenom) h += '<div class="ej-meta">Bilan de ' + esc(b.publie_par_prenom) + '</div>';
    return h + blocReponse('bilan', b);
  }

  // ------------------------------------------------------------------
  // v1.2 — Auto-évaluation (D16–D24)
  // ------------------------------------------------------------------
  function aAutoEvaluer(evenementId) {
    return (etat.donnees.a_auto_evaluer || []).some(function (x) { return x.evenement_id === evenementId; });
  }
  function saisieDe(evt) {
    if (!etat.saisies[evt]) etat.saisies[evt] = { feux: {}, gene: null, detail: '', mot: '' };
    return etat.saisies[evt];
  }
  function saisieComplete(s) {
    var feux = CRITERES.every(function (c) { return !!s.feux[c.cle]; });
    if (!feux || s.gene === null) return false;
    return s.gene === false || s.detail.trim().length > 0;
  }
  function verrouPour(evt) {
    return (etat.donnees.matchs || []).some(function (m) { return m.evenement_id === evt && m.verrouille; });
  }

  function formAuto(x) {
    var evt = x.evenement_id;
    var s = saisieDe(evt);
    var criteres = CRITERES.map(function (c) {
      var boutons = ['V', 'O', 'R'].map(function (f) {
        return '<button type="button" class="ej-choix ej-choix-' + f + '" aria-pressed="' + (s.feux[c.cle] === f ? 'true' : 'false') + '"'
          + ' data-auto="' + esc(evt) + '" data-critere="' + c.cle + '" data-feu="' + f + '">'
          + f + '<small>' + esc(FEU_CRITERE_MATCH[f]) + '</small></button>';
      }).join('');
      return '<div class="ej-ae-critere"><span class="ej-ae-nom">' + esc(c.nom) + '</span>'
        + '<div class="ej-choix-groupe" role="group" aria-label="' + esc(c.nom) + '">' + boutons + '</div></div>';
    }).join('');
    var ouiNon = ['oui', 'non'].map(function (v) {
      var actif = (v === 'oui' && s.gene === true) || (v === 'non' && s.gene === false);
      return '<button type="button" class="ej-oui-non" aria-pressed="' + (actif ? 'true' : 'false') + '" data-auto="' + esc(evt) + '" data-gene="' + v + '">'
        + (v === 'oui' ? 'Oui' : 'Non') + '</button>';
    }).join('');
    var idb = 'ae-' + esc(evt);
    return '<div class="ej-ae" data-ae="' + esc(evt) + '">'
      + '<p class="ej-meta" style="margin:0">Pour chaque point : <strong>V</strong> ça a bien marché · <strong>O</strong> moyen · <strong>R</strong> difficile.</p>'
      + criteres
      + '<div class="ej-ae-gene"><span class="ej-ae-nom">T’es-tu blessé, ou ressens-tu une gêne ou une fatigue importante ?</span>'
      + '<div class="ej-choix-groupe" role="group" aria-label="Blessure, gêne ou fatigue">' + ouiNon + '</div>'
      + '<div data-gene-detail' + (s.gene === true ? '' : ' hidden') + '>'
      + '<label for="' + idb + '-gene">Explique-nous : où, depuis quand, ce que tu ressens</label>'
      + '<textarea id="' + idb + '-gene" rows="3" maxlength="' + MAX_GENE + '" data-auto-texte="detail" data-auto="' + esc(evt) + '">' + esc(s.detail) + '</textarea>'
      + '<div class="ej-compteur"><span data-compteur>' + s.detail.length + '</span> / ' + MAX_GENE + '</div></div></div>'
      + '<div><label for="' + idb + '-mot">Un mot sur ton match <span class="ej-meta">(facultatif)</span></label>'
      + '<textarea id="' + idb + '-mot" rows="2" maxlength="' + MAX_REPONSE + '" data-auto-texte="mot" data-auto="' + esc(evt) + '" placeholder="Ce qui t’a plu, ce que tu veux améliorer…">' + esc(s.mot) + '</textarea>'
      + '<div class="ej-compteur"><span data-compteur>' + s.mot.length + '</span> / ' + MAX_REPONSE + '</div></div>'
      + '<p class="ej-meta" style="margin:0">Une fois envoyé, ton avis ne peut plus être modifié.</p>'
      + '<button type="button" class="ej-btn" data-envoyer-auto="' + esc(evt) + '"' + (saisieComplete(s) ? '' : ' disabled') + '>Envoyer mon avis</button>'
      + '<div data-msg aria-live="polite"></div></div>';
  }

  function carteAutoEval() {
    var liste = etat.donnees.a_auto_evaluer || [];
    if (!liste.length) return '';
    return liste.map(function (x) {
      var verrou = verrouPour(x.evenement_id);
      return '<section class="ej-carte ej-carte-auto" id="carte-auto-' + esc(x.evenement_id) + '">'
        + '<div class="ej-carte-tete"><h2>À toi de jouer</h2>' + (verrou ? '<span class="ej-nouveau">🔒 AVIS DU COACH</span>' : '') + '</div>'
        + '<div class="ej-corps"><div><div class="ej-feu-libelle">Comment tu as vu ton match ?</div>'
        + '<div class="ej-meta">' + esc(titreMatch(x)) + (x.date ? ' · ' + esc(dateCourte(x.date)) : '') + ' ' + tagNiveau(x.niveau) + '</div>'
        + (verrou ? '<p class="ej-meta" style="margin:6px 0 0">Ton coach t’a écrit : envoie ton avis pour le découvrir.</p>' : '')
        + '</div>' + formAuto(x) + '</div></section>';
    }).join('');
  }

  function carteFrise() {
    var autos = (etat.donnees.auto_evals || []).slice(0, FRISE_MAX).reverse(); // ancien → récent
    if (!autos.length) return '';
    var col = 'grid-template-columns: minmax(0, 1fr) repeat(' + autos.length + ', 30px)';
    var h = CRITERES.map(function (c) {
      return '<div class="ej-frise-ligne" style="' + col + '"><span class="ej-grille-nom">' + esc(c.nom) + '</span>'
        + autos.map(function (a) { return pastille(a.feux ? a.feux[c.cle] : null); }).join('') + '</div>';
    }).join('');
    return '<section class="ej-carte"><div class="ej-corps"><h2 class="ej-titre">Comment je me vois</h2>'
      + '<div class="ej-frise">' + h + '</div>'
      + '<div class="ej-meta">Ton avis match après match, du plus ancien au plus récent' + (autos.length > 1 ? '' : ' (premier match)') + '.</div>'
      + '</div></section>';
  }

  function carteDernierMatch(m) {
    return '<section class="ej-carte ej-carte-une">'
      + '<div class="ej-carte-tete"><h2>Ton dernier match</h2>' + (estNouveau(m.publie_le) ? '<span class="ej-nouveau">NOUVEAU</span>' : '') + '</div>'
      + '<div class="ej-corps">' + contenuMatch(m) + '</div></section>';
  }

  function carteObjectifs(bilans) {
    var dernier = null;
    bilans.forEach(function (b) { if (b.objectif_1 || b.objectif_2) dernier = b; });
    if (!dernier) return '';
    var p = PERIODES.filter(function (x) { return x.code === dernier.periode; })[0];
    var objs = [dernier.objectif_1, dernier.objectif_2].filter(Boolean);
    return '<section class="ej-carte"><div class="ej-corps">'
      + '<h2 class="ej-titre">Mes objectifs' + (p ? ' · ' + esc(p.court) : '') + '</h2>'
      + objs.map(function (o, i) {
        return '<div class="ej-objectif"><span class="ej-objectif-n">' + (i + 1) + '</span><span>' + esc(o) + '</span></div>';
      }).join('') + '</div></section>';
  }

  function carteProgression(bilans) {
    if (!bilans.length) return '';
    var parPeriode = {};
    bilans.forEach(function (b) { parPeriode[b.periode] = b; });
    var h = '<div class="ej-grille"><span></span>'
      + PERIODES.map(function (p) { return '<span class="ej-grille-tete">' + esc(p.court) + '</span>'; }).join('') + '</div>';
    h += CRITERES.map(function (c) {
      return '<div class="ej-grille"><span class="ej-grille-nom">' + esc(c.nom) + '</span>'
        + PERIODES.map(function (p) {
          var b = parPeriode[p.code];
          return pastille(b && b.feux ? b.feux[c.cle] : null);
        }).join('') + '</div>';
    }).join('');
    return '<section class="ej-carte"><div class="ej-corps"><h2 class="ej-titre">Ma progression</h2>' + h
      + '<div class="ej-meta">V acquis · O en progrès · R à travailler</div></div></section>';
  }

  function ligneDepliable(cle, pastilleHtml, titre, meta, extra, nouveau, contenu) {
    return '<li><button type="button" class="ej-ligne" aria-expanded="false" data-deplier="' + esc(cle) + '">'
      + pastilleHtml
      + '<span class="ej-ligne-texte"><strong>' + esc(titre) + '</strong><span class="ej-meta">' + esc(meta) + '</span></span>'
      + (nouveau ? '<span class="ej-nouveau">NOUVEAU</span>' : '') + extra + '</button>'
      + '<div class="ej-detail" id="det-' + esc(cle) + '" hidden>' + contenu + '</div></li>';
  }

  function carteBilans(bilans) {
    if (!bilans.length) return '';
    var lignes = bilans.slice().reverse().map(function (b) {
      var p = PERIODES.filter(function (x) { return x.code === b.periode; })[0] || { titre: b.periode };
      var nb = CRITERES.filter(function (c) { return b.feux && b.feux[c.cle] === 'V'; }).length;
      return ligneDepliable('bilan-' + b.id, '<span class="ej-pastille" style="background:#0c3d24">B</span>',
        p.titre, nb + ' critère' + (nb > 1 ? 's' : '') + ' au vert · publié le ' + dateCourte(b.publie_le), '',
        estNouveau(b.publie_le), contenuBilan(b));
    }).join('');
    return '<section class="ej-carte"><h2 class="ej-titre" style="padding:16px 16px 6px">Mes bilans</h2><ul class="ej-liste">' + lignes + '</ul></section>';
  }

  function carteMatchs(matchs) {
    if (matchs.length < 2) return '';
    var lignes = matchs.slice(1).map(function (m) {
      var x = m.match || {};
      return ligneDepliable('match-' + m.id,
        m.verrouille ? '<span class="ej-pastille ej-pastille-vide" aria-label="Verrouillé">🔒</span>'
          : (m.feu ? '<span class="ej-pastille" style="background:' + COULEUR[m.feu] + '">' + esc(m.feu) + '</span>' : pastille(null)),
        titreMatch(x), metaMatch(x), tagNiveau(x.niveau), estNouveau(m.publie_le),
        '<div class="ej-corps" style="padding:0">' + contenuMatch(m) + '</div>');
    }).join('');
    return '<section class="ej-carte"><h2 class="ej-titre" style="padding:16px 16px 6px">Mes autres matchs</h2><ul class="ej-liste">' + lignes + '</ul></section>';
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------
  function rendre() {
    var d = etat.donnees;
    var j = d.joueur || {};
    var bilans = Array.isArray(d.bilans) ? d.bilans : [];
    var matchs = Array.isArray(d.matchs) ? d.matchs : [];
    var h = '<header class="ej-tete"><div class="ej-sur">MOM · Mon espace' + (d.saison ? ' · ' + esc(d.saison) : '') + '</div>'
      + '<h1>Salut ' + esc(j.prenom || '') + '</h1><p>' + esc(j.categorie_code || '') + '</p></header><main>';
    h += carteAutoEval();
    if (!bilans.length && !matchs.length) {
      if (!(d.auto_evals || []).length && !(d.a_auto_evaluer || []).length) {
        h += '<section class="ej-carte"><p class="ej-vide">Pas encore d’évaluation publiée cette saison. '
          + 'Reviens après le prochain match : ton coach t’écrira ici.</p></section>';
      }
      h += carteFrise();
    } else {
      if (matchs.length) h += carteDernierMatch(matchs[0]);
      h += carteObjectifs(bilans) + carteProgression(bilans) + carteFrise() + carteBilans(bilans) + carteMatchs(matchs);
    }
    h += '<p class="ej-pied">Ce lien est personnel : garde-le pour toi et ta famille.</p></main>';
    $('ej-page').innerHTML = h;
  }

  function erreur(titre, texte) {
    $('ej-page').innerHTML = '<div class="ej-erreur"><h2>' + esc(titre) + '</h2><p>' + esc(texte) + '</p></div>';
  }

  // ------------------------------------------------------------------
  // Interactions
  // ------------------------------------------------------------------
  function trouverEval(type, id) {
    var liste = type === 'bilan' ? etat.donnees.bilans : etat.donnees.matchs;
    return (liste || []).filter(function (e) { return e.id === id; })[0] || null;
  }

  async function envoyer(bloc) {
    var type = bloc.getAttribute('data-reponse-type');
    var id = bloc.getAttribute('data-reponse-id');
    var zone = bloc.querySelector('textarea');
    var bouton = bloc.querySelector('[data-envoyer]');
    var msg = bloc.querySelector('[data-msg]');
    var texte = zone.value.trim();
    if (texte.length > MAX_REPONSE) {
      msg.innerHTML = '<span class="ej-msg-err">280 caractères maximum.</span>';
      return;
    }
    var cli = getClient();
    if (!cli) { msg.innerHTML = '<span class="ej-msg-err">Connexion impossible.</span>'; return; }
    bouton.disabled = true;
    msg.innerHTML = '';
    var res = await cli.rpc('repondre_eval', { p_token: etat.token, p_type: type, p_eval_id: id, p_texte: texte });
    bouton.disabled = false;
    if (res.error) {
      msg.innerHTML = '<span class="ej-msg-err">' + esc(/introuvable/i.test(res.error.message || '')
        ? 'Cette évaluation n’est plus disponible.' : 'Envoi impossible, réessaie plus tard.') + '</span>';
      return;
    }
    var ev = trouverEval(type, id);
    if (ev) ev.reponse_joueur = texte || null;
    // La même éval peut être affichée deux fois (dernier match) : synchroniser.
    Array.prototype.forEach.call(document.querySelectorAll('[data-reponse-type="' + type + '"][data-reponse-id="' + id + '"]'), function (b) {
      if (b !== bloc) b.querySelector('textarea').value = texte;
      b.querySelector('[data-envoyer]').textContent = texte ? 'Mettre à jour ma réponse' : 'Envoyer';
    });
    msg.innerHTML = '<span class="ej-msg-ok">' + (texte ? 'Envoyé ! Ton coach verra ta réponse.' : 'Réponse effacée.') + '</span>';
  }

  // v1.2 — auto-évaluation : choix, textes, envoi.
  function majBoutonAuto(evt) {
    var bloc = document.querySelector('[data-ae="' + evt + '"]');
    if (!bloc) return;
    var btn = bloc.querySelector('[data-envoyer-auto]');
    if (btn) btn.disabled = !saisieComplete(saisieDe(evt));
  }

  function choisirAuto(b) {
    var evt = b.getAttribute('data-auto');
    var s = saisieDe(evt);
    var bloc = b.closest('[data-ae]');
    if (b.hasAttribute('data-critere')) {
      s.feux[b.getAttribute('data-critere')] = b.getAttribute('data-feu');
    } else {
      s.gene = b.getAttribute('data-gene') === 'oui';
      var det = bloc.querySelector('[data-gene-detail]');
      if (det) det.hidden = !s.gene;
      if (s.gene && det) { var ta = det.querySelector('textarea'); if (ta) ta.focus(); }
    }
    Array.prototype.forEach.call(b.parentNode.querySelectorAll('button'), function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    majBoutonAuto(evt);
  }

  async function envoyerAuto(b) {
    var evt = b.getAttribute('data-envoyer-auto');
    var s = saisieDe(evt);
    var msg = b.parentNode.querySelector('[data-msg]');
    if (!saisieComplete(s)) { msg.innerHTML = '<span class="ej-msg-err">Réponds aux 5 points et à la question santé.</span>'; return; }
    if (s.gene && s.detail.trim().length > MAX_GENE) { msg.innerHTML = '<span class="ej-msg-err">500 caractères maximum.</span>'; return; }
    if (s.mot.trim().length > MAX_REPONSE) { msg.innerHTML = '<span class="ej-msg-err">280 caractères maximum pour ton mot.</span>'; return; }
    var cli = getClient();
    if (!cli) { msg.innerHTML = '<span class="ej-msg-err">Connexion impossible.</span>'; return; }
    b.disabled = true;
    msg.innerHTML = '';
    var res = await cli.rpc('envoyer_auto_eval', {
      p_token: etat.token,
      p_evenement_id: evt,
      p_feu_tech_indiv: s.feux.tech_indiv,
      p_feu_physique: s.feux.physique,
      p_feu_tech_poste: s.feux.tech_poste,
      p_feu_comprehension: s.feux.comprehension,
      p_feu_etat_esprit: s.feux.etat_esprit,
      p_gene_signalee: s.gene,
      p_gene_detail: s.gene ? s.detail.trim() : null,
      p_commentaire: s.mot.trim() || null
    });
    if (res.error && res.error.code !== '23505') {
      b.disabled = false;
      msg.innerHTML = '<span class="ej-msg-err">' + esc(/ne peut pas/i.test(res.error.message || '')
        ? 'Ce match ne peut plus recevoir ton avis.' : 'Envoi impossible, réessaie plus tard.') + '</span>';
      return;
    }
    // Envoyé (ou déjà envoyé) : on recharge pour déverrouiller l'éval du coach.
    delete etat.saisies[evt];
    var ok = await charger();
    if (!ok) { msg.innerHTML = '<span class="ej-msg-ok">Ton avis est envoyé. Recharge la page pour voir celui de ton coach.</span>'; return; }
    rendre();
    var mm = (etat.donnees.matchs || []).filter(function (m) { return m.evenement_id === evt; })[0];
    var bandeau = '<div class="ej-merci" role="status">Merci ! Ton avis est envoyé.'
      + (mm && !mm.verrouille ? ' Découvre celui de ton coach ci-dessous.' : ' Ton coach le lira.') + '</div>';
    var main = document.querySelector('#ej-page main');
    if (main) main.insertAdjacentHTML('afterbegin', bandeau);
    window.scrollTo(0, 0);
  }

  function brancher() {
    var page = $('ej-page');
    page.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.hasAttribute('data-auto')) { choisirAuto(b); return; }
      if (b.hasAttribute('data-envoyer-auto')) { envoyerAuto(b); return; }
      var aller = b.getAttribute('data-aller-auto');
      if (aller) {
        var carte = $('carte-auto-' + aller);
        if (carte) carte.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (b.hasAttribute('data-envoyer')) { envoyer(b.closest('[data-reponse-type]')); return; }
      var cle = b.getAttribute('data-deplier');
      if (cle) {
        var det = $('det-' + cle);
        var ouvert = b.getAttribute('aria-expanded') === 'true';
        b.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
        if (det) det.hidden = ouvert;
      }
    });
    page.addEventListener('input', function (e) {
      if (e.target.tagName !== 'TEXTAREA') return;
      var c = e.target.parentNode.querySelector('[data-compteur]');
      if (c) c.textContent = e.target.value.length;
      var champ = e.target.getAttribute('data-auto-texte');
      if (champ) {
        var evt = e.target.getAttribute('data-auto');
        saisieDe(evt)[champ] = e.target.value;
        majBoutonAuto(evt);
      }
    });
  }

  // ------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------
  async function demarrer() {
    var t = new URLSearchParams(window.location.search).get('t');
    if (!t || !/^[0-9a-f]{64}$/.test(t)) {
      erreur('Lien incomplet', 'Ce lien ne fonctionne pas. Demande ton lien personnel à ton coach.');
      return;
    }
    etat.token = t;
    var cli = getClient();
    if (!cli) { erreur('Connexion impossible', 'Vérifie ta connexion internet puis recharge la page.'); return; }
    var res = await cli.rpc('get_espace_joueur', { p_token: t });
    if (res.error || !res.data) {
      var invalide = res.error && (res.error.code === '42501' || /invalide|expir/i.test(res.error.message || ''));
      erreur(invalide ? 'Lien expiré' : 'Chargement impossible',
        invalide ? 'Ce lien n’est plus valable. Demande le nouveau lien à ton coach.'
          : 'Réessaie dans quelques instants.');
      return;
    }
    etat.donnees = res.data;
    etat.visitePrecedente = res.data.visite_precedente || null;
    rendre();
    brancher();
  }

  // v1.2 : rechargement après une auto-évaluation (la visite précédente
  // d'origine est conservée : les « Nouveau » de la visite restent).
  async function charger() {
    var cli = getClient();
    if (!cli) return false;
    var res = await cli.rpc('get_espace_joueur', { p_token: etat.token });
    if (res.error || !res.data) return false;
    etat.donnees = res.data;
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
  window.EspaceJoueur = { demarrer: demarrer };
})();
