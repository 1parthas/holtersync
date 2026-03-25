'use client';

import { useRef, useEffect, useCallback } from 'react';

interface ECGParams {
  bpm: number;
  amplitude: number;
  noise: number;
}

interface Props {
  params: ECGParams;
}

const SAMPLE_RATE = 500;
const PX_PER_SEC = 180;
const VOLTS_PER_PX = 0.003;
const ECG_BG = '#0a1a0a';
const GRID_MINOR = '#1a3a1a';
const TRACE_COLOR = '#00ff88';
const AXIS_COLOR = '#2a5a2a';
const TEXT_COLOR = '#4a9a4a';

function gaussian(x: number, mu: number, sigma: number, amp: number): number {
  return amp * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));
}

function generateBeat(sampleRate: number, bpm: number, amplitude: number): number[] {
  const samplesPerBeat = Math.round((60 / bpm) * sampleRate);
  const beat: number[] = new Array(samplesPerBeat).fill(0);
  for (let i = 0; i < samplesPerBeat; i++) {
    const t = i / sampleRate;
    let v = 0;
    v += gaussian(t, 0.08, 0.018, 0.18 * amplitude);
    v += gaussian(t, 0.155, 0.006, -0.08 * amplitude);
    v += gaussian(t, 0.165, 0.007, 1.2 * amplitude);
    v += gaussian(t, 0.180, 0.007, -0.15 * amplitude);
    v += gaussian(t, 0.30, 0.035, 0.28 * amplitude);
    beat[i] = v;
  }
  return beat;
}

export default function UsbECGGraph({ params }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const bufferRef = useRef<number[]>([]);
  const writeHeadRef = useRef(0);
  const beatRef = useRef<number[]>([]);
  const beatPosRef = useRef(0);
  const scrollRef = useRef(0);
  const lastTsRef = useRef(0);
  const paramsRef = useRef(params);

  // Keep params ref in sync
  useEffect(() => {
    paramsRef.current = params;
    // Regenerate beat pattern when params change
    beatRef.current = generateBeat(SAMPLE_RATE, params.bpm, params.amplitude);
    beatPosRef.current = 0;
  }, [params]);

  // Init buffer (5 seconds)
  useEffect(() => {
    const len = SAMPLE_RATE * 5;
    bufferRef.current = new Array(len).fill(0);
    writeHeadRef.current = 0;
    beatRef.current = generateBeat(SAMPLE_RATE, params.bpm, params.amplitude);
    beatPosRef.current = 0;
  }, []);

  const draw = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width / window.devicePixelRatio;
    const H = canvas.height / window.devicePixelRatio;

    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background
    ctx.fillStyle = ECG_BG;
    ctx.fillRect(0, 0, W, H);

    // Grid
    const minorGrid = 20;
    ctx.strokeStyle = GRID_MINOR;
    ctx.lineWidth = 0.5;
    for (let x = scrollRef.current % minorGrid; x < W; x += minorGrid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 14); ctx.stroke();
    }
    for (let y = 0; y < H - 14; y += minorGrid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Major grid
    const majorGrid = minorGrid * 5;
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 0.8;
    for (let x = scrollRef.current % majorGrid; x < W; x += majorGrid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 14); ctx.stroke();
    }
    for (let y = 0; y < H - 14; y += majorGrid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Center baseline
    const yMid = (H - 14) / 2;
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, yMid); ctx.lineTo(W, yMid); ctx.stroke();

    // Draw trace — rolling window
    const buffer = bufferRef.current;
    const bufLen = buffer.length;
    const writeHead = writeHeadRef.current;
    const visibleSamples = Math.ceil((W / PX_PER_SEC) * SAMPLE_RATE);

    ctx.strokeStyle = TRACE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let first = true;
    for (let i = 0; i < visibleSamples; i++) {
      const idx = ((writeHead - visibleSamples + i) + bufLen * 10) % bufLen;
      const x = (i / SAMPLE_RATE) * PX_PER_SEC;
      const y = yMid - buffer[idx] / VOLTS_PER_PX;

      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Erase head (wipe bar)
    ctx.fillStyle = ECG_BG;
    ctx.fillRect(W - 20, 0, 20, H - 14);

    // Time axis
    ctx.fillStyle = '#0d1f0d';
    ctx.fillRect(0, H - 14, W, 14);
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nowSec = writeHead / SAMPLE_RATE;
    const startSec = nowSec - W / PX_PER_SEC;
    const step = 0.5;
    for (let t = Math.ceil(startSec / step) * step; t <= nowSec; t += step) {
      const x = (t - startSec) * PX_PER_SEC;
      ctx.fillText(`${t.toFixed(1)}s`, x, H - 7);
    }

    ctx.restore();
  }, []);

  const animate = useCallback((ts: number) => {
    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = (ts - lastTsRef.current) / 1000;
    lastTsRef.current = ts;

    // Push new samples into buffer
    const newSamples = Math.round(dt * SAMPLE_RATE);
    const p = paramsRef.current;
    const beat = beatRef.current;

    for (let i = 0; i < newSamples; i++) {
      const noise = (Math.random() - 0.5) * 2 * p.noise;
      const sample = beat[beatPosRef.current % beat.length] + noise;
      bufferRef.current[writeHeadRef.current % bufferRef.current.length] = sample;
      writeHeadRef.current++;
      beatPosRef.current = (beatPosRef.current + 1) % beat.length;
    }

    scrollRef.current += dt * PX_PER_SEC;

    const canvas = canvasRef.current;
    if (canvas) draw(canvas);

    animRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    lastTsRef.current = 0;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 140, display: 'block', cursor: 'crosshair', borderRadius: 8 }}
    />
  );
}
