-- ============================================================================
-- sql_208_contraintes_format_jeu_a_5.sql
-- Chantier COMPO-MULTI-FORMAT (pt 227) — correctif de sql_207
--
-- OBJET
--   Autoriser la valeur '5' dans les deux contraintes CHECK qui bornent
--   `format_de_jeu`. Sans ce correctif, choisir « V (5) » dans le dropdown
--   Évènements provoque une erreur d'écriture.
--
-- ORIGINE (remontée terrain, capture Manu)
--   « Échec : new row for relation "evenement_equipes_engagees" violates
--     check constraint "evt_equipes_format_check" »
--   à l'enregistrement d'un plateau M10 en jeu à 5.
--
-- LACUNE DE sql_207 (assumée et tracée)
--   sql_207 a ajouté le format 5 côté `postes` (5 postes neutres J1..J5) et
--   pt 226 l'a ajouté au dropdown, MAIS les sondes de sql_207 portaient
--   uniquement sur la table `postes`. Les contraintes CHECK de la table qui
--   STOCKE le choix n'ont jamais été vérifiées. Le dropdown proposait donc
--   une valeur que la base rejetait — bug introduit par le chantier lui-même.
--
-- PÉRIMÈTRE (sonde : recherche de TOUTES les contraintes CHECK mentionnant
-- « format » dans le schéma public)
--   DEUX contraintes concernées, pas une :
--     • evenement_equipes_engagees.evt_equipes_format_check  (le blocage vu)
--     • evenements.evenements_format_check                   (même liste,
--       aurait bloqué le format posé au niveau de l'évènement lui-même)
--   Une 3e contrainte CHECK contient le mot « format » par coïncidence
--   (releve_heures_salarie_categorie_check) — HORS PÉRIMÈTRE, non touchée.
--
-- NATURE
--   DROP + ADD de contrainte (une contrainte CHECK ne se modifie pas en
--   place). La nouvelle liste est l'ancienne PLUS '5' — strictement
--   élargissante : aucune ligne existante ne peut devenir invalide, donc
--   aucun risque de rejet à la revalidation.
--
-- TESTÉ
--   Joué en BEGIN; … ROLLBACK; avec écriture réelle de '5' sur l'évènement
--   du 19/09 (Tournoi JCO M10) avant application. Écriture acceptée.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1 — evenement_equipes_engagees : format par équipe engagée (surcharge M4)
-- ---------------------------------------------------------------------------
alter table public.evenement_equipes_engagees
  drop constraint evt_equipes_format_check;

alter table public.evenement_equipes_engagees
  add constraint evt_equipes_format_check
  check (
    format_de_jeu is null
    or format_de_jeu = any (array['XV','13','12','X','9','8','7','5']::text[])
  );

-- ---------------------------------------------------------------------------
-- 2 — evenements : format au niveau de l'évènement
-- ---------------------------------------------------------------------------
alter table public.evenements
  drop constraint evenements_format_check;

alter table public.evenements
  add constraint evenements_format_check
  check (
    format_de_jeu is null
    or format_de_jeu = any (array['XV','13','12','X','9','8','7','5']::text[])
  );

-- ---------------------------------------------------------------------------
-- 3 — Vérification fail-loud
-- ---------------------------------------------------------------------------
-- Contrôle que CHACUN des 8 formats figure dans CHACUNE des 2 contraintes.
-- Toute absence lève une exception et annule la transaction.

do $verif$
declare
  v_manquants text := '';
  v_c text;
  v_f text;
begin
  foreach v_c in array array['evt_equipes_format_check','evenements_format_check'] loop
    foreach v_f in array array['XV','13','12','X','9','8','7','5'] loop
      if position('''' || v_f || '''' in
           (select pg_get_constraintdef(oid)
              from pg_constraint where conname = v_c)) = 0 then
        v_manquants := v_manquants
          || format('  %s : format %s absent%s', v_c, v_f, chr(10));
      end if;
    end loop;
  end loop;

  if v_manquants <> '' then
    raise exception 'sql_208 ECHEC :%s%s', chr(10), v_manquants;
  end if;

  raise notice 'sql_208 OK — les 2 contraintes acceptent les 8 formats.';
end
$verif$;

commit;

-- ============================================================================
-- ENSEIGNEMENT À RETENIR
--   Ajouter une valeur à un référentiel ne suffit pas : il faut vérifier
--   TOUTES les contraintes qui bornent cette valeur ailleurs dans le schéma.
--   La sonde à réflexe pour un prochain format :
--     select conrelid::regclass, conname, pg_get_constraintdef(oid)
--       from pg_constraint
--      where contype = 'c' and pg_get_constraintdef(oid) ilike '%format%';
-- ============================================================================
