import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'data', 'rezon_state.json');

export async function POST() {
  try {
    const data = fs.readFileSync(dbFile, 'utf-8');
    const state = JSON.parse(data);
    
    // Find active and staged models
    const active = state.deployments.find((m: any) => m.status === 'active');
    const staged = state.deployments.find((m: any) => m.status === 'staged');
    
    if (staged) {
      if (active) active.status = 'archived';
      staged.status = 'active';
      
      // Add a timeline event to reflect this
      state.timeline.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        type: "system",
        agent: "Operator",
        msg: `Atomic OTA completed. Model ${staged.version} is now active.`,
        color: "text-purple-400"
      });
      
      fs.writeFileSync(dbFile, JSON.stringify(state, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: "No staged model found" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
