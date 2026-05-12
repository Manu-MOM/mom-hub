-- ============================================================================
-- MOM Hub · Phase 3 (2/2) · RPC du portail (KPI K3/K4 + sidebar)
-- ============================================================================
-- Objectif : exposer aux pages du Hub 5 compteurs/dates utilisés par
-- la zone sous-bandeau du portail refondu (cf. Conception-Portail-Phase-3.md
-- §2.3 KPI et §2.5 Sidebar).
--
-- 5 fonctions :
--   1. count_personnes_created_last_7_days()              -> INT   (K3 "CETTE SEMAINE")
--   2. count_personnes_without_email()                    -> INT   (K4 "SANS EMAIL" + sidebar carte 2)
--   3. count_personnes_without_birthdate()                -> INT   (sidebar carte 2)
--   4. count_personnes_affiliation_expiring_within_90_days() -> INT (sidebar carte 2)
--   5. get_last_oval_e_sync_date()                        -> DATE  (sidebar carte 1)
--
-- Sécurité :
--   - Toutes les fonctions sont SECURITY DEFINER avec search_path = public
--     (cohérent avec le pattern Phase 2.5.1).
--   - Les fonctions retournent des AGRÉGATS (compteurs / dates) sur la base
--     entière, donc aucune fuite de donnée personnelle. RGPD-safe.
--   - Exécution restreinte aux utilisateurs authenticated (pas anon).
--     Un visiteur non connecté ne doit pas pouvoir mesurer la base.
--
-- À exécuter dans le SQL editor Supabase (projet mom-hub).
-- Idempotent : peut être rejoué sans dégât (CREATE OR REPLACE partout).
-- Aucune donnée perso : ce fichier peut être commit dans le repo public.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. K3 "CETTE SEMAINE" — nouvelles fiches sur 7 jours glissants
-- ----------------------------------------------------------------------------
-- Compte les fiches `personnes` créées dans les 7 derniers jours.
-- Glissant : la fenêtre est "maintenant - 7 jours" à "maintenant",
-- pas "lundi de cette semaine" à "dimanche". Choix volontaire pour
-- éviter les effets de seuil le lundi matin.

create or replace function public.count_personnes_created_last_7_days()
returns integer
language sql
security definer
set search_path = public
stable
as $$
    select count(*)::integer
    from public.personnes
    where created_at > now() - interval '7 days';
$$;

comment on function public.count_personnes_created_last_7_days() is
    'Nombre de fiches personnes créées dans les 7 derniers jours glissants. Utilisé par le KPI K3 "CETTE SEMAINE" du portail.';

grant execute on function public.count_personnes_created_last_7_days() to authenticated;


-- ----------------------------------------------------------------------------
-- 2. K4 / sidebar carte 2 — fiches sans email principal
-- ----------------------------------------------------------------------------
-- Compte les fiches sans email principal renseigné.
-- "Sans email" = NULL ou chaîne vide (les imports OVAL-E remplissent parfois
-- avec '' au lieu de NULL).

create or replace function public.count_personnes_without_email()
returns integer
language sql
security definer
set search_path = public
stable
as $$
    select count(*)::integer
    from public.personnes
    where email_principal is null
       or trim(email_principal) = '';
$$;

comment on function public.count_personnes_without_email() is
    'Nombre de fiches personnes sans email principal renseigné. Utilisé par le KPI K4 "SANS EMAIL" et la sidebar Qualité des données.';

grant execute on function public.count_personnes_without_email() to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Sidebar carte 2 — fiches sans date de naissance
-- ----------------------------------------------------------------------------
-- Compte les fiches sans date de naissance renseignée.
-- Champ direct : personnes.date_naissance (DATE, nullable).

create or replace function public.count_personnes_without_birthdate()
returns integer
language sql
security definer
set search_path = public
stable
as $$
    select count(*)::integer
    from public.personnes
    where date_naissance is null;
$$;

comment on function public.count_personnes_without_birthdate() is
    'Nombre de fiches personnes sans date de naissance renseignée. Utilisé par la sidebar Qualité des données.';

grant execute on function public.count_personnes_without_birthdate() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Sidebar carte 2 — affiliations FFR expirant sous 90 jours
-- ----------------------------------------------------------------------------
-- Compte les fiches dont l'affiliation FFR expire entre aujourd'hui et
-- aujourd'hui + 90 jours. Les déjà-expirées (date_fin_affiliation < today)
-- ne sont PAS comptées (elles relèvent d'un autre indicateur "expirées").
-- Les fiches sans date_fin_affiliation ne sont pas comptées non plus.

create or replace function public.count_personnes_affiliation_expiring_within_90_days()
returns integer
language sql
security definer
set search_path = public
stable
as $$
    select count(*)::integer
    from public.personnes
    where date_fin_affiliation is not null
      and date_fin_affiliation >= current_date
      and date_fin_affiliation <= current_date + interval '90 days';
$$;

comment on function public.count_personnes_affiliation_expiring_within_90_days() is
    'Nombre de fiches dont l''affiliation FFR expire entre aujourd''hui et J+90. Exclut les affiliations déjà expirées. Utilisé par la sidebar Qualité des données.';

grant execute on function public.count_personnes_affiliation_expiring_within_90_days() to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Sidebar carte 1 — dernière date de sync OVAL-E
-- ----------------------------------------------------------------------------
-- Retourne la date la plus récente d'une fiche issue ou modifiée par un
-- import OVAL-E. Permet d'afficher "Dernière sync OVAL-E : <date>" en
-- sidebar.
--
-- Heuristique : on utilise updated_at filtré sur les fiches dont
-- source_creation contient 'OVAL-E' OU dont modifie_par contient 'OVAL-E'.
-- Cohérent avec la Doctrine OVAL-E v1.3 §2 qui standardise le nom.

create or replace function public.get_last_oval_e_sync_date()
returns date
language sql
security definer
set search_path = public
stable
as $$
    select max(updated_at)::date
    from public.personnes
    where source_creation ilike '%oval-e%'
       or modifie_par     ilike '%oval-e%';
$$;

comment on function public.get_last_oval_e_sync_date() is
    'Date de la dernière modification (updated_at::date) sur une fiche tagguée OVAL-E dans source_creation ou modifie_par. Renvoie NULL si aucune fiche OVAL-E en base. Utilisé par la sidebar carte 1.';

grant execute on function public.get_last_oval_e_sync_date() to authenticated;


-- ============================================================================
-- Vérifications post-exécution (à lancer manuellement après le script)
-- ============================================================================
--
-- A) Lister les 5 fonctions créées :
--    select proname, pg_get_function_result(oid)
--    from pg_proc
--    where proname in (
--      'count_personnes_created_last_7_days',
--      'count_personnes_without_email',
--      'count_personnes_without_birthdate',
--      'count_personnes_affiliation_expiring_within_90_days',
--      'get_last_oval_e_sync_date'
--    );
--    -> doit retourner 5 lignes.
--
-- B) Tester les 5 RPC en tant qu'utilisateur authenticated :
--    select count_personnes_created_last_7_days();
--    select count_personnes_without_email();
--    select count_personnes_without_birthdate();
--    select count_personnes_affiliation_expiring_within_90_days();
--    select get_last_oval_e_sync_date();
--    -> 5 valeurs cohérentes (entiers + 1 date ou NULL).
--
-- C) Vérifier que anon NE PEUT PAS les exécuter :
--    set role anon;
--    select count_personnes_without_email();
--    -> doit lever "permission denied for function ..."
--    reset role;
-- ============================================================================
