import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const data = db.getTable(table);
    
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Data Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const body = await request.json().catch(() => ({}));
    
    if (table === "calibration" && body.sensorName) {
      const updated = db.recalibrateSensor(body.sensorName);
      return NextResponse.json({ success: true, updated });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
