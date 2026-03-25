'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Heart, AlertTriangle, Activity, FileText } from 'lucide-react';
import { PatientInfo, ArrhythmiaEvent, ReportData } from '@/types';
import PatientPanel from './PatientPanel';
import ReportPanel from './ReportPanel';

// ── Types ────────────────────────────────────────────────────────────────────

interface ECGData {
  time: number[];
  leadI: number[];
  leadII: number[];
  leadIII: number[];
}

interface Props {
  filePath: string;
  fileName: string;
  onBack: () => void;
}

// ── ECG Synthesis ─────────────────────────────────────────────────────────────

function gaussian(x: number, mu: number, sigma: number, amp: number): number {
  return amp * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));
}

function generateSyntheticECG(sampleCount: number, sampleRate: number, bpm: number): number[] {
  const samplesPerBeat = Math.round((60 / bpm) * sampleRate);
  const signal: number[] = new Array(sampleCount).fill(0);

  for (let beatStart = 0; beatStart < sampleCount; beatStart += samplesPerBeat) {
    const bpmVariation = bpm + (Math.random() - 0.5) * 4;
    const localSPB = Math.round((60 / bpmVariation) * sampleRate);

    for (let i = 0; i < localSPB && beatStart + i < sampleCount; i++) {
      const t = i / sampleRate; // seconds into beat
      let val = 0;

      // P wave: ~80ms after beat start, ~40ms wide
      val += gaussian(t, 0.08, 0.018, 0.18);

      // Q wave: small negative dip before QRS
      val += gaussian(t, 0.155, 0.006, -0.08);

      // R wave: tall spike at ~170ms
      val += gaussian(t, 0.165, 0.007, 1.2);

      // S wave: small negative after R
      val += gaussian(t, 0.180, 0.007, -0.15);

      // T wave: ~300ms, ~50ms wide
      val += gaussian(t, 0.30, 0.035, 0.28);

      // Baseline wander (very low freq)
      val += 0.04 * Math.sin(2 * Math.PI * 0.15 * (beatStart / sampleRate + t));

      signal[beatStart + i] += val;
    }
  }
  return signal;
}

// ── CSV Parsing ───────────────────────────────────────────────────────────────

function parseCSV(csvText: string): ECGData {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { time: [], leadI: [], leadII: [], leadIII: [] };

  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const timeIdx = header.findIndex(h => h.includes('time'));
  const l1Idx = header.findIndex(h => h.includes('lead_i') && !h.includes('ii') && !h.includes('iii'));
  const l2Idx = header.findIndex(h => h.includes('lead_ii') && !h.includes('iii'));
  const l3Idx = header.findIndex(h => h.includes('lead_iii'));

  const time: number[] = [];
  const leadI: number[] = [];
  const leadII: number[] = [];
  const leadIII: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    time.push(timeIdx >= 0 ? parseFloat(cols[timeIdx]) : i * 2);
    leadI.push(l1Idx >= 0 ? parseFloat(cols[l1Idx]) : 0);
    leadII.push(l2Idx >= 0 ? parseFloat(cols[l2Idx]) : 0);
    leadIII.push(l3Idx >= 0 ? parseFloat(cols[l3Idx]) : 0);
  }
  return { time, leadI, leadII, leadIII };
}

// ── R-peak detection & HR ─────────────────────────────────────────────────────

