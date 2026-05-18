/**
 * MOM Hub · Spectateur (Objet C-2 — écran spectateur lecture seule)
 * ================================================================
 *
 * Cycle SUIVI-COACH-1, Objet C-2. Contrôleur de l'écran spectateur.
 * Conception figée Conception-SUIVI-COACH-1-ObjetC.md (C2-Q1/Q2/Q3,
 * VALIDÉ Manu). Coquille = spectateur.html (fichier 1).
 *
 * C2-Q1 — FICHIER DISTINCT, ZÉRO surface d'écriture (sûr par
 *   construction). Ce contrôleur n'appelle QUE des RPC de lecture :
 *   get_chronologie_rencontre (voie jeton, C12-d) via SuiviClient
 *   RÉUTILISÉ TEL QUEL, et get_entete_rencontre (C12-g) via un client
 *   anon minimal PROPRE (point 2 validé Manu : suivi-client.js est
 *   intangible et n'expose ni wrapper C12-g ni son client interne ;
 *   on duplique 2 constantes PUBLIQUES par design — coût honnête et
 *   pré-assumé, identique au rationnel que suivi-client.js documente
 *   lui-même pour avoir dupliqué depuis supabase-client.js).
 *   role_lien (C12-g) INFORME le bandeau « vous suivez en
 *   spectateur », n'active rien. C-2 ne connaît que SON jeton
 *   spectateur dans l'URL (?t=) et les RPC de lecture.
 * C2-Q2 — score = SUM client de la chronologie LUE (jamais la photo
 *   evenements, I1) ; fil = récit effectif : annulées masquées CÔTÉ
 *   RPC (get_chronologie_rencontre sans p_inclure_annulees =>
 *   p_inclure_annulees défaut FALSE ; on re-filtre annule===true par
 *   prudence défensive, comme suivi-app.js) ; corrigées à valeur
 *   courante (corriger_observable mute en place) ; PAS de marqueur
 *   source_saisie ; payload réduit RGPD inchangé.
 * C2-Q3 — A génère / C-2 OUVRE. Aucune génération de lien, aucune
 *   logique de rôle décisionnelle ici.
 *
 * RÉUTILISATION FIDÈLE DU RENDU (point 1 validé Manu) : le format de
 *   ligne réplique EXACTEMENT ligneTexte() de suivi-app.js v0.14
 *   (rendu réellement déployé, resté volontairement PROVISOIRE
 *   jusqu'à la clôture du module bénévole : `P{periode} {minute}' ·
 *   {camp} · {observable_id}{(+pts)}{ · joueur}`). Le code déployé
 *   fait foi ; embellir (mapper observable_id -> libellé, 1MT/2MT)
 *   serait du scope neuf touchant un rendu partagé, pas Objet C.
 *   Une seule vérité : C-2 montre ce que le bénévole/coach voit.
 *
 * ⚠️ DETTE SUIVI-COACH-8 (signalée, non construite ici — couloir
 *   backend, pattern strict C12-k). Vérifié À LA SOURCE : ni C12-d
 *   ni C12-g n'exposent l'état de la rencontre à la voie jeton, et
 *   aucun observable de fin au référentiel (observables-match.json,
 *   Path A / SUIVI-UI-2). Le spectateur NE PEUT PAS détecter
 *   honnêtement « Match terminé ». DÉGRADATION HONNÊTE (cohérent
 *   C2-Q2 « cycle de vie honnête, jamais d'écran cassé », et
 *   parallèle exact de C-1/SUIVI-COACH-7) : on n'affiche JAMAIS un
 *   faux « Terminé » ; la pastille reste « En direct » tant que la
 *   rencontre tourne ; le bouton « Rafraîchir » manuel est offert
 *   EN CONTINU (utile persona réseau instable quel que soit l'état)
 *   en plus du polling auto ~10 s. La présentation « Terminé »
 *   distincte (C2-Q2 point 4) est GATED sur SUIVI-COACH-8 : à la
 *   levée backend, seule la branche `_appliquerEtat('termine')`
 *   consommera le nouveau champ. Isolé, réversible.
 *
 * I5 — ZÉRO état navigateur : aucun localStorage/sessionStorage.
 *   Le jeton est re-dérivé de l'URL à chaque load (SuiviClient.
 *   getToken). Variables runtime transitoires uniquement.
 * ANTI-INJECTION — textContent partout pour le texte de ligne et
 *   l'en-tête ; innerHTML uniquement pour le score (nombres sûrs,
 *   markup .pts identique à suivi-app.js).
 *
 * Dépendances chargées AVANT (cf. spectateur.html) :
 *   supabase-js (CDN UMD) -> suivi-client.js (SuiviClient) -> ce
 *   fichier. Écran SANS login (jeton URL = autorisation lecture).
 *
 * Version : 1.0 — mai 2026 (conv Production, couloir Objet C).
 */
