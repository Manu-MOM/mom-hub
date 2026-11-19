-- =====================================================================
-- sql_272_collectif_auto — FAIT FOI COLLECTIF-AUTO v1, lot L1
-- Gelé par Manu le 19/11/2026 (« je gèle »).
--
-- 1. Déclencheur personnes -> collectif_membre (D1, T1-T4) :
--    un joueur éligible qui reçoit une catégorie ayant UNE entente sur la
--    saison active est inscrit (joueur, regulier, date du jour) au collectif
--    de cette entente. Ajout seulement, jamais de clôture (D2).
--    T2 précisé (19/11, avant code) : pas d'inscription si le joueur a DÉJÀ
--    eu une adhésion joueur à cette entente, même close — un retrait fait
--    par un encadrant n'est jamais annulé par un import suivant.
--    T3 : pas d'entente (ex. F18, D5) ou plusieurs -> rien, sans erreur.
-- 2. creer_personne_depuis_import (signature inchangée, T6) :
--    B traité comme A/AM (T5) ; loisir seul -> catégorie RLSP ou RLO (D3).
-- 3. import_qualites_ffr (signature inchangée, T6) :
--    complétion de catégorie étendue à B (T5) et au loisir seul (D3) ;
--    out_categories_posees compte les deux ; out_a_verifier inclut B.
--
-- Mode : DRY-RUN — installation + tests sur fiches fictives (session admin
--   simulée) + contrôle final + ROLLBACK. Version COMMIT = même corps sans
--   la section TESTS ni le contrôle final, sur feu vert de Manu.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Déclencheur d'inscription au collectif
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._collectif_auto_inscrire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_ententes uuid[];
begin
  if new.categorie_id is null or coalesce(new.est_archive, false) then
    return null;
  end if;
  -- T1 : partenaires exclus (enrôlés à la main) ; sinon licencié compétition
  -- ou porteur d'un code joueur.
  if coalesce(new.type_personne, '') = 'licencie_externe_partenaire' then
    return null;
  end if;
  if not (coalesce(new.type_personne, '') = 'licencie_competition'
          or coalesce(new.qualites_ffr, array[]::text[]) && array['A', 'AM', 'B', 'RLO', 'RLSP']::text[]) then
    return null;
  end if;

  -- T3 : exactement une entente pour la catégorie sur la saison active.
  select array_agg(e.id) into v_ententes
  from public.ententes e
  where e.categorie_id = new.categorie_id
    and e.saison_id = public._pp_saison_active();
  if coalesce(array_length(v_ententes, 1), 0) <> 1 then
    return null;
  end if;

  -- T2 (précisé) : jamais inscrit comme joueur à cette entente, même par le passé.
  if exists (select 1 from public.collectif_membre cm
             where cm.personne_id = new.id
               and cm.entente_id = v_ententes[1]
               and cm.role = 'joueur') then
    return null;
  end if;

  insert into public.collectif_membre (personne_id, entente_id, role, statut, date_debut)
  values (new.id, v_ententes[1], 'joueur', 'regulier', current_date)
  on conflict do nothing;

  return null;
end;
$function$;

REVOKE ALL ON FUNCTION public._collectif_auto_inscrire() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS collectif_auto_inscrire ON public.personnes;
CREATE TRIGGER collectif_auto_inscrire
AFTER INSERT OR UPDATE OF categorie_id, type_personne, qualites_ffr, est_archive ON public.personnes
FOR EACH ROW EXECUTE FUNCTION public._collectif_auto_inscrire();

