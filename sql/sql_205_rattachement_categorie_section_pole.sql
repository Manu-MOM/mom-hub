-- pt 215 (chantier VOIE-ENTREE-ENCADRANT-SECTION) : rattacher la categorie SECTION a son pole.
--
-- CONSTAT : la categorie SECTION (b7e4d2a1..., code 'SECTION', type_categorie 'Section') ET
--   le pole Section (2f6a1c0e..., code 'SECTION') existent deja en base, mais la categorie
--   n'etait rattachee a AUCUN pole (poles.categories_rattachees = [] sur le pole Section).
--   Consequence : getPolesAvecCategories (grille pole -> categories) ne remontait pas SECTION,
--   donc invisible dans fonctions-staff.html (impossible d'y declarer un encadrant) ET dans
--   admin-equipes.html. La branche encadrants de get_joueurs_section (pt 212, cablee sur
--   code='SECTION') remontait donc 0 encadrant faute de source.
--
-- DOCTRINE (Manu, VISION 2) : la Section rugby scolaire est une categorie COMPLETE — elle peut
--   avoir des encadrants (referent, intervenants) ET des equipes (championnat UNSS). Aucun
--   filtrage : elle apparait comme les autres dans fonctions-staff (encadrants) et admin-equipes
--   (equipes). Toute l'infrastructure en aval est deja en place (get_joueurs_section pt 212,
--   unification staff pt 213) et prend automatiquement le relais.
--
-- CORRECTIF : ajout de 'SECTION' au tableau categories_rattachees du pole Section.
--   Idempotent (garde NOT ... = ANY). Purement additif (aucune categorie retiree d'un pole).
--   Verifie en base : le pole Section contient desormais ['SECTION'].

update public.poles
set categories_rattachees = array_append(categories_rattachees, 'SECTION')
where code = 'SECTION'
  and not ('SECTION' = any(categories_rattachees));

-- Verification fail-loud
do $verif$
declare
  v_ok boolean;
begin
  select ('SECTION' = any(categories_rattachees)) into v_ok
  from public.poles where code = 'SECTION';
  if not coalesce(v_ok, false) then
    raise exception 'KO : la categorie SECTION n''est pas rattachee au pole Section.';
  end if;
  raise notice 'VOIE-ENTREE-ENCADRANT-SECTION OK : categorie SECTION rattachee a son pole.';
end;
$verif$;
