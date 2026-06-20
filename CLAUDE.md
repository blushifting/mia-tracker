# Mia Tracker — instructions projet (À LIRE EN PREMIER)

## Emplacement du code

Le code vit dans **`C:\Users\antoi\dev\mia-tracker`** — volontairement **hors
OneDrive** pour éviter les bugs de synchro (fichiers « online-only » que OneDrive
n'arrive plus à réhydrater) et ne pas occuper d'espace cloud.

- Dépôt git : `blushifting/mia-tracker`, branche `main`
  (`https://github.com/blushifting/mia-tracker.git`).
- Buildé par GitHub Actions : `.github/workflows/build-apk.yml`, l'app est sous `app/`.
- `node_modules/` est gitignoré et régénérable via `npm ci` (ne jamais le versionner
  ni le copier ailleurs).

**Avant toute modif de code : `cd app`.**

## Détection du beacon — NE PAS CASSER

La détection passe par le **module natif `ibeacon-scanner`** qui se **connecte en GATT
par adresse MAC** (`51:00:25:09:00:4E`) et lit le RSSI via `readRemoteRssi` (pas de scan
d'advertising passif). Beaucoup de temps a été investi pour fiabiliser ce repérage —
**ne pas remplacer cette approche** sans accord explicite. `App.tsx` pilote le scan,
l'accéléromètre (gel d'immobilité), l'haptique (`expo-haptics`) et les diagnostics.

## Vérifier avant un build (les builds CI prennent ~10-15 min)

```bash
cd app
npm run check        # tsc + check-webview.cjs (réplique le lint du CI) + algo.test.mjs
```

`check-webview.cjs` fait `require('./webviewHtml.ts')` comme le CI : il attrape les
erreurs de syntaxe du JS embarqué ET les imports non résolus (que `tsc` ne voit pas —
ex. un import sans extension `.js` casse le build CI mais passe tsc). **Toujours lancer
`npm run check` avant de pousser** (un build CI raté = nightly non mise à jour).

L'algo numérique est isolé dans `app/algoSource.js` (fonctions pures, sans DOM),
injecté dans `webviewHtml.ts` et testé par `app/algo.test.mjs`. Tuner les paramètres
plutôt que multiplier les builds.

## Langue

Français partout (UI, commentaires, commits). Anglais seulement pour les identifiants techniques.
