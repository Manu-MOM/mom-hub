-- ============================================================
-- FIX v6 — get_evenements_a_venir : tournoi multi-équipes COMPLET
-- ============================================================
-- v5 (rappel) : un tournoi racine (e.equipe_id NULL) était exclu car le
-- filtre testait e.equipe_id = p_equipe_id → ajout EXISTS sur M3.
--
-- v6 : les MATCHS d'un tournoi sont des petits-enfants (racine→phase→
-- match). Ceux de l'équipe 2 (equipe_id=M14-2) n'étaient pas chargés
-- quand l'app filtre sur M14-1 → la fiche ne montrait pas leurs matchs.
-- Ajout d'une branche : charger tout descendant (phase ou match) dont la
-- RACINE (jusqu'à 2 niveaux au-dessus) porte l'engagement de l'équipe.
-- Charge ainsi les matchs des DEUX équipes engagées.
-- Seule la clause de filtre équipe change.
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
      -- équipe engagée directement sur CET évènement (racine multi-équipes)
      OR EXISTS (
        SELECT 1 FROM evenement_equipes_engagees m3
        WHERE m3.evenement_id = e.id
          AND m3.equipe_id = p_equipe_id
      )
      -- v6 — descendant (phase ou match) d'un tournoi où l'équipe est
      -- engagée : on remonte jusqu'à 2 niveaux (match→phase→racine) et on
      -- garde si la racine porte l'engagement. Charge ainsi les matchs des
      -- DEUX équipes engagées (M14-1 ET M14-2), pas seulement equipe_id=p.
      OR EXISTS (
        SELECT 1
        FROM evenements parent
        JOIN evenement_equipes_engagees m3r ON m3r.evenement_id = parent.id
        WHERE m3r.equipe_id = p_equipe_id
          AND parent.id IN (
            e.evenement_parent_id,
            (SELECT pp.evenement_parent_id FROM evenements pp WHERE pp.id = e.evenement_parent_id)
          )
      )
    )
  ORDER BY e.date_debut ASC;
$function$;
