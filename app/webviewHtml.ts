import { algoSource } from './algoSource.js';

export const webviewHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0d1117">
<title>Mia Tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Oxanium:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#0d1117; --surface:#161b22; --border:#30363d;
    --accent:#39d353; --warn:#f0b429; --danger:#f85149;
    --text:#e6edf3; --muted:#8b949e; --radius:4px; --beacon:#58a6ff;
    --hot:#f85149; --cold:#58a6ff; --neutral:#8b949e;
  }
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Oxanium',sans-serif;overflow:hidden;}
  #app{display:flex;flex-direction:column;height:100dvh;}
  #header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;gap:10px;}
  #header h1{font-size:1rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);}
  #status-dot{width:10px;height:10px;border-radius:50%;background:var(--muted);flex-shrink:0;transition:background .3s;}
  #status-dot.active{background:var(--accent);animation:pulse 1.4s infinite;}
  #status-dot.warn{background:var(--warn);} #status-dot.error{background:var(--danger);}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(57,211,83,.5);}70%{box-shadow:0 0 0 8px rgba(57,211,83,0);}100%{box-shadow:0 0 0 0 rgba(57,211,83,0);}}
  #status-text{font-family:'Share Tech Mono',monospace;font-size:.72rem;color:var(--muted);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  #main{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;}
  #hc-arrow{font-size:4rem;line-height:1;color:var(--neutral);transition:color .3s;}
  #hc-text{font-size:1.4rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--neutral);text-align:center;transition:color .3s;}
  #hc-slope{font-family:'Share Tech Mono',monospace;font-size:.85rem;color:var(--muted);}
  #dist-line{font-family:'Share Tech Mono',monospace;font-size:.9rem;color:var(--beacon);}
  #rssi-bar{display:flex;align-items:center;gap:10px;padding:7px 14px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  #rssi-label{font-family:'Share Tech Mono',monospace;font-size:.75rem;color:var(--muted);min-width:80px;}
  #rssi-track{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;}
  #rssi-fill{height:100%;width:0%;border-radius:3px;background:var(--accent);transition:width .4s,background .4s;}
  #rssi-val{font-family:'Share Tech Mono',monospace;font-size:.85rem;min-width:64px;text-align:right;color:var(--muted);}
  #controls{display:flex;gap:8px;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  .btn{flex:1;padding:11px 8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:'Oxanium',sans-serif;font-size:.82rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--radius);cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
  .btn:active{background:var(--border);}
  .btn.primary{background:rgba(57,211,83,.12);border-color:var(--accent);color:var(--accent);}
  .btn.primary:active{background:rgba(57,211,83,.25);}
  .btn.danger{background:rgba(248,81,73,.1);border-color:var(--danger);color:var(--danger);}
  .btn.warn{background:rgba(240,180,41,.1);border-color:var(--warn);color:var(--warn);}
  .btn.flex0{flex:0 0 auto;padding:11px 16px;}
  #config-panel{position:fixed;inset:0;background:var(--bg);z-index:2000;display:none;flex-direction:column;padding:24px 20px;gap:18px;overflow-y:auto;}
  #config-panel.open{display:flex;}
  #config-panel h2{font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);}
  .field{display:flex;flex-direction:column;gap:6px;}
  .field label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);}
  .field input{background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:'Share Tech Mono',monospace;font-size:.88rem;padding:10px 12px;border-radius:var(--radius);outline:none;width:100%;}
  .field input:focus{border-color:var(--accent);}
  .field .hint{font-size:.7rem;color:var(--muted);line-height:1.4;}
  .field.row-field{flex-direction:row;align-items:center;justify-content:space-between;gap:12px;}
  .field.row-field label{margin:0;}
  .switch{position:relative;width:44px;height:24px;background:var(--border);border-radius:12px;cursor:pointer;transition:background .2s;flex-shrink:0;}
  .switch.on{background:var(--accent);}
  .switch::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .2s;}
  .switch.on::after{transform:translateX(20px);}
  .config-actions{display:flex;gap:8px;margin-top:4px;}
  #snack{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--border);padding:10px 18px;border-radius:20px;font-size:.8rem;color:var(--text);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;white-space:nowrap;z-index:999;}
  #snack.show{opacity:1;transform:translateX(-50%) translateY(0);}
  #debug-bar{display:none;padding:6px 12px;background:#1a1f29;border-bottom:1px solid var(--border);font-family:'Share Tech Mono',monospace;font-size:.65rem;color:var(--muted);line-height:1.45;flex-shrink:0;max-height:42vh;overflow-y:auto;}
  #debug-bar.show,#debug-bar.show-boot,#debug-bar.show-error{display:block;}
  #debug-bar.show-error{border-bottom:2px solid var(--danger);background:#2a1418;}
  #debug-bar .dbg-row{display:flex;justify-content:space-between;gap:8px;}
  #debug-bar .dbg-key{color:var(--accent);}
  #debug-bar .dbg-hex{color:var(--beacon);word-break:break-all;font-size:.6rem;}
  #debug-bar .dbg-err{color:var(--danger);word-break:break-word;font-size:.65rem;}
  #debug-bar .dbg-ok{color:var(--accent);}
  #debug-bar .dbg-warn{color:var(--warn);}
  #motion-pill{display:none;align-items:center;gap:6px;padding:3px 10px;border-radius:14px;font-size:.65rem;font-family:'Share Tech Mono',monospace;background:var(--surface);border:1px solid var(--border);color:var(--muted);}
  #motion-pill.show{display:inline-flex;}
  #motion-pill.moving{color:var(--accent);border-color:var(--accent);}
  #motion-pill.still{color:var(--warn);border-color:var(--warn);}
  #calib-overlay{position:fixed;inset:0;background:var(--bg);z-index:3000;display:none;flex-direction:column;align-items:center;justify-content:center;padding:32px;gap:20px;text-align:center;}
  #calib-overlay.open{display:flex;}
  #calib-title{font-size:1.05rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);}
  #calib-msg{font-size:.9rem;color:var(--text);max-width:320px;line-height:1.5;}
  #calib-progress{width:240px;height:8px;background:var(--border);border-radius:4px;overflow:hidden;}
  #calib-progress-fill{height:100%;width:0%;background:var(--accent);transition:width .3s linear;}
  #calib-count{font-family:'Share Tech Mono',monospace;font-size:2rem;color:var(--beacon);}
  #calib-rssi{font-family:'Share Tech Mono',monospace;font-size:.85rem;color:var(--muted);}
  #calib-actions{display:flex;gap:10px;}
