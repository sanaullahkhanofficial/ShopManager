import { describe, it, expect } from 'vitest';
import { searchDrinks } from '@/lib/search';
import { DATABASE } from '@/data/us';

describe('searchDrinks', () => {
  it('finds "Caramel Macchiato" from a partial, lowercase query', () => {
    const results = searchDrinks('caramel mach', DATABASE.drinks, DATABASE.categories);
    expect(results.some((d) => d.name === 'Caramel Macchiato')).toBe(true);
  });

  it('is case-insensitive and tolerates extra whitespace', () => {
    const results = searchDrinks('  CARAMEL   MACCHIATO  ', DATABASE.drinks, DATABASE.categories);
    expect(results.some((d) => d.name === 'Caramel Macchiato')).toBe(true);
  });

  it('matches via alias', () => {
    const results = searchDrinks('capp', DATABASE.drinks, DATABASE.categories);
    expect(results.some((d) => d.name === 'Cappuccino')).toBe(true);
  });

  it('matches via category name', () => {
    const results = searchDrinks('refreshers', DATABASE.drinks, DATABASE.categories);
    expect(results.some((d) => d.category === 'refreshers')).toBe(true);
  });

  it('returns an empty array (never throws) for a query that matches nothing', () => {
    const results = searchDrinks('zzzz-not-a-drink', DATABASE.drinks, DATABASE.categories);
    expect(results).toEqual([]);
  });

  it('returns the full list for an empty query', () => {
    const results = searchDrinks('   ', DATABASE.drinks, DATABASE.categories);
    expect(results.length).toBe(DATABASE.drinks.length);
  });
});
