/**
 * MOM Hub · Dashboard Stats
 * ==========================
 *
 * Peuple dynamiquement les éléments du portail (index.html) avec les
 * vraies données Supabase :
 *   - 4 KPI (PERSONNES / ÉQUIPES / CETTE SEMAINE / SANS EMAIL)
 *   - Sidebar carte 1 OVAL-E (dernière sync + count fiches)
 *   - Sidebar carte 2 Qualité des données (sans email / sans naissance / FFR 90j)
 *   - Greeting (surtitre date dynamique)
 *
 * Stratégie : "graceful degradation"
 *   - Si Supabase répond : on remplace les "…" du HTML par les vraies valeurs
 *   - Si Supabase plante : on laisse les "…" et on logge en console
 *
 * Le HTML doit contenir les éléments avec ces IDs :
 *   - #greeting-meta         (surtitre date : "LUNDI 12 MAI 2026 · TABLEAU DE BORD")
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
 *   - RPC `get_dashboard_stats()` (Phase 2) : nb_personnes/nb_m14/...
 *   - RPC Phase 3.2 (sql/05-rpc-portail.sql) :
 *       * count_personnes_created_last_7_days
 *       * count_personnes_without_email
 *       * count_personnes_without_birthdate
 *       * count_personnes_affiliation_expiring_within_90_days
 *       * get_last_oval_e_sync_date
 *   - RPC Phase 4.1.A bis (sql/09-rpc-equipes.sql) :
 *       * count_equipes_actives
 *   - RPC Phase 4.2.B (sql/11-rpc-evenements.sql) :
 *       * get_prochain_evenement_par_equipe (utilisé pour carte 3 sidebar)
 *
 * Version : 2.2 — mai 2026 (Phase 4.4 Étape C — widget Prochain événement M14)
 *   v1.0 : tentait des SELECT directs (bloqués par RLS)
 *   v1.1 : utilise get_dashboard_stats agrégée
 *   v2.0 : Phase 3.2 — refonte portail (4 KPI + sidebar 3 cartes)
 *   v2.1 : Phase 4.1.A bis — bascule K2 ÉQUIPES via RPC count_equipes_actives (dette #5)
 *   v2.2 : Phase 4.4 Étape C — widget "Prochain événement M14" en sidebar
 *          (uses getProchainEvenementParEquipe ; calcul J civil côté JS pour
 *           "AUJOURD'HUI/DEMAIN/DANS N JOURS" plus humain que la RPC qui
 *           tronque par heures.)
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

  // ============================================================
  // 2. CONSTANTES
  // ============================================================

  // UUID de l'équipe pilote M14 (résolu en base le 13/05/2026, dette (k)
  // ferme l'accès direct equipes pour authenticated mais on garde l'UUID
  // hardcodé pour simplicité du widget — plus tard, paramétrer par rôle
  // utilisateur quand l'auth multi-équipe sera en place).
  const M14_TEAM_UUID = 'bfb83b83-83ef-4dde-b526-48ff87313044';

  // ============================================================
  // 3. PEUPLEMENT IMMÉDIAT (sans attendre Supabase)
  // ============================================================

  // Surtitre date — toujours affichable, indépendant de la base
  updateEl('greeting-meta', `${dateFr()} · TABLEAU DE BORD`);

  // ============================================================
  // 3. GARDE — SupabaseHub doit être chargé
  // ============================================================

  if (typeof SupabaseHub === 'undefined') {
    console.warn('⚠️ MOM Hub Dashboard: SupabaseHub non chargé, KPI laissés en "…".');
    return;
  }

  // ============================================================
  // 4. RÉCUPÉRATION DES STATS EN PARALLÈLE
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
        SupabaseHub.getProchainEvenementParEquipe(M14_TEAM_UUID)
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
      // 4a. KPI (header)
      // --------------------------------------------------------
      const nbPersonnes = dashboardStats && dashboardStats.nb_personnes;
      if (nbPersonnes !== undefined && nbPersonnes !== null) {
        updateEl('stat-personnes', nbPersonnes);
        updateEl('oval-e-count', String(nbPersonnes));
      }
      // K2 ÉQUIPES dynamique via count_equipes_actives (v2.1, dette #5 partielle)
      if (nbEquipes !== undefined && nbEquipes !== null) {
        updateEl('stat-equipes', nbEquipes);
      }

      updateEl('stat-cette-semaine', '+' + cetteSemaine);
      updateEl('stat-sans-email', sansEmail);

      // --------------------------------------------------------
      // 4b. Sidebar carte 1 — OVAL-E
      // --------------------------------------------------------
      updateEl('oval-e-last-sync', formatSyncDate(lastSyncOvalE));

      // --------------------------------------------------------
      // 4c. Sidebar carte 2 — Qualité des données
      // --------------------------------------------------------
      updateEl('qd-sans-email', sansEmail);
      updateEl('qd-sans-naissance', sansNaissance);
      updateEl('qd-ffr-90j', ffr90j);

      // --------------------------------------------------------
      // 4d. Sidebar carte 3 — Prochain événement M14 (v2.2)
      // --------------------------------------------------------
      // Retourne null si aucun événement futur trouvé.
      if (prochainEvtM14) {
        // Calcul du libellé temporel basé sur dates CIVILES (J0 = aujourd'hui
        // selon le calendrier local, indépendamment des heures). Plus humain
        // que le jours_jusqu_a_evenement de la RPC qui tronque par heures.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(prochainEvtM14.date_debut);
        const eventDateCivil = new Date(eventDate);
        eventDateCivil.setHours(0, 0, 0, 0);
        const diffJoursCivils = Math.round((eventDateCivil - today) / (1000 * 60 * 60 * 24));

        let whenLabel;
        if (diffJoursCivils === 0)      whenLabel = "AUJOURD'HUI";
        else if (diffJoursCivils === 1) whenLabel = 'DEMAIN';
        else if (diffJoursCivils < 0)   whenLabel = 'EN COURS'; // safety
        else                            whenLabel = 'DANS ' + diffJoursCivils + ' JOURS';

        // Heure de début (locale Europe/Paris)
        const heureLocale = eventDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        }).replace(':', 'H');

        // Type humanisé
        let typeLabel;
        const type = prochainEvtM14.type_evenement;
        if (type === 'entrainement') {
          typeLabel = 'Entraînement';
        } else if (type === 'match' || type === 'journee_championnat') {
          typeLabel = prochainEvtM14.adversaire_nom
            ? ('Match vs ' + prochainEvtM14.adversaire_nom)
            : 'Match';
        } else if (type === 'tournoi') {
          // Extrait le nom du tournoi du libellé (souvent "Nom (Lieu)" → "Nom")
          const libelle = prochainEvtM14.libelle || '';
          const sansParenthese = libelle.replace(/\s*\([^)]*\)\s*$/, '').trim();
          typeLabel = 'Tournoi : ' + (sansParenthese || libelle);
        } else if (type === 'stage') {
          typeLabel = 'Stage';
        } else {
          typeLabel = prochainEvtM14.libelle || '—';
        }

        // Lieu : libellé court du site, sinon fallback humain
        const siteLabel = prochainEvtM14.site_libelle_court || 'Lieu à confirmer';

        updateEl('evt-when', whenLabel + ' · ' + heureLocale);
        updateEl('evt-type', typeLabel);
        updateEl('evt-site', siteLabel);
      } else {
        // Aucun événement futur trouvé pour cette équipe
        updateEl('evt-when', 'AUCUN ÉVÉNEMENT');
        updateEl('evt-type', '—');
        updateEl('evt-site', '—');
      }

      console.log(
        '%c✅ MOM Hub Dashboard v2.2: stats mises à jour depuis Supabase',
        'color: #2d7a3e; font-weight: bold;',
        {
          nbPersonnes:     nbPersonnes,
          nbEquipes:       nbEquipes,
          cetteSemaine:    cetteSemaine,
          sansEmail:       sansEmail,
          sansNaissance:   sansNaissance,
          ffr90j:          ffr90j,
          lastSyncOvalE:   lastSyncOvalE,
          prochainEvtM14:  prochainEvtM14 ? prochainEvtM14.code : 'aucun'
        }
      );
    } catch (err) {
      console.warn('⚠️ MOM Hub Dashboard: erreur Supabase, KPI partiels ou "…" affichés.', err);
      // Pas de plantage : les éléments non-peuplés restent à "…"
    }
  })();

})();