</style>
</head>
<body>

<div id="config-panel">
  <h2>Configuration</h2>
  <div class="field">
    <label>Puissance Tx à 1 m (dBm)</label>
    <input id="cfg-txpower" type="number" value="-40" min="-100" max="0">
    <div class="hint">Valeur mesurée à 1 m (-40 dBm pour le RDL810-B2).</div>
  </div>
  <div class="field">
    <label>Exposant de propagation (n)</label>
    <input id="cfg-n" type="number" value="2.5" step="0.1" min="1.5" max="4">
    <div class="hint">2.0 = espace libre, 2.5 = jardin (recommandé), 3–4 = intérieur dense.</div>
  </div>
  <div class="field">
    <label>Nom affiché du beacon</label>
    <input id="cfg-name" type="text" value="Mia">
  </div>
  <div class="field row-field">
    <label>Vibration "chaud/froid"</label>
    <div id="cfg-haptic-switch" class="switch" onclick="toggleHaptic()"></div>
  </div>
  <div class="field row-field">
    <label>Gel quand téléphone immobile</label>
    <div id="cfg-stillgate-switch" class="switch" onclick="toggleStillGate()"></div>
  </div>
  <div class="field row-field">
    <label>Afficher la barre de debug</label>
    <div id="cfg-debug-switch" class="switch" onclick="toggleDebug()"></div>
  </div>
  <div class="field">
    <label>Calibration TxPower</label>
    <button class="btn warn" onclick="startCalibration()" style="margin-top:4px;">\u{1F4CF} Calibrer à 1 m</button>
    <div class="hint">Pose le téléphone à exactement 1 m de Mia, immobile. Mesure de 10 s pour auto-calibrer la TxPower réelle.</div>
  </div>
  <div class="field">
    <label>Session (debug / réglage sans rebuild)</label>
    <button class="btn" onclick="exportSession()" style="margin-top:4px;">Exporter la session (JSON)</button>
    <div class="hint">Partage toutes les mesures brutes enregistrées pendant le scan.</div>
  </div>
  <div class="config-actions">
    <button class="btn primary" onclick="saveConfig()">✓ Enregistrer</button>
    <button class="btn" onclick="closeConfig()">Annuler</button>
  </div>