-- ---------------------------------------------------------------------
-- 2. creer_personne_depuis_import : B + loisir
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creer_personne_depuis_import(p_payload jsonb)
RETURNS TABLE(statut text, personne_id uuid, nom text, prenom text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- sql_272 (T5) : B = joueur.
  v_a_joueur := v_codes && array['A', 'AM', 'B', 'RLSP', 'RLO']::text[];
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

  -- D3 (sql_255) : classe d'age -> categorie/sexe/f15/pole. sql_272 (T5) : B inclus.
  if v_codes && array['A', 'AM', 'B']::text[] then
    select m.categorie_id, m.sexe, m.f15_integree, m.pole_attache_id
      into v_categorie_id, v_sexe, v_f15, v_pole_id
    from public.classe_oval_e_vers_categorie(p_payload->>'classe') m;
  -- sql_272 (D3 COLLECTIF-AUTO) : loisir seul -> categorie RLSP, sinon RLO.
  elsif v_codes && array['RLSP']::text[] then
    select c.id into v_categorie_id from public.categories c where c.code = 'RLSP';
  elsif v_codes && array['RLO']::text[] then
    select c.id into v_categorie_id from public.categories c where c.code = 'RLO';
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

-- ---------------------------------------------------------------------
-- 3. import_qualites_ffr : complétion B + loisir
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_qualites_ffr(p_payload jsonb)
RETURNS TABLE(out_matchees integer, out_cas2 jsonb, out_cas3 jsonb, out_codes_inconnus jsonb,
              out_total_payload integer, out_categories_posees integer, out_a_verifier jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_connu text[] := public.vocabulaire_ffr_connu();
  v_saison_active uuid;
  v_n_loisir integer;
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
    -- Licences de jeu competition (A/AM, et B depuis sql_272 T5).
    and coalesce(s.codes, array[]::text[]) && array['A', 'AM', 'B']::text[];

  get diagnostics out_categories_posees = row_count;

  -- sql_272 (D3 COLLECTIF-AUTO) : loisir seul (sans A/AM/B) -> categorie RLSP, sinon RLO.
  -- Jamais d'ecrasement : categorie_id seulement si NULL.
  update public.personnes p
  set categorie_id = c.id
  from _imp_src s, public.categories c
  where p.numero_licence_ffr = s.lic
    and p.categorie_id is null
    and not (coalesce(s.codes, array[]::text[]) && array['A', 'AM', 'B']::text[])
    and coalesce(s.codes, array[]::text[]) && array['RLSP', 'RLO']::text[]
    and c.code = case when s.codes && array['RLSP']::text[] then 'RLSP' else 'RLO' end;

  get diagnostics v_n_loisir = row_count;
  out_categories_posees := out_categories_posees + v_n_loisir;

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

  -- D5 : joueurs (A/AM/B) de l'export dont la fiche reste sans categorie.
  select coalesce(jsonb_agg(
           jsonb_build_object('lic', p.numero_licence_ffr, 'nom', p.nom, 'prenom', p.prenom,
                              'classe', s.classe)
           order by p.nom, p.prenom), '[]'::jsonb)
    into out_a_verifier
  from _imp_src s
  join public.personnes p on p.numero_licence_ffr = s.lic
  where p.categorie_id is null
    and coalesce(s.codes, array[]::text[]) && array['A', 'AM', 'B']::text[];

  select count(*)::int into out_total_payload from _imp_src;
  return next;
end;
$function$;

-- ===== TESTS (dry-run uniquement) =====
-- Session admin simulée (locale à la transaction).
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT user_id FROM public.auth_roles WHERE role = 'admin' LIMIT 1), 'role', 'authenticated')::text,
  true);

CREATE TEMP TABLE _t (cas text, personne_id uuid) ON COMMIT DROP;

INSERT INTO _t SELECT 'A M-8', r.personne_id FROM public.creer_personne_depuis_import(
  '{"lic":"ZZTEST272A","nom":"zztest","prenom":"alpha","codes":["A"],"classe":"M-8"}'::jsonb) r;
INSERT INTO _t SELECT 'RLSP M+18', r.personne_id FROM public.creer_personne_depuis_import(
  '{"lic":"ZZTEST272L","nom":"zztest","prenom":"loisir","codes":["RLSP","DC4"],"classe":"M+18"}'::jsonb) r;
INSERT INTO _t SELECT 'B M+18', r.personne_id FROM public.creer_personne_depuis_import(
  '{"lic":"ZZTEST272B","nom":"zztest","prenom":"bravo","codes":["B"],"classe":"M+18"}'::jsonb) r;
INSERT INTO _t SELECT 'A F-18', r.personne_id FROM public.creer_personne_depuis_import(
  '{"lic":"ZZTEST272F","nom":"zztest","prenom":"foxtrot","codes":["A"],"classe":"F-18"}'::jsonb) r;

-- Partenaire posé à la main en M16 : pas d'inscription attendue.
WITH ins AS (
  INSERT INTO public.personnes (nom, prenom, categorie_personne, type_personne, categorie_id, source_creation)
  SELECT 'ZZTEST', 'Partenaire', 'joueur', 'licencie_externe_partenaire', c.id, 'test-sql_272'
  FROM public.categories c WHERE c.code = 'M16'
  RETURNING id)
