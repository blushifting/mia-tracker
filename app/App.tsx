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
import IBeaconScanner, { IBeaconEvent, DiagEvent, MacListEvent } from 'ibeacon-scanner';
import { webviewHtml } from './webviewHtml';

// MAC du collier de Mia (RDL810-B2). Cf. RECAP-IBEACON-DEBUG.md piste G.
const TARGET_MAC = '51:00:25:09:00:4E';

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
  const [, setWebviewReady] = useState(false);

  useEffect(() => {
    // Ping le module natif au demarrage : si "pong-macscan-v1" arrive, le natif est OK
    try {
      const pong = IBeaconScanner.ping();
      statsRef.current.nativePing = pong || '<no return>';
    } catch (e: any) {
      statsRef.current.nativePing = 'CRASH: ' + (e?.message || 'unknown');
    }

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
    const subM = IBeaconScanner.addListener('onMacList', (e: MacListEvent) => {
      postToWebview({ type: 'macList', items: e.items, total: e.total, unique: e.unique, target: e.target });
    });

    return () => {
      try { subI.remove(); } catch {}
      try { subD.remove(); } catch {}
      try { subM.remove(); } catch {}
      try { IBeaconScanner.stop(); } catch {}
      locationSubRef.current?.remove();
      headingSubRef.current?.remove();
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, []);

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
          postToWebview({ type: 'gps', lat: pos.coords.latitude, lng: pos.coords.longitude });
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
