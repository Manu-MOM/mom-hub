-- =====================================================================
-- MOM Hub · C12-g · En-tête rencontre RGPD-safe + rôle du jeton
-- =====================================================================
-- Dettes Production SUIVI-UI-1 (en-tête rencontre) + SUIVI-UI-6
-- (rôle du jeton lisible côté client) — absorbées en UNE RPC.
--
-- Sources de vérité (lues à la source, rien inventé) :
--   • sql/C12-f-lien-ephemere.sql : helper valider_lien_suivi,
--     posture de grant de get_compo_reduite_rencontre (anon +
--     authenticated), table lien_suivi (colonne `role` existante)
--   • Modelisation-Evenements-v1.1.md §4.2 : schéma RÉEL `evenements`
--     (libelle, type_competition, date_debut, adversaire_nom,
--      domicile_exterieur, site_uuid FK sites) — non inventé
--   • Modelisation-Evenements-v1.1.md §4.6 : schéma RÉEL `sites`
--     (libelle, libelle_court, ville) — non inventé
--   • Cadrage-SUIVI-COACH-1-Dettes-Backend.md §2 : pistes minimales
-- Pré-requis : C12-f (lien_suivi + valider_lien_suivi déployés).
--
-- POURQUOI UNE SEULE RPC (doctrine simplicité, piggy-back §2/§5 du
-- cadrage) : SUIVI-UI-6 ne demande que le rôle du jeton. L'ajouter au
-- retour d'une RPC de lecture jeton-bornée déjà nécessaire (l'en-tête)
-- évite un aller-retour réseau et une RPC de plus. Sûr : la RPC
-- renvoie le rôle DU jeton passé, jamais celui d'un autre — un
-- spectateur apprend qu'il est spectateur, aucune escalade possible.
--
-- RGPD (P6) : STRICTEMENT aucune donnée personnelle. Uniquement des
-- champs d'en-tête de rencontre + un libellé de site (lieu, public).
-- Aucune jointure vers personnes / composition_joueurs.
--
-- HORS PÉRIMÈTRE ASSUMÉ (remonté pour décision, non codé ici) : la
-- catégorie d'âge (« M14 ») n'est pas sur `evenements`. Elle exige la
-- chaîne equipe_uuid -> equipes -> ententes.categorie_id ->
-- categories (4 sauts) + le schéma `categories` à vérifier à la
-- source. type_competition (championnat/amical/coupe/tournoi) est
-- déjà fourni ci-dessous. Ajout de la catégorie d'âge = décision Manu
-- (voir note de fin).
--
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RPC : en-tête rencontre RGPD-safe + rôle du jeton
--   (1) valide le jeton via valider_lien_suivi(p_token, NULL)
--       → lecture : un jeton 'saisie' OU 'spectateur' est accepté
--   (2) renvoie les champs d'en-tête de `evenements` + libellé de
--       site + le rôle du jeton porteur (SUIVI-UI-6)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_entete_rencontre(
    p_token TEXT
) RETURNS TABLE (
    libelle            TEXT,
    type_competition   TEXT,
    date_debut         TIMESTAMPTZ,
    adversaire_nom     TEXT,
    domicile_exterieur TEXT,
    site_libelle       TEXT,
    role_lien          TEXT          -- SUIVI-UI-6 : rôle du jeton porteur
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evt  UUID;
    v_role TEXT;
BEGIN
    -- Lecture : les 2 rôles peuvent lire l'en-tête (NULL = pas de
    -- contrainte de rôle). Lève si invalide / révoqué / expiré.
    v_evt := valider_lien_suivi(p_token, NULL);

    -- Rôle DU jeton passé (jamais celui d'un autre jeton).
    SELECT ls.role INTO v_role FROM lien_suivi ls WHERE ls.token = p_token;

    RETURN QUERY
    SELECT e.libelle,
           e.type_competition,
           e.date_debut,
           e.adversaire_nom,
           e.domicile_exterieur,
           COALESCE(s.libelle_court, s.libelle, s.ville),
           v_role
    FROM   evenements e
    LEFT   JOIN sites s ON s.id = e.site_uuid
    WHERE  e.id = v_evt;
END;
$$;

-- ---------------------------------------------------------------------
-- Surface d'accès — même posture que get_compo_reduite_rencontre
-- (porteur d'un lien : clé anon + jeton ; ET coach authentifié).
-- Table fermée → on n'ouvre QUE la RPC.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION get_entete_rencontre(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_entete_rencontre(TEXT) TO anon, authenticated;

-- =====================================================================
-- FIN C12-g. SUIVI-UI-1 + SUIVI-UI-6 livrées en 1 RPC, 0 nouveau
-- schéma. Reste de ce couloir : C12-h (SUIVI-COACH-2), puis
-- SUIVI-UI-5 (en attente de C12-e à la source).
-- =====================================================================
