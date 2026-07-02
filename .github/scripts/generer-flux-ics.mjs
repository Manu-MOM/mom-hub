#!/usr/bin/env node
/* ============================================================================
 * generer-flux-ics.mjs
 * SYNC-AGENDA-SORTANTE — générateur du flux .ics publié (T2/T3).
 * Conforme au FAIT FOI « Conception-Sync-Agenda-Sortante-v1.md » (figé le
 * 02/07/2026, gate amont pt 137). Plateforme licences FFR : OVAL-E (avec A).
 *
 * RÔLE : exécuté par le workflow GitHub Actions dédié. Lit la RPC
 * flux_seances_salarie (sql_144, projection minimale) via l'API REST Supabase
 * (clé anon — mêmes secrets que le keep-alive), génère data/lohann.ics.
 * Le commit-si-changement (D2) est du ressort du WORKFLOW, pas du script.
 *
 * DÉCISIONS APPLIQUÉES :
 *   D3 : UID = {seance_id}@mom-hub (stable, symétrique de gcal_uid).
 *   D4 : SUMMARY = libellé mission ; suffixe « · réalisée » / « · validée ».
 *   D8 : DESCRIPTION = état en toutes lettres + lien suivi-salarie.html.
 *   D9 : STATUS iCal = TENTATIVE (prévue) | CONFIRMED (réalisée, validée).
 *   T3 (tranché ici, délégué par le FAIT FOI) :
 *     - Émission en HEURE LOCALE avec TZID=Europe/Paris + bloc VTIMEZONE
 *       embarqué (règles DST européennes) : zéro conversion, zéro piège DST —
 *       les heures stockées SONT des heures de Paris.
 *     - Séance sans heure_debut → événement « journée entière ».
 *     - Séance avec heure mais duree_min NULL → durée par défaut 60 min
 *       (affichage agenda ; n'existe nulle part ailleurs que dans le flux).
 *   DÉTERMINISME (au service de D2) : DTSTAMP = updated_at de la séance
 *     (jamais now()) → deux exécutions sans changement de données produisent
 *     un fichier OCTET-IDENTIQUE → le hash-compare du workflow tient.
 *
 * RFC 5545 : fins de ligne CRLF ; pliage à 75 octets SANS couper un caractère
 * UTF-8 (accents !) ; échappement \\ \; \, et sauts de ligne dans les valeurs.
 *
 * ENTRÉES (env) : SUPABASE_URL, SUPABASE_ANON_KEY, SALARIE_ID,
 *   SORTIE_ICS (défaut data/lohann.ics), CALENDRIER_NOM (défaut
 *   « Missions Lohann · MOM Hub »).
 * SORTIE : fichier .ics ; code retour 0 ; TOUT échec réseau/HTTP/parse → exit 1
 *   fail-loud (le workflow ne committe alors rien : jamais de fichier vide
 *   par accident).
 * AUTOTEST : `node generer-flux-ics.mjs --autotest` — jeu d'essai embarqué,
 *   zéro réseau, assertions sur pliage/échappement/UID/journée entière/
 *   bascule de minuit. Sert aussi de preuve à la recette (critère 1).
 * ============================================================================ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const CRLF = '\r\n';
const LIEN_HUB = 'https://manu-mom.github.io/mom-hub/suivi-salarie.html';

/* ---------------------------------------------------------------------------
 * Helpers purs (testés par --autotest)
 * ------------------------------------------------------------------------- */

function pad2(n) { return String(n).padStart(2, '0'); }

