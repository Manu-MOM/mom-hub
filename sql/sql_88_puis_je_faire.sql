-- =============================================================
-- sql/sql_88_puis_je_faire.sql
--
-- BUT : créer le HELPER D'INDIRECTION UNIQUE puis_je_FAIRE(action,
--       categorie) du modèle S1 (voie 2). Il raffine
--       puis_je_ecrire_categorie en distinguant l'ACTION métier,
--       via la table capabilities_fonction (sql_87) et l'Union (D-C).
--
-- CONTEXTE (pt 90 → production voie 2, FAIT FOI md5 9aa943e6) :
--   - Aujourd'hui les 18 policies B5 appellent puis_je_ecrire_
--     categorie(cat) : « ce référent couvre-t-il cette catégorie ? »
--     (grain catégorie, pas action). sql_64 réel :
--         exists(select 1 from mes_categories_autorisees() m
--                where m.est_transverse or m.categorie_id = cat)
--   - puis_je_FAIRE ajoute le grain ACTION : « ce référent a-t-il,
--     sur cette catégorie, AU MOINS une fonction portant la
--     capability <action> ? » (Union, D-C).
--
-- GARDE-FOU P1 (impératif FAIT FOI §4.3) : UN SEUL helper
--   d'indirection. Pas un helper par action. La finesse vient de la
--   DONNÉE (capabilities_fonction), pas du code. Si la mécanique se
--   met à ressembler à un moteur, elle est fausse.
--
-- RÉUTILISE LA LOGIQUE de mes_categories_autorisees (sql_64, lue à
--   la source) SANS l'appeler : ce helper a besoin du lien
--   fonction → catégorie que mes_categories_autorisees efface
--   (elle ne renvoie que la catégorie). Même patron de dérivation :
--   porte referent + qui_suis_je().personne_id + fonction_staff
--   active + _b5_norm.
--
-- NB ADJOINT : ce helper NE dépend PAS du filtre WHERE de
--   mes_categories_autorisees (qui exclut l'adjoint). L'adjoint est
--   reconnu ICI dès qu'il a une ligne capabilities_fonction. Le
--   lot 3 (extension du filtre) reste requis pour les AUTRES usages
--   de mes_categories_autorisees (lecture / affichage périmètre),
--   pas pour ce helper d'écriture.
--
-- Idempotent (create or replace), fail-loud d'auto-test.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. Helper d'indirection unique
--    SECURITY DEFINER + search_path verrouillé + STABLE,
--    patron identique aux helpers B5 existants.
-- -------------------------------------------------------------

create or replace function public.puis_je_faire(
  p_action      text,
  p_categorie_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_personne_id uuid;
begin
  -- Niveaux 1 & 2 (admin / bureau) : laissez-passer transverse.
  -- Identique à la branche transverse de puis_je_ecrire_categorie :
  -- l'action n'est pas modulée pour les rôles transverses.
  if has_role('admin') or has_role('bureau') then
    return true;
  end if;

  -- Niveau 3 (referent) : la porte est requise (jeton de voie, D-B).
  -- Un compte sans le rôle 'referent' n'écrit pas, même s'il portait
  -- par accident une fonction_staff.
  if not has_role('referent') then
    return false;
  end if;

  -- Personne reliée (même chemin que mes_categories_autorisees).
  select qs.personne_id into v_personne_id
  from public.qui_suis_je() qs
  limit 1;

  -- referent non relié à une fiche -> aucun droit (plancher D7).
  if v_personne_id is null then
    return false;
  end if;

  -- Union (D-C) : autorisé si AU MOINS une fonction_staff active de
  -- la personne, COUVRANT p_categorie_id, porte la capability
  -- p_action (autorise=true) dans capabilities_fonction.
  return exists (
    select 1
    from public.fonction_staff fs
    join public.capabilities_fonction c
      on c.fonction_normalisee = public._b5_norm(fs.fonction)
    where fs.personne_id = v_personne_id
      and fs.date_fin is null
      and fs.categorie_id = p_categorie_id
      and c.action = p_action
      and c.autorise is true
  );
end;
$fn$;

comment on function public.puis_je_faire(text, uuid) is
  'Voie 2 (S1) : helper d''indirection UNIQUE. true si admin/bureau '
  '(transverse) OU si le referent connecté a, sur la catégorie, au '
  'moins une fonction_staff portant la capability action (Union, D-C). '
  'Raffine puis_je_ecrire_categorie par le grain action. '
  'Lit capabilities_fonction (donnée plate) — la finesse est dans la '
  'donnée, pas le code (P1).';

-- -------------------------------------------------------------
-- 2. Droits : REVOKE PUBLIC / GRANT authenticated
--    (patron uniforme des helpers d'autorisation).
-- -------------------------------------------------------------

revoke all on function public.puis_je_faire(text, uuid) from public;
grant execute on function public.puis_je_faire(text, uuid) to authenticated;

-- -------------------------------------------------------------
-- 3. FAIL-LOUD : le helper doit exister avec la bonne signature
--    et s'appuyer sur une table capabilities_fonction peuplée.
--    (Test fonctionnel par rôle = recette terrain, hors SQL :
--     auth.uid() est null en SQL Editor.)
-- -------------------------------------------------------------
do $verif$
declare
  v_sig  int;
  v_caps int;
begin
  -- (a) signature exacte (text, uuid) -> boolean
  select count(*) into v_sig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'puis_je_faire'
    and p.prokind = 'f'
    and pg_get_function_identity_arguments(p.oid) = 'p_action text, p_categorie_id uuid';
  if v_sig <> 1 then
    raise exception 'FAIL-LOUD : puis_je_faire(text,uuid) absent ou signature inattendue (% trouvée).', v_sig;
  end if;

  -- (b) la table de capabilities est bien là et peuplée (dépendance dure)
  select count(*) into v_caps from public.capabilities_fonction;
  if v_caps < 1 then
    raise exception 'FAIL-LOUD : capabilities_fonction vide — exécuter sql_87 d''abord.';
  end if;

  raise notice 'OK : puis_je_faire(text,uuid) créé, capabilities_fonction peuplée (% lignes).', v_caps;
end;
$verif$;

commit;
