/* ─────────────────────────────────────────────────────────────────────────
   Template Editor — editor.js
   Handles text editing, image upload, circle-brush drag, and HTML export.
   Uses postMessage to communicate with the template iframe for reliability.
───────────────────────────────────────────────────────────────────────── */

/* ── Template configuration ──────────────────────────────────────────────── */
var TEMPLATES = {
  't1-quote': {
    name: 'Client Testimonial / Quote',
    file: 'templates/t1-quote.html',
    w: 1080, h: 1080,
    fields: [
      { type: 'text',  sel: '.name',    label: 'Name',   mode: 'pre',  rows: 2 },
      { type: 'text',  sel: '.title',   label: 'Title',  mode: 'pre',  rows: 2 },
      { type: 'text',  sel: '.handle',  label: 'Handle', mode: 'text', rows: 1 },
      { type: 'text',  sel: '.quote',   label: 'Quote',  mode: 'pre',  rows: 5 },
      { type: 'image', sel: '.photo img', label: 'Portrait Photo', dims: '353 × 439px' }
    ],
    brush: null
  },

  't2-app-highlight': {
    name: 'App Feature / Product Highlight',
    file: 'templates/t2-app-highlight.html',
    w: 1080, h: 1080,
    fields: [
      { type: 'text',  sel: '.headline',       label: 'Headline',     mode: 'text', rows: 2 },
      { type: 'text',  sel: '.accent-label p', label: 'Accent Label', mode: 'pre',  rows: 2 },
      { type: 'image', sel: '.mockup img',      label: 'App / Product Mockup', dims: '1105 × 829px' }
    ],
    brush: null
  },

  't3-partner-alert': {
    name: 'Partner Alert (Landscape)',
    file: 'templates/t3-partner-alert.html',
    w: 1340, h: 630,
    fields: [
      { type: 'text',  sel: '.headline',       label: 'Headline',     mode: 'text', rows: 2 },
      { type: 'text',  sel: '.accent-label p', label: 'Accent Label', mode: 'br',   rows: 2 },
      { type: 'image', sel: '.phone img',       label: 'Phone Mockup', dims: '945 × 630px' }
    ],
    brush: '.circle-sketch'
  },

  't4-fluid-ad': {
    name: 'Fluid Capabilities \u2014 Instagram Ad',
    file: 'templates/t4-fluid-ad.html',
    w: 1080, h: 1080,
    fields: [
      { type: 'text',  sel: '.headline',  label: 'Headline',  mode: 'br',   rows: 3 },
      { type: 'text',  sel: '.tagline',   label: 'Tagline',   mode: 'text', rows: 1 },
      { type: 'text',  sel: '.handle',    label: 'Handle',    mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(1) .feature-name',  label: 'Feature 1 Name',  mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(1) .feature-label', label: 'Feature 1 Label', mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(2) .feature-name',  label: 'Feature 2 Name',  mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(2) .feature-label', label: 'Feature 2 Label', mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(3) .feature-name',  label: 'Feature 3 Name',  mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(3) .feature-label', label: 'Feature 3 Label', mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(4) .feature-name',  label: 'Feature 4 Name',  mode: 'text', rows: 1 },
      { type: 'text',  sel: '.features .feature-item:nth-child(4) .feature-label', label: 'Feature 4 Label', mode: 'text', rows: 1 },
      { type: 'image', sel: '.phone img', label: 'Phone Mockup', dims: '680 \u00d7 920px' }
    ],
    brush: '.circle-brush'
  },

  't5-partner-announcement': {
    name: 'Partner Announcement (Landscape)',
    file: 'templates/t5-partner-announcement.html',
    w: 1340, h: 630,
    fields: [
      { type: 'text',  sel: '.headline',      label: 'Headline',     mode: 'text', rows: 3 },
      { type: 'text',  sel: '.person-name',   label: 'Person Name',  mode: 'text', rows: 1 },
      { type: 'text',  sel: '.person-title',  label: 'Person Title', mode: 'text', rows: 1 },
      { type: 'image', sel: '.person-photo img', label: 'Person Portrait', dims: '263 \u00d7 327px' }
    ],
    brush: '.circle-brush-wrap'
  },

  't6-employee-spotlight': {
    name: 'Employee Spotlight',
    file: 'templates/t6-employee-spotlight.html',
    w: 1080, h: 1080,
    fields: [
      { type: 'text',  sel: '.headline',       label: 'Headline',        mode: 'br',   rows: 3 },
      { type: 'text',  sel: '.employee-name',  label: 'Employee Name',   mode: 'text', rows: 1 },
      { type: 'text',  sel: '.employee-title', label: 'Employee Title',  mode: 'text', rows: 1 },
      { type: 'image', sel: '.employee-photo img', label: 'Employee Portrait', dims: '263 \u00d7 327px' }
    ],
    brush: null
  },

  't7-carousel': {
    name: 'Carousel \u2014 Insights',
    file: 'templates/t7-carousel.html',
    w: 1080, h: 1080,
    carousel: 4,
    fields: [
      /* ── Slide 1 ── */
      { type: 'divider', label: 'Slide 01 \u2014 Cover' },
      { type: 'text',  sel: '[data-slide="1"] .s1-headline', label: 'Headline',       mode: 'br',   rows: 3 },
      { type: 'text',  sel: '[data-slide="1"] .s1-name',     label: 'Employee Name',  mode: 'text', rows: 1 },
      { type: 'text',  sel: '[data-slide="1"] .s1-title',    label: 'Employee Title', mode: 'text', rows: 1 },
      { type: 'image', sel: '[data-slide="1"] .s1-photo img',  label: 'Portrait Photo', dims: '263 \u00d7 327px' },
      /* ── Slide 2 ── */
      { type: 'divider', label: 'Slide 02 \u2014 Intro Text' },
      { type: 'text',  sel: '[data-slide="2"] .s2-body',     label: 'Body Copy',      mode: 'pre',  rows: 6 },
      /* ── Slide 3 ── */
      { type: 'divider', label: 'Slide 03 \u2014 Tool Feature' },
      { type: 'text',  sel: '[data-slide="3"] .s3-tool-name',       label: 'Tool Name',       mode: 'text', rows: 1 },
      { type: 'text',  sel: '[data-slide="3"] .s3-body',            label: 'Description',     mode: 'pre',  rows: 5 },
      { type: 'text',  sel: '[data-slide="3"] .s3-difficulty-value',label: 'Difficulty',      mode: 'text', rows: 1 },
      { type: 'image', sel: '[data-slide="3"] .s3-screenshot img',   label: 'Screenshot',     dims: '852 \u00d7 399px' },
      /* ── Slide 4 ── */
      { type: 'divider', label: 'Slide 04 \u2014 App Feature' },
      { type: 'text',  sel: '[data-slide="4"] .s4-feature-name', label: 'Feature Name', mode: 'text', rows: 1 },
      { type: 'text',  sel: '[data-slide="4"] .s4-body-1',       label: 'Paragraph 1',  mode: 'pre',  rows: 4 },
      { type: 'text',  sel: '[data-slide="4"] .s4-body-2',       label: 'Paragraph 2',  mode: 'pre',  rows: 4 }
    ],
    brush: '[data-slide="2"] .s2-arrow',
    brushLabel: 'arrow'
  },

  't8-quarterly-stats': {
    name: 'Quarterly Stats \u2014 Carousel',
    file: 'templates/t8-quarterly-stats.html',
    w: 1080, h: 1080,
    carousel: 4,
    fields: [
      /* ── Slide 1 ── */
      { type: 'divider', label: 'Slide 01 \u2014 Cover' },
      { type: 'text', sel: '[data-slide="1"] .s1-eyebrow',    label: 'Eyebrow (e.g. Fluid · Q1 2026)', mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="1"] .s1-quarter',    label: 'Quarter (e.g. Q1)',              mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="1"] .s1-year',       label: 'Year',                           mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="1"] .s1-hero-num',   label: 'Hero Stat (e.g. +34%)',          mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="1"] .s1-hero-label', label: 'Hero Label',                     mode: 'text', rows: 1 },
      /* ── Slide 2 ── */
      { type: 'divider', label: 'Slide 02 \u2014 Three Stats' },
      { type: 'text', sel: '[data-slide="2"] .s2-intro',       label: 'Intro Copy',        mode: 'pre',  rows: 3 },
      { type: 'text', sel: '[data-slide="2"] .s2-col-1 .s2-num', label: 'Stat 1 Number',  mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="2"] .s2-col-1 .s2-lbl', label: 'Stat 1 Label',   mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="2"] .s2-col-2 .s2-num', label: 'Stat 2 Number',  mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="2"] .s2-col-2 .s2-lbl', label: 'Stat 2 Label',   mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="2"] .s2-col-3 .s2-num', label: 'Stat 3 Number',  mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="2"] .s2-col-3 .s2-lbl', label: 'Stat 3 Label',   mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="2"] .s2-footnote',    label: 'Footnote',          mode: 'pre',  rows: 2 },
      /* ── Slide 3 ── */
      { type: 'divider', label: 'Slide 03 \u2014 AI Efficiency' },
      { type: 'text', sel: '[data-slide="3"] .s3-eyebrow',  label: 'Eyebrow',         mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="3"] .s3-big-num',  label: 'Big Number',      mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="3"] .s3-unit',     label: 'Unit Label',      mode: 'pre',  rows: 2 },
      { type: 'text', sel: '[data-slide="3"] .s3-body',     label: 'Body Copy',       mode: 'pre',  rows: 4 },
      { type: 'text', sel: '[data-slide="3"] .s3-secondary',label: 'Secondary Note',  mode: 'text', rows: 1 },
      /* ── Slide 4 ── */
      { type: 'divider', label: 'Slide 04 \u2014 Outlook' },
      { type: 'text', sel: '[data-slide="4"] .s4-eyebrow',         label: 'Eyebrow (e.g. What\'s Next)', mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="4"] .s4-headline',        label: 'Headline',                     mode: 'br',   rows: 3 },
      { type: 'text', sel: '[data-slide="4"] .s4-mini-1 .s4-mini-num', label: 'Mini Stat 1 Number',       mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="4"] .s4-mini-1 .s4-mini-lbl', label: 'Mini Stat 1 Label',        mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="4"] .s4-mini-2 .s4-mini-num', label: 'Mini Stat 2 Number',       mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="4"] .s4-mini-2 .s4-mini-lbl', label: 'Mini Stat 2 Label',        mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="4"] .s4-mini-3 .s4-mini-num', label: 'Mini Stat 3 Number',       mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="4"] .s4-mini-3 .s4-mini-lbl', label: 'Mini Stat 3 Label',        mode: 'text', rows: 1 },
      { type: 'text', sel: '[data-slide="4"] .s4-tagline',          label: 'Tagline',                     mode: 'pre',  rows: 2 }
    ],
    brush: null
  }
};

