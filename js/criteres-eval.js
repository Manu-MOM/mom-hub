/* =====================================================================
 * criteres-eval.js — Référentiel des critères d'évaluation (MOM Hub)
 * ---------------------------------------------------------------------
 * Version : v1.0 — 22 novembre 2026 — EVAL-JOUEUR Avenant C, lot C3
 *   FAIT FOI Conception-EVAL-JOUEUR-v1.md §11 (D29–D44, gelé le
 *   22/11/2026), sql_286, data/criteres-eval.json v1.1.
 *
 * OBJET
 *   Lecture partagée du référentiel data/criteres-eval.json par les pages
 *   staff (évaluation joueur, évals match, récap) et l'espace joueur :
 *     - les 6 critères (clé = colonne feu_<cle> en base), libellé et
 *       rappel de la ressource FFR (D29, D30) ;
 *     - les sous-critères « à travailler » d'un critère (D33), avec, pour
 *       « Technique au poste », la liste de la famille de postes + Buteur
 *       (D35) et les masquages par catégorie (D37, D44) ;
 *     - la famille d'un code de poste de compo (D36) ;
 *     - le seuil et les messages d'alerte non bloquants (D34).
 *
 * DÉGRADATION
 *   Si le fichier ne se charge pas, les 6 critères restent affichés
 *   (libellés de repli ci-dessous) sans sous-critères ni familles.
 *
 * Aucune dépendance. Expose window.CriteresEval.
 * ===================================================================== */
