-- ============================================================
-- RPC : pilotage_categorie_lignes(p_categorie_id uuid)
-- pt 63 — Pilotage catégorie / saison (collectif M14, toutes équipes)
--
-- Renvoie 1 ligne par (joueur × équipe × rôle × poste × match) pour
-- les compositions de MATCH (compétition) actives côté MOM des équipes
-- de la catégorie. Le client agrège (stats-saison.js renderPilotageCategorie).
--
-- Chemin (prouvé par sondes S5/S7/S10, base fait foi) :
--   composition_joueurs → compositions(match, cote=mom, est_active)
--     → compo_base_origine_id → compositions(base)
--     → evenement_equipe_id → evenement_equipes_engagees → equipe_id
--     → equipes(nom_officiel) → ententes(categorie_id = p_categorie_id)
--   poste : composition_joueurs.poste_id est TEXT(uuid) → cast ::uuid.
--
-- SECURITY DEFINER : personnes/compositions sont en RLS ; la RPC
-- bypasse la RLS et applique SON PROPRE contrôle (has_role admin|coach),
-- motif get_joueurs_equipe / get_vivier_compo (sql/33).
--
-- nom_officiel = SEUL champ équipe fiable (S3 : libelle_court NULL +
-- numero_equipe cassé sur M14-2/M14-3). On NE renvoie PAS les noms de
-- joueurs ici (résolus côté client via get_noms_personnes / _resolveNoms,
-- RPC dédiée déjà gardée). Idempotent (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.pilotage_categorie_lignes(p_categorie_id uuid)
RETURNS TABLE (
  joueur_id    uuid,
  equipe_nom   text,
  equipe_id    uuid,
  role         text,
  poste_id     uuid,
  numero_xv    integer,
  poste_court  text,
  depannage    boolean,
  evenement_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Contrôle d'accès porté par la RPC (RLS bypassée par SECURITY DEFINER).
  IF NOT (public.has_role('admin') OR public.has_role('coach')) THEN
    RAISE EXCEPTION 'pilotage_categorie_lignes : accès refusé (rôle admin|coach requis).'
      USING ERRCODE = '42501';
  END IF;

  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'pilotage_categorie_lignes : p_categorie_id requis.'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT cj.joueur_id,
         e.nom_officiel                       AS equipe_nom,
         e.id                                 AS equipe_id,
         cj.role,
         p.id                                 AS poste_id,
         p.numero_xv,
         p.libelle_court                      AS poste_court,
         cj.est_depannage_hors_categorie      AS depannage,
         cm_match.evenement_id
  FROM composition_joueurs cj
  JOIN compositions cm_match
         ON cm_match.id = cj.composition_id
        AND cm_match.cote = 'mom'
        AND cm_match.type_compo = 'match'
        AND cm_match.est_active = true
  JOIN compositions cm_base
         ON cm_base.id = cm_match.compo_base_origine_id
  JOIN evenement_equipes_engagees eee
         ON eee.id = cm_base.evenement_equipe_id
  JOIN equipes e
         ON e.id = eee.equipe_id
  JOIN ententes ent
         ON ent.id = e.entente_id
        AND ent.categorie_id = p_categorie_id
  LEFT JOIN postes p
         ON p.id = cj.poste_id::uuid
  WHERE cj.role IN ('titulaire', 'remplacant');
END;
$$;

GRANT EXECUTE ON FUNCTION public.pilotage_categorie_lignes(uuid) TO authenticated;
