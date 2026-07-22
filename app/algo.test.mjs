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

console.log('\n== Tendance : approche (RSSI monte avec les pas) -> CHAUD ==');
{
  seed(10);
  const tr = A.createTrendTracker();
  let res, t = 0;
  for (let step = 0; step <= 8; step++) {
    const baseR = -80 + step * 2.5; // monte 2.5 dB par pas
    for (let k = 0; k < 4; k++) { res = tr.push(baseR + gaussNoise(0.8), step, t, false); t += 200; }
  }
  ok(res.verdict === 'hot', 'approche detectee (verdict=' + res.verdict + ', delta=' + res.delta.toFixed(1) + ')');
}

console.log('\n== Tendance : eloignement (RSSI descend avec les pas) -> FROID ==');
{
  seed(11);
  const tr = A.createTrendTracker();
  let res, t = 0;
  for (let step = 0; step <= 8; step++) {
    const baseR = -55 - step * 2.5; // descend 2.5 dB par pas
    for (let k = 0; k < 4; k++) { res = tr.push(baseR + gaussNoise(0.8), step, t, false); t += 200; }
  }
  ok(res.verdict === 'cold', 'eloignement detecte (verdict=' + res.verdict + ', delta=' + res.delta.toFixed(1) + ')');
}

console.log('\n== Tendance : immobile bruite +/-5 dB -> aucun verdict (gel) ==');
{
  seed(12);
  const tr = A.createTrendTracker();
  let res, t = 0, sawDir = false;
  for (let k = 0; k < 100; k++) {
    const noise = Math.max(-2.5, Math.min(2.5, gaussNoise(1.5))); // RSSI filtre au repos
    res = tr.push(-70 + noise, 0, t, true); // step constant, immobile
    t += 200;
    if (res.verdict === 'hot' || res.verdict === 'cold') sawDir = true;
  }
  ok(!sawDir, 'immobile : jamais de verdict directionnel');
  ok(res.verdict === 'searching', 'etat de gel (searching), verdict=' + res.verdict);
}

console.log('\n== Tendance : saut RSSI sans aucun pas -> "Mia bouge" (unstable) ==');
{
  seed(13);
  const tr = A.createTrendTracker();
  let t = 0;
  // immobile, signal stable a -70
  for (let k = 0; k < 10; k++) { tr.push(-70 + gaussNoise(0.3), 0, t, true); t += 200; }
  // saut brutal et soutenu vers -52, toujours aucun pas
  let unstableSeen = false, dirSeen = false;
  for (let k = 0; k < 10; k++) {
    const r = tr.push(-52 + gaussNoise(0.3), 0, t, true); t += 200;
    if (r.verdict === 'unstable') unstableSeen = true;
    if (r.verdict === 'hot' || r.verdict === 'cold') dirSeen = true;
  }
  ok(unstableSeen, 'saut RSSI sans pas signale "Mia bouge" (unstable)');
  ok(!dirSeen, 'aucun verdict directionnel pendant le saut sans pas');
}

console.log('\n== Tendance : coupure GATT (trou de mesure) -> pas de faux verdict a la reprise ==');
{
  seed(14);
  const tr = A.createTrendTracker({ maxGapMs: 4000 });
  let res, t = 0;
  // marche d approche : etablit CHAUD
  for (let step = 0; step <= 6; step++) {
    for (let k = 0; k < 4; k++) { res = tr.push(-80 + step * 3 + gaussNoise(0.5), step, t, false); t += 200; }
  }
  ok(res.verdict === 'hot', 'pre-condition : CHAUD etabli avant la coupure (' + res.verdict + ')');
  // coupure de 6 s (> maxGapMs) puis une seule lecture tres differente, sans nouveau pas
  t += 6000;
  res = tr.push(-60, 6, t, false);
  ok(res.verdict === 'searching', 'reprise apres coupure : pas de faux verdict (searching)');
}

console.log('\n== Tendance : hysteresis, pas de flapping sur montee bruitee ==');
{
  seed(15);
  const tr = A.createTrendTracker();
  let res, t = 0, changes = 0, prev = null, hotCount = 0, total = 0;
  for (let step = 0; step <= 30; step++) {
    const baseR = -85 + step * 0.6; // montee douce -> delta fenetre ~2.4 dB
    for (let k = 0; k < 3; k++) {
      res = tr.push(baseR + gaussNoise(1.2), step, t, false); t += 200;
      if (res.verdict === 'hot' || res.verdict === 'cold' || res.verdict === 'stable') {
        total++;
        if (prev !== null && res.verdict !== prev) changes++;
        prev = res.verdict;
        if (res.verdict === 'hot') hotCount++;
      }
    }
  }
  console.log('  changements=' + changes + ' hot=' + hotCount + '/' + total);
  ok(changes <= 4, 'peu de changements d etat malgre le bruit (hysteresis)');
  ok(hotCount > total * 0.6, 'reste majoritairement en CHAUD sur une montee reguliere');
}

console.log('\n== Paliers : hysteresis a la frontiere + atteint BRULANT ==');
{
  seed(16);
  const st = A.createSignalTiers({ margin: 2 });
  let flips = 0, prev = null;
  for (let k = 0; k < 80; k++) {
    const r = st.push(-65 + gaussNoise(1.5)); // pile sur la frontiere -65
    if (prev !== null && r.key !== prev) flips++;
    prev = r.key;
  }
  console.log('  flips=' + flips + ' sur 80 echantillons');
  ok(flips <= 6, 'pas de clignotement a la frontiere grace a la marge');
  const st2 = A.createSignalTiers();
  let last;
  for (let k = 0; k < 5; k++) last = st2.push(-50);
  ok(last.key === 'burning', 'palier BRULANT atteint a -50 dBm');
}

console.log('\n----------------------------------------');
console.log('Total: ' + passed + ' OK, ' + failed + ' FAIL');
process.exit(failed > 0 ? 1 : 0);