(function (global) {
  'use strict';

  var doc = global.document;

  // ============================================================
  // CONFIGURATION — client anon minimal PROPRE pour C12-g (point 2)
  // ============================================================
  // Mêmes valeurs que suivi-client.js / supabase-client.js.
  // Dupliquées VOLONTAIREMENT : suivi-client.js v1.1 est antérieur à
  // C12-g, n'expose aucun wrapper get_entete_rencontre ni son client
  // interne (getClient privé), et il est INTANGIBLE (module bénévole
  // clôturé). Le coût = 2 constantes publiques par design (la clé
  // anon est publique ; l'URL est stable). Honnête et assumé —
  // exactement le rationnel documenté dans suivi-client.js.
  var SUPABASE_URL = 'https://fvfqffxaiaoygqhjtxwr.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2ZnFmZnhhaWFveWdxaGp0eHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjgyNzQsImV4cCI6MjA5NDAwNDI3NH0.1WgEmHTuI00CuKpWflvu5SqZ4ScoEpQgZ7ijJt5OQ00';

  // Cadence de rafraîchissement (S-5.1.b : ~10 s, « ménage le
  // réseau », persona réseau instable). Auto tant que la rencontre
  // tourne ; le bouton manuel reste offert en continu (SUIVI-COACH-8).
  var REFRESH_MS = 10000;

  // ============================================================
  // GARDES
  // ============================================================
  function suiviClientPresent() {
    return typeof global.SuiviClient !== 'undefined'
        && global.SuiviClient
        && typeof global.SuiviClient.chargerEtatInitial === 'function'
        && typeof global.SuiviClient.getToken === 'function'
        && typeof global.SuiviClient.libelleJoueur === 'function';
  }

  // Client anon minimal, lazy singleton. persistSession:false (I5 :
  // zéro état navigateur). UNIQUEMENT pour get_entete_rencontre.
  var _enteteClient = null;
  function getEnteteClient() {
    if (_enteteClient) return _enteteClient;
    if (typeof supabase === 'undefined') return null;
    _enteteClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return _enteteClient;
  }

  // ============================================================
  // RUNTIME TRANSITOIRE (jamais persisté — I5)
  // ============================================================
  var _token = null;
  var _timer = null;
  var _enteteCharge = false;   // l'en-tête n'est chargé qu'une fois

  // ============================================================
  // BASCULE D'ÉCRAN — un seul .suivi-screen sans [hidden]
  // ============================================================
  function montrerEcran(id) {
    var ecrans = doc.querySelectorAll('.suivi-screen');
    for (var i = 0; i < ecrans.length; i++) {
      var e = ecrans[i];
      if (e.id === id) { e.removeAttribute('hidden'); }
      else { e.setAttribute('hidden', ''); }
    }
  }

  function stopTimer() {
    if (_timer) { global.clearInterval(_timer); _timer = null; }
  }

  // ============================================================
  // ÉCRAN ERREUR — message contextuel ; bouton Réessayer injecté
  // UNIQUEMENT sur erreur réseau (réessayer un jeton invalide
  // n'aide pas : on n'offre pas un faux espoir). Calque suivi-app.
  // ============================================================
  function afficherErreur(message, reessayable) {
    stopTimer();
    var msg = doc.getElementById('errMsg');
    if (msg) { msg.textContent = message; }

    var scr = doc.getElementById('scrError');
    var ancien = doc.getElementById('btnReessayer');
    if (ancien && ancien.parentNode) { ancien.parentNode.removeChild(ancien); }

    if (reessayable && scr) {
      var btn = doc.createElement('button');
      btn.id = 'btnReessayer';
      btn.type = 'button';
      btn.className = 'suivi-btn-neutre';
      btn.textContent = 'Réessayer';
      btn.style.marginTop = '12px';
      btn.style.maxWidth = '240px';
      btn.addEventListener('click', function () { boot(); });
      scr.appendChild(btn);
    }
    montrerEcran('scrError');
  }

  // ============================================================
  // RENDU — réplique FIDÈLE de suivi-app.js v0.14 (point 1)
  // ============================================================

  // SUM valeur_points par camp, hors annulées. Pure lecture, zéro
  // écriture (I1). Identique à calculerScore() de suivi-app.js.
  function calculerScore(lignes) {
    var mom = 0, adv = 0;
    if (lignes && lignes.length) {
      for (var i = 0; i < lignes.length; i++) {
        var l = lignes[i];
        if (l && l.annule === true) continue;
        var pts = (typeof l.valeur_points === 'number') ? l.valeur_points : 0;
        if (!pts) continue;
        if (l.equipe_concernee === 'adverse') adv += pts;
        else mom += pts;
      }
    }
    return { mom: mom, adv: adv };
  }

  function rendreScore(lignes) {
    var el = doc.getElementById('zaScore');
    if (!el) return;
    var s = calculerScore(lignes);
    // Nombres sûrs ; markup .pts identique à suivi-app.js.
    el.innerHTML =
      'MOM <span class="pts">' + s.mom + '</span> — '
      + '<span class="pts">' + s.adv + '</span> ADV';
  }

  // Placeholder période/minute de la dernière ligne active (le
  // bénévole n'a pas de moteur chrono ; on reflète honnêtement ce
  // que la chronologie porte, sans inventer un temps).
  function rendreChrono(lignes) {
    var el = doc.getElementById('zaChrono');
    if (!el) return;
    var last = null;
    if (lignes && lignes.length) {
      for (var i = lignes.length - 1; i >= 0; i--) {
        if (lignes[i] && lignes[i].annule === true) continue;
        last = lignes[i]; break;
      }
    }
    if (!last) { el.textContent = '— · —\''; return; }
    var per = (last.periode != null) ? last.periode : '—';
    var min = (last.minute_match != null) ? last.minute_match : '—';
    el.textContent = 'P' + per + ' · ' + min + '\'';
  }

  // Format de ligne : RÉPLIQUE EXACTE de ligneTexte() suivi-app.js
  // v0.14 (point 1 validé Manu). Ne rien embellir ici.
  function ligneTexte(l) {
    if (!l) return '';
    var per = (l.periode != null) ? l.periode : '—';
    var min = (l.minute_match != null) ? l.minute_match : '—';
    var obs = l.observable_id ? String(l.observable_id) : '?';
    var pts = (typeof l.valeur_points === 'number' && l.valeur_points)
      ? (' (' + (l.valeur_points > 0 ? '+' : '') + l.valeur_points + ')') : '';
    var camp = (l.equipe_concernee === 'adverse') ? 'ADV' : 'MOM';
    // libelleJoueur = règle UNIQUE de dégradation nom_court NULL
    // (numéro = ancre). RÉUTILISÉE telle quelle, jamais reconstruite.
    var joueur = '';
    if (l.equipe_concernee !== 'adverse'
        && (l.joueur_uuid || l.nom_court)) {
      joueur = ' · ' + global.SuiviClient.libelleJoueur(l);
    } else if (l.equipe_concernee !== 'adverse'
               && typeof l.valeur_points === 'number'
               && l.valeur_points > 0) {
      // Scorante côté nous SANS joueur = fallback DS-1 (D-7 « je ne
      // sais pas » ; le coach complétera en Mode Vidéo). Identique
      // au rendu bénévole : une seule vérité.
      joueur = ' · (joueur à compléter)';
    }
    return 'P' + per + ' ' + min + '\' · ' + camp + ' · ' + obs + pts + joueur;
  }

  // Lignes actives (annulées exclues — récit effectif C2-Q2).
  function actives(lignes) {
    var out = [];
    if (lignes && lignes.length) {
      for (var i = 0; i < lignes.length; i++) {
        if (lignes[i] && lignes[i].annule === true) continue;
        out.push(lignes[i]);
      }
    }
    return out;
  }

  // Zone E — 2 dernières (plus récente en tête), feedback lecture.
  function rendreZoneE(act) {
    var liste = doc.getElementById('zeList');
    var vide  = doc.getElementById('zeEmpty');
    var toggle = doc.getElementById('zeToggle');
    if (!liste || !vide) return;

    if (act.length === 0) {
      vide.removeAttribute('hidden');
      liste.setAttribute('hidden', '');
      liste.innerHTML = '';
      if (toggle) { toggle.disabled = true; }
      return;
    }
    vide.setAttribute('hidden', '');
    liste.removeAttribute('hidden');
    var deux = act.slice(-2).reverse();
    liste.innerHTML = '';
    for (var j = 0; j < deux.length; j++) {
      var li = doc.createElement('li');
      li.textContent = ligneTexte(deux[j]);   // anti-injection
      liste.appendChild(li);
    }
    if (toggle) { toggle.disabled = (act.length === 0); }
  }

  // Corps de lecture calme : le fil complet, ordre de jeu (ASC,
  // coup d'envoi -> maintenant), lecture tribune.
  function rendreCorps(act) {
    var ul = doc.getElementById('specCorpsList');
    if (!ul) return;
    ul.innerHTML = '';
    if (act.length === 0) {
      var li0 = doc.createElement('li');
      li0.textContent = 'Aucune action pour l\'instant.';
      ul.appendChild(li0);
      return;
    }
    for (var i = 0; i < act.length; i++) {
      var li = doc.createElement('li');
      li.textContent = ligneTexte(act[i]);     // anti-injection
      ul.appendChild(li);
    }
  }

  // Overlay « fil complet » (lecture seule), même ordre de jeu.
  function rendreHistoComplet(act) {
    var ul = doc.getElementById('histoList');
    if (!ul) return;
    ul.innerHTML = '';
    if (act.length === 0) {
      var v = doc.createElement('li');
      v.className = 'suivi-histo__empty';
      v.textContent = 'Aucune action pour l\'instant.';
      ul.appendChild(v);
      return;
    }
    for (var i = 0; i < act.length; i++) {
      var li = doc.createElement('li');
      li.textContent = ligneTexte(act[i]);     // anti-injection
      ul.appendChild(li);
    }
  }

  // Rafraîchit l'écran de lecture depuis une chronologie déjà lue
  // (aucun appel réseau ici).
  function rendreLecture(lignes) {
    var act = actives(lignes);
    rendreScore(lignes);
    rendreChrono(lignes);
    rendreZoneE(act);
    rendreCorps(act);
    var ov = doc.getElementById('histoOverlay');
    if (ov && !ov.hasAttribute('hidden')) rendreHistoComplet(act);
  }

  // ============================================================
  // EN-TÊTE RENCONTRE (C12-g) — RGPD-safe, NON bloquant
  // ============================================================
  // Si C12-g échoue (réseau, etc.), l'écran fonctionne quand même
  // (score/fil via C12-d). On dégrade : titre par défaut + bandeau
  // statique « Vous suivez en spectateur ».
  function chargerEntete() {
    if (_enteteCharge || !_token) return;
    var cli = getEnteteClient();
    if (!cli) return;
    cli.rpc('get_entete_rencontre', { p_token: _token }).then(function (res) {
      var row = (res && Array.isArray(res.data)) ? (res.data[0] || null) : null;
      if (res && res.error) {
        console.error('MOM Hub Spectateur: get_entete_rencontre', res.error);
        return;   // dégradation honnête : on garde les défauts
      }
      if (!row) return;
      _enteteCharge = true;

      var titreEl = doc.getElementById('specEntete');
      if (titreEl) {
        var titre = (row.libelle && String(row.libelle).trim() !== '')
          ? String(row.libelle).trim() : 'Rencontre';
        titreEl.textContent = titre;
      }

      var metaEl = doc.getElementById('specMeta');
      if (metaEl) {
        var bouts = [];
        if (row.type_competition) bouts.push(String(row.type_competition));
        if (row.date_debut) {
          var d = new Date(row.date_debut);
          if (!isNaN(d.getTime())) {
            bouts.push(d.toLocaleDateString('fr-FR', {
              weekday: 'short', day: 'numeric', month: 'short'
            }) + ' ' + d.toLocaleTimeString('fr-FR', {
              hour: '2-digit', minute: '2-digit'
            }));
          }
        }
        if (row.domicile_exterieur) bouts.push(String(row.domicile_exterieur));
        if (row.site_libelle) bouts.push(String(row.site_libelle));
        metaEl.textContent = bouts.join('  ·  ');
      }

      // role_lien INFORME le bandeau (C2-Q1), n'active rien. Ce
      // fichier est lecture seule par construction quel que soit le
      // rôle : on ne branche AUCUN comportement dessus.
      var roleEl = doc.getElementById('specRole');
      if (roleEl) {
        roleEl.textContent = (row.role_lien === 'spectateur')
          ? 'Vous suivez en spectateur'
          : 'Vous suivez en spectateur';   // libellé fixe, honnête :
            // l'écran EST l'écran spectateur (C2-Q1) ; role_lien sert
            // de confirmation backend, jamais de décision d'UI.
      }
    }).catch(function (e) {
      console.error('MOM Hub Spectateur: get_entete_rencontre (réseau)', e);
      // Non bloquant : l'écran reste utilisable sans en-tête.
    });
  }

  // ============================================================
  // ÉTAT « EN COURS » (lecture live) + DÉGRADATION SUIVI-COACH-8
  // ============================================================
  // SUIVI-COACH-8 : « terminé » non détectable côté spectateur
  // (C12-d/C12-g sans état, aucun observable de fin). On n'affiche
  // JAMAIS un faux « Terminé » : pastille « En direct » tant que la
  // rencontre tourne, bouton « Rafraîchir » manuel offert en
  // continu (utile persona réseau quel que soit l'état) + auto ~10s.
  // La présentation « Terminé » distincte (C2-Q2 pt 4) est gatée :
  // _appliquerEtat('termine') reste prêt mais non déclenché tant
  // que SUIVI-COACH-8 n'expose pas le signal côté backend.
  function _appliquerEtat(etat) {
    var pastille = doc.getElementById('specStatut');
    var txt = doc.getElementById('specStatutTxt');
    var pied = doc.getElementById('specPied');
    if (etat === 'termine') {
      if (pastille) pastille.setAttribute('data-etat', 'termine');
      if (txt) txt.textContent = 'Terminé';
      stopTimer();                          // refresh arrêté (S-5.1.b)
      if (pied) pied.setAttribute('data-on', '1');
      return;
    }
    // 'direct' (défaut honnête tant que SUIVI-COACH-8 non levée)
    if (pastille) pastille.setAttribute('data-etat', 'direct');
    if (txt) txt.textContent = 'En direct';
    // Bouton manuel offert EN CONTINU (dégradation honnête).
    if (pied) pied.setAttribute('data-on', '1');
  }

  function afficherEnCours(lignes) {
    rendreLecture(lignes);
    _appliquerEtat('direct');               // SUIVI-COACH-8 : jamais
                                            // de faux « Terminé »
    montrerEcran('scrEnCours');
    chargerEntete();                        // RGPD-safe, non bloquant
  }

  // ============================================================
  // ROUTAGE / POLLING — réutilise SuiviClient.chargerEtatInitial
  // (distingue les 5 issues ; appelle get_chronologie_rencontre
  // sans p_inclure_annulees => annulées exclues côté RPC, récit
  // effectif C2-Q2). Réutilisé tel quel, suivi-client.js NON touché.
  // ============================================================
  function appliquerRoute(res, estRefresh) {
    var statut = res && res.statut;

    if (statut === 'jeton-absent') {
      afficherErreur(
        'Lien manquant. Demande le lien spectateur au coach.', false);
      return;
    }
    if (statut === 'jeton-invalide') {
      // Lien expiré / révoqué (J+1, ou régénéré côté Objet A).
      afficherErreur(
        'Ce lien de suivi n\'est plus actif. Demande un nouveau lien au coach.',
        false);
      return;
    }
    if (statut === 'erreur-reseau') {
      if (estRefresh) {
        // En cours de polling : on NE casse pas l'écran (le dernier
        // rendu reste affiché). Le prochain tick retentera.
        return;
      }
      afficherErreur(
        'Connexion impossible pour le moment. Vérifie ta connexion.', true);
      return;
    }
    if (statut === 'non-demarre') {
      // Match pas commencé (chronologie vide). Écran honnête SANS
      // bouton. On continue le polling pour basculer tout seul au
      // coup d'envoi (la promesse faite à l'écran d'attente).
      montrerEcran('scrAttente');
      armerPolling();
      return;
    }
    if (statut === 'demarre') {
      afficherEnCours(res.chronologie || []);
      armerPolling();
      return;
    }
    // Statut inattendu : dégradation honnête (jamais d'écran cassé).
    afficherErreur(
      'Suivi indisponible pour le moment. Réessaie dans un instant.', true);
  }

  function tick() {
    if (!_token) return;
    global.SuiviClient.chargerEtatInitial(_token).then(function (res) {
      appliquerRoute(res, true);
    }).catch(function (e) {
      // chargerEtatInitial ne rejette pas normalement ; garde-fou.
      console.error('MOM Hub Spectateur: tick()', e);
    });
  }

  function armerPolling() {
    if (_timer) return;                     // déjà armé
    _timer = global.setInterval(tick, REFRESH_MS);
  }

  // ============================================================
  // ARMEMENT UI (lecture seule) — « Tout voir » + Rafraîchir
  // ============================================================
  function armerUI() {
    var toggle = doc.getElementById('zeToggle');
    var ov = doc.getElementById('histoOverlay');
    var close = doc.getElementById('histoClose');
    if (toggle && ov && !toggle._specArme) {
      toggle._specArme = true;
      toggle.addEventListener('click', function () {
        // Re-dérive l'overlay depuis le dernier rendu de Zone E
        // (cohérent I5 : aucun état figé, on relit le DOM source).
        // Ici on relit la chronologie courante via un tick immédiat
        // qui re-rendra aussi l'overlay s'il est ouvert.
        ov.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
        tick();
      });
    }
    if (close && ov && !close._specArme) {
      close._specArme = true;
      close.addEventListener('click', function () {
        ov.setAttribute('hidden', '');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }
    var refresh = doc.getElementById('specRefresh');
    if (refresh && !refresh._specArme) {
      refresh._specArme = true;
      refresh.addEventListener('click', function () { tick(); });
    }
  }

  // ============================================================
  // BOOT
  // ============================================================
  function boot() {
    stopTimer();
    montrerEcran('scrLoading');

    if (!suiviClientPresent()) {
      afficherErreur(
        'Chargement incomplet. Recharge la page.', true);
      return;
    }

    _token = global.SuiviClient.getToken();   // re-dérivé URL (I5)
    armerUI();

    global.SuiviClient.chargerEtatInitial(_token).then(function (res) {
      appliquerRoute(res, false);
    }).catch(function (e) {
      console.error('MOM Hub Spectateur: boot()', e);
      afficherErreur(
        'Suivi indisponible pour le moment. Réessaie dans un instant.', true);
    });
  }

  // ============================================================
  // EXPOSITION (lecture seule — utilitaire de debug uniquement)
  // ============================================================
  global.Spectateur = { boot: boot };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  console.log(
    '%c🏉 MOM Hub · Spectateur (C-2) v1.0 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
