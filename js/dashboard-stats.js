/**
 * MOM Hub · Dashboard Stats
 * ==========================
 *
 * Peuple dynamiquement les éléments du portail (index.html) avec les
 * vraies données Supabase :
 *   - 4 KPI (PERSONNES / ÉQUIPES / CETTE SEMAINE / SANS EMAIL)
 *   - Sidebar carte 1 OVAL-E (dernière sync + count fiches)
 *   - Sidebar carte 2 Qualité des données (sans email / sans naissance / FFR 90j)
 *   - Sidebar carte 3 Prochain événement M14 (pilule temporelle + type + lieu)
 *   - Greeting (surtitre date dynamique + greeting J-N AVANT MATCH v2.3)
 *
 * Stratégie : "graceful degradation"
 *   - Si Supabase répond : on remplace les "…" du HTML par les vraies valeurs
 *   - Si Supabase plante : on laisse les "…" / la date du jour, et on logge en console
 *
 * Le HTML doit contenir les éléments avec ces IDs :
 *   - #greeting-meta         (surtitre : date OU "J-N AVANT TOURNOI · LES GEMMEURS")
 *   - #greeting-prenom       (laissé en dur dans HTML)
 *   - #stat-personnes        (K1 PERSONNES)
 *   - #stat-equipes          (K2 ÉQUIPES)
 *   - #stat-cette-semaine    (K3 CETTE SEMAINE, formaté "+N")
 *   - #stat-sans-email       (K4 SANS EMAIL)
 *   - #oval-e-last-sync      (sidebar carte 1, date sync formatée)
 *   - #oval-e-count          (sidebar carte 1, nb fiches)
 *   - #qd-sans-email         (sidebar carte 2)
 *   - #qd-sans-naissance     (sidebar carte 2)
 *   - #qd-ffr-90j            (sidebar carte 2)
 *   - #evt-when              (sidebar carte 3 — pilule temporelle "DEMAIN · 14H00")
 *   - #evt-type              (sidebar carte 3 — type d'événement humanisé)
 *   - #evt-site              (sidebar carte 3 — lieu)
 *
 * Côté Supabase :
 *   - RPC `get_dashboard_stats()` (Phase 2)
 *   - RPC Phase 3.2 (sql/05-rpc-portail.sql)
 *   - RPC Phase 4.1.A bis (sql/09-rpc-equipes.sql) : count_equipes_actives
 *   - RPC Phase 4.2.B (sql/11-rpc-evenements.sql) :
 *       * get_prochain_evenement_par_equipe (utilisé pour carte 3 sidebar
 *         ET pour greeting J-N v2.3)
 *
 * Version : 2.3 — mai 2026 (Phase 4.4 P4-2 — greeting J-N AVANT MATCH)
 *   v1.0 : tentait des SELECT directs (bloqués par RLS)
 *   v1.1 : utilise get_dashboard_stats agrégée
 *   v2.0 : Phase 3.2 — refonte portail (4 KPI + sidebar 3 cartes)
 *   v2.1 : Phase 4.1.A bis — bascule K2 ÉQUIPES via RPC count_equipes_actives
 *   v2.2 : Phase 4.4 Étape C — widget "Prochain événement M14" en sidebar
 *   v2.3 : Phase 4.4 P4-2 — greeting J-N AVANT MATCH dans greeting-meta.
 *          Réutilise prochainEvtM14 déjà fetché par v2.2, zéro RPC en plus.
 *          Logique extraite dans 2 helpers (formatLabelTemporel,
 *          formatTypeEvenement) partagés entre greeting et sidebar carte 3.
 *          Fallback gracieux : si pas d'événement → garde la date du jour
 *          (init immédiat au début du script).
 */

