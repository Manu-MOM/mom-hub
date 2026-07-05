-- =============================================================================
-- sql_160_seed_ecoles_secteur_molsheim.sql
-- Module B « Prospection / Developpement scolaire » — seed des ecoles du secteur.
-- Source : annuaire de l'Education nationale + carte officielle 2024 de la
-- circonscription IEN de Molsheim + liste departementale par circonscription
-- (recherche web 05/07/2026, conversation OODA retour terrain).
--
-- PERIMETRE (decision tracee, reversible d'un mot) :
--   - ecoles ELEMENTAIRES et PRIMAIRES uniquement (cible metier des cycles
--     rugby ; les maternelles pures sont EXCLUES — le CHECK type_entite de la
--     base ne connait pas 'ecole_maternelle', les integrer serait une
--     extension de modele a arbitrer separement).
--   - 3 zones : circonscription de Molsheim (complete), communes limitrophes
--     rattachees a l'Eurometropole Sud-Ouest (Altorf, Dachstein, Duttlenheim,
--     Duppigheim, Ernolsheim-Bruche), nord de la circonscription d'Obernai.
--
-- METHODE (idempotente, additive) :
--   1) ENRICHISSEMENT des 4 ecoles deja presentes en base (codes existants
--      conserves ; nouvelles colonnes remplies ; contact_email et
--      statut_prospection via COALESCE — jamais d'ecrasement de saisie).
--   2) INSERT des 63 autres ecoles, code = 'ECOLE-<UAI>',
--      ON CONFLICT (code) DO NOTHING (rejouable sans doublon).
--   Courriel : format academique standard ce.<UAI>@ac-strasbourg.fr (verifie
--   sur pieces : ce.0672245b / ce.0672621K). Telephones issus de la liste
--   departementale : stables mais a confirmer au premier contact.
--   contact_nom, lieu_pratique : non renseignes (a collecter au demarchage —
--   les noms de direction ne sont pas publies en open data).
--   cree_par NULL (seed systeme). Pas de begin/commit explicite.
--
-- PREREQUIS : sql_159 execute (colonnes adresse/code_postal/commune/telephone/
-- uai/zone/lieu_pratique presentes).
-- =============================================================================

-- 1) Enrichissement des 4 ecoles deja en base (rapprochement manuel trace) ----
update public.entites set
  adresse = '15 rue de l''Église', code_postal = '67190', commune = 'Mutzig',
  telephone = '03 88 38 15 15', uai = '0671221N', zone = 'Circ. Molsheim',
  contact_email = coalesce(contact_email, 'ce.0671221N@ac-strasbourg.fr'),
  statut_prospection = coalesce(statut_prospection, 'a_contacter')
where code = 'ECOLE-SCHICKELE-8I6K';

update public.entites set
  adresse = 'rue de l''Église', code_postal = '67280', commune = 'Urmatt',
  telephone = '03 88 97 57 49', uai = '0672529K', zone = 'Circ. Molsheim',
  contact_email = coalesce(contact_email, 'ce.0672529K@ac-strasbourg.fr'),
  statut_prospection = coalesce(statut_prospection, 'a_contacter')
where code = 'ECOLE-URMATT-V3KB';

update public.entites set
  adresse = '2 rue de l''École', code_postal = '67120', commune = 'Ergersheim',
  telephone = '03 88 38 24 94', uai = '0671208Z', zone = 'Circ. Molsheim',
  contact_email = coalesce(contact_email, 'ce.0671208Z@ac-strasbourg.fr'),
  statut_prospection = coalesce(statut_prospection, 'a_contacter')
where code = 'ECOLE-ERGERSHEIM-HR7X';

update public.entites set
  adresse = '2 rue des Écoles', code_postal = '67870', commune = 'Bischoffsheim',
  telephone = '03 88 50 21 24', uai = '0671236E', zone = 'Circ. Obernai (nord)',
  contact_email = coalesce(contact_email, 'ce.0671236E@ac-strasbourg.fr'),
  statut_prospection = coalesce(statut_prospection, 'a_contacter')
