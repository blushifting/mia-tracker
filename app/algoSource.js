// algoSource.js
// Source unique des fonctions PURES de localisation Mia Tracker.
// Ce fichier exporte une STRING de JavaScript qui, une fois executee
// (injectee dans la WebView OU evaluee en Node via new Function), enregistre
// globalThis.MiaAlgo = { ... }.
//
// Contraintes d'authoring (IMPORTANT) : le code a l'interieur de la string
// ne doit contenir NI backtick NI la sequence dollar-accolade, car cette
// string est elle-meme une template literal et sera re-interpolee dans la
// template literal de webviewHtml.ts. On reste donc en ASCII simple, quotes
// classiques uniquement.

export const algoSource = String.raw`
(function () {
  var root = (typeof window !== 'undefined') ? window
           : (typeof globalThis !== 'undefined') ? globalThis
           : this;

  // ---------- utilitaires numeriques ----------
  function hypot(dx, dy) { return Math.sqrt(dx * dx + dy * dy); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  var _spare = null;
  function gauss() {
    // Box-Muller avec cache
    if (_spare !== null) { var s = _spare; _spare = null; return s; }
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    var mag = Math.sqrt(-2.0 * Math.log(u));
    _spare = mag * Math.sin(2.0 * Math.PI * v);
    return mag * Math.cos(2.0 * Math.PI * v);
  }

  function median(arr) {
    if (arr.length === 0) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // ---------- geo ----------
  var R_EARTH = 6371000;
  function haversine(lat1, lng1, lat2, lng2) {
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function bearing(lat1, lng1, lat2, lng2) {
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  // Cadre metrique local (ENU plat) ancre sur un point de reference.
  function makeRef(lat, lng) {
    return {
      lat0: lat, lng0: lng,
      mPerLat: 111320,
      mPerLng: 111320 * Math.cos(lat * Math.PI / 180)
    };
  }
  function toLocal(ref, lat, lng) {
    return { x: (lng - ref.lng0) * ref.mPerLng, y: (lat - ref.lat0) * ref.mPerLat };
  }
  function toLatLng(ref, x, y) {
    return { lat: ref.lat0 + y / ref.mPerLat, lng: ref.lng0 + x / ref.mPerLng };
  }

  // ---------- modele log-distance ----------
  function rssiToDistance(rssi, txPower, n) {
    var d = Math.pow(10, (txPower - rssi) / (10 * n));
    return clamp(d, 0.1, 100000);
  }
  // sigma sur la distance derive du sigma sur le rssi (propagation d'erreur)
  function distanceSigma(dist, sigmaRssi, n) {
    var k = Math.LN10 / (10 * n); // |d(d)/d(rssi)| = k*d
    return Math.max(0.5, k * dist * sigmaRssi);
  }

  // ---------- filtre RSSI : pre-filtre median + Kalman 1D ----------
  function createRssiFilter(opts) {
    opts = opts || {};
    var medWin = opts.medWin != null ? opts.medWin : 3;
    var Q = opts.Q != null ? opts.Q : 0.10;       // bruit de process (dBm^2 / pas)
    var R = opts.R != null ? opts.R : 6.0;         // bruit de mesure (dBm^2)
    var outlierK = opts.outlierK != null ? opts.outlierK : 3.0;
    var medBuf = [];
    var x = null, P = 1.0;
    return {
      push: function (rssi) {
        medBuf.push(rssi);
        if (medBuf.length > medWin) medBuf.shift();
        var z = median(medBuf);
        if (x === null) { x = z; P = R; return { value: x, variance: P, raw: rssi, n: medBuf.length }; }
        // predict
        P = P + Q;
        // rejet d'outlier : on gonfle R si l'ecart est trop grand
        var innov = z - x;
        var s = P + R;
        var rEff = R;
        if (Math.abs(innov) > outlierK * Math.sqrt(s)) rEff = R * 8;
        var K = P / (P + rEff);
        x = x + K * innov;
        P = (1 - K) * P;
        return { value: x, variance: P, raw: rssi, n: medBuf.length };
      },
      get: function () { return x; },
      reset: function () { medBuf = []; x = null; P = 1.0; }
    };
  }

  // ---------- filtre GPS : Kalman 2D vitesse constante ----------
  // Etat [x, y, vx, vy] en metres / m.s-1 dans le cadre local.
  function createGpsFilter(opts) {
    opts = opts || {};
    var sigmaA = opts.sigmaA != null ? opts.sigmaA : 0.12;  // bruit d'acceleration (m/s^2)
    var maxAcc = opts.maxAccuracy != null ? opts.maxAccuracy : 25; // gating (m)
    var minAcc = opts.minAccuracy != null ? opts.minAccuracy : 3;  // plancher mesure (m)
    var speedThresh = opts.speedThresh != null ? opts.speedThresh : 0.5; // m/s
    var zupt = opts.zupt != null ? opts.zupt : 0.5;   // facteur d'amortissement vitesse a l'arret
    var ref = null;
    var X = null;                 // [x,y,vx,vy]
    var P = null;                 // covariance 4x4 (array de 16)
    var lastT = null;
    var speedLP = 0;              // vitesse lissee (m/s)

    function idx(r, c) { return r * 4 + c; }

    // Etape de prediction du Kalman CV, avec acceleration optionnelle
    // (aE,aN en m/s^2, repere monde est/nord) comme entree de commande.
    // aE=aN=0 -> modele vitesse-constante classique (comportement historique).
    function predictStep(dt, aE, aN) {
      aE = aE || 0; aN = aN || 0;
      // X = F X + B u
      X[0] += X[2] * dt + 0.5 * aE * dt * dt;
      X[1] += X[3] * dt + 0.5 * aN * dt * dt;
      X[2] += aE * dt;
      X[3] += aN * dt;
      // P = F P F^T + Q  (F = [[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]])
      function rowF(P) {
        var O = P.slice();
        for (var c = 0; c < 4; c++) {
          O[idx(0,c)] = P[idx(0,c)] + dt * P[idx(2,c)];
          O[idx(1,c)] = P[idx(1,c)] + dt * P[idx(3,c)];
        }
        return O;
      }
      function colF(P) {
        var O = P.slice();
        for (var r = 0; r < 4; r++) {
          O[idx(r,0)] = P[idx(r,0)] + dt * P[idx(r,2)];
          O[idx(r,1)] = P[idx(r,1)] + dt * P[idx(r,3)];
        }
        return O;
      }
      var Pn = colF(rowF(P));
      // Q (modele acceleration aleatoire) : bruit de process meme avec commande
      var dt2 = dt * dt, dt3 = dt2 * dt, dt4 = dt2 * dt2;
      var qa = sigmaA * sigmaA;
      var q00 = dt4 / 4 * qa, q02 = dt3 / 2 * qa, q22 = dt2 * qa;
      Pn[idx(0,0)] += q00; Pn[idx(0,2)] += q02; Pn[idx(2,0)] += q02; Pn[idx(2,2)] += q22;
      Pn[idx(1,1)] += q00; Pn[idx(1,3)] += q02; Pn[idx(3,1)] += q02; Pn[idx(3,3)] += q22;
      P = Pn;
    }

    return {
      push: function (lat, lng, accuracy, t) {
        if (accuracy == null || !isFinite(accuracy)) accuracy = maxAcc;
        if (accuracy > maxAcc) {
          // fix trop imprecis : on ignore mais on renvoie l'etat courant
          if (X) { var cur = toLatLng(ref, X[0], X[1]); return { lat: cur.lat, lng: cur.lng, accuracy: Math.sqrt(P[idx(0,0)]), moving: false, speed: 0, used: false }; }
          return null;
        }
        if (!ref) ref = makeRef(lat, lng);
        var p = toLocal(ref, lat, lng);
        var accVar = Math.max(accuracy, minAcc); accVar = accVar * accVar;

        if (X === null) {
          X = [p.x, p.y, 0, 0];
          P = [accVar,0,0,0, 0,accVar,0,0, 0,0,4,0, 0,0,0,4];
          lastT = t;
          return { lat: lat, lng: lng, accuracy: accuracy, moving: false, speed: 0, used: true };
        }

        var dt = (t != null && lastT != null) ? (t - lastT) / 1000 : 1.0;
        dt = clamp(dt, 0.05, 5.0);
        lastT = t;

        // --- predict (vitesse constante : pas de commande inertielle ici) ---
        predictStep(dt, 0, 0);

        // --- update (mesure position x,y) ---
        // innovation
        var yx = p.x - X[0];
        var yy = p.y - X[1];
        // S = H P H^T + Rm  (H prend x,y) -> bloc 2x2
        var Sxx = P[idx(0,0)] + accVar, Sxy = P[idx(0,1)], Syy = P[idx(1,1)] + accVar;
        var det = Sxx * Syy - Sxy * Sxy;
        if (Math.abs(det) < 1e-9) det = 1e-9;
        var iSxx = Syy / det, iSxy = -Sxy / det, iSyy = Sxx / det;
        // K = P H^T S^-1  (4x2)
        var K = [];
        for (var r = 0; r < 4; r++) {
          var p0 = P[idx(r,0)], p1 = P[idx(r,1)];
          K[r * 2 + 0] = p0 * iSxx + p1 * iSxy;
          K[r * 2 + 1] = p0 * iSxy + p1 * iSyy;
        }
        // X = X + K y
        for (var r2 = 0; r2 < 4; r2++) X[r2] += K[r2 * 2 + 0] * yx + K[r2 * 2 + 1] * yy;
        // P = (I - K H) P
        var KH = new Array(16);
        for (var rr = 0; rr < 4; rr++) {
          for (var cc = 0; cc < 4; cc++) {
            // (K H)[rr,cc] = K[rr,0]*H[0,cc] + K[rr,1]*H[1,cc]; H[0]=e_x,H[1]=e_y
            var v = 0;
            if (cc === 0) v = K[rr * 2 + 0];
            else if (cc === 1) v = K[rr * 2 + 1];
            KH[idx(rr,cc)] = (rr === cc ? 1 : 0) - v;
          }
        }
        // P = KH * P
        var Pnew = new Array(16);
        for (var i2 = 0; i2 < 4; i2++) {
          for (var j2 = 0; j2 < 4; j2++) {
            var sum = 0;
            for (var k2 = 0; k2 < 4; k2++) sum += KH[idx(i2,k2)] * P[idx(k2,j2)];
            Pnew[idx(i2,j2)] = sum;
          }
        }
        P = Pnew;

        var speed = hypot(X[2], X[3]);
        speedLP += 0.3 * (speed - speedLP);
        // ZUPT : a l'arret on saigne la vitesse pour empecher l'accumulation
        // de bruit (cause principale de la derive a l'arret).
        if (speedLP < speedThresh) { X[2] *= zupt; X[3] *= zupt; }
        var moving = speedLP > speedThresh;
        var ll = toLatLng(ref, X[0], X[1]);
        var posStd = Math.sqrt(Math.max(0, (P[idx(0,0)] + P[idx(1,1)]) / 2));
        return { lat: ll.lat, lng: ll.lng, accuracy: posStd, moving: moving, speed: speedLP, used: true };
      },
      // Prediction inertielle entre deux fixes GPS : avance l'etat avec
      // l'acceleration mesuree (repere monde est/nord, m/s^2). Recale par push().
      // No-op tant qu'aucun fix GPS n'a ancre le filtre -> sans appel a predict,
      // push() se comporte exactement comme avant (anti-regression).
      predict: function (aE, aN, t) {
        if (X === null || ref === null) return null;
        var dt = (t != null && lastT != null) ? (t - lastT) / 1000 : 0.05;
        dt = clamp(dt, 0.01, 1.0);
        lastT = t;
        if (!isFinite(aE)) aE = 0;
        if (!isFinite(aN)) aN = 0;
        predictStep(dt, aE, aN);
        // ZUPT echelonne sur dt : a basse vitesse on saigne la vitesse pour
        // empecher la derive entre deux fixes (deadband cote capteur force a=0).
        var sp = hypot(X[2], X[3]);
        if (sp < speedThresh) { var f = Math.pow(zupt, dt); X[2] *= f; X[3] *= f; }
        var ll = toLatLng(ref, X[0], X[1]);
        var posStd = Math.sqrt(Math.max(0, (P[idx(0,0)] + P[idx(1,1)]) / 2));
        return { lat: ll.lat, lng: ll.lng, accuracy: posStd, moving: sp > speedThresh, speed: sp };
      },
      getRef: function () { return ref; },
      reset: function () { ref = null; X = null; P = null; lastT = null; speedLP = 0; }
    };
  }

  // ---------- moteur chaud / froid ----------
  function createProximity(opts) {
    opts = opts || {};
    var win = opts.windowMs != null ? opts.windowMs : 2500;
    var enterHot = opts.enterHot != null ? opts.enterHot : 1.2;   // dBm/s
    var enterCold = opts.enterCold != null ? opts.enterCold : -1.2;
    var exitBand = opts.exitBand != null ? opts.exitBand : 0.4;
    // paliers de distance (m)
    var tiers = opts.tiers || [
      { max: 1.0,  key: 'burning',   label: 'BRULANT' },
      { max: 2.5,  key: 'veryClose', label: 'TRES PROCHE' },
      { max: 6.0,  key: 'close',     label: 'PROCHE' },
      { max: 15.0, key: 'far',       label: 'LOIN' },
      { max: Infinity, key: 'veryFar', label: 'TRES LOIN' }
    ];
    var buf = [];
    var state = 'stable';

    function tierFor(dist) {
      for (var i = 0; i < tiers.length; i++) if (dist <= tiers[i].max) return tiers[i];
      return tiers[tiers.length - 1];
    }
    function slope() {
      if (buf.length < 3) return 0;
      // regression lineaire v ~ a + b*t  ; t en secondes relatives
      var t0 = buf[0].t;
      var n = buf.length, st = 0, sv = 0, stt = 0, stv = 0;
      for (var i = 0; i < n; i++) {
        var tt = (buf[i].t - t0) / 1000, vv = buf[i].v;
        st += tt; sv += vv; stt += tt * tt; stv += tt * vv;
      }
      var denom = n * stt - st * st;
      if (Math.abs(denom) < 1e-6) return 0;
      return (n * stv - st * sv) / denom; // dBm/s
    }
    return {
      push: function (filteredRssi, dist, t) {
        buf.push({ t: t, v: filteredRssi });
        while (buf.length && (t - buf[0].t) > win) buf.shift();
        var b = slope();
        // machine a etats avec hysteresis
        if (state === 'hot') {
          if (b < exitBand) state = (b < enterCold ? 'cold' : 'stable');
        } else if (state === 'cold') {
          if (b > -exitBand) state = (b > enterHot ? 'hot' : 'stable');
        } else {
          if (b > enterHot) state = 'hot';
          else if (b < enterCold) state = 'cold';
        }
        var tier = tierFor(dist);
        // intensite 0..1 (proche -> 1) pour haptique/son
        var intensity = clamp(1 - (Math.log(clamp(dist, 0.3, 30)) - Math.log(0.3)) / (Math.log(30) - Math.log(0.3)), 0, 1);
        return { state: state, slope: b, tier: tier.key, tierLabel: tier.label, distance: dist, intensity: intensity };
      },
      reset: function () { buf = []; state = 'stable'; }
    };
  }

  // ---------- estimateur de position du beacon : filtre particulaire SIR ----------
  // Travaille en metres dans un cadre local. Le beacon peut bouger (chat) :
  // bruit de process (jitter) par mise a jour.
  function createEstimator(opts) {
    opts = opts || {};
    var N = opts.numParticles != null ? opts.numParticles : 600;
    var jitter = opts.jitter != null ? opts.jitter : 0.35;   // m / mise a jour
    var huberK = opts.huberK != null ? opts.huberK : 2.5;    // robustesse (en sigmas)
    var confScale = opts.confScale != null ? opts.confScale : 6; // m, echelle de confiance
    var px = null, py = null, w = null;
    var inited = false;
    var updates = 0;

    function initAround(m) {
      px = new Array(N); py = new Array(N); w = new Array(N);
      for (var i = 0; i < N; i++) {
        var a = Math.random() * 2 * Math.PI;
        var rr = m.dist + gauss() * Math.max(m.sigma, 1.0);
        px[i] = m.x + rr * Math.cos(a);
        py[i] = m.y + rr * Math.sin(a);
        w[i] = 1 / N;
      }
      inited = true;
    }
    function neff() {
      var s = 0; for (var i = 0; i < N; i++) s += w[i] * w[i];
      return s > 0 ? 1 / s : 0;
    }
    function resample() {
      var out_x = new Array(N), out_y = new Array(N);
      var r = Math.random() / N, c = w[0], i = 0;
      for (var j = 0; j < N; j++) {
        var u = r + j / N;
        while (u > c && i < N - 1) { i++; c += w[i]; }
        out_x[j] = px[i]; out_y[j] = py[i];
      }
      px = out_x; py = out_y;
      for (var k = 0; k < N; k++) w[k] = 1 / N;
    }

    return {
      addMeasurement: function (m) {
        // m = { x, y, dist, sigma }
        if (m.sigma == null || m.sigma < 1.0) m.sigma = 1.0;
        if (!inited) { initAround(m); updates = 1; return; }
        updates++;
        // predict : jitter
        for (var i = 0; i < N; i++) { px[i] += gauss() * jitter; py[i] += gauss() * jitter; }
        // update : ponderation par vraisemblance (Huber)
        var maxlog = -Infinity, logw = new Array(N);
        for (var j = 0; j < N; j++) {
          var dp = hypot(px[j] - m.x, py[j] - m.y);
          var res = (dp - m.dist) / m.sigma;
          var r2 = res * res;
          if (Math.abs(res) > huberK) r2 = huberK * (2 * Math.abs(res) - huberK);
          var lw = Math.log(w[j] + 1e-12) - 0.5 * r2;
          logw[j] = lw;
          if (lw > maxlog) maxlog = lw;
        }
        var sum = 0;
        for (var k = 0; k < N; k++) { w[k] = Math.exp(logw[k] - maxlog); sum += w[k]; }
        if (sum <= 0 || !isFinite(sum)) { for (var z = 0; z < N; z++) w[z] = 1 / N; }
        else { for (var z2 = 0; z2 < N; z2++) w[z2] /= sum; }
        if (neff() < N / 2) resample();
      },
      estimate: function () {
        if (!inited) return null;
        var mx = 0, my = 0;
        for (var i = 0; i < N; i++) { mx += px[i] * w[i]; my += py[i] * w[i]; }
        var cxx = 0, cyy = 0, cxy = 0;
        for (var j = 0; j < N; j++) {
          var dx = px[j] - mx, dy = py[j] - my;
          cxx += w[j] * dx * dx; cyy += w[j] * dy * dy; cxy += w[j] * dx * dy;
        }
        // ellipse (valeurs propres 2x2)
        var tr = cxx + cyy, dethalf = (cxx - cyy) / 2;
        var disc = Math.sqrt(dethalf * dethalf + cxy * cxy);
        var l1 = tr / 2 + disc, l2 = tr / 2 - disc;
        var rx = Math.sqrt(Math.max(0, l1)), ry = Math.sqrt(Math.max(0, l2));
        var theta = Math.atan2(l1 - cxx, cxy); // rad
        var meanRadius = Math.sqrt(Math.max(0, tr / 2));
        // confiance : decroissance exponentielle avec le rayon d'incertitude.
        // Une seule mesure (anneau large) -> confiance faible ; nuage resserre -> elevee.
        var confidence = clamp(100 * Math.exp(-meanRadius / confScale), 0, 100);
        return { x: mx, y: my, rx: rx, ry: ry, theta: theta, meanRadius: meanRadius, confidence: confidence, updates: updates };
      },
      reset: function () { px = null; py = null; w = null; inited = false; updates = 0; }
    };
  }

  // ---------- lissage de cap (passe-bas circulaire) ----------
  function createHeadingFilter(opts) {
    opts = opts || {};
    var alpha = opts.alpha != null ? opts.alpha : 0.25;
    var sx = null, sy = null;
    return {
      push: function (deg) {
        var r = deg * Math.PI / 180;
        var s = Math.sin(r), c = Math.cos(r);
        if (sx === null) { sx = s; sy = c; }
        else { sx += alpha * (s - sx); sy += alpha * (c - sy); }
        return (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
      },
      reset: function () { sx = null; sy = null; }
    };
  }

  root.MiaAlgo = {
    // utils
    hypot: hypot, clamp: clamp, gauss: gauss, median: median,
    // geo
    haversine: haversine, bearing: bearing,
    makeRef: makeRef, toLocal: toLocal, toLatLng: toLatLng,
    // modele
    rssiToDistance: rssiToDistance, distanceSigma: distanceSigma,
    // filtres / moteurs
    createRssiFilter: createRssiFilter,
    createGpsFilter: createGpsFilter,
    createProximity: createProximity,
    createEstimator: createEstimator,
    createHeadingFilter: createHeadingFilter
  };
})();
`;
