/**
 * MOM Hub · staff.js — écran Staff unifié (Refonte tableau de bord admin, volet A).
 * =============================================================================
 *
 * Fusionne en une page à onglets les deux écrans « staff » historiques, SANS
 * changer leur logique de données (clonage fidèle, vérifié à la source 05/06) :
 *
 *   ONGLET FONCTIONS (défaut) — ex-fonctions-staff.html
 *     - entrée : grille de vignettes catégorie groupées par pôle
 *       (SupabaseHub.getPolesAvecCategories) — remplace l'ancien <select fsCat>.
 *     - RPC : list_fonctions_staff / definir_ / cloturer_ / supprimer_fonction_staff,
 *       list_staff_disponibles (pioche), via client.rpc(...) inline.
 *     - datalist alimentée par data/fonctions-staff.json (référentiel suggéré).
 *
 *   ONGLET VIVIER — ex-bloc staff de u-admin
 *     - entrée : <select> entente/saison (SupabaseHub.listEntentes).
 *     - liste : listCollectifMembres(ententeId, {role:'staff'}).
 *     - enrôlement : addCollectifMembre(role:'staff') ; sortie : updateCollectifMembre(date_fin).
 *     - pioche : listStaffDisponibles() (club-wide), excluant les actifs.
 *
 * Garde d'auth admin = motif fonctions-staff/u-admin (getSession + getMyRoles).
 * Aucun client recréé : tout via SupabaseHub.client.
 */
