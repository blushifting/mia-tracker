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
  #info-col{flex:1;display:flex;flex-direction:column;gap:4px;}
  .info-row{display:flex;justify-content:space-between;align-items:baseline;}
  .info-lbl{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
  .info-val{font-family:'Share Tech Mono',monospace;font-size:.95rem;}
  #dist-val{color:var(--beacon);font-size:1.1rem;font-weight:600;}
  #measures-count{font-size:.7rem;color:var(--muted);font-family:'Share Tech Mono',monospace;}
  #controls{display:flex;gap:8px;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  .btn{flex:1;padding:11px 8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:'Oxanium',sans-serif;font-size:.82rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--radius);cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
  .btn:active{background:var(--border);}
  .btn.primary{background:rgba(57,211,83,.12);border-color:var(--accent);color:var(--accent);}
  .btn.primary:active{background:rgba(57,211,83,.25);}
  .btn.danger{background:rgba(248,81,73,.1);border-color:var(--danger);color:var(--danger);}
  .btn.warn{background:rgba(240,180,41,.1);border-color:var(--warn);color:var(--warn);}
  #config-panel{position:fixed;inset:0;background:rgba(13,17,23,.96);z-index:1000;display:none;flex-direction:column;padding:24px 20px;gap:18px;overflow-y:auto;}
  #config-panel.open{display:flex;}
  #config-panel h2{font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);}
  .field{display:flex;flex-direction:column;gap:6px;}
  .field label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);}
  .field input{background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:'Share Tech Mono',monospace;font-size:.88rem;padding:10px 12px;border-radius:var(--radius);outline:none;width:100%;}
  .field input:focus{border-color:var(--accent);}
  .field .hint{font-size:.7rem;color:var(--muted);line-height:1.4;}
  .config-actions{display:flex;gap:8px;margin-top:4px;}
  #snack{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--border);padding:10px 18px;border-radius:20px;font-size:.8rem;color:var(--text);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;white-space:nowrap;z-index:999;}
  #snack.show{opacity:1;transform:translateX(-50%) translateY(0);}
  #debug-bar{display:none;padding:6px 12px;background:#1a1f29;border-bottom:1px solid var(--border);font-family:'Share Tech Mono',monospace;font-size:.65rem;color:var(--muted);line-height:1.45;flex-shrink:0;}
  #debug-bar.show{display:block;}
  #debug-bar .dbg-row{display:flex;justify-content:space-between;gap:8px;}
  #debug-bar .dbg-key{color:var(--accent);}
  #debug-bar .dbg-hex{color:var(--beacon);word-break:break-all;font-size:.6rem;}
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
    <label>Lissage RSSI (fen\xEAtre)</label>
    <input id="cfg-smooth" type="number" value="5" min="1" max="20">
    <div class="hint">Nombre de mesures \xE0 moyenner.</div>
  </div>
  <div class="field">
    <label>Nom affich\xE9 du beacon</label>
    <input id="cfg-name" type="text" value="Mia">
  </div>
  <div class="config-actions">
    <button class="btn primary" onclick="saveConfig()">✓ Enregistrer</button>
    <button class="btn" onclick="closeConfig()">Annuler</button>
  </div>
</div>

<div id="app">
  <div id="header">
    <div id="status-dot"></div>
    <div id="status-text">D\xE9marrage…</div>
    <h1 id="header-title">\u{1F431} Mia</h1>
  </div>
  <div id="debug-bar">
    <div class="dbg-row"><span><span class="dbg-key">devices</span> <span id="dbg-total">0</span></span><span><span class="dbg-key">apple</span> <span id="dbg-apple">0</span></span><span><span class="dbg-key">iBeacon</span> <span id="dbg-ib">0</span></span><span><span class="dbg-key">match</span> <span id="dbg-match">0</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">apple sub-types</span>: <span id="dbg-sub">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">sous-type 0x02 (iBeacon)</span>: <span id="dbg-s02">0</span> packets</span></div>
    <div class="dbg-row"><span><span class="dbg-key">premier hex 0x02</span>: <span id="dbg-s02h" class="dbg-hex">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">beacon MAC vu</span>: <span id="dbg-bvu">0</span> fois &middot; RSSI <span id="dbg-brssi">—</span> dBm &middot; <span id="dbg-bname">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">md (<span id="dbg-bmdlen">0</span>o)</span>: <span id="dbg-bmd" class="dbg-hex">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">raw scan</span>: <span id="dbg-braw" class="dbg-hex">—</span></span></div>
    <div class="dbg-row"><span><span class="dbg-key">srv data</span>: <span id="dbg-bsd" class="dbg-hex">—</span></span></div>
  </div>
  <div id="map"></div>
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
      <div class="info-row"><span class="info-lbl">Mesures</span><span id="measures-count">0 mesures</span></div>
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

