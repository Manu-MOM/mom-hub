-- ============================================================================
-- MOM Hub · Chantier B5 « Autorisation granulaire par catégorie »
-- Fichier : sql/67 — Bornage catégoriel · surface 3/3 :
--                    RLS write compositions + composition_joueurs
-- ----------------------------------------------------------------------------
-- Doc FAIT FOI : Conception-Autorisation-Referent-Categorie-v1.md (md5 2c99a098)
--   §4.2   : « Compositions (compositions, lié à l'évènement→équipe) : via
--            l'évènement de la compo. idem évènements (la compo hérite de la
--            catégorie de son évènement). » Garde par le helper EN COMPLÉMENT
--            de has_role.
--   §6 (3) : border les surfaces d'écriture catégorielles.
--   D8     : transition coach → {admin,bureau,referent} (coach retiré, sql/63).
--
-- Sondes à la source (méthode pt 14, BASE fait foi — état réel pg_policies) — closes :
--   - pg_policies (recollé Manu) : compositions ET composition_joueurs portent
--     chacune 3 policies write (_insert/_update/_delete_admin_or_coach) =
--     has_role('admin') OR has_role('coach') + 1 SELECT _authenticated USING(true).
--     (Le schéma sql/18 ne montrait que les SELECT ; les write ont été ajoutées
--      après — « session RLS write », STATE pt 13. La BASE fait foi, pas le repo.)
--   - sql/18 : compositions(evenement_id NOT NULL → evenements). composition_joueurs(
--     composition_id NOT NULL → compositions). cote='mom' figé.
--   - sql/50 (déployé+vérifié pt 16) : compositions porte AUSSI evenement_equipe_id
--     (base multi-équipe ; NULL en mono-équipe legacy) ET compo_base_origine_id
--     (match ; NOT NULL garanti par CHECK). createCompo (v1.27) écrit en INSERT
--     DIRECT RLS-client (pas de RPC) -> la policy est le SEUL rempart.
--   - sql/52 (INSERT racine) : evenements.equipe_id (fallback catégorie legacy).
--   - sql/64 : puis_je_ecrire_categorie. sql/65 : _b5_categorie_de_equipe.
--     sql/66 : _b5_categorie_de_evenement_equipe.
--
-- Dérivation catégorie d'une compo (robuste aux 3 cas, sql/50 §Q1) :
--   1. evenement_equipe_id NOT NULL (base multi-équipe) -> catégorie de cette M3.
--   2. compo_base_origine_id NOT NULL (match) -> catégorie de la compo de base d'origine.
--   3. sinon (legacy mono-équipe) -> evenements.equipe_id -> catégorie.
--   => helper _b5_categorie_de_composition(id) encapsule les 3.
--
-- Décisions techniques mineures (déléguées Production — tranchées + tracées) :
--   D-a : _b5_categorie_de_evenement(evenement_id) SECURITY DEFINER STABLE
--         (fallback legacy via evenements.equipe_id). NULL si évènement sans équipe
--         (competition pure) -> dans ce cas la compo a forcément evenement_equipe_id
--         (cas 1), donc le fallback n'est atteint que pour les évènements mono-équipe.
--   D-b : _b5_categorie_de_composition(composition_id) SECURITY DEFINER STABLE,
--         cascade 1→2→3. Réutilisé par composition_joueurs (remonte composition_id).
--   D-c : la précision B5 = la compo est bornée par la catégorie de SON équipe
--         (evenement_equipe_id), pas « une quelconque équipe de l'évènement » —
--         évite qu'un référent M14 touche la compo d'une autre catégorie sur un
--         évènement multi-catégories. Décision tracée (cohérent §2 « sa catégorie »).
--   D-d : policies renommées *_admin_bureau_referent. DROP des deux nommages (idempotence).
--   D-e : SELECT NON touchée (lecture non bornée, §2). ANTI-VOID : écriture RLS-client
--         directe -> recette point 6 doit prouver qu'un admin écrit ENCORE.
-- ============================================================================

-- 1. Helpers de dérivation (complément des helpers sql/65 + sql/66)

