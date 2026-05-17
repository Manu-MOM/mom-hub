/**
 * MOM Hub · Suivi de rencontre — contrôleur d'écran
 * =================================================
 *
 * Module IIFE dédié au module Suivi (pattern projet : 1 page = 1
 * contrôleur, cf. evenements-browser.js / seance-editor.js…).
 * Consomme SuiviClient (suivi-client.js) ; ne touche jamais
 * Supabase directement.
 *
 * Version : 0.6 — S-2.d (mai 2026)
 *   v0.1 : LOGIQUE DE BOOT SEULEMENT (paquet S-1, parcours d'entrée).
 *          getToken() → chargerEtatInitial() → routage entre les 5
 *          états posés en S-1.a (loading|error|tampon|encours|
 *          reprise). AUCUN contenu d'écran ici : le tampon est
 *          rempli en S-1.c, « En cours » en S-2, la reprise en S-5.
 *          Zéro localStorage / sessionStorage (I5 : tout l'état vit
 *          dans le Core, rien dans le navigateur — c'est ce qui rend
 *          le relais/reconnexion sans perte).
 *   v0.2 : S-1.c — peuplement du contenu du tampon. Aperçu compo
 *          (AV-2) chargé PARESSEUSEMENT au 1er dépliement du repli
 *          (I2 tampon léger + persona réseau), via
 *          SuiviClient.getCompoReduiteRencontre + libelleJoueur ;
 *          dégradation propre si compo indisponible (message +
 *          Réessayer). Jeton mémorisé en variable runtime
 *          transitoire (re-dérivée de l'URL à chaque chargement,
 *          JAMAIS persistée → I5 tenu). ⚙ chrono = repli structurel
 *          (moteur = S-2.3) ; sas ▶ Coup d'envoi présent, son
 *          comportement = S-1.d.
 *   v0.3 : S-1.d — comportement du sas ▶ Coup d'envoi (I4),
 *          PATH A (validé Manu) : transition CLIENTE pure tampon →
 *          En cours, ZÉRO écriture Core (aucun observable structurel
 *          « coup d'envoi » au référentiel — Path B = dette
 *          Audits/Référentiels, contrat aval type DS-1). I4 tenu
 *          STRUCTURELLEMENT : aucune surface de saisie avant le sas
 *          (palette = S-2, écran En cours uniquement), le sas est
 *          l'unique chemin vers cet écran → le routage EST le verrou.
 *          Limite V1 ASSUMÉE et tracée (sœur de S-5.2.c hors-ligne) :
 *          plantage/reconnexion entre le tap et la 1ʳᵉ action réelle
 *          → chronologie encore vide → S-1.b re-route au tampon
 *          (re-tap sans dégât). Pas de réécriture silencieuse.
 *          Sas = tap délibéré unique, SANS confirm (le sas écran +
 *          bouton EST l'anti-erreur, S-1.4 ; asymétrie INTENTIONNELLE
 *          vs la clôture « Fin du match » qui, elle, confirme —
 *          S-3.4.a). Robuste par construction : 0 appel réseau au
 *          coup d'envoi → ne peut pas échouer (persona réseau).
 *   v0.4 : S-2.b — alimentation LECTURE de l'écran « En cours »
 *          (cœur I5/I1). Au routage 'demarre' : reconstruction
 *          totale depuis le Core via getChronologieRencontre —
 *          Zone A score CALCULÉ côté client (somme valeur_points
 *          par camp, hors annulées : zéro écriture, I1 ; chrono =
 *          placeholder statique, décision validée) ; Zone E
 *          2 dernières lignes (feedback I1) ; bascule camp B
 *          (visuel seul — contenu palette selon camp = S-2.c).
 *          rafraichirEnCours() public, réutilisable (refresh après
 *          action = S-2.d, polling = S-5). Format de ligne
 *          d'historique VOLONTAIREMENT minimal/provisoire : le
 *          format définitif (1MT 0' / 2MT 11' + libellés lisibles)
 *          est tranché en S-3 (spec S-2.5) ; ici observable_id brut
 *          + points + joueur via libelleJoueur, marqué provisoire —
 *          dégradation honnête, pas d'invention de spec. Zéro
 *          écriture, zéro localStorage (I5). Palette/tap/dépliement
 *          = S-2.c/d/e (hors ce lot).
 *   v0.5 : S-2.c — palette à contenu variable (Zone C), le geste
 *          central. STRUCTUREL/VISUEL : la palette s'affiche et
 *          varie selon le camp ; AUCUN tap n'écrit encore (le
 *          comportement au tap, et la dégradation du seam joueur
 *          Zone D, sont S-2.d). Référentiel observables-match.json
 *          v1.1 figé EN DUR côté module (fichier Drive, pas une
 *          RPC : le bénévole sans login ne peut pas le fetcher —
 *          convention projet pour référentiels figés), données
 *          vérifiées À LA SOURCE (13 obs Cat A). Côté Notre :
 *          3 sections étiquetées — Scorantes / Événements / Jeu.
 *          La 3ᵉ « Jeu » (4 obs jeu_collectif mêlées/touches) est
 *          un AJOUT signalé : la spec S-2.2.a ne place pas ces 4
 *          observables ; section neutre non scorante = dégradation
 *          honnête (rien de caché, aucune urgence inventée) →
 *          micro-dette de placement à confirmer Conception. Côté
 *          Adverse : score seul (+5/+2/+3/+3) + bouton −1 (S-2.2.b,
 *          zéro joueur). Seam joueur (scorante Notre → Zone D = S-3)
 *          marqué visuellement, non câblé (data-seam). Re-render au
 *          changement de camp (branché sur le point posé en S-2.b).
 *          Zéro écriture, zéro storage (I5).
 *   v0.6 : S-2.d — feedback au tap + ÉCRITURE. 1 tap = 1 ligne
 *          via SuiviClient.insererObservable (categorie_obs='A',
 *          observableId+valeurPoints du référentiel figé,
 *          equipeConcernee=_camp, saisiParRole='benevole',
 *          sourceSaisie='live' ; minute/periode NON fournies —
 *          moteur chrono = lot ultérieur, DEFAULT SQL). Après
 *          succès : refresh via getChronologieRencontre →
 *          rafraichirEnCours (le fil qui s'enrichit EST le
 *          feedback, I1 / S-2.2.c ; pas de notif séparée). SEAM
 *          S-3 géré par DÉGRADATION (validé Manu) : scorante côté
 *          Notre → enregistrée pour l'ÉQUIPE, joueur_uuid omis
 *          (=fallback DS-1, contrainte tranchée Option A : 'notre'
 *          + joueur NULL autorisé). Fallback TEMPORAIRE (Zone D
 *          pas encore là) ≠ choix délibéré D-7 ; ligne marquée
 *          « à compléter » dans l'historique. Anti-double-tap
 *          (bouton neutralisé pendant l'appel). Erreur réseau :
 *          message non bloquant, bouton réactivé (persona réseau ;
 *          rien perdu, l'état vrai reste le Core — I5). −1 adverse
 *          (annuler dernière action adverse) câblé via
 *          annulerObservable. Dépliement historique = S-2.e.
 *          Zéro storage (I5).
 *
 * INVARIANTS :
 *   I5 — ce module ne persiste RIEN côté navigateur. L'état de
 *        routage est recalculé à chaque chargement depuis le Core
 *        (SuiviClient.chargerEtatInitial). Un rechargement = un
 *        recalcul, jamais une reprise d'un cache local.
 *   I2 — le tampon ne réapparaît jamais une fois le match démarré :
 *        c'est exactement ce que fait le routage (statut 'demarre'
 *        → on NE va PAS au tampon). La distinction reprise vs « En
 *        cours » (même bénévole vs relais) est renvoyée à S-5 :
 *        ici, 'demarre' route vers l'écran « En cours » (placeholder
 *        tant que S-2 n'est pas fait) ; le split est un SEAM tracé.
 *   Persona « réseau instable » : l'échec réseau est distinct du
 *        jeton invalide et DOIT être réessayable (bouton Réessayer).
 */