(function () {
  'use strict';

  var URL_REF = 'data/criteres-eval.json';

  // Repli si le référentiel est indisponible (mêmes clés, mêmes libellés).
  var REPLI = [
    { cle: 'tech_indiv', libelle: 'Technique', ressource_ffr: 'Ressources techniques', sous_criteres: [] },
    { cle: 'physique', libelle: 'Physique', ressource_ffr: 'Ressources physiques', sous_criteres: [] },
    { cle: 'comprehension', libelle: 'Lecture du jeu', ressource_ffr: 'Ressources perceptives et décisionnelles', sous_criteres: [] },
    { cle: 'etat_esprit', libelle: 'Engagement & collectif', ressource_ffr: 'Ressources affectives et relationnelles', sous_criteres: [] },
    { cle: 'mental', libelle: 'Mental', ressource_ffr: 'Habiletés mentales', sous_criteres: [] },
    { cle: 'tech_poste', libelle: 'Technique au poste', ressource_ffr: 'Ressources techniques — spécialisation au poste', sous_criteres: [] }
  ];

  var ref = null;        // contenu du JSON, ou null si non chargé
  var promesse = null;

  function charger() {
    if (promesse) return promesse;
    promesse = fetch(URL_REF, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { ref = d; return true; })
      .catch(function (e) { console.error('MOM Hub: criteres-eval.json', e); ref = null; return false; });
    return promesse;
  }

  function criteres() {
    var l = ref && Array.isArray(ref.criteres) ? ref.criteres.slice() : REPLI.slice();
    l.sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    return l.map(function (c) { return { cle: c.cle, nom: c.libelle, ffr: c.ressource_ffr }; });
  }

  function familles() {
    return ref && ref.poste && Array.isArray(ref.poste.familles)
      ? ref.poste.familles.map(function (f) { return { code: f.code, nom: f.libelle }; }) : [];
  }

  function familleDe(code) {
    if (!ref || !ref.poste) return null;
    var l = ref.poste.familles || [];
    for (var i = 0; i < l.length; i++) { if (l[i].code === code) return l[i]; }
    return null;
  }

  /** Famille de postes d'un code de poste de compo (PG, DO, …), ou null. */
  function familleDuPoste(codePoste) {
    if (!codePoste || !ref || !ref.poste) return null;
    var l = ref.poste.familles || [];
    for (var i = 0; i < l.length; i++) {
      if ((l[i].postes_codes || []).indexOf(codePoste) >= 0) return l[i].code;
    }
    return null;
  }

  function libelleFamille(code) {
    var f = familleDe(code);
    return f ? f.libelle : '';
  }

  function visible(s, categorie) {
    return !categorie || !Array.isArray(s.categories_masquees) || s.categories_masquees.indexOf(categorie) < 0;
  }

  /** La catégorie n'a pas de sous-critères « Technique au poste » (D44). */
  function sansSousCriteresPoste(categorie) {
    var l = ref && ref.poste && ref.poste.categories_sans_sous_criteres;
    return !!(categorie && Array.isArray(l) && l.indexOf(categorie) >= 0);
  }

  /**
   * Sous-critères proposés pour un critère : [{ code, libelle }].
   * opts = { famille: code de famille (critère tech_poste), categorie: code (M12…) }.
   * Pour tech_poste sans famille connue : seulement Buteur (s'il est visible).
   */
  function sousCriteres(cle, opts) {
    opts = opts || {};
    if (!ref) return [];
    if (cle === 'tech_poste') {
      if (sansSousCriteresPoste(opts.categorie)) return [];
      var f = familleDe(opts.famille);
      var l = f ? (f.sous_criteres || []).filter(function (s) { return visible(s, opts.categorie); }) : [];
      var b = ref.poste && ref.poste.buteur;
      if (b && visible(b, opts.categorie)) l = l.concat([b]);
      return l.map(function (s) { return { code: s.code, libelle: s.libelle }; });
    }
    var c = (ref.criteres || []).filter(function (x) { return x.cle === cle; })[0];
    return c ? (c.sous_criteres || []).filter(function (s) { return visible(s, opts.categorie); })
      .map(function (s) { return { code: s.code, libelle: s.libelle }; }) : [];
  }

  /** Libellé d'un code enregistré (toutes familles confondues ; le code sinon). */
  function libelle(cle, code) {
    if (!ref) return code;
    var listes = [];
    if (cle === 'tech_poste') {
      (ref.poste && ref.poste.familles || []).forEach(function (f) { listes.push(f.sous_criteres || []); });
      if (ref.poste && ref.poste.buteur) listes.push([ref.poste.buteur]);
    } else {
      (ref.criteres || []).forEach(function (c) { if (c.cle === cle) listes.push(c.sous_criteres || []); });
    }
    for (var i = 0; i < listes.length; i++) {
      for (var j = 0; j < listes[i].length; j++) { if (listes[i][j].code === code) return listes[i][j].libelle; }
    }
    return code;
  }

  function seuil() {
    var n = ref && Number(ref.seuil_alerte);
    return n && n > 0 ? n : 3;
  }

  /** Message d'alerte non bloquant (D34) ; qui = 'coach' | 'joueur'. */
  function messageAlerte(qui, n) {
    var m = ref && ref.messages_alerte && ref.messages_alerte[qui];
    if (!m) {
      m = qui === 'joueur'
        ? 'Tu as coché {n} points. Choisis ceux qui comptent le plus pour toi, ce sera plus facile à travailler.'
        : '{n} points à travailler sur ce critère. Pour que le joueur s’y retrouve, mieux vaut en garder 1 ou 2 prioritaires.';
    }
    return m.replace('{n}', String(n));
  }

  /** Libellés des résultats d'objectifs (D41). */
  function resultatsObjectifs() {
    return ref && Array.isArray(ref.resultats_objectifs) ? ref.resultats_objectifs.slice()
      : [{ code: 'atteint', libelle: 'Atteint' }, { code: 'en_partie', libelle: 'En partie' }, { code: 'pas_atteint', libelle: 'Pas atteint' }];
  }

  function estCharge() { return !!ref; }

  window.CriteresEval = {
    charger: charger,
    estCharge: estCharge,
    criteres: criteres,
    familles: familles,
    familleDuPoste: familleDuPoste,
    libelleFamille: libelleFamille,
    sansSousCriteresPoste: sansSousCriteresPoste,
    sousCriteres: sousCriteres,
    libelle: libelle,
    seuil: seuil,
    messageAlerte: messageAlerte,
    resultatsObjectifs: resultatsObjectifs
  };
})();
