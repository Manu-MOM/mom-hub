/*
 * compo-export.js — Export image d'une composition (feuille « document »)
 * ---------------------------------------------------------------------------
 * Module AUTONOME, rendu Canvas natif (zéro dépendance), exposé en global
 * window.CompoExport. Reproduit la charte graphique validée (maquette) :
 *   • version 'mom'     : fond vert bouteille, écusson MOM filigrane, accents jaunes
 *   • version 'entente' : fond bleu marine, bloc 3 logos, accents bleu ciel/jaune
 *
 * Périmètre v1 (décisions Manu) :
 *   • initiales uniquement (pas de photos joueurs)
 *   • pas de bloc staff (joueurs titulaires + remplaçants)
 *   • export PNG téléchargeable
 *
 * API publique :
 *   CompoExport.ouvrir(data)  → ouvre la modale (choix version + aperçu + DL)
 *   CompoExport.rendre(canvas, data, version) → dessine sur un canvas donné
 *
 * data = {
 *   titre:        'ENTENTE SAR×MOM M14',          // ligne 1 en-tête
 *   sousTitre:    'SAR/MOM 2',                     // ligne 2 en-tête (équipe)
 *   meta1:        'Championnat LRGER — Phase 2 · Composition de base',
 *   meta2:        '9 mai 2026 · Mutzig Ovalie Molsheim',
 *   titulaires:   [{num, nom, prenom, poste, club, ligne}],  // ligne ∈ 'av'|'ch'|'ar'
 *   remplacants:  [{num, nom}],                    // nom déjà compact, '–' si vide
 *   logos: { mom: '<url>', entente: '<url>' }      // images détourées (repo)
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

  // Dimensions de référence (mêmes que la maquette Pillow)
  var W = 1680, H = 2380;

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
  function rendre(canvas, data, version) {
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
      ctx.fillText(data.titre || '', tx, 42);
      ctx.font = font(40, 700, 'italic');
      ctx.fillStyle = (version === 'mom') ? rgb(t.headTxt) : rgb(t.jaune);
      ctx.fillText(data.sousTitre || '', tx, 112);
      ctx.fillStyle = rgb(t.headSub);
      ctx.font = font(26, 400);
      ctx.fillText(data.meta1 || '', tx, 172);
      ctx.font = font(24, 400);
      ctx.fillText(data.meta2 || '', tx, 202);

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
        '<div class="compo-export-preview"><canvas class="compo-export-canvas"></canvas></div>' +
        '<div class="compo-export-actions">' +
          '<button type="button" class="compo-export-dl">⬇ Télécharger l\'image (PNG)</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var canvas = overlay.querySelector('.compo-export-canvas');
    var version = 'mom';

    function refresh() {
      rendre(canvas, data, version);
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

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelector('.compo-export-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    overlay.querySelector('.compo-export-dl').addEventListener('click', function () {
      // s'assurer que le rendu est terminé avant l'extraction
      rendre(canvas, data, version).then(function () {
        var nom = 'compo-' + version + '-' + (data.slug || 'mom-hub') + '.png';
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
