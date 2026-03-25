'use client';

import { FolderOpen, Download, ChevronRight, Activity } from 'lucide-react';

interface Props {
  savePath: string;
  onChangeSavePath: () => void;
  onOpenSaveFolder: () => void;
  transferCount: number;
  onToggleTransferPanel: () => void;
  showTransferPanel: boolean;
}

export default function Header({ savePath, onChangeSavePath, onOpenSaveFolder, transferCount, onToggleTransferPanel, showTransferPanel }: Props) {
  const folderName = savePath ? savePath.split('/').pop() || savePath : '~/Downloads/USB Transfer';

  return (
    <header className="drag-region flex items-center justify-between px-4 py-3 bg-surface-1 border-b border-border" style={{ paddingLeft: '80px' }}>
      <div className="flex items-center gap-2 no-drag">
        <div className="flex items-center gap-1.5" style={{ color: '#00ff88' }}>
          <Activity className="w-4 h-4" />
          <span className="text-sm font-semibold text-white">HolterSync</span>
        </div>
      </div>

      <div className="flex items-center gap-3 no-drag">
        {/* Save path indicator */}
        <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-3 py-1.5 border border-border">
          <FolderOpen className="w-3.5 h-3.5 text-muted" />
          <span className="text-xs text-muted max-w-[200px] truncate">{folderName}</span>
          <button
            onClick={onChangeSavePath}
            className="text-xs text-accent hover:text-accent-light transition-colors ml-1"
          >
            Change
          </button>
          <button
            onClick={onOpenSaveFolder}
            className="text-xs text-muted hover:text-white transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Transfer panel toggle */}
        <button
          onClick={onToggleTransferPanel}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            showTransferPanel
              ? 'bg-accent text-white border-accent'
              : 'bg-surface-2 text-muted border-border hover:text-white hover:border-accent/50'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Transfers</span>
          {transferCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-success text-white text-[9px] rounded-full flex items-center justify-center font-bold">
              {transferCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
