/**
 * MOM Hub · Temps de jeu (Objet C-1 — panneau d'estimation coach)
 * ==============================================================
 *
 * Cycle SUIVI-COACH-1, Objet C-1. Conception figée
 * Conception-SUIVI-COACH-1-ObjetC.md (C1-Q1/Q2/Q3, VALIDÉ Manu).
 *
 * C1-Q1 — Panneau de CONSULTATION, dans la section « Suivi de la
 *   rencontre » de la fiche événement (Objet A), phase aval. PAS
 *   dans B, PAS écran distinct, PAS suivi.html, PAS exposé au
 *   spectateur. Coach only (la fiche est déjà coach-authentifiée ;
 *   ce module n'auth rien, il consomme SupabaseHub.client). Ce
 *   fichier est un COMPOSANT AUTONOME que l'accroche
 *   evenements-browser.js (fichier 5, addition pure) MONTE dans la
 *   section ; il ne s'auto-boote pas sur une page propre.
 * C1-Q2 — Estimation PAR JOUEUR, arrondie (« ~38 min »), avec un
 *   LIBELLÉ D'INCERTITUDE PERMANENT ET CONSTITUTIF (non refermable).
 *   Panneau REPLIÉ par défaut (<details>) : la forme dit la
 *   fiabilité (S-5.4, anti-V6). Lecture via C12-k (chronologie
 *   coach, déjà livré) + C12-l (compo coach, wrapper v1.16) ;
 *   calcul CÔTÉ CLIENT. Découpage par période / barre « officielle »
 *   / alerte auto = ÉCARTÉS (jamais donnée d'autorité).
 * C1-Q3 — LECTURE PURE : zéro écriture, AUCUNE RPC propre (consomme
 *   l'existant : getChronologieRencontreCoach + getCompoReduite-
 *   RencontreCoach + libelleJoueurSuivi de supabase-client.js).
 *   JAMAIS consolidé nulle part (volatil = traduction technique de
 *   « jamais autorité »). Frontière dure QUOI/POURQUOI : aucun
 *   champ analyse/commentaire (l'analyse = le Rapport). Zéro
 *   couplage module->module (PI-1 : lit le Core, ne parle ni à B
 *   ni à C-2 ; un correctif Mode Vidéo se reflète PARCE QUE B a
 *   écrit dans le Core, pas par un lien direct).
 *
 * DÉGRADATION HONNÊTE — SUIVI-COACH-7 (substitutions mono-ligne) +
 *   enveloppe vérifiée à la source (validée Manu) :
 *   • Base de temps = `horodatage` (TIMESTAMPTZ, DEFAULT NOW(),
 *     TOUJOURS présent au payload C12-k) car `minute_match` est
 *     souvent NULL (moteur chrono jamais construit — confirmé
 *     suivi-app.js). horodatage = heure de SAISIE, ≈ temps réel
 *     en live, PAS l'horloge de match (mi-temps/arrêts inclus,
 *     latence de saisie). Caveat porté par le libellé permanent.
 *   • TITULAIRES (role='titulaire', compo C12-l) : comptés du
 *     coup d'envoi (1ʳᵉ ligne live) jusqu'à une SORTIE FIABLE =
 *     carton rouge (obs-A-rouge) OU blessure (obs-A-blessure)
 *     pour CE joueur, sinon fin/instant courant. Estimation
 *     arrondie « ~N min », jamais de secondes.
 *   • SUBSTITUTIONS (obs-A-substitution) : MONO-LIGNE, sens
 *     ambigu (SUIVI-COACH-7) -> JAMAIS utilisées pour démarrer/
 *     arrêter un joueur, JAMAIS un chiffre fabriqué. Comptées et
 *     signalées sous le libellé permanent.
 *   • REMPLAÇANTS (role='remplacant') : entrée non reconstituable
 *     -> « durée indéterminée », jamais un faux nombre.
 *   • RÉSERVE (role='reserve') : « non entré » (sauf entrée non
 *     détectée — dit honnêtement).
 *   • CARTON JAUNE (obs-A-jaune) : exclusion temporaire de durée
 *     variable selon compétition/catégorie -> NON soustrait
 *     (fabriquerait une précision absente) ; signalé seulement.
 *   • Lignes Mode Vidéo (source_saisie='video') : horodatage =
 *     heure de revue, PAS de match -> exclues des ANCRES de
 *     timeline ; un rouge/blessure vidéo reste une sortie réelle
 *     mais « durée non chiffrable » pour ce joueur (honnête).
 *   Le LIBELLÉ D'INCERTITUDE fait le travail d'honnêteté
 *   épistémique (S-5.4 : « la forme dit la fiabilité ») : il est
 *   constitutif, permanent, non refermable. AUCUNE nouvelle dette
 *   (c'est SUIVI-COACH-7 explicité ; DA-2 déjà tracée ailleurs,
 *   non rouverte ici).
 *
 * 4 ÉTATS DE CYCLE DE VIE HONNÊTES (C1-Q3, miroir A-Q2). Côté
 *   COACH l'état de la rencontre est connu via la fiche (Objet A) :
 *   SUIVI-COACH-8 (terminé non détectable côté SPECTATEUR) NE
 *   touche PAS C-1. `opts.etat` (transmis par l'accroche) =
 *   creation|compo|joue|resultat|archive|annule (modélisation) :
 *     • pas commencé (chronologie vide) -> panneau NON proposé
 *       (rien à estimer ; pas de panneau vide trompeur).
 *     • en cours -> estimations « à l'instant » (titulaires
 *       comptés jusqu'au dernier horodatage connu).
 *     • terminé/résultat -> estimations finales (jusqu'au dernier
 *       horodatage). C-1 ne re-consolide RIEN (rien à consolider).
 *     • archivé -> chronologie figée -> estimation figée de fait.
 *
 * I5 — zéro localStorage/sessionStorage. ANTI-INJECTION —
 *   textContent partout (aucune donnée via innerHTML).
 *
 * Dépendances : SupabaseHub (supabase-client.js v1.16) chargé AVANT
 *   (l'accroche vit dans evenements.html, déjà coach-authentifié).
 *
 * Version : 1.0 — mai 2026 (conv Production, couloir Objet C).
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var STYLE_ID = 'tdj-styles';

  // Référentiel observables (observables-match.json, vérifié source).
  var OBS_ROUGE = 'obs-A-rouge';
  var OBS_BLESSURE = 'obs-A-blessure';
  var OBS_JAUNE = 'obs-A-jaune';
  var OBS_SUBSTITUTION = 'obs-A-substitution';

  // ============================================================
  // STYLES SCOPÉS (.tdj-*) — injectés une seule fois. Volontairement
  // autonomes : NE dépend d'aucune classe de evenements-browser/
  // hub.css (anti-invention : je ne connais pas leurs internes ici).
  // Référence des var() neutres avec fallback sûr.
  // ============================================================
  function injecterStyles() {
    if (doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '.tdj{border:1px solid var(--line,#cabe9f);border-radius:12px;',
      'background:var(--card,#fff);overflow:hidden;margin:12px 0;',
      'font-family:Manrope,system-ui,sans-serif;}',
      '.tdj>summary{cursor:pointer;list-style:none;padding:14px 16px;',
      'display:flex;align-items:center;gap:10px;font-weight:700;',
      'color:var(--ink,#0c3d24);user-select:none;}',
      '.tdj>summary::-webkit-details-marker{display:none;}',
      '.tdj>summary .tdj-chev{margin-left:auto;transition:transform .2s;',
      'opacity:.6;font-size:13px;}',
      '.tdj[open]>summary .tdj-chev{transform:rotate(90deg);}',
      '.tdj[open]>summary{border-bottom:1px solid var(--line,#cabe9f);}',
      '.tdj-body{padding:14px 16px;}',
      '.tdj-note{margin:0 0 12px;font-size:12.5px;line-height:1.5;',
      'color:#8a5a00;background:#fff7e6;border:1px solid #e8d28a;',
      'border-radius:8px;padding:10px 12px;}',
      '.tdj-note strong{font-weight:700;}',
      '.tdj-list{list-style:none;margin:0;padding:0;}',
      '.tdj-row{display:flex;align-items:baseline;gap:10px;',
      'padding:8px 0;border-bottom:1px solid var(--line,#eee);',
      'font-size:14px;}',
      '.tdj-row:last-child{border-bottom:none;}',
      '.tdj-num{font-variant-numeric:tabular-nums;font-weight:700;',
      'min-width:2.2em;color:var(--ink-mute,#6b7a6f);}',
      '.tdj-nom{flex:1 1 auto;color:var(--ink,#0c3d24);}',
      '.tdj-est{font-variant-numeric:tabular-nums;font-weight:700;',
      'white-space:nowrap;}',
      '.tdj-est[data-q="estime"]{color:var(--ink,#0c3d24);}',
      '.tdj-est[data-q="indetermine"]{color:var(--ink-mute,#6b7a6f);',
      'font-weight:600;}',
      '.tdj-est[data-q="nonentre"]{color:var(--ink-mute,#9aa49b);',
      'font-weight:500;}',
      '.tdj-grp{margin:14px 0 6px;font-size:11px;font-weight:700;',
      'letter-spacing:.1em;text-transform:uppercase;',
      'color:var(--ink-mute,#6b7a6f);}',
      '.tdj-grp:first-child{margin-top:0;}',
      '.tdj-events{margin:12px 0 0;font-size:12.5px;line-height:1.5;',
      'color:var(--ink-mute,#6b7a6f);}',
      '.tdj-empty{margin:0;color:var(--ink-mute,#6b7a6f);font-size:14px;}',
      '.tdj-err{margin:0;color:#8a1b14;font-size:14px;}'
    ].join('');
    doc.head.appendChild(st);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function libelle(row) {
    // RÉUTILISE la règle UNIQUE de dégradation (supabase-client v1.16).
    if (global.SupabaseHub
        && typeof global.SupabaseHub.libelleJoueurSuivi === 'function') {
      return global.SupabaseHub.libelleJoueurSuivi(row);
    }
    // Repli défensif strictement aligné (ne jamais casser l'écran).
    if (!row) return '?';
    var n = (row.numero_maillot != null) ? String(row.numero_maillot) : null;
    var c = (row.nom_court && String(row.nom_court).trim() !== '')
      ? String(row.nom_court).trim() : null;
    if (n && c) return n + ' ' + c;
    return n || c || '?';
  }

  function ms(h) {
    var d = new Date(h);
    var t = d.getTime();
    return isNaN(t) ? null : t;
  }

  // Arrondi assumé (C1-Q2 : « ~38 min », jamais de secondes). On
  // arrondit à 1 min ; le « ~ » + le libellé permanent disent que
  // ce n'est pas exact.
  function minutes(deltaMs) {
    return Math.max(0, Math.round(deltaMs / 60000));
  }

  // ============================================================
  // CALCUL — dégradation honnête (voir en-tête)
  // ============================================================
  function calculer(compo, chrono) {
    // Lignes actives uniquement (annulées déjà exclues côté RPC ;
    // re-filtre défensif).
    var lignes = [];
    for (var i = 0; i < chrono.length; i++) {
      if (chrono[i] && chrono[i].annule === true) continue;
      lignes.push(chrono[i]);
    }
    // Tri horodatage ASC (déjà trié côté RPC ; défensif).
    lignes.sort(function (a, b) {
      return (ms(a.horodatage) || 0) - (ms(b.horodatage) || 0);
    });

    // Timeline : ancres = lignes LIVE uniquement (les lignes Mode
    // Vidéo ont un horodatage de revue, pas de match).
    var live = [];
    for (var j = 0; j < lignes.length; j++) {
      if (lignes[j].source_saisie === 'video') continue;
      var t = ms(lignes[j].horodatage);
      if (t != null) live.push(t);
    }
    var tDebut = live.length ? live[0] : null;
    var tFin = live.length ? live[live.length - 1] : null;

    // Sortie fiable par joueur (rouge / blessure), 1ʳᵉ occurrence.
    // On accepte la ligne quelle que soit sa source ; mais si la
    // ligne est vidéo (horodatage de revue), la durée n'est PAS
    // chiffrable -> on marque la sortie sans nombre (honnête).
    var sortie = {};   // joueur_uuid -> { t:ms|null, motif, chiffrable }
    var nbSubs = 0, nbJaunes = 0, nbRouges = 0, nbBlessures = 0;
    for (var k = 0; k < lignes.length; k++) {
      var l = lignes[k];
      if (l.observable_id === OBS_SUBSTITUTION) { nbSubs++; continue; }
      if (l.observable_id === OBS_JAUNE) { nbJaunes++; continue; }
      var motif = null;
      if (l.observable_id === OBS_ROUGE) { motif = 'carton rouge'; nbRouges++; }
      else if (l.observable_id === OBS_BLESSURE) { motif = 'blessure'; nbBlessures++; }
      if (!motif) continue;
      var ju = l.joueur_uuid;
      if (!ju || sortie[ju]) continue;       // 1ʳᵉ sortie fiable
      var estVideo = (l.source_saisie === 'video');
      var tl = estVideo ? null : ms(l.horodatage);
      sortie[ju] = { t: tl, motif: motif, chiffrable: (tl != null) };
    }

    // Estimation par joueur, à partir de la compo (effectif réel).
    var titulaires = [], remplacants = [], reserves = [];
    for (var c = 0; c < compo.length; c++) {
      var p = compo[c];
      var role = p.role || 'titulaire';
      var ligneEst;
      if (role === 'titulaire') {
        var so = sortie[p.joueur_uuid];
        if (so) {
          if (so.chiffrable && tDebut != null && so.t != null && so.t >= tDebut) {
            ligneEst = {
              q: 'estime',
              txt: '~' + minutes(so.t - tDebut) + ' min  ·  sorti (' + so.motif + ')'
            };
          } else {
            ligneEst = {
              q: 'indetermine',
              txt: 'sorti (' + so.motif + ') · durée non chiffrable'
            };
          }
        } else if (tDebut != null && tFin != null) {
          ligneEst = { q: 'estime', txt: '~' + minutes(tFin - tDebut) + ' min' };
        } else {
          ligneEst = { q: 'indetermine', txt: 'durée indéterminée' };
        }
        titulaires.push({ p: p, est: ligneEst });
      } else if (role === 'remplacant') {
        // Entrée non reconstituable (subs mono-ligne, SUIVI-COACH-7).
        remplacants.push({
          p: p,
          est: { q: 'indetermine', txt: 'entré en cours · durée indéterminée' }
        });
      } else {
        // 'reserve' (ou inconnu, défensif)
        reserves.push({
          p: p,
          est: { q: 'nonentre', txt: 'non entré' }
        });
      }
    }

    return {
      titulaires: titulaires,
      remplacants: remplacants,
      reserves: reserves,
      nbSubs: nbSubs,
      nbJaunes: nbJaunes,
      nbRouges: nbRouges,
      nbBlessures: nbBlessures,
      aLive: live.length > 0
    };
  }

  // ============================================================
  // RENDU
  // ============================================================
  function rangee(item) {
    var li = doc.createElement('li');
    li.className = 'tdj-row';
    var num = doc.createElement('span');
    num.className = 'tdj-num';
    num.textContent = (item.p.numero_maillot != null)
      ? String(item.p.numero_maillot) : '—';
    var nom = doc.createElement('span');
    nom.className = 'tdj-nom';
    nom.textContent = libelle(item.p);     // anti-injection
    var est = doc.createElement('span');
    est.className = 'tdj-est';
    est.setAttribute('data-q', item.est.q);
    est.textContent = item.est.txt;        // anti-injection
    li.appendChild(num);
    li.appendChild(nom);
    li.appendChild(est);
    return li;
  }

  function groupe(corps, titre, items) {
    if (!items.length) return;
    var h = doc.createElement('p');
    h.className = 'tdj-grp';
    h.textContent = titre;
    corps.appendChild(h);
    var ul = doc.createElement('ul');
    ul.className = 'tdj-list';
    for (var i = 0; i < items.length; i++) ul.appendChild(rangee(items[i]));
    corps.appendChild(ul);
  }

  function rendre(corps, r) {
    corps.innerHTML = '';

    // Libellé d'incertitude PERMANENT et CONSTITUTIF (C1-Q2 /
    // S-5.4). Non refermable : c'est lui qui dit la fiabilité.
    var note = doc.createElement('p');
    note.className = 'tdj-note';
    var strong = doc.createElement('strong');
    strong.textContent = 'Estimation, pas une mesure. ';
    note.appendChild(strong);
    note.appendChild(doc.createTextNode(
      'Calculée sur les actions saisies (heure de saisie, ≈ temps '
      + 'réel : la mi-temps et les arrêts sont inclus, pas l\'horloge '
      + 'de match). Les remplacements ne sont pas détaillés : seuls '
      + 'les titulaires et les sorties sur carton rouge ou blessure '
      + 'sont estimés ; les entrées de remplaçants ne sont pas '
      + 'reconstituables. Indication de coup d\'œil, jamais une '
      + 'donnée d\'autorité.'
    ));
    corps.appendChild(note);

    var aJoueurs = r.titulaires.length || r.remplacants.length
      || r.reserves.length;
    if (!aJoueurs) {
      var vide = doc.createElement('p');
      vide.className = 'tdj-empty';
      vide.textContent = 'Aucune composition disponible pour estimer '
        + 'le temps de jeu.';
      corps.appendChild(vide);
      return;
    }

    groupe(corps, 'Titulaires', r.titulaires);
    groupe(corps, 'Remplaçants', r.remplacants);
    groupe(corps, 'Réserve', r.reserves);

    // Événements non quantifiés, signalés honnêtement.
    var ev = [];
    if (r.nbSubs) ev.push(r.nbSubs + ' remplacement' + (r.nbSubs > 1 ? 's' : '')
      + ' saisi' + (r.nbSubs > 1 ? 's' : '') + ' (non détaillé'
      + (r.nbSubs > 1 ? 's' : '') + ')');
    if (r.nbRouges) ev.push(r.nbRouges + ' carton' + (r.nbRouges > 1 ? 's' : '')
      + ' rouge' + (r.nbRouges > 1 ? 's' : ''));
    if (r.nbBlessures) ev.push(r.nbBlessures + ' blessure'
      + (r.nbBlessures > 1 ? 's' : ''));
    if (r.nbJaunes) ev.push(r.nbJaunes + ' carton' + (r.nbJaunes > 1 ? 's' : '')
      + ' jaune' + (r.nbJaunes > 1 ? 's' : '')
      + ' (exclusion temporaire, non décomptée)');
    if (ev.length) {
      var p = doc.createElement('p');
      p.className = 'tdj-events';
      p.textContent = 'Événements : ' + ev.join(' · ') + '.';
      corps.appendChild(p);
    }
  }

  function rendreErreur(corps, msg) {
    corps.innerHTML = '';
    var p = doc.createElement('p');
    p.className = 'tdj-err';
    p.textContent = msg;
    corps.appendChild(p);
  }

  // ============================================================
  // ÉTAT DE LA RENCONTRE (transmis par l'accroche, côté coach)
  // ============================================================
  // Pas commencé = pas de panneau (rien à estimer ; pas de panneau
  // vide trompeur). On considère « pas commencé » si l'état est
  // amont (creation|compo) OU si la chronologie est vide.
  function etatAmont(etat) {
    return etat === 'creation' || etat === 'compo'
        || etat === 'annule' || etat === 'annulee';
  }

  // ============================================================
  // API PUBLIQUE — montée par l'accroche evenements-browser.js
  // ============================================================
  var TempsDeJeu = {

    /**
     * Monte le panneau temps de jeu (replié) dans `container`.
     * Lecture pure ; aucune écriture ; aucune RPC propre.
     *
     * @param {HTMLElement} container hôte (fourni par l'accroche)
     * @param {string} evenementUuid UUID de la rencontre
     * @param {Object} [opts] { etat?:string } état rencontre
     *        (creation|compo|joue|resultat|archive|annule),
     *        connu côté coach via la fiche (Objet A).
     * @returns {Promise<void>}
     */
    async monter(container, evenementUuid, opts) {
      if (!container || !evenementUuid) return;
      var etat = (opts && opts.etat) ? String(opts.etat) : null;

      // Pas commencé -> panneau NON proposé (C1-Q3).
      if (etat && etatAmont(etat)) { return; }

      injecterStyles();

      var det = doc.createElement('details');
      det.className = 'tdj';
      var sum = doc.createElement('summary');
      var t = doc.createElement('span');
      t.textContent = '⏱ Temps de jeu (estimation)';
      var chev = doc.createElement('span');
      chev.className = 'tdj-chev';
      chev.setAttribute('aria-hidden', 'true');
      chev.textContent = '▸';
      sum.appendChild(t);
      sum.appendChild(chev);
      var body = doc.createElement('div');
      body.className = 'tdj-body';
      var loading = doc.createElement('p');
      loading.className = 'tdj-empty';
      loading.textContent = 'Calcul…';
      body.appendChild(loading);
      det.appendChild(sum);
      det.appendChild(body);
      container.appendChild(det);

      if (!global.SupabaseHub
          || typeof global.SupabaseHub.getCompoReduiteRencontreCoach
             !== 'function'
          || typeof global.SupabaseHub.getChronologieRencontreCoach
             !== 'function') {
        rendreErreur(body, 'Temps de jeu indisponible (client non chargé).');
        return;
      }

      try {
        var res = await Promise.all([
          global.SupabaseHub.getCompoReduiteRencontreCoach(evenementUuid),
          global.SupabaseHub.getChronologieRencontreCoach(evenementUuid)
        ]);
        var compo = Array.isArray(res[0]) ? res[0] : [];
        var chrono = Array.isArray(res[1]) ? res[1] : [];

        // Pas commencé (chronologie vide) -> panneau retiré.
        if (chrono.length === 0) {
          if (det.parentNode) det.parentNode.removeChild(det);
          return;
        }
        rendre(body, calculer(compo, chrono));
      } catch (e) {
        console.error('MOM Hub: TempsDeJeu.monter()', e);
        rendreErreur(body,
          'Temps de jeu indisponible pour le moment.');
      }
    }
  };

  global.TempsDeJeu = TempsDeJeu;

  console.log(
    '%c🏉 MOM Hub · Temps de jeu (C-1) v1.0 chargé',
    'color: #2D7D46; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);
