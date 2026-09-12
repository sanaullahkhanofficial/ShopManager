import { describe, it, expect } from 'vitest';
import { DATABASE, FOOD_BY_SLUG } from '@/data/us';

describe('food dataset', () => {
  it('has at least one food item with a resolvable slug', () => {
    expect(DATABASE.foods.length).toBeGreaterThan(0);
    for (const food of DATABASE.foods) {
      expect(FOOD_BY_SLUG[food.slug]).toBe(food);
    }
  });

  it('never presents a food item as verified without an actual review', () => {
    for (const food of DATABASE.foods) {
      expect(food.source.status).not.toBe('verified');
    }
  });

  it('never fabricates a sourceUrl - unsourced items explicitly have sourceUrl null, not a guessed link', () => {
    for (const food of DATABASE.foods) {
      if (food.source.sourceUrl) {
        expect(food.source.sourceUrl).toMatch(/^https:\/\/www\.starbucks\.com\//);
      }
    }
  });

  it('every food item has at least calories and protein populated', () => {
    for (const food of DATABASE.foods) {
      expect(food.nutrition.calories).not.toBeNull();
      expect(food.nutrition.proteinG).not.toBeNull();
    }
  });
});
