# REZON ADD — Amendments Log
**Dated corrections layered on top of the frozen `REZON_ADD.md`. The ADD is never edited directly.**

---

### AMENDMENT-001 — §15.1 Data Flow: a scoped local→cloud summary channel is added

**Amends:** ADD §15.1, the statement "No bidirectional sync exists, by design."

**Correction:** That statement described *raw telemetry* flow correctly and remains true for raw data — device→cloud→local stays strictly one-directional. What the original ADD did not anticipate: the public frontend's Analytics zone (§17.3) requires historical depth that the cloud tier, as originally scoped ("recent-and-relational, not full-history," §13.2), cannot serve, because the deep archive lives local-only.

**Resolution (DEC-003):** a second, narrow channel is added — the local tier periodically pushes **aggregated summaries only** (never raw telemetry) up to a small new Supabase table, feeding the public Analytics view. The original one-directional principle for raw data is preserved; this is an additive, scoped exception for summaries, not a reversal of the architecture's core data-flow philosophy.

**Reason this wasn't caught at design time:** the cloud/local split (§12-15) and the frontend spec (§17) were designed and reviewed in different passes and never cross-checked against each other end-to-end — exactly the class of gap a dedicated consistency audit (Phase A, this project's methodology) exists to catch.

---

### AMENDMENT-002 — §10.2 Training Compute: local GPU replaces Google Colab as primary

**Amends:** ADD §10.2, "Training runs on free, session-based GPU compute (Google Colab)."

**Correction:** Colab was the right call when local GPU availability was unknown. The developer has since confirmed real local GPU access (RTX 3050, 4GB VRAM). Given the IDNN's small size (~55K parameters, AI/ML Technical Spec §2), compute was never the actual bottleneck Colab was solving for — local training removes session-timeout risk, upload/download friction, and free-tier availability dependency, with no real downside.

**Resolution (DEC-010):** local GPU is now primary training compute; Colab remains an occasional fallback (e.g., if local GPU is occupied by the anomaly-synthesis generative model concurrently — AI/ML Technical Spec §10).

**Also formalized in this amendment:** the data augmentation strategy (AI/ML Technical Spec §10) — sophisticated real-data augmentation (SpecAugment, mixup, RIR convolution) for the normal class, pretrained generative synthesis conditioned on real seeds for the anomaly class only, consistent with and expanding on ADD §10.3's original brief mention.

**Also formalized:** SW-420 promoted from passive backup mention (ADD §7.3) to an active hardware-corroboration diagnostic (AI/ML Technical Spec §6.5, Firmware Technical Spec §2.1) — logs agreement/disagreement with MPU-6050-detected vibration events, never gates the actuation decision itself.
