-- pt 209 (chantier EFFECTIF-ENCADRANTS-FONCTION-STAFF) : les encadrants d'une categorie
-- apparaissent desormais dans son Effectif (get_joueurs_categorie), via la table de liaison
-- fonction_staff (source de verite multi-categories), avec leur fonction exacte en badge.
--
-- CAUSE : get_joueurs_categorie ne listait que les personnes dont la fiche porte
--   categorie_id = <cat> (+ appartenance Loisirs). Les encadrants n'y figuraient que par
--   accident (categorie_id mal renseigne). categorie_id est UNIQUE -> incapable de gerer un
--   coach multi-categories. fonction_staff (personne x fonction x categorie, datee) est la
--   bonne source : 39 lignes actives, 4 fonctions, toutes avec categorie_id renseigne.
--
-- DECISIONS (Manu, gelees) :
--   D1 : TOUS les encadrants (Entraineur principal/adjoint, Referent de categorie, Manager).
--   D2 : badge = fonction exacte -> NOUVELLE colonne de retour `fonction_staff text`.
--   D3 : cohabitation joueur+coach : une personne peut sortir en 2 lignes (joueur ET coach)
--        dans une meme categorie -> UNION ALL sans dedoublonnage inter-branches (voulu).
--   D4 : categorie_id des fiches d'encadrants laisse tel quel (hors perimetre).
--
-- CONCEPTION (decisions mineures tracees) :
--   - Branche JOUEURS = requete existante STRICTEMENT inchangee, devient le membre gauche du
--     UNION ALL, avec fonction_staff = NULL.
--   - Branche ENCADRANTS = fonction_staff (date_fin IS NULL, categorie_id = p_categorie_id) :
--     profil = 'coach' (le badge fin vient de la colonne fonction_staff), etat_calcule = 'actif',
--     colonnes sans objet pour un coach (poste, taille, poids, ej_*, f15, licence joueur, club
--     provenance...) = NULL. On expose nom/prenom/sexe/date_naissance/type_personne/licence FFR
--     + categorie de la cible.
--   - Un coach avec 2 lignes fonction_staff DIFFERENTES dans la meme categorie sortirait en 2
--     lignes : accepte (rare ; chaque fonction = un badge). Le front peut afficher les deux.
--   - INTERDITS non touches ; get_vivier_compo* (pt 208) non touchees ; fonction_staff lu seul.
--
-- SIGNATURE : ajout d'une colonne `fonction_staff text` en FIN de RETURNS TABLE (additif ;
--   consommateurs verifies : js/supabase-client.js (wrapper passe-plat) et js/joueurs-browser.js
--   (lecture par nom de champ) — un champ supplementaire ne casse rien).
begin;

