# Mia Tracker — APK Android

App Android native qui scanne en passif le beacon iBeacon RDL810-B2 accroché au collier de Mia, enregistre RSSI + GPS, et estime la position du chat par triangulation sur une carte CartoDB dark.

- BLE : `react-native-ble-plx` (scan iBeacon natif, sans appairage)
- GPS : `expo-location` (haute précision)
- Carte + UI : WebView + Leaflet (réutilise l'UI de la PWA `chat-tracker.html`)
- Algo : modèle log-distance + centroïde pondéré + Gauss-Newton (≥3 points)

---

## Récupérer l'APK

Le workflow [`.github/workflows/build-apk.yml`](../.github/workflows/build-apk.yml) construit un APK à chaque push qui touche `app/`. Pour récupérer l'APK :

1. Onglet **Actions** du repo → run vert le plus récent
2. Section **Artifacts** → télécharge `mia-tracker-apk.zip`
3. Dézippe → `mia-tracker-latest.apk`
4. Transfère sur le Pixel 10 (USB / Drive / mail)
5. Ouvre le `.apk` depuis le gestionnaire de fichiers, autorise "Installer des applis inconnues" pour le gestionnaire si demandé
6. Lance **Mia Tracker**, accepte Bluetooth + Localisation, appuie sur **▶ Scanner**

## Utilisation

1. Allume le beacon RDL810-B2 (appui long sur le bouton central, 3 clignotements)
2. Ouvre l'app, appuie sur **▶ Scanner**
3. Promène-toi dans le jardin avec le téléphone
4. Chaque mesure RSSI + GPS est enregistrée
5. La position estimée de Mia s'affiche en bleu sur la carte
6. La flèche de la boussole pointe vers Mia (relative à ton orientation)

### Configuration (icône ⚙)

- **UUID** : `FDA50693-A4E2-4FB1-AFCF-C6EB07647825` (pré-rempli)
- **TxPower** : -40 dBm (mesuré à 1 m du beacon)
- **Exposant n** : 2.5 (jardin)
- **Lissage** : 5 mesures

---

## Build local (optionnel)

Requiert JDK 17 + Android SDK + `ANDROID_HOME` configuré.

```bash
cd app
npm install
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Architecture

```
app/
  App.tsx              ← Bridge RN : BLE scan, GPS, heading → postMessage WebView
  webviewHtml.ts       ← UI complète (Leaflet, RSSI bar, compass, triangulation)
  app.json             ← Config Expo (permissions, plugins BLE/Location)
  package.json
.github/workflows/
  build-apk.yml        ← CI : npm install + prebuild + gradle assembleDebug
```

L'APK est signé avec la clé debug Android — installable partout en sideload, mais pas publiable sur le Play Store. Pour publier : ajouter un keystore release + utiliser `assembleRelease`.
