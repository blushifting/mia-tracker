// Tests Node des fonctions pures de MiaAlgo. Aucune dependance externe.
// Lancer :  node algo.test.mjs
import { algoSource } from './algoSource.js';

// --- RNG deterministe pour des tests reproductibles ---
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(12345);

// --- charge MiaAlgo dans globalThis ---
new Function(algoSource)();
const A = globalThis.MiaAlgo;
if (!A) { console.error('ECHEC: MiaAlgo non defini'); process.exit(1); }

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  OK   ' + msg); }
  else { failed++; console.log('  FAIL ' + msg); }
}
function rmse(arr) { return Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length); }
function gaussNoise(sigma) { return A.gauss() * sigma; }

console.log('\n== RSSI : Kalman + median reduit le bruit ==');
{
  const truth = -60, sigma = 6;
  const f = A.createRssiFilter({ medWin: 3, Q: 0.1, R: 6 });
  const rawErr = [], filtErr = [];
  for (let i = 0; i < 300; i++) {
    const z = truth + gaussNoise(sigma);
    const r = f.push(z);
    rawErr.push(z - truth);
    if (i > 30) filtErr.push(r.value - truth); // apres convergence
  }
  const rRaw = rmse(rawErr), rFilt = rmse(filtErr);
  console.log('  rmse brut=' + rRaw.toFixed(2) + ' filtre=' + rFilt.toFixed(2));
  ok(rFilt < rRaw * 0.6, 'erreur filtree < 60% de l erreur brute');
}

console.log('\n== RSSI : suit une rampe (approche) sans surfiltrer ==');
{
  const f = A.createRssiFilter({ medWin: 3, Q: 0.1, R: 6 });
  let last = 0;
  for (let i = 0; i < 120; i++) {
    const truth = -90 + i * 0.3; // monte de -90 vers -54
    last = f.push(truth + gaussNoise(3)).value;
  }
  ok(last > -60 && last < -50, 'valeur finale suit la rampe (' + last.toFixed(1) + ')');
}

console.log('\n== RSSI : rejet d outlier ==');
{
  const f = A.createRssiFilter({ medWin: 3, Q: 0.05, R: 6, outlierK: 3 });
  let v;
  for (let i = 0; i < 30; i++) v = f.push(-60).value;
  const before = v;
  v = f.push(-10).value; // spike enorme
  ok(Math.abs(v - before) < 8, 'le spike +50dBm ne deplace pas l estimation de plus de 8 (' + (v - before).toFixed(1) + ')');
}

console.log('\n== GPS : stable a l arret (anti-derive) ==');
{
  const f = A.createGpsFilter(); // defauts (sigmaA=0.12)
  const lat0 = 48.8566, lng0 = 2.3522;
  const mPerLat = 111320, mPerLng = 111320 * Math.cos(lat0 * Math.PI / 180);
  const outs = [];
  for (let i = 0; i < 120; i++) {
    // bruit ~8m converti en degres
    const nlat = lat0 + gaussNoise(8) / mPerLat;
    const nlng = lng0 + gaussNoise(8) / mPerLng;
    const r = f.push(nlat, nlng, 8, i * 1000);
    if (i > 30) outs.push(r);
  }
  const dxs = outs.map(o => (o.lng - lng0) * mPerLng);
  const dys = outs.map(o => (o.lat - lat0) * mPerLat);
  const spread = Math.sqrt(rmse(dxs) ** 2 + rmse(dys) ** 2);
  const anyMoving = outs.some(o => o.moving);
  console.log('  dispersion sortie=' + spread.toFixed(2) + 'm (entree ~8m), moving=' + anyMoving);
  ok(spread < 4, 'dispersion filtree nettement < bruit GPS (8m)');
  ok(!anyMoving, 'jamais marque comme en mouvement a l arret');
}

console.log('\n== GPS : suit un deplacement rectiligne ==');
{
  const f = A.createGpsFilter(); // defauts
  const lat0 = 48.8566, lng0 = 2.3522;
  const mPerLat = 111320, mPerLng = 111320 * Math.cos(lat0 * Math.PI / 180);
  let lastR;
  for (let i = 0; i < 60; i++) {
    const east = i * 1.0; // 1 m/s vers l est
    const nlat = lat0 + gaussNoise(5) / mPerLat;
    const nlng = lng0 + (east + gaussNoise(5)) / mPerLng;
    lastR = f.push(nlat, nlng, 5, i * 1000);
  }
  const eastFinal = (lastR.lng - lng0) * mPerLng;
  console.log('  est final=' + eastFinal.toFixed(1) + 'm (attendu ~59), speed=' + lastR.speed.toFixed(2));
  ok(eastFinal > 45 && eastFinal < 70, 'position suit le deplacement (~59m est)');
  ok(lastR.moving, 'detecte le mouvement');
}