-- NB : ajout d'une colonne au RETURNS TABLE => changement de type de retour.
-- Postgres refuse CREATE OR REPLACE dans ce cas ("cannot change return type of
-- existing function") : on DROP puis CREATE dans la meme transaction. DROP sur
-- cette fonction ne rencontre aucune dependance bloquante (verifie : consommateurs
-- = wrappers/front cote client, pas d'objet SQL dependant).
drop function if exists public.get_joueurs_categorie(uuid);

create function public.get_joueurs_categorie(p_categorie_id uuid)
 returns table(id uuid, nom text, prenom text, sexe text, date_naissance date, type_personne text, f15_integree boolean, numero_licence_ffr text, qualite_ffr text, club_principal_id uuid, club_principal_code text, club_principal_nom_court text, categorie_id uuid, categorie_libelle_court text, pole_attache_id uuid, pole_libelle_court text, postes_uuids text[], aptitudes_uuids text[], taille_cm smallint, poids_g integer, indisponibilite text, blessure_resume text, suspension_jusqu_au date, ej_statut text, ej_niveau_profil text, ej_club_provenance_id uuid, ej_club_provenance_code text, ej_club_provenance_nom_court text, ej_date_affectation date, ej_date_sortie date, profil text, etat_calcule text, fonction_staff text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  -- ========================================================================
  -- BRANCHE JOUEURS (existante, inchangee) — fonction_staff = NULL
  -- ========================================================================
  WITH cat AS (
    SELECT c.id, c.type_categorie, c.type_licence_ffr,
           (c.type_categorie = 'Loisirs') AS est_loisirs
    FROM categories c
    WHERE c.id = p_categorie_id
  )
  SELECT
    p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr, p.club_principal_id, cp.code, cp.nom_court,
    p.categorie_id, c.libelle_court, p.pole_attache_id, po.libelle_court,
    p.postes_uuids, p.aptitudes_uuids, p.taille_cm, p.poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    ej.statut, ej.niveau_profil, ej.club_provenance_id, cprov.code, cprov.nom_court,
    ej.date_affectation, ej.date_sortie,
    CASE
      WHEN p.type_personne = 'licencie_externe_partenaire' THEN 'partenaire'
      WHEN p.type_personne = 'licencie_educateur' THEN 'coach'
      WHEN p.type_personne = 'licencie_dirigeant' AND COALESCE(p.qualite_ffr, '') LIKE 'DC%' THEN 'coach'
      WHEN p.type_personne = 'licencie_soigneur' THEN 'staff'
      WHEN p.type_personne = 'licencie_competition' AND p.f15_integree = TRUE THEN 'f15'
      WHEN p.type_personne = 'licencie_competition' THEN 'mom'
      ELSE 'autre'
    END AS profil,
    CASE
      WHEN ej.date_sortie IS NOT NULL AND ej.date_sortie < CURRENT_DATE THEN 'inactif'
      WHEN p.suspension_jusqu_au IS NOT NULL AND p.suspension_jusqu_au >= CURRENT_DATE THEN 'suspendu'
      WHEN p.blessure_resume IS NOT NULL AND length(trim(p.blessure_resume)) > 0 THEN 'blesse'
      WHEN p.indisponibilite IS NOT NULL AND length(trim(p.indisponibilite)) > 0 THEN 'indisponible'
      ELSE 'actif'
    END AS etat_calcule,
    NULL::text AS fonction_staff
  FROM cat
  JOIN personnes p ON (
    (cat.est_loisirs AND cat.type_licence_ffr = ANY(COALESCE(p.qualites_ffr, ARRAY[]::text[])))
    OR
    (NOT cat.est_loisirs AND p.categorie_id = p_categorie_id
       AND NOT (COALESCE(p.qualites_ffr, ARRAY[]::text[]) && ARRAY['RLSP','RLO']))
  )
  LEFT JOIN LATERAL (
    SELECT ej2.* FROM equipe_joueurs ej2
    WHERE ej2.personne_id = p.id
      AND (ej2.date_sortie IS NULL OR ej2.date_sortie >= CURRENT_DATE)
    ORDER BY ej2.date_affectation DESC NULLS LAST
    LIMIT 1
  ) ej ON TRUE
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN clubs cprov ON cprov.id = ej.club_provenance_id
  LEFT JOIN categories c ON c.id = p.categorie_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id

  UNION ALL

  -- ========================================================================
  -- BRANCHE ENCADRANTS (nouvelle) — via fonction_staff, badge = fonction exacte
  -- ========================================================================
  SELECT
    p.id, p.nom, p.prenom, p.sexe, p.date_naissance, p.type_personne, p.f15_integree,
    p.numero_licence_ffr, p.qualite_ffr,
    p.club_principal_id, cp.code, cp.nom_court,
    cible.id AS categorie_id, cible.libelle_court AS categorie_libelle_court,
    p.pole_attache_id, po.libelle_court,
    NULL::text[] AS postes_uuids, NULL::text[] AS aptitudes_uuids,
    NULL::smallint AS taille_cm, NULL::integer AS poids_g,
    p.indisponibilite, p.blessure_resume, p.suspension_jusqu_au,
    NULL::text AS ej_statut, NULL::text AS ej_niveau_profil,
    NULL::uuid AS ej_club_provenance_id, NULL::text AS ej_club_provenance_code,
    NULL::text AS ej_club_provenance_nom_court,
    NULL::date AS ej_date_affectation, NULL::date AS ej_date_sortie,
    'coach'::text AS profil,
    'actif'::text AS etat_calcule,
    fs.fonction AS fonction_staff
  FROM fonction_staff fs
  JOIN personnes p ON p.id = fs.personne_id
  JOIN categories cible ON cible.id = fs.categorie_id
  LEFT JOIN clubs cp ON cp.id = p.club_principal_id
  LEFT JOIN poles po ON po.id = p.pole_attache_id
  WHERE fs.categorie_id = p_categorie_id
    AND fs.date_fin IS NULL

  ORDER BY nom, prenom;
$function$;

-- ============================================================================
-- DROITS — reposes apres DROP (etat sonde avant chantier : EXECUTE authenticated
-- + service_role ; le default public EXECUTE existait aussi, on le conserve tel quel).
-- ============================================================================
grant execute on function public.get_joueurs_categorie(uuid) to authenticated;
grant execute on function public.get_joueurs_categorie(uuid) to service_role;

-- ============================================================================
-- VÉRIFICATION fail-loud
-- ============================================================================
do $verif$
declare
  v_cols int;
begin
  -- La colonne fonction_staff doit exister dans le type de retour.
  select count(*) into v_cols
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace,
    lateral unnest(p.proargnames) as an(name)
    where n.nspname='public' and p.proname='get_joueurs_categorie'
      and an.name = 'fonction_staff';
  if v_cols < 1 then
    raise exception 'KO : colonne fonction_staff absente du retour.';
  end if;
  raise notice 'EFFECTIF-ENCADRANTS OK : get_joueurs_categorie enrichie (colonne fonction_staff + branche encadrants).';
end;
$verif$;

commit;
