import type { MatchPeriod, MatchPlayer, Team, Track } from "./api";

export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;

export const DATA_SOURCE_URL =
  "https://github.com/metrica-sports/sample-data";

export const MATCH_TITLE = "Sample Game 1 — Home vs Away";

// Muted kit colours, checked for colour-blind separation
export const TEAM_COLORS: Record<Team, string> = {
  home: "#B5483F",
  away: "#2F65A8",
};

export const SELECTED_COLOR = "#F1D18D";

// Tracking coordinates are 0–1 from the top-left corner,
// so the pitch SVG is drawn in metres and positions are scaled to fit.
export const toPitchX = (x: number) => x * PITCH_LENGTH;
export const toPitchY = (y: number) => y * PITCH_WIDTH;

export const CLIP_LENGTHS = [60, 120, 300];

export const TEAM_LABEL: Record<Team, string> = {
  home: "Home",
  away: "Away",
};

// Same stride and glitch filter as the backend statistics
const STAT_STEP = 5;
const MAX_SPEED_MS = 12;

export function playerLabel(player: MatchPlayer) {
  return `${TEAM_LABEL[player.team]} #${player.number}`;
}

// Format seconds as a football match clock, e.g. 47:05
export function formatClock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// The second half clock starts at 45:00 by convention
export function matchClock(period: number, secondsIntoPeriod: number) {
  return formatClock((period === 2 ? 45 * 60 : 0) + secondsIntoPeriod);
}

// Match clock for an absolute dataset timestamp (Time [s] column)
export function clockAtTime(time: number, periods: MatchPeriod[]) {
  const period =
    [...periods].reverse().find((p) => time >= p.start_time - 1e-6) ??
    periods[0];

  return matchClock(period.period, time - period.start_time);
}

// When the player's tracking data starts and ends, e.g. "00:00–31:08"
export function playedRange(player: MatchPlayer, periods: MatchPeriod[]) {
  if (player.first_seen_time === null || player.last_seen_time === null) {
    return "Not tracked";
  }

  return `${clockAtTime(player.first_seen_time, periods)}–${clockAtTime(
    player.last_seen_time,
    periods
  )}`;
}

export function periodName(period: number) {
  return period === 1 ? "1st half" : "2nd half";
}

export type ClipStats = {
  // Distance covered from the start of the clip up to each frame
  distance: Float64Array;
  // Seconds of valid measurements up to each frame
  measured: Float64Array;
};

// Running distance for one player across a clip, in metres
export function clipStats(track: Track, fps: number): ClipStats {
  const count = track.x.length;
  const distance = new Float64Array(count);
  const measured = new Float64Array(count);
  const stepTime = STAT_STEP / fps;

  for (let i = 1; i < count; i++) {
    distance[i] = distance[i - 1];
    measured[i] = measured[i - 1];

    if (i % STAT_STEP !== 0) continue;

    const x1 = track.x[i - STAT_STEP];
    const y1 = track.y[i - STAT_STEP];
    const x2 = track.x[i];
    const y2 = track.y[i];

    if (x1 === null || y1 === null || x2 === null || y2 === null) continue;

    const step = Math.hypot(
      (x2 - x1) * PITCH_LENGTH,
      (y2 - y1) * PITCH_WIDTH
    );

    if (step / stepTime > MAX_SPEED_MS) continue;

    distance[i] += step;
    measured[i] += stepTime;
  }

  return { distance, measured };
}
