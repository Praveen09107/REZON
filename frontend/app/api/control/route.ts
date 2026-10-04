import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const controlFile = path.join(dataDir, 'control.json');

// Initialize with default state
if (!fs.existsSync(controlFile)) {
  fs.writeFileSync(controlFile, JSON.stringify({ scenario: null }), 'utf-8');
}

export async function POST(request: Request) {
  try {
    const { scenario } = await request.json();
    
    // Write the requested scenario to control.json
    fs.writeFileSync(controlFile, JSON.stringify({ scenario, timestamp: Date.now() }), 'utf-8');

    return NextResponse.json({ success: true, scenario });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const data = fs.readFileSync(controlFile, 'utf-8');
    return NextResponse.json({ success: true, data: JSON.parse(data) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
