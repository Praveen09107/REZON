import type { TelemetryRow } from "@/lib/api-client";

export interface HypotheticalThresholds {
  alertThreshold: number;
  responseThreshold: number;
  elevatedThreshold: number;
}

export interface ReplayResult {
  row: TelemetryRow;
  wouldAlert: boolean;
  wouldBeCandidate: boolean;   // response threshold + corroboration met
  corroboratingCount: number;
}

const SCORE_KEYS: (keyof TelemetryRow)[] = [
  "audio_score", "vibration_score", "env_score", "gas_score", "current_score",
];

// Direct re-application of AI/ML Spec §7.3-7.4's real logic against
// ALREADY-NORMALIZED, already-stored scores — this does not re-derive
// normalization from raw values (that would require duplicating the
// full rolling-stats pipeline in JS, which is real work with no real
// benefit here: the stored normalized scores ARE the real values the
// device actually computed at the time). What varies is purely the
// THRESHOLD comparison, which is exactly what "what if the threshold
// were different" means.
export function replayWithThresholds(
  rows: TelemetryRow[], thresholds: HypotheticalThresholds
): ReplayResult[] {
  return rows.map((row) => {
    const corroboratingCount = SCORE_KEYS.filter(
      (key) => (row[key] as number) >= thresholds.elevatedThreshold
    ).length;

    const wouldAlert = row.fused_score >= thresholds.alertThreshold;
    const wouldBeCandidate =
      row.fused_score >= thresholds.responseThreshold && corroboratingCount >= 2;

    return { row, wouldAlert, wouldBeCandidate, corroboratingCount };
  });
}

export function summarizeReplay(results: ReplayResult[]) {
  return {
    totalRows: results.length,
    hypotheticalAlerts: results.filter((r) => r.wouldAlert).length,
    hypotheticalActuationCandidates: results.filter((r) => r.wouldBeCandidate).length,
  };
}
