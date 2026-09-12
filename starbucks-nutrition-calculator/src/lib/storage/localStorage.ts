import type { DrinkConfiguration } from '@/types/config';
import type { NutritionFacts } from '@/types/nutrition';

const KEYS = {
  saved: 'sbnc.savedDrinks.v1',
  recent: 'sbnc.recentDrinks.v1',
  favorites: 'sbnc.favorites.v1',
} as const;

export interface SavedDrink {
  id: string;
  createdAt: string;
  name: string;
  configuration: DrinkConfiguration;
  nutrition: NutritionFacts;
  dataVersion: string;
}

export interface StorageResult<T> {
  ok: boolean;
  value: T;
  error?: string;
}

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__sbnc_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function readJson<T>(key: string, fallback: T): StorageResult<T> {
  if (!isStorageAvailable()) return { ok: false, value: fallback, error: 'Local storage is not available in this browser.' };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ok: true, value: fallback };
    const parsed = JSON.parse(raw);
    return { ok: true, value: parsed as T };
  } catch {
    return { ok: false, value: fallback, error: 'Saved data could not be read (it may be corrupted).' };
  }
}

function writeJson<T>(key: string, value: T): StorageResult<T> {
  if (!isStorageAvailable()) return { ok: false, value, error: 'Local storage is not available in this browser.' };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, value };
  } catch {
    return { ok: false, value, error: 'Could not save — your browser storage may be full or blocked (e.g. private browsing).' };
  }
}

export function getSavedDrinks(): StorageResult<SavedDrink[]> {
  return readJson<SavedDrink[]>(KEYS.saved, []);
}

export function saveDrink(entry: Omit<SavedDrink, 'id' | 'createdAt'>): StorageResult<SavedDrink[]> {
  const current = getSavedDrinks().value;
  const next: SavedDrink = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
  return writeJson(KEYS.saved, [next, ...current]);
}

export function removeSavedDrink(id: string): StorageResult<SavedDrink[]> {
  const current = getSavedDrinks().value;
  return writeJson(
    KEYS.saved,
    current.filter((d) => d.id !== id)
  );
}

const RECENT_LIMIT = 10;

export function getRecentDrinkIds(): StorageResult<string[]> {
  return readJson<string[]>(KEYS.recent, []);
}

export function pushRecentDrinkId(drinkId: string): StorageResult<string[]> {
  const current = getRecentDrinkIds().value.filter((id) => id !== drinkId);
  const next = [drinkId, ...current].slice(0, RECENT_LIMIT);
  return writeJson(KEYS.recent, next);
}

export function clearRecentDrinks(): StorageResult<string[]> {
  return writeJson(KEYS.recent, []);
}

export function getFavoriteIds(): StorageResult<string[]> {
  return readJson<string[]>(KEYS.favorites, []);
}

export function toggleFavorite(drinkId: string): StorageResult<string[]> {
  const current = getFavoriteIds().value;
  const next = current.includes(drinkId) ? current.filter((id) => id !== drinkId) : [drinkId, ...current];
  return writeJson(KEYS.favorites, next);
}
