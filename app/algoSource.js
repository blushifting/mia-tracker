// algoSource.js
// Source unique des fonctions PURES de Mia Tracker (moteur chaud/froid).
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
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function median(arr) {
    if (arr.length === 0) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // ---------- modele log-distance (distance indicative uniquement) ----------
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

  // ---------- moteur chaud / froid (pente RSSI en dBm/s) ----------
  // NOTE : sera remplace en phase 2 par createTrendTracker (pente indexee sur
  // les PAS de l'utilisateur, pas sur le temps). Conserve ici le temps que le
  // pipeline phase 2 soit en place, pour rester compilable et testable.
  function createProximity(opts) {
    opts = opts || {};
    var win = opts.windowMs != null ? opts.windowMs : 2500;
    var enterHot = opts.enterHot != null ? opts.enterHot : 1.2;   // dBm/s
    var enterCold = opts.enterCold != null ? opts.enterCold : -1.2;
    var exitBand = opts.exitBand != null ? opts.exitBand : 0.4;
    var buf = [];
    var state = 'stable';

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
        return { state: state, slope: b, distance: dist };
      },
      reset: function () { buf = []; state = 'stable'; }
    };
  }

  root.MiaAlgo = {
    // utils
    clamp: clamp, median: median,
    // modele
    rssiToDistance: rssiToDistance, distanceSigma: distanceSigma,
    // filtres / moteurs
    createRssiFilter: createRssiFilter,
    createProximity: createProximity
  };
})();
`;
