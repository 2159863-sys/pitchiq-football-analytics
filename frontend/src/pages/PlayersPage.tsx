import { useState } from "react";
import type {
  MatchPeriod,
  MatchPlayer,
  MatchSummary,
  Team,
} from "../api";
import Pitch from "../components/Pitch";
import {
  formatClock,
  matchClock,
  periodName,
  playedRange,
  playerLabel,
  TEAM_COLORS,
  TEAM_LABEL,
  toPitchX,
  toPitchY,
} from "../match";

type SortKey =
  | "number"
  | "minutes_played"
  | "distance_m"
  | "average_speed_kmh"
  | "top_speed_kmh"
  | "high_speed_distance_m"
  | "sprint_distance_m";

const COLUMNS: { key: SortKey; label: string; unit?: string }[] = [
  { key: "distance_m", label: "Distance", unit: "km" },
  { key: "average_speed_kmh", label: "Avg speed", unit: "km/h" },
  { key: "top_speed_kmh", label: "Top speed", unit: "km/h" },
  { key: "high_speed_distance_m", label: "High speed", unit: "m" },
  { key: "sprint_distance_m", label: "Sprint", unit: "m" },
];

type TeamFilter = "all" | Team;

type PlayersPageProps = {
  summary: MatchSummary;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onWatch: (id: string) => void;
};

function formatStat(key: SortKey, value: number) {
  if (key === "distance_m") return (value / 1000).toFixed(2);
  if (key === "high_speed_distance_m" || key === "sprint_distance_m") {
    return value.toFixed(0);
  }
  return value.toFixed(1);
}

