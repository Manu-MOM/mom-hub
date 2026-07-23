-- ============================================================================
-- sql_207_postes_multi_format.sql
-- Chantier COMPO-MULTI-FORMAT (pt 225) — volet BASE
--
-- OBJET
--   Rendre la table `postes` capable de decrire les 8 formats de jeu reellement
--   pratiques, alors qu'elle n'en decrivait que 4 (XV, 13, X, 7) — et deux
--   d'entre eux de facon incoherente.
--
-- ORIGINE (remontee terrain, pt 224)
--   Le Referent M10 constate que la feuille de composition propose un
--   « XV de depart » sur un plateau M10 joue a VII. Le pt 224 a corrige la
--   PERSISTANCE du format (EVT-FORMAT-EDITION-READBACK). Reste la LECTURE :
--   la vue Liste de compositions-editor.js est mono-format. Ce fichier pose
--   le socle DONNEES ; le volet FRONT est livre separement.
--
-- MODELE DE REFERENCE
--   L'application SAR×MOM (Manu-MOM/sarmom-compos, index.html, const
--   COMPOS_FORMATS) modelise ces 8 formats et tourne en production depuis une
--   saison. Ce fichier TRANSPOSE ce modele eprouve — il n'invente aucune
--   composition. Ecart unique et assume : SAR×MOM utilise des postes
--   generiques au format XV (« 2eme ligne » x2, « Centre » x2) ; le Hub
--   conserve ses postes lateralises (2LG/2LD, CG/CD) — c'est l'existant,
--   52 lignes de composition l'utilisent, et le XV n'a aucun besoin de
--   generiques.
--
-- DECISIONS (Manu, gelees avant ecriture)
--   D-A  Les formats sont declares via `formats_applicables` (colonne deja
--        source de verite effective) et NON via de nouvelles colonnes
--        `codes_12/9/8/5`. Motif : les colonnes `codes_xv/13/x/7` existantes
--        sont NULL sur les 20 lignes depuis toujours et ne sont lues nulle
--        part dans le front — etendre un mecanisme mort serait un cout sans
--        contrepartie (P1).
--   D-B  Les postes generiques des formats reduits sont de NOUVELLES lignes
--        distinctes (est_regroupement=false), et NON un recyclage des
--        regroupements tactiques existants (PIL, 2L, 3L, CTR, AIL).
--        Motif (Manu, « pas de rustine, pas de bricolage ») : un regroupement
--        exprime une APTITUDE de substitution (« ce joueur couvre les deux
--        piliers ») ; un poste generique de format reduit est un POSTE DE JEU
--        reel sur la feuille de match. Deux concepts distincts -> deux objets
--        distincts. Les 5 regroupements restent intacts dans leur role.
--   D-C  Le format 5 (plateaux M10 de debut de saison, JCO/T2S) recoit des
--        postes NEUTRES « Joueur 1 » a « Joueur 5 ». Motif : la FFR ne
--        definit AUCUNE nomenclature de postes pour le 5x5 (verifie sur les
--        reglements 2025-2026 : ils ne fixent qu'un effectif et des regles de
--        contact). A 5, sans melee ni touche, il n'y a pas de poste fixe.
--        Employer des libelles de rugby a XV (pilier, talonneur) aurait ete
--        une FABRICATION, ecartee au titre de DS-1.
--
-- SURETE (sondes prealables, base de production)
--   (1) pg_constraint : AUCUNE cle etrangere entrante sur `postes`
--       (composition_joueurs.poste_id n'est pas contraint).
--   (2) composition_joueurs : les 52 lignes existantes n'utilisent QUE les 15
--       postes de terrain lateralises ; les 5 regroupements ont 0 utilisation.
--   (3) Aucune composition n'est aujourd'hui enregistree en format X ni 7.
--   => Les retraits de formats operes en section 2 ne peuvent orpheliner
--      aucune donnee existante.
--
-- NATURE DES ECRITURES
--   Section 1 : INSERT de 9 lignes (4 generiques + 5 neutres) — purement additif.
--   Section 2 : UPDATE de `formats_applicables` sur des lignes existantes —
--               ajouts ET RETRAITS. Les retraits sont NECESSAIRES : sans eux
--               les effectifs debordent (constate au test : le format 7
--               sortait a 9 postes, AG et CG portant '7' a tort). Aucune
--               colonne autre que `formats_applicables` n'est touchee ;
--               aucune ligne n'est supprimee.
--
-- IDEMPOTENCE
--   INSERT ... ON CONFLICT (code) DO NOTHING (contrainte postes_code_key).
--   UPDATE : array_remove est naturellement idempotent ; les array_append
--   sont gardes par un NOT ... = ANY(...) pour ne jamais empiler de doublon.
--
-- TESTE
--   Joue integralement en BEGIN; ... ROLLBACK; sur la base de production
--   avant livraison. Les 8 formats sortent aux effectifs attendus.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- SECTION 1 — Postes generiques des formats reduits (4) + neutres du 5 (5)
-- ---------------------------------------------------------------------------
-- `numero_xv` reprend celui de l'equivalent lateralise pour que le tri de
-- loadPostes() (ORDER BY numero_xv) reste sportivement coherent : la feuille
-- s'affiche dans l'ordre habituel avants -> demis -> trois-quarts -> arriere.
-- Les postes du format 5 ont numero_xv NULL (aucune correspondance XV) et
-- `ligne` NULL (ni melee ni touche a 5 : la notion de ligne n'a pas de sens).

insert into public.postes
  (code, libelle_long, libelle_court, numero_xv, ligne, est_regroupement,
   formats_applicables, postes_inclus_codes, description)
values
  ('2LU', 'Deuxième ligne', '2e ligne', 4, 'Deuxième ligne', false,
   array['12','X','9']::text[], array[]::text[],
   'Deuxième ligne unique des formats réduits (non latéralisé). Formats 12, X, 9.'),

  ('3LU', 'Troisième ligne', '3e ligne', 8, 'Troisième ligne', false,
   array['12','X','9','8','7']::text[], array[]::text[],
   'Troisième ligne unique des formats réduits (non latéralisé). Formats 12, X, 9, 8, 7.'),

  ('CTU', 'Centre', 'Centre', 12, 'Centres', false,
   array['X','9','8']::text[], array[]::text[],
   'Centre unique des formats réduits (non latéralisé). Formats X, 9, 8.'),

  ('AIU', 'Ailier', 'Ailier', 11, 'Ailiers', false,
   array['X','9','8','7']::text[], array[]::text[],
   'Ailier unique des formats réduits (non latéralisé). Formats X, 9, 8, 7.'),

  ('J1', 'Joueur 1', 'J1', null, null, false,
   array['5']::text[], array[]::text[],
   'Poste neutre du jeu à 5 (rugby éducatif JCO/T2S). La FFR ne définit aucune nomenclature de postes à 5.'),

  ('J2', 'Joueur 2', 'J2', null, null, false,
   array['5']::text[], array[]::text[],
   'Poste neutre du jeu à 5 (rugby éducatif JCO/T2S). La FFR ne définit aucune nomenclature de postes à 5.'),

  ('J3', 'Joueur 3', 'J3', null, null, false,
   array['5']::text[], array[]::text[],
   'Poste neutre du jeu à 5 (rugby éducatif JCO/T2S). La FFR ne définit aucune nomenclature de postes à 5.'),

  ('J4', 'Joueur 4', 'J4', null, null, false,
   array['5']::text[], array[]::text[],
   'Poste neutre du jeu à 5 (rugby éducatif JCO/T2S). La FFR ne définit aucune nomenclature de postes à 5.'),

  ('J5', 'Joueur 5', 'J5', null, null, false,
   array['5']::text[], array[]::text[],
   'Poste neutre du jeu à 5 (rugby éducatif JCO/T2S). La FFR ne définit aucune nomenclature de postes à 5.')

on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- SECTION 2 — Alignement des formats existants + declaration des nouveaux
-- ---------------------------------------------------------------------------

-- 2.a — RETRAITS. Le format X portait une composition incoherente : CG (centre
--       GAUCHE) sans CD, et AD (ailier DROIT) sans AG — un centre gauche seul
--       et un ailier droit seul sont un artefact de saisie, pas un choix
--       sportif. Ces postes lateralises cedent la place aux generiques CTU/AIU
--       poses en section 1. De meme 2LG/2LD cedent la place a 2LU.
update public.postes
   set formats_applicables = array_remove(formats_applicables, 'X'),
       updated_at = now()
 where code in ('2LG','2LD','CG','AD')
   and 'X' = any(formats_applicables);

-- 2.b — RETRAITS format 7. AG et CG portaient '7' alors que le VII se joue
--       avec un ailier UNIQUE et sans centre (cf. COMPOS_FORMATS SAR×MOM).
--       Sans ce retrait, le format 7 sort a 9 postes — ecart constate au test.
update public.postes
   set formats_applicables = array_remove(formats_applicables, '7'),
       updated_at = now()
 where code in ('AG','CG')
   and '7' = any(formats_applicables);

-- 2.c — Format 12 : melee conservee (1re ligne + 2LU + 3LU), ligne de
--       trois-quarts complete et lateralisee (2 centres, 2 ailiers, arriere).
update public.postes
   set formats_applicables = array_append(formats_applicables, '12'),
       updated_at = now()
 where code in ('PG','TAL','PD','DM','DO','CG','CD','AG','AD','AR')
   and not ('12' = any(formats_applicables));

-- 2.d — Format 9 : 1re ligne + 2LU + 3LU + demis + AIU + CTU.
update public.postes
   set formats_applicables = array_append(formats_applicables, '9'),
       updated_at = now()
 where code in ('PG','TAL','PD','DM','DO')
   and not ('9' = any(formats_applicables));

-- 2.e — Format 8 : idem 9 sans la deuxieme ligne.
update public.postes
   set formats_applicables = array_append(formats_applicables, '8'),
       updated_at = now()
 where code in ('PG','TAL','PD','DM','DO')
   and not ('8' = any(formats_applicables));

-- ---------------------------------------------------------------------------
-- SECTION 3 — Verification fail-loud
-- ---------------------------------------------------------------------------
-- Controle l'effectif de CHACUN des 8 formats. Toute divergence leve une
-- exception et annule la transaction : le fichier ne peut pas laisser la base
-- dans un etat ou un format produirait une feuille de match incoherente.
-- (Ce bloc a effectivement attrape l'erreur du format 7 lors des essais.)

do $verif$
declare
  v_attendu constant jsonb :=
    '{"XV":15,"13":13,"12":12,"X":10,"9":9,"8":8,"7":7,"5":5}'::jsonb;
  v_fmt     text;
  v_att     int;
  v_reel    int;
  v_ecarts  text := '';
  v_nb_new  int;
begin
  -- 3.a — les 9 lignes nouvelles sont bien presentes
  select count(*) into v_nb_new
    from public.postes
   where code in ('2LU','3LU','CTU','AIU','J1','J2','J3','J4','J5');

  if v_nb_new <> 9 then
    raise exception
      'sql_207 ECHEC : % postes nouveaux presents sur 9 attendus', v_nb_new;
  end if;

  -- 3.b — effectif de chaque format
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
    raise exception 'sql_207 ECHEC — effectifs non conformes :%s%s',
                    chr(10), v_ecarts;
  end if;

  -- 3.c — les regroupements tactiques n'ont pas ete alteres (D-B)
  select count(*) into v_reel
    from public.postes
   where code in ('PIL','2L','3L','CTR','AIL')
     and est_regroupement
     and cardinality(formats_applicables) = 0;

  if v_reel <> 5 then
    raise exception
      'sql_207 ECHEC : les 5 regroupements tactiques ont ete alteres (% conformes sur 5)',
      v_reel;
  end if;

  raise notice 'sql_207 OK — 8 formats conformes, 9 postes ajoutes, regroupements intacts.';
end
$verif$;

commit;

-- ============================================================================
-- ETAT ATTENDU APRES EXECUTION
--
--   XV : PG TAL PD 2LG 2LD 3LG 3LD N8 DM DO AG CG CD AD AR      (15) banc 8
--   13 : PG TAL PD 2LG 2LD N8 DM DO AG CG CD AD AR              (13) banc 6
--   12 : PG TAL PD 2LU 3LU DM DO AG CG CD AD AR                 (12) banc 4
--   X  : PG TAL PD 2LU 3LU DM DO AIU CTU AR                     (10) banc 10
--   9  : PG TAL PD 2LU 3LU DM DO AIU CTU                        (9)  banc 3
--   8  : PG TAL PD 3LU DM DO AIU CTU                            (8)  banc 2
--   7  : PG TAL PD 3LU DM DO AIU                                (7)  banc 6
--   5  : J1 J2 J3 J4 J5                                         (5)  banc a confirmer
--
-- Les effectifs de banc ci-dessus proviennent de COMPOS_FORMATS (SAR×MOM) et
-- ne sont PAS portes par ce fichier : ils relevent du volet FRONT
-- (NB_REMPLACANTS par format dans compositions-editor.js).
--
-- BANC DU FORMAT 5 — NON TRANCHE. Les sources divergent : reglement FFR
-- rugby educatif = 9 joueurs max par equipe (soit 5 + 4) ; cadre UNSS scolaire
-- = 5 remplacants. A arbitrer par Manu au volet front.
--
-- RESTE A FAIRE (volet FRONT, non couvert ici) :
--   compositions-editor.js — filtrer State.postes par format ; titre dynamique
--   (« Titulaires (n) », decision Q2) ; NB_REMPLACANTS par format ;
--   numerotation des remplacants ; tables de coordonnees terrain des nouveaux
--   formats (SAR×MOM fournit FXY, FXY7, FXY13 en repere 520x620, a transposer
--   vers le viewBox 100x140 en % du Hub) ; comportement au changement de
--   format d'une compo existante (decision Q4 : les joueurs sur postes
--   disparus sortent de la compo mais restent au groupe de base).
-- ============================================================================