/** Échappement RFC 5545 §3.3.11 pour les valeurs TEXT. */
export function icsEchappe(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Pliage à 75 octets max par ligne, continuation « espace », sans couper un
 *  point de code UTF-8 (on recule tant que l'octet est une continuation). */
export function icsPlie(ligne) {
  const buf = Buffer.from(ligne, 'utf8');
  if (buf.length <= 75) return ligne;
  const morceaux = [];
  let debut = 0;
  let premier = true;
  while (debut < buf.length) {
    const max = premier ? 75 : 74; // continuation : 1 octet d'espace en tête
    let fin = Math.min(debut + max, buf.length);
    // Ne jamais couper au milieu d'un caractère multi-octets.
    while (fin > debut && fin < buf.length && (buf[fin] & 0xC0) === 0x80) fin--;
    morceaux.push((premier ? '' : ' ') + buf.slice(debut, fin).toString('utf8'));
    debut = fin;
    premier = false;
  }
  return morceaux.join(CRLF);
}

/** 'YYYY-MM-DD' + n jours → 'YYYY-MM-DD' (calcul en UTC, dates pures). */
export function ajouteJours(dateISO, n) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
}

/** 'YYYY-MM-DD' → 'YYYYMMDD'. */
export function dtDate(dateISO) { return dateISO.replace(/-/g, ''); }

/** 'HH:MM[:SS]' → { h, mn } ou null si inexploitable. */
export function parseHeure(heure) {
  const m = /^(\d{2}):(\d{2})/.exec(String(heure == null ? '' : heure));
  return m ? { h: +m[1], mn: +m[2] } : null;
}

/** Début local Paris → 'YYYYMMDDTHHMMSS' (pas de conversion : heure locale). */
export function dtLocal(dateISO, h, mn) {
  return dtDate(dateISO) + 'T' + pad2(h) + pad2(mn) + '00';
}

/** Fin = début + durée (minutes), avec bascule de minuit éventuelle. */
export function calculeFin(dateISO, h, mn, dureeMin) {
  const total = h * 60 + mn + dureeMin;
  const jours = Math.floor(total / 1440);
  const reste = total - jours * 1440;
  return { dateISO: jours ? ajouteJours(dateISO, jours) : dateISO,
           h: Math.floor(reste / 60), mn: reste % 60 };
}

/** updated_at ISO → DTSTAMP UTC 'YYYYMMDDTHHMMSSZ' (déterminisme D2). */
export function dtStamp(updatedAtISO, dateSeanceISO) {
  const d = new Date(updatedAtISO || (dateSeanceISO + 'T00:00:00Z'));
  if (isNaN(d.getTime())) return dtDate(dateSeanceISO) + 'T000000Z';
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) +
         'T' + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z';
}

const ETATS = {
  prevue:   { libelle: 'Prévue',   suffixe: '',             status: 'TENTATIVE' },
  realisee: { libelle: 'Réalisée', suffixe: ' · réalisée',  status: 'CONFIRMED' },
  validee:  { libelle: 'Validée',  suffixe: ' · validée',   status: 'CONFIRMED' }
};

/** Une ligne RPC → tableau de lignes ICS (VEVENT complet). */
export function construitEvenement(r) {
  const etat = ETATS[r.out_etat] || ETATS.prevue;
  const lignes = ['BEGIN:VEVENT'];
  lignes.push('UID:' + r.out_seance_id + '@mom-hub');
  lignes.push('DTSTAMP:' + dtStamp(r.out_updated_at, r.out_date_seance));

  const heure = parseHeure(r.out_heure_debut);
  if (!heure) {
    // T3 : journée entière (DTEND exclusif = lendemain, RFC 5545).
    lignes.push('DTSTART;VALUE=DATE:' + dtDate(r.out_date_seance));
    lignes.push('DTEND;VALUE=DATE:' + dtDate(ajouteJours(r.out_date_seance, 1)));
  } else {
    const duree = (r.out_duree_min != null && r.out_duree_min > 0) ? r.out_duree_min : 60; // T3
    const fin = calculeFin(r.out_date_seance, heure.h, heure.mn, duree);
    lignes.push('DTSTART;TZID=Europe/Paris:' + dtLocal(r.out_date_seance, heure.h, heure.mn));
    lignes.push('DTEND;TZID=Europe/Paris:' + dtLocal(fin.dateISO, fin.h, fin.mn));
  }

  lignes.push('SUMMARY:' + icsEchappe((r.out_mission_libelle || 'Séance') + etat.suffixe));
  lignes.push('DESCRIPTION:' + icsEchappe('État : ' + etat.libelle + '\nSéance dans le Hub : ' + LIEN_HUB));
  if (r.out_lieu) lignes.push('LOCATION:' + icsEchappe(r.out_lieu));
  lignes.push('STATUS:' + etat.status);
  lignes.push('END:VEVENT');
  return lignes;
}

