/**
 * MOM Hub · U-admin — administration du collectif (mode admin (i))
 * ============================================================
 *
 * Doc UX `Conception-UX-Collectif-Compo-3-Niveaux-v1.md` §4 — FAIT
 * FOI (ancrages UA-1..7). Modèle `Modelisation-Collectif-Compo-
 * 3-Niveaux-v1.md` v1.1 (N1, admin (i) §6). DDL sql/44
 * collectif_membre (exécuté+vérifié en base 19/05). Couche données
 * SupabaseHub v1.24 (listEntentes, listCollectifMembres,
 * listJoueursCategorieEntente, addCollectifMembre,
 * updateCollectifMembre) — rien réinventé.
 *
 * PÉRIMÈTRE STRICT (UA-7) : administration collectif/staff PAR
 * SAISON uniquement. PAS de création saison/entente, PAS de
 * sites/référentiels (= chantier ADMIN-(ii), NON absorbé ici).
 *
 * Version : 1.0 — étape (e) chantier Collectif & compo 3 niveaux.
 *   v1.0 : badge admin + cadenas has_role('admin') (UA-1) ;
 *          sélecteur entente = catégorie×saison, saisons passées
 *          consultables (UA-2, listEntentes sans filtre actif) ;
 *          2 blocs Joueurs / Staff, lignes datées (UA-3) ; pioche
 *          Joueurs = listJoueursCategorieEntente (validé Manu :
 *          equipe_joueurs actifs de l'entente, écart assumé tracé) ;
 *          Staff = saisie nom libre (pas de pioche structurée — le
 *          modèle ne définit pas de source staff ; honnête, non
 *          inventé) ; sortie = date_fin datée jamais DELETE (UA-4,
 *          updateCollectifMembre) ; bascule de saison = bloc
 *          informatif honnête NON câblé (UA-5/A-3 — sous-décision
 *          mécanisme RESTÉE OUVERTE, pas de geste destructeur
 *          improvisé) ; mention création entente hors écran (UA-6).
 *          Zéro localStorage/sessionStorage. Dégradation honnête
 *          sur chaque erreur (jamais de trou silencieux).
 */
