import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    db.insertTelemetry({
      seq_number: body.seq_number,
      recorded_at: body.recorded_at,
      audio_score: body.audio_score ?? 0,
      vibration_score: body.vibration_score ?? 0,
      env_score: body.env_score ?? 0,
      gas_score: body.gas_score ?? 0,
      current_score: body.current_score ?? 0,
      env_temp: body.env_temp ?? 0,
      env_humidity: body.env_humidity ?? 0,
      env_pressure: body.env_pressure ?? 0,
      fused_score: body.fused_score ?? 0,
      event_type: body.event?.type ?? null,
      free_heap_bytes: body.free_heap_bytes ?? 0,
      psram_used_bytes: body.psram_used_bytes ?? 0,
      psram_total_bytes: body.psram_total_bytes ?? 0,
      wifi_rssi_dbm: body.wifi_rssi_dbm ?? 0,
      sd_buffer_minutes: body.sd_buffer_minutes ?? 0
    });

    db.simulateTick(body);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Ingest Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