/* ── State ───────────────────────────────────────────────────────────────── */
var tid     = null;   // template id key
var config  = null;   // TEMPLATES[tid]
var scale   = 1;      // current iframe visual scale
var iframe  = null;   // <iframe> element
var dragOverlay = null;  // transparent mouse-capture div during brush drag
var txState     = null;  // active transform drag: { mode, ... }
var txSVG       = null;  // SVG overlay element inside iframeWrap
var txEl        = null;  // the draggable element inside iframe
var txIDoc      = null;  // iframe.contentDocument
var HANDLE_PX   = 8;     // corner handle half-size in screen pixels
var editingCreationId = null;  // set when editing an existing creation (?c=id)

/* ── Capture handler (responses from iframe via postMessage) ─────────────── */
var pendingCaptures = {};
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'captured') return;
  var cb = pendingCaptures[e.data.id];
  if (cb) { delete pendingCaptures[e.data.id]; cb(e.data); }
});

/* Asks the iframe to render .canvas with html2canvas and call back with result */
function requestCapture(fmt, captureScale, callback) {
  var id = 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  pendingCaptures[id] = callback;
  iframe.contentWindow.postMessage({
    type:  'capture',
    id:    id,
    fmt:   fmt,
    scale: captureScale || 1,
    h2c:   window.location.origin + '/html2canvas.min.js'
  }, '*');
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
(function init() {
  var params = new URLSearchParams(window.location.search);
  tid = params.get('t');
  if (!tid || !TEMPLATES[tid]) { window.location.href = './'; return; }
  config = TEMPLATES[tid];

  document.title      = 'Edit \u2014 ' + config.name;
  document.getElementById('editorTitle').textContent = config.name;

  /* Iframe */
  iframe = document.getElementById('templateFrame');
  iframe.style.width  = config.w + 'px';
  iframe.style.height = config.h + 'px';
  iframe.addEventListener('load', onFrameLoad);

  /* Check if editing an existing creation via ?c=<id> */
  var cid = params.get('c');
  if (cid) {
    try {
      var savedList = JSON.parse(localStorage.getItem('neumi_creations') || '[]');
      for (var si = 0; si < savedList.length; si++) {
        if (String(savedList[si].id) === cid && savedList[si].html) {
          editingCreationId = savedList[si].id;
          var blobUrl = URL.createObjectURL(new Blob([savedList[si].html], { type: 'text/html;charset=utf-8' }));
          iframe.src = blobUrl;
          setTimeout(function(u) { return function() { URL.revokeObjectURL(u); }; }(blobUrl), 5000);
          document.title = 'Edit \u2014 ' + (savedList[si].brief || config.name);
          document.getElementById('editorTitle').textContent = savedList[si].brief || config.name;
          break;
        }
      }
    } catch(e) { console.warn('Editor: could not load creation', e); }
  }
  if (!editingCreationId) iframe.src = config.file;

  /* Drag overlay (sits on top of preview, captures mouse during brush drag) */
  var previewEl = document.getElementById('editorPreview');
  dragOverlay = document.createElement('div');
  dragOverlay.style.cssText = 'position:absolute;inset:0;z-index:50;display:none;cursor:grabbing;';
  previewEl.appendChild(dragOverlay);
  dragOverlay.addEventListener('mousemove',  onOverlayMove);
  dragOverlay.addEventListener('mouseup',    onOverlayUp);
  dragOverlay.addEventListener('mouseleave', onOverlayUp);

  /* Buttons */
  document.getElementById('btnReset').addEventListener('click', resetTemplate);
  document.getElementById('btnSave').addEventListener('click', openSaveModal);
  document.getElementById('btnDownload').addEventListener('click', toggleDlMenu);
  document.getElementById('dlCode').addEventListener('click', downloadCode);
  document.getElementById('dlJpg').addEventListener('click', function() { downloadImage('jpeg'); });
  document.getElementById('dlWebp').addEventListener('click', function() { downloadImage('webp'); });
  /* Close download menu when clicking outside */
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#dlDropdown')) hideDlMenu();
  });

  /* Scale + resize */
  computeScale();
  window.addEventListener('resize', computeScale);
})();

