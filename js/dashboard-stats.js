/**
 * MOM Hub · Dashboard Stats
 * ==========================
 *
 * Met à jour les compteurs du portail principal (index.html)
 * avec les vraies données de Supabase.
 *
 * Stratégie : "graceful degradation"
 *   - Si Supabase répond : on remplace les chiffres en dur
 *   - Si Supabase plante : on laisse les chiffres en dur (HTML inchangé)
 *
 * Le HTML doit contenir des éléments avec ces IDs :
 *   - #stat-personnes  (compteur Personnes)
 *   - #stat-m14        (compteur M14 enr.)
 *   - #se-joueurs      (stat SportEasy joueurs, optionnel)
 *   - #greeting-meta   (ligne date sous "Bonjour Manu")
 *   - #greeting-sub    (sous-titre "Hub créé aujourd'hui · ...")
 *
 * Les compteurs Sites et Équipes restent statiques tant que ces
 * tables Supabase ne sont pas créées (Phase 2.2).
 *
 * Version : 1.0 — mai 2026
 */

(function () {
  'use strict';

  // Attendre que SupabaseHub soit chargé
  if (typeof SupabaseHub === 'undefined') {
    console.warn('⚠️ MOM Hub Dashboard: SupabaseHub non chargé, fallback sur chiffres en dur.');
    return;
  }

  // Helper : mise à jour silencieuse d'un élément
  function updateEl(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }

  // Helper : date du jour formatée en français
  function dateFr() {
    const d = new Date();
    const jours = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
    const mois = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Mise à jour de la date immédiatement (sans attendre Supabase)
  updateEl('greeting-meta', `${dateFr()} · CONNECTÉ À SUPABASE`);

  // Récupération des stats depuis Supabase
  (async () => {
    try {
      // 1. Total personnes
      const personnes = await SupabaseHub.client
        .from('personnes')
        .select('*', { count: 'exact', head: true });

      if (personnes.count !== null) {
        updateEl('stat-personnes', personnes.count);
        updateEl('greeting-sub',
          `${personnes.count} personnes en base · données live Supabase`
        );
      }

      // 2. Comptage des M14 (filtrer par categorie_uuid_legacy = 'cat-m14')
      // Étape A : récupérer l'UUID de la catégorie M14
      const catM14 = await SupabaseHub.client
        .from('categories')
        .select('id')
        .eq('uuid_legacy', 'cat-m14')
        .single();

      if (catM14.data) {
        // Étape B : compter les personnes dans cette catégorie
        const m14 = await SupabaseHub.client
          .from('personnes')
          .select('*', { count: 'exact', head: true })
          .eq('categorie_id', catM14.data.id);

        if (m14.count !== null) {
          updateEl('stat-m14', m14.count);
          updateEl('se-joueurs', m14.count);  // si présent dans la sidebar
        }
      }

      console.log(
        '%c✅ MOM Hub Dashboard: stats mises à jour depuis Supabase',
        'color: #2d7a3e; font-weight: bold;'
      );
    } catch (err) {
      console.warn('⚠️ MOM Hub Dashboard: erreur Supabase, fallback sur chiffres en dur.', err);
      // Pas de plantage : les chiffres en dur restent affichés
    }
  })();

})();
