import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Local path to the simulator's scenario file
const SCENARIO_FILE_PATH = path.join(process.cwd(), '..', 'local-stack', 'simulator', 'scenario.json');

export async function POST(request: Request) {
  try {
    const { scenario } = await request.json();
    
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario name is required' }, { status: 400 });
    }

    // Write to the local file for the Python simulator to pick up
    fs.writeFileSync(SCENARIO_FILE_PATH, JSON.stringify({ scenario, status: "pending" }, null, 2));
    
    return NextResponse.json({ success: true, injected: scenario });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to inject scenario' }, { status: 500 });
  }
}
