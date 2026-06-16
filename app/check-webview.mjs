// Controle de syntaxe du JS embarque dans webviewHtml.ts (sans build, sans DOM).
// On EVALUE le template literal (avec algoSource en scope) pour obtenir le HTML
// reellement livre au navigateur, PUIS on extrait chaque <script> et on le passe
// a new Function (parse only) -> detecte toute erreur de syntaxe avant un build CI.
//   node check-webview.mjs
import { readFileSync } from 'node:fs';
import { algoSource } from './algoSource.js';

const raw = readFileSync(new URL('./webviewHtml.ts', import.meta.url), 'utf8');

// Extrait l'expression template literal `...` (de la 1ere a la derniere backquote).
const start = raw.indexOf('`');
const end = raw.lastIndexOf('`');
if (start < 0 || end <= start) { console.log('FAIL: template literal introuvable'); process.exit(1); }
const tpl = raw.slice(start, end + 1);

let html;
try {
  // eval direct : algoSource (importe) est dans le scope lexical pour ${algoSource}
  html = eval(tpl);
} catch (e) {
  console.log('FAIL: evaluation du template literal: ' + e.message);
  process.exit(1);
}

const re = /<script>([\s\S]*?)<\/script>/g;
let m, idx = 0, errors = 0;
while ((m = re.exec(html)) !== null) {
  idx++;
  const code = m[1];
  if (!code.trim()) continue; // <script src=...> sans corps
  try {
    new Function(code); // parse uniquement (pas d'execution)
    console.log('  OK   bloc script #' + idx + ' (' + code.length + ' chars) parse sans erreur');
  } catch (e) {
    errors++;
    console.log('  FAIL bloc script #' + idx + ' : ' + e.message);
  }
}

console.log(errors ? ('\nECHEC: ' + errors + ' probleme(s)') : '\nOK: syntaxe valide (' + idx + ' blocs)');
process.exit(errors ? 1 : 0);
