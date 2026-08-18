// Static content, same pattern as Session 21's Trust Audit — real,
// specific explanation, not generic product-tour copy.
import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="max-w-2xl space-y-5 text-sm text-text-2">
      <section>
        <h2 className="mb-2 text-base font-semibold text-text">How REZON works</h2>
        <p>
          REZON watches this space using five independent sensing channels — sound,
          vibration, temperature/humidity/pressure, air quality, and the electrical
          current drawn by the machine it can control. Each channel scores itself
          against its own learned baseline for this specific space; the five scores
          combine into one fused judgment.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-text">Why it can act on its own</h2>
        <p>
          If at least two independent channels agree something is genuinely wrong —
          not just one — and that condition holds steady for several seconds, REZON
          can cut power to the monitored machine automatically. See the{" "}
          <Link href="/trust-audit" className="text-calm underline">Trust Audit</Link> page
          for the exact real values behind every safety gate.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-text">Why some numbers change over time</h2>
        <p>
          REZON deployed with a model trained on public sound data, then spent its
          first one to two weeks quietly learning this specific room before it was
          trusted to alert or act — see the{" "}
          <Link href="/since-calibration" className="text-calm underline">Since Calibration</Link> page.
        </p>
      </section>
    </div>
  );
}
