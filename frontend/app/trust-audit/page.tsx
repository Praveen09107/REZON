import { SAFETY_MECHANISMS } from "@/lib/trust-audit-content";

export default function TrustAuditPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-text-2">
        Every mechanism below is real, implemented, and traceable to the specific
        specification and engineering decision that established it — not a general
        claim about safety practices.
      </p>
      {SAFETY_MECHANISMS.map((mech) => (
        <div key={mech.name} className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-1.5 text-base font-semibold text-text">{mech.name}</h3>
          <p className="mb-3 text-sm text-text-2">{mech.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-calm-bg px-2 py-1 text-calm">{mech.realValue}</span>
            <span className="rounded bg-surface-2 px-2 py-1 text-text-3">{mech.specReference}</span>
            {mech.decisionReference && (
              <span className="rounded bg-surface-2 px-2 py-1 text-text-3">{mech.decisionReference}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