/* ── Scale ───────────────────────────────────────────────────────────────── */
function computeScale() {
  var preview = document.getElementById('editorPreview');
  var pad = 56;
  var s = Math.min(
    (preview.clientWidth  - pad) / config.w,
    (preview.clientHeight - pad) / config.h,
    1   // never upscale
  );
  scale = s;
  var wrap = document.getElementById('iframeWrap');
  wrap.style.width  = Math.round(config.w * s) + 'px';
  wrap.style.height = Math.round(config.h * s) + 'px';
  iframe.style.transform       = 'scale(' + s + ')';
  iframe.style.transformOrigin = 'top left';
  _txUpdateOverlay();   /* reposition handles after resize */
}

/* ── Inject postMessage listener into iframe ─────────────────────────────── */
/* This lets the editor push updates via postMessage rather than directly
   touching contentDocument from outside — more reliable across all scenarios. */
function injectListener() {
  try {
    var iDoc = iframe.contentDocument;
    if (!iDoc || !iDoc.body) return;
    /* Avoid double-injection on reset */
    if (iDoc.getElementById('__tmpl_listener__')) return;
    var script = iDoc.createElement('script');
    script.id = '__tmpl_listener__';
    script.textContent =
      'window.addEventListener("message",function(e){' +
      '  var d=e.data;if(!d)return;' +
      '  if(d.type==="capture"){_cap(d);return;}' +
      '  if(d.type!=="tmpl")return;' +
      '  var el=document.querySelector(d.sel);' +
      '  if(!el)return;' +
      '  if(d.action==="img"){' +
      '    el.src=d.value;' +
      '  }else if(d.action==="imgStyle"){' +
      '    if("objectFit" in d)el.style.objectFit=d.objectFit;' +
      '    if("objectPosition" in d)el.style.objectPosition=d.objectPosition;' +
      '  }else if(d.mode==="br"){' +
      '    var x=document.createElement("div");' +
      '    x.textContent=d.value;' +
      '    el.innerHTML=x.innerHTML.replace(/\\n/g,"<br>");' +
      '  }else{' +
      '    el.textContent=d.value;' +
      '  }' +
      '});' +
      'function _cap(d){' +
      '  function _run(){' +
      '    var cv=document.querySelector(".canvas");' +
      '    if(!cv){window.parent.postMessage({type:"captured",id:d.id,error:"no-canvas"},"*");return;}' +
      '    html2canvas(cv,{scale:d.scale||1,useCORS:true,allowTaint:true,logging:false,backgroundColor:null})' +
      '      .then(function(can){' +
      '        var mime=d.fmt==="webp"?"image/webp":"image/jpeg";' +
      '        window.parent.postMessage({type:"captured",id:d.id,fmt:d.fmt,dataUrl:can.toDataURL(mime,0.92)},"*");' +
      '      })["catch"](function(err){' +
      '        window.parent.postMessage({type:"captured",id:d.id,error:String(err)},"*");' +
      '      });' +
      '  }' +
      '  if(typeof html2canvas!=="undefined"){_run();return;}' +
      '  var s=document.createElement("script");' +
      '  s.src=d.h2c;s.onload=_run;' +
      '  document.head.appendChild(s);' +
      '}';
    iDoc.body.appendChild(script);
  } catch(err) {
    console.warn('Editor: could not inject listener —', err);
  }
}

