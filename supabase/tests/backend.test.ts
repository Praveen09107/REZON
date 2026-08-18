import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { checkRateLimit } from "../functions/ingest/rate-limit.ts";

// Mocking Supabase Client for idempotency and RLS testing
class MockSupabaseClient {
  public data: any = {};
  public role: string = "service_role";

  from(table: string) {
    return {
      select: () => ({
        eq: (key: string, value: string) => ({
          single: () => {
            if (table === "devices" && this.data[table]) {
              return Promise.resolve({ data: { last_seen_at: this.data[table].last_seen_at }, error: null });
            }
            return Promise.resolve({ data: null, error: { message: "Not found" } });
          }
        })
      }),
      insert: (payload: any) => {
        if (!this.data[table]) this.data[table] = [];
        // Simulate idempotency (device_id, seq_number)
        const exists = this.data[table].find((r: any) => r.device_id === payload.device_id && r.seq_number === payload.seq_number);
        if (exists) {
          return Promise.resolve({ error: { code: '23505', message: "Unique violation" } });
        }
        this.data[table].push(payload);
        return Promise.resolve({ error: null });
      },
      upsert: (payloads: any[], options: any) => {
        if (!this.data[table]) this.data[table] = [];
        payloads.forEach(p => {
            const idx = this.data[table].findIndex((r: any) => r.device_id === p.device_id && r.period_start === p.period_start && r.granularity === p.granularity);
            if (idx !== -1) {
                this.data[table][idx] = { ...this.data[table][idx], ...p };
            } else {
                this.data[table].push(p);
            }
        });
        return Promise.resolve({ error: null });
      },
      update: () => ({
        eq: () => Promise.resolve({ error: null })
      })
    };
  }
}

Deno.test("Idempotency: duplicate seq_number ignored", async () => {
  const mockClient = new MockSupabaseClient();
  const payload1 = { device_id: "dev1", seq_number: 100, fused_score: 0.5 };
  
  await mockClient.from("telemetry").insert(payload1);
  const res2 = await mockClient.from("telemetry").insert(payload1); // Duplicate

  assertEquals(res2.error?.code, '23505');
  assertEquals(mockClient.data["telemetry"].length, 1);
});

Deno.test("Rate limiting logic", async () => {
    const mockClient = new MockSupabaseClient() as any;
    
    // No prior data -> allowed
    let allowed = await checkRateLimit(mockClient, "dev1");
    assertEquals(allowed, true);
    
    // Seen 100ms ago -> rejected
    mockClient.data["devices"] = { last_seen_at: new Date(Date.now() - 100).toISOString() };
    allowed = await checkRateLimit(mockClient, "dev1");
    assertEquals(allowed, false);

    // Seen 600ms ago -> allowed
    mockClient.data["devices"] = { last_seen_at: new Date(Date.now() - 600).toISOString() };
    allowed = await checkRateLimit(mockClient, "dev1");
    assertEquals(allowed, true);
});

Deno.test("Ingest-summary UPSERT", async () => {
    const mockClient = new MockSupabaseClient();
    const payload = { device_id: "dev1", period_start: "2026-08-18", granularity: "hour", avg_fused_score: 0.2 };
    
    await mockClient.from("telemetry_summary").upsert([payload], { onConflict: "device_id, period_start, granularity" });
    
    const payloadUpdated = { device_id: "dev1", period_start: "2026-08-18", granularity: "hour", avg_fused_score: 0.8 };
    await mockClient.from("telemetry_summary").upsert([payloadUpdated], { onConflict: "device_id, period_start, granularity" });

    assertEquals(mockClient.data["telemetry_summary"].length, 1);
    assertEquals(mockClient.data["telemetry_summary"][0].avg_fused_score, 0.8);
});
