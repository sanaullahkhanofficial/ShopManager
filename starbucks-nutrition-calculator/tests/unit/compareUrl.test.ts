import { describe, it, expect } from 'vitest';
import { compareStateToSearchParams, parseCompareFromSearchParams } from '@/lib/sharing/compareUrl';
import { DATABASE, DRINK_BY_ID } from '@/data/us';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';

describe('compare URL round-trip', () => {
  it('reconstructs both sides after serializing and parsing back', () => {
    const a = buildDefaultConfiguration(DRINK_BY_ID['caffe-latte']!);
    const b = { ...buildDefaultConfiguration(DRINK_BY_ID['cappuccino']!), milkId: 'oat' };
    const params = compareStateToSearchParams({ a, b });
    const state = parseCompareFromSearchParams(params, DATABASE);
    expect(state.a.drinkId).toBe('caffe-latte');
    expect(state.b.drinkId).toBe('cappuccino');
    expect(state.b.milkId).toBe('oat');
  });

  it('never throws on malformed compare params and falls back to safe defaults', () => {
    const params = new URLSearchParams('aDrink=not-real&bDrink=also-not-real&aSize=huge');
    expect(() => parseCompareFromSearchParams(params, DATABASE)).not.toThrow();
    const state = parseCompareFromSearchParams(params, DATABASE);
    expect(DATABASE.drinks.some((d) => d.id === state.a.drinkId)).toBe(true);
    expect(DATABASE.drinks.some((d) => d.id === state.b.drinkId)).toBe(true);
  });

  it('defaults side B to a different drink than side A when nothing is specified', () => {
    const state = parseCompareFromSearchParams(new URLSearchParams(), DATABASE);
    expect(state.a.drinkId).not.toBe(state.b.drinkId);
  });
});
