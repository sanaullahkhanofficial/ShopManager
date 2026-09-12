import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration } from '@/types/config';
import type { NutritionFacts, NutritionDelta, SourceInfo } from '@/types/nutrition';
import { EMPTY_NUTRITION } from '@/types/nutrition';
import { clamp, mergeDelta } from './math';

export interface NutritionBreakdownItem {
  id: string;
  label: string;
  appliedDelta: NutritionDelta | null;
  quantity: number;
  note?: string;
}

export interface CalculationResult {
  nutrition: NutritionFacts;
  breakdown: NutritionBreakdownItem[];
  warnings: string[];
  sourceInfo: SourceInfo[];
  /** The configuration actually used to produce this result, after clamping/repairing anything invalid. */
  configuration: DrinkConfiguration;
}

/**
 * Pure function: same (configuration, database) always produces the same result.
 * Never mutates `configuration` or anything inside `database`.
 */
export function calculateNutrition(configuration: DrinkConfiguration, database: NutritionDatabase): CalculationResult {
  const warnings: string[] = [];
  const sourceInfo: SourceInfo[] = [];
  const breakdown: NutritionBreakdownItem[] = [];

  const drink = database.drinks.find((d) => d.id === configuration.drinkId);
  if (!drink) {
    warnings.push(`"${configuration.drinkId}" is not a recognized drink.`);
    return { nutrition: { ...EMPTY_NUTRITION }, breakdown, warnings, sourceInfo, configuration };
  }

  let effectiveConfig: DrinkConfiguration = { ...configuration, drinkId: drink.id };

  let size = drink.sizes.find((s) => s.id === effectiveConfig.sizeId && s.available);
  if (!size) {
    const fallback = drink.sizes.find((s) => s.id === drink.defaultSizeId && s.available) ?? drink.sizes.find((s) => s.available);
    if (!fallback) {
      warnings.push(`No available nutrition data for ${drink.name} in any size yet.`);
      return { nutrition: { ...EMPTY_NUTRITION }, breakdown, warnings, sourceInfo: [drink.source], configuration: effectiveConfig };
    }
    if (effectiveConfig.sizeId !== fallback.id) {
      warnings.push(`"${effectiveConfig.sizeId}" is not available for ${drink.name}; showing ${fallback.name} instead.`);
    }
    size = fallback;
    effectiveConfig = { ...effectiveConfig, sizeId: fallback.id };
  }
  sourceInfo.push(size.source);

  let total: NutritionFacts = { ...size.nutrition };
  breakdown.push({ id: 'base', label: `${drink.name} — ${size.name} (default recipe)`, appliedDelta: null, quantity: 1 });

  // --- Milk ---
  if (drink.eligibility.milk) {
    const requested = effectiveConfig.milkId;
    const milkId = requested && drink.eligibleMilkIds.includes(requested) ? requested : drink.defaultMilkId;
    effectiveConfig = { ...effectiveConfig, milkId };
    if (milkId && drink.defaultMilkId && milkId !== drink.defaultMilkId) {
      const milk = database.milks.find((m) => m.id === milkId);
      const variant = drink.milkVariants?.[milkId];
      if (variant && variant.sizeId === size.id) {
        // A verified, whole-recipe figure exists for this exact milk+size - use it
        // as the new base instead of layering an unverified delta on top.
        total = { ...variant.nutrition };
        breakdown[0] = { id: 'base', label: `${drink.name} — ${size.name} with ${milk?.name ?? milkId}`, appliedDelta: null, quantity: 1 };
        sourceInfo.push(variant.source);
      } else {
        warnings.push(
          `Milk substitution (${milk?.name ?? milkId}) is not in the verified per-drink dataset yet — totals below reflect the default recipe milk.`
        );
      }
    }
  } else if (effectiveConfig.milkId !== null) {
    effectiveConfig = { ...effectiveConfig, milkId: null };
  }

  // --- Espresso shots ---
  if (drink.eligibility.shots && drink.defaultEspressoShots !== null) {
    const min = drink.minEspressoShots ?? 0;
    const max = drink.maxEspressoShots ?? Math.max(min, drink.defaultEspressoShots);
    const requestedShots = effectiveConfig.espressoShots ?? drink.defaultEspressoShots;
    const shots = clamp(requestedShots, min, max);
    effectiveConfig = { ...effectiveConfig, espressoShots: shots };
    const diff = shots - drink.defaultEspressoShots;
    if (diff !== 0 && database.modifiers.espressoShot.perUnit) {
      const perUnit = database.modifiers.espressoShot.perUnit;
      const scaled: NutritionDelta = Object.fromEntries(Object.entries(perUnit).map(([k, v]) => [k, v === null ? null : v * diff])) as NutritionDelta;
      const { result } = mergeDelta(total, scaled);
      total = result;
      breakdown.push({
        id: 'espresso-shots',
        label: `${diff > 0 ? '+' : ''}${diff} Espresso Shot${Math.abs(diff) === 1 ? '' : 's'}`,
        appliedDelta: scaled,
        quantity: diff,
      });
      sourceInfo.push(database.modifiers.espressoShot.source);
    }
  } else if (effectiveConfig.espressoShots !== null) {
    effectiveConfig = { ...effectiveConfig, espressoShots: null };
  }

  // --- Syrup / sauce pumps (data unavailable at ingredient level) ---
  effectiveConfig = applyUnavailablePumpModifier(effectiveConfig, 'syrupPumps', drink.eligibility.syrup, database.modifiers.syrupPump, breakdown, warnings);
  effectiveConfig = applyUnavailablePumpModifier(effectiveConfig, 'saucePumps', drink.eligibility.sauce, database.modifiers.saucePump, breakdown, warnings);

  // --- Sweetener (no verified nutrition impact modeled) ---
  if (!drink.eligibility.sweetener && effectiveConfig.sweetener) {
    effectiveConfig = { ...effectiveConfig, sweetener: false };
  } else if (effectiveConfig.sweetener) {
    breakdown.push({ id: 'sweetener', label: 'Sweetener', appliedDelta: null, quantity: 1, note: 'Nutrition impact unavailable' });
    warnings.push('Ingredient-level calculation unavailable for this customization: Sweetener.');
  }

  // --- Cold foam (no verified nutrition impact modeled) ---
  if (!drink.eligibility.coldFoam && effectiveConfig.coldFoam) {
    effectiveConfig = { ...effectiveConfig, coldFoam: false };
  } else if (effectiveConfig.coldFoam) {
    breakdown.push({ id: 'cold-foam', label: 'Cold Foam', appliedDelta: null, quantity: 1, note: 'Nutrition impact unavailable' });
    warnings.push('Ingredient-level calculation unavailable for this customization: Cold Foam.');
  }

  // --- Whipped cream ---
  if (!drink.eligibility.whip && effectiveConfig.whip !== 'none') {
    effectiveConfig = { ...effectiveConfig, whip: 'none' };
  } else if (effectiveConfig.whip !== 'none') {
    const mod = database.modifiers.whippedCream;
    if (mod.perUnit) {
      const { result } = mergeDelta(total, mod.perUnit);
      total = result;
      breakdown.push({
        id: 'whip',
        label: `Whipped Cream (${effectiveConfig.whip})`,
        appliedDelta: mod.perUnit,
        quantity: 1,
        note: 'Level (light/standard/extra) is not separately verified; figure reflects one standard serving.',
      });
      sourceInfo.push(mod.source);
      warnings.push('Whipped cream level (light/standard/extra) is not separately verified — totals reflect one standard serving regardless of level.');
    } else {
      breakdown.push({ id: 'whip', label: `Whipped Cream (${effectiveConfig.whip})`, appliedDelta: null, quantity: 1, note: 'Nutrition impact unavailable' });
      warnings.push('Ingredient-level calculation unavailable for this customization: Whipped Cream.');
    }
  }

  // --- Toppings (no verified nutrition impact modeled) ---
  if (!drink.eligibility.topping && effectiveConfig.toppings.length > 0) {
    effectiveConfig = { ...effectiveConfig, toppings: [] };
  } else if (effectiveConfig.toppings.length > 0) {
    breakdown.push({
      id: 'toppings',
      label: effectiveConfig.toppings.join(', '),
      appliedDelta: null,
      quantity: effectiveConfig.toppings.length,
      note: 'Nutrition impact unavailable',
    });
    warnings.push('Ingredient-level calculation unavailable for toppings.');
  }

  return { nutrition: total, breakdown, warnings, sourceInfo, configuration: effectiveConfig };
}

function applyUnavailablePumpModifier(
  config: DrinkConfiguration,
  field: 'syrupPumps' | 'saucePumps',
  eligible: boolean,
  modifier: NutritionDatabase['modifiers']['syrupPump'],
  breakdown: NutritionBreakdownItem[],
  warnings: string[]
): DrinkConfiguration {
  const pumps = config[field];
  if (!eligible) {
    return pumps > 0 ? { ...config, [field]: 0 } : config;
  }
  const clamped = clamp(pumps, modifier.min, modifier.max);
  const next = clamped !== pumps ? { ...config, [field]: clamped } : config;
  if (clamped > 0 && modifier.perUnit === null) {
    warnings.push(
      `Ingredient-level calculation unavailable for this customization: ${modifier.name}. Totals below reflect the base recipe and do not include ${clamped} ${modifier.unit}${clamped === 1 ? '' : 's'}.`
    );
    breakdown.push({
      id: modifier.id,
      label: `${clamped} ${modifier.name}${clamped === 1 ? '' : ' (' + modifier.unit + 's)'}`,
      appliedDelta: null,
      quantity: clamped,
      note: 'Nutrition impact unavailable',
    });
  }
  return next;
}