</div>

<div id="calib-overlay">
  <div id="calib-title">Calibration TxPower</div>
  <div id="calib-msg">Pose le téléphone à 1 m de Mia, immobile.<br>Mesure dans <span id="calib-count">3</span>s…</div>
  <div id="calib-progress"><div id="calib-progress-fill"></div></div>
  <div id="calib-rssi">RSSI moyen : — dBm</div>
  <div id="calib-actions">
    <button class="btn danger" onclick="cancelCalibration()">Annuler</button>
  </div>
</div>

<div id="app">
  <div id="header">
    <div id="status-dot"></div>
    <div id="status-text">Démarrage…</div>
    <div id="motion-pill"><span id="motion-icon">•</span><span id="motion-label">—</span></div>
    <h1 id="header-title">\u{1F431} Mia</h1>
  </div>
  <div id="debug-bar">
    <div class="dbg-row"><span><span class="dbg-key">boot</span>: <span id="dbg-boot" class="dbg-ok">init…</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">erreur</span>: <span id="dbg-err" class="dbg-err">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">rx</span> rssi=<span id="dbg-rx-rssi">0</span> still=<span id="dbg-rx-still">0</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">ping natif</span>: <span id="dbg-natp">—</span> &middot; <span class="dbg-key">accel</span>: <span id="dbg-accel">—</span> &middot; <span class="dbg-key">haptic</span>: <span id="dbg-haptic">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">mac ciblee</span>: <span id="dbg-mac">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">scans</span> <span id="dbg-nat">0</span> &middot; <span class="dbg-key">matched</span> <span id="dbg-natm">0</span> &middot; <span class="dbg-key">rssi</span> <span id="dbg-natr">—</span> dBm &middot; <span class="dbg-key">age</span> <span id="dbg-age">—</span>s</span></div>
    <div class="dbg-row"><span><span class="dbg-key">still</span> <span id="dbg-still">—</span> &middot; <span class="dbg-key">var</span> <span id="dbg-var">—</span> &middot; <span class="dbg-key">kf.x</span> <span id="dbg-kfx">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">diag natif</span>: <span id="dbg-natd" class="dbg-hex">—</span></span></div>
  </div>
  <div id="main">
    <div id="hc-arrow">—</div>
    <div id="hc-text">En attente du signal…</div>
    <div id="hc-slope">— dBm/s</div>
    <div id="dist-line">~ — m</div>
  </div>
  <div id="rssi-bar">
    <div id="rssi-label">RSSI</div>
    <div id="rssi-track"><div id="rssi-fill"></div></div>
    <div id="rssi-val">— dBm</div>
  </div>
  <div id="controls">
    <button class="btn primary" id="btn-scan" onclick="toggleScan()">▶ Scanner</button>
    <button class="btn flex0" onclick="openConfig()">⚙</button>
  </div>
</div>
<div id="snack"></div>

<script>${algoSource}</script>
<script>
// ===== Global error handlers (avant l'IIFE pour capter ses propres crashes) =====
(function setupGlobalErrors(){
  var errs = [];
  function show(msg) {
    errs.push(msg);
    try {
      var bar = document.getElementById('debug-bar');
      var err = document.getElementById('dbg-err');
      if (bar) bar.classList.add('show-error');
      if (err) err.textContent = errs.slice(-3).join(' || ');
      // Remonte aussi au natif (logcat via console + postMessage)
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'webview-error', msg: msg }));
      }
    } catch(e) {}
  }
  window.addEventListener('error', function(e) {
    show('JS: ' + (e.message || (e.error && e.error.message) || 'unknown') + ' @' + (e.filename || '?') + ':' + (e.lineno || '?'));
  });
  window.addEventListener('unhandledrejection', function(e) {
    show('Promise: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
  });
  window.__bootErr = show;
})();

