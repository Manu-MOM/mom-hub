-- =====================================================================
-- sql_95_porte_encadrant_migration_donnees.sql
-- ---------------------------------------------------------------------
-- RENOMMAGE DE LA PORTE  referent -> encadrant  (voie 2)  /  ÉTAPE 2/7
-- Stratégie (b) « double-acceptation transitoire ».
--
-- PRÉ-REQUIS : sql_94 (étape 1) exécuté — les CHECK acceptent déjà
--   'encadrant'. Sans ça, l'UPDATE ci-dessous violerait la contrainte.
--
-- OBJET : basculer les LIGNES de rôle existantes 'referent' -> 'encadrant'
--   dans auth_roles ET roles_en_attente. Les porteurs conservent
--   EXACTEMENT le même accès (les gardes has_role('referent') sont
--   encore en place — étape 3 — donc pendant la fenêtre, l'accès passe
--   par... voir NOTE ci-dessous).
--
-- ⚠️ NOTE D'ORDONNANCEMENT (importante) : à l'issue de CE fichier, les
--   lignes valent 'encadrant' MAIS les gardes des fonctions testent
--   encore has_role('referent') (étape 3 non faite). Un encadrant
--   migré perd donc TEMPORAIREMENT son accès en écriture jusqu'à
--   l'étape 3. La fenêtre entre étape 2 et étape 3 doit être COURTE
--   (enchaîner les fichiers sql_96..99 dans la foulée). C'est la
--   contrepartie assumée de migrer les données avant de basculer les
--   gardes ; l'inverse (gardes d'abord) couperait l'accès aux lignes
--   'referent' encore non migrées — symétrique. La double-acceptation
--   ne protège que l'ÉCRITURE de rôle (attribution), pas la lecture
--   de la garde. On enchaîne donc 2->3 sans laisser dormir l'état.
--
-- IDEMPOTENT : ré-exécutable sans effet (where role='referent' ne
--   matche plus rien au 2e passage). Comptage avant/après. Fail-loud.
-- =====================================================================

begin;

do $migr$
declare
  v_auth_referent_avant    int;
  v_auth_encadrant_avant   int;
  v_att_referent_avant     int;
  v_att_encadrant_avant    int;

  v_auth_migrees           int;
  v_att_migrees            int;

  v_auth_referent_apres    int;
  v_auth_encadrant_apres   int;
  v_att_referent_apres     int;
  v_att_encadrant_apres    int;
begin
  -- ----- Cadrage AVANT -----
  v_auth_referent_avant  := (select count(*) from public.auth_roles       where role = 'referent');
  v_auth_encadrant_avant := (select count(*) from public.auth_roles       where role = 'encadrant');
  v_att_referent_avant   := (select count(*) from public.roles_en_attente where role = 'referent');
  v_att_encadrant_avant  := (select count(*) from public.roles_en_attente where role = 'encadrant');

  raise notice 'AVANT  | auth_roles: referent=%, encadrant=% | roles_en_attente: referent=%, encadrant=%',
    v_auth_referent_avant, v_auth_encadrant_avant, v_att_referent_avant, v_att_encadrant_avant;

  -- ----- Migration auth_roles -----
  -- Garde anti-collision : si un (user_id) portait DÉJÀ 'encadrant' (peu
  -- probable mais possible si réexécution partielle), l'UPDATE direct
  -- violerait la PK (user_id, role). On ne migre que les lignes dont le
  -- couple cible (user_id,'encadrant') n'existe pas encore ; le reste
  -- (doublon) est simplement supprimé comme redondant.
  update public.auth_roles ar
     set role = 'encadrant'
   where ar.role = 'referent'
     and not exists (
       select 1 from public.auth_roles x
       where x.user_id = ar.user_id and x.role = 'encadrant'
     );
  get diagnostics v_auth_migrees = row_count;

  delete from public.auth_roles ar
   where ar.role = 'referent'
     and exists (
       select 1 from public.auth_roles x
       where x.user_id = ar.user_id and x.role = 'encadrant'
     );

  -- ----- Migration roles_en_attente -----
  update public.roles_en_attente re
     set role = 'encadrant'
   where re.role = 'referent'
     and not exists (
       select 1 from public.roles_en_attente y
       where y.personne_id = re.personne_id and y.role = 'encadrant'
     );
  get diagnostics v_att_migrees = row_count;

  delete from public.roles_en_attente re
   where re.role = 'referent'
     and exists (
       select 1 from public.roles_en_attente y
       where y.personne_id = re.personne_id and y.role = 'encadrant'
     );

  -- ----- Cadrage APRÈS -----
  v_auth_referent_apres  := (select count(*) from public.auth_roles       where role = 'referent');
  v_auth_encadrant_apres := (select count(*) from public.auth_roles       where role = 'encadrant');
  v_att_referent_apres   := (select count(*) from public.roles_en_attente where role = 'referent');
  v_att_encadrant_apres  := (select count(*) from public.roles_en_attente where role = 'encadrant');

  raise notice 'APRÈS  | auth_roles: referent=%, encadrant=% | roles_en_attente: referent=%, encadrant=% | migrées auth=%, attente=%',
    v_auth_referent_apres, v_auth_encadrant_apres, v_att_referent_apres, v_att_encadrant_apres,
    v_auth_migrees, v_att_migrees;

  -- ----- FAIL-LOUD -----
  -- (1) plus AUCUNE ligne referent nulle part.
  if v_auth_referent_apres <> 0 then
    raise exception 'FAIL-LOUD: % ligne(s) referent subsistent dans auth_roles après migration.', v_auth_referent_apres;
  end if;
  if v_att_referent_apres <> 0 then
    raise exception 'FAIL-LOUD: % ligne(s) referent subsistent dans roles_en_attente après migration.', v_att_referent_apres;
  end if;

  -- (2) conservation du compte : encadrant_après = encadrant_avant + referent_avant
  --     (chaque referent devient un encadrant ; les doublons éventuels
  --      n'augmentent pas le total puisque la cible existait déjà).
  if v_auth_encadrant_apres < v_auth_encadrant_avant then
    raise exception 'FAIL-LOUD: le nombre d''encadrant a DIMINUÉ dans auth_roles (% -> %) — perte d''accès.',
      v_auth_encadrant_avant, v_auth_encadrant_apres;
  end if;
  if (v_auth_encadrant_apres - v_auth_encadrant_avant) > v_auth_referent_avant then
    raise exception 'FAIL-LOUD: gain encadrant (% ) > referent migrables (%) — incohérence.',
      (v_auth_encadrant_apres - v_auth_encadrant_avant), v_auth_referent_avant;
  end if;

  raise notice 'OK étape 2 : 0 referent résiduel ; auth_roles encadrant % -> % ; aucune perte d''accès.',
    v_auth_encadrant_avant, v_auth_encadrant_apres;
end;
$migr$;

commit;
