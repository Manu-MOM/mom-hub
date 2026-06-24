-- =====================================================================
-- sql_108_seances_blocs_voies_encadrant.sql
-- ---------------------------------------------------------------------
-- TRAME DE SÉANCE — BLOCS PARALLÈLES (voies) + COACH PAR BLOC
--
-- OBJET : doter seances_blocs de deux capacités attendues « terrain » :
--   (1) blocs simultanés sur un même étage chronologique (ex. « séparé » :
--       3/4 sur lancements de jeu / avants sur touche). Modélisé par une
--       colonne `voie` : plusieurs blocs au même `ordre` mais en voies
--       distinctes = parallèles. Voie 0 = pleine largeur (séquentiel
--       classique, valeur par défaut → TOUT l'existant reste valide).
--   (2) un encadrant nommé par bloc : colonne `encadrant_id` (FK personnes),
--       NULL autorisé (un bloc sans coach désigné reste légal).
--
-- STRATÉGIE : PURE EXTENSION ADDITIVE côté données.
--   - 2 colonnes ajoutées, toutes deux avec valeur sûre pour l'existant
--     (voie DEFAULT 0 NOT NULL ; encadrant_id NULL).
--   - SEULE modification de structure existante : la contrainte d'unicité
--     `seances_blocs_seance_ordre_uniq` (seance_id, ordre) est REMPLACÉE
--     par (seance_id, ordre, voie). Sans cela, deux blocs simultanés au
--     même `ordre` seraient rejetés. L'existant (toutes lignes en voie 0)
--     reste couvert : (seance_id, ordre, 0) est unique tant qu'aucun
--     parallèle n'est créé.
--
-- PORTÉE (cartographiée à la source — sondes information_schema 24/06) :
--   - ADD COLUMN seances_blocs.voie          smallint NOT NULL DEFAULT 0
--   - ADD COLUMN seances_blocs.encadrant_id  uuid NULL REFERENCES personnes(id)
--   - DROP  UNIQUE seances_blocs_seance_ordre_uniq (seance_id, ordre)
--   - ADD   UNIQUE seances_blocs_seance_ordre_voie_uniq (seance_id, ordre, voie)
--
-- HORS PORTÉE (non touché) : groupes_jsonb (répartition joueurs intra-bloc,
--   concept distinct du parallélisme — vérifié à la source seance-editor.js
--   renderGroupesSection) ; encadrants_text au niveau seances (affichage
--   global, conservé) ; reorderBlocs (adapté côté wrapper JS, pas ici).
--
-- FK encadrant_id : ON DELETE SET NULL — si une fiche personne disparaît,
--   le bloc survit sans coach désigné (honest degradation, pas de cascade
--   destructrice sur la trame).
--
-- RÉVERSIBILITÉ : additive ; un resserrage éventuel (retour à l'unique
--   2-colonnes) n'est possible que si aucun parallèle n'existe en base.
--
-- IDEMPOTENT — fail-loud (bloc DO $verif$ finale avant COMMIT).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. COLONNE voie — étage chronologique partagé entre blocs simultanés.
--    smallint suffit largement (0..N voies, N non borné côté SQL).
--    DEFAULT 0 NOT NULL : l'existant bascule en « pleine largeur ».
-- ---------------------------------------------------------------------
alter table public.seances_blocs
  add column if not exists voie smallint not null default 0;

-- ---------------------------------------------------------------------
-- 2. COLONNE encadrant_id — coach désigné du bloc. NULL autorisé.
--    FK -> personnes(id), ON DELETE SET NULL (le bloc survit).
-- ---------------------------------------------------------------------
alter table public.seances_blocs
  add column if not exists encadrant_id uuid null;

-- FK posée séparément + idempotente (ADD CONSTRAINT n'a pas de IF NOT
-- EXISTS en Postgres : on DROP d'abord par sécurité, puis on (re)crée).
alter table public.seances_blocs
  drop constraint if exists seances_blocs_encadrant_id_fkey;

alter table public.seances_blocs
  add constraint seances_blocs_encadrant_id_fkey
  foreign key (encadrant_id)
  references public.personnes (id)
  on delete set null;

-- ---------------------------------------------------------------------
-- 3. UNICITÉ — remplacement (seance_id, ordre) -> (seance_id, ordre, voie).
--    L'ancienne contrainte interdisait deux blocs au même ordre ; la
--    nouvelle ne les interdit que s'ils partagent AUSSI la même voie.
-- ---------------------------------------------------------------------
alter table public.seances_blocs
  drop constraint if exists seances_blocs_seance_ordre_uniq;

alter table public.seances_blocs
  drop constraint if exists seances_blocs_seance_ordre_voie_uniq;

alter table public.seances_blocs
  add constraint seances_blocs_seance_ordre_voie_uniq
  unique (seance_id, ordre, voie);

-- ---------------------------------------------------------------------
-- 4. FAIL-LOUD — les 3 objets attendus sont-ils en place et corrects ?
--    Lève si : une colonne manque, la FK encadrant_id est absente ou ne
--    pointe pas vers personnes, l'ancienne unique subsiste, ou la
--    nouvelle unique manque / n'inclut pas `voie`.
-- ---------------------------------------------------------------------
do $verif$
declare
  v_col_voie        text;
  v_col_voie_def    text;
  v_col_voie_null   text;
  v_col_encadrant   text;
  v_fk_def          text;
  v_old_uniq        text;
  v_new_uniq        text;
begin
  -- 4.1 Colonne voie : présence, type, NOT NULL, DEFAULT 0
  -- (sous-requêtes scalaires affectées par := — forme non ambiguë, motif sql_94)
  v_col_voie := (
    select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'seances_blocs' and column_name = 'voie'
  );
  v_col_voie_def := (
    select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'seances_blocs' and column_name = 'voie'
  );
  v_col_voie_null := (
    select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'seances_blocs' and column_name = 'voie'
  );

  if v_col_voie is null then
    raise exception 'FAIL-LOUD: colonne seances_blocs.voie absente.';
  end if;
  if v_col_voie <> 'smallint' then
    raise exception 'FAIL-LOUD: seances_blocs.voie type inattendu (% au lieu de smallint).', v_col_voie;
  end if;
  if v_col_voie_null <> 'NO' then
    raise exception 'FAIL-LOUD: seances_blocs.voie devrait être NOT NULL (is_nullable=%).', v_col_voie_null;
  end if;
  if v_col_voie_def is null or v_col_voie_def not like '0%' then
    raise exception 'FAIL-LOUD: seances_blocs.voie DEFAULT inattendu (def=%).', v_col_voie_def;
  end if;

  -- 4.2 Colonne encadrant_id : présence
  v_col_encadrant := (
    select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'seances_blocs' and column_name = 'encadrant_id'
  );

  if v_col_encadrant is null then
    raise exception 'FAIL-LOUD: colonne seances_blocs.encadrant_id absente.';
  end if;
  if v_col_encadrant <> 'uuid' then
    raise exception 'FAIL-LOUD: seances_blocs.encadrant_id type inattendu (% au lieu de uuid).', v_col_encadrant;
  end if;

  -- 4.3 FK encadrant_id -> personnes
  v_fk_def := (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    where c.relname = 'seances_blocs'
      and con.conname = 'seances_blocs_encadrant_id_fkey'
  );
  if v_fk_def is null then
    raise exception 'FAIL-LOUD: FK seances_blocs_encadrant_id_fkey absente.';
  end if;
  if v_fk_def not ilike '%personnes%' then
    raise exception 'FAIL-LOUD: FK encadrant_id ne référence pas personnes (def=%).', v_fk_def;
  end if;

  -- 4.4 L'ancienne unique (seance_id, ordre) ne doit plus exister
  v_old_uniq := (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    where c.relname = 'seances_blocs'
      and con.conname = 'seances_blocs_seance_ordre_uniq'
  );
  if v_old_uniq is not null then
    raise exception 'FAIL-LOUD: ancienne contrainte seances_blocs_seance_ordre_uniq subsiste (def=%).', v_old_uniq;
  end if;

  -- 4.5 La nouvelle unique doit exister ET inclure voie
  v_new_uniq := (
    select pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    where c.relname = 'seances_blocs'
      and con.conname = 'seances_blocs_seance_ordre_voie_uniq'
  );
  if v_new_uniq is null then
    raise exception 'FAIL-LOUD: nouvelle contrainte seances_blocs_seance_ordre_voie_uniq absente.';
  end if;
  if v_new_uniq not ilike '%voie%' then
    raise exception 'FAIL-LOUD: nouvelle unique n''inclut pas voie (def=%).', v_new_uniq;
  end if;

  raise notice 'OK sql_108 : voie + encadrant_id en place, FK->personnes OK, unicité élargie (seance_id, ordre, voie).';
end;
$verif$;

commit;
