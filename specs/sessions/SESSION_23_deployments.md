# SESSION 23 — Deployments (OTA Control Surface)
**Risk tier: ROUTINE (frontend) — but this page triggers a real safety-relevant device action (a model swap), so its write path is treated carefully.**
**Branch: `session/build-23-deployments`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §1 (model_registry, re-verified), `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §6 (OTA states, re-verified)**

---

## Agent Instructions

Build the model deployment history and staging view. **This page does not itself push a model to the device** — per Firmware Spec §6, the device polls `/models/latest` on its own periodic cycle (IDLE state); the frontend's job is showing what's staged and what history exists, not directly commanding the device. Confirming this explicitly here because it would be an easy, wrong assumption to build a "deploy now" button that tries to push — that's not how the real architecture works.

**What this session creates:**
- `frontend/app/deployments/page.tsx`

---

## FILE 1: `frontend/app/deployments/page.tsx`

```typescript
"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";

interface ModelRow {
  id: string; version: string; held_out_auc: number;
  checksum_sha256: string; status: string; created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  active: "text-calm bg-calm-bg",
  staged: "text-elevated bg-elevated-bg",
  archived: "text-text-3 bg-surface-2",
  rolled_back: "text-danger bg-danger-bg",
};

export default function DeploymentsPage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<ModelRow>(
    ["deployments"], "model_registry", { orderBy: "created_at" }
  );

  const staged = (data ?? []).find((m) => m.status === "staged");

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      {staged && (
        <div className="mb-5 rounded-xl border border-elevated bg-elevated-bg p-5">
          <div className="mb-2 text-sm font-medium text-elevated">
            Model {staged.version} is staged and validated
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-text-2">
            <div>Held-out AUC: <span className="text-text">{staged.held_out_auc.toFixed(3)}</span></div>
            <div>Checksum: <span className="text-text font-mono">{staged.checksum_sha256.slice(0, 12)}…</span></div>
            <div>Staged: <span className="text-text">{new Date(staged.created_at).toLocaleDateString()}</span></div>
          </div>
          <p className="mt-3 text-xs text-text-3">
            The device adopts this automatically on its next OTA check cycle
            (Firmware Spec §6) — checksum-verified, dry-run tested, atomically
            swapped. This page reflects that process; it does not trigger it.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 text-xs text-text-2">Deployment history</div>
        {(data ?? []).map((model) => (
          <div key={model.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
            <span className="text-sm text-text">{model.version}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-3">AUC {model.held_out_auc.toFixed(3)}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[model.status] ?? "text-text-2 bg-surface-2"}`}>
                {model.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ResilienceWrapper>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** Insert a real `model_registry` row with `status: 'staged'` — confirm the staged-model banner appears with the real AUC and checksum values. Insert additional rows with `status: 'active'`, `'archived'`, `'rolled_back'` — confirm each renders with its correct distinct color in the history list.

**Step 3 (the important negative check):** confirm there is genuinely no button, form, or code path on this page that calls anything resembling "push model to device" — this page is read-only by design, and that design needs to actually hold, not just be described in a comment.

## Known open items
None.
