'use client';

import { CheckCircle2, XCircle, Loader2, Clock, FolderOpen, X, Trash2 } from 'lucide-react';
import { TransferItem } from '@/types';

interface Props {
  transfers: TransferItem[];
  savePath: string;
  onOpenFolder: () => void;
  onClose: () => void;
  onClear: () => void;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TransferQueue({ transfers, savePath, onOpenFolder, onClose, onClear }: Props) {
  const done = transfers.filter(t => t.status === 'done').length;
  const total = transfers.length;
  const hasActive = transfers.some(t => t.status === 'transferring');

  return (
    <div className="w-80 flex flex-col bg-surface-1 border-l border-border animate-slide-up overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-xs font-semibold text-white">Transfers</h3>
          <p className="text-[10px] text-muted mt-0.5">
            {done}/{total} complete{hasActive ? ' · transferring...' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {done > 0 && (
            <button onClick={onClear} className="p-1.5 rounded hover:bg-surface-3 transition-colors text-muted hover:text-white" title="Clear completed">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-3 transition-colors text-muted hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transfer list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted gap-2">
            <Clock className="w-6 h-6 text-subtle" />
            <p className="text-xs">No transfers yet</p>
          </div>
        ) : (
          transfers.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border transition-colors ${
                item.status === 'done' ? 'bg-success/5 border-success/20' :
                item.status === 'error' ? 'bg-danger/5 border-danger/20' :
                item.status === 'transferring' ? 'bg-accent/5 border-accent/20' :
                'bg-surface-2 border-border'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {item.status === 'error' && <XCircle className="w-4 h-4 text-danger" />}
                  {item.status === 'transferring' && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                  {item.status === 'queued' && <Clock className="w-4 h-4 text-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate font-medium">{item.fileName}</p>
                  <p className="text-[10px] text-muted mt-0.5">{formatSize(item.size)}</p>
                  {item.status === 'transferring' && (
                    <div className="mt-2">
                      <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-accent mt-1">{item.progress}%</p>
                    </div>
                  )}
                  {item.status === 'error' && (
                    <p className="text-[10px] text-danger mt-1 leading-relaxed">{item.error}</p>
                  )}
                  {item.status === 'done' && (
                    <p className="text-[10px] text-success mt-1">Saved successfully</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={onOpenFolder}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-muted hover:text-white transition-all border border-border hover:border-accent/50"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Open save folder
        </button>
      </div>
    </div>
  );
}
