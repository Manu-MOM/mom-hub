/**
 * MOM Hub · Suivi de rencontre — contrôleur d'écran
 * =================================================
 *
 * Module IIFE dédié au module Suivi (pattern projet : 1 page = 1
 * contrôleur, cf. evenements-browser.js / seance-editor.js…).
 * Consomme SuiviClient (suivi-client.js) ; ne touche jamais
 * Supabase directement.
 *
 * Version : 0.1 — S-1.b (mai 2026)
 *   v0.1 : LOGIQUE DE BOOT SEULEMENT (paquet S-1, parcours d'entrée).
 *          getToken() → chargerEtatInitial() → routage entre les 5
 *          états posés en S-1.a (loading|error|tampon|encours|
 *          reprise). AUCUN contenu d'écran ici : le tampon est
 *          rempli en S-1.c, « En cours » en S-2, la reprise en S-5.
 *          Zéro localStorage / sessionStorage (I5 : tout l'état vit
 *          dans le Core, rien dans le navigateur — c'est ce qui rend
 *          le relais/reconnexion sans perte).
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
          // Contenu du tampon = S-1.c (écran volontairement vide ici).
          aide(true);
          montrerEcran('scrTampon');
          break;

        case 'demarre':
          // Jeton OK, ≥1 ligne → le match tourne. I2 : on ne
          // REVIENT JAMAIS au tampon. SEAM S-5 : distinguer
          // « même bénévole reconnecté » (→ En cours direct) vs
          // « relais d'un nouveau » (→ écran de reprise) se tranche
          // en S-5. En attendant, route vers « En cours »
          // (placeholder tant que S-2 n'est pas fait).
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

  if (global.console) {
    console.log(
      '%c🏉 MOM Hub · Suivi App v0.1 (boot) chargé',
      'color: #2d7a3e; font-weight: bold;'
    );
  }

})(typeof window !== 'undefined' ? window : globalThis);
