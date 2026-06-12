-- pt 82 (chantier import OVAL-E intégré) : RPC d'import de personnes.qualites_ffr depuis le Hub.
-- Reproduit l'effet de sql_81_peuplement_qualites_ffr.sql, mais alimenté par un payload front
--   (écran import-oval-e.html : SheetJS parse l'export, agrège les codes par licence, envoie le JSON).
--
-- Doctrine (faits vérifiés à la source 12/06) :
--   - personnes.qualites_ffr est text[] ; numero_licence_ffr est text ; PK = id.
--   - est_staff_ffr(text[]) socle {DC4,EDU,ECF,SOI,B,ACF} ; est_staff() dérive à la lecture.
--   - NON-DESTRUCTIF : la RPC n'écrit QUE qualites_ffr. categorie_personne, est_parent,
--     est_salarie, staff_exclu, est_staff_manuel, qualite_ffr : JAMAIS touchés.
--   - Idempotent : pose la valeur cible, rejouable sans effet de bord.
--   - Cas 2 (licence du payload sans fiche en base) : SIGNALÉ, jamais inséré (décision pt 81).
--   - Cas 3 (fiche licenciée en base absente du payload) : aucune action (NULL géré par est_staff()).
--   - Garde : has_role('admin') (calque _gs_peut_ecrire mais module données sensibles = admin strict).
--   - Pattern RPC : SECURITY DEFINER + set search_path = public + REVOKE PUBLIC / GRANT authenticated
--     + bloc de vérification fail-loud (calque sql_78_socle_gestion_salarie).
begin;

-- ============================================================================
-- 1. VOCABULAIRE FFR connu — pour l'alerte "code inconnu"
-- ============================================================================
-- 12 codes observés (sql_81 + socle est_staff_ffr). Un code hors de cette liste
-- déclenche un signalement dans le rapport : décision humaine avant d'élargir
-- le socle staff (est_staff_ffr). La fonction est IMMUTABLE (faits stables).
create or replace function public.vocabulaire_ffr_connu()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['A','DC4','RLSP','EDU','SOI','AM','ECF','B','RLO','PAR','RF2','ACF']::text[];
$$;

comment on function public.vocabulaire_ffr_connu() is
  'pt 82 : vocabulaire des 12 codes FFR connus. Tout code hors liste est signalé à l''import.';

-- ============================================================================
-- 2. RPC d'IMPORT — import_qualites_ffr(p_payload jsonb)
-- ============================================================================
-- Payload attendu (produit par le front) :
--   [ { "lic": "1979091053933", "codes": ["A","DC4","ECF"] }, ... ]
-- Retour : une ligne-rapport JSON (out_*), affichée telle quelle par l'écran.
--   out_matchees       int    : nb de fiches dont qualites_ffr a été (re)posé.
--   out_cas2           jsonb  : [{ "lic": ... }] licences du payload sans fiche en base.
--   out_cas3           jsonb  : [{ "lic": ..., "nom": ..., "prenom": ... }] fiches licenciées
--                               en base absentes du payload (qualites_ffr laissé tel quel).
--   out_codes_inconnus jsonb  : [{ "code": ..., "lic": ... }] codes hors vocabulaire connu.
--   out_total_payload  int    : nb de licences distinctes reçues dans le payload.
create or replace function public.import_qualites_ffr(p_payload jsonb)
returns table(
  out_matchees        int,
  out_cas2            jsonb,
  out_cas3            jsonb,
  out_codes_inconnus  jsonb,
  out_total_payload   int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connu text[] := public.vocabulaire_ffr_connu();
begin
  -- Garde admin stricte (module données sensibles : import licences).
  if not public.has_role('admin') then
    raise exception 'Réservé à l''administration (admin).';
  end if;

  -- Validation minimale du payload.
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then
    raise exception 'Payload invalide : tableau JSON attendu.';
  end if;

  -- Vue de travail : une ligne par licence du payload, codes en text[].
  create temporary table _imp_src on commit drop as
  select
    btrim(elem->>'lic')                                   as lic,
    (select array_agg(distinct btrim(c::text) order by btrim(c::text))
       from jsonb_array_elements_text(elem->'codes') c
      where btrim(c::text) <> '')                          as codes
  from jsonb_array_elements(p_payload) elem
  where coalesce(btrim(elem->>'lic'), '') <> '';

  -- UPDATE non-destructif : n'écrit QUE qualites_ffr, jointure par numero_licence_ffr.
  update public.personnes p
  set qualites_ffr = s.codes
  from _imp_src s
  where p.numero_licence_ffr = s.lic;

  get diagnostics out_matchees = row_count;

  -- Cas 2 : licences du payload sans fiche en base (signalées, jamais créées).
  select coalesce(jsonb_agg(jsonb_build_object('lic', s.lic) order by s.lic), '[]'::jsonb)
    into out_cas2
  from _imp_src s
  where not exists (
    select 1 from public.personnes p where p.numero_licence_ffr = s.lic
  );

  -- Cas 3 : fiches licenciées en base absentes du payload (aucune action).
  select coalesce(jsonb_agg(
            jsonb_build_object('lic', p.numero_licence_ffr, 'nom', p.nom, 'prenom', p.prenom)
            order by p.nom, p.prenom), '[]'::jsonb)
    into out_cas3
  from public.personnes p
  where p.numero_licence_ffr is not null
    and btrim(p.numero_licence_ffr) <> ''
    and not exists (
      select 1 from _imp_src s where s.lic = p.numero_licence_ffr
    );

  -- Codes inconnus : tout code du payload hors vocabulaire connu.
  select coalesce(jsonb_agg(
            jsonb_build_object('code', x.code, 'lic', x.lic) order by x.code, x.lic), '[]'::jsonb)
    into out_codes_inconnus
  from (
    select distinct s.lic, code
    from _imp_src s, unnest(s.codes) as code
    where not (code = any(v_connu))
  ) x;

  select count(*)::int into out_total_payload from _imp_src;

  return next;
end;
$$;

comment on function public.import_qualites_ffr(jsonb) is
  'pt 82 : import non-destructif de qualites_ffr depuis l''export OVAL-E (payload front). '
  'N''écrit QUE qualites_ffr. Renvoie le rapport de réconciliation 3 cas + codes inconnus.';

-- ============================================================================
-- 3. DROITS — RLS fermée, exécution réservée aux comptes connectés (garde admin interne)
-- ============================================================================
revoke all on function
  public.vocabulaire_ffr_connu(),
  public.import_qualites_ffr(jsonb)
  from public;

grant execute on function
  public.vocabulaire_ffr_connu(),
  public.import_qualites_ffr(jsonb)
  to authenticated;

-- ============================================================================
-- 4. VÉRIFICATION fail-loud — les 2 fonctions existent bien
-- ============================================================================
do $verif$
declare
  n_rpc int;
begin
  select count(*) into n_rpc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in ('vocabulaire_ffr_connu','import_qualites_ffr');
  if n_rpc <> 2 then
    raise exception 'IMPORT KO : % fonction(s) sur 2 attendues.', n_rpc;
  end if;
  raise notice 'IMPORT OK : vocabulaire_ffr_connu + import_qualites_ffr en place.';
end;
$verif$;

commit;
