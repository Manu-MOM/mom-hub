-- =============================================================================
-- sql_163_programmation_cycles_2026_2027.sql
-- Module B « Prospection » — programmation des cycles rugby 2026/2027.
-- Suite directe de sql_162 : les 8 écoles marquées « En 2026/2027 » dans le
-- fichier terrain de Manu recoivent chacune une mission intervention_scolaire.
--
-- POURQUOI EN SQL ET PAS VIA upsert_mission : les RPC portent la garde
-- _gs_peut_ecrire() et auth.uid() est NULL dans l'editeur SQL / connecteur
-- (lecon tracee au projet) -> INSERT direct calque sur le corps de la RPC,
-- valeurs identiques a celles du bouton « Programmer le cycle » du front.
--
-- DECISIONS TRACEES :
--   - salarie : Lohann HUMBERT (unique salarie sous contrat actif — sonde).
--   - saison : 2026/2027 (est_active = true — sonde).
--   - date_debut : 2026-09-01 (rentree scolaire ; le champ est NOT NULL et le
--     fichier terrain ne donne pas de dates) — « Dates a preciser » en notes,
--     ajustables via suivi-salarie/developpement-scolaire.
--   - etat 'prevue', statut 'facturable' (memes valeurs que le front),
--     refacturable = false (heritage entite, toutes a false — sonde).
--   - lieu_libre 'Stade de Kirchheim' pour Scharrachbergheim (fichier terrain).
--   - code deterministe CYCLE-2627-<suffixe ecole> ; idempotence par
--     ON CONFLICT (code) DO NOTHING (UNIQUE(code) verifie — sonde).
--   - cree_par NULL (seed systeme).
-- =============================================================================

insert into public.missions
  (code, libelle, type_mission, salarie_id, entite_id, saison_id,
   date_debut, date_fin, lieu_libre, refacturable, etat,
   questionnaire_fait, notes, statut)
select
  v.code,
  'Cycle rugby — ' || e.libelle,
  'intervention_scolaire',
  '589e7977-748c-42db-b29c-0505ec0d2e41',            -- Lohann HUMBERT
  e.id,
  '0fe81033-fd60-471d-ba5d-644458f4cdd3',            -- Saison 2026/2027
  date '2026-09-01',
  null,
  v.lieu_libre,
  false,
  'prevue',
  false,
  'Dates à préciser — programmation seed sql_163 (fichier terrain 05/07/2026).',
  'facturable'
from (values
  ('CYCLE-2627-0671194J',  'ECOLE-0671194J',              null),
  ('CYCLE-2627-BISCHOFFS', 'ECOLE-BISCHOFFSHEIM-LBAN',    null),
  ('CYCLE-2627-ERGERSHEIM','ECOLE-ERGERSHEIM-HR7X',       null),
  ('CYCLE-2627-0671243M',  'ECOLE-0671243M',              null),
  ('CYCLE-2627-SCHICKELE', 'ECOLE-SCHICKELE-8I6K',        null),
  ('CYCLE-2627-0671232A',  'ECOLE-0671232A',              null),
  ('CYCLE-2627-0671298X',  'ECOLE-0671298X',              null),
  ('CYCLE-2627-SCHARRACH', 'ECOLE-SCHARRACHBERGHEIM-4CXX','Stade de Kirchheim')
) as v (code, code_entite, lieu_libre)
join public.entites e on e.code = v.code_entite
on conflict (code) do nothing;

-- Verification fail-loud ------------------------------------------------------
do $verif$
declare
  v_count integer;
begin
  v_count := (select count(*) from public.missions
    where code like 'CYCLE-2627-%' and type_mission = 'intervention_scolaire');
  if v_count <> 8 then
    raise exception 'VERIF: % mission(s) CYCLE-2627 (8 attendues).', v_count;
  end if;

  v_count := (select count(*) from public.missions m
    where m.code like 'CYCLE-2627-%'
      and (m.entite_id is null
           or m.saison_id <> '0fe81033-fd60-471d-ba5d-644458f4cdd3'
           or m.etat <> 'prevue'));
  if v_count > 0 then
    raise exception 'VERIF: % mission(s) CYCLE-2627 mal formee(s).', v_count;
  end if;

  raise notice 'VERIF OK : 8 cycles 2026/2027 programmes (missions prevues, saison active).';
end;
$verif$;
