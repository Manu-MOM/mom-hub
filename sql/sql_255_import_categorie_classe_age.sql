-- pt 2xx (chantier IMPORT-CATEGORIE) : l'import OVAL-E pose la categorie, le sexe, le pole
-- et le drapeau F15 a partir de la colonne « Classe d'age » de l'export.
--
-- CONSTAT (sondes 07/10/2026) :
--   - 67 fiches joueurs (A/AM) creees via « Creer la fiche » de import-oval-e.html avaient
--     categorie_id = NULL et sexe = NULL -> invisibles dans toutes les listes de categorie
--     (get_joueurs_categorie filtre sur p.categorie_id). Cas type : Lison JUNG.
--   - creer_personne_depuis_import n'a jamais pose categorie_id ; le front ne lisait pas
--     la colonne « Classe d'age ».
--   - Doctrine-Import-OVAL-E v1.4 §3.4 + §8 : la categorie vient de la classe d'age,
--     le sexe de son prefixe M/F (OVAL-E n'a pas de colonne sexe).
--   - Export du 07/10/2026 : colonne « Classe d'age » (5e), valeurs M-6..M+18 / F-6..F+18,
--     classe portee seulement par la ligne joueur (lignes staff vides) -> agregation front.
--     Les 67 fiches orphelines sont toutes dans l'export, toutes avec une classe.
--
-- DECISIONS GELEES (Manu, 07/10/2026, « je gele ») :
--   D1 source = classe d'age agregee sur toutes les lignes d'une licence ; sexe = prefixe.
--   D2 mapping doctrine §3.4 ramene aux codes en base (M5 fusionne dans M6, sql_137) ;
--      pole = pole de la categorie, sauf F-15 -> M14 + f15_integree + pole JEUNES_F.
--      Mapping vit a UN seul endroit : public.classe_oval_e_vers_categorie().
--   D3 creer_personne_depuis_import pose categorie/sexe/f15/pole a la creation.
--   D4 import_qualites_ffr complete ces champs UNIQUEMENT s'ils sont vides
--      (categorie_id NULL ; sexe/pole seulement si NULL) — jamais d'ecrasement.
--   D5 classe absente/inconnue -> rien n'est pose ; joueur A/AM toujours sans categorie
--      apres import -> remonte dans out_a_verifier.
--      Precision d'implementation (tracee) : la categorie n'est posee que pour les licences
--      de jeu competition (A/AM). Les licences loisirs RLO/RLSP portent aussi une classe
--      M+18/F+18 dans l'export mais relevent des categories Loisirs (filtre sur qualites).
--   D6 SQL d'abord ; import_qualites_ffr change de type de retour -> DROP + CREATE.
--      Payload sans cle « classe » (ancien front) toleré : comportement identique a avant.
--
-- Signature inchangee pour creer_personne_depuis_import (CREATE OR REPLACE sans overload).

begin;

-- ============================================================================
-- 1 — Mapping unique classe d'age OVAL-E -> categorie / sexe / f15 / pole
-- ============================================================================
create or replace function public.classe_oval_e_vers_categorie(p_classe text)
returns table (categorie_id uuid, sexe text, f15_integree boolean, pole_attache_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_norm  text := upper(regexp_replace(coalesce(p_classe, ''), '\s', '', 'g'));
  v_m     text[];
  v_sexe  text;
  v_sens  text;
  v_age   int;
  v_code  text;
  v_f15   boolean := false;
begin
  -- Format attendu : M-14, F-15, M+18 ... (prefixe sexe, signe, age).
  v_m := regexp_match(v_norm, '^([MF])([-+])([0-9]{1,2})$');
  if v_m is null then
    return;  -- classe absente ou illisible -> aucune ligne (D5)
  end if;
  v_sexe := v_m[1];
  v_sens := v_m[2];
  v_age  := v_m[3]::int;

  if v_sens = '+' and v_age = 18 then
    v_code := case v_sexe when 'M' then 'SR-M' else 'SR-F' end;
  elsif v_sens = '-' then
    v_code := case
      when v_age in (5, 6)                   then 'M6'
      when v_age = 8                         then 'M8'
      when v_age = 10                        then 'M10'
      when v_age = 12                        then 'M12'
      when v_age = 14 and v_sexe = 'M'       then 'M14'
      when v_age = 15 and v_sexe = 'F'       then 'M14'
      when v_age = 16 and v_sexe = 'M'       then 'M16'
      when v_age = 19 and v_sexe = 'M'       then 'M19'
      when v_age = 18 and v_sexe = 'F'       then 'F18'
      else null
    end;
    v_f15 := (v_age = 15 and v_sexe = 'F');
  end if;

  if v_code is null then
    return;  -- classe hors doctrine -> aucune ligne (D5)
  end if;

  return query
  select c.id,
         v_sexe,
         v_f15,
         case when v_f15
              then (select po.id from public.poles po where po.code = 'JEUNES_F')
              else c.pole_id end
  from public.categories c
  where c.code = v_code;
end;
$$;

revoke all on function public.classe_oval_e_vers_categorie(text) from public;
revoke all on function public.classe_oval_e_vers_categorie(text) from anon;
grant execute on function public.classe_oval_e_vers_categorie(text) to authenticated;
grant execute on function public.classe_oval_e_vers_categorie(text) to service_role;

-- ============================================================================
-- 2 — import_qualites_ffr : complete categorie/sexe/f15/pole si vides (D4) + out_a_verifier (D5)
-- Reproduction fidele de la definition deployee (md5 7f289956) ; ajouts = colonne classe
-- dans _imp_src, 2e UPDATE de completion, sorties out_categories_posees et out_a_verifier.
-- ============================================================================
drop function if exists public.import_qualites_ffr(jsonb);

create function public.import_qualites_ffr(p_payload jsonb)
returns table (
  out_matchees integer,
  out_cas2 jsonb,
  out_cas3 jsonb,
  out_codes_inconnus jsonb,
  out_total_payload integer,
  out_categories_posees integer,
  out_a_verifier jsonb
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_connu text[] := public.vocabulaire_ffr_connu();
  v_saison_active uuid;
begin
  if not public.has_role('admin') then
    raise exception 'Réservé à l''administration (admin).';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then
    raise exception 'Payload invalide : tableau JSON attendu.';
  end if;

  select id into v_saison_active from public.saisons where est_active = true limit 1;

  create temporary table _imp_src on commit drop as
  select
    btrim(elem->>'lic') as lic,
    (select array_agg(distinct btrim(c::text) order by btrim(c::text))
       from jsonb_array_elements_text(elem->'codes') c
      where btrim(c::text) <> '') as codes,
    nullif(btrim(coalesce(elem->>'classe', '')), '') as classe
  from jsonb_array_elements(p_payload) elem
  where coalesce(btrim(elem->>'lic'), '') <> '';

  -- UPDATE non-destructif existant : qualites_ffr + marqueur de saison.
  update public.personnes p
  set qualites_ffr = s.codes,
      derniere_saison_importee = v_saison_active
  from _imp_src s
  where p.numero_licence_ffr = s.lic;

  get diagnostics out_matchees = row_count;

  -- D4 : completion des fiches SANS categorie a partir de la classe d'age. Jamais d'ecrasement :
  -- categorie_id seulement si NULL ; sexe et pole seulement si NULL ; f15 seulement passe a true.
  update public.personnes p
  set categorie_id    = m.categorie_id,
      sexe            = coalesce(p.sexe, m.sexe),
      pole_attache_id = coalesce(p.pole_attache_id, m.pole_attache_id),
      f15_integree    = (p.f15_integree or m.f15_integree)
  from _imp_src s
  cross join lateral public.classe_oval_e_vers_categorie(s.classe) m
  where p.numero_licence_ffr = s.lic
    and p.categorie_id is null
    -- Licences de jeu competition uniquement (A/AM) : les licences loisirs (RLO/RLSP) portent
    -- aussi une classe M+18/F+18 mais vivent dans les categories Loisirs (filtre qualites).
    and coalesce(s.codes, array[]::text[]) && array['A', 'AM']::text[];

  get diagnostics out_categories_posees = row_count;

  select coalesce(jsonb_agg(jsonb_build_object('lic', s.lic) order by s.lic), '[]'::jsonb)
    into out_cas2
  from _imp_src s
  where not exists (select 1 from public.personnes p where p.numero_licence_ffr = s.lic);

  select coalesce(jsonb_agg(
           jsonb_build_object('lic', p.numero_licence_ffr, 'nom', p.nom, 'prenom', p.prenom)
           order by p.nom, p.prenom), '[]'::jsonb)
    into out_cas3
  from public.personnes p
  where p.numero_licence_ffr is not null
    and btrim(p.numero_licence_ffr) <> ''
    and not exists (select 1 from _imp_src s where s.lic = p.numero_licence_ffr);

  select coalesce(jsonb_agg(
           jsonb_build_object('code', x.code, 'lic', x.lic) order by x.code, x.lic), '[]'::jsonb)
    into out_codes_inconnus
  from (
    select distinct s.lic, code
    from _imp_src s, unnest(s.codes) as code
    where not (code = any(v_connu))
  ) x;

  -- D5 : joueurs (A/AM) de l'export dont la fiche reste sans categorie.
  select coalesce(jsonb_agg(
           jsonb_build_object('lic', p.numero_licence_ffr, 'nom', p.nom, 'prenom', p.prenom,
                              'classe', s.classe)
           order by p.nom, p.prenom), '[]'::jsonb)
    into out_a_verifier
  from _imp_src s
  join public.personnes p on p.numero_licence_ffr = s.lic
  where p.categorie_id is null
    and coalesce(s.codes, array[]::text[]) && array['A', 'AM']::text[];

  select count(*)::int into out_total_payload from _imp_src;
  return next;
end;
$function$;

revoke all on function public.import_qualites_ffr(jsonb) from public;
revoke all on function public.import_qualites_ffr(jsonb) from anon;
grant execute on function public.import_qualites_ffr(jsonb) to authenticated;
grant execute on function public.import_qualites_ffr(jsonb) to service_role;

-- ============================================================================
-- 3 — creer_personne_depuis_import : pose categorie/sexe/f15/pole a la creation (D3)
-- Reproduction fidele de la definition deployee (md5 cc45ed8b) ; ajouts = lecture classe
-- via le mapping unique + 4 colonnes a l'INSERT. Signature et retour inchanges.
-- ============================================================================
create or replace function public.creer_personne_depuis_import(p_payload jsonb)
returns table (statut text, personne_id uuid, nom text, prenom text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_lic text := btrim(coalesce(p_payload->>'lic', ''));
  v_nom text := btrim(coalesce(p_payload->>'nom', ''));
  v_prenom text := btrim(coalesce(p_payload->>'prenom', ''));
  v_codes text[];
  v_cat text;
  v_type text;
  v_a_joueur boolean;
  v_a_staff boolean;
  v_id uuid;
  v_saison_active uuid;
  v_categorie_id uuid;
  v_sexe text;
  v_f15 boolean;
  v_pole_id uuid;
begin
  if not public.has_role('admin') then raise exception 'Réservé à l''administration (admin).'; end if;
  if v_lic = '' then raise exception 'Numéro de licence requis.'; end if;
  if v_nom = '' or v_prenom = '' then raise exception 'Nom et prénom requis.'; end if;

  select id into v_id from public.personnes where numero_licence_ffr = v_lic limit 1;
  if v_id is not null then
    return query select 'existe_deja'::text, p.id, p.nom, p.prenom from public.personnes p where p.id = v_id;
    return;
  end if;

  select array_agg(distinct btrim(c) order by btrim(c)) into v_codes
  from jsonb_array_elements_text(coalesce(p_payload->'codes', '[]'::jsonb)) c
  where btrim(c) <> '';
  v_codes := coalesce(v_codes, array[]::text[]);
  v_a_joueur := v_codes && array['A', 'AM', 'RLSP', 'RLO']::text[];
  v_a_staff := v_codes && array['DC4', 'EDU', 'ECF', 'SOI', 'ACF']::text[];
  v_cat := case when v_a_joueur and v_a_staff then 'joueur_et_staff'
                when v_a_joueur then 'joueur'
                when v_a_staff then 'staff'
                else 'joueur' end;
  v_type := case when v_a_joueur then 'licencie_competition'
                 when v_codes && array['EDU', 'ECF']::text[] then 'licencie_educateur'
                 when v_codes && array['SOI']::text[] then 'licencie_soigneur'
                 when v_a_staff then 'licencie_dirigeant'
                 else 'licencie_competition' end;

  -- D3 : classe d'age -> categorie/sexe/f15/pole (aucune ligne si classe absente/inconnue).
  -- Licences de jeu competition uniquement (A/AM), comme la completion de import_qualites_ffr.
  if v_codes && array['A', 'AM']::text[] then
    select m.categorie_id, m.sexe, m.f15_integree, m.pole_attache_id
      into v_categorie_id, v_sexe, v_f15, v_pole_id
    from public.classe_oval_e_vers_categorie(p_payload->>'classe') m;
  end if;

  select id into v_saison_active from public.saisons where est_active = true limit 1;

  insert into public.personnes (
    nom, prenom, categorie_personne, type_personne, qualites_ffr, numero_licence_ffr,
    email_principal, telephone_principal, adresse_postale, code_postal, ville, date_naissance,
    nationalite_principale, date_fin_affiliation, source_creation, derniere_saison_importee,
    categorie_id, sexe, f15_integree, pole_attache_id
  ) values (
    v_nom, v_prenom, v_cat, v_type, v_codes, v_lic,
    nullif(btrim(coalesce(p_payload->>'email', '')), ''),
    nullif(btrim(coalesce(p_payload->>'tel', '')), ''),
    nullif(btrim(coalesce(p_payload->>'adresse', '')), ''),
    nullif(btrim(coalesce(p_payload->>'cp', '')), ''),
    nullif(btrim(coalesce(p_payload->>'ville', '')), ''),
    (nullif(btrim(coalesce(p_payload->>'date_naissance', '')), ''))::date,
    coalesce(nullif(btrim(coalesce(p_payload->>'nationalite', '')), ''), 'France'),
    (nullif(btrim(coalesce(p_payload->>'date_fin_affiliation', '')), ''))::date,
    'import-oval-e', v_saison_active,
    v_categorie_id, v_sexe, coalesce(v_f15, false), v_pole_id
  )
  returning id into v_id;

  return query select 'cree'::text, v_id, v_nom, v_prenom;
end;
$function$;

-- ============================================================================
-- 4 — Verification fail-loud du mapping (D2) — echoue -> rollback de toute la transaction
-- ============================================================================
do $verif$
declare
  r record;
  v_cat text;
  v_sexe text;
  v_f15 boolean;
  v_pole text;
begin
  for r in
    select * from (values
      ('M-5', 'M6', 'M', false, 'EDR'), ('F-5', 'M6', 'F', false, 'EDR'),
      ('M-6', 'M6', 'M', false, 'EDR'), ('F-6', 'M6', 'F', false, 'EDR'),
      ('M-8', 'M8', 'M', false, 'EDR'), ('F-8', 'M8', 'F', false, 'EDR'),
      ('M-10', 'M10', 'M', false, 'EDR'), ('F-10', 'M10', 'F', false, 'EDR'),
      ('M-12', 'M12', 'M', false, 'EDR'), ('F-12', 'M12', 'F', false, 'EDR'),
      ('M-14', 'M14', 'M', false, 'EDR'), ('F-15', 'M14', 'F', true, 'JEUNES_F'),
      ('M-16', 'M16', 'M', false, 'JEUNES'), ('M-19', 'M19', 'M', false, 'JEUNES'),
      ('F-18', 'F18', 'F', false, 'JEUNES_F'),
      ('M+18', 'SR-M', 'M', false, 'SENIORS'), ('F+18', 'SR-F', 'F', false, 'SENIORS')
    ) t (classe, cat, sexe, f15, pole)
  loop
    select c.code, m.sexe, m.f15_integree, po.code
      into v_cat, v_sexe, v_f15, v_pole
    from public.classe_oval_e_vers_categorie(r.classe) m
    join public.categories c on c.id = m.categorie_id
    left join public.poles po on po.id = m.pole_attache_id;
    if v_cat is distinct from r.cat or v_sexe is distinct from r.sexe
       or v_f15 is distinct from r.f15 or v_pole is distinct from r.pole then
      raise exception 'VERIF KO % -> %/%/%/% (attendu %/%/%/%)',
        r.classe, v_cat, v_sexe, v_f15, v_pole, r.cat, r.sexe, r.f15, r.pole;
    end if;
  end loop;
  if exists (select 1 from public.classe_oval_e_vers_categorie(null))
     or exists (select 1 from public.classe_oval_e_vers_categorie(''))
     or exists (select 1 from public.classe_oval_e_vers_categorie('M-15'))
     or exists (select 1 from public.classe_oval_e_vers_categorie('XYZ')) then
    raise exception 'VERIF KO : une classe absente/inconnue produit une categorie';
  end if;
  raise notice 'VERIF OK : 17 classes mappees, classes absentes/inconnues ignorees';
end;
$verif$;

commit;
