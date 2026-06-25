-- =====================================================================
-- sql_110_seances_blocs_encadrants_multi.sql
-- ---------------------------------------------------------------------
-- COACH PAR BLOC → MULTI-COACHS (liste plate égalitaire)
--
-- OBJET : un bloc pouvait avoir UN coach (seances_blocs.encadrant_id,
--   sql_108). Retour terrain : il faut pouvoir en désigner PLUSIEURS
--   (ex. « touche des avants » encadrée par 2 coachs). Modélisation
--   retenue (décision Manu) : liste PLATE, tous égaux, rangée dans le
--   bloc via une colonne tableau d'UUID — PAS de table de liaison
--   (simplicité d'usage avant tout).
--
-- TYPE : uuid[] (udt _uuid), cohérent avec le pattern maison existant
--   pour les listes de coachs / d'entités :
--     - equipes.coachs_adjoints_ids  uuid[]   (précédent direct)
--     - ententes.clubs_partenaires_ids uuid[]
--     - equipes.sites_utilises        uuid[]
--   (jsonb écarté : uuid[] est typé, indexable, homogène au modèle.)
--
-- STRATÉGIE : ADDITIVE.
--   - ADD COLUMN encadrants_ids uuid[] NOT NULL DEFAULT '{}'.
--   - MIGRATION : pour chaque bloc ayant déjà un encadrant_id (sql_108),
--     on initialise encadrants_ids = ARRAY[encadrant_id]. Aucun coach
--     existant n'est perdu (à ce jour : 1 bloc concerné, coach Vivien).
--   - encadrant_id : CONSERVÉ, marqué DÉPRÉCIÉ (commentaire COMMENT).
--     On ne le retire pas (additif, zéro risque pour le code en place) ;
--     il cesse simplement d'être la source de vérité côté front (v1.13),
--     qui lira/écrira encadrants_ids. Un nettoyage éventuel de la colonne
--     sera un chantier séparé, une fois le front 100 % bascule validé.
--
-- INTÉGRITÉ : un uuid[] ne peut pas porter de contrainte FK par élément
--   (limite Postgres). L'intégrité « les UUID sont de vraies personnes »
--   repose donc sur la validation APPLICATIVE : la pioche front n'offre
--   que des personne_id issus de list_staff_disponibles (sql_109). On
--   documente honnêtement cette limite ; pas de fausse garantie SQL.
--   Un index GIN est posé pour permettre des recherches « blocs d'un
--   coach » efficaces (futures stats d'encadrement).
--
-- IDEMPOTENT — fail-loud (bloc DO $verif$ finale avant COMMIT).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. COLONNE encadrants_ids — liste plate des coachs du bloc.
--    NOT NULL DEFAULT '{}' : l'existant bascule en liste vide (sera
--    rempli juste après par la migration pour les blocs qui avaient
--    déjà un encadrant_id).
-- ---------------------------------------------------------------------
alter table public.seances_blocs
  add column if not exists encadrants_ids uuid[] not null default '{}'::uuid[];

-- ---------------------------------------------------------------------
-- 2. MIGRATION — recopie du coach unique existant vers la liste.
--    Ne touche que les blocs ayant un encadrant_id ET dont la liste
--    est encore vide (idempotent : rejouable sans dupliquer).
-- ---------------------------------------------------------------------
update public.seances_blocs
   set encadrants_ids = array[encadrant_id]
 where encadrant_id is not null
   and (encadrants_ids is null or cardinality(encadrants_ids) = 0);

-- ---------------------------------------------------------------------
-- 3. INDEX GIN — recherche efficace « quels blocs encadre la personne X »
--    (futures stats d'encadrement). Idempotent.
-- ---------------------------------------------------------------------
create index if not exists idx_seances_blocs_encadrants_ids
  on public.seances_blocs using gin (encadrants_ids);

-- ---------------------------------------------------------------------
-- 4. DÉPRÉCIATION douce de encadrant_id (commentaire, pas de DROP).
-- ---------------------------------------------------------------------
comment on column public.seances_blocs.encadrant_id is
  'DÉPRÉCIÉ (sql_110) — coach unique historique (sql_108). Source de vérité '
  'désormais : encadrants_ids (liste plate). Conservé pour rétro-compat ; '
  'nettoyage éventuel = chantier séparé après bascule front complète.';

comment on column public.seances_blocs.encadrants_ids is
  'Liste plate (égalitaire) des coachs encadrant le bloc (sql_110). '
  'uuid[] -> personnes(id). Intégrité par validation applicative '
  '(pioche = list_staff_disponibles). Migré depuis encadrant_id.';

-- ---------------------------------------------------------------------
-- 5. FAIL-LOUD — colonne présente, typée uuid[], index posé, migration
--    cohérente (aucun bloc avec encadrant_id non NULL ne doit rester
--    avec une liste vide).
-- ---------------------------------------------------------------------
do $verif$
declare
  v_col_type   text;
  v_col_udt    text;
  v_idx        text;
  v_orphelins  integer;
begin
  -- 5.1 colonne présente + type uuid[]
  v_col_type := (
    select data_type from information_schema.columns
    where table_schema='public' and table_name='seances_blocs'
      and column_name='encadrants_ids'
  );
  v_col_udt := (
    select udt_name from information_schema.columns
    where table_schema='public' and table_name='seances_blocs'
      and column_name='encadrants_ids'
  );
  if v_col_type is null then
    raise exception 'FAIL-LOUD: colonne seances_blocs.encadrants_ids absente.';
  end if;
  if v_col_udt <> '_uuid' then
    raise exception 'FAIL-LOUD: encadrants_ids type inattendu (udt=% au lieu de _uuid).', v_col_udt;
  end if;

  -- 5.2 index GIN présent
  v_idx := (
    select indexname from pg_indexes
    where schemaname='public' and tablename='seances_blocs'
      and indexname='idx_seances_blocs_encadrants_ids'
  );
  if v_idx is null then
    raise exception 'FAIL-LOUD: index idx_seances_blocs_encadrants_ids absent.';
  end if;

  -- 5.3 migration : aucun bloc avec encadrant_id non NULL ne doit avoir
  --     une liste vide (sinon un coach a été perdu).
  v_orphelins := (
    select count(*)::int from public.seances_blocs
    where encadrant_id is not null
      and (encadrants_ids is null or cardinality(encadrants_ids) = 0)
  );
  if v_orphelins > 0 then
    raise exception 'FAIL-LOUD: % bloc(s) avec encadrant_id non migré vers encadrants_ids.', v_orphelins;
  end if;

  raise notice 'OK sql_110 : encadrants_ids (uuid[]) en place, index GIN posé, migration encadrant_id OK (0 orphelin).';
end;
$verif$;

commit;