/* ── Iframe load ─────────────────────────────────────────────────────────── */
function onFrameLoad() {
  injectListener();
  if (config.brush) _txNormaliseWithShow();   /* normalise before sidebar reads values */
  buildSidebar();
  if (config.brush) {
    initTransformBox();
    var hintEl = document.getElementById('brushDragHint');
    hintEl.textContent = 'Drag the ' + (config.brushLabel || 'element') + ' — use handles to scale / rotate';
    hintEl.classList.add('visible');
  }
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function buildSidebar() {
  var sidebar = document.getElementById('editorSidebar');
  sidebar.innerHTML = '';

  /* ── Carousel: slide switcher + per-slide field groups ── */
  if (config.carousel) {
    var slideSec = makeSection('Slides');
    slideSec.style.cssText += 'display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;';
    for (var si = 1; si <= config.carousel; si++) {
      slideSec.appendChild(makeSlideButton(si));
    }
    sidebar.appendChild(slideSec);

    /* Build one container per slide */
    var containers = {};
    for (var ci = 1; ci <= config.carousel; ci++) {
      var c = document.createElement('div');
      c.id = 'slide-fields-' + ci;
      c.style.display = ci === 1 ? 'block' : 'none';
      containers[ci] = c;
    }

    /* Distribute fields into their slide containers */
    var curSlide = 0;
    config.fields.forEach(function(f) {
      if (f.type === 'divider') {
        curSlide++;
      } else if (curSlide > 0 && containers[curSlide]) {
        if (f.type === 'text')  containers[curSlide].appendChild(makeTextField(f));
        if (f.type === 'image') containers[curSlide].appendChild(makeImageField(f));
      }
    });

    /* One Content section holds all per-slide containers */
    var contentSec = makeSection('Content');
    for (var ci = 1; ci <= config.carousel; ci++) {
      contentSec.appendChild(containers[ci]);
    }
    sidebar.appendChild(contentSec);

    if (config.brush) sidebar.appendChild(makeBrushSection(config.brushLabel || 'Element'));
    return;
  }

  /* ── Non-carousel: text + dividers ── */
  var contentFields = config.fields.filter(function(f) { return f.type === 'text' || f.type === 'divider'; });
  if (contentFields.length) {
    var sec = makeSection('Content');
    contentFields.forEach(function(f) {
      if (f.type === 'divider') {
        sec.appendChild(makeDivider(f.label));
      } else {
        sec.appendChild(makeTextField(f));
      }
    });
    sidebar.appendChild(sec);
  }

  /* ── Image fields ── */
  var imageFields = config.fields.filter(function(f) { return f.type === 'image'; });
  if (imageFields.length) {
    var imgSec = makeSection('Images');
    imageFields.forEach(function(f) { imgSec.appendChild(makeImageField(f)); });
    sidebar.appendChild(imgSec);
  }

  if (config.brush) {
    sidebar.appendChild(makeBrushSection());
  }
}

function makeSlideButton(n) {
  var btn = document.createElement('button');
  btn.id = 'slide-btn-' + n;
  btn.textContent = '0' + n;
  btn.style.cssText = 'flex:1;min-width:36px;padding:6px 4px;border:1px solid #1a1a1a;border-radius:2px;' +
    'background:transparent;color:#444;font-family:inherit;font-size:10px;font-weight:700;' +
    'letter-spacing:0.08em;cursor:pointer;transition:color .12s,border-color .12s,background .12s;';
  if (n === 1) {
    btn.style.color = '#44B2FF';
    btn.style.borderColor = 'rgba(68,178,255,0.35)';
    btn.style.background = 'rgba(68,178,255,0.06)';
  }
  btn.addEventListener('click', function() {
    document.querySelectorAll('[id^="slide-btn-"]').forEach(function(b) {
      b.style.color = '#444'; b.style.borderColor = '#1a1a1a'; b.style.background = 'transparent';
    });
    btn.style.color = '#44B2FF';
    btn.style.borderColor = 'rgba(68,178,255,0.35)';
    btn.style.background = 'rgba(68,178,255,0.06)';
    iframe.contentWindow.postMessage({ type: 'setSlide', slide: n }, '*');
    /* Show only this slide's fields */
    for (var i = 1; i <= config.carousel; i++) {
      var el = document.getElementById('slide-fields-' + i);
      if (el) el.style.display = (i === n) ? 'block' : 'none';
    }
    /* After slide switch: normalise brush element if not done yet, then refresh overlay */
    if (config.brush) setTimeout(function() { _txUpdateOverlay(); }, 50);
  });
  return btn;
}

function makeDivider(label) {
  var div = document.createElement('div');
  div.style.cssText = 'margin:14px 0 6px;padding:6px 0 4px;border-top:1px solid #1a1a1a;' +
    'font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#333;';
  div.textContent = label || '';
  return div;
}

function makeSection(title) {
  var sec = document.createElement('div');
  sec.className = 'sidebar-section';
  var lbl = document.createElement('div');
  lbl.className = 'sidebar-section-label';
  lbl.textContent = title;
  sec.appendChild(lbl);
  return sec;
}

/* ── Read initial value from template element ────────────────────────────── */
/* For 'br' mode: elements use <br> tags for line breaks, so convert them
   back to \n for the textarea.  For everything else, textContent is fine. */
function readFieldValue(el, mode) {
  if (!el) return '';
  if (mode === 'br') {
    /* innerHTML: "Built<br>for<br>Reps." → "Built\nfor\nReps." */
    return el.innerHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }
  return el.textContent;
}

/* ── Text field ──────────────────────────────────────────────────────────── */
function makeTextField(field) {
  var iDoc = iframe.contentDocument;
  var el   = iDoc ? iDoc.querySelector(field.sel) : null;

  var group = document.createElement('div');
  group.className = 'form-group';

  var lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.textContent = field.label;
  group.appendChild(lbl);

  var input;
  if (field.rows > 1) {
    input = document.createElement('textarea');
    input.className = 'form-textarea';
    input.rows = field.rows;
  } else {
    input = document.createElement('input');
    input.className = 'form-input';
    input.type = 'text';
  }

  /* Populate with current template value */
  input.value = readFieldValue(el, field.mode);

  /* Live sync — send update to iframe via postMessage */
  input.addEventListener('input', (function(f) {
    return function() {
      iframe.contentWindow.postMessage({
        type:   'tmpl',
        action: 'text',
        sel:    f.sel,
        value:  this.value,
        mode:   f.mode
      }, '*');
    };
  })(field));

  group.appendChild(input);
  return group;
}

/* ── Image field (with Fit/Fill toggle + focus point drag) ───────────────── */
function makeImageField(field) {
  var iDoc = iframe.contentDocument;
  var imgEl = iDoc ? iDoc.querySelector(field.sel) : null;

  /* ─ per-field state ─ */
  var currentFit = 'cover';   /* 'cover' = Fill, 'contain' = Fit */
  var focusX = 50, focusY = 50;
  if (imgEl) {
    var cs = iDoc.defaultView.getComputedStyle(imgEl);
    currentFit = (cs.objectFit === 'contain') ? 'contain' : 'cover';
    var op = (cs.objectPosition || '50% 50%').trim().split(/\s+/);
    focusX = parseFloat(op[0]) || 50;
    focusY = parseFloat(op[1] !== undefined ? op[1] : op[0]) || 50;
  }

  var wrap = document.createElement('div');
  wrap.className = 'image-field';

  /* Label */
  var lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.textContent = field.label;
  wrap.appendChild(lbl);

  if (field.dims) {
    var hint = document.createElement('div');
    hint.className = 'form-sublabel';
    hint.textContent = 'Recommended: ' + field.dims;
    wrap.appendChild(hint);
  }

  /* ── Thumbnail (doubles as focus-point drag surface) ── */
  var thumb = document.createElement('div');
  thumb.className = 'image-thumb';
  thumb.style.position = 'relative';
  thumb.style.cursor   = currentFit === 'cover' ? 'crosshair' : 'default';
  thumb.style.userSelect = 'none';

  /* Inner area that holds the <img> or empty placeholder */
  var thumbInner = document.createElement('div');
  thumbInner.style.cssText = 'width:100%;height:100%;';

  function refreshThumbInner(src) {
    thumbInner.innerHTML = '';
    if (src) {
      var ti = document.createElement('img');
      ti.src = src;
      ti.style.cssText = 'width:100%;height:100%;object-fit:' + currentFit +
        ';object-position:' + focusX + '% ' + focusY + '%;display:block;';
      thumbInner.appendChild(ti);
    } else {
      var emp = document.createElement('span');
      emp.className = 'image-thumb-empty';
      emp.textContent = 'No image loaded';
      thumbInner.appendChild(emp);
    }
  }

  var initSrc = (imgEl && imgEl.src && imgEl.src !== window.location.href) ? imgEl.src : null;
  refreshThumbInner(initSrc);

  /* Focus dot */
  var dot = document.createElement('div');
  dot.className = 'focus-dot';
  dot.style.left    = focusX + '%';
  dot.style.top     = focusY + '%';
  dot.style.display = currentFit === 'cover' ? 'block' : 'none';

  thumb.appendChild(thumbInner);
  thumb.appendChild(dot);

  /* ── Focus drag handlers ── */
  var isDragging = false;

  function applyFocus(cx, cy) {
    var rect = thumb.getBoundingClientRect();
    var x = Math.round(Math.min(100, Math.max(0, (cx - rect.left)  / rect.width  * 100)));
    var y = Math.round(Math.min(100, Math.max(0, (cy - rect.top)   / rect.height * 100)));
    focusX = x; focusY = y;
    dot.style.left = x + '%';
    dot.style.top  = y + '%';
    var tImg = thumbInner.querySelector('img');
    if (tImg) tImg.style.objectPosition = x + '% ' + y + '%';
    iframe.contentWindow.postMessage({
      type: 'tmpl', action: 'imgStyle', sel: field.sel,
      objectPosition: x + '% ' + y + '%'
    }, '*');
  }

  thumb.addEventListener('mousedown', function(e) {
    if (currentFit !== 'cover') return;
    isDragging = true;
    applyFocus(e.clientX, e.clientY);
    e.preventDefault();
  });

  var _mmove = function(e) { if (isDragging) applyFocus(e.clientX, e.clientY); };
  var _mup   = function()  { isDragging = false; };
  document.addEventListener('mousemove', _mmove);
  document.addEventListener('mouseup',   _mup);

  wrap.appendChild(thumb);

  /* ── Upload button ── */
  var uploadLabel = document.createElement('label');
  uploadLabel.className = 'btn-upload-label';

  var fileInput = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = 'image/*';

  fileInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast('Image must be under 15 MB'); return; }
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target.result;
      /* Send image src */
      iframe.contentWindow.postMessage({ type:'tmpl', action:'img', sel:field.sel, value:dataUrl }, '*');
      /* Apply current fit/position */
      iframe.contentWindow.postMessage({
        type:'tmpl', action:'imgStyle', sel:field.sel,
        objectFit: currentFit,
        objectPosition: focusX + '% ' + focusY + '%'
      }, '*');
      refreshThumbInner(dataUrl);
      showToast('Image updated');
    };
    reader.readAsDataURL(file);
  });

  uploadLabel.appendChild(fileInput);
  uploadLabel.appendChild(document.createTextNode('\u2191 Choose Image'));
  wrap.appendChild(uploadLabel);

  /* ── Fit / Fill toggle ── */
  var ffRow = document.createElement('div');
  ffRow.className = 'fit-fill-row';

  var fitBtn  = document.createElement('button');
  var fillBtn = document.createElement('button');
  fitBtn.className  = 'fit-fill-btn' + (currentFit === 'contain' ? ' active' : '');
  fillBtn.className = 'fit-fill-btn' + (currentFit === 'cover'   ? ' active' : '');
  fitBtn.textContent  = 'Fit';
  fillBtn.textContent = 'Fill';

  fitBtn.addEventListener('click', function() {
    currentFit = 'contain';
    fitBtn.classList.add('active');  fillBtn.classList.remove('active');
    dot.style.display    = 'none';
    thumb.style.cursor   = 'default';
    var tImg = thumbInner.querySelector('img');
    if (tImg) tImg.style.objectFit = 'contain';
    iframe.contentWindow.postMessage({
      type:'tmpl', action:'imgStyle', sel:field.sel,
      objectFit: 'contain', objectPosition: ''
    }, '*');
  });

  fillBtn.addEventListener('click', function() {
    currentFit = 'cover';
    fillBtn.classList.add('active'); fitBtn.classList.remove('active');
    dot.style.display    = 'block';
    thumb.style.cursor   = 'crosshair';
    var tImg = thumbInner.querySelector('img');
    if (tImg) { tImg.style.objectFit = 'cover'; tImg.style.objectPosition = focusX + '% ' + focusY + '%'; }
    iframe.contentWindow.postMessage({
      type:'tmpl', action:'imgStyle', sel:field.sel,
      objectFit: 'cover', objectPosition: focusX + '% ' + focusY + '%'
    }, '*');
  });

  ffRow.appendChild(fitBtn);
  ffRow.appendChild(fillBtn);
  wrap.appendChild(ffRow);

  return wrap;
}

