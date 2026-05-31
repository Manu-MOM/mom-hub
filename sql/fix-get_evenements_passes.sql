-- ============================================================
-- FIX v7 — get_evenements_passes : tournoi multi-équipes + HORAIRES
-- ============================================================
-- v7 : remonte aussi les colonnes horaires détaillés (debut_match,
-- fin_prevue, rdv_heure, rdv_lieu) pour l'affichage en fiche. Filtre
-- équipe v6 (descendants des 2 équipes) conservé.
-- ============================================================
-- Même évolution que get_evenements_a_venir v6 : charge les descendants
-- (phases + matchs des DEUX équipes) d'un tournoi passé où l'équipe est
-- engagée. Seule la clause de filtre équipe change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_evenements_passes(p_equipe_id uuid DEFAULT NULL::uuid, p_jours_passes integer DEFAULT 30, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text, date_debut timestamp with time zone, date_fin timestamp with time zone, equipe_id uuid, equipe_libelle_court text, site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text, domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer, jours_depuis_evenement integer, compo_status_summary jsonb, debut_match time without time zone, fin_prevue time without time zone, rdv_heure time without time zone, rdv_lieu text)
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
    EXTRACT(DAY FROM (NOW() - e.date_debut))::INTEGER AS jours_depuis_evenement,
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
    ) AS compo_status_summary,
    -- v7 (étape 4 horaires détaillés) — remontée pour affichage fiche.
    e.debut_match,
    e.fin_prevue,
    e.rdv_heure,
    e.rdv_lieu
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.date_debut <  NOW()
    AND e.date_debut >= NOW() - make_interval(days => p_jours_passes)
    AND e.etat NOT IN ('archive')
    AND (
      p_equipe_id IS NULL
      OR e.equipe_id = p_equipe_id
      OR EXISTS (
        SELECT 1 FROM evenement_equipes_engagees m3
        WHERE m3.evenement_id = e.id
          AND m3.equipe_id = p_equipe_id
      )
      -- v6 — descendant (phase/match) d'un tournoi où l'équipe est engagée.
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
  ORDER BY e.date_debut DESC
  LIMIT p_limit;
$function$;
