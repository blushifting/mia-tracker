import { algoSource } from './algoSource';

export const webviewHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0d1117">
<title>Mia Tracker</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
  #map{flex:1;min-height:0;} .leaflet-container{background:#1c2128;}
  #hotcold{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  #hc-arrow{font-size:1.6rem;line-height:1;width:30px;text-align:center;color:var(--neutral);transition:color .3s, transform .3s;}
  #hc-text{flex:1;font-size:.95rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--neutral);transition:color .3s;}
  #hc-slope{font-family:'Share Tech Mono',monospace;font-size:.75rem;color:var(--muted);min-width:64px;text-align:right;}
  #rssi-bar{display:flex;align-items:center;gap:10px;padding:7px 14px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  #rssi-label{font-family:'Share Tech Mono',monospace;font-size:.75rem;color:var(--muted);min-width:80px;}
  #rssi-track{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;}
  #rssi-fill{height:100%;width:0%;border-radius:3px;background:var(--accent);transition:width .4s,background .4s;}
  #rssi-val{font-family:'Share Tech Mono',monospace;font-size:.85rem;min-width:64px;text-align:right;color:var(--muted);}
  #compass-row{display:flex;align-items:center;gap:14px;padding:8px 14px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  #compass-wrap{position:relative;width:52px;height:52px;flex-shrink:0;}
  #compass-ring{width:52px;height:52px;border-radius:50%;border:2px solid var(--border);position:absolute;display:flex;align-items:center;justify-content:center;}
  .compass-tick{position:absolute;width:2px;height:8px;background:var(--border);top:2px;left:calc(50% - 1px);transform-origin:1px 24px;}
  #compass-arrow{position:absolute;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:22px solid var(--beacon);top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg);transform-origin:50% 100%;filter:drop-shadow(0 0 4px var(--beacon));transition:transform .6s ease;}
  #compass-center{position:absolute;width:8px;height:8px;border-radius:50%;background:var(--text);top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;}
  #info-col{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;}
  .info-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;min-width:0;}
  .info-lbl{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;flex-shrink:0;}
  .info-val{font-family:'Share Tech Mono',monospace;font-size:.95rem;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
  #dist-val{color:var(--beacon);font-size:1.1rem;font-weight:600;}
  #measures-count{font-size:.7rem;color:var(--muted);font-family:'Share Tech Mono',monospace;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
  #controls{display:flex;gap:8px;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  .btn{flex:1;padding:11px 8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:'Oxanium',sans-serif;font-size:.82rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--radius);cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
  .btn:active{background:var(--border);}
  .btn.primary{background:rgba(57,211,83,.12);border-color:var(--accent);color:var(--accent);}
  .btn.primary:active{background:rgba(57,211,83,.25);}
  .btn.danger{background:rgba(248,81,73,.1);border-color:var(--danger);color:var(--danger);}
  .btn.warn{background:rgba(240,180,41,.1);border-color:var(--warn);color:var(--warn);}
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
  #map-fallback{display:none;flex:1;align-items:center;justify-content:center;padding:32px;text-align:center;color:var(--muted);background:#1c2128;font-size:.85rem;line-height:1.5;}
  #map-fallback.show{display:flex;flex-direction:column;gap:10px;}
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
  .leaflet-tooltip{background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:'Share Tech Mono',monospace;font-size:.7rem;}
  .marker-me{width:14px;height:14px;background:var(--accent);border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px var(--accent);}
  .marker-beacon{width:18px;height:18px;background:var(--beacon);border:2px solid #fff;border-radius:50%;box-shadow:0 0 12px var(--beacon);}
  .marker-meas{width:8px;height:8px;border-radius:50%;border:1px solid var(--accent);}
</style>
</head>
<body>

<div id="config-panel">
  <h2>Configuration</h2>
  <div class="field">
    <label>UUID du beacon iBeacon</label>
    <input id="cfg-uuid" type="text" placeholder="ex: FDA50693-A4E2-4FB1-AFCF-C6EB07647825">
    <div class="hint">UUID 128 bits du beacon. Modifie pour filtrer un autre beacon.</div>
  </div>
  <div class="field">
    <label>Puissance Tx \xE0 1 m (dBm)</label>
    <input id="cfg-txpower" type="number" value="-40" min="-100" max="0">
    <div class="hint">Valeur mesur\xE9e \xE0 1 m (-40 dBm pour le RDL810-B2).</div>
  </div>
  <div class="field">
    <label>Exposant de propagation (n)</label>
    <input id="cfg-n" type="number" value="2.5" step="0.1" min="1.5" max="4">
    <div class="hint">2.0 = espace libre, 2.5 = jardin (recommand\xE9), 3–4 = int\xE9rieur dense.</div>
  </div>
  <div class="field">
    <label>Nom affich\xE9 du beacon</label>
    <input id="cfg-name" type="text" value="Mia">
  </div>
  <div class="field row-field">
    <label>Vibration "chaud/froid"</label>
    <div id="cfg-haptic-switch" class="switch" onclick="toggleHaptic()"></div>
  </div>
  <div class="field row-field">
    <label>Gel quand t\xE9l\xE9phone immobile</label>
    <div id="cfg-stillgate-switch" class="switch" onclick="toggleStillGate()"></div>
  </div>
  <div class="field row-field">
    <label>Trajectoire estim\xE9e de Mia</label>
    <div id="cfg-trail-switch" class="switch" onclick="toggleBeaconTrail()"></div>
  </div>
  <div class="field row-field">
    <label>Afficher mes points de mesure</label>
    <div id="cfg-mymeas-switch" class="switch" onclick="toggleMyMeasures()"></div>
  </div>
  <div class="field row-field">
    <label>Afficher la barre de debug</label>
    <div id="cfg-debug-switch" class="switch" onclick="toggleDebug()"></div>
  </div>
  <div class="field">
    <label>Calibration TxPower</label>
    <button class="btn warn" onclick="startCalibration()" style="margin-top:4px;">\u{1F4CF} Calibrer \xE0 1 m</button>
    <div class="hint">Pose le t\xE9l\xE9phone \xE0 exactement 1 m de Mia, immobile. Mesure de 10 s pour auto-calibrer la TxPower r\xE9elle.</div>
  </div>
  <div class="field row-field">
    <label>Filtre particulaire (Mia mobile)</label>
    <div id="cfg-pf-switch" class="switch" onclick="togglePF()"></div>
  </div>
  <div class="field">
    <label>Stabilit\xE9 de la position GPS</label>
    <input id="cfg-gpsA" type="number" value="0.12" step="0.01" min="0.02" max="1">
    <div class="hint">Plus bas = position plus stable (moins de d\xE9rive \xE0 l'arr\xEAt). Plus haut = suit mieux les d\xE9placements rapides.</div>
  </div>
  <div class="field">
    <label>Session (debug / r\xE9glage sans rebuild)</label>
    <button class="btn" onclick="exportSession()" style="margin-top:4px;">Exporter la session (JSON)</button>
    <div class="hint">Partage toutes les mesures brutes enregistr\xE9es pendant le scan.</div>
  </div>
  <div class="config-actions">
    <button class="btn primary" onclick="saveConfig()">✓ Enregistrer</button>
    <button class="btn" onclick="closeConfig()">Annuler</button>
  </div>
</div>

<div id="calib-overlay">
  <div id="calib-title">Calibration TxPower</div>
  <div id="calib-msg">Pose le t\xE9l\xE9phone \xE0 1 m de Mia, immobile.<br>Mesure dans <span id="calib-count">3</span>s…</div>
  <div id="calib-progress"><div id="calib-progress-fill"></div></div>
  <div id="calib-rssi">RSSI moyen : — dBm</div>
  <div id="calib-actions">
    <button class="btn danger" onclick="cancelCalibration()">Annuler</button>
  </div>
</div>

<div id="app">
  <div id="header">
    <div id="status-dot"></div>
    <div id="status-text">D\xE9marrage…</div>
    <div id="motion-pill"><span id="motion-icon">•</span><span id="motion-label">—</span></div>
    <h1 id="header-title">\u{1F431} Mia</h1>
  </div>
  <div id="debug-bar">
    <div class="dbg-row"><span><span class="dbg-key">boot</span>: <span id="dbg-boot" class="dbg-ok">init…</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">erreur</span>: <span id="dbg-err" class="dbg-err">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">leaflet</span>: <span id="dbg-leaflet">—</span> &middot; <span class="dbg-key">rx</span> rssi=<span id="dbg-rx-rssi">0</span> gps=<span id="dbg-rx-gps">0</span> still=<span id="dbg-rx-still">0</span> hdg=<span id="dbg-rx-hdg">0</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">ping natif</span>: <span id="dbg-natp">—</span> &middot; <span class="dbg-key">accel</span>: <span id="dbg-accel">—</span> &middot; <span class="dbg-key">haptic</span>: <span id="dbg-haptic">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">mac ciblee</span>: <span id="dbg-mac">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">scans</span> <span id="dbg-nat">0</span> &middot; <span class="dbg-key">matched</span> <span id="dbg-natm">0</span> &middot; <span class="dbg-key">rssi</span> <span id="dbg-natr">—</span> dBm &middot; <span class="dbg-key">age</span> <span id="dbg-age">—</span>s</span></div>
    <div class="dbg-row"><span><span class="dbg-key">gps acc</span> <span id="dbg-gpsacc">—</span> m &middot; <span class="dbg-key">still</span> <span id="dbg-still">—</span> &middot; <span class="dbg-key">var</span> <span id="dbg-var">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">baseline</span> <span id="dbg-bsl">—</span> m / <span id="dbg-ang">—</span>\xB0 &middot; <span class="dbg-key">rms</span> <span id="dbg-rms">—</span> m &middot; <span class="dbg-key">kf.x</span> <span id="dbg-kfx">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">diag natif</span>: <span id="dbg-natd" class="dbg-hex">—</span></span></div>
  </div>
  <div id="map-fallback">
    <div style="font-size:1.2rem;color:var(--warn);">\u{26A0} Carte indisponible</div>
    <div>Pas de r\xE9seau ou Leaflet bloqu\xE9.<br>L'app fonctionne quand m\xEAme : RSSI, chaud/froid, calibration.</div>
  </div>
  <div id="map"></div>
  <div id="hotcold">
    <div id="hc-arrow">—</div>
    <div id="hc-text">En attente du signal…</div>
    <div id="hc-slope">— dBm/s</div>
  </div>
  <div id="rssi-bar">
    <div id="rssi-label">RSSI</div>
    <div id="rssi-track"><div id="rssi-fill"></div></div>
    <div id="rssi-val">— dBm</div>
  </div>
  <div id="compass-row">
    <div id="compass-wrap">
      <div id="compass-ring"></div>
      <div id="compass-arrow"></div>
      <div id="compass-center"></div>
    </div>
    <div id="info-col">
      <div class="info-row"><span class="info-lbl">Distance estim\xE9e</span><span class="info-val" id="dist-val">—</span></div>
      <div class="info-row"><span class="info-lbl">Confiance</span><span class="info-val" id="conf-val" style="color:var(--muted)">—</span></div>
      <div class="info-row"><span class="info-lbl">Mesures</span><span id="measures-count">0</span></div>
    </div>
  </div>
  <div id="controls">
    <button class="btn primary" id="btn-scan" onclick="toggleScan()">▶ Scanner</button>
    <button class="btn warn" onclick="centerMap()">⊙ Centrer</button>
    <button class="btn danger" onclick="clearMeasures()">✕ Effacer</button>
    <button class="btn" onclick="openConfig()">⚙</button>
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
  // Si l'IIFE crash, on saura quelle etape a passe et laquelle a echoue.
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
    uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
    txPower: -40, n: 2.5, name: 'Mia',
    showDebug: false,
    haptic: true,
    stillGate: true,
    showMyMeasures: false,  // points GPS des mesures RSSI (utile en debug, off par defaut)
    showBeaconTrail: true,  // trajectoire estimee de Mia
    gpsSigmaA: 0.12,        // bruit d'acceleration du Kalman GPS (bas = position plus stable)
    particles: 600,         // taille du nuage du filtre particulaire (position beacon)
    usePF: true             // utiliser le filtre particulaire (sinon trilateration seule)
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
  // RSSI vu en pratique : 10 dBm de variance statique observ\xE9e.
  // Kalman 1D : on garde un R \xE9lev\xE9 (mesures bruit\xE9es) mais on remonte Q
  // pour rester reactif aux vrais changements. Time constant ~ sqrt(R/Q) ~= 3 samples.
  var K_R = 15.0;           // measurement noise variance (etait 25, baisse pour reactivite)
  var K_Q = 2.0;            // process noise variance (etait 0.5, monte pour reactivite)
  var RSSI_JUMP_DBM = 15;   // saut max accept\xE9 entre 2 samples cons\xE9cutifs (sinon outlier)
  var HOT_COLD_WINDOW_MS = 5000;  // fen\xEAtre pour la pente RSSI (etait 8s)
  var HOT_COLD_HYST_DBM = 4;       // hyst\xE9r\xE9sis : sous ce delta, on dit "stable"
  var GPS_ACC_MAX_M = 25;          // au-del\xE0, pond\xE9ration GPS quasi-nulle
  var MIN_BASELINE_M = 5;          // spread spatial minimum pour publier une position triangul\xE9e
  var MIN_ANGLE_DEG = 60;          // angle de vue minimum depuis le centro\xEFde
  var MEASURE_WINDOW_MS = 30000;   // fen\xEAtre temporelle des mesures retenues
  var HAPTIC_TICK_MS = 1400;       // p\xE9riode minimum entre 2 vibrations
  var CALIB_DURATION_MS = 10000;   // dur\xE9e de la mesure de calibration
  var DIST_DISPLAY_ALPHA = 0.25;   // EMA pour lisser la distance affichee
  var BEACON_TRAIL_MAX = 30;       // nb max de positions estimees gardees pour la trajectoire

  function postRN(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function applyCfgToForm() {
    document.getElementById('cfg-uuid').value = cfg.uuid;
    document.getElementById('cfg-txpower').value = cfg.txPower;
    document.getElementById('cfg-n').value = cfg.n;
    document.getElementById('cfg-name').value = cfg.name;
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
    document.getElementById('cfg-debug-switch').classList.toggle('on', !!cfg.showDebug);
    document.getElementById('cfg-haptic-switch').classList.toggle('on', !!cfg.haptic);
    document.getElementById('cfg-stillgate-switch').classList.toggle('on', !!cfg.stillGate);
    document.getElementById('cfg-trail-switch').classList.toggle('on', !!cfg.showBeaconTrail);
    document.getElementById('cfg-mymeas-switch').classList.toggle('on', !!cfg.showMyMeasures);
    document.getElementById('cfg-gpsA').value = cfg.gpsSigmaA;
    document.getElementById('cfg-pf-switch').classList.toggle('on', !!cfg.usePF);
    applyDebugVisibility();
    applyMyMeasuresVisibility();
    applyBeaconTrailVisibility();
  }

  function applyDebugVisibility() {
    // La debug bar n'apparait que si l'option est activ\xE9e ET qu'un scan est en cours.
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

  window.toggleBeaconTrail = function() {
    cfg.showBeaconTrail = !cfg.showBeaconTrail;
    document.getElementById('cfg-trail-switch').classList.toggle('on', cfg.showBeaconTrail);
    applyBeaconTrailVisibility();
  };

  window.toggleMyMeasures = function() {
    cfg.showMyMeasures = !cfg.showMyMeasures;
    document.getElementById('cfg-mymeas-switch').classList.toggle('on', cfg.showMyMeasures);
    applyMyMeasuresVisibility();
  };

  window.togglePF = function() {
    cfg.usePF = !cfg.usePF;
    document.getElementById('cfg-pf-switch').classList.toggle('on', cfg.usePF);
  };

  // Affiche / cache le calque des points GPS de mesure
  function applyMyMeasuresVisibility() {
    if (!mapAvailable || !measureLayer) return;
    if (cfg.showMyMeasures) {
      if (!map.hasLayer(measureLayer)) measureLayer.addTo(map);
    } else {
      if (map.hasLayer(measureLayer)) map.removeLayer(measureLayer);
    }
  }

  // Affiche / cache le calque de trajectoire estimee de Mia
  function applyBeaconTrailVisibility() {
    if (!mapAvailable || !beaconTrailLayer) return;
    if (cfg.showBeaconTrail) {
      if (!map.hasLayer(beaconTrailLayer)) beaconTrailLayer.addTo(map);
    } else {
      if (map.hasLayer(beaconTrailLayer)) map.removeLayer(beaconTrailLayer);
    }
  }

  window.openConfig = function() { document.getElementById('config-panel').classList.add('open'); };
  window.closeConfig = function() { document.getElementById('config-panel').classList.remove('open'); };
  window.saveConfig = function() {
    cfg.uuid    = (document.getElementById('cfg-uuid').value || '').trim().toUpperCase();
    cfg.txPower = parseFloat(document.getElementById('cfg-txpower').value) || -40;
    cfg.n       = parseFloat(document.getElementById('cfg-n').value) || 2.5;
    cfg.name    = (document.getElementById('cfg-name').value || '').trim() || 'Mia';
    cfg.gpsSigmaA = parseFloat(document.getElementById('cfg-gpsA').value) || 0.12;
    // showDebug / usePF sont d\xE9j\xE0 \xE0 jour via leurs toggles
    localStorage.setItem('miatracker_cfg', JSON.stringify(cfg));
    // recr\xE9e les filtres avec les nouveaux param\xE8tres (tuning \xE0 chaud, zero rebuild)
    if (A) {
      gpsF = A.createGpsFilter({ sigmaA: cfg.gpsSigmaA, maxAccuracy: GPS_ACC_MAX_M });
      estimator = cfg.usePF ? A.createEstimator({ numParticles: cfg.particles }) : null;
      refFrame = null;
    }
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
    postRN({ type: 'config', uuid: cfg.uuid });
    closeConfig();
    snack('Configuration enregistr\xE9e');
  };

  window.exportSession = function() {
    var payload = JSON.stringify({ cfg: cfg, events: recorder.events });
    postRN({ type: 'exportSession', payload: payload });
    snack('Export de ' + recorder.events.length + ' \xE9v\xE9nements');
  };

  // ===== Map =====
  // Si Leaflet (CDN) n'a pas charge, on tombe en mode "carte indisponible" et
  // on conserve quand meme le RSSI/chaud-froid/calibration. Pas de crash global.
  var map = null, markerMe = null, markerBeacon = null;
  var measureLayer = null, lineLayer = null;
  var uncertaintyCircle = null;
  var areaCircle = null;
  var mapAvailable = false;
  var leafletStatus = 'absent';

  try {
    if (typeof L === 'undefined') {
      leafletStatus = 'undefined';
      throw new Error('Leaflet non charge (CDN bloque ?)');
    }
    leafletStatus = 'v' + (L.version || '?');
    map = L.map('map', { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, subdomains: 'abcd' }).addTo(map);
    L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution('\xA9 OpenStreetMap \xB7 CartoDB').addTo(map);
    map.setView([48.85, 2.35], 18);
    measureLayer = L.layerGroup(); // pas addTo(map) par defaut, controle par toggle
    lineLayer = L.layerGroup().addTo(map);
    beaconTrailLayer = L.layerGroup().addTo(map);
    mapAvailable = true;
    bootStep('map');
  } catch(e) {
    bootErr('map init: ' + e.message);
    bootStep('map-err');
    try {
      document.getElementById('map').style.display = 'none';
      document.getElementById('map-fallback').classList.add('show');
    } catch(_){}
  }
  try { var el = document.getElementById('dbg-leaflet'); if (el) { el.textContent = leafletStatus; el.className = mapAvailable ? 'dbg-ok' : 'dbg-err'; } } catch(_){}

  function makeIcon(cls) {
    return L.divIcon({ className:'', html: '<div class="'+cls+'"></div>', iconSize:[14,14], iconAnchor:[7,7] });
  }

  // ===== State =====
  var scanning = false;
  var myPos = null;          // { lat, lng, acc }
  var measures = [];          // { lat, lng, acc, rssi, dist, t }
  var rssiHistory = [];       // { t, rssi (smoothed) } pour la pente chaud/froid
  var beaconPos = null;
  var lastBearing = null;
  var deviceHeading = 0;
  var mapAutoCentered = false;

  // Kalman 1D state
  var kf = { initialized: false, x: 0, p: 1.0 };
  var lastRawRssi = null;
  var lastRawRssiTime = 0;

  // Module algo testé (injecté via algoSource) : Kalman GPS 2D + filtre particulaire.
  var A = window.MiaAlgo || null;
  if (!A) bootErr('MiaAlgo absent');
  var gpsF = A ? A.createGpsFilter({ sigmaA: cfg.gpsSigmaA, maxAccuracy: GPS_ACC_MAX_M }) : null;
  var refFrame = null;        // cadre métrique partagé (créé au 1er fix filtré)
  var estimator = (A && cfg.usePF) ? A.createEstimator({ numParticles: cfg.particles }) : null;
  var lastPFestimate = 0;

  // Enregistreur de session : journalise les événements bruts (rssi/gps/heading/still)
  // pour pouvoir les exporter et régler l'algo hors-ligne, sans rebuild.
  var recorder = {
    on: false, events: [],
    start: function () { this.events = [{ type: 'cfg', cfg: JSON.parse(JSON.stringify(cfg)), t: Date.now() }]; this.on = true; },
    stop: function () { this.on = false; },
    rec: function (m) { if (this.on) { this.events.push(m); if (this.events.length > 8000) this.events.shift(); } }
  };

  // Stillness gate (vient de l'accelerometre via RN)
  var isStill = false;       // true = telephone immobile
  var stillSinceMs = 0;      // depuis quand on est immobile (pour les transitions)

  // Haptic feedback state
  var lastHapticMs = 0;
  var lastHotcoldState = 'idle'; // 'hot' / 'cold' / 'stable' / 'idle'

  // Calibration state
  var calib = null; // { phase: 'countdown'|'recording'|'done', startMs, samples: [], timer }

  // Distance affichee : EMA pour lisser visuellement (RSSI fluctue tout seul,
  // afficher cette fluctuation est inutile et stressant a l'utilisation).
  var distDisplay = null;
  function updateDistDisplay(rawDist) {
    if (distDisplay == null) distDisplay = rawDist;
    else distDisplay = DIST_DISPLAY_ALPHA * rawDist + (1 - DIST_DISPLAY_ALPHA) * distDisplay;
    var el = document.getElementById('dist-val');
    if (el) el.textContent = distDisplay < 1000 ? distDisplay.toFixed(1) + ' m' : '>1 km';
  }

  // Historique des positions estimees du beacon (trajectoire Mia)
  var beaconHistory = [];  // [{lat, lng, t, conf}]
  var beaconTrailLayer = null;
  var beaconTrailLine = null;

  // RX counters
  var rx = { rssi: 0, gps: 0, still: 0, hdg: 0 };
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

  // ===== Geom =====
  function rssiToDistance(rssi) {
    return Math.pow(10, (cfg.txPower - rssi) / (10 * cfg.n));
  }

  function getDistance(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function getBearing(lat1, lng1, lat2, lng2) {
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    var x = Math.cos(lat1*Math.PI/180)*Math.sin(lat2*Math.PI/180) - Math.sin(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // Cluster les mesures spatialement et ne garde par cluster que la mesure de plus haut RSSI
  // (le max local est plus proche de la vraie distance que la moyenne : le canal BLE
  // p\xE9nalise par multipath/obstacles, jamais l'inverse).
  function deduplicate(pts, minDist) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], merged = false;
      for (var j = 0; j < out.length; j++) {
        if (getDistance(p.lat, p.lng, out[j].lat, out[j].lng) < minDist) {
          if (p.rssi > out[j].rssi) {
            out[j].lat = p.lat; out[j].lng = p.lng; out[j].rssi = p.rssi; out[j].dist = p.dist; out[j].acc = p.acc;
          }
          merged = true; break;
        }
      }
      if (!merged) out.push({ lat:p.lat, lng:p.lng, rssi:p.rssi, dist:p.dist, acc:p.acc });
    }
    return out;
  }

  // Spread spatial maximum + angle de vue depuis le centro\xEFde
  function baselineMetrics(pts) {
    if (pts.length < 2) return { spread: 0, angle: 0 };
    // spread = distance max entre 2 points
    var spread = 0;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i+1; j < pts.length; j++) {
        var d = getDistance(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng);
        if (d > spread) spread = d;
      }
    }
    // angle = couverture angulaire des points vus depuis leur propre centro\xEFde
    var cLat = 0, cLng = 0;
    for (var k = 0; k < pts.length; k++) { cLat += pts[k].lat; cLng += pts[k].lng; }
    cLat /= pts.length; cLng /= pts.length;
    var angles = [];
    for (var m = 0; m < pts.length; m++) {
      if (getDistance(cLat, cLng, pts[m].lat, pts[m].lng) < 0.3) continue;
      angles.push(getBearing(cLat, cLng, pts[m].lat, pts[m].lng));
    }
    if (angles.length < 2) return { spread: spread, angle: 0 };
    angles.sort(function(a,b){return a-b;});
    var maxGap = 0;
    for (var n = 0; n < angles.length; n++) {
      var next = n === angles.length - 1 ? angles[0] + 360 : angles[n+1];
      var gap = next - angles[n];
      if (gap > maxGap) maxGap = gap;
    }
    var coverage = 360 - maxGap;
    return { spread: spread, angle: coverage };
  }

  // Gauss-Newton sur dist^2, retourne aussi le residu RMS pour la zone d'incertitude
  function trilaterate(pts) {
    var lat = 0, lng = 0;
    for (var i = 0; i < pts.length; i++) { lat += pts[i].lat; lng += pts[i].lng; }
    lat /= pts.length; lng /= pts.length;
    var R = 6371000;
    for (var it = 0; it < 60; it++) {
      var gLat = 0, gLng = 0, step = 0, wTotal = 0;
      for (var k = 0; k < pts.length; k++) {
        var p = pts[k];
        var d = getDistance(lat, lng, p.lat, p.lng);
        if (d < 0.001) continue;
        var err = d - p.dist;
        var dLat = (lat - p.lat) * R * Math.PI / 180;
        var dLng = (lng - p.lng) * R * Math.cos(lat * Math.PI/180) * Math.PI / 180;
        // poids : qualit\xE9 GPS (1/acc^2 satur\xE9e) * 1/dist^2 (mesures proches plus fiables)
        var accW = p.acc && p.acc > 0 ? 1.0 / Math.max(1, Math.min(p.acc, GPS_ACC_MAX_M)) : 1.0;
        var w = accW * accW * (1.0 / (p.dist * p.dist + 1));
        gLat += w * err * dLat / d;
        gLng += w * err * dLng / d;
        step += Math.abs(err) * w;
        wTotal += w;
      }
      if (wTotal < 1e-9) break;
      var lr = 0.0002 / wTotal;
      lat -= gLat * lr;
      lng -= gLng * lr;
      if (step / wTotal < 0.05) break;
    }
    // residu rms (en m)
    var sumSq = 0;
    for (var m = 0; m < pts.length; m++) {
      var dd = getDistance(lat, lng, pts[m].lat, pts[m].lng) - pts[m].dist;
      sumSq += dd * dd;
    }
    var rms = Math.sqrt(sumSq / pts.length);
    if (rms > 500) return null;
    return { lat: lat, lng: lng, rms: rms };
  }

  // Alimente le filtre particulaire avec une mesure (position filtrée + distance RSSI).
  // sigma combine l'incertitude RSSI->distance et la précision GPS.
  function feedEstimator(pos, dist) {
    if (!estimator || !A) return;
    if (!refFrame) refFrame = A.makeRef(pos.lat, pos.lng);
    var m = A.toLocal(refFrame, pos.lat, pos.lng);
    var sigR = A.distanceSigma(dist, Math.sqrt(K_R), cfg.n);
    var sigma = Math.sqrt(sigR * sigR + (pos.acc || 5) * (pos.acc || 5));
    estimator.addMeasurement({ x: m.x, y: m.y, dist: dist, sigma: sigma });
  }

  function estimateBeaconPosition() {
    if (!myPos) return;
    var now = Date.now();
    var recent = measures.filter(function(m){ return now - m.t < MEASURE_WINDOW_MS; });
    if (recent.length < 1) return;
    var unique = deduplicate(recent, 0.5);

    var bm = baselineMetrics(unique);
    var distFromRSSI = rssiToDistance(kf.x); // distance la plus r\xE9cente, pour fallback

    var dbgBsl = bm.spread.toFixed(1);
    var dbgAng = bm.angle.toFixed(0);
    var dbgRms = '—';

    // === Cas 1 : baseline insuffisante ===
    // Pas assez de spread ou d'angle pour trianguler honn\xEAtement. On affiche
    // un cercle "quelque part dans X m autour de toi" plut\xF4t que mentir
    // avec un point pr\xE9cis.
    var enoughBaseline = unique.length >= 3 && bm.spread >= MIN_BASELINE_M && bm.angle >= MIN_ANGLE_DEG;
    if (!enoughBaseline) {
      clearBeaconMarker();
      // rayon = distance RSSI brute + marge GPS (1.5x pour incertitude propag\xE9e)
      var radius = Math.max(2, distFromRSSI * 1.5);
      placeAreaCircle(myPos.lat, myPos.lng, radius);
      updateDistDisplay(distFromRSSI);
      document.getElementById('conf-val').innerHTML = '\u{1F534} faible <span style="color:var(--muted);font-size:.7rem">(baseline ' + dbgBsl + 'm / ' + dbgAng + '\xB0)</span>';
      var hint;
      if (unique.length < 3) hint = 'D\xE9place-toi pour collecter plus de mesures…';
      else if (bm.spread < MIN_BASELINE_M) hint = 'Marche de quelques m\xE8tres pour trianguler…';
      else hint = 'Contourne la zone pour \xE9largir l\\'angle…';
      document.getElementById('measures-count').textContent = measures.length + ' \xB7 ' + hint;
      // bearing : indisponible tant qu'on n'a pas une position triangul\xE9e
      updateDebugBaseline(dbgBsl, dbgAng, dbgRms);
      return;
    }

    // === Cas 2 : baseline OK, on localise ===
    clearAreaCircle();

    var solLat, solLng, solRms, conf, method;
    // Filtre particulaire (robuste au bruit, cible mobile, incertitude native) si
    // dispo et assez de mises a jour ; sinon repli sur la trilateration historique.
    var e = (cfg.usePF && estimator) ? estimator.estimate() : null;
    if (e && refFrame && e.updates >= 3) {
      var ll = A.toLatLng(refFrame, e.x, e.y);
      solLat = ll.lat; solLng = ll.lng; solRms = e.meanRadius;
      conf = Math.round(e.confidence);
      method = 'particulaire n=' + unique.length;
      dbgRms = solRms.toFixed(1);
    } else {
      var nls = trilaterate(unique);
      if (!nls) {
        // solveur a \xE9chou\xE9 \xE0 converger : fallback prudent
        clearBeaconMarker();
        placeAreaCircle(myPos.lat, myPos.lng, Math.max(2, distFromRSSI * 1.5));
        updateDebugBaseline(dbgBsl, dbgAng, '—');
        return;
      }
      solLat = nls.lat; solLng = nls.lng; solRms = nls.rms;
      dbgRms = nls.rms.toFixed(1);
      // confiance : combine nb mesures, baseline, et rms r\xE9siduel
      var rmsFactor = Math.max(0, 1 - nls.rms / 20); // rms <5m bien, >20m mauvais
      var baseFactor = Math.min(1, (bm.spread / 15) * (bm.angle / 180));
      var measFactor = Math.min(1, unique.length / 8);
      conf = Math.round(100 * (0.5 * rmsFactor + 0.3 * baseFactor + 0.2 * measFactor));
      method = 'trilat\xE9ration n=' + unique.length;
    }

    placeBeaconMarker(solLat, solLng, solRms, conf, method);
    var bearing = getBearing(myPos.lat, myPos.lng, solLat, solLng);
    setCompassBearing(bearing);
    var d = getDistance(myPos.lat, myPos.lng, solLat, solLng);
    updateDistDisplay(d);
    var confLabel = conf > 65 ? '\u{1F7E2} \xE9lev\xE9e' : conf > 35 ? '\u{1F7E1} moyenne' : '\u{1F534} faible';
    document.getElementById('conf-val').innerHTML = confLabel + ' <span style="color:var(--muted);font-size:.7rem">(±' + Math.round(solRms) + 'm)</span>';
    document.getElementById('measures-count').textContent = measures.length + ' \xB7 ' + method;
    updateDebugBaseline(dbgBsl, dbgAng, dbgRms);
  }

  function updateDebugBaseline(bsl, ang, rms) {
    var el;
    el = document.getElementById('dbg-bsl'); if (el) el.textContent = bsl;
    el = document.getElementById('dbg-ang'); if (el) el.textContent = ang;
    el = document.getElementById('dbg-rms'); if (el) el.textContent = rms;
  }

  function placeBeaconMarker(lat, lng, rms, conf, method) {
    beaconPos = { lat: lat, lng: lng };
    // historique pour la trajectoire estimee : on n'ajoute que des points
    // suffisamment espaces (>1 m) pour eviter de saturer avec des positions
    // quasi-identiques quand Mia est statique.
    var addToHistory = true;
    if (beaconHistory.length > 0) {
      var last = beaconHistory[beaconHistory.length - 1];
      if (getDistance(last.lat, last.lng, lat, lng) < 1.0) addToHistory = false;
    }
    if (addToHistory) {
      beaconHistory.push({ lat: lat, lng: lng, t: Date.now(), conf: conf });
      if (beaconHistory.length > BEACON_TRAIL_MAX) beaconHistory.shift();
      redrawBeaconTrail();
    }
    if (!mapAvailable) return;
    lineLayer.clearLayers();
    if (!markerBeacon) {
      markerBeacon = L.marker([lat, lng], { icon: makeIcon('marker-beacon') })
        .bindTooltip(cfg.name, { permanent: true, direction: 'top', offset: [0,-8] }).addTo(map);
    } else {
      markerBeacon.setLatLng([lat, lng]);
    }
    // Zone d'incertitude : cercle bas\xE9 sur le RMS r\xE9siduel du solveur,
    // born\xE9 entre 2 m et 80 m pour rester lisible \xE0 l'\xE9cran.
    if (uncertaintyCircle) { uncertaintyCircle.remove(); uncertaintyCircle = null; }
    var radius = Math.max(2, Math.min(80, rms * 1.5));
    uncertaintyCircle = L.circle([lat, lng], {
      radius: radius, color: '#58a6ff', fill: true, fillColor: '#58a6ff',
      fillOpacity: 0.08, weight: 1, dashArray: '4,4'
    }).addTo(lineLayer);
    if (myPos) {
      L.polyline([[myPos.lat, myPos.lng],[lat, lng]], { color: '#58a6ff', weight: 1.5, opacity: 0.5, dashArray: '6,4' }).addTo(lineLayer);
    }
  }

  // Dessine la trajectoire estimee de Mia : polyline reliant les positions
  // historiques + petits cercles a chaque position. Les positions recentes
  // sont plus opaques, les vieilles fade.
  function redrawBeaconTrail() {
    if (!mapAvailable || !beaconTrailLayer) return;
    beaconTrailLayer.clearLayers();
    if (beaconHistory.length < 1) return;
    var now = Date.now();
    var pts = beaconHistory.map(function(p){ return [p.lat, p.lng]; });
    if (pts.length >= 2) {
      L.polyline(pts, { color: 'var(--beacon)' === 'var(--beacon)' ? '#58a6ff' : '#58a6ff', weight: 2.5, opacity: 0.55, dashArray: '2,5' }).addTo(beaconTrailLayer);
    }
    // age-fade circles ; le marker beacon principal s'occupe deja du dernier point
    for (var i = 0; i < beaconHistory.length - 1; i++) {
      var p = beaconHistory[i];
      var ageSec = (now - p.t) / 1000;
      var op = Math.max(0.15, 1.0 - ageSec / 180); // 3 min pour fade complet
      var icon = L.divIcon({
        className: '',
        html: '<div style="width:8px;height:8px;border-radius:50%;background:#58a6ff;border:1px solid #fff;box-shadow:0 0 4px #58a6ff;opacity:' + op.toFixed(2) + '"></div>',
        iconSize: [8,8], iconAnchor: [4,4]
      });
      var ageLabel = ageSec < 60 ? Math.round(ageSec) + 's' : Math.round(ageSec/60) + 'min';
      L.marker([p.lat, p.lng], { icon: icon })
        .bindTooltip('Il y a ' + ageLabel, { sticky: true })
        .addTo(beaconTrailLayer);
    }
  }

  function clearBeaconMarker() {
    if (markerBeacon) { try { markerBeacon.remove(); } catch(e){} markerBeacon = null; }
    if (uncertaintyCircle) { try { uncertaintyCircle.remove(); } catch(e){} uncertaintyCircle = null; }
    if (lineLayer) lineLayer.clearLayers();
    beaconPos = null;
    // compass : on remet \xE0 z\xE9ro tant qu'on n'a pas de bearing fiable
    lastBearing = null;
    document.getElementById('compass-arrow').style.transform = 'translate(-50%,-50%) rotate(0deg)';
  }

  function placeAreaCircle(lat, lng, radius) {
    if (!mapAvailable) return;
    if (areaCircle) { try { areaCircle.remove(); } catch(e){} areaCircle = null; }
    areaCircle = L.circle([lat, lng], {
      radius: radius, color: '#f0b429', fill: true, fillColor: '#f0b429',
      fillOpacity: 0.05, weight: 1.5, dashArray: '8,6'
    }).bindTooltip('Mia : quelque part dans ce cercle', { sticky: true }).addTo(map);
  }

  function clearAreaCircle() {
    if (areaCircle) { areaCircle.remove(); areaCircle = null; }
  }

  function addMeasureMarker(lat, lng, rssi, dist) {
    if (!mapAvailable) return;
    var pct = Math.max(0, Math.min(100, (rssi + 100) / 60 * 100));
    var color = pct > 66 ? '#39d353' : pct > 33 ? '#f0b429' : '#f85149';
    var icon = L.divIcon({
      className: '',
      html: '<div class="marker-meas" style="background:'+color+';border-color:'+color+';opacity:.7"></div>',
      iconSize: [8,8], iconAnchor: [4,4]
    });
    L.marker([lat, lng], { icon: icon })
      .bindTooltip(dist.toFixed(1) + ' m \xB7 ' + rssi.toFixed(0) + ' dBm', { sticky: true })
      .addTo(measureLayer);
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

  function setCompassBearing(bearing) {
    lastBearing = bearing;
    var angle = (bearing - deviceHeading + 360) % 360;
    document.getElementById('compass-arrow').style.transform = 'translate(-50%,-50%) rotate('+angle+'deg)';
  }

  function setStatus(msg, state) {
    document.getElementById('status-text').textContent = msg;
    var dot = document.getElementById('status-dot');
    dot.className = (state === 'active' || state === 'warn' || state === 'error') ? state : '';
  }

  function updateScanBtn() {
    var btn = document.getElementById('btn-scan');
    if (scanning) { btn.textContent = '■ Arr\xEAter'; btn.className = 'btn danger'; }
    else          { btn.textContent = '▶ Scanner'; btn.className = 'btn primary'; }
  }

  // ===== Hot / cold indicator =====
  // Calcul de la pente du RSSI liss\xE9 sur HOT_COLD_WINDOW_MS.
  // R\xE9gression lin\xE9aire simple : pente en dBm/s.
  // RSSI augmente quand on se rapproche -> "chaud".
  function updateHotCold() {
    var now = Date.now();
    // \xE9lague l'historique
    while (rssiHistory.length && now - rssiHistory[0].t > HOT_COLD_WINDOW_MS) rssiHistory.shift();
    var arrow = document.getElementById('hc-arrow');
    var text  = document.getElementById('hc-text');
    var slope = document.getElementById('hc-slope');
    if (rssiHistory.length < 3) {
      arrow.textContent = '—';
      arrow.style.color = 'var(--neutral)';
      text.textContent = scanning ? 'En attente de mesures…' : 'Scan arr\xEAt\xE9';
      text.style.color = 'var(--neutral)';
      slope.textContent = '— dBm/s';
      return;
    }
    // r\xE9gression lin\xE9aire y = a*t + b, t en secondes depuis premi\xE8re mesure
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
      text.textContent = 'Tu t\\'\xE9loignes';
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
  // -75 dBm = loin (intensite 1), -65 = moyen (2), -55+ = tres proche (3).
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

    // Garde anti-outlier : un saut > RSSI_JUMP_DBM en <1s est physiquement
    // improbable pour un chat qui se d\xE9place. La valeur est quand m\xEAme
    // affich\xE9e dans la barre RSSI (pour transparence), mais on ne nourrit
    // ni le Kalman, ni la triangulation avec.
    var keepForFusion = true;
    if (lastRawRssi !== null && now - lastRawRssiTime < 1500) {
      if (Math.abs(rssi - lastRawRssi) > RSSI_JUMP_DBM) keepForFusion = false;
    }
    lastRawRssi = rssi; lastRawRssiTime = now;

    var smoothed = keepForFusion ? kalmanUpdate(rssi) : (kf.initialized ? kf.x : rssi);
    var kEl = document.getElementById('dbg-kfx'); if (kEl) kEl.textContent = smoothed.toFixed(1);

    updateRSSIBar(smoothed);
    setStatus('Beacon: ' + (name || cfg.name) + ' \xB7 RSSI ' + smoothed.toFixed(1) + ' dBm', 'active');

    // Historique pour chaud/froid (toujours, m\xEAme pour les outliers : on veut
    // d\xE9tecter une vraie tendance, et le Kalman a d\xE9j\xE0 absorb\xE9 le saut)
    rssiHistory.push({ t: now, rssi: smoothed });
    updateHotCold();

    var dist = rssiToDistance(smoothed);
    updateDistDisplay(dist);

    // Si on est en calibration, alimente les samples (qu'on soit avec ou sans GPS).
    if (calib && calib.phase === 'recording' && keepForFusion) {
      calib.samples.push(smoothed);
    }

    if (keepForFusion && myPos) {
      // Pond\xE9ration par accuracy GPS : on jette les mesures avec GPS trop d\xE9grad\xE9
      // (au-del\xE0 de GPS_ACC_MAX_M), elles n'apportent que du bruit \xE0 la triangulation.
      var accOK = (myPos.acc == null || myPos.acc <= GPS_ACC_MAX_M);
      // Still gate : si l'accelero dit immobile depuis >1s, on n'ajoute plus
      // de mesures triangulation (sinon le GPS qui derive cree de fausses baselines).
      var stillBlock = cfg.stillGate && isStill && stillSinceMs > 0 && (now - stillSinceMs) > 1000;
      if (accOK && !stillBlock) {
        measures.push({ lat: myPos.lat, lng: myPos.lng, acc: myPos.acc || 5, rssi: smoothed, dist: dist, t: now });
        addMeasureMarker(myPos.lat, myPos.lng, smoothed, dist);
        feedEstimator(myPos, dist);
        estimateBeaconPosition();
      }
    }
  }

  function handleGPS(lat, lng, acc) {
    var now = Date.now();
    var rawAcc = (typeof acc === 'number' && acc > 0) ? acc : null;
    // GEL : quand l'accéléromètre dit immobile depuis >1s, on FIGE la position
    // filtrée. C'est ce qui supprime la dérive du point "moi" à l'arrêt — la
    // cause n°1 d'incertitude ajoutée sur la position du beacon.
    var frozen = cfg.stillGate && isStill && stillSinceMs > 0 && (now - stillSinceMs) > 1000;
    if (gpsF && !frozen) {
      // Kalman GPS 2D : lisse le bruit GPS et amortit la vitesse (anti-dérive).
      var r = gpsF.push(lat, lng, rawAcc == null ? GPS_ACC_MAX_M : rawAcc, now);
      if (r) myPos = { lat: r.lat, lng: r.lng, acc: r.accuracy };
      else if (!myPos) myPos = { lat: lat, lng: lng, acc: rawAcc }; // fix gaté, rien encore
    } else if (!myPos) {
      // immobile dès le départ : on prend le brut pour avoir une position
      myPos = { lat: lat, lng: lng, acc: rawAcc };
    }
    // si frozen et myPos déjà connu : on garde myPos tel quel (gel)
    var el = document.getElementById('dbg-gpsacc');
    if (el) el.textContent = myPos.acc != null ? myPos.acc.toFixed(1) : '—';
    if (!mapAvailable) return;
    if (!markerMe) {
      markerMe = L.marker([myPos.lat, myPos.lng], { icon: makeIcon('marker-me') })
        .bindTooltip('Vous', { permanent: false }).addTo(map);
    } else {
      markerMe.setLatLng([myPos.lat, myPos.lng]);
    }
    if (!mapAutoCentered) {
      map.setView([myPos.lat, myPos.lng], 19);
      mapAutoCentered = true;
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
    if (!scanning) { snack('Lance d\\'abord le scan pour calibrer'); return; }
    closeConfig();
    calib = { phase: 'countdown', startMs: Date.now(), samples: [], timer: null };
    document.getElementById('calib-overlay').classList.add('open');
    document.getElementById('calib-progress-fill').style.width = '0%';
    document.getElementById('calib-rssi').textContent = 'RSSI moyen : — dBm';
    var counter = 3;
    document.getElementById('calib-msg').innerHTML = 'Pose le t\xE9l\xE9phone \xE0 1 m de Mia, immobile.<br>Mesure dans <span id="calib-count">' + counter + '</span>s…';
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
          document.getElementById('calib-rssi').textContent = 'RSSI moyen : ' + avg.toFixed(1) + ' dBm (' + calib.samples.length + ' \xE9chantillons)';
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
      snack('Pas assez de mesures — v\xE9rifie que le beacon est actif');
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
    snack('TxPower calibr\xE9 \xE0 ' + cfg.txPower + ' dBm (' + cfg.txPower + ' dBm \xE0 1 m)');
    // Repart sur des bases propres : les anciennes mesures etaient calculees
    // avec l'ancien txPower, donc leur dist embarquee est obsolete.
    measures = []; beaconHistory = []; distDisplay = null;
    if (estimator) estimator.reset(); refFrame = null;
    if (measureLayer) measureLayer.clearLayers();
    if (lineLayer) lineLayer.clearLayers();
    if (beaconTrailLayer) beaconTrailLayer.clearLayers();
    if (markerBeacon) { markerBeacon.remove(); markerBeacon = null; }
    if (uncertaintyCircle) { uncertaintyCircle.remove(); uncertaintyCircle = null; }
    clearAreaCircle();
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
      setStatus('Arr\xEAt du scan…', 'warn');
    } else {
      postRN({ type: 'startScan', uuid: cfg.uuid });
      setStatus('D\xE9marrage du scan… (autoriser Bluetooth + GPS si demand\xE9)', 'warn');
      snack('Si une popup permission appara\xEEt, accepte-la');
    }
  };

  window.centerMap = function() {
    if (!mapAvailable) { snack('Carte indisponible'); return; }
    if (myPos) map.setView([myPos.lat, myPos.lng], 19);
    else if (beaconPos) map.setView([beaconPos.lat, beaconPos.lng], 19);
  };

  window.clearMeasures = function() {
    measures = []; rssiHistory = []; beaconPos = null; lastBearing = null;
    beaconHistory = [];
    resetKalman();
    if (gpsF) gpsF.reset(); if (estimator) estimator.reset(); refFrame = null;
    if (measureLayer) measureLayer.clearLayers();
    if (lineLayer) lineLayer.clearLayers();
    if (beaconTrailLayer) beaconTrailLayer.clearLayers();
    if (markerBeacon) { try { markerBeacon.remove(); } catch(e){} markerBeacon = null; }
    if (uncertaintyCircle) { try { uncertaintyCircle.remove(); } catch(e){} uncertaintyCircle = null; }
    clearAreaCircle();
    distDisplay = null;
    document.getElementById('measures-count').textContent = '0';
    document.getElementById('dist-val').textContent = '—';
    document.getElementById('conf-val').textContent = '—';
    document.getElementById('rssi-val').textContent = '— dBm';
    document.getElementById('rssi-fill').style.width = '0%';
    document.getElementById('compass-arrow').style.transform = 'translate(-50%,-50%) rotate(0deg)';
    document.getElementById('hc-arrow').textContent = '—';
    document.getElementById('hc-arrow').style.color = 'var(--neutral)';
    document.getElementById('hc-text').textContent = 'En attente de mesures…';
    document.getElementById('hc-text').style.color = 'var(--neutral)';
    document.getElementById('hc-slope').textContent = '— dBm/s';
    updateDebugBaseline('—','—','—');
    snack('Mesures effac\xE9es');
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

  // Compass ticks
  (function() {
    var ring = document.getElementById('compass-ring');
    for (var i = 0; i < 12; i++) {
      var t = document.createElement('div');
      t.className = 'compass-tick';
      t.style.transform = 'rotate(' + (i*30) + 'deg)';
      ring.appendChild(t);
    }
  })();

  // R\xE9-applique le bearing p\xE9riodiquement pour suivre la rotation du t\xE9l\xE9phone
  // et rafra\xEEchit l'indicateur chaud/froid (sa pente \xE9volue avec le temps).
  setInterval(function() {
    if (lastBearing !== null) setCompassBearing(lastBearing);
    if (scanning) updateHotCold();
  }, 500);

  // ===== Message bridge from RN =====
  function onMessage(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === 'rssi' || msg.type === 'gps' || msg.type === 'heading' || msg.type === 'still') recorder.rec(msg);
      switch (msg.type) {
        case 'rssi':       bumpRx('rssi'); handleRSSI(msg.rssi, msg.name); break;
        case 'gps':        bumpRx('gps'); handleGPS(msg.lat, msg.lng, msg.acc); break;
        case 'heading':    bumpRx('hdg'); deviceHeading = msg.heading; break;
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
                           setStatus(msg.scanning ? 'Scan actif \xB7 en attente du signal de Mia…' : 'Scan arr\xEAt\xE9', msg.scanning ? 'active' : '');
                           applyDebugVisibility();
                           if (msg.scanning) {
                             ['dbg-nat','dbg-natm'].forEach(function(id){var e=document.getElementById(id); if (e) e.textContent='0';});
                             ['dbg-natr','dbg-age','dbg-gpsacc','dbg-bsl','dbg-ang','dbg-rms'].forEach(function(id){var e=document.getElementById(id); if (e) e.textContent='—';});
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
  setStatus('Pr\xEAt \xB7 appuyez sur Scanner', '');
  postRN({ type: 'ready', uuid: cfg.uuid });
  bootStep('ready');
  // Cache la debug-bar de boot apres 8s si tout est OK (les classes 'show'
  // ou 'show-error' la maintiennent visible si l'utilisateur l'a activee ou
  // si une erreur est survenue).
  setTimeout(function() {
    try { document.getElementById('debug-bar').classList.remove('show-boot'); } catch(e){}
  }, 8000);
})();
</script>
</body>
</html>`;
