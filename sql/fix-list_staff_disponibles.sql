-- ============================================================
-- RPC list_staff_disponibles — filtre catégorie optionnel (fonction_staff)
-- ============================================================
-- Étape 1/3 du câblage « staff de la catégorie » à la création d'évènement.
--
-- AVANT : renvoyait TOUT le staff du club (personnes.categorie_personne
-- ILIKE '%staff%'), toutes catégories confondues → la zone Encadrement du
-- formulaire listait les 46.
--
-- APRÈS : paramètre p_categorie_id uuid DEFAULT NULL.
--   • NULL (défaut)  → comportement INCHANGÉ (tout le staff du club).
--                      = mode « Afficher tout le staff du club » (case cochée).
--   • non NULL       → uniquement les personnes ayant une FONCTION ACTIVE
--                      (fonction_staff.date_fin IS NULL) dans cette catégorie.
--                      = staff de la catégorie (M14 par défaut).
--
-- Rétro-compatible (param optionnel). Retour INCHANGÉ {personne_id,nom,
-- prenom} → pas de « cannot change return type ». Garde has_role('admin')
-- CONSERVÉE telle quelle (décision sécurité existante, non touchée).
--
-- NB : un membre peut avoir plusieurs fonctions actives → DISTINCT pour
-- éviter les doublons de ligne.
--
-- Après exécution : NOTIFY pgrst (la signature change avec le nouveau param).
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_staff_disponibles(p_categorie_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(personne_id uuid, nom text, prenom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.id AS personne_id, p.nom, p.prenom
  FROM public.personnes p
  WHERE public.has_role('admin')
    AND p.categorie_personne ILIKE '%staff%'
    AND (
      p_categorie_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.fonction_staff fs
        WHERE fs.personne_id = p.id
          AND fs.categorie_id = p_categorie_id
          AND fs.date_fin IS NULL
      )
    )
  ORDER BY p.nom ASC, p.prenom ASC;
$function$;

NOTIFY pgrst, 'reload schema';
