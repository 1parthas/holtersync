const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── USB / ADB ──────────────────────────────────────────────────────────────
  listDevices: () => ipcRenderer.invoke('adb:list-devices'),
  getDeviceInfo: (serial) => ipcRenderer.invoke('adb:get-device-info', { serial }),
  listFiles: (serial, remotePath) => ipcRenderer.invoke('adb:list-files', { serial, remotePath }),
  transferFile: (serial, remotePath, fileName, saveTo) =>
    ipcRenderer.invoke('adb:transfer-file', { serial, remotePath, fileName, saveTo }),
  pickSaveFolder: () => ipcRenderer.invoke('adb:pick-save-folder'),
  openSaveFolder: (folderPath) => ipcRenderer.invoke('adb:open-save-folder', { folderPath }),
  getDefaultSavePath: () => ipcRenderer.invoke('adb:default-save-path'),

  // ── USB Live ───────────────────────────────────────────────────────────────
  usbLiveGetInfo: () => ipcRenderer.invoke('usb-live:get-info'),
  usbLiveGetQR: (serial) => ipcRenderer.invoke('usb-live:get-qr', { serial }),
  usbLiveSetupReverse: (serial) => ipcRenderer.invoke('usb-live:setup-reverse', { serial }),
  onUsbLiveData: (cb) => {
    ipcRenderer.on('usb-live:data-received', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('usb-live:data-received');
  },
  onUsbLiveClientChanged: (cb) => {
    ipcRenderer.on('usb-live:client-connected', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('usb-live:client-connected');
  },

  // ── WiFi server ────────────────────────────────────────────────────────────
  wifiGetInfo: () => ipcRenderer.invoke('wifi:get-info'),
  wifiGetQR: () => ipcRenderer.invoke('wifi:get-qr'),
  wifiAdbEnable: (serial) => ipcRenderer.invoke('wifi:adb-enable', { serial }),
  wifiAdbConnect: (ip) => ipcRenderer.invoke('wifi:adb-connect', { ip }),
  wifiGetPhoneIp: (serial) => ipcRenderer.invoke('wifi:get-phone-ip', { serial }),

  // ── Bluetooth ──────────────────────────────────────────────────────────────
  btListDevices: () => ipcRenderer.invoke('bt:list-devices'),
  btGetMacAddress: () => ipcRenderer.invoke('bt:get-mac-address'),
  btListSerialPorts: () => ipcRenderer.invoke('bt:list-serial-ports'),
  btStartListen: (portPath) => ipcRenderer.invoke('bt:start-listen', { portPath }),
  btStopListen: () => ipcRenderer.invoke('bt:stop-listen'),
  onBtData: (cb) => {
    ipcRenderer.on('bt:data-received', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('bt:data-received');
  },
  onBtConnected: (cb) => {
    ipcRenderer.on('bt:connected', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('bt:connected');
  },
  onBtDisconnected: (cb) => {
    ipcRenderer.on('bt:disconnected', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('bt:disconnected');
  },
  onBtError: (cb) => {
    ipcRenderer.on('bt:error', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('bt:error');
  },

  // ── File / Report ──────────────────────────────────────────────────────────
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', { filePath }),
  generateReport: (data) => ipcRenderer.invoke('report:generate', { data }),

  // ── Events ─────────────────────────────────────────────────────────────────
  onDevicesChanged: (cb) => {
    ipcRenderer.on('adb:devices-changed', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('adb:devices-changed');
  },
  onTransferProgress: (cb) => {
    ipcRenderer.on('transfer:progress', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('transfer:progress');
  },
  onWifiData: (cb) => {
    ipcRenderer.on('wifi:data-received', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('wifi:data-received');
  },
  onWifiClientChanged: (cb) => {
    ipcRenderer.on('wifi:client-connected', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('wifi:client-connected');
  },
});
