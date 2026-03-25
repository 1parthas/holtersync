'use client';

import { useEffect, useState } from 'react';
import { Bluetooth, RefreshCw, MessageSquare, FileIcon, Play, Square, AlertCircle, Loader2 } from 'lucide-react';

interface ReceivedItem {
  id: string;
  type: 'text' | 'file';
  payload?: string;
  ts: number;
}

interface SerialPort { path: string; manufacturer: string; }

export default function BluetoothPanel() {
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [serialPorts, setSerialPorts] = useState<SerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState('/dev/tty.Bluetooth-Incoming-Port');
  const [listening, setListening] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedPath, setConnectedPath] = useState('');
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [macAddress, setMacAddress] = useState('');

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    // Load mac BT address + paired devices + serial ports
    window.electronAPI.btGetMacAddress().then((r: any) => { if (r.address) setMacAddress(r.address); });
    window.electronAPI.btListDevices().then((r: any) => { if (Array.isArray(r)) setPairedDevices(r); });
    refreshPorts();

    const c1 = window.electronAPI.onBtData((msg: any) => {
      setItems(prev => [{ ...msg, id: crypto.randomUUID() }, ...prev].slice(0, 200));
    });
    const c2 = window.electronAPI.onBtConnected((d: any) => {
      setConnected(true); setConnectedPath(d.path); setListening(true); setError('');
    });
    const c3 = window.electronAPI.onBtDisconnected(() => {
      setConnected(false); setListening(false);
    });
    const c4 = window.electronAPI.onBtError((d: any) => {
      setError(d.message); setListening(false); setConnected(false);
    });
    return () => { c1(); c2(); c3(); c4(); };
  }, [isElectron]);

  const refreshPorts = async () => {
    if (!isElectron) return;
    setLoading(true);
    const r = await window.electronAPI.btListSerialPorts();
    setLoading(false);
    if (Array.isArray(r)) {
      setSerialPorts(r);
      const bt = r.find((p: SerialPort) => p.path.toLowerCase().includes('bluetooth'));
      if (bt) setSelectedPort(bt.path);
    }
  };

  const startListening = async () => {
    if (!isElectron) return;
    setError('');
    setListening(true);
    const r = await window.electronAPI.btStartListen(selectedPort);
    if ('error' in r) { setError(r.error); setListening(false); }
  };

  const stopListening = async () => {
    if (!isElectron) return;
    await window.electronAPI.btStopListen();
    setListening(false);
    setConnected(false);
  };

  const btPorts = serialPorts.filter(p => p.path.toLowerCase().includes('bluetooth') || p.path.includes('BT'));
  const allPorts = serialPorts;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Bluetooth Transfer</span>
          </div>
          <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full ${
            connected ? 'bg-success/20 text-success' : listening ? 'bg-blue-400/20 text-blue-300' : 'bg-surface-3 text-muted'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success animate-pulse' : listening ? 'bg-blue-400 animate-pulse' : 'bg-muted'}`} />
            {connected ? 'Phone connected' : listening ? 'Waiting for phone...' : 'Not listening'}
          </span>
        </div>
        {macAddress && <p className="text-[10px] text-muted mt-1">Mac BT: <span className="font-mono text-white">{macAddress}</span></p>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Paired devices */}
        {pairedDevices.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Paired Devices</p>
            {pairedDevices.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-surface-2 border border-border rounded-lg mb-1">
                <div className="w-7 h-7 bg-blue-400/10 rounded-lg flex items-center justify-center">
                  <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium">{d.name || 'Unknown'}</p>
                  <p className="text-[10px] text-subtle font-mono">{d.address}</p>
                </div>
                <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full">Paired</span>
              </div>
            ))}
          </div>
        )}

        {/* Serial port selector + listen button */}
        <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-white">Connect via Bluetooth Serial Port</p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-muted uppercase tracking-wider">Serial Port</label>
              <button onClick={refreshPorts} className="text-[10px] text-muted hover:text-accent flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            <select
              value={selectedPort}
              onChange={e => setSelectedPort(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
            >
              {allPorts.length === 0 && (
                <option value="/dev/tty.Bluetooth-Incoming-Port">/dev/tty.Bluetooth-Incoming-Port</option>
              )}
              {allPorts.map(p => (
                <option key={p.path} value={p.path}>{p.path}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
              <p className="text-[11px] text-danger leading-relaxed">{error}</p>
            </div>
          )}

          <button
            onClick={listening ? stopListening : startListening}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              listening
                ? 'bg-danger/20 border border-danger/40 text-danger hover:bg-danger/30'
                : 'bg-blue-400/20 border border-blue-400/40 text-blue-300 hover:bg-blue-400/30'
            }`}
          >
            {listening
              ? <><Square className="w-3.5 h-3.5" /> Stop Listening</>
              : <><Play className="w-3.5 h-3.5" /> Start Listening</>
            }
          </button>

          {connected && (
            <p className="text-[11px] text-success text-center">
              ✓ Phone connected on {connectedPath}
            </p>
          )}
        </div>

        {/* How to connect */}
        <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">How to send from Android</p>
          {[
            { n: '1', t: 'Install "Serial Bluetooth Terminal" (Play Store, free)' },
            { n: '2', t: 'Open app → tap top-left menu → Devices → select this Mac' },
            { n: '3', t: 'Tap Connect — green indicator appears' },
            { n: '4', t: 'Type text in the terminal → Send → appears here' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-400/20 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
              <span className="text-[11px] text-muted leading-relaxed">{s.t}</span>
            </div>
          ))}
        </div>

        {/* Received data */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Received from phone</span>
            {items.length > 0 && (
              <button onClick={() => setItems([])} className="text-[10px] text-muted hover:text-danger transition-colors">Clear</button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted">
              <MessageSquare className="w-7 h-7 text-subtle" />
              <p className="text-xs">{listening ? 'Waiting for data...' : 'Click Start Listening first'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="p-3 rounded-lg border bg-blue-400/5 border-blue-400/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Bluetooth className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-white leading-relaxed break-words">{item.payload}</p>
                    </div>
                    <span className="text-[9px] text-subtle shrink-0">{new Date(item.ts).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
