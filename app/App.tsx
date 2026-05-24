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
import { BleManager, Device, ScanMode, State } from 'react-native-ble-plx';
import * as Location from 'expo-location';
import { webviewHtml } from './webviewHtml';

const APPLE_COMPANY_ID = [0x4c, 0x00]; // little-endian
const IBEACON_TYPE = [0x02, 0x15];

function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob ? globalThis.atob(b64) : '';
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToUuid(b: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(b[i].toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  ).toUpperCase();
}

interface IBeaconAdv {
  uuid: string;
  major: number;
  minor: number;
  txPowerByte: number;
}

function bytesToHex(b: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < b.length; i++) out.push(b[i].toString(16).padStart(2, '0'));
  return out.join('');
}

function parseIBeacon(manufacturerDataB64: string | null): IBeaconAdv | null {
  if (!manufacturerDataB64) return null;
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(manufacturerDataB64);
  } catch {
    return null;
  }
  // Variante 1 : bytes complets avec préfixe company ID Apple (4C 00) puis type iBeacon (02 15)
  let offset = -1;
  if (
    bytes.length >= 25 &&
    bytes[0] === APPLE_COMPANY_ID[0] &&
    bytes[1] === APPLE_COMPANY_ID[1] &&
    bytes[2] === IBEACON_TYPE[0] &&
    bytes[3] === IBEACON_TYPE[1]
  ) {
    offset = 4;
  } else if (
    // Variante 2 : préfixe company ID strippé, payload commence directement par 02 15
    bytes.length >= 23 &&
    bytes[0] === IBEACON_TYPE[0] &&
    bytes[1] === IBEACON_TYPE[1]
  ) {
    offset = 2;
  }
  if (offset < 0) return null;
  const uuid = bytesToUuid(bytes.slice(offset, offset + 16));
  const major = (bytes[offset + 16] << 8) | bytes[offset + 17];
  const minor = (bytes[offset + 18] << 8) | bytes[offset + 19];
  const txByte = bytes[offset + 20];
  const txPowerByte = txByte > 127 ? txByte - 256 : txByte;
  return { uuid, major, minor, txPowerByte };
}

