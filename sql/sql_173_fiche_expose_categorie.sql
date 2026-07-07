-- =====================================================================
-- sql_173 — EVT-RATTACHEMENT-CATEGORIE — fiche : expose categorie_id
-- =====================================================================
-- get_evenement_with_encadrants renvoie categorie_id (après equipe_id) pour
-- que la fiche liste les équipes du club de la catégorie de l'événement
-- (au lieu de M14 figé). Signature de retour élargie → DROP + CREATE.
--
-- Exécuté et vérifié : signature unique.
-- =====================================================================

drop function if exists public.get_evenement_with_encadrants(uuid);

CREATE FUNCTION public.get_evenement_with_encadrants(p_evenement_id uuid)
RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text,
  date_debut timestamptz, date_fin timestamptz, equipe_id uuid, categorie_id uuid,
  equipe_libelle_court text, site_id uuid, site_libelle_court text, format_de_jeu text,
  etat text, adversaire_nom text, domicile_exterieur text, evenement_parent_id uuid,
  phase_libelle text, ordre_dans_phase integer, score_mom integer, score_adverse integer,
  logistique_deplacement jsonb, notes_internes text, debut_match time, fin_prevue time,
  rdv_heure time, rdv_lieu text, compo_status_summary jsonb, encadrants jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.code, e.libelle, e.type_evenement, e.type_competition, e.date_debut, e.date_fin,
    e.equipe_id, e.categorie_id, eq.libelle_court, e.site_id, si.libelle_court, e.format_de_jeu,
    e.etat, e.adversaire_nom, e.domicile_exterieur, e.evenement_parent_id, e.phase_libelle,
    e.ordre_dans_phase, e.score_mom, e.score_adverse, e.logistique_deplacement, e.notes_internes,
    e.debut_match, e.fin_prevue, e.rdv_heure, e.rdv_lieu,
    (SELECT jsonb_build_object('total', COUNT(*),
        'brouillon', COUNT(*) FILTER (WHERE c.etat='brouillon'),
        'validee', COUNT(*) FILTER (WHERE c.etat='validee'),
        'utilisee', COUNT(*) FILTER (WHERE c.etat='utilisee'))
      FROM compositions c WHERE c.evenement_id=e.id AND c.cote='mom' AND c.est_active=TRUE),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'personne_id', ee.personne_id, 'nom', p.nom, 'prenom', p.prenom,
          'roles_encadrement', ee.roles_encadrement, 'ordre', ee.ordre, 'notes', ee.notes)
        ORDER BY ee.ordre NULLS LAST, ee.date_creation ASC)
      FROM evenement_encadrants ee JOIN personnes p ON p.id=ee.personne_id
      WHERE ee.evenement_id=e.id), '[]'::jsonb)
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id=e.equipe_id
  LEFT JOIN sites si ON si.id=e.site_id
  WHERE e.id = p_evenement_id;
$function$;
