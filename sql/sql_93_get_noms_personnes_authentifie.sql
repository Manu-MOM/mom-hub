-- =====================================================================
-- get_noms_personnes : ouverture à tout utilisateur authentifié
-- Dette : COMPO-AFFICHAGE-JOUEURS
--
-- CONTEXTE
--   Un referent (Vivien, M14) n'affiche pas les joueurs d'une compo
--   Collectif/N3 (« Challenge Vié ») : la voie de resolution des noms
--   du groupe engagé passe par listGroupeEngage -> _resolveNoms ->
--   get_noms_personnes. Cette RPC porte une garde has_role('admin')
--   OR has_role('coach') -> 42501 pour un referent (ni admin ni coach,
--   coach non attribuable). Noms non resolus -> vivier sans noms ->
--   compo « vide ». Même défaut qu'au pt 86 (greeting).
--
-- DÉCISION (Manu)
--   La fonction n'expose QUE id/nom/prenom de personnes dont l'appelant
--   détient déjà les UUID (joueurs déjà à l'écran). Aucune donnée
--   sensible. Conformément à l'invariant du modèle de droits
--   (FAITFOI-modele-roles-encadrants, §6 : « lecture SELECT ouverte à
--   tout authentifié ; seule l'écriture est modulée par catégorie »),
--   la garde admin|coach est une anomalie de lecture. On l'aligne sur
--   « tout utilisateur authentifié ». Le périmètre par catégorie/pôle
--   relève de l'ÉCRITURE et d'un chantier dédié, pas de la résolution
--   de noms.
--
-- PORTÉE
--   - Projection STRICTE id/nom/prenom INCHANGÉE (jamais de colonne
--     sensible).
--   - SECURITY DEFINER + search_path INCHANGÉS.
--   - Seule la garde de rôle est remplacée par un contrôle
--     d'authentification (auth.uid() IS NOT NULL).
--   - RGPD-lock `personnes` intact : la lecture reste bornée aux UUID
--     fournis, via cette voie SECURITY DEFINER dédiée.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_noms_personnes(p_personne_uuids uuid[])
RETURNS TABLE(personne_id uuid, nom text, prenom text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Garde : tout utilisateur AUTHENTIFIÉ (la fonction bypasse la RLS,
    -- mais n'expose que id/nom/prenom de UUID déjà détenus par
    -- l'appelant). Aligné sur l'invariant « lecture ouverte à tout
    -- authentifié » du modèle de droits (remplace l'ancienne garde
    -- admin|coach, qui bloquait les referent — dette
    -- COMPO-AFFICHAGE-JOUEURS).
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'get_noms_personnes : accès refusé (authentification requise).'
            USING ERRCODE = '42501';   -- insufficient_privilege
    END IF;

    IF p_personne_uuids IS NULL OR array_length(p_personne_uuids, 1) IS NULL THEN
        RETURN;   -- aucun uuid -> 0 ligne (dégradation honnête)
    END IF;

    RETURN QUERY
    SELECT p.id, p.nom, p.prenom
      FROM personnes p
     WHERE p.id = ANY (p_personne_uuids);
    -- Projection STRICTE id/nom/prenom -- jamais une colonne sensible.
END;
$function$;

-- ---------------------------------------------------------------------
-- Vérification fail-loud : la nouvelle garde ne doit plus mentionner
-- has_role, et la fonction doit toujours être SECURITY DEFINER.
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
    v_def text;
BEGIN
    SELECT pg_get_functiondef(p.oid)
      INTO v_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'get_noms_personnes'
       AND p.prokind = 'f';

    IF v_def IS NULL THEN
        RAISE EXCEPTION 'VERIF: get_noms_personnes introuvable après migration.';
    END IF;

    IF position('has_role' IN v_def) > 0 THEN
        RAISE EXCEPTION 'VERIF: la garde has_role est toujours présente (migration incomplète).';
    END IF;

    IF position('auth.uid()' IN v_def) = 0 THEN
        RAISE EXCEPTION 'VERIF: la garde auth.uid() est absente (migration incorrecte).';
    END IF;

    IF position('SECURITY DEFINER' IN upper(v_def)) = 0 THEN
        RAISE EXCEPTION 'VERIF: SECURITY DEFINER perdu (régression).';
    END IF;

    RAISE NOTICE 'VERIF OK: get_noms_personnes ouverte à tout authentifié, SECURITY DEFINER conservé.';
END
$verif$;
