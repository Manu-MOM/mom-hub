-- =====================================================================
-- sql_103_rattachement_edr_lohann.sql
-- ---------------------------------------------------------------------
-- Chantier : Rôles responsable de pôle (pt 94 conception, production).
-- Objet    : ALLUMAGE — rattacher Lohann HUMBERT comme responsable
--            principal du pôle EDR. Geste de DONNÉE (D-A), pas de code.
--
-- Effet : à partir de ce rattachement, les deux branches déployées
--   (sql_101 visibilité + sql_102 écriture) deviennent ACTIVES pour
--   Lohann sur les catégories du pôle EDR (M5, M6, M8, M10, M12, M14
--   — pont categories.pole_id, DP-7).
--
-- Faits source (DS-1, sondes prod) :
--   - poles.responsable_principal_id -> personnes(id) ON DELETE SET NULL
--     (sonde 1).
--   - 589e7977-748c-42db-b29c-0505ec0d2e41 EST un personnes.id valide,
--     = HUMBERT Lohann, categorie_personne joueur_et_staff
--     (micro-sonde de vérif avant écriture). PAS une valeur supposée.
--   - poles.code='EDR' existe, responsable_principal_id = null
--     au moment de l'écriture (sonde 5a).
--
-- Garde-fous :
--   - WHERE code='EDR' ciblé.
--   - Refus d'écrasement : on n'écrit QUE si le responsable actuel est
--     null (si une autre conv l'a posé entre-temps, on ne le remplace
--     pas en silence -> fail-loud).
--   - Vérif post-update : exactement 1 ligne EDR porte bien Lohann.
--
-- Hors périmètre : les 4 autres pôles (JEUNES, JEUNES_F, LOISIRS,
--   SENIORS) restent sans responsable (null = état valide, FAITFOI §4).
--   Leur rattachement éventuel se fera par un geste donnée distinct,
--   sur le même modèle que ce fichier.
-- =====================================================================

do $rattachement$
declare
  v_pole_id            uuid;
  v_responsable_actuel uuid;
  v_lohann             uuid := '589e7977-748c-42db-b29c-0505ec0d2e41';
  v_check_personne     int;
begin
  -- 1. La fiche Lohann doit exister dans personnes (FK cible).
  select count(*) into v_check_personne
  from public.personnes
  where id = v_lohann;

  if v_check_personne <> 1 then
    raise exception
      'sql_103 FAIL : personnes.id % introuvable (% ligne(s)) — rattachement impossible',
      v_lohann, v_check_personne;
  end if;

  -- 2. Le pôle EDR doit exister ; on capture son responsable actuel.
  select id, responsable_principal_id
    into v_pole_id, v_responsable_actuel
  from public.poles
  where code = 'EDR';

  if v_pole_id is null then
    raise exception 'sql_103 FAIL : pole EDR introuvable';
  end if;

  -- 3. Refus d'écrasement : on n'écrit que si la place est libre.
  if v_responsable_actuel is not null then
    if v_responsable_actuel = v_lohann then
      raise notice 'sql_103 NO-OP : EDR a deja Lohann comme responsable principal. Rien a faire.';
      return;
    else
      raise exception
        'sql_103 FAIL : EDR a deja un responsable principal (%) different de Lohann — refus d''ecrasement silencieux',
        v_responsable_actuel;
    end if;
  end if;

  -- 4. Rattachement (la place est libre).
  update public.poles
  set responsable_principal_id = v_lohann,
      updated_at = now()
  where code = 'EDR';

  -- 5. Vérif post-update : exactement 1 ligne EDR porte bien Lohann.
  if not exists (
    select 1 from public.poles
    where code = 'EDR' and responsable_principal_id = v_lohann
  ) then
    raise exception 'sql_103 FAIL : rattachement non confirme apres UPDATE';
  end if;

  raise notice 'sql_103 OK : EDR <- Lohann HUMBERT (% ). Branches sql_101/sql_102 actives sur le perimetre EDR.',
    v_lohann;
end;
$rattachement$;
