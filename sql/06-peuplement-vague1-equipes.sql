-- =====================================================================
-- MOM HUB · PHASE 4.1.A · PEUPLEMENT VAGUE 1
-- =====================================================================
-- Auteur  : Manu (avec assistance Claude)
-- Date    : 2026-05-13
-- Version : 1.0
--
-- Peuple les 3 tables Vague 1 préexistantes (schémas conservés intacts
-- depuis le 10 mai 2026, cf. sql/01-creation-tables-vague1.sql) :
--   1. ententes        (11 lignes : 3 Permanente SAR/MOM/ASCS + 8 Solo MOM)
--   2. equipes         (11 lignes : 1 par fichier Drive equipe-*-2025-2026.json)
--   3. equipe_joueurs  (23 lignes : attaches M14 MOM en statut 'regulier')
--
-- =====================================================================
-- ARBITRAGES PRIS LE 13 MAI 2026 (Manu, conv Production)
-- =====================================================================
--   - Manu (Emmanuel JUNG) est coach principal ET référent de la M14
--     (uuid_legacy 'personne-parent-6b7a9b')
--   - Touch et Rugby à 5 = 2 équipes sous 2 ententes distinctes :
--       MOM Touch    → entente cat-rlsp (RLSP, Rugby sans plaquage)
--       MOM Rugby à 5 → entente cat-rlo  (RLO, Rugby loisir avec plaquage)
--   - Sites partenaires (HAUTEPIERRE SAR, HOCHFELDEN ASCS) non créés
--     à ce stade. Les ententes M14/M16/M19 ont sites_utilises =
--     [site-mom-brenckle] uniquement (sites MOM-only).
--   - 23 attaches M14 MOM créées en statut 'regulier' (les 37 SAR + 2
--     ASCS sont reportés à Phase 4.3, après instruction dette C7).
--
-- =====================================================================
-- HORS PÉRIMÈTRE (à traiter ultérieurement)
-- =====================================================================
--   - Effectifs des 10 autres équipes (vides à ce stade, à peupler
--     progressivement quand les données seront disponibles)
--   - Sites partenaires (HAUTEPIERRE, HOCHFELDEN, etc.)
--   - Format de jeu détaillé sur les equipes (laissé NULL pour démarrer,
--     P1 simplicité + P3 itération)
--   - Coachs des 10 équipes hors M14 (NULL pour démarrer)
--
-- =====================================================================
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Idempotent : ON CONFLICT (code) DO NOTHING sur ententes et equipes.
-- =====================================================================

BEGIN;


-- =====================================================================
-- SECTION 1 — ENTENTES (11 lignes)
-- =====================================================================
-- Note : la contrainte UNIQUE (saison_id, categorie_id) garantit qu'il
-- n'y a qu'une seule entente par catégorie × saison. Les ententes Solo
-- ont clubs_partenaires_ids = ARRAY[]::UUID[] et regime 'Solo'.
-- =====================================================================

INSERT INTO ententes (
  code, slug, libelle_court, libelle_moyen, libelle_long,
  saison_id, categorie_id, club_principal_id, clubs_partenaires_ids,
  regime_actuel, identifiant_sporteasy,
  competitions_engagees, notes
) VALUES

-- 1.1 Entente M14 SAR/MOM/ASCS · Permanente · ÉQUIPE PILOTE
(
  'ENTENTE-M14-2025-2026',
  'entente-m14-sar-mom-ascs-2025-2026',
  'M14',
  'M14 SAR/MOM/ASCS',
  'M14/F15 · SAR/MOM/ASCS · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-m14'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[
    (SELECT id FROM clubs WHERE code = 'SAR'),
    (SELECT id FROM clubs WHERE code = 'ASCS')
  ]::UUID[],
  'Permanente',
  'SAR',
  '[{"nom":"LRGER M-14","ligue":"Ligue Régionale Grand Est"}]'::jsonb,
  'Équipe pilote du Hub. Effectif MOM 23 joueurs (17 garçons + 6 F-15 intégrées). SAR (37) et ASCS (2) reportés à Phase 4.3 (dette C7).'
),

