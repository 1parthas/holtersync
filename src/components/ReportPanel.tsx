'use client';

import { FileText, Printer, Heart, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { PatientInfo, ArrhythmiaEvent } from '@/types';

interface Props {
  patient: PatientInfo;
  avgHR: number;
  minHR: number;
  maxHR: number;
  arrhythmiaEvents: ArrhythmiaEvent[];
  onSavePDF: () => void;
}

function getArrhythmiaColor(type: string): string {
  if (type === 'Tachycardia') return '#f59e0b';
  if (type === 'Bradycardia') return '#60a5fa';
  return '#00ff88';
}

export default function ReportPanel({ patient, avgHR, minHR, maxHR, arrhythmiaEvents, onSavePDF }: Props) {
  const rhythm =
    avgHR > 100 ? 'Tachycardia' :
    avgHR < 60 ? 'Bradycardia' :
    'Normal Sinus Rhythm';

  const rhythmColor =
    avgHR > 100 ? '#f59e0b' :
    avgHR < 60 ? '#60a5fa' :
    '#00ff88';

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: '#00ff88' }} />
          <h2 className="text-sm font-semibold text-white">Holter Report</h2>
        </div>
        <button
          onClick={onSavePDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border hover:border-[#00ff88]/40 bg-surface-2 hover:bg-surface-3 text-white"
        >
          <Printer className="w-3.5 h-3.5" style={{ color: '#00ff88' }} />
          Save as PDF
        </button>
      </div>

      {/* Patient summary card */}
      <div className="bg-surface-1 border border-border rounded-xl p-4">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-3">Patient Summary</div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-subtle text-[10px] mb-0.5">Name</div>
            <div className="text-white font-medium">{patient.name || 'Unknown'}</div>
          </div>
          <div>
            <div className="text-subtle text-[10px] mb-0.5">Age</div>
            <div className="text-white font-medium">{patient.age || '—'}</div>
          </div>
          <div>
            <div className="text-subtle text-[10px] mb-0.5">Date</div>
            <div className="text-white font-medium">{patient.recordingDate || '—'}</div>
          </div>
          <div>
            <div className="text-subtle text-[10px] mb-0.5">Device</div>
            <div className="text-white font-medium">{patient.deviceId || '—'}</div>
          </div>
          <div>
            <div className="text-subtle text-[10px] mb-0.5">Duration</div>
            <div className="text-white font-medium">{patient.duration || '—'}</div>
          </div>
          <div>
            <div className="text-subtle text-[10px] mb-0.5">Sample Rate</div>
            <div className="text-white font-medium">{patient.sampleRate || '—'}</div>
          </div>
        </div>
      </div>

      {/* HR summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-1 border border-border rounded-xl p-4 flex flex-col items-center gap-1">
          <Heart className="w-4 h-4 mb-1" style={{ color: '#00ff88' }} />
          <div className="text-2xl font-bold" style={{ color: '#00ff88' }}>{avgHR}</div>
          <div className="text-[10px] text-muted">Avg HR (bpm)</div>
          <div className="text-[10px] font-medium mt-1" style={{ color: rhythmColor }}>{rhythm}</div>
        </div>

        <div className="bg-surface-1 border border-border rounded-xl p-4 flex flex-col items-center gap-1">
          <TrendingDown className="w-4 h-4 mb-1 text-blue-400" />
          <div className="text-2xl font-bold text-blue-400">{minHR}</div>
          <div className="text-[10px] text-muted">Min HR (bpm)</div>
          <div className="text-[10px] text-subtle mt-1">Lowest recorded</div>
        </div>

        <div className="bg-surface-1 border border-border rounded-xl p-4 flex flex-col items-center gap-1">
          <TrendingUp className="w-4 h-4 mb-1 text-amber-400" />
          <div className="text-2xl font-bold text-amber-400">{maxHR}</div>
          <div className="text-[10px] text-muted">Max HR (bpm)</div>
          <div className="text-[10px] text-subtle mt-1">Highest recorded</div>
        </div>
      </div>

      {/* Arrhythmia events */}
      <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <h3 className="text-xs font-semibold text-white">Arrhythmia Events</h3>
          <span className="ml-auto text-[10px] text-muted">{arrhythmiaEvents.length} events</span>
        </div>

        {arrhythmiaEvents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted">
            No arrhythmia events detected
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  <th className="text-left px-4 py-2.5 text-subtle font-medium">Timestamp</th>
                  <th className="text-left px-4 py-2.5 text-subtle font-medium">Event</th>
                  <th className="text-right px-4 py-2.5 text-subtle font-medium">HR (bpm)</th>
                  <th className="text-right px-4 py-2.5 text-subtle font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {arrhythmiaEvents.map((event, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-2.5 tabular-nums text-muted">{event.timestamp}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          color: getArrhythmiaColor(event.type),
                          background: `${getArrhythmiaColor(event.type)}20`,
                          border: `1px solid ${getArrhythmiaColor(event.type)}40`,
                        }}
                      >
                        {event.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white">{event.hr}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{event.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-subtle text-center pb-2">
        HolterSync — For demonstration purposes only. Not for clinical use.
      </p>
    </div>
  );
}
