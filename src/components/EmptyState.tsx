'use client';

import { Usb, RefreshCw, AlertCircle, Smartphone } from 'lucide-react';

interface Props {
  hasDevices: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function EmptyState({ hasDevices, error, onRefresh }: Props) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 p-8 animate-fade-in">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
          {error ? (
            <AlertCircle className="w-10 h-10 text-danger/70" />
          ) : (
            <Usb className="w-10 h-10 text-accent/70" />
          )}
        </div>
        {!error && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-surface-3 rounded-lg border border-border flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-muted" />
          </div>
        )}
      </div>

      <div className="text-center max-w-sm">
        <h2 className="text-base font-semibold text-white mb-2">
          {error ? 'ADB Not Found' : hasDevices ? 'Select a Device' : 'Connect Your Android'}
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          {error
            ? 'Make sure ADB is installed. Run: brew install android-platform-tools'
            : hasDevices
            ? 'Select a device from the sidebar to browse its files.'
            : 'Connect your Android phone via USB and enable USB Debugging to get started.'}
        </p>
      </div>

      {!hasDevices && !error && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 w-full max-w-sm space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Setup steps</p>
          {[
            'Connect Android via USB cable',
            'Go to Settings → About Phone',
            'Tap Build Number 7 times',
            'Go to Developer Options → Enable USB Debugging',
            'Accept the RSA key prompt on your phone',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-xs text-muted leading-relaxed">{step}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border hover:border-accent/50 rounded-lg text-xs text-muted hover:text-white transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Refresh devices
      </button>
    </div>
  );
}
