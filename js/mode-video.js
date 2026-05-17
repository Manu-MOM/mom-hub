/**
 * MOM Hub · Mode Vidéo — contrôleur d'écran (SUIVI-COACH-1 Objet B)
 * ================================================================
 *
 * Module IIFE dédié (pattern projet : 1 page = 1 contrôleur, cf.
 * suivi-app.js / evenements-browser.js / seance-editor.js).
 * Consomme SupabaseHub (supabase-client.js v1.15) ; ne touche
 * JAMAIS Supabase directement (tout passe par les wrappers nommés
 * { ok, data, error } — pattern projet). mode-video.html ne charge
 * PAS suivi-client.js : ce contrôleur est l'écran COACH authentifié,
 * pas l'écran bénévole sans login (invariant fondateur intact).
 *
 * Câblé sur le contrat DOM RÉEL de mode-video.html (vérifié à la
 * source, IDs/classes non inventés) :
 *   #mv-loading #mv-erreur #mv-ecran #mv-titre #mv-sous #mv-retour
 *   #mv-score-val #mv-liste #mv-palette-grille #mv-terminer
 *   classes : .mv-ligne(.mv-annulee) .mv-min .mv-quoi(.mv-joueur)
 *             .mv-prov(.mv-live/.mv-video) .mv-actions .mv-mini
 *             .mv-pal-btn
 *
 * Conception de référence : Conception-SUIVI-COACH-1-ObjetB.md
 * (validé Manu) — B-Q1 point d'entrée, B-Q2 une seule chronologie +
 * provenance + corrige (jamais DELETE) + frontière dure QUOI (zéro
 * champ analyse), B-Q4 chronologie au centre + palette Cat A + cadre
 * Expert vide, B-Q3 re-consolidation = geste explicite « Terminer ».
 *
 * Backend (signatures vérifiées à la source) :
 *   • lecture     get_chronologie_rencontre_coach (C12-k, SUIVI-COACH-4)
 *                 via SupabaseHub.getChronologieRencontreCoach
 *   • écriture    inserer/annuler/corriger_observable_coach (C12-j,
 *                 SUIVI-COACH-3) via *ObservableCoach
 *   • conso       consolider_score_rencontre 2-arg (C12-e, SUIVI-UI-5)
 *                 via SupabaseHub.consoliderScoreRencontreCoach
 *   L'autorisation (Option A : rôle coach/admin + équipe-staff) est
 *   PORTÉE PAR LE BACKEND et remontée fidèlement en message (jamais
 *   ré-implémentée client — anti-invention, principe PI-7).
 *
 * INVARIANTS TENUS :
 *   I1 — le score n'est JAMAIS saisi. Pendant la revue il est
 *        CALCULÉ côté client (somme valeur_points / camp, hors
 *        annulées). La re-consolidation (photo evenements) est un
 *        geste explicite de fin (B-Q3) ; le coach CONSTATE, ne
 *        valide pas (S-4.2.a).
 *   QUOI/POURQUOI (B-Q2c, S-5.3.c) — aucun champ analyse/commentaire/
 *        note. Frontière dure : si l'envie d'un « petit champ notes »
 *        apparaît = fuite de périmètre (→ c'est le Rapport).
 *   Anti-injection — tout le DOM est construit en createElement /
 *        textContent. AUCUN innerHTML avec donnée dynamique.
 *   Jamais de DELETE — annuler = annule=TRUE (ligne conservée,
 *        barrée, exclue du score). Correction = mutation tracée.
 *
 * LIMITES V1 — TRACÉES, NON CONTOURNÉES (dette SUIVI-COACH-5,
 * jumelle compo-réduite-coach de la lignée C12-d→C12-k ; cf. message
 * de passation). Le DOM validé de mode-video.html ne porte NI
 * sélecteur de camp, NI picker de joueur nommé, NI champ timecode :
 *   1. RÉATTRIBUTION/ATTRIBUTION à un joueur NOMMÉ → indisponible :
 *      get_compo_reduite_rencontre est jeton-seul (aucun chemin
 *      coach), et détourner les wrappers compo coach violerait P6
 *      (payload non réduit) + signatures non vérifiées. Le bouton
 *      « Attribuer un joueur » est présent mais DÉSACTIVÉ et étiqueté
 *      (honnête, pas un trou). La DÉSATTRIBUTION (→ NULL, cas D-7)
 *      est, elle, disponible (corriger_observable_coach(...,null)).
 *   2. AJOUT côté ADVERSE → non exposé : le DOM n'a pas de bascule
 *      de camp. L'ajout via palette complète la chronologie de NOTRE
 *      équipe en cas D-7 (« joueur à compléter ») — c'est l'usage
 *      canonique du Mode Vidéo (S-5.3.a : compléter/corriger le
 *      live de notre équipe). L'ajout adverse relève de SUIVI-COACH-5.
 *   3. Saisie d'un TIMECODE vidéo → non exposée (pas de champ dans
 *      le DOM validé) : le timecode_video EXISTANT est AFFICHÉ
 *      (factuel, B-Q4), mais sa saisie/édition relève de SUIVI-COACH-5.
 *   Précédent strict : A-Q4 / Path A — surface livrée utile,
 *   extension tracée, RIEN codé par anticipation.
 *
 * Limite V1 héritée (non bloquante) : la convention de retour fiche
 * événement ciblée n'est pas établie (dette SUIVI-COACH-deeplink) →
 * #mv-retour pointe honnêtement vers evenements.html, non ciblé.
 * Et nom_court PEUT être NULL (dette C12-nom) → libelleJoueurSuivi()
 * dégrade déjà proprement (l'ancre numéro n'est pas dans le payload
 * chronologie → dégrade en nom_court / '?'). Honnête, tracé projet.
 *
 * Version : 0.1 — Objet B, livré (mai 2026)
 *   v0.1 : écran complet sur le périmètre non-dégradé : chargement
 *          chronologie (C12-k), provenance par ligne (B-Q2a), score
 *          calculé client (I1), palette 13 Cat A, AJOUT (cas D-7),
 *          ANNULER, DÉSATTRIBUER, « Terminer la revue vidéo » →
 *          re-consolidation (C12-e 2-arg) ; cadre Expert laissé vide
 *          (Cat B = SUIVI-UI-4, non inventé). Réattribution/ajout
 *          adverse/timecode = SUIVI-COACH-5 (UI honnêtement dégradée).
 */