<script>
(function(){
  // ===== Config =====
  var cfg = {
    uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
    txPower: -40, n: 2.5, smooth: 5, name: 'Mia'
  };
  try {
    var saved = localStorage.getItem('miatracker_cfg');
    if (saved) cfg = Object.assign(cfg, JSON.parse(saved));
  } catch(e) {}

  function postRN(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function applyCfgToForm() {
    document.getElementById('cfg-uuid').value = cfg.uuid;
    document.getElementById('cfg-txpower').value = cfg.txPower;
    document.getElementById('cfg-n').value = cfg.n;
    document.getElementById('cfg-smooth').value = cfg.smooth;
    document.getElementById('cfg-name').value = cfg.name;
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
  }

  window.openConfig = function() { document.getElementById('config-panel').classList.add('open'); };
  window.closeConfig = function() { document.getElementById('config-panel').classList.remove('open'); };
  window.saveConfig = function() {
    cfg.uuid    = (document.getElementById('cfg-uuid').value || '').trim().toUpperCase();
    cfg.txPower = parseFloat(document.getElementById('cfg-txpower').value) || -40;
    cfg.n       = parseFloat(document.getElementById('cfg-n').value) || 2.5;
    cfg.smooth  = parseInt(document.getElementById('cfg-smooth').value) || 5;
    cfg.name    = (document.getElementById('cfg-name').value || '').trim() || 'Mia';
    localStorage.setItem('miatracker_cfg', JSON.stringify(cfg));
    document.getElementById('header-title').textContent = '\u{1F431} ' + cfg.name;
    postRN({ type: 'config', uuid: cfg.uuid });
    closeConfig();
    snack('Configuration enregistr\xE9e');
  };

  // ===== Map =====
  var map = L.map('map', { zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, subdomains: 'abcd' }).addTo(map);
  L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution('\xA9 OpenStreetMap \xB7 CartoDB').addTo(map);
  map.setView([48.85, 2.35], 18);

  var markerMe = null, markerBeacon = null;
  var measureLayer = L.layerGroup().addTo(map);
  var lineLayer = L.layerGroup().addTo(map);

  function makeIcon(cls) {
    return L.divIcon({ className:'', html: '<div class="'+cls+'"></div>', iconSize:[14,14], iconAnchor:[7,7] });
  }

  // ===== State =====
  var scanning = false;
  var myPos = null;
  var measures = [];
  var rssiWindow = [];
  var beaconPos = null;
  var lastBearing = null;
  var deviceHeading = 0;
  var mapAutoCentered = false;

  // ===== Distance / triangulation =====
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

  function deduplicate(pts, minDist) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], merged = false;
      for (var j = 0; j < out.length; j++) {
        if (getDistance(p.lat, p.lng, out[j].lat, out[j].lng) < minDist) {
          if (p.rssi > out[j].rssi) {
            out[j].lat = p.lat; out[j].lng = p.lng; out[j].rssi = p.rssi; out[j].dist = p.dist;
          }
          merged = true; break;
        }
      }
      if (!merged) out.push({ lat:p.lat, lng:p.lng, rssi:p.rssi, dist:p.dist });
    }
    return out;
  }

  function trilaterate(pts) {
    var lat = 0, lng = 0;
    for (var i = 0; i < pts.length; i++) { lat += pts[i].lat; lng += pts[i].lng; }
    lat /= pts.length; lng /= pts.length;
    var R = 6371000;
    for (var it = 0; it < 50; it++) {
      var gLat = 0, gLng = 0, step = 0;
      for (var k = 0; k < pts.length; k++) {
        var p = pts[k];
        var d = getDistance(lat, lng, p.lat, p.lng);
        if (d < 0.001) continue;
        var err = d - p.dist;
        var dLat = (lat - p.lat) * R * Math.PI / 180;
        var dLng = (lng - p.lng) * R * Math.cos(lat * Math.PI/180) * Math.PI / 180;
        gLat += err * dLat / d;
        gLng += err * dLng / d;
        step += Math.abs(err);
      }
      var lr = 0.0001 / pts.length;
      lat -= gLat * lr;
      lng -= gLng * lr;
      if (step / pts.length < 0.05) break;
    }
    var check = 0;
    for (var m = 0; m < pts.length; m++) check += getDistance(lat, lng, pts[m].lat, pts[m].lng);
    if (check / pts.length > 500) return null;
    return { lat: lat, lng: lng };
  }

  function estimateBeaconPosition() {
    if (measures.length < 1) return;
    var now = Date.now();
    var recent = measures.filter(function(m){ return now - m.t < 30000; });
    if (recent.length < 1) return;
    var unique = deduplicate(recent, 0.5);
    if (unique.length === 1) {
      placeBeaconMarker(unique[0].lat, unique[0].lng, unique[0].dist, 10, 'point unique');
      return;
    }
    var wLat = 0, wLng = 0, wSum = 0;
    for (var i = 0; i < unique.length; i++) {
      var w = 1 / (unique[i].dist * unique[i].dist + 0.01);
      wLat += unique[i].lat * w; wLng += unique[i].lng * w; wSum += w;
    }
    var finalPos = { lat: wLat/wSum, lng: wLng/wSum };
    if (unique.length >= 3) {
      var nls = trilaterate(unique);
      if (nls) finalPos = nls;
    }
    var conf = Math.min(100, unique.length * 12 + (unique.length >= 3 ? 20 : 0));
    placeBeaconMarker(finalPos.lat, finalPos.lng, null, conf, unique.length >= 3 ? 'trilat\xE9ration' : 'centro\xEFde');
    if (myPos) {
      var bearing = getBearing(myPos.lat, myPos.lng, finalPos.lat, finalPos.lng);
      setCompassBearing(bearing);
      var d = getDistance(myPos.lat, myPos.lng, finalPos.lat, finalPos.lng);
      document.getElementById('dist-val').textContent = d < 1000 ? d.toFixed(1) + ' m' : (d/1000).toFixed(2) + ' km';
      var confLabel = conf > 70 ? '\u{1F7E2} \xE9lev\xE9e' : conf > 40 ? '\u{1F7E1} moyenne' : '\u{1F534} faible';
      document.getElementById('conf-val').textContent = confLabel;
    }
  }

  function placeBeaconMarker(lat, lng, radius, conf, method) {
    beaconPos = { lat: lat, lng: lng };
    lineLayer.clearLayers();
    if (!markerBeacon) {
      markerBeacon = L.marker([lat, lng], { icon: makeIcon('marker-beacon') })
        .bindTooltip(cfg.name, { permanent: true, direction: 'top', offset: [0,-8] }).addTo(map);
    } else {
      markerBeacon.setLatLng([lat, lng]);
    }
    if (radius && radius < 200) {
      L.circle([lat, lng], { radius: radius, color: '#58a6ff', fill: true, fillColor: '#58a6ff', fillOpacity: 0.08, weight: 1, dashArray: '4,4' }).addTo(lineLayer);
    }
    if (myPos) {
      L.polyline([[myPos.lat, myPos.lng],[lat, lng]], { color: '#58a6ff', weight: 1.5, opacity: 0.5, dashArray: '6,4' }).addTo(lineLayer);
    }
    document.getElementById('measures-count').textContent = measures.length + ' mesures \xB7 ' + method;
  }

  function addMeasureMarker(lat, lng, rssi, dist) {
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

  // ===== Handle measurements coming from RN =====
  function handleRSSI(rssi, name) {
    rssiWindow.push(rssi);
    if (rssiWindow.length > cfg.smooth) rssiWindow.shift();
    var smoothed = rssiWindow.reduce(function(a,b){return a+b;}, 0) / rssiWindow.length;
    updateRSSIBar(smoothed);
    setStatus('Beacon: ' + (name || cfg.name) + ' \xB7 RSSI ' + smoothed.toFixed(1) + ' dBm', 'active');
    var dist = rssiToDistance(smoothed);
    document.getElementById('dist-val').textContent = dist < 1000 ? dist.toFixed(1) + ' m' : '>1 km';
    if (myPos) {
      measures.push({ lat: myPos.lat, lng: myPos.lng, rssi: smoothed, dist: dist, t: Date.now() });
      addMeasureMarker(myPos.lat, myPos.lng, smoothed, dist);
      estimateBeaconPosition();
      document.getElementById('measures-count').textContent = measures.length + ' mesures';
    }
  }

  function handleGPS(lat, lng) {
    myPos = { lat: lat, lng: lng };
    if (!markerMe) {
      markerMe = L.marker([lat, lng], { icon: makeIcon('marker-me') })
        .bindTooltip('Vous', { permanent: false }).addTo(map);
    } else {
      markerMe.setLatLng([lat, lng]);
    }
    if (!mapAutoCentered) {
      map.setView([lat, lng], 19);
      mapAutoCentered = true;
    }
  }

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
    if (myPos) map.setView([myPos.lat, myPos.lng], 19);
    else if (beaconPos) map.setView([beaconPos.lat, beaconPos.lng], 19);
  };

  window.clearMeasures = function() {
    measures = []; rssiWindow = []; beaconPos = null; lastBearing = null;
    measureLayer.clearLayers(); lineLayer.clearLayers();
    if (markerBeacon) { markerBeacon.remove(); markerBeacon = null; }
    document.getElementById('measures-count').textContent = '0 mesures';
    document.getElementById('dist-val').textContent = '—';
    document.getElementById('conf-val').textContent = '—';
    document.getElementById('rssi-val').textContent = '— dBm';
    document.getElementById('rssi-fill').style.width = '0%';
    document.getElementById('compass-arrow').style.transform = 'translate(-50%,-50%) rotate(0deg)';
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

  setInterval(function() {
    if (lastBearing !== null) setCompassBearing(lastBearing);
  }, 500);

  // ===== Message bridge from RN =====
  function onMessage(raw) {
    try {
      var msg = JSON.parse(raw);
      switch (msg.type) {
        case 'rssi':       handleRSSI(msg.rssi, msg.name); break;
        case 'gps':        handleGPS(msg.lat, msg.lng); break;
        case 'heading':    deviceHeading = msg.heading; break;
        case 'scanState':  scanning = msg.scanning; updateScanBtn();
                           setStatus(msg.scanning ? 'Scan actif \xB7 en attente du signal de Mia…' : 'Scan arr\xEAt\xE9', msg.scanning ? 'active' : '');
                           document.getElementById('debug-bar').classList.toggle('show', !!msg.scanning);
                           if (msg.scanning) { ['dbg-total','dbg-apple','dbg-ib','dbg-match'].forEach(function(id){document.getElementById(id).textContent='0';}); document.getElementById('dbg-uuid').textContent='—'; document.getElementById('dbg-hex').textContent='—'; }
                           break;
        case 'debug':      document.getElementById('dbg-total').textContent = msg.total;
                           document.getElementById('dbg-apple').textContent = msg.apple;
                           document.getElementById('dbg-ib').textContent = msg.iBeacon;
                           document.getElementById('dbg-match').textContent = msg.matched;
                           document.getElementById('dbg-sub').textContent = msg.appleSubtypes || '—';
                           document.getElementById('dbg-s02').textContent = msg.sub02Seen || 0;
                           if (msg.sub02Hex) document.getElementById('dbg-s02h').textContent = msg.sub02Hex;
                           document.getElementById('dbg-bvu').textContent = msg.beaconSeen || 0;
                           document.getElementById('dbg-brssi').textContent = msg.beaconRssi || '—';
                           document.getElementById('dbg-bname').textContent = msg.beaconName || '—';
                           document.getElementById('dbg-bmdlen').textContent = msg.beaconMdLen || 0;
                           document.getElementById('dbg-bmd').textContent = msg.beaconMd || '—';
                           document.getElementById('dbg-braw').textContent = msg.beaconRaw || '—';
                           document.getElementById('dbg-bsd').textContent = msg.beaconServiceData || '—';
                           break;
        case 'status':     setStatus(msg.msg, msg.state || ''); break;
        case 'error':      setStatus(msg.msg, 'error'); snack(msg.msg); break;
        case 'snack':      snack(msg.msg); break;
      }
    } catch(e) {}
  }
  document.addEventListener('message', function(e){ onMessage(e.data); });
  window.addEventListener('message', function(e){ onMessage(e.data); });

  applyCfgToForm();
  setStatus('Pr\xEAt \xB7 appuyez sur Scanner', '');
  postRN({ type: 'ready', uuid: cfg.uuid });
})();
</script>
</body>
</html>`;
