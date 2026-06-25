-- ============================================================
-- sql_112_get_joueurs_categorie.sql
-- ------------------------------------------------------------
-- Chantier : JOUEURS-AFFICHAGE-PAR-CATEGORIE (pt 110)
--
-- PROBLÈME (sonde « effectif par catégorie », pt 110) :
--   L'écran « Mes Joueurs » charge l'effectif PAR ÉQUIPE
--   (boucle getJoueursEquipe sur les équipes de la catégorie).
--   Or M14 est la SEULE catégorie dont l'effectif passe par
--   equipe_joueurs (62 via équipe). Les 13 autres ont leurs
--   joueurs rattachés DIRECTEMENT à la catégorie
--   (personnes.categorie_id) mais SANS ligne equipe_joueurs :
--     M5=10, M6=15, M8=24, M10=28, M12=31, M16=18, M19=14,
--     F18=4, SR-M=63, SR-F=32 (RLO/RLSP=0, réellement vides).
--   → ~239 joueurs existaient en base, bien rattachés à leur
--   catégorie, mais INVISIBLES à l'écran.
--
-- DÉCISION (Manu) : voie B — afficher PAR CATÉGORIE
--   (personnes.categorie_id), source de vérité peuplée pour
--   les 14 catégories. M14 BASCULE AUSSI (voie unique).
--
-- SÉCURITÉ de la bascule M14 (sondée AVANT, DS-1) :
--   - Probe A : 1 seule personne dans categorie_id=M14 SANS
--     equipe_joueurs = Auriane DECOURCELLE (le « +1 » : 63 vs 62)
--     → apparaît légitimement après bascule.
--   - Probe B : 0 ligne — TOUS les joueurs de l'effectif équipe
--     M14 (62, partenaires SAR inclus) ont bien categorie_id=M14
--     → PERSONNE ne disparaît. Critère categorie_id seul suffit,
--     pas besoin d'unir avec la voie équipe.
--   - Probe C : 0 fiche suspecte sur les 14 catégories.
--
-- SOLUTION :
--   RPC get_joueurs_categorie(p_categorie_id uuid) — généralise
--   get_joueurs_f15 (sql_111) : MÊME sortie 32 colonnes, mêmes
--   JOINs, mêmes CASE profil/etat_calcule. SEULE DIFFÉRENCE :
--   WHERE p.categorie_id = p_categorie_id (au lieu du flag F15).
--
--   F15 N'EST PAS couverte par cette RPC : ses joueuses ont
--   categorie_id = M14 (pas F15), elles restent servies par
--   get_joueurs_f15() (flag). L'aiguillage front route F15 vers
--   la RPC flag, toute autre catégorie vers celle-ci.
--
-- SÉCURITÉ : aligné sur get_joueurs_f15 / get_joueurs_equipe —
--   SECURITY DEFINER, EXECUTE authenticated, REVOKE public ET anon
--   EXPLICITE (leçon pt 109 : les default privileges Supabase
--   accordent EXECUTE à anon directement, REVOKE FROM PUBLIC seul
--   ne le retire pas).
--
-- Idempotent : CREATE OR REPLACE. Aucune donnée modifiée.
-- DS-1 : corps recopié depuis get_joueurs_f15 (sql_111), lui-même
--   issu de pg_get_functiondef(get_joueurs_equipe) lu à la source.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_joueurs_categorie(p_categorie_id uuid)
 RETURNS TABLE(
   id uuid, nom text, prenom text, sexe text, date_naissance date,
   type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text,
   club_principal_id uuid, club_principal_code text, club_principal_nom_court text,
   categorie_id uuid, categorie_libelle_court text,
   pole_attache_id uuid, pole_libelle_court text,
   postes_uuids text[], aptitudes_uuids text[],
   taille_cm smallint, poids_g integer,
   indisponibilite text, blessure_resume text, suspension_jusqu_au date,
   ej_statut text, ej_niveau_profil text,
   ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text,
   ej_date_affectation date, ej_date_sortie date,
   profil text, etat_calcule text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.nom, p.prenom, p.sexe, p.date_naissance,
    p.type_personne, p.f15_integree, p.numero_licence_ffr, p.qualite_ffr,
    p.club_principal_id, cp.code, cp.nom_court,
    p.categorie_id, c.libelle_court,
    p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids,
    p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE
      WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur'          THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant'
           AND COALESCE(p.qualite_ffr, '') LIKE 'DC%'      THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur'           THEN 'staff'
      WHEN p.type_personne = 'licencie_competition'
           AND p.f15_integree = TRUE                       THEN 'f15'
      WHEN p.type_personne = 'licencie_competition'        THEN 'mom'
      ELSE 'autre'
    END AS profil,
    CASE
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      ELSE 'actif'
    END AS etat_calcule
  FROM personnes p
  -- LEFT JOIN : un joueur rattaché à la catégorie mais SANS équipe
  -- (cas majoritaire hors M14, ex. Auriane DECOURCELLE) DOIT
  -- apparaître. On prend au plus un rattachement actif (le plus
  -- récent par date_affectation) pour que les colonnes ej_* soient
  -- déterministes et qu'un joueur présent dans 2 équipes
  -- n'apparaisse pas en double.
  LEFT JOIN LATERAL (
    SELECT ej2.*
    FROM equipe_joueurs ej2
    WHERE ej2.personne_id = p.id
      AND (ej2.date_sortie IS NULL OR ej2.date_sortie >= CURRENT_DATE)
    ORDER BY ej2.date_affectation DESC NULLS LAST
    LIMIT 1
  ) ej ON TRUE
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE p.categorie_id = p_categorie_id
  ORDER BY p.nom, p.prenom;
$function$;

-- Privilèges : alignés sur get_joueurs_f15 / get_joueurs_equipe.
-- REVOKE anon EXPLICITE (leçon pt 109 : default privileges Supabase
-- accordent EXECUTE à anon directement ; REVOKE FROM PUBLIC seul ne
-- le retire pas).
REVOKE ALL ON FUNCTION public.get_joueurs_categorie(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_joueurs_categorie(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_joueurs_categorie(uuid) TO authenticated;

-- ------------------------------------------------------------
-- VÉRIFICATION fail-loud (idempotente, lecture seule).
-- ------------------------------------------------------------
DO $verif$
DECLARE
  v_exec_auth boolean;
  v_exec_anon boolean;
  v_secdef    boolean;
  v_nb_cols   integer;
  v_nb_cols_eq integer;
BEGIN
  SELECT has_function_privilege('authenticated', oid, 'EXECUTE'),
         has_function_privilege('anon', oid, 'EXECUTE'),
         prosecdef
    INTO v_exec_auth, v_exec_anon, v_secdef
    FROM pg_proc
   WHERE proname = 'get_joueurs_categorie'
     AND pronamespace = 'public'::regnamespace
     AND prokind = 'f';

  IF v_exec_auth IS NULL THEN
    RAISE EXCEPTION 'get_joueurs_categorie absente après CREATE OR REPLACE';
  END IF;
  IF v_exec_auth IS NOT TRUE THEN
    RAISE EXCEPTION 'get_joueurs_categorie : authenticated ne peut pas EXECUTE (attendu TRUE)';
  END IF;
  IF v_exec_anon IS NOT FALSE THEN
    RAISE EXCEPTION 'get_joueurs_categorie : anon peut EXECUTE (attendu FALSE)';
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'get_joueurs_categorie : SECURITY DEFINER attendu';
  END IF;

  -- Parité du nb de colonnes OUT avec get_joueurs_equipe (32).
  SELECT count(*) INTO v_nb_cols
    FROM pg_proc p, unnest(p.proargmodes) AS m
   WHERE p.proname='get_joueurs_categorie' AND p.pronamespace='public'::regnamespace AND p.prokind='f'
     AND m IN ('t','o','b');
  SELECT count(*) INTO v_nb_cols_eq
    FROM pg_proc p, unnest(p.proargmodes) AS m
   WHERE p.proname='get_joueurs_equipe' AND p.pronamespace='public'::regnamespace AND p.prokind='f'
     AND m IN ('t','o','b');
  IF v_nb_cols_eq IS NOT NULL AND v_nb_cols_eq > 0
     AND v_nb_cols IS DISTINCT FROM v_nb_cols_eq THEN
    RAISE EXCEPTION 'get_joueurs_categorie : % colonnes OUT vs get_joueurs_equipe % — signatures divergentes',
      v_nb_cols, v_nb_cols_eq;
  END IF;

  RAISE NOTICE 'sql_112 OK : get_joueurs_categorie créée, SECURITY DEFINER, EXECUTE=authenticated, signature alignée.';
END
$verif$;
