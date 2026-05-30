-- ============================================================================
-- MOM Hub · Chantier B5 « Autorisation granulaire par catégorie »
-- Fichier : sql/66 — Bornage catégoriel · surface 2/3 (composant b) :
--                    RLS write M3 (evenement_equipes_engagees) + M5 (evenement_adversaires)
-- ----------------------------------------------------------------------------
-- Doc FAIT FOI : Conception-Autorisation-Referent-Categorie-v1.md (md5 2c99a098)
--   §4.2   : « Évènements (evenements, evenement_equipes_engagees) : dérivé
--            equipe_id → entente → categorie (S5). admin/bureau : toutes ;
--            référent : sa/ses catégorie(s). » Garde par le helper EN COMPLÉMENT
--            de has_role.
--   §6 (3) : border les surfaces d'écriture catégorielles.
--   D8     : transition coach → {admin,bureau,referent} (coach retiré, sql/63).
--
-- Surface 2/3 = DEUX composants livrés séparément (1 fichier = 1 commit) :
--   (a) RPC creer_evenement_complet (sql/52) — bornage CRÉATION, livré à part.
--   (b) CE fichier — RLS write M3/M5 : bornage des écritures DIRECTES post-création
--       (édition d'engagement / adversaires via le client, hors RPC composite).
--
-- Sondes à la source (méthode pt 14, repo Manu-MOM/mom-hub@main fait foi) — closes :
--   - sql/43-rls-write-m3-m5-evenements-filles.sql : 6 policies write
--     (M3 + M5 × INSERT/UPDATE/DELETE) = has_role('admin') OR has_role('coach').
--     SELECT authenticated USING(true) — NON touchée (lecture non bornée, cohérent §2).
--   - M3 evenement_equipes_engagees : porte equipe_id (FK). Catégorie dérivée
--     equipe_id → equipes.entente_id → ententes.categorie_id (_b5_categorie_de_equipe, sql/65).
--   - M5 evenement_adversaires : porte evenement_equipe_id (FK vers M3 ; INSERT
--     sql/52 L401 « evenement_adversaires(id, evenement_equipe_id, adversaire_nom…) »).
--     Catégorie dérivée = catégorie de sa ligne M3 parente.
--   - sql/64 : puis_je_ecrire_categorie / mes_categories_autorisees déployés.
--   - sql/65 : _b5_categorie_de_equipe déployé.
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D-a : helper _b5_categorie_de_evenement_equipe(m3_id) SECURITY DEFINER STABLE,
--         pour M5 (remonte M3.equipe_id → catégorie). Évite une jointure inline
--         lourde dans le WITH CHECK M5. NULL si M3 introuvable -> referent refusé.
--   D-b : policies renommées *_admin_bureau_referent (ancien _admin_or_coach faux).
--         DROP des DEUX nommages (idempotence).
--   D-c : SELECT M3/M5 NON touchée ici (sql/43 ne la pose pas ; lecture déjà
--         USING(true) en amont). Périmètre B5 §4.2 = écriture.
--   D-d : ATTENTION ANTI-VOID (leçon REFONTE-EVT-write-M3/M5) : ces tables
--         s'écrivent en RLS DIRECTE côté client. Le prédicat catégoriel est donc
--         le SEUL rempart. Recette point 6 doit prouver qu'un admin écrit ENCORE
--         (pas un void) et qu'un referent hors catégorie est REFUSÉ.
-- ============================================================================

-- 1. Helper de dérivation catégorie pour M5 (via sa ligne M3 parente)
create or replace function public._b5_categorie_de_evenement_equipe(p_evenement_equipe_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select public._b5_categorie_de_equipe(ee.equipe_id)
  from public.evenement_equipes_engagees ee
  where ee.id = p_evenement_equipe_id;
$$;

comment on function public._b5_categorie_de_evenement_equipe(uuid) is
  'B5 §4.2 : catégorie d''une ligne M3 (evenement_equipes_engagees.equipe_id → catégorie). Sert au bornage M5 (evenement_adversaires.evenement_equipe_id). SECURITY DEFINER. NULL si M3 introuvable.';

grant execute on function public._b5_categorie_de_evenement_equipe(uuid) to authenticated;

-- 2. M3 · evenement_equipes_engagees — re-bornage (catégorie via equipe_id)
DROP POLICY IF EXISTS evt_equipes_insert_admin_or_coach        ON evenement_equipes_engagees;
DROP POLICY IF EXISTS evt_equipes_update_admin_or_coach        ON evenement_equipes_engagees;
DROP POLICY IF EXISTS evt_equipes_delete_admin_or_coach        ON evenement_equipes_engagees;
DROP POLICY IF EXISTS evt_equipes_insert_admin_bureau_referent ON evenement_equipes_engagees;
DROP POLICY IF EXISTS evt_equipes_update_admin_bureau_referent ON evenement_equipes_engagees;
DROP POLICY IF EXISTS evt_equipes_delete_admin_bureau_referent ON evenement_equipes_engagees;

CREATE POLICY evt_equipes_insert_admin_bureau_referent
  ON evenement_equipes_engagees FOR INSERT TO authenticated
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_equipe(equipe_id))
  );

