-- =====================================================================
-- sql_209_mission_type_evenement_extra_sportif.sql
-- Chantier : MISSION-TYPE-EVENEMENT-EXTRA-SPORTIF
-- Objet    : ajouter un 11e type de mission « Evenement extra-sportif »
--            (jeton 'evenement_extra_sportif') au CHECK
--            missions_type_mission_check, pose aux 10 jetons par sql_114.
-- Origine  : retour terrain de Vanessa sur les missions de Lohann —
--            les evenements extra-sportifs du club (loto, soiree, AG,
--            manifestation) n'avaient aucun type dedie et tombaient en
--            'divers', ce qui les rendait indistinguables au rapport.
--
-- METHODE : une contrainte CHECK ne se modifie pas en place -> DROP + ADD.
--           La nouvelle liste = ANCIENNE LISTE **PLUS** un jeton :
--           l'operation est STRICTEMENT ELARGISSANTE, aucune ligne
--           existante ne peut devenir invalide a la revalidation.
--
-- SONDES A LA SOURCE (base, avant ecriture — DS-1) :
--   S1. pg_constraint / missions : le CHECK porte bien les 10 jetons de
--       sql_114, aucune derive depuis. CONFIRME.
--   S2. TOUTES les contraintes CHECK du schema mentionnant « type_mission » :
--       **UNE SEULE** (missions_type_mission_check). Le perimetre est donc
--       de 1, pas de contrainte jumelle ailleurs.
--       >>> Cette sonde applique la lecon gravee au pt 227 (sql_208) :
--           ajouter une valeur a un referentiel ne suffit pas, il faut
--           verifier TOUTES les contraintes qui bornent cette valeur
--           ailleurs dans le schema. Requete reflexe :
--           select conrelid::regclass, conname, pg_get_constraintdef(oid)
--           from pg_constraint where contype='c'
--             and pg_get_constraintdef(oid) ilike '%type_mission%';
--   S3. missions : 46 lignes, 6 types en usage (intervention_scolaire 39,
--       entrainement_section 3, entrainement_sr_m 1, travail_personnel 1,
--       suivi_competition 1, reunion 1). Aucune ligne hors des 10 jetons.
--   S4. sync_releve_depuis_occurrence (sql_116b) : le CASE de mapping
--       type_mission -> categorie de releve se termine par « else 'autre' ».
--       VERIFIE EN BASE (et non d'apres le depot).
--
-- MAPPING RELEVE — DECISION D2 (Manu) : categorie 'autre'.
--   >>> LA FONCTION N'EST **PAS** MODIFIEE PAR CE FICHIER. <<<
--   Le « else 'autre' » deja present produit exactement le comportement
--   decide : le 11e type tombe en 'autre' sans branche dediee. Ajouter un
--   « when 'evenement_extra_sportif' then 'autre' » serait un CREATE OR
--   REPLACE d'une fonction SECURITY DEFINER pour un resultat rigoureusement
--   identique — risque non nul, gain nul. Ecarte au titre de P1.
--   Consequence a connaitre : les heures COMPTENT dans l'annualisation
--   (~1 582 h), ventilees en 'autre' aux cotes de 'divers'.
--
-- Idempotent : re-executable sans effet de bord (le DROP est conditionne
--              par IF EXISTS, l'ADD repose la meme definition).
-- Additif    : aucune valeur retiree, aucune donnee modifiee, aucun DELETE.
-- =====================================================================

begin;

-- 1) Filet AVANT bascule : refuser de continuer s'il existe deja une ligne
--    hors des 11 jetons cibles (le nouveau CHECK echouerait a la creation).
--    Fail-loud : on veut l'echec bruyant, pas un CHECK pose de travers.
do $guard$
declare
  v_orphelins int;
begin
  select count(*) into v_orphelins
  from public.missions
  where type_mission not in (
    'intervention_scolaire', 'entrainement_section', 'entrainement_sr_m',
    'autre_entrainement_mom', 'reunion', 'suivi_competition',
    'accompagnement_terrain', 'travail_personnel', 'stage', 'divers',
    'evenement_extra_sportif'
  );
  if v_orphelins > 0 then
    raise exception 'sql_209 ABORT : % ligne(s) missions hors des 11 jetons cibles', v_orphelins;
  end if;
end
$guard$;

-- 2) DROP de l'ancien CHECK (10 jetons). Une CHECK ne se modifie pas en place.
alter table public.missions
  drop constraint if exists missions_type_mission_check;

-- 3) ADD du nouveau CHECK aux 11 jetons.
--    Les 10 premiers sont REPRIS A L'IDENTIQUE de sql_114, dans le meme
--    ordre ; le 11e est ajoute en fin. Elargissement strict.
alter table public.missions
  add constraint missions_type_mission_check
  check (type_mission = any (array[
    'intervention_scolaire'::text,
    'entrainement_section'::text,
    'entrainement_sr_m'::text,
    'autre_entrainement_mom'::text,
    'reunion'::text,
    'suivi_competition'::text,
    'accompagnement_terrain'::text,
    'travail_personnel'::text,
    'stage'::text,
    'divers'::text,
    'evenement_extra_sportif'::text
  ]));

-- 4) Garde-fou fail-loud : le CHECK existe, porte les 11 jetons, et
--    n'a PAS perdu d'ancien jeton au passage (controle 1 a 1).
do $verif$
declare
  v_def     text;
  v_jeton   text;
  v_attendus text[] := array[
    'intervention_scolaire', 'entrainement_section', 'entrainement_sr_m',
    'autre_entrainement_mom', 'reunion', 'suivi_competition',
    'accompagnement_terrain', 'travail_personnel', 'stage', 'divers',
    'evenement_extra_sportif'
  ];
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.missions'::regclass
    and conname  = 'missions_type_mission_check';

  if v_def is null then
    raise exception 'sql_209 ECHEC : CHECK missions_type_mission_check absent';
  end if;

  foreach v_jeton in array v_attendus loop
    if v_def not like '%''' || v_jeton || '''%' then
      raise exception 'sql_209 ECHEC : jeton % absent du CHECK (def=%)', v_jeton, v_def;
    end if;
  end loop;

  raise notice 'OK sql_209 : missions.type_mission elargi a 11 jetons (+ evenement_extra_sportif).';
end
$verif$;

-- 5) Controle de non-regression : les 46 lignes existantes restent valides.
--    (Le ADD du CHECK a deja revalide la table ; ce bloc le trace.)
do $verif2$
declare
  v_total int;
begin
  select count(*) into v_total from public.missions;
  raise notice 'OK sql_209 : % ligne(s) missions revalidees sans rejet.', v_total;
end
$verif2$;

commit;