/** Rangées RPC → contenu .ics complet (CRLF, plié). */
export function construitCalendrier(rangees, nomCalendrier) {
  // Tri redondant avec l'ORDER BY de la RPC : déterminisme défensif (D2).
  const tri = [...rangees].sort((a, b) =>
    (a.out_date_seance || '').localeCompare(b.out_date_seance || '') ||
    (a.out_heure_debut || '99').localeCompare(b.out_heure_debut || '99') ||
    (a.out_seance_id || '').localeCompare(b.out_seance_id || ''));

  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MOM Hub//Sync Agenda Sortante v1//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEchappe(nomCalendrier),
    'X-WR-TIMEZONE:Europe/Paris',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];
  for (const r of tri) lignes.push(...construitEvenement(r));
  lignes.push('END:VCALENDAR');
  return lignes.map(icsPlie).join(CRLF) + CRLF;
}

/* ---------------------------------------------------------------------------
 * Autotest embarqué (zéro réseau) — preuve pour la recette (critère 1).
 * ------------------------------------------------------------------------- */
function autotest() {
  const jeu = [
    { out_seance_id: '11111111-1111-1111-1111-111111111111',
      out_date_seance: '2026-09-15', out_heure_debut: '14:00:00',
      out_duree_min: 90, out_etat: 'prevue',
      out_mission_libelle: 'Cycle rugby — École élémentaire de Molsheim, classes de CM1 & CM2 (période 1)',
      out_lieu: 'Gymnase municipal; entrée B, rue du Stade', out_updated_at: '2026-07-01T10:00:00+00:00' },
    { out_seance_id: '22222222-2222-2222-2222-222222222222',
      out_date_seance: '2026-09-10', out_heure_debut: '23:30:00',
      out_duree_min: 90, out_etat: 'realisee',
      out_mission_libelle: 'Réunion de préparation', out_lieu: null,
      out_updated_at: '2026-07-01T11:30:45+00:00' },
    { out_seance_id: '33333333-3333-3333-3333-333333333333',
      out_date_seance: '2026-09-20', out_heure_debut: null,
      out_duree_min: null, out_etat: 'validee',
      out_mission_libelle: 'Stage vacances', out_lieu: 'Mutzig',
      out_updated_at: '2026-07-01T12:00:00+00:00' },
    { out_seance_id: '44444444-4444-4444-4444-444444444444',
      out_date_seance: '2026-09-15', out_heure_debut: '10:15:00',
      out_duree_min: null, out_etat: 'prevue',
      out_mission_libelle: 'Entraînement interne', out_lieu: null,
      out_updated_at: '2026-07-01T13:00:00+00:00' }
  ];
  const ics = construitCalendrier(jeu, 'Missions Lohann · MOM Hub');
  const echoue = (msg) => { console.error('AUTOTEST KO : ' + msg); process.exit(1); };

  // 1) CRLF strict (aucun LF isolé).
  if (/[^\r]\n/.test(ics) || ics.indexOf('\r\n') === -1) echoue('fins de ligne non CRLF');
  // 2) Pliage : chaque ligne physique ≤ 75 octets.
  for (const l of ics.split(CRLF)) {
    if (Buffer.byteLength(l, 'utf8') > 75) echoue('ligne > 75 octets : ' + l.slice(0, 40) + '…');
  }
  // 3) 4 événements, UID @mom-hub (D3).
  if ((ics.match(/BEGIN:VEVENT/g) || []).length !== 4) echoue('nombre de VEVENT ≠ 4');
  if ((ics.match(/@mom-hub/g) || []).length !== 4) echoue('UID @mom-hub manquants');
  // 4) Suffixes d'état (D4) + STATUS (D9) — dépliés avant contrôle.
  const deplie = ics.replace(new RegExp(CRLF + ' ', 'g'), '');
  if (deplie.indexOf('· réalisée') === -1 || deplie.indexOf('· validée') === -1) echoue('suffixes d\'état absents');
  if (deplie.indexOf('STATUS:TENTATIVE') === -1 || deplie.indexOf('STATUS:CONFIRMED') === -1) echoue('STATUS absents');
  // 5) Échappement : le « ; » du lieu doit être échappé.
  if (deplie.indexOf('municipal\\;') === -1) echoue('échappement RFC 5545 défaillant');
  // 6) Bascule de minuit : 23:30 + 90 min → DTEND le 11/09 à 01:00.
  if (deplie.indexOf('DTEND;TZID=Europe/Paris:20260911T010000') === -1) echoue('bascule de minuit fausse');
  // 7) Journée entière : DTEND exclusif au lendemain.
  if (deplie.indexOf('DTSTART;VALUE=DATE:20260920') === -1 ||
      deplie.indexOf('DTEND;VALUE=DATE:20260921') === -1) echoue('journée entière fausse');
  // 8) Durée par défaut 60 min (T3) : 10:15 → 11:15.
  if (deplie.indexOf('DTEND;TZID=Europe/Paris:20260915T111500') === -1) echoue('durée par défaut 60 min fausse');
  // 9) Déterminisme : deux constructions = octets identiques.
  if (ics !== construitCalendrier(jeu, 'Missions Lohann · MOM Hub')) echoue('sortie non déterministe');

  console.log('AUTOTEST OK : 9 contrôles passés (' + Buffer.byteLength(ics, 'utf8') + ' octets générés).');
}

