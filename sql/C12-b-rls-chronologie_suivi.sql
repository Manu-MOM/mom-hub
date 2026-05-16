-- =====================================================================
-- MOM Hub · C12-b · RLS chronologie_suivi (table fermée)
-- =====================================================================
-- Dette Production C12-b (= ancienne dette C11-f de l'audit Suivi v2.1).
-- Source de vérité : Modelisation-Chronologie-Suivi-v1.md  v1.1, §5.
-- Pré-requis : C12-a (table chronologie_suivi créée).
--
-- DÉCISION D'ARCHITECTURE (conforme à la recommandation forte §5.2)
-- -----------------------------------------------------------------
-- La modélisation recommande EXPLICITEMENT de NE PAS écrire des
-- policies RLS colonne par colonne (jugées « fragiles et difficiles
-- à maintenir »), mais d'exposer des RPC SECURITY DEFINER qui
-- encapsulent exactement les gestes permis, et de FERMER l'écriture
-- et la lecture directes de la table. C'est le pattern projet
-- éprouvé en Phase 5.14.
--
-- Conséquence : C12-b ne crée AUCUNE policy permissive. La table est
-- une « table fermée » :
--   • RLS activée (défense en profondeur)
--   • aucun privilège direct pour anon / authenticated
--   • tout accès passe par des RPC SECURITY DEFINER :
--       - écriture -> C12-c (inserer/annuler/corriger ; les
--                     garde-fous du lien éphémère vivent DANS ces
--                     RPC, modélisation §6.1)
--       - lecture  -> C12-d (get_chronologie_rencontre, payload
--                     réduit RGPD, §6.3)
--       - lien     -> C12-f (generer_lien_ephemere, §6 / §9.1)
--   • DELETE : jamais (aucune voie : ni policy, ni RPC) — une
--     saisie erronée se met annule = TRUE (modélisation §5.1).
--
-- Ce que C12-b ne fait PAS (volontairement — anti-anticipation, P1) :
--   le mécanisme d'authentification du lien éphémère (JWT court
--   signé, claim portant l'evenement_uuid autorisé) RELÈVE de
--   Production via C12-f. L'écrire ici, AVANT C12-f qui définit ce
--   mécanisme, serait inventer un dispositif non encore conçu. Le
--   contrôle « ce lien peut écrire sur CETTE rencontre tant qu'elle
--   n'est pas termine/archive » est concentré dans les RPC (C12-c/f).
--
-- Idempotent : ré-exécutable sans erreur.
-- =====================================================================

-- 1. Activer RLS.
--    Défense en profondeur : même si les privilèges directs sont
--    retirés en §3 ci-dessous, RLS garantit qu'aucune exposition
--    accidentelle de lignes n'est possible via un rôle client.
--    Idempotent (pas d'erreur si déjà activée).
ALTER TABLE chronologie_suivi ENABLE ROW LEVEL SECURITY;

-- 2. Aucune policy permissive n'est créée.
--    RLS activée + zéro policy = refus par défaut pour tous les
--    rôles non-propriétaires. C'est INTENTIONNEL (voir décision
--    d'architecture ci-dessus). Les RPC SECURITY DEFINER (C12-c/d/f),
--    exécutées avec les droits du propriétaire, ne sont pas
--    soumises à ce refus : elles sont la seule voie d'accès.

-- 3. Table fermée : retirer tout privilège direct des rôles client.
--    Le bénévole (porteur d'un lien éphémère) et l'utilisateur Hub
--    authentifié n'accèdent JAMAIS à la table en direct ; uniquement
--    via les RPC. Explicite et idempotent (REVOKE sans grant = no-op).
REVOKE ALL ON TABLE chronologie_suivi FROM PUBLIC;
REVOKE ALL ON TABLE chronologie_suivi FROM anon;
REVOKE ALL ON TABLE chronologie_suivi FROM authenticated;

-- Note : service_role (backend) et postgres / supabase_admin
-- conservent leur accès d'administration. Les RPC C12-c/d/f seront
-- créées en SECURITY DEFINER (propriétaire postgres, avec le bypass
-- smoke-test session_user IN ('postgres','supabase_admin') de la
-- Phase 5.14) et recevront leur GRANT EXECUTE à anon/authenticated
-- DANS LEURS scripts respectifs — pas ici (chaque dette livre sa
-- propre surface d'accès).

-- =====================================================================
-- Vérification rapide (lecture seule, optionnelle) :
--   SELECT relrowsecurity
--   FROM   pg_class
--   WHERE  relname = 'chronologie_suivi';     -- attendu : true
--
--   SELECT grantee, privilege_type
--   FROM   information_schema.role_table_grants
--   WHERE  table_name = 'chronologie_suivi'
--     AND  grantee IN ('anon','authenticated'); -- attendu : 0 ligne
-- =====================================================================

-- =====================================================================
-- FIN C12-b. Prochaine dette (ordre modélisation §10.1) :
--   C12-f — generer_lien_ephemere(evenement_uuid) + payload compo
--           réduit (§6 / §9.1).
-- État voulu après C12-b : la table existe (C12-a) et est totalement
-- inaccessible aux clients tant que les RPC ne sont pas livrées.
-- C'est le comportement attendu, pas un blocage.
-- =====================================================================
