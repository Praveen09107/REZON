// The single source of truth for score->color mapping, importable by
// any component (digital twin, streams, etc.) rather than each page
// re-implementing the same three-way threshold check.
// One place to update if AI/ML Spec §7.3's thresholds ever change.

export type ScoreColorToken = "calm" | "elevated" | "danger";

export function scoreToColorToken(normalizedScore: number): ScoreColorToken {
  if (normalizedScore >= 0.85) return "danger";   // AI/ML Spec §7.3
  if (normalizedScore >= 0.75) return "elevated";
  return "calm";
}

export function scoreColorClass(normalizedScore: number, variant: "text" | "bg" = "text"): string {
  const token = scoreToColorToken(normalizedScore);
  return variant === "text" ? `text-${token}` : `bg-${token}-bg`;
}
