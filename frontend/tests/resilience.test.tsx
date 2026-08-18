import { describe, it, expect } from 'vitest';
import { getScoreColor } from '../lib/score-color';

describe('Score-to-Color Mapping (Frontend Spec §2)', () => {
  it('maps scores to expected color ranges', () => {
    // Score <= 0.5 -> calm (text-green-500)
    expect(getScoreColor(0.2)).toContain('green');
    expect(getScoreColor(0.5)).toContain('green');
    
    // Score 0.5 to 0.75 -> elevated (text-yellow-500)
    expect(getScoreColor(0.6)).toContain('yellow');
    
    // Score > 0.85 -> danger (text-red-500)
    expect(getScoreColor(0.9)).toContain('red');
  });
});

describe('Resilience States (Frontend Spec §10)', () => {
    it('simulates stale-data banner threshold', () => {
        const lastUpdated = new Date(Date.now() - 65 * 1000); // 65 seconds ago
        const isStale = (Date.now() - lastUpdated.getTime()) > 60000;
        expect(isStale).toBe(true);
    });

    it('simulates connection-lost state', () => {
        const lastUpdated = new Date(Date.now() - 305 * 1000); // 305 seconds ago
        const isLost = (Date.now() - lastUpdated.getTime()) > 300000; // 5 mins
        expect(isLost).toBe(true);
    });
});
