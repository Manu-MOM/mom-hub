-- ============================================================
-- FIX — get_evenement_with_encadrants : remonte les horaires détaillés
-- ============================================================
-- Cette RPC alimente la FICHE (openFiche → getEvenementWithEncadrants),
-- distincte de get_evenements_a_venir/passes (qui alimentent les LISTES).
-- Son RETURNS TABLE ne listait pas les colonnes horaires → evt.debut_match
-- undefined dans la fiche, d'où « non saisi » malgré la base.
--
-- Fix : ajout de debut_match / fin_prevue / rdv_heure / rdv_lieu au
-- RETURNS TABLE et au SELECT (après notes_internes). Aucune autre logique
-- modifiée (encadrants, compo_status_summary, score, logistique intacts).
--
-- IMPORTANT après exécution : changement de type de retour → il faut
-- DROP d'abord (cannot change return type), puis recréer, puis recharger
-- le cache PostgREST :  NOTIFY pgrst, 'reload schema';
-- ============================================================

DROP FUNCTION IF EXISTS get_evenement_with_encadrants(uuid);

CREATE OR REPLACE FUNCTION public.get_evenement_with_encadrants(p_evenement_id uuid)
 RETURNS TABLE(id uuid, code text, libelle text, type_evenement text, type_competition text, date_debut timestamp with time zone, date_fin timestamp with time zone, equipe_id uuid, equipe_libelle_court text, site_id uuid, site_libelle_court text, format_de_jeu text, etat text, adversaire_nom text, domicile_exterieur text, evenement_parent_id uuid, phase_libelle text, ordre_dans_phase integer, score_mom integer, score_adverse integer, logistique_deplacement jsonb, notes_internes text, debut_match time without time zone, fin_prevue time without time zone, rdv_heure time without time zone, rdv_lieu text, compo_status_summary jsonb, encadrants jsonb)
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
    e.score_mom,
    e.score_adverse,
    e.logistique_deplacement,
    e.notes_internes,
    -- Horaires détaillés (remontés pour l'affichage en fiche)
    e.debut_match,
    e.fin_prevue,
    e.rdv_heure,
    e.rdv_lieu,
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
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'personne_id',       ee.personne_id,
            'nom',               p.nom,
            'prenom',            p.prenom,
            'roles_encadrement', ee.roles_encadrement,
            'ordre',             ee.ordre,
            'notes',             ee.notes
          )
          ORDER BY ee.ordre NULLS LAST, ee.date_creation ASC
        )
        FROM evenement_encadrants ee
        JOIN personnes p ON p.id = ee.personne_id
        WHERE ee.evenement_id = e.id
      ),
      '[]'::jsonb
    ) AS encadrants
  FROM evenements e
  LEFT JOIN equipes eq ON eq.id = e.equipe_id
  LEFT JOIN sites   si ON si.id = e.site_id
  WHERE e.id = p_evenement_id;
$function$;

-- Recharge le cache de schéma PostgREST (sinon le client reçoit l'ancienne
-- structure de retour, sans les colonnes horaires).
NOTIFY pgrst, 'reload schema';
