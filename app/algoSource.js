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

  // ---------- moteur de tendance chaud/froid indexe sur les PAS ----------
  // Coeur du pivot : le RSSI immobile est du bruit pur ; il n'est interpretable
  // que CORRELE au deplacement de l'utilisateur. On indexe donc la fenetre
  // glissante sur les PAS (comptes par l'accelerometre), pas sur le temps.
  //
  //   push(filteredRssi, stepCount, t, isStill) a chaque lecture RSSI.
  //
  // Verdict = delta entre la mediane RSSI du dernier tiers et du premier tiers
  // de la fenetre (en pas). RSSI qui monte a mesure qu'on avance -> CHAUD.
  //
  // Etats renvoyes (champ verdict) :
  //   'hot' / 'cold' / 'stable'  : verdict directionnel (hysteresis 3 etats)
  //   'searching'                : gel — pas assez de pas pour juger (avance !)
  //   'unstable'                 : gros saut RSSI sans aucun pas -> Mia bouge ?
  function createTrendTracker(opts) {
    opts = opts || {};
    var windowSteps  = opts.windowSteps  != null ? opts.windowSteps  : 6;    // ~4 m a 0.7 m/pas
    var minSteps     = opts.minSteps     != null ? opts.minSteps     : 3;    // pas mini pour un verdict directionnel
    var enterDelta   = opts.enterDelta   != null ? opts.enterDelta   : 2.0;  // dB/fenetre pour entrer en CHAUD/FROID
    var exitDelta    = opts.exitDelta    != null ? opts.exitDelta    : 0.8;  // dB/fenetre : bande morte d'hysteresis
    var jumpNoStepDb = opts.jumpNoStepDb != null ? opts.jumpNoStepDb : 6.0;  // amplitude RSSI sans pas -> Mia bouge
    var purgeStillMs = opts.purgeStillMs != null ? opts.purgeStillMs : 10000;// immobilite longue -> purge la fenetre
    var maxGapMs     = opts.maxGapMs     != null ? opts.maxGapMs     : 4000;  // trou de mesure (coupure GATT) -> purge
    var stepMeters   = opts.stepMeters   != null ? opts.stepMeters   : 0.7;  // pour l'indicatif dB/m
    var maxLen       = opts.maxLen       != null ? opts.maxLen       : 240;  // plafond FIFO (immobilite)

    var buf = [];            // { rssi, step, t }
    var state = 'stable';    // etat directionnel hysteretique
    var stillSince = null;

    function medianThird(lo, hi) {
      var vals = [];
      for (var i = 0; i < buf.length; i++) {
        if (buf[i].step >= lo && buf[i].step <= hi) vals.push(buf[i].rssi);
      }
      return vals.length ? median(vals) : null;
    }

    return {
      push: function (rssi, step, t, isStill) {
        if (step == null) step = 0;
        // trou de mesure (coupure GATT) : au-dela de maxGapMs, la correlation
        // entre les anciens echantillons et le nouveau est rompue -> on purge
        // pour ne pas fabriquer un faux verdict a la reprise.
        if (buf.length && (t - buf[buf.length - 1].t) > maxGapMs) buf = [];
        buf.push({ rssi: rssi, step: step, t: t });
        // fenetre glissante indexee en pas
        var minStep = step - windowSteps;
        while (buf.length && buf[0].step < minStep) buf.shift();
        // plafond FIFO : evite la croissance infinie a l'arret (meme pas repete)
        while (buf.length > maxLen) buf.shift();

        // purge apres immobilite longue : le RSSI a pu changer parce que MIA a
        // bouge, pas toi -> on repart d'une fenetre propre.
        if (isStill) {
          if (stillSince == null) stillSince = t;
          if (t - stillSince > purgeStillMs) { buf = [{ rssi: rssi, step: step, t: t }]; }
        } else {
          stillSince = null;
        }

        var firstStep = buf[0].step;
        var stepsInWindow = step - firstStep;

        // amplitude RSSI dans la fenetre
        var lo = Infinity, hi = -Infinity;
        for (var i = 0; i < buf.length; i++) {
          if (buf[i].rssi < lo) lo = buf[i].rssi;
          if (buf[i].rssi > hi) hi = buf[i].rssi;
        }
        var range = hi - lo;

        // cas "Mia bouge" : gros saut RSSI alors qu'aucun pas n'a ete fait
        if (stepsInWindow < 1 && range > jumpNoStepDb) {
          state = 'stable'; // le paysage RSSI a change : plus de direction fiable
          return { state: state, verdict: 'unstable', delta: 0, dbPerMeter: 0, steps: stepsInWindow, range: range };
        }

        // gel : pas assez de pas pour juger d'une tendance
        if (stepsInWindow < minSteps) {
          return { state: state, verdict: 'searching', delta: 0, dbPerMeter: 0, steps: stepsInWindow, range: range };
        }

        // delta = mediane(dernier tiers) - mediane(premier tiers), en pas
        var span = stepsInWindow;
        var loCut = firstStep + span / 3;
        var hiCut = firstStep + 2 * span / 3;
        var mFirst = medianThird(firstStep, loCut);
        var mLast  = medianThird(hiCut, step);
        if (mFirst == null || mLast == null) {
          return { state: state, verdict: 'searching', delta: 0, dbPerMeter: 0, steps: stepsInWindow, range: range };
        }
        var delta = mLast - mFirst; // dB sur la fenetre
        var meters = Math.max(0.1, span * stepMeters);
        var dbPerMeter = delta / meters;

        // machine a etats avec hysteresis (sortie seulement en repassant la bande morte)
        if (state === 'hot') {
          if (delta < exitDelta) state = (delta < -enterDelta ? 'cold' : 'stable');
        } else if (state === 'cold') {
          if (delta > -exitDelta) state = (delta > enterDelta ? 'hot' : 'stable');
        } else {
          if (delta > enterDelta) state = 'hot';
          else if (delta < -enterDelta) state = 'cold';
        }
        return { state: state, verdict: state, delta: delta, dbPerMeter: dbPerMeter, steps: stepsInWindow, range: range };
      },
      reset: function () { buf = []; state = 'stable'; stillSince = null; }
    };
  }

  // ---------- paliers de signal (pas de fausse distance en metres) ----------
  // Paliers francs sur le RSSI filtre, avec hysteresis (marge dB) pour ne pas
  // clignoter a la frontiere. Seuils dBm tunables.
  function createSignalTiers(opts) {
    opts = opts || {};
    var tiers = opts.tiers || [
      { min: -55,       key: 'burning',   label: 'BRULANT' },
      { min: -65,       key: 'veryClose', label: 'TRES PROCHE' },
      { min: -75,       key: 'close',     label: 'PROCHE' },
      { min: -85,       key: 'weak',      label: 'FAIBLE' },
      { min: -Infinity, key: 'trace',     label: 'TRACE' }
    ];
    var margin = opts.margin != null ? opts.margin : 2.0; // hysteresis (dB)
    var current = null;

    function rawTier(rssi) {
      for (var i = 0; i < tiers.length; i++) if (rssi >= tiers[i].min) return i;
      return tiers.length - 1;
    }
    return {
      push: function (rssi) {
        if (current === null) {
          current = rawTier(rssi);
        } else {
          // monter vers un palier plus fort (index plus petit) : franchir la borne + marge
          while (current > 0 && rssi >= tiers[current - 1].min + margin) current--;
          // descendre vers un palier plus faible : passer sous la borne - marge
          while (current < tiers.length - 1 && rssi < tiers[current].min - margin) current++;
        }
        return { index: current, key: tiers[current].key, label: tiers[current].label, count: tiers.length, rssi: rssi };
      },
      reset: function () { current = null; }
    };
  }

  root.MiaAlgo = {
    // utils
    clamp: clamp, median: median,
    // modele
    rssiToDistance: rssiToDistance, distanceSigma: distanceSigma,
    // filtres / moteurs
    createRssiFilter: createRssiFilter,
    createTrendTracker: createTrendTracker,
    createSignalTiers: createSignalTiers
  };
})();
`;
