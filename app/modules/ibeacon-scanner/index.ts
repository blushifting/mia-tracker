import { NativeModule, requireNativeModule } from 'expo';

export interface IBeaconEvent {
  uuid: string;
  major: number;
  minor: number;
  txPower: number;
  rssi: number;
  deviceId: string;
}

type IBeaconScannerEvents = {
  onIBeacon: (event: IBeaconEvent) => void;
};

declare class IBeaconScannerType extends NativeModule<IBeaconScannerEvents> {
  start(targetUuid: string | null): void;
  stop(): void;
}

const IBeaconScanner = requireNativeModule<IBeaconScannerType>('IBeaconScanner');
export default IBeaconScanner;
