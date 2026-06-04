/*
 * compo-export.js — Export image d'une composition (feuille « document »)
 * ---------------------------------------------------------------------------
 * Module AUTONOME, rendu Canvas natif (zéro dépendance), exposé en global
 * window.CompoExport. Reproduit la charte graphique validée (maquette) :
 *   • version 'mom'     : fond vert bouteille, écusson MOM filigrane, accents jaunes
 *   • version 'entente' : fond bleu marine, bloc 3 logos, accents bleu ciel/jaune
 *
 * Périmètre v2 :
 *   • initiales uniquement (pas de photos joueurs — dette EXPORT-PHOTOS-JOUEURS :
 *     aucune source photo en base + droit image réseaux non exploité sur mineurs)
 *   • staff = encadrants de l'évènement (data.staff, via getEvenementWithEncadrants)
 *   • 2 formats : 'vertical' (1680×2380, liste 2 colonnes — v1 inchangée) et
 *     'paysage' (1920×1080, liste+staff à gauche / terrain à droite)
 *   • export PNG téléchargeable
 *
 * API publique :
 *   CompoExport.ouvrir(data)  → modale (choix version MOM/entente + format + DL)
 *   CompoExport.rendre(canvas, data, version, format) → dessine (format défaut 'vertical')
 *
 * data = {
 *   titre, sousTitre, meta1, meta2,
 *   titulaires:   [{num, nom, prenom, poste, code, club, ligne}],  // code = code poste (placement terrain), ligne ∈ 'av'|'ch'|'ar'
 *   remplacants:  [{num, nom}],
 *   staff:        [{nom, prenom, roles}],          // roles = roles_encadrement[]
 *   logos: { mom, entente }
 * }
 */
