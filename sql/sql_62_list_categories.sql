-- ============================================================================
-- MOM Hub · Chantier B « Identité & rôles staff »
-- Fichier : sql/62 — RPC lecture des catégories (sélecteur écran fonctions staff)
-- ----------------------------------------------------------------------------
-- Sondes à la source (closes, base fait foi pt 14) :
--   - categories : RLS ACTIVE (relrowsecurity = true) -> select direct front
--     risque 0 ligne ; on passe par une RPC SECURITY DEFINER (patron projet).
--   - Aucune RPC %categor% préexistante (sonde : 0 ligne).
--   - Colonnes utiles : id uuid, code text, libelle_court text, libelle_long text,
--     ordre_tri int.
--
-- Décision technique mineure (déléguée — tranchée + tracée) :
--   - Lecture seule d'un référentiel -> PAS de garde has_role('admin') : tout
--     compte authentifié peut peupler le sélecteur. (Les écritures restent
--     gardées admin côté fonction_staff, sql/61.)
-- ============================================================================

create or replace function public.list_categories()
returns table (
  id uuid,
  code text,
  libelle_court text,
  libelle_long text,
  ordre_tri int
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.code, c.libelle_court, c.libelle_long, c.ordre_tri
  from public.categories c
  order by c.ordre_tri nulls last, c.libelle_court;
$$;

comment on function public.list_categories() is
  'Liste les catégories (référentiel) pour peupler les sélecteurs UI. Lecture seule, non gardée. categories étant en RLS active, l''accès passe par cette RPC SECURITY DEFINER.';

-- Recette : select * from public.list_categories();  -- attendu : la liste des catégories triée
-- ============================================================================
