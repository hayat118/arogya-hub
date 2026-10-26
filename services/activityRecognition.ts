/**
 * Activity Recognition Engine
 * Classifies activity from Accelerometer + Pedometer data in real-time.
 *
 * Strategy:
 *  - Walking / Running → determined by step CADENCE (steps per minute)
 *  - Cycling          → no steps + steady low-frequency vibration (wheel roll)
 *  - Sport / Badminton/ Football → burst high-G-force arm/body swings, no cadence pattern
 *  - Stationary       → very low magnitude, near zero steps
 */

export type DetectedActivity =
  | "walking"
  | "running"
  | "cycling"
  | "sport"
  | "stationary"
  | "unknown";

export interface ActivityReading {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface ActivitySnapshot {
  activity: DetectedActivity;
  cadence: number;
  meanMagnitude: number;
  stdMagnitude: number;
  peakMagnitude: number;
  confidence: number;
}

// ── Thresholds ──────────────────────────────────────────────────────────────
const STILL_MAGNITUDE       = 0.06;
const CADENCE_WALK_MIN      = 50;
const CADENCE_WALK_MAX      = 125;
const CADENCE_RUN_MIN       = 125;
const CYCLING_MAX_CADENCE   = 15;
const CYCLING_MEAN_MAG_MIN  = 0.04;
const CYCLING_MEAN_MAG_MAX  = 0.40;
const CYCLING_STD_MAX       = 0.30;
const SPORT_PEAK_MIN        = 1.20;
const SPORT_STD_MIN         = 0.35;

export const ACCEL_WINDOW_MS         = 8_000;
export const ACCEL_SAMPLE_INTERVAL_MS = 50;

// ── Classifier ──────────────────────────────────────────────────────────────
export function classifyActivity(
  readings: ActivityReading[],
  cadence: number,
  recentStepsCount = 0
): ActivitySnapshot {
  if (readings.length < 5) {
    return { activity: "unknown", cadence, meanMagnitude: 0, stdMagnitude: 0, peakMagnitude: 0, confidence: 0 };
  }

  const magnitudes = readings.map(({ x, y, z }) => Math.abs(Math.sqrt(x * x + y * y + z * z) - 1));
  const mean = magnitudes.reduce((s, v) => s + v, 0) / magnitudes.length;
  const variance = magnitudes.reduce((s, v) => s + (v - mean) ** 2, 0) / magnitudes.length;
  const std = Math.sqrt(variance);
  const peak = Math.max(...magnitudes);

  let activity: DetectedActivity = "stationary";
  let confidence = 0.5;

  // 1. If footsteps are detected in recent window, it CANNOT be cycling or stationary.
  if (cadence >= CADENCE_RUN_MIN || (recentStepsCount >= 18 && mean >= 0.25)) {
    activity = "running";
    confidence = Math.min(0.95, 0.80 + (cadence - CADENCE_RUN_MIN) / 200);
  } else if (cadence >= 35 || recentStepsCount >= 3) {
    // Normal or gentle walking
    activity = "walking";
    confidence = Math.min(0.95, 0.70 + Math.min(0.25, recentStepsCount * 0.04));
  } else if (peak >= SPORT_PEAK_MIN && std >= SPORT_STD_MIN) {
    activity = "sport";
    confidence = Math.min(0.85, 0.55 + (peak - SPORT_PEAK_MIN) * 0.15);
  } else if (
    recentStepsCount === 0 &&
    cadence === 0 &&
    mean >= 0.08 &&
    mean <= CYCLING_MEAN_MAG_MAX &&
    std <= 0.18
  ) {
    // Strict cycling condition: ZERO steps detected + very smooth micro-vibrations
    activity = "cycling";
    confidence = 0.60;
  } else if (mean < STILL_MAGNITUDE && recentStepsCount === 0) {
    activity = "stationary";
    confidence = 0.85;
  } else {
    // Unknown or brief movement without continuous cadence
    activity = mean > STILL_MAGNITUDE ? "unknown" : "stationary";
    confidence = 0.40;
  }

  return {
    activity,
    cadence,
    meanMagnitude: parseFloat(mean.toFixed(4)),
    stdMagnitude:  parseFloat(std.toFixed(4)),
    peakMagnitude: parseFloat(peak.toFixed(4)),
    confidence:    parseFloat(confidence.toFixed(2)),
  };
}

export function smoothActivity(history: DetectedActivity[], windowSize = 5): DetectedActivity {
  if (history.length === 0) return "unknown";
  const recent = history.slice(-windowSize);
  const freq: Partial<Record<DetectedActivity, number>> = {};
  for (const a of recent) {
    freq[a] = (freq[a] ?? 0) + 1;
  }
  let best: DetectedActivity = "unknown";
  let bestCount = 0;
  for (const [act, count] of Object.entries(freq) as [DetectedActivity, number][]) {
    if (count > bestCount) { best = act; bestCount = count; }
  }
  return best;
}