(function () {
  'use strict';

  // ============================================================
  // 1. HELPERS
  // ============================================================

  // Mise à jour silencieuse d'un élément (no-op si l'élément n'existe pas)
  function updateEl(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }

  // Date du jour formatée en français : "LUNDI 12 MAI 2026"
  function dateFr() {
    const d = new Date();
    const jours = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
    const mois = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Date 'YYYY-MM-DD' -> "11 MAI 2026" (format humain pour sidebar OVAL-E)
  function formatSyncDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-').map(Number);
    const y = parts[0], m = parts[1], d = parts[2];
    if (!y || !m || !d) return dateStr;
    const mois = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
    return `${d} ${mois[m - 1]} ${y}`;
  }

  // Calcule le nombre de jours civils entre aujourd'hui et la date de
  // l'événement (indépendamment des heures). Retourne un entier :
  //   0  = aujourd'hui
  //   1  = demain
  //   N  = dans N jours
  //   <0 = passé (cas safety)
  function joursCivilsAvant(dateDebutISO) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(dateDebutISO);
    const eventDateCivil = new Date(eventDate);
    eventDateCivil.setHours(0, 0, 0, 0);
    return Math.round((eventDateCivil - today) / (1000 * 60 * 60 * 24));
  }

  // Humanise le type d'événement avec l'adversaire/le tournoi.
  // Retourne par exemple : 'Entraînement', 'Match vs ECLR', 'Tournoi : Les Gemmeurs'.
  // Utilisé pour la sidebar carte 3 (type=true → casse normale).
  function formatTypeEvenement(evt) {
    if (!evt) return '—';
    const type = evt.type_evenement;
    if (type === 'entrainement') {
      return 'Entraînement';
    }
    if (type === 'match' || type === 'journee_championnat') {
      return evt.adversaire_nom
        ? ('Match vs ' + evt.adversaire_nom)
        : 'Match';
    }
    if (type === 'tournoi') {
      // Extrait le nom du tournoi du libellé (souvent "Nom (Lieu)" → "Nom")
      const libelle = evt.libelle || '';
      const sansParenthese = libelle.replace(/\s*\([^)]*\)\s*$/, '').trim();
      return 'Tournoi : ' + (sansParenthese || libelle);
    }
    if (type === 'stage') {
      return 'Stage';
    }
    return evt.libelle || '—';
  }

  // Construit le libellé du greeting "J-N AVANT [...]" en UPPERCASE.
  // Format adapté selon la temporalité ET le type :
  //   - Entraînement (banal, quotidien) : 'DEMAIN · ENTRAÎNEMENT · BRENCKLÉ'
  //     ou 'AUJOURD'HUI · ENTRAÎNEMENT · BRENCKLÉ'
  //   - Match/Tournoi/Stage (jour J) : 'AUJOURD'HUI · TOURNOI · LES GEMMEURS'
  //   - Match/Tournoi/Stage (J-1)   : 'DEMAIN · TOURNOI · LES GEMMEURS'
  //   - Match/Tournoi/Stage (J-N>1) : 'J-10 AVANT TOURNOI · LES GEMMEURS'
  // Retourne null si pas d'événement (le caller affichera la date du jour).
  function formatGreetingMeta(evt) {
    if (!evt) return null;

    const j = joursCivilsAvant(evt.date_debut);
    const type = evt.type_evenement;

    // Identifiant court de l'événement, sans préfixe "Match/Tournoi/..."
    // (le type est déjà dans le libellé)
    let identifiant;
    if (type === 'match' || type === 'journee_championnat') {
      identifiant = evt.adversaire_nom ? ('VS ' + evt.adversaire_nom.toUpperCase()) : 'MATCH';
    } else if (type === 'tournoi') {
      const libelle = evt.libelle || '';
      const sansParenthese = libelle.replace(/\s*\([^)]*\)\s*$/, '').trim();
      identifiant = (sansParenthese || libelle).toUpperCase();
    } else if (type === 'stage') {
      identifiant = (evt.libelle || 'STAGE').toUpperCase();
    } else if (type === 'entrainement') {
      // Pour les entraînements, on inverse : lieu plutôt que libellé
      // (l'entraînement n'a pas de nom propre)
      identifiant = (evt.site_libelle_court || 'ENTRAÎNEMENT').toUpperCase();
    } else {
      identifiant = (evt.libelle || '').toUpperCase();
    }

    // Libellé du type pour le greeting (UPPERCASE, sans adversaire/lieu)
    let typeUpper;
    if (type === 'entrainement')               typeUpper = 'ENTRAÎNEMENT';
    else if (type === 'match')                 typeUpper = 'MATCH';
    else if (type === 'journee_championnat')   typeUpper = 'MATCH';
    else if (type === 'tournoi')               typeUpper = 'TOURNOI';
    else if (type === 'stage')                 typeUpper = 'STAGE';
    else                                       typeUpper = 'ÉVÉNEMENT';

    // Construction selon la temporalité
    if (j === 0) {
      // Aujourd'hui — formulation neutre
      if (type === 'entrainement') {
        return "AUJOURD'HUI · " + typeUpper + ' · ' + identifiant;
      }
      return "AUJOURD'HUI · " + typeUpper + ' · ' + identifiant;
    }

    if (j === 1) {
      // Demain — formulation neutre
      return 'DEMAIN · ' + typeUpper + ' · ' + identifiant;
    }

    if (j < 0) {
      // Sécurité — ne devrait pas arriver (la RPC ne renvoie que des
      // événements futurs), mais on tombe en fallback
      return null;
    }

    // J-N > 1
    if (type === 'entrainement') {
      // Pour les entraînements, format raccourci (pas de "J-N AVANT
      // ENTRAÎNEMENT" qui serait pompeux pour un entraînement banal)
      return 'DANS ' + j + ' JOURS · ' + typeUpper + ' · ' + identifiant;
    }

    // Match / Tournoi / Stage / Autre : format "J-N AVANT [...]"
    return 'J-' + j + ' AVANT ' + typeUpper + ' · ' + identifiant;
  }

  // ============================================================
  // 2. CONSTANTES
  // ============================================================

  // UUID de l'équipe pilote M14 (résolu en base le 13/05/2026).
  // Conservé comme REPLI de dégradation honnête : si le périmètre de
  // catégories est indisponible (socle ancien, droits vides, aucune
  // équipe), la carte 3 retombe sur l'équipe M14 — comportement d'origine.
  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  // ------------------------------------------------------------
  // Périmètre catégorie active → équipes (propagation multi-cat)
  // ------------------------------------------------------------
  // Le Dashboard ne PORTE pas de sélecteur de catégorie (c'est un
  // tableau de bord, pas un écran de travail catégorie-porté) : il
  // REFLÈTE la catégorie active mémorisée (clé localStorage partagée
  // mom_hub.categorie_active, alimentée par les écrans qui ont le
  // sélecteur). Cohérence inter-écrans gratuite.
  //
  // La carte 3 (« prochain événement ») est un SINGLETON temporel :
  // l'agrégation de toutes les équipes de la catégorie active a un
  // sens ici (≠ compo/séance qui sont par équipe). On garde le
  // prochain événement le plus proche dans le futur, toutes équipes
  // de la catégorie active confondues.
  //
  // Garde-fou non-régression : catégorie mono-équipe (cas réel
  // actuel : M14 = 1 équipe) → 1 appel → résultat identique à avant.
  async function _dashResoudreEquipesActives() {
    // Socle absent / ancien → repli M14 (dégradation honnête).
    if (typeof SupabaseHub === 'undefined'
        || typeof SupabaseHub.resoudrePerimetreCategories !== 'function'
        || typeof SupabaseHub.listEquipes !== 'function') {
      return [M14_TEAM_UUID];
    }
    let perimetre;
    try {
      perimetre = await SupabaseHub.resoudrePerimetreCategories();
    } catch (e) {
      console.warn('MOM Hub Dashboard: périmètre catégories indisponible, repli M14.', e);
      return [M14_TEAM_UUID];
    }
    // Aucun droit / pas de catégorie active → repli M14.
    if (!perimetre || perimetre.vide || !perimetre.active) {
      return [M14_TEAM_UUID];
    }
    let equipes;
    try {
      equipes = await SupabaseHub.listEquipes(perimetre.active);
    } catch (e) {
      console.warn('MOM Hub Dashboard: listEquipes indisponible, repli M14.', e);
      return [M14_TEAM_UUID];
    }
    const ids = (Array.isArray(equipes) ? equipes : [])
      .map(function (eq) { return eq && eq.id; })
      .filter(Boolean);
    // Catégorie active sans équipe en base → repli M14 (jamais de
    // carte 3 muette par construction).
    return ids.length > 0 ? ids : [M14_TEAM_UUID];
  }

  // Prochain événement parmi N équipes de la catégorie active :
  // 1 appel getProchainEvenementParEquipe par équipe → on garde le
  // plus proche (date_debut min). N=1 → strictement équivalent à
  // l'appel unique d'origine (garde-fou mono-catégorie).
  async function _dashProchainEvtCategorieActive() {
    const equipes = await _dashResoudreEquipesActives();
    const listes = await Promise.all(
      equipes.map(function (eqId) {
        return SupabaseHub.getProchainEvenementParEquipe(eqId)
          .catch(function () { return null; });
      })
    );
    var meilleur = null;
    for (var i = 0; i < listes.length; i++) {
      var evt = listes[i];
      if (!evt || !evt.date_debut) continue;
      if (meilleur === null) { meilleur = evt; continue; }
      // Plus proche dans le temps = date_debut la plus petite.
      if (new Date(evt.date_debut) < new Date(meilleur.date_debut)) {
        meilleur = evt;
      }
    }
    return meilleur;
  }

  // ============================================================
  // 3. PEUPLEMENT IMMÉDIAT (sans attendre Supabase)
  // ============================================================

  // Surtitre date — toujours affichable, indépendant de la base. Sert de
  // fallback gracieux : si Supabase n'a pas (encore) répondu ou plante,
  // l'utilisateur voit la date du jour. La résolution Supabase peut
  // l'écraser ensuite avec "J-N AVANT [...]" si un événement futur existe
  // (cf. bloc 4e ci-dessous).
  updateEl('greeting-meta', `${dateFr()} · TABLEAU DE BORD`);

  // ============================================================
  // 4. GARDE — SupabaseHub doit être chargé
  // ============================================================

  if (typeof SupabaseHub === 'undefined') {
    console.warn('⚠️ MOM Hub Dashboard: SupabaseHub non chargé, KPI laissés en "…".');
    return;
  }

  // ============================================================
  // 5. RÉCUPÉRATION DES STATS EN PARALLÈLE
  // ============================================================

  (async function () {
    try {
      // 8 appels en parallèle pour minimiser la latence perçue
      const results = await Promise.all([
        SupabaseHub.client.rpc('get_dashboard_stats').then(function (r) { return r.data; }).catch(function () { return null; }),
        SupabaseHub.countPersonnesCreatedLast7Days(),
        SupabaseHub.countPersonnesWithoutEmail(),
        SupabaseHub.countPersonnesWithoutBirthdate(),
        SupabaseHub.countPersonnesAffiliationExpiringWithin90Days(),
        SupabaseHub.getLastOvalESyncDate(),
        SupabaseHub.client.rpc('count_equipes_actives').then(function (r) { return r.data; }).catch(function () { return null; }),
        _dashProchainEvtCategorieActive()
      ]);

      const dashboardStats  = results[0];
      const cetteSemaine    = results[1];
      const sansEmail       = results[2];
      const sansNaissance   = results[3];
      const ffr90j          = results[4];
      const lastSyncOvalE   = results[5];
      const nbEquipes       = results[6];
      const prochainEvtM14  = results[7];

      // --------------------------------------------------------
      // 5a. KPI (header)
      // --------------------------------------------------------
      const nbPersonnes = dashboardStats && dashboardStats.nb_personnes;
      if (nbPersonnes !== undefined && nbPersonnes !== null) {
        updateEl('stat-personnes', nbPersonnes);
        updateEl('oval-e-count', String(nbPersonnes));
      }
      if (nbEquipes !== undefined && nbEquipes !== null) {
        updateEl('stat-equipes', nbEquipes);
      }
      updateEl('stat-cette-semaine', '+' + cetteSemaine);
      updateEl('stat-sans-email', sansEmail);

      // --------------------------------------------------------
      // 5b. Sidebar carte 1 — OVAL-E
      // --------------------------------------------------------
      updateEl('oval-e-last-sync', formatSyncDate(lastSyncOvalE));

      // --------------------------------------------------------
      // 5c. Sidebar carte 2 — Qualité des données
      // --------------------------------------------------------
      updateEl('qd-sans-email', sansEmail);
      updateEl('qd-sans-naissance', sansNaissance);
      updateEl('qd-ffr-90j', ffr90j);

      // --------------------------------------------------------
      // 5d. Sidebar carte 3 — Prochain événement M14 (v2.2)
      // --------------------------------------------------------
      if (prochainEvtM14) {
        const j = joursCivilsAvant(prochainEvtM14.date_debut);

        let whenLabel;
        if (j === 0)      whenLabel = "AUJOURD'HUI";
        else if (j === 1) whenLabel = 'DEMAIN';
        else if (j < 0)   whenLabel = 'EN COURS';
        else              whenLabel = 'DANS ' + j + ' JOURS';

        const heureLocale = new Date(prochainEvtM14.date_debut)
          .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          .replace(':', 'H');

        const typeLabel = formatTypeEvenement(prochainEvtM14);
        const siteLabel = prochainEvtM14.site_libelle_court || 'Lieu à confirmer';

        updateEl('evt-when', whenLabel + ' · ' + heureLocale);
        updateEl('evt-type', typeLabel);
        updateEl('evt-site', siteLabel);
      } else {
        updateEl('evt-when', 'AUCUN ÉVÉNEMENT');
        updateEl('evt-type', '—');
        updateEl('evt-site', '—');
      }

      // --------------------------------------------------------
      // 5e. Greeting J-N AVANT MATCH (v2.3, P4-2)
      // --------------------------------------------------------
      // Réutilise prochainEvtM14 déjà fetché ci-dessus. Si pas d'événement,
      // greeting-meta garde la valeur "JEUDI 14 MAI 2026 · TABLEAU DE BORD"
      // posée au peuplement immédiat (bloc 3).
      const greetingMeta = formatGreetingMeta(prochainEvtM14);
      if (greetingMeta) {
        updateEl('greeting-meta', greetingMeta);
      }

      console.log(
        '%c✅ MOM Hub Dashboard v2.3: stats mises à jour depuis Supabase',
        'color: #2d7a3e; font-weight: bold;',
        {
          nbPersonnes:     nbPersonnes,
          nbEquipes:       nbEquipes,
          cetteSemaine:    cetteSemaine,
          sansEmail:       sansEmail,
          sansNaissance:   sansNaissance,
          ffr90j:          ffr90j,
          lastSyncOvalE:   lastSyncOvalE,
          prochainEvtM14:  prochainEvtM14 ? prochainEvtM14.code : 'aucun',
          greetingMeta:    greetingMeta || '(date du jour)'
        }
      );
    } catch (err) {
      console.warn('⚠️ MOM Hub Dashboard: erreur Supabase, KPI partiels ou "…" affichés.', err);
      // Pas de plantage : les éléments non-peuplés restent à "…",
      // et greeting-meta garde la date du jour (fallback bloc 3).
    }
  })();

})();
