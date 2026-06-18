-- =============================================================================
-- sql_92_ma_fonction_staff.sql
-- =============================================================================
-- Voie 2 — modèle rôles encadrants S1 — LOT 6b (topbar par fonction).
--
-- Objet : RPC self-only `ma_fonction_staff()` qui renvoie le LIBELLÉ BRUT de la
--         fonction_staff active la plus « élevée » de la personne connectée,
--         pour que la topbar affiche la vraie fonction (et non le rôle brut
--         `referent`, qui faisait afficher « Référent » à un adjoint — bug pt 88).
--
-- Pourquoi une RPC NEUVE (DS-1, sondes lot 6b) :
--   - `list_fonctions_de_personne(p_personne_id)` existe MAIS est gardée admin
--     (pt 69, écran Rôles & accès) → un encadrant non-admin ne peut pas l'appeler
--     sur lui-même (même piège que get_noms_personnes au greeting pt 86).
--   - Aucune RPC self-only ne résout la fonction de la personne connectée.
--   → On calque exactement le pattern `mon_prenom()` (pt 86) : SECURITY DEFINER,
--     sans paramètre, résolution via auth.uid()/qui_suis_je(), EXECUTE authenticated,
--     ne lit JAMAIS la fiche d'autrui.
--
-- Modèle d'affichage (décision Manu, option A) : UNE seule fonction en topbar,
--   la plus élevée par priorité Référent > Manager > Entr. principal > Adjoint.
--   Le cumul réel reste consultable via l'écran Staff.
--
-- Décisions d'implémentation (tracées) :
--   - priorité encodée par CASE ordinal sur _b5_norm(fonction) (réutilise la
--     normalisation B5 réelle ; robuste à la casse/accents des libellés bruts) ;
--   - renvoie le LIBELLÉ BRUT (fonction tel quel) — le mapping brut→affichage
--     (« Référent de catégorie » → « Référent ») se fait côté front (_ROLE_LABELS) ;
--   - NULL si aucune fonction active → le front dégrade honnêtement (texte en dur).
--
-- DS-1 : structure fonction_staff lue à la source (sonde 6b-1 :
--   fonction text NOT NULL, personne_id, categorie_id, date_debut, date_fin nullable).
--   Libellés bruts réels confirmés (sonde 6b-3) : « Référent de catégorie »,
--   « Manager », « Entraîneur principal », « Entraîneur adjoint ». qui_suis_je()
--   RETURNS TABLE(personne_id uuid) (héritée pt 86). Rien inventé.
-- =============================================================================

create or replace function public.ma_fonction_staff()
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_personne_id uuid;
  v_fonction    text;
begin
  -- Résolution self-only : la fiche de la personne connectée, jamais une autre.
  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  -- Compte non relié (pas de pont auth_personne) -> rien à afficher.
  if v_personne_id is null then
    return null;
  end if;

  -- Fonction active la plus élevée par priorité métier (option A) :
  --   Référent (1) > Manager (2) > Entr. principal (3) > Adjoint (4) > autre (9).
  -- Tri sur _b5_norm (normalisation B5 réelle) puis date_debut récente en
  -- départage. Renvoie le LIBELLÉ BRUT (fs.fonction), mappé à l'affichage côté
  -- front.
  select fs.fonction into v_fonction
  from public.fonction_staff fs
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

  return v_fonction;  -- NULL si aucune fonction active (dégradation honnête côté front)
end;
$function$;

-- Self-only : tout authentifié peut lire SA fonction ; le corps borne à auth.uid().
revoke all on function public.ma_fonction_staff() from public;
grant execute on function public.ma_fonction_staff() to authenticated;

-- -----------------------------------------------------------------------------
-- Vérification fail-loud : la fonction et sa dépendance qui_suis_je() existent.
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_ok boolean;
begin
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ma_fonction_staff' and p.prokind = 'f'
  ) into v_ok;
  if not v_ok then
    raise exception 'sql_92 KO : ma_fonction_staff introuvable apres deploiement.';
  end if;

  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'qui_suis_je' and p.prokind = 'f'
  ) into v_ok;
  if not v_ok then
    raise exception 'sql_92 KO : dependance qui_suis_je absente.';
  end if;

  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '_b5_norm' and p.prokind = 'f'
  ) into v_ok;
  if not v_ok then
    raise exception 'sql_92 KO : dependance _b5_norm absente.';
  end if;

  raise notice 'sql_92 OK : ma_fonction_staff installe, dependances presentes.';
end;
$verif$;
