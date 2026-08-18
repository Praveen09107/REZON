"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { generateNarrative } from "@/lib/generate-narrative";
import { ModalityBreakdown } from "@/components/incidents/modality-breakdown";
import { useIsOperator } from "@/lib/auth-context";

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isOperator = useIsOperator();
  const supabase = createClient();

  const { data: incident, refetch } = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("anomaly_events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  async function label(value: "confirmed" | "false_alarm") {
    // Write path — Frontend Spec §4: real enforcement is RLS (Backend
    // Spec §2, operator-only UPDATE policy), this client-side
    // isOperator check is UX only, matching Session 11's established pattern.
    await supabase.from("anomaly_events").update({ human_label: value }).eq("id", id);
    refetch();
  }

  if (!incident) return <div className="text-text-2">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-text">{generateNarrative(incident)}</p>
      </div>
      <ModalityBreakdown contributingModalities={incident.contributing_modalities} />
      {isOperator && (
        <div className="flex gap-2">
          <button onClick={() => label("confirmed")}
            className="rounded bg-danger-bg px-3 py-1.5 text-sm text-danger">Confirm</button>
          <button onClick={() => label("false_alarm")}
            className="rounded bg-calm-bg px-3 py-1.5 text-sm text-calm">False alarm</button>
        </div>
      )}
    </div>
  );
}
