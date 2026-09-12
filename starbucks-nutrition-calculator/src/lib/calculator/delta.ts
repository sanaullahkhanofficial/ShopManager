import type { NutritionFacts, NutritionDelta } from '@/types/nutrition';

/**
 * "What changed?" support: compares two already-calculated nutrition results
 * field by field. Returns null for a field whenever either side is unknown,
 * rather than fabricating a comparison against a missing number.
 */
export function computeNutritionDelta(current: NutritionFacts, baseline: NutritionFacts): NutritionDelta {
  const out = {} as NutritionDelta;
  for (const key of Object.keys(current) as (keyof NutritionFacts)[]) {
    const a = current[key];
    const b = baseline[key];
    out[key] = a === null || b === null ? null : Math.round((a - b) * 10) / 10;
  }
  return out;
}

export function isZeroDelta(delta: NutritionDelta): boolean {
  return Object.values(delta).every((v) => v === null || v === 0);
}
