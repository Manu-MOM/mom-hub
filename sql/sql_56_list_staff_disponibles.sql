-- =====================================================================
-- MOM Hub · sql/56 — RPC list_staff_disponibles()
-- =====================================================================
-- Chantier : Production · Écran de gestion du staff (collectif N1).
-- Objet    : alimenter la PIOCHE STAFF de u-admin (option A, déroulante
--            des personnes staff) sans exposer la table `personnes` au
--            client.
--
-- POURQUOI une RPC SECURITY DEFINER, et pas un SELECT client :
--   `personnes` a 0 policy RLS (sonde 28/05, actée v1.33 supabase-client)
--   => tout SELECT client direct revient vide. Le seul chemin de lecture
--   est une RPC SECURITY DEFINER gardée, exactement comme get_noms_personnes
--   (sql/47) et apercu_bascule (sql/53). On réplique ce patron éprouvé.
--
-- FILTRE STAFF (établi à la source, anti-fabrication pt 14) :
--   La distinction joueur/staff vit dans `personnes.categorie_personne`
--   (TEXT), PAS dans une colonne `role` (inexistante) ni `type_personne`.
--   Sonde 28/05 GROUP BY categorie_personne :
--     staff (23) + parent_et_staff (22) + joueur_et_parent_et_staff (1) = 46
--   => filtre = categorie_personne ILIKE '%staff%' (capture les profils
--      composites sans les énumérer ; pendant exact du filtre joueur
--      ILIKE '%joueur%' = 301/302 de la sonde 5). Résultat attendu : 46.
--
-- RGPD / payload minimal : on ne renvoie QUE {personne_id, nom, prenom}
--   (identité d'affichage de la pioche), jamais les colonnes sensibles
--   de `personnes`. Même surface que get_noms_personnes.
--
-- DOUBLONS ATTENDUS (IDENT-DOUBLONS-JOUEUR-STAFF, NON résolu ici) :
--   BELKIS / HELM / VOEGELI ont 2 fiches `personnes` (1 joueur + 1 staff,
--   personne_id distincts) -> leur fiche staff apparaît ici, légitimement,
--   en tant que ligne staff. RULFO = 1 seule fiche joueur_et_parent_et_staff
--   (vrai double-rôle, pas un doublon) -> 1 ligne. Relève d'IDENT-SYS.
--
-- Garde : has_role('admin') — même garde que les RPC admin de sql/53.
--   L'écran u-admin est admin-strict (UA-1). Une catégorie non-admin
--   n'atteint jamais cet appel (auth-gate page), mais la RPC se garde
--   elle-même (défense en profondeur, jamais de confiance au client).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.list_staff_disponibles()
RETURNS TABLE (
  personne_id uuid,
  nom         text,
  prenom      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS personne_id, p.nom, p.prenom
  FROM public.personnes p
  WHERE public.has_role('admin')
    AND p.categorie_personne ILIKE '%staff%'
  ORDER BY p.nom ASC, p.prenom ASC;
$$;

-- La garde has_role('admin') est DANS le WHERE : si l'appelant n'est pas
-- admin, la fonction renvoie 0 ligne (pas d'erreur bruyante, dégradation
-- honnête côté client — le wrapper retombe sur []). Patron identique aux
-- RPC SECURITY DEFINER gardées de sql/47 et sql/53.

REVOKE ALL ON FUNCTION public.list_staff_disponibles() FROM public;
GRANT EXECUTE ON FUNCTION public.list_staff_disponibles() TO authenticated;

-- =====================================================================
-- VÉRIFICATION (à exécuter après le CREATE, en session admin) :
--   SELECT count(*) FROM list_staff_disponibles();   -- attendu : 46
--   SELECT * FROM list_staff_disponibles() LIMIT 5;  -- {personne_id,nom,prenom}
-- =====================================================================
