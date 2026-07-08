-- =====================================================================
-- sql_183 — EVT-SERIE-VISIBILITE : exposition de la colonne `recurrence`
--           dans les 3 RPC de lecture d'évènements.
--
-- CONTEXTE
--   Le bouton « 📅 Voir la série » (EVT-SERIE-ECRAN) ne s'affichait pas :
--   le helper front _estMereRecurrente(evt) teste evt.recurrence, or les
--   3 RPC qui alimentent la liste ET la fiche détaillée ne renvoyaient PAS
--   la colonne recurrence. L'objet côté front n'avait donc jamais ce champ
--   -> mère non détectée -> bouton (et badges) absents.
--
-- CORRECTIF
--   Ajout de `recurrence jsonb` en DERNIÈRE colonne du RETURNS TABLE et du
--   SELECT des 3 RPC (ordre des colonnes existantes inchangé) :
--     - get_evenement_with_encadrants  (fiche détaillée : bouton + pastille)
--     - get_evenements_a_venir         (carte liste : badge « Série »)
--     - get_evenements_passes          (mère toujours identifiée une fois passée)
--
--   Changement de signature TABLE -> DROP FUNCTION IF EXISTS + CREATE dans
--   le même script (évite PGRST203). LANGUAGE sql / STABLE / SECURITY
--   DEFINER conservés. Corps identiques au déployé, seule la colonne
--   recurrence est ajoutée. Wrapper front supabase-client.js NON modifié
--   (renvoie l'objet brut, recurrence remonte naturellement).
--
--   Vérifié en base : la mère 8ec52d8f renvoie recurrence={fin,mode,frequence}
--   dans les 3 RPC ; encadrants intacts (nb=2) sur get_evenement_with_encadrants.
-- =====================================================================

DROP FUNCTION IF EXISTS public.get_evenement_with_encadrants(p_evenement_id uuid);
CREATE OR REPLACE FUNCTION public.get_evenement_with_encadrants(p_evenement_id uuid)
 RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text, date_debut timestamp with time zone, date_fin timestamp with time zone, equipe_id uuid, categorie_id uuid, equipe_libelle_court text, site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text, domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer, score_mom integer, score_adverse integer, logistique_deplacement jsonb, notes_internes text, debut_match time without time zone, fin_prevue time without time zone, rdv_heure time without time zone, rdv_lieu text, compo_status_summary jsonb, encadrants jsonb, recurrence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
      WHERE ee.evenement_id=e.id), '[]'::jsonb),
    e.recurrence
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id=e.equipe_id
  LEFT JOIN sites si ON si.id=e.site_id
  WHERE e.id = p_evenement_id;
$function$
;


DROP FUNCTION IF EXISTS public.get_evenements_a_venir(p_equipe_id uuid, p_jours_a_venir integer, p_categorie_id uuid);
CREATE OR REPLACE FUNCTION public.get_evenements_a_venir(p_equipe_id uuid DEFAULT NULL::uuid, p_jours_a_venir integer DEFAULT 30, p_categorie_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text, date_debut timestamp with time zone, date_fin timestamp with time zone, equipe_id uuid, equipe_libelle_court text, site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text, domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer, jours_jusqu_a_evenement integer, compo_status_summary jsonb, debut_match time without time zone, fin_prevue time without time zone, rdv_heure time without time zone, rdv_lieu text, recurrence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    e.debut_match, e.fin_prevue, e.rdv_heure, e.rdv_lieu, e.recurrence
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
$function$
;


DROP FUNCTION IF EXISTS public.get_evenements_passes(p_equipe_id uuid, p_jours_passes integer, p_limit integer, p_categorie_id uuid);
CREATE OR REPLACE FUNCTION public.get_evenements_passes(p_equipe_id uuid DEFAULT NULL::uuid, p_jours_passes integer DEFAULT 30, p_limit integer DEFAULT 50, p_categorie_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text, date_debut timestamp with time zone, date_fin timestamp with time zone, equipe_id uuid, equipe_libelle_court text, site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text, domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer, jours_depuis_evenement integer, compo_status_summary jsonb, debut_match time without time zone, fin_prevue time without time zone, rdv_heure time without time zone, rdv_lieu text, recurrence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    e.debut_match, e.fin_prevue, e.rdv_heure, e.rdv_lieu, e.recurrence
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
$function$
;

