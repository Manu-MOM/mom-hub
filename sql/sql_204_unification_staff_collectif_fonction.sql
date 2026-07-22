-- pt 213 (chantier UNIFICATION-STAFF-COLLECTIF-FONCTION) : unifier les deux sources
-- desynchronisees du "staff convocable d'une categorie" dans le module compositions
-- (groupe de base, modele 3-niveaux N1 collectif_membre / N2 equipe_engagee_membre).
--
-- PROBLEME : "qui est staff convocable ?" avait 2 sources divergentes —
--   (1) fonction_staff (encadrants, fiabilisee pt 209-212) ;
--   (2) collectif_membre role='staff' (saisie manuelle u-admin, activee recemment,
--       quasi-vide : seules 24 lignes historiques dont Vivien bascule au pt 208).
--   Symptomes : Vivien seul en staff du groupe de base M16 (seule ligne peuplee) ;
--   asymetrie inverse en M14. Reveles (non causes) par la fiabilisation de la session.
--
-- DOCTRINE CIBLE (Manu) : staff convocable = encadrants fonction_staff de la categorie
--   (cas 1, automatique, majoritaire) UNION collectif_membre role='staff' saisis a la main
--   (cas 2, occasionnel : staff hors encadrement declare). FUSION, pas remplacement —
--   u-admin garde son role pour le cas 2.
--
-- CONTRAINTE STRUCTURANTE : la convocation N2 (equipe_engagee_membre) reference un
--   collectif_membre_id. Un encadrant venu de fonction_staff n'a pas forcement de ligne N1.
--   => MATERIALISATION : a la convocation d'un tel encadrant, creer d'abord sa ligne
--   collectif_membre role='staff' (idempotente), puis l'attacher en N2.
--
-- DECISIONS (Manu, gelees) :
--   D1 fusion du vivier via RPC list_vivier_collectif (UNION SQL propre + dedup personne_id).
--   D2 materialisation atomique via RPC convoquer_membre (cree N1 si besoin + insere N2).
--   D3 dedup par personne_id ; la ligne collectif_membre existante prime (statut/dates).
--   D4 perimetre = groupe de base (groupe-base.js) ; u-admin en coherence plus tard si besoin.
--
-- Contraintes collectif_membre (sondees) : role in (joueur,staff) ; statut in
--   (regulier,renfort_temporaire,en_transition)|NULL ; date_fin>=date_debut.
--   Materialisation : role='staff', statut='regulier', date_debut=today, date_fin NULL.
--
-- Verifie en base : vivier M16 fusionne = 5 coachs (Vivien origine=collectif, 4 autres
-- origine=fonction_staff a materialiser) ; convocation T1 materialise=true, rejeu=false
-- (idempotence N1 + N2), rollback CM_count=0.
begin;

-- ============================================================================
-- VOLET 1 — list_vivier_collectif : fusion collectif_membre + fonction_staff (dedup)
-- ============================================================================
create or replace function public.list_vivier_collectif(p_entente_id uuid)
returns table(id uuid, personne_id uuid, entente_id uuid, role text, statut text,
              date_debut date, date_fin date, origine text, fonction text)
language sql stable security definer set search_path to 'public'
as $function$
  WITH ent AS ( SELECT en.id, en.categorie_id FROM ententes en WHERE en.id = p_entente_id )
  -- (1) Collectif existant (joueurs + staff), source N1 telle quelle.
  SELECT cm.id, cm.personne_id, cm.entente_id, cm.role, cm.statut,
         cm.date_debut, cm.date_fin, 'collectif'::text AS origine, NULL::text AS fonction
  FROM collectif_membre cm
  WHERE cm.entente_id = p_entente_id
  UNION ALL
  -- (2) Encadrants fonction_staff de la categorie, absents du collectif staff actif.
  --     id NULL = a materialiser a la convocation ; origine='fonction_staff'.
  SELECT NULL::uuid AS id, fs.personne_id, p_entente_id AS entente_id,
         'staff'::text AS role, 'regulier'::text AS statut,
         fs.date_debut, NULL::date AS date_fin, 'fonction_staff'::text AS origine, fs.fonction
  FROM fonction_staff fs
  JOIN ent ON ent.categorie_id = fs.categorie_id
  WHERE fs.date_fin IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM collectif_membre cm2
      WHERE cm2.personne_id = fs.personne_id
        AND cm2.entente_id = p_entente_id
        AND cm2.role = 'staff'
        AND cm2.date_fin IS NULL
    )
  ORDER BY role, date_debut;
$function$;
grant execute on function public.list_vivier_collectif(uuid) to authenticated;
grant execute on function public.list_vivier_collectif(uuid) to service_role;

-- ============================================================================
-- VOLET 2 — convoquer_membre : materialisation atomique + insertion N2 (idempotent)
-- ============================================================================
create or replace function public.convoquer_membre(
  p_evenement_equipe_id uuid, p_collectif_membre_id uuid, p_personne_id uuid,
  p_entente_id uuid, p_role text default 'staff')
returns table(equipe_engagee_membre_id uuid, collectif_membre_id uuid, materialise boolean)
language plpgsql security definer set search_path = public
as $$
declare v_cm_id uuid := p_collectif_membre_id; v_materialise boolean := false; v_eem_id uuid;
begin
  if not (public.has_role('admin') or public.has_role('bureau') or public.has_role('encadrant')) then
    raise exception 'Réservé au staff (admin/bureau/encadrant).';
  end if;
  if p_evenement_equipe_id is null then raise exception 'evenement_equipe_id requis.'; end if;
  -- Materialisation si pas de collectif_membre_id (membre venu de fonction_staff).
  if v_cm_id is null then
    if p_personne_id is null or p_entente_id is null then
      raise exception 'personne_id + entente_id requis pour matérialiser.'; end if;
    select cm.id into v_cm_id from collectif_membre cm
    where cm.personne_id = p_personne_id and cm.entente_id = p_entente_id
      and cm.role = p_role and cm.date_fin is null limit 1;
    if v_cm_id is null then
      insert into collectif_membre (personne_id, entente_id, role, statut, date_debut)
      values (p_personne_id, p_entente_id, coalesce(p_role,'staff'), 'regulier', current_date)
      returning id into v_cm_id;
      v_materialise := true;
    end if;
  end if;
  -- Insertion N2 (idempotence : pas de doublon evenement_equipe x collectif_membre).
  select eem.id into v_eem_id from equipe_engagee_membre eem
  where eem.evenement_equipe_id = p_evenement_equipe_id and eem.collectif_membre_id = v_cm_id limit 1;
  if v_eem_id is null then
    insert into equipe_engagee_membre (evenement_equipe_id, collectif_membre_id)
    values (p_evenement_equipe_id, v_cm_id) returning id into v_eem_id;
  end if;
  return query select v_eem_id, v_cm_id, v_materialise;
end; $$;
revoke all on function public.convoquer_membre(uuid,uuid,uuid,uuid,text) from public;
revoke all on function public.convoquer_membre(uuid,uuid,uuid,uuid,text) from anon;
grant execute on function public.convoquer_membre(uuid,uuid,uuid,uuid,text) to authenticated;

do $verif$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='list_vivier_collectif') then
    raise exception 'KO : list_vivier_collectif absente.'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='convoquer_membre') then
    raise exception 'KO : convoquer_membre absente.'; end if;
  raise notice 'UNIFICATION-STAFF-COLLECTIF OK : list_vivier_collectif (fusion) + convoquer_membre (materialisation).';
end;
$verif$;

commit;
