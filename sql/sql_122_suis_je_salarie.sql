-- ============================================================================
-- MOM Hub · Chantier « DASHBOARD-TUILES-PAR-CAPABILITY »
-- Fichier : sql/122 — RPC suis_je_salarie() (prédicat voie 3, lecture seule)
-- ----------------------------------------------------------------------------
-- Objet : exposer au compte courant un prédicat booléen « suis-je un salarié
--   du club aujourd'hui ? », pour piloter (a) la PORTE du dashboard élargi et
--   (b) la visibilité de la tuile « Suivi du salarié ».
--
-- DOCTRINE (acté Manu, ce chantier) :
--   - PAS de nouveau rôle (doctrine D-A, éviter le rôle fantôme). « Être
--     salarié » est un FAIT métier déjà matérialisé, pas un droit. On le
--     teste, on ne l'attribue pas.
--   - Source de vérité = contrats_salaries (contrat COURANT : actif ET fenêtre
--     [date_debut, date_fin] couvrant aujourd'hui), conformément à la doctrine
--     sql/83 (« identification salarié = TABLE dédiée, PAS le flag est_salarie »).
--     Le WHERE ci-dessous est RIGOUREUSEMENT celui de list_salaries() (sondé
--     déployé à la source, pg_get_functiondef), restreint au compte courant.
--   - Le front masque pour l'ergonomie ; la garde SQL de chaque page-cible
--     reste la VÉRITÉ. Ce prédicat sert l'affichage, il n'accorde aucun droit.
--
-- Réf. sondes (lecture seule, exécutées par Manu) :
--   A  pg_get_functiondef('public.list_salaries()') -> corps adossé à
--      contrats_salaries (actif + date_debut <= current_date + date_fin null/future).
--   B  contrats_salaries pour 589e7977… (Lohann) = cdi, 2024-08-01, fin null,
--      actif=true -> contrat COURANT aujourd'hui (les 3 conditions vraies).
--   - qui_suis_je() = RETURNS TABLE(personne_id uuid) (sql/60), null si orphelin.
--
-- Patron calqué : sql/120 (RPC voie 3 SECURITY DEFINER, REVOKE public+anon /
--   GRANT authenticated, bloc DO fail-loud). Idempotent (create or replace),
--   transaction.
-- ============================================================================

begin;

-- ============================================================================
-- 1. RPC suis_je_salarie() — prédicat booléen du compte courant
-- ============================================================================
create or replace function public.suis_je_salarie()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contrats_salaries cs
    where cs.personne_id = (select q.personne_id from public.qui_suis_je() q)
      and cs.actif = true
      and cs.date_debut <= current_date
      and (cs.date_fin is null or cs.date_fin >= current_date)
  );
$$;

comment on function public.suis_je_salarie() is
  'Prédicat voie 3 : le compte courant a-t-il un contrat salarié COURANT (actif + fenêtre couvrant aujourd''hui) ? Même logique que list_salaries(), restreinte à qui_suis_je(). Sert la PORTE du dashboard et la tuile « Suivi du salarié ». N''accorde aucun droit : la garde SQL des pages-cibles reste la vérité. false si compte non relié (qui_suis_je() vide -> exists false).';

-- ============================================================================
-- 2. Privilèges — fermer public + anon, ouvrir authenticated
--    (leçon DS-1 pt 109/110 : REVOKE FROM PUBLIC seul est INSUFFISANT pour une
--     fonction nouvelle -> REVOKE FROM anon explicite est obligatoire).
-- ============================================================================
revoke execute on function public.suis_je_salarie() from public, anon;
grant  execute on function public.suis_je_salarie() to authenticated;

-- ============================================================================
-- 3. Vérification fail-loud (la fonction existe et est exécutable)
-- ============================================================================
do $verif$
declare
  v_exists boolean;
begin
  v_exists := (
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'suis_je_salarie'
        and p.prokind = 'f'
    )
  );
  if not v_exists then
    raise exception 'ECHEC sql_122 : suis_je_salarie() absente après création.';
  end if;
  raise notice 'OK sql_122 : suis_je_salarie() créée (prédicat voie 3, contrat courant).';
end;
$verif$;

commit;

-- ============================================================================
-- DRY-RUN optionnel (à exécuter SÉPARÉMENT, hors transaction ci-dessus) :
--   select public.suis_je_salarie();
--     -> attendu true pour le compte de Lohann (contrat cdi courant),
--        false pour un compte non relié / non salarié / admin sans contrat.
-- ============================================================================
