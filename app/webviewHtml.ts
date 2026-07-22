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
  /* Ecran plein : fond pleine couleur pilote par le palier, lisible a bout de bras. */
  #screen{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:22px 16px;background:#14181f;transition:background-color .6s ease;text-align:center;overflow:hidden;}
  #screen-main{display:flex;flex-direction:column;align-items:center;gap:6px;transition:opacity .4s;}
  #screen.lost #screen-main{opacity:.32;}
  #tier-label{font-size:2.6rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;line-height:1;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.45);}
  #tier-sub{font-family:'Share Tech Mono',monospace;font-size:1rem;color:rgba(255,255,255,.82);}
  #hc-arrow{font-size:5rem;line-height:1;margin-top:2px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.4));}
  #hc-text{font-size:1.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;line-height:1.1;transition:color .3s;color:#e6edf3;}
  #hc-slope{font-family:'Share Tech Mono',monospace;font-size:.8rem;color:rgba(255,255,255,.7);}
  #conn-line{font-family:'Share Tech Mono',monospace;font-size:.9rem;color:rgba(255,255,255,.6);min-height:1.1em;margin-top:8px;font-weight:600;}
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
  <div class="field">
    <label>Seuils des paliers (dBm)</label>
    <input id="cfg-tiers" type="text" value="-55,-65,-75,-85">
    <div class="hint">4 seuils décroissants : BRÛLANT ≥ 1er, TRÈS PROCHE ≥ 2e, PROCHE ≥ 3e, FAIBLE ≥ 4e, TRACE en dessous.</div>
  </div>
  <div class="field">
    <label>Taille de la fenêtre (pas)</label>
    <input id="cfg-window" type="number" value="6" min="2" max="20" step="1">
    <div class="hint">Nombre de pas sur lesquels la tendance chaud/froid est jugée (~0,7 m/pas).</div>
  </div>
  <div class="field">
    <label>Seuil de tendance (dB / fenêtre)</label>
    <input id="cfg-delta" type="number" value="2" min="0.5" max="10" step="0.5">
    <div class="hint">Écart de RSSI sur la fenêtre pour déclarer CHAUD ou FROID. Plus haut = moins sensible.</div>
  </div>
  <div class="field row-field">
    <label>Vibration "chaud/froid"</label>
    <div id="cfg-haptic-switch" class="switch" onclick="toggleHaptic()"></div>
  </div>
  <div class="field row-field">
    <label>Son "compteur Geiger"</label>
    <div id="cfg-sound-switch" class="switch" onclick="toggleSound()"></div>
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
    <div class="dbg-row"><span><span class="dbg-key">still</span> <span id="dbg-still">—</span> &middot; <span class="dbg-key">var</span> <span id="dbg-var">—</span> &middot; <span class="dbg-key">pas</span> <span id="dbg-steps">0</span> &middot; <span class="dbg-key">kf.x</span> <span id="dbg-kfx">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">diag natif</span>: <span id="dbg-natd" class="dbg-hex">—</span></span></div>
  </div>
  <div id="screen">
    <div id="screen-main">
      <div id="tier-label">PRÊT</div>
      <div id="tier-sub"></div>
      <div id="hc-arrow">—</div>
      <div id="hc-text">Appuyez sur Scanner</div>
      <div id="hc-slope"></div>
    </div>
    <div id="conn-line"></div>
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
    stillGate: true,
    sound: false,                       // son "compteur Geiger" (cable en phase 4)
    tiersDbm: [-55, -65, -75, -85],     // seuils des paliers de signal
    windowSteps: 6,                     // fenetre de tendance (en pas)
    enterDelta: 2.0                     // seuil dB/fenetre pour CHAUD/FROID
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
  var CALIB_DURATION_MS = 10000;  // duree de la mesure de calibration
  var DIST_DISPLAY_ALPHA = 0.25;  // EMA pour lisser la distance affichee
  var CONN_SIGNAL_MS = 2000;      // age lecture RSSI : en-deca -> SIGNAL
  var CONN_LOST_MS = 5000;        // au-dela -> PERDU (entre les deux : INSTABLE)

  function postRN(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function applyCfgToForm() {
    document.getElementById('cfg-txpower').value = cfg.txPower;
    document.getElementById('cfg-n').value = cfg.n;
    document.getElementById('cfg-name').value = cfg.name;
    document.getElementById('cfg-tiers').value = cfg.tiersDbm.join(',');
    document.getElementById('cfg-window').value = cfg.windowSteps;
    document.getElementById('cfg-delta').value = cfg.enterDelta;
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
    document.getElementById('cfg-debug-switch').classList.toggle('on', !!cfg.showDebug);
    document.getElementById('cfg-haptic-switch').classList.toggle('on', !!cfg.haptic);
    document.getElementById('cfg-sound-switch').classList.toggle('on', !!cfg.sound);
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

  window.toggleSound = function() {
    cfg.sound = !cfg.sound;
    document.getElementById('cfg-sound-switch').classList.toggle('on', cfg.sound);
    // Geste utilisateur : c'est le moment de creer/reprendre l'AudioContext.
    if (cfg.sound) { initAudio(); playBeep(2); }
  };

  window.openConfig = function() { document.getElementById('config-panel').classList.add('open'); };
  window.closeConfig = function() { document.getElementById('config-panel').classList.remove('open'); };
  window.saveConfig = function() {
    cfg.txPower = parseFloat(document.getElementById('cfg-txpower').value) || -40;
    cfg.n       = parseFloat(document.getElementById('cfg-n').value) || 2.5;
    cfg.name    = (document.getElementById('cfg-name').value || '').trim() || 'Mia';
    cfg.windowSteps = Math.max(2, Math.round(parseFloat(document.getElementById('cfg-window').value) || 6));
    cfg.enterDelta  = Math.max(0.5, parseFloat(document.getElementById('cfg-delta').value) || 2.0);
    var parsed = parseTiers(document.getElementById('cfg-tiers').value);
    if (parsed) cfg.tiersDbm = parsed;
    else snack('Seuils invalides — valeur precedente conservee');
    // showDebug / haptic / sound / stillGate sont deja a jour via leurs toggles
    localStorage.setItem('miatracker_cfg', JSON.stringify(cfg));
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
    // Recree les moteurs avec les nouveaux parametres (tuning a chaud, zero rebuild).
    rebuildEngines();
    document.getElementById('cfg-tiers').value = cfg.tiersDbm.join(',');
    closeConfig();
    snack('Configuration enregistrée');
  };

  // Parse "-55,-65,-75,-85" -> [nombres] si 4 valeurs finies strictement
  // decroissantes, sinon null.
  function parseTiers(str) {
    var parts = (str || '').split(',').map(function(s){ return parseFloat(s.trim()); });
    if (parts.length !== 4) return null;
    for (var i = 0; i < 4; i++) if (!isFinite(parts[i])) return null;
    for (var j = 1; j < 4; j++) if (parts[j] >= parts[j-1]) return null;
    return parts;
  }

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
  var stepCount = 0;          // compteur de pas cumulatif (envoye par RN)
  var lastRssiMs = 0;         // horodatage derniere lecture RSSI (etat de connexion)
  // Moteurs v2 (injectes via algoSource) : tendance indexee sur les pas + paliers.
  // Construits depuis cfg ; recrees a chaud (sans rebuild) par rebuildEngines().
  function buildTiers(a) {
    return [
      { min: a[0],       key: 'burning',   label: 'BRÛLANT' },
      { min: a[1],       key: 'veryClose', label: 'TRÈS PROCHE' },
      { min: a[2],       key: 'close',     label: 'PROCHE' },
      { min: a[3],       key: 'weak',      label: 'FAIBLE' },
      { min: -Infinity,  key: 'trace',     label: 'TRACE' }
    ];
  }
  var trend = null, tiers = null;
  function rebuildEngines() {
    trend = A ? A.createTrendTracker({ windowSteps: cfg.windowSteps, enterDelta: cfg.enterDelta }) : null;
    tiers = A ? A.createSignalTiers({ tiers: buildTiers(cfg.tiersDbm) }) : null;
  }
  rebuildEngines();
  var lastTier = null;
  var lastV = null;           // dernier verdict de tendance (pour re-render periodique)

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

  // Calibration state
  var calib = null; // { phase, startMs, samples, timer }

  // Distance indicative (EMA) : maintient la valeur lissee. L'affichage est
  // rendu par renderVerdict (couple au palier de signal courant).
  var distDisplay = null;
  function updateDistDisplay(rawDist) {
    if (distDisplay == null) distDisplay = rawDist;
    else distDisplay = DIST_DISPLAY_ALPHA * rawDist + (1 - DIST_DISPLAY_ALPHA) * distDisplay;
    return distDisplay;
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

  // ===== Ecran : palier (fond couleur) + etat de connexion =====
  // Fond pleine couleur pilote par le palier de signal (bleu nuit -> rouge
  // brulant). Les couleurs sont sombres pour rester lisibles avec du texte clair.
  var TIER_BG = {
    burning:   '#8f1524',
    veryClose: '#7a3410',
    close:     '#5c4d12',
    weak:      '#13405e',
    trace:     '#0d1b30'
  };
  var NEUTRAL_BG = '#14181f';
  function setBg(c) { document.getElementById('screen').style.backgroundColor = c; }

  // Etat de connexion par age de la derniere lecture RSSI.
  function connState() {
    if (!scanning || lastRssiMs === 0) return 'none';
    var age = Date.now() - lastRssiMs;
    if (age < CONN_SIGNAL_MS) return 'signal';
    if (age < CONN_LOST_MS) return 'unstable';
    return 'lost';
  }

  // Label geant du palier + distance indicative + fond couleur.
  function renderTier() {
    var lab = document.getElementById('tier-label');
    var sub = document.getElementById('tier-sub');
    if (!scanning) { lab.textContent = 'PRÊT'; sub.textContent = ''; setBg(NEUTRAL_BG); return; }
    if (connState() === 'lost') return; // renderConn pilote l'ecran quand PERDU
    lab.textContent = lastTier ? lastTier.label : '—';
    var d = distDisplay;
    sub.textContent = (d == null) ? '' : (d < 1000 ? '~ ' + d.toFixed(1) + ' m' : '~ >1 km');
    setBg(lastTier ? (TIER_BG[lastTier.key] || NEUTRAL_BG) : NEUTRAL_BG);
  }

  // Ligne de connexion : discrete si SIGNAL, avertit si INSTABLE, prend le
  // dessus (avec "dernier contact il y a Xs") si PERDU.
  function renderConn() {
    var el = document.getElementById('conn-line');
    var screen = document.getElementById('screen');
    var st = connState();
    if (st === 'lost') {
      var age = Math.round((Date.now() - lastRssiMs) / 1000);
      // Le dernier palier reste affiche mais estompe (via .lost) ; le message de
      // perte prend le dessus, pleine opacite, en rouge.
      el.textContent = '\u{26A0} Signal perdu \xB7 dernier contact il y a ' + age + ' s';
      el.style.color = 'var(--danger)';
      screen.classList.add('lost');
      setBg(NEUTRAL_BG);
    } else {
      screen.classList.remove('lost');
      if (st === 'unstable') { el.textContent = 'signal instable…'; el.style.color = 'var(--warn)'; }
      else { el.textContent = ''; }
    }
  }

  // ===== Verdict chaud / froid (moteur v2 : tendance indexee sur les pas) =====
  // Le RSSI immobile etant du bruit, aucun verdict directionnel n'est emis tant
  // qu'on n'a pas marche assez ("Avance pour chercher"), et un gros saut sans pas
  // affiche "Mia bouge ?" au lieu d'une fausse direction. Texte clair (lisible sur
  // le fond couleur du palier) ; la couleur chaud/froid passe par la fleche emoji.
  function renderVerdict(v) {
    var arrow = document.getElementById('hc-arrow');
    var text  = document.getElementById('hc-text');
    var slope = document.getElementById('hc-slope');
    if (!v) {
      arrow.textContent = scanning ? '\u{1F50D}' : '—';
      text.textContent = scanning ? 'En attente du signal…' : 'Appuyez sur Scanner';
      text.style.color = '#e6edf3';
      slope.textContent = '';
      return;
    }
    var verdict = v.verdict;
    if (verdict === 'hot') {
      arrow.textContent = '\u{1F525}';
      text.textContent = 'Tu chauffes'; text.style.color = '#ffd5d5';
      slope.textContent = 'Δ ' + (v.delta >= 0 ? '+' : '') + v.delta.toFixed(1) + ' dB \xB7 ' + v.steps + ' pas';
    } else if (verdict === 'cold') {
      arrow.textContent = '\u{2744}';
      text.textContent = 'Tu refroidis'; text.style.color = '#cfe4ff';
      slope.textContent = 'Δ ' + v.delta.toFixed(1) + ' dB \xB7 ' + v.steps + ' pas';
    } else if (verdict === 'unstable') {
      arrow.textContent = '\u{26A0}';
      text.textContent = 'Mia bouge ?'; text.style.color = '#ffe4b0';
      slope.textContent = 'signal instable';
    } else if (verdict === 'searching') {
      arrow.textContent = '\u{1F6B6}';
      text.textContent = 'Avance pour chercher'; text.style.color = '#ffe4b0';
      slope.textContent = v.steps + ' pas \xB7 avance…';
    } else { // stable
      arrow.textContent = '≈';
      text.textContent = 'Stable'; text.style.color = '#e6edf3';
      slope.textContent = 'Δ ' + (v.delta >= 0 ? '+' : '') + v.delta.toFixed(1) + ' dB \xB7 ' + v.steps + ' pas';
    }
  }

  // ===== Feedback "compteur Geiger" : haptique + son (phase 4) =====
  // La cadence des ticks est proportionnelle a l'INTENSITE DU PALIER (proximite) :
  // plus on est proche, plus ca claque vite. Un burst distinct marque le passage
  // a un palier superieur. Le son (WebAudio) suit exactement la meme cadence que
  // l'haptique ; il est OFF par defaut et n'emet aucun son sans AudioContext
  // (initialise dans un geste utilisateur : bouton Scanner ou toggle Son).

  // Intervalle entre 2 ticks selon l'index de palier (0 = BRULANT ... 4 = TRACE).
  var TIER_TICK_MS = [260, 480, 900, 1600, 2800];
  var feedbackTimer = null;
  var lastTierIndex = null; // pour detecter le passage a un palier superieur

  function tierIntensity(idx) {
    if (idx <= 1) return 3; // BRULANT / TRES PROCHE
    if (idx === 2) return 2; // PROCHE
    return 1;                // FAIBLE / TRACE
  }

  // ---- WebAudio : bip court facon clic Geiger (zero dependance) ----
  var audioCtx = null;
  function initAudio() {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  function playBeep(intensity) {
    if (!audioCtx) return;
    try {
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = intensity >= 3 ? 1400 : intensity === 2 ? 1000 : 720; // plus proche = plus aigu
      o.connect(g); g.connect(audioCtx.destination);
      var t = audioCtx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.start(t); o.stop(t + 0.06);
    } catch (e) {}
  }

  function emitTick(idx) {
    if (cfg.haptic) postRN({ type: 'haptic', intensity: tierIntensity(idx) });
    if (cfg.sound) playBeep(tierIntensity(idx));
  }
  // Burst au passage a un palier plus fort : vibration soutenue + double clic.
  function emitBurst() {
    if (cfg.haptic) postRN({ type: 'haptic', intensity: 3 });
    if (cfg.sound) { playBeep(3); setTimeout(function(){ playBeep(3); }, 70); }
  }

  // Boucle auto-planifiee : un tick a chaque intervalle propre au palier courant.
  // Ne tique pas hors scan, sans palier, ou signal perdu.
  function scheduleFeedback() {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    var interval = 700;
    var st = connState();
    if (scanning && lastTier && st !== 'lost' && st !== 'none') {
      var idx = (lastTier.index != null) ? lastTier.index : 4;
      interval = TIER_TICK_MS[idx] != null ? TIER_TICK_MS[idx] : 2800;
      emitTick(idx);
    }
    feedbackTimer = setTimeout(scheduleFeedback, interval);
  }

  // ===== Handle measurements coming from RN =====
  function handleRSSI(rssi, name) {
    var now = Date.now();
    lastRssiMs = now; // contact etabli (etat de connexion)

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

    // Distance indicative (EMA) + palier de signal
    updateDistDisplay(rssiToDistance(smoothed));
    if (tiers) {
      lastTier = tiers.push(smoothed);
      // burst au passage a un palier plus fort (index qui diminue = plus proche)
      if (lastTierIndex != null && lastTier.index < lastTierIndex) emitBurst();
      lastTierIndex = lastTier.index;
    }

    // Verdict de tendance : moteur v2 indexe sur les pas (fige a l'immobilite,
    // detecte "Mia bouge", ne juge que si on a marche assez).
    lastV = trend ? trend.push(smoothed, stepCount, now, isStill) : null;
    renderConn();
    renderTier();
    renderVerdict(lastV);

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
      // Geste utilisateur : cree/reprend l'AudioContext maintenant, pour que le
      // son "Geiger" puisse demarrer meme si on l'active plus tard pendant le scan.
      initAudio();
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

  // Re-render periodique : maintient la cadence haptique quand on reste CHAUD,
  // fait evoluer l'etat de connexion ("dernier contact il y a Xs") et rafraichit
  // l'ecran tant qu'aucun signal n'arrive.
  setInterval(function() {
    if (!scanning) return;
    renderConn();
    renderTier();
    renderVerdict(lastV);
  }, 500);

  // Boucle de feedback "Geiger" (haptique + son) : auto-planifiee, cadence pilotee
  // par le palier courant. Se gate elle-meme hors scan / signal perdu.
  scheduleFeedback();

  // ===== Message bridge from RN =====
  function onMessage(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === 'rssi' || msg.type === 'still' || msg.type === 'step') recorder.rec(msg);
      switch (msg.type) {
        case 'rssi':       bumpRx('rssi'); handleRSSI(msg.rssi, msg.name); break;
        case 'step':       stepCount = (typeof msg.count === 'number') ? msg.count : stepCount + 1;
                           var stEl = document.getElementById('dbg-steps'); if (stEl) stEl.textContent = stepCount;
                           break;
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
                             stepCount = 0; lastTier = null; lastV = null; distDisplay = null; lastRssiMs = 0; lastTierIndex = null;
                             if (trend) trend.reset(); if (tiers) tiers.reset(); resetKalman();
                             var stEl2 = document.getElementById('dbg-steps'); if (stEl2) stEl2.textContent = '0';
                             ['dbg-nat','dbg-natm'].forEach(function(id){var e=document.getElementById(id); if (e) e.textContent='0';});
                             ['dbg-natr','dbg-age'].forEach(function(id){var e=document.getElementById(id); if (e) e.textContent='—';});
                           } else {
                             isStill = false; stillSinceMs = 0; lastRssiMs = 0;
                           }
                           renderConn();
                           renderTier();
                           renderVerdict(scanning ? lastV : null);
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