-- 1.2 Entente M16 SAR/MOM/ASCS · Permanente
(
  'ENTENTE-M16-2025-2026',
  'entente-m16-sar-mom-ascs-2025-2026',
  'M16',
  'M16 SAR/MOM/ASCS',
  'M16 · SAR/MOM/ASCS · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-m16'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[
    (SELECT id FROM clubs WHERE code = 'SAR'),
    (SELECT id FROM clubs WHERE code = 'ASCS')
  ]::UUID[],
  'Permanente',
  'SAR',
  '[{"nom":"LRGER M-16","ligue":"Ligue Régionale Grand Est"}]'::jsonb,
  'Coach et effectif à compléter.'
),

-- 1.3 Entente M19 SAR/MOM/ASCS · Permanente (libellé club M18)
(
  'ENTENTE-M19-2025-2026',
  'entente-m19-sar-mom-ascs-2025-2026',
  'M18',
  'M18 SAR/MOM/ASCS (juniors)',
  'M18 (code FFR M19) · SAR/MOM/ASCS · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-m19'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[
    (SELECT id FROM clubs WHERE code = 'SAR'),
    (SELECT id FROM clubs WHERE code = 'ASCS')
  ]::UUID[],
  'Permanente',
  'SAR',
  '[{"nom":"LRGER M-19","ligue":"Ligue Régionale Grand Est"}]'::jsonb,
  'Coach et effectif à compléter.'
),

-- 1.4 Entente Seniors Masculins MOM · Solo
(
  'ENTENTE-SR-M-2025-2026',
  'entente-sr-m-mom-solo-2025-2026',
  'Sen. M',
  'MOM Seniors M',
  'MOM Seniors Masculins · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-srm'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[{"nom":"Régionale 2 / Promotion d''honneur (à confirmer)","ligue":"Ligue Régionale Grand Est"}]'::jsonb,
  'Championnat à confirmer (R2 ou PH). Voir SporteNCO ou bureau MOM.'
),

-- 1.5 Entente Seniors Féminines MOM · Solo
(
  'ENTENTE-SR-F-2025-2026',
  'entente-sr-f-mom-solo-2025-2026',
  'Sen. F',
  'MOM Seniors F',
  'MOM Seniors Féminines · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-srf'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[{"nom":"Régional Féminin — Rugby à X","ligue":"Ligue Régionale Grand Est"}]'::jsonb,
  'Format Rugby à X confirmé par Manu (2026-05-08).'
),

-- 1.6 Entente M12 MOM · Solo (EDR)
(
  'ENTENTE-M12-2025-2026',
  'entente-m12-mom-solo-2025-2026',
  'M12',
  'MOM M-12',
  'MOM M-12 · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-m12'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[{"nom":"Plateaux EDR M12","ligue":"LRGER"}]'::jsonb,
  'Dernière catégorie EDR avant passage en compétition (M-14).'
),

-- 1.7 Entente M10 MOM · Solo (EDR)
(
  'ENTENTE-M10-2025-2026',
  'entente-m10-mom-solo-2025-2026',
  'M10',
  'MOM M-10',
  'MOM M-10 · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-m10'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[{"nom":"Plateaux EDR M10","ligue":"LRGER"}]'::jsonb,
  'EDR Holtzplatz, mercredi et samedi après-midi.'
),

-- 1.8 Entente M8 MOM · Solo (EDR)
(
  'ENTENTE-M8-2025-2026',
  'entente-m8-mom-solo-2025-2026',
  'M8',
  'MOM M-8',
  'MOM M-8 · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-m8'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[{"nom":"Plateaux EDR M8","ligue":"LRGER"}]'::jsonb,
  'EDR Holtzplatz, mercredi et samedi après-midi.'
),

-- 1.9 Entente M6 MOM · Solo (EDR — pas de matchs)
(
  'ENTENTE-M6-2025-2026',
  'entente-m6-mom-solo-2025-2026',
  'M6',
  'MOM M-6',
  'MOM M-6 (Baby) · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-m6'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[{"nom":"Plateaux EDR M6 (initiation)","ligue":"LRGER"}]'::jsonb,
  'Pas de matchs de championnat (plateaux EDR uniquement).'
),

-- 1.10 Entente Rugby à 5 (RLO) MOM · Solo (loisir)
(
  'ENTENTE-RLO-2025-2026',
  'entente-rlo-mom-solo-2025-2026',
  'R5',
  'MOM Rugby à 5',
  'MOM Rugby à 5 · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-rlo'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[]'::jsonb,
  'Section loisir Rugby à 5. Non compétitif. Public mixte.'
),