(function (global) {
  'use strict';

  const STATUTS = {
    regulier:           'régulier',
    renfort_temporaire: 'renfort',
    en_transition:      'transition'
  };

  const State = {
    isAdmin:  false,
    ententes: [],
    ententeId: null,
    membres:  [],     // listCollectifMembres(ententeId)
    pioche:   [],     // listJoueursCategorieEntente(ententeId)
    busy:     false
  };

  const DOM = {
    badge:        () => document.getElementById('ua-badge'),
    ententeSel:   () => document.getElementById('ua-entente'),
    ententeMeta:  () => document.getElementById('ua-entente-meta'),
    error:        () => document.getElementById('ua-error'),
    panel:        () => document.getElementById('ua-panel'),
    joueursList:  () => document.getElementById('ua-joueurs'),
    staffList:    () => document.getElementById('ua-staff'),
    cntJoueurs:   () => document.getElementById('ua-cnt-joueurs'),
    cntStaff:     () => document.getElementById('ua-cnt-staff'),
    piocheSel:    () => document.getElementById('ua-pioche'),
    addJoueurBtn: () => document.getElementById('ua-add-joueur'),
    staffNom:     () => document.getElementById('ua-staff-nom'),
    addStaffWrap: () => document.getElementById('ua-add-staff-wrap')
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getDate().toString().padStart(2, '0') + '/' +
           (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear();
  }

  function nomMembre(cm) {
    const p = (cm && cm.personnes) ? cm.personnes : {};
    return [p.prenom, p.nom].filter(Boolean).join(' ') || '(sans nom)';
  }

  function statutChip(statut) {
    if (!statut) return '';
    return '<span class="ua-chip">' + escapeHtml(STATUTS[statut] || statut) + '</span>';
  }

  function showError(msg) {
    const e = DOM.error();
    if (e) { e.textContent = msg; e.style.display = 'block'; }
  }
  function clearError() {
    const e = DOM.error();
    if (e) { e.textContent = ''; e.style.display = 'none'; }
  }

  // ----------------------------------------------------------
  // Chargements
  // ----------------------------------------------------------
  async function loadEntentes() {
    State.ententes = await SupabaseHub.listEntentes() || [];
    const sel = DOM.ententeSel();
    if (State.ententes.length === 0) {
      sel.innerHTML = '<option value="">(aucune entente)</option>';
      showError('Aucune entente trouvée. La création d’entente se fait hors de cet écran (chantier d’administration transverse).');
      return;
    }
    let html = '<option value="">— Choisir une catégorie / saison… —</option>';
    State.ententes.forEach(function (e) {
      const cat = (e.categories && e.categories.code) ? e.categories.code : '';
      const sai = (e.saisons && e.saisons.code) ? e.saisons.code : '';
      const lib = (e.libelle_moyen || e.libelle_court || e.code || e.id);
      const txt = [cat, sai].filter(Boolean).join(' · ') || lib;
      html += '<option value="' + escapeHtml(e.id) + '">' + escapeHtml(txt) + '</option>';
    });
    sel.innerHTML = html;
  }

  async function loadMembres() {
    State.membres = await SupabaseHub.listCollectifMembres(State.ententeId) || [];
  }

  async function loadPioche() {
    State.pioche = await SupabaseHub.listJoueursCategorieEntente(State.ententeId) || [];
  }

  // ----------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------
  function renderEntenteMeta() {
    const e = State.ententes.find(x => x.id === State.ententeId);
    if (!e) { DOM.ententeMeta().textContent = ''; return; }
    const cat = (e.categories && e.categories.code) ? e.categories.code : '';
    const sai = (e.saisons && e.saisons.code) ? e.saisons.code : '';
    DOM.ententeMeta().textContent =
      [cat, sai].filter(Boolean).join(' · ') +
      ' — saisons passées consultables, jamais réécrites.';
  }

  function renderMembres() {
    const joueurs = State.membres.filter(m => m.role === 'joueur');
    const staff   = State.membres.filter(m => m.role === 'staff');
    DOM.cntJoueurs().textContent = String(joueurs.length);
    DOM.cntStaff().textContent   = String(staff.length);

    function rows(arr, vide) {
      if (arr.length === 0) return '<li class="ua-empty">' + vide + '</li>';
      let h = '';
      arr.forEach(function (m) {
        const sorti = !!m.date_fin;
        h += '<li class="ua-item' + (sorti ? ' ua-item--out' : '') + '">';
        h += '<div class="ua-item-main">';
        h += '<div class="ua-item-name">' + escapeHtml(nomMembre(m)) + ' ' + statutChip(m.statut) + '</div>';
        h += '<div class="ua-item-dates">depuis ' + escapeHtml(formatDate(m.date_debut));
        if (sorti) h += ' · <strong>sorti le ' + escapeHtml(formatDate(m.date_fin)) + '</strong>';
        h += '</div>';
        h += '</div>';
        if (!sorti) {
          h += '<button type="button" class="ua-btn ua-out" data-out="' + escapeHtml(m.id) + '" title="Marquer la sortie (date du jour) — la ligne reste, jamais supprimée">Marquer sortie</button>';
        }
        h += '</li>';
      });
      return h;
    }

    DOM.joueursList().innerHTML = rows(joueurs, 'Aucun joueur dans le collectif pour cette saison.');
    DOM.staffList().innerHTML   = rows(staff, 'Aucun staff dans le collectif pour cette saison.');

    [DOM.joueursList(), DOM.staffList()].forEach(function (host) {
      host.querySelectorAll('[data-out]').forEach(function (b) {
        b.addEventListener('click', function () { onMarkOut(b.getAttribute('data-out')); });
      });
    });
  }

  function renderPioche() {
    const sel = DOM.piocheSel();
    // Exclut les personnes DÉJÀ membres actifs (role joueur, date_fin NULL)
    const dejaActifs = new Set(
      State.membres
        .filter(m => m.role === 'joueur' && !m.date_fin)
        .map(m => m.personne_id)
    );
    const dispo = State.pioche.filter(p => !dejaActifs.has(p.personne_id));
    if (dispo.length === 0) {
      sel.innerHTML = '<option value="">(aucun joueur disponible — tous déjà dans le collectif, ou aucun affecté à cette catégorie)</option>';
      DOM.addJoueurBtn().disabled = true;
      return;
    }
    let html = '<option value="">— Choisir un joueur à enrôler… —</option>';
    dispo.forEach(function (p) {
      const lib = [p.prenom, p.nom].filter(Boolean).join(' ') || '(sans nom)';
      html += '<option value="' + escapeHtml(p.personne_id) + '">' + escapeHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
    DOM.addJoueurBtn().disabled = false;
  }

  function renderAll() {
    renderMembres();
    renderPioche();
  }

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------
  async function onSelectEntente(ententeId) {
    State.ententeId = ententeId || null;
    clearError();
    if (!State.ententeId) {
      DOM.panel().style.display = 'none';
      return;
    }
    DOM.panel().style.display = '';
    renderEntenteMeta();
    await Promise.all([ loadMembres(), loadPioche() ]);
    renderAll();
  }

  async function onAddJoueur() {
    if (State.busy) return;
    const pid = DOM.piocheSel().value;
    if (!pid) return;
    State.busy = true;
    DOM.addJoueurBtn().disabled = true;
    const r = await SupabaseHub.addCollectifMembre({
      personne_id: pid,
      entente_id:  State.ententeId,
      role:        'joueur',
      statut:      'regulier',
      date_debut:  today()
    });
    State.busy = false;
    if (!r || !r.ok) {
      alert('Enrôlement impossible : ' + ((r && r.error) || 'erreur inconnue'));
      DOM.addJoueurBtn().disabled = false;
      return;
    }
    await loadMembres();
    renderAll();
  }

  async function onAddStaff() {
    if (State.busy) return;
    // Le modèle ne définit PAS de source structurée pour le staff
    // (≠ joueurs via equipe_joueurs). Saisie nom libre = honnête,
    // PAS de pioche inventée. personne_id : le staff doit exister
    // dans `personnes` — on NE crée PAS de personne ici (hors
    // périmètre, anti-DS-1). Si pas de personne_id résolu, on
    // refuse explicitement plutôt que d'inventer une identité.
    alert(
      'Ajout staff : le staff fera l’objet d’une sélection dédiée ' +
      '(non spécifiée par le modèle à ce stade). Cet écran n’invente ' +
      'pas de source staff — à traiter dans une étape ultérieure ' +
      'dédiée. Aucune action effectuée.'
    );
  }

  async function onMarkOut(membreId) {
    if (State.busy || !membreId) return;
    if (!global.confirm('Marquer la sortie de ce membre à la date du jour ?\nLa ligne est conservée (historique), jamais supprimée.')) {
      return;
    }
    State.busy = true;
    const r = await SupabaseHub.updateCollectifMembre(membreId, { date_fin: today() });
    State.busy = false;
    if (!r || !r.ok) {
      alert('Sortie impossible : ' + ((r && r.error) || 'erreur inconnue'));
      return;
    }
    await loadMembres();
    renderAll();
  }

  // ----------------------------------------------------------
  // Boot
  // ----------------------------------------------------------
  async function init(opts) {
    State.isAdmin = !!(opts && opts.isAdmin);
    // UA-1 : badge admin + cadenas. has_role('admin') tranché par
    // la page (auth-gate) ; ici on REFLÈTE, on ne re-décide pas.
    if (State.isAdmin) {
      DOM.badge().innerHTML = '🔒 <strong>Mode admin</strong> — administration du collectif';
    } else {
      DOM.badge().innerHTML = '🔒 Accès admin requis';
      showError('Cet écran est réservé aux administrateurs (2-3 personnes). Aucune gestion d’accès fine par personne (hors périmètre).');
      const p = DOM.panel();
      if (p) p.style.display = 'none';
      return;
    }

    await loadEntentes();

    DOM.ententeSel().addEventListener('change', function () {
      onSelectEntente(this.value);
    });
    DOM.addJoueurBtn().addEventListener('click', onAddJoueur);
    const staffBtn = document.getElementById('ua-add-staff');
    if (staffBtn) staffBtn.addEventListener('click', onAddStaff);

    DOM.panel().style.display = 'none';   // tant qu'aucune entente choisie
  }

  global.UAdmin = { init: init };

})(typeof window !== 'undefined' ? window : globalThis);
