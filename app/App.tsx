import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  PermissionsAndroid,
  SafeAreaView,
  StyleSheet,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import IBeaconScanner, { IBeaconEvent, DiagEvent } from 'ibeacon-scanner';
import { webviewHtml } from './webviewHtml';

// MAC du collier de Mia (RDL810-B2). Cf. RECAP-IBEACON-DEBUG.md piste G.
const TARGET_MAC = '51:00:25:09:00:4E';

// Detection immobile : variance accelero (norme g) sur 2s.
// Seuil 0.003 g^2 ~= une petite agitation suffit a passer en "mouvement".
// Empirique : un tel pose sur table = ~0.0001, marche normale = ~0.05+.
const STILL_VAR_THRESHOLD = 0.003;
const STILL_WINDOW_MS = 2000;

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const perms: string[] = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  if (apiLevel >= 31) {
    perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
    perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  }
  const granted = await PermissionsAndroid.requestMultiple(perms as any);
  return perms.every((p) => granted[p as keyof typeof granted] === PermissionsAndroid.RESULTS.GRANTED);
}

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const scanningRef = useRef<boolean>(false);
  const lastSeenMsRef = useRef<number>(0);
  const statsRef = useRef({
    nativePing: '',
    nativeDiag: '',
    scans: 0,
    matched: 0,
    lastRssi: 0,
    lastAgeSec: -1,
    deviceName: '',
  });
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accelSubRef = useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);
  const accelBufRef = useRef<{ t: number; mag: number }[]>([]);
  const lastStillRef = useRef<boolean | null>(null);
  const [, setWebviewReady] = useState(false);

  useEffect(() => {
    // Ping le module natif au demarrage : si "pong-macscan-v1" arrive, le natif est OK
    try {
      const pong = IBeaconScanner.ping();
      statsRef.current.nativePing = pong || '<no return>';
    } catch (e: any) {
      statsRef.current.nativePing = 'CRASH: ' + (e?.message || 'unknown');
    }

    // Sonde sensors + haptics : si un module manque, on saura via la debug bar
    // plutot que d'avoir un crash silencieux a la premiere utilisation.
    (async () => {
      let accelStatus = 'unknown';
      let hapticStatus = 'unknown';
      try {
        const ok = await Accelerometer.isAvailableAsync();
        accelStatus = ok ? 'ok' : 'no-hw';
      } catch (e: any) {
        accelStatus = 'err:' + (e?.message || 'unknown').slice(0, 40);
      }
      try {
        // Haptics n'a pas d'isAvailableAsync uniforme; on teste qu'on peut invoquer.
        await Haptics.selectionAsync();
        hapticStatus = 'ok';
      } catch (e: any) {
        hapticStatus = 'err:' + (e?.message || 'unknown').slice(0, 40);
      }
      // Stocke pour le payload debug periodique aussi
      (statsRef.current as any).accel = accelStatus;
      (statsRef.current as any).haptic = hapticStatus;
      // Envoi immediat au webview (peut arriver avant 'ready', le webview ignore au pire)
      setTimeout(() => postToWebview({ type: 'sensors', accel: accelStatus, haptic: hapticStatus }), 500);
    })();

    const subI = IBeaconScanner.addListener('onIBeacon', (e: IBeaconEvent) => {
      statsRef.current.scans++;
      if (e.match) {
        statsRef.current.matched++;
        statsRef.current.lastRssi = e.rssi;
        lastSeenMsRef.current = Date.now();
        postToWebview({ type: 'rssi', rssi: e.rssi, name: 'Mia' });
      }
    });
    const subD = IBeaconScanner.addListener('onDiag', (e: DiagEvent) => {
      const msg = (e.msg || '').slice(0, 120);
      statsRef.current.nativeDiag = msg;
      // Audit trail : chaque diag sort dans logcat (tag ReactNativeJS)
      // pour pouvoir relire l'historique sans dependre de la UI rolling.
      // eslint-disable-next-line no-console
      console.log('[ibeacon-diag]', msg);
    });
    return () => {
      try { subI.remove(); } catch {}
      try { subD.remove(); } catch {}
      try { IBeaconScanner.stop(); } catch {}
      locationSubRef.current?.remove();
      headingSubRef.current?.remove();
      accelSubRef.current?.remove();
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, []);

  function startAccelerometer() {
    if (accelSubRef.current) return;
    Accelerometer.setUpdateInterval(100); // 10 Hz suffit pour distinguer immobile/mouvement
    accelSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z); // norme en g (gravite ~ 1.0)
      const now = Date.now();
      const buf = accelBufRef.current;
      buf.push({ t: now, mag });
      // garde la fenetre glissante
      while (buf.length && now - buf[0].t > STILL_WINDOW_MS) buf.shift();
      if (buf.length < 10) return; // pas assez d'echantillons
      // variance de la norme : insensible a l'orientation, sensible au mouvement
      let mean = 0;
      for (let i = 0; i < buf.length; i++) mean += buf[i].mag;
      mean /= buf.length;
      let v = 0;
      for (let i = 0; i < buf.length; i++) {
        const d = buf[i].mag - mean;
        v += d * d;
      }
      v /= buf.length;
      const isStill = v < STILL_VAR_THRESHOLD;
      // n'emet qu'au changement d'etat pour eviter le spam
      if (lastStillRef.current !== isStill) {
        lastStillRef.current = isStill;
        postToWebview({ type: 'still', isStill, variance: v });
      }
    });
  }

  function stopAccelerometer() {
    accelSubRef.current?.remove();
    accelSubRef.current = null;
    accelBufRef.current = [];
    lastStillRef.current = null;
  }

  async function triggerHaptic(intensity: number) {
    try {
      if (intensity >= 3) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (intensity === 2) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }

  function postToWebview(payload: any) {
    const json = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webviewRef.current?.injectJavaScript(
      `(function(){try{var e=new MessageEvent('message',{data:'${json}'});window.dispatchEvent(e);}catch(err){}})();true;`
    );
  }

  async function startEverything() {
    if (scanningRef.current) return;

    postToWebview({ type: 'status', msg: 'Demande permissions Bluetooth...', state: 'warn' });
    const ok = await requestAndroidPermissions();
    if (!ok) {
      postToWebview({ type: 'error', msg: 'Permissions Bluetooth/Localisation refusees' });
      return;
    }

    postToWebview({ type: 'status', msg: 'Demarrage GPS...', state: 'warn' });
    try {
      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (pos) => {
          postToWebview({
            type: 'gps',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: pos.coords.accuracy ?? null,
          });
        }
      );
    } catch (e: any) {
      postToWebview({ type: 'error', msg: 'GPS: ' + (e?.message || 'erreur') });
    }

    try {
      headingSubRef.current = await Location.watchHeadingAsync((h) => {
        const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        postToWebview({ type: 'heading', heading });
      });
    } catch {}

    scanningRef.current = true;
    const keepPing = statsRef.current.nativePing;
    statsRef.current = {
      nativePing: keepPing, nativeDiag: '',
      scans: 0, matched: 0, lastRssi: 0, lastAgeSec: -1, deviceName: '',
    };
    lastSeenMsRef.current = 0;

    try {
      IBeaconScanner.start(TARGET_MAC);
    } catch (e: any) {
      postToWebview({ type: 'error', msg: 'Scan natif start: ' + (e?.message || 'erreur') });
    }
    startAccelerometer();
    postToWebview({ type: 'scanState', scanning: true });

    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = setInterval(() => {
      if (!scanningRef.current) return;
      if (lastSeenMsRef.current > 0) {
        statsRef.current.lastAgeSec = Math.round((Date.now() - lastSeenMsRef.current) / 1000);
      }
      postToWebview({ type: 'debug', ...statsRef.current, mac: TARGET_MAC });
    }, 1000);
  }

  function stopEverything() {
    try { IBeaconScanner.stop(); } catch {}
    locationSubRef.current?.remove(); locationSubRef.current = null;
    headingSubRef.current?.remove(); headingSubRef.current = null;
    stopAccelerometer();
    if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = null; }
    scanningRef.current = false;
    postToWebview({ type: 'scanState', scanning: false });
  }

  function onWebviewMessage(event: WebViewMessageEvent) {
    let msg: any;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    switch (msg.type) {
      case 'ready':
        setWebviewReady(true);
        break;
      case 'startScan':
        startEverything();
        break;
      case 'stopScan':
        stopEverything();
        break;
      case 'haptic':
        triggerHaptic(typeof msg.intensity === 'number' ? msg.intensity : 1);
        break;
      case 'webview-error':
        // Erreur captee par window.onerror cote webview. Log dans logcat pour
        // pouvoir investiguer hors-app. La debug bar la montre deja en UI.
        // eslint-disable-next-line no-console
        console.log('[webview-error]', msg.msg);
        break;
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <RNStatusBar barStyle="light-content" backgroundColor="#0d1117" />
      <WebView
        ref={webviewRef}
        source={{ html: webviewHtml, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        geolocationEnabled={false}
        onMessage={onWebviewMessage}
        style={styles.webview}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onError={(e) => Alert.alert('WebView', e.nativeEvent.description)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
  webview: { flex: 1, backgroundColor: '#0d1117' },
});
