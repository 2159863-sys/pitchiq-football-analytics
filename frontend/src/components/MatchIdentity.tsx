import { DATA_SOURCE_URL } from "../match";

type MatchIdentityProps = {
  // Analysed time range, e.g. "1st half · 00:00–01:00"
  range: string;
};

// Context bar naming the analysed window, the teams and the data source,
// so every screenshot shows where the data comes from
function MatchIdentity({ range }: MatchIdentityProps) {
  return (
    <dl className="match-context">
      <div className="context-item">
        <dt>Analysis window</dt>
        <dd className="numeric-text">{range}</dd>
      </div>

      <div className="context-item">
        <dt>Teams</dt>
        <dd className="context-teams">
          <span className="team-chip home">Home</span>
          <span className="context-vs">vs</span>
          <span className="team-chip away">Away</span>
        </dd>
      </div>

      <div className="context-item source">
        <dt>Data source</dt>
        <dd>
          Data provided by{" "}
          <a href={DATA_SOURCE_URL} target="_blank" rel="noreferrer">
            Metrica Sports
          </a>
          <span className="context-note">
            Sample Game 1 · player, club and competition names not disclosed
          </span>
        </dd>
      </div>
    </dl>
  );
}

export default MatchIdentity;