(function(){
  // ===== Boot trace =====
  // Affiche dans la debug bar (force visible pendant le boot) chaque etape franchie.
  var bootSteps = [];
  function bootStep(s) {
    bootSteps.push(s);
    try {
      var el = document.getElementById('dbg-boot');
      if (el) el.textContent = bootSteps.join(' > ');
    } catch(e) {}
  }
  function bootErr(msg) {
    if (window.__bootErr) window.__bootErr(msg);
  }
  // Force la debug bar visible au boot, on la cache si tout OK apres 8s.
  try { document.getElementById('debug-bar').classList.add('show-boot'); } catch(e){}
  bootStep('iife');

  // ===== Config =====
  var cfg = {
    txPower: -40, n: 2.5, name: 'Mia',
    showDebug: false,
    haptic: true,
    stillGate: true
  };
  try {
    var saved = localStorage.getItem('miatracker_cfg');
    if (saved) cfg = Object.assign(cfg, JSON.parse(saved));
    bootStep('cfg');
  } catch(e) {
    bootErr('cfg parse: ' + e.message);
    bootStep('cfg-err');
  }

  // ===== Tuning constants =====
  // RSSI vu en pratique : ~10 dBm de variance statique observee.
  // Kalman 1D : R eleve (mesures bruitees) mais Q remonte pour rester reactif.
  var K_R = 15.0;           // measurement noise variance
  var K_Q = 2.0;            // process noise variance
  var RSSI_JUMP_DBM = 15;   // saut max accepte entre 2 samples consecutifs (sinon outlier)
  var HOT_COLD_WINDOW_MS = 5000;  // fenetre pour la pente RSSI
  var HOT_COLD_HYST_DBM = 4;      // hysteresis : sous ce delta, on dit "stable"
  var HAPTIC_TICK_MS = 1400;      // periode minimum entre 2 vibrations
  var CALIB_DURATION_MS = 10000;  // duree de la mesure de calibration
  var DIST_DISPLAY_ALPHA = 0.25;  // EMA pour lisser la distance affichee

  function postRN(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function applyCfgToForm() {
    document.getElementById('cfg-txpower').value = cfg.txPower;
    document.getElementById('cfg-n').value = cfg.n;
    document.getElementById('cfg-name').value = cfg.name;
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
    document.getElementById('cfg-debug-switch').classList.toggle('on', !!cfg.showDebug);
    document.getElementById('cfg-haptic-switch').classList.toggle('on', !!cfg.haptic);
    document.getElementById('cfg-stillgate-switch').classList.toggle('on', !!cfg.stillGate);
    applyDebugVisibility();
  }

  function applyDebugVisibility() {
    // La debug bar n'apparait que si l'option est activee ET qu'un scan est en cours.
    var show = !!cfg.showDebug && scanning;
    document.getElementById('debug-bar').classList.toggle('show', show);
  }

  window.toggleDebug = function() {
    cfg.showDebug = !cfg.showDebug;
    document.getElementById('cfg-debug-switch').classList.toggle('on', cfg.showDebug);
    applyDebugVisibility();
  };

  window.toggleHaptic = function() {
    cfg.haptic = !cfg.haptic;
    document.getElementById('cfg-haptic-switch').classList.toggle('on', cfg.haptic);
  };

  window.toggleStillGate = function() {
    cfg.stillGate = !cfg.stillGate;
    document.getElementById('cfg-stillgate-switch').classList.toggle('on', cfg.stillGate);
  };

  window.openConfig = function() { document.getElementById('config-panel').classList.add('open'); };
  window.closeConfig = function() { document.getElementById('config-panel').classList.remove('open'); };
  window.saveConfig = function() {
    cfg.txPower = parseFloat(document.getElementById('cfg-txpower').value) || -40;
    cfg.n       = parseFloat(document.getElementById('cfg-n').value) || 2.5;
    cfg.name    = (document.getElementById('cfg-name').value || '').trim() || 'Mia';
    // showDebug / haptic / stillGate sont deja a jour via leurs toggles
    localStorage.setItem('miatracker_cfg', JSON.stringify(cfg));
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
    closeConfig();
    snack('Configuration enregistrée');
  };

  window.exportSession = function() {
    var payload = JSON.stringify({ cfg: cfg, events: recorder.events });
    postRN({ type: 'exportSession', payload: payload });
    snack('Export de ' + recorder.events.length + ' événements');
  };

  // Module algo teste (injecte via algoSource). Sanity check du boot.
  var A = window.MiaAlgo || null;
  if (!A) bootErr('MiaAlgo absent');

  // ===== State =====
  var scanning = false;
  var rssiHistory = [];       // { t, rssi (smoothed) } pour la pente chaud/froid

  // Kalman 1D state
  var kf = { initialized: false, x: 0, p: 1.0 };
  var lastRawRssi = null;
  var lastRawRssiTime = 0;

  // Enregistreur de session : journalise les evenements bruts (rssi/still)
  // pour pouvoir les exporter et regler l'algo hors-ligne, sans rebuild.
  var recorder = {
    on: false, events: [],
    start: function () { this.events = [{ type: 'cfg', cfg: JSON.parse(JSON.stringify(cfg)), t: Date.now() }]; this.on = true; },
    stop: function () { this.on = false; },
    rec: function (m) { if (this.on) { this.events.push(m); if (this.events.length > 8000) this.events.shift(); } }
  };

  // Stillness gate (vient de l'accelerometre via RN)
  var isStill = false;       // true = telephone immobile
  var stillSinceMs = 0;      // depuis quand on est immobile

  // Haptic feedback state
  var lastHapticMs = 0;
  var lastHotcoldState = 'idle'; // 'hot' / 'cold' / 'stable' / 'idle'

  // Calibration state
  var calib = null; // { phase, startMs, samples, timer }

  // Distance affichee : EMA pour lisser visuellement (RSSI fluctue tout seul).
  var distDisplay = null;
  function updateDistDisplay(rawDist) {
    if (distDisplay == null) distDisplay = rawDist;
    else distDisplay = DIST_DISPLAY_ALPHA * rawDist + (1 - DIST_DISPLAY_ALPHA) * distDisplay;
    var el = document.getElementById('dist-line');
    if (el) el.textContent = distDisplay < 1000 ? '~ ' + distDisplay.toFixed(1) + ' m' : '~ >1 km';
  }

  // RX counters
  var rx = { rssi: 0, still: 0 };
  function bumpRx(k) {
    rx[k]++;
    var el = document.getElementById('dbg-rx-' + k);
    if (el) el.textContent = rx[k];
  }

  function kalmanUpdate(z) {
    if (!kf.initialized) {
      kf.x = z; kf.p = K_R;
      kf.initialized = true;
      return kf.x;
    }
    // predict (random walk : x_pred = x, P_pred = P + Q)
    kf.p = kf.p + K_Q;
    // update
    var k = kf.p / (kf.p + K_R);
    kf.x = kf.x + k * (z - kf.x);
    kf.p = (1 - k) * kf.p;
    return kf.x;
  }

  function resetKalman() {
    kf.initialized = false; kf.x = 0; kf.p = 1.0;
    lastRawRssi = null; lastRawRssiTime = 0;
  }

  // ===== Geom (distance indicative RSSI -> metres) =====
  function rssiToDistance(rssi) {
    return Math.pow(10, (cfg.txPower - rssi) / (10 * cfg.n));
  }

  function updateRSSIBar(rssi) {
    var pct = Math.max(0, Math.min(100, (rssi + 100) / 60 * 100));
    var fill = document.getElementById('rssi-fill');
    fill.style.width = pct + '%';
    fill.style.background = pct > 66 ? 'var(--accent)' : pct > 33 ? 'var(--warn)' : 'var(--danger)';
    var val = document.getElementById('rssi-val');
    val.textContent = rssi.toFixed(1) + ' dBm';
    val.style.color = pct > 66 ? 'var(--accent)' : pct > 33 ? 'var(--warn)' : 'var(--danger)';
    document.getElementById('rssi-label').textContent = 'RSSI \xB7 ' + (pct > 66 ? '\u{1F7E2}' : pct > 33 ? '\u{1F7E1}' : '\u{1F534}');
  }

  function setStatus(msg, state) {
    document.getElementById('status-text').textContent = msg;
    var dot = document.getElementById('status-dot');
    dot.className = (state === 'active' || state === 'warn' || state === 'error') ? state : '';
  }

  function updateScanBtn() {
    var btn = document.getElementById('btn-scan');
    if (scanning) { btn.textContent = '■ Arrêter'; btn.className = 'btn danger'; }
    else          { btn.textContent = '▶ Scanner'; btn.className = 'btn primary'; }
  }

  // ===== Hot / cold indicator =====
  // Calcul de la pente du RSSI lisse sur HOT_COLD_WINDOW_MS (regression lineaire,
  // dBm/s). RSSI augmente quand on se rapproche -> "chaud".
  // NOTE : moteur v1 provisoire (base sur le temps). Sera remplace en phase 2 par
  // un moteur base sur les PAS de l'utilisateur (createTrendTracker).
  function updateHotCold() {
    var now = Date.now();
    while (rssiHistory.length && now - rssiHistory[0].t > HOT_COLD_WINDOW_MS) rssiHistory.shift();
    var arrow = document.getElementById('hc-arrow');
    var text  = document.getElementById('hc-text');
    var slope = document.getElementById('hc-slope');
    if (rssiHistory.length < 3) {
      arrow.textContent = '—';
      arrow.style.color = 'var(--neutral)';
      text.textContent = scanning ? 'En attente de mesures…' : 'Scan arrêté';
      text.style.color = 'var(--neutral)';
      slope.textContent = '— dBm/s';
      return;
    }
    // regression lineaire y = a*t + b, t en secondes depuis premiere mesure
    var t0 = rssiHistory[0].t;
    var sx = 0, sy = 0, sxx = 0, sxy = 0, nP = rssiHistory.length;
    for (var i = 0; i < nP; i++) {
      var ts = (rssiHistory[i].t - t0) / 1000;
      var y = rssiHistory[i].rssi;
      sx += ts; sy += y; sxx += ts*ts; sxy += ts*y;
    }
    var denom = nP * sxx - sx * sx;
    var slopeVal = denom > 1e-6 ? (nP * sxy - sx * sy) / denom : 0; // dBm/s
    var deltaDbm = slopeVal * Math.min(HOT_COLD_WINDOW_MS / 1000, (now - t0) / 1000);
    slope.textContent = (slopeVal >= 0 ? '+' : '') + slopeVal.toFixed(2) + ' dBm/s';
    var newState;
    if (deltaDbm > HOT_COLD_HYST_DBM) {
      arrow.textContent = '\u{1F525}';
      arrow.style.color = 'var(--hot)';
      text.textContent = 'Tu te rapproches';
      text.style.color = 'var(--hot)';
      newState = 'hot';
    } else if (deltaDbm < -HOT_COLD_HYST_DBM) {
      arrow.textContent = '\u{2744}';
      arrow.style.color = 'var(--cold)';
      text.textContent = "Tu t'éloignes";
      text.style.color = 'var(--cold)';
      newState = 'cold';
    } else {
      arrow.textContent = '≈';
      arrow.style.color = 'var(--neutral)';
      text.textContent = 'Stable';
      text.style.color = 'var(--neutral)';
      newState = 'stable';
    }
    triggerHapticIfHot(newState);
    lastHotcoldState = newState;
  }

  // Haptique : tick periodique quand on se rapproche, intensite croissante avec le RSSI.
  function triggerHapticIfHot(state) {
    if (!cfg.haptic) return;
    if (state !== 'hot') return;
    var now = Date.now();
    if (now - lastHapticMs < HAPTIC_TICK_MS) return;
    var r = kf.x || -75;
    var intensity = 1;
    if (r > -55) intensity = 3;
    else if (r > -65) intensity = 2;
    lastHapticMs = now;
    postRN({ type: 'haptic', intensity: intensity });
  }

  // ===== Handle measurements coming from RN =====
  function handleRSSI(rssi, name) {
    var now = Date.now();

    // Garde anti-outlier : un saut > RSSI_JUMP_DBM en <1.5s est physiquement
    // improbable. La valeur est quand meme affichee (barre RSSI) mais ne nourrit
    // pas le Kalman.
    var keepForFusion = true;
    if (lastRawRssi !== null && now - lastRawRssiTime < 1500) {
      if (Math.abs(rssi - lastRawRssi) > RSSI_JUMP_DBM) keepForFusion = false;
    }
    lastRawRssi = rssi; lastRawRssiTime = now;

    var smoothed = keepForFusion ? kalmanUpdate(rssi) : (kf.initialized ? kf.x : rssi);
    var kEl = document.getElementById('dbg-kfx'); if (kEl) kEl.textContent = smoothed.toFixed(1);

    updateRSSIBar(smoothed);
    setStatus('Beacon: ' + (name || cfg.name) + ' \xB7 RSSI ' + smoothed.toFixed(1) + ' dBm', 'active');

    // Historique pour chaud/froid
    rssiHistory.push({ t: now, rssi: smoothed });
    updateHotCold();

    var dist = rssiToDistance(smoothed);
    updateDistDisplay(dist);

    // Si on est en calibration, alimente les samples.
    if (calib && calib.phase === 'recording' && keepForFusion) {
      calib.samples.push(smoothed);
    }
  }

  // ===== Stillness pill =====
  function updateMotionPill() {
    var pill = document.getElementById('motion-pill');
    if (!scanning) { pill.classList.remove('show','still','moving'); return; }
    pill.classList.add('show');
    if (isStill) {
      pill.classList.remove('moving'); pill.classList.add('still');
      document.getElementById('motion-icon').textContent = '\u{23F8}';
      document.getElementById('motion-label').textContent = cfg.stillGate ? 'gel actif' : 'immobile';
    } else {
      pill.classList.remove('still'); pill.classList.add('moving');
      document.getElementById('motion-icon').textContent = '\u{1F6B6}';
      document.getElementById('motion-label').textContent = 'en mouvement';
    }
  }

  // ===== Calibration TxPower =====
  // Workflow : 3s de countdown -> 10s de mesure -> moyenne du Kalman -> ecrit cfg.txPower
  window.startCalibration = function() {
    if (calib) return;
    if (!scanning) { snack("Lance d'abord le scan pour calibrer"); return; }
    closeConfig();
    calib = { phase: 'countdown', startMs: Date.now(), samples: [], timer: null };
    document.getElementById('calib-overlay').classList.add('open');
    document.getElementById('calib-progress-fill').style.width = '0%';
    document.getElementById('calib-rssi').textContent = 'RSSI moyen : — dBm';
    var counter = 3;
    document.getElementById('calib-msg').innerHTML = 'Pose le téléphone à 1 m de Mia, immobile.<br>Mesure dans <span id="calib-count">' + counter + '</span>s…';
    calib.timer = setInterval(function() {
      if (!calib) return;
      if (calib.phase === 'countdown') {
        counter--;
        var el = document.getElementById('calib-count');
        if (el) el.textContent = counter;
        if (counter <= 0) {
          calib.phase = 'recording';
          calib.startMs = Date.now();
          calib.samples = [];
          document.getElementById('calib-msg').textContent = 'Mesure en cours… Ne bouge pas.';
        }
      } else if (calib.phase === 'recording') {
        var elapsed = Date.now() - calib.startMs;
        var pct = Math.min(100, (elapsed / CALIB_DURATION_MS) * 100);
        document.getElementById('calib-progress-fill').style.width = pct + '%';
        if (calib.samples.length > 0) {
          var sum = 0;
          for (var i = 0; i < calib.samples.length; i++) sum += calib.samples[i];
          var avg = sum / calib.samples.length;
          document.getElementById('calib-rssi').textContent = 'RSSI moyen : ' + avg.toFixed(1) + ' dBm (' + calib.samples.length + ' échantillons)';
        }
        if (elapsed >= CALIB_DURATION_MS) finishCalibration();
      }
    }, 500);
  };

  function finishCalibration() {
    if (!calib) return;
    clearInterval(calib.timer);
    if (calib.samples.length < 5) {
      cancelCalibration();
      snack('Pas assez de mesures — vérifie que le beacon est actif');
      return;
    }
    var sum = 0;
    for (var i = 0; i < calib.samples.length; i++) sum += calib.samples[i];
    var avg = sum / calib.samples.length;
    cfg.txPower = parseFloat(avg.toFixed(1));
    localStorage.setItem('miatracker_cfg', JSON.stringify(cfg));
    document.getElementById('cfg-txpower').value = cfg.txPower;
    document.getElementById('calib-overlay').classList.remove('open');
    calib = null;
    snack('TxPower calibré à ' + cfg.txPower + ' dBm');
    distDisplay = null;
  }

  window.cancelCalibration = function() {
    if (!calib) return;
    clearInterval(calib.timer);
    document.getElementById('calib-overlay').classList.remove('open');
    calib = null;
  };

  // ===== Buttons =====
  window.toggleScan = function() {
    if (scanning) {
      postRN({ type: 'stopScan' });
      setStatus('Arrêt du scan…', 'warn');
    } else {
      postRN({ type: 'startScan' });
      setStatus('Démarrage du scan… (autoriser Bluetooth si demandé)', 'warn');
      snack('Si une popup permission apparaît, accepte-la');
    }
  };

  // ===== Snackbar =====
  var snackTimer;
  function snack(msg) {
    var el = document.getElementById('snack');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function(){ el.classList.remove('show'); }, 3000);
  }
  window._snack = snack;

  // Rafraichit l'indicateur chaud/froid periodiquement (sa pente evolue avec le temps).
  setInterval(function() {
    if (scanning) updateHotCold();
  }, 500);

  // ===== Message bridge from RN =====
  function onMessage(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === 'rssi' || msg.type === 'still') recorder.rec(msg);
      switch (msg.type) {
        case 'rssi':       bumpRx('rssi'); handleRSSI(msg.rssi, msg.name); break;
        case 'still':      bumpRx('still');
                           isStill = !!msg.isStill;
                           stillSinceMs = isStill ? Date.now() : 0;
                           var sEl = document.getElementById('dbg-still'); if (sEl) sEl.textContent = isStill ? 'OUI' : 'non';
                           var vEl = document.getElementById('dbg-var'); if (vEl && typeof msg.variance === 'number') vEl.textContent = msg.variance.toFixed(4);
                           updateMotionPill();
                           break;
        case 'sensors':    if (msg.accel) { var ae = document.getElementById('dbg-accel'); if (ae) { ae.textContent = msg.accel; ae.className = msg.accel === 'ok' ? 'dbg-ok' : 'dbg-warn'; } }
                           if (msg.haptic) { var he = document.getElementById('dbg-haptic'); if (he) { he.textContent = msg.haptic; he.className = msg.haptic === 'ok' ? 'dbg-ok' : 'dbg-warn'; } }
                           break;
        case 'scanState':  var wasScanningSS = scanning; scanning = msg.scanning; updateScanBtn();
                           if (scanning && !wasScanningSS) recorder.start();
                           if (!scanning) recorder.stop();
                           setStatus(msg.scanning ? 'Scan actif \xB7 en attente du signal de Mia…' : 'Scan arrêté', msg.scanning ? 'active' : '');
                           applyDebugVisibility();
                           if (msg.scanning) {
                             ['dbg-nat','dbg-natm'].forEach(function(id){var e=document.getElementById(id); if (e) e.textContent='0';});
                             ['dbg-natr','dbg-age'].forEach(function(id){var e=document.getElementById(id); if (e) e.textContent='—';});
                           } else {
                             isStill = false; stillSinceMs = 0;
                           }
                           updateHotCold();
                           updateMotionPill();
                           break;
        case 'debug':      var e;
                           if (msg.nativePing) { e = document.getElementById('dbg-natp'); if (e) e.textContent = msg.nativePing; }
                           if (msg.mac) { e = document.getElementById('dbg-mac'); if (e) e.textContent = msg.mac; }
                           e = document.getElementById('dbg-nat'); if (e) e.textContent = msg.scans || 0;
                           e = document.getElementById('dbg-natm'); if (e) e.textContent = msg.matched || 0;
                           e = document.getElementById('dbg-natr'); if (e) e.textContent = msg.lastRssi || '—';
                           e = document.getElementById('dbg-age'); if (e) e.textContent = (msg.lastAgeSec != null && msg.lastAgeSec >= 0) ? msg.lastAgeSec : '—';
                           if (msg.accel) { e = document.getElementById('dbg-accel'); if (e) { e.textContent = msg.accel; e.className = msg.accel === 'ok' ? 'dbg-ok' : 'dbg-warn'; } }
                           if (msg.haptic) { e = document.getElementById('dbg-haptic'); if (e) { e.textContent = msg.haptic; e.className = msg.haptic === 'ok' ? 'dbg-ok' : 'dbg-warn'; } }
                           if (msg.nativeDiag) { e = document.getElementById('dbg-natd'); if (e) e.textContent = msg.nativeDiag; }
                           break;
        case 'status':     setStatus(msg.msg, msg.state || ''); break;
        case 'error':      setStatus(msg.msg, 'error'); snack(msg.msg); break;
        case 'snack':      snack(msg.msg); break;
      }
    } catch(e) {}
  }
  document.addEventListener('message', function(e){ onMessage(e.data); });
  window.addEventListener('message', function(e){ onMessage(e.data); });

  try { applyCfgToForm(); bootStep('form'); } catch(e) { bootErr('applyCfgToForm: ' + e.message); bootStep('form-err'); }
  setStatus('Prêt \xB7 appuyez sur Scanner', '');
  postRN({ type: 'ready' });
  bootStep('ready');
  // Cache la debug-bar de boot apres 8s si tout est OK.
  setTimeout(function() {
    try { document.getElementById('debug-bar').classList.remove('show-boot'); } catch(e){}
  }, 8000);
})();
</script>
</body>
</html>`;
