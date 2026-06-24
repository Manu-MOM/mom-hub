/**
 * MOM Hub · Sélecteur de catégorie active (helper UI factorisé)
 * ============================================================
 *
 * Rend un sélecteur de catégorie réutilisable par les écrans
 * « catégorie-portés » (Joueurs, Séance, Compositions, Pilotage),
 * en consommant le socle central SupabaseHub (v1.59+) :
 *   - resoudrePerimetreCategories() → {categories, transverse, active, vide}
 *   - memoriserCategorieActive(catId)
 *
 * La clé localStorage (mom_hub.categorie_active) est gérée par le
 * socle → cohérence inter-écrans gratuite (même catégorie active
 * partagée avec Évènements et les autres écrans).
 *
 * Ce module factorise UNIQUEMENT le rendu + le câblage du sélecteur.
 * La mécanique de référence est celle d'evenements-browser.js v1.62
 * (_monterSelecteurCategorie / handler change), répliquée ici sous
 * forme générique. Évènements n'est PAS recâblé (son sélecteur reste
 * inline) — ce module est le standard pour les écrans suivants.
 *
 * RÈGLE D'AFFICHAGE (cohérente Évènements) :
 *   - périmètre non résolu / vide / transverse (admin/bureau) → PAS
 *     de sélecteur (l'écran reste centré sur la catégorie/équipe
 *     par défaut, dégradation honnête).
 *   - 1 seule catégorie (encadrant mono-cat) → PAS de sélecteur
 *     (UX inchangée).
 *   - > 1 catégorie → sélecteur monté.
 *
 * USAGE depuis un écran :
 *
 *   const ctx = await UXSelecteurCategorie.resoudre();
 *   // ctx = {perimetre, active} | null si socle absent
 *   ...
 *   UXSelecteurCategorie.monter({
 *     perimetre: ctx.perimetre,
 *     ancreSelector: '.joueur-header',     // élément après lequel insérer
 *     teamSpanSelector: '.joueur-header h2 .joueur-team', // maj libellé (option)
 *     wrapId: 'joueur-cat-selecteur-wrap', // id unique anti-doublon
 *     selectId: 'joueur-cat-selecteur',
 *     onChange: async (nouvelleCatId) => { ... recharger ... }
 *   });
 *
 * Le module NE résout PAS les équipes (chaque écran a sa propre
 * logique équipe : agrégation pour Joueurs, équipe unique/sélecteur
 * pour Séance/Compos). Il fournit la catégorie active ; l'écran en
 * dérive ses équipes via SupabaseHub.listEquipes(catId).
 */
