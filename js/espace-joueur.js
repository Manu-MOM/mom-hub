/* =====================================================================
 * espace-joueur.js — Espace joueur & famille (MOM Hub)
 * ---------------------------------------------------------------------
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
 *   - N'appelle QUE get_espace_joueur et repondre_eval (sql_263) ; la
 *     garde est le jeton, vérifié côté base.
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
  var COULEUR = { V: '#2d7a3e', O: '#b86e0a', R: '#c73e3e' };

  var etat = { token: null, donnees: null, client: null };

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
    var prec = etat.donnees.visite_precedente;
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

  function contenuMatch(m) {
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
        m.feu ? '<span class="ej-pastille" style="background:' + COULEUR[m.feu] + '">' + esc(m.feu) + '</span>' : pastille(null),
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
    if (!bilans.length && !matchs.length) {
      h += '<section class="ej-carte"><p class="ej-vide">Pas encore d’évaluation publiée cette saison. '
        + 'Reviens après le prochain match : ton coach t’écrira ici.</p></section>';
    } else {
      if (matchs.length) h += carteDernierMatch(matchs[0]);
      h += carteObjectifs(bilans) + carteProgression(bilans) + carteBilans(bilans) + carteMatchs(matchs);
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

  function brancher() {
    var page = $('ej-page');
    page.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
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
    rendre();
    brancher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
  window.EspaceJoueur = { demarrer: demarrer };
})();
