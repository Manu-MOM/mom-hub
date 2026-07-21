-- pt 208 (chantier VIVIER-B-STAFF-CLASSIFICATION) : NETTOYAGE DATA (Volet 3).
--
-- Complement de sql_198 (code). Corrige les fiches faussement categorisees/staffees a cause
-- du bug 'B'-dans-le-socle, plus la fiche RULFO (ne joue pas) et la rustine AMANI.
-- Ciblage par id (verifie a la source 21/07/2026) pour zero ambiguite.
--
-- FAIT FOI (decisions Manu, gelees) :
--   - ANDREI Ciprian  : joueur etranger pur -> categorie_personne 'joueur', type 'licencie_competition'.
--   - COLSON Gregory  : joueur etranger pur -> categorie_personne 'joueur', type 'licencie_competition'.
--   - RULFO  Vivien   : ne joue pas         -> categorie_personne 'parent_et_staff' (type educateur inchange).
--   - AMANI  Ali Y.   : rustine devenue inutile apres retrait de 'B' du socle -> staff_exclu false.
--                       (type_personne NON touche : hors demande explicite.)
--
-- Chaque UPDATE porte une garde WHERE sur l'etat AVANT attendu (idempotence + securite :
-- si une fiche a deja ete corrigee ou differe de l'etat sonde, l'UPDATE ne fait rien).
begin;

-- ANDREI Ciprian (id 19550d0b-c6a0-456f-922e-9ea12c9b4a57)
update public.personnes
set categorie_personne = 'joueur',
    type_personne      = 'licencie_competition'
where id = '19550d0b-c6a0-456f-922e-9ea12c9b4a57'
  and categorie_personne = 'joueur_et_staff'
  and type_personne      = 'licencie_dirigeant';

-- COLSON Gregory (id 59db572e-52a7-443e-bd7d-593d6d95138d)
update public.personnes
set categorie_personne = 'joueur',
    type_personne      = 'licencie_competition'
where id = '59db572e-52a7-443e-bd7d-593d6d95138d'
  and categorie_personne = 'joueur_et_staff'
  and type_personne      = 'licencie_dirigeant';

-- RULFO Vivien (id de6a71f3-12e2-45de-a677-eb8c25d8fc50) — ne joue pas
update public.personnes
set categorie_personne = 'parent_et_staff'
where id = 'de6a71f3-12e2-45de-a677-eb8c25d8fc50'
  and categorie_personne = 'joueur_et_parent_et_staff';

-- AMANI Ali Yannick (id 12f26df7-e09e-4b5d-b6d9-5479f23a2031) — rustine levee
update public.personnes
set staff_exclu = false
where id = '12f26df7-e09e-4b5d-b6d9-5479f23a2031'
  and staff_exclu = true;

-- ============================================================================
-- VÉRIFICATION fail-loud — etat CIBLE atteint sur les 4 fiches
-- ============================================================================
do $verif$
declare
  v_ko int;
begin
  select count(*) into v_ko from public.personnes
   where (id = '19550d0b-c6a0-456f-922e-9ea12c9b4a57'
            and not (categorie_personne='joueur' and type_personne='licencie_competition'))
      or (id = '59db572e-52a7-443e-bd7d-593d6d95138d'
            and not (categorie_personne='joueur' and type_personne='licencie_competition'))
      or (id = 'de6a71f3-12e2-45de-a677-eb8c25d8fc50'
            and categorie_personne <> 'parent_et_staff')
      or (id = '12f26df7-e09e-4b5d-b6d9-5479f23a2031'
            and staff_exclu <> false);
  if v_ko > 0 then
    raise exception 'DATA KO : % fiche(s) hors etat cible.', v_ko;
  end if;
  raise notice 'DATA OK : ANDREI/COLSON en joueur+competition, RULFO en parent_et_staff, AMANI staff_exclu=false.';
end;
$verif$;

commit;