(function () {
  'use strict';

  /**
   * Résout le périmètre de catégories via le socle.
   * @returns {Promise<{perimetre, active}|null>} null si socle absent/ancien.
   */
  async function resoudre() {
    if (typeof SupabaseHub === 'undefined'
        || typeof SupabaseHub.resoudrePerimetreCategories !== 'function') {
      return null;
    }
    let perimetre;
    try {
      perimetre = await SupabaseHub.resoudrePerimetreCategories();
    } catch (e) {
      console.warn('UXSelecteurCategorie: périmètre indisponible.', e);
      return null;
    }
    if (!perimetre) return null;
    return { perimetre: perimetre, active: perimetre.active };
  }

  /**
   * Libellé court de la catégorie active (pour maj titre).
   * @returns {string|null}
   */
  function libelleActif(perimetre) {
    if (!perimetre || !Array.isArray(perimetre.categories)) return null;
    if (perimetre.transverse) return null;
    const c = perimetre.categories.find(function (x) { return x.id === perimetre.active; });
    return c ? (c.libelle_court || c.code || null) : null;
  }

  /**
   * Met à jour le span de libellé d'équipe/catégorie dans le header.
   * Repli silencieux si introuvable (libellé en dur conservé).
   */
  function _majTitre(perimetre, teamSpanSelector, titreDocument) {
    const lib = libelleActif(perimetre);
    if (!lib) return; // transverse ou non résolu → titre en dur conservé
    if (teamSpanSelector) {
      const span = document.querySelector(teamSpanSelector);
      if (span) span.textContent = lib;
    }
    if (titreDocument) {
      try { document.title = titreDocument + ' ' + lib; } catch (e) { /* honnête */ }
    }
  }

  /**
   * Monte le sélecteur SI le périmètre compte > 1 catégorie.
   * Mono-catégorie / transverse / non résolu → rien (UX inchangée).
   *
   * @param {Object} opts
   * @param {Object} opts.perimetre        — {categories, transverse, active, vide}
   * @param {string} opts.ancreSelector    — élément après lequel insérer le sélecteur
   * @param {string} [opts.teamSpanSelector] — span dont on remplace le libellé à chaque changement
   * @param {string} [opts.titreDocument]  — préfixe du document.title (ex. 'MOM Hub · Joueurs')
   * @param {string} opts.wrapId           — id unique du wrapper (anti-doublon)
   * @param {string} opts.selectId         — id du <select>
   * @param {Function} opts.onChange       — async (nouvelleCatId) => {} : rechargement de l'écran
   * @returns {boolean} true si monté, false sinon.
   */
  function monter(opts) {
    opts = opts || {};
    const perimetre = opts.perimetre;
    if (!perimetre || !Array.isArray(perimetre.categories)) return false;
    if (perimetre.transverse) return false;
    if (perimetre.categories.length <= 1) return false;

    const ancre = document.querySelector(opts.ancreSelector);
    if (!ancre || !ancre.parentNode) return false;

    const wrapId = opts.wrapId || 'mom-cat-selecteur-wrap';
    if (document.getElementById(wrapId)) return false; // anti-doublon

    // Maj initiale du titre sur la catégorie active.
    _majTitre(perimetre, opts.teamSpanSelector, opts.titreDocument);

    const wrap = document.createElement('div');
    wrap.id = wrapId;
    wrap.style.cssText = 'display:flex; align-items:center; gap:8px; margin:0 0 14px 0; ' +
      'font-family:\'JetBrains Mono\',monospace; font-size:10px; letter-spacing:0.10em; ' +
      'text-transform:uppercase; color:var(--ink-mute);';

    const selectId = opts.selectId || 'mom-cat-selecteur';
    const label = document.createElement('label');
    label.setAttribute('for', selectId);
    label.textContent = 'Catégorie :';
    label.style.cssText = 'flex-shrink:0;';

    const select = document.createElement('select');
    select.id = selectId;
    select.style.cssText = 'padding:6px 10px; border:1px solid var(--line); border-radius:6px; ' +
      'background:var(--paper-warm); color:var(--ink); font-family:inherit; font-size:11px; ' +
      'letter-spacing:0.06em; cursor:pointer;';

    perimetre.categories.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.libelle_court || c.code || c.id;
      if (c.id === perimetre.active) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', async function () {
      const nouvelleCat = this.value;
      if (!nouvelleCat || nouvelleCat === perimetre.active) return;
      perimetre.active = nouvelleCat;
      if (typeof SupabaseHub !== 'undefined'
          && typeof SupabaseHub.memoriserCategorieActive === 'function') {
        SupabaseHub.memoriserCategorieActive(nouvelleCat);
      }
      _majTitre(perimetre, opts.teamSpanSelector, opts.titreDocument);
      select.disabled = true;
      try {
        if (typeof opts.onChange === 'function') {
          await opts.onChange(nouvelleCat);
        }
      } catch (e) {
        console.error('UXSelecteurCategorie: rechargement après changement échoué', e);
      } finally {
        select.disabled = false;
      }
    });

    wrap.appendChild(label);
    wrap.appendChild(select);
    ancre.parentNode.insertBefore(wrap, ancre.nextSibling);
    return true;
  }

  window.UXSelecteurCategorie = {
    resoudre: resoudre,
    libelleActif: libelleActif,
    monter: monter
  };

  console.log('🏉 MOM Hub · UX Sélecteur Catégorie v1.0 chargé');
})();
