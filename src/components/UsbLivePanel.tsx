'use client';

import { useEffect, useState } from 'react';
import { Usb, Copy, Check, MessageSquare, FileIcon, Loader2, Zap, Activity } from 'lucide-react';
import { AdbDevice } from '@/types';
import UsbECGGraph from './UsbECGGraph';

const SAMPLE_ECG_OBJECT = {
  type: 'ecg',
  bpm: 75,
  amplitude: 1.0,
  noise: 0.02,
};

interface ECGParams {
  bpm: number;
  amplitude: number;
  noise: number;
}

interface ReceivedItem {
  id: string;
  type: 'text' | 'file';
  payload?: string;
  name?: string;
  size?: number;
  data?: string;
  ts: number;
}

interface Props {
  selectedDevice: AdbDevice | null;
}

export default function UsbLivePanel({ selectedDevice }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState('http://localhost:8766');
  const [clients, setClients] = useState(0);
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [ecgParams, setEcgParams] = useState<ECGParams | null>(null);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // Setup ADB reverse and get QR when device connects
  useEffect(() => {
    if (!isElectron) return;
    setSetupDone(false);
    setQr(null);

    if (!selectedDevice) return;

    window.electronAPI.usbLiveGetQR(selectedDevice.serial).then((r: any) => {
      if (r.dataUrl) { setQr(r.dataUrl); setSetupDone(true); }
      if (r.url) setUrl(r.url);
    });

    window.electronAPI.usbLiveGetInfo().then((info: any) => {
      setClients(info.clients);
    });
  }, [isElectron, selectedDevice?.serial]);

  // Listen for incoming data
  useEffect(() => {
    if (!isElectron) return;
    const c1 = window.electronAPI.onUsbLiveData((msg: any) => {
      setItems(prev => [{ ...msg, id: crypto.randomUUID() }, ...prev].slice(0, 100));
      // Check if the payload is an ECG object
      if (msg.type === 'text' && msg.payload) {
        try {
          const parsed = JSON.parse(msg.payload);
          if (parsed.type === 'ecg') {
            const bpm = Math.max(20, Math.min(250, Number(parsed.bpm) || 75));
            const amplitude = Math.max(0.1, Math.min(5, Number(parsed.amplitude) || 1.0));
            const noise = Math.max(0, Math.min(1, Number(parsed.noise) ?? 0.02));
            setEcgParams({ bpm, amplitude, noise });
          }
        } catch (_) {}
      }
    });
    const c2 = window.electronAPI.onUsbLiveClientChanged((d: any) => setClients(d.count));
    return () => { c1(); c2(); };
  }, [isElectron]);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySample = () => {
    navigator.clipboard.writeText(JSON.stringify(SAMPLE_ECG_OBJECT, null, 2));
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const downloadFile = (item: ReceivedItem) => {
    if (!item.data) return;
    const a = document.createElement('a');
    a.href = item.data;
    a.download = item.name || 'file';
    a.click();
  };

  const retrySetup = () => {
    if (!isElectron || !selectedDevice) return;
    setSetupDone(false);
    window.electronAPI.usbLiveSetupReverse(selectedDevice.serial).then(() => {
      window.electronAPI.usbLiveGetQR(selectedDevice.serial).then((r: any) => {
        if (r.dataUrl) { setQr(r.dataUrl); setSetupDone(true); }
      });
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-white">USB Live Transfer</span>
          </div>
          <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full ${
            clients > 0 ? 'bg-success/20 text-success' : 'bg-surface-3 text-muted'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${clients > 0 ? 'bg-success animate-pulse' : 'bg-muted'}`} />
            {clients > 0 ? `${clients} phone connected` : 'Waiting for phone'}
          </span>
        </div>
        <p className="text-[10px] text-muted mt-1">Phone sends data through USB cable — no WiFi needed</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!selectedDevice ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
            <Usb className="w-10 h-10 text-subtle" />
            <p className="text-sm">Connect a device via USB first</p>
            <p className="text-xs text-subtle">Select your phone from the device list on the left</p>
          </div>
        ) : (
          <>
            {/* QR + instructions */}
            <div className="bg-surface-2 border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-white mb-1">Scan on your Android phone</p>
              <p className="text-[11px] text-muted mb-4">
                Opens in Chrome — connects through USB cable via port forwarding
              </p>

              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {qr ? (
                    <div className="p-2 bg-[#0a0a0a] rounded-xl border border-accent/30">
                      <img src={qr} alt="QR" className="w-28 h-28 rounded" />
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-surface-3 rounded-xl flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-muted animate-spin" />
                      <span className="text-[10px] text-muted">Setting up USB...</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-[10px] text-muted mb-1.5">URL (open on phone)</p>
                    <div className="flex items-center gap-2 bg-surface-3 rounded-lg px-3 py-2">
                      <span className="text-xs text-accent font-mono flex-1 truncate">{url}</span>
                      <button onClick={copy} className="text-muted hover:text-white shrink-0">
                        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { n: '1', t: 'Scan QR or open URL on phone' },
                      { n: '2', t: 'Wait for purple dot → Connected' },
                      { n: '3', t: 'Type message → Send to PC' },
                    ].map(s => (
                      <div key={s.n} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex items-center justify-center shrink-0">{s.n}</span>
                        <span className="text-[11px] text-muted">{s.t}</span>
                      </div>
                    ))}
                  </div>

                  {setupDone && (
                    <button onClick={retrySetup} className="text-[10px] text-muted hover:text-accent transition-colors">
                      ↺ Re-setup USB tunnel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* How it works note */}
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
              <p className="text-[10px] text-accent font-semibold mb-1">⚡ How this works</p>
              <p className="text-[11px] text-muted leading-relaxed">
                <span className="text-white">adb reverse</span> tunnels the phone's{' '}
                <span className="text-white font-mono">localhost:8766</span> → your Mac's port 8766 through the USB cable.
                The phone browser connects via WebSocket over USB — zero WiFi required.
              </p>
            </div>

            {/* ECG Live Graph */}
            <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#00ff88]" />
                  <span className="text-xs font-semibold text-white">ECG Live Graph</span>
                </div>
                {ecgParams ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#00ff88] font-mono">{ecgParams.bpm} bpm</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                  </div>
                ) : (
                  <span className="text-[10px] text-muted">Send ECG object to start</span>
                )}
              </div>
              <div className="p-2" style={{ background: '#0a1a0a' }}>
                {ecgParams ? (
                  <UsbECGGraph params={ecgParams} />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2" style={{ height: 140 }}>
                    <Activity className="w-6 h-6 text-subtle" />
                    <p className="text-xs text-muted">Waiting for ECG data...</p>
                    <p className="text-[10px] text-subtle">Send the sample object from your phone</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sample ECG Object */}
            <div className="bg-surface-2 border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white font-semibold">Sample ECG Object</span>
                <button
                  onClick={copySample}
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-accent transition-colors"
                >
                  {copiedSample
                    ? <><Check className="w-3 h-3 text-success" /> Copied!</>
                    : <><Copy className="w-3 h-3" /> Copy</>
                  }
                </button>
              </div>
              <p className="text-[10px] text-muted mb-2 leading-relaxed">
                Copy this, edit values on your phone, and send — the graph updates instantly.
                Change <span className="text-accent font-mono">bpm</span>,{' '}
                <span className="text-accent font-mono">amplitude</span>, or{' '}
                <span className="text-accent font-mono">noise</span>.
              </p>
              <pre className="text-[11px] font-mono text-[#00ff88] bg-[#0a1a0a] rounded-lg p-3 leading-relaxed border border-[#1a3a1a] overflow-x-auto">
                {JSON.stringify(SAMPLE_ECG_OBJECT, null, 2)}
              </pre>
              <div className="mt-2 space-y-1">
                {[
                  { key: 'bpm', range: '20–250', desc: 'Heart rate — changes wave frequency' },
                  { key: 'amplitude', range: '0.1–5.0', desc: 'Signal strength — taller/shorter peaks' },
                  { key: 'noise', range: '0–1', desc: 'Baseline noise — 0 = clean, 0.5 = noisy' },
                ].map(({ key, range, desc }) => (
                  <div key={key} className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-accent shrink-0 w-20">{key}</span>
                    <span className="text-[10px] text-subtle shrink-0 w-14">{range}</span>
                    <span className="text-[10px] text-muted">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Received data */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Received from phone
                </span>
                {items.length > 0 && (
                  <button onClick={() => setItems([])} className="text-[10px] text-muted hover:text-danger transition-colors">
                    Clear
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted">
                  <MessageSquare className="w-7 h-7 text-subtle" />
                  <p className="text-xs">Nothing received yet</p>
                  <p className="text-[10px] text-subtle">Type on your phone and tap Send</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className={`p-3 rounded-lg border ${
                      item.type === 'text' ? 'bg-accent/5 border-accent/20' : 'bg-success/5 border-success/20'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {item.type === 'text'
                            ? <MessageSquare className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                            : <FileIcon className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                          }
                          <div className="min-w-0">
                            {item.type === 'text' ? (
                              <p className="text-sm text-white leading-relaxed break-words">{item.payload}</p>
                            ) : (
                              <div>
                                <p className="text-xs text-white font-medium">{item.name}</p>
                                <p className="text-[10px] text-muted">{item.size ? `${(item.size / 1024).toFixed(1)} KB` : ''}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] text-subtle">{new Date(item.ts).toLocaleTimeString()}</span>
                          <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">USB</span>
                          {item.type === 'file' && item.data && (
                            <button onClick={() => downloadFile(item)} className="text-[10px] text-success hover:underline">Save</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
