/**
 * MOM Hub · Administration des saisons (ADMIN-(ii) sous-chantier 2)
 * ================================================================
 *
 * Contrôleur de admin-saisons.html. Doc FAIT FOI
 * Conception-UX-ADMIN-ii-v1.md (md5 ca043a48) §3.4. Données via
 * SupabaseHub v1.33 (listSaisons + 4 wrappers ADMIN-(ii) Saisons :
 * createSaison, setSaisonActive, apercuBascule, appliquerBascule).
 *
 * Principes (doctrine P1 simplicité) :
 *  - (2a) Liste des saisons triées récent→ancien (ordre listSaisons).
 *    Création = modale 4 requis (code, libelle, date_debut, date_fin),
 *    créée INACTIVE. Activation = bouton « Activer » par saison non
 *    active (la RPC activer_saison désactive l'ancienne, atomique).
 *    Pas d'édition des champs d'une saison en v1 (création + activation
 *    seules, conforme doc « activation simple »).
 *  - (2b) Bascule : on choisit une saison CIBLE, on calcule un APERÇU
 *    (apercuBascule, LECTURE SEULE — rien n'est écrit), puis on clique
 *    « Appliquer » sous CONFIRMATION explicite (garde-fou). Le serveur
 *    RECALCULE au moment d'appliquer (ne fait pas confiance à l'aperçu
 *    client). Changer de cible invalide l'aperçu (re-calcul requis).
 *  - Activation et bascule sont INDÉPENDANTES (deux gestes séparés, §1).
 *  - (2c) Reconduction (v1.1, FAIT FOI Conception-Reconduction-Saison-v1.md,
 *    md5 2f50aabf) : GESTE UNIQUE — l'aperçu bascule est complété par
 *    l'aperçu reconduction (ententes / équipes / collectif, RPC sql_141),
 *    et « Appliquer » enchaîne appliquerBascule PUIS appliquerReconduction
 *    (si la première échoue, la seconde n'est pas tentée). La saison
 *    SOURCE de reconduction est dérivée : la plus récente saison dont
 *    date_debut précède celle de la cible, affichée dans l'aperçu.
 *  - Garde UI admin-strict (cf. admin-saisons.html) ; les RPC sont elles
 *    aussi gardées has_role('admin') côté base.
 *
 * Version : 1.1 — 01/07/2026 (RECONDUCTION-SAISON, geste unique 2c).
 * Version : 1.0 — 28/05/2026 (Production ADMIN-(ii), pt 24).
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
  function strOrEmpty(v) { return (v == null ? '' : String(v)).trim(); }

  const State = {
    isAdmin: false,
    saisons: [],
    cibleId: null,
    apercuRows: null,      // dernier aperçu calculé (array) ou null
    apercuSaisonId: null   // saison pour laquelle l'aperçu est valide
  };

  // ----------------------------------------------------------------
  // HELPERS SAISON (alignés admin-equipes.js — bandeau D4)
  // ----------------------------------------------------------------
  function saisonLabel(s) { return s.libelle || s.code || s.id; }
  function saisonStatut(s) {
    if (!s) return '';
    if (s.est_active) return 'active';
    if (s.date_debut && s.date_debut > todayISO()) return 'à venir';
    return 'passée';
  }
  function findSaison(id) {
    return State.saisons.find(function (s) { return s.id === id; }) || null;
  }

  // (2c) État reconduction — porté par State, déclaré ADDITIVEMENT ici
  // pour ne pas retoucher le littéral historique.
  State.reconRows = null;       // dernier aperçu reconduction (array) ou null
  State.reconSourceId = null;   // saison source dérivée pour cet aperçu

  // (2c) Saison SOURCE de reconduction pour une cible donnée : la plus
  // récente saison dont date_debut précède strictement celle de la cible
  // (dérivation déterministe, affichée à l'écran — aucune inférence cachée).
  function findSourcePour(cibleId) {
    const cible = findSaison(cibleId);
    if (!cible || !cible.date_debut) return null;
    const candidates = State.saisons.filter(function (s) {
      return s.id !== cible.id && s.date_debut && s.date_debut < cible.date_debut;
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return a.date_debut < b.date_debut ? 1 : -1; });
    return candidates[0];
  }

  // ----------------------------------------------------------------
  // (2a) RENDU — liste des saisons
  // ----------------------------------------------------------------
  function renderSaisonsList() {
    const ul = $('asn-list');
    const empty = $('asn-empty');
    const count = $('asn-count');
    const saisons = State.saisons;

    if (!saisons.length) {
      ul.style.display = 'none';
      empty.style.display = 'block';
      count.textContent = '';
      return;
    }
    empty.style.display = 'none';
    ul.style.display = 'flex';
    count.textContent = saisons.length + ' saison' + (saisons.length > 1 ? 's' : '');

    ul.innerHTML = saisons.map(function (s) {
      const statut = saisonStatut(s);
      const badgeCls = s.est_active ? ' asn-statut-badge--active'
        : (statut === 'à venir' ? ' asn-statut-badge--avenir' : '');
      const tag = s.est_active ? ' ✦' : '';
      const dates = (s.date_debut || '?') + ' → ' + (s.date_fin || '?');
      const metaBits = [];
      if (s.code) metaBits.push(esc(s.code));
      metaBits.push(esc(dates));
      // Bouton Activer uniquement si pas déjà active.
      const activerBtn = s.est_active ? ''
        : '<button type="button" class="asn-btn asn-btn--ghost" data-action="activer-saison" ' +
          'data-id="' + esc(s.id) + '">Activer</button>';
      return '' +
        '<li class="asn-item' + (s.est_active ? ' asn-item--active' : '') + '">' +
          '<div class="asn-item-main">' +
            '<span class="asn-item-nom">' + esc(saisonLabel(s)) + tag + '</span>' +
            '<span class="asn-item-meta">' + metaBits.join(' · ') + '</span>' +
          '</div>' +
          '<span class="asn-statut-badge' + badgeCls + '">' + esc(statut) + '</span>' +
          activerBtn +
        '</li>';
    }).join('');
  }

  // ----------------------------------------------------------------
  // (2b) RENDU — sélecteur saison cible
  // ----------------------------------------------------------------
  function renderCibleSelect() {
    const sel = $('asn-cible');
    if (!State.saisons.length) {
      sel.innerHTML = '<option value="">Aucune saison</option>';
      State.cibleId = null;
      return;
    }
    sel.innerHTML = State.saisons.map(function (s) {
      const tag = s.est_active ? ' ✦' : (saisonStatut(s) === 'à venir' ? ' (à venir)' : '');
      return '<option value="' + esc(s.id) + '">' + esc(saisonLabel(s)) + tag + '</option>';
    }).join('');

    // Défaut : la 1ʳᵉ saison « à venir » si elle existe (cas d'usage : préparer
    // N+1), sinon la 1ʳᵉ de la liste.
    if (!State.cibleId || !findSaison(State.cibleId)) {
      const future = State.saisons.find(function (s) { return saisonStatut(s) === 'à venir'; });
      State.cibleId = future ? future.id : State.saisons[0].id;
    }
    sel.value = State.cibleId;
  }

  // ----------------------------------------------------------------
  // MODALE création saison
  // ----------------------------------------------------------------
  function openModal(id) { $(id).classList.add('is-open'); }
  function closeModal(id) { $(id).classList.remove('is-open'); }

  function setSaisonError(msg) {
    const el = $('asn-saison-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg; el.style.display = 'block';
  }

  function openSaisonCreate() {
    setSaisonError('');
    $('asn-saison-code').value = '';
    $('asn-saison-libelle').value = '';
    $('asn-saison-debut').value = '';
    $('asn-saison-fin').value = '';
    openModal('asn-modal-saison');
    $('asn-saison-code').focus();
  }

  async function saveSaison() {
    setSaisonError('');
    const payload = {
      code: strOrEmpty($('asn-saison-code').value),
      libelle: strOrEmpty($('asn-saison-libelle').value),
      date_debut: strOrEmpty($('asn-saison-debut').value),
      date_fin: strOrEmpty($('asn-saison-fin').value)
    };
    if (!payload.code || !payload.libelle || !payload.date_debut || !payload.date_fin) {
      setSaisonError('Tous les champs sont requis (code, libellé, dates).');
      return;
    }
    if (payload.date_fin <= payload.date_debut) {
      setSaisonError('La date de fin doit être postérieure à la date de début.');
      return;
    }
    const btn = $('asn-saison-save');
    btn.disabled = true;
    try {
      const res = await Hub.createSaison(payload);
      if (!res || !res.ok) { setSaisonError((res && res.error) || 'Échec de la création.'); return; }
      closeModal('asn-modal-saison');
      State.cibleId = res.data || State.cibleId;   // pré-sélectionne la neuve comme cible
      await refresh();
    } catch (e) {
      console.error('AdminSaisons.saveSaison()', e);
      setSaisonError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
    }
  }

  // ----------------------------------------------------------------
  // ACTIVATION (geste séparé)
  // ----------------------------------------------------------------
  async function activerSaison(saisonId) {
    const s = findSaison(saisonId);
    if (!s) return;
    const ok = window.confirm(
      'Activer la saison « ' + saisonLabel(s) + ' » ?\n\n' +
      'La saison active actuelle sera automatiquement désactivée ' +
      '(une seule saison active à la fois).'
    );
    if (!ok) return;
    showError('');
    try {
      const res = await Hub.setSaisonActive(saisonId);
      if (!res || !res.ok) { showError((res && res.error) || 'Échec de l\u2019activation.'); return; }
      await refresh();
    } catch (e) {
      console.error('AdminSaisons.activerSaison()', e);
      showError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    }
  }

  // ----------------------------------------------------------------
  // (2b) APERÇU BASCULE — lecture seule
  // ----------------------------------------------------------------
  function resetApercu() {
    State.apercuRows = null;
    State.apercuSaisonId = null;
    $('asn-apercu').classList.remove('is-shown');
    $('asn-result').classList.remove('is-shown');
    $('asn-appliquer-btn').disabled = true;
    $('asn-apply-hint').textContent = '';
    // (2c) L'invalidation de l'aperçu invalide aussi la reconduction.
    State.reconRows = null;
    State.reconSourceId = null;
    $('asn-recon').classList.remove('is-shown');
    $('asn-recon-note').textContent = '';
  }

  async function calculerApercu() {
    showError('');
    $('asn-result').classList.remove('is-shown');
    const cibleId = State.cibleId;
    if (!cibleId) { showError('Choisissez d\u2019abord une saison cible.'); return; }
    const btn = $('asn-apercu-btn');
    btn.disabled = true;
    try {
      const res = await Hub.apercuBascule(cibleId);
      if (!res || !res.ok) { showError((res && res.error) || 'Échec du calcul de l\u2019aperçu.'); return; }
      State.apercuRows = Array.isArray(res.data) ? res.data : [];
      State.apercuSaisonId = cibleId;
      renderApercu();
      // (2c) GESTE UNIQUE — l'aperçu bascule est complété par l'aperçu
      // reconduction (LECTURE SEULE lui aussi).
      await calculerApercuRecon(cibleId);
    } catch (e) {
      console.error('AdminSaisons.calculerApercu()', e);
      showError('Erreur inattendue : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
    }
  }

  function rowsByGroup(g) {
    return (State.apercuRows || []).filter(function (r) { return r.groupe === g; });
  }

  function renderApercu() {
    const aBasculer = rowsByGroup('a_basculer');
    const inchange = rowsByGroup('inchange');
    const aVerifier = rowsByGroup('a_verifier');

    $('asn-n-basculer').textContent = aBasculer.length;
    $('asn-n-inchange').textContent = inchange.length;
    $('asn-n-verifier').textContent = aVerifier.length;

    const tables = $('asn-tables');
    let html = '';

    // Table « à basculer » : nom · cat avant → cat après
    if (aBasculer.length) {
      html += '<div class="asn-table-wrap">' +
        '<p class="asn-table-title">À basculer (' + aBasculer.length + ')</p>' +
        '<div class="asn-table-scroll"><table class="asn-table">' +
        '<thead><tr><th>Joueur</th><th>Catégorie actuelle</th><th></th><th>Nouvelle catégorie</th></tr></thead><tbody>' +
        aBasculer.map(function (r) {
          return '<tr><td>' + esc(r.nom_court || '—') + '</td>' +
            '<td>' + esc(r.cat_avant || '—') + '</td>' +
            '<td class="asn-arrow">→</td>' +
            '<td>' + esc(r.cat_apres || '—') + '</td></tr>';
        }).join('') +
        '</tbody></table></div></div>';
    }

    // Table « à vérifier » : nom · motif
    if (aVerifier.length) {
      html += '<div class="asn-table-wrap">' +
        '<p class="asn-table-title">À vérifier (' + aVerifier.length + ') — non basculés automatiquement</p>' +
        '<div class="asn-table-scroll"><table class="asn-table">' +
        '<thead><tr><th>Joueur</th><th>Catégorie actuelle</th><th>Motif</th></tr></thead><tbody>' +
        aVerifier.map(function (r) {
          return '<tr><td>' + esc(r.nom_court || '—') + '</td>' +
            '<td>' + esc(r.cat_avant || '—') + '</td>' +
            '<td class="asn-motif">' + esc(r.motif || '—') + '</td></tr>';
        }).join('') +
        '</tbody></table></div></div>';
    }

    if (!aBasculer.length && !aVerifier.length) {
      html = '<p class="asn-empty">Rien à basculer ni à vérifier pour cette saison ' +
        '(tous les joueurs sont déjà à la bonne catégorie, ou hors périmètre).</p>';
    }

    tables.innerHTML = html;

    // Bouton Appliquer : actif seulement s'il y a des joueurs à basculer.
    const btn = $('asn-appliquer-btn');
    btn.disabled = aBasculer.length === 0;
    $('asn-apply-hint').textContent = aBasculer.length
      ? aBasculer.length + ' joueur' + (aBasculer.length > 1 ? 's' : '') + ' seront basculés.'
      : 'Aucun joueur à basculer.';

    $('asn-apercu').classList.add('is-shown');
  }

  // ----------------------------------------------------------------
  // (2c) APERÇU RECONDUCTION — lecture seule (FAIT FOI
  // Conception-Reconduction-Saison-v1.md §4 ; RPC sql_141).
  // ----------------------------------------------------------------
  function reconRowsBy(volet, groupe) {
    return (State.reconRows || []).filter(function (r) {
      return r.volet === volet && r.groupe === groupe;
    });
  }

  function reconPending() {
    return reconRowsBy('entente', 'a_creer').length
      + reconRowsBy('equipe', 'a_rebrancher').length
      + reconRowsBy('collectif', 'a_amorcer').length;
  }

  async function calculerApercuRecon(cibleId) {
    const source = findSourcePour(cibleId);
    State.reconRows = null;
    State.reconSourceId = null;
    if (!source) {
      renderRecon(null);
      return;
    }
    try {
      const res = await Hub.apercuReconduction(source.id, cibleId);
      if (!res || !res.ok) {
        renderRecon(source, (res && res.error) || 'Échec de l\u2019aperçu reconduction.');
        return;
      }
      State.reconRows = Array.isArray(res.data) ? res.data : [];
      State.reconSourceId = source.id;
      renderRecon(source);
    } catch (e) {
      console.error('AdminSaisons.calculerApercuRecon()', e);
      renderRecon(source, 'Erreur inattendue : ' + (e && e.message ? e.message : e));
    }
  }

  function renderRecon(source, errMsg) {
    const nEnt = reconRowsBy('entente', 'a_creer').length;
    const nEq = reconRowsBy('equipe', 'a_rebrancher').length;
    const nMb = reconRowsBy('collectif', 'a_amorcer').length;
    $('asn-n-rec-ententes').textContent = nEnt;
    $('asn-n-rec-equipes').textContent = nEq;
    $('asn-n-rec-membres').textContent = nMb;

    let note = '';
    if (!source) {
      note = 'Aucune saison antérieure à la cible : reconduction sans objet.';
    } else if (errMsg) {
      note = '⚠ ' + errMsg;
    } else {
      const dejaEnt = reconRowsBy('entente', 'deja_existante').length;
      const dejaEq = reconRowsBy('equipe', 'deja_rebranchee').length;
      const dejaMb = reconRowsBy('collectif', 'deja_amorce').length;
      const sansCible = reconRowsBy('collectif', 'sans_entente_cible').length;
      const bits = ['Reconduit depuis « ' + saisonLabel(source) + ' ».'];
      if (dejaEnt + dejaEq + dejaMb) {
        bits.push('Déjà fait : ' + dejaEnt + ' entente(s), ' + dejaEq +
          ' équipe(s), ' + dejaMb + ' membre(s).');
      }
      if (sansCible) {
        bits.push(sansCible + ' personne(s) sans entente cible (catégorie sans ' +
          'entente MOM, ex-F18) : non amorcées, attendu.');
      }
      note = bits.join(' ');
    }
    $('asn-recon-note').textContent = note;
    $('asn-recon').classList.add('is-shown');

    // Surcharge du bouton Appliquer (le rendu bascule a déjà posé son état :
    // on le recompose ici en combinant bascule + reconduction — additif, le
    // code historique de renderApercu n'est pas retouché).
    const nBasc = rowsByGroup('a_basculer').length;
    const nRec = nEnt + nEq + nMb;
    const btn = $('asn-appliquer-btn');
    btn.disabled = (nBasc + nRec) === 0;
    const hints = [];
    hints.push(nBasc
      ? nBasc + ' joueur' + (nBasc > 1 ? 's' : '') + ' seront basculés.'
      : 'Aucun joueur à basculer.');
    hints.push(nRec
      ? 'Reconduction : ' + nEnt + ' entente(s), ' + nEq + ' équipe(s), ' +
        nMb + ' membre(s).'
      : 'Rien à reconduire.');
    $('asn-apply-hint').textContent = hints.join(' ');
  }

  // ----------------------------------------------------------------
  // (2b) APPLIQUER — sous confirmation
  // ----------------------------------------------------------------
  function demanderAppliquer() {
    // Sécurité : l'aperçu doit correspondre à la cible courante.
    if (State.apercuSaisonId !== State.cibleId || !State.apercuRows) {
      showError('Recalculez l\u2019aperçu pour la saison sélectionnée avant d\u2019appliquer.');
      return;
    }
    const n = rowsByGroup('a_basculer').length;
    if (!n && !reconPending()) return;   // (2c) modifié : recon seule = geste valide
    const s = findSaison(State.cibleId);
    $('asn-confirm-text').innerHTML =
      'Vous allez basculer <span class="asn-confirm-strong">' + n + ' joueur' + (n > 1 ? 's' : '') +
      '</span> vers la saison <span class="asn-confirm-strong">' + esc(saisonLabel(s)) + '</span>.';
    // (2c) GESTE UNIQUE — la confirmation annonce aussi la reconduction.
    const nEnt = reconRowsBy('entente', 'a_creer').length;
    const nEq = reconRowsBy('equipe', 'a_rebrancher').length;
    const nMb = reconRowsBy('collectif', 'a_amorcer').length;
    if (nEnt + nEq + nMb) {
      $('asn-confirm-text').innerHTML +=
        ' La reconduction sera appliquée dans la foulée : <span class="asn-confirm-strong">' +
        nEnt + ' entente(s), ' + nEq + ' équipe(s), ' + nMb + ' membre(s)</span>.';
    }
    if (!n && (nEnt + nEq + nMb)) {
      $('asn-confirm-text').innerHTML =
        'Aucun joueur à basculer. Vous allez appliquer la <span class="asn-confirm-strong">reconduction' +
        '</span> vers la saison <span class="asn-confirm-strong">' + esc(saisonLabel(s)) + '</span> : ' +
        '<span class="asn-confirm-strong">' + nEnt + ' entente(s), ' + nEq + ' équipe(s), ' +
        nMb + ' membre(s)</span>.';
    }
    openModal('asn-modal-confirm');
  }

  async function confirmAppliquer() {
    closeModal('asn-modal-confirm');
    showError('');
    const cibleId = State.cibleId;
    const btn = $('asn-appliquer-btn');
    btn.disabled = true;
    try {
      const res = await Hub.appliquerBascule(cibleId);
      if (!res || !res.ok) { showError((res && res.error) || 'Échec de la bascule.'); return; }
      const d = res.data || {};
      const nb = (d.nb_basculees != null) ? d.nb_basculees : 0;
      const result = $('asn-result');
      result.textContent = '✓ Bascule appliquée : ' + nb + ' joueur' + (nb > 1 ? 's' : '') +
        ' basculé' + (nb > 1 ? 's' : '') + '.' + (d.log_id ? ' (journal : ' + d.log_id + ')' : '');
      result.classList.add('is-shown');
      // (2c) GESTE UNIQUE — enchaîne la reconduction (FAIT FOI §6). On est
      // ici = la bascule a réussi ; si elle avait échoué, le return au-dessus
      // garantit que la reconduction n'est PAS tentée. RPC idempotente :
      // en cas d'échec ici, recalculer l'aperçu puis ré-appliquer suffit.
      if (reconPending() && State.reconSourceId) {
        const r2 = await Hub.appliquerReconduction(State.reconSourceId, cibleId);
        if (!r2 || !r2.ok) {
          showError('Bascule appliquée, mais la reconduction a échoué : ' +
            ((r2 && r2.error) || 'erreur inconnue') +
            '. Recalculez l\u2019aperçu puis ré-appliquez (geste idempotent, sans doublon).');
        } else {
          const d2 = r2.data || {};
          result.textContent += ' ✓ Reconduction : ' + (d2.nb_ententes || 0) +
            ' entente(s), ' + (d2.nb_equipes || 0) + ' équipe(s), ' +
            (d2.nb_membres || 0) + ' membre(s).' +
            (d2.log_id ? ' (journal : ' + d2.log_id + ')' : '');
        }
      }
      // Recalcule l'aperçu : « à basculer » doit retomber à 0.
      await calculerApercu();
    } catch (e) {
      console.error('AdminSaisons.confirmAppliquer()', e);
      showError('Erreur inattendue : ' + (e && e.message ? e.message : e));
      btn.disabled = false;
    }
  }

  // ----------------------------------------------------------------
  // ERREUR PAGE / REFRESH / EVENTS / INIT
  // ----------------------------------------------------------------
  function showError(msg) {
    const el = $('asn-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg; el.style.display = 'block';
  }

  async function refresh() {
    const r = await Hub.listSaisons();
    State.saisons = (r && r.ok && Array.isArray(r.data)) ? r.data : [];
    renderSaisonsList();
    renderCibleSelect();
    resetApercu();   // toute modif des saisons invalide un aperçu précédent
  }

  function bindEvents() {
    // (2a) création
    $('asn-new').addEventListener('click', openSaisonCreate);
    $('asn-saison-save').addEventListener('click', saveSaison);
    $('asn-saison-cancel').addEventListener('click', function () { closeModal('asn-modal-saison'); });
    $('asn-saison-close').addEventListener('click', function () { closeModal('asn-modal-saison'); });
    $('asn-modal-saison').addEventListener('click', function (e) { if (e.target === this) closeModal('asn-modal-saison'); });

    // (2a) activation (délégation sur la liste)
    $('asn-list').addEventListener('click', function (e) {
      const t = e.target.closest('[data-action="activer-saison"]');
      if (!t) return;
      activerSaison(t.getAttribute('data-id'));
    });

    // (2b) bascule
    $('asn-cible').addEventListener('change', function () {
      State.cibleId = this.value || null;
      resetApercu();   // changer de cible invalide l'aperçu
    });
    $('asn-apercu-btn').addEventListener('click', calculerApercu);
    $('asn-appliquer-btn').addEventListener('click', demanderAppliquer);
    $('asn-confirm-ok').addEventListener('click', confirmAppliquer);
    $('asn-confirm-cancel').addEventListener('click', function () { closeModal('asn-modal-confirm'); });
    $('asn-confirm-close').addEventListener('click', function () { closeModal('asn-modal-confirm'); });
    $('asn-modal-confirm').addEventListener('click', function (e) { if (e.target === this) closeModal('asn-modal-confirm'); });
  }

  async function init(opts) {
    State.isAdmin = !!(opts && opts.isAdmin);
    $('asn-badge').textContent = '🔒 Mode admin';
    try {
      bindEvents();
      await refresh();
    } catch (e) {
      console.error('AdminSaisons.init()', e);
      showError('Erreur d\u2019initialisation : ' + (e && e.message ? e.message : e));
    }
  }

  global.AdminSaisons = { init: init };

  console.log('%c🏉 MOM Hub · admin-saisons.js v1.1 chargé', 'color: #2D7D46; font-weight: bold;');

})(typeof window !== 'undefined' ? window : globalThis);
