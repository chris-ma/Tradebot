interface ConfidenceBadgeProps {
  score: number;
  /** The strategy's high_conviction_confidence_threshold param. */
  threshold: number;
}

/**
 * Green "High Conviction" badge when the confidence score clears the
 * strategy threshold, amber "Moderate" tier below it.
 */
export default function ConfidenceBadge({ score, threshold }: ConfidenceBadgeProps) {
  const value = Number(score);
  const high = value >= threshold;
  const label = high ? "High Conviction" : "Moderate";
  const classes = high
    ? "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
    : "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${classes}`}
    >
      {label}
      <span className="font-mono font-normal opacity-80">{value.toFixed(0)}/100</span>
    </span>
  );
}