/* ── Brush section (sidebar) ─────────────────────────────────────────────── */
function makeBrushSection(label) {
  var displayName = label || 'circle brush';
  var title = label ? (label.charAt(0).toUpperCase() + label.slice(1)) : 'Circle Brush';
  var sec  = makeSection(title);

  var hint = document.createElement('div');
  hint.className = 'brush-hint';
  hint.innerHTML = 'Drag the <span class="brush-chip">' + displayName + '</span> to move &mdash; use handles to scale &amp; rotate:';
  sec.appendChild(hint);

  /* Read current state (after normalisation) */
  var iDoc = iframe.contentDocument;
  var bEl  = iDoc ? iDoc.querySelector(config.brush) : null;
  var iL = 0, iT = 0, iRot = 0, iSx = 100, iSy = 100;
  if (bEl) {
    var cs2 = iDoc.defaultView.getComputedStyle(bEl);
    iL = Math.round(parseFloat(cs2.left) || 0);
    iT = Math.round(parseFloat(cs2.top)  || 0);
    var p2 = _txParseTransform(cs2.transform);
    iRot = Math.round(p2.rot * 10) / 10;
    iSx  = Math.round(p2.sx  * 100);
    iSy  = Math.round(p2.sy  * 100);
  }

  var fields = [
    { id:'brush-left', lbl:'X (px)',    val:iL,   step:'1',   handler: function(v) { if (txEl) { txEl.style.left = v + 'px'; _txUpdateOverlay(); } } },
    { id:'brush-top',  lbl:'Y (px)',    val:iT,   step:'1',   handler: function(v) { if (txEl) { txEl.style.top  = v + 'px'; _txUpdateOverlay(); } } },
    { id:'brush-rot',  lbl:'Rotate °',  val:iRot, step:'0.5', handler: function(v) { if (txEl) { var c = _txGetState(); _txApply(v, c.sx, c.sy); _txUpdateOverlay(); } } },
    { id:'brush-sx',   lbl:'Scale W %', val:iSx,  step:'1',   handler: function(v) { if (txEl) { var c = _txGetState(); _txApply(c.rot, v/100, c.sy);  _txUpdateOverlay(); } } },
    { id:'brush-sy',   lbl:'Scale H %', val:iSy,  step:'1',   handler: function(v) { if (txEl) { var c = _txGetState(); _txApply(c.rot, c.sx,  v/100); _txUpdateOverlay(); } } }
  ];

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
  fields.forEach(function(f) {
    var g = document.createElement('div'); g.className = 'form-group';
    var l = document.createElement('label'); l.className = 'form-label'; l.textContent = f.lbl;
    var inp = document.createElement('input');
    inp.className = 'form-input'; inp.type = 'number'; inp.id = f.id;
    inp.value = f.val; inp.step = f.step;
    inp.addEventListener('input', (function(fn) {
      return function() { fn(parseFloat(this.value) || 0); };
    })(f.handler));
    g.appendChild(l); g.appendChild(inp);
    grid.appendChild(g);
  });
  sec.appendChild(grid);
  return sec;
}

