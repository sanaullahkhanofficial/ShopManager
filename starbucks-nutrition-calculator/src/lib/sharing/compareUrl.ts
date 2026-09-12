import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration } from '@/types/config';
import { parseUnknownConfiguration } from '@/lib/validation/validateConfig';
import { configurationToSearchParams } from './url';

export interface CompareState {
  a: DrinkConfiguration;
  b: DrinkConfiguration;
}

function prefixedToPlain(params: URLSearchParams, prefix: 'a' | 'b'): Record<string, unknown> {
  const map: Record<string, string> = { drink: 'drinkId', size: 'sizeId', milk: 'milkId' };
  const out: Record<string, unknown> = {};
  for (const [short, key] of Object.entries(map)) {
    const value = params.get(`${prefix}${short.charAt(0).toUpperCase()}${short.slice(1)}`);
    if (value !== null) out[key] = value;
  }
  return out;
}

/** Never throws on malformed input; each side falls back independently to a safe default. */
export function parseCompareFromSearchParams(params: URLSearchParams, database: NutritionDatabase): CompareState {
  const { configuration: a } = parseUnknownConfiguration(prefixedToPlain(params, 'a'), database);
  const secondDrink = database.drinks[1] ?? database.drinks[0];
  const bDefaults = secondDrink ? { drinkId: secondDrink.id } : {};
  const { configuration: b } = parseUnknownConfiguration({ ...bDefaults, ...prefixedToPlain(params, 'b') }, database);
  return { a, b };
}

export function compareStateToSearchParams(state: CompareState): URLSearchParams {
  const params = new URLSearchParams();
  const a = configurationToSearchParams(state.a);
  const b = configurationToSearchParams(state.b);
  for (const [key, value] of a.entries()) params.set(`a${key.charAt(0).toUpperCase()}${key.slice(1)}`, value);
  for (const [key, value] of b.entries()) params.set(`b${key.charAt(0).toUpperCase()}${key.slice(1)}`, value);
  return params;
}
