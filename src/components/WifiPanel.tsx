'use client';

import { useEffect, useState, useRef } from 'react';
import { Wifi, QrCode, Copy, Check, Smartphone, MessageSquare, FileIcon, RefreshCw, Loader2, Link } from 'lucide-react';

interface WifiInfo {
  ip: string; port: number; url: string; active: boolean; clients: number;
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

export default function WifiPanel() {
  const [info, setInfo] = useState<WifiInfo | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [clients, setClients] = useState(0);
  const [adbIp, setAdbIp] = useState('');
  const [adbMsg, setAdbMsg] = useState('');
  const [tab, setTab] = useState<'live' | 'adb'>('live');
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.wifiGetInfo().then((i: WifiInfo) => { setInfo(i); setClients(i.clients); });
    window.electronAPI.wifiGetQR().then((r: any) => { if (r.dataUrl) setQr(r.dataUrl); });

    const c1 = window.electronAPI.onWifiData((msg: any) => {
      setItems(prev => [{ ...msg, id: crypto.randomUUID() }, ...prev].slice(0, 100));
    });
    const c2 = window.electronAPI.onWifiClientChanged((d: any) => setClients(d.count));
    return () => { c1(); c2(); };
  }, [isElectron]);

  const copy = () => {
    if (!info) return;
    navigator.clipboard.writeText(info.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdbConnect = async () => {
    if (!adbIp || !isElectron) return;
    setAdbMsg('Connecting...');
    const r = await window.electronAPI.wifiAdbConnect(adbIp);
    setAdbMsg('error' in r ? `Error: ${r.error}` : r.message);
  };

  const downloadFile = (item: ReceivedItem) => {
    if (!item.data) return;
    const a = document.createElement('a');
    a.href = item.data;
    a.download = item.name || 'received-file';
    a.click();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Wifi className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-white">WiFi Transfer</span>
          <span className={`ml-auto flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
            clients > 0 ? 'bg-success/20 text-success' : 'bg-surface-3 text-muted'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${clients > 0 ? 'bg-success animate-pulse' : 'bg-muted'}`} />
            {clients > 0 ? `${clients} device connected` : 'Waiting for device'}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          {(['live', 'adb'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                tab === t ? 'bg-accent text-white' : 'text-muted hover:text-white hover:bg-surface-3'
              }`}>
              {t === 'live' ? 'Live Receiver' : 'ADB over WiFi'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'live' ? (
          <>
            {/* QR + URL */}
            <div className="bg-surface-2 border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-3 font-medium">
                Scan with Android — opens in browser, no app needed
              </p>
              <div className="flex items-start gap-4">
                {qr ? (
                  <img src={qr} alt="QR Code" className="w-24 h-24 rounded-lg shrink-0" />
                ) : (
                  <div className="w-24 h-24 bg-surface-3 rounded-lg flex items-center justify-center shrink-0">
                    <Loader2 className="w-5 h-5 text-muted animate-spin" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted mb-1">URL to open on phone</p>
                  <div className="flex items-center gap-2 bg-surface-3 rounded-lg px-3 py-2">
                    <span className="text-xs text-accent font-mono truncate flex-1">{info?.url || '...'}</span>
                    <button onClick={copy} className="text-muted hover:text-white transition-colors shrink-0">
                      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-subtle mt-2 leading-relaxed">
                    Phone and PC must be on same WiFi network. Open URL in Chrome/Safari on Android.
                  </p>
                </div>
              </div>
            </div>

            {/* Received data */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Received Data</span>
                {items.length > 0 && (
                  <button onClick={() => setItems([])} className="text-[10px] text-muted hover:text-danger transition-colors">
                    Clear
                  </button>
                )}
              </div>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted gap-2">
                  <MessageSquare className="w-8 h-8 text-subtle" />
                  <p className="text-xs">Nothing received yet</p>
                  <p className="text-[10px] text-subtle">Open the URL on your phone and send text or files</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className={`p-3 rounded-lg border ${
                      item.type === 'text'
                        ? 'bg-accent/5 border-accent/20'
                        : 'bg-success/5 border-success/20'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {item.type === 'text'
                            ? <MessageSquare className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                            : <FileIcon className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                          }
                          <div className="min-w-0">
                            {item.type === 'text' ? (
                              <p className="text-xs text-white leading-relaxed break-words">{item.payload}</p>
                            ) : (
                              <div>
                                <p className="text-xs text-white font-medium">{item.name}</p>
                                <p className="text-[10px] text-muted">{item.size ? `${(item.size/1024).toFixed(1)} KB` : ''}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-subtle">
                            {new Date(item.ts).toLocaleTimeString()}
                          </span>
                          {item.type === 'file' && item.data && (
                            <button onClick={() => downloadFile(item)}
                              className="text-[10px] text-success hover:underline">
                              Save
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ADB over WiFi tab */
          <div className="space-y-4">
            <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Link className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold text-white">ADB over WiFi</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Connect your Android wirelessly — same file browser as USB, no cable needed after setup.
              </p>

              <div className="bg-surface-3 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Steps</p>
                {[
                  'Connect phone via USB first',
                  'In USB tab, select your device and click "Enable WiFi ADB"',
                  'Disconnect USB cable',
                  'Enter phone IP below and click Connect',
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                    <span className="text-[11px] text-muted">{s}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">Phone IP Address</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adbIp}
                    onChange={e => setAdbIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-subtle outline-none focus:border-accent"
                  />
                  <button onClick={handleAdbConnect}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors">
                    Connect
                  </button>
                </div>
                {adbMsg && (
                  <p className={`text-[11px] mt-2 ${adbMsg.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
                    {adbMsg}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-surface-2 border border-border rounded-xl p-4">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Find your phone IP</p>
              <p className="text-[11px] text-muted leading-relaxed">
                On Android: <span className="text-white">Settings → About Phone → Status → IP Address</span>
              </p>
              <p className="text-[11px] text-muted mt-1">
                Or: <span className="text-white">Settings → WiFi → tap network name → IP Address</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
