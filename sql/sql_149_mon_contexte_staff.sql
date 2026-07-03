-- ============================================================================
-- sql_149 — PORTAIL-MULTI-PERIMETRE (Lot 0) : RPC self-only mon_contexte_staff()
-- FAIT FOI gelé le 03/07/2026.
--
-- Objet : renvoyer la fonction staff ACTIVE de la personne connectée AVEC sa
-- catégorie (id, code, libellé court) — ce que ma_fonction_staff() (sql_92)
-- ne porte pas. Alimente la section 02 du portail (« Mon équipe — <libellé> »)
-- et la personnalisation multi-périmètre : Manu → M16, Arnaud → M10,
-- Vanessa (aucune fonction) → 0 ligne → section masquée (option C gelée).
--
-- DS-1 (lu à la source le 03/07/2026) :
--   - fonction_staff(fonction text NN, personne_id, categorie_id, date_debut,
--     date_fin nullable) — structure sql_92 ; lignes réelles confirmées
--     sonde S1 (JUNG/M16, GOETTLE/M10, dates 2026-07-01, date_fin null).
--   - categories(id, code, libelle_court, ordre_tri) — colonnes prouvées S1.
--   - qui_suis_je() RETURNS TABLE(personne_id uuid) — self-only, héritée pt 86.
--   - _b5_norm() — normalisation B5, utilisée par sql_92. Rien inventé.
--
-- INVARIANT DE COHÉRENCE : le ORDER BY (priorité métier + date_debut) est
-- STRICTEMENT identique à celui de sql_92 → la fonction élue ici est
-- toujours celle qu'affiche la topbar/greeting. Ne modifier l'un sans l'autre.
--
-- Catégorie nullable : une fonction sans categorie_id (transverse club)
-- renvoie des champs catégorie NULL — le front ne révèle la section 02 que
-- si categorie_libelle_court est non-null (dégradation honnête).
--
-- ADDITIF : sql_92 (ma_fonction_staff) N'EST PAS touchée.
-- ============================================================================

create or replace function public.mon_contexte_staff()
returns table(
  fonction               text,
  categorie_id           uuid,
  categorie_code         text,
  categorie_libelle_court text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_personne_id uuid;
begin
  -- Résolution self-only : la fiche de la personne connectée, jamais une autre.
  v_personne_id := (select qs.personne_id from public.qui_suis_je() qs limit 1);

  -- Compte non relié (pas de pont auth_personne) -> 0 ligne (section masquée).
  if v_personne_id is null then
    return;
  end if;

  -- Fonction active la plus élevée par priorité métier — ORDER BY identique
  -- à sql_92 (invariant de cohérence topbar/greeting/section 02).
  return query
  select fs.fonction, fs.categorie_id, c.code, c.libelle_court
  from public.fonction_staff fs
  left join public.categories c on c.id = fs.categorie_id
  where fs.personne_id = v_personne_id
    and fs.date_fin is null
  order by
    case
      when public._b5_norm(fs.fonction) like 'referent%'                                   then 1
      when public._b5_norm(fs.fonction) like 'manager%'                                    then 2
      when public._b5_norm(fs.fonction) like '%entraineur%' and public._b5_norm(fs.fonction) like '%principal%' then 3
      when public._b5_norm(fs.fonction) like '%entraineur%' and public._b5_norm(fs.fonction) like '%adjoint%'   then 4
      else 9
    end asc,
    fs.date_debut desc
  limit 1;
end;
$function$;

-- Self-only : tout authentifié peut lire SON contexte ; le corps borne à auth.uid()
-- (via qui_suis_je). REVOKE sur PUBLIC ET anon (anon hérite de PUBLIC).
revoke all on function public.mon_contexte_staff() from public;
revoke all on function public.mon_contexte_staff() from anon;
grant execute on function public.mon_contexte_staff() to authenticated;

-- ============================================================================
-- Vérification fail-loud.
-- ============================================================================
do $verif$
declare
  v_src text;
  v_secdef boolean;
  v_auth boolean;
  v_anon boolean;
begin
  v_src := (select prosrc from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'mon_contexte_staff');
  if v_src is null then
    raise exception 'sql_149 VERIF: mon_contexte_staff introuvable.';
  end if;
  if position('qui_suis_je' in v_src) = 0 then
    raise exception 'sql_149 VERIF: résolution self-only (qui_suis_je) absente.';
  end if;
  if position('#variable_conflict use_column' in v_src) = 0 then
    raise exception 'sql_149 VERIF: pragma variable_conflict absent (leçon sql_148).';
  end if;
  v_secdef := (select prosecdef from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'mon_contexte_staff');
  if not v_secdef then
    raise exception 'sql_149 VERIF: SECURITY DEFINER absent.';
  end if;
  v_auth := has_function_privilege('authenticated', 'public.mon_contexte_staff()', 'execute');
  if not v_auth then
    raise exception 'sql_149 VERIF: EXECUTE authenticated absent.';
  end if;
  v_anon := has_function_privilege('anon', 'public.mon_contexte_staff()', 'execute');
  if v_anon then
    raise exception 'sql_149 VERIF: anon peut exécuter la fonction (REVOKE raté).';
  end if;
  raise notice 'sql_149 OK : mon_contexte_staff en place, self-only, pragma, secdef, ACL correctes.';
end
$verif$;