/* ── Transform Box: move + corner scale + rotate handle ──────────────────── */
function initTransformBox() {
  txIDoc = iframe.contentDocument;
  if (!txIDoc || !config.brush) return;
  txEl = txIDoc.querySelector(config.brush);
  if (!txEl) return;
  txEl.style.pointerEvents = 'auto';

  /* Build SVG overlay inside iframeWrap (shares its coordinate space) */
  var wrap = document.getElementById('iframeWrap');
  if (txSVG) { txSVG.remove(); txSVG = null; }
  txSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  txSVG.id = 'txb-svg';
  txSVG.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:20;';
  wrap.appendChild(txSVG);
  _txUpdateOverlay();

  /* Canvas capture-phase mousedown → "move" drag */
  var brushCanvas = txIDoc.querySelector('.canvas') || txIDoc.body;
  brushCanvas.addEventListener('mousedown', function(e) {
    if (txState) return;
    var br = txEl.getBoundingClientRect();
    if (e.clientX < br.left || e.clientX > br.right ||
        e.clientY < br.top  || e.clientY > br.bottom) return;
    e.preventDefault();
    var cs = txIDoc.defaultView.getComputedStyle(txEl);
    txState = { mode: 'move',
      startX: e.clientX, startY: e.clientY,
      origLeft: parseFloat(cs.left) || 0,
      origTop:  parseFloat(cs.top)  || 0
    };
    dragOverlay.style.display = 'block';
    dragOverlay.style.cursor  = 'grabbing';
  }, true);

  /* Hover cursor on element body */
  brushCanvas.addEventListener('mousemove', function(e) {
    if (txState) return;
    var br  = txEl.getBoundingClientRect();
    var hit = e.clientX >= br.left && e.clientX <= br.right &&
              e.clientY >= br.top  && e.clientY <= br.bottom;
    brushCanvas.style.cursor = hit ? 'grab' : '';
  }, true);
}

/* Normalise element to center-based transform-origin so math is simple.
   Wraps _txNormalise() with a temporary slide-show so hidden elements
   return real getBoundingClientRect values (DOM changes don't paint mid-JS). */
function _txNormaliseWithShow() {
  var iDoc = iframe.contentDocument;
  if (!iDoc || !config.brush) return;
  var el = iDoc.querySelector(config.brush);
  if (!el) return;

  /* Walk up to find a .slide ancestor that might be hidden */
  var slideEl = null, p = el.parentNode;
  while (p && p !== iDoc.body) {
    if (p.classList && p.classList.contains('slide')) { slideEl = p; break; }
    p = p.parentNode;
  }
  var wasHidden = slideEl && !slideEl.classList.contains('active');
  if (wasHidden) slideEl.style.display = 'block';
  _txNormalise();
  if (wasHidden) slideEl.style.display = '';
}

/* Normalise element to center-based transform-origin so math is simple */
function _txNormalise() {
  var iDoc = iframe.contentDocument;
  if (!iDoc || !config.brush) return;
  var el = iDoc.querySelector(config.brush);
  if (!el) return;
  var br  = el.getBoundingClientRect();
  var cx  = br.left + br.width  / 2;
  var cy  = br.top  + br.height / 2;
  var nW  = el.offsetWidth,  nH = el.offsetHeight;
  var p   = _txParseTransform(iDoc.defaultView.getComputedStyle(el).transform);
  el.style.transformOrigin = '50% 50%';
  el.style.left      = (cx - nW / 2) + 'px';
  el.style.top       = (cy - nH / 2) + 'px';
  el.style.transform = 'rotate(' + p.rot + 'deg) scaleX(' + p.sx + ') scaleY(' + p.sy + ')';
}

function _txParseTransform(t) {
  if (!t || t === 'none') return { rot: 0, sx: 1, sy: 1 };
  var m = t.match(/matrix\(([^)]+)\)/);
  if (!m) {
    var r = t.match(/rotate\(([-\d.]+)deg\)/);
    return { rot: r ? parseFloat(r[1]) : 0, sx: 1, sy: 1 };
  }
  var v = m[1].split(',').map(parseFloat);
  return { rot: Math.atan2(v[1], v[0]) * 180 / Math.PI,
           sx: Math.sqrt(v[0]*v[0] + v[1]*v[1]),
           sy: Math.sqrt(v[2]*v[2] + v[3]*v[3]) };
}

function _txGetState() {
  var cs = txIDoc.defaultView.getComputedStyle(txEl);
  var p  = _txParseTransform(cs.transform);
  /* offsetWidth/Height are 0 for elements in a display:none ancestor;
     fall back to the CSS width/height so the overlay draws correctly. */
  var nW = txEl.offsetWidth  || parseFloat(cs.width)  || 0;
  var nH = txEl.offsetHeight || parseFloat(cs.height) || 0;
  var l  = parseFloat(cs.left) || 0, t = parseFloat(cs.top) || 0;
  return { cx: l + nW/2, cy: t + nH/2, nW: nW, nH: nH,
           left: l, top: t, rot: p.rot, sx: p.sx, sy: p.sy };
}

/* iframe native px → SVG/iframeWrap coords */
function _txToSVG(ix, iy) { return { x: ix * scale, y: iy * scale }; }

/* dragOverlay page event → iframe native coords */
function _txEventToIframe(e) {
  var wr = document.getElementById('iframeWrap').getBoundingClientRect();
  return { x: (e.clientX - wr.left) / scale, y: (e.clientY - wr.top) / scale };
}

