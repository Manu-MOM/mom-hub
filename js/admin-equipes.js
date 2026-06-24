/**
 * MOM Hub · Administration des équipes (ADMIN-(ii) sous-chantier 1)
 * ================================================================
 *
 * Contrôleur de admin-equipes.html. Doc FAIT FOI
 * Conception-UX-ADMIN-ii-v1.md (md5 ca043a48) §3.1 (équipes) + §3.3
 * (ententes intégrées). Données via SupabaseHub v1.31 (wrappers
 * ADMIN-(ii) : getPolesAvecCategories, getEntenteCadre, listSaisons,
 * listEquipesByEntentes, createEquipe/updateEquipe/setEquipeStatut,
 * createEntente/updateEntente) + réutilisation de listEntentes,
 * listSitesActifs, getClubs.
 *
 * Principes (doctrine P1 simplicité) :
 *  - On entre TOUJOURS par une catégorie (D2bis « pas de mélange »).
 *  - Bandeau saison (D4) : active par défaut ; passées = lecture
 *    seule (passé immuable) ; futures = éditables (préparation). Le
 *    classement se dérive de date_debut/date_fin + est_active, le
 *    modèle réel n'ayant pas de colonne `statut` (JSON divergent).
 *  - Garde UI admin-strict (D2) — la page elle-même refuse déjà les
 *    non-admins (cf. admin-equipes.html). La RLS base est admin|coach
 *    sur equipes (filet permissif dormant, supabase-client v1.31).
 *
 * Version : 1.2 — 24/06/2026 (ADMIN-RESPONSABLE-POLE, pt 106).
 *   v1.0 : écran (1) Équipes (grille pôle→catégorie, modales équipe + entente).
 *   v1.2 : désignation des responsables de pôle. Sous chaque en-tête de
 *          pôle (ae-pole__head), une ligne « Responsable / Co-responsable »
 *          (selects peuplés par listStaffDisponibles, valeurs initiales
 *          lues dans State.poles[i].responsable_principal_id /
 *          co_responsable_id — déjà présentes via getPolesAvecCategories
 *          select('*')). Enregistrement -> Hub.definirResponsablesPole
 *          (RPC sql_107, garde admin). Co-responsable optionnel ; même
 *          personne autorisée sur plusieurs pôles (permissif, validé Manu).
 *          Dégradation honnête : responsable hors pioche staff résolu via
 *          _resolveNoms (jamais d'UUID nu). Additif (node --check OK).
 *   v1.1 : correctif recette terrain — (a) l'édition de cadre charge le cadre
 *          COMPLET via getEntenteCadre (la grille listEntentes ne projette pas
 *          régime/club/partenaires/convention → modale vide sinon) ; (b) badge
 *          carte « cadre » honnête (plus de « — » trompeur, le régime s'affiche
 *          dans la modale). type_equipe 'entente'/'mono' VALIDÉ terrain
 *          (base = 'entente'), code auto sans collision — aucun réalignement.
 */
