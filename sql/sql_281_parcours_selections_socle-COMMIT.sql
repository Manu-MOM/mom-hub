-- =====================================================================
-- sql_281 — PARCOURS-PERFORMANCE v1.3, lot L5 : socle Sélections
-- ---------------------------------------------------------------------
-- FAIT FOI : FAIT-FOI-PARCOURS-PERFORMANCE-v1.3.md (gelé par Manu le
-- 21/11/2026, « je gèle »), décisions D13 à D22.
--
-- Contenu :
--   1. Table parcours_convocation (l'évènement, D14).
--   2. Table parcours_convocation_joueur (statut par joueur, D15).
--   3. parcours_performance_match.convocation_id (D16), FK RESTRICT :
--      une convocation qui a des matchs ne se supprime pas.
--   4. Clé de match D17 : _pp_cle_match_sel(date, adversaire, phase).
--      Phase ajoutée à la clé SEULEMENT pour un match de sélection.
--      Les 26 participations existantes gardent leur clé.
--   5. RPC convocations : list_parcours_candidats,
--      list_parcours_convocations, list_parcours_convocation_joueurs,
--      upsert_parcours_convocation, set_parcours_convocation_joueurs,
--      delete_parcours_convocation.
--   6. RPC de match modifiées (DROP puis CREATE, jamais de surcharge) :
--      list_parcours_matchs renvoie convocation_id (en dernière colonne) ;
--      upsert_parcours_match reçoit p_convocation_id (DEFAULT NULL :
--      l'appel actuel du front, sans ce paramètre, reste valable).
--   7. Droits : REVOKE PUBLIC/anon, GRANT authenticated + service_role.
--   8. Vérification fail-loud, dont non-régression chiffrée des
--      participations existantes (empreinte avant / après).
--
-- Sondes DS-1 (21/11/2026, lecture seule) : colonnes et contraintes des
-- 2 tables existantes ; définitions de _pp_cle_match, _pp_saison_active,
-- list_parcours_matchs, upsert_parcours_match, get_joueurs_categorie ;
-- droits actuels (anon refusé, authenticated + service_role autorisés) ;
-- ententes (categorie_id, saison_id), collectif_membre (entente_id,
-- role, statut, date_fin) ; ENTENTE-M14-2026-2027 = 64 joueurs.
-- Empreinte des 26 participations : md5 0edccaf9783371445c6248e17dd61a70.
--
-- Choix techniques tracés (délégation, non structurants) :
--   - candidats d'une convocation = joueurs du collectif de l'entente de
--     la catégorie pour la saison (D13), lus en base ;
--   - garde d'appartenance au moment de convoquer : catégorie de la fiche
--     (personnes.categorie_id), comme upsert_parcours_match ;
--   - la date d'un match de sélection doit tomber dans les dates de sa
--     convocation ; un changement de dates de convocation qui exclurait
--     un match déjà saisi est refusé ;
--   - un joueur qui a un match dans la convocation ne peut ni être
--     retiré de la liste ni passer « absent » ou « non retenu ».
--
-- Mode : COMMIT (identique au DRY-RUN hors tests, à appliquer uniquement
-- sur feu vert explicite de Manu). Dry-run vert le 21/11/2026 : VERIF OK
-- + 17 tests conformes (T1 à T17).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Empreinte des participations existantes (non-régression)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _pp_avant ON COMMIT DROP AS
SELECT
    count(*) AS n,
    md5(string_agg(
        m.id::text || m.cle_match || coalesce(m.phase, '') || m.statut_joueur
        || m.essais || m.transformations || m.penalites || m.drops
        || coalesce(m.score_pour, -1) || coalesce(m.lieu, ''),
        ',' ORDER BY m.id
    )) AS h
FROM public.parcours_performance_match AS m;

-- ---------------------------------------------------------------------
-- 1. Table parcours_convocation (D14)
-- ---------------------------------------------------------------------
CREATE TABLE public.parcours_convocation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    categorie_id uuid NOT NULL REFERENCES public.categories (id),
    saison_id uuid NOT NULL REFERENCES public.saisons (id),
    type text NOT NULL,
    intitule text NOT NULL,
    date_debut date NOT NULL,
    date_fin date,
    lieu text,
    equipe text,
    organisateur text,
    notes text,
    cree_par uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pp_conv_type_check CHECK (
        type IN (
            'scf', 'interdep', 'tournoi', 'journee_bleue',
            'stage', 'detection', 'autre'
        )
    ),
    CONSTRAINT pp_conv_intitule_check CHECK (btrim(intitule) <> ''),
    CONSTRAINT pp_conv_dates_check CHECK (
        date_fin IS NULL OR date_fin >= date_debut
    )
);

CREATE INDEX pp_conv_cat_idx
ON public.parcours_convocation (categorie_id, saison_id);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.parcours_convocation
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.parcours_convocation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parcours_convocation FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.parcours_convocation IS
'Parcours Performance v1.3 : convocation en sélection (FAIT FOI v1.3 D14, sql_281). Accès via RPC uniquement.';

-- ---------------------------------------------------------------------
-- 2. Table parcours_convocation_joueur (D15)
-- ---------------------------------------------------------------------
CREATE TABLE public.parcours_convocation_joueur (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    convocation_id uuid NOT NULL
    REFERENCES public.parcours_convocation (id) ON DELETE CASCADE,
    personne_id uuid NOT NULL
    REFERENCES public.personnes (id) ON DELETE CASCADE,
    statut text NOT NULL,
    note text,
    cree_par uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pp_convj_statut_check CHECK (
        statut IN ('convoque', 'retenu', 'reserviste', 'absent', 'non_retenu')
    ),
    CONSTRAINT pp_convj_unique UNIQUE (convocation_id, personne_id)
);

CREATE INDEX pp_convj_personne_idx
ON public.parcours_convocation_joueur (personne_id);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.parcours_convocation_joueur
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.parcours_convocation_joueur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parcours_convocation_joueur FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.parcours_convocation_joueur IS
'Parcours Performance v1.3 : joueurs d''une convocation et leur statut (FAIT FOI v1.3 D15, sql_281). Accès via RPC uniquement.';

-- ---------------------------------------------------------------------
-- 3. Rattachement d'un match à sa convocation (D16)
-- ---------------------------------------------------------------------
ALTER TABLE public.parcours_performance_match
ADD COLUMN convocation_id uuid
REFERENCES public.parcours_convocation (id) ON DELETE RESTRICT;

CREATE INDEX pp_match_conv_idx
ON public.parcours_performance_match (convocation_id)
WHERE convocation_id IS NOT NULL;

COMMENT ON COLUMN public.parcours_performance_match.convocation_id IS
'v1.3 (D16) : convocation d''un match de sélection ; NULL = match en équipe Performance (club).';

-- ---------------------------------------------------------------------
-- 4. Clé de match D17
-- ---------------------------------------------------------------------
CREATE FUNCTION public._pp_cle_match_sel(
    p_date date, p_adversaire text, p_phase text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT public._pp_cle_match(p_date, p_adversaire)
         || CASE
              WHEN NULLIF(btrim(coalesce(p_phase, '')), '') IS NULL THEN ''
              ELSE '|' || lower(regexp_replace(btrim(p_phase), '\s+', ' ', 'g'))
            END;
$function$;

REVOKE ALL ON FUNCTION public._pp_cle_match_sel(date, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC convocations
-- ---------------------------------------------------------------------

-- 5.1 Candidats : joueurs du collectif de l'entente de la catégorie (D13)
CREATE FUNCTION public.list_parcours_candidats(
    p_categorie_id uuid, p_saison_id uuid DEFAULT NULL
)
RETURNS TABLE (personne_id uuid, nom text, prenom text, club text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
BEGIN
  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (p.nom, p.prenom, p.id) p.id, p.nom, p.prenom,
         (SELECT cl.nom_court FROM public.clubs cl WHERE cl.id = p.club_principal_id)
  FROM public.collectif_membre m
  JOIN public.ententes e ON e.id = m.entente_id
  JOIN public.personnes p ON p.id = m.personne_id
  WHERE e.categorie_id = p_categorie_id
    AND e.saison_id = v_saison
    AND m.role = 'joueur'
    AND (m.date_fin IS NULL OR m.date_fin >= CURRENT_DATE)
  ORDER BY p.nom, p.prenom, p.id;
END;
$function$;

-- 5.2 Convocations de la catégorie pour la saison, avec compteurs
CREATE FUNCTION public.list_parcours_convocations(
    p_categorie_id uuid, p_saison_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid, categorie_id uuid, saison_id uuid, type text, intitule text,
    date_debut date, date_fin date, lieu text, equipe text,
    organisateur text, notes text,
    nb_convoques bigint, nb_retenus bigint, nb_reservistes bigint,
    nb_absents bigint, nb_non_retenus bigint, nb_matchs bigint,
    updated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
BEGIN
  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.id, c.categorie_id, c.saison_id, c.type, c.intitule,
         c.date_debut, c.date_fin, c.lieu, c.equipe, c.organisateur, c.notes,
         (SELECT count(*) FROM public.parcours_convocation_joueur j
            WHERE j.convocation_id = c.id AND j.statut IN ('convoque', 'retenu', 'reserviste')),
         (SELECT count(*) FROM public.parcours_convocation_joueur j
            WHERE j.convocation_id = c.id AND j.statut = 'retenu'),
         (SELECT count(*) FROM public.parcours_convocation_joueur j
            WHERE j.convocation_id = c.id AND j.statut = 'reserviste'),
         (SELECT count(*) FROM public.parcours_convocation_joueur j
            WHERE j.convocation_id = c.id AND j.statut = 'absent'),
         (SELECT count(*) FROM public.parcours_convocation_joueur j
            WHERE j.convocation_id = c.id AND j.statut = 'non_retenu'),
         (SELECT count(DISTINCT mm.cle_match) FROM public.parcours_performance_match mm
            WHERE mm.convocation_id = c.id),
         c.updated_at
  FROM public.parcours_convocation c
  WHERE c.categorie_id = p_categorie_id
    AND c.saison_id = v_saison
  ORDER BY c.date_debut DESC, c.intitule;
END;
$function$;

-- 5.3 Joueurs de toutes les convocations de la catégorie pour la saison
CREATE FUNCTION public.list_parcours_convocation_joueurs(
    p_categorie_id uuid, p_saison_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid, convocation_id uuid, personne_id uuid, nom text, prenom text,
    club text, statut text, note text, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
BEGIN
  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT j.id, j.convocation_id, j.personne_id, p.nom, p.prenom,
         (SELECT cl.nom_court FROM public.clubs cl WHERE cl.id = p.club_principal_id),
         j.statut, j.note, j.updated_at
  FROM public.parcours_convocation_joueur j
  JOIN public.parcours_convocation c ON c.id = j.convocation_id
  JOIN public.personnes p ON p.id = j.personne_id
  WHERE c.categorie_id = p_categorie_id
    AND c.saison_id = v_saison
  ORDER BY c.date_debut DESC, p.nom, p.prenom;
END;
$function$;

-- 5.4 Création / modification d'une convocation
CREATE FUNCTION public.upsert_parcours_convocation(
    p_id uuid,
    p_categorie_id uuid,
    p_type text,
    p_intitule text,
    p_date_debut date,
    p_date_fin date DEFAULT NULL,
    p_lieu text DEFAULT NULL,
    p_equipe text DEFAULT NULL,
    p_organisateur text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS SETOF public.parcours_convocation
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cat uuid;
  v_saison uuid;
  v_moi uuid;
  v_fin date;
  v_hors int;
BEGIN
  IF p_id IS NULL THEN
    v_cat := p_categorie_id;
  ELSE
    SELECT c.categorie_id INTO v_cat FROM public.parcours_convocation c WHERE c.id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Convocation % introuvable', p_id USING ERRCODE = '02000';
    END IF;
    IF p_categorie_id IS NOT NULL AND p_categorie_id <> v_cat THEN
      RAISE EXCEPTION 'La catégorie d''une convocation ne se change pas' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('scf', 'interdep', 'tournoi', 'journee_bleue',
                                      'stage', 'detection', 'autre') THEN
    RAISE EXCEPTION 'Type de convocation invalide' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(coalesce(p_intitule, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Intitulé obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_date_debut IS NULL THEN
    RAISE EXCEPTION 'Date de début obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_date_fin IS NOT NULL AND p_date_fin < p_date_debut THEN
    RAISE EXCEPTION 'La date de fin précède la date de début' USING ERRCODE = '22023';
  END IF;
  v_fin := coalesce(p_date_fin, p_date_debut);

  -- Saison = saison dont la plage contient la date de début ; sinon saison active
  SELECT s.id INTO v_saison FROM public.saisons s
  WHERE p_date_debut BETWEEN s.date_debut AND coalesce(s.date_fin, 'infinity'::date)
  ORDER BY s.date_debut DESC LIMIT 1;
  v_saison := coalesce(v_saison, public._pp_saison_active());
  IF v_saison IS NULL THEN
    RAISE EXCEPTION 'Aucune saison pour la date %', p_date_debut USING ERRCODE = '22023';
  END IF;

  SELECT q.personne_id INTO v_moi FROM public.qui_suis_je() q LIMIT 1;

  IF p_id IS NOT NULL THEN
    SELECT count(*) INTO v_hors FROM public.parcours_performance_match m
    WHERE m.convocation_id = p_id
      AND (m.date_match < p_date_debut OR m.date_match > v_fin);
    IF v_hors > 0 THEN
      RAISE EXCEPTION 'Nouvelles dates refusées : % participation(s) de match tomberaient hors de la convocation', v_hors
        USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    UPDATE public.parcours_convocation c
    SET saison_id = v_saison, type = p_type, intitule = btrim(p_intitule),
        date_debut = p_date_debut, date_fin = p_date_fin,
        lieu = NULLIF(btrim(p_lieu), ''), equipe = NULLIF(btrim(p_equipe), ''),
        organisateur = NULLIF(btrim(p_organisateur), ''), notes = NULLIF(btrim(p_notes), '')
    WHERE c.id = p_id
    RETURNING c.*;
  ELSE
    RETURN QUERY
    INSERT INTO public.parcours_convocation AS c
      (categorie_id, saison_id, type, intitule, date_debut, date_fin,
       lieu, equipe, organisateur, notes, cree_par)
    VALUES
      (v_cat, v_saison, p_type, btrim(p_intitule), p_date_debut, p_date_fin,
       NULLIF(btrim(p_lieu), ''), NULLIF(btrim(p_equipe), ''),
       NULLIF(btrim(p_organisateur), ''), NULLIF(btrim(p_notes), ''), v_moi)
    RETURNING c.*;
  END IF;
END;
$function$;

-- 5.5 Liste des joueurs d'une convocation (remplacement complet, D15)
--     p_joueurs = [{"personne_id": "...", "statut": "retenu", "note": "..."}, ...]
CREATE FUNCTION public.set_parcours_convocation_joueurs(
    p_convocation_id uuid, p_joueurs jsonb
)
RETURNS SETOF public.parcours_convocation_joueur
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cat uuid;
  v_moi uuid;
  v_bad text;
BEGIN
  IF p_convocation_id IS NULL THEN
    RAISE EXCEPTION 'p_convocation_id requis' USING ERRCODE = '22023';
  END IF;
  SELECT c.categorie_id INTO v_cat FROM public.parcours_convocation c WHERE c.id = p_convocation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convocation % introuvable', p_convocation_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF p_joueurs IS NULL OR jsonb_typeof(p_joueurs) <> 'array' THEN
    RAISE EXCEPTION 'p_joueurs doit être une liste' USING ERRCODE = '22023';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _pp_convj_saisie (
    personne_id uuid, statut text, note text
  ) ON COMMIT DROP;
  TRUNCATE _pp_convj_saisie;
  INSERT INTO _pp_convj_saisie
  SELECT (x ->> 'personne_id')::uuid, x ->> 'statut', NULLIF(btrim(x ->> 'note'), '')
  FROM jsonb_array_elements(p_joueurs) AS x;

  IF EXISTS (SELECT 1 FROM _pp_convj_saisie WHERE personne_id IS NULL) THEN
    RAISE EXCEPTION 'personne_id manquant dans la liste' USING ERRCODE = '22023';
  END IF;
  SELECT string_agg(DISTINCT coalesce(statut, 'NULL'), ', ') INTO v_bad FROM _pp_convj_saisie
  WHERE statut IS NULL OR statut NOT IN ('convoque', 'retenu', 'reserviste', 'absent', 'non_retenu');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Statut invalide : %', v_bad USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM _pp_convj_saisie GROUP BY personne_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Un joueur figure deux fois dans la liste' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM _pp_convj_saisie WHERE length(note) > 200) THEN
    RAISE EXCEPTION 'Note trop longue (200 caractères maximum)' USING ERRCODE = '22023';
  END IF;

  -- Appartenance à la catégorie de la convocation
  SELECT string_agg(coalesce(p.prenom || ' ' || p.nom, s.personne_id::text), ', ') INTO v_bad
  FROM _pp_convj_saisie s LEFT JOIN public.personnes p ON p.id = s.personne_id
  WHERE p.id IS NULL OR p.categorie_id IS DISTINCT FROM v_cat;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Joueur(s) hors de la catégorie de la convocation : %', v_bad USING ERRCODE = '22023';
  END IF;

  -- Un joueur qui a un match dans la convocation reste convoqué, retenu ou réserviste
  SELECT string_agg(DISTINCT p.prenom || ' ' || p.nom, ', ') INTO v_bad
  FROM public.parcours_performance_match m
  JOIN public.personnes p ON p.id = m.personne_id
  LEFT JOIN _pp_convj_saisie s ON s.personne_id = m.personne_id
  WHERE m.convocation_id = p_convocation_id
    AND (s.personne_id IS NULL OR s.statut NOT IN ('convoque', 'retenu', 'reserviste'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Ont un match dans cette convocation (statut convoqué, retenu ou réserviste requis) : %', v_bad
      USING ERRCODE = '23503';
  END IF;

  SELECT q.personne_id INTO v_moi FROM public.qui_suis_je() q LIMIT 1;

  DELETE FROM public.parcours_convocation_joueur j
  WHERE j.convocation_id = p_convocation_id
    AND NOT EXISTS (SELECT 1 FROM _pp_convj_saisie s WHERE s.personne_id = j.personne_id);

  INSERT INTO public.parcours_convocation_joueur AS j
    (convocation_id, personne_id, statut, note, cree_par)
  SELECT p_convocation_id, s.personne_id, s.statut, s.note, v_moi
  FROM _pp_convj_saisie s
  ON CONFLICT (convocation_id, personne_id) DO UPDATE
    SET statut = EXCLUDED.statut, note = EXCLUDED.note;

  RETURN QUERY
  SELECT j.* FROM public.parcours_convocation_joueur j
  WHERE j.convocation_id = p_convocation_id;
END;
$function$;

-- 5.6 Suppression d'une convocation (refusée si elle a des matchs)
CREATE FUNCTION public.delete_parcours_convocation(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cat uuid;
  v_n int;
BEGIN
  SELECT c.categorie_id INTO v_cat FROM public.parcours_convocation c WHERE c.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convocation % introuvable', p_id USING ERRCODE = '02000';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  SELECT count(DISTINCT m.cle_match) INTO v_n
  FROM public.parcours_performance_match m WHERE m.convocation_id = p_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Cette convocation a % match(s) : supprime-les d''abord', v_n USING ERRCODE = '23503';
  END IF;
  DELETE FROM public.parcours_convocation c WHERE c.id = p_id;
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. RPC de match (DROP puis CREATE : signature / colonnes modifiées)
-- ---------------------------------------------------------------------
DROP FUNCTION public.list_parcours_matchs(uuid, uuid, uuid);

CREATE FUNCTION public.list_parcours_matchs(
    p_categorie_id uuid, p_saison_id uuid DEFAULT NULL, p_personne_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid, personne_id uuid, nom text, prenom text, saison_id uuid,
    date_match date, competition text, phase text, equipe_accueil text,
    adversaire text, lieu text, score_pour smallint, score_contre smallint,
    statut_joueur text, numero smallint, capitaine boolean, essais smallint,
    transformations smallint, penalites smallint, drops smallint,
    points integer, source text, notes text, updated_at timestamptz,
    convocation_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison uuid := coalesce(p_saison_id, public._pp_saison_active());
BEGIN
  IF p_categorie_id IS NULL THEN
    RAISE EXCEPTION 'p_categorie_id requis' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_lire_categorie(p_categorie_id)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.id, m.personne_id, p.nom, p.prenom, m.saison_id, m.date_match,
         m.competition, m.phase, m.equipe_accueil, m.adversaire, m.lieu,
         m.score_pour, m.score_contre, m.statut_joueur, m.numero, m.capitaine,
         m.essais, m.transformations, m.penalites, m.drops,
         (m.essais * 5 + m.transformations * 2 + m.penalites * 3 + m.drops * 3)::integer,
         m.source, m.notes, m.updated_at, m.convocation_id
  FROM public.parcours_performance_match m
  JOIN public.personnes p ON p.id = m.personne_id
  WHERE m.categorie_id = p_categorie_id
    AND m.saison_id = v_saison
    AND (p_personne_id IS NULL OR m.personne_id = p_personne_id)
  ORDER BY m.date_match DESC, p.nom, p.prenom;
END;
$function$;

DROP FUNCTION public.upsert_parcours_match(
    uuid, uuid, date, text, text, text, text, smallint, smallint, text,
    smallint, boolean, smallint, smallint, smallint, smallint, text, text, text
);

CREATE FUNCTION public.upsert_parcours_match(
    p_id uuid,
    p_personne_id uuid,
    p_date_match date,
    p_competition text,
    p_phase text,
    p_equipe_accueil text,
    p_adversaire text,
    p_score_pour smallint,
    p_score_contre smallint,
    p_statut_joueur text,
    p_numero smallint,
    p_capitaine boolean,
    p_essais smallint,
    p_transformations smallint,
    p_penalites smallint,
    p_drops smallint,
    p_source text DEFAULT 'manuel',
    p_notes text DEFAULT NULL,
    p_lieu text DEFAULT NULL,
    p_convocation_id uuid DEFAULT NULL
)
RETURNS SETOF public.parcours_performance_match
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_personne uuid;
  v_cat uuid;
  v_saison uuid;
  v_moi uuid;
  v_cle text;
  v_conv public.parcours_convocation%ROWTYPE;
  v_statut text := coalesce(p_statut_joueur, 'titulaire');
  v_ess smallint := coalesce(p_essais, 0);
  v_tra smallint := coalesce(p_transformations, 0);
  v_pen smallint := coalesce(p_penalites, 0);
  v_dro smallint := coalesce(p_drops, 0);
BEGIN
  IF p_id IS NULL THEN
    v_personne := p_personne_id;
  ELSE
    SELECT m.personne_id INTO v_personne FROM public.parcours_performance_match m WHERE m.id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Participation % introuvable', p_id USING ERRCODE = '02000';
    END IF;
    IF p_personne_id IS NOT NULL AND p_personne_id <> v_personne THEN
      RAISE EXCEPTION 'Participation % rattachée à une autre personne', p_id USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_personne IS NULL THEN
    RAISE EXCEPTION 'p_personne_id requis' USING ERRCODE = '22023';
  END IF;
  SELECT p.categorie_id INTO v_cat FROM public.personnes p WHERE p.id = v_personne;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personne % introuvable', v_personne USING ERRCODE = '02000';
  END IF;
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'Le joueur n''a pas de catégorie' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_role('admin') OR public.has_role('bureau')
          OR public.puis_je_ecrire_categorie(v_cat)) THEN
    RAISE EXCEPTION 'Droit insuffisant' USING ERRCODE = '42501';
  END IF;
  IF p_date_match IS NULL THEN
    RAISE EXCEPTION 'Date du match obligatoire' USING ERRCODE = '22023';
  END IF;
  IF v_statut NOT IN ('titulaire', 'entre', 'non_entre') THEN
    RAISE EXCEPTION 'Statut joueur invalide (titulaire | entre | non_entre)' USING ERRCODE = '22023';
  END IF;
  IF p_lieu IS NOT NULL AND p_lieu NOT IN ('domicile', 'exterieur', 'neutre') THEN
    RAISE EXCEPTION 'Lieu invalide (domicile | exterieur | neutre)' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_source, 'manuel') NOT IN ('ffr', 'manuel') THEN
    RAISE EXCEPTION 'Source invalide (ffr | manuel)' USING ERRCODE = '22023';
  END IF;

  -- v1.3 (D16) : match de sélection rattaché à sa convocation
  IF p_convocation_id IS NOT NULL THEN
    SELECT * INTO v_conv FROM public.parcours_convocation c WHERE c.id = p_convocation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Convocation % introuvable', p_convocation_id USING ERRCODE = '02000';
    END IF;
    IF v_conv.categorie_id <> v_cat THEN
      RAISE EXCEPTION 'Le joueur n''est pas dans la catégorie de la convocation' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.parcours_convocation_joueur j
                   WHERE j.convocation_id = p_convocation_id AND j.personne_id = v_personne
                     AND j.statut IN ('convoque', 'retenu', 'reserviste')) THEN
      RAISE EXCEPTION 'Le joueur n''est ni convoqué, ni retenu, ni réserviste sur cette convocation'
        USING ERRCODE = '22023';
    END IF;
    IF p_date_match < v_conv.date_debut
       OR p_date_match > coalesce(v_conv.date_fin, v_conv.date_debut) THEN
      RAISE EXCEPTION 'La date du match est hors des dates de la convocation' USING ERRCODE = '22023';
    END IF;
    IF coalesce(p_source, 'manuel') <> 'manuel' THEN
      RAISE EXCEPTION 'Match de sélection : saisie manuelle uniquement' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- D7 : un joueur qui marque est compté entré, même sans changement enregistré
  IF v_statut = 'non_entre' AND (v_ess + v_tra + v_pen + v_dro) > 0 THEN
    v_statut := 'entre';
  END IF;

  -- Saison = saison dont la plage contient la date ; sinon saison active
  SELECT s.id INTO v_saison FROM public.saisons s
  WHERE p_date_match BETWEEN s.date_debut AND coalesce(s.date_fin, 'infinity'::date)
  ORDER BY s.date_debut DESC LIMIT 1;
  v_saison := coalesce(v_saison, public._pp_saison_active());
  IF v_saison IS NULL THEN
    RAISE EXCEPTION 'Aucune saison pour la date %', p_date_match USING ERRCODE = '22023';
  END IF;

  -- D17 : la phase n'entre dans la clé que pour un match de sélection
  v_cle := public._pp_cle_match_sel(
    p_date_match, p_adversaire,
    CASE WHEN p_convocation_id IS NOT NULL THEN p_phase END);
  SELECT q.personne_id INTO v_moi FROM public.qui_suis_je() q LIMIT 1;

  IF p_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE public.parcours_performance_match m
    SET saison_id = v_saison, categorie_id = v_cat, date_match = p_date_match,
        competition = NULLIF(btrim(p_competition), ''), phase = NULLIF(btrim(p_phase), ''),
        equipe_accueil = NULLIF(btrim(p_equipe_accueil), ''), adversaire = NULLIF(btrim(p_adversaire), ''),
        lieu = p_lieu,
        score_pour = p_score_pour, score_contre = p_score_contre,
        statut_joueur = v_statut, numero = p_numero, capitaine = coalesce(p_capitaine, false),
        essais = v_ess, transformations = v_tra, penalites = v_pen, drops = v_dro,
        source = coalesce(p_source, 'manuel'), cle_match = v_cle, notes = NULLIF(btrim(p_notes), ''),
        convocation_id = p_convocation_id
    WHERE m.id = p_id
    RETURNING m.*;
  ELSE
    -- D8 : réimport sans doublon (même joueur, même clé)
    RETURN QUERY
    INSERT INTO public.parcours_performance_match AS m
      (personne_id, saison_id, categorie_id, date_match, competition, phase,
       equipe_accueil, adversaire, lieu, score_pour, score_contre, statut_joueur, numero,
       capitaine, essais, transformations, penalites, drops, source, cle_match, notes, cree_par,
       convocation_id)
    VALUES
      (v_personne, v_saison, v_cat, p_date_match, NULLIF(btrim(p_competition), ''),
       NULLIF(btrim(p_phase), ''), NULLIF(btrim(p_equipe_accueil), ''),
       NULLIF(btrim(p_adversaire), ''), p_lieu, p_score_pour, p_score_contre, v_statut, p_numero,
       coalesce(p_capitaine, false), v_ess, v_tra, v_pen, v_dro,
       coalesce(p_source, 'manuel'), v_cle, NULLIF(btrim(p_notes), ''), v_moi,
       p_convocation_id)
    ON CONFLICT (personne_id, cle_match) DO UPDATE
      SET saison_id = EXCLUDED.saison_id, categorie_id = EXCLUDED.categorie_id,
          competition = EXCLUDED.competition, phase = EXCLUDED.phase,
          equipe_accueil = EXCLUDED.equipe_accueil, adversaire = EXCLUDED.adversaire,
          lieu = EXCLUDED.lieu,
          score_pour = EXCLUDED.score_pour, score_contre = EXCLUDED.score_contre,
          statut_joueur = EXCLUDED.statut_joueur, numero = EXCLUDED.numero,
          capitaine = EXCLUDED.capitaine, essais = EXCLUDED.essais,
          transformations = EXCLUDED.transformations, penalites = EXCLUDED.penalites,
          drops = EXCLUDED.drops, source = EXCLUDED.source, notes = EXCLUDED.notes,
          convocation_id = EXCLUDED.convocation_id
    RETURNING m.*;
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------
-- 7. Droits
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.list_parcours_candidats(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_parcours_convocations(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_parcours_convocation_joueurs(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_parcours_convocation(
    uuid, uuid, text, text, date, date, text, text, text, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_parcours_convocation_joueurs(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_parcours_convocation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_parcours_matchs(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_parcours_match(
    uuid, uuid, date, text, text, text, text, smallint, smallint, text,
    smallint, boolean, smallint, smallint, smallint, smallint, text, text, text, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_parcours_candidats(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_parcours_convocations(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_parcours_convocation_joueurs(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_parcours_convocation(
    uuid, uuid, text, text, date, date, text, text, text, text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_parcours_convocation_joueurs(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_parcours_convocation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_parcours_matchs(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_parcours_match(
    uuid, uuid, date, text, text, text, text, smallint, smallint, text,
    smallint, boolean, smallint, smallint, smallint, smallint, text, text, text, uuid
) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. Vérification fail-loud
-- ---------------------------------------------------------------------
DO $verif$
DECLARE
  v_n int;
  v_h text;
  v_avant record;
BEGIN
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relrowsecurity
    AND c.relname IN ('parcours_convocation', 'parcours_convocation_joueur');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: RLS non active sur les 2 nouvelles tables (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('parcours_convocation', 'parcours_convocation_joueur');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: policies inattendues (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND p.proname IN ('list_parcours_candidats', 'list_parcours_convocations',
                      'list_parcours_convocation_joueurs', 'upsert_parcours_convocation',
                      'set_parcours_convocation_joueurs', 'delete_parcours_convocation',
                      'list_parcours_matchs', 'upsert_parcours_match');
  IF v_n <> 8 THEN RAISE EXCEPTION 'VERIF: 8 RPC SECURITY DEFINER attendues (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('list_parcours_matchs', 'upsert_parcours_match');
  IF v_n <> 2 THEN RAISE EXCEPTION 'VERIF: surcharge de RPC de match (% fonctions)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('list_parcours_candidats', 'list_parcours_convocations',
                      'list_parcours_convocation_joueurs', 'upsert_parcours_convocation',
                      'set_parcours_convocation_joueurs', 'delete_parcours_convocation',
                      'list_parcours_matchs', 'upsert_parcours_match')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % RPC exécutable(s) par anon', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('list_parcours_candidats', 'list_parcours_convocations',
                      'list_parcours_convocation_joueurs', 'upsert_parcours_convocation',
                      'set_parcours_convocation_joueurs', 'delete_parcours_convocation',
                      'list_parcours_matchs', 'upsert_parcours_match')
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF v_n <> 8 THEN RAISE EXCEPTION 'VERIF: droits authenticated/service_role incomplets (%)', v_n; END IF;

  IF public._pp_cle_match_sel('2026-11-15'::date, ' Moselle ', NULL)
     <> public._pp_cle_match('2026-11-15'::date, ' Moselle ') THEN
    RAISE EXCEPTION 'VERIF: clé sans phase différente de la clé historique';
  END IF;
  IF public._pp_cle_match_sel('2026-11-15'::date, ' Moselle ', '  Demi   finale ')
     <> '2026-11-15|moselle|demi finale' THEN
    RAISE EXCEPTION 'VERIF: clé avec phase incorrecte';
  END IF;

  SELECT * INTO v_avant FROM _pp_avant;
  SELECT md5(string_agg(
           m.id::text || m.cle_match || coalesce(m.phase, '') || m.statut_joueur
           || m.essais || m.transformations || m.penalites || m.drops
           || coalesce(m.score_pour, -1) || coalesce(m.lieu, ''),
           ',' ORDER BY m.id)), count(*)
    INTO v_h, v_n
  FROM public.parcours_performance_match m;
  IF v_n <> v_avant.n OR v_h <> v_avant.h THEN
    RAISE EXCEPTION 'VERIF: participations existantes modifiées (% -> %)', v_avant.n, v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.parcours_performance_match WHERE convocation_id IS NOT NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION 'VERIF: % participation(s) déjà rattachée(s)', v_n; END IF;

  RAISE NOTICE 'VERIF OK : 2 tables RLS sans policy, 8 RPC secdef sans surcharge, anon révoqué, clés D17, % participations inchangées', v_avant.n;
END;
$verif$;

COMMIT;
