import { scoreToColorToken } from "@/lib/score-color";

interface ModalityBreakdownProps {
  contributingModalities: Record<string, number>;
}

// The explainability breakdown, made visible — turning the fusion
// logic's own computed per-modality contributions (Session 7's real
// output) into something a human reads, not just logs.
export function ModalityBreakdown({ contributingModalities }: ModalityBreakdownProps) {
  const entries = Object.entries(contributingModalities)
    .filter(([key]) => key !== "vibration_hw_confirmed");
  const hwConfirmed = contributingModalities["vibration_hw_confirmed"];

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="mb-2 text-xs text-text-2">Contributing modalities</div>
      {entries.map(([key, score]) => {
        const token = scoreToColorToken(score as number);
        return (
          <div key={key} className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-text-2">{key.replace("_score", "")}</span>
            <span className={`text-${token}`}>{(score as number).toFixed(2)}</span>
          </div>
        );
      })}
      {hwConfirmed !== undefined && (
        <div className="mt-2 border-t border-border pt-2 text-xs text-text-3">
          Hardware confirmation (SW-420): {hwConfirmed ? "✓ confirmed" : "⚠ not confirmed — see AI/ML Spec §7.5"}
        </div>
      )}
    </div>
  );
}
