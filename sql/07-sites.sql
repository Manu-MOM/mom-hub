-- ============================================================================
-- MOM Hub · Phase 4.1.B · Tables `sites` et `distances_sites`
-- ============================================================================
-- Objectif : poser les fondations de gestion des lieux physiques utilisés
-- par le club (terrains de jeu, gymnases, complexes sportifs) + un cache
-- des distances inter-sites pour les calculs de logistique de déplacement.
--
-- Référence : `Modelisation-Evenements-v1.md` §4.6 (conv Audits, 12 mai 2026).
--
-- 2 tables :
--   1. `sites`            — lieux physiques (terrains, gymnases) avec GPS
--   2. `distances_sites`  — cache des distances inter-sites (lazy, ~1 an)
--
-- Sécurité :
--   - RLS activée. Lecture publique pour `authenticated` (les sites sont
--     des informations non sensibles, comme les catégories ou les clubs).
--   - Écriture restreinte au rôle `admin` (via le helper `has_role` Phase 2.5.1).
--   - `distances_sites` : lecture authenticated, écriture authenticated
--     (peuplement par les RPC Production via service_role, pas RLS pure).
--
-- Indépendance par rapport au conflit `equipes`/`ententes` :
--   - Ces tables n'existent pas en Vague 1, donc pas de risque de collision.
--   - Aucune FK vers `equipes`, `ententes`, `evenements` à ce stade.
--   - Le pattern lazy de `distances_sites` (calcul à la demande, cache long)
--     n'introduit pas de dépendance non plus.
--
-- À exécuter dans le SQL editor Supabase (projet mom-hub).
-- Idempotent : peut être rejoué sans dégât (CREATE TABLE IF NOT EXISTS).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Table `sites` — lieux physiques utilisés par le club
-- ----------------------------------------------------------------------------
-- Couvre :
--   - les sites du club MOM (Brencklé, Holtzplatz, Clubhouse)
--   - les sites des adversaires fréquents (Strasbourg AR, Sarre-Union, etc.)
--   - les sites des partenaires d'entente (SAR Strasbourg)
--   - les sites neutres pour tournois (Nancy Challenge Vié, etc.)
--
-- Convention du `code` : `site-<slug-en-kebab-case>` pour rester lisible.
-- Ex : 'site-mom-brenckle', 'site-strasbourg-ar', 'site-sarre-union-stade'.

