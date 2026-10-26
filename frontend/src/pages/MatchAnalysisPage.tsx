import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMatchClip,
  type MatchClip,
  type MatchPlayer,
  type MatchSummary,
  type Team,
} from "../api";
import MatchIdentity from "../components/MatchIdentity";
import Pitch from "../components/Pitch";
import PlayerMarker from "../components/PlayerMarker";
import {
  CLIP_LENGTHS,
  clipStats,
  matchClock,
  periodName,
  playedRange,
  playerLabel,
  TEAM_LABEL,
  toPitchX,
  toPitchY,
} from "../match";

export type ClipSettings = {
  period: number;
  start: number;
  length: number;
};

const SPEEDS = [1, 2, 4];
const TRAIL_SECONDS = 10;

type MatchAnalysisPageProps = {
  summary: MatchSummary;
  clipSettings: ClipSettings;
  onClipChange: (settings: ClipSettings) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenProfile: (id: string) => void;
};

function MatchAnalysisPage({
  summary,
  clipSettings,
  onClipChange,
  selectedId,
  onSelect,
  onOpenProfile,
}: MatchAnalysisPageProps) {
  const { period, start, length } = clipSettings;
  const clipKey = `${period}-${start}-${length}`;

  const [loaded, setLoaded] = useState<{
    key: string;
    clip: MatchClip;
  } | null>(null);
  const [error, setError] = useState("");

  // Playback position in seconds since the first frame of the clip
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullTrail, setFullTrail] = useState(false);
  const elapsedRef = useRef(0);

  const clip = loaded?.clip ?? null;
  const isLoading = loaded?.key !== clipKey;

  const fps = clip?.fps ?? summary.fps;
  const frameCount = clip?.times.length ?? 0;
  const duration = frameCount > 1 ? (frameCount - 1) / fps : 0;

  // Load every player's coordinates for the selected clip
  useEffect(() => {
    const controller = new AbortController();

    fetchMatchClip(period, start, length, controller.signal)
      .then((data) => {
        elapsedRef.current = 0;
        setElapsed(0);
        setIsPlaying(false);
        setError("");
        setLoaded({ key: `${period}-${start}-${length}`, clip: data });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("Could not load tracking frames from the backend.");
      });

    return () => controller.abort();
  }, [period, start, length]);

  // Advance the shared playback clock in real time while playing
  useEffect(() => {
    if (!isPlaying) return;

    let animationId = 0;
    let lastTick = performance.now();

    function tick(now: number) {
      // The first frame timestamp can be slightly earlier than lastTick,
      // so never step backwards; cap it so a hidden tab doesn't jump ahead
      const seconds = Math.max(0, Math.min((now - lastTick) / 1000, 0.25));
      const step = seconds * speed;
      lastTick = now;

      const next = Math.min(elapsedRef.current + step, duration);
      elapsedRef.current = next;
      setElapsed(next);

      if (next >= duration) {
        setIsPlaying(false);
        return;
      }

      animationId = requestAnimationFrame(tick);
    }

    animationId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, duration, speed]);

  const players = summary.players;
  const selected = players.find((p) => p.id === selectedId) ?? null;
  const selectedTrack =
    clip && selectedId ? clip.players[selectedId] : undefined;

  const stats = useMemo(
    () => (selectedTrack ? clipStats(selectedTrack, fps) : null),
    [selectedTrack, fps]
  );

  const periodInfo = summary.periods.find((p) => p.period === period);
  const periodMinutes = Math.floor((periodInfo?.duration ?? 0) / 60);

  function seek(time: number) {
    const clamped = Math.max(0, Math.min(time, duration));
    elapsedRef.current = clamped;
    setElapsed(clamped);
  }

  function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    // Start again from the beginning once the replay has finished
    if (elapsedRef.current >= duration) {
      seek(0);
    }

    setIsPlaying(true);
  }

  function restart() {
    seek(0);
    setIsPlaying(true);
  }

  function changeClip(next: Partial<ClipSettings>) {
    onClipChange({ ...clipSettings, ...next });
  }

  const maxStart = Math.max(0, periodMinutes * 60 - 60);

  // Header for the page is always shown, even while loading
  const heading = (
    <div className="page-heading">
      <div>
        <p className="eyebrow">MULTI-PLAYER TRACKING</p>
        <h1>Synchronised Match Replay</h1>
        <p className="description">
          All tracked players and the ball, replayed from the same recorded
          frame and timestamp.
        </p>
      </div>

      {/* CLIP SELECTION */}
      <div className="clip-controls">
        <label>
          <span>Half</span>
          <select
            value={period}
            onChange={(event) =>
              changeClip({
                period: Number(event.target.value),
                start: 0,
              })
            }
          >
            {summary.periods.map((p) => (
              <option key={p.period} value={p.period}>
                {periodName(p.period)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>From</span>
          <select
            value={start}
            onChange={(event) =>
              changeClip({ start: Number(event.target.value) })
            }
          >
            {Array.from({ length: periodMinutes }, (_, minute) => (
              <option key={minute} value={minute * 60}>
                {matchClock(period, minute * 60)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Length</span>
          <select
            value={length}
            onChange={(event) =>
              changeClip({ length: Number(event.target.value) })
            }
          >
            {CLIP_LENGTHS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds / 60} min
              </option>
            ))}
          </select>
        </label>

        <div className="button-pair">
          <button
            type="button"
            className="control-button compact"
            disabled={start === 0}
            onClick={() =>
              changeClip({ start: Math.max(0, start - length) })
            }
            aria-label="Previous window"
          >
            ‹
          </button>
          <button
            type="button"
            className="control-button compact"
            disabled={start + length > maxStart}
            onClick={() =>
              changeClip({
                start: Math.min(maxStart, start + length),
              })
            }
            aria-label="Next window"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );

  if (error && !clip) {
    return (
      <>
        {heading}
        <div className="panel notice">{error}</div>
      </>
    );
  }

  if (!clip) {
    return (
      <>
        {heading}
        <div className="panel notice">Loading tracking frames…</div>
      </>
    );
  }

  const frameIndex = Math.max(
    0,
    Math.min(frameCount - 1, Math.floor(elapsed * fps + 1e-6))
  );
  const clipStart = clip.times[0] - clip.period_start_time;
  const clipEnd = clipStart + frameCount / fps;
  const currentTime = clip.times[frameIndex];
  const rangeLabel = `${periodName(clip.period)} · ${matchClock(
    clip.period,
    clipStart
  )}–${matchClock(clip.period, clipEnd)}`;

  // Only players with recorded coordinates at this frame are shown,
  // so substitutes appear when their tracking data begins
  const recorded = players
    .map((player) => {
      const track = clip.players[player.id];
      const x = track?.x[frameIndex];
      const y = track?.y[frameIndex];
      return x == null || y == null ? null : { player, x, y };
    })
    .filter((item) => item !== null);

  // On a substitution frame the outgoing player's last coordinates and the
  // incoming player's first coordinates are identical; show only the
  // incoming player so the two markers don't stack for that one frame
  const isSameFrame = (time: number | null) =>
    time !== null && Math.abs(currentTime - time) < 1e-6;

  const isHandover = (item: (typeof recorded)[number]) =>
    isSameFrame(item.player.last_seen_time) &&
    recorded.some(
      (other) =>
        other !== item &&
        other.player.team === item.player.team &&
        isSameFrame(other.player.first_seen_time) &&
        other.x === item.x &&
        other.y === item.y
    );

  const onPitch = recorded
    .filter((item) => !isHandover(item))
    .sort(
      (a, b) =>
        Number(a.player.id === selectedId) -
        Number(b.player.id === selectedId)
    );

  const onPitchIds = new Set(onPitch.map((item) => item.player.id));
  const visibleCount = (team: Team) =>
    onPitch.filter((item) => item.player.team === team).length;
  const trackedCount = (team: Team) =>
    players.filter((p) => p.team === team).length;

  // Movement trail from the recorded positions of the selected player
  let trail = "";
  if (selectedTrack) {
    const from = fullTrail
      ? 0
      : Math.max(0, frameIndex - TRAIL_SECONDS * fps);
    const points: string[] = [];

    for (let i = from; i <= frameIndex; i++) {
      const x = selectedTrack.x[i];
      const y = selectedTrack.y[i];
      if (x != null && y != null) {
        points.push(`${toPitchX(x).toFixed(2)},${toPitchY(y).toFixed(2)}`);
      }
    }

    trail = points.join(" ");
  }

  const ballX = clip.ball.x[frameIndex];
  const ballY = clip.ball.y[frameIndex];

  // Live statistics for the selected player within this clip
  let distance = 0;
  let averageSpeed = 0;
  let currentSpeed: number | null = null;

  if (stats) {
    distance = stats.distance[frameIndex];
    const measured = stats.measured[frameIndex];
    averageSpeed = measured > 0 ? (distance / measured) * 3.6 : 0;

    const back = Math.max(0, frameIndex - fps);
    const recentTime = measured - stats.measured[back];
    if (recentTime > 0 && onPitchIds.has(selectedId ?? "")) {
      currentSpeed =
        ((distance - stats.distance[back]) / recentTime) * 3.6;
    }
  }

  return (
    <>
      {heading}
      <MatchIdentity range={rangeLabel} />

      <div className="analysis-layout">
        <section className="panel">
          <p className="panel-meta">
            <span className="live-dot" aria-hidden="true"></span>
            On the pitch at this frame: {visibleCount("home")} home ·{" "}
            {visibleCount("away")} away
            <span className="panel-meta-muted">
              {players.length} players tracked in the match · {fps} Hz
            </span>
          </p>

          <div className={`pitch-container${isLoading ? " loading" : ""}`}>
            <Pitch label={`Tracking replay, ${rangeLabel}`}>
              {/* MOVEMENT TRAIL */}
              {trail && (
                <polyline
                  points={trail}
                  fill="none"
                  stroke="#f1d18d"
                  strokeOpacity={0.8}
                  strokeWidth={0.45}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* ALL PLAYERS AT THE SAME FRAME */}
              {onPitch.map(({ player, x, y }) => (
                <PlayerMarker
                  key={player.id}
                  player={player}
                  x={x}
                  y={y}
                  selected={player.id === selectedId}
                  onSelect={onSelect}
                />
              ))}

              {/* BALL */}
              {ballX != null && ballY != null && (
                <circle
                  className="ball"
                  cx={toPitchX(ballX)}
                  cy={toPitchY(ballY)}
                  r={0.7}
                  fill="#ffffff"
                  stroke="#1f2a24"
                  strokeWidth={0.2}
                  pointerEvents="none"
                />
              )}
            </Pitch>

            {isLoading && (
              <div className="pitch-overlay">Loading tracking window…</div>
            )}
          </div>

          {/* PLAYBACK CONTROLS */}
          <div className="playback">
            <button
              type="button"
              className="control-button primary"
              onClick={togglePlayback}
              disabled={isLoading}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              type="button"
              className="control-button"
              onClick={restart}
              disabled={isLoading}
            >
              Restart
            </button>

            <input
              type="range"
              className="timeline"
              min={0}
              max={frameCount - 1}
              step={1}
              value={frameIndex}
              onChange={(event) =>
                seek(Number(event.target.value) / fps)
              }
              aria-label="Playback timeline"
            />

            <span className="playback-time">
              {matchClock(clip.period, clipStart + elapsed)}
              {" / "}
              {matchClock(clip.period, clipEnd)}
            </span>

            <div className="segmented" role="group" aria-label="Speed">
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === speed ? "active" : ""}
                  aria-pressed={value === speed}
                  onClick={() => setSpeed(value)}
                >
                  {value}×
                </button>
              ))}
            </div>
          </div>

          {/* PITCH INFORMATION */}
          <div className="pitch-footer">
            <span className="legend">
              <span className="legend-item">
                <span className="legend-dot home"></span>Home
              </span>
              <span className="legend-item">
                <span className="legend-dot away"></span>Away
              </span>
              <span className="legend-item">
                <span className="legend-dot ball"></span>Ball
              </span>
              <span className="legend-item">
                <span className="legend-line"></span>Selected trail
              </span>
            </span>

            <span className="frame-info">
              Frame {clip.frames[frameIndex].toLocaleString()}
              {" · "}
              Time {currentTime.toFixed(2)} s
            </span>
          </div>
        </section>

        {/* SELECTED PLAYER AND PLAYER LIST */}
        <aside className="analysis-side">
          <section className="panel compact-panel">
            {selected ? (
              <SelectedPlayer
                player={selected}
                played={playedRange(selected, summary.periods)}
                onPitch={onPitchIds.has(selected.id)}
                distance={distance}
                averageSpeed={averageSpeed}
                currentSpeed={currentSpeed}
                fullTrail={fullTrail}
                onToggleTrail={setFullTrail}
                onOpenProfile={() => onOpenProfile(selected.id)}
              />
            ) : (
              <p className="empty-hint">
                Click a numbered marker on the pitch or choose a player
                below to follow their movement.
              </p>
            )}
          </section>

          <section className="panel compact-panel">
            {(["home", "away"] as Team[]).map((team) => (
              <div key={team} className="roster">
                <h3>
                  <span className={`legend-dot ${team}`}></span>
                  {TEAM_LABEL[team]}
                  <span className="roster-count">
                    {visibleCount(team)} on pitch · {trackedCount(team)}{" "}
                    tracked
                  </span>
                </h3>

                <div className="roster-grid">
                  {players
                    .filter((p) => p.team === team)
                    .map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        className={`roster-chip ${team}${
                          player.id === selectedId ? " selected" : ""
                        }${onPitchIds.has(player.id) ? "" : " off"}`}
                        title={`${playerLabel(player)} · ${player.column}${
                          onPitchIds.has(player.id) ? "" : " · not on pitch"
                        }`}
                        aria-pressed={player.id === selectedId}
                        onClick={() => onSelect(player.id)}
                      >
                        {player.number}
                      </button>
                    ))}
                </div>
              </div>
            ))}

            <p className="roster-note">
              Faded numbers have no recorded coordinates at this frame:
              substitutes before they come on, or players already
              substituted off.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

type SelectedPlayerProps = {
  player: MatchPlayer;
  played: string;
  onPitch: boolean;
  distance: number;
  averageSpeed: number;
  currentSpeed: number | null;
  fullTrail: boolean;
  onToggleTrail: (full: boolean) => void;
  onOpenProfile: () => void;
};

function SelectedPlayer({
  player,
  played,
  onPitch,
  distance,
  averageSpeed,
  currentSpeed,
  fullTrail,
  onToggleTrail,
  onOpenProfile,
}: SelectedPlayerProps) {
  return (
    <div className="selected-player">
      <div className="selected-heading">
        <span className={`jersey ${player.team}`}>{player.number}</span>
        <div>
          <strong>{playerLabel(player)}</strong>
          <span>
            {player.column} · {player.starter ? "Starter" : "Substitute"} ·{" "}
            {played}
          </span>
        </div>
      </div>

      {!onPitch && (
        <p className="off-pitch">
          No recorded coordinates at this frame.
        </p>
      )}

      <dl className="mini-stats">
        <div>
          <dt>Distance in window</dt>
          <dd>{distance.toFixed(0)} m</dd>
        </div>
        <div>
          <dt>Average speed</dt>
          <dd>{averageSpeed.toFixed(1)} km/h</dd>
        </div>
        <div>
          <dt>Current speed</dt>
          <dd>
            {currentSpeed === null ? "—" : `${currentSpeed.toFixed(1)} km/h`}
          </dd>
        </div>
        <div>
          <dt>Full match</dt>
          <dd>{(player.distance_m / 1000).toFixed(2)} km</dd>
        </div>
      </dl>

      <div className="selected-actions">
        <div className="segmented" role="group" aria-label="Trail length">
          <button
            type="button"
            className={fullTrail ? "" : "active"}
            aria-pressed={!fullTrail}
            onClick={() => onToggleTrail(false)}
          >
            Last {TRAIL_SECONDS}s
          </button>
          <button
            type="button"
            className={fullTrail ? "active" : ""}
            aria-pressed={fullTrail}
            onClick={() => onToggleTrail(true)}
          >
            Full trail
          </button>
        </div>
        <button
          type="button"
          className="control-button"
          onClick={onOpenProfile}
        >
          View profile
        </button>
      </div>
    </div>
  );
}

export default MatchAnalysisPage;
