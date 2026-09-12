import type { NutritionFacts, NutritionDelta } from '@/types/nutrition';

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Multiplies every known field of a delta by `factor`. Null fields stay null - never turned into 0. */
export function scaleDelta(delta: NutritionDelta, factor: number): NutritionDelta {
  const out = {} as NutritionDelta;
  for (const key of Object.keys(delta) as (keyof NutritionDelta)[]) {
    const v = delta[key];
    out[key] = v === null ? null : v * factor;
  }
  return out;
}

/**
 * Adds a delta onto a nutrition total, returning a brand new object (never mutates `base`).
 * - If the base field is null, it stays null (we never had a number to begin with).
 * - If the delta field is null but the base field is known, the base value is kept unchanged
 *   and `partial` is flagged true, so callers can surface a warning instead of pretending the
 *   field was fully accounted for.
 */
export function mergeDelta(base: NutritionFacts, delta: NutritionDelta): { result: NutritionFacts; partial: boolean } {
  const result = { ...base };
  let partial = false;
  for (const key of Object.keys(base) as (keyof NutritionFacts)[]) {
    const baseValue = base[key];
    const deltaValue = delta[key];
    if (baseValue === null) continue;
    if (deltaValue === null) {
      partial = true;
      continue;
    }
    result[key] = roundField(key, baseValue + deltaValue);
  }
  return { result, partial };
}

function roundField(key: keyof NutritionFacts, value: number): number {
  // Whole-number fields per U.S. nutrition label convention; fat-family fields keep one decimal.
  const oneDecimal: (keyof NutritionFacts)[] = ['totalFatG', 'saturatedFatG', 'transFatG'];
  if (oneDecimal.includes(key)) return Math.round(value * 10) / 10;
  return Math.round(value);
}
