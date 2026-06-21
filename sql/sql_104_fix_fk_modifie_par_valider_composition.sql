-- sql_104_fix_fk_modifie_par_valider_composition.sql
--
-- OBJET : corriger la violation de FK compositions_modifie_par_fkey lors de la
--         validation d'une composition.
--
-- CAUSE (prouvee par sondes, pt 96) :
--   - compositions.modifie_par porte une FK -> personnes(id)        (sonde 1)
--   - compositions.cree_par    porte une FK -> personnes(id)        (sonde 2a)
--   - valider_composition ecrivait modifie_par = auth.uid()         (sonde 4)
--     soit un user_id auth dans une colonne attendant un personne_id.
--   => toute validation viole la FK (sauf coincidence auth.uid = personnes.id).
--   Helper de resolution disponible : qui_suis_je() -> TABLE(personne_id uuid).
--   Aucune autre fonction n'ecrit auth.uid() dans ces colonnes          (sonde 5).
--   Toutes les compos existantes ont modifie_par/cree_par a NULL : aucun
--   legacy a regulariser, pas de migration de donnees                 (sonde 2b).
--
-- CORRECTIF : resoudre le personne_id via qui_suis_je() et l'ecrire dans
--   modifie_par a la place de auth.uid(). Fail-loud si non resolu (compte non
--   relie) : la tracabilite de la validation ne doit pas etre NULL silencieux.
--
-- ADDITIVITE : seules deux insertions et une substitution d'une ligne.
--   Tout le reste du corps est identique au deploye (sonde 4).
--   Etapes 0/1/2/3/5 inchangees mot pour mot.

create or replace function public.valider_composition(p_id uuid)
 returns table(out_id uuid, out_etat text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_categorie_id uuid;
  v_etat_courant text;
  v_personne_id uuid;
begin
  -- 0. Existence : la compo doit exister (fail-loud explicite).
  select c.etat into v_etat_courant
  from public.compositions c
  where c.id = p_id;
  if not found then
    raise exception 'valider_composition : composition % introuvable.', p_id
      using errcode = 'no_data_found';
  end if;
  -- 1. Categorie de rattachement : derivee via le helper EXISTANT
  --    (meme expression que la policy UPDATE).
  v_categorie_id := public._b5_categorie_de_composition(p_id);
  -- 2. Capability AVANT l'etat : une personne sans droit ne doit pas pouvoir
  --    inferer l'etat de la compo via le message d'erreur.
  if not public.puis_je_faire('valider_compo', v_categorie_id) then
    raise exception 'valider_composition : droit insuffisant pour valider cette composition.'
      using errcode = 'insufficient_privilege';
  end if;
  -- 2bis. Resolution du personne_id courant pour la tracabilite (FK -> personnes).
  --       Fail-loud si non resolu : modifie_par ne doit jamais etre un NULL
  --       silencieux sur l'action de validation.
  v_personne_id := (select q.personne_id from public.qui_suis_je() q);
  if v_personne_id is null then
    raise exception 'valider_composition : compte courant non relie a une fiche personne (tracabilite impossible).'
      using errcode = 'no_data_found';
  end if;
  -- 3. Transition stricte : seul brouillon -> validee est legal.
  if v_etat_courant is distinct from 'brouillon' then
    raise exception 'valider_composition : transition illegale depuis l''etat "%". Seule brouillon -> validee est autorisee.', v_etat_courant
      using errcode = 'check_violation';
  end if;
  -- 4. Ecriture : etat + tracabilite modifie_par (personne_id, pas auth.uid()).
  update public.compositions c
     set etat        = 'validee',
         modifie_par = v_personne_id
   where c.id = p_id
     and c.etat = 'brouillon';   -- garde-course concurrente (last-writer coherent)
  -- 5. Retour de la ligne mutee (prefixe out_* — regle anti-ambiguite RETURNS TABLE).
  return query
    select c.id, c.etat
    from public.compositions c
    where c.id = p_id;
end;
$function$;

-- Bloc de verification fail-loud (n'execute aucune ecriture).
do $verif$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.valider_composition(uuid)'::regprocedure);
  if v_def ilike '%modifie_par = auth.uid()%' then
    raise exception 'VERIF KO : valider_composition ecrit encore auth.uid() dans modifie_par.';
  end if;
  if v_def not ilike '%modifie_par = v_personne_id%' then
    raise exception 'VERIF KO : valider_composition n''ecrit pas modifie_par = v_personne_id.';
  end if;
  if v_def not ilike '%qui_suis_je()%' then
    raise exception 'VERIF KO : valider_composition ne resout pas le personne_id via qui_suis_je().';
  end if;
  raise notice 'VERIF OK : valider_composition ecrit modifie_par = personne_id (qui_suis_je), plus auth.uid().';
end;
$verif$;
