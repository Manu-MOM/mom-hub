/**
 * MOM Hub · Navigation thématique partagée
 * =========================================
 * HUB-NAV v1.0 — naissance (chantier GENERALISATION-NAV-THEMATIQUE,
 * FAIT FOI gelé le 06/07/2026, calé STATE/CARTE pt 155).
 * HUB-NAV v1.1 — ajout du thème « ecoles » (chantier NAV-THEME-ECOLES,
 * FAIT FOI gelé le 07/07/2026, calé STATE/CARTE pt 158). Seule la table
 * THEMES gagne une entrée ; aucun comportement du module ne change.
 * HUB-NAV v1.2 — ajout du thème « pedagogie » (chantier NAV-THEME-PEDAGOGIE,
 * FAIT FOI gelé le 07/07/2026, calé STATE/CARTE pt 159). Seule la table
 * THEMES gagne une entrée ; aucun comportement du module ne change.
 * HUB-NAV v1.3 — ajout du thème « equipe » (chantier NAV-THEME-MON-EQUIPE,
 * FAIT FOI gelé le 07/07/2026, calé STATE/CARTE pt 160) + PORTEUR SILENCIEUX :
 * une page peut porter une barre thématique SANS être une destination du
 * menu (attribut data-hub-nav-silent). Sur une page silencieuse, la barre
 * complète du thème est rendue mais AUCUN lien n'est marqué courant (la page
 * est une PROFONDEUR — éditeur/vue ouvert par deep-link — pas une destination).
 * Seule extension de comportement depuis v1.0 ; thèmes existants inchangés
 * (aucun porteur silencieux sur logistique/ecoles/pedagogie → marquage courant
 * conservé à l'identique).
 * HUB-NAV v1.4 — ajout du thème « administration » (chantier NAV-THEME-
 * ADMINISTRATION, FAIT FOI gelé le 07/07/2026, calé STATE/CARTE pt 162). Les
 * 8 destinations (Équipes/Saisons/Sites/Rôles & accès/Staff/Fonctions staff/
 * Collectif (admin)/Import OVAL-E) sont posées SANS jeton : ces pages sont
 * admin-strict (garde de page redirige tout non-admin vers ./), la barre les
 * reflète pour tous (« la nav MASQUE, la garde PROTÈGE » — J1 pt 160). Seule
 * la table THEMES gagne une entrée ; aucun comportement du module ne change.
 * HUB-NAV v1.5 — retrait de la destination « Fonctions staff » du thème
 * « administration » (recette pt 162 : doublon avec l'onglet FONCTIONS de
 * staff.html, où la saisie des fonctions du staff se fait désormais). La
 * page fonctions-staff.html est conservée (orpheline de nav) ; aucune autre
 * destination ne change. Seule la table THEMES perd cette entrée ; aucun
 * comportement du module ne change.
 * HUB-NAV v1.6 — ajout du thème « salarie » (chantier NAV-THEME-SALARIE,
 * FAIT FOI gelé le 07/07/2026, calé STATE/CARTE pt 163). 3 destinations à
 * jetons DIFFÉRENCIÉS calés sur les gardes réelles (Gestion salarié =
 * 'admin bureau' ; Suivi salarié + Import agenda = 'staff'), patron mixte
 * hérité du thème « ecoles ». Nav strictement additive sur suivi-salarie.html
 * (agenda hub-agenda INTERDIT et flux d'édition NON touchés). Seule la table
 * THEMES gagne une entrée ; aucun comportement du module ne change.
 * HUB-NAV v1.7 — ajout de la destination « Agenda salarié »
 * (missions-agenda.html) au thème « salarie », entre « Suivi salarié » et
 * « Import agenda » (chantier MISSIONS-AGENDA, déplacement voie 1 de l'agenda
 * hors de suivi-salarie.html vers sa surface dédiée). Jeton 'staff' (voie 3 :
 * admin|bureau OU salarié relié, lecture seule — un salarié consulte son propre
 * planning). ÉCART DE GOUVERNANCE ACTÉ par Manu : modification d'un module
 * INTERDIT depuis v1.6, hors chantier de généralisation. Seule la table THEMES
 * gagne une entrée ; aucun comportement du module ne change. Le module reste
 * INTERDIT.
 * HUB-NAV v1.8 — ajout de la destination « Agenda des évènements »
 * (equipe-agenda.html) au thème « equipe », en DERNIÈRE position (après
 * « Statistiques ») — chantier AGENDA-EVENEMENTS (vue calendaire des évènements
 * par catégorie, patron hub-agenda v1.1). Posée SANS jeton comme les 4 autres
 * destinations du thème (décision J1 : la barre reflète le thème, la garde de
 * PAGE / le périmètre catégorie protègent le contenu). ÉCART DE GOUVERNANCE
 * ACTÉ par Manu : modification d'un module INTERDIT hors chantier de
 * généralisation (précédent v1.7). Seule la table THEMES gagne une entrée ;
 * aucun comportement du module ne change. Le module reste INTERDIT.
 *
 * ►► CLÔTURE DE LA GÉNÉRALISATION (G2, pt 163) : tous les thèmes sont
 * désormais migrés. À compter de v1.6, js/hub-nav.js devient INTERDIT
 * (patron hub-agenda) : plus aucune modification hors chantier dédié.
 *
 * UN SEUL POINT DE VÉRITÉ pour la navigation thématique du Hub.
 * Remplace le patron dupliqué HUB-NAV-LOGISTIQUE v2 (BLOCS A/B/C
 * byte-identiques, pt 155) par un module unique, gouvernance stricte
 * type hub-agenda (INTERDIT à la clôture du chantier de généralisation).
 *
 * USAGE (2 lignes par page, rien d'autre) :
 *   1. Dans la topbar, un PORTEUR VIDE à l'emplacement voulu :
 *        <nav class="main-nav hub-nav" data-hub-nav="logistique"></nav>
 *   2. Après </header> :
 *        <script src="js/hub-nav.js"></script>
 *   La page décide de l'EMPLACEMENT, le module décide du CONTENU.
 *   supabase-client.js doit être chargé sur la page (fin de body) pour
 *   la révélation des liens filtrés ; sinon ils restent masqués
 *   (fail-safe, patron data-show du dashboard).
 *
 * DOCTRINE ENCODÉE (leçons pt 155) :
 *   - L'ordre des styles est porteur de sens : le module injecte
 *     TOUJOURS le style outils PUIS, si carrefour, la surcharge
 *     carrefour — ordre garanti PAR CONSTRUCTION, l'intégrateur ne
 *     peut pas se tromper.
 *   - Lexique unifié GRAVÉ : « Accueil » = le portail (./) ;
 *     « Tableau de bord » = dashboard.html. Rien d'autre, jamais.
 *   - Doctrine carrefour/outils : pages-carrefour (portail, dashboard)
 *     = nav desktop seulement (mobile : icônes des cartes profil) ;
 *     pages-outils (thèmes) = nav partout, rangée défilable mobile.
 *   - Navigation PURE (N6) : zéro contenu vivant, zéro badge.
 *   - La nav MASQUE, la garde de page PROTÈGE (la garde reste LA vérité).
 *   - css/hub.css JAMAIS touché : surcharges scopées .hub-nav.
 *
 * INVARIANTS : aucun SQL ; hub-agenda.js / hub-agenda.css intacts ;
 * échec silencieux = liens filtrés masqués.
 */
