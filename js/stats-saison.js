/**
 * MOM Hub · Stats de saison
 * =========================
 * Module READ-ONLY. Deux objets (pt 61, doc Conception-Statistiques-Saison-v1) :
 *   - Objet 1 : Fiche stats joueur (restitution famille, un joueur)
 *   - Objet 2 : Vue pilotage (équipe en haut + effectif en lignes triables)
 *
 * Version : 1.0 — pt 61. Conception FAIT FOI md5 50012ece.
 *
 * SOCLE PROUVÉ (sondes S61.1→S61.5, lecture compositions-editor.js v3.62 +
 * supabase-client.js v1.47) :
 *   - Lien saison D-FICHE-B : compositions.compo_base_origine_id + cote='mom'
 *     + type_compo='match' + est_active=true. JAMAIS evenement_equipes.equipe_id
 *     (NULL multi-équipes → exclut tout ; prouvé 164 vs 0).
 *     Voie câblée = SupabaseHub.listMatchsParBaseOrigine(baseId) (NE filtre PAS
 *     par equipe_id — commentaire bug 6c-6 multi-équipes).
 *   - composition_joueurs.joueur_id EST un personnes.id (S61.4, true).
 *     Filtre ligne : role ∈ (titulaire, remplacant). NE PAS filtrer sur etat
 *     (compo match test = brouillon, learning pt 60). Filtre compo : est_active.
 *   - Identité RGPD-safe : SupabaseHub._resolveNoms([joueur_id]) → Map
 *     uuid→{nom,prenom}. L'embed personnes(...) de getCompoComplete renvoie NULL
 *     côté client (RLS) → traité en bonus dégradable, jamais comme source sûre.
 *   - Postes : SupabaseHub.getPostes() → SELECT direct (table lisible client).
 *     Colonnes (S61.5) : id, code, libelle_long, libelle_court, numero_xv, ligne.
 *     Affichage = libelle_court || libelle_long || code.
 *   - Agrégat équipe : RÉIMPLÉMENTE _deduitAgrege de l'éditeur (fonction privée,
 *     non exportée → duplication assumée, dette STATS-AGGREGATS-DUP 🟢).
 *     Source : SupabaseHub.getChronologieRencontreCoach(evt, true).
 *     UUIDs Cat A prouvés : obs-A-essai, obs-A-melee-gagnee/-perdue,
 *     obs-A-touche-gagnee/-perdue ; cartons = libellé observable contient 'carton'.
 *   - Temps de jeu : SupabaseHub.getTempsDeJeuRencontre(evt[, evtEquipeId])
 *     → {ok, data:[{out_minutes_jeu, out_chrono_complet, ...}]}. pt 60.
 *
 * DÉGRADATION HONNÊTE (D-FICHE-D) : jamais un faux 0. Temps de jeu / faits de
 * jeu / Cat B prouvés sur 1 seul match test → libellé d'attente explicite.
 * Assiduité (D-FICHE-C) : presences VIDE → placeholder « à constituer ».
 *
 * Décisions tranchées pt 61 (tracées) :
 *   - Effectif pilotage déduit des compos (compo_base_origine_id), PAS
 *     getJoueursEquipe (dette PILOTAGE-EFFECTIF-COMPO 🟢).
 *   - Entrée pilotage = une compo de base (?compo_base=). Multi-base d'une même
 *     équipe = évolution additive (dette PILOTAGE-MULTI-BASE 🟢).
 */
