/* ============================================================
   MOM Hub — Service Worker
   v1.0 (socle PWA, pt 74)

   STRATÉGIE : network-first STRICT.
   - Toute requête tente le réseau D'ABORD → données Supabase
     et code déployé TOUJOURS frais (jamais de version périmée).
   - Le cache ne sert QUE de filet hors-ligne pour la coquille
     (navigations HTML) : si le réseau échoue, on rend la dernière
     page de navigation vue, ou à défaut index.html.
   - Les appels Supabase/API (cross-origin) ne sont JAMAIS mis en
     cache : hors-ligne = échec honnête, pas de fausse donnée.

   Changer CACHE_NAME (bump du suffixe) force la purge des anciens
   caches au prochain 'activate'.
   ============================================================ */

'use strict';

const CACHE_NAME = 'mom-hub-shell-v1';

/* Origine du SW = origine du site (GitHub Pages). On ne met en cache
   QUE les réponses same-origin de type navigation (documents HTML). */
const SELF_ORIGIN = self.location.origin;

self.addEventListener('install', (event) => {
  // Activation immédiate du nouveau SW sans attendre la fermeture des onglets.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne gère que les GET.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin (Supabase, CDN polices, etc.) : on laisse passer,
  // réseau direct, JAMAIS de cache. Hors-ligne = échec naturel.
  if (url.origin !== SELF_ORIGIN) return;

  // Navigations (documents HTML) : network-first + filet hors-ligne.
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Met en cache une copie de la coquille fraîche (pour le offline).
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) => hit || caches.match('./index.html')
          )
        )
    );
    return;
  }

  // Autres same-origin (css/js/images/icônes) : network-first,
  // cache en secours hors-ligne uniquement. Le réseau gagne toujours
  // quand il est là → pas de JS/CSS périmé après commit.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
