-- ============================================================================
-- MOM Hub · Chantier B5 « Autorisation granulaire par catégorie »
-- Fichier : sql/65 — Bornage catégoriel · surface 1/3 : Collectif N1 (collectif_membre)
--                    + helpers de dérivation catégorie (réutilisés par 2/3 et 3/3)
-- ----------------------------------------------------------------------------
-- Doc FAIT FOI : Conception-Autorisation-Referent-Categorie-v1.md (md5 2c99a098)
--   §4.2   : « Collectif N1 (collectif_membre via entente_id) : entente_id → categorie ;
--            admin/bureau : tous ; référent : les ententes de ses catégories. »
--            Garde « par le helper, EN COMPLÉMENT de has_role » (filtrage, patron projet).
--   §6 (3) : « Border les RPC/RLS d'écriture catégorielles par le helper. »
--   D8     : transition coach → {admin,bureau,referent} (coach retiré, sql/63).
--
-- Sondes à la source (méthode pt 14, repo Manu-MOM/mom-hub@main fait foi) — closes :
--   - sql/44-collectif-membre.sql : collectif_membre(personne_id, entente_id NOT NULL
--     REFERENCES ententes(id), role CHECK joueur|staff, …). RLS ON. 3 policies write
--     actuelles = has_role('admin') OR has_role('coach') (INSERT/UPDATE/DELETE).
--     SELECT authenticated USING(true) — INCHANGÉE ici (lecture non bornée, §2 :
--     un referent VOIT, l'écriture seule est bornée — cohérent A/B/C Suivi lecture).
--   - sql/52 (L541) : pattern déployé « JOIN ententes en ON en.id = cm.entente_id »
--     -> chaîne entente_id → ententes confirmée AU RÉEL.
--   - admin-equipes.js : equipes.entente_id confirmé.
--   - ententes.categorie_id + UNIQUE(saison_id,categorie_id) : 1 entente = 1 catégorie
--     pour une saison (S5 doc). -> dérivation déterministe.
--   - sql/64 : puis_je_ecrire_categorie(uuid) + mes_categories_autorisees()
--     (sentinelle transverse) déployés.
--
-- TRANSITION coach (décision Manu, validée) : le prédicat write devient
--   has_role('admin') OR has_role('bureau') OR puis_je_ecrire_categorie(<cat ligne>).
--   coach DISPARAÎT (jamais peuplé, retiré du CHECK par sql/63). admin/bureau =
--   transverses (le helper le couvre aussi, mais has_role les court-circuite — §4.2
--   « en complément de has_role » respecté + défense en profondeur, lisible).
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D-a : helper _b5_categorie_de_entente(entente_id) SECURITY DEFINER STABLE,
--         évite de répéter la sous-requête dans chaque policy (lisibilité +
--         maintenance). Renvoie NULL si entente introuvable (-> referent refusé).
--   D-b : helper _b5_categorie_de_equipe(equipe_id) idem (réutilisé surfaces 2/3).
--         Posés ICI car le collectif est la 1ʳᵉ surface livrée ; 2/3 et 3/3 les
--         consomment sans les redéfinir.
--   D-c : SELECT (lecture) NON bornée (reste USING(true)) — §2 « le référent VOIT
--         les autres catégories en consultation »… NB : le doc borne la LECTURE
--         pour les évènements club-wide (≥ referent) mais NON pour le collectif ;
--         on ne durcit pas la lecture du collectif ici (P1, périmètre §4.2 = write).
--   D-d : policies renommées *_admin_bureau_referent (l'ancien suffixe _admin_or_coach
--         devient faux). DROP de l'ancien nom + de la nouvelle (idempotence).
-- ============================================================================

-- 1. Helpers de dérivation catégorie (réutilisés par les surfaces 2/3 et 3/3)

create or replace function public._b5_categorie_de_entente(p_entente_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select e.categorie_id from public.ententes e where e.id = p_entente_id;
$$;

comment on function public._b5_categorie_de_entente(uuid) is
  'B5 §4.2 : catégorie d''une entente (entente_id → ententes.categorie_id). SECURITY DEFINER (contourne RLS ententes si besoin). NULL si entente introuvable.';

create or replace function public._b5_categorie_de_equipe(p_equipe_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select e.categorie_id
  from public.equipes eq
  join public.ententes e on e.id = eq.entente_id
  where eq.id = p_equipe_id;
$$;

comment on function public._b5_categorie_de_equipe(uuid) is
  'B5 §4.2 : catégorie d''une équipe (equipe_id → equipes.entente_id → ententes.categorie_id, chaîne S5). SECURITY DEFINER. NULL si équipe/entente introuvable.';

grant execute on function public._b5_categorie_de_entente(uuid) to authenticated;
grant execute on function public._b5_categorie_de_equipe(uuid)  to authenticated;

-- 2. Re-bornage des policies write de collectif_membre
--    (admin/bureau transverses ; referent borné à la catégorie de l'entente de la ligne)

-- Drop ancien nommage (_admin_or_coach) ET nouveau (idempotence au rejeu)
DROP POLICY IF EXISTS collectif_membre_insert_admin_or_coach        ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_update_admin_or_coach        ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_delete_admin_or_coach        ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_insert_admin_bureau_referent ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_update_admin_bureau_referent ON collectif_membre;
DROP POLICY IF EXISTS collectif_membre_delete_admin_bureau_referent ON collectif_membre;

-- SELECT : INCHANGÉE (lecture non bornée, §2 + D-c). On NE LA TOUCHE PAS si elle existe,
-- mais on la (re)pose idempotente à l'identique pour un script autoportant.
DROP POLICY IF EXISTS collectif_membre_select_authenticated ON collectif_membre;
CREATE POLICY collectif_membre_select_authenticated
  ON collectif_membre FOR SELECT TO authenticated
  USING (true);

CREATE POLICY collectif_membre_insert_admin_bureau_referent
  ON collectif_membre FOR INSERT TO authenticated
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_entente(entente_id))
  );

CREATE POLICY collectif_membre_update_admin_bureau_referent
  ON collectif_membre FOR UPDATE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_entente(entente_id))
  )
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_entente(entente_id))
  );

CREATE POLICY collectif_membre_delete_admin_bureau_referent
  ON collectif_membre FOR DELETE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_entente(entente_id))
  );

-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement)
-- ============================================================================
--  A. Helpers répondent :
--     select public._b5_categorie_de_entente('<entente M14 id>');  -- attendu : <cat M14>
--     select public._b5_categorie_de_equipe('<equipe M14 id>');    -- attendu : <cat M14>
--
--  B. Policies en place (3 write renommées + 1 select) :
--     select policyname, cmd from pg_policies
--      where schemaname='public' and tablename='collectif_membre' order by cmd, policyname;
--     -- attendu : *_insert/_update/_delete_admin_bureau_referent + _select_authenticated
--
--  C. Mordant (recette terrain point 6) :
--     - compte admin/bureau : INSERT/UPDATE/DELETE collectif_membre toutes ententes -> OK
--     - compte referent M14 : OK sur entente M14, REFUSÉ sur entente SR (RLS bloque)
--     - compte sans fonction qualifiante : REFUSÉ partout (puis_je_ecrire_categorie=false)
--
--  D. Anti-void (leçon REFONTE-EVT-write-M3/M5) : prouver qu'un INSERT admin ÉCRIT
--     réellement une ligne (pas un void) APRÈS re-bornage.
-- ============================================================================
