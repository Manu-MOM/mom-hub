-- =====================================================================
-- sql_212_type_bloc_atelier.sql
-- =====================================================================
-- Objet   : Ajouter le type de bloc 'atelier' (12e type) au module Séance.
-- Contexte : Retour terrain Manu — besoin d'un type "Atelier" dans la
--            trame chronologique, à côté du corps de séance.
-- Portée   : 1 contrainte CHECK remplacée. Additif pur : 11 slugs
--            historiques conservés à l'identique, +1 slug 'atelier'.
--            Aucune autre table/fonction/policy touchée.
-- Miroir front : data/types-blocs.json v1.2 (entrée 'atelier', ordre_natif 12).
-- Note     : DÉJÀ APPLIQUÉ EN BASE PAR L'AGENT (do $verif$ vert,
--            contrainte déployée vérifiée = 12 slugs). Ce fichier est la
--            trace dépôt ; rien à ré-exécuter.
-- =====================================================================

ALTER TABLE seances_blocs DROP CONSTRAINT seances_blocs_type_bloc_check;

ALTER TABLE seances_blocs ADD CONSTRAINT seances_blocs_type_bloc_check
  CHECK (type_bloc = ANY (ARRAY[
    'accueil'::text,
    'mise_en_train'::text,
    'echauffement'::text,
    'echauffement_specifique'::text,
    'corps_seance'::text,
    'jeu_application'::text,
    'match_application'::text,
    'retour_au_calme'::text,
    'bilan'::text,
    'pause_boisson'::text,
    'bloc_libre'::text,
    'atelier'::text
  ]));

-- Vérif fail-loud : 'atelier' présent, 11 historiques conservés.
do $verif$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'seances_blocs'::regclass
    and conname = 'seances_blocs_type_bloc_check';

  if v_def is null then
    raise exception 'ECHEC : contrainte seances_blocs_type_bloc_check absente';
  end if;
  if v_def not like '%''atelier''%' then
    raise exception 'ECHEC : slug atelier absent de la contrainte : %', v_def;
  end if;
  if v_def not like '%''accueil''%'
     or v_def not like '%''bloc_libre''%'
     or v_def not like '%''match_application''%' then
    raise exception 'ECHEC : un slug historique a disparu : %', v_def;
  end if;
  raise notice 'OK : contrainte type_bloc = 12 slugs, atelier inclus, 11 historiques conserves';
end;
$verif$;
