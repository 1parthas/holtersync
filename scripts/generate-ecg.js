#!/usr/bin/env node
/**
 * generate-ecg.js
 * Generates a realistic 30-second ECG CSV file for demo/testing.
 *
 * Usage: node scripts/generate-ecg.js
 * Output: ecg_sample_patient.csv (in the current working directory)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 500;        // Hz
const DURATION_SEC = 30;        // seconds
const BASE_BPM = 75;            // beats per minute
const BPM_VARIABILITY = 3;      // ± BPM variation per beat (HRV simulation)
const OUTPUT_FILE = path.join(process.cwd(), 'ecg_sample_patient.csv');

// ── Math helpers ──────────────────────────────────────────────────────────────

/**
 * Gaussian pulse centred at `mu` seconds.
 * @param {number} t - current time within beat (seconds)
 * @param {number} mu - peak centre (seconds)
 * @param {number} sigma - width (seconds)
 * @param {number} amp - amplitude (mV)
 */
function gaussian(t, mu, sigma, amp) {
  return amp * Math.exp(-0.5 * Math.pow((t - mu) / sigma, 2));
}

/**
 * Low-frequency sinusoidal baseline wander.
 * @param {number} tAbsolute - absolute time in seconds
 */
function baselineWander(tAbsolute) {
  return 0.04 * Math.sin(2 * Math.PI * 0.15 * tAbsolute)
       + 0.02 * Math.sin(2 * Math.PI * 0.05 * tAbsolute);
}

/**
 * High-frequency noise (EMG / electrode artefact simulation).
 */
function noise() {
  // Box-Muller transform for Gaussian noise
  const u1 = Math.random();
  const u2 = Math.random();
  const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return n * 0.012; // ± ~12 µV
}

// ── Beat morphology ────────────────────────────────────────────────────────────
// Morphology coefficients for each lead relative to Lead I reference.
// Lead II = Lead I * 1.6 (Lead II is typically the tallest QRS lead)
// Lead III = Lead II - Lead I  (Einthoven's law simplified)

/**
 * Single ECG beat (one cardiac cycle) starting at t=0 seconds.
 * Returns the amplitude in mV at time `t` within the beat.
 * @param {number} t - time within beat (0 ... beatDuration)
 */
function beatAmplitude(t) {
  let v = 0;

  // P wave: gentle positive bump ~80 ms into beat, ~40 ms wide
  v += gaussian(t, 0.080, 0.018, 0.18);

  // PR segment isoelectric — nothing to add

  // Q wave: small negative notch just before R
  v += gaussian(t, 0.155, 0.006, -0.08);

  // R wave: dominant positive spike ~165 ms
  v += gaussian(t, 0.165, 0.007, 1.20);

  // S wave: small negative after R
  v += gaussian(t, 0.180, 0.007, -0.15);

  // ST segment — slight elevation for realism
  v += gaussian(t, 0.230, 0.025, 0.04);

  // T wave: broader positive bump ~300 ms
  v += gaussian(t, 0.300, 0.035, 0.28);

  return v;
}

// ── Signal generation ─────────────────────────────────────────────────────────

const totalSamples = SAMPLE_RATE * DURATION_SEC;
const dt = 1 / SAMPLE_RATE; // seconds per sample

// Pre-allocate arrays
const timeMs   = new Float64Array(totalSamples);
const leadI    = new Float64Array(totalSamples);
const leadII   = new Float64Array(totalSamples);
const leadIII  = new Float64Array(totalSamples);

let sampleIdx = 0;
let absoluteTime = 0; // seconds

// Seed first R-peak at t=0
let nextBeatStart = 0;

// Build beat schedule (RR intervals with HRV)
const beatSchedule = [];
let t = 0;
while (t < DURATION_SEC + 2) {
  const bpm = BASE_BPM + (Math.random() - 0.5) * 2 * BPM_VARIABILITY;
  const rrSec = 60 / bpm;
  beatSchedule.push({ start: t, duration: rrSec });
  t += rrSec;
}

// Build sample-by-sample
for (let i = 0; i < totalSamples; i++) {
  const tSec = i * dt;
  timeMs[i] = Math.round(tSec * 1000); // ms, integer

  // Find which beat this sample belongs to
  let beatV = 0;
  for (let b = 0; b < beatSchedule.length; b++) {
    const beat = beatSchedule[b];
    const tInBeat = tSec - beat.start;
    if (tInBeat >= 0 && tInBeat < beat.duration) {
      beatV = beatAmplitude(tInBeat);
      break;
    }
  }

  const bw = baselineWander(tSec);
  const n = noise();

  // Einthoven-based lead derivation
  // Lead I reference
  const vI = beatV + bw + n;
  // Lead II: slightly larger amplitude + different baseline wander phase
  const vII = beatV * 1.60 + bw * 0.9 + noise() * 1.1;
  // Lead III = Lead II - Lead I  (Einthoven's law)
  const vIII = vII - vI;

  leadI[i]   = Math.round(vI   * 10000) / 10000;
  leadII[i]  = Math.round(vII  * 10000) / 10000;
  leadIII[i] = Math.round(vIII * 10000) / 10000;
}

// ── Write CSV ──────────────────────────────────────────────────────────────────

console.log(`Generating ECG CSV: ${OUTPUT_FILE}`);
console.log(`  Duration:    ${DURATION_SEC}s`);
console.log(`  Sample rate: ${SAMPLE_RATE} Hz`);
console.log(`  Total rows:  ${totalSamples}`);
console.log(`  Base HR:     ${BASE_BPM} BPM (±${BPM_VARIABILITY} variability)`);

const rows = ['time_ms,Lead_I,Lead_II,Lead_III'];
for (let i = 0; i < totalSamples; i++) {
  rows.push(`${timeMs[i]},${leadI[i]},${leadII[i]},${leadIII[i]}`);
}

fs.writeFileSync(OUTPUT_FILE, rows.join('\n') + '\n', 'utf8');

const statsBytes = fs.statSync(OUTPUT_FILE).size;
const statsKB = (statsBytes / 1024).toFixed(1);
console.log(`\nDone! File size: ${statsKB} KB`);
console.log(`Output: ${OUTPUT_FILE}`);
console.log('\nTo use in HolterSync:');
console.log('  1. Push to your Android device:');
console.log('     adb push ecg_sample_patient.csv /sdcard/');
console.log('  2. Open HolterSync, select the device, navigate to /sdcard/');
console.log('  3. Select ecg_sample_patient.csv and transfer it.');
console.log('  4. The ECG viewer will open automatically.');