-- 1.11 Entente Touch (RLSP) MOM · Solo (loisir)
(
  'ENTENTE-RLSP-2025-2026',
  'entente-rlsp-mom-solo-2025-2026',
  'Touch',
  'MOM Touch',
  'MOM Touch (Rugby Loisir Sans Plaquage) · Solo · 2025/2026',
  (SELECT id FROM saisons    WHERE code = '2025-2026'),
  (SELECT id FROM categories WHERE uuid_legacy = 'cat-rlsp'),
  (SELECT id FROM clubs      WHERE code = 'MOM'),
  ARRAY[]::UUID[],
  'Solo',
  NULL,
  '[]'::jsonb,
  'Section loisir touch (vendredis 19h Brencklé). Non compétitif. Mixte 14 ans+.'
)

ON CONFLICT (code) DO NOTHING;


-- =====================================================================
-- SECTION 2 — EQUIPES (11 lignes)
-- =====================================================================
-- 1 équipe par entente. Chaque équipe a numero_equipe=1 (pas de 2e
-- équipe par catégorie à ce stade). Coach NULL sauf M14 (Manu).
-- =====================================================================

INSERT INTO equipes (
  code, nom_officiel, alias,
  entente_id, numero_equipe,
  libelle_court, libelle_moyen, libelle_long,
  type_equipe, club_referent_id,
  mixte, mixte_detail,
  championnat_nom, championnat_ligue,
  championnat_code_ffr, championnat_code_scorenco,
  sites_utilises, site_principal_id, sites_note,
  statut,
  coach_principal_id, coachs_adjoints_ids, manager_id,
  notes
) VALUES

-- 2.1 Équipe M14 SAR/MOM/ASCS — coach = Manu
(
  'ENTENTE-M14-2025-2026',
  'Entente SAR/MOM/ASCS M-14',
  ARRAY['M14 SAR-MOM-ASCS','M14 entente']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-M14-2025-2026'),
  1,
  'M14',
  'M14 — Équipe 1',
  'M14 SAR/MOM/ASCS — Équipe 1 — 2025/2026',
  'entente',
  (SELECT id FROM clubs WHERE code = 'MOM'),
  TRUE,
  'Effectif mixte M-14 garçons + F-15 filles intégrées (pas d''équipe F-15 séparée).',
  'LRGER M-14',
  'Ligue Régionale Grand Est',
  NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-brenckle')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-brenckle'),
  'Sites partenaires (HAUTEPIERRE SAR, HOCHFELDEN ASCS) non créés à ce stade — MOM-only.',
  'active',
  (SELECT id FROM personnes WHERE uuid_legacy = 'personne-parent-6b7a9b'),
  ARRAY[]::UUID[],
  NULL,
  'Équipe pilote du Hub. Coach principal Emmanuel JUNG (référent + coach).'
),

-- 2.2 Équipe M16 SAR/MOM/ASCS
(
  'ENTENTE-M16-2025-2026',
  'Entente SAR/MOM/ASCS M-16',
  ARRAY['M16 SAR-MOM-ASCS','M16 entente']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-M16-2025-2026'),
  1, 'M16', 'M16 — Équipe 1', 'M16 SAR/MOM/ASCS — Équipe 1 — 2025/2026',
  'entente', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'LRGER M-16','Ligue Régionale Grand Est', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-brenckle')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-brenckle'),
  'Sites partenaires non créés à ce stade — MOM-only.',
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'Coach et effectif à compléter.'
),

-- 2.3 Équipe M19/M18 SAR/MOM/ASCS
(
  'ENTENTE-M19-2025-2026',
  'Entente SAR/MOM/ASCS M-19',
  ARRAY['M19 SAR-MOM-ASCS','M18 entente','Juniors entente']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-M19-2025-2026'),
  1, 'M18', 'M18 — Équipe 1', 'M18 (FFR M19) SAR/MOM/ASCS — Équipe 1 — 2025/2026',
  'entente', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'LRGER M-19','Ligue Régionale Grand Est', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-brenckle')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-brenckle'),
  'Sites partenaires non créés à ce stade — MOM-only.',
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'Coach et effectif à compléter.'
),