CREATE TABLE IF NOT EXISTS public.sites (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    code                        TEXT NOT NULL UNIQUE,
    libelle                     TEXT NOT NULL,
    libelle_court               TEXT,

    -- Localisation
    adresse                     TEXT,
    code_postal                 TEXT,
    ville                       TEXT,
    pays                        TEXT NOT NULL DEFAULT 'France',
    latitude                    DECIMAL(9, 6),
    longitude                   DECIMAL(9, 6),

    -- Rattachement (optionnel)
    club_principal_id           UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    -- Nullable. Si renseigné, club propriétaire/principal du site.
    -- NULL pour les sites neutres (tournois nationaux, etc.).

    -- Caractéristiques
    type_site                   TEXT NOT NULL DEFAULT 'stade',
    capacite_estimee            INTEGER,
    notes                       TEXT,

    -- Cycle de vie
    actif                       BOOLEAN NOT NULL DEFAULT TRUE,

    -- Métadonnées
    cree_par                    UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_par                 UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Contraintes
    CONSTRAINT sites_type_check CHECK (
        type_site IN ('stade', 'terrain_entrainement', 'complexe_sportif', 'gymnase', 'autre')
    ),
    CONSTRAINT sites_coordinates_check CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

-- Trigger updated_at (réutilise la fonction Vague 1)
DROP TRIGGER IF EXISTS set_updated_at ON public.sites;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.sites
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sites_club_principal ON public.sites(club_principal_id);
CREATE INDEX IF NOT EXISTS idx_sites_actif         ON public.sites(actif);
CREATE INDEX IF NOT EXISTS idx_sites_ville         ON public.sites(ville);
CREATE INDEX IF NOT EXISTS idx_sites_type          ON public.sites(type_site);

-- Documentation
COMMENT ON TABLE  public.sites IS 'Lieux physiques utilisés par le club (terrains, gymnases) avec coordonnées GPS optionnelles pour calculs de distance.';
COMMENT ON COLUMN public.sites.code IS 'Code lisible humain, ex: site-mom-brenckle, site-strasbourg-ar.';
COMMENT ON COLUMN public.sites.club_principal_id IS 'Club propriétaire/principal du site. NULL pour les sites neutres.';
COMMENT ON COLUMN public.sites.type_site IS 'Typologie : stade, terrain_entrainement, complexe_sportif, gymnase, autre.';
COMMENT ON COLUMN public.sites.latitude IS 'Latitude GPS (WGS84). Si renseignée, longitude obligatoire.';


-- ----------------------------------------------------------------------------
-- 2. Table `distances_sites` — cache des distances inter-sites
-- ----------------------------------------------------------------------------
-- Cache lazy : alimenté à la demande par une RPC qui appelle l'API externe
-- (OpenRouteService recommandé, free tier 2000 req/jour, doctrine budget 0€).
-- Stockage ~1 an : les routes changent peu.
--
-- PK composite (origine, destination, mode) pour gérer plusieurs modes plus
-- tard (voiture aujourd'hui, vélo/transports demain). Une seule ligne par
-- triplet, last-write-wins via la RPC.

CREATE TABLE IF NOT EXISTS public.distances_sites (
    site_origine_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    site_destination_id         UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    mode                        TEXT NOT NULL DEFAULT 'voiture',

    distance_km                 DECIMAL(8, 2) NOT NULL,
    duree_minutes               INTEGER NOT NULL,

    source                      TEXT NOT NULL,
    date_calcul                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valable_jusqu_au            TIMESTAMPTZ,

    PRIMARY KEY (site_origine_id, site_destination_id, mode),

    CONSTRAINT distances_sites_mode_check CHECK (
        mode IN ('voiture', 'velo', 'transports', 'pieton')
    ),
    CONSTRAINT distances_sites_source_check CHECK (
        source IN ('openrouteservice', 'google', 'osrm', 'manuel')
    ),
    CONSTRAINT distances_sites_origine_diff_destination CHECK (
        site_origine_id <> site_destination_id
    ),
    CONSTRAINT distances_sites_distance_positive CHECK (
        distance_km >= 0 AND duree_minutes >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_distances_origine     ON public.distances_sites(site_origine_id);
CREATE INDEX IF NOT EXISTS idx_distances_destination ON public.distances_sites(site_destination_id);
CREATE INDEX IF NOT EXISTS idx_distances_valable_jusqu_au ON public.distances_sites(valable_jusqu_au);

COMMENT ON TABLE  public.distances_sites IS 'Cache lazy des distances et durées de trajet inter-sites. Alimenté à la demande par RPC qui appelle l''API externe (OpenRouteService).';
COMMENT ON COLUMN public.distances_sites.mode IS 'Mode de transport : voiture (défaut), velo, transports, pieton.';
COMMENT ON COLUMN public.distances_sites.source IS 'Source du calcul : openrouteservice (défaut prod), google, osrm, manuel.';
COMMENT ON COLUMN public.distances_sites.valable_jusqu_au IS 'Date d''expiration du cache. Typiquement created_at + 1 an. NULL = pas d''expiration.';


-- ----------------------------------------------------------------------------
-- 3. Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Pattern cohérent Phase 2.5 :
--   - SELECT : tous les utilisateurs `authenticated` peuvent lire
--     (les sites ne sont pas des données personnelles)
--   - INSERT / UPDATE / DELETE : `admin` uniquement via has_role('admin')
--
-- Note : `anon` (non connecté) n'a aucun accès, conforme à la décision
-- Phase 2.5 (le portail est désormais derrière auth pour les données).

ALTER TABLE public.sites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distances_sites  ENABLE ROW LEVEL SECURITY;

-- Drop des policies éventuellement existantes (idempotence)
DROP POLICY IF EXISTS sites_select_authenticated ON public.sites;
DROP POLICY IF EXISTS sites_insert_admin         ON public.sites;
DROP POLICY IF EXISTS sites_update_admin         ON public.sites;
DROP POLICY IF EXISTS sites_delete_admin         ON public.sites;

DROP POLICY IF EXISTS distances_select_authenticated ON public.distances_sites;
DROP POLICY IF EXISTS distances_insert_authenticated ON public.distances_sites;
DROP POLICY IF EXISTS distances_update_authenticated ON public.distances_sites;
DROP POLICY IF EXISTS distances_delete_admin         ON public.distances_sites;

-- Policies sites : SELECT public authenticated, écriture admin
CREATE POLICY sites_select_authenticated ON public.sites
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY sites_insert_admin ON public.sites
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role('admin'));

CREATE POLICY sites_update_admin ON public.sites
    FOR UPDATE TO authenticated
    USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY sites_delete_admin ON public.sites
    FOR DELETE TO authenticated
    USING (public.has_role('admin'));

-- Policies distances_sites : tout authenticated peut lire/insérer/updater
-- (cache alimenté par RPC en service_role, mais on garde la flexibilité).
-- DELETE reste admin pour éviter une purge accidentelle du cache.
CREATE POLICY distances_select_authenticated ON public.distances_sites
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY distances_insert_authenticated ON public.distances_sites
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY distances_update_authenticated ON public.distances_sites
    FOR UPDATE TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY distances_delete_admin ON public.distances_sites
    FOR DELETE TO authenticated
    USING (public.has_role('admin'));


-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement après le script)
-- ============================================================================
--
-- A) Vérifier que les 2 tables sont créées :
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public' AND table_name IN ('sites', 'distances_sites');
--    -> doit retourner 2 lignes.
--
-- B) Vérifier que la RLS est activée :
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND tablename IN ('sites', 'distances_sites');
--    -> rowsecurity doit valoir TRUE pour les 2 tables.
--
-- C) Vérifier que les policies existent :
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public' AND tablename IN ('sites', 'distances_sites')
--    ORDER BY tablename, cmd;
--    -> 4 policies sur sites (select/insert/update/delete), 4 sur distances_sites.
--
-- D) Tester la lecture en tant qu'authenticated :
--    SELECT count(*) FROM public.sites;
--    -> doit retourner 0 (table vide tant que pas de peuplement).
--
-- E) Tester que anon ne peut PAS lire :
--    SET ROLE anon;
--    SELECT count(*) FROM public.sites;
--    -> doit lever une erreur "permission denied for table sites"
--    RESET ROLE;
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 4. Peuplement initial — les 3 sites du MOM
-- ----------------------------------------------------------------------------
-- Sources :
--   - Site officiel MOM Rugby (momrugby.fr/club-rugby-molsheim-mutzig/nos-terrains/)
--   - Répertoire FFR des installations sportives
--   - Mairie de Mutzig + Mairie de Molsheim
--   - Historique du club : "le stade René Brencklé et son club house attenant"
--
-- Choix sémantique : le clubhouse est gardé en fiche distincte de Brencklé
-- (même adresse) car il a un usage différent (vestiaires, 3ème mi-temps,
-- réunions, soirées). Les deux sites partagent la même parcelle et donc
-- la même latitude/longitude (distance interne = 0, dûment notée).
--
-- Coordonnées GPS estimées depuis OpenStreetMap (précision ~50m), à affiner
-- ultérieurement par capture GPS in situ via app mobile.

