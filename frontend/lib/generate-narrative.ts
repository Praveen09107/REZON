// Direct TypeScript port of Frontend Spec §8's exact pseudocode —
// verified against the live spec before writing, not paraphrased.
interface Incident {
  recorded_at: string;
  event_type: string;
  contributing_modalities: Record<string, number>;
}

function resultingAction(eventType: string): string {
  switch (eventType) {
    case "actuation": return "triggering a response";
    case "alert": return "triggering an alert";
    case "suppressed_debounce": return "but was suppressed as a transient spike";
    case "suppressed_cooldown": return "but was suppressed by the actuation cooldown";
    default: return "was recorded";
  }
}

export function generateNarrative(incident: Incident): string {
  const sorted = Object.entries(incident.contributing_modalities)
    .filter(([key]) => key !== "vibration_hw_confirmed")  // not a score, exclude from ranking
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);

  const modalityLabel = (key: string) =>
    key.replace("_score", "").replace(/^\w/, (c) => c.toUpperCase());

  const template = sorted.length >= 2
    ? `${modalityLabel(sorted[0][0])} and ${modalityLabel(sorted[1][0])}`
    : sorted.length === 1
    ? modalityLabel(sorted[0][0])
    : "An anomaly";

  const sustained = incident.event_type === "actuation" ? ", sustained for the debounce window," : "";
  const time = new Date(incident.recorded_at).toLocaleString();

  return `${template} crossed threshold at ${time}${sustained}, ${resultingAction(incident.event_type)}.`;
}
