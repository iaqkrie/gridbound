import { DecayRule, SeededRng } from './types';

/**
 * Evaluates a declarative Phase 2 DecayRule against a positive numeric value.
 */
export function applyDecayRule(value: number, rule: DecayRule): number {
  if (value <= 0) return 0;

  switch (rule.kind) {
    case 'clear':
      return 0;
    case 'none':
      return value;
    case 'linear':
      return Math.max(0, Math.floor(value - rule.amount));
    case 'percent': {
      const raw = value * rule.retainRatio;
      let next: number;
      if (rule.round === 'ceil') {
        next = Math.ceil(raw);
      } else if (rule.round === 'round') {
        next = Math.round(raw);
      } else {
        next = Math.floor(raw);
      }
      if (rule.minStep && rule.minStep > 0 && value - next < rule.minStep) {
        next = value - rule.minStep;
      }
      return Math.max(0, next);
    }
  }
}

/**
 * Produces a deterministic seeded PRNG (Mulberry32) from any string seed.
 */
export function createSeededRng(seed: string): SeededRng {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomSeed(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