INSERT INTO public.sites (
    code, libelle, libelle_court,
    adresse, code_postal, ville, pays,
    latitude, longitude,
    club_principal_id, type_site,
    notes, actif
)
VALUES
    -- Site 1 : Stade René Brencklé (terrain principal, Mutzig)
    (
        'site-mom-brenckle',
        'Stade René Brencklé',
        'Brencklé',
        'Route des Loisirs',
        '67190',
        'Mutzig',
        'France',
        48.535000,
        7.477000,
        (SELECT id FROM public.clubs WHERE code = 'club-mom'),
        'stade',
        'Terrain principal du MOM. Géré par la municipalité de Mutzig, mis à disposition du club. Surface 7 700 m², parking 30 places. Accueille les M14, M16, M18, féminines, Touch et Seniors. Adjacent à la piscine couverte de Mutzig.',
        TRUE
    ),

    -- Site 2 : Clubhouse (bâtiment attenant à Brencklé)
    (
        'site-mom-clubhouse',
        'Clubhouse MOM',
        'Clubhouse',
        'Route des Loisirs',
        '67190',
        'Mutzig',
        'France',
        48.535000,
        7.477000,
        (SELECT id FROM public.clubs WHERE code = 'club-mom'),
        'complexe_sportif',
        'Bâtiment attenant au stade Brencklé. Vestiaires, salle de réunion, espace 3ème mi-temps et soirées du club. Même parcelle que Brencklé (distance = 0).',
        TRUE
    ),

    -- Site 3 : Stade du Holtzplatz (terrain EDR, Molsheim)
    (
        'site-mom-holtzplatz',
        'Stade Municipal Holtzplatz',
        'Holtzplatz',
        'Rue des Sports',
        '67120',
        'Molsheim',
        'France',
        48.541000,
        7.490000,
        (SELECT id FROM public.clubs WHERE code = 'club-mom'),
        'stade',
        'Terrain EDR du MOM (M6 à M12). Géré par la municipalité de Molsheim, partagé avec La Sportive Molsheim (football) et les Archanges (football américain). Référencé au répertoire FFR des installations sportives.',
        TRUE
    )
ON CONFLICT (code) DO NOTHING;  -- idempotence : ré-exécution sans dégât


-- ============================================================================
-- Vérification post-peuplement
-- ============================================================================
--
-- SELECT code, libelle, ville, latitude, longitude, type_site, actif
-- FROM public.sites
-- ORDER BY code;
--
-- -> doit retourner 3 lignes (Brencklé, Clubhouse, Holtzplatz).
-- ============================================================================
