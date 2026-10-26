import type { ReactNode } from "react";
import { PITCH_LENGTH as L, PITCH_WIDTH as W } from "../match";

const MARGIN = 3;
const LINE = "rgba(255, 255, 255, 0.72)";
const STRIPES = 14;

type PitchProps = {
  children?: ReactNode;
  label: string;
};

function Pitch({ children, label }: PitchProps) {
  const boxTop = W / 2 - 20.16;
  const goalAreaTop = W / 2 - 9.16;
  const arcY = 7.312;

  return (
    <svg
      viewBox={`${-MARGIN} ${-MARGIN} ${L + MARGIN * 2} ${W + MARGIN * 2}`}
      className="pitch"
      role="img"
      aria-label={label}
    >
      <rect
        x={-MARGIN}
        y={-MARGIN}
        width={L + MARGIN * 2}
        height={W + MARGIN * 2}
        fill="#2a6b48"
      />

      {/* MOWING STRIPES */}
      {Array.from({ length: STRIPES }, (_, i) =>
        i % 2 === 0 ? (
          <rect
            key={i}
            x={(L / STRIPES) * i}
            y={0}
            width={L / STRIPES}
            height={W}
            fill="#2f7550"
          />
        ) : null
      )}

      <g fill="none" stroke={LINE} strokeWidth={0.22}>
        {/* TOUCHLINES AND HALFWAY LINE */}
        <rect x={0} y={0} width={L} height={W} />
        <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
        <circle cx={L / 2} cy={W / 2} r={9.15} />

        {/* PENALTY AREAS */}
        <rect x={0} y={boxTop} width={16.5} height={40.32} />
        <rect x={L - 16.5} y={boxTop} width={16.5} height={40.32} />

        {/* GOAL AREAS */}
        <rect x={0} y={goalAreaTop} width={5.5} height={18.32} />
        <rect x={L - 5.5} y={goalAreaTop} width={5.5} height={18.32} />

        {/* PENALTY ARCS */}
        <path
          d={`M16.5 ${W / 2 - arcY} A9.15 9.15 0 0 1 16.5 ${W / 2 + arcY}`}
        />
        <path
          d={`M${L - 16.5} ${W / 2 - arcY} A9.15 9.15 0 0 0 ${L - 16.5} ${W / 2 + arcY}`}
        />

        {/* CORNER ARCS */}
        <path d="M1 0 A1 1 0 0 1 0 1" />
        <path d={`M${L - 1} 0 A1 1 0 0 0 ${L} 1`} />
        <path d={`M0 ${W - 1} A1 1 0 0 1 1 ${W}`} />
        <path d={`M${L} ${W - 1} A1 1 0 0 0 ${L - 1} ${W}`} />

        {/* GOALS */}
        <rect x={-1.6} y={W / 2 - 3.66} width={1.6} height={7.32} />
        <rect x={L} y={W / 2 - 3.66} width={1.6} height={7.32} />
      </g>

      {/* SPOTS */}
      <g fill={LINE}>
        <circle cx={L / 2} cy={W / 2} r={0.35} />
        <circle cx={11} cy={W / 2} r={0.3} />
        <circle cx={L - 11} cy={W / 2} r={0.3} />
      </g>

      {children}
    </svg>
  );
}

export default Pitch;
