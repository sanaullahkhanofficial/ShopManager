import { describe, it, expect } from 'vitest';
import { calculateNutrition } from '@/lib/calculator/calculateNutrition';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';
import { DATABASE, DRINK_BY_ID } from '@/data/us';

describe('calculateNutrition', () => {
  it('returns the verified default-recipe nutrition for a known drink/size', () => {
    const drink = DRINK_BY_ID['caffe-latte']!;
    const config = buildDefaultConfiguration(drink);
    const result = calculateNutrition(config, DATABASE);
    expect(result.nutrition.calories).toBe(190);
    expect(result.nutrition.caffeineMg).toBe(150);
    expect(result.warnings).toEqual([]);
  });

  it('is deterministic: identical input always produces identical output', () => {
    const drink = DRINK_BY_ID['caramel-macchiato']!;
    const config = buildDefaultConfiguration(drink);
    const a = calculateNutrition(config, DATABASE);
    const b = calculateNutrition(config, DATABASE);
    expect(a.nutrition).toEqual(b.nutrition);
    expect(a.breakdown).toEqual(b.breakdown);
  });

  it('does not mutate the database when calculating', () => {
    const drink = DRINK_BY_ID['caffe-latte']!;
    const size = drink.sizes.find((s) => s.id === drink.defaultSizeId)!;
    const before = { ...size.nutrition };
    const config = buildDefaultConfiguration(drink);
    calculateNutrition(config, DATABASE);
    expect(size.nutrition).toEqual(before);
  });

  it('adds caffeine and calories for an extra espresso shot, deterministically', () => {
    const drink = DRINK_BY_ID['caffe-latte']!;
    const base = buildDefaultConfiguration(drink);
    const withExtraShot = { ...base, espressoShots: (base.espressoShots ?? 0) + 1 };
    const baseline = calculateNutrition(base, DATABASE);
    const withShot = calculateNutrition(withExtraShot, DATABASE);
    expect(withShot.nutrition.caffeineMg).toBe((baseline.nutrition.caffeineMg ?? 0) + 75);
    expect(withShot.nutrition.calories).toBe((baseline.nutrition.calories ?? 0) + 5);
  });

  it('clamps espresso shots to the drink-defined range instead of calculating an invalid combination', () => {
    const drink = DRINK_BY_ID['caffe-latte']!;
    const base = buildDefaultConfiguration(drink);
    const tooMany = { ...base, espressoShots: 999 };
    const result = calculateNutrition(tooMany, DATABASE);
    expect(result.configuration.espressoShots).toBe(drink.maxEspressoShots);
  });

  it('falls back to a valid default size when an unavailable size is requested', () => {
    const drink = DRINK_BY_ID['caffe-latte']!;
    const base = buildDefaultConfiguration(drink);
    const invalidSize = { ...base, sizeId: 'trenta' as const }; // lattes do not offer trenta in this dataset
    const result = calculateNutrition(invalidSize, DATABASE);
    expect(result.configuration.sizeId).toBe(drink.defaultSizeId);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('discards an unrecognized milk id rather than crashing', () => {
    const drink = DRINK_BY_ID['caffe-latte']!;
    const base = buildDefaultConfiguration(drink);
    const bogus = { ...base, milkId: 'unicorn-milk' };
    const result = calculateNutrition(bogus, DATABASE);
    expect(result.configuration.milkId).toBe(drink.defaultMilkId);
  });

  it('never fabricates a syrup nutrition delta and instead flags it unavailable', () => {
    const drink = DRINK_BY_ID['caffe-latte']!;
    const base = buildDefaultConfiguration(drink);
    const withSyrup = { ...base, syrupPumps: 2 };
    const baseline = calculateNutrition(base, DATABASE);
    const result = calculateNutrition(withSyrup, DATABASE);
    expect(result.nutrition).toEqual(baseline.nutrition);
    expect(result.warnings.some((w) => w.includes('unavailable'))).toBe(true);
  });

  it('returns an empty-nutrition, non-throwing result for an unknown drink id', () => {
    const result = calculateNutrition(
      {
        drinkId: 'not-a-real-drink',
        sizeId: 'grande',
        milkId: null,
        espressoShots: null,
        syrupPumps: 0,
        saucePumps: 0,
        sweetener: false,
        coldFoam: false,
        whip: 'none',
        toppings: [],
      },
      DATABASE
    );
    expect(result.nutrition.calories).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('never produces a false-positive combination: disabling shots for a non-espresso drink zeroes them out', () => {
    const drink = DRINK_BY_ID['cold-brew']!;
    const base = buildDefaultConfiguration(drink);
    const result = calculateNutrition({ ...base, espressoShots: 3 }, DATABASE);
    expect(result.configuration.espressoShots).toBeNull();
  });
});