-- 2.4 Équipe Seniors M MOM
(
  'MOM-SENIORS-M-2025-2026',
  'MOM Seniors Masculins',
  ARRAY['Seniors M MOM','Équipe 1 MOM','Senior 1']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-SR-M-2025-2026'),
  1, 'Sen. M', 'MOM Seniors M', 'MOM Seniors Masculins — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'Régionale 2 / Promotion d''honneur (à confirmer)','Ligue Régionale Grand Est', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-brenckle')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-brenckle'),
  'Tous les matchs à domicile à Brencklé.',
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'Championnat à confirmer (R2 ou PH). MOM oscille entre ces 2 niveaux les dernières saisons.'
),

-- 2.5 Équipe Seniors F MOM
(
  'MOM-SENIORS-F-2025-2026',
  'MOM Seniors Féminines',
  ARRAY['Seniors F MOM','Féminines MOM']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-SR-F-2025-2026'),
  1, 'Sen. F', 'MOM Seniors F', 'MOM Seniors Féminines — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'Régional Féminin — Rugby à X','Ligue Régionale Grand Est', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-brenckle')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-brenckle'),
  NULL,
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'Format Rugby à X confirmé par Manu (2026-05-08).'
),

-- 2.6 Équipe M12 MOM
(
  'MOM-M12-2025-2026',
  'MOM M-12',
  ARRAY['M12 MOM']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-M12-2025-2026'),
  1, 'M12', 'MOM M-12', 'MOM M-12 — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'Plateaux EDR M12','LRGER', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-holtzplatz')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-holtzplatz'),
  NULL,
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'EDR Holtzplatz, mercredi et samedi après-midi. Dernière catégorie EDR.'
),

-- 2.7 Équipe M10 MOM
(
  'MOM-M10-2025-2026',
  'MOM M-10',
  ARRAY['M10 MOM']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-M10-2025-2026'),
  1, 'M10', 'MOM M-10', 'MOM M-10 — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'Plateaux EDR M10','LRGER', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-holtzplatz')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-holtzplatz'),
  NULL,
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'EDR Holtzplatz, mercredi et samedi après-midi.'
),

-- 2.8 Équipe M8 MOM
(
  'MOM-M8-2025-2026',
  'MOM M-8',
  ARRAY['M8 MOM']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-M8-2025-2026'),
  1, 'M8', 'MOM M-8', 'MOM M-8 — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'Plateaux EDR M8','LRGER', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-holtzplatz')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-holtzplatz'),
  NULL,
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'EDR Holtzplatz, mercredi et samedi après-midi.'
),

-- 2.9 Équipe M6 MOM
(
  'MOM-M6-2025-2026',
  'MOM M-6',
  ARRAY['M6 MOM','Baby M6']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-M6-2025-2026'),
  1, 'M6', 'MOM M-6', 'MOM M-6 (Baby) — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  FALSE, NULL,
  'Plateaux EDR M6 (initiation)','LRGER', NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-holtzplatz')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-holtzplatz'),
  NULL,
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'Pas de matchs de championnat (plateaux EDR uniquement).'
),

-- 2.10 Équipe Rugby à 5 (RLO) MOM
(
  'MOM-RUGBY5-2025-2026',
  'MOM Rugby à 5',
  ARRAY['Rugby à 5 MOM','R5 MOM']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-RLO-2025-2026'),
  1, 'R5', 'MOM Rugby à 5', 'MOM Rugby à 5 — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  TRUE,
  'Mixte par nature (sans contact, sans plaquage, accessible à tous).',
  'Loisir / non compétitif', NULL, NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-brenckle')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-brenckle'),
  NULL,
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'Section Rugby à 5 — sans contact ni plaquage. Public mixte. Format ludique et convivial.'
),

-- 2.11 Équipe Touch (RLSP) MOM
(
  'MOM-TOUCH-2025-2026',
  'MOM Touch',
  ARRAY['Touch MOM','Rugby à toucher MOM']::TEXT[],
  (SELECT id FROM ententes WHERE code = 'ENTENTE-RLSP-2025-2026'),
  1, 'Touch', 'MOM Touch', 'MOM Touch — 2025/2026',
  'mono_club', (SELECT id FROM clubs WHERE code = 'MOM'),
  TRUE,
  'Mixte par nature (rugby à toucher accessible à tous, à partir de 14 ans).',
  'Loisir / non compétitif', NULL, NULL, NULL,
  ARRAY[(SELECT id FROM sites WHERE code = 'site-mom-brenckle')]::UUID[],
  (SELECT id FROM sites WHERE code = 'site-mom-brenckle'),
  NULL,
  'active',
  NULL, ARRAY[]::UUID[], NULL,
  'Section loisir à toucher. Vendredis 19h à Brencklé. Mixte à partir de 14 ans, sans limite d''âge supérieure.'
)

