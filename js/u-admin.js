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
 * Version : 1.1 — Production · Écran de gestion du staff (collectif N1).
 *   v1.1 : ACTIVATION du bloc Staff, resté bridé en v1.0 faute de
 *          source staff structurée. La source est désormais résolue :
 *          pioche staff = SupabaseHub.listStaffDisponibles() (v1.34,
 *          RPC SECURITY DEFINER sql/56, personnes RLS-verrouillée).
 *          Le bloc Staff devient le MIROIR exact du bloc Joueurs :
 *          déroulante (option A) + bouton Enrôler ; enrôlement =
 *          addCollectifMembre(role:'staff') [DÉJÀ dispo v1.24, rien
 *          de neuf côté écriture] ; sortie = date_fin datée jamais
 *          DELETE (updateCollectifMembre, UA-4 inchangé) ; exclusion
 *          des staff déjà actifs (date_fin NULL) comme pour les joueurs.
 *          onAddStaff() n'est plus un alert() honnête mais l'action
 *          réelle calquée sur onAddJoueur(). La pioche staff n'est PAS
 *          filtrée par entente (sonde 3a : aucune table d'affectation
 *          staff par catégorie ; Q1 acté = un staff peut encadrer
 *          plusieurs catégories, rattachement = geste explicite admin).
 *          Doublons attendus (BELKIS/HELM/VOEGELI 2 fiches) : relèvent
 *          d'IDENT-SYS, non résolus ici. Reste INCHANGÉ de v1.0 : tout
 *          le bloc Joueurs, le sélecteur entente, la bascule de saison
 *          (toujours bloc informatif NON câblé, décision ouverte).
 *          Zéro localStorage. Dégradation honnête sur chaque erreur.
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
    entGrid:      () => document.getElementById('ua-ent-grid'),
    ententeMeta:  () => document.getElementById('ua-entente-meta'),
    error:        () => document.getElementById('ua-error'),
    panel:        () => document.getElementById('ua-panel'),
    joueursList:  () => document.getElementById('ua-joueurs'),
    cntJoueurs:   () => document.getElementById('ua-cnt-joueurs'),
    piocheSel:    () => document.getElementById('ua-pioche'),
    addJoueurBtn: () => document.getElementById('ua-add-joueur')
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
  function ententeLib(e) {
    const cat = (e.categories && e.categories.code) ? e.categories.code : '';
    const sai = (e.saisons && e.saisons.code) ? e.saisons.code : '';
    const txt = [cat, sai].filter(Boolean).join(' · ');
    return txt || e.libelle_moyen || e.libelle_court || e.code || e.id;
  }

  async function loadEntentes() {
    State.ententes = await SupabaseHub.listEntentes() || [];
    const host = DOM.entGrid();
    if (State.ententes.length === 0) {
      host.innerHTML = '<div class="ua-empty">(aucune entente)</div>';
      showError('Aucune entente trouvée. La création d’entente se fait hors de cet écran (chantier d’administration transverse).');
      return;
    }
    host.className = 'ua-ent-grid';
    host.innerHTML = State.ententes.map(function (e) {
      const lib = ententeLib(e);
      return '<button type="button" class="ua-ent" data-ent="' + escapeHtml(e.id) + '">' +
        '<div class="ua-ent__head"><span class="ua-ent__name">' + escapeHtml(lib) + '</span></div>' +
        '<div class="ua-ent__foot">Voir le collectif &rarr;</div>' +
      '</button>';
    }).join('');
    host.querySelectorAll('.ua-ent').forEach(function (btn) {
      btn.addEventListener('click', function () { onSelectEntente(btn.getAttribute('data-ent'), btn); });
    });
  }

  async function loadMembres() {
    State.membres = await SupabaseHub.listCollectifMembres(State.ententeId, { role: 'joueur' }) || [];
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
    DOM.cntJoueurs().textContent = String(joueurs.length);

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

    DOM.joueursList().querySelectorAll('[data-out]').forEach(function (b) {
      b.addEventListener('click', function () { onMarkOut(b.getAttribute('data-out')); });
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
  async function onSelectEntente(ententeId, btn) {
    State.ententeId = ententeId || null;
    clearError();
    DOM.entGrid().querySelectorAll('.ua-ent').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
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

    // La sélection d'entente se fait par clic sur une vignette (câblé dans loadEntentes).
    DOM.addJoueurBtn().addEventListener('click', onAddJoueur);

    DOM.panel().style.display = 'none';   // tant qu'aucune entente choisie
  }

  global.UAdmin = { init: init };

})(typeof window !== 'undefined' ? window : globalThis);
