/**
 * MOM Hub · Dashboard Stats
 * ==========================
 *
 * Met à jour les compteurs du portail principal (index.html)
 * avec les vraies données de Supabase, via une fonction RPC
 * agrégée qui ne renvoie QUE des compteurs (pas de données perso).
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
 * Côté Supabase :
 *   - Fonction RPC `get_dashboard_stats()` doit exister
 *   - Renvoie : { nb_personnes, nb_m14, nb_poles, nb_clubs, nb_categories }
 *
 * Version : 1.1 — mai 2026
 *   v1.0 : tentait des SELECT directs (bloqués par RLS)
 *   v1.1 : utilise la RPC agrégée, RGPD-safe en repo public
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

  // Récupération des stats agrégées via la RPC Supabase
  (async () => {
    try {
      const { data, error } = await SupabaseHub.client.rpc('get_dashboard_stats');

      if (error) {
        console.warn('⚠️ MOM Hub Dashboard: erreur RPC, fallback sur chiffres en dur.', error);
        return;
      }

      if (!data) {
        console.warn('⚠️ MOM Hub Dashboard: RPC vide, fallback sur chiffres en dur.');
        return;
      }

      // Mise à jour des compteurs
      updateEl('stat-personnes', data.nb_personnes);
      updateEl('stat-m14', data.nb_m14);
      updateEl('se-joueurs', data.nb_m14);  // si présent dans la sidebar

      // Mise à jour du sous-titre
      updateEl('greeting-sub',
        `${data.nb_personnes} personnes en base · données live Supabase`
      );

      console.log(
        '%c✅ MOM Hub Dashboard: stats mises à jour depuis Supabase',
        'color: #2d7a3e; font-weight: bold;',
        data
      );
    } catch (err) {
      console.warn('⚠️ MOM Hub Dashboard: erreur Supabase, fallback sur chiffres en dur.', err);
      // Pas de plantage : les chiffres en dur restent affichés
    }
  })();

})();
