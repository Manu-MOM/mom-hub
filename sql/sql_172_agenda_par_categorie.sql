-- =====================================================================
-- sql_172 — EVT-RATTACHEMENT-CATEGORIE — Étape 6/7 : agenda par catégorie
-- =====================================================================
-- get_evenements_a_venir / get_evenements_passes reçoivent p_categorie_id
-- (dernier paramètre, DEFAULT NULL). Si fourni → filtre e.categorie_id.
-- Comportement inchangé si NULL (compat appels existants). DROP + CREATE
-- (signature élargie → anti-overload PGRST203).
--
-- Exécuté et vérifié : signatures uniques ; filtre M14=30 / SR-F=0 / null=30.
-- =====================================================================

drop function if exists public.get_evenements_a_venir(uuid,integer);

CREATE FUNCTION public.get_evenements_a_venir(
  p_equipe_id uuid DEFAULT NULL,
  p_jours_a_venir integer DEFAULT 30,
  p_categorie_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text,
  date_debut timestamptz, date_fin timestamptz, equipe_id uuid, equipe_libelle_court text,
  site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text,
  domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer,
  jours_jusqu_a_evenement integer, compo_status_summary jsonb, debut_match time, fin_prevue time,
  rdv_heure time, rdv_lieu text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.code, e.libelle, e.type_evenement, e.type_competition, e.date_debut, e.date_fin,
    e.equipe_id, eq.libelle_court, e.site_id, si.libelle_court, e.format_de_jeu, e.etat,
    e.adversaire_nom, e.domicile_exterieur, e.evenement_parent_id, e.phase_libelle, e.ordre_dans_phase,
    EXTRACT(DAY FROM (e.date_debut - NOW()))::INTEGER,
    (SELECT jsonb_build_object('total', COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat='brouillon'),
        'validee', COUNT(*) FILTER (WHERE c.etat='validee'),
        'utilisee', COUNT(*) FILTER (WHERE c.etat='utilisee'))
      FROM compositions c WHERE c.evenement_id=e.id AND c.cote='mom' AND c.est_active=TRUE),
    e.debut_match, e.fin_prevue, e.rdv_heure, e.rdv_lieu
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id=e.equipe_id
  LEFT JOIN sites si ON si.id=e.site_id
  WHERE e.date_debut >= NOW()
    AND e.date_debut <= NOW() + make_interval(days => p_jours_a_venir)
    AND e.etat NOT IN ('annule','archive')
    AND (p_categorie_id IS NULL OR e.categorie_id = p_categorie_id)
    AND (
      p_equipe_id IS NULL
      OR e.equipe_id = p_equipe_id
      OR EXISTS (SELECT 1 FROM evenement_equipes_engagees m3
                 WHERE m3.evenement_id=e.id AND m3.equipe_id=p_equipe_id)
      OR EXISTS (SELECT 1 FROM evenements parent
                 JOIN evenement_equipes_engagees m3r ON m3r.evenement_id=parent.id
                 WHERE m3r.equipe_id=p_equipe_id
                   AND parent.id IN (e.evenement_parent_id,
                     (SELECT pp.evenement_parent_id FROM evenements pp WHERE pp.id=e.evenement_parent_id)))
    )
  ORDER BY e.date_debut ASC;
$function$;

drop function if exists public.get_evenements_passes(uuid,integer,integer);

CREATE FUNCTION public.get_evenements_passes(
  p_equipe_id uuid DEFAULT NULL,
  p_jours_passes integer DEFAULT 30,
  p_limit integer DEFAULT 50,
  p_categorie_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text,
  date_debut timestamptz, date_fin timestamptz, equipe_id uuid, equipe_libelle_court text,
  site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text,
  domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer,
  jours_depuis_evenement integer, compo_status_summary jsonb, debut_match time, fin_prevue time,
  rdv_heure time, rdv_lieu text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.code, e.libelle, e.type_evenement, e.type_competition, e.date_debut, e.date_fin,
    e.equipe_id, eq.libelle_court, e.site_id, si.libelle_court, e.format_de_jeu, e.etat,
    e.adversaire_nom, e.domicile_exterieur, e.evenement_parent_id, e.phase_libelle, e.ordre_dans_phase,
    EXTRACT(DAY FROM (NOW() - e.date_debut))::INTEGER,
    (SELECT jsonb_build_object('total', COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat='brouillon'),
        'validee', COUNT(*) FILTER (WHERE c.etat='validee'),
        'utilisee', COUNT(*) FILTER (WHERE c.etat='utilisee'))
      FROM compositions c WHERE c.evenement_id=e.id AND c.cote='mom' AND c.est_active=TRUE),
    e.debut_match, e.fin_prevue, e.rdv_heure, e.rdv_lieu
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id=e.equipe_id
  LEFT JOIN sites si ON si.id=e.site_id
  WHERE e.date_debut < NOW()
    AND e.date_debut >= NOW() - make_interval(days => p_jours_passes)
    AND e.etat NOT IN ('archive')
    AND (p_categorie_id IS NULL OR e.categorie_id = p_categorie_id)
    AND (
      p_equipe_id IS NULL
      OR e.equipe_id = p_equipe_id
      OR EXISTS (SELECT 1 FROM evenement_equipes_engagees m3
                 WHERE m3.evenement_id=e.id AND m3.equipe_id=p_equipe_id)
      OR EXISTS (SELECT 1 FROM evenements parent
                 JOIN evenement_equipes_engagees m3r ON m3r.evenement_id=parent.id
                 WHERE m3r.equipe_id=p_equipe_id
                   AND parent.id IN (e.evenement_parent_id,
                     (SELECT pp.evenement_parent_id FROM evenements pp WHERE pp.id=e.evenement_parent_id)))
    )
  ORDER BY e.date_debut DESC
  LIMIT p_limit;
$function$;