function PlayersPage({
  summary,
  selectedId,
  onSelect,
  onWatch,
}: PlayersPageProps) {
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("distance_m");
  const [descending, setDescending] = useState(true);

  const selected =
    summary.players.find((p) => p.id === selectedId) ?? null;
  const homeCount = summary.players.filter((p) => p.team === "home").length;
  const awayCount = summary.players.length - homeCount;

  const rows = summary.players
    .filter((p) => teamFilter === "all" || p.team === teamFilter)
    .sort((a, b) => {
      const difference = a[sortKey] - b[sortKey];
      return descending ? -difference : difference;
    });

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setDescending(!descending);
    } else {
      setSortKey(key);
      setDescending(key !== "number");
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null;
    return <span className="sort-arrow">{descending ? "↓" : "↑"}</span>;
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SQUAD TRACKING</p>
          <h1>Player Statistics</h1>
          <p className="description">
            {summary.players.length} players tracked across the match (
            {homeCount} home, {awayCount} away), read from the Metrica CSV
            headers. Statistics are calculated from recorded coordinates.
          </p>
        </div>

        <div className="segmented large" role="group" aria-label="Team">
          {(["all", "home", "away"] as TeamFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              className={value === teamFilter ? "active" : ""}
              aria-pressed={value === teamFilter}
              onClick={() => setTeamFilter(value)}
            >
              {value === "all" ? "All players" : TEAM_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="players-layout">
        <section className="panel table-panel">
          <div className="table-scroll">
            <table className="players-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => sortBy("number")}>
                      Player {sortIndicator("number")}
                    </button>
                  </th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>Tracked</th>
                  {COLUMNS.map((column) => (
                    <th key={column.key} className="numeric">
                      <button
                        type="button"
                        onClick={() => sortBy(column.key)}
                      >
                        {column.label}
                        {sortIndicator(column.key)}
                        {column.unit && (
                          <span className="unit">{column.unit}</span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((player) => (
                  <tr
                    key={player.id}
                    className={player.id === selectedId ? "selected" : ""}
                    onClick={() => onSelect(player.id)}
                  >
                    <td>
                      <button
                        type="button"
                        className="player-cell"
                        aria-pressed={player.id === selectedId}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(player.id);
                        }}
                      >
                        <span className={`jersey small ${player.team}`}>
                          {player.number}
                        </span>
                        {player.column}
                      </button>
                    </td>
                    <td>
                      <span className={`team-chip ${player.team}`}>
                        {TEAM_LABEL[player.team]}
                      </span>
                    </td>
                    <td className="muted">
                      {player.starter ? "Starter" : "Substitute"}
                    </td>
                    <td className="muted numeric-text">
                      {playedRange(player, summary.periods)}
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column.key} className="numeric">
                        {formatStat(column.key, player[column.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="table-note">
            Player identifiers and numbers come from the CSV headers of
            Metrica Sports Sample Game 1; real names are not part of the
            anonymized dataset. The app&apos;s test records in the database are
            not used here. “Tracked” is the match-clock interval with
            recorded coordinates. High speed ≥ 19.8 km/h, sprint ≥ 25.2 km/h,
            measured over 0.2 s steps.
          </p>
        </section>

        <aside className="panel profile-panel">
          {selected ? (
            <PlayerProfile
              player={selected}
              periods={summary.periods}
              onWatch={() => onWatch(selected.id)}
            />
          ) : (
            <p className="empty-hint">
              Select a player in the table to see their profile and
              average position.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

type PlayerProfileProps = {
  player: MatchPlayer;
  periods: MatchPeriod[];
  onWatch: () => void;
};

function PlayerProfile({ player, periods, onWatch }: PlayerProfileProps) {
  const halves = Object.entries(player.average_position);

  // Describe when a substitute came on, using the match clock
  let appearance = "Started the match";
  if (!player.starter && player.first_seen_period !== null) {
    const periodStart =
      periods.find((p) => p.period === player.first_seen_period)
        ?.start_time ?? 0;
    appearance = `Came on at ${matchClock(
      player.first_seen_period,
      (player.first_seen_time ?? 0) - periodStart
    )} (${periodName(player.first_seen_period)})`;
  }

  return (
    <div className="profile">
      <div className="selected-heading">
        <span className={`jersey ${player.team}`}>{player.number}</span>
        <div>
          <strong>{playerLabel(player)}</strong>
          <span>
            {player.column} · {appearance}
          </span>
        </div>
      </div>

      <dl className="mini-stats">
        <div>
          <dt>Distance</dt>
          <dd>{(player.distance_m / 1000).toFixed(2)} km</dd>
        </div>
        <div>
          <dt>Time tracked</dt>
          <dd>{formatClock(player.minutes_played * 60)}</dd>
        </div>
        <div>
          <dt>Average speed</dt>
          <dd>{player.average_speed_kmh.toFixed(1)} km/h</dd>
        </div>
        <div>
          <dt>Top speed</dt>
          <dd>{player.top_speed_kmh.toFixed(1)} km/h</dd>
        </div>
        <div>
          <dt>High-speed running</dt>
          <dd>{player.high_speed_distance_m.toFixed(0)} m</dd>
        </div>
        <div>
          <dt>Sprinting</dt>
          <dd>{player.sprint_distance_m.toFixed(0)} m</dd>
        </div>
      </dl>

      <h3 className="profile-subheading">Average position</h3>
      <div className="pitch-container small">
        <Pitch label={`Average position of ${playerLabel(player)}`}>
          {halves.map(([half, position]) => (
            <g key={half}>
              <circle
                className={`avg-marker marker-${player.team}`}
                cx={toPitchX(position.x)}
                cy={toPitchY(position.y)}
                r={2.4}
                fill={TEAM_COLORS[player.team]}
                stroke="#ffffff"
                strokeWidth={0.3}
              />
              <text
                className="avg-label"
                x={toPitchX(position.x)}
                y={toPitchY(position.y)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={1.6}
                fontWeight={700}
                fontFamily="Inter, 'Segoe UI', Arial, sans-serif"
                fill="#ffffff"
              >
                {half === "1" ? "1H" : "2H"}
              </text>
            </g>
          ))}
        </Pitch>
      </div>
      <p className="table-note">
        Mean recorded position per half. Teams switch ends at half-time.
      </p>

      <button
        type="button"
        className="control-button primary wide"
        onClick={onWatch}
      >
        Watch in Match Analysis
      </button>
    </div>
  );
}

export default PlayersPage;
