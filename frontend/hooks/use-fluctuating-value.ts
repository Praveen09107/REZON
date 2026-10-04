import { useState, useEffect } from 'react';

/**
 * Creates a realistically fluctuating number around a base value.
 * @param baseValue The central value to fluctuate around.
 * @param variance The maximum +/- variance from the base value.
 * @param intervalMs How often the value updates (default: 500ms).
 */
export function useFluctuatingValue(baseValue: number, variance: number, intervalMs: number = 500) {
  const [value, setValue] = useState(baseValue);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate smoothed random walk
      setValue(prev => {
        const drift = (Math.random() - 0.5) * variance * 0.5;
        let next = prev + drift;
        
        // Keep it bounded within the variance range
        if (next > baseValue + variance) next = baseValue + variance;
        if (next < baseValue - variance) next = baseValue - variance;
        
        return next;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [baseValue, variance, intervalMs]);

  return value;
}
