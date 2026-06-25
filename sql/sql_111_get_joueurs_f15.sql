-- ============================================================
-- sql_111_get_joueurs_f15.sql
-- ------------------------------------------------------------
-- Chantier : JOUEURS-PERIMETRE-F15 (pt 109)
--
-- PROBLÈME (recette terrain, capture image 4) :
--   Sélectionner la catégorie F15 dans « Mes Joueurs » affiche
--   l'effectif M14 complet (62 joueurs), pas les féminines F15.
--
--   Cause racine (DS-1, sources lues) : l'écran Joueurs charge
--   l'effectif PAR ÉQUIPE (get_joueurs_equipe via une boucle sur
--   les équipes de la catégorie active). Or F15 (categories.id =
--   a948997c-255a-430d-88f3-e33cd8782240) n'a AUCUNE équipe
--   rattachée : les féminines F15 sont membres de l'équipe M14.
--   La résolution d'équipes renvoie alors [] et le code front
--   retombe sur le REPLI [M14_TEAM_UUID] → effectif M14 affiché.
--
-- MODÈLE DE DONNÉES (sondé) :
--   F15 n'est pas une catégorie « à équipe », c'est un périmètre
--   transversal porté par le flag personnes.f15_integree (boolean).
--   Décision Manu : périmètre F15 = f15_integree = TRUE, SEUL
--   (la branche d'âge a été écartée : elle réintroduisait des
--   joueuses plus âgées non intégrées — Lya MOSSER, Shaina
--   NADJIDE IDI, Soa NOLL, Chloé ROUSSOS).
--   Source = personnes (option B) : une F15 flaggée mais rattachée
--   à AUCUNE équipe (cas Auriane DECOURCELLE, 0 rattachement) doit
--   tout de même apparaître → LEFT JOIN equipe_joueurs, pas INNER.
--
-- SOLUTION :
--   RPC get_joueurs_f15() — JUMELLE de get_joueurs_equipe :
--   STRICTEMENT la même signature de sortie (32 colonnes, mêmes
--   types, mêmes CASE profil/etat_calcule) pour que le front et
--   les cartes restent inchangés. SEULES DIFFÉRENCES :
--     - FROM personnes p (au lieu de FROM equipe_joueurs ej)
--     - LEFT JOIN equipe_joueurs (au lieu de la borne ej.equipe_id)
--     - WHERE p.f15_integree = TRUE
--   Les colonnes ej_* sont conservées (issues du rattachement s'il
--   existe, NULL sinon — dégradation honnête pour les non-rattachées).
--
-- SÉCURITÉ : aligné EXACTEMENT sur get_joueurs_equipe (sondé) —
--   SECURITY DEFINER, owner postgres, EXECUTE pour authenticated,
--   REVOKE public/anon. Pas plus permissif, pas plus restrictif.
--   (Doctrine MOM Hub : lecture ouverte à tout authentifié, n'expose
--   que des données déjà destinées à l'écran ; cf. get_noms_personnes.)
--
-- Idempotent : CREATE OR REPLACE. Aucune donnée modifiée.
-- DS-1 : corps recopié depuis pg_get_functiondef(get_joueurs_equipe)
--   lu à la source (Supabase), colonnes NON devinées.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_joueurs_f15()
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
  -- LEFT JOIN : une F15 flaggée mais non rattachée à une équipe
  -- (ex. Auriane DECOURCELLE) DOIT apparaître. On prend au plus un
  -- rattachement actif (le plus récent par date_affectation) pour
  -- que les colonnes ej_* soient déterministes et qu'une joueuse
  -- présente dans 2 équipes n'apparaisse pas en double.
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
  WHERE p.f15_integree = TRUE
  ORDER BY p.nom, p.prenom;
$function$;

-- Privilèges : alignés EXACTEMENT sur get_joueurs_equipe (sondé :
-- authenticated = TRUE, anon = FALSE, owner postgres).
REVOKE ALL ON FUNCTION public.get_joueurs_f15() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_joueurs_f15() TO authenticated;

-- ------------------------------------------------------------
-- VÉRIFICATION fail-loud (idempotente, lecture seule).
-- Échoue bruyamment si la fonction n'est pas exécutable par
-- authenticated, ou si la signature de sortie a dérivé de la
-- jumelle get_joueurs_equipe (garde-fou anti-régression).
-- ------------------------------------------------------------
DO $verif$
DECLARE
  v_exec_auth boolean;
  v_exec_anon boolean;
  v_secdef    boolean;
  v_nb_cols_f15  integer;
  v_nb_cols_eq   integer;
BEGIN
  -- 1. Existence + droits
  SELECT has_function_privilege('authenticated', oid, 'EXECUTE'),
         has_function_privilege('anon', oid, 'EXECUTE'),
         prosecdef
    INTO v_exec_auth, v_exec_anon, v_secdef
    FROM pg_proc
   WHERE proname = 'get_joueurs_f15'
     AND pronamespace = 'public'::regnamespace
     AND prokind = 'f';

  IF v_exec_auth IS NULL THEN
    RAISE EXCEPTION 'get_joueurs_f15 absente après CREATE OR REPLACE';
  END IF;
  IF v_exec_auth IS NOT TRUE THEN
    RAISE EXCEPTION 'get_joueurs_f15 : authenticated ne peut pas EXECUTE (attendu TRUE)';
  END IF;
  IF v_exec_anon IS NOT FALSE THEN
    RAISE EXCEPTION 'get_joueurs_f15 : anon peut EXECUTE (attendu FALSE, alignement get_joueurs_equipe)';
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'get_joueurs_f15 : SECURITY DEFINER attendu';
  END IF;

  -- 2. Parité du nombre de COLONNES DE SORTIE avec la jumelle.
  --    On compte les colonnes OUT (proargmodes 't'/'o' = TABLE/OUT) des
  --    deux fonctions ; elles doivent être identiques (32). Robuste au
  --    fait que get_joueurs_f15 a 0 arg d'entrée et get_joueurs_equipe 1.
  SELECT count(*) INTO v_nb_cols_f15
    FROM pg_proc p, unnest(p.proargmodes) AS m
   WHERE p.proname='get_joueurs_f15' AND p.pronamespace='public'::regnamespace AND p.prokind='f'
     AND m IN ('t','o','b');
  SELECT count(*) INTO v_nb_cols_eq
    FROM pg_proc p, unnest(p.proargmodes) AS m
   WHERE p.proname='get_joueurs_equipe' AND p.pronamespace='public'::regnamespace AND p.prokind='f'
     AND m IN ('t','o','b');
  IF v_nb_cols_eq IS NOT NULL AND v_nb_cols_eq > 0
     AND v_nb_cols_f15 IS DISTINCT FROM v_nb_cols_eq THEN
    RAISE EXCEPTION 'get_joueurs_f15 : % colonnes OUT vs get_joueurs_equipe % — signatures divergentes',
      v_nb_cols_f15, v_nb_cols_eq;
  END IF;

  RAISE NOTICE 'sql_111 OK : get_joueurs_f15 créée, SECURITY DEFINER, EXECUTE=authenticated, signature alignée.';
END
$verif$;