create or replace function public._b5_categorie_de_evenement(p_evenement_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select public._b5_categorie_de_equipe(ev.equipe_id)
  from public.evenements ev
  where ev.id = p_evenement_id;
$$;

comment on function public._b5_categorie_de_evenement(uuid) is
  'B5 §4.2 : catégorie d''un évènement via evenements.equipe_id (mono-équipe). NULL si évènement sans equipe_id (competition multi-équipes -> la compo passe par evenement_equipe_id, cf. _b5_categorie_de_composition). SECURITY DEFINER.';

create or replace function public._b5_categorie_de_composition(p_composition_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_evenement_id        uuid;
  v_evenement_equipe_id uuid;
  v_compo_base_origine  uuid;
begin
  select c.evenement_id, c.evenement_equipe_id, c.compo_base_origine_id
    into v_evenement_id, v_evenement_equipe_id, v_compo_base_origine
  from public.compositions c
  where c.id = p_composition_id;

  if v_evenement_id is null then
    return null;  -- compo introuvable
  end if;

  -- Cas 1 : base multi-équipe -> catégorie de l'équipe engagée
  if v_evenement_equipe_id is not null then
    return public._b5_categorie_de_evenement_equipe(v_evenement_equipe_id);
  end if;

  -- Cas 2 : match -> catégorie de la compo de base d'origine (récursion 1 cran)
  if v_compo_base_origine is not null then
    return public._b5_categorie_de_composition(v_compo_base_origine);
  end if;

  -- Cas 3 : legacy mono-équipe -> via l'évènement
  return public._b5_categorie_de_evenement(v_evenement_id);
end;
$$;

comment on function public._b5_categorie_de_composition(uuid) is
  'B5 §4.2 : catégorie d''une composition. Cascade : evenement_equipe_id (base multi-équipe) -> compo_base_origine_id (match) -> evenements.equipe_id (legacy mono-équipe). SECURITY DEFINER. Réutilisé par composition_joueurs.';

grant execute on function public._b5_categorie_de_evenement(uuid)    to authenticated;
grant execute on function public._b5_categorie_de_composition(uuid)  to authenticated;

-- 2. compositions — re-bornage (catégorie via _b5_categorie_de_composition(id))
DROP POLICY IF EXISTS compositions_insert_admin_or_coach        ON compositions;
DROP POLICY IF EXISTS compositions_update_admin_or_coach        ON compositions;
DROP POLICY IF EXISTS compositions_delete_admin_or_coach        ON compositions;
DROP POLICY IF EXISTS compositions_insert_admin_bureau_referent ON compositions;
DROP POLICY IF EXISTS compositions_update_admin_bureau_referent ON compositions;
DROP POLICY IF EXISTS compositions_delete_admin_bureau_referent ON compositions;

-- NB INSERT : la ligne n'existe pas encore -> on dérive depuis ses colonnes
-- (evenement_id / evenement_equipe_id / compo_base_origine_id) via un helper
-- qui prend la composition_id ? Non : à l'INSERT l'id n'est pas connu. On dérive
-- donc directement des colonnes de la NEW row, repliquant la cascade :
--   evenement_equipe_id -> M3 ; sinon compo_base_origine_id -> base ; sinon evenement_id.

CREATE POLICY compositions_insert_admin_bureau_referent
  ON compositions FOR INSERT TO authenticated
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(
         coalesce(
           public._b5_categorie_de_evenement_equipe(evenement_equipe_id),
           public._b5_categorie_de_composition(compo_base_origine_id),
           public._b5_categorie_de_evenement(evenement_id)
         ))
  );

CREATE POLICY compositions_update_admin_bureau_referent
  ON compositions FOR UPDATE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_composition(id))
  )
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(
         coalesce(
           public._b5_categorie_de_evenement_equipe(evenement_equipe_id),
           public._b5_categorie_de_composition(compo_base_origine_id),
           public._b5_categorie_de_evenement(evenement_id)
         ))
  );

CREATE POLICY compositions_delete_admin_bureau_referent
  ON compositions FOR DELETE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_composition(id))
  );

-- 3. composition_joueurs — re-bornage (catégorie via composition_id)
DROP POLICY IF EXISTS composition_joueurs_insert_admin_or_coach        ON composition_joueurs;
DROP POLICY IF EXISTS composition_joueurs_update_admin_or_coach        ON composition_joueurs;
DROP POLICY IF EXISTS composition_joueurs_delete_admin_or_coach        ON composition_joueurs;
DROP POLICY IF EXISTS composition_joueurs_insert_admin_bureau_referent ON composition_joueurs;
DROP POLICY IF EXISTS composition_joueurs_update_admin_bureau_referent ON composition_joueurs;
DROP POLICY IF EXISTS composition_joueurs_delete_admin_bureau_referent ON composition_joueurs;

CREATE POLICY composition_joueurs_insert_admin_bureau_referent
  ON composition_joueurs FOR INSERT TO authenticated
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_composition(composition_id))
  );

CREATE POLICY composition_joueurs_update_admin_bureau_referent
  ON composition_joueurs FOR UPDATE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_composition(composition_id))
  )
  WITH CHECK (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_composition(composition_id))
  );

CREATE POLICY composition_joueurs_delete_admin_bureau_referent
  ON composition_joueurs FOR DELETE TO authenticated
  USING (
    has_role('admin') OR has_role('bureau')
    OR public.puis_je_ecrire_categorie(public._b5_categorie_de_composition(composition_id))
  );

-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement)
-- ============================================================================
--  A. Helper compo (sur une compo existante) :
--     select id, public._b5_categorie_de_composition(id) as cat
--       from public.compositions limit 5;   -- attendu : cat non NULL (sauf orphelines)
--
--  B. Policies en place (6 write renommées) :
--     select tablename, policyname, cmd from pg_policies
--      where schemaname='public' and tablename in ('compositions','composition_joueurs')
--      order by tablename, cmd, policyname;
--     -- attendu : 3 + 3 *_admin_bureau_referent + 2 SELECT ; AUCUNE *_admin_or_coach
--
--  C. Mordant + anti-void (recette terrain point 6) :
--     - admin/bureau : créer/éditer compo toutes catégories -> OK (ÉCRIT réellement)
--     - referent M14 : OK sur compo d'un évènement/équipe M14, REFUSÉ sur SR
--     - compte sans fonction qualifiante : REFUSÉ partout
-- ============================================================================
