(function () {
  // Hide nav when embedded as an iframe in the library
  if (window.self !== window.top) return;

  var templates = [
    { file: 't1-quote',               num: '01', name: 'Client Testimonial / Quote' },
    { file: 't2-app-highlight',        num: '02', name: 'App Feature / Product Highlight' },
    { file: 't3-partner-alert',        num: '03', name: 'Partner Alert (Landscape)' },
    { file: 't4-fluid-ad',             num: '04', name: 'Fluid Capabilities \u2014 Instagram Ad' },
    { file: 't5-partner-announcement', num: '05', name: 'Partner Announcement (Landscape)' },
    { file: 't6-employee-spotlight',  num: '06', name: 'Employee Spotlight' },
    { file: 't7-carousel',            num: '07', name: 'Carousel \u2014 Insights',       carousel: true },
    { file: 't8-quarterly-stats',     num: '08', name: 'Quarterly Stats \u2014 Carousel', carousel: true }
  ];

  var path = window.location.pathname;
  var idx  = templates.findIndex(function(t) { return path.indexOf(t.file) !== -1; });
  if (idx === -1) return;

  var cur  = templates[idx];
  var prev = idx > 0                     ? templates[idx - 1] : null;
  var next = idx < templates.length - 1  ? templates[idx + 1] : null;

  /* ── Inject styles ───────────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    /* Bottom nav — original layout */
    '#tmpl-nav {',
    '  position:fixed;bottom:0;left:0;right:0;height:48px;',
    '  background:rgba(10,10,10,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
    '  display:flex;align-items:center;justify-content:space-between;',
    '  padding:0 28px;z-index:9999;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '  border-top:1px solid #1c1c1c;',
    '}',
    '#tmpl-nav a {',
    '  color:#44B2FF;text-decoration:none;font-size:12px;font-weight:600;',
    '  letter-spacing:0.04em;display:flex;align-items:center;gap:6px;transition:opacity .15s;',
    '}',
    '#tmpl-nav a:hover { opacity:0.7; }',
    /* Top-right action panel */
    '#tmpl-actions {',
    '  position:fixed;top:16px;right:16px;',
    '  display:flex;align-items:center;gap:8px;',
    '  z-index:9999;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '}',
    '.act-btn {',
    '  background:rgba(10,10,10,0.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
    '  border:1px solid #222;border-radius:3px;',
    '  color:#555;font-size:10px;font-weight:700;letter-spacing:0.09em;',
    '  text-transform:uppercase;padding:7px 13px;cursor:pointer;white-space:nowrap;',
    '  font-family:inherit;display:inline-flex;align-items:center;gap:6px;',
    '  text-decoration:none;transition:color .15s,border-color .15s,background .15s;',
    '}',
    '.act-btn:hover { color:#ccc;border-color:#3a3a3a;background:rgba(20,20,20,0.92); }',
    '.act-btn-primary { color:#44B2FF;border-color:rgba(68,178,255,0.25); }',
    '.act-btn-primary:hover { color:#44B2FF;border-color:#44B2FF;background:rgba(68,178,255,0.08); }',
    /* Download dropdown */
    '#act-dl-wrap { position:relative; }',
    '#act-dl-menu {',
    '  position:absolute;top:calc(100% + 8px);right:0;',
    '  background:#0d0d0d;border:1px solid #222;border-radius:3px;',
    '  overflow:hidden;min-width:136px;display:none;',
    '  box-shadow:0 8px 24px rgba(0,0,0,0.7);',
    '}',
    '#act-dl-menu.open { display:block; }',
    '.act-dl-item {',
    '  display:block;width:100%;padding:9px 14px;background:transparent;',
    '  border:none;border-top:1px solid #1a1a1a;',
    '  color:#555;font-size:10px;font-weight:700;letter-spacing:0.09em;',
    '  text-transform:uppercase;font-family:inherit;cursor:pointer;',
    '  text-align:left;transition:color .12s,background .12s;',
    '}',
    '.act-dl-item:first-child { border-top:none; }',
    '.act-dl-item:hover { color:#fff;background:#1a1a1a; }',
    /* Toast */
    '#nav-toast {',
    '  position:fixed;top:56px;right:16px;',
    '  background:#111;border:1px solid #222;color:#aaa;',
    '  font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;',
    '  padding:8px 16px;border-radius:3px;z-index:10000;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '  opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;',
    '}',
    /* Carousel viewport arrows */
    '.nav-slide-arrow {',
    '  position:fixed;top:calc(50% - 24px);',
    '  width:48px;height:48px;',
    '  background:rgba(10,10,10,0.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
    '  border:1px solid #333;border-radius:50%;',
    '  color:#44B2FF;font-size:20px;line-height:1;',
    '  cursor:pointer;display:flex;align-items:center;justify-content:center;',
    '  z-index:9999;transition:color .15s,border-color .15s,background .15s;',
    '  font-family:inherit;user-select:none;-webkit-user-select:none;',
    '}',
    '.nav-slide-arrow:hover { border-color:#44B2FF;background:rgba(68,178,255,0.08); }',
    '#nav-arrow-prev { left:16px; }',
    '#nav-arrow-next { right:16px; }'
  ].join('\n');
  document.head.appendChild(style);

  /* ── Fit canvas to viewport ──────────────────────────────────────────────── */
  var canvas = document.querySelector('.canvas');
  var NAV_H  = 48;
  if (canvas) {
    var cw = canvas.offsetWidth;
    var ch = canvas.offsetHeight;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    function scaleCanvas() {
      var s = Math.min(window.innerWidth / cw, (window.innerHeight * 0.75) / ch);
      canvas.style.position  = 'fixed';
      canvas.style.left      = '50%';
      canvas.style.top       = ((window.innerHeight - NAV_H) / 2) + 'px';
      canvas.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    }
    scaleCanvas();
    window.addEventListener('resize', scaleCanvas);
  }

  /* ── Bottom nav (original layout) ───────────────────────────────────────── */
  var nav = document.createElement('nav');
  nav.id  = 'tmpl-nav';

  var linkStyle = 'color:#44B2FF;text-decoration:none;font-size:12px;font-weight:600;' +
                  'letter-spacing:0.04em;display:flex;align-items:center;gap:6px;transition:opacity .15s';

  nav.innerHTML =
    '<div style="min-width:220px">' +
      (prev
        ? '<a href="' + prev.file + '.html" style="' + linkStyle + '">\u2190 <span style="opacity:.7">' + prev.num + '</span> ' + prev.name + '</a>'
        : '<a href="../" style="' + linkStyle + '">\u2190 Library</a>') +
    '</div>' +

    '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#555;' +
      'display:flex;align-items:center;gap:8px;white-space:nowrap">' +
      '<span style="color:#44B2FF">' + cur.num + '</span> ' + cur.name +
      (cur.carousel ? ' <span id="carousel-page-indicator" style="color:#2a2a2a;margin-left:4px">01 / ' + String(window.CAROUSEL_TOTAL || 4).padStart(2,'0') + '</span>' : '') +
    '</div>' +

    '<div style="min-width:220px;display:flex;justify-content:flex-end">' +
      (next
        ? '<a href="' + next.file + '.html" style="' + linkStyle + '">' + next.name + ' <span style="opacity:.7">' + next.num + '</span> \u2192</a>'
        : '<a href="../" style="' + linkStyle + '">Library \u2192</a>') +
    '</div>';

  document.documentElement.appendChild(nav);

  /* ── Top-right action panel ──────────────────────────────────────────────── */
  var actions = document.createElement('div');
  actions.id = 'tmpl-actions';
  actions.innerHTML =
    (cur.carousel ? '<button class="act-btn" id="carousel-prev-btn">\u2190 Slide</button>' : '') +
    '<a class="act-btn act-btn-primary" href="../editor?t=' + cur.file + '">' +
      '\u2756 &nbsp;Create New Asset' +
    '</a>' +
    '<div id="act-dl-wrap">' +
      '<button class="act-btn" id="act-dl-btn">\u2193 &nbsp;Download \u25be</button>' +
      '<div id="act-dl-menu">' +
        '<button class="act-dl-item" data-fmt="code">\u27e8/\u27e9 &nbsp;Code</button>' +
        '<button class="act-dl-item" data-fmt="jpeg">\u2193 &nbsp;JPG</button>' +
        '<button class="act-dl-item" data-fmt="webp">\u2193 &nbsp;WebP</button>' +
      '</div>' +
    '</div>' +
    '<button class="act-btn" id="act-share-btn">\u2934 &nbsp;Share Link</button>' +
    (cur.carousel ? '<button class="act-btn" id="carousel-next-btn">Slide \u2192</button>' : '');

  document.documentElement.appendChild(actions);

  /* ── Carousel viewport arrows ─────────────────────────────────────────── */
  if (cur.carousel) {
    var arrowPrev = document.createElement('button');
    arrowPrev.id = 'nav-arrow-prev';
    arrowPrev.className = 'nav-slide-arrow';
    arrowPrev.textContent = '\u2190';
    arrowPrev.addEventListener('click', function() {
      if (window.CAROUSEL_PREV) window.CAROUSEL_PREV();
    });
    document.documentElement.appendChild(arrowPrev);

    var arrowNext = document.createElement('button');
    arrowNext.id = 'nav-arrow-next';
    arrowNext.className = 'nav-slide-arrow';
    arrowNext.textContent = '\u2192';
    arrowNext.addEventListener('click', function() {
      if (window.CAROUSEL_NEXT) window.CAROUSEL_NEXT();
    });
    document.documentElement.appendChild(arrowNext);
  }

  /* ── Toast ───────────────────────────────────────────────────────────────── */
  var toastTimer;
  function showToast(msg) {
    var t = document.getElementById('nav-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'nav-toast';
      document.documentElement.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { t.style.opacity = '0'; }, 2500);
  }

  /* ── Download ────────────────────────────────────────────────────────────── */
  function doDownload(fmt) {
    document.getElementById('act-dl-menu').classList.remove('open');

    if (fmt === 'code') {
      var html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      html = html.replace(/<script[^>]+src=["'][^"']*nav\.js["'][^>]*>\s*<\/script>/gi, '');
      html = html.replace(/<style[\s\S]*?#tmpl-nav[\s\S]*?<\/style>/gi, '');
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url; a.download = cur.file + '.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
      showToast('\u2713 Downloaded ' + cur.file + '.html');
      return;
    }

    showToast('\u29d7 Rendering\u2026');
    function capture() {
      var cv = document.querySelector('.canvas');
      if (!cv) { showToast('Canvas not found'); return; }
      html2canvas(cv, {
        scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: null
      }).then(function(can) {
        var mime = fmt === 'webp' ? 'image/webp' : 'image/jpeg';
        var ext  = fmt === 'webp' ? 'webp' : 'jpg';
        var a = document.createElement('a');
        a.href = can.toDataURL(mime, 0.92);
        a.download = cur.file + '.' + ext;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showToast('\u2713 Downloaded ' + cur.file + '.' + ext);
      })['catch'](function(err) {
        showToast('Render failed \u2014 try Code');
        console.error(err);
      });
    }
    if (typeof html2canvas !== 'undefined') { capture(); return; }
    var s = document.createElement('script');
    s.src = '../html2canvas.min.js';
    s.onload = capture;
    document.head.appendChild(s);
  }

  /* ── Share ───────────────────────────────────────────────────────────────── */
  function doShare() {
    var url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: cur.name, url: url })['catch'](function() {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function() { showToast('\u2713 Link copied'); });
    } else {
      var el = document.createElement('textarea');
      el.value = url; el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el); el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast('\u2713 Link copied');
    }
  }

  /* ── Wire events ─────────────────────────────────────────────────────────── */
  document.getElementById('act-dl-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('act-dl-menu').classList.toggle('open');
  });

  document.querySelectorAll('.act-dl-item').forEach(function(btn) {
    btn.addEventListener('click', function() { doDownload(this.dataset.fmt); });
  });

  document.getElementById('act-share-btn').addEventListener('click', doShare);

  /* ── Carousel slide nav ─────────────────────────────────────────────────── */
  if (cur.carousel) {
    var prevSlideBtn = document.getElementById('carousel-prev-btn');
    var nextSlideBtn = document.getElementById('carousel-next-btn');
    if (prevSlideBtn) prevSlideBtn.addEventListener('click', function() {
      if (window.CAROUSEL_PREV) window.CAROUSEL_PREV();
    });
    if (nextSlideBtn) nextSlideBtn.addEventListener('click', function() {
      if (window.CAROUSEL_NEXT) window.CAROUSEL_NEXT();
    });
    // Update the counter when slides change
    window.onCarouselChange = function(n, t) {
      var el = document.getElementById('carousel-page-indicator');
      if (el) el.textContent = String(n).padStart(2,'0') + ' / ' + String(t).padStart(2,'0');
    };
  }

  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('act-dl-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('act-dl-menu').classList.remove('open');
    }
  });

  /* ── Keyboard shortcuts ──────────────────────────────────────────────────── */
  document.addEventListener('keydown', function(e) {
    if (cur.carousel) {
      if (e.key === 'ArrowLeft'  && window.CAROUSEL_PREV) window.CAROUSEL_PREV();
      if (e.key === 'ArrowRight' && window.CAROUSEL_NEXT) window.CAROUSEL_NEXT();
    } else {
      if (e.key === 'ArrowLeft'  && prev) window.location.href = prev.file + '.html';
      if (e.key === 'ArrowRight' && next) window.location.href = next.file + '.html';
    }
    if (e.key === 'Escape') window.location.href = '../';
  });
})();
