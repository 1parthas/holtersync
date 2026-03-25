'use client';

import { useState } from 'react';
import { Smartphone, RefreshCw, AlertCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { AdbDevice, DeviceInfo } from '@/types';

interface Props {
  devices: AdbDevice[];
  selectedDevice: AdbDevice | null;
  deviceInfo: DeviceInfo | null;
  isLoading: boolean;
  onSelectDevice: (d: AdbDevice) => void;
  onRefresh: () => void;
  error: string | null;
}

export default function Sidebar({ devices, selectedDevice, deviceInfo, isLoading, onSelectDevice, onRefresh, error }: Props) {
  return (
    <aside className="w-64 flex flex-col bg-surface-1 border-r border-border overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">Devices</span>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 rounded hover:bg-surface-3 transition-colors text-muted hover:text-white"
          title="Refresh devices"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Device list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && devices.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Scanning...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="p-3">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center">
                <WifiOff className="w-5 h-5 text-muted" />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">No devices found</p>
                <p className="text-[11px] text-subtle mt-1">Connect via USB & enable debugging</p>
              </div>
            </div>
          </div>
        ) : (
          devices.map((device) => (
            <button
              key={device.serial}
              onClick={() => onSelectDevice(device)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all mb-1 ${
                selectedDevice?.serial === device.serial
                  ? 'bg-accent/20 border border-accent/40 text-white'
                  : 'hover:bg-surface-3 border border-transparent text-muted hover:text-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                selectedDevice?.serial === device.serial ? 'bg-accent/30' : 'bg-surface-3'
              }`}>
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">
                  {deviceInfo && selectedDevice?.serial === device.serial
                    ? `${deviceInfo.manufacturer} ${deviceInfo.model}`
                    : device.serial}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    device.type === 'device' ? 'bg-success' :
                    device.type === 'unauthorized' ? 'bg-warning' : 'bg-danger'
                  }`} />
                  <span className="text-[10px] text-subtle capitalize">{device.type}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Device info panel */}
      {selectedDevice && deviceInfo && (
        <div className="p-3 border-t border-border space-y-2">
          <div className="bg-surface-2 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-3.5 h-3.5 text-success" />
              <span className="text-[11px] text-success font-medium">Connected</span>
            </div>
            {[
              { label: 'Model', value: deviceInfo.model },
              { label: 'Brand', value: deviceInfo.manufacturer },
              { label: 'Android', value: deviceInfo.androidVersion },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-[10px] text-subtle">{label}</span>
                <span className="text-[10px] text-muted truncate max-w-[100px]">{value}</span>
              </div>
            ))}
          </div>
          <WifiAdbButton serial={selectedDevice.serial} />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-3 border-t border-danger/30">
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 text-danger mt-0.5 shrink-0" />
            <p className="text-[10px] text-danger leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </aside>
  );
}

function WifiAdbButton({ serial }: { serial: string }) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const handleEnable = async () => {
    if (!isElectron) return;
    setLoading(true);
    const r = await window.electronAPI.wifiAdbEnable(serial);
    setLoading(false);
    if ('error' in r) setMsg(`Error: ${r.error}`);
    else {
      // Get phone IP automatically
      const ipR = await window.electronAPI.wifiGetPhoneIp(serial);
      const ip = 'ip' in ipR ? ipR.ip : null;
      setMsg(ip ? `WiFi ADB ready. Phone IP: ${ip}` : r.message);
    }
  };

  return (
    <div>
      <button onClick={handleEnable} disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-surface-3 hover:bg-surface-4 border border-border hover:border-accent/50 rounded-lg text-[11px] text-muted hover:text-white transition-all">
        <Wifi className="w-3 h-3" />
        {loading ? 'Enabling...' : 'Enable WiFi ADB'}
      </button>
      {msg && <p className={`text-[10px] mt-1.5 leading-relaxed ${msg.startsWith('Error') ? 'text-danger' : 'text-success'}`}>{msg}</p>}
    </div>
  );
}
