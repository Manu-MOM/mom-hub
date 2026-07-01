/* =====================================================================
 * season-pill.js — Pastille de saison dynamique (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.0 — 1er juillet 2026
 *
 * OBJET
 *   Remplit dynamiquement l'affichage de la saison sur toutes les pages
 *   du Hub, à partir de la saison ACTIVE en base (saisons.est_active).
 *   Corrige le libellé « SAISON 2025 / 2026 » figé en dur dans 17 pages
 *   (écrit à la création des pages, jamais mis à jour après une bascule).
 *
 * POURQUOI UN FICHIER PARTAGÉ
 *   Il n'existe pas de topbar partagée : chaque page avait sa pastille en
 *   dur. Ce script centralise la logique une fois pour toutes. Une bascule
 *   de saison future se reflétera automatiquement, sans retoucher le HTML.
 *
 * CIBLAGE (par CLASSE, pas par id)
 *   Les id divergent (season-pill / asn-season-pill / ae-season-pill) et
 *   6 pages n'ont aucun id. On cible donc TOUS les éléments .season-pill,
 *   ce qui couvre les 17 pages avec une seule logique.
 *   En plus : deux métas d'en-tête connues portent la saison dans un
 *   libellé composite (« SAISON 2025-2026 · … ») : #joueur-header-meta
 *   (joueurs.html) et #evt-header-meta (evenements.html). On y remplace
 *   uniquement la portion année, en préservant le suffixe.
 *
 * SOURCE DE VÉRITÉ
 *   SupabaseHub.getSaisonActive() -> objet saison { code, libelle, ... }
 *   code attendu : « 2026/2027 ». On reconstruit « SAISON 2026 / 2027 ».
 *
 * ROBUSTESSE
 *   - N'attend aucune dépendance autre que SupabaseHub (déjà chargé avant).
 *   - try/catch total : en cas d'erreur (offline, non connecté), on NE
 *     casse rien — la pastille garde son texte HTML existant.
 *   - Aucun accès localStorage/sessionStorage.
 * ===================================================================== */
(function () {
  'use strict';

  /* « 2026/2027 » -> « SAISON 2026 / 2027 » (format long, comme l'ancien). */
  function pillLong(code) {
    var m = String(code || '').match(/(\d{4})\D+(\d{4})/);
    if (!m) return null;
    return 'SAISON ' + m[1] + ' / ' + m[2];
  }

  /* « 2026/2027 » -> « 2026-2027 » (format des métas composites). */
  function anneeTiret(code) {
    var m = String(code || '').match(/(\d{4})\D+(\d{4})/);
    if (!m) return null;
    return m[1] + '-' + m[2];
  }

  function appliquer(saison) {
    if (!saison || !saison.code) return;

    var texteLong = pillLong(saison.code);
    var texteTiret = anneeTiret(saison.code);

    /* 1) Toutes les pastilles .season-pill (couvre les 3 familles d'id). */
    if (texteLong) {
      var pills = document.querySelectorAll('.season-pill');
      for (var i = 0; i < pills.length; i++) {
        pills[i].textContent = texteLong;
      }
    }

    /* 2) Métas d'en-tête composites : format « SAISON <année> · <suffixe> ».
     *    On reconstruit la portion saison quelle que soit sa valeur actuelle
     *    (« 2025-2026 », « … », ou déjà « 2026-2027 »), en préservant le
     *    suffixe après le séparateur « · ». Robuste au texte laissé en HTML. */
    if (texteTiret) {
      var metas = ['joueur-header-meta', 'evt-header-meta'];
      for (var j = 0; j < metas.length; j++) {
        var el = document.getElementById(metas[j]);
        if (!el || !el.textContent) continue;
        var txt = el.textContent;
        var sep = txt.indexOf('·');
        if (sep !== -1) {
          /* garde tout ce qui suit le séparateur (suffixe + espaces) */
          el.textContent = 'SAISON ' + texteTiret + ' ' + txt.slice(sep);
        } else {
          /* pas de séparateur : on remplace juste la portion année si présente */
          el.textContent = txt.replace(/20\d{2}\s*[-/]\s*20\d{2}|…/, texteTiret);
        }
      }
    }
  }

  function init() {
    try {
      if (typeof SupabaseHub === 'undefined' ||
          typeof SupabaseHub.getSaisonActive !== 'function') {
        return; /* client non disponible : on laisse le HTML tel quel */
      }
      SupabaseHub.getSaisonActive()
        .then(function (saison) { appliquer(saison); })
        .catch(function () { /* silencieux : ne jamais casser le boot */ });
    } catch (e) {
      /* silencieux */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