(async function () {
  'use strict';

  // --- Garde d'auth admin (motif u-admin / fonctions-staff) ---
  const session = await SupabaseHub.getSession();
  if (!session) { window.location.replace('login.html'); return; }
  const roles = await SupabaseHub.getMyRoles();
  if (roles.indexOf('admin') === -1) { window.location.replace('./'); return; }
  document.body.classList.remove('auth-pending');
  document.body.classList.add('auth-resolved', 'auth-admin');

  // Topbar : déconnexion (onAuthChange existant en fin de fichier gère SIGNED_OUT)
  var _signout = document.getElementById('btn-signout');
  if (_signout) {
    _signout.addEventListener('click', async function () {
      _signout.disabled = true;
      await SupabaseHub.signOut();
    });
  }
  // Topbar : season-pill dynamique (dégradation honnête sur libellé statique)
  try {
    const _saison = await SupabaseHub.getSaisonActive();
    if (_saison && _saison.libelle) {
      const _pill = document.getElementById('season-pill');
      if (_pill) _pill.textContent = 'SAISON ' + _saison.libelle;
    }
  } catch (_) { /* libellé statique conservé */ }

  const client = SupabaseHub.client;
  const $ = (id) => document.getElementById(id);

  // ----------------------------------------------------------
  // Utilitaires partagés
  // ----------------------------------------------------------
  function flash(text, kind) {
    const m = $('stMsg');
    m.textContent = text; m.className = 'st-msg ' + kind;
    if (kind === 'ok') setTimeout(() => { m.className = 'st-msg'; }, 3500);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function errMsg(e) {
    const m = (e && (e.message || e.error_description || e.hint)) || 'Erreur inconnue.';
    return /admin/i.test(m) ? "Action réservée à l'administrateur." : m;
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getDate().toString().padStart(2, '0') + '/' +
           (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear();
  }
  async function rpc(name, params) {
    const { data, error } = await client.rpc(name, params || {});
    if (error) throw error;
    return data;
  }

  // ==========================================================
  // ONGLET FONCTIONS (ex-fonctions-staff)
  // ==========================================================
  const FN = { staffNames: new Map(), currentCat: '', poles: [], loaded: false };

  async function fnLoadGrid() {
    const host = $('fnGrid');
    let res;
    try {
      res = await SupabaseHub.getPolesAvecCategories();
    } catch (e) {
      host.innerHTML = '<div class="st-empty">Chargement des catégories impossible : ' + escapeHtml(errMsg(e)) + '</div>';
      return;
    }
    // getPolesAvecCategories renvoie { ok, data:[...] } (vérifié à la source) :
    // on déballe .data, jamais l'objet brut.
    if (!res || !res.ok) {
      host.innerHTML = '<div class="st-empty">Chargement des catégories impossible : ' +
        escapeHtml((res && res.error) || 'erreur inconnue') + '</div>';
      return;
    }
    FN.poles = Array.isArray(res.data) ? res.data : [];
    if (!FN.poles.length) { host.innerHTML = '<div class="st-empty">Aucun pôle.</div>'; return; }

    host.innerHTML = FN.poles.map(function (p) {
      const cats = Array.isArray(p.categories) ? p.categories : [];
      const cards = cats.length
        ? cats.map(function (c) {
            const lib = c.libelle_court || c.libelle_long || c.code || '(catégorie)';
            return '<button type="button" class="st-cat" data-cat="' + escapeHtml(c.id) +
              '" data-lib="' + escapeHtml(lib) + '">' +
              '<div class="st-cat__head"><span class="st-cat__name">' + escapeHtml(lib) + '</span></div>' +
              '<div class="st-cat__foot">Gérer les fonctions &rarr;</div>' +
            '</button>';
          }).join('')
        : '<div class="st-empty">Aucune catégorie active.</div>';
      const sub = cats.length + ' catégorie' + (cats.length > 1 ? 's' : '');
      return '<section class="st-pole">' +
        '<div class="st-pole__head"><span class="st-pole__title">' +
          escapeHtml(p.libelle_court || p.libelle_long || p.code || 'Pôle') + '</span>' +
          '<span class="st-pole__sub">' + sub + '</span></div>' +
        '<div class="st-cat-grid">' + cards + '</div>' +
      '</section>';
    }).join('');

    host.querySelectorAll('.st-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        fnSelectCat(btn.getAttribute('data-cat'), btn.getAttribute('data-lib'), btn);
      });
    });
  }

  async function fnLoadStaffPioche() {
    const staff = await rpc('list_staff_disponibles', { p_categorie_id: null });
    const sel = $('fnStaff');
    sel.innerHTML = '<option value="">&mdash; choisir &mdash;</option>';
    (staff || []).forEach(function (s) {
      const label = [s.prenom, s.nom].filter(Boolean).join(' ').trim() || s.personne_id;
      FN.staffNames.set(s.personne_id, label);
      const o = document.createElement('option');
      o.value = s.personne_id; o.textContent = label;
      sel.appendChild(o);
    });
  }

  async function fnLoadFonctionsRef() {
    try {
      const res = await fetch('data/fonctions-staff.json');
      if (!res.ok) return;
      const json = await res.json();
      const dl = $('fnFonctionsList');
      (json.fonctions || []).forEach(function (f) {
        const o = document.createElement('option'); o.value = f; dl.appendChild(o);
      });
    } catch (_) { /* datalist optionnelle */ }
  }

  function fnNameFor(id) { return FN.staffNames.get(id) || id; }

  async function fnSelectCat(catId, lib, btn) {
    FN.currentCat = catId || '';
    $('fnGrid').querySelectorAll('.st-cat').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    const on = !!FN.currentCat;
    $('fnZone').style.display = on ? 'block' : 'none';
    if (on) {
      $('fnListTitle').textContent = 'Staff — ' + lib;
      await fnRenderList();
    }
  }

  async function fnRenderList() {
    if (!FN.currentCat) return;
    const rows = await rpc('list_fonctions_staff', {
      p_categorie_id: FN.currentCat,
      p_inclure_historique: $('fnHistChk').checked
    });
    const tbody = $('fnRows'); tbody.innerHTML = '';
    $('fnEmpty').style.display = (rows && rows.length) ? 'none' : 'block';
    (rows || []).forEach(function (r) {
      const ended = !!r.date_fin;
      const tr = document.createElement('tr');
      if (ended) tr.className = 'st-ended';
      // pt 212 : le nom vient désormais directement de la RPC (r.nom/r.prenom),
      // ce qui résout aussi les joueurs-encadrants absents de la pioche staff
      // (ex. Voegeli, référente F15). Replis : Map staffNames, puis UUID.
      const nomLigne = [r.prenom, r.nom].filter(Boolean).join(' ').trim() || fnNameFor(r.personne_id);
      tr.innerHTML =
        '<td>' + escapeHtml(nomLigne) + '</td>' +
        '<td>' + escapeHtml(r.fonction) + '</td>' +
        '<td>' + (r.date_debut || '') + '</td>' +
        '<td>' + (ended
          ? '<span class="st-badge ended">clos ' + r.date_fin + '</span>'
          : '<span class="st-badge active">en cours</span>') + '</td>' +
        '<td style="text-align:right"></td>';
      const actions = tr.lastElementChild;
      if (!ended) {
        const b = document.createElement('button');
        b.className = 'st-link'; b.textContent = 'Clôturer';
        b.onclick = function () { fnClose(r.id); };
        actions.appendChild(b);
      }
      const d = document.createElement('button');
      d.className = 'st-link danger'; d.textContent = 'Supprimer';
      d.onclick = function () { fnDel(r.id); };
      actions.appendChild(d);
      tbody.appendChild(tr);
    });
  }

  async function fnAdd() {
    const personne = $('fnStaff').value;
    const fonction = $('fnFonction').value.trim();
    const debut = $('fnDebut').value || null;
    if (!FN.currentCat) return flash('Choisis d\'abord une catégorie.', 'err');
    if (!personne) return flash('Choisis une personne.', 'err');
    if (!fonction) return flash('Saisis une fonction.', 'err');
    $('fnAddBtn').disabled = true;
    try {
      const params = { p_personne_id: personne, p_categorie_id: FN.currentCat, p_fonction: fonction };
      if (debut) params.p_date_debut = debut;
      await rpc('definir_fonction_staff', params);
      $('fnFonction').value = ''; $('fnStaff').value = '';
      flash('Fonction ajoutée.', 'ok');
      await fnRenderList();
    } catch (e) { flash(errMsg(e), 'err'); }
    finally { $('fnAddBtn').disabled = false; }
  }
  async function fnClose(id) {
    try { await rpc('cloturer_fonction_staff', { p_id: id }); flash('Fonction clôturée.', 'ok'); await fnRenderList(); }
    catch (e) { flash(errMsg(e), 'err'); }
  }
  async function fnDel(id) {
    if (!confirm('Supprimer définitivement cette ligne ? (pour une fin normale, utilise Clôturer)')) return;
    try { await rpc('supprimer_fonction_staff', { p_id: id }); flash('Ligne supprimée.', 'ok'); await fnRenderList(); }
    catch (e) { flash(errMsg(e), 'err'); }
  }

  // ==========================================================
  // ONGLET VIVIER (ex-bloc staff de u-admin)
  // ==========================================================
  const VI = { ententes: [], ententeId: null, ententeLib: '', membres: [], pioche: [], busy: false, loaded: false };

  // Libellé d'une entente : « catégorie · saison ». Champs réels (vérifiés à
  // la source) : e.categories.code et e.saisons.code (objets imbriqués),
  // PAS de e.categorie_libelle / e.saison_libelle (inexistants).
  function viEntenteLib(e) {
    const cat = (e.categories && (e.categories.code)) || '';
    const sai = (e.saisons && (e.saisons.code)) || '';
    const txt = [cat, sai].filter(Boolean).join(' · ');
    return txt || e.libelle_court || e.libelle_moyen || e.code || 'entente';
  }

  async function viLoadGrid() {
    VI.ententes = await SupabaseHub.listEntentes() || [];
    const host = $('viGrid');
    if (!VI.ententes.length) {
      host.innerHTML = '<div class="st-empty">Aucune entente trouvée. La création d\'entente se fait hors de cet écran (administration transverse).</div>';
      return;
    }
    host.innerHTML =
      '<div class="st-cat-grid">' +
      VI.ententes.map(function (e) {
        const lib = viEntenteLib(e);
        return '<button type="button" class="st-cat" data-ent="' + escapeHtml(e.id) +
          '" data-lib="' + escapeHtml(lib) + '">' +
          '<div class="st-cat__head"><span class="st-cat__name">' + escapeHtml(lib) + '</span></div>' +
          '<div class="st-cat__foot">Voir le vivier &rarr;</div>' +
        '</button>';
      }).join('') +
      '</div>';
    host.querySelectorAll('.st-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        viSelectEntente(btn.getAttribute('data-ent'), btn.getAttribute('data-lib'), btn);
      });
    });
  }

  async function viLoadMembres() {
    VI.membres = await SupabaseHub.listCollectifMembres(VI.ententeId, { role: 'staff' }) || [];
    VI.pioche = await SupabaseHub.listStaffDisponibles() || [];
  }

  function viNomMembre(cm) {
    const p = (cm && cm.personnes) ? cm.personnes : {};
    return [p.prenom, p.nom].filter(Boolean).join(' ') || '(sans nom)';
  }

  function viRender() {
    const host = $('viList');
    const actifs = VI.membres.filter(function (m) { return !m.date_fin; });
    $('viCount').textContent = String(actifs.length);

    if (!VI.membres.length) {
      host.innerHTML = '<li class="st-empty">Aucun staff dans le vivier pour cette saison.</li>';
    } else {
      host.innerHTML = VI.membres.map(function (m) {
        const sorti = !!m.date_fin;
        let h = '<li class="st-item' + (sorti ? ' st-item--out' : '') + '">';
        h += '<div class="st-item-name">' + escapeHtml(viNomMembre(m));
        if (sorti) h += '<span class="st-chip">sorti le ' + escapeHtml(formatDate(m.date_fin)) + '</span>';
        else h += '<span class="st-chip">actif</span>';
        h += '</div>';
        h += '<div class="st-item-dates">depuis le ' + escapeHtml(formatDate(m.date_debut));
        h += '</div>';
        if (!sorti) {
          h += '<button type="button" class="st-link" data-out="' + escapeHtml(m.id) +
               '" title="Marquer la sortie (date du jour) — la ligne reste, jamais supprimée">Marquer sortie</button>';
        }
        h += '</li>';
        return h;
      }).join('');
      host.querySelectorAll('[data-out]').forEach(function (b) {
        b.addEventListener('click', function () { viMarkOut(b.getAttribute('data-out')); });
      });
    }

    viRenderPioche();
  }

  function viRenderPioche() {
    const sel = $('viPioche');
    const dejaActifs = new Set(
      VI.membres.filter(function (m) { return !m.date_fin; }).map(function (m) { return m.personne_id; })
    );
    const dispo = VI.pioche.filter(function (p) { return !dejaActifs.has(p.personne_id); });
    if (!dispo.length) {
      sel.innerHTML = '<option value="">(aucun staff disponible — tous déjà dans le vivier)</option>';
      $('viAddBtn').disabled = true;
      return;
    }
    let html = '<option value="">&mdash; Choisir un staff à enrôler… &mdash;</option>';
    dispo.forEach(function (p) {
      const lib = [p.prenom, p.nom].filter(Boolean).join(' ') || '(sans nom)';
      html += '<option value="' + escapeHtml(p.personne_id) + '">' + escapeHtml(lib) + '</option>';
    });
    sel.innerHTML = html;
    $('viAddBtn').disabled = false;
  }

  async function viSelectEntente(ententeId, lib, btn) {
    VI.ententeId = ententeId || null;
    VI.ententeLib = lib || '';
    $('viGrid').querySelectorAll('.st-cat').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    if (!VI.ententeId) { $('viPanel').style.display = 'none'; return; }
    $('viColTitle').textContent = 'Staff du vivier — ' + (VI.ententeLib || '');
    $('viPanel').style.display = 'block';
    try {
      await viLoadMembres();
      viRender();
    } catch (e) { flash('Chargement vivier impossible : ' + errMsg(e), 'err'); }
  }

  async function viAdd() {
    if (VI.busy) return;
    const pid = $('viPioche').value;
    if (!pid) return;
    VI.busy = true; $('viAddBtn').disabled = true;
    const r = await SupabaseHub.addCollectifMembre({
      personne_id: pid, entente_id: VI.ententeId, role: 'staff', statut: 'regulier', date_debut: today()
    });
    VI.busy = false;
    if (!r || !r.ok) {
      flash('Enrôlement staff impossible : ' + ((r && r.error) || 'erreur inconnue'), 'err');
      $('viAddBtn').disabled = false;
      return;
    }
    flash('Staff enrôlé.', 'ok');
    await viLoadMembres(); viRender();
  }

  async function viMarkOut(membreId) {
    if (VI.busy || !membreId) return;
    if (!confirm('Marquer la sortie de ce staff à la date du jour ?\nLa ligne est conservée (historique), jamais supprimée.')) return;
    VI.busy = true;
    const r = await SupabaseHub.updateCollectifMembre(membreId, { date_fin: today() });
    VI.busy = false;
    if (!r || !r.ok) { flash('Sortie impossible : ' + ((r && r.error) || 'erreur inconnue'), 'err'); return; }
    flash('Sortie enregistrée.', 'ok');
    await viLoadMembres(); viRender();
  }

  // ==========================================================
  // Onglets + boot
  // ==========================================================
  function showTab(which) {
    const onFn = (which === 'fonctions');
    $('tab-fonctions').classList.toggle('active', onFn);
    $('tab-vivier').classList.toggle('active', !onFn);
    $('tab-fonctions').setAttribute('aria-selected', onFn ? 'true' : 'false');
    $('tab-vivier').setAttribute('aria-selected', onFn ? 'false' : 'true');
    $('panel-fonctions').style.display = onFn ? 'block' : 'none';
    $('panel-vivier').style.display = onFn ? 'none' : 'block';
    if (onFn && !FN.loaded) {
      FN.loaded = true;
      Promise.all([fnLoadGrid(), fnLoadStaffPioche(), fnLoadFonctionsRef()])
        .catch(function (e) { flash('Chargement fonctions impossible : ' + errMsg(e), 'err'); });
    }
    if (!onFn && !VI.loaded) {
      VI.loaded = true;
      viLoadGrid().catch(function (e) { flash('Chargement vivier impossible : ' + errMsg(e), 'err'); });
    }
  }

  // Listeners onglets
  $('tab-fonctions').addEventListener('click', function () { showTab('fonctions'); });
  $('tab-vivier').addEventListener('click', function () { showTab('vivier'); });

  // Listeners Fonctions
  $('fnAddBtn').addEventListener('click', fnAdd);
  $('fnHistChk').addEventListener('change', fnRenderList);

  // Listeners Vivier (la sélection d'entente se fait par clic sur une vignette,
  // câblé dans viLoadGrid)
  $('viAddBtn').addEventListener('click', viAdd);

  // Déconnexion
  SupabaseHub.onAuthChange(function (event) {
    if (event === 'SIGNED_OUT') window.location.replace('login.html');
  });

  // Onglet par défaut : Fonctions (charge sa grille au boot).
  showTab('fonctions');
})();
