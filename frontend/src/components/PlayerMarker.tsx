import type { MatchPlayer } from "../api";
import {
  playerLabel,
  SELECTED_COLOR,
  TEAM_COLORS,
  toPitchX,
  toPitchY,
} from "../match";

type PlayerMarkerProps = {
  player: MatchPlayer;
  x: number;
  y: number;
  selected: boolean;
  dimmed?: boolean;
  onSelect: (id: string) => void;
};

// Jersey-style numbered marker, clickable and keyboard accessible
function PlayerMarker({
  player,
  x,
  y,
  selected,
  dimmed = false,
  onSelect,
}: PlayerMarkerProps) {
  const cx = toPitchX(x);
  const cy = toPitchY(y);

  return (
    <g
      className={`marker marker-${player.team}${selected ? " selected" : ""}`}
      opacity={dimmed ? 0.45 : 1}
      role="button"
      tabIndex={0}
      aria-label={`${playerLabel(player)} (${player.column})`}
      aria-pressed={selected}
      onClick={() => onSelect(player.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(player.id);
        }
      }}
    >
      <title>{`${playerLabel(player)} · ${player.column}`}</title>

      {/* Larger invisible hit area makes small markers easy to click */}
      <circle cx={cx} cy={cy} r={2.6} fill="transparent" />

      {selected && (
        <circle
          className="marker-ring"
          cx={cx}
          cy={cy}
          r={2.3}
          fill="none"
          stroke={SELECTED_COLOR}
          strokeWidth={0.45}
        />
      )}

      <circle
        className="marker-body"
        cx={cx}
        cy={cy}
        r={1.45}
        fill={TEAM_COLORS[player.team]}
        stroke="#ffffff"
        strokeWidth={0.3}
      />

      {/* The SVG is drawn in metres, so the font size is in metres too.
          Explicit attributes stop the page's 18px font size leaking in. */}
      <text
        className="marker-number"
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={1.45}
        fontWeight={700}
        fontFamily="Inter, 'Segoe UI', Arial, sans-serif"
        fill="#ffffff"
        pointerEvents="none"
      >
        {player.number}
      </text>
    </g>
  );
}

export default PlayerMarker;
