-- =====================================================================
-- sql_285 — IMPORT-FFR-RATTRAPAGE v1, correctif de L2 : compos de base
-- ---------------------------------------------------------------------
-- Constat (Manu, 21/11/2026, page Statistiques) : les 10 matchs importés
-- par sql_284 n'apparaissent pas dans le pilotage de saison.
-- Cause (sonde DS-1) : pilotage_categorie_lignes ne lit une compo de match
-- que via sa compo de base (compo_base_origine_id → compo 'base' →
-- evenement_equipe_id → equipes → ententes.categorie_id). sql_284 a créé
-- des compos de match SANS compo de base. Défaut de L2 (consommateur non
-- lu avant livraison), corrigé ici.
--
-- Modèle existant reproduit (sondé sur M16 Nat J6 et le plateau amical
-- M16 du 19/09) :
--   • match simple : compo 'base' sur l'évènement, evenement_equipe_id =
--     son équipe engagée ; compo 'match' → compo_base_origine_id = base ;
--   • match enfant de plateau : la compo 'base' est sur le plateau parent
--     (équipe engagée du parent).
-- Contenu de la base = copie des joueurs de la compo de match (même
-- forme que les bases M16 existantes).
--
-- Rien d'autre n'est modifié (suivi, scores, compos de match intactes
-- hormis compo_base_origine_id).
--
-- Mode : COMMIT (sur feu vert explicite de Manu). Dry-run vert le
-- 21/11/2026 : VERIF OK ; pilotage → SR-F 3 matchs, Réserve 5, Seniors M 6.
-- =====================================================================

BEGIN;

CREATE TEMP TABLE _x ON COMMIT DROP AS
SELECT co.id AS match_id,
       co.evenement_id AS evt,
       coalesce(e.evenement_parent_id, e.id) AS base_evt
  FROM public.compositions AS co
  JOIN public.evenements AS e ON e.id = co.evenement_id
 WHERE co.notes_compo LIKE '%sql_284%'
   AND co.type_compo = 'match'
   AND co.compo_base_origine_id IS NULL;

-- 1. Une compo de base par évènement porteur (match, ou plateau parent)
INSERT INTO public.compositions
       (evenement_id, cote, etat, version, est_active, type_compo, evenement_equipe_id, notes_compo)
SELECT b.base_evt, 'mom', 'validee', 1, TRUE, 'base', q.id,
       'Base reconstituée depuis la feuille de match FFR — IMPORT-FFR-RATTRAPAGE, sql_285, 21/11/2026'
  FROM (SELECT DISTINCT base_evt FROM _x) AS b
  JOIN public.evenement_equipes_engagees AS q ON q.evenement_id = b.base_evt;

-- 2. Joueurs de la base = copie de la (des) compo(s) de match rattachée(s)
INSERT INTO public.composition_joueurs
       (composition_id, joueur_id, poste_id, numero_maillot, role, ordre_remplacement,
        est_depannage_hors_categorie, notes_joueur, etat_joueur, est_capitaine)
SELECT ba.id, cj.joueur_id, cj.poste_id, cj.numero_maillot, cj.role, cj.ordre_remplacement,
       cj.est_depannage_hors_categorie, cj.notes_joueur, cj.etat_joueur, cj.est_capitaine
  FROM _x
  JOIN public.composition_joueurs AS cj ON cj.composition_id = _x.match_id
  JOIN public.compositions AS ba
    ON ba.evenement_id = _x.base_evt AND ba.type_compo = 'base' AND ba.notes_compo LIKE '%sql_285%';

-- 3. Rattachement des compos de match à leur base
UPDATE public.compositions AS co
   SET compo_base_origine_id = ba.id
  FROM _x
  JOIN public.compositions AS ba
    ON ba.evenement_id = _x.base_evt AND ba.type_compo = 'base' AND ba.notes_compo LIKE '%sql_285%'
 WHERE co.id = _x.match_id;

-- 4. Vérification fail-loud : le chemin du pilotage voit les 10 matchs
DO $verif$
DECLARE
    v_n INTEGER;
BEGIN
    SELECT count(*) INTO v_n FROM _x;
    IF v_n <> 10 THEN RAISE EXCEPTION 'VERIF : % compo(s) de match à rattacher au lieu de 10', v_n; END IF;

    SELECT count(*) INTO v_n FROM public.compositions WHERE notes_compo LIKE '%sql_285%';
    IF v_n <> 10 THEN RAISE EXCEPTION 'VERIF : % compo(s) de base au lieu de 10', v_n; END IF;

    SELECT count(DISTINCT cm.evenement_id) INTO v_n
      FROM public.composition_joueurs AS cj
      JOIN public.compositions AS cm ON cm.id = cj.composition_id AND cm.cote = 'mom'
                                     AND cm.type_compo = 'match' AND cm.est_active
      JOIN public.compositions AS cb ON cb.id = cm.compo_base_origine_id
      JOIN public.evenement_equipes_engagees AS q ON q.id = cb.evenement_equipe_id
      JOIN public.equipes AS eq ON eq.id = q.equipe_id
      JOIN public.ententes AS en ON en.id = eq.entente_id
     WHERE cm.notes_compo LIKE '%sql_284%' AND cj.role IN ('titulaire', 'remplacant')
       AND en.categorie_id IN ('09b0829a-27a8-4ba2-a0f4-6f814f191a29', '10a2fbbb-c3db-466b-aa21-ca7bdc5e83d3');
    IF v_n <> 10 THEN RAISE EXCEPTION 'VERIF : % match(s) visibles par le pilotage au lieu de 10', v_n; END IF;
END $verif$;

COMMIT;
