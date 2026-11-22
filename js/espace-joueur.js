/* =====================================================================
 * espace-joueur.js — Espace joueur & famille (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v2.3 — 22 novembre 2026 — EVAL-JOUEUR Avenant C, lot C4
 *   FAIT FOI §11 (D29–D45), sql_286, js/criteres-eval.js v1.0,
 *   data/criteres-eval.json v1.1.
 *   v2.3 : auto-évaluation à 6 critères (libellé + rappel FFR, D29/D30),
 *          tous requis ; « Moyen » ou « Difficile » ouvre « Ce que je veux
 *          travailler » (cases facultatives, D33) avec message non
 *          bloquant dès le seuil (D34) ; « J'ai joué à ce poste » :
 *          proposé d'après la compo pour un titulaire, à choisir sinon
 *          (D36), liste du critère 6 = famille + Buteur, masquages par
 *          catégorie (D44 : rien pour le poste en M6–M10) ; rappel des
 *          objectifs du dernier match à cocher atteint / en partie / pas
 *          atteint (D41) ; 3 objectifs pour le prochain match (D40).
 *          Comparaison à 6 critères + ce que chacun propose de travailler
 *          + mes objectifs (D42) ; bilans : points à travailler du coach.
 *          envoyer_auto_eval : + p_feu_mental, p_sous_criteres,
 *          p_poste_famille, p_objectifs, p_bilan_objectifs (sql_286).
 * Version : v2.2 — 21 novembre 2026 — PARCOURS-PERFORMANCE v1.3, lot L7
 *   (FAIT FOI v1.3 D20, sql_282). Nouvelle section « Mon Parcours » entre
 *   « Ma saison » et « Historique », lue dans la clé 'parcours' de
 *   get_espace_joueur : convocations en sélection (convoqué, retenu,
 *   réserviste seulement : la base ne renvoie ni « non retenu », ni
 *   « absent / blessé », ni les notes du staff) avec leurs matchs, puis
 *   l'équipe Performance (statut + matchs). Rien n'est affiché si la clé
 *   est absente ou vide. Aucun autre changement.
 * Version : v2.1 — 17 novembre 2026 — recette Manu : « je ne trouve pas le
 *   bouton Installer l'appli ». La page est installable (contrôle Chrome :
 *   aucune erreur d'installabilité, invite reçue), mais l'invite n'existe
 *   ni dans le navigateur intégré de WhatsApp, ni sur iPhone, ni dans
 *   certains navigateurs (Samsung Internet, Firefox). v2.1 : quand il n'y
 *   a pas d'invite, mode d'emploi toujours affiché (Android : ouvrir dans
 *   Chrome puis menu ⋮ → Installer / Ajouter à l'écran d'accueil ;
 *   iPhone : Safari → Partager → Sur l'écran d'accueil).
 * Version : v2.0 — 16 novembre 2026 — EVAL-JOUEUR Avenant B (FAIT FOI §10,
 *   gelé par Manu : code à 4 chiffres, session de 2 h, code oublié =
 *   réinitialiser le code seul). sql_268.
 *   v2.0 : APPLI INSTALLABLE + CODE PERSO.
 *          - B2 : le jeton du LIEN est mémorisé sur l'appareil
 *            (localStorage) puis retiré de l'adresse ; sans jeton (appli
 *            iPhone installée) : écran « Colle ton lien perso ».
 *          - B3/B4 : écran code (créer avec confirmation / saisir). Le code
 *            ouvre une SESSION de 2 h gardée en sessionStorage ; les RPC de
 *            données reçoivent le jeton de session (le jeton du lien seul
 *            ne donne plus rien). Le code n'est jamais stocké.
 *          - B5 : essais restants / blocage affichés.
 *          - Session expirée en cours d'usage : retour à l'écran code.
 *          - Pied de page : « Verrouiller » + « Installer l'appli »
 *            (Android : invite native ; iPhone : mode d'emploi).
 *          - Hors connexion : « Pas de connexion » + Réessayer.
 *          RPC anon : etat_acces_espace, definir_code_espace,
 *          ouvrir_session_espace (jeton du lien) ; get_espace_joueur,
 *          repondre_eval, envoyer_auto_eval (jeton de session).
 * Version : v1.4 — 16 novembre 2026 — EVAL-JOUEUR, retour terrain « page
 *   confuse, le dernier match est tout en bas » (plan validé par Manu).
 *   Cause : une carte « À toi de jouer » par match passé de la saison
 *   (jusqu'à 8 en M16) empilées au-dessus du dernier match. Choix de Manu :
 *   tous les matchs restent ouverts à l'auto-évaluation (pour retrouver les
 *   évals passées), mais repliés. Nouvel ordre :
 *     1. TON DERNIER MATCH (le plus récent, éval publiée ou avis attendu),
 *        avec le formulaire d'avis DEDANS s'il est verrouillé ou sans éval ;
 *     2. « Encore à donner ton avis » : une ligne repliée par autre match
 *        (🔒 d'abord : une éval du coach attend) ;
 *     3. MA SAISON : objectifs, progression, « Comment je me vois » ;
 *     4. HISTORIQUE replié : bilans de période, matchs précédents.
 *   Après un envoi hors dernier match : l'éval déverrouillée est dépliée
 *   et affichée. Aucun changement SQL ni de données reçues.
 * Version : v1.3 — 16 novembre 2026 — EVAL-JOUEUR D28 (retour terrain)
 *   v1.3 : « Revoir tes actions » : bouton vers la vidéo VEO du match +
 *          liste des moments à revoir (minute + libellé), veo_moments
 *          (sql_267). Repli : ancienne clé veo_minute si veo_moments absent.
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
 *     persistSession:false. v2.0 (B2/B4) : localStorage = jeton du lien
 *     seulement ; sessionStorage = jeton de session (2 h). Jamais le code.
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
  var CLE_LIEN = 'mom-ej-lien';        // v2.0 (B2) : localStorage
  var CLE_SESSION = 'mom-ej-session';  // v2.0 (B4) : sessionStorage

  var PERIODES = [
    { code: 'pre_saison', court: 'Pré-s.', titre: 'Pré-saison' },
    { code: 'p1', court: 'P1', titre: 'Période 1 · septembre / décembre' },
    { code: 'p2', court: 'P2', titre: 'Période 2 · janvier / mars' },
    { code: 'p3', court: 'P3', titre: 'Période 3 · avril / juin' }
  ];
  // v2.3 (Avenant C, D29) : les 6 critères viennent du référentiel
  // (js/criteres-eval.js) une fois chargé ; repli ci-dessous.
  var CE = window.CriteresEval || null;
  var CRITERES = [
    { cle: 'tech_indiv', nom: 'Technique' }, { cle: 'physique', nom: 'Physique' },
    { cle: 'comprehension', nom: 'Lecture du jeu' }, { cle: 'etat_esprit', nom: 'Engagement & collectif' },
    { cle: 'mental', nom: 'Mental' }, { cle: 'tech_poste', nom: 'Technique au poste' }
  ];
  var MAX_OBJECTIF = 120;  // D40
  var NB_OBJECTIFS = 3;    // D40
  var FEU_BILAN = { V: 'Acquis', O: 'En progrès', R: 'À travailler' };
  var FEU_MATCH = { V: 'Gros match', O: 'Dans le match', R: 'Match difficile' };
  // Avenant A : lecture d'un critère sur UN match (auto-évaluation et critères du coach).
  var FEU_CRITERE_MATCH = { V: 'Bien', O: 'Moyen', R: 'Difficile' };
  var COULEUR = { V: '#2d7a3e', O: '#b86e0a', R: '#c73e3e' };

  var etat = { token: null, donnees: null, client: null,
    lien: null,                  // v2.0 : jeton du LIEN (etat.token = jeton de SESSION)
    branche: false, invite: null, // v2.0 : écouteurs posés une fois ; invite d'installation
    visitePrecedente: undefined, // v1.2 : figée au 1er chargement
    saisies: {},                 // v1.2 : evenement_id -> { feux, gene, detail, mot } (+ v2.3 : sc, poste, objectifs, bilan)
    refCharge: false };          // v2.3 : référentiel des critères chargé

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

  // v2.3 (Avenant C) — référentiel et libellés.
  function categorie() { return etat.donnees && etat.donnees.joueur ? etat.donnees.joueur.categorie_code || null : null; }
  function libs(cle, codes) { return (Array.isArray(codes) ? codes : []).map(function (x) { return CE ? CE.libelle(cle, x) : x; }); }
  function nomCritere(c) {
    return esc(c.nom) + (c.ffr ? '<span class="ej-ffr">' + esc(c.ffr) + '</span>' : '');
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
    // v2.3 (D42) : ce que chacun propose de travailler, critère par critère.
    var scMoi = a.sous_criteres || {}, scCoach = m.sous_criteres || {};
    var travail = CRITERES.map(function (c) {
      var lm = libs(c.cle, scMoi[c.cle]), lc = libs(c.cle, scCoach[c.cle]);
      if (!lm.length && !lc.length) return '';
      return '<div class="ej-travail"><strong>' + esc(c.nom) + '</strong>'
        + (lm.length ? '<span>Toi : ' + esc(lm.join(' · ')) + '</span>' : '')
        + (lc.length ? '<span>Ton coach : ' + esc(lc.join(' · ')) + '</span>' : '') + '</div>';
    }).join('');
    var objs = Array.isArray(a.objectifs) ? a.objectifs : [];
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
      + (travail ? '<div class="ej-travail-bloc"><span class="ej-encart-titre">À travailler</span>' + travail + '</div>' : '')
      + (a.commentaire ? '<p class="ej-meta">Ton mot : ' + esc(a.commentaire) + '</p>' : '')
      + (objs.length ? '<div class="ej-travail-bloc"><span class="ej-encart-titre">Mes objectifs pour le match suivant</span>'
        + objs.map(function (o, i) { return '<div class="ej-objectif"><span class="ej-objectif-n">' + (i + 1) + '</span><span>' + esc(o) + '</span></div>'; }).join('')
        + '</div>' : '')
      + '</div>' + gene;
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
      // v1.3 (D28) : jusqu'à 5 moments ; repli sur l'ancienne minute unique.
      var moments = Array.isArray(m.veo_moments) ? m.veo_moments.filter(function (x) { return x && x.minute; })
        : (m.veo_minute ? [{ minute: m.veo_minute, libelle: null }] : []);
      h += '<div class="ej-encart ej-veo-bloc"><span class="ej-encart-titre">Revoir tes actions</span>'
        + (moments.length
          ? '<ul class="ej-moments">' + moments.map(function (x) {
            return '<li><span class="ej-moment-min">' + esc(x.minute) + '</span>' + (x.libelle ? '<span>' + esc(x.libelle) + '</span>' : '') + '</li>';
          }).join('') + '</ul>'
          : '')
        + '<a class="ej-veo" href="' + esc(m.veo_url) + '" target="_blank" rel="noopener noreferrer">'
        + '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>'
        + (moments.length ? 'Ouvrir la vidéo du match' : 'Revoir ton match') + '</a></div>';
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
      var travail = libs(c.cle, b.sous_criteres ? b.sous_criteres[c.cle] : null);
      return '<div class="ej-critere">' + pastille(feu)
        + '<div class="ej-critere-texte"><strong>' + esc(c.nom) + (feu ? ' · ' + esc(FEU_BILAN[feu]) : '') + '</strong>'
        + (obs ? esc(obs) : '')
        + (travail.length ? '<span class="ej-meta">À travailler : ' + esc(travail.join(' · ')) + '</span>' : '') + '</div></div>';
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
    if (!etat.saisies[evt]) {
      var x = (etat.donnees.a_auto_evaluer || []).filter(function (y) { return y.evenement_id === evt; })[0] || {};
      etat.saisies[evt] = { feux: {}, gene: null, detail: '', mot: '',
        // v2.3 : points à travailler, poste (pré-rempli pour un titulaire, D36), objectifs, bilan.
        sc: {}, poste: CE ? CE.familleDuPoste(x.poste_compo) : null, posteCompo: !!(CE && CE.familleDuPoste(x.poste_compo)),
        objectifs: ['', '', ''], bilan: {} };
    }
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

  // v2.3 (D33/D34) : cases « Ce que je veux travailler » d'un critère.
  function blocTravail(evt, c, s) {
    var feu = s.feux[c.cle];
    var cat = categorie();
    if (c.cle === 'tech_poste' && CE && CE.sansSousCriteresPoste(cat)) return '';
    var l = CE ? CE.sousCriteres(c.cle, { categorie: cat, famille: c.cle === 'tech_poste' ? s.poste : null }) : [];
    if (!l.length && c.cle !== 'tech_poste') return '';
    var coches = s.sc[c.cle] || [];
    var corps = l.length
      ? l.map(function (x) {
        return '<label class="ej-sc-case"><input type="checkbox" data-auto-sc="' + c.cle + '" data-auto="' + esc(evt) + '" value="' + esc(x.code) + '"'
          + (coches.indexOf(x.code) >= 0 ? ' checked' : '') + '><span>' + esc(x.libelle) + '</span></label>';
      }).join('')
      : '<p class="ej-meta" style="margin:0">Choisis d’abord ton poste plus haut.</p>';
    return '<div class="ej-sc" data-bloc-travail="' + c.cle + '"' + (feu === 'O' || feu === 'R' ? '' : ' hidden') + '>'
      + '<span class="ej-sc-titre">Ce que je veux travailler <span class="ej-meta">(facultatif)</span></span>' + corps
      + '<div data-alerte-travail="' + c.cle + '">' + alerteTravail(coches.length) + '</div></div>';
  }
  function alerteTravail(n) {
    var seuil = CE ? CE.seuil() : 3;
    return n >= seuil ? '<div class="ej-sc-alerte" role="status">' + esc(CE ? CE.messageAlerte('joueur', n) : '') + '</div>' : '';
  }

  function formAuto(x) {
    var evt = x.evenement_id;
    var s = saisieDe(evt);
    var cat = categorie();
    var idb = 'ae-' + esc(evt);
    // v2.3 (D41) : objectifs fixés au match précédent.
    var prec = x.objectifs_precedents && Array.isArray(x.objectifs_precedents.objectifs) ? x.objectifs_precedents : null;
    var res = CE ? CE.resultatsObjectifs() : [];
    var rappel = prec && prec.objectifs.length
      ? '<div class="ej-ae-rappel"><span class="ej-ae-nom">Mes objectifs du dernier match</span>'
        + '<span class="ej-meta">Fixés après ' + esc(titreMatch(prec)) + (prec.date ? ' du ' + esc(dateCourte(prec.date)) : '') + '. Facultatif.</span>'
        + prec.objectifs.map(function (o, i) {
          return '<div class="ej-rappel-obj"><span class="ej-rappel-texte">' + esc(o) + '</span>'
            + '<div class="ej-choix-groupe" role="group" aria-label="' + esc(o) + '">' + res.map(function (r) {
              return '<button type="button" class="ej-res" aria-pressed="' + (s.bilan[i] === r.code ? 'true' : 'false') + '"'
                + ' data-auto="' + esc(evt) + '" data-bilan="' + i + '" data-res="' + esc(r.code) + '">' + esc(r.libelle) + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>'
      : '';
    // v2.3 (D36) : poste joué (pas de liste en M6–M10, D44).
    var poste = '';
    if (CE && CE.estCharge() && !CE.sansSousCriteresPoste(cat)) {
      poste = '<div class="ej-ae-poste"><label for="' + idb + '-poste">J’ai joué à ce poste</label>'
        + '<select id="' + idb + '-poste" class="ej-champ" data-auto-poste="1" data-auto="' + esc(evt) + '">'
        + '<option value="">Choisis ton poste…</option>'
        + CE.familles().map(function (f) {
          return '<option value="' + esc(f.code) + '"' + (f.code === s.poste ? ' selected' : '') + '>' + esc(f.nom) + '</option>';
        }).join('') + '</select>'
        + '<span class="ej-meta">' + (s.posteCompo ? 'Proposé d’après la compo. Change-le si tu as joué ailleurs.'
          : 'Remplaçant ou poste changé ? Indique où tu as joué.') + '</span></div>';
    }
    var criteres = CRITERES.map(function (c) {
      var boutons = ['V', 'O', 'R'].map(function (f) {
        return '<button type="button" class="ej-choix ej-choix-' + f + '" aria-pressed="' + (s.feux[c.cle] === f ? 'true' : 'false') + '"'
          + ' data-auto="' + esc(evt) + '" data-critere="' + c.cle + '" data-feu="' + f + '">'
          + f + '<small>' + esc(FEU_CRITERE_MATCH[f]) + '</small></button>';
      }).join('');
      return '<div class="ej-ae-critere"><span class="ej-ae-nom">' + nomCritere(c) + '</span>'
        + '<div class="ej-choix-groupe" role="group" aria-label="' + esc(c.nom) + '">' + boutons + '</div>'
        + blocTravail(evt, c, s) + '</div>';
    }).join('');
    var ouiNon = ['oui', 'non'].map(function (v) {
      var actif = (v === 'oui' && s.gene === true) || (v === 'non' && s.gene === false);
      return '<button type="button" class="ej-oui-non" aria-pressed="' + (actif ? 'true' : 'false') + '" data-auto="' + esc(evt) + '" data-gene="' + v + '">'
        + (v === 'oui' ? 'Oui' : 'Non') + '</button>';
    }).join('');
    // v2.3 (D40) : objectifs pour le prochain match.
    var objectifs = '<div class="ej-ae-objectifs"><span class="ej-ae-nom">Mes objectifs pour le prochain match <span class="ej-meta">(facultatif, 3 au plus)</span></span>'
      + [0, 1, 2].slice(0, NB_OBJECTIFS).map(function (i) {
        return '<label for="' + idb + '-obj' + i + '">Objectif ' + (i + 1) + '</label>'
          + '<input type="text" id="' + idb + '-obj' + i + '" class="ej-champ" maxlength="' + MAX_OBJECTIF + '" data-auto-obj="' + i + '" data-auto="' + esc(evt) + '"'
          + (i === 0 ? ' placeholder="Ex. : plaquer bas sur chaque montée"' : '') + ' value="' + esc(s.objectifs[i] || '') + '">';
      }).join('')
      + '<span class="ej-meta">Tu les retrouveras à ta prochaine auto-évaluation.</span></div>';
    return '<div class="ej-ae" data-ae="' + esc(evt) + '">'
      + rappel + poste
      + '<p class="ej-meta" style="margin:0">Pour chaque point : <strong>V</strong> ça a bien marché · <strong>O</strong> moyen · <strong>R</strong> difficile. '
      + 'Si tu mets O ou R, tu peux cocher ce que tu veux travailler.</p>'
      + criteres + objectifs
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
  // v2.3 : redessine un formulaire (changement de poste) sans perdre la saisie.
  function rafraichirForm(evt) {
    var x = (etat.donnees.a_auto_evaluer || []).filter(function (y) { return y.evenement_id === evt; })[0];
    var bloc = document.querySelector('[data-ae="' + evt + '"]');
    if (x && bloc) bloc.outerHTML = formAuto(x);
  }

  // v1.4 — le « dernier match » : le plus récent entre les évals publiées
  // et les matchs qui attendent l'avis du joueur.
  function dateDe(x) { return String((x && x.date) || '').slice(0, 10); }
  function dernierMatch() {
    var d = etat.donnees;
    var cands = [];
    (d.matchs || []).forEach(function (m) { cands.push({ evt: m.evenement_id, date: dateDe(m.match), eval: m }); });
    (d.a_auto_evaluer || []).forEach(function (x) {
      if (!cands.some(function (c) { return c.evt === x.evenement_id; })) cands.push({ evt: x.evenement_id, date: dateDe(x), eval: null });
    });
    if (!cands.length) return null;
    cands.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
    var h = cands[0];
    h.auto = (d.a_auto_evaluer || []).filter(function (x) { return x.evenement_id === h.evt; })[0] || null;
    return h;
  }

  function carteHeros(h) {
    var m = h.eval;
    if (m && !m.verrouille) return carteDernierMatch(m);
    var x = h.auto || (m && m.match) || {};
    var intro = m
      ? '<p class="ej-avis-intro" style="margin:0;font-size:15px;line-height:1.4">🔒 <strong>Ton coach t’a écrit sur ce match.</strong> Dis-nous d’abord comment tu l’as vu, puis découvre son avis.</p>'
      : '<p class="ej-avis-intro" style="margin:0;font-size:15px;line-height:1.4">Ton coach n’a pas encore publié son évaluation. En attendant : comment tu as vu ton match ?</p>';
    return '<section class="ej-carte ej-carte-une" id="carte-auto-' + esc(h.evt) + '">'
      + '<div class="ej-carte-tete"><h2>Ton dernier match</h2>' + (m && estNouveau(m.publie_le) ? '<span class="ej-nouveau">NOUVEAU</span>' : '') + '</div>'
      + '<div class="ej-corps"><div><div class="ej-feu-libelle">' + esc(titreMatch(x)) + '</div>'
      + '<div class="ej-meta">' + (h.date ? esc(dateCourte(h.date)) + ' ' : '') + tagNiveau(x.niveau) + '</div></div>'
      + intro + (h.auto ? formAuto(h.auto) : '<p class="ej-meta">Ton avis sur ce match n’est plus disponible ici : parles-en à ton coach.</p>')
      + '</div></section>';
  }

  function carteAvisAutres(heroEvt) {
    var liste = (etat.donnees.a_auto_evaluer || []).filter(function (x) { return x.evenement_id !== heroEvt; });
    if (!liste.length) return '';
    liste = liste.slice().sort(function (a, b) {
      var va = verrouPour(a.evenement_id) ? 1 : 0, vb = verrouPour(b.evenement_id) ? 1 : 0;
      if (va !== vb) return vb - va;
      return dateDe(a) < dateDe(b) ? 1 : -1;
    });
    var lignes = liste.map(function (x) {
      var verrou = verrouPour(x.evenement_id);
      return ligneDepliable('auto-' + x.evenement_id,
        '<span class="ej-pastille ej-pastille-vide" aria-hidden="true">' + (verrou ? '🔒' : '✎') + '</span>',
        titreMatch(x), (x.date ? dateCourte(x.date) : '') + (verrou ? ' · ton coach t’a écrit' : ''),
        tagNiveau(x.niveau), false,
        '<div class="ej-corps" style="padding:0">' + formAuto(x) + '</div>');
    }).join('');
    return '<section class="ej-carte"><h2 class="ej-titre" style="padding:16px 16px 2px">Encore à donner ton avis</h2>'
      + '<p class="ej-meta" style="margin:0 16px 6px">' + esc(pluriel(liste.length, 'match', 'matchs'))
      + ' · 🔒 = ton coach t’a écrit, donne ton avis pour le lire</p>'
      + '<ul class="ej-liste">' + lignes + '</ul></section>';
  }

  function titreSection(t) {
    return '<h2 class="ej-section" style="font-family:\'Oswald\',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;'
      + 'color:var(--mute);margin:22px 4px 8px">' + esc(t) + '</h2>';
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

  function carteMatchs(matchs, heroEvt) {
    var autres = matchs.filter(function (m) { return m.evenement_id !== heroEvt; });
    if (!autres.length) return '';
    var lignes = autres.map(function (m) {
      var x = m.match || {};
      return ligneDepliable('match-' + m.id,
        m.verrouille ? '<span class="ej-pastille ej-pastille-vide" aria-label="Verrouillé">🔒</span>'
          : (m.feu ? '<span class="ej-pastille" style="background:' + COULEUR[m.feu] + '">' + esc(m.feu) + '</span>' : pastille(null)),
        titreMatch(x), metaMatch(x), tagNiveau(x.niveau), estNouveau(m.publie_le),
        '<div class="ej-corps" style="padding:0">' + contenuMatch(m) + '</div>');
    }).join('');
    return '<section class="ej-carte"><h2 class="ej-titre" style="padding:16px 16px 6px">Mes matchs précédents</h2><ul class="ej-liste">' + lignes + '</ul></section>';
  }

  // v2.2 (PARCOURS v1.3, D20) — section « Mon Parcours ».
  var PP_TYPES = { scf: 'Super Challenge de France', interdep: 'Tournoi interdépartemental',
    tournoi: 'Tournoi en sélection', journee_bleue: 'Journée bleue',
    stage: 'Stage / regroupement', detection: 'Détection', autre: 'Sélection' };
  var PP_STATUTS = { convoque: 'Convoqué', retenu: 'Retenu', reserviste: 'Réserviste' };
  var PP_ROLES = { titulaire: 'Titulaire', entre: 'Entré', non_entre: 'Sur la feuille' };
  var PP_EQUIPE = { integre: 'Intégré', renfort: 'Renfort', double_licence: 'Double licence' };

  function ligneMatchParcours(m, nousDefaut) {
    var nous = m.equipe_accueil || nousDefaut, eux = m.adversaire || '—';
    var ext = m.lieu === 'exterieur';
    var score = '', res = '';
    if (m.score_pour != null && m.score_contre != null) {
      res = m.score_pour > m.score_contre ? 'V' : (m.score_pour < m.score_contre ? 'D' : 'N');
      score = ext ? m.score_contre + '–' + m.score_pour : m.score_pour + '–' + m.score_contre;
    }
    var titre = (ext ? eux : nous) + (score ? ' ' + score + ' ' : ' – ') + (ext ? nous : eux);
    var realis = [];
    function a(n, un, plus) { n = Number(n) || 0; if (n) realis.push(n + ' ' + (n > 1 ? plus : un)); }
    a(m.essais, 'essai', 'essais'); a(m.transformations, 'transfo', 'transfos');
    a(m.penalites, 'pénalité', 'pénalités'); a(m.drops, 'drop', 'drops');
    var role = [PP_ROLES[m.statut_joueur] || m.statut_joueur]
      .concat(m.numero != null ? ['n°' + m.numero] : [])
      .concat(m.capitaine ? ['capitaine'] : [])
      .concat(realis);
    var couleur = res === 'V' ? 'var(--feu-v)' : (res === 'D' ? 'var(--feu-r)' : 'var(--mute)');
    return '<div style="background:var(--paper);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px">'
      + '<div style="font-size:14px;font-weight:700">' + esc((m.phase ? m.phase + ' · ' : dateCourte(m.date_match) + ' · ') + titre)
      + (res ? ' <span style="color:' + couleur + '">' + res + '</span>' : '') + '</div>'
      + '<div class="ej-meta">' + esc(role.join(' · ')) + '</div></div>';
  }

  function carteParcours() {
    var p = etat.donnees && etat.donnees.parcours;
    if (!p) return '';
    var convs = Array.isArray(p.convocations) ? p.convocations : [];
    var matchs = Array.isArray(p.matchs) ? p.matchs : [];
    var sel = matchs.filter(function (m) { return !!m.convocation_id; });
    var club = matchs.filter(function (m) { return !m.convocation_id; });
    if (!convs.length && !p.equipe && !club.length) return '';
    function kpi(v, l) {
      return '<div style="background:var(--doux);border-radius:10px;padding:10px 6px;text-align:center">'
        + '<div style="font-family:\'Oswald\',sans-serif;font-size:24px;font-weight:600">' + v + '</div>'
        + '<div class="ej-meta">' + esc(l) + '</div></div>';
    }
    function sousTitre(t) {
      return '<div style="font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase">' + esc(t) + '</div>';
    }
    var h = '';
    if (convs.length) {
      var essais = sel.reduce(function (t, m) { return t + (Number(m.essais) || 0); }, 0);
      h += sousTitre('En sélection')
        + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">'
        + kpi(convs.length, convs.length > 1 ? 'convocations' : 'convocation')
        + kpi(sel.length, sel.length > 1 ? 'matchs' : 'match')
        + kpi(essais, essais > 1 ? 'essais' : 'essai') + '</div>';
      h += convs.map(function (c) {
        var dates = dateCourte(c.date_debut) + (c.date_fin && c.date_fin !== c.date_debut ? ' → ' + dateCourte(c.date_fin) : '');
        var meta = [dates, c.equipe, c.lieu].filter(Boolean).join(' · ');
        var retenu = c.statut === 'retenu';
        var mc = sel.filter(function (m) { return m.convocation_id === c.id; });
        return '<div style="border-top:1px solid var(--doux);padding-top:12px;display:flex;flex-direction:column;gap:6px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
          + '<strong style="font-size:15px">' + esc(c.intitule || PP_TYPES[c.type] || 'Sélection') + '</strong>'
          + '<span class="ej-tag" style="' + (retenu ? 'background:var(--feu-v);color:#fff' : 'background:#e6ecf6;color:#1f3a68') + '">'
          + esc(PP_STATUTS[c.statut] || c.statut) + '</span></div>'
          + '<div class="ej-meta">' + esc((PP_TYPES[c.type] && c.intitule !== PP_TYPES[c.type] ? PP_TYPES[c.type] + ' · ' : '') + meta) + '</div>'
          + mc.map(function (m) { return ligneMatchParcours(m, c.equipe || 'Sélection'); }).join('')
          + '</div>';
      }).join('');
    }
    if (p.equipe || club.length) {
      var eq = p.equipe || {};
      var ligne = [PP_EQUIPE[eq.statut] || eq.statut, eq.equipe_accueil, eq.structure].filter(Boolean).join(' · ');
      h += '<div style="' + (convs.length ? 'border-top:1px solid var(--doux);padding-top:12px;' : '') + 'display:flex;flex-direction:column;gap:6px">'
        + sousTitre('En équipe Performance')
        + (ligne ? '<div class="ej-meta">' + esc(ligne) + '</div>' : '')
        + (club.length ? club.map(function (m) { return ligneMatchParcours(m, eq.equipe_accueil || 'Équipe Performance'); }).join('')
          : '<div class="ej-meta">Pas encore de match saisi.</div>')
        + '</div>';
    }
    return '<section class="ej-carte ej-carte-une"><div class="ej-carte-tete"><h2>⭐ Mon Parcours</h2></div>'
      + '<div class="ej-corps">' + h + '</div></section>';
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
    // v1.4 : 1 dernier match · 2 avis à donner · 3 ma saison · 4 historique.
    var heros = dernierMatch();
    var heroEvt = heros ? heros.evt : null;
    if (heros) {
      h += carteHeros(heros);
    } else if (!bilans.length) {
      h += '<section class="ej-carte"><p class="ej-vide">Pas encore d’évaluation publiée cette saison. '
        + 'Reviens après le prochain match : ton coach t’écrira ici.</p></section>';
    }
    h += carteAvisAutres(heroEvt);
    var saison = carteObjectifs(bilans) + carteProgression(bilans) + carteFrise();
    if (saison) h += titreSection('Ma saison') + saison;
    var parcours = carteParcours(); // v2.2 (PARCOURS v1.3, D20)
    if (parcours) h += titreSection('Mon Parcours') + parcours;
    var histo = carteBilans(bilans) + carteMatchs(matchs, heroEvt);
    if (histo) h += titreSection('Historique') + histo;
    h += piedAppli();
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
    if (res.error && res.error.code === '42501') { expirer(); return; }
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
      var cle = b.getAttribute('data-critere');
      s.feux[cle] = b.getAttribute('data-feu');
      // v2.3 (D33) : « Ce que je veux travailler » seulement sous O ou R.
      var ouvert = s.feux[cle] === 'O' || s.feux[cle] === 'R';
      if (!ouvert) s.sc[cle] = [];
      var bt = bloc.querySelector('[data-bloc-travail="' + cle + '"]');
      if (bt) {
        bt.hidden = !ouvert;
        if (!ouvert) {
          Array.prototype.forEach.call(bt.querySelectorAll('input[data-auto-sc]'), function (x) { x.checked = false; });
          var za = bt.querySelector('[data-alerte-travail]');
          if (za) za.innerHTML = '';
        }
      }
    } else if (b.hasAttribute('data-bilan')) {
      // v2.3 (D41) : re-clic = effacer.
      var i = b.getAttribute('data-bilan');
      var deja = b.getAttribute('aria-pressed') === 'true';
      if (deja) delete s.bilan[i]; else s.bilan[i] = b.getAttribute('data-res');
      Array.prototype.forEach.call(b.parentNode.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', !deja && x === b ? 'true' : 'false');
      });
      return;
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

  // v2.3 : seulement sous un critère O ou R (contrôle base identique).
  function sousCriteresEnvoi(s) {
    var o = {};
    CRITERES.forEach(function (c) {
      var f = s.feux[c.cle];
      if ((f === 'O' || f === 'R') && s.sc[c.cle] && s.sc[c.cle].length) o[c.cle] = s.sc[c.cle].slice();
    });
    return o;
  }
  function bilanEnvoi(evt, s) {
    var x = (etat.donnees.a_auto_evaluer || []).filter(function (y) { return y.evenement_id === evt; })[0];
    var objs = x && x.objectifs_precedents && Array.isArray(x.objectifs_precedents.objectifs) ? x.objectifs_precedents.objectifs : [];
    return objs.map(function (o, i) { return s.bilan[i] ? { objectif: o, resultat: s.bilan[i] } : null; }).filter(Boolean);
  }

  async function envoyerAuto(b) {
    var evt = b.getAttribute('data-envoyer-auto');
    var s = saisieDe(evt);
    var msg = b.parentNode.querySelector('[data-msg]');
    if (!saisieComplete(s)) { msg.innerHTML = '<span class="ej-msg-err">Réponds aux ' + CRITERES.length + ' points et à la question santé.</span>'; return; }
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
      p_commentaire: s.mot.trim() || null,
      // v2.3 (Avenant C, sql_286).
      p_feu_mental: s.feux.mental || null,
      p_sous_criteres: sousCriteresEnvoi(s),
      p_poste_famille: s.poste || null,
      p_objectifs: s.objectifs.map(function (o) { return String(o || '').trim(); }).filter(Boolean),
      p_bilan_objectifs: bilanEnvoi(evt, s)
    });
    if (res.error && res.error.code === '42501') { expirer(); return; }
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
    var lu = mm && !mm.verrouille;
    var bandeau = '<div class="ej-merci" role="status">Merci ! Ton avis est envoyé.'
      + (lu ? ' Découvre celui de ton coach ci-dessous.' : ' Ton coach le lira.') + '</div>';
    // v1.4 : si ce n'est pas le dernier match, déplier son éval dans l'historique.
    var ligne = lu ? document.querySelector('[data-deplier="match-' + mm.id + '"]') : null;
    if (ligne) {
      ligne.setAttribute('aria-expanded', 'true');
      var det = $('det-match-' + mm.id);
      if (det) det.hidden = false;
      ligne.closest('li').insertAdjacentHTML('beforebegin', '<li style="list-style:none;padding:8px 12px">' + bandeau + '</li>');
      if (ligne.scrollIntoView) ligne.scrollIntoView({ block: 'start' });
      return;
    }
    var main = document.querySelector('#ej-page main');
    if (main) main.insertAdjacentHTML('afterbegin', bandeau);
    window.scrollTo(0, 0);
  }

  function brancher() {
    if (etat.branche) return;
    etat.branche = true;
    var page = $('ej-page');
    page.addEventListener('submit', function (e) { e.preventDefault(); });
    page.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      // v2.0 : écrans d'accès et pied d'appli.
      if (b.hasAttribute('data-code-valider')) { validerCode(b); return; }
      if (b.hasAttribute('data-lien-valider')) { validerLienColle(); return; }
      if (b.hasAttribute('data-reessayer')) { demarrer(); return; }
      if (b.hasAttribute('data-verrouiller')) { effacerSession(); ecranCode(); return; }
      if (b.hasAttribute('data-installer')) { installer(); return; }
      if (b.hasAttribute('data-auto')) { choisirAuto(b); return; }
      if (b.hasAttribute('data-envoyer-auto')) { envoyerAuto(b); return; }
      var aller = b.getAttribute('data-aller-auto');
      if (aller) {
        // v1.4 : le formulaire est soit dans « Ton dernier match », soit replié dans « Encore à donner ton avis ».
        var carte = $('carte-auto-' + aller);
        var l = carte ? null : document.querySelector('[data-deplier="auto-' + aller + '"]');
        if (l) {
          l.setAttribute('aria-expanded', 'true');
          var dd = $('det-auto-' + aller);
          if (dd) dd.hidden = false;
          carte = l;
        }
        if (carte && carte.scrollIntoView) carte.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      // v2.3 (D40) : objectifs pour le prochain match.
      if (e.target.hasAttribute && e.target.hasAttribute('data-auto-obj')) {
        saisieDe(e.target.getAttribute('data-auto')).objectifs[Number(e.target.getAttribute('data-auto-obj'))] = e.target.value;
        return;
      }
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
    // v2.3 : cases « Ce que je veux travailler » et poste joué.
    page.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.getAttribute) return;
      var evt = t.getAttribute('data-auto');
      if (!evt) return;
      var s = saisieDe(evt);
      if (t.hasAttribute('data-auto-sc')) {
        var cle = t.getAttribute('data-auto-sc');
        var l = (s.sc[cle] || []).filter(function (x) { return x !== t.value; });
        if (t.checked) l.push(t.value);
        s.sc[cle] = l;
        var bloc = t.closest('[data-bloc-travail]');
        var za = bloc ? bloc.querySelector('[data-alerte-travail]') : null;
        if (za) za.innerHTML = alerteTravail(l.length);
      } else if (t.hasAttribute('data-auto-poste')) {
        s.poste = t.value || null;
        s.sc.tech_poste = [];
        rafraichirForm(evt);
      }
    });
  }

  // ------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // v2.0 — Accès : lien mémorisé, code perso, session (Avenant B)
  // ------------------------------------------------------------------
  function stockage(type) { try { return window[type]; } catch (_) { return null; } }
  function lireLien() { var st = stockage('localStorage'); try { return st ? st.getItem(CLE_LIEN) : null; } catch (_) { return null; } }
  function ecrireLien(t) { var st = stockage('localStorage'); try { if (st) st.setItem(CLE_LIEN, t); } catch (_) { /* navigation privée */ } }
  function effacerLien() { var st = stockage('localStorage'); try { if (st) st.removeItem(CLE_LIEN); } catch (_) { /* rien */ } }
  function lireSession() {
    var st = stockage('sessionStorage');
    try {
      var o = st ? JSON.parse(st.getItem(CLE_SESSION) || 'null') : null;
      if (!o || !o.session || !o.expire_le || new Date(o.expire_le).getTime() <= Date.now()) return null;
      return o;
    } catch (_) { return null; }
  }
  function ecrireSession(o) { var st = stockage('sessionStorage'); try { if (st) st.setItem(CLE_SESSION, JSON.stringify(o)); } catch (_) { /* rien */ } }
  function effacerSession() { etat.token = null; var st = stockage('sessionStorage'); try { if (st) st.removeItem(CLE_SESSION); } catch (_) { /* rien */ } }
  function jetonDe(texte) {
    var m = String(texte || '').match(/[?&]t=([0-9a-f]{64})/) || String(texte || '').trim().match(/^([0-9a-f]{64})$/);
    return m ? m[1] : null;
  }
  function horsLigne(err) {
    return navigator.onLine === false || (err && /fetch|network|Failed to fetch|NetworkError/i.test(String(err.message || err)));
  }
  function ecranHorsLigne() {
    $('ej-page').innerHTML = '<div class="ej-erreur"><h2>Pas de connexion</h2><p>Vérifie ton réseau puis réessaie.</p>'
      + '<button type="button" class="ej-btn" data-reessayer>Réessayer</button></div>';
    brancher();
  }
  function enteteAcces() {
    return '<header class="ej-tete"><div class="ej-sur">MOM · Mon espace</div><h1>Ton espace joueur</h1>'
      + '<p>Évaluations, avis du coach, progression</p></header>';
  }

  function ecranLien(msg) {
    $('ej-page').innerHTML = enteteAcces() + '<main><section class="ej-carte"><div class="ej-corps ej-acces">'
      + '<h2 class="ej-titre">Colle ton lien perso</h2>'
      + '<p class="ej-meta">C’est le lien envoyé par ton coach (il contient « espace-joueur.html?t= »). Tu ne le feras qu’une fois.</p>'
      + (msg ? '<p class="ej-msg-err">' + esc(msg) + '</p>' : '')
      + '<label for="ej-lien-colle">Ton lien</label>'
      + '<input type="url" id="ej-lien-colle" class="ej-champ" autocomplete="off" placeholder="https://…/espace-joueur.html?t=…">'
      + '<button type="button" class="ej-btn" data-lien-valider>Continuer</button>'
      + '</div></section></main>';
    brancher();
  }
  function validerLienColle() {
    var t = jetonDe($('ej-lien-colle').value);
    if (!t) { ecranLien('Ce lien n’est pas reconnu. Copie-le en entier depuis le message de ton coach.'); return; }
    ecrireLien(t);
    effacerSession();
    demarrer();
  }

  async function ecranCode(msg) {
    var cli = getClient();
    if (!cli) { ecranHorsLigne(); return; }
    var r;
    try { r = await cli.rpc('etat_acces_espace', { p_token: etat.lien }); } catch (e) { ecranHorsLigne(); return; }
    if (r.error) {
      if (horsLigne(r.error)) { ecranHorsLigne(); return; }
      if (r.error.code === '42501') {
        effacerLien();
        ecranLien('Ce lien n’est plus valable. Demande le nouveau lien à ton coach, puis colle-le ici.');
        return;
      }
      erreur('Chargement impossible', 'Réessaie dans quelques instants.');
      return;
    }
    var creer = !r.data.code_defini;
    var bloque = r.data.bloque_jusqua;
    var champ = function (id, label) {
      return '<label for="' + id + '">' + label + '</label>'
        + '<input type="password" id="' + id + '" class="ej-champ ej-champ-code" inputmode="numeric" pattern="[0-9]*"'
        + ' maxlength="4" autocomplete="off" placeholder="••••">';
    };
    $('ej-page').innerHTML = enteteAcces() + '<main><section class="ej-carte"><div class="ej-corps ej-acces">'
      + '<h2 class="ej-titre">' + (creer ? 'Choisis ton code perso' : 'Entre ton code') + '</h2>'
      + '<p class="ej-meta">' + (creer
        ? '4 chiffres, à retenir. Il protège ton espace (tes évaluations, ce que tu signales). Tu peux le donner à tes parents.'
        : 'Ton code à 4 chiffres. Code oublié ? Demande à ton coach de le réinitialiser.') + '</p>'
      + (bloque ? '<p class="ej-msg-err">Trop d’essais. Réessaie à ' + esc(new Date(bloque).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) + '.</p>'
        : (msg ? '<p class="ej-msg-err">' + esc(msg) + '</p>' : ''))
      + '<form>' + champ('ej-code', creer ? 'Ton code' : 'Code') + (creer ? champ('ej-code2', 'Confirme ton code') : '')
      + '<button type="submit" class="ej-btn" data-code-valider data-mode="' + (creer ? 'creer' : 'ouvrir') + '"' + (bloque ? ' disabled' : '') + '>'
      + (creer ? 'Valider mon code' : 'Ouvrir mon espace') + '</button></form>'
      + '</div></section></main>';
    brancher();
    var c = $('ej-code');
    if (c && !bloque) c.focus();
  }

  async function validerCode(b) {
    var mode = b.getAttribute('data-mode');
    var code = ($('ej-code').value || '').trim();
    if (!/^[0-9]{4}$/.test(code)) { ecranCode('Le code doit faire 4 chiffres.'); return; }
    if (mode === 'creer' && code !== ($('ej-code2').value || '').trim()) { ecranCode('Les deux codes ne sont pas identiques.'); return; }
    var cli = getClient();
    if (!cli) { ecranHorsLigne(); return; }
    b.disabled = true;
    var r;
    try {
      r = await cli.rpc(mode === 'creer' ? 'definir_code_espace' : 'ouvrir_session_espace', { p_token: etat.lien, p_code: code });
    } catch (e) { ecranHorsLigne(); return; }
    if (r.error) {
      if (horsLigne(r.error)) { ecranHorsLigne(); return; }
      if (r.error.code === '42501') { effacerLien(); ecranLien('Ce lien n’est plus valable. Demande le nouveau lien à ton coach.'); return; }
      if (r.error.code === '23505') { ecranCode('Un code existe déjà : entre-le.'); return; }
      ecranCode('Code refusé, réessaie.');
      return;
    }
    var d = r.data || {};
    if (!d.ok) {
      if (d.raison === 'pas_de_code') { ecranCode(); return; }
      if (d.raison === 'bloque') { ecranCode(); return; }
      ecranCode('Code incorrect. ' + pluriel(d.essais_restants, 'essai restant', 'essais restants') + '.');
      return;
    }
    ecrireSession({ session: d.session, expire_le: d.expire_le });
    etat.token = d.session;
    await ouvrirEspace();
  }

  async function ouvrirEspace() {
    var cli = getClient();
    if (!cli) { ecranHorsLigne(); return; }
    var res;
    try { res = await cli.rpc('get_espace_joueur', { p_token: etat.token }); } catch (e) { ecranHorsLigne(); return; }
    if (res.error || !res.data) {
      if (res.error && horsLigne(res.error)) { ecranHorsLigne(); return; }
      if (res.error && res.error.code === '42501') { effacerSession(); ecranCode('Ta session a expiré : entre ton code.'); return; }
      erreur('Chargement impossible', 'Réessaie dans quelques instants.');
      return;
    }
    etat.donnees = res.data;
    if (etat.visitePrecedente === undefined) etat.visitePrecedente = res.data.visite_precedente || null;
    // v2.3 : référentiel des critères (une fois ; repli sur les 6 libellés).
    if (CE && !etat.refCharge) {
      await CE.charger();
      etat.refCharge = true;
      if (CE.estCharge()) CRITERES = CE.criteres();
    }
    rendre();
    brancher();
  }

  // Session expirée pendant l'usage (réponse, auto-évaluation).
  function expirer() {
    effacerSession();
    ecranCode('Ta session a expiré : entre ton code pour continuer.');
  }

  // ---- Appli installable (B1) ----
  function estInstallee() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function piedAppli() {
    var ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
    var install = '';
    if (!estInstallee()) {
      if (etat.invite) {
        install = '<button type="button" class="ej-btn ej-btn-clair" data-installer>📲 Installer l’appli</button>';
      } else if (ios) {
        install = '<p class="ej-meta">📲 <strong>Installer l’appli sur iPhone</strong> : ouvre ce lien dans <strong>Safari</strong>, '
          + 'touche « Partager » (carré avec une flèche) puis « Sur l’écran d’accueil ».</p>';
      } else {
        install = '<p class="ej-meta">📲 <strong>Installer l’appli</strong> : ouvre ce lien dans <strong>Chrome</strong> '
          + '(depuis WhatsApp : menu ⋮ → « Ouvrir dans Chrome »), puis menu ⋮ → « Installer l’appli » '
          + 'ou « Ajouter à l’écran d’accueil ».</p>';
      }
    }
    return '<div class="ej-appli">' + install
      + '<button type="button" class="ej-lien-discret" data-verrouiller>🔒 Verrouiller mon espace</button></div>';
  }
  async function installer() {
    if (!etat.invite) return;
    etat.invite.prompt();
    try { await etat.invite.userChoice; } catch (_) { /* rien */ }
    etat.invite = null;
    if (etat.donnees && etat.token) rendre();
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    etat.invite = e;
    if (etat.donnees && etat.token && $('ej-page').querySelector('.ej-appli')) rendre();
  });

  async function demarrer() {
    // B2 : jeton du lien dans l'adresse → mémorisé puis retiré de l'adresse.
    var t = jetonDe(window.location.search);
    if (t) {
      if (lireLien() !== t) effacerSession();
      ecrireLien(t);
      try { window.history.replaceState(null, '', window.location.pathname); } catch (_) { /* rien */ }
    } else {
      t = lireLien();
    }
    if (!t) { ecranLien(); return; }
    etat.lien = t;
    if (navigator.onLine === false) { ecranHorsLigne(); return; }
    var s = lireSession();
    if (s) { etat.token = s.session; await ouvrirEspace(); return; }
    ecranCode();
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
