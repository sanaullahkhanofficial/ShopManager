import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSavedDrinks,
  saveDrink,
  removeSavedDrink,
  getRecentDrinkIds,
  pushRecentDrinkId,
  clearRecentDrinks,
  getFavoriteIds,
  toggleFavorite,
} from '@/lib/storage/localStorage';
import { EMPTY_NUTRITION } from '@/types/nutrition';

function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

describe('localStorage helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: makeFakeLocalStorage() });
  });

  it('saves and lists a custom drink', () => {
    const result = saveDrink({
      name: 'My Latte',
      configuration: {
        drinkId: 'caffe-latte',
        sizeId: 'grande',
        milkId: '2percent',
        espressoShots: 2,
        syrupPumps: 0,
        saucePumps: 0,
        sweetener: false,
        coldFoam: false,
        whip: 'none',
        toppings: [],
      },
      nutrition: EMPTY_NUTRITION,
      dataVersion: 'test',
    });
    expect(result.ok).toBe(true);
    expect(getSavedDrinks().value.length).toBe(1);
  });

  it('removes a saved drink by id', () => {
    const saved = saveDrink({
      name: 'Removable',
      configuration: {
        drinkId: 'caffe-latte',
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
      nutrition: EMPTY_NUTRITION,
      dataVersion: 'test',
    });
    const id = saved.value[0]!.id;
    removeSavedDrink(id);
    expect(getSavedDrinks().value.find((d) => d.id === id)).toBeUndefined();
  });

  it('keeps recent drinks capped at 10 and de-duplicated', () => {
    for (let i = 0; i < 12; i++) pushRecentDrinkId(`drink-${i}`);
    pushRecentDrinkId('drink-0');
    const recents = getRecentDrinkIds().value;
    expect(recents.length).toBe(10);
    expect(recents[0]).toBe('drink-0');
  });

  it('clears recent drinks', () => {
    pushRecentDrinkId('drink-x');
    clearRecentDrinks();
    expect(getRecentDrinkIds().value).toEqual([]);
  });

  it('toggles favorites on and off', () => {
    toggleFavorite('caffe-latte');
    expect(getFavoriteIds().value).toContain('caffe-latte');
    toggleFavorite('caffe-latte');
    expect(getFavoriteIds().value).not.toContain('caffe-latte');
  });

  it('fails gracefully (does not throw) when localStorage is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(() =>
      saveDrink({
        name: 'x',
        configuration: {
          drinkId: 'caffe-latte',
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
        nutrition: EMPTY_NUTRITION,
        dataVersion: 'test',
      })
    ).not.toThrow();
    const result = saveDrink({
      name: 'x',
      configuration: {
        drinkId: 'caffe-latte',
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
      nutrition: EMPTY_NUTRITION,
      dataVersion: 'test',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
