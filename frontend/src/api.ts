// Types and requests for the PitchIQ FastAPI backend

export const API_URL = "http://127.0.0.1:8000";

export type Team = "home" | "away";

export type AveragePosition = { x: number; y: number };

// One player column found in the Metrica CSV headers
export type MatchPlayer = {
  id: string;
  column: string;
  team: Team;
  number: number;
  starter: boolean;
  first_seen_time: number | null;
  first_seen_period: number | null;
  last_seen_time: number | null;
  minutes_played: number;
  distance_m: number;
  average_speed_kmh: number;
  top_speed_kmh: number;
  high_speed_distance_m: number;
  sprint_distance_m: number;
  average_position: Record<string, AveragePosition>;
};

export type MatchPeriod = {
  period: number;
  start_time: number;
  end_time: number;
  duration: number;
  frames: number;
};

export type MatchSummary = {
  source: string;
  fps: number;
  pitch: { length: number; width: number };
  total_frames: number;
  periods: MatchPeriod[];
  players: MatchPlayer[];
};

// Coordinates are 0–1 and null while a player is off the pitch
export type Track = {
  x: (number | null)[];
  y: (number | null)[];
};

export type MatchClip = {
  period: number;
  fps: number;
  period_start_time: number;
  times: number[];
  frames: number[];
  ball: Track;
  players: Record<string, Track>;
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export function fetchMatchSummary(signal?: AbortSignal) {
  return getJson<MatchSummary>("/api/match", signal);
}

export function fetchMatchClip(
  period: number,
  start: number,
  duration: number,
  signal?: AbortSignal
) {
  const query = new URLSearchParams({
    period: String(period),
    start: String(start),
    duration: String(duration),
  });

  return getJson<MatchClip>(`/api/match/frames?${query}`, signal);
}
