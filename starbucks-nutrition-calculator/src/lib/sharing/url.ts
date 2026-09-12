import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration } from '@/types/config';
import { parseUnknownConfiguration } from '@/lib/validation/validateConfig';

/** Serializes a configuration into query-string params. Reconstructible via parseConfigurationFromSearchParams. */
export function configurationToSearchParams(config: DrinkConfiguration): URLSearchParams {
  const params = new URLSearchParams();
  params.set('drink', config.drinkId);
  params.set('size', config.sizeId);
  if (config.milkId) params.set('milk', config.milkId);
  if (config.espressoShots !== null) params.set('shots', String(config.espressoShots));
  if (config.syrupPumps > 0) params.set('syrup', String(config.syrupPumps));
  if (config.saucePumps > 0) params.set('sauce', String(config.saucePumps));
  if (config.sweetener) params.set('sweetener', '1');
  if (config.coldFoam) params.set('coldfoam', '1');
  if (config.whip !== 'none') params.set('whip', config.whip);
  if (config.toppings.length > 0) params.set('toppings', config.toppings.join(','));
  return params;
}

export function configurationToShareUrl(config: DrinkConfiguration, baseUrl: string): string {
  const params = configurationToSearchParams(config);
  const url = new URL(baseUrl);
  url.search = params.toString();
  return url.toString();
}

/** Never throws on malformed input - unrecognized/invalid params are silently discarded. */
export function parseConfigurationFromSearchParams(
  params: URLSearchParams,
  database: NutritionDatabase
): { configuration: DrinkConfiguration; discarded: string[] } {
  const raw: Record<string, unknown> = {
    drinkId: params.get('drink') ?? undefined,
    sizeId: params.get('size') ?? undefined,
    milkId: params.get('milk') ?? undefined,
    espressoShots: params.has('shots') ? Number(params.get('shots')) : undefined,
    syrupPumps: params.has('syrup') ? Number(params.get('syrup')) : undefined,
    saucePumps: params.has('sauce') ? Number(params.get('sauce')) : undefined,
    sweetener: params.has('sweetener') ? params.get('sweetener') === '1' : undefined,
    coldFoam: params.has('coldfoam') ? params.get('coldfoam') === '1' : undefined,
    whip: params.get('whip') ?? undefined,
    toppings: params.has('toppings') ? params.get('toppings')!.split(',').filter(Boolean) : undefined,
  };
  return parseUnknownConfiguration(raw, database);
}
