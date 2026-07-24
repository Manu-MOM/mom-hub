-- =====================================================================
-- sql_211_absences_recurrence.sql
-- Chantier : ABSENCES-SALARIE-RECURRENCE (suite du pt 229 / sql_210)
-- Objet    : permettre de decrire un rythme de repos (« tous les lundis
--            matin ») et de MATERIALISER les creneaux sur une periode
--            bornee, SANS jamais contourner l'anti-chevauchement.
--
-- ORIGINE : demande Manu — « la notion de recurrence devrait etre
--   proposee... ex on attribue a Lohann tous ses lundis matin ».
--
-- PATRON REUTILISE (sonde DS-1) : missions.recurrence jsonb + RPC
--   generer_occurrences_recurrentes (sql_117). Meme format de rythme,
--   meme philosophie « generation bornee a la demande » :
--     { "frequence":"hebdomadaire", "jours":[1], "heure_debut":"08:00",
--       "heure_fin":"13:00" }
--   - frequence : v1 = 'hebdomadaire' seule (comme sql_117).
--   - jours     : ISO 1=lundi..7=dimanche (EXTRACT ISODOW).
--   PAS de moteur, PAS de process en fond, PAS de deroule sur la saison.
--
-- >>> DEUX MODELES DE RECURRENCE COEXISTENT DANS LE HUB — CHOIX TRACE <<<
--   (a) « regle vivante » (evenements sql_174, reservations sql_155) :
--       la serie n'est JAMAIS materialisee, les occurrences sont projetees
--       a l'affichage et dates_exclues[] retire des dates de la projection.
--   (b) « generation bornee » (missions sql_117) : les occurrences sont des
--       LIGNES REELLES creees a la demande sur une fenetre.
--   ICI : (b) OBLIGATOIREMENT. Motif : l'anti-chevauchement de sql_210
--   travaille sur des lignes reelles confrontees aux mission_seances. Une
--   regle vivante ne pourrait pas etre testee contre les missions au moment
--   de la saisie — le controle des 35 h deviendrait faux.
--   COROLLAIRE (decision D-R3 de Manu) : supprimer une occurrence sans
--   casser la serie est GRATUIT dans ce modele — chaque creneau genere est
--   une ligne autonome. AUCUN dates_exclues[] n'est necessaire ici.
--
-- DECISIONS (Manu, gelees) :
--   D-R1. CONFLITS EN GENERATION = option (b) « generer les non
--         conflictuels, signaler les autres ». Le tout-ou-rien etait
--         inutilisable (un seul lundi en conflit bloquerait les 40 autres)
--         et le passage en force aurait casse le controle des 35 h.
--         La RPC retourne un RAPPORT : nb crees / nb ignores / detail.
--   D-R2. Recurrence pour les REPOS uniquement. Une periode de conges est
--         deja UNE ligne unique (D6, sql_210) : la recurrence n'y apporte
--         rien. Garde fail-loud sur nature = 'repos'.
--   D-R3. Suppression unitaire d'une occurrence : native (delete de la
--         ligne fille), la serie n'est pas touchee.
--   D-R4. Regeneration : option (A) — une occurrence supprimee PEUT etre
--         recreee si on regenere la meme fenetre. Assume : en pratique on
--         genere une fenetre, on ajuste, on ne regenere pas la periode.
--         Tracer les suppressions aurait rajoute l'objet dates_exclues[]
--         qu'on vient precisement d'eviter (P1).
--   D-R5. Bornes portees par la REGLE (date_debut / date_fin), comme les
--         missions — et non par un « generer sur N semaines ».
--
-- MODELE MERE/FILLE :
--   · ligne MERE   = la regle. recurrence non nul, est_regle = true.
--     Elle ne s'affiche PAS a l'agenda (ce n'est pas un creneau).
--   · lignes FILLES = les creneaux materialises. regle_id -> mere.
--     Autonomes : supprimables une par une.
--   La mere porte les bornes ; les filles portent les dates reelles.
--
-- Idempotent (create if not exists / create or replace), transaction.
-- Additif : aucune colonne retiree, aucune donnee modifiee.
-- =====================================================================

begin;

-- ============================================================================
-- 1. COLONNES ADDITIVES sur absences_salarie
-- ----------------------------------------------------------------------------
--   recurrence : rythme jsonb (mere seulement).
--   est_regle  : true = ligne mere (regle), false = creneau reel.
--   regle_id   : rattachement fille -> mere. ON DELETE CASCADE : supprimer
--                la regle supprime ses occurrences (geste explicite).
-- ============================================================================
alter table public.absences_salarie
  add column if not exists recurrence jsonb;

alter table public.absences_salarie
  add column if not exists est_regle boolean not null default false;

alter table public.absences_salarie
  add column if not exists regle_id uuid
    references public.absences_salarie(id) on delete cascade;

create index if not exists idx_absences_salarie_regle
  on public.absences_salarie (regle_id) where regle_id is not null;

-- Une regle porte un rythme ; un creneau reel n'en porte pas.
-- (Contrainte posee en NOT VALID puis validee : aucune ligne existante
--  ne peut la violer — toutes ont est_regle=false et recurrence NULL —
--  mais on reste explicite.)
do $c$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid='public.absences_salarie'::regclass
                   and conname='absences_salarie_regle_coherente') then
    alter table public.absences_salarie
      add constraint absences_salarie_regle_coherente
      check (
        (est_regle = true  and recurrence is not null and regle_id is null)
        or
        (est_regle = false and recurrence is null)
      );
  end if;
