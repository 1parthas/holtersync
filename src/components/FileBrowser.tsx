'use client';

import { useState } from 'react';
import {
  Folder, File, Image, Music, Video, FileText, Archive,
  ChevronRight, ArrowUp, Download, Loader2, CheckSquare, Square,
  AlertCircle
} from 'lucide-react';
import { RemoteFile } from '@/types';

interface Props {
  files: RemoteFile[];
  currentPath: string;
  isLoading: boolean;
  selectedFiles: Set<string>;
  onNavigate: (file: RemoteFile) => void;
  onGoUp: () => void;
  onToggleSelect: (filePath: string) => void;
  onTransfer: () => void;
  error: string | null;
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <Folder className="w-4 h-4 text-yellow-400" />;
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(ext || '')) return <Image className="w-4 h-4 text-pink-400" />;
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', '3gp'].includes(ext || '')) return <Video className="w-4 h-4 text-blue-400" />;
  if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'].includes(ext || '')) return <Music className="w-4 h-4 text-purple-400" />;
  if (['pdf', 'doc', 'docx', 'txt', 'xlsx', 'pptx'].includes(ext || '')) return <FileText className="w-4 h-4 text-green-400" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return <Archive className="w-4 h-4 text-orange-400" />;
  return <File className="w-4 h-4 text-muted" />;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

export default function FileBrowser({ files, currentPath, isLoading, selectedFiles, onNavigate, onGoUp, onToggleSelect, onTransfer, error }: Props) {
  const [view, setView] = useState<'list' | 'grid'>('list');

  const pathParts = currentPath.split('/').filter(Boolean);
  const canGoUp = currentPath !== '/storage/emulated/0' && pathParts.length > 0;

  const allFileKeys = files.filter(f => f.isFile).map(f => `${currentPath}/${f.name}`.replace('//', '/'));
  const allSelected = allFileKeys.length > 0 && allFileKeys.every(k => selectedFiles.has(k));

  const toggleSelectAll = () => {
    if (allSelected) {
      allFileKeys.forEach(k => { if (selectedFiles.has(k)) onToggleSelect(k); });
    } else {
      allFileKeys.forEach(k => { if (!selectedFiles.has(k)) onToggleSelect(k); });
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-1 shrink-0">
        {/* Breadcrumb */}
        <button
          onClick={onGoUp}
          disabled={!canGoUp}
          className={`p-1.5 rounded transition-colors ${canGoUp ? 'hover:bg-surface-3 text-muted hover:text-white' : 'text-subtle cursor-not-allowed'}`}
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1 text-xs text-muted flex-1 min-w-0">
          <span className="text-subtle shrink-0">Internal Storage</span>
          {pathParts.slice(3).map((part, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3 h-3 text-subtle" />
              <span className={i === pathParts.length - 2 ? 'text-white' : 'text-muted'}>{part}</span>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedFiles.size > 0 && (
            <button
              onClick={onTransfer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover rounded-lg text-xs font-medium transition-all text-white shadow-lg shadow-accent/20"
            >
              <Download className="w-3.5 h-3.5" />
              Transfer {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading files...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted">
            <AlertCircle className="w-8 h-8 text-danger" />
            <p className="text-sm text-center max-w-xs">{error}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
            <Folder className="w-8 h-8 text-subtle" />
            <p className="text-sm">Empty folder</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-1/50 sticky top-0">
                <th className="w-10 px-3 py-2.5">
                  <button onClick={toggleSelectAll} className="text-muted hover:text-white transition-colors">
                    {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-accent" /> : <Square className="w-3.5 h-3.5" />}
                  </button>
                </th>
                <th className="text-left font-medium text-subtle py-2.5 pr-3">Name</th>
                <th className="text-right font-medium text-subtle py-2.5 px-4 w-24">Size</th>
                <th className="text-right font-medium text-subtle py-2.5 px-4 w-32 hidden md:table-cell">Modified</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const filePath = `${currentPath}/${file.name}`.replace('//', '/');
                const isSelected = selectedFiles.has(filePath);
                return (
                  <tr
                    key={file.name}
                    className={`border-b border-border/50 transition-colors group cursor-pointer ${
                      isSelected ? 'bg-accent/10' : 'hover:bg-surface-2'
                    }`}
                    onClick={() => {
                      if (file.isDirectory) onNavigate(file);
                      else onToggleSelect(filePath);
                    }}
                  >
                    <td className="px-3 py-2.5">
                      {file.isFile && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleSelect(filePath); }}
                          className="text-muted hover:text-white transition-colors"
                        >
                          {isSelected
                            ? <CheckSquare className="w-3.5 h-3.5 text-accent" />
                            : <Square className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                          }
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(file.name, file.isDirectory)}
                        <span className={`truncate max-w-xs ${file.isDirectory ? 'text-white font-medium' : 'text-white/90'}`}>
                          {file.name}
                        </span>
                        {file.isDirectory && <ChevronRight className="w-3 h-3 text-subtle opacity-0 group-hover:opacity-100" />}
                      </div>
                    </td>
                    <td className="text-right text-muted py-2.5 px-4 tabular-nums">
                      {file.isFile ? formatSize(file.size) : '—'}
                    </td>
                    <td className="text-right text-muted py-2.5 px-4 hidden md:table-cell">
                      {formatDate(file.mtime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-1 text-[10px] text-subtle shrink-0">
        <span>{files.length} item{files.length !== 1 ? 's' : ''} · {files.filter(f => f.isDirectory).length} folders, {files.filter(f => f.isFile).length} files</span>
        {selectedFiles.size > 0 && (
          <span className="text-accent font-medium">{selectedFiles.size} selected</span>
        )}
      </div>
    </div>
  );
}