/* ---------------------------------------------------------------------------
 * Point d'entrée
 * ------------------------------------------------------------------------- */
async function principal() {
  if (process.argv.includes('--autotest')) { autotest(); return; }

  const url    = process.env.SUPABASE_URL;
  const cle    = process.env.SUPABASE_ANON_KEY;
  const salarie = process.env.SALARIE_ID;
  const sortie = process.env.SORTIE_ICS || 'data/lohann.ics';
  const nomCal = process.env.CALENDRIER_NOM || 'Missions Lohann · MOM Hub';

  if (!url || !cle || !salarie) {
    console.error('ÉCHEC : SUPABASE_URL, SUPABASE_ANON_KEY et SALARIE_ID sont requis.');
    process.exit(1);
  }

  const rep = await fetch(url.replace(/\/+$/, '') + '/rest/v1/rpc/flux_seances_salarie', {
    method: 'POST',
    headers: {
      'apikey': cle,
      'Authorization': 'Bearer ' + cle,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_salarie_id: salarie })
  });

  if (!rep.ok) {
    console.error('ÉCHEC HTTP ' + rep.status + ' sur flux_seances_salarie : ' + (await rep.text()).slice(0, 500));
    process.exit(1); // fail-loud : le workflow ne committera rien.
  }

  const rangees = await rep.json();
  if (!Array.isArray(rangees)) {
    console.error('ÉCHEC : réponse RPC inattendue (tableau attendu).');
    process.exit(1);
  }

  const ics = construitCalendrier(rangees, nomCal);
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, ics, 'utf8');
  console.log('OK : ' + rangees.length + ' séance(s) → ' + sortie +
              ' (' + Buffer.byteLength(ics, 'utf8') + ' octets).');
}

// Garde « module principal » : exécuté par le workflow (node …mjs), mais
// importable sans effet de bord (autotest externe, réutilisation des helpers).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  principal().catch((e) => { console.error('ÉCHEC : ' + (e && e.message || e)); process.exit(1); });
}
