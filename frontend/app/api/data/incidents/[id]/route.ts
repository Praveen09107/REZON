import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const incident = db.getIncident(id);
    
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: incident });
  } catch (error: any) {
    console.error('Incident Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    const updated = db.updateIncident(id, {
      human_label: body.human_label,
      operator_notes: body.operator_notes,
      work_order_id: body.work_order_id,
      reviewer_name: body.reviewer_name
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Incident Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
