-- pt 208 (chantier VIVIER-B-STAFF-CLASSIFICATION) : correction de deux bugs de classification.
--
-- CAUSES (sondées à la source, base live 21/07/2026) :
--   A. Le code FFR 'B' (licence JOUEUR de nationalite etrangere) etait classe a tort dans le
--      socle staff est_staff_ffr {DC4,EDU,ECF,SOI,B,ACF} : des joueurs etrangers purs
--      devenaient faussement "staff" (ANDREI, COLSON) et l'un d'eux avait ete rustine a la main
--      via staff_exclu=true (AMANI, pt ~81) au lieu de corriger la cause.
--   B. get_vivier_compo / get_vivier_compo_categorie filtraient categorie_personne = 'joueur'
--      en EGALITE STRICTE -> 19 joueurs-encadrants reels (licencie_competition, categorie
--      composite type joueur_et_staff) etaient exclus a tort du vivier de compo
--      (cas emblematique VACHER Baptiste, A+EDU, non alignable en feuille de match).
--
-- DOCTRINE (faits verifies) :
--   - est_staff_ffr(text[]) IMMUTABLE : socle des codes FFR conferant le statut staff.
--   - est_staff(uuid) derive : (est_staff_ffr(qualites) and not staff_exclu) or est_staff_manuel.
--   - Le filtre vivier est combine (AND) avec un filtre CATEGORIEL (categorie_id de l'equipe
--     cible + passerelle F15->M14) : passer a LIKE '%joueur%' n'ouvre le vivier qu'aux personnes
--     de LEUR categorie. Additif : aucune regression sur les 280 deja au vivier (dont 39
--     licencie_externe_partenaire deja en 'joueur' strict).
--   - INTERDITS non concernes (RPC pures ; css/hub.css, js/hub-agenda.js, css/hub-agenda.css,
--     js/hub-nav.js non touches).
--   - Ce fichier = CODE uniquement (Volets 1 et 2). Le nettoyage DATA (Volet 3 : recategorisation
--     ANDREI/COLSON/RULFO + staff_exclu AMANI) est livre separement : sql_199.
--   - Pattern : CREATE OR REPLACE chirurgical (une seule ligne modifiee par fonction) + bloc
--     de verification fail-loud.
begin;

-- ============================================================================
-- VOLET 1 — SOCLE STAFF : retrait de 'B' (corrige cause A)
-- ============================================================================
-- Nouveau socle : {DC4, EDU, ECF, SOI, ACF}. 'B' retire (licence joueur etranger, jamais staff).
-- Effet derive immediat : ANDREI, COLSON (B pur) cessent d'etre est_staff ; la rustine
-- staff_exclu=true d'AMANI devient inutile (nettoyee dans sql_199).
create or replace function public.est_staff_ffr(p_qualites text[])
returns boolean
language sql
immutable
as $function$
  select coalesce(p_qualites && array['DC4','EDU','ECF','SOI','ACF']::text[], false);
$function$;

-- ============================================================================
-- VOLET 2 — VIVIER : egalite stricte -> LIKE (corrige cause B)
-- ============================================================================
-- get_vivier_compo(p_equipe_id) : SEULE modification vs definition deployee = l'operateur
-- de la ligne "WHERE p.categorie_personne = 'joueur'" -> "LIKE '%joueur%'".
-- Tout le reste (resolution categorie/club, jointures, est_partenaire_entente, filtre
-- categoriel, ORDER BY) est reproduit a l'identique.
create or replace function public.get_vivier_compo(p_equipe_id uuid)
 returns table(joueur_id uuid, nom text, prenom text, sexe text, date_naissance date, categorie_id uuid, categorie_libelle_court text, club_principal_id uuid, club_principal_nom_court text, type_personne text, f15_integree boolean, est_partenaire_entente boolean, statut_attache text, niveau_profil text, date_affectation date)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_categorie_id              UUID;
  v_categorie_code            TEXT;
  v_club_principal_entente_id UUID;
BEGIN
  -- 1. Résoudre la catégorie cible + club principal de l'entente parent
  SELECT en.categorie_id, c.code, en.club_principal_id
    INTO v_categorie_id, v_categorie_code, v_club_principal_entente_id
  FROM equipes      e
  JOIN ententes     en ON e.entente_id   = en.id
  JOIN categories   c  ON en.categorie_id = c.id
  WHERE e.id = p_equipe_id;

  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Équipe % introuvable ou sans entente parent.', p_equipe_id;
  END IF;

  -- 2. Renvoyer le vivier filtré + statut d'attache
  RETURN QUERY
  SELECT
    p.id                                                              AS joueur_id,
    p.nom,
    p.prenom,
    p.sexe,
    p.date_naissance,
    p.categorie_id,
    cat.libelle_court                                                 AS categorie_libelle_court,
    p.club_principal_id,
    clb.nom_court                                                     AS club_principal_nom_court,
    p.type_personne,
    p.f15_integree,
    (p.club_principal_id IS DISTINCT FROM v_club_principal_entente_id) AS est_partenaire_entente,
    ej.statut                                                         AS statut_attache,
    ej.niveau_profil,
    ej.date_affectation
  FROM personnes p
  LEFT JOIN categories cat ON p.categorie_id      = cat.id
  LEFT JOIN clubs      clb ON p.club_principal_id = clb.id
  LEFT JOIN equipe_joueurs ej
         ON ej.equipe_id    = p_equipe_id
        AND ej.personne_id  = p.id
        AND ej.date_sortie IS NULL
  WHERE p.categorie_personne LIKE '%joueur%'
    AND (
          p.categorie_id = v_categorie_id
       OR (p.f15_integree = TRUE AND v_categorie_code = 'M14')
       -- TODO M-1 : OR p.categorie_surclassement_id = v_categorie_id
        )
  ORDER BY
    CASE ej.statut
      WHEN 'regulier'           THEN 1
      WHEN 'renfort_temporaire' THEN 2
      WHEN 'en_transition'      THEN 3
      ELSE                           4   -- NULL = pas attaché
    END,
    p.nom,
    p.prenom;
