-- =============================================================================
-- sql_189_trace_get_vivier_compo_categorie.sql
-- Dette de trace (EVT-PHASES-FANTOMES, signalée pt 188, jamais absorbée) :
-- la RPC get_vivier_compo_categorie a été créée au pt 186 (rattachement de la
-- mère de série, chantier EVT-PHASES-FANTOMES) mais n'a jamais eu de script
-- sql_18x correspondant au dépôt — sql_186_rattacher_mere_serie.sql couvre un
-- autre sujet (numérotation "pt" STATE.md ≠ numérotation "sql_NNN" fichier,
-- source de la confusion initiale).
--
-- Ce fichier ne modifie AUCUN comportement : il capture fidèlement (copie
-- exacte via pg_get_functiondef) la définition RÉELLEMENT déployée en base
-- aujourd'hui (vérifiée pt 206), pour combler le trou de traçabilité. Le
-- CREATE OR REPLACE est donc un no-op fonctionnel — la fonction existe déjà
-- à l'identique.
--
-- Contexte fonctionnel (pour mémoire, non modifié ici) : vivier de joueurs
-- d'une catégorie SANS filtre par équipe précise (contrairement à
-- get_vivier_compo qui prend p_equipe_id) — colonnes statut_attache /
-- niveau_profil / date_affectation renvoyées NULL dans ce cas, faute
-- d'équipe de référence pour les résoudre.
--
-- Périmètre STRICT : traçabilité seule. Aucune colonne, aucun comportement,
-- aucun droit modifié.
-- =============================================================================

begin;

CREATE OR REPLACE FUNCTION public.get_vivier_compo_categorie(p_categorie_id uuid)
 RETURNS TABLE(joueur_id uuid, nom text, prenom text, sexe text, date_naissance date, categorie_id uuid, categorie_libelle_court text, club_principal_id uuid, club_principal_nom_court text, type_personne text, f15_integree boolean, est_partenaire_entente boolean, statut_attache text, niveau_profil text, date_affectation date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE p.categorie_personne = 'joueur'
    AND (
          p.categorie_id = v_categorie_id
       OR (p.f15_integree = TRUE AND v_categorie_code = 'M14')
        )
  ORDER BY
    p.nom,
    p.prenom;
END;
$function$;

-- -----------------------------------------------------------------------------
-- Vérification fail-loud : la fonction doit exister avec la signature attendue.
-- -----------------------------------------------------------------------------
do $verif$
declare
  v_nb_args   integer;
  v_retour    text;
begin
  select pronargs, pg_get_function_result(p.oid)
    into v_nb_args, v_retour
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_vivier_compo_categorie'
    and p.prokind = 'f';

  if v_nb_args is null then
    raise exception 'sql_189 : get_vivier_compo_categorie introuvable après CREATE OR REPLACE.';
  end if;

  if v_nb_args <> 1 then
    raise exception 'sql_189 : get_vivier_compo_categorie attendu à 1 argument (p_categorie_id), trouvé %.', v_nb_args;
  end if;

  if v_retour is null or v_retour not like 'TABLE(joueur_id uuid%' then
    raise exception 'sql_189 : signature de retour inattendue pour get_vivier_compo_categorie : %', v_retour;
  end if;

  raise notice 'sql_189 : get_vivier_compo_categorie tracée et conforme (% argument(s)).', v_nb_args;
end;
$verif$;

commit;
