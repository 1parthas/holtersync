export interface AdbDevice {
  id: string;
  type: 'device' | 'offline' | 'unauthorized' | 'no permissions';
  serial: string;
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  androidVersion: string;
  serial: string;
}

export interface RemoteFile {
  name: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  mtime: string | null;
  mode: number;
}

export interface TransferItem {
  id: string;
  serial: string;
  remotePath: string;
  fileName: string;
  size: number;
  status: 'queued' | 'transferring' | 'done' | 'error';
  progress: number;
  error?: string;
  destPath?: string;
}

export interface PatientInfo {
  name: string;
  age: string;
  recordingDate: string;
  deviceId: string;
  duration: string;
  sampleRate: string;
}

declare global {
  interface Window {
    electronAPI: {
      listDevices: () => Promise<AdbDevice[] | { error: string }>;
      getDeviceInfo: (serial: string) => Promise<DeviceInfo | { error: string }>;
      listFiles: (serial: string, remotePath: string) => Promise<RemoteFile[] | { error: string }>;
      transferFile: (serial: string, remotePath: string, fileName: string, saveTo?: string) => Promise<{ success: boolean; destPath: string; bytesTransferred: number } | { error: string }>;
      pickSaveFolder: () => Promise<string | null>;
      openSaveFolder: (folderPath?: string) => Promise<boolean>;
      getDefaultSavePath: () => Promise<string>;
      onDevicesChanged: (cb: (devices: AdbDevice[]) => void) => () => void;
      onTransferProgress: (cb: (data: { remotePath: string; bytesTransferred: number }) => void) => () => void;
      readFile: (filePath: string) => Promise<string | { error: string }>;
      generateReport: (data: ReportData) => Promise<{ success: boolean; reportPath: string } | { error: string }>;
      usbLiveGetInfo: () => Promise<{ port: number; url: string; clients: number }>;
      usbLiveGetQR: (serial: string) => Promise<{ dataUrl: string; url: string } | { error: string }>;
      usbLiveSetupReverse: (serial: string) => Promise<{ success: boolean }>;
      onUsbLiveData: (cb: (data: any) => void) => () => void;
      onUsbLiveClientChanged: (cb: (data: { count: number }) => void) => () => void;
      wifiGetInfo: () => Promise<any>;
      wifiGetQR: () => Promise<any>;
      wifiAdbEnable: (serial: string) => Promise<any>;
      wifiAdbConnect: (ip: string) => Promise<any>;
      wifiGetPhoneIp: (serial: string) => Promise<any>;
      btListDevices: () => Promise<any>;
      btGetMacAddress: () => Promise<any>;
      onWifiData: (cb: (data: any) => void) => () => void;
      onWifiClientChanged: (cb: (data: { count: number }) => void) => () => void;
    };
  }
}

export interface ReportData {
  patient: PatientInfo;
  avgHR: number;
  minHR: number;
  maxHR: number;
  duration: string;
  arrhythmiaEvents: ArrhythmiaEvent[];
  filePath: string;
}

export interface ArrhythmiaEvent {
  timestamp: string;
  type: string;
  hr: number;
  duration: string;
}