END;
$function$;

-- get_vivier_compo_categorie(p_categorie_id) : fonction jumelle (sans p_equipe_id).
-- SEULE modification vs definition deployee = le meme operateur LIKE sur categorie_personne.
create or replace function public.get_vivier_compo_categorie(p_categorie_id uuid)
 returns table(joueur_id uuid, nom text, prenom text, sexe text, date_naissance date, categorie_id uuid, categorie_libelle_court text, club_principal_id uuid, club_principal_nom_court text, type_personne text, f15_integree boolean, est_partenaire_entente boolean, statut_attache text, niveau_profil text, date_affectation date)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_categorie_id              UUID;
  v_categorie_code            TEXT;
  v_club_principal_entente_id UUID;
BEGIN
  -- 1. Valider la catégorie + résoudre le club principal via l'entente de la SAISON ACTIVE
  --    (une catégorie a une entente par saison ; on prend l'entente active pour lever l'ambiguïté).
  SELECT c.id, c.code
    INTO v_categorie_id, v_categorie_code
  FROM categories c
  WHERE c.id = p_categorie_id;

  IF v_categorie_id IS NULL THEN
    RAISE EXCEPTION 'Catégorie % introuvable.', p_categorie_id;
  END IF;

  SELECT en.club_principal_id
    INTO v_club_principal_entente_id
  FROM ententes en
  JOIN saisons  s ON s.id = en.saison_id
  WHERE en.categorie_id = p_categorie_id
    AND s.est_active = TRUE
  LIMIT 1;
  -- v_club_principal_entente_id peut rester NULL si aucune entente active : dégradation honnête,
  -- est_partenaire_entente vaudra alors TRUE pour tout joueur (club distinct de NULL).

  -- 2. Renvoyer le vivier filtré (sélection catégorielle identique à get_vivier_compo).
  --    Pas de p_equipe_id : les colonnes statut_attache / niveau_profil / date_affectation sortent NULL.
  RETURN QUERY
  SELECT
    p.id                                                              AS joueur_id,
    p.nom,
    p.prenom,
    p.sexe,
    p.date_naissance,
    p.categorie_id,
    cat.libelle_court                                                 AS categorie_libelle_court,
    p.club_principal_id,
    clb.nom_court                                                     AS club_principal_nom_court,
    p.type_personne,
    p.f15_integree,
    (p.club_principal_id IS DISTINCT FROM v_club_principal_entente_id) AS est_partenaire_entente,
    NULL::text                                                        AS statut_attache,
    NULL::text                                                        AS niveau_profil,
    NULL::date                                                        AS date_affectation
  FROM personnes p
  LEFT JOIN categories cat ON p.categorie_id      = cat.id
  LEFT JOIN clubs      clb ON p.club_principal_id = clb.id
  WHERE p.categorie_personne LIKE '%joueur%'
    AND (
          p.categorie_id = v_categorie_id
       OR (p.f15_integree = TRUE AND v_categorie_code = 'M14')
        )
  ORDER BY
    p.nom,
    p.prenom;
END;
$function$;

-- ============================================================================
-- VÉRIFICATION fail-loud
-- ============================================================================
do $verif$
declare
  v_b_dans_socle boolean;
begin
  -- 1. 'B' ne doit PLUS conferer le statut staff.
  if public.est_staff_ffr(array['B']::text[]) then
    raise exception 'VOLET 1 KO : est_staff_ffr(B) renvoie encore true.';
  end if;
  -- 2. Les codes staff legitimes doivent toujours conferer le statut.
  if not public.est_staff_ffr(array['DC4']::text[]) then
    raise exception 'VOLET 1 KO : est_staff_ffr(DC4) devrait etre true.';
  end if;
  if not public.est_staff_ffr(array['EDU']::text[]) then
    raise exception 'VOLET 1 KO : est_staff_ffr(EDU) devrait etre true.';
  end if;
  -- 3. Les 3 fonctions cibles existent bien.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.prokind='f'
          and p.proname in ('est_staff_ffr','get_vivier_compo','get_vivier_compo_categorie')) <> 3 then
    raise exception 'KO : les 3 fonctions cibles ne sont pas toutes presentes.';
  end if;
  raise notice 'VIVIER-B-STAFF OK : B retire du socle, DC4/EDU conserves, 3 fonctions en place.';
end;
$verif$;

commit;
