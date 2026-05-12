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
 *   - #stat-cette-semaine    (K3 CETTE SEMAINE, formaté "+N")
 *   - #stat-sans-email       (K4 SANS EMAIL)
 *   - #oval-e-last-sync      (sidebar carte 1, date sync formatée)
 *   - #oval-e-count          (sidebar carte 1, nb fiches)
 *   - #qd-sans-email         (sidebar carte 2)
 *   - #qd-sans-naissance     (sidebar carte 2)
 *   - #qd-ffr-90j            (sidebar carte 2)
 *
 * Côté Supabase :
 *   - RPC `get_dashboard_stats()` (Phase 2) : nb_personnes/nb_m14/...
 *   - RPC Phase 3.2 (sql/05-rpc-portail.sql) :
 *       * count_personnes_created_last_7_days
 *       * count_personnes_without_email
 *       * count_personnes_without_birthdate
 *       * count_personnes_affiliation_expiring_within_90_days
 *       * get_last_oval_e_sync_date
 *
 * Version : 2.0 — mai 2026
 *   v1.0 : tentait des SELECT directs (bloqués par RLS)
 *   v1.1 : utilise get_dashboard_stats agrégée
 *   v2.0 : Phase 3.2 — refonte portail (4 KPI + sidebar 3 cartes)
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
  // 2. PEUPLEMENT IMMÉDIAT (sans attendre Supabase)
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
      // 6 appels en parallèle pour minimiser la latence perçue
      const results = await Promise.all([
        SupabaseHub.client.rpc('get_dashboard_stats').then(function (r) { return r.data; }).catch(function () { return null; }),
        SupabaseHub.countPersonnesCreatedLast7Days(),
        SupabaseHub.countPersonnesWithoutEmail(),
        SupabaseHub.countPersonnesWithoutBirthdate(),
        SupabaseHub.countPersonnesAffiliationExpiringWithin90Days(),
        SupabaseHub.getLastOvalESyncDate()
      ]);

      const dashboardStats  = results[0];
      const cetteSemaine    = results[1];
      const sansEmail       = results[2];
      const sansNaissance   = results[3];
      const ffr90j          = results[4];
      const lastSyncOvalE   = results[5];

      // --------------------------------------------------------
      // 4a. KPI (header)
      // --------------------------------------------------------
      const nbPersonnes = dashboardStats && dashboardStats.nb_personnes;
      if (nbPersonnes !== undefined && nbPersonnes !== null) {
        updateEl('stat-personnes', nbPersonnes);
        updateEl('oval-e-count', String(nbPersonnes));
      }
      // K2 ÉQUIPES laissé en dur (11) dans le HTML — doctrine §2.3 (dette P4-1)

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

      console.log(
        '%c✅ MOM Hub Dashboard v2.0: stats mises à jour depuis Supabase',
        'color: #2d7a3e; font-weight: bold;',
        {
          nbPersonnes: nbPersonnes,
          cetteSemaine: cetteSemaine,
          sansEmail: sansEmail,
          sansNaissance: sansNaissance,
          ffr90j: ffr90j,
          lastSyncOvalE: lastSyncOvalE
        }
      );
    } catch (err) {
      console.warn('⚠️ MOM Hub Dashboard: erreur Supabase, KPI partiels ou "…" affichés.', err);
      // Pas de plantage : les éléments non-peuplés restent à "…"
    }
  })();

})();