where code = 'ECOLE-BISCHOFFSHEIM-LBAN';

-- (ECOLE-SCHARRACHBERGHEIM-4CXX : hors des trois zones sourcees — laissee telle
--  quelle, enrichissable a la main via la fiche.)

-- 2) Seed des 63 ecoles du secteur --------------------------------------------
insert into public.entites
  (code, libelle, type_entite, contact_email, statut_prospection, actif,
   adresse, code_postal, commune, telephone, uai, zone)
values
  ('ECOLE-0671194J', 'École élémentaire Les Tilleuls — Molsheim', 'ecole_elementaire', 'ce.0671194J@ac-strasbourg.fr', 'a_contacter', true,
   '10 place de la Liberté', '67120', 'Molsheim', '03 88 38 69 24', '0671194J', 'Circ. Molsheim'),
  ('ECOLE-0672245B', 'École primaire La Monnaie — Molsheim', 'ecole_elementaire', 'ce.0672245B@ac-strasbourg.fr', 'a_contacter', true,
   '3 rue Charles Mistler', '67120', 'Molsheim', '03 88 38 19 55', '0672245B', 'Circ. Molsheim'),
  ('ECOLE-0671220M', 'École élémentaire Rohan — Mutzig', 'ecole_elementaire', 'ce.0671220M@ac-strasbourg.fr', 'a_contacter', true,
   'place Jacques Coulaux', '67190', 'Mutzig', '03 88 38 19 57', '0671220M', 'Circ. Molsheim'),
  ('ECOLE-0672933Z', 'Groupe scolaire Hoffen — Mutzig', 'ecole_elementaire', 'ce.0672933Z@ac-strasbourg.fr', 'a_contacter', true,
   '5 rue du Dr Schweitzer', '67190', 'Mutzig', '03 88 38 55 55', '0672933Z', 'Circ. Molsheim'),
  ('ECOLE-0672143R', 'École élémentaire — Dorlisheim', 'ecole_elementaire', 'ce.0672143R@ac-strasbourg.fr', 'a_contacter', true,
   '113 Grand''Rue', '67120', 'Dorlisheim', '03 88 38 52 74', '0672143R', 'Circ. Molsheim'),
  ('ECOLE-0671200R', 'Groupe scolaire du Schlotten (RPI Avolsheim-Wolxheim)', 'ecole_elementaire', 'ce.0671200R@ac-strasbourg.fr', 'a_contacter', true,
   '1 route de Wolxheim', '67120', 'Avolsheim', '03 88 38 01 33', '0671200R', 'Circ. Molsheim'),
  ('ECOLE-0671232A', 'École élémentaire (RPI du Schlotten) — Wolxheim', 'ecole_elementaire', 'ce.0671232A@ac-strasbourg.fr', 'a_contacter', true,
   '15 rue Principale', '67120', 'Wolxheim', '03 88 38 84 89', '0671232A', 'Circ. Molsheim'),
  ('ECOLE-0672096P', 'École élémentaire Les Pins — Soultz-les-Bains', 'ecole_elementaire', 'ce.0672096P@ac-strasbourg.fr', 'a_contacter', true,
   '8 rue du Fort', '67120', 'Soultz-les-Bains', '03 88 38 53 36', '0672096P', 'Circ. Molsheim'),
  ('ECOLE-0671303C', 'École (RPI du Kehlbach) — Dangolsheim', 'ecole_elementaire', 'ce.0671303C@ac-strasbourg.fr', 'a_contacter', true,
   '32 rue de l''Église', '67310', 'Dangolsheim', '03 88 49 80 95', '0671303C', 'Circ. Molsheim'),
  ('ECOLE-0671308H', 'École (RPI du Kehlbach) — Flexbourg', 'ecole_elementaire', 'ce.0671308H@ac-strasbourg.fr', 'a_contacter', true,
   '33 rue des Seigneurs', '67310', 'Flexbourg', '03 88 50 30 27', '0671308H', 'Circ. Molsheim'),
  ('ECOLE-0671298X', 'École (RPI du Kehlbach) — Bergbieten', 'ecole_elementaire', 'ce.0671298X@ac-strasbourg.fr', 'a_contacter', true,
   '45 rue des Vosges', '67310', 'Bergbieten', '03 88 38 41 48', '0671298X', 'Circ. Molsheim'),
  ('ECOLE-0671202T', 'École élémentaire — Dinsheim-sur-Bruche', 'ecole_elementaire', 'ce.0671202T@ac-strasbourg.fr', 'a_contacter', true,
   '15 rue de l''Hôpital', '67190', 'Dinsheim-sur-Bruche', '03 88 50 19 33', '0671202T', 'Circ. Molsheim'),
  ('ECOLE-0672088F', 'École élémentaire — Gresswiller', 'ecole_elementaire', 'ce.0672088F@ac-strasbourg.fr', 'a_contacter', true,
   '2 rue de l''Église', '67190', 'Gresswiller', '03 88 50 16 59', '0672088F', 'Circ. Molsheim'),
  ('ECOLE-0671228W', 'École élémentaire — Still', 'ecole_elementaire', 'ce.0671228W@ac-strasbourg.fr', 'a_contacter', true,
   '1 rue des Écoles', '67190', 'Still', '03 88 50 09 60', '0671228W', 'Circ. Molsheim'),
  ('ECOLE-0672209M', 'École primaire — Heiligenberg', 'ecole_elementaire', 'ce.0672209M@ac-strasbourg.fr', 'a_contacter', true,
   '47 rue Neuve', '67190', 'Heiligenberg', '03 88 48 77 50', '0672209M', 'Circ. Molsheim'),
  ('ECOLE-0672031U', 'École élémentaire — Niederhaslach', 'ecole_elementaire', 'ce.0672031U@ac-strasbourg.fr', 'a_contacter', true,
   '35 rue Principale', '67280', 'Niederhaslach', '03 88 50 99 51', '0672031U', 'Circ. Molsheim'),
  ('ECOLE-0671224S', 'École élémentaire — Oberhaslach', 'ecole_elementaire', 'ce.0671224S@ac-strasbourg.fr', 'a_contacter', true,
   '20 rue du Nideck', '67280', 'Oberhaslach', '03 88 50 99 47', '0671224S', 'Circ. Molsheim'),
  ('ECOLE-0671241K', 'École élémentaire — Grendelbruch', 'ecole_elementaire', 'ce.0671241K@ac-strasbourg.fr', 'a_contacter', true,
   '1 rue de la Libération', '67190', 'Grendelbruch', '03 88 97 58 47', '0671241K', 'Circ. Molsheim'),
  ('ECOLE-0671218K', 'École primaire — Muhlbach-sur-Bruche', 'ecole_elementaire', 'ce.0671218K@ac-strasbourg.fr', 'a_contacter', true,
   '14 rue des Seigneurs', '67130', 'Muhlbach-sur-Bruche', '03 88 97 84 16', '0671218K', 'Circ. Molsheim'),
  ('ECOLE-0672353U', 'École élémentaire — Lutzelhouse', 'ecole_elementaire', 'ce.0672353U@ac-strasbourg.fr', 'a_contacter', true,
   '12 rue de la Paix', '67130', 'Lutzelhouse', '03 88 97 53 53', '0672353U', 'Circ. Molsheim'),
  ('ECOLE-0672228H', 'École élémentaire — Wisches', 'ecole_elementaire', 'ce.0672228H@ac-strasbourg.fr', 'a_contacter', true,
   'rue des Écoles', '67130', 'Wisches', '03 88 97 53 79', '0672228H', 'Circ. Molsheim'),
  ('ECOLE-0671290N', 'École élémentaire hameau de Hersbach — Wisches (Hersbach)', 'ecole_elementaire', 'ce.0671290N@ac-strasbourg.fr', 'a_contacter', true,
   '59 Grand''Rue Hersbach', '67130', 'Wisches (Hersbach)', '03 88 97 86 05', '0671290N', 'Circ. Molsheim'),
  ('ECOLE-0671282E', 'École élémentaire — Russ', 'ecole_elementaire', 'ce.0671282E@ac-strasbourg.fr', 'a_contacter', true,
   '14 rue de la Gare', '67130', 'Russ', '03 88 97 13 99', '0671282E', 'Circ. Molsheim'),
  ('ECOLE-0672379X', 'École élémentaire (RPI Schirmeck-Barembach-Grandfontaine)', 'ecole_elementaire', 'ce.0672379X@ac-strasbourg.fr', 'a_contacter', true,
   '2 place de la Gare', '67130', 'Schirmeck', '03 88 97 17 76', '0672379X', 'Circ. Molsheim'),
  ('ECOLE-0671262H', 'École élémentaire hameau de Wackenbach — Schirmeck (Wackenbach)', 'ecole_elementaire', 'ce.0671262H@ac-strasbourg.fr', 'a_contacter', true,
   '20 rue Principale', '67130', 'Schirmeck (Wackenbach)', '03 88 97 10 74', '0671262H', 'Circ. Molsheim'),
  ('ECOLE-0671264K', 'École élémentaire (RPI) — Barembach', 'ecole_elementaire', 'ce.0671264K@ac-strasbourg.fr', 'a_contacter', true,
   '15 rue Principale', '67130', 'Barembach', '03 88 47 18 65', '0671264K', 'Circ. Molsheim'),
  ('ECOLE-0671274W', 'École primaire (RPI) — Grandfontaine', 'ecole_elementaire', 'ce.0671274W@ac-strasbourg.fr', 'a_contacter', true,
   '54 rue Principale', '67130', 'Grandfontaine', '03 88 97 21 94', '0671274W', 'Circ. Molsheim'),
  ('ECOLE-0672086D', 'École primaire — La Broque', 'ecole_elementaire', 'ce.0672086D@ac-strasbourg.fr', 'a_contacter', true,
   '49 rue du Général de Gaulle', '67130', 'La Broque', '03 88 97 86 43', '0672086D', 'Circ. Molsheim'),
  ('ECOLE-0672829L', 'École élémentaire La Claquette — La Broque (La Claquette)', 'ecole_elementaire', 'ce.0672829L@ac-strasbourg.fr', 'a_contacter', true,
   '28 rue du Général Leclerc', '67570', 'La Broque (La Claquette)', '03 88 97 86 47', '0672829L', 'Circ. Molsheim'),
  ('ECOLE-0672932Y', 'École élémentaire Gustave Steinheil — Rothau', 'ecole_elementaire', 'ce.0672932Y@ac-strasbourg.fr', 'a_contacter', true,
   '6 A rue des Jardins', '67570', 'Rothau', '03 88 97 86 12', '0672932Y', 'Circ. Molsheim'),
  ('ECOLE-0672138K', 'École élémentaire (RPI de la Rothaine) — Natzwiller', 'ecole_elementaire', 'ce.0672138K@ac-strasbourg.fr', 'a_contacter', true,
   '15 rue de l''Église', '67130', 'Natzwiller', '03 88 97 95 11', '0672138K', 'Circ. Molsheim'),
  ('ECOLE-0671287K', 'École primaire — Wildersbach', 'ecole_elementaire', 'ce.0671287K@ac-strasbourg.fr', 'a_contacter', true,
   '155 rue de l''Église', '67130', 'Wildersbach', '03 88 97 95 12', '0671287K', 'Circ. Molsheim'),
  ('ECOLE-0671286J', 'École primaire — Waldersbach', 'ecole_elementaire', 'ce.0671286J@ac-strasbourg.fr', 'a_contacter', true,
   '17 rue de la Suisse', '67130', 'Waldersbach', '03 88 97 35 58', '0671286J', 'Circ. Molsheim'),
  ('ECOLE-0671273V', 'École primaire — Fouday', 'ecole_elementaire', 'ce.0671273V@ac-strasbourg.fr', 'a_contacter', true,
   '50 rue de l''École', '67130', 'Fouday', '03 88 97 35 57', '0671273V', 'Circ. Molsheim'),
  ('ECOLE-0671254Z', 'École (RPI de la Climontaine) — Colroy-la-Roche', 'ecole_elementaire', 'ce.0671254Z@ac-strasbourg.fr', 'a_contacter', true,
   'rue du Ban de la Roche', '67420', 'Colroy-la-Roche', '03 88 47 21 59', '0671254Z', 'Circ. Molsheim'),
  ('ECOLE-0671258D', 'École (RPI de la Climontaine) — Saint-Blaise-la-Roche', 'ecole_elementaire', 'ce.0671258D@ac-strasbourg.fr', 'a_contacter', true,
   '38 route de Colroy', '67420', 'Saint-Blaise-la-Roche', '03 88 47 20 77', '0671258D', 'Circ. Molsheim'),
  ('ECOLE-0671257C', 'École (RPI de la Climontaine) — Ranrupt', 'ecole_elementaire', 'ce.0671257C@ac-strasbourg.fr', 'a_contacter', true,
   '7 rue de l''École', '67420', 'Ranrupt', '03 88 47 24 60', '0671257C', 'Circ. Molsheim'),
  ('ECOLE-0671255A', 'École primaire — Plaine', 'ecole_elementaire', 'ce.0671255A@ac-strasbourg.fr', 'a_contacter', true,
   '20 rue de l''Église', '67420', 'Plaine', '03 88 47 20 27', '0671255A', 'Circ. Molsheim'),
  ('ECOLE-0671253Y', 'École (RPI Bourg-Bruche/Saulxures) — Bourg-Bruche', 'ecole_elementaire', 'ce.0671253Y@ac-strasbourg.fr', 'a_contacter', true,
   'quartier des Paires', '67420', 'Bourg-Bruche', '03 88 97 72 92', '0671253Y', 'Circ. Molsheim'),
  ('ECOLE-0671259E', 'École (RPI Bourg-Bruche/Saulxures) — Saulxures', 'ecole_elementaire', 'ce.0671259E@ac-strasbourg.fr', 'a_contacter', true,
   '5 rue des Écoles', '67420', 'Saulxures', '03 88 47 20 57', '0671259E', 'Circ. Molsheim'),
  ('ECOLE-0672662E', 'École élémentaire Des Fontaines — Saâles', 'ecole_elementaire', 'ce.0672662E@ac-strasbourg.fr', 'a_contacter', true,
   'Grand''Rue', '67420', 'Saâles', '03 88 97 75 26', '0672662E', 'Circ. Molsheim'),
  ('ECOLE-0671195K', 'École élémentaire — Altorf', 'ecole_elementaire', 'ce.0671195K@ac-strasbourg.fr', 'a_contacter', true,
   '3 rue de Dachstein', '67120', 'Altorf', '03 88 38 26 44', '0671195K', 'Proche secteur (Eurométropole S-O)'),
  ('ECOLE-0672849H', 'École élémentaire François J''espère — Dachstein', 'ecole_elementaire', 'ce.0672849H@ac-strasbourg.fr', 'a_contacter', true,
   'rue Jacques Prévert', '67120', 'Dachstein', '03 88 38 45 45', '0672849H', 'Proche secteur (Eurométropole S-O)'),
  ('ECOLE-0672258R', 'École élémentaire Jean Hans Arp — Duttlenheim', 'ecole_elementaire', 'ce.0672258R@ac-strasbourg.fr', 'a_contacter', true,
   '1 place des Frères Mathis', '67120', 'Duttlenheim', '03 88 50 72 46', '0672258R', 'Proche secteur (Eurométropole S-O)'),
  ('ECOLE-0671401J', 'École élémentaire — Duppigheim', 'ecole_elementaire', 'ce.0671401J@ac-strasbourg.fr', 'a_contacter', true,
   '1 rue du Stade', '67120', 'Duppigheim', '03 88 50 86 80', '0671401J', 'Proche secteur (Eurométropole S-O)'),
  ('ECOLE-0672351S', 'École élémentaire — Ernolsheim-Bruche', 'ecole_elementaire', 'ce.0672351S@ac-strasbourg.fr', 'a_contacter', true,
   '5 allée du Stade', '67120', 'Ernolsheim-Bruche', '03 88 59 87 02', '0672351S', 'Proche secteur (Eurométropole S-O)'),
  ('ECOLE-0671243M', 'École élémentaire — Griesheim-près-Molsheim', 'ecole_elementaire', 'ce.0671243M@ac-strasbourg.fr', 'a_contacter', true,
   '256 rue de la Libération', '67870', 'Griesheim-près-Molsheim', '03 88 16 15 90', '0671243M', 'Circ. Obernai (nord)'),
  ('ECOLE-0672868D', 'Groupe scolaire du Rosenmeer — Rosheim', 'ecole_elementaire', 'ce.0672868D@ac-strasbourg.fr', 'a_contacter', true,
   '11 rue de l''Église', '67560', 'Rosheim', '03 88 50 42 86', '0672868D', 'Circ. Obernai (nord)'),
  ('ECOLE-0671248T', 'École élémentaire — Rosenwiller', 'ecole_elementaire', 'ce.0671248T@ac-strasbourg.fr', 'a_contacter', true,
   '2 rue de l''École', '67560', 'Rosenwiller', '03 88 50 73 69', '0671248T', 'Circ. Obernai (nord)'),
  ('ECOLE-0671238G', 'École élémentaire — Boersch', 'ecole_elementaire', 'ce.0671238G@ac-strasbourg.fr', 'a_contacter', true,
   '21 rue Mgr Médard Barth', '67530', 'Boersch', '03 88 48 13 37', '0671238G', 'Circ. Obernai (nord)'),
  ('ECOLE-0671240J', 'École élémentaire Klingenthal — Boersch (Klingenthal)', 'ecole_elementaire', 'ce.0671240J@ac-strasbourg.fr', 'a_contacter', true,
   '12 rue de l''École', '67530', 'Boersch (Klingenthal)', '03 88 95 95 71', '0671240J', 'Circ. Obernai (nord)'),
  ('ECOLE-0671245P', 'École primaire — Mollkirch', 'ecole_elementaire', 'ce.0671245P@ac-strasbourg.fr', 'a_contacter', true,
   '15 rue du Mollberg', '67190', 'Mollkirch', '03 88 49 00 09', '0671245P', 'Circ. Obernai (nord)'),
  ('ECOLE-0671246R', 'École élémentaire — Ottrott', 'ecole_elementaire', 'ce.0671246R@ac-strasbourg.fr', 'a_contacter', true,
   '5 avenue des Myrtilles', '67530', 'Ottrott', '03 88 95 96 58', '0671246R', 'Circ. Obernai (nord)'),
  ('ECOLE-0671250V', 'École primaire — Saint-Nabor', 'ecole_elementaire', 'ce.0671250V@ac-strasbourg.fr', 'a_contacter', true,
   '10 rue des Carrières', '67530', 'Saint-Nabor', '03 88 95 94 27', '0671250V', 'Circ. Obernai (nord)'),
  ('ECOLE-0671433U', 'École élémentaire Pablo Picasso — Obernai', 'ecole_elementaire', 'ce.0671433U@ac-strasbourg.fr', 'a_contacter', true,
   'square Saint-Charles', '67210', 'Obernai', '03 88 95 29 54', '0671433U', 'Circ. Obernai (nord)'),
  ('ECOLE-0671434V', 'École élémentaire Freppel — Obernai', 'ecole_elementaire', 'ce.0671434V@ac-strasbourg.fr', 'a_contacter', true,
   '29 rue du Général Gouraud', '67210', 'Obernai', '03 88 95 29 47', '0671434V', 'Circ. Obernai (nord)'),
  ('ECOLE-0671772M', 'École élémentaire Parc — Obernai', 'ecole_elementaire', 'ce.0671772M@ac-strasbourg.fr', 'a_contacter', true,
   '204 B route d''Ottrott', '67210', 'Obernai', '03 88 95 48 06', '0671772M', 'Circ. Obernai (nord)'),
  ('ECOLE-0671435W', 'École primaire — Bernardswiller', 'ecole_elementaire', 'ce.0671435W@ac-strasbourg.fr', 'a_contacter', true,
   '25 rue de l''École', '67210', 'Bernardswiller', '03 88 95 18 88', '0671435W', 'Circ. Obernai (nord)'),
  ('ECOLE-0671445G', 'École élémentaire Sainte-Barbe — Niedernai', 'ecole_elementaire', 'ce.0671445G@ac-strasbourg.fr', 'a_contacter', true,
   '34 rue du Château', '67210', 'Niedernai', '03 88 95 41 19', '0671445G', 'Circ. Obernai (nord)'),
  ('ECOLE-0672875L', 'École élémentaire Lili Schoenemann — Krautergersheim', 'ecole_elementaire', 'ce.0672875L@ac-strasbourg.fr', 'a_contacter', true,
   '2 place du Tramway', '67880', 'Krautergersheim', '03 88 95 78 99', '0672875L', 'Circ. Obernai (nord)'),
  ('ECOLE-0671439A', 'École élémentaire — Innenheim', 'ecole_elementaire', 'ce.0671439A@ac-strasbourg.fr', 'a_contacter', true,
   '73 rue du Général de Gaulle', '67880', 'Innenheim', '03 88 95 70 45', '0671439A', 'Circ. Obernai (nord)'),
  ('ECOLE-0671443E', 'École élémentaire — Meistratzheim', 'ecole_elementaire', 'ce.0671443E@ac-strasbourg.fr', 'a_contacter', true,
   '417 B rue Sainte-Odile', '67210', 'Meistratzheim', '03 88 48 35 13', '0671443E', 'Circ. Obernai (nord)'),
  ('ECOLE-0671438Z', 'École élémentaire — Goxwiller', 'ecole_elementaire', 'ce.0671438Z@ac-strasbourg.fr', 'a_contacter', true,
   '57 rue Principale', '67210', 'Goxwiller', '03 88 95 40 00', '0671438Z', 'Circ. Obernai (nord)')
on conflict (code) do nothing;

-- 3) Verification fail-loud ----------------------------------------------------
do $verif$
declare
  v_count integer;
begin
  v_count := (select count(*) from public.entites where uai is not null);
  if v_count < 67 then
    raise exception 'VERIF: % ecole(s) avec UAI (>= 67 attendues : 63 seed + 4 enrichies).', v_count;
  end if;

  v_count := (select count(*) from public.entites
              where code like 'ECOLE-06%' and statut_prospection = 'a_contacter');
  if v_count < 63 then
    raise exception 'VERIF: % ecole(s) seed a_contacter (>= 63 attendues).', v_count;
  end if;

  -- Aucun doublon d'UAI (rapprochement des 4 existantes correct).
  v_count := (select count(*) from (
    select uai from public.entites where uai is not null
    group by uai having count(*) > 1
  ) d);
  if v_count > 0 then
    raise exception 'VERIF: % UAI en doublon dans entites.', v_count;
  end if;

  raise notice 'VERIF OK : seed ecoles secteur Molsheim en place (67+ ecoles avec UAI, 0 doublon).';
end;
$verif$;
