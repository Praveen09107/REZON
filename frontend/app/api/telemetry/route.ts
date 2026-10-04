import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); 

    if (mode === 'history') {
      const rows = db.getHistory();
      return NextResponse.json({ success: true, data: rows });
    }

    const latest = db.getLatest();
    return NextResponse.json({ success: true, data: latest || null });
  } catch (error: any) {
    console.error('Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