function detectRPeaks(signal: number[], sampleRate: number): number[] {
  if (signal.length === 0) return [];
  const minDistance = Math.round(sampleRate * 0.3); // 300ms refractory period
  const threshold = Math.max(...signal) * 0.6;
  const peaks: number[] = [];

  for (let i = 1; i < signal.length - 1; i++) {
    if (
      signal[i] > threshold &&
      signal[i] > signal[i - 1] &&
      signal[i] >= signal[i + 1]
    ) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

function calcHeartRate(peaks: number[], sampleRate: number): { avg: number; min: number; max: number } {
  if (peaks.length < 2) return { avg: 75, min: 75, max: 75 };
  const rrIntervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const rr = (peaks[i] - peaks[i - 1]) / sampleRate; // seconds
    if (rr > 0.3 && rr < 2.0) rrIntervals.push(rr);
  }
  if (rrIntervals.length === 0) return { avg: 75, min: 75, max: 75 };
  const hrs = rrIntervals.map(rr => Math.round(60 / rr));
  const avg = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
  const min = Math.min(...hrs);
  const max = Math.max(...hrs);
  return { avg, min, max };
}

function generateArrhythmiaEvents(peaks: number[], sampleRate: number, timeArr: number[]): ArrhythmiaEvent[] {
  const events: ArrhythmiaEvent[] = [];
  if (peaks.length < 2) return events;

  for (let i = 1; i < peaks.length; i++) {
    const rr = (peaks[i] - peaks[i - 1]) / sampleRate;
    const hr = Math.round(60 / rr);
    const timeSec = peaks[i] / sampleRate;
    const mm = Math.floor(timeSec / 60);
    const ss = (timeSec % 60).toFixed(1);
    const ts = `${mm.toString().padStart(2, '0')}:${ss.padStart(4, '0')}`;

    if (hr > 100) {
      events.push({ timestamp: ts, type: 'Tachycardia', hr, duration: `${(rr * 1000).toFixed(0)}ms RR` });
    } else if (hr < 60) {
      events.push({ timestamp: ts, type: 'Bradycardia', hr, duration: `${(rr * 1000).toFixed(0)}ms RR` });
    }
  }
  return events;
}

// ── Canvas drawing ────────────────────────────────────────────────────────────

const LEAD_LABELS = ['Lead I', 'Lead II', 'Lead III'];
const ECG_BG = '#0a1a0a';
const GRID_MINOR = '#1a3a1a';
const GRID_MAJOR = '#1f4a1f';
const TRACE_COLOR = '#00ff88';
const RPEAK_COLOR = '#ffdd00';
const AXIS_COLOR = '#2a5a2a';
const TEXT_COLOR = '#4a9a4a';

const PX_PER_SEC = 200; // pixels per second at 1x scroll
const VOLTS_PER_PX = 0.003; // mV per pixel

function drawECGCanvas(
  canvas: HTMLCanvasElement,
  data: ECGData,
  sampleRate: number,
  scrollOffset: number,
  rPeaks: number[],
  highlightLead: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const numLeads = 3;
  const leadH = Math.floor(H / numLeads);
  const labelW = 60;
  const signals = [data.leadI, data.leadII, data.leadIII];

  // Background
  ctx.fillStyle = ECG_BG;
  ctx.fillRect(0, 0, W, H);

  // Draw grid and traces per lead
  for (let leadIdx = 0; leadIdx < numLeads; leadIdx++) {
    const yTop = leadIdx * leadH;
    const yMid = yTop + leadH / 2;
    const yBot = yTop + leadH;

    // Lead background highlight
    if (leadIdx === highlightLead) {
      ctx.fillStyle = 'rgba(0,255,136,0.03)';
      ctx.fillRect(0, yTop, W, leadH);
    }

    // Separator line
    if (leadIdx > 0) {
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yTop);
      ctx.lineTo(W, yTop);
      ctx.stroke();
    }

    // Minor grid lines (small squares = 1mm => 20px at 200px/s with 5mm/s standard)
    const minorGrid = 20;
    ctx.strokeStyle = GRID_MINOR;
    ctx.lineWidth = 0.5;

    // Vertical minor grid
    const gridOffsetX = scrollOffset % minorGrid;
    for (let x = labelW - gridOffsetX; x < W; x += minorGrid) {
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
    }

    // Horizontal minor grid
    for (let y = yTop; y <= yBot; y += minorGrid) {
      ctx.beginPath();
      ctx.moveTo(labelW, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Major grid lines (5x minor = 100px)
    const majorGrid = minorGrid * 5;
    ctx.strokeStyle = GRID_MAJOR;
    ctx.lineWidth = 1;

    const majorOffsetX = scrollOffset % majorGrid;
    for (let x = labelW - majorOffsetX; x < W; x += majorGrid) {
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
    }

    for (let y = yTop; y <= yBot; y += majorGrid) {
      ctx.beginPath();
      ctx.moveTo(labelW, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(labelW, yMid);
    ctx.lineTo(W, yMid);
    ctx.stroke();

    // Lead label background
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, yTop, labelW - 2, leadH);
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(labelW - 2, yTop);
    ctx.lineTo(labelW - 2, yBot);
    ctx.stroke();

    // Lead label text
    ctx.fillStyle = leadIdx === highlightLead ? TRACE_COLOR : TEXT_COLOR;
    ctx.font = `${leadIdx === highlightLead ? 'bold' : 'normal'} 11px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(LEAD_LABELS[leadIdx], labelW / 2, yMid);

    // Draw ECG trace
    const signal = signals[leadIdx];
    if (!signal || signal.length === 0) continue;

    const startSample = Math.floor((scrollOffset / PX_PER_SEC) * sampleRate);
    const visibleSamples = Math.ceil(((W - labelW) / PX_PER_SEC) * sampleRate) + 2;
    const endSample = Math.min(signal.length, startSample + visibleSamples);

    ctx.save();
    ctx.beginPath();
    ctx.rect(labelW, yTop, W - labelW, leadH);
    ctx.clip();

    ctx.strokeStyle = TRACE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let firstPoint = true;
    for (let s = startSample; s < endSample; s++) {
      const pixelX = labelW + ((s / sampleRate) * PX_PER_SEC) - scrollOffset;
      const pixelY = yMid - signal[s] / VOLTS_PER_PX;
      if (firstPoint) {
        ctx.moveTo(pixelX, pixelY);
        firstPoint = false;
      } else {
        ctx.lineTo(pixelX, pixelY);
      }
    }
    ctx.stroke();

    // Draw R-peak markers (only for Lead II)
    if (leadIdx === 1) {
      ctx.fillStyle = RPEAK_COLOR;
      for (const peak of rPeaks) {
        if (peak < startSample || peak > endSample) continue;
        const pixelX = labelW + ((peak / sampleRate) * PX_PER_SEC) - scrollOffset;
        ctx.beginPath();
        ctx.arc(pixelX, yMid - signal[peak] / VOLTS_PER_PX - 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Time axis at bottom
  ctx.fillStyle = '#0d1f0d';
  ctx.fillRect(labelW, H - 18, W - labelW, 18);
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(labelW, H - 18);
  ctx.lineTo(W, H - 18);
  ctx.stroke();

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const timeStep = 0.5; // label every 0.5s
  const startTime = scrollOffset / PX_PER_SEC;
  const endTime = startTime + (W - labelW) / PX_PER_SEC;
  for (let t = Math.ceil(startTime / timeStep) * timeStep; t <= endTime; t += timeStep) {
    const x = labelW + (t * PX_PER_SEC) - scrollOffset;
    ctx.fillText(`${t.toFixed(1)}s`, x, H - 9);
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, H - 18);
    ctx.lineTo(x, H - 14);
    ctx.stroke();
  }

  // Playhead
  ctx.strokeStyle = 'rgba(0,255,136,0.4)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H - 18);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ECGViewer({ filePath, fileName, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const scrollRef = useRef(0);
  const isPlayingRef = useRef(true);
  const lastTimeRef = useRef<number>(0);
  const highlightLeadRef = useRef(1); // Lead II highlighted by default

  const [ecgData, setEcgData] = useState<ECGData | null>(null);
  const [sampleRate, setSampleRate] = useState(500);
  const [rPeaks, setRPeaks] = useState<number[]>([]);
  const [hrStats, setHrStats] = useState({ avg: 75, min: 60, max: 100 });
  const [arrhythmia, setArrhythmia] = useState<ArrhythmiaEvent[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [highlightLead, setHighlightLead] = useState(1);

  const [patient, setPatient] = useState<PatientInfo>({
    name: 'Sample Patient',
    age: '54',
    recordingDate: new Date().toISOString().slice(0, 10),
    deviceId: 'HLT-001',
    duration: '30s',
    sampleRate: '500 Hz',
  });

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      let data: ECGData | null = null;
      let sr = 500;

      if (typeof window !== 'undefined' && window.electronAPI?.readFile && filePath) {
        try {
          const result = await window.electronAPI.readFile(filePath);
          if (typeof result === 'string' && result.trim().length > 0) {
            data = parseCSV(result);
            // Try to infer sample rate from time column
            if (data.time.length >= 2) {
              const dtMs = data.time[1] - data.time[0];
              if (dtMs > 0) sr = Math.round(1000 / dtMs);
            }
          }
        } catch (_) {}
      }

      // Fall back to synthetic if no valid data
      const useSynthetic =
        !data ||
        data.leadII.length === 0 ||
        data.leadII.every(v => v === 0 || isNaN(v));

      if (useSynthetic) {
        sr = 500;
        const count = sr * 30;
        const leadISignal = generateSyntheticECG(count, sr, 75);
        const leadIISignal = leadISignal.map(v => v * 1.5);
        const leadIIISignal = leadISignal.map(v => v * 0.5);
        const timeMs = Array.from({ length: count }, (_, i) => i * (1000 / sr));
        data = { time: timeMs, leadI: leadISignal, leadII: leadIISignal, leadIII: leadIIISignal };
      }

      setSampleRate(sr);

      // Detect R peaks & HR on Lead II
      const peaks = detectRPeaks(data.leadII, sr);
      const hr = calcHeartRate(peaks, sr);
      const events = generateArrhythmiaEvents(peaks, sr, data.time);

      setEcgData(data);
      setRPeaks(peaks);
      setHrStats(hr);
      setArrhythmia(events);

      // Update patient info from filename
      const baseName = fileName.replace(/\.csv$/i, '');
      setPatient(prev => ({
        ...prev,
        name: baseName.replace(/_/g, ' '),
        sampleRate: `${sr} Hz`,
        duration: data ? `${(data.time.length / sr).toFixed(1)}s` : '—',
      }));

      setLoading(false);
    }

    loadData();
  }, [filePath, fileName]);

  // ── Animation loop ─────────────────────────────────────────────────────────

  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    if (isPlayingRef.current && ecgData) {
      const speed = PX_PER_SEC * (dt / 1000);
      const maxScroll = Math.max(0, (ecgData.time.length / sampleRate) * PX_PER_SEC - (canvasRef.current?.width || 800) + 60);
      scrollRef.current = Math.min(scrollRef.current + speed, maxScroll);
    }

    const canvas = canvasRef.current;
    if (canvas && ecgData) {
      drawECGCanvas(canvas, ecgData, sampleRate, scrollRef.current, rPeaks, highlightLeadRef.current);
    }

    animRef.current = requestAnimationFrame(animate);
  }, [ecgData, sampleRate, rPeaks]);

  useEffect(() => {
    if (!ecgData) return;
    lastTimeRef.current = 0;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [ecgData, animate]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    highlightLeadRef.current = highlightLead;
  }, [highlightLead]);

  // ── Canvas resize ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // ── Rhythm label ───────────────────────────────────────────────────────────

  const rhythmLabel =
    hrStats.avg > 100 ? 'Tachycardia' :
    hrStats.avg < 60 ? 'Bradycardia' :
    'Normal Sinus Rhythm';

  const rhythmColor =
    hrStats.avg > 100 ? '#f59e0b' :
    hrStats.avg < 60 ? '#60a5fa' :
    '#00ff88';

  // ── Generate report ────────────────────────────────────────────────────────

  const handleGenerateReport = async () => {
    setShowReport(true);
    if (typeof window !== 'undefined' && window.electronAPI?.generateReport) {
      const reportData: ReportData = {
        patient,
        avgHR: hrStats.avg,
        minHR: hrStats.min,
        maxHR: hrStats.max,
        duration: patient.duration,
        arrhythmiaEvents: arrhythmia,
        filePath,
      };
      await window.electronAPI.generateReport(reportData);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in" style={{ background: ECG_BG }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0 border-b"
        style={{ background: '#0d1a0d', borderColor: '#1a3a1a' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border"
          style={{
            color: '#4a9a4a',
            borderColor: '#1a3a1a',
            background: '#0a1a0a',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#00ff88';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff88';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#4a9a4a';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a3a1a';
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: '#00ff88' }} />
          <span className="text-xs font-semibold text-white truncate">{fileName}</span>
        </div>

        {/* HR display */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style={{ background: '#0a1a0a', borderColor: '#1a3a1a' }}>
            <Heart className="w-3.5 h-3.5" style={{ color: '#00ff88' }} />
            <span className="text-lg font-bold tabular-nums" style={{ color: '#00ff88' }}>{hrStats.avg}</span>
            <span className="text-[10px]" style={{ color: '#4a9a4a' }}>bpm</span>
          </div>

          <div
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border"
            style={{
              color: rhythmColor,
              background: `${rhythmColor}18`,
              borderColor: `${rhythmColor}40`,
            }}
          >
            {rhythmLabel}
          </div>

          <button
            onClick={() => setIsPlaying(p => !p)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{
              color: isPlaying ? '#00ff88' : '#4a9a4a',
              borderColor: isPlaying ? '#00ff8840' : '#1a3a1a',
              background: isPlaying ? 'rgba(0,255,136,0.1)' : '#0a1a0a',
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{ color: '#a78bfa', borderColor: '#a78bfa40', background: 'rgba(167,139,250,0.1)' }}
          >
            <FileText className="w-3.5 h-3.5" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Lead selector tabs */}
      <div className="flex items-center gap-1 px-4 py-2 shrink-0" style={{ background: '#0d1a0d', borderBottom: '1px solid #1a3a1a' }}>
        <span className="text-[10px] mr-2" style={{ color: '#2a5a2a' }}>Highlight:</span>
        {LEAD_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setHighlightLead(i)}
            className="px-2.5 py-1 rounded text-[10px] font-medium border transition-all"
            style={{
              color: highlightLead === i ? '#00ff88' : '#4a9a4a',
              borderColor: highlightLead === i ? '#00ff8840' : '#1a3a1a',
              background: highlightLead === i ? 'rgba(0,255,136,0.12)' : 'transparent',
            }}
          >
            {label}
          </button>
        ))}

        {arrhythmia.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border" style={{ borderColor: '#f59e0b40', background: 'rgba(245,158,11,0.1)' }}>
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400">{arrhythmia.length} arrhythmia event{arrhythmia.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* ECG Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#1a3a1a', borderTopColor: '#00ff88' }} />
              <p className="text-xs" style={{ color: '#4a9a4a' }}>Loading ECG data...</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="flex-1 w-full"
              style={{ display: 'block', cursor: 'crosshair' }}
              onClick={() => setIsPlaying(p => !p)}
            />
          )}
        </div>

        {/* Right panel */}
        <div
          className="w-80 flex flex-col overflow-hidden border-l shrink-0"
          style={{ borderColor: '#1a3a1a', background: '#0d1a0d' }}
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Patient panel */}
            <PatientPanel patient={patient} onChange={setPatient} />

            {/* Stats panel */}
            <div className="rounded-xl border p-4 space-y-3" style={{ background: '#0a1a0a', borderColor: '#1a3a1a' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#2a5a2a' }}>Recording Stats</div>
              {[
                { label: 'Avg HR', value: `${hrStats.avg} bpm`, color: '#00ff88' },
                { label: 'Min HR', value: `${hrStats.min} bpm`, color: '#60a5fa' },
                { label: 'Max HR', value: `${hrStats.max} bpm`, color: '#f59e0b' },
                { label: 'R Peaks', value: rPeaks.length.toString(), color: '#ffdd00' },
                { label: 'Sample Rate', value: `${sampleRate} Hz`, color: '#4a9a4a' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: '#4a9a4a' }}>{label}</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Report modal */}
      {showReport && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowReport(false)}>
          <div
            className="w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl animate-fade-in"
            style={{ background: '#0f0f0f', borderColor: '#2a2a2a' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Holter Report</h2>
              <button
                onClick={() => setShowReport(false)}
                className="text-xs text-muted hover:text-white transition-colors px-3 py-1.5 border border-border rounded-lg hover:border-[#00ff88]/40"
              >
                Close
              </button>
            </div>
            <ReportPanel
              patient={patient}
              avgHR={hrStats.avg}
              minHR={hrStats.min}
              maxHR={hrStats.max}
              arrhythmiaEvents={arrhythmia}
              onSavePDF={() => window.print()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