function _txApply(rot, sx, sy) {
  txEl.style.transform = 'rotate(' + rot.toFixed(2) + 'deg) scaleX(' + sx.toFixed(4) + ') scaleY(' + sy.toFixed(4) + ')';
}

function _txSyncInputs(l, t, rot, sx, sy) {
  var map = { 'brush-left': Math.round(l), 'brush-top': Math.round(t),
              'brush-rot':  Math.round(rot * 10) / 10,
              'brush-sx':   Math.round(sx * 100), 'brush-sy': Math.round(sy * 100) };
  Object.keys(map).forEach(function(id) { var el = document.getElementById(id); if (el) el.value = map[id]; });
}

/* Returns false if the brush element lives in a slide that isn't currently active */
function _txIsOnActiveSlide() {
  var p = txEl.parentNode;
  while (p && p !== txIDoc.body) {
    if (p.classList && p.classList.contains('slide')) {
      return p.classList.contains('active');
    }
    p = p.parentNode;
  }
  return true; // not inside a carousel slide — always show
}

function _txUpdateOverlay() {
  if (!txSVG || !txEl || !txIDoc) return;
  txSVG.innerHTML = '';
  if (!_txIsOnActiveSlide()) return; // hide on slides that don't own the brush
  var s   = _txGetState();
  var θ   = s.rot * Math.PI / 180;
  var cos = Math.cos(θ), sin = Math.sin(θ);
  var hw  = s.nW * s.sx / 2, hh = s.nH * s.sy / 2;

  function svgPt(ex, ey) { return _txToSVG(s.cx + cos*ex - sin*ey, s.cy + sin*ex + cos*ey); }
  var TL = svgPt(-hw,-hh), TR = svgPt(+hw,-hh), BR = svgPt(+hw,+hh), BL = svgPt(-hw,+hh);

  /* Rotation handle: 40 screen-px above top-edge centre in element "up" dir */
  var tcX = (TL.x + TR.x)/2, tcY = (TL.y + TR.y)/2;
  var ROT = { x: tcX + sin*40, y: tcY - cos*40 };

  function mk(tag, attrs, style) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function(k) { el.setAttribute(k, attrs[k]); });
    if (style) el.style.cssText = style;
    return el;
  }

  /* Dashed bounding box */
  txSVG.appendChild(mk('polygon', {
    points: [TL,TR,BR,BL].map(function(p){return p.x+','+p.y;}).join(' '),
    fill: 'none', stroke: '#44B2FF', 'stroke-width': '1.5', 'stroke-dasharray': '5 3'
  }));

  /* Rotation stem + circle */
  txSVG.appendChild(mk('line', { x1:tcX, y1:tcY, x2:ROT.x, y2:ROT.y,
    stroke:'#44B2FF','stroke-width':'1.5' }));

  var rotH = mk('circle', { cx:ROT.x, cy:ROT.y, r:6,
    fill:'#fff', stroke:'#44B2FF', 'stroke-width':'1.5' }, 'cursor:crosshair;pointer-events:all;');
  rotH.addEventListener('mousedown', function(e) {
    e.stopPropagation(); e.preventDefault();
    var st = _txGetState();
    var wr = document.getElementById('iframeWrap').getBoundingClientRect();
    var pCx = wr.left + st.cx*scale, pCy = wr.top + st.cy*scale;
    txState = { mode:'rotate', origRot:st.rot, sx:st.sx, sy:st.sy,
                left:st.left, top:st.top,
                startAngle: Math.atan2(e.clientY - pCy, e.clientX - pCx) * 180/Math.PI };
    dragOverlay.style.display = 'block'; dragOverlay.style.cursor = 'crosshair';
  });
  txSVG.appendChild(rotH);

  /* Corner scale handles */
  var corners  = { tl:TL, tr:TR, br:BR, bl:BL };
  var cCursors = { tl:'nwse-resize', tr:'nesw-resize', br:'nwse-resize', bl:'nesw-resize' };
  Object.keys(corners).forEach(function(type) {
    var p  = corners[type];
    var hs = HANDLE_PX;
    var h  = mk('rect', { x:p.x-hs/2, y:p.y-hs/2, width:hs, height:hs,
      fill:'#fff', stroke:'#44B2FF', 'stroke-width':'1.5' },
      'cursor:' + cCursors[type] + ';pointer-events:all;');
    h.addEventListener('mousedown', function(e) {
      e.stopPropagation(); e.preventDefault();
      var st = _txGetState();
      txState = { mode:type, cx:st.cx, cy:st.cy, nW:st.nW, nH:st.nH,
                  rot:st.rot, sx:st.sx, sy:st.sy, left:st.left, top:st.top };
      dragOverlay.style.display = 'block'; dragOverlay.style.cursor = cCursors[type];
    });
    txSVG.appendChild(h);
  });
}

/* Parent-side mouse handlers */
function onOverlayMove(e) {
  if (!txState) return;
  var mode   = txState.mode;
  var iMouse = _txEventToIframe(e);

  if (mode === 'move') {
    /* startX/Y were captured from an iframe mousedown (already iframe-native coords),
       so use them directly — do NOT re-run through _txEventToIframe */
    var nL = Math.round(txState.origLeft + (iMouse.x - txState.startX));
    var nT = Math.round(txState.origTop  + (iMouse.y - txState.startY));
    txEl.style.left = nL + 'px'; txEl.style.top = nT + 'px';
    var p = _txParseTransform(txIDoc.defaultView.getComputedStyle(txEl).transform);
    _txSyncInputs(nL, nT, p.rot, p.sx, p.sy);
    _txUpdateOverlay();
    return;
  }

  if (mode === 'rotate') {
    var wr   = document.getElementById('iframeWrap').getBoundingClientRect();
    /* Read current cx/cy from element (left/top may have changed from a previous move) */
    var st2  = _txGetState();
    var pCx  = wr.left + st2.cx * scale, pCy = wr.top + st2.cy * scale;
    var cur  = Math.atan2(e.clientY - pCy, e.clientX - pCx) * 180/Math.PI;
    var nRot = txState.origRot + (cur - txState.startAngle);
    _txApply(nRot, txState.sx, txState.sy);
    _txSyncInputs(txState.left, txState.top, nRot, txState.sx, txState.sy);
    _txUpdateOverlay();
    return;
  }

  /* Scale: tl / tr / br / bl — element centre stays fixed */
  var dx   = iMouse.x - txState.cx, dy = iMouse.y - txState.cy;
  var θ    = txState.rot * Math.PI / 180;
  var elX  =  Math.cos(θ)*dx + Math.sin(θ)*dy;
  var elY  = -Math.sin(θ)*dx + Math.cos(θ)*dy;
  var nSx  = (mode==='tl'||mode==='bl') ? Math.max(0.05,-elX/(txState.nW/2))
                                        : Math.max(0.05, elX/(txState.nW/2));
  var nSy  = (mode==='tl'||mode==='tr') ? Math.max(0.05,-elY/(txState.nH/2))
                                        : Math.max(0.05, elY/(txState.nH/2));
  _txApply(txState.rot, nSx, nSy);
  _txSyncInputs(txState.left, txState.top, txState.rot, nSx, nSy);
  _txUpdateOverlay();
}

