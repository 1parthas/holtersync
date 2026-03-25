'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdbDevice, DeviceInfo, RemoteFile, TransferItem } from '@/types';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import FileBrowser from '@/components/FileBrowser';
import TransferQueue from '@/components/TransferQueue';
import EmptyState from '@/components/EmptyState';
import ECGViewer from '@/components/ECGViewer';
import WifiPanel from '@/components/WifiPanel';
import BluetoothPanel from '@/components/BluetoothPanel';
import UsbLivePanel from '@/components/UsbLivePanel';

type AppView = 'transfer' | 'ecg';
type TransportMode = 'usb' | 'wifi' | 'bluetooth';
type UsbSubMode = 'files' | 'live';

export default function App() {
  const [view, setView] = useState<AppView>('transfer');
  const [ecgFilePath, setEcgFilePath] = useState('');
  const [ecgFileName, setEcgFileName] = useState('');
  const [transport, setTransport] = useState<TransportMode>('usb');
  const [usbSub, setUsbSub] = useState<UsbSubMode>('files');

  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<AdbDevice | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [currentPath, setCurrentPath] = useState('/storage/emulated/0');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [savePath, setSavePath] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTransferPanel, setShowTransferPanel] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.getDefaultSavePath().then(setSavePath);
  }, [isElectron]);

  const refreshDevices = useCallback(async () => {
    if (!isElectron) return;
    setIsLoadingDevices(true);
    try {
      const result = await window.electronAPI.listDevices();
      if ('error' in result) {
        setError(result.error);
        setDevices([]);
      } else {
        setDevices(result);
        setError(null);
        if (result.length > 0 && !selectedDevice) setSelectedDevice(result[0]);
        if (selectedDevice && !result.find(d => d.serial === selectedDevice.serial)) {
          setSelectedDevice(null);
          setFiles([]);
          setDeviceInfo(null);
        }
      }
    } finally {
      setIsLoadingDevices(false);
    }
  }, [isElectron, selectedDevice]);

  useEffect(() => {
    refreshDevices();
    const interval = setInterval(refreshDevices, 3000);
    return () => clearInterval(interval);
  }, [refreshDevices]);

  useEffect(() => {
    if (!isElectron) return;
    const cleanup = window.electronAPI.onDevicesChanged((devs) => setDevices(devs));
    return cleanup;
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron || !selectedDevice) { setDeviceInfo(null); return; }
    window.electronAPI.getDeviceInfo(selectedDevice.serial).then((res) => {
      if (!('error' in res)) setDeviceInfo(res);
    });
  }, [isElectron, selectedDevice]);

  useEffect(() => {
    if (!isElectron || !selectedDevice) { setFiles([]); return; }
    setIsLoadingFiles(true);
    setSelectedFiles(new Set());
    window.electronAPI.listFiles(selectedDevice.serial, currentPath)
      .then((res) => {
        if ('error' in res) {
          setError(res.error);
          setFiles([]);
        } else {
          setFiles(res.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          }));
          setError(null);
        }
      })
      .finally(() => setIsLoadingFiles(false));
  }, [isElectron, selectedDevice, currentPath]);

  useEffect(() => {
    if (!isElectron) return;
    const cleanup = window.electronAPI.onTransferProgress(({ remotePath, bytesTransferred }: { remotePath: string; bytesTransferred: number }) => {
      setTransfers(prev => prev.map(t =>
        t.remotePath === remotePath
          ? { ...t, progress: t.size > 0 ? Math.round((bytesTransferred / t.size) * 100) : 50 }
          : t
      ));
    });
    return cleanup;
  }, [isElectron]);

  const handleNavigate = (folder: RemoteFile) => {
    if (!folder.isDirectory) return;
    setCurrentPath(prev => `${prev}/${folder.name}`.replace('//', '/'));
  };

  const handleGoUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length <= 3) { setCurrentPath('/storage/emulated/0'); return; }
    parts.pop();
    setCurrentPath('/' + parts.join('/'));
  };

  const toggleSelectFile = (filePath: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath); else next.add(filePath);
      return next;
    });
  };

  const handleTransferSelected = async () => {
    if (!isElectron || !selectedDevice || selectedFiles.size === 0) return;
    setShowTransferPanel(true);

    const filesToTransfer = files.filter(f => {
      const fullPath = `${currentPath}/${f.name}`.replace('//', '/');
      return selectedFiles.has(fullPath) && f.isFile;
    });

    const newItems: TransferItem[] = filesToTransfer.map(f => ({
      id: crypto.randomUUID(),
      serial: selectedDevice.serial,
      remotePath: `${currentPath}/${f.name}`.replace('//', '/'),
      fileName: f.name,
      size: f.size,
      status: 'queued',
      progress: 0,
    }));

    setTransfers(prev => [...newItems, ...prev]);
    setSelectedFiles(new Set());

    for (const item of newItems) {
      setTransfers(prev => prev.map(t => t.id === item.id ? { ...t, status: 'transferring' } : t));
      const result = await window.electronAPI.transferFile(item.serial, item.remotePath, item.fileName, savePath);
      if ('error' in result) {
        setTransfers(prev => prev.map(t => t.id === item.id ? { ...t, status: 'error', error: result.error } : t));
      } else {
        setTransfers(prev => prev.map(t => t.id === item.id ? { ...t, status: 'done', progress: 100, destPath: result.destPath } : t));
        if (item.fileName.toLowerCase().endsWith('.csv') && result.destPath) {
          setEcgFilePath(result.destPath);
          setEcgFileName(item.fileName);
          setView('ecg');
        }
      }
    }
  };

  const handleChangeSavePath = async () => {
    if (!isElectron) return;
    const result = await window.electronAPI.pickSaveFolder();
    if (result) setSavePath(result);
  };

  const tabs: { id: TransportMode; label: string; icon: string }[] = [
    { id: 'usb', label: 'USB', icon: '🔌' },
    { id: 'wifi', label: 'WiFi', icon: '📶' },
    { id: 'bluetooth', label: 'Bluetooth', icon: '🔵' },
  ];

  if (view === 'ecg') {
    return (
      <div className="flex flex-col h-screen bg-surface-0 text-white overflow-hidden">
        <Header
          savePath={savePath}
          onChangeSavePath={handleChangeSavePath}
          onOpenSaveFolder={() => window.electronAPI?.openSaveFolder(savePath)}
          transferCount={transfers.filter(t => t.status === 'done').length}
          onToggleTransferPanel={() => setShowTransferPanel(p => !p)}
          showTransferPanel={showTransferPanel}
        />
        <div className="flex-1 overflow-hidden">
          <ECGViewer filePath={ecgFilePath} fileName={ecgFileName} onBack={() => setView('transfer')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-white overflow-hidden">
      <Header
        savePath={savePath}
        onChangeSavePath={handleChangeSavePath}
        onOpenSaveFolder={() => window.electronAPI?.openSaveFolder(savePath)}
        transferCount={transfers.filter(t => t.status === 'done').length}
        onToggleTransferPanel={() => setShowTransferPanel(p => !p)}
        showTransferPanel={showTransferPanel}
      />

      <div className="flex items-center gap-1 px-4 py-2 bg-surface-1 border-b border-border shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTransport(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              transport === t.id ? 'bg-accent text-white' : 'text-muted hover:text-white hover:bg-surface-3'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {transport === 'usb' && (
          <Sidebar
            devices={devices}
            selectedDevice={selectedDevice}
            deviceInfo={deviceInfo}
            isLoading={isLoadingDevices}
            onSelectDevice={(d) => { setSelectedDevice(d); setCurrentPath('/storage/emulated/0'); }}
            onRefresh={refreshDevices}
            error={error}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden border-l border-border">
          {transport === 'wifi' && <WifiPanel />}
          {transport === 'bluetooth' && <BluetoothPanel />}
          {transport === 'usb' && (
            <>
              {/* USB sub-tabs */}
              <div className="flex items-center gap-1 px-3 py-2 bg-surface-2 border-b border-border shrink-0">
                <button
                  onClick={() => setUsbSub('files')}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${usbSub === 'files' ? 'bg-accent text-white' : 'text-muted hover:text-white hover:bg-surface-3'}`}
                >
                  📁 File Browser
                </button>
                <button
                  onClick={() => setUsbSub('live')}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${usbSub === 'live' ? 'bg-accent text-white' : 'text-muted hover:text-white hover:bg-surface-3'}`}
                >
                  ⚡ Live Send
                </button>
              </div>

              {usbSub === 'live' && <UsbLivePanel selectedDevice={selectedDevice} />}
              {usbSub === 'files' && selectedDevice && (
                <FileBrowser
                  files={files}
                  currentPath={currentPath}
                  isLoading={isLoadingFiles}
                  selectedFiles={selectedFiles}
                  onNavigate={handleNavigate}
                  onGoUp={handleGoUp}
                  onToggleSelect={toggleSelectFile}
                  onTransfer={handleTransferSelected}
                  error={error}
                />
              )}
              {usbSub === 'files' && !selectedDevice && (
                <EmptyState hasDevices={devices.length > 0} error={error} onRefresh={refreshDevices} />
              )}
            </>
          )}
        </main>

        {showTransferPanel && (
          <TransferQueue
            transfers={transfers}
            savePath={savePath}
            onOpenFolder={() => window.electronAPI?.openSaveFolder(savePath)}
            onClose={() => setShowTransferPanel(false)}
            onClear={() => setTransfers(prev => prev.filter(t => t.status !== 'done'))}
          />
        )}
      </div>
    </div>
  );
}
