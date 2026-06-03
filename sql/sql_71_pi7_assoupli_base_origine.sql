-- ============================================================
-- sql/71 — PI-7 ASSOUPLI : la compo de BASE d'origine validée
--          suffit à autoriser un lien 'saisie' (option B serveur).
-- ============================================================
-- Contexte (pt 57, chantier SUIVI-LIEN-COACH-MIGRATION) :
--   La génération des liens partageables (bénévole + spectateur) a migré
--   de la vignette « Suivi de la rencontre » (evenements-browser) vers
--   l'onglet Suivi de l'éditeur (compositions-editor v3.61). À cette
--   occasion, le refus PI-7 est apparu sur les matchs de TOURNOI.
--
-- Cause racine (vérifiée à la source, pas par hypothèse — DS-1) :
--   generer_lien_ephemere (sql/C12-f) exigeait une compo 'validee' active
--   'mom' rattachée DIRECTEMENT au match (evenement_id = p_evenement_uuid).
--   Or en tournoi, seule la compo de BASE est validée (etat='validee') ;
--   les compos de match restent en 'brouillon'. La notion « valider la
--   base suffit » (option B, décision Manu pt 51) n'existait que côté UI
--   (compoPreteRacine, vignette) — JAMAIS côté serveur. Désaccord
--   front↔serveur révélé (pas introduit) par la migration.
--
-- Sondes de structure (lecture seule, pt 57) :
--   - compositions de match : etat='brouillon', cote='mom', est_active=t,
--     evenement_equipe_id = NULL (donc PAS le bon lien).
--   - le lien base↔match passe par compositions.compo_base_origine_id :
--     match 831f24e8 → base 599efedc (cas réel vs Nord Alsace).
--   - base 599efedc : etat='validee', cote='mom', est_active=t.
--
-- ÉCART DE MODÈLE ASSUMÉ (tracé STATE/CARTE) :
--   l'option B est désormais PORTÉE AU SERVEUR. PI-7 accepte un lien
--   'saisie' si une compo 'validee' active 'mom' existe SOIT directement
--   sur le match (cas historique préservé), SOIT sur sa base d'origine
--   (compo_base_origine_id). Le front (compositions-editor v3.61) et le
--   serveur sont enfin alignés.
--
-- Périmètre : SEUL le bloc de garde PI-7 (branche IF p_role='saisie')
--   change. Signature, révocation des liens 'saisie' antérieurs (relais
--   S-5.2.a), génération du token, INSERT et RETURN sont byte-identiques
--   à la version déployée (sql/C12-f). Aucune autre RPC touchée.
--
-- Idempotence : CREATE OR REPLACE FUNCTION (atomique, pas de DDL+DML
--   mixés → pas de popup "destructive operations").
--
-- Dette inchangée : SUIVI-COACH-AUTH (garde auth.uid() à resserrer vers
--   has_role quand les rôles seront peuplés ; cette RPC en hérite).
-- ============================================================

CREATE OR REPLACE FUNCTION public.generer_lien_ephemere(
    p_evenement_uuid uuid,
    p_role           text     DEFAULT 'saisie'::text,
    p_config_chrono  jsonb    DEFAULT NULL::jsonb,
    p_duree          interval DEFAULT '36:00:00'::interval,
    p_cree_par       text     DEFAULT NULL::text
)
 RETURNS TABLE(token text, role text, expire_le timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_token   TEXT;
    v_expire  TIMESTAMPTZ;
BEGIN
    IF p_role NOT IN ('saisie', 'spectateur') THEN
        RAISE EXCEPTION 'Rôle de lien invalide : %', p_role;
    END IF;

    IF p_role = 'saisie' THEN
        -- PI-7 (assoupli sql/71, option B) : compo 'validee' active 'mom'
        -- requise. Acceptée SOIT directement sur ce match (cas serveur
        -- historique, sql/C12-f), SOIT via la compo de base d'origine du
        -- match (compositions.compo_base_origine_id) — fidèle à la pratique
        -- tournoi « valider la base suffit » (décision Manu pt 51).
        IF NOT EXISTS (
            -- (1) compo validée active directement sur ce match
            SELECT 1 FROM compositions
            WHERE evenement_id = p_evenement_uuid
              AND cote = 'mom'
              AND etat = 'validee'
              AND est_active = TRUE
        ) AND NOT EXISTS (
            -- (2) compo de base d'origine de ce match, validée active
            SELECT 1
            FROM compositions cm
            JOIN compositions cb
              ON cb.id = cm.compo_base_origine_id
            WHERE cm.evenement_id = p_evenement_uuid
              AND cm.compo_base_origine_id IS NOT NULL
              AND cb.cote = 'mom'
              AND cb.etat = 'validee'
              AND cb.est_active = TRUE
        ) THEN
            RAISE EXCEPTION
              'PI-7 : aucune composition validee active pour cette rencontre (ni sur le match, ni sur sa base d''origine) — le suivi ne peut pas démarrer.';
        END IF;

        -- Relais (S-5.2.a) : régénérer révoque les liens 'saisie' actifs
        -- antérieurs de la même rencontre. Inchangé.
        UPDATE lien_suivi
           SET revoque = TRUE
         WHERE lien_suivi.evenement_uuid = p_evenement_uuid
           AND lien_suivi.role = 'saisie'
           AND lien_suivi.revoque = FALSE;
    END IF;

    v_token := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');
    v_expire := NOW() + p_duree;

    INSERT INTO lien_suivi (token, evenement_uuid, role,
                            cree_par, config_chrono, expire_le)
    VALUES (v_token, p_evenement_uuid, p_role,
            p_cree_par, p_config_chrono, v_expire);

    RETURN QUERY SELECT v_token, p_role, v_expire;
END;
$function$;
