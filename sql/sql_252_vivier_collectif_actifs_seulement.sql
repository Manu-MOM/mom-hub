-- =====================================================================
-- sql_252_vivier_collectif_actifs_seulement.sql
-- ---------------------------------------------------------------------
-- Chantier : VIVIER-ACTIFS — groupe de base (groupe-base.html)
--
-- Besoin (Manu, 28/09/2026) : lors de la constitution du groupe de base,
--   n'afficher que les membres « actifs » du collectif.
-- Decision Manu : actif = NON ARCHIVE (option recommandee).
--   -> masques : personnes.est_archive = true
--               + lignes collectif_membre sorties (date_fin < CURRENT_DATE)
--   -> restent visibles : blesses, suspendus, indisponibles, « a renouveler ».
--
-- Perimetre : RPC list_vivier_collectif(uuid) uniquement.
--   Seul appelant (grep repo 28/09) : js/groupe-base.js -> SupabaseHub.listVivierCollectif.
--   Signature et RETURNS TABLE inchanges -> CREATE OR REPLACE sans overload
--   (pas de PGRST203). Aucun changement front.
--   Les membres deja convoques (N2, listGroupeEngage) ne sont PAS touches.
--
-- Base : definition deployee lue en base le 28/09/2026 (issue de sql_204).
-- Idempotent.
-- =====================================================================

create or replace function public.list_vivier_collectif(p_entente_id uuid)
 returns table(id uuid, personne_id uuid, entente_id uuid, role text, statut text,
               date_debut date, date_fin date, origine text, fonction text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  WITH ent AS ( SELECT en.id, en.categorie_id FROM ententes en WHERE en.id = p_entente_id )
  SELECT cm.id, cm.personne_id, cm.entente_id, cm.role, cm.statut,
         cm.date_debut, cm.date_fin, 'collectif'::text AS origine, NULL::text AS fonction
  FROM collectif_membre cm
  JOIN personnes p ON p.id = cm.personne_id
  WHERE cm.entente_id = p_entente_id
    AND NOT p.est_archive
    AND (cm.date_fin IS NULL OR cm.date_fin >= CURRENT_DATE)
  UNION ALL
  SELECT NULL::uuid AS id, fs.personne_id, p_entente_id AS entente_id,
         'staff'::text AS role, 'regulier'::text AS statut,
         fs.date_debut, NULL::date AS date_fin, 'fonction_staff'::text AS origine, fs.fonction
  FROM fonction_staff fs
  JOIN ent ON ent.categorie_id = fs.categorie_id
  JOIN personnes p ON p.id = fs.personne_id
  WHERE fs.date_fin IS NULL
    AND NOT p.est_archive
    AND NOT EXISTS (
      SELECT 1 FROM collectif_membre cm2
      WHERE cm2.personne_id = fs.personne_id
        AND cm2.entente_id = p_entente_id
        AND cm2.role = 'staff'
        AND cm2.date_fin IS NULL
    )
  ORDER BY role, date_debut;
$function$;

-- Droits : CREATE OR REPLACE conserve les GRANT/REVOKE existants (sql_204 / sql_206).

-- Verification (fail-loud) : aucun archive dans le vivier M16 2026/2027
do $verif$
declare v_arch int;
begin
  select count(*) into v_arch
  from public.list_vivier_collectif('f780f772-e08f-40c3-ad15-d1c67a3b990e') v
  join public.personnes p on p.id = v.personne_id
  where p.est_archive;
  if v_arch <> 0 then
    raise exception 'KO : % archive(s) encore dans le vivier M16.', v_arch;
  end if;
  raise notice 'VIVIER-ACTIFS OK : 0 archive dans le vivier M16.';
end
$verif$;
