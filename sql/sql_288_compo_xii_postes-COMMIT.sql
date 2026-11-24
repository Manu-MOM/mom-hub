-- ============================================================
-- sql_288 — COMPO-XII (FAIT FOI gelé par Manu le 24/11/2026)
-- Retour terrain Vivien (M16, jeu à XII).
--   D1 : postes XII = 1 2 3 4 5 8 9 10 11 12 13 14
--        → '12' ajouté à 2LG / 2LD ; retiré à 2LU (garde '9') et AR.
--   D5 : compo de base du 28/11 (seule compo XII en base, brouillon) :
--        2LU (n°4) → 2LG ; joueur AR → banc n°19 (option A, reco suivie) ;
--        remplaçants 13-16 → 15-18 (banc XII numéroté à partir de 15, D3).
-- Version COMMIT.
-- ============================================================
BEGIN;

-- D1 — référentiel postes
UPDATE postes SET formats_applicables = array_append(formats_applicables, '12')
 WHERE code IN ('2LG','2LD') AND NOT ('12' = ANY(formats_applicables));
UPDATE postes SET formats_applicables = array_remove(formats_applicables, '12')
 WHERE code IN ('2LU','AR');

-- D5 — compo du 28/11 (7fbd7bb4-a941-438c-97e1-dab066b0948c)
UPDATE composition_joueurs
   SET poste_id = '55791942-1404-495d-9a71-d59ae6ecf7cf', numero_maillot = 4   -- 2LU → 2LG
 WHERE id = '4f6de984-c74f-4d86-9e6e-b4903f2c6ab4' AND role = 'titulaire';
UPDATE composition_joueurs
   SET numero_maillot = numero_maillot + 2                                     -- banc 13-16 → 15-18
 WHERE composition_id = '7fbd7bb4-a941-438c-97e1-dab066b0948c'
   AND role = 'remplacant' AND numero_maillot BETWEEN 13 AND 16;
UPDATE composition_joueurs
   SET role = 'remplacant', numero_maillot = 19                                -- AR → banc n°19
 WHERE id = '6f3bbde2-4a7b-477b-8f41-99a751eb2cfe' AND role = 'titulaire';

DO $verif$
DECLARE v_codes text;
BEGIN
  SELECT string_agg(code, ',' ORDER BY numero_xv, code) INTO v_codes
    FROM postes WHERE '12' = ANY(formats_applicables);
  IF v_codes <> 'PG,TAL,PD,2LG,2LD,3LU,DM,DO,AG,CG,CD,AD' THEN
    RAISE EXCEPTION 'KO postes XII : %', v_codes; END IF;
  IF NOT EXISTS (SELECT 1 FROM postes WHERE code='2LU' AND '9' = ANY(formats_applicables)) THEN
    RAISE EXCEPTION 'KO : 2LU a perdu le format 9'; END IF;
  IF (SELECT count(*) FROM composition_joueurs WHERE composition_id='7fbd7bb4-a941-438c-97e1-dab066b0948c') <> 16 THEN
    RAISE EXCEPTION 'KO : nb joueurs compo <> 16'; END IF;
  IF (SELECT count(*) FROM composition_joueurs WHERE composition_id='7fbd7bb4-a941-438c-97e1-dab066b0948c' AND role='titulaire') <> 11 THEN
    RAISE EXCEPTION 'KO : nb titulaires <> 11'; END IF;
  IF (SELECT string_agg(numero_maillot::text, ',' ORDER BY numero_maillot) FROM composition_joueurs
       WHERE composition_id='7fbd7bb4-a941-438c-97e1-dab066b0948c' AND role='remplacant') <> '15,16,17,18,19' THEN
    RAISE EXCEPTION 'KO : numéros du banc'; END IF;
  IF EXISTS (SELECT 1 FROM composition_joueurs cj JOIN postes p ON p.id::text = cj.poste_id::text
              WHERE cj.composition_id='7fbd7bb4-a941-438c-97e1-dab066b0948c' AND cj.role='titulaire'
                AND p.code IN ('2LU','AR')) THEN
    RAISE EXCEPTION 'KO : titulaire resté sur 2LU/AR'; END IF;
  RAISE NOTICE 'sql_288 OK';
END $verif$;

COMMIT;
