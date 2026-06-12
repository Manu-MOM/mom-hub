-- ████████████████████████████████████████████████████████████████████████████
-- ██                                                                          ██
-- ██   NE PAS EXÉCUTER — HYPOTHÈSE PRÉ-AVENANT CCNS                            ██
-- ██                                                                          ██
-- ██   Ce fichier est un DOCUMENT DE TRAVAIL pour la réunion avec le          ██
-- ██   spécialiste CCNS. Il N'EST PAS destiné à être exécuté en base.         ██
-- ██   Il ne crée AUCUNE donnée de production et n'amorce rien.               ██
-- ██                                                                          ██
-- ██   Statut identique à sql/54-rollback et au resync sql/01 : un artefact   ██
-- ██   SQL qui DOCUMENTE sans s'exécuter.                                     ██
-- ██                                                                          ██
-- ████████████████████████████████████████████████████████████████████████████
--
-- MOM Hub · Chantier « Gestion du salarié » — COMPTEUR D'HEURES / ANNUALISATION
-- Fichier (hypothèse) : compteur d'heures — annualisation Lohann
-- ----------------------------------------------------------------------------
-- OBJET : esquisser le modèle de données du DÉCOMPTE ANNUEL d'heures du salarié
--   (lissage / annualisation), pour cadrer la discussion avec le spécialiste
--   CCNS (IDCC 2511, potentiellement Chapitre V). RIEN ici n'est figé : ce sont
--   des HYPOTHÈSES de travail, à confronter aux termes de l'avenant SIGNÉ.
--
-- POURQUOI HORS PRODUCTION (partition décidée par Manu, kit §1) :
--   Ce qui entre en prod (sql/83 contrats_salaries) = l'OSSATURE STABLE dont les
--   termes ne dépendent PAS de l'avenant (personne, type, quotité, dates, statut).
--   Le compteur ci-dessous dépend de RÈGLES NON SIGNÉES (période de référence,
--   lissage, seuils d'heures hautes/basses, mode de décompte). Amorcer une table
--   de prod sur des règles non signées = créer une dette qui ne se corrige que
--   par MIGRATION DESTRUCTIVE sur données réelles. Asymétrie du coût d'erreur :
--   sous-modéliser s'étend par addition (byte-additif, doctrine projet) ;
--   sur-modéliser sur mauvaise hypothèse coûte une migration destructive.
--   => on attend l'avenant, on garde ceci comme support de cadrage.
--
-- PARAMÈTRES CONNUS À CE JOUR (à confirmer / corriger en réunion) :
--   - Contrat actuel : 35h/semaine, SANS clause d'annualisation.
--     L'annualisation nécessite un AVENANT contractuel signé.
--   - Période de référence SOUHAITÉE : 1er août -> 31 juillet (alignée saison Hub).
--     (Volontairement tenue HORS de contrats_salaries : constante club tant que
--      le compteur n'existe pas. Elle (re)devient une donnée le jour où ce
--      modèle est arrêté.)
--   - Volume annuel cible = quotité hebdo × nb de semaines travaillées de la
--     période de référence (à définir : 52 semaines ? déduction des congés ?
--     forfait CCNS ?). HYPOTHÈSE, à trancher avec le spécialiste.
--
-- ============================================================================
-- ⚠ TOUT CE QUI SUIT EST COMMENTÉ — exécution volontairement impossible.
--   Pour matérialiser ce modèle un jour : décommenter APRÈS signature de
--   l'avenant et APRÈS arbitrage des règles ci-dessous par le spécialiste.
-- ============================================================================

/*  ──────────────────────────────────────────────────────────────────────────
    HYPOTHÈSE 1 — PÉRIODE DE RÉFÉRENCE (rattachée à un contrat)
    Une période d'annualisation = une fenêtre [date_debut, date_fin] sur
    laquelle on compte les heures, rattachée à un contrat précis.

    create table public.periodes_annualisation (
      id                 uuid        primary key default gen_random_uuid(),
      contrat_id         uuid        not null references public.contrats_salaries(id) on delete cascade,
      libelle            text,                          -- ex. « Saison 2025-2026 »
      date_debut         date        not null,          -- ex. 2025-08-01
      date_fin           date        not null,          -- ex. 2026-07-31
      volume_annuel_cible_heures  numeric,              -- HYPOTHÈSE : à fixer (CCNS / avenant)
      created_at         timestamptz not null default now(),
      updated_at         timestamptz not null default now(),
      check (date_fin >= date_debut)
    );
    QUESTIONS RÉUNION :
      - Le volume annuel est-il un FORFAIT (chiffre CCNS) ou un CALCUL
        (quotité × semaines travaillées) ? Déduit-on les congés payés ?
      - La période est-elle TOUJOURS août->juillet, ou variable par contrat ?
    ────────────────────────────────────────────────────────────────────────── */

/*  ──────────────────────────────────────────────────────────────────────────
    HYPOTHÈSE 2 — SEUILS HEURES HAUTES / BASSES (modulation)
    L'annualisation autorise des semaines « hautes » et « basses » autour de la
    quotité moyenne, dans des limites fixées par la CCNS / l'avenant.

    alter table public.periodes_annualisation
      add column seuil_haut_hebdo_heures  numeric,   -- plafond hebdo (ex. 48 ?)
      add column seuil_bas_hebdo_heures   numeric;   -- plancher hebdo (ex. 0 ? 21 ?)
    QUESTIONS RÉUNION :
      - Quels plafonds/planchers hebdomadaires impose la CCNS (Chapitre V) ?
      - Déclenchement d'heures supplémentaires : au-delà du volume annuel,
        ou au-delà d'un seuil hebdo ? Majoration applicable ?
    ────────────────────────────────────────────────────────────────────────── */

/*  ──────────────────────────────────────────────────────────────────────────
    HYPOTHÈSE 3 — DÉCOMPTE DES HEURES RÉELLES (lissage)
    Le compteur a besoin d'un FLUX d'heures effectuées pour le confronter au
    volume cible. Deux sources candidates dans le Hub :
      (a) mission_seances.heures_reelles (déjà en base, socle pt 78) ;
      (b) une saisie d'heures dédiée hors missions (réunions, déplacements…).

    -- Option (b) : journal d'heures indépendant des missions
    create table public.releve_heures_salarie (
      id            uuid        primary key default gen_random_uuid(),
      contrat_id    uuid        not null references public.contrats_salaries(id) on delete cascade,
      date_jour     date        not null,
      heures        numeric     not null check (heures >= 0),
      categorie     text,        -- mission | reunion | deplacement | formation | autre
      mission_id    uuid        references public.missions(id) on delete set null,
      notes         text,
      created_at    timestamptz not null default now()
    );
    QUESTIONS RÉUNION :
      - Le décompte part-il des mission_seances (déjà saisies) ou d'un relevé
        séparé ? Faut-il intégrer réunions / déplacements / formation au compteur ?
      - Quelle granularité (jour / semaine) pour le lissage ?

    -- VUE de synthèse (esquisse, dépend des hypothèses 1-3) :
    -- create view public.v_compteur_annualisation as
    --   select pa.id as periode_id, pa.contrat_id,
    --          pa.volume_annuel_cible_heures as cible,
    --          coalesce(sum(rh.heures), 0)   as realisees,
    --          pa.volume_annuel_cible_heures - coalesce(sum(rh.heures),0) as solde
    --     from public.periodes_annualisation pa
    --     left join public.releve_heures_salarie rh
    --            on rh.contrat_id = pa.contrat_id
    --           and rh.date_jour between pa.date_debut and pa.date_fin
    --    group by pa.id, pa.contrat_id, pa.volume_annuel_cible_heures;
    ────────────────────────────────────────────────────────────────────────── */

-- ── FIN DU DOCUMENT D'HYPOTHÈSE — aucune instruction exécutable au-dessus ──
-- Décisions structurelles à rapporter de la réunion CCNS, à acter au STATE/CARTE
-- AVANT toute matérialisation : volume cible (forfait vs calcul), seuils hauts/bas,
-- source du flux d'heures (mission_seances vs relevé dédié), granularité du lissage.
