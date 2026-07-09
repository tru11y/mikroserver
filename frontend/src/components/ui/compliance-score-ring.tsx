interface ComplianceScoreRingProps {
  score: number;
  criticals: number;
  warnings: number;
  size?: number;
}

export function ComplianceScoreRing({
  score,
  criticals,
  warnings,
  size = 64,
}: ComplianceScoreRingProps) {
  const strokeWidth = 6;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (score / 100) * circumference;
  const color =
    criticals > 0
      ? 'hsl(var(--destructive))'
      : warnings > 0
        ? 'hsl(var(--warning))'
        : 'hsl(var(--success))';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`Score de conformité : ${score} %`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute text-sm font-bold tabular-nums"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