(function (global) {
  'use strict';

  var doc = global.document;

  // Jeton courant. Variable runtime TRANSITOIRE : re-dérivée de
  // l'URL (getToken) à chaque chargement, JAMAIS écrite dans un
  // stockage navigateur. I5 = pas d'état PERSISTANT côté navigateur ;
  // une variable mémoire reconstruite à chaque load ne viole pas I5
  // (c'est même ce qui rend la reconnexion sûre : rien de figé).
  var _token = null;

  // Garde le repli compo de ne charger qu'une fois (paresseux).
  var _compoChargee = false;

  // « Coup d'envoi » donné dans CETTE session (S-1.d, Path A).
  // Runtime TRANSITOIRE : jamais persisté. Ne change pas le
  // comportement au rechargement (l'état réel = le Core, via
  // chargerEtatInitial). Simple garde anti-re-render intra-session.
  var _demarree = false;

  // ------------------------------------------------------------
  // Garde : suivi-client.js doit être chargé AVANT ce module.
  // (Script pouvant échouer côté réseau — persona instable.)
  // ------------------------------------------------------------
  function clientPresent() {
    return typeof global.SuiviClient !== 'undefined'
        && global.SuiviClient
        && typeof global.SuiviClient.chargerEtatInitial === 'function';
  }

  // ------------------------------------------------------------
  // Bascule d'écran : un seul .suivi-screen visible à la fois.
  // S'appuie sur l'attribut natif [hidden] (posé en S-1.a).
  // ------------------------------------------------------------
  function montrerEcran(id) {
    var ecrans = doc.querySelectorAll('.suivi-screen');
    for (var i = 0; i < ecrans.length; i++) {
      var e = ecrans[i];
      if (e.id === id) {
        e.removeAttribute('hidden');
      } else {
        e.setAttribute('hidden', '');
      }
    }
  }

  // Aide « ? » permanente (I3 / 2C) : pertinente sur tampon et
  // « En cours », pas sur loading/erreur. Branchement réel S-1.c.
  function aide(visible) {
    var b = doc.getElementById('btnHelp');
    if (!b) return;
    if (visible) { b.removeAttribute('hidden'); }
    else { b.setAttribute('hidden', ''); }
  }

  // ------------------------------------------------------------
  // Écran d'erreur : message contextuel + bouton Réessayer
  // injecté UNIQUEMENT pour l'échec réseau (réessayer un jeton
  // invalide n'aide pas — on n'offre pas un faux espoir).
  // ------------------------------------------------------------
  function afficherErreur(message, reessayable) {
    var msg = doc.getElementById('errMsg');
    if (msg) { msg.textContent = message; }

    var scr = doc.getElementById('scrError');
    var ancienBtn = doc.getElementById('btnReessayer');
    if (ancienBtn) { ancienBtn.parentNode.removeChild(ancienBtn); }

    if (reessayable && scr) {
      var btn = doc.createElement('button');
      btn.id = 'btnReessayer';
      btn.type = 'button';
      btn.className = 'suivi-btn-neutre';
      btn.textContent = 'Réessayer';
      btn.style.marginTop = '8px';
      btn.addEventListener('click', function () { boot(); });
      scr.appendChild(btn);
    }
    aide(false);
    montrerEcran('scrError');
  }

  // ------------------------------------------------------------
  // S-1.c · TAMPON — aperçu compo (AV-2), chargement PARESSEUX.
  // Fidèle à AV-2 (« le bénévole peut vérifier, pas obligé ») et au
  // persona réseau : on ne fetch QU'au 1er dépliement du repli.
  // C'est, en Option UI-stricte, LA vérification d'identité (faute
  // de ligne d'en-tête rencontre). Lecture seule, payload réduit.
  // ------------------------------------------------------------
  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  function rendreCompo(corps, lignes) {
    if (!lignes || lignes.length === 0) {
      // [] = soit compo vide soit erreur (le wrapper ne distingue
      // pas — convention v1.12). On dégrade proprement + Réessayer
      // (persona réseau) plutôt que d'afficher un vide muet.
      corps.innerHTML =
        '<p class="suivi-compo-vide">Compo indisponible pour le moment.'
        + '<button type="button" class="suivi-btn-neutre" id="btnCompoRetry">Réessayer</button></p>';
      var r = doc.getElementById('btnCompoRetry');
      if (r) r.addEventListener('click', function () {
        _compoChargee = false;
        chargerCompo();
      });
      return;
    }
    var ul = doc.createElement('ul');
    ul.className = 'suivi-compo-list';
    for (var i = 0; i < lignes.length; i++) {
      var j = lignes[i];
      var li = doc.createElement('li');
      li.className = 'suivi-compo-row';
      // libelleJoueur = règle UNIQUE de dégradation nom_court NULL
      // (ancre = numéro). Ne jamais reconstruire la règle ici.
      var label = global.SuiviClient.libelleJoueur(j);
      var etat = (j && j.etat_joueur) ? String(j.etat_joueur) : '';
      var role = (j && j.role) ? String(j.role) : '';
      li.innerHTML =
        '<span class="suivi-compo-dot" data-etat="' + echapper(etat) + '" aria-hidden="true"></span>'
        + '<span class="suivi-compo-label">' + echapper(label) + '</span>'
        + (role ? '<span class="suivi-compo-role">' + echapper(role) + '</span>' : '');
      ul.appendChild(li);
    }
    corps.innerHTML = '';
    corps.appendChild(ul);
  }

  function chargerCompo() {
    var corps = doc.getElementById('compoCorps');
    if (!corps || _compoChargee) return;
    _compoChargee = true;
    corps.textContent = 'Chargement de la compo…';
    global.SuiviClient.getCompoReduiteRencontre(_token).then(function (lignes) {
      rendreCompo(corps, lignes);
    }).catch(function (e) {
      if (global.console) console.error('MOM Hub Suivi: chargerCompo()', e);
      _compoChargee = false;            // permet un Réessayer
      rendreCompo(corps, []);           // chemin dégradé + retry
    });
  }

  // ------------------------------------------------------------
  // S-1.d · SAS ▶ Coup d'envoi (I4) — PATH A.
  // Transition CLIENTE pure : tampon → En cours, ZÉRO écriture
  // Core (aucun observable « coup d'envoi » au référentiel —
  // Path B = dette Audits/Référentiels). I4 tenu structurellement :
  // aucune saisie n'existe avant le sas, le sas est l'unique chemin
  // vers l'écran de saisie (S-2). Limite V1 assumée : reconnexion
  // entre ce tap et la 1ʳᵉ action réelle → tampon re-routé (re-tap
  // sans dégât). Aucun appel réseau ici → ne peut pas échouer.
  // ------------------------------------------------------------
  function coupEnvoi(btn) {
    // Anti-double-tap (gros doigts/gants) : on neutralise le bouton
    // dès le 1er tap. Idempotent même si l'event re-déclenche.
    if (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
    }
    _demarree = true;            // marqueur runtime TRANSITOIRE.
    // NB : ne défait PAS le comportement Path A au rechargement —
    // un vrai reload re-dérive l'état du Core (chargerEtatInitial).
    // Ce flag n'est qu'une ceinture anti-re-render dans la session.
    // S-2.b : au coup d'envoi la chronologie est vide (I4) → on
    // entre l'écran avec [] : score 0-0, historique vide cohérent
    // (pas un écran nu). Zéro appel réseau (cohérent Path A).
    entrerEnCours([]);
    aide(true);
    montrerEcran('scrEnCours');
  }

  // Arme le dépliement paresseux de la compo + le sas. <details>
  // émet 'toggle' ; on ne charge qu'à la 1re ouverture (idempotent
  // via _compoChargee). Le sas est armé une seule fois (garde
  // _suiviArme dédiée).
  function preparerTampon() {
    var repli = doc.getElementById('repliCompo');
    if (repli && !repli._suiviArme) {
      repli._suiviArme = true;
      repli.addEventListener('toggle', function () {
        if (repli.open) chargerCompo();
      });
    }
    var sas = doc.getElementById('btnCoupEnvoi');
    if (sas && !sas._suiviArme) {
      sas._suiviArme = true;
      // Tap délibéré UNIQUE, sans confirm : le sas (écran + gros
      // bouton) EST l'anti-erreur (S-1.4). Asymétrie intentionnelle
      // vs la clôture « Fin du match » qui, elle, confirme (S-3.4.a).
      sas.addEventListener('click', function () { coupEnvoi(sas); });
    }
  }

  // ============================================================
  // S-2.b · ÉCRAN « EN COURS » — ALIMENTATION LECTURE (cœur I5/I1)
  // Tout se reconstruit depuis le Core. Le score est CALCULÉ côté
  // client (jamais saisi — I1), le chrono est un placeholder
  // statique (décision validée). La palette (contenu selon camp),
  // le tap/écriture et le dépliement historique sont S-2.c/d/e.
  // ============================================================

  // Camp courant de la bascule (Zone B). Runtime transitoire :
  // pur état d'affichage, jamais persisté (I5). 'notre' par défaut
  // (cohérent aria-selected du markup S-2.a).
  var _camp = 'notre';

  // Dernière chronologie connue (mémo runtime transitoire, I5 :
  // jamais persisté, re-dérivé du Core à chaque boot). Sert au
  // refresh local et au ciblage du −1 adverse. Posé par
  // rafraichirEnCours.
  var _chrono = [];

  // Verrou anti-réentrance pendant un appel réseau d'écriture
  // (anti-double-tap global : un tap en cours bloque les autres
  // pour éviter doublons sous gants/stress).
  var _ecritureEnCours = false;

  // ------------------------------------------------------------
  // RÉFÉRENTIEL observables-match.json v1.1 — FIGÉ EN DUR.
  // Justification : c'est un fichier Drive, PAS une RPC. L'écran
  // bénévole est sans login → il ne peut pas le fetcher. La
  // convention projet fige les référentiels stables côté client.
  // Données vérifiées À LA SOURCE (décodées en S-1.d, 13 obs
  // Cat A). uuid + libellé + points = contrat backend exact ;
  // tout tap S-2.d passera ces valeurs telles quelles à
  // inserer_observable (categorie_obs='A').
  //
  // Sections d'affichage (spec S-2.2.a) :
  //   'score'  → Section 1 SCORANTES (urgence max, mises en avant)
  //   'event'  → Section 2 ÉVÉNEMENTS DE JEU (second rang)
  //   'jeu'    → Section 3 JEU — AJOUT SIGNALÉ : la spec S-2.2.a
  //              ne place PAS les 4 obs jeu_collectif (mêlées/
  //              touches). Section neutre non scorante = choix
  //              honnête (rien de caché, aucune urgence inventée).
  //              MICRO-DETTE : placement définitif à confirmer
  //              côté Conception. Signalé, pas tranché unilatéral.
  // ------------------------------------------------------------
  var OBS = [
    // Section 1 — scorantes (ordre spec : Essai/Transfo/Pénalité/Drop)
    { id: 'obs-A-essai',         libelle: 'Essai',          points: 5, sec: 'score' },
    { id: 'obs-A-transfo',       libelle: 'Transformation', points: 2, sec: 'score' },
    { id: 'obs-A-penalite',      libelle: 'Pénalité',       points: 3, sec: 'score' },
    { id: 'obs-A-drop',          libelle: 'Drop',           points: 3, sec: 'score' },
    // Section 2 — événements de jeu (non scorants)
    { id: 'obs-A-substitution',  libelle: 'Remplacement',   points: 0, sec: 'event' },
    { id: 'obs-A-avertissement', libelle: 'Avertissement',  points: 0, sec: 'event' },
    { id: 'obs-A-jaune',         libelle: 'Carton jaune',   points: 0, sec: 'event' },
    { id: 'obs-A-rouge',         libelle: 'Carton rouge',   points: 0, sec: 'event' },
    { id: 'obs-A-blessure',      libelle: 'Blessure',       points: 0, sec: 'event' },
    // Section 3 — jeu (AJOUT signalé : non placé par S-2.2.a)
    { id: 'obs-A-melee-gagnee',  libelle: 'Mêlée gagnée',   points: 0, sec: 'jeu' },
    { id: 'obs-A-melee-perdue',  libelle: 'Mêlée perdue',   points: 0, sec: 'jeu' },
    { id: 'obs-A-touche-gagnee', libelle: 'Touche gagnée',  points: 0, sec: 'jeu' },
    { id: 'obs-A-touche-perdue', libelle: 'Touche perdue',  points: 0, sec: 'jeu' }
  ];
  var SECTIONS = [
    { key: 'score', label: 'Scorantes' },
    { key: 'event', label: 'Événements de jeu' },
    { key: 'jeu',   label: 'Jeu' }
  ];

  function btnObservable(o, scorante) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'suivi-obs' + (scorante ? ' suivi-obs--score' : '');
    b.setAttribute('data-obs', o.id);
    // Seam S-3 : côté Notre, une scorante devra ouvrir la
    // sélection joueur (Zone D = S-3). Marqué visuellement ;
    // le COMPORTEMENT au tap (et la dégradation) = S-2.d.
    if (_camp === 'notre' && scorante) {
      b.setAttribute('data-seam', 'joueur');
    }
    var lib = doc.createElement('span');
    lib.textContent = o.libelle;                 // anti-injection
    b.appendChild(lib);
    if (o.points) {
      var p = doc.createElement('span');
      p.className = 'suivi-obs__pts';
      p.textContent = (o.points > 0 ? '+' : '') + o.points;
      b.appendChild(p);
    }
    // S-2.d : tap câblé. On capture l'observable + le camp AU
    // MOMENT du rendu (closure) — _camp peut changer ensuite via
    // la bascule, mais ce bouton appartient au camp où il a été
    // rendu (rendrePalette reconstruit tout au changement de camp).
    var campDuBouton = _camp;
    b.addEventListener('click', function () {
      taperObservable(o, campDuBouton, scorante, b);
    });
    return b;
  }

  /**
   * Rend la palette Zone C selon _camp (spec S-2.2.b — asymétrie
   * forte). Côté Notre : 3 sections étiquetées. Côté Adverse :
   * score seul + bouton −1 (zéro joueur). STRUCTUREL : aucun tap
   * actif (S-2.d câblera les comportements).
   */
  function rendrePalette() {
    var zc = doc.getElementById('zoneC');
    if (!zc) return;
    var ph = doc.getElementById('zcPlaceholder');
    if (ph) ph.remove();
    zc.innerHTML = '';

    if (_camp === 'adverse') {
      // Adverse = score seul + −1 (S-2.2.b). Pas de sections, pas
      // d'événements, pas de joueur. Radicalement plus simple.
      var secA = doc.createElement('div');
      secA.className = 'suivi-pal__section';
      var labA = doc.createElement('p');
      labA.className = 'suivi-pal__label';
      labA.textContent = 'Score adverse';
      secA.appendChild(labA);
      var grid = doc.createElement('div');
      grid.className = 'suivi-pal__grid';
      for (var i = 0; i < OBS.length; i++) {
        if (OBS[i].sec === 'score') grid.appendChild(btnObservable(OBS[i], true));
      }
      // Bouton −1 (correction réflexe, S-2.2.b / S-3.4.b) :
      // annule la DERNIÈRE action adverse non encore annulée,
      // sans déplier l'historique. Geste réflexe borné (pas de
      // dégât en cascade). Câblé S-2.d.
      var moins = doc.createElement('button');
      moins.type = 'button';
      moins.className = 'suivi-obs suivi-obs--moins';
      moins.setAttribute('data-action', 'moins-adverse');
      moins.textContent = '−1 (annuler le dernier)';
      moins.addEventListener('click', function () {
        moinsAdverse(moins);
      });
      grid.appendChild(moins);
      secA.appendChild(grid);
      zc.appendChild(secA);
      return;
    }

    // Notre équipe = 3 sections étiquetées.
    for (var s = 0; s < SECTIONS.length; s++) {
      var sec = SECTIONS[s];
      var wrap = doc.createElement('div');
      wrap.className = 'suivi-pal__section';
      var lab = doc.createElement('p');
      lab.className = 'suivi-pal__label';
      lab.textContent = sec.label;
      wrap.appendChild(lab);
      var g = doc.createElement('div');
      g.className = 'suivi-pal__grid';
      var n = 0;
      for (var k = 0; k < OBS.length; k++) {
        if (OBS[k].sec !== sec.key) continue;
        g.appendChild(btnObservable(OBS[k], sec.key === 'score'));
        n++;
      }
      if (n > 0) { wrap.appendChild(g); zc.appendChild(wrap); }
    }
  }

  /**
   * Score live = SOMME des valeur_points par camp, lignes NON
   * annulées. Pure lecture, ZÉRO écriture (I1 : le score est un
   * résultat calculé ; consoliderScoreRencontre est réservé à la
   * clôture S-4 / Mode Vidéo S-5, pas au rafraîchissement live).
   * getChronologieRencontre exclut déjà les annulées par défaut ;
   * on re-filtre par prudence (idempotent, défensif).
   */
  function calculerScore(lignes) {
    var mom = 0, adv = 0;
    if (lignes && lignes.length) {
      for (var i = 0; i < lignes.length; i++) {
        var l = lignes[i];
        if (l && l.annule === true) continue;
        var pts = (typeof l.valeur_points === 'number') ? l.valeur_points : 0;
        if (!pts) continue;
        if (l.equipe_concernee === 'adverse') adv += pts;
        else mom += pts;                 // 'notre' (ou défaut sûr)
      }
    }
    return { mom: mom, adv: adv };
  }

  function rendreScore(lignes) {
    var el = doc.getElementById('zaScore');
    if (!el) return;
    var s = calculerScore(lignes);
    // Reconstruit le contenu sans innerHTML d'entrée utilisateur
    // (les nombres sont sûrs ; on garde le markup .pts pour le style).
    el.innerHTML =
      'MOM <span class="pts">' + s.mom + '</span> — '
      + '<span class="pts">' + s.adv + '</span> ADV';
  }

  /**
   * Rendu Zone E — les 2 DERNIÈRES lignes (feedback I1 : « j'ai
   * noté → je vois ma note »). La chronologie arrive triée
   * horodatage ASC (ordre de jeu) → les 2 dernières = fin de
   * tableau. Dépliement complet = S-2.e (bouton laissé désactivé).
   *
   * FORMAT VOLONTAIREMENT PROVISOIRE : le format définitif de
   * ligne (1MT 0' / 2MT 11' + libellés lisibles via référentiel)
   * est tranché en S-3 (spec S-2.5). Ici : marqueur période/minute
   * brut + observable_id brut + joueur via libelleJoueur. Marqué
   * comme provisoire ; aucune invention du format que S-3 doit
   * fixer. Dégradation honnête.
   */
  function ligneTexte(l) {
    if (!l) return '';
    var per = (l.periode != null) ? l.periode : '—';
    var min = (l.minute_match != null) ? l.minute_match : '—';
    var obs = l.observable_id ? String(l.observable_id) : '?';
    var pts = (typeof l.valeur_points === 'number' && l.valeur_points)
      ? (' (' + (l.valeur_points > 0 ? '+' : '') + l.valeur_points + ')') : '';
    var camp = (l.equipe_concernee === 'adverse') ? 'ADV' : 'MOM';
    // libelleJoueur = règle UNIQUE de dégradation nom_court NULL
    // (numéro = ancre). NE PAS reconstruire ici.
    var joueur = '';
    if (l.equipe_concernee !== 'adverse'
        && (l.joueur_uuid || l.nom_court)) {
      joueur = ' · ' + global.SuiviClient.libelleJoueur(l);
    } else if (l.equipe_concernee !== 'adverse'
               && typeof l.valeur_points === 'number'
               && l.valeur_points > 0) {
      // Scorante côté nous SANS joueur = fallback DS-1 (Zone D /
      // S-3 pas encore là, ou choix D-7 « je ne sais pas »). On le
      // signale : le coach complétera (Mode Vidéo S-5 / Zone D S-3).
      joueur = ' · (joueur à compléter)';
    }
    return 'P' + per + ' ' + min + "' · " + camp + ' · ' + obs + pts + joueur;
  }

  function rendreHistorique(lignes) {
    var liste = doc.getElementById('zeList');
    var vide  = doc.getElementById('zeEmpty');
    var toggle = doc.getElementById('zeToggle');
    if (!liste || !vide) return;

    var actives = [];
    if (lignes && lignes.length) {
      for (var i = 0; i < lignes.length; i++) {
        if (lignes[i] && lignes[i].annule === true) continue;
        actives.push(lignes[i]);
      }
    }

    if (actives.length === 0) {
      vide.removeAttribute('hidden');
      liste.setAttribute('hidden', '');
      liste.innerHTML = '';
      if (toggle) { toggle.disabled = true; }
      return;
    }

    vide.setAttribute('hidden', '');
    liste.removeAttribute('hidden');
    // Les 2 dernières (fin de tableau = plus récentes), plus
    // récente en tête (lecture live naturelle).
    var deux = actives.slice(-2).reverse();
    liste.innerHTML = '';
    for (var j = 0; j < deux.length; j++) {
      var li = doc.createElement('li');
      li.textContent = ligneTexte(deux[j]);   // textContent : anti-injection
      liste.appendChild(li);
    }
    // Le dépliement « tout voir » est S-2.e : bouton actif SEULEMENT
    // s'il y a plus de 2 lignes, mais sans handler ici (S-2.e).
    if (toggle) { toggle.disabled = (actives.length <= 2); }
  }

  /**
   * Rafraîchit l'écran « En cours » à partir d'une chronologie
   * DÉJÀ chargée (aucun appel réseau ici). Réutilisé par S-2.d
   * (après écriture) et S-5 (polling). Public sur SuiviApp.
   */
  function rafraichirEnCours(lignes) {
    // Mémo runtime TRANSITOIRE de la dernière chronologie connue.
    // Sert au −1 adverse (cibler la dernière action adverse) et
    // évite une relecture réseau pour ce calcul. JAMAIS persisté
    // (I5) : un reload re-dérive tout du Core via boot().
    _chrono = Array.isArray(lignes) ? lignes : [];
    rendreScore(_chrono);
    rendreHistorique(_chrono);
    // Zone A chrono : placeholder statique laissé tel quel (markup
    // S-2.a). Le moteur chrono est un lot dédié ultérieur.
    // Palette Zone C : rendue selon _camp (S-2.c). Structurelle —
    // les comportements au tap sont câblés en S-2.d.
    rendrePalette();
  }

  // Bascule camp (Zone B) — VISUEL seulement en S-2.b. Le contenu
  // de la palette selon le camp est S-2.c ; ici on met juste à
  // jour l'état aria + _camp pour que S-2.c s'y branche.
  function armerBascule() {
    var tNotre = doc.getElementById('zbNotre');
    var tAdv   = doc.getElementById('zbAdverse');
    if (!tNotre || !tAdv || tNotre._suiviArme) return;
    tNotre._suiviArme = true;
    function set(camp) {
      _camp = camp;
      var n = (camp === 'notre');
      tNotre.setAttribute('aria-selected', n ? 'true' : 'false');
      tAdv.setAttribute('aria-selected', n ? 'false' : 'true');
      // S-2.c : re-rendu de la palette Zone C selon le camp.
      rendrePalette();
    }
    tNotre.addEventListener('click', function () { set('notre'); });
    tAdv.addEventListener('click', function () { set('adverse'); });
  }

  /**
   * Entrée dans l'écran « En cours ». Appelée par le routage
   * 'demarre' (avec la chronologie déjà chargée) ET par le coup
   * d'envoi (avec [] : chronologie vide, I4). Idempotente.
   */
  function entrerEnCours(lignes) {
    armerBascule();
    rafraichirEnCours(lignes || []);
  }

  // ============================================================
  // S-2.d · FEEDBACK AU TAP + ÉCRITURE
  // 1 tap = 1 ligne (insererObservable). Le fil de l'historique
  // qui s'enrichit EST le feedback (I1 / S-2.2.c) — pas de notif
  // séparée. Le score se recalcule du Core (jamais saisi — I1).
  // ============================================================

  // Petit feedback visuel immédiat au tap (certitude sous pluie/
  // stress, S-2.2.c) AVANT même le retour réseau : le bouton
  // s'enfonce. La confirmation RÉELLE = la ligne qui apparaît
  // après refresh (I1).
  function flashBouton(btn) {
    if (!btn) return;
    btn.classList.add('suivi-obs--flash');
    global.setTimeout(function () {
      btn.classList.remove('suivi-obs--flash');
    }, 220);
  }

  // Bandeau d'erreur non bloquant (persona réseau instable : une
  // erreur d'écriture n'est pas un drame, rien n'est perdu —
  // l'état vrai reste le Core, I5 ; le bénévole peut re-taper).
  function erreurEphemere(msg) {
    var zc = doc.getElementById('zoneC');
    if (!zc) return;
    var old = doc.getElementById('suiviErrFlash');
    if (old) old.remove();
    var d = doc.createElement('div');
    d.id = 'suiviErrFlash';
    d.className = 'suivi-err-flash';
    d.setAttribute('role', 'status');
    d.textContent = msg;
    zc.insertBefore(d, zc.firstChild);
    global.setTimeout(function () {
      var e = doc.getElementById('suiviErrFlash');
      if (e) e.remove();
    }, 4000);
  }

  // Relit la chronologie du Core et rafraîchit l'écran. SEUL point
  // de relecture réseau après écriture (I5 : on ne fait jamais
  // confiance à un état local ; on re-dérive du Core). Réutilisé
  // par S-5 (polling).
  function refreshDepuisCore() {
    return global.SuiviClient.getChronologieRencontre(_token)
      .then(function (lignes) {
        rafraichirEnCours(lignes || []);
      })
      .catch(function (e) {
        if (global.console) console.error('MOM Hub Suivi: refreshDepuisCore()', e);
        // On NE casse pas l'écran : l'ancienne vue reste affichée,
        // un prochain tap/polling re-tentera (persona réseau).
      });
  }

  /**
   * Tap sur un observable de la palette. Construit le payload
   * conforme à la signature insererObservable (vérifiée à la
   * source) et écrit. SEAM S-3 géré par DÉGRADATION (validé) :
   * scorante côté Notre → enregistrée pour l'ÉQUIPE, joueurUuid
   * OMIS (= fallback DS-1, contrainte tranchée Option A). Fallback
   * TEMPORAIRE (Zone D = S-3 pas encore là), ≠ choix délibéré D-7 :
   * la ligne sera marquée « à compléter ».
   *
   * @param o          observable du référentiel figé {id,libelle,points,sec}
   * @param camp        'notre' | 'adverse' (capturé au rendu)
   * @param scorante    true si section 'score'
   * @param btn         le bouton tapé (anti-double-tap + flash)
   */
  function taperObservable(o, camp, scorante, btn) {
    if (_ecritureEnCours) return;          // verrou global anti-doublon
    if (!o || !o.id) return;
    _ecritureEnCours = true;
    if (btn) btn.disabled = true;
    flashBouton(btn);

    var obs = {
      observableId:  o.id,
      categorieObs:  'A',                  // référentiel = Cat A (S-2.c)
      valeurPoints:  (typeof o.points === 'number') ? o.points : 0,
      equipeConcernee: (camp === 'adverse') ? 'adverse' : 'notre',
      saisiParRole:  'benevole',
      sourceSaisie:  'live'
      // joueurUuid VOLONTAIREMENT omis :
      //  - adverse → jamais de joueur (asymétrie S-2.2.b)
      //  - notre   → seam S-3 : Zone D (sélection joueur) pas
      //    encore là ; on dégrade en action ÉQUIPE (joueur NULL),
      //    autorisé par DS-1 (Option A). Fallback temporaire.
      // minuteMatch / periode NON fournis : moteur chrono = lot
      //  ultérieur ; les DEFAULT SQL s'appliquent (pas d'invention).
      // estBlessure : non géré ici. Le double effet PI-6 (blessure)
      //  sera traité avec sa confirmation dédiée en S-3 (S-3.4.c) —
      //  taper « Blessure » ici insère juste la ligne observable
      //  SANS p_est_blessure (constat simple). Le déclenchement du
      //  double effet est explicitement renvoyé à S-3.
    };

    global.SuiviClient.insererObservable(_token, obs).then(function (res) {
      if (!res || !res.ok) {
        erreurEphemere("Action non enregistrée. Vérifie le réseau et retape.");
        return;
      }
      // Succès : on re-dérive du Core. Le fil qui s'enrichit EST
      // le feedback (I1) — la ligne apparaît dans Zone E.
      return refreshDepuisCore();
    }).catch(function (e) {
      if (global.console) console.error('MOM Hub Suivi: taperObservable()', e);
      erreurEphemere("Action non enregistrée. Vérifie le réseau et retape.");
    }).then(function () {
      _ecritureEnCours = false;
      if (btn) btn.disabled = false;       // réactivé (re-tap possible)
    });
  }

  /**
   * −1 adverse (S-2.2.b / S-3.4.b) : annule la DERNIÈRE action
   * adverse non encore annulée, sans déplier l'historique. Borné
   * (pas de cascade). Utilise annulerObservable. La cible est
   * trouvée dans _chrono (dernière ligne equipe='adverse' &
   * annule!=true, par horodatage = fin de tableau).
   */
  function moinsAdverse(btn) {
    if (_ecritureEnCours) return;
    var cible = null;
    for (var i = _chrono.length - 1; i >= 0; i--) {
      var l = _chrono[i];
      if (l && l.equipe_concernee === 'adverse' && l.annule !== true) {
        cible = l; break;
      }
    }
    if (!cible || !cible.id) {
      erreurEphemere("Aucune action adverse à annuler.");
      return;
    }
    _ecritureEnCours = true;
    if (btn) btn.disabled = true;
    flashBouton(btn);
    global.SuiviClient.annulerObservable(_token, cible.id).then(function (res) {
      if (!res || !res.ok) {
        erreurEphemere("Annulation non enregistrée. Vérifie le réseau.");
        return;
      }
      return refreshDepuisCore();
    }).catch(function (e) {
      if (global.console) console.error('MOM Hub Suivi: moinsAdverse()', e);
      erreurEphemere("Annulation non enregistrée. Vérifie le réseau.");
    }).then(function () {
      _ecritureEnCours = false;
      if (btn) btn.disabled = false;
    });
  }

  // ------------------------------------------------------------
  // BOOT : pilote 100 % par le Core (I5). Recalculé à chaque appel
  // (chargement initial OU clic Réessayer) — jamais de cache local.
  // ------------------------------------------------------------
  function boot() {
    aide(false);
    montrerEcran('scrLoading');

    if (!clientPresent()) {
      // suivi-client.js absent/échec de chargement : réseau probable
      // → réessayable (recharger peut récupérer le script).
      afficherErreur(
        "Problème de chargement de l'outil. Vérifie ta connexion et réessaie.",
        true
      );
      return;
    }

    var token = global.SuiviClient.getToken();
    _token = token;            // runtime transitoire, jamais persisté

    global.SuiviClient.chargerEtatInitial(token).then(function (res) {
      switch (res && res.statut) {

        case 'jeton-absent':
          // Lien ouvert sans ?t= : ce n'est pas « expiré », c'est
          // « pas un lien de suivi ». Message distinct, non réessayable.
          afficherErreur(
            "Ce lien n'est pas un lien de suivi de match. Demande le bon lien au coach.",
            false
          );
          break;

        case 'jeton-invalide':
          // Le backend a rejeté : lien inconnu, révoqué (relais) ou
          // expiré. Réessayer n'y changera rien.
          afficherErreur(
            "Ce lien de suivi n'est plus valide (expiré ou remplacé). Demande un nouveau lien au coach.",
            false
          );
          break;

        case 'erreur-reseau':
          // Persona « réseau instable » : cas attendu, pas un drame.
          // Réessayable.
          afficherErreur(
            "Connexion impossible pour le moment. Vérifie ton réseau et réessaie.",
            true
          );
          break;

        case 'non-demarre':
          // Jeton OK, aucune ligne → coup d'envoi pas encore donné
          // (I4 verrouille la saisie avant le sas). On va au TAMPON.
          // Contenu du tampon = S-1.c : on arme le peuplement
          // paresseux de l'aperçu compo (AV-2) puis on affiche.
          preparerTampon();
          aide(true);
          montrerEcran('scrTampon');
          break;

        case 'demarre':
          // Jeton OK, ≥1 ligne → le match tourne. I2 : on ne
          // REVIENT JAMAIS au tampon. SEAM S-5 : distinguer
          // « même bénévole reconnecté » (→ En cours direct) vs
          // « relais d'un nouveau » (→ écran de reprise) se tranche
          // en S-5. En attendant, route vers « En cours ».
          // S-2.b : peuple l'écran depuis la chronologie DÉJÀ
          // chargée par chargerEtatInitial (zéro appel réseau
          // supplémentaire — on réutilise res.chronologie).
          entrerEnCours(res.chronologie);
          aide(true);
          montrerEcran('scrEnCours');
          break;

        default:
          // Statut inattendu : on ne devine pas, on dégrade
          // proprement plutôt que de planter (anti-invention).
          afficherErreur(
            "Une erreur inattendue est survenue à l'ouverture du suivi.",
            true
          );
      }
    }).catch(function (e) {
      // Filet ultime : aucune exception ne doit laisser l'écran
      // bloqué sur « Ouverture… ».
      if (global.console) { console.error('MOM Hub Suivi: boot()', e); }
      afficherErreur(
        "Connexion impossible pour le moment. Vérifie ton réseau et réessaie.",
        true
      );
    });
  }

  // ------------------------------------------------------------
  // Démarrage au chargement du DOM.
  // ------------------------------------------------------------
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // API publique minimale. rafraichirEnCours sera réutilisé par
  // S-2.d (refresh après écriture) et S-5 (polling/relais). On
  // n'expose QUE ce dont les lots suivants ont besoin (pas de
  // surface inutile — P3). Tout l'état reste interne (I5).
  global.SuiviApp = {
    rafraichirEnCours: rafraichirEnCours
  };

  if (global.console) {
    console.log(
      '%c🏉 MOM Hub · Suivi App v0.6 (En cours · saisie) chargé',
      'color: #2d7a3e; font-weight: bold;'
    );
  }

})(typeof window !== 'undefined' ? window : globalThis);