ON CONFLICT (code) DO NOTHING;


-- =====================================================================
-- SECTION 3 — EQUIPE_JOUEURS (23 attaches M14 MOM)
-- =====================================================================
-- Effectif M14 MOM extrait de Drive equipe-ENTENTE-M14-2025-2026.json
-- (17 garçons + 6 F-15 intégrées). Tous les joueurs sont du MOM
-- (club_provenance_id = MOM). Statut 'regulier'. niveau_profil laissé
-- NULL pour démarrer (à renseigner ultérieurement via UI ou batch).
--
-- Les 37 joueurs SAR et 2 joueurs ASCS de l'entente M14 ne sont PAS
-- inscrits ici — ils seront ajoutés Phase 4.3 après instruction de la
-- dette C7 (audit doctrine OVAL-E pour joueurs partenaires d'entente).
-- =====================================================================

INSERT INTO equipe_joueurs (
  equipe_id, personne_id, club_provenance_id,
  date_affectation, statut, notes
) VALUES
-- 17 garçons M-14
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-e31591'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Hugo BARTHEL'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-dad8d3'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Leandre BERNHART'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-9f9697'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Gauthier CHEVRIER'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-4c0ac8'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Maximilien CUNY'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-e8c6e3'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Benjamin EHRHART'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-c68a37'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Anthony FASSEL'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-68d305'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Eden FAUVEL'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-dd7b90'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Hugo LUTZ'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-a8ea75'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Arthur PADOWICZ'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-ce500a'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Jules JUNG'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-882dc9'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Aaron PATU'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-511078'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Martin ROOS'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-af5947'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Timeo RULFO'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-560405'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Alphonse SCHIMPF'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-9242bd'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Leo SCHUCH'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-0cd060'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Nathan VAUTIER'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-af21bc'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Pierre KREBS'),

-- 6 F-15 intégrées
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-696a02'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Aureline BES (F-15 intégrée)'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-7d7bbb'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Mathilde MARTIN (F-15 intégrée)'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-eaa07d'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Emie PIQUEREZ (F-15 intégrée)'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-35127b'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Agathe TRENDEL (F-15 intégrée)'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-055656'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Elena TRISTANO (F-15 intégrée)'),
((SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026'), (SELECT id FROM personnes WHERE uuid_legacy='personne-663f65'), (SELECT id FROM clubs WHERE code='MOM'), '2025-09-01', 'regulier', 'Elise HOCH (F-15 intégrée)');

-- Note : pas de ON CONFLICT sur equipe_joueurs car la contrainte UNIQUE
-- est sur (equipe_id, personne_id, date_affectation) — si on re-exécute
-- le script avec une autre date, ça créera de nouvelles attaches.
-- Pour rejouer proprement, supprimer les lignes existantes d'abord :
--   DELETE FROM equipe_joueurs WHERE equipe_id = (SELECT id FROM equipes WHERE code='ENTENTE-M14-2025-2026');


-- =====================================================================
-- SECTION 4 — VÉRIFICATIONS (lecture seule)
-- =====================================================================
-- Décommenter pour valider après exécution.
-- =====================================================================

-- SELECT COUNT(*) AS nb_ententes FROM ententes;        -- attendu : 11
-- SELECT COUNT(*) AS nb_equipes  FROM equipes;         -- attendu : 11
-- SELECT COUNT(*) AS nb_attaches FROM equipe_joueurs;  -- attendu : 23

-- SELECT e.code, e.nom_officiel, e.type_equipe,
--        (SELECT COUNT(*) FROM equipe_joueurs WHERE equipe_id = e.id) AS nb_joueurs
-- FROM equipes e
-- ORDER BY e.code;

-- Détecter les éventuels personne_id NULL (slug Drive introuvable dans personnes.uuid_legacy)
-- SELECT * FROM equipe_joueurs WHERE personne_id IS NULL;

COMMIT;
