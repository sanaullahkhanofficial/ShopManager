import { describe, it, expect } from 'vitest';
import { computeNutritionDelta, isZeroDelta } from '@/lib/calculator/delta';
import { EMPTY_NUTRITION } from '@/types/nutrition';

describe('computeNutritionDelta', () => {
  it('computes a field-by-field difference', () => {
    const current = { ...EMPTY_NUTRITION, calories: 190, sugarG: 18 };
    const baseline = { ...EMPTY_NUTRITION, calories: 225, sugarG: 26 };
    const delta = computeNutritionDelta(current, baseline);
    expect(delta.calories).toBe(-35);
    expect(delta.sugarG).toBe(-8);
  });

  it('never fabricates a comparison when either side is unknown', () => {
    const current = { ...EMPTY_NUTRITION, sodiumMg: null };
    const baseline = { ...EMPTY_NUTRITION, sodiumMg: 120 };
    const delta = computeNutritionDelta(current, baseline);
    expect(delta.sodiumMg).toBeNull();
  });

  it('detects an all-zero/unknown delta', () => {
    expect(isZeroDelta(EMPTY_NUTRITION as never)).toBe(true);
  });
});