(function () {
  'use strict';

  // ---- Constantes observables Cat A (prouvées, sonde pt 55) ----
  var OBS_ESSAI = 'obs-A-essai';
  var OBS_MELEE_G = 'obs-A-melee-gagnee';
  var OBS_MELEE_P = 'obs-A-melee-perdue';
  var OBS_TOUCHE_G = 'obs-A-touche-gagnee';
  var OBS_TOUCHE_P = 'obs-A-touche-perdue';

  // ---- Utilitaires ----
  function _hub() {
    return (typeof window !== 'undefined' && window.SupabaseHub) ? window.SupabaseHub : null;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Label charte « Prénom + Initiale. » (cf. export v2 « Agathe T. »).
  function labelJoueur(nom, prenom) {
    var p = (prenom || '').trim();
    var n = (nom || '').trim();
    if (!p && !n) return null;
    var initiale = n ? (n.charAt(0).toUpperCase() + '.') : '';
    return (p + (initiale ? ' ' + initiale : '')).trim();
  }

  // ---- Chargement des postes (indexés par id) ----
  var _postesIndex = null;
  function chargerPostes() {
    if (_postesIndex) return Promise.resolve(_postesIndex);
    var hub = _hub();
    if (!hub || typeof hub.getPostes !== 'function') {
      _postesIndex = {};
      return Promise.resolve(_postesIndex);
    }
    return Promise.resolve(hub.getPostes()).then(function (rows) {
      var idx = {};
      (Array.isArray(rows) ? rows : []).forEach(function (p) {
        if (p && p.id) idx[p.id] = p;
      });
      _postesIndex = idx;
      return idx;
    }).catch(function () {
      _postesIndex = {};
      return _postesIndex;
    });
  }

  function libellePoste(posteId) {
    if (!posteId) return '—';
    var p = _postesIndex ? _postesIndex[posteId] : null;
    if (!p) return '#' + String(posteId).slice(0, 8); // repli honnête
    return p.libelle_court || p.libelle_long || p.code || ('#' + String(posteId).slice(0, 8));
  }
  function numeroXvPoste(posteId) {
    var p = _postesIndex ? _postesIndex[posteId] : null;
    return (p && typeof p.numero_xv === 'number') ? p.numero_xv : 9999;
  }

  // ---- Résolution des noms en lot (RGPD-safe) ----
  function resoudreNoms(uuids) {
    var hub = _hub();
    if (!hub || typeof hub._resolveNoms !== 'function') return Promise.resolve(new Map());
    return Promise.resolve(hub._resolveNoms(uuids)).catch(function () { return new Map(); });
  }

  // ============================================================
  // LECTURE DES COMPOS MATCH D'UNE BASE (lien saison D-FICHE-B)
  // ------------------------------------------------------------
  // listMatchsParBaseOrigine renvoie TOUTES les compos de la base (sans filtre
  // est_active) → on filtre est_active ici. type_compo='match' déjà filtré par
  // le wrapper. On garde l'evenement_id (nécessaire chrono + temps de jeu).
  // ============================================================
  function listerComposMatch(baseId) {
    var hub = _hub();
    if (!hub || typeof hub.listMatchsParBaseOrigine !== 'function') return Promise.resolve([]);
    return Promise.resolve(hub.listMatchsParBaseOrigine(baseId)).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).filter(function (c) {
        return c && c.est_active === true && c.type_compo === 'match';
      });
    }).catch(function () { return []; });
  }

  // Charge les lignes composition_joueurs effectives d'une compo (titulaire /
  // remplaçant). NE filtre PAS sur etat (learning pt 60). L'embed personnes(...)
  // est NULL côté client (RLS) → on ne lit que les colonnes propres.
  function lignesEffectives(compoId) {
    var hub = _hub();
    if (!hub || typeof hub.getCompoComplete !== 'function') return Promise.resolve([]);
    return Promise.resolve(hub.getCompoComplete(compoId)).then(function (res) {
      if (!res || !Array.isArray(res.joueurs)) return [];
      return res.joueurs.filter(function (l) {
        return l && (l.role === 'titulaire' || l.role === 'remplacant');
      });
    }).catch(function () { return []; });
  }

  // ============================================================
  // AGRÉGAT EFFECTIF SAISON (par joueur, sur toutes les compos match de la base)
  // ------------------------------------------------------------
  // Retourne { parJoueur: { joueurId: {
  //   postes:{posteId:count}, matchs, titulaire, remplacant, depannage } },
  //   nbMatchs, evenements:[evtId], compoParEvt:{evtId:compoId} }.
  // Le COUNT par poste/rôle est un COUNT DE LIGNES (1 ligne = 1 présence en
  // compo match), pas un DISTINCT (S61.1 : 4 lignes/joueur/base = 4 matchs).
  // ============================================================
  function agregerEffectifSaison(baseId) {
    return listerComposMatch(baseId).then(function (compos) {
      var nbMatchs = compos.length;
      var evenements = [];
      var compoParEvt = {};
      compos.forEach(function (c) {
        if (c.evenement_id) { evenements.push(c.evenement_id); compoParEvt[c.evenement_id] = c.id; }
      });
      return Promise.all(compos.map(function (c) {
        return lignesEffectives(c.id);
      })).then(function (toutesLignes) {
        var parJoueur = {};
        toutesLignes.forEach(function (lignes) {
          lignes.forEach(function (l) {
            var jid = l.joueur_id;
            if (!jid) return;
            if (!parJoueur[jid]) {
              parJoueur[jid] = { postes: {}, matchs: 0, titulaire: 0, remplacant: 0, depannage: false };
            }
            var rec = parJoueur[jid];
            rec.matchs += 1;
            if (l.role === 'titulaire') rec.titulaire += 1;
            else if (l.role === 'remplacant') rec.remplacant += 1;
            if (l.poste_id) rec.postes[l.poste_id] = (rec.postes[l.poste_id] || 0) + 1;
            if (l.est_depannage_hors_categorie === true) rec.depannage = true;
          });
        });
        return { parJoueur: parJoueur, nbMatchs: nbMatchs, evenements: evenements, compoParEvt: compoParEvt };
      });
    });
  }

  // Poste principal d'un joueur = poste le plus fréquent (départage par numero_xv).
  function postePrincipal(postesCount) {
    var best = null, bestN = -1;
    for (var pid in postesCount) {
      if (!Object.prototype.hasOwnProperty.call(postesCount, pid)) continue;
      var n = postesCount[pid];
      if (n > bestN || (n === bestN && numeroXvPoste(pid) < numeroXvPoste(best))) {
        best = pid; bestN = n;
      }
    }
    return best;
  }

  // ============================================================
  // AGRÉGAT ÉQUIPE (réimplémentation de _deduitAgrege, dette STATS-AGGREGATS-DUP)
  // ------------------------------------------------------------
  // Dégradation honnête : un match sans chronologie n'ajoute AUCUN chiffre
  // (compté nbRenseignes, jamais un faux 0). cartons = libellé contient 'carton'.
  // ============================================================
  function _libelleObs(oid) {
    // Réutilise SuiviObs si l'éditeur est chargé sur la page ; sinon repli null.
    if (typeof window !== 'undefined' && window.SuiviObs && typeof window.SuiviObs.libelle === 'function') {
      return window.SuiviObs.libelle(oid);
    }
    return null;
  }
  function _estCarton(oid) {
    var info = _libelleObs(oid);
    var lib = (info && info.libelle ? info.libelle : '').toLowerCase();
    return lib.indexOf('carton') !== -1;
  }

  function agregerEquipe(evenements) {
    var hub = _hub();
    var base = {
      momTotal: 0, advTotal: 0, nbMatchs: (evenements || []).length, nbRenseignes: 0,
      essaisNous: 0, essaisAdv: 0, cartons: 0, v: 0, n: 0, d: 0,
      meleeG: 0, meleeP: 0, toucheG: 0, toucheP: 0, parJoueur: {}, indispo: false
    };
    if (!hub || typeof hub.getChronologieRencontreCoach !== 'function') {
      base.indispo = true; return Promise.resolve(base);
    }
    if (!evenements || evenements.length === 0) return Promise.resolve(base);

    return Promise.all(evenements.map(function (evt) {
      return Promise.resolve(hub.getChronologieRencontreCoach(evt, true))
        .then(function (lignes) { return Array.isArray(lignes) ? lignes : []; })
        .catch(function () { return []; });
    })).then(function (parMatch) {
      parMatch.forEach(function (arr) {
        var eff = arr.filter(function (l) { return l && l.annule !== true; });
        if (eff.length === 0) return; // match non renseigné → rien (honnête)
        base.nbRenseignes += 1;
        var mom = 0, adv = 0;
        eff.forEach(function (l) {
          var advLigne = (l.equipe_concernee === 'adverse');
          var oid = l.observable_id;
          var pts = (typeof l.valeur_points === 'number') ? l.valeur_points : 0;
          if (pts) { if (advLigne) adv += pts; else mom += pts; }
          if (oid === OBS_ESSAI) { if (advLigne) base.essaisAdv += 1; else base.essaisNous += 1; }
          if (!advLigne && _estCarton(oid)) base.cartons += 1;
          if (!advLigne) {
            if (oid === OBS_MELEE_G) base.meleeG += 1;
            else if (oid === OBS_MELEE_P) base.meleeP += 1;
            else if (oid === OBS_TOUCHE_G) base.toucheG += 1;
            else if (oid === OBS_TOUCHE_P) base.toucheP += 1;
          }
          if (!advLigne && l.joueur_uuid) {
            if (!base.parJoueur[l.joueur_uuid]) base.parJoueur[l.joueur_uuid] = { pts: 0, essais: 0 };
            if (pts) base.parJoueur[l.joueur_uuid].pts += pts;
            if (oid === OBS_ESSAI) base.parJoueur[l.joueur_uuid].essais += 1;
          }
        });
        base.momTotal += mom; base.advTotal += adv;
        if (mom > adv) base.v += 1; else if (mom < adv) base.d += 1; else base.n += 1;
      });
      return base;
    });
  }

  // ============================================================
  // TEMPS DE JEU (pt 60) — par joueur, agrégé sur les matchs de la base.
  // out_chrono_complet=false partout aujourd'hui → minutes NULL → « — ».
  // Retourne { parJoueur:{joueurId:{minutes, chronoComplets, matchsChrono}},
  //            auMoinsUnChrono:bool }.
  // ============================================================
  function agregerTempsDeJeu(evenements) {
    var hub = _hub();
    var out = { parJoueur: {}, auMoinsUnChrono: false };
    if (!hub || typeof hub.getTempsDeJeuRencontre !== 'function' || !evenements || !evenements.length) {
      return Promise.resolve(out);
    }
    return Promise.all(evenements.map(function (evt) {
      return Promise.resolve(hub.getTempsDeJeuRencontre(evt))
        .then(function (res) { return (res && res.ok && Array.isArray(res.data)) ? res.data : []; })
        .catch(function () { return []; });
    })).then(function (parMatch) {
      parMatch.forEach(function (lignes) {
        lignes.forEach(function (l) {
          var jid = l.joueur_id || l.out_joueur_id || l.personne_id;
          if (!jid) return;
          if (!out.parJoueur[jid]) out.parJoueur[jid] = { minutes: 0, chronoComplets: 0, matchsChrono: 0 };
          var rec = out.parJoueur[jid];
          var complet = (l.out_chrono_complet === true);
          if (complet) {
            out.auMoinsUnChrono = true;
            rec.chronoComplets += 1;
            var m = (typeof l.out_minutes_jeu === 'number') ? l.out_minutes_jeu : 0;
            rec.minutes += m;
            rec.matchsChrono += 1;
          }
        });
      });
      return out;
    });
  }

  function fmtTempsJeu(rec) {
    // Dégradation honnête (D-FICHE-D) : jamais 0 si aucun chrono complet.
    if (!rec || rec.chronoComplets === 0) return '—';
    return rec.minutes + ' min';
  }

  // ============================================================
  // OBJET 1 — FICHE STATS JOUEUR (famille)
  // ------------------------------------------------------------
  // Agrège un joueur sur TOUTE sa saison via listComposMatchDuJoueur (pt 61,
  // wrapper v1.48) : ses lignes de compo match mom actives, toutes bases
  // confondues, sans jointure equipe_id (D-FICHE-B). Entrée = ?joueur_id= seul.
  // ============================================================
  function _agregerJoueurSaison(lignes) {
    // lignes = sortie listComposMatchDuJoueur (1 ligne = 1 présence en compo
    // match). COUNT de lignes (pas distinct) : 1 ligne ⇒ 1 match (S61.6 : 4
    // lignes = 4 compos match distinctes pour ce joueur).
    var rec = { postes: {}, matchs: 0, titulaire: 0, remplacant: 0, depannage: false };
    var evenements = [];
    var seenEvt = {};
    (Array.isArray(lignes) ? lignes : []).forEach(function (l) {
      rec.matchs += 1;
      if (l.role === 'titulaire') rec.titulaire += 1;
      else if (l.role === 'remplacant') rec.remplacant += 1;
      if (l.poste_id) rec.postes[l.poste_id] = (rec.postes[l.poste_id] || 0) + 1;
      if (l.est_depannage_hors_categorie === true) rec.depannage = true;
      var c = l.compositions || {};
      if (c.evenement_id && !seenEvt[c.evenement_id]) {
        seenEvt[c.evenement_id] = true;
        evenements.push(c.evenement_id);
      }
    });
    return { rec: rec, evenements: evenements };
  }

  function renderFicheJoueur(joueurId, mount) {
    var el = (typeof mount === 'string') ? document.getElementById(mount) : mount;
    if (!el) return Promise.resolve();
    if (!joueurId) { el.innerHTML = _bloc('Paramètre manquant', '<p>Aucun joueur indiqué (?joueur_id=).</p>'); return Promise.resolve(); }
    el.innerHTML = '<p class="ss-load">Chargement de la fiche…</p>';

    var hub = _hub();
    return chargerPostes().then(function () {
      var pDetail = (hub && typeof hub.getJoueurDetail === 'function')
        ? Promise.resolve(hub.getJoueurDetail(joueurId)).catch(function () { return null; })
        : Promise.resolve(null);
      var pNoms = resoudreNoms([joueurId]);
      var pLignes = (hub && typeof hub.listComposMatchDuJoueur === 'function')
        ? Promise.resolve(hub.listComposMatchDuJoueur(joueurId)).catch(function () { return []; })
        : Promise.resolve([]);
      return Promise.all([pDetail, pNoms, pLignes]);
    }).then(function (r) {
      var detail = r[0];
      var noms = r[1] || new Map();
      var lignes = r[2] || [];
      var nm = noms.get(joueurId) || {};
      var nom = (detail && detail.nom) || nm.nom || '';
      var prenom = (detail && detail.prenom) || nm.prenom || '';
      var label = labelJoueur(nom, prenom) || ('#' + String(joueurId).slice(0, 8));

      var agg = _agregerJoueurSaison(lignes);
      var rec = agg.rec;

      el.innerHTML =
        '<header class="ss-fiche-head">' +
          '<h1>' + escapeHtml(label) + '</h1>' +
          '<p class="ss-sub">M14 · Saison en cours</p>' +
        '</header>' +
        '<div id="ss-fiche-body"><p class="ss-load">Calcul du temps de jeu…</p></div>';

      var body = document.getElementById('ss-fiche-body');

      return agregerTempsDeJeu(agg.evenements).then(function (tdj) {
        var recT = tdj.parJoueur[joueurId] || null;

        // §2 Postes occupés (ordonnés par numero_xv)
        var postesIds = Object.keys(rec.postes).sort(function (a, b) { return numeroXvPoste(a) - numeroXvPoste(b); });
        var postesHtml = postesIds.length
          ? '<ul class="ss-list">' + postesIds.map(function (pid) {
              return '<li>' + escapeHtml(libellePoste(pid)) + ' · <strong>' + rec.postes[pid] + '</strong> match' + (rec.postes[pid] > 1 ? 's' : '') + '</li>';
            }).join('') + '</ul>' + (rec.depannage ? '<p class="ss-flag">⚠️ A dépanné hors catégorie sur la saison.</p>' : '')
          : '<p class="ss-attente">Aucune apparition en feuille de match sur la saison.</p>';

        // §3 Matchs en compo
        var matchsHtml = '<p><strong>' + rec.matchs + '</strong> match' + (rec.matchs > 1 ? 's' : '') + ' en compo · ' +
          rec.titulaire + ' titulaire' + (rec.titulaire > 1 ? 's' : '') + ' / ' +
          rec.remplacant + ' remplaçant' + (rec.remplacant > 1 ? 's' : '') + '</p>';

        body.innerHTML =
          _bloc('Postes occupés', postesHtml) +
          _bloc('Matchs en compo', matchsHtml) +
          _sectionTempsJeu(recT) +
          _sectionFaits() +
          _sectionAssiduite();
      });
    }).catch(function (e) {
      if (typeof console !== 'undefined') console.error('StatsSaison.renderFicheJoueur', e);
      el.innerHTML = _bloc('Erreur', '<p>Impossible de charger la fiche.</p>');
    });
  }

  function _sectionTempsJeu(recT) {
    var corps;
    if (recT && recT.chronoComplets > 0) {
      corps = '<p><strong>' + recT.minutes + ' min</strong> sur ' + recT.chronoComplets + ' match' + (recT.chronoComplets > 1 ? 's' : '') + ' chronométré' + (recT.chronoComplets > 1 ? 's' : '') + '.</p>';
    } else {
      corps = '<p class="ss-attente">En attente du 1ᵉʳ match chronométré de bout en bout. Le détail apparaîtra dès qu\'un match sera suivi sur la même timeline.</p>';
    }
    return _bloc('Temps de jeu', corps);
  }
  function _sectionFaits() {
    return _bloc('Faits de jeu',
      '<p class="ss-attente">Essais, cartons et faits marquants se constitueront au fil des matchs suivis. Aucune statistique de saison consolidée à ce jour.</p>');
  }
  function _sectionAssiduite() {
    return _bloc('Assiduité',
      '<p class="ss-attente">À constituer : la prise de présence n\'est pas encore activée.</p>');
  }

  function _bloc(titre, corpsHtml) {
    return '<section class="ss-bloc"><h2>' + escapeHtml(titre) + '</h2>' + corpsHtml + '</section>';
  }

  // ============================================================
  // OBJET 2 — VUE PILOTAGE (équipe + effectif)
  // ============================================================
  function renderPilotage(baseId, mount) {
    var el = (typeof mount === 'string') ? document.getElementById(mount) : mount;
    if (!el) return Promise.resolve();
    if (!baseId) { el.innerHTML = _bloc('Paramètre manquant', '<p>Aucune feuille de base indiquée (?compo_base=).</p>'); return Promise.resolve(); }
    el.innerHTML = '<p class="ss-load">Chargement du pilotage…</p>';

    return chargerPostes().then(function () {
      return agregerEffectifSaison(baseId);
    }).then(function (effectif) {
      var joueurIds = Object.keys(effectif.parJoueur);
      return Promise.all([
        agregerEquipe(effectif.evenements),
        agregerTempsDeJeu(effectif.evenements),
        resoudreNoms(joueurIds)
      ]).then(function (r) {
        var equipe = r[0], tdj = r[1], noms = r[2] || new Map();
        _peindrePilotage(el, effectif, equipe, tdj, noms);
      });
    }).catch(function (e) {
      if (typeof console !== 'undefined') console.error('StatsSaison.renderPilotage', e);
      el.innerHTML = _bloc('Erreur', '<p>Impossible de charger la vue pilotage.</p>');
    });
  }

  function _peindrePilotage(el, effectif, equipe, tdj, noms) {
    // ----- Étage ÉQUIPE -----
    var renseignes = equipe.nbRenseignes;
    var equipeHtml;
    if (equipe.indispo) {
      equipeHtml = '<p class="ss-attente">Agrégat d\'équipe indisponible (suivi non chargé).</p>';
    } else if (renseignes === 0) {
      equipeHtml = '<p class="ss-attente">Aucun match suivi sur ce périmètre. Les indicateurs d\'équipe se constitueront au fil des matchs renseignés (' + equipe.nbMatchs + ' match' + (equipe.nbMatchs > 1 ? 's' : '') + ' au calendrier).</p>';
    } else {
      var diff = equipe.momTotal - equipe.advTotal;
      equipeHtml =
        '<div class="ss-kpis">' +
          _kpi('Bilan', equipe.v + 'V · ' + equipe.n + 'N · ' + equipe.d + 'D') +
          _kpi('Points', equipe.momTotal + ' / ' + equipe.advTotal) +
          _kpi('Différentiel', (diff >= 0 ? '+' : '') + diff) +
          _kpi('Essais', equipe.essaisNous + ' / ' + equipe.essaisAdv) +
          _kpi('Mêlées G/P', equipe.meleeG + ' / ' + equipe.meleeP) +
          _kpi('Touches G/P', equipe.toucheG + ' / ' + equipe.toucheP) +
          _kpi('Cartons', String(equipe.cartons)) +
        '</div>' +
        '<p class="ss-note">' + renseignes + ' / ' + equipe.nbMatchs + ' match' + (equipe.nbMatchs > 1 ? 's' : '') + ' renseigné' + (renseignes > 1 ? 's' : '') + '. Les matchs non suivis ne sont pas comptés (aucun faux 0).</p>' +
        '<p class="ss-attente">Enrichissement pédagogique (observables Cat B) : mécanisme prêt, saisi à ce jour sur le seul match test — donnée de saison à venir.</p>';
    }

    // ----- Étage JOUEUR (effectif triable) -----
    var lignes = Object.keys(effectif.parJoueur).map(function (jid) {
      var rec = effectif.parJoueur[jid];
      var nm = noms.get(jid) || {};
      var label = labelJoueur(nm.nom, nm.prenom) || ('#' + String(jid).slice(0, 8));
      var pp = postePrincipal(rec.postes);
      var recT = tdj.parJoueur[jid] || null;
      return {
        label: label,
        poste: pp ? libellePoste(pp) : '—',
        posteNum: pp ? numeroXvPoste(pp) : 9999,
        matchs: rec.matchs,
        titulaire: rec.titulaire,
        minutesVal: (recT && recT.chronoComplets > 0) ? recT.minutes : -1, // -1 = non chrono (tri en bas)
        minutesAff: fmtTempsJeu(recT)
      };
    });
    // Tri central visé = par temps de jeu (repérer les peu utilisés). Les non
    // chronométrés (-1) restent groupés ; tant que rien n'est chrono, le tri par
    // défaut retombe sur matchs en compo (proxy d'activité).
    var auMoinsUnChrono = tdj.auMoinsUnChrono;
    lignes.sort(function (a, b) {
      if (auMoinsUnChrono) {
        if (b.minutesVal !== a.minutesVal) return b.minutesVal - a.minutesVal;
      }
      if (b.matchs !== a.matchs) return b.matchs - a.matchs;
      return a.posteNum - b.posteNum;
    });

    var corpsLignes = lignes.length ? lignes.map(function (l) {
      return '<tr>' +
        '<td>' + escapeHtml(l.label) + '</td>' +
        '<td>' + escapeHtml(l.poste) + '</td>' +
        '<td class="ss-num">' + l.matchs + '</td>' +
        '<td class="ss-num">' + l.titulaire + '</td>' +
        '<td class="ss-num">' + escapeHtml(l.minutesAff) + '</td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="5" class="ss-attente">Aucun joueur en feuille de match sur ce périmètre.</td></tr>';

    var tjEntete = auMoinsUnChrono ? 'Temps de jeu' : 'Temps de jeu (à venir)';
    var effectifHtml =
      '<table class="ss-table"><thead><tr>' +
        '<th>Joueur</th><th>Poste principal</th><th class="ss-num">Matchs</th><th class="ss-num">Titulaire</th><th class="ss-num">' + tjEntete + '</th>' +
      '</tr></thead><tbody>' + corpsLignes + '</tbody></table>' +
      (auMoinsUnChrono ? '' : '<p class="ss-note">Le tri par temps de jeu s\'activera dès le 1ᵉʳ match chronométré ; tri actuel = matchs en compo.</p>');

    el.innerHTML =
      '<header class="ss-pilot-head"><h1>Pilotage de saison</h1><p class="ss-sub">M14 · vue staff + équipe</p></header>' +
      '<section class="ss-bloc ss-bloc--equipe"><h2>Niveau équipe</h2>' + equipeHtml + '</section>' +
      '<section class="ss-bloc ss-bloc--effectif"><h2>Effectif</h2>' + effectifHtml + '</section>';
  }

  function _kpi(label, valeur) {
    return '<div class="ss-kpi"><span class="ss-kpi__v">' + escapeHtml(valeur) + '</span><span class="ss-kpi__l">' + escapeHtml(label) + '</span></div>';
  }

  // ---- API publique ----
  window.StatsSaison = {
    version: '1.0',
    renderFicheJoueur: renderFicheJoueur,
    renderPilotage: renderPilotage,
    // exposés pour test / réutilisation éventuelle
    _agregerEffectifSaison: agregerEffectifSaison,
    _agregerEquipe: agregerEquipe,
    _agregerTempsDeJeu: agregerTempsDeJeu
  };
})();
