-- =====================================================================
-- sql_104_casquettes_lohann.sql
-- ---------------------------------------------------------------------
-- Contexte : session de CONFIGURATION de Lohann HUMBERT, en marge de la
--   conv « Production · Rôles responsable de pôle » (écart de sujet
--   assumé et tracé — préalable à la recette terrain).
-- Objet    : poser les casquettes RÉELLES de Lohann avant sa bascule
--            admin -> encadrant (sql_105).
--
-- Config cible (Manu, 24/06) :
--   1. Responsable pôle EDR    -> DÉJÀ POSÉ (sql_103). Non retouché ici.
--   2. Responsable pôle SENIORS-> posé ici (lui donne SR-M + SR-F).
--   3. Référent SR-M           -> posé ici (fonction_staff). Doublon
--      ASSUMÉ avec le pôle SENIORS sur SR-M (le moteur prend le plus
--      permissif, aucune casse). Trace explicite.
--
-- Faits source (DS-1, sondes 24/06) :
--   - poles code SENIORS : responsable_principal_id ET co_responsable_id
--     = null (places libres).
--   - libellé fonction référent réel = 'Référent de catégorie'
--     (_b5_norm -> 'referent de categorie'), lu à la source. PAS inventé.
--   - SR-M categorie_id = 09b0829a-27a8-4ba2-a0f4-6f814f191a29.
--   - fonction_staff : colonnes obligatoires personne_id, categorie_id,
--     fonction ; date_debut défaut CURRENT_DATE, date_fin null = active.
--   - Lohann personnes.id = 589e7977-748c-42db-b29c-0505ec0d2e41
--     (vérifié = HUMBERT Lohann).
--
-- Garde-fous : refus d'écrasement du responsable SENIORS ; anti-doublon
--   d'INSERT fonction_staff (ne crée pas une 2e ligne référent SR-M
--   active si elle existe déjà) ; vérifs post-écriture fail-loud.
-- =====================================================================

do $config$
declare
  v_lohann   uuid := '589e7977-748c-42db-b29c-0505ec0d2e41';
  v_srm      uuid := '09b0829a-27a8-4ba2-a0f4-6f814f191a29';
  v_pole_id  uuid;
  v_resp     uuid;
  v_check    int;
begin
  -- 0. Garde : la fiche Lohann et la catégorie SR-M doivent exister.
  if not exists (select 1 from public.personnes where id = v_lohann) then
    raise exception 'sql_104 FAIL : personnes.id Lohann % introuvable', v_lohann;
  end if;
  if not exists (select 1 from public.categories where id = v_srm) then
    raise exception 'sql_104 FAIL : categorie SR-M % introuvable', v_srm;
  end if;

  -- =================================================================
  -- 1. Responsable pôle SENIORS (refus d'écrasement silencieux).
  -- =================================================================
  select id, responsable_principal_id into v_pole_id, v_resp
  from public.poles where code = 'SENIORS';

  if v_pole_id is null then
    raise exception 'sql_104 FAIL : pole SENIORS introuvable';
  end if;

  if v_resp is not null then
    if v_resp = v_lohann then
      raise notice 'sql_104 : SENIORS a deja Lohann comme responsable principal (no-op).';
    else
      raise exception
        'sql_104 FAIL : SENIORS a deja un responsable (%) different de Lohann — refus ecrasement', v_resp;
    end if;
  else
    update public.poles
    set responsable_principal_id = v_lohann,
        updated_at = now()
    where code = 'SENIORS';
    raise notice 'sql_104 : SENIORS <- Lohann (responsable principal).';
  end if;

  -- =================================================================
  -- 2. Référent SR-M (fonction_staff) — anti-doublon d'INSERT.
  --    Doublon FONCTIONNEL avec le pole SENIORS sur SR-M = assume.
  --    Anti-doublon ici = ne pas creer 2 lignes fonction_staff
  --    identiques actives.
  -- =================================================================
  select count(*) into v_check
  from public.fonction_staff
  where personne_id = v_lohann
    and categorie_id = v_srm
    and public._b5_norm(fonction) like 'referent%'
    and date_fin is null;

  if v_check > 0 then
    raise notice 'sql_104 : Lohann a deja une fonction referent active sur SR-M (no-op INSERT).';
  else
    insert into public.fonction_staff (personne_id, categorie_id, fonction, cree_par)
    values (v_lohann, v_srm, 'Référent de catégorie', v_lohann);
    raise notice 'sql_104 : fonction_staff Referent de categorie posee sur SR-M pour Lohann.';
  end if;

  -- =================================================================
  -- 3. Vérifs post-écriture fail-loud.
  -- =================================================================
  if not exists (
    select 1 from public.poles
    where code = 'SENIORS' and responsable_principal_id = v_lohann
  ) then
    raise exception 'sql_104 FAIL : responsable SENIORS non confirme apres ecriture';
  end if;

  if not exists (
    select 1 from public.fonction_staff
    where personne_id = v_lohann and categorie_id = v_srm
      and public._b5_norm(fonction) like 'referent%' and date_fin is null
  ) then
    raise exception 'sql_104 FAIL : fonction referent SR-M non confirmee apres ecriture';
  end if;

  raise notice 'sql_104 OK : Lohann responsable EDR (sql_103) + SENIORS + referent SR-M. Perimetre cible : M5/M6/M8/M10/M12/M14 + SR-M/SR-F.';
end;
$config$;
