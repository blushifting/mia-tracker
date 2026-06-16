// Réplique EXACTE de l'étape "Lint webview HTML/JS syntax" du workflow CI.
// require() le module (donc exerce la résolution des imports — ce que tsc NE
// vérifie PAS de façon stricte), extrait les <script> (hors src=) du HTML généré
// et passe chacun à new Function (parse only). Catche à la fois les erreurs de
// syntaxe du JS embarqué ET les imports non résolus. Lancé par `npm run check`.
const { webviewHtml } = require('./webviewHtml.ts');
const scripts = [...webviewHtml.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let bad = 0;
scripts.forEach((s, i) => {
  try { new Function(s); console.log('  OK   webview script #' + i + ' (' + s.length + ' chars)'); }
  catch (e) { console.error('  FAIL webview script #' + i + ' : ' + e.message); bad++; }
});
if (bad > 0) { console.error('\nECHEC: ' + bad + ' bloc(s) en erreur'); process.exit(1); }
console.log('\nOK: syntaxe + imports valides (' + scripts.length + ' blocs)');