(function () {
  'use strict';

  var VERSION = '1.8';

  /* ------------------------------------------------------------------ *
   * TRONC COMMUN — présent en tête de chaque nav (lexique unifié).
   * « Tableau de bord » est une porte staff : masqué fail-safe, révélé
   * admin|bureau|salarié par la révélation ci-dessous.
   * ------------------------------------------------------------------ */
  function tronc() {
    return [
      { label: 'Accueil', href: './' },
      { label: 'Tableau de bord', href: 'dashboard.html', show: 'staff' }
    ];
  }

  /* ------------------------------------------------------------------ *
   * LA TABLE DES THÈMES — source de vérité unique (FAIT FOI 06/07/2026).
   * Jetons de visibilité : 'staff' = admin|bureau|salarié ;
   * 'admin bureau' = admin|bureau. Liens sans jeton = tous rôles.
   * Les thèmes suivants (Écoles, Salarié, Pédagogie, Mon équipe,
   * Administration, Suivi match) seront ajoutés ICI, conversation par
   * conversation — jamais dans les pages.
   * ------------------------------------------------------------------ */
  var THEMES = {

    'logistique': {
      ariaLabel: 'Navigation logistique',
      carrefour: false,
      liens: tronc().concat([
        { label: 'Sites', href: 'logistique.html?type=site' },
        { label: 'Minibus', href: 'logistique.html?type=minibus' },
        { label: 'Autre', href: 'logistique.html?type=autre' },
        { label: 'Agenda', href: 'logistique-agenda.html' },
        { label: 'Bus', href: 'bus.html' },
        { label: 'Validation', href: 'logistique-validation.html', show: 'admin bureau' }
      ])
    },

    'ecoles': {
      ariaLabel: 'Navigation écoles',
      carrefour: false,
      liens: tronc().concat([
        { label: 'Démarchage', href: 'demarchage-scolaire.html', show: 'staff' },
        { label: 'Développement', href: 'developpement-scolaire.html', show: 'admin bureau' }
      ])
    },

    'pedagogie': {
      ariaLabel: 'Navigation pédagogie',
      carrefour: false,
      liens: tronc().concat([
        { label: 'Ressources', href: 'ressources.html' },
        { label: 'Bibliothèque', href: 'bibliotheque.html' },
        { label: 'Séance', href: 'seance.html' },
        { label: 'Planification', href: 'planification.html' }
      ])
    },

    'equipe': {
      ariaLabel: 'Navigation mon équipe',
      carrefour: false,
      // 5 DESTINATIONS sans jeton (décision J1 gelée pt 160) : la barre
      // reflète le thème, la garde de PAGE protège. joueurs/evenements
      // n'ont pas de garde bloquante (consultables anonyme) → la barre s'y
      // affiche aussi pour un non-connecté. Dette 🟠 ACCES-ANONYME-EQUIPE
      // ouverte pour le fond (exposition + doctrine nav-anon globale).
      // Les PROFONDEURS (compositions, pilotage, groupe-base) portent CE
      // MÊME thème via data-hub-nav-silent — pas de lien propre ici.
      // « Agenda des évènements » (v1.8, chantier AGENDA-EVENEMENTS) : vue
      // calendaire par catégorie ; contenu protégé par le périmètre catégorie.
      liens: tronc().concat([
        { label: 'Effectif', href: 'joueurs.html' },
        { label: 'Compositions', href: 'mes-compos.html' },
        { label: 'Évènements', href: 'evenements.html' },
        { label: 'Statistiques', href: 'pilotage-categorie.html' },
        { label: 'Agenda des évènements', href: 'equipe-agenda.html' }
      ])
    },

    'administration': {
      ariaLabel: 'Navigation administration',
      carrefour: false,
      // 8 DESTINATIONS sans jeton (décision J1 gelée pt 160, reconduite
      // pt 162) : les 8 pages du thème sont admin-strict (garde de PAGE
      // has_role('admin') → redirect ./ pour tout non-admin, vérifié à la
      // source 07/07). La barre les reflète pour tous ; la garde protège.
      // « Import OVAL-E » (avec A) — nommage FFR canonique.
      liens: tronc().concat([
        { label: 'Équipes', href: 'admin-equipes.html' },
        { label: 'Saisons', href: 'admin-saisons.html' },
        { label: 'Sites', href: 'admin-sites.html' },
        { label: 'Rôles & accès', href: 'roles-acces.html' },
        { label: 'Staff', href: 'staff.html' },
        { label: 'Collectif (admin)', href: 'u-admin.html' },
        { label: 'Import OVAL-E', href: 'import-oval-e.html' }
      ])
    },

    'salarie': {
      ariaLabel: 'Navigation salarié',
      carrefour: false,
      // Jetons DIFFÉRENCIÉS calés sur les gardes de page réelles (vérifiées
      // à la source 07/07), patron mixte hérité du thème « ecoles » :
      //  - Gestion salarié : garde admin|bureau (versant employeur) → 'admin bureau'
      //  - Suivi salarié   : garde admin|bureau écriture + salarié relié lecture → 'staff'
      //  - Agenda salarié   : garde admin|bureau OU salarié relié (voie 3, lecture seule) → 'staff'
      //  - Import agenda    : garde admin|bureau OU salarié (suis_je_salarie) → 'staff'
      // La nav reflète la garde : un salarié relié voit Suivi + Agenda + Import, pas Gestion.
      liens: tronc().concat([
        { label: 'Gestion salarié', href: 'gestion-salarie.html', show: 'admin bureau' },
        { label: 'Suivi salarié', href: 'suivi-salarie.html', show: 'staff' },
        { label: 'Agenda salarié', href: 'missions-agenda.html', show: 'staff' },
        { label: 'Import agenda', href: 'import-agenda-salarie.html', show: 'staff' }
      ])
    },

    'carrefour-portail': {
      ariaLabel: 'Navigation',
      carrefour: true,
      liens: tronc()
    },

    'carrefour-dashboard': {
      ariaLabel: 'Navigation',
      carrefour: true,
      // Sur le dashboard, « Tableau de bord » est la page courante : la
      // garde de page a déjà admis l'utilisateur, le lien naît VISIBLE
      // (patron BLOC A-DASHBOARD v1, avenant 3 pt 155) — il sera marqué
      // .active non-cliquable par le marquage ci-dessous.
      liens: [
        { label: 'Accueil', href: './' },
        { label: 'Tableau de bord', href: 'dashboard.html' }
      ]
    }
  };

  /* ------------------------------------------------------------------ *
   * STYLES — repris VERBATIM des BLOCS B et C prouvés pt 155.
   * css/hub.css masque .main-nav <1000px : la nav thématique y échappe
   * (spécificité .main-nav.hub-nav) et devient une rangée pleine largeur
   * défilable sous la marque (pages-outils).
   * ------------------------------------------------------------------ */
  var CSS_OUTILS = [
    '.main-nav.hub-nav {',
    '  gap: 20px;',
    '  overflow-x: auto;',
    '  -webkit-overflow-scrolling: touch;',
    '  white-space: nowrap;',
    '  scrollbar-width: none;',
    '}',
    '.main-nav.hub-nav::-webkit-scrollbar { display: none; }',
    '.main-nav.hub-nav a.active { cursor: default; }',
    '@media (max-width: 1000px) {',
    '  .topbar { height: auto; padding-top: 6px; padding-bottom: 8px; }',
    '  .main-nav.hub-nav {',
    '    display: flex;',
    '    grid-column: 1 / -1; /* topbar en grid entre 768 et 1000px */',
    '    flex-basis: 100%;    /* topbar en flex-wrap sous 768px */',
    '    order: 9;',
    '    justify-content: flex-start;',
    '    padding: 4px 0 2px;',
    '  }',
    '}'
  ].join('\n');

  // Doctrine carrefour : nav desktop seulement. Posé APRÈS le style
  // outils qu'il surcharge (même spécificité, l'ordre gagne) — ordre
  // garanti par injecterStyles(), PAR CONSTRUCTION (leçon pt 155).
  var CSS_CARREFOUR = [
    '@media (max-width: 1000px) {',
    '  .main-nav.hub-nav { display: none; }',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * Construction de la nav dans le porteur (DOM pur, zéro innerHTML).
   * Liens filtrés : naissent masqués (fail-safe), révélés plus bas.
   * ------------------------------------------------------------------ */
  function construire(nav, theme) {
    nav.setAttribute('aria-label', theme.ariaLabel);
    theme.liens.forEach(function (l) {
      var a = document.createElement('a');
      a.textContent = l.label;
      a.setAttribute('href', l.href);
      if (l.show) {
        a.setAttribute('data-nav-show', l.show);
        a.hidden = true;
        a.setAttribute('aria-hidden', 'true');
      }
      nav.appendChild(a);
    });
  }

  function injecterStyles(estCarrefour) {
    var s1 = document.createElement('style');
    s1.setAttribute('data-hub-nav-style', 'outils');
    s1.textContent = CSS_OUTILS;
    document.head.appendChild(s1);
    if (estCarrefour) {
      var s2 = document.createElement('style');
      s2.setAttribute('data-hub-nav-style', 'carrefour');
      s2.textContent = CSS_CARREFOUR;
      document.head.appendChild(s2);
    }
  }

  /* ------------------------------------------------------------------ *
   * Page courante — logique cle() reprise à l'IDENTIQUE du BLOC B v2.
   * Clé d'une URL = fichier + filtre ?type= éventuel. Le guichet sans
   * ?type= vaut 'site' (défaut D6 de logistique-browser.js).
   * ------------------------------------------------------------------ */
  function cle(href) {
    var u = new URL(href, window.location.href);
    var f = u.pathname.split('/').pop() || 'index.html';
    var t = u.searchParams.get('type');
    if (f === 'logistique.html') { t = t || 'site'; }
    return f + (t ? '?type=' + t : '');
  }

  // Lien courant marqué .active (style hub.css existant), href retiré =
  // non-cliquable, aria-current — patron des main-nav historiques.
  function marquerCourante(nav) {
    var courante = cle(window.location.href);
    nav.querySelectorAll('a[href]').forEach(function (a) {
      if (cle(a.getAttribute('href')) === courante) {
        a.classList.add('active');
        a.removeAttribute('href');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Révélation fail-safe des liens filtrés. Attend DOMContentLoaded :
   * supabase-client.js est chargé en fin de body, APRÈS ce module.
   * Échec silencieux = liens masqués (patron data-show du dashboard).
   * ------------------------------------------------------------------ */
  function revelerFiltres(nav) {
    document.addEventListener('DOMContentLoaded', async function () {
      try {
        if (typeof SupabaseHub === 'undefined') { return; }
        var session = await SupabaseHub.getSession();
        if (!session) { return; }
        var droits = await Promise.all([
          SupabaseHub.isAdmin(),
          SupabaseHub.hasRole('bureau'),
          SupabaseHub.suisJeSalarie()
        ]);
        var bureau = droits[0] || droits[1];
        var staff = bureau || droits[2];
        nav.querySelectorAll('[data-nav-show]').forEach(function (el) {
          var ok = (el.getAttribute('data-nav-show') === 'staff') ? staff : bureau;
          if (ok) { el.hidden = false; el.removeAttribute('aria-hidden'); }
        });
      } catch (e) { /* honnête : les liens filtrés restent masqués */ }
    });
  }

  /* ------------------------------------------------------------------ *
   * AUTO-BOOT (G1a gelé) — le module se monte seul sur le porteur
   * [data-hub-nav]. Thème inconnu = nav laissée vide, erreur console
   * tracée (fail-safe : rien de faux n'est affiché).
   * ------------------------------------------------------------------ */
  var porteur = document.querySelector('[data-hub-nav]');
  if (!porteur) {
    console.error('MOM Hub: hub-nav v' + VERSION + ' chargé sans porteur [data-hub-nav] — rien à monter.');
    return;
  }
  var clef = porteur.getAttribute('data-hub-nav');
  var theme = THEMES[clef];
  if (!theme) {
    console.error('MOM Hub: hub-nav — thème inconnu « ' + clef + ' », nav laissée vide (fail-safe).');
    return;
  }

  // PORTEUR SILENCIEUX (v1.3) : une PROFONDEUR (éditeur/vue ouvert par
  // deep-link) porte la barre pour naviguer/retourner, mais n'est PAS une
  // destination du menu → aucun de ses liens ne doit s'allumer « courant »
  // (sinon, p. ex., l'éditeur compositions.html allumerait à tort le lien
  // « Compositions » qui vise mes-compos.html). Le drapeau est déclaratif
  // sur le porteur : présence de l'attribut = silencieux (valeur ignorée).
  var silencieux = porteur.hasAttribute('data-hub-nav-silent');

  construire(porteur, theme);
  injecterStyles(theme.carrefour);
  if (!silencieux) { marquerCourante(porteur); }
  revelerFiltres(porteur);

  // Point de contrôle minimal (version consultable en console).
  window.HubNav = { version: VERSION, theme: clef, silencieux: silencieux };
})();
