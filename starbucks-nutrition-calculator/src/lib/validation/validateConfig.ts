import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration, WhipLevel } from '@/types/config';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';
import { calculateNutrition } from '@/lib/calculator/calculateNutrition';

const WHIP_LEVELS: WhipLevel[] = ['none', 'light', 'standard', 'extra'];

/**
 * Turns arbitrary, untrusted input (a parsed URL, a localStorage blob, an
 * imported JSON file) into a DrinkConfiguration we are willing to compute
 * with. Never throws - anything unrecognized is discarded and replaced with
 * a safe default, and the caller is told what changed via `discarded`.
 */
export function parseUnknownConfiguration(input: unknown, database: NutritionDatabase): { configuration: DrinkConfiguration; discarded: string[] } {
  const discarded: string[] = [];
  const record = isRecord(input) ? input : {};

  const drinkId = typeof record.drinkId === 'string' ? record.drinkId : null;
  const drink = drinkId ? database.drinks.find((d) => d.id === drinkId) : undefined;
  if (!drink) {
    if (drinkId) discarded.push('drinkId');
    const fallback = database.drinks[0];
    if (!fallback) throw new Error('Database has no drinks configured.');
    return { configuration: buildDefaultConfiguration(fallback), discarded };
  }

  const base = buildDefaultConfiguration(drink);

  const sizeId =
    typeof record.sizeId === 'string' && drink.sizes.some((s) => s.id === record.sizeId) ? (record.sizeId as DrinkConfiguration['sizeId']) : base.sizeId;
  if (record.sizeId !== undefined && sizeId !== record.sizeId) discarded.push('sizeId');

  const milkId = typeof record.milkId === 'string' && drink.eligibleMilkIds.includes(record.milkId) ? record.milkId : base.milkId;
  if (record.milkId !== undefined && record.milkId !== null && milkId !== record.milkId) discarded.push('milkId');

  const espressoShots =
    typeof record.espressoShots === 'number' && Number.isFinite(record.espressoShots) ? Math.round(record.espressoShots) : base.espressoShots;
  if (record.espressoShots !== undefined && record.espressoShots !== null && espressoShots !== record.espressoShots) discarded.push('espressoShots');

  const syrupPumps = typeof record.syrupPumps === 'number' && Number.isFinite(record.syrupPumps) ? Math.max(0, Math.round(record.syrupPumps)) : base.syrupPumps;
  const saucePumps = typeof record.saucePumps === 'number' && Number.isFinite(record.saucePumps) ? Math.max(0, Math.round(record.saucePumps)) : base.saucePumps;
  const sweetener = typeof record.sweetener === 'boolean' ? record.sweetener : base.sweetener;
  const coldFoam = typeof record.coldFoam === 'boolean' ? record.coldFoam : base.coldFoam;
  const whip = typeof record.whip === 'string' && WHIP_LEVELS.includes(record.whip as WhipLevel) ? (record.whip as WhipLevel) : base.whip;
  const toppings = Array.isArray(record.toppings) ? record.toppings.filter((t): t is string => typeof t === 'string') : base.toppings;

  const candidate: DrinkConfiguration = { drinkId: drink.id, sizeId, milkId, espressoShots, syrupPumps, saucePumps, sweetener, coldFoam, whip, toppings };

  // Route through the calculation engine's own repair pass so URL/localStorage
  // input can never smuggle in a combination the calculator itself would reject.
  const { configuration } = calculateNutrition(candidate, database);
  return { configuration, discarded };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
