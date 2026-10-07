-- ============================================================================
-- sql/C17-a-format-x-origine.sql
-- Chantier X-ORIGINE — retour terrain M16 Régionale (match du 10/10/2026)
--
-- OBJET
--   Rétablir la composition du rugby à X DICTÉE PAR MANU (sql/70, v3.22),
--   écrasée au pt 225 (sql_207) par la composition importée de SAR×MOM.
--
--     Avant (sql_207) : PG TAL PD 2LU 3LU DM DO AIU CTU AR
--     Cible (Manu)    : PG TAL PD 2LG 2LD DM DO CG  AD  AR
--                       = 1-2-3, deux 2L sur les extérieurs, 9-10-12-14-15
--
-- DÉCISIONS (FAIT FOI X-ORIGINE, Manu, 07/10/2026)
--   D1  Le jeton 'X' passe sur 2LG, 2LD, CG, AD et sort de 2LU, 3LU, CTU, AIU.
--   D2  AUCUNE migration de données : Manu ressaisit la compo du 10/10 à la
--       main (4 titulaires posés sur 2LU/3LU/CTU/AIU, sonde du 07/10).
--
-- PORTÉE
--   Seul le jeton 'X' de formats_applicables est touché. Les formats
--   XV, 13, 12, 9, 8, 7, 5 sont inchangés (2LU/3LU/CTU/AIU y restent).
--   Aucune ligne créée ni supprimée. composition_joueurs non touchée.
--
-- SÛRETÉ
--   Idempotent (array_append gardé, array_remove naturellement idempotent).
--   Vérification fail-loud : postes exacts du X + effectif des 8 formats.
--   Dry-run BEGIN…ROLLBACK joué sur la base de production avant livraison.
-- ============================================================================

begin;

-- 1 — Ajouts : les 4 postes de la consigne d'origine rejoignent le X.
update public.postes
   set formats_applicables = array_append(formats_applicables, 'X'),
       updated_at = now()
 where code in ('2LG', '2LD', 'CG', 'AD')
   and not est_regroupement
   and not ('X' = any(formats_applicables));

-- 2 — Retraits : les 4 postes génériques quittent le X (seulement le X).
update public.postes
   set formats_applicables = array_remove(formats_applicables, 'X'),
       updated_at = now()
 where code in ('2LU', '3LU', 'CTU', 'AIU')
   and 'X' = any(formats_applicables);

-- 3 — Vérification fail-loud.
do $verif$
declare
  v_attendu constant jsonb :=
    '{"XV":15,"13":13,"12":12,"X":10,"9":9,"8":8,"7":7,"5":5}'::jsonb;
  v_cible   constant text[] :=
    array['PG','TAL','PD','2LG','2LD','DM','DO','CG','AD','AR'];
  v_reels   text[];
  v_fmt     text;
  v_att     int;
  v_reel    int;
  v_ecarts  text := '';
begin
  -- 3.a — le X porte exactement les 10 postes de la consigne d'origine
  select array_agg(code order by code) into v_reels
    from public.postes
   where 'X' = any(formats_applicables)
     and not est_regroupement;

  if v_reels is distinct from (select array_agg(c order by c) from unnest(v_cible) c) then
    raise exception 'C17-a ECHEC : postes du X = % (attendu %)', v_reels, v_cible;
  end if;

  -- 3.b — effectif de chacun des 8 formats (non-régression)
  for v_fmt, v_att in select key, value::int from jsonb_each_text(v_attendu) loop
    select count(*) into v_reel
      from public.postes p
     where v_fmt = any(p.formats_applicables)
       and not p.est_regroupement;
    if v_reel <> v_att then
      v_ecarts := v_ecarts || format('  format %s : %s postes (attendu %s)%s',
                                     v_fmt, v_reel, v_att, chr(10));
    end if;
  end loop;

  if v_ecarts <> '' then
    raise exception 'C17-a ECHEC — effectifs non conformes :%s%s', chr(10), v_ecarts;
  end if;

  raise notice 'C17-a OK — X = 1-2-3 / 2LG 2LD / 9-10 / CG AD AR ; 8 formats conformes.';
end
$verif$;

commit;