(function (global) {
  'use strict';

  var doc = global.document;

  // ------------------------------------------------------------
  // Paramètre d'URL portant l'UUID de la rencontre. Convention
  // FRONT isolée ici (comme TOKEN_PARAM de suivi-client) : le
  // fichier 3 (evenements-browser.js) construira l'URL Mode Vidéo
  // avec EXACTEMENT ce paramètre. Un seul endroit à changer.
  // ------------------------------------------------------------
  var EVT_PARAM = 'e';

  // ------------------------------------------------------------
  // RÉFÉRENTIEL observables-match.json v1.1 — FIGÉ EN DUR.
  // Copie STRICTEMENT identique au set vérifié à la source dans
  // suivi-app.js v0.14 (13 obs Cat A). Justification projet : c'est
  // un fichier Drive, pas une RPC ; la convention fige les
  // référentiels stables côté client. id + libellé + points =
  // contrat backend exact, passés tels quels à inserer_observable_
  // coach (categorie_obs='A'). PAS d'observable Cat B inventé en UI
  // (B-Q4 / SUIVI-UI-4 : cadre Expert structurellement vide).
  // ------------------------------------------------------------
  var OBS = [
    { id: 'obs-A-essai',         libelle: 'Essai',          points: 5, sec: 'score' },
    { id: 'obs-A-transfo',       libelle: 'Transformation', points: 2, sec: 'score' },
    { id: 'obs-A-penalite',      libelle: 'Pénalité',       points: 3, sec: 'score' },
    { id: 'obs-A-drop',          libelle: 'Drop',           points: 3, sec: 'score' },
    { id: 'obs-A-substitution',  libelle: 'Remplacement',   points: 0, sec: 'event' },
    { id: 'obs-A-avertissement', libelle: 'Avertissement',  points: 0, sec: 'event' },
    { id: 'obs-A-jaune',         libelle: 'Carton jaune',   points: 0, sec: 'event' },
    { id: 'obs-A-rouge',         libelle: 'Carton rouge',   points: 0, sec: 'event' },
    { id: 'obs-A-blessure',      libelle: 'Blessure',       points: 0, sec: 'event' },
    { id: 'obs-A-melee-gagnee',  libelle: 'Mêlée gagnée',   points: 0, sec: 'jeu' },
    { id: 'obs-A-melee-perdue',  libelle: 'Mêlée perdue',   points: 0, sec: 'jeu' },
    { id: 'obs-A-touche-gagnee', libelle: 'Touche gagnée',  points: 0, sec: 'jeu' },
    { id: 'obs-A-touche-perdue', libelle: 'Touche perdue',  points: 0, sec: 'jeu' }
  ];

  // Index id → libellé (mapping observable_id des lignes chrono).
  var OBS_LIB = {};
  for (var _i = 0; _i < OBS.length; _i++) OBS_LIB[OBS[_i].id] = OBS[_i].libelle;

  // ------------------------------------------------------------
  // État runtime TRANSITOIRE (jamais persisté ; re-dérivé du Core
  // à chaque boot). Cohérent doctrine I5 du module Suivi.
  // ------------------------------------------------------------
  var _evtUuid = null;     // UUID rencontre (lu de l'URL)
  var _chrono  = [];       // dernière chronologie connue (C12-k)
  var _busy    = false;    // anti-double-action pendant un appel réseau

  // ============================================================
  // HELPERS DOM (anti-injection : createElement / textContent only)
  // ============================================================

  function el(id) { return doc.getElementById(id); }

  function show(id, on) {
    var n = el(id);
    if (n) { if (on) n.removeAttribute('hidden'); else n.setAttribute('hidden', ''); }
  }

  function erreur(msg) {
    var n = el('mv-erreur');
    if (n) n.textContent = msg || 'Une erreur est survenue.';
    show('mv-loading', false);
    show('mv-ecran', false);
    show('mv-erreur', true);
  }

  function mk(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = String(txt);
    return n;
  }

  // ============================================================
  // FORMATAGE (dégradation honnête, jamais d'invention de format)
  // ============================================================

  // Marqueur période/minute. Format aligné sur suivi-app v0.14
  // (« P{periode} {minute}' »), dégradation '—' si absent.
  function marqueurTemps(l) {
    var per = (l && l.periode != null) ? l.periode : '—';
    var min = (l && l.minute_match != null) ? l.minute_match : '—';
    return 'P' + per + ' ' + min + "'";
  }

  // En-tête lisible de la rencontre, à partir des seuls champs
  // réellement présents (défensif : getEvenementWithEncadrants
  // renvoie le noyau événement). Aucun champ inventé.
  function sousTitre(evt) {
    if (!evt) return '';
    var bouts = [];
    if (evt.date_debut) {
      try {
        var d = new Date(evt.date_debut);
        if (!isNaN(d.getTime())) {
          bouts.push(d.toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          }));
        }
      } catch (e) { /* date illisible : on l'omet, pas d'invention */ }
    }
    if (evt.adversaire_nom) bouts.push('vs ' + evt.adversaire_nom);
    if (evt.domicile_exterieur) bouts.push(evt.domicile_exterieur);
    if (evt.type_competition) bouts.push(evt.type_competition);
    return bouts.join(' · ');
  }

  // ============================================================
  // SCORE — CALCULÉ côté client (I1). Réplique EXACTE de la règle
  // canonique de suivi-app v0.14 (calculerScore) : somme
  // valeur_points par camp, lignes annule!==true, points!=0.
  // Jamais saisi. La photo persistée = geste « Terminer » (B-Q3).
  // ============================================================
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
    var n = el('mv-score-val');
    if (!n) return;
    var s = calculerScore(lignes);
    n.textContent = 'MOM ' + s.mom + ' — ' + s.adv + ' ADV';
  }

  // ============================================================
  // CHRONOLOGIE — une seule liste, provenance par ligne (B-Q2a),
  // ordre horodatage ASC (fourni par C12-k). Lignes annulées
  // CONSERVÉES, barrées (.mv-annulee), exclues du score.
  // ============================================================

  function pastilleProvenance(l) {
    // source_saisie ∈ {live, video, correction} (CHECK C12-a).
    // 'video' = saisi au calme par le coach ; 'live'/'correction'
    // = terrain (bénévole). Marque DISCRÈTE (B-Q2a), jamais 2 listes.
    var estVideo = (l && l.source_saisie === 'video');
    var p = mk('span',
      'mv-prov ' + (estVideo ? 'mv-video' : 'mv-live'),
      estVideo ? 'vidéo' : 'terrain');
    return p;
  }

  function rendreLigne(l) {
    var ligne = mk('div', 'mv-ligne' + (l.annule === true ? ' mv-annulee' : ''));

    // Colonne 1 — marqueur temps (+ timecode vidéo si présent :
    // factuel, B-Q4 ; sa SAISIE = SUIVI-COACH-5, ici lecture seule).
    var min = mk('div', 'mv-min', marqueurTemps(l));
    if (l.timecode_video) {
      min.appendChild(doc.createElement('br'));
      min.appendChild(mk('span', null, '⏱ ' + String(l.timecode_video)));
    }
    ligne.appendChild(min);

    // Colonne 2 — le QUOI : libellé observable + points + provenance
    // + joueur (règle UNIQUE libelleJoueurSuivi). ZÉRO champ analyse.
    var quoi = mk('div', 'mv-quoi');
    var lib = OBS_LIB[l.observable_id] || (l.observable_id ? String(l.observable_id) : '?');
    var pts = (typeof l.valeur_points === 'number' && l.valeur_points)
      ? (' (' + (l.valeur_points > 0 ? '+' : '') + l.valeur_points + ')') : '';
    quoi.appendChild(doc.createTextNode(lib + pts));
    quoi.appendChild(pastilleProvenance(l));

    if (l.equipe_concernee === 'adverse') {
      quoi.appendChild(mk('span', 'mv-joueur', ' · adversaire'));
    } else if (l.joueur_uuid || l.nom_court) {
      // libelleJoueurSuivi = règle UNIQUE de dégradation (réplique
      // SuiviClient.libelleJoueur). Le payload chrono n'a pas de
      // numero_maillot → dégrade en nom_court / '?' (dette C12-nom).
      var lib2 = global.SupabaseHub
        ? global.SupabaseHub.libelleJoueurSuivi(l) : '?';
      quoi.appendChild(mk('span', 'mv-joueur', ' · ' + lib2));
    } else if (typeof l.valeur_points === 'number' && l.valeur_points > 0) {
      // Scorante côté nous SANS joueur = cas D-7 (« je ne sais pas »)
      // ou trou bénévole. Honnête : le coach complétera (réattribution
      // nommée = SUIVI-COACH-5, désattribution dispo dès maintenant).
      quoi.appendChild(mk('span', 'mv-joueur', ' · (joueur à compléter)'));
    }
    ligne.appendChild(quoi);

    // Colonne 3 — actions. Aucune sur une ligne déjà annulée
    // (conservée en lecture, jamais de DELETE — B-Q2b).
    var actions = mk('div', 'mv-actions');
    if (l.annule !== true) {
      // Annuler (annule=TRUE, jamais DELETE).
      var bAnn = mk('button', 'mv-mini', 'Annuler');
      bAnn.type = 'button';
      bAnn.addEventListener('click', function () { onAnnuler(l.id); });
      actions.appendChild(bAnn);

      // Désattribuer — seulement si NOTRE + joueur attribué.
      if (l.equipe_concernee !== 'adverse' && l.joueur_uuid) {
        var bDes = mk('button', 'mv-mini', 'Désattribuer');
        bDes.type = 'button';
        bDes.addEventListener('click', function () { onDesattribuer(l.id); });
        actions.appendChild(bDes);
      }

      // Attribuer un joueur NOMMÉ — DÉSACTIVÉ (SUIVI-COACH-5 :
      // compo réduite coach inexistante). Honnête, pas un trou.
      if (l.equipe_concernee !== 'adverse'
          && !l.joueur_uuid
          && typeof l.valeur_points === 'number' && l.valeur_points > 0) {
        var bAtt = mk('button', 'mv-mini', 'Attribuer un joueur — bientôt');
        bAtt.type = 'button';
        bAtt.disabled = true;
        bAtt.title = 'Disponible quand la compo réduite coach sera '
          + 'livrée (dette SUIVI-COACH-5).';
        actions.appendChild(bAtt);
      }
    }
    ligne.appendChild(actions);
    return ligne;
  }

  function rendreChrono(lignes) {
    var liste = el('mv-liste');
    if (!liste) return;
    while (liste.firstChild) liste.removeChild(liste.firstChild);

    if (!lignes || !lignes.length) {
      liste.appendChild(mk('div', 'mv-etat',
        'Aucune action enregistrée pour cette rencontre. '
        + 'Utilisez la palette pour compléter le déroulé depuis la vidéo.'));
      return;
    }
    for (var i = 0; i < lignes.length; i++) {
      liste.appendChild(rendreLigne(lignes[i]));
    }
  }

  // ============================================================
  // PALETTE — 13 Cat A. AJOUT = cas D-7 « notre, joueur à
  // compléter » (le DOM validé n'a ni bascule camp ni picker
  // joueur ; usage canonique S-5.3.a = compléter NOTRE chrono).
  // Ajout adverse / attribution nommée = SUIVI-COACH-5. Cadre
  // Expert (Cat B) laissé tel quel dans le HTML (vide — SUIVI-UI-4).
  // ============================================================
  function rendrePalette() {
    var grille = el('mv-palette-grille');
    if (!grille) return;
    while (grille.firstChild) grille.removeChild(grille.firstChild);

    for (var i = 0; i < OBS.length; i++) {
      (function (o) {
        var b = mk('button', 'mv-pal-btn', o.libelle);
        b.type = 'button';
        b.setAttribute('data-obs', o.id);
        b.addEventListener('click', function () { onAjouter(o, b); });
        grille.appendChild(b);
      })(OBS[i]);
    }
  }

  // ============================================================
  // RECHARGEMENT — source unique de vérité = le Core (C12-k).
  // Recalcule score + re-rend chrono. Zéro état navigateur.
  // ============================================================
  function recharger() {
    if (!global.SupabaseHub || !_evtUuid) return Promise.resolve();
    return global.SupabaseHub.getChronologieRencontreCoach(_evtUuid)
      .then(function (lignes) {
        _chrono = Array.isArray(lignes) ? lignes : [];
        rendreScore(_chrono);
        rendreChrono(_chrono);
      })
      .catch(function (e) {
        if (global.console) console.error('MOM Hub MV: recharger()', e);
        // Dégradation honnête : on garde l'écran, message non bloquant.
        erreur('Impossible de recharger la chronologie. Réessayez.');
      });
  }

  // ============================================================
  // ACTIONS — toutes via wrappers v1.15 ; l'autorisation (Option A)
  // est portée par le backend et son refus affiché TEL QUEL
  // (#mv-erreur), jamais réinterprété (anti-invention, PI-7-like).
  // ============================================================

  function garde() {
    if (_busy) return false;
    _busy = true;
    return true;
  }
  function relacher() { _busy = false; }

  function onAjouter(o) {
    if (!garde()) return;
    // Cas D-7 honnête : NOTRE équipe, joueur NULL (« à compléter »).
    // saisi_par_role='coach' & source_saisie='video' sont FORCÉS par
    // le backend C12-j (le wrapper ne les envoie pas).
    var obs = {
      observableId:    o.id,
      categorieObs:    'A',
      valeurPoints:    (typeof o.points === 'number') ? o.points : 0,
      equipeConcernee: 'notre'
      // joueurUuid omis = NULL (cas D-7) ; minute/periode/timecode
      // non saisissables dans le DOM validé → DEFAULT SQL (SUIVI-COACH-5).
    };
    global.SupabaseHub.insererObservableCoach(_evtUuid, obs)
      .then(function (res) {
        if (!res || !res.ok) {
          erreur((res && res.error) || "Échec de l'ajout.");
          return;
        }
        return recharger();
      })
      .catch(function (e) {
        if (global.console) console.error('MOM Hub MV: onAjouter()', e);
        erreur("Échec de l'ajout (réseau).");
      })
      .then(relacher, relacher);
  }

  function onAnnuler(ligneId) {
    if (!ligneId || !garde()) return;
    global.SupabaseHub.annulerObservableCoach(_evtUuid, ligneId)
      .then(function (res) {
        if (!res || !res.ok) {
          erreur((res && res.error) || "Échec de l'annulation.");
          return;
        }
        return recharger();
      })
      .catch(function (e) {
        if (global.console) console.error('MOM Hub MV: onAnnuler()', e);
        erreur("Échec de l'annulation (réseau).");
      })
      .then(relacher, relacher);
  }

  function onDesattribuer(ligneId) {
    if (!ligneId || !garde()) return;
    // Réattribution NOMMÉE = SUIVI-COACH-5. Désattribution = mettre
    // joueur_uuid à NULL via corriger_observable_coach(...,null).
    // timecode non transmis → COALESCE backend préserve l'existant.
    global.SupabaseHub.corrigerObservableCoach(_evtUuid, ligneId, null)
      .then(function (res) {
        if (!res || !res.ok) {
          erreur((res && res.error) || 'Échec de la désattribution.');
          return;
        }
        return recharger();
      })
      .catch(function (e) {
        if (global.console) console.error('MOM Hub MV: onDesattribuer()', e);
        erreur('Échec de la désattribution (réseau).');
      })
      .then(relacher, relacher);
  }

  // B-Q3 — geste explicite UNIQUE de fin de revue. PAS de
  // re-consolidation par action. Le coach CONSTATE le score
  // recalculé (I1), il ne le valide pas. Aucun état transitoire
  // (anti-V6) : un point stable, un geste, une photo.
  function onTerminer(btn) {
    if (!garde()) return;
    if (btn) btn.disabled = true;
    global.SupabaseHub.consoliderScoreRencontreCoach(_evtUuid)
      .then(function (res) {
        if (!res || !res.ok) {
          erreur((res && res.error) || 'Échec de la consolidation du score.');
          return;
        }
        // Le coach CONSTATE le score consolidé (photo evenements).
        var sn = el('mv-score-val');
        if (sn && res.data
            && typeof res.data.score_mom === 'number'
            && typeof res.data.score_adverse === 'number') {
          sn.textContent = 'MOM ' + res.data.score_mom
            + ' — ' + res.data.score_adverse + ' ADV';
        }
        if (btn) {
          btn.textContent = '✓ Revue consolidée';
          global.setTimeout(function () {
            btn.textContent = 'Terminer la revue vidéo';
            btn.disabled = false;
          }, 2500);
        }
      })
      .catch(function (e) {
        if (global.console) console.error('MOM Hub MV: onTerminer()', e);
        erreur('Échec de la consolidation (réseau).');
        if (btn) btn.disabled = false;
      })
      .then(relacher, relacher);
  }

  // ============================================================
  // BOOT — gate session (autorisation fine = backend), résolution
  // rencontre, rendu initial. Aucun localStorage/sessionStorage.
  // ============================================================
  function boot() {
    if (!global.SupabaseHub) {
      erreur('Client Supabase non chargé. Rechargez la page.');
      return;
    }

    // UUID rencontre depuis l'URL (?e=...). Absent = on ne devine pas.
    try {
      var p = new global.URLSearchParams(global.location.search);
      _evtUuid = p.get(EVT_PARAM);
      if (_evtUuid) _evtUuid = _evtUuid.trim();
    } catch (e) { _evtUuid = null; }
    if (!_evtUuid) {
      erreur('Rencontre non précisée (lien incomplet). '
        + 'Ouvrez le Mode Vidéo depuis la fiche de la rencontre.');
      return;
    }

    // #mv-retour : retour honnête au module Évènements (deep-link
    // ciblé non établi = dette SUIVI-COACH-deeplink, non inventé).
    var ret = el('mv-retour');
    if (ret) ret.setAttribute('href', 'evenements.html');

    // Gate SESSION uniquement (redirige login si absente). Le
    // contrôle fin coach/admin + équipe est PORTÉ PAR LE BACKEND
    // (C12-k/C12-j) et son refus s'affichera tel quel — on ne
    // duplique pas la règle d'auth Option A côté client (PI-7-like).
    global.SupabaseHub.requireAuth()
      .then(function (okSession) {
        if (!okSession) return;            // requireAuth a déjà redirigé

        // En-tête rencontre via wrapper coach EXISTANT (vérifié
        // source, v1.10) — aucune RPC inventée. null = introuvable
        // / accès impossible → message honnête (couvre les 2 cas).
        return global.SupabaseHub.getEvenementWithEncadrants(_evtUuid)
          .then(function (evt) {
            if (!evt) {
              erreur('Rencontre introuvable ou accès non autorisé.');
              return null;
            }
            var t = el('mv-titre');
            if (t) t.textContent = evt.libelle || 'Revue vidéo';
            var s = el('mv-sous');
            if (s) s.textContent = sousTitre(evt);

            // Branchement du geste de fin (B-Q3).
            var bt = el('mv-terminer');
            if (bt && !bt._mvArme) {
              bt._mvArme = true;
              bt.addEventListener('click', function () { onTerminer(bt); });
            }

            rendrePalette();

            return global.SupabaseHub.getChronologieRencontreCoach(_evtUuid)
              .then(function (lignes) {
                _chrono = Array.isArray(lignes) ? lignes : [];
                rendreScore(_chrono);
                rendreChrono(_chrono);
                show('mv-loading', false);
                show('mv-erreur', false);
                show('mv-ecran', true);
              });
          });
      })
      .catch(function (e) {
        if (global.console) console.error('MOM Hub MV: boot()', e);
        erreur('Erreur au chargement de la revue vidéo.');
      });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // API publique minimale (P3 : pas de surface inutile). recharger
  // exposé pour un éventuel polling/relais ultérieur ; tout l'état
  // reste interne.
  global.ModeVideoApp = { recharger: recharger };

  if (global.console) {
    console.log(
      '%c🏉 MOM Hub · Mode Vidéo App v0.1 (Objet B) chargé',
      'color: #2d7a3e; font-weight: bold;'
    );
  }

})(typeof window !== 'undefined' ? window : globalThis);
