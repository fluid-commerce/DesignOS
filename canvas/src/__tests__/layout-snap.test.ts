import { describe, expect, it } from 'vitest';
import {
  snapTranslate1D,
  pickCloserSnap,
  canSnapAxisAlignedTransform,
  snapDimensionToTargets,
} from '../lib/layout-snap';

describe('snapTranslate1D', () => {
  it('returns no delta when nothing is within threshold', () => {
    const r = snapTranslate1D([10, 50, 90], [0, 100], 5);
    expect(r.delta).toBe(0);
    expect(r.dist).toBe(Infinity);
  });

  it('snaps closest position to target', () => {
    const r = snapTranslate1D([98, 120, 142], [0, 100, 200], 8);
    expect(r.delta).toBe(2);
    expect(r.guidePos).toBe(100);
    expect(r.dist).toBe(2);
  });

  it('picks smallest distance among multiple positions', () => {
    const r = snapTranslate1D([0, 50, 104], [100, 200], 8);
    expect(r.delta).toBe(-4);
    expect(r.guidePos).toBe(100);
    expect(r.dist).toBe(4);
  });
});

describe('snapDimensionToTargets', () => {
  it('snaps width to nearest target', () => {
    const r = snapDimensionToTargets(402, [400, 500], 8, 32);
    expect(r.value).toBe(400);
    expect(r.dist).toBe(2);
  });
});

describe('pickCloserSnap', () => {
  it('prefers the snap with smaller distance', () => {
    const edge = { delta: 1, guidePos: 0, dist: 3 };
    const mid = { delta: -2, guidePos: 100, dist: 6 };
    const r = pickCloserSnap(edge, mid, 8);
    expect(r).toEqual(edge);
  });
});

describe('canSnapAxisAlignedTransform', () => {
  it('allows near-identity transform', () => {
    expect(canSnapAxisAlignedTransform(0, 1, 1)).toBe(true);
  });

  it('disallows noticeable rotation', () => {
    expect(canSnapAxisAlignedTransform(2, 1, 1)).toBe(false);
  });
});
