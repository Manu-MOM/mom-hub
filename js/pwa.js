/* ============================================================
   MOM Hub — Enregistrement PWA (Service Worker)
   v1.0 (socle PWA, pt 74)

   Rôle : enregistrer le Service Worker. Centralisé ici pour que
   chaque page n'ait qu'UNE ligne à charger (pas de logique dupliquée).

   Chemins RELATIFS obligatoires : le site est servi sous un
   sous-chemin GitHub Pages (.../mom-hub/), pas à la racine du domaine.
   Un './sw.js' résout donc bien dans le scope du Hub.

   Le link rel="manifest" reste, lui, dans le <head> de chaque page
   (exigence navigateur pour proposer l'installation) — voir snippet.
   ============================================================ */

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch(function (err) {
        // Échec non bloquant : l'app fonctionne, simplement pas installable.
        console.warn('[MOM Hub PWA] SW non enregistré :', err);
      });
  });
})();
