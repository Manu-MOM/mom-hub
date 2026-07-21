-- pt 210 (chantier CREATION-CAS2-IMPORT-OVALE) : RPC de creation d'une fiche personne
-- pour un "cas 2" de l'import OVAL-E (licence de l'export SANS fiche Hub), cas par cas,
-- sur confirmation admin depuis import-oval-e.html.
--
-- CONTEXTE : import_qualites_ffr (sql_82) ne fait que METTRE A JOUR qualites_ffr des fiches
--   existantes ; les cas 2 sont signales, jamais crees (decision pt 81). Cette RPC ajoute la
--   creation, SANS toucher import_qualites_ffr (qui reste intacte).
--
-- DECISIONS (Manu, gelees pt 210) :
--   D1 fiche complete : mapping de tous les champs disponibles de l'export.
--   D2 cas par cas (un appel = une fiche ; le front met un bouton "Creer" par ligne).
--   D3 categorie_personne DEDUITE des qualites (assainissement pt 208-209) :
--        joueur (A/AM/RLSP/RLO) + staff (DC4/EDU/ECF/SOI/ACF) -> joueur_et_staff
--        joueur seul -> joueur ; staff seul -> staff ; sinon -> joueur (repli prudent).
--        NB : 'B' (joueur etranger) et 'AM' (joueur mute) NE sont PAS staff (cf. pt 208).
--   D4 type_personne DEDUIT : competition si qualite joueur ; sinon dominante staff.
--
-- GARANTIES :
--   - Garde admin stricte (has_role('admin')) ; SECURITY DEFINER ; REVOKE public/anon +
--     GRANT authenticated (ecriture sensible).
--   - IDEMPOTENTE : si numero_licence_ffr existe deja -> ne cree pas, renvoie 'existe_deja'
--     (le re-import la verra alors comme MATCHEE par import_qualites_ffr, plus comme cas 2).
--   - source_creation = 'import-oval-e' (tracabilite). Reste des colonnes = defauts table.
--   - Verifie en base (BEGIN/ROLLBACK) : AM->joueur/competition, AM+DC4->joueur_et_staff,
--     rejeu -> existe_deja.
begin;

create or replace function public.creer_personne_depuis_import(p_payload jsonb)
returns table(statut text, personne_id uuid, nom text, prenom text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lic      text := btrim(coalesce(p_payload->>'lic',''));
  v_nom      text := btrim(coalesce(p_payload->>'nom',''));
  v_prenom   text := btrim(coalesce(p_payload->>'prenom',''));
  v_codes    text[];
  v_cat      text;
  v_type     text;
  v_a_joueur boolean;
  v_a_staff  boolean;
  v_id       uuid;
begin
  -- Garde admin (module ecriture sensible : creation de fiche).
  if not public.has_role('admin') then
    raise exception 'Réservé à l''administration (admin).';
  end if;

  if v_lic = '' then
    raise exception 'Numéro de licence requis.';
  end if;
  if v_nom = '' or v_prenom = '' then
    raise exception 'Nom et prénom requis.';
  end if;

  -- IDEMPOTENCE : fiche deja presente pour cette licence -> ne pas creer.
  select id into v_id from public.personnes where numero_licence_ffr = v_lic limit 1;
  if v_id is not null then
    return query
      select 'existe_deja'::text, p.id, p.nom, p.prenom
      from public.personnes p where p.id = v_id;
    return;
  end if;

  -- Codes qualites (array dedup trie).
  select array_agg(distinct btrim(c) order by btrim(c))
    into v_codes
  from jsonb_array_elements_text(coalesce(p_payload->'codes','[]'::jsonb)) c
  where btrim(c) <> '';
  v_codes := coalesce(v_codes, array[]::text[]);

  -- Deduction categorie_personne + type_personne (socle aligne sur est_staff_ffr post-pt208).
  v_a_joueur := v_codes && array['A','AM','RLSP','RLO']::text[];
  v_a_staff  := v_codes && array['DC4','EDU','ECF','SOI','ACF']::text[];
  v_cat := case
             when v_a_joueur and v_a_staff then 'joueur_et_staff'
             when v_a_joueur then 'joueur'
             when v_a_staff then 'staff'
             else 'joueur'
           end;
  v_type := case
              when v_a_joueur then 'licencie_competition'
              when v_codes && array['EDU','ECF']::text[] then 'licencie_educateur'
              when v_codes && array['SOI']::text[] then 'licencie_soigneur'
              when v_a_staff then 'licencie_dirigeant'
              else 'licencie_competition'
            end;

  insert into public.personnes (
    nom, prenom, categorie_personne, type_personne, qualites_ffr,
    numero_licence_ffr, email_principal, telephone_principal,
    adresse_postale, code_postal, ville, date_naissance,
    nationalite_principale, date_fin_affiliation, source_creation
  ) values (
    v_nom, v_prenom, v_cat, v_type, v_codes,
    v_lic,
    nullif(btrim(coalesce(p_payload->>'email','')),''),
    nullif(btrim(coalesce(p_payload->>'tel','')),''),
    nullif(btrim(coalesce(p_payload->>'adresse','')),''),
    nullif(btrim(coalesce(p_payload->>'cp','')),''),
    nullif(btrim(coalesce(p_payload->>'ville','')),''),
    (nullif(btrim(coalesce(p_payload->>'date_naissance','')),''))::date,
    coalesce(nullif(btrim(coalesce(p_payload->>'nationalite','')),''),'France'),
    (nullif(btrim(coalesce(p_payload->>'date_fin_affiliation','')),''))::date,
    'import-oval-e'
  )
  returning id into v_id;

  return query select 'cree'::text, v_id, v_nom, v_prenom;
end;
$$;

comment on function public.creer_personne_depuis_import(jsonb) is
  'pt 210 : cree une fiche personne pour un cas 2 de l''import OVAL-E (garde admin, '
  'idempotent sur numero_licence_ffr, source_creation=import-oval-e). N''affecte pas '
  'import_qualites_ffr.';

-- ============================================================================
-- DROITS — ecriture sensible : REVOKE public/anon, GRANT authenticated (garde admin interne).
-- ============================================================================
revoke all on function public.creer_personne_depuis_import(jsonb) from public;
revoke all on function public.creer_personne_depuis_import(jsonb) from anon;
grant execute on function public.creer_personne_depuis_import(jsonb) to authenticated;

-- ============================================================================
-- VERIFICATION fail-loud
-- ============================================================================
do $verif$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname='creer_personne_depuis_import'
  ) then
    raise exception 'KO : creer_personne_depuis_import absente.';
  end if;
  raise notice 'CREATION-CAS2 OK : creer_personne_depuis_import en place (garde admin, idempotente).';
end;
$verif$;

commit;