CREATE POLICY evt_equipes_update_admin_bureau_referent
  ON evenement_equipes_engagees FOR UPDATE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_equipe(equipe_id))
  )
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_equipe(equipe_id))
  );

CREATE POLICY evt_equipes_delete_admin_bureau_referent
  ON evenement_equipes_engagees FOR DELETE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_equipe(equipe_id))
  );

-- 3. M5 · evenement_adversaires — re-bornage (catégorie via M3 parente)
DROP POLICY IF EXISTS evt_adv_insert_admin_or_coach        ON evenement_adversaires;
DROP POLICY IF EXISTS evt_adv_update_admin_or_coach        ON evenement_adversaires;
DROP POLICY IF EXISTS evt_adv_delete_admin_or_coach        ON evenement_adversaires;
DROP POLICY IF EXISTS evt_adv_insert_admin_bureau_referent ON evenement_adversaires;
DROP POLICY IF EXISTS evt_adv_update_admin_bureau_referent ON evenement_adversaires;
DROP POLICY IF EXISTS evt_adv_delete_admin_bureau_referent ON evenement_adversaires;

CREATE POLICY evt_adv_insert_admin_bureau_referent
  ON evenement_adversaires FOR INSERT TO authenticated
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_evenement_equipe(evenement_equipe_id))
  );

CREATE POLICY evt_adv_update_admin_bureau_referent
  ON evenement_adversaires FOR UPDATE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_evenement_equipe(evenement_equipe_id))
  )
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_evenement_equipe(evenement_equipe_id))
  );

CREATE POLICY evt_adv_delete_admin_bureau_referent
  ON evenement_adversaires FOR DELETE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_evenement_equipe(evenement_equipe_id))
  );

-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement)
-- ============================================================================
--  A. Helper M5 :
--     select public._b5_categorie_de_evenement_equipe('<m3_id existant>');  -- attendu : <cat>
--
--  B. Policies en place (6 write renommées) :
--     select tablename, policyname, cmd from pg_policies
--      where schemaname='public'
--        and tablename in ('evenement_equipes_engagees','evenement_adversaires')
--      order by tablename, cmd, policyname;
--     -- attendu : 3 + 3 policies *_admin_bureau_referent ; AUCUNE *_admin_or_coach
--
--  C. Mordant + anti-void (recette terrain point 6) :
--     - admin/bureau : INSERT M3/M5 toutes catégories -> OK (et ÉCRIT réellement)
--     - referent M14 : OK sur équipe M14, REFUSÉ sur équipe SR
--     - compte sans fonction qualifiante : REFUSÉ partout
-- ============================================================================
