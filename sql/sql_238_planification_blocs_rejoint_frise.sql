-- ============================================================
-- sql_238_planification_blocs_rejoint_frise.sql
-- ------------------------------------------------------------
-- Chantier : PLANIF-BLOCS-INTERCALES-MULTIPERIODES (recette v4)
--
-- Objet : offrir, sur un bloc intercalé, une option « faire rejoindre
--   les périodes à la frise principale ». Quand elle est active, les
--   périodes du bloc s'affichent sur la ligne principale de la frise
--   (couche basse) au lieu de la couche haute dédiée aux intercalés.
--
--   L'activation est soumise, CÔTÉ FRONT, à une garde anti-collision
--   bloquante : on refuse d'activer si une période chevaucherait un
--   bloc déjà présent sur la ligne principale (bloc principal OU autre
--   intercalé ayant déjà rejoint). Cette garde est purement UX ; la
--   base ne l'impose pas (chevauchement resté autorisé au modèle).
--
-- Contenu :
--   1. Colonne rejoint_frise boolean NOT NULL DEFAULT false
--
-- Retrocompat : blocs existants => rejoint_frise = false => rendu
--   inchangé (périodes en couche haute). Zéro régression.
--
-- Doctrine : additif. Modèle d'attachement inchangé (categorie_id /
--   pole_id) => RLS planification_blocs non impactée.
-- ============================================================


alter table public.planification_blocs
  add column if not exists rejoint_frise boolean not null default false;


-- ---- Vérification fail-loud --------------------------------
do $verif$
declare
  v_col_ok boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'planification_blocs'
      and column_name = 'rejoint_frise'
      and data_type = 'boolean'
  ) into v_col_ok;

  if not v_col_ok then
    raise exception 'sql_238 FAIL : colonne rejoint_frise absente ou mauvais type';
  end if;

  raise notice 'sql_238 OK : colonne rejoint_frise en place';
end;
$verif$;
