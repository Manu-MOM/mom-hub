-- =============================================================================
-- sql_162_rapprochement_cycles_realises.sql
-- Module B « Prospection » — rapprochement du fichier terrain de Manu
-- (Liste_coordonnées_écoles.xlsx, 05/07/2026) : écoles ayant déjà bénéficié
-- d'un cycle rugby, noms de direction, coordonnées terrain.
--
-- DÉCISIONS TRACÉES (réversibles) :
--   - X en 2025/2026 OU 2026/2027 -> statut_prospection 'client' (14 écoles) ;
--     Niederhaslach (« souhaite 2027/2028 », sans X) -> 'interesse' ;
--     lignes sans X -> enrichissement contacts seulement, statut inchangé.
--   - Donnée TERRAIN prioritaire sur l'annuaire quand elle diffère (mails
--     nominatifs/gmail/wanadoo, téléphones Ergersheim/Urmatt/Bergbieten) ;
--     portables ajoutés à côté du fixe.
--   - Commentaires du fichier -> notes ; « Stade de Kircheim » -> lieu_pratique
--     (orthographié Kirchheim).
--   - Heiligenstein et Mittelbergheim absentes de la base (circ. Obernai sud,
--     hors périmètre sql_160) -> insérées sans UAI (à compléter).
--   - Coquilles évidentes corrigées : Stépahnie->Stéphanie, Sohie->Sophie.
--     Anomalie reprise telle quelle : Scharrachbergheim, directrice
--     « Patricia Schmitt » mais mail « patricia.quiviger@ » — à vérifier.
--   - Idempotent : UPDATE par code + INSERT ON CONFLICT DO NOTHING.
-- =============================================================================

-- 1) Écoles clientes (cycle 2025/2026 et/ou 2026/2027) ------------------------
update public.entites set statut_prospection = 'client',
  contact_nom = 'Sandy Schwartz'
  where code = 'ECOLE-0671194J';                                   -- Tilleuls Molsheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'Alain Steinmetz'
  where code = 'ECOLE-0671200R';                                   -- Schlotten Avolsheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'Maelle Hoffbeck'
  where code = 'ECOLE-BISCHOFFSHEIM-LBAN';                         -- Fontaines Bischoffsheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'Sabine Distel',
  notes = 'Pas de cycle en 2026/2027 (fichier terrain 05/07/2026).'
  where code = 'ECOLE-0672143R';                                   -- Dorlisheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'Stéphanie Braun'
  where code = 'ECOLE-0671772M';                                   -- Parc Obernai

update public.entites set statut_prospection = 'client',
  contact_nom = 'Muriel Schall',
  contact_email = 'ecole.ergersheim@gmail.com',
  telephone = '03 69 81 57 53'
  where code = 'ECOLE-ERGERSHEIM-HR7X';                            -- Ergersheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'Anne Sophie Darcis',
  telephone = '03 88 16 15 90 / 06 59 91 18 34'
  where code = 'ECOLE-0671243M';                                   -- Griesheim-près-Molsheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'M. Laganier'
  where code = 'ECOLE-SCHICKELE-8I6K';                             -- Schickelé Mutzig

update public.entites set statut_prospection = 'client',
  telephone = '03 69 23 40 45'
  where code = 'ECOLE-URMATT-V3KB';                                -- Urmatt

update public.entites set statut_prospection = 'client',
  contact_nom = 'M. Plesse',
  contact_email = 'bertrand.plesse@ac-strasbourg.fr'
  where code = 'ECOLE-0671232A';                                   -- Wolxheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'Alexandra Ronelt',
  notes = 'Pas de cycle en 2026/2027 (fichier terrain 05/07/2026).'
  where code = 'ECOLE-0671245P';                                   -- Mollkirch

update public.entites set statut_prospection = 'client',
  contact_nom = 'Emanuelle Wantz'
  where code = 'ECOLE-0671443E';                                   -- Meistratzheim

update public.entites set statut_prospection = 'client',
  contact_nom = 'Pascale Spetz',
  telephone = '03 88 47 82 59'
  where code = 'ECOLE-0671298X';                                   -- Bergbieten (cycle 2026/2027)

update public.entites set statut_prospection = 'client',
  contact_nom = 'Patricia Schmitt',
  contact_email = 'patricia.quiviger@ac-strasbourg.fr',
  commune = 'Scharrachbergheim-Irmstett',
  lieu_pratique = 'Stade de Kirchheim',
  notes = 'Cycle 2026/2027. Anomalie fichier terrain : directrice Schmitt / mail quiviger — à vérifier.'
  where code = 'ECOLE-SCHARRACHBERGHEIM-4CXX';                     -- Scharrachbergheim (2026/2027)

-- 2) Intéressée -----------------------------------------------------------------
update public.entites set statut_prospection = 'interesse',
  contact_nom = 'Sandra Andraux',
  notes = 'Souhaite un cycle rugby en 2027/2028 (fichier terrain 05/07/2026).'
  where code = 'ECOLE-0672031U';                                   -- Niederhaslach

-- 3) Enrichissement contacts sans changement de statut ----------------------------
update public.entites set contact_nom = 'Raphaele Wunderlich'
  where code = 'ECOLE-0671220M';                                   -- Rohan Mutzig

update public.entites set contact_nom = 'M. Legoll',
  contact_email = 'ecole.gresswiller@wanadoo.fr',
  telephone = '03 88 50 16 59 / 06 33 96 57 33'
  where code = 'ECOLE-0672088F';                                   -- Gresswiller

update public.entites set
  telephone = '03 88 95 40 00 / 06 27 92 66 42'
  where code = 'ECOLE-0671438Z';                                   -- Goxwiller

-- 4) Écoles absentes du seed (circ. Obernai sud) ----------------------------------
insert into public.entites
  (code, libelle, type_entite, statut_prospection, actif,
   commune, code_postal, telephone, contact_nom, zone)
values
  ('ECOLE-HEILIGENSTEIN', 'École de Heiligenstein', 'ecole_elementaire',
   'a_contacter', true, 'Heiligenstein', '67140', '06 22 69 07 15',
   'Audrey Facchi', 'Circ. Obernai (sud)'),
  ('ECOLE-MITTELBERGHEIM', 'École de Mittelbergheim', 'ecole_elementaire',
   'a_contacter', true, 'Mittelbergheim', '67140', '06 88 32 85 21',
   'M. Heckmann', 'Circ. Obernai (sud)')
on conflict (code) do nothing;

-- 5) Vérification fail-loud --------------------------------------------------------
do $verif$
declare
  v_count integer;
begin
  v_count := (select count(*) from public.entites where statut_prospection = 'client');
  if v_count < 14 then
    raise exception 'VERIF: % ecole(s) cliente(s) (>= 14 attendues).', v_count;
  end if;

  v_count := (select count(*) from public.entites where statut_prospection = 'interesse');
  if v_count < 1 then
    raise exception 'VERIF: aucune ecole interessee (Niederhaslach attendue).';
  end if;

  v_count := (select count(*) from public.entites where contact_nom is not null);
  if v_count < 18 then
    raise exception 'VERIF: % contact_nom renseignes (>= 18 attendus).', v_count;
  end if;

  v_count := (select count(*) from public.entites
              where code in ('ECOLE-HEILIGENSTEIN', 'ECOLE-MITTELBERGHEIM'));
  if v_count <> 2 then
    raise exception 'VERIF: Heiligenstein/Mittelbergheim absentes (%/2).', v_count;
  end if;

  raise notice 'VERIF OK : rapprochement terrain applique (14+ clientes, 1 interessee, 18+ contacts nommes, 2 insertions).';
end;
$verif$;
