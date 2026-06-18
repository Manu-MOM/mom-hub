-- =============================================================================
-- sql_91_valider_composition.sql
-- =============================================================================
-- Voie 2 — modèle rôles encadrants S1 — LOT 5.
--
-- Objet : RPC dédié `valider_composition(p_id uuid)` qui réalise la transition
--         d'état `brouillon -> validee` sur `compositions`, en vérifiant
--         lui-même la capability `valider_compo`.
--
-- Pourquoi un RPC (FAITFOI 9aa943e6, §4.4 option (a), tranchée) :
--   « Valider » est, au niveau RLS, le MÊME UPDATE qu'« écrire la compo »
--   (les deux touchent la table `compositions`). Une policy RLS ne peut pas
--   distinguer « UPDATE qui touche etat » de « UPDATE qui touche les joueurs ».
--   Or la matrice exige : Entr. principal écrit la compo mais ne la valide pas
--   (Référent seul valide). On exprime donc la distinction HORS RLS, dans ce
--   RPC SECURITY DEFINER : la policy UPDATE reste « écrire la compo » ; le
--   passage à `etat='validee'` n'est possible QUE via cette fonction, qui
--   exige la capability `valider_compo`.
--
-- DS-1 — tout ce qui suit est lu à la source (sondes lot 5, pt 91) :
--   - `etat text NOT NULL DEFAULT 'brouillon'`, CHECK
--     {brouillon,validee,utilisee,archivee} (sonde 5a + 5b).
--   - dérivation catégorie = helper EXISTANT `_b5_categorie_de_composition(id)`,
--     déjà utilisé par la policy UPDATE de `compositions` (sonde 5d). Réutilisé
--     tel quel — aucune dérivation réinventée.
--   - capability vérifiée via `puis_je_faire('valider_compo', cat)` (sql_88).
--   - 1 seul trigger sur `compositions` : `set_updated_at_compositions`
--     (BEFORE UPDATE, inoffensif) — aucun trigger nouveau (sonde 5c).
--
-- Conformité modèle :
--   - SECURITY DEFINER + set search_path = public (gabarit RPC projet).
--   - REVOKE PUBLIC / GRANT authenticated.
--   - admin / bureau : transverses, capability `valider_compo` portée par
--     `referent de categorie` dans la table (matrice §4.1) ; admin/bureau
--     passent via le court-circuit transverse de `puis_je_faire`.
--
-- Transition STRICTE : on ne valide QUE depuis `brouillon`. Tout autre état
--   courant lève une exception (pas d'écriture, pas d'idempotence silencieuse).
-- =============================================================================

create or replace function public.valider_composition(p_id uuid)
 returns table(out_id uuid, out_etat text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_categorie_id uuid;
  v_etat_courant text;
begin
  -- 0. Existence : la compo doit exister (fail-loud explicite).
  select c.etat into v_etat_courant
  from public.compositions c
  where c.id = p_id;

  if not found then
    raise exception 'valider_composition : composition % introuvable.', p_id
      using errcode = 'no_data_found';
  end if;

  -- 1. Catégorie de rattachement : dérivée via le helper EXISTANT
  --    (même expression que la policy UPDATE — sonde 5d).
  v_categorie_id := public._b5_categorie_de_composition(p_id);

  -- 2. Capability AVANT l'état : une personne sans droit ne doit pas pouvoir
  --    inférer l'état de la compo via le message d'erreur.
  --    admin/bureau passent par le court-circuit transverse de puis_je_faire.
  --    referent non relié / fonction non porteuse -> false (plancher D7 géré
  --    en amont par puis_je_faire). Pas de cas particulier ici.
  if not public.puis_je_faire('valider_compo', v_categorie_id) then
    raise exception 'valider_composition : droit insuffisant pour valider cette composition.'
      using errcode = 'insufficient_privilege';
  end if;

  -- 3. Transition stricte : seul brouillon -> validee est légal.
  if v_etat_courant is distinct from 'brouillon' then
    raise exception 'valider_composition : transition illegale depuis l''etat "%". Seule brouillon -> validee est autorisee.', v_etat_courant
      using errcode = 'check_violation';
  end if;

  -- 4. Écriture : etat + tracabilite modifie_par.
  update public.compositions c
     set etat        = 'validee',
         modifie_par = auth.uid()
   where c.id = p_id
     and c.etat = 'brouillon';   -- garde-course concurrente (last-writer cohérent)

  -- 5. Retour de la ligne mutée (préfixe out_* — règle anti-ambiguïté RETURNS TABLE).
  return query
    select c.id, c.etat
    from public.compositions c
    where c.id = p_id;
end;
$function$;

-- Périmètre d'appel : authentifiés uniquement (le contrôle fin est interne).
revoke all on function public.valider_composition(uuid) from public;
grant execute on function public.valider_composition(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Vérification fail-loud : la fonction et ses dépendances doivent exister.
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_ok boolean;
begin
  -- 1. Le RPC existe.
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'valider_composition' and p.prokind = 'f'
  ) into v_ok;
  if not v_ok then
    raise exception 'sql_91 KO : valider_composition introuvable apres deploiement.';
  end if;

  -- 2. Dépendance helper de dérivation catégorie (sonde 5d).
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '_b5_categorie_de_composition' and p.prokind = 'f'
  ) into v_ok;
  if not v_ok then
    raise exception 'sql_91 KO : dependance _b5_categorie_de_composition absente.';
  end if;

  -- 3. Dépendance helper capability (sql_88).
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'puis_je_faire' and p.prokind = 'f'
  ) into v_ok;
  if not v_ok then
    raise exception 'sql_91 KO : dependance puis_je_faire absente.';
  end if;

  raise notice 'sql_91 OK : valider_composition installe, dependances presentes.';
end;
$verif$;