end
$c$;

-- ============================================================================
-- 2. RPC — creer / mettre a jour une REGLE de recurrence
-- ----------------------------------------------------------------------------
--   La regle ne genere RIEN a la creation : la materialisation est un
--   geste separe et explicite (generer_absences_recurrentes).
-- ============================================================================
create or replace function public.upsert_regle_absence(
  p_id          uuid    default null,
  p_contrat_id  uuid    default null,
  p_date_debut  date    default null,
  p_date_fin    date    default null,
  p_jours       int[]   default null,
  p_heure_debut time    default null,
  p_heure_fin   time    default null,
  p_motif       text    default null
)
returns public.absences_salarie
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.absences_salarie;
  v_rec jsonb;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).'
      using errcode = 'insufficient_privilege';
  end if;

  if p_jours is null or array_length(p_jours, 1) is null then
    raise exception 'Aucun jour dans le rythme (au moins un jour requis).'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_heure_debut is null or p_heure_fin is null then
    raise exception 'Les heures de début et de fin sont requises pour une règle.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_date_fin is null then
    raise exception 'La date de fin est requise (bornes portées par la règle).'
      using errcode = 'invalid_parameter_value';
  end if;

  v_rec := jsonb_build_object(
    'frequence',   'hebdomadaire',
    'jours',       to_jsonb(p_jours),
    'heure_debut', to_char(p_heure_debut, 'HH24:MI'),
    'heure_fin',   to_char(p_heure_fin,   'HH24:MI')
  );

  if p_id is null then
    insert into public.absences_salarie (
      contrat_id, nature, date_debut, heure_debut, date_fin, heure_fin,
      journee_entiere, motif, recurrence, est_regle
    ) values (
      p_contrat_id, 'repos', p_date_debut, p_heure_debut, p_date_fin, p_heure_fin,
      false, p_motif, v_rec, true
    )
    returning * into v_row;
  else
    update public.absences_salarie set
      date_debut  = coalesce(p_date_debut, date_debut),
      date_fin    = coalesce(p_date_fin, date_fin),
      heure_debut = p_heure_debut,
      heure_fin   = p_heure_fin,
      motif       = p_motif,
      recurrence  = v_rec
    where id = p_id and est_regle = true
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Règle introuvable : %', p_id using errcode = 'no_data_found';
    end if;
  end if;

  return v_row;
end;
$$;