function onOverlayUp() {
  if (!txState) return;
  dragOverlay.style.display = 'none';
  dragOverlay.style.cursor  = 'default';
  txState = null;
}

/* ── Reset ───────────────────────────────────────────────────────────────── */
function resetTemplate() {
  document.getElementById('brushDragHint').classList.remove('visible');
  if (txSVG) { txSVG.remove(); txSVG = null; }
  txEl = null; txIDoc = null; txState = null;
  /* Clear src first to force a real reload */
  iframe.src = '';
  setTimeout(function() {
    iframe.src = config.file;
    /* onFrameLoad will inject listener + rebuild sidebar + reinit brush */
  }, 20);
  showToast('Template reset');
}

/* ── Download: dropdown toggle ───────────────────────────────────────────── */
function toggleDlMenu() {
  document.getElementById('dlMenu').classList.toggle('open');
}
function hideDlMenu() {
  var m = document.getElementById('dlMenu');
  if (m) m.classList.remove('open');
}

/* ── Download: Code (HTML) ───────────────────────────────────────────────── */
function downloadCode() {
  hideDlMenu();
  var iDoc = iframe.contentDocument;
  if (!iDoc) { showToast('Template not ready'); return; }
  var html = serializeHTML(iDoc);
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = tid + '-custom.html';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  showToast('Downloaded ' + tid + '-custom.html');
}

/* ── Download: Image (JPG or WebP) ──────────────────────────────────────── */
function downloadImage(fmt) {
  hideDlMenu();
  showToast('⏳ Rendering…');
  requestCapture(fmt, 1, function(data) {
    if (data.error) { showToast('Render failed'); console.error(data.error); return; }
    var ext = fmt === 'webp' ? 'webp' : 'jpg';
    var a = document.createElement('a');
    a.href = data.dataUrl; a.download = tid + '-custom.' + ext;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Downloaded ' + tid + '-custom.' + ext);
  });
}

/* ── Serialize iframe HTML (strips nav.js + listener) ───────────────────── */
function serializeHTML(iDoc) {
  var html = '<!DOCTYPE html>\n' + iDoc.documentElement.outerHTML;
  html = html.replace(/<script[^>]+src=["'][^"']*nav\.js["'][^>]*>\s*<\/script>/gi, '');
  html = html.replace(/<script id="__tmpl_listener__"[\s\S]*?<\/script>/gi, '');
  return html;
}

/* ── Save to My Creations ────────────────────────────────────────────────── */
function openSaveModal() {
  var input     = document.getElementById('saveNameInput');
  var titleEl   = document.getElementById('saveModalTitle');
  var confirmEl = document.getElementById('saveConfirmBtn');
  if (editingCreationId) {
    if (input)     input.value      = document.getElementById('editorTitle').textContent || (config ? config.name : '');
    if (titleEl)   titleEl.textContent   = 'Update Creation';
    if (confirmEl) confirmEl.textContent = '\u2756 Update';
  } else {
    if (input)     input.value      = config ? config.name : '';
    if (titleEl)   titleEl.textContent   = 'Save to My Creations';
    if (confirmEl) confirmEl.textContent = '\u2756 Save';
  }
  document.getElementById('saveModalOverlay').style.display = 'flex';
  if (input) setTimeout(function() { input.focus(); input.select(); }, 50);
}

function closeSaveModal() {
  document.getElementById('saveModalOverlay').style.display = 'none';
}

function confirmSave() {
  var nameInput = document.getElementById('saveNameInput');
  var name = (nameInput ? nameInput.value.trim() : '') || (config ? config.name : 'Untitled');

  /* Serialize HTML with absolute paths so it works from a blob URL */
  var iDoc = iframe.contentDocument;
  var html = '';
  if (iDoc) {
    html = serializeHTML(iDoc);
    var origin = window.location.origin;
    /* Font paths: url('../fonts/…') → absolute */
    html = html.replace(/url\('\.\.\/fonts\//g, "url('" + origin + '/fonts/');
    html = html.replace(/url\("\.\.\/fonts\//g, 'url("' + origin + '/fonts/');
    /* Asset srcs that are still relative paths (not data: URIs) */
    html = html.replace(/src="assets\//g, 'src="' + origin + '/templates/assets/');
  }

  closeSaveModal();
  showToast('⏳ Saving…');

  /* Capture a small thumbnail (scale 0.25 → 270px for 1080px templates) */
  requestCapture('jpeg', 0.25, function(data) {
    /* Load list fresh in case another tab modified it */
    var list = [];
    try { list = JSON.parse(localStorage.getItem('neumi_creations') || '[]'); } catch(e) {}

    /* Locate existing record if editing */
    var existingIdx = -1;
    if (editingCreationId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === editingCreationId) { existingIdx = i; break; }
      }
    }

    var record;
    if (existingIdx >= 0) {
      /* Update fields in-place (preserves id + createdAt) */
      record = list[existingIdx];
      record.brief = name;
      record.html  = html;
      if (!data.error) record.thumbnail = data.dataUrl;
    } else {
      /* New creation */
      record = {
        id: Date.now(), createdAt: Date.now(),
        skill: 'edited', base: tid, brief: name,
        html: html, thumbnail: data.error ? '' : data.dataUrl
      };
      list.unshift(record);
      /* If we just created it, set editingCreationId so subsequent saves update it */
      editingCreationId = record.id;
    }

    /* Try to store; fall back without html if quota exceeded */
    try {
      localStorage.setItem('neumi_creations', JSON.stringify(list));
      showToast(existingIdx >= 0 ? '\u2756 Creation Updated' : '\u2756 Saved to My Creations');
    } catch(e) {
      try {
        record.html = '';
        localStorage.setItem('neumi_creations', JSON.stringify(list));
        showToast(existingIdx >= 0 ? '\u2756 Updated (code omitted)' : '\u2756 Saved (code omitted \u2014 storage full)');
      } catch(e2) {
        showToast('\u2717 Save failed \u2014 storage full');
      }
    }
  });
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(function() { t.classList.remove('show'); }, 3000);
}
