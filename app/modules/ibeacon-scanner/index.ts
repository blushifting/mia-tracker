import { NativeModule, requireNativeModule } from 'expo';

export interface IBeaconEvent {
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
  start(targetUuid: string | null): void;
  stop(): void;
}

const IBeaconScanner = requireNativeModule<IBeaconScannerType>('IBeaconScanner');
export default IBeaconScanner;