-- ============================================================================
-- 3. RPC — GENERER les occurrences d'une regle (D-R1 : rapport de conflits)
-- ----------------------------------------------------------------------------
--   Pour chaque date projetee dans [bornes regle] x [fenetre demandee] :
--     · deja une occurrence de cette regle a cette date -> 'existante'
--     · chevauche une mission (absence_conflits)        -> 'ignoree' + motif
--     · sinon                                            -> INSERT + 'creee'
--   La RPC ne leve JAMAIS d'exception sur un conflit : elle le RAPPORTE.
--   C'est tout l'objet de D-R1 — un seul lundi en conflit ne doit pas
--   bloquer les 40 autres.
-- ============================================================================
create or replace function public.generer_absences_recurrentes(
  p_regle_id uuid,
  p_from     date,
  p_to       date
)
returns table (
  out_date       date,
  out_statut     text,     -- 'creee' | 'existante' | 'ignoree_conflit'
  out_detail     text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_regle     public.absences_salarie%rowtype;
  v_jours     int[];
  v_h_deb     time;
  v_h_fin     time;
  v_borne_deb date;
  v_borne_fin date;
  v_d         date;
  v_conf      int;
  v_detail    text;
begin
  if not public._gs_peut_ecrire() then
    raise exception 'Réservé à l''administration (admin ou bureau).'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_regle from public.absences_salarie
  where id = p_regle_id and est_regle = true;
  if not found then
    raise exception 'Règle % introuvable.', p_regle_id using errcode = 'no_data_found';
  end if;

  -- D-R2 : recurrence reservee aux repos.
  if v_regle.nature is distinct from 'repos' then
    raise exception 'La récurrence ne s''applique qu''aux temps de repos.'
      using errcode = 'feature_not_supported';
  end if;

  if (v_regle.recurrence ->> 'frequence') is distinct from 'hebdomadaire' then
    raise exception 'Fréquence "%" non supportée (hebdomadaire seule).',
      v_regle.recurrence ->> 'frequence' using errcode = 'feature_not_supported';
  end if;

  select array_agg((j)::int) into v_jours
  from jsonb_array_elements_text(coalesce(v_regle.recurrence -> 'jours','[]'::jsonb)) as j;

  if v_jours is null or array_length(v_jours,1) is null then
    raise exception 'Aucun jour dans le rythme.' using errcode = 'invalid_parameter_value';
  end if;

  v_h_deb := nullif(v_regle.recurrence ->> 'heure_debut','')::time;
  v_h_fin := nullif(v_regle.recurrence ->> 'heure_fin','')::time;

  -- Bornes effectives : intersection [fenetre demandee] x [bornes regle].
  v_borne_deb := greatest(p_from, v_regle.date_debut);
  v_borne_fin := least(p_to, coalesce(v_regle.date_fin, p_to));

  v_d := v_borne_deb;
  while v_d <= v_borne_fin loop
    if extract(isodow from v_d)::int = any (v_jours) then

      -- Anti-duplication LOGIQUE (patron sql_117) : meme regle, meme date.
      if exists (
        select 1 from public.absences_salarie a
        where a.regle_id = p_regle_id and a.date_debut = v_d
      ) then
        out_date := v_d; out_statut := 'existante'; out_detail := null;
        return next;

      else
        -- D-R1 : conflit -> on IGNORE cette date et on la rapporte.
        select count(*), string_agg(
                 coalesce(to_char(c.out_heure_debut,'HH24:MI'),'--:--')
                 || ' ' || c.out_libelle, ' · ')
          into v_conf, v_detail
        from public.absence_conflits(
          v_regle.contrat_id, v_d, v_h_deb, v_d, v_h_fin, false) c;

        if v_conf > 0 then
          out_date := v_d; out_statut := 'ignoree_conflit'; out_detail := v_detail;
          return next;
        else
          insert into public.absences_salarie (
            contrat_id, nature, date_debut, heure_debut, date_fin, heure_fin,
            journee_entiere, motif, est_regle, regle_id
          ) values (
            v_regle.contrat_id, 'repos', v_d, v_h_deb, v_d, v_h_fin,
            false, v_regle.motif, false, p_regle_id
          );
          out_date := v_d; out_statut := 'creee'; out_detail := null;
          return next;
        end if;
      end if;

    end if;
    v_d := v_d + 1;
  end loop;

  return;
end;
$fn$;

-- ============================================================================
-- 4. RPC — lister les regles d'un contrat
-- ============================================================================
create or replace function public.list_regles_absence(p_contrat_id uuid)
returns table (
  out_id          uuid,
  out_date_debut  date,
  out_date_fin    date,
  out_heure_debut time,
  out_heure_fin   time,
  out_recurrence  jsonb,
  out_motif       text,
  out_nb_occurrences bigint
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.date_debut, r.date_fin, r.heure_debut, r.heure_fin,
         r.recurrence, r.motif,
         (select count(*) from public.absences_salarie f where f.regle_id = r.id)
  from public.absences_salarie r
  where r.contrat_id = p_contrat_id and r.est_regle = true
  order by r.date_debut;
$$;

-- ============================================================================
-- 5. Permissions
-- ============================================================================
revoke all on function
  public.upsert_regle_absence(uuid, uuid, date, date, int[], time, time, text),
  public.generer_absences_recurrentes(uuid, date, date),
  public.list_regles_absence(uuid)
  from public;

revoke all on function
  public.upsert_regle_absence(uuid, uuid, date, date, int[], time, time, text),
  public.generer_absences_recurrentes(uuid, date, date),
  public.list_regles_absence(uuid)
  from anon;

grant execute on function
  public.upsert_regle_absence(uuid, uuid, date, date, int[], time, time, text),
  public.generer_absences_recurrentes(uuid, date, date),
  public.list_regles_absence(uuid)
  to authenticated;

-- ============================================================================
-- 6. VERIFICATION fail-loud
-- ============================================================================
do $verif$
declare
  n_col int; n_rpc int;
begin
  select count(*) into n_col from information_schema.columns
    where table_schema='public' and table_name='absences_salarie'
      and column_name in ('recurrence','est_regle','regle_id');
  if n_col <> 3 then
    raise exception 'RECURRENCE KO : % colonnes sur 3 attendues.', n_col;
  end if;

  select count(*) into n_rpc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('upsert_regle_absence','generer_absences_recurrentes','list_regles_absence');
  if n_rpc <> 3 then
    raise exception 'RECURRENCE KO : % RPC sur 3 attendues.', n_rpc;
  end if;

  raise notice 'RECURRENCE OK : 3 colonnes + 3 RPC.';
end;
$verif$;

commit;
