# Plan : pivot vers une app chaud/froid pure (sans carte, sans GPS)

> Écrit le 2026-07-21 pour être exécuté par une conversation suivante (Opus).
> Lire d'abord `CLAUDE.md` (racine + `app/`). Le code est dans
> `C:\Users\antoi\dev\mia-tracker\app\`.

## 1. Contexte et décision (ne pas re-débattre)

Test terrain du build carte/trilatération (nightly `af219c9`) : décevant.
Diagnostic confirmé — c'est le **hardware** qui plafonne, pas l'algo :

- Portée utile du beacon (RDL810-B2, TxPower ~-40 dBm à 1 m, antenne collier,
  atténuation par le corps du chat) : **~5 m**, du même ordre que l'erreur GPS
  du téléphone (3-5 m). La trilatération exige des points d'observation écartés
  de plusieurs fois l'erreur de position → impossible ici, quel que soit le filtre.
- RSSI → distance : ±4-6 dB de fluctuation = facteur ~2 d'erreur sur la distance.
- Lecture GATT intermittente en limite de portée (rafales, décrochages).

**Décisions d'Azur (2026-07-21), fermes :**
1. Pivot vers une app **chaud/froid uniquement** : pas de carte, pas de
   trilatération, pas d'estimation de position.
2. **Zéro GPS** : retirer complètement l'usage d'`expo-location`. Pas d'ancre
   « dernier contact » géolocalisée (option proposée et refusée). On garde
   seulement « dernier contact il y a X s » (timestamp).
3. **Son type compteur Geiger : en option**, toggle dans la config, **off par
   défaut**, en plus de l'haptique.
4. Le mouvement de l'utilisateur (accéléromètre) est **au cœur** du nouvel algo.

## 2. Invariants — NE PAS CASSER

- Module natif `ibeacon-scanner` (`app/modules/`) : connexion GATT par MAC
  `51:00:25:09:00:4E` + `readRemoteRssi`. **Aucune modif.**
- Architecture App.tsx (natif) ↔ WebView : on la **garde** (pipeline
  `check-webview.cjs` + injection `algoSource` + messaging éprouvés). On ne
  réécrit PAS l'UI en React Native natif.
- Contrainte d'authoring `algoSource.js` : la string ne doit contenir **ni
  backtick ni la séquence dollar-accolade** (elle est ré-interpolée dans la
  template literal de `webviewHtml.ts`). ASCII simple, quotes classiques.
- `npm run check` (tsc + check-webview + tests node) **avant chaque push** —
  un build CI raté = nightly cassée, et le CI prend ~10-15 min.
- Permissions Android : **garder `ACCESS_FINE_LOCATION`** même sans GPS — elle
  est requise pour le scan BLE sur Android ≤ 11. Ne toucher ni `app.json`
  permissions ni la demande runtime dans `App.tsx`.
- `expo-location` : retirer **l'usage** (imports, watchers) mais **laisser la
  dépendance dans `package.json` et le plugin dans `app.json`** dans un premier
  temps (les retirer change le prebuild → risque CI inutile). Nettoyage
  optionnel dans un commit séparé une fois le build vert.
- Conserver l'enregistreur/export de session JSON (bouton ⚙ → Exporter) : c'est
  la boucle de tuning hors-ligne (rejouer via `algoSource.js` en node).
- Français partout (UI, commentaires, commits).

## 3. Principe algorithmique v2 (le cœur du pivot)

L'erreur du hot/cold actuel : il mesure une pente RSSI en **dBm/seconde**
(`createProximity`). Immobile, c'est du bruit pur. Le RSSI n'est interprétable
que **corrélé au déplacement de l'utilisateur** :

- **Détection de pas** dans `App.tsx` : détection de pics sur la norme
  accéléromètre déjà lue à 10 Hz pour le still-gate (réutiliser le même
  listener/buffer). Cadence de marche ~1.5-2.5 Hz → à 10 Hz c'est propre.
  Algorithme simple : pic = norme dépassant moyenne glissante + seuil
  (~0.08 g au-dessus), période réfractaire ~300 ms. Poste `{type:'step', t}`
  à la webview. Afficher le compteur de pas dans la debug bar pour valider.
- **Moteur de tendance `createTrendTracker`** (fonction pure, `algoSource.js`) :
  - Entrée : `push(filteredRssi, stepCount, t)` à chaque lecture RSSI.
  - Fenêtre glissante indexée en **pas** (défaut : 6 pas ≈ 4 m à 0.7 m/pas).
  - Verdict = delta entre médiane RSSI du dernier tiers et du premier tiers de
    la fenêtre → **dB par mètre parcouru**.
  - Hystérésis 3 états : CHAUD (delta > +2 dB/fenêtre), FROID (< -2 dB),
    STABLE entre les deux ; sortie d'état seulement en repassant la bande morte.
    Seuils tunables à chaud.
  - **Gel à l'immobilité** (signal `still` existant) : verdict remplacé par
    « Avance pour chercher » ; après une immobilité longue (>10 s), purger la
    fenêtre (le RSSI a pu changer parce que *le chat* a bougé, pas toi).
  - **Cas « Mia bouge »** : si le RSSI varie fortement (>6 dB) sans qu'aucun
    pas n'ait été fait, ne PAS émettre de verdict directionnel — afficher un
    état distinct (« Signal instable — Mia bouge ? »).
- **Paliers de signal `createSignalTiers`** (pur) : pas de fausse distance en
  mètres en gros — des paliers francs sur RSSI filtré, seuils dBm tunables :
  BRÛLANT ≥ -55 · TRÈS PROCHE ≥ -65 · PROCHE ≥ -75 · FAIBLE ≥ -85 ·
  TRACE < -85. Équivalent approximatif (« ~1 m ») affiché petit, à titre
  indicatif seulement, via `rssiToDistance` + TxPower calibré (garder la
  calibration 1 m existante).
- **États de connexion** (âge de la dernière lecture RSSI) : SIGNAL (<2 s),
  INSTABLE (2-5 s), PERDU (>5 s). En PERDU : « Dernier contact il y a X »
  (timestamp uniquement — pas de position).
- Le filtre RSSI existant `createRssiFilter` (médiane 3 + Kalman 1D + rejet
  d'outliers) est **conservé tel quel** en amont de tout ça.

## 4. Phases d'exécution

### Phase 1 — Élagage (commit dédié)

- **`App.tsx`** : retirer imports et usage d'`expo-location`
  (`watchPositionAsync`, `watchHeadingAsync`, leurs refs/cleanup) et tout le
  flux `DeviceMotion` de fusion inertielle (`startDeviceMotion`,
  `stopDeviceMotion`, ref, le gros bloc matrice de rotation). **Garder** :
  accéléromètre still-gate, haptique, scanner natif, debug stats, export
  session, permissions runtime inchangées.
- **`algoSource.js`** : supprimer `createGpsFilter`, `createEstimator`,
  `createHeadingFilter`, `makeRef`/`toLocal`/`toLatLng`, `haversine`,
  `bearing`, `gauss` (n'était utilisé que par l'estimateur). **Garder** :
  `median`, `clamp`, `hypot` (si encore utilisé), `rssiToDistance`,
  `distanceSigma` (si encore utilisé), `createRssiFilter`, `createProximity`
  (sera remplacé en phase 2, le garder compilable en attendant ou le supprimer
  directement si phase 2 suit dans la même session).
- **`webviewHtml.ts`** : supprimer Leaflet (chargement + fallback carte
  `#map-fallback`), tous les markers/trails/cercles, `trilaterate`,
  `baselineMetrics`, `deduplicate`, `estimateBeaconPosition`, `feedEstimator`,
  `handleGPS`, la boussole (`#compass-*`), les `case 'gps'/'heading'/'accel'`,
  les toggles config PF/gpsA/imu/trail/mymeas, les lignes debug GPS/baseline.
  **Garder** : debug bar (élaguée), panneau config (txpower, n, name, haptique,
  still-gate, debug), calibration TxPower 1 m, enregistreur/export session,
  snack, status, barre RSSI, `case 'rssi'/'still'/'sensors'/'scanState'/
  'debug'/'status'/'error'/'snack'`.