console.log('\n== Estimateur particulaire : converge vers le beacon ==');
{
  const est = A.createEstimator({ numParticles: 800, jitter: 0.25 });
  // beacon en (0,0). Telephone a plusieurs positions tout autour.
  const phones = [ {x:10,y:0}, {x:0,y:10}, {x:-8,y:0}, {x:0,y:-9}, {x:7,y:7}, {x:-6,y:6} ];
  for (let pass = 0; pass < 10; pass++) {
    for (const ph of phones) {
      const trueD = Math.hypot(ph.x, ph.y);
      const d = trueD + gaussNoise(1.2);
      est.addMeasurement({ x: ph.x, y: ph.y, dist: Math.max(0.3, d), sigma: 1.5 });
    }
  }
  const e = est.estimate();
  const err = Math.hypot(e.x, e.y);
  console.log('  estime=(' + e.x.toFixed(1) + ',' + e.y.toFixed(1) + ') err=' + err.toFixed(2) + 'm conf=' + e.confidence.toFixed(0) + ' rayon=' + e.meanRadius.toFixed(1));
  ok(err < 4.0, 'estimation a moins de 4m du vrai beacon');
  ok(e.confidence > 50, 'confiance elevee avec bonne diversite geometrique');
}

console.log('\n== Estimateur : 1 seule mesure => incertitude large, confiance faible ==');
{
  const est = A.createEstimator({ numParticles: 800 });
  est.addMeasurement({ x: 0, y: 0, dist: 12, sigma: 2 });
  const e = est.estimate();
  console.log('  rayon=' + e.meanRadius.toFixed(1) + 'm conf=' + e.confidence.toFixed(0));
  ok(e.meanRadius > 6, 'grande incertitude avec une seule mesure');
  ok(e.confidence < 50, 'confiance faible avec une seule mesure');
}

console.log('\n== Chaud/froid : detecte approche / eloignement ==');
{
  const px = A.createProximity({ windowMs: 2500, enterHot: 1.0, enterCold: -1.0 });
  let st;
  // approche : rssi monte
  for (let i = 0; i < 20; i++) st = px.push(-80 + i * 1.5, A.rssiToDistance(-80 + i * 1.5, -40, 2.5), i * 200).state;
  ok(st === 'hot', 'approche detectee (etat=' + st + ')');
  // eloignement : rssi descend
  const px2 = A.createProximity({ windowMs: 2500 });
  for (let i = 0; i < 20; i++) st = px2.push(-50 - i * 1.5, A.rssiToDistance(-50 - i * 1.5, -40, 2.5), i * 200).state;
  ok(st === 'cold', 'eloignement detecte (etat=' + st + ')');
}

console.log('\n== Chaud/froid : pas de flapping sur signal stable bruite (pipeline reel) ==');
{
  // Pipeline reel : RSSI brut -> filtre Kalman -> proximite (comme dans l app).
  const rf = A.createRssiFilter({ medWin: 3, Q: 0.1, R: 6 });
  const px = A.createProximity(); // defauts (window 2500, enter +/-1.2)
  let changes = 0, prev = 'stable';
  for (let i = 0; i < 200; i++) {
    const filt = rf.push(-65 + gaussNoise(4)).value;
    const s = px.push(filt, 5, i * 200).state;
    if (s !== prev) { changes++; prev = s; }
  }
  console.log('  changements d etat=' + changes + ' sur 200 echantillons');
  ok(changes <= 6, 'peu de changements d etat (hysteresis) sur signal stable');
}

console.log('\n== Cap : lissage circulaire gere le passage 360/0 ==');
{
  const h = A.createHeadingFilter({ alpha: 0.3 });
  let out;
  for (let i = 0; i < 40; i++) out = h.push((i % 2 === 0 ? 358 : 2) + gaussNoise(1));
  const near0 = (out < 15 || out > 345);
  console.log('  cap lisse=' + out.toFixed(1));
  ok(near0, 'reste proche de 0 (pas de saut a 180)');
}

