/**
 * MOM Hub · Espace salarié — barre d'onglets commune
 * ===================================================
 * ESPACE-SALARIE v1.0 — LOT L2 (FAIT FOI gelé par Manu le 17/10/2026, S1 option B).
 *
 * Les pages existantes du salarié deviennent les ONGLETS d'un seul « Espace
 * salarié ». Aucune page n'est fusionnée : chaque page garde sa garde d'accès,
 * ses RPC et son code ; ce module ne fait QUE dessiner la barre d'onglets.
 *
 *   Démarchage           -> demarchage-scolaire.html        (staff ; PROSPECTION-SCOLAIRE L3,
 *                                                            v1.1 du 18/10/2026, FAIT FOI v1.1 gelé)
 *   Séances              -> suivi-salarie.html              (staff)
 *   Agenda               -> missions-agenda.html            (staff ; import-agenda-salarie.html
 *                                                            est une profondeur de cet onglet)
 *   Heures & congés      -> suivi-salarie.html?vue=heures   (staff ; gestion-salarie.html?vue=heures
 *                                                            = profondeur employeur de cet onglet)
 *   Écoles & facturation -> gestion-salarie.html            (admin|bureau, garde de page identique)
 *
 *   À traiter            -> espace-salarie.html             (staff ; ACCUEIL, lot L3, en tête)
 *
 * USAGE : <nav class="es-bar" data-espace-salarie></nav> puis
 *         <script src="js/espace-salarie.js"></script> juste après.
 * L'onglet actif est déduit de l'URL (fichier + ?vue=). Un attribut
 * data-espace-salarie="<clé>" non vide force l'onglet actif.
 *
 * Doctrine reprise de hub-nav : la barre MASQUE, la garde de page PROTÈGE.
 * Onglets à jeton nés masqués (fail-safe), révélés après lecture des rôles.
 * Zéro SQL, zéro innerHTML sur des données, css/hub.css jamais touché.
 */
(function () {
  'use strict';

  var VERSION = '1.1';

  var ONGLETS = [
    { cle: 'traiter', label: 'À traiter',            href: 'espace-salarie.html' },
    { cle: 'demarchage', label: 'Démarchage',        href: 'demarchage-scolaire.html' },
    { cle: 'seances', label: 'Séances',              href: 'suivi-salarie.html' },
    { cle: 'agenda',  label: 'Agenda',               href: 'missions-agenda.html' },
    { cle: 'heures',  label: 'Heures & congés',      href: 'suivi-salarie.html?vue=heures' },
    { cle: 'ecoles',  label: 'Écoles & facturation', href: 'gestion-salarie.html', show: 'admin bureau' }
  ];

  var CSS = [
    '.es-bar { max-width: 980px; margin: 0 auto; padding: 22px 24px 0; box-sizing: border-box; }',
    '.es-bar .es-titre { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: .08em;',
    '  text-transform: uppercase; color: var(--ink-mute, #6b7a74); }',
    '.es-bar .es-tabs { display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch;',
    '  scrollbar-width: none; border-bottom: 2px solid var(--line, #cabe9f); }',
    '.es-bar .es-tabs::-webkit-scrollbar { display: none; }',
    '.es-bar .es-tab { flex: 0 0 auto; padding: 10px 16px; border-radius: 10px 10px 0 0; white-space: nowrap;',
    '  font-size: 14px; font-weight: 600; text-decoration: none; color: var(--ink, #0c3d24);',
    '  border: 1px solid transparent; border-bottom: 0; margin-bottom: -2px; }',
    '.es-bar a.es-tab:hover { background: var(--paper, #f8f5ec); }',
    '.es-bar .es-tab.active { background: #fff; border-color: var(--line, #cabe9f);',
    '  border-bottom: 2px solid #fff; color: var(--vert-bouteille, #0c3d24); font-weight: 700; cursor: default; }',
    '.es-bar + div[class$="-wrap"] { padding-top: 18px; }'
  ].join('\n');

  function ongletCourant(porteur) {
    var force = porteur.getAttribute('data-espace-salarie');
    if (force) { return force; }
    var u = new URL(window.location.href);
    var f = u.pathname.split('/').pop() || '';
    var vue = u.searchParams.get('vue');
    if (f === 'espace-salarie.html') { return 'traiter'; }
    if (f === 'demarchage-scolaire.html') { return 'demarchage'; }
    if (f === 'suivi-salarie.html') { return vue === 'heures' ? 'heures' : 'seances'; }
    if (f === 'missions-agenda.html' || f === 'import-agenda-salarie.html') { return 'agenda'; }
    if (f === 'gestion-salarie.html') { return vue === 'heures' ? 'heures' : 'ecoles'; }
    return '';
  }

  function construire(porteur) {
    var actif = ongletCourant(porteur);
    porteur.setAttribute('aria-label', 'Espace salarié');
    var titre = document.createElement('p');
    titre.className = 'es-titre';
    titre.textContent = 'Espace salarié';
    var tabs = document.createElement('div');
    tabs.className = 'es-tabs';
    ONGLETS.forEach(function (o) {
      var a = document.createElement('a');
      a.className = 'es-tab';
      a.textContent = o.label;
      a.setAttribute('data-es-cle', o.cle);
      if (o.cle === actif) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
        // Onglet actif cliquable seulement s'il s'agit d'une PROFONDEUR (ex. import
        // de l'agenda) : retour à la page de l'onglet. Sinon non-cliquable.
        var f = (new URL(window.location.href).pathname.split('/').pop() || '');
        if (f !== o.href.split('?')[0]) { a.setAttribute('href', o.href); }
      } else {
        a.setAttribute('href', o.href);
      }
      if (o.show) {
        a.setAttribute('data-es-show', o.show);
        a.hidden = true;
        a.setAttribute('aria-hidden', 'true');
      }
      tabs.appendChild(a);
    });
    porteur.appendChild(titre);
    porteur.appendChild(tabs);
  }

  function reveler(porteur) {
    async function appliquer() {
      try {
        if (typeof SupabaseHub === 'undefined') { return; }
        var session = await SupabaseHub.getSession();
        if (!session) { return; }
        var droits = await Promise.all([SupabaseHub.isAdmin(), SupabaseHub.hasRole('bureau')]);
        var bureau = droits[0] || droits[1];
        porteur.querySelectorAll('[data-es-show]').forEach(function (el) {
          if (bureau) { el.hidden = false; el.removeAttribute('aria-hidden'); }
        });
      } catch (e) { /* fail-safe : onglets filtrés restent masqués */ }
    }
    document.addEventListener('DOMContentLoaded', appliquer);
    window.addEventListener('pageshow', function (e) { if (e && e.persisted) { appliquer(); } });
  }

  var porteur = document.querySelector('[data-espace-salarie]');
  if (!porteur) {
    console.error('MOM Hub: espace-salarie v' + VERSION + ' chargé sans porteur [data-espace-salarie].');
    return;
  }
  var style = document.createElement('style');
  style.setAttribute('data-espace-salarie-style', '');
  style.textContent = CSS;
  document.head.appendChild(style);
  construire(porteur);
  reveler(porteur);
  window.EspaceSalarie = { version: VERSION, onglet: ongletCourant(porteur), onglets: ONGLETS.slice() };
})();
