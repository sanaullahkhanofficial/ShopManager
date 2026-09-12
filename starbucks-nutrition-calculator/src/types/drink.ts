import type { NutritionFacts, SourceInfo } from './nutrition';

export type DrinkCategory =
  | 'hot-coffee'
  | 'iced-coffee'
  | 'espresso'
  | 'cold-brew'
  | 'latte'
  | 'cappuccino'
  | 'macchiato'
  | 'mocha'
  | 'americano'
  | 'shaken-espresso'
  | 'frappuccino'
  | 'refreshers'
  | 'matcha'
  | 'chai'
  | 'tea'
  | 'other'
  | 'food';

export type SizeId = 'short' | 'tall' | 'grande' | 'venti' | 'trenta';

export interface DrinkSize {
  id: SizeId;
  name: string;
  fluidOz: number;
  /** Nutrition for this drink at this size, using the drink's default recipe. */
  nutrition: NutritionFacts;
  available: boolean;
  source: SourceInfo;
}

/**
 * A verified, whole-recipe nutrition figure for this drink made with a
 * specific non-default milk, at a specific size. This is NOT a delta - it is
 * a full replacement for the base nutrition, because Starbucks publishes
 * these as their own distinct products rather than a fixed per-milk offset.
 * Only present when a real source was found; absence means "not verified",
 * never "no difference".
 */
export interface MilkVariant {
  sizeId: SizeId;
  nutrition: NutritionFacts;
  source: SourceInfo;
}

export type ModifierKind = 'milk' | 'shots' | 'syrup' | 'sauce' | 'sweetener' | 'coldFoam' | 'whip' | 'topping';

export interface CustomizationEligibility {
  milk: boolean;
  shots: boolean;
  syrup: boolean;
  sauce: boolean;
  sweetener: boolean;
  coldFoam: boolean;
  whip: boolean;
  topping: boolean;
}

export interface Drink {
  id: string;
  slug: string;
  name: string;
  category: DrinkCategory;
  subcategory: string | null;
  description: string;
  aliases: string[];
  sizes: DrinkSize[];
  defaultSizeId: SizeId;
  /** Milk option ids this drink supports, in display order. Empty when the drink has no milk (e.g. black coffee). */
  eligibleMilkIds: string[];
  defaultMilkId: string | null;
  /** Verified full-recipe nutrition for specific non-default milk substitutions, keyed by milk id. */
  milkVariants?: Record<string, MilkVariant>;
  defaultEspressoShots: number | null;
  minEspressoShots: number | null;
  maxEspressoShots: number | null;
  eligibility: CustomizationEligibility;
  allergens: string[];
  source: SourceInfo;
  region: 'US';
}
