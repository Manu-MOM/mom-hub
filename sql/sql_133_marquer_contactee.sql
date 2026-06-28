-- =============================================================================
-- sql_133_marquer_contactee.sql
-- Module B « Prospection » — geste « C'est fait » de la surface EXÉCUTANT (Lohann).
--
-- Ferme la boucle de la carte-geste sans imposer de saisie à Lohann (FAIT FOI §1 :
-- le plus petit geste possible). UN TAP, zéro texte. Sémantique verrouillée
-- (décision production, conv pt 130+) :
--   « C'est fait » = « contact établi ». N'AVANCE QUE depuis a_contacter -> contacte.
--   Tout autre statut reste INCHANGÉ : l'intérêt d'une école est un signal qui vient
--   de l'ÉCOLE (enregistré par le bureau), pas déductible du seul geste de Lohann.
--   La conversion en client et la journalisation détaillée restent au bureau
--   (FAIT FOI §3.1 P1). Les cas « relance » / « à convertir » sont gérés côté front
--   par le skip de session + le pilotage bureau.
--
-- Garde « bureau OU salarié » (patron declarer_occurrence / sql_132). Idempotente :
-- rappeler sur une école déjà contacte ne fait rien et ne lève pas d'erreur.
--
-- Invariants reconduits : SECURITY DEFINER + set search_path 'public' +
-- REVOKE public/anon + GRANT authenticated + do $verif$ fail-loud + motif
-- v := (select ...) (éditeur Supabase casse sur select ... into dans do $tag$).
-- Pas de begin/commit explicite (rollback implicite).
-- =============================================================================

create or replace function public.marquer_contactee(
  p_entite_id uuid
)
returns entites
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row    public.entites;
  v_statut text;
  v_existe boolean;
begin
  -- Garde « bureau OU salarié » (aligne list_prospection_pour_salarie, sql_132).
  if not (public._gs_peut_ecrire() or public.suis_je_salarie()) then
    raise exception 'Réservé à l''administration ou au salarié.';
  end if;

  if p_entite_id is null then
    raise exception 'entite_id obligatoire.';
  end if;

  -- Existence explicite : statut_prospection peut être NULL (école non démarchée),
  -- donc on ne peut pas déduire l'inexistence du statut. FOUND n'est PAS positionné
  -- par une affectation v := (select ...) -> on teste l'existence séparément.
  v_existe := (select exists (select 1 from public.entites e where e.id = p_entite_id));
  if not v_existe then
    raise exception 'Ecole introuvable (entite_id=%).', p_entite_id;
  end if;

  v_statut := (select e.statut_prospection from public.entites e where e.id = p_entite_id);

  -- Avance UNIQUEMENT depuis a_contacter (ou non démarchée) -> contacte.
  -- Tout autre statut : on renvoie la ligne inchangée (idempotent, pas d'erreur).
  if v_statut is null or v_statut = 'a_contacter' then
    update public.entites
       set statut_prospection = 'contacte'
     where id = p_entite_id
    returning * into v_row;
  else
    v_row := (select e from public.entites e where e.id = p_entite_id);
  end if;

  return v_row;
end;
$function$;

-- Permissions ---------------------------------------------------------------
revoke all on function public.marquer_contactee(uuid) from public;
revoke all on function public.marquer_contactee(uuid) from anon;
grant execute on function public.marquer_contactee(uuid) to authenticated;

-- Vérification fail-loud ----------------------------------------------------
do $verif$
declare
  v_exists boolean;
begin
  v_exists := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'marquer_contactee'
  ));
  if not v_exists then
    raise exception 'VERIF: marquer_contactee absente apres creation.';
  end if;

  v_exists := (select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suis_je_salarie'
  ));
  if not v_exists then
    raise exception 'VERIF: dependance suis_je_salarie introuvable.';
  end if;

  raise notice 'VERIF OK : marquer_contactee en place (a_contacter -> contacte, garde bureau OU salarie).';
end;
$verif$;
