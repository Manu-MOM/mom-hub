/**
 * MOM Hub · Groupe de base (U-N2)
 * ============================================================
 *
 * Écran DÉDIÉ « Groupe de base » d'une équipe engagée.
 * Doc UX `Conception-UX-Collectif-Compo-3-Niveaux-v1.md` §2 — FAIT
 * FOI (ancrages UN2-1..7). Modèle `Modelisation-Collectif-Compo-
 * 3-Niveaux-v1.md` v1.1 (N1/N2). DDL : sql/44 collectif_membre /
 * sql/45 equipe_engagee_membre (exécutés+vérifiés en base 19/05).
 * Couche données : SupabaseHub v1.23 (listCollectifMembres,
 * listGroupeEngage, addGroupeMembre, removeGroupeMembre,
 * getEvenementEquipeContext, getEquipesEngagees) — rien réinventé.
 *
 * Entrée : ?evenement_equipe=<uuid> (convention SD-1(a) assumée).
 *
 * Surface NEUVE (doc UX §1 « Niveau 1 = écran dédié », §2
 * « explicitement PAS des cases à cocher ») : N1 EST la source du
 * vivier (modèle N1-2), pas equipe_joueurs/getVivierCompo — donc
 * écran dédié, pas une extension de l'éditeur (l'éditeur = U-N3,
 * étape c). Aucune logique d'éditeur dupliquée (P1).
 *
 * Version : 1.1 — flèches de parcours (← fiche évènement / compositions →) ; v1.0 étape (b) chantier Collectif & compo 3 niveaux.
 *   v1.0 : 2 colonnes (vivier N1 / groupe N2) ; filtres rôle+statut
 *          + recherche nom (UN2-1/2/6) ; statut sous-ligne (UN2-2) ;
 *          cumul inter-équipes du même évènement visible non bloqué
 *          (UN2-3, P4 avertit) ; vrai doublon neutralisé (✓ grisé) ;
 *          groupe scindé Joueurs/Staff compteurs distincts (UN2-5) ;
 *          staff distinct (UN2-6) ; « liste vivante, aucune
 *          validation » (UN2-4) ; bandeau bas N2→N3 (UN2-7). Zéro
 *          localStorage/sessionStorage (état en mémoire). Dégradation
 *          honnête sur chaque erreur (jamais de trou silencieux).
 *   v1.1 : Flèches de PARCOURS dans l'en-tête (barre #gb-parcours, révélée
 *          après loadContext). « ← Fiche évènement » → evenements.html?fiche=
 *          <ctx.evenement.id> (deep-link lu par evenements-browser v1.54, la
 *          fiche étant un modal sans URL propre). « Compositions → » →
 *          compositions.html?evenement_equipe=<State.evtEqId> (même paramètre
 *          que cet écran). Href remplis dynamiquement dans renderHeader (ids
 *          connus après contexte). Matérialise le flux N2 → fiche / N2 → N3.
 */