(function (global) {
  'use strict';

  const Hub = global.SupabaseHub;
  const $ = function (id) { return document.getElementById(id); };
  const todayISO = function () { return new Date().toISOString().slice(0, 10); };

  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Slug majuscule sans accents — sert au code auto d'équipe.
  function slugUp(s) {
    return (s == null ? '' : String(s))
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
  }

  const State = {
    isAdmin: false,
    saisons: [],
    selectedSaisonId: null,
    poles: [],
    sites: [],
    clubs: [],
    clubsById: new Map(),
    // données de la saison sélectionnée
    ententesByCat: new Map(),    // categorie_id -> entente
    equipesByEntente: new Map(), // entente_id -> [equipes]
    championnats: [],            // suggestions datalist (distinct)
    // contextes de modale
    eqCtx: null,                 // { mode, cat, saison, entente, equipe? }
    entCtx: null,                // { mode, cat, saison, entente?, partenaires:[] }
    // ADMIN-RESPONSABLE-POLE (v1.2) — pioche staff pour désigner les
    // responsables de pôle. listStaffDisponibles() (sans catégorie) =
    // tout le staff du club {personne_id, nom, prenom}.
    staffPourSelect: [],
    staffById: new Map(),
    // Noms résolus en complément (cas d'un responsable déjà désigné mais
    // absent de la pioche staff -> on n'affiche jamais un UUID nu).
    nomsResponsables: new Map()  // personne_id -> "Prénom Nom"
  };

  // ----------------------------------------------------------------
  // SAISONS (bandeau D4)
  // ----------------------------------------------------------------
  function saisonLabel(s) { return s.libelle || s.code || s.id; }

  // active → éditable (saison courante) ; future (date_debut > today)
  // → éditable (préparation) ; sinon (passée / inclassable) → lecture
  // seule. Couvre l'edge « ni active ni future » par défaut prudent.
  function saisonEditable(s) {
    if (!s) return false;
    if (s.est_active) return true;
    if (s.date_debut && s.date_debut > todayISO()) return true;
    return false;
  }
  function saisonStatutLabel(s) {
    if (!s) return '';
    if (s.est_active) return 'active';
    if (s.date_debut && s.date_debut > todayISO()) return 'à venir';
    return 'passée';
  }
  function getSelectedSaison() {
    return State.saisons.find(function (s) { return s.id === State.selectedSaisonId; }) || null;
  }

  function renderSaisonSelect() {
    const sel = $('ae-saison');
    if (!State.saisons.length) {
      sel.innerHTML = '<option value="">Aucune saison</option>';
      return;
    }
    sel.innerHTML = State.saisons.map(function (s) {
      const tag = s.est_active ? ' ✦' : '';
      return '<option value="' + esc(s.id) + '">' + esc(saisonLabel(s)) + tag + '</option>';
    }).join('');
    sel.value = State.selectedSaisonId || '';
  }

  function renderSaisonMeta() {
    const s = getSelectedSaison();
    const pill = $('ae-season-pill');
    const meta = $('ae-saison-meta');
    if (!s) { pill.textContent = 'SAISON —'; meta.textContent = ''; return; }
    pill.textContent = 'SAISON ' + (s.code || saisonLabel(s)).toUpperCase();
    if (saisonEditable(s)) {
      meta.innerHTML = 'Saison <strong>' + esc(saisonStatutLabel(s)) + '</strong> — édition autorisée.';
    } else {
      meta.innerHTML = 'Saison <span class="ae-ro">' + esc(saisonStatutLabel(s)) +
        ' — lecture seule</span> (passé immuable).';
    }
  }

  // ----------------------------------------------------------------
  // CHARGEMENT DES DONNÉES DE LA SAISON
  // ----------------------------------------------------------------
  async function loadSaisonData() {
    State.ententesByCat = new Map();
    State.equipesByEntente = new Map();
    State.championnats = [];
    if (!State.selectedSaisonId) return;

    const entR = await Hub.listEntentes({ saisonId: State.selectedSaisonId });
    const ententes = Array.isArray(entR) ? entR : [];
    ententes.forEach(function (e) { if (e.categorie_id) State.ententesByCat.set(e.categorie_id, e); });

    const ids = ententes.map(function (e) { return e.id; }).filter(Boolean);
    const eqR = await Hub.listEquipesByEntentes(ids);
    const equipes = (eqR && eqR.ok && Array.isArray(eqR.data)) ? eqR.data : [];

    const champ = new Set();
    equipes.forEach(function (eq) {
      if (!State.equipesByEntente.has(eq.entente_id)) State.equipesByEntente.set(eq.entente_id, []);
      State.equipesByEntente.get(eq.entente_id).push(eq);
      if (eq.championnat_nom) champ.add(eq.championnat_nom);
    });
    State.championnats = Array.from(champ).sort();
  }

  // ----------------------------------------------------------------
  // RENDU GRILLE pôles → catégories
  // ----------------------------------------------------------------
  function equipesOfCat(cat) {
    const ent = State.ententesByCat.get(cat.id);
    if (!ent) return [];
    return State.equipesByEntente.get(ent.id) || [];
  }

  function renderEquipeItem(eq) {
    const inactive = eq.statut && eq.statut !== 'active';
    const meta = [];
    if (eq.format_jeu_code) meta.push(esc(eq.format_jeu_code));
    if (eq.championnat_nom) meta.push(esc(eq.championnat_nom));
    if (inactive) meta.push('désactivée');
    return '<li class="ae-eq-item' + (inactive ? ' ae-eq-item--inactive' : '') +
      '" data-action="open-equipe-edit" data-equipe="' + esc(eq.id) + '" data-cat="' + esc(eq.entente_id) + '">' +
      '<span class="ae-eq-num">' + esc(eq.numero_equipe != null ? eq.numero_equipe : '–') + '</span>' +
      '<span class="ae-eq-main"><span class="ae-eq-nom">' + esc(eq.nom_officiel || eq.code || '(sans nom)') + '</span>' +
      (meta.length ? '<span class="ae-eq-meta">' + meta.join(' · ') + '</span>' : '') +
      '</span></li>';
  }

  function renderCatCard(cat, editable) {
    const ent = State.ententesByCat.get(cat.id);
    const equipes = equipesOfCat(cat);

    // ligne cadre (entente) — §3.3
    let cadre;
    if (ent) {
      // listEntentes (grille) ne projette pas regime_actuel → on n'affiche
      // PAS de régime ici (pas de « — » trompeur) ; le régime réel est dans
      // la modale (chargée via getEntenteCadre). Badge = présence du cadre.
      cadre = '<span class="ae-badge-entente">cadre</span>' +
        '<span>' + esc(ent.libelle_court || ent.libelle_moyen || ent.code || 'entente') + '</span>' +
        '<button type="button" class="ae-cat__cadre-link" data-action="open-cadre" data-cat="' + esc(cat.id) +
        '"' + (editable ? '' : ' disabled') + '>Cadre de la catégorie</button>';
    } else {
      cadre = '<span class="ae-badge-entente ae-badge-entente--absent">aucun cadre</span>' +
        '<button type="button" class="ae-cat__cadre-link" data-action="open-cadre" data-cat="' + esc(cat.id) +
        '"' + (editable ? '' : ' disabled') + '>Créer le cadre</button>';
    }

    const list = equipes.length
      ? equipes.map(renderEquipeItem).join('')
      : '<li class="ae-empty">Aucune équipe.</li>';

    // « + Équipe » : besoin d'un cadre (entente) ET d'une saison éditable
    const canAdd = editable && !!ent;
    let addTitle = '';
    if (!editable) addTitle = ' title="Saison en lecture seule"';
    else if (!ent) addTitle = ' title="Créer d’abord le cadre (entente) de la catégorie"';

    return '<div class="ae-cat">' +
      '<div class="ae-cat__head"><span class="ae-cat__name">' + esc(cat.libelle_court || cat.code) + '</span></div>' +
      '<div class="ae-cat__cadre">' + cadre + '</div>' +
      '<div class="ae-cat__body"><ul class="ae-eq-list">' + list + '</ul></div>' +
      '<div class="ae-cat__foot">' +
        '<button type="button" class="ae-btn ae-btn--add" data-action="open-equipe-create" data-cat="' + esc(cat.id) + '"' +
        (canAdd ? '' : ' disabled') + addTitle + '>+ Équipe</button>' +
      '</div>' +
    '</div>';
  }

  // ----------------------------------------------------------------
  // RESPONSABLES DE PÔLE (ADMIN-RESPONSABLE-POLE, v1.2)
  // ----------------------------------------------------------------
  // Désignation responsable principal (+ co-responsable optionnel) d'un
  // pôle, écrite via Hub.definirResponsablesPole (RPC sql_107, garde admin).
  // Lecture : responsable_principal_id / co_responsable_id sont DÉJÀ sur
  // State.poles[i] (getPolesAvecCategories fait select('*')). Pioche =
  // tout le staff du club (listStaffDisponibles sans catégorie).

  // Libellé d'affichage d'une personne (pioche staff, sinon noms résolus).
  function nomPersonne(personneId) {
    if (!personneId) return '';
    const st = State.staffById.get(personneId);
    if (st) return ((st.prenom || '') + ' ' + (st.nom || '')).trim() || personneId;
    const resolu = State.nomsResponsables.get(personneId);
    return resolu || personneId; // dégradation honnête : jamais d'UUID muet sans repli
  }

  // <option> de la pioche staff (+ option vide). `selected` = uuid courant.
  // Si l'uuid courant n'est pas dans la pioche, on l'ajoute en tête pour
  // ne pas le perdre silencieusement (responsable hors staff).
  function optionsStaff(selected, avecVide) {
    let html = avecVide ? '<option value="">— Aucun —</option>' : '';
    const dansListe = State.staffPourSelect.some(function (p) { return p.personne_id === selected; });
    if (selected && !dansListe) {
      html += '<option value="' + esc(selected) + '" selected>' + esc(nomPersonne(selected)) + ' (hors staff)</option>';
    }
    html += State.staffPourSelect.map(function (p) {
      const lbl = ((p.prenom || '') + ' ' + (p.nom || '')).trim() || p.personne_id;
      const sel = (p.personne_id === selected) ? ' selected' : '';
      return '<option value="' + esc(p.personne_id) + '"' + sel + '>' + esc(lbl) + '</option>';
    }).join('');
    return html;
  }

  // Bloc « Responsable / Co-responsable » sous l'en-tête d'un pôle.
  // editable = saison éditable (mêmes règles que la grille). Hors édition,
  // on affiche les responsables en lecture seule (pas de selects).
  function renderResponsablesPole(p, editable) {
    const principal = p.responsable_principal_id || '';
    const co = p.co_responsable_id || '';
    if (!editable) {
      const pTxt = principal ? esc(nomPersonne(principal)) : '<span class="ae-ro">non désigné</span>';
      const cTxt = co ? ' · Co-responsable : ' + esc(nomPersonne(co)) : '';
      return '<div class="ae-pole__resp ae-pole__resp--ro">' +
        'Responsable : ' + pTxt + cTxt +
      '</div>';
    }
    return '<div class="ae-pole__resp" data-pole="' + esc(p.id) + '">' +
      '<label class="ae-pole__resp-field">Responsable&nbsp;: ' +
        '<select class="ae-pole-resp-principal" data-pole="' + esc(p.id) + '">' +
          optionsStaff(principal, true) +
        '</select>' +
      '</label>' +
      '<label class="ae-pole__resp-field">Co-responsable&nbsp;: ' +
        '<select class="ae-pole-resp-co" data-pole="' + esc(p.id) + '">' +
          optionsStaff(co, true) +
        '</select>' +
      '</label>' +
      '<button type="button" class="ae-btn ae-btn--save-resp" data-action="save-responsables" data-pole="' + esc(p.id) + '">Enregistrer</button>' +
      '<span class="ae-pole__resp-msg" data-pole-msg="' + esc(p.id) + '"></span>' +
    '</div>';
  }

  // Résout les noms des responsables actuellement désignés mais absents de
  // la pioche staff (via Hub._resolveNoms), pour un affichage propre.
  async function resoudreNomsResponsables() {
    const manquants = [];
    State.poles.forEach(function (p) {
      [p.responsable_principal_id, p.co_responsable_id].forEach(function (id) {
        if (id && !State.staffById.has(id) && !State.nomsResponsables.has(id)
            && manquants.indexOf(id) === -1) {
          manquants.push(id);
        }
      });
    });
    if (!manquants.length) return;
    try {
      const map = await Hub._resolveNoms(manquants);
      if (map && typeof map.forEach === 'function') {
        map.forEach(function (v, k) {
          const lbl = ((v.prenom || '') + ' ' + (v.nom || '')).trim();
          if (lbl) State.nomsResponsables.set(k, lbl);
        });
      }
    } catch (e) {
      console.error('AdminEquipes.resoudreNomsResponsables()', e);
      // honnête : sans résolution, optionsStaff retombe sur l'UUID + « hors staff »
    }
  }

  // Sauvegarde la désignation d'un pôle (lecture des 2 selects -> RPC).
  async function saveResponsables(poleId) {
    const wrap = document.querySelector('.ae-pole__resp[data-pole="' + poleId + '"]');
    if (!wrap) return;
    const selP = wrap.querySelector('.ae-pole-resp-principal');
    const selC = wrap.querySelector('.ae-pole-resp-co');
    const msg = wrap.querySelector('[data-pole-msg]');
    const principalId = selP ? (selP.value || null) : null;
    const coId = selC ? (selC.value || null) : null;

    if (!principalId) {
      if (msg) { msg.textContent = 'Choisir un responsable principal.'; msg.className = 'ae-pole__resp-msg ae-pole__resp-msg--err'; }
      return;
    }
    if (msg) { msg.textContent = 'Enregistrement…'; msg.className = 'ae-pole__resp-msg'; }

    const res = await Hub.definirResponsablesPole(poleId, principalId, coId);
    if (!res || !res.ok) {
      if (msg) { msg.textContent = 'Échec : ' + ((res && res.error) || 'erreur inconnue'); msg.className = 'ae-pole__resp-msg ae-pole__resp-msg--err'; }
      return;
    }
    // Maj locale de State.poles (évite un rechargement complet).
    const p = State.poles.find(function (x) { return x.id === poleId; });
    if (p) {
      p.responsable_principal_id = principalId;
      p.co_responsable_id = coId;
    }
    await resoudreNomsResponsables();
    if (msg) { msg.textContent = '✓ Enregistré.'; msg.className = 'ae-pole__resp-msg ae-pole__resp-msg--ok'; }
  }

  function renderGrid() {
    const s = getSelectedSaison();
    const editable = saisonEditable(s);
    const host = $('ae-poles');
    if (!State.poles.length) {
      host.innerHTML = '<p class="ae-empty">Aucun pôle.</p>';
      host.style.display = 'block';
      return;
    }
    host.innerHTML = State.poles.map(function (p) {
      const cats = Array.isArray(p.categories) ? p.categories : [];
      const cards = cats.length
        ? cats.map(function (c) { return renderCatCard(c, editable); }).join('')
        : '<p class="ae-empty">Aucune catégorie active.</p>';
      return '<section class="ae-pole">' +
        '<div class="ae-pole__head"><span class="ae-pole__title">' + esc(p.libelle_court || p.libelle_long || p.code) + '</span>' +
        '<span class="ae-pole__sub">' + cats.length + ' catégorie' + (cats.length > 1 ? 's' : '') + '</span></div>' +
        renderResponsablesPole(p, editable) +
        '<div class="ae-cat-grid">' + cards + '</div>' +
      '</section>';
    }).join('');
    host.style.display = 'block';
  }

  // catégorie par id (à plat sur tous les pôles)
  function findCat(catId) {
    for (let i = 0; i < State.poles.length; i++) {
      const cats = State.poles[i].categories || [];
      for (let j = 0; j < cats.length; j++) if (cats[j].id === catId) return cats[j];
    }
    return null;
  }

  // ----------------------------------------------------------------
  // MODALE ÉQUIPE (§3.1 D5)
  // ----------------------------------------------------------------
  function openModal(id) { $(id).classList.add('is-open'); }
  function closeModal(id) { $(id).classList.remove('is-open'); }

  function fillFormatOptions(cat, selected) {
    const sel = $('ae-eq-format');
    const formats = (cat && Array.isArray(cat.formats_autorises)) ? cat.formats_autorises : [];
    sel.innerHTML = '<option value="">— Format… —</option>' +
      formats.map(function (f) {
        return '<option value="' + esc(f) + '"' + (f === selected ? ' selected' : '') + '>' + esc(f) + '</option>';
      }).join('');
  }
  function fillSiteOptions(selected) {
    const sel = $('ae-eq-site');
    sel.innerHTML = '<option value="">— Aucun (accepté en v1) —</option>' +
      State.sites.map(function (st) {
        const lbl = st.libelle_court || st.libelle || st.code;
        return '<option value="' + esc(st.id) + '"' + (st.id === selected ? ' selected' : '') + '>' + esc(lbl) + '</option>';
      }).join('');
  }
  function fillChampionnatList() {
    $('ae-eq-championnat-list').innerHTML = State.championnats.map(function (c) {
      return '<option value="' + esc(c) + '"></option>';
    }).join('');
  }

  function nextNumero(ent) {
    const eqs = ent ? (State.equipesByEntente.get(ent.id) || []) : [];
    let max = 0;
    eqs.forEach(function (e) { if (typeof e.numero_equipe === 'number' && e.numero_equipe > max) max = e.numero_equipe; });
    return max + 1;
  }
  // Code interne auto (equipes.code NOT NULL). Patron provisoire tracé
  // (décision déléguée pt 17) : <code entente|code cat>-E<numero>.
  function genEquipeCode(ent, cat, numero) {
    const base = slugUp(ent && ent.code) || slugUp(cat && cat.code) || 'EQ';
    return base + '-E' + numero;
  }

  function setEqError(msg) {
    const el = $('ae-eq-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg; el.style.display = 'block';
  }

  function openEquipeCreate(catId) {
    const cat = findCat(catId);
    const saison = getSelectedSaison();
    const ent = State.ententesByCat.get(catId);
    if (!cat || !saison || !ent) return;
    State.eqCtx = { mode: 'create', cat: cat, saison: saison, entente: ent, equipe: null };

    setEqError('');
    $('ae-eq-modal-title').textContent = 'Nouvelle équipe — ' + (cat.libelle_court || cat.code);
    $('ae-eq-ctx-categorie').textContent = cat.libelle_court || cat.code;
    $('ae-eq-ctx-saison').textContent = saisonLabel(saison);
    $('ae-eq-ctx-entente').textContent = ent.libelle_court || ent.libelle_moyen || ent.code || '—';

    const numero = nextNumero(ent);
    const base = ent.libelle_court || ent.libelle_moyen || cat.libelle_court || cat.code || '';
    $('ae-eq-nom').value = numero > 1 ? (base + ' ' + numero) : base;
    $('ae-eq-numero').value = numero;
    fillFormatOptions(cat, '');
    fillChampionnatList();
    $('ae-eq-championnat').value = '';
    // type : défaut dérivé du régime de l'entente (Solo → mono, sinon entente)
    const isSolo = (ent.regime_actuel || '').toLowerCase() === 'solo';
    $('ae-eq-type-mono').checked = isSolo;
    $('ae-eq-type-entente').checked = !isSolo;
    $('ae-eq-mixite-info').textContent = cat.mixite_autorisee
      ? 'Mixité autorisée pour cette catégorie (appliquée automatiquement).'
      : 'Catégorie non mixte (mixité = non, automatique).';
    // compléments réinitialisés
    ['ae-eq-libelle-court', 'ae-eq-libelle-moyen', 'ae-eq-libelle-long', 'ae-eq-alias',
     'ae-eq-effectif-theorique', 'ae-eq-effectif-min', 'ae-eq-code-ffr', 'ae-eq-code-scorenco', 'ae-eq-notes']
      .forEach(function (id) { $(id).value = ''; });
    fillSiteOptions('');
    $('ae-eq-complements').open = false;
    $('ae-eq-statut-toggle').style.display = 'none';

    openModal('ae-modal-equipe');
  }

  function openEquipeEdit(equipeId, ententeId) {
    const eqs = State.equipesByEntente.get(ententeId) || [];
    const eq = eqs.find(function (e) { return e.id === equipeId; });
    const ent = (function () {
      let found = null;
      State.ententesByCat.forEach(function (e) { if (e.id === ententeId) found = e; });
      return found;
    })();
    if (!eq || !ent) return;
    const cat = findCat(ent.categorie_id);
    const saison = getSelectedSaison();
    State.eqCtx = { mode: 'edit', cat: cat, saison: saison, entente: ent, equipe: eq };

    setEqError('');
    $('ae-eq-modal-title').textContent = 'Éditer — ' + (eq.nom_officiel || eq.code || '');
    $('ae-eq-ctx-categorie').textContent = (cat && (cat.libelle_court || cat.code)) || '—';
    $('ae-eq-ctx-saison').textContent = saison ? saisonLabel(saison) : '—';
    $('ae-eq-ctx-entente').textContent = ent.libelle_court || ent.libelle_moyen || ent.code || '—';

    $('ae-eq-nom').value = eq.nom_officiel || '';
    $('ae-eq-numero').value = eq.numero_equipe != null ? eq.numero_equipe : '';
    fillFormatOptions(cat, eq.format_jeu_code || '');
    fillChampionnatList();
    $('ae-eq-championnat').value = eq.championnat_nom || '';
    const typeMono = (eq.type_equipe || '').toLowerCase() === 'mono';
    $('ae-eq-type-mono').checked = typeMono;
    $('ae-eq-type-entente').checked = !typeMono;
    $('ae-eq-mixite-info').textContent = (cat && cat.mixite_autorisee)
      ? 'Mixité autorisée pour cette catégorie (appliquée automatiquement).'
      : 'Catégorie non mixte (mixité = non, automatique).';
    $('ae-eq-libelle-court').value = eq.libelle_court || '';
    $('ae-eq-libelle-moyen').value = eq.libelle_moyen || '';
    $('ae-eq-libelle-long').value = eq.libelle_long || '';
    $('ae-eq-alias').value = Array.isArray(eq.alias) ? eq.alias.join(', ') : '';
    $('ae-eq-effectif-theorique').value = eq.effectif_theorique != null ? eq.effectif_theorique : '';
    $('ae-eq-effectif-min').value = eq.effectif_minimum_operationnel != null ? eq.effectif_minimum_operationnel : '';
    $('ae-eq-code-ffr').value = eq.championnat_code_ffr || '';
    $('ae-eq-code-scorenco').value = eq.championnat_code_scorenco || '';
    $('ae-eq-notes').value = eq.notes || '';
    fillSiteOptions(eq.site_principal_id || '');
    $('ae-eq-complements').open = false;

    const toggle = $('ae-eq-statut-toggle');
    const isActive = (eq.statut || 'active') === 'active';
    toggle.textContent = isActive ? 'Désactiver' : 'Réactiver';
    toggle.style.display = '';

    openModal('ae-modal-equipe');
  }

  function numOrUndef(v) {
    if (v === '' || v == null) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }
  function strOrUndef(v) {
    const t = (v == null ? '' : String(v)).trim();
    return t === '' ? undefined : t;
  }

  function collectEquipePayload() {
    const ctx = State.eqCtx;
    const cat = ctx.cat;
    const aliasRaw = $('ae-eq-alias').value || '';
    const alias = aliasRaw.split(',').map(function (a) { return a.trim(); }).filter(Boolean);
    const typeVal = $('ae-eq-type-mono').checked ? 'mono' : ($('ae-eq-type-entente').checked ? 'entente' : undefined);
    const payload = {
      nom_officiel: strOrUndef($('ae-eq-nom').value),
      numero_equipe: numOrUndef($('ae-eq-numero').value),
      format_jeu_code: strOrUndef($('ae-eq-format').value),
      championnat_nom: strOrUndef($('ae-eq-championnat').value),
      type_equipe: typeVal,
      mixte: !!(cat && cat.mixite_autorisee),  // mixité auto (D5)
      libelle_court: strOrUndef($('ae-eq-libelle-court').value),
      libelle_moyen: strOrUndef($('ae-eq-libelle-moyen').value),
      libelle_long: strOrUndef($('ae-eq-libelle-long').value),
      effectif_theorique: numOrUndef($('ae-eq-effectif-theorique').value),
      effectif_minimum_operationnel: numOrUndef($('ae-eq-effectif-min').value),
      site_principal_id: strOrUndef($('ae-eq-site').value),
      championnat_code_ffr: strOrUndef($('ae-eq-code-ffr').value),
      championnat_code_scorenco: strOrUndef($('ae-eq-code-scorenco').value),
      notes: strOrUndef($('ae-eq-notes').value)
    };
    if (alias.length) payload.alias = alias;
    return payload;
  }

  async function saveEquipe() {
    const ctx = State.eqCtx;
    if (!ctx) return;
    setEqError('');
    const btn = $('ae-eq-save');
    btn.disabled = true;
    try {
      const payload = collectEquipePayload();
      if (!payload.nom_officiel) { setEqError('Le nom officiel est requis.'); return; }
      if (payload.numero_equipe == null) { setEqError('Le numéro d’équipe est requis.'); return; }

      let res;
      if (ctx.mode === 'create') {
        payload.entente_id = ctx.entente.id;
        payload.code = genEquipeCode(ctx.entente, ctx.cat, payload.numero_equipe);
        res = await Hub.createEquipe(payload);
      } else {
        res = await Hub.updateEquipe(ctx.equipe.id, payload);
      }
      if (!res || !res.ok) { setEqError((res && res.error) || 'Échec de l’enregistrement.'); return; }
      closeModal('ae-modal-equipe');
      await refresh();
    } catch (e) {
      console.error('AdminEquipes.saveEquipe()', e);
      setEqError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
    }
  }

  async function toggleStatutEquipe() {
    const ctx = State.eqCtx;
    if (!ctx || ctx.mode !== 'edit' || !ctx.equipe) return;
    const btn = $('ae-eq-statut-toggle');
    btn.disabled = true;
    const wasActive = (ctx.equipe.statut || 'active') === 'active';
    try {
      const res = await Hub.setEquipeStatut(ctx.equipe.id, wasActive ? 'inactive' : 'active');
      if (!res || !res.ok) { setEqError((res && res.error) || 'Échec du changement de statut.'); return; }
      closeModal('ae-modal-equipe');
      await refresh();
    } catch (e) {
      console.error('AdminEquipes.toggleStatutEquipe()', e);
      setEqError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
    }
  }

  // ----------------------------------------------------------------
  // MODALE ENTENTE (§3.3 cadre de la catégorie)
  // ----------------------------------------------------------------
  function setEntError(msg) {
    const el = $('ae-ent-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg; el.style.display = 'block';
  }
  function clubLabel(id) {
    const c = State.clubsById.get(id);
    return c ? (c.nom_court || c.nom_long || c.code) : id;
  }
  function fillClubSelect(sel, selected, excludeIds) {
    const ex = excludeIds || [];
    sel.innerHTML = '<option value="">— Choisir un club… —</option>' +
      State.clubs
        .filter(function (c) { return ex.indexOf(c.id) === -1; })
        .map(function (c) {
          const lbl = c.nom_court || c.nom_long || c.code;
          return '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(lbl) + '</option>';
        }).join('');
  }
  function renderPartenaireChips() {
    if (!State.entCtx) return;
    const host = $('ae-ent-clubs-chips');
    const ids = State.entCtx.partenaires;
    host.innerHTML = ids.length
      ? ids.map(function (id) {
          return '<span class="ae-chip">' + esc(clubLabel(id)) +
            '<button type="button" data-club-remove="' + esc(id) + '" aria-label="Retirer">✕</button></span>';
        }).join('')
      : '<span class="ae-field-hint">Aucun club partenaire.</span>';
    // le sélecteur d'ajout exclut le principal + les partenaires déjà là
    const principal = $('ae-ent-club-principal').value;
    fillClubSelect($('ae-ent-club-add'), '', ids.concat(principal ? [principal] : []));
    $('ae-ent-club-add').firstChild && ($('ae-ent-club-add').selectedIndex = 0);
  }

  async function openCadre(catId) {
    const cat = findCat(catId);
    const saison = getSelectedSaison();
    if (!cat || !saison) return;
    const partial = State.ententesByCat.get(catId);   // depuis la grille (projection réduite listEntentes)
    const hasCadre = !!partial;
    setEntError('');

    // La grille (listEntentes) ne projette PAS régime/club/partenaires/
    // convention. Pour une ÉDITION fidèle on charge le cadre complet via
    // getEntenteCadre (wrapper v1.31 dédié) — sinon la modale s'ouvrirait
    // avec ces champs vides alors que la base les a.
    let ent = partial || null;
    if (hasCadre) {
      const r = await Hub.getEntenteCadre(catId, saison.id);
      if (r && r.ok && r.data) ent = r.data;
      else setEntError('Cadre partiellement chargé — certains champs peuvent manquer.');
    }

    State.entCtx = {
      mode: hasCadre ? 'edit' : 'create',
      cat: cat, saison: saison, entente: hasCadre ? ent : null,
      partenaires: (ent && Array.isArray(ent.clubs_partenaires_ids)) ? ent.clubs_partenaires_ids.slice() : []
    };

    $('ae-ent-modal-title').textContent = hasCadre ? 'Cadre de la catégorie' : 'Créer le cadre — ' + (cat.libelle_court || cat.code);
    $('ae-ent-ctx-categorie').textContent = cat.libelle_court || cat.code;
    $('ae-ent-ctx-saison').textContent = saisonLabel(saison);

    $('ae-ent-code-wrap').style.display = ent ? 'none' : '';
    $('ae-ent-code').value = '';

    // régime
    const regime = ent ? (ent.regime_actuel || '') : '';
    Array.prototype.forEach.call(document.getElementsByName('ae-ent-regime'), function (r) {
      r.checked = (r.value === regime);
    });

    fillClubSelect($('ae-ent-club-principal'), ent ? ent.club_principal_id : '', []);
    $('ae-ent-libelle-court').value = ent ? (ent.libelle_court || '') : '';
    $('ae-ent-libelle-moyen').value = ent ? (ent.libelle_moyen || '') : '';
    $('ae-ent-conv-url').value = ent ? (ent.convention_ffr_url || '') : '';
    $('ae-ent-conv-date-sig').value = ent ? (ent.date_signature_convention || '') : '';
    $('ae-ent-conv-date-fin').value = ent ? (ent.date_fin_validite_convention || '') : '';
    $('ae-ent-sporteasy').value = ent ? (ent.identifiant_sporteasy || '') : '';
    $('ae-ent-notes').value = ent ? (ent.notes || '') : '';
    $('ae-ent-convention').open = false;

    renderPartenaireChips();
    openModal('ae-modal-entente');
  }

  function selectedRegime() {
    let v = '';
    Array.prototype.forEach.call(document.getElementsByName('ae-ent-regime'), function (r) { if (r.checked) v = r.value; });
    return v;
  }

  function collectEntentePayload() {
    return {
      regime_actuel: strOrUndef(selectedRegime()),
      club_principal_id: strOrUndef($('ae-ent-club-principal').value),
      clubs_partenaires_ids: State.entCtx.partenaires.slice(),
      libelle_court: strOrUndef($('ae-ent-libelle-court').value),
      libelle_moyen: strOrUndef($('ae-ent-libelle-moyen').value),
      convention_ffr_url: strOrUndef($('ae-ent-conv-url').value),
      date_signature_convention: strOrUndef($('ae-ent-conv-date-sig').value),
      date_fin_validite_convention: strOrUndef($('ae-ent-conv-date-fin').value),
      identifiant_sporteasy: strOrUndef($('ae-ent-sporteasy').value),
      notes: strOrUndef($('ae-ent-notes').value)
    };
  }

  async function saveEntente() {
    const ctx = State.entCtx;
    if (!ctx) return;
    setEntError('');
    const btn = $('ae-ent-save');
    btn.disabled = true;
    try {
      const payload = collectEntentePayload();
      if (!payload.regime_actuel) { setEntError('Le régime est requis.'); return; }
      if (!payload.club_principal_id) { setEntError('Le club principal est requis.'); return; }

      let res;
      if (ctx.mode === 'create') {
        const code = strOrUndef($('ae-ent-code').value);
        if (!code) { setEntError('Le code de l’entente est requis pour la créer.'); return; }
        payload.code = code;
        payload.saison_id = ctx.saison.id;
        payload.categorie_id = ctx.cat.id;
        res = await Hub.createEntente(payload);
      } else {
        res = await Hub.updateEntente(ctx.entente.id, payload);
      }
      if (!res || !res.ok) { setEntError((res && res.error) || 'Échec de l’enregistrement.'); return; }
      closeModal('ae-modal-entente');
      await refresh();
    } catch (e) {
      console.error('AdminEquipes.saveEntente()', e);
      setEntError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
    }
  }

  // ----------------------------------------------------------------
  // RAFRAÎCHISSEMENT + ÉVÈNEMENTS
  // ----------------------------------------------------------------
  function showError(msg) {
    const el = $('ae-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg; el.style.display = 'block';
  }

  async function refresh() {
    await loadSaisonData();
    renderSaisonMeta();
    renderGrid();
  }

  function bindEvents() {
    // changement de saison
    $('ae-saison').addEventListener('change', async function (e) {
      State.selectedSaisonId = e.target.value || null;
      await refresh();
    });

    // délégation sur la grille
    $('ae-poles').addEventListener('click', function (e) {
      const t = e.target.closest('[data-action]');
      if (!t || t.disabled) return;
      const action = t.getAttribute('data-action');
      const catId = t.getAttribute('data-cat');
      if (action === 'open-equipe-create') openEquipeCreate(catId);
      else if (action === 'open-cadre') openCadre(catId);
      else if (action === 'open-equipe-edit') openEquipeEdit(t.getAttribute('data-equipe'), t.getAttribute('data-cat'));
      else if (action === 'save-responsables') saveResponsables(t.getAttribute('data-pole'));
    });

    // modale équipe
    $('ae-eq-save').addEventListener('click', saveEquipe);
    $('ae-eq-cancel').addEventListener('click', function () { closeModal('ae-modal-equipe'); });
    $('ae-eq-close').addEventListener('click', function () { closeModal('ae-modal-equipe'); });
    $('ae-eq-statut-toggle').addEventListener('click', toggleStatutEquipe);

    // modale entente
    $('ae-ent-save').addEventListener('click', saveEntente);
    $('ae-ent-cancel').addEventListener('click', function () { closeModal('ae-modal-entente'); });
    $('ae-ent-close').addEventListener('click', function () { closeModal('ae-modal-entente'); });
    $('ae-ent-club-principal').addEventListener('change', renderPartenaireChips);
    $('ae-ent-club-add-btn').addEventListener('click', function () {
      if (!State.entCtx) return;
      const id = $('ae-ent-club-add').value;
      if (id && State.entCtx.partenaires.indexOf(id) === -1) {
        State.entCtx.partenaires.push(id);
        renderPartenaireChips();
      }
    });
    $('ae-ent-clubs-chips').addEventListener('click', function (e) {
      if (!State.entCtx) return;
      const b = e.target.closest('[data-club-remove]');
      if (!b) return;
      const id = b.getAttribute('data-club-remove');
      State.entCtx.partenaires = State.entCtx.partenaires.filter(function (x) { return x !== id; });
      renderPartenaireChips();
    });

    // fermer une modale en cliquant le voile
    ['ae-modal-equipe', 'ae-modal-entente'].forEach(function (mid) {
      $(mid).addEventListener('click', function (e) { if (e.target === this) closeModal(mid); });
    });
  }

  // ----------------------------------------------------------------
  // INIT
  // ----------------------------------------------------------------
  async function init(opts) {
    State.isAdmin = !!(opts && opts.isAdmin);
    $('ae-badge').textContent = '🔒 Mode admin';

    try {
      const safeClubs = (async function () { try { return await Hub.getClubs(); } catch (e) { console.error(e); return []; } })();
      const safeStaff = (async function () { try { return await Hub.listStaffDisponibles(); } catch (e) { console.error(e); return []; } })();
      const [saisonsR, polesR, sitesR, clubs, staff] = await Promise.all([
        Hub.listSaisons(),
        Hub.getPolesAvecCategories(),
        Hub.listSitesActifs(),
        safeClubs,
        safeStaff
      ]);

      State.saisons = (saisonsR && saisonsR.ok && Array.isArray(saisonsR.data)) ? saisonsR.data : [];
      State.poles = (polesR && polesR.ok && Array.isArray(polesR.data)) ? polesR.data : [];
      State.sites = Array.isArray(sitesR) ? sitesR : [];
      State.clubs = Array.isArray(clubs) ? clubs : [];
      State.clubsById = new Map(State.clubs.map(function (c) { return [c.id, c]; }));
      // Pioche staff pour les responsables de pôle (ADMIN-RESPONSABLE-POLE).
      State.staffPourSelect = Array.isArray(staff) ? staff : [];
      State.staffById = new Map(State.staffPourSelect.map(function (p) { return [p.personne_id, p]; }));
      await resoudreNomsResponsables();

      if (polesR && !polesR.ok) showError('Lecture des pôles/catégories impossible : ' + (polesR.error || ''));

      // saison par défaut = active, sinon la plus récente (liste triée desc)
      const active = State.saisons.find(function (s) { return s.est_active; });
      State.selectedSaisonId = active ? active.id : (State.saisons[0] ? State.saisons[0].id : null);

      renderSaisonSelect();
      bindEvents();
      await refresh();
    } catch (e) {
      console.error('AdminEquipes.init()', e);
      showError('Erreur d’initialisation : ' + (e && e.message ? e.message : e));
    }
  }

  global.AdminEquipes = { init: init };

  console.log('%c🏉 MOM Hub · admin-equipes.js v1.2 chargé', 'color: #2D7D46; font-weight: bold;');

})(typeof window !== 'undefined' ? window : globalThis);