INSERT INTO _t SELECT 'partenaire M16', id FROM ins;

-- Fiche RLO sans catégorie, complétée par import_qualites_ffr.
WITH ins AS (
  INSERT INTO public.personnes (nom, prenom, categorie_personne, type_personne, numero_licence_ffr, source_creation)
  VALUES ('ZZTEST', 'Romeo', 'joueur', 'licencie_competition', 'ZZTEST272R', 'test-sql_272')
  RETURNING id)
INSERT INTO _t SELECT 'import RLO', id FROM ins;
CREATE TEMP TABLE _imp_res ON COMMIT DROP AS
SELECT * FROM public.import_qualites_ffr('[{"lic":"ZZTEST272R","codes":["RLO"],"classe":"F+18"}]'::jsonb);

-- Retrait manuel respecté : on clôt l'adhésion de 'A M-8', puis on retouche la fiche.
UPDATE public.collectif_membre cm SET date_fin = CURRENT_DATE
FROM _t WHERE _t.cas = 'A M-8' AND cm.personne_id = _t.personne_id;
UPDATE public.personnes p SET qualites_ffr = array['A', 'AM']
FROM _t WHERE _t.cas = 'A M-8' AND p.id = _t.personne_id;

DO $verif$
DECLARE
  v_n int;
  v_attendu record;
BEGIN
  SELECT count(*) INTO v_n FROM pg_trigger
  WHERE tgrelid = 'public.personnes'::regclass AND tgname = 'collectif_auto_inscrire' AND NOT tgisinternal;
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: déclencheur absent'; END IF;

  FOR v_attendu IN
    SELECT * FROM (VALUES ('A M-8', 'M8', 1), ('RLSP M+18', 'RLSP', 1), ('B M+18', 'SR-M', 1),
                          ('A F-18', 'F18', 0), ('partenaire M16', 'M16', 0), ('import RLO', 'RLO', 1))
      AS v (cas, cat, nb_adhesions)
  LOOP
    SELECT count(*) INTO v_n FROM _t JOIN public.personnes p ON p.id = _t.personne_id
      JOIN public.categories c ON c.id = p.categorie_id
    WHERE _t.cas = v_attendu.cas AND c.code = v_attendu.cat;
    IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: cas % : catégorie % non posée', v_attendu.cas, v_attendu.cat; END IF;
    SELECT count(*) INTO v_n FROM _t JOIN public.collectif_membre cm ON cm.personne_id = _t.personne_id
    WHERE _t.cas = v_attendu.cas AND cm.role = 'joueur';
    IF v_n <> v_attendu.nb_adhesions THEN
      RAISE EXCEPTION 'VERIF: cas % : % adhésion(s) joueur au lieu de %', v_attendu.cas, v_n, v_attendu.nb_adhesions;
    END IF;
  END LOOP;

  SELECT out_categories_posees INTO v_n FROM _imp_res;
  IF v_n <> 1 THEN RAISE EXCEPTION 'VERIF: import_qualites_ffr a posé % catégorie(s) au lieu de 1', v_n; END IF;
  RAISE NOTICE 'VERIF OK';
END;
$verif$;

-- ===== CONTRÔLE (dry-run uniquement) =====
DO $fin$ BEGIN RAISE EXCEPTION 'RESULTATS_DRYRUN: %', (
  SELECT string_agg(_t.cas || ' -> ' || coalesce(c.code, '(aucune)') || ' / adhésions joueur : '
         || (SELECT count(*) FROM public.collectif_membre cm WHERE cm.personne_id = _t.personne_id AND cm.role = 'joueur')
         || ' (actives : '
         || (SELECT count(*) FROM public.collectif_membre cm WHERE cm.personne_id = _t.personne_id AND cm.role = 'joueur'
               AND (cm.date_fin IS NULL OR cm.date_fin > CURRENT_DATE)) || ')', ' || ' ORDER BY _t.cas)
  FROM _t JOIN public.personnes p ON p.id = _t.personne_id LEFT JOIN public.categories c ON c.id = p.categorie_id);
END $fin$;

ROLLBACK;
