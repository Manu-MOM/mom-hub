-- =============================================================================
-- sql_130_generer_reference_commande.sql
-- Genere une reference commande INTERNE MOM, sequence GLOBALE jamais remise a zero.
-- Format : <saison normalisee>-<NNN zero-padde 3>  ex. 2025-2026-014
-- Decisions de modele (conv pt 128, ecart de sujet trace) :
--   - sequence GLOBALE (un seul compteur, tous beneficiaires/saisons confondus) ;
--   - PAS de segment beneficiaire (decoratif inutile en sequence globale) ;
--   - millesime = saisons.code de la saison active, slash -> tiret ;
--   - source de verite = table compteur dediee (insensible aux refs manuelles
--     hors-format deja en base, ex. 'xxx' ; un parsing max+1 serait fragile) ;
--   - la RPC NE TOUCHE PAS missions : elle delivre le prochain numero, le front
--     le place dans le champ (override-safe : ne remplit que si vide), puis
--     upsert_mission l'enregistre comme une valeur ordinaire (p_reference_commande,
--     present dans la signature 20-params, sonde M pt 128).
-- Garde : admin|bureau (aligne _gs_peut_ecrire). SECURITY DEFINER + REVOKE.
-- =============================================================================

-- 1) Table compteur ---------------------------------------------------------
-- Sequence globale -> une seule cle logique ('global'). La cle est gardee
-- generique pour permettre, si un jour besoin, des compteurs segmentes sans
-- changer le schema (cle = 'global' aujourd'hui).
create table if not exists public.compteur_reference (
  cle          text primary key,
  dernier_num  integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- Amorce de la ligne globale (idempotent : ne reecrit pas si deja presente).
insert into public.compteur_reference (cle, dernier_num)
values ('global', 0)
on conflict (cle) do nothing;

-- RLS : la table n'est jamais lue/ecrite directement par le front ; seul le
-- proprietaire (RPC SECURITY DEFINER) y touche. On verrouille tout acces direct.
alter table public.compteur_reference enable row level security;
revoke all on public.compteur_reference from anon;
revoke all on public.compteur_reference from authenticated;
-- (aucune policy => aucun acces direct ; la RPC contourne via SECURITY DEFINER.)

-- 2) RPC de generation ------------------------------------------------------
create or replace function public.generer_reference_commande()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_saison     text;
  v_num        integer;
  v_ref        text;
begin
  -- Garde : admin|bureau, via la fonction canonique de la base (sonde Q pt 128).
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).';
  end if;

  -- Millesime : code de la saison active, slash -> tiret (ex. 2025/2026 -> 2025-2026).
  v_saison := (select replace(s.code, '/', '-') from public.saisons s where s.est_active = true limit 1);
  if v_saison is null then
    raise exception 'Aucune saison active : impossible de generer une reference.';
  end if;

  -- Increment ATOMIQUE de la sequence globale (update ... returning : pas de race).
  update public.compteur_reference
     set dernier_num = dernier_num + 1, updated_at = now()
   where cle = 'global'
  returning dernier_num into v_num;

  -- Securite : si la ligne 'global' manquait, on l'amorce et on repart a 1.
  if v_num is null then
    insert into public.compteur_reference (cle, dernier_num) values ('global', 1)
    on conflict (cle) do update set dernier_num = public.compteur_reference.dernier_num + 1, updated_at = now()
    returning dernier_num into v_num;
  end if;

  -- Assemblage : <saison>-<NNN zero-padde 3 mini, s'etend au-dela de 999>.
  v_ref := v_saison || '-' || to_char(v_num, 'FM000');
  return v_ref;
end;
$function$;

-- 3) Permissions ------------------------------------------------------------
revoke all on function public.generer_reference_commande() from public;
revoke all on function public.generer_reference_commande() from anon;
grant execute on function public.generer_reference_commande() to authenticated;

-- 4) Verification fail-loud -------------------------------------------------
do $verif$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'generer_reference_commande'
  ) into v_exists;
  if not v_exists then
    raise exception 'VERIF: generer_reference_commande absente apres creation.';
  end if;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'compteur_reference'
  ) into v_exists;
  if not v_exists then
    raise exception 'VERIF: table compteur_reference absente apres creation.';
  end if;

  if not exists (select 1 from public.compteur_reference where cle = 'global') then
    raise exception 'VERIF: ligne compteur global non amorcee.';
  end if;

  raise notice 'VERIF OK : compteur_reference + generer_reference_commande en place.';
end;
$verif$;
