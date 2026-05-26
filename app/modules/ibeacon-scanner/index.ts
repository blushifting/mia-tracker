import { NativeModule, requireNativeModule } from 'expo';

export interface IBeaconEvent {
  // Champs hérités de l'ancienne API iBeacon. Avec le scan par MAC, uuid est
  // vide et major/minor sont à 0 — seuls rssi/deviceId/txPower sont remplis.
  uuid: string;
  major: number;
  minor: number;
  txPower: number;
  rssi: number;
  deviceId: string;
  match: boolean;
}

export interface DiagEvent {
  msg: string;
}

export interface MacListItem {
  mac: string;
  rssi: number;
  ageMs: number;
  count: number;
  name: string;
}

export interface MacListEvent {
  items: MacListItem[];
  total: number;
  unique: number;
  target: string;
}

type IBeaconScannerEvents = {
  onIBeacon: (event: IBeaconEvent) => void;
  onDiag: (event: DiagEvent) => void;
  onMacList: (event: MacListEvent) => void;
};

declare class IBeaconScannerType extends NativeModule<IBeaconScannerEvents> {
  ping(): string;
  /**
   * Démarre un scan BLE filtré par adresse MAC.
   * @param targetMac MAC du device cible au format AA:BB:CC:DD:EE:FF
   */
  start(targetMac: string): void;
  stop(): void;
}

const IBeaconScanner = requireNativeModule<IBeaconScannerType>('IBeaconScanner');
export default IBeaconScanner;
