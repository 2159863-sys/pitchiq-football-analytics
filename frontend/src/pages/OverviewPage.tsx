import { useState } from "react";
import type { MatchSummary, Team } from "../api";
import MatchIdentity from "../components/MatchIdentity";
import Pitch from "../components/Pitch";
import PlayerMarker from "../components/PlayerMarker";
import { formatClock, periodName, playerLabel, TEAM_LABEL } from "../match";

const LEADER_COUNT = 8;

type OverviewPageProps = {
  summary: MatchSummary;
  selectedId: string | null;
  onOpenProfile: (id: string) => void;
  onOpenReplay: () => void;
};

function OverviewPage({
  summary,
  selectedId,
  onOpenProfile,
  onOpenReplay,
}: OverviewPageProps) {
  const [half, setHalf] = useState(1);

  const players = summary.players;
  const trackedSeconds = summary.periods.reduce(
    (total, p) => total + p.duration,
    0
  );

  const teamTotals = (["home", "away"] as Team[]).map((team) => {
    const squad = players.filter((p) => p.team === team);
    const sum = (key: "distance_m" | "high_speed_distance_m" | "sprint_distance_m") =>
      squad.reduce((total, p) => total + p[key], 0);

    return {
      team,
      columns: squad.length,
      used: squad.filter((p) => p.minutes_played > 0).length,
      distance: sum("distance_m"),
      highSpeed: sum("high_speed_distance_m"),
      sprint: sum("sprint_distance_m"),
    };
  });

  const starters = players.filter((p) => p.starter).length;

  const leaders = [...players]
    .sort((a, b) => b.distance_m - a.distance_m)
    .slice(0, LEADER_COUNT);
  const maxDistance = leaders[0]?.distance_m ?? 1;

  const halfLengths = summary.periods
    .map((p) => `${periodName(p.period)} ${formatClock(p.duration)}`)
    .join(" · ");

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MATCH INTELLIGENCE</p>
          <h1>Match Overview</h1>
          <p className="description">
            Physical output and team shape calculated from the full
            recorded tracking data.
          </p>
        </div>

        <button
          type="button"
          className="control-button primary"
          onClick={onOpenReplay}
        >
          Open match replay
        </button>
      </div>

      <MatchIdentity range={`Full match · ${halfLengths}`} />

      {/* MATCH KPIs */}
      <div className="stats-grid four">
        <div className="stat-card">
          <span className="stat-label">Tracked duration</span>
          <strong>{formatClock(trackedSeconds)}</strong>
          <span className="stat-detail">
            {summary.periods.length} halves recorded
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Tracking frames</span>
          <strong>{summary.total_frames.toLocaleString()}</strong>
          <span className="stat-detail">
            {summary.fps} Hz · home and away aligned
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Unique players tracked</span>
          <strong>{players.length}</strong>
          <span className="stat-detail">
            {teamTotals[0].columns} home · {teamTotals[1].columns} away ·{" "}
            {starters} started, {players.length - starters} came on
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total distance</span>
          <strong>
            {(
              (teamTotals[0].distance + teamTotals[1].distance) /
              1000
            ).toFixed(1)}{" "}
            km
          </strong>
          <span className="stat-detail">Both teams combined</span>
        </div>
      </div>

      <div className="overview-layout">
        {/* AVERAGE POSITIONS */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Average Positions</h2>
              <p>Mean recorded position of every player, per half</p>
            </div>

            <div className="segmented" role="group" aria-label="Half">
              {summary.periods.map((p) => (
                <button
                  key={p.period}
                  type="button"
                  className={p.period === half ? "active" : ""}
                  aria-pressed={p.period === half}
                  onClick={() => setHalf(p.period)}
                >
                  {periodName(p.period)}
                </button>
              ))}
            </div>
          </div>

          <div className="pitch-container">
            <Pitch label={`Average positions, ${periodName(half)}`}>
              {players.map((player) => {
                const position = player.average_position[String(half)];
                if (!position) return null;

                return (
                  <PlayerMarker
                    key={player.id}
                    player={player}
                    x={position.x}
                    y={position.y}
                    selected={player.id === selectedId}
                    dimmed={!player.starter}
                    onSelect={onOpenProfile}
                  />
                );
              })}
            </Pitch>
          </div>

          <div className="pitch-footer">
            <span className="legend">
              <span className="legend-item">
                <span className="legend-dot home"></span>Home
              </span>
              <span className="legend-item">
                <span className="legend-dot away"></span>Away
              </span>
              <span className="legend-item muted">
                Faded markers are substitutes
              </span>
            </span>
            <span>Click a player to open their profile</span>
          </div>
        </section>

        {/* DISTANCE LEADERS */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Distance Leaders</h2>
              <p>Total distance covered, full match</p>
            </div>
          </div>

          <ol className="leader-list">
            {leaders.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  className="leader-row"
                  title={`${playerLabel(player)} · ${(
                    player.distance_m / 1000
                  ).toFixed(2)} km in ${player.minutes_played} min`}
                  onClick={() => onOpenProfile(player.id)}
                >
                  <span className="leader-name">
                    <span className={`jersey small ${player.team}`}>
                      {player.number}
                    </span>
                    {playerLabel(player)}
                  </span>
                  <span className="leader-bar-track">
                    <span
                      className={`leader-bar ${player.team}`}
                      style={{
                        width: `${(player.distance_m / maxDistance) * 100}%`,
                      }}
                    ></span>
                  </span>
                  <span className="leader-value">
                    {(player.distance_m / 1000).toFixed(2)} km
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* TEAM COMPARISON */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Team Physical Output</h2>
            <p>Summed from every player column in each tracking file</p>
          </div>
        </div>

        <div className="team-compare">
          {teamTotals.map((totals) => (
            <div key={totals.team} className={`team-card ${totals.team}`}>
              <h3>
                <span className={`legend-dot ${totals.team}`}></span>
                {TEAM_LABEL[totals.team]}
              </h3>
              <dl className="mini-stats">
                <div>
                  <dt>Distance</dt>
                  <dd>{(totals.distance / 1000).toFixed(1)} km</dd>
                </div>
                <div>
                  <dt>High-speed running</dt>
                  <dd>{(totals.highSpeed / 1000).toFixed(2)} km</dd>
                </div>
                <div>
                  <dt>Sprinting</dt>
                  <dd>{(totals.sprint / 1000).toFixed(2)} km</dd>
                </div>
                <div>
                  <dt>Players used</dt>
                  <dd>{totals.used}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default OverviewPage;