function isAppleManufacturer(manufacturerDataB64: string | null): boolean {
  if (!manufacturerDataB64) return false;
  try {
    const b = base64ToBytes(manufacturerDataB64);
    return b.length >= 2 && b[0] === APPLE_COMPANY_ID[0] && b[1] === APPLE_COMPANY_ID[1];
  } catch {
    return false;
  }
}

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
  const bleManagerRef = useRef<BleManager | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const targetUuidRef = useRef<string>('FDA50693-A4E2-4FB1-AFCF-C6EB07647825');
  const targetMacRef = useRef<string>('51:00:25:09:00:4E');
  const scanningRef = useRef<boolean>(false);
  const statsRef = useRef({
    total: 0,
    apple: 0,
    iBeacon: 0,
    matched: 0,
    appleSubtypes: '',
    beaconSeen: 0,
    beaconName: '',
    beaconRssi: 0,
    beaconMdLen: 0,
    beaconMd: '',
    beaconRaw: '',
    beaconServiceData: '',
  });
  const appleSubtypeCountsRef = useRef<Record<string, number>>({});
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setWebviewReady] = useState(false);

  useEffect(() => {
    bleManagerRef.current = new BleManager();
    return () => {
      try { bleManagerRef.current?.stopDeviceScan(); } catch {}
      try { bleManagerRef.current?.destroy(); } catch {}
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

  async function startEverything(uuid: string) {
    if (scanningRef.current) return;
    targetUuidRef.current = (uuid || '').toUpperCase();

    postToWebview({ type: 'status', msg: 'Demande permissions Bluetooth…', state: 'warn' });
    const ok = await requestAndroidPermissions();
    if (!ok) {
      postToWebview({ type: 'error', msg: 'Permissions Bluetooth/Localisation refusées' });
      return;
    }

    postToWebview({ type: 'status', msg: 'Demande permission GPS…', state: 'warn' });
    const loc = await Location.requestForegroundPermissionsAsync();
    if (loc.status !== 'granted') {
      postToWebview({ type: 'error', msg: 'Permission GPS refusée' });
      return;
    }

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

    // BLE
    const manager = bleManagerRef.current;
    if (!manager) {
      postToWebview({ type: 'error', msg: 'BLE manager indisponible' });
      return;
    }

    const state = await manager.state();
    if (state !== State.PoweredOn) {
      postToWebview({ type: 'status', msg: 'Activation du Bluetooth requise…', state: 'warn' });
      try { await (manager as any).enable?.(); } catch {}
    }

    scanningRef.current = true;
    statsRef.current = {
      total: 0, apple: 0, iBeacon: 0, matched: 0, appleSubtypes: '',
      beaconSeen: 0, beaconName: '', beaconRssi: 0, beaconMdLen: 0,
      beaconMd: '', beaconRaw: '', beaconServiceData: '',
    };
    appleSubtypeCountsRef.current = {};
    postToWebview({ type: 'scanState', scanning: true });

    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = setInterval(() => {
      if (!scanningRef.current) return;
      const counts = appleSubtypeCountsRef.current;
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      statsRef.current.appleSubtypes = sorted.map(([k, v]) => `${k}:${v}`).join(' ');
      postToWebview({ type: 'debug', ...statsRef.current });
    }, 1500);

    const targetMac = targetMacRef.current.toUpperCase();

    manager.startDeviceScan(
      null,
      { scanMode: ScanMode.LowLatency, allowDuplicates: true } as any,
      (error, device: Device | null) => {
        if (error) {
          postToWebview({ type: 'error', msg: 'Scan BLE: ' + error.message });
          scanningRef.current = false;
          postToWebview({ type: 'scanState', scanning: false });
          return;
        }
        if (!device) return;
        statsRef.current.total++;

        const md = device.manufacturerData;
        if (isAppleManufacturer(md)) {
          statsRef.current.apple++;
          try {
            const b = base64ToBytes(md!);
            if (b.length >= 3) {
              const subtype = '0x' + b[2].toString(16).padStart(2, '0');
              appleSubtypeCountsRef.current[subtype] = (appleSubtypeCountsRef.current[subtype] || 0) + 1;
            }
          } catch {}
        }

        // Beacon ciblé par adresse MAC : dump tout ce qu'on a sur ce device spécifique
        if (device.id && device.id.toUpperCase() === targetMac) {
          statsRef.current.beaconSeen++;
          statsRef.current.beaconName = device.localName || device.name || '';
          if (device.rssi !== null && device.rssi !== undefined) statsRef.current.beaconRssi = device.rssi;
          try {
            if (md) {
              const b = base64ToBytes(md);
              statsRef.current.beaconMdLen = b.length;
              statsRef.current.beaconMd = bytesToHex(b);
            } else {
              statsRef.current.beaconMd = '<null>';
              statsRef.current.beaconMdLen = 0;
            }
          } catch {}
          const raw = (device as any).rawScanRecord;
          if (raw && typeof raw === 'string') {
            try { statsRef.current.beaconRaw = bytesToHex(base64ToBytes(raw)); } catch {}
          }
          const sd = (device as any).serviceData;
          if (sd && typeof sd === 'object') {
            try {
              const parts: string[] = [];
              for (const k of Object.keys(sd)) {
                parts.push(k + '=' + bytesToHex(base64ToBytes(sd[k])));
              }
              statsRef.current.beaconServiceData = parts.join(' | ');
            } catch {}
          }
        }

        const beacon = parseIBeacon(md);
        if (!beacon) return;
        statsRef.current.iBeacon++;
        const target = targetUuidRef.current;
        if (target && beacon.uuid.toUpperCase() !== target.toUpperCase()) return;
        statsRef.current.matched++;
        if (device.rssi === null || device.rssi === undefined) return;
        postToWebview({ type: 'rssi', rssi: device.rssi, name: device.localName || device.name || 'Mia' });
      }
    );
  }

  function stopEverything() {
    try { bleManagerRef.current?.stopDeviceScan(); } catch {}
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
        if (msg.uuid) targetUuidRef.current = String(msg.uuid).toUpperCase();
        break;
      case 'startScan':
        startEverything(String(msg.uuid || targetUuidRef.current));
        break;
      case 'stopScan':
        stopEverything();
        break;
      case 'config':
        if (msg.uuid) targetUuidRef.current = String(msg.uuid).toUpperCase();
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
