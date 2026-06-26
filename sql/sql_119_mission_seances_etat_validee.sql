-- =====================================================================
-- sql_119_mission_seances_etat_validee.sql
-- Chantier : MISSION-TO-COUNTER (doctrine 2+3 — declaration -> validation)
-- Objet    : ajouter l'etat 'validee' au CHECK mission_seances.etat.
--            Cycle de vie cible : prevue -> realisee -> validee (+ annulee).
--              - prevue   : au planning previsionnel.
--              - realisee : la seance a eu lieu (constatee par le salarie ou
--                           l'administration), heures_reelles saisies.
--              - validee  : l'administration a valide -> alimente le compteur.
--              - annulee  : n'a pas eu lieu.
--            Seul 'validee' declenche la fusion vers releve_heures_salarie
--            (voir sql_116c). Migration purement additive (elargit le CHECK).
-- Sonde    : S2b (CHECK actuel = prevue|realisee|annulee).
-- =====================================================================

begin;

-- 1) Remplacer le CHECK pour accepter 'validee' (additif : on n'enleve aucune
--    valeur existante, la ligne de test reste valide).
alter table public.mission_seances
  drop constraint if exists mission_seances_etat_check;

alter table public.mission_seances
  add constraint mission_seances_etat_check
  check (etat = any (array[
    'prevue'::text,
    'realisee'::text,
    'validee'::text,
    'annulee'::text
  ]));

-- 2) Garde-fou fail-loud : le CHECK existe et porte bien 'validee'
--    (et conserve les valeurs historiques).
do $verif$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.mission_seances'::regclass
    and conname  = 'mission_seances_etat_check';

  if v_def is null then
    raise exception 'sql_119 ECHEC : CHECK mission_seances_etat_check absent';
  end if;
  if v_def not ilike '%prevue%'
     or v_def not ilike '%realisee%'
     or v_def not ilike '%validee%'
     or v_def not ilike '%annulee%' then
    raise exception 'sql_119 ECHEC : CHECK ne porte pas les 4 etats attendus (def=%)', v_def;
  end if;

  raise notice 'OK sql_119 : mission_seances.etat accepte prevue|realisee|validee|annulee.';
end
$verif$;

commit;
