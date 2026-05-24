# mia-tracker

Localisation du beacon iBeacon RDL810-B2 accroché au collier de Mia.

## Deux versions

| Version | Statut | Tech |
|---|---|---|
| **APK Android natif** ([`app/`](app/)) | ✅ Fonctionnel | Expo + React Native + `react-native-ble-plx` |
| PWA HTML ([`chat-tracker.html`](chat-tracker.html)) | ⚠️ Web Bluetooth ne reçoit pas les advertising iBeacon sur Chrome Android | Leaflet + Web Bluetooth |

## Récupérer l'APK

Onglet **[Actions](../../actions)** → dernier run vert du workflow *Build Android APK* → **Artifacts** → `mia-tracker-apk.zip`. Dézippe → `mia-tracker-latest.apk` → install sur le Pixel.

Voir [`app/README.md`](app/README.md) pour le détail.
