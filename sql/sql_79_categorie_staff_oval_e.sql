-- pt 79 : correction non-destructive de categorie_personne pour les encadrants OVAL-E mal classes
-- Source de verite : export OVAL-E complet (qualites multiples). Codes staff retenus : DC4, EDU, ECF, SOI, B.
-- Regle : AJOUT de la dimension staff ; joueur et parent preserves. SportEasy non touche. AMANI exclu (scorie).
-- 15 fiches (16 candidates - AMANI exclu). Cible par id explicite. Idempotent (rejouable sans effet de bord).
begin;

-- ALVIANI Magali : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '7fb84d4d-8607-458f-9e25-61d55d8fef7a' and categorie_personne = 'joueur';

-- ANDREI Ciprian : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '19550d0b-c6a0-456f-922e-9ea12c9b4a57' and categorie_personne = 'joueur';

-- ARBOGAST Leanne : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '3431ca7e-9122-4cd7-8b9a-5d93c9caee24' and categorie_personne = 'joueur';

-- COLSON Gregory : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '59db572e-52a7-443e-bd7d-593d6d95138d' and categorie_personne = 'joueur';

-- GRUNENWALD Julien : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '62660001-70b4-4062-a4dc-d97c10340bca' and categorie_personne = 'joueur';

-- HUMBERT Lohann : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '589e7977-748c-42db-b29c-0505ec0d2e41' and categorie_personne = 'joueur';

-- KOESTEL Helene : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '0ba4dde7-5d9d-47e9-b06e-86d658b3845a' and categorie_personne = 'joueur';

-- KOLB Thierry : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '1d92b0db-a8e5-495d-be65-0e1b0db67c7c' and categorie_personne = 'joueur';

-- LOEFFLER Typhanie : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '9fbcfdc5-db5b-4c0b-997e-6a8c675a90ae' and categorie_personne = 'joueur';

-- LUCHESI Guillaume : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '75a81e9b-2cde-4e48-b1e7-5224f88b7b51' and categorie_personne = 'joueur';

-- MARGUIN Stephane : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '0d99b1bf-3c39-4e59-81f4-b098f62c7a70' and categorie_personne = 'joueur';

-- PIQUEREZ Elodie : joueur_et_parent -> joueur_et_parent_et_staff
update public.personnes set categorie_personne = 'joueur_et_parent_et_staff'
  where id = 'd85493ff-5fa3-47ad-b712-f628c5f18037' and categorie_personne = 'joueur_et_parent';

-- ROZIER Fabien : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '81deed31-bc4a-4144-b154-dc7ff0c0643a' and categorie_personne = 'joueur';

-- VACHER Baptiste : joueur -> joueur_et_staff
update public.personnes set categorie_personne = 'joueur_et_staff'
  where id = '100b012e-eb47-468a-a78a-23589da3fce7' and categorie_personne = 'joueur';

-- VAUTIER Sabrina : joueur_et_parent -> joueur_et_parent_et_staff
update public.personnes set categorie_personne = 'joueur_et_parent_et_staff'
  where id = '88853450-ff9e-43d4-95f8-186bdad599e2' and categorie_personne = 'joueur_et_parent';

-- Controle : doit retourner 15
select count(*) as nb_corrigees from public.personnes
  where id in ('7fb84d4d-8607-458f-9e25-61d55d8fef7a','19550d0b-c6a0-456f-922e-9ea12c9b4a57','3431ca7e-9122-4cd7-8b9a-5d93c9caee24','59db572e-52a7-443e-bd7d-593d6d95138d','62660001-70b4-4062-a4dc-d97c10340bca','589e7977-748c-42db-b29c-0505ec0d2e41','0ba4dde7-5d9d-47e9-b06e-86d658b3845a','1d92b0db-a8e5-495d-be65-0e1b0db67c7c','9fbcfdc5-db5b-4c0b-997e-6a8c675a90ae','75a81e9b-2cde-4e48-b1e7-5224f88b7b51','0d99b1bf-3c39-4e59-81f4-b098f62c7a70','d85493ff-5fa3-47ad-b712-f628c5f18037','81deed31-bc4a-4144-b154-dc7ff0c0643a','100b012e-eb47-468a-a78a-23589da3fce7','88853450-ff9e-43d4-95f8-186bdad599e2')
    and categorie_personne ilike '%staff%';

commit;
