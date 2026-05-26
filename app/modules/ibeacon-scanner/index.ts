import { NativeModule, requireNativeModule } from 'expo';

export interface IBeaconEvent {
  // Champs hérités de l'API iBeacon. Avec le mode connexion active,
  // uuid est vide, major/minor = 0 et txPower = 0. Seul rssi est rempli
  // (RSSI de la connexion GATT, lu via readRemoteRssi).
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

type IBeaconScannerEvents = {
  onIBeacon: (event: IBeaconEvent) => void;
  onDiag: (event: DiagEvent) => void;
};

declare class IBeaconScannerType extends NativeModule<IBeaconScannerEvents> {
  ping(): string;
  /**
   * Se connecte au device par MAC et lit le RSSI en boucle.
   * @param targetMac MAC du device cible au format AA:BB:CC:DD:EE:FF
   */
  start(targetMac: string): void;
  stop(): void;
}

const IBeaconScanner = requireNativeModule<IBeaconScannerType>('IBeaconScanner');
export default IBeaconScanner;
