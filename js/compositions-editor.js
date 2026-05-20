/**
 * MOM Hub · Compositions Editor
 * ============================================================
 *
 * Phase 4.4 — Construit progressivement :
 *   - 6a/6b/6c-1 : déjà livrés (squelette, navigation, vivier)
 *   - 6c-2/6c-3 : Vue Liste éditable + Popover Picker (CETTE VERSION)
 *
 * Version : 3.9 — Étape (c) U-N3 garde anti-concurrence (20 mai 2026)
 *   v3.9 : FIX double-clic CTA « Créer la compo de base » détecté à
 *           la recette terrain Manu 20/05. Symptôme : 2 clics rapides
 *           déclenchent 2 INSERT concurrents → 2ᵉ refusé par sql/50
 *           (index unique partiel idx_compositions_active_base_per_
 *           event_equipe_cote) → alert remontée à l'écran (« duplicate
 *           key value violates unique constraint »). État base sain
 *           (l'index a fait son travail, P4 honnête) ; UX dégradée
 *           (friction sur le terrain). Cause racine : la garde
 *           btn.disabled=true v3.7 ne protège pas si (a) deux clics
 *           sont émis avant que le DOM ait propagé l'état, ou (b) le
 *           bouton est re-rendu entre les deux. Le fait a tranché —
 *           recette Manu : « 1 peut-être 2 clics... pas sûr et
 *           certain » + sonde base = 1 ligne créée + 1 erreur =
 *           hypothèse double-clic confirmée par la cohérence des
 *           faits. FIX : garde State.isCreatingBase + try/finally
 *           (patron anti-double-submit propre) — si la fonction est
 *           ré-entrée concurremment, le 2ᵉ appel retourne
 *           instantanément. Compatible legacy ET U-N3 (la garde est
 *           au niveau du flux, pas du mode). Aucun retry automatique
 *           (anti-mutation silencieuse) : le clic unique correctement
 *           garde-foué suffit. Modif bornée : version + changelog +
 *           1 champ State + refonte onCreateBaseClick (try/finally).
 *           Aucune autre fonction touchée ; aucun comportement
 *           legacy modifié hors flux protégé. node --check OK.
 *           Chaîne md5 v3.7 18733c08 → v3.8 63a62d73 → v3.9.
 *
 * Version : 3.8 — Étape (c) U-N3 (20 mai 2026)
 *   v3.8 : Extension Façon 1 « éditeur étendu pas dupliqué » — bascule
 *           par paramètre d'URL ?evenement_equipe=<uuid> (SD-1 actée
 *           20/05). Param absent = comportement legacy STRICTEMENT
 *           inchangé (mode mono-équipe M14 hard-codé), preuve par diff
 *           vs md5 18733c08 : tous les chemins legacy tombent dans
 *           l'else du dispatch et restent byte-identiques. Param
 *           présent = mode U-N3 :
 *           - UN3-1 pioche = groupe N2 de l'équipe engagée
 *             (listGroupeEngage déployé v1.22+)
 *           - création base = geste explicite via CTA existant
 *             (btn-create-base réutilisé), createCompo passe
 *             evenement_equipe_id (v1.27 prête, addition pure
 *             rétro-compat)
 *           - UN3-3/4/5 repli hors-groupe : toggle persistant dans
 *             le panneau effectif (calque pattern existant
 *             effectif-filter-sar) → pioche élargie via
 *             listJoueursCategorieEntente, joueurs hors-groupe
 *             marqués `_horsGroupe=true` en mémoire, placés avec
 *             `est_depannage_hors_categorie=true` (champ EXISTANT
 *             sql/18, exposé non inventé). UI : visuel orange.
 *             Jamais bloquant (P4).
 *           - UN3-6 frontière joueur/staff tenue : pioche N2 filtre
 *             role='joueur' (le staff convoqué ne joue pas)
 *           - A1 sélecteur d'évènement masqué en mode U-N3
 *             (l'évènement est fixé par l'URL ; retour à la fiche
 *             pour changer)
 *           - B1 onglets matchs filtrés par equipe engagée
 *             (compos rattachées via evenement_equipe_id pour la
 *             base, puis matchs dérivés via compo_base_origine_id
 *             === base.id — option A pure Q1a)
 *           - bannière enrichie : libellé court de l'équipe affiché
 *             à côté du libellé évènement (3 dimensions évènement /
 *             équipe / état de compo)
 *           Décisions actées 20/05 conv (c) : Q1a option A pure
 *           (matchs ne portent pas evenement_equipe_id, dérivent via
 *           compo_base_origine_id) ; Q2a N matchs actifs simultanés
 *           multi-équipes ; Q3b sql/50 deux index unique partiels
 *           (NULLS NOT DISTINCT bases / par base matchs) ; Q4a
 *           création base via CTA existant (jamais à la volée).
 *           Modèle Collectif v1.1 §3-4 + UX §3 FAIT FOI, non rouverts.
 *           Hors périmètre intentionnel : NB_TITULAIRES_XV=15 reste
 *           hard-codé (Partie B format adaptatif XV/X/7/13 = chantier
 *           distinct tracé v3.7) ; console.log boot v3.6 NON touché
 *           (incohérence préexistante v3.6 ≠ header v3.7, hors
 *           périmètre, pendant à console.log v1.16 supabase-client).
 *           Wrappers v1.27 utilisés : createCompo étendu,
 *           listGroupeEngage, getCompoForEvenementEquipe,
 *           getEvenementEquipeContext, listJoueursCategorieEntente
 *           (tous déjà déployés). Aucune nouvelle RPC ; aucune
 *           mutation modèle ; addition pure prouvée par diff.
 *
 * Version : 3.7 — Phase 4.4 étape 6c-2/6c-3 (18 mai 2026)
 *   v3.7 : Fix « 20 slots titulaires au lieu de 15 » (P2 Partie A).
 *           loadPostes() exclut désormais les lignes
 *           est_regroupement=true (PIL/2L/3L/CTR/AIL = regroupements
 *           tactiques, jamais des positions). La table postes contient
 *           20 lignes (15 réelles + 5 regroupements) ; l'hypothèse
 *           codée v3.1 « la table n'a que les 15 XV » était périmée.
 *           Source-safe, aucun arbitrage : le booléen est_regroupement
 *           est porté par la table (dump vérifié). NB : le compte/liste
 *           pilotés par le format réel de la rencontre (XV/X/7/13) =
 *           Partie B, séparée (dépend de l'exposition de format_de_jeu
 *           par la RPC get_evenements_a_venir — non traitée ici).
 *
 * Version : 3.6 — Phase 4.4 étape 6c-2/6c-3 (18 mai 2026)
 *   v3.6 : Bouton « Retour aux évènements » dans la bannière, affiché
 *           une fois la compo de base au moins validée (validee /
 *           utilisee / archivee). Navigation simple vers evenements.html,
 *           SANS paramètre : un retour ciblé sur la rencontre relèverait
 *           d'une convention d'URL côté Évènements (dette
 *           SUIVI-COACH-deeplink, autre module/conv). Zéro couplage.
 *
 * Version : 3.5 — Phase 4.4 étape 6c-2/6c-3 (18 mai 2026)
 *   v3.5 : Action de validation de la compo dans la bannière.
 *           - Bouton "Valider la compo" (etat brouillon) / "Repasser en
 *             brouillon" (etat validee), adossé aux wrappers DÉJÀ déployés
 *             SupabaseHub.validateCompo / unvalidateCompo (garde-fou
 *             serveur .eq('etat',...), aucune règle dupliquée côté client)
 *           - Cible = compo de base (type_compo==='base'), exactement la
 *             compo que la bannière d'état reflète déjà (renderEventBanner) :
 *             pill et bouton restent toujours cohérents
 *           - Pas de gate de complétude (le "X/15" reste informatif) ;
 *             réversibilité offerte ; AUCUNE mention du Suivi/PI-7 ici
 *             (doctrine interconnexion : zéro couplage module→module)
 *
 * Version : 3.4 — Phase 4.4 étape 6c-2/6c-3 (13 mai 2026)
 *   v3.0 : Vue Liste + Popover Picker
 *   v3.1 : Fix mapping colonnes table postes Supabase :
 *           - poste.uuid → poste.id
 *           - poste.numero_maillot → poste.numero_xv
 *           - retrait du filtre formats_applicables (la table n'a que les 15 XV)
 *   v3.2 : Fix lecture nom/prenom joueur :
 *           - cj.personnes est null car RLS bloque la jointure depuis
 *             composition_joueurs vers personnes
 *           - lookup direct dans State.vivierById qui passe par la RPC
 *             get_vivier_compo (SECURITY DEFINER) → RLS-safe
 *   v3.3 : Fix warning catégorie sur tous les joueurs :
 *           - M14_CATEGORIE_ID était 'cat-m14' (slug imaginaire) au lieu
 *             de l'UUID réel de la catégorie M14 → tous les joueurs étaient
 *             marqués hors-M14
 *           - Remplacement par l'UUID réel 312ebb88-25e8-40c5-8a37-9dd2e3927e2e
 *           - En V1 M14, la RPC get_vivier_compo filtre déjà sur M14
 *             uniquement, donc le warning ne s'affichera jamais — c'est OK,
 *             le code reste prêt pour V2 multi-équipes
 *   v3.4 : Fix recherche popover à l'envers :
 *           - À chaque frappe, renderPopover() était appelé → re-render
 *             complet du popover → input détruit/recréé → curseur replacé
 *             en position 0 → "obi" tapé donnait "ibo" affiché
 *           - Refactor : extraction des items de liste dans 2 helpers
 *             (popoverListItemsSlotVide, popoverListItemsJoueurVivier)
 *           - Nouvelle fonction refreshPopoverList() qui met à jour
 *             uniquement le <ul class="popover__list"> + recâble les clics
 *           - Handler input remplace renderPopover() par refreshPopoverList()
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CONSTANTES + ÉTAT
  // ============================================================

  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';
  const M14_CATEGORIE_ID = '312ebb88-25e8-40c5-8a37-9dd2e3927e2e'; // UUID réel catégorie M14
  const NB_TITULAIRES_XV = 15;
  const NB_REMPLACANTS = 8;

  const State = {
    evenements: [],
    selectedEvenementId: null,
    compos: [],
    selectedCompoId: null,
    vivier: [],
    vivierById: new Map(),
    filtreHideSAR: false,
    postes: [],
    postesById: new Map(),
    compoJoueurs: [],
    popover: null,
    // ────────────────────────────────────────────────────────
    // v3.8 — état U-N3 (mode « éditeur étendu pas dupliqué »).
    // Tous les champs sont à valeur neutre (null/false/Set vide)
    // en mode legacy mono-équipe → les chemins legacy testent ce
    // flag en première ligne et tombent dans l'else byte-identique
    // au v3.7. Preuve de rétro-compat stricte par diff.
    // ────────────────────────────────────────────────────────
    evenementEquipeId: null,            // UUID si ?evenement_equipe=… (URL)
    evenementEquipeContext: null,       // résultat getEvenementEquipeContext
    includeHorsGroupe: false,           // toggle UN3-3 (repli hors-groupe)
    groupeIds: new Set(),               // cache personne_id du groupe N2
    // ────────────────────────────────────────────────────────
    // v3.9 — Garde anti-concurrence pour onCreateBaseClick.
    // false par défaut, basculé true pendant la création, restauré
    // par try/finally. Empêche un 2ᵉ clic rapide de déclencher un
    // INSERT concurrent (cf. fix recette terrain 20/05). Mode legacy
    // ET U-N3 protégés (le bug guettait aussi en legacy).
    // ────────────────────────────────────────────────────────
    isCreatingBase: false
  };

  // ============================================================
  // 2. SÉLECTEURS DOM
  // ============================================================

  const DOM = {
    eventBannerType:   () => document.getElementById('event-type'),
    eventBannerLabel:  () => document.getElementById('event-label'),
    eventBannerMeta:   () => document.getElementById('event-meta'),
    eventBannerState:  () => document.getElementById('event-state'),
    compoValidateHost: () => document.getElementById('compo-validate-host'),
    eventSelectorBtn:  () => document.getElementById('event-selector-btn'),
    eventSelectorList: () => document.getElementById('event-selector-list'),
    compoTabs:         () => document.getElementById('compo-tabs'),
    fillIndicator:     () => document.getElementById('fill-indicator'),
    editorArea:        () => document.getElementById('editor-area'),
    effectifTitle:     () => document.getElementById('effectif-title'),
    effectifFilter:    () => document.getElementById('effectif-filter-sar'),
    effectifBody:      () => document.getElementById('effectif-panel-body'),
    popoverRoot:       () => document.getElementById('popover-root')
  };

  // ============================================================
  // 3. HELPERS
  // ============================================================

  function formatDateLong(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const mois  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  }
  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const jours = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
    const mois  = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()];
  }
  function libelleTypeEvenement(type) {
    if (type === 'entrainement')         return 'Entraînement';
    if (type === 'match')                return 'Match';
    if (type === 'journee_championnat')  return 'Match';
    if (type === 'tournoi')              return 'Tournoi';
    if (type === 'stage')                return 'Stage';
    return type || 'Événement';
  }
  function libelleEvenement(evt) {
    if (!evt) return '';
    if (evt.adversaire_nom) return 'vs ' + evt.adversaire_nom;
    return evt.libelle || evt.code || '';
  }
  function libelleEtatCompo(etat) {
    if (etat === 'brouillon') return 'Brouillon';
    if (etat === 'validee')   return 'Validée';
    if (etat === 'utilisee')  return 'Utilisée';
    if (etat === 'archivee')  return 'Archivée';
    return '';
  }
  function initiales(prenom, nom) {
    const p = (prenom || '').trim().charAt(0).toUpperCase();
    const n = (nom    || '').trim().charAt(0).toUpperCase();
    return (p + n) || '?';
  }
  function etiquetteJoueur(j) {
    if (j.f15_integree) return { label: 'F-15', kind: 'f15' };
    if (j.est_partenaire_entente) {
      const club = (j.club_principal_nom_court || '').toUpperCase();
      if (club === 'SAR' || club === 'ASCS') return { label: club, kind: 'partenaire' };
      return { label: 'Partenaire', kind: 'partenaire' };
    }
    if (j.statut_attache === 'renfort_temporaire') return { label: 'Renfort', kind: 'renfort' };
    return null;
  }
  function groupeJoueur(j) {
    if (j.est_partenaire_entente)                                  return 'partenaire';
    if (j.statut_attache === 'renfort_temporaire')                 return 'renfort';
    if (!j.statut_attache || j.statut_attache === 'en_transition') return 'autre';
    return 'mom';
  }
  function compareJoueurs(a, b) {
    const cmpN = (a.nom || '').localeCompare(b.nom || '', 'fr');
    if (cmpN !== 0) return cmpN;
    return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
  }
  function getPoste(posteId) { return State.postesById.get(posteId); }
  function getJoueurVivier(joueurId) { return State.vivierById.get(joueurId); }
  function joueursDejaPlaces() {
    const set = new Set();
    for (const cj of State.compoJoueurs) set.add(cj.joueur_id);
    return set;
  }
  function postesVides() {
    const occupes = new Set();
    for (const cj of State.compoJoueurs) if (cj.role === 'titulaire') occupes.add(cj.poste_id);
    return State.postes.filter(p => !occupes.has(p.id));
  }
  function joueurDuPoste(posteId) {
    return State.compoJoueurs.find(cj => cj.role === 'titulaire' && cj.poste_id === posteId);
  }
  function compteurs() {
    const titulaires = State.compoJoueurs.filter(cj => cj.role === 'titulaire').length;
    const remplacants = State.compoJoueurs.filter(cj => cj.role === 'remplacant').length;
    const modifs = State.compoJoueurs.filter(cj => cj.etat_joueur && cj.etat_joueur !== 'base').length;
    return { titulaires, remplacants, modifs };
  }
  function cssClassEtatJoueur(etat) { return 'etat-' + (etat || 'base'); }
  function libelleEtatJoueurCourt(etat) {
    if (etat === 'base')        return 'Base';
    if (etat === 'modifie')     return 'Modifié';
    if (etat === 'independant') return 'Indép.';
    if (etat === 'blesse')      return 'Blessé';
    return '';
  }
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ============================================================
  // 4. RENDUS — banner, sélecteur, onglets, indicateur
  // ============================================================

  function renderEventBanner() {
    const evt = State.evenements.find(e => e.id === State.selectedEvenementId);
    if (!evt) {
      DOM.eventBannerType().textContent  = '—';
      DOM.eventBannerLabel().textContent = 'Aucun événement à venir';
      DOM.eventBannerMeta().textContent  = '';
      DOM.eventBannerState().textContent = '';
      DOM.eventBannerState().className   = 'event-banner__state';
      return;
    }
    DOM.eventBannerType().textContent  = libelleTypeEvenement(evt.type_evenement);
    // v3.8 — en mode U-N3, le libellé court de l'équipe engagée
    // s'ajoute discrètement après la date pour clarifier qu'on édite
    // la feuille d'UNE équipe précise (3 dimensions évènement / équipe
    // / état). En legacy : libellé strictement inchangé (preuve diff).
    let labelText = libelleEvenement(evt) + ' · ' + formatDateLong(evt.date_debut);
    if (State.evenementEquipeId && State.evenementEquipeContext &&
        State.evenementEquipeContext.equipe) {
      const eqLabel = State.evenementEquipeContext.equipe.libelle_court ||
                      State.evenementEquipeContext.equipe.nom_officiel ||
                      State.evenementEquipeContext.equipe.code || '';
      if (eqLabel) labelText += ' — ' + eqLabel;
    }
    DOM.eventBannerLabel().textContent = labelText;
    DOM.eventBannerMeta().textContent  = evt.site_libelle_court || '';

    const compoBase = State.compos.find(c => c.type_compo === 'base');
    const stateEl = DOM.eventBannerState();
    if (compoBase) {
      stateEl.textContent = libelleEtatCompo(compoBase.etat);
      stateEl.className   = 'event-banner__state state-' + compoBase.etat;
    } else {
      stateEl.textContent = 'Aucune compo';
      stateEl.className   = 'event-banner__state';
    }

    renderCompoValidation();
  }

  // Contrôle de validation de la compo (bannière).
  // Cible = compo de base : c'est la compo que le pill d'état ci-dessus
  // reflète déjà (compoBase), pill et bouton restent donc cohérents.
  // Aucune règle métier dupliquée ici : le garde-fou d'état vit côté
  // serveur dans validateCompo/unvalidateCompo (.eq('etat',...)).
  function renderCompoValidation() {
    const host = DOM.compoValidateHost();
    if (!host) return;
    host.innerHTML = '';

    const base = State.compos.find(c => c.type_compo === 'base');
    if (!base) return; // rien à valider tant qu'il n'y a pas de compo de base

    if (base.etat === 'brouillon') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'compo-validate-btn';
      b.textContent = 'Valider la compo';
      b.addEventListener('click', function () { onValidateCompoClick(base.id); });
      host.appendChild(b);
    } else if (base.etat === 'validee') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'compo-validate-btn compo-validate-btn--undo';
      b.textContent = 'Repasser en brouillon';
      b.addEventListener('click', function () { onUnvalidateCompoClick(base.id); });
      host.appendChild(b);
    }
    // 'utilisee' / 'archivee' : pas de bascule d'état (verrou aval, hors périmètre Compos)

    // v3.6 — une fois la compo au moins validée, raccourci de sortie vers
    // la liste des évènements. Navigation simple, SANS paramètre : un
    // retour ciblé sur la rencontre (refocus côté Évènements) suppose une
    // convention d'URL côté evenements.html — autre module, autre conv
    // (dette SUIVI-COACH-deeplink). Ici : zéro couplage, zéro invention.
    if (base.etat === 'validee' || base.etat === 'utilisee' || base.etat === 'archivee') {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'compo-validate-btn compo-validate-btn--back';
      back.textContent = 'Retour aux évènements';
      back.addEventListener('click', function () { window.location.href = 'evenements.html'; });
      host.appendChild(back);
    }
  }

  function renderEventSelector() {
    const list = DOM.eventSelectorList();
    if (!list) return;
    list.innerHTML = '';
    if (State.evenements.length === 0) {
      list.innerHTML = '<li class="event-selector__empty">Aucun événement à venir dans les 60 prochains jours</li>';
      return;
    }
    for (const evt of State.evenements) {
      const li = document.createElement('li');
      li.className = 'event-selector__item';
      if (evt.id === State.selectedEvenementId) li.classList.add('is-selected');
      li.innerHTML =
        '<span class="event-selector__date">' + formatDateShort(evt.date_debut) + '</span>' +
        '<span class="event-selector__type">' + libelleTypeEvenement(evt.type_evenement) + '</span>' +
        '<span class="event-selector__label">' + escapeHtml(libelleEvenement(evt)) + '</span>';
      li.addEventListener('click', function () { selectEvenement(evt.id); closeEventSelector(); });
      list.appendChild(li);
    }
  }

  function renderCompoTabs() {
    const container = DOM.compoTabs();
    if (!container) return;
    container.innerHTML = '';

    const compoBase = State.compos.find(c => c.type_compo === 'base');
    const baseTab = document.createElement('button');
    baseTab.type = 'button';
    baseTab.className = 'compo-tabs__tab';
    baseTab.textContent = 'Base';
    if (compoBase) {
      if (compoBase.id === State.selectedCompoId) baseTab.classList.add('is-active');
      baseTab.addEventListener('click', function () { selectCompo(compoBase.id); });
    } else {
      baseTab.classList.add('compo-tabs__tab--placeholder');
      baseTab.title = 'Aucune compo de base créée';
      baseTab.disabled = true;
    }
    container.appendChild(baseTab);

    const compoMatchs = State.compos.filter(c => c.type_compo === 'match')
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    for (const m of compoMatchs) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'compo-tabs__tab';
      if (m.id === State.selectedCompoId) tab.classList.add('is-active');
      tab.textContent = libelleEvenement(State.evenements.find(e => e.id === m.evenement_id)) || 'Match';
      tab.addEventListener('click', function () { selectCompo(m.id); });
      container.appendChild(tab);
    }

    const addTab = document.createElement('button');
    addTab.type = 'button';
    addTab.className = 'compo-tabs__tab compo-tabs__tab--add';
    addTab.textContent = '+';
    addTab.title = compoBase ? 'Créer une compo de match dérivée de la base' : "Crée d'abord une compo de base";
    addTab.disabled = !compoBase;
    addTab.addEventListener('click', function () { alert('Création de compo de match : à brancher en étape 6c-6'); });
    container.appendChild(addTab);
  }

  function renderFillIndicator() {
    const el = DOM.fillIndicator();
    if (!el) return;
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.className = 'fill-indicator';
      el.innerHTML = '<em style="color: var(--ink-mute);">Aucune composition sélectionnée</em>';
      return;
    }
    const c = compteurs();
    const ratio = c.titulaires / NB_TITULAIRES_XV;
    let colorClass = 'fill-low';
    if (ratio >= 0.9)      colorClass = 'fill-high';
    else if (ratio >= 0.6) colorClass = 'fill-mid';
    el.className = 'fill-indicator ' + colorClass;
    el.innerHTML =
      '<strong>' + c.titulaires + ' / ' + NB_TITULAIRES_XV + ' postes pourvus</strong>' +
      '&nbsp;·&nbsp; ' + c.remplacants + ' / ' + NB_REMPLACANTS + ' remplaçants' +
      (compo.type_compo === 'match' ? '&nbsp;·&nbsp; ' + c.modifs + ' modification' + (c.modifs > 1 ? 's' : '') + ' vs base' : '');
  }

  // ============================================================
  // 5. RENDU — Vue Liste (XV + Remplaçants)
  // ============================================================

  function renderEditorArea() {
    const el = DOM.editorArea();
    if (!el) return;

    if (!State.selectedEvenementId) {
      el.innerHTML = '<div class="editor-area__placeholder">Sélectionnez un événement pour commencer.</div>';
      return;
    }
    if (State.compos.length === 0) {
      el.innerHTML =
        '<div class="editor-area__empty">' +
          '<p class="editor-area__empty-title">Aucune composition créée pour cet événement.</p>' +
          '<p class="editor-area__empty-text">Commence par créer la compo de base (plan A, J-7).</p>' +
          '<button type="button" id="btn-create-base" class="editor-area__cta">Créer la compo de base</button>' +
        '</div>';
      const btn = document.getElementById('btn-create-base');
      if (btn) btn.addEventListener('click', onCreateBaseClick);
      return;
    }
    const compo = State.compos.find(c => c.id === State.selectedCompoId);
    if (!compo) {
      el.innerHTML = '<div class="editor-area__placeholder">Cliquez sur un onglet de composition pour l\'afficher.</div>';
      return;
    }

    let html = '<div class="view-liste">';
    html += '<section class="view-liste__section">';
    html +=   '<h3 class="view-liste__title">XV de départ</h3>';
    html +=   '<ul class="view-liste__slots">';
    for (const poste of State.postes) html += renderSlotPoste(poste);
    html +=   '</ul>';
    html += '</section>';

    const remplacants = State.compoJoueurs.filter(cj => cj.role === 'remplacant')
      .sort((a, b) => (a.ordre_remplacement || a.numero_maillot || 99) - (b.ordre_remplacement || b.numero_maillot || 99));
    html += '<section class="view-liste__section">';
    html +=   '<h3 class="view-liste__title">Remplaçants <span class="view-liste__count">(' + remplacants.length + '/' + NB_REMPLACANTS + ')</span></h3>';
    html +=   '<ul class="view-liste__slots view-liste__slots--remplacants">';
    for (let i = 0; i < NB_REMPLACANTS; i++) {
      html += renderSlotRemplacant(i + 16, remplacants[i]);
    }
    html +=   '</ul>';
    html += '</section>';
    html += '</div>';
    el.innerHTML = html;

    bindSlotHandlers();
  }

  // v3.2 : lookup joueur depuis State.vivierById (RLS-safe via RPC get_vivier_compo)
  function renderSlotPoste(poste) {
    const cj = joueurDuPoste(poste.id);
    if (!cj) {
      return (
        '<li class="slot slot--vide" data-poste-id="' + escapeHtml(poste.id) + '" data-role="titulaire">' +
          '<span class="slot__num">' + escapeHtml(poste.numero_xv || '') + '</span>' +
          '<span class="slot__poste-label">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
          '<span class="slot__add">+ Ajouter</span>' +
        '</li>'
      );
    }
    const j = getJoueurVivier(cj.joueur_id) || {};
    return (
      '<li class="slot slot--occupe ' + cssClassEtatJoueur(cj.etat_joueur) + '" data-compo-joueur-id="' + escapeHtml(cj.id) + '" data-poste-id="' + escapeHtml(poste.id) + '">' +
        '<span class="slot__num">' + escapeHtml(cj.numero_maillot != null ? cj.numero_maillot : poste.numero_xv || '') + '</span>' +
        '<span class="slot__poste-label">' + escapeHtml(poste.libelle_court || poste.code) + '</span>' +
        '<span class="slot__joueur">' +
          '<span class="slot__nom">' + escapeHtml(j.nom || '?') + '</span>' +
          '<span class="slot__prenom">' + escapeHtml(j.prenom || '') + '</span>' +
        '</span>' +
        (cj.est_depannage_hors_categorie ? '<span class="slot__warning" title="Joueur hors catégorie M14">⚠</span>' : '') +
        '<span class="slot__etat" title="État du joueur">' + libelleEtatJoueurCourt(cj.etat_joueur) + '</span>' +
        '<button class="slot__remove" title="Retirer ce joueur" type="button">×</button>' +
      '</li>'
    );
  }

  // v3.2 : idem
  function renderSlotRemplacant(numeroMaillot, cj) {
    if (!cj) {
      return (
        '<li class="slot slot--vide slot--remplacant" data-role="remplacant" data-numero-maillot="' + numeroMaillot + '">' +
          '<span class="slot__num">' + numeroMaillot + '</span>' +
          '<span class="slot__poste-label">Remp.</span>' +
          '<span class="slot__add">+ Ajouter</span>' +
        '</li>'
      );
    }
    const j = getJoueurVivier(cj.joueur_id) || {};
    return (
      '<li class="slot slot--occupe slot--remplacant ' + cssClassEtatJoueur(cj.etat_joueur) + '" data-compo-joueur-id="' + escapeHtml(cj.id) + '">' +
        '<span class="slot__num">' + escapeHtml(cj.numero_maillot || numeroMaillot) + '</span>' +
        '<span class="slot__poste-label">Remp.</span>' +
        '<span class="slot__joueur">' +
          '<span class="slot__nom">' + escapeHtml(j.nom || '?') + '</span>' +
          '<span class="slot__prenom">' + escapeHtml(j.prenom || '') + '</span>' +
        '</span>' +
        (cj.est_depannage_hors_categorie ? '<span class="slot__warning" title="Joueur hors catégorie M14">⚠</span>' : '') +
        '<span class="slot__etat">' + libelleEtatJoueurCourt(cj.etat_joueur) + '</span>' +
        '<button class="slot__remove" title="Retirer ce joueur" type="button">×</button>' +
      '</li>'
    );
  }

  function bindSlotHandlers() {
    document.querySelectorAll('.slot--vide').forEach(function (slot) {
      slot.addEventListener('click', function (e) {
        e.stopPropagation();
        const posteId = slot.dataset.posteId || null;
        const role    = slot.dataset.role || 'titulaire';
        const numero  = slot.dataset.numeroMaillot ? parseInt(slot.dataset.numeroMaillot, 10) : null;
        openPickerForSlot(posteId, role, numero);
      });
    });
    document.querySelectorAll('.slot--occupe .slot__remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const cjId = btn.closest('.slot').dataset.compoJoueurId;
        if (cjId) onRemoveJoueurClick(cjId);
      });
    });
  }

  // ============================================================
  // 6. PANNEAU EFFECTIF
  // ============================================================

  function renderEffectifPanel() {
    const titleEl = DOM.effectifTitle();
    const bodyEl  = DOM.effectifBody();
    if (!bodyEl) return;

    // ────────────────────────────────────────────────────────
    // v3.8 — Dispatch mode U-N3 vs legacy. En legacy, le bloc else
    // est byte-identique au code v3.7 (preuve par diff). En U-N3,
    // mapping différent (Joueurs du groupe / Hors groupe), toggle
    // UN3-3 et visuel orange UN3-4.
    // ────────────────────────────────────────────────────────
    if (State.evenementEquipeId) {
      let vivier = State.vivier;
      if (titleEl) titleEl.textContent = 'Effectif (' + vivier.length + ')';

      if (vivier.length === 0) {
        bodyEl.innerHTML =
          renderToggleHorsGroupeUN3() +
          '<div class="effectif-panel__placeholder"><em>Aucun joueur dans le groupe de base.</em></div>';
        bindToggleHorsGroupeUN3();
        return;
      }

      const placedIds = joueursDejaPlaces();
      const sectionGroupe = { label: 'Joueurs du groupe', items: [] };
      const sectionHors   = { label: 'Hors groupe (dépannage)', items: [] };
      for (const j of vivier) {
        if (j._horsGroupe) sectionHors.items.push(j); else sectionGroupe.items.push(j);
      }
      sectionGroupe.items.sort(compareJoueurs);
      sectionHors.items.sort(compareJoueurs);

      let html = renderToggleHorsGroupeUN3();
      const sections = [sectionGroupe];
      if (sectionHors.items.length > 0) sections.push(sectionHors);
      for (const g of sections) {
        if (g.items.length === 0) continue;
        const isHors = (g === sectionHors);
        html += '<div class="effectif-group">';
        html +=   '<h3 class="effectif-group__title">' + escapeHtml(g.label) +
                  ' <span class="effectif-group__count">(' + g.items.length + ')</span></h3>';
        html +=   '<ul class="effectif-list">';
        for (const j of g.items) {
          const isPlaced = placedIds.has(j.joueur_id);
          const tagHtml = isHors
            ? '<span class="effectif-item__tag effectif-item__tag--renfort" title="Joueur hors du groupe de base (dépannage)">hors groupe</span>'
            : '';
          html += '<li class="effectif-item' + (isPlaced ? ' effectif-item--placed' : '') + (isHors ? ' effectif-item--hors-groupe' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '" title="' + escapeHtml((j.prenom || '') + ' ' + (j.nom || '')) + (isPlaced ? ' — déjà dans la compo' : (isHors ? ' — hors du groupe de base (dépannage)' : '')) + '">';
          html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
          html +=   '<span class="effectif-item__name">';
          html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
          html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
          html +=   '</span>';
          html +=   tagHtml;
          html += '</li>';
        }
        html +=   '</ul>';
        html += '</div>';
      }
      bodyEl.innerHTML = html;
      bindToggleHorsGroupeUN3();

      document.querySelectorAll('.effectif-item').forEach(function (item) {
        if (item.classList.contains('effectif-item--placed')) return;
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          const joueurId = item.dataset.joueurId;
          if (joueurId) openPickerForJoueur(joueurId);
        });
      });
      return;
    }

    // ────────────────────────────────────────────────────────
    // Mode legacy — code v3.7 BYTE-IDENTIQUE (preuve par diff).
    // ────────────────────────────────────────────────────────
    let vivier = State.vivier;
    if (State.filtreHideSAR) vivier = vivier.filter(j => !j.est_partenaire_entente);
    if (titleEl) titleEl.textContent = 'Effectif (' + vivier.length + ')';

    if (vivier.length === 0) {
      bodyEl.innerHTML = '<div class="effectif-panel__placeholder"><em>Aucun joueur dans le vivier.</em></div>';
      return;
    }

    const placedIds = joueursDejaPlaces();
    const groupes = {
      mom:        { label: 'Réguliers MOM',        items: [] },
      partenaire: { label: 'Partenaires entente',  items: [] },
      renfort:    { label: 'Renforts temporaires', items: [] },
      autre:      { label: 'Non-attachés',         items: [] }
    };
    for (const j of vivier) groupes[groupeJoueur(j)].items.push(j);
    for (const k in groupes) groupes[k].items.sort(compareJoueurs);

    let html = '';
    for (const k of ['mom', 'partenaire', 'renfort', 'autre']) {
      const g = groupes[k];
      if (g.items.length === 0) continue;
      html += '<div class="effectif-group">';
      html +=   '<h3 class="effectif-group__title">' + g.label + ' <span class="effectif-group__count">(' + g.items.length + ')</span></h3>';
      html +=   '<ul class="effectif-list">';
      for (const j of g.items) {
        const isPlaced = placedIds.has(j.joueur_id);
        const etq = etiquetteJoueur(j);
        const tagHtml = etq ? '<span class="effectif-item__tag effectif-item__tag--' + etq.kind + '">' + etq.label + '</span>' : '';
        html += '<li class="effectif-item' + (isPlaced ? ' effectif-item--placed' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '" title="' + escapeHtml((j.prenom || '') + ' ' + (j.nom || '')) + (isPlaced ? ' — déjà dans la compo' : '') + '">';
        html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
        html +=   '<span class="effectif-item__name">';
        html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
        html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
        html +=   '</span>';
        html +=   tagHtml;
        html += '</li>';
      }
      html +=   '</ul>';
      html += '</div>';
    }
    bodyEl.innerHTML = html;

    document.querySelectorAll('.effectif-item').forEach(function (item) {
      if (item.classList.contains('effectif-item--placed')) return;
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        const joueurId = item.dataset.joueurId;
        if (joueurId) openPickerForJoueur(joueurId);
      });
    });
  }

  // v3.8 — Toggle UN3-3 : « Piocher hors du groupe de base ».
  // Calque exact du pattern existant pour effectif-filter-sar (CSS
  // classes effectif-panel__filter réutilisées). Rendu inline dans
  // le panneau effectif (pas de modif HTML compositions.html).
  // Annonce de la conséquence dans le label : « élargit la pioche
  // au-delà du groupe » → satisfait UX §3 UN3-3.
  function renderToggleHorsGroupeUN3() {
    return (
      '<label class="effectif-panel__filter" style="margin-bottom:8px;">' +
        '<input type="checkbox" id="un3-toggle-hors-groupe"' +
          (State.includeHorsGroupe ? ' checked' : '') + '>' +
        ' Piocher hors du groupe de base ' +
        '<span style="color: var(--ink-mute); font-size: 11px;">' +
          '(dépannage — élargit la pioche au-delà du groupe)' +
        '</span>' +
      '</label>'
    );
  }

  function bindToggleHorsGroupeUN3() {
    const t = document.getElementById('un3-toggle-hors-groupe');
    if (t) t.addEventListener('change', function (e) { toggleIncludeHorsGroupe(e.target.checked); });
  }

  // ============================================================
  // 7. POPOVER PICKER
  // ============================================================

  function openPickerForSlot(posteId, role, numeroMaillot) {
    if (!State.selectedCompoId) return;
    State.popover = { mode: 'slot-vide', posteId: posteId || null, role: role || 'titulaire', numeroMaillot: numeroMaillot || null, search: '' };
    renderPopover();
  }

  function openPickerForJoueur(joueurId) {
    if (!State.selectedCompoId) return;
    State.popover = { mode: 'joueur-vivier', joueurId: joueurId, search: '' };
    renderPopover();
  }

  function closePopover() {
    State.popover = null;
    renderPopover();
  }

  function renderPopover() {
    const root = DOM.popoverRoot();
    if (!root) return;
    if (!State.popover) { root.innerHTML = ''; root.classList.remove('is-open'); return; }

    if (State.popover.mode === 'slot-vide')      root.innerHTML = renderPopoverSlotVide();
    else if (State.popover.mode === 'joueur-vivier') root.innerHTML = renderPopoverJoueurVivier();
    root.classList.add('is-open');
    bindPopoverHandlers();
  }

  // v3.4 : helper extrait pour pouvoir rafraîchir uniquement la liste
  // sans détruire l'input search (évite l'effet "à l'envers")
  // v3.8 : en mode U-N3, le marquage warning bascule de « hors
  // catégorie M14 » (legacy, comparaison categorie_id) à « hors
  // groupe » (U-N3, lecture du flag _horsGroupe). Le mode legacy
  // reste byte-identique (branche else).
  function popoverListItemsSlotVide() {
    const pv = State.popover;
    const search = (pv.search || '').toLowerCase();
    const placedIds = joueursDejaPlaces();
    const candidates = State.vivier
      .filter(j => !placedIds.has(j.joueur_id))
      .filter(j => !search || ((j.nom || '') + ' ' + (j.prenom || '')).toLowerCase().includes(search))
      .sort(compareJoueurs);

    let html = '';
    if (candidates.length === 0) {
      html += '<li class="popover__empty">Aucun joueur disponible.</li>';
    } else {
      for (const j of candidates) {
        if (State.evenementEquipeId) {
          // U-N3 : warning = hors du groupe de base (dépannage)
          const horsGroupe = !!j._horsGroupe;
          html += '<li class="popover__item' + (horsGroupe ? ' popover__item--warning' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '">';
          html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
          html +=   '<span class="effectif-item__name">';
          html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
          html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
          html +=   '</span>';
          if (horsGroupe) {
            html += '<span class="effectif-item__tag effectif-item__tag--renfort" title="Joueur hors du groupe de base">hors groupe</span>';
            html += '<span class="popover__warning" title="Hors du groupe de base (dépannage)">⚠</span>';
          }
          html += '</li>';
        } else {
          // Legacy : warning = hors catégorie M14 (byte-identique v3.7)
          const horsCat = j.categorie_id !== M14_CATEGORIE_ID;
          const etq = etiquetteJoueur(j);
          const tagHtml = etq ? '<span class="effectif-item__tag effectif-item__tag--' + etq.kind + '">' + etq.label + '</span>' : '';
          html += '<li class="popover__item' + (horsCat ? ' popover__item--warning' : '') + '" data-joueur-id="' + escapeHtml(j.joueur_id) + '">';
          html +=   '<span class="effectif-item__avatar">' + escapeHtml(initiales(j.prenom, j.nom)) + '</span>';
          html +=   '<span class="effectif-item__name">';
          html +=     '<span class="effectif-item__nom">' + escapeHtml(j.nom || '?') + '</span>';
          html +=     '<span class="effectif-item__prenom">' + escapeHtml(j.prenom || '') + '</span>';
          html +=   '</span>';
          html +=   tagHtml;
          if (horsCat) html += '<span class="popover__warning" title="Hors catégorie M14 (dépannage)">⚠</span>';
          html += '</li>';
        }
      }
    }
    return html;
  }

  function renderPopoverSlotVide() {
    const pv = State.popover;
    let titre;
    if (pv.role === 'titulaire' && pv.posteId) {
      const poste = getPoste(pv.posteId);
      titre = poste ? ('Poste ' + poste.numero_xv + ' — ' + (poste.libelle_long || poste.libelle_court)) : 'Poste inconnu';
    } else {
      titre = 'Remplaçant n°' + (pv.numeroMaillot || '?');
    }

    let html = '<div class="popover" role="dialog" aria-label="Choisir un joueur">';
    html +=   '<div class="popover__header">';
    html +=     '<h3 class="popover__title">' + escapeHtml(titre) + '</h3>';
    html +=     '<button type="button" class="popover__close" data-action="close" aria-label="Fermer">×</button>';
    html +=   '</div>';
    html +=   '<div class="popover__search">';
    html +=     '<input type="text" class="popover__input" id="popover-search" placeholder="Rechercher un joueur…" value="' + escapeHtml(pv.search || '') + '" autocomplete="off">';
    html +=   '</div>';
    html +=   '<ul class="popover__list">';
    html +=     popoverListItemsSlotVide();
    html +=   '</ul>';
    html += '</div>';
    return html;
  }

  // v3.4 : helper extrait pour rafraîchissement ciblé (cf slot-vide)
  function popoverListItemsJoueurVivier() {
    const pv = State.popover;
    const search = (pv.search || '').toLowerCase();
    const postesLibres = postesVides().filter(p =>
      !search || (((p.libelle_long || '') + ' ' + (p.libelle_court || '') + ' ' + (p.code || '')).toLowerCase().includes(search))
    );

    let html = '';
    if (postesLibres.length === 0) {
      html += '<li class="popover__empty">Tous les postes XV sont déjà occupés.</li>';
    } else {
      for (const p of postesLibres) {
        html += '<li class="popover__item popover__item--poste" data-poste-id="' + escapeHtml(p.id) + '">';
        html +=   '<span class="slot__num">' + escapeHtml(p.numero_xv) + '</span>';
        html +=   '<span class="popover__poste-libelle">' + escapeHtml(p.libelle_long || p.libelle_court) + '</span>';
        html += '</li>';
      }
    }
    html += '<li class="popover__item popover__item--remp" data-mode="remplacant">';
    html +=   '<span class="slot__num">R</span>';
    html +=   '<span class="popover__poste-libelle">→ Mettre dans les remplaçants</span>';
    html += '</li>';
    return html;
  }

  function renderPopoverJoueurVivier() {
    const pv = State.popover;
    const joueur = getJoueurVivier(pv.joueurId);
    if (!joueur) return '';

    let html = '<div class="popover" role="dialog" aria-label="Affecter à un poste">';
    html +=   '<div class="popover__header">';
    html +=     '<h3 class="popover__title">' + escapeHtml((joueur.nom || '') + ' ' + (joueur.prenom || '')) + '</h3>';
    html +=     '<button type="button" class="popover__close" data-action="close" aria-label="Fermer">×</button>';
    html +=   '</div>';
    html +=   '<p class="popover__subtitle">Choisir un poste libre ou la zone des remplaçants.</p>';
    html +=   '<div class="popover__search">';
    html +=     '<input type="text" class="popover__input" id="popover-search" placeholder="Rechercher un poste…" value="' + escapeHtml(pv.search || '') + '" autocomplete="off">';
    html +=   '</div>';
    html +=   '<ul class="popover__list">';
    html +=     popoverListItemsJoueurVivier();
    html +=   '</ul>';
    html += '</div>';
    return html;
  }

  function bindPopoverHandlers() {
    const root = DOM.popoverRoot();
    if (!root) return;

    root.querySelectorAll('[data-action="close"]').forEach(el =>
      el.addEventListener('click', function (e) { e.stopPropagation(); closePopover(); })
    );

    const input = root.querySelector('#popover-search');
    if (input) {
      input.focus();
      // v3.4 : ne pas re-render tout le popover à chaque frappe, sinon
      // l'input est détruit/recréé et le curseur retourne en position 0
      // (effet "à l'envers" : 'obi' devient 'ibo'). On rafraîchit
      // uniquement la liste de résultats.
      input.addEventListener('input', function (e) {
        if (State.popover) State.popover.search = e.target.value;
        refreshPopoverList();
      });
    }

    if (State.popover && State.popover.mode === 'slot-vide') {
      root.querySelectorAll('.popover__item[data-joueur-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickJoueurPourSlot(li.dataset.joueurId); })
      );
    } else if (State.popover && State.popover.mode === 'joueur-vivier') {
      root.querySelectorAll('.popover__item[data-poste-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(li.dataset.posteId); })
      );
      const rempEl = root.querySelector('.popover__item--remp');
      if (rempEl) rempEl.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(null); });
    }
  }

  function bindPopoverOutsideClick() {
    document.addEventListener('click', function (e) {
      const root = DOM.popoverRoot();
      if (!State.popover || !root) return;
      if (root.contains(e.target)) return;
      closePopover();
    });
  }

  // v3.4 : rafraîchir uniquement la liste de résultats sans toucher
  // à l'input de recherche. Évite que le curseur retourne en position 0
  // à chaque frappe ("obi" devenait "ibo").
  function refreshPopoverList() {
    const root = DOM.popoverRoot();
    if (!root || !State.popover) return;
    const ul = root.querySelector('.popover__list');
    if (!ul) return;

    if (State.popover.mode === 'slot-vide') {
      ul.innerHTML = popoverListItemsSlotVide();
      ul.querySelectorAll('.popover__item[data-joueur-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickJoueurPourSlot(li.dataset.joueurId); })
      );
    } else if (State.popover.mode === 'joueur-vivier') {
      ul.innerHTML = popoverListItemsJoueurVivier();
      ul.querySelectorAll('.popover__item[data-poste-id]').forEach(li =>
        li.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(li.dataset.posteId); })
      );
      const rempEl = ul.querySelector('.popover__item--remp');
      if (rempEl) rempEl.addEventListener('click', function (e) { e.stopPropagation(); onPickPostePourJoueur(null); });
    }
  }

  // ============================================================
  // 8. ACTIONS
  // ============================================================

  async function selectEvenement(evtId) {
    State.selectedEvenementId = evtId;
    State.compos = [];
    State.selectedCompoId = null;
    State.compoJoueurs = [];
    closePopover();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();

    await loadComposForCurrentEvent();
    if (State.selectedCompoId) await loadCompoJoueurs();

    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function selectCompo(compoId) {
    State.selectedCompoId = compoId;
    State.compoJoueurs = [];
    closePopover();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();

    await loadCompoJoueurs();

    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  function toggleEventSelector() {
    const list = DOM.eventSelectorList();
    if (list) list.classList.toggle('is-open');
  }
  function closeEventSelector() {
    const list = DOM.eventSelectorList();
    if (list) list.classList.remove('is-open');
  }
  function toggleFiltreSAR(checked) {
    State.filtreHideSAR = !!checked;
    renderEffectifPanel();
  }

  // v3.8 — Toggle UN3-3 : élargit la pioche au hors-groupe. Recharge
  // le vivier (chemin loadVivier U-N3 lit listJoueursCategorieEntente
  // si State.includeHorsGroupe, sinon listGroupeEngage seul). Le
  // refresh complet effectif + slots est nécessaire car la pioche
  // disponible change.
  async function toggleIncludeHorsGroupe(checked) {
    State.includeHorsGroupe = !!checked;
    await loadVivier();
    renderEffectifPanel();
  }

  async function onCreateBaseClick() {
    if (!State.selectedEvenementId) return;
    // v3.9 — Garde anti-concurrence : si la fonction est déjà en
    // cours d'exécution (double-clic, re-render concurrent), on
    // sort immédiatement. Plus robuste que btn.disabled seul (qui
    // peut être contourné par 2 clics avant propagation DOM ou par
    // un re-render du bouton entre les deux clics).
    if (State.isCreatingBase) return;
    State.isCreatingBase = true;

    const btn = document.getElementById('btn-create-base');
    if (btn) { btn.disabled = true; btn.textContent = 'Création en cours…'; }

    try {
      // v3.8 — en mode U-N3, on propage evenement_equipe_id à la
      // base créée (Q4a actée : geste explicite via CTA existant +
      // option A Q1a : seule la base porte le lien équipe engagée).
      // createCompo v1.27 accepte le paramètre additif (rétro-compat
      // stricte : absent = comportement legacy, NULL en base).
      const params = { evenement_id: State.selectedEvenementId, type_compo: 'base' };
      if (State.evenementEquipeId) {
        params.evenement_equipe_id = State.evenementEquipeId;
      }
      const r = await SupabaseHub.createCompo(params);
      if (!r.ok) {
        alert('Erreur création compo de base : ' + r.error);
        if (btn) { btn.disabled = false; btn.textContent = 'Créer la compo de base'; }
        return;
      }
      await loadComposForCurrentEvent();
      State.selectedCompoId = r.data.id;
      await loadCompoJoueurs();
      renderEventBanner();
      renderCompoTabs();
      renderFillIndicator();
      renderEditorArea();
      renderEffectifPanel();
    } finally {
      // v3.9 — Garde toujours relâchée, même en cas d'erreur ou
      // exception. Indispensable pour permettre une nouvelle
      // tentative si la 1ʳᵉ a échoué pour une raison légitime
      // (réseau, conflit base, etc.).
      State.isCreatingBase = false;
    }
  }

  async function onPickJoueurPourSlot(joueurId) {
    const pv = State.popover;
    if (!pv) return;
    const joueur = getJoueurVivier(joueurId);
    if (!joueur) return;

    // v3.8 — en mode U-N3, est_depannage_hors_categorie reflète
    // « hors du groupe de base » (UN3-4, expose le champ EXISTANT
    // sql/18, non inventé). En legacy, comportement v3.7 préservé
    // (comparaison categorie_id).
    const horsCat = State.evenementEquipeId
      ? !!joueur._horsGroupe
      : (joueur.categorie_id !== M14_CATEGORIE_ID);
    const params = {
      composition_id: State.selectedCompoId,
      joueur_id: joueurId,
      role: pv.role || 'titulaire',
      etat_joueur: 'base',
      est_depannage_hors_categorie: horsCat
    };
    if (pv.role === 'titulaire' && pv.posteId) {
      params.poste_id = pv.posteId;
      const p = getPoste(pv.posteId);
      if (p && p.numero_xv) params.numero_maillot = p.numero_xv;
    } else if (pv.role === 'remplacant') {
      const libres = postesVides();
      params.poste_id = libres.length > 0 ? libres[0].id : (State.postes[0] && State.postes[0].id);
      params.numero_maillot = pv.numeroMaillot || 16;
    }

    if (!params.poste_id) {
      alert('Erreur interne : aucun poste disponible en base. Vérifie le chargement du référentiel postes.');
      return;
    }

    const r = await SupabaseHub.addJoueurCompo(params);
    if (!r.ok) { alert('Erreur ajout joueur : ' + r.error); return; }
    closePopover();
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onPickPostePourJoueur(posteId) {
    const pv = State.popover;
    if (!pv) return;
    const joueur = getJoueurVivier(pv.joueurId);
    if (!joueur) return;

    // v3.8 — idem onPickJoueurPourSlot ci-dessus : bascule par mode.
    const horsCat = State.evenementEquipeId
      ? !!joueur._horsGroupe
      : (joueur.categorie_id !== M14_CATEGORIE_ID);
    const params = {
      composition_id: State.selectedCompoId,
      joueur_id: pv.joueurId,
      etat_joueur: 'base',
      est_depannage_hors_categorie: horsCat
    };
    if (posteId) {
      params.role = 'titulaire';
      params.poste_id = posteId;
      const p = getPoste(posteId);
      if (p && p.numero_xv) params.numero_maillot = p.numero_xv;
    } else {
      const remp = State.compoJoueurs.filter(cj => cj.role === 'remplacant');
      const usedNums = new Set(remp.map(cj => cj.numero_maillot).filter(Boolean));
      let nextNum = 16;
      while (usedNums.has(nextNum) && nextNum <= 23) nextNum++;
      params.role = 'remplacant';
      params.numero_maillot = nextNum <= 23 ? nextNum : null;
      const libres = postesVides();
      params.poste_id = libres.length > 0 ? libres[0].id : (State.postes[0] && State.postes[0].id);
    }

    if (!params.poste_id) {
      alert('Erreur interne : aucun poste disponible en base. Vérifie le chargement du référentiel postes.');
      return;
    }

    const r = await SupabaseHub.addJoueurCompo(params);
    if (!r.ok) { alert('Erreur ajout joueur : ' + r.error); return; }
    closePopover();
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onRemoveJoueurClick(compoJoueurId) {
    const r = await SupabaseHub.removeJoueurCompo(compoJoueurId);
    if (!r.ok) { alert('Erreur retrait : ' + r.error); return; }
    await loadCompoJoueurs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  // Validation / dé-validation de la compo de base.
  // Le garde-fou d'état est porté par le serveur (validateCompo/
  // unvalidateCompo : .eq('etat',...)), on remonte juste son message.
  async function onValidateCompoClick(compoId) {
    if (!compoId) return;
    const r = await SupabaseHub.validateCompo(compoId);
    if (!r.ok) { alert('Validation impossible : ' + r.error); return; }
    await loadComposForCurrentEvent();
    if (State.selectedCompoId) await loadCompoJoueurs();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  async function onUnvalidateCompoClick(compoId) {
    if (!compoId) return;
    if (!window.confirm('Repasser cette compo en brouillon ? Elle ne sera plus considérée comme validée.')) return;
    const r = await SupabaseHub.unvalidateCompo(compoId);
    if (!r.ok) { alert('Action impossible : ' + r.error); return; }
    await loadComposForCurrentEvent();
    if (State.selectedCompoId) await loadCompoJoueurs();
    renderEventBanner();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
  }

  // ============================================================
  // 9. CHARGEMENTS
  // ============================================================

  async function loadEvenements() {
    // v3.8 — En mode U-N3, l'évènement est fixé par l'URL et résolu
    // via getEvenementEquipeContext (1 seul evt, pas un listing).
    // En legacy : byte-identique v3.7 (listing 60 jours pour M14).
    if (State.evenementEquipeId) {
      const ctx = await SupabaseHub.getEvenementEquipeContext(State.evenementEquipeId);
      if (!ctx || !ctx.ok) {
        console.error('MOM Hub: loadEvenements() U-N3 — contexte introuvable', ctx && ctx.error);
        State.evenements = [];
        State.evenementEquipeContext = null;
        return State.evenements;
      }
      State.evenementEquipeContext = ctx.data;
      const evt = ctx.data.evenement || null;
      State.evenements = evt ? [{
        id: evt.id,
        code: evt.code,
        libelle: evt.libelle,
        date_debut: evt.date_debut,
        type_evenement: evt.type_evenement
      }] : [];
      return State.evenements;
    }
    State.evenements = await SupabaseHub.getEvenementsAVenir(M14_TEAM_UUID, 60);
    return State.evenements;
  }
  async function loadComposForCurrentEvent() {
    if (!State.selectedEvenementId) { State.compos = []; return; }
    // v3.8 — En mode U-N3 : compos rattachées à l'équipe engagée
    // courante. Lecture en 2 temps cohérente Q1a (matchs ne portent
    // pas evenement_equipe_id, dérivent via compo_base_origine_id) :
    //   1) getCompoForEvenementEquipe → base de cette équipe engagée
    //   2) listCompositionsByEquipe → matchs filtrés par
    //      compo_base_origine_id === base.id
    // En legacy : code v3.7 byte-identique (listCompositionsByEquipe
    // sur M14_TEAM_UUID, filtre par evenement_id).
    if (State.evenementEquipeId) {
      const liesAEquipe = await SupabaseHub.getCompoForEvenementEquipe(State.evenementEquipeId);
      // base = type_compo='base' (peut être 0 ou 1 ; sql/50 garantit
      // au plus 1 active par (evt, equipe engagée, cote))
      const base = (liesAEquipe || []).find(c => c.type_compo === 'base') || null;
      if (!base) {
        State.compos = [];
        State.selectedCompoId = null;
        return;
      }
      // matchs dérivés de cette base : remontée par compo_base_origine_id
      const all = await SupabaseHub.listCompositionsByEquipe(M14_TEAM_UUID);
      const matchsDeLaBase = (all || []).filter(
        c => c.type_compo === 'match' &&
             c.compo_base_origine_id === base.id &&
             c.evenement_id === State.selectedEvenementId
      );
      State.compos = [base].concat(matchsDeLaBase);
      State.selectedCompoId = base.id;
      return;
    }
    const all = await SupabaseHub.listCompositionsByEquipe(M14_TEAM_UUID);
    State.compos = all.filter(c => c.evenement_id === State.selectedEvenementId);
    const compoBase = State.compos.find(c => c.type_compo === 'base');
    if (compoBase)                       State.selectedCompoId = compoBase.id;
    else if (State.compos.length > 0)    State.selectedCompoId = State.compos[0].id;
    else                                 State.selectedCompoId = null;
  }
  async function loadCompoJoueurs() {
    if (!State.selectedCompoId) { State.compoJoueurs = []; return; }
    const complet = await SupabaseHub.getCompoComplete(State.selectedCompoId);
    State.compoJoueurs = complet ? complet.joueurs : [];
  }
  async function loadVivier() {
    // v3.8 — En mode U-N3, la pioche = groupe N2 de l'équipe engagée
    // (UN3-1), avec filtre role='joueur' (UN3-6, le staff ne joue
    // pas). Toggle UN3-3 : si State.includeHorsGroupe, on élargit
    // via listJoueursCategorieEntente (pioche élargie au collectif
    // de la catégorie), avec marquage _horsGroupe sur les joueurs
    // qui ne sont PAS dans le groupe N2. Normalisation vers la forme
    // legacy {joueur_id, nom, prenom, categorie_id, ...} pour rester
    // compatible avec les helpers de rendu existants (getJoueurVivier,
    // renderSlotPoste etc. — qui lisent .joueur_id et .nom/.prenom).
    // En legacy : code v3.7 byte-identique (getVivierCompo M14).
    if (State.evenementEquipeId) {
      const ctx = State.evenementEquipeContext;
      const ententeId = ctx && ctx.entente ? ctx.entente.id : null;
      const categorieId = ctx && ctx.entente ? ctx.entente.categorie_id : null;

      // Pioche N2 (groupe convoqué)
      const groupe = await SupabaseHub.listGroupeEngage(State.evenementEquipeId);
      const groupeJoueurs = (groupe || []).filter(
        m => m.collectif_membre && m.collectif_membre.role === 'joueur'
      );
      State.groupeIds = new Set();
      const vivier = groupeJoueurs.map(function (m) {
        const cm = m.collectif_membre;
        const personnes = cm.personnes || {};
        State.groupeIds.add(cm.personne_id);
        return {
          joueur_id: cm.personne_id,
          nom: personnes.nom || '',
          prenom: personnes.prenom || '',
          categorie_id: categorieId,
          _horsGroupe: false
        };
      });

      // Pioche élargie si toggle UN3-3 actif
      if (State.includeHorsGroupe && ententeId) {
        const elargi = await SupabaseHub.listJoueursCategorieEntente(ententeId);
        for (const j of (elargi || [])) {
          if (!State.groupeIds.has(j.personne_id)) {
            vivier.push({
              joueur_id: j.personne_id,
              nom: j.nom || '',
              prenom: j.prenom || '',
              categorie_id: categorieId,
              _horsGroupe: true
            });
          }
        }
      }

      State.vivier = vivier;
      State.vivierById = new Map();
      for (const j of State.vivier) State.vivierById.set(j.joueur_id, j);
      return State.vivier;
    }
    State.vivier = await SupabaseHub.getVivierCompo(M14_TEAM_UUID);
    State.vivierById = new Map();
    for (const j of State.vivier) State.vivierById.set(j.joueur_id, j);
    return State.vivier;
  }
  async function loadPostes() {
    const all = await SupabaseHub.getPostes();
    // v3.7 — n'expose QUE les vrais postes de terrain. Les lignes
    // est_regroupement=true (PIL/2L/3L/CTR/AIL) sont des regroupements
    // tactiques de substitution, jamais des positions de jeu : exclues
    // du référentiel de slots. Source : dump table postes (20 lignes =
    // 15 est_regroupement=false + 5 true). Corrige le rendu de 20 slots
    // titulaires au lieu de 15. Prédicat défensif (!truthy) : seules les
    // lignes explicitement regroupement sont retirées.
    State.postes = (all || [])
      .filter(p => !p.est_regroupement)
      .sort((a, b) => (a.numero_xv || 99) - (b.numero_xv || 99));
    State.postesById = new Map();
    for (const p of State.postes) State.postesById.set(p.id, p);
    return State.postes;
  }

  // ============================================================
  // 10. INIT
  // ============================================================

  async function init() {
    // v3.8 — Lecture URL ?evenement_equipe=<uuid> au boot (SD-1
    // actée 20/05). Param absent = mode legacy (M14 hard-codé,
    // chemins v3.7 byte-identiques). Param présent = mode U-N3.
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('evenement_equipe');
      if (raw && raw.trim()) State.evenementEquipeId = raw.trim();
    } catch (_) { /* SSR ou contexte sans window — laisser null */ }

    await Promise.all([ loadEvenements(), loadVivier(), loadPostes() ]);

    if (State.evenements.length > 0) {
      State.selectedEvenementId = State.evenements[0].id;
      await loadComposForCurrentEvent();
      if (State.selectedCompoId) await loadCompoJoueurs();
    }

    renderEventBanner();
    renderEventSelector();
    renderCompoTabs();
    renderFillIndicator();
    renderEditorArea();
    renderEffectifPanel();
    renderPopover();

    // v3.8 — A1 : en mode U-N3, l'évènement est fixé par l'URL ;
    // le sélecteur d'évènements n'a pas de sens (retour à la fiche
    // évènement pour changer). On masque le bouton et on coupe son
    // handler. En legacy : comportement v3.7 byte-identique.
    const selBtn = DOM.eventSelectorBtn();
    if (State.evenementEquipeId) {
      if (selBtn) selBtn.style.display = 'none';
    } else {
      if (selBtn) selBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleEventSelector(); });
    }

    const filterEl = DOM.effectifFilter();
    if (filterEl) filterEl.addEventListener('change', function (e) { toggleFiltreSAR(e.target.checked); });

    document.addEventListener('click', function (e) {
      const list = DOM.eventSelectorList();
      const btn = DOM.eventSelectorBtn();
      if (!list || !list.classList.contains('is-open')) return;
      if (e.target === btn || (btn && btn.contains(e.target))) return;
      if (list.contains(e.target)) return;
      closeEventSelector();
    });

    bindPopoverOutsideClick();

    console.log(
      '%c🏉 Compositions Editor v3.6 (étape 6c-2 + 6c-3 + validation compo + retour évènements) chargé',
      'color: #2D7D46; font-weight: bold;',
      {
        evenements: State.evenements.length,
        vivier: State.vivier.length,
        postes: State.postes.length,
        compos: State.compos.length,
        compoJoueurs: State.compoJoueurs.length
      }
    );
  }

  window.CompositionsEditor = {
    init: init,
    state: State,
    loadEvenements: loadEvenements,
    loadComposForCurrentEvent: loadComposForCurrentEvent,
    loadCompoJoueurs: loadCompoJoueurs,
    loadVivier: loadVivier,
    loadPostes: loadPostes
  };

})();