- **`algo.test.mjs`** : supprimer les tests GPS/PF/heading ; garder les tests
  du filtre RSSI.
- `npm run check` doit passer → commit (« élagage carte/GPS/fusion »).

### Phase 2 — Moteur v2 (commit dédié)

- Ajouter `createTrendTracker` + `createSignalTiers` dans `algoSource.js`
  (specs §3), exposés dans `MiaAlgo`.
- Détecteur de pas dans `App.tsx` (réutilise le buffer accéléro du still-gate),
  poste `{type:'step', t}` ; compteur visible dans la debug bar.
- Tests node synthétiques dans `algo.test.mjs` :
  1. approche (RSSI monte à mesure que les pas s'accumulent) → CHAUD ;
  2. éloignement → FROID ;
  3. immobile avec bruit ±5 dB → aucun verdict (gel) ;
  4. saut de RSSI sans pas → état « Mia bouge », pas de verdict ;
  5. trous de mesure (décrochage GATT) → pas de faux verdict à la reprise ;
  6. hystérésis : oscillation autour du seuil → pas de flapping.
- `npm run check` → commit.

### Phase 3 — UI plein écran (commit dédié)

Écran unique, lisible à bout de bras en marchant :
- Fond pleine couleur animé par palier (bleu nuit → rouge « brûlant »)
  + label géant du palier.
- Ligne tendance : « TU CHAUFFES ↑ / TU REFROIDIS ↓ / STABLE / AVANCE POUR
  CHERCHER » (gel) / « MIA BOUGE ? » — pilotée par `createTrendTracker`.
- Barre RSSI conservée (petit) + « ~X m » indicatif + état connexion ;
  en PERDU : « Dernier contact il y a Xs » bien visible.
- Bouton Scanner + ⚙ config (pattern des toggles existant). Nouveaux réglages :
  seuils des paliers (dBm), taille de fenêtre (pas), seuil delta (dB),
  son on/off.

### Phase 4 — Feedback haptique + son (commit dédié)

- Haptique : tick à cadence proportionnelle à l'intensité du palier (mécanisme
  `{type:'haptic', intensity}` existant) + burst distinct au passage à un
  palier supérieur.
- **Son Geiger (OFF par défaut, toggle config)** : WebAudio API directement
  dans la webview (oscillateur court = bip), cadence = même source que
  l'haptique. Zéro dépendance nouvelle. ⚠️ Un `AudioContext` webview doit être
  créé/résumé dans un **geste utilisateur** → l'initialiser dans le handler du
  bouton Scanner (ou du toggle son).

### Phase 5 — Vérif, build, terrain

- `npm run check` → push → CI (~15 min) → APK nightly.
- Test terrain d'Azur. Boucle de tuning : export session JSON → rejeu node via
  `algoSource.js` → ajustement des seuils **à chaud** dans ⚙ (zéro rebuild).
- Optionnel après build vert : commit de nettoyage retirant `expo-location` de
  `package.json`/`app.json` (à faire seul, pour isoler le risque CI).

## 5. Ordres de grandeur attendus

`webviewHtml.ts` ~1370 → ~600-700 lignes ; `App.tsx` 352 → ~250 lignes ;
`algoSource.js` 453 → ~250 lignes. Si le résultat de l'élagage est plus gros
que ça, c'est qu'on a raté des morceaux morts.