(function () {
  'use strict';

  // ── Palettes par version ────────────────────────────────────────────────
  var THEMES = {
    mom: {
      bgTop: [16, 40, 22], bgBot: [8, 22, 12],
      card: [20, 46, 26], card2: [14, 34, 18], staffBg: [10, 28, 15],
      headL: [30, 70, 38], headR: [40, 90, 48], headTxt: [255, 255, 255],
      headSub: [190, 220, 180],
      accent: [40, 90, 48], jaune: [240, 216, 0], blanc: [255, 255, 255],
      sub: [170, 210, 150], pied: [120, 150, 110],
      liseroAv: [240, 216, 0], liseroAr: [40, 90, 48],
      logoKey: 'mom', filigraneKey: 'mom', filigraneAlpha: 0.20, filigraneBright: 1.0,
      badge: { SAR: [150, 200, 235], MOM: [240, 216, 0], ASCS: [150, 200, 120] },
      badgeTxt: [8, 22, 12]
    },
    entente: {
      bgTop: [6, 18, 42], bgBot: [2, 8, 22],
      card: [18, 34, 64], card2: [14, 26, 50], staffBg: [6, 16, 40],
      headL: [0, 40, 90], headR: [20, 70, 45], headTxt: [255, 255, 255],
      headSub: [144, 216, 240],
      accent: [40, 80, 130], jaune: [240, 216, 0], blanc: [255, 255, 255],
      sub: [144, 216, 240], pied: [90, 110, 140],
      liseroAv: [144, 216, 240], liseroAr: [240, 216, 0],
      logoKey: 'entente', filigraneKey: null, filigraneAlpha: 0.07, filigraneBright: 1.0,
      badge: { SAR: [144, 216, 240], MOM: [240, 216, 0], ASCS: [120, 170, 220] },
      badgeTxt: [8, 28, 60]
    }
  };

  // ── Placement terrain (format paysage) ───────────────────────────────────
  // Copie EXACTE de TERRAIN_POS_XV de compositions-editor.js (vue Terrain de
  // l'app) : clés = code poste, valeurs = { x:%, y:% }, PACK EN HAUT → ARRIÈRE
  // EN BAS. Les deux écrans partagent ainsi rigoureusement le même placement.
  // Chaque joueur est posé par SON CODE POSTE (pas son numéro de maillot) :
  // un flanker n°6 (3LG) tombe à gauche, n°7 (3LD) à droite, automatiquement.
  var TERRAIN_POS_XV = {
    'PG':  { x: 30.0, y: 8.5 },  'TAL': { x: 45.0, y: 8.5 },  'PD':  { x: 60.0, y: 8.5 },
    '2LG': { x: 37.5, y: 19.9 }, '2LD': { x: 52.5, y: 19.9 },
    '3LG': { x: 22.5, y: 28.8 }, '3LD': { x: 67.5, y: 28.8 }, 'N8':  { x: 45.0, y: 33.2 },
    'DM':  { x: 33.8, y: 51.6 }, 'DO':  { x: 57.0, y: 59.2 },
    'AG':  { x: 12.5, y: 75.9 }, 'CG':  { x: 40.0, y: 75.9 }, 'CD':  { x: 65.0, y: 75.9 },
    'AD':  { x: 87.5, y: 75.9 }, 'AR':  { x: 50.0, y: 93.4 }
  };

  // Libellés courts des rôles d'encadrement (codes renvoyés par
  // get_evenement_with_encadrants → roles_encadrement[]). Repli = code brut
  // « humanisé » si absent de la table (dégradation honnête, jamais d'écran vide).
  var ROLE_STAFF_LABEL = {
    'coach_principal':   'Entr. principal',
    'coach':             'Entraîneur',
    'coach_adjoint':     'Entr. adjoint',
    'entraineur':        'Entraîneur',
    'entraineur_adjoint':'Entr. adjoint',
    'manager':           'Manager',
    'referent':          'Référent',
    'delegue':           'Délégué',
    'soigneur':          'Soigneur',
    'arbitre':           'Arbitre',
    'dirigeant':         'Dirigeant'
  };
  function libelleRoleStaff(roles) {
    var code = (Array.isArray(roles) && roles.length) ? String(roles[0]) : '';
    if (!code) return 'Staff';
    if (ROLE_STAFF_LABEL[code]) return ROLE_STAFF_LABEL[code];
    return code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
  }

  // Dimensions de référence par format.
  //   vertical : feuille « document » d'origine (v1, inchangée) 1680×2380
  //   paysage  : visuel réseaux liste+staff (gauche) / terrain (droite) 1920×1080
  var DIMS = {
    vertical: { W: 1680, H: 2380 },
    paysage:  { W: 1920, H: 1080 }
  };
  // Compat v1 : le rendu vertical référence W/H comme avant.
  var W = DIMS.vertical.W, H = DIMS.vertical.H;

  // ── Utilitaires couleur / police ─────────────────────────────────────────
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function font(px, weight, style) {
    // pile de polices condensées « sport » avec repli sûr
    var w = weight || 700;
    var s = style ? (style + ' ') : '';
    return s + w + ' ' + px + 'px "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
  }
  function initiales(prenom, nom) {
    var p = (prenom || '').trim(), n = (nom || '').trim();
    return ((p ? p[0] : '') + (n ? n[0] : '')).toUpperCase();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ── Chargement d'images (logos) avec cache ───────────────────────────────
  var _imgCache = {};
  function loadImage(url) {
    return new Promise(function (resolve) {
      if (!url) { resolve(null); return; }
      if (_imgCache[url]) { resolve(_imgCache[url]); return; }
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () { _imgCache[url] = im; resolve(im); };
      im.onerror = function () { resolve(null); }; // dégradation honnête : pas de logo
      im.src = url;
    });
  }

  // Dessine une image en préservant son ratio, dans une boîte de hauteur h.
  function drawImgH(ctx, im, x, y, h, alpha) {
    if (!im) return 0;
    var ratio = im.width / im.height;
    var w = Math.round(h * ratio);
    if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; }
    ctx.drawImage(im, x, y, w, h);
    if (alpha != null) ctx.restore();
    return w;
  }

  // ── Dégradé vertical de fond ──────────────────────────────────────────────
  function fondDegrade(ctx, top, bot) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(top));
    g.addColorStop(1, rgb(bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Rendu principal ───────────────────────────────────────────────────────
  // Renvoie une Promise (chargement des logos asynchrone).
  function rendreVertical(canvas, data, version) {
    var t = THEMES[version] || THEMES.mom;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';

    var logos = data.logos || {};
    return Promise.all([
      loadImage(logos[t.logoKey]),
      loadImage(logos[t.filigraneKey])
    ]).then(function (imgs) {
      var logoHead = imgs[0];
      var filigrane = imgs[1];

      // 1) Fond
      fondDegrade(ctx, t.bgTop, t.bgBot);

      // 2) Filigrane centré (écusson MOM) — derrière la compo
      if (filigrane) {
        var fh = 1850;
        var fw = Math.round(fh * (filigrane.width / filigrane.height));
        drawImgH(ctx, filigrane, Math.round(W / 2 - fw / 2), 470, fh, t.filigraneAlpha);
      }

      // 3) En-tête (dégradé horizontal)
      var hd = 230;
      var gh = ctx.createLinearGradient(0, 0, W, 0);
      gh.addColorStop(0, rgb(t.headL)); gh.addColorStop(1, rgb(t.headR));
      ctx.fillStyle = gh; ctx.fillRect(0, 0, W, hd);
      ctx.fillStyle = rgb(t.jaune); ctx.fillRect(0, hd - 5, W, 5);

      var logoW = 0;
      if (logoHead) logoW = drawImgH(ctx, logoHead, 40, 28, 174);
      var tx = 40 + (logoW || 0) + (logoW ? 45 : 0);

      ctx.fillStyle = rgb(t.headTxt);
      ctx.font = font(52, 700);
      ctx.fillText(data.titre || '', tx, 30);
      ctx.font = font(40, 700, 'italic');
      ctx.fillStyle = (version === 'mom') ? rgb(t.headTxt) : rgb(t.jaune);
      ctx.fillText(data.sousTitre || '', tx, 92);
      ctx.fillStyle = rgb(t.headSub);
      ctx.font = font(32, 500);
      ctx.fillText(data.meta1 || '', tx, 148);
      ctx.font = font(30, 500);
      ctx.fillText(data.meta2 || '', tx, 186);

      // 4) Titre de section
      var top = hd + 40;
      ctx.fillStyle = rgb(t.jaune);
      ctx.font = font(42, 700);
      ctx.fillText('LE XV DE DÉPART', 40, top);
      ctx.fillStyle = rgb(t.accent);
      ctx.fillRect(40, top + 58, W - 80, 4);

      // 5) Cartes joueurs (2 colonnes, réparties pour remplir la hauteur)
      var titulaires = data.titulaires || [];
      var remplacants = data.remplacants || [];
      var yCards = top + 90;
      // Bloc remplaçants ancré au bas (au-dessus du pied) : titre + filet (82)
      // + 4 rangées de 64 = 338px. Pied à H-40. On laisse ~30px de marge.
      var remRows = Math.ceil(Math.max(remplacants.length, 1) / 2);
      var blocRemplH = 82 + remRows * 64;
      var yRemplTitre = H - 70 - blocRemplH;
      var nbRows = Math.ceil(Math.max(titulaires.length, 1) / 2);
      var zone = yRemplTitre - 40 - yCards;
      var rowh = Math.floor(zone / Math.max(nbRows, 1));
      var ch = rowh - 16;
      var cw = Math.floor((W - 40 - 40 - 30) / 2);

      function carte(x, y, j) {
        ctx.fillStyle = rgb(t.card);
        roundRect(ctx, x, y, cw, ch, 14); ctx.fill();
        // liseré ligne
        var lis = (j.ligne === 'av') ? t.liseroAv : t.liseroAr;
        ctx.fillStyle = rgb(lis);
        ctx.fillRect(x, y + 8, 8, ch - 16);
        // numéro
        ctx.fillStyle = rgb(t.jaune);
        ctx.font = font(58, 700);
        ctx.fillText(String(j.num != null ? j.num : ''), x + 34, y + ch / 2 - 36);
        // pastille initiales
        var cx = x + 165, cy = y + ch / 2, rr = 46;
        ctx.fillStyle = rgb(t.card2);
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgb(version === 'mom' ? t.jaune : t.sub);
        ctx.font = font(34, 700);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initiales(j.prenom, j.nom), cx, cy + 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        // nom + sous-ligne
        ctx.fillStyle = rgb(t.blanc);
        ctx.font = font(38, 700);
        ctx.fillText((j.nom || '').toUpperCase(), x + 235, y + ch / 2 - 42);
        ctx.fillStyle = rgb(t.sub);
        ctx.font = font(24, 400);
        var sous = (j.prenom || '') + (j.poste ? ('  ·  ' + j.poste) : '');
        ctx.fillText(sous, x + 235, y + ch / 2 + 4);
        // badge club
        var club = (j.club || '').toUpperCase();
        if (club) {
          var bc = t.badge[club] || t.accent;
          ctx.font = font(22, 700);
          var bw = ctx.measureText(club).width + 28;
          ctx.fillStyle = rgb(bc);
          roundRect(ctx, x + cw - bw - 20, y + ch / 2 - 17, bw, 34, 7); ctx.fill();
          ctx.fillStyle = rgb(t.badgeTxt);
          ctx.fillText(club, x + cw - bw - 6, y + ch / 2 - 14);
        }
      }

      var y = yCards, i;
      for (i = 0; i < titulaires.length; i += 2) {
        carte(40, y, titulaires[i]);
        if (i + 1 < titulaires.length) carte(40 + cw + 30, y, titulaires[i + 1]);
        y += rowh;
      }

      // 6) Remplaçants
      ctx.fillStyle = rgb(t.jaune);
      ctx.font = font(38, 700);
      ctx.fillText('REMPLAÇANTS', 40, yRemplTitre);
      ctx.fillStyle = rgb(t.accent);
      ctx.fillRect(40, yRemplTitre + 54, W - 80, 3);
      var ry = yRemplTitre + 78, remh = 64;
      for (i = 0; i < remplacants.length; i++) {
        var r = remplacants[i];
        var col = i % 2, row = Math.floor(i / 2);
        var rx = 40 + col * (cw + 30), yy = ry + row * remh;
        var vide = (!r.nom || r.nom === '–');
        ctx.fillStyle = rgb(t.card2);
        roundRect(ctx, rx, yy, cw, remh - 12, 10); ctx.fill();
        ctx.fillStyle = vide ? 'rgb(110,110,90)' : rgb(t.jaune);
        ctx.font = font(32, 700);
        ctx.fillText(String(r.num != null ? r.num : ''), rx + 26, yy + 10);
        var pcx = rx + 118, pcy = yy + (remh - 12) / 2, prr = 22;
        ctx.fillStyle = rgb(vide ? t.card2 : t.card);
        ctx.beginPath(); ctx.arc(pcx, pcy, prr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = vide ? 'rgb(110,110,90)' : rgb(t.blanc);
        ctx.font = font(30, 700);
        ctx.fillText(vide ? '–' : r.nom, rx + 158, yy + 12);
      }

      // 6bis) Staff (encadrants de l'évènement) — bandeau condensé au-dessus du pied.
      // Source : data.staff (peut être vide → on n'affiche rien, dégradation honnête).
      var staff = (data.staff || []).filter(function (s) { return s && s.nom; });
      if (staff.length) {
        var syTitre = H - 96;
        ctx.fillStyle = rgb(t.jaune);
        ctx.font = font(26, 700);
        ctx.fillText('STAFF', 40, syTitre);
        ctx.font = font(24, 400);
        ctx.fillStyle = rgb(t.sub);
        var parts = staff.map(function (s) {
          var pr = (s.prenom || '').trim();
          var initPr = pr ? (pr.charAt(0).toUpperCase() + '. ') : '';
          return libelleRoleStaff(s.roles) + ' : ' + initPr + (s.nom || '').toUpperCase();
        });
        ctx.fillText(parts.join('   ·   '), 130, syTitre + 2);
      }

      // 7) Pied de page
      ctx.fillStyle = rgb(t.pied);
      ctx.font = font(20, 400);
      ctx.fillText((data.titre || '') + ' · SAISON 2025/2026', 40, H - 40);
      ctx.textAlign = 'right';
      ctx.fillText(data.dateExport || '', W - 40, H - 40);
      ctx.textAlign = 'left';

      return canvas;
    });
  }

  // ── Rendu PAYSAGE (1920×1080) : liste+staff à gauche, terrain à droite ────
  // Réutilise les mêmes helpers/THEMES que le vertical. Le terrain place les
  // joueurs par CODE POSTE via TERRAIN_POS_XV (placement = vue Terrain de l'app).
  function rendrePaysage(canvas, data, version) {
    var t = THEMES[version] || THEMES.mom;
    var PW = DIMS.paysage.W, PH = DIMS.paysage.H;
    canvas.width = PW; canvas.height = PH;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';

    var logos = data.logos || {};
    return Promise.all([
      loadImage(logos[t.logoKey]),
      loadImage(logos[t.filigraneKey] || logos[t.logoKey])
    ]).then(function (imgs) {
      var logoHead = imgs[0];
      var filigrane = imgs[1];

      // 1) Fond
      var g = ctx.createLinearGradient(0, 0, 0, PH);
      g.addColorStop(0, rgb(t.bgTop)); g.addColorStop(1, rgb(t.bgBot));
      ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);

      // 2) En-tête (bandeau dégradé horizontal + filet doré)
      var hd = 132;
      var gh = ctx.createLinearGradient(0, 0, PW, 0);
      gh.addColorStop(0, rgb(t.headL)); gh.addColorStop(1, rgb(t.headR));
      ctx.fillStyle = gh; ctx.fillRect(0, 0, PW, hd);
      ctx.fillStyle = rgb(t.jaune); ctx.fillRect(0, hd - 5, PW, 5);

      var logoW = 0;
      if (logoHead) logoW = drawImgH(ctx, logoHead, 36, 20, 96);
      var tx = 36 + (logoW || 0) + (logoW ? 30 : 0);
      ctx.textBaseline = 'top';
      ctx.fillStyle = rgb(t.headTxt); ctx.font = font(46, 700);
      ctx.fillText(data.titre || '', tx, 22);
      ctx.font = font(30, 700, 'italic');
      ctx.fillStyle = (version === 'mom') ? rgb(t.headTxt) : rgb(t.jaune);
      ctx.fillText(data.sousTitre || '', tx, 72);
      ctx.fillStyle = rgb(t.headSub); ctx.font = font(26, 500);
      var metaLine = [data.meta1, data.meta2].filter(Boolean).join('  ·  ');
      ctx.fillText(metaLine, tx + (data.sousTitre ? 150 : 0), 78);

      // ── Géométrie 2 colonnes ──
      var colGap = 0;
      var leftX = 0, leftW = Math.round(PW * 0.52);
      var rightX = leftW, rightW = PW - leftW;
      // séparateur
      ctx.fillStyle = rgb(t.accent);
      ctx.fillRect(leftW, hd + 14, 2, PH - hd - 34);

      // 3) COLONNE GAUCHE — liste + remplaçants + staff
      var pad = 30;
      var lx = leftX + pad;
      var lw = leftW - pad * 2;
      var y = hd + 26;

      ctx.fillStyle = rgb(t.jaune); ctx.font = font(30, 700);
      ctx.fillText('LE XV DE DÉPART', lx, y);
      ctx.fillStyle = rgb(t.accent); ctx.fillRect(lx, y + 40, lw, 3);
      y += 54;

      var titulaires = data.titulaires || [];
      var remplacants = data.remplacants || [];
      var staff = (data.staff || []).filter(function (s) { return s && s.nom; });

      // Hauteur réservée bas de colonne : remplaçants + staff.
      var remRows = Math.ceil(Math.max(remplacants.length, 1) / 2);
      var blocRem = 40 + remRows * 40;
      var blocStaff = staff.length ? (34 + staff.length * 32) : 0;
      var basReserve = blocRem + blocStaff + 24;

      var zone = (PH - 30 - basReserve) - y;
      var rowh = Math.max(34, Math.floor(zone / Math.max(titulaires.length, 1)));
      var ch = rowh - 6;

      function carteL(yy, j) {
        ctx.fillStyle = rgb(t.card);
        roundRect(ctx, lx, yy, lw, ch, 8); ctx.fill();
        var lis = (j.ligne === 'av') ? t.liseroAv : t.liseroAr;
        ctx.fillStyle = rgb(lis); ctx.fillRect(lx, yy + 4, 6, ch - 8);
        // numéro
        ctx.fillStyle = rgb(t.jaune); ctx.font = font(Math.min(28, ch - 6), 700);
        ctx.fillText(String(j.num != null ? j.num : ''), lx + 16, yy + ch / 2 - (Math.min(28, ch - 6) / 2));
        // pastille initiales
        var rr = Math.min(18, (ch - 8) / 2);
        var cx = lx + 70, cy = yy + ch / 2;
        ctx.fillStyle = rgb(t.card2);
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgb(version === 'mom' ? t.jaune : t.sub);
        ctx.font = font(Math.max(12, rr), 700);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initiales(j.prenom, j.nom), cx, cy + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        // nom + sous-ligne
        var tX = cx + rr + 14;
        ctx.fillStyle = rgb(t.blanc); ctx.font = font(Math.min(24, ch - 12), 700);
        ctx.fillText((j.nom || '').toUpperCase(), tX, yy + ch / 2 - Math.min(24, ch - 12) + 2);
        ctx.fillStyle = rgb(t.sub); ctx.font = font(Math.min(16, ch - 16), 400);
        var sous = (j.prenom || '') + (j.poste ? ('  ·  ' + j.poste) : '');
        ctx.fillText(sous, tX, yy + ch / 2 + 2);
      }
      var yy = y;
      for (var i = 0; i < titulaires.length; i++) { carteL(yy, titulaires[i]); yy += rowh; }

      // Remplaçants (2 colonnes)
      var yRem = PH - 30 - basReserve + 6;
      ctx.fillStyle = rgb(t.jaune); ctx.font = font(24, 700);
      ctx.fillText('REMPLAÇANTS', lx, yRem);
      var colW = Math.floor((lw - 16) / 2);
      var ry = yRem + 34;
      for (i = 0; i < remplacants.length; i++) {
        var r = remplacants[i];
        var col = i % 2, row = Math.floor(i / 2);
        var rx = lx + col * (colW + 16), ey = ry + row * 40;
        var vide = (!r.nom || r.nom === '–');
        ctx.fillStyle = rgb(t.card2); roundRect(ctx, rx, ey, colW, 34, 6); ctx.fill();
        ctx.fillStyle = vide ? 'rgb(110,110,90)' : rgb(t.jaune); ctx.font = font(20, 700);
        ctx.fillText(String(r.num != null ? r.num : ''), rx + 12, ey + 8);
        ctx.fillStyle = vide ? 'rgb(110,110,90)' : rgb(t.blanc); ctx.font = font(19, 700);
        ctx.fillText(vide ? '–' : r.nom, rx + 48, ey + 9);
      }

      // Staff (sous les remplaçants)
      if (staff.length) {
        var ys = ry + remRows * 40 + 12;
        ctx.fillStyle = rgb(t.jaune); ctx.font = font(24, 700);
        ctx.fillText('STAFF', lx, ys); ys += 30;
        for (i = 0; i < staff.length; i++) {
          var s = staff[i];
          ctx.fillStyle = rgb(t.card2); roundRect(ctx, lx, ys, lw, 28, 6); ctx.fill();
          ctx.fillStyle = rgb(t.sub); ctx.font = font(17, 500);
          ctx.fillText(libelleRoleStaff(s.roles), lx + 12, ys + 6);
          ctx.fillStyle = rgb(t.blanc); ctx.font = font(18, 700);
          var pr = (s.prenom || '').trim();
          var nm = (pr ? (pr.charAt(0).toUpperCase() + '. ') : '') + (s.nom || '').toUpperCase();
          ctx.fillText(nm, lx + 180, ys + 5);
          ys += 32;
        }
      }

      // 4) COLONNE DROITE — terrain
      var rpad = 28;
      var tX0 = rightX + rpad, tY0 = hd + 26;
      var tW = rightW - rpad * 2;
      ctx.fillStyle = rgb(t.jaune); ctx.font = font(28, 700);
      ctx.textAlign = 'center';
      ctx.fillText('SUR LE TERRAIN', rightX + rightW / 2, tY0);
      ctx.textAlign = 'left';
      var fieldY = tY0 + 42;
      var fieldH = PH - 30 - fieldY;
      // surface terrain
      ctx.fillStyle = rgb(t.card2);
      roundRect(ctx, tX0, fieldY, tW, fieldH, 12); ctx.fill();
      // clip pour le filigrane + lignes
      ctx.save();
      roundRect(ctx, tX0, fieldY, tW, fieldH, 12); ctx.clip();
      // filigrane derrière le terrain (écusson MOM / logo entente), ~16%
      if (filigrane) {
        var ffh = Math.round(fieldH * 0.7);
        var ffw = Math.round(ffh * (filigrane.width / filigrane.height));
        drawImgH(ctx, filigrane, Math.round(tX0 + tW / 2 - ffw / 2),
                 Math.round(fieldY + fieldH / 2 - ffh / 2), ffh, 0.16);
      }
      // lignes de terrain
      ctx.strokeStyle = rgb(t.accent); ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
      [0.14, 0.86].forEach(function (fx) {
        ctx.beginPath(); ctx.moveTo(tX0 + tW * fx, fieldY); ctx.lineTo(tX0 + tW * fx, fieldY + fieldH); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(tX0, fieldY + fieldH / 2); ctx.lineTo(tX0 + tW, fieldY + fieldH / 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();

      // pastilles joueurs par CODE POSTE
      var rPast = Math.max(20, Math.min(30, Math.round(tW / 14)));
      function pastille(j) {
        var pos = j.code ? TERRAIN_POS_XV[j.code] : null;
        if (!pos) return; // poste hors XV (autre format) : non placé, dégradation honnête
        var px = tX0 + tW * (pos.x / 100);
        var py = fieldY + fieldH * (pos.y / 100);
        var avant = (j.ligne === 'av');
        // disque : avants pleins jaune, arrières contour
        if (avant) {
          ctx.fillStyle = rgb(t.jaune);
          ctx.beginPath(); ctx.arc(px, py, rPast, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgb(t.bgBot);
        } else {
          ctx.fillStyle = rgb(t.card);
          ctx.beginPath(); ctx.arc(px, py, rPast, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = rgb(version === 'mom' ? t.jaune : t.sub); ctx.stroke();
          ctx.fillStyle = rgb(version === 'mom' ? t.jaune : t.sub);
        }
        ctx.font = font(Math.round(rPast * 0.62), 700);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initiales(j.prenom, j.nom), px, py);
        // numéro sous la pastille
        ctx.fillStyle = rgb(t.blanc); ctx.font = font(Math.round(rPast * 0.5), 700);
        ctx.fillText(String(j.num != null ? j.num : ''), px, py + rPast + 9);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      }
      for (i = 0; i < titulaires.length; i++) pastille(titulaires[i]);

      // 5) Pied de page
      ctx.fillStyle = rgb(t.pied); ctx.font = font(18, 400);
      ctx.fillText((data.titre || '') + ' · SAISON 2025/2026', 36, PH - 26);
      ctx.textAlign = 'right';
      ctx.fillText(data.dateExport || '', PW - 36, PH - 26);
      ctx.textAlign = 'left';

      return canvas;
    });
  }

  // ── Dispatcher de rendu (rétrocompat : format défaut = 'vertical') ────────
  function rendre(canvas, data, version, format) {
    if (format === 'paysage') return rendrePaysage(canvas, data, version);
    return rendreVertical(canvas, data, version);
  }

  // ── Modale (choix version + aperçu + téléchargement) ──────────────────────
  function ouvrir(data) {
    var overlay = document.createElement('div');
    overlay.className = 'compo-export-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.innerHTML =
      '<div class="compo-export-modal">' +
        '<div class="compo-export-head">' +
          '<span class="compo-export-title">Exporter la composition</span>' +
          '<button type="button" class="compo-export-close" aria-label="Fermer">✕</button>' +
        '</div>' +
        '<div class="compo-export-tabs">' +
          '<button type="button" class="compo-export-vtab is-active" data-version="mom">Version MOM</button>' +
          '<button type="button" class="compo-export-vtab" data-version="entente">Version entente</button>' +
        '</div>' +
        '<div class="compo-export-tabs compo-export-ftabs">' +
          '<button type="button" class="compo-export-ftab is-active" data-format="vertical">Vertical</button>' +
          '<button type="button" class="compo-export-ftab" data-format="paysage">Paysage (terrain)</button>' +
        '</div>' +
        '<div class="compo-export-preview"><canvas class="compo-export-canvas"></canvas></div>' +
        '<div class="compo-export-actions">' +
          '<button type="button" class="compo-export-dl">⬇ Télécharger l\'image (PNG)</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var canvas = overlay.querySelector('.compo-export-canvas');
    var version = 'mom';
    var format = 'vertical';

    function refresh() {
      rendre(canvas, data, version, format);
    }
    refresh();

    overlay.querySelectorAll('.compo-export-vtab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        overlay.querySelectorAll('.compo-export-vtab').forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        version = tab.getAttribute('data-version');
        refresh();
      });
    });

    overlay.querySelectorAll('.compo-export-ftab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        overlay.querySelectorAll('.compo-export-ftab').forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        format = tab.getAttribute('data-format');
        refresh();
      });
    });

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelector('.compo-export-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    overlay.querySelector('.compo-export-dl').addEventListener('click', function () {
      // s'assurer que le rendu est terminé avant l'extraction
      rendre(canvas, data, version, format).then(function () {
        var nom = 'compo-' + version + '-' + format + '-' + (data.slug || 'mom-hub') + '.png';
        canvas.toBlob(function (blob) {
          if (!blob) return;
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nom;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        }, 'image/png');
      });
    });
  }

  window.CompoExport = { ouvrir: ouvrir, rendre: rendre };
})();