console.log('\n== INTEGRATION : session simulée jardin (pipeline complet) ==');
{
  // Reproduit exactement l enchainement de handleGPS/handleRSSI du WebView :
  // gpsFilter -> ref/toLocal -> rssiFilter -> distance -> distanceSigma -> estimateur.
  const trueLat = 48.8566, trueLng = 2.3522, txPower = -40, n = 2.5;
  const rf = A.createRssiFilter({ medWin: 3, Q: 0.1, R: 6 });
  const gf = A.createGpsFilter();           // defauts (sigmaA=0.12)
  const est = A.createEstimator({ numParticles: 800, jitter: 0.3 });
  let ref = null;
  const mLat = 111320, mLng = 111320 * Math.cos(trueLat * Math.PI / 180);
  // le telephone marche en cercle (rayon 8 m) autour du beacon
  const radius = 8, waypoints = [];
  for (let s = 0; s < 40; s++) { const a = s / 40 * 2 * Math.PI; waypoints.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) }); }
  let t = 0;
  for (const wp of waypoints) {
    const phoneLat = trueLat + wp.y / mLat, phoneLng = trueLng + wp.x / mLng;
    const gLat = phoneLat + gaussNoise(5) / mLat, gLng = phoneLng + gaussNoise(5) / mLng;
    const gr = gf.push(gLat, gLng, 5, t); t += 1000;
    if (!gr) continue;
    if (!ref) ref = A.makeRef(gr.lat, gr.lng);
    const trueDist = Math.hypot(wp.x, wp.y);
    for (let j = 0; j < 5; j++) { // beacon 200ms -> 5 mesures / pas GPS
      const trueRssi = txPower - 10 * n * Math.log10(Math.max(0.5, trueDist));
      const rfv = rf.push(trueRssi + gaussNoise(5)).value;
      const dist = A.rssiToDistance(rfv, txPower, n);
      const m = A.toLocal(ref, gr.lat, gr.lng);
      const sigR = A.distanceSigma(dist, Math.sqrt(6), n);
      const sigma = Math.sqrt(sigR * sigR + (gr.accuracy || 5) * (gr.accuracy || 5));
      est.addMeasurement({ x: m.x, y: m.y, dist: dist, sigma: sigma });
    }
  }
  const e = est.estimate();
  const ll = A.toLatLng(ref, e.x, e.y);
  const err = A.haversine(ll.lat, ll.lng, trueLat, trueLng);
  console.log('  err=' + err.toFixed(2) + 'm conf=' + e.confidence.toFixed(0) + ' rayon=' + e.meanRadius.toFixed(1));
  ok(err < 6, 'session simulée : beacon localisé à moins de 6 m');
}

console.log('\n== FUSION : predict no-op avant le premier fix GPS ==');
{
  const f = A.createGpsFilter();
  const r = f.predict(1.0, 0, 1000); // accel franche, mais aucun GPS recu
  ok(r === null, 'predict ne fait rien tant qu aucun GPS n a ancre le filtre (fallback = comportement actuel)');
}

console.log('\n== FUSION : prediction inertielle pendant une coupure GPS ==');
{
  // Scenario : 5 s a vitesse constante (1 m/s est) avec GPS @1Hz pour etablir la
  // vitesse, puis 5 s d acceleration (+0.5 m/s^2) SANS aucun fix GPS (coupure).
  // Les deux filtres partagent la meme vitesse de base ; pendant la coupure le CV
  // pur garde cette vitesse constante et rate le changement, tandis que l IMU-aide
  // integre l accelerometre et suit l acceleration. Memes fixes GPS pour les deux.
  const lat0 = 48.8566, lng0 = 2.3522;
  const mLat = 111320, mLng = 111320 * Math.cos(lat0 * Math.PI / 180);
  const dt = 0.05; // 20 Hz
  function deadband(v) { return Math.abs(v) < 0.12 ? 0 : v; } // comme le capteur (App.tsx)
  const fIMU = A.createGpsFilter();
  const fCV  = A.createGpsFilter();
  let x = 0, vx = 1.0;        // verite est : demarre a 1 m/s
  let rI = null, rC = null;
  const steps = 200;          // 10 s
  for (let i = 0; i < steps; i++) {
    const t = i * dt, tms = t * 1000;
    const aE = (t >= 5) ? 0.5 : 0;     // acceleration a partir de 5 s (pendant la coupure)
    // integre la verite
    x += vx * dt + 0.5 * aE * dt * dt;
    vx += aE * dt;
    const gpsOn = (t < 5) && (i % 20 === 0); // GPS @1Hz uniquement avant la coupure
    if (gpsOn) {
      const gLat = lat0 + gaussNoise(3) / mLat;
      const gLng = lng0 + (x + gaussNoise(3)) / mLng;
      rI = fIMU.push(gLat, gLng, 3, tms);
      rC = fCV.push(gLat, gLng, 3, tms);
    } else {
      const aMeasE = deadband(aE + 0.03 + gaussNoise(0.06)); // accel mesuree + biais + bruit
      rI = fIMU.predict(aMeasE, 0, tms);
      rC = fCV.predict(0, 0, tms);
    }
  }
  const exI = (rI.lng - lng0) * mLng, exC = (rC.lng - lng0) * mLng;
  const errI = Math.abs(exI - x), errC = Math.abs(exC - x);
  console.log('  vrai est=' + x.toFixed(2) + 'm  IMU=' + exI.toFixed(2) + ' (err ' + errI.toFixed(2) + ')  CV=' + exC.toFixed(2) + ' (err ' + errC.toFixed(2) + ')');
  ok(errI < errC, 'IMU-aide suit l acceleration pendant la coupure, mieux que CV pur');
  ok(errI < 3.0, 'erreur IMU faible malgre 5 s sans GPS (' + errI.toFixed(2) + 'm)');
}

console.log('\n----------------------------------------');
console.log('Total: ' + passed + ' OK, ' + failed + ' FAIL');
process.exit(failed > 0 ? 1 : 0);
