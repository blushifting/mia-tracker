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

// Bruit gaussien local (Box-Muller sur Math.random seede). Independant de
// MiaAlgo : le moteur chaud/froid n'a plus besoin de generateur gaussien.
let _spare = null;
function gaussNoise(sigma) {
  if (_spare !== null) { const s = _spare; _spare = null; return s * sigma; }
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2.0 * Math.log(u));
  _spare = mag * Math.sin(2.0 * Math.PI * v);
  return mag * Math.cos(2.0 * Math.PI * v) * sigma;
}

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
// Reensemence le RNG au debut de chaque bloc aleatoire : chaque test devient
// reproductible independamment des tests qui le precedent (l'ajout/retrait d'un
// bloc en amont ne decale plus le flux de Math.random des blocs en aval).
function seed(s) { Math.random = mulberry32(s); _spare = null; }

console.log('\n== RSSI : Kalman + median reduit le bruit ==');
{
  seed(1);
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
  seed(2);
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

console.log('\n== Chaud/froid (v1, provisoire) : detecte approche / eloignement ==');
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

console.log('\n== Chaud/froid (v1, provisoire) : pas de flapping sur signal stable ==');
{
  seed(3);
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

console.log('\n----------------------------------------');
console.log('Total: ' + passed + ' OK, ' + failed + ' FAIL');
process.exit(failed > 0 ? 1 : 0);
