-- ============================================================
-- FIX — get_evenements_a_venir : évènements multi-équipes visibles
-- ============================================================
-- Bug terrain : un tournoi/plateau (évènement RACINE multi-équipes)
-- a e.equipe_id = NULL (les équipes vivent dans la table d'engagement
-- evenement_equipes_engagees / M3, pas sur la ligne racine). Le filtre
-- « AND (p_equipe_id IS NULL OR e.equipe_id = p_equipe_id) » excluait
-- donc tous les évènements multi-équipes quand l'app passe un
-- p_equipe_id (= UUID de SAR/MOM-M14-1). Résultat : entraînements
-- (equipe_id direct) visibles, compétitions multi-équipes invisibles.
--
-- Fix : garder l'évènement si l'équipe est rattachée DIRECTEMENT
-- (e.equipe_id) OU si elle figure dans les équipes ENGAGÉES (M3).
-- WHERE booléen (pas de JOIN) → aucun doublon possible.
-- Seule la clause de filtre équipe change ; reste identique.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_evenements_a_venir(p_equipe_id uuid DEFAULT NULL::uuid, p_jours_a_venir integer DEFAULT 30)
 RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text, date_debut timestamp with time zone, date_fin timestamp with time zone, equipe_id uuid, equipe_libelle_court text, site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text, domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer, jours_jusqu_a_evenement integer, compo_status_summary jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    e.id,
    e.code,
    e.libelle,
    e.type_evenement,
    e.type_competition,
    e.date_debut,
    e.date_fin,
    e.equipe_id,
    eq.libelle_court AS equipe_libelle_court,
    e.site_id,
    si.libelle_court AS site_libelle_court,
    e.format_de_jeu,
    e.etat,
    e.adversaire_nom,
    e.domicile_exterieur,
    e.evenement_parent_id,
    e.phase_libelle,
    e.ordre_dans_phase,
    EXTRACT(DAY FROM (e.date_debut - NOW()))::INTEGER AS jours_jusqu_a_evenement,
    (
      SELECT jsonb_build_object(
        'total',     COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat = 'brouillon'),
        'validee',   COUNT(*) FILTER (WHERE c.etat = 'validee'),
        'utilisee',  COUNT(*) FILTER (WHERE c.etat = 'utilisee')
      )
      FROM compositions c
      WHERE c.evenement_id = e.id
        AND c.cote        = 'mom'
        AND c.est_active  = TRUE
    ) AS compo_status_summary
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.date_debut >= NOW()
    AND e.date_debut <= NOW() + make_interval(days => p_jours_a_venir)
    AND e.etat NOT IN ('annule', 'archive')
    AND (
      p_equipe_id IS NULL
      OR e.equipe_id = p_equipe_id
      OR EXISTS (
        SELECT 1 FROM evenement_equipes_engagees m3
        WHERE m3.evenement_id = e.id
          AND m3.equipe_id = p_equipe_id
      )
    )
  ORDER BY e.date_debut ASC;
$function$;
