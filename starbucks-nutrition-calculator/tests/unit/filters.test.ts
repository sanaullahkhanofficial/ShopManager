import { describe, it, expect } from 'vitest';
import { applyFilter, QUICK_FILTERS } from '@/lib/filters';
import { DATABASE } from '@/data/us';

describe('applyFilter', () => {
  it('queries live drink data instead of a hard-coded drink list', () => {
    const results = applyFilter('under-200-cal', DATABASE.drinks);
    for (const drink of results) {
      const size = drink.sizes.find((s) => s.id === drink.defaultSizeId)!;
      expect(size.nutrition.calories).not.toBeNull();
      expect(size.nutrition.calories!).toBeLessThan(200);
    }
  });

  it('every declared quick filter runs without throwing', () => {
    for (const filter of QUICK_FILTERS) {
      expect(() => applyFilter(filter.id, DATABASE.drinks)).not.toThrow();
    }
  });

  it('high-protein filter only returns drinks with verified protein >= 10g', () => {
    const results = applyFilter('high-protein', DATABASE.drinks);
    expect(results.length).toBeGreaterThan(0);
    for (const drink of results) {
      const size = drink.sizes.find((s) => s.id === drink.defaultSizeId)!;
      expect(size.nutrition.proteinG!).toBeGreaterThanOrEqual(10);
    }
  });
});