(function (global) {
  'use strict';

  const STATUTS = {
    regulier:           'régulier',
    renfort_temporaire: 'renfort',
    en_transition:      'transition'
  };

  const State = {
    evtEqId:  null,
    ctx:      null,            // getEvenementEquipeContext().data
    vivier:   [],              // N1 (listCollectifMembres)
    groupe:   [],              // N2 (listGroupeEngage : rows {id, collectif_membre_id, collectif_membre{...}})
    ailleurs: new Set(),       // collectif_membre_id convoqués dans une AUTRE équipe engagée du MÊME évènement (UN2-3)
    fRole:    'tous',          // tous | joueur | staff
    fStatut:  'tous',          // tous | regulier | renfort_temporaire | en_transition
    q:        '',              // recherche nom
    busy:     false
  };

  const DOM = {
    title:        () => document.getElementById('gb-title'),
    subPlateau:   () => document.getElementById('gb-sub-plateau'),
    subCollectif: () => document.getElementById('gb-sub-collectif'),
    error:        () => document.getElementById('gb-error'),
    panel:        () => document.getElementById('gb-panel'),
    search:       () => document.getElementById('gb-search'),
    roleFilter:   () => document.getElementById('gb-role-filter'),
    statutFilter: () => document.getElementById('gb-statut-filter'),
    vivierList:   () => document.getElementById('gb-vivier-list'),
    vivierCount:  () => document.getElementById('gb-vivier-count'),
    grpJoueurs:   () => document.getElementById('gb-grp-joueurs'),
    grpStaff:     () => document.getElementById('gb-grp-staff'),
    cntJoueurs:   () => document.getElementById('gb-cnt-joueurs'),
    cntStaff:     () => document.getElementById('gb-cnt-staff'),
    banner:       () => document.getElementById('gb-banner'),
    parcours:     () => document.getElementById('gb-parcours'),
    navFiche:     () => document.getElementById('gb-nav-fiche'),
    navCompo:     () => document.getElementById('gb-nav-compo')
  };

  // ----------------------------------------------------------
  // Utilitaires (calqués sur compositions-editor.js, idiome projet)
  // ----------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function formatDateLong(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const mois  = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                   'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  }

  function nomMembre(cm) {
    const p = (cm && cm.personnes) ? cm.personnes : {};
    return [p.prenom, p.nom].filter(Boolean).join(' ') || '(sans nom)';
  }

  function roleBadge(role) {
    return role === 'staff'
      ? '<span class="gb-role gb-role--staff" title="Staff de l’équipe">🛎️ staff</span>'
      : '<span class="gb-role gb-role--joueur" title="Joueur">🏉 joueur</span>';
  }

  function statutLine(statut) {
    if (!statut) return '';
    const lib = STATUTS[statut] || statut;
    return '<span class="gb-statut gb-statut--' + escapeHtml(statut) + '">' + escapeHtml(lib) + '</span>';
  }

  function showError(msg) {
    const e = DOM.error();
    if (e) {
      e.textContent = msg;
      e.style.display = 'block';
    }
    const p = DOM.panel();
    if (p) p.style.display = 'none';
  }

  // ----------------------------------------------------------
  // Chargements (SupabaseHub — signatures déployées vérifiées)
  // ----------------------------------------------------------
  async function loadContext() {
    const r = await SupabaseHub.getEvenementEquipeContext(State.evtEqId);
    if (!r || !r.ok) {
      showError((r && r.error) || 'Contexte de l’équipe engagée introuvable.');
      return false;
    }
    State.ctx = r.data;
    return true;
  }

  async function loadVivier() {
    // pt 213 : vivier FUSIONNÉ (collectif_membre + encadrants fonction_staff).
    State.vivier = await SupabaseHub.listVivierCollectif(State.ctx.entente.id) || [];
  }

  async function loadGroupe() {
    State.groupe = await SupabaseHub.listGroupeEngage(State.evtEqId) || [];
  }

  // UN2-3 : cumul inter-équipes — convoqués dans une AUTRE équipe
  // engagée du MÊME évènement. Visible, JAMAIS bloquant (P4).
  async function loadAilleurs() {
    State.ailleurs = new Set();
    const evId = State.ctx && State.ctx.evenement && State.ctx.evenement.id;
    if (!evId) return;
    const autres = await SupabaseHub.getEquipesEngagees(evId) || [];
    for (const eq of autres) {
      if (!eq || !eq.id || eq.id === State.evtEqId) continue;
      const g = await SupabaseHub.listGroupeEngage(eq.id) || [];
      g.forEach(row => {
        if (row && row.collectif_membre_id) State.ailleurs.add(row.collectif_membre_id);
      });
    }
  }

  // ----------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------
  function renderHeader() {
    const ctx = State.ctx;
    const equipeLib = (ctx.equipe && (ctx.equipe.libelle_court || ctx.equipe.nom_officiel || ctx.equipe.code))
      || '(équipe)';
    const evtLib = (ctx.evenement && (ctx.evenement.libelle || ctx.evenement.code)) || '(événement)';
    const evtDate = ctx.evenement ? formatDateLong(ctx.evenement.date_debut) : '';
    const collLib = (ctx.entente && (ctx.entente.libelle_moyen || ctx.entente.libelle_court || ctx.entente.code))
      || '(collectif)';
    // UN2-1 : le titre ancre les 3 dimensions
    DOM.title().textContent = 'Groupe de base — ' + equipeLib;
    DOM.subPlateau().textContent = evtLib + (evtDate ? ' · ' + evtDate : '');
    DOM.subCollectif().textContent = 'Collectif ' + collLib;

    // Navigation du parcours : ← Fiche évènement (modal sans URL → deep-link
    // evenements.html?fiche=<id>, lu par evenements-browser v1.54) ;
    // Compositions → (même évènement_equipe que cet écran). On remplit les
    // href dynamiquement (ids connus seulement après loadContext) et on
    // révèle la barre.
    const evId = ctx.evenement && ctx.evenement.id;
    const navFiche = DOM.navFiche();
    const navCompo = DOM.navCompo();
    if (navFiche && evId) {
      navFiche.setAttribute('href', 'evenements.html?fiche=' + encodeURIComponent(evId));
    }
    if (navCompo && State.evtEqId) {
      navCompo.setAttribute('href', 'compositions.html?evenement_equipe=' + encodeURIComponent(State.evtEqId));
    }
    const parcours = DOM.parcours();
    if (parcours) parcours.style.display = 'flex';
  }

  function groupeIds() {
    const set = new Set();
    State.groupe.forEach(r => { if (r && r.collectif_membre_id) set.add(r.collectif_membre_id); });
    return set;
  }

  function passeFiltres(m) {
    if (State.fRole !== 'tous' && m.role !== State.fRole) return false;
    if (State.fStatut !== 'tous' && (m.statut || '') !== State.fStatut) return false;
    if (State.q) {
      const n = nomMembre(m).toLowerCase();
      if (n.indexOf(State.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function renderVivier() {
    const host = DOM.vivierList();
    const dejaIci = groupeIds();
    const liste = State.vivier.filter(passeFiltres);
    DOM.vivierCount().textContent = String(liste.length);
    if (liste.length === 0) {
      host.innerHTML = '<li class="gb-empty">Aucun membre dans le collectif pour ce filtre.</li>';
      return;
    }
    let html = '';
    liste.forEach(function (m) {
      const dansCeGroupe = dejaIci.has(m.id);          // vrai doublon (UN2-3) -> grisé + ✓
      const ailleurs     = !dansCeGroupe && State.ailleurs.has(m.id); // cumul (UN2-3) -> orange, flèche ACTIVE
      const cls = 'gb-item' + (dansCeGroupe ? ' gb-item--in' : (ailleurs ? ' gb-item--warn' : ''));
      html += '<li class="' + cls + '">';
      html += '<div class="gb-item-main">';
      html += '<div class="gb-item-name">' + escapeHtml(nomMembre(m)) + ' ' + roleBadge(m.role) + '</div>';
      html += '<div class="gb-item-sub">' + statutLine(m.statut);
      if (ailleurs) {
        html += '<span class="gb-warn-tag" title="Déjà convoqué dans une autre équipe engagée de cet évènement (autorisé — le Hub avertit, ne bloque pas)">⚠ déjà convoqué (autre équipe)</span>';
      }
      html += '</div>';
      html += '</div>';
      if (dansCeGroupe) {
        html += '<span class="gb-check" title="Déjà dans ce groupe">✓</span>';
      } else {
        // pt 213 : réf par index dans State.vivier (m.id peut être null pour un
        // encadrant fonction_staff à matérialiser). onAdd retrouve l'objet membre.
        html += '<button type="button" class="gb-btn gb-add" data-add-idx="' + State.vivier.indexOf(m) + '" title="Ajouter au groupe de base">→</button>';
      }
      html += '</li>';
    });
    host.innerHTML = html;
    host.querySelectorAll('[data-add-idx]').forEach(function (b) {
      b.addEventListener('click', function () { onAdd(State.vivier[Number(b.getAttribute('data-add-idx'))]); });
    });
  }

  function renderGroupe() {
    const joueurs = State.groupe.filter(r => r.collectif_membre && r.collectif_membre.role === 'joueur');
    const staff   = State.groupe.filter(r => r.collectif_membre && r.collectif_membre.role === 'staff');
    DOM.cntJoueurs().textContent = String(joueurs.length);
    DOM.cntStaff().textContent   = String(staff.length);

    function rows(arr, vide) {
      if (arr.length === 0) return '<li class="gb-empty">' + vide + '</li>';
      let h = '';
      arr.forEach(function (r) {
        const cm = r.collectif_membre || {};
        h += '<li class="gb-item">';
        h += '<div class="gb-item-main">';
        h += '<div class="gb-item-name">' + escapeHtml(nomMembre(cm)) + '</div>';
        h += '<div class="gb-item-sub">' + statutLine(cm.statut) + '</div>';
        h += '</div>';
        h += '<button type="button" class="gb-btn gb-rm" data-rm="' + escapeHtml(r.id) + '" title="Retirer du groupe">✕</button>';
        h += '</li>';
      });
      return h;
    }

    DOM.grpJoueurs().innerHTML = rows(joueurs, 'Aucun joueur convoqué.');
    DOM.grpStaff().innerHTML   = rows(staff, 'Aucun staff convoqué.');

    [DOM.grpJoueurs(), DOM.grpStaff()].forEach(function (host) {
      host.querySelectorAll('[data-rm]').forEach(function (b) {
        b.addEventListener('click', function () { onRemove(b.getAttribute('data-rm')); });
      });
    });

    // UN2-7 : bandeau bas — matérialise N2→N3 + N2-6
    DOM.banner().textContent =
      'La feuille de match piochera les ' + joueurs.length +
      ' joueur' + (joueurs.length > 1 ? 's' : '') + ' convoqué' + (joueurs.length > 1 ? 's' : '') +
      ' ; le staff (' + staff.length + ') est convoqué, non aligné.';
  }

  function renderAll() {
    renderVivier();
    renderGroupe();
  }

  // ----------------------------------------------------------
  // Actions (anti-double-tap : State.busy ; erreur non bloquante)
  // ----------------------------------------------------------
  async function onAdd(membre) {
    if (State.busy || !membre) return;
    State.busy = true;
    // pt 213 : convoquer_membre gère les 2 origines (collectif direct OU
    // matérialisation d'un encadrant fonction_staff avant l'attache N2).
    const r = await SupabaseHub.convoquerMembre(State.evtEqId, membre);
    State.busy = false;
    if (!r || !r.ok) {
      alert('Ajout impossible : ' + ((r && r.error) || 'erreur inconnue'));
      return;
    }
    // Recharge vivier (un membre matérialisé change d'origine) + groupe.
    await loadVivier();
    await loadGroupe();
    renderAll();
  }

  async function onRemove(equipeEngageeMembreId) {
    if (State.busy || !equipeEngageeMembreId) return;
    State.busy = true;
    const r = await SupabaseHub.removeGroupeMembre(equipeEngageeMembreId);
    State.busy = false;
    if (!r || !r.ok) {
      alert('Retrait impossible : ' + ((r && r.error) || 'erreur inconnue'));
      return;
    }
    await loadGroupe();
    renderAll();
  }

  function bindFiltres() {
    DOM.search().addEventListener('input', function () {
      State.q = this.value || '';
      renderVivier();
    });
    DOM.roleFilter().addEventListener('change', function () {
      State.fRole = this.value || 'tous';
      renderVivier();
    });
    DOM.statutFilter().addEventListener('change', function () {
      State.fStatut = this.value || 'tous';
      renderVivier();
    });
  }

  // ----------------------------------------------------------
  // Boot
  // ----------------------------------------------------------
  async function init() {
    State.evtEqId = getParam('evenement_equipe');
    if (!State.evtEqId) {
      showError('Paramètre « evenement_equipe » manquant dans l’URL. Ouvre cet écran depuis la fiche d’un évènement (section « Équipes & compositions »).');
      return;
    }
    if (!(await loadContext())) return;       // erreur déjà affichée
    renderHeader();
    await Promise.all([ loadVivier(), loadGroupe() ]);
    await loadAilleurs();                     // après groupe (dépend du même évènement)
    bindFiltres();
    renderAll();
  }

  global.GroupeBase = { init: init };

})(typeof window !== 'undefined' ? window : globalThis);